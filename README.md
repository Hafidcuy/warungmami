# Warung Mami — Kedai Tera Es

Toko online lengkap dengan **backend asli** (Node.js + Express): belanja, checkout **COD**,
panel admin untuk pemilik toko, dan panel pengantar untuk kurir.
Semua data (produk, akun, pesanan, stok) tersimpan di database — SQLite untuk lokal/VPS,
atau PostgreSQL (Neon) untuk produksi serverless.

---

## Cara Menjalankan (lokal)

Prasyarat: **Node.js v22.5+** (memakai modul bawaan `node:sqlite`).

```bash
npm install      # sekali saja
npm start        # jalankan server
```

Lalu buka **http://localhost:3000** (bila port sibuk, server otomatis pindah ke 3001, 3002, ...).

Perintah lain:

```bash
npm run dev      # mode development (auto-reload saat file server berubah)
npm test         # uji otomatis ujung-ke-ujung (memakai database sementara)
npm run seed     # reset database ke data contoh (MENGHAPUS semua data! Di produksi butuh FORCE_SEED=1)
```

Database lokal tersimpan otomatis di `data/warung.db` (SQLite).

### Akun admin pertama

Saat database masih kosong, server membuat **satu akun admin**:

| Mode | Email | Password |
|---|---|---|
| Lokal / dev | `admin@warungmami.id` (atau `ADMIN_EMAIL`) | `admin123` — hanya untuk lokal |
| Produksi (`NODE_ENV=production`) | `ADMIN_EMAIL` | isi `ADMIN_PASSWORD` di env; bila kosong, server membuat password **acak** dan mencetaknya **sekali** di log startup |

Di produksi **tidak ada akun demo** pelanggan/kurir dan **tidak ada voucher contoh** yang dibuat otomatis
(kode voucher contoh diketahui publik). Kurir dibuat dari panel admin, pelanggan mendaftar sendiri,
dan voucher dibuat dari panel admin. Setelah login pertama, ganti password lewat **Profil → Ganti Password**.

---

## Alur Pesanan

```
Pembeli checkout (COD) ──► pending (Menunggu)
                        │  admin klik "Terima"
                        ▼
                     accepted (Diproses) ── admin tunjuk pengantar ──┐
                        │                                            │
                        │  kurir klik "Sudah Diambil"                │
                        ▼                                            │
                     sending (Diantar) ◄─────────────────────────────┘
                        │  kurir klik "Selesai Diantar"
                        ▼
                     delivered (Selesai — kurir menagih pembayaran COD)

Admin juga bisa: cancel (stok kembali) → reopen (stok dipotong ulang).
Pembeli bisa membatalkan sendiri selama status masih pending (stok kembali).
```

- **Stok** dikurangi secara atomik saat pesanan dibuat — dua pesanan bersamaan tidak bisa oversell / stok minus.
- **Harga selalu dihitung ulang server** dari database saat checkout.
- **Pendapatan** di panel admin hanya menghitung pesanan `delivered` (uang yang benar-benar masuk).

## Halaman

| Halaman | Fungsi |
|---|---|
| `/index.html` | Etalase produk (dari API), tambah ke keranjang |
| `/keranjang/keranjang.html` | Keranjang + checkout COD (alamat & HP dari profil) |
| `/login/login.html` | Login & register (password minimal 8 karakter) |
| `/account/account.html` | Profil, ganti password, riwayat & lacak pesanan, chat |
| `/admin/admin.html` | Panel admin: statistik, pesanan, kurir, produk, voucher, wilayah ongkir |
| `/kurir/kurir.html` | Panel pengantar: tugas antar, ambil dari kolam, selesai |
| `/perpus/perpus.html` | Perpustakaan bacaan sambil menunggu pesanan |

## Struktur

```
server.js            # entry: header keamanan, file statis (allowlist), API, auto-skip port
api/index.js         # entry serverless Vercel (memakai app yang sama)
server/
  db.js              # skema + migrasi + seed; backend SQLite / Postgres dipilih dari DATABASE_URL
  auth.js            # hash password (scrypt), sesi cookie (token disimpan sebagai hash SHA-256)
  api.js             # semua endpoint REST + validasi input
  rateLimit.js       # rate limiter in-memory untuk login/register/voucher/order/ganti password
js/api.js            # helper frontend: client API, keranjang, render nav
test/smoke.test.js   # uji otomatis (node:test, tanpa dependensi tambahan)
data/warung.db       # database SQLite lokal (dibuat otomatis, jangan di-commit)
```

### Keamanan (ringkas)

- Hanya file di folder publik yang disajikan web — `data/`, `server/`, `.env`, dsb **tidak bisa diunduh**
  (sebelumnya file database sempat bisa diakses lewat URL; sudah ditutup dan diuji otomatis).
- Password di-hash `scrypt` + salt; token sesi disimpan di database sebagai hash, cookie `HttpOnly` +
  `SameSite=Lax` + `Secure` otomatis di produksi; header keamanan (CSP, `nosniff`, anti-clickjacking, HSTS di produksi).
- Rate limit untuk login, register, cek voucher, pembuatan pesanan, dan ganti password.
- Endpoint admin/kurir dicek peran di server; harga, stok, voucher, dan ongkir selalu diverifikasi ulang server.

## Deploy ke Produksi

Ada dua jalur yang didukung. Keduanya butuh langkah **"Go-Live"** ini:

1. Set `NODE_ENV=production`.
2. Set `ADMIN_EMAIL` + `ADMIN_PASSWORD` yang kuat (atau simpan password acak dari log pertama).
3. Login, lalu **nonaktifkan / hapus voucher contoh** bila database lama sudah terlanjur punya
   (`WARUNGMAMI`, `HEMAT2K`) dan ganti password admin bila pernah memakai `admin123`.
4. Uji `GET /api/health` → harus `{ "ok": true, "db": ... }`.

### Jalur A — Vercel + Neon Postgres (serverless)

1. Buat database di [Neon](https://neon.tech), salin connection string-nya.
2. Import repo ini di Vercel, lalu di **Project Settings → Environment Variables** isi:
   `NODE_ENV=production`, `DATABASE_URL=<connection string Neon>`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
3. Deploy. `vercel.json` mengarahkan `/api/*` ke `api/index.js`; halaman statis disajikan CDN.

> ⚠️ Tanpa `DATABASE_URL`, Vercel memakai SQLite in-memory yang **hilang setiap fungsi dimulai ulang** —
> server mencetak peringatan keras di log bila ini terjadi. Foto profil di serverless disimpan sebagai
> data URI di database (filesystem tidak persisten).

### Jalur B — VPS (SQLite persisten + PM2 + Nginx)

Butuh Node.js ≥ 22.5 dan disk persisten (untuk `data/warung.db` dan `uploads/avatars/`).

```bash
git clone <url-repo-anda> warungmami && cd warungmami
cp .env.example .env   # lalu isi NODE_ENV, ADMIN_EMAIL, ADMIN_PASSWORD
npm install --omit=dev
npm start              # cek dulu: curl http://localhost:3000/api/health
```

Biarkan nyala terus dengan PM2 (`TRUST_PROXY=1` bila di balik Nginx):

```bash
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Lalu arahkan domain (record A) ke IP VPS dan pasang Nginx + Certbot seperti contoh berikut:

```nginx
server {
  listen 80;
  server_name domainanda.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  client_max_body_size 4m; # unggahan foto profil
}
```

```bash
sudo certbot --nginx -d domainanda.com
```

### Variabel environment

Lihat [`.env.example`](.env.example) — semua variabel didokumentasikan di sana
(`DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT`, `HOST`, `COOKIE_SECURE`,
`TRUST_PROXY`, `SEED_VOUCHERS`, `FORCE_SEED`).

### Backup

- **SQLite (VPS):** salin berkala file `data/warung.db` (+ folder `uploads/avatars/`).
- **Postgres (Neon):** pakai fitur backup/branch bawaan Neon atau `pg_dump` berkala.
