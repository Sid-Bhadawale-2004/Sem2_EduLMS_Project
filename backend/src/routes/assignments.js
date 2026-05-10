const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const { Assignment, Submission, Faculty, Student } = require('../models');
const { optionalUpload, fileUrl, UPLOAD_ROOT } = require('../utils/upload');

const router = express.Router();

// GET /api/assignments
router.get('/', authenticate, async (req, res) => {
  const assignments = await Assignment.find()
    .populate('subjectId', 'name code')
    .populate('facultyId', 'name')
    .sort({ createdAt: -1 })
    .lean();

  // For students, also attach their own submission
  if (req.user.role === 'STUDENT') {
    const student = await Student.findOne({ userId: req.user.userId });
    if (student) {
      const aIds = assignments.map(a => a._id);
      const subs = await Submission.find({ studentId: student._id, assignmentId: { $in: aIds } }).lean();
      const subMap = {};
      subs.forEach(s => { subMap[String(s.assignmentId)] = { ...s, id: s._id }; });
      return res.json(assignments.map(a => ({
        ...a, id: a._id,
        subject:     a.subjectId,
        faculty:     a.facultyId,
        submissions: subMap[String(a._id)] ? [subMap[String(a._id)]] : [],
      })));
    }
  }

  res.json(assignments.map(a => ({
    ...a, id: a._id, subject: a.subjectId, faculty: a.facultyId,
    _count: { submissions: 0 },
  })));
});

// POST /api/assignments — faculty
router.post('/', authenticate, authorize('FACULTY', 'ADMIN'), optionalUpload('assignments'), async (req, res) => {
  const { title, description, subjectId, dueDate, maxMarks } = req.body;
  if (!title || !subjectId || !dueDate) return res.status(400).json({ error: 'title, subjectId, dueDate required' });

  const faculty = await Faculty.findOne({ userId: req.user.userId });
  if (!faculty && req.user.role !== 'ADMIN') return res.status(404).json({ error: 'Faculty profile not found' });

  let uploadedFileUrl = req.body.fileUrl || '';
  if (req.file) uploadedFileUrl = fileUrl(req, req.file.filename, 'assignments');

  // Parse date — accepts ISO, datetime-local ("2026-03-23T12:00"), or "dd-mm-yyyy HH:MM"
  let parsedDate;
  const raw = String(dueDate).trim();
  if (/^\d{2}-\d{2}-\d{4}/.test(raw)) {
    // dd-mm-yyyy HH:MM or dd-mm-yyyy
    const [datePart, timePart = '00:00'] = raw.split(' ');
    const [dd, mm, yyyy] = datePart.split('-');
    parsedDate = new Date(`${yyyy}-${mm}-${dd}T${timePart}:00`);
  } else {
    parsedDate = new Date(raw);
  }

  if (isNaN(parsedDate)) return res.status(400).json({ error: 'Invalid dueDate format' });

  const assignment = await Assignment.create({
    title,
    description: description || '',
    subjectId,
    dueDate:   parsedDate,
    maxMarks:  Number(maxMarks) || 100,
    fileUrl:   uploadedFileUrl,
    facultyId: faculty?._id,
  });

  // Notify all students about new assignment
  try {
    const { Student, User, Notification } = require('../models');
    const students = await Student.find().select('userId').lean();
    if (students.length) {
      await Notification.insertMany(students.map(s => ({
        userId: s.userId,
        title:  `📋 New Assignment: ${title}`,
        body:   `Due: ${parsedDate.toLocaleDateString()}`,
        type:   'ASSIGNMENT',
      })));
    }
  } catch {}

  res.status(201).json({ ...assignment.toObject(), id: assignment._id });
});

// DELETE /api/assignments/:id — faculty can delete their own, admin deletes any
router.delete('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    // Check if faculty owns this assignment (unless admin)
    if (req.user.role !== 'ADMIN') {
      const faculty = await Faculty.findOne({ userId: req.user.userId });
      if (!faculty || String(assignment.facultyId) !== String(faculty._id)) {
        return res.status(403).json({ error: 'You can only delete your own assignments' });
      }
    }

    // Delete assignment file from filesystem if it was uploaded
    if (assignment.fileUrl) {
      try {
        // Extract filename from URL: http://...../uploads/assignments/filename -> filename
        const filename = assignment.fileUrl.split('/').pop();
        const filePath = path.join(UPLOAD_ROOT, 'assignments', filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.error('Error deleting assignment file:', fileErr);
        // Continue with DB deletion even if file deletion fails
      }
    }

    // Delete submission files from filesystem
    const submissions = await Submission.find({ assignmentId: req.params.id });
    for (const sub of submissions) {
      if (sub.fileUrl) {
        try {
          const filename = sub.fileUrl.split('/').pop();
          const filePath = path.join(UPLOAD_ROOT, 'submissions', filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileErr) {
          console.error('Error deleting submission file:', fileErr);
        }
      }
    }

    // Delete from database
    await Assignment.findByIdAndDelete(req.params.id);
    await Submission.deleteMany({ assignmentId: req.params.id });

    res.json({ message: 'Assignment and submissions deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

// GET /api/assignments/:id/submissions — faculty
router.get('/:id/submissions', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const submissions = await Submission.find({ assignmentId: req.params.id })
    .populate({ path: 'studentId', select: 'name rollNumber' })
    .sort({ submittedAt: -1 })
    .lean();
  res.json(submissions.map(s => ({ ...s, id: s._id, student: s.studentId })));
});

// POST /api/assignments/:id/submit — student submits or RESUBMITS
router.post('/:id/submit', authenticate, authorize('STUDENT'), optionalUpload('submissions'), async (req, res) => {
  const student = await Student.findOne({ userId: req.user.userId });
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  const { textContent } = req.body;
  let uploadedFileUrl = req.body.fileUrl || '';
  if (req.file) uploadedFileUrl = fileUrl(req, req.file.filename, 'submissions');

  const now    = new Date();
  const isLate = now > assignment.dueDate;

  // Upsert — allow resubmission as long as not graded
  const existing = await Submission.findOne({ assignmentId: assignment._id, studentId: student._id });

  if (existing) {
    if (existing.status === 'GRADED') return res.status(409).json({ error: 'Already graded — cannot resubmit' });
    // Update existing submission
    existing.textContent = textContent || existing.textContent;
    if (uploadedFileUrl) existing.fileUrl = uploadedFileUrl;
    existing.status      = isLate ? 'LATE' : 'SUBMITTED';
    existing.submittedAt = now;
    await existing.save();
    return res.json({ ...existing.toObject(), id: existing._id });
  }

  const submission = await Submission.create({
    assignmentId: assignment._id,
    studentId:    student._id,
    textContent:  textContent || '',
    fileUrl:      uploadedFileUrl,
    status:       isLate ? 'LATE' : 'SUBMITTED',
    submittedAt:  now,
  });

  res.status(201).json({ ...submission.toObject(), id: submission._id });
});

// POST /api/assignments/grade/:submissionId
router.post('/grade/:submissionId', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  const { marks, feedback } = req.body;
  const submission = await Submission.findByIdAndUpdate(
    req.params.submissionId,
    { marks: Number(marks), feedback: feedback || '', status: 'GRADED', gradedAt: new Date() },
    { new: true }
  );
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  res.json({ ...submission.toObject(), id: submission._id });
});

module.exports = router;
