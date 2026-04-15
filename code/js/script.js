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

function getCommentAge(createdAt) {
  const now = new Date();
  const created = new Date(createdAt);
  const diffMs = now - created;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + 'm ago';
  if (diffHours < 24) return diffHours + 'h ago';
  return diffDays + 'd ago';
}

function toggleNotifications() {
  const dropdown = document.getElementById('notificationDropdown');
  if (!dropdown) return;
  const isOpen = dropdown.classList.contains('open');
  if (!isOpen) {
    loadNotifications();
    dropdown.classList.add('open');
    markNotificationsRead();
  } else {
    dropdown.classList.remove('open');
  }
}

async function loadNotifications() {
  const userId = sessionStorage.getItem('user_id');
  if (!userId) return;
  const dropdown = document.getElementById('notificationDropdown');
  if (!dropdown) return;
  try {
    const res = await fetch(`/notifications/${userId}`);
    const notifications = await res.json();
    if (!notifications.length) {
      dropdown.innerHTML = '<p class="notification-empty">No notifications yet</p>';
      return;
    }
    dropdown.innerHTML = notifications.map(n => {
      const msg = n.type === 'like'
        ? `<a href="profile.html?user_id=${n.from_user_id}" style="color:#5F15D6;font-weight:bold;text-decoration:none;">${n.from_nickname}</a> liked your post`
        : `<a href="profile.html?user_id=${n.from_user_id}" style="color:#5F15D6;font-weight:bold;text-decoration:none;">${n.from_nickname}</a> commented on your post`;
      const dot = n.is_read ? '' : '<span class="notif-unread-dot"></span>';
      return `<div class="notification-item">${dot}<span>${msg}</span></div>`;
    }).join('');
  } catch (err) {
    console.error('Error loading notifications:', err);
  }
}

async function markNotificationsRead() {
  const userId = sessionStorage.getItem('user_id');
  if (!userId) return;
  try {
    await fetch(`/notifications/read/${userId}`, { method: 'POST' });
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = 'none';
  } catch (err) {
    console.error(err);
  }
}

async function checkUnreadNotifications() {
  const userId = sessionStorage.getItem('user_id');
  if (!userId) return;
  try {
    const res = await fetch(`/notifications/${userId}`);
    const notifications = await res.json();
    const hasUnread = notifications.some(n => !n.is_read);
    const badge = document.getElementById('notifBadge');
    if (badge) badge.style.display = hasUnread ? 'block' : 'none';
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener('click', function(e) {
  const wrapper = document.querySelector('.notification-wrapper');
  const dropdown = document.getElementById('notificationDropdown');
  if (wrapper && dropdown && !wrapper.contains(e.target)) {
    dropdown.classList.remove('open');
  }
});

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
  const feedContent = document.querySelector('.feed-content');
  if (feedContent) {
    fetch('/posts')
      .then(res => res.json())
      .then(posts => {
        posts.forEach(post => {
          const postCard = document.createElement('div');
          postCard.className = 'post-card';
          postCard.dataset.postId = post.post_id;
          postCard.innerHTML = `
  <div class="post-header">
    <div class="post-header-left">
      <a href="profile.html?user_id=${post.user_id}" style="color:#333;font-weight:600;text-decoration:none;font-size:0.95rem;">${post.nickname}</a>
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
    <button class="post-action-btn comment-toggle-btn">💬 Comment</button>
  </div>
  <div class="comments-section" style="display: none;">
    <div class="comments-list"></div>
    <div class="comment-input-row">
      <input type="text" class="comment-input" placeholder="Write a comment...">
      <button class="submit-comment-btn">Post</button>
    </div>
    <p class="comment-message"></p>
  </div>
`;

          const toggleBtn = postCard.querySelector(".comment-toggle-btn");
          const commentsSection = postCard.querySelector(".comments-section");
          const commentsList = postCard.querySelector(".comments-list");
          const submitBtn = postCard.querySelector(".submit-comment-btn");
          const commentInput = postCard.querySelector(".comment-input");
          const commentMessage = postCard.querySelector(".comment-message");
          const postId = parseInt(post.post_id, 10);
          const likeBtn = postCard.querySelector(".post-action-btn");
          const currentUserId = sessionStorage.getItem('user_id');

          async function loadLikes() {
            try {
              const res = await fetch(`/posts/${postId}/likes?user_id=${currentUserId}`);
              const data = await res.json();
              likeBtn.textContent = `👍 Like ${data.count}`;
              if (data.liked) {
                likeBtn.classList.add('liked');
              } else {
                likeBtn.classList.remove('liked');
              }
              likeBtn.dataset.liked = data.liked ? 'true' : 'false';
            } catch (err) {
              console.error('Error loading likes:', err);
            }
          }

          loadLikes();

          likeBtn.addEventListener('click', async () => {
            const isLiked = likeBtn.dataset.liked === 'true';
            try {
              const res = await fetch('/likes', {
                method: isLiked ? 'DELETE' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ post_id: postId, user_id: currentUserId })
              });
              const data = await res.json();
              if (data.success || (!isLiked && data.message === 'Already liked')) {
                await loadLikes();
              }
            } catch (err) {
              console.error('Error toggling like:', err);
            }
          });

          async function loadComments() {
            try {
              const response = await fetch(`/posts/${postId}/comments`);
              const comments = await response.json();
              commentsList.innerHTML = "";
              comments.forEach((comment) => {
                const p = document.createElement("p");
                p.style.display = "flex";
                p.style.justifyContent = "flex-start";
                p.style.alignItems = "center";
                p.innerHTML = `
                  <span style="font-size: 12px; color: #6b7280; margin-right: 8px; white-space: nowrap; font-weight: bold;">@${comment.nickname}</span>
                  <span style="flex: 1;">${comment.content}</span>
                  <span style="font-size: 11px; color: #9ca3af; margin-left: 12px; white-space: nowrap;">${getCommentAge(comment.created_at)}</span>
                `;
                commentsList.appendChild(p);
              });
            } catch (err) {
              commentMessage.textContent = "Error loading comments";
            }
          }

          toggleBtn.addEventListener("click", async () => {
            const isHidden = commentsSection.style.display === "none" || commentsSection.style.display === "";
            if (isHidden) {
              commentsSection.style.display = "block";
              await loadComments();
            } else {
              commentsSection.style.display = "none";
            }
          });

          submitBtn.addEventListener("click", async () => {
            const content = commentInput.value.trim();
            const userId = sessionStorage.getItem("user_id");
            if (!userId) {
              commentMessage.textContent = "You must be logged in to comment";
              return;
            }
            if (!content) {
              commentMessage.textContent = "Comment cannot be empty";
              return;
            }
            try {
              const response = await fetch("/comments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ post_id: postId, user_id: userId, content: content })
              });
              const result = await response.json();
              if (result.success) {
                commentInput.value = "";
                commentMessage.textContent = "Comment added";
                await loadComments();
              } else {
                commentMessage.textContent = result.message || "Error adding comment";
              }
            } catch (err) {
              commentMessage.textContent = "Network error";
            }
          });

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
  
async function loadHeaderAvatar() {
  try {
    // Fetch the current user
    const meRes = await fetch("/me", { credentials: "include" });
    if (!meRes.ok) return; // user not logged in
    const meData = await meRes.json();
    const userId = meData.user.user_id;

    // Fetch user info including profile picture
    const res = await fetch(`/api/users/${userId}`);
    if (!res.ok) return;
    const data = await res.json();

    // Set avatar
    const headerAvatar = document.getElementById("headerAvatar");
    if (headerAvatar) headerAvatar.src = data.filepath || "images/logo2.png";

    // Optionally set nickname
    const headerNickname = document.getElementById("headerNickname");
    if (headerNickname) headerNickname.textContent = data.nickname || "User";

  } catch (err) {
    console.error("Failed to load header avatar:", err);
  }
}

// Call it on page load
window.addEventListener("DOMContentLoaded", loadHeaderAvatar);
});