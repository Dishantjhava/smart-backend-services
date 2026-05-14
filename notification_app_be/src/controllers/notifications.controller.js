'use strict';

const { fetchNotifications } = require('../services/externalApi.service');
const { getTopN, computeScore } = require('../services/priorityQueue.service');
const { Log } = require('../middleware/logger');

const getAllNotifications = async (req, res, next) => {
  try {
    Log('backend', 'info', 'controller', 'Fetching all notifications');
    const notifications = await fetchNotifications();
    Log('backend', 'info', 'controller', `Fetched ${notifications.length} notifications`);
    res.status(200).json({ success: true, count: notifications.length, notifications });
  } catch (err) {
    Log('backend', 'error', 'controller', 'Notification fetch failed');
    next(err);
  }
};

const getPriorityInbox = async (req, res, next) => {
  try {
    const n = parseInt(req.query.n, 10) || 10;
    if (n <= 0) {
      Log('backend', 'warn', 'controller', `Invalid n param: ${n}`);
      return res.status(400).json({ success: false, error: 'n must be a positive integer' });
    }

    Log('backend', 'info', 'controller', `Building priority inbox n=${n}`);
    const notifications = await fetchNotifications();
    const topN = getTopN(notifications, n);
    Log('backend', 'info', 'controller', `Priority inbox built: ${topN.length} items`);

    res.status(200).json({
      success: true,
      requested: n,
      returned: topN.length,
      algorithm: 'Min-Heap (O(log n) per insertion)',
      priorityWeights: { Placement: 3, Result: 2, Event: 1 },
      priorityInbox: topN.map((notif) => ({
        id: notif.ID || notif.id,
        type: notif.Type || notif.type,
        message: notif.Message || notif.message,
        timestamp: notif.Timestamp || notif.sentAt,
        priorityScore: notif.score,
      })),
    });
  } catch (err) {
    Log('backend', 'error', 'controller', 'Priority inbox build failed');
    next(err);
  }
};

const insertAndGetPriority = async (req, res, next) => {
  try {
    const { newNotification, n = 10 } = req.body;
    if (!newNotification) {
      return res.status(400).json({ success: false, error: 'newNotification is required' });
    }

    Log('backend', 'info', 'controller', 'Inserting notification into heap');
    const existing = await fetchNotifications();
    const allNotifications = [...existing, newNotification];
    const topN = getTopN(allNotifications, n);
    Log('backend', 'info', 'controller', `Heap updated: top ${n} recalculated`);

    res.status(200).json({
      success: true,
      message: `New notification inserted and top ${n} recalculated`,
      newNotification: { ...newNotification, priorityScore: computeScore(newNotification) },
      priorityInbox: topN.map((notif) => ({
        id: notif.ID || notif.id,
        type: notif.Type || notif.type,
        message: notif.Message || notif.message,
        timestamp: notif.Timestamp || notif.sentAt,
        priorityScore: notif.score,
      })),
    });
  } catch (err) {
    Log('backend', 'error', 'controller', 'Heap insert failed');
    next(err);
  }
};

module.exports = { getAllNotifications, getPriorityInbox, insertAndGetPriority };
