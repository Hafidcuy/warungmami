// ===== Admin Panel Warung Mami =====
// Semua data diambil & diubah lewat API (role: admin).

let ALL_ORDERS = [];
let COURIERS = [];
let PRODUCTS = [];
let CURRENT_FILTER = "";
let SEARCH_Q = "";

// Render ulang daftar pesanan (filter status dari server + pencarian lokal)
function renderOrders() {
  const box = document.getElementById("ordersList");
  const q = SEARCH_Q.trim().toLowerCase();
  const list = q
    ? ALL_ORDERS.filter((o) =>
        [o.code, o.customer_name, o.phone, o.address]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
    : ALL_ORDERS;

  if (!list.length) {
    box.innerHTML = `<p class="empty"><i data-ico="inbox" data-size="34"></i><br>${
      q ? "Tidak ada pesanan yang cocok dengan pencarian." : "Tidak ada pesanan " + (CURRENT_FILTER ? "dengan status ini" : "masuk") + "."
    }</p>`;
    renderIcons(box);
    return;
  }
  box.innerHTML = list.map(orderCardHTML).join("");
  renderIcons(box);
  attachCourierSelects();
}

// ============ Muat data ============
async function loadStats() {
  try {
    const s = await API.get("/admin/stats");
    document.getElementById("stPending").textContent = s.pending;
    document.getElementById("stActive").textContent = s.active;
    document.getElementById("stToday").textContent = rupiah(s.todayRevenue);
    document.getElementById("stTotal").textContent = rupiah(s.totalRevenue);
    document.getElementById("stCouriers").textContent = s.couriers;
    document.getElementById("stProducts").textContent = s.products;
    document.querySelector(".stat-card").classList.toggle("alert", s.pending > 0);
  } catch (e) { console.error(e); }
}

async function loadCouriers() {
  try {
    const data = await API.get("/admin/couriers");
    COURIERS = data.couriers;
    renderCouriers();
  } catch (e) { console.error(e); }
}

async function loadOrders() {
  const box = document.getElementById("ordersList");
  try {
    const qs = CURRENT_FILTER ? "?status=" + CURRENT_FILTER : "";
    const data = await API.get("/admin/orders" + qs);
    ALL_ORDERS = data.orders;
    renderOrders();
  } catch (e) {
    box.innerHTML = `<p class="empty"><i data-ico="triangle-alert" data-size="30"></i><br>Gagal memuat pesanan: ${escapeHtml(e.message)}</p>`;
    renderIcons(box);
  }
}

async function loadProducts() {
  try {
    const data = await API.get("/products");
    PRODUCTS = data.products;
    renderProducts();
  } catch (e) { console.error(e); }
}

// ============ Render pesanan ============
// Rincian harga: subtotal -> (diskon voucher) -> total
function priceSummaryHTML(o) {
  const subtotal = o.subtotal != null ? o.subtotal : o.total;
  const discount = o.discount || 0;
  const showSubtotal = discount > 0 || subtotal !== o.total;
  const areaLine = o.area_nama
    ? `<div><span>Wilayah antar</span><span>${escapeHtml(o.area_nama)}</span></div>`
    : "";
  const feeLine = `<div><span>Biaya antar</span><span>${o.delivery_fee > 0 ? rupiah(o.delivery_fee) : "GRATIS"}</span></div>`;
  return `
    ${showSubtotal ? `<div><span>Subtotal</span><span>${rupiah(subtotal)}</span></div>` : ""}
    ${
      discount > 0
        ? `<div class="order-discount"><span>Diskon${o.voucher_code ? " " + escapeHtml(o.voucher_code) : ""}</span><span>-${rupiah(discount)}</span></div>`
        : ""
    }
    ${areaLine}${feeLine}
    <div class="order-total"><span>Total</span><span>${rupiah(o.total)}</span></div>`;
}

function orderCardHTML(o) {
  const items = o.items
    .map((it) => `<div><span>${escapeHtml(it.name)} × ${it.qty}</span><span>${rupiah(it.price * it.qty)}</span></div>`)
    .join("");
  const priceSummary = priceSummaryHTML(o);

  const courierLine = o.courier_name
    ? `<div class="courier-line">${ico("truck", 15)} ${escapeHtml(o.courier_name)}${o.courier_phone ? " · " + escapeHtml(o.courier_phone) : ""}</div>`
    : `<div style="color:#999;display:flex;align-items:center;gap:6px;">${ico("truck", 15)} Belum ada pengantar</div>`;

  // ---- Aksi yang tersedia ----
  let actions = `<button class="btn btn-detail" data-detail="${o.id}">${ico("eye", 15)} Detail</button>`;

  if (o.status === "pending") {
    actions = `
      <button class="btn btn-accept" data-action="accept" data-id="${o.id}">${ico("check", 15)} Terima Pesanan</button>
      <select class="assign-select" data-assign="${o.id}" aria-label="Pilih pengantar">
        <option value="">Pilih pengantar...</option>
        ${COURIERS.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${c.active_deliveries} tugas)</option>`).join("")}
      </select>
      <button class="btn btn-cancel" data-action="cancel" data-id="${o.id}">${ico("x", 15)} Tolak</button>
      ` + actions;
  } else if (o.status === "accepted") {
    actions = `
      <button class="btn btn-ready" data-action="ready" data-id="${o.id}">${ico("check-circle", 15)} Siap Diambil</button>
      <select class="assign-select" data-assign="${o.id}" aria-label="Tunjuk pengantar">
        <option value="">${o.courier_name ? "Ganti pengantar..." : "Tunjuk pengantar..."}</option>
        ${COURIERS.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${c.active_deliveries} tugas)</option>`).join("")}
      </select>
      <button class="btn btn-cancel" data-action="cancel" data-id="${o.id}">${ico("x", 15)} Batalkan</button>
      ` + actions;
  } else if (o.status === "siap") {
    actions = `
      <select class="assign-select" data-assign="${o.id}" aria-label="Tunjuk pengantar">
        <option value="">${o.courier_name ? "Ganti pengantar..." : "Tunjuk pengantar..."}</option>
        ${COURIERS.map((c) => `<option value="${c.id}">${escapeHtml(c.name)} (${c.active_deliveries} tugas)</option>`).join("")}
      </select>
      <span class="inline-note" style="color:var(--st-ok);">${ico("check-circle", 15)} Menunggu pengantar</span>
      <button class="btn btn-cancel" data-action="cancel" data-id="${o.id}">${ico("x", 15)} Batalkan</button>
      ` + actions;
  } else if (o.status === "sending") {
    actions += ` <span class="inline-note" style="color:var(--st-sending-fg);">${ico("truck", 15)} Sedang diantar</span>`;
  } else if (o.status === "delivered") {
    actions += ` <span class="inline-note" style="color:var(--st-ok);">${ico("check-circle", 15)} Selesai</span>`;
  } else if (o.status === "cancelled") {
    actions = `<button class="btn btn-detail" data-action="reopen" data-id="${o.id}">${ico("undo", 15)} Kembalikan ke Antrean</button>` + actions;
  }

  return `
    <div class="order-card is-${o.status}">
      <div class="order-top">
        <div>
          <div class="order-code">#${escapeHtml(o.code)}</div>
          <div class="order-date">${ico("calendar", 13)} ${formatDate(o.created_at)}</div>
        </div>
        ${badgeHTML(o.status)}
      </div>
      <div class="order-grid">
        <div class="order-items">
          ${items}
          ${priceSummary}
        </div>
        <div class="customer-box">
          <b style="display:inline-flex;align-items:center;gap:6px;">${ico("user", 15)} ${escapeHtml(o.customer_name)}</b><br>
          <span style="display:inline-flex;align-items:center;gap:6px;">${ico("phone", 15)} ${escapeHtml(o.phone)}</span><br>
          <span style="display:inline-flex;align-items:center;gap:6px;">${ico("pin", 15)} ${escapeHtml(o.address)}</span>
          ${o.area_nama ? `<br><span style="display:inline-flex;align-items:center;gap:6px;color:var(--brand);font-weight:600;">${ico("truck", 15)} ${escapeHtml(o.area_nama)}</span>` : ""}
          ${o.note ? `<br><span style="display:inline-flex;align-items:center;gap:6px;">${ico("note", 15)} <i>${escapeHtml(o.note)}</i></span>` : ""}
          ${courierLine}
        </div>
      </div>
      <div class="order-actions">${actions}</div>
    </div>`;
}

// Ketika admin memilih pengantar langsung dari dropdown
function attachCourierSelects() {
  document.querySelectorAll("select[data-assign]").forEach((sel) => {
    sel.addEventListener("change", async () => {
      if (!sel.value) return;
      sel.disabled = true;
      try {
        const id = sel.dataset.assign;
        const isPending = sel.closest(".order-card").classList.contains("is-pending");
        await API.patch(`/admin/orders/${id}`, {
          action: isPending ? "accept" : "assign",
          courier_id: parseInt(sel.value, 10),
        });
        toast("Pengantar berhasil ditunjuk");
        refreshAll();
      } catch (e) {
        toast(e.message, "error");
        sel.disabled = false;
      }
    });
  });
}

// Klik aksi (Terima / Tolak / Kembalikan)
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;
  const action = btn.dataset.action;

  const confirmText = {
    accept: "Terima pesanan ini?",
    ready: "Tandai pesanan ini sudah siap diambil?",
    cancel: "Yakin batalkan pesanan ini?",
    reopen: "Kembalikan pesanan ini ke antrean konfirmasi?",
  }[action];
  if (confirmText && !confirm(confirmText)) return;

  btn.disabled = true;
  try {
    await API.patch(`/admin/orders/${id}`, { action });
    toast("Pesanan diperbarui");
    refreshAll();
  } catch (err) {
    toast(err.message, "error");
    btn.disabled = false;
  }
});

// Detail pesanan (modal)
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-detail]");
  if (!btn) return;
  const o = ALL_ORDERS.find((x) => x.id === +btn.dataset.detail);
  if (o) openDetailModal(o);
});

function openDetailModal(o) {
  const items = o.items
    .map((it) => `<div><span>${escapeHtml(it.name)} × ${it.qty}</span><span>${rupiah(it.price * it.qty)}</span></div>`)
    .join("");
  openModal(`
    <h3>${ico("box", 18)} Detail Pesanan #${escapeHtml(o.code)}</h3>
    <div class="detail-list">
      ${items}
      ${priceSummaryHTML(o)}
      <p style="margin-top:10px;">
        <b>${ico("user", 15)}</b> ${escapeHtml(o.customer_name)}<br>
        <b>${ico("phone", 15)}</b> ${escapeHtml(o.phone)}<br>
        <b>${ico("pin", 15)}</b> ${escapeHtml(o.address)}<br>
        ${o.note ? `<b>${ico("note", 15)}</b> <i>${escapeHtml(o.note)}</i><br>` : ""}
        <b>${ico("truck", 15)}</b> ${o.courier_name ? escapeHtml(o.courier_name) : "Belum ada pengantar"}<br>
        <b>${ico("calendar", 15)}</b> ${formatDate(o.created_at)}<br>
        <b>Status:</b> ${badgeHTML(o.status)}
      </p>
    </div>
    <div class="modal-actions">
      <button class="btn-cancel-modal" onclick="closeModal()">${ico("x", 15)} Tutup</button>
    </div>
  `);
}

// ============ Render pengantar ============
function renderCouriers() {
  const box = document.getElementById("courierList");
  if (!COURIERS.length) {
    box.innerHTML = `<p class="empty"><i data-ico="truck" data-size="34"></i><br>Belum ada akun pengantar. Klik <b>Tambah Pengantar</b> untuk mendaftarkan.</p>`;
    renderIcons(box);
    return;
  }
  box.innerHTML = COURIERS.map(
    (c) => `
    <div class="courier-card">
      <b>${ico("truck", 16)} ${escapeHtml(c.name)}</b>
      <span style="display:inline-flex;align-items:center;gap:6px;">${ico("user", 14)} ${escapeHtml(c.email || "-")}</span>
      <span style="display:inline-flex;align-items:center;gap:6px;">${ico("phone", 14)} ${escapeHtml(c.phone || "-")}</span>
      <span class="${c.active_deliveries ? "busy" : ""}" style="display:inline-flex;align-items:center;gap:7px;">
        <span class="dot ${!c.is_ready ? "dot-red" : c.active_deliveries ? "dot-red" : "dot-green"}"></span>
        ${!c.is_ready ? '<span style="color:#d33;font-weight:600;">Tidak Siap</span>' : c.active_deliveries ? `${c.active_deliveries} tugas aktif` : "Siap menerima tugas"}
      </span>
      <div class="courier-tools">
        <button class="mini-btn mini-del" data-cdel="${c.id}" title="Hapus pengantar"
                aria-label="Hapus ${escapeHtml(c.name)}">${ico("trash", 13)} Hapus</button>
      </div>
    </div>`
  ).join("");
  renderIcons(box);
}

// ============ Render produk ============
function renderProducts() {
  const box = document.getElementById("productList");
  if (!PRODUCTS.length) {
    box.innerHTML = `<p class="empty"><i data-ico="cup" data-size="34"></i><br>Belum ada produk. Klik <b>Tambah Produk</b>.</p>`;
    renderIcons(box);
    return;
  }
  box.innerHTML = PRODUCTS.map(
    (p) => `
    <div class="product-card ${p.available ? "" : "out"}">
      <img src="${escapeHtml(p.image_url)}" onerror="this.src='https://placehold.co/60'" alt="">
      <div class="product-info">
        <b>${escapeHtml(p.name)}</b>
        <small>${rupiah(p.price)}</small><br>
        <small style="color:#999;font-weight:normal;">${escapeHtml(p.category_label || p.category)}</small>
        ${p.deskripsi ? `<br><small style="color:#999;font-weight:normal;font-size:11px;">${escapeHtml(p.deskripsi)}</small>` : ""}
        <br>
        <span class="stok ${p.available ? "" : "off"}">${ico(p.available ? "check-circle" : "x", 11)} ${p.available ? "Tersedia" : "Habis"}</span>
        <span class="stok ${p.stok > 0 ? "" : "off"}" title="Sisa stok">${ico("box", 11)} Stok ${p.stok}</span>
      </div>
      <div class="product-tools">
        <button class="mini-btn mini-edit" data-pedit="${p.id}" title="Ubah produk" aria-label="Ubah ${escapeHtml(p.name)}">${ico("pencil", 13)}</button>
        <button class="mini-btn mini-avail ${p.available ? "" : "off"}" data-pavail="${p.id}"
                title="${p.available ? "Tandai habis" : "Aktifkan kembali"}">
          ${p.available ? "Tandai Habis" : "Aktifkan"}
        </button>
        <button class="mini-btn mini-del" data-pdel="${p.id}" title="Hapus produk" aria-label="Hapus ${escapeHtml(p.name)}">${ico("trash", 13)}</button>
      </div>
    </div>`
  ).join("");
  renderIcons(box);
}

// Toggle status tersedia
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-pavail]");
  if (!btn) return;
  const p = PRODUCTS.find((x) => x.id === +btn.dataset.pavail);
  try {
    await API.patch(`/admin/products/${p.id}`, { available: !p.available });
    toast(p.available ? `${p.name} ditandai HABIS` : `${p.name} kembali tersedia`);
    loadProducts();
  } catch (err) { toast(err.message, "error"); }
});

// Hapus produk
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-pdel]");
  if (!btn) return;
  const p = PRODUCTS.find((x) => x.id === +btn.dataset.pdel);
  if (!confirm(`Hapus produk "${p.name}"?`)) return;
  try {
    await API.del(`/admin/products/${p.id}`);
    toast("Produk dihapus");
    loadProducts();
    loadStats();
  } catch (err) { toast(err.message, "error"); }
});

// Hapus pengantar
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-cdel]");
  if (!btn) return;
  const c = COURIERS.find((x) => x.id === +btn.dataset.cdel);
  if (!c) return;
  if (!confirm(`Hapus akun pengantar "${c.name}" (${c.email || "tanpa email"})?`)) return;
  try {
    await API.del(`/admin/couriers/${c.id}`);
    toast(`Pengantar ${c.name} dihapus`);
    loadCouriers();
    loadStats();
  } catch (err) { toast(err.message, "error"); }
});

// Edit / Tambah produk
function openProductForm(product) {
  const isEdit = !!product;
  openModal(`
    <h3>${ico(isEdit ? "pencil" : "plus", 18)} ${isEdit ? "Edit Produk" : "Tambah Produk"}</h3>
    <label>Nama produk
      <input type="text" id="pName" value="${isEdit ? escapeHtml(product.name) : ""}" placeholder="Es Tera" />
    </label>
    <label>Harga (Rp)
      <input type="number" id="pPrice" min="0" value="${isEdit ? product.price : ""}" placeholder="3000" />
    </label>
    <label>Kategori
      <select id="pCategory">
        <option value="minuman" ${isEdit && product.category === "minuman" ? "selected" : ""}>Minuman</option>
        <option value="makanan" ${isEdit && product.category === "makanan" ? "selected" : ""}>Makanan</option>
        <option value="snack" ${isEdit && product.category === "snack" ? "selected" : ""}>Snack</option>
        <option value="paket" ${isEdit && product.category === "paket" ? "selected" : ""}>Paket</option>
      </select>
    </label>
    <label>Stok tersedia
      <input type="number" id="pStok" min="0" value="${isEdit ? (product.stok ?? "") : ""}" placeholder="20" />
    </label>
    <label>Deskripsi singkat (opsional)
      <textarea id="pDesc" rows="2" placeholder="Es segar gula aren...">${isEdit ? escapeHtml(product.deskripsi || "") : ""}</textarea>
    </label>
    <label>URL gambar (opsional)
      <input type="text" id="pImage" value="${isEdit ? escapeHtml(product.image_url) : ""}" placeholder="https://..." />
    </label>
    <p class="error" id="pError"></p>
    <div class="modal-actions">
      <button class="btn-cancel-modal" onclick="closeModal()">Batal</button>
      <button class="btn-save" id="pSave">${ico("check", 15)} Simpan</button>
    </div>
  `);

  document.getElementById("pSave").addEventListener("click", async () => {
    const body = {
      name: document.getElementById("pName").value.trim(),
      price: parseInt(document.getElementById("pPrice").value, 10),
      category: document.getElementById("pCategory").value,
      deskripsi: document.getElementById("pDesc").value.trim(),
      stok: parseInt(document.getElementById("pStok").value, 10),
      image_url: document.getElementById("pImage").value.trim(),
    };
    if (!body.name || !body.price || body.price < 0) {
      document.getElementById("pError").textContent = "Nama dan harga wajib diisi";
      return;
    }
    if (Number.isNaN(body.stok) || body.stok < 0) body.stok = undefined;
    const btn = document.getElementById("pSave");
    btn.disabled = true;
    try {
      if (isEdit) await API.patch(`/admin/products/${product.id}`, body);
      else await API.post("/admin/products", body);
      toast("Produk disimpan");
      closeModal();
      loadProducts();
      loadStats();
    } catch (err) {
      document.getElementById("pError").textContent = err.message;
      btn.disabled = false;
    }
  });
}

document.addEventListener("click", (e) => {
  if (e.target.closest("#addProductBtn")) openProductForm(null);
  const edit = e.target.closest("[data-pedit]");
  if (edit) openProductForm(PRODUCTS.find((x) => x.id === +edit.dataset.pedit));
});

// ============ Voucher & Promo ============
let VOUCHERS = [];

async function loadVouchers() {
  const box = document.getElementById("voucherList");
  if (!box) return;
  try {
    const data = await API.get("/admin/vouchers");
    VOUCHERS = data.vouchers || [];
    renderVouchers();
  } catch (err) {
    box.innerHTML = `<p class="empty"><i data-ico="triangle-alert" data-size="30"></i><br>Gagal memuat voucher: ${escapeHtml(err.message)}</p>`;
    renderIcons(box);
  }
}

function renderVouchers() {
  const box = document.getElementById("voucherList");
  if (!VOUCHERS.length) {
    box.innerHTML = `<p class="empty"><i data-ico="money" data-size="34"></i><br>Belum ada voucher. Klik <b>Tambah Voucher</b> untuk membuat promo.</p>`;
    renderIcons(box);
    return;
  }
  box.innerHTML = VOUCHERS.map((v) => `
    <div class="voucher-card ${v.active ? "" : "off"}">
      <b class="voucher-code">${escapeHtml(v.code)}</b>
      <span class="v-disc">${v.is_percent ? `Diskon ${v.discount}%` : `Potongan ${rupiah(v.discount)}`}</span>
      <small>${v.min_purchase > 0 ? `Min. belanja ${rupiah(v.min_purchase)}` : "Tanpa minimal belanja"}</small>
      ${v.deskripsi ? `<small style="color:#999;">${escapeHtml(v.deskripsi)}</small>` : ""}
      <span class="stok ${v.active ? "" : "off"}">${ico(v.active ? "check-circle" : "x", 11)} ${v.active ? "Aktif" : "Nonaktif"}</span>
      <div class="voucher-tools">
        <button class="mini-btn mini-edit" data-vedit="${v.id}" title="Ubah voucher" aria-label="Ubah voucher ${escapeHtml(v.code)}">${ico("pencil", 13)} Edit</button>
        <button class="mini-btn mini-avail ${v.active ? "" : "off"}" data-vavail="${v.id}">${v.active ? "Nonaktifkan" : "Aktifkan"}</button>
        <button class="mini-btn mini-del" data-vdel="${v.id}" title="Hapus voucher" aria-label="Hapus voucher ${escapeHtml(v.code)}">${ico("trash", 13)}</button>
      </div>
    </div>`).join("");
  renderIcons(box);
}

// Aktif / nonaktifkan voucher
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-vavail]");
  if (!btn) return;
  const v = VOUCHERS.find((x) => x.id === +btn.dataset.vavail);
  try {
    await API.patch(`/admin/vouchers/${v.id}`, { active: !v.active });
    toast(v.active ? `Voucher ${v.code} dinonaktifkan` : `Voucher ${v.code} diaktifkan`);
    loadVouchers();
  } catch (err) { toast(err.message, "error"); }
});

// Hapus voucher
document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-vdel]");
  if (!btn) return;
  const v = VOUCHERS.find((x) => x.id === +btn.dataset.vdel);
  if (!confirm(`Hapus voucher "${v.code}"?`)) return;
  try {
    await API.del(`/admin/vouchers/${v.id}`);
    toast("Voucher dihapus");
    loadVouchers();
  } catch (err) { toast(err.message, "error"); }
});

// ============================================================
// ONGKIR PER WILAYAH (biaya antar dibedakan per area/jarak)
// ============================================================
let ADMIN_AREAS = [];

async function loadAreaRows() {
  try {
    const data = await API.get("/admin/areas");
    ADMIN_AREAS = data.areas || [];
  } catch (err) {
    ADMIN_AREAS = [];
    toast(err.message, "error");
  }
  renderAreasAdmin();
}

function renderAreasAdmin() {
  const box = document.getElementById("areaList");
  if (!box) return;
  if (!ADMIN_AREAS.length) {
    box.innerHTML = `<p class="empty"><i data-ico="truck" data-size="34"></i><br>Belum ada wilayah. Klik <b>Tambah Wilayah</b> untuk mengatur ongkir per area.</p>`;
    renderIcons(box);
    return;
  }
  box.innerHTML = ADMIN_AREAS.map((a) => `
    <div class="voucher-card ${a.aktif ? "" : "off"}">
      <b class="voucher-code">${escapeHtml(a.nama)}</b>
      <span class="v-disc">${a.ongkir > 0 ? `Ongkir ${rupiah(a.ongkir)}` : "Ongkir Gratis"}</span>
      <small>${a.gratis_min !== null && a.gratis_min !== undefined ? `Gratis ongkir di atas ${rupiah(a.gratis_min)}` : "Tanpa gratis ongkir"}</small>
      <small style="color:#999;">Urutan tampil: ${a.urutan}</small>
      <span class="stok ${a.aktif ? "" : "off"}">${ico(a.aktif ? "check-circle" : "x", 11)} ${a.aktif ? "Aktif" : "Nonaktif"}</span>
      <div class="voucher-tools">
        <button class="mini-btn mini-edit" data-aedit="${a.id}" title="Ubah wilayah" aria-label="Ubah wilayah ${escapeHtml(a.nama)}">${ico("pencil", 13)} Edit</button>
        <button class="mini-btn mini-avail ${a.aktif ? "" : "off"}" data-aavail="${a.id}">${a.aktif ? "Nonaktifkan" : "Aktifkan"}</button>
        <button class="mini-btn mini-del" data-adel="${a.id}" title="Hapus wilayah" aria-label="Hapus wilayah ${escapeHtml(a.nama)}">${ico("trash", 13)}</button>
      </div>
    </div>`).join("");
  renderIcons(box);
}

function openAreaForm(area) {
  const isEdit = !!area;
  openModal(`
    <h3>${ico("truck", 18)} ${isEdit ? "Ubah" : "Tambah"} Wilayah</h3>
    <p class="form-hint">Satu wilayah = satu biaya antar. Pelanggan memilih wilayahnya saat checkout.</p>
    <label>Nama wilayah
      <input type="text" id="aName" placeholder="Contoh: Dalam Kota, Luar Kota, Kec. Prambanan" value="${isEdit ? escapeHtml(area.nama) : ""}" maxlength="60" />
    </label>
    <label>Ongkir (Rp)
      <input type="number" id="aOngkir" min="0" step="500" placeholder="5000" value="${isEdit ? area.ongkir : ""}" />
    </label>
    <label>Gratis ongkir di atas belanja (Rp) — opsional
      <input type="number" id="aFreeMin" min="0" step="1000" placeholder="Kosongkan bila tidak berlaku" value="${isEdit && area.gratis_min !== null && area.gratis_min !== undefined ? area.gratis_min : ""}" />
      <small class="form-hint">Kosongkan = wilayah ini tidak pernah dapat gratis ongkir.</small>
    </label>
    <label>Urutan tampil
      <input type="number" id="aOrder" min="0" step="1" placeholder="1" value="${isEdit ? area.urutan : ADMIN_AREAS.length + 1}" />
    </label>
    <p class="error" id="aError"></p>
    <div class="modal-actions">
      <button class="btn-cancel-modal" onclick="closeModal()">Batal</button>
      <button class="btn-save" id="aSave">${ico("check", 15)} Simpan</button>
    </div>
  `);

  document.getElementById("aSave").addEventListener("click", async () => {
    const freeRaw = document.getElementById("aFreeMin").value.trim();
    const body = {
      nama: document.getElementById("aName").value.trim(),
      ongkir: parseInt(document.getElementById("aOngkir").value, 10) || 0,
      gratis_min: freeRaw === "" ? null : Math.max(0, parseInt(freeRaw, 10) || 0),
      urutan: parseInt(document.getElementById("aOrder").value, 10) || 0,
      aktif: isEdit ? area.aktif : 1,
    };
    if (!body.nama) {
      document.getElementById("aError").textContent = "Nama wilayah wajib diisi";
      return;
    }
    const btn = document.getElementById("aSave");
    btn.disabled = true;
    try {
      if (isEdit) await API.patch(`/admin/areas/${area.id}`, body);
      else await API.post("/admin/areas", body);
      toast("Wilayah disimpan");
      closeModal();
      loadAreaRows();
      if (typeof loadAreas === "function") loadAreas(true); // sinkronkan cache pelanggan
    } catch (err) {
      document.getElementById("aError").textContent = err.message;
      btn.disabled = false;
    }
  });
}

// Tombol panel wilayah: tambah / ubah / aktif / hapus
document.addEventListener("click", (e) => {
  const add = e.target.closest("#addAreaBtn");
  if (add) return openAreaForm(null);
  const edit = e.target.closest("[data-aedit]");
  if (edit) return openAreaForm(ADMIN_AREAS.find((x) => x.id === +edit.dataset.aedit));
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-aavail]");
  if (!btn) return;
  const a = ADMIN_AREAS.find((x) => x.id === +btn.dataset.aavail);
  if (!a) return;
  try {
    await API.patch(`/admin/areas/${a.id}`, { aktif: !a.aktif });
    toast(a.aktif ? `Wilayah ${a.nama} dinonaktifkan` : `Wilayah ${a.nama} diaktifkan`);
    loadAreaRows();
    if (typeof loadAreas === "function") loadAreas(true);
  } catch (err) { toast(err.message, "error"); }
});

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("[data-adel]");
  if (!btn) return;
  const a = ADMIN_AREAS.find((x) => x.id === +btn.dataset.adel);
  if (!a) return;
  if (!confirm(`Hapus wilayah "${a.nama}"? Pesanan lama tetap menyimpan nama wilayahnya.`)) return;
  try {
    await API.del(`/admin/areas/${a.id}`);
    toast("Wilayah dihapus");
    loadAreaRows();
    if (typeof loadAreas === "function") loadAreas(true);
  } catch (err) { toast(err.message, "error"); }
});

// Tambah / edit voucher
function openVoucherForm(voucher) {
  const isEdit = !!voucher;
  openModal(`
    <h3>${ico("money", 18)} ${isEdit ? "Edit Voucher" : "Tambah Voucher"}</h3>
    <label>Kode voucher
      <input type="text" id="vCode" value="${isEdit ? escapeHtml(voucher.code) : ""}" placeholder="HEMAT5RB"
             style="text-transform:uppercase;" ${isEdit ? "readonly" : ""} />
    </label>
    <label>Jenis potongan
      <select id="vType">
        <option value="percent" ${isEdit && voucher.is_percent ? "selected" : ""}>Persen (%)</option>
        <option value="nominal" ${isEdit && !voucher.is_percent ? "selected" : ""}>Nominal (Rp)</option>
      </select>
    </label>
    <label id="vAmountLabel">Diskon (%)
      <input type="number" id="vAmount" min="1" value="${isEdit ? voucher.discount : ""}" placeholder="20" />
    </label>
    <label>Minimal pembelian (Rp)
      <input type="number" id="vMin" min="0" value="${isEdit ? voucher.min_purchase : 0}" placeholder="5000" />
    </label>
    <label>Deskripsi singkat (opsional)
      <input type="text" id="vDesc" value="${isEdit ? escapeHtml(voucher.deskripsi || "") : ""}" placeholder="Diskon khusus pelanggan baru" />
    </label>
    <p class="error" id="vError"></p>
    <div class="modal-actions">
      <button class="btn-cancel-modal" onclick="closeModal()">Batal</button>
      <button class="btn-save" id="vSave">${ico("check", 15)} Simpan</button>
    </div>
  `);

  const typeSel = document.getElementById("vType");
  const amountLabel = document.getElementById("vAmountLabel");
  const syncLabel = () => {
    amountLabel.childNodes[0].nodeValue = typeSel.value === "percent" ? "Diskon (%) " : "Potongan (Rp) ";
  };
  typeSel.addEventListener("change", syncLabel);
  syncLabel();

  document.getElementById("vSave").addEventListener("click", async () => {
    const body = {
      code: document.getElementById("vCode").value.trim().toUpperCase(),
      discount: parseInt(document.getElementById("vAmount").value, 10),
      is_percent: typeSel.value === "percent" ? 1 : 0,
      min_purchase: parseInt(document.getElementById("vMin").value, 10) || 0,
      deskripsi: document.getElementById("vDesc").value.trim(),
    };
    if (!body.code || !body.discount || body.discount < 1) {
      document.getElementById("vError").textContent = "Kode dan nilai diskon wajib diisi";
      return;
    }
    if (body.is_percent && body.discount > 100) {
      document.getElementById("vError").textContent = "Diskon persen maksimal 100%";
      return;
    }
    const btn = document.getElementById("vSave");
    btn.disabled = true;
    try {
      if (isEdit) await API.patch(`/admin/vouchers/${voucher.id}`, body);
      else await API.post("/admin/vouchers", body);
      toast("Voucher disimpan");
      closeModal();
      loadVouchers();
    } catch (err) {
      document.getElementById("vError").textContent = err.message;
      btn.disabled = false;
    }
  });
}

document.addEventListener("click", (e) => {
  if (e.target.closest("#addVoucherBtn")) openVoucherForm(null);
  const edit = e.target.closest("[data-vedit]");
  if (edit) openVoucherForm(VOUCHERS.find((x) => x.id === +edit.dataset.vedit));
});

// ============ Tambah akun pengantar ============
function openCourierForm() {
  openModal(`
    <h3>${ico("user-plus", 18)} Tambah Pengantar</h3>
    <p class="form-hint">Akun ini dipakai pengantar untuk login ke Panel Pengantar.</p>
    <label>Nama lengkap
      <input type="text" id="cName" placeholder="Nama pengantar" />
    </label>
    <label>Email
      <input type="email" id="cEmail" placeholder="pengantar@warungmami.id" />
    </label>
    <label>Nomor HP / WhatsApp
      <input type="tel" id="cPhone" placeholder="08xxxxxxxxxx" />
    </label>
    <label>Password (min. 6 karakter)
      <input type="password" id="cPassword" placeholder="Minimal 6 karakter" autocomplete="new-password" />
    </label>
    <p class="error" id="cError"></p>
    <div class="modal-actions">
      <button class="btn-cancel-modal" onclick="closeModal()">Batal</button>
      <button class="btn-save" id="cSave">${ico("check", 15)} Simpan</button>
    </div>
  `);

  document.getElementById("cSave").addEventListener("click", async () => {
    const body = {
      name: document.getElementById("cName").value.trim(),
      email: document.getElementById("cEmail").value.trim(),
      phone: document.getElementById("cPhone").value.trim(),
      password: document.getElementById("cPassword").value,
    };
    if (!body.name || !body.email || !body.password) {
      document.getElementById("cError").textContent = "Nama, email, dan password wajib diisi";
      return;
    }
    if (body.password.length < 6) {
      document.getElementById("cError").textContent = "Password minimal 6 karakter";
      return;
    }
    const btn = document.getElementById("cSave");
    btn.disabled = true;
    try {
      await API.post("/admin/couriers", body);
      toast("Akun pengantar dibuat");
      closeModal();
      loadCouriers();
      loadStats();
    } catch (err) {
      document.getElementById("cError").textContent = err.message;
      btn.disabled = false;
    }
  });
}

document.addEventListener("click", (e) => {
  if (e.target.closest("#addCourierBtn")) openCourierForm();
});

// ============ Modal helpers ============
function openModal(html) {
  const box = document.getElementById("modalBox");
  box.innerHTML = html;
  renderIcons(box);
  document.getElementById("modalBackdrop").hidden = false;
}
function closeModal() {
  document.getElementById("modalBackdrop").hidden = true;
  document.getElementById("modalBox").innerHTML = "";
}
document.getElementById("modalBackdrop").addEventListener("click", (e) => {
  if (e.target.id === "modalBackdrop") closeModal();
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

// ============ Filter & refresh ============
document.getElementById("filters").addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-status]");
  if (!btn) return;
  document.querySelectorAll("#filters button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  CURRENT_FILTER = btn.dataset.status;
  loadOrders();
});

document.getElementById("refreshBtn").addEventListener("click", () => {
  const btn = document.getElementById("refreshBtn");
  btn.classList.add("spinning");
  refreshAll().finally(() => setTimeout(() => btn.classList.remove("spinning"), 400));
});

// Pencarian pesanan (menyaring hasil yang sudah dimuat)
document.getElementById("orderSearch").addEventListener("input", (e) => {
  SEARCH_Q = e.target.value || "";
  renderOrders();
});

function refreshAll() {
  return Promise.all([loadStats(), loadOrders(), loadCouriers(), loadVouchers(), loadAreaRows()]);
}

// ============ Mulai ============
(async () => {
  const user = await loadMe();
  if (!user || user.role !== "admin") {
    document.querySelector("main").innerHTML = `
      <div class="empty" style="padding:60px 20px;">
        <div class="lock-icon"><i data-ico="lock"></i></div>
        <h2 style="margin:14px 0 6px;">Halaman khusus pemilik toko</h2>
        <p>Silakan login dengan akun admin.</p>
        <p style="margin-top:14px;"><a href="/login/login.html?next=/admin/admin.html" style="color:var(--brand);font-weight:bold;">Login Admin ${ico("arrow-right", 14)}</a></p>
      </div>`;
    renderIcons(document.querySelector("main"));
    // Kondisi belum login: nama diganti "Tamu" dan tombol Logout disembunyikan
    document.getElementById("adminName").textContent = user ? user.name : "Tamu";
    if (!user) document.getElementById("logoutBtn").hidden = true;
    return;
  }
  document.getElementById("adminName").textContent = user.name;

  refreshAll();
  loadProducts();

  // Auto-refresh tiap 30 detik (biar pesanan baru langsung terlihat)
  setInterval(() => {
    if (document.hidden) return;
    loadStats();
    loadOrders();
  }, 30000);
})();
