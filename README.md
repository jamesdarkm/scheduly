# DMM Scheduly

Internal social media scheduling platform for managing content across Facebook Pages and Instagram Business accounts. Built for small teams (~20 users) with approval workflows, media library, and analytics.

## Features

- **Multi-user authentication** with role-based access (admin, manager, editor, viewer)
- **Post scheduling** with drag-and-drop calendar
- **Media library** with thumbnail generation
- **Approval workflow** — submit, review, approve/reject
- **Team collaboration** with comments and activity feed
- **Facebook & Instagram publishing** via Meta Graph API
- **Analytics dashboard** with engagement metrics
- **OAuth integration** for connecting social accounts

## Tech Stack

**Frontend**
- React (Vite)
- TailwindCSS
- React Query (@tanstack/react-query)
- React Router
- FullCalendar
- Recharts

**Backend**
- Node.js + Express
- MySQL (raw queries via mysql2)
- JWT authentication
- node-cron for scheduled publishing
- Multer + Sharp for file uploads
- AES-256-GCM token encryption

## Prerequisites

- [Node.js](https://nodejs.org) v18+ (LTS recommended)
- [XAMPP](https://www.apachefriends.org) (or any MySQL server)
- A Facebook App with Business use case (for publishing)

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd dmm-scheduly

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
```

Edit `.env`:
- Set `DB_*` values if your MySQL isn't using XAMPP defaults
- Generate a strong `JWT_SECRET`
- Generate an `ENCRYPTION_KEY` (64-char hex):
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Add `FB_APP_ID` and `FB_APP_SECRET` from your Facebook Developer App

### 3. Set up database

Start MySQL via XAMPP, then:

```bash
cd server
node migrate.js
node seed.js
```

The seed creates a default admin: `admin@dmm.com` / `Admin@123`

### 4. Run the app

Terminal 1 (backend):
```bash
cd server
node server.js
```

Terminal 2 (frontend):
```bash
cd client
npx vite
```

Open http://localhost:5173

## Facebook App Setup

1. Create an app at [developers.facebook.com](https://developers.facebook.com)
2. Add the **"Authenticate and request data from users with Facebook Login"** use case
3. Also add **"Manage everything on your Page"** use case
4. In OAuth redirect URIs, add: `http://localhost:3001/api/social/auth/facebook/callback`
5. Required permissions:
   - `public_profile`
   - `pages_show_list`
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `instagram_basic` (for IG publishing)
   - `instagram_content_publish` (for IG publishing)
   - `instagram_manage_insights` (for IG analytics)

In development mode, these permissions work for app admins/developers/testers without requiring App Review.

## Project Structure

```
dmm-scheduly/
├── client/                    # React frontend (Vite)
│   ├── src/
│   │   ├── api/               # Axios API modules
│   │   ├── components/        # Reusable components
│   │   ├── context/           # Auth and toast contexts
│   │   └── pages/             # Route pages
│   └── vite.config.js
│
├── server/                    # Express backend
│   ├── src/
│   │   ├── config/            # DB and env config
│   │   ├── controllers/       # Route handlers
│   │   ├── middleware/        # Auth, RBAC, upload, validate
│   │   ├── routes/            # API route definitions
│   │   ├── services/          # Business logic
│   │   ├── jobs/              # Cron jobs (publish, analytics, token refresh)
│   │   └── utils/             # Helpers, logger
│   ├── migrations/            # SQL migration files
│   ├── uploads/               # User-uploaded media (gitignored)
│   ├── migrate.js             # Migration runner
│   ├── seed.js                # Seed admin user
│   └── server.js              # Entry point
│
└── .gitignore
```

## Roles & Permissions

| Action | Admin | Manager | Editor | Viewer |
|---|---|---|---|---|
| Create/edit posts | ✓ | ✓ | ✓ | — |
| Delete any post | ✓ | ✓ | — | — |
| Submit for approval | ✓ | ✓ | ✓ | — |
| Approve/reject | ✓ | ✓ | — | — |
| Schedule/publish | ✓ | ✓ | — | — |
| Manage users | ✓ | — | — | — |
| Connect social accounts | ✓ | — | — | — |
| View analytics | ✓ | ✓ | ✓ | ✓ |

## Background Jobs

Three cron jobs run in the background:

- **Publish job** — every minute, publishes scheduled posts due for publishing
- **Token refresh** — daily at 3 AM, refreshes expiring Facebook tokens
- **Analytics fetch** — daily at 6 AM, fetches insights for recent published posts

## Security Notes

- Facebook access tokens are **encrypted at rest** using AES-256-GCM
- Passwords are hashed with bcrypt (12 rounds)
- JWT tokens expire after 24 hours
- Uploaded files are validated by MIME type and size
- Role-based access control enforced on every endpoint

## License

Internal use only.
