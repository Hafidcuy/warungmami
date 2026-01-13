/* =========================
   CART DATA (SINGLE SOURCE)
========================= */
let cart = JSON.parse(localStorage.getItem("cart")) || [];

/* =========================
   LOGIN
========================= */
function checkLogin() {
  if (localStorage.getItem("isLogin") !== "true") {
    alert("Silakan login terlebih dahulu");
    location.href = "login.html";
  }
}

/* =========================
   USER NAVBAR
========================= */
function loadUser() {
  const el = document.getElementById("navUsername");
  if (el) el.innerText = localStorage.getItem("username") || "Guest";
}

function logout() {
  localStorage.removeItem("isLogin");
  localStorage.removeItem("username");
  location.href = "login.html";
}

/* =========================
   CART CORE
========================= */
function saveCart() {
  localStorage.setItem("cart", JSON.stringify(cart));
}

function syncCart() {
  cart = JSON.parse(localStorage.getItem("cart")) || [];
}

function addToCart(product) {
  if (!product || product.type !== "warung") return;

  const item = cart.find(i => i.id === product.id);
  if (item) {
    item.qty++;
  } else {
    cart.push({ ...product, qty: 1 });
  }

  saveCart();
  updateCartUI();
  updateCartCount();
}

function increaseQty(id) {
  const item = cart.find(i => i.id === id);
  if (!item) return;

  item.qty++;
  saveCart();
  updateCartUI();
  updateCartCount();
}

function decreaseQty(id) {
  const item = cart.find(i => i.id === id);
  if (!item) return;

  item.qty--;
  if (item.qty <= 0) {
    cart = cart.filter(i => i.id !== id);
  }

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

/* =========================
   CART UI
========================= */
function updateCartUI() {
  const items = document.getElementById("cartItems");
  const total = document.getElementById("cartTotal");

  if (!items || !total) return;

  items.innerHTML = "";

  if (!cart.length) {
    items.innerHTML = "<p>Keranjang kosong</p>";
    total.innerText = "Total: Rp 0";
    return;
  }

  cart.forEach(item => {
    items.innerHTML += `
      <div class="cart-item">
        <span>${item.name}</span>
        <div class="qty-control">
          <button onclick="decreaseQty(${item.id})">−</button>
          <span>${item.qty}</span>
          <button onclick="increaseQty(${item.id})">+</button>
        </div>
        <span>Rp ${item.price * item.qty}</span>
      </div>
    `;
  });

  total.innerText = "Total: Rp " + getTotal();
}

/* =========================
   CART BADGE (ANTI BUG)
========================= */
function updateCartCount() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;

  // ⬅️ BACA LANGSUNG DARI localStorage
  const cartData = JSON.parse(localStorage.getItem("cart")) || [];
  const count = cartData.reduce((sum, item) => sum + item.qty, 0);

  badge.innerText = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}

/* =========================
   CHECKOUT (FINAL FIX)
========================= */
function checkout() {
  checkLogin();

  const cartData = JSON.parse(localStorage.getItem("cart")) || [];
  if (!cartData.length) {
    alert("Keranjang kosong");
    return;
  }

  alert("Checkout berhasil!\nTotal: Rp " + getTotal());

  // 🔥 BERSIHKAN CART TOTAL
  localStorage.removeItem("cart");
  cart = [];

  // 🔥 SINKRON SEMUA HALAMAN
  updateCartUI();
  updateCartCount();
}

/* =========================
   AUTO LOAD (WAJIB)
========================= */
document.addEventListener("DOMContentLoaded", () => {
  syncCart();
  loadUser();
  updateCartUI();
  updateCartCount();
});
