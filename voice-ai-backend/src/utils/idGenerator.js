const crypto = require('crypto');

/**
 * Generates an 8-character uppercase alphanumeric ID with a prefix.
 * Example outputs: PAT-8F29K31A, DOC-77291045, AST-94281745, CASE-87654321, REF-19283746
 */
function generateCustomId(prefix) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let result = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return `${prefix}-${result}`;
}

module.exports = {
  generateCustomId,
  generatePatientId: () => generateCustomId('PAT'),
  generateDoctorId: () => generateCustomId('DOC'),
  generateAssistantId: () => generateCustomId('AST'),
  generateCaseId: () => generateCustomId('CASE'),
  generateReferralId: () => generateCustomId('REF')
};
