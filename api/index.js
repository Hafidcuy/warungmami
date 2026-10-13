/**
 * Entry point serverless Vercel.
 * Hanya me-requires server.js (yang mengekspor `app` tanpa app.listen)
 * lalu mengekspornya sebagai handler — Vercel yang menjalankan HTTP-nya.
 * Routing diatur di vercel.json: /api/* -> file ini, sisanya (HTML/CSS/JS)
 * di-serve langsung oleh CDN statis Vercel.
 */
const app = require("../server.js");

module.exports = app;
