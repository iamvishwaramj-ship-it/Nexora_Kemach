import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Pagination, Divider, List, ListItemButton, ListItemIcon, ListItemText,
} from '@mui/material';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import BookmarkBorderOutlinedIcon from '@mui/icons-material/BookmarkBorderOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > Inspection Planning" -- rebuilt to match the user-supplied
// reference screenshot exactly (filter card, summary tiles, plans table,
// Plan Details tabbed panel, Planned Inspection Items table). Static
// UI-only mock; no Quality data model exists in this schema.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total Plans', value: '28', sub: '↑ 21%', icon: ArticleOutlinedIcon, color: 'primary' },
  { label: 'Planned', value: '16', sub: '↑ 14%', icon: CheckCircleOutlineIcon, color: 'success' },
  { label: 'In Progress', value: '6', sub: '↑ 20%', icon: AccessTimeOutlinedIcon, color: 'warning' },
  { label: 'Overdue', value: '3', sub: '↑ 50%', icon: CancelOutlinedIcon, color: 'error' },
  { label: 'Completed', value: '3', sub: '↑ 25%', icon: TaskAltOutlinedIcon, color: 'secondary' },
];

const PLANS = [
  { no: 'IP-2026-001', date: '01-Oct-2026', type: 'Incoming', orderType: 'Purchase', orderNo: 'PO-2026-001', itemCode: 'RM-2001', itemDesc: 'Cast Iron Housing', lotNo: 'BCH-001', plannedDate: '01-Oct-2026', status: 'Planned' },
  { no: 'IP-2026-002', date: '01-Oct-2026', type: 'In-process', orderType: 'Production', orderNo: 'SCO-2026-001', itemCode: 'FG-1001', itemDesc: 'Gear Housing', lotNo: 'LOT-001', plannedDate: '02-Oct-2026', status: 'In Progress' },
  { no: 'IP-2026-003', date: '02-Oct-2026', type: 'Final', orderType: 'Production', orderNo: 'SCO-2026-001', itemCode: 'FG-1001', itemDesc: 'Gear Housing', lotNo: 'LOT-001', plannedDate: '02-Oct-2026', status: 'Planned' },
  { no: 'IP-2026-004', date: '03-Oct-2026', type: 'Incoming', orderType: 'Purchase', orderNo: 'PO-2026-002', itemCode: 'RM-2002', itemDesc: 'Motor Bracket', lotNo: 'BCH-002', plannedDate: '03-Oct-2026', status: 'Completed' },
  { no: 'IP-2026-005', date: '03-Oct-2026', type: 'In-process', orderType: 'Subcontract', orderNo: 'SCO-2026-002', itemCode: 'PM-1001', itemDesc: 'Pump Cover', lotNo: 'LOT-003', plannedDate: '04-Oct-2026', status: 'Overdue' },
  { no: 'IP-2026-006', date: '04-Oct-2026', type: 'Final', orderType: 'Production', orderNo: 'SCO-2026-002', itemCode: 'PM-1001', itemDesc: 'Pump Cover', lotNo: 'LOT-003', plannedDate: '04-Oct-2026', status: 'Planned' },
  { no: 'IP-2026-007', date: '05-Oct-2026', type: 'Incoming', orderType: 'Purchase', orderNo: 'PO-2026-003', itemCode: 'RM-2003', itemDesc: 'Valve Body', lotNo: 'BCH-003', plannedDate: '05-Oct-2026', status: 'In Progress' },
  { no: 'IP-2026-008', date: '06-Oct-2026', type: 'In-process', orderType: 'Production', orderNo: 'SCO-2026-003', itemCode: 'FG-1002', itemDesc: 'Motor Bracket', lotNo: 'LOT-005', plannedDate: '06-Oct-2026', status: 'Planned' },
  { no: 'IP-2026-009', date: '07-Oct-2026', type: 'Final', orderType: 'Production', orderNo: 'SCO-2026-003', itemCode: 'FG-1002', itemDesc: 'Motor Bracket', lotNo: 'LOT-005', plannedDate: '07-Oct-2026', status: 'Planned' },
  { no: 'IP-2026-010', date: '08-Oct-2026', type: 'Incoming', orderType: 'Purchase', orderNo: 'PO-2026-004', itemCode: 'RM-2003', itemDesc: 'Valve Body', lotNo: 'BCH-004', plannedDate: '08-Oct-2026', status: 'Completed' },
];

const STATUS_COLOR = { Planned: 'info', 'In Progress': 'warning', Overdue: 'error', Completed: 'success' };

const PLAN_ITEMS = [
  { no: 1, characteristic: 'Dimension (Length)', spec: '100.0 ± 0.5 mm', method: 'Vernier Caliper', sampling: 'AQL 1.0' },
  { no: 2, characteristic: 'Dimension (Width)', spec: '80.0 ± 0.5 mm', method: 'Vernier Caliper', sampling: 'AQL 1.0' },
  { no: 3, characteristic: 'Surface Finish', spec: 'Ra ≤ 3.2', method: 'Visual / Roughness', sampling: 'AQL 1.5' },
  { no: 4, characteristic: 'Material Grade', spec: 'FG 260', method: 'Spectrometer', sampling: 'AQL 2.5' },
];

const TOTAL_RECORDS = 28;
const TOTAL_PAGES = 3;

const DETAIL_TABS = [
  { key: 'general', label: 'General', icon: ListAltOutlinedIcon },
  { key: 'quality-plan', label: 'Quality Plan', icon: SettingsOutlinedIcon },
  { key: 'items', label: 'Items', icon: RuleOutlinedIcon },
  { key: 'criteria', label: 'Inspection Criteria', icon: AssignmentOutlinedIcon },
  { key: 'documents', label: 'Documents', icon: DescriptionOutlinedIcon },
  { key: 'notes', label: 'Notes', icon: NotesOutlinedIcon },
];

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Quality</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>Inspection Planning</Typography> */}
    </Stack>
  );
}

export default function InspectionPlanning() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [inspectionType, setInspectionType] = useState('All');
  const [itemCode, setItemCode] = useState('');
  const [workCenter, setWorkCenter] = useState('All');
  const [orderType, setOrderType] = useState('All');
  const [orderNo, setOrderNo] = useState('');
  const [status, setStatus] = useState('All');
  const [plannedBy, setPlannedBy] = useState('All');
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
    setChecked((prev) => (prev.size === PLANS.length ? new Set() : new Set(PLANS.map((p) => p.no))));
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/quality/new-plan')}>
          New Plan
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
        icon={<AssignmentOutlinedIcon />}
        title="Inspection Planning"
        subtitle="Plan inspections for incoming, in-process and final inspections based on quality plans, item master and orders."
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
              <TextField fullWidth size="small" select label="Inspection Type" value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
                {['All', 'Incoming', 'In-process', 'Final'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
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
              <TextField fullWidth size="small" select label="Work Center / Process" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {['All', 'CNC Machining', 'Heat Treatment', 'Assembly', 'Surface Coating'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Order Type" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                {['All', 'Purchase', 'Production', 'Subcontract'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Order No." placeholder="Search Order No..."
                value={orderNo} onChange={(e) => setOrderNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {['All', 'Planned', 'In Progress', 'Overdue', 'Completed'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Planned By" value={plannedBy} onChange={(e) => setPlannedBy(e.target.value)}>
                {['All', 'Kannan P', 'Radhakrishnan', 'Senthil Kumar'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
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
            <Grid item xs={6} sm={4} md={2.4} key={t.label}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ textAlign: 'center', py: 2.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '50%', mx: 'auto', mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${t.color}.lighter`, color: `${t.color}.main` }}>
                    <Icon fontSize="small" />
                  </Box>
                  <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{t.value}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">{t.label}</Typography>
                  <Typography variant="caption" color="success.main" fontWeight={600}>{t.sub}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined" sx={{ mb: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="primary.main">Inspection Plans ({TOTAL_RECORDS} records)</Typography>
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
                  <Checkbox size="small" checked={checked.size === PLANS.length} indeterminate={checked.size > 0 && checked.size < PLANS.length} onChange={toggleAll} />
                </TableCell>
                <TableCell>S.No</TableCell>
                <TableCell>Plan No.</TableCell>
                <TableCell>Plan Date</TableCell>
                <TableCell>Inspection Type</TableCell>
                <TableCell>Order Type</TableCell>
                <TableCell>Order No.</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell>Lot / Batch No.</TableCell>
                <TableCell>Planned Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {PLANS.map((p, idx) => (
                <TableRow key={p.no} hover selected={p.no === 'IP-2026-001'}>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(p.no)} onChange={() => toggleRow(p.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{p.no}</Typography></TableCell>
                  <TableCell>{p.date}</TableCell>
                  <TableCell>{p.type}</TableCell>
                  <TableCell>{p.orderType}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{p.orderNo}</Typography></TableCell>
                  <TableCell>{p.itemCode}</TableCell>
                  <TableCell>{p.itemDesc}</TableCell>
                  <TableCell>{p.lotNo}</TableCell>
                  <TableCell>{p.plannedDate}</TableCell>
                  <TableCell><Chip size="small" label={p.status} color={STATUS_COLOR[p.status] || 'default'} /></TableCell>
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
            Showing 1 to {PLANS.length} of {TOTAL_RECORDS} records
          </Typography>
          <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" size="small" />
        </Stack>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 2 }}>Plan Details - IP-2026-001</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}>
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

                <Grid item xs={12} sm={9}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                      <Stack spacing={2}>
                        <TextField fullWidth size="small" label="Plan No." value="IP-2026-001" InputProps={{ readOnly: true }} />
                        <TextField fullWidth size="small" type="date" label="Plan Date" value="2026-10-01" InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} />
                        <TextField fullWidth size="small" select label="Inspection Type" value="Incoming">
                          {['Incoming', 'In-process', 'Final'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                        </TextField>
                        <TextField fullWidth size="small" select label="Order Type" value="Purchase">
                          {['Purchase', 'Production', 'Subcontract'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                        </TextField>
                        <TextField
                          fullWidth size="small" label="Order No." value="PO-2026-001"
                          InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                        />
                        <TextField
                          fullWidth size="small" label="Vendor Code" value="V-001"
                          InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                        />
                        <TextField fullWidth size="small" label="Vendor Name" value="Alpha Engineering" InputProps={{ readOnly: true }} />
                        <TextField fullWidth size="small" multiline minRows={2} label="Remarks" defaultValue="Incoming inspection for cast iron housing." />
                      </Stack>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <Stack spacing={2}>
                        <TextField
                          fullWidth size="small" label="Item Code" value="RM-2001"
                          InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                        />
                        <TextField fullWidth size="small" label="Item Description" value="Cast Iron Housing" InputProps={{ readOnly: true }} />
                        <TextField fullWidth size="small" label="Lot / Batch No." value="BCH-001" InputProps={{ readOnly: true }} />
                        <TextField fullWidth size="small" type="date" label="Planned Date" value="2026-10-01" InputLabelProps={{ shrink: true }} />
                      </Stack>
                    </Grid>

                    <Grid item xs={12} sm={4}>
                      <Stack spacing={2}>
                        <Stack direction="row" spacing={1}>
                          <TextField fullWidth size="small" type="number" label="Planned Qty" defaultValue={500} />
                          <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                            {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                          </TextField>
                        </Stack>
                        <TextField fullWidth size="small" label="Status" value="Planned" InputProps={{ readOnly: true }} />
                        <TextField fullWidth size="small" select label="Planned By" value="Kannan P">
                          {['Kannan P', 'Radhakrishnan', 'Senthil Kumar'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                        </TextField>
                      </Stack>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700} color="primary.main">Planned Inspection Items ({PLAN_ITEMS.length} records)</Typography>
                <Button variant="contained" startIcon={<AddIcon />}>Add Item</Button>
              </Stack>

              <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 640px), 340px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>S.No</TableCell>
                      <TableCell>Characteristic</TableCell>
                      <TableCell>Specification</TableCell>
                      <TableCell>Inspection Method</TableCell>
                      <TableCell>Sampling</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {PLAN_ITEMS.map((it) => (
                      <TableRow key={it.no} hover>
                        <TableCell>{it.no}</TableCell>
                        <TableCell>{it.characteristic}</TableCell>
                        <TableCell>{it.spec}</TableCell>
                        <TableCell>{it.method}</TableCell>
                        <TableCell>{it.sampling}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton size="small"><EditOutlinedIcon fontSize="small" color="primary" /></IconButton>
                            <IconButton size="small"><DeleteOutlineIcon fontSize="small" color="error" /></IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
