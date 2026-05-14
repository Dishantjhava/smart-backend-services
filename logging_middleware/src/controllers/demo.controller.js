'use strict';

const health = (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'logging-middleware-demo',
    timestamp: new Date().toISOString(),
  });
};

const echo = (req, res) => {
  res.status(200).json({
    message: 'Echo — request details captured below',
    method: req.method,
    path: req.path,
    query: req.query,
    headers: req.headers,
    body: req.body,
  });
};

const slow = async (req, res) => {
  // Artificial 1.5s delay to demonstrate responseTime logging
  await new Promise((resolve) => setTimeout(resolve, 1500));
  res.status(200).json({
    message: 'Slow response completed',
    delayMs: 1500,
  });
};

const notFound = (req, res) => {
  res.status(404).json({ error: 'Resource not found' });
};

const serverError = (req, res) => {
  res.status(500).json({ error: 'Internal server error (simulated)' });
};

module.exports = { health, echo, slow, notFound, serverError };
