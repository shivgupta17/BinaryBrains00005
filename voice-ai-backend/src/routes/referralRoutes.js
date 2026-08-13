const express = require('express');
const referralController = require('../controllers/referralController');
const { requireAuth, requireRole } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/', requireAuth, requireRole('assistant'), referralController.createReferral);
router.get('/doctor/referrals', requireAuth, requireRole('doctor'), referralController.getDoctorReferrals);
router.get('/my-referrals', requireAuth, requireRole('doctor'), referralController.getDoctorReferrals);
router.get('/', requireAuth, referralController.listReferrals);
router.post('/:referralId/accept', requireAuth, requireRole('doctor'), referralController.acceptReferral);

module.exports = router;
