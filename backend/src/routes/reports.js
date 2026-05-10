const express  = require('express');
const XLSX     = require('xlsx');
const { authenticate, authorize } = require('../middleware/auth');
const { Session, Student, Attendance } = require('../models');

const router = express.Router();
const guard  = [authenticate, authorize('FACULTY', 'ADMIN')];

// ── Helper: build session report data ────────────────────────────────────────
async function buildReport(sessionId) {
  const session = await Session.findById(sessionId)
    .populate('classId',   'name section semester')
    .populate('subjectId', 'name code')
    .populate('facultyId', 'name employeeId')
    .lean();
  if (!session) return null;

  const students = await Student.find({ classId: session.classId._id })
    .select('rollNumber name _id')
    .sort({ rollNumber: 1 })
    .lean();

  const records = await Attendance.find({ sessionId }).select('studentId status markedAt markedBy').lean();
  const recMap  = {};
  for (const r of records) recMap[String(r.studentId)] = r;

  const rows = students.map(s => {
    const rec = recMap[String(s._id)];
    return {
      rollNumber: s.rollNumber,
      name:       s.name,
      status:     rec ? rec.status : 'ABSENT',
      markedAt:   rec ? rec.markedAt : null,
      markedBy:   rec ? rec.markedBy : '-',
    };
  });

  return { session, rows };
}

// ── GET /api/reports/session/:id ─────────────────────────────────────────────
router.get('/session/:id', guard, async (req, res) => {
  const report = await buildReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Session not found' });

  // Shape to match frontend: session.subject, session.class, session.faculty
  const { session, rows } = report;
  res.json({
    rows,
    session: {
      ...session,
      id:      session._id,
      class:   session.classId,
      subject: session.subjectId,
      faculty: session.facultyId,
    },
  });
});

// ── GET /api/reports/session/:id/excel ───────────────────────────────────────
router.get('/session/:id/excel', guard, async (req, res) => {
  const report = await buildReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Session not found' });
  const { session, rows } = report;

  const present = rows.filter(r => r.status === 'PRESENT').length;
  const absent  = rows.filter(r => r.status === 'ABSENT').length;
  const late    = rows.filter(r => r.status === 'LATE').length;

  const sheetData = [
    ['Attendance Report'],
    ['Class',    `${session.classId.name} – ${session.classId.section} (Sem ${session.classId.semester})`],
    ['Subject',  `${session.subjectId.name} (${session.subjectId.code})`],
    ['Faculty',  `${session.facultyId.name} (${session.facultyId.employeeId})`],
    ['Date',     session.date ? new Date(session.date).toLocaleDateString() : '-'],
    ['Mode',     session.mode],
    [],
    ['Roll No', 'Name', 'Status', 'Marked At', 'Marked By'],
    ...rows.map(r => [
      r.rollNumber, r.name, r.status,
      r.markedAt ? new Date(r.markedAt).toLocaleString() : '-',
      r.markedBy,
    ]),
    [],
    ['Total', rows.length],
    ['Present', present],
    ['Absent',  absent],
    ['Late',    late],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 10 }, { wch: 22 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.set({
    'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="attendance-${req.params.id}.xlsx"`,
    'Content-Length':      buffer.length,
  });
  res.send(buffer);
});

// ── GET /api/reports/session/:id/pdf ─────────────────────────────────────────
router.get('/session/:id/pdf', guard, async (req, res) => {
  const report = await buildReport(req.params.id);
  if (!report) return res.status(404).json({ error: 'Session not found' });
  const { session, rows } = report;

  const present = rows.filter(r => r.status === 'PRESENT').length;
  const absent  = rows.filter(r => r.status === 'ABSENT').length;
  const late    = rows.filter(r => r.status === 'LATE').length;

  const esc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const PAGE_H = 841, MARGIN = 50, ROW_H = 18;

  let stream = '';
  stream += `BT /F1 16 Tf ${MARGIN} ${PAGE_H - 60} Td (Attendance Report) Tj ET\n`;

  const meta = [
    `Class   : ${session.classId.name} – ${session.classId.section} (Sem ${session.classId.semester})`,
    `Subject : ${session.subjectId.name} (${session.subjectId.code})`,
    `Faculty : ${session.facultyId.name}`,
    `Date    : ${session.date ? new Date(session.date).toLocaleDateString() : '-'}`,
    `Mode    : ${session.mode}`,
  ];

  let y = PAGE_H - 90;
  for (const m of meta) { stream += `BT /F1 10 Tf ${MARGIN} ${y} Td (${esc(m)}) Tj ET\n`; y -= 16; }

  y -= 4;
  stream += `${MARGIN} ${y} m 545 ${y} l S\n`;
  y -= ROW_H;

  stream += `BT /F1 10 Tf ${MARGIN} ${y} Td (Roll No) Tj ET\n`;
  stream += `BT /F1 10 Tf 140 ${y} Td (Name) Tj ET\n`;
  stream += `BT /F1 10 Tf 340 ${y} Td (Status) Tj ET\n`;
  stream += `BT /F1 10 Tf 420 ${y} Td (Marked At) Tj ET\n`;
  y -= 4;
  stream += `${MARGIN} ${y} m 545 ${y} l S\n`;
  y -= ROW_H;

  for (const r of rows) {
    if (y < 60) { stream += `BT /F1 9 Tf ${MARGIN} ${y} Td (... more rows — download Excel for full list.) Tj ET\n`; break; }
    const markedAt = r.markedAt ? new Date(r.markedAt).toLocaleString() : '-';
    stream += `BT /F1 9 Tf ${MARGIN} ${y} Td (${esc(r.rollNumber)}) Tj ET\n`;
    stream += `BT /F1 9 Tf 140 ${y} Td (${esc(r.name.substring(0, 22))}) Tj ET\n`;
    stream += `BT /F1 9 Tf 340 ${y} Td (${esc(r.status)}) Tj ET\n`;
    stream += `BT /F1 9 Tf 420 ${y} Td (${esc(markedAt)}) Tj ET\n`;
    y -= ROW_H;
  }

  y -= 10;
  stream += `${MARGIN} ${y} m 545 ${y} l S\n`;
  y -= ROW_H;
  stream += `BT /F1 10 Tf ${MARGIN} ${y} Td (Total: ${rows.length}   Present: ${present}   Absent: ${absent}   Late: ${late}) Tj ET\n`;

  const streamBytes = Buffer.from(stream, 'latin1');
  const objs = ['%PDF-1.4\n'];
  const off = [];

  off[1] = objs.reduce((a, s) => a + Buffer.byteLength(s, 'latin1'), 0);
  objs.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  off[2] = objs.reduce((a, s) => a + Buffer.byteLength(s, 'latin1'), 0);
  objs.push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  off[3] = objs.reduce((a, s) => a + Buffer.byteLength(s, 'latin1'), 0);
  objs.push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 841]\n   /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n');
  off[4] = objs.reduce((a, s) => a + Buffer.byteLength(s, 'latin1'), 0);
  objs.push(`4 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream\nendobj\n`);
  off[5] = objs.reduce((a, s) => a + Buffer.byteLength(s, 'latin1'), 0);
  objs.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n');

  const xrefOffset = objs.reduce((a, s) => a + Buffer.byteLength(s, 'latin1'), 0);
  const xref = [
    'xref\n', '0 6\n', '0000000000 65535 f \n',
    ...off.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`),
    'trailer\n<< /Size 6 /Root 1 0 R >>\n',
    `startxref\n${xrefOffset}\n%%EOF\n`,
  ];

  const buffer = Buffer.concat([
    Buffer.from(objs.join(''), 'latin1'),
    Buffer.from(xref.join(''), 'latin1'),
  ]);

  res.set({
    'Content-Type':        'application/pdf',
    'Content-Disposition': `attachment; filename="attendance-${req.params.id}.pdf"`,
    'Content-Length':      buffer.length,
  });
  res.send(buffer);
});

// ── GET /api/reports/defaulters?classId=&subjectId=&threshold= ───────────────
router.get('/defaulters', guard, async (req, res) => {
  const { classId, subjectId, threshold = 75 } = req.query;
  if (!classId || !subjectId) return res.status(400).json({ error: 'classId and subjectId required' });

  const sessions = await Session.find({ classId, subjectId }).select('_id').lean();
  if (!sessions.length) return res.json([]);

  const sessionIds = sessions.map(s => s._id);
  const students   = await Student.find({ classId }).select('rollNumber name _id').sort({ rollNumber: 1 }).lean();
  const thr        = Number(threshold);

  const result = [];
  for (const student of students) {
    const total   = sessionIds.length;
    const present = await Attendance.countDocuments({
      studentId: student._id, sessionId: { $in: sessionIds }, status: { $in: ['PRESENT', 'LATE'] },
    });
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;
    if (pct < thr) result.push({ rollNumber: student.rollNumber, name: student.name, totalClasses: total, attended: present, percentage: pct, shortfall: Math.ceil((thr / 100) * total) - present });
  }
  res.json(result);
});

module.exports = router;
