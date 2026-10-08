import React from 'react';
import { Box, Grid, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import PaymentsIcon from '@mui/icons-material/Payments';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import { useTranslation } from 'react-i18next';
import StatCard from '../../components/data-display/StatCard';
import Spinner from '../../components/ui/Spinner';
import { useGetDashboardStatsQuery } from '../../features/dashboard/dashboardApi';
import SalesOverviewCard from './components/SalesOverviewCard';
import PurchaseOverviewCard from './components/PurchaseOverviewCard';
import BusinessSummaryCard from './components/BusinessSummaryCard';
import RecentTransactionsCard from './components/RecentTransactionsCard';
import TopSellingProductsCard from './components/TopSellingProductsCard';
import InventoryStockAlertCard from './components/InventoryStockAlertCard';

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const lastMonthName = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
  .toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useGetDashboardStatsQuery();

  if (isLoading) return <Spinner label={t('common.loading')} />;

  const changes = data?.changes || {};

  const statCards = [
    {
      icon: <ShoppingCartIcon fontSize="small" />, label: 'Total Sales', value: currency(data?.totalSales),
      color: 'primary', change: changes.totalSales,
    },
    {
      icon: <LocalShippingIcon fontSize="small" />, label: 'Total Purchase', value: currency(data?.totalPurchase),
      color: 'info', change: changes.totalPurchase,
    },
    {
      icon: <AccountBalanceWalletIcon fontSize="small" />, label: 'Total Receivables', value: currency(data?.totalReceivables),
      color: 'success', change: changes.totalReceivables,
    },
    {
      icon: <HourglassBottomIcon fontSize="small" />, label: 'Total Receivables Balance', value: currency(data?.totalReceivablesBalance),
      color: 'success',
    },
    {
      icon: <PaymentsIcon fontSize="small" />, label: 'Total Payables', value: currency(data?.totalPayables),
      color: 'warning', change: changes.totalPayables,
    },
    {
      icon: <HourglassBottomIcon fontSize="small" />, label: 'Total Payables Balance', value: currency(data?.totalPayablesBalance),
      color: 'warning',
    },
    {
      icon: <Inventory2Icon fontSize="small" />, label: 'Total Inventory Value', value: currency(data?.totalInventoryValue),
      color: 'secondary', change: changes.totalInventoryValue,
    },
  ];

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>{t('common.dashboard')}</Typography>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {statCards.map((c) => (
          <Grid item xs={12} sm={6} md={4} lg={2.4} key={c.label}>
            <StatCard {...c} changeLabel={`vs ${lastMonthName}`} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={5}>
          <SalesOverviewCard data={data?.salesOverview || []} />
        </Grid>
        <Grid item xs={12} md={4}>
          <PurchaseOverviewCard data={data?.purchaseOverview || []} />
        </Grid>
        <Grid item xs={12} md={3}>
          <BusinessSummaryCard summary={data?.businessSummary || {}} />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <RecentTransactionsCard rows={data?.recentTransactions || []} onViewAll={() => navigate('/sales/invoice')} />
        </Grid>
        <Grid item xs={12} md={4}>
          <TopSellingProductsCard data={data?.topSellingProducts || []} />
        </Grid>
        <Grid item xs={12} md={3}>
          <InventoryStockAlertCard rows={data?.inventoryStockAlert || []} onViewAll={() => navigate('/product/master')} />
        </Grid>
      </Grid>
    </Box>
  );
}
