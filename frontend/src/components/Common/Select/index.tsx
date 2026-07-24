import React from 'react';
import {
  FormControl,
  InputLabel,
  Select as MuiSelect,
  MenuItem,
  FormHelperText,
  Chip,
  Box,
  Checkbox,
  ListItemText,
  CircularProgress,
  InputAdornment,
} from '@mui/material';
import type { SelectProps as MuiSelectProps } from '@mui/material/Select';
import { ExpandMore } from '@mui/icons-material';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
  icon?: React.ReactNode;
}

export interface SelectProps extends Omit<MuiSelectProps, 'value' | 'onChange'> {
  label?: string;
  options: SelectOption[];
  value?: string | number | (string | number)[];
  onChange?: (value: string | number | (string | number)[]) => void;
  helperText?: string;
  loading?: boolean;
  searchable?: boolean;
  clearable?: boolean;
  placeholder?: string;
  startIcon?: React.ReactNode;
}

const Select: React.FC<SelectProps> = ({
  label,
  options = [],
  value,
  onChange,
  helperText,
  error,
  loading = false,
  multiple = false,
  placeholder,
  startIcon,
  fullWidth = true,
  variant = 'outlined',
  size = 'medium',
  ...props
}) => {
  const [searchTerm] = React.useState('');

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(option =>
      option.label.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [options, searchTerm]);

  const handleChange = (event: any) => {
    const selectedValue = event.target.value;
    onChange?.(selectedValue);
  };

  const renderValue = (selected: any) => {
    if (!selected || (Array.isArray(selected) && selected.length === 0)) {
      return <span style={{ color: '#999' }}>{placeholder || 'Select...'}</span>;
    }

    if (multiple && Array.isArray(selected)) {
      return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {selected.map((val) => {
            const option = options.find(opt => opt.value === val);
            return (
              <Chip
                key={val}
                label={option?.label || val}
                size="small"
                variant="outlined"
                sx={{ height: 24 }}
              />
            );
          })}
        </Box>
      );
    }

    const option = options.find(opt => opt.value === selected);
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {option?.icon}
        {option?.label || selected}
      </Box>
    );
  };

  return (
    <FormControl fullWidth={fullWidth} error={error} variant={variant} size={size}>
      {label && <InputLabel>{label}</InputLabel>}
      <MuiSelect
        {...props}
        value={value || (multiple ? [] : '')}
        onChange={handleChange}
        multiple={multiple}
        renderValue={renderValue}
        IconComponent={loading ? () => (
          <CircularProgress size={20} sx={{ mr: 2 }} />
        ) : ExpandMore}
        startAdornment={startIcon ? (
          <InputAdornment position="start">{startIcon}</InputAdornment>
        ) : undefined}
        sx={{
          borderRadius: 2,
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
          },
          ...props.sx,
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              maxHeight: 300,
              borderRadius: 2,
              mt: 1,
              '& .MuiMenuItem-root': {
                borderRadius: 1,
                mx: 1,
                my: 0.5,
              },
            },
          },
        }}
      >
        {filteredOptions.map((option) => (
          <MenuItem
            key={option.value}
            value={option.value}
            disabled={option.disabled}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            {multiple && (
              <Checkbox
                checked={Array.isArray(value) && value.includes(option.value)}
                size="small"
              />
            )}
            {option.icon}
            <ListItemText primary={option.label} />
          </MenuItem>
        ))}
        {filteredOptions.length === 0 && (
          <MenuItem disabled>
            <ListItemText primary="No options available" />
          </MenuItem>
        )}
      </MuiSelect>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
};

export default Select;
