// ===== Halaman Akun Warung Mami =====
// Data profil & pesanan diambil dari database lewat API.

document.querySelector(".logout").addEventListener("click", () => {
  if (confirm("Yakin ingin logout?")) logout();
});

const ROLE_META = {
  admin: { label: "Pemilik Toko", icon: "settings" },
  courier: { label: "Pengantar", icon: "truck" },
  customer: { label: "Pembeli", icon: "user" },
};

/**
 * Isi kotak avatar dengan foto profil, atau ikon default kalau belum ada
 * / gagal dimuat. Pakai DOM API (bukan innerHTML + onerror inline) supaya
 * SVG ikon yang kutipannya pakai tanda kutip tidak merusak atribut HTML.
 */
function renderAvatarBox(box, avatarUrl) {
  if (!box) return;

  const showIcon = () => {
    box.replaceChildren();
    box.insertAdjacentHTML("beforeend", ico("user", 60));
  };

  if (!avatarUrl) {
    showIcon();
    return;
  }

  const img = document.createElement("img");
  img.src = avatarUrl;
  img.alt = "Foto profil";
  img.addEventListener("error", showIcon);
  box.replaceChildren(img);
}

/** Ubah file gambar jadi Blob kecil (maks 512px, JPEG) siap diunggah. */
function prepareAvatarBlob(file) {
  return new Promise((resolve, reject) => {
    const MAX = 512;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff"; // WebP/PNG transparan -> latar putih
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error("Gambar tidak bisa diproses"))),
          "image/jpeg",
          0.85
        );
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("File gambar tidak bisa dibaca"));
    };
    img.src = url;
  });
}

function renderProfile(user) {
  document.getElementById("username").textContent = user.name;
  document.getElementById("email").textContent = user.email;

  renderAvatarBox(document.querySelector(".avatar"), user.avatar_url);

  const phoneEl = document.getElementById("phone");
  if (user.phone) {
    phoneEl.innerHTML = `${ico("phone", 15)} ${escapeHtml(user.phone)}`;
    phoneEl.style.display = "flex";
  } else {
    phoneEl.innerHTML = `${ico("phone", 15)} <span style="color:#aaa;">Belum ada nomor HP</span>`;
    phoneEl.style.display = "flex";
  }

  const addrEl = document.getElementById("address");
  const areaNama = user.area_id && getAreaById(user.area_id) ? getAreaById(user.area_id).nama : "";
  if (user.address) {
    addrEl.innerHTML = `${ico("pin", 15)} ${escapeHtml(user.address)}${areaNama ? ` <span style="color:var(--brand);font-weight:600;">· ${escapeHtml(areaNama)}</span>` : ""}`;
    addrEl.style.display = "flex";
  } else {
    addrEl.innerHTML = `${ico("pin", 15)} <span style="color:#aaa;">Alamat belum diatur (diperlukan untuk checkout)</span>`;
    addrEl.style.display = "flex";
  }

  const role = ROLE_META[user.role] || { label: user.role, icon: "user" };
  document.getElementById("roleTag").innerHTML = `${ico(role.icon, 14)} Peran: <b>${role.label}</b>`;
  document.getElementById("roleTag").style.display = "inline-flex";
  document.getElementById("roleTag").style.alignItems = "center";
  document.getElementById("roleTag").style.gap = "6px";

  // Link panel khusus peran
  if (user.role === "admin" || user.role === "courier") {
    const link = document.getElementById("roleLink");
    const text = document.getElementById("roleLinkText");
    link.style.display = "flex";
    if (user.role === "admin") {
      link.href = "/admin/admin.html";
      text.textContent = "Admin Panel (Kelola Toko)";
    } else {
      link.href = "/kurir/kurir.html";
      text.textContent = "Panel Pengantar";
    }
  }
}

function orderCard(o) {
  const items = o.items
    .map((it) => `<div><span>${escapeHtml(it.name)} × ${it.qty}</span><span>${rupiah(it.price * it.qty)}</span></div>`)
    .join("");
  const courier = o.courier_name
    ? `<div class="order-courier">${ico("truck", 15)} Pengantar: <b>${escapeHtml(o.courier_name)}</b>${o.courier_phone ? " · " + escapeHtml(o.courier_phone) : ""}</div>`
    : o.status === "pending"
      ? `<div class="order-courier">${ico("clock", 15)} Menunggu konfirmasi pemilik toko</div>`
      : `<div class="order-courier">Belum ditunjuk pengantar</div>`;

  return `
    <div class="order-card">
      <div class="order-head">
        <div>
          <span class="order-code">${escapeHtml(o.code)}</span>
          <div class="order-date">${ico("calendar", 13)} ${formatDate(o.created_at)}</div>
        </div>
        ${badgeHTML(o.status)}
      </div>
      <div class="order-items">${items}</div>
      ${
        o.discount > 0
          ? `<div class="order-items" style="margin:0 0 4px;"><div><span>Subtotal</span><span>${rupiah(o.subtotal)}</span></div></div>
             <div class="order-discount"><span>Potongan voucher${o.voucher_code ? " " + escapeHtml(o.voucher_code) : ""}</span><span>-${rupiah(o.discount)}</span></div>`
          : ""
      }
      <div class="order-total"><span>Total</span><span>${rupiah(o.total)}</span></div>
      ${courier}
      <div class="order-courier" style="color:#999;">${ico("pin", 14)} ${escapeHtml(o.address)}</div>
      <div class="order-courier" style="color:#999;">${ico("truck", 14)} ${o.area_nama ? escapeHtml(o.area_nama) + " · " : ""}Biaya antar ${o.delivery_fee > 0 ? rupiah(o.delivery_fee) : "GRATIS"}</div>
      ${
        o.boleh_dibatalkan
          ? `<div style="margin-top:12px;border-top:1px dashed var(--line);padding-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
              <button class="btn-cancel" onclick="cancelOrder(${o.id})" style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--st-cancelled);color:var(--st-cancelled);border-radius:var(--r-sm);padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;">
                ${ico("x", 15)} Batalkan Pesanan
              </button>
            </div>`
          : ""
      }
      ${o.status !== 'pending' && o.status !== 'cancelled' ? `
      <div style="margin-top:12px;border-top:1px dashed var(--line);padding-top:10px;">
        <button class="btn-chat" onclick="openChat(${o.id}, '${escapeHtml(o.code)}')" style="display:inline-flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--brand);color:var(--brand-dk);border-radius:var(--r-sm);padding:7px 12px;font-size:13px;font-weight:600;cursor:pointer;">
          ${ico("message-circle", 15)} Chat Pengantar ${o.msg_count ? `<span style="background:var(--brand);color:#fff;border-radius:9px;padding:0 6px;font-size:11px;">${o.msg_count}</span>` : ""}
        </button>
      </div>` : ""}
    </div>`;
}

// Batalkan pesanan (hanya status pending). Stok otomatis dikembalikan oleh server.
async function cancelOrder(id) {
  if (!confirm("Yakin ingin membatalkan pesanan ini? Stok produk akan dikembalikan.")) return;
  try {
    await API.post(`/orders/${id}/cancel`, {});
    await loadOrders();
  } catch (err) {
    alert("Gagal membatalkan: " + err.message);
  }
}

async function loadOrders() {
  const box = document.getElementById("ordersList");
  try {
    const { orders } = await API.get("/orders/mine");
    if (!orders.length) {
      box.innerHTML = `<div class="empty"><i data-ico="inbox"></i>Belum ada pesanan. <a href="/index.html" style="color:var(--brand);">Belanja sekarang ${ico("arrow-right", 14)}</a></div>`;
      renderIcons(box);
      return;
    }
    box.innerHTML = orders.map(orderCard).join("");
  } catch (err) {
    box.innerHTML = `<div class="empty"><i data-ico="triangle-alert"></i>Gagal memuat pesanan: ${escapeHtml(err.message)}</div>`;
  }
  renderIcons(box);
}

let CURRENT_CHAT_ORDER_ID = null;
let chatInterval = null;
let CHAT_CURSOR = null; // id pesan terakhir yang sudah dimuat (incremental)

async function openChat(orderId, code) {
  CURRENT_CHAT_ORDER_ID = orderId;
  CHAT_CURSOR = null; // muat ulang dari awal
  document.getElementById("chatOrderCode").textContent = `#${code}`;
  document.getElementById("chatModal").classList.remove("hidden");
  await loadChatMessages(true);
  if (chatInterval) clearInterval(chatInterval);
  chatInterval = setInterval(() => loadChatMessages(false), 3000);
}

function closeChat() {
  document.getElementById("chatModal").classList.add("hidden");
  CURRENT_CHAT_ORDER_ID = null;
  CHAT_CURSOR = null;
  if (chatInterval) clearInterval(chatInterval);
}

async function loadChatMessages(reset = false) {
  if (!CURRENT_CHAT_ORDER_ID) return;
  const box = document.getElementById("chatMessages");
  try {
    const url =
      CHAT_CURSOR && !reset
        ? `/orders/${CURRENT_CHAT_ORDER_ID}/messages?setelah=${CHAT_CURSOR}`
        : `/orders/${CURRENT_CHAT_ORDER_ID}/messages`;
    const { messages } = await API.get(url);

    // Tidak ada pesan baru sama sekali -> biarkan tampilan tetap
    if (!messages.length && !reset && CHAT_CURSOR !== null) return;

    // Pesan pertama kali dibuka / reset
    if (reset || CHAT_CURSOR === null) {
      if (!messages.length) {
        box.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:13px;margin-top:20px;">Belum ada pesan.</div>`;
        return;
      }
    }

    // Asumsi req.user tersedia (atau setidaknya kita tau role user adalah customer)
    // Di file ini kita sedang login sbg user
    const html = messages.map(m => {
      const isMe = m.sender_role === "customer";
      return `
        <div style="display:flex;flex-direction:column;align-items:${isMe ? 'flex-end' : 'flex-start'};">
          <span style="font-size:11px;color:var(--muted);margin-bottom:2px;padding:0 4px;">${escapeHtml(m.sender_name)}</span>
          <div style="background:${isMe ? 'var(--brand)' : '#fff'};color:${isMe ? '#fff' : 'var(--ink)'};border:1px solid ${isMe ? 'var(--brand)' : 'var(--line)'};padding:8px 12px;border-radius:${isMe ? '12px 12px 0 12px' : '12px 12px 12px 0'};max-width:85%;font-size:13.5px;word-break:break-word;box-shadow:0 1px 2px rgba(0,0,0,.05);">
            ${escapeHtml(m.text)}
          </div>
        </div>
      `;
    }).join("");

    // Cek apakah scroll di bawah
    const isScrolledToBottom = box.scrollHeight - box.clientHeight <= box.scrollTop + 10;

    if (reset || CHAT_CURSOR === null) {
      box.innerHTML = html;
    } else {
      // tambahkan hanya pesan baru
      const emptyNote = box.querySelector('[data-empty]');
      if (emptyNote) emptyNote.remove();
      box.insertAdjacentHTML("beforeend", html);
    }

    // perbarui cursor ke pesan terakhir
    const last = messages[messages.length - 1];
    if (last) CHAT_CURSOR = last.id;

    if (isScrolledToBottom) box.scrollTop = box.scrollHeight;

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

// ===== Ubah Profil =====
function initEditProfile(currentUser) {
  const backdrop = document.getElementById("editModal");
  const nameInput = document.getElementById("pfName");
  const phoneInput = document.getElementById("pfPhone");
  const addrInput = document.getElementById("pfAddress");
  const areaInput = document.getElementById("pfArea");
  const fileInput = document.getElementById("pfAvatarFile");
  const preview = document.getElementById("pfAvatarPreview");
  const hint = document.getElementById("pfAvatarHint");
  const removeBtn = document.getElementById("pfAvatarRemove");
  const errEl = document.getElementById("pfError");
  const saveBtn = document.getElementById("pfSave");

  const MAX_BYTES = 3 * 1024 * 1024;
  const OK_TYPES = ["image/jpeg", "image/png", "image/webp"];

  let newFile = null;     // file yang dipilih user, belum terkirim
  let newPreviewUrl = null; // object URL untuk pratinjau sementara
  let wantsRemove = false;  // user menekan "Hapus foto"

  function clearPending() {
    newFile = null;
    if (newPreviewUrl) URL.revokeObjectURL(newPreviewUrl);
    newPreviewUrl = null;
    wantsRemove = false;
    if (fileInput) fileInput.value = "";
  }

  function paintPreview() {
    if (!preview) return;
    const shown = wantsRemove ? null : newFile ? newPreviewUrl : currentUser.avatar_url;
    if (shown) {
      preview.innerHTML = "";
      const img = document.createElement("img");
      img.src = shown;
      img.alt = "Pratinjau foto profil";
      preview.appendChild(img);
    } else {
      preview.innerHTML = ico("user", 26);
      renderIcons(preview);
    }
    if (hint) {
      hint.textContent = newFile
        ? `${newFile.name} akan diunggah saat Anda menekan Simpan.`
        : wantsRemove
          ? "Foto akan dihapus saat Anda menekan Simpan."
          : "JPG, PNG, atau WebP — maksimal 3 MB.";
    }
    if (removeBtn) removeBtn.hidden = !!newFile || (!currentUser.avatar_url && !wantsRemove);
  }

  // Isi pilihan wilayah ongkir (data dari server; kosong bila belum ada wilayah)
  function paintAreaOptions() {
    if (!areaInput) return;
    if (!AREAS.length) {
      areaInput.innerHTML = `<option value="">— belum ada wilayah —</option>`;
      areaInput.disabled = true;
      return;
    }
    areaInput.disabled = false;
    areaInput.innerHTML = AREAS.map((a) =>
      `<option value="${a.id}">${escapeHtml(a.nama)} — ${a.ongkir > 0 ? rupiah(a.ongkir) : "Gratis"}</option>`
    ).join("");
    // Nilai awal: wilayah tersimpan di profil, fallback ke storage / wilayah pertama
    const dariProfil = currentUser.area_id;
    const dariStorage = areaTerpilihDariStorage();
    areaInput.value = String(
      getAreaById(dariProfil) ? dariProfil
        : dariStorage ? dariStorage.id
        : AREAS[0].id
    );
  }

  function open() {
    clearPending();
    nameInput.value = currentUser.name || "";
    phoneInput.value = currentUser.phone || "";
    addrInput.value = currentUser.address || "";
    paintAreaOptions();
    errEl.textContent = "";
    paintPreview();
    backdrop.classList.remove("hidden");
    nameInput.focus();
  }
  function close() {
    clearPending();
    backdrop.classList.add("hidden");
  }

  document.getElementById("editProfileBtn").addEventListener("click", open);
  document.getElementById("editProfileBtn2").addEventListener("click", open);
  document.getElementById("pfCancel").addEventListener("click", close);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.classList.contains("hidden")) close();
  });

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      errEl.textContent = "";
      const file = fileInput.files && fileInput.files[0];
      if (!file) {
        clearPending();
        paintPreview();
        return;
      }
      if (!OK_TYPES.includes(file.type)) {
        clearPending();
        errEl.textContent = "Format file harus JPG, PNG, atau WebP.";
        return;
      }
      if (file.size > MAX_BYTES) {
        clearPending();
        errEl.textContent = "Ukuran foto maksimal 3 MB.";
        return;
      }
      clearPending();
      newFile = file;
      newPreviewUrl = URL.createObjectURL(file);
      paintPreview();
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener("click", () => {
      clearPending();
      wantsRemove = true;
      paintPreview();
    });
  }

  saveBtn.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const address = addrInput.value.trim();

    if (name.length < 2) {
      errEl.textContent = "Nama minimal 2 karakter.";
      return;
    }
    errEl.textContent = "";
    saveBtn.disabled = true;
    try {
      // 1) simpan data profil dulu
      const patchBody = { name, phone, address };
      if (areaInput && !areaInput.disabled && areaInput.value) patchBody.area_id = +areaInput.value;
      const { user: updated } = await API.patch("/me", patchBody);
      currentUser = updated;
      if (patchBody.area_id) simpanAreaDipilih(patchBody.area_id);

      // 2) baru urusan foto (upload / hapus) — gagal di sini tidak menghapus data profil
      if (newFile) {
        const blob = await prepareAvatarBlob(newFile);
        const { user: withAvatar } = await API.upload("/me/avatar", blob);
        currentUser = withAvatar;
      } else if (wantsRemove && currentUser.avatar_url) {
        const { user: cleared } = await API.del("/me/avatar");
        currentUser = cleared;
      }

      clearPending();
      renderProfile(currentUser);
      paintPreview();
      close();
    } catch (e) {
      errEl.textContent = newFile
        ? `Profil tersimpan, tetapi foto gagal diunggah: ${e.message}`
        : e.message;
    } finally {
      saveBtn.disabled = false;
    }
  });
}

// ===== Mulai =====
(async () => {
  let user = await loadMe();
  renderNav();
  if (user) await loadAreas();   // wilayah ongkir untuk form profil

  if (!user) {
    document.getElementById("profileArea").innerHTML = `
      <div class="not-login">
        <div class="avatar"><i data-ico="user"></i></div>
        <h2>Anda belum login</h2>
        <p style="margin-top:8px;color:#888;">Login dulu untuk melihat profil & riwayat pesanan.</p>
        <p style="margin-top:14px;"><a href="/login/login.html?next=/account/account.html">Login sekarang ${ico("arrow-right", 14)}</a></p>
      </div>`;
    renderIcons(document.getElementById("profileArea"));
    document.getElementById("ordersList").innerHTML = `<div class="empty">Login untuk melihat riwayat.</div>`;
    document.getElementById("miniLinks").style.display = "none";
    document.getElementById("riwayat").style.display = "none";
    return;
  }

  renderProfile(user);
  initEditProfile(user);
  loadOrders();

  // Link cepat sesuai peran
  const mini = document.getElementById("miniLinks");
  if (user.role === "admin") mini.innerHTML += `<a href="/admin/admin.html">${ico("settings")} Admin Panel</a>`;
  if (user.role === "courier") mini.innerHTML += `<a href="/kurir/kurir.html">${ico("truck")} Panel Pengantar</a>`;
  renderIcons(mini);
})();
