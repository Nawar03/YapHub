const express = require('express');
const mysql = require('mysql2');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(
  session({
    secret: 'super-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true }
  })
);

// Serve frontend from /code folder
app.use(express.static('code'));

// Serve images folder
app.use('/images', express.static('images'));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Elmomo123!',
  database: 'yaphub'
});

// Test route
app.get('/hello-user', (req, res) => {
  const sql = 'SELECT * FROM users LIMIT 1';

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    if (results.length === 0) {
      return res.send('No users found');
    }
    const user = results[0];
    res.send(`Hello, ${user.first_name}!`);
  });
});

// Create user (signup)
app.post('/create-user', (req, res) => {
  const { first_name, last_name, nickname, email, password } = req.body;

  if (!first_name || !last_name || !nickname || !email || !password) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }

  const hashedPassword = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

  const sql = `
    INSERT INTO users (first_name, last_name, nickname, email, password)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(sql, [first_name, last_name, nickname, email, hashedPassword], (err) => {
    if (err) {
      console.error(err);
      // Duplicate email/nickname
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, message: 'Email or nickname already exists' });
      }
      return res.status(500).json({ success: false, message: 'Error User Creation' });
    }
    return res.json({ success: true });
  });
});

// Login
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Missing email or password' });
  }

  const hashedPassword = crypto
    .createHash('sha256')
    .update(password)
    .digest('hex');

  const sql = `
    SELECT user_id, nickname, email
    FROM users
    WHERE email = ? AND password = ?
    LIMIT 1
  `;

  db.query(sql, [email, hashedPassword], (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results.length > 0) {
      req.session.user = results[0];
      return res.json({ success: true, user: results[0] });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  });
});

app.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ loggedIn: false }); }
  res.json({
    loggedIn: true,
    user: req.session.user
  });
});

// ROUTE FOR LOGOUT
app.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ success: false }); }
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

// SEARCHES USERS IN SEARCH BAR
app.get("/api/search/users", (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.json([]);
  }

  const sql = `
    SELECT user_id, nickname
    FROM users
    WHERE nickname LIKE ?
    LIMIT 5
  `;

  db.query(sql, [`${query}%`], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }

    res.json(results); 
  })
});

// GET USER PROFILE / INFO BY ID 
app.get("/api/users/:user_id", (req, res) => {
  const userId = req.params.user_id;
  db.query(
    `SELECT 
      u.user_id,
      u.nickname,
      u.first_name,
      u.last_name,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id) AS following
     FROM users u
     WHERE u.user_id = ?`,
    [userId],
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Server error" }); }
      if (results.length === 0) {
        return res.status(404).json({ error: "User not found" }); }
      results[0].is_following = Number(results[0].is_following);
      res.json(results[0]);
    }
  );
});

// FOLLOW ROUTE
app.post("/api/follow/:id", (req, res) => {

  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" }); }
  const followerId = parseInt(req.session.user.user_id, 10);
  const followingId = parseInt(req.params.id, 10);
  const sql = `
    INSERT IGNORE INTO follows (follower_id, following_id)
    VALUES (?, ?)
  `;
  db.query(sql, [followerId, followingId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" }); }
    res.json({ success: true });
  });
});

// UNFOLLOW ROUTE
app.post("/api/unfollow/:id", (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: "Not logged in" }); }
  const followerId = req.session.user.user_id;
  const followingId = req.params.id;
  const sql = `
    DELETE FROM follows
    WHERE follower_id = ? AND following_id = ?
  `;
  db.query(sql, [followerId, followingId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" }); }
    res.json({ success: true });
  });
});

// Check if logged-in user is following a profile
app.get("/api/follows/check/:profileId", (req, res) => {
  if (!req.session.user) return res.json({ isFollowing: false });
  const followerId = req.session.user.user_id;
  const followingId = parseInt(req.params.profileId, 10);
  const sql = `
    SELECT 1 FROM follows
    WHERE follower_id = ? AND following_id = ?
    LIMIT 1
  `;
  db.query(sql, [followerId, followingId], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ error: "Database error" }); }
    res.json({ isFollowing: results.length > 0 });
  });
});
// gets the user's followers
app.get("/api/followers/:user_id", (req, res) => {
  const userId = req.params.user_id;

  const sql = `
    SELECT u.user_id, u.nickname
    FROM follows f
    JOIN users u ON f.follower_id = u.user_id
    WHERE f.following_id = ?
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});
// gets the user's following
app.get("/api/following/:user_id", (req, res) => {
  const userId = req.params.user_id;

  const sql = `
    SELECT u.user_id, u.nickname
    FROM follows f
    JOIN users u ON f.following_id = u.user_id
    WHERE f.follower_id = ?
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});
// POST /posts - Create a new post
app.post('/posts', (req, res) => {
  const { user_id, content } = req.body;

  if (!user_id || !content) {
    return res.status(400).json({ success: false, message: 'Missing user_id or content' });
  }

  const sql = `
    INSERT INTO posts (user_id, content, created_at, expires_at)
    VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 DAY))
  `;

  db.query(sql, [user_id, content], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    return res.json({ success: true });
  });
});

// GET /posts - Retrieve non-expired posts
app.get('/posts', (req, res) => {
  const sql = `
    SELECT posts.post_id, posts.content, posts.created_at, posts.expires_at, users.nickname
    FROM posts
    JOIN users ON posts.user_id = users.user_id
    WHERE posts.expires_at > NOW()
    ORDER BY posts.created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    return res.json(results);
  });
});


/// GET /posts/:post_id/comments - Get comments for a post
app.get('/posts/:post_id/comments', (req, res) => {
  const postId = req.params.post_id;
  const sql = `
  SELECT comments.comment_id, comments.content, comments.created_at, users.nickname
  FROM comments
  JOIN users ON comments.user_id = users.user_id
  WHERE comments.post_id = ?
  ORDER BY comments.comment_id DESC
`;
  db.query(sql, [postId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Database error');
    }
    res.json(results);
  });
});

// POST /comments - Add a new comment
app.post('/comments', (req, res) => {
  const { post_id, user_id, content } = req.body;
  if (!post_id || !user_id || !content || content.trim() === '') {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }
  const sql = `INSERT INTO comments (post_id, user_id, content, created_at) VALUES (?, ?, ?, NOW())`;
  db.query(sql, [post_id, user_id, content], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    return res.json({ success: true, comment_id: results.insertId });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

