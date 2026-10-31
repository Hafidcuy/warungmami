/**
 * Smoke test ujung-ke-ujung Warung Mami (node:test, tanpa dependensi).
 *
 * Menjalankan server sungguhan di port acak dengan database SQLite SEMENTARA,
 * lalu menguji alur asli: register → profil → order → stok → admin → kurir →
 * selesai, plus penjaga keamanan penting (file privat tidak boleh terunduh,
 * oversell ditolak, stok kembali saat batal, dsb).
 *
 * Jalankan: npm test
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const PORT = 4200 + Math.floor(Math.random() * 700);
const BASE = `http://127.0.0.1:${PORT}`;
const ADMIN_PASSWORD = "admin-test-123";
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "warungmami-test-"));

let server;
const jars = new Map(); // nama -> cookie string

async function call(jarName, method, url, body) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const cookie = jars.get(jarName);
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(BASE + url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const setCookies = typeof res.headers.getSetCookie === "function" ? res.headers.getSetCookie() : [];
  if (setCookies.length) {
    jars.set(jarName, setCookies.map((c) => c.split(";")[0]).join("; "));
  }
  let data = null;
  const text = await res.text();
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

before(async () => {
  server = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: "127.0.0.1",
      NODE_ENV: "test",
      SQLITE_FILE: path.join(tmpDir, "test.db"),
      ADMIN_PASSWORD,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stderr.on("data", (d) => process.stderr.write(`[server] ${d}`));
  // Tunggu sampai health check lulus (maks 20 detik)
  const deadline = Date.now() + 20000;
  for (;;) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch { /* belum naik */ }
    if (Date.now() > deadline) throw new Error("Server tidak kunjung siap");
    await new Promise((r) => setTimeout(r, 250));
  }
});

after(() => {
  if (server) server.kill("SIGTERM");
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

let products;
let customerOrder;

test("health check lulus dan menyebut backend sqlite", async () => {
  const { status, data } = await call("anon", "GET", "/api/health");
  assert.equal(status, 200);
  assert.equal(data.ok, true);
  assert.equal(data.db, "sqlite");
});

test("file privat TIDAK boleh terunduh (database, kode server, env)", async () => {
  for (const p of ["/data/warung.db", "/server/db.js", "/server.js", "/package.json", "/.env.example", "/.gitignore"]) {
    const res = await fetch(BASE + p);
    assert.equal(res.status, 404, `${p} harus 404, dapat ${res.status}`);
  }
  const home = await fetch(BASE + "/");
  assert.equal(home.status, 200);
  const css = await fetch(BASE + "/css/base.css");
  assert.equal(css.status, 200);
});

test("header keamanan terpasang", async () => {
  const res = await fetch(BASE + "/");
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.ok(res.headers.get("content-security-policy"));
});

test("produk & kategori contoh tersedia", async () => {
  const { data } = await call("anon", "GET", "/api/products");
  products = data.products;
  assert.ok(products.length >= 13, `produk hanya ${products.length}`);
  const { data: cats } = await call("anon", "GET", "/api/categories");
  const slugs = cats.categories.map((c) => c.slug);
  for (const s of ["minuman", "makanan", "snack", "paket"]) assert.ok(slugs.includes(s), `kategori ${s} hilang`);
});

test("register menolak password lemah, menerima yang kuat, menolak duplikat", async () => {
  const weak = await call("c1", "POST", "/api/register", { name: "Siti Aminah", email: "siti@test.id", phone: "081234567890", password: "abc12" });
  assert.equal(weak.status, 400);
  const ok = await call("c1", "POST", "/api/register", { name: "Siti Aminah", email: "siti@test.id", phone: "081234567890", password: "siti-kuat-123" });
  assert.equal(ok.status, 201);
  const dup = await call("c2", "POST", "/api/register", { name: "Siti Lain", email: "siti@test.id", password: "siti-kuat-123" });
  assert.equal(dup.status, 409);
});

test("pelanggan melengkapi profil (HP + alamat) untuk checkout", async () => {
  const { status } = await call("c1", "PATCH", "/api/me", { phone: "081234567890", address: "Jl. Mawar No. 12, RT 01/RW 02, Sidoarjo" });
  assert.equal(status, 200);
});

test("login salah ditolak; endpoint admin tertutup untuk pelanggan", async () => {
  const wrong = await call("x", "POST", "/api/login", { email: "siti@test.id", password: "bukan-password" });
  assert.equal(wrong.status, 401);
  const stats = await call("c1", "GET", "/api/admin/stats");
  assert.equal(stats.status, 403);
});

test("order: baris ganda produk sama yang melebihi stok ditolak & stok utuh", async () => {
  const p = products[0];
  const res = await call("c1", "POST", "/api/orders", {
    items: [
      { product_id: p.id, qty: 15 },
      { product_id: p.id, qty: 15 },
    ],
    customer_name: "Siti Aminah",
    phone: "081234567890",
    address: "Jl. Mawar No. 12, RT 01/RW 02, Sidoarjo",
  });
  assert.equal(res.status, 400);
  const { data } = await call("anon", "GET", "/api/products");
  assert.equal(data.products.find((x) => x.id === p.id).stok, p.stok);
});

test("order valid: stok berkurang, pembayaran tercatat COD", async () => {
  const p = products[0];
  const res = await call("c1", "POST", "/api/orders", {
    items: [{ product_id: p.id, qty: 2 }],
    customer_name: "Siti Aminah",
    phone: "081234567890",
    address: "Jl. Mawar No. 12, RT 01/RW 02, Sidoarjo",
    payment_method: "cod",
  });
  assert.equal(res.status, 201);
  customerOrder = res.data.order;
  assert.equal(customerOrder.payment_method, "cod");
  const { data } = await call("anon", "GET", "/api/products");
  assert.equal(data.products.find((x) => x.id === p.id).stok, p.stok - 2);
});

test("metode pembayaran selain COD ditolak", async () => {
  const p = products[0];
  const res = await call("c1", "POST", "/api/orders", {
    items: [{ product_id: p.id, qty: 1 }],
    customer_name: "Siti Aminah",
    phone: "081234567890",
    address: "Jl. Mawar No. 12, RT 01/RW 02, Sidoarjo",
    payment_method: "qris",
  });
  assert.equal(res.status, 400);
});

test("voucher contoh valid di mode non-produksi", async () => {
  const res = await call("c1", "POST", "/api/vouchers/check", { code: "WARUNGMAMI", subtotal: 10000 });
  assert.equal(res.status, 200);
  assert.equal(res.data.valid, true);
});

test("alur admin → kurir → delivered, dan pendapatan hanya dari delivered", async () => {
  const login = await call("admin", "POST", "/api/login", { email: "admin@warungmami.id", password: ADMIN_PASSWORD });
  assert.equal(login.status, 200);
  assert.equal(login.data.user.role, "admin");

  const courier = await call("admin", "POST", "/api/admin/couriers", {
    name: "Budi Kurir",
    email: "budi@test.id",
    phone: "081298765432",
    password: "budi-kuat-123",
  });
  assert.equal(courier.status, 201);
  const courierId = courier.data.courier.id;

  const accept = await call("admin", "PATCH", `/api/admin/orders/${customerOrder.id}`, { action: "accept", courier_id: courierId });
  assert.equal(accept.status, 200);
  assert.equal(accept.data.order.status, "siap");

  const cLogin = await call("kurir", "POST", "/api/login", { email: "budi@test.id", password: "budi-kuat-123" });
  assert.equal(cLogin.status, 200);

  const pick = await call("kurir", "PATCH", `/api/courier/orders/${customerOrder.id}`, { action: "pick" });
  assert.equal(pick.data.order.status, "sending");
  const done = await call("kurir", "PATCH", `/api/courier/orders/${customerOrder.id}`, { action: "delivered" });
  assert.equal(done.data.order.status, "delivered");

  const stats = await call("admin", "GET", "/api/admin/stats");
  assert.equal(stats.data.totalRevenue, customerOrder.total);

  // Pesanan selesai TIDAK boleh dibuka lagi oleh admin
  const reopen = await call("admin", "PATCH", `/api/admin/orders/${customerOrder.id}`, { action: "reopen" });
  assert.equal(reopen.status, 400);
});

test("batal oleh pelanggan mengembalikan stok", async () => {
  const p = products[1];
  const res = await call("c1", "POST", "/api/orders", {
    items: [{ product_id: p.id, qty: 3 }],
    customer_name: "Siti Aminah",
    phone: "081234567890",
    address: "Jl. Mawar No. 12, RT 01/RW 02, Sidoarjo",
  });
  assert.equal(res.status, 201);
  const cancel = await call("c1", "POST", `/api/orders/${res.data.order.id}/cancel`, {});
  assert.equal(cancel.status, 200);
  assert.equal(cancel.data.order.status, "cancelled");
  const { data } = await call("anon", "GET", "/api/products");
  assert.equal(data.products.find((x) => x.id === p.id).stok, p.stok);
});

test("admin batal → buka lagi: stok dipotong ulang secara konsisten", async () => {
  const p = products[2];
  const res = await call("c1", "POST", "/api/orders", {
    items: [{ product_id: p.id, qty: 4 }],
    customer_name: "Siti Aminah",
    phone: "081234567890",
    address: "Jl. Mawar No. 12, RT 01/RW 02, Sidoarjo",
  });
  assert.equal(res.status, 201);
  const oid = res.data.order.id;
  const stokNow = async () => (await call("anon", "GET", "/api/products")).data.products.find((x) => x.id === p.id).stok;
  assert.equal(await stokNow(), p.stok - 4);
  const cancel = await call("admin", "PATCH", `/api/admin/orders/${oid}`, { action: "cancel" });
  assert.equal(cancel.data.order.status, "cancelled");
  assert.equal(await stokNow(), p.stok);
  const reopen = await call("admin", "PATCH", `/api/admin/orders/${oid}`, { action: "reopen" });
  assert.equal(reopen.data.order.status, "pending");
  assert.equal(await stokNow(), p.stok - 4);
});

test("ganti password: lama salah ditolak, benar diterima, login pakai yang baru", async () => {
  const wrong = await call("c1", "POST", "/api/me/password", { current_password: "salah-total", new_password: "siti-baru-456" });
  assert.equal(wrong.status, 401);
  const ok = await call("c1", "POST", "/api/me/password", { current_password: "siti-kuat-123", new_password: "siti-baru-456" });
  assert.equal(ok.status, 200);
  const oldLogin = await call("y", "POST", "/api/login", { email: "siti@test.id", password: "siti-kuat-123" });
  assert.equal(oldLogin.status, 401);
  const newLogin = await call("y", "POST", "/api/login", { email: "siti@test.id", password: "siti-baru-456" });
  assert.equal(newLogin.status, 200);
});
