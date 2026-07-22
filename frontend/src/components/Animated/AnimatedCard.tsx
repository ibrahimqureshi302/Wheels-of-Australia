import React from 'react';
import { motion } from 'framer-motion';
import {
  Card as MuiCard,
  CardContent,
  CardActions,
  CardHeader,
  Typography,
} from '@mui/material';
import type { BaseComponentProps } from '../../types';
import { cardVariants } from '../../lib/animations';

//Testing
export interface AnimatedCardProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  elevation?: number;
}

const AnimatedCard: React.FC<AnimatedCardProps> = ({
  title,
  subtitle,
  children,
  actions,
  elevation = 2,
  className,
}) => (
  <motion.div
    variants={cardVariants}
    initial="initial"
    animate="animate"
    exit="exit"
    className={className}
  >
    <MuiCard elevation={elevation}>
      {(title || subtitle) && (
        <CardHeader
          title={title && <Typography variant="h6">{title}</Typography>}
          subheader={
            subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )
          }
        />
      )}
      <CardContent>{children}</CardContent>
      {actions && <CardActions>{actions}</CardActions>}
    </MuiCard>
  </motion.div>
);

export default AnimatedCard;
