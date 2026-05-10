import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, CardContent, Typography, Box, Button, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Paper, CircularProgress,
} from '@mui/material';
import { Download } from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import toast from 'react-hot-toast';

export default function Reports() {
  const { sessionId } = useParams();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  useEffect(() => {
    api.get(`/reports/session/${sessionId}`)
      .then(r => setReport(r.data))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  const NAV = [];

  if (loading) return (
    <Layout title="Reports" navItems={NAV}>
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
    </Layout>
  );

  const presentCount = report?.rows.filter(r => r.status === 'PRESENT').length || 0;
  const totalCount = report?.rows.length || 0;
  const percentage = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <Layout title="Attendance Report" navItems={NAV}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography variant="h5" fontWeight={700}>{report?.session.subject.name}</Typography>
              <Typography color="text.secondary">
                {report?.session.class.name} - {report?.session.class.section} | {report?.session.faculty.name}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {new Date(report?.session.date).toLocaleDateString()} | Mode: {report?.session.mode}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <Chip label={`${presentCount}/${totalCount} Present (${percentage}%)`}
                color={percentage >= 75 ? 'success' : 'warning'} />
              <Button variant="outlined" startIcon={<Download />}
                href={`${BASE}/api/reports/session/${sessionId}/pdf`} target="_blank">PDF</Button>
              <Button variant="outlined" startIcon={<Download />}
                href={`${BASE}/api/reports/session/${sessionId}/excel`} target="_blank">Excel</Button>
            </Box>
          </Box>
        </CardContent>
      </Card>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell>#</TableCell>
              <TableCell>Roll No.</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Marked At</TableCell>
              <TableCell>Marked By</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {report?.rows.map((row, i) => (
              <TableRow key={row.rollNumber} hover>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{row.rollNumber}</TableCell>
                <TableCell>{row.name}</TableCell>
                <TableCell>
                  <Chip label={row.status} size="small"
                    color={row.status === 'PRESENT' ? 'success' : row.status === 'LATE' ? 'warning' : 'error'} />
                </TableCell>
                <TableCell>{row.markedAt !== '-' ? new Date(row.markedAt).toLocaleTimeString() : '-'}</TableCell>
                <TableCell>{row.markedBy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Layout>
  );
}
