const mongoose = require('mongoose');
const { Schema } = mongoose;

// ─── User ────────────────────────────────────────────────────────────────────
const userSchema = new Schema({
  email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['ADMIN', 'FACULTY', 'STUDENT'], required: true },
  isActive:     { type: Boolean, default: true },
}, { timestamps: true });
const User = mongoose.model('User', userSchema);

// ─── RefreshToken ────────────────────────────────────────────────────────────
const refreshTokenSchema = new Schema({
  userId:    { type: Schema.Types.ObjectId, ref: 'User', required: true },
  token:     { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });
const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);

// ─── Department ──────────────────────────────────────────────────────────────
const departmentSchema = new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
}, { timestamps: true });
const Department = mongoose.model('Department', departmentSchema);

// ─── Class ───────────────────────────────────────────────────────────────────
const classSchema = new Schema({
  name:         { type: String, required: true, trim: true },
  section:      { type: String, required: true, trim: true },
  semester:     { type: Number, required: true },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
}, { timestamps: true });
classSchema.index({ departmentId: 1 });
const Class = mongoose.model('Class', classSchema);

// ─── Subject ─────────────────────────────────────────────────────────────────
const subjectSchema = new Schema({
  name:         { type: String, required: true, trim: true },
  code:         { type: String, required: true, unique: true, uppercase: true, trim: true },
  credits:      { type: Number, default: 3 },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
}, { timestamps: true });
subjectSchema.index({ departmentId: 1 });
const Subject = mongoose.model('Subject', subjectSchema);

// ─── Student ─────────────────────────────────────────────────────────────────
const studentSchema = new Schema({
  userId:     { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  rollNumber: { type: String, required: true, unique: true, trim: true },
  name:       { type: String, required: true, trim: true },
  phone:      { type: String, default: '' },
  classId:    { type: Schema.Types.ObjectId, ref: 'Class', required: true },
}, { timestamps: true });
studentSchema.index({ classId: 1 });
const Student = mongoose.model('Student', studentSchema);

// ─── Faculty ─────────────────────────────────────────────────────────────────
const facultySchema = new Schema({
  userId:       { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employeeId:   { type: String, required: true, unique: true, trim: true },
  name:         { type: String, required: true, trim: true },
  phone:        { type: String, default: '' },
  departmentId: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
}, { timestamps: true });
facultySchema.index({ departmentId: 1 });
const Faculty = mongoose.model('Faculty', facultySchema);

// ─── Session ─────────────────────────────────────────────────────────────────
const sessionSchema = new Schema({
  classId:         { type: Schema.Types.ObjectId, ref: 'Class',   required: true },
  subjectId:       { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  facultyId:       { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  mode:            { type: String, enum: ['QR', 'CODE'], required: true },
  date:            { type: Date, default: Date.now },
  startTime:       { type: Date, default: Date.now },
  endTime:         { type: Date, default: null },
  isActive:        { type: Boolean, default: true },
  qrRefreshSec:    { type: Number, default: 600 },   // 10 min default
  locationEnabled: { type: Boolean, default: false },
  locationLat:     { type: Number, default: null },
  locationLng:     { type: Number, default: null },
  locationRadius:  { type: Number, default: 100 },
}, { timestamps: true });
sessionSchema.index({ classId: 1 });
sessionSchema.index({ facultyId: 1 });
sessionSchema.index({ isActive: 1 });
const Session = mongoose.model('Session', sessionSchema);

// ─── QrCode ──────────────────────────────────────────────────────────────────
const qrCodeSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  token:     { type: String, required: true },          // short random token shown in QR
  expiresAt: { type: Date, required: true },            // 10 minutes from creation
}, { timestamps: true });
qrCodeSchema.index({ sessionId: 1 });
qrCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-clean
const QrCode = mongoose.model('QrCode', qrCodeSchema);

// ─── CodeSession ─────────────────────────────────────────────────────────────
const codeSessionSchema = new Schema({
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  code:      { type: String, required: true },          // 6-digit code
  isActive:  { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },            // 10 minutes from creation
}, { timestamps: true });
codeSessionSchema.index({ sessionId: 1 });
codeSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL auto-clean
const CodeSession = mongoose.model('CodeSession', codeSessionSchema);

// ─── Attendance ──────────────────────────────────────────────────────────────
const attendanceSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
  status:    { type: String, enum: ['PRESENT', 'ABSENT', 'LATE'], default: 'PRESENT' },
  markedAt:  { type: Date, default: Date.now },
  markedBy:  { type: String, enum: ['SELF', 'FACULTY'], default: 'SELF' },
  ipAddress: { type: String, default: '' },
}, { timestamps: true });
attendanceSchema.index({ studentId: 1, sessionId: 1 }, { unique: true });
attendanceSchema.index({ sessionId: 1 });
const Attendance = mongoose.model('Attendance', attendanceSchema);

// ─── Note ────────────────────────────────────────────────────────────────────
const noteSchema = new Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  fileUrl:     { type: String, default: '' },
  fileType:    { type: String, default: 'link' },
  topic:       { type: String, default: '' },
  subjectId:   { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  facultyId:   { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
}, { timestamps: true });
noteSchema.index({ subjectId: 1 });
noteSchema.index({ facultyId: 1 });
const Note = mongoose.model('Note', noteSchema);

// ─── Assignment ──────────────────────────────────────────────────────────────
const assignmentSchema = new Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  fileUrl:     { type: String, default: '' },
  dueDate:     { type: Date, required: true },
  maxMarks:    { type: Number, default: 100 },
  subjectId:   { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  facultyId:   { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
}, { timestamps: true });
assignmentSchema.index({ subjectId: 1 });
const Assignment = mongoose.model('Assignment', assignmentSchema);

// ─── Submission ──────────────────────────────────────────────────────────────
const submissionSchema = new Schema({
  assignmentId: { type: Schema.Types.ObjectId, ref: 'Assignment', required: true },
  studentId:    { type: Schema.Types.ObjectId, ref: 'Student',    required: true },
  fileUrl:      { type: String, default: '' },
  textContent:  { type: String, default: '' },
  status:       { type: String, enum: ['SUBMITTED', 'GRADED', 'LATE'], default: 'SUBMITTED' },
  marks:        { type: Number, default: null },
  feedback:     { type: String, default: '' },
  submittedAt:  { type: Date, default: Date.now },
  gradedAt:     { type: Date, default: null },
}, { timestamps: true });
submissionSchema.index({ assignmentId: 1, studentId: 1 }, { unique: true });
const Submission = mongoose.model('Submission', submissionSchema);

// ─── Timetable ───────────────────────────────────────────────────────────────
const timetableSchema = new Schema({
  classId:   { type: Schema.Types.ObjectId, ref: 'Class',   required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  dayOfWeek: { type: Number, required: true, min: 1, max: 7 }, // 1=Mon…7=Sun
  startTime: { type: String, required: true },  // "09:00"
  endTime:   { type: String, required: true },  // "10:00"
  room:      { type: String, default: '' },
}, { timestamps: true });
timetableSchema.index({ classId: 1 });
timetableSchema.index({ facultyId: 1 });
const Timetable = mongoose.model('Timetable', timetableSchema);

// ─── Announcement ────────────────────────────────────────────────────────────
const announcementSchema = new Schema({
  title:     { type: String, required: true, trim: true },
  content:   { type: String, required: true },
  facultyId: { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  classId:   { type: Schema.Types.ObjectId, ref: 'Class', default: null },
  isGlobal:  { type: Boolean, default: false },
  fileUrl:   { type: String, default: '' },
}, { timestamps: true });
announcementSchema.index({ classId: 1 });
const Announcement = mongoose.model('Announcement', announcementSchema);

// ─── Notification ────────────────────────────────────────────────────────────
const notificationSchema = new Schema({
  userId:  { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title:   { type: String, required: true },
  body:    { type: String, required: true },
  type:    { type: String, enum: ['ANNOUNCEMENT', 'ASSIGNMENT', 'GENERAL', 'ATTENDANCE'], default: 'GENERAL' },
  isRead:  { type: Boolean, default: false },
  data:    { type: Schema.Types.Mixed, default: {} },
}, { timestamps: true });
notificationSchema.index({ userId: 1, isRead: 1 });
const Notification = mongoose.model('Notification', notificationSchema);

// ─── LiveClass ───────────────────────────────────────────────────────────────
const liveClassSchema = new Schema({
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  meetLink:    { type: String, required: true },
  platform:    { type: String, default: 'Google Meet' },
  subjectId:   { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  facultyId:   { type: Schema.Types.ObjectId, ref: 'Faculty', required: true },
  scheduledAt: { type: Date, required: true },
  duration:    { type: Number, default: 60 },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });
liveClassSchema.index({ subjectId: 1 });
const LiveClass = mongoose.model('LiveClass', liveClassSchema);

// ─── Syllabus ────────────────────────────────────────────────────────────────
const syllabusSchema = new Schema({
  subjectId:   { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  classId:     { type: Schema.Types.ObjectId, ref: 'Class',   required: true },
  unit:        { type: Number, required: true },
  title:       { type: String, required: true, trim: true },
  topics:      [{ type: String }],
  isCompleted: { type: Boolean, default: false },
  completedAt: { type: Date, default: null },
}, { timestamps: true });
syllabusSchema.index({ subjectId: 1, classId: 1 });
const Syllabus = mongoose.model('Syllabus', syllabusSchema);

module.exports = {
  User, RefreshToken, Department, Class, Subject, Student, Faculty,
  Session, QrCode, CodeSession, Attendance, Note, Assignment, Submission,
  Timetable, Announcement, Notification, LiveClass, Syllabus,
};

