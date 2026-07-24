import React from 'react';
import {
  Pagination as MuiPagination,
  Box,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PaginationProps as MuiPaginationProps } from '@mui/material/Pagination';

export interface PaginationProps extends Omit<MuiPaginationProps, 'onChange'> {
  currentPage: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  showPageSizeSelector?: boolean;
  showInfo?: boolean;
  onChange: (page: number, pageSize?: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

export const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  totalItems,
  pageSize = 10,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  showPageSizeSelector = true,
  showInfo = true,
  onChange,
  onPageSizeChange,
  variant = 'outlined',
  shape = 'rounded',
  color = 'primary',
  size = 'medium',
  ...props
}) => {
  const { t } = useTranslation();
  const handlePageChange = (_event: React.ChangeEvent<unknown>, page: number) => {
    onChange(page, pageSize);
  };

  const handlePageSizeChange = (event: { target: { value: unknown } }) => {
    const newPageSize = Number(event.target.value);
    onPageSizeChange?.(newPageSize);
    onChange(1, newPageSize);
  };

  const startItem = totalItems ? (currentPage - 1) * pageSize + 1 : 0;
  const endItem = totalItems ? Math.min(currentPage * pageSize, totalItems) : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        py: 2.5,
        px: { xs: 2, sm: 3 },
        borderRadius: 2,
      
      }}
    >
      {totalPages > 1 && (
        <MuiPagination
          {...props}
          count={totalPages}
          page={currentPage}
          onChange={handlePageChange}
          variant={variant}
          shape={shape}
          color={color}
          size={size}
          showFirstButton
          showLastButton
          sx={{
            '& .MuiPagination-ul': { gap: 0.5 },
            '& .MuiPaginationItem-root': {
              minWidth: 36,
              height: 36,
              borderRadius: 1.5,
              fontWeight: 500,
              border: '1px solid',
              borderColor: 'divider',
              transition: 'all 0.2s ease',
              '&:hover': {
                bgcolor: 'action.hover',
                borderColor: 'primary.main',
                color: 'primary.main',
              },
              '&.Mui-selected': {
                fontWeight: 600,
                borderColor: 'primary.main',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  bgcolor: 'primary.dark',
                  borderColor: 'primary.dark',
                },
              },
              '&.Mui-disabled': {
                borderColor: 'divider',
                opacity: 0.6,
              },
            },
            ...props.sx,
          }}
        />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', ml: 'auto' }}>
        {showInfo && totalItems !== undefined && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              fontWeight: 500,
              letterSpacing: '0.01em',
            }}
          >
            {t('common.showingItems', { start: startItem, end: endItem, total: totalItems })}
          </Typography>
        )}
        {showPageSizeSelector && onPageSizeChange && (
          <FormControl
            size="small"
            sx={{
              minWidth: 112,
              '& .MuiOutlinedInput-root': {
                borderRadius: 1.5,
                bgcolor: 'action.hover',
                fontWeight: 500,
                '&:hover': { bgcolor: 'action.selected' },
                '&.Mui-focused': { bgcolor: 'background.paper' },
              },
              '& .MuiSelect-select': { py: 1.25, px: 1.5 },
            }}
          >
            <InputLabel id="pagination-rows-per-page">{t('common.rowsPerPage')}</InputLabel>
            <Select
              labelId="pagination-rows-per-page"
              value={pageSize}
              onChange={handlePageSizeChange}
              label={t('common.rowsPerPage')}
            >
              {pageSizeOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </Box>
    </Box>
  );
};

export default Pagination;
