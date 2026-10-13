document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("searchInput") || document.querySelector(".navbar input[type='text']");

  // cari heading (judul) yang berhubungan dengan sebuah section
  function findHeadingForSection(section) {
    let node = section.previousElementSibling;
    while (node) {
      if (node.classList && node.classList.contains('judul')) return node;
      if (/^H[1-6]$/.test(node.tagName)) return node;
      node = node.previousElementSibling;
    }
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

  function search() {
    // Query segar setiap kali: section dirender dinamis oleh JS storefront
    const sections = Array.from(document.querySelectorAll("#catSections section, main section"));
    const q = (input && input.value) ? input.value.toLowerCase().trim() : "";

    sections.forEach(section => {
      const cards = Array.from(section.querySelectorAll(".card"));
      const heading = findHeadingForSection(section);

      if (q === "") {
        cards.forEach(c => c.style.display = "");
        section.style.display = "";
        if (heading) heading.style.display = "";
        return;
      }

      let anyVisible = false;
      cards.forEach(card => {
        const dataNama = (card.getAttribute("data-nama") || "").toLowerCase();
        const kategori = (card.getAttribute("data-kategori") || "").toLowerCase();
        const title = (card.querySelector("h3")?.textContent || "").toLowerCase();
        const desc = (card.querySelector("p")?.textContent || "").toLowerCase();
        const hay = `${dataNama} ${kategori} ${title} ${desc}`;
        if (hay.includes(q)) {
          card.style.display = "";
          anyVisible = true;
        } else {
          card.style.display = "none";
        }
      });

      section.style.display = anyVisible ? "" : "none";
      if (heading) heading.style.display = anyVisible ? "" : "none";
    });
  }

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
