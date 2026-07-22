import React from 'react';
import {
  Breadcrumbs as MuiBreadcrumbs,
  Link,
  Typography,
  Box,
} from '@mui/material';
import type { BreadcrumbsProps as MuiBreadcrumbsProps } from '@mui/material/Breadcrumbs';
import { NavigateNext, Home } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export interface BreadcrumbsProps extends Omit<MuiBreadcrumbsProps, 'children'> {
  items: BreadcrumbItem[];
  showHome?: boolean;
  homeHref?: string;
  homeLabel?: string;
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({
  items,
  showHome = true,
  homeHref = '/',
  homeLabel = 'Home',
  maxItems = 8,
  ...props
}) => {
  const navigate = useNavigate();

  const handleClick = (item: BreadcrumbItem) => (event: React.MouseEvent) => {
    event.preventDefault();
    if (item.onClick) {
      item.onClick();
    } else if (item.href) {
      navigate(item.href);
    }
  };

  const homeItem: BreadcrumbItem = { label: homeLabel, href: homeHref, icon: <Home fontSize="small" /> };
  const allItems: BreadcrumbItem[] = showHome ? [homeItem, ...items] : items;

  return (
    <MuiBreadcrumbs
      {...props}
      maxItems={maxItems}
      separator={<NavigateNext fontSize="small" />}
      sx={{
        '& .MuiBreadcrumbs-separator': {
          mx: 1,
        },
        ...props.sx,
      }}
    >
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        const content = (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {item.icon}
            {item.label}
          </Box>
        );

        const href = 'href' in item ? item.href : undefined;
        const onClick = 'onClick' in item ? item.onClick : undefined;
        if (isLast || (!href && !onClick)) {
          return (
            <Typography
              key={index}
              color="text.primary"
              sx={{
                display: 'flex',
                alignItems: 'center',
                fontWeight: isLast ? 600 : 400,
              }}
            >
              {content}
            </Typography>
          );
        }

        return (
          <Link
            key={index}
            component="button"
            variant="body2"
            onClick={handleClick(item)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              textDecoration: 'none',
              color: 'text.secondary',
              cursor: 'pointer',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.main',
              },
              border: 'none',
              background: 'none',
              padding: 0,
              font: 'inherit',
            }}
          >
            {content}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
};

export default Breadcrumbs;
