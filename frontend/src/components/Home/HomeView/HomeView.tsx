import React from 'react';
import {
  Container,
  Typography,
  Grid,
  Box,
} from '@mui/material';
import {
  Dashboard,
  Settings,
  Analytics,
} from '@mui/icons-material';
import Card from '../../Common/Card';
import Button from '../../Common/Button';

const HomeView: React.FC = () => {
  const features = [
    {
      title: 'Dashboard',
      description: 'View your analytics and key metrics',
      icon: <Dashboard sx={{ fontSize: 40, color: 'primary.main' }} />,
    },
    {
      title: 'Settings',
      description: 'Configure your application settings',
      icon: <Settings sx={{ fontSize: 40, color: 'primary.main' }} />,
    },
    {
      title: 'Analytics',
      description: 'Deep dive into your data',
      icon: <Analytics sx={{ fontSize: 40, color: 'primary.main' }} />,
    },
  ];

  return (
    <Container maxWidth="lg" sx={{ mt: { xs: 2, sm: 4 }, mb: { xs: 2, sm: 4 }, px: { xs: 2, sm: 3 } }}>
      <Box sx={{ mb: { xs: 3, sm: 4 } }}>
        <Typography variant="h3" component="h1" gutterBottom sx={{ fontSize: { xs: '1.5rem', sm: '2rem', md: '2.5rem' } }}>
          Welcome to React 19 App
        </Typography>
        <Typography variant="h6" color="textSecondary" paragraph sx={{ fontSize: { xs: '0.9375rem', sm: '1rem' } }}>
          A modern React application built with TypeScript, Material-UI, and Vite
        </Typography>
      </Box>

      <Grid container spacing={{ xs: 2, sm: 3 }}>
        {features.map((feature, index) => (
          <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
            <Card
              title={feature.title}
              subtitle={feature.description}
              actions={
                <Button variant="outlined" size="small">
                  Learn More
                </Button>
              }
            >
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                {feature.icon}
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ mt: { xs: 4, sm: 6 }, textAlign: 'center', px: { xs: 0, sm: 2 } }}>
        <Typography variant="h5" gutterBottom sx={{ fontSize: { xs: '1.125rem', sm: '1.25rem' } }}>
          Get Started
        </Typography>
        <Typography variant="body1" color="textSecondary" paragraph>
          Explore the features and start building your application
        </Typography>
        <Button variant="contained" size="large">
          Start Building
        </Button>
      </Box>
    </Container>
  );
};

export default HomeView;
