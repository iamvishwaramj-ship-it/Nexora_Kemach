import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Pagination, List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import CheckIcon from '@mui/icons-material/Check';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import AssignmentTurnedInOutlinedIcon from '@mui/icons-material/AssignmentTurnedInOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > Incoming Inspection" -- rebuilt to match the user-supplied
// reference screenshot exactly (filter card, summary tiles, inspection
// list, Inspection Details tabbed panel). Static UI-only mock; no Quality
// data model exists in this schema.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total Inspections', value: '28', sub: '↑ 27%', sub2: 'vs Previous Period', icon: ArticleOutlinedIcon, color: 'primary' },
  { label: 'Accepted', value: '20', sub: '↑ 71.4%', icon: CheckCircleOutlineIcon, color: 'success' },
  { label: 'Pending', value: '4', sub: '↑ 14.3%', icon: AccessTimeOutlinedIcon, color: 'warning' },
  { label: 'Rejected', value: '3', sub: '↑ 10.7%', icon: CancelOutlinedIcon, color: 'error' },
  { label: 'Rework', value: '1', sub: '↑ 3.6%', icon: AutorenewOutlinedIcon, color: 'secondary' },
];

const INSPECTIONS = [
  { no: 'IQ-2026-001', date: '01-Oct-2026', orderNo: 'PO-2026-001', vendor: 'V-001', itemCode: 'FG-1001', itemDesc: 'Gear Housing', lotNo: 'BCH-001', received: 500, inspected: 500, accepted: 500, rejected: 0, status: 'Accepted' },
  { no: 'IQ-2026-002', date: '02-Oct-2026', orderNo: 'PO-2026-002', vendor: 'V-002', itemCode: 'FG-1002', itemDesc: 'Motor Bracket', lotNo: 'LOT-001', received: 300, inspected: 300, accepted: 280, rejected: 20, status: 'Rejected' },
  { no: 'IQ-2026-003', date: '03-Oct-2026', orderNo: 'PO-2026-003', vendor: 'V-001', itemCode: 'RM-2001', itemDesc: 'Cast Iron Housing', lotNo: 'BCH-002', received: 400, inspected: 400, accepted: 400, rejected: 0, status: 'Accepted' },
  { no: 'IQ-2026-004', date: '04-Oct-2026', orderNo: 'PO-2026-004', vendor: 'V-003', itemCode: 'PM-1001', itemDesc: 'Pump Cover', lotNo: 'LOT-003', received: 600, inspected: 200, accepted: 200, rejected: 0, status: 'Pending' },
  { no: 'IQ-2026-005', date: '06-Oct-2026', orderNo: 'PO-2026-005', vendor: 'V-002', itemCode: 'FG-1003', itemDesc: 'Valve Body', lotNo: 'BCH-004', received: 200, inspected: 200, accepted: 180, rejected: 20, status: 'Rework' },
];

const STATUS_COLOR = { Accepted: 'success', Rejected: 'error', Pending: 'warning', Rework: 'secondary' };

const TOTAL_RECORDS = 28;
const TOTAL_PAGES = 3;

const DETAIL_TABS = [
  { key: 'general', label: 'General', icon: ListAltOutlinedIcon },
  { key: 'items', label: 'Inspection Items', icon: RuleOutlinedIcon },
  { key: 'results', label: 'Inspection Results', icon: AssignmentTurnedInOutlinedIcon },
  { key: 'attachments', label: 'Attachments', icon: AttachFileOutlinedIcon },
  { key: 'notes', label: 'Notes', icon: NotesOutlinedIcon },
  { key: 'history', label: 'History', icon: HistoryOutlinedIcon },
];

function money(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Quality</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>Incoming Inspection</Typography> */}
    </Stack>
  );
}

export default function IncomingInspection() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [orderType, setOrderType] = useState('Purchase');
  const [vendor, setVendor] = useState('All');
  const [itemCode, setItemCode] = useState('');
  const [inspectionNo, setInspectionNo] = useState('');
  const [status, setStatus] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [inspectionType, setInspectionType] = useState('All');
  const [lotNo, setLotNo] = useState('');
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [activeTab, setActiveTab] = useState('general');

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const toggleAll = () => {
    setChecked((prev) => (prev.size === INSPECTIONS.length ? new Set() : new Set(INSPECTIONS.map((i) => i.no))));
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/quality/new-inspection')}>
          New Inspection
        </Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
        <Button variant="outlined" startIcon={<BookmarkBorderOutlinedIcon />}>Set As Default</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<FactCheckOutlinedIcon />}
        title="Incoming Inspection"
        subtitle="Manage and record inspection for purchased and subcontract received materials."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
            <FilterAltOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">Filter Criteria</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="From Date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="To Date" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Order Type" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                {['Purchase', 'Subcontract'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Vendor" placeholder="Search Vendor..." value={vendor} onChange={(e) => setVendor(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
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
                fullWidth size="small" label="Inspection No." placeholder="Search Inspection No..."
                value={inspectionNo} onChange={(e) => setInspectionNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {['All', 'Accepted', 'Pending', 'Rejected', 'Rework'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center / Process" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {['All', 'Heat Treatment', 'CNC Machining', 'Surface Coating'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Inspection Type" value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
                {['All', 'Incoming', 'In-process', 'Final'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Lot / Batch No." placeholder="Search Lot No..."
                value={lotNo} onChange={(e) => setLotNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button variant="contained" startIcon={<SearchIcon />} sx={{ height: 40 }}>Search</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {SUMMARY_TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Grid item xs={6} sm={4} md={2.4} key={t.label}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '50%', mx: 'auto', mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${t.color}.lighter`, color: `${t.color}.main` }}>
                    <Icon fontSize="small" />
                  </Box>
                  <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{t.value}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">{t.label}</Typography>
                  <Typography variant="caption" color="success.main" fontWeight={600} display="block">{t.sub}</Typography>
                  {t.sub2 && <Typography variant="caption" color="text.disabled">{t.sub2}</Typography>}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="primary.main">Incoming Inspection List ({TOTAL_RECORDS} records)</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">Records per page</Typography>
            <TextField size="small" select value={recordsPerPage} onChange={(e) => setRecordsPerPage(e.target.value)} sx={{ width: 90 }}>
              {[10, 25, 50].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
            </TextField>
          </Stack>
        </Stack>

        <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 540px), 460px)">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox">
                  <Checkbox size="small" checked={checked.size === INSPECTIONS.length} indeterminate={checked.size > 0 && checked.size < INSPECTIONS.length} onChange={toggleAll} />
                </TableCell>
                <TableCell>S.No</TableCell>
                <TableCell>Inspection No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Order No.</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell>Lot / Batch No.</TableCell>
                <TableCell align="right">Qty Received</TableCell>
                <TableCell align="right">Qty Inspected</TableCell>
                <TableCell align="right">Accepted</TableCell>
                <TableCell align="right">Rejected</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {INSPECTIONS.map((i, idx) => (
                <TableRow key={i.no} hover selected={i.no === 'IQ-2026-001'}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(i.no)} onChange={() => toggleRow(i.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.no}</Typography></TableCell>
                  <TableCell>{i.date}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.orderNo}</Typography></TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.vendor}</Typography></TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.itemCode}</Typography></TableCell>
                  <TableCell>{i.itemDesc}</TableCell>
                  <TableCell>{i.lotNo}</TableCell>
                  <TableCell align="right">{money(i.received)}</TableCell>
                  <TableCell align="right">{money(i.inspected)}</TableCell>
                  <TableCell align="right">{money(i.accepted)}</TableCell>
                  <TableCell align="right">{money(i.rejected)}</TableCell>
                  <TableCell><Chip size="small" label={i.status} color={STATUS_COLOR[i.status] || 'default'} /></TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                      <IconButton size="small"><EditOutlinedIcon fontSize="small" /></IconButton>
                      <IconButton size="small"><LocalPrintshopOutlinedIcon fontSize="small" /></IconButton>
                      <IconButton size="small"><DeleteOutlineIcon fontSize="small" color="error" /></IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTableContainer>

        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ px: 3, py: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Showing 1 to {INSPECTIONS.length} of {TOTAL_RECORDS} records
          </Typography>
          <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" size="small" />
        </Stack>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">Inspection Details - IQ-2026-001</Typography>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button variant="contained" color="success" startIcon={<CheckIcon />}>Approve</Button>
              <Button variant="contained" color="error" startIcon={<RemoveCircleOutlineIcon />}>Reject</Button>
              <Button variant="contained" color="warning" startIcon={<PauseCircleOutlineIcon />}>Put On Hold</Button>
              <Button variant="contained" startIcon={<LocalPrintshopOutlinedIcon />}>Print Report</Button>
            </Stack>
          </Stack>

          <Grid container spacing={2}>
            <Grid item xs={12} sm={2.4}>
              <List disablePadding sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                {DETAIL_TABS.map((t) => {
                  const Icon = t.icon;
                  const active = activeTab === t.key;
                  return (
                    <ListItemButton
                      key={t.key} selected={active} onClick={() => setActiveTab(t.key)}
                      sx={{ py: 1.1, ...(active && { bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.main' } }) }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, color: active ? 'inherit' : undefined }}><Icon fontSize="small" /></ListItemIcon>
                      <ListItemText primaryTypographyProps={{ variant: 'body2', fontWeight: active ? 700 : 500 }}>{t.label}</ListItemText>
                    </ListItemButton>
                  );
                })}
              </List>
            </Grid>

            <Grid item xs={12} sm={9.6}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Stack spacing={2}>
                    <TextField fullWidth size="small" label="Inspection No." value="IQ-2026-001" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" type="date" label="Inspection Date" value="2026-10-01" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" label="Order No." value="PO-2026-001"
                      InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" label="Vendor Code" value="V-001"
                      InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Vendor Name" value="Sri Balaji Heat Treatment" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Work Center / Process" value="Heat Treatment" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Inspection Type" value="Incoming" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Reference No." placeholder="" />
                  </Stack>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth size="small" label="Item Code" value="FG-1001"
                      InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Item Description" value="Gear Housing" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Drawing No." value="DR-1001" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Revision" value="01" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Lot / Batch No." value="BCH-001" InputProps={{ readOnly: true }} />
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth size="small" type="number" label="Qty Received" defaultValue={500} />
                      <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                        {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth size="small" type="number" label="Qty to Inspect" defaultValue={500} />
                      <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                        {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
                    </Stack>
                    <TextField fullWidth size="small" select label="Sampling Plan" defaultValue="AQL 1.0 (n=20, Ac=0, Re=1)">
                      {['AQL 1.0 (n=20, Ac=0, Re=1)', 'AQL 2.5 (n=32, Ac=1, Re=2)', '100% Inspection'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" select label="Inspection Level" defaultValue="Normal">
                      {['Reduced', 'Normal', 'Tightened'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                  </Stack>
                </Grid>

                <Grid item xs={12} sm={4}>
                  <Stack spacing={2}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Inspection Status</Typography>
                      <Chip label="Accepted" color="success" />
                    </Box>
                    <TextField
                      fullWidth size="small" label="Inspected By" value="Kannan P"
                      InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" label="Approval By" value="Radhakrishnan"
                      InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" type="date" label="Approval Date" value="2026-10-01" InputLabelProps={{ shrink: true }} />
                    <TextField fullWidth size="small" multiline minRows={4} label="Remarks" defaultValue="All characteristics are within specification." />
                  </Stack>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
