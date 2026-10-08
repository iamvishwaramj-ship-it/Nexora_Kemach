import React from 'react';
import { Box } from '@mui/material';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import EmptyState from '../../components/data-display/EmptyState';

// Shared "not built yet" shell for every page under the new Production
// Planning menu (router/navConfig.js + router/AppRouter.jsx). Same
// EntityHeaderCard + EmptyState pattern already used elsewhere in the app
// for a page whose backend/data model isn't wired up yet (see
// pages/product/CustomerDiscount.jsx, pages/businessPartner/TransportMaster.jsx).
//
// Swap the <EmptyState> out for the real screen as each one gets built —
// the header, route and menu entry stay exactly as they are.
export default function ProductionPlanningPlaceholder({ icon, title, subtitle, message }) {
  return (
    <Box>
      <EntityHeaderCard icon={icon} title={title} subtitle={subtitle} />
      <EmptyState
        icon={icon}
        title="Coming soon"
        message={message || `${title} is part of the new Production Planning module and has not been built yet.`}
      />
    </Box>
  );
}
