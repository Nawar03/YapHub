function getTimeLeft(expiresAt) {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires - now;

  if (diffMs <= 0) return 'Expired';

  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;

  if (diffMins < 1) return '< 1m';
  if (diffMins < 60) return diffMins + 'm';
  return diffHours + 'h ' + String(remainingMins).padStart(2, '0') + 'min';
}

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
          alert("Account created! Please log in.");
          window.location.href = "index.html";
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
          sessionStorage.setItem('user_id', data.user.user_id);
          sessionStorage.setItem('nickname', data.user.nickname);
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
      const nicknameHeader = document.getElementById("headerNickname");
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
  const feedContent = document.querySelector('.feed-content');
  if (feedContent) {
    fetch('/posts')
      .then(res => res.json())
      .then(posts => {
        posts.forEach(post => {
          const postCard = document.createElement('div');
          postCard.className = 'post-card';
          postCard.innerHTML = `
            <div class="post-header">
              <div class="post-header-left">
                <span class="post-nickname">${post.nickname}</span>
              </div>
              <div class="post-header-right">
                <span class="post-time">${getTimeLeft(post.expires_at)}</span>
              </div>
            </div>
            <div class="post-body">
              <p class="post-text">${post.content}</p>
            </div>
            <div class="post-actions">
              <button class="post-action-btn">👍 Like</button>
              <button class="post-action-btn">💬 Comment</button>
            </div>
          `;
          feedContent.appendChild(postCard);
        });

        setInterval(() => {
          const timeSpans = document.querySelectorAll('.post-time');
          posts.forEach((post, index) => {
            if (timeSpans[index]) {
              timeSpans[index].textContent = getTimeLeft(post.expires_at);
            }
          });
        }, 60000);
      })
      .catch(err => console.error('Error loading posts:', err));
  }
});