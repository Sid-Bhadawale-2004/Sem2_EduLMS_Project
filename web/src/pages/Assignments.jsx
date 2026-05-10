import React, { useState, useEffect } from 'react';
import {
  Grid, Typography, Box, Button,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, List, ListItem, ListItemText, Avatar, Divider, Chip,
} from '@mui/material';
import {
  Add, AttachFile, Upload, Close, OpenInNew,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import AssignmentCard from '../components/AssignmentCard';
import { FACULTY_NAV, STUDENT_NAV, ADMIN_NAV } from '../constants/nav';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format, isPast } from 'date-fns';

const amber = '#f59e0b';
const STATUS_COLOR = { SUBMITTED: 'primary', GRADED: 'success', LATE: 'warning' };

export default function Assignments({ isDark, onToggleDark }) {
  const { user } = useAuth();
  const isFaculty = user?.role === 'FACULTY' || user?.role === 'ADMIN';
  
  const [assignments, setAssignments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSubmissionsDialog, setShowSubmissionsDialog] = useState(false);
  const [showGradeDialog, setShowGradeDialog] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [uploadMode, setUploadMode] = useState('link');
  const [subMode, setSubMode] = useState('link');
  const [file, setFile] = useState(null);
  const [subFile, setSubFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  const [form, setForm] = useState({
    title: '',
    description: '',
    subjectId: '',
    dueDate: '',
    maxMarks: 100,
    fileUrl: '',
  });
  
  const [subForm, setSubForm] = useState({
    textContent: '',
    fileUrl: '',
  });
  
  const [gradeForm, setGradeForm] = useState({
    marks: '',
    feedback: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [aRes, sRes] = await Promise.all([
        api.get('/assignments'),
        api.get('/common/subjects'),
      ]);
      setAssignments(aRes.data);
      setSubjects(sRes.data);
    } catch (err) {
      toast.error('Failed to load assignments');
    } finally {
      setLoading(false);
    }
  };

  const createAssignment = async () => {
    if (!form.title) return toast.error('Title is required');
    if (!form.subjectId) return toast.error('Subject is required');
    if (!form.dueDate) return toast.error('Due date is required');

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', form.title);
      fd.append('description', form.description || '');
      fd.append('subjectId', form.subjectId);
      fd.append('dueDate', form.dueDate);
      fd.append('maxMarks', form.maxMarks);

      if (uploadMode === 'file' && file) {
        fd.append('file', file);
      } else if (form.fileUrl) {
        fd.append('fileUrl', form.fileUrl);
      }

      await api.post('/assignments', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Assignment created!');
      setShowCreateDialog(false);
      setForm({
        title: '',
        description: '',
        subjectId: '',
        dueDate: '',
        maxMarks: 100,
        fileUrl: '',
      });
      setFile(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create');
    } finally {
      setSubmitting(false);
    }
  };

  const viewSubmissions = async (assignment) => {
    setSelectedAssignment(assignment);
    try {
      const { data } = await api.get(`/assignments/${assignment.id}/submissions`);
      setSubmissions(data);
      setShowSubmissionsDialog(true);
    } catch {
      toast.error('Failed to load submissions');
    }
  };

  const gradeSubmission = async () => {
    if (!gradeForm.marks) return toast.error('Enter marks');
    try {
      await api.post(`/assignments/grade/${selectedSubmission.id}`, gradeForm);
      toast.success('Graded!');
      setShowGradeDialog(false);
      viewSubmissions(selectedAssignment);
    } catch {
      toast.error('Grading failed');
    }
  };

  const submitAssignment = async () => {
    if (subMode === 'text' && !subForm.textContent)
      return toast.error('Enter your answer');
    if (subMode === 'link' && !subForm.fileUrl)
      return toast.error('Paste a file link');
    if (subMode === 'file' && !subFile)
      return toast.error('Select a file to upload');

    setSubmitting(true);
    try {
      const fd = new FormData();
      if (subForm.textContent) fd.append('textContent', subForm.textContent);
      if (subMode === 'file' && subFile) {
        fd.append('file', subFile);
      } else if (subMode === 'link' && subForm.fileUrl) {
        fd.append('fileUrl', subForm.fileUrl);
      }

      await api.post(`/assignments/${selectedAssignment.id}/submit`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      toast.success('Submitted successfully!');
      setShowSubmitDialog(false);
      setSubForm({ textContent: '', fileUrl: '' });
      setSubFile(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAssignment = async (id) => {
    try {
      await api.delete(`/assignments/${id}`);
      toast.success('Deleted successfully');
      setShowDeleteConfirm(null);
      loadData();
    } catch {
      toast.error('Delete failed');
    }
  };

  const openSubmitDialog = (a) => {
    setSelectedAssignment(a);
    const mySub = a.submissions?.[0];
    if (mySub) {
      setSubForm({
        textContent: mySub.textContent || '',
        fileUrl: mySub.fileUrl || '',
      });
      setSubMode(mySub.fileUrl ? 'link' : 'text');
    } else {
      setSubForm({ textContent: '', fileUrl: '' });
      setSubMode('link');
    }
    setShowSubmitDialog(true);
  };

  const getFileIcon = (url) => {
    if (!url) return '📎';
    const ext = url.split('.').pop()?.split('?')[0]?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['doc', 'docx'].includes(ext)) return '📘';
    if (['ppt', 'pptx'].includes(ext)) return '📙';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '🖼️';
    return '📎';
  };

  if (loading) {
    return (
      <Layout isDark={isDark} onToggleDark={onToggleDark} title="Assignments"
        navItems={user?.role === 'ADMIN' ? ADMIN_NAV : isFaculty ? FACULTY_NAV : STUDENT_NAV}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
          <CircularProgress sx={{ color: amber }} />
        </Box>
      </Layout>
    );
  }

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Assignments"
      navItems={user?.role === 'ADMIN' ? ADMIN_NAV : isFaculty ? FACULTY_NAV : STUDENT_NAV}>

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, mb: 0.5 }}>
              📝 Assignments
            </Typography>
            <Typography variant="body2" sx={{ color: '#6b7280' }}>
              {isFaculty ? `${assignments.length} assignments created` : 'Track your submission progress'}
            </Typography>
          </Box>
          {isFaculty && (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateDialog(true)}
              sx={{
                bgcolor: amber,
                color: '#0f1923',
                fontWeight: 700,
                textTransform: 'none',
                py: 1.2,
                px: 3,
                borderRadius: 2,
                '&:hover': { bgcolor: '#d97706' },
              }}
            >
              New Assignment
            </Button>
          )}
        </Box>
      </Box>

      <Grid container spacing={3}>
        {assignments.map(a => (
          <Grid item xs={12} sm={6} md={4} key={a.id}>
            <AssignmentCard
              assignment={a}
              isFaculty={isFaculty}
              onViewSubmissions={viewSubmissions}
              onDelete={() => setShowDeleteConfirm(a.id)}
              onSubmit={openSubmitDialog}
            />
          </Grid>
        ))}
        {assignments.length === 0 && (
          <Grid item xs={12}>
            <Box sx={{ textAlign: 'center', py: 12 }}>
              <Typography variant="h5" sx={{ color: '#9ca3af', mb: 1 }}>
                📋 No Assignments Yet
              </Typography>
              <Typography variant="body2" sx={{ color: '#d1d5db' }}>
                {isFaculty ? 'Create your first assignment to get started' : 'Check back later for new assignments'}
              </Typography>
            </Box>
          </Grid>
        )}
      </Grid>

      {/* Create Assignment Dialog */}
      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={800}>Create Assignment</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField fullWidth label="Title *" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })} margin="normal" />
          <TextField fullWidth label="Description" value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })} margin="normal" multiline rows={3} />
          <FormControl fullWidth margin="normal">
            <InputLabel>Subject *</InputLabel>
            <Select value={form.subjectId} label="Subject *" onChange={e => setForm({ ...form, subjectId: e.target.value })}>
              {subjects.map(s => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField fullWidth label="Due Date *" type="datetime-local" value={form.dueDate}
            onChange={e => setForm({ ...form, dueDate: e.target.value })} margin="normal"
            InputLabelProps={{ shrink: true }} />
          <TextField fullWidth label="Max Marks" type="number" value={form.maxMarks}
            onChange={e => setForm({ ...form, maxMarks: e.target.value })} margin="normal" />

          <Box sx={{ mt: 2, display: 'flex', gap: 1, mb: 1 }}>
            <Button size="small" variant={uploadMode === 'link' ? 'contained' : 'outlined'}
              startIcon={<Upload />} onClick={() => setUploadMode('link')}
              sx={uploadMode === 'link' ? { bgcolor: amber, color: '#0f1923' } : { borderColor: amber, color: amber }}>
              Paste Link
            </Button>
            <Button size="small" variant={uploadMode === 'file' ? 'contained' : 'outlined'}
              startIcon={<Upload />} onClick={() => setUploadMode('file')}
              sx={uploadMode === 'file' ? { bgcolor: amber, color: '#0f1923' } : { borderColor: amber, color: amber }}>
              Upload File
            </Button>
          </Box>
          {uploadMode === 'link' ? (
            <TextField fullWidth label="Attachment URL (optional)" placeholder="Google Drive, OneDrive..."
              value={form.fileUrl} onChange={e => setForm({ ...form, fileUrl: e.target.value })} />
          ) : (
            <Box>
              <input type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.zip" id="assign-file"
                style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
              <label htmlFor="assign-file">
                <Button variant="outlined" component="span" startIcon={<AttachFile />} fullWidth
                  sx={{ py: 1.5, borderColor: amber, color: amber, borderStyle: 'dashed' }}>
                  {file ? `✅ ${file.name}` : 'Choose File (PDF / DOC / PPT / ZIP)'}
                </Button>
              </label>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setShowCreateDialog(false); setFile(null); }}>Cancel</Button>
          <Button variant="contained" onClick={createAssignment} disabled={submitting}
            sx={{ bgcolor: amber, color: '#0f1923', '&:hover': { bgcolor: '#d97706' } }}>
            {submitting ? <CircularProgress size={20} sx={{ color: '#0f1923' }} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Submissions Dialog (Faculty) */}
      <Dialog open={showSubmissionsDialog} onClose={() => setShowSubmissionsDialog(false)} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={800}>Submissions — {selectedAssignment?.title}</DialogTitle>
        <DialogContent>
          {submissions.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No submissions yet</Typography>
          ) : (
            <List>
              {submissions.map((sub, i) => (
                <React.Fragment key={sub.id}>
                  <ListItem alignItems="flex-start"
                    secondaryAction={
                      sub.status !== 'GRADED' ? (
                        <Button size="small" variant="contained"
                          onClick={() => { setSelectedSubmission(sub); setShowGradeDialog(true); setGradeForm({ marks: '', feedback: '' }); }}
                          sx={{ bgcolor: amber, color: '#0f1923' }}>
                          Grade
                        </Button>
                      ) : (
                        <Chip label={`${sub.marks}/${selectedAssignment?.maxMarks}`} color="success" size="small" />
                      )
                    }
                    sx={{ pr: 14 }}>
                    <Avatar sx={{ mr: 2, mt: 0.5, bgcolor: amber, color: '#0f1923', width: 36, height: 36, fontSize: 13, flexShrink: 0 }}>
                      {(sub.student?.name || '?')[0]}
                    </Avatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                          <Typography fontWeight={700}>{sub.student?.name}</Typography>
                          <Chip label={sub.student?.rollNumber} size="small" />
                          <Chip label={sub.status} size="small" color={STATUS_COLOR[sub.status] || 'default'} />
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          {sub.textContent && (
                            <Typography variant="body2" sx={{ mb: 0.5, whiteSpace: 'pre-wrap' }}>{sub.textContent}</Typography>
                          )}
                          {sub.fileUrl && (
                            <Button size="small" href={sub.fileUrl} target="_blank"
                              startIcon={<OpenInNew />} variant="outlined"
                              sx={{ mb: 0.5, borderColor: amber, color: amber }}>
                              {getFileIcon(sub.fileUrl)} Open Submitted File
                            </Button>
                          )}
                          {sub.feedback && (
                            <Typography variant="caption" color="success.main" display="block">
                              Feedback: {sub.feedback}
                            </Typography>
                          )}
                          <Typography variant="caption" color="text.secondary" display="block">
                            Submitted: {format(new Date(sub.submittedAt), 'dd MMM yyyy, hh:mm a')}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                  {i < submissions.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setShowSubmissionsDialog(false)} sx={{ color: amber }}>Close</Button></DialogActions>
      </Dialog>

      {/* Grade Dialog */}
      <Dialog open={showGradeDialog} onClose={() => setShowGradeDialog(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={800}>Grade Submission</DialogTitle>
        <DialogContent>
          <TextField fullWidth label={`Marks (out of ${selectedAssignment?.maxMarks})`} type="number"
            value={gradeForm.marks} onChange={e => setGradeForm({ ...gradeForm, marks: e.target.value })} margin="normal" />
          <TextField fullWidth label="Feedback (optional)" value={gradeForm.feedback}
            onChange={e => setGradeForm({ ...gradeForm, feedback: e.target.value })} margin="normal" multiline rows={2} />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowGradeDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={gradeSubmission}
            sx={{ bgcolor: amber, color: '#0f1923' }}>Submit Grade</Button>
        </DialogActions>
      </Dialog>

      {/* Student Submit / Edit Dialog */}
      <Dialog open={showSubmitDialog} onClose={() => setShowSubmitDialog(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle fontWeight={800}>
          {selectedAssignment?.submissions?.[0] ? '✏️ Edit Submission' : '📤 Submit'} — {selectedAssignment?.title}
        </DialogTitle>
        <DialogContent>
          {selectedAssignment?.submissions?.[0] && (
            <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
              You have already submitted. You can update your submission below.
            </Alert>
          )}

          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            {['link', 'file', 'text'].map(m => (
              <Button key={m} size="small" variant={subMode === m ? 'contained' : 'outlined'}
                onClick={() => setSubMode(m)}
                sx={subMode === m ? { bgcolor: amber, color: '#0f1923' } : { borderColor: amber, color: amber }}>
                {m === 'link' ? '🔗 Paste Link' : m === 'file' ? '📁 Upload File' : '✍️ Text Answer'}
              </Button>
            ))}
          </Box>

          {subMode === 'text' && (
            <TextField fullWidth label="Your Answer *" value={subForm.textContent}
              onChange={e => setSubForm({ ...subForm, textContent: e.target.value })}
              multiline rows={6} placeholder="Type your answer here..." />
          )}
          {subMode === 'link' && (
            <TextField fullWidth label="Google Drive / File URL *"
              placeholder="https://drive.google.com/..."
              value={subForm.fileUrl} onChange={e => setSubForm({ ...subForm, fileUrl: e.target.value })} />
          )}
          {subMode === 'file' && (
            <Box>
              <input type="file" id="sub-file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.zip,.jpg,.png"
                style={{ display: 'none' }} onChange={e => setSubFile(e.target.files[0])} />
              <label htmlFor="sub-file">
                <Button variant="outlined" component="span" startIcon={<AttachFile />} fullWidth
                  sx={{ py: 1.5, borderColor: amber, color: amber, borderStyle: 'dashed' }}>
                  {subFile ? `✅ ${subFile.name}` : 'Choose File (PDF / DOC / PPT / ZIP / Image)'}
                </Button>
              </label>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setShowSubmitDialog(false); setSubFile(null); }}>Cancel</Button>
          <Button variant="contained" onClick={submitAssignment} disabled={submitting}
            sx={{ bgcolor: amber, color: '#0f1923', '&:hover': { bgcolor: '#d97706' } }}>
            {submitting ? <CircularProgress size={20} sx={{ color: '#0f1923' }} /> : selectedAssignment?.submissions?.[0] ? 'Update Submission' : 'Submit Assignment'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(showDeleteConfirm)} onClose={() => setShowDeleteConfirm(null)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>Delete Assignment?</DialogTitle>
        <DialogContent>
          <Typography>This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setShowDeleteConfirm(null)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={() => deleteAssignment(showDeleteConfirm)}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
}
