'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/scheduler.controller');

// GET /api/scheduler/depots — list all depots
router.get('/depots', controller.getDepots);

// GET /api/scheduler/vehicles — list all maintenance tasks
router.get('/vehicles', controller.getVehicles);

// GET /api/scheduler/optimize — run knapsack for ALL depots
router.get('/optimize', controller.optimizeAll);

// GET /api/scheduler/optimize/:depotId — run knapsack for one specific depot
router.get('/optimize/:depotId', controller.optimizeForDepot);

module.exports = router;
