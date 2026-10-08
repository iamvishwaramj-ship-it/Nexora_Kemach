import React from 'react';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import ProductionPlanningPlaceholder from './ProductionPlanningPlaceholder';

export default function GenerateOrder() {
  return (
    <ProductionPlanningPlaceholder
      icon={<PlaylistAddCheckIcon />}
      title="Generate Order"
      subtitle="Production Planning"
    />
  );
}
