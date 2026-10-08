import React from 'react';
import RuleIcon from '@mui/icons-material/Rule';
import ProductionPlanningPlaceholder from './ProductionPlanningPlaceholder';

export default function OrderGenerationOption() {
  return (
    <ProductionPlanningPlaceholder
      icon={<RuleIcon />}
      title="Order Generation Option"
      subtitle="Production Planning"
    />
  );
}
