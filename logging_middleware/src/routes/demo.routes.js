'use strict';

const express = require('express');
const router = express.Router();
const demoController = require('../controllers/demo.controller');

// Health check
router.get('/health', demoController.health);

// Echo route — returns method, path, headers, query, body back to caller
router.get('/echo', demoController.echo);
router.post('/echo', demoController.echo);

// Simulate a slow response (to showcase responseTime logging)
router.get('/slow', demoController.slow);

// Simulate a 404
router.get('/not-found', demoController.notFound);

// Simulate a 500
router.get('/error', demoController.serverError);

module.exports = router;
