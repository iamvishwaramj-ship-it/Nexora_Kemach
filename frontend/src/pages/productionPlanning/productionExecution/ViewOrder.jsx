import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, Button, Chip, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell, Divider, CircularProgress,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import LoadingState from '../../../components/feedback/LoadingState';
import { useNotify } from '../../../components/feedback/NotificationProvider';
import { useConfirm } from '../../../components/feedback/ConfirmationDialog';
import { productionOrderApi, useUpdateProductionOrderStatusMutation } from '../../../features/productionApi';

// ---------------------------------------------------------------------------
// Production Order - View — real data as of Phase A (schema.prisma's
// ProductionOrder/ProductionOrderComponent/ProductionOrderOperation /
// routes/productionOrders.js), replacing the earlier one-order static mock.
// Per the approved Phase A scope, only the header details and the
// Components tab are wired to real data; Operations/Production Execution/
// Material Issue/Material Receipt/Production History/Notes & Attachments
// stay as "not available yet" placeholders until their own later phases.
// ---------------------------------------------------------------------------

const STATUS_COLOR = { Released: 'info', Completed: 'success', 'In Progress': 'success', Planned: 'warning', Closed: 'default' };

const TABS = ['Components', 'Operations', 'Production Execution', 'Material Issue', 'Material Receipt', 'Production History', 'Notes & Attachments'];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function dateFmt(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function dateTimeFmt(d) {
  if (!d) return '-';
  return new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', '');
}

function fieldRow(label, value) {
  return (
    <Grid item xs={6} sm={4} md={3} lg={2.4} key={label}>
      <Typography variant="caption" color="text.secondary" display="block">{label}</Typography>
      <Typography variant="body2" fontWeight={600}>{value}</Typography>
    </Grid>
  );
}

export default function ViewOrder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const [tab, setTab] = useState(0);

  const { data: order, isLoading, isError } = productionOrderApi.useGet(id, { skip: !id });
  const [updateStatus, { isLoading: statusUpdating }] = useUpdateProductionOrderStatusMutation();
  const [cancelOrder, { isLoading: cancelling }] = productionOrderApi.useCancel();

  if (!id) {
    return (
      <Box>
        <EntityHeaderCard icon={<SettingsIcon />} title="Production Order - View" subtitle="Select a production order from the list to view its details." />
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/production-execution/production-orders')}>
          Back to List
        </Button>
      </Box>
    );
  }
  if (isLoading) return <LoadingState label="Loading production order..." />;
  if (isError || !order) {
    return (
      <Box>
        <EntityHeaderCard icon={<SettingsIcon />} title="Production Order - View" subtitle="This production order could not be found." />
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/production-execution/production-orders')}>
          Back to List
        </Button>
      </Box>
    );
  }

  const components = order.components || [];
  const plannedQty = Number(order.orderQty || 0);
  const producedQty = 0; // not tracked until the Record Production phase exists
  const balanceQty = plannedQty - producedQty;
  const progressPct = plannedQty > 0 ? Math.round((producedQty / plannedQty) * 100) : 0;
  const nextStatus = { Planned: 'Released', Released: 'In Progress', 'In Progress': 'Completed', Completed: 'Closed' }[order.status];

  const handleAdvance = async () => {
    if (!nextStatus) return;
    try {
      await updateStatus({ id: order.id, status: nextStatus }).unwrap();
      notify.success(`Production order is now ${nextStatus}`);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not update status');
    }
  };

  const handleCancel = async () => {
    const ok = await confirmDialog({
      title: 'Cancel production order',
      message: `Cancel ${order.orderNo}? This cannot be undone.`,
      confirmLabel: 'Cancel Order',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelOrder(order.id).unwrap();
      notify.success('Production order cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Could not cancel production order');
    }
  };

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="outlined" startIcon={<PrintOutlinedIcon />} disabled>Print</Button>
      <Button variant="outlined" startIcon={<ContentCopyIcon />} disabled>Copy</Button>
      <Button
        variant="outlined" color="error" startIcon={<CancelOutlinedIcon />}
        disabled={order.isCancelled || ['Completed', 'Closed'].includes(order.status) || cancelling}
        onClick={handleCancel}
      >
        {order.isCancelled ? 'Cancelled' : 'Cancel Order'}
      </Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Production Order - View"
        subtitle="View production order details, item components, material status, operations and production progress."
        rightContent={headerActions}
      />

      <Grid container spacing={2}>
        <Grid item xs={12} lg={8.5}>
          {/* Production Order Details */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Production Order Details</Typography>
              <Grid container spacing={2.5}>
                {fieldRow('Production Order No.', order.orderNo)}
                {fieldRow('Planned Start Date', dateFmt(order.plannedStartDate))}
                {fieldRow('Due Date', dateFmt(order.dueDate))}
                <Grid item xs={6} sm={4} md={3} lg={2.4}>
                  <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
                  <Chip size="small" label={order.status} color={STATUS_COLOR[order.status] || 'default'} sx={{ mt: 0.25 }} />
                  {order.isCancelled && <Chip size="small" label="Cancelled" color="error" variant="outlined" sx={{ mt: 0.25, ml: 0.5 }} />}
                </Grid>

                {fieldRow('Item Code', order.productCode)}
                {fieldRow('Item Description', order.productName || '-')}
                {fieldRow('UOM', order.uom || '-')}
                {fieldRow('Planned Qty', numberFmt(plannedQty))}
                {fieldRow('Produced Qty', numberFmt(producedQty))}
                {fieldRow('Balance Qty', numberFmt(balanceQty))}
                {fieldRow('Sales Order', order.baseType === 'SalesOrder' ? (order.baseNo || '-') : '-')}

                {fieldRow('Warehouse', order.warehouse || '-')}
                {fieldRow('Branch', order.branch || '-')}
                {fieldRow('BOM', order.bom ? `${order.bom.bomCode} (${order.bom.version})` : '-')}
                {fieldRow('Routing', order.routing ? `${order.routing.routingCode} (${order.routing.version})` : '-')}
                {fieldRow('Created By', order.createdByName || '-')}
                {fieldRow('Created On', dateTimeFmt(order.createdAt))}
                {fieldRow('Last Updated On', dateTimeFmt(order.updatedAt))}
              </Grid>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Card variant="outlined">
            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
              <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
                {TABS.map((t) => <Tab key={t} label={t} />)}
              </Tabs>
            </Box>
            <CardContent>
              {tab === 0 && (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>BOM Components ({components.length})</Typography>
                  </Stack>
                  {components.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">No components snapshotted for this order.</Typography>
                    </Box>
                  ) : (
                    <ScrollableTableContainer maxHeight="clamp(240px, calc(100vh - 560px), 420px)">
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>S.No</TableCell>
                            <TableCell>Component Code</TableCell>
                            <TableCell>Component Description</TableCell>
                            <TableCell>UOM</TableCell>
                            <TableCell align="right">Planned Qty</TableCell>
                            <TableCell align="right">Issued Qty</TableCell>
                            <TableCell align="right">Pending Qty</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {components.map((c, idx) => (
                            <TableRow key={c.id} hover>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell><Typography variant="body2" fontWeight={600}>{c.componentProductCode}</Typography></TableCell>
                              <TableCell>{c.componentProductName || '-'}</TableCell>
                              <TableCell>{c.uom || '-'}</TableCell>
                              <TableCell align="right">{numberFmt(c.plannedQty)}</TableCell>
                              <TableCell align="right">{numberFmt(c.issuedQty)}</TableCell>
                              <TableCell align="right">{numberFmt(Number(c.plannedQty) - Number(c.issuedQty))}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollableTableContainer>
                  )}
                </>
              )}

              {tab !== 0 && (
                <Box sx={{ py: 6, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {TABS[tab]} is not available yet — this is planned for a later phase.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right rail */}
        <Grid item xs={12} lg={3.5}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Production Progress</Typography>
              <Stack alignItems="center" sx={{ mb: 1.5 }}>
                <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                  <CircularProgress variant="determinate" value={progressPct} size={120} thickness={5} color="success" />
                  <Box sx={{
                    top: 0, left: 0, bottom: 0, right: 0, position: 'absolute',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography variant="h6" fontWeight={700}>{progressPct}%</Typography>
                  </Box>
                </Box>
              </Stack>
              <Stack spacing={0.75}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Planned Qty</Typography>
                  <Typography variant="caption" fontWeight={600}>{numberFmt(plannedQty)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Produced Qty</Typography>
                  <Typography variant="caption" fontWeight={600}>{numberFmt(producedQty)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Balance Qty</Typography>
                  <Typography variant="caption" fontWeight={600}>{numberFmt(balanceQty)}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Production Order Summary</Typography>
              <Stack spacing={1}>
                {[
                  { label: 'Total Components', value: components.length },
                  { label: 'Operations', value: (order.operations || []).length },
                ].map((row) => (
                  <Stack key={row.label} direction="row" justifyContent="space-between">
                    <Typography variant="caption" color="text.secondary">{row.label}</Typography>
                    <Typography variant="caption" fontWeight={600}>{row.value}</Typography>
                  </Stack>
                ))}
                <Divider />
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" fontWeight={700}>Completion %</Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">{progressPct}%</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom action bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/production-execution/production-orders')}>
          Back to List
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<EditOutlinedIcon />} disabled={order.status !== 'Planned'}>Edit</Button>
        <Button
          variant="outlined" startIcon={<RocketLaunchOutlinedIcon />}
          disabled={!nextStatus || order.isCancelled || statusUpdating}
          onClick={handleAdvance}
        >
          {order.status === 'Released' || order.status === 'In Progress' ? 'Advance' : 'Release'}
        </Button>
        <Button
          variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />}
          disabled={order.status !== 'Completed' || statusUpdating}
          onClick={handleAdvance}
        >
          Close
        </Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />} disabled>Print</Button>
      </Stack>
    </Box>
  );
}
