// ===== Halaman Login / Register Warung Mami =====

const tabLogin = document.getElementById("tabLogin");
const tabRegister = document.getElementById("tabRegister");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginError = document.getElementById("loginError");
const regError = document.getElementById("regError");

// Tujuan setelah berhasil masuk
const NEXT = new URLSearchParams(location.search).get("next") || "/index.html";

function showTab(which) {
  const isLogin = which === "login";
  tabLogin.classList.toggle("active", isLogin);
  tabRegister.classList.toggle("active", !isLogin);
  loginForm.classList.toggle("hidden", !isLogin);
  registerForm.classList.toggle("hidden", isLogin);
  loginError.textContent = "";
  regError.textContent = "";
}

tabLogin.addEventListener("click", () => showTab("login"));
tabRegister.addEventListener("click", () => showTab("register"));

// Isi otomatis dari kotak akun demo sudah dihapus (tidak ada akun demo).

function destinationFor(user) {
  if (user.role === "admin") return "/admin/admin.html";
  if (user.role === "courier") return "/kurir/kurir.html";
  return NEXT;
}

// ===== Login =====
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("loginBtn");
  loginError.textContent = "";
  btn.disabled = true;
  btn.textContent = "Memproses...";
  try {
    const { user } = await API.post("/login", {
      email: document.getElementById("loginEmail").value.trim(),
      password: document.getElementById("loginPassword").value,
    });
    window.location.href = destinationFor(user);
  } catch (err) {
    loginError.textContent = err.message;
    btn.disabled = false;
    btn.textContent = "Masuk";
  }
});

// ===== Register =====
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = document.getElementById("regBtn");
  regError.textContent = "";
  btn.disabled = true;
  btn.textContent = "Memproses...";
  try {
    await API.post("/register", {
      name: document.getElementById("regName").value.trim(),
      phone: document.getElementById("regPhone").value.trim(),
      email: document.getElementById("regEmail").value.trim(),
      password: document.getElementById("regPassword").value,
    });
    window.location.href = "/index.html";
  } catch (err) {
    regError.textContent = err.message;
    btn.disabled = false;
    btn.textContent = "Daftar";
  }
});

// ===== Tampilkan / sembunyikan password =====
document.querySelectorAll("[data-pw-toggle]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.getAttribute("data-pw-toggle"));
    if (!input) return;
    const showing = input.type !== "password";
    input.type = showing ? "password" : "text";
    if (typeof ico === "function") {
      btn.innerHTML = ico(showing ? "eye" : "eye-off");
    }
    btn.setAttribute(
      "aria-label",
      showing ? "Tampilkan password" : "Sembunyikan password"
    );
    input.focus();
  });
});

// Kalau sudah login, langsung ke tujuan
(async () => {
  try {
    const { user } = await API.get("/me");
    if (user) window.location.href = destinationFor(user);
  } catch (_) { /* biarkan, tampilkan form login */ }
})();
