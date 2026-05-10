import React, { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Box, Button, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  CircularProgress, IconButton, Grid, Tooltip, Alert,
} from '@mui/material';
import {
  Add, Delete, CalendarMonth, Dashboard, School, Assignment,
  Assessment, Campaign, Quiz, EventNote, AccountBalance,
  VideoCall, MenuBook, Notifications as NotifIcon, Chat as ChatIcon,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import { FACULTY_NAV, STUDENT_NAV, ADMIN_NAV } from '../constants/nav';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const DAYS = ['', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORT = ['', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const SLOT_COLORS = [
  '#f59e0b', '#f59e0b', '#059669', '#d97706',
  '#dc2626', '#0891b2', '#be185d', '#065f46',
];


const TIME_SLOTS = [
  '08:00','09:00','10:00','11:00','12:00',
  '13:00','14:00','15:00','16:00','17:00','18:00',
];

export default function Timetable({ isDark, onToggleDark }) {
  const { user } = useAuth();
  const isAdmin   = user?.role === 'ADMIN';
  const isFaculty = user?.role === 'FACULTY';
  const canEdit   = isAdmin || isFaculty;

  const [timetable, setTimetable] = useState([]);
  const [subjects,  setSubjects]  = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [classes,   setClasses]   = useState([]);
  const [open,      setOpen]      = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [form, setForm] = useState({
    classId: '', subjectId: '', facultyId: '',
    dayOfWeek: 1, startTime: '09:00', endTime: '10:00', room: '',
  });

  const nav = isAdmin ? ADMIN_NAV : isFaculty ? FACULTY_NAV : STUDENT_NAV;

  useEffect(() => {
    loadTimetable();
    if (canEdit) {
      api.get('/common/subjects').then(r => setSubjects(r.data)).catch(() => {});
      api.get('/common/faculty').then(r => setFacultyList(r.data)).catch(() => {});
      api.get('/common/classes').then(r => setClasses(r.data)).catch(() => {});
    }
  }, []);

  useEffect(() => { loadTimetable(); }, [filterClass]);

  const loadTimetable = async () => {
    setLoading(true);
    try {
      const params = filterClass ? `?classId=${filterClass}` : '';
      const { data } = await api.get(`/timetable${params}`);
      setTimetable(data);
    } catch { toast.error('Failed to load timetable'); }
    finally { setLoading(false); }
  };

  const createEntry = async () => {
    if (!form.classId || !form.subjectId || !form.startTime || !form.endTime) {
      return toast.error('Fill all required fields');
    }
    try {
      await api.post('/timetable', form);
      toast.success('Slot added!');
      setOpen(false);
      setForm({ classId: '', subjectId: '', facultyId: '', dayOfWeek: 1, startTime: '09:00', endTime: '10:00', room: '' });
      loadTimetable();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  const deleteEntry = async (id) => {
    if (!window.confirm('Remove this slot?')) return;
    try { await api.delete(`/timetable/${id}`); toast.success('Removed'); loadTimetable(); }
    catch { toast.error('Delete failed'); }
  };

  // Build a color map per subject
  const subjectColorMap = {};
  let colorIdx = 0;
  timetable.forEach(t => {
    if (!subjectColorMap[t.subjectId]) {
      subjectColorMap[t.subjectId] = SLOT_COLORS[colorIdx % SLOT_COLORS.length];
      colorIdx++;
    }
  });

  // Group by day
  const grouped = {};
  for (let d = 1; d <= 6; d++) {
    grouped[d] = timetable
      .filter(t => t.dayOfWeek === d)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  const today = new Date().getDay(); // 0=Sun, 1=Mon…
  const todaySlots = grouped[today] || [];

  if (loading) return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Timetable" navItems={nav}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
    </Layout>
  );

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Timetable" navItems={nav}>

      {/* Today highlight */}
      {todaySlots.length > 0 && (
        <Alert severity="info" sx={{ mb: 3 }} icon={<CalendarMonth />}>
          <Typography fontWeight={700} sx={{ mb: 0.5 }}>Today's Classes ({DAYS[today]})</Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {todaySlots.map(t => (
              <Chip key={t.id} size="small"
                label={`${t.startTime} ${t.subject?.name}${t.room ? ` · ${t.room}` : ''}`}
                sx={{ bgcolor: subjectColorMap[t.subjectId], color: '#fff', fontWeight: 600 }}
              />
            ))}
          </Box>
        </Alert>
      )}

      {/* Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Typography variant="h5" fontWeight={800}>📅 Weekly Timetable</Typography>
          {canEdit && classes.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Filter Class</InputLabel>
              <Select value={filterClass} label="Filter Class" onChange={e => setFilterClass(e.target.value)}>
                <MenuItem value="">All Classes</MenuItem>
                {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.section}</MenuItem>)}
              </Select>
            </FormControl>
          )}
        </Box>
        {canEdit && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>
            Add Slot
          </Button>
        )}
      </Box>

      {/* Grid timetable */}
      <Card>
        <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
          {/* Header row */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '80px repeat(6, 1fr)', bgcolor: 'primary.main' }}>
            <Box sx={{ p: 1.5 }} />
            {[1,2,3,4,5,6].map(d => (
              <Box key={d} sx={{
                p: 1.5, textAlign: 'center',
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                bgcolor: d === today ? 'rgba(255,255,255,0.15)' : 'transparent',
              }}>
                <Typography variant="caption" fontWeight={700} sx={{ color: '#fff', display: 'block' }}>
                  {DAY_SHORT[d]}
                </Typography>
                {d === today && (
                  <Chip label="Today" size="small" sx={{ bgcolor: '#fff', color: 'primary.main', height: 16, fontSize: 9, fontWeight: 800 }} />
                )}
              </Box>
            ))}
          </Box>

          {/* Time rows */}
          {TIME_SLOTS.map((time, ti) => (
            <Box key={time} sx={{
              display: 'grid', gridTemplateColumns: '80px repeat(6, 1fr)',
              borderTop: '1px solid', borderColor: 'divider',
              bgcolor: ti % 2 === 0 ? 'transparent' : (isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)'),
              minHeight: 56,
            }}>
              <Box sx={{ p: 1, display: 'flex', alignItems: 'center', borderRight: '1px solid', borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600}>{time}</Typography>
              </Box>
              {[1,2,3,4,5,6].map(d => {
                const slot = grouped[d]?.find(t => t.startTime <= time && t.endTime > time);
                const isFirst = slot && slot.startTime === time;
                return (
                  <Box key={d} sx={{
                    borderLeft: '1px solid', borderColor: 'divider',
                    position: 'relative', p: 0.5,
                    bgcolor: d === today ? (isDark ? 'rgba(21,101,192,0.05)' : 'rgba(21,101,192,0.03)') : 'transparent',
                  }}>
                    {slot && isFirst && (
                      <Box sx={{
                        bgcolor: subjectColorMap[slot.subjectId] || '#f59e0b',
                        borderRadius: 1.5, p: '6px 8px',
                        position: 'relative',
                      }}>
                        <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, display: 'block', lineHeight: 1.2 }}>
                          {slot.subject?.name}
                        </Typography>
                        {slot.faculty?.name && (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: 10 }}>
                            {slot.faculty.name}
                          </Typography>
                        )}
                        {slot.room && (
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, display: 'block' }}>
                            🏫 {slot.room}
                          </Typography>
                        )}
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 9 }}>
                          {slot.startTime}–{slot.endTime}
                        </Typography>
                        {canEdit && (
                          <IconButton size="small" onClick={() => deleteEntry(slot.id)}
                            sx={{ position: 'absolute', top: 2, right: 2, color: 'rgba(255,255,255,0.7)', p: 0.25,
                              '&:hover': { color: '#fff', bgcolor: 'rgba(0,0,0,0.2)' } }}>
                            <Delete sx={{ fontSize: 12 }} />
                          </IconButton>
                        )}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          ))}
        </CardContent>
      </Card>

      {timetable.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CalendarMonth sx={{ fontSize: 64, color: 'grey.300', mb: 2 }} />
          <Typography color="text.secondary">
            {canEdit ? 'No timetable yet. Click "Add Slot" to build it.' : 'No timetable scheduled yet.'}
          </Typography>
        </Box>
      )}

      {/* Subject legend */}
      {timetable.length > 0 && (
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {Object.entries(subjectColorMap).map(([subId, color]) => {
            const sub = timetable.find(t => t.subjectId === subId)?.subject;
            return sub ? (
              <Chip key={subId} size="small" label={sub.name}
                sx={{ bgcolor: color, color: '#fff', fontWeight: 600 }} />
            ) : null;
          })}
        </Box>
      )}

      {/* Add Slot Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Timetable Slot</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Class *</InputLabel>
            <Select value={form.classId} label="Class *" onChange={e => setForm({ ...form, classId: e.target.value })}>
              {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.section} — Sem {c.semester}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Subject *</InputLabel>
            <Select value={form.subjectId} label="Subject *" onChange={e => setForm({ ...form, subjectId: e.target.value })}>
              {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name} ({s.code})</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Faculty</InputLabel>
            <Select value={form.facultyId} label="Faculty" onChange={e => setForm({ ...form, facultyId: e.target.value })}>
              <MenuItem value="">— None —</MenuItem>
              {facultyList.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Day *</InputLabel>
            <Select value={form.dayOfWeek} label="Day *" onChange={e => setForm({ ...form, dayOfWeek: e.target.value })}>
              {[1,2,3,4,5,6].map(d => <MenuItem key={d} value={d}>{DAYS[d]}</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField fullWidth label="Start Time *" type="time" value={form.startTime}
              onChange={e => setForm({ ...form, startTime: e.target.value })}
              margin="normal" InputLabelProps={{ shrink: true }} />
            <TextField fullWidth label="End Time *" type="time" value={form.endTime}
              onChange={e => setForm({ ...form, endTime: e.target.value })}
              margin="normal" InputLabelProps={{ shrink: true }} />
          </Box>
          <TextField fullWidth label="Room / Hall" value={form.room}
            onChange={e => setForm({ ...form, room: e.target.value })} margin="normal" />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createEntry}>Add Slot</Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
