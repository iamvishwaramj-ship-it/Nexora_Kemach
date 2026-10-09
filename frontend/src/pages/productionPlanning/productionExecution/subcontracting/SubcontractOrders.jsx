import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import EntityHeaderCard from '../../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Subcontract Orders" list screen under the new
// Production Execution > Subcontracting submenu. No reference screenshots
// were supplied for this request, so this was designed from scratch using
// the same filter/list/pagination convention as other Production Execution
// list screens (Production Orders, Production Order Report). No
// Subcontracting data model exists in this schema -- fixed mock data only,
// nothing persists or calls the server.
// ---------------------------------------------------------------------------

const VENDORS = ['All Vendors', 'Precision Platers Pvt Ltd', 'Shree Heat Treatment Works', 'Apex Coatings Ltd', 'Sun Plating Industries', 'Metro Surface Finishers'];
const STATUS_OPTIONS = ['All', 'Open', 'Partially Issued', 'Partially Received', 'Closed', 'Cancelled'];
const STATUS_COLOR = { Open: 'primary', 'Partially Issued': 'warning', 'Partially Received': 'info', Closed: 'success', Cancelled: 'default' };

const ORDERS = [
  { no: 'SC-2026-014', date: '05-Oct-2026', vendor: 'Precision Platers Pvt Ltd', process: 'Electroplating', itemCode: 'FG-1001', itemDesc: 'Gear Housing', uom: 'Nos', qty: 200, due: '15-Oct-2026', status: 'Open' },
  { no: 'SC-2026-013', date: '03-Oct-2026', vendor: 'Shree Heat Treatment Works', process: 'Heat Treatment', itemCode: 'FG-1004', itemDesc: 'Shaft', uom: 'Nos', qty: 350, due: '12-Oct-2026', status: 'Partially Issued' },
  { no: 'SC-2026-012', date: '02-Oct-2026', vendor: 'Apex Coatings Ltd', process: 'Powder Coating', itemCode: 'FG-1002', itemDesc: 'Cover Plate', uom: 'Nos', qty: 500, due: '11-Oct-2026', status: 'Partially Received' },
  { no: 'SC-2026-011', date: '29-Sep-2026', vendor: 'Sun Plating Industries', process: 'Zinc Plating', itemCode: 'FG-1006', itemDesc: 'Bracket', uom: 'Nos', qty: 150, due: '08-Oct-2026', status: 'Closed' },
  { no: 'SC-2026-010', date: '27-Sep-2026', vendor: 'Metro Surface Finishers', process: 'Anodizing', itemCode: 'FG-1001', itemDesc: 'Gear Housing', uom: 'Nos', qty: 400, due: '06-Oct-2026', status: 'Closed' },
  { no: 'SC-2026-009', date: '24-Sep-2026', vendor: 'Precision Platers Pvt Ltd', process: 'Electroplating', itemCode: 'FG-1003', itemDesc: 'Pin', uom: 'Nos', qty: 1000, due: '03-Oct-2026', status: 'Closed' },
  { no: 'SC-2026-008', date: '22-Sep-2026', vendor: 'Shree Heat Treatment Works', process: 'Heat Treatment', itemCode: 'FG-1004', itemDesc: 'Shaft', uom: 'Nos', qty: 280, due: '01-Oct-2026', status: 'Cancelled' },
  { no: 'SC-2026-007', date: '18-Sep-2026', vendor: 'Apex Coatings Ltd', process: 'Powder Coating', itemCode: 'FG-1002', itemDesc: 'Cover Plate', uom: 'Nos', qty: 320, due: '28-Sep-2026', status: 'Closed' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function SubcontractOrders() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-10-31');
  const [vendor, setVendor] = useState('All Vendors');
  const [status, setStatus] = useState('All');
  const [orderSearch, setOrderSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(() => ORDERS.filter((o) => {
    if (vendor !== 'All Vendors' && o.vendor !== vendor) return false;
    if (status !== 'All' && o.status !== status) return false;
    if (orderSearch && !o.no.toLowerCase().includes(orderSearch.toLowerCase())) return false;
    if (itemSearch && !(`${o.itemCode} ${o.itemDesc}`.toLowerCase().includes(itemSearch.toLowerCase()))) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return o.no.toLowerCase().includes(q) || o.vendor.toLowerCase().includes(q) || o.itemCode.toLowerCase().includes(q);
  }), [vendor, status, orderSearch, itemSearch, search]);

  const summary = useMemo(() => ({
    total: ORDERS.length,
    open: ORDERS.filter((o) => o.status === 'Open').length,
    inProgress: ORDERS.filter((o) => o.status === 'Partially Issued' || o.status === 'Partially Received').length,
    closed: ORDERS.filter((o) => o.status === 'Closed').length,
  }), []);

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/subcontracting/new-subcontracting-order')}>
        New Subcontracting Order
      </Button>
      <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
    </Stack>
  );

  const tiles = [
    { label: 'Total Orders', value: summary.total, icon: AssignmentOutlinedIcon, color: 'primary' },
    { label: 'Open', value: summary.open, icon: HourglassBottomOutlinedIcon, color: 'info' },
    { label: 'In Progress', value: summary.inProgress, icon: WarningAmberOutlinedIcon, color: 'warning' },
    { label: 'Closed', value: summary.closed, icon: CheckCircleOutlineIcon, color: 'success' },
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<PrecisionManufacturingIcon />}
        title="Subcontract Orders"
        subtitle="Track orders placed with vendors for subcontracted processes and outsourced operations."
        rightContent={headerActions}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Grid item xs={12} sm={6} md={3} key={t.label}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{
                      width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: `${t.color}.lighter`, color: `${t.color}.main`, flexShrink: 0,
                    }}>
                      <Icon fontSize="small" />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{t.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.label}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Filter / Search */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
            <FilterListOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>Filter / Search</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" type="date" label="From Date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" type="date" label="To Date" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                {VENDORS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Order No." placeholder="Search order..."
                value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Button fullWidth variant="contained" color="warning" startIcon={<SearchIcon />} sx={{ height: '40px' }}>Search</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* List */}
      <Card variant="outlined">
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>Subcontract Orders</Typography>
            <Chip size="small" label={rows.length} color="primary" />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField
              size="small" placeholder="Search in list..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Button variant="outlined" size="small" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
          </Stack>
        </Stack>

        <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 560px), 460px)">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>S.No</TableCell>
                <TableCell>Subcontract Order No.</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Process</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell align="right">Qty</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((o, idx) => (
                <TableRow key={o.no} hover>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(o.no)} onChange={() => toggleRow(o.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{o.no}</Typography></TableCell>
                  <TableCell>{o.date}</TableCell>
                  <TableCell>{o.vendor}</TableCell>
                  <TableCell>{o.process}</TableCell>
                  <TableCell>{o.itemCode}</TableCell>
                  <TableCell>{o.itemDesc}</TableCell>
                  <TableCell align="right">{numberFmt(o.qty)} {o.uom}</TableCell>
                  <TableCell>{o.due}</TableCell>
                  <TableCell><Chip size="small" label={o.status} color={STATUS_COLOR[o.status] || 'default'} /></TableCell>
                  <TableCell>
                    <Button size="small" endIcon={<KeyboardArrowDownIcon />}>View</Button>
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
      </Card>
    </Box>
  );
}
