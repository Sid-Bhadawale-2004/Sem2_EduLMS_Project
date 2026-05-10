const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { Timetable, Faculty, Student } = require('../models');

const router = express.Router();

// GET /api/timetable?classId=&facultyId=
router.get('/', authenticate, async (req, res) => {
  const filter = {};

  if (req.query.classId)   filter.classId   = req.query.classId;
  if (req.query.facultyId) filter.facultyId = req.query.facultyId;

  // If student, auto-filter by their class
  if (req.user.role === 'STUDENT' && !req.query.classId) {
    const student = await Student.findOne({ userId: req.user.userId }).select('classId');
    if (student) filter.classId = student.classId;
  }

  // If faculty (no explicit filter), show their own timetable
  if (req.user.role === 'FACULTY' && !req.query.classId && !req.query.facultyId) {
    const faculty = await Faculty.findOne({ userId: req.user.userId });
    if (faculty) filter.facultyId = faculty._id;
  }

  const entries = await Timetable.find(filter)
    .populate('classId',   'name section semester')
    .populate('subjectId', 'name code')
    .populate('facultyId', 'name employeeId')
    .sort({ dayOfWeek: 1, startTime: 1 })
    .lean();

  res.json(entries.map(e => ({
    ...e,
    id:      e._id,
    class:   e.classId,
    subject: e.subjectId,
    faculty: e.facultyId,
  })));
});

// POST /api/timetable — faculty/admin
router.post('/', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { classId, subjectId, facultyId, dayOfWeek, startTime, endTime, room } = req.body;
  if (!classId || !subjectId || !facultyId || !dayOfWeek || !startTime || !endTime) {
    return res.status(400).json({ error: 'classId, subjectId, facultyId, dayOfWeek, startTime, endTime required' });
  }

  const entry = await Timetable.create({
    classId, subjectId, facultyId,
    dayOfWeek: Number(dayOfWeek),
    startTime, endTime,
    room: room || '',
  });

  res.status(201).json({ ...entry.toObject(), id: entry._id });
});

// DELETE /api/timetable/:id
router.delete('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  await Timetable.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
