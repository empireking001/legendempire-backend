const express = require("express");
const r = express.Router();
const ctrl = require("../controllers/forumController");
const { protect, adminOnly } = require("../middleware/auth");

// ==========================================
// ── PUBLIC ROUTES (NO AUTH REQUIRED) ──────
// ==========================================

r.get("/", ctrl.getQuestions); // Get approved general questions
r.get("/school/:slug", ctrl.getSchoolForum); // Get approved campus questions by school slug
r.get("/q/:slug", ctrl.getQuestion); // Get single question view by slug
r.post("/", ctrl.createQuestion); // Submit a question (General or Campus)
r.post("/:id/answers", ctrl.addAnswer); // Submit an answer
r.post("/:id/upvote", ctrl.upvoteQuestion); // Toggle an IP-bound upvote

// ==========================================
// ── ADMIN ROUTES (AUTH + ADMIN REQUIRED) ──
// ==========================================

// Dashboards
r.get("/admin/general", protect, adminOnly, ctrl.adminGetGeneralQuestions); // Tab A: General questions
r.get("/admin/campus", protect, adminOnly, ctrl.adminGetCampusQuestions); // Tab B: School campus questions

// Actions
r.put("/admin/:id/approve", protect, adminOnly, ctrl.adminApproveQuestion); // Direct approval toggle
r.post("/admin/:id/answer", protect, adminOnly, ctrl.adminAnswer); // Admin response (auto-approves)
r.put("/admin/:id/pin", protect, adminOnly, ctrl.togglePin); // Pin/unpin a question
r.delete("/admin/:id", protect, adminOnly, ctrl.deleteQuestion); // Delete question entry

module.exports = r;
