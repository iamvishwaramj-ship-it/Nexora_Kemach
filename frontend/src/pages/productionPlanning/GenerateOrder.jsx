import { Navigate } from 'react-router-dom';

// Sidebar entry point for "Generate Order". The real screen is reached via
// one of the four source-method pages (MRP / Manual / Sales Order /
// Forecast); MRP is the recommended, fully-wired Phase 1 path (approved
// scope), so this redirects there instead of showing an empty placeholder.
export default function GenerateOrder() {
  return <Navigate to="/production-planning/generate-order-mrp" replace />;
}
