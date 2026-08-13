const express = require('express');
const doctorController = require('../controllers/doctorController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

// Doctor routes
router.get('/available', requireAuth, doctorController.getAvailableDoctors);
router.get('/lookup/:doctorId', requireAuth, doctorController.getDoctorById);
router.get('/:doctorId', requireAuth, doctorController.getDoctorById);
router.put('/:doctorId/status', requireAuth, requireRole('doctor'), doctorController.updateDoctorStatus);
router.post('/cases/:caseId/medications', requireAuth, requireRole('doctor'), doctorController.approveMedication);
router.post('/cases/:caseId/bed-assignment', requireAuth, requireRole('doctor'), doctorController.assignBed);
router.post('/cases/:caseId/medication-schedule', requireAuth, requireRole('doctor'), doctorController.scheduleMedicationTimes);
router.post('/cases/:caseId/follow-up', requireAuth, requireRole('doctor'), doctorController.setFollowUp);
router.post('/cases/:caseId/instruction', requireAuth, requireRole('doctor'), doctorController.sendInstruction);

module.exports = router;
