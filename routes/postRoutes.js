const express = require('express');
const r = express.Router();
const ctrl = require('../controllers');
const { protect, adminOnly } = require('../middleware/auth');

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

module.exports = r;
