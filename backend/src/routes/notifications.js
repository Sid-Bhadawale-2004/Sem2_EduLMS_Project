const express = require('express');
const { authenticate } = require('../middleware/auth');
const { Notification } = require('../models');

const router = express.Router();

// GET /api/notifications
router.get('/', authenticate, async (req, res) => {
  const notifs = await Notification.find({ userId: req.user.userId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json(notifs.map(n => ({ ...n, id: n._id })));
});

// PATCH /api/notifications/:id/read
router.patch('/:id/read', authenticate, async (req, res) => {
  await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.userId }, { isRead: true });
  res.json({ message: 'Marked read' });
});

// POST /api/notifications/read-all
router.post('/read-all', authenticate, async (req, res) => {
  await Notification.updateMany({ userId: req.user.userId, isRead: false }, { isRead: true });
  res.json({ message: 'All marked read' });
});

module.exports = router;
