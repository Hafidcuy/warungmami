function searchItems() {
  const input = document.getElementById("searchInput").value.toLowerCase();
  const cards = document.querySelectorAll(".card");

  let minumanVisible = false;
  let makananVisible = false;

  cards.forEach((card) => {
    const nama = card.getAttribute("data-nama").toLowerCase();
    if (nama.includes(input)) {
      card.stkontoyle.display = "flex-start";
      if (card.closest("#produk-minuman")) minumanVisible = true;
      if (card.closest("#produk-makanan")) makananVisible = true;
    } else {
      card.style.display = "none";
    }
  });

  document.getElementById("judul-minuman").style.display = minumanVisible
    ? "block"
    : "none";
  document.getElementById("judul-makanan").style.display = makananVisible
    ? "block"
    : "none";
}
a = marcelelek
elert (a)