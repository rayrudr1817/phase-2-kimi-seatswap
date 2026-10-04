const express = require('express');
const { query, getClient } = require('../db');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { broadcast } = require('../utils/events');

const router = express.Router();

// Helper to format groups with seat status array matching the frontend expectation
async function enrichGroupsWithSeats(groupsRows, currentUserId = null) {
  if (groupsRows.length === 0) return [];

  const groupIds = groupsRows.map(g => g.id);
  const seatsRes = await query(
    `SELECT group_id, seat_number, status, member_id FROM seats
     WHERE group_id = ANY($1)
     ORDER BY group_id, seat_number ASC`,
    [groupIds]
  );

  const seatMap = {};
  for (const s of seatsRes.rows) {
    if (!seatMap[s.group_id]) seatMap[s.group_id] = [];
    // The viewing user's own seat keeps its real status ('rsv' = reserved, payment pending);
    // isCurrentUser lets the UI mark it as "yours".
    // Other members' reservations are just "taken" to everyone else.
    const isMine = !!currentUserId && s.member_id === currentUserId;
    const visibleStatus = (s.status === 'rsv' && !isMine) ? 'mem' : s.status;
    seatMap[s.group_id].push({
      seatNumber: s.seat_number,
      status: visibleStatus,
      isCurrentUser: currentUserId ? s.member_id === currentUserId : false
    });
  }

  return groupsRows.map(g => {
    const seats = seatMap[g.id] || [];
    const seatStatuses = seats.map(s => s.status);
    const openSeatsCount = seats.filter(s => s.status === 'open').length;
    const takenSeatsCount = seats.filter(s => s.status === 'mem' || s.status === 'rsv' || s.status === 'act').length;

    return {
      id: g.id,
      svc: g.service_id,
      serviceName: g.service_name,
      plan: g.plan,
      type: g.type,
      price: parseFloat(g.price),
      total: g.total_seats,
      taken: takenSeatsCount,
      openSeats: openSeatsCount,
      host: g.host_name,
      hostId: g.host_id,
      days: g.days_ago,
      seats: seatStatuses,
      seatsDetails: seats,
      b1: g.b1,
      b2: g.b2
    };
  });
}

// GET /api/groups - List all groups with filters
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { q, svc, maxPrice, openOnly, sort } = req.query;
    const currentUserId = req.user ? req.user.id : null;

    let sql = `
      SELECT g.*, s.name as service_name, s.b1, s.b2, u.name as host_name
      FROM groups g
      JOIN services s ON g.service_id = s.id
      JOIN users u ON g.host_id = u.id
      WHERE g.is_active = true
    `;
    const params = [];

    if (svc && svc !== 'All') {
      params.push(svc);
      sql += ` AND g.service_id = $${params.length}`;
    }

    if (maxPrice) {
      params.push(parseFloat(maxPrice));
      sql += ` AND g.price <= $${params.length}`;
    }

    if (q && q.trim()) {
      const term = `%${q.trim().toLowerCase()}%`;
      params.push(term);
      sql += ` AND (
        LOWER(s.name) LIKE $${params.length} OR
        LOWER(g.plan) LIKE $${params.length} OR
        LOWER(u.name) LIKE $${params.length} OR
        LOWER(g.type) LIKE $${params.length} OR
        LOWER(s.category) LIKE $${params.length}
      )`;
    }

    sql += ` ORDER BY g.days_ago ASC, g.created_at DESC`;

    const result = await query(sql, params);
    let enriched = await enrichGroupsWithSeats(result.rows, currentUserId);

    if (openOnly === 'true') {
      enriched = enriched.filter(g => g.openSeats > 0);
    }

    if (sort === 'price') {
      enriched.sort((a, b) => a.price - b.price);
    } else if (sort === 'seats') {
      enriched.sort((a, b) => b.openSeats - a.openSeats);
    } else if (sort === 'new') {
      enriched.sort((a, b) => a.days - b.days);
    }

    res.json(enriched);
  } catch (err) {
    console.error('Get groups error:', err);
    res.status(500).json({ error: 'Failed to fetch groups.' });
  }
});

// GET /api/groups/:id - Single group details
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user ? req.user.id : null;

    const groupRes = await query(
      `SELECT g.*, s.name as service_name, s.category, s.b1, s.b2,
              u.name as host_name, u.avatar as host_avatar, u.bio as host_bio
       FROM groups g
       JOIN services s ON g.service_id = s.id
       JOIN users u ON g.host_id = u.id
       WHERE g.id = $1`,
      [id]
    );

    if (groupRes.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found.' });
    }

    const enriched = await enrichGroupsWithSeats(groupRes.rows, currentUserId);
    res.json(enriched[0]);
  } catch (err) {
    console.error('Get single group error:', err);
    res.status(500).json({ error: 'Failed to fetch group details.' });
  }
});

// POST /api/groups - Host creates a new group
router.post('/', authMiddleware, async (req, res) => {
  const client = await getClient();
  try {
    const { serviceId, plan, type, totalPrice, totalSeats } = req.body;
    const hostId = req.user.id;

    if (!serviceId || !type || !totalPrice || !totalSeats) {
      return res.status(400).json({ error: 'serviceId, type, totalPrice, and totalSeats are required.' });
    }

    const seatsCount = parseInt(totalSeats, 10);
    if (isNaN(seatsCount) || seatsCount < 2 || seatsCount > 12) {
      return res.status(400).json({ error: 'totalSeats must be between 2 and 12.' });
    }

    const totalPriceNum = parseFloat(totalPrice);
    if (isNaN(totalPriceNum) || totalPriceNum <= 0) {
      return res.status(400).json({ error: 'Valid total plan price is required.' });
    }

    // Auto-calculate per-seat price
    const pricePerSeat = Math.round((totalPriceNum / seatsCount) * 100) / 100;

    // Verify service exists
    const serviceRes = await client.query('SELECT * FROM services WHERE id = $1', [serviceId]);
    if (serviceRes.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid service selected.' });
    }

    const service = serviceRes.rows[0];

    // Enforce service max_seats
    if (service.max_seats && seatsCount > service.max_seats) {
      return res.status(400).json({ error: `${service.name} supports a maximum of ${service.max_seats} seats.` });
    }

    // Use provided plan name or fall back to service default
    const planName = (plan && plan.trim()) ? plan.trim() : (service.default_plan || type + ' plan');

    await client.query('BEGIN');

    // Generate new unique ID
    const countRes = await client.query('SELECT COUNT(*) FROM groups');
    const nextNum = 1042 + parseInt(countRes.rows[0].count, 10);
    let newGroupId = `P-${nextNum}`;

    // Ensure uniqueness
    const existsRes = await client.query('SELECT id FROM groups WHERE id = $1', [newGroupId]);
    if (existsRes.rows.length > 0) {
      newGroupId = `P-${nextNum}-${Date.now().toString().slice(-4)}`;
    }

    // No verification workflow exists yet, so a new group is never marked host-checked,
    // whatever the user's stored boolean says.
    const hostCheck = false;

    // Insert group (price stored is per-seat price)
    const groupInsert = await client.query(
      `INSERT INTO groups (id, service_id, plan, type, price, total_seats, host_id, host_check_passed, days_ago)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0)
       RETURNING *`,
      [newGroupId, serviceId, planName, type.trim(), pricePerSeat, seatsCount, hostId, hostCheck]
    );

    // Create all seats for this group (all open initially)
    for (let i = 1; i <= seatsCount; i++) {
      await client.query(
        `INSERT INTO seats (group_id, seat_number, status) VALUES ($1, $2, 'open')`,
        [newGroupId, i]
      );
    }

    // Log activity
    const sName = service.name;
    await client.query(
      `INSERT INTO activity_logs (tag, message, group_id, user_id)
       VALUES ('b', $1, $2, $3)`,
      [`New group listed: ${sName} (${planName}) hosted by ${req.user.name}`, newGroupId, hostId]
    );

    // Notification for host
    await client.query(
      `INSERT INTO notifications (user_id, title, type)
       VALUES ($1, $2, 'success')`,
      [hostId, `Your ${sName} group ${newGroupId} is listed with ${seatsCount} seats. Host verification is not part of this prototype yet.`]
    );

    await client.query('COMMIT');

    const created = await enrichGroupsWithSeats([groupInsert.rows[0]], hostId);

    // Notify connected clients so their lists refresh
    broadcast('group_created', { group: created[0] });

    res.status(201).json({
      message: 'Group listed.',
      group: created[0]
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Failed to create group.' });
  } finally {
    client.release();
  }
});

// POST /api/groups/:id/seats/:seatNum/join - Atomic seat reservation (payment pending; nothing is charged or activated)
router.post('/:id/seats/:seatNum/join', authMiddleware, async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const seatNum = parseInt(req.params.seatNum, 10);
    const userId = req.user.id;

    if (isNaN(seatNum) || seatNum < 1) {
      return res.status(400).json({ error: 'Invalid seat number.' });
    }

    // BEGIN TRANSACTION
    await client.query('BEGIN');

    // Lock the group
    const groupRes = await client.query(
      `SELECT g.*, s.name as service_name FROM groups g
       JOIN services s ON g.service_id = s.id
       WHERE g.id = $1 FOR SHARE`,
      [id]
    );

    if (groupRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Group does not exist.' });
    }

    const group = groupRes.rows[0];

    // The host already holds the plan; they do not take a paid seat in their own group.
    if (group.host_id === userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You are the host of this group, so you cannot take a member seat in it.' });
    }

    // One seat per member per group.
    const dupRes = await client.query(
      `SELECT 1 FROM seats WHERE group_id = $1 AND member_id = $2 LIMIT 1`,
      [id, userId]
    );
    if (dupRes.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'You already hold a seat in this group.' });
    }

    // Lock the specific seat row with FOR UPDATE (CRUCIAL CONCURRENCY LOCK)
    const seatRes = await client.query(
      `SELECT * FROM seats WHERE group_id = $1 AND seat_number = $2 FOR UPDATE`,
      [id, seatNum]
    );

    if (seatRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: `Seat ${seatNum} not found in group ${id}.` });
    }

    const seat = seatRes.rows[0];

    // Check if the user already holds this seat
    if (seat.member_id === userId && seat.status === 'rsv') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You have already reserved this seat.' });
    }

    // Server check: is the seat actually free?
    if (seat.status !== 'open') {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: `Seat ${seatNum} is no longer available.`
      });
    }

    // Mark the seat 'rsv' (reserved, payment pending). It only becomes 'act' once a real
    // payment exists, which this prototype does not have.
    await client.query(
      `UPDATE seats
       SET status = 'rsv', member_id = $1, reserved_at = NOW()
       WHERE id = $2`,
      [userId, seat.id]
    );

    // Record membership
    await client.query(
      `INSERT INTO memberships (user_id, group_id, seat_id, seat_number, amount, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, 'reserved', 'pending')`,
      [userId, id, seat.id, seatNum, group.price]
    );

    // Log public activity
    const activityMsg = `Seat ${seatNum} was reserved in a ${group.service_name} group`;
    await client.query(
      `INSERT INTO activity_logs (tag, message, group_id, user_id)
       VALUES ('g', $1, $2, $3)`,
      [activityMsg, id, userId]
    );

    // Notification for member
    await client.query(
      `INSERT INTO notifications (user_id, title, type)
       VALUES ($1, $2, 'info')`,
      [userId, `You reserved Seat ${seatNum} in ${group.service_name} (${group.plan}). No payment was taken: payments are simulated in this prototype.`]
    );

    // Notification for host if different user
    if (group.host_id !== userId) {
      await client.query(
        `INSERT INTO notifications (user_id, title, type)
         VALUES ($1, $2, 'info')`,
        [group.host_id, `${req.user.name} reserved Seat ${seatNum} in your ${group.service_name} group. Payment is still pending.`]
      );
    }

    // COMMIT TRANSACTION
    await client.query('COMMIT');

    // Everyone else only needs to know the seat is taken; who reserved it stays private.
    broadcast('seat_updated', {
      groupId: id,
      seatNumber: seatNum,
      status: 'mem'
    });

    res.json({
      success: true,
      message: `Seat ${seatNum} reserved. No payment was taken: payments are simulated in this prototype.`,
      groupId: id,
      seatNumber: seatNum,
      status: 'rsv'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Join seat error:', err);
    res.status(500).json({ error: 'Failed to join seat due to server error.' });
  } finally {
    client.release();
  }
});

// POST /api/groups/:id/seats/:seatNum/leave - Leave a seat
router.post('/:id/seats/:seatNum/leave', authMiddleware, async (req, res) => {
  const client = await getClient();
  try {
    const { id } = req.params;
    const seatNum = parseInt(req.params.seatNum, 10);
    const userId = req.user.id;

    if (isNaN(seatNum) || seatNum < 1) {
      return res.status(400).json({ error: 'Invalid seat number.' });
    }

    await client.query('BEGIN');

    const seatRes = await client.query(
      `SELECT * FROM seats WHERE group_id = $1 AND seat_number = $2 FOR UPDATE`,
      [id, seatNum]
    );

    if (seatRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Seat not found.' });
    }

    const seat = seatRes.rows[0];
    if (seat.member_id !== userId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'You do not own this seat.' });
    }

    // Release seat back to 'open'
    await client.query(
      `UPDATE seats SET status = 'open', member_id = NULL, reserved_at = NULL, activated_at = NULL WHERE id = $1`,
      [seat.id]
    );

    // Cancel membership
    await client.query(
      `UPDATE memberships SET status = 'cancelled' WHERE seat_id = $1 AND user_id = $2 AND status IN ('reserved', 'active')`,
      [seat.id, userId]
    );

    // Log activity
    await client.query(
      `INSERT INTO activity_logs (tag, message, group_id, user_id)
       VALUES ('o', $1, $2, $3)`,
      [`A seat opened in group ${id}`, id, userId]
    );

    await client.query('COMMIT');

    broadcast('seat_updated', {
      groupId: id,
      seatNumber: seatNum,
      status: 'open'
    });

    res.json({ success: true, message: `You left Seat ${seatNum}.` });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Leave seat error:', err);
    res.status(500).json({ error: 'Failed to leave seat.' });
  } finally {
    client.release();
  }
});

module.exports = router;
