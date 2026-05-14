'use strict';

require('dotenv').config();

const express = require('express');
const { requestLogger, Log } = require('./middleware/logger');
const demoRoutes = require('./routes/demo.routes');

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware — registered FIRST, before all routes
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api', demoRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  Log('backend', 'error', 'middleware', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\x1b[36m[logging-middleware] Server running on http://localhost:${PORT}\x1b[0m`);
  await Log('backend', 'info', 'middleware', `Server started on port ${PORT}`);
  console.log('Demo routes:');
  console.log(`  GET  http://localhost:${PORT}/api/health`);
  console.log(`  GET  http://localhost:${PORT}/api/echo`);
  console.log(`  POST http://localhost:${PORT}/api/echo`);
  console.log(`  GET  http://localhost:${PORT}/api/slow`);
  console.log(`  GET  http://localhost:${PORT}/api/not-found`);
  console.log(`  GET  http://localhost:${PORT}/api/error`);
});

module.exports = app;
