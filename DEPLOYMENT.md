# Deployment Guide

Production architecture:

| Component | Host | URL |
|---|---|---|
| Frontend (React/Vite) | Vercel | `https://scheduly.darkm.co` (custom domain) |
| Backend (Express) | Railway | `https://<project>.up.railway.app` |
| MySQL | Railway | internal |
| Media uploads | Backend's local disk | mounted Railway volume |

---

## 1. Deploy backend to Railway

### 1.1 Create Railway project

1. Go to https://railway.app and sign in with GitHub.
2. Click **New Project** → **Deploy from GitHub repo** → select `jamesdarkm/scheduly`.
3. Railway will detect `nixpacks.toml` and `railway.json` and start building. The first build will likely fail because there's no MySQL yet — we'll fix that next.

### 1.2 Add MySQL database

1. In the project, click **+ New** → **Database** → **Add MySQL**.
2. Wait for it to provision (~30 seconds).
3. Open the MySQL service → **Variables** tab — you'll see `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`. Our server reads these automatically.

### 1.3 Link database to the backend service

1. Open the backend service (the one from your GitHub repo) → **Variables**.
2. Click **+ New Variable** → **Add Reference** → pick the MySQL service.
3. Add references for: `MYSQLHOST`, `MYSQLUSER`, `MYSQLPASSWORD`, `MYSQLDATABASE`, `MYSQLPORT`.

### 1.4 Set environment variables on the backend

Add these in the backend service **Variables** tab:

```
PORT=3001
NODE_ENV=production

# Auth
JWT_SECRET=<generate a long random string>
JWT_EXPIRES_IN=24h

# Encryption key for social media tokens (32 bytes hex = 64 chars)
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<64-char hex>

# Seed an admin user on first deploy (set to "false" after first successful deploy)
RUN_SEED=true

# Facebook
FB_APP_ID=26447834738219900
FB_APP_SECRET=<your FB app secret>
FB_REDIRECT_URI=https://<railway-domain>/api/social/auth/facebook/callback

# Instagram
IG_APP_ID=2680727678978976
IG_APP_SECRET=<your IG app secret>
IG_REDIRECT_URI=https://<railway-domain>/api/social/auth/instagram/callback

# CORS: allow the Vercel frontend + final custom domain
CLIENT_URLS=https://scheduly.darkm.co,https://scheduly-<random>.vercel.app

# Public base URL for this backend (used for Instagram media URLs)
SERVER_URL=https://<railway-domain>
IG_PUBLIC_BASE_URL=https://<railway-domain>
```

### 1.5 Generate a public domain for the backend

1. Backend service → **Settings** → **Networking** → **Generate Domain**.
2. Copy the generated URL (e.g. `https://scheduly-api-production.up.railway.app`).
3. Update the variables above (`FB_REDIRECT_URI`, `IG_REDIRECT_URI`, `SERVER_URL`, `IG_PUBLIC_BASE_URL`) with the real URL.

### 1.6 Attach a volume for media uploads

Uploaded media is stored on disk by default; Railway wipes the filesystem on each deploy. Attach a volume so files persist.

1. Backend service → **Settings** → **Volumes** → **New Volume**.
2. Mount path: `/app/server/uploads`.
3. Size: 1 GB is plenty to start.

### 1.7 Redeploy

Hit **Deploy** or push a new commit. Watch the deploy log:
- Migrations should run (applies all 10 .sql files).
- Seed should run (creates `admin@dmm.com` / `Admin@123`).
- Server should start listening.

Verify: `curl https://<railway-domain>/api/health` → `{"status":"ok",...}`

### 1.8 Change the admin password

Log in as `admin@dmm.com` / `Admin@123` on the frontend and change the password immediately, then set `RUN_SEED=false` on Railway (to prevent any re-seeding attempts in future).

---

## 2. Deploy frontend to Vercel

### 2.1 Import the repo

1. Go to https://vercel.com and sign in with GitHub.
2. Click **Add New** → **Project** → **Import** `jamesdarkm/scheduly`.
3. **Framework preset**: `Vite` (should auto-detect).
4. **Root directory**: set to `client`.
5. **Build command**: `npm run build` (default).
6. **Output directory**: `dist` (default).

### 2.2 Set environment variable

Under **Environment Variables**, add:

```
VITE_API_URL = https://<railway-domain>
```

(Use the Railway backend URL from step 1.5, without trailing slash.)

### 2.3 Deploy

Click **Deploy**. Build takes ~1 minute. You'll get a URL like `https://scheduly-xxxx.vercel.app`.

### 2.4 Quick smoke test

Open the Vercel URL. Sign in with `admin@dmm.com` / `Admin@123`. If the dashboard loads and you don't see CORS errors, the frontend ↔ backend connection is working.

---

## 3. Point scheduly.darkm.co at Vercel

### 3.1 Add custom domain in Vercel

1. Vercel project → **Settings** → **Domains**.
2. Add `scheduly.darkm.co` → Vercel shows the required DNS records.
3. Typically: add a `CNAME` record for `scheduly` pointing to `cname.vercel-dns.com` at your DNS provider.

### 3.2 Update CORS

Once the custom domain is live, make sure `CLIENT_URLS` on Railway includes `https://scheduly.darkm.co` (already in the example above).

### 3.3 Update Facebook + Instagram redirect URIs

In your Meta App Dashboard:

- **Facebook → Facebook Login for Business → Settings** → Valid OAuth Redirect URIs:
  - `https://<railway-domain>/api/social/auth/facebook/callback`

- **Instagram → Instagram Business Login → Settings** → Valid OAuth Redirect URIs:
  - `https://<railway-domain>/api/social/auth/instagram/callback`

---

## 4. Verify end to end

1. Visit https://scheduly.darkm.co — should load the login page.
2. Log in as admin.
3. Go to **Accounts** → connect Facebook → should redirect back successfully.
4. Go to **Create Post** → write a post → schedule it → wait a minute.
5. Check your Facebook Page — the post should appear.

---

## 5. Ongoing deployments

Every push to `main` on GitHub will:
- **Railway** will rebuild and redeploy the backend (runs migrations, starts server).
- **Vercel** will rebuild and redeploy the frontend.

For pull requests, Vercel creates preview deployments automatically.

---

## Troubleshooting

- **"Cannot connect to database" on Railway** — confirm the MySQLhost reference variables are set on the backend service.
- **CORS errors in browser** — add your Vercel preview URL to `CLIENT_URLS` on Railway.
- **Facebook/Instagram OAuth error** — the redirect URI in the Meta app must exactly match `FB_REDIRECT_URI` / `IG_REDIRECT_URI`.
- **Posts marked "published" but nothing on Facebook** — check `post_targets` table for the actual status; 403 errors usually mean missing `pages_manage_posts` permission; reconnect the account after adding the permission in the Meta app.
- **Instagram publishing fails with "Public URL required"** — set `IG_PUBLIC_BASE_URL` on Railway to your backend's public URL.
