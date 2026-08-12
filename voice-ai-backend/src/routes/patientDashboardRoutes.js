const express = require('express');
const patientDashboardController = require('../controllers/patientDashboardController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Protected Patient-only routes
router.get('/dashboard-data', requireAuth, requireRole('patient'), patientDashboardController.getPatientDashboardData);
router.post('/cases/:caseId/reminders', requireAuth, requireRole('patient'), patientDashboardController.sendPatientReminderRequest);

module.exports = router;
