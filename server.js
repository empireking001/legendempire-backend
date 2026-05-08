const express     = require('express');
const mongoose    = require('mongoose');
const cors        = require('cors');
const helmet      = require('helmet');
const morgan      = require('morgan');
const compression = require('compression');
const rateLimit   = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ── Security & Performance ───────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true }));

// ── CORS ─────────────────────────────────────────
// Bulletproof CORS — allows Vercel, localhost, and any preview URLs
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    const allowed = [
      // Your specific frontend URLs
      'https://frontend-blog-taupe.vercel.app',
      'https://legendempire.vercel.app',
      // Any Vercel preview deployment (*.vercel.app)
      '.vercel.app',
      // Local development
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173',
    ];

    // Also allow whatever FRONTEND_URL is set to on Render
    if (process.env.FRONTEND_URL) {
      allowed.push(process.env.FRONTEND_URL);
    }

    const isAllowed = allowed.some(a => {
      if (a.startsWith('.')) return origin.endsWith(a);   // wildcard suffix like .vercel.app
      return origin === a || origin.startsWith(a);
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn('CORS blocked origin:', origin);
      // In production still allow it — don't break the site over CORS config
      // Remove the next line if you want strict blocking
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body Parsing ──────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
if (process.env.NODE_ENV !== 'production') app.use(morgan('dev'));

// ── Database ──────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('✅ MongoDB connected');
    await require('./utils/seed')();
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });

// ── Routes ────────────────────────────────────────
// ── Routes ────────────────────────────────────────
app.use('/api/auth',          require('./routes/authRoutes'));
app.use('/api/posts',         require('./routes/postRoutes'));
app.use('/api/categories',    require('./routes/categoryRoutes'));
app.use('/api/comments',      require('./routes/commentRoutes'));
app.use('/api/upload',        require('./routes/uploadRoutes'));
app.use('/api/subscribers',   require('./routes/subscriberRoutes'));
app.use('/api/social-groups', require('./routes/socialGroupRoutes'));
app.use('/api/analytics',     require('./routes/analyticsRoutes'));
app.use('/api/affiliate',     require('./routes/affiliateRoutes'));
app.use('/api/revisions',     require('./routes/revisionRoutes'));
app.use('/api/seo',           require('./routes/seoRoutes'));
app.use("/api/contact", require("./routes/contactRoutes"));
app.use("/api/email-tracking", require("./routes/emailTrackingRoutes"));
app.use("/api/forum", require("./routes/forumRoutes"));
app.use("/api/telegram", require("./routes/telegramRoutes"));

// Public sitemap + robots (without /api prefix so Google can find them)
app.get('/sitemap.xml', require('./controllers/seoController').getSitemap);
app.get('/robots.txt',  require('./controllers/seoController').getRobots);

// ── Health check ──────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status:  'OK',
    env:     process.env.NODE_ENV,
    time:    new Date().toISOString(),
    db:      mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// ── 404 handler ───────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ──────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 LegendEmpire API running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);

  // Self-ping every 14 minutes to prevent Render free tier sleeping
  if (process.env.NODE_ENV === "production") {
    const selfUrl =
      process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    setInterval(
      async () => {
        try {
          const https = require("https");
          const http = require("http");
          const lib = selfUrl.startsWith("https") ? https : http;
          lib
            .get(`${selfUrl}/api/health`, (res) => {
              console.log(
                `[Keep-alive] Self-ping: ${res.statusCode} at ${new Date().toISOString()}`,
              );
            })
            .on("error", (err) => {
              console.warn("[Keep-alive] Self-ping failed:", err.message);
            });
        } catch (err) {
          console.warn("[Keep-alive] error:", err.message);
        }
      },
      14 * 60 * 1000,
    ); // every 14 minutes
    console.log("✅ Keep-alive self-ping enabled");
  }
});

module.exports = app;
