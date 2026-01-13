function login() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const errorMsg = document.getElementById("errorMsg");

    // LOGIN SEDERHANA (BISA KAMU GANTI)
    if (username === "admin" && password === "12345" && username === "rapa" && password === "alasantok") {
      localStorage.setItem("isLogin", "true");
      localStorage.setItem("username", username);

      alert("Login berhasil!");
      window.location.href = "index.html"; // arahkan ke warung
    } else {
      errorMsg.style.display = "block";
    }

  }
window.addEventListener("pageshow", () => {
  updateCartCount();
});


