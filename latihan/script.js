function searchItems() {
  const input = document.getElementById("searchInput").value.toLowerCase();
  const cards = document.querySelectorAll(".card");
  const judul = document.querySelectorAll(".judul");

  let adaMinuman = false;
  let adaMakanan = false;

  // kalau input kosong → tampilkan semua
  if (input.trim() === "") {
    cards.forEach(card => {
      card.style.display = "inline-block";
    });
    judul.forEach(j => {
      j.style.display = "block";
    });
    return; // stop fungsi biar ga lanjut
  }

  // filter kalau ada input
  cards.forEach(card => {
    const nama = card.getAttribute("data-nama");

    if (nama.includes(input)) {
      card.style.display = "inline-block";
      if (card.closest("#produk-minuman")) adaMinuman = true;
      if (card.closest("#produk-makanan")) adaMakanan = true;
    } else {
      card.style.display = "none";
    }
  });

  // atur visibilitas judul sesuai hasil
  judul.forEach(j => {
    if (j.textContent.toLowerCase().includes("minuman")) {
      j.style.display = adaMinuman ? "block" : "none";
    }
    if (j.textContent.toLowerCase().includes("makanan")) {
      j.style.display = adaMakanan ? "block" : "none";
    }
  });
}
