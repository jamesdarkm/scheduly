ALTER TABLE social_accounts
  MODIFY COLUMN platform ENUM(
    'facebook_page',
    'instagram_business',
    'pinterest',
    'threads',
    'tiktok',
    'linkedin',
    'youtube',
    'snapchat'
  ) NOT NULL;
