import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Box,
  Container,
  Typography,
  Button,
  Menu,
  MenuItem,
  ListItemIcon,
  Stack,
  Link,
  Divider,
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import {
  DirectionsCar,
  GpsFixed,
  NotificationsActive,
  AdminPanelSettings,
  Build,
  Person,
  Business,
  ArrowDropDown,
  CheckCircle,
  DescriptionOutlined,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { theme as authTheme } from '../../assets/styles/theme';
import { ROUTES } from '../../constants/routes';

const MotionBox = motion(Box);

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.5, ease: [0.33, 1, 0.68, 1] as const },
};

const FEATURES = [
  { icon: <DirectionsCar />, title: 'End-to-end rental bookings', desc: 'Drivers browse the live fleet and send requests; owners approve in one tap. Trips start automatically and close with a two-way early-return and end-of-period handshake.' },
  { icon: <DescriptionOutlined />, title: 'Document capture & auto-fill', desc: 'Passports, licences and service slips are uploaded and read on the spot — key fields are extracted and pre-filled, then confirmed before they’re saved.' },
  { icon: <GpsFixed />, title: 'Live GPS trip tracking', desc: 'Active trips are tracked in real time from the driver’s device with distance logging, automatic stop at period end, and location-access safeguards.' },
  { icon: <Build />, title: 'Maintenance & mechanic quotes', desc: 'Owners flag a vehicle for repair, mechanics send priced quotes, and the job runs through to a confirmed return — fleet status stays in sync the whole way.' },
  { icon: <NotificationsActive />, title: 'Live notifications & reminders', desc: 'A real-time notification centre plus automatic alerts for rego expiry, oil changes and pending returns keep every role on the same page.' },
  { icon: <AdminPanelSettings />, title: 'Admin control & audit trail', desc: 'Admins approve registrations, manage every user and vehicle, suspend accounts and set site branding — with a full activity log behind every action.' },
];

const ROLES = [
  { icon: <AdminPanelSettings />, title: 'Admin', desc: 'Full system control — manage users, approve registrations, suspend accounts and configure branding.', action: null },
  { icon: <Person />, title: 'Driver', desc: 'Register, upload your ID, browse vehicles and request rentals. Get tracked and notified for compliance.', action: { label: 'Register as Driver', to: ROUTES.REGISTER } },
  { icon: <Business />, title: 'Rental (Owner)', desc: 'Register as a company or individual, list and manage your fleet, and approve driver requests.', action: { label: 'Register as Rental', to: ROUTES.RENTAL_REGISTER } },
  { icon: <Build />, title: 'Mechanic', desc: 'Register your workshop, handle oil changes and upload service records for the vehicles you maintain.', action: { label: 'Register as Mechanic', to: ROUTES.MECHANIC_REGISTER } },
];

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const openRegister = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const closeRegister = () => setAnchorEl(null);
  const goRegister = (to: string) => { closeRegister(); navigate(to); };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const registerMenu = (
    <Menu anchorEl={anchorEl} open={open} onClose={closeRegister}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      slotProps={{ paper: { sx: { mt: 1, borderRadius: 2, minWidth: 220 } } }}
    >
      <MenuItem onClick={() => goRegister(ROUTES.REGISTER)}>
        <ListItemIcon><Person fontSize="small" /></ListItemIcon> Driver sign up
      </MenuItem>
      <MenuItem onClick={() => goRegister(ROUTES.RENTAL_REGISTER)}>
        <ListItemIcon><Business fontSize="small" /></ListItemIcon> Rental registration
      </MenuItem>
      <MenuItem onClick={() => goRegister(ROUTES.MECHANIC_REGISTER)}>
        <ListItemIcon><Build fontSize="small" /></ListItemIcon> Mechanic sign up
      </MenuItem>
    </Menu>
  );

  return (
    <ThemeProvider theme={authTheme}>
      <Box sx={{ bgcolor: '#ffffff', color: '#111827', minHeight: '100vh' }}>
        {/* ---------- Header ---------- */}
        <AppBar
          position="sticky"
          elevation={0}
          sx={{
            bgcolor: 'rgba(255,255,255,0.85)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid',
            borderColor: 'grey.200',
            color: '#111827',
          }}
        >
          <Container maxWidth="lg">
            <Toolbar disableGutters sx={{ gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${authTheme.palette.primary.main}, ${authTheme.palette.primary.dark})`,
                  color: '#fff',
                }}>
                  <DirectionsCar fontSize="small" />
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                  Wheels of Australia
                </Typography>
              </Box>

              <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' }, mr: 2 }}>
                <Link component="button" onClick={() => scrollTo('features')} underline="none" sx={{ color: 'text.secondary', fontWeight: 600, '&:hover': { color: 'primary.main' } }}>Features</Link>
                <Link component="button" onClick={() => scrollTo('roles')} underline="none" sx={{ color: 'text.secondary', fontWeight: 600, '&:hover': { color: 'primary.main' } }}>Roles</Link>
                <Link component="button" onClick={() => scrollTo('about')} underline="none" sx={{ color: 'text.secondary', fontWeight: 600, '&:hover': { color: 'primary.main' } }}>About</Link>
              </Stack>

              <Button variant="text" onClick={() => navigate(ROUTES.LOGIN)} sx={{ fontWeight: 600 }}>
                Sign in
              </Button>
              <Button variant="contained" onClick={openRegister} endIcon={<ArrowDropDown />} sx={{ fontWeight: 600, borderRadius: 2 }}>
                Register
              </Button>
              {registerMenu}
            </Toolbar>
          </Container>
        </AppBar>

        {/* ---------- Hero ---------- */}
        <Box
          sx={{
            position: 'relative',
            color: '#fff',
            background: `linear-gradient(135deg, ${authTheme.palette.primary.main} 0%, ${authTheme.palette.primary.dark} 60%, #3730a3 100%)`,
            overflow: 'hidden',
          }}
        >
          <Box sx={{ position: 'absolute', top: -120, right: -120, width: 360, height: 360, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.08)' }} />
          <Box sx={{ position: 'absolute', bottom: -140, left: -100, width: 320, height: 320, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
          <Container maxWidth="lg" sx={{ position: 'relative', py: { xs: 8, md: 12 } }}>
            <MotionBox {...fadeUp} sx={{ maxWidth: 760 }}>
              <Typography sx={{ display: 'inline-block', px: 1.5, py: 0.5, mb: 2, borderRadius: 99, bgcolor: 'rgba(255,255,255,0.15)', fontSize: 13, fontWeight: 600 }}>
                Car Rental Digital Platform
              </Typography>
              <Typography variant="h2" sx={{ fontWeight: 800, lineHeight: 1.1, letterSpacing: '-0.03em', fontSize: { xs: '2.25rem', md: '3.5rem' } }}>
                Digitise your car rental operations
              </Typography>
              <Typography variant="h6" sx={{ mt: 2.5, fontWeight: 400, opacity: 0.92, maxWidth: 620 }}>
                Wheels of Australia connects rental companies and drivers under one administrative platform —
                with document handling, GPS tracking, and compliance notifications built in.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 4 }}>
                <Button size="large" variant="contained"
                  onClick={() => scrollTo('roles')}
                  sx={{ bgcolor: '#fff', color: 'primary.main', fontWeight: 700, borderRadius: 2, px: 4, '&:hover': { bgcolor: 'grey.100' } }}>
                  Get started
                </Button>
                <Button size="large" variant="outlined"
                  onClick={() => navigate(ROUTES.LOGIN)}
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.6)', fontWeight: 700, borderRadius: 2, px: 4, '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  Sign in
                </Button>
              </Stack>
            </MotionBox>
          </Container>
        </Box>

        {/* ---------- Features / Specification ---------- */}
        <Container maxWidth="lg" id="features" sx={{ py: { xs: 7, md: 10 }, scrollMarginTop: 80 }}>
          <MotionBox {...fadeUp} sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700 }}>What we built</Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: { xs: '1.75rem', md: '2.5rem' } }}>
              Key features
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1.5, maxWidth: 660, mx: 'auto' }}>
              A complete, working car-rental platform — every step from registration and document checks through live tracking, maintenance and compliance is built and connected.
            </Typography>
          </MotionBox>

          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(3, 1fr)' } }}>
            {FEATURES.map((f, i) => (
              <MotionBox key={f.title} {...fadeUp}
                transition={{ ...fadeUp.transition, delay: (i % 3) * 0.08 }}
                sx={{
                  position: 'relative', p: 3.5, borderRadius: 3, border: '1px solid', borderColor: 'grey.200',
                  bgcolor: '#fff', overflow: 'hidden',
                  transition: 'transform .2s, box-shadow .2s, border-color .2s',
                  '&:before': {
                    content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: `linear-gradient(90deg, ${authTheme.palette.primary.main}, ${authTheme.palette.primary.dark})`,
                    opacity: 0, transition: 'opacity .2s',
                  },
                  '&:hover': {
                    transform: 'translateY(-4px)', boxShadow: '0 20px 40px -20px rgba(99,102,241,0.45)', borderColor: 'primary.light',
                    '&:before': { opacity: 1 },
                  },
                }}>
                <Box sx={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52,
                  borderRadius: 2, mb: 2, color: '#fff',
                  background: `linear-gradient(135deg, ${authTheme.palette.primary.main}, ${authTheme.palette.primary.dark})`,
                  boxShadow: '0 10px 20px -10px rgba(99,102,241,0.6)',
                }}>
                  {f.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75, letterSpacing: '-0.01em' }}>{f.title}</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>{f.desc}</Typography>
              </MotionBox>
            ))}
          </Box>
        </Container>

        {/* ---------- Roles ---------- */}
        <Box id="roles" sx={{ bgcolor: 'grey.50', py: { xs: 7, md: 10 }, scrollMarginTop: 80 }}>
          <Container maxWidth="lg">
            <MotionBox {...fadeUp} sx={{ textAlign: 'center', mb: 6 }}>
              <Typography variant="overline" sx={{ color: 'primary.main', fontWeight: 700 }}>Who it’s for</Typography>
              <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.02em', fontSize: { xs: '1.75rem', md: '2.5rem' } }}>
                Choose your role to get started
              </Typography>
            </MotionBox>

            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' } }}>
              {ROLES.map((r) => (
                <MotionBox key={r.title} {...fadeUp}
                  sx={{ p: 3.5, borderRadius: 3, bgcolor: '#fff', border: '1px solid', borderColor: 'grey.200', display: 'flex', flexDirection: 'column' }}>
                  <Box sx={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52,
                    borderRadius: '50%', mb: 2, color: '#fff',
                    background: `linear-gradient(135deg, ${authTheme.palette.primary.main}, ${authTheme.palette.primary.dark})`,
                  }}>
                    {r.icon}
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75 }}>{r.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ flexGrow: 1 }}>{r.desc}</Typography>
                  {r.action ? (
                    <Button onClick={() => navigate(r.action!.to)} variant="outlined" sx={{ mt: 2, borderRadius: 2, fontWeight: 600 }}>
                      {r.action.label}
                    </Button>
                  ) : (
                    <Typography variant="caption" sx={{ mt: 2, color: 'text.disabled', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CheckCircle sx={{ fontSize: 16 }} /> Managed internally
                    </Typography>
                  )}
                </MotionBox>
              ))}
            </Box>
          </Container>
        </Box>

        {/* ---------- About / CTA band ---------- */}
        <Box id="about" sx={{ scrollMarginTop: 80, py: { xs: 7, md: 9 } }}>
          <Container maxWidth="md">
            <MotionBox {...fadeUp}
              sx={{
                textAlign: 'center', p: { xs: 4, md: 6 }, borderRadius: 4, color: '#fff',
                background: `linear-gradient(135deg, ${authTheme.palette.primary.main}, ${authTheme.palette.primary.dark})`,
                boxShadow: '0 30px 60px -25px rgba(99,102,241,0.6)',
              }}>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
                Ready to get started?
              </Typography>
              <Typography variant="body1" sx={{ mt: 1.5, opacity: 0.92 }}>
                Create your account and an admin will review and approve it — you’ll receive your login details by email.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mt: 3.5 }}>
                <Button size="large" variant="contained" onClick={openRegister} endIcon={<ArrowDropDown />}
                  sx={{ bgcolor: '#fff', color: 'primary.main', fontWeight: 700, borderRadius: 2, px: 4, '&:hover': { bgcolor: 'grey.100' } }}>
                  Register
                </Button>
                <Button size="large" variant="outlined" onClick={() => navigate(ROUTES.LOGIN)}
                  sx={{ color: '#fff', borderColor: 'rgba(255,255,255,0.6)', fontWeight: 700, borderRadius: 2, px: 4, '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  Sign in
                </Button>
              </Stack>
            </MotionBox>
          </Container>
        </Box>

        {/* ---------- Footer ---------- */}
        <Box component="footer" sx={{ bgcolor: '#0f172a', color: 'rgba(255,255,255,0.75)', py: { xs: 5, md: 7 } }}>
          <Container maxWidth="lg">
            <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { xs: '1fr', sm: '2fr 1fr 1fr 1fr' } }}>
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <DirectionsCar sx={{ color: 'primary.light' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#fff' }}>Wheels of Australia</Typography>
                </Box>
                <Typography variant="body2" sx={{ maxWidth: 320 }}>
                  A digital car rental platform that centralises rental operations between drivers and car owners — with tracking, document management and compliance, under full administrative control.
                </Typography>
              </Box>

              <FooterCol title="Platform" links={[
                { label: 'Features', onClick: () => scrollTo('features') },
                { label: 'Roles', onClick: () => scrollTo('roles') },
                { label: 'About', onClick: () => scrollTo('about') },
              ]} />
              <FooterCol title="Sign up" links={[
                { label: 'Driver', onClick: () => navigate(ROUTES.REGISTER) },
                { label: 'Rental', onClick: () => navigate(ROUTES.RENTAL_REGISTER) },
                { label: 'Mechanic', onClick: () => navigate(ROUTES.MECHANIC_REGISTER) },
              ]} />
              <FooterCol title="Account" links={[
                { label: 'Sign in', onClick: () => navigate(ROUTES.LOGIN) },
              ]} />
            </Box>

            <Divider sx={{ my: 4, borderColor: 'rgba(255,255,255,0.12)' }} />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.55)' }}>
              © 2026 Wheels of Australia. All rights reserved.
            </Typography>
          </Container>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

const FooterCol: React.FC<{ title: string; links: { label: string; onClick: () => void }[] }> = ({ title, links }) => (
  <Box>
    <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, mb: 1.5 }}>{title}</Typography>
    <Stack spacing={1}>
      {links.map((l) => (
        <Link key={l.label} component="button" onClick={l.onClick} underline="none"
          sx={{ color: 'rgba(255,255,255,0.7)', textAlign: 'left', fontSize: 14, '&:hover': { color: '#fff' } }}>
          {l.label}
        </Link>
      ))}
    </Stack>
  </Box>
);

export default LandingPage;
