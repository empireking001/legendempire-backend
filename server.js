const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
dns.setDefaultResultOrder("ipv4first");

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();

// ── Security & Performance ───────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(
  rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true }),
);

// ── CORS ─────────────────────────────────────────
const allowedOrigins = [
  "https://frontend-blog-taupe.vercel.app",
  "https://legendempire.vercel.app"
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.includes(origin) || 
                        origin.endsWith(".vercel.app") || 
                        origin.startsWith("http://localhost:") ||
                        origin.startsWith("http://127.0.0.1:");

      if (isAllowed) {
        return callback(null, true);
      } else {
        return callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  })
);

// ── Middleware ───────────────────────────────────
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Database Connection ──────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("💾 MongoDB Connected Successfully"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// ── Routes Registration ──────────────────────────
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/posts", require("./routes/postRoutes"));
app.use("/api/categories", require("./routes/categoryRoutes"));
app.use("/api/comments", require("./routes/commentRoutes"));
app.use("/api/upload", require("./routes/uploadRoutes"));
app.use("/api/subscribers", require("./routes/subscriberRoutes"));
app.use("/api/telegram", require("./routes/telegramRoutes"));
app.use("/api/seo", require("./routes/seoRoutes"));
app.use("/api/analytics", require("./routes/analyticsRoutes"));
app.use("/api/affiliate", require("./routes/affiliateRoutes"));
app.use("/api/social-groups", require("./routes/socialGroupRoutes"));
app.use("/api/schools", require("./routes/schoolRoutes"));
app.use("/api/forum", require("./routes/forumRoutes"));
app.use("/api/contact", require("./routes/contactRoutes"));
app.use("/api/email-tracking", require("./routes/emailTrackingRoutes"));
app.use("/api/revisions", require("./routes/revisionRoutes"));

// ── Public Health Endpoint ────────────────────────
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "UP",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// ── Catch 404 ─────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
  });
});

// ── Global Error Handler ──────────────────────────
app.use((err, req, res, next) => {
  console.error("Server error:", err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 LegendEmpire API running on port ${PORT}`);

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
                `[Keep-alive] Self-ping: ${res.statusCode} at ${new Date().toISOString()}`
              );
            })
            .on("error", (err) => {
              console.warn("[Keep-alive] Self-ping failed:", err.message);
            });
        } catch (err) {
          console.warn("[Keep-alive] Self-ping wrapper exception:", err.message);
        }
      },
      14 * 60 * 1000
    );
  }
});