/* =====================
   CART STORAGE
===================== */
let cart = JSON.parse(localStorage.getItem("cart")) || [];

/* =====================
   SAVE CART
===================== */
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

/* =====================
   CART COUNT (NAVBAR)
===================== */
function updateCartCount() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;

  const count = cart.reduce((t, i) => t + i.qty, 0);
  badge.innerText = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}

/* =====================
   CART UI
===================== */
function updateCartUI() {
  const items = document.getElementById("cartItems");
  const total = document.getElementById("cartTotal");
  if (!items || !total) return;

  items.innerHTML = "";

  if (!cart.length) {
    items.innerHTML = "<p>Cart kosong</p>";
    total.innerText = "Total: Rp 0";
    return;
  }

  cart.forEach(item => {
    items.innerHTML += `
      <div>
        ${item.name}
        <button onclick="changeQty(${item.id}, -1)">-</button>
        ${item.qty}
        <button onclick="changeQty(${item.id}, 1)">+</button>
      </div>
    `;
  });

  total.innerText =
    "Total: Rp " +
    cart.reduce((t, i) => t + i.price * i.qty, 0);
}

/* =====================
   ADD / CHANGE QTY
===================== */
function addToCart(product) {
  const item = cart.find(i => i.id === product.id);
  item ? item.qty++ : cart.push({ ...product, qty: 1 });

  saveCart();
  updateCartCount();
}

function changeQty(id, delta) {
  cart = cart
    .map(i => i.id === id ? { ...i, qty: i.qty + delta } : i)
    .filter(i => i.qty > 0);

  saveCart();
  updateCartUI();
  updateCartCount();
}

/* =====================
   CHECKOUT (FINAL)
===================== */
function checkout() {
  if (!cart.length) {
    alert("Cart kosong");
    return;
  }

  alert("Checkout berhasil!");

  // 🔥 HAPUS CART
  cart = [];
  localStorage.removeItem("cart");

  // 🔥 TANDAI CART BARU SAJA DIBERSIHKAN
  localStorage.setItem("cartCleared", "true");

  updateCartUI();
  updateCartCount();
}

/* =====================
   FORCE REFRESH SAAT KELUAR KERANJANG
===================== */
window.addEventListener("pageshow", () => {
  if (localStorage.getItem("cartCleared") === "true") {
    localStorage.removeItem("cartCleared");
    location.reload(); // 💥 INI KUNCINYA
  }
});

/* =====================
   AUTO LOAD
===================== */
document.addEventListener("DOMContentLoaded", () => {
  updateCartUI();
  updateCartCount();
});
