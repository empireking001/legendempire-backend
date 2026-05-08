const express = require("express");
const r = express.Router();
const ctrl = require("../controllers/emailTrackingController");
const { protect, adminOnly } = require("../middleware/auth");

// Public tracking endpoints
r.get("/open/:trackingId/:email", ctrl.trackOpen);
r.get("/click/:trackingId/:email", ctrl.trackClick);
r.get("/unsubscribe/:trackingId/:email", ctrl.trackUnsubscribe);

// Admin endpoints
r.get("/logs", protect, adminOnly, ctrl.getEmailLogs);
r.get("/summary", protect, adminOnly, ctrl.getPerformanceSummary);

module.exports = r;
