# Warung Mami — Kedai Tera Es

Toko online lengkap dengan **backend asli** (Node.js + Express + SQLite): belanja, checkout,
panel admin untuk pemilik toko, dan panel pengantar untuk kurir.

> Dulu masih statis/hardcoded — sekarang semua data (produk, akun, pesanan) tersimpan di database.

---

## Cara Menjalankan

Prasyarat: **Node.js v22+** (sudah termasuk modul `node:sqlite`, tidak perlu install database apapun).

```bash
npm install      # sekali saja, untuk menginstall Express
npm start        # jalankan server
```

Lalu buka **http://localhost:3000** (jika port itu dipakai, server otomatis pindah ke 3001, 3002, ... — lihat di terminal).

Perintah lain:

```bash
npm run dev      # mode development (auto-reload saat file server berubah)
npm run seed     # reset database ke data contoh (HAPUS semua pesanan & akun yang kamu buat!)
```

Database tersimpan otomatis di `data/warung.db` (file SQLite). Ingin reset total? Hapus file itu lalu jalankan `npm start` lagi.

---

## Akun Demo

| Peran | Email | Password | Halaman |
|---|---|---|---|
| Pemilik toko (admin) | `admin@warungmami.id` | `admin123` | `/admin/admin.html` |
| Pengantar (kurir) | `kurir@warungmami.id` | `kurir123` | `/kurir/kurir.html` |
| Pembeli | `siti@contoh.id` | `siti123` | `/account/account.html` |

Semua akun demo juga muncul otomatis sebagai tombol cepat di halaman login.

---

## Alur Pesanan

```
Pembeli checkout ──► pending (Menunggu)
                        │  admin klik "Terima"
                        ▼
                     accepted (Diproses) ── admin tunjuk pengantar ──┐
                        │                                            │
                        │  kurir klik "Sudah Diambil"                │
                        ▼                                            │
                     sending (Diantar) ◄─────────────────────────────┘
                        │  kurir klik "Selesai Diantar"
                        ▼
                     delivered (Selesai)

Admin juga bisa: cancel (batal) → bisa dibuka lagi (reopen).
```

## Halaman

| Halaman | Fungsi |
|---|---|
| `/index.html` | Etalase produk (ambil dari API), tambah ke keranjang |
| `/keranjang/keranjang.html` | Keranjang + form checkout (alamat, HP, catatan) |
| `/login/login.html` | Login & register |
| `/account/account.html` | Profil + riwayat pesanan + lacak status |
| `/admin/admin.html` | Panel admin: statistik, kelola pesanan, pengantar, produk |
| `/kurir/kurir.html` | Panel pengantar: tugas antar, ambil, selesai |

## Struktur

```
server.js          # entry: serve situs statis + API, auto-skip port terpakai
server/
  db.js            # skema SQLite + seeder (15 produk, 3 akun demo)
  auth.js          # hash password (scrypt) + sesi cookie
  api.js           # semua endpoint REST
js/api.js          # helper frontend: client API, keranjang, render nav
data/warung.db     # database (dibuat otomatis, jangan di-commit)
```

### Catatan penting

- **Keranjang belanja** disimpan di `localStorage` browser (hanya sementara, per-perangkat).
  Semua data penting — produk, akun, **pesanan** — ada di **database SQLite**.
- **Harga selalu dihitung ulang oleh server** dari database saat checkout, jadi harga di
  browser tidak bisa dimanipulasi.
- Password di-hash dengan `scrypt` + salt, sesi memakai token acak di cookie HttpOnly.
- Endpoint publik (baca produk) terbuka; endpoint admin/kurir dicek peran di server.

## Menjalankan lokal

```bash
npm install
npm start          # atau: npm run dev  (auto-reload)
```

Buka `http://localhost:3000`. Database SQLite + data demo dibuat otomatis saat
pertama dijalankan.

| Akun demo | Kata sandi |
|---|---|
| `admin@warungmami.id` | `admin123` |
| `kurir@warungmami.id` | `kurir123` |
| `siti@contoh.id` | `siti123` |

## Deploy

Kebutuhan server:

- **Node.js >= 22.5.0** (pakai modul bawaan `node:sqlite`)
- **Disk yang persisten** — database `data/warung.db` dan foto profil
  `uploads/avatars/` disimpan di filesystem, jadi **tidak cocok** untuk platform
  serverless dengan filesystem read-only (Vercel / Netlify / Cloudflare Pages)
  kecuali migrasi ke PostgreSQL.

### 1. Siapkan repo

```bash
git init
git add .
git commit -m "feat: warung mami"
git remote add origin <url-repo-anda>
git push -u origin main
```

File yang sengaja tidak ikut di-commit: `node_modules/`, `data/*.db`,
`uploads/avatars/*`, `.env` (lihat `.gitignore`).

### 2. Jalankan di VPS (DigitalOcean / Hetzner / Rumahweb, dst.)

```bash
# di server
sudo apt update && sudo apt install -y git
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
git clone <url-repo-anda> warungmami && cd warungmami
npm install --omit=dev
npm start
```

Cek sehat-tidaknya server:

```bash
curl http://localhost:3000/api/health
# {"ok":true,"time":"..."}
```

### 3. Biarkan nyala terus (PM2)

```bash
npm i -g pm2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup        # ikut nyala saat server reboot
```

### 4. Domain + HTTPS

Arahkan record `A` domain ke IP VPS, lalu pasang Nginx + Certbot:

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
  # unggahan foto profil
  client_max_body_size 4m;
}
```

```bash
sudo certbot --nginx -d domainanda.com
```

### Variabel environment

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | `3000` | Jika di-set, server **tidak** pindah port otomatis bila sibuk (exit 1). |
| `HOST` | `0.0.0.0` | Alamat bind. |
| `NODE_ENV` | — | Isi `production` di server. |

Contoh: `PORT=8080 NODE_ENV=production npm start`

### Endpoint pengecekan

- `GET /api/health` → `{ ok: true, time: ... }` (tanpa login)
