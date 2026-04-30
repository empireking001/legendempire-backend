const express = require("express");
const r = express.Router();
const ctrl = require("../controllers/affiliateController");
const { protect, adminOnly } = require("../middleware/auth");

// Public redirect
r.get("/go/:code", ctrl.redirect);

// Admin
r.get("/", protect, adminOnly, ctrl.getAll);
r.post("/", protect, adminOnly, ctrl.create);
r.put("/:id", protect, adminOnly, ctrl.update);
r.delete("/:id", protect, adminOnly, ctrl.delete);

module.exports = r;
