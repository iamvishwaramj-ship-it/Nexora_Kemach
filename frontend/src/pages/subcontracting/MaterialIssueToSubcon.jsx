import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Pagination, List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import UndoOutlinedIcon from '@mui/icons-material/UndoOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Material Issue to Subcon" under Subcontracting -- rebuilt to pixel-match
// the user-supplied reference screenshot. Static UI-only mock; no
// Subcontracting data model exists in this schema.
// ---------------------------------------------------------------------------

const VENDORS = ['All', 'Sri Balaji HT', 'Alpha Engineering', 'Metal Works', 'Shakti Coating', 'Precision Grinding'];
const STATUS_OPTIONS = ['All', 'Issued', 'Partially Returned', 'Completed'];
const WORK_CENTERS = ['All', 'Heat Treatment', 'CNC Machining', 'Surface Coating', 'Casting', 'Grinding'];
const ISSUED_BY_OPTIONS = ['All', 'Kannan P', 'Ramesh S', 'Vijay K'];
const SHOW_OPTIONS = ['Summary & Details', 'Summary Only', 'Details Only'];

const STATUS_COLOR = { Issued: 'success', 'Partially Returned': 'warning', Completed: 'info' };

const ISSUES = [
  { no: 'MIS-2026-001', date: '01-Oct-2026', sco: 'SCO-2026-001', vendor: 'Sri Balaji HT', po: 'PO-2026-001', itemCode: 'FG-1001', itemDesc: 'Gear Housing', qty: 500, uom: 'Nos', value: 125000, returnDue: '25-Oct-2026', status: 'Issued' },
  { no: 'MIS-2026-002', date: '02-Oct-2026', sco: 'SCO-2026-002', vendor: 'Alpha Engineering', po: 'PO-2026-002', itemCode: 'FG-1002', itemDesc: 'Motor Bracket', qty: 300, uom: 'Nos', value: 90000, returnDue: '28-Oct-2026', status: 'Issued' },
  { no: 'MIS-2026-003', date: '03-Oct-2026', sco: 'SCO-2026-003', vendor: 'Metal Works', po: 'PO-2026-003', itemCode: 'PM-1001', itemDesc: 'Pump Cover', qty: 600, uom: 'Nos', value: 168000, returnDue: '30-Oct-2026', status: 'Partially Returned' },
  { no: 'MIS-2026-004', date: '04-Oct-2026', sco: 'SCO-2026-004', vendor: 'Shakti Coating', po: 'PO-2026-004', itemCode: 'RM-2001', itemDesc: 'Cast Iron Housing', qty: 400, uom: 'Nos', value: 120000, returnDue: '29-Oct-2026', status: 'Issued' },
  { no: 'MIS-2026-005', date: '06-Oct-2026', sco: 'SCO-2026-005', vendor: 'Precision Grinding', po: 'PO-2026-005', itemCode: 'FG-1003', itemDesc: 'Valve Body', qty: 300, uom: 'Nos', value: 75000, returnDue: '02-Nov-2026', status: 'Completed' },
];

const TOTAL_RECORDS = 28;
const TOTAL_PAGES = 3;

function money(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Subcontracting</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>Material Issue to Subcon</Typography> */}
    </Stack>
  );
}

export default function MaterialIssueToSubcon() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [scoNo, setScoNo] = useState('');
  const [vendor, setVendor] = useState('All');
  const [itemCode, setItemCode] = useState('');
  const [poNo, setPoNo] = useState('');
  const [status, setStatus] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [issuedBy, setIssuedBy] = useState('All');
  const [show, setShow] = useState('Summary & Details');

  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedTab, setSelectedTab] = useState('general');
  const selected = ISSUES[0];

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const toggleAll = () => {
    setChecked((prev) => (prev.size === ISSUES.length ? new Set() : new Set(ISSUES.map((i) => i.no))));
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/subcontracting/new-issue')}>
          New Issue
        </Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
        <Button variant="outlined" startIcon={<SettingsOutlinedIcon />}>Set As Default</Button>
      </Stack>
    </Stack>
  );

  const SUMMARY_TILES = [
    { label: 'Total Issues', value: '28', sub: '', icon: DescriptionOutlinedIcon, color: 'primary' },
    { label: 'Total Quantity Issued (Nos)', value: '2,48,600', sub: '', icon: Inventory2Icon, color: 'success' },
    { label: 'Total Issue Value', value: '₹ 18,95,600', sub: '', icon: LocalShippingOutlinedIcon, color: 'warning' },
    { label: 'Vendors', value: '12', sub: 'Active', icon: Inventory2OutlinedIcon, color: 'secondary' },
    { label: 'Pending Return', value: '6', sub: '', icon: AccessTimeOutlinedIcon, color: 'error' },
    { label: 'Completed', value: '22', sub: '78.6%', icon: CheckCircleOutlineIcon, color: 'success' },
  ];

  const SIDE_TABS = [
    { key: 'general', label: 'General', icon: ListAltOutlinedIcon },
    { key: 'items', label: 'Items', icon: Inventory2OutlinedIcon },
    { key: 'documents', label: 'Documents', icon: FolderOutlinedIcon },
    { key: 'history', label: 'Status & History', icon: HistoryOutlinedIcon },
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<Inventory2OutlinedIcon />}
        title="Material Issue to Subcon"
        subtitle="Issue raw materials, components or semi-finished goods to subcontract vendor."
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
                fullWidth size="small" label="Item Code" placeholder="Search Item..."
                value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Production Order No." placeholder="Search PO..."
                value={poNo} onChange={(e) => setPoNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Issued By" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)}>
                {ISSUED_BY_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
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
                    <Typography variant="caption" color={t.color === 'error' ? 'error.main' : 'success.main'} fontWeight={600}>{t.sub}</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="primary.main">Material Issue to Subcon ({TOTAL_RECORDS} records)</Typography>
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
                  <Checkbox size="small" checked={checked.size === ISSUES.length} indeterminate={checked.size > 0 && checked.size < ISSUES.length} onChange={toggleAll} />
                </TableCell>
                <TableCell>S.No</TableCell>
                <TableCell>Issue No.</TableCell>
                <TableCell>Issue Date</TableCell>
                <TableCell>SCO No.</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Production Order No.</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell align="right">Qty Issued</TableCell>
                <TableCell>UOM</TableCell>
                <TableCell align="right">Issue Value (₹)</TableCell>
                <TableCell>Return Due Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ISSUES.map((i, idx) => (
                <TableRow key={i.no} hover selected={i.no === selected.no}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(i.no)} onChange={() => toggleRow(i.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.no}</Typography></TableCell>
                  <TableCell>{i.date}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.sco}</Typography></TableCell>
                  <TableCell>{i.vendor}</TableCell>
                  <TableCell>{i.po}</TableCell>
                  <TableCell>{i.itemCode}</TableCell>
                  <TableCell>{i.itemDesc}</TableCell>
                  <TableCell align="right">{money(i.qty)}</TableCell>
                  <TableCell>{i.uom}</TableCell>
                  <TableCell align="right">{money(i.value)}</TableCell>
                  <TableCell>{i.returnDue}</TableCell>
                  <TableCell><Chip size="small" label={i.status} color={STATUS_COLOR[i.status] || 'default'} /></TableCell>
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
            Showing 1 to {ISSUES.length} of {TOTAL_RECORDS} records
          </Typography>
          <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" size="small" />
        </Stack>
      </Card>

      <Card variant="outlined">
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <DescriptionOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">Issue Details - {selected.no}</Typography>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Chip size="small" label={selected.status} color={STATUS_COLOR[selected.status] || 'default'} sx={{ mr: 1 }} />
            <Button variant="outlined" size="small" startIcon={<LocalPrintshopOutlinedIcon />}>Print</Button>
            <Button variant="outlined" size="small" startIcon={<ContentCopyOutlinedIcon />}>Duplicate</Button>
            <Button variant="contained" size="small" color="warning" startIcon={<UndoOutlinedIcon />}>Return from Subcon</Button>
          </Stack>
        </Stack>

        <Grid container>
          <Grid item xs={12} md={2.5} sx={{ borderRight: { md: '1px solid' }, borderColor: { md: 'divider' } }}>
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

          <Grid item xs={12} md={9.5}>
            <CardContent>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth size="small" label="Issue No." value={selected.no} InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth size="small" type="date" label="Issue Date *" value="2026-10-01" InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth size="small" label="Subcontract Order No. *" value={selected.sco}
                    InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth size="small" label="Vendor Code *" value="V-001"
                    InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth size="small" label="Vendor Name" value={selected.vendor} InputProps={{ readOnly: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth size="small" label="Production Order No." value={selected.po}
                    InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth size="small" label="Work Center / Process" value="Heat Treatment" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth size="small" label="Department" value="Production" />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth size="small" label="Reference No." placeholder="e.g., Gate Pass No." />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth size="small" label="Issued By" value="Kannan P"
                    InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField fullWidth size="small" type="date" label="Expected Return Date" value="2026-10-25" InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12} sm={6} md={6}>
                  <TextField fullWidth size="small" multiline minRows={2} label="Remarks" defaultValue="Issue for heat treatment as per process sheet." />
                </Grid>
              </Grid>
            </CardContent>
          </Grid>
        </Grid>

        <Grid container sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
          <Grid item xs={12} md={2.5} />
          <Grid item xs={12} md={9.5}>
            <CardContent>
              <Card variant="outlined" sx={{ maxWidth: 320, ml: 'auto' }}>
                <CardContent>
                  <Typography variant="subtitle2" fontWeight={700} color="primary.main" sx={{ mb: 1.5 }}>Issue Summary</Typography>
                  <Stack spacing={1}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Total Items</Typography>
                      <Typography variant="body2" fontWeight={600}>3</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Total Quantity</Typography>
                      <Typography variant="body2" fontWeight={600}>500 Nos</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2" color="text.secondary">Total Issue Value</Typography>
                      <Typography variant="body2" fontWeight={700} color="success.main">₹ 1,25,000.00</Typography>
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
