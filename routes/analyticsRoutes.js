const express = require("express");
const r = express.Router();
const ctrl = require("../controllers/analyticsController");
const { protect, adminOnly } = require("../middleware/auth");

r.get("/views-chart", protect, adminOnly, ctrl.getViewsChart);
r.get("/top-posts", protect, adminOnly, ctrl.getTopPostsWeek);
r.get("/subscriber-growth", protect, adminOnly, ctrl.getSubscriberGrowth);
r.get("/search-terms", protect, adminOnly, ctrl.getSearchTerms);
r.get("/overview", protect, adminOnly, ctrl.getTrafficOverview);

module.exports = r;
