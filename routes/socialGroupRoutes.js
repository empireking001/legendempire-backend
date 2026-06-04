const express = require("express");
const r = express.Router();
const { protect, adminOnly } = require("../middleware/auth");
const SocialGroup = require("../models/SocialGroup");

// ── PUBLIC: Get all active groups ──────────────────
r.get("/", async (req, res) => {
  try {
    const groups = await SocialGroup.find({ isActive: true }).sort({
      order: 1,
      createdAt: 1,
    });
    res.json({ success: true, data: groups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── ADMIN: Get all groups ──────────────────────────
r.get("/admin/all", protect, adminOnly, async (req, res) => {
  try {
    const groups = await SocialGroup.find().sort({ order: 1, createdAt: 1 });
    res.json({ success: true, data: groups });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── ADMIN: Create group ────────────────────────────
r.post("/admin", protect, adminOnly, async (req, res) => {
  try {
    const { platform, label, url, description, memberCount, isActive, order } = req.body;
    
    // Explicit whitelisting prevents mass assignment payloads
    const group = await SocialGroup.create({
      platform,
      label,
      url,
      description,
      memberCount,
      isActive,
      order
    });

    res
      .status(201)
      .json({ success: true, data: group, message: "Group added!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── ADMIN: Update group ────────────────────────────
r.put("/admin/:id", protect, adminOnly, async (req, res) => {
  try {
    const { platform, label, url, description, memberCount, isActive, order } = req.body;

    const group = await SocialGroup.findByIdAndUpdate(
      req.params.id, 
      { platform, label, url, description, memberCount, isActive, order }, 
      { new: true, runValidators: true }
    );

    if (!group)
      return res.status(404).json({ success: false, message: "Not found." });
    res.json({ success: true, data: group, message: "Group updated!" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = r;