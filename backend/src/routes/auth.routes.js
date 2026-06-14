const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth');
const rateLimiter = require('../middleware/rateLimiter');

// Tight rate limit for registration and password reset request: 5 requests per minute
const strictLimiter = rateLimiter(60000, 5, 'Too many onboarding requests. Please try again in 1 minute.');
// Login rate limit: 10 requests per minute
const loginLimiter = rateLimiter(60000, 10, 'Too many login attempts. Please try again in 1 minute.');

router.post('/register', strictLimiter, authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', protect, authController.logout);
router.post('/forgot-password', strictLimiter, authController.forgotPassword);
router.post('/reset-password/:token', strictLimiter, authController.resetPassword);

module.exports = router;
