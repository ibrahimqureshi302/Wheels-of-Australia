import React from 'react';
import { Container as MuiContainer } from '@mui/material';
import type { ContainerProps as MuiContainerProps } from '@mui/material/Container';

export interface ContainerProps extends MuiContainerProps {
  centered?: boolean;
  minHeight?: string | number;
  padding?: number | string;
  background?: string;
  shadow?: boolean;
  rounded?: boolean;
}

const Container: React.FC<ContainerProps> = ({
  centered = false,
  minHeight,
  padding,
  background,
  shadow = false,
  rounded = false,
  children,
  maxWidth = 'lg',
  ...props
}) => {
  return (
    <MuiContainer
      {...props}
      maxWidth={maxWidth}
      sx={{
        display: centered ? 'flex' : 'block',
        flexDirection: centered ? 'column' : undefined,
        justifyContent: centered ? 'center' : undefined,
        alignItems: centered ? 'center' : undefined,
        minHeight: minHeight || (centered ? '100vh' : undefined),
        padding: padding,
        backgroundColor: background,
        borderRadius: rounded ? 2 : 0,
        boxShadow: shadow ? '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' : 'none',
        ...props.sx,
      }}
    >
      {children}
    </MuiContainer>
  );
};

export default Container;
