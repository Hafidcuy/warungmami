// === Perpustakaan Warung Mami ===
// Fitur: pencarian manga, toggle menu/hamburger di layar kecil, jumlah keranjang.

// ===== Pencarian komik =====
const searchInput = document.getElementById("searchInput");

function filterComics() {
  const keyword = (searchInput.value || "").trim().toLowerCase();
  const comics = document.querySelectorAll(".rpl");
  let visible = 0;

  comics.forEach((comic) => {
    const title = (comic.querySelector(".manut")?.getAttribute("data-comic") || "").toLowerCase();
    const show = title.includes(keyword);
    comic.style.display = show ? "" : "none";
    if (show) visible++;
  });

  // Pesan "tidak ditemukan"
  const grid = document.querySelector(".list");
  if (!grid) return;
  let note = document.getElementById("emptySearch");
  if (!visible) {
    if (!note) {
      note = document.createElement("div");
      note.id = "emptySearch";
      note.className = "empty-search";
      note.innerHTML = `<i data-ico="search"></i>
        <p style="margin:0;">Komik "<b id="emptyKeyword"></b>" tidak ditemukan.</p>
        <span style="font-size:13px;">Coba kata kunci lain.</span>`;
      grid.appendChild(note);
      renderIcons(note);
    }
    document.getElementById("emptyKeyword").textContent = searchInput.value;
  } else if (note) {
    note.remove();
  }
}

if (searchInput) searchInput.addEventListener("input", filterComics);

// ===== Toggle menu & pencarian (layar kecil) =====
document.querySelector(".menu-toggle")?.addEventListener("click", () => {
  const nav = document.querySelector(".navbar");
  nav.classList.toggle("active");
  nav.classList.remove("search-active");
});

document.querySelector(".search-toggle")?.addEventListener("click", () => {
  const nav = document.querySelector(".navbar");
  nav.classList.toggle("search-active");
  nav.classList.remove("active");

  if (nav.classList.contains("search-active")) {
    searchInput?.focus();
  }
});

// ===== Isi nama pengguna & jumlah keranjang =====
document.addEventListener("DOMContentLoaded", () => {
  initPage(); // dari js/api.js: muat sesi + tampilkan nama
});
window.addEventListener("pageshow", () => {
  updateCartCount(); // jumlah keranjang tetap akurat saat back/forward
});
