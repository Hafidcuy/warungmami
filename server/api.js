/**
 * Semua endpoint REST untuk Warung Mami.
 * Dipakai oleh: halaman toko, keranjang, login, admin panel, panel pengantar.
 */
const express = require("express");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { db, ONGKIR, ONGKIR_GRATIS_MIN, getArea, getDefaultArea, hitungOngkirArea, localNow, localToday } = require("./db");
const {
  hashPassword,
  verifyPassword,
  setCookie,
  createSession,
  destroySession,
  parseCookies,
  requireAuth,
  requireRole,
} = require("./auth");

const router = express.Router();

const STATUS_LABEL = {
  pending: "Menunggu Konfirmasi",
  accepted: "Diproses",
  siap: "Siap Diambil",
  sending: "Sedang Diantar",
  delivered: "Selesai",
  cancelled: "Dibatalkan",
};

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, phone: u.phone, address: u.address || "", avatar_url: u.avatar_url || "", is_ready: !!u.is_ready, role: u.role, area_id: u.area_id || null };
}

// ============================================================
// 1b. FOTO PROFIL (upload file, bukan link)
// ============================================================
const AVATAR_DIR = path.join(__dirname, "..", "uploads", "avatars");
try {
  fs.mkdirSync(AVATAR_DIR, { recursive: true });
} catch (err) {
  console.error("Gagal membuat folder uploads/avatars:", err.message);
}

/** Kenali tipe file dari isi byte-nya (magic number), bukan dari nama file. */
function sniffImage(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

/** Hapus file avatar lama milik user ini (hanya yang ada di uploads/avatars/u<id>-...). */
function removeOwnAvatarFile(currentUrl, userId) {
  if (!currentUrl) return;
  if (!String(currentUrl).startsWith("/uploads/avatars/")) return; // URL eksternal: biarkan
  const base = path.basename(String(currentUrl).split("?")[0]);
  if (!/^u\d+-\d+\.[a-z0-9]+$/i.test(base)) return;
  if (!base.startsWith(`u${userId}-`)) return; // bukan milik user ini
  try {
    fs.unlinkSync(path.join(AVATAR_DIR, base));
  } catch (err) {
    if (err.code !== "ENOENT") console.error("Gagal menghapus avatar lama:", err.message);
  }
}

// ============================================================
// 1. AUTENTIKASI
// ============================================================
router.post("/register", async (req, res) => {
  const { name, email, phone = "", password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Nama, email, dan password wajib diisi" });
  if (String(password).length < 6) return res.status(400).json({ error: "Password minimal 6 karakter" });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: "Format email tidak valid" });

  const exists = await db.prepare("SELECT id FROM users WHERE email = ?").get(String(email).toLowerCase());
  if (exists) return res.status(409).json({ error: "Email sudah terdaftar" });

  const created = await db
    .prepare("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'customer') RETURNING id")
    .get(name.trim(), String(email).toLowerCase(), phone, hashPassword(password));

  const token = await createSession(created.id);
  setCookie(res, "session", token, 7 * 86400000);
  res.status(201).json({ user: { id: created.id, name: name.trim(), email: String(email).toLowerCase(), phone, role: "customer" } });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email dan password wajib diisi" });

  const user = await db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({ error: "Email atau password salah" });
  }

  const token = await createSession(user.id);
  setCookie(res, "session", token, 7 * 86400000);
  res.json({ user: publicUser(user) });
});

router.post("/logout", async (req, res) => {
  await destroySession(parseCookies(req).session);
  setCookie(res, "session", "", 0);
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  const { getUserFromRequest } = require("./auth");
  const user = await getUserFromRequest(req);
  res.json({ user }); // null kalau belum login (bukan error)
});

/**
 * Ubah profil sendiri (nama & nomor HP). Hanya field yang dikirim yang diubah.
 */
router.patch("/me", requireAuth, async (req, res) => {
  const user = req.user;
  const { name, phone, address, avatar_url, is_ready, area_id } = req.body || {};

  if (name !== undefined) {
    const cleanName = String(name).trim();
    if (cleanName.length < 2) return res.status(400).json({ error: "Nama minimal 2 karakter" });
    if (cleanName.length > 80) return res.status(400).json({ error: "Nama terlalu panjang" });
    await db.prepare("UPDATE users SET name = ? WHERE id = ?").run(cleanName, user.id);
  }

  if (phone !== undefined) {
    const cleanPhone = String(phone).trim();
    if (cleanPhone && !/^[0-9+\-\s()]{6,20}$/.test(cleanPhone)) {
      return res.status(400).json({ error: "Nomor HP tidak valid" });
    }
    await db.prepare("UPDATE users SET phone = ? WHERE id = ?").run(cleanPhone, user.id);
  }

  if (address !== undefined) {
    const cleanAddress = String(address).trim();
    await db.prepare("UPDATE users SET address = ? WHERE id = ?").run(cleanAddress, user.id);
  }

  // Wilayah ongkir pilihan pelanggan (null = bersihkan pilihan)
  if (area_id !== undefined) {
    if (area_id === null || area_id === "") {
      await db.prepare("UPDATE users SET area_id = NULL WHERE id = ?").run(user.id);
    } else {
      const area = await getArea(area_id);
      if (!area || !area.aktif) return res.status(400).json({ error: "Wilayah pengantaran tidak valid" });
      await db.prepare("UPDATE users SET area_id = ? WHERE id = ?").run(area.id, user.id);
    }
  }

  if (avatar_url !== undefined) {
    const cleanAvatar = String(avatar_url).trim();
    // Izinkan: kosong (hapus), URL http(s) lama, atau path upload lokal kita sendiri
    const ok = cleanAvatar === "" || /^https?:\/\/.+/i.test(cleanAvatar) || /^\/uploads\/avatars\/[\w.-]+$/.test(cleanAvatar);
    if (!ok) {
      return res.status(400).json({ error: "URL foto tidak valid" });
    }
    if (cleanAvatar !== (user.avatar_url || "")) removeOwnAvatarFile(user.avatar_url, user.id);
    await db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(cleanAvatar, user.id);
  }

  if (is_ready !== undefined) {
    await db.prepare("UPDATE users SET is_ready = ? WHERE id = ?").run(is_ready ? 1 : 0, user.id);
  }

  const updated = await db.prepare("SELECT * FROM users WHERE id = ?").get(user.id);
  res.json({ user: publicUser(updated) });
});

/**
 * Unggah foto profil. Body = file gambar mentah (jpeg/png/webp, maks 3 MB).
 * Nama file dibuat di server (u<userId>-<timestamp>.<ext>) agar tidak bisa menimpa file orang lain.
 */
router.post(
  "/me/avatar",
  requireAuth,
  express.raw({
    // Terima semua tipe media non-JSON; isi byte-nya tetap diperiksa sendiri di bawah.
    type: (req) => !/^application\/json\b/i.test(req.headers["content-type"] || ""),
    limit: "3mb",
  }),
  async (req, res) => {
    const userId = req.user.id;
    const buf = Buffer.isBuffer(req.body) ? req.body : null;
    if (!buf || buf.length === 0) {
      return res.status(400).json({ error: "Pilih file foto dulu (JPG, PNG, atau WebP)" });
    }
    const ext = sniffImage(buf);
    if (!ext) {
      return res.status(400).json({ error: "Format file harus JPG, PNG, atau WebP" });
    }

    const filename = `u${userId}-${Date.now()}.${ext}`;
    let url = `/uploads/avatars/${filename}`;
    let onDisk = false;
    try {
      fs.writeFileSync(path.join(AVATAR_DIR, filename), buf);
      onDisk = true;
    } catch (err) {
      // Filesystem read-only (mis. fungsi serverless Vercel): simpan foto
      // sebagai data URI langsung di database supaya fitur tetap jalan.
      const mime = ext === "jpg" ? "image/jpeg" : ext === "png" ? "image/png" : "image/webp";
      url = `data:${mime};base64,${buf.toString("base64")}`;
      console.warn("Folder uploads tidak bisa ditulis, avatar disimpan sebagai data URI:", err.message);
    }

    const old = await db.prepare("SELECT avatar_url FROM users WHERE id = ?").get(userId);
    try {
      await db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(url, userId);
    } catch (err) {
      console.error("Gagal update avatar_url:", err.message);
      if (onDisk) { try { fs.unlinkSync(path.join(AVATAR_DIR, filename)); } catch (_) {} }
      return res.status(500).json({ error: "Gagal menyimpan foto profil" });
    }
    removeOwnAvatarFile(old && old.avatar_url, userId);

    const updated = await db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
    res.json({ user: publicUser(updated) });
  }
);

/** Hapus foto profil (kembali ke ikon default). */
router.delete("/me/avatar", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const old = await db.prepare("SELECT avatar_url FROM users WHERE id = ?").get(userId);
  removeOwnAvatarFile(old && old.avatar_url, userId);
  await db.prepare("UPDATE users SET avatar_url = '' WHERE id = ?").run(userId);
  const updated = await db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
  res.json({ user: publicUser(updated) });
});

// ============================================================
// 2. PRODUK (publik)
// ============================================================
router.get("/products", async (req, res) => {
  const { q } = req.query;
  const rows = await db
    .prepare(
      `SELECT p.*, k.warna AS category_color, k.nama AS category_label
         FROM products p
         LEFT JOIN kategori k ON k.slug = p.category
        ORDER BY p.category, p.id`
    )
    .all();
  let products = rows.map((p) => ({ ...p, available: !!p.available }));
  // Pencarian server-side: cocokkan nama / deskripsi / kategori
  if (q && String(q).trim()) {
    const term = String(q).trim().toLowerCase();
    products = products.filter(
      (p) =>
        String(p.name).toLowerCase().includes(term) ||
        String(p.deskripsi || "").toLowerCase().includes(term) ||
        String(p.category).toLowerCase().includes(term)
    );
  }
  res.json({ products });
});

/** Daftar kategori + warnanya (untuk chip & kartu produk di toko). */
router.get("/categories", async (req, res) => {
  const rows = await db.prepare("SELECT slug, nama, warna FROM kategori ORDER BY nama").all();
  res.json({ categories: rows });
});

/** Daftar wilayah ongkir aktif (dipilih pelanggan di keranjang & profil). */
router.get("/areas", async (req, res) => {
  const areas = await db
    .prepare("SELECT id, nama, ongkir, gratis_min FROM areas WHERE aktif = 1 ORDER BY urutan, id")
    .all();
  res.json({ areas });
});

// ============================================================
// 3. PESANAN (pembeli)
// ============================================================
const ORDER_ITEM_STATUS = new Set(["pending", "accepted", "siap", "sending", "delivered", "cancelled"]);

async function getOrderDetail(orderId) {
  const order = await db
    .prepare(
      `SELECT o.*, c.name AS courier_name, c.phone AS courier_phone
         FROM orders o
         LEFT JOIN users c ON c.id = o.courier_id
        WHERE o.id = ?`
    )
    .get(orderId);
  if (!order) return null;
  order.items = await db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(orderId);
  const cnt = await db.prepare("SELECT COUNT(*) AS n FROM order_messages WHERE order_id = ?").get(orderId);
  order.msg_count = cnt.n;
  order.status_label = STATUS_LABEL[order.status] || order.status;
  // Pembeli boleh membatalkan selama pesanan masih menunggu konfirmasi
  order.boleh_dibatalkan = order.status === "pending";
  return order;
}

router.post("/orders", requireAuth, async (req, res) => {
  const { items, customer_name, phone, address, note = "" } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Keranjang kosong" });
  }
  if (!customer_name || !phone || !address) {
    return res.status(400).json({ error: "Nama, nomor HP, dan alamat pengantaran wajib diisi" });
  }

  // Harga SELALU diambil dari database, jangan percaya dari browser
  const getProduct = await db.prepare("SELECT * FROM products WHERE id = ? AND available = 1");
  const lines = [];
  for (const it of items) {
    const qty = Math.max(1, Math.min(99, parseInt(it.qty, 10) || 0));
    const product = await getProduct.get(parseInt(it.product_id, 10));
    if (!product) return res.status(400).json({ error: "Ada produk yang sudah tidak tersedia" });
    // Jangan biarkan melebihi stok yang tersedia
    if (typeof product.stok === "number" && product.stok < qty) {
      return res.status(400).json({
        error: `Stok ${product.name} tinggal ${product.stok} (permintaan ${qty})`,
      });
    }
    lines.push({ product, qty });
  }

  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);

  // Voucher: kode yang dikirim browser diverifikasi ulang di server supaya
  // tidak bisa "diam-diam" mendapat diskon tanpa syarat / tanpa validasi.
  let discountAmount = 0;
  let appliedVoucher = "";
  const { voucher_code } = req.body || {};
  if (voucher_code && String(voucher_code).trim()) {
    const cleanCode = String(voucher_code).trim().toUpperCase();
    const v = await db.prepare("SELECT * FROM vouchers WHERE code = ? AND active = 1").get(cleanCode);
    if (!v) {
      return res.status(400).json({ error: `Voucher ${cleanCode} tidak valid atau sudah nonaktif` });
    }
    if (subtotal < v.min_purchase) {
      return res.status(400).json({
        error: `Voucher ${cleanCode} minimal pembelian ${rupiah(v.min_purchase)}`,
      });
    }
    discountAmount = v.is_percent
      ? Math.round((subtotal * v.discount) / 100)
      : Math.min(subtotal, v.discount);
    appliedVoucher = v.code;
  }

  // Wilayah ongkir: pilihan saat checkout > simpanan profil > wilayah bawaan.
  // Hanya wilayah aktif yang diterima (dicek ulang di server, tidak percaya browser).
  const { area_id } = req.body || {};
  let area = null;
  if (area_id !== undefined && area_id !== null && area_id !== "") {
    area = await getArea(area_id);
    if (!area || !area.aktif) {
      return res.status(400).json({ error: "Wilayah pengantaran tidak valid" });
    }
  } else {
    area = (await getArea(req.user.area_id)) || (await getDefaultArea());
  }

  // Biaya antar mengikuti wilayah yang dipilih
  const afterDiscount = Math.max(0, subtotal - discountAmount);
  const deliveryFee = hitungOngkirArea(area, afterDiscount);
  const total = afterDiscount + deliveryFee;
  const code = "WM-" + crypto.randomBytes(3).toString("hex").toUpperCase();

  try {
    const orderId = await db.tx(async (t) => {
      const created = await t
        .prepare(
          `INSERT INTO orders (code, user_id, customer_name, phone, address, note, subtotal, discount, voucher_code, delivery_fee, total, status, area_id, area_nama)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?) RETURNING id`
        )
        .get(code, req.user.id, customer_name.trim(), phone.trim(), address.trim(), note.trim(), subtotal, discountAmount, appliedVoucher, deliveryFee, total, area ? area.id : null, area ? area.nama : "");

      const insItem = await t.prepare(
        "INSERT INTO order_items (order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?)"
      );
      const decStok = await t.prepare("UPDATE products SET stok = stok - ? WHERE id = ?");
      for (const l of lines) {
        await insItem.run(created.id, l.product.id, l.product.name, l.product.price, l.qty);
        await decStok.run(l.qty, l.product.id); // kurangi stok saat pesanan dibuat
      }
      return created.id;
    });

    res.status(201).json({ order: await getOrderDetail(orderId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan pesanan" });
  }
});

router.get("/orders/mine", requireAuth, async (req, res) => {
  const rows = await db
    .prepare("SELECT id FROM orders WHERE user_id = ? ORDER BY id DESC")
    .all(req.user.id);
  res.json({ orders: await Promise.all(rows.map((r) => getOrderDetail(r.id))) });
});

/** Detail satu pesanan (pemilik, admin, atau kurir yang ditunjuk). */
router.get("/orders/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = await db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  if (req.user.role === "customer" && order.user_id !== req.user.id) return res.status(403).json({ error: "Ditolak" });
  if (req.user.role === "courier" && order.courier_id !== req.user.id) return res.status(403).json({ error: "Ditolak" });
  res.json({ order: await getOrderDetail(id) });
});

/**
 * Batalkan pesanan oleh pembeli (hanya selagi status 'pending').
 * Stok produk dikembalikan seperti semula.
 */
router.post("/orders/:id/cancel", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = await db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
  if (order.user_id !== req.user.id) return res.status(403).json({ error: "Ditolak" });
  if (order.status !== "pending") {
    return res.status(400).json({ error: "Hanya pesanan 'Menunggu Konfirmasi' yang bisa dibatalkan" });
  }

  const items = await db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(id);
  try {
    await db.tx(async (t) => {
      const addStok = await t.prepare("UPDATE products SET stok = stok + ? WHERE id = ?");
      for (const it of items) if (it.product_id) await addStok.run(it.qty, it.product_id);
      await t.prepare("UPDATE orders SET status='cancelled', updated_at=? WHERE id=?").run(localNow(), id);
    });
    res.json({ order: await getOrderDetail(id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal membatalkan pesanan" });
  }
});

// ============================================================
// VOUCHER / KUPON DISKON
// ============================================================
router.get("/vouchers/active", async (req, res) => {
  const rows = await db.prepare("SELECT code, discount, is_percent, min_purchase, deskripsi FROM vouchers WHERE active = 1 ORDER BY id DESC").all();
  res.json({ vouchers: rows });
});

router.post("/vouchers/check", async (req, res) => {
  const { code, subtotal } = req.body || {};
  if (!code) return res.status(400).json({ error: "Kode voucher wajib diisi" });

  const v = await db.prepare("SELECT * FROM vouchers WHERE code = ? AND active = 1").get(String(code).trim().toUpperCase());
  if (!v) return res.status(404).json({ error: "Kode voucher tidak valid atau sudah kadaluarsa" });

  const sub = parseInt(subtotal, 10) || 0;
  if (sub < v.min_purchase) {
    return res.status(400).json({ 
      error: `Voucher ini hanya berlaku untuk minimal pembelian ${rupiah(v.min_purchase)}` 
    });
  }

  let discountAmount = 0;
  if (v.is_percent) {
    discountAmount = Math.round((sub * v.discount) / 100);
  } else {
    discountAmount = Math.min(sub, v.discount);
  }

  res.json({
    valid: true,
    code: v.code,
    discount: discountAmount,
    deskripsi: v.deskripsi || "",
    message: v.is_percent ? `Diskon ${v.discount}% (${rupiah(discountAmount)})` : `Diskon ${rupiah(v.discount)}`
  });
});

// Helper rupiah untuk API internal
function rupiah(n) {
  return "Rp" + Number(n || 0).toLocaleString("id-ID");
}

// Chat Pesanan (Customer & Courier)
router.get("/orders/:id/messages", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = await db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });

  // Akses: Admin (semua), Pemilik pesanan (customer), atau Kurir yang ditunjuk
  if (req.user.role === "customer" && order.user_id !== req.user.id) return res.status(403).json({ error: "Ditolak" });
  if (req.user.role === "courier" && order.courier_id !== req.user.id) return res.status(403).json({ error: "Ditolak" });

  const messages = await db.prepare(`
    SELECT m.id, m.text, m.created_at, u.name as sender_name, u.role as sender_role, m.sender_id
    FROM order_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.order_id = ? AND m.id > ?
    ORDER BY m.id ASC
  `).all(id, parseInt(req.query.setelah, 10) || 0);

  res.json({ messages });
});

router.post("/orders/:id/messages", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { text } = req.body || {};
  if (!text || !String(text).trim()) return res.status(400).json({ error: "Pesan tidak boleh kosong" });

  const order = await db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });

  if (req.user.role === "customer" && order.user_id !== req.user.id) return res.status(403).json({ error: "Ditolak" });
  if (req.user.role === "courier" && order.courier_id !== req.user.id) return res.status(403).json({ error: "Ditolak" });

  const created = await db.prepare("INSERT INTO order_messages (order_id, sender_id, text) VALUES (?, ?, ?) RETURNING id")
    .get(id, req.user.id, String(text).trim());
    
  const msg = await db.prepare(`
    SELECT m.id, m.text, m.created_at, u.name as sender_name, u.role as sender_role, m.sender_id
    FROM order_messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.id = ?
  `).get(created.id);

  res.status(201).json({ message: msg });
});

// ============================================================
// 4. ADMIN PANEL (pemilik toko)
// ============================================================
router.get("/admin/stats", requireRole("admin"), async (req, res) => {
  const today = localToday();
  const stat = async (sql, ...args) => (await db.prepare(sql).get(...args)).n;

  res.json({
    pending: await stat("SELECT COUNT(*) n FROM orders WHERE status='pending'"),
    active: await stat("SELECT COUNT(*) n FROM orders WHERE status IN ('pending','accepted','siap','sending')"),
    todayOrders: await stat("SELECT COUNT(*) n FROM orders WHERE created_at LIKE ?", today + "%"),
    todayRevenue: (await db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE created_at LIKE ? AND status != 'cancelled'").get(today + "%")).n,
    totalRevenue: (await db.prepare("SELECT COALESCE(SUM(total),0) n FROM orders WHERE status != 'cancelled'").get()).n,
    couriers: await stat("SELECT COUNT(*) n FROM users WHERE role='courier'"),
    products: await stat("SELECT COUNT(*) n FROM products"),
    labels: STATUS_LABEL,
  });
});

router.get("/admin/orders", requireRole("admin"), async (req, res) => {
  const { status } = req.query;
  let rows = status
    ? await db
        .prepare("SELECT o.id FROM orders o WHERE o.status = ? ORDER BY o.id DESC")
        .all(status)
    : await db.prepare("SELECT o.id FROM orders o ORDER BY o.id DESC").all();
  res.json({ orders: await Promise.all(rows.map((r) => getOrderDetail(r.id))) });
});

router.get("/admin/couriers", requireRole("admin"), async (req, res) => {
  const rows = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.is_ready,
              (SELECT COUNT(*) FROM orders o WHERE o.courier_id = u.id AND o.status IN ('accepted','siap','sending')) AS active_deliveries
         FROM users u WHERE u.role = 'courier' ORDER BY u.name`
    )
    .all();
  res.json({ couriers: rows });
});

/**
 * Buat akun pengantar baru dari panel admin.
 * Body: { name, email, phone?, password }
 */
router.post("/admin/couriers", requireRole("admin"), async (req, res) => {
  const { name, email, phone = "", password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Nama, email, dan password wajib diisi" });
  }
  if (String(password).length < 6) {
    return res.status(400).json({ error: "Password minimal 6 karakter" });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: "Format email tidak valid" });
  }

  const exists = await db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
  if (exists) return res.status(409).json({ error: "Email sudah terdaftar" });

  const row = await db
    .prepare("INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, 'courier') RETURNING id")
    .get(String(name).trim(), cleanEmail, String(phone).trim(), hashPassword(String(password)));

  const created = await db.prepare("SELECT * FROM users WHERE id = ?").get(row.id);
  res.status(201).json({ courier: { ...publicUser(created), active_deliveries: 0 } });
});

/**
 * Hapus akun pengantar dari panel admin.
 * Ditolak bila pengantar masih punya tugas aktif atau riwayat pesanan
 * (riwayat pesanan harus tetap menampilkan siapa yang mengantar).
 */
router.delete("/admin/couriers/:id", requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const courier = await db.prepare("SELECT id, name, role FROM users WHERE id = ?").get(id);
  if (!courier) return res.status(404).json({ error: "Pengantar tidak ditemukan" });
  if (courier.role !== "courier") return res.status(400).json({ error: "Hanya akun pengantar yang bisa dihapus" });
  if (id === req.user.id) return res.status(400).json({ error: "Tidak bisa menghapus akun yang sedang login" });

  const stat = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN status IN ('accepted','sending') THEN 1 ELSE 0 END) AS active,
         COUNT(*) AS total
       FROM orders WHERE courier_id = ?`
    )
    .get(id);
  const active = stat.active || 0;
  const total = stat.total || 0;
  if (active > 0) return res.status(409).json({ error: "Pengantar masih mempunyai tugas aktif" });
  if (total > 0) return res.status(409).json({ error: `Pengantar punya riwayat ${total} pesanan, tidak bisa dihapus` });

  await db.prepare("DELETE FROM users WHERE id = ?").run(id); // sesi login ikut terhapus (ON DELETE CASCADE)
  res.json({ ok: true, deleted: { id: courier.id, name: courier.name } });
});

/**
 * Aksi admin terhadap pesanan:
 *   { action: "accept",  courier_id? }  -> terima pesanan (bisa langsung tunjuk pengantar)
 *   { action: "assign",   courier_id }  -> tunjuk/ganti pengantar
 *   { action: "cancel" }                -> batalkan pesanan
 *   { action: "unassign" }              -> lepas pengantar
 */
router.patch("/admin/orders/:id", requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const order = await db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });

  const { action, courier_id } = req.body || {};
  const touch = `UPDATE orders SET updated_at = '${localNow()}'`;

  if (action === "accept") {
    if (order.status !== "pending") return res.status(400).json({ error: "Hanya pesanan 'Menunggu Konfirmasi' yang bisa diterima" });
    if (courier_id) {
      const c = await db.prepare("SELECT id FROM users WHERE id=? AND role='courier'").get(courier_id);
      if (!c) return res.status(400).json({ error: "Pengantar tidak valid" });
      await db.prepare(`${touch}, status='siap', courier_id=? WHERE id=?`).run(courier_id, id);
    } else {
      await db.prepare(`${touch}, status='accepted' WHERE id=?`).run(id);
    }
  } else if (action === "ready") {
    // tandai pesanan sudah siap diambil/diantar (accepted -> siap)
    if (order.status !== "accepted") return res.status(400).json({ error: "Hanya pesanan 'Diproses' yang bisa ditandai siap" });
    await db.prepare(`${touch}, status='siap' WHERE id=?`).run(id);
  } else if (action === "assign") {
    if (!["pending", "accepted", "siap"].includes(order.status)) return res.status(400).json({ error: "Pesanan ini sudah tidak bisa diubah pengantarnya" });
    const c = await db.prepare("SELECT id FROM users WHERE id=? AND role='courier'").get(courier_id);
    if (!c) return res.status(400).json({ error: "Pengantar tidak valid" });
    await db.prepare(`${touch}, status='siap', courier_id=? WHERE id=?`).run(courier_id, id);
  } else if (action === "unassign") {
    await db.prepare(`${touch}, courier_id=NULL, status='accepted' WHERE id=?`).run(id);
  } else if (action === "cancel") {
    if (["delivered", "cancelled"].includes(order.status)) return res.status(400).json({ error: "Pesanan sudah final" });
    // kembalikan stok produk saat dibatalkan
    const items = await db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(id);
    const addStok = await db.prepare("UPDATE products SET stok = stok + ? WHERE id = ?");
    for (const it of items) if (it.product_id) await addStok.run(it.qty, it.product_id);
    await db.prepare(`${touch}, status='cancelled', courier_id=NULL WHERE id=?`).run(id);
  } else if (action === "reopen") {
    // kembalikan pesanan ke antrean konfirmasi
    await db.prepare(`${touch}, status='pending', courier_id=NULL WHERE id=?`).run(id);
  } else {
    return res.status(400).json({ error: "Aksi tidak dikenal" });
  }

  res.json({ order: await getOrderDetail(id) });
});

// ---------- Kelola produk ----------
router.post("/admin/products", requireRole("admin"), async (req, res) => {
  const { name, price, category, image_url = "", deskripsi = "", stok } = req.body || {};
  if (!name || !price || !category) return res.status(400).json({ error: "Nama, harga, kategori wajib diisi" });
  if (!["minuman", "makanan", "snack", "paket"].includes(category)) return res.status(400).json({ error: "Kategori tidak dikenal" });
  const created = await db
    .prepare("INSERT INTO products (name, price, category, image_url, deskripsi, stok) VALUES (?, ?, ?, ?, ?, ?) RETURNING id")
    .get(String(name).trim(), Math.max(0, parseInt(price, 10) || 0), category, image_url, String(deskripsi).trim(), Math.max(0, parseInt(stok, 10) || 20));
  res.status(201).json({ product: await db.prepare("SELECT * FROM products WHERE id=?").get(created.id) });
});

router.patch("/admin/products/:id", requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const p = await db.prepare("SELECT * FROM products WHERE id=?").get(id);
  if (!p) return res.status(404).json({ error: "Produk tidak ditemukan" });

  const { name, price, category, image_url, available, deskripsi, stok } = req.body || {};
  await db.prepare(
    `UPDATE products SET name=?, price=?, category=?, image_url=?, available=?, deskripsi=?, stok=? WHERE id=?`
  ).run(
    name !== undefined ? String(name).trim() : p.name,
    price !== undefined ? Math.max(0, parseInt(price, 10) || 0) : p.price,
    category !== undefined ? category : p.category,
    image_url !== undefined ? image_url : p.image_url,
    available !== undefined ? (available ? 1 : 0) : p.available,
    deskripsi !== undefined ? String(deskripsi).trim() : p.deskripsi,
    stok !== undefined ? Math.max(0, parseInt(stok, 10) || 0) : p.stok,
    id
  );
  res.json({ product: await db.prepare("SELECT * FROM products WHERE id=?").get(id) });
});

router.delete("/admin/products/:id", requireRole("admin"), async (req, res) => {
  const info = await db.prepare("DELETE FROM products WHERE id=?").run(parseInt(req.params.id, 10));
  if (!info.changes) return res.status(404).json({ error: "Produk tidak ditemukan" });
  res.json({ ok: true });
});

// ---------- Kelola Voucher (Admin) ----------
router.get("/admin/vouchers", requireRole("admin"), async (req, res) => {
  const vouchers = await db.prepare("SELECT * FROM vouchers ORDER BY id DESC").all();
  res.json({ vouchers });
});

router.post("/admin/vouchers", requireRole("admin"), async (req, res) => {
  const { code, discount, is_percent = 0, min_purchase = 0, deskripsi = "" } = req.body || {};
  if (!code || !discount) {
    return res.status(400).json({ error: "Kode dan nominal diskon wajib diisi" });
  }

  const cleanCode = String(code).trim().toUpperCase();
  const exists = await db.prepare("SELECT id FROM vouchers WHERE code = ?").get(cleanCode);
  if (exists) {
    return res.status(409).json({ error: "Kode voucher sudah digunakan" });
  }

  const created = await db.prepare(
    "INSERT INTO vouchers (code, discount, is_percent, min_purchase, active, deskripsi) VALUES (?, ?, ?, ?, 1, ?) RETURNING id"
  ).get(cleanCode, Math.max(1, parseInt(discount, 10) || 0), is_percent ? 1 : 0, Math.max(0, parseInt(min_purchase, 10) || 0), String(deskripsi).trim());

  res.status(201).json({ voucher: await db.prepare("SELECT * FROM vouchers WHERE id = ?").get(created.id) });
});

// ============================================================
// 4b. WILAYAH ONGKIR (biaya antar per area/jarak)
// ============================================================
router.get("/admin/areas", requireRole("admin"), async (req, res) => {
  res.json({ areas: await db.prepare("SELECT * FROM areas ORDER BY urutan, id").all() });
});

router.post("/admin/areas", requireRole("admin"), async (req, res) => {
  const { nama, ongkir = 0, gratis_min = null, urutan = 0, aktif = 1 } = req.body || {};
  const cleanNama = String(nama || "").trim();
  if (!cleanNama) return res.status(400).json({ error: "Nama wilayah wajib diisi" });
  if (cleanNama.length > 60) return res.status(400).json({ error: "Nama wilayah maksimal 60 karakter" });

  const exists = await db.prepare("SELECT id FROM areas WHERE nama = ?").get(cleanNama);
  if (exists) return res.status(409).json({ error: "Nama wilayah sudah dipakai" });

  const freeMin = gratis_min === null || gratis_min === "" || gratis_min === undefined
    ? null
    : Math.max(0, parseInt(gratis_min, 10) || 0);

  const created = await db
    .prepare("INSERT INTO areas (nama, ongkir, gratis_min, urutan, aktif) VALUES (?, ?, ?, ?, ?) RETURNING id")
    .get(
      cleanNama,
      Math.max(0, parseInt(ongkir, 10) || 0),
      freeMin,
      parseInt(urutan, 10) || 0,
      aktif ? 1 : 0
    );

  res.status(201).json({ area: await db.prepare("SELECT * FROM areas WHERE id = ?").get(created.id) });
});

router.patch("/admin/areas/:id", requireRole("admin"), async (req, res) => {
  const area = await db.prepare("SELECT * FROM areas WHERE id = ?").get(req.params.id);
  if (!area) return res.status(404).json({ error: "Wilayah tidak ditemukan" });

  const { nama, ongkir, gratis_min, urutan, aktif } = req.body || {};
  const patch = { ...area };

  if (nama !== undefined) {
    const cleanNama = String(nama).trim();
    if (!cleanNama) return res.status(400).json({ error: "Nama wilayah wajib diisi" });
    const dup = await db.prepare("SELECT id FROM areas WHERE nama = ? AND id != ?").get(cleanNama, area.id);
    if (dup) return res.status(409).json({ error: "Nama wilayah sudah dipakai" });
    patch.nama = cleanNama;
  }
  if (ongkir !== undefined) patch.ongkir = Math.max(0, parseInt(ongkir, 10) || 0);
  if (gratis_min !== undefined) {
    patch.gratis_min = gratis_min === null || gratis_min === "" ? null : Math.max(0, parseInt(gratis_min, 10) || 0);
  }
  if (urutan !== undefined) patch.urutan = parseInt(urutan, 10) || 0;
  if (aktif !== undefined) patch.aktif = aktif ? 1 : 0;

  await db.prepare(
    "UPDATE areas SET nama = ?, ongkir = ?, gratis_min = ?, urutan = ?, aktif = ? WHERE id = ?"
  ).run(patch.nama, patch.ongkir, patch.gratis_min, patch.urutan, patch.aktif, area.id);

  res.json({ area: await db.prepare("SELECT * FROM areas WHERE id = ?").get(area.id) });
});

router.delete("/admin/areas/:id", requireRole("admin"), async (req, res) => {
  const area = await db.prepare("SELECT * FROM areas WHERE id = ?").get(req.params.id);
  if (!area) return res.status(404).json({ error: "Wilayah tidak ditemukan" });

  try {
    await db.tx(async (t) => {
      // Pesanan lama tetap menyimpan snapshot nama wilayah (area_nama),
      // jadi area aman dihapus tanpa merusak riwayat.
      await t.prepare("UPDATE orders SET area_id = NULL WHERE area_id = ?").run(area.id);
      await t.prepare("UPDATE users SET area_id = NULL WHERE area_id = ?").run(area.id);
      await t.prepare("DELETE FROM areas WHERE id = ?").run(area.id);
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal menghapus wilayah" });
  }
  res.json({ ok: true });
});

router.patch("/admin/vouchers/:id", requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const current = await db.prepare("SELECT * FROM vouchers WHERE id = ?").get(id);
  if (!current) return res.status(404).json({ error: "Voucher tidak ditemukan" });

  const { active, discount, is_percent, min_purchase, deskripsi } = req.body || {};
  const nextDiscount = discount !== undefined ? Math.max(1, parseInt(discount, 10) || 0) : current.discount;
  const nextPercent = is_percent !== undefined ? (is_percent ? 1 : 0) : current.is_percent;
  const nextMin = min_purchase !== undefined ? Math.max(0, parseInt(min_purchase, 10) || 0) : current.min_purchase;
  const nextActive = active !== undefined ? (active ? 1 : 0) : current.active;
  const nextDesc = deskripsi !== undefined ? String(deskripsi).trim() : current.deskripsi;

  await db.prepare(
    "UPDATE vouchers SET discount = ?, is_percent = ?, min_purchase = ?, active = ?, deskripsi = ? WHERE id = ?"
  ).run(nextDiscount, nextPercent, nextMin, nextActive, nextDesc, id);
  res.json({ voucher: await db.prepare("SELECT * FROM vouchers WHERE id = ?").get(id) });
});

router.delete("/admin/vouchers/:id", requireRole("admin"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  await db.prepare("DELETE FROM vouchers WHERE id = ?").run(id);
  res.json({ ok: true });
});

// ============================================================
// 5. PANEL PENGANTAR (kurir)
// ============================================================
router.get("/courier/orders", requireRole("courier"), async (req, res) => {
  // Tugas saya (assigned) + kolam pesanan siap yang belum diambil siapapun
  const rows = await db
    .prepare(
      `SELECT id FROM orders
        WHERE courier_id = ?
           OR (courier_id IS NULL AND status = 'siap')
        ORDER BY CASE status WHEN 'sending' THEN 0 WHEN 'siap' THEN 1 WHEN 'accepted' THEN 2 ELSE 3 END, id DESC`
    )
    .all(req.user.id);
  res.json({ orders: await Promise.all(rows.map((r) => getOrderDetail(r.id))) });
});

/**
 * Aksi pengantar:
 *   { action: "claim" }     -> ambil pesanan dari kolam (siap + belum ditunjuk -> sending)
 *   { action: "pick" }      -> mulai antar (siap/accepted -> sending)
 *   { action: "delivered" } -> pesanan sampai (sending -> delivered)
 */
router.patch("/courier/orders/:id", requireRole("courier"), async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { action } = req.body || {};
  const touch = `UPDATE orders SET updated_at = '${localNow()}'`;

  // "claim" mengambil dari kolam (belum punya kurir), jadi jangan filter courier_id dulu
  if (action === "claim") {
    const order = await db.prepare("SELECT * FROM orders WHERE id = ?").get(id);
    if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan" });
    if (order.status !== "siap" || order.courier_id) {
      return res.status(400).json({ error: "Pesanan ini sudah diambil atau belum siap" });
    }
    await db.prepare(`${touch}, courier_id=?, status='sending' WHERE id=? AND courier_id IS NULL`).run(req.user.id, id);
    return res.json({ order: await getOrderDetail(id) });
  }

  const order = await db.prepare("SELECT * FROM orders WHERE id = ? AND courier_id = ?").get(id, req.user.id);
  if (!order) return res.status(404).json({ error: "Pesanan tidak ditemukan atau bukan bagian tugas Anda" });

  if (action === "pick") {
    if (!["accepted", "siap"].includes(order.status)) return res.status(400).json({ error: "Pesanan belum siap diantar" });
    await db.prepare(`${touch}, status='sending' WHERE id=?`).run(id);
  } else if (action === "delivered") {
    if (order.status !== "sending") return res.status(400).json({ error: "Pesanan belum dalam perjalanan" });
    await db.prepare(`${touch}, status='delivered' WHERE id=?`).run(id);
  } else {
    return res.status(400).json({ error: "Aksi tidak dikenal" });
  }

  res.json({ order: await getOrderDetail(id) });
});

module.exports = { router, STATUS_LABEL };
