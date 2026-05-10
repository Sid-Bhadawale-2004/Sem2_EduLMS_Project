const express = require('express');
const crypto  = require('crypto');
const { authenticate, authorize } = require('../middleware/auth');
const { Session, QrCode, CodeSession, Faculty, Attendance, Student } = require('../models');
const { emitToSession } = require('../utils/socket');

const router = express.Router();
const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// ── POST /api/sessions — create session ──────────────────────────────────────
router.post('/', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { classId, subjectId, mode, qrRefreshSec, locationEnabled, locationLat, locationLng, locationRadius } = req.body;
  if (!classId || !subjectId || !mode) return res.status(400).json({ error: 'classId, subjectId, mode required' });

  const faculty = await Faculty.findOne({ userId: req.user.userId });
  if (!faculty) return res.status(404).json({ error: 'Faculty profile not found' });

  const session = await Session.create({
    classId, subjectId, facultyId: faculty._id, mode,
    qrRefreshSec: qrRefreshSec || 600,
    locationEnabled: !!locationEnabled,
    locationLat:    locationEnabled ? locationLat : null,
    locationLng:    locationEnabled ? locationLng : null,
    locationRadius: locationRadius || 100,
  });

  const populated = await Session.findById(session._id)
    .populate('classId',   'name section semester')
    .populate('subjectId', 'name code')
    .populate('facultyId', 'name employeeId')
    .lean();

  res.status(201).json({
    ...populated,
    id:      populated._id,
    class:   populated.classId,
    subject: populated.subjectId,
    faculty: populated.facultyId,
    _count:  { attendances: 0 },
  });
});

// ── GET /api/sessions/active — faculty's active sessions ─────────────────────
router.get('/active', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const faculty = await Faculty.findOne({ userId: req.user.userId });
  if (!faculty) return res.json([]);

  const sessions = await Session.find({ facultyId: faculty._id, isActive: true })
    .populate('classId',   'name section semester')
    .populate('subjectId', 'name code')
    .sort({ startTime: -1 })
    .lean();

  const result = await Promise.all(sessions.map(async s => ({
    ...s,
    id:      s._id,
    class:   s.classId,
    subject: s.subjectId,
    _count:  { attendances: await Attendance.countDocuments({ sessionId: s._id }) },
  })));

  res.json(result);
});

// ── GET /api/sessions?limit=100 — session history ────────────────────────────
router.get('/', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const limit   = parseInt(req.query.limit) || 50;
  const faculty = await Faculty.findOne({ userId: req.user.userId });
  if (!faculty) return res.json({ sessions: [] });

  const sessions = await Session.find({ facultyId: faculty._id })
    .populate('classId',   'name section semester')
    .populate('subjectId', 'name code')
    .sort({ startTime: -1 })
    .limit(limit)
    .lean();

  const result = await Promise.all(sessions.map(async s => ({
    ...s,
    id:      s._id,
    class:   s.classId,
    subject: s.subjectId,
    _count:  { attendances: await Attendance.countDocuments({ sessionId: s._id }) },
  })));

  res.json({ sessions: result });
});

// ── POST /api/sessions/:id/end ────────────────────────────────────────────────
router.post('/:id/end', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  await Session.findByIdAndUpdate(req.params.id, { isActive: false, endTime: new Date() });
  await QrCode.deleteMany({ sessionId: req.params.id });
  await CodeSession.updateMany({ sessionId: req.params.id }, { isActive: false });
  res.json({ message: 'Session ended' });
});

// ── POST /api/sessions/:id/qr — generate/refresh QR (10 min expiry) ──────────
router.post('/:id/qr', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // Delete old QR codes for this session
  await QrCode.deleteMany({ sessionId: session._id });

  const token     = crypto.randomBytes(20).toString('hex'); // 40 char hex token
  const expiresAt = new Date(Date.now() + EXPIRY_MS);       // 10 min

  const qr = await QrCode.create({ sessionId: session._id, token, expiresAt });

  const payload = { token, sessionId: session._id.toString(), expiresAt };

  // Broadcast to all in this session room
  emitToSession(session._id.toString(), 'qr:refreshed', payload);

  res.json(payload);
});

// ── POST /api/sessions/:id/code — generate/refresh 6-digit code (10 min) ─────
router.post('/:id/code', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const session = await Session.findById(req.params.id);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  // Deactivate old codes for this session
  await CodeSession.updateMany({ sessionId: session._id }, { isActive: false });

  const code      = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  const expiresAt = new Date(Date.now() + EXPIRY_MS);                    // 10 min

  await CodeSession.create({ sessionId: session._id, code, isActive: true, expiresAt });

  const payload = { code, sessionId: session._id.toString(), expiresAt };

  emitToSession(session._id.toString(), 'code:refreshed', payload);

  res.json(payload);
});

module.exports = router;
