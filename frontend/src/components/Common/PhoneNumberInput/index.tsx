import React from 'react';
import {
  TextField,
  InputAdornment,
  Select,
  MenuItem,
  Box,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { Phone } from '@mui/icons-material';
import {
  COUNTRY_CODES,
  dialCodeFor,
  flagEmoji,
} from '../../../constants/countryCodes';

/** Allowed length of the local phone number (digits only, no country code). */
export const PHONE_MIN_DIGITS = 8;
export const PHONE_MAX_DIGITS = 11;
export const PHONE_LENGTH_ERROR = `Enter ${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits (without the country code).`;

/** True when the number has between PHONE_MIN_DIGITS and PHONE_MAX_DIGITS digits. */
export function isValidPhoneNumber(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
}

/**
 * Keep only digits, drop a leading "+" and (if the user re-typed it) the
 * country dial code, then cap at PHONE_MAX_DIGITS. The dial code is already
 * shown beside the field, so "+92 300…" becomes just "300…".
 */
function sanitizePhone(raw: string, dial: string): string {
  const hadPlus = raw.trimStart().startsWith('+');
  let digits = raw.replace(/\D/g, '');
  const dialDigits = dial.replace(/\D/g, '');
  if (hadPlus && dialDigits && digits.startsWith(dialDigits)) {
    digits = digits.slice(dialDigits.length);
  }
  return digits.slice(0, PHONE_MAX_DIGITS);
}

export interface PhoneNumberInputProps {
  /** Selected country's ISO alpha-2 code (e.g. "AU"). */
  countryIso: string;
  /** Called with the new ISO code when the user picks a different country. */
  onCountryChange: (iso: string) => void;
  /** The local phone number (without the dial code). */
  phone: string;
  /** Change handler for the phone text field (receives the standard event). */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** `name` of the phone field, so a shared form handler can read it. */
  name?: string;
  label?: string;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  placeholder?: string;
  sx?: object;
}

/**
 * A phone-number field with a country-code dropdown attached to its left.
 * The dropdown lists every country (flag + name + dial code); the chosen
 * country's dial code (e.g. "+61") is shown beside the flag in the field.
 *
 * The component is controlled: the parent owns both `countryIso` and `phone`.
 * To build the full number for submission, prepend `dialCodeFor(countryIso)`.
 */
const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
  countryIso,
  onCountryChange,
  phone,
  onChange,
  name = 'phone',
  label = 'Phone number',
  required = false,
  error = false,
  helperText,
  placeholder = 'e.g. 412 345 678',
  sx,
}) => {
  const handleCountry = (e: SelectChangeEvent) => onCountryChange(e.target.value);

  // Strip any "+"/country code the user types and keep digits only, then hand
  // the cleaned value back through the parent's standard change handler.
  const handlePhone = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = sanitizePhone(e.target.value, dialCodeFor(countryIso));
    onChange(e);
  };

  const hint = `${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits, without the country code`;

  return (
    <TextField
      fullWidth
      type="tel"
      name={name}
      label={label}
      value={phone}
      onChange={handlePhone}
      required={required}
      error={error}
      helperText={helperText || hint}
      placeholder={placeholder}
      inputProps={{ inputMode: 'tel', autoComplete: 'tel' }}
      sx={sx}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start" sx={{ mr: 1 }}>
            <Phone color="action" sx={{ mr: 0.5 }} />
            <Select
              value={countryIso}
              onChange={handleCountry}
              variant="standard"
              disableUnderline
              // Show only the flag + dial code in the field; full names in the menu.
              renderValue={(iso) => (
                <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{flagEmoji(iso)}</span>
                  <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                    {dialCodeFor(iso)}
                  </Typography>
                </Box>
              )}
              MenuProps={{ PaperProps: { sx: { maxHeight: 320 } } }}
              sx={{
                '& .MuiSelect-select': { display: 'flex', alignItems: 'center', py: 0, pr: '20px !important' },
              }}
            >
              {COUNTRY_CODES.map((c) => (
                <MenuItem key={c.iso} value={c.iso}>
                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                    <span style={{ fontSize: '1.15rem', lineHeight: 1 }}>{flagEmoji(c.iso)}</span>
                    <Typography variant="body2" component="span" sx={{ flex: 1 }}>
                      {c.name}
                    </Typography>
                    <Typography variant="body2" component="span" color="text.secondary">
                      {c.dial}
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </InputAdornment>
        ),
      }}
    />
  );
};

export default PhoneNumberInput;
