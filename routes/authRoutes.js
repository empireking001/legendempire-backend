// authRoutes.js
const express = require('express');
const r = express.Router();
const ctrl = require('../controllers');
const { protect } = require('../middleware/auth');

r.post('/login',            ctrl.login);
r.get('/me',                protect, ctrl.getMe);
r.put('/profile',           protect, ctrl.updateProfile);
r.put('/change-password',   protect, ctrl.changePassword);

module.exports = r;
