const express = require('express');
const { authenticate } = require('../middleware/auth');
const { Class, Subject, Student, Faculty } = require('../models');

const router = express.Router();

// GET /api/common/classes — for dropdowns (faculty & admin)
router.get('/classes', authenticate, async (req, res) => {
  const classes = await Class.find()
    .populate('departmentId', 'name code')
    .sort({ name: 1, section: 1 })
    .lean();
  res.json(classes.map(c => ({ ...c, id: c._id, department: c.departmentId })));
});

// GET /api/common/subjects — for dropdowns
router.get('/subjects', authenticate, async (req, res) => {
  const subjects = await Subject.find()
    .populate('departmentId', 'name code')
    .sort({ name: 1 })
    .lean();
  res.json(subjects.map(s => ({ ...s, id: s._id, department: s.departmentId })));
});

// GET /api/common/class-students/:classId — students in a class for manual marking
router.get('/class-students/:classId', authenticate, async (req, res) => {
  const students = await Student.find({ classId: req.params.classId })
    .select('name rollNumber _id')
    .sort({ rollNumber: 1 })
    .lean();
  res.json(students.map(s => ({ ...s, id: s._id })));
});

// GET /api/common/faculty — for timetable dropdowns
router.get('/faculty', authenticate, async (req, res) => {
  const faculty = await Faculty.find()
    .populate('departmentId', 'name')
    .sort({ name: 1 })
    .lean();
  res.json(faculty.map(f => ({ ...f, id: f._id, department: f.departmentId })));
});

module.exports = router;
