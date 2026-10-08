import React, { useMemo, useState, useEffect } from 'react';
import LoadingState from '../../../components/feedback/LoadingState';
import EmptyState from '../../../components/data-display/EmptyState';
import { useForm, useWatch, FormProvider } from 'react-hook-form';
import {
  Box, Typography, Button, Card, CardContent, Stack, Grid, Table, TableBody, TableCell,
  TableHead, TableRow, Select, MenuItem, InputLabel, FormControl,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Tooltip,
  Menu, Checkbox, ListItemText, Divider,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList,
} from 'recharts';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import dayjs from 'dayjs';
import FormSelect from '../../../components/form/FormSelect';
import FormDatePicker from '../../../components/form/FormDatePicker';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import CompanyBadge from '../../../components/common/CompanyBadge';
import EntityListPagination from '../../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../../components/data-display/useIsMobileListView';
import StatCard from '../../../components/data-display/StatCard';
import { branchApi, productGroupApi, productApi } from '../../../features/resources';
import { useWarehouseOptions } from '../../../lib/useWarehouseOptions';
import { useGetAvailableBalanceReportQuery, useGetAvailableBalanceStockLedgerQuery } from '../../../features/inventory/availableBalanceReportApi';
import { useLocalCachedQuery } from '../../../lib/useLocalCachedQuery';
import { useTabSyncedReportQuery } from '../../../hooks/useTabSyncedReportQuery';
import useTableFeatures from '../../../components/data-display/useTableFeatures';
import TableToolbar from '../../../components/data-display/TableToolbar';
import SortableHeaderCell from '../../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import ReportPrintable from '../../../components/print/ReportPrintable';
import { buildPrintFilters } from '../../../components/print/reportPrint';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../../../store/authSlice';
import { excludedColumnsFor } from '../../../lib/reportColumns';

// This report's permission row key (navConfig) -- where User Management
// saves which columns each user is allowed to see (lib/reportColumns.js).
const REPORT_MENU_KEY = 'reports-inventory-Available-balance';
const priceOrDash = (v) => (v == null ? '—' : `₹ ${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);

const PAGE_SIZE = 10;

const PRODUCT_TYPE_OPTIONS = ['Raw Material', 'Semi-Finished Goods', 'Finished Goods', 'Trading Goods', 'Service', 'Consumable', 'Other'];

const BALANCE_STATUS_OPTIONS = ['All Items', 'Available', 'Low Stock', 'Out of Stock', 'Overstock'];

const STATUS_COLORS = { Available: 'success', 'Low Stock': 'warning', 'Out of Stock': 'error', Overstock: 'text.secondary' };

// Group By is a display-only toggle in Phase 1 — it reorders/sub-totals the
// same (item, warehouse) rows the backend already returns rather than
// asking for a different aggregation, since the report's real grouping
// dimension (item + warehouse together) doesn't change.
const GROUP_BY_OPTIONS = [
  { label: 'Item', value: 'productCode' },
  { label: 'Branch', value: 'branch' },
  { label: 'Warehouse', value: 'warehouse' },
  { label: 'Product Group', value: 'productGroup' },
];

const currency = (v) => `₹ ${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const number3 = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

// Drives the header row, each data row and the totals row of the desktop
// table below, plus the "Columns" show/hide menu -- add a column in exactly
// one place here rather than three. `total` is omitted for columns the
// totals row shows as "—" (Reorder Level, Status) rather than summing.
// Mobile cards and the CSV export are untouched by this list on purpose --
// same scope the old per-column Filter feature had, which only ever
// affected the desktop table too.
const AVAILABLE_BALANCE_COLUMNS = [
  {
    key: 'productCode', label: 'Item No', cellSx: { whiteSpace: 'nowrap' },
    render: (row) => (
      <Typography variant="body2" fontWeight={700} color="primary.main">{row.productCode}</Typography>
    ),
  },
  { key: 'productName', label: 'Description', cellSx: { minWidth: 150 }, render: (row) => row.productName },
  { key: 'productGroup', label: 'Product Group', cellSx: { whiteSpace: 'nowrap' }, render: (row) => row.productGroup },
  { key: 'branch', label: 'Branch', cellSx: { whiteSpace: 'nowrap' }, render: (row) => row.branch || '—' },
  { key: 'warehouse', label: 'Warehouse', cellSx: { whiteSpace: 'nowrap' }, render: (row) => row.warehouse },
  { key: 'uom', label: 'UOM', render: (row) => row.uom },
  {
    key: 'onHandQty', label: 'On-Hand Qty', align: 'right', total: (t) => number3(t.onHandQty),
    render: (row) => (
      <Typography variant="body2" fontWeight={700} sx={{ color: `${STATUS_COLORS[row.status] || 'text.primary'}.main` }}>
        {number3(row.onHandQty)}
      </Typography>
    ),
  },
  { key: 'unitCost', label: 'Unit Cost (₹)', align: 'right', cellSx: { whiteSpace: 'nowrap' }, render: (row) => currency(row.unitCost) },
  // From the Active MRP / DLP price lists (latest effective date); '—' when
  // the item isn't on that list.
  { key: 'mrp', label: 'MRP (₹)', align: 'right', cellSx: { whiteSpace: 'nowrap' }, render: (row) => priceOrDash(row.mrp) },
  { key: 'dlp', label: 'DLP (₹)', align: 'right', cellSx: { whiteSpace: 'nowrap' }, total: (t) => currency(t.dlp), render: (row) => priceOrDash(row.dlp) },
  // On-Hand Qty x DLP -- '—' when the item isn't on the Active DLP price
  // list (dlp is null), same convention as the DLP column itself.
  { key: 'dlpValue', label: 'Total Value (₹)', align: 'right', cellSx: { whiteSpace: 'nowrap' }, total: (t) => currency(t.dlpValue), render: (row) => priceOrDash(row.dlpValue) },
  {
    key: 'status', label: 'Status',
    render: (row) => (
      <Typography variant="body2" fontWeight={700} sx={{ color: `${STATUS_COLORS[row.status] || 'text.primary'}.main` }}>
        {row.status}
      </Typography>
    ),
  },
];
// Leading columns the totals row's "Total" label spans across (mirrors the
// old fixed colSpan={6} = # + these five), so hiding any of them shrinks
// that span instead of leaving a gap.
const AVAILABLE_BALANCE_LABEL_KEYS = ['productCode', 'productName', 'productGroup', 'branch', 'warehouse', 'uom'];

// Column show/hide is a per-user display preference, not report data, so it
// is remembered across navigation (and browser restarts) in localStorage
// rather than plain component state, which was resetting to all-columns
// every time the user left this page and came back.
const HIDDEN_COLUMNS_STORAGE_KEY = 'availableBalance.hiddenColumns';
const VALID_COLUMN_KEYS = new Set(AVAILABLE_BALANCE_COLUMNS.map((c) => c.key));

function loadHiddenColumns() {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_COLUMNS_STORAGE_KEY) || '[]');
    if (!Array.isArray(saved)) return [];
    // Drop any key that no longer matches a real column (e.g. after a
    // column was renamed/removed in a later release) instead of silently
    // hiding nothing or crashing on a stale value.
    return saved.filter((key) => VALID_COLUMN_KEYS.has(key));
  } catch {
    return [];
  }
}

const DEFAULT_FILTERS = {
  branch: '', warehouse: '', productGroup: '', product: '', itemCategory: '',
  balanceStatus: 'All Items', asOnDate: dayjs().format('YYYY-MM-DD'),
};

// Reports > Inventory > Available Balance print layout — see ReportPrintable.jsx.
const PRINT_FILTER_LABELS = {
  branch: 'Branch', warehouse: 'Warehouse', productGroup: 'Product Group', product: 'Item',
  itemCategory: 'Item Category', balanceStatus: 'Balance Status', asOnDate: 'As On Date',
};
const PRINT_DATE_FIELDS = ['asOnDate'];

export default function AvailableBalance() {
  const theme = useTheme();
  const isMobile = useIsMobileListView();

  const { data: branches } = branchApi.useList();
  const { data: productGroups } = productGroupApi.useList();
  const { data: products } = productApi.useList();

  const branchOptions = useMemo(() => ([
    { label: 'All Branches', value: '' },
    ...(branches || []).map((b) => ({ label: b.branchName, value: b.branchName })),
  ]), [branches]);

  // Warehouses come from the Warehouse Master, not from whatever free-text
  // values happen to be sitting on Product.defaultLocation — see
  // lib/useWarehouseOptions.js.

  const productGroupOptions = useMemo(() => ([
    { label: 'All Groups', value: '' },
    ...(productGroups || []).map((g) => ({ label: g.groupName, value: g.groupName })),
  ]), [productGroups]);

  const productOptions = useMemo(() => ([
    { label: 'All Items', value: '' },
    ...(products || []).map((p) => ({ label: `${p.productCode} — ${p.productName}`, value: p.productCode })),
  ]), [products]);

  const itemCategoryOptions = useMemo(() => ([
    { label: 'All Categories', value: '' },
    ...PRODUCT_TYPE_OPTIONS.map((s) => ({ label: s, value: s })),
  ]), []);

  const balanceStatusOptions = useMemo(() => (
    BALANCE_STATUS_OPTIONS.map((s) => ({ label: s, value: s }))
  ), []);

  // Filter bar is a report toolbar, not a create/edit form — no Zod
  // validation or persisted mutation, same as the other inventory reports.
  const methods = useForm({
    defaultValues: {
      branch: '', warehouse: '', productGroup: '', product: '', itemCategory: '',
      balanceStatus: 'All Items', asOnDate: dayjs(),
    },
  });
  const { handleSubmit, reset, setValue, getValues } = methods;

  // Warehouse list follows the Branch filter: picking a branch offers only
  // that branch's warehouses (all of them while no branch is chosen, or while
  // no warehouse has been assigned a branch yet -- see useWarehouseOptions).
  const selectedBranch = useWatch({ control: methods.control, name: 'branch' });
  const { options: warehouseOptions } = useWarehouseOptions({ allLabel: 'All Warehouses', branch: selectedBranch || null });
  // Switching branch drops a Warehouse choice that belongs to the old one, so
  // the two filters can never contradict each other.
  useEffect(() => {
    const current = getValues('warehouse');
    if (current && !warehouseOptions.some((o) => o.value === current)) setValue('warehouse', '');
  }, [selectedBranch, warehouseOptions, getValues, setValue]);

  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [groupBy, setGroupBy] = useState('productCode');
  const [viewRow, setViewRow] = useState(null);

  // Which desktop-table columns are hidden -- see AVAILABLE_BALANCE_COLUMNS
  // and the "Columns" button in the toolbar below.
  const [hiddenColumns, setHiddenColumns] = useState(loadHiddenColumns);
  const [columnsMenuAnchor, setColumnsMenuAnchor] = useState(null);
  // Columns an admin excluded for this user (User Management > Permissions
  // > Columns). These are gone entirely -- not in the table, not offered in
  // the Columns menu, not exported, not printed.
  const currentUser = useSelector(selectCurrentUser);
  const excludedColumns = useMemo(() => excludedColumnsFor(currentUser, REPORT_MENU_KEY), [currentUser]);
  const isAllowed = (key) => !excludedColumns.includes(key);
  const allowedColumns = AVAILABLE_BALANCE_COLUMNS.filter((c) => isAllowed(c.key));
  const isColVisible = (key) => !hiddenColumns.includes(key);
  const toggleColumn = (key) => setHiddenColumns((prev) => (
    prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
  ));
  const visibleColumns = allowedColumns.filter((c) => isColVisible(c.key));

  // Keep the saved preference in sync with every tick/untick (and with
  // "Show all columns", which clears it back to []) so it's there the next
  // time this page mounts.
  useEffect(() => {
    try {
      localStorage.setItem(HIDDEN_COLUMNS_STORAGE_KEY, JSON.stringify(hiddenColumns));
    } catch {
      // Storage full/unavailable (e.g. private browsing) -- the toggle still
      // works for this visit, it just won't be remembered next time.
    }
  }, [hiddenColumns]);

  // See LowStockReport.jsx / lib/useLocalCachedQuery.js for what this
  // does: instant table on reload from localStorage. Freshness while the
  // tab stays open is handled by useTabSyncedReportQuery (see
  // hooks/useTabSyncedReportQuery.js) -- it refetches on becoming active
  // (mount / tab visible) if 45s+ has elapsed since last sync, otherwise
  // arms a timer for the remainder, so a long-open tab doesn't quietly go
  // stale. The per-row stock-ledger drill-down below is left as a plain
  // on-demand query -- it's only ever fetched right when a specific row
  // is clicked, so there's nothing stale to keep in sync while the page
  // just sits open.
  const availableBalanceQuery = useTabSyncedReportQuery(useGetAvailableBalanceReportQuery, appliedFilters);
  const cacheKey = useMemo(() => `availableBalanceReport:${JSON.stringify(appliedFilters)}`, [appliedFilters]);
  const { data, isLoading, isFetching } = useLocalCachedQuery(cacheKey, availableBalanceQuery);
  const baseTableRows = data?.rows || [];

  // Drill-down: the individual Stock ledger entries behind the clicked
  // row's On-Hand Qty --- see components/print aside, this is a genuinely
  // separate fetch (not data the main report already carries), scoped to
  // the same As On Date/branch the report row itself was computed under.
  const { data: ledgerData, isFetching: isLedgerFetching } = useGetAvailableBalanceStockLedgerQuery(
    viewRow ? { productCode: viewRow.productCode, warehouse: viewRow.warehouse, branch: appliedFilters.branch, asOnDate: appliedFilters.asOnDate } : undefined,
    { skip: !viewRow },
  );

  // Column definitions drive the global search, the sort icons and the
  // filter popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'productCode', headerName: 'Item No', filter: 'text' },
    { field: 'productName', headerName: 'Description', filter: 'text' },
    { field: 'productGroup', headerName: 'Product Group', filter: 'text' },
    { field: 'branch', headerName: 'Branch', filter: 'text' },
    { field: 'warehouse', headerName: 'Warehouse', filter: 'text' },
    { field: 'uom', headerName: 'UOM', filter: 'text' },
    { field: 'onHandQty', headerName: 'On-Hand Qty', filter: 'numberRange', sortValue: (row) => (row.onHandQty == null || row.onHandQty === '' ? null : Number(row.onHandQty)) },
    { field: 'minimumLevel', headerName: 'Min Level', filter: 'text' },
    { field: 'maximumLevel', headerName: 'Max Level', filter: 'text' },
    { field: 'unitCost', headerName: 'Unit Cost (₹)', filter: 'numberRange', sortValue: (row) => (row.unitCost == null || row.unitCost === '' ? null : Number(row.unitCost)) },
    { field: 'mrp', headerName: 'MRP (₹)', filter: 'numberRange', sortValue: (row) => (row.mrp == null ? null : Number(row.mrp)) },
    { field: 'dlp', headerName: 'DLP (₹)', filter: 'numberRange', sortValue: (row) => (row.dlp == null ? null : Number(row.dlp)) },
    { field: 'dlpValue', headerName: 'Total Value (₹)', filter: 'numberRange', sortValue: (row) => (row.dlpValue == null ? null : Number(row.dlpValue)) },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ].filter((c) => !excludedColumns.includes(c.field))), [excludedColumns]);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });

  // Group By re-sorts the same rows so the chosen dimension is grouped
  // together on screen — the underlying (item, warehouse) rows never
  // change, only the order they're presented in.
  const rows = useMemo(() => {
    const sorted = [...table.rows];
    if (groupBy === 'productCode') return sorted; // backend already sorts productCode, warehouse
    sorted.sort((a, b) => {
      const primary = String(a[groupBy] || '').localeCompare(String(b[groupBy] || ''));
      if (primary !== 0) return primary;
      return String(a.productCode || '').localeCompare(String(b.productCode || ''));
    });
    return sorted;
  }, [table.rows, groupBy]);
      const totals = useMemo(() => {
        if (table.isFiltering) {
          return rows.reduce((acc, r) => ({
            onHandQty: acc.onHandQty + (Number(r.onHandQty) || 0),
            onHandValue: acc.onHandValue + (Number(r.onHandValue) || 0),
            dlp: acc.dlp + (Number(r.dlp) || 0),
            dlpValue: acc.dlpValue + (Number(r.dlpValue) || 0),
            committedQty: acc.committedQty + (Number(r.committedQty) || 0),
            availableToSellQty: acc.availableToSellQty + (Number(r.availableToSellQty) || 0),
          }), { onHandQty: 0, onHandValue: 0, dlp: 0, dlpValue: 0, committedQty: 0, availableToSellQty: 0 });
        }
        return data?.totals || {};
      }, [table.isFiltering, rows, data?.totals]);
    
      const stats = useMemo(() => {
        if (table.isFiltering) {
          const distinctItems = new Set(rows.map((r) => r.productCode)).size;
          const distinctWh = new Set(rows.map((r) => r.warehouse)).size;
          return {
            totalItems: distinctItems,
            totalWarehouses: distinctWh,
            totalOnHandQty: totals.onHandQty,
            totalCommittedQty: totals.committedQty,
            totalAvailableToSellQty: totals.availableToSellQty,
            totalStockValue: totals.dlpValue,
          };
        }
        return data?.stats || {};
      }, [table.isFiltering, rows, totals, data?.stats]);
    
      const statusOverview = useMemo(() => {
        if (table.isFiltering) {
          const counts = { Available: 0, 'Low Stock': 0, 'Out of Stock': 0, Overstock: 0 };
          rows.forEach((r) => {
            if (counts[r.status] !== undefined) counts[r.status] += 1;
          });
          return Object.entries(counts)
            .filter(([, v]) => v > 0)
            .map(([name, value]) => ({ name, value }));
        }
        return data?.statusOverview || [];
      }, [table.isFiltering, rows, data?.statusOverview]);
    
      const topLowStockItems = useMemo(() => {
        if (table.isFiltering) {
          return [...rows]
            .filter((r) => r.status === 'Low Stock')
            .sort((a, b) => (Number(a.onHandQty) || 0) - (Number(b.onHandQty) || 0))
            .slice(0, 5)
            .map((r) => ({ name: `${r.productCode} (${r.warehouse})`, value: Number(r.onHandQty) || 0 }));
        }
        return data?.topLowStockItems || [];
      }, [table.isFiltering, rows, data?.topLowStockItems]);

  const stockValueByWarehouse = data?.stockValueByWarehouse || [];
  const onHandValueByGroup = data?.onHandValueByGroup || [];
  const pagedRows = useMemo(() => rows.slice(page * pageSize, page * pageSize + pageSize), [rows, page, pageSize]);

  // Print: full filtered/sorted rows (never just the current page), fed into
  // the shared ReportPrintable layout — see components/print/ReportPrintable.jsx.
  const printFilters = useMemo(
    () => buildPrintFilters(appliedFilters, PRINT_FILTER_LABELS, PRINT_DATE_FIELDS),
    [appliedFilters],
  );

  // Print rows: the Filters-section-scoped baseTableRows (never the
  // quick-search/column-filter-popover-narrowed `rows` used on screen), with
  // the same Group By ordering `rows` applies above -- so Print always shows
  // the full result of the Filters section regardless of what's currently
  // typed in the search box or picked in the per-column filter popover. See
  // SalesQuotationRegister.jsx for the reference fix.
  const printRows = useMemo(() => {
    const sorted = [...baseTableRows];
    if (groupBy === 'productCode') return sorted;
    sorted.sort((a, b) => {
      const primary = String(a[groupBy] || '').localeCompare(String(b[groupBy] || ''));
      if (primary !== 0) return primary;
      return String(a.productCode || '').localeCompare(String(b.productCode || ''));
    });
    return sorted;
  }, [baseTableRows, groupBy]);

  const onView = handleSubmit((values) => {
    setAppliedFilters({
      branch: values.branch || '',
      warehouse: values.warehouse || '',
      productGroup: values.productGroup || '',
      product: values.product || '',
      itemCategory: values.itemCategory || '',
      balanceStatus: values.balanceStatus || 'All Items',
      asOnDate: values.asOnDate ? dayjs(values.asOnDate).format('YYYY-MM-DD') : '',
    });
    setPage(0);
  });

  const onReset = () => {
    reset({
      branch: '', warehouse: '', productGroup: '', product: '', itemCategory: '',
      balanceStatus: 'All Items', asOnDate: dayjs(),
    });
    setAppliedFilters(DEFAULT_FILTERS);
    setPage(0);
  };

  // Mobile "Total" card -- every figure follows the same column permissions as
  // the desktop table's totals row, so a user without DLP / Total Value access
  // never sees those sums on a phone either.
  const mobileTotals = [
    ['onHandQty', 'On-Hand Qty', number3(totals.onHandQty)],
    ['dlp', 'DLP Total', currency(totals.dlp)],
    ['dlpValue', 'Total Value', currency(totals.dlpValue)],
  ].filter(([key]) => isAllowed(key)).map(([, label, value]) => [label, value]);

  const statCards = [
    { icon: <Inventory2OutlinedIcon fontSize="small" />, label: 'Total Items', value: stats.totalItems ?? 0, color: 'secondary' },
    { icon: <HomeOutlinedIcon fontSize="small" />, label: 'Total Warehouses', value: stats.totalWarehouses ?? 0, color: 'primary' },
    { icon: <LayersOutlinedIcon fontSize="small" />, label: 'Total On-Hand Qty', value: number3(stats.totalOnHandQty), color: 'success' },
    ...(isAllowed('dlpValue') ? [{ icon: <CurrencyRupeeOutlinedIcon fontSize="small" />, label: 'Total Stock Value', value: currency(stats.totalStockValue), color: 'primary' }] : []),
  ];

  const donutColors = [
    theme.palette.primary.main, theme.palette.success.main, theme.palette.warning.main,
    theme.palette.secondary.main, theme.palette.error.main, theme.palette.grey[400],
  ];
  const statusDonutColors = [theme.palette.success.main, theme.palette.warning.main, theme.palette.error.main, theme.palette.grey[400]];
  const chartTooltipStyle = { backgroundColor: theme.palette.background.paper, border: `1px solid ${theme.palette.divider}`, borderRadius: 8 };

  // Export: current filtered rows to CSV — same client-side pattern used
  // elsewhere (ReorderLevel.jsx).
  const EXPORT_COLUMNS = [
    ['productCode', 'Item No'], ['productName', 'Description'], ['productGroup', 'Product Group'], ['branch', 'Branch'], ['warehouse', 'Warehouse'],
    ['uom', 'UOM'], ['onHandQty', 'On-Hand Qty'], ['minimumLevel', 'Min Level'],
    ['maximumLevel', 'Max Level'], ['unitCost', 'Unit Cost'], ['mrp', 'MRP'], ['dlp', 'DLP'], ['dlpValue', 'Total Value'],
    ['status', 'Status'],
  ].filter(([key]) => isAllowed(key));
  const handleExport = () => {
    const header = EXPORT_COLUMNS.map(([, label]) => label).join(',');
    const lines = printRows.map((r) => EXPORT_COLUMNS.map(([key]) => `"${String(r[key] ?? '').replace(/"/g, '""')}"`).join(','));
    const csv = [header, ...lines].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'available-balance-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<WarehouseOutlinedIcon />}
        title="Available Balance"
        subtitle="On-hand stock by item and warehouse, with reorder and overstock status."
        rightContent={<CompanyBadge />}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Filters</Typography>
          <FormProvider {...methods}>
            <Grid container spacing={2} alignItems="flex-start">
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="branch" label="Branch" options={branchOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="warehouse" label="Warehouse" options={warehouseOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="productGroup" label="Product Group" options={productGroupOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="product" label="Item" options={productOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="itemCategory" label="Item Category" options={itemCategoryOptions} emptyValue="" />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormSelect name="balanceStatus" label="Balance Status" options={balanceStatusOptions} />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <FormDatePicker name="asOnDate" label="As On Date" />
              </Grid>
              <Grid item xs={12} sm={12} md={3}>
                <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap sx={{ height: '100%', alignItems: 'flex-end' }}>
                  <Button
                    variant="contained"
                    color="primary"
                    startIcon={<SearchIcon />}
                    onClick={onView}
                    disabled={isFetching}
                    sx={{ height: 40, minWidth: 110, whiteSpace: 'nowrap' }}
                  >
                    View Report
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={onReset} sx={{ height: 40, minWidth: 90 }}>
                    Reset
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </FormProvider>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {statCards.map((c) => (
          <Grid item xs={12} sm={6} md={2} key={c.label}>
            <StatCard {...c} />
          </Grid>
        ))}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent sx={{ p: 0 }}>
          <TableToolbar
            title="On-Hand Balance"
            searchPlaceholder="Search items (e.g. a,b,c)"
            table={table}
            resultCount={rows.length}
            totalCount={table.totalCount}
            showFilter={false}
            rightContent={(
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  color="inherit"
                  size="small"
                  startIcon={<ViewColumnOutlinedIcon />}
                  onClick={(e) => setColumnsMenuAnchor(e.currentTarget)}
                >
                  Columns
                </Button>
                <Menu
                  anchorEl={columnsMenuAnchor}
                  open={Boolean(columnsMenuAnchor)}
                  onClose={() => setColumnsMenuAnchor(null)}
                >
                  <MenuItem
                    onClick={() => setHiddenColumns([])}
                    disabled={hiddenColumns.length === 0}
                  >
                    <ListItemText>Show all columns</ListItemText>
                  </MenuItem>
                  <Divider />
                  {allowedColumns.map((c) => (
                    <MenuItem key={c.key} onClick={() => toggleColumn(c.key)} dense>
                      <Checkbox size="small" checked={isColVisible(c.key)} sx={{ p: 0.5, mr: 1 }} />
                      <ListItemText primary={c.label} />
                    </MenuItem>
                  ))}
                </Menu>
                <FormControl size="small" sx={{ minWidth: 160 }}>
                  <InputLabel id="available-balance-group-by-label">Group By</InputLabel>
                  <Select
                    labelId="available-balance-group-by-label"
                    label="Group By"
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                  >
                    {GROUP_BY_OPTIONS.map((o) => (
                      <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button variant="outlined" color="inherit" size="small" startIcon={<FileDownloadOutlinedIcon />} onClick={handleExport}>
                  Export
                </Button>
                <Button variant="outlined" color="inherit" size="small" startIcon={<PrintOutlinedIcon />} onClick={() => window.print()}>
                  Print
                </Button>
              </Stack>
            )}
          />
          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row, idx) => (
                <MobileRecordCard
                  key={`${row.productCode}::${row.warehouse}`}
                  title={isAllowed('productName') ? row.productName : row.productCode}
                  onView={() => setViewRow(row)}
                  statusChip={isAllowed('status') ? (
                    <Typography variant="caption" fontWeight={700} sx={{ color: `${STATUS_COLORS[row.status] || 'text.primary'}.main` }}>{row.status}</Typography>
                  ) : null}
                  fields={[
                    { label: '#', value: page * pageSize + idx + 1 },
                    { key: 'productCode', label: 'Item No', value: row.productCode },
                    { key: 'branch', label: 'Branch', value: row.branch || '—' },
                    { key: 'warehouse', label: 'Warehouse', value: row.warehouse },
                    { key: 'onHandQty', label: 'On-Hand Qty', value: number3(row.onHandQty) },
                    { key: 'unitCost', label: 'Unit Cost', value: currency(row.unitCost) },
                    { key: 'mrp', label: 'MRP', value: priceOrDash(row.mrp) },
                    { key: 'dlp', label: 'DLP', value: priceOrDash(row.dlp) },
                    { key: 'dlpValue', label: 'Total Value', value: priceOrDash(row.dlpValue) },
                  ].filter((f) => !f.key || isAllowed(f.key)).map(({ key, ...f }) => f)}
                />
              ))}
              {!isLoading && rows.length === 0 && (
                isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock found for the selected criteria" message="Try adjusting your date range or filters" />
                )
              )}
              {!isLoading && rows.length > 0 && mobileTotals.length > 0 && (
                <Card variant="outlined" sx={{ mb: 1.5, bgcolor: 'action.hover' }}>
                  <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Total</Typography>
                    <Stack spacing={0.75}>
                      {mobileTotals.map(([label, value]) => (
                        <Stack key={label} direction="row" justifyContent="space-between">
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography variant="body2" fontWeight={700}>{value}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    {visibleColumns.map((c) => (
                      <SortableHeaderCell key={c.key} field={c.key} sort={table.sort} onSort={table.toggleSort} align={c.align}>
                        {c.label}
                      </SortableHeaderCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, idx) => (
                    <TableRow
                      key={`${row.productCode}::${row.warehouse}`}
                      hover
                      onClick={() => setViewRow(row)}
                      sx={{ cursor: 'pointer' }}
                    >
                      <TableCell>{page * pageSize + idx + 1}</TableCell>
                      {visibleColumns.map((c) => (
                        <TableCell key={c.key} align={c.align} sx={c.cellSx}>{c.render(row)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {!isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={1 + visibleColumns.length}>
                        {isFetching ? (
                  <LoadingState label="Loading…" />
                ) : (
                  <EmptyState icon={<Inventory2OutlinedIcon sx={{ fontSize: 48 }} />} title="No stock found for the selected criteria" message="Try adjusting your date range or filters" />
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                  {!isLoading && rows.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={1 + visibleColumns.filter((c) => AVAILABLE_BALANCE_LABEL_KEYS.includes(c.key)).length}>
                        <Typography fontWeight={700}>Total</Typography>
                      </TableCell>
                      {visibleColumns.filter((c) => !AVAILABLE_BALANCE_LABEL_KEYS.includes(c.key)).map((c) => (
                        <TableCell key={c.key} align={c.align}>
                          {c.total ? <Typography fontWeight={700}>{c.total(totals)}</Typography> : '—'}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={rows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Balance Status Overview</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={statusOverview} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {statusOverview.map((entry, i) => <Cell key={entry.name} fill={statusDonutColors[i % statusDonutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => number3(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  <Typography variant="subtitle2" fontWeight={700}>{rows.length} Rows</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {statusOverview.map((d, i) => {
                  const rowTotal = statusOverview.reduce((sum, e) => sum + e.value, 0) || 1;
                  const percent = Math.round((d.value / rowTotal) * 1000) / 10;
                  return (
                    <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: statusDonutColors[i % statusDonutColors.length], flexShrink: 0 }} />
                        <Typography variant="caption" color="text.secondary" noWrap>{d.name}</Typography>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{d.value} ({percent}%)</Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Top 5 Low Stock Rows</Typography>
              <Box sx={{ width: '100%', height: 300, mt: 1 }}>
                {topLowStockItems.length === 0 ? (
                  // Recharts' vertical BarChart can't compute a category-axis
                  // domain from an empty dataset, so it renders as a blank
                  // box (no axes, no "no data" message) rather than an empty
                  // chart -- show a proper empty state instead, same as the
                  // table above does when there's nothing to show.
                  <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                    <EmptyState icon={<WarningAmberOutlinedIcon sx={{ fontSize: 40 }} />} title="No low stock rows" message="Nothing is at or below its reorder/minimum level right now." />
                  </Stack>
                ) : (
                  <ResponsiveContainer>
                    <BarChart data={topLowStockItems} layout="vertical" margin={{ top: 5, right: 40, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                      <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => number3(v)} />
                      <Bar dataKey="value" fill={theme.palette.warning.main} radius={[0, 4, 4, 0]} maxBarSize={14}>
                        <LabelList dataKey="value" position="right" formatter={(v) => number3(v)} style={{ fontSize: 9, fill: theme.palette.text.secondary }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3} sx={isAllowed('dlpValue') ? undefined : { display: 'none' }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Stock Value by Warehouse</Typography>
              <Box sx={{ width: '100%', height: 260, mt: 1 }}>
                <ResponsiveContainer>
                  <BarChart data={stockValueByWarehouse} margin={{ top: 20, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 10, fill: theme.palette.text.secondary }} axisLine={false} tickLine={false} />
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                    <Bar dataKey="value" fill={theme.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={36}>
                      <LabelList dataKey="value" position="top" formatter={(v) => currency(v)} style={{ fontSize: 9, fill: theme.palette.text.secondary }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3} sx={isAllowed('dlpValue') ? undefined : { display: 'none' }}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>On-Hand Value by Product Group</Typography>
              <Box sx={{ width: '100%', height: 180, position: 'relative' }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={onHandValueByGroup} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                      {onHandValueByGroup.map((entry, i) => <Cell key={entry.name} fill={donutColors[i % donutColors.length]} />)}
                    </Pie>
                    <RechartsTooltip contentStyle={chartTooltipStyle} formatter={(v) => currency(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="caption" color="text.secondary" display="block">Total</Typography>
                  {/* This chart's own on-hand-value breakdown, not the DLP-based
                      Total Stock Value stat card -- the two no longer represent
                      the same figure now that the stat card tracks the DLP total. */}
                  <Typography variant="subtitle2" fontWeight={700}>{currency(onHandValueByGroup.reduce((sum, d) => sum + (Number(d.value) || 0), 0))}</Typography>
                </Box>
              </Box>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {onHandValueByGroup.map((d, i) => (
                  <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: donutColors[i % donutColors.length], flexShrink: 0 }} />
                      <Typography variant="caption" color="text.secondary" noWrap>{d.name}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">{currency(d.value)} ({d.percent}%)</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <ReportPrintable
        title="Available Balance Report"
        subtitle="On-hand stock by item and warehouse."
        filters={printFilters}
        columns={tableColumns}
        rows={printRows}
        totals={totals}
        totalsLabel="Total"
        orientation="landscape"
      />

      <Dialog open={!!viewRow} onClose={() => setViewRow(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Stock Ledger — {viewRow?.productName} ({viewRow?.productCode}) @ {viewRow?.warehouse}
        </DialogTitle>
        <DialogContent dividers>
          {isLedgerFetching ? (
            <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={28} /></Stack>
          ) : (
            (ledgerData?.entries || []).length === 0 ? (
              <EmptyState
                icon={<Inventory2OutlinedIcon sx={{ fontSize: 40 }} />}
                title="No ledger entries found"
                message="Nothing has posted against this item in this warehouse as of the selected date."
              />
            ) : (
              <ScrollableTableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Document Type</TableCell>
                      <TableCell>Document No</TableCell>
                      <TableCell align="right">In Qty</TableCell>
                      <TableCell align="right">Out Qty</TableCell>
                      <TableCell align="right">Price (₹)</TableCell>
                      <TableCell align="right">Running Qty</TableCell>
                      <TableCell align="right">Running Value (₹)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(ledgerData?.entries || []).map((e) => (
                      <TableRow key={e.logEntry} hover>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{e.date ? dayjs(e.date).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{e.baseType}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{e.baseNum}</TableCell>
                        <TableCell align="right">{e.inQty ? number3(e.inQty) : '—'}</TableCell>
                        <TableCell align="right">{e.outQty ? number3(e.outQty) : '—'}</TableCell>
                        <TableCell align="right">{currency(e.price)}</TableCell>
                        <TableCell align="right"><Typography variant="body2" fontWeight={700}>{number3(e.runningQty)}</Typography></TableCell>
                        <TableCell align="right">{currency(e.runningValue)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3}><Typography fontWeight={700}>Closing Balance</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{number3(ledgerData?.totals?.inQty)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{number3(ledgerData?.totals?.outQty)}</Typography></TableCell>
                      <TableCell>—</TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{number3(ledgerData?.totals?.closingQty)}</Typography></TableCell>
                      <TableCell align="right"><Typography fontWeight={700}>{currency(ledgerData?.totals?.closingValue)}</Typography></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            )
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
