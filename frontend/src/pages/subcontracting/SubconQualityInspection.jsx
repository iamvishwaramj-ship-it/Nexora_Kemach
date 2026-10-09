import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Pagination, List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality Inspection" under Subcontracting -- rebuilt to pixel-match the
// user-supplied reference screenshot. Static UI-only mock; no
// Subcontracting data model exists in this schema.
// ---------------------------------------------------------------------------

const VENDORS = ['All', 'Sri Balaji HT', 'Alpha Engineering', 'Metal Works', 'Shakti Coating', 'Precision Grinding'];
const INSPECTION_STATUS_OPTIONS = ['All', 'Accepted', 'Pending', 'Rejected'];
const INSPECTION_TYPE_OPTIONS = ['All', 'Incoming', 'In-Process', 'Final'];
const WORK_CENTERS = ['All', 'Heat Treatment', 'CNC Machining', 'Surface Coating', 'Casting', 'Grinding'];
const SHOW_OPTIONS = ['Summary & Details', 'Summary Only', 'Details Only'];

const STATUS_COLOR = { Accepted: 'success', Pending: 'warning', Rejected: 'error' };

const INSPECTIONS = [
  { no: 'QI-2026-001', date: '01-Oct-2026', sco: 'SCO-2026-001', vendor: 'Sri Balaji HT', itemCode: 'FG-1001', itemDesc: 'Gear Housing', received: 500, accepted: 480, rejected: 20, status: 'Accepted' },
  { no: 'QI-2026-002', date: '02-Oct-2026', sco: 'SCO-2026-002', vendor: 'Alpha Engineering', itemCode: 'FG-1002', itemDesc: 'Motor Bracket', received: 300, accepted: 300, rejected: 0, status: 'Accepted' },
  { no: 'QI-2026-003', date: '03-Oct-2026', sco: 'SCO-2026-003', vendor: 'Metal Works', itemCode: 'PM-1001', itemDesc: 'Pump Cover', received: 600, accepted: 560, rejected: 40, status: 'Rejected' },
  { no: 'QI-2026-004', date: '04-Oct-2026', sco: 'SCO-2026-004', vendor: 'Shakti Coating', itemCode: 'RM-2001', itemDesc: 'Cast Iron Housing', received: 400, accepted: 400, rejected: 0, status: 'Accepted' },
  { no: 'QI-2026-005', date: '06-Oct-2026', sco: 'SCO-2026-005', vendor: 'Precision Grinding', itemCode: 'FG-1003', itemDesc: 'Valve Body', received: 300, accepted: 270, rejected: 30, status: 'Pending' },
];

const TEST_RESULTS = [
  { no: 1, param: 'Overall Dimension', spec: '100 ± 0.2', measured: '99.98', result: 'OK', remarks: 'Within tolerance' },
  { no: 2, param: 'Hole Dia', spec: '25 ± 0.05', measured: '25.02', result: 'OK', remarks: '' },
  { no: 3, param: 'Surface Finish', spec: 'Ra 3.2', measured: '3.0', result: 'OK', remarks: '' },
  { no: 4, param: 'Hardness', spec: '58-60 HRC', measured: '59', result: 'OK', remarks: '' },
  { no: 5, param: 'Visual Inspection', spec: 'No Crack / Defect', measured: '-', result: 'OK', remarks: 'Good' },
];

const DOCUMENTS = [
  { name: 'InspectionReport_QI-2026-001.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
  { name: 'DimensionalReport.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
  { name: 'Photos.zip', type: 'ZIP', uploadedOn: '01-Oct-2026' },
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
      <Typography variant="body2" color="error.main" fontWeight={700}>Quality Inspection</Typography> */}
    </Stack>
  );
}

export default function SubconQualityInspection() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [scoNo, setScoNo] = useState('');
  const [vendor, setVendor] = useState('All');
  const [itemCode, setItemCode] = useState('');
  const [inspectionNo, setInspectionNo] = useState('');
  const [inspectionStatus, setInspectionStatus] = useState('All');
  const [inspectionType, setInspectionType] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [show, setShow] = useState('Summary & Details');

  const [checked, setChecked] = useState(() => new Set());
  const [resultChecked, setResultChecked] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedTab, setSelectedTab] = useState('general');
  const selected = INSPECTIONS[0];

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

  const toggleResult = (no) => {
    setResultChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/subcontracting/new-inspection')}>
          New Inspection
        </Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
        <Button variant="outlined" startIcon={<SettingsOutlinedIcon />}>Set As Default</Button>
      </Stack>
    </Stack>
  );

  const SUMMARY_TILES = [
    { label: 'Total Inspections', value: '28', sub: '↑ 21.7%', icon: DescriptionOutlinedIcon, color: 'primary' },
    { label: 'Accepted', value: '22', sub: '↑ 46.7%', icon: CheckCircleOutlineIcon, color: 'success' },
    { label: 'Pending', value: '4', sub: '↓ 33.3%', icon: AccessTimeOutlinedIcon, color: 'warning' },
    { label: 'Rejected', value: '2', sub: '↓ 50.0%', icon: CancelOutlinedIcon, color: 'error' },
    { label: 'Vendors', value: '8', sub: 'Active', icon: Inventory2OutlinedIcon, color: 'secondary' },
    { label: 'Items Inspected', value: '18', sub: '↑ 28.6%', icon: ViewInArOutlinedIcon, color: 'info' },
  ];

  const SIDE_TABS = [
    { key: 'general', label: 'General', icon: ListAltOutlinedIcon },
    { key: 'items', label: 'Item Details', icon: AssignmentOutlinedIcon },
    { key: 'criteria', label: 'Inspection Criteria', icon: FactCheckOutlinedIcon },
    { key: 'results', label: 'Inspection Results', icon: AssessmentOutlinedIcon },
    { key: 'documents', label: 'Documents', icon: FolderOutlinedIcon },
    { key: 'history', label: 'Status & History', icon: HistoryOutlinedIcon },
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<RuleOutlinedIcon />}
        title="Quality Inspection"
        subtitle="Inspect received components or semi-finished goods from subcontract vendors."
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
                fullWidth size="small" label="Inspection No." placeholder="Search QI..."
                value={inspectionNo} onChange={(e) => setInspectionNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Inspection Status" value={inspectionStatus} onChange={(e) => setInspectionStatus(e.target.value)}>
                {INSPECTION_STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Inspection Type" value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
                {INSPECTION_TYPE_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center / Process" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
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
          <Typography variant="subtitle1" fontWeight={700} color="primary.main">Quality Inspection ({TOTAL_RECORDS} records)</Typography>
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
                  <Checkbox size="small" checked={checked.size === INSPECTIONS.length} indeterminate={checked.size > 0 && checked.size < INSPECTIONS.length} onChange={toggleAll} />
                </TableCell>
                <TableCell>S.No</TableCell>
                <TableCell>Inspection No.</TableCell>
                <TableCell>Inspection Date</TableCell>
                <TableCell>SCO No.</TableCell>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell align="right">Qty Received</TableCell>
                <TableCell align="right">Qty Accepted</TableCell>
                <TableCell align="right">Qty Rejected</TableCell>
                <TableCell>Inspection Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {INSPECTIONS.map((i, idx) => (
                <TableRow key={i.no} hover selected={i.no === selected.no}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(i.no)} onChange={() => toggleRow(i.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.no}</Typography></TableCell>
                  <TableCell>{i.date}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.sco}</Typography></TableCell>
                  <TableCell>{i.vendor}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.itemCode}</Typography></TableCell>
                  <TableCell>{i.itemDesc}</TableCell>
                  <TableCell align="right">{money(i.received)}</TableCell>
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

        <Stack direction="row" alignItems="center" justifyContent="flex-end" sx={{ px: 3, py: 2 }}>
          <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" size="small" />
        </Stack>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
              <DescriptionOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700} color="primary.main">Inspection Details - {selected.no}</Typography>
            </Stack>

            <Grid container>
              <Grid item xs={4} sx={{ borderRight: '1px solid', borderColor: 'divider' }}>
                <List disablePadding>
                  {SIDE_TABS.map((t) => {
                    const Icon = t.icon;
                    const active = t.key === selectedTab;
                    return (
                      <ListItemButton
                        key={t.key}
                        selected={active}
                        onClick={() => setSelectedTab(t.key)}
                        sx={{ py: 1.1, px: 2, borderLeft: active ? '3px solid' : '3px solid transparent', borderLeftColor: active ? 'primary.main' : 'transparent' }}
                      >
                        <ListItemIcon sx={{ minWidth: 30 }}><Icon fontSize="small" color={active ? 'primary' : 'inherit'} /></ListItemIcon>
                        <ListItemText primaryTypographyProps={{ variant: 'caption', fontWeight: active ? 700 : 500 }}>{t.label}</ListItemText>
                      </ListItemButton>
                    );
                  })}
                </List>
              </Grid>

              <Grid item xs={8}>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <TextField fullWidth size="small" label="Inspection No." value={selected.no} InputProps={{ readOnly: true }} />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField fullWidth size="small" label="Qty Received" value={`${money(selected.received)} Nos`} InputProps={{ readOnly: true }} />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField fullWidth size="small" type="date" label="Inspection Date" value="2026-10-01" InputLabelProps={{ shrink: true }} />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField fullWidth size="small" label="Inspection Type" value="Incoming" />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth size="small" label="Subcontract Order No. *" value={selected.sco}
                        InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField fullWidth size="small" label="Inspector" value="Radhakrishnan"
                        InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                      />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField
                        fullWidth size="small" label="Vendor Code *" value="V-001"
                        InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} />
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Vendor Name" value={selected.vendor} InputProps={{ readOnly: true }} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Work Center / Process *" value="Heat Treatment" />
                    </Grid>
                    <Grid item xs={6}>
                      <TextField fullWidth size="small" label="Item Code *" value={selected.itemCode}
                        InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth size="small" label="Item Description" value={`${money(selected.received)} Housing`} InputProps={{ readOnly: true }} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth size="small" multiline minRows={2} label="Remarks" defaultValue="Inspection as per drawing spec." />
                    </Grid>
                  </Grid>
                </CardContent>
              </Grid>
            </Grid>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <FunctionsOutlinedIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">Inspection Results</Typography>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" size="small" startIcon={<AddIcon />}>Add Test</Button>
                  <Button variant="outlined" size="small" startIcon={<FileUploadOutlinedIcon />}>Import Result</Button>
                  <Button variant="outlined" size="small" color="error" startIcon={<DeleteOutlineIcon />}>Delete</Button>
                </Stack>
              </Stack>
              <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 760px), 280px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>S.No</TableCell>
                      <TableCell>Test Parameter</TableCell>
                      <TableCell>Specification</TableCell>
                      <TableCell>Measured Value</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {TEST_RESULTS.map((t) => (
                      <TableRow key={t.no} hover sx={{ bgcolor: 'success.lighter' }}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={resultChecked.has(t.no)} onChange={() => toggleResult(t.no)} />
                        </TableCell>
                        <TableCell>{t.no}</TableCell>
                        <TableCell>{t.param}</TableCell>
                        <TableCell>{t.spec}</TableCell>
                        <TableCell>{t.measured}</TableCell>
                        <TableCell><Chip size="small" label={t.result} color="success" /></TableCell>
                        <TableCell>{t.remarks}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={3}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Card variant="outlined">
              <CardContent>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">Documents</Typography>
                  <Button variant="outlined" size="small" startIcon={<FileUploadOutlinedIcon />}>Upload File</Button>
                </Stack>
                <Stack spacing={1}>
                  {DOCUMENTS.map((d) => (
                    <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                      <Typography variant="body2" color="primary.main" sx={{ wordBreak: 'break-word' }}>{d.name}</Typography>
                      <Stack direction="row" spacing={0.25}>
                        <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small"><DeleteOutlineIcon fontSize="small" color="error" /></IconButton>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </CardContent>
            </Card>

            <Card variant="outlined" sx={{ flexGrow: 1 }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <FunctionsOutlinedIcon fontSize="small" color="primary" />
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">Inspection Summary</Typography>
                </Stack>
                <Stack spacing={1}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Total Received Quantity</Typography>
                    <Typography variant="body2" fontWeight={600}>{money(selected.received)} Nos</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Accepted Quantity</Typography>
                    <Typography variant="body2" fontWeight={600}>{money(selected.accepted)} Nos</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Rejected Quantity</Typography>
                    <Typography variant="body2" fontWeight={600}>{money(selected.rejected)} Nos</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography variant="body2" color="text.secondary">Pending Quantity</Typography>
                    <Typography variant="body2" fontWeight={600}>0 Nos</Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: 'success.lighter', borderRadius: 1, px: 1.5, py: 1.25 }}>
                    <Typography variant="subtitle2" fontWeight={700}>Acceptance %</Typography>
                    <Typography variant="subtitle1" fontWeight={700} color="success.dark">{((selected.accepted / selected.received) * 100).toFixed(1)}%</Typography>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>
    </Box>
  );
}
