const express = require("express");
const r = express.Router();
const ctrl = require("../controllers/forumController");
const { protect, adminOnly } = require("../middleware/auth");

// Public
r.get("/", ctrl.getQuestions);
r.get("/:slug", ctrl.getQuestion);
r.post("/", ctrl.createQuestion);
r.post("/:id/answers", ctrl.addAnswer);
r.post("/:id/upvote", ctrl.upvoteQuestion);

// Admin
r.get("/admin/all", protect, adminOnly, ctrl.adminGetQuestions);
r.post("/admin/:id/answer", protect, adminOnly, ctrl.adminAnswer);
r.put("/admin/:id/pin", protect, adminOnly, ctrl.togglePin);
r.delete("/admin/:id", protect, adminOnly, ctrl.deleteQuestion);

module.exports = r;
