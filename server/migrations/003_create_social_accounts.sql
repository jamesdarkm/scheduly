CREATE TABLE IF NOT EXISTS social_accounts (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  platform            ENUM('facebook_page','instagram_business') NOT NULL,
  platform_account_id VARCHAR(100) NOT NULL,
  account_name        VARCHAR(255) NOT NULL,
  access_token        TEXT NOT NULL,
  token_expires_at    DATETIME NULL,
  fb_page_id          VARCHAR(100) NULL,
  profile_picture_url VARCHAR(500) NULL,
  connected_by        INT UNSIGNED NOT NULL,
  team_id             INT UNSIGNED NULL,
  is_active           TINYINT(1) NOT NULL DEFAULT 1,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (connected_by) REFERENCES users(id),
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE SET NULL,
  UNIQUE KEY uq_platform_account (platform, platform_account_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
