--  demo user
INSERT INTO users (first_name, last_name, nickname, email, password)
VALUES ('Test', 'User', 'testuser', 'test@test.com', '123');

--  demo post
INSERT INTO posts (user_id, content, created_at, expires_at)
VALUES (1, 'Demo post for comments feature', CURDATE(), DATE_ADD(CURDATE(), INTERVAL 7 DAY));

--  demo comment
INSERT INTO comments (post_id, user_id, content, created_at)
VALUES (1, 1, 'First test comment', CURDATE());

-- Checking data
SELECT * FROM users;
SELECT * FROM posts;
SELECT * FROM comments;