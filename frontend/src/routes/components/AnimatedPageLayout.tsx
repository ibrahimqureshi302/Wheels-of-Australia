import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Box } from '@mui/material';
import { pageVariants, reducedMotionVariants } from '../../lib/animations';
import { useReducedMotion } from '../../hooks';
import NavigationLoader from '../../components/Common/NavigationLoader';

/**
 * Wraps the current route outlet with enter/exit animations.
 * Shows an animated loader during route transitions to avoid a blank screen.
 * Respects prefers-reduced-motion (Phase G3).
 */
const AnimatedPageLayout: React.FC = () => {
  const location = useLocation();
  const outlet = useOutlet();
  const prefersReducedMotion = useReducedMotion();
  const variants = prefersReducedMotion ? reducedMotionVariants.pageVariants : pageVariants;
  const [showLoader, setShowLoader] = useState(false);
  const prevPathnameRef = useRef(location.pathname);
  const isFirstMountRef = useRef(true);

  useEffect(() => {
    if (isFirstMountRef.current) {
      isFirstMountRef.current = false;
      prevPathnameRef.current = location.pathname;
      return;
    }
    if (prevPathnameRef.current !== location.pathname) {
      setShowLoader(true);
      prevPathnameRef.current = location.pathname;
    }
  }, [location.pathname]);

  const currentPath = location.pathname;
  const handleAnimationComplete = () => {
    if (currentPath === location.pathname) setShowLoader(false);
  };

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100%',
        width: '100%',
        flex: 1,
      }}
    >
      <AnimatePresence mode="wait">
        {showLoader && (
          <motion.div
            key="nav-loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.33, 1, 0.68, 1] }}
          >
            <NavigationLoader />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentPath}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          onAnimationComplete={handleAnimationComplete}
          style={{
            height: '100%',
            minHeight: '100%',
            width: '100%',
            maxWidth: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflowX: 'hidden',
          }}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
    </Box>
  );
};

export default AnimatedPageLayout;
