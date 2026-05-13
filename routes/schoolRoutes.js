const express = require("express");
const r = express.Router();
const ctrl = require("../controllers/schoolController");
const { protect, adminOnly } = require("../middleware/auth");

// ── Public ─────────────────────────────────────────
r.get("/", ctrl.getSchools);
r.get("/featured", ctrl.getFeatured);
r.get("/search/suggestions", ctrl.searchSuggestions);
r.get("/:slug", ctrl.getSchool);
r.get("/:slug/posts", ctrl.getSchoolPosts);

// ── Admin ──────────────────────────────────────────
r.get("/admin/all", protect, adminOnly, ctrl.adminGetSchools);
r.get("/admin/stats", protect, adminOnly, ctrl.adminStats);
r.post("/admin", protect, adminOnly, ctrl.createSchool);
r.put("/admin/:id", protect, adminOnly, ctrl.updateSchool);
r.delete("/admin/:id", protect, adminOnly, ctrl.deleteSchool);
r.put("/admin/:id/feature", protect, adminOnly, ctrl.toggleFeatured);

module.exports = r;
