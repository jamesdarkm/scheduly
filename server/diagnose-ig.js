// Diagnostic script: hits Instagram's API directly to see what's failing.
// Usage: node diagnose-ig.js <ig_account_id>
//
// Run via Railway: railway run node diagnose-ig.js 27983564241231412
// Or locally with .env loaded: node diagnose-ig.js 27983564241231412

const axios = require('axios');
const pool = require('./src/config/db');
const { decrypt } = require('./src/services/token.service');

const igAccountId = process.argv[2];
if (!igAccountId) {
  console.error('Usage: node diagnose-ig.js <ig_account_id>');
  process.exit(1);
}

(async () => {
  // Pull the token from DB
  const [rows] = await pool.execute(
    `SELECT access_token FROM social_accounts WHERE platform = 'instagram_business' AND platform_account_id = ?`,
    [igAccountId]
  );
  if (rows.length === 0) {
    console.error('No IG account found for that ID');
    process.exit(1);
  }
  const token = decrypt(rows[0].access_token);
  console.log('Token loaded.');

  // 1) Profile check
  console.log('\n=== Profile ===');
  try {
    const { data } = await axios.get(`https://graph.instagram.com/${igAccountId}`, {
      params: { fields: 'id,username,account_type,name', access_token: token },
    });
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('Profile error:', e.response?.data || e.message);
  }

  // 2) Try creating a media container with a simple known-good public image
  console.log('\n=== Try /media with a public test image (httpbin) ===');
  try {
    const { data } = await axios.post(`https://graph.instagram.com/${igAccountId}/media`, {
      image_url: 'https://httpbin.org/image/jpeg',
      caption: 'Test from diagnose-ig.js',
      access_token: token,
    });
    console.log('SUCCESS — container created:', data);
  } catch (e) {
    console.log('Error:', e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }

  // 3) Try with our R2 URL
  const lastMedia = await pool.execute(
    `SELECT m.file_path FROM media m
     JOIN post_media pm ON m.id = pm.media_id
     JOIN posts p ON pm.post_id = p.id
     ORDER BY m.created_at DESC LIMIT 1`
  );
  const r2Url = `${process.env.R2_PUBLIC_URL}/${lastMedia[0][0].file_path}`;
  console.log('\n=== Try /media with our R2 URL ===');
  console.log('URL:', r2Url);
  try {
    const { data } = await axios.post(`https://graph.instagram.com/${igAccountId}/media`, {
      image_url: r2Url,
      caption: 'Test from diagnose-ig.js with R2 URL',
      access_token: token,
    });
    console.log('SUCCESS — container created:', data);
  } catch (e) {
    console.log('Error:', e.response?.status, JSON.stringify(e.response?.data, null, 2));
  }

  await pool.end();
})();
