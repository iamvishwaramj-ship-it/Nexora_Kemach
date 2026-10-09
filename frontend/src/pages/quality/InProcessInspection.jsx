import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Pagination, List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip,
} from 'recharts';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import PauseCircleOutlineIcon from '@mui/icons-material/PauseCircleOutline';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import StraightenOutlinedIcon from '@mui/icons-material/StraightenOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > In-Process Inspection" -- rebuilt to match the user-supplied
// reference screenshot exactly (filter card, summary tiles, inspection
// list, In-Process Inspection Details tabbed panel with summary + defect
// donut). Static UI-only mock; no Quality data model exists in this schema.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total Inspections', value: '36', sub: '↑ 20%', sub2: 'vs Previous Period', icon: ArticleOutlinedIcon, color: 'primary' },
  { label: 'Accepted', value: '28', sub: '77.8%', icon: CheckCircleOutlineIcon, color: 'success' },
  { label: 'Rejected', value: '5', sub: '13.9%', icon: CancelOutlinedIcon, color: 'error' },
  { label: 'Pending', value: '3', sub: '8.3%', icon: AccessTimeOutlinedIcon, color: 'warning' },
  { label: 'Rework', value: '2', sub: '5.6%', icon: AutorenewOutlinedIcon, color: 'secondary' },
];

const INSPECTIONS = [
  { no: 'IPR-2026-001', date: '01-Oct-2026', poNo: 'PO-2026-001', itemCode: 'FG-1001', itemDesc: 'Gear Housing', opNo: 'OP-10', workCenter: 'MILL-01', lotNo: 'BCH-001', inspected: 200, accepted: 200, rejected: 0, status: 'Accepted' },
  { no: 'IPR-2026-002', date: '02-Oct-2026', poNo: 'PO-2026-001', itemCode: 'FG-1001', itemDesc: 'Gear Housing', opNo: 'OP-20', workCenter: 'DRILL-01', lotNo: 'BCH-001', inspected: 200, accepted: 180, rejected: 20, status: 'Rejected' },
  { no: 'IPR-2026-003', date: '03-Oct-2026', poNo: 'PO-2026-002', itemCode: 'RM-2001', itemDesc: 'Motor Bracket', opNo: 'OP-10', workCenter: 'CUT-01', lotNo: 'LOT-001', inspected: 300, accepted: 300, rejected: 0, status: 'Accepted' },
  { no: 'IPR-2026-004', date: '04-Oct-2026', poNo: 'PO-2026-002', itemCode: 'RM-2001', itemDesc: 'Motor Bracket', opNo: 'OP-20', workCenter: 'WELD-01', lotNo: 'LOT-001', inspected: 300, accepted: 270, rejected: 30, status: 'Rework' },
  { no: 'IPR-2026-005', date: '06-Oct-2026', poNo: 'PO-2026-003', itemCode: 'PM-1001', itemDesc: 'Pump Cover', opNo: 'OP-30', workCenter: 'MACH-02', lotNo: 'BCH-002', inspected: 150, accepted: 140, rejected: 10, status: 'Pending' },
];

const STATUS_COLOR = { Accepted: 'success', Rejected: 'error', Rework: 'secondary', Pending: 'warning' };

const TOTAL_RECORDS = 36;
const TOTAL_PAGES = 4;

const DETAIL_TABS = [
  { key: 'general', label: 'General', icon: ListAltOutlinedIcon },
  { key: 'items', label: 'Inspection Items', icon: RuleOutlinedIcon },
  { key: 'measurements', label: 'Measurement Results', icon: StraightenOutlinedIcon },
  { key: 'defects', label: 'Defects', icon: ReportProblemOutlinedIcon },
  { key: 'attachments', label: 'Attachments', icon: AttachFileOutlinedIcon },
  { key: 'notes', label: 'Notes', icon: NotesOutlinedIcon },
  { key: 'history', label: 'History', icon: HistoryOutlinedIcon },
];

const DEFECT_CATEGORY = [
  { name: 'Dimensional', value: 40, color: '#ef4444' },
  { name: 'Surface Finish', value: 30, color: '#2563eb' },
  { name: 'Material', value: 20, color: '#f59e0b' },
  { name: 'Others', value: 10, color: '#9333ea' },
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
      <Typography variant="body2" color="primary.main">In-Process Inspection</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>Dashboard</Typography> */}
    </Stack>
  );
}

export default function InProcessInspection() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [productionOrder, setProductionOrder] = useState('');
  const [workCenter, setWorkCenter] = useState('All');
  const [operation, setOperation] = useState('All');
  const [itemCode, setItemCode] = useState('');
  const [lotNo, setLotNo] = useState('');
  const [inspectionStage, setInspectionStage] = useState('All');
  const [status, setStatus] = useState('All');
  const [inspector, setInspector] = useState('All');
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
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/quality/new-in-process-inspection')}>
          New In-Process Inspection
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
        icon={<SettingsOutlinedIcon />}
        title="In-Process Inspection"
        subtitle="Manage and record in-process inspection at different manufacturing stages."
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
              <TextField
                fullWidth size="small" label="Production Order" placeholder="Search PO No..."
                value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {['All', 'MILL-01', 'DRILL-01', 'CUT-01', 'WELD-01', 'MACH-02'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Operation" value={operation} onChange={(e) => setOperation(e.target.value)}>
                {['All', 'OP-10', 'OP-20', 'OP-30'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
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
                fullWidth size="small" label="Batch / Lot No." placeholder="Search Lot No..."
                value={lotNo} onChange={(e) => setLotNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Inspection Stage" value={inspectionStage} onChange={(e) => setInspectionStage(e.target.value)}>
                {['All', 'In-process', 'Final'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {['All', 'Accepted', 'Rejected', 'Pending', 'Rework'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Inspector" value={inspector} onChange={(e) => setInspector(e.target.value)}>
                {['All', 'Kannan P', 'Radhakrishnan', 'Senthil Kumar'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1.5 }}>
              <Button variant="outlined" sx={{ height: 40 }}>Reset</Button>
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
          <Typography variant="subtitle1" fontWeight={700} color="primary.main">In-Process Inspection List ({TOTAL_RECORDS} records)</Typography>
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
                <TableCell>Production Order</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell>Operation No.</TableCell>
                <TableCell>Work Center</TableCell>
                <TableCell>Batch / Lot No.</TableCell>
                <TableCell align="right">Qty Inspected</TableCell>
                <TableCell align="right">Accepted</TableCell>
                <TableCell align="right">Rejected</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {INSPECTIONS.map((i, idx) => (
                <TableRow key={i.no} hover selected={i.no === 'IPR-2026-002'}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(i.no)} onChange={() => toggleRow(i.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.no}</Typography></TableCell>
                  <TableCell>{i.date}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.poNo}</Typography></TableCell>
                  <TableCell>{i.itemCode}</TableCell>
                  <TableCell>{i.itemDesc}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.opNo}</Typography></TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.workCenter}</Typography></TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.lotNo}</Typography></TableCell>
                  <TableCell align="right">{money(i.inspected)}</TableCell>
                  <TableCell align="right">{money(i.accepted)}</TableCell>
                  <TableCell align="right">{money(i.rejected)}</TableCell>
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
            Showing 1 to {INSPECTIONS.length} of {TOTAL_RECORDS} records
          </Typography>
          <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" size="small" />
        </Stack>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">In-Process Inspection Details - IPR-2026-002</Typography>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button variant="contained" color="success" startIcon={<CheckIcon />}>Accept</Button>
              <Button variant="contained" color="error" startIcon={<CloseIcon />}>Reject</Button>
              <Button variant="contained" color="warning" startIcon={<PauseCircleOutlineIcon />}>Put On Hold</Button>
              <Button variant="contained" color="secondary" startIcon={<RefreshOutlinedIcon />}>Rework</Button>
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

            <Grid item xs={12} sm={5.6}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Stack spacing={2}>
                    <TextField fullWidth size="small" label="Inspection No." value="IPR-2026-002" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" type="date" label="Inspection Date" value="2026-10-02" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
                    <TextField
                      fullWidth size="small" label="Production Order" value="PO-2026-001"
                      InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" label="Item Code" value="FG-1001"
                      InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" label="Item Description" value="Gear Housing" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Operation No." value="OP-20" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Work Center" value="DRILL-01" InputProps={{ readOnly: true }} />
                    <TextField fullWidth size="small" label="Batch / Lot No." value="BCH-001" InputProps={{ readOnly: true }} />
                  </Stack>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth size="small" type="number" label="Qty to Inspect" defaultValue={200} />
                      <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                        {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth size="small" type="number" label="Qty Inspected" defaultValue={200} />
                      <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                        {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth size="small" type="number" label="Accepted Qty" defaultValue={180} />
                      <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                        {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
                    </Stack>
                    <Stack direction="row" spacing={1}>
                      <TextField fullWidth size="small" type="number" label="Rejected Qty" defaultValue={20} />
                      <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                        {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
                    </Stack>
                    <TextField fullWidth size="small" select label="Inspection Stage" defaultValue="In-process">
                      {['In-process', 'Final'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" label="Inspection By" value="Kannan P"
                      InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" select label="Status" defaultValue="Rejected" sx={{ '& .MuiInputBase-root': { color: 'error.main', fontWeight: 600 } }}>
                      {['Accepted', 'Rejected', 'Pending', 'Rework'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" multiline minRows={3} label="Remarks" defaultValue="Hole diameter out of tolerance." />
                  </Stack>
                </Grid>
              </Grid>
            </Grid>

            <Grid item xs={12} sm={4}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                    <AssessmentOutlinedIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={700} color="primary.main">Inspection Summary</Typography>
                  </Stack>
                  <Stack spacing={1.25} sx={{ mb: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Total Characteristics</Typography>
                      <Typography variant="body2" fontWeight={700}>5</Typography>
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Accepted</Typography>
                      <Chip size="small" label="3" color="success" />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Rejected</Typography>
                      <Chip size="small" label="1" color="error" />
                    </Stack>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="body2" color="text.secondary">Pending</Typography>
                      <Chip size="small" label="1" color="warning" />
                    </Stack>
                  </Stack>

                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
                    <PieChartOutlineOutlinedIcon fontSize="small" color="primary" />
                    <Typography variant="subtitle2" fontWeight={700} color="primary.main">Defect Category</Typography>
                  </Stack>
                  <Box sx={{ height: 160, position: 'relative' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={DEFECT_CATEGORY} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2}>
                          {DEFECT_CATEGORY.map((d) => <Cell key={d.name} fill={d.color} />)}
                        </Pie>
                        <RTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                      <Typography variant="subtitle1" fontWeight={700}>20</Typography>
                      <Typography variant="caption" color="text.secondary">Total Defects</Typography>
                    </Box>
                  </Box>
                  <Stack spacing={0.5} sx={{ mt: 1 }}>
                    {DEFECT_CATEGORY.map((d) => (
                      <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                        <Stack direction="row" alignItems="center" spacing={0.75}>
                          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                          <Typography variant="caption" color="text.secondary">{d.name}</Typography>
                        </Stack>
                        <Typography variant="caption" fontWeight={600}>{d.value}%</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
