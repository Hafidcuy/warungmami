/**
 * Warung Mami - Server utama (Express)
 * Menyajikan website statis (HTML/CSS/JS) + API database.
 *
 * Jalankan:   npm start        (atau npm run dev untuk auto-reload)
 * Buka:       http://localhost:3000
 */
const express = require("express");
const path = require("node:path");
const fs = require("node:fs");
const { initSchema, seed, db } = require("./server/db");
const { router: apiRouter } = require("./server/api");

const app = express();

// ---- Inisialisasi database (sekali per proses, saat modul dimuat) ----
// initSchema + seed kini async (SQLite maupun Postgres), jadi tunggu selesai dulu.
// Dimulai sekarang juga (paralel dengan loading Express) supaya berjalan sama baiknya
// untuk server lokal (npm start) maupun fungsi serverless Vercel (api/index.js).
async function initDb() {
  await initSchema();
  await seed();
  console.log(`[db] Backend database: ${db.backendName}`);
}
const dbReady = initDb();
dbReady.catch((err) => console.error("[db] Gagal inisialisasi database:", err && err.message));

// ---- Body parser ----
app.use(express.json({ limit: "100kb" }));

// ---- Log sederhana ----
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) {
    const start = Date.now();
    res.on("finish", () => {
      console.log(`${req.method} ${req.path} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
  }
  next();
});

// ---- Tunggu database siap sebelum proses request apa pun ----
app.use((req, res, next) => {
  dbReady.then(() => next(), next);
});

// ---- Health check (untuk pengecekan setelah deploy) ----
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ---- API ----
// Express 4 tidak otomatis menangkap Promise rejection dari handler async,
// jadi bungkus setiap handler route agar error masuk ke error handler JSON.
function wrapAsync(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
for (const layer of apiRouter.stack) {
  if (!layer.route) continue;
  for (const stack of layer.route.stack) {
    stack.handle = wrapAsync(stack.handle);
  }
}
app.use("/api", apiRouter);

// ---- Website statis ----
// index.html ada di root, jadi jangan pakai express.static biasa
// supaya path "keranjang/..." di dalam HTML tetap benar.
const STATIC_EXT = /\.(css|js|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|mp3|mp4|pdf)$/i;

/**
 * req.path masih dalam bentuk URL-encoded (mis. "images%20(1).jpeg").
 * res.sendFile() di Express memanggil encodeURI() lagi, lalu send mendecode
 * satu kali - jadinya kode %20 tidak pernah benar-benar dibuka dan file
 * dengan spasi/karakter khusus tidak ketemu. Kita decode sendiri di sini.
 */
function decodePath(p) {
  try {
    return decodeURIComponent(p);
  } catch {
    return p; // URI tidak valid - biarkan apa adanya
  }
}

/** true kalau `file` berada di dalam folder proyek (tidak keluar lewat ".."). */
function insideProject(file) {
  const root = __dirname.endsWith(path.sep) ? __dirname : __dirname + path.sep;
  return file === __dirname || file.startsWith(root);
}

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path.startsWith("/api/")) return next();
  if (STATIC_EXT.test(req.path)) {
    const target = path.join(__dirname, decodePath(req.path));
    if (!insideProject(target)) return next();
    return res.sendFile(target, (err) => (err ? next() : undefined));
  }
  next();
});

// Halaman HTML: cek file -> kalau tidak ada, cek + ".html" -> fallback index
app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path.startsWith("/api/")) return next();

  const decoded = decodePath(req.path);
  const candidates = [
    path.join(__dirname, decoded),
    path.join(__dirname, decoded + ".html"),
  ];
  if (decoded.endsWith("/")) candidates.push(path.join(__dirname, decoded, "index.html"));

  for (const file of candidates) {
    if (insideProject(file) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      return res.sendFile(file);
    }
  }

  const notFound = path.join(__dirname, "404.html");
  if (fs.existsSync(notFound)) return res.status(404).sendFile(notFound);
  res.status(404).type("text").send("404 - Halaman tidak ditemukan");
});

// ---- Error handler ----
app.use((err, req, res, next) => {
  if (!res.headersSent) console.error("[error]", err.type || "", err.message);
  if (res.headersSent) return next(err);

  // Body JSON rusak / kebesaran / tipe media salah -> permintaan salah, bukan kesalahan server
  const status = err.status || err.statusCode;
  if (err.type === "entity.too.large" || status === 413) {
    return res.status(413).json({ error: "Ukuran file/data terlalu besar (maksimal 3 MB)" });
  }
  if (err.type === "entity.unsupported.media-type" || status === 415) {
    return res.status(415).json({ error: "Tipe file tidak didukung (pakai JPG, PNG, atau WebP)" });
  }
  if (status === 400 || err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Format data yang dikirim tidak valid" });
  }

  res.status(500).json({ error: "Terjadi kesalahan di server" });
});

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const EXPLICIT_PORT = !!process.env.PORT;

/**
 * Coba listen di `host:port`.
 * - Port tidak diketahui (dev lokal): kalau sibuk, naikkan sampai 20x.
 * - Port ditentukan lewat env PORT (hosting): kalau sibuk, langsung berhenti —
 *   proxy di depan kita memang mengharapkan port itu.
 */
function start(port, attempt = 0) {
  const server = app.listen(port, HOST, async () => {
    try {
      await dbReady;
    } catch (err) {
      console.error("[db] Gagal inisialisasi database:", err.message);
      process.exit(1);
    }
    console.log("==============================================");
    console.log("  Warung Mami - Kedai Tera Es");
    console.log(`  Berjalan di http://localhost:${port}`);
    console.log(`  Bind    : ${HOST}`);
    console.log(`  Node    : ${process.version}`);
    console.log(`  Database: ${db.backendName === "postgres" ? "PostgreSQL (Neon)" : "SQLite lokal"}`);
    console.log("  Admin   : admin@warungmami.id / admin123");
    console.log("==============================================");
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE" && !EXPLICIT_PORT && attempt < 20) {
      console.log(`Port ${port} sibuk, mencoba port ${port + 1}...`);
      start(port + 1, attempt + 1);
      return;
    }
    console.error("Gagal menjalankan server:", err.code === "EADDRINUSE" ? `port ${port} sudah dipakai` : err.message);
    process.exit(1);
  });
}

// Vercel (serverless): api/index.js me-requires file ini dan hanya memakai `app`
// tanpa listen. Lokal (npm start / node server.js): listen seperti biasa.
module.exports = app;
if (require.main === module) start(PORT);
