import React from 'react';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ProductionPlanningPlaceholder from './ProductionPlanningPlaceholder';

export default function PreviewOrder() {
  return (
    <ProductionPlanningPlaceholder
      icon={<VisibilityIcon />}
      title="Preview Order"
      subtitle="Production Planning"
    />
  );
}
