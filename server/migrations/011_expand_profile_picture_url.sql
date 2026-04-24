-- Facebook CDN URLs for profile pictures include long signed query strings
-- that exceed 500 chars. Expand the columns to TEXT.

ALTER TABLE social_accounts
  MODIFY COLUMN profile_picture_url TEXT NULL;

ALTER TABLE users
  MODIFY COLUMN avatar_url TEXT NULL;

ALTER TABLE media
  MODIFY COLUMN file_path TEXT NOT NULL,
  MODIFY COLUMN thumbnail_path TEXT NULL;
