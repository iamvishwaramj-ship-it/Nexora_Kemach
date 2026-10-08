import React from 'react';
import InsightsIcon from '@mui/icons-material/Insights';
import ProductionPlanningPlaceholder from './ProductionPlanningPlaceholder';

export default function Forecast() {
  return (
    <ProductionPlanningPlaceholder
      icon={<InsightsIcon />}
      title="Forecast"
      subtitle="Production Planning"
    />
  );
}
