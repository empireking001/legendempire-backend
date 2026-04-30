const express = require("express");
const r = express.Router();
const ctrl = require("../controllers/revisionController");
const { protect, adminOnly } = require("../middleware/auth");

r.get("/:postId", protect, adminOnly, ctrl.getRevisions);
r.post("/:postId", protect, adminOnly, ctrl.saveRevision);
r.post("/:postId/autosave", protect, adminOnly, ctrl.autoSave);
r.put("/restore/:revisionId", protect, adminOnly, ctrl.restoreRevision);
r.delete("/:revisionId", protect, adminOnly, ctrl.deleteRevision);

module.exports = r;
