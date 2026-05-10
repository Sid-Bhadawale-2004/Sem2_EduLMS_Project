import React, { useState, useEffect, useRef } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Button, Chip,
  FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, Alert, Tabs, Tab, TextField, IconButton, Tooltip,
  Avatar,
} from '@mui/material';
import {
  CheckCircle, Cancel, HourglassEmpty, Save, People,
  FilterList, Download, BarChart as BarChartIcon,
  VideoCall, MenuBook, Notifications as NotifIcon,
  Chat as ChatIcon, AccountCircle, CameraAlt, AutoAwesome,
  CalendarMonth,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import { FACULTY_NAV } from '../constants/nav';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';

const STATUS_COLOR = { PRESENT: 'success', ABSENT: 'error', LATE: 'warning' };
const STATUS_ICON  = { PRESENT: '✅', ABSENT: '❌', LATE: '⏰' };

export default function FacultyAttendance({ isDark, onToggleDark }) {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);

  // Session history state
  const [sessions,      setSessions]      = useState([]);
  const [loadingSess,   setLoadingSess]   = useState(true);
  const [classes,       setClasses]       = useState([]);
  const [subjects,      setSubjects]      = useState([]);
  const [filterClass,   setFilterClass]   = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterDate,    setFilterDate]    = useState('');
  const [selectedSess,  setSelectedSess]  = useState(null);
  const [sessStudents,  setSessStudents]  = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Manual attendance state
  const [manualClass,      setManualClass]      = useState('');
  const [manualSubject,    setManualSubject]    = useState('');
  const [studentList,      setStudentList]      = useState([]);
  const [attendance,       setAttendance]       = useState({});
  const [existingSess,     setExistingSess]     = useState(null);
  const [savingManual,     setSavingManual]     = useState(false);
  const [loadingStudents,  setLoadingStudents]  = useState(false);

  // Doc scanner state
  const [scanImg,    setScanImg]    = useState(null);
  const [scanning,   setScanning]   = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [scanClass,  setScanClass]  = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    loadSessions();
    api.get('/common/classes').then(r => setClasses(r.data)).catch(() => {});
    api.get('/common/subjects').then(r => setSubjects(r.data)).catch(() => {});
  }, []);

  const loadSessions = async () => {
    setLoadingSess(true);
    try {
      const { data } = await api.get('/sessions?limit=100');
      setSessions(data.sessions || []);
    } catch { toast.error('Failed to load sessions'); }
    finally { setLoadingSess(false); }
  };

  const loadSessionDetail = async (sess) => {
    setSelectedSess(sess);
    setLoadingDetail(true);
    try {
      const { data } = await api.get(`/attendance/session/${sess.id}`);
      setSessStudents(data);
    } catch { toast.error('Failed to load session details'); }
    finally { setLoadingDetail(false); }
  };

  const updateRecord = async (rec, newStatus) => {
    try {
      await api.post('/attendance/manual', {
        sessionId: selectedSess.id,
        studentId: rec.studentId,
        status:    newStatus,
      });
      setSessStudents(prev => prev.map(s => s.id === rec.id ? { ...s, status: newStatus } : s));
      toast.success('Updated!');
    } catch (err) { toast.error(err.response?.data?.error || 'Update failed'); }
  };

  // Download session attendance as Excel
  const downloadSessionExcel = () => {
    if (!sessStudents.length || !selectedSess) return;
    const rows = sessStudents.map(a => ({
      'Roll No':   a.rollNumber || '—',
      'Name':      a.name       || '—',
      'Status':    a.status,
      'Marked By': a.markedBy,
      'Marked At': a.markedAt ? format(new Date(a.markedAt), 'dd MMM yyyy, hh:mm a') : '—',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 26 }, { wch: 10 }, { wch: 12 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const subj = selectedSess.subject?.name?.replace(/\s+/g, '_') || 'session';
    const date = format(new Date(selectedSess.createdAt), 'ddMMMyyyy');
    XLSX.writeFile(wb, `Attendance_${subj}_${date}.xlsx`);
    toast.success('Downloaded!');
  };

  // Filter sessions — use .id which is set by backend
  const filteredSessions = sessions.filter(s => {
    if (filterClass   && String(s.classId)   !== filterClass)   return false;
    if (filterSubject && String(s.subjectId) !== filterSubject) return false;
    if (filterDate) {
      const d  = new Date(s.startTime || s.createdAt);
      const fd = new Date(filterDate);
      if (d.toDateString() !== fd.toDateString()) return false;
    }
    return true;
  });

  // Manual attendance
  const loadStudentsForManual = async () => {
    if (!manualClass || !manualSubject) return toast.error('Select class and subject');
    setLoadingStudents(true);
    try {
      const { data } = await api.get(`/common/class-students/${manualClass}`);
      setStudentList(data);
      const init = {};
      data.forEach(s => { init[s.id] = 'PRESENT'; });
      setAttendance(init);
      setExistingSess(null);
    } catch { toast.error('Failed to load students'); }
    finally { setLoadingStudents(false); }
  };

  const toggleStatus = (studentId) => {
    setAttendance(prev => {
      const cur  = prev[studentId] || 'PRESENT';
      const next = cur === 'PRESENT' ? 'ABSENT' : cur === 'ABSENT' ? 'LATE' : 'PRESENT';
      return { ...prev, [studentId]: next };
    });
  };

  const setAllStatus = (status) => {
    const updated = {};
    studentList.forEach(s => { updated[s.id] = status; });
    setAttendance(updated);
  };

  const saveManualAttendance = async () => {
    if (!studentList.length) return toast.error('Load students first');
    setSavingManual(true);
    try {
      let sessionId = existingSess;
      if (!sessionId) {
        const { data: sess } = await api.post('/sessions', {
          classId: manualClass, subjectId: manualSubject, mode: 'CODE',
        });
        sessionId = sess.id;
        setExistingSess(sessionId);
        await api.post(`/sessions/${sessionId}/end`).catch(() => {});
      }
      let saved = 0;
      for (const student of studentList) {
        try {
          await api.post('/attendance/manual', {
            sessionId,
            studentId: student.id,
            status:    attendance[student.id] || 'ABSENT',
          });
          saved++;
        } catch {}
      }
      toast.success(`✅ Saved ${saved}/${studentList.length} attendance records!`);
      loadSessions();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSavingManual(false); }
  };

  // Doc scanner
  const handleScanFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => setScanImg(evt.target.result);
    reader.readAsDataURL(file);
  };

  const scanDocument = async () => {
    if (!scanImg) return toast.error('Upload an image first');
    setScanning(true); setScanResult(null);
    try {
      const base64    = scanImg.split(',')[1];
      const mediaType = scanImg.split(';')[0].split(':')[1];
      const response  = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: `Extract the timetable from this image. Return ONLY a JSON array:\n[{"day":"Monday","subject":"Mathematics","startTime":"09:00","endTime":"10:00","room":"101"}]\nUse 24-hour time. Only return the JSON array, nothing else.` },
          ]}],
        }),
      });
      const data = await response.json();
      const text = data.content?.[0]?.text || '';
      const parsed = JSON.parse(text.replace(/\`\`\`json|\`\`\`/g, '').trim());
      setScanResult(parsed);
      toast.success(`Found ${parsed.length} entries!`);
    } catch { toast.error('Could not read the document. Try a clearer image.'); }
    finally { setScanning(false); }
  };

  const importScannedTimetable = async () => {
    if (!scanResult?.length || !scanClass) return;
    const DAYS = { monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };
    let imported = 0;
    for (const entry of scanResult) {
      const dayNum = DAYS[entry.day?.toLowerCase()];
      if (!dayNum) continue;
      const subj = subjects.find(s =>
        s.name.toLowerCase().includes(entry.subject?.toLowerCase()) ||
        entry.subject?.toLowerCase().includes(s.name.toLowerCase())
      );
      if (!subj) continue;
      try {
        await api.post('/timetable', {
          classId: scanClass, subjectId: subj.id, dayOfWeek: dayNum,
          startTime: entry.startTime, endTime: entry.endTime, room: entry.room || '',
          facultyId: subj.facultyId || '',
        });
        imported++;
      } catch {}
    }
    toast.success(`✅ Imported ${imported} timetable slots!`);
    setScanResult(null); setScanImg(null);
  };

  const presentCount = Object.values(attendance).filter(v => v === 'PRESENT').length;
  const absentCount  = Object.values(attendance).filter(v => v === 'ABSENT').length;
  const lateCount    = Object.values(attendance).filter(v => v === 'LATE').length;

  const amber = '#f59e0b';

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Attendance Management" navItems={FACULTY_NAV}>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3, '& .MuiTabs-indicator': { bgcolor: amber } }}
        variant="scrollable" scrollButtons="auto">
        <Tab label="📋 Session History" />
        <Tab label="✏️ Manual Attendance" />
        <Tab label="📄 Scan → Timetable" />
      </Tabs>

      {/* ── TAB 0 — SESSION HISTORY ─────────────────────────────── */}
      {tab === 0 && (
        <Grid container spacing={3}>
          {/* Filters */}
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <FilterList sx={{ color: amber }} />
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Class</InputLabel>
                    <Select value={filterClass} label="Class" onChange={e => setFilterClass(e.target.value)}>
                      <MenuItem value="">All Classes</MenuItem>
                      {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.section}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 160 }}>
                    <InputLabel>Subject</InputLabel>
                    <Select value={filterSubject} label="Subject" onChange={e => setFilterSubject(e.target.value)}>
                      <MenuItem value="">All Subjects</MenuItem>
                      {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <TextField size="small" type="date" label="Date"
                    value={filterDate} onChange={e => setFilterDate(e.target.value)}
                    InputLabelProps={{ shrink: true }} />
                  <Button variant="outlined" size="small"
                    onClick={() => { setFilterClass(''); setFilterSubject(''); setFilterDate(''); }}>
                    Clear
                  </Button>
                  <Box sx={{ ml: 'auto' }}>
                    <Chip label={`${filteredSessions.length} sessions`} size="small"
                      sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }} />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Sessions list */}
          <Grid item xs={12} md={selectedSess ? 5 : 12}>
            {loadingSess ? (
              <Box sx={{ textAlign: 'center', py: 4 }}><CircularProgress sx={{ color: amber }} /></Box>
            ) : filteredSessions.length === 0 ? (
              <Alert severity="info">No sessions found. Start a session from the dashboard.</Alert>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {filteredSessions.map(s => (
                  <Card key={s.id} onClick={() => loadSessionDetail(s)}
                    sx={{
                      cursor: 'pointer', transition: 'all 0.15s',
                      border: '2px solid',
                      borderColor: selectedSess?.id === s.id ? amber : 'transparent',
                      '&:hover': { borderColor: `${amber}88`, transform: 'translateX(3px)' },
                    }}>
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                        <Box>
                          <Typography fontWeight={700}>{s.subject?.name}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {s.class?.name} {s.class?.section} · {format(new Date(s.startTime || s.createdAt), 'dd MMM yyyy, hh:mm a')}
                          </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Chip label={`${s._count?.attendances || 0} students`} size="small"
                            sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }} />
                          <Chip label={s.isActive ? 'Active' : 'Ended'} size="small"
                            color={s.isActive ? 'success' : 'default'} />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Grid>

          {/* Session detail panel */}
          {selectedSess && (
            <Grid item xs={12} md={7}>
              <Card>
                <CardContent>
                  {/* Header */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography variant="h6" fontWeight={700}>{selectedSess.subject?.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {selectedSess.class?.name} {selectedSess.class?.section} · {format(new Date(selectedSess.startTime || selectedSess.createdAt), 'dd MMM yyyy')}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Chip icon={<CheckCircle />} label={sessStudents.filter(s => s.status === 'PRESENT').length} color="success" size="small" />
                      <Chip icon={<Cancel />}      label={sessStudents.filter(s => s.status === 'ABSENT').length}  color="error"   size="small" />
                      <Chip icon={<HourglassEmpty />} label={sessStudents.filter(s => s.status === 'LATE').length} color="warning" size="small" />
                      {sessStudents.length > 0 && (
                        <Button size="small" variant="outlined" startIcon={<Download />}
                          onClick={downloadSessionExcel}
                          sx={{ borderColor: amber, color: amber, fontWeight: 700 }}>
                          Download
                        </Button>
                      )}
                    </Box>
                  </Box>

                  {loadingDetail ? (
                    <Box sx={{ textAlign: 'center', py: 3 }}><CircularProgress sx={{ color: amber }} /></Box>
                  ) : sessStudents.length === 0 ? (
                    <Alert severity="info">No attendance records for this session.</Alert>
                  ) : (
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: amber }}>
                            <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Roll No</TableCell>
                            <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Student</TableCell>
                            <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Status</TableCell>
                            <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Marked By</TableCell>
                            <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Edit</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {sessStudents.map(a => (
                            <TableRow key={a.id} hover>
                              <TableCell>
                                <Chip label={a.rollNumber || '—'} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: amber, color: '#0f1923' }}>
                                    {(a.name || '?')[0]}
                                  </Avatar>
                                  <Typography fontWeight={600} fontSize={13}>{a.name || '—'}</Typography>
                                </Box>
                              </TableCell>
                              <TableCell>
                                <Chip label={a.status} size="small" color={STATUS_COLOR[a.status]} />
                              </TableCell>
                              <TableCell>
                                <Chip label={a.markedBy} size="small" variant="outlined" />
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                  {['PRESENT', 'ABSENT', 'LATE'].map(st => (
                                    <Tooltip key={st} title={st}>
                                      <IconButton size="small" onClick={() => updateRecord(a, st)}
                                        sx={{
                                          bgcolor: a.status === st
                                            ? (st === 'PRESENT' ? 'rgba(16,185,129,0.15)' : st === 'ABSENT' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)')
                                            : 'transparent',
                                          p: 0.5,
                                        }}>
                                        <Typography fontSize={14}>{STATUS_ICON[st]}</Typography>
                                      </IconButton>
                                    </Tooltip>
                                  ))}
                                </Box>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* ── TAB 1 — MANUAL ATTENDANCE ───────────────────────────── */}
      {tab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography fontWeight={700} sx={{ mb: 2 }}>Select Class & Subject</Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Class *</InputLabel>
                    <Select value={manualClass} label="Class *" onChange={e => setManualClass(e.target.value)}>
                      <MenuItem value="">Select class…</MenuItem>
                      {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.section}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Subject *</InputLabel>
                    <Select value={manualSubject} label="Subject *" onChange={e => setManualSubject(e.target.value)}>
                      <MenuItem value="">Select subject…</MenuItem>
                      {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Button variant="contained" onClick={loadStudentsForManual} disabled={loadingStudents}
                    startIcon={loadingStudents ? <CircularProgress size={16} color="inherit" /> : <People />}
                    sx={{ bgcolor: amber, color: '#0f1923', '&:hover': { bgcolor: '#d97706' } }}>
                    Load Students
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {studentList.length > 0 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                    <Typography fontWeight={700}>Mark Attendance — {studentList.length} Students</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip icon={<CheckCircle />} label={`Present: ${presentCount}`} color="success" size="small" />
                      <Chip icon={<Cancel />}      label={`Absent: ${absentCount}`}  color="error"   size="small" />
                      <Chip icon={<HourglassEmpty />} label={`Late: ${lateCount}`}   color="warning" size="small" />
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Button size="small" variant="outlined" color="success" onClick={() => setAllStatus('PRESENT')}>✅ All Present</Button>
                    <Button size="small" variant="outlined" color="error"   onClick={() => setAllStatus('ABSENT')}>❌ All Absent</Button>
                    <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 1 }}>
                      Click status to cycle: Present → Absent → Late
                    </Typography>
                  </Box>

                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                    <Table>
                      <TableHead>
                        <TableRow sx={{ bgcolor: amber }}>
                          <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>#</TableCell>
                          <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Roll No</TableCell>
                          <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Student Name</TableCell>
                          <TableCell sx={{ color: '#0f1923', fontWeight: 700, textAlign: 'center' }}>Status</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {studentList.map((s, i) => {
                          const status = attendance[s.id] || 'PRESENT';
                          return (
                            <TableRow key={s.id} hover
                              sx={{ bgcolor: status === 'PRESENT' ? 'rgba(16,185,129,0.04)' : status === 'ABSENT' ? 'rgba(239,68,68,0.04)' : 'rgba(245,158,11,0.04)' }}>
                              <TableCell>{i + 1}</TableCell>
                              <TableCell><Chip label={s.rollNumber} size="small" variant="outlined" /></TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                  <Avatar sx={{ width: 28, height: 28, fontSize: 11, bgcolor: amber, color: '#0f1923' }}>
                                    {s.name?.[0]}
                                  </Avatar>
                                  <Typography fontWeight={600} fontSize={14}>{s.name}</Typography>
                                </Box>
                              </TableCell>
                              <TableCell sx={{ textAlign: 'center' }}>
                                <Button variant="contained" size="small" onClick={() => toggleStatus(s.id)}
                                  color={status === 'PRESENT' ? 'success' : status === 'ABSENT' ? 'error' : 'warning'}
                                  sx={{ minWidth: 90, fontWeight: 700 }}>
                                  {STATUS_ICON[status]} {status}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>

                  <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                    <Button variant="outlined" onClick={() => setAllStatus('PRESENT')}>Reset All</Button>
                    <Button variant="contained" size="large" onClick={saveManualAttendance} disabled={savingManual}
                      startIcon={savingManual ? <CircularProgress size={18} color="inherit" /> : <Save />}
                      sx={{ bgcolor: amber, color: '#0f1923', '&:hover': { bgcolor: '#d97706' } }}>
                      {savingManual ? 'Saving…' : `Save Attendance (${studentList.length} students)`}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* ── TAB 2 — DOC SCANNER ─────────────────────────────────── */}
      {tab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Alert severity="info" sx={{ mb: 2 }} icon={<AutoAwesome />}>
              <Typography fontWeight={700}>AI Timetable Scanner</Typography>
              Upload a photo of any printed or handwritten timetable — AI will read it and auto-fill your timetable.
            </Alert>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography fontWeight={700} sx={{ mb: 2 }}>📸 Upload Document</Typography>
                <Box onClick={() => fileRef.current?.click()}
                  sx={{
                    border: '2px dashed', borderColor: amber, borderRadius: 3,
                    p: 4, textAlign: 'center', cursor: 'pointer', mb: 2,
                    bgcolor: 'rgba(245,158,11,0.04)', transition: 'all 0.2s',
                    '&:hover': { bgcolor: 'rgba(245,158,11,0.08)' },
                  }}>
                  {scanImg ? (
                    <img src={scanImg} alt="preview" style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 8, objectFit: 'contain' }} />
                  ) : (
                    <>
                      <CameraAlt sx={{ fontSize: 48, color: amber, mb: 1 }} />
                      <Typography fontWeight={600}>Click to upload timetable image</Typography>
                      <Typography variant="caption" color="text.secondary">JPG or PNG</Typography>
                    </>
                  )}
                </Box>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleScanFile} />

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel>Target Class (for import)</InputLabel>
                  <Select value={scanClass} label="Target Class (for import)" onChange={e => setScanClass(e.target.value)}>
                    <MenuItem value="">Select class…</MenuItem>
                    {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.section}</MenuItem>)}
                  </Select>
                </FormControl>

                <Button fullWidth variant="contained" size="large" onClick={scanDocument}
                  disabled={scanning || !scanImg}
                  startIcon={scanning ? <CircularProgress size={18} color="inherit" /> : <AutoAwesome />}
                  sx={{ bgcolor: amber, color: '#0f1923', '&:hover': { bgcolor: '#d97706' } }}>
                  {scanning ? 'AI is reading…' : '🤖 Scan with AI'}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography fontWeight={700} sx={{ mb: 2 }}>📅 Extracted Schedule</Typography>
                {!scanResult ? (
                  <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                    <AutoAwesome sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                    <Typography>Upload and scan a document to see results here</Typography>
                  </Box>
                ) : (
                  <>
                    <Alert severity="success" sx={{ mb: 2 }}>Found {scanResult.length} schedule entries!</Alert>
                    <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
                      <Table size="small">
                        <TableHead>
                          <TableRow sx={{ bgcolor: amber }}>
                            <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Day</TableCell>
                            <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Subject</TableCell>
                            <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Time</TableCell>
                            <TableCell sx={{ color: '#0f1923', fontWeight: 700 }}>Room</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {scanResult.map((r, i) => (
                            <TableRow key={i} hover>
                              <TableCell><Chip label={r.day} size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e' }} /></TableCell>
                              <TableCell fontWeight={600}>{r.subject}</TableCell>
                              <TableCell>{r.startTime} – {r.endTime}</TableCell>
                              <TableCell>{r.room || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    <Alert severity="warning" sx={{ mb: 2 }}>
                      Only entries where subject names match your existing subjects will be imported.
                    </Alert>
                    <Button fullWidth variant="contained" color="success" size="large"
                      onClick={importScannedTimetable} disabled={!scanClass}
                      startIcon={<CalendarMonth />}>
                      Import to Timetable
                    </Button>
                    {!scanClass && (
                      <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                        Select a target class above first
                      </Typography>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Layout>
  );
}
