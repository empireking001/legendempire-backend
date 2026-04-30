const express = require("express");
const r = express.Router();
const ctrl = require("../controllers/seoController");
const { protect, adminOnly } = require("../middleware/auth");

// Public routes
r.get("/sitemap.xml", ctrl.getSitemap);
r.get("/robots.txt", ctrl.getRobots);

// Admin routes
r.get("/settings", protect, adminOnly, ctrl.getSettings);
r.post("/settings", protect, adminOnly, ctrl.saveSettings);

module.exports = r;
