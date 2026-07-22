import React from 'react';
import { Box, Button, TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { Vehicle } from '../../../services/rental/types';

export type StatusFilter = 'all' | Vehicle['status'];

export interface FleetToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  onAddVehicle: () => void;
}

const FleetToolbar: React.FC<FleetToolbarProps> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onAddVehicle,
}) => {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 2,
        mb: 3,
      }}
    >
      <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
        <TextField
          size="small"
          placeholder={t('fleet.searchPlaceholder')}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            minWidth: 240,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-focused': { bgcolor: 'background.paper' },
            },
          }}
        />
        <FormControl
          size="small"
          sx={{
            minWidth: 150,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-focused': { bgcolor: 'background.paper' },
            },
          }}
        >
          <InputLabel id="fleet-status-filter">{t('fleet.status')}</InputLabel>
          <Select
            labelId="fleet-status-filter"
            value={statusFilter}
            label={t('fleet.status')}
            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          >
            <MenuItem value="all">{t('fleet.filterAll')}</MenuItem>
            <MenuItem value="available">{t('fleet.filterAvailable')}</MenuItem>
            <MenuItem value="rented">{t('fleet.filterRented')}</MenuItem>
            <MenuItem value="pending_return">{t('fleet.filterPendingReturn', 'Pending return')}</MenuItem>
            <MenuItem value="maintenance">{t('fleet.filterMaintenance')}</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onAddVehicle}
          sx={{
            borderRadius: 2,
            px: 2.5,
            py: 1.25,
            fontWeight: 600,
            textTransform: 'none',
            boxShadow: (theme) =>
              theme.palette.mode === 'light' ? '0 2px 8px rgba(0,0,0,0.12)' : '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          {t('fleet.addVehicle')}
        </Button>
      </Box>
    </Box>
  );
};

export default FleetToolbar;
