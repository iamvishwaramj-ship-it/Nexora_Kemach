import React, { useState } from 'react';
import {
  Box, Typography, IconButton, InputAdornment, Link, useTheme,
  List, ListItem, ListItemIcon, ListItemText, TextField, Button,
  FormControlLabel, Checkbox,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import SecurityIcon from '@mui/icons-material/Security';
import ScaleIcon from '@mui/icons-material/Scale';
import CloudIcon from '@mui/icons-material/Cloud';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useLoginMutation } from '../../features/auth/authApi';
import { useGetHealthQuery } from '../../features/health/healthApi';
import useIdleTimer from '../../hooks/useIdleTimer';
import { loginSchema } from '../../lib/validation/authSchemas';
import NeonStatusPill from '../../components/feedback/NeonStatusPill';
import { useNotify } from '../../components/feedback/NotificationProvider';
import NexoraLogo from '../../components/layout/Nexora_Logo';

const featureKeys = [
  'Inventory Management', 'Purchase & Sales', 'Accounts & Finance',
  'Customer & Supplier Management', 'Reports & Analytics', 'Multi-Branch Support',
];

const HEALTH_POLL_INTERVAL_MS = 30000;
const LOGIN_IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const Login = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const notify = useNotify();
  const [showPassword, setShowPassword] = useState(false);
  const [login, { isLoading }] = useLoginMutation();

  // Ref so the idle timer's `onActive` closure (created below, but only
  // invoked well after this render has finished) can call the query's
  // `refetch` without the two hooks needing to be declared in a particular
  // order relative to each other.
  const refetchHealthRef = React.useRef(() => { });

  // Nobody's there to read the pill (and no point spending a DB round-trip on
  // every poll) once the login screen has sat untouched for 5 minutes, so the
  // poll pauses on idle and resumes -- immediately, via refetch, rather than
  // waiting out the rest of a 30s interval -- the instant any
  // mouse/keyboard/touch activity is seen again.
  const { isIdle: loginIdle } = useIdleTimer({
    timeout: LOGIN_IDLE_TIMEOUT_MS,
    onActive: () => refetchHealthRef.current(),
  });

  // Poll health every 30s while active — feeds the neon status pill under the
  // login button. `pollingInterval: 0` stops the interval entirely without
  // dropping the subscription, so the pill keeps showing the last known
  // status instead of resetting to "checking" while idle.
  const { data: health, isFetching: healthChecking, refetch: refetchHealth } = useGetHealthQuery(undefined, {
    pollingInterval: loginIdle ? 0 : HEALTH_POLL_INTERVAL_MS,
  });
  refetchHealthRef.current = refetchHealth;
  const healthStatus = healthChecking && !health ? 'checking' : health?.status === 'healthy' ? 'healthy' : 'unhealthy';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    // Empty on purpose: no pre-filled (or hard-coded) credentials on the form.
    defaultValues: { userCode: '', password: '', rememberMe: false },
    // Matches AppForm's mode elsewhere in the app: a field only shows its
    // error once the user has focused it and left (first blur), then
    // revalidates live as they fix it.
    mode: 'onTouched',
    reValidateMode: 'onBlur',
  });

  const onSubmit = async (values) => {
    try {
      // Accidental leading/trailing spaces (easy to pick up via autofill or
      // copy-paste) shouldn't block a login that's otherwise correct.
      // Sent as `userCode`, but the server matches it against the user code
      // AND the email column, so an existing email-based credential still
      // signs in through this same field.
      await login({ userCode: values.userCode.trim(), password: values.password.trim() }).unwrap();
      navigate('/dashboard');
    } catch (err) {
      notify.error(err?.data?.message || 'Invalid login credentials');
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <Box sx={{ flex: 1, display: 'flex' }}>
        {/* Left panel */}
        <Box
          sx={{
            flex: 1, display: { xs: 'none', md: 'flex' }, flexDirection: 'column',
            justifyContent: 'center', px: 6, py: 4,
            background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.primary.main}05 100%)`,
            position: 'relative', overflow: 'hidden',
          }}
        >
          <Box sx={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', bgcolor: `${theme.palette.primary.main}10` }} />
          <Box sx={{ position: 'absolute', bottom: -60, left: -60, width: 200, height: 200, borderRadius: '50%', bgcolor: `${theme.palette.primary.main}08` }} />

          <Box sx={{ mb: 4 }}>
            {/* Same shared brand mark used in the header/sidebar (see
                components/layout/Nexora_Logo.jsx) so the icon, wordmark font
                and colours are pixel-identical everywhere instead of
                drifting out of sync with a second hand-rolled copy on this
                one screen. */}
            <NexoraLogo size={56} />
          </Box>

          <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>Welcome to</Typography>
          <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>
            <Box component="span">Nexora </Box>
            <Box component="span" sx={{ color: theme.palette.primary.main }}>Enterprise</Box>
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4, fontSize: '0.95rem' }}>
            Smart Trading &amp; Distribution Management Platform
          </Typography>

          <List dense disablePadding>
            {featureKeys.map((f) => (
              <ListItem key={f} disablePadding sx={{ mb: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <CheckCircleIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                </ListItemIcon>
                <ListItemText primary={f} primaryTypographyProps={{ fontSize: '0.875rem', color: 'text.secondary' }} />
              </ListItem>
            ))}
          </List>

          <Box sx={{ display: 'flex', gap: 3, mt: 5 }}>
            {[
              { icon: <SecurityIcon />, label: 'Secure', sub: 'Your data is protected' },
              { icon: <ScaleIcon />, label: 'Scalable', sub: 'Built to grow with your business' },
              { icon: <CloudIcon />, label: 'Cloud Enabled', sub: 'Access anytime, anywhere' },
            ].map((item) => (
              <Box key={item.label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <Box sx={{ color: theme.palette.primary.main, mt: 0.3 }}>
                  {React.cloneElement(item.icon, { sx: { fontSize: 20 } })}
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '0.8rem', fontWeight: 600 }}>{item.label}</Typography>
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>{item.sub}</Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Right panel — login form */}
        <Box sx={{ width: { xs: '100%', md: 480 }, display: 'flex', alignItems: 'center', justifyContent: 'center', px: { xs: 3, md: 5 }, py: 4, borderLeft: { md: '1px solid' }, borderColor: 'divider' }}>
          <Box sx={{ width: '100%', maxWidth: 380 }} component="form" onSubmit={handleSubmit(onSubmit)} noValidate>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>{t('common.signIn')}</Typography>
            <Typography color="text.secondary" sx={{ mb: 3, fontSize: '0.875rem' }}>{t('common.welcomeBack')}</Typography>

            <TextField
              {...register('userCode')}
              label="Employee User Code"
              placeholder="Enter your employee user code"
              fullWidth
              // "off" / "new-password" tell the browser not to auto-fill or offer
              // saved credentials on this form.
              autoComplete="off"
              error={!!errors.userCode}
              helperText={errors.userCode?.message || ' '}
              sx={{ mb: 1 }}
            />

            <TextField
              {...register('password')}
              label={t('common.password')}
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              fullWidth
              autoComplete="new-password"
              error={!!errors.password}
              helperText={errors.password?.message || ' '}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword((p) => !p)} aria-label="toggle password visibility">
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1 }}
            />

            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.5 }}>
              <FormControlLabel
                control={<Checkbox size="small" {...register('rememberMe')} />}
                label={<Typography sx={{ fontSize: '0.8rem' }}>{t('common.rememberMe')}</Typography>}
              />
              <Link href="#" underline="hover" sx={{ fontSize: '0.8rem' }}>{t('common.forgotPassword')}</Link>
            </Box>

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={isLoading}
              sx={{ py: 1.25, fontSize: '0.9rem', fontWeight: 600, borderRadius: 2 }}
            >
              {isLoading ? t('common.signingIn') : t('common.signIn')}
            </Button>

            {/* Neon health status pill — directly under the login button */}
            <Box sx={{ mt: 2.5, display: 'flex', justifyContent: 'center' }}>
              <NeonStatusPill status={healthStatus} />
            </Box>

            <Typography sx={{ mt: 4, fontSize: '0.7rem', color: 'text.disabled', textAlign: 'center' }}>
              © {new Date().getFullYear()} Nexora Enterprise | SaaS Platform · Secure · Scalable · Cloud Enabled
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Login;
