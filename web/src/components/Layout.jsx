import React, { useState, useEffect } from 'react';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Avatar,
  Tooltip, useMediaQuery, useTheme, Badge, Menu, MenuItem,
  List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon, Logout, School, Notifications,
  DarkMode, LightMode, ChevronLeft, Person, BarChart as BarChartIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

const DRAWER_WIDTH = 256;
const STORAGE_KEY  = 'lms-drawer-open';

// Role accent colors — amber-based palette
const ROLE_COLORS = {
  ADMIN:   { fg: '#ef4444', bg: '#fee2e2' },
  FACULTY: { fg: '#f59e0b', bg: '#fef3c7' },
  STUDENT: { fg: '#6366f1', bg: '#e0e7ff' },
};

export default function Layout({ children, title, navItems = [], onToggleDark, isDark }) {
  const { user, logout } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const theme     = useTheme();
  const isMobile  = useMediaQuery(theme.breakpoints.down('md'));

  const [open,   setOpen]   = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved !== null ? saved === 'true' : !isMobile;
  });
  const [anchor, setAnchor] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch unread notification count on mount and every 30s
  useEffect(() => {
    const fetchUnread = () => {
      api.get('/notifications').then(r => {
        const unread = (r.data || []).filter(n => !n.isRead).length;
        setUnreadCount(unread);
      }).catch(() => {});
    };
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const toggleDrawer = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  const handleLogout = async () => {
    setAnchor(null);
    await logout();
    toast.success('Logged out');
    navigate('/login');
  };

  const goProfile = () => { setAnchor(null); navigate('/profile'); };

  const role     = user?.role || 'STUDENT';
  const roleC    = ROLE_COLORS[role] || ROLE_COLORS.STUDENT;
  
  // Extract name and calculate initials
  // Format: Surname StudentName FathersName
  const fullName = user?.student?.name || user?.faculty?.name || user?.email?.split('@')[0] || 'User';
  const nameParts = fullName.trim().split(/\s+/);
  
  // Initials: StudentName[0] + Surname[0]
  let initials = '';
  if (nameParts.length >= 2) {
    initials = (nameParts[1][0] + nameParts[0][0]).toUpperCase();
  } else if (nameParts.length === 1) {
    initials = nameParts[0][0].toUpperCase();
  } else {
    initials = 'U';
  }

  // Colors
  const sb = isDark ? '#0e1829' : '#ffffff';   // sidebar bg
  const bd = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'; // border
  const bg = isDark ? '#0b1120' : '#f4f6fb';   // page bg
  const tc = isDark ? '#e8edf5' : '#0f1923';   // text color
  const mc = isDark ? '#5a6a7e' : '#94a3b8';   // muted color
  const amber = '#f59e0b';

  // Add My Attendance & Profile if missing
  const hasProfile = navItems.some(n => n.path === '/profile');
  const hasAtt = navItems.some(n => n.path === '/attendance-history');
  const extra = [];
  if (!hasAtt && role !== 'PARENT') {
    extra.push({ label: role === 'STUDENT' ? 'My Attendance' : 'Attendance', icon: <BarChartIcon />, path: '/attendance-history' });
  }
  if (!hasProfile) extra.push({ label: 'My Profile', icon: <Person />, path: '/profile' });
  const allNav = [...navItems, ...extra];

  const showDrawer = open && (!isMobile || open);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: bg }}>

      {/* ── Sidebar ── */}
      <Box sx={{
        width: DRAWER_WIDTH, height: '100vh',
        display: 'flex', flexDirection: 'column',
        bgcolor: sb,
        borderRight: '1px solid', borderColor: bd,
        position: 'fixed', top: 0,
        left: showDrawer ? 0 : -DRAWER_WIDTH,
        transition: 'left 0.25s cubic-bezier(0.4,0,0.2,1)',
        zIndex: 1200, overflowY: 'auto', overflowX: 'hidden',
      }}>

        {/* Logo */}
        <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 1.5, borderBottom: '1px solid', borderColor: bd, flexShrink: 0 }}>
          <Box sx={{
            width: 38, height: 38, borderRadius: 2,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245,158,11,0.4)', flexShrink: 0,
          }}>
            <School sx={{ color: '#0f1923', fontSize: 21 }} />
          </Box>
          <Box>
            <Typography sx={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 16, color: tc, lineHeight: 1.1, letterSpacing: -0.3 }}>
              EduLMS
            </Typography>
            <Typography sx={{ fontSize: 9, color: mc, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5 }}>
              Learning System
            </Typography>
          </Box>
          {isMobile && (
            <IconButton size="small" sx={{ ml: 'auto', color: mc }} onClick={toggleDrawer}>
              <ChevronLeft fontSize="small" />
            </IconButton>
          )}
        </Box>

        {/* User card */}
        <Box
          onClick={goProfile}
          sx={{
            mx: 1.5, mt: 2, p: 1.5, borderRadius: 2.5,
            bgcolor: isDark ? 'rgba(245,158,11,0.07)' : 'rgba(245,158,11,0.05)',
            border: '1px solid', borderColor: isDark ? 'rgba(245,158,11,0.18)' : 'rgba(245,158,11,0.15)',
            cursor: 'pointer', transition: 'background 0.15s',
            '&:hover': { bgcolor: isDark ? 'rgba(245,158,11,0.13)' : 'rgba(245,158,11,0.1)' },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar sx={{ width: 36, height: 36, bgcolor: roleC.fg, color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>
              {initials}
            </Avatar>
          <Box sx={{ overflow: 'hidden', flex: 1 }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700, color: tc, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {fullName}
              </Typography>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', px: 1, py: 0.25, borderRadius: 10, bgcolor: roleC.bg, mt: 0.3 }}>
                <Typography sx={{ fontSize: 9, fontWeight: 800, color: roleC.fg, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {role}
                </Typography>
              </Box>
            </Box>
            <Person sx={{ fontSize: 16, color: mc, flexShrink: 0 }} />
          </Box>
        </Box>

        {/* Nav */}
        <Box sx={{ flex: 1, px: 1.5, py: 2 }}>
          {allNav.length > 0 && (
            <>
              <Typography sx={{ px: 1, mb: 1, fontSize: 9, fontWeight: 700, color: mc, textTransform: 'uppercase', letterSpacing: 1.5 }}>
                Menu
              </Typography>
              <List dense disablePadding>
                {allNav.map((item, i) => {
                  const active = location.pathname === item.path ||
                    (item.path !== '/' && !['/', '/faculty', '/student', '/admin', '/parent'].includes(item.path) && location.pathname.startsWith(item.path));
                  return (
                    <ListItem key={i} disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        onClick={() => { navigate(item.path); if (isMobile) { setOpen(false); localStorage.setItem(STORAGE_KEY, 'false'); } }}
                        sx={{
                          borderRadius: 2, py: 1.1, px: 1.5, position: 'relative',
                          bgcolor: active ? (isDark ? 'rgba(245,158,11,0.15)' : 'rgba(245,158,11,0.1)') : 'transparent',
                          '&:hover': { bgcolor: active ? (isDark ? 'rgba(245,158,11,0.22)' : 'rgba(245,158,11,0.15)') : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') },
                        }}
                      >
                        {active && <Box sx={{ position: 'absolute', left: 0, top: '20%', height: '60%', width: 3, borderRadius: '0 3px 3px 0', bgcolor: amber }} />}
                        <ListItemIcon sx={{ minWidth: 34, color: active ? amber : mc, '& svg': { fontSize: 19 } }}>
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText
                          primary={item.label}
                          primaryTypographyProps={{
                            fontSize: 13, fontWeight: active ? 700 : 500,
                            color: active ? amber : (isDark ? '#cbd5e1' : '#334155'),
                            fontFamily: "'DM Sans',sans-serif",
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </>
          )}
        </Box>

        {/* Bottom actions */}
        <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: bd, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <ListItemButton onClick={goProfile} sx={{ borderRadius: 2, py: 1, '&:hover': { bgcolor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.07)' } }}>
            <ListItemIcon sx={{ minWidth: 34, color: amber }}><Person fontSize="small" /></ListItemIcon>
            <ListItemText primary="My Profile" primaryTypographyProps={{ fontSize: 13, fontWeight: 600, color: amber, fontFamily: "'DM Sans',sans-serif" }} />
          </ListItemButton>
          <ListItemButton onClick={handleLogout} sx={{ borderRadius: 2, py: 1, '&:hover': { bgcolor: 'rgba(239,68,68,0.08)' } }}>
            <ListItemIcon sx={{ minWidth: 34, color: '#ef4444' }}><Logout fontSize="small" /></ListItemIcon>
            <ListItemText primary="Logout" primaryTypographyProps={{ fontSize: 13, fontWeight: 600, color: '#ef4444', fontFamily: "'DM Sans',sans-serif" }} />
          </ListItemButton>
        </Box>
      </Box>

      {/* Mobile overlay */}
      {isMobile && open && <Box onClick={toggleDrawer} sx={{ position: 'fixed', inset: 0, bgcolor: 'rgba(0,0,0,0.5)', zIndex: 1199 }} />}

      {/* ── Main content ── */}
      <Box sx={{ flex: 1, ml: !isMobile && open ? `${DRAWER_WIDTH}px` : 0, transition: 'margin 0.25s cubic-bezier(0.4,0,0.2,1)', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* Topbar */}
        <AppBar position="sticky" elevation={0} sx={{ bgcolor: sb, borderBottom: '1px solid', borderColor: bd }}>
          <Toolbar sx={{ gap: 1, minHeight: '56px !important', px: { xs: 1.5, md: 2.5 } }}>
            <IconButton onClick={toggleDrawer} size="small" sx={{ color: mc }}>
              <MenuIcon fontSize="small" />
            </IconButton>
            <Typography sx={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: 16, flex: 1, color: tc, letterSpacing: -0.2 }}>
              {title}
            </Typography>
            <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
              <IconButton onClick={onToggleDark} size="small" sx={{ color: isDark ? amber : '#64748b', bgcolor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 2, p: 0.9 }}>
                {isDark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
              </IconButton>
            </Tooltip>
            <IconButton size="small" sx={{ color: mc }} onClick={() => { navigate('/notifications'); setUnreadCount(0); }}>
              <Badge badgeContent={unreadCount} color="error" max={99}><Notifications fontSize="small" /></Badge>
            </IconButton>
            <Tooltip title="Account">
              <Avatar
                onClick={e => setAnchor(e.currentTarget)}
                sx={{ width: 32, height: 32, bgcolor: roleC.fg, color: '#fff', fontSize: 13, fontWeight: 800, cursor: 'pointer', ml: 0.5, boxShadow: `0 0 0 2px ${isDark ? '#0b1120' : '#fff'}, 0 0 0 3.5px ${roleC.fg}66` }}
              >
                {initials}
              </Avatar>
            </Tooltip>
          </Toolbar>
        </AppBar>

        {/* Page */}
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 }, maxWidth: 1440, width: '100%', mx: 'auto' }}>
          {children}
        </Box>
      </Box>

      {/* Avatar dropdown */}
      <Menu
        anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{ sx: { borderRadius: 2.5, mt: 1, minWidth: 210, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14 }}>{fullName}</Typography>
          <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.8 }}>{user?.email}</Typography>
          <Box sx={{ display: 'inline-flex', px: 1, py: 0.25, borderRadius: 10, bgcolor: roleC.bg }}>
            <Typography sx={{ fontSize: 10, fontWeight: 800, color: roleC.fg, textTransform: 'uppercase', letterSpacing: 0.8 }}>{role}</Typography>
          </Box>
        </Box>
        <Divider />
        <MenuItem onClick={goProfile} sx={{ fontSize: 13, fontWeight: 600, gap: 1.5, py: 1.2 }}>
          <Person fontSize="small" sx={{ color: amber }} /> View Profile
        </MenuItem>
        <MenuItem onClick={() => { setAnchor(null); navigate('/attendance-history'); }} sx={{ fontSize: 13, fontWeight: 600, gap: 1.5, py: 1.2 }}>
          <BarChartIcon fontSize="small" sx={{ color: '#10b981' }} /> Attendance
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout} sx={{ fontSize: 13, fontWeight: 600, color: '#ef4444', gap: 1.5, py: 1.2 }}>
          <Logout fontSize="small" /> Logout
        </MenuItem>
      </Menu>
    </Box>
  );
}
