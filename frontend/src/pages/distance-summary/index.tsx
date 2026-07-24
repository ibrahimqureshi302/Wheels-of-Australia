import React, { useState, useEffect, useCallback } from 'react';
import { Box, Typography, Paper, Skeleton, Button } from '@mui/material';
import { Route, Straighten, ErrorOutline } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeVariants, listItemVariants, listVariants } from '../../lib/animations';
import { PageHero } from '../../components/Common';

/**
 * There is no aggregate distance/trips endpoint yet, so this resolves to an
 * empty summary (the page renders its built-in empty state). Wire to a real
 * endpoint here when one is available.
 */
const fetchSummary = (): Promise<{ totalKm: number; trips: number }> =>
  Promise.resolve({ totalKm: 0, trips: 0 });

const DistanceSummaryPage: React.FC = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ totalKm: number; trips: number } | null>(null);
  const [empty, setEmpty] = useState(false);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    let cancelled = false;
    fetchSummary()
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setEmpty(res.trips === 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setData(null);
          setEmpty(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <PageHero title={t('distance.title')} subtitle={t('distance.subtitle')}>
      <AnimatePresence mode="wait">
        {loading && (
          <motion.div key="loading" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Skeleton variant="rounded" width={220} height={120} sx={{ borderRadius: 2 }} />
              <Skeleton variant="rounded" width={220} height={120} sx={{ borderRadius: 2 }} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              {t('distance.loading')}
            </Typography>
          </motion.div>
        )}

        {!loading && error && (
          <motion.div key="error" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <ErrorOutline sx={{ fontSize: 56, color: 'error.main', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                {t('errors.serverError')}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {t('errors.tryAgain')}
              </Typography>
              <Button variant="contained" onClick={() => fetchData()}>
                {t('common.retry')}
              </Button>
            </Paper>
          </motion.div>
        )}

        {!loading && !error && empty && (
          <motion.div key="empty" variants={fadeVariants} initial="initial" animate="animate" exit="exit">
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Route sx={{ fontSize: 56, color: 'text.disabled', mb: 1 }} />
              <Typography variant="h6" gutterBottom>
                {t('distance.noData')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {t('distance.noDataMessage')}
              </Typography>
            </Paper>
          </motion.div>
        )}

        {!loading && !error && data && !empty && (
          <motion.div
            key="data"
            variants={listVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}
          >
            <motion.div variants={listItemVariants}>
              <Paper sx={{ p: 2.5, minWidth: 200, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Straighten color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('distance.totalDistance')}
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  {data.totalKm.toLocaleString()} km
                </Typography>
              </Paper>
            </motion.div>
            <motion.div variants={listItemVariants}>
              <Paper sx={{ p: 2.5, minWidth: 200, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Route color="primary" />
                  <Typography variant="subtitle2" color="text.secondary">
                    {t('distance.trips')}
                  </Typography>
                </Box>
                <Typography variant="h4" fontWeight={700}>
                  {data.trips}
                </Typography>
              </Paper>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageHero>
  );
};

export default DistanceSummaryPage;
