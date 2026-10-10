import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Checkbox, Pagination,
} from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > 8D Management" -- static UI-only mock built to match the
// reference screenshot the user supplied. "New 8D" opens the New 8D create
// screen (pages/quality/NewEightD.jsx). Fixed mock data only -- nothing
// persists or calls the server.
// ---------------------------------------------------------------------------

const SUMMARY_TILES = [
  { label: 'Total 8D Cases', value: '12', icon: AssignmentOutlinedIcon, color: 'primary' },
  { label: 'Open / In Progress', value: '6', icon: AutorenewIcon, color: 'success' },
  { label: 'Closed', value: '4', icon: CheckCircleOutlineIcon, color: 'info' },
  { label: 'Overdue', value: '2', icon: ErrorOutlineIcon, color: 'error' },
  { label: 'High Priority', value: '3', icon: FlagOutlinedIcon, color: 'warning' },
];

const EIGHT_D_TYPES = ['All', 'Customer Complaint', 'Internal', 'Supplier Issue'];
const SOURCES = ['All', 'Customer', 'Internal', 'Supplier'];
const CUSTOMERS_SUPPLIERS = ['All', 'ABC Industries', 'XYZ Castings', 'DEF Motors', 'GHI Auto', 'JKL Forge', 'MNO Pumps', 'PQR Steel'];
const PRIORITIES = ['All', 'High', 'Medium', 'Low'];
const STATUSES = ['All', 'Open', 'In Progress', 'Closed', 'Overdue'];

const EIGHT_D_ROWS = [
  { no: 1, id: '8D-2026-0001', type: 'Customer Complaint', party: 'ABC Industries', itemCode: 'FG-001', itemName: 'Gear Housing', complaintDate: '25-Sep-2026', targetDate: '25-Oct-2026', priority: 'High', status: 'In Progress', step: 'D2' },
  { no: 2, id: '8D-2026-0002', type: 'Internal', party: '-', itemCode: 'RM-001', itemName: 'Steel Plate', complaintDate: '20-Sep-2026', targetDate: '10-Oct-2026', priority: 'Medium', status: 'Open', step: 'D1' },
  { no: 3, id: '8D-2026-0003', type: 'Supplier Issue', party: 'XYZ Castings', itemCode: 'CI-001', itemName: 'Cast Housing', complaintDate: '18-Sep-2026', targetDate: '08-Oct-2026', priority: 'High', status: 'In Progress', step: 'D4' },
  { no: 4, id: '8D-2026-0004', type: 'Customer Complaint', party: 'DEF Motors', itemCode: 'FG-002', itemName: 'Shaft', complaintDate: '15-Sep-2026', targetDate: '05-Oct-2026', priority: 'Medium', status: 'Closed', step: 'D8' },
  { no: 5, id: '8D-2026-0005', type: 'Internal', party: '-', itemCode: 'FG-003', itemName: 'Cover Plate', complaintDate: '10-Sep-2026', targetDate: '30-Sep-2026', priority: 'Low', status: 'Closed', step: 'D8' },
  { no: 6, id: '8D-2026-0006', type: 'Customer Complaint', party: 'GHI Auto', itemCode: 'FG-004', itemName: 'Bracket', complaintDate: '08-Sep-2026', targetDate: '28-Sep-2026', priority: 'High', status: 'Overdue', step: 'D5' },
  { no: 7, id: '8D-2026-0007', type: 'Supplier Issue', party: 'JKL Forge', itemCode: 'RM-002', itemName: 'Forging', complaintDate: '05-Sep-2026', targetDate: '25-Sep-2026', priority: 'Medium', status: 'In Progress', step: 'D3' },
  { no: 8, id: '8D-2026-0008', type: 'Internal', party: '-', itemCode: 'FG-005', itemName: 'Flange', complaintDate: '02-Sep-2026', targetDate: '22-Sep-2026', priority: 'Low', status: 'Open', step: 'D1' },
  { no: 9, id: '8D-2026-0009', type: 'Customer Complaint', party: 'MNO Pumps', itemCode: 'FG-006', itemName: 'Impeller', complaintDate: '01-Sep-2026', targetDate: '20-Sep-2026', priority: 'Medium', status: 'Overdue', step: 'D6' },
  { no: 10, id: '8D-2026-0010', type: 'Supplier Issue', party: 'PQR Steel', itemCode: 'RM-003', itemName: 'Round Bar', complaintDate: '28-Aug-2026', targetDate: '18-Sep-2026', priority: 'Low', status: 'Closed', step: 'D8' },
];

const PRIORITY_COLOR = { High: 'error', Medium: 'warning', Low: 'success' };
const STATUS_COLOR = { Open: 'info', 'In Progress': 'warning', Closed: 'success', Overdue: 'error' };

export default function EightDManagement() {
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState('01-Sep-2026');
  const [toDate, setToDate] = useState('30-Sep-2026');
  const [eightDType, setEightDType] = useState('All');
  const [source, setSource] = useState('All');
  const [customerSupplier, setCustomerSupplier] = useState('All');
  const [priority, setPriority] = useState('All');
  const [status, setStatus] = useState('All');
  const [itemCode, setItemCode] = useState('');
  const [eightDNo, setEightDNo] = useState('');
  const [keyword, setKeyword] = useState('');

  const [checked, setChecked] = useState(() => new Set());
  const toggleAll = () => {
    setChecked((prev) => (prev.size === EIGHT_D_ROWS.length ? new Set() : new Set(EIGHT_D_ROWS.map((r) => r.no))));
  };
  const toggleOne = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const headerRight = (
    <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/quality/new-8d')}>New 8D</Button>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<FactCheckOutlinedIcon />}
        title="8D Management"
        subtitle="Manage and track 8D problem solving for internal, customer or supplier quality issues."
        rightContent={headerRight}
      />

      {/* Summary Tiles */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {SUMMARY_TILES.map((t) => {
          const Icon = t.icon;
          return (
            <Grid item xs={6} sm={4} md={2.4} key={t.label}>
              <Card variant="outlined" sx={{ height: '100%' }}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2.5 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${t.color}.lighter`, color: `${t.color}.main` }}>
                    <Icon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography variant="h5" fontWeight={700} lineHeight={1.2}>{t.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{t.label}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      {/* Filter Criteria */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="flex-end">
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="From Date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="To Date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="8D Type" value={eightDType} onChange={(e) => setEightDType(e.target.value)}>
                {EIGHT_D_TYPES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Source" value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Customer / Supplier" value={customerSupplier} onChange={(e) => setCustomerSupplier(e.target.value)}>
                {CUSTOMERS_SUPPLIERS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {PRIORITIES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Item Code" placeholder="Search Item..." value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="8D No." placeholder="Search 8D No..." value={eightDNo} onChange={(e) => setEightDNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Keyword" placeholder="Search Problem Description..." value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1.25}>
                <Button variant="contained" startIcon={<SearchIcon />}>Search</Button>
                <Button variant="outlined">Clear</Button>
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 8D List */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ListAltOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>8D List ({EIGHT_D_ROWS.length} records)</Typography>
            </Stack>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <TextField size="small" select label="Records per page" value="10" sx={{ width: 160 }}>
                <MenuItem value="10">10</MenuItem>
                <MenuItem value="25">25</MenuItem>
                <MenuItem value="50">50</MenuItem>
              </TextField>
              <Button variant="outlined" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
            </Stack>
          </Stack>
          <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 620px), 480px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={checked.size === EIGHT_D_ROWS.length}
                      indeterminate={checked.size > 0 && checked.size < EIGHT_D_ROWS.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>8D No.</TableCell>
                  <TableCell>8D Type</TableCell>
                  <TableCell>Customer / Supplier</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>Complaint Date</TableCell>
                  <TableCell>Target Date</TableCell>
                  <TableCell>Priority</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Current D-Step</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {EIGHT_D_ROWS.map((r) => (
                  <TableRow key={r.no} hover selected={checked.has(r.no)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(r.no)} onChange={() => toggleOne(r.no)} />
                    </TableCell>
                    <TableCell>{r.no}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary.main" fontWeight={600}>{r.id}</Typography>
                    </TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.party}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary.main" fontWeight={600}>{r.itemCode}</Typography>
                    </TableCell>
                    <TableCell>{r.itemName}</TableCell>
                    <TableCell>{r.complaintDate}</TableCell>
                    <TableCell>{r.targetDate}</TableCell>
                    <TableCell><Chip size="small" label={r.priority} color={PRIORITY_COLOR[r.priority] || 'default'} /></TableCell>
                    <TableCell><Chip size="small" label={r.status} color={STATUS_COLOR[r.status] || 'default'} /></TableCell>
                    <TableCell>{r.step}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.25}>
                        <IconButton size="small" color="primary"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="primary"><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>

          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">Showing 1 to 10 of 12 records</Typography>
            <Pagination count={2} page={1} color="primary" shape="rounded" />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
