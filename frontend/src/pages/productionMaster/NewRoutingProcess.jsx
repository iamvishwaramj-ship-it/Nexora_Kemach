import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, InputAdornment, Checkbox,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useNotify } from '../../components/feedback/NotificationProvider';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "New Routing / Process" create screen, built
// to match the reference screenshot the user supplied. Opens from
// RoutingProcessMaster's "New Routing" button. Same convention as
// NewBomVersion.jsx: fixed mock data only -- nothing persists or calls the
// server; Save / Save & New / Submit only toast + (for Submit) navigate
// back to the Routing / Process Master list.
// ---------------------------------------------------------------------------

const ITEM_GROUPS = ['Fabrication', 'Machining', 'Assembly'];
const PROCESS_TYPES = ['Manufacturing', 'Engineering'];
const ROUTING_TYPES = ['Standard', 'Alternate'];
const STATUS_OPTIONS = ['Active', 'Under Review', 'Inactive'];
const WORK_CENTERS = ['WC-CUT-01', 'WC-TURN-01', 'WC-DR-01', 'WC-MILL-01', 'WC-DEB-01', 'WC-QC-01', 'WC-ASM-01', 'WC-QC-02'];
const MACHINES = ['Laser Cutting', 'CNC Lathe', 'Radial Drill', 'VMC', 'Bench', 'Inspection Table', 'Assembly Line'];

const OPERATIONS = [
  { no: 1, opNo: 'OP-001', opDesc: 'Raw Material Cutting', workCenter: 'WC-CUT-01', machine: 'Laser Cutting', setup: 30, run: 45, move: 5, queue: 10, stdCost: 250.0 },
  { no: 2, opNo: 'OP-002', opDesc: 'Machining - Turning', workCenter: 'WC-TURN-01', machine: 'CNC Lathe', setup: 20, run: 60, move: 5, queue: 10, stdCost: 180.0 },
  { no: 3, opNo: 'OP-003', opDesc: 'Machining - Drilling', workCenter: 'WC-DR-01', machine: 'Radial Drill', setup: 15, run: 30, move: 5, queue: 10, stdCost: 120.0 },
  { no: 4, opNo: 'OP-004', opDesc: 'Machining - Milling', workCenter: 'WC-MILL-01', machine: 'VMC', setup: 20, run: 40, move: 5, queue: 10, stdCost: 200.0 },
  { no: 5, opNo: 'OP-005', opDesc: 'Deburring', workCenter: 'WC-DEB-01', machine: 'Bench', setup: 10, run: 20, move: 5, queue: 10, stdCost: 80.0 },
  { no: 6, opNo: 'OP-006', opDesc: 'Inspection', workCenter: 'WC-QC-01', machine: 'Inspection Table', setup: 15, run: 20, move: 5, queue: 10, stdCost: 60.0 },
  { no: 7, opNo: 'OP-007', opDesc: 'Assembly', workCenter: 'WC-ASM-01', machine: 'Assembly Line', setup: 20, run: 60, move: 5, queue: 10, stdCost: 150.0 },
  { no: 8, opNo: 'OP-008', opDesc: 'Final Inspection', workCenter: 'WC-QC-02', machine: 'Inspection Table', setup: 15, run: 20, move: 5, queue: 10, stdCost: 70.0 },
];

function numberFmt(n, decimals = 2) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export default function NewRoutingProcess() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [routingNo, setRoutingNo] = useState('RO-2026-001');
  const [routingName, setRoutingName] = useState('Gear Housing Routing');
  const [itemCode, setItemCode] = useState('FG-1001');
  const [itemDesc, setItemDesc] = useState('Gear Housing');
  const [processType, setProcessType] = useState('Manufacturing');
  const [routingType, setRoutingType] = useState('Standard');
  const [itemGroup, setItemGroup] = useState('Fabrication');
  const [noOfOperations] = useState(OPERATIONS.length);
  const [effFrom, setEffFrom] = useState('01-Oct-2026');
  const [effTo, setEffTo] = useState('31-Dec-2099');
  const [status, setStatus] = useState('Active');
  const [remarks, setRemarks] = useState('Standard routing for Gear Housing manufacturing process.');

  const [checked, setChecked] = useState(() => new Set());
  const toggleAll = () => {
    setChecked((prev) => (prev.size === OPERATIONS.length ? new Set() : new Set(OPERATIONS.map((o) => o.no))));
  };
  const toggleOne = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const totals = OPERATIONS.reduce(
    (acc, o) => {
      acc.operations += 1;
      acc.setup += o.setup;
      acc.run += o.run;
      acc.move += o.move;
      acc.queue += o.queue;
      acc.stdCost += o.stdCost;
      return acc;
    },
    { operations: 0, setup: 0, run: 0, move: 0, queue: 0, stdCost: 0 },
  );

  const handleBackToList = () => navigate('/production-master/routing');
  const handleSave = () => notify.success('Routing saved.');
  const handleSaveAndNew = () => notify.success('Routing saved. Ready for a new entry.');
  const handleSubmit = () => {
    notify.success('Routing submitted.');
    navigate('/production-master/routing');
  };

  const breadcrumb = (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">

    </Stack>
  );

  const headerActions = (
    <Stack spacing={1} alignItems="flex-end">
      {breadcrumb}
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={handleBackToList}>Back to List</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />} onClick={handleSave}>Save</Button>
        <Button variant="outlined" startIcon={<LibraryAddOutlinedIcon />} onClick={handleSaveAndNew}>Save &amp; New</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={handleSubmit}>Submit</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsOutlinedIcon />}
        title="New Routing / Process"
        subtitle="Define process sequence and operations for manufacturing."
        rightContent={headerActions}
      />

      {/* Routing Header */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
            <FilterAltOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Routing Header</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required label="Routing No." value={routingNo} onChange={(e) => setRoutingNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" select label="Item Group" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
                {ITEM_GROUPS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" required label="Routing Name" value={routingName} onChange={(e) => setRoutingName(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="No. of Operations" value={noOfOperations} disabled />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required label="Effective From" value={effFrom} onChange={(e) => setEffFrom(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" label="Item Description" value={itemDesc} disabled onChange={(e) => setItemDesc(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" label="Effective To" value={effTo} onChange={(e) => setEffTo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" required label="Process Type" value={processType} onChange={(e) => setProcessType(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                fullWidth size="small" required label="Status" select value={status} onChange={(e) => setStatus(e.target.value)}
                sx={status === 'Active' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } } : undefined}
              >
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" select label="Routing Type" value={routingType} onChange={(e) => setRoutingType(e.target.value)}>
                {ROUTING_TYPES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Operations */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ListAltOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>Operations</Typography>
            </Stack>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button variant="outlined" startIcon={<AddIcon />} onClick={() => navigate('/production-master/operation-master')}>Add Operation</Button>
              <Button variant="outlined" startIcon={<ContentCopyOutlinedIcon />}>Copy from Routing</Button>
              <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />}>Import Operations</Button>
              <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}>Delete</Button>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 760px), 400px)">
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
                  <TableCell>Operation Description</TableCell>
                  <TableCell>Work Center</TableCell>
                  <TableCell>Machine</TableCell>
                  <TableCell align="right">Setup Time (Min)</TableCell>
                  <TableCell align="right">Run Time (Min)</TableCell>
                  <TableCell align="right">Move Time (Min)</TableCell>
                  <TableCell align="right">Queue Time (Min)</TableCell>
                  <TableCell align="right">Standard Cost (₹)</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {OPERATIONS.map((o) => (
                  <TableRow key={o.no} hover selected={checked.has(o.no)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(o.no)} onChange={() => toggleOne(o.no)} />
                    </TableCell>
                    <TableCell>{o.no}</TableCell>
                    <TableCell>
                      <TextField size="small" value={o.opNo} InputProps={{ readOnly: true, endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ width: 110 }} />
                    </TableCell>
                    <TableCell>{o.opDesc}</TableCell>
                    <TableCell>
                      <TextField size="small" select value={o.workCenter} InputProps={{ readOnly: true }} sx={{ width: 120 }}>
                        {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <TextField size="small" select value={o.machine} InputProps={{ readOnly: true }} sx={{ width: 140 }}>
                        {MACHINES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                      </TextField>
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" value={o.setup} InputProps={{ readOnly: true }} sx={{ width: 80 }} />
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" value={o.run} InputProps={{ readOnly: true }} sx={{ width: 80 }} />
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" value={o.move} InputProps={{ readOnly: true }} sx={{ width: 80 }} />
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" value={o.queue} InputProps={{ readOnly: true }} sx={{ width: 80 }} />
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" value={numberFmt(o.stdCost)} InputProps={{ readOnly: true }} sx={{ width: 100 }} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.25}>
                        <IconButton size="small" color="primary"><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      {/* Routing Summary */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <FunctionsOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Routing Summary</Typography>
          </Stack>
          <Grid container spacing={2.5} alignItems="center">
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="caption" color="text.secondary" display="block">Total Operations</Typography>
              <Typography variant="h6" fontWeight={700}>{totals.operations}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="caption" color="text.secondary" display="block">Total Setup Time (Min)</Typography>
              <Typography variant="h6" fontWeight={700}>{totals.setup}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="caption" color="text.secondary" display="block">Total Run Time (Min)</Typography>
              <Typography variant="h6" fontWeight={700}>{totals.run}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="caption" color="text.secondary" display="block">Total Move Time (Min)</Typography>
              <Typography variant="h6" fontWeight={700}>{totals.move}</Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2}>
              <Typography variant="caption" color="text.secondary" display="block">Total Queue Time (Min)</Typography>
              <Typography variant="h6" fontWeight={700}>{totals.queue}</Typography>
            </Grid>
            <Grid item xs={12} sm={12} md={2}>
              <Box sx={{ bgcolor: 'primary.lighter', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block">Total Standard Cost (₹)</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">{numberFmt(totals.stdCost)}</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
