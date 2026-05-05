const express = require('express');
const r = express.Router();
const ctrl = require('../controllers');
const { protect, adminOnly } = require('../middleware/auth');
const cache = require("../middleware/cache");

// Admin routes FIRST
r.get('/admin/all',          protect, adminOnly, ctrl.adminGetPosts);
r.get('/admin/stats',        protect, adminOnly, ctrl.adminGetStats);
r.post('/admin/create',      protect, adminOnly, ctrl.createPost);
r.put('/admin/:id',          protect, adminOnly, ctrl.updatePost);
r.delete('/admin/:id',       protect, adminOnly, ctrl.deletePost);
r.put('/admin/:id/feature',  protect, adminOnly, ctrl.featurePost);
r.post('/admin/:id/duplicate', protect, adminOnly, ctrl.duplicatePost);

// Public routes
r.get('/featured',          ctrl.getFeatured);
r.get('/homepage',          ctrl.getHomepage);
r.get('/trending',          ctrl.getTrending);
r.get('/',                  ctrl.getPosts);
r.get('/:slug',             ctrl.getPostBySlug);
r.post('/:id/like',         ctrl.likePost);
r.post("/:id/react", ctrl.reactPost);

// Public routes with caching
r.get('/featured',  cache(3 * 60 * 1000), ctrl.getFeatured);   // 3 min cache
r.get('/homepage',  cache(5 * 60 * 1000), ctrl.getHomepage);   // 5 min cache
r.get('/trending',  cache(5 * 60 * 1000), ctrl.getTrending);   // 5 min cache
r.get('/',          cache(2 * 60 * 1000), ctrl.getPosts);       // 2 min cache
r.get('/:slug',     cache(10 * 60 * 1000), ctrl.getPostBySlug);// 10 min cache

module.exports = r;
