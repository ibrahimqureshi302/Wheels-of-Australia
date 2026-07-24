import React from 'react';
import { Skeleton, Paper, Box } from '@mui/material';
import { motion } from 'framer-motion';
import { listVariants } from '../../../lib/animations';

const FleetSkeleton: React.FC = () => (
  <motion.div
    key="skeleton"
    variants={listVariants}
    initial="initial"
    animate="animate"
    exit="exit"
  >
    <Paper
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        border: '1px solid',
        borderColor: 'divider',
        overflow: 'hidden',
        boxShadow: (theme) =>
          theme.palette.mode === 'light' ? '0 2px 8px rgba(0,0,0,0.06)' : '0 2px 8px rgba(0,0,0,0.15)',
      }}
    >
      <Box sx={{ display: 'flex', p: 1.5, gap: 2, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="rounded" width={i === 1 ? 140 : 70} height={28} sx={{ borderRadius: 1 }} />
        ))}
      </Box>
      {[1, 2, 3, 4, 5].map((i) => (
        <Box key={i} sx={{ display: 'flex', p: 1.75, gap: 2, alignItems: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: 1.5 }} />
            <Box>
              <Skeleton variant="text" width={100} height={20} />
              <Skeleton variant="text" width={40} height={16} />
            </Box>
          </Box>
          <Skeleton variant="text" width={60} height={20} />
          <Skeleton variant="rounded" width={72} height={24} sx={{ borderRadius: 6 }} />
          <Skeleton variant="text" width={50} height={20} sx={{ ml: 'auto' }} />
          <Skeleton variant="text" width={24} height={20} />
        </Box>
      ))}
    </Paper>
  </motion.div>
);

export default FleetSkeleton;
