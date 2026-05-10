import React, { useState } from 'react';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, CircularProgress, IconButton, Tooltip, InputAdornment } from '@mui/material';
import { School, DarkMode, LightMode, Visibility, VisibilityOff } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login({ isDark, onToggleDark }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please fill in all fields'); return; }
    setLoading(true); setError('');
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back!`);
      const map = { ADMIN: '/admin', FACULTY: '/faculty', STUDENT: '/student', PARENT: '/parent' };
      navigate(map[user.role] || '/');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  const amber = '#f59e0b';
  const bg = isDark ? '#0b1120' : '#f4f6fb';
  const tc = isDark ? '#e8edf5' : '#0f1923';
  const mc = isDark ? '#5a6a7e' : '#94a3b8';

  return (
    <Box sx={{
      minHeight: '100vh', bgcolor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 2,
      background: isDark
        ? 'radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.07) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(16,185,129,0.05) 0%, transparent 60%), #0b1120'
        : 'radial-gradient(ellipse at 20% 50%, rgba(245,158,11,0.1) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(16,185,129,0.06) 0%, transparent 60%), #f4f6fb',
    }}>
      {/* Dark mode toggle */}
      <Tooltip title={isDark ? 'Light mode' : 'Dark mode'}>
        <IconButton onClick={onToggleDark} sx={{ position: 'fixed', top: 16, right: 16, color: isDark ? amber : '#64748b', bgcolor: isDark ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.05)', borderRadius: 2 }}>
          {isDark ? <LightMode /> : <DarkMode />}
        </IconButton>
      </Tooltip>

      <Card sx={{ width: '100%', maxWidth: 420, bgcolor: isDark ? '#0e1829' : '#fff', border: '1px solid', borderColor: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(0,0,0,0.07)', borderRadius: 4, overflow: 'hidden' }}>
        {/* Top accent bar */}
        <Box sx={{ height: 4, background: 'linear-gradient(90deg, #f59e0b, #10b981)' }} />

        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 4 }}>
            <Box sx={{
              width: 56, height: 56, borderRadius: 3,
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(245,158,11,0.4)', mb: 2,
            }}>
              <School sx={{ color: '#0f1923', fontSize: 30 }} />
            </Box>
            <Typography sx={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 800, fontSize: 26, color: tc, letterSpacing: -0.5 }}>
              EduLMS
            </Typography>
            <Typography sx={{ fontSize: 13, color: mc, mt: 0.5 }}>
              Sign in to your account
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleLogin} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              fullWidth label="Email address" type="email" autoComplete="email" autoFocus
              value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, '&.Mui-focused fieldset': { borderColor: amber } }, '& .MuiInputLabel-root.Mui-focused': { color: amber } }}
            />
            <TextField
              fullWidth label="Password" type={showPass ? 'text' : 'password'} autoComplete="current-password"
              value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPass(p => !p)} edge="end" size="small">
                      {showPass ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, '&.Mui-focused fieldset': { borderColor: amber } }, '& .MuiInputLabel-root.Mui-focused': { color: amber } }}
            />
            <Button
              type="submit" fullWidth variant="contained" disabled={loading}
              sx={{
                py: 1.5, mt: 1, borderRadius: 2.5, fontWeight: 800, fontSize: 15,
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: '#0f1923',
                boxShadow: '0 4px 20px rgba(245,158,11,0.35)',
                '&:hover': { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 6px 24px rgba(245,158,11,0.45)' },
                '&:disabled': { opacity: 0.7 },
              }}
            >
              {loading ? <CircularProgress size={22} sx={{ color: '#0f1923' }} /> : 'Sign In'}
            </Button>
          </Box>

          <Box sx={{ mt: 3, pt: 2.5, borderTop: '1px solid', borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)' }}>
            <Typography sx={{ fontSize: 11, color: mc, textAlign: 'center', lineHeight: 1.8 }}>
              Contact your administrator if you need access.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
