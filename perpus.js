// === SEARCH COMIC ===
const searchInput = document.getElementById("searchInput");
const comics = document.querySelectorAll(".rpl");

searchInput.addEventListener("keyup", function () {
  const keyword = searchInput.value.toLowerCase();

  comics.forEach((comic) => {
    const title = comic
      .querySelector(".manut")
      .getAttribute("data-comic")
      .toLowerCase();

    if (title.includes(keyword)) {
      comic.style.display = "";
    } else {
      comic.style.display = "none";
    }
  });
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
