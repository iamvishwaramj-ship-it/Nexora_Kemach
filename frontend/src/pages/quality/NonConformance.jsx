import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton, Pagination,
} from '@mui/material';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import ReportGmailerrorredOutlinedIcon from '@mui/icons-material/ReportGmailerrorredOutlined';
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
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > Non-Conformance (NCR)" -- rebuilt to match the user-supplied
// reference screenshot exactly (filter card, summary tiles, NCR list,
// NCR Trend stacked bar chart, NCR by Defect Type donut, NCR by Source
// horizontal bars). Static UI-only mock; no Quality data model exists in
// this schema.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total NCRs', value: '18', sub: '↑ 20%', sub2: 'vs Previous Period', icon: ArticleOutlinedIcon, color: 'primary' },
  { label: 'Closed', value: '8', sub: '44.4%', icon: CheckCircleOutlineIcon, color: 'success' },
  { label: 'Open', value: '5', sub: '27.8%', icon: CancelOutlinedIcon, color: 'error' },
  { label: 'In Progress', value: '3', sub: '16.7%', icon: HourglassEmptyOutlinedIcon, color: 'warning' },
  { label: 'Reopened', value: '2', sub: '11.1%', icon: AutorenewOutlinedIcon, color: 'secondary' },
];

const NCRS = [
  { no: 'NCR-2026-001', date: '01-Oct-2026', source: 'Incoming', poNo: 'PO-2026-001', itemCode: 'FG-1001', itemDesc: 'Gear Housing', defect: 'Dimension Out', severity: 'Major', status: 'Open', responsible: 'Kannan P' },
  { no: 'NCR-2026-002', date: '02-Oct-2026', source: 'In-Process', poNo: 'PO-2026-001', itemCode: 'RM-2001', itemDesc: 'Motor Bracket', defect: 'Surface Finish', severity: 'Minor', status: 'In Progress', responsible: 'Radhakrishnan' },
  { no: 'NCR-2026-003', date: '03-Oct-2026', source: 'Final', poNo: 'PO-2026-002', itemCode: 'FG-1002', itemDesc: 'Pump Cover', defect: 'Crack', severity: 'Critical', status: 'Open', responsible: 'Kannan P' },
  { no: 'NCR-2026-004', date: '04-Oct-2026', source: 'In-Process', poNo: 'PO-2026-003', itemCode: 'PM-1001', itemDesc: 'Valve Body', defect: 'Drilling Position', severity: 'Major', status: 'Closed', responsible: 'Suresh' },
  { no: 'NCR-2026-005', date: '06-Oct-2026', source: 'Subcontract', poNo: 'PO-2026-004', itemCode: 'FG-1003', itemDesc: 'Shaft', defect: 'Hardness Low', severity: 'Major', status: 'Reopened', responsible: 'Dheena' },
];

const SEVERITY_COLOR = { Critical: 'error', Major: 'warning', Minor: 'default' };
const STATUS_COLOR = { Open: 'error', 'In Progress': 'warning', Closed: 'success', Reopened: 'secondary' };

const TOTAL_RECORDS = 18;
const TOTAL_PAGES = 2;

const TREND_DATA = [
  { month: 'Apr', Open: 1, 'In Progress': 1, Closed: 1, Reopened: 0 },
  { month: 'May', Open: 2, 'In Progress': 1, Closed: 1, Reopened: 0 },
  { month: 'Jun', Open: 1, 'In Progress': 2, Closed: 2, Reopened: 1 },
  { month: 'Jul', Open: 2, 'In Progress': 1, Closed: 2, Reopened: 1 },
  { month: 'Aug', Open: 2, 'In Progress': 2, Closed: 2, Reopened: 1 },
  { month: 'Sep', Open: 3, 'In Progress': 1, Closed: 3, Reopened: 1 },
  { month: 'Oct', Open: 2, 'In Progress': 1, Closed: 2, Reopened: 1 },
];

const DEFECT_TYPE = [
  { name: 'Dimension Out', value: 27.8, color: '#ef4444' },
  { name: 'Surface Finish', value: 16.7, color: '#2563eb' },
  { name: 'Crack', value: 16.7, color: '#f59e0b' },
  { name: 'Material Defect', value: 11.1, color: '#16a34a' },
  { name: 'Hardness', value: 11.1, color: '#9333ea' },
  { name: 'Others', value: 16.7, color: '#9ca3af' },
];

const NCR_BY_SOURCE = [
  { label: 'Incoming', value: 6, max: 6, color: '#2563eb' },
  { label: 'In-Process', value: 5, max: 6, color: '#16a34a' },
  { label: 'Final', value: 4, max: 6, color: '#f59e0b' },
  { label: 'Subcontract', value: 3, max: 6, color: '#9333ea' },
];

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Quality</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Non-Conformance (NCR)</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>Dashboard</Typography> */}
    </Stack>
  );
}

function PanelHeader({ icon: Icon, children }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
      <Icon fontSize="small" color="primary" />
      <Typography variant="subtitle1" fontWeight={700} color="primary.main">{children}</Typography>
    </Stack>
  );
}

function money(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function NonConformance() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [ncrNo, setNcrNo] = useState('');
  const [source, setSource] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [itemCode, setItemCode] = useState('');
  const [productionOrder, setProductionOrder] = useState('');
  const [ncrType, setNcrType] = useState('All');
  const [status, setStatus] = useState('All');
  const [responsiblePerson, setResponsiblePerson] = useState('All');
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(1);

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const toggleAll = () => {
    setChecked((prev) => (prev.size === NCRS.length ? new Set() : new Set(NCRS.map((i) => i.no))));
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/quality/new-ncr')}>New NCR</Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
        <Button variant="outlined" startIcon={<BookmarkBorderOutlinedIcon />}>Set As Default</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<ReportGmailerrorredOutlinedIcon />}
        title="Non-Conformance (NCR)"
        subtitle="Manage and track non-conformances, take corrective actions and prevent recurrence."
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
                fullWidth size="small" label="NCR No." placeholder="Search NCR No..."
                value={ncrNo} onChange={(e) => setNcrNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
                {['All', 'Incoming', 'In-Process', 'Final', 'Subcontract'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {['All', 'ASSEMBLY-01', 'FINAL-01'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
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
                fullWidth size="small" label="Production Order" placeholder="Search PO No..."
                value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="NCR Type" value={ncrType} onChange={(e) => setNcrType(e.target.value)}>
                {['All', 'Material', 'Process', 'Dimensional'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {['All', 'Open', 'In Progress', 'Closed', 'Reopened'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Responsible Person" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)}>
                {['All', 'Kannan P', 'Radhakrishnan', 'Suresh', 'Dheena'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
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
          <Stack direction="row" alignItems="center" spacing={1}>
            <ArticleOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">NCR List ({TOTAL_RECORDS} records)</Typography>
          </Stack>
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
                  <Checkbox size="small" checked={checked.size === NCRS.length} indeterminate={checked.size > 0 && checked.size < NCRS.length} onChange={toggleAll} />
                </TableCell>
                <TableCell>S.No</TableCell>
                <TableCell>NCR No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Production Order</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell>Defect Type</TableCell>
                <TableCell>Severity</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Responsible</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {NCRS.map((n, idx) => (
                <TableRow key={n.no} hover>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(n.no)} onChange={() => toggleRow(n.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{n.no}</Typography></TableCell>
                  <TableCell>{n.date}</TableCell>
                  <TableCell>{n.source}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{n.poNo}</Typography></TableCell>
                  <TableCell>{n.itemCode}</TableCell>
                  <TableCell>{n.itemDesc}</TableCell>
                  <TableCell>{n.defect}</TableCell>
                  <TableCell><Chip size="small" label={n.severity} color={SEVERITY_COLOR[n.severity] || 'default'} /></TableCell>
                  <TableCell><Chip size="small" label={n.status} color={STATUS_COLOR[n.status] || 'default'} /></TableCell>
                  <TableCell>{n.responsible}</TableCell>
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
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <PanelHeader icon={ShowChartOutlinedIcon}>NCR Trend</PanelHeader>
              <Box sx={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={TREND_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Bar dataKey="Open" stackId="ncr" fill="#ef4444" />
                    <Bar dataKey="In Progress" stackId="ncr" fill="#f59e0b" />
                    <Bar dataKey="Closed" stackId="ncr" fill="#16a34a" />
                    <Bar dataKey="Reopened" stackId="ncr" fill="#9333ea" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
              <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" sx={{ mt: 1 }}>
                {[['Open', '#ef4444'], ['In Progress', '#f59e0b'], ['Closed', '#16a34a'], ['Reopened', '#9333ea']].map(([label, color]) => (
                  <Stack key={label} direction="row" alignItems="center" spacing={0.5}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <PanelHeader icon={PieChartOutlineOutlinedIcon}>NCR by Defect Type</PanelHeader>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ width: 150, height: 150, position: 'relative', flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={DEFECT_TYPE} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2}>
                        {DEFECT_TYPE.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <Typography variant="subtitle1" fontWeight={700}>18</Typography>
                    <Typography variant="caption" color="text.secondary">Total NCRs</Typography>
                  </Box>
                </Box>
                <Stack spacing={0.75} sx={{ flex: 1 }}>
                  {DEFECT_TYPE.map((d) => (
                    <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                        <Typography variant="caption" color="text.secondary">{d.name}</Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight={600}>{d.value}%</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <PanelHeader icon={BarChartOutlinedIcon}>NCR by Source</PanelHeader>
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                {NCR_BY_SOURCE.map((s) => (
                  <Box key={s.label}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                      <Typography variant="body2" fontWeight={700}>{money(s.value)}</Typography>
                    </Stack>
                    <Box sx={{ height: 10, borderRadius: 5, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${(s.value / s.max) * 100}%`, borderRadius: 5, bgcolor: s.color }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
