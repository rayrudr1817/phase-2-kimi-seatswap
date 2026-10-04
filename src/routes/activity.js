const express = require('express');
const { query } = require('../db');

const router = express.Router();

// GET /api/activity - Returns latest activity feed
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT a.id, a.tag, a.message, a.created_at,
              COALESCE(s.name, '') as service_name
       FROM activity_logs a
       LEFT JOIN groups g ON a.group_id = g.id
       LEFT JOIN services s ON g.service_id = s.id
       ORDER BY a.created_at DESC
       LIMIT 15`
    );

    // Format time ago relative string
    const now = Date.now();
    const formatted = result.rows.map(row => {
      const diffSec = Math.floor((now - new Date(row.created_at).getTime()) / 1000);
      let timeAgo = 'just now';
      if (diffSec >= 60 && diffSec < 3600) {
        timeAgo = `${Math.floor(diffSec / 60)} min`;
      } else if (diffSec >= 3600 && diffSec < 86400) {
        timeAgo = `${Math.floor(diffSec / 3600)} h`;
      } else if (diffSec >= 86400) {
        timeAgo = `${Math.floor(diffSec / 86400)} d`;
      }

      return {
        id: row.id,
        tag: row.tag || 'g',
        message: row.message,
        timeAgo,
        createdAt: row.created_at
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error('Activity error:', err);
    res.status(500).json({ error: 'Failed to fetch activity logs.' });
  }
});

module.exports = router;
