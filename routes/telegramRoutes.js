const express = require("express");
const r = express.Router();
const ctrl = require("../controllers/telegramController");
const { protect, adminOnly } = require("../middleware/auth");

r.post("/send", protect, adminOnly, ctrl.sendManual);
r.post("/roundup", protect, adminOnly, ctrl.weeklyRoundup);

module.exports = r;
