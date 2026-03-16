document.addEventListener("DOMContentLoaded", () => {
  // SIGN UP
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const payload = {
        first_name: document.getElementById("firstname")?.value.trim(),
        last_name: document.getElementById("lastname")?.value.trim(),
        nickname: document.getElementById("nickname")?.value.trim(),
        email: document.getElementById("email")?.value.trim(),
        password: document.getElementById("password")?.value
      };

      try {
        const res = await fetch("/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          alert("Account created!");
          window.location.href = "feed.html";
        } else {
          const msg = await res.text();
          alert("Sign up failed: " + msg);
        }
      } catch (err) {
        alert("Network error: " + err.message);
      }
    });
  } 

  // LOG IN
  const loginBtn = document.getElementById("loginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", async () => {
      const email = document.getElementById("loginEmail")?.value.trim();
      const password = document.getElementById("loginPassword")?.value;

      try {
        const res = await fetch("/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (data.success) {
          window.location.href = "feed.html";
        } else {
          alert("Wrong email or password");
        }
      } catch (err) {
        alert("Network error: " + err.message);
      }
    });
  }

async function goToProfile(nickname) {

  try {
    const res = await fetch(`/api/users/nickname/${encodeURIComponent(nickname)}`);
    if (!res.ok) {
      alert("User not found");
      return; }

    const userData = await res.json();

    // check logged in user
    const meRes = await fetch("/me", { credentials: "include" });
    const meData = await meRes.json();

    if (meData.loggedIn && meData.user.user_id === userData.user_id) {
      window.location.href = "myProfile.html";}
    else {
      window.location.href = `profile.html?user_id=${userData.user_id}`; }
  } catch (err) {
    console.error("Search error:", err); }
}

//this keeps the username in the top
async function loadUser() {
  try {
    const res = await fetch("/me", 
    {
      credentials: "include" });
    if (!res.ok) return;

    const data = await res.json();

    if (data.loggedIn) {
      const nicknameHeader = document.getElementById("myNickname");
      if (nicknameHeader) {
        nicknameHeader.textContent = data.user.nickname; }
    }
  } 
  catch (err) {
    console.error("Could not get user:", err); }
}

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    try {
      const res = await fetch("/logout", {
        method: "POST",
        credentials: "include"
      });
      if (res.ok) {
        window.location.href = "index.html"; }
    } catch (err) {
      console.error("Logout failed:", err); }
  });
}

const followBtn = document.getElementById("followBtn");

if (followBtn) {
  followBtn.addEventListener("click", async () => {
    try {
      const res = await fetch(`/api/follow/${userId}`, {
        method: "POST",
        credentials: "include"
      });
      const data = await res.json();
      if (data.success) {
        followBtn.textContent = "Following";
      }

    } catch (err) {
      console.error("Follow failed:", err); }
  });
}
  loadUser();
});