import React from 'react';
import TuneIcon from '@mui/icons-material/Tune';
import ProductionPlanningPlaceholder from './ProductionPlanningPlaceholder';

export default function GenerateOrderMrp() {
  return (
    <ProductionPlanningPlaceholder
      icon={<TuneIcon />}
      title="Generate Order - MRP"
      subtitle="Production Planning"
    />
  );
}
