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
  return cart.reduce((t, i) => t + i.price * i.qty, 0);
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

  cart.forEach(i => {
    items.innerHTML += `
      <div>
        ${i.name} x${i.qty}
        <button onclick="removeFromCart(${i.id})">❌</button>
      </div>`;
  });

  total.innerText = "Total: Rp " + getTotal();
}

/* ==== CART BADGE ==== */
function updateCartCount() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;

  const count = cart.reduce((s, i) => s + i.qty, 0);
  badge.innerText = count;
  badge.style.display = count ? "inline-block" : "none";
}

/* ==== CHECKOUT ==== */
function checkout() {
  checkLogin();

  if (!cart.length) return alert("Cart kosong");

  alert("Checkout berhasil!\nTotal: Rp " + getTotal());
  cart = [];
  saveCart();
  updateCartUI();
  updateCartCount();
}

/* ==== AUTO LOAD ==== */
document.addEventListener("DOMContentLoaded", () => {
  checkLogin();
  loadUser();
  updateCartUI();
  updateCartCount();
});
