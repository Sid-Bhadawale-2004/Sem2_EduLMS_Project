require('dotenv').config();
require('express-async-errors');

const express     = require('express');
const http        = require('http');
const cors        = require('cors');
const helmet      = require('helmet');
const compression = require('compression');
const morgan      = require('morgan');
const rateLimit   = require('express-rate-limit');

// Connect MongoDB — must run before any model import
require('./utils/db');

const { initSocket } = require('./utils/socket');

const errorHandler   = require('./middleware/errorHandler');

// ── Route imports ─────────────────────────────────────────────────────────────
const authRoutes          = require('./routes/auth');
const adminRoutes         = require('./routes/admin');
const usersRoutes         = require('./routes/users');
const commonRoutes        = require('./routes/common');
const sessionsRoutes      = require('./routes/sessions');
const attendanceRoutes    = require('./routes/attendance');
const reportsRoutes       = require('./routes/reports');
const notesRoutes         = require('./routes/notes');
const assignmentsRoutes   = require('./routes/assignments');
const timetableRoutes     = require('./routes/timetable');
const announcementsRoutes = require('./routes/announcements');
const liveClassesRoutes   = require('./routes/liveClasses');
const syllabusRoutes      = require('./routes/syllabus');
const notificationsRoutes = require('./routes/notifications');
const profileRoutes       = require('./routes/profile');

// ── App setup ─────────────────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// Initialize socket.io
initSocket(server);

// Security
app.use(helmet({ crossOriginEmbedderPolicy: false, contentSecurityPolicy: false }));

// CORS
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',').map(s => s.trim());
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limits
const globalLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true, legacyHeaders: false });
const authLimit   = rateLimit({ windowMs: 15 * 60 * 1000, max: 30, skipSuccessfulRequests: true,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' }
});

app.use(globalLimit);
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => res.json({
  status: 'ok', db: 'mongodb-atlas', timestamp: new Date().toISOString(),
}));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',          authLimit, authRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/users',         usersRoutes);
app.use('/api/common',        commonRoutes);
app.use('/api/sessions',      sessionsRoutes);
app.use('/api/attendance',    attendanceRoutes);
app.use('/api/reports',       reportsRoutes);
app.use('/api/notes',         notesRoutes);
app.use('/api/assignments',   assignmentsRoutes);
app.use('/api/timetable',     timetableRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/live-classes',  liveClassesRoutes);
app.use('/api/syllabus',      syllabusRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/profile',       profileRoutes);

// ── Static file uploads ──────────────────────────────────────────────────────
const { UPLOAD_ROOT } = require('./utils/upload');
app.use('/uploads', express.static(UPLOAD_ROOT));

// 404
app.use((req, res) => res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` }));

// Error handler
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '5000', 10);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 EduLMS backend running on port ${PORT}`);
  console.log(`   Mode: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   DB  : MongoDB Atlas`);
});

process.on('SIGTERM', () => server.close(() => { console.log('Process terminated'); process.exit(0); }));

module.exports = { app, server };
