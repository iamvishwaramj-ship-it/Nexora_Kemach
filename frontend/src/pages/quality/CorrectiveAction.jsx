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
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AutorenewOutlinedIcon from '@mui/icons-material/AutorenewOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > Corrective Action (CAPA)" -- rebuilt to match the user-supplied
// reference screenshot exactly (filter card, summary tiles, CAPA list,
// CAPA Trend stacked bar chart, CAPA by Type donut, CAPA by Status
// horizontal bars). Static UI-only mock; no Quality data model exists in
// this schema.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total CAPAs', value: '12', sub: '↑ 20%', sub2: 'vs Previous Period', icon: ArticleOutlinedIcon, color: 'primary' },
  { label: 'Completed', value: '5', sub: '41.7%', icon: CheckCircleOutlineIcon, color: 'success' },
  { label: 'In Progress', value: '4', sub: '33.3%', icon: AccessTimeOutlinedIcon, color: 'error' },
  { label: 'Pending', value: '2', sub: '16.7%', icon: ListAltOutlinedIcon, color: 'warning' },
  { label: 'Overdue', value: '1', sub: '8.3%', icon: AutorenewOutlinedIcon, color: 'secondary' },
];

const CAPAS = [
  { no: 'CAPA-2026-001', date: '01-Oct-2026', ncrNo: 'NCR-2026-001', source: 'Incoming', problem: 'Hole dia out of tolerance', rootCause: 'Tool wear', type: 'Corrective', target: '10-Oct-2026', status: 'Completed', responsible: 'Kannan P' },
  { no: 'CAPA-2026-002', date: '01-Oct-2026', ncrNo: 'NCR-2026-002', source: 'In-Process', problem: 'Surface finish rough', rootCause: 'Improper tool', type: 'Corrective', target: '12-Oct-2026', status: 'In Progress', responsible: 'Radhakrishnan' },
  { no: 'CAPA-2026-003', date: '03-Oct-2026', ncrNo: 'NCR-2026-003', source: 'Final', problem: 'Crack in casting', rootCause: 'Material defect', type: 'Corrective', target: '08-Oct-2026', status: 'Overdue', responsible: 'Suresh' },
  { no: 'CAPA-2026-004', date: '04-Oct-2026', ncrNo: 'NCR-2026-004', source: 'In-Process', problem: 'Drilling position error', rootCause: 'Fixture issue', type: 'Corrective', target: '15-Oct-2026', status: 'In Progress', responsible: 'Dheena' },
  { no: 'CAPA-2026-005', date: '05-Oct-2026', ncrNo: 'NCR-2026-005', source: 'Subcontract', problem: 'Hardness low', rootCause: 'Heat treatment', type: 'Preventive', target: '20-Oct-2026', status: 'Pending', responsible: 'Kannan P' },
  { no: 'CAPA-2026-006', date: '06-Oct-2026', ncrNo: 'NCR-2026-006', source: 'Incoming', problem: 'Burr on edge', rootCause: 'Handling damage', type: 'Corrective', target: '12-Oct-2026', status: 'Completed', responsible: 'Radhakrishnan' },
  { no: 'CAPA-2026-007', date: '07-Oct-2026', ncrNo: 'NCR-2026-007', source: 'In-Process', problem: 'Dimension variation', rootCause: 'Machine calibration', type: 'Corrective', target: '14-Oct-2026', status: 'Pending', responsible: 'Suresh' },
  { no: 'CAPA-2026-008', date: '08-Oct-2026', ncrNo: 'NCR-2026-008', source: 'Final', problem: 'Paint peel off', rootCause: 'Surface preparation', type: 'Preventive', target: '18-Oct-2026', status: 'In Progress', responsible: 'Dheena' },
  { no: 'CAPA-2026-009', date: '09-Oct-2026', ncrNo: 'NCR-2026-009', source: 'Customer', problem: 'Customer complaint', rootCause: 'Design issue', type: 'Corrective', target: '22-Oct-2026', status: 'Completed', responsible: 'Kannan P' },
  { no: 'CAPA-2026-010', date: '10-Oct-2026', ncrNo: 'NCR-2026-010', source: 'In-Process', problem: 'Loose assembly', rootCause: 'Torque not applied', type: 'Preventive', target: '25-Oct-2026', status: 'Pending', responsible: 'Radhakrishnan' },
];

const STATUS_COLOR = { Completed: 'success', 'In Progress': 'warning', Overdue: 'error', Pending: 'warning' };

const TOTAL_RECORDS = 12;
const TOTAL_PAGES = 2;

const TREND_DATA = [
  { month: 'Apr', Completed: 1, 'In Progress': 1, Pending: 1, Overdue: 0 },
  { month: 'May', Completed: 1, 'In Progress': 1, Pending: 1, Overdue: 0 },
  { month: 'Jun', Completed: 2, 'In Progress': 1, Pending: 1, Overdue: 1 },
  { month: 'Jul', Completed: 1, 'In Progress': 2, Pending: 1, Overdue: 1 },
  { month: 'Aug', Completed: 2, 'In Progress': 2, Pending: 1, Overdue: 1 },
  { month: 'Sep', Completed: 2, 'In Progress': 2, Pending: 2, Overdue: 1 },
  { month: 'Oct', Completed: 1, 'In Progress': 1, Pending: 1, Overdue: 0 },
];

const CAPA_BY_TYPE = [
  { name: 'Corrective', value: 66.7, count: 8, color: '#2563eb' },
  { name: 'Preventive', value: 33.3, count: 4, color: '#f59e0b' },
];

const CAPA_BY_STATUS = [
  { label: 'Completed', value: 5, max: 5, color: '#16a34a' },
  { label: 'In Progress', value: 4, max: 5, color: '#f59e0b' },
  { label: 'Pending', value: 2, max: 5, color: '#fb923c' },
  { label: 'Overdue', value: 1, max: 5, color: '#ef4444' },
];

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Quality</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Corrective Action (CAPA)</Typography>
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

export default function CorrectiveAction() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [capaNo, setCapaNo] = useState('');
  const [source, setSource] = useState('All');
  const [type, setType] = useState('All');
  const [relatedNcrNo, setRelatedNcrNo] = useState('');
  const [rootCause, setRootCause] = useState('All');
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
    setChecked((prev) => (prev.size === CAPAS.length ? new Set() : new Set(CAPAS.map((i) => i.no))));
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/quality/new-capa')}>New CAPA</Button>
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
        title="Corrective Action (CAPA)"
        subtitle="Manage corrective and preventive actions to eliminate root causes and prevent recurrence."
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
                fullWidth size="small" label="CAPA No." placeholder="Search CAPA No..."
                value={capaNo} onChange={(e) => setCapaNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
                {['All', 'Incoming', 'In-Process', 'Final', 'Subcontract', 'Customer'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
                {['All', 'Corrective', 'Preventive'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Related NCR No." placeholder="Search NCR No..."
                value={relatedNcrNo} onChange={(e) => setRelatedNcrNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Root Cause" value={rootCause} onChange={(e) => setRootCause(e.target.value)}>
                {['All', 'Tool wear', 'Improper tool', 'Material defect', 'Fixture issue', 'Heat treatment'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {['All', 'Completed', 'In Progress', 'Pending', 'Overdue'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Responsible Person" value={responsiblePerson} onChange={(e) => setResponsiblePerson(e.target.value)}>
                {['All', 'Kannan P', 'Radhakrishnan', 'Suresh', 'Dheena'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button variant="outlined" fullWidth sx={{ height: 40 }}>Reset</Button>
              <Button variant="contained" fullWidth startIcon={<SearchIcon />} sx={{ height: 40 }}>Search</Button>
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
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">CAPA List ({TOTAL_RECORDS} records)</Typography>
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
                  <Checkbox size="small" checked={checked.size === CAPAS.length} indeterminate={checked.size > 0 && checked.size < CAPAS.length} onChange={toggleAll} />
                </TableCell>
                <TableCell>S.No</TableCell>
                <TableCell>CAPA No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Related NCR No.</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Problem Description</TableCell>
                <TableCell>Root Cause</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Target Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Responsible</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {CAPAS.map((c, idx) => (
                <TableRow key={c.no} hover>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(c.no)} onChange={() => toggleRow(c.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{c.no}</Typography></TableCell>
                  <TableCell>{c.date}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{c.ncrNo}</Typography></TableCell>
                  <TableCell>{c.source}</TableCell>
                  <TableCell>{c.problem}</TableCell>
                  <TableCell>{c.rootCause}</TableCell>
                  <TableCell>{c.type}</TableCell>
                  <TableCell>{c.target}</TableCell>
                  <TableCell><Chip size="small" label={c.status} color={STATUS_COLOR[c.status] || 'default'} /></TableCell>
                  <TableCell>{c.responsible}</TableCell>
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
              <PanelHeader icon={ShowChartOutlinedIcon}>CAPA Trend (Last 6 Months)</PanelHeader>
              <Box sx={{ height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={TREND_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Bar dataKey="Completed" stackId="capa" fill="#16a34a" />
                    <Bar dataKey="In Progress" stackId="capa" fill="#f59e0b" />
                    <Bar dataKey="Pending" stackId="capa" fill="#fb923c" />
                    <Bar dataKey="Overdue" stackId="capa" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
              <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" sx={{ mt: 1 }}>
                {[['Completed', '#16a34a'], ['In Progress', '#f59e0b'], ['Pending', '#fb923c'], ['Overdue', '#ef4444']].map(([label, color]) => (
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
              <PanelHeader icon={PieChartOutlineOutlinedIcon}>CAPA by Type</PanelHeader>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ width: 150, height: 150, position: 'relative', flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={CAPA_BY_TYPE} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2}>
                        {CAPA_BY_TYPE.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <Typography variant="subtitle1" fontWeight={700}>12</Typography>
                    <Typography variant="caption" color="text.secondary">Total CAPAs</Typography>
                  </Box>
                </Box>
                <Stack spacing={1} sx={{ flex: 1 }}>
                  {CAPA_BY_TYPE.map((d) => (
                    <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                        <Typography variant="caption" color="text.secondary">{d.name}</Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight={600}>{d.value}% ({d.count})</Typography>
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
              <PanelHeader icon={BarChartOutlinedIcon}>CAPA by Status</PanelHeader>
              <Stack spacing={2.5} sx={{ mt: 1 }}>
                {CAPA_BY_STATUS.map((s) => (
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
