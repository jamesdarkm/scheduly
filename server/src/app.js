const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const env = require('./config/env');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Route imports
const authRoutes = require('./routes/auth.routes');
const usersRoutes = require('./routes/users.routes');
const postsRoutes = require('./routes/posts.routes');
const mediaRoutes = require('./routes/media.routes');
const calendarRoutes = require('./routes/calendar.routes');
const socialRoutes = require('./routes/social.routes');
const commentsRoutes = require('./routes/comments.routes');
const teamsRoutes = require('./routes/teams.routes');
const activityRoutes = require('./routes/activity.routes');
const analyticsRoutes = require('./routes/analytics.routes');

const app = express();

// Security & parsing
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow media to load from frontend on another origin
}));

// CORS: allow configured client origins plus any *.vercel.app preview URLs
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser / server-to-server
    if (env.clientOrigins.includes(origin)) return cb(null, true);
    if (/\.vercel\.app$/.test(new URL(origin).hostname)) return cb(null, true);
    return cb(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy (Railway, Vercel, Cloudflare, etc. sit in front of the app)
app.set('trust proxy', 1);

// Static files (uploaded media)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/posts', postsRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

module.exports = app;
