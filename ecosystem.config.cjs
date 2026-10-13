/**
 * Konfigurasi PM2 untuk Warung Mami.
 *
 * Pakai:  npm i -g pm2 && pm2 start ecosystem.config.cjs
 * Lalu:   pm2 save && pm2 startup   (supaya ikut nyala saat server reboot)
 */
module.exports = {
  apps: [
    {
      name: "warung-mami",
      script: "server.js",
      instances: 1, // SQLite: cukup 1 proses (jangan cluster mode)
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 20,
      restart_delay: 3000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        HOST: "0.0.0.0",
      },
      // Biarkan PM2 simpan log di folder ini (atau hapus untuk pakai default ~/.pm2/logs)
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
