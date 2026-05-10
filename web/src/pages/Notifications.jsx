import React, { useState, useEffect } from 'react';
import {
  Box, Typography, List, ListItem, ListItemText, ListItemIcon,
  IconButton, Button, Chip, CircularProgress, Divider, Card,
} from '@mui/material';
import {
  Notifications as NotifIcon, Campaign, Assignment, Assessment,
  AccountBalance, People, CheckCircle, Delete, DoneAll,
  Dashboard, School, CalendarMonth, Chat,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

const NAV = [
  { label: 'Dashboard',       icon: <Dashboard />,   path: '/faculty' },
  { label: 'Notifications',   icon: <NotifIcon />,   path: '/notifications' },
  { label: 'Notes',           icon: <School />,      path: '/notes' },
  { label: 'Assignments',     icon: <Assignment />,  path: '/assignments' },
  { label: 'Announcements',   icon: <Campaign />,    path: '/announcements' },
  { label: 'Timetable',       icon: <CalendarMonth />, path: '/timetable' },
];
const NAV_STUDENT = NAV.map(n => n.path === '/faculty' ? { ...n, path: '/student' } : n);

const TYPE_ICON = {
  ANNOUNCEMENT: <Campaign color="primary" />,
  ASSIGNMENT:   <Assignment color="warning" />,
  RESULT:       <Assessment color="success" />,
  FEE:          <AccountBalance color="error" />,
  ATTENDANCE:   <People color="secondary" />,
  CHAT:         <Chat color="info" />,
  EXAM:         <Assessment color="error" />,
  GENERAL:      <NotifIcon color="action" />,
};

const TYPE_COLOR = {
  ANNOUNCEMENT: 'primary', ASSIGNMENT: 'warning', RESULT: 'success',
  FEE: 'error', ATTENDANCE: 'secondary', CHAT: 'info', EXAM: 'error', GENERAL: 'default',
};

export default function Notifications({ isDark, onToggleDark }) {
  const { user } = useAuth();
  const isFaculty = user?.role === 'FACULTY' || user?.role === 'ADMIN';
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [filter, setFilter]               = useState('ALL');

  useEffect(() => { loadNotifications(); }, []);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
    } catch { toast.error('Failed to load notifications'); }
    finally { setLoading(false); }
  };

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.post('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success('All marked as read');
    } catch { toast.error('Failed'); }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;
  const types = ['ALL', ...new Set(notifications.map(n => n.type))];
  const filtered = filter === 'ALL' ? notifications : notifications.filter(n => n.type === filter);

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Notifications" navItems={isFaculty ? NAV : NAV_STUDENT}>
      <Box sx={{ maxWidth: 800, mx: 'auto' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h5" fontWeight={700}>Notifications</Typography>
            {unreadCount > 0 && <Chip label={`${unreadCount} unread`} size="small" color="error" />}
          </Box>
          {unreadCount > 0 && (
            <Button startIcon={<DoneAll />} onClick={markAllRead} size="small" variant="outlined">
              Mark all read
            </Button>
          )}
        </Box>

        {/* Type filters */}
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
          {types.map(t => (
            <Chip key={t} label={t} size="small" onClick={() => setFilter(t)}
              color={filter === t ? 'primary' : 'default'} variant={filter === t ? 'filled' : 'outlined'} clickable />
          ))}
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}><CircularProgress /></Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <NotifIcon sx={{ fontSize: 64, color: 'grey.400', mb: 2 }} />
            <Typography color="text.secondary">No notifications</Typography>
          </Box>
        ) : (
          <Card>
            <List disablePadding>
              {filtered.map((n, i) => (
                <React.Fragment key={n.id}>
                  <ListItem
                    alignItems="flex-start"
                    onClick={() => !n.isRead && markRead(n.id)}
                    sx={{
                      cursor: !n.isRead ? 'pointer' : 'default',
                      bgcolor: !n.isRead ? (isDark ? 'rgba(21,101,192,0.08)' : 'rgba(21,101,192,0.04)') : 'transparent',
                      borderLeft: !n.isRead ? '3px solid #f59e0b' : '3px solid transparent',
                      transition: 'background 0.2s',
                      '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' },
                    }}
                    secondaryAction={
                      !n.isRead && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); markRead(n.id); }}>
                          <CheckCircle fontSize="small" color="primary" />
                        </IconButton>
                      )
                    }
                  >
                    <ListItemIcon sx={{ mt: 1, minWidth: 40 }}>
                      {TYPE_ICON[n.type] || TYPE_ICON.GENERAL}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2" fontWeight={n.isRead ? 500 : 700}>{n.title}</Typography>
                          <Chip label={n.type} size="small" color={TYPE_COLOR[n.type]} sx={{ height: 18, fontSize: 10 }} />
                          {!n.isRead && <Chip label="NEW" size="small" color="error" sx={{ height: 18, fontSize: 9 }} />}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.3 }}>{n.message}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {i < filtered.length - 1 && <Divider component="li" />}
                </React.Fragment>
              ))}
            </List>
          </Card>
        )}
      </Box>
    </Layout>
  );
}
