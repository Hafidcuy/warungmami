/* =====================
   CART DATA
===================== */
let cart = JSON.parse(localStorage.getItem("cart")) || [];

/* =====================
   LOGIN SYSTEM
===================== */
function checkLogin() {
  if (localStorage.getItem("isLogin") !== "true") {
    alert("Silakan login terlebih dahulu");
    location.href = "login.html";
  }
}

function loadUser() {
  const el = document.getElementById("navUsername");
  if (el) el.innerText = localStorage.getItem("username") || "Guest";
}

function logout() {
  localStorage.removeItem("isLogin");
  localStorage.removeItem("username");
  location.href = "login.html";
}

/* =====================
   SAVE CART
===================== */
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

/* =====================
   CART COUNT (BADGE)
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
        <button onclick="removeFromCart(${item.id})">❌</button>
      </div>
    `;
  });

  total.innerText = "Total: Rp " + getTotal();
}

/* =====================
   CART CORE
===================== */
function addToCart(product) {
  // hanya produk warung
  if (product?.type !== "warung") return;

  const item = cart.find(i => i.id === product.id);
  item ? item.qty++ : cart.push({ ...product, qty: 1 });

  saveCart();
  updateCartUI();
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

function removeFromCart(id) {
  cart = cart.filter(i => i.id !== id);
  saveCart();
  updateCartUI();
  updateCartCount();
}

function getTotal() {
  return cart.reduce((t, i) => t + i.price * i.qty, 0);
}

/* =====================
   CHECKOUT
===================== */
function checkout() {
  checkLogin();

  if (!cart.length) {
    alert("Cart kosong");
    return;
  }

  alert("Checkout berhasil!\nTotal: Rp " + getTotal());

  cart = [];
  localStorage.removeItem("cart");

  // paksa refresh halaman lain
  localStorage.setItem("forceReload", "true");

  updateCartUI();
  updateCartCount();
}

/* =====================
   AUTO REFRESH SETELAH CHECKOUT
===================== */
window.addEventListener("pageshow", () => {
  if (localStorage.getItem("forceReload") === "true") {
    localStorage.removeItem("forceReload");
    location.reload();
  }
});

/* =====================
   LAST PAGE
===================== */
function saveLastPage() {
  localStorage.setItem("lastPage", location.pathname);
}

/* =====================
   AUTO LOAD
===================== */
document.addEventListener("DOMContentLoaded", () => {
  saveLastPage();
  loadUser();
  updateCartUI();
  updateCartCount();
});
