import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import {
  ComposedChart, PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip,
  CartesianGrid, XAxis, YAxis, Bar, Line, Legend,
} from 'recharts';
import GppGoodOutlinedIcon from '@mui/icons-material/GppGoodOutlined';
import DateRangeOutlinedIcon from '@mui/icons-material/DateRangeOutlined';
import AddIcon from '@mui/icons-material/Add';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import TrackChangesOutlinedIcon from '@mui/icons-material/TrackChangesOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import SettingsSuggestOutlinedIcon from '@mui/icons-material/SettingsSuggestOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > Dashboard" -- rebuilt to match the user-supplied reference
// screenshot exactly (summary tiles, trend/donut charts, Recent Inspections
// table, NCR panel, CAPA panel). Static UI-only mock; no Quality data model
// exists in this schema.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total Inspections', value: '42', sub: '↑ 20% vs Previous Period', icon: DescriptionOutlinedIcon, color: 'primary' },
  { label: 'Passed', value: '36', pct: '85.7%', sub: '↑ 12%', icon: CheckCircleOutlineIcon, color: 'success' },
  { label: 'Rejected', value: '4', pct: '9.5%', sub: '↓ 33%', icon: CancelOutlinedIcon, color: 'error' },
  { label: 'Pending', value: '2', pct: '4.8%', sub: '↓ 50%', icon: AccessTimeOutlinedIcon, color: 'warning' },
  { label: 'NCR Raised', value: '3', sub: '↑ 50%', icon: ReportProblemOutlinedIcon, color: 'secondary' },
  { label: 'CAPA Open', value: '1', sub: '↑ 0%', icon: TrackChangesOutlinedIcon, color: 'info' },
];

const INSPECTION_TREND = [
  { date: '01 Oct', inspected: 18, passed: 15, rejected: 3 },
  { date: '02 Oct', inspected: 20, passed: 18, rejected: 2 },
  { date: '03 Oct', inspected: 15, passed: 13, rejected: 2 },
  { date: '04 Oct', inspected: 12, passed: 10, rejected: 2 },
  { date: '05 Oct', inspected: 17, passed: 15, rejected: 2 },
  { date: '06 Oct', inspected: 14, passed: 12, rejected: 2 },
  { date: '07 Oct', inspected: 19, passed: 17, rejected: 2 },
  { date: '08 Oct', inspected: 16, passed: 13, rejected: 3 },
  { date: '09 Oct', inspected: 21, passed: 19, rejected: 2 },
  { date: '10 Oct', inspected: 22, passed: 20, rejected: 2 },
];

const DEFECT_CATEGORY = [
  { name: 'Dimensional', value: 35, color: '#2563eb' },
  { name: 'Surface Finish', value: 25, color: '#16a34a' },
  { name: 'Cracks / Defects', value: 15, color: '#f59e0b' },
  { name: 'Coating / Plating', value: 10, color: '#9333ea' },
  { name: 'Material', value: 10, color: '#dc2626' },
  { name: 'Others', value: 5, color: '#9ca3af' },
];

const INSPECTION_STATUS = [
  { name: 'Passed', value: 85.7, color: '#16a34a' },
  { name: 'Rejected', value: 9.5, color: '#dc2626' },
  { name: 'Pending', value: 4.8, color: '#f59e0b' },
];

const RECENT_INSPECTIONS = [
  { no: 'QI-2026-001', date: '10-Oct-2026', itemCode: 'FG-1001', itemDesc: 'Gear Housing', orderNo: 'PO-2026-001', type: 'Incoming', qty: 500, accepted: 500, rejected: 0, status: 'Accepted' },
  { no: 'QI-2026-002', date: '09-Oct-2026', itemCode: 'RM-2001', itemDesc: 'Cast Iron Housing', orderNo: 'SCO-2026-003', type: 'In-process', qty: 400, accepted: 380, rejected: 20, status: 'Pending' },
  { no: 'QI-2026-003', date: '08-Oct-2026', itemCode: 'FG-1002', itemDesc: 'Motor Bracket', orderNo: 'PO-2026-002', type: 'Final', qty: 300, accepted: 270, rejected: 30, status: 'Rejected' },
  { no: 'QI-2026-004', date: '07-Oct-2026', itemCode: 'PM-1001', itemDesc: 'Pump Cover', orderNo: 'SCO-2026-001', type: 'Incoming', qty: 600, accepted: 600, rejected: 0, status: 'Accepted' },
  { no: 'QI-2026-005', date: '06-Oct-2026', itemCode: 'FG-1003', itemDesc: 'Valve Body', orderNo: 'PO-2026-003', type: 'In-process', qty: 200, accepted: 190, rejected: 10, status: 'Accepted' },
];

const NCRS = [
  { no: 'NCR-2026-001', date: '09-Oct-2026', itemCode: 'FG-1002', desc: 'Surface scratch', severity: 'Major', status: 'Open' },
  { no: 'NCR-2026-002', date: '07-Oct-2026', itemCode: 'RM-2001', desc: 'Dimension out of tolerance', severity: 'Minor', status: 'In Progress' },
  { no: 'NCR-2026-003', date: '05-Oct-2026', itemCode: 'FG-1003', desc: 'Coating thickness low', severity: 'Major', status: 'Closed' },
];

const CAPAS = [
  { no: 'CAPA-2026-001', date: '07-Oct-2026', ncrNo: 'NCR-2026-002', rootCause: 'Machine setting', targetDate: '20-Oct-2026', status: 'Open' },
  { no: 'CAPA-2026-002', date: '05-Oct-2026', ncrNo: 'NCR-2026-003', rootCause: 'Material quality', targetDate: '18-Oct-2026', status: 'In Progress' },
  { no: 'CAPA-2026-003', date: '01-Oct-2026', ncrNo: 'NCR-2026-001', rootCause: 'Handling damage', targetDate: '10-Oct-2026', status: 'Closed' },
];

const INSPECTION_STATUS_COLOR = { Accepted: 'success', Pending: 'warning', Rejected: 'error' };
const SEVERITY_COLOR = { Major: 'error', Minor: 'warning' };
const WORKFLOW_STATUS_COLOR = { Open: 'error', 'In Progress': 'warning', Closed: 'success' };

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Quality</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>Dashboard</Typography> */}
    </Stack>
  );
}

export default function QualityDashboard() {
  const navigate = useNavigate();

  const [dateRange, setDateRange] = useState('2026-10-01 to 2026-10-10');
  const [workCenter, setWorkCenter] = useState('All Work Centers');

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <TextField
          size="small" value="01-Oct-2026  ~  10-Oct-2026" InputProps={{ readOnly: true, startAdornment: (
            <InputAdornment position="start"><DateRangeOutlinedIcon fontSize="small" color="action" /></InputAdornment>
          ) }}
          sx={{ minWidth: 220 }}
        />
        <TextField fullWidth size="small" select value={workCenter} onChange={(e) => setWorkCenter(e.target.value)} sx={{ minWidth: 170 }}>
          {['All Work Centers', 'CNC Machining', 'Heat Treatment', 'Assembly', 'Surface Coating'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
        </TextField>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<GppGoodOutlinedIcon />}
        title="Quality Management"
        subtitle="Ensure product quality through inspections, non-conformances and corrective actions."
        rightContent={headerRight}
      />

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
                  {t.pct && (
                    <Typography variant="caption" fontWeight={600} display="block">{t.pct}</Typography>
                  )}
                  {t.sub && (
                    <Typography variant="caption" color={t.sub.startsWith('↓') ? 'error.main' : 'success.main'} fontWeight={600}>{t.sub}</Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>Inspection Trend</Typography>
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={INSPECTION_TREND} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} domain={[0, 25]} />
                    <RTooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="passed" fill="#16a34a" radius={[3, 3, 0, 0]} name="Passed" barSize={10} />
                    <Bar dataKey="rejected" fill="#dc2626" radius={[3, 3, 0, 0]} name="Rejected" barSize={10} />
                    <Line type="monotone" dataKey="inspected" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} name="Inspected" />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3.5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>Defect Category Analysis</Typography>
              <Box sx={{ height: 200, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={DEFECT_CATEGORY} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                      {DEFECT_CATEGORY.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="h6" fontWeight={700}>20</Typography>
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

        <Grid item xs={12} sm={6} md={3.5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>Inspection Status</Typography>
              <Box sx={{ height: 200, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={INSPECTION_STATUS} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                      {INSPECTION_STATUS.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="h6" fontWeight={700}>42</Typography>
                  <Typography variant="caption" color="text.secondary">Total</Typography>
                </Box>
              </Box>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {INSPECTION_STATUS.map((d) => (
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

      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <DescriptionOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700} color="primary.main">Recent Inspections</Typography>
          </Stack>
          <Stack direction="row" spacing={1.25}>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/quality/inspection-planning')}>New Inspection</Button>
            <Button variant="outlined" onClick={() => navigate('/quality/incoming-inspection')}>View All</Button>
          </Stack>
        </Stack>

        <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 360px)">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>Inspection No.</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell>Order No.</TableCell>
                <TableCell>Inspection Type</TableCell>
                <TableCell align="right">Qty Inspected</TableCell>
                <TableCell align="right">Accepted</TableCell>
                <TableCell align="right">Rejected</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {RECENT_INSPECTIONS.map((r, idx) => (
                <TableRow key={r.no} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.no}</Typography></TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.itemCode}</Typography></TableCell>
                  <TableCell>{r.itemDesc}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.orderNo}</Typography></TableCell>
                  <TableCell>{r.type}</TableCell>
                  <TableCell align="right">{r.qty.toLocaleString('en-IN')}</TableCell>
                  <TableCell align="right">{r.accepted.toLocaleString('en-IN')}</TableCell>
                  <TableCell align="right">{r.rejected.toLocaleString('en-IN')}</TableCell>
                  <TableCell><Chip size="small" label={r.status} color={INSPECTION_STATUS_COLOR[r.status] || 'default'} /></TableCell>
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
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <WarningAmberOutlinedIcon fontSize="small" color="warning" />
                <Typography variant="subtitle1" fontWeight={700} color="primary.main">Non-Conformance (NCR)</Typography>
              </Stack>
              <Stack direction="row" spacing={1.25}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/quality/new-ncr')}>New NCR</Button>
                <Button variant="outlined" onClick={() => navigate('/quality/ncr')}>View All</Button>
              </Stack>
            </Stack>
            <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 760px), 260px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>NCR No.</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {NCRS.map((n) => (
                    <TableRow key={n.no} hover>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{n.no}</Typography></TableCell>
                      <TableCell>{n.date}</TableCell>
                      <TableCell>{n.itemCode}</TableCell>
                      <TableCell>{n.desc}</TableCell>
                      <TableCell><Chip size="small" label={n.severity} color={SEVERITY_COLOR[n.severity] || 'default'} /></TableCell>
                      <TableCell><Chip size="small" label={n.status} color={WORKFLOW_STATUS_COLOR[n.status] || 'default'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <SettingsSuggestOutlinedIcon fontSize="small" color="primary" />
                <Typography variant="subtitle1" fontWeight={700} color="primary.main">Corrective &amp; Preventive Action (CAPA)</Typography>
              </Stack>
              <Stack direction="row" spacing={1.25}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/quality/new-capa')}>New CAPA</Button>
                <Button variant="outlined" onClick={() => navigate('/quality/capa')}>View All</Button>
              </Stack>
            </Stack>
            <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 760px), 260px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>CAPA No.</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Related NCR</TableCell>
                    <TableCell>Root Cause</TableCell>
                    <TableCell>Target Date</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {CAPAS.map((c) => (
                    <TableRow key={c.no} hover>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{c.no}</Typography></TableCell>
                      <TableCell>{c.date}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{c.ncrNo}</Typography></TableCell>
                      <TableCell>{c.rootCause}</TableCell>
                      <TableCell>{c.targetDate}</TableCell>
                      <TableCell><Chip size="small" label={c.status} color={WORKFLOW_STATUS_COLOR[c.status] || 'default'} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
