const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { authMiddleware, generateToken } = require('../middleware/auth');
const { demoEnabled, DEMO_EMAILS } = require('../config');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  try {
    // Any client-supplied host/verification flags are deliberately ignored:
    // a new account is always a normal, unverified account.
    const { name, email, password } = req.body;

    if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string' || !name.trim() || !email.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const avatar = name.trim().charAt(0).toUpperCase() || 'U';

    const insertRes = await query(
      `INSERT INTO users (name, email, password_hash, avatar, is_host_verified, bio)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, avatar, is_host_verified, bio, created_at`,
      [name.trim(), email.trim().toLowerCase(), passwordHash, avatar, false, 'SeatSwap Member']
    );

    const user = insertRes.rows[0];
    const token = generateToken(user.id);

    // Initial welcome notification
    await query(
      `INSERT INTO notifications (user_id, title, type) VALUES ($1, $2, $3)`,
      [user.id, `Welcome to SeatSwap, ${user.name}! Browse groups or list a plan you want to share.`, 'info']
    );

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const userRes = await query(
      'SELECT id, name, email, password_hash, avatar, is_host_verified, bio, created_at FROM users WHERE email = $1',
      [email.trim().toLowerCase()]
    );

    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = userRes.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    delete user.password_hash;
    const token = generateToken(user.id);

    res.json({
      message: 'Logged in successfully',
      token,
      user
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in.' });
  }
});

// Get current user details + memberships & hosted groups
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get active memberships
    const memRes = await query(
      `SELECT m.id, m.group_id, m.seat_number, m.amount, m.status, m.created_at,
              g.plan, g.type, s.id as service_id, s.name as service_name, s.b1, s.b2,
              u.name as host_name
       FROM memberships m
       JOIN groups g ON m.group_id = g.id
       JOIN services s ON g.service_id = s.id
       JOIN users u ON g.host_id = u.id
       WHERE m.user_id = $1 AND m.status IN ('reserved', 'active')
       ORDER BY m.created_at DESC`,
      [userId]
    );

    // Get hosted groups
    const hostedRes = await query(
      `SELECT g.*, s.name as service_name, s.b1, s.b2,
              (SELECT COUNT(*) FROM seats WHERE group_id = g.id AND status IN ('mem', 'rsv', 'act')) as taken_seats
       FROM groups g
       JOIN services s ON g.service_id = s.id
       WHERE g.host_id = $1
       ORDER BY g.created_at DESC`,
      [userId]
    );

    // Get unread notifications count
    const notifRes = await query(
      `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
      [userId]
    );

    res.json({
      user: req.user,
      memberships: memRes.rows,
      hostedGroups: hostedRes.rows,
      unreadNotifications: parseInt(notifRes.rows[0].count, 10)
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Failed to fetch user profile.' });
  }
});

// ---- Demo accounts (development only) ---------------------------------------
// Passwordless sign-in as a seeded account. This is NOT authentication. The
// routes only exist when DEMO_MODE=true in a development environment; in any
// other environment they answer 404 and never issue a token.
function demoOnly(req, res, next) {
  if (!demoEnabled) return res.status(404).json({ error: 'Not found.' });
  next();
}

router.get('/demo-users', demoOnly, async (req, res) => {
  try {
    const result = await query(
      `SELECT id, name, email, avatar, is_host_verified, bio FROM users
       WHERE email = ANY($1) ORDER BY id ASC`,
      [DEMO_EMAILS]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Demo users error:', err);
    res.status(500).json({ error: 'Failed to load demo accounts.' });
  }
});

router.post('/switch-demo', demoOnly, async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    // Only the fixed allow-list of seeded demo accounts can be targeted; never an arbitrary user id.
    if (!DEMO_EMAILS.includes(email)) {
      return res.status(400).json({ error: 'Not a demo account.' });
    }
    const userRes = await query(
      'SELECT id, name, email, avatar, is_host_verified, bio FROM users WHERE email = $1',
      [email]
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Demo user not found. Run the seed script.' });
    }
    const user = userRes.rows[0];
    res.json({ message: `Switched to demo user ${user.name}`, token: generateToken(user.id), user });
  } catch (err) {
    console.error('Switch demo error:', err);
    res.status(500).json({ error: 'Failed to switch demo account.' });
  }
});

module.exports = router;
