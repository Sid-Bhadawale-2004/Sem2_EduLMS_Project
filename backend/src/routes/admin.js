const express = require('express');
const bcrypt  = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');
const {
  User, Student, Faculty, Department, Class, Subject, Session, Attendance,
} = require('../models');

const router  = express.Router();
const isAdmin = [authenticate, authorize('ADMIN')];

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', isAdmin, async (req, res) => {
  const [users, students, faculty, sessions, attendances] = await Promise.all([
    User.countDocuments(),
    Student.countDocuments(),
    Faculty.countDocuments(),
    Session.countDocuments(),
    Attendance.countDocuments(),
  ]);
  res.json({ users, students, faculty, sessions, attendances });
});

// ─── Departments ──────────────────────────────────────────────────────────────
router.get('/departments', isAdmin, async (req, res) => {
  const deps = await Department.find().sort({ name: 1 }).lean();
  res.json(deps);
});

router.post('/departments', isAdmin, async (req, res) => {
  const { name, code } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Name and code required' });
  const dept = await Department.create({ name: name.trim(), code: code.trim().toUpperCase() });
  res.status(201).json(dept);
});

router.delete('/departments/:id', isAdmin, async (req, res) => {
  const linked = await Class.countDocuments({ departmentId: req.params.id });
  if (linked) return res.status(409).json({ error: 'Cannot delete — has linked classes' });
  await Department.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// ─── Classes ──────────────────────────────────────────────────────────────────
router.get('/classes', isAdmin, async (req, res) => {
  const classes = await Class.find()
    .populate('departmentId', 'name code')
    .sort({ name: 1 })
    .lean();
  const withCount = await Promise.all(classes.map(async c => ({
    ...c,
    department: c.departmentId,
    _count: { students: await Student.countDocuments({ classId: c._id }) },
  })));
  res.json(withCount);
});

router.post('/classes', isAdmin, async (req, res) => {
  const { name, section, semester, departmentId } = req.body;
  if (!name || !section || !departmentId) return res.status(400).json({ error: 'All fields required' });
  const cls = await Class.create({ name, section, semester: Number(semester) || 1, departmentId });
  res.status(201).json(cls);
});

router.delete('/classes/:id', isAdmin, async (req, res) => {
  const linked = await Student.countDocuments({ classId: req.params.id });
  if (linked) return res.status(409).json({ error: 'Cannot delete — has linked students' });
  await Class.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// ─── Subjects ─────────────────────────────────────────────────────────────────
router.get('/subjects', isAdmin, async (req, res) => {
  const subjects = await Subject.find()
    .populate('departmentId', 'name code')
    .sort({ name: 1 })
    .lean();
  res.json(subjects.map(s => ({ ...s, department: s.departmentId })));
});

router.post('/subjects', isAdmin, async (req, res) => {
  const { name, code, credits, departmentId } = req.body;
  if (!name || !code || !departmentId) return res.status(400).json({ error: 'All fields required' });
  const existing = await Subject.findOne({ code: code.trim().toUpperCase() });
  if (existing) return res.status(409).json({ error: 'Subject code already exists' });
  const sub = await Subject.create({ name, code, credits: Number(credits) || 3, departmentId });
  res.status(201).json(sub);
});

router.delete('/subjects/:id', isAdmin, async (req, res) => {
  await Subject.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// ─── Users: create student/faculty ───────────────────────────────────────────
router.post('/users', isAdmin, async (req, res) => {
  const { email, password, role, profile } = req.body;
  if (!email || !password || !role || !profile) return res.status(400).json({ error: 'All fields required' });
  if (!['STUDENT', 'FACULTY'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const exists = await User.findOne({ email: email.toLowerCase().trim() });
  if (exists) return res.status(409).json({ error: 'Email already registered' });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email: email.toLowerCase().trim(), passwordHash, role });

  try {
    if (role === 'STUDENT') {
      const { rollNumber, name, classId } = profile;
      if (!rollNumber || !name || !classId) throw Object.assign(new Error('Student: rollNumber, name, classId required'), { status: 400 });
      const exists2 = await Student.findOne({ rollNumber });
      if (exists2) { await User.findByIdAndDelete(user._id); return res.status(409).json({ error: 'Roll number already exists' }); }
      await Student.create({ userId: user._id, rollNumber, name, classId });
    } else {
      const { employeeId, name, departmentId } = profile;
      if (!employeeId || !name || !departmentId) throw Object.assign(new Error('Faculty: employeeId, name, departmentId required'), { status: 400 });
      const exists2 = await Faculty.findOne({ employeeId });
      if (exists2) { await User.findByIdAndDelete(user._id); return res.status(409).json({ error: 'Employee ID already exists' }); }
      await Faculty.create({ userId: user._id, employeeId, name, departmentId });
    }
  } catch (err) {
    await User.findByIdAndDelete(user._id);
    return res.status(err.status || 400).json({ error: err.message });
  }

  res.status(201).json({ message: `${role} created` });
});

// ─── PATCH /api/admin/users/:userId ──────────────────────────────────────────
router.patch('/users/:userId', isAdmin, async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (req.body.email) {
    user.email = req.body.email.toLowerCase().trim();
    await user.save();
  }

  if (user.role === 'STUDENT') {
    const { name, rollNumber, phone, classId } = req.body;
    await Student.findOneAndUpdate({ userId: user._id }, {
      ...(name       && { name }),
      ...(rollNumber && { rollNumber }),
      ...(phone !== undefined && { phone }),
      ...(classId    && { classId }),
    });
  } else if (user.role === 'FACULTY') {
    const { name, employeeId, phone, departmentId } = req.body;
    await Faculty.findOneAndUpdate({ userId: user._id }, {
      ...(name         && { name }),
      ...(employeeId   && { employeeId }),
      ...(phone !== undefined && { phone }),
      ...(departmentId && { departmentId }),
    });
  }
  res.json({ message: 'Updated' });
});

// ─── DELETE /api/admin/users/:userId ─────────────────────────────────────────
router.delete('/users/:userId', isAdmin, async (req, res) => {
  const user = await User.findById(req.params.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  await Student.deleteOne({ userId: user._id });
  await Faculty.deleteOne({ userId: user._id });
  await User.findByIdAndDelete(user._id);
  res.json({ message: 'User deleted' });
});

module.exports = router;
