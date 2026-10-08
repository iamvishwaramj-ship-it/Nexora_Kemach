import React from 'react';
import EngineeringIcon from '@mui/icons-material/Engineering';
import ProductionPlanningPlaceholder from './ProductionPlanningPlaceholder';

export default function GenerateOrderProject() {
  return (
    <ProductionPlanningPlaceholder
      icon={<EngineeringIcon />}
      title="Generate Order - Project"
      subtitle="Production Planning"
    />
  );
}
