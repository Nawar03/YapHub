const express = require('express');
const mysql = require('mysql2');
const crypto = require('crypto');

const app = express();
const port = 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Serve frontend from /code folder
app.use(express.static('code'));

// Serve images folder
app.use('/images', express.static('images'));

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'Almuohi6093@',
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
      console.error(err);
      return res.status(500).json({ success: false, message: 'Server error' });
    }

    if (results.length > 0) {
      return res.json({ success: true, user: results[0] });
    }

    return res.status(401).json({ success: false, message: 'Invalid credentials' });
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

  const sql = "SELECT * FROM comments WHERE post_id = ?";

  db.query(sql, [postId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).send("Database error");
    }
    res.json(results);
  });
});

// POST /comments - Add a new comment
app.post('/comments', (req, res) => {
  const { post_id, user_id, content } = req.body;

  if (!post_id || !user_id || !content || content.trim() === '') {
    return res.status(400).json({ success: false, message: 'Missing or empty fields' });
  }

  const sql = `
    INSERT INTO comments (post_id, user_id, content, created_at)
    VALUES (?, ?, ?, NOW())
  `;

  db.query(sql, [post_id, user_id, content.trim()], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    return res.json({ success: true });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

