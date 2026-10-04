const jwt = require('jsonwebtoken');
const { query } = require('../db');

const { JWT_SECRET } = require('../config');

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required. Please log in.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    const userRes = await query('SELECT id, name, email, avatar, is_host_verified, bio FROM users WHERE id = $1', [decoded.userId]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'User no longer exists.' });
    }

    req.user = userRes.rows[0];
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
      const userRes = await query('SELECT id, name, email, avatar, is_host_verified, bio FROM users WHERE id = $1', [decoded.userId]);
      if (userRes.rows.length > 0) {
        req.user = userRes.rows[0];
      }
    }
  } catch (e) {
    // Ignore invalid optional auth
  }
  next();
}

function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
}

module.exports = {
  authMiddleware,
  optionalAuth,
  generateToken
};
