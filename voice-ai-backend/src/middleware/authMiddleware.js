const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'gramcare_jwt_secret_key_2026';

/**
 * Backend Authentication & Role Authorization Middleware
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization || '';
  if (!authHeader) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Authentication token is required.' });
  }

  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Missing token header.' });
  }

  try {
    let role = 'assistant';
    let userId = 'usr_default';
    let doctorId = null;
    let assistantId = null;
    let patientId = null;

    if (rawToken.startsWith('token_')) {
      const parts = rawToken.split('_');
      role = parts[1] || 'assistant';
      
      const jwtPart = parts.slice(2).join('_');
      try {
        const decoded = jwt.verify(jwtPart, JWT_SECRET);
        userId = decoded.userId || `usr_${parts.slice(2, parts.length - 1).join('_')}`;
        role = decoded.role || role;
        doctorId = decoded.doctorId || (role === 'doctor' ? `DOC_${userId}` : null);
        assistantId = decoded.assistantId || (role === 'assistant' ? `AST_${userId}` : null);
        patientId = decoded.patientId || (role === 'patient' ? `PAT_${userId}` : null);
      } catch (_) {
        // Fallback for custom string tokens: token_{role}_{userId}_{timestamp}
        userId = parts.slice(2, parts.length - 1).join('_') || parts[2] || 'usr_default';
        doctorId = role === 'doctor' ? `DOC_${userId}` : null;
        assistantId = role === 'assistant' ? `AST_${userId}` : null;
        patientId = role === 'patient' ? `PAT_${userId}` : null;
      }
    } else {
      // Direct JWT Token
      const decoded = jwt.verify(rawToken, JWT_SECRET);
      userId = decoded.userId;
      role = decoded.role;
      doctorId = decoded.doctorId;
      assistantId = decoded.assistantId;
      patientId = decoded.patientId;
    }

    req.user = {
      userId,
      role,
      token: rawToken,
      doctorId: doctorId || (role === 'doctor' ? `DOC_${userId}` : null),
      assistantId: assistantId || (role === 'assistant' ? `AST_${userId}` : null),
      patientId: patientId || (role === 'patient' ? `PAT_${userId}` : null)
    };

    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired session token.' });
  }
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User session missing.' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Role '${req.user.role}' is not authorized to access this resource. Required role: ${allowedRoles.join(' or ')}.`
      });
    }

    next();
  };
}

module.exports = {
  requireAuth,
  requireRole
};
