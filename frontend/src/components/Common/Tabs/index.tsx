import React from 'react';
import {
  Tabs as MuiTabs,
  Tab as MuiTab,
  Badge,
} from '@mui/material';
import type { TabsProps as MuiTabsProps } from '@mui/material/Tabs';

export interface TabItem {
  label: string;
  value: string | number;
  icon?: React.ReactElement;
  disabled?: boolean;
  badge?: number | string;
  badgeColor?: 'primary' | 'secondary' | 'error' | 'warning' | 'info' | 'success';
}

export interface TabsProps extends Omit<MuiTabsProps, 'value' | 'onChange'> {
  tabs: TabItem[];
  value: string | number;
  onChange: (value: string | number) => void;
  fullWidth?: boolean;
  centered?: boolean;
  scrollable?: boolean;
}

const Tabs: React.FC<TabsProps> = ({
  tabs,
  value,
  onChange,
  fullWidth = false,
  centered = false,
  scrollable = false,
  variant = 'standard',
  orientation = 'horizontal',
  ...props
}) => {
  const handleChange = (_event: React.SyntheticEvent, newValue: string | number) => {
    onChange(newValue);
  };

  return (
    <MuiTabs
      {...props}
      value={value}
      onChange={handleChange}
      variant={scrollable ? 'scrollable' : fullWidth ? 'fullWidth' : variant}
      centered={centered && !scrollable && !fullWidth}
      orientation={orientation}
      scrollButtons={scrollable ? 'auto' : false}
      allowScrollButtonsMobile={scrollable}
      sx={{
        '& .MuiTabs-indicator': {
          borderRadius: 1,
          height: 3,
        },
        '& .MuiTab-root': {
          textTransform: 'none',
          fontWeight: 500,
          minHeight: 48,
          '&.Mui-selected': {
            fontWeight: 600,
          },
        },
        ...props.sx,
      }}
    >
      {tabs.map((tab) => (
        <MuiTab
          key={tab.value}
          value={tab.value}
          disabled={tab.disabled}
          icon={
            tab.badge && tab.icon ? (
              <Badge
                badgeContent={tab.badge}
                color={tab.badgeColor || 'primary'}
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.75rem',
                    minWidth: 16,
                    height: 16,
                  },
                }}
              >
                {tab.icon}
              </Badge>
            ) : (
              tab.icon
            )
          }
          label={
            tab.badge && !tab.icon ? (
              <Badge
                badgeContent={tab.badge}
                color={tab.badgeColor || 'primary'}
                sx={{
                  '& .MuiBadge-badge': {
                    fontSize: '0.75rem',
                    minWidth: 16,
                    height: 16,
                    top: -8,
                    right: -16,
                  },
                }}
              >
                {tab.label}
              </Badge>
            ) : (
              tab.label
            )
          }
          iconPosition={orientation === 'vertical' ? 'start' : 'top'}
          sx={{
            minWidth: fullWidth ? 'auto' : 120,
          }}
        />
      ))}
    </MuiTabs>
  );
};

export default Tabs;
