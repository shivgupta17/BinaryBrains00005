const fileUtils = require('../utils/fileUtils');
const notificationService = require('./notificationService');

/**
 * Backend Scheduler Service for Medication Reminders & Follow-Ups
 * Runs persistently on Node backend and sends notifications
 */
function initScheduler() {
  console.log('[SchedulerService] Starting persistent background scheduler for medication & follow-up reminders...');

  // Check every 30 seconds
  setInterval(() => {
    try {
      checkMedicationSchedules();
    } catch (err) {
      console.error('[SchedulerService] Error checking schedules:', err.message);
    }
  }, 30000);
}

function checkMedicationSchedules() {
  const schedules = fileUtils.listSchedules();
  const now = new Date();
  const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  schedules.forEach(sched => {
    if (sched.status !== 'ACTIVE') return;

    if (sched.times && Array.isArray(sched.times)) {
      sched.times.forEach(timeStr => {
        // Simple match or check if due
        if (timeStr === currentHHMM && (!sched.lastTriggeredTime || sched.lastTriggeredTime !== timeStr)) {
          sched.lastTriggeredTime = timeStr;
          fileUtils.saveSchedule(sched);

          notificationService.sendNotification({
            recipientRole: 'assistant',
            recipientId: null,
            patientId: sched.patientId,
            caseId: sched.caseId,
            type: 'MEDICATION_DUE',
            title: '⏰ MEDICATION DUE',
            message: `Medication ${sched.medicationName} (${sched.dose}) is due now for patient ${sched.patientId}`,
            priority: 'HIGH'
          });
        }
      });
    }
  });
}

module.exports = {
  initScheduler
};
