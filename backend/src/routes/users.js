const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { Student, Faculty } = require('../models');

const router = express.Router();

// GET /api/users/students?departmentId=&classId=
router.get('/students', authenticate, authorize('ADMIN', 'FACULTY'), async (req, res) => {
  const filter = {};
  if (req.query.classId) filter.classId = req.query.classId;

  const students = await Student.find(filter)
    .populate({
      path: 'classId',
      select: 'name section semester departmentId',
      populate: { path: 'departmentId', select: 'name code' },
    })
    .populate('userId', 'email')
    .sort({ rollNumber: 1 })
    .lean();

  // Filter by departmentId post-populate if provided
  let result = students;
  if (req.query.departmentId) {
    result = students.filter(s => String(s.classId?.departmentId?._id) === req.query.departmentId);
  }

  res.json(result.map(s => ({
    ...s, id: s._id,
    class:      s.classId,
    department: s.classId?.departmentId,
    user:       s.userId ? { id: s.userId._id, email: s.userId.email } : null,
  })));
});

// GET /api/users/faculty?departmentId=
router.get('/faculty', authenticate, authorize('ADMIN'), async (req, res) => {
  const filter = {};
  if (req.query.departmentId) filter.departmentId = req.query.departmentId;

  const faculty = await Faculty.find(filter)
    .populate('departmentId', 'name code')
    .populate('userId', 'email')
    .sort({ name: 1 })
    .lean();

  res.json(faculty.map(f => ({
    ...f, id: f._id,
    department: f.departmentId,
    user:       f.userId ? { id: f.userId._id, email: f.userId.email } : null,
  })));
});

module.exports = router;
