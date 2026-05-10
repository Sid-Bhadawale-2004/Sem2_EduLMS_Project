const express = require('express');
const { authenticate } = require('../middleware/auth');
const { Student, Faculty, Attendance, Session } = require('../models');

const router = express.Router();

// GET /api/profile/me — full enriched profile for Profile page
router.get('/me', authenticate, async (req, res) => {
  const { userId, role, email } = req.user;

  if (role === 'STUDENT') {
    const student = await Student.findOne({ userId })
      .populate({ path: 'classId', populate: { path: 'departmentId', select: 'name' } })
      .lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });
    return res.json({
      id: userId, email, role,
      student: {
        ...student,
        id:    student._id,
        class: student.classId,
      },
    });
  }

  if (role === 'FACULTY') {
    const faculty = await Faculty.findOne({ userId })
      .populate('departmentId', 'name code')
      .lean();
    if (!faculty) return res.status(404).json({ error: 'Faculty not found' });
    return res.json({
      id: userId, email, role,
      faculty: { ...faculty, id: faculty._id, department: faculty.departmentId },
    });
  }

  // ADMIN
  res.json({ id: userId, email, role });
});

module.exports = router;
