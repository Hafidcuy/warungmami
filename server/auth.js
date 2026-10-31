/**
 * Autentikasi: hash password (scrypt bawaan Node) + session token lewat cookie.
 * Tidak pakai library eksternal supaya gampang dirawat.
 *
 * Catatan: semua fungsi yang menyentuh database bersifat ASYNC - pakai await.
 */
const crypto = require("node:crypto");
const { db } = require("./db");

const SESSION_DAYS = 7;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 72;

/** Validasi password baru. Mengembalikan pesan error, atau null bila oke. */
function passwordError(password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return `Password minimal ${MIN_PASSWORD_LENGTH} karakter`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password maksimal ${MAX_PASSWORD_LENGTH} karakter`;
  }
  return null;
}

/**
 * Token sesi yang disimpan di database adalah HASH (SHA-256) dari token asli.
 * Token asli hanya ada di cookie browser. Kalau database bocor, isinya tidak
 * bisa dipakai langsung untuk membajak sesi orang lain.
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

// ---------- Password ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

function verifyPassword(password, stored) {
  const [salt, key] = String(stored).split(":");
  if (!salt || !key) return false;
  const test = crypto.scryptSync(password, salt, 64).toString("hex");
  const a = Buffer.from(key, "hex");
  const b = Buffer.from(test, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// ---------- Cookie ----------
function parseCookies(req) {
  const header = req.headers.cookie || "";
  const out = {};
  header.split(";").forEach((pair) => {
    const idx = pair.indexOf("=");
    if (idx > -1) out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function setCookie(res, name, value, maxAgeMs) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (maxAgeMs) parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  // Secure (hanya lewat HTTPS) otomatis aktif di produksi / Vercel,
  // kecuali admin server menonaktifkannya secara eksplisit (COOKIE_SECURE=0,
  // mis. untuk pengujian HTTP lokal di jaringan sendiri).
  const secure =
    process.env.COOKIE_SECURE === "1" ||
    (process.env.COOKIE_SECURE !== "0" &&
      (process.env.NODE_ENV === "production" || !!process.env.VERCEL));
  if (secure) parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

// ---------- Sesi ----------
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString().replace("T", " ").slice(0, 19);
  await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(hashToken(token), userId, expires);
  return token;
}

async function destroySession(token) {
  if (token) await db.prepare("DELETE FROM sessions WHERE token = ?").run(hashToken(token));
}

/** Hapus semua sesi user KECUALI sesi saat ini (dipakai setelah ganti password). */
async function destroyOtherSessions(userId, currentToken) {
  if (currentToken) {
    await db
      .prepare("DELETE FROM sessions WHERE user_id = ? AND token != ?")
      .run(userId, hashToken(currentToken));
  } else {
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
}

async function getUserFromRequest(req) {
  const token = parseCookies(req).session;
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.address, u.avatar_url, u.is_ready, u.role,
              u.area_id, s.expires_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        WHERE s.token = ?`
    )
    .get(hashToken(token));
  if (!row) return null;
  // expires_at disimpan sebagai teks UTC (dari toISOString) — parse sebagai UTC.
  if (new Date(row.expires_at.replace(" ", "T") + "Z") < new Date()) {
    await destroySession(token);
    return null;
  }
  delete row.expires_at;
  return row;
}

/** Middleware: wajib login. */
async function requireAuth(req, res, next) {
  const user = await getUserFromRequest(req);
  if (!user) return res.status(401).json({ error: "Silakan login terlebih dahulu" });
  req.user = user;
  next();
}

/** Middleware: wajib login DAN peran cocok dengan salah satu dari `roles`. */
function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const user = await getUserFromRequest(req);
      if (!user) return res.status(401).json({ error: "Silakan login terlebih dahulu" });
      if (!roles.includes(user.role)) {
        return res.status(403).json({ error: "Anda tidak punya akses ke halaman ini" });
      }
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Hash dummy untuk menyamakan waktu respons login saat email tidak terdaftar,
// supaya penyerang tidak bisa menebak email mana yang terdaftar dari timing.
let dummyHash = null;
function verifyDummy(password) {
  if (!dummyHash) dummyHash = hashPassword(crypto.randomBytes(16).toString("hex"));
  verifyPassword(String(password || ""), dummyHash);
  return false;
}

module.exports = {
  hashPassword,
  verifyPassword,
  verifyDummy,
  passwordError,
  MIN_PASSWORD_LENGTH,
  hashToken,
  parseCookies,
  setCookie,
  createSession,
  destroySession,
  destroyOtherSessions,
  getUserFromRequest,
  requireAuth,
  requireRole,
};
