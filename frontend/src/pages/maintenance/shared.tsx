import React from 'react';
import { Box, Typography, Paper, Chip } from '@mui/material';
import { DirectionsCar } from '@mui/icons-material';
import type { MaintenanceRequest, MaintenanceStatus } from '../../services/maintenance/types';
import { highlightSx, highlightAttrProps } from '../../components/Notifications/recordHighlight';

export const STATUS_COLOR: Record<MaintenanceStatus, 'warning' | 'info' | 'secondary' | 'error' | 'success' | 'default'> = {
  pending: 'warning',
  quoted: 'info',
  running: 'secondary',
  accepted: 'secondary',
  declined: 'error',
  cancelled: 'default',
  info_requested: 'warning',
  pending_return: 'info',
  completed: 'success',
};

export function StatusChip({ status, label }: { status: MaintenanceStatus; label: string }) {
  return <Chip size="small" color={STATUS_COLOR[status]} label={label} sx={{ fontWeight: 600 }} />;
}

export function duration(job: MaintenanceRequest): string {
  if (!job.estimatedValue || !job.estimatedUnit) return '';
  return `${job.estimatedValue} ${job.estimatedUnit}`;
}

export function money(value?: number): string {
  return value != null ? `$${value.toFixed(2)}` : '—';
}

interface JobCardProps {
  job: MaintenanceRequest;
  showRental?: boolean;
  showQuote?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  /** Briefly flash this card — e.g. when opened from a notification. */
  highlighted?: boolean;
}

/** Shared card for a maintenance job, used across the rental + mechanic pages. */
export const JobCard: React.FC<JobCardProps> = ({ job, showRental, showQuote, onClick, children, highlighted }) => {
  const hasQuote = job.quotedPrice != null;
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      {...highlightAttrProps(Boolean(highlighted))}
      sx={{
        p: 2.5,
        borderRadius: 2,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        '&:hover': onClick ? { boxShadow: 3 } : undefined,
        ...(highlighted ? (highlightSx as object) : {}),
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <Box sx={{ width: 44, height: 44, borderRadius: 1.5, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
            {job.vehicleImage
              ? <Box component="img" src={job.vehicleImage} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <DirectionsCar color="action" />}
          </Box>
          <Box>
            <Typography fontWeight={700}>
              {job.vehicleMake} {job.vehicleModel}
              {job.vehicleRego ? ` · ${job.vehicleRego}` : ''}
            </Typography>
            {showRental && <Typography variant="body2" color="text.secondary">{job.rentalName}</Typography>}
          </Box>
        </Box>
        <StatusChip status={job.status} label={job.statusDisplay} />
      </Box>

      <Typography variant="body2" sx={{ mt: 1.5 }}>
        <strong>Work:</strong> {job.workDescription}
      </Typography>

      {(showQuote || hasQuote) && hasQuote && (
        <Box sx={{ mt: 1, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Typography variant="body2"><strong>Quote:</strong> {money(job.quotedPrice)}</Typography>
          {duration(job) && <Typography variant="body2"><strong>Time:</strong> {duration(job)}</Typography>}
          {job.mechanicName && (
            <Typography variant="body2"><strong>Mechanic:</strong> {job.mechanicName}{job.mechanicShop ? ` (${job.mechanicShop})` : ''}</Typography>
          )}
        </Box>
      )}
      {/* Mechanic notes are intentionally not shown on the card face to keep it
          uncluttered — they're available in the "View details" dialog below. */}

      {children && <Box sx={{ mt: 1.5 }}>{children}</Box>}
    </Paper>
  );
};
