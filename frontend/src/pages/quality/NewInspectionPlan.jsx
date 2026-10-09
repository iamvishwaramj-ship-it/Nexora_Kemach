import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Chip,
} from '@mui/material';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import ChecklistOutlinedIcon from '@mui/icons-material/ChecklistOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import NotesOutlinedIcon from '@mui/icons-material/NotesOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > Inspection Planning > New Plan" -- rebuilt to match the
// user-supplied reference screenshot exactly (Plan Information, Items to be
// Inspected, Inspection Characteristics, Documents, Notes, Approval).
// Static UI-only mock; no Quality data model exists in this schema.
// ---------------------------------------------------------------------------

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing', drawingNo: 'DR-1001', revision: '01', uom: 'Nos', planQty: 500, samplingQty: 20, stage: 'Full Inspection' },
  { no: 2, code: 'FG-1002', desc: 'Motor Bracket', drawingNo: 'DR-1002', revision: '00', uom: 'Nos', planQty: 300, samplingQty: 13, stage: 'Sampling' },
  { no: 3, code: 'RM-2001', desc: 'Cast Iron Housing', drawingNo: 'DR-2001', revision: '02', uom: 'Nos', planQty: 400, samplingQty: 13, stage: 'Sampling' },
];

const INITIAL_CHARACTERISTICS = [
  { no: 1, characteristic: 'Dimension (Length)', spec: '100.0 ± 0.5 mm', method: 'Vernier Caliper', samplingPlan: 'AQL 1.0 (n=20, Ac=0, Re=1)', acceptance: 'Within 100.0 ± 0.5 mm', maxAllowed: '0.5', minAllowed: '-0.5' },
  { no: 2, characteristic: 'Dimension (Width)', spec: '80.0 ± 0.5 mm', method: 'Vernier Caliper', samplingPlan: 'AQL 1.0 (n=20, Ac=0, Re=1)', acceptance: 'Within 80.0 ± 0.5 mm', maxAllowed: '0.5', minAllowed: '-0.5' },
  { no: 3, characteristic: 'Surface Finish', spec: 'Ra ≤ 3.2', method: 'Surface Roughness Tester', samplingPlan: 'AQL 1.0 (n=20, Ac=0, Re=1)', acceptance: 'Ra ≤ 3.2', maxAllowed: '-', minAllowed: '-' },
  { no: 4, characteristic: 'Material Grade', spec: 'FG 260', method: 'Spectrometer', samplingPlan: 'AQL 1.0 (n=5, Ac=0, Re=1)', acceptance: 'FG 260', maxAllowed: '-', minAllowed: '-' },
];

const DOCUMENTS = [
  { name: 'Drawing_FG1001.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
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
      <Typography variant="body2" color="primary.main">Inspection Planning</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>New Plan</Typography> */}
    </Stack>
  );
}

export default function NewInspectionPlan() {
  const navigate = useNavigate();

  const [planDate, setPlanDate] = useState('2026-10-01');
  const [inspectionType, setInspectionType] = useState('Incoming');
  const [orderType, setOrderType] = useState('Purchase');
  const [orderNo, setOrderNo] = useState('PO-2026-001');
  const [workCenter, setWorkCenter] = useState('Heat Treatment');

  const [vendorCode, setVendorCode] = useState('V-001');
  const [vendorName] = useState('Sri Balaji Heat Treatment');
  const [itemCode, setItemCode] = useState('FG-1001');
  const [itemDesc] = useState('Gear Housing');
  const [inspectionLevel, setInspectionLevel] = useState('Normal');
  const [samplingType, setSamplingType] = useState('AQL (Single)');

  const [samplingStandard, setSamplingStandard] = useState('ANSI/ASQ Z1.4 (MIL-STD-105E)');
  const [aqlLevel, setAqlLevel] = useState('AQL 1.0');
  const [planQty, setPlanQty] = useState(500);
  const [planUom, setPlanUom] = useState('Nos');
  const [priority, setPriority] = useState('Normal');
  const [effectiveFrom, setEffectiveFrom] = useState('2026-10-01');
  const [effectiveTo, setEffectiveTo] = useState('2026-12-31');
  const [remarks, setRemarks] = useState('Incoming inspection plan for cast iron housing.');

  const [items, setItems] = useState(INITIAL_ITEMS);
  const [itemsChecked, setItemsChecked] = useState(() => new Set());
  const [characteristics, setCharacteristics] = useState(INITIAL_CHARACTERISTICS);
  const [charChecked, setCharChecked] = useState(() => new Set());

  const [notes, setNotes] = useState('Inspect 100% for first lot and then as per AQL sampling.');
  const [preparedBy, setPreparedBy] = useState('Kannan P');
  const [approvedBy, setApprovedBy] = useState('');

  const toggleItemRow = (no) => {
    setItemsChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const toggleCharRow = (no) => {
    setCharChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const updateItem = (no, field, value) => {
    setItems((prev) => prev.map((it) => (it.no === no ? { ...it, [field]: value } : it)));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { no: prev.length ? Math.max(...prev.map((p) => p.no)) + 1 : 1, code: '', desc: '', drawingNo: '', revision: '', uom: 'Nos', planQty: 0, samplingQty: 0, stage: 'Full Inspection' },
    ]);
  };

  const addCharacteristic = () => {
    setCharacteristics((prev) => [
      ...prev,
      { no: prev.length ? Math.max(...prev.map((p) => p.no)) + 1 : 1, characteristic: '', spec: '', method: '', samplingPlan: '', acceptance: '', maxAllowed: '', minAllowed: '' },
    ]);
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/quality/inspection-planning')}>
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
        icon={<AssignmentOutlinedIcon />}
        title="New Inspection Plan"
        subtitle="Create inspection plan for incoming, in-process or final inspection."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionHeading icon={DescriptionOutlinedIcon} label="1. Plan Information" />
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Plan No." value="Auto Generate" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Vendor Code" value={vendorCode} onChange={(e) => setVendorCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Sampling Standard" value={samplingStandard} onChange={(e) => setSamplingStandard(e.target.value)}>
                {['ANSI/ASQ Z1.4 (MIL-STD-105E)', 'ISO 2859-1', 'Custom'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Plan Date *" value={planDate} onChange={(e) => setPlanDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vendor Name" value={vendorName} InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="AQL Level" value={aqlLevel} onChange={(e) => setAqlLevel(e.target.value)}>
                {['AQL 0.65', 'AQL 1.0', 'AQL 1.5', 'AQL 2.5'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inspection Type *" value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
                {['Incoming', 'In-process', 'Final'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" type="number" label="Plan Qty / Lot Size" value={planQty} onChange={(e) => setPlanQty(Number(e.target.value))} />
                <TextField size="small" select value={planUom} onChange={(e) => setPlanUom(e.target.value)} sx={{ minWidth: 80 }}>
                  {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Order Type" value={orderType} onChange={(e) => setOrderType(e.target.value)}>
                {['Purchase', 'Production', 'Subcontract'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Item Description" value={itemDesc} InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                {['Low', 'Normal', 'High', 'Urgent'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Order No." value={orderNo} onChange={(e) => setOrderNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inspection Level" value={inspectionLevel} onChange={(e) => setInspectionLevel(e.target.value)}>
                {['Reduced', 'Normal', 'Tightened'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Effective From" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Work Center / Process" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {['Heat Treatment', 'CNC Machining', 'Assembly', 'Surface Coating'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Sampling Type" value={samplingType} onChange={(e) => setSamplingType(e.target.value)}>
                {['AQL (Single)', 'AQL (Double)', '100% Inspection'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Effective To" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>

            <Grid item xs={12} sm={9} md={9}>
              <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
            <SectionHeading icon={InventoryOutlinedIcon} label="2. Items to be Inspected" />
            <Stack direction="row" spacing={1.25}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}>Delete</Button>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 640px), 320px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell>Drawing No.</TableCell>
                  <TableCell>Revision</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Plan Qty</TableCell>
                  <TableCell align="right">Sampling Qty</TableCell>
                  <TableCell>Inspection Stage</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={it.no} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={itemsChecked.has(it.no)} onChange={() => toggleItemRow(it.no)} />
                    </TableCell>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{it.code}</Typography></TableCell>
                    <TableCell>{it.desc}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{it.drawingNo}</Typography></TableCell>
                    <TableCell>{it.revision}</TableCell>
                    <TableCell>{it.uom}</TableCell>
                    <TableCell align="right" sx={{ minWidth: 90 }}>
                      <TextField size="small" type="number" value={it.planQty} onChange={(e) => updateItem(it.no, 'planQty', Number(e.target.value))} inputProps={{ style: { textAlign: 'right' } }} />
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 90 }}>
                      <TextField size="small" type="number" value={it.samplingQty} onChange={(e) => updateItem(it.no, 'samplingQty', Number(e.target.value))} inputProps={{ style: { textAlign: 'right' } }} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 150 }}>
                      <TextField size="small" select value={it.stage} onChange={(e) => updateItem(it.no, 'stage', e.target.value)}>
                        {['Full Inspection', 'Sampling'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                      </TextField>
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
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
            <SectionHeading icon={ChecklistOutlinedIcon} label="3. Inspection Characteristics" />
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
                  <TableCell>Acceptance Criteria</TableCell>
                  <TableCell>Max Allowed</TableCell>
                  <TableCell>Min Allowed</TableCell>
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
                    <TableCell>{c.acceptance}</TableCell>
                    <TableCell>{c.maxAllowed}</TableCell>
                    <TableCell>{c.minAllowed}</TableCell>
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
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
                <SectionHeading icon={AttachFileOutlinedIcon} label="4. Documents" />
                <Button variant="outlined" startIcon={<FileUploadOutlinedIcon />}>Upload File</Button>
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>File Name</TableCell>
                    <TableCell>File Type</TableCell>
                    <TableCell>Uploaded On</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {DOCUMENTS.map((d) => (
                    <TableRow key={d.name} hover>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{d.name}</Typography></TableCell>
                      <TableCell>{d.type}</TableCell>
                      <TableCell>{d.uploadedOn}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                          <IconButton size="small"><DeleteOutlineIcon fontSize="small" color="error" /></IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeading icon={NotesOutlinedIcon} label="5. Notes" />
              <TextField fullWidth size="small" multiline minRows={6} value={notes} onChange={(e) => setNotes(e.target.value)} />
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
