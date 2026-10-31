/**
 * Reset database ke data contoh (seed).
 *
 * Jalankan dari folder proyek:   npm run seed
 *
 * Yang dilakukan:
 *   1. Menghapus SEMUA data transaksional: pesanan, item pesanan, pesan chat,
 *      sesi login, produk, voucher, wilayah, dan semua akun.
 *   2. Menjalankan seeder lagi: 1 akun admin + 13 produk + 2 voucher +
 *      2 wilayah ongkir + 4 kategori. (TIDAK ada akun demo pelanggan/kurir.)
 *
 * Bekerja di SQLite maupun PostgreSQL (otomatis mengikuti env DATABASE_URL).
 *
 * PENGAMAN: di produksi (NODE_ENV=production) perintah ini MENOLAK jalan
 * kecuali FORCE_SEED=1 — supaya tidak ada yang menghapus data asli toko
 * secara tidak sengaja.
 */
const { db, initSchema, seed } = require("./db");

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.FORCE_SEED !== "1") {
    console.error("[seed] DITOLAK: NODE_ENV=production. Reset akan MENGHAPUS SEMUA data toko.");
    console.error("[seed] Bila memang sengaja, jalankan: FORCE_SEED=1 npm run seed");
    process.exit(1);
  }
  console.log(`[seed] Mereset database (${db.backendName}) ke data contoh ...`);

  // Skema dulu (idempoten), supaya aman kalau database baru kosong.
  await initSchema();

  // Hapus semua isi tabel. Urutan penting: anak dulu, lalu induk.
  await db.exec("DELETE FROM order_items");
  await db.exec("DELETE FROM order_messages");
  await db.exec("DELETE FROM orders");
  await db.exec("DELETE FROM sessions");
  await db.exec("DELETE FROM vouchers");
  await db.exec("DELETE FROM areas");
  await db.exec("DELETE FROM kategori");
  await db.exec("DELETE FROM products");
  await db.exec("DELETE FROM users");

  // Isi ulang data dasar (admin + produk + voucher + wilayah + kategori).
  await seed();

  const n = async (t) => (await db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get()).n;
  console.log(
    `[seed] Selesai: ${await n("users")} akun, ${await n("products")} produk, ` +
      `${await n("vouchers")} voucher, ${await n("areas")} wilayah, ${await n("kategori")} kategori.`
  );
  console.log("[seed] Semua sesi login ikut terhapus — silakan login ulang.");
  console.log("[seed] Login admin: lihat baris [seed] akun admin di atas (password dari env ADMIN_PASSWORD / acak / dev).");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] Gagal:", err);
  process.exit(1);
});
