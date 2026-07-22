import React, { forwardRef } from 'react';
import { TextField, InputAdornment, IconButton, Box } from '@mui/material';
import { CalendarToday, Clear } from '@mui/icons-material';
import { format } from 'date-fns';
import ReactDatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import './datepicker-overrides.css';

export interface DatePickerProps {
  label?: string;
  value?: Date | null;
  onChange?: (date: Date | null) => void;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  clearable?: boolean;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  fullWidth?: boolean;
  size?: 'small' | 'medium';
  variant?: 'outlined' | 'filled' | 'standard';
  format?: string;
  /** When true, calendar is always visible below the input (no popover). Use inside modals to avoid clipping. */
  inline?: boolean;
}

const DatePicker: React.FC<DatePickerProps> = ({
  label,
  value,
  onChange,
  error = false,
  helperText,
  disabled = false,
  clearable = true,
  placeholder = 'Select date',
  minDate,
  maxDate,
  fullWidth = true,
  size = 'medium',
  variant = 'outlined',
  format: dateFormat = 'MM/dd/yyyy',
  inline = false,
}) => {
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.(null);
  };

  const CustomInput = forwardRef<
    HTMLInputElement,
    { value?: string; onClick?: () => void; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }
  >(({ value: inputValue, onClick, onChange: inputOnChange }, ref) => (
    <TextField
      fullWidth={fullWidth}
      size={size}
      variant={variant}
      label={label}
      error={error}
      helperText={helperText}
      placeholder={placeholder}
      value={inputValue ?? ''}
      onClick={onClick}
      onChange={inputOnChange}
      inputRef={ref}
      disabled={disabled}
      autoComplete="off"
      inputProps={{
        autoComplete: 'off',
        'data-form-type': 'other',
      }}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <CalendarToday fontSize="small" />
          </InputAdornment>
        ),
        endAdornment: (
          <InputAdornment position="end">
            {clearable && value != null && !disabled && (
              <IconButton size="small" onClick={handleClear} edge="end">
                <Clear fontSize="small" />
              </IconButton>
            )}
          </InputAdornment>
        ),
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 2,
        },
      }}
    />
  ));

  CustomInput.displayName = 'DatePickerCustomInput';

  /** Hidden input for inline mode so the library has a target; we show our own TextField above. */
  const HiddenInput = forwardRef<
    HTMLInputElement,
    { value?: string; onClick?: () => void; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void }
  >((props, ref) => (
    <input
      ref={ref}
      readOnly
      aria-hidden
      tabIndex={-1}
      {...props}
      style={{
        position: 'absolute',
        opacity: 0,
        width: 0,
        height: 0,
        pointerEvents: 'none',
      }}
    />
  ));
  HiddenInput.displayName = 'HiddenInput';

  const formattedValue = value ? format(value, dateFormat) : '';

  if (inline) {
    return (
      <Box sx={{ width: fullWidth ? '100%' : 'auto' }} className="datepicker-wrapper inline-calendar">
        <TextField
          fullWidth={fullWidth}
          size={size}
          variant={variant}
          label={label}
          error={error}
          helperText={helperText}
          placeholder={placeholder}
          value={formattedValue}
          disabled={disabled}
          InputProps={{
            readOnly: true,
            startAdornment: (
              <InputAdornment position="start">
                <CalendarToday fontSize="small" />
              </InputAdornment>
            ),
            endAdornment:
              clearable && value != null && !disabled ? (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleClear} edge="end">
                    <Clear fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ) : null,
          }}
          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
        />
        <ReactDatePicker
          selected={value ?? null}
          onChange={(date: Date | null) => onChange?.(date ?? null)}
          minDate={minDate}
          maxDate={maxDate}
          dateFormat={dateFormat}
          disabled={disabled}
          customInput={<HiddenInput />}
          inline
        />
      </Box>
    );
  }

  return (
    <Box sx={{ width: fullWidth ? '100%' : 'auto' }} className="datepicker-wrapper">
      <ReactDatePicker
        selected={value ?? null}
        onChange={(date: Date | null) => onChange?.(date ?? null)}
        minDate={minDate}
        maxDate={maxDate}
        dateFormat={dateFormat}
        placeholderText={placeholder}
        disabled={disabled}
        customInput={<CustomInput />}
        showPopperArrow={false}
        popperPlacement="top-start"
        popperClassName="react-datepicker-above-modal"
      />
    </Box>
  );
};

export default DatePicker;
