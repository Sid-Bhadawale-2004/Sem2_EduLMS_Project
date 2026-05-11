import React, { useState, useEffect, useRef, useCallback } from 'react';
import jsQR from 'jsqr';
import {
  Grid, Card, CardContent, Typography, Box, Chip, LinearProgress,
  TextField, Button, Alert, List, ListItem, ListItemText,
  Divider, CircularProgress, Tabs, Tab,
} from '@mui/material';
import {
  QrCodeScanner, CheckCircle, Warning, FlashlightOn, FlashlightOff,
  School, Assignment, CalendarMonth, Campaign,
  VideoCall, MenuBook, Notifications as NotifIcon,
  Chat as ChatIcon, BarChart as BarChartIcon, AccountCircle,
  AccessTime, LocationOn,
} from '@mui/icons-material';
import Layout from '../components/Layout';
import api from '../services/api';
import socketService from '../services/socketService';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

const NAV = [
  { label: 'Dashboard',     icon: <CheckCircle />,   path: '/student' },
  { label: 'My Attendance', icon: <BarChartIcon />,  path: '/attendance-history' },
  { label: 'Notes',         icon: <School />,        path: '/notes' },
  { label: 'Assignments',   icon: <Assignment />,    path: '/assignments' },
  { label: 'Syllabus',      icon: <MenuBook />,      path: '/syllabus' },
  { label: 'Timetable',     icon: <CalendarMonth />, path: '/timetable' },
  { label: 'Live Classes',  icon: <VideoCall />,     path: '/live-classes' },
  { label: 'Announcements', icon: <Campaign />,      path: '/announcements' },
  { label: 'Notifications', icon: <NotifIcon />,     path: '/notifications' },
  { label: 'My Profile',    icon: <AccountCircle />, path: '/profile' },
];

const amber = '#f59e0b';
const emerald = '#10b981';

export default function StudentDashboard({ isDark, onToggleDark }) {
  const [tab, setTab] = useState(0);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [qrActive, setQrActive] = useState(false);
  const [qrError, setQrError] = useState('');
  const [codeExpiry, setCodeExpiry] = useState(null);
  const [codeTimeLeft, setCodeTimeLeft] = useState(null);
  const [sessionInfo, setSessionInfo] = useState(null);
  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanRef   = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [maxZoom, setMaxZoom] = useState(5);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [qrDetected, setQrDetected] = useState(false);

  useEffect(() => { 
    loadAttendance(); 
    
    // Listen for code refresh updates
    const unsubscribeCode = socketService.onCodeRefreshed((payload) => {
      setCodeExpiry(new Date(payload.expiresAt));
      setCodeTimeLeft(null);
    });

    return () => { 
      stopQR(); 
      unsubscribeCode?.();
    }; 
  }, []);

  const loadAttendance = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/attendance/my');
      setAttendanceData(data);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  };

  // Update code time left countdown
  useEffect(() => {
    if (!codeExpiry) return;
    const interval = setInterval(() => {
      const now = new Date();
      const diff = new Date(codeExpiry) - now;
      if (diff <= 0) {
        setCodeExpiry(null);
        setCodeTimeLeft(null);
        clearInterval(interval);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setCodeTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [codeExpiry]);

  const startQR = async () => {
    setQrError(''); setZoom(1); setTorchOn(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      setQrActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', true);
          videoRef.current.play().catch(() => {});
        }
        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.() || {};
        if (caps.zoom) setMaxZoom(caps.zoom.max || 5);
        if (caps.torch) setTorchSupported(true);
        scanRef.current = setInterval(() => scanFrame(), 300);
      }, 300);
    } catch { setQrError('Camera access denied. Please allow camera permission.'); }
  };

  const stopQR = () => {
    clearInterval(scanRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    setQrActive(false); setQrError(''); setZoom(1); setTorchOn(false); setFullscreen(false);
  };

  const applyZoom = async (newZoom) => {
    const clamped = Math.min(Math.max(1, newZoom), maxZoom);
    setZoom(clamped);
    const track = streamRef.current?.getVideoTracks()[0];
    if (track?.getCapabilities?.()?.zoom) {
      try { await track.applyConstraints({ advanced: [{ zoom: clamped }] }); } catch {}
    }
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const newVal = !torchOn;
    try { await track.applyConstraints({ advanced: [{ torch: newVal }] }); setTorchOn(newVal); }
    catch { toast.error('Torch not supported'); }
  };

  const scanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || video.videoWidth === 0 || video.paused) return;
    const W = 480, H = Math.floor(video.videoHeight * (W / video.videoWidth));
    const canvas = canvasRef.current;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(video, 0, 0, W, H);
    const imageData = ctx.getImageData(0, 0, W, H);
    const result = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'attemptBoth' });
    if (result?.data) { clearInterval(scanRef.current); handleQRResult(result.data); }
  };

  const handleQRResult = async (rawValue) => {
    if (!rawValue || rawValue.length < 8) return;
    setQrDetected(true); setTimeout(() => setQrDetected(false), 800);
    stopQR();
    try {
      let lat = null, lng = null;
      try {
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000, enableHighAccuracy: true }));
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch {}
      await api.post('/attendance/qr', { payload: rawValue, hmac: rawValue, lat, lng });
      toast.success('✅ Attendance marked!');
      loadAttendance();
    } catch (err) {
      const msg = err.response?.data?.error || 'QR expired. Ask faculty to refresh.';
      setQrError(msg); toast.error(msg);
      scanRef.current = setInterval(() => scanFrame(), 300);
    }
  };

  const submitCode = async () => {
    if (code.length !== 6) return toast.error('Enter the 6-digit code');
    setSubmitting(true);
    try {
      let lat = null, lng = null;
      try {
        const pos = await new Promise((res, rej) => 
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 4000, enableHighAccuracy: true })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.warn('Geolocation failed:', e.message);
        // Continue without location if geolocation fails (in case location is not required)
      }
      await api.post('/attendance/code', { code, lat, lng });
      toast.success('✅ Attendance marked!');
      setCode('');
      await loadAttendance();
    } catch (err) { 
      toast.error(err.response?.data?.error || 'Failed'); 
    }
    finally { setSubmitting(false); }
  };

  const lowSubjects = attendanceData?.summary?.filter(s => s.isLow) || [];

  return (
    <Layout isDark={isDark} onToggleDark={onToggleDark} title="Student Portal" navItems={NAV}>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress sx={{ color: amber }} /></Box>
      ) : (
        <Grid container spacing={3}>
          {lowSubjects.length > 0 && (
            <Grid item xs={12}>
              <Alert severity="warning" icon={<Warning />} sx={{ borderRadius: 2 }}>
                <Typography fontWeight={700}>Low Attendance Warning</Typography>
                {lowSubjects.map(s => (
                  <Typography key={s.subjectCode} variant="body2">{s.subjectName}: {s.percentage}% (below 75%)</Typography>
                ))}
              </Alert>
            </Grid>
          )}

          {/* Subject attendance */}
          <Grid item xs={12} md={7}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} mb={2.5}>Subject-wise Attendance</Typography>
                {!attendanceData?.summary?.length ? (
                  <Box sx={{ textAlign: 'center', py: 5, color: 'text.secondary' }}>
                    <School sx={{ fontSize: 52, mb: 1, opacity: 0.3 }} />
                    <Typography>No records yet</Typography>
                  </Box>
                ) : (
                  attendanceData.summary.map(s => (
                    <Box key={s.subjectCode} sx={{ mb: 2.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                        <Typography variant="body2" fontWeight={600}>{s.subjectName}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                          <Typography variant="caption" color="text.secondary">{s.present}/{s.total}</Typography>
                          <Chip label={`${s.percentage}%`} size="small"
                            sx={{ fontWeight: 700, bgcolor: s.percentage >= 75 ? '#d1fae5' : '#fee2e2', color: s.percentage >= 75 ? '#065f46' : '#991b1b' }} />
                        </Box>
                      </Box>
                      <LinearProgress variant="determinate" value={s.percentage}
                        sx={{ borderRadius: 4, height: 8, bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)',
                          '& .MuiLinearProgress-bar': { bgcolor: s.percentage >= 75 ? emerald : '#ef4444', borderRadius: 4 } }} />
                    </Box>
                  ))
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Mark attendance */}
          <Grid item xs={12} md={5}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={700} mb={2}>Mark Attendance</Typography>
                <Tabs value={tab} onChange={(_, v) => { setTab(v); setQrError(''); if (qrActive) stopQR(); }}
                  sx={{ mb: 2, '& .MuiTab-root': { fontWeight: 600 }, '& .MuiTabs-indicator': { bgcolor: amber } }}>
                  <Tab label="Enter Code" />
                  <Tab label="QR Scan" />
                </Tabs>

                {tab === 0 && (
                  <Box>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Enter the 6-digit code shown by your faculty.
                    </Typography>
                    {codeExpiry && (
                      <Alert severity="info" icon={<AccessTime />} sx={{ mb: 2, borderRadius: 1.5 }}>
                        <Typography variant="caption" fontWeight={600}>
                          Code expires in: <span style={{ fontWeight: 800, fontSize: '1.1em' }}>{codeTimeLeft || 'checking...'}</span>
                        </Typography>
                      </Alert>
                    )}
                    <TextField fullWidth label="6-Digit Code" value={code}
                      onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      margin="normal" size="small"
                      inputProps={{ inputMode: 'numeric', maxLength: 6, style: { letterSpacing: 10, fontSize: 24, textAlign: 'center', fontWeight: 800 } }}
                      sx={{ '& .MuiOutlinedInput-root.Mui-focused fieldset': { borderColor: amber } }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                      ℹ️ Location verification may be required if enabled by your faculty.
                    </Typography>
                    <Button fullWidth variant="contained" sx={{ mt: 1.5, py: 1.2, bgcolor: amber, color: '#0f1923', fontWeight: 700, '&:hover': { bgcolor: '#d97706' } }}
                      onClick={submitCode} disabled={submitting || code.length !== 6}>
                      {submitting ? <CircularProgress size={20} sx={{ color: '#0f1923' }} /> : 'Mark Attendance'}
                    </Button>
                  </Box>
                )}

                {tab === 1 && (
                  <Box sx={{ textAlign: 'center' }}>
                    {!qrActive ? (
                      <Box sx={{ py: 2 }}>
                        <QrCodeScanner sx={{ fontSize: 80, color: amber, mb: 2 }} />
                        <Typography variant="h6" fontWeight={700} sx={{ mb: 1 }}>Scan QR Code</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                          Point your camera at the QR displayed by your faculty.
                        </Typography>
                        <Button fullWidth variant="contained" size="large" onClick={startQR}
                          startIcon={<QrCodeScanner />}
                          sx={{ py: 1.4, borderRadius: 3, bgcolor: amber, color: '#0f1923', fontWeight: 700, '&:hover': { bgcolor: '#d97706' } }}>
                          Open Camera
                        </Button>
                      </Box>
                    ) : (
                      <Box>
                        <Box sx={{ position: fullscreen ? 'fixed' : 'relative', inset: fullscreen ? 0 : 'auto', zIndex: fullscreen ? 9999 : 1, bgcolor: '#000', borderRadius: fullscreen ? 0 : 3, overflow: 'hidden', width: '100%' }}>
                          <video ref={videoRef} autoPlay playsInline muted
                            style={{ width: '100%', height: fullscreen ? '100vh' : '65vw', maxHeight: fullscreen ? '100vh' : 420, objectFit: 'cover', display: 'block' }} />
                          <canvas ref={canvasRef} style={{ display: 'none' }} />
                          <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 55% 55% at 50% 50%, transparent 0%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />
                          {qrDetected && <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'rgba(16,185,129,0.4)', pointerEvents: 'none', zIndex: 10 }} />}
                          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: fullscreen ? 280 : 220, height: fullscreen ? 280 : 220, pointerEvents: 'none' }}>
                            {[['top','left'],['top','right'],['bottom','left'],['bottom','right']].map(([v,h], i) => (
                              <Box key={i} sx={{ position: 'absolute', [v]: 0, [h]: 0, width: 36, height: 36,
                                borderTop: v === 'top' ? `4px solid ${amber}` : 'none', borderBottom: v === 'bottom' ? `4px solid ${amber}` : 'none',
                                borderLeft: h === 'left' ? `4px solid ${amber}` : 'none', borderRight: h === 'right' ? `4px solid ${amber}` : 'none', borderRadius: 1 }} />
                            ))}
                            <Box sx={{ position: 'absolute', left: 4, right: 4, height: 2, bgcolor: amber, opacity: 0.9,
                              animation: 'scanline 2s linear infinite',
                              '@keyframes scanline': { '0%': { top: '5%' }, '50%': { top: '90%' }, '100%': { top: '5%' } } }} />
                          </Box>
                          <Box sx={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 1 }}>
                            {torchSupported && (
                              <Button size="small" onClick={toggleTorch}
                                sx={{ minWidth: 0, px: 1.5, py: 0.5, bgcolor: torchOn ? amber : 'rgba(0,0,0,0.5)', color: torchOn ? '#0f1923' : '#fff', backdropFilter: 'blur(4px)', borderRadius: 2 }}>
                                {torchOn ? <FlashlightOn fontSize="small" /> : <FlashlightOff fontSize="small" />}
                              </Button>
                            )}
                            <Button size="small" onClick={() => setFullscreen(f => !f)}
                              sx={{ minWidth: 0, px: 1.5, py: 0.5, bgcolor: 'rgba(0,0,0,0.5)', color: '#fff', backdropFilter: 'blur(4px)', borderRadius: 2 }}>
                              {fullscreen ? '⊠' : '⛶'}
                            </Button>
                          </Box>
                          <Box sx={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, px: 3 }}>
                            <Button variant="contained" size="small" onClick={() => applyZoom(zoom - 0.5)} disabled={zoom <= 1}
                              sx={{ minWidth: 42, height: 42, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(4px)', fontSize: 20 }}>−</Button>
                            <Box sx={{ bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', px: 2.5, py: 0.8, borderRadius: 4, fontSize: 14, fontWeight: 700, backdropFilter: 'blur(4px)', minWidth: 70, textAlign: 'center' }}>
                              {zoom.toFixed(1)}×
                            </Box>
                            <Button variant="contained" size="small" onClick={() => applyZoom(zoom + 0.5)} disabled={zoom >= maxZoom}
                              sx={{ minWidth: 42, height: 42, borderRadius: '50%', bgcolor: 'rgba(0,0,0,0.6)', color: '#fff', backdropFilter: 'blur(4px)', fontSize: 20 }}>+</Button>
                          </Box>
                        </Box>
                        {qrError && <Alert severity="error" sx={{ mt: 1.5, textAlign: 'left', borderRadius: 2 }}>{qrError}</Alert>}
                        <Button fullWidth variant="outlined" color="error" onClick={stopQR} sx={{ mt: 1.5, borderRadius: 2.5 }}>✕ Stop Camera</Button>
                      </Box>
                    )}
                  </Box>
                )}
              </CardContent>
            </Card>

            <Card sx={{ mt: 2.5 }}>
              <CardContent>
                <Typography variant="h6" fontWeight={700} mb={1.5}>Recent Attendance</Typography>
                <List dense>
                  {attendanceData?.attendances?.slice(0, 8).map((a, i) => (
                    <React.Fragment key={a.id || i}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText
                          primary={a.session?.subject?.name || a.sessionId?.subjectId?.name || '—'}
                          secondary={a.markedAt ? format(new Date(a.markedAt), 'MMM dd, yyyy hh:mm a') : '—'}
                          primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                          secondaryTypographyProps={{ fontSize: 11 }}
                        />
                        <Chip label={a.status} size="small"
                          sx={{ fontWeight: 700, bgcolor: a.status === 'PRESENT' ? '#d1fae5' : '#fee2e2', color: a.status === 'PRESENT' ? '#065f46' : '#991b1b' }} />
                      </ListItem>
                      {i < 7 && <Divider />}
                    </React.Fragment>
                  ))}
                  {!attendanceData?.attendances?.length && (
                    <ListItem><ListItemText primary="No records" sx={{ textAlign: 'center', color: 'text.secondary' }} /></ListItem>
                  )}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Layout>
  );
}
