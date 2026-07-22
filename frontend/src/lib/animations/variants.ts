import type { Variants } from 'framer-motion';
import { TRANSITION, EASING } from './constants';

/** Page enter/exit for route changes */
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    y: 8,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: TRANSITION.page.duration,
      ease: EASING.easeOut,
    },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: {
      duration: TRANSITION.page.duration * 0.8,
      ease: EASING.easeInOut,
    },
  },
};

/** Card: fade + slight scale */
export const cardVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.98,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: TRANSITION.normal.duration,
      ease: EASING.easeOut,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.98,
    transition: { duration: TRANSITION.fast.duration },
  },
};

/** List item: stagger children with delay */
export const listVariants: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
  exit: {},
};

export const listItemVariants: Variants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: TRANSITION.normal.duration,
      ease: EASING.easeOut,
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    transition: { duration: TRANSITION.fast.duration },
  },
};

/** Modal/drawer: fade + scale from center */
export const modalVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.96,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: TRANSITION.normal.duration,
      ease: EASING.easeOutBack,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { duration: TRANSITION.fast.duration },
  },
};

/** Backdrop for modal */
export const backdropVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: TRANSITION.normal.duration } },
  exit: { opacity: 0, transition: { duration: TRANSITION.fast.duration } },
};

/** Fade only (simple) */
export const fadeVariants: Variants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: TRANSITION.normal.duration, ease: EASING.easeOut },
  },
  exit: {
    opacity: 0,
    transition: { duration: TRANSITION.fast.duration },
  },
};

/** Slide up (e.g. toast, snackbar) */
export const slideUpVariants: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: TRANSITION.normal.duration, ease: EASING.easeOut },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: TRANSITION.fast.duration },
  },
};

/** When prefers-reduced-motion: reduce – no movement, minimal duration (Phase G3) */
export const reducedMotionVariants = {
  pageVariants: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.01 } },
    exit: { opacity: 0, transition: { duration: 0.01 } },
  },
  cardVariants: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.01 } },
    exit: { opacity: 0, transition: { duration: 0.01 } },
  },
  listVariants: { initial: {}, animate: { transition: { staggerChildren: 0, delayChildren: 0 } }, exit: {} },
  listItemVariants: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.01 } },
    exit: { opacity: 0, transition: { duration: 0.01 } },
  },
  fadeVariants: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: 0.01 } },
    exit: { opacity: 0, transition: { duration: 0.01 } },
  },
} as const;

export { TRANSITION, EASING };
