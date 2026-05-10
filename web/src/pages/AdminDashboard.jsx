import React, { useState, useEffect, useCallback } from "react";
import { Box, Grid, Card, CardContent, Typography, Button, Tabs, Tab, Table, TableBody, TableCell, TableHead, TableRow, TableContainer, Paper, Dialog, DialogTitle, DialogContent, DialogActions, TextField, FormControl, InputLabel, Select, MenuItem, IconButton, Chip, CircularProgress, Alert } from "@mui/material";
import {
  Add, Delete, Edit, People, School, Assessment, Upload, Download,
  Business, Person, Dashboard, Campaign, CalendarMonth,
  MenuBook, VideoCall,
  Notifications as NotifIcon, BarChart as BarChartIcon, AccountCircle,
} from "@mui/icons-material";
import Layout from "../components/Layout";
import api from "../services/api";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

const NAV = [
  { label: 'Admin Panel',       icon: <Dashboard />,       path: '/admin' },
  { label: 'Attendance Report', icon: <BarChartIcon />,    path: '/attendance-history' },
  { label: 'Notes',             icon: <School />,          path: '/notes' },
  { label: 'Assignments',       icon: <Assessment />,      path: '/assignments' },
  { label: 'Syllabus',          icon: <MenuBook />,        path: '/syllabus' },
  { label: 'Timetable',         icon: <CalendarMonth />,   path: '/timetable' },
  { label: 'Live Classes',      icon: <VideoCall />,       path: '/live-classes' },
  { label: 'Announcements',     icon: <Campaign />,        path: '/announcements' },
  { label: 'Notifications',     icon: <NotifIcon />,       path: '/notifications' },
  { label: 'My Profile',        icon: <AccountCircle />,   path: '/profile' },
];

function StatCard({ title, value, color, icon }) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Box>
            <Typography variant="body2" color="text.secondary">{title}</Typography>
            <Typography variant="h3" fontWeight={800} color={color + ".main"}>{value ?? <CircularProgress size={24} />}</Typography>
          </Box>
          <Box sx={{ p: 1.5, bgcolor: color + ".50", borderRadius: 2, color: color + ".main" }}>{icon}</Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function ConfirmDialog({ open, onClose, onConfirm }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle color="error">Confirm Delete</DialogTitle>
      <DialogContent><Typography>Are you sure? This cannot be undone.</Typography></DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="error" onClick={onConfirm}>Delete</Button>
      </DialogActions>
    </Dialog>
  );
}

function OverviewTab() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api.get("/admin/stats").then(r => setStats(r.data)).catch(() => {}); }, []);
  const steps = [
    { n: 1, label: "Add Departments", desc: "e.g. Computer Science & Engineering (CSE)" },
    { n: 2, label: "Add Classes", desc: "e.g. B.Tech Section A Semester 5" },
    { n: 3, label: "Add Subjects", desc: "e.g. Data Structures (CS501)" },
    { n: 4, label: "Add Faculty", desc: "Create faculty accounts linked to department" },
    { n: 5, label: "Add Students", desc: "Add individually or bulk import via Excel" },
  ];
  return (
    <Box>
      <Grid container spacing={3} mb={4}>
        <Grid item xs={6} md={2.4}><StatCard title="Users" value={stats?.users} color="primary" icon={<People />} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard title="Students" value={stats?.students} color="success" icon={<School />} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard title="Faculty" value={stats?.faculty} color="secondary" icon={<Person />} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard title="Sessions" value={stats?.sessions} color="warning" icon={<Assessment />} /></Grid>
        <Grid item xs={6} md={2.4}><StatCard title="Attendance" value={stats?.attendances} color="info" icon={<School />} /></Grid>
      </Grid>
      <Card><CardContent>
        <Typography variant="h6" fontWeight={700} mb={2}>Quick Setup Order (follow this sequence)</Typography>
        {steps.map(s => (
          <Box key={s.n} sx={{ display: "flex", gap: 2, alignItems: "center", p: 1.5, mb: 1, bgcolor: "grey.50", borderRadius: 2 }}>
            <Box sx={{ width: 32, height: 32, bgcolor: "primary.main", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontWeight: 700, flexShrink: 0 }}>{s.n}</Box>
            <Box><Typography variant="body2" fontWeight={700}>{s.label}</Typography><Typography variant="caption" color="text.secondary">{s.desc}</Typography></Box>
          </Box>
        ))}
      </CardContent></Card>
    </Box>
  );
}

function DepartmentsTab() {
  const [rows, setRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "" });
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const load = useCallback(() => api.get("/admin/departments").then(r => setRows(r.data)).catch(() => {}), []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    if (!form.name || !form.code) return toast.error("Name and Code required");
    setLoading(true);
    try { await api.post("/admin/departments", { name: form.name, code: form.code.toUpperCase() }); toast.success("Created!"); setOpen(false); setForm({ name: "", code: "" }); load(); }
    catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setLoading(false); }
  };
  const del = async (id) => {
    try { await api.delete("/admin/departments/" + id); toast.success("Deleted"); setConfirmId(null); load(); }
    catch { toast.error("Cannot delete - has linked data"); }
  };
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Departments ({ rows.length })</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Add Department</Button>
      </Box>
      <TableContainer component={Paper} variant="outlined"><Table>
        <TableHead><TableRow sx={{ bgcolor: "grey.50" }}><TableCell>#</TableCell><TableCell>Name</TableCell><TableCell>Code</TableCell><TableCell>Created</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
        <TableBody>
          {rows.map((d, i) => (<TableRow key={d.id} hover><TableCell>{i+1}</TableCell><TableCell><Typography fontWeight={600}>{d.name}</Typography></TableCell><TableCell><Chip label={d.code} size="small" color="primary" /></TableCell><TableCell>{new Date(d.createdAt).toLocaleDateString()}</TableCell><TableCell><IconButton size="small" color="error" onClick={() => setConfirmId(d.id)}><Delete fontSize="small" /></IconButton></TableCell></TableRow>))}
          {!rows.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>No departments yet - add one first!</TableCell></TableRow>}
        </TableBody>
      </Table></TableContainer>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Department</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Department Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} margin="normal" placeholder="e.g. Computer Science and Engineering" />
          <TextField fullWidth label="Code *" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} margin="normal" placeholder="e.g. CSE" />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save} disabled={loading}>{loading ? <CircularProgress size={20} /> : "Create"}</Button></DialogActions>
      </Dialog>
      <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={() => del(confirmId)} />
    </Box>
  );
}

function ClassesTab() {
  const [rows, setRows] = useState([]);
  const [depts, setDepts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", section: "", semester: 1, departmentId: "" });
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const load = useCallback(async () => { const [c, d] = await Promise.all([api.get("/admin/classes"), api.get("/admin/departments")]); setRows(c.data); setDepts(d.data); }, []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    if (!form.name || !form.section || !form.departmentId) return toast.error("All fields required");
    setLoading(true);
    try { await api.post("/admin/classes", { ...form, semester: parseInt(form.semester) }); toast.success("Class created!"); setOpen(false); setForm({ name: "", section: "", semester: 1, departmentId: "" }); load(); }
    catch (err) { toast.error(err.response?.data?.error || "Failed"); }
    finally { setLoading(false); }
  };
  const del = async (id) => {
    try { await api.delete("/admin/classes/" + id); toast.success("Deleted"); setConfirmId(null); load(); }
    catch { toast.error("Cannot delete - has linked students"); }
  };
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Classes ({ rows.length })</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Add Class</Button>
      </Box>
      <TableContainer component={Paper} variant="outlined"><Table>
        <TableHead><TableRow sx={{ bgcolor: "grey.50" }}><TableCell>#</TableCell><TableCell>Name</TableCell><TableCell>Section</TableCell><TableCell>Semester</TableCell><TableCell>Department</TableCell><TableCell>Students</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
        <TableBody>
          {rows.map((c, i) => (<TableRow key={c.id} hover><TableCell>{i+1}</TableCell><TableCell><Typography fontWeight={600}>{c.name}</Typography></TableCell><TableCell><Chip label={c.section} size="small" /></TableCell><TableCell>Sem {c.semester}</TableCell><TableCell>{c.department?.name}</TableCell><TableCell><Chip label={c._count?.students || 0} size="small" color="success" /></TableCell><TableCell><IconButton size="small" color="error" onClick={() => setConfirmId(c.id)}><Delete fontSize="small" /></IconButton></TableCell></TableRow>))}
          {!rows.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: "text.secondary" }}>No classes yet</TableCell></TableRow>}
        </TableBody>
      </Table></TableContainer>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Class</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Class Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} margin="normal" placeholder="e.g. B.Tech" />
          <TextField fullWidth label="Section *" value={form.section} onChange={e => setForm({ ...form, section: e.target.value })} margin="normal" placeholder="e.g. A" />
          <TextField fullWidth label="Semester" type="number" value={form.semester} onChange={e => setForm({ ...form, semester: e.target.value })} margin="normal" inputProps={{ min: 1, max: 10 }} />
          <FormControl fullWidth margin="normal"><InputLabel>Department *</InputLabel><Select value={form.departmentId} label="Department *" onChange={e => setForm({ ...form, departmentId: e.target.value })}>{depts.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({ d.code })</MenuItem>)}</Select></FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save} disabled={loading}>{loading ? <CircularProgress size={20} /> : "Create"}</Button></DialogActions>
      </Dialog>
      <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={() => del(confirmId)} />
    </Box>
  );
}

function SubjectsTab() {
  const [rows, setRows] = useState([]);
  const [depts, setDepts] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", credits: 3, departmentId: "" });
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const load = useCallback(async () => { const [s, d] = await Promise.all([api.get("/admin/subjects"), api.get("/admin/departments")]); setRows(s.data); setDepts(d.data); }, []);
  useEffect(() => { load(); }, [load]);
  const save = async () => {
    if (!form.name || !form.code || !form.departmentId) return toast.error("All fields required");
    setLoading(true);
    try { await api.post("/admin/subjects", { ...form, credits: parseInt(form.credits) }); toast.success("Subject created!"); setOpen(false); setForm({ name: "", code: "", credits: 3, departmentId: "" }); load(); }
    catch (err) { toast.error(err.response?.data?.error || "Code may already exist"); }
    finally { setLoading(false); }
  };
  const del = async (id) => {
    try { await api.delete("/admin/subjects/" + id); toast.success("Deleted"); setConfirmId(null); load(); }
    catch { toast.error("Cannot delete - has linked sessions"); }
  };
  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Subjects ({ rows.length })</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Add Subject</Button>
      </Box>
      <TableContainer component={Paper} variant="outlined"><Table>
        <TableHead><TableRow sx={{ bgcolor: "grey.50" }}><TableCell>#</TableCell><TableCell>Name</TableCell><TableCell>Code</TableCell><TableCell>Credits</TableCell><TableCell>Department</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
        <TableBody>
          {rows.map((s, i) => (<TableRow key={s.id} hover><TableCell>{i+1}</TableCell><TableCell><Typography fontWeight={600}>{s.name}</Typography></TableCell><TableCell><Chip label={s.code} size="small" color="secondary" /></TableCell><TableCell>{s.credits}</TableCell><TableCell>{s.department?.name}</TableCell><TableCell><IconButton size="small" color="error" onClick={() => setConfirmId(s.id)}><Delete fontSize="small" /></IconButton></TableCell></TableRow>))}
          {!rows.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: "text.secondary" }}>No subjects yet</TableCell></TableRow>}
        </TableBody>
      </Table></TableContainer>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Subject</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Subject Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} margin="normal" placeholder="e.g. Data Structures" />
          <TextField fullWidth label="Code *" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} margin="normal" placeholder="e.g. CS501" />
          <TextField fullWidth label="Credits" type="number" value={form.credits} onChange={e => setForm({ ...form, credits: e.target.value })} margin="normal" inputProps={{ min: 1, max: 6 }} />
          <FormControl fullWidth margin="normal"><InputLabel>Department *</InputLabel><Select value={form.departmentId} label="Department *" onChange={e => setForm({ ...form, departmentId: e.target.value })}>{depts.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({ d.code })</MenuItem>)}</Select></FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save} disabled={loading}>{loading ? <CircularProgress size={20} /> : "Create"}</Button></DialogActions>
      </Dialog>
      <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={() => del(confirmId)} />
    </Box>
  );
}

function StudentsTab() {
  const [allRows, setAllRows] = useState([]);
  const [rows,    setRows]    = useState([]);
  const [classes, setClasses] = useState([]);
  const [depts,   setDepts]   = useState([]);
  const [filterDept,  setFilterDept]  = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [open, setOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [form, setForm] = useState({ name: '', rollNumber: '', email: '', password: 'Student@123', classId: '' });
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);
  const [bulkData, setBulkData] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkErrors, setBulkErrors] = useState([]);

  const load = useCallback(async () => {
    const [s, c, d] = await Promise.all([
      api.get('/users/students'),
      api.get('/admin/classes'),
      api.get('/admin/departments'),
    ]);
    setAllRows(s.data); setRows(s.data); setClasses(c.data); setDepts(d.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Apply filters whenever they change
  useEffect(() => {
    let filtered = allRows;
    if (filterDept)  filtered = filtered.filter(s => {
      const deptId = s.class?.departmentId?._id || s.class?.departmentId || s.department?._id || s.department;
      return String(deptId) === filterDept;
    });
    if (filterClass) filtered = filtered.filter(s => String(s.class?._id || s.classId) === filterClass);
    setRows(filtered);
  }, [filterDept, filterClass, allRows]);

  const filteredClasses = filterDept ? classes.filter(c => String(c.departmentId?._id || c.departmentId) === filterDept) : classes;

  const save = async () => {
    if (!form.name || !form.rollNumber || !form.email || !form.classId) return toast.error('All fields required');
    setLoading(true);
    try {
      await api.post('/admin/users', { email: form.email, password: form.password, role: 'STUDENT', profile: { rollNumber: form.rollNumber, name: form.name, classId: form.classId } });
      toast.success('Student created!'); setOpen(false); setForm({ name: '', rollNumber: '', email: '', password: 'Student@123', classId: '' }); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Email may already exist'); }
    finally { setLoading(false); }
  };
  const del = async (userId) => {
    try { await api.delete('/admin/users/' + userId); toast.success('Deleted'); setConfirmId(null); load(); }
    catch { toast.error('Delete failed'); }
  };
  const openEdit = (s) => { setEditRow(s); setEditForm({ name: s.name, rollNumber: s.rollNumber, email: s.user?.email, phone: s.phone || '', classId: String(s.class?._id || s.classId || '') }); };
  const saveEdit = async () => {
    setEditLoading(true);
    try { await api.patch('/admin/users/' + editRow.user?.id, editForm); toast.success('Student updated!'); setEditRow(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Update failed'); }
    finally { setEditLoading(false); }
  };
  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['name','rollNumber','email','password','classId'],['John Doe','CSE21001','john@college.com','Student@123',classes[0]?.id || 'PASTE_CLASS_ID']]);
    ws['!cols'] = [{wch:20},{wch:15},{wch:25},{wch:15},{wch:30}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Students'); XLSX.writeFile(wb, 'student_import_template.xlsx');
    toast.success('Template downloaded!');
  };
  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => { const wb = XLSX.read(evt.target.result, { type: 'binary' }); setBulkData(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]])); setBulkErrors([]); };
    reader.readAsBinaryString(file);
  };
  const importBulk = async () => {
    if (!bulkData.length) return toast.error('No data loaded');
    setBulkLoading(true); const errors = []; let success = 0;
    for (const row of bulkData) {
      try { await api.post('/admin/users', { email: row.email, password: row.password || 'Student@123', role: 'STUDENT', profile: { rollNumber: String(row.rollNumber), name: row.name, classId: row.classId } }); success++; }
      catch (err) { errors.push(row.rollNumber + ': ' + (err.response?.data?.error || 'Failed')); }
    }
    setBulkLoading(false); setBulkErrors(errors); toast.success('Imported ' + success + ' students!');
    if (!errors.length) { setBulkOpen(false); setBulkData([]); } load();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h6" fontWeight={700}>Students ({rows.length}{allRows.length !== rows.length ? ` of ${allRows.length}` : ''})</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button variant="outlined" startIcon={<Upload />} onClick={() => setBulkOpen(true)}>Bulk Import</Button>
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Add Student</Button>
        </Box>
      </Box>

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Department</InputLabel>
          <Select value={filterDept} label="Filter by Department" onChange={e => { setFilterDept(e.target.value); setFilterClass(''); }}>
            <MenuItem value="">All Departments</MenuItem>
            {depts.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({d.code})</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Filter by Class</InputLabel>
          <Select value={filterClass} label="Filter by Class" onChange={e => setFilterClass(e.target.value)}>
            <MenuItem value="">All Classes</MenuItem>
            {filteredClasses.map(c => <MenuItem key={c.id} value={c.id}>{c.name} – {c.section} (Sem {c.semester})</MenuItem>)}
          </Select>
        </FormControl>
        {(filterDept || filterClass) && (
          <Button size="small" variant="outlined" onClick={() => { setFilterDept(''); setFilterClass(''); }}>Clear Filters</Button>
        )}
      </Box>

      <TableContainer component={Paper} variant="outlined"><Table>
        <TableHead><TableRow sx={{ bgcolor: 'grey.50' }}>
          <TableCell>#</TableCell><TableCell>Name</TableCell><TableCell>Roll No</TableCell>
          <TableCell>Email</TableCell><TableCell>Class</TableCell><TableCell>Dept</TableCell><TableCell>Action</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {rows.map((s, i) => (
            <TableRow key={s.id} hover>
              <TableCell>{i+1}</TableCell>
              <TableCell><Typography fontWeight={600}>{s.name}</Typography></TableCell>
              <TableCell><Chip label={s.rollNumber} size="small" /></TableCell>
              <TableCell sx={{ fontSize: 12 }}>{s.user?.email}</TableCell>
              <TableCell>{s.class?.name} – {s.class?.section}</TableCell>
              <TableCell><Chip label={s.class?.departmentId?.code || s.department?.code || '—'} size="small" variant="outlined" /></TableCell>
              <TableCell sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" color="primary" onClick={() => openEdit(s)}><Edit fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => setConfirmId(s.user?.id)}><Delete fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No students found</TableCell></TableRow>}
        </TableBody>
      </Table></TableContainer>

      {/* Add Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Student</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Full Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} margin="normal" />
          <TextField fullWidth label="Roll Number *" value={form.rollNumber} onChange={e => setForm({ ...form, rollNumber: e.target.value })} margin="normal" placeholder="e.g. CSE21001" />
          <TextField fullWidth label="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} margin="normal" />
          <TextField fullWidth label="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} margin="normal" />
          <FormControl fullWidth margin="normal"><InputLabel>Class *</InputLabel>
            <Select value={form.classId} label="Class *" onChange={e => setForm({ ...form, classId: e.target.value })}>
              {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} – {c.section} Sem {c.semester} ({c.department?.name})</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save} disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Create'}</Button></DialogActions>
      </Dialog>

      {/* Bulk Import Dialog */}
      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Bulk Import Students via Excel</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>Download the template, fill student data, then upload it back.</Alert>
          <Button variant="outlined" startIcon={<Download />} onClick={downloadTemplate} sx={{ mb: 2 }}>Download Template</Button>
          <Typography variant="subtitle2" mb={1}>Available Class IDs:</Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 140, mb: 2 }}>
            <Table size="small"><TableHead><TableRow><TableCell>Class</TableCell><TableCell>Section</TableCell><TableCell>Sem</TableCell><TableCell>ID (copy this)</TableCell></TableRow></TableHead>
            <TableBody>{classes.map(c => <TableRow key={c.id}><TableCell>{c.name}</TableCell><TableCell>{c.section}</TableCell><TableCell>{c.semester}</TableCell><TableCell sx={{ fontFamily: 'monospace', fontSize: 11 }}>{c.id}</TableCell></TableRow>)}</TableBody>
            </Table>
          </TableContainer>
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} id="excel-upload" style={{ display: 'none' }} />
          <label htmlFor="excel-upload">
            <Button variant="outlined" component="span" startIcon={<Upload />} fullWidth sx={{ py: 2, mb: 1 }}>
              {bulkData.length ? `${bulkData.length} rows loaded — ready to import` : 'Choose Excel File (.xlsx)'}
            </Button>
          </label>
          {bulkErrors.length > 0 && <Alert severity="error">{bulkErrors.map((e, i) => <Typography key={i} variant="caption" display="block">{e}</Typography>)}</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => { setBulkOpen(false); setBulkData([]); setBulkErrors([]); }}>Close</Button>
          <Button variant="contained" onClick={importBulk} disabled={bulkLoading || !bulkData.length}>{bulkLoading ? <CircularProgress size={20} /> : `Import ${bulkData.length} Students`}</Button>
        </DialogActions>
      </Dialog>

      <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={() => del(confirmId)} />

      {/* Edit Dialog */}
      <Dialog open={!!editRow} onClose={() => setEditRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Student</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Full Name" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} margin="normal" />
          <TextField fullWidth label="Roll Number" value={editForm.rollNumber || ''} onChange={e => setEditForm({ ...editForm, rollNumber: e.target.value })} margin="normal" />
          <TextField fullWidth label="Email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} margin="normal" />
          <TextField fullWidth label="Phone" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} margin="normal" />
          <FormControl fullWidth margin="normal"><InputLabel>Class</InputLabel>
            <Select value={editForm.classId || ''} label="Class" onChange={e => setEditForm({ ...editForm, classId: e.target.value })}>
              {classes.map(c => <MenuItem key={c.id} value={c.id}>{c.name} – {c.section}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setEditRow(null)}>Cancel</Button><Button variant="contained" onClick={saveEdit} disabled={editLoading}>{editLoading ? <CircularProgress size={20} /> : 'Save Changes'}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

function FacultyTab() {
  const [allRows, setAllRows] = useState([]);
  const [rows,    setRows]    = useState([]);
  const [depts,   setDepts]   = useState([]);
  const [filterDept, setFilterDept] = useState('');
  const [open,   setOpen]    = useState(false);
  const [form,   setForm]    = useState({ name: '', employeeId: '', email: '', password: 'Faculty@123', departmentId: '' });
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editLoading, setEditLoading] = useState(false);

  const load = useCallback(async () => {
    const [f, d] = await Promise.all([api.get('/users/faculty'), api.get('/admin/departments')]);
    setAllRows(f.data); setRows(f.data); setDepts(d.data);
  }, []);
  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (filterDept) setRows(allRows.filter(f => String(f.department?._id || f.departmentId) === filterDept));
    else setRows(allRows);
  }, [filterDept, allRows]);

  const save = async () => {
    if (!form.name || !form.employeeId || !form.email || !form.departmentId) return toast.error('All fields required');
    setLoading(true);
    try {
      await api.post('/admin/users', { email: form.email, password: form.password, role: 'FACULTY', profile: { employeeId: form.employeeId, name: form.name, departmentId: form.departmentId } });
      toast.success('Faculty created!'); setOpen(false); setForm({ name: '', employeeId: '', email: '', password: 'Faculty@123', departmentId: '' }); load();
    } catch (err) { toast.error(err.response?.data?.error || 'Email may already exist'); }
    finally { setLoading(false); }
  };
  const del = async (userId) => {
    try { await api.delete('/admin/users/' + userId); toast.success('Deleted'); setConfirmId(null); load(); }
    catch { toast.error('Delete failed'); }
  };
  const openEdit = (f) => { setEditRow(f); setEditForm({ name: f.name, employeeId: f.employeeId, email: f.user?.email, phone: f.phone || '', departmentId: String(f.department?._id || f.departmentId || '') }); };
  const saveEdit = async () => {
    setEditLoading(true);
    try { await api.patch('/admin/users/' + editRow.user?.id, editForm); toast.success('Faculty updated!'); setEditRow(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Update failed'); }
    finally { setEditLoading(false); }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>Faculty ({rows.length}{allRows.length !== rows.length ? ` of ${allRows.length}` : ''})</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => setOpen(true)}>Add Faculty</Button>
      </Box>

      {/* Filter */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Filter by Department</InputLabel>
          <Select value={filterDept} label="Filter by Department" onChange={e => setFilterDept(e.target.value)}>
            <MenuItem value="">All Departments</MenuItem>
            {depts.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({d.code})</MenuItem>)}
          </Select>
        </FormControl>
        {filterDept && <Button size="small" variant="outlined" onClick={() => setFilterDept('')}>Clear</Button>}
      </Box>

      <TableContainer component={Paper} variant="outlined"><Table>
        <TableHead><TableRow sx={{ bgcolor: 'grey.50' }}>
          <TableCell>#</TableCell><TableCell>Name</TableCell><TableCell>Employee ID</TableCell>
          <TableCell>Email</TableCell><TableCell>Department</TableCell><TableCell>Action</TableCell>
        </TableRow></TableHead>
        <TableBody>
          {rows.map((f, i) => (
            <TableRow key={f.id} hover>
              <TableCell>{i+1}</TableCell>
              <TableCell><Typography fontWeight={600}>{f.name}</Typography></TableCell>
              <TableCell><Chip label={f.employeeId} size="small" color="secondary" /></TableCell>
              <TableCell sx={{ fontSize: 12 }}>{f.user?.email}</TableCell>
              <TableCell><Chip label={f.department?.name || '—'} size="small" variant="outlined" /></TableCell>
              <TableCell sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton size="small" color="primary" onClick={() => openEdit(f)}><Edit fontSize="small" /></IconButton>
                <IconButton size="small" color="error" onClick={() => setConfirmId(f.user?.id)}><Delete fontSize="small" /></IconButton>
              </TableCell>
            </TableRow>
          ))}
          {!rows.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>No faculty found</TableCell></TableRow>}
        </TableBody>
      </Table></TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add Faculty</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Full Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} margin="normal" />
          <TextField fullWidth label="Employee ID *" value={form.employeeId} onChange={e => setForm({ ...form, employeeId: e.target.value })} margin="normal" placeholder="e.g. FAC001" />
          <TextField fullWidth label="Email *" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} margin="normal" />
          <TextField fullWidth label="Password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} margin="normal" />
          <FormControl fullWidth margin="normal"><InputLabel>Department *</InputLabel>
            <Select value={form.departmentId} label="Department *" onChange={e => setForm({ ...form, departmentId: e.target.value })}>
              {depts.map(d => <MenuItem key={d.id} value={d.id}>{d.name} ({d.code})</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" onClick={save} disabled={loading}>{loading ? <CircularProgress size={20} /> : 'Create'}</Button></DialogActions>
      </Dialog>

      <ConfirmDialog open={!!confirmId} onClose={() => setConfirmId(null)} onConfirm={() => del(confirmId)} />

      <Dialog open={!!editRow} onClose={() => setEditRow(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Faculty</DialogTitle>
        <DialogContent>
          <TextField fullWidth label="Full Name" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} margin="normal" />
          <TextField fullWidth label="Employee ID" value={editForm.employeeId || ''} onChange={e => setEditForm({ ...editForm, employeeId: e.target.value })} margin="normal" />
          <TextField fullWidth label="Email" value={editForm.email || ''} onChange={e => setEditForm({ ...editForm, email: e.target.value })} margin="normal" />
          <TextField fullWidth label="Phone" value={editForm.phone || ''} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} margin="normal" />
          <FormControl fullWidth margin="normal"><InputLabel>Department</InputLabel>
            <Select value={editForm.departmentId || ''} label="Department" onChange={e => setEditForm({ ...editForm, departmentId: e.target.value })}>
              {depts.map(d => <MenuItem key={d.id} value={d.id}>{d.name}</MenuItem>)}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}><Button onClick={() => setEditRow(null)}>Cancel</Button><Button variant="contained" onClick={saveEdit} disabled={editLoading}>{editLoading ? <CircularProgress size={20} /> : 'Save Changes'}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default function AdminDashboard({ isDark, onToggleDark }) {
  const [tab, setTab] = useState(0);
  const tabs = ["Overview", "Departments", "Classes", "Subjects", "Students", "Faculty"];
  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Admin Panel" navItems={NAV}>
      <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {tabs.map((t, i) => <Tab key={i} label={t} />)}
        </Tabs>
      </Box>
      {tab === 0 && <OverviewTab />}
      {tab === 1 && <DepartmentsTab />}
      {tab === 2 && <ClassesTab />}
      {tab === 3 && <SubjectsTab />}
      {tab === 4 && <StudentsTab />}
      {tab === 5 && <FacultyTab />}
    </Layout>
  );
}
