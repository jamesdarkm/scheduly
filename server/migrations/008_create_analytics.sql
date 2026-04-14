CREATE TABLE IF NOT EXISTS post_analytics (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_target_id      INT UNSIGNED NOT NULL,
  impressions         INT UNSIGNED NULL DEFAULT 0,
  reach               INT UNSIGNED NULL DEFAULT 0,
  likes               INT UNSIGNED NULL DEFAULT 0,
  comments_count      INT UNSIGNED NULL DEFAULT 0,
  shares              INT UNSIGNED NULL DEFAULT 0,
  saves               INT UNSIGNED NULL DEFAULT 0,
  engagement_rate     DECIMAL(5,2) NULL,
  clicks              INT UNSIGNED NULL DEFAULT 0,
  fetched_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_target_id) REFERENCES post_targets(id) ON DELETE CASCADE,
  INDEX idx_analytics_target (post_target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
