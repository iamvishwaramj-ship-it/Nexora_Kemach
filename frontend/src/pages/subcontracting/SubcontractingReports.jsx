import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, InputAdornment,
} from '@mui/material';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip,
  BarChart, CartesianGrid, XAxis, YAxis, Bar,
  LineChart, Line, Area, AreaChart,
} from 'recharts';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import MonetizationOnOutlinedIcon from '@mui/icons-material/MonetizationOnOutlined';
import StackedBarChartOutlinedIcon from '@mui/icons-material/StackedBarChartOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import PieChartOutlineOutlinedIcon from '@mui/icons-material/PieChartOutlineOutlined';
import ShowChartOutlinedIcon from '@mui/icons-material/ShowChartOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Subcontracting Reports" -- rebuilt to pixel-match the user-supplied
// reference screenshot. Static UI-only mock; no Subcontracting data model
// exists in this schema.
// ---------------------------------------------------------------------------

const SUBCONTRACTORS = ['All', 'Sri Balaji HT', 'Alpha Engineering', 'Metal Works', 'Shakti Coating', 'Precision Grinding'];
const WORK_CENTERS = ['All', 'Heat Treatment', 'CNC Machining', 'Surface Coating', 'Plating', 'Grinding'];
const REPORT_TYPE_OPTIONS = ['All', 'Order', 'Issue', 'Inward', 'Quality', 'Billing', 'Payment'];
const STATUS_OPTIONS = ['All', 'In Progress', 'Completed', 'On Hold', 'Cancelled'];
const GROUP_BY_OPTIONS = ['Date', 'Subcontractor', 'Work Center', 'Item'];

const REPORT_CARDS = [
  { key: 'order', title: 'Subcontract Order Report', desc: 'List and summary of subcontract orders', icon: DescriptionOutlinedIcon, color: '#ef5a28' },
  { key: 'issue', title: 'Material Issue Report', desc: 'Materials issued to subcontractors', icon: Inventory2OutlinedIcon, color: '#2e9e4e' },
  { key: 'inward', title: 'Subcontract Inward Report', desc: 'Received materials from subcontractors', icon: MoveToInboxOutlinedIcon, color: '#7c4dd6' },
  { key: 'quality', title: 'Quality Inspection Report', desc: 'Inspection results and quality analysis', icon: ShieldOutlinedIcon, color: '#e0403e' },
  { key: 'bill', title: 'Subcontract Bill Report', desc: 'Invoices received from subcontractors', icon: ReceiptLongOutlinedIcon, color: '#2563eb' },
  { key: 'payment', title: 'Subcontract Payment Report', desc: 'Payments made to subcontractors', icon: MonetizationOnOutlinedIcon, color: '#d6a52a' },
  { key: 'consumption', title: 'Process / Item Consumption Report', desc: 'Item-wise subcontract processing details', icon: StackedBarChartOutlinedIcon, color: '#16a37e' },
  { key: 'turnaround', title: 'Turnaround Time Report', desc: 'Order to inward cycle time analysis', icon: AccessTimeOutlinedIcon, color: '#6b7280' },
  { key: 'performance', title: 'Subcontractor Performance Report', desc: 'Vendor-wise performance and quality', icon: PieChartOutlineOutlinedIcon, color: '#ec4899' },
  { key: 'cost', title: 'Cost Analysis Report', desc: 'Process-wise cost and variance', icon: ShowChartOutlinedIcon, color: '#06b6d4' },
  { key: 'pending', title: 'Pending Report', desc: 'Pending inward, inspection, bills & payments', icon: TrendingUpOutlinedIcon, color: '#7c3aed' },
  { key: 'custom', title: 'Custom Report', desc: 'Create and export custom reports', icon: GridViewOutlinedIcon, color: '#15803d' },
];

const ORDER_REPORT_ROWS = [
  { no: 'SCO-2026-001', date: '01-Oct-2026', subcon: 'Sri Balaji HT', process: 'Heat Treatment', itemCode: 'FG-1001', itemDesc: 'Gear Housing', orderQty: 500, inwardQty: 480, pendingQty: 20, status: 'In Progress' },
  { no: 'SCO-2026-002', date: '02-Oct-2026', subcon: 'Alpha Engineering', process: 'CNC Machining', itemCode: 'FG-1002', itemDesc: 'Motor Bracket', orderQty: 300, inwardQty: 300, pendingQty: 0, status: 'Completed' },
  { no: 'SCO-2026-003', date: '03-Oct-2026', subcon: 'Metal Works', process: 'Surface Coating', itemCode: 'PM-1001', itemDesc: 'Pump Cover', orderQty: 600, inwardQty: 560, pendingQty: 40, status: 'In Progress' },
  { no: 'SCO-2026-004', date: '04-Oct-2026', subcon: 'Shakti Coating', process: 'Plating', itemCode: 'RM-2001', itemDesc: 'Cast Iron Housing', orderQty: 400, inwardQty: 400, pendingQty: 0, status: 'Completed' },
  { no: 'SCO-2026-005', date: '06-Oct-2026', subcon: 'Precision Grinding', process: 'Grinding', itemCode: 'FG-1003', itemDesc: 'Valve Body', orderQty: 300, inwardQty: 270, pendingQty: 30, status: 'In Progress' },
];

const ORDER_STATUS_COLOR = { 'In Progress': 'warning', Completed: 'success', 'On Hold': 'error', Cancelled: 'default' };

const ORDER_STATUS_PIE = [
  { name: 'Completed', value: 11, pct: '61.1%', color: '#22c55e' },
  { name: 'In Progress', value: 4, pct: '22.2%', color: '#f59e0b' },
  { name: 'On Hold', value: 2, pct: '11.1%', color: '#ef4444' },
  { name: 'Cancelled', value: 1, pct: '5.6%', color: '#9ca3af' },
];

const PROCESS_VALUE = [
  { process: 'Heat Treatment', value: 13.5 },
  { process: 'CNC Machining', value: 9.8 },
  { process: 'Plating', value: 7.2 },
  { process: 'Surface Coating', value: 6.4 },
  { process: 'Grinding', value: 2.6 },
];

const TOP_SUBCONTRACTORS = [
  { name: 'Sri Balaji HT', value: 9.4, color: '#2563eb' },
  { name: 'Alpha Engineering', value: 6.8, color: '#16a37e' },
  { name: 'Metal Works', value: 5.2, color: '#f97316' },
  { name: 'Shakti Coating', value: 4.6, color: '#7c3aed' },
  { name: 'Precision Grinding', value: 3.8, color: '#ef4444' },
];

const MONTHLY_TREND = [
  { month: 'Apr', value: 2.1 },
  { month: 'May', value: 3.4 },
  { month: 'Jun', value: 5.8 },
  { month: 'Jul', value: 7.5 },
  { month: 'Aug', value: 9.9 },
  { month: 'Sep', value: 13.2 },
  { month: 'Oct', value: 11.6 },
];

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Subcontracting</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>Reports</Typography> */}
    </Stack>
  );
}

export default function SubcontractingReports() {
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [subcontractor, setSubcontractor] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [itemCode, setItemCode] = useState('');
  const [reportType, setReportType] = useState('All');
  const [status, setStatus] = useState('All');
  const [orderNo, setOrderNo] = useState('');
  const [groupBy, setGroupBy] = useState('Date');
  const [activeReport, setActiveReport] = useState('order');

  const headerRight = <BreadcrumbTrail />;

  return (
    <Box>
      <EntityHeaderCard
        icon={<AssessmentOutlinedIcon />}
        title="Subcontracting Reports"
        subtitle="View and analyze subcontracting order, issue, inward, quality, billing and payment reports."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 2.5 }}>Filter Criteria</Typography>
          <Grid container spacing={2.5} alignItems="center">
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" type="date" label="From Date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" type="date" label="To Date" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Subcontractor" value={subcontractor} onChange={(e) => setSubcontractor(e.target.value)}>
                {SUBCONTRACTORS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Work Center / Process" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Item Code" placeholder="Search Item..."
                value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Report Type" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                {REPORT_TYPE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField
                fullWidth size="small" label="Order No." placeholder="Search Order No..."
                value={orderNo} onChange={(e) => setOrderNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Group By" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                {GROUP_BY_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3.5} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Button fullWidth variant="outlined" sx={{ height: 40 }}>Reset</Button>
              <Button fullWidth variant="contained" startIcon={<SearchIcon />} sx={{ height: 40 }}>Search</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {REPORT_CARDS.map((r) => {
          const Icon = r.icon;
          const active = r.key === activeReport;
          return (
            <Grid item xs={12} sm={6} md={3} key={r.key}>
              <Card
                variant="outlined"
                onClick={() => setActiveReport(r.key)}
                sx={{
                  cursor: 'pointer', height: '100%',
                  borderColor: active ? 'primary.main' : 'divider',
                  borderWidth: active ? 2 : 1,
                }}
              >
                <CardContent>
                  <Stack direction="row" spacing={1.5} alignItems="flex-start" justifyContent="space-between">
                    <Stack direction="row" spacing={1.5} alignItems="flex-start">
                      <Box sx={{ width: 40, height: 40, borderRadius: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: r.color, color: '#fff', flexShrink: 0 }}>
                        <Icon fontSize="small" />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>{r.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{r.desc}</Typography>
                      </Box>
                    </Stack>
                    <ChevronRightIcon fontSize="small" color="disabled" />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Typography variant="subtitle1" fontWeight={700} color="primary.main">Subcontract Order Report</Typography>
          <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" size="small" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
            <Button variant="outlined" size="small" startIcon={<PrintOutlinedIcon />}>Print</Button>
            <Button variant="outlined" size="small" startIcon={<PictureAsPdfOutlinedIcon />}>Generate PDF</Button>
          </Stack>
        </Stack>

        <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 380px)">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>S.No</TableCell>
                <TableCell>Order No.</TableCell>
                <TableCell>Order Date</TableCell>
                <TableCell>Subcontractor</TableCell>
                <TableCell>Work Center / Process</TableCell>
                <TableCell>Item Code</TableCell>
                <TableCell>Item Description</TableCell>
                <TableCell align="right">Order Qty</TableCell>
                <TableCell align="right">Inward Qty</TableCell>
                <TableCell align="right">Pending Qty</TableCell>
                <TableCell>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ORDER_REPORT_ROWS.map((r, idx) => (
                <TableRow key={r.no} hover>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.no}</Typography></TableCell>
                  <TableCell>{r.date}</TableCell>
                  <TableCell>{r.subcon}</TableCell>
                  <TableCell>{r.process}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.itemCode}</Typography></TableCell>
                  <TableCell>{r.itemDesc}</TableCell>
                  <TableCell align="right">{r.orderQty}</TableCell>
                  <TableCell align="right">{r.inwardQty}</TableCell>
                  <TableCell align="right">{r.pendingQty}</TableCell>
                  <TableCell><Chip size="small" label={r.status} color={ORDER_STATUS_COLOR[r.status] || 'default'} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTableContainer>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>Order Status</Typography>
              <Box sx={{ height: 190, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={ORDER_STATUS_PIE} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} paddingAngle={2}>
                      {ORDER_STATUS_PIE.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <RTooltip />
                  </PieChart>
                </ResponsiveContainer>
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
                  <Typography variant="h6" fontWeight={700}>Total</Typography>
                  <Typography variant="caption" color="text.secondary">18 Orders</Typography>
                </Box>
              </Box>
              <Stack spacing={0.5} sx={{ mt: 1 }}>
                {ORDER_STATUS_PIE.map((d) => (
                  <Stack key={d.name} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: d.color }} />
                      <Typography variant="caption" color="text.secondary">{d.name}</Typography>
                    </Stack>
                    <Typography variant="caption" fontWeight={600}>{d.value} ({d.pct})</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>Process-wise Order Value</Typography>
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={PROCESS_VALUE} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="process" tick={{ fontSize: 10 }} interval={0} angle={0} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}L`} />
                    <RTooltip formatter={(v) => [`${v}L`, 'Value']} />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {PROCESS_VALUE.map((d, i) => (
                        <Cell key={d.process} fill={['#2563eb', '#16a37e', '#f97316', '#7c3aed', '#ef4444'][i % 5]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1.5 }}>Top Subcontractors (Order Value)</Typography>
              <Stack spacing={1.5}>
                {TOP_SUBCONTRACTORS.map((s) => (
                  <Box key={s.name}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{s.name}</Typography>
                      <Typography variant="caption" fontWeight={700}>{s.value}L</Typography>
                    </Stack>
                    <Box sx={{ height: 8, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${(s.value / TOP_SUBCONTRACTORS[0].value) * 100}%`, bgcolor: s.color, borderRadius: 4 }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main" sx={{ mb: 1 }}>Monthly Trend (Order Value)</Typography>
              <Box sx={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MONTHLY_TREND} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}L`} />
                    <RTooltip formatter={(v) => [`${v}L`, 'Value']} />
                    <Area type="monotone" dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.15} strokeWidth={2} dot={{ r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
