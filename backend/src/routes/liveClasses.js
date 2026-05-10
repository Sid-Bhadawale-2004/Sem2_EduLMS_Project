const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { LiveClass, Faculty } = require('../models');

const router = express.Router();

// GET /api/live-classes
router.get('/', authenticate, async (req, res) => {
  const classes = await LiveClass.find()
    .populate('subjectId', 'name code')
    .populate('facultyId', 'name')
    .sort({ scheduledAt: -1 })
    .lean();
  res.json(classes.map(c => ({ ...c, id: c._id, subject: c.subjectId, faculty: c.facultyId })));
});

// POST /api/live-classes — faculty/admin
router.post('/', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { title, description, meetLink, platform, subjectId, scheduledAt, duration } = req.body;
  if (!title || !meetLink || !subjectId || !scheduledAt) {
    return res.status(400).json({ error: 'title, meetLink, subjectId, scheduledAt required' });
  }

  const faculty = await Faculty.findOne({ userId: req.user.userId });

  const lc = await LiveClass.create({
    title, description: description || '', meetLink,
    platform: platform || 'Google Meet',
    subjectId, scheduledAt: new Date(scheduledAt),
    duration: Number(duration) || 60,
    facultyId: faculty?._id || req.body.facultyId,
  });

  res.status(201).json({ ...lc.toObject(), id: lc._id });
});

// DELETE /api/live-classes/:id
router.delete('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  await LiveClass.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
