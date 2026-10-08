import React from 'react';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ProductionPlanningPlaceholder from './ProductionPlanningPlaceholder';

export default function GenerateOrderManual() {
  return (
    <ProductionPlanningPlaceholder
      icon={<EditNoteIcon />}
      title="Generate Order - Manual"
      subtitle="Production Planning"
    />
  );
}
