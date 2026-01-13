/* =====================
   LOGIN SYSTEM (FINAL)
===================== */
function login() {
  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;
  const errorMsg = document.getElementById("errorMsg");

  // ambil data user dari localStorage
  const users = JSON.parse(localStorage.getItem("users")) || [
    { username: "adminrama", password: "ganteng", role: "admin" },
    { username: "rapa", password: "alasantok", role: "user" }
    { username: "dimas", password: "mboh", role: "user" }
  ];

  // simpan default user jika belum ada
  localStorage.setItem("users", JSON.stringify(users));

  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (!user) {
    errorMsg.style.display = "block";
    return;
  }

  // login sukses
  localStorage.setItem("isLogin", "true");
  localStorage.setItem("username", user.username);
  localStorage.setItem("role", user.role);

  errorMsg.style.display = "none";
  alert("Login berhasil!");

  window.location.href = "index.html";
}

/* =====================
   CART BADGE FIX
===================== */
window.addEventListener("pageshow", () => {
  if (typeof updateCartCount === "function") {
    updateCartCount();
  }
});
