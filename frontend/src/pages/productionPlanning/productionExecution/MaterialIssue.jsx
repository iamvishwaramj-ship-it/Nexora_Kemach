import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Menu,
} from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Material Issue" list screen, built to match
// the reference design the user supplied for the Production Execution >
// Material Issue submenu. Same convention as the other Production
// Execution list screens (Production Orders, Material Requisition): there
// is no MaterialIssue data model in this schema, so this lays out the
// screen exactly as designed with fixed mock data rather than fabricating
// "real" records against tables that don't exist. Local state only --
// nothing here persists or calls the server. The right-rail summary
// numbers are fixed to match the reference screenshot exactly rather than
// being derived from the 10 mock rows (the reference screenshot's own
// per-department total doesn't tie out to its row list either, so this
// keeps the same static-mock convention established for Product Cost
// History rather than inventing different numbers that would disagree
// with what was asked for).
// ---------------------------------------------------------------------------

const STATUS_META = {
  Issued: { color: 'success' },
  'Partially Issued': { color: 'info' },
  Draft: { color: 'default' },
  Cancelled: { color: 'error' },
};

const ISSUES = [
  { no: 'MI-2026-001', date: '01-Oct-2026', po: 'PO-2026-001', mr: 'MR-2026-001', dept: 'Production', workCenter: 'WC-01', issuedBy: 'Mani', status: 'Issued', remarks: 'For Start' },
  { no: 'MI-2026-002', date: '01-Oct-2026', po: 'PO-2026-002', mr: 'MR-2026-002', dept: 'Production', workCenter: 'WC-02', issuedBy: 'Dheena S', status: 'Issued', remarks: 'Assembly' },
  { no: 'MI-2026-003', date: '02-Oct-2026', po: 'PO-2026-003', mr: 'MR-2026-003', dept: 'Production', workCenter: 'WC-03', issuedBy: 'Arunkumar', status: 'Partially Issued', remarks: 'Balance pending' },
  { no: 'MI-2026-004', date: '02-Oct-2026', po: 'PO-2026-004', mr: 'MR-2026-004', dept: 'Maintenance', workCenter: 'WC-01', issuedBy: 'Mani', status: 'Issued', remarks: 'Maintenance' },
  { no: 'MI-2026-005', date: '03-Oct-2026', po: 'PO-2026-005', mr: 'MR-2026-005', dept: 'Production', workCenter: 'WC-02', issuedBy: 'Kannan P', status: 'Draft', remarks: 'Review pending' },
  { no: 'MI-2026-006', date: '03-Oct-2026', po: 'PO-2026-006', mr: 'MR-2026-006', dept: 'Production', workCenter: 'WC-01', issuedBy: 'Mani', status: 'Issued', remarks: 'For machining' },
  { no: 'MI-2026-007', date: '04-Oct-2026', po: 'PO-2026-007', mr: 'MR-2026-007', dept: 'Quality', workCenter: 'WC-03', issuedBy: 'Dheena S', status: 'Cancelled', remarks: 'Order cancelled' },
  { no: 'MI-2026-008', date: '04-Oct-2026', po: 'PO-2026-008', mr: 'MR-2026-008', dept: 'Production', workCenter: 'WC-02', issuedBy: 'Arunkumar', status: 'Issued', remarks: 'As per plan' },
  { no: 'MI-2026-009', date: '05-Oct-2026', po: 'PO-2026-009', mr: 'MR-2026-009', dept: 'Production', workCenter: 'WC-01', issuedBy: 'Mani', status: 'Partially Issued', remarks: 'Balance tomorrow' },
  { no: 'MI-2026-010', date: '05-Oct-2026', po: 'PO-2026-010', mr: 'MR-2026-010', dept: 'Production', workCenter: 'WC-03', issuedBy: 'Kannan P', status: 'Issued', remarks: 'Urgent' },
];

const TOTAL_RECORDS = 10;

const STATUS_SUMMARY = [
  { label: 'Issued', value: 6, color: '#2e7d32' },
  { label: 'Partially Issued', value: 2, color: '#1976d2' },
  { label: 'Draft', value: 1, color: '#9e9e9e' },
  { label: 'Cancelled', value: 1, color: '#d32f2f' },
];

const DEPARTMENT_SUMMARY = [
  { label: 'Production', value: 7, max: 10 },
  { label: 'Maintenance', value: 1, max: 10 },
  { label: 'Quality', value: 1, max: 10 },
];

const TOP_ISSUED_ITEMS = [
  { label: 'Cast Iron', qty: 3200 },
  { label: 'Bearing 6205', qty: 1250 },
  { label: 'Gasket', qty: 800 },
  { label: 'Grease', qty: 750 },
  { label: 'Shaft', qty: 500 },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function RowActionMenu() {
  const [anchorEl, setAnchorEl] = useState(null);
  return (
    <>
      <IconButton size="small" onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget); }}>
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} onClick={(e) => e.stopPropagation()}>
        <MenuItem onClick={() => setAnchorEl(null)}>View Details</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Edit</MenuItem>
        <MenuItem onClick={() => setAnchorEl(null)}>Cancel Issue</MenuItem>
      </Menu>
    </>
  );
}

export default function MaterialIssue() {
  const navigate = useNavigate();
  const [issueNo, setIssueNo] = useState('');
  const [fromDate, setFromDate] = useState('2026-10-01');
  const [toDate, setToDate] = useState('2026-10-10');
  const [productionOrder, setProductionOrder] = useState('');
  const [materialRequisition, setMaterialRequisition] = useState('');
  const [department, setDepartment] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [status, setStatus] = useState('All');
  const [issuedBy, setIssuedBy] = useState('All');

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
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/create-issue')}>
        Create Issue
      </Button>
      <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
      <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<OutboxOutlinedIcon />}
        title="Material Issue"
        subtitle="Issue raw materials and components to production orders."
        rightContent={headerActions}
      />

      {/* Search / Filter */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Search / Filter</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Issue No." placeholder="Search..."
                value={issueNo} onChange={(e) => setIssueNo(e.target.value)}
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
              <TextField
                fullWidth size="small" label="Production Order" placeholder="Search PO..."
                value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Material Requisition" placeholder="Search MR..."
                value={materialRequisition} onChange={(e) => setMaterialRequisition(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Production">Production</MenuItem>
                <MenuItem value="Maintenance">Maintenance</MenuItem>
                <MenuItem value="Quality">Quality</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="WC-01">WC-01</MenuItem>
                <MenuItem value="WC-02">WC-02</MenuItem>
                <MenuItem value="WC-03">WC-03</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Issued">Issued</MenuItem>
                <MenuItem value="Partially Issued">Partially Issued</MenuItem>
                <MenuItem value="Draft">Draft</MenuItem>
                <MenuItem value="Cancelled">Cancelled</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Issued By" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)}>
                <MenuItem value="All">All</MenuItem>
                <MenuItem value="Mani">Mani</MenuItem>
                <MenuItem value="Dheena S">Dheena S</MenuItem>
                <MenuItem value="Arunkumar">Arunkumar</MenuItem>
                <MenuItem value="Kannan P">Kannan P</MenuItem>
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
              <Typography variant="subtitle1" fontWeight={700}>Material Issue List ({TOTAL_RECORDS})</Typography>
            </Stack>

            <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 560px), 460px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" />
                    <TableCell>S.No</TableCell>
                    <TableCell>Issue No.</TableCell>
                    <TableCell>Issue Date</TableCell>
                    <TableCell>Production Order</TableCell>
                    <TableCell>Material Requisition</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Work Center</TableCell>
                    <TableCell>Issued By</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Remarks</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ISSUES.map((r, idx) => (
                    <TableRow key={r.no} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checked.has(r.no)} onChange={() => toggleRow(r.no)} />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.no}</Typography></TableCell>
                      <TableCell>{r.date}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.po}</Typography></TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.mr}</Typography></TableCell>
                      <TableCell>{r.dept}</TableCell>
                      <TableCell>{r.workCenter}</TableCell>
                      <TableCell>{r.issuedBy}</TableCell>
                      <TableCell>
                        <Chip size="small" label={r.status} color={STATUS_META[r.status]?.color || 'default'} />
                      </TableCell>
                      <TableCell>{r.remarks}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.25}>
                          <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                          <IconButton size="small"><EditOutlinedIcon fontSize="small" /></IconButton>
                          <IconButton size="small"><PrintOutlinedIcon fontSize="small" /></IconButton>
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
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Material Issue Summary</Typography>
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
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Department Wise Issue</Typography>
              <Stack spacing={1.5}>
                {DEPARTMENT_SUMMARY.map((d) => (
                  <Box key={d.label}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                      <Typography variant="caption" color="text.secondary">{d.label}</Typography>
                      <Typography variant="caption" fontWeight={700}>: {d.value}</Typography>
                    </Stack>
                    <Box sx={{ height: 7, borderRadius: 4, bgcolor: 'action.hover', overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${(d.value / d.max) * 100}%`, bgcolor: 'primary.main' }} />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined">
            <CardContent>
              <Typography variant="body2" fontWeight={700} sx={{ mb: 1.5 }}>Top 5 Issued Items (Qty)</Typography>
              <Stack spacing={1.25}>
                {TOP_ISSUED_ITEMS.map((item, idx) => (
                  <Stack key={item.label} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2">{idx + 1}. {item.label}</Typography>
                    <Typography variant="body2" fontWeight={700}>{numberFmt(item.qty)}</Typography>
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom action bar */}
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mt: 2.5 }}>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>Back to List</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="contained" startIcon={<CheckCircleOutlineIcon />}>Approve</Button>
        <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />}>Cancel</Button>
        <Button variant="outlined" startIcon={<PrintOutlinedIcon />}>Print</Button>
        <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
      </Stack>
    </Box>
  );
}
