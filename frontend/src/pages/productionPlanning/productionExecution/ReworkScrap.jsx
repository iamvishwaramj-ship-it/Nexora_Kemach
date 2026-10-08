import React from 'react';
import ReplayIcon from '@mui/icons-material/Replay';
import ProductionPlanningPlaceholder from '../ProductionPlanningPlaceholder';

export default function ReworkScrap() {
  return (
    <ProductionPlanningPlaceholder
      icon={<ReplayIcon />}
      title="Rework & Scrap"
      subtitle="Production Execution"
    />
  );
}
