import React from 'react';
import { Autocomplete, TextField } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { InsuranceType } from '../../../services/rental/types';

/**
 * Insurance picker that lets the user either choose one of the four predefined
 * Australian cover types OR type a custom insurance provider by hand (free solo).
 *
 * A predefined choice is stored as its short code (e.g. `comprehensive`) so the
 * label stays translatable; anything typed is stored verbatim as free text.
 */

interface Option {
  /** Stored value: a predefined code. */
  value: InsuranceType;
  /** Translated, human-readable label shown in the dropdown. */
  label: string;
}

const PREDEFINED: { value: InsuranceType; labelKey: string }[] = [
  { value: 'ctp', labelKey: 'fleet.insuranceCtp' },
  { value: 'third_party_property', labelKey: 'fleet.insuranceThirdPartyProperty' },
  { value: 'third_party_fire_theft', labelKey: 'fleet.insuranceThirdPartyFireTheft' },
  { value: 'comprehensive', labelKey: 'fleet.insuranceComprehensive' },
];

interface Props {
  /** Current stored value (a predefined code or a custom string). */
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  label?: string;
  required?: boolean;
}

const InsuranceField: React.FC<Props> = ({ value, onChange, error, label, required = true }) => {
  const { t } = useTranslation();
  const options: Option[] = PREDEFINED.map((o) => ({ value: o.value, label: t(o.labelKey) }));

  // Show the matching option object when the stored value is a known code,
  // otherwise keep the raw custom string as the value.
  const selected: Option | string | null =
    options.find((o) => o.value === value) ?? (value || null);

  return (
    <Autocomplete<Option, false, false, true>
      freeSolo
      options={options}
      value={selected}
      getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label)}
      isOptionEqualToValue={(opt, val) =>
        (typeof opt === 'string' ? opt : opt.value) === (typeof val === 'string' ? val : val.value)
      }
      onChange={(_e, newValue) => {
        if (newValue == null) onChange('');
        else if (typeof newValue === 'string') onChange(newValue.trim());
        else onChange(newValue.value);
      }}
      onInputChange={(_e, inputValue, reason) => {
        // Keep custom free text in sync while typing. Selecting an option fires
        // a 'reset' (handled by onChange above), which we must ignore here so it
        // doesn't overwrite the stored code with the label text.
        if (reason === 'input') onChange(inputValue);
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          fullWidth
          required={required}
          error={error}
          label={label ?? t('fleet.insuranceType')}
          placeholder={t('fleet.insurancePlaceholder', 'Select or type a provider')}
        />
      )}
    />
  );
};

export default InsuranceField;
