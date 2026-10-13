/**
 * Autentikasi: hash password (scrypt bawaan Node) + session token lewat cookie.
 * Tidak pakai library eksternal supaya gampang dirawat.
 *
 * Catatan: semua fungsi yang menyentuh database bersifat ASYNC - pakai await.
 */
const crypto = require("node:crypto");
const { db } = require("./db");

const SESSION_DAYS = 7;

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
  if (process.env.COOKIE_SECURE === "1") parts.push("Secure");
  res.append("Set-Cookie", parts.join("; "));
}

// ---------- Sesi ----------
async function createSession(userId) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString().replace("T", " ").slice(0, 19);
  await db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(token, userId, expires);
  return token;
}

async function destroySession(token) {
  if (token) await db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
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
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at.replace(" ", "T")) < new Date()) {
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

module.exports = {
  hashPassword,
  verifyPassword,
  parseCookies,
  setCookie,
  createSession,
  destroySession,
  getUserFromRequest,
  requireAuth,
  requireRole,
};
