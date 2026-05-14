'use strict';

require('dotenv').config();

const express = require('express');
const { requestLogger, Log } = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const schedulerRoutes = require('./routes/scheduler.routes');

const REQUIRED_ENV = ['ROLL_NO', 'CLIENT_ID', 'CLIENT_SECRET', 'REG_NAME', 'REG_EMAIL', 'ACCESS_CODE'];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`\x1b[31m[FATAL] Missing environment variables: ${missing.join(', ')}\x1b[0m`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3002;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());

// Logging middleware — registered FIRST, before all routes
app.use(requestLogger);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'vehicle-maintence-scheduler' });
});

app.use('/api/scheduler', schedulerRoutes);

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ success: false, error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler — must be last
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, async () => {
  console.log(`\x1b[36m[vehicle-maintence-scheduler] Running on http://localhost:${PORT}\x1b[0m`);
  await Log('backend', 'info', 'middleware', `Server started on port ${PORT}`);
  console.log('Endpoints:');
  console.log(`  GET  http://localhost:${PORT}/api/scheduler/depots`);
  console.log(`  GET  http://localhost:${PORT}/api/scheduler/vehicles`);
  console.log(`  GET  http://localhost:${PORT}/api/scheduler/optimize`);
  console.log(`  GET  http://localhost:${PORT}/api/scheduler/optimize/:depotId`);
});

module.exports = app;
