import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Pagination, List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import CreditCardOutlinedIcon from '@mui/icons-material/CreditCardOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Subcontract Bills" under Subcontracting -- rebuilt to pixel-match the
// user-supplied reference screenshot. Static UI-only mock; no
// Subcontracting data model exists in this schema.
// ---------------------------------------------------------------------------

const VENDORS = ['All', 'Sri Balaji HT', 'Alpha Engineering', 'Metal Works', 'Shakti Coating', 'Precision Grinding'];
const BILL_STATUS_OPTIONS = ['All', 'Approved', 'Pending', 'On Hold'];
const PAYMENT_STATUS_OPTIONS = ['All', 'Paid', 'Not Paid', 'Partial'];
const WORK_CENTERS = ['All', 'Heat Treatment', 'CNC Machining', 'Surface Coating', 'Plating', 'Grinding', 'Turning', 'Zinc Plating', 'Powder Coating', 'Centerless Grinding'];
const SHOW_OPTIONS = ['Summary & Details', 'Summary Only', 'Details Only'];

const BILL_STATUS_COLOR = { Approved: 'success', Pending: 'warning', 'On Hold': 'error' };
const PAYMENT_STATUS_COLOR = { Paid: 'success', 'Not Paid': 'error', Partial: 'warning' };

const BILLS = [
  { no: 'SCB-2026-001', date: '01-Oct-2026', sco: 'SCO-2026-001', vendor: 'Sri Balaji HT', process: 'Heat Treatment', billValue: 80000, tax: 14400, total: 94400, billStatus: 'Approved', paymentStatus: 'Paid' },
  { no: 'SCB-2026-002', date: '02-Oct-2026', sco: 'SCO-2026-002', vendor: 'Alpha Engineering', process: 'CNC Machining', billValue: 120000, tax: 21600, total: 141600, billStatus: 'Pending', paymentStatus: 'Not Paid' },
  { no: 'SCB-2026-003', date: '03-Oct-2026', sco: 'SCO-2026-003', vendor: 'Metal Works', process: 'Surface Coating', billValue: 65000, tax: 11700, total: 76700, billStatus: 'Approved', paymentStatus: 'Partial' },
  { no: 'SCB-2026-004', date: '04-Oct-2026', sco: 'SCO-2026-004', vendor: 'Shakti Coating', process: 'Plating', billValue: 95000, tax: 17100, total: 112100, billStatus: 'On Hold', paymentStatus: 'Not Paid' },
  { no: 'SCB-2026-005', date: '05-Oct-2026', sco: 'SCO-2026-005', vendor: 'Precision Grinding', process: 'Grinding', billValue: 70000, tax: 12600, total: 82600, billStatus: 'Approved', paymentStatus: 'Paid' },
  { no: 'SCB-2026-006', date: '06-Oct-2026', sco: 'SCO-2026-006', vendor: 'Sri Balaji HT', process: 'Heat Treatment', billValue: 110000, tax: 19800, total: 129800, billStatus: 'Pending', paymentStatus: 'Not Paid' },
  { no: 'SCB-2026-007', date: '07-Oct-2026', sco: 'SCO-2026-007', vendor: 'Alpha Engineering', process: 'Turning', billValue: 85000, tax: 15300, total: 100300, billStatus: 'Approved', paymentStatus: 'Paid' },
  { no: 'SCB-2026-008', date: '08-Oct-2026', sco: 'SCO-2026-008', vendor: 'Metal Works', process: 'Zinc Plating', billValue: 45000, tax: 8100, total: 53100, billStatus: 'Approved', paymentStatus: 'Paid' },
  { no: 'SCB-2026-009', date: '09-Oct-2026', sco: 'SCO-2026-009', vendor: 'Shakti Coating', process: 'Powder Coating', billValue: 60000, tax: 10800, total: 70800, billStatus: 'Pending', paymentStatus: 'Not Paid' },
  { no: 'SCB-2026-010', date: '10-Oct-2026', sco: 'SCO-2026-010', vendor: 'Precision Grinding', process: 'Centerless Grinding', billValue: 125000, tax: 22500, total: 147500, billStatus: 'Approved', paymentStatus: 'Partial' },
];

const TOTAL_RECORDS = 18;
const TOTAL_PAGES = 3;

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Subcontracting</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>Subcontract Bills</Typography> */}
    </Stack>
  );
}

export default function SubcontractBills() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [scoNo, setScoNo] = useState('');
  const [vendor, setVendor] = useState('All');
  const [billNo, setBillNo] = useState('');
  const [billStatus, setBillStatus] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [paymentStatus, setPaymentStatus] = useState('All');
  const [show, setShow] = useState('Summary & Details');

  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedTab, setSelectedTab] = useState('general');
  const selected = BILLS[0];

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const toggleAll = () => {
    setChecked((prev) => (prev.size === BILLS.length ? new Set() : new Set(BILLS.map((i) => i.no))));
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/subcontracting/new-bill')}>
          New Bill
        </Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
        <Button variant="outlined" startIcon={<SettingsOutlinedIcon />}>Set As Default</Button>
      </Stack>
    </Stack>
  );

  const SUMMARY_TILES = [
    { label: 'Total Bills', value: '18', sub: '↑ 28.6%', icon: DescriptionOutlinedIcon, color: 'primary' },
    { label: 'Total Bill Value', value: '₹ 24,56,800', sub: '↑ 18.4%', icon: Inventory2Icon, color: 'success' },
    { label: 'Pending Approval', value: '4', sub: '↓ 20.0%', icon: AccessTimeOutlinedIcon, color: 'warning' },
    { label: 'Approved', value: '11', sub: '↑ 37.5%', icon: CheckCircleOutlineIcon, color: 'success' },
    { label: 'Payment Released', value: '9', sub: '↑ 50.0%', icon: PaymentsOutlinedIcon, color: 'secondary' },
    { label: 'On Hold', value: '3', sub: '↓ 25.0%', icon: CancelOutlinedIcon, color: 'error' },
  ];

  const SIDE_TABS = [
    { key: 'general', label: 'General', icon: ListAltOutlinedIcon },
    { key: 'items', label: 'Items', icon: Inventory2OutlinedIcon },
    { key: 'tax', label: 'Tax & Charges', icon: RequestQuoteOutlinedIcon },
    { key: 'payment', label: 'Payment Details', icon: CreditCardOutlinedIcon },
    { key: 'documents', label: 'Documents', icon: FolderOutlinedIcon },
    { key: 'history', label: 'Status & History', icon: HistoryOutlinedIcon },
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<ReceiptLongOutlinedIcon />}
        title="Subcontract Bills"
        subtitle="Manage subcontractor invoices for processed components and services."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 2.5 }}>Filter Criteria</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="From Date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="To Date" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Subcontract Order No." placeholder="Search SCO..."
                value={scoNo} onChange={(e) => setScoNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                {VENDORS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Bill No." placeholder="Search Bill No..."
                value={billNo} onChange={(e) => setBillNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Bill Status" value={billStatus} onChange={(e) => setBillStatus(e.target.value)}>
                {BILL_STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center / Process" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Payment Status" value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
                {PAYMENT_STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Show" value={show} onChange={(e) => setShow(e.target.value)}>
                {SHOW_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button fullWidth variant="outlined" sx={{ height: 40 }}>Reset</Button>
              <Button fullWidth variant="contained" startIcon={<SearchIcon />} sx={{ height: 40 }}>Search</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {SUMMARY_TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Grid item xs={6} sm={4} md={2} key={t.label}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '50%', mx: 'auto', mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${t.color}.lighter`, color: `${t.color}.main` }}>
                    <Icon fontSize="small" />
                  </Box>
                  <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{t.value}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">{t.label}</Typography>
                  {t.sub && (
                    <Typography variant="caption" color={t.sub.startsWith('↓') ? 'error.main' : 'success.main'} fontWeight={600}>{t.sub}</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="primary.main">Subcontract Bills ({TOTAL_RECORDS} records)</Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" color="text.secondary">Records per page</Typography>
            <TextField
              select size="small" value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              sx={{ width: 80 }}
            >
              {[10, 25, 50].map((n) => <MenuItem key={n} value={n}>{n}</MenuItem>)}
            </TextField>
          </Stack>
        </Stack>

        <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 640px), 420px)">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={checked.size === BILLS.length} indeterminate={checked.size > 0 && checked.size < BILLS.length} onChange={toggleAll} />
                </TableCell>
                <TableCell>S.No</TableCell>
                <TableCell>Bill No.</TableCell>
                <TableCell>Bill Date</TableCell>
                <TableCell>SCO No.</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Work Center / Process</TableCell>
                <TableCell align="right">Bill Value (₹)</TableCell>
                <TableCell align="right">Tax Amount (₹)</TableCell>
                <TableCell align="right">Total Value (₹)</TableCell>
                <TableCell>Bill Status</TableCell>
                <TableCell>Payment Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {BILLS.map((b, idx) => (
                <TableRow key={b.no} hover selected={b.no === selected.no}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(b.no)} onChange={() => toggleRow(b.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{b.no}</Typography></TableCell>
                  <TableCell>{b.date}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{b.sco}</Typography></TableCell>
                  <TableCell>{b.vendor}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{b.process}</Typography></TableCell>
                  <TableCell align="right">{money(b.billValue)}</TableCell>
                  <TableCell align="right">{money(b.tax)}</TableCell>
                  <TableCell align="right">{money(b.total)}</TableCell>
                  <TableCell><Chip size="small" label={b.billStatus} color={BILL_STATUS_COLOR[b.billStatus] || 'default'} /></TableCell>
                  <TableCell><Chip size="small" label={b.paymentStatus} color={PAYMENT_STATUS_COLOR[b.paymentStatus] || 'default'} /></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                      <IconButton size="small"><EditOutlinedIcon fontSize="small" /></IconButton>
                      <IconButton size="small"><LocalPrintshopOutlinedIcon fontSize="small" /></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTableContainer>

        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ px: 3, py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing 1 to {BILLS.length} of {TOTAL_RECORDS} records
          </Typography>
          <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" size="small" />
        </Stack>
      </Card>

      <Card variant="outlined" sx={{ mt: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="primary.main">Bill Details - {selected.no}</Typography>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Button variant="outlined" size="small" startIcon={<LocalPrintshopOutlinedIcon />}>Print</Button>
            <Button variant="outlined" size="small" startIcon={<FactCheckOutlinedIcon />}>View SCO</Button>
            <Button variant="outlined" size="small" startIcon={<MoveToInboxOutlinedIcon />}>View Inward</Button>
            <Button variant="outlined" size="small" startIcon={<FolderOutlinedIcon />}>View Documents</Button>
          </Stack>
        </Stack>

        <Grid container>
          <Grid item xs={12} md={2.2} sx={{ borderRight: { md: '1px solid' }, borderColor: { md: 'divider' } }}>
            <List disablePadding>
              {SIDE_TABS.map((t) => {
                const Icon = t.icon;
                const active = t.key === selectedTab;
                return (
                  <ListItemButton
                    key={t.key}
                    selected={active}
                    onClick={() => setSelectedTab(t.key)}
                    sx={{ py: 1.25, px: 3, borderLeft: active ? '3px solid' : '3px solid transparent', borderLeftColor: active ? 'primary.main' : 'transparent' }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}><Icon fontSize="small" color={active ? 'primary' : 'inherit'} /></ListItemIcon>
                    <ListItemText primaryTypographyProps={{ variant: 'body2', fontWeight: active ? 700 : 500 }}>{t.label}</ListItemText>
                  </ListItemButton>
                );
              })}
            </List>
          </Grid>

          <Grid item xs={12} md={6.3} sx={{ borderRight: { md: '1px solid' }, borderColor: { md: 'divider' } }}>
            <CardContent>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Bill No." value={selected.no} InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Work Center / Process" value={selected.process} InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" type="date" label="Bill Date" value="2026-10-01" InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Invoice No." value="SBHT/INV/2026/125" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" label="Subcontract Order No." value={selected.sco}
                    InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" type="date" label="Invoice Date" value="2026-10-01" InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" label="Vendor Code" value="V-001"
                    InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" select label="Currency" value="INR">
                    {['INR', 'USD', 'EUR'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Vendor Name" value={selected.vendor} InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" multiline minRows={2} label="Remarks" defaultValue="As per subcontract order and received quantity." />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="GST No." value="33ABCDE1234F1Z5" />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" label="Bill Status" value={selected.billStatus} InputProps={{ readOnly: true }}
                    sx={{ '& .MuiInputBase-input': { color: 'success.dark', fontWeight: 600 } }}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Grid>

          <Grid item xs={12} md={3.5}>
            <CardContent>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <FunctionsOutlinedIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={700} color="primary.main">Bill Summary</Typography>
                  </Stack>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Sub Total (₹)</Typography>
                      <Typography variant="body2" fontWeight={600}>{money(selected.billValue)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">CGST 9%</Typography>
                      <Typography variant="body2" fontWeight={600}>{money(selected.tax / 2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">SGST 9%</Typography>
                      <Typography variant="body2" fontWeight={600}>{money(selected.tax / 2)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Total Tax (₹)</Typography>
                      <Typography variant="body2" fontWeight={600}>{money(selected.tax)}</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: 'success.lighter', borderRadius: 1, px: 1.5, py: 1.25, mt: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700}>Total Bill Value (₹)</Typography>
                      <Typography variant="subtitle1" fontWeight={700} color="success.dark">{money(selected.total)}</Typography>
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </CardContent>
          </Grid>
        </Grid>
      </Card>
    </Box>
  );
}
