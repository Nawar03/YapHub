const express = require('express');
const mysql = require('mysql2');
const crypto = require('crypto');
const session = require('express-session');
const multer = require('multer');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

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
  host: process.env.MYSQLHOST,
  user: process.env.MYSQLUSER,
  password: process.env.MYSQLPASSWORD,
  database: process.env.MYSQLDATABASE,
  port: process.env.MYSQLPORT || 3306
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
      u.email,
      b.bio,
      (SELECT COUNT(*) FROM follows WHERE following_id = u.user_id) AS followers,
      (SELECT COUNT(*) FROM follows WHERE follower_id = u.user_id) AS following,
      (SELECT filepath FROM profile_pictures WHERE user_id = u.user_id ORDER BY uploaded_at DESC LIMIT 1) AS filepath,
      (SELECT filepath FROM banner_pictures WHERE user_id = u.user_id ORDER BY uploaded_at DESC LIMIT 1) AS banner_filepath
     FROM users u
     LEFT JOIN bios b ON u.user_id = b.user_id
     WHERE u.user_id = ?`,
    [userId],
    (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ error: "Server error" }); }
      if (results.length === 0) {
        return res.status(404).json({ error: "User not found" }); }
      res.json(results[0]);
    }
  );
});
function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

// UPDATING USER INFO
app.put("/api/users/:user_id", async (req, res) => {
  const userId = req.params.user_id;
  const { first_name, last_name, nickname, email, password, bio } = req.body;

  try {
    // Start building query
    let query = `
      UPDATE users 
      SET first_name=?, last_name=?, nickname=?, email=?
    `;
    let values = [first_name, last_name, nickname, email];

    // Only update password if provided
    if (password) {
      const hashedPassword = hashPassword(password);
      query += `, password=?`;
      values.push(hashedPassword);
    }

    query += ` WHERE user_id=?`;
    values.push(userId);

    // Update users table
    await db.promise().query(query, values);

    // Update bio table
    await db.promise().query(
      `INSERT INTO bios (user_id, bio)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE bio = VALUES(bio)`,
      [userId, bio]
    );

    res.json({ message: "Profile updated successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

//Storage for images
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage: storage });

//Storage for banners
const bannerStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/banners');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const uploadBanner = multer({ storage: bannerStorage });

const fs = require('fs');

//route for profile picture
app.post('/api/users/:user_id/avatar', upload.single('avatar'), async (req, res) => {
  const userId = req.params.user_id;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = `/uploads/avatars/${req.file.filename}`;

  try {
    // Get old profile picture
    const [rows] = await db.promise().query(
      `SELECT filepath FROM profile_pictures WHERE user_id = ?`,
      [userId]
    );

    // Delete old file from disk
    if (rows.length > 0 && rows[0].filepath) {
      const oldPath = path.join(
        __dirname,
        rows[0].filepath.replace('/uploads/', 'uploads/')
      );

      fs.unlink(oldPath, (err) => {
        if (err) {
          console.log("Could not delete old image:", err.message);
        }
      });
    }

    // Delete old DB row
    await db.promise().query(
      `DELETE FROM profile_pictures WHERE user_id = ?`,
      [userId]
    );

    // Insert new profile picture
    await db.promise().query(
      `INSERT INTO profile_pictures (user_id, filename, filepath)
       VALUES (?, ?, ?)`,
      [userId, req.file.filename, filePath]
    );

    res.json({ message: 'Profile picture updated', path: filePath });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

//route for banner pictures
app.post('/api/users/:user_id/banner', uploadBanner.single('banner'), async (req, res) => {
  const userId = req.params.user_id;

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const filePath = `/uploads/banners/${req.file.filename}`;

  try {
    // Get old banner
    const [rows] = await db.promise().query(
      `SELECT filepath FROM banner_pictures WHERE user_id = ?`,
      [userId]
    );

    // Delete old file
    if (rows.length > 0 && rows[0].filepath) {
      const oldPath = path.join(
        __dirname,
        rows[0].filepath.replace('/uploads/', 'uploads/')
      );

      fs.unlink(oldPath, (err) => {
        if (err) console.log("Could not delete old banner:", err.message);
      });
    }

    // Remove old DB record
    await db.promise().query(
      `DELETE FROM banner_pictures WHERE user_id = ?`,
      [userId]
    );

    // Insert new banner
    await db.promise().query(
      `INSERT INTO banner_pictures (user_id, filename, filepath)
       VALUES (?, ?, ?)`,
      [userId, req.file.filename, filePath]
    );

    res.json({ message: 'Banner updated', path: filePath });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
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
    SELECT posts.post_id, posts.user_id, posts.content, posts.created_at, posts.expires_at, users.nickname
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
  SELECT comments.comment_id, comments.content, comments.created_at, users.nickname, comments.user_id
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
    res.json({ success: true, comment_id: results.insertId });
    const getPostOwnerSql2 = `SELECT user_id FROM posts WHERE post_id = ?`;
    db.query(getPostOwnerSql2, [post_id], (err2, rows) => {
      if (!err2 && rows.length > 0 && rows[0].user_id != parseInt(user_id, 10)) {
        const notifSql = `INSERT INTO notifications (user_id, from_user_id, type, post_id) VALUES (?, ?, 'comment', ?)`;
        db.query(notifSql, [rows[0].user_id, user_id, post_id], () => {});
      }
    });
  });
});

// GET /trending-posts - Get posts ordered by like count
app.get('/trending-posts', (req, res) => {
  const sql = `
    SELECT posts.post_id, posts.user_id, posts.content, posts.created_at, posts.expires_at, users.nickname,
      COUNT(likes.like_id) AS like_count
    FROM posts
    JOIN users ON posts.user_id = users.user_id
    LEFT JOIN likes ON posts.post_id = likes.post_id
    WHERE posts.expires_at > NOW()
    GROUP BY posts.post_id, posts.content, posts.created_at, posts.expires_at, users.nickname
    ORDER BY like_count DESC, posts.created_at DESC
  `;
  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    return res.json(results);
  });
});

// GET /following-posts - Get posts from followed users
app.get('/following-posts', (req, res) => {
  const userId = req.query.user_id;
  const sql = `
    SELECT posts.post_id, posts.user_id, posts.content, posts.created_at, posts.expires_at, users.nickname
    FROM posts
    JOIN users ON posts.user_id = users.user_id
    JOIN follows ON posts.user_id = follows.following_id
    WHERE follows.follower_id = ?
    AND posts.expires_at > NOW()
    ORDER BY posts.created_at DESC
  `;
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    return res.json(results);
  });
});

// POST /likes - Add a like
app.post('/likes', (req, res) => {
  const { post_id, user_id } = req.body;
  const sql = `INSERT INTO likes (post_id, user_id) VALUES (?, ?)`;
  db.query(sql, [post_id, user_id], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.json({ success: false, message: 'Already liked' });
      }
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true });
    const getPostOwnerSql = `SELECT user_id FROM posts WHERE post_id = ?`;
    db.query(getPostOwnerSql, [post_id], (err2, rows) => {
      if (!err2 && rows.length > 0 && rows[0].user_id != user_id) {
        const notifSql = `INSERT INTO notifications (user_id, from_user_id, type, post_id) VALUES (?, ?, 'like', ?)`;
        db.query(notifSql, [rows[0].user_id, user_id, post_id], () => {});
      }
    });
  });
});

// DELETE /likes - Remove a like
app.delete('/likes', (req, res) => {
  const { post_id, user_id } = req.body;
  const sql = `DELETE FROM likes WHERE post_id = ? AND user_id = ?`;
  db.query(sql, [post_id, user_id], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    return res.json({ success: true });
  });
});

// GET /posts/:post_id/likes - Get like count and whether user liked
app.get('/posts/:post_id/likes', (req, res) => {
  const postId = req.params.post_id;
  const userId = req.query.user_id;
  const sql = `
    SELECT COUNT(*) AS count,
      SUM(CASE WHEN user_id = ? THEN 1 ELSE 0 END) AS user_liked
    FROM likes
    WHERE post_id = ?
  `;
  db.query(sql, [userId, postId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    const row = results[0];
    return res.json({ count: row.count, liked: row.user_liked > 0 });
  });
});

app.get("/api/suggestions/:user_id", (req, res) => {
  const userId = req.params.user_id;
  const sql = `
    SELECT user_id, nickname
    FROM users
    WHERE user_id != ?
    AND user_id NOT IN (
      SELECT following_id FROM follows WHERE follower_id = ?
    )
    ORDER BY RAND()
    LIMIT 5
  `;
  db.query(sql, [userId, userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Database error" });
    }
    res.json(results);
  });
});

// GET /notifications/:user_id - get notifications for a user
app.get('/notifications/:user_id', (req, res) => {
  const userId = req.params.user_id;
  const sql = `
    SELECT n.notification_id, n.type, n.is_read, n.created_at,
           u.nickname as from_nickname, u.user_id as from_user_id, n.post_id
    FROM notifications n
    JOIN users u ON n.from_user_id = u.user_id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 20
  `;
  db.query(sql, [userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(results);
  });
});

// POST /notifications/read/:user_id - mark all notifications as read
app.post('/notifications/read/:user_id', (req, res) => {
  const userId = req.params.user_id;
  const sql = `UPDATE notifications SET is_read = 1 WHERE user_id = ?`;
  db.query(sql, [userId], (err) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json({ success: true });
  });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

