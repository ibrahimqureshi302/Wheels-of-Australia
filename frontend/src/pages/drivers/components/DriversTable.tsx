import React from 'react';
import { Box, Typography, Chip, IconButton } from '@mui/material';
import { EditOutlined, DeleteOutlined, Person } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import DataTable from '../../../components/Common/Table';
import type { Driver } from '../../../services/drivers/types';

export interface DriversTableProps {
  drivers: Driver[];
  onView: (driver: Driver) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  highlightId?: string | null;
}

const getStatusColor = (status: Driver['status']): 'success' | 'default' => {
  return status === 'active' ? 'success' : 'default';
};

function DriversTable({ drivers, onView, onEdit, onDelete, highlightId }: DriversTableProps) {
  const { t } = useTranslation();

  const columns = React.useMemo(
    () => [
      {
        id: 'driver',
        label: t('drivers.fullName'),
        width: '24%',
        render: (row: Driver) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Person sx={{ fontSize: 22, color: 'text.secondary' }} />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                {row.fullName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {row.email}
              </Typography>
            </Box>
          </Box>
        ),
      },
      {
        id: 'phone',
        label: t('drivers.phone'),
        width: '16%',
        render: (row: Driver) => (
          <Typography variant="body2" color="text.secondary">
            {row.phone}
          </Typography>
        ),
      },
      {
        id: 'license',
        label: t('drivers.licenseNumber'),
        width: '16%',
        render: (row: Driver) => (
          <Typography variant="body2" color="text.secondary">
            {row.licenseNumber || '—'}
          </Typography>
        ),
      },
      {
        id: 'status',
        label: t('drivers.status'),
        width: '14%',
        render: (row: Driver) => (
          <Chip
            label={t(row.status === 'active' ? 'drivers.statusActive' : 'drivers.statusInactive')}
            color={getStatusColor(row.status)}
            size="small"
            sx={{ fontWeight: 600, '& .MuiChip-label': { px: 1 } }}
          />
        ),
      },
      {
        id: 'actions',
        label: '',
        width: '12%',
        align: 'center' as const,
        render: (row: Driver) => (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(row.id);
              }}
              aria-label={t('common.edit')}
              sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
            >
              <EditOutlined fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(row.id);
              }}
              aria-label={t('common.delete')}
              sx={{ color: 'text.secondary', '&:hover': { color: 'error.main' } }}
            >
              <DeleteOutlined fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
    ],
    [t, onEdit, onDelete]
  );

  return (
    <DataTable<Driver>
      columns={columns}
      data={drivers}
      getRowId={(row) => row.id}
      onRowClick={(row) => onView(row)}
      minWidth={640}
      highlightId={highlightId}
    />
  );
}

export default DriversTable;
