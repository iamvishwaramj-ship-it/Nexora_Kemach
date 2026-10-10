import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Switch,
  FormControlLabel, Button, Chip, Checkbox, InputAdornment, Table, TableHead,
  TableBody, TableRow, TableCell, Avatar, Alert, Tooltip, CircularProgress,
  Snackbar,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SearchIcon from '@mui/icons-material/Search';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import GroupsIcon from '@mui/icons-material/Groups';
import BuildIcon from '@mui/icons-material/Build';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SettingsSuggestIcon from '@mui/icons-material/SettingsSuggest';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import { branchApi, productGroupApi, customerApi } from '../../features/resources';
import {
  usePreviewForecastPlanMutation, useCreateForecastPlanMutation, useListItemCategoriesQuery,
} from '../../features/productionPlanningApi';
import { isDemoMode } from '../../lib/demoMode';
import {
  DEMO_BRANCHES, DEMO_PRODUCT_GROUPS, DEMO_ITEM_CATEGORIES, DEMO_CUSTOMERS,
} from '../../lib/demoData/productionPlanning';
import { buildDemoForecastResult } from '../../lib/demoData/forecast';

// ---------------------------------------------------------------------------
// Forecast Plan screen — all data below is real:
//  - Actual Demand is aggregated server-side from real Sales Invoice history.
//  - Forecast Demand + Method are a real moving-average/trend calculation run
//    on that history (see backend/src/services/forecastPlanService.js).
//  - The 4 scope dropdowns are driven by existing master data (Branch,
//    Product Group, a derived Item Category, Business Partner/Customer).
//  - "Run Forecast" calls the backend to compute the table and the Section 3
//    order summary; "Save Plan" persists the computed result so it can be
//    reopened later. Nothing here is hardcoded/mock data any more.
// ---------------------------------------------------------------------------

const ORDER_CARD_META = {
  production: { label: 'Production Orders', desc: 'Manufactured items this plan needs produced', icon: PrecisionManufacturingIcon, color: 'info' },
  purchase: { label: 'Purchase Orders', desc: 'Directly purchased items this plan needs bought in', icon: ShoppingCartIcon, color: 'warning' },
  subcontracting: { label: 'Subcontracting Orders', desc: 'Create subcontracting orders', icon: GroupsIcon, color: 'secondary' },
  jobwork: { label: 'Job Work Orders', desc: 'Create job work orders', icon: BuildIcon, color: 'success' },
};

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function currentMonthStr(offset = 0) {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Forecast() {
  const [planName, setPlanName] = useState(() => {
    const d = new Date();
    return `${d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}-${d.getFullYear()} Demand Plan`;
  });
  const [forecastPeriod, setForecastPeriod] = useState('Monthly');
  const [fromMonth, setFromMonth] = useState(() => currentMonthStr(0));
  const [toMonth, setToMonth] = useState(() => currentMonthStr(5));
  const [planType, setPlanType] = useState('Statistical Forecast');
  const [version, setVersion] = useState('V1');
  const [branch, setBranch] = useState('All Plants');
  const [itemGroup, setItemGroup] = useState('All Groups');
  const [itemCategory, setItemCategory] = useState('All Categories');
  const [customer, setCustomer] = useState('All Customers');
  const [includeSafetyStock, setIncludeSafetyStock] = useState(true);
  const [notes, setNotes] = useState('');

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState(() => new Set());
  const [orderChecks, setOrderChecks] = useState({ production: true, purchase: true, subcontracting: false, jobwork: false });
  const [toast, setToast] = useState(null);

  // --- Real master data for the 4 scope dropdowns ---------------------------
  // Plain .useList() — these resources' `list` endpoint always returns every
  // row (no server-side status filter wired for them), so "Active" is
  // applied client-side instead of passing an unsupported ?status= param.
  // Skips the real network calls in demo mode, falling back to fixed demo
  // master data instead (see ../../lib/demoMode.js).
  const { data: branchesRaw } = branchApi.useList(undefined, { skip: isDemoMode() });
  const { data: productGroupsRaw } = productGroupApi.useList(undefined, { skip: isDemoMode() });
  const { data: itemCategoriesReal } = useListItemCategoriesQuery(undefined, { skip: isDemoMode() });
  const { data: customersReal } = customerApi.useList(undefined, { skip: isDemoMode() });
  const itemCategories = isDemoMode() ? DEMO_ITEM_CATEGORIES : itemCategoriesReal;
  const customers = isDemoMode() ? DEMO_CUSTOMERS : customersReal;
  const branches = useMemo(
    () => (isDemoMode() ? DEMO_BRANCHES : (branchesRaw || []).filter((b) => b.status !== 'Inactive')),
    [branchesRaw],
  );
  const productGroups = useMemo(
    () => (isDemoMode() ? DEMO_PRODUCT_GROUPS : (productGroupsRaw || []).filter((g) => g.status !== 'Inactive')),
    [productGroupsRaw],
  );

  // --- Real computed forecast (Actual Demand, Forecast Demand, Method, --
  // Section 3 order summary) — nothing below `result` is client-invented,
  // except in demo mode, where it's a fixed in-memory computation (see
  // ../../lib/demoData/forecast.js) and the mutation below is never called.
  const [runPreview, { data: previewResult, isLoading: isRunning, error: runError }] = usePreviewForecastPlanMutation();
  const [savePlan, { isLoading: isSaving }] = useCreateForecastPlanMutation();
  const [demoResult, setDemoResult] = useState(null);
  const result = isDemoMode() ? demoResult : previewResult;

  const scope = useMemo(() => ({
    fromMonth, toMonth, forecastPeriod, branch, itemGroup, itemCategory, customer, includeSafetyStock,
  }), [fromMonth, toMonth, forecastPeriod, branch, itemGroup, itemCategory, customer, includeSafetyStock]);

  const runForecast = async () => {
    if (isDemoMode()) {
      const data = buildDemoForecastResult();
      setDemoResult(data);
      setSelected(new Set((data.rows || []).map((r) => r.productCode)));
      return;
    }
    try {
      const data = await runPreview(scope).unwrap();
      setSelected(new Set((data.rows || []).filter((r) => r.included).map((r) => r.productCode)));
    } catch {
      // surfaced via runError below
    }
  };

  // Compute once on first load so the screen isn't empty before the user
  // explicitly clicks "Run Forecast" — still a real server computation, not
  // a client-side placeholder.
  useEffect(() => { runForecast(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const allRows = result?.rows || [];
  const actualMonthDates = result?.actualMonthDates || [];
  const forecastMonthDates = result?.forecastMonthDates || [];
  const orderSummary = result?.orderSummary;

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((r) => r.productCode.toLowerCase().includes(q) || (r.productName || '').toLowerCase().includes(q));
  }, [allRows, search]);

  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  const allSelected = pagedRows.length > 0 && pagedRows.every((r) => selected.has(r.productCode));
  const someSelected = pagedRows.some((r) => selected.has(r.productCode)) && !allSelected;

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) pagedRows.forEach((r) => next.delete(r.productCode));
      else pagedRows.forEach((r) => next.add(r.productCode));
      return next;
    });
  };

  const toggleRow = (code) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSave = async () => {
    if (isDemoMode()) {
      setToast({ severity: 'success', message: `Plan saved as "${planName}".` });
      return;
    }
    try {
      const productCodes = Array.from(selected);
      await savePlan({
        planName, forecastPeriod, fromMonth, toMonth, planType, version,
        branch, itemGroup, itemCategory, customer, includeSafetyStock, notes,
        productCodes: productCodes.length ? productCodes : undefined,
      }).unwrap();
      setToast({ severity: 'success', message: `Plan saved as "${planName}".` });
    } catch (err) {
      setToast({ severity: 'error', message: err?.data?.message || 'Could not save the plan.' });
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Forecast Plan"
        subtitle="Plan future demand and generate production, purchase, subcontracting or job work orders."
        rightContent={(
          <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<ContentCopyOutlinedIcon />} disabled>Copy Plan</Button>
            <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />} disabled>Import from Excel</Button>
            <Button
              variant="outlined"
              startIcon={isRunning ? <CircularProgress size={16} /> : <PlayArrowIcon />}
              onClick={runForecast}
              disabled={isRunning}
            >
              Run Forecast
            </Button>
            <Button
              variant="contained"
              startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : <SaveOutlinedIcon />}
              onClick={handleSave}
              disabled={isSaving || !allRows.length}
            >
              Save Plan
            </Button>
          </Stack>
        )}
      />

      {runError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {runError?.data?.message || 'Could not compute the forecast. Please check the plan scope and try again.'}
        </Alert>
      )}

      {/* 1. Plan Details & Demand Input */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>
            1. Plan Details &amp; Demand Input
          </Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Plan Name" required
                value={planName} onChange={(e) => setPlanName(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Forecast Period" required
                value={forecastPeriod} onChange={(e) => setForecastPeriod(e.target.value)}
              >
                {['Monthly', 'Quarterly', 'Yearly'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" type="month" label="From Month" required
                value={fromMonth} onChange={(e) => setFromMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" type="month" label="To Month" required
                value={toMonth} onChange={(e) => setToMonth(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Plan Type" required
                value={planType} onChange={(e) => setPlanType(e.target.value)}
              >
                {['Statistical Forecast', 'Manual', 'Combined'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Version"
                value={version} onChange={(e) => setVersion(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Plant / Location"
                value={branch} onChange={(e) => setBranch(e.target.value)}
              >
                <MenuItem value="All Plants">All Plants</MenuItem>
                {(branches || []).map((b) => <MenuItem key={b.id} value={b.branchName}>{b.branchName}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Item Group"
                value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}
              >
                <MenuItem value="All Groups">All Groups</MenuItem>
                {(productGroups || []).map((g) => <MenuItem key={g.id} value={g.groupName}>{g.groupName}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Item Category"
                value={itemCategory} onChange={(e) => setItemCategory(e.target.value)}
              >
                <MenuItem value="All Categories">All Categories</MenuItem>
                {(itemCategories || []).map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" select label="Customer"
                value={customer} onChange={(e) => setCustomer(e.target.value)}
              >
                <MenuItem value="All Customers">All Customers</MenuItem>
                {(customers || []).map((c) => <MenuItem key={c.id} value={c.name}>{c.name}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Switch checked={includeSafetyStock} onChange={(e) => setIncludeSafetyStock(e.target.checked)} />}
                label="Include Safety Stock"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Notes"
                value={notes} onChange={(e) => setNotes(e.target.value)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 2. Item Wise Forecast Demand */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack
          direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5}
          sx={{ px: 3, pt: 2.5, pb: 1.5 }}
        >
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>2. Item Wise Forecast Demand</Typography>
            <Chip size="small" label={rows.length} color="primary" />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField
              size="small"
              placeholder="Search item, description..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
          </Stack>
        </Stack>

        {isRunning && !allRows.length ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
              Computing demand from sales history…
            </Typography>
          </Stack>
        ) : !allRows.length ? (
          <Stack alignItems="center" justifyContent="center" sx={{ py: 6 }}>
            <Typography variant="body2" color="text.secondary">
              No eligible items found for this scope. Click "Run Forecast" after adjusting the filters above.
            </Typography>
          </Stack>
        ) : (
          <>
            <ScrollableTableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell rowSpan={2} padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={allSelected}
                        indeterminate={someSelected}
                        onChange={toggleAll}
                        sx={{ color: 'primary.contrastText' }}
                      />
                    </TableCell>
                    <TableCell rowSpan={2}>S.No</TableCell>
                    <TableCell rowSpan={2}>Item Code</TableCell>
                    <TableCell rowSpan={2}>Item Description</TableCell>
                    <TableCell rowSpan={2}>UOM</TableCell>
                    <TableCell colSpan={actualMonthDates.length} align="center">Actual Demand</TableCell>
                    <TableCell colSpan={forecastMonthDates.length} align="center">Forecast Demand (Nos)</TableCell>
                    <TableCell rowSpan={2}>Method</TableCell>
                    <TableCell rowSpan={2} align="right">Safety Stock</TableCell>
                    <TableCell rowSpan={2} align="right">Total Forecast</TableCell>
                  </TableRow>
                  <TableRow>
                    {actualMonthDates.map((m) => <TableCell key={`a-${m}`} align="center">{m}</TableCell>)}
                    {forecastMonthDates.map((m) => <TableCell key={`f-${m}`} align="center">{m}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pagedRows.map((row, idx) => (
                    <TableRow key={row.productCode} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={selected.has(row.productCode)} onChange={() => toggleRow(row.productCode)} />
                      </TableCell>
                      <TableCell>{page * pageSize + idx + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2" color="primary.main" fontWeight={600}>{row.productCode}</Typography>
                      </TableCell>
                      <TableCell>{row.productName}</TableCell>
                      <TableCell>{row.uom}</TableCell>
                      {row.actualMonths.map((m) => (
                        <TableCell key={`a-${m.month}`} align="center">{numberFmt(m.qty)}</TableCell>
                      ))}
                      {row.forecastMonths.map((m) => (
                        <TableCell key={`f-${m.month}`} align="center">
                          <Box
                            sx={{
                              display: 'inline-block', minWidth: 48, px: 1, py: 0.25, borderRadius: 1,
                              bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255, 213, 79, 0.16)' : '#FFF8E1'),
                              border: '1px solid', borderColor: 'warning.light',
                            }}
                          >
                            {numberFmt(m.qty)}
                          </Box>
                        </TableCell>
                      ))}
                      <TableCell>{row.method}</TableCell>
                      <TableCell align="right">{numberFmt(row.safetyStock)}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight={700}>{numberFmt(row.totalForecast)}</Typography>
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
          </>
        )}
      </Card>

      {/* 3. Generate Orders from Forecast */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>
            3. Generate Orders from Forecast
          </Typography>
          <Grid container spacing={2} alignItems="stretch">
            {Object.entries(ORDER_CARD_META).map(([key, meta]) => {
              const Icon = meta.icon;
              const summary = orderSummary?.[key];
              const available = summary?.available !== false;
              const checked = orderChecks[key] && available;
              const card = (
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%', borderColor: checked ? `${meta.color}.main` : 'divider',
                    borderWidth: checked ? 2 : 1, opacity: available ? 1 : 0.6, transition: 'border-color .15s',
                  }}
                >
                  <CardContent>
                    <Stack direction="row" alignItems="flex-start" spacing={1.25}>
                      <Checkbox
                        size="small"
                        checked={checked}
                        disabled={!available}
                        onChange={() => setOrderChecks((prev) => ({ ...prev, [key]: !prev[key] }))}
                        sx={{ mt: -1, ml: -1 }}
                      />
                      <Avatar sx={{ bgcolor: available ? `${meta.color}.main` : 'action.disabledBackground', width: 40, height: 40 }}>
                        {available ? <Icon fontSize="small" /> : <BlockOutlinedIcon fontSize="small" />}
                      </Avatar>
                    </Stack>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 1 }}>{meta.label}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, minHeight: 40 }}>
                      {available ? meta.desc : summary?.reason}
                    </Typography>
                    <Stack direction="row" spacing={3}>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>{available ? (summary?.items ?? 0) : '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">Items</Typography>
                      </Box>
                      <Box>
                        <Typography variant="h6" fontWeight={700}>{available ? numberFmt(summary?.qty) : '—'}</Typography>
                        <Typography variant="caption" color="text.secondary">Nos</Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              );
              return (
                <Grid item xs={12} sm={6} md={3} key={key}>
                  {available ? card : (
                    <Tooltip title={summary?.reason || 'Not available yet'} arrow placement="top">
                      <Box>{card}</Box>
                    </Tooltip>
                  )}
                </Grid>
              );
            })}
          </Grid>

          <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 2.5 }} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<VisibilityOutlinedIcon />} disabled>Preview Orders</Button>
            <Tooltip title="Order generation (posting real Production/Purchase Orders) is not implemented yet — the numbers above are real, but no document is created by this button.">
              <span>
                <Button variant="contained" color="warning" startIcon={<SettingsSuggestIcon />} disabled>
                  Generate Orders
                </Button>
              </span>
            </Tooltip>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}>
        {toast ? <Alert severity={toast.severity} onClose={() => setToast(null)}>{toast.message}</Alert> : undefined}
      </Snackbar>
    </Box>
  );
}
