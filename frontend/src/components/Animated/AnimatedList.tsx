import React from 'react';
import { motion } from 'framer-motion';
import { listVariants, listItemVariants } from '../../lib/animations';

export interface AnimatedListProps {
  children: React.ReactNode;
  component?: 'ul' | 'ol';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * List container with stagger animation. Use with AnimatedListItem for each child.
 */
const AnimatedList: React.FC<AnimatedListProps> = ({
  children,
  component: Component = 'ul',
  className,
  style,
}) => {
  const MotionList = Component === 'ol' ? motion.ol : motion.ul;
  return (
    <MotionList
      variants={listVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
      style={style}
    >
      {children}
    </MotionList>
  );
};

export interface AnimatedListItemProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Single list item with enter/exit animation. Use inside AnimatedList.
 */
export const AnimatedListItem: React.FC<AnimatedListItemProps> = ({
  children,
  className,
  style,
}) => (
  <motion.li variants={listItemVariants} className={className} style={style}>
    {children}
  </motion.li>
);

export default AnimatedList;
