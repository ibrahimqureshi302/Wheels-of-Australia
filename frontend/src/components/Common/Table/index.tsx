import React from 'react';
import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import type { SxProps, Theme } from '@mui/system';
import { highlightSx, highlightAttrProps } from '../../Notifications/recordHighlight';

export interface DataTableColumn<T> {
  id: string;
  label: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowId: (row: T) => string;
  onRowClick?: (row: T) => void;
  size?: 'small' | 'medium';
  minWidth?: number;
  stickyHeader?: boolean;
  rowSx?: (row: T) => SxProps<Theme> | undefined;
  containerSx?: SxProps<Theme>;
  /** Row id (from getRowId) to briefly flash — e.g. when opened from a notification. */
  highlightId?: string | null;
}

function DataTableInner<T>({
  columns,
  data,
  getRowId,
  onRowClick,
  size = 'medium',
  minWidth = 640,
  stickyHeader = false,
  rowSx,
  containerSx,
  highlightId,
}: DataTableProps<T>) {
  return (
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        boxShadow: (theme: Theme) =>
          theme.palette.mode === 'light'
            ? '0 2px 8px rgba(0,0,0,0.06)'
            : '0 2px 8px rgba(0,0,0,0.15)',
        overflowX: 'auto',
        overflowY: 'hidden',
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { height: 0 },
        '&::-webkit-scrollbar-track': { display: 'none' },
        '&::-webkit-scrollbar-thumb': { display: 'none' },
        ...containerSx,
      }}
    >
      <MuiTable size={size} sx={{ minWidth }} stickyHeader={stickyHeader}>
        <TableHead>
          <TableRow
            sx={{
              bgcolor: 'action.hover',
              '& th': {
                borderBottom: '1px solid',
                borderColor: 'divider',
                fontWeight: 600,
                py: 1.5,
              },
            }}
          >
            {columns.map((col) => (
              <TableCell
                key={col.id}
                align={col.align ?? 'left'}
                sx={col.width ? { width: col.width } : undefined}
              >
                {col.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row) => {
            const isHl = highlightId != null && getRowId(row) === highlightId;
            return (
            <TableRow
              key={getRowId(row)}
              hover={Boolean(onRowClick)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              {...highlightAttrProps(isHl)}
              sx={{
                cursor: onRowClick ? 'pointer' : undefined,
                transition: 'background-color 0.15s ease',
                '&:last-child td': { borderBottom: 0 },
                '& td': { py: 1.75, borderColor: 'divider' },
                ...(rowSx?.(row) ?? {}),
                ...(isHl ? (highlightSx as object) : {}),
              }}
            >
              {columns.map((col) => (
                <TableCell key={col.id} align={col.align ?? 'left'} sx={col.width ? { width: col.width } : undefined}>
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
            );
          })}
        </TableBody>
      </MuiTable>
    </TableContainer>
  );
}

const DataTable = DataTableInner as <T>(props: DataTableProps<T>) => React.ReactElement;

export default DataTable;
