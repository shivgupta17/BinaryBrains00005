const fileUtils = require('../utils/fileUtils');

/**
 * Centralized Notification Service
 * Supports In-App, Role-Targeted Alerts, and Email Fallback
 */
function sendNotification({ recipientRole, recipientId, patientId, caseId, type, title, message, priority = 'MEDIUM' }) {
  const notif = {
    notificationId: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    recipientRole: recipientRole || 'all',
    recipientId: recipientId || null,
    patientId: patientId || null,
    caseId: caseId || null,
    type: type || 'PATIENT UPDATE',
    title: title || 'System Alert',
    message: message || '',
    priority,
    read: false,
    createdAt: new Date().toISOString()
  };

  fileUtils.saveNotification(notif);
  console.log(`[NotificationService] Created notification [${notif.type}]: "${notif.title}" for ${recipientRole}/${recipientId || 'all'}`);
  return notif;
}

function getNotifications(recipientRole, recipientId) {
  return fileUtils.listNotifications(recipientRole, recipientId);
}

function markAsRead(notificationId) {
  const allNotifs = fileUtils.listNotifications();
  const target = allNotifs.find(n => n.notificationId === notificationId);
  if (target) {
    target.read = true;
    target.readAt = new Date().toISOString();
    fileUtils.saveNotification(target);
    return target;
  }
  return null;
}

module.exports = {
  sendNotification,
  getNotifications,
  markAsRead
};
