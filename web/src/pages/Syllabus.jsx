import React, { useState, useEffect } from 'react';
import {
  Box, Typography, Card, CardContent, Button, Chip,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, IconButton, LinearProgress, Accordion,
  AccordionSummary, AccordionDetails, Grid, Alert, Tooltip,
} from '@mui/material';
import {
  Add, Delete, CheckCircle, RadioButtonUnchecked, ExpandMore,
  Dashboard, School, Assignment, Assessment, CalendarMonth,
  Campaign, MenuBook, VideoCall, Quiz,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const NAV_FACULTY = [
  { label: 'Dashboard',    icon: <Dashboard />,     path: '/faculty' },
  { label: 'Syllabus',     icon: <MenuBook />,      path: '/syllabus' },
  { label: 'Notes',        icon: <School />,        path: '/notes' },
  { label: 'Assignments',  icon: <Assignment />,    path: '/assignments' },
  { label: 'Timetable',    icon: <CalendarMonth />, path: '/timetable' },
  { label: 'Announcements',icon: <Campaign />,      path: '/announcements' },
];
const NAV_STUDENT = [
  { label: 'Dashboard',    icon: <Dashboard />,     path: '/student' },
  { label: 'Syllabus',     icon: <MenuBook />,      path: '/syllabus' },
  { label: 'Notes',        icon: <School />,        path: '/notes' },
  { label: 'Assignments',  icon: <Assignment />,    path: '/assignments' },
  { label: 'Timetable',    icon: <CalendarMonth />, path: '/timetable' },
];

export default function Syllabus({ isDark, onToggleDark }) {
  const { user } = useAuth();
  const isFaculty = user?.role === 'FACULTY' || user?.role === 'ADMIN';

  const [syllabus, setSyllabus]   = useState([]);
  const [subjects, setSubjects]   = useState([]);
  const [classes, setClasses]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [open, setOpen]           = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterSubject, setFilterSubject] = useState('');
  const [filterClass, setFilterClass]     = useState('');
  const [topicInput, setTopicInput]       = useState('');
  const [form, setForm] = useState({
    subjectId: '', classId: '', unit: '', title: '', topics: [],
  });

  useEffect(() => { loadData(); }, [filterSubject, filterClass]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterSubject) params.set('subjectId', filterSubject);
      if (filterClass)   params.set('classId', filterClass);

      const [sylRes, subRes, clsRes] = await Promise.all([
        api.get(`/syllabus?${params}`),
        api.get('/common/subjects'),
        api.get('/common/classes'),
      ]);
      setSyllabus(sylRes.data);
      setSubjects(subRes.data);
      setClasses(clsRes.data);
    } catch { toast.error('Failed to load syllabus'); }
    finally { setLoading(false); }
  };

  const addSyllabus = async () => {
    if (!form.subjectId || !form.classId || !form.unit || !form.title) {
      return toast.error('Fill all required fields');
    }
    if (form.topics.length === 0) return toast.error('Add at least one topic');
    setSubmitting(true);
    try {
      await api.post('/syllabus', form);
      toast.success('Unit added!');
      setOpen(false);
      setForm({ subjectId: '', classId: '', unit: '', title: '', topics: [] });
      setTopicInput('');
      loadData();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const toggleComplete = async (item) => {
    try {
      const endpoint = item.isCompleted ? `/syllabus/${item.id}/incomplete` : `/syllabus/${item.id}/complete`;
      await api.patch(endpoint);
      toast.success(item.isCompleted ? 'Marked incomplete' : '✅ Marked complete!');
      loadData();
    } catch { toast.error('Failed to update'); }
  };

  const deleteSyllabus = async (id) => {
    if (!window.confirm('Delete this unit?')) return;
    try { await api.delete(`/syllabus/${id}`); toast.success('Deleted'); loadData(); }
    catch { toast.error('Delete failed'); }
  };

  const addTopic = () => {
    const t = topicInput.trim();
    if (!t) return;
    setForm(f => ({ ...f, topics: [...f.topics, t] }));
    setTopicInput('');
  };

  const removeTopic = (idx) =>
    setForm(f => ({ ...f, topics: f.topics.filter((_, i) => i !== idx) }));

  // Group by subject
  const grouped = syllabus.reduce((acc, item) => {
    const key = item.subject?.name || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  const totalUnits     = syllabus.length;
  const completedUnits = syllabus.filter(s => s.isCompleted).length;
  const pct = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

  if (loading) return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Syllabus" navItems={isFaculty ? NAV_FACULTY : NAV_STUDENT}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
    </Layout>
  );

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Syllabus" navItems={isFaculty ? NAV_FACULTY : NAV_STUDENT}>

      {/* Progress bar */}
      {totalUnits > 0 && (
        <Card sx={{ mb: 3, p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography fontWeight={700}>Overall Syllabus Coverage</Typography>
            <Typography fontWeight={800} color={pct === 100 ? 'success.main' : 'primary.main'}>{pct}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate" value={pct}
            sx={{ height: 10, borderRadius: 5 }}
            color={pct === 100 ? 'success' : pct >= 60 ? 'primary' : 'warning'}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            {completedUnits} of {totalUnits} units completed
          </Typography>
        </Card>
      )}

      {/* Filters + Add */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Filter by Subject</InputLabel>
          <Select value={filterSubject} label="Filter by Subject" onChange={e => setFilterSubject(e.target.value)}>
            <MenuItem value="">All Subjects</MenuItem>
            {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Filter by Class</InputLabel>
          <Select value={filterClass} label="Filter by Class" onChange={e => setFilterClass(e.target.value)}>
            <MenuItem value="">All Classes</MenuItem>
            {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.section}</MenuItem>)}
          </Select>
        </FormControl>
        {isFaculty && (
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)} sx={{ ml: 'auto' }}>
            Add Unit
          </Button>
        )}
      </Box>

      {/* Syllabus grouped by subject */}
      {Object.keys(grouped).length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <MenuBook sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
          <Typography color="text.secondary">
            {isFaculty ? 'No syllabus added yet. Click "Add Unit" to start.' : 'No syllabus available yet.'}
          </Typography>
        </Box>
      ) : (
        Object.entries(grouped).map(([subjectName, units]) => {
          const subjectPct = Math.round((units.filter(u => u.isCompleted).length / units.length) * 100);
          return (
            <Box key={subjectName} sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="h6" fontWeight={700}>{subjectName}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LinearProgress
                    variant="determinate" value={subjectPct}
                    sx={{ width: 100, height: 6, borderRadius: 3 }}
                    color={subjectPct === 100 ? 'success' : 'primary'}
                  />
                  <Typography variant="caption" fontWeight={700} color={subjectPct === 100 ? 'success.main' : 'primary.main'}>
                    {subjectPct}%
                  </Typography>
                </Box>
              </Box>

              {units.map(item => (
                <Accordion
                  key={item.id}
                  sx={{
                    mb: 1,
                    border: '1px solid',
                    borderColor: item.isCompleted
                      ? (isDark ? 'rgba(5,150,105,0.4)' : 'rgba(5,150,105,0.25)')
                      : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.07)'),
                    borderRadius: '12px !important',
                    '&:before': { display: 'none' },
                    bgcolor: item.isCompleted
                      ? (isDark ? 'rgba(5,150,105,0.06)' : 'rgba(5,150,105,0.03)')
                      : 'background.paper',
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, mr: 1 }}>
                      <Chip label={`Unit ${item.unit}`} size="small" color={item.isCompleted ? 'success' : 'default'} />
                      <Typography fontWeight={700} sx={{ flex: 1 }}>{item.title}</Typography>
                      <Chip
                        label={item.class ? `${item.class.name} ${item.class.section}` : ''}
                        size="small" variant="outlined"
                        sx={{ display: { xs: 'none', sm: 'flex' } }}
                      />
                      {item.isCompleted && (
                        <Chip icon={<CheckCircle />} label="Completed" size="small" color="success" />
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                        Topics
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1 }}>
                        {(item.topics || []).map((topic, i) => (
                          <Chip
                            key={i} label={topic} size="small"
                            color={item.isCompleted ? 'success' : 'default'}
                            variant={item.isCompleted ? 'filled' : 'outlined'}
                          />
                        ))}
                      </Box>
                    </Box>

                    {item.completedAt && (
                      <Typography variant="caption" color="success.main">
                        ✅ Completed on {format(new Date(item.completedAt), 'dd MMM yyyy')}
                      </Typography>
                    )}

                    {isFaculty && (
                      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                        <Button
                          size="small"
                          variant={item.isCompleted ? 'outlined' : 'contained'}
                          color={item.isCompleted ? 'warning' : 'success'}
                          startIcon={item.isCompleted ? <RadioButtonUnchecked /> : <CheckCircle />}
                          onClick={() => toggleComplete(item)}
                        >
                          {item.isCompleted ? 'Mark Incomplete' : 'Mark Complete'}
                        </Button>
                        {user?.role === 'ADMIN' && (
                          <IconButton size="small" color="error" onClick={() => deleteSyllabus(item.id)}>
                            <Delete fontSize="small" />
                          </IconButton>
                        )}
                      </Box>
                    )}
                  </AccordionDetails>
                </Accordion>
              ))}
            </Box>
          );
        })
      )}

      {/* Add Unit Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Syllabus Unit</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Subject *</InputLabel>
            <Select value={form.subjectId} label="Subject *" onChange={e => setForm({ ...form, subjectId: e.target.value })}>
              {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Class *</InputLabel>
            <Select value={form.classId} label="Class *" onChange={e => setForm({ ...form, classId: e.target.value })}>
              {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.section} — Sem {c.semester}</MenuItem>)}
            </Select>
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Unit No. *" type="number" value={form.unit}
              onChange={e => setForm({ ...form, unit: e.target.value })}
              margin="normal" sx={{ width: 120 }}
            />
            <TextField
              fullWidth label="Unit Title *" value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              margin="normal"
            />
          </Box>

          {/* Topics input */}
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Topics *</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                fullWidth size="small" placeholder="e.g. Introduction to OOP"
                value={topicInput}
                onChange={e => setTopicInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTopic(); } }}
              />
              <Button variant="outlined" onClick={addTopic}>Add</Button>
            </Box>
            {form.topics.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
                {form.topics.map((t, i) => (
                  <Chip key={i} label={t} size="small" onDelete={() => removeTopic(i)} color="primary" variant="outlined" />
                ))}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setOpen(false); setForm({ subjectId: '', classId: '', unit: '', title: '', topics: [] }); setTopicInput(''); }}>
            Cancel
          </Button>
          <Button variant="contained" onClick={addSyllabus} disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : 'Add Unit'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
