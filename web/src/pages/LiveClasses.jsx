import React, { useState, useEffect } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Button, Chip,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, IconButton, Alert,
} from '@mui/material';
import {
  Add, Delete, VideoCall, Dashboard, School, Assignment,
  Assessment, CalendarMonth, Campaign, OpenInNew,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, isPast, isFuture, isWithinInterval, addMinutes } from 'date-fns';

const NAV = [
  { label: 'Dashboard',    icon: <Dashboard />,  path: '/faculty' },
  { label: 'Live Classes', icon: <VideoCall />,  path: '/live-classes' },
  { label: 'Notes',        icon: <School />,     path: '/notes' },
  { label: 'Assignments',  icon: <Assignment />, path: '/assignments' },
  { label: 'Timetable',    icon: <CalendarMonth />, path: '/timetable' },
  { label: 'Announcements',icon: <Campaign />,   path: '/announcements' },
];
const NAV_STUDENT = NAV.map(n => n.path === '/faculty' ? { ...n, path: '/student' } : n);

const PLATFORMS = ['Google Meet', 'Zoom', 'Microsoft Teams', 'YouTube Live', 'Other'];

export default function LiveClasses({ isDark, onToggleDark }) {
  const { user } = useAuth();
  const isFaculty = user?.role === 'FACULTY' || user?.role === 'ADMIN';
  const [classes, setClasses]   = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', meetLink: '', platform: 'Google Meet', subjectId: '', scheduledAt: '', duration: 60 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, sRes] = await Promise.all([api.get('/live-classes'), api.get('/common/subjects')]);
      setClasses(cRes.data);
      setSubjects(sRes.data);
    } catch { toast.error('Failed to load live classes'); }
    finally { setLoading(false); }
  };

  const createClass = async () => {
    if (!form.title || !form.meetLink || !form.subjectId || !form.scheduledAt) return toast.error('Fill required fields');
    setSubmitting(true);
    try {
      await api.post('/live-classes', form);
      toast.success('Live class scheduled & students notified!');
      setOpen(false);
      setForm({ title: '', description: '', meetLink: '', platform: 'Google Meet', subjectId: '', scheduledAt: '', duration: 60 });
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const deleteClass = async (id) => {
    if (!window.confirm('Delete this class?')) return;
    try { await api.delete(`/live-classes/${id}`); toast.success('Deleted'); loadData(); }
    catch { toast.error('Delete failed'); }
  };

  const getStatus = (cls) => {
    const start = new Date(cls.scheduledAt);
    const end = addMinutes(start, cls.duration || 60);
    if (isWithinInterval(new Date(), { start, end })) return { label: '🔴 LIVE NOW', color: 'error' };
    if (isFuture(start)) return { label: 'Upcoming', color: 'warning' };
    return { label: 'Ended', color: 'default' };
  };

  const getPlatformIcon = (platform) => {
    if (platform?.includes('Meet')) return '🔵';
    if (platform?.includes('Zoom')) return '💙';
    if (platform?.includes('Teams')) return '💜';
    if (platform?.includes('YouTube')) return '🔴';
    return '🎥';
  };

  if (loading) return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Live Classes" navItems={isFaculty ? NAV : NAV_STUDENT}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
    </Layout>
  );

  const upcoming = classes.filter(c => isFuture(new Date(c.scheduledAt)));
  const live     = classes.filter(c => {
    const start = new Date(c.scheduledAt);
    const end = addMinutes(start, c.duration || 60);
    return isWithinInterval(new Date(), { start, end });
  });
  const past = classes.filter(c => isPast(addMinutes(new Date(c.scheduledAt), c.duration || 60)));

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Live Classes" navItems={isFaculty ? NAV : NAV_STUDENT}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Live Classes</Typography>
        {isFaculty && <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Schedule Class</Button>}
      </Box>

      {/* Live now banner */}
      {live.length > 0 && (
        <Alert severity="error" sx={{ mb: 3, fontWeight: 700 }} icon={<VideoCall />}>
          🔴 {live.length} class{live.length > 1 ? 'es are' : ' is'} LIVE right now!
          <Button size="small" variant="contained" color="error" sx={{ ml: 2 }} href={live[0].meetLink} target="_blank">
            Join Now
          </Button>
        </Alert>
      )}

      {classes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <VideoCall sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography color="text.secondary">
            {isFaculty ? 'No classes scheduled. Click "Schedule Class".' : 'No live classes scheduled yet.'}
          </Typography>
        </Box>
      ) : (
        <>
          {upcoming.length > 0 && (
            <>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>📅 Upcoming ({upcoming.length})</Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {upcoming.map(cls => {
                  const status = getStatus(cls);
                  return (
                    <Grid item xs={12} sm={6} md={4} key={cls.id}>
                      <Card sx={{ border: status.color === 'error' ? '2px solid #dc2626' : 'none' }}>
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                            <Chip label={status.label} size="small" color={status.color} />
                            <Typography variant="caption">{getPlatformIcon(cls.platform)} {cls.platform}</Typography>
                          </Box>
                          <Typography variant="h6" fontWeight={700} gutterBottom>{cls.title}</Typography>
                          <Typography variant="body2" color="text.secondary">{cls.subject?.name}</Typography>
                          <Typography variant="body2" color="text.secondary">By {cls.faculty?.name}</Typography>
                          <Box sx={{ mt: 1 }}>
                            <Typography variant="body2">📅 {format(new Date(cls.scheduledAt), 'dd MMM yyyy, hh:mm a')}</Typography>
                            <Typography variant="body2">⏱ Duration: {cls.duration} minutes</Typography>
                          </Box>
                          {cls.description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{cls.description}</Typography>}
                          <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                            <Button size="small" variant="contained" startIcon={<OpenInNew />} href={cls.meetLink} target="_blank" fullWidth>
                              Join {cls.platform}
                            </Button>
                            {isFaculty && (
                              <IconButton size="small" color="error" onClick={() => deleteClass(cls.id)}><Delete fontSize="small" /></IconButton>
                            )}
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </>
          )}

          {past.length > 0 && (
            <>
              <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }} color="text.secondary">📼 Past Classes ({past.length})</Typography>
              <Grid container spacing={2}>
                {past.slice(0, 6).map(cls => (
                  <Grid item xs={12} sm={6} md={4} key={cls.id}>
                    <Card sx={{ opacity: 0.65 }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Chip label="Ended" size="small" />
                          <Typography variant="caption">{getPlatformIcon(cls.platform)} {cls.platform}</Typography>
                        </Box>
                        <Typography variant="h6" fontWeight={700} noWrap>{cls.title}</Typography>
                        <Typography variant="body2" color="text.secondary">{cls.subject?.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {format(new Date(cls.scheduledAt), 'dd MMM yyyy, hh:mm a')}
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
          )}
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Schedule Live Class</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} margin="normal" />
          <TextField fullWidth label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} margin="normal" multiline rows={2} />
          <FormControl fullWidth margin="normal">
            <InputLabel>Subject *</InputLabel>
            <Select value={form.subjectId} label="Subject *" onChange={e => setForm({ ...form, subjectId: e.target.value })}>
              {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Platform</InputLabel>
            <Select value={form.platform} label="Platform" onChange={e => setForm({ ...form, platform: e.target.value })}>
              {PLATFORMS.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Meeting Link *" placeholder="https://meet.google.com/xxx-xxx-xxx" value={form.meetLink} onChange={e => setForm({ ...form, meetLink: e.target.value })} margin="normal" />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField fullWidth label="Scheduled At *" type="datetime-local" value={form.scheduledAt} onChange={e => setForm({ ...form, scheduledAt: e.target.value })} margin="normal" InputLabelProps={{ shrink: true }} />
            <TextField fullWidth label="Duration (min)" type="number" value={form.duration} onChange={e => setForm({ ...form, duration: e.target.value })} margin="normal" />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createClass} disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : 'Schedule & Notify'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
