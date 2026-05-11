const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { Session, QrCode, CodeSession, Student, Attendance } = require('../models');
const { emitToSession } = require('../utils/socket');

const router = express.Router();

// Safe ObjectId comparison — works whether values are ObjectId, populated object, or string
function sameId(a, b) {
  const sa = a?._id ? String(a._id) : String(a);
  const sb = b?._id ? String(b._id) : String(b);
  return sa === sb;
}

function getDistanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function broadcastAttendance(sessionId, attendance, student) {
  emitToSession(String(sessionId), 'attendance:marked', {
    attendanceId: attendance._id,
    studentId:    student._id,
    rollNumber:   student.rollNumber,
    name:         student.name,
    markedAt:     attendance.markedAt,
    status:       attendance.status,
    markedBy:     attendance.markedBy,
  });
}

// POST /api/attendance/qr
router.post('/qr', authenticate, authorize('STUDENT'), async (req, res) => {
  const { payload: token, lat, lng } = req.body;
  if (!token) return res.status(400).json({ error: 'QR token required' });

  const qr = await QrCode.findOne({ token, expiresAt: { $gt: new Date() } }).lean();
  if (!qr) return res.status(400).json({ error: 'QR code has expired. Ask faculty to refresh.' });

  const session = await Session.findOne({ _id: qr.sessionId, isActive: true }).lean();
  if (!session) return res.status(400).json({ error: 'Session is no longer active.' });

  const student = await Student.findOne({ userId: req.user.userId }).lean();
  if (!student) return res.status(404).json({ error: 'Student profile not found.' });

  if (!sameId(student.classId, session.classId)) {
    return res.status(403).json({ error: 'You are not enrolled in this class.' });
  }

  if (session.locationEnabled && session.locationLat && session.locationLng) {
    if (!lat || !lng) return res.status(403).json({ error: 'Location required. Please allow location access.' });
    const dist = getDistanceM(session.locationLat, session.locationLng, lat, lng);
    if (dist > session.locationRadius) {
      return res.status(403).json({ error: `You are ${Math.round(dist)}m away. Must be within ${session.locationRadius}m.` });
    }
  }

  const existing = await Attendance.findOne({ studentId: student._id, sessionId: session._id });
  if (existing) return res.status(409).json({ error: 'Attendance already marked.' });

  const attendance = await Attendance.create({
    studentId: student._id, sessionId: session._id,
    status: 'PRESENT', markedBy: 'SELF', ipAddress: req.ip || '',
  });

  broadcastAttendance(session._id, attendance, student);
  res.json({ message: 'Attendance marked successfully.' });
});

// POST /api/attendance/code
router.post('/code', authenticate, authorize('STUDENT'), async (req, res) => {
  const { code, lat, lng } = req.body;
  if (!code) return res.status(400).json({ error: 'Code required' });

  const codeDoc = await CodeSession.findOne({
    code: String(code), isActive: true, expiresAt: { $gt: new Date() },
  }).lean();
  if (!codeDoc) return res.status(400).json({ error: 'Invalid or expired code.' });

  const session = await Session.findOne({ _id: codeDoc.sessionId, isActive: true }).lean();
  if (!session) return res.status(400).json({ error: 'Session is no longer active.' });

  const student = await Student.findOne({ userId: req.user.userId }).lean();
  if (!student) return res.status(404).json({ error: 'Student profile not found.' });

  if (!sameId(student.classId, session.classId)) {
    return res.status(403).json({ error: 'You are not enrolled in this class.' });
  }

  // Location check (same as QR endpoint)
  if (session.locationEnabled && session.locationLat && session.locationLng) {
    if (!lat || !lng) return res.status(403).json({ error: 'Location required. Please allow location access.' });
    const dist = getDistanceM(session.locationLat, session.locationLng, lat, lng);
    if (dist > session.locationRadius) {
      return res.status(403).json({ error: `You are ${Math.round(dist)}m away. Must be within ${session.locationRadius}m.` });
    }
  }

  const existing = await Attendance.findOne({ studentId: student._id, sessionId: session._id });
  if (existing) return res.status(409).json({ error: 'Attendance already marked.' });

  const attendance = await Attendance.create({
    studentId: student._id, sessionId: session._id,
    status: 'PRESENT', markedBy: 'SELF', ipAddress: req.ip || '',
  });

  broadcastAttendance(session._id, attendance, student);
  res.json({ message: 'Attendance marked successfully.' });
});

// POST /api/attendance/manual
router.post('/manual', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { sessionId, studentId, status } = req.body;
  if (!sessionId || !studentId || !status)
    return res.status(400).json({ error: 'sessionId, studentId, status required' });

  const attendance = await Attendance.findOneAndUpdate(
    { studentId, sessionId },
    { status, markedBy: 'FACULTY', markedAt: new Date() },
    { upsert: true, new: true }
  ).populate({ path: 'studentId', select: 'rollNumber name' });

  emitToSession(String(sessionId), 'attendance:marked', {
    attendanceId: attendance._id, studentId,
    rollNumber:   attendance.studentId?.rollNumber,
    name:         attendance.studentId?.name,
    markedAt:     attendance.markedAt,
    status:       attendance.status, markedBy: attendance.markedBy,
  });

  res.json(attendance);
});

// GET /api/attendance/session/all  — must be BEFORE /:sessionId
router.get('/session/all', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { classId, subjectId } = req.query;
  const filter = {};
  if (classId)   filter.classId   = classId;
  if (subjectId) filter.subjectId = subjectId;

  const sessions = await Session.find(filter)
    .populate('subjectId', 'name code')
    .populate('classId',   'name section')
    .sort({ startTime: -1 })
    .lean();

  res.json(sessions.map(s => ({ ...s, id: s._id, class: s.classId, subject: s.subjectId })));
});

// GET /api/attendance/session/:sessionId
router.get('/session/:sessionId', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const records = await Attendance.find({ sessionId: req.params.sessionId })
    .populate({ path: 'studentId', select: 'rollNumber name' })
    .sort({ markedAt: 1 })
    .lean();

  res.json(records.map(r => ({
    ...r, id: r._id, attendanceId: r._id,
    studentId:  r.studentId?._id,
    rollNumber: r.studentId?.rollNumber,
    name:       r.studentId?.name,
  })));
});

// GET /api/attendance/my
router.get('/my', authenticate, authorize('STUDENT'), async (req, res) => {
  const student = await Student.findOne({ userId: req.user.userId }).lean();
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const records = await Attendance.find({ studentId: student._id })
    .populate({
      path: 'sessionId', select: 'subjectId date startTime',
      populate: { path: 'subjectId', select: 'name code' },
    })
    .sort({ markedAt: -1 })
    .lean();

  const subjectMap = {};
  for (const r of records) {
    const code = r.sessionId?.subjectId?.code || 'UNK';
    const name = r.sessionId?.subjectId?.name || 'Unknown';
    if (!subjectMap[code]) subjectMap[code] = { subjectName: name, subjectCode: code, total: 0, present: 0 };
    subjectMap[code].total++;
    if (r.status === 'PRESENT' || r.status === 'LATE') subjectMap[code].present++;
  }

  const summary = Object.values(subjectMap).map(s => ({
    ...s,
    percentage: s.total > 0 ? Math.round((s.present / s.total) * 100) : 0,
    isLow:      s.total > 0 && (s.present / s.total) * 100 < 75,
  }));

  res.json({
    attendances: records.map(r => ({ ...r, id: r._id, session: r.sessionId })),
    summary, student,
  });
});

module.exports = router;
