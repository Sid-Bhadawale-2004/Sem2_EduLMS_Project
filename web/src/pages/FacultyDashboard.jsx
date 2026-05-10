import React, { useState, useEffect, useCallback } from 'react';
import {
  Grid, Card, CardContent, Typography, Button, Box, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  FormControl, InputLabel, Select, MenuItem, List, ListItem,
  ListItemText, Avatar, Divider, Badge,
  CircularProgress, LinearProgress, Slider, Switch, FormControlLabel, Alert,
} from '@mui/material';
import {
  Add, QrCode, Stop, People, Download, MyLocation, Refresh,
  Dashboard, School, Assignment, CalendarMonth, Campaign,
  VideoCall, MenuBook, Notifications as NotifIcon,
  BarChart as BarChartIcon, AccountCircle, DocumentScanner,
} from '@mui/icons-material';
import { QRCodeSVG } from 'qrcode.react';
import Layout from '../components/Layout';
import api from '../services/api';
import socketService from '../services/socketService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const amber = '#f59e0b';
const emerald = '#10b981';

const NAV = [
  { label: 'Dashboard',      icon: <Dashboard />,       path: '/faculty' },
  { label: 'Attendance',     icon: <BarChartIcon />,    path: '/faculty-attendance' },
  { label: 'Timetable',      icon: <CalendarMonth />,   path: '/timetable' },
  { label: 'Scan Timetable', icon: <DocumentScanner />, path: '/timetable-scanner' },
  { label: 'Notes',          icon: <School />,          path: '/notes' },
  { label: 'Assignments',    icon: <Assignment />,      path: '/assignments' },
  { label: 'Syllabus',       icon: <MenuBook />,        path: '/syllabus' },
  { label: 'Live Classes',   icon: <VideoCall />,       path: '/live-classes' },
  { label: 'Announcements',  icon: <Campaign />,        path: '/announcements' },
  { label: 'Notifications',  icon: <NotifIcon />,       path: '/notifications' },
  { label: 'My Profile',     icon: <AccountCircle />,   path: '/profile' },
];

export default function FacultyDashboard({ isDark, onToggleDark }) {
  const { user } = useAuth();
  const [activeSessions, setActiveSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ classId: '', subjectId: '', mode: 'QR' });
  const [qrRefreshSec, setQrRefreshSec] = useState(120);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [facultyLat, setFacultyLat] = useState(null);
  const [facultyLng, setFacultyLng] = useState(null);
  const [locationRadius, setLocationRadius] = useState(100);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [autoRefreshTimer, setAutoRefreshTimer] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [qrData, setQrData] = useState(null);
  const [codeData, setCodeData] = useState(null);
  const [attendanceList, setAttendanceList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const loadSessions = useCallback(async () => {
    try { const { data } = await api.get('/sessions/active'); setActiveSessions(data); }
    catch { toast.error('Failed to load sessions'); }
  }, []);

  useEffect(() => {
    loadSessions();
    Promise.all([
      api.get('/common/classes').catch(() => ({ data: [] })),
      api.get('/common/subjects').catch(() => ({ data: [] })),
    ]).then(([cls, sub]) => { setClasses(cls.data); setSubjects(sub.data); });
  }, [loadSessions]);

  useEffect(() => {
    if (!selectedSession) return;
    socketService.joinSession(selectedSession.id);
    const unsub = socketService.onAttendanceMarked((data) => {
      setAttendanceList(prev => {
        const exists = prev.find(a => a.studentId === data.studentId);
        const updated = exists ? prev.map(a => a.studentId === data.studentId ? { ...a, ...data } : a) : [...prev, data];
        return updated.sort((a, b) => (a.rollNumber || '').localeCompare(b.rollNumber || '', undefined, { numeric: true }));
      });
      toast.success(`✅ ${data.name} marked attendance`);
    });
    const unsubQR = socketService.onQRRefreshed((data) => { setQrData(data); setCountdown(selectedSession.qrRefreshSec || qrRefreshSec || 120); });
    const unsubCode = socketService.onCodeRefreshed((data) => { setCodeData(data); setCountdown(120); });
    return () => { unsub(); unsubQR(); unsubCode(); socketService.leaveSession(selectedSession.id); };
  }, [selectedSession]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const openSession = async (session) => {
    setSelectedSession(session); setAttendanceList([]);
    if (autoRefreshTimer) clearInterval(autoRefreshTimer);
    try {
      const { data } = await api.get(`/attendance/session/${session.id}`);
      setAttendanceList(data);
      if (session.mode === 'QR') {
        const secs = session.qrRefreshSec || 120;
        await refreshQR(session.id, secs);
        const timer = setInterval(() => refreshQR(session.id, secs), secs * 1000);
        setAutoRefreshTimer(timer);
      } else { await refreshCode(session.id); }
    } catch {}
  };

  const refreshQR = async (sessionId, secs) => {
    try {
      const { data } = await api.post(`/sessions/${sessionId}/qr`);
      setQrData(data);
      setCountdown(secs || selectedSession?.qrRefreshSec || qrRefreshSec || 120);
    } catch { toast.error('Failed to refresh QR'); }
  };

  const refreshCode = async (sessionId) => {
    try { const { data } = await api.post(`/sessions/${sessionId}/code`); setCodeData(data); setCountdown(120); }
    catch { toast.error('Failed to refresh code'); }
  };

  const captureLocation = () => {
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { setFacultyLat(pos.coords.latitude); setFacultyLng(pos.coords.longitude); setGpsLoading(false); toast.success('📍 Location captured!'); },
      () => { toast.error('Could not get location'); setGpsLoading(false); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const createSession = async () => {
    if (!form.classId || !form.subjectId) return toast.error('Select class and subject');
    setLoading(true);
    try {
      const { data } = await api.post('/sessions', { ...form, qrRefreshSec, locationEnabled, locationLat: facultyLat, locationLng: facultyLng, locationRadius });
      toast.success(`Session started (${form.mode} mode)`);
      setCreateOpen(false); setForm({ classId: '', subjectId: '', mode: 'QR' });
      await loadSessions(); await openSession(data);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to create session'); }
    finally { setLoading(false); }
  };

  const endSession = async (sessionId) => {
    try {
      if (autoRefreshTimer) clearInterval(autoRefreshTimer);
      await api.post(`/sessions/${sessionId}/end`);
      toast.success('Session ended'); setSelectedSession(null); setQrData(null); setCodeData(null);
      await loadSessions();
    } catch { toast.error('Failed to end session'); }
  };

  const qrValue = qrData?.token || '';

  const selectSx = {
    '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: amber },
    '& .MuiInputLabel-root.Mui-focused': { color: amber },
  };

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Faculty Dashboard" navItems={NAV}>
      <Grid container spacing={3}>
        {/* Left — sessions list */}
        <Grid item xs={12} md={4}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={700}>Active Sessions</Typography>
            <Button variant="contained" startIcon={<Add />} size="small" onClick={() => setCreateOpen(true)}
              sx={{ bgcolor: amber, color: '#0f1923', fontWeight: 700, '&:hover': { bgcolor: '#d97706' } }}>
              New
            </Button>
          </Box>

          {activeSessions.length === 0 ? (
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 5 }}>
                <QrCode sx={{ fontSize: 52, color: amber, opacity: 0.5, mb: 1.5 }} />
                <Typography color="text.secondary" fontWeight={500}>No active sessions</Typography>
                <Button variant="outlined" sx={{ mt: 2, borderColor: amber, color: amber }} onClick={() => setCreateOpen(true)}>
                  Start Session
                </Button>
              </CardContent>
            </Card>
          ) : (
            activeSessions.map(session => (
              <Card key={session.id} sx={{ mb: 2, cursor: 'pointer', border: 2, borderColor: selectedSession?.id === session.id ? amber : 'transparent', transition: 'border-color 0.2s' }} onClick={() => openSession(session)}>
                <CardContent sx={{ pb: '16px !important' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography fontWeight={700}>{session.subject?.name}</Typography>
                      <Typography variant="body2" color="text.secondary">{session.class?.name} – {session.class?.section}</Typography>
                      <Typography variant="caption" color="text.secondary">{formatDistanceToNow(new Date(session.startTime), { addSuffix: true })}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <Chip label={session.mode} size="small" sx={{ bgcolor: session.mode === 'QR' ? '#fef3c7' : '#dbeafe', color: session.mode === 'QR' ? '#92400e' : '#1e40af', fontWeight: 700 }} />
                      <Badge badgeContent={session._count?.attendances || 0} color="success" max={999}>
                        <People fontSize="small" sx={{ color: emerald }} />
                      </Badge>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))
          )}
        </Grid>

        {/* Right — session detail */}
        <Grid item xs={12} md={8}>
          {selectedSession ? (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Card>
                  <CardContent sx={{ textAlign: 'center' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="h6" fontWeight={700}>{selectedSession.mode === 'QR' ? 'QR Code' : 'Access Code'}</Typography>
                      <Button size="small" color="error" variant="outlined" startIcon={<Stop />} onClick={() => endSession(selectedSession.id)}>End</Button>
                    </Box>

                    {selectedSession.mode === 'QR' && qrData && (
                      <>
                        <Box sx={{ p: 2, bgcolor: '#fff', borderRadius: 3, display: 'inline-block', border: '2px solid', borderColor: amber, boxShadow: `0 0 0 4px ${amber}22` }}>
                          <QRCodeSVG value={qrValue} size={180} level="H" />
                        </Box>
                        <Box sx={{ mt: 2 }}>
                          <LinearProgress variant="determinate" value={(countdown / (selectedSession?.qrRefreshSec || qrRefreshSec || 120)) * 100}
                            sx={{ mb: 1, borderRadius: 4, height: 8, bgcolor: 'rgba(245,158,11,0.15)', '& .MuiLinearProgress-bar': { bgcolor: amber } }} />
                          <Typography variant="caption" color="text.secondary">Refreshes in {countdown}s</Typography>
                        </Box>
                        <Button variant="outlined" size="small" sx={{ mt: 1, borderColor: amber, color: amber }} onClick={() => refreshQR(selectedSession.id)}>
                          <Refresh fontSize="small" sx={{ mr: 0.5 }} /> Refresh Now
                        </Button>
                      </>
                    )}

                    {selectedSession.mode === 'CODE' && codeData && (
                      <>
                        <Typography variant="h2" fontWeight={800} letterSpacing={8} sx={{ my: 2, color: amber }}>{codeData.code}</Typography>
                        <LinearProgress variant="determinate" value={(countdown / 120) * 100}
                          sx={{ mb: 1, borderRadius: 4, height: 8, bgcolor: 'rgba(245,158,11,0.15)', '& .MuiLinearProgress-bar': { bgcolor: amber } }} />
                        <Typography variant="caption" color="text.secondary">Refreshes in {countdown}s</Typography>
                        <br />
                        <Button variant="outlined" size="small" sx={{ mt: 1, borderColor: amber, color: amber }} onClick={() => refreshCode(selectedSession.id)}>
                          <Refresh fontSize="small" sx={{ mr: 0.5 }} /> Refresh Now
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6" fontWeight={700}>
                        Present ({attendanceList.filter(a => a.status === 'PRESENT').length})
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button size="small" href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/reports/session/${selectedSession.id}/pdf`}
                          target="_blank" startIcon={<Download />} sx={{ color: '#ef4444', borderColor: '#ef4444' }} variant="outlined">PDF</Button>
                        <Button size="small" href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/reports/session/${selectedSession.id}/excel`}
                          target="_blank" startIcon={<Download />} sx={{ color: emerald, borderColor: emerald }} variant="outlined">Excel</Button>
                      </Box>
                    </Box>
                    <List dense sx={{ maxHeight: 320, overflow: 'auto' }}>
                      {attendanceList.map((a, i) => (
                        <React.Fragment key={a.attendanceId || i}>
                          <ListItem>
                            <Avatar sx={{ width: 32, height: 32, mr: 1.5, fontSize: 12, bgcolor: amber, color: '#0f1923' }}>
                              {(a.name || a.student?.name)?.[0]}
                            </Avatar>
                            <ListItemText primary={a.name || a.student?.name} secondary={a.rollNumber || a.student?.rollNumber}
                              primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }} secondaryTypographyProps={{ fontSize: 11 }} />
                            <Chip label={a.status || 'PRESENT'} size="small" sx={{ bgcolor: '#d1fae5', color: '#065f46', fontWeight: 700 }} />
                          </ListItem>
                          <Divider />
                        </React.Fragment>
                      ))}
                      {!attendanceList.length && (
                        <ListItem><ListItemText primary="No attendance yet" sx={{ textAlign: 'center', color: 'text.secondary' }} /></ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <Card sx={{ height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
                <QrCode sx={{ fontSize: 64, mb: 2, color: amber, opacity: 0.4 }} />
                <Typography variant="h6" fontWeight={600}>Select a session to manage</Typography>
                <Typography variant="body2">Or create a new session to get started</Typography>
              </Box>
            </Card>
          )}
        </Grid>
      </Grid>

      {/* Create Session Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={800} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>🎓 Start Attendance Session</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal" sx={selectSx}>
            <InputLabel>Class</InputLabel>
            <Select value={form.classId} label="Class" onChange={e => setForm({ ...form, classId: e.target.value })}>
              {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} – {c.section} (Sem {c.semester})</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal" sx={selectSx}>
            <InputLabel>Subject</InputLabel>
            <Select value={form.subjectId} label="Subject" onChange={e => setForm({ ...form, subjectId: e.target.value })}>
              {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name} ({s.code})</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal" sx={selectSx}>
            <InputLabel>Attendance Mode</InputLabel>
            <Select value={form.mode} label="Attendance Mode" onChange={e => setForm({ ...form, mode: e.target.value })}>
              <MenuItem value="QR">📷 QR Code Scan</MenuItem>
              <MenuItem value="CODE">🔢 6-Digit Code</MenuItem>
            </Select>
          </FormControl>

          {form.mode === 'QR' && (
            <Box sx={{ mt: 2, px: 1 }}>
              <Typography fontWeight={600} gutterBottom>
                ⏱ QR Refresh: <Chip label={`${qrRefreshSec}s`} size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }} />
              </Typography>
              <Slider value={qrRefreshSec} onChange={(_, v) => setQrRefreshSec(v)} min={30} max={600} step={30}
                marks={[{ value: 30, label: '30s' }, { value: 120, label: '2m' }, { value: 300, label: '5m' }, { value: 600, label: '10m' }]}
                valueLabelDisplay="auto" valueLabelFormat={v => v >= 60 ? `${Math.floor(v/60)}m${v%60 ? ` ${v%60}s` : ''}` : `${v}s`}
                sx={{ color: amber, '& .MuiSlider-thumb': { bgcolor: amber }, '& .MuiSlider-track': { bgcolor: amber } }} />
            </Box>
          )}

          <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: locationEnabled ? amber : 'divider', borderRadius: 2, transition: 'border-color 0.2s' }}>
            <FormControlLabel
              control={<Switch checked={locationEnabled} onChange={e => setLocationEnabled(e.target.checked)} sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: amber }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { bgcolor: amber } }} />}
              label={<Typography fontWeight={700}>📍 Location Verification</Typography>}
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ ml: 4.5 }}>Students must be physically present within the set radius</Typography>
            {locationEnabled && (
              <Box sx={{ mt: 2 }}>
                <Button variant="outlined" size="small" fullWidth onClick={captureLocation} disabled={gpsLoading}
                  startIcon={gpsLoading ? <CircularProgress size={16} /> : <MyLocation />}
                  sx={{ mb: 1.5, borderColor: amber, color: amber }}>
                  {gpsLoading ? 'Getting location…' : facultyLat ? `📍 Set (${facultyLat.toFixed(4)}, ${facultyLng.toFixed(4)})` : 'Capture Classroom Location'}
                </Button>
                <Typography fontWeight={600} gutterBottom>Radius: <Chip label={`${locationRadius}m`} size="small" sx={{ bgcolor: '#d1fae5', color: '#065f46', fontWeight: 700 }} /></Typography>
                <Slider value={locationRadius} onChange={(_, v) => setLocationRadius(v)} min={30} max={500} step={10}
                  marks={[{ value: 50, label: '50m' }, { value: 100, label: '100m' }, { value: 200, label: '200m' }, { value: 500, label: '500m' }]}
                  valueLabelDisplay="auto" valueLabelFormat={v => `${v}m`}
                  sx={{ color: emerald }} />
                {!facultyLat && <Alert severity="warning" sx={{ mt: 1, borderRadius: 2 }}>Capture your location first.</Alert>}
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, borderTop: '1px solid', borderColor: 'divider' }}>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={createSession} disabled={loading || (locationEnabled && !facultyLat)}
            sx={{ bgcolor: amber, color: '#0f1923', fontWeight: 700, '&:hover': { bgcolor: '#d97706' } }}>
            {loading ? <CircularProgress size={20} sx={{ color: '#0f1923' }} /> : '🚀 Start Session'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
