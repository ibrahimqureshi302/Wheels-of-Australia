import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { InsertDriveFileOutlined, OpenInNew } from '@mui/icons-material';
import type { RegistrationDocument } from '../../../services/registrations/api';

/**
 * Shows an uploaded document as a single compact file row — an icon, the
 * document label and original filename, with an "Open" affordance. Clicking
 * anywhere on the row opens the file in a new tab (works for images, PDFs,
 * anything). No inline image preview, so every user's profile lists their
 * documents the same tidy way.
 */
const DocumentPreview: React.FC<{ doc: RegistrationDocument }> = ({ doc }) => {
  const hasFile = !!doc.file_url;
  return (
    <Box
      component={hasFile ? 'a' : 'div'}
      href={hasFile ? doc.file_url! : undefined}
      target={hasFile ? '_blank' : undefined}
      rel={hasFile ? 'noopener' : undefined}
      sx={{
        textDecoration: 'none',
        color: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        px: 1.5,
        py: 1.25,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        bgcolor: 'action.hover',
        cursor: hasFile ? 'pointer' : 'default',
        transition: 'background-color 0.15s, border-color 0.15s',
        ...(hasFile && {
          '&:hover': { bgcolor: 'action.selected', borderColor: 'primary.main' },
        }),
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
        <InsertDriveFileOutlined fontSize="small" color="action" />
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }} noWrap>
            {doc.doc_type_display}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
            {doc.original_name || (hasFile ? 'File' : 'No file attached')}
          </Typography>
        </Box>
      </Stack>
      {hasFile && (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: 'primary.main', flexShrink: 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 600 }}>
            Open
          </Typography>
          <OpenInNew sx={{ fontSize: 14 }} />
        </Stack>
      )}
    </Box>
  );
};

export default DocumentPreview;
