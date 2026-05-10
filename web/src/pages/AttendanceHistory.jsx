import React, { useState, useEffect } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Chip, LinearProgress,
  FormControl, InputLabel, Select, MenuItem, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow, TableContainer,
  Paper, Alert, Tabs, Tab, Avatar,
} from '@mui/material';
import {
  Dashboard, School, Assignment, Assessment, CalendarMonth, Campaign,
  CheckCircle, Cancel, HourglassEmpty, TrendingUp, TrendingDown, People,
  BarChart as BarChartIcon, Quiz, EventNote, AccountBalance,
  VideoCall, MenuBook, Notifications as NotifIcon, Chat as ChatIcon,
} from '@mui/icons-material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from 'recharts';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, subDays, parseISO } from 'date-fns';

const NAV_FACULTY = [
  { label: 'Dashboard',     icon: <Dashboard />,     path: '/faculty' },
  { label: 'Attendance',    icon: <BarChartIcon />,  path: '/attendance-history' },
  { label: 'Notes',         icon: <School />,        path: '/notes' },
  { label: 'Assignments',   icon: <Assignment />,    path: '/assignments' },
  { label: 'Timetable',     icon: <CalendarMonth />, path: '/timetable' },
  { label: 'Announcements', icon: <Campaign />,      path: '/announcements' },
];
const NAV_STUDENT = [
  { label: 'Dashboard',     icon: <Dashboard />,     path: '/student' },
  { label: 'Attendance',    icon: <BarChartIcon />,  path: '/attendance-history' },
  { label: 'Notes',         icon: <School />,        path: '/notes' },
  { label: 'Assignments',   icon: <Assignment />,    path: '/assignments' },
  { label: 'Timetable',     icon: <CalendarMonth />, path: '/timetable' },
  { label: 'Announcements', icon: <Campaign />,      path: '/announcements' },
];
const NAV_ADMIN = [
  { label: 'Dashboard',     icon: <Dashboard />,     path: '/admin' },
  { label: 'Attendance',    icon: <BarChartIcon />,  path: '/attendance-history' },
  { label: 'Timetable',     icon: <CalendarMonth />, path: '/timetable' },
  { label: 'Announcements', icon: <Campaign />,      path: '/announcements' },
];

const PIE_COLORS = ['#059669', '#dc2626', '#d97706'];
const STATUS_COLOR = { PRESENT: 'success', ABSENT: 'error', LATE: 'warning' };
const STATUS_ICON  = { PRESENT: <CheckCircle fontSize="small" />, ABSENT: <Cancel fontSize="small" />, LATE: <HourglassEmpty fontSize="small" /> };

export default function AttendanceHistory({ isDark, onToggleDark }) {
  const { user } = useAuth();
  const isFaculty = user?.role === 'FACULTY' || user?.role === 'ADMIN';
  const isAdmin   = user?.role === 'ADMIN';

  const [tab,          setTab]          = useState(0);
  const [loading,      setLoading]      = useState(true);
  const [myAttendance, setMyAttendance] = useState(null);
  const [classes,      setClasses]      = useState([]);
  const [subjects,     setSubjects]     = useState([]);
  const [students,     setStudents]     = useState([]);
  const [filterClass,  setFilterClass]  = useState('');
  const [filterSubject,setFilterSubject]= useState('');
  const [defaulters,   setDefaulters]   = useState([]);
  const [threshold,    setThreshold]    = useState(75);
  const [sessionList,  setSessionList]  = useState([]);

  const nav = isAdmin ? NAV_ADMIN : isFaculty ? NAV_FACULTY : NAV_STUDENT;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (isFaculty && filterClass && filterSubject) loadDefaulters();
  }, [filterClass, filterSubject, threshold]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (!isFaculty) {
        const { data } = await api.get('/attendance/my');
        setMyAttendance(data);
      } else {
        const [cRes, sRes] = await Promise.all([
          api.get('/common/classes'),
          api.get('/common/subjects'),
        ]);
        setClasses(cRes.data);
        setSubjects(sRes.data);
      }
    } catch { toast.error('Failed to load attendance data'); }
    finally { setLoading(false); }
  };

  const loadDefaulters = async () => {
    if (!filterClass || !filterSubject) return;
    try {
      const { data } = await api.get(`/reports/defaulters?classId=${filterClass}&subjectId=${filterSubject}&threshold=${threshold}`);
      setDefaulters(data);
    } catch { toast.error('Failed to load defaulters'); }
  };

  const loadClassAttendance = async (classId) => {
    try {
      const { data } = await api.get(`/attendance/session/all?classId=${classId}`).catch(() => ({ data: [] }));
      setStudents(data);
    } catch {}
  };

  // ── Build chart data from student attendance ──
  const buildSubjectChartData = () => {
    if (!myAttendance?.summary) return [];
    return myAttendance.summary.map(s => ({
      name: s.subjectName.length > 12 ? s.subjectName.slice(0, 12) + '…' : s.subjectName,
      fullName: s.subjectName,
      percentage: s.percentage,
      present: s.present,
      total: s.total,
    }));
  };

  const buildTrendData = () => {
    if (!myAttendance?.attendances) return [];
    const last30 = myAttendance.attendances.filter(a => {
      return new Date(a.markedAt) >= subDays(new Date(), 30);
    });
    const dayMap = {};
    last30.forEach(a => {
      const day = format(new Date(a.markedAt), 'dd MMM');
      if (!dayMap[day]) dayMap[day] = { date: day, present: 0, total: 0 };
      dayMap[day].total++;
      if (a.status === 'PRESENT' || a.status === 'LATE') dayMap[day].present++;
    });
    return Object.values(dayMap).map(d => ({ ...d, pct: Math.round((d.present / d.total) * 100) }));
  };

  const buildPieData = () => {
    if (!myAttendance?.attendances) return [];
    const present = myAttendance.attendances.filter(a => a.status === 'PRESENT').length;
    const absent  = myAttendance.attendances.filter(a => a.status === 'ABSENT').length;
    const late    = myAttendance.attendances.filter(a => a.status === 'LATE').length;
    return [
      { name: 'Present', value: present },
      { name: 'Absent',  value: absent  },
      { name: 'Late',    value: late    },
    ].filter(d => d.value > 0);
  };

  const overallPct = myAttendance?.summary?.length
    ? Math.round(myAttendance.summary.reduce((s, x) => s + x.percentage, 0) / myAttendance.summary.length)
    : 0;

  const subjectChart = buildSubjectChartData();
  const trendChart   = buildTrendData();
  const pieData      = buildPieData();

  if (loading) return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Attendance" navItems={nav}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
    </Layout>
  );

  // ════════════════════════════════════════
  // STUDENT VIEW
  // ════════════════════════════════════════
  if (!isFaculty) return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="My Attendance" navItems={NAV_STUDENT}>

      {/* Overall stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h3" fontWeight={900}
                color={overallPct >= 75 ? 'success.main' : 'error.main'}>
                {overallPct}%
              </Typography>
              <Typography variant="caption" color="text.secondary">Overall Attendance</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h3" fontWeight={900} color="success.main">
                {myAttendance?.attendances?.filter(a => a.status === 'PRESENT').length || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">Present</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h3" fontWeight={900} color="error.main">
                {myAttendance?.attendances?.filter(a => a.status === 'ABSENT').length || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">Absent</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 2 }}>
              <Typography variant="h3" fontWeight={900} color="warning.main">
                {myAttendance?.summary?.filter(s => s.percentage < 75).length || 0}
              </Typography>
              <Typography variant="caption" color="text.secondary">Low Subjects</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Low attendance warning */}
      {myAttendance?.summary?.some(s => s.percentage < 75) && (
        <Alert severity="error" sx={{ mb: 3 }} icon={<TrendingDown />}>
          <Typography fontWeight={700}>⚠️ Low Attendance Warning</Typography>
          {myAttendance.summary.filter(s => s.percentage < 75).map(s => {
            const needed = Math.ceil((0.75 * s.total - s.present) / 0.25);
            return (
              <Typography key={s.subjectCode} variant="body2">
                {s.subjectName}: {s.percentage}% — need {needed} more class{needed !== 1 ? 'es' : ''} to reach 75%
              </Typography>
            );
          })}
        </Alert>
      )}

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="📊 Charts" />
        <Tab label="📚 By Subject" />
        <Tab label="📋 History" />
      </Tabs>

      {/* ── Charts Tab ── */}
      {tab === 0 && (
        <Grid container spacing={3}>
          {/* Bar chart */}
          <Grid item xs={12} md={8}>
            <Card>
              <CardContent>
                <Typography fontWeight={700} sx={{ mb: 2 }}>Subject-wise Attendance %</Typography>
                {subjectChart.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No data yet</Box>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={subjectChart} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <RTooltip
                        formatter={(val, _, props) => [`${val}% (${props.payload.present}/${props.payload.total})`, 'Attendance']}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''}
                        contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}
                      />
                      <Bar dataKey="percentage" radius={[6, 6, 0, 0]}>
                        {subjectChart.map((entry, i) => (
                          <Cell key={i} fill={entry.percentage >= 75 ? '#059669' : entry.percentage >= 60 ? '#d97706' : '#dc2626'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Pie chart */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography fontWeight={700} sx={{ mb: 2 }}>Overall Split</Typography>
                {pieData.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>No data</Box>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                      </Pie>
                      <RTooltip contentStyle={{ borderRadius: 8 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Trend line */}
          {trendChart.length > 1 && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography fontWeight={700} sx={{ mb: 2 }}>Attendance Trend — Last 30 Days</Typography>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={trendChart} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <RTooltip contentStyle={{ borderRadius: 8 }} />
                      <Line type="monotone" dataKey="pct" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} name="%" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* ── By Subject Tab ── */}
      {tab === 1 && (
        <Box>
          {myAttendance?.summary?.length === 0 ? (
            <Alert severity="info">No attendance data yet.</Alert>
          ) : (
            myAttendance?.summary?.map(s => (
              <Card key={s.subjectCode} sx={{ mb: 2 }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                    <Box>
                      <Typography fontWeight={700}>{s.subjectName}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.subjectCode}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="body2" color="text.secondary">{s.present}/{s.total} classes</Typography>
                      <Chip label={`${s.percentage}%`} size="small"
                        color={s.percentage >= 75 ? 'success' : s.percentage >= 60 ? 'warning' : 'error'} />
                    </Box>
                  </Box>
                  <LinearProgress variant="determinate" value={s.percentage}
                    color={s.percentage >= 75 ? 'success' : s.percentage >= 60 ? 'warning' : 'error'}
                    sx={{ height: 10, borderRadius: 5 }} />
                  {s.percentage < 75 && (
                    <Typography variant="caption" color="error.main" sx={{ mt: 0.5, display: 'block' }}>
                      ⚠️ Need {Math.ceil((0.75 * s.total - s.present) / 0.25)} more classes to reach 75%
                    </Typography>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </Box>
      )}

      {/* ── History Tab ── */}
      {tab === 2 && (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'primary.main' }}>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Date & Time</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Subject</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Marked By</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {myAttendance?.attendances?.map(a => (
                <TableRow key={a.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{format(new Date(a.markedAt), 'dd MMM yyyy')}</Typography>
                    <Typography variant="caption" color="text.secondary">{format(new Date(a.markedAt), 'hh:mm a')}</Typography>
                  </TableCell>
                  <TableCell>{a.session?.subject?.name}</TableCell>
                  <TableCell>
                    <Chip icon={STATUS_ICON[a.status]} label={a.status} size="small" color={STATUS_COLOR[a.status]} />
                  </TableCell>
                  <TableCell>
                    <Chip label={a.markedBy} size="small" variant="outlined" />
                  </TableCell>
                </TableRow>
              ))}
              {(!myAttendance?.attendances?.length) && (
                <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: 'text.secondary' }}>No records found</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Layout>
  );

  // ════════════════════════════════════════
  // FACULTY / ADMIN VIEW
  // ════════════════════════════════════════
  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Attendance Reports" navItems={nav}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label="📉 Defaulters" />
        <Tab label="📋 Session History" />
      </Tabs>

      {/* ── Defaulters Tab ── */}
      {tab === 0 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Class *</InputLabel>
              <Select value={filterClass} label="Class *" onChange={e => setFilterClass(e.target.value)}>
                <MenuItem value="">Select class…</MenuItem>
                {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} {c.section}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Subject *</InputLabel>
              <Select value={filterSubject} label="Subject *" onChange={e => setFilterSubject(e.target.value)}>
                <MenuItem value="">Select subject…</MenuItem>
                {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Threshold %</InputLabel>
              <Select value={threshold} label="Threshold %" onChange={e => setThreshold(e.target.value)}>
                {[60, 65, 70, 75, 80, 85].map(t => <MenuItem key={t} value={t}>{t}%</MenuItem>)}
              </Select>
            </FormControl>
          </Box>

          {!filterClass || !filterSubject ? (
            <Alert severity="info">Select a class and subject to see defaulters.</Alert>
          ) : defaulters.length === 0 ? (
            <Alert severity="success">🎉 No defaulters! All students are above {threshold}%.</Alert>
          ) : (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                {defaulters.length} student{defaulters.length > 1 ? 's are' : ' is'} below {threshold}% attendance.
              </Alert>
              <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ bgcolor: 'error.main' }}>
                      <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Student</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Roll No</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Present</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Total</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Attendance</TableCell>
                      <TableCell sx={{ color: '#fff', fontWeight: 700 }}>Shortfall</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {defaulters.map(d => (
                      <TableRow key={d.studentId} hover>
                        <TableCell fontWeight={600}>{d.studentName}</TableCell>
                        <TableCell>{d.rollNumber}</TableCell>
                        <TableCell>{d.present}</TableCell>
                        <TableCell>{d.total}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <LinearProgress variant="determinate" value={d.percentage}
                              color="error" sx={{ width: 60, height: 6, borderRadius: 3 }} />
                            <Chip label={`${d.percentage}%`} size="small" color="error" />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="caption" color="error.main" fontWeight={700}>
                            Need {Math.ceil((threshold / 100 * d.total - d.present) / (1 - threshold / 100))} more
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          )}
        </Box>
      )}

      {/* ── Session History Tab ── */}
      {tab === 1 && (
        <Box>
          <Alert severity="info" sx={{ mb: 2 }}>
            Go to <strong>Faculty Dashboard → Active Session → View Report</strong> to see per-session attendance details with PDF/Excel export.
          </Alert>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <BarChartIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
              <Typography fontWeight={700} color="text.secondary">Session Reports</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Detailed session attendance is available through the Faculty Dashboard's session view, with PDF and Excel export options.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      )}
    </Layout>
  );
}
