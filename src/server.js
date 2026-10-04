const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const config = require('./config');

const authRoutes = require('./routes/auth');
const servicesRoutes = require('./routes/services');
const groupsRoutes = require('./routes/groups');
const dashboardRoutes = require('./routes/dashboard');
const eventsRoutes = require('./routes/events');
const { query } = require('./db');

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: config.corsOriginCheck }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static assets from public/
app.use(express.static(path.join(__dirname, '../public')));

// Public, non-secret runtime flags for the frontend. The backend still enforces
// every one of these; the frontend only uses them to decide what to render.
app.get('/api/config', (req, res) => {
  res.json({ demoMode: config.demoEnabled, devTools: config.devToolsEnabled });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/services', servicesRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/events', eventsRoutes);

// Health check endpoint. Outside development it reveals nothing beyond "ok".
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await query('SELECT COUNT(*) as groups_count FROM groups');
    if (!config.isDevelopment) return res.json({ status: 'ok' });
    res.json({ status: 'ok', groupsCount: dbRes.rows[0].groups_count, environment: config.NODE_ENV });
  } catch (err) {
    console.error('Health check failed:', err.message);
    res.status(503).json({ status: 'error' });
  }
});

// Unknown API routes answer with JSON, never the HTML app shell
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Fallback to index.html for SPA-style routes
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(__dirname, '../public/index.html'));
  }
  next();
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: config.isDevelopment ? err.message : undefined
  });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(
      `\nSeatSwap server listening on http://localhost:${PORT} (${config.isDevelopment ? 'development' : 'strict'} mode)`
    );

    if (config.demoEnabled) {
      console.log('Demo account switching is ENABLED (development only).');
    }
  });
}

module.exports = app;
