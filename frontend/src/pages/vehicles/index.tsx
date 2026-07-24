import React, { useState, useEffect } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { browseListRentals } from '../../services/rentals/browse';
import type { Rental } from '../../services/rentals/types';
import { ROUTES } from '../../constants/routes';
import { cardVariants, fadeVariants } from '../../lib/animations';
import { PageHero } from '../../components/Common';
import { VehiclesEmptyState, RentalCard } from './components';

const GRID_SX = {
  display: 'grid',
  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
  gap: { xs: 2, sm: 2.5, md: 3 },
  width: '100%',
} as const;

const VehiclesPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [vehicleCountByRental, setVehicleCountByRental] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    browseListRentals()
      .then(({ rentals, countByRental }) => {
        if (!active) return;
        setRentals(rentals);
        setVehicleCountByRental(countByRental);
      })
      .catch(() => {
        if (!active) return;
        setRentals([]);
        setVehicleCountByRental(new Map());
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const handleRentalClick = (rentalId: string) => {
    navigate(ROUTES.VEHICLES_RENTAL.replace(':rentalId', rentalId));
  };

  const hasAnyRentals = rentals.length > 0;
  const companyRentals = rentals.filter((r) => r.rentalType === 'company');
  const individualRentals = rentals.filter((r) => r.rentalType !== 'company');

  const renderSection = (title: string, subtitle: string, list: Rental[]) => {
    if (list.length === 0) return null;
    return (
      <Box sx={{ mb: 5 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 0.25 }}>
          {title} ({list.length})
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {subtitle}
        </Typography>
        <Box sx={GRID_SX}>
          {list.map((rental, index) => (
            <motion.div
              key={rental.id}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              transition={{ delay: Math.min(index * 0.04, 0.2) }}
              style={{ minWidth: 0 }}
            >
              <RentalCard
                rental={rental}
                availableVehicleCount={vehicleCountByRental.get(rental.id) ?? 0}
                onClick={() => handleRentalClick(rental.id)}
              />
            </motion.div>
          ))}
        </Box>
      </Box>
    );
  };

  return (
    <PageHero title={t('vehicles.title')} subtitle={t('vehicles.subtitle')}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div key="skeleton" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
              <Box sx={GRID_SX}>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Skeleton key={i} variant="rounded" height={200} sx={{ borderRadius: 3, overflow: 'hidden' }} />
                ))}
              </Box>
            </motion.div>
          ) : !hasAnyRentals ? (
            <motion.div key="empty" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
              <VehiclesEmptyState />
            </motion.div>
          ) : (
            <motion.div key="list" variants={fadeVariants} initial="initial" animate="animate" exit="exit" style={{ width: '100%' }}>
              {renderSection(
                'Rental companies',
                'Registered rental businesses with vehicles available.',
                companyRentals,
              )}
              {renderSection(
                'Individual owners',
                'Individual owners renting out their own vehicles.',
                individualRentals,
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </PageHero>
  );
};

export default VehiclesPage;
