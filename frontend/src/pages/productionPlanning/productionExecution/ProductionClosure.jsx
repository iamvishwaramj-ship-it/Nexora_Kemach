import React from 'react';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import ProductionPlanningPlaceholder from '../ProductionPlanningPlaceholder';

export default function ProductionClosure() {
  return (
    <ProductionPlanningPlaceholder
      icon={<DoneAllIcon />}
      title="Production Closure"
      subtitle="Production Execution"
    />
  );
}
