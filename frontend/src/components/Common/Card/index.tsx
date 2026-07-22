import React from 'react';
import {
  Card as MuiCard,
  CardContent,
  CardActions,
  CardHeader,
  Typography,
} from '@mui/material';
import type { BaseComponentProps } from '../../../types';

interface CardProps extends BaseComponentProps {
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  elevation?: number;
}

const Card: React.FC<CardProps> = ({
  title,
  subtitle,
  children,
  actions,
  elevation = 2,
  className,
}) => {
  return (
    <MuiCard elevation={elevation} className={className}>
      {(title || subtitle) && (
        <CardHeader
          title={title && <Typography variant="h6">{title}</Typography>}
          subheader={subtitle && <Typography variant="body2" color="textSecondary">{subtitle}</Typography>}
        />
      )}
      <CardContent>
        {children}
      </CardContent>
      {actions && (
        <CardActions>
          {actions}
        </CardActions>
      )}
    </MuiCard>
  );
};

export default Card;
