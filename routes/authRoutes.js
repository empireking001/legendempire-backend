const express = require("express");
const r = express.Router();
const ctrl = require("../controllers");
const { protect, adminOnly } = require("../middleware/auth");

r.post("/login", ctrl.login);
r.get("/me", protect, ctrl.getMe);
r.put("/profile", protect, ctrl.updateProfile);
r.put("/change-password", protect, ctrl.changePassword);
r.get("/admins", protect, adminOnly, ctrl.getAdmins);
r.post("/admins", protect, adminOnly, ctrl.addAdmin);
r.delete("/admins/:id", protect, adminOnly, ctrl.removeAdmin);

module.exports = r;
