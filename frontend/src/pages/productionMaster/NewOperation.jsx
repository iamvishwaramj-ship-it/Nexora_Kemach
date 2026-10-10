import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, InputAdornment, Checkbox, Chip,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import PrecisionManufacturingOutlinedIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useNotify } from '../../components/feedback/NotificationProvider';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "New Operation" create screen, built to match
// the reference screenshot the user supplied. Opens from Operation
// Master's "New Operation" button (itself opened from New Routing /
// Process's "Add Operation" button). Same convention as NewRoutingProcess.jsx:
// fixed mock data only -- nothing persists or calls the server; Save /
// Save & New / Submit only toast + (for Submit) navigate back to the
// Operation Master list.
// ---------------------------------------------------------------------------

const PROCESS_TYPES = ['Manufacturing', 'Quality', 'Surface Treatment'];
const OPERATION_CATEGORIES = ['Machining', 'Assembly', 'Inspection', 'Surface Treatment', 'Material Handling'];
const OPERATION_TYPES = ['Internal', 'Subcontract'];
const LABOR_GRADES = ['Skilled', 'Semi-Skilled', 'Helper'];
const STATUS_OPTIONS = ['Active', 'Inactive'];
const TABS = ['1. Labor', '2. Machine / Equipment', '3. Tools & Fixtures', '4. Consumables', '5. Documents'];

const LABOR_ROWS = [
  { no: 1, grade: 'Skilled', desc: 'CNC Operator', operators: 1, stdTime: 15.0, costRate: 300.0 },
  { no: 2, grade: 'Helper', desc: 'Machine Assistant', operators: 1, stdTime: 15.0, costRate: 150.0 },
];

const MACHINE_TYPES = ['CNC VMC', 'CNC Lathe', 'Radial Drill', 'Surface Grinder'];

const MACHINE_ROWS = [
  { no: 1, code: 'MC-001', name: 'CNC VMC - 01', type: 'CNC VMC', location: 'Plant 1 - Machining', capacity: '800 x 500 x 500 mm', rate: 250.0, status: 'Active' },
  { no: 2, code: 'MC-002', name: 'CNC Lathe - 01', type: 'CNC Lathe', location: 'Plant 1 - Machining', capacity: 'Ø300 x 800 mm', rate: 200.0, status: 'Active' },
  { no: 3, code: 'MC-003', name: 'Radial Drill - 01', type: 'Radial Drill', location: 'Plant 1 - Machining', capacity: '50 mm', rate: 150.0, status: 'Active' },
];

const TOOL_TYPES = ['Cutting Tool', 'Measuring Tool', 'Fixture', 'Holding Tool'];
const TOOL_GROUPS = ['Cutting Tools', 'Measuring Tools', 'Fixtures'];
const TOOL_CATEGORIES = ['Gear Cutting', 'Machining', 'Inspection'];
const UOM_OPTIONS = ['Set', 'Nos', 'Pair'];
const TOOL_COST_BASIS_OPTIONS = ['Per Set', 'Per Nos', 'Per Hr'];

const TOOL_ROWS = [
  { no: 1, code: 'TF-001', name: 'Gear Cutting Tool Set', type: 'Cutting Tool', category: 'Gear Cutting', uom: 'Set', setupQty: 1.0, usageQty: 1.0, cost: 2500.0, costBasis: 'Per Set', life: 1000, status: 'Active' },
  { no: 2, code: 'TF-002', name: 'Fixture - Gear Housing', type: 'Fixture', category: 'Machining', uom: 'Nos', setupQty: 1.0, usageQty: 1.0, cost: 5000.0, costBasis: 'Per Nos', life: 5000, status: 'Active' },
  { no: 3, code: 'TF-003', name: 'Precision Hex Tool', type: 'Measuring Tool', category: 'Inspection', uom: 'Nos', setupQty: 1.0, usageQty: 0.0, cost: 1200.0, costBasis: 'Per Nos', life: 2000, status: 'Active' },
];

function numberFmt(n, decimals = 2) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function laborCost(row) {
  return row.operators * (row.stdTime / 60) * row.costRate;
}

// Static mock totals for the tabs that have no detailed line-item table in
// the reference design (Machine / Equipment, Tools & Fixtures, Consumables).
const MACHINE_COST = 250.0;
const TOOL_COST = 30.0;
const CONSUMABLE_COST = 15.0;

export default function NewOperation() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [opNo, setOpNo] = useState('OP-011');
  const [opName, setOpName] = useState('Gear Machining');
  const [processType, setProcessType] = useState('Manufacturing');
  const [opCategory, setOpCategory] = useState('Machining');
  const [stdTime, setStdTime] = useState('25.00');
  const [setupTime, setSetupTime] = useState('10.00');
  const [runTime, setRunTime] = useState('15.00');
  const [moveTime, setMoveTime] = useState('2.00');
  const [queueTime, setQueueTime] = useState('8.00');

  const [workCenter, setWorkCenter] = useState('WC-MILL-01');
  const [machine, setMachine] = useState('VMC-01');
  const [opType, setOpType] = useState('Internal');
  const [opSequence, setOpSequence] = useState('30');
  const [laborGrade, setLaborGrade] = useState('Skilled');
  const [noOfOperators, setNoOfOperators] = useState('1');
  const [status, setStatus] = useState('Active');
  const [effFrom, setEffFrom] = useState('01-Oct-2026');
  const [effTo, setEffTo] = useState('31-Dec-2099');
  const [remarks, setRemarks] = useState('Milling operation for gear housing.');

  const [activeTab, setActiveTab] = useState(0);
  const [checked, setChecked] = useState(() => new Set());
  const toggleAll = () => {
    setChecked((prev) => (prev.size === LABOR_ROWS.length ? new Set() : new Set(LABOR_ROWS.map((r) => r.no))));
  };
  const toggleOne = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  // Machine / Equipment tab -- "Add Machine / Equipment" form fields.
  const [mcCode, setMcCode] = useState('MC-001');
  const [mcName, setMcName] = useState('CNC VMC - 01');
  const [mcType, setMcType] = useState('CNC VMC');
  const [mcLocation, setMcLocation] = useState('Plant 1 - Machining');
  const [mcCapacity, setMcCapacity] = useState('800 x 500 x 500 mm');
  const [mcUtilization, setMcUtilization] = useState('85.00');
  const [mcSetupTime, setMcSetupTime] = useState('10.00');
  const [mcRunTime, setMcRunTime] = useState('15.00');
  const [mcMoveTime, setMcMoveTime] = useState('2.00');
  const [mcQueueTime, setMcQueueTime] = useState('8.00');
  const [mcHourlyRate, setMcHourlyRate] = useState('250.00');
  const [mcStatus, setMcStatus] = useState('Active');
  const [mcEffFrom, setMcEffFrom] = useState('01-Oct-2026');
  const [mcEffTo, setMcEffTo] = useState('31-Dec-2099');
  const [mcChecked, setMcChecked] = useState(() => new Set());
  const toggleAllMc = () => {
    setMcChecked((prev) => (prev.size === MACHINE_ROWS.length ? new Set() : new Set(MACHINE_ROWS.map((r) => r.no))));
  };
  const toggleOneMc = (no) => {
    setMcChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const handleClearMachineForm = () => {
    setMcCode(''); setMcName(''); setMcType('CNC VMC'); setMcLocation(''); setMcCapacity(''); setMcUtilization('');
    setMcSetupTime(''); setMcRunTime(''); setMcMoveTime(''); setMcQueueTime(''); setMcHourlyRate('');
    setMcStatus('Active'); setMcEffFrom(''); setMcEffTo('');
  };
  const handleAddMachineToOperation = () => notify.success('Machine / Equipment added to operation.');

  // Tools & Fixtures tab -- "Add Tool / Fixture" form fields.
  const [tfCode, setTfCode] = useState('TF-001');
  const [tfName, setTfName] = useState('Gear Cutting Tool Set');
  const [tfType, setTfType] = useState('Cutting Tool');
  const [tfGroup, setTfGroup] = useState('Cutting Tools');
  const [tfCategory, setTfCategory] = useState('Gear Cutting');
  const [tfSpec, setTfSpec] = useState('Module 2 - 8 mm');
  const [tfUom, setTfUom] = useState('Set');
  const [tfDefaultQty, setTfDefaultQty] = useState('1.00');
  const [tfSetupQty, setTfSetupQty] = useState('1.00');
  const [tfLife, setTfLife] = useState('1000');
  const [tfUsageQty, setTfUsageQty] = useState('1.00');
  const [tfCost, setTfCost] = useState('2,500.00');
  const [tfCostBasis, setTfCostBasis] = useState('Per Set');
  const [tfStatus, setTfStatus] = useState('Active');
  const [tfRemarks, setTfRemarks] = useState('Gear cutting tool set for gear machining operation.');
  const [tfChecked, setTfChecked] = useState(() => new Set());
  const toggleAllTf = () => {
    setTfChecked((prev) => (prev.size === TOOL_ROWS.length ? new Set() : new Set(TOOL_ROWS.map((r) => r.no))));
  };
  const toggleOneTf = (no) => {
    setTfChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };
  const handleClearToolForm = () => {
    setTfCode(''); setTfName(''); setTfType('Cutting Tool'); setTfGroup('Cutting Tools'); setTfCategory('Gear Cutting');
    setTfSpec(''); setTfUom('Set'); setTfDefaultQty(''); setTfSetupQty(''); setTfLife(''); setTfUsageQty('');
    setTfCost(''); setTfCostBasis('Per Set'); setTfStatus('Active'); setTfRemarks('');
  };
  const handleAddToolToOperation = () => notify.success('Tool / Fixture added to operation.');

  const laborTotal = LABOR_ROWS.reduce((sum, r) => sum + laborCost(r), 0);
  const totalStdCost = laborTotal + MACHINE_COST + TOOL_COST + CONSUMABLE_COST;

  const handleBackToList = () => navigate('/production-master/operation-master');
  const handleSave = () => notify.success('Operation saved.');
  const handleSaveAndNew = () => notify.success('Operation saved. Ready for a new entry.');
  const handleSubmit = () => {
    notify.success('Operation submitted.');
    navigate('/production-master/operation-master');
  };

  const breadcrumb = (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">

    </Stack>
  );

  const headerActions = (
    <Stack spacing={1} alignItems="flex-end">
      {breadcrumb}
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={handleBackToList}>Back to Operation</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />} onClick={handleSave}>Save</Button>
        <Button variant="outlined" startIcon={<LibraryAddOutlinedIcon />} onClick={handleSaveAndNew}>Save &amp; New</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={handleSubmit}>Submit</Button>
      </Stack>
    </Stack>
  );

  const tabAddLabel = ['Add Labor', 'Add Machine', 'Add Tool', 'Add Consumable', 'Add Document'][activeTab];

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsOutlinedIcon />}
        title="New Operation"
        subtitle="Create new standard operation for routing."
        rightContent={headerActions}
      />

      {/* Operation Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
            <FilterAltOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Operation Details</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth size="small" required label="Operation No." value={opNo} onChange={(e) => setOpNo(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField fullWidth size="small" required label="Operation Name" value={opName} onChange={(e) => setOpName(e.target.value)} />
                <TextField fullWidth size="small" required select label="Process Type" value={processType} onChange={(e) => setProcessType(e.target.value)}>
                  {PROCESS_TYPES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" select label="Operation Category" value={opCategory} onChange={(e) => setOpCategory(e.target.value)}>
                  {OPERATION_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" required label="Standard Time (Min)" value={stdTime} onChange={(e) => setStdTime(e.target.value)} />
                <TextField fullWidth size="small" label="Setup Time (Min)" value={setupTime} onChange={(e) => setSetupTime(e.target.value)} />
                <TextField fullWidth size="small" label="Run Time (Min)" value={runTime} onChange={(e) => setRunTime(e.target.value)} />
                <TextField fullWidth size="small" label="Move Time (Min)" value={moveTime} onChange={(e) => setMoveTime(e.target.value)} />
                <TextField fullWidth size="small" label="Queue Time (Min)" value={queueTime} onChange={(e) => setQueueTime(e.target.value)} />
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth size="small" required label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField
                  fullWidth size="small" label="Machine" value={machine} onChange={(e) => setMachine(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField fullWidth size="small" required select label="Operation Type" value={opType} onChange={(e) => setOpType(e.target.value)}>
                  {OPERATION_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" label="Operation Sequence" value={opSequence} onChange={(e) => setOpSequence(e.target.value)} />
                <TextField fullWidth size="small" select label="Default Labor Grade" value={laborGrade} onChange={(e) => setLaborGrade(e.target.value)}>
                  {LABOR_GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" label="No. of Operators" value={noOfOperators} onChange={(e) => setNoOfOperators(e.target.value)} />
                <TextField
                  fullWidth size="small" required select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}
                  sx={status === 'Active' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } } : undefined}
                >
                  {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField
                  fullWidth size="small" required label="Effective From" value={effFrom} onChange={(e) => setEffFrom(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField
                  fullWidth size="small" label="Effective To" value={effTo} onChange={(e) => setEffTo(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Required Resources */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <BuildOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>Required Resources</Typography>
            </Stack>
          </Stack>

          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {TABS.map((label, idx) => (
                <Button
                  key={label}
                  variant={activeTab === idx ? 'contained' : 'outlined'}
                  onClick={() => setActiveTab(idx)}
                >
                  {label}
                </Button>
              ))}
            </Stack>
            {activeTab !== 1 && activeTab !== 2 && (
              <Stack direction="row" spacing={1.25}>
                <Button variant="outlined" startIcon={<AddIcon />}>{tabAddLabel}</Button>
                <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}>Delete</Button>
              </Stack>
            )}
          </Stack>

          {activeTab === 1 ? (
            <Box>
              {/* Add Machine / Equipment */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <PrecisionManufacturingOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={700}>Add Machine / Equipment</Typography>
              </Stack>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField
                      fullWidth size="small" required label="Machine / Equipment Code" value={mcCode} onChange={(e) => setMcCode(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" required label="Machine / Equipment Name" value={mcName} onChange={(e) => setMcName(e.target.value)} />
                    <TextField fullWidth size="small" select label="Machine Type" value={mcType} onChange={(e) => setMcType(e.target.value)}>
                      {MACHINE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" label="Location" value={mcLocation} onChange={(e) => setMcLocation(e.target.value)} />
                    <TextField fullWidth size="small" label="Capacity / Spec" value={mcCapacity} onChange={(e) => setMcCapacity(e.target.value)} />
                    <TextField fullWidth size="small" label="Utilization %" value={mcUtilization} onChange={(e) => setMcUtilization(e.target.value)} />
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" label="Setup Time (Min)" value={mcSetupTime} onChange={(e) => setMcSetupTime(e.target.value)} />
                    <TextField fullWidth size="small" label="Run Time (Min)" value={mcRunTime} onChange={(e) => setMcRunTime(e.target.value)} />
                    <TextField fullWidth size="small" label="Move Time (Min)" value={mcMoveTime} onChange={(e) => setMcMoveTime(e.target.value)} />
                    <TextField fullWidth size="small" label="Queue Time (Min)" value={mcQueueTime} onChange={(e) => setMcQueueTime(e.target.value)} />
                    <TextField fullWidth size="small" label="Hourly Rate (₹)" value={mcHourlyRate} onChange={(e) => setMcHourlyRate(e.target.value)} />
                    <TextField
                      fullWidth size="small" select label="Status" value={mcStatus} onChange={(e) => setMcStatus(e.target.value)}
                      sx={mcStatus === 'Active' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } } : undefined}
                    >
                      {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" label="Effective From" value={mcEffFrom} onChange={(e) => setMcEffFrom(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField
                      fullWidth size="small" label="Effective To" value={mcEffTo} onChange={(e) => setMcEffTo(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                  </Stack>
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1.25} justifyContent="flex-end" sx={{ mt: 2.5 }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddMachineToOperation}>Add to Operation</Button>
                <Button variant="outlined" onClick={handleClearMachineForm}>Clear</Button>
              </Stack>

              {/* Machine / Equipment List */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mt: 3.5, mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PrecisionManufacturingOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={700}>Machine / Equipment List ({MACHINE_ROWS.length} records)</Typography>
                </Stack>
                <TextField size="small" select label="Records per page" value="10" sx={{ width: 160 }}>
                  <MenuItem value="10">10</MenuItem>
                  <MenuItem value="25">25</MenuItem>
                  <MenuItem value="50">50</MenuItem>
                </TextField>
              </Stack>
              <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 820px), 320px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={mcChecked.size === MACHINE_ROWS.length}
                          indeterminate={mcChecked.size > 0 && mcChecked.size < MACHINE_ROWS.length}
                          onChange={toggleAllMc}
                        />
                      </TableCell>
                      <TableCell>S.No</TableCell>
                      <TableCell>Machine Code</TableCell>
                      <TableCell>Machine Name</TableCell>
                      <TableCell>Machine Type</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell>Capacity / Spec</TableCell>
                      <TableCell align="right">Hourly Rate (₹)</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {MACHINE_ROWS.map((r) => (
                      <TableRow key={r.no} hover selected={mcChecked.has(r.no)}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={mcChecked.has(r.no)} onChange={() => toggleOneMc(r.no)} />
                        </TableCell>
                        <TableCell>{r.no}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="primary.main" fontWeight={600}>{r.code}</Typography>
                        </TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell>{r.location}</TableCell>
                        <TableCell>{r.capacity}</TableCell>
                        <TableCell align="right">{numberFmt(r.rate)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={r.status} color={r.status === 'Active' ? 'success' : 'error'} />
                        </TableCell>
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
            </Box>
          ) : activeTab === 2 ? (
            <Box>
              {/* Add Tool / Fixture */}
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <HandymanOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={700}>Add Tool / Fixture</Typography>
              </Stack>
              <Grid container spacing={2.5}>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField
                      fullWidth size="small" required label="Tool / Fixture Code" value={tfCode} onChange={(e) => setTfCode(e.target.value)}
                      InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                    />
                    <TextField fullWidth size="small" required label="Tool / Fixture Name" value={tfName} onChange={(e) => setTfName(e.target.value)} />
                    <TextField fullWidth size="small" required select label="Tool Type" value={tfType} onChange={(e) => setTfType(e.target.value)}>
                      {TOOL_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" select label="Tool Group" value={tfGroup} onChange={(e) => setTfGroup(e.target.value)}>
                      {TOOL_GROUPS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" select label="Category" value={tfCategory} onChange={(e) => setTfCategory(e.target.value)}>
                      {TOOL_CATEGORIES.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" label="Specification" value={tfSpec} onChange={(e) => setTfSpec(e.target.value)} />
                    <TextField fullWidth size="small" select label="UOM" value={tfUom} onChange={(e) => setTfUom(e.target.value)}>
                      {UOM_OPTIONS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                    </TextField>
                  </Stack>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Stack spacing={2.5}>
                    <TextField fullWidth size="small" required label="Default Quantity" value={tfDefaultQty} onChange={(e) => setTfDefaultQty(e.target.value)} />
                    <TextField fullWidth size="small" label="Setup Quantity" value={tfSetupQty} onChange={(e) => setTfSetupQty(e.target.value)} />
                    <TextField fullWidth size="small" label="Life (Cycles/Hrs)" value={tfLife} onChange={(e) => setTfLife(e.target.value)} />
                    <TextField fullWidth size="small" label="Usage per Operation" value={tfUsageQty} onChange={(e) => setTfUsageQty(e.target.value)} />
                    <TextField fullWidth size="small" required label="Tool Cost (₹)" value={tfCost} onChange={(e) => setTfCost(e.target.value)} />
                    <TextField fullWidth size="small" select label="Tool Cost Basis" value={tfCostBasis} onChange={(e) => setTfCostBasis(e.target.value)}>
                      {TOOL_COST_BASIS_OPTIONS.map((b) => <MenuItem key={b} value={b}>{b}</MenuItem>)}
                    </TextField>
                    <TextField
                      fullWidth size="small" required select label="Status" value={tfStatus} onChange={(e) => setTfStatus(e.target.value)}
                      sx={tfStatus === 'Active' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } } : undefined}
                    >
                      {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                    <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={tfRemarks} onChange={(e) => setTfRemarks(e.target.value)} />
                  </Stack>
                </Grid>
              </Grid>
              <Stack direction="row" spacing={1.25} justifyContent="flex-end" sx={{ mt: 2.5 }}>
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddToolToOperation}>Add to Operation</Button>
                <Button variant="outlined" onClick={handleClearToolForm}>Clear</Button>
              </Stack>

              {/* Tools / Fixtures List */}
              <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mt: 3.5, mb: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <HandymanOutlinedIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle1" fontWeight={700}>Tools / Fixtures List ({TOOL_ROWS.length} records)</Typography>
                </Stack>
                <TextField size="small" select label="Records per page" value="10" sx={{ width: 160 }}>
                  <MenuItem value="10">10</MenuItem>
                  <MenuItem value="25">25</MenuItem>
                  <MenuItem value="50">50</MenuItem>
                </TextField>
              </Stack>
              <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 820px), 320px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={tfChecked.size === TOOL_ROWS.length}
                          indeterminate={tfChecked.size > 0 && tfChecked.size < TOOL_ROWS.length}
                          onChange={toggleAllTf}
                        />
                      </TableCell>
                      <TableCell>S.No</TableCell>
                      <TableCell>Tool/Fix Code</TableCell>
                      <TableCell>Tool / Fixture Name</TableCell>
                      <TableCell>Tool Type</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell align="right">Setup Qty</TableCell>
                      <TableCell align="right">Usage Qty</TableCell>
                      <TableCell align="right">Tool Cost (₹)</TableCell>
                      <TableCell>Cost Basis</TableCell>
                      <TableCell align="right">Life (Cycles/Hrs)</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {TOOL_ROWS.map((r) => (
                      <TableRow key={r.no} hover selected={tfChecked.has(r.no)}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={tfChecked.has(r.no)} onChange={() => toggleOneTf(r.no)} />
                        </TableCell>
                        <TableCell>{r.no}</TableCell>
                        <TableCell>
                          <Typography variant="body2" color="primary.main" fontWeight={600}>{r.code}</Typography>
                        </TableCell>
                        <TableCell>{r.name}</TableCell>
                        <TableCell>{r.type}</TableCell>
                        <TableCell>{r.category}</TableCell>
                        <TableCell>{r.uom}</TableCell>
                        <TableCell align="right">{numberFmt(r.setupQty)}</TableCell>
                        <TableCell align="right">{numberFmt(r.usageQty)}</TableCell>
                        <TableCell align="right">{numberFmt(r.cost)}</TableCell>
                        <TableCell>{r.costBasis}</TableCell>
                        <TableCell align="right">{r.life}</TableCell>
                        <TableCell>
                          <Chip size="small" label={r.status} color={r.status === 'Active' ? 'success' : 'error'} />
                        </TableCell>
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
            </Box>
          ) : activeTab === 0 ? (
            <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 820px), 320px)">
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        size="small"
                        checked={checked.size === LABOR_ROWS.length}
                        indeterminate={checked.size > 0 && checked.size < LABOR_ROWS.length}
                        onChange={toggleAll}
                      />
                    </TableCell>
                    <TableCell>S.No</TableCell>
                    <TableCell>Labor Grade</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">No. of Operators</TableCell>
                    <TableCell align="right">Standard Time (Min)</TableCell>
                    <TableCell align="right">Cost Rate (₹/Hr)</TableCell>
                    <TableCell align="right">Standard Cost (₹)</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {LABOR_ROWS.map((r) => (
                    <TableRow key={r.no} hover selected={checked.has(r.no)}>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checked.has(r.no)} onChange={() => toggleOne(r.no)} />
                      </TableCell>
                      <TableCell>{r.no}</TableCell>
                      <TableCell>
                        <TextField size="small" select value={r.grade} InputProps={{ readOnly: true }} sx={{ width: 110 }}>
                          {LABOR_GRADES.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell>{r.desc}</TableCell>
                      <TableCell align="right">
                        <TextField size="small" value={r.operators} InputProps={{ readOnly: true }} sx={{ width: 70 }} />
                      </TableCell>
                      <TableCell align="right">
                        <TextField size="small" value={numberFmt(r.stdTime)} InputProps={{ readOnly: true }} sx={{ width: 90 }} />
                      </TableCell>
                      <TableCell align="right">
                        <TextField size="small" value={numberFmt(r.costRate)} InputProps={{ readOnly: true }} sx={{ width: 100 }} />
                      </TableCell>
                      <TableCell align="right">{numberFmt(laborCost(r))}</TableCell>
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
          ) : (
            <Typography variant="body2" color="text.secondary">
              No {TABS[activeTab].replace(/^\d+\.\s*/, '').toLowerCase()} added yet.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* Cost Summary */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <FunctionsOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Cost Summary</Typography>
          </Stack>
          <Grid container spacing={2.5} alignItems="center">
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="caption" color="text.secondary" display="block">Labor Cost (₹)</Typography>
              <Typography variant="h6" fontWeight={700}>{numberFmt(laborTotal)}</Typography>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="caption" color="text.secondary" display="block">Machine Cost (₹)</Typography>
              <Typography variant="h6" fontWeight={700}>{numberFmt(MACHINE_COST)}</Typography>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="caption" color="text.secondary" display="block">Tool Cost (₹)</Typography>
              <Typography variant="h6" fontWeight={700}>{numberFmt(TOOL_COST)}</Typography>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="caption" color="text.secondary" display="block">Consumable Cost (₹)</Typography>
              <Typography variant="h6" fontWeight={700}>{numberFmt(CONSUMABLE_COST)}</Typography>
            </Grid>
            <Grid item xs={12} sm={12} md={4}>
              <Box sx={{ bgcolor: 'primary.lighter', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block">Total Standard Cost (₹)</Typography>
                <Typography variant="h5" fontWeight={700} color="primary.main">{numberFmt(totalStdCost)}</Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
}
