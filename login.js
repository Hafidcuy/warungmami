function login() {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const errorMsg = document.getElementById("errorMsg");

  // daftar akun (bisa ditambah)
  let users = JSON.parse(localStorage.getItem("users"));

  // set akun default jika belum ada
  if (!users) {
    users = [
      { username: "admin", password: "12345", role: "admin" },
      { username: "rapa", password: "alasantok", role: "user" }
    ];
    localStorage.setItem("users", JSON.stringify(users));
  }

  // cek login
  const user = users.find(
    u => u.username === username && u.password === password
  );

  if (user) {
    localStorage.setItem("isLogin", "true");
    localStorage.setItem("username", user.username);
    localStorage.setItem("role", user.role);

    alert("Login berhasil!");
    window.location.href = "index.html"; // arahkan ke warung
  } else {
    errorMsg.style.display = "block";
  }
}

/* =====================
   CART BADGE (AMAN)
===================== */
window.addEventListener("pageshow", () => {
  if (typeof updateCartCount === "function") {
    updateCartCount();
  }
});
