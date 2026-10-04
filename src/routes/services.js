const express = require('express');
const { query } = require('../db');

const router = express.Router();

// Get all services
router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT id, name, category, b1, b2, default_plan, typical_price, max_seats FROM services ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Get services error:', err);
    res.status(500).json({ error: 'Failed to fetch services.' });
  }
});

module.exports = router;
