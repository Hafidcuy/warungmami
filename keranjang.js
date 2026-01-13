/* ==== CART DATA ==== */
let cart = JSON.parse(localStorage.getItem("cart")) || [];

/* ==== LOGIN CHECK ==== */
function checkLogin() {
  if (localStorage.getItem("isLogin") !== "true") {
    alert("Silakan login terlebih dahulu");
    location.href = "login.html";
  }
}

/* ==== USERNAME NAVBAR ==== */
function loadUser() {
  const el = document.getElementById("navUsername");
  if (el) el.innerText = localStorage.getItem("username") || "Guest";
}

/* ==== LOGOUT ==== */
function logout() {
  localStorage.removeItem("isLogin");
  localStorage.removeItem("username");
  location.href = "login.html";
}

/* ==== CART CORE ==== */
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function addToCart(product) {
  if (!product || product.type !== "warung") return;

  const item = cart.find(i => i.id === product.id);
  item ? item.qty++ : cart.push({ ...product, qty: 1 });

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
  return cart.reduce((total, item) => total + item.price * item.qty, 0);
}

/* ==== CART UI ==== */
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
        ${item.name} x${item.qty}
        <button onclick="removeFromCart(${item.id})">❌</button>
      </div>
    `;
  });

  total.innerText = "Total: Rp " + getTotal();
}

/* ==== CART BADGE ==== */
function updateCartCount() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;

  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  badge.innerText = count;
  badge.style.display = count ? "inline-block" : "none";
}

/* ==== CHECKOUT ==== */
function checkout() {
  checkLogin();

  if (!cart.length) {
    alert("Cart kosong");
    return;
  }

  alert("Checkout berhasil!\nTotal: Rp " + getTotal());

  cart = [];
  saveCart();
  updateCartUI();
  updateCartCount();
}

/* ==== AUTO LOAD ==== */
document.addEventListener("DOMContentLoaded", () => {
  saveLastPage();
  checkLogin();
  loadUser();
  updateCartUI();
  updateCartCount();
});
function saveLastPage() {
  localStorage.setItem("lastPage", location.pathname);
}

function checkout() {
  // 1. Hapus data keranjang
  localStorage.removeItem("cart");

  // 2. Reset angka cart
  const cartCount = document.getElementById("cartCount");
  if (cartCount) cartCount.innerText = "0";

  // 3. Kosongkan tampilan keranjang (jika ada)
  const cartContainer = document.getElementById("cartItems");
  if (cartContainer) cartContainer.innerHTML = "";
