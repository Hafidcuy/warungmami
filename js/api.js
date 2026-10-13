/**
 * Warung Mami - Library frontend bersama
 * Semua halaman memakai file ini untuk:
 *  - memanggil API (fetch JSON)
 *  - keranjang belanja (data sementara di browser)
 *  - status login & tampilan navbar
 *
 * PENTING: Database toko (akun, produk, pesanan) ada di SQLite di server.
 * localStorage HANYA dipakai untuk keranjang belanja sementara
 * di browser Anda, sama seperti keranjang pada e-commerce biasa.
 */

// ================= API =================
const API = {
  async request(method, path, body) {
    const res = await fetch("/api" + path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* response kosong */ }
    if (!res.ok) throw new Error((data && data.error) || "Terjadi kesalahan");
    return data;
  },
  get(path) { return this.request("GET", path); },
  post(path, body) { return this.request("POST", path, body); },
  patch(path, body) { return this.request("PATCH", path, body); },
  del(path) { return this.request("DELETE", path); },
  /**
   * Unggah file biner (foto profil) sebagai body mentah, bukan JSON.
   * `blob` harus berupa Blob dengan tipe yang dikenali server (image/jpeg|png|webp).
   */
  async upload(path, blob) {
    const res = await fetch("/api" + path, {
      method: "POST",
      headers: { "Content-Type": blob.type || "application/octet-stream" },
      body: blob,
      credentials: "same-origin",
    });
    let data = null;
    try { data = await res.json(); } catch (_) { /* response kosong */ }
    if (!res.ok) throw new Error((data && data.error) || "Gagal mengunggah file");
    return data;
  },
};

// ================= Format =================
function rupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function formatDate(sqlDateTime) {
  if (!sqlDateTime) return "-";
  const d = new Date(sqlDateTime.replace(" ", "T"));
  if (isNaN(d)) return sqlDateTime;
  return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const STATUS_BADGE = {
  pending: { label: "Menunggu Konfirmasi", cls: "badge-pending" },
  accepted: { label: "Diproses", cls: "badge-accepted" },
  siap: { label: "Siap Diambil", cls: "badge-siap" },
  sending: { label: "Sedang Diantar", cls: "badge-sending" },
  delivered: { label: "Selesai", cls: "badge-delivered" },
  cancelled: { label: "Dibatalkan", cls: "badge-cancelled" },
};

// Cadangan bila server belum punya data wilayah (harus sinkron dengan server/db.js)
const ONGKIR = 5000;
const ONGKIR_GRATIS_MIN = 50000;

// ================= Wilayah ongkir (biaya antar per area) =================
// Diambil sekali dari server lalu dipakai bersama oleh keranjang, profil, dll.
let AREAS = [];
const AREA_KEY = "warungmami_area";

async function loadAreas(force = false) {
  if (!force && AREAS.length) return AREAS;
  try {
    const data = await API.get("/areas");
    AREAS = data.areas || [];
  } catch (_) {
    if (!force) AREAS = AREAS || [];
  }
  return AREAS;
}

function getAreaById(id) {
  if (id === null || id === undefined || id === "" || id === 0) return null;
  return AREAS.find((a) => a.id === +id) || null;
}

/** Ongkir untuk wilayah terpilih. area null → aturan lama (cadangan). */
function hitungOngkirArea(area, subtotal, diskon = 0) {
  const setelahDiskon = Math.max(0, subtotal - diskon);
  if (!area) return setelahDiskon >= ONGKIR_GRATIS_MIN ? 0 : ONGKIR;
  const gratis = area.gratis_min;
  if (gratis !== null && gratis !== undefined && setelahDiskon >= gratis) return 0;
  return Math.max(0, area.ongkir || 0);
}

/** Sisa belanja agar gratis ongkir di wilayah ini (0 = tidak berlaku). */
function kurangGratisOngkir(area, subtotal, diskon = 0) {
  if (!area) {
    const s = Math.max(0, subtotal - diskon);
    return Math.max(0, ONGKIR_GRATIS_MIN - s);
  }
  const gratis = area.gratis_min;
  if (gratis === null || gratis === undefined) return 0;
  return Math.max(0, gratis - Math.max(0, subtotal - diskon));
}

/** Simpan/pilih wilayah terakhir pelanggan. */
function simpanAreaDipilih(id) {
  if (id) localStorage.setItem(AREA_KEY, String(id));
  else localStorage.removeItem(AREA_KEY);
}

function areaTerpilihDariStorage() {
  return getAreaById(parseInt(localStorage.getItem(AREA_KEY), 10));
}

function badgeHTML(status) {
  const s = STATUS_BADGE[status] || { label: status, cls: "" };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

// ================= Toast =================
function toast(message, type = "success") {
  let box = document.getElementById("toastBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "toastBox";
    box.style.cssText = "position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;display:flex;flex-direction:column;gap:8px;align-items:center;";
    document.body.appendChild(box);
  }
  const el = document.createElement("div");
  el.textContent = message;
  const warna = type === "error" ? "var(--cabai)" : type === "success" ? "var(--daun)" : "var(--brand-dk)";
  el.style.cssText = `background:${warna};color:#fff;padding:10px 18px;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,.25);font-size:14px;max-width:90vw;`;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

// ================= Keranjang (data sementara browser) =================
const CART_KEY = "warungmami_cart";

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch (_) { return []; }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  updateCartCount();
}

function addToCart(product, qty = 1) {
  const cart = getCart();
  const found = cart.find((i) => i.id === product.id);
  if (found) found.qty += qty;
  else cart.push({ id: product.id, name: product.name, price: product.price, image: product.image_url || "", qty });
  saveCart(cart);
  toast(`${product.name} masuk keranjang`);
}

function setCartQty(id, qty) {
  let cart = getCart();
  const item = cart.find((i) => i.id === id);
  if (!item) return;
  item.qty = Math.max(1, Math.min(99, qty));
  saveCart(cart);
}

function removeFromCart(id) {
  saveCart(getCart().filter((i) => i.id !== id));
}

function clearCart() {
  saveCart([]);
}

function cartCount() {
  return getCart().reduce((n, i) => n + i.qty, 0);
}

function updateCartCount() {
  const el = document.getElementById("cartCount");
  if (el) el.textContent = cartCount();
}

// ================= Auth & Navbar =================
let CURRENT_USER = null;

async function loadMe() {
  try {
    const { user } = await API.get("/me");
    CURRENT_USER = user;
  } catch (_) { CURRENT_USER = null; }
  return CURRENT_USER;
}

async function logout() {
  try { await API.post("/logout"); } catch (_) { /* abaikan */ }
  CURRENT_USER = null;
  window.location.href = "/index.html";
}

/**
 * Isi navbar sesuai status login.
 * Elemen yang dipakai: #navUsername, #navAuth (tombol login/logout), #navRole (link admin/kurir).
 */
function renderNav() {
  const nameEl = document.getElementById("navUsername");
  const authEl = document.getElementById("navAuth");
  const roleEl = document.getElementById("navRole");

  if (nameEl) nameEl.textContent = CURRENT_USER ? CURRENT_USER.name : "";
  if (authEl) {
    authEl.innerHTML = CURRENT_USER
      ? `<button class="nav-btn" onclick="logout()">Logout</button>`
      : `<a class="nav-btn" href="/login/login.html">Login</a>`;
  }
  if (roleEl) {
    if (CURRENT_USER && CURRENT_USER.role === "admin") {
      roleEl.innerHTML = `<a href="/admin/admin.html">${ico("settings")} Admin Panel</a>`;
    } else if (CURRENT_USER && CURRENT_USER.role === "courier") {
      roleEl.innerHTML = `<a href="/kurir/kurir.html">${ico("truck")} Panel Pengantar</a>`;
    } else {
      roleEl.innerHTML = "";
    }
  }
  updateCartCount();
}

/** Inisialisasi bersama: cek login lalu jalankan callback. */
async function initPage() {
  await loadMe();
  renderNav();
  document.dispatchEvent(new CustomEvent("user-ready", { detail: CURRENT_USER }));
}

/** Lempar ke halaman login kalau belum masuk. */
function requireLogin() {
  if (!CURRENT_USER) {
    const back = encodeURIComponent(location.pathname + location.search);
    location.href = "/login/login.html?next=" + back;
    return false;
  }
  return true;
}
