import React, { useState, useEffect } from 'react';
import {
  Grid, Typography, Box, Button, Chip,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert,
} from '@mui/material';
import {
  Add, Upload, Close, AttachFile,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import NoteCard from '../components/NoteCard';
import { FACULTY_NAV, STUDENT_NAV, ADMIN_NAV } from '../constants/nav';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const amber = '#f59e0b';

export default function Notes({ isDark, onToggleDark }) {
  const { user } = useAuth();
  const isFaculty = user?.role === 'FACULTY' || user?.role === 'ADMIN';
  
  const [notes, setNotes] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [subjectFilter, setSubjectFilter] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [uploadMode, setUploadMode] = useState('link');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', subjectId: '', topic: '', fileUrl: '' });
  const [file, setFile] = useState(null);

  useEffect(() => {
    loadData();
  }, [subjectFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [notesRes, subjectsRes] = await Promise.all([
        api.get(`/notes${subjectFilter ? `?subjectId=${subjectFilter}` : ''}`),
        api.get('/common/subjects'),
      ]);
      setNotes(Array.isArray(notesRes.data) ? notesRes.data : []);
      setSubjects(Array.isArray(subjectsRes.data) ? subjectsRes.data : []);
    } catch {
      toast.error('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.subjectId) {
      toast.error('Title and Subject are required');
      return;
    }
    if (uploadMode === 'link' && !form.fileUrl) {
      toast.error('Please paste a file link');
      return;
    }
    if (uploadMode === 'file' && !file) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description || '');
      fd.append('subjectId', form.subjectId);
      fd.append('topic', form.topic || '');
      if (uploadMode === 'file' && file) {
        fd.append('file', file);
      } else {
        fd.append('fileUrl', form.fileUrl);
      }
      await api.post('/notes', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Note uploaded successfully!');
      setShowForm(false);
      setForm({ title: '', description: '', subjectId: '', topic: '', fileUrl: '' });
      setFile(null);
      setUploadMode('link');
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/notes/${id}`);
      toast.success('Note deleted successfully');
      setShowDeleteConfirm(null);
      loadData();
    } catch {
      toast.error('Failed to delete note');
    }
  };

  const handleDownload = (url, title) => {
    if (!url) {
      toast.error('No file available');
      return;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = title;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const getFileIcon = (url) => {
    if (!url) return '📄';
    const ext = url.split('.').pop().toLowerCase();
    const icons = {
      pdf: '📕', doc: '📘', docx: '📘', ppt: '📙', pptx: '📙',
      xls: '📗', xlsx: '📗', zip: '📦', jpg: '🖼️', jpeg: '🖼️',
      png: '🖼️', gif: '🖼️', mp4: '🎬', mp3: '🎵'
    };
    return icons[ext] || '📎';
  };

  const navItems = user?.role === 'ADMIN' ? ADMIN_NAV : isFaculty ? FACULTY_NAV : STUDENT_NAV;

  if (loading && notes.length === 0) {
    return (
      <Layout isDark={isDark} onToggleDark={onToggleDark} title="Study Notes" navItems={navItems}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress sx={{ color: amber }} />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Study Notes" navItems={navItems}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
              📚 Study Notes
            </Typography>
            <Typography variant="body2" sx={{ color: '#6b7280' }}>
              {isFaculty ? `${notes.length} notes uploaded` : 'Access course study materials'}
            </Typography>
          </Box>
          {isFaculty && (
            <Button
              variant="contained"
              startIcon={showForm ? <Close /> : <Add />}
              onClick={() => setShowForm(!showForm)}
              sx={{
                bgcolor: amber,
                color: '#0f1923',
                fontWeight: 700,
                textTransform: 'none',
                py: 1.2,
                px: 3,
                borderRadius: 2,
                '&:hover': { bgcolor: '#d97706' },
              }}
            >
              {showForm ? 'Cancel' : 'Add Note'}
            </Button>
          )}
        </Box>
      </Box>

      {/* Upload Form Dialog */}
      <Dialog open={showForm} onClose={() => setShowForm(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={800}>📝 Upload New Note</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField
            fullWidth
            label="Title *"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Subject *</InputLabel>
            <Select
              value={form.subjectId}
              label="Subject *"
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
            >
              {subjects.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name} ({s.code})</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="Topic (optional)"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="Description (optional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            margin="normal"
            multiline
            rows={3}
          />

          {/* Upload Mode Toggle */}
          <Box sx={{ display: 'flex', gap: 1, mt: 2, mb: 2 }}>
            <Button
              size="small"
              variant={uploadMode === 'link' ? 'contained' : 'outlined'}
              onClick={() => setUploadMode('link')}
              sx={uploadMode === 'link' ? { bgcolor: amber, color: '#0f1923' } : { borderColor: amber, color: amber }}
            >
              🔗 Link
            </Button>
            <Button
              size="small"
              variant={uploadMode === 'file' ? 'contained' : 'outlined'}
              onClick={() => setUploadMode('file')}
              sx={uploadMode === 'file' ? { bgcolor: amber, color: '#0f1923' } : { borderColor: amber, color: amber }}
            >
              📁 File
            </Button>
          </Box>

          {uploadMode === 'link' ? (
            <TextField
              fullWidth
              label="File URL *"
              placeholder="Google Drive, OneDrive, Dropbox, etc."
              value={form.fileUrl}
              onChange={(e) => setForm({ ...form, fileUrl: e.target.value })}
              margin="normal"
            />
          ) : (
            <Box>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                style={{ display: 'none' }}
                id="note-file"
              />
              <label htmlFor="note-file" style={{ display: 'block' }}>
                <Button
                  variant="outlined"
                  component="span"
                  fullWidth
                  startIcon={<AttachFile />}
                  sx={{ py: 1.5, borderColor: amber, color: amber, borderStyle: 'dashed', borderWidth: 2 }}
                >
                  {file ? `✅ ${file.name}` : 'Click to select file'}
                </Button>
              </label>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setShowForm(false); setFile(null); }}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={uploading}
            sx={{ bgcolor: amber, color: '#0f1923', '&:hover': { bgcolor: '#d97706' } }}
          >
            {uploading ? 'Uploading...' : 'Upload'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(showDeleteConfirm)} onClose={() => setShowDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>Delete Note?</DialogTitle>
        <DialogContent>
          <Typography>This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => handleDelete(showDeleteConfirm)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Empty State */}
      {notes.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 12 }}>
          <Typography variant="h5" sx={{ color: '#9ca3af', mb: 1 }}>
            📚 No Study Notes Yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#d1d5db' }}>
            {isFaculty ? 'Upload study materials to get started' : 'Check back later for new study notes'}
          </Typography>
        </Box>
      )}

      {/* Subject Filter */}
      {notes.length > 0 && (
        <Box sx={{ mb: 3 }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel>Filter by Subject</InputLabel>
            <Select
              value={subjectFilter}
              label="Filter by Subject"
              onChange={(e) => setSubjectFilter(e.target.value)}
            >
              <MenuItem value="">All Subjects</MenuItem>
              {subjects.map((s) => (
                <MenuItem key={s.id} value={s.id}>{s.name} ({s.code})</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      )}

      {/* Notes Grid */}
      {notes.length > 0 && (
        <Grid container spacing={3}>
          {notes.map((note) => (
            <Grid item xs={12} sm={6} md={4} key={note.id}>
              <NoteCard
                note={note}
                isFaculty={isFaculty}
                onDownload={handleDownload}
                onDelete={() => setShowDeleteConfirm(note.id)}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Layout>
  );
}
