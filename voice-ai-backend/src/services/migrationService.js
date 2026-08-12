const { getDb, isDbConnected } = require('../config/db');
const idGen = require('../utils/idGenerator');

/**
 * Migration & Backfill Service
 * Ensures all registered users, patients, doctors, assistants, cases, and referrals
 * have proper, permanent, unique formatted IDs (PAT-XXXXXXXX, DOC-XXXXXXXX, AST-XXXXXXXX, CASE-XXXXXXXX, REF-XXXXXXXX).
 */
async function backfillUniqueIds() {
  if (!isDbConnected()) {
    console.log('[MigrationService] DB not connected. Skipping backfill.');
    return;
  }

  try {
    const db = getDb();
    console.log('[MigrationService] Starting unique ID backfill check...');

    // 1. Ensure unique indexes
    try {
      await db.collection('users').createIndex({ email: 1 }, { unique: true });
      await db.collection('patients').createIndex({ patientId: 1 }, { unique: true, sparse: true });
      await db.collection('doctors').createIndex({ doctorId: 1 }, { unique: true, sparse: true });
      await db.collection('assistants').createIndex({ assistantId: 1 }, { unique: true, sparse: true });
      await db.collection('cases').createIndex({ caseId: 1 }, { unique: true, sparse: true });
      await db.collection('referrals').createIndex({ referralId: 1 }, { unique: true, sparse: true });
    } catch (e) {
      console.log('[MigrationService] Indexes already exist or created with warnings:', e.message);
    }

    // 2. Backfill Users, Patients, Doctors, Assistants
    const users = await db.collection('users').find({}).toArray();

    for (const u of users) {
      let updated = false;
      const updateFields = {};

      if (u.role === 'patient') {
        if (!u.patientId || !u.patientId.startsWith('PAT-')) {
          const newPatientId = idGen.generatePatientId();
          updateFields.patientId = newPatientId;
          updated = true;

          // Sync to patients collection
          await db.collection('patients').updateOne(
            { userId: u.userId },
            {
              $set: {
                patientId: newPatientId,
                userId: u.userId,
                name: u.name,
                email: u.email,
                phone: u.phone || '',
                updatedAt: new Date()
              }
            },
            { upsert: true }
          );

          // Update cases and referrals if old ID was used
          if (u.patientId) {
            await db.collection('cases').updateMany({ patientId: u.patientId }, { $set: { patientId: newPatientId } });
            await db.collection('referrals').updateMany({ patientId: u.patientId }, { $set: { patientId: newPatientId } });
          }
        }
      } else if (u.role === 'doctor') {
        if (!u.doctorId || !u.doctorId.startsWith('DOC-')) {
          const newDoctorId = idGen.generateDoctorId();
          updateFields.doctorId = newDoctorId;
          updated = true;

          // Sync to doctors collection
          await db.collection('doctors').updateOne(
            { userId: u.userId },
            {
              $set: {
                doctorId: newDoctorId,
                userId: u.userId,
                name: u.name,
                email: u.email,
                specialty: u.specialty || 'General Medicine',
                onlineStatus: u.onlineStatus || 'ONLINE',
                updatedAt: new Date()
              }
            },
            { upsert: true }
          );

          if (u.doctorId) {
            await db.collection('cases').updateMany({ assignedDoctorId: u.doctorId }, { $set: { assignedDoctorId: newDoctorId } });
            await db.collection('referrals').updateMany({ doctorId: u.doctorId }, { $set: { doctorId: newDoctorId } });
          }
        }
      } else if (u.role === 'assistant') {
        if (!u.assistantId || !u.assistantId.startsWith('AST-')) {
          const newAssistantId = idGen.generateAssistantId();
          updateFields.assistantId = newAssistantId;
          updated = true;

          // Sync to assistants collection
          await db.collection('assistants').updateOne(
            { userId: u.userId },
            {
              $set: {
                assistantId: newAssistantId,
                userId: u.userId,
                name: u.name,
                email: u.email,
                phone: u.phone || '+91 98765 43210',
                updatedAt: new Date()
              }
            },
            { upsert: true }
          );

          if (u.assistantId) {
            await db.collection('cases').updateMany({ assistantId: u.assistantId }, { $set: { assistantId: newAssistantId } });
            await db.collection('referrals').updateMany({ assistantId: u.assistantId }, { $set: { assistantId: newAssistantId } });
          }
        }
      }

      if (updated) {
        await db.collection('users').updateOne({ _id: u._id }, { $set: updateFields });
      }
    }

    // 3. Backfill Cases format (CASE-XXXXXXXX)
    const cases = await db.collection('cases').find({}).toArray();
    for (const c of cases) {
      if (c.caseId && !c.caseId.startsWith('CASE-')) {
        const newCaseId = idGen.generateCaseId();
        await db.collection('cases').updateOne({ _id: c._id }, { $set: { caseId: newCaseId } });
        await db.collection('referrals').updateMany({ caseId: c.caseId }, { $set: { caseId: newCaseId } });
      }
    }

    // 4. Backfill Referrals format (REF-XXXXXXXX)
    const referrals = await db.collection('referrals').find({}).toArray();
    for (const r of referrals) {
      if (r.referralId && !r.referralId.startsWith('REF-')) {
        const newRefId = idGen.generateReferralId();
        await db.collection('referrals').updateOne({ _id: r._id }, { $set: { referralId: newRefId } });
      }
    }

    console.log('[MigrationService] Backfill unique IDs completed successfully.');
  } catch (err) {
    console.error('[MigrationService] Error during backfill:', err.message);
  }
}

module.exports = {
  backfillUniqueIds
};
