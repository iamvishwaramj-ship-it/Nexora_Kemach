import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, Table, TableHead, TableBody, TableRow, TableCell, Chip,
} from '@mui/material';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RTooltip, Legend,
  BarChart, CartesianGrid, XAxis, YAxis, Bar,
} from 'recharts';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import EntityHeaderCard from '../../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Reports" dashboard under Production Execution
// > Subcontracting, modelled on the sibling Production Execution > Reports
// dashboard (category cards + an overview panel). No reference screenshots
// were supplied for this request. Unlike the 9 Production Execution report
// categories (which each got a dedicated drill-down screen in an earlier
// part of this project), none of these categories were asked for as
// separate screens here, so every card currently shows the same overview
// panel highlighted -- matching the original pre-drill-down state of the
// Production Execution Reports page before those screens existed. Dedicated
// drill-down screens can be added the same way (one file + a
// CATEGORY_ROUTES-style map) if asked for later.
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: 'overview', label: 'Subcontracting Overview', icon: AssessmentOutlinedIcon },
  { key: 'order', label: 'Subcontract Order Report', icon: AssignmentOutlinedIcon },
  { key: 'issue', label: 'Material Issue Report', icon: OutboxOutlinedIcon },
  { key: 'inward', label: 'Inward & Inspection Report', icon: MoveToInboxOutlinedIcon },
  { key: 'vendor', label: 'Vendor Performance Report', icon: GroupsOutlinedIcon },
  { key: 'billing', label: 'Billing & Payment Report', icon: ReceiptLongOutlinedIcon },
  { key: 'cost', label: 'Subcontracting Cost Analysis', icon: PaymentsOutlinedIcon },
];

const STATUS_PIE = [
  { name: 'Open', value: 8, color: '#1976d2' },
  { name: 'Partially Issued', value: 5, color: '#f9a825' },
  { name: 'Partially Received', value: 3, color: '#0288d1' },
  { name: 'Closed', value: 12, color: '#2e7d32' },
];
const STATUS_TOTAL = STATUS_PIE.reduce((s, d) => s + d.value, 0);

const VENDOR_SPEND = [
  { vendor: 'Precision Platers', value: 285000 },
  { vendor: 'Shree Heat Treat.', value: 198000 },
  { vendor: 'Apex Coatings', value: 164000 },
  { vendor: 'Sun Plating', value: 121000 },
  { vendor: 'Metro Surface', value: 74000 },
];

const PROCESS_SPEND = [
  { name: 'Electroplating', value: 285000, color: '#1976d2' },
  { name: 'Heat Treatment', value: 198000, color: '#f9a825' },
  { name: 'Powder Coating', value: 164000, color: '#2e7d32' },
  { name: 'Zinc Plating', value: 121000, color: '#9c27b0' },
  { name: 'Anodizing', value: 74000, color: '#0288d1' },
];

const RECENT_BILLS = [
  { no: 'SCB-2026-051', date: '08-Oct-2026', vendor: 'Apex Coatings Ltd', amount: 174000, status: 'Pending Approval' },
  { no: 'SCB-2026-050', date: '05-Oct-2026', vendor: 'Sun Plating Industries', amount: 87500, status: 'Approved' },
  { no: 'SCB-2026-049', date: '03-Oct-2026', vendor: 'Metro Surface Finishers', amount: 212000, status: 'Paid' },
];

const STATUS_COLOR = { 'Pending Approval': 'warning', Approved: 'info', Paid: 'success' };

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function SubcontractingReports() {
  const [category, setCategory] = useState('overview');

  return (
    <Box>
      <EntityHeaderCard
        icon={<AssessmentOutlinedIcon />}
        title="Subcontracting Reports"
        subtitle="Analyse subcontract orders, material movement, vendor performance and billing."
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const active = category === c.key;
          return (
            <Grid item xs={12} sm={6} md={3} key={c.key}>
              <Card
                variant="outlined"
                onClick={() => setCategory(c.key)}
                sx={{
                  cursor: 'pointer', height: '100%',
                  borderColor: active ? 'primary.main' : 'divider',
                  bgcolor: active ? 'primary.lighter' : 'background.paper',
                }}
              >
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1 }}>
                  <Icon sx={{ fontSize: 28, color: active ? 'primary.main' : 'text.secondary' }} />
                  <Typography variant="body2" fontWeight={600}>{c.label}</Typography>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {category !== 'overview' && (
        <Card variant="outlined" sx={{ mb: 2 }}>
          <CardContent sx={{ py: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {CATEGORIES.find((c) => c.key === category)?.label} has not been built as a dedicated drill-down screen yet.
              Showing the Subcontracting Overview below in the meantime.
            </Typography>
          </CardContent>
        </Card>
      )}

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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Vendor-wise Spend</Typography>
              <Box sx={{ width: '100%', height: 220 }}>
                <ResponsiveContainer>
                  <BarChart data={VENDOR_SPEND} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tickFormatter={(v) => `${Math.round(v / 1000)}K`} />
                    <YAxis type="category" dataKey="vendor" width={110} tick={{ fontSize: 10 }} />
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
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Spend by Process</Typography>
              <Stack direction="row" spacing={2} alignItems="center">
                <Box sx={{ width: 140, height: 140, flexShrink: 0 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={PROCESS_SPEND} dataKey="value" nameKey="name" innerRadius={0} outerRadius={66}>
                        {PROCESS_SPEND.map((s) => <Cell key={s.name} fill={s.color} />)}
                      </Pie>
                      <RTooltip formatter={(v) => `₹ ${numberFmt(v)}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
                <Stack spacing={0.75}>
                  {PROCESS_SPEND.map((s) => (
                    <Stack key={s.name} direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                      <Typography variant="caption" color="text.secondary">{s.name}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.5 }}>Recent Subcontract Bills</Typography>
          <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 720px), 240px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Bill No.</TableCell>
                  <TableCell>Bill Date</TableCell>
                  <TableCell>Vendor</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {RECENT_BILLS.map((b) => (
                  <TableRow key={b.no} hover>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{b.no}</Typography></TableCell>
                    <TableCell>{b.date}</TableCell>
                    <TableCell>{b.vendor}</TableCell>
                    <TableCell align="right">₹ {numberFmt(b.amount)}</TableCell>
                    <TableCell><Chip size="small" label={b.status} color={STATUS_COLOR[b.status] || 'default'} /></TableCell>
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
