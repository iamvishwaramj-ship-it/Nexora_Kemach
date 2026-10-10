// Static stand-in for useGetProductionPlanningDashboardStatsQuery, used
// only when DEMO_MODE is on (see ../demoMode.js). Counts are consistent
// with ./productionPlanning.js's DEMO_PRODUCTION_ORDERS (3 orders: one In
// Progress, one Planned, one Completed) plus a few extra historical orders
// folded into the status breakdown and trend so the dashboard doesn't look
// suspiciously thin.
export const DEMO_DASHBOARD_STATS = {
  orderStatusCounts: { Planned: 4, Released: 3, 'In Progress': 5, Completed: 12, Closed: 8, Cancelled: 1 },
  totalOpenOrders: 12,
  plannedVsCompletedByMonth: [
    { month: 'May', planned: 10, completed: 8 },
    { month: 'Jun', planned: 14, completed: 11 },
    { month: 'Jul', planned: 9, completed: 9 },
    { month: 'Aug', planned: 16, completed: 13 },
    { month: 'Sep', planned: 12, completed: 10 },
    { month: 'Oct', planned: 15, completed: 7 },
  ],
};
