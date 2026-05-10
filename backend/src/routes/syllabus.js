const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { Syllabus, Faculty } = require('../models');

const router = express.Router();

// GET /api/syllabus?subjectId=&classId=
router.get('/', authenticate, async (req, res) => {
  const filter = {};
  if (req.query.subjectId) filter.subjectId = req.query.subjectId;
  if (req.query.classId)   filter.classId   = req.query.classId;

  const syllabus = await Syllabus.find(filter)
    .populate('subjectId', 'name code')
    .populate('classId',   'name section')
    .sort({ unit: 1 })
    .lean();

  res.json(syllabus.map(s => ({
    ...s, id: s._id,
    subject: s.subjectId,
    class:   s.classId,
  })));
});

// POST /api/syllabus — faculty/admin
router.post('/', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { subjectId, classId, unit, title, topics } = req.body;
  if (!subjectId || !classId || !unit || !title) {
    return res.status(400).json({ error: 'subjectId, classId, unit, title required' });
  }

  const syl = await Syllabus.create({
    subjectId, classId,
    unit:   Number(unit),
    title,
    topics: Array.isArray(topics) ? topics : [],
  });

  res.status(201).json({ ...syl.toObject(), id: syl._id });
});

// PATCH /api/syllabus/:id — mark complete/incomplete
router.patch('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { isCompleted } = req.body;
  const syl = await Syllabus.findByIdAndUpdate(
    req.params.id,
    { isCompleted: !!isCompleted, completedAt: isCompleted ? new Date() : null },
    { new: true }
  );
  if (!syl) return res.status(404).json({ error: 'Not found' });
  res.json({ ...syl.toObject(), id: syl._id });
});

// DELETE /api/syllabus/:id
router.delete('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  await Syllabus.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
