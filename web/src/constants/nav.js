import { createElement as h } from 'react';
import {
  Dashboard, School, Assignment, CalendarMonth, Campaign,
  VideoCall, MenuBook,
  Notifications as NotifIcon,
  Chat as ChatIcon,
  BarChart as BarChartIcon,
  AccountCircle,
  CheckCircle,
} from '@mui/icons-material';

const ic = (Icon) => h(Icon);

export const FACULTY_NAV = [
  { label: 'Dashboard',      icon: ic(Dashboard),       path: '/faculty' },
  { label: 'Attendance',     icon: ic(BarChartIcon),    path: '/faculty-attendance' },
  { label: 'Timetable',      icon: ic(CalendarMonth),   path: '/timetable' },
  { label: 'Notes',          icon: ic(School),          path: '/notes' },
  { label: 'Assignments',    icon: ic(Assignment),      path: '/assignments' },
  { label: 'Syllabus',       icon: ic(MenuBook),        path: '/syllabus' },
  { label: 'Live Classes',   icon: ic(VideoCall),       path: '/live-classes' },
  { label: 'Announcements',  icon: ic(Campaign),        path: '/announcements' },
  { label: 'Notifications',  icon: ic(NotifIcon),       path: '/notifications' },
  { label: 'My Profile',     icon: ic(AccountCircle),   path: '/profile' },
];

export const STUDENT_NAV = [
  { label: 'Dashboard',     icon: ic(CheckCircle),   path: '/student' },
  { label: 'My Attendance', icon: ic(BarChartIcon),  path: '/attendance-history' },
  { label: 'Notes',         icon: ic(School),        path: '/notes' },
  { label: 'Assignments',   icon: ic(Assignment),    path: '/assignments' },
  { label: 'Syllabus',      icon: ic(MenuBook),      path: '/syllabus' },
  { label: 'Timetable',     icon: ic(CalendarMonth), path: '/timetable' },
  { label: 'Live Classes',  icon: ic(VideoCall),     path: '/live-classes' },
  { label: 'Announcements', icon: ic(Campaign),      path: '/announcements' },
  { label: 'Notifications', icon: ic(NotifIcon),     path: '/notifications' },
  { label: 'My Profile',    icon: ic(AccountCircle), path: '/profile' },
];

export const ADMIN_NAV = [
  { label: 'Admin Panel',       icon: ic(Dashboard),     path: '/admin' },
  { label: 'Attendance Report', icon: ic(BarChartIcon),  path: '/attendance-history' },
  { label: 'Notes',             icon: ic(School),        path: '/notes' },
  { label: 'Assignments',       icon: ic(Assignment),    path: '/assignments' },
  { label: 'Syllabus',          icon: ic(MenuBook),      path: '/syllabus' },
  { label: 'Timetable',         icon: ic(CalendarMonth), path: '/timetable' },
  { label: 'Live Classes',      icon: ic(VideoCall),     path: '/live-classes' },
  { label: 'Announcements',     icon: ic(Campaign),      path: '/announcements' },
  { label: 'Notifications',     icon: ic(NotifIcon),     path: '/notifications' },
  { label: 'My Profile',        icon: ic(AccountCircle), path: '/profile' },
];