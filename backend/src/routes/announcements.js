const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const { Announcement, Faculty, Student } = require('../models');
const { optionalUpload, fileUrl } = require('../utils/upload');

const router = express.Router();

// GET /api/announcements
router.get('/', authenticate, async (req, res) => {
  let filter = {};
  if (req.user.role === 'STUDENT') {
    const student = await Student.findOne({ userId: req.user.userId }).select('classId');
    filter = { $or: [{ isGlobal: true }, { classId: student?.classId }] };
  }

  const announcements = await Announcement.find(filter)
    .populate('facultyId', 'name')
    .populate('classId',   'name section')
    .sort({ createdAt: -1 })
    .lean();

  res.json(announcements.map(a => ({
    ...a, id: a._id,
    faculty: a.facultyId,
    class:   a.classId,
  })));
});

// POST /api/announcements
router.post('/', authenticate, authorize('FACULTY', 'ADMIN'), optionalUpload('announcements'), async (req, res) => {
  const { title, content, classId } = req.body;
  if (!title || !content) return res.status(400).json({ error: 'title and content required' });

  // isGlobal comes as string from FormData or boolean from JSON
  const isGlobal = req.body.isGlobal === true || req.body.isGlobal === 'true';

  const faculty = await Faculty.findOne({ userId: req.user.userId });

  let uploadedFileUrl = req.body.fileUrl || '';
  if (req.file) {
    uploadedFileUrl = fileUrl(req, req.file.filename, 'announcements');
  }

  const ann = await Announcement.create({
    title,
    content,
    facultyId: faculty?._id,
    classId:   isGlobal ? null : (classId || null),
    isGlobal,
    fileUrl:   uploadedFileUrl,
  });

  // Notify relevant students
  try {
    const { Student, User, Notification } = require('../models');
    let studentFilter = {};
    if (!isGlobal && classId) studentFilter = { classId };
    const students = await Student.find(studentFilter).select('userId').lean();
    if (students.length) {
      await Notification.insertMany(students.map(s => ({
        userId: s.userId,
        title:  `📢 ${title}`,
        body:   content.substring(0, 120),
        type:   'ANNOUNCEMENT',
      })));
    }
  } catch {}

  res.status(201).json({ ...ann.toObject(), id: ann._id });
});

// DELETE /api/announcements/:id
router.delete('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  await Announcement.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

module.exports = router;
