import React from 'react';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ProductionPlanningPlaceholder from './ProductionPlanningPlaceholder';

// Named ProductionPlanningDashboard (not Dashboard) to avoid clashing with
// the unrelated top-level pages/dashboard/Dashboard.jsx component when both
// are imported into router/AppRouter.jsx.
export default function ProductionPlanningDashboard() {
  return (
    <ProductionPlanningPlaceholder
      icon={<DashboardIcon />}
      title="Dashboard"
      subtitle="Production Planning"
    />
  );
}
