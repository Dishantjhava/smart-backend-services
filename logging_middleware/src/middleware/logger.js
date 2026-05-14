'use strict';

/**
 * Reusable Logging Middleware
 *
 * Exports:
 *   Log(stack, level, pkg, message) — POSTs log entry to the evaluation test server
 *   requestLogger                   — Express middleware using Log() for every HTTP request
 *
 * Valid parameter values (enforced by the test server):
 *   stack   : 'backend' | 'frontend'
 *   level   : 'info' | 'warn' | 'error' | 'debug'
 *   pkg     : 'middleware' | 'controller' | 'service'
 *   message : string, max 48 characters
 */

const axios = require('axios');

const LOG_ENDPOINT  = 'http://4.224.186.213/evaluation-service/logs';
const AUTH_ENDPOINT = 'http://4.224.186.213/evaluation-service/auth';

let _token = null;
let _tokenExpiry = 0;

async function _getToken() {
  const now = Math.floor(Date.now() / 1000);
  if (_token && now < _tokenExpiry - 60) return _token;
  const r = await axios.post(AUTH_ENDPOINT, {
    name:         process.env.REG_NAME,
    email:        process.env.REG_EMAIL,
    rollNo:       process.env.ROLL_NO,
    accessCode:   process.env.ACCESS_CODE,
    clientID:     process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  });
  _token = r.data.access_token;
  _tokenExpiry = r.data.expires_in;
  return _token;
}

/**
 * Log(stack, level, pkg, message)
 * Posts a structured log entry to the evaluation test server.
 * Falls back to console if the API call fails — never crashes the app.
 */
async function Log(stack, level, pkg, message) {
  const trimmed = String(message).slice(0, 48);
  try {
    const token = await _getToken();
    await axios.post(
      LOG_ENDPOINT,
      { stack, level, package: pkg, message: trimmed },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error(`[Log fallback] ${level.toUpperCase()} [${stack}/${pkg}] ${trimmed} | err: ${errMsg}`);
  }
}

/**
 * Express HTTP request logging middleware.
 * Logs method, route, status code, and response time via Log().
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();
  Log('backend', 'info', 'middleware', `${req.method} ${req.originalUrl}`);

  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    const msg = `${req.method} ${req.path} ${res.statusCode} ${responseTime}ms`;
    Log('backend', level, 'middleware', msg);
    const color = level === 'error' ? '\x1b[31m' : level === 'warn' ? '\x1b[33m' : '\x1b[32m';
    console.log(`${color}[${new Date().toISOString()}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${responseTime}ms)\x1b[0m`);
  });

  next();
}

module.exports = { Log, requestLogger };
