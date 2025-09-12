document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.querySelector(".navbar input[type='text']");
  const cards = document.querySelectorAll(".card");

  searchInput.addEventListener("input", () => {
    const searchValue = searchInput.value.toLowerCase();

    cards.forEach(card => {
      const title = card.querySelector("h3").textContent.toLowerCase();
      const desc = card.querySelector("p") ? card.querySelector("p").textContent.toLowerCase() : "";

      if (title.includes(searchValue) || desc.includes(searchValue)) {
        card.style.display = "flex";
      } else {
        card.style.display = "none";
      }
    });
  });
});
