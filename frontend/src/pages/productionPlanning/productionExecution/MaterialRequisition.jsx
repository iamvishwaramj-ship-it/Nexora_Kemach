import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Menu,
  LinearProgress,
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import DoneIcon from '@mui/icons-material/Done';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Material Requisition" list screen, built to
// match the reference design the user supplied for the Production
// Execution > Material Requisition submenu. Same convention as the other
// Production Execution screens (Production Orders, View Order, Operations):
// there is no MaterialRequisition data model in this schema, so this lays
// out the screen exactly as designed with fixed mock data rather than
// fabricating "real" records against tables that don't exist. Local state
// only -- nothing here persists or calls the server.
// ---------------------------------------------------------------------------

const STATUS_META = {
  Approved: { color: 'success' },
  'Partially Issued': { color: 'info' },
  Issued: { color: 'info' },
  Pending: { color: 'warning' },
  Rejected: { color: 'error' },
};

const PRIORITY_META = {
  High: { color: 'error' },
  Medium: { color: 'warning' },
  Low: { color: 'info' },
};

const REQUISITIONS = [
  { no: 'MR-2026-001', date: '01-Oct-2026', type: 'Production', po: 'PO-2026-001', dept: 'Production', requestedBy: 'Mani', requiredDate: '02-Oct-2026', status: 'Approved', priority: 'High' },
  { no: 'MR-2026-002', date: '01-Oct-2026', type: 'Production', po: 'PO-2026-002', dept: 'Production', requestedBy: 'Dheena S', requiredDate: '03-Oct-2026', status: 'Partially Issued', priority: 'High' },
  { no: 'MR-2026-003', date: '02-Oct-2026', type: 'Production', po: 'PO-2026-003', dept: 'Production', requestedBy: 'Arunkumar', requiredDate: '04-Oct-2026', status: 'Pending', priority: 'Medium' },
  { no: 'MR-2026-004', date: '02-Oct-2026', type: 'Maintenance', po: '-', dept: 'Maintenance', requestedBy: 'Mani', requiredDate: '04-Oct-2026', status: 'Approved', priority: 'Medium' },
  { no: 'MR-2026-005', date: '03-Oct-2026', type: 'Production', po: 'PO-2026-004', dept: 'Production', requestedBy: 'Dheena S', requiredDate: '05-Oct-2026', status: 'Issued', priority: 'High' },
  { no: 'MR-2026-006', date: '03-Oct-2026', type: 'Tooling', po: '-', dept: 'Tool Room', requestedBy: 'Kannan P', requiredDate: '05-Oct-2026', status: 'Approved', priority: 'Low' },
  { no: 'MR-2026-007', date: '04-Oct-2026', type: 'Production', po: 'PO-2026-005', dept: 'Production', requestedBy: 'Mani', requiredDate: '06-Oct-2026', status: 'Pending', priority: 'High' },
  { no: 'MR-2026-008', date: '04-Oct-2026', type: 'Quality', po: '-', dept: 'Quality', requestedBy: 'Arunkumar', requiredDate: '06-Oct-2026', status: 'Rejected', priority: 'Low' },
  { no: 'MR-2026-009', date: '05-Oct-2026', type: 'Production', po: 'PO-2026-006', dept: 'Production', requestedBy: 'Dheena S', requiredDate: '07-Oct-2026', status: 'Approved', priority: 'Medium' },
  { no: 'MR-2026-010', date: '05-Oct-2026', type: 'Maintenance', po: '-', dept: 'Maintenance', requestedBy: 'Mani', requiredDate: '07-Oct-2026', status: 'Pending', priority: 'Medium' },
];

const TOTAL_RECORDS = 12; // cosmetic -- matches "Showing 1 to 10 of 12 records"; only page 1's 10 rows are mocked.

const STATUS_SUMMARY = [
  { label: 'Approved', value: 4, color: '#2e7d32' },
  { label: 'Partially Issued', value: 1, color: '#1976d2' },
  { label: 'Issued', value: 1, color: '#0288d1' },
  { label: 'Pending', value: 4, color: '#f9a825' },
  { label: 'Rejected', value: 1, color: '#d32f2f' },
];

const TYPE_SUMMARY = [
  { label: 'Production', value: 8, max: 12 },
  { label: 'Maintenance', value: 2, max: 12 },
  { label: 'Tooling', value: 1, max: 12 },
  { label: 'Quality', value: 1, max: 12 },
];

const PRIORITY_SUMMARY = [
  { label: 'High', value: 4, max: 12, color: 'error' },
  { label: 'Medium', value: 5, max: 12, color: 'warning' },
  { label: 'Low', value: 3, max: 12, color: 'info' },
];

function RowActionMenu() {
  const [anchorEl, setAnchorEl] = useState(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={() => setAnchorEl(null)}><DoneIcon fontSize="small" sx={{ mr: 1 }} /> Approve</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}><OutboxOutlinedIcon fontSize="small" sx={{ mr: 1 }} /> Issue Material</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}><DeleteOutlineIcon fontSize="small" sx={{ mr: 1 }} /> Reject</MenuItem>
      </Menu>
    </>
  );
}

export default function MaterialRequisition() {
  const navigate = useNavigate();
  const [requisitionNo, setRequisitionNo] = useState('');
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [status, setStatus] = useState('All');
  const [requisitionType, setRequisitionType] = useState('All');
  const [requestedBy, setRequestedBy] = useState('All');
  const [productionOrder, setProductionOrder] = useState('');
  const [department, setDepartment] = useState('All');
  const [priority, setPriority] = useState('All');

  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/create-requisition')}>
        Create Requisition
      </Button>
      <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
      <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<DescriptionOutlinedIcon />}
        title="Material Requisition"
        subtitle="Create, view and manage material requisitions for production, maintenance and other departments."
        rightContent={headerActions}
      />

      {/* Search / Filter */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Search / Filter</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Requisition No." placeholder="Search..."
                value={requisitionNo} onChange={(e) => setRequisitionNo(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" type="date" label="From Date"
                value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" type="date" label="To Date"
                value={toDate} onChange={(e) => setToDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Partially Issued">Partially Issued</MenuItem>
                <MenuItem value="Issued">Issued</MenuItem>
                <MenuItem value="Pending">Pending</MenuItem>
                <MenuItem value="Rejected">Rejected</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Requisition Type" value={requisitionType} onChange={(e) => setRequisitionType(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Production">Production</MenuItem>
                <MenuItem value="Maintenance">Maintenance</MenuItem>
                <MenuItem value="Tooling">Tooling</MenuItem>
                <MenuItem value="Quality">Quality</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Requested By" value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Mani">Mani</MenuItem>
                <MenuItem value="Dheena S">Dheena S</MenuItem>
                <MenuItem value="Arunkumar">Arunkumar</MenuItem>
                <MenuItem value="Kannan P">Kannan P</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Production Order" placeholder="Search PO..."
                value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Production">Production</MenuItem>
                <MenuItem value="Maintenance">Maintenance</MenuItem>
                <MenuItem value="Tool Room">Tool Room</MenuItem>
                <MenuItem value="Quality">Quality</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="High">High</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Low">Low</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 2.5 }}>
            <Button variant="outlined">Reset</Button>
            <Button variant="contained" startIcon={<SearchIcon />}>Search</Button>
          </Stack>
        </CardContent>
      </Card>

      {/* List + summary */}
      <Grid container spacing={2}>
        <Grid item xs={12} lg={8.5}>
          <Card variant="outlined">
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Material Requisition List ({TOTAL_RECORDS})</Typography>
            </Stack>

            <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 560px), 460px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>S.No</TableCell>
                    <TableCell>Requisition No.</TableCell>
                    <TableCell>Requisition Date</TableCell>
                    <TableCell>Requisition Type</TableCell>
                    <TableCell>Production Order</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Requested By</TableCell>
                    <TableCell>Required Date</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Priority</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {REQUISITIONS.map((r, idx) => (
                    <TableRow key={r.no} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checked.has(r.no)} onChange={() => toggleRow(r.no)} />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.no}</Typography></TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell>{r.type}</TableCell>
                      <TableCell>
                        {r.po !== '-' ? <Typography variant="body2" color="primary.main" fontWeight={600}>{r.po}</Typography> : '-'}
                      </TableCell>
                      <TableCell>{r.dept}</TableCell>
                      <TableCell>{r.requestedBy}</TableCell>
                      <TableCell>{r.requiredDate}</TableCell>
                      <TableCell>
                        <Chip size="small" label={r.status} color={STATUS_META[r.status]?.color || 'default'} />
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={r.priority} color={PRIORITY_META[r.priority]?.color || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.25}>
                          <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                          <IconButton size="small"><EditOutlinedIcon fontSize="small" /></IconButton>
                          <RowActionMenu />
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollableTableContainer>

            <EntityListPagination
              total={TOTAL_RECORDS}
              page={page}
              onChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
            />
          </Card>
        </Grid>

        {/* Right rail: summaries */}
        <Grid item xs={12} lg={3.5}>
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Requisition Summary</Typography>
              <Stack direction="row" spacing={2.5} alignItems="center">
                <Box sx={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={STATUS_SUMMARY} dataKey="value" nameKey="label"
                        innerRadius={36} outerRadius={56} paddingAngle={2}
                      >
                        {STATUS_SUMMARY.map((s) => <Cell key={s.label} fill={s.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <Box sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Typography variant="h6" fontWeight={700}>{TOTAL_RECORDS}</Typography>
                    <Typography variant="caption" color="text.secondary">Total</Typography>
                  </Box>
                </Box>
                <Stack spacing={0.75}>
                  {STATUS_SUMMARY.map((s) => (
                    <Stack key={s.label} direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.color }} />
                        <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                      </Stack>
                      <Typography variant="caption" fontWeight={700}>: {s.value}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Requisition Type Summary</Typography>
              <Stack spacing={1.5}>
                {TYPE_SUMMARY.map((t) => (
                  <Box key={t.label}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{t.label}</Typography>
                      <Typography variant="caption" fontWeight={700}>: {t.value}</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate" value={(t.value / t.max) * 100}
                      sx={{ height: 7, borderRadius: 4 }}
                    />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Priority Wise Summary</Typography>
              <Stack spacing={1.5}>
                {PRIORITY_SUMMARY.map((p) => (
                  <Box key={p.label}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{p.label}</Typography>
                      <Typography variant="caption" fontWeight={700}>: {p.value}</Typography>
                    </Stack>
                    <LinearProgress
                      variant="determinate" value={(p.value / p.max) * 100} color={p.color}
                      sx={{ height: 7, borderRadius: 4 }}
                    />
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
