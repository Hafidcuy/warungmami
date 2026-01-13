document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("searchInput") || document.querySelector(".navbar input[type='text']");
  const sections = Array.from(document.querySelectorAll("section"));

  // cari heading (judul) yang berhubungan dengan sebuah section
  function findHeadingForSection(section) {
    // 1) cari prev sibling dari section
    let node = section.previousElementSibling;
    while (node) {
      if (node.classList && node.classList.contains('judul')) return node;
      if (/^H[1-6]$/.test(node.tagName)) return node;
      node = node.previousElementSibling;
    }

    // 2) jika tidak ditemukan, naik ke parent dan cari prev siblings (contoh: h2 sebelum <main>)
    let parent = section.parentElement;
    while (parent && parent !== document.body) {
      node = parent.previousElementSibling;
      while (node) {
        if (node.classList && node.classList.contains('judul')) return node;
        if (/^H[1-6]$/.test(node.tagName)) return node;
        node = node.previousElementSibling;
      }
      parent = parent.parentElement;
    }

    return null;
  }

  // map: section -> its heading element (or null)
  const sectionHeadingMap = new Map();
  sections.forEach(s => sectionHeadingMap.set(s, findHeadingForSection(s)));

  function search() {
    const q = (input && input.value) ? input.value.toLowerCase().trim() : "";

    // jika input kosong: reset semua (tampilkan semua card, section, judul)
    if (q === "") {
      sections.forEach(section => {
        const cards = Array.from(section.querySelectorAll(".card"));
        cards.forEach(c => c.style.display = ""); // kosongkan inline style agar gunakan CSS
        section.style.display = ""; // tampilkan section
        const h = sectionHeadingMap.get(section);
        if (h) h.style.display = "";
      });
      return;
    }

    // untuk setiap section: periksa card di dalamnya
    sections.forEach(section => {
      const cards = Array.from(section.querySelectorAll(".card"));
      let anyVisible = false;

      cards.forEach(card => {
        const dataNama = (card.getAttribute("data-nama") || "").toLowerCase();
        const title = (card.querySelector("h3")?.textContent || "").toLowerCase();
        const desc = (card.querySelector("p")?.textContent || "").toLowerCase();

        // gunakan data-nama bila ada; fallback ke title/desc
        const hay = dataNama || title + " " + desc;

        if (hay.includes(q)) {
          card.style.display = ""; // tampilkan (biar sesuai CSS)
          anyVisible = true;
        } else {
          card.style.display = "none";
        }
      });

      // kalau ada card yg tampil -> tunjukkan section & judul; jika tidak -> sembunyikan section + judul
      section.style.display = anyVisible ? "" : "none";
      const heading = sectionHeadingMap.get(section);
      if (heading) heading.style.display = anyVisible ? "" : "none";
    });
  }

  // event listener realtime + expose fungsi global untuk onkeyup compatibility
  if (input) {
    input.addEventListener("input", search);
    window.searchItems = search;
  } else {
    console.warn("Search input tidak ditemukan: pastikan ada element dengan id='searchInput' atau .navbar input[type='text'].");
  }
});
// toggle menu
document.querySelector(".menu-toggle").addEventListener("click", () => {
  const nav = document.querySelector(".navbar");
  nav.classList.toggle("active");
  nav.classList.remove("search-active");
});

// toggle search
document.querySelector(".search-toggle").addEventListener("click", () => {
  const nav = document.querySelector(".navbar");
  nav.classList.toggle("search-active");
  nav.classList.remove("active");

  if (nav.classList.contains("search-active")) {
    document.getElementById("searchInput").focus();
  }
});
