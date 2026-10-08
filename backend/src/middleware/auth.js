const { verifyAccessToken } = require('../utils/jwt');

/**
 * JWT auth middleware. Verifies the access token from the Authorization header.
 * Optionally restrict to specific roles: auth(['admin'])
 */
function auth(roles = []) {
  if (typeof roles === 'string') roles = [roles];

  return (req, res, next) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.split(' ')[1] : null;

    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
      const decoded = verifyAccessToken(token);
      req.user = decoded; // { id, email, role }

      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ success: false, message: 'Insufficient permissions' });
      }

      next();
    } catch (err) {
      const message = err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token';
      return res.status(401).json({ success: false, message });
    }
  };
}

module.exports = auth;
