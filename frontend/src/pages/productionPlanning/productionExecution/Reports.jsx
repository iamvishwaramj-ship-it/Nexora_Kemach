import React from 'react';
import AssessmentIcon from '@mui/icons-material/Assessment';
import ProductionPlanningPlaceholder from '../ProductionPlanningPlaceholder';

export default function Reports() {
  return (
    <ProductionPlanningPlaceholder
      icon={<AssessmentIcon />}
      title="Reports"
      subtitle="Production Execution"
    />
  );
}
