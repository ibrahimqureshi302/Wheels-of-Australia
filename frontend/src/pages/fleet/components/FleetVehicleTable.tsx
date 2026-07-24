import React from 'react';
import { Box, Typography, Chip, IconButton } from '@mui/material';
import { EditOutlined, DeleteOutlined, DirectionsCar } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import DataTable from '../../../components/Common/Table';
import type { Vehicle } from '../../../services/rental/types';

export interface FleetVehicleTableProps {
  vehicles: Vehicle[];
  /** Row click → open the read-only details view. */
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  highlightId?: string | null;
}

/** Format a stored date ("2026-06-22") as "22 Jun 2026" without timezone drift.
 * Returns "—" when empty so the table reads cleanly. */
function formatDate(iso?: string): string {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' });
}

const getStatusColor = (status: Vehicle['status']): 'success' | 'info' | 'warning' | 'secondary' | 'default' => {
  switch (status) {
    case 'available':
      return 'success';
    case 'rented':
      return 'info';
    case 'pending_return':
      return 'secondary';
    case 'maintenance':
      return 'warning';
    default:
      return 'default';
  }
};

const getStatusLabel = (status: Vehicle['status'], t: (k: string, d?: string) => string): string => {
  switch (status) {
    case 'available':
      return t('fleet.statusAvailable');
    case 'rented':
      return t('fleet.statusRented');
    case 'pending_return':
      return t('fleet.statusPendingReturn', 'Pending return');
    default:
      return t('fleet.statusMaintenance');
  }
};

function VehicleImageCell({ vehicle }: { vehicle: Vehicle }) {
  const [imgError, setImgError] = React.useState(false);
  const showImg = Boolean(vehicle.imageUrl) && !imgError;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 1.5,
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {showImg ? (
          <Box
            component="img"
            src={vehicle.imageUrl}
            alt=""
            onError={() => setImgError(true)}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <DirectionsCar sx={{ fontSize: 24, color: 'text.secondary' }} />
        )}
      </Box>
      <Box>
        <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3 }}>
          {vehicle.make} {vehicle.model}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {vehicle.year}
        </Typography>
      </Box>
    </Box>
  );
}

function FleetVehicleTable({ vehicles, onView, onEdit, onDelete, highlightId }: FleetVehicleTableProps) {
  const { t } = useTranslation();

  const columns = React.useMemo(
    () => [
      {
        id: 'vehicle',
        label: `${t('fleet.make')} / ${t('fleet.model')}`,
        width: '16%',
        render: (row: Vehicle) => <VehicleImageCell vehicle={row} />,
      },
      {
        id: 'rego',
        label: t('fleet.rego'),
        width: '7%',
        render: (row: Vehicle) => <Typography variant="body2">{row.rego}</Typography>,
      },
      {
        id: 'status',
        label: t('fleet.status'),
        width: '11%',
        render: (row: Vehicle) => (
          <Chip
            label={getStatusLabel(row.status, t)}
            color={getStatusColor(row.status)}
            size="small"
            sx={{ fontWeight: 600, '& .MuiChip-label': { px: 1 } }}
          />
        ),
      },
      {
        id: 'distance',
        label: t('distance.totalDistance'),
        width: '11%',
        render: (row: Vehicle) => (
          <Typography variant="body2" color="text.secondary">
            {row.totalDistanceKm != null ? `${row.totalDistanceKm.toLocaleString()} km` : '—'}
          </Typography>
        ),
      },
      {
        id: 'trips',
        label: t('distance.trips'),
        width: '7%',
        render: (row: Vehicle) => (
          <Typography variant="body2" color="text.secondary">
            {row.trips != null ? row.trips : '—'}
          </Typography>
        ),
      },
      {
        id: 'oilChange',
        label: 'Last oil change',
        width: '11%',
        render: (row: Vehicle) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(row.lastOilChangeDate)}
          </Typography>
        ),
      },
      {
        id: 'regoPayment',
        label: 'Last rego payment',
        width: '11%',
        render: (row: Vehicle) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(row.lastRegoPaymentDate)}
          </Typography>
        ),
      },
      {
        id: 'regoExpiry',
        label: 'Rego expiry',
        width: '11%',
        render: (row: Vehicle) => (
          <Typography variant="body2" color="text.secondary">
            {formatDate(row.regoDueDate)}
          </Typography>
        ),
      },
      {
        id: 'price',
        label: t('fleet.pricePerDay', 'Price / day'),
        width: '8%',
        render: (row: Vehicle) => (
          <Typography variant="body2" color="text.secondary">
            {row.rentPricePerDay != null ? `$${row.rentPricePerDay}` : '—'}
          </Typography>
        ),
      },
      {
        id: 'actions',
        label: '',
        width: '7%',
        align: 'center' as const,
        render: (row: Vehicle) => (
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
    <DataTable<Vehicle>
      columns={columns}
      data={vehicles}
      getRowId={(row) => row.id}
      onRowClick={(row) => onView(row.id)}
      minWidth={1180}
      highlightId={highlightId}
    />
  );
}

export default FleetVehicleTable;
