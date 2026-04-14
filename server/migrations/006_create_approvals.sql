CREATE TABLE IF NOT EXISTS approvals (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id     INT UNSIGNED NOT NULL,
  reviewer_id INT UNSIGNED NOT NULL,
  decision    ENUM('approved','rejected','changes_requested') NOT NULL,
  note        TEXT NULL,
  decided_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id),
  INDEX idx_approvals_post (post_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
