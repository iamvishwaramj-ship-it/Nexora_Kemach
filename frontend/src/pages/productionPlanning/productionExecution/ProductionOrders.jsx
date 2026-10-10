import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Collapse, LinearProgress, CircularProgress, Divider,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { productionOrderApi, useUpdateProductionOrderStatusMutation } from '../../../features/productionApi';
import { useNotify } from '../../../components/feedback/NotificationProvider';
import { isDemoMode } from '../../../lib/demoMode';
import { withDemoCrud } from '../../../lib/demoCrud';
import { DEMO_PRODUCTION_ORDERS } from '../../../lib/demoData/productionPlanning';

// Demo-mode-aware api: a pure pass-through to the real productionOrderApi
// when demo mode is off (see ../../../lib/demoMode.js). Shared with
// ViewOrder.jsx and CreateProductionOrder.jsx via the same DEMO_PRODUCTION_ORDERS
// array reference, so orders created/advanced/cancelled in one screen are
// visible in the others during a demo.
const demoAwareProductionOrderApi = withDemoCrud(productionOrderApi, DEMO_PRODUCTION_ORDERS);

// ---------------------------------------------------------------------------
// Production Orders — real data as of Phase A (schema.prisma's
// ProductionOrder / routes/productionOrders.js), replacing the earlier
// static mock. Layout, filters and columns are unchanged from the original
// reference-design build; the Priority/Project/Sales Order/Customer/Work
// Center fields the original mock showed are not part of the Phase A data
// model (no priority, project or customer linkage on ProductionOrder yet —
// Sales Order linkage exists as baseType/baseNo but is only populated once
// Generate Order/MRP is itself wired in a later phase), so they render as
// "-" rather than invented values. Produced/Balance qty are not tracked
// until the Record Production phase exists, so Produced always shows 0 and
// Balance shows the full planned quantity for now.
// ---------------------------------------------------------------------------

const STATUS_OPTIONS = ['All', 'Planned', 'Released', 'In Progress', 'Completed', 'Closed'];
const STATUS_META = {
  Planned: { color: 'warning' },
  Released: { color: 'info' },
  'In Progress': { color: 'success' },
  Completed: { color: 'success' },
  Closed: { color: 'default' },
};

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function dateFmt(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-');
}

function toRow(order) {
  return {
    id: order.id,
    no: order.orderNo,
    code: order.productCode,
    desc: order.productName || '-',
    planned: Number(order.orderQty || 0),
    produced: 0,
    balance: Number(order.orderQty || 0),
    start: dateFmt(order.plannedStartDate),
    due: dateFmt(order.dueDate),
    status: order.status,
    bomCode: order.bom?.bomCode || '-',
    routingCode: order.routing?.routingCode || '-',
    salesOrder: order.baseType === 'SalesOrder' ? (order.baseNo || '-') : '-',
    componentCount: (order.components || []).length,
  };
}

export default function ProductionOrders() {
  const [orderNo, setOrderNo] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-12-31');
  const [plant, setPlant] = useState('Main Plant');
  const [productionType, setProductionType] = useState('All');
  const [project, setProject] = useState('All Projects');
  const [salesOrder, setSalesOrder] = useState('All Sales Orders');
  const [customer, setCustomer] = useState('All Customers');
  const [workCenter, setWorkCenter] = useState('All Work Centers');

  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);

  const navigate = useNavigate();
  const notify = useNotify();
  const { data: ordersRaw, isLoading, isError } = demoAwareProductionOrderApi.useList();
  const [updateStatus, { isLoading: statusUpdatingReal }] = useUpdateProductionOrderStatusMutation();
  const [demoUpdate, { isLoading: statusUpdatingDemo }] = demoAwareProductionOrderApi.useUpdate();
  const statusUpdating = isDemoMode() ? statusUpdatingDemo : statusUpdatingReal;
  const allRows = useMemo(() => (ordersRaw || []).map(toRow), [ordersRaw]);

  const rows = useMemo(() => allRows.filter((r) => {
    if (status !== 'All' && r.status !== status) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return r.no.toLowerCase().includes(q) || r.code.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q);
  }), [allRows, status, search]);

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  const effectiveSelectedNo = selectedOrder || rows[0]?.no;
  const selected = allRows.find((r) => r.no === effectiveSelectedNo) || null;
  const progressPct = selected && selected.planned > 0 ? Math.round((selected.produced / selected.planned) * 100) : 0;

  // Forward-only, one step at a time — mirrors STATUS_FLOW in
  // routes/productionOrders.js. Release moves Planned -> Released; Close
  // only makes sense once a run is Completed.
  const nextStatusFor = (current) => ({ Planned: 'Released', Released: 'In Progress', 'In Progress': 'Completed', Completed: 'Closed' }[current]);

  const handleAdvance = async (targetStatus) => {
    if (!selected) return;
    try {
      if (isDemoMode()) {
        await demoUpdate({ id: selected.id, status: targetStatus }).unwrap();
      } else {
        await updateStatus({ id: selected.id, status: targetStatus }).unwrap();
      }
      notify.success(`Production order ${selected.no} is now ${targetStatus}`);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not update status');
    }
  };

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/create-production-order')}>
        Create Production Order
      </Button>
      <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled>Import from Excel</Button>
      <Button variant="outlined" startIcon={<ContentCopyIcon />} disabled>Copy</Button>
      <Button variant="outlined" startIcon={<PrintOutlinedIcon />} disabled>Print</Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Production Orders"
        subtitle="Create, plan, release and monitor production orders for manufacturing items."
        rightContent={headerActions}
      />

      {/* Filter / Search */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
            <FilterListOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>Filter / Search</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Order No." placeholder="Enter order no..."
                value={orderNo} onChange={(e) => setOrderNo(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Item Code / Description" placeholder="Search item..."
                value={itemSearch} onChange={(e) => setItemSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" type="date" label="From Date"
                value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" type="date" label="To Date"
                value={toDate} onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Plant / Location" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Production Type" value={productionType} onChange={(e) => setProductionType(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Make to Order">Make to Order</MenuItem>
                <MenuItem value="Make to Stock">Make to Stock</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Project" value={project} onChange={(e) => setProject(e.target.value)}>
                <MenuItem value="All Projects">All Projects</MenuItem>
                <MenuItem value="PRJ-2026-001">PRJ-2026-001</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Sales Order" value={salesOrder} onChange={(e) => setSalesOrder(e.target.value)}>
                <MenuItem value="All Sales Orders">All Sales Orders</MenuItem>
                <MenuItem value="SO-2026-09-001">SO-2026-09-001</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)}>
                <MenuItem value="All Customers">All Customers</MenuItem>
                <MenuItem value="Agni Steel Pvt Ltd">Agni Steel Pvt Ltd</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                <MenuItem value="All Work Centers">All Work Centers</MenuItem>
                <MenuItem value="WC-01 - Machining">WC-01 - Machining</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Stack direction="row" spacing={1} sx={{ height: '100%' }} alignItems="center">
                <Button fullWidth variant="contained" color="warning" startIcon={<SearchIcon />}>Search</Button>
              </Stack>
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <Button variant="outlined" size="small">Clear</Button>
          </Stack>
        </CardContent>
      </Card>

      {/* List + details panel */}
      <Card variant="outlined">
        <Stack
          direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}
          sx={{ px: 3, pt: 2.5, pb: 1.5 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>Production Orders</Typography>
            <Chip size="small" label={allRows.length} color="primary" />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="Search in list..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Button variant="outlined" size="small" startIcon={<FilterAltOutlinedIcon />}>Filter</Button>
            <Button variant="outlined" size="small" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
          </Stack>
        </Stack>

        <Grid container>
          <Grid item xs={12} md={8} lg={8.5}>
            <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 520px), 460px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" rowSpan={2} />
                    <TableCell rowSpan={2}>S.No</TableCell>
                    <TableCell rowSpan={2}>Production Order No.</TableCell>
                    <TableCell rowSpan={2}>Item Code</TableCell>
                    <TableCell rowSpan={2}>Item Description</TableCell>
                    <TableCell align="center" colSpan={3}>Quantity</TableCell>
                    <TableCell rowSpan={2}>Start Date</TableCell>
                    <TableCell rowSpan={2}>Due Date</TableCell>
                    <TableCell rowSpan={2}>Status</TableCell>
                    <TableCell rowSpan={2}>Action</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell align="right">Planned</TableCell>
                    <TableCell align="right">Produced</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {isLoading && (
                    <TableRow><TableCell colSpan={12} align="center" sx={{ py: 4 }}><LoadingState label="Loading production orders..." /></TableCell></TableRow>
                  )}
                  {!isLoading && isError && (
                    <TableRow><TableCell colSpan={12} align="center" sx={{ py: 4, color: 'error.main' }}>Could not load production orders.</TableCell></TableRow>
                  )}
                  {!isLoading && !isError && rows.length === 0 && (
                    <TableRow><TableCell colSpan={12} sx={{ border: 0, py: 2 }}>
                      <EmptyState
                        title="No production orders yet"
                        message="Create a production order to start planning and tracking manufacturing."
                        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/create-production-order')}>Create Production Order</Button>}
                      />
                    </TableCell></TableRow>
                  )}
                  {rows.map((r, idx) => (
                    <TableRow
                      key={r.no} hover selected={effectiveSelectedNo === r.no}
                      onClick={() => setSelectedOrder(r.no)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checked.has(r.no)} onClick={(e) => e.stopPropagation()} onChange={() => toggleRow(r.no)} />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.no}</Typography></TableCell>
                      <TableCell>{r.code}</TableCell>
                      <TableCell>{r.desc}</TableCell>
                      <TableCell align="right">{numberFmt(r.planned)}</TableCell>
                      <TableCell align="right">{numberFmt(r.produced)}</TableCell>
                      <TableCell align="right">{numberFmt(r.balance)}</TableCell>
                      <TableCell>{r.start}</TableCell>
                      <TableCell>{r.due}</TableCell>
                      <TableCell>
                        <Chip size="small" label={r.status} color={STATUS_META[r.status]?.color || 'default'} />
                      </TableCell>
                      <TableCell>
                        <Button size="small" endIcon={<KeyboardArrowDownIcon />} onClick={(e) => { e.stopPropagation(); navigate(`/production-execution/view-order/${r.id}`); }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>

            <EntityListPagination
              total={rows.length}
              page={page}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
            />
          </Grid>

          {/* Production Order Details side panel */}
          <Grid item xs={12} md={4} lg={3.5}>
            <Box sx={{ p: 2.5, borderLeft: { md: '1px solid' }, borderColor: 'divider', height: '100%' }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <DescriptionOutlinedIcon fontSize="small" color="primary" />
                  <Typography variant="body2" fontWeight={700}>Production Order Details</Typography>
                </Stack>
                <IconButton size="small" onClick={() => setPanelOpen((v) => !v)}>
                  {panelOpen ? <KeyboardArrowUpIcon fontSize="small" /> : <KeyboardArrowDownIcon fontSize="small" />}
                </IconButton>
              </Stack>

              <Collapse in={panelOpen}>
                {!selected ? (
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No production order selected.
                  </Typography>
                ) : (
                  <>
                    <Stack spacing={1} sx={{ mb: 2.5 }}>
                      {[
                        { label: 'Production Order No.', value: selected.no },
                        { label: 'Item Code', value: selected.code },
                        { label: 'Item Description', value: selected.desc },
                        { label: 'Planned Qty', value: `${numberFmt(selected.planned)} Nos` },
                        { label: 'Produced Qty', value: `${numberFmt(selected.produced)} Nos` },
                        { label: 'Balance Qty', value: `${numberFmt(selected.balance)} Nos` },
                        { label: 'Start Date', value: selected.start },
                        { label: 'Due Date', value: selected.due },
                      ].map((f) => (
                        <Stack key={f.label} direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">{f.label}</Typography>
                          <Typography variant="caption" fontWeight={600}>{f.value}</Typography>
                        </Stack>
                      ))}
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary">Status</Typography>
                        <Chip size="small" label={selected.status} color={STATUS_META[selected.status]?.color || 'default'} />
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">BOM</Typography>
                        <Typography variant="caption" fontWeight={600}>{selected.bomCode}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Routing</Typography>
                        <Typography variant="caption" fontWeight={600}>{selected.routingCode}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Sales Order</Typography>
                        <Typography variant="caption" fontWeight={600}>{selected.salesOrder}</Typography>
                      </Stack>
                    </Stack>

                    <Divider sx={{ mb: 2 }} />

                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Production Progress</Typography>
                    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1 }}>
                      <LinearProgress
                        variant="determinate" value={progressPct}
                        sx={{ flex: 1, height: 8, borderRadius: 4 }}
                        color="success"
                      />
                      <Typography variant="caption" fontWeight={700}>{progressPct}%</Typography>
                    </Stack>
                    <Stack spacing={0.5} sx={{ mb: 2.5 }}>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Planned Qty</Typography>
                        <Typography variant="caption" fontWeight={600}>{numberFmt(selected.planned)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Produced Qty</Typography>
                        <Typography variant="caption" fontWeight={600}>{numberFmt(selected.produced)}</Typography>
                      </Stack>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" color="text.secondary">Balance Qty</Typography>
                        <Typography variant="caption" fontWeight={600}>{numberFmt(selected.balance)}</Typography>
                      </Stack>
                    </Stack>

                    <Divider sx={{ mb: 2 }} />

                    <Typography variant="body2" fontWeight={700} sx={{ mb: 1 }}>Components</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selected.componentCount} component{selected.componentCount === 1 ? '' : 's'} snapshotted from {selected.bomCode}. Material issue is tracked in a later phase.
                    </Typography>

                    <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                      <Typography
                        variant="caption" color="primary.main" fontWeight={600}
                        sx={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 0.5 }}
                        onClick={() => navigate(`/production-execution/view-order/${selected.id}`)}
                      >
                        <DescriptionOutlinedIcon sx={{ fontSize: 14 }} /> View Order
                      </Typography>
                    </Stack>
                  </>
                )}
              </Collapse>
            </Box>
          </Grid>
        </Grid>
      </Card>

      {/* Bottom action bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
        <Button
          variant="outlined" startIcon={<VisibilityOutlinedIcon />} disabled={!selected}
          onClick={() => selected && navigate(`/production-execution/view-order/${selected.id}`)}
        >
          View
        </Button>
        <Button variant="outlined" startIcon={<EditOutlinedIcon />} disabled={!selected || selected.status !== 'Planned'}>Edit</Button>
        <Button
          variant="outlined" startIcon={<RocketLaunchOutlinedIcon />}
          disabled={!selected || !nextStatusFor(selected.status) || statusUpdating}
          onClick={() => handleAdvance(nextStatusFor(selected.status))}
        >
          {selected?.status === 'Released' || selected?.status === 'In Progress' ? 'Advance' : 'Release'}
        </Button>
        <Button
          variant="outlined" startIcon={<CheckCircleOutlineIcon />}
          disabled={!selected || selected.status !== 'Completed' || statusUpdating}
          onClick={() => handleAdvance('Closed')}
        >
          Close
        </Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />} disabled>Print</Button>
        <Button variant="contained" color="warning" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/create-production-order')}>
          Create Production Order
        </Button>
      </Stack>
    </Box>
  );
}
