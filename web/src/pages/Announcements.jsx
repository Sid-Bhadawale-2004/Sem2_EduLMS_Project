import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Box, Button, Chip,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, CircularProgress, Tab, Tabs, Switch, FormControlLabel,
} from '@mui/material';
import {
  Add, Delete, Campaign, School, Assignment, Assessment,
  CalendarMonth, Dashboard, Upload, Download, Public, School as ClassIcon,
  PictureAsPdf,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const NAV = [
  { label: 'Dashboard',     icon: <Dashboard />,     path: '/faculty' },
  { label: 'Notes',         icon: <School />,        path: '/notes' },
  { label: 'Assignments',   icon: <Assignment />,    path: '/assignments' },
  { label: 'Timetable',     icon: <CalendarMonth />, path: '/timetable' },
  { label: 'Announcements', icon: <Campaign />,      path: '/announcements' },
];
const NAV_STUDENT = NAV.map(n => n.path === '/faculty' ? { ...n, path: '/student' } : n);

export default function Announcements({ isDark, onToggleDark }) {
  const { user } = useAuth();
  const isFaculty = user?.role === 'FACULTY' || user?.role === 'ADMIN';
  const [announcements, setAnnouncements] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadMode, setUploadMode] = useState('link');
  const [file, setFile] = useState(null);
  const [form, setForm] = useState({ title: '', content: '', classId: '', isGlobal: true, fileUrl: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aRes, cRes] = await Promise.all([
        api.get('/announcements'),
        api.get('/common/classes'),
      ]);
      setAnnouncements(aRes.data);
      setClasses(cRes.data);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const createAnnouncement = async () => {
    if (!form.title || !form.content) return toast.error('Title and content are required');
    setSubmitting(true);
    try {
      const payload = { ...form, isGlobal: String(form.isGlobal) };
      if (uploadMode === 'file' && file) {
        const fd = new FormData();
        Object.entries(payload).forEach(([k, v]) => fd.append(k, v));
        fd.append('file', file);
        await api.post('/announcements', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/announcements', payload);
      }
      toast.success('Announcement posted!');
      setOpen(false);
      setForm({ title: '', content: '', classId: '', isGlobal: true, fileUrl: '' });
      setFile(null);
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to post'); }
    finally { setSubmitting(false); }
  };

  const deleteAnnouncement = async (id) => {
    if (!window.confirm('Delete this announcement?')) return;
    try { await api.delete(`/announcements/${id}`); toast.success('Deleted'); loadData(); }
    catch { toast.error('Delete failed'); }
  };

  if (loading) return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Announcements" navItems={isFaculty ? NAV : NAV_STUDENT}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
    </Layout>
  );

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Announcements" navItems={isFaculty ? NAV : NAV_STUDENT}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>{announcements.length} Announcements</Typography>
        {isFaculty && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Post Announcement</Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {announcements.map(a => (
          <Card key={a.id}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  {a.isGlobal
                    ? <Chip icon={<Public />} label="Global" size="small" color="primary" />
                    : <Chip icon={<ClassIcon />} label={`${a.class?.name} ${a.class?.section}`} size="small" color="secondary" />
                  }
                </Box>
                {isFaculty && (
                  <IconButton size="small" color="error" onClick={() => deleteAnnouncement(a.id)}>
                    <Delete fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <Typography variant="h6" fontWeight={700} gutterBottom>{a.title}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1, whiteSpace: 'pre-wrap' }}>{a.content}</Typography>
              {a.fileUrl && (
                <Button size="small" variant="outlined" startIcon={<Download />}
                  href={a.fileUrl} target="_blank" rel="noopener noreferrer" sx={{ mb: 1 }}>
                  View Attachment
                </Button>
              )}
              <Typography variant="caption" color="text.secondary">
                By {a.faculty?.name} · {format(new Date(a.createdAt), 'dd MMM yyyy, hh:mm a')}
              </Typography>
            </CardContent>
          </Card>
        ))}
        {announcements.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <Campaign sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography color="text.secondary">
              {isFaculty ? 'No announcements yet. Click "Post Announcement".' : 'No announcements yet.'}
            </Typography>
          </Box>
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Post Announcement</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} margin="normal" />
          <TextField fullWidth label="Content *" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} margin="normal" multiline rows={4} />
          <FormControlLabel sx={{ mt: 1 }} control={
            <Switch checked={form.isGlobal} onChange={e => setForm({ ...form, isGlobal: e.target.checked, classId: '' })} />
          } label={form.isGlobal ? '🌐 Send to ALL students' : '🎓 Send to specific class'} />
          {!form.isGlobal && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Select Class</InputLabel>
              <Select value={form.classId} label="Select Class" onChange={e => setForm({ ...form, classId: e.target.value })}>
                {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.section}</MenuItem>)}
              </Select>
            </FormControl>
          )}
          <Box sx={{ mt: 2 }}>
            <Tabs value={uploadMode} onChange={(_, v) => setUploadMode(v)} variant="fullWidth">
              <Tab label="📎 Paste Link" value="link" />
              <Tab label="📁 Upload File" value="file" />
            </Tabs>
            {uploadMode === 'link' ? (
              <TextField fullWidth label="Attachment URL (optional)" placeholder="Google Drive, OneDrive, PDF link..."
                value={form.fileUrl} onChange={e => setForm({ ...form, fileUrl: e.target.value })} margin="normal" />
            ) : (
              <Box sx={{ mt: 1 }}>
                <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png" id="ann-file"
                  style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
                <label htmlFor="ann-file">
                  <Button variant="outlined" component="span" startIcon={<Upload />} fullWidth>
                    {file ? file.name : 'Choose File (PDF / Image)'}
                  </Button>
                </label>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createAnnouncement} disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : 'Post'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
