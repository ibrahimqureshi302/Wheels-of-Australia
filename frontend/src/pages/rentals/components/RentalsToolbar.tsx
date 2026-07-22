import React from 'react';
import { Box, Button, TextField, InputAdornment, MenuItem, Select, FormControl, InputLabel } from '@mui/material';
import { Add, Search } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import type { RentalStatus } from '../../../services/rentals/types';

export type StatusFilter = 'all' | RentalStatus;

export interface RentalsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (value: StatusFilter) => void;
  onAddRental: () => void;
}

const RentalsToolbar: React.FC<RentalsToolbarProps> = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onAddRental,
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
          placeholder={t('rentals.searchPlaceholder')}
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
            minWidth: 140,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: 'action.hover' },
              '&.Mui-focused': { bgcolor: 'background.paper' },
            },
          }}
        >
          <InputLabel id="rentals-status-filter">{t('rentals.status')}</InputLabel>
          <Select
            labelId="rentals-status-filter"
            value={statusFilter}
            label={t('rentals.status')}
            onChange={(e) => onStatusFilterChange(e.target.value as StatusFilter)}
          >
            <MenuItem value="all">{t('rentals.filterAll')}</MenuItem>
            <MenuItem value="active">{t('rentals.filterActive')}</MenuItem>
            <MenuItem value="inactive">{t('rentals.filterInactive')}</MenuItem>
          </Select>
        </FormControl>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onAddRental}
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
          {t('rentals.addRental')}
        </Button>
      </Box>
    </Box>
  );
};

export default RentalsToolbar;
