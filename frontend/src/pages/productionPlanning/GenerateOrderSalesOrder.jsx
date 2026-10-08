import React from 'react';
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import ProductionPlanningPlaceholder from './ProductionPlanningPlaceholder';

export default function GenerateOrderSalesOrder() {
  return (
    <ProductionPlanningPlaceholder
      icon={<PointOfSaleIcon />}
      title="Generate Order - Sales Order"
      subtitle="Production Planning"
    />
  );
}
