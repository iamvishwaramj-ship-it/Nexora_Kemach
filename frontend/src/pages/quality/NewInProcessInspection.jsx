import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Chip,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import CenterFocusWeakOutlinedIcon from '@mui/icons-material/CenterFocusWeakOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > In-Process Inspection > New In-Process Inspection" -- rebuilt
// to match the user-supplied reference screenshot exactly (Inspection
// Information, Characteristics to Inspect, Inspection Results with 10
// sample columns, Attachments drag & drop, Inspection Summary, Approval).
// Static UI-only mock; no Quality data model exists in this schema.
// ---------------------------------------------------------------------------

const SAMPLE_COLUMNS = Array.from({ length: 10 }, (_, i) => i + 1);

const INITIAL_CHARACTERISTICS = [
  { no: 1, characteristic: 'Hole Diameter', spec: 'Ø 20.00 ± 0.05 mm', method: 'Vernier Caliper', samplingPlan: 'AQL 1.0 (n=20, Ac=0, Re=1)', uom: 'mm', planQty: 20 },
  { no: 2, characteristic: 'Hole Depth', spec: '50.00 ± 0.10 mm', method: 'Depth Gauge', samplingPlan: 'AQL 1.0 (n=20, Ac=0, Re=1)', uom: 'mm', planQty: 20 },
  { no: 3, characteristic: 'Position Tolerance', spec: '0.10 mm', method: 'CMM', samplingPlan: 'AQL 1.0 (n=20, Ac=0, Re=1)', uom: 'mm', planQty: 20 },
  { no: 4, characteristic: 'Surface Finish', spec: 'Ra ≤ 3.2', method: 'Surface Roughness Tester', samplingPlan: 'AQL 1.0 (n=20, Ac=0, Re=1)', uom: 'μm', planQty: 20 },
];

const INITIAL_RESULTS = [
  { no: 1, characteristic: 'Hole Diameter', spec: 'Ø 20.00 ± 0.05', uom: 'mm', samples: [20.02, 20.03, 19.99, 20.01, 20.00, 19.98, 20.02, 20.01, 20.00, 19.99], result: 'OK', judgement: 'Accepted', remarks: 'Within spec' },
  { no: 2, characteristic: 'Hole Depth', spec: '50.00 ± 0.10', uom: 'mm', samples: [49.98, 50.02, 50.01, 49.99, 50.00, 50.03, 49.97, 50.01, 50.00, 49.99], result: 'OK', judgement: 'Accepted', remarks: 'Within spec' },
  { no: 3, characteristic: 'Position Tolerance', spec: '0.10', uom: 'mm', samples: [0.08, 0.09, 0.07, 0.10, 0.08, 0.09, 0.07, 0.08, 0.09, 0.08], result: 'OK', judgement: 'Accepted', remarks: '' },
  { no: 4, characteristic: 'Surface Finish', spec: 'Ra ≤ 3.2', uom: 'μm', samples: [2.8, 3.1, 2.9, 3.0, 2.7, 2.8, 3.1, 2.9, 3.0, 2.8], result: 'OK', judgement: 'Accepted', remarks: '' },
];

function SectionHeading({ icon: Icon, label }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
      <Icon fontSize="small" color="primary" />
      <Typography variant="subtitle1" fontWeight={700} color="primary.main">{label}</Typography>
    </Stack>
  );
}

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Quality</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">In-Process Inspection</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>New In-Process Inspection</Typography> */}
    </Stack>
  );
}

export default function NewInProcessInspection() {
  const navigate = useNavigate();

  const [inspectionDate, setInspectionDate] = useState('2026-10-02');
  const [productionOrder, setProductionOrder] = useState('PO-2026-001');
  const [itemCode, setItemCode] = useState('FG-1001');
  const [itemDesc] = useState('Gear Housing');
  const [opNo, setOpNo] = useState('OP-20');
  const [workCenter, setWorkCenter] = useState('DRILL-01');

  const [lotNo, setLotNo] = useState('BCH-001');
  const [drawingNo, setDrawingNo] = useState('DR-1001');
  const [inspectionStage, setInspectionStage] = useState('In-process');
  const [inspectionPlan, setInspectionPlan] = useState('IPR-2026-002');
  const [samplingPlan, setSamplingPlan] = useState('AQL 1.0 (n=20, Ac=0, Re=1)');
  const [samplingQty, setSamplingQty] = useState(20);
  const [samplingUom, setSamplingUom] = useState('Nos');
  const [inspector, setInspector] = useState('Kannan P');

  const [inspectionType, setInspectionType] = useState('Dimensional');
  const [inspectionLevel, setInspectionLevel] = useState('Normal');
  const [startDate, setStartDate] = useState('2026-10-02');
  const [startTime, setStartTime] = useState('10:30');
  const [expectedDate, setExpectedDate] = useState('2026-10-02');
  const [expectedTime, setExpectedTime] = useState('12:00');
  const [status, setStatus] = useState('In Progress');
  const [remarks, setRemarks] = useState('In-process inspection for drilling operation.');

  const [characteristics, setCharacteristics] = useState(INITIAL_CHARACTERISTICS);
  const [charChecked, setCharChecked] = useState(() => new Set());
  const [results, setResults] = useState(INITIAL_RESULTS);
  const [resultsChecked, setResultsChecked] = useState(() => new Set());

  const [preparedBy, setPreparedBy] = useState('Kannan P');
  const [approvedBy, setApprovedBy] = useState('');
  const [approvalDate, setApprovalDate] = useState('');
  const [summaryRemarks, setSummaryRemarks] = useState('All inspected dimensions are within specification.');

  const toggleCharRow = (no) => {
    setCharChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const toggleResultRow = (no) => {
    setResultsChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const updateCharacteristic = (no, field, value) => {
    setCharacteristics((prev) => prev.map((c) => (c.no === no ? { ...c, [field]: value } : c)));
  };

  const addCharacteristic = () => {
    setCharacteristics((prev) => [
      ...prev,
      { no: prev.length ? Math.max(...prev.map((p) => p.no)) + 1 : 1, characteristic: '', spec: '', method: '', samplingPlan: '', uom: '', planQty: 0 },
    ]);
  };

  const totalCharacteristics = results.length;
  const acceptedCount = results.filter((r) => r.judgement === 'Accepted').length;
  const rejectedCount = results.filter((r) => r.judgement === 'Rejected').length;
  const pendingCount = results.filter((r) => r.judgement !== 'Accepted' && r.judgement !== 'Rejected').length;

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/quality/in-process-inspection')}>
          Back to List
        </Button>
        <Button variant="contained" startIcon={<SaveOutlinedIcon />}>Save</Button>
        <Button variant="contained" startIcon={<LibraryAddOutlinedIcon />}>Save &amp; New</Button>
        <Button variant="outlined" startIcon={<VisibilityOutlinedIcon />}>Preview</Button>
        <Button variant="contained" sx={{ bgcolor: '#17315c', '&:hover': { bgcolor: '#102244' } }} startIcon={<SendOutlinedIcon />}>Submit</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsOutlinedIcon />}
        title="New In-Process Inspection"
        subtitle="Create and record in-process inspection at different manufacturing stages."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionHeading icon={DescriptionOutlinedIcon} label="1. Inspection Information" />
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Inspection No." value="Auto Generate" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Batch / Lot No." value={lotNo} onChange={(e) => setLotNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inspection Type" value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
                {['Dimensional', 'Visual', 'Functional'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Inspection Date *" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Drawing No." value={drawingNo} onChange={(e) => setDrawingNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inspection Level" value={inspectionLevel} onChange={(e) => setInspectionLevel(e.target.value)}>
                {['Reduced', 'Normal', 'Tightened'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" type="date" label="Start Time" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 110 }} />
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Production Order *" value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inspection Stage *" value={inspectionStage} onChange={(e) => setInspectionStage(e.target.value)}>
                {['In-process', 'Final'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Inspection Plan" value={inspectionPlan} onChange={(e) => setInspectionPlan(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" type="date" label="Expected Completion" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="time" value={expectedTime} onChange={(e) => setExpectedTime(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ minWidth: 110 }} />
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Item Code *" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Sampling Plan" value={samplingPlan} onChange={(e) => setSamplingPlan(e.target.value)}>
                {['AQL 1.0 (n=20, Ac=0, Re=1)', 'AQL 2.5 (n=32, Ac=1, Re=2)', '100% Inspection'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ '& .MuiInputBase-root': { color: 'warning.dark', fontWeight: 600 } }}>
                {['Draft', 'In Progress', 'Completed'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Item Description" value={itemDesc} InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" type="number" label="Sampling Qty" value={samplingQty} onChange={(e) => setSamplingQty(Number(e.target.value))} />
                <TextField size="small" select value={samplingUom} onChange={(e) => setSamplingUom(e.target.value)} sx={{ minWidth: 80 }}>
                  {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={12} md={6}>
              <TextField fullWidth size="small" multiline minRows={3} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Operation No. *" value={opNo} onChange={(e) => setOpNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Inspector *" value={inspector} onChange={(e) => setInspector(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Work Center *" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
            <SectionHeading icon={CenterFocusWeakOutlinedIcon} label="2. Characteristics to Inspect" />
            <Button variant="outlined" startIcon={<AddIcon />} onClick={addCharacteristic}>Add Characteristic</Button>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 640px), 320px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell>Characteristic</TableCell>
                  <TableCell>Specification</TableCell>
                  <TableCell>Method / Instrument</TableCell>
                  <TableCell>Sampling Plan</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Plan Qty</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {characteristics.map((c, idx) => (
                  <TableRow key={c.no} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={charChecked.has(c.no)} onChange={() => toggleCharRow(c.no)} />
                    </TableCell>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{c.characteristic}</Typography></TableCell>
                    <TableCell>{c.spec}</TableCell>
                    <TableCell>{c.method}</TableCell>
                    <TableCell>{c.samplingPlan}</TableCell>
                    <TableCell>{c.uom}</TableCell>
                    <TableCell align="right" sx={{ minWidth: 90 }}>
                      <TextField size="small" type="number" value={c.planQty} onChange={(e) => updateCharacteristic(c.no, 'planQty', Number(e.target.value))} inputProps={{ style: { textAlign: 'right' } }} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small"><EditOutlinedIcon fontSize="small" color="primary" /></IconButton>
                        <IconButton size="small"><DeleteOutlineIcon fontSize="small" color="error" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionHeading icon={ArticleOutlinedIcon} label="3. Inspection Results" />

          <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 600px), 360px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell>Characteristic</TableCell>
                  <TableCell>Specification</TableCell>
                  <TableCell>UOM</TableCell>
                  {SAMPLE_COLUMNS.map((n) => (
                    <TableCell key={n} align="right">{n}</TableCell>
                  ))}
                  <TableCell>Result</TableCell>
                  <TableCell>Judgement</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {results.map((r, idx) => (
                  <TableRow key={r.no} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={resultsChecked.has(r.no)} onChange={() => toggleResultRow(r.no)} />
                    </TableCell>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.characteristic}</Typography></TableCell>
                    <TableCell>{r.spec}</TableCell>
                    <TableCell>{r.uom}</TableCell>
                    {r.samples.map((s, sIdx) => (
                      <TableCell key={sIdx} align="right">{s}</TableCell>
                    ))}
                    <TableCell>{r.result}</TableCell>
                    <TableCell><Chip size="small" label={r.judgement} color={r.judgement === 'Accepted' ? 'success' : r.judgement === 'Rejected' ? 'error' : 'warning'} /></TableCell>
                    <TableCell sx={{ minWidth: 100 }}>{r.remarks}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small"><EditOutlinedIcon fontSize="small" color="primary" /></IconButton>
                        <IconButton size="small"><DeleteOutlineIcon fontSize="small" color="error" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeading icon={AttachFileOutlinedIcon} label="4. Attachments" />
              <Box
                sx={{
                  border: '2px dashed', borderColor: 'divider', borderRadius: 2, p: 4,
                  textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5,
                }}
              >
                <CloudUploadOutlinedIcon color="primary" sx={{ fontSize: 36 }} />
                <Typography variant="body2" color="text.secondary">Drag &amp; Drop files here or</Typography>
                <Button variant="contained" size="small">Browse Files</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeading icon={AssessmentOutlinedIcon} label="5. Inspection Summary" />
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Total Characteristics</Typography>
                  <Typography variant="body2" fontWeight={700}>{totalCharacteristics}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Accepted</Typography>
                  <Chip size="small" label={acceptedCount} color="success" />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Rejected</Typography>
                  <Chip size="small" label={rejectedCount} color="error" />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Pending</Typography>
                  <Chip size="small" label={pendingCount} color="warning" />
                </Stack>
                <TextField fullWidth size="small" multiline minRows={3} label="Remarks" value={summaryRemarks} onChange={(e) => setSummaryRemarks(e.target.value)} />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeading icon={PersonOutlineOutlinedIcon} label="6. Approval" />
              <Stack spacing={2}>
                <TextField
                  fullWidth size="small" label="Prepared By" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <TextField
                  fullWidth size="small" label="Approved By" placeholder="Select Approver" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <TextField fullWidth size="small" type="date" label="Approval Date" value={approvalDate} onChange={(e) => setApprovalDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>Approval Status</Typography>
                  <Chip label="Pending" color="warning" />
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
