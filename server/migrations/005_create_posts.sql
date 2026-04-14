CREATE TABLE IF NOT EXISTS posts (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title             VARCHAR(255) NULL,
  content           TEXT NOT NULL,
  post_type         ENUM('text','image','video','carousel') NOT NULL DEFAULT 'image',
  status            ENUM('draft','pending_approval','approved','scheduled','publishing','published','failed') NOT NULL DEFAULT 'draft',
  scheduled_at      DATETIME NULL,
  published_at      DATETIME NULL,
  publish_error     TEXT NULL,
  created_by        INT UNSIGNED NOT NULL,
  assigned_to       INT UNSIGNED NULL,
  team_id           INT UNSIGNED NULL,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  INDEX idx_posts_status (status),
  INDEX idx_posts_scheduled (scheduled_at),
  INDEX idx_posts_team (team_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_media (
  post_id     INT UNSIGNED NOT NULL,
  media_id    INT UNSIGNED NOT NULL,
  sort_order  TINYINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (post_id, media_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (media_id) REFERENCES media(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS post_targets (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  post_id             INT UNSIGNED NOT NULL,
  social_account_id   INT UNSIGNED NOT NULL,
  platform_post_id    VARCHAR(100) NULL,
  status              ENUM('pending','published','failed') NOT NULL DEFAULT 'pending',
  error_message       TEXT NULL,
  published_at        DATETIME NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (social_account_id) REFERENCES social_accounts(id),
  UNIQUE KEY uq_post_target (post_id, social_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
