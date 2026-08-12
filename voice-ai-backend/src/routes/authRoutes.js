const express = require('express');
const authController = require('../controllers/authController');

const router = express.Router();

router.post('/send-otp', authController.sendOtp);
router.post('/resend-otp', authController.resendOtp);
router.post('/verify-otp', authController.verifyOtp);

router.post('/login', authController.login);
router.post('/register', authController.register);

// Role specific shortcuts
router.post('/assistant/login', authController.login);
router.post('/assistant/register', authController.register);

router.post('/doctor/login', authController.login);
router.post('/doctor/register', authController.register);

router.post('/patient/login', authController.login);
router.post('/patient/register', authController.register);

router.get('/me', authController.getMe);

module.exports = router;
