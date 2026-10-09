import React, { useState } from 'react';
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
import SearchIcon from '@mui/icons-material/Search';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import HourglassEmptyOutlinedIcon from '@mui/icons-material/HourglassEmptyOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > Quality Reports" -- rebuilt to match the user-supplied
// reference screenshot exactly (filter card, summary tiles, Inspection
// Results Trend stacked bar chart, Defect Type Analysis donut, Inspection
// Type Wise Results horizontal stacked bars, Inspection Details table).
// Static UI-only mock; no Quality data model exists in this schema.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total Inspections', value: '245', sub: '↑ 12%', sub2: 'vs Previous Period', icon: ArticleOutlinedIcon, color: 'primary' },
  { label: 'Accepted', value: '198', sub: '81.0%', icon: CheckCircleOutlineIcon, color: 'success' },
  { label: 'Rejected', value: '32', sub: '13.1%', icon: CancelOutlinedIcon, color: 'error' },
  { label: 'Rework', value: '15', sub: '6.1%', icon: HourglassEmptyOutlinedIcon, color: 'warning' },
  { label: 'Total Defects', value: '76', sub: '↑ 8%', sub2: 'vs Previous Period', icon: WarningAmberOutlinedIcon, color: 'secondary' },
  { label: 'NCR Raised', value: '12', sub: '↑ 20%', sub2: 'vs Previous Period', icon: ArticleOutlinedIcon, color: 'primary' },
];

const TREND_DATA = [
  { month: 'Apr', Accepted: 24, Rejected: 4, Rework: 2, Pending: 3 },
  { month: 'May', Accepted: 28, Rejected: 5, Rework: 3, Pending: 2 },
  { month: 'Jun', Accepted: 22, Rejected: 4, Rework: 2, Pending: 2 },
  { month: 'Jul', Accepted: 26, Rejected: 6, Rework: 3, Pending: 3 },
  { month: 'Aug', Accepted: 30, Rejected: 5, Rework: 3, Pending: 2 },
  { month: 'Sep', Accepted: 25, Rejected: 4, Rework: 2, Pending: 2 },
  { month: 'Oct', Accepted: 27, Rejected: 4, Rework: 2, Pending: 3 },
];

const DEFECT_TYPE = [
  { name: 'Dimension', count: 27, value: 35.5, color: '#ef4444' },
  { name: 'Surface Finish', count: 15, value: 19.7, color: '#2563eb' },
  { name: 'Crack', count: 10, value: 13.2, color: '#f59e0b' },
  { name: 'Material Defect', count: 8, value: 10.5, color: '#16a34a' },
  { name: 'Hole Position', count: 6, value: 7.9, color: '#9333ea' },
  { name: 'Appearance', count: 5, value: 6.6, color: '#ea580c' },
  { name: 'Others', count: 5, value: 6.6, color: '#9ca3af' },
];

const TYPE_WISE_RESULTS = [
  { label: 'Incoming', total: 80, Accepted: 65, Rejected: 8, Rework: 4, Pending: 3 },
  { label: 'In-Process', total: 95, Accepted: 75, Rejected: 10, Rework: 6, Pending: 4 },
  { label: 'Final', total: 50, Accepted: 38, Rejected: 7, Rework: 3, Pending: 2 },
  { label: 'Subcontract', total: 20, Accepted: 14, Rejected: 3, Rework: 2, Pending: 1 },
];
const MAX_TYPE_TOTAL = Math.max(...TYPE_WISE_RESULTS.map((t) => t.total));

const INSPECTIONS = [
  { no: 'IN-2026-001', date: '01-Oct-2026', type: 'Incoming', itemCode: 'FG-1001', itemDesc: 'Gear Housing', lotNo: 'BCH-001', workCenter: 'ASSEMBLY-01', inspected: 100, accepted: 98, rejected: 2, status: 'Accepted', ncrNo: '-' },
  { no: 'IP-2026-012', date: '02-Oct-2026', type: 'In-Process', itemCode: 'RM-2001', itemDesc: 'Motor Bracket', lotNo: 'BCH-021', workCenter: 'MACH-01', inspected: 50, accepted: 45, rejected: 5, status: 'Rejected', ncrNo: 'NCR-2026-002' },
  { no: 'FN-2026-008', date: '03-Oct-2026', type: 'Final', itemCode: 'FG-1002', itemDesc: 'Pump Cover', lotNo: 'BCH-015', workCenter: 'ASSEMBLY-02', inspected: 30, accepted: 28, rejected: 2, status: 'Rework', ncrNo: 'NCR-2026-003' },
  { no: 'IN-2026-002', date: '04-Oct-2026', type: 'Incoming', itemCode: 'RM-2003', itemDesc: 'Shaft', lotNo: 'BCH-018', workCenter: 'STORE', inspected: 200, accepted: 196, rejected: 4, status: 'Accepted', ncrNo: '-' },
  { no: 'IP-2026-013', date: '05-Oct-2026', type: 'In-Process', itemCode: 'FG-1003', itemDesc: 'Valve Body', lotNo: 'BCH-020', workCenter: 'MACH-02', inspected: 40, accepted: 36, rejected: 4, status: 'Rejected', ncrNo: 'NCR-2026-004' },
  { no: 'FN-2026-009', date: '06-Oct-2026', type: 'Final', itemCode: 'FG-1004', itemDesc: 'Pump Assembly', lotNo: 'BCH-016', workCenter: 'ASSEMBLY-01', inspected: 25, accepted: 24, rejected: 1, status: 'Accepted', ncrNo: '-' },
  { no: 'IN-2026-003', date: '07-Oct-2026', type: 'Incoming', itemCode: 'RM-2004', itemDesc: 'Bearing', lotNo: 'BCH-022', workCenter: 'STORE', inspected: 150, accepted: 149, rejected: 1, status: 'Accepted', ncrNo: '-' },
  { no: 'IP-2026-014', date: '08-Oct-2026', type: 'In-Process', itemCode: 'FG-1005', itemDesc: 'Coupling', lotNo: 'BCH-024', workCenter: 'MACH-01', inspected: 60, accepted: 52, rejected: 8, status: 'Rejected', ncrNo: 'NCR-2026-005' },
  { no: 'FN-2026-010', date: '09-Oct-2026', type: 'Final', itemCode: 'FG-1006', itemDesc: 'Gear Box', lotNo: 'BCH-023', workCenter: 'ASSEMBLY-02', inspected: 20, accepted: 18, rejected: 2, status: 'Rework', ncrNo: 'NCR-2026-006' },
  { no: 'IN-2026-004', date: '10-Oct-2026', type: 'Incoming', itemCode: 'RM-2005', itemDesc: 'Seal Ring', lotNo: 'BCH-025', workCenter: 'STORE', inspected: 300, accepted: 298, rejected: 2, status: 'Accepted', ncrNo: '-' },
];

const STATUS_COLOR = { Accepted: 'success', Rejected: 'error', Rework: 'warning' };

const TOTAL_RECORDS = 245;
const TOTAL_PAGES = 5;

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Quality</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Quality Reports</Typography>
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

export default function QualityReport() {
  const [dateFrom, setDateFrom] = useState('2026-10-01');
  const [dateTo, setDateTo] = useState('2026-10-31');
  const [workCenter, setWorkCenter] = useState('All');
  const [itemCode, setItemCode] = useState('');
  const [customer, setCustomer] = useState('All');
  const [inspectionType, setInspectionType] = useState('All');
  const [status, setStatus] = useState('All');
  const [defectType, setDefectType] = useState('All');
  const [department, setDepartment] = useState('All');
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
    setChecked((prev) => (prev.size === INSPECTIONS.length ? new Set() : new Set(INSPECTIONS.map((i) => i.no))));
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<ReportGmailerrorredOutlinedIcon />}
        title="Quality Report"
        subtitle="Analyze inspection results, defects, NCRs and quality performance across all processes."
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
              <TextField fullWidth size="small" type="date" label="Date From" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" type="date" label="Date To" value={dateTo} onChange={(e) => setDateTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {['All', 'ASSEMBLY-01', 'ASSEMBLY-02', 'MACH-01', 'MACH-02', 'STORE'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
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
              <TextField fullWidth size="small" select label="Customer" value={customer} onChange={(e) => setCustomer(e.target.value)}>
                {['All', 'ABC Engineering Ltd.', 'XYZ Industries'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Inspection Type" value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
                {['All', 'Incoming', 'In-Process', 'Final'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {['All', 'Accepted', 'Rejected', 'Rework', 'Pending'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Defect Type" value={defectType} onChange={(e) => setDefectType(e.target.value)}>
                {['All', 'Dimension', 'Surface Finish', 'Crack', 'Material Defect'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                {['All', 'Quality', 'Production', 'Stores'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
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
            <Grid item xs={6} sm={4} md={2} key={t.label}>
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

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <PanelHeader icon={ShowChartOutlinedIcon}>Inspection Results Trend</PanelHeader>
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={TREND_DATA} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RTooltip />
                    <Bar dataKey="Accepted" stackId="insp" fill="#16a34a" />
                    <Bar dataKey="Rejected" stackId="insp" fill="#ef4444" />
                    <Bar dataKey="Rework" stackId="insp" fill="#f59e0b" />
                    <Bar dataKey="Pending" stackId="insp" fill="#2563eb" radius={[3, 3, 0, 0]} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
              <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" sx={{ mt: 1 }}>
                {[['Accepted', '#16a34a'], ['Rejected', '#ef4444'], ['Rework', '#f59e0b'], ['Pending', '#2563eb']].map(([label, color]) => (
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
              <PanelHeader icon={PieChartOutlineOutlinedIcon}>Defect Type Analysis</PanelHeader>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ width: 150, height: 150, position: 'relative', flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={DEFECT_TYPE} dataKey="count" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={2}>
                        {DEFECT_TYPE.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                    <Typography variant="subtitle1" fontWeight={700}>76</Typography>
                    <Typography variant="caption" color="text.secondary">Total Defects</Typography>
                  </Box>
                </Box>
                <Stack spacing={0.6} sx={{ flex: 1 }}>
                  {DEFECT_TYPE.map((d) => (
                    <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                      <Stack direction="row" alignItems="center" spacing={0.75}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                        <Typography variant="caption" color="text.secondary">{d.name}</Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight={600}>{d.count} ({d.value}%)</Typography>
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
              <PanelHeader icon={BarChartOutlinedIcon}>Inspection Type Wise Results</PanelHeader>
              <Stack spacing={2.25} sx={{ mt: 1 }}>
                {TYPE_WISE_RESULTS.map((t) => (
                  <Box key={t.label}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">{t.label}</Typography>
                      <Typography variant="body2" fontWeight={700}>{t.total}</Typography>
                    </Stack>
                    <Stack direction="row" sx={{ height: 10, borderRadius: 5, overflow: 'hidden', bgcolor: 'action.hover', width: `${(t.total / MAX_TYPE_TOTAL) * 100}%` }}>
                      <Box sx={{ height: '100%', width: `${(t.Accepted / t.total) * 100}%`, bgcolor: '#16a34a' }} />
                      <Box sx={{ height: '100%', width: `${(t.Rejected / t.total) * 100}%`, bgcolor: '#ef4444' }} />
                      <Box sx={{ height: '100%', width: `${(t.Rework / t.total) * 100}%`, bgcolor: '#f59e0b' }} />
                      <Box sx={{ height: '100%', width: `${(t.Pending / t.total) * 100}%`, bgcolor: '#2563eb' }} />
                    </Stack>
                  </Box>
                ))}
              </Stack>
              <Stack direction="row" spacing={2} justifyContent="center" flexWrap="wrap" sx={{ mt: 2 }}>
                {[['Accepted', '#16a34a'], ['Rejected', '#ef4444'], ['Rework', '#f59e0b'], ['Pending', '#2563eb']].map(([label, color]) => (
                  <Stack key={label} direction="row" alignItems="center" spacing={0.5}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} />
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined">
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <ArticleOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">Inspection Details ({TOTAL_RECORDS} records)</Typography>
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
                  <Checkbox size="small" checked={checked.size === INSPECTIONS.length} indeterminate={checked.size > 0 && checked.size < INSPECTIONS.length} onChange={toggleAll} />
                </TableCell>
                <TableCell>S.No</TableCell>
                <TableCell>Inspection No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Inspection Type</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell>Batch / Lot No.</TableCell>
                <TableCell>Work Center</TableCell>
                <TableCell align="right">Qty Inspected</TableCell>
                <TableCell align="right">Accepted</TableCell>
                <TableCell align="right">Rejected</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>NCR No.</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {INSPECTIONS.map((i, idx) => (
                <TableRow key={i.no} hover>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(i.no)} onChange={() => toggleRow(i.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.no}</Typography></TableCell>
                  <TableCell>{i.date}</TableCell>
                  <TableCell>{i.type}</TableCell>
                  <TableCell>{i.itemCode}</TableCell>
                  <TableCell>{i.itemDesc}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.lotNo}</Typography></TableCell>
                  <TableCell>{i.workCenter}</TableCell>
                  <TableCell align="right">{i.inspected}</TableCell>
                  <TableCell align="right">{i.accepted}</TableCell>
                  <TableCell align="right">{i.rejected}</TableCell>
                  <TableCell><Chip size="small" label={i.status} color={STATUS_COLOR[i.status] || 'default'} /></TableCell>
                  <TableCell>
                    {i.ncrNo === '-' ? '-' : <Typography variant="body2" color="primary.main" fontWeight={600}>{i.ncrNo}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                      <IconButton size="small"><BarChartOutlinedIcon fontSize="small" /></IconButton>
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
    </Box>
  );
}
