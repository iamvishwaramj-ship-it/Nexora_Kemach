import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, Button, Chip, Tabs, Tab, Checkbox,
  Table, TableHead, TableBody, TableRow, TableCell, Divider, CircularProgress, IconButton, MenuItem,
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import SettingsIcon from '@mui/icons-material/Settings';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import BookmarkAddOutlinedIcon from '@mui/icons-material/BookmarkAddOutlined';
import MenuBookOutlinedIcon from '@mui/icons-material/MenuBookOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AddIcon from '@mui/icons-material/Add';
import SwapVertOutlinedIcon from '@mui/icons-material/SwapVertOutlined';
import RouteOutlinedIcon from '@mui/icons-material/RouteOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import GridOnOutlinedIcon from '@mui/icons-material/GridOnOutlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlinedIcon from '@mui/icons-material/InsertDriveFileOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import LoadingState from '../../../components/feedback/LoadingState';
import { useNotify } from '../../../components/feedback/NotificationProvider';
import { useConfirm } from '../../../components/feedback/ConfirmationDialog';
import { productionOrderApi, useUpdateProductionOrderStatusMutation } from '../../../features/productionApi';
import { isDemoMode } from '../../../lib/demoMode';
import { withDemoCrud } from '../../../lib/demoCrud';
import { DEMO_PRODUCTION_ORDERS, DEMO_WORK_CENTERS } from '../../../lib/demoData/productionPlanning';

// Demo-mode-aware api: a pure pass-through to the real productionOrderApi
// when demo mode is off (see ../../../lib/demoMode.js). Shares the same
// DEMO_PRODUCTION_ORDERS array reference as ProductionOrders.jsx and
// CreateProductionOrder.jsx so edits are visible across all three screens.
const demoAwareProductionOrderApi = withDemoCrud(productionOrderApi, DEMO_PRODUCTION_ORDERS);

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
const COMPONENT_STATUS_COLOR = { Issued: 'success', Partial: 'info', Pending: 'warning', 'Not Required': 'default' };
const COMPONENT_STATUS_DOT = { Issued: '#2e7d32', Partial: '#1976d2', Pending: '#f9a825', 'Not Required': '#b0bec5' };

// A component's status isn't stored on the record today (no such schema
// field yet on ProductionOrderComponent); derive it from planned vs issued
// qty so the Components tab and its Material Status summary have something
// to show for both demo and real orders.
function componentStatus(c) {
  const planned = Number(c.plannedQty || 0);
  const issued = Number(c.issuedQty || 0);
  if (planned <= 0) return 'Not Required';
  if (issued <= 0) return 'Pending';
  if (issued >= planned) return 'Issued';
  return 'Partial';
}

const OP_STATUS_COLOR = { Completed: 'success', 'In Progress': 'info', Pending: 'warning' };
const OP_STATUS_LIST = Object.keys(OP_STATUS_COLOR);
const OP_SEQUENCE_META = {
  Completed: { icon: CheckCircleIcon, color: 'success.main', bg: 'success.lighter', border: 'success.light' },
  'In Progress': { icon: PlayCircleOutlineIcon, color: 'info.main', bg: 'info.lighter', border: 'info.light' },
  Pending: { icon: ScheduleOutlinedIcon, color: 'text.secondary', bg: 'action.hover', border: 'divider' },
};

// Per-operation Completed/In Progress/Pending qty isn't tracked anywhere in
// the schema today (order-level producedQty itself is hardcoded to 0 until
// the Record Production phase exists) -- so each operation's whole planned
// qty is attributed to whichever bucket its own status falls in, rather
// than inventing a partial split that doesn't correspond to real data.
function operationQtyBreakdown(op, orderPlannedQty) {
  const status = op.status || 'Pending';
  return {
    completedQty: status === 'Completed' ? orderPlannedQty : 0,
    inProgressQty: status === 'In Progress' ? orderPlannedQty : 0,
    pendingQty: status === 'Pending' ? orderPlannedQty : 0,
  };
}

const TABS = ['Components', 'Operations', 'Production Execution', 'Material Issue', 'Material Receipt', 'Production History', 'Product Cost', 'Notes & Attachments'];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function currencyFmt(n) {
  return `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const PRODUCT_COST_ELEMENTS = [
  { key: 'rawMaterial', label: 'Raw Material Cost', description: 'Direct material from BOM' },
  { key: 'consumables', label: 'Consumables Cost', description: 'Cutting tools, coolant, etc.' },
  { key: 'directLabour', label: 'Direct Labour Cost', description: 'Operator wages' },
  { key: 'machineOverhead', label: 'Machine Overhead Cost', description: 'Machine running cost' },
  { key: 'fixedOverhead', label: 'Fixed Overhead Cost', description: 'Plant overhead allocation' },
];
const PRODUCT_COST_DONUT_COLORS = {
  rawMaterial: '#1976d2', consumables: '#2e7d32', directLabour: '#f9a825', machineOverhead: '#7b1fa2', fixedOverhead: '#9e9e9e',
};

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
  const [selectedOpId, setSelectedOpId] = useState(null);
  const [checkedOps, setCheckedOps] = useState(() => new Set());

  const { data: order, isLoading, isError } = demoAwareProductionOrderApi.useGet(id, { skip: !id });
  const [updateStatus, { isLoading: statusUpdatingReal }] = useUpdateProductionOrderStatusMutation();
  const [demoUpdate, { isLoading: statusUpdatingDemo }] = demoAwareProductionOrderApi.useUpdate();
  const statusUpdating = isDemoMode() ? statusUpdatingDemo : statusUpdatingReal;
  const [cancelOrderReal, { isLoading: cancellingReal }] = productionOrderApi.useCancel();
  const [cancelOrderDemo, { isLoading: cancellingDemo }] = demoAwareProductionOrderApi.useCancel();
  const cancelOrder = isDemoMode() ? cancelOrderDemo : cancelOrderReal;
  const cancelling = isDemoMode() ? cancellingDemo : cancellingReal;

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

  const componentsWithStatus = components.map((c) => ({ ...c, status: componentStatus(c) }));
  const materialStatusCounts = componentsWithStatus.reduce((acc, c) => {
    acc[c.status] = (acc[c.status] || 0) + 1;
    return acc;
  }, {});
  const MATERIAL_STATUS_DONUT = ['Issued', 'Partial', 'Pending', 'Not Required'].map((label) => ({
    label, value: materialStatusCounts[label] || 0, color: COMPONENT_STATUS_DOT[label],
  }));
  const materialStatusTotal = MATERIAL_STATUS_DONUT.reduce((sum, d) => sum + d.value, 0) || 1;
  const materialStatusIssuedPct = Math.round((materialStatusCounts.Issued || 0) / materialStatusTotal * 100);
  const reworkQty = Number(order.reworkQty || 0);
  const scrapQty = Number(order.scrapQty || 0);

  const handleCheckAvailability = () => notify.info('Stock availability checked against the latest on-hand quantities for all components.');
  const handleReserveMaterial = () => notify.info('Material reserved for this production order.');
  const handleViewBom = () => notify.info(order.bom ? `BOM ${order.bom.bomCode} (${order.bom.version})` : 'No BOM linked to this order.');

  const operations = order.operations || [];
  const operationsWithQty = operations.map((op) => ({ ...op, ...operationQtyBreakdown(op, plannedQty) }));
  const OPERATIONS_CHART_DATA = operationsWithQty.map((op) => ({
    name: op.operationName, Completed: op.completedQty, 'In Progress': op.inProgressQty, Pending: op.pendingQty,
  }));
  const selectedOp = operationsWithQty.find((op) => op.id === selectedOpId) || operationsWithQty[0];
  const selectedOpWorkCenter = selectedOp && isDemoMode()
    ? DEMO_WORK_CENTERS.find((wc) => wc.workCenterCode === selectedOp.workCenterCode)
    : null;
  const toggleOpRow = (opId) => {
    setCheckedOps((prev) => {
      const next = new Set(prev);
      if (next.has(opId)) next.delete(opId); else next.add(opId);
      return next;
    });
  };
  const handleAddOperation = () => notify.info('Add Operation is not wired to a real routing change yet.');
  const handleResequence = () => notify.info('Re-sequence is not wired to a real routing change yet.');
  const handleViewRouting = () => notify.info(order.routing ? `Routing ${order.routing.routingCode} (${order.routing.version})` : 'No routing linked to this order.');
  const handleExportOperations = () => notify.info('Operations exported.');

  // Good/Rework/Scrap qty per operation and the execution history log are
  // demo-only fields (see DEMO_PRODUCTION_ORDERS) -- there's no Record
  // Production feature yet to populate them for a real order, so both
  // default to empty/zero and the table/history fall back to an empty state.
  const executionRows = operations.map((op) => ({
    ...op,
    goodQty: Number(op.goodQty || 0),
    reworkQty: Number(op.reworkQty || 0),
    scrapQty: Number(op.scrapQty || 0),
  }));
  const executionHistory = order.productionExecutionHistory || [];
  const execGoodTotal = executionRows.reduce((sum, op) => sum + op.goodQty, 0);
  const execReworkTotal = executionRows.reduce((sum, op) => sum + op.reworkQty, 0);
  const execScrapTotal = executionRows.reduce((sum, op) => sum + op.scrapQty, 0);
  const execBalance = Math.max(plannedQty - execGoodTotal, 0);
  const EXECUTION_DONUT = [
    { label: 'Produced', value: execGoodTotal, color: '#2e7d32' },
    { label: 'Rework', value: execReworkTotal, color: '#f9a825' },
    { label: 'Scrap', value: execScrapTotal, color: '#d32f2f' },
    { label: 'Balance', value: Math.max(execBalance - execReworkTotal - execScrapTotal, 0), color: '#e0e0e0' },
  ];
  const execProgressPct = plannedQty > 0 ? Math.round((execGoodTotal / plannedQty) * 100) : 0;
  const handleReportProduction = () => navigate('/production-execution/record-production');
  const handlePauseOperation = () => notify.info('Operation paused (demo only -- not wired to a real status change).');
  const handleHoldOrder = () => notify.info('Order held (demo only -- not wired to a real status change).');
  const handleViewShopFloor = () => notify.info('Shop floor view is not available yet.');

  // Each material issue transaction is cross-referenced against the same
  // component record used on the Components tab, so "Required Qty" and
  // status always agree between the two tabs instead of drifting apart.
  const materialIssues = order.materialIssues || [];
  const materialIssueRows = materialIssues.map((m) => {
    const component = components.find((c) => c.componentProductCode === m.componentProductCode);
    const requiredQty = Number(component?.plannedQty || 0);
    const issuedQty = Number(m.qty || 0);
    return { ...m, requiredQty, issuedQty, balanceQty: Math.max(requiredQty - issuedQty, 0), status: componentStatus({ plannedQty: requiredQty, issuedQty }) };
  });
  const totalRequiredQty = components.reduce((sum, c) => sum + Number(c.plannedQty || 0), 0);
  const totalIssuedQty = components.reduce((sum, c) => sum + Number(c.issuedQty || 0), 0);
  const materialIssueBalanceQty = Math.max(totalRequiredQty - totalIssuedQty, 0);
  const materialIssueProgressPct = totalRequiredQty > 0 ? Math.round((totalIssuedQty / totalRequiredQty) * 100) : 0;
  const pendingMaterialIssues = componentsWithStatus.filter((c) => c.status === 'Partial' || c.status === 'Pending');
  const MATERIAL_ISSUE_DONUT = [
    { label: 'Issued', value: materialStatusCounts.Issued || 0, color: '#2e7d32' },
    { label: 'Partially Issued', value: materialStatusCounts.Partial || 0, color: '#f9a825' },
    { label: 'Pending', value: (materialStatusCounts.Pending || 0) + (materialStatusCounts['Not Required'] || 0), color: '#b0bec5' },
  ];
  const materialIssueDonutTotal = MATERIAL_ISSUE_DONUT.reduce((sum, s) => sum + s.value, 0) || 1;
  const materialIssueIssuedCountPct = Math.round((MATERIAL_ISSUE_DONUT[0].value / materialIssueDonutTotal) * 100);
  const handleIssueMaterial = () => notify.info('Material issue is not wired to a real stock movement yet.');
  const handleReturnMaterial = () => notify.info('Material return is not wired to a real stock movement yet.');
  const handleViewStock = () => notify.info('Stock view is not available yet.');
  const handleExportMaterialIssue = () => notify.info('Material issue transactions exported.');
  const handleCreateMaterialRequisition = () => navigate('/production-execution/create-requisition');

  // Unlike Material Issue, materialReceipts in this schema records a
  // finished-goods receipt against the whole order -- there's no per-
  // component breakdown or accepted/rejected qty tracked, so "Expected Qty"
  // is the order's own planned qty and Accepted/Rejected fall back to
  // Received/0 rather than inventing a QC outcome that isn't recorded.
  const materialReceipts = order.materialReceipts || [];
  function receiptStatus(receivedQty, expectedQty) {
    if (expectedQty <= 0) return 'Pending';
    if (receivedQty <= 0) return 'Pending';
    if (receivedQty >= expectedQty) return 'Completed';
    return 'Partial';
  }
  const materialReceiptRows = materialReceipts.map((m) => {
    const receivedQty = Number(m.qty || 0);
    return {
      ...m, expectedQty: plannedQty, receivedQty, acceptedQty: receivedQty, rejectedQty: 0,
      status: receiptStatus(receivedQty, plannedQty),
    };
  });
  const RECEIPT_STATUS_COLOR = { Completed: 'success', Partial: 'info', Pending: 'warning' };
  const receiptStatusCounts = materialReceiptRows.reduce((acc, m) => { acc[m.status] = (acc[m.status] || 0) + 1; return acc; }, {});
  const MATERIAL_RECEIPT_DONUT = [
    { label: 'Received', value: receiptStatusCounts.Completed || 0, color: '#2e7d32' },
    { label: 'Partial', value: receiptStatusCounts.Partial || 0, color: '#1976d2' },
    { label: 'Pending', value: receiptStatusCounts.Pending || 0, color: '#b0bec5' },
  ];
  const materialReceiptDonutTotal = MATERIAL_RECEIPT_DONUT.reduce((sum, s) => sum + s.value, 0) || 1;
  const totalExpectedQty = materialReceiptRows.reduce((sum, m) => sum + m.expectedQty, 0);
  const totalReceivedQty = materialReceiptRows.reduce((sum, m) => sum + m.receivedQty, 0);
  const totalAcceptedQty = materialReceiptRows.reduce((sum, m) => sum + m.acceptedQty, 0);
  const totalRejectedQty = materialReceiptRows.reduce((sum, m) => sum + m.rejectedQty, 0);
  const materialReceiptPct = totalExpectedQty > 0 ? Math.round((totalReceivedQty / totalExpectedQty) * 100) : 0;
  const handleReceiveMaterial = () => notify.info('Material receipt is not wired to a real stock movement yet.');
  const handleViewReceiptStock = () => notify.info('Stock view is not available yet.');
  const handleExportMaterialReceipt = () => notify.info('Material receipt transactions exported.');

  // Production History reuses the same per-operation execution log as the
  // Production Execution tab (executionHistory, defined above) -- it's the
  // same underlying event log, just filterable and summarized differently.
  function isoDateOnly(d) {
    if (!d) return '';
    return new Date(d).toISOString().slice(0, 10);
  }
  const [historyFromDate, setHistoryFromDate] = useState(() => isoDateOnly(order?.plannedStartDate));
  const [historyToDate, setHistoryToDate] = useState(() => isoDateOnly(order?.dueDate));
  const [historyWorkCenter, setHistoryWorkCenter] = useState('All');
  const [historyOperation, setHistoryOperation] = useState('All');
  const [historyStatus, setHistoryStatus] = useState('All');

  const historyWorkCenterOptions = Array.from(new Set(operations.map((op) => op.workCenterCode).filter(Boolean)));
  const historyOperationOptions = Array.from(new Set(operations.map((op) => op.operationName).filter(Boolean)));
  const historyRows = executionHistory
    .map((h) => {
      const op = operations.find((o) => o.operationNo === h.operationNo);
      return {
        ...h,
        operationName: op?.operationName || '-',
        status: op?.status || 'Pending',
        reportedQty: Number(h.goodQty || 0) + Number(h.reworkQty || 0) + Number(h.scrapQty || 0),
      };
    })
    .filter((h) => {
      const d = h.dateTime ? isoDateOnly(h.dateTime) : '';
      if (historyFromDate && d && d < historyFromDate) return false;
      if (historyToDate && d && d > historyToDate) return false;
      if (historyWorkCenter !== 'All' && h.workCenterCode !== historyWorkCenter) return false;
      if (historyOperation !== 'All' && h.operationName !== historyOperation) return false;
      if (historyStatus !== 'All' && h.status !== historyStatus) return false;
      return true;
    });
  const historyGoodTotal = historyRows.reduce((sum, h) => sum + Number(h.goodQty || 0), 0);
  const historyReworkTotal = historyRows.reduce((sum, h) => sum + Number(h.reworkQty || 0), 0);
  const historyScrapTotal = historyRows.reduce((sum, h) => sum + Number(h.scrapQty || 0), 0);
  const historyReportedTotal = historyGoodTotal + historyReworkTotal + historyScrapTotal;
  const historyGoodPct = historyReportedTotal > 0 ? Math.round((historyGoodTotal / historyReportedTotal) * 100) : 0;
  const DAILY_PRODUCTION_TREND = Object.values(
    historyRows.reduce((acc, h) => {
      const d = dateFmt(h.dateTime);
      if (!acc[d]) acc[d] = { date: d, qty: 0 };
      acc[d].qty += Number(h.goodQty || 0) + Number(h.reworkQty || 0) + Number(h.scrapQty || 0);
      return acc;
    }, {})
  );
  const handleExportHistory = () => notify.info('Production history exported.');
  const handleSearchHistory = () => notify.info(`Filtered to ${historyRows.length} record(s).`);

  // Product Cost: no real costing module exists in this schema (Phase 1
  // found no cost fields on the real production order at all), so every
  // number on this tab comes from a new `productCost` block added only to
  // the DEMO_PRODUCTION_ORDERS fixture. A real (non-demo) order simply has
  // no `productCost` and the tab shows an honest "not available" state
  // instead of inventing figures.
  const productCost = order?.productCost || null;
  const standardCostTotal = productCost
    ? PRODUCT_COST_ELEMENTS.reduce((sum, el) => sum + Number(productCost.standardCostPerUnit[el.key] || 0), 0)
    : 0;
  const actualCostTotal = productCost
    ? PRODUCT_COST_ELEMENTS.reduce((sum, el) => sum + Number(productCost.actualCostPerUnit[el.key] || 0), 0)
    : 0;
  const costVarianceTotal = actualCostTotal - standardCostTotal;
  const costVarianceTotalPct = standardCostTotal > 0 ? (costVarianceTotal / standardCostTotal) * 100 : 0;
  const PRODUCT_COST_DONUT = productCost
    ? PRODUCT_COST_ELEMENTS.map((el) => ({
      label: el.label.replace(' Cost', ''),
      value: Number(productCost.actualCostPerUnit[el.key] || 0),
      color: PRODUCT_COST_DONUT_COLORS[el.key],
      pct: actualCostTotal > 0 ? Math.round((Number(productCost.actualCostPerUnit[el.key] || 0) / actualCostTotal) * 1000) / 10 : 0,
    }))
    : [];
  // Static rows straight from the fixture -- each row's cost figures are
  // fixed mock values (like the screenshot), not computed from a formula.
  const costHistoryRows = productCost?.costHistory || [];
  const handleRecalculateCost = () => notify.info('Cost recalculated from the current standard and actual rates.');

  // Notes & Attachments: the real order only carries a single free-text
  // `notes` field (used as a fallback below) -- this structured list view
  // is demo-only static content, same as Product Cost above.
  const noteEntries = order?.noteEntries || [];
  const attachmentEntries = order?.attachmentEntries || [];
  const NOTE_TYPE_COLOR = { General: 'info', Production: 'success', Quality: 'warning', Issue: 'error' };
  const notesSummary = noteEntries.reduce((acc, n) => {
    acc[n.type] = (acc[n.type] || 0) + 1;
    return acc;
  }, {});
  function fileTypeIcon(type) {
    if (type === 'PDF') return <PictureAsPdfOutlinedIcon fontSize="small" sx={{ color: '#d32f2f' }} />;
    if (type === 'Excel') return <GridOnOutlinedIcon fontSize="small" sx={{ color: '#2e7d32' }} />;
    if (type === 'Image') return <ImageOutlinedIcon fontSize="small" sx={{ color: '#1976d2' }} />;
    return <InsertDriveFileOutlinedIcon fontSize="small" color="disabled" />;
  }
  function fileSizeFmt(kb) {
    if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
    return `${kb} KB`;
  }
  const attachmentTypeCounts = attachmentEntries.reduce((acc, a) => {
    const key = ['PDF', 'Excel', 'Image'].includes(a.fileType) ? a.fileType : 'Others';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { PDF: 0, Excel: 0, Image: 0, Others: 0 });
  const ATTACHMENT_DONUT = [
    { label: 'PDF', value: attachmentTypeCounts.PDF, color: '#d32f2f' },
    { label: 'Excel', value: attachmentTypeCounts.Excel, color: '#2e7d32' },
    { label: 'Image', value: attachmentTypeCounts.Image, color: '#1976d2' },
    { label: 'Others', value: attachmentTypeCounts.Others, color: '#9c27b0' },
  ].filter((s) => s.value > 0);
  const totalFileSizeKB = attachmentEntries.reduce((sum, a) => sum + Number(a.fileSizeKB || 0), 0);
  const handleAddNote = () => notify.info('Adding notes is not wired up yet.');
  const handleEditNote = () => notify.info('Editing notes is not wired up yet.');
  const handleDeleteNote = () => notify.info('Deleting notes is not wired up yet.');
  const handleUploadFile = () => notify.info('File upload is not wired up yet.');
  const handleDownloadFile = () => notify.info('File download is not wired up yet.');
  const handleViewFile = () => notify.info('File preview is not wired up yet.');
  const handleDeleteFile = () => notify.info('Deleting attachments is not wired up yet.');

  const handleAdvance = async () => {
    if (!nextStatus) return;
    try {
      if (isDemoMode()) {
        await demoUpdate({ id: order.id, status: nextStatus }).unwrap();
      } else {
        await updateStatus({ id: order.id, status: nextStatus }).unwrap();
      }
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
                    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                      <Button size="small" variant="outlined" startIcon={<InventoryOutlinedIcon />} onClick={handleCheckAvailability}>Check Availability</Button>
                      <Button size="small" variant="outlined" startIcon={<BookmarkAddOutlinedIcon />} onClick={handleReserveMaterial}>Reserve Material</Button>
                      <Button size="small" variant="outlined" startIcon={<MenuBookOutlinedIcon />} onClick={handleViewBom}>View BOM</Button>
                    </Stack>
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
                            <TableCell align="right">BOM Qty per Unit</TableCell>
                            <TableCell align="right">Total Required Qty</TableCell>
                            <TableCell align="right">Issued Qty</TableCell>
                            <TableCell align="right">Pending Qty</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {componentsWithStatus.map((c, idx) => {
                            const bomQtyPerUnit = plannedQty > 0 ? Number(c.plannedQty || 0) / plannedQty : 0;
                            return (
                              <TableRow key={c.id} hover>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell><Typography variant="body2" fontWeight={600}>{c.componentProductCode}</Typography></TableCell>
                                <TableCell>{c.componentProductName || '-'}</TableCell>
                                <TableCell>{c.uom || '-'}</TableCell>
                                <TableCell align="right">{bomQtyPerUnit.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</TableCell>
                                <TableCell align="right">{numberFmt(c.plannedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(c.issuedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(Number(c.plannedQty) - Number(c.issuedQty))}</TableCell>
                                <TableCell>
                                  <Chip size="small" label={c.status} color={COMPONENT_STATUS_COLOR[c.status] || 'default'} />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </ScrollableTableContainer>
                  )}
                </>
              )}

              {tab === 1 && (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Operations ({operations.length})</Typography>
                    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                      <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={handleAddOperation}>Add Operation</Button>
                      <Button size="small" variant="outlined" startIcon={<SwapVertOutlinedIcon />} onClick={handleResequence}>Re-sequence</Button>
                      <Button size="small" variant="outlined" startIcon={<RouteOutlinedIcon />} onClick={handleViewRouting}>View Routing</Button>
                      <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExportOperations}>Export</Button>
                    </Stack>
                  </Stack>
                  {operations.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">No operations snapshotted for this order.</Typography>
                    </Box>
                  ) : (
                    <>
                      <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 380px)">
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell padding="checkbox" />
                              <TableCell>S.No</TableCell>
                              <TableCell>Operation No.</TableCell>
                              <TableCell>Operation Description</TableCell>
                              <TableCell>Work Center</TableCell>
                              <TableCell align="right">Run Time (Min/Unit)</TableCell>
                              <TableCell align="right">Planned Qty</TableCell>
                              <TableCell align="right">Completed Qty</TableCell>
                              <TableCell align="right">In Progress Qty</TableCell>
                              <TableCell align="right">Pending Qty</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {operationsWithQty.map((op, idx) => (
                              <TableRow
                                key={op.id} hover selected={selectedOp && selectedOp.id === op.id}
                                onClick={() => setSelectedOpId(op.id)} sx={{ cursor: 'pointer' }}
                              >
                                <TableCell padding="checkbox">
                                  <Checkbox size="small" checked={checkedOps.has(op.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggleOpRow(op.id)} />
                                </TableCell>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{op.operationNo}</TableCell>
                                <TableCell>{op.operationName}</TableCell>
                                <TableCell>{op.workCenterCode || '-'}</TableCell>
                                <TableCell align="right">{op.standardTimeMins ?? '-'}</TableCell>
                                <TableCell align="right">{numberFmt(plannedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(op.completedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(op.inProgressQty)}</TableCell>
                                <TableCell align="right">{numberFmt(op.pendingQty)}</TableCell>
                                <TableCell>
                                  <Chip size="small" label={op.status || 'Pending'} color={OP_STATUS_COLOR[op.status] || 'default'} />
                                </TableCell>
                                <TableCell>
                                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setSelectedOpId(op.id); }}>
                                    <VisibilityOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollableTableContainer>

                      <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} md={6}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5 }}>Operations Progress</Typography>
                              <Box sx={{ width: '100%', height: 260 }}>
                                <ResponsiveContainer>
                                  <BarChart data={OPERATIONS_CHART_DATA} margin={{ top: 8, right: 8, left: -12, bottom: 8 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                                    <YAxis tick={{ fontSize: 11 }} />
                                    <Tooltip />
                                    <Bar dataKey="Completed" fill="#2e7d32" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="In Progress" fill="#1976d2" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Pending" fill="#f57c00" radius={[4, 4, 0, 0]} />
                                  </BarChart>
                                </ResponsiveContainer>
                              </Box>
                              <Stack direction="row" spacing={2.5} justifyContent="center" sx={{ mt: 1 }}>
                                {[['Completed', 'success.main'], ['In Progress', 'info.main'], ['Pending', 'warning.main']].map(([label, color]) => (
                                  <Stack key={label} direction="row" spacing={0.75} alignItems="center">
                                    <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: color }} />
                                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                                  </Stack>
                                ))}
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                          <Card variant="outlined" sx={{ height: '100%' }}>
                            <CardContent>
                              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>Operation Sequence</Typography>
                              <Stack direction="row" alignItems="center" flexWrap="wrap" useFlexGap spacing={1}>
                                {operationsWithQty.map((op, idx) => {
                                  const meta = OP_SEQUENCE_META[op.status] || OP_SEQUENCE_META.Pending;
                                  const Icon = meta.icon;
                                  return (
                                    <React.Fragment key={op.id}>
                                      <Box
                                        onClick={() => setSelectedOpId(op.id)}
                                        sx={{
                                          cursor: 'pointer', textAlign: 'center', borderRadius: 2, p: 1.5, minWidth: 92,
                                          bgcolor: meta.bg, border: '1px solid', borderColor: selectedOp && selectedOp.id === op.id ? meta.color : meta.border,
                                        }}
                                      >
                                        <Typography variant="h6" fontWeight={700} color={meta.color}>{op.operationNo}</Typography>
                                        <Typography variant="caption" display="block" fontWeight={600}>{op.operationName}</Typography>
                                        <Typography variant="caption" display="block" color="text.secondary">{op.workCenterCode || '-'}</Typography>
                                        <Stack direction="row" spacing={0.5} justifyContent="center" alignItems="center" sx={{ mt: 0.5 }}>
                                          <Icon sx={{ fontSize: 14, color: meta.color }} />
                                          <Typography variant="caption" color={meta.color} fontWeight={600}>{op.status || 'Pending'}</Typography>
                                        </Stack>
                                      </Box>
                                      {idx < operationsWithQty.length - 1 && <ArrowForwardIcon sx={{ color: 'text.disabled' }} />}
                                    </React.Fragment>
                                  );
                                })}
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      </Grid>
                    </>
                  )}
                </>
              )}

              {tab === 2 && (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Production Execution ({executionRows.length})</Typography>
                    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                      <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={handleReportProduction}>Report Production</Button>
                      <Button size="small" variant="outlined" startIcon={<ScheduleOutlinedIcon />} onClick={handlePauseOperation}>Pause Operation</Button>
                      <Button size="small" variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={handleHoldOrder}>Hold Order</Button>
                      <Button size="small" variant="outlined" startIcon={<SettingsIcon />} onClick={handleViewShopFloor}>View Shop Floor</Button>
                    </Stack>
                  </Stack>
                  {executionRows.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">No operations to execute for this order.</Typography>
                    </Box>
                  ) : (
                    <>
                      <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 340px)">
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell padding="checkbox" />
                              <TableCell>S.No</TableCell>
                              <TableCell>Operation No.</TableCell>
                              <TableCell>Operation Description</TableCell>
                              <TableCell>Work Center</TableCell>
                              <TableCell align="right">Planned Qty</TableCell>
                              <TableCell align="right">Good Qty</TableCell>
                              <TableCell align="right">Rework Qty</TableCell>
                              <TableCell align="right">Scrap Qty</TableCell>
                              <TableCell align="right">Total Qty</TableCell>
                              <TableCell>Start Date</TableCell>
                              <TableCell>End Date</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {executionRows.map((op, idx) => (
                              <TableRow key={op.id} hover>
                                <TableCell padding="checkbox">
                                  <Checkbox size="small" checked={checkedOps.has(op.id)} onChange={() => toggleOpRow(op.id)} />
                                </TableCell>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{op.operationNo}</TableCell>
                                <TableCell>{op.operationName}</TableCell>
                                <TableCell>{op.workCenterCode || '-'}</TableCell>
                                <TableCell align="right">{numberFmt(plannedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(op.goodQty)}</TableCell>
                                <TableCell align="right">{numberFmt(op.reworkQty)}</TableCell>
                                <TableCell align="right">{numberFmt(op.scrapQty)}</TableCell>
                                <TableCell align="right">{numberFmt(op.goodQty + op.reworkQty + op.scrapQty)}</TableCell>
                                <TableCell>{dateFmt(op.startDate)}</TableCell>
                                <TableCell>{dateFmt(op.endDate)}</TableCell>
                                <TableCell>
                                  <Chip size="small" label={op.status || 'Pending'} color={OP_STATUS_COLOR[op.status] || 'default'} />
                                </TableCell>
                                <TableCell>
                                  <Button size="small" endIcon={<VisibilityOutlinedIcon fontSize="small" />} onClick={() => { setTab(1); setSelectedOpId(op.id); }}>View</Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollableTableContainer>

                      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1.5 }}>Production Execution History</Typography>
                      {executionHistory.length === 0 ? (
                        <Box sx={{ py: 4, textAlign: 'center' }}>
                          <Typography variant="body2" color="text.secondary">No production has been reported against this order yet.</Typography>
                        </Box>
                      ) : (
                        <ScrollableTableContainer maxHeight="clamp(180px, calc(100vh - 760px), 260px)">
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell>S.No</TableCell>
                                <TableCell>Date &amp; Time</TableCell>
                                <TableCell>Operation No.</TableCell>
                                <TableCell>Work Center</TableCell>
                                <TableCell align="right">Reported Qty</TableCell>
                                <TableCell align="right">Good Qty</TableCell>
                                <TableCell align="right">Rework Qty</TableCell>
                                <TableCell align="right">Scrap Qty</TableCell>
                                <TableCell>Reported By</TableCell>
                                <TableCell>Remarks</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {executionHistory.map((h, idx) => (
                                <TableRow key={h.id || idx} hover>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell>{dateTimeFmt(h.dateTime)}</TableCell>
                                  <TableCell>{h.operationNo}</TableCell>
                                  <TableCell>{h.workCenterCode || '-'}</TableCell>
                                  <TableCell align="right">{numberFmt(Number(h.goodQty || 0) + Number(h.reworkQty || 0) + Number(h.scrapQty || 0))}</TableCell>
                                  <TableCell align="right">{numberFmt(h.goodQty)}</TableCell>
                                  <TableCell align="right">{numberFmt(h.reworkQty)}</TableCell>
                                  <TableCell align="right">{numberFmt(h.scrapQty)}</TableCell>
                                  <TableCell>{h.reportedBy}</TableCell>
                                  <TableCell>{h.remarks}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollableTableContainer>
                      )}
                    </>
                  )}
                </>
              )}

              {tab === 3 && (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Material Issue Transactions ({materialIssueRows.length})</Typography>
                    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                      <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={handleIssueMaterial}>Issue Material</Button>
                      <Button size="small" variant="outlined" startIcon={<SwapVertOutlinedIcon />} onClick={handleReturnMaterial}>Return Material</Button>
                      <Button size="small" variant="outlined" startIcon={<InventoryOutlinedIcon />} onClick={handleViewStock}>View Stock</Button>
                      <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExportMaterialIssue}>Export</Button>
                    </Stack>
                  </Stack>
                  {materialIssueRows.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">No material has been issued against this order yet.</Typography>
                    </Box>
                  ) : (
                    <>
                      <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 340px)">
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell padding="checkbox" />
                              <TableCell>S.No</TableCell>
                              <TableCell>Issue No.</TableCell>
                              <TableCell>Issue Date</TableCell>
                              <TableCell>Component Code</TableCell>
                              <TableCell>Component Description</TableCell>
                              <TableCell align="right">Required Qty</TableCell>
                              <TableCell align="right">Issued Qty</TableCell>
                              <TableCell align="right">Balance Qty</TableCell>
                              <TableCell>Issued To</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {materialIssueRows.map((m, idx) => (
                              <TableRow key={m.id} hover>
                                <TableCell padding="checkbox">
                                  <Checkbox size="small" checked={checkedOps.has(`mi-${m.id}`)} onChange={() => toggleOpRow(`mi-${m.id}`)} />
                                </TableCell>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{m.docNo}</Typography></TableCell>
                                <TableCell>{dateFmt(m.date)}</TableCell>
                                <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{m.componentProductCode}</Typography></TableCell>
                                <TableCell>{m.componentProductName}</TableCell>
                                <TableCell align="right">{numberFmt(m.requiredQty)}</TableCell>
                                <TableCell align="right">{numberFmt(m.issuedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(m.balanceQty)}</TableCell>
                                <TableCell>{m.store}</TableCell>
                                <TableCell>
                                  <Chip size="small" label={m.status === 'Partial' ? 'Partially Issued' : m.status} color={COMPONENT_STATUS_COLOR[m.status] || 'default'} />
                                </TableCell>
                                <TableCell>
                                  <Button size="small" onClick={() => setTab(0)}>View</Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollableTableContainer>

                      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1.5 }}>Material Issue History</Typography>
                      <ScrollableTableContainer maxHeight="clamp(180px, calc(100vh - 760px), 260px)">
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>S.No</TableCell>
                              <TableCell>Issue No.</TableCell>
                              <TableCell>Issue Date</TableCell>
                              <TableCell>Component Code</TableCell>
                              <TableCell>Component Description</TableCell>
                              <TableCell align="right">Issued Qty</TableCell>
                              <TableCell>Issued To</TableCell>
                              <TableCell>Issued By</TableCell>
                              <TableCell>Remarks</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {materialIssueRows.map((m, idx) => (
                              <TableRow key={m.id} hover>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{m.docNo}</Typography></TableCell>
                                <TableCell>{dateFmt(m.date)}</TableCell>
                                <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{m.componentProductCode}</Typography></TableCell>
                                <TableCell>{m.componentProductName}</TableCell>
                                <TableCell align="right">{numberFmt(m.issuedQty)}</TableCell>
                                <TableCell>{m.store}</TableCell>
                                <TableCell>{m.issuedBy}</TableCell>
                                <TableCell>{m.remarks || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollableTableContainer>
                    </>
                  )}
                </>
              )}

              {tab === 4 && (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Material Receipt Transactions ({materialReceiptRows.length})</Typography>
                    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
                      <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={handleReceiveMaterial}>Receive Material</Button>
                      <Button size="small" variant="outlined" startIcon={<InventoryOutlinedIcon />} onClick={handleViewReceiptStock}>View Stock</Button>
                      <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExportMaterialReceipt}>Export</Button>
                    </Stack>
                  </Stack>
                  {materialReceiptRows.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">No finished goods have been received against this order yet.</Typography>
                    </Box>
                  ) : (
                    <>
                      <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 340px)">
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell padding="checkbox" />
                              <TableCell>S.No</TableCell>
                              <TableCell>Receipt No.</TableCell>
                              <TableCell>Receipt Date</TableCell>
                              <TableCell>Product Code</TableCell>
                              <TableCell>Product Description</TableCell>
                              <TableCell>UOM</TableCell>
                              <TableCell align="right">Expected Qty</TableCell>
                              <TableCell align="right">Received Qty</TableCell>
                              <TableCell align="right">Accepted Qty</TableCell>
                              <TableCell align="right">Rejected Qty</TableCell>
                              <TableCell>Received To</TableCell>
                              <TableCell>Status</TableCell>
                              <TableCell>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {materialReceiptRows.map((m, idx) => (
                              <TableRow key={m.id} hover>
                                <TableCell padding="checkbox">
                                  <Checkbox size="small" checked={checkedOps.has(`mr-${m.id}`)} onChange={() => toggleOpRow(`mr-${m.id}`)} />
                                </TableCell>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{m.docNo}</Typography></TableCell>
                                <TableCell>{dateFmt(m.date)}</TableCell>
                                <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{order.productCode}</Typography></TableCell>
                                <TableCell>{order.productName || '-'}</TableCell>
                                <TableCell>{order.uom || '-'}</TableCell>
                                <TableCell align="right">{numberFmt(m.expectedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(m.receivedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(m.acceptedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(m.rejectedQty)}</TableCell>
                                <TableCell>{m.warehouse}</TableCell>
                                <TableCell>
                                  <Chip size="small" label={m.status} color={RECEIPT_STATUS_COLOR[m.status] || 'default'} />
                                </TableCell>
                                <TableCell>
                                  <Button size="small" onClick={() => setTab(2)}>View</Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollableTableContainer>

                      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1.5 }}>Material Receipt History</Typography>
                      <ScrollableTableContainer maxHeight="clamp(180px, calc(100vh - 760px), 260px)">
                        <Table size="small" stickyHeader>
                          <TableHead>
                            <TableRow>
                              <TableCell>S.No</TableCell>
                              <TableCell>Date</TableCell>
                              <TableCell>Receipt No.</TableCell>
                              <TableCell align="right">Received Qty</TableCell>
                              <TableCell align="right">Accepted Qty</TableCell>
                              <TableCell align="right">Rejected Qty</TableCell>
                              <TableCell>Received To</TableCell>
                              <TableCell>Received By</TableCell>
                              <TableCell>Remarks</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {materialReceiptRows.map((m, idx) => (
                              <TableRow key={m.id} hover>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell>{dateFmt(m.date)}</TableCell>
                                <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{m.docNo}</Typography></TableCell>
                                <TableCell align="right">{numberFmt(m.receivedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(m.acceptedQty)}</TableCell>
                                <TableCell align="right">{numberFmt(m.rejectedQty)}</TableCell>
                                <TableCell>{m.warehouse}</TableCell>
                                <TableCell>{m.receivedBy}</TableCell>
                                <TableCell>{m.remarks || '-'}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollableTableContainer>
                    </>
                  )}
                </>
              )}

              {tab === 5 && (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Production History</Typography>
                    <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon fontSize="small" />} onClick={handleExportHistory}>
                      Export
                    </Button>
                  </Stack>

                  <Stack direction="row" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <TextField
                      label="From Date" type="date" size="small" InputLabelProps={{ shrink: true }}
                      value={historyFromDate} onChange={(e) => setHistoryFromDate(e.target.value)}
                      sx={{ minWidth: 150 }}
                    />
                    <TextField
                      label="To Date" type="date" size="small" InputLabelProps={{ shrink: true }}
                      value={historyToDate} onChange={(e) => setHistoryToDate(e.target.value)}
                      sx={{ minWidth: 150 }}
                    />
                    <TextField
                      select label="Work Center" size="small" value={historyWorkCenter}
                      onChange={(e) => setHistoryWorkCenter(e.target.value)} sx={{ minWidth: 150 }}
                    >
                      <MenuItem value="All">All</MenuItem>
                      {historyWorkCenterOptions.map((wc) => <MenuItem key={wc} value={wc}>{wc}</MenuItem>)}
                    </TextField>
                    <TextField
                      select label="Operation" size="small" value={historyOperation}
                      onChange={(e) => setHistoryOperation(e.target.value)} sx={{ minWidth: 150 }}
                    >
                      <MenuItem value="All">All</MenuItem>
                      {historyOperationOptions.map((op) => <MenuItem key={op} value={op}>{op}</MenuItem>)}
                    </TextField>
                    <TextField
                      select label="Status" size="small" value={historyStatus}
                      onChange={(e) => setHistoryStatus(e.target.value)} sx={{ minWidth: 150 }}
                    >
                      <MenuItem value="All">All</MenuItem>
                      {OP_STATUS_LIST.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                    <Button size="small" variant="contained" onClick={handleSearchHistory} sx={{ height: 40 }}>
                      Search
                    </Button>
                  </Stack>

                  {historyRows.length === 0 ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">No production reported for this order yet.</Typography>
                    </Box>
                  ) : (
                    <ScrollableTableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>S.No</TableCell>
                            <TableCell>Date &amp; Time</TableCell>
                            <TableCell>Operation No.</TableCell>
                            <TableCell>Operation Description</TableCell>
                            <TableCell>Work Center</TableCell>
                            <TableCell align="right">Reported Qty</TableCell>
                            <TableCell align="right">Good Qty</TableCell>
                            <TableCell align="right">Rework Qty</TableCell>
                            <TableCell align="right">Scrap Qty</TableCell>
                            <TableCell>Operator</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Remarks</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {historyRows.map((h, idx) => (
                            <TableRow key={h.id ?? idx} hover>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>{dateTimeFmt(h.dateTime)}</TableCell>
                              <TableCell>{h.operationNo}</TableCell>
                              <TableCell>{h.operationName}</TableCell>
                              <TableCell>{h.workCenterCode}</TableCell>
                              <TableCell align="right">{numberFmt(h.reportedQty)}</TableCell>
                              <TableCell align="right">{numberFmt(h.goodQty)}</TableCell>
                              <TableCell align="right">{numberFmt(h.reworkQty)}</TableCell>
                              <TableCell align="right">{numberFmt(h.scrapQty)}</TableCell>
                              <TableCell>{h.reportedBy}</TableCell>
                              <TableCell><Chip size="small" label={h.status} color={OP_STATUS_COLOR[h.status] || 'default'} /></TableCell>
                              <TableCell>{h.remarks || '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollableTableContainer>
                  )}
                </>
              )}

              {tab === 6 && (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Product Cost Details</Typography>
                    {productCost && (
                      <Button size="small" variant="outlined" onClick={handleRecalculateCost}>
                        Recalculate Cost
                      </Button>
                    )}
                  </Stack>

                  {!productCost ? (
                    <Box sx={{ py: 6, textAlign: 'center' }}>
                      <Typography variant="body2" color="text.secondary">Cost data is not available for this order yet.</Typography>
                    </Box>
                  ) : (
                    <>
                      <ScrollableTableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>S.No</TableCell>
                              <TableCell>Cost Element</TableCell>
                              <TableCell>Description</TableCell>
                              <TableCell align="right">Standard Cost</TableCell>
                              <TableCell align="right">Actual Cost</TableCell>
                              <TableCell align="right">Variance</TableCell>
                              <TableCell align="right">Variance %</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {PRODUCT_COST_ELEMENTS.map((el, idx) => {
                              const std = productCost.standardCostPerUnit[el.key] || 0;
                              const act = productCost.actualCostPerUnit[el.key] || 0;
                              const variance = act - std;
                              const variancePct = std > 0 ? (variance / std) * 100 : 0;
                              return (
                                <TableRow key={el.key} hover>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell>{el.label}</TableCell>
                                  <TableCell>{el.description}</TableCell>
                                  <TableCell align="right">{currencyFmt(std)}</TableCell>
                                  <TableCell align="right">{currencyFmt(act)}</TableCell>
                                  <TableCell align="right" sx={{ color: variance > 0 ? 'error.main' : variance < 0 ? 'success.main' : 'text.primary' }}>
                                    {variance > 0 ? '+' : ''}{currencyFmt(variance)}
                                  </TableCell>
                                  <TableCell align="right" sx={{ color: variance > 0 ? 'error.main' : variance < 0 ? 'success.main' : 'text.primary' }}>
                                    {variancePct > 0 ? '+' : ''}{variancePct.toFixed(1)}%
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow>
                              <TableCell colSpan={3}><Typography variant="body2" fontWeight={700}>Total Product Cost (Per Unit)</Typography></TableCell>
                              <TableCell align="right"><Typography variant="body2" fontWeight={700}>{currencyFmt(standardCostTotal)}</Typography></TableCell>
                              <TableCell align="right"><Typography variant="body2" fontWeight={700}>{currencyFmt(actualCostTotal)}</Typography></TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={700} color={costVarianceTotal > 0 ? 'error.main' : costVarianceTotal < 0 ? 'success.main' : 'text.primary'}>
                                  {costVarianceTotal > 0 ? '+' : ''}{currencyFmt(costVarianceTotal)}
                                </Typography>
                              </TableCell>
                              <TableCell align="right">
                                <Typography variant="body2" fontWeight={700} color={costVarianceTotal > 0 ? 'error.main' : costVarianceTotal < 0 ? 'success.main' : 'text.primary'}>
                                  {costVarianceTotalPct > 0 ? '+' : ''}{costVarianceTotalPct.toFixed(1)}%
                                </Typography>
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </ScrollableTableContainer>

                      <Typography variant="subtitle1" fontWeight={700} sx={{ mt: 3, mb: 1.5 }}>Product Cost History</Typography>
                      {costHistoryRows.length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No cost has been incurred against this order yet.</Typography>
                      ) : (
                        <ScrollableTableContainer>
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>S.No</TableCell>
                                <TableCell>Date</TableCell>
                                <TableCell align="right">Produced Qty</TableCell>
                                <TableCell align="right">Raw Material</TableCell>
                                <TableCell align="right">Consumables</TableCell>
                                <TableCell align="right">Direct Labour</TableCell>
                                <TableCell align="right">Machine Overhead</TableCell>
                                <TableCell align="right">Fixed Overhead</TableCell>
                                <TableCell align="right">Total Cost</TableCell>
                                <TableCell align="right">Cost Per Unit</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {costHistoryRows.map((r, idx) => (
                                <TableRow key={r.id ?? idx} hover>
                                  <TableCell>{idx + 1}</TableCell>
                                  <TableCell>{dateFmt(r.date)}</TableCell>
                                  <TableCell align="right">{numberFmt(r.producedQty)}</TableCell>
                                  <TableCell align="right">{currencyFmt(r.rawMaterial)}</TableCell>
                                  <TableCell align="right">{currencyFmt(r.consumables)}</TableCell>
                                  <TableCell align="right">{currencyFmt(r.directLabour)}</TableCell>
                                  <TableCell align="right">{currencyFmt(r.machineOverhead)}</TableCell>
                                  <TableCell align="right">{currencyFmt(r.fixedOverhead)}</TableCell>
                                  <TableCell align="right">{currencyFmt(r.totalCost)}</TableCell>
                                  <TableCell align="right">{currencyFmt(r.costPerUnit)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </ScrollableTableContainer>
                      )}
                    </>
                  )}
                </>
              )}

              {tab === 7 && (
                <>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Notes ({noteEntries.length})</Typography>
                    <Button size="small" variant="contained" startIcon={<AddIcon fontSize="small" />} onClick={handleAddNote}>
                      Add Note
                    </Button>
                  </Stack>

                  {noteEntries.length === 0 ? (
                    order.notes ? (
                      <Typography variant="body2" sx={{ mb: 3 }}>{order.notes}</Typography>
                    ) : (
                      <Box sx={{ py: 3 }}>
                        <Typography variant="body2" color="text.secondary">No notes added for this order.</Typography>
                      </Box>
                    )
                  ) : (
                    <ScrollableTableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>S.No</TableCell>
                            <TableCell>Date &amp; Time</TableCell>
                            <TableCell>Note Type</TableCell>
                            <TableCell>Title</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Added By</TableCell>
                            <TableCell>Visibility</TableCell>
                            <TableCell>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {noteEntries.map((n, idx) => (
                            <TableRow key={n.id ?? idx} hover>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>{dateTimeFmt(n.dateTime)}</TableCell>
                              <TableCell><Chip size="small" label={n.type} color={NOTE_TYPE_COLOR[n.type] || 'default'} /></TableCell>
                              <TableCell>{n.title}</TableCell>
                              <TableCell>{n.description}</TableCell>
                              <TableCell>{n.addedBy}</TableCell>
                              <TableCell>{n.visibility}</TableCell>
                              <TableCell>
                                <IconButton size="small" onClick={handleEditNote}><EditOutlinedIcon fontSize="small" /></IconButton>
                                <IconButton size="small" onClick={handleDeleteNote}><DeleteOutlineIcon fontSize="small" color="error" /></IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollableTableContainer>
                  )}

                  <Divider sx={{ my: 3 }} />

                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Attachments ({attachmentEntries.length})</Typography>
                    <Stack direction="row" spacing={1}>
                      <Button size="small" variant="contained" startIcon={<CloudUploadOutlinedIcon fontSize="small" />} onClick={handleUploadFile}>
                        Upload File
                      </Button>
                      <Button size="small" variant="outlined" startIcon={<FileDownloadOutlinedIcon fontSize="small" />} onClick={handleDownloadFile}>
                        Download
                      </Button>
                      <Button size="small" variant="outlined" startIcon={<VisibilityOutlinedIcon fontSize="small" />} onClick={handleViewFile}>
                        View
                      </Button>
                      <Button size="small" variant="outlined" color="error" startIcon={<DeleteOutlineIcon fontSize="small" />} onClick={handleDeleteFile}>
                        Delete
                      </Button>
                    </Stack>
                  </Stack>

                  {attachmentEntries.length === 0 ? (
                    <Box sx={{ py: 3 }}>
                      <Typography variant="body2" color="text.secondary">No attachments added for this order.</Typography>
                    </Box>
                  ) : (
                    <ScrollableTableContainer>
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell padding="checkbox"><Checkbox size="small" /></TableCell>
                            <TableCell>S.No</TableCell>
                            <TableCell>File Name</TableCell>
                            <TableCell>File Type</TableCell>
                            <TableCell>File Size</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Uploaded By</TableCell>
                            <TableCell>Uploaded On</TableCell>
                            <TableCell>Action</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {attachmentEntries.map((a, idx) => (
                            <TableRow key={a.id ?? idx} hover>
                              <TableCell padding="checkbox"><Checkbox size="small" /></TableCell>
                              <TableCell>{idx + 1}</TableCell>
                              <TableCell>
                                <Stack direction="row" spacing={1} alignItems="center">
                                  {fileTypeIcon(a.fileType)}
                                  <Typography variant="body2">{a.fileName}</Typography>
                                </Stack>
                              </TableCell>
                              <TableCell>{a.fileType}</TableCell>
                              <TableCell>{fileSizeFmt(a.fileSizeKB)}</TableCell>
                              <TableCell>{a.description}</TableCell>
                              <TableCell>{a.uploadedBy}</TableCell>
                              <TableCell>{dateTimeFmt(a.uploadedOn)}</TableCell>
                              <TableCell>
                                <IconButton size="small" onClick={handleViewFile}><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                                <IconButton size="small" onClick={handleDownloadFile}><FileDownloadOutlinedIcon fontSize="small" /></IconButton>
                                <IconButton size="small" onClick={handleDeleteFile}><DeleteOutlineIcon fontSize="small" color="error" /></IconButton>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollableTableContainer>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right rail */}
        <Grid item xs={12} lg={3.5}>
          {tab === 1 && selectedOp && (
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Operation Details</Typography>
                <Stack spacing={1}>
                  {[
                    ['Operation No.', selectedOp.operationNo],
                    ['Operation Desc.', selectedOp.operationName],
                    ['Work Center', selectedOp.workCenterCode || '-'],
                    ['Run Time', selectedOp.standardTimeMins != null ? `${selectedOp.standardTimeMins} Min/Unit` : '-'],
                    ['Planned Qty', `${numberFmt(plannedQty)} ${order.uom || ''}`.trim()],
                    ['Completed Qty', `${numberFmt(selectedOp.completedQty)} ${order.uom || ''}`.trim()],
                    ['In Progress Qty', `${numberFmt(selectedOp.inProgressQty)} ${order.uom || ''}`.trim()],
                    ['Pending Qty', `${numberFmt(selectedOp.pendingQty)} ${order.uom || ''}`.trim()],
                  ].map(([label, value]) => (
                    <Stack key={label} direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">{label}</Typography>
                      <Typography variant="caption" fontWeight={600}>{value}</Typography>
                    </Stack>
                  ))}
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Status</Typography>
                    <Chip size="small" label={selectedOp.status || 'Pending'} color={OP_STATUS_COLOR[selectedOp.status] || 'default'} />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          )}

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

          {tab === 1 && selectedOp && (
            <Card variant="outlined" sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Work Center Capacity</Typography>
                {selectedOpWorkCenter ? (
                  <Stack spacing={0.75}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Available (Today)</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(selectedOpWorkCenter.capacityPerDay * 60)} Min</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Planned</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(selectedOp.standardTimeMins || 0)} Min</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Actual</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(selectedOp.standardTimeMins || 0)} Min</Typography>
                    </Stack>
                    <Divider sx={{ my: 0.5 }} />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Variance</Typography>
                      <Typography variant="caption" fontWeight={700}>0 Min</Typography>
                    </Stack>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">Work center capacity isn't tracked for this order yet.</Typography>
                )}
              </CardContent>
            </Card>
          )}

          {tab === 2 && (
            <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Execution Summary</Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={EXECUTION_DONUT} dataKey="value" nameKey="label" innerRadius={34} outerRadius={52} paddingAngle={2}>
                            {EXECUTION_DONUT.map((s) => <Cell key={s.label} fill={s.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <Box sx={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="body2" fontWeight={700}>{execProgressPct}%</Typography>
                      </Box>
                    </Box>
                    <Stack spacing={0.5}>
                      {[
                        ['Planned Qty', plannedQty],
                        ['Produced Qty', execGoodTotal],
                        ['Rework Qty', execReworkTotal],
                        ['Scrap Qty', execScrapTotal],
                        ['Balance Qty', execBalance],
                      ].map(([label, value]) => (
                        <Stack key={label} direction="row" justifyContent="space-between" spacing={1.5}>
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography variant="caption" fontWeight={700}>: {numberFmt(value)}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Operation Wise Progress</Typography>
                  {executionRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No operations for this order.</Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      {executionRows.map((op) => {
                        const pct = op.status === 'Completed' ? 100
                          : op.status === 'In Progress' ? (plannedQty > 0 ? Math.min(99, Math.round((op.goodQty / plannedQty) * 100)) : 0)
                          : 0;
                        return (
                          <Box key={op.id}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">{op.operationName}</Typography>
                              <Typography variant="caption" fontWeight={700}>{pct}%</Typography>
                            </Stack>
                            <Box sx={{ height: 7, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                              <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: pct === 100 ? 'success.main' : pct > 0 ? 'info.main' : 'transparent' }} />
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Consumption</Typography>
                  {components.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No components snapshotted for this order.</Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ px: 0.5 }}>S.No</TableCell>
                          <TableCell sx={{ px: 0.5 }}>Component Code</TableCell>
                          <TableCell sx={{ px: 0.5 }} align="right">Required Qty</TableCell>
                          <TableCell sx={{ px: 0.5 }} align="right">Issued Qty</TableCell>
                          <TableCell sx={{ px: 0.5 }} align="right">Balance Qty</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {components.map((c, idx) => (
                          <TableRow key={c.id}>
                            <TableCell sx={{ px: 0.5 }}>{idx + 1}</TableCell>
                            <TableCell sx={{ px: 0.5 }}><Typography variant="caption" color="primary.main" fontWeight={600}>{c.componentProductCode}</Typography></TableCell>
                            <TableCell sx={{ px: 0.5 }} align="right"><Typography variant="caption">{numberFmt(c.plannedQty)}</Typography></TableCell>
                            <TableCell sx={{ px: 0.5 }} align="right"><Typography variant="caption">{numberFmt(c.issuedQty)}</Typography></TableCell>
                            <TableCell sx={{ px: 0.5 }} align="right"><Typography variant="caption">{numberFmt(Number(c.plannedQty) - Number(c.issuedQty))}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <Button
                    fullWidth variant="outlined" startIcon={<DescriptionOutlinedIcon />}
                    sx={{ mt: 1.5 }} onClick={() => setTab(3)}
                  >
                    View Material Issue
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {tab === 3 && (
            <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Issue Summary</Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={MATERIAL_ISSUE_DONUT} dataKey="value" nameKey="label" innerRadius={30} outerRadius={46} paddingAngle={2}>
                            {MATERIAL_ISSUE_DONUT.map((s) => <Cell key={s.label} fill={s.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <Box sx={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="body2" fontWeight={700}>{materialIssueIssuedCountPct}%</Typography>
                      </Box>
                    </Box>
                    <Stack spacing={0.5}>
                      {MATERIAL_ISSUE_DONUT.map((s) => (
                        <Stack key={s.label} direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                          <Typography variant="caption" color="text.secondary">{s.label} : {s.value}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
                    <Typography variant="body2" fontWeight={700}>Material Issue Progress</Typography>
                    <Typography variant="body2" fontWeight={700} color="success.main">{materialIssueProgressPct}%</Typography>
                  </Stack>
                  <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden', mb: 1.5 }}>
                    <Box sx={{ height: '100%', width: `${materialIssueProgressPct}%`, bgcolor: 'success.main' }} />
                  </Box>
                  <Stack spacing={0.75}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Total Required Qty</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(totalRequiredQty)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Total Issued Qty</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(totalIssuedQty)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Balance Qty</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(materialIssueBalanceQty)}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Pending Material Issue</Typography>
                  {pendingMaterialIssues.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">Nothing pending -- all components are fully issued.</Typography>
                  ) : (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ px: 0.5 }}>S.No</TableCell>
                          <TableCell sx={{ px: 0.5 }}>Component Code</TableCell>
                          <TableCell sx={{ px: 0.5 }}>Component Description</TableCell>
                          <TableCell sx={{ px: 0.5 }} align="right">Pending Qty</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {pendingMaterialIssues.map((c, idx) => (
                          <TableRow key={c.id}>
                            <TableCell sx={{ px: 0.5 }}>{idx + 1}</TableCell>
                            <TableCell sx={{ px: 0.5 }}><Typography variant="caption" color="primary.main" fontWeight={600}>{c.componentProductCode}</Typography></TableCell>
                            <TableCell sx={{ px: 0.5 }}><Typography variant="caption">{c.componentProductName}</Typography></TableCell>
                            <TableCell sx={{ px: 0.5 }} align="right"><Typography variant="caption" fontWeight={600}>{numberFmt(Number(c.plannedQty) - Number(c.issuedQty))}</Typography></TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                  <Button
                    fullWidth variant="contained" startIcon={<AddIcon />}
                    sx={{ mt: 1.5 }} onClick={handleCreateMaterialRequisition}
                  >
                    Create Material Requisition
                  </Button>
                </CardContent>
              </Card>
            </>
          )}

          {tab === 4 && (
            <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Receipt Summary</Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={MATERIAL_RECEIPT_DONUT} dataKey="value" nameKey="label" innerRadius={30} outerRadius={46} paddingAngle={2}>
                            {MATERIAL_RECEIPT_DONUT.map((s) => <Cell key={s.label} fill={s.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <Box sx={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="body2" fontWeight={700}>{materialReceiptPct}%</Typography>
                      </Box>
                    </Box>
                    <Stack spacing={0.5}>
                      {MATERIAL_RECEIPT_DONUT.map((s) => (
                        <Stack key={s.label} direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                          <Typography variant="caption" color="text.secondary">{s.label} : {s.value}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                  <Stack spacing={0.75} sx={{ mt: 2 }}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Total Expected Qty</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(totalExpectedQty)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Total Received Qty</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(totalReceivedQty)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Total Accepted Qty</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(totalAcceptedQty)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Total Rejected Qty</Typography>
                      <Typography variant="caption" fontWeight={700} color="error.main">{numberFmt(totalRejectedQty)}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Receipt Progress</Typography>
                  {materialReceiptRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No receipts recorded for this order yet.</Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      {materialReceiptRows.map((m) => {
                        const pct = m.expectedQty > 0 ? Math.round((m.receivedQty / m.expectedQty) * 100) : 0;
                        return (
                          <Box key={m.id}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">{m.docNo}</Typography>
                              <Typography variant="caption" fontWeight={700}>{pct}%</Typography>
                            </Stack>
                            <Box sx={{ height: 7, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                              <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: pct >= 100 ? 'success.main' : pct > 0 ? 'info.main' : 'transparent' }} />
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {tab === 5 && (
            <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Production History Summary</Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={[
                              { label: 'Good', value: historyGoodTotal, color: '#2e7d32' },
                              { label: 'Rework', value: historyReworkTotal, color: '#ed6c02' },
                              { label: 'Scrap', value: historyScrapTotal, color: '#d32f2f' },
                            ]}
                            dataKey="value" nameKey="label" innerRadius={30} outerRadius={46} paddingAngle={2}
                          >
                            {[
                              { label: 'Good', color: '#2e7d32' },
                              { label: 'Rework', color: '#ed6c02' },
                              { label: 'Scrap', color: '#d32f2f' },
                            ].map((s) => <Cell key={s.label} fill={s.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <Box sx={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="body2" fontWeight={700}>{historyGoodPct}%</Typography>
                      </Box>
                    </Box>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">Total Reported Qty : {numberFmt(historyReportedTotal)}</Typography>
                      <Typography variant="caption" color="text.secondary">Good Qty : {numberFmt(historyGoodTotal)}</Typography>
                      <Typography variant="caption" color="text.secondary">Rework Qty : {numberFmt(historyReworkTotal)}</Typography>
                      <Typography variant="caption" color="text.secondary">Scrap Qty : {numberFmt(historyScrapTotal)}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Operation Wise Production</Typography>
                  {executionRows.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No operations for this order.</Typography>
                  ) : (
                    <Stack spacing={1.5}>
                      {executionRows.map((op) => {
                        const pct = op.status === 'Completed' ? 100
                          : op.status === 'In Progress' ? (plannedQty > 0 ? Math.min(99, Math.round((op.goodQty / plannedQty) * 100)) : 0)
                          : 0;
                        return (
                          <Box key={op.id}>
                            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                              <Typography variant="caption" color="text.secondary">{op.operationName}</Typography>
                              <Typography variant="caption" fontWeight={700}>{pct}%</Typography>
                            </Stack>
                            <Box sx={{ height: 7, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                              <Box sx={{ height: '100%', width: `${pct}%`, bgcolor: pct === 100 ? 'success.main' : pct > 0 ? 'info.main' : 'transparent' }} />
                            </Box>
                          </Box>
                        );
                      })}
                    </Stack>
                  )}
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Daily Production Trend</Typography>
                  {DAILY_PRODUCTION_TREND.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No production reported yet.</Typography>
                  ) : (
                    <Box sx={{ width: '100%', height: 180 }}>
                      <ResponsiveContainer>
                        <BarChart data={DAILY_PRODUCTION_TREND}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="qty" fill="#1976d2" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {tab === 6 && productCost && (
            <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Product Cost Summary</Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ position: 'relative', width: 100, height: 100, flexShrink: 0 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={PRODUCT_COST_DONUT} dataKey="value" nameKey="label" innerRadius={32} outerRadius={48} paddingAngle={2}>
                            {PRODUCT_COST_DONUT.map((s) => <Cell key={s.label} fill={s.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <Box sx={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="body2" fontWeight={700}>{currencyFmt(actualCostTotal)}</Typography>
                        <Typography variant="caption" color="text.secondary">Per Unit</Typography>
                      </Box>
                    </Box>
                    <Stack spacing={0.5}>
                      {PRODUCT_COST_DONUT.map((s) => (
                        <Stack key={s.label} direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                          <Typography variant="caption" color="text.secondary">{s.label} : {s.pct}%</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                  <Divider sx={{ my: 1.5 }} />
                  <Stack spacing={0.75}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Total Standard Cost (Per Unit)</Typography>
                      <Typography variant="caption" fontWeight={600}>{currencyFmt(standardCostTotal)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Total Actual Cost (Per Unit)</Typography>
                      <Typography variant="caption" fontWeight={600}>{currencyFmt(actualCostTotal)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Variance (Per Unit)</Typography>
                      <Typography variant="caption" fontWeight={700} color={costVarianceTotal > 0 ? 'error.main' : costVarianceTotal < 0 ? 'success.main' : 'text.primary'}>
                        {costVarianceTotal > 0 ? '+' : ''}{currencyFmt(costVarianceTotal)}
                      </Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Actual Cost (Total for {numberFmt(order.producedQty || 0)} {order.uom})</Typography>
                      <Typography variant="caption" fontWeight={700}>{currencyFmt(actualCostTotal * (order.producedQty || 0))}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}

          {tab === 7 && (
            <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Notes Summary</Typography>
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <NotesOutlinedIcon fontSize="small" color="primary" />
                      <Typography variant="body2" sx={{ flex: 1 }}>Total Notes</Typography>
                      <Typography variant="body2" fontWeight={700}>: {noteEntries.length}</Typography>
                    </Stack>
                    {['General', 'Production', 'Quality', 'Issue'].filter((t) => notesSummary[t]).map((t) => (
                      <Stack key={t} direction="row" spacing={1.25} alignItems="center">
                        <DescriptionOutlinedIcon fontSize="small" sx={{ color: `${NOTE_TYPE_COLOR[t]}.main` }} />
                        <Typography variant="body2" sx={{ flex: 1 }}>{t === 'Issue' ? 'Issue / Delay' : t}</Typography>
                        <Typography variant="body2" fontWeight={700}>: {notesSummary[t]}</Typography>
                      </Stack>
                    ))}
                    {noteEntries.length === 0 && (
                      <Typography variant="body2" color="text.secondary">No notes recorded for this order.</Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Attachment Summary</Typography>
                  {attachmentEntries.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">No attachments recorded for this order.</Typography>
                  ) : (
                    <>
                      <Stack alignItems="center" sx={{ mb: 2 }}>
                        <Box sx={{ position: 'relative', width: 140, height: 140 }}>
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie data={ATTACHMENT_DONUT} dataKey="value" nameKey="label" innerRadius={44} outerRadius={66} paddingAngle={2}>
                                {ATTACHMENT_DONUT.map((s) => <Cell key={s.label} fill={s.color} />)}
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <Box sx={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Typography variant="h6" fontWeight={700}>{attachmentEntries.length}</Typography>
                            <Typography variant="caption" color="text.secondary">Files</Typography>
                          </Box>
                        </Box>
                      </Stack>
                      <Stack spacing={0.75} sx={{ mb: 2 }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#d32f2f' }} />
                            <Typography variant="caption" color="text.secondary">PDF</Typography>
                          </Stack>
                          <Typography variant="caption" fontWeight={600}>: {attachmentTypeCounts.PDF}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2e7d32' }} />
                            <Typography variant="caption" color="text.secondary">Excel</Typography>
                          </Stack>
                          <Typography variant="caption" fontWeight={600}>: {attachmentTypeCounts.Excel}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#1976d2' }} />
                            <Typography variant="caption" color="text.secondary">Image</Typography>
                          </Stack>
                          <Typography variant="caption" fontWeight={600}>: {attachmentTypeCounts.Image}</Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#9c27b0' }} />
                            <Typography variant="caption" color="text.secondary">Others</Typography>
                          </Stack>
                          <Typography variant="caption" fontWeight={600}>: {attachmentTypeCounts.Others}</Typography>
                        </Stack>
                      </Stack>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                        Total File Size : {fileSizeFmt(totalFileSizeKB)}
                      </Typography>
                    </>
                  )}
                  <Divider sx={{ mb: 1.5 }} />
                  <Typography variant="caption" fontWeight={700} display="block" sx={{ mb: 0.5 }}>Allowed File Types</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">PDF, Excel, Word, Image (JPG, PNG)</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">Max File Size : 10 MB (per file)</Typography>
                </CardContent>
              </Card>
            </>
          )}

          {tab !== 6 && tab !== 7 && (
            <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Status</Typography>
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ position: 'relative', width: 96, height: 96, flexShrink: 0 }}>
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={MATERIAL_STATUS_DONUT} dataKey="value" nameKey="label" innerRadius={30} outerRadius={46} paddingAngle={2}>
                            {MATERIAL_STATUS_DONUT.map((s) => <Cell key={s.label} fill={s.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <Box sx={{
                        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Typography variant="body2" fontWeight={700}>{materialStatusIssuedPct}%</Typography>
                      </Box>
                    </Box>
                    <Stack spacing={0.5}>
                      {MATERIAL_STATUS_DONUT.map((s) => (
                        <Stack key={s.label} direction="row" spacing={1} alignItems="center">
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                          <Typography variant="caption" color="text.secondary">{s.label} : {s.value}</Typography>
                        </Stack>
                      ))}
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
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <DescriptionOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">Material Issue</Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight={600}>{(order.materialIssues || []).length}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Stack direction="row" spacing={0.5} alignItems="center">
                        <DescriptionOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography variant="caption" color="text.secondary">Material Receipt</Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight={600}>{(order.materialReceipts || []).length}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Rework Qty</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(reworkQty)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="caption" color="text.secondary">Scrap Qty</Typography>
                      <Typography variant="caption" fontWeight={600}>{numberFmt(scrapQty)}</Typography>
                    </Stack>
                    <Divider />
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" fontWeight={700}>Completion %</Typography>
                      <Typography variant="body2" fontWeight={700} color="success.main">{progressPct}%</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </>
          )}
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
