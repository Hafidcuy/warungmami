// ===== Panel Pengantar Warung Mami =====
// Pesanan ditugaskan admin, atau diambil sendiri dari kolam pesanan "Siap Diambil".

let TASKS = [];
let POOL = [];      // pesanan siap yang BELUM ditunjuk ke siapa pun (bisa diambil)
let MINE = [];      // pesanan yang sudah ditunjuk ke saya
let MY_ID = null;   // id kurir yang sedang login
let FILTER_STATUS = "";

// Pesanan masuk kolam bila status 'siap' dan belum punya pengantar
const isPoolOrder = (o) => !o.courier_id && o.status === "siap";

async function loadTasks() {
  const box = document.getElementById("taskList");
  try {
    const data = await API.get("/courier/orders");
    TASKS = data.orders || [];
    POOL = TASKS.filter(isPoolOrder);
    MINE = TASKS.filter((o) => !isPoolOrder(o));
    renderStats();
    renderTasks();
  } catch (e) {
    box.innerHTML = `<p class="empty"><i data-ico="triangle-alert" data-size="30"></i><br>Gagal memuat tugas: ${escapeHtml(e.message)}</p>`;
    renderIcons(box);
  }
}

function renderStats() {
  const ready = MINE.filter((o) => ["accepted", "siap"].includes(o.status)).length;
  const sending = MINE.filter((o) => o.status === "sending").length;
  const done = MINE.filter((o) => o.status === "delivered").length;

  // "Siap Diambil" = tugas saya yang menunggu diambil + antrean kolam yang bisa saya ambil
  document.getElementById("stAssigned").textContent = ready + POOL.length;
  document.getElementById("stSending").textContent = sending;
  document.getElementById("stDone").textContent = done;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set("cntAll", TASKS.length);
  set("cntPool", POOL.length);
  set("cntAcc", ready);
  set("cntSend", sending);
  set("cntDone", done);
}

// Render daftar tugas sesuai chip saringan yang aktif
function renderTasks() {
  const box = document.getElementById("taskList");
  let list;
  if (FILTER_STATUS === "pool") list = POOL;
  else if (FILTER_STATUS === "ready") list = MINE.filter((o) => ["accepted", "siap"].includes(o.status));
  else if (FILTER_STATUS) list = MINE.filter((o) => o.status === FILTER_STATUS);
  else list = [...POOL, ...MINE];

  if (!list.length) {
    const msg = FILTER_STATUS === "pool"
      ? `<p class="empty"><i data-ico="basket" data-size="34"></i><br>Antrean kosong.<br>
         <span style="font-size:13px;">Pesanan akan muncul di sini begitu pemilik toko menandai "Siap Diambil".</span></p>`
      : TASKS.length
        ? `<p class="empty"><i data-ico="search" data-size="30"></i><br>Tidak ada tugas dengan status ini.</p>`
        : `<p class="empty"><i data-ico="basket" data-size="34"></i><br>Belum ada tugas untuk Anda.<br>
           <span style="font-size:13px;">Lihat tab <b>Antrean</b> untuk mengambil pesanan siap, atau tunggu pemilik toko menunjuk Anda.</span></p>`;
    box.innerHTML = msg;
    renderIcons(box);
    return;
  }
  box.innerHTML = list.map(taskCardHTML).join("");
  renderIcons(box);
}

function taskCardHTML(o) {
  const items = o.items
    .map((it) => `<div><span>${escapeHtml(it.name)} × ${it.qty}</span><span>${rupiah(it.price * it.qty)}</span></div>`)
    .join("");

  const pool = isPoolOrder(o);
  let actions = "";
  if (pool) {
    actions = `<button class="btn btn-claim" data-action="claim" data-id="${o.id}">${ico("hand", 16)} Ambil Orderan</button>
               <span class="inline-note" style="color:var(--muted);font-size:12.5px;">Belum ada pengantar lain yang mengambil</span>`;
  } else if (o.status === "accepted" || o.status === "siap") {
    actions = `<button class="btn btn-pick" data-action="pick" data-id="${o.id}">${ico("box", 16)} Sudah Diambil</button>`;
  } else if (o.status === "sending") {
    actions = `<button class="btn btn-done" data-action="delivered" data-id="${o.id}">${ico("check-circle", 16)} Selesai Diantar</button>`;
  } else {
    actions = `<span class="done-note">${ico("check-circle", 15)} Pesanan selesai</span>`;
  }

  return `
    <div class="task-card is-${o.status}">
      <div class="task-top">
        <div>
          <div class="task-code">#${escapeHtml(o.code)}</div>
          <div class="task-date">${ico("calendar", 13)} ${formatDate(o.created_at)}</div>
        </div>
        ${badgeHTML(o.status)}
      </div>
      <div class="task-grid">
        <div class="task-items">
          ${items}
          <div class="task-total"><span>Total</span><span>${rupiah(o.total)}</span></div>
          <div class="task-note" style="color:var(--st-sending-fg);">${ico("money", 15)} COD: tagih ${rupiah(o.total)} ke pelanggan</div>
        </div>
        <div class="customer-box">
          <b>${ico("user", 15)} ${escapeHtml(o.customer_name)}</b>
          <span>${ico("phone", 15)} ${escapeHtml(o.phone)}</span>
          <span>${ico("pin", 15)} ${escapeHtml(o.address)}</span>
          ${o.note ? `<span>${ico("note", 15)} <i>${escapeHtml(o.note)}</i></span>` : ""}
          <a class="callbtn" href="tel:${escapeHtml(o.phone)}">${ico("phone", 15)} Telepon Pelanggan</a>
          <button class="callbtn" onclick="openChat(${o.id}, '${escapeHtml(o.code)}')" style="background:#fff;border:1px solid var(--line);cursor:pointer;padding:7px 12px;border-radius:var(--r-sm);color:var(--ink);font-weight:600;">
            ${ico("message-circle", 15)} Chat Pelanggan ${o.msg_count ? `<span style="background:var(--brand);color:#fff;border-radius:9px;padding:0 6px;font-size:11px;">${o.msg_count}</span>` : ""}
          </button>
        </div>
      </div>
      <div class="task-actions">${actions}</div>
    </div>`;
}

// ===== Chat Kurir & Pelanggan =====
let CURRENT_CHAT_ORDER_ID = null;
let chatInterval = null;
let CHAT_CURSOR = 0; // id pesan terakhir yang sudah dirender (polling inkremental)

async function openChat(orderId, code) {
  CURRENT_CHAT_ORDER_ID = orderId;
  CHAT_CURSOR = 0; // mulai dari awal tiap kali chat dibuka
  document.getElementById("chatOrderCode").textContent = `#${code}`;
  document.getElementById("chatModal").classList.remove("hidden");
  await loadChatMessages(true);
  if (chatInterval) clearInterval(chatInterval);
  chatInterval = setInterval(() => loadChatMessages(), 3000);
}

function closeChat() {
  document.getElementById("chatModal").classList.add("hidden");
  CURRENT_CHAT_ORDER_ID = null;
  CHAT_CURSOR = 0;
  if (chatInterval) clearInterval(chatInterval);
}

async function loadChatMessages(reset) {
  if (!CURRENT_CHAT_ORDER_ID) return;
  const box = document.getElementById("chatMessages");
  try {
    const url = reset || !CHAT_CURSOR
      ? `/orders/${CURRENT_CHAT_ORDER_ID}/messages`
      : `/orders/${CURRENT_CHAT_ORDER_ID}/messages?setelah=${CHAT_CURSOR}`;
    const { messages } = await API.get(url);

    if (!messages.length) {
      // Tidak ada pesan baru: biarkan daftar yang sekarang tetap tampil
      if (reset || !box.querySelector("div")) {
        box.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;margin-top:20px;">Belum ada pesan.</div>`;
      }
      return;
    }

    const atBottom = box.scrollHeight - box.clientHeight <= box.scrollTop + 10;
    const wasEmpty = !box.querySelector("[data-msg]");

    // Pesan baru selalu di bawah, jadi cukup tambahkan (append) tanpa render ulang
    const frag = messages.map((m) => {
      const isMe = m.sender_role === "courier";
      return `
        <div data-msg="${m.id}" style="display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};">
          <span style="font-size:11px;color:var(--muted);margin-bottom:2px;padding:0 4px;">${escapeHtml(m.sender_name)}</span>
          <div style="background:${isMe ? 'var(--brand)' : '#fff'};color:${isMe ? '#fff' : 'var(--ink)'};border:1px solid ${isMe ? 'var(--brand)' : 'var(--line)'};padding:8px 12px;border-radius:${isMe ? '12px 12px 0 12px' : '12px 12px 12px 0'};max-width:85%;font-size:13.5px;word-break:break-word;box-shadow:0 1px 2px rgba(0,0,0,.05);">
            ${escapeHtml(m.text)}
          </div>
        </div>
      `;
    }).join("");

    if (wasEmpty || reset) box.innerHTML = frag;
    else box.insertAdjacentHTML("beforeend", frag);

    // Geser ke bawah hanya kalau tadi memang sudah di bawah (atau saat pertama buka)
    if (wasEmpty || reset || atBottom) box.scrollTop = box.scrollHeight;

    // Majukan kursor ke id terakhir
    CHAT_CURSOR = Math.max(...messages.map((m) => m.id), CHAT_CURSOR);
  } catch (e) {
    console.error("Chat error:", e);
  }
}

document.getElementById("chatForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!CURRENT_CHAT_ORDER_ID) return;
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  
  input.disabled = true;
  try {
    await API.post(`/orders/${CURRENT_CHAT_ORDER_ID}/messages`, { text });
    input.value = "";
    await loadChatMessages();
    const box = document.getElementById("chatMessages");
    box.scrollTop = box.scrollHeight;
  } catch (err) {
    alert(err.message);
  } finally {
    input.disabled = false;
    input.focus();
  }
});

// ===== Aksi kurir =====
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  const texts = {
    claim: "Ambil pesanan ini dan mulai antar?",
    pick: "Tandai barang sudah diambil dari warung?",
    delivered: "Konfirmasi pesanan sudah sampai di pelanggan?",
  };
  if (!texts[action] || !confirm(texts[action])) return;

  btn.disabled = true;
  try {
    await API.patch(`/courier/orders/${id}`, { action });
    toast(
      action === "claim" ? "Orderan diambil, selamat jalan!"
      : action === "pick" ? "Pesanan diambil, selamat jalan!"
      : "Pesanan selesai diantar."
    );
    loadTasks();
  } catch (err) {
    toast(err.message, "error");
    btn.disabled = false;
  }
});

// ===== Chip saringan =====
document.getElementById("chips").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-status]");
  if (!btn) return;
  FILTER_STATUS = btn.dataset.status || "";
  document.querySelectorAll("#chips button").forEach((b) => b.classList.toggle("active", b === btn));
  renderTasks();
});

// ===== Muat ulang =====
document.getElementById("refreshBtn").addEventListener("click", () => {
  const btn = document.getElementById("refreshBtn");
  btn.classList.add("spinning");
  loadTasks().finally(() => setTimeout(() => btn.classList.remove("spinning"), 400));
});

// ===== Status Siap / Tidak Siap Mengantar =====
function renderReady(user) {
  const toggle = document.getElementById("readyToggle");
  const label = document.getElementById("readyLabel");
  const banner = document.getElementById("readyBanner");
  const ready = !!(user && user.is_ready !== undefined ? user.is_ready : true);

  toggle.dataset.ready = ready ? "1" : "0";
  label.textContent = ready ? "Siap Mengantar" : "Tidak Siap";
  banner.innerHTML = ready
    ? ""
    : `<div class="off-banner">${ico("pause", 16)} Anda sedang <b>&nbsp;Tidak Siap&nbsp;</b> menerima tugas baru. Nyalakan kembali tombol di atas untuk siap menerima orderan.</div>`;
}

function initReadyToggle(user) {
  if (!user) return;
  const toggle = document.getElementById("readyToggle");
  renderReady(user);

  toggle.addEventListener("click", async () => {
    const next = toggle.dataset.ready !== "1";
    toggle.disabled = true;
    try {
      const { user: updated } = await API.patch("/me", { is_ready: next });
      user = updated;
      renderReady(user);
      toast(next ? "Status: Siap menerima tugas baru" : "Status: Tidak menerima tugas baru");
    } catch (e) {
      toast("Gagal mengubah status: " + e.message, "error");
    } finally {
      toggle.disabled = false;
    }
  });
}

// ===== Mulai =====
(async () => {
  const user = await loadMe();
  if (!user || user.role !== "courier") {
    document.querySelector("main").innerHTML = `
      <div class="empty" style="padding:60px 20px;">
        <div class="lock-icon"><i data-ico="lock"></i></div>
        <h2 style="margin:14px 0 6px;">Halaman khusus pengantar</h2>
        <p>Silakan login dengan akun kurir.</p>
        <p style="margin-top:14px;"><a href="/login/login.html?next=/kurir/kurir.html" style="color:var(--brand-lt);font-weight:bold;">Login Pengantar ${ico("arrow-right", 14)}</a></p>
      </div>`;
    renderIcons(document.querySelector("main"));
    // Kondisi belum login: nama diganti "Tamu" dan tombol Logout disembunyikan
    document.getElementById("kurirName").textContent = user ? user.name : "Tamu";
    if (!user) document.getElementById("logoutBtn").hidden = true;
    return;
  }
  document.getElementById("kurirName").textContent = user.name;
  MY_ID = user.id;

  initReadyToggle(user);
  loadTasks();

  // Auto-refresh tiap 25 detik
  setInterval(() => { if (!document.hidden) loadTasks(); }, 25000);
})();
