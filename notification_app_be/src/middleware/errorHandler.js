'use strict';

function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${err.message}`);

  if (err.response) {
    return res.status(err.response.status).json({
      success: false,
      error: 'External API error',
      details: err.response.data,
    });
  }

  if (err.request) {
    return res.status(503).json({
      success: false,
      error: 'External API unreachable — check credentials in .env',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
