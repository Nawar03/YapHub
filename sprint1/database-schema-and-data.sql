USE yaphub;

DROP TABLE IF EXISTS comments;
DROP TABLE IF EXISTS posts;
DROP TABLE IF EXISTS follows;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS likes;

CREATE TABLE users (
  user_id INT NOT NULL AUTO_INCREMENT,
  first_name VARCHAR(150) NOT NULL,
  last_name VARCHAR(150) NOT NULL,
  nickname VARCHAR(100) NOT NULL,
  email VARCHAR(300) NOT NULL,
  password VARCHAR(250) NOT NULL,
  PRIMARY KEY (user_id),
  UNIQUE (nickname),
  UNIQUE (email)
);


CREATE TABLE follows (
  follow_id INT NOT NULL AUTO_INCREMENT,
  follower_id INT NOT NULL,
  following_id INT NOT NULL,
  PRIMARY KEY (follow_id),
  UNIQUE (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(user_id),
  FOREIGN KEY (following_id) REFERENCES users(user_id)
);


CREATE TABLE posts (
  post_id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  content VARCHAR(1000) NOT NULL,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  PRIMARY KEY (post_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE comments (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  content VARCHAR(500) NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE likes (
  like_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT NOW(),
  UNIQUE (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(user_id)
);

CREATE TABLE notifications (
  notification_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  from_user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  post_id INT,
  is_read TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(user_id),
  FOREIGN KEY (from_user_id) REFERENCES users(user_id),
  FOREIGN KEY (post_id) REFERENCES posts(post_id) ON DELETE CASCADE
);

CREATE TABLE banner_pictures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

SHOW TABLES;

-- ============================================
-- Auto Delete Expired Posts Event
-- ============================================
-- Automatically deletes posts older than 24 hours.
-- Run this once after creating the tables.
-- ============================================

-- Disable safe update mode
SET SQL_SAFE_UPDATES = 0;

-- Enable the MySQL event scheduler
SET GLOBAL event_scheduler = ON;

-- Create the auto-delete event
DROP EVENT IF EXISTS delete_expired_posts;
CREATE EVENT delete_expired_posts
ON SCHEDULE EVERY 1 MINUTE
DO
  DELETE FROM posts WHERE expires_at < NOW();

-- Verify the event is active (should show ENABLED)
SHOW EVENTS;

-- Re-enable safe update mode
SET SQL_SAFE_UPDATES = 1;
