import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { motion } from 'framer-motion';

/**
 * Full-screen navigation loader with branded animation.
 * Centered content: app name, animated rings + dots, and loading text.
 */
const NavigationLoader: React.FC = () => {
  const theme = useTheme();
  const primary = theme.palette.primary.main;
  const isDark = theme.palette.mode === 'dark';

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${primary}08 50%, ${theme.palette.background.default} 100%)`
          : `linear-gradient(180deg, ${theme.palette.background.default} 0%, ${primary}06 50%, ${theme.palette.background.default} 100%)`,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          px: 4,
          py: 5,
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              color: 'text.primary',
              letterSpacing: '-0.02em',
            }}
          >
            Wheels of Australia
          </Typography>
        </motion.div>

        {/* Animated rings */}
        <Box sx={{ position: 'relative', width: 88, height: 88 }}>
          <motion.div
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              border: `3px solid ${theme.palette.primary.light}40`,
            }}
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            style={{
              position: 'absolute',
              inset: 8,
              borderRadius: '50%',
              border: `3px solid ${primary}`,
              borderTopColor: 'transparent',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
          <motion.div
            style={{
              position: 'absolute',
              inset: 20,
              borderRadius: '50%',
              border: `2px solid ${theme.palette.primary.dark}60`,
              borderBottomColor: 'transparent',
            }}
            animate={{ rotate: -360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          />
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <motion.div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: primary,
                boxShadow: `0 0 20px ${primary}80`,
              }}
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </Box>
        </Box>

        {/* Loading text with animated dots */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="body2"
            component="span"
            sx={{
              color: 'text.secondary',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 0.25,
            }}
          >
            Loading
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{
                  duration: 0.8,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              >
                .
              </motion.span>
            ))}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default NavigationLoader;
