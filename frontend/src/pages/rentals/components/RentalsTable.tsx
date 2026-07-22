import React from 'react';
import { Box, Typography, Chip, IconButton } from '@mui/material';
import { EditOutlined, DeleteOutlined, Business } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import DataTable from '../../../components/Common/Table';
import type { Rental } from '../../../services/rentals/types';

export interface RentalsTableProps {
  rentals: Rental[];
  onView: (rental: Rental) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  highlightId?: string | null;
}

const getStatusColor = (status: Rental['status']): 'success' | 'default' => {
  return status === 'active' ? 'success' : 'default';
};

function RentalsTable({ rentals, onView, onEdit, onDelete, highlightId }: RentalsTableProps) {
  const { t } = useTranslation();

  const columns = React.useMemo(
    () => [
      {
        id: 'rental',
        label: t('rental.contactName'),
        width: '28%',
        render: (row: Rental) => (
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
              <Business sx={{ fontSize: 22, color: 'text.secondary' }} />
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
                {row.contactName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {row.rentalType === 'company' && row.companyName
                  ? row.companyName
                  : row.email}
              </Typography>
            </Box>
          </Box>
        ),
      },
      {
        id: 'phone',
        label: t('rentals.phone'),
        width: '20%',
        render: (row: Rental) => (
          <Typography variant="body2" color="text.secondary">
            {row.phone}
          </Typography>
        ),
      },
      {
        id: 'minRentalDays',
        label: t('rental.minimumRentalDays', 'Minimum rental days'),
        width: '16%',
        align: 'right' as const,
        render: (row: Rental) => (
          <Typography variant="body2" color="text.secondary">
            {row.minimumRentalDays != null ? row.minimumRentalDays : '—'}
          </Typography>
        ),
      },
      {
        id: 'status',
        label: t('rentals.status'),
        width: '16%',
        render: (row: Rental) => (
          <Chip
            label={t(row.status === 'active' ? 'rentals.statusActive' : 'rentals.statusInactive')}
            color={getStatusColor(row.status)}
            size="small"
            sx={{ fontWeight: 600, '& .MuiChip-label': { px: 1 } }}
          />
        ),
      },
      {
        id: 'actions',
        label: '',
        width: '14%',
        align: 'center' as const,
        render: (row: Rental) => (
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
    <DataTable<Rental>
      columns={columns}
      data={rentals}
      getRowId={(row) => row.id}
      onRowClick={(row) => onView(row)}
      minWidth={720}
      highlightId={highlightId}
    />
  );
}

export default RentalsTable;
