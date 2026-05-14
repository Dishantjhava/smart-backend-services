'use strict';

// Global error handler middleware
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${err.message}`);

  // Handle axios errors from external API calls
  if (err.response) {
    const { status, data } = err.response;
    return res.status(status).json({
      success: false,
      error: 'External API error',
      details: data,
      statusCode: status,
    });
  }

  // Handle network errors (no response received)
  if (err.request) {
    return res.status(503).json({
      success: false,
      error: 'External API unreachable — check your network or credentials',
    });
  }

  // Generic error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
}

module.exports = errorHandler;
