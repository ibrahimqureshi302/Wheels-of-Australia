import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Avatar,
  Stack,
  CircularProgress,
  Alert,
  AlertTitle,
  useTheme,
} from '@mui/material';
import {
  Email,
  AccountCircle,
  Phone,
  Person,
  CalendarMonth,
  Badge,
  Business,
  Numbers,
  DirectionsCar,
  Build,
  Store,
  CheckCircle,
  VerifiedUser,
  Description,
} from '@mui/icons-material';
import type { SvgIconComponent } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { listVariants, listItemVariants, fadeVariants } from '../../lib/animations';
import { useToast, DocumentPreview } from '../../components/Common';
import Button from '../../components/Common/Button';
import { profileApi, type MyProfile } from '../../services/profile/api';

/** Friendly label for the user's role (rental staff is a special case of rental). */
function roleLabel(p: MyProfile): string {
  if (p.isRentalStaff) return 'Rental staff';
  return p.roleDisplay || p.role;
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function initials(name: string, email: string): string {
  const source = name.trim() || email;
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (source[0] || '?').toUpperCase();
}

/** Single labelled value with a leading icon chip. */
const InfoRow: React.FC<{ icon: SvgIconComponent; label: string; value: React.ReactNode; color: string }> = ({
  icon: Icon,
  label,
  value,
  color,
}) => (
  <Stack direction="row" spacing={1.75} alignItems="center" sx={{ minWidth: 0 }}>
    <Box
      sx={{
        flexShrink: 0,
        width: 42,
        height: 42,
        borderRadius: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: `${color}18`,
      }}
    >
      <Icon sx={{ color, fontSize: 22 }} />
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
        {value || '—'}
      </Typography>
    </Box>
  </Stack>
);

/** Card wrapper with an icon header. */
const SectionCard: React.FC<{ icon: SvgIconComponent; title: string; color: string; children: React.ReactNode }> = ({
  icon: Icon,
  title,
  color,
  children,
}) => (
  <Paper
    elevation={0}
    sx={{
      p: { xs: 2.5, sm: 3 },
      borderRadius: 3,
      border: '1px solid',
      borderColor: 'divider',
      height: '100%',
    }}
  >
    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2.5 }}>
      <Icon sx={{ color, fontSize: 20 }} />
      <Typography variant="subtitle1" fontWeight={700}>
        {title}
      </Typography>
    </Stack>
    <Stack spacing={2.25}>{children}</Stack>
  </Paper>
);

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
  const { showError } = useToast();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    profileApi
      .me()
      .then((data) => { if (active) setProfile(data); })
      .catch(() => { if (active) showError('Failed to load your profile.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showError]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!profile) {
    return (
      <Box sx={{ p: { xs: 2, sm: 3 } }}>
        <Typography color="text.secondary">Your profile could not be loaded.</Typography>
      </Box>
    );
  }

  const rp = profile.profile;
  const isAdmin = profile.role === 'admin';

  // Role-specific rows for the role details section.
  const roleRows: Array<{ icon: SvgIconComponent; label: string; value: string }> = [];
  let roleCardIcon: SvgIconComponent = Badge;
  let roleCardTitle = 'Role details';
  if (profile.role === 'driver' && rp) {
    roleCardIcon = DirectionsCar;
    roleCardTitle = 'Driver details';
    roleRows.push({ icon: Badge, label: 'License number', value: rp.license_number || '—' });
  } else if (profile.role === 'rental' && !profile.isRentalStaff && rp) {
    roleCardIcon = Business;
    roleCardTitle = 'Rental details';
    roleRows.push({ icon: Business, label: 'Rental type', value: rp.rental_type || '—' });
    roleRows.push({ icon: Store, label: 'Company name', value: rp.company_name || '—' });
    roleRows.push({ icon: Numbers, label: 'ABN', value: rp.abn || '—' });
    roleRows.push({
      icon: CalendarMonth,
      label: 'Minimum rental days',
      value: rp.minimum_rental_days != null ? String(rp.minimum_rental_days) : '—',
    });
  } else if (profile.role === 'mechanic' && rp) {
    roleCardIcon = Build;
    roleCardTitle = 'Mechanic details';
    roleRows.push({ icon: Store, label: 'Shop name', value: rp.shop_name || '—' });
    roleRows.push({ icon: Business, label: 'Shop address', value: rp.shop_address || '—' });
    roleRows.push({ icon: Numbers, label: 'ABN', value: rp.abn || '—' });
  }

  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary.main;

  return (
    <Box sx={{ width: '100%', minHeight: '100%', maxWidth: '100%' }}>
      {/* Gradient hero — matches the dashboard banner (flat, full-width) */}
      <motion.div variants={fadeVariants} initial="initial" animate="animate">
        <Box
          sx={{
            p: { xs: 2.5, sm: 4 },
            borderRadius: 0,
            background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`,
            color: 'primary.contrastText',
            boxShadow: `0 4px 20px ${primary}40`,
          }}
        >
          <Typography variant="h4" fontWeight={700} sx={{ mb: 0.5, letterSpacing: '-0.02em' }}>
            {t('navigation.profile')}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.95 }}>
            Your account details
          </Typography>
        </Box>
      </motion.div>

      {/* Content overlapping the hero, like the dashboard stat cards */}
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 3, sm: 4 }, mt: -2, position: 'relative', zIndex: 1 }}>
        <motion.div variants={listVariants} initial="initial" animate="animate">
          {/* Suspension banner — shown when the account is locked to this page. */}
          {profile.isSuspended && (
            <motion.div variants={listItemVariants}>
              <Alert severity="error" variant="filled" sx={{ mb: 2.5, borderRadius: 3 }}>
                <AlertTitle sx={{ fontWeight: 700 }}>Your account is suspended</AlertTitle>
                {profile.suspensionReason ||
                  'Your account has been deactivated.'}
                {' '}Please contact your {profile.isRentalStaff ? 'rental owner' : 'administrator'} using
                the details below to have it reactivated.
              </Alert>
            </motion.div>
          )}

          {/* Identity card */}
          <motion.div variants={listItemVariants}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 2.5, sm: 3 },
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: theme.shadows[3],
              }}
            >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Avatar
                sx={{
                  width: 84,
                  height: 84,
                  bgcolor: 'primary.main',
                  fontSize: 32,
                  fontWeight: 700,
                  border: '4px solid',
                  borderColor: 'background.paper',
                  boxShadow: theme.shadows[4],
                }}
              >
                {initials(profile.fullName, profile.email)}
              </Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  {profile.fullName || profile.email}
                </Typography>
                <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mt: 0.25, color: 'text.secondary' }}>
                  <Email sx={{ fontSize: 16 }} />
                  <Typography variant="body2" noWrap>{profile.email}</Typography>
                </Stack>
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                  <Chip
                    size="small"
                    icon={<VerifiedUser sx={{ fontSize: 16 }} />}
                    label={roleLabel(profile)}
                    color="primary"
                    sx={{ fontWeight: 600 }}
                  />
                  <Chip
                    size="small"
                    icon={profile.isActive ? <CheckCircle sx={{ fontSize: 16 }} /> : undefined}
                    label={profile.isActive ? 'Active' : 'Inactive'}
                    color={profile.isActive ? 'success' : 'default'}
                    variant={profile.isActive ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600 }}
                  />
                </Stack>
              </Box>
            </Stack>
          </Paper>
        </motion.div>

        {/* Detail cards grid */}
        <Box
          sx={{
            mt: 3,
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: roleRows.length > 0 ? '1fr 1fr' : '1fr' },
            gap: 2.5,
          }}
        >
          <motion.div variants={listItemVariants}>
            <SectionCard icon={AccountCircle} title="Account" color={primary}>
              <InfoRow icon={Person} label="Full name" value={profile.fullName} color={primary} />
              <InfoRow icon={Email} label="Email" value={profile.email} color={theme.palette.info.main} />
              <InfoRow icon={Phone} label="Phone" value={profile.phoneNumber} color={theme.palette.success.main} />
              <InfoRow icon={VerifiedUser} label="Role" value={roleLabel(profile)} color={secondary} />
              <InfoRow icon={CalendarMonth} label="Member since" value={formatDate(profile.dateJoined)} color={theme.palette.warning.main} />
            </SectionCard>
          </motion.div>

          {roleRows.length > 0 && (
            <motion.div variants={listItemVariants}>
              <SectionCard icon={roleCardIcon} title={roleCardTitle} color={secondary}>
                {roleRows.map((r) => (
                  <InfoRow key={r.label} icon={r.icon} label={r.label} value={r.value} color={secondary} />
                ))}
              </SectionCard>
            </motion.div>
          )}
        </Box>

        {/* My documents — what the user uploaded at registration (non-admins only). */}
        {!isAdmin && (
          <motion.div variants={listItemVariants}>
            <Box sx={{ mt: 2.5 }}>
              <SectionCard icon={Description} title="My documents" color={theme.palette.info.main}>
                {profile.documents.length > 0 ? (
                  profile.documents.map((d) => <DocumentPreview key={d.id} doc={d} />)
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No documents are on file for your account.
                  </Typography>
                )}
              </SectionCard>
            </Box>
          </motion.div>
        )}

        {/* Admin contact — shown to every non-admin user. */}
        {!isAdmin && profile.adminContact && (
          <motion.div variants={listItemVariants}>
            <Paper
              elevation={0}
              sx={{
                mt: 2.5,
                p: { xs: 2.5, sm: 3 },
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                alignItems: { xs: 'flex-start', sm: 'center' },
                justifyContent: 'space-between',
                gap: 2,
                bgcolor: 'action.hover',
              }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" fontWeight={700}>
                  Need help?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  Reach out to your {profile.adminContact.is_owner ? 'rental owner' : 'administrator'}{profile.adminContact.full_name ? `, ${profile.adminContact.full_name},` : ''} for any account or support questions.
                </Typography>
                <Typography variant="body2" sx={{ mt: 0.75, fontWeight: 600 }}>
                  {profile.adminContact.email}
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<Email />}
                onClick={() => { window.location.href = `mailto:${profile.adminContact?.email ?? ''}`; }}
                sx={{ flexShrink: 0 }}
              >
                {profile.adminContact.is_owner ? 'Email owner' : 'Email admin'}
              </Button>
            </Paper>
          </motion.div>
        )}
        </motion.div>
      </Box>
    </Box>
  );
};

export default ProfilePage;
