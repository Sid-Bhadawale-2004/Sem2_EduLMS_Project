const express = require('express');
const bcrypt  = require('bcryptjs');
const { User, RefreshToken, Student, Faculty } = require('../models');
const { signAccess, signRefresh, verifyRefresh } = require('../utils/jwt');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (!user || !user.isActive) return res.status(401).json({ error: 'Invalid email or password' });

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  const payload = { userId: user._id.toString(), email: user.email, role: user.role };
  const accessToken  = signAccess(payload);
  const refreshToken = signRefresh(payload);

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ userId: user._id, token: refreshToken, expiresAt });

  res.json({
    tokens: { accessToken, refreshToken },
    user:   { id: user._id, email: user.email, role: user.role },
  });
});

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await RefreshToken.deleteOne({ token: refreshToken });
  res.json({ message: 'Logged out' });
});

// ── POST /api/auth/refresh ────────────────────────────────────────────────────
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  let payload;
  try { payload = verifyRefresh(refreshToken); }
  catch { return res.status(401).json({ error: 'Invalid or expired refresh token' }); }

  const stored = await RefreshToken.findOne({ token: refreshToken });
  if (!stored || stored.expiresAt < new Date()) {
    await RefreshToken.deleteOne({ token: refreshToken });
    return res.status(401).json({ error: 'Refresh token expired' });
  }

  const user = await User.findById(stored.userId);
  if (!user || !user.isActive) return res.status(401).json({ error: 'User not found' });

  const newPayload = { userId: user._id.toString(), email: user.email, role: user.role };
  const newAccess  = signAccess(newPayload);
  const newRefresh = signRefresh(newPayload);

  await RefreshToken.deleteOne({ token: refreshToken });
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ userId: user._id, token: newRefresh, expiresAt });

  res.json({ accessToken: newAccess, refreshToken: newRefresh });
});

// ── GET /api/auth/me — returns user + embedded student/faculty profile ─────────
router.get('/me', authenticate, async (req, res) => {
  const user = await User.findById(req.user.userId).select('-passwordHash').lean();
  if (!user) return res.status(404).json({ error: 'User not found' });

  const base = { id: user._id, email: user.email, role: user.role };

  if (user.role === 'STUDENT') {
    const student = await Student.findOne({ userId: user._id })
      .populate({ path: 'classId', populate: { path: 'departmentId', select: 'name' } })
      .lean();
    return res.json({
      ...base,
      student: student ? { ...student, id: student._id, class: student.classId } : null,
    });
  }

  if (user.role === 'FACULTY') {
    const faculty = await Faculty.findOne({ userId: user._id })
      .populate('departmentId', 'name code')
      .lean();
    return res.json({
      ...base,
      faculty: faculty ? { ...faculty, id: faculty._id, department: faculty.departmentId } : null,
    });
  }

  res.json(base);
});

// ── PATCH /api/auth/profile ───────────────────────────────────────────────────
router.patch('/profile', authenticate, async (req, res) => {
  const { name, phone } = req.body;
  const { userId, role } = req.user;

  if (role === 'STUDENT') {
    await Student.findOneAndUpdate({ userId }, {
      ...(name  !== undefined && { name }),
      ...(phone !== undefined && { phone }),
    });
  } else if (role === 'FACULTY') {
    await Faculty.findOneAndUpdate({ userId }, {
      ...(name  !== undefined && { name }),
      ...(phone !== undefined && { phone }),
    });
  }
  res.json({ message: 'Profile updated' });
});

// ── POST /api/auth/change-password ───────────────────────────────────────────
router.post('/change-password', authenticate, async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!oldPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

  const user = await User.findById(req.user.userId);
  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: 'Password changed' });
});

module.exports = router;
