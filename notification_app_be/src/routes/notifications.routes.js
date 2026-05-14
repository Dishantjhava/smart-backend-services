'use strict';

const express = require('express');
const router = express.Router();
const controller = require('../controllers/notifications.controller');

// GET /api/notifications — all notifications from external API
router.get('/', controller.getAllNotifications);

// GET /api/notifications/priority?n=10 — top-n priority inbox via Min-Heap
router.get('/priority', controller.getPriorityInbox);

// POST /api/notifications/priority/insert — insert new notification, recalculate top-n
router.post('/priority/insert', controller.insertAndGetPriority);

module.exports = router;
