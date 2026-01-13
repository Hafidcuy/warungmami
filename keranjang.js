/* ===============================
   CART STORAGE (SUMBER KEBENARAN)
================================ */
function getCart() {
  return JSON.parse(localStorage.getItem("cart")) || [];
}

function setCart(cart) {
  localStorage.setItem("cart", JSON.stringify(cart));
}

/* ===============================
   CART COUNT (NAVBAR)
================================ */
function updateCartCount() {
  const badge = document.getElementById("cartCount");
  if (!badge) return;

  const cart = getCart();
  const count = cart.reduce((t, i) => t + i.qty, 0);

  badge.innerText = count;
  badge.style.display = count > 0 ? "inline-block" : "none";
}

/* ===============================
   CART UI (HALAMAN KERANJANG)
================================ */
function updateCartUI() {
  const items = document.getElementById("cartItems");
  const total = document.getElementById("cartTotal");
  if (!items || !total) return;

  const cart = getCart();
  items.innerHTML = "";

  if (!cart.length) {
    items.innerHTML = "<p>Cart kosong</p>";
    total.innerText = "Total: Rp 0";
    return;
  }

  cart.forEach(item => {
    items.innerHTML += `
      <div class="cart-item">
        <span>${item.name}</span>
        <div>
          <button onclick="changeQty(${item.id}, -1)">−</button>
          <span>${item.qty}</span>
          <button onclick="changeQty(${item.id}, 1)">+</button>
        </div>
      </div>
    `;
  });

  total.innerText =
    "Total: Rp " +
    cart.reduce((t, i) => t + i.price * i.qty, 0);
}

/* ===============================
   ADD / UPDATE ITEM
================================ */
function addToCart(product) {
  if (!product || product.type !== "warung") return;

  const cart = getCart();
  const item = cart.find(i => i.id === product.id);

  if (item) item.qty++;
  else cart.push({ ...product, qty: 1 });

  setCart(cart);
  updateCartCount();
}

function changeQty(id, delta) {
  let cart = getCart();

  cart = cart
    .map(i =>
      i.id === id ? { ...i, qty: i.qty + delta } : i
    )
    .filter(i => i.qty > 0);

  setCart(cart);
  updateCartUI();
  updateCartCount();
}

/* ===============================
   CHECKOUT (INI KUNCI UTAMA)
================================ */
function checkout() {
  const cart = getCart();
  if (!cart.length) {
    alert("Cart kosong");
    return;
  }

  alert("Checkout berhasil!");

  // 🔥 HAPUS DATA ASLI
  localStorage.removeItem("cart");

  // 🔥 PAKSA UI & BADGE SINKRON
  updateCartUI();
  updateCartCount();
}

/* ===============================
   AUTO SYNC SEMUA HALAMAN
================================ */
window.addEventListener("pageshow", () => {
  updateCartCount();
  updateCartUI();
});
