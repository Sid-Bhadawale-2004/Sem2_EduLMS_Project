import React, { useState, useMemo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login             from './pages/Login';
import AdminDashboard    from './pages/AdminDashboard';
import FacultyDashboard  from './pages/FacultyDashboard';
import StudentDashboard  from './pages/StudentDashboard';
import SessionView       from './pages/SessionView';
import Reports           from './pages/Reports';
import Notes             from './pages/Notes';
import Assignments       from './pages/Assignments';
import Timetable         from './pages/Timetable';
import Announcements     from './pages/Announcements';
import Syllabus          from './pages/Syllabus';
import LiveClasses       from './pages/LiveClasses';
import Notifications     from './pages/Notifications';
import AttendanceHistory from './pages/AttendanceHistory';
import FacultyAttendance from './pages/FacultyAttendance';
import Profile           from './pages/Profile';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function RoleRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  const map = { ADMIN: '/admin', FACULTY: '/faculty', STUDENT: '/student' };
  return <Navigate to={map[user.role] || '/login'} replace />;
}

function AppRoutes({ isDark, onToggleDark }) {
  const props = { isDark, onToggleDark };
  const wrap = (Component, roles) => (
    <ProtectedRoute roles={roles}><Component {...props} /></ProtectedRoute>
  );
  return (
    <Routes>
      <Route path="/login" element={<Login {...props} />} />
      <Route path="/"      element={<RoleRedirect />} />
      <Route path="/admin/*"   element={wrap(AdminDashboard,   ['ADMIN'])} />
      <Route path="/faculty/*" element={wrap(FacultyDashboard, ['FACULTY', 'ADMIN'])} />
      <Route path="/student/*" element={wrap(StudentDashboard, ['STUDENT'])} />
      <Route path="/notes"              element={wrap(Notes)} />
      <Route path="/assignments"        element={wrap(Assignments)} />
      <Route path="/timetable"          element={wrap(Timetable)} />
      <Route path="/announcements"      element={wrap(Announcements)} />
      <Route path="/syllabus"           element={wrap(Syllabus)} />
      <Route path="/live-classes"       element={wrap(LiveClasses)} />
      <Route path="/notifications"      element={wrap(Notifications)} />
      <Route path="/attendance-history" element={wrap(AttendanceHistory)} />
      <Route path="/faculty-attendance" element={wrap(FacultyAttendance, ['FACULTY', 'ADMIN'])} />
      <Route path="/profile"            element={wrap(Profile)} />
      <Route path="/session/:id"        element={wrap(SessionView)} />
      <Route path="/reports/:sessionId" element={wrap(Reports, ['FACULTY', 'ADMIN'])} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const toggleDark = () => {
    setIsDark(d => { localStorage.setItem('theme', !d ? 'dark' : 'light'); return !d; });
  };

  const theme = useMemo(() => createTheme({
    palette: {
      mode: isDark ? 'dark' : 'light',
      primary:   { main: '#f59e0b', contrastText: '#0f1923' },
      secondary: { main: '#10b981' },
      background: {
        default: isDark ? '#0b1120' : '#f4f6fb',
        paper:   isDark ? '#131e2e' : '#ffffff',
      },
      text: {
        primary:   isDark ? '#e8edf5' : '#0f1923',
        secondary: isDark ? '#7a8fa8' : '#5a6a7e',
      },
    },
    typography: { fontFamily: "'DM Sans', 'Inter', sans-serif" },
    shape: { borderRadius: 14 },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            boxShadow: isDark
              ? '0 1px 4px rgba(0,0,0,0.5)'
              : '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { textTransform: 'none', fontWeight: 700, borderRadius: 10, letterSpacing: 0.2 },
          containedPrimary: { color: '#0f1923' },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 700 } } },
    },
  }), [isDark]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #f59e0b44; border-radius: 99px; }
      `}</style>
      <AuthProvider>
        <AppRoutes isDark={isDark} onToggleDark={toggleDark} />
      </AuthProvider>
    </ThemeProvider>
  );
}
