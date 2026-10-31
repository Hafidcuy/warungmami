/**
 * Rate limiter sederhana (fixed window, in-memory) tanpa dependensi.
 *
 * Dipakai untuk endpoint sensitif: login, register, cek voucher, buat pesanan,
 * dan ganti password — supaya tidak bisa di-brute force / di-spam.
 *
 * Catatan: di deployment serverless (Vercel) memori ini per-instance dan bisa
 * ter-reset kapan saja, jadi ini lapisan pertahanan dasar — bukan satu-satunya.
 * Untuk trafik besar, pasang juga rate limit di reverse proxy / WAF.
 */
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map(); // key -> { count, resetAt }

  // Bersihkan entri kedaluwarsa berkala supaya Map tidak tumbuh terus.
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt <= now) hits.delete(key);
    }
  }, Math.min(windowMs, 60000));
  if (typeof timer.unref === "function") timer.unref();

  return function rateLimit(req, res, next) {
    const key = `${req.method} ${req.baseUrl || ""}${req.path} ${req.ip || req.socket?.remoteAddress || "?"}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > max) {
      const retrySec = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      return res.status(429).json({
        error: message || "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
      });
    }
    next();
  };
}

module.exports = { createRateLimiter };
