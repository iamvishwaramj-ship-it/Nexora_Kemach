import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Pagination,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Operation Master" list screen, built to
// match the reference screenshot the user supplied. Same convention as
// RoutingProcessMaster.jsx: fixed mock data only -- nothing persists or
// calls the server. Opens from New Routing / Process's "Add Operation"
// button; its own "New Operation" button opens the NewOperation screen.
// ---------------------------------------------------------------------------

const OPERATION_TYPES = ['All', 'Internal', 'Subcontract'];
const PROCESS_TYPES = ['All', 'Manufacturing', 'Quality', 'Surface Treatment'];
const WORK_CENTERS = ['All', 'WC-CUT-01', 'WC-TURN-01', 'WC-DR-01', 'WC-MILL-01', 'WC-DEB-01', 'WC-QC-01', 'WC-ASM-01', 'WC-QC-02', 'WC-PAINT-01', 'WC-PACK-01'];
const MACHINES = ['All', 'Laser Cutting', 'CNC Lathe', 'Radial Drill', 'VMC', 'Bench', 'Inspection Table', 'Assembly Line', 'Paint Booth', 'Packing Station'];
const STATUS_OPTIONS = ['All', 'Active', 'Inactive'];

const STATUS_COLOR = { Active: 'success', Inactive: 'error' };

const OPERATIONS = [
  { no: 1, opNo: 'OP-001', opName: 'Raw Material Cutting', processType: 'Manufacturing', stdTime: 30, workCenter: 'WC-CUT-01', machine: 'Laser Cutting', status: 'Active' },
  { no: 2, opNo: 'OP-002', opName: 'Machining - Turning', processType: 'Manufacturing', stdTime: 20, workCenter: 'WC-TURN-01', machine: 'CNC Lathe', status: 'Active' },
  { no: 3, opNo: 'OP-003', opName: 'Machining - Drilling', processType: 'Manufacturing', stdTime: 15, workCenter: 'WC-DR-01', machine: 'Radial Drill', status: 'Active' },
  { no: 4, opNo: 'OP-004', opName: 'Machining - Milling', processType: 'Manufacturing', stdTime: 20, workCenter: 'WC-MILL-01', machine: 'VMC', status: 'Active' },
  { no: 5, opNo: 'OP-005', opName: 'Deburring', processType: 'Manufacturing', stdTime: 10, workCenter: 'WC-DEB-01', machine: 'Bench', status: 'Active' },
  { no: 6, opNo: 'OP-006', opName: 'Inspection', processType: 'Quality', stdTime: 15, workCenter: 'WC-QC-01', machine: 'Inspection Table', status: 'Active' },
  { no: 7, opNo: 'OP-007', opName: 'Assembly', processType: 'Manufacturing', stdTime: 20, workCenter: 'WC-ASM-01', machine: 'Assembly Line', status: 'Active' },
  { no: 8, opNo: 'OP-008', opName: 'Final Inspection', processType: 'Quality', stdTime: 15, workCenter: 'WC-QC-02', machine: 'Inspection Table', status: 'Active' },
  { no: 9, opNo: 'OP-009', opName: 'Painting', processType: 'Surface Treatment', stdTime: 25, workCenter: 'WC-PAINT-01', machine: 'Paint Booth', status: 'Inactive' },
  { no: 10, opNo: 'OP-010', opName: 'Packing', processType: 'Manufacturing', stdTime: 10, workCenter: 'WC-PACK-01', machine: 'Packing Station', status: 'Active' },
];

const TOTAL_RECORDS = 15;
const TOTAL_PAGES = 2;

export default function OperationMaster() {
  const navigate = useNavigate();
  const [opNoSearch, setOpNoSearch] = useState('');
  const [opNameSearch, setOpNameSearch] = useState('');
  const [opType, setOpType] = useState('All');
  const [processType, setProcessType] = useState('All');
  const [workCenter, setWorkCenter] = useState('All');
  const [machine, setMachine] = useState('All');
  const [status, setStatus] = useState('All');
  const [effFrom, setEffFrom] = useState('');
  const [effTo, setEffTo] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState(() => new Set());

  const toggleAll = () => {
    setChecked((prev) => (prev.size === OPERATIONS.length ? new Set() : new Set(OPERATIONS.map((o) => o.opNo))));
  };
  const toggleOne = (key) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const breadcrumb = (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">

    </Stack>
  );

  const headerActions = (
    <Stack spacing={1} alignItems="flex-end">
      {breadcrumb}
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-master/new-operation')}>
        New Operation
      </Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsOutlinedIcon />}
        title="Operation Master"
        subtitle="Maintain standard operations used in routing."
        rightContent={headerActions}
      />

      {/* Filter Criteria */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
            <FilterAltOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Filter Criteria</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Operation No." placeholder="Search Operation No..."
                value={opNoSearch} onChange={(e) => setOpNoSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Operation Name" placeholder="Search Operation Name..."
                value={opNameSearch} onChange={(e) => setOpNameSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Operation Type" value={opType} onChange={(e) => setOpType(e.target.value)}>
                {OPERATION_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Process Type" value={processType} onChange={(e) => setProcessType(e.target.value)}>
                {PROCESS_TYPES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Machine" value={machine} onChange={(e) => setMachine(e.target.value)}>
                {MACHINES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Effective Date From" placeholder="dd-mmm-yyyy"
                value={effFrom} onChange={(e) => setEffFrom(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><EventOutlinedIcon fontSize="small" color="action" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="Effective Date To" placeholder="dd-mmm-yyyy"
                value={effTo} onChange={(e) => setEffTo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><EventOutlinedIcon fontSize="small" color="action" /></InputAdornment> }}
              />
            </Grid>
          </Grid>
          <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 2 }}>
            <Button variant="outlined">Reset</Button>
            <Button variant="contained" startIcon={<SearchIcon />}>Search</Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Operation Master table */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ListAltOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>Operation Master List ({TOTAL_RECORDS} records)</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">Records per page</Typography>
              <TextField select size="small" value={rowsPerPage} onChange={(e) => setRowsPerPage(e.target.value)} sx={{ width: 80 }}>
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
              </TextField>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 560px), 520px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={checked.size === OPERATIONS.length}
                      indeterminate={checked.size > 0 && checked.size < OPERATIONS.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>Operation No.</TableCell>
                  <TableCell>Operation Name</TableCell>
                  <TableCell>Process Type</TableCell>
                  <TableCell align="right">Standard Time (Min)</TableCell>
                  <TableCell>Default Work Center</TableCell>
                  <TableCell>Default Machine</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {OPERATIONS.map((o) => (
                  <TableRow key={o.opNo} hover selected={checked.has(o.opNo)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(o.opNo)} onChange={() => toggleOne(o.opNo)} />
                    </TableCell>
                    <TableCell>{o.no}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{o.opNo}</Typography></TableCell>
                    <TableCell>{o.opName}</TableCell>
                    <TableCell>{o.processType}</TableCell>
                    <TableCell align="right">{o.stdTime}</TableCell>
                    <TableCell>{o.workCenter}</TableCell>
                    <TableCell>{o.machine}</TableCell>
                    <TableCell><Chip size="small" label={o.status} color={STATUS_COLOR[o.status] || 'default'} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.25}>
                        <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="primary" onClick={() => navigate('/production-master/new-operation')}><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small"><ContentCopyOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
