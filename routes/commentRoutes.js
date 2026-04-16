const express = require('express');
const r = express.Router();
const ctrl = require('../controllers');
const { protect, adminOnly } = require('../middleware/auth');

r.get('/admin/all',              protect, adminOnly, ctrl.adminGetComments);
r.put('/admin/:id/:action',      protect, adminOnly, ctrl.moderateComment);
r.delete('/admin/:id',           protect, adminOnly, ctrl.deleteComment);
r.get('/:postId',                ctrl.getComments);
r.post('/:postId',               ctrl.createComment);

module.exports = r;
