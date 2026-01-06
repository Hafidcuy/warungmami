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
      comic.style.display = "block";
      comic.style.justifyContent = "center";
    } else {
      comic.style.display = "none";
    }
  });
});

// === CART COUNTER ===
let cartCount = 0;
const cartBadge = document.querySelector(".badge");
const cartIcon = document.getElementById("cart");

// klik judul / card untuk masuk cart
comics.forEach((comic) => {
  comic.addEventListener("click", () => {
    cartCount++;
    cartBadge.textContent = cartCount;

    // animasi kecil biar hidup
    cartBadge.classList.add("pop");
    setTimeout(() => {
      cartBadge.classList.remove("pop");
    }, 300);
  });
});

// klik icon cart
cartIcon.addEventListener("click", () => {
  if (cartCount === 0) {
    alert("Keranjang masih kosong 😅");
  } else {
    alert(`Kamu punya ${cartCount} komik di keranjang 📚`);
  }
});
