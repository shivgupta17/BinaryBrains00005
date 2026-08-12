const express = require('express');
const notificationService = require('../services/notificationService');

const router = express.Router();

router.get('/', (req, res) => {
  const { role, recipientId } = req.query;
  const notifs = notificationService.getNotifications(role, recipientId);
  return res.status(200).json({ success: true, count: notifs.length, data: notifs });
});

router.post('/:id/read', (req, res) => {
  const updated = notificationService.markAsRead(req.params.id);
  return res.status(200).json({ success: true, data: updated });
});

module.exports = router;
