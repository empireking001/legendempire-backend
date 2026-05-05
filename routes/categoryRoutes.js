const express = require('express');
const r = express.Router();
const ctrl = require('../controllers');
const { protect, adminOnly } = require('../middleware/auth');
const cache = require("../middleware/cache");

// Admin routes FIRST (before /:slug to avoid conflicts)
r.get('/admin/all',         protect, adminOnly, ctrl.adminGetCategories);
r.post('/admin',            protect, adminOnly, ctrl.createCategory);
r.put('/admin/:id',         protect, adminOnly, ctrl.updateCategory);
r.delete('/admin/:id',      protect, adminOnly, ctrl.deleteCategory);

// Public routes
r.get('/',                  ctrl.getCategories);
r.get('/:slug',             ctrl.getCategoryBySlug);
r.get("/", cache(10 * 60 * 1000), ctrl.getCategories);

module.exports = r;
