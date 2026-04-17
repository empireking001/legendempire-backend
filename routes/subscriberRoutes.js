const express = require("express");
const r = express.Router();
const ctrl = require("../controllers/newsletterController");
const { protect, adminOnly } = require("../middleware/auth");

// Public
r.post("/", ctrl.subscribe);
r.get("/unsubscribe", ctrl.unsubscribe);

// Admin
r.get("/admin/list", protect, adminOnly, ctrl.getSubscribers);
r.delete("/admin/:id", protect, adminOnly, ctrl.deleteSubscriber);
r.get("/admin/config", protect, adminOnly, ctrl.getEmailConfig);
r.post("/admin/config", protect, adminOnly, ctrl.saveEmailConfig);
r.post("/admin/test", protect, adminOnly, ctrl.testEmail);
r.post("/admin/digest", protect, adminOnly, ctrl.sendDigest);
r.get("/admin/export", protect, adminOnly, ctrl.exportSubscribers);

module.exports = r;
