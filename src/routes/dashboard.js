const express = require('express');
const { query } = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard - Returns the signed-in user's own dashboard data
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Only ever the authenticated user's own data. No fallback account.
    const userId = req.user.id;

    // 1. User info
    const user = { id: req.user.id, name: req.user.name, email: req.user.email, avatar: req.user.avatar };

    // 2. Active memberships & passes
    const passesRes = await query(
      `SELECT m.id as membership_id, m.seat_number, m.amount, m.status as membership_status, m.payment_status, m.created_at,
              g.id as group_id, g.plan, g.type,
              s.id as service_id, s.name as service_name, s.b1, s.b2,
              u.name as host_name
       FROM memberships m
       JOIN groups g ON m.group_id = g.id
       JOIN services s ON g.service_id = s.id
       JOIN users u ON g.host_id = u.id
       WHERE m.user_id = $1 AND m.status IN ('reserved', 'active')
       ORDER BY m.created_at DESC`,
      [userId]
    );

    // 3. Calculate total monthly spend
    const monthlySpend = passesRes.rows.reduce((sum, pass) => sum + parseFloat(pass.amount), 0);

    // 4. Groups hosted count
    const hostedRes = await query(
      `SELECT COUNT(*) FROM groups WHERE host_id = $1 AND is_active = true`,
      [userId]
    );
    const groupsHosted = parseInt(hostedRes.rows[0].count, 10);

    // 5. Notifications
    const notifsRes = await query(
      `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 6`,
      [userId]
    );

    res.json({
      user,
      seatsHeld: passesRes.rows.length,
      monthlySpend: Math.round(monthlySpend),
      groupsHosted,
      passes: passesRes.rows.map(p => ({
        id: p.membership_id,
        groupId: p.group_id,
        serviceKey: p.service_id,
        serviceName: p.service_name,
        plan: p.plan,
        seatNumber: p.seat_number,
        amount: parseFloat(p.amount),
        b1: p.b1,
        b2: p.b2,
        hostName: p.host_name,
        status: p.membership_status === 'active' && p.payment_status === 'paid' ? 'Active' : 'Reserved',
        paymentStatus: p.payment_status
      })),
      notifications: notifsRes.rows
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard data.' });
  }
});

module.exports = router;
