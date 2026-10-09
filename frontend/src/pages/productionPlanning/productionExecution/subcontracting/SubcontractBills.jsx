import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import EntityHeaderCard from '../../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of "Subcontract Bills" (vendor billing for
// subcontracted processes) under Production Execution > Subcontracting. No
// reference screenshots supplied; built from scratch following the same
// filter/list/pagination convention used across this module.
// ---------------------------------------------------------------------------

const VENDORS = ['All Vendors', 'Precision Platers Pvt Ltd', 'Shree Heat Treatment Works', 'Apex Coatings Ltd', 'Sun Plating Industries', 'Metro Surface Finishers'];
const STATUS_OPTIONS = ['All', 'Pending Approval', 'Approved', 'Paid'];
const STATUS_COLOR = { 'Pending Approval': 'warning', Approved: 'info', Paid: 'success' };

const BILLS = [
  { no: 'SCB-2026-051', date: '08-Oct-2026', order: 'SC-2026-012', vendor: 'Apex Coatings Ltd', amount: 174000, status: 'Pending Approval' },
  { no: 'SCB-2026-050', date: '05-Oct-2026', order: 'SC-2026-011', vendor: 'Sun Plating Industries', amount: 87500, status: 'Approved' },
  { no: 'SCB-2026-049', date: '03-Oct-2026', order: 'SC-2026-010', vendor: 'Metro Surface Finishers', amount: 212000, status: 'Paid' },
  { no: 'SCB-2026-048', date: '30-Sep-2026', order: 'SC-2026-009', vendor: 'Precision Platers Pvt Ltd', amount: 315000, status: 'Paid' },
  { no: 'SCB-2026-047', date: '28-Sep-2026', order: 'SC-2026-007', vendor: 'Apex Coatings Ltd', amount: 98500, status: 'Pending Approval' },
  { no: 'SCB-2026-046', date: '22-Sep-2026', order: 'SC-2026-006', vendor: 'Shree Heat Treatment Works', amount: 142000, status: 'Paid' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function SubcontractBills() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-10-31');
  const [vendor, setVendor] = useState('All Vendors');
  const [status, setStatus] = useState('All');
  const [billSearch, setBillSearch] = useState('');
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(() => BILLS.filter((b) => {
    if (vendor !== 'All Vendors' && b.vendor !== vendor) return false;
    if (status !== 'All' && b.status !== status) return false;
    if (billSearch && !b.no.toLowerCase().includes(billSearch.toLowerCase())) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return b.no.toLowerCase().includes(q) || b.vendor.toLowerCase().includes(q) || b.order.toLowerCase().includes(q);
  }), [vendor, status, billSearch, search]);

  const summary = useMemo(() => ({
    total: BILLS.length,
    pending: BILLS.filter((b) => b.status === 'Pending Approval').length,
    approvedAmount: BILLS.filter((b) => b.status === 'Approved').reduce((s, b) => s + b.amount, 0),
    paidAmount: BILLS.filter((b) => b.status === 'Paid').reduce((s, b) => s + b.amount, 0),
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
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/subcontracting/new-bill')}>
        New Bill
      </Button>
    </Stack>
  );

  const tiles = [
    { label: 'Total Bills', value: summary.total, icon: ReceiptLongOutlinedIcon, color: 'primary' },
    { label: 'Pending Approval', value: summary.pending, icon: HourglassBottomOutlinedIcon, color: 'warning' },
    { label: 'Approved Amount', value: `₹ ${numberFmt(summary.approvedAmount)}`, icon: CheckCircleOutlineIcon, color: 'info' },
    { label: 'Paid Amount', value: `₹ ${numberFmt(summary.paidAmount)}`, icon: AccountBalanceWalletOutlinedIcon, color: 'success' },
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<ReceiptLongOutlinedIcon />}
        title="Subcontract Bills"
        subtitle="Track and approve vendor bills raised for subcontracted processes."
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
                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${t.color}.lighter`, color: `${t.color}.main`, flexShrink: 0 }}>
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
                fullWidth size="small" label="Bill No." placeholder="Search bill..."
                value={billSearch} onChange={(e) => setBillSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Button fullWidth variant="contained" color="warning" startIcon={<SearchIcon />} sx={{ height: '40px' }}>Search</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>Subcontract Bills</Typography>
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
                <TableCell>Bill No.</TableCell>
                <TableCell>Bill Date</TableCell>
                <TableCell>Subcontract Order No.</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell align="right">Bill Amount</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((b, idx) => (
                <TableRow key={b.no} hover>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(b.no)} onChange={() => toggleRow(b.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{b.no}</Typography></TableCell>
                  <TableCell>{b.date}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{b.order}</Typography></TableCell>
                  <TableCell>{b.vendor}</TableCell>
                  <TableCell align="right">₹ {numberFmt(b.amount)}</TableCell>
                  <TableCell><Chip size="small" label={b.status} color={STATUS_COLOR[b.status] || 'default'} /></TableCell>
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
