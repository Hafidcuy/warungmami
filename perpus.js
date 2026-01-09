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