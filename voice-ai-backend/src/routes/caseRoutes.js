const express = require('express');
const caseController = require('../controllers/caseController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

const patientDashboardController = require('../controllers/patientDashboardController');

// Protected Case routes
router.post('/', requireAuth, requireRole('assistant', 'doctor'), caseController.createCase);
router.get('/:caseId', requireAuth, caseController.getCaseDetails);
router.post('/:caseId/vitals', requireAuth, requireRole('assistant', 'doctor'), caseController.addCaseVitals);
router.post('/:caseId/text', requireAuth, requireRole('assistant', 'doctor'), caseController.addCaseText);
router.post('/:caseId/media', requireAuth, requireRole('assistant', 'doctor'), caseController.addCaseMedia);
router.get('/:caseId/handoff', requireAuth, caseController.getCaseHandoff);
router.post('/:caseId/reminders', requireAuth, patientDashboardController.sendPatientReminderRequest);

module.exports = router;
