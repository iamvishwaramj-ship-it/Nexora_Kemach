import React from 'react';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ProductionPlanningPlaceholder from './ProductionPlanningPlaceholder';

export default function GenerateOrderForecast() {
  return (
    <ProductionPlanningPlaceholder
      icon={<TrendingUpIcon />}
      title="Generate Order - Forecast"
      subtitle="Production Planning"
    />
  );
}
