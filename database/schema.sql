--Table for users

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    nickname VARCHAR(50) UNIQUE,
    email VARCHAR(100) UNIQUE,
    password VARCHAR(255)
);

--Table for posts 
CREATE TABLE posts (
    post_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    content VARCHAR(1000),
  created_at DATE,
  expires_at DATE
);

-- Comments table
CREATE TABLE comments (
  comment_id INT AUTO_INCREMENT PRIMARY KEY,
  post_id INT,
  user_id INT,
  content VARCHAR(500),
  created_at DATE
);
-- Bios table
CREATE TABLE bios (
    bio_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    bio VARCHAR(200),
    FOREIGN KEY (user_id) REFERENCES users(user_id)
);
-- Profile picture table
CREATE TABLE profile_pictures (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    filename VARCHAR(255) NOT NULL,
    filepath VARCHAR(255) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
