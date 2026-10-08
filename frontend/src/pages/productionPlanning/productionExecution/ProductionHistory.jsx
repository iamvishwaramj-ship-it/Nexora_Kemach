import React from 'react';
import HistoryIcon from '@mui/icons-material/History';
import ProductionPlanningPlaceholder from '../ProductionPlanningPlaceholder';

export default function ProductionHistory() {
  return (
    <ProductionPlanningPlaceholder
      icon={<HistoryIcon />}
      title="Production History"
      subtitle="Production Execution"
    />
  );
}
