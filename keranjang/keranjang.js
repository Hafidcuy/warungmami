// ===== Keranjang & Checkout Warung Mami =====
// Isi keranjang diambil dari browser (data sementara),
// pesanan disimpan ke DATABASE lewat API saat checkout.

const cartContainer = document.getElementById("cartContainer");
const checkoutSide = document.getElementById("checkoutSide");
const checkoutBtn = document.getElementById("checkoutBtn");
const loginNote = document.getElementById("loginNote");

let formOpen = false;
// ===== Fitur Voucher =====
let APPLIED_VOUCHER = null; // { code, discount, deskripsi }
// ===== Fitur Ongkir per Wilayah =====
let SELECTED_AREA = null;   // { id, nama, ongkir, gratis_min } — null = aturan lama

function getCartSubtotal() {
  return getCart().reduce((s, i) => s + i.price * i.qty, 0);
}

// Biaya antar mengikuti wilayah terpilih (fallback: ONGKIR/ONGKIR_GRATIS_MIN)
function hitungOngkir(subtotal, diskon) {
  return hitungOngkirArea(SELECTED_AREA, subtotal, diskon);
}

// ====== Pilihan wilayah pengantaran ======
function initAreaSelect() {
  const sel = document.getElementById("areaSelect");
  const row = document.getElementById("areaRow");
  const note = document.getElementById("areaNote");
  if (!sel || !row) return;

  if (!AREAS.length) {
    row.style.display = "none"; // server belum punya data wilayah
    SELECTED_AREA = null;
    return;
  }

  sel.innerHTML = AREAS.map((a) =>
    `<option value="${a.id}">${escapeHtml(a.nama)} — ${a.ongkir > 0 ? rupiah(a.ongkir) : "Gratis"}</option>`
  ).join("");

  // Prioritas: pilihan terakhir > simpanan profil > wilayah pertama
  const dariStorage = parseInt(localStorage.getItem(AREA_KEY), 10);
  const dariProfil = CURRENT_USER && CURRENT_USER.area_id ? CURRENT_USER.area_id : null;
  const pilih = getAreaById(dariStorage) ? dariStorage
    : getAreaById(dariProfil) ? dariProfil
    : AREAS[0].id;

  sel.value = String(pilih);
  SELECTED_AREA = getAreaById(+sel.value);
  if (note) note.textContent = deskripsiArea(SELECTED_AREA);

  sel.addEventListener("change", () => {
    SELECTED_AREA = getAreaById(+sel.value);
    simpanAreaDipilih(SELECTED_AREA ? SELECTED_AREA.id : null);
    if (note) note.textContent = deskripsiArea(SELECTED_AREA);
    refreshTotals();
    if (formOpen) {
      const box = document.getElementById("checkoutForm");
      if (box) { box.remove(); renderForm(); } // perbarui baris wilayah di konfirmasi
    }
  });
}

function deskripsiArea(area) {
  if (!area) return "";
  const gratis = area.gratis_min;
  const gratisTxt = gratis === null || gratis === undefined
    ? "tanpa gratis ongkir"
    : `gratis ongkir di atas ${rupiah(gratis)}`;
  return `Ongkir ${area.ongkir > 0 ? rupiah(area.ongkir) : "gratis"} · ${gratisTxt}`;
}

function refreshTotals() {
  const subtotal = getCartSubtotal();
  const diskon = APPLIED_VOUCHER && APPLIED_VOUCHER.discount > 0 ? APPLIED_VOUCHER.discount : 0;
  const ongkir = hitungOngkir(subtotal, diskon);

  document.getElementById("subtotal").textContent = rupiah(subtotal);

  const row = document.getElementById("discountRow");
  if (diskon > 0) {
    row.style.display = "flex";
    document.getElementById("discountVal").textContent = "-" + rupiah(diskon);
  } else {
    row.style.display = "none";
  }

  // Baris biaya antar + keterangan gratis ongkir (ikut wilayah terpilih)
  document.getElementById("ongkirVal").textContent = ongkir === 0 ? "GRATIS" : rupiah(ongkir);
  const note = document.getElementById("ongkirNote");
  const kurang = kurangGratisOngkir(SELECTED_AREA, subtotal, diskon);
  if (ongkir === 0) {
    note.textContent = "(gratis ongkir)";
  } else if (kurang > 0) {
    note.textContent = `(belanja ${rupiah(kurang)} lagi untuk gratis ongkir)`;
  } else {
    note.textContent = "";
  }

  document.getElementById("total").textContent = rupiah(Math.max(0, subtotal - diskon + ongkir));
}

function render() {
  const cart = getCart();
  updateCartCount();

  if (cart.length === 0) {
    cartContainer.innerHTML = `
      <div class="empty-cart">
        <i data-ico="basket"></i>
        Keranjang masih kosong.<br>
        <a href="/index.html" style="color:var(--brand);font-weight:bold;">Yuk belanja dulu ${ico("arrow-right", 15)}</a>
      </div>`;
    document.getElementById("subtotal").textContent = "Rp0";
    document.getElementById("total").textContent = "Rp0";
    checkoutBtn.disabled = true;
    checkoutBtn.style.opacity = ".5";
    return;
  }

  cartContainer.innerHTML = cart
    .map(
      (item) => `
    <div class="cart-item">
      <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.name)}"
           onerror="this.src='https://placehold.co/100x100?text=Img'" />
      <div class="info">
        <h3>${escapeHtml(item.name)}</h3>
        <p class="price">${rupiah(item.price)}</p>
      </div>
      <div class="cart-qty">
        <button data-dec="${item.id}">−</button>
        <span>${item.qty}</span>
        <button data-inc="${item.id}">+</button>
      </div>
      <button class="cart-del" data-del="${item.id}" title="Hapus" aria-label="Hapus ${escapeHtml(item.name)}">
        ${ico("trash", 16)}
      </button>
    </div>`
    )
    .join("");

  refreshTotals();
  if (formOpen) renderForm();
}

// ====== Tombol +/- dan hapus ======
cartContainer.addEventListener("click", (e) => {
  const t = e.target.closest("button");
  if (!t) return;
  const inc = t.dataset.inc, dec = t.dataset.dec, del = t.dataset.del;
  if (inc) {
    const it = getCart().find((i) => i.id === +inc);
    if (it) setCartQty(+inc, it.qty + 1);
  }
  if (dec) {
    const it = getCart().find((i) => i.id === +dec);
    if (it) setCartQty(+dec, it.qty - 1);
  }
  if (del) { removeFromCart(+del); }
  if (inc || dec || del) render();
});

// ====== Form & Konfirmasi pengantaran ======
function renderForm() {
  let box = document.getElementById("checkoutForm");
  if (box) return; // sudah ada

  const user = CURRENT_USER;
  const hasPhone = user && user.phone && user.phone.trim();
  const hasAddress = user && user.address && user.address.trim();
  const isComplete = hasPhone && hasAddress;

  box = document.createElement("div");
  box.className = "checkout-form";
  box.id = "checkoutForm";

  let profileDataHTML = "";
  if (!isComplete) {
    profileDataHTML = `
      <div class="confirm-warn">
        <div>${ico("triangle-alert")} Alamat atau nomor HP belum diatur di profil Anda. Silakan lengkapi profil terlebih dahulu sebelum mengirim pesanan.</div>
        <div><a href="/account/account.html">${ico("user")} Atur Alamat di Profil Saya ${ico("arrow-right", 14)}</a></div>
      </div>`;
  } else {
    profileDataHTML = `
      <div class="confirm-box">
        <div class="confirm-row">
          <span>Nama Penerima</span>
          <b>${escapeHtml(user.name)}</b>
        </div>
        <div class="confirm-row">
          <span>Nomor HP</span>
          <b>${escapeHtml(user.phone)}</b>
        </div>
        <div class="confirm-row" style="flex-direction:column;gap:3px;align-items:flex-start;">
          <span>Alamat Pengantaran</span>
          <b style="text-align:left;">${escapeHtml(user.address)}</b>
        </div>
        <div class="confirm-row">
          <span>Wilayah</span>
          <b>${escapeHtml(SELECTED_AREA ? SELECTED_AREA.nama : "-")}</b>
        </div>
      </div>`;
  }

  box.innerHTML = `
    <h3>${ico("pin")} Konfirmasi Pengantaran</h3>
    ${profileDataHTML}
    <label>Catatan Pesanan (opsional)
      <input type="text" id="ckNote" placeholder="Contoh: es nya sedikit saja, tanpa sambal..." />
    </label>
    <p class="form-error" id="ckError"></p>
    <button class="btn-primary" id="ckSubmit" ${!isComplete ? "disabled style='opacity:.5;cursor:not-allowed;'" : ""}>
      ${ico("check")} Konfirmasi & Kirim Pesanan
    </button>
  `;
  box.style.gridColumn = "1 / -1";
  document.getElementById("mainGrid").appendChild(box);

  if (isComplete) {
    document.getElementById("ckSubmit").addEventListener("click", submitOrder);
  }
}

async function submitOrder() {
  const err = document.getElementById("ckError");
  err.textContent = "";

  const user = CURRENT_USER;
  if (!user || !user.phone || !user.address) {
    err.textContent = "Alamat dan nomor HP harus diisi di profil Anda";
    return;
  }

  const customer_name = user.name;
  const phone = user.phone;
  const address = user.address;
  const note = document.getElementById("ckNote").value.trim();

  const btn = document.getElementById("ckSubmit");
  btn.disabled = true;
  btn.textContent = "Mengirim...";

  try {
    const items = getCart().map((i) => ({ product_id: i.id, qty: i.qty }));
    const payload = { items, customer_name, phone, address, note };
    if (APPLIED_VOUCHER) payload.voucher_code = APPLIED_VOUCHER.code;
    if (SELECTED_AREA) payload.area_id = SELECTED_AREA.id;
    const { order } = await API.post("/orders", payload);
    clearCart();
    APPLIED_VOUCHER = null;
    simpanAreaDipilih(SELECTED_AREA ? SELECTED_AREA.id : null);
    showSuccess(order);
  } catch (e) {
    err.textContent = e.message;
    btn.disabled = false;
    btn.innerHTML = ico("check") + " Konfirmasi & Kirim Pesanan";
  }
}

function showSuccess(order) {
  document.getElementById("mainGrid").style.display = "block";
  document.getElementById("mainGrid").innerHTML = `
    <div id="successBox">
      <i data-ico="check-circle"></i>
      <h2>Pesanan berhasil dikirim!</h2>
      <div class="code">${escapeHtml(order.code)}</div>
      <p>Total belanja <b>${rupiah(order.total)}</b></p>
      <p style="margin-top:6px;">Status saat ini: <b>Menunggu Konfirmasi</b> dari pemilik toko.</p>
      <p style="margin-top:6px;color:#888;font-size:14px;">Pemilik toko akan mengonfirmasi lalu pesanan diantar pengantar kami.</p>
      <a class="btn" href="/account/account.html#riwayat">Lacak Pesanan</a>
      <a class="btn alt" href="/index.html">Belanja Lagi</a>
    </div>`;
}

// ====== Tombol Checkout ======
checkoutBtn.addEventListener("click", async () => {
  if (getCart().length === 0) return;

  // Belum login? arahkan ke halaman login dulu
  if (!CURRENT_USER) {
    const back = encodeURIComponent("/keranjang/keranjang.html");
    location.href = "/login/login.html?next=" + back;
    return;
  }

  formOpen = !formOpen;
  if (formOpen) {
    renderForm();
    checkoutBtn.textContent = "Sembunyikan Form";
    document.getElementById("checkoutForm").scrollIntoView({ behavior: "smooth", block: "nearest" });
  } else {
    document.getElementById("checkoutForm")?.remove();
    checkoutBtn.textContent = "Checkout";
  }
});

// ====== Event Voucher ======
document.getElementById("applyVoucherBtn")?.addEventListener("click", async () => {
  const inp = document.getElementById("voucherCode");
  const msg = document.getElementById("voucherMsg");
  const code = inp.value.trim().toUpperCase();
  if (!code) return;

  const btn = document.getElementById("applyVoucherBtn");
  btn.disabled = true;
  btn.textContent = "Cek...";

  try {
    const res = await API.post("/vouchers/check", { code, subtotal: getCartSubtotal() });
    APPLIED_VOUCHER = { code, discount: res.discount, deskripsi: res.deskripsi || "" };
    msg.style.color = "var(--st-ok)";
    msg.textContent = `Voucher berhasil dipakai! ${res.message}${APPLIED_VOUCHER.deskripsi ? " — " + APPLIED_VOUCHER.deskripsi : ""}`;
    refreshTotals();
  } catch (err) {
    APPLIED_VOUCHER = null;
    msg.style.color = "var(--st-cancelled)";
    msg.textContent = err.message;
    refreshTotals();
  } finally {
    btn.disabled = false;
    btn.textContent = "Gunakan";
  }
});

// ====== Mulai ======
(async () => {
  await loadMe();
  await loadAreas();       // wilayah ongkir dipilih sebelum ringkasan dihitung
  renderNav();
  initAreaSelect();
  render();
  if (CURRENT_USER) {
    loginNote.innerHTML = "";
  } else {
    loginNote.innerHTML = `
      <div class="login-note">
        ${ico("triangle-alert")} Anda belum login. Login dulu untuk mengirim pesanan.<br>
        <a href="/login/login.html?next=${encodeURIComponent("/keranjang/keranjang.html")}">Login sekarang ${ico("arrow-right", 14)}</a>
      </div>`;
  }
})();
