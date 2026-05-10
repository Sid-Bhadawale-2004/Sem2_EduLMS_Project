const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate, authorize } = require('../middleware/auth');
const { Note, Faculty } = require('../models');
const { optionalUpload, fileUrl, UPLOAD_ROOT } = require('../utils/upload');

const router = express.Router();

// GET /api/notes?subjectId=
// Faculty & Admin can see all notes, Students see all notes
router.get('/', authenticate, async (req, res) => {
  try {
    const filter = {};
    if (req.query.subjectId) filter.subjectId = req.query.subjectId;

    const notes = await Note.find(filter)
      .populate('subjectId', 'name code')
      .populate('facultyId', 'userId name')
      .sort({ createdAt: -1 })
      .lean();

    res.json(notes.map(n => ({
      ...n,
      id: n._id,
      subject: n.subjectId,
      faculty: n.facultyId,
    })));
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// GET /api/notes/:id — download/view a specific note
router.get('/:id', authenticate, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('subjectId', 'name code')
      .populate('facultyId', 'name')
      .lean();

    if (!note) return res.status(404).json({ error: 'Note not found' });
    res.json({ ...note, id: note._id, subject: note.subjectId, faculty: note.facultyId });
  } catch {
    res.status(500).json({ error: 'Failed to fetch note' });
  }
});

// POST /api/notes — faculty only
router.post('/', authenticate, authorize('FACULTY', 'ADMIN'), optionalUpload('notes'), async (req, res) => {
  try {
    const { title, description, subjectId, topic, fileUrl: providedUrl } = req.body;
    if (!title || !subjectId) {
      return res.status(400).json({ error: 'title and subjectId required' });
    }

    const faculty = await Faculty.findOne({ userId: req.user.userId });
    if (!faculty && req.user.role !== 'ADMIN') {
      return res.status(404).json({ error: 'Faculty profile not found' });
    }

    let fileUrlToStore = providedUrl || '';
    if (req.file) {
      fileUrlToStore = fileUrl(req, req.file.filename, 'notes');
    }

    const note = await Note.create({
      title,
      description: description || '',
      subjectId,
      topic: topic || '',
      fileUrl: fileUrlToStore,
      fileType: req.file ? 'file' : 'link',
      facultyId: faculty?._id || null,
    });

    const populated = await Note.findById(note._id)
      .populate('subjectId', 'name code')
      .populate('facultyId', 'name')
      .lean();

    res.status(201).json({
      ...populated,
      id: populated._id,
      subject: populated.subjectId,
      faculty: populated.facultyId,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create note' });
  }
});

// DELETE /api/notes/:id — faculty can only delete their own notes, admin can delete any
router.delete('/:id', authenticate, authorize('FACULTY', 'ADMIN'), async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    // Check if faculty owns this note (unless admin)
    if (req.user.role !== 'ADMIN') {
      const faculty = await Faculty.findOne({ userId: req.user.userId });
      if (!faculty || String(note.facultyId) !== String(faculty._id)) {
        return res.status(403).json({ error: 'You can only delete your own notes' });
      }
    }

    // Delete file from filesystem if it was uploaded
    if (note.fileType === 'file' && note.fileUrl) {
      try {
        // Extract filename from URL: http://...../uploads/notes/filename -> filename
        const filename = note.fileUrl.split('/').pop();
        const filePath = path.join(UPLOAD_ROOT, 'notes', filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.error('Error deleting file:', fileErr);
        // Continue with DB deletion even if file deletion fails
      }
    }

    // Delete from database
    await Note.findByIdAndDelete(req.params.id);
    res.json({ message: 'Note deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
