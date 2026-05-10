import React, { useState, useEffect } from 'react';
import {
  Grid, Card, CardContent, Typography, Box, Button, Chip,
  TextField, CircularProgress, Avatar, Divider, Alert,
  IconButton, InputAdornment, LinearProgress,
} from '@mui/material';
import {
  Dashboard, School, Assignment, Assessment, CalendarMonth, Campaign,
  Edit, Save, Cancel, Visibility, VisibilityOff, Person,
  Email, Phone, Badge, Business, School as ClassIcon, Lock,
  CheckCircle, BarChart as BarChartIcon,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const NAV_ADMIN = [
  { label: 'Dashboard', icon: <Dashboard />, path: '/admin' },
  { label: 'Profile',   icon: <Person />,    path: '/profile' },
];
const NAV_FACULTY = [
  { label: 'Dashboard',     icon: <Dashboard />,     path: '/faculty' },
  { label: 'Profile',       icon: <Person />,        path: '/profile' },
  { label: 'Notes',         icon: <School />,        path: '/notes' },
  { label: 'Assignments',   icon: <Assignment />,    path: '/assignments' },
  { label: 'Attendance',    icon: <BarChartIcon />,  path: '/attendance-history' },
  { label: 'Timetable',     icon: <CalendarMonth />, path: '/timetable' },
  { label: 'Announcements', icon: <Campaign />,      path: '/announcements' },
];
const NAV_STUDENT = [
  { label: 'Dashboard',     icon: <Dashboard />,     path: '/student' },
  { label: 'Profile',       icon: <Person />,        path: '/profile' },
  { label: 'Attendance',    icon: <BarChartIcon />,  path: '/attendance-history' },
  { label: 'Notes',         icon: <School />,        path: '/notes' },
  { label: 'Assignments',   icon: <Assignment />,    path: '/assignments' },
  { label: 'Timetable',     icon: <CalendarMonth />, path: '/timetable' },
];

const ROLE_COLOR  = { ADMIN: '#dc2626', FACULTY: '#f59e0b', STUDENT: '#f59e0b', PARENT: '#d97706' };
const ROLE_LABEL  = { ADMIN: 'Administrator', FACULTY: 'Faculty', STUDENT: 'Student', PARENT: 'Parent' };

export default function Profile({ isDark, onToggleDark }) {
  const { user: authUser } = useAuth();
  const [profile,   setProfile]   = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [savingInfo,setSavingInfo] = useState(false);
  const [savingPwd, setSavingPwd] = useState(false);
  const [showPwd,   setShowPwd]   = useState({ old: false, new: false, confirm: false });
  const [infoForm,  setInfoForm]  = useState({ name: '', phone: '', email: '' });
  const [pwdForm,   setPwdForm]   = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [attendanceSummary, setAttendanceSummary] = useState(null);

  const nav = authUser?.role === 'ADMIN' ? NAV_ADMIN
            : authUser?.role === 'FACULTY' ? NAV_FACULTY
            : NAV_STUDENT;

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/auth/me');
      setProfile(data);
      const profileData = data.student || data.faculty || {};
      setInfoForm({
        name:  profileData.name  || '',
        phone: profileData.phone || '',
        email: data.email        || '',
      });
      // Load attendance summary for students
      if (data.role === 'STUDENT') {
        const att = await api.get('/attendance/my').catch(() => ({ data: null }));
        setAttendanceSummary(att.data);
      }
    } catch { toast.error('Failed to load profile'); }
    finally { setLoading(false); }
  };

  const saveInfo = async () => {
    setSavingInfo(true);
    try {
      // Update name/phone via debug endpoint (or a profile endpoint)
      await api.patch('/auth/profile', { name: infoForm.name, phone: infoForm.phone });
      toast.success('Profile updated!');
      setEditing(false);
      loadProfile();
    } catch (err) {
      // If no profile endpoint, show helpful message
      if (err.response?.status === 404) {
        toast.error('Profile update endpoint not available. Ask admin.');
      } else {
        toast.error(err.response?.data?.error || 'Update failed');
      }
    } finally { setSavingInfo(false); }
  };

  const changePassword = async () => {
    if (!pwdForm.oldPassword || !pwdForm.newPassword) return toast.error('Fill all password fields');
    if (pwdForm.newPassword !== pwdForm.confirmPassword) return toast.error('Passwords do not match');
    if (pwdForm.newPassword.length < 6) return toast.error('Password must be at least 6 characters');
    setSavingPwd(true);
    try {
      await api.post('/auth/change-password', { oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword });
      toast.success('Password changed successfully!');
      setPwdForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Password change failed');
    } finally { setSavingPwd(false); }
  };

  if (loading) return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Profile" navItems={nav}>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
    </Layout>
  );

  const profileData = profile?.student || profile?.faculty || {};
  const role = profile?.role || '';
  const overallPct = attendanceSummary?.summary?.length
    ? Math.round(attendanceSummary.summary.reduce((s, x) => s + x.percentage, 0) / attendanceSummary.summary.length)
    : null;

  // Initials: StudentName[0] + Surname[0]
  // Format: Surname StudentName FathersName
  const fullName = profileData.name || profile?.email || 'User';
  const nameParts = fullName.trim().split(/\s+/);
  let initials = '';
  if (nameParts.length >= 2) {
    initials = (nameParts[1][0] + nameParts[0][0]).toUpperCase();
  } else if (nameParts.length === 1) {
    initials = nameParts[0][0].toUpperCase();
  } else {
    initials = 'U';
  }

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="My Profile" navItems={nav}>
      <Grid container spacing={3}>

        {/* ── Left: Avatar + Info card ── */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 4 }}>
              {/* Avatar */}
              <Avatar sx={{
                width: 100, height: 100, fontSize: 36, fontWeight: 800, mx: 'auto', mb: 2,
                bgcolor: ROLE_COLOR[role] || '#f59e0b',
                boxShadow: `0 0 0 4px ${isDark ? '#0f172a' : '#fff'}, 0 0 0 6px ${ROLE_COLOR[role] || '#f59e0b'}33`,
              }}>
                {initials}
              </Avatar>

              <Typography variant="h5" fontWeight={800}>{profileData.name || '—'}</Typography>
              <Chip
                label={ROLE_LABEL[role] || role}
                size="small"
                sx={{ mt: 0.5, bgcolor: ROLE_COLOR[role], color: '#fff', fontWeight: 700 }}
              />

              <Divider sx={{ my: 2 }} />

              {/* Info rows */}
              <Box sx={{ textAlign: 'left', px: 1 }}>
                {[
                  { icon: <Email fontSize="small" />, label: 'Email',      value: profile?.email },
                  { icon: <Phone fontSize="small" />, label: 'Phone',      value: profileData.phone || '—' },
                  role === 'STUDENT' && { icon: <Badge fontSize="small" />,    label: 'Roll No',    value: profileData.rollNumber },
                  role === 'STUDENT' && { icon: <ClassIcon fontSize="small" />,    label: 'Class',      value: `${profileData.class?.name || ''} ${profileData.class?.section || ''}` },
                  role === 'STUDENT' && { icon: <Business fontSize="small" />, label: 'Department', value: profileData.class?.department?.name },
                  role === 'FACULTY' && { icon: <Business fontSize="small" />, label: 'Department', value: profileData.department?.name },
                  role === 'FACULTY' && { icon: <Badge fontSize="small" />,    label: 'Employee ID',value: profileData.employeeId || '—' },
                ].filter(Boolean).map((row, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
                    <Box sx={{ color: 'text.secondary' }}>{row.icon}</Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" lineHeight={1}>{row.label}</Typography>
                      <Typography variant="body2" fontWeight={600}>{row.value || '—'}</Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              {/* Student attendance badge */}
              {role === 'STUDENT' && overallPct !== null && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography variant="caption" color="text.secondary">Overall Attendance</Typography>
                    <Typography variant="h3" fontWeight={900}
                      color={overallPct >= 75 ? 'success.main' : 'error.main'}>
                      {overallPct}%
                    </Typography>
                    <LinearProgress
                      variant="determinate" value={overallPct}
                      color={overallPct >= 75 ? 'success' : 'error'}
                      sx={{ mt: 1, height: 8, borderRadius: 4 }}
                    />
                    {overallPct < 75 && (
                      <Chip label="⚠️ Below 75%" size="small" color="error" sx={{ mt: 1 }} />
                    )}
                  </Box>
                </>
              )}
            </CardContent>
          </Card>

          {/* Student attendance per subject */}
          {role === 'STUDENT' && attendanceSummary?.summary?.length > 0 && (
            <Card sx={{ mt: 2 }}>
              <CardContent>
                <Typography fontWeight={700} sx={{ mb: 2 }}>Attendance by Subject</Typography>
                {attendanceSummary.summary.map(s => (
                  <Box key={s.subjectCode} sx={{ mb: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption" fontWeight={600} noWrap sx={{ maxWidth: '70%' }}>{s.subjectName}</Typography>
                      <Typography variant="caption" fontWeight={700}
                        color={s.percentage >= 75 ? 'success.main' : 'error.main'}>
                        {s.percentage}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate" value={s.percentage}
                      color={s.percentage >= 75 ? 'success' : 'error'}
                      sx={{ height: 6, borderRadius: 3 }}
                    />
                  </Box>
                ))}
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* ── Right: Edit + Password ── */}
        <Grid item xs={12} md={8}>

          {/* Edit Profile Card */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>Profile Information</Typography>
                {!editing ? (
                  <Button startIcon={<Edit />} onClick={() => setEditing(true)} variant="outlined" size="small">
                    Edit
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button startIcon={<Cancel />} onClick={() => setEditing(false)} size="small">Cancel</Button>
                    <Button startIcon={<Save />} variant="contained" onClick={saveInfo} disabled={savingInfo} size="small">
                      {savingInfo ? <CircularProgress size={16} /> : 'Save'}
                    </Button>
                  </Box>
                )}
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Full Name" value={infoForm.name}
                    onChange={e => setInfoForm({ ...infoForm, name: e.target.value })}
                    disabled={!editing} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Email" value={infoForm.email} disabled
                    helperText="Email cannot be changed" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Phone" value={infoForm.phone}
                    onChange={e => setInfoForm({ ...infoForm, phone: e.target.value })}
                    disabled={!editing} />
                </Grid>
                {role === 'STUDENT' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Roll Number" value={profileData.rollNumber || ''} disabled />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Class" value={`${profileData.class?.name || ''} ${profileData.class?.section || ''}`} disabled />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Semester" value={profileData.class?.semester ? `Semester ${profileData.class.semester}` : ''} disabled />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Department" value={profileData.class?.department?.name || ''} disabled />
                    </Grid>
                  </>
                )}
                {role === 'FACULTY' && (
                  <>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Employee ID" value={profileData.employeeId || ''} disabled />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Department" value={profileData.department?.name || ''} disabled />
                    </Grid>
                  </>
                )}
                {role === 'ADMIN' && (
                  <Grid item xs={12}>
                    <Alert severity="info">Administrators manage the entire system. Your account is protected.</Alert>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Lock color="warning" />
                <Typography variant="h6" fontWeight={700}>Change Password</Typography>
              </Box>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth label="Current Password" type={showPwd.old ? 'text' : 'password'}
                    value={pwdForm.oldPassword}
                    onChange={e => setPwdForm({ ...pwdForm, oldPassword: e.target.value })}
                    InputProps={{ endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPwd(p => ({ ...p, old: !p.old }))}>
                          {showPwd.old ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )}} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="New Password" type={showPwd.new ? 'text' : 'password'}
                    value={pwdForm.newPassword}
                    onChange={e => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                    helperText="Minimum 6 characters"
                    InputProps={{ endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPwd(p => ({ ...p, new: !p.new }))}>
                          {showPwd.new ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )}} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Confirm New Password" type={showPwd.confirm ? 'text' : 'password'}
                    value={pwdForm.confirmPassword}
                    onChange={e => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                    error={pwdForm.confirmPassword && pwdForm.newPassword !== pwdForm.confirmPassword}
                    helperText={pwdForm.confirmPassword && pwdForm.newPassword !== pwdForm.confirmPassword ? 'Passwords do not match' : ''}
                    InputProps={{ endAdornment: (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setShowPwd(p => ({ ...p, confirm: !p.confirm }))}>
                          {showPwd.confirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </InputAdornment>
                    )}} />
                </Grid>
                <Grid item xs={12}>
                  <Button variant="contained" color="warning" onClick={changePassword}
                    disabled={savingPwd || !pwdForm.oldPassword || !pwdForm.newPassword || pwdForm.newPassword !== pwdForm.confirmPassword}
                    startIcon={savingPwd ? <CircularProgress size={16} color="inherit" /> : <Lock />}>
                    {savingPwd ? 'Changing…' : 'Change Password'}
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Layout>
  );
}
