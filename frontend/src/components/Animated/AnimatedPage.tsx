import React from 'react';
import { motion } from 'framer-motion';
import { pageVariants } from '../../lib/animations';

export interface AnimatedPageProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Wraps page content with page enter/exit animation.
 * Use when you need a standalone page animation (e.g. outside the route layout).
 */
const AnimatedPage: React.FC<AnimatedPageProps> = ({
  children,
  className,
  style,
}) => (
  <motion.div
    variants={pageVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    className={className}
    style={{
      height: '100%',
      minHeight: '100%',
      ...style,
    }}
  >
    {children}
  </motion.div>
);

export default AnimatedPage;
