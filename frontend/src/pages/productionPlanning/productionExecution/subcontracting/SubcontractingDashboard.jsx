import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Button, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, LinearProgress,
} from '@mui/material';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend,
  ComposedChart, CartesianGrid, XAxis, YAxis, Bar, Line, BarChart,
} from 'recharts';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import AddIcon from '@mui/icons-material/Add';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ScrollableTableContainer from '../../../../components/data-display/ScrollableTableContainer';
import EntityHeaderCard from '../../../../components/common/EntityHeaderCard';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Subcontracting - Dashboard" screen. The user
// asked for a new "Subcontracting" grouped submenu under Production
// Execution (Dashboard, Subcontract Orders, New Subcontracting Order,
// Material Issue to Subcon, New Issue, Subcontract Inward, New Inward,
// Quality Inspection, New Inspection, Subcontract Bills, New Bill, Reports)
// but supplied no reference screenshots for it, unlike every other screen
// built earlier in this project. This was therefore designed from scratch,
// following the same visual language (EntityHeaderCard, stat tiles,
// recharts, MUI Table) already used throughout Production Execution, rather
// than matched pixel-for-pixel against an image. There is no Subcontracting
// data model in this schema, so everything here is fixed mock data; nothing
// persists or calls the server.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Active Subcontract Orders', value: '18', icon: AssignmentOutlinedIcon, color: 'primary' },
  { label: 'Material Pending Issue', value: '6', icon: OutboxOutlinedIcon, color: 'warning' },
  { label: 'Inward Pending Inspection', value: '4', icon: MoveToInboxOutlinedIcon, color: 'info' },
  { label: 'Quality Rejections (MTD)', value: '2', icon: WarningAmberOutlinedIcon, color: 'error' },
  { label: 'Bills Pending Approval', value: '5', icon: ReceiptLongOutlinedIcon, color: 'secondary' },
  { label: 'Subcontract Value (MTD)', value: '₹ 8,42,000', icon: PrecisionManufacturingIcon, color: 'success' },
];

const STATUS_PIE = [
  { name: 'Open', value: 8, color: '#1976d2' },
  { name: 'Partially Issued', value: 5, color: '#f9a825' },
  { name: 'Partially Received', value: 3, color: '#0288d1' },
  { name: 'Closed', value: 12, color: '#2e7d32' },
];
const STATUS_TOTAL = STATUS_PIE.reduce((s, d) => s + d.value, 0);

const VENDOR_SPEND = [
  { vendor: 'Precision Platers Pvt Ltd', value: 285000 },
  { vendor: 'Shree Heat Treatment Works', value: 198000 },
  { vendor: 'Apex Coatings Ltd', value: 164000 },
  { vendor: 'Sun Plating Industries', value: 121000 },
  { vendor: 'Metro Surface Finishers', value: 74000 },
];

const ISSUE_INWARD_TREND = [
  { month: 'May', issued: 42000, received: 38000 },
  { month: 'Jun', issued: 51000, received: 46000 },
  { month: 'Jul', issued: 47000, received: 45000 },
  { month: 'Aug', issued: 60000, received: 52000 },
  { month: 'Sep', issued: 55000, received: 58000 },
  { month: 'Oct', issued: 38000, received: 29000 },
];

const RECENT_ORDERS = [
  { no: 'SC-2026-014', date: '05-Oct-2026', vendor: 'Precision Platers Pvt Ltd', item: 'FG-1001 - Gear Housing', qty: 200, status: 'Open' },
  { no: 'SC-2026-013', date: '03-Oct-2026', vendor: 'Shree Heat Treatment Works', item: 'FG-1004 - Shaft', qty: 350, status: 'Partially Issued' },
  { no: 'SC-2026-012', date: '02-Oct-2026', vendor: 'Apex Coatings Ltd', item: 'FG-1002 - Cover Plate', qty: 500, status: 'Partially Received' },
  { no: 'SC-2026-011', date: '29-Sep-2026', vendor: 'Sun Plating Industries', item: 'FG-1006 - Bracket', qty: 150, status: 'Closed' },
  { no: 'SC-2026-010', date: '27-Sep-2026', vendor: 'Metro Surface Finishers', item: 'FG-1001 - Gear Housing', qty: 400, status: 'Closed' },
];

const STATUS_COLOR = { Open: 'primary', 'Partially Issued': 'warning', 'Partially Received': 'info', Closed: 'success' };

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function SubcontractingDashboard() {
  const navigate = useNavigate();

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/subcontracting/new-subcontracting-order')}>
        New Subcontracting Order
      </Button>
      <Button variant="outlined" onClick={() => navigate('/production-execution/subcontracting/subcontract-orders')}>
        View All Orders
      </Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<PrecisionManufacturingIcon />}
        title="Subcontracting"
        subtitle="Track subcontract orders, material issued to vendors, inward receipts, quality inspection and vendor billing."
        rightContent={headerActions}
      />

      {/* Summary tiles */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {SUMMARY_TILES.map((s) => {
          const Icon = s.icon;
          return (
            <Grid item xs={12} sm={6} md={4} lg={2} key={s.label}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{
                      width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: `${s.color}.lighter`, color: `${s.color}.main`, flexShrink: 0,
                    }}>
                      <Icon fontSize="small" />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{s.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Charts row */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Order Status Split</Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={STATUS_PIE} dataKey="value" nameKey="name" innerRadius={44} outerRadius={66} paddingAngle={2}>
                        {STATUS_PIE.map((s) => <Cell key={s.name} fill={s.color} />)}
                      </Pie>
                      <RTooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography variant="body2" fontWeight={700}>{STATUS_TOTAL}</Typography>
                  </Box>
                </Box>
                <Stack spacing={0.75}>
                  {STATUS_PIE.map((s) => (
                    <Stack key={s.name} direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                      <Typography variant="caption" color="text.secondary">{s.name} : {s.value}</Typography>
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Vendor-wise Subcontract Spend</Typography>
              <Box sx={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={VENDOR_SPEND} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                    <YAxis type="category" dataKey="vendor" width={130} tick={{ fontSize: 10 }} />
                    <RTooltip formatter={(v) => `₹ ${numberFmt(v)}`} />
                    <Bar dataKey="value" fill="#1976d2" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Material Issued vs Received</Typography>
              <Box sx={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <ComposedChart data={ISSUE_INWARD_TREND}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}K`} tick={{ fontSize: 11 }} />
                    <RTooltip formatter={(v) => `₹ ${numberFmt(v)}`} />
                    <Legend />
                    <Bar dataKey="issued" name="Issued Value" fill="#f9a825" radius={[4, 4, 0, 0]} />
                    <Line type="monotone" dataKey="received" name="Received Value" stroke="#2e7d32" strokeWidth={2} />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent orders */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Recent Subcontract Orders</Typography>
            <Button size="small" onClick={() => navigate('/production-execution/subcontracting/subcontract-orders')}>View All</Button>
          </Stack>
          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 680px), 300px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Subcontract Order No.</TableCell>
                  <TableCell>Order Date</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell>Item</TableCell>
                  <TableCell align="right">Qty</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {RECENT_ORDERS.map((o) => (
                  <TableRow key={o.no} hover>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{o.no}</Typography></TableCell>
                    <TableCell>{o.date}</TableCell>
                    <TableCell>{o.vendor}</TableCell>
                    <TableCell>{o.item}</TableCell>
                    <TableCell align="right">{numberFmt(o.qty)}</TableCell>
                    <TableCell><Chip size="small" label={o.status} color={STATUS_COLOR[o.status] || 'default'} /></TableCell>
                    <TableCell>
                      <Button size="small" endIcon={<KeyboardArrowDownIcon />} onClick={() => navigate('/production-execution/subcontracting/subcontract-orders')}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
