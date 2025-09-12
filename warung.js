function searchComics() {
      const input = document.getElementById("searchInput").value.toLowerCase();
      const items = document.querySelectorAll(".manut");

      items.forEach(item => {
        const comic = item.getAttribute("data-comic").toLowerCase();
        const card = item.parentElement;

        if (comic.includes(input)) {
          card.style.display = "block";
          card.style.display = "flex";
        } else {
          card.style.display = "none";
        }
      });
    }