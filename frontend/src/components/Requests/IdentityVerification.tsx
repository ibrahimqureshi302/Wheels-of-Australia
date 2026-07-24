import React from 'react';
import { Box, Typography, Button, TextField, Checkbox, FormControlLabel, Stack, Chip, CircularProgress, Alert } from '@mui/material';
import { CloudUpload, CheckCircle } from '@mui/icons-material';
import { useAuth } from '../../context/hooks';
import {
  ID_DOC_LABELS,
  fileToDataUrl,
  readDocument,
  type IdDocType,
  type IdDocument,
  type VerifiedDetails,
} from '../../services/ocr';

export interface VerificationResult {
  documents: IdDocument[];
  details: VerifiedDetails;
  confirmed: boolean;
}

export function emptyVerification(): VerificationResult {
  return { documents: [], details: { fullName: '', dateOfBirth: '', documentNumber: '', expiryDate: '' }, confirmed: false };
}

/** True when at least one document is uploaded and the details are confirmed. */
export function isVerificationComplete(v: VerificationResult): boolean {
  return v.documents.length > 0 && v.confirmed;
}

const DOC_TYPES: IdDocType[] = ['passport', 'cnic', 'licence'];

interface Props {
  value: VerificationResult;
  onChange: (next: VerificationResult) => void;
  /** Heading copy override. */
  title?: string;
}

/**
 * Identity-verification step shown before submitting a request: upload at least
 * one of passport / CNIC / driving licence, OCR reads the details off the document for
 * the user to check, and they confirm the details are accurate.
 */
const IdentityVerification: React.FC<Props> = ({ value, onChange, title }) => {
  const { user } = useAuth();
  const fallbackName = (user?.full_name || '').trim();
  const [reading, setReading] = React.useState(false);
  const [warning, setWarning] = React.useState('');

  const handleFile = async (docType: IdDocType, file: File | undefined) => {
    if (!file) return;
    const image = await fileToDataUrl(file);
    const doc: IdDocument = { docType, name: file.name, image };
    // Only one document at a time: a new upload replaces any previous one and
    // resets the details so they reflect the document currently shown.
    const documents: IdDocument[] = [doc];
    onChange({ documents, details: value.details, confirmed: false });

    // Read the document with OCR and fill the detail fields from it.
    setReading(true);
    setWarning('');
    try {
      const read = await readDocument(file, docType, fallbackName);
      onChange({ documents, details: read.details, confirmed: false });
      if (read.error) {
        setWarning(
          "We couldn't read this document automatically just now. " +
            'Please enter the details below by hand (or try uploading the photo again).',
        );
      } else if (read.checked && !read.looksLikeId) {
        setWarning(
          `This file doesn't look like a ${ID_DOC_LABELS[docType].toLowerCase()} (or any ID document). ` +
            'Please double-check you uploaded the right photo — a clear, well-lit scan works best.',
        );
      } else if (read.checked && read.detectedType && read.detectedType !== docType) {
        // Gemini recognised the document, but as a different type than the slot
        // the user uploaded it under — flag the mismatch so they can fix it.
        setWarning(
          `This looks like a ${ID_DOC_LABELS[read.detectedType].toLowerCase()}, not a ` +
            `${ID_DOC_LABELS[docType].toLowerCase()}. Please upload it under the correct document type.`,
        );
      }
    } finally {
      setReading(false);
    }
  };

  const setDetail = (field: keyof VerifiedDetails, v: string) => {
    onChange({ ...value, details: { ...value.details, [field]: v }, confirmed: false });
  };

  const hasDocs = value.documents.length > 0;

  // The user may only confirm once OCR has finished reading AND the essential
  // identity fields are actually populated (by OCR or typed in by hand). This
  // stops a request being submitted while "Reading your document…" is still in
  // flight, or with empty details — the confirm checkbox (and therefore the
  // dialog's Submit button, which gates on `confirmed`) stays disabled until then.
  const detailsFilled =
    value.details.fullName.trim() !== '' && value.details.documentNumber.trim() !== '';
  const canConfirm = hasDocs && !reading && detailsFilled;

  return (
    <Box>
      <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
        {title || 'Verify your identity'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Upload at least one document (passport, CNIC or driving licence). We'll read the details for you to confirm.
      </Typography>

      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        {DOC_TYPES.map((dt) => {
          const existing = value.documents.find((d) => d.docType === dt);
          return (
            <Button
              key={dt}
              component="label"
              variant={existing ? 'outlined' : 'contained'}
              color={existing ? 'success' : 'primary'}
              startIcon={existing ? <CheckCircle /> : <CloudUpload />}
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              {existing ? `${ID_DOC_LABELS[dt]} ✓` : `Upload ${ID_DOC_LABELS[dt]}`}
              <input
                hidden
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => handleFile(dt, e.target.files?.[0])}
              />
            </Button>
          );
        })}
      </Stack>

      {hasDocs && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
          {value.documents.map((d) => (
            <Chip key={d.docType} label={`${ID_DOC_LABELS[d.docType]}: ${d.name}`} size="small" />
          ))}
        </Stack>
      )}

      {reading && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <CircularProgress size={16} />
          <Typography variant="body2" color="text.secondary">
            Reading your document…
          </Typography>
        </Stack>
      )}

      {!reading && warning && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setWarning('')}>
          {warning}
        </Alert>
      )}

      {hasDocs && (
        <>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Details we read — please check and correct if needed:
          </Typography>
          <Stack spacing={2} sx={{ mb: 1 }}>
            <TextField
              fullWidth size="small" label="Full name"
              value={value.details.fullName}
              onChange={(e) => setDetail('fullName', e.target.value)}
            />
            <TextField
              fullWidth size="small" type="date" label="Date of birth"
              InputLabelProps={{ shrink: true }}
              value={value.details.dateOfBirth}
              onChange={(e) => setDetail('dateOfBirth', e.target.value)}
            />
            <TextField
              fullWidth size="small" label="Document / CNIC number"
              value={value.details.documentNumber}
              onChange={(e) => setDetail('documentNumber', e.target.value)}
            />
            <TextField
              fullWidth size="small" type="date" label="Expiry date"
              InputLabelProps={{ shrink: true }}
              value={value.details.expiryDate}
              onChange={(e) => setDetail('expiryDate', e.target.value)}
            />
          </Stack>
          <FormControlLabel
            control={
              <Checkbox
                checked={value.confirmed}
                disabled={!canConfirm}
                onChange={(e) => onChange({ ...value, confirmed: e.target.checked })}
              />
            }
            label="I confirm the above details are accurate."
          />
          {!canConfirm && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              {reading
                ? 'Please wait while we read your document…'
                : 'Enter your full name and document number above before confirming.'}
            </Typography>
          )}
        </>
      )}
    </Box>
  );
};

export default IdentityVerification;
