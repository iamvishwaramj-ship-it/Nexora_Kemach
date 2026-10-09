import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton,
} from '@mui/material';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import GpsFixedOutlinedIcon from '@mui/icons-material/GpsFixedOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > Final Inspection > New Final Inspection" -- rebuilt to match
// the user-supplied reference screenshot exactly. Static UI-only mock; no
// Quality data model exists in this schema.
// ---------------------------------------------------------------------------

const CHARACTERISTICS = [
  { no: 1, characteristic: 'Overall Dimension (Length)', spec: '100.0 ± 0.5 mm', method: 'Vernier Caliper', plan: 'AQL 1.0 (n=20, Ac=0, Re=1)', uom: 'mm', qty: 20 },
  { no: 2, characteristic: 'Overall Dimension (Width)', spec: '80.0 ± 0.5 mm', method: 'Vernier Caliper', plan: 'AQL 1.0 (n=20, Ac=0, Re=1)', uom: 'mm', qty: 20 },
  { no: 3, characteristic: 'Hole Diameter', spec: 'Ø20.0 ± 0.05 mm', method: 'CMM', plan: 'AQL 1.0 (n=20, Ac=0, Re=1)', uom: 'mm', qty: 20 },
  { no: 4, characteristic: 'Surface Finish', spec: 'Ra ≤ 3.2', method: 'Surface Roughness Tester', plan: 'AQL 1.0 (n=20, Ac=0, Re=1)', uom: 'µm', qty: 20 },
  { no: 5, characteristic: 'Appearance', spec: 'No cracks, burrs, defects', method: 'Visual Inspection', plan: 'AQL 1.0 (n=20, Ac=0, Re=1)', uom: 'Nos', qty: 20 },
];

const SAMPLE_COLS = [1, 2, 3, 4, 5];

const RESULTS = [
  { no: 1, characteristic: 'Diameter', spec: '100.0 ± 0.5', uom: 'mm', samples: [100.2, 99.9, 100.1, 99.8, 100.0], result: 'OK', judgement: 'Accepted', remarks: 'Within specification' },
  { no: 2, characteristic: 'Width', spec: '80.0 ± 0.5', uom: 'mm', samples: [79.9, 80.1, 80.0, 79.8, 80.2], result: 'OK', judgement: 'Accepted', remarks: 'Within specification' },
  { no: 3, characteristic: 'Hole Diameter', spec: 'Ø20.0 ± 0.05', uom: 'mm', samples: [19.98, 20.01, 19.99, 20.02, 20.00], result: 'OK', judgement: 'Accepted', remarks: 'Within specification' },
  { no: 4, characteristic: 'Surface Finish', spec: 'Ra ≤ 3.2', uom: 'µm', samples: [2.9, 3.1, 2.8, 3.0, 2.9], result: 'OK', judgement: 'Accepted', remarks: 'Within specification' },
  { no: 5, characteristic: 'Appearance', spec: 'No cracks, burrs, defects', uom: 'Nos', samples: ['OK', 'OK', 'OK', 'OK', 'OK'], result: 'OK', judgement: 'Accepted', remarks: 'No visible defects' },
];

function SectionTitle({ icon: Icon, children, action }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Icon fontSize="small" color="primary" />
        <Typography variant="subtitle1" fontWeight={700} color="primary.main">{children}</Typography>
      </Stack>
      {action}
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
      <Typography variant="body2" color="primary.main">Final Inspection</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>New Final Inspection</Typography> */}
    </Stack>
  );
}

export default function NewFinalInspection() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(() => new Set());
  const [resultChecked, setResultChecked] = useState(() => new Set());

  const toggleRow = (setFn, no) => {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/quality/final-inspection')}>Back to List</Button>
        <Button variant="contained" startIcon={<SaveOutlinedIcon />}>Save</Button>
        <Button variant="contained" startIcon={<NoteAddOutlinedIcon />}>Save &amp; New</Button>
        <Button variant="outlined" startIcon={<VisibilityOutlinedIcon />}>Preview</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />} sx={{ bgcolor: '#17315c', '&:hover': { bgcolor: '#102244' } }}>Submit</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<FactCheckOutlinedIcon />}
        title="New Final Inspection"
        subtitle="Create and record final inspection for finished goods before dispatch."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionTitle icon={ArticleOutlinedIcon}>1. Inspection Information</SectionTitle>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Inspection No." value="Auto Generate" InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-input': { color: 'text.disabled' } }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Inspection Date" defaultValue="2026-10-02" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Production Order" defaultValue="PO-2026-001"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Item Code" defaultValue="FG-1001"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Item Description" defaultValue="Gear Housing" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Batch / Lot No." defaultValue="BCH-001"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Work Center" defaultValue="ASSEMBLY-01"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" required type="number" label="Quantity to Inspect" defaultValue={500} />
                <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                  {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inspection Type" defaultValue="Final">
                {['Final', 'Dimensional', 'Visual', 'Functional'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inspection Level" defaultValue="Normal">
                {['Reduced', 'Normal', 'Tightened'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Sampling Plan" defaultValue="AQL 1.0 (n=20, Ac=0, Re=1)" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" type="number" label="Sampling Qty" defaultValue={20} />
                <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                  {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Inspection By" defaultValue="Kannan P"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Customer" defaultValue="ABC Engineering Ltd."
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Drawing No." defaultValue="DR-1001"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Revision" defaultValue="02">
                {['01', '02', '03'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" type="date" label="Start Time" defaultValue="2026-10-02" InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="time" defaultValue="14:00" InputLabelProps={{ shrink: true }} sx={{ minWidth: 110 }} />
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" type="date" label="Expected Completion" defaultValue="2026-10-02" InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="time" defaultValue="15:00" InputLabelProps={{ shrink: true }} sx={{ minWidth: 110 }} />
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Status" defaultValue="In Progress" sx={{ '& .MuiInputBase-root': { bgcolor: 'warning.lighter' } }}>
                {['In Progress', 'Completed', 'On Hold'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" multiline minRows={1} label="Remarks" defaultValue="Final inspection for dispatch to customer." />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionTitle
            icon={GpsFixedOutlinedIcon}
            action={<Button variant="outlined" size="small" startIcon={<AddIcon />}>Add Characteristic</Button>}
          >
            2. Characteristics to Inspect
          </SectionTitle>
          <ScrollableTableContainer maxHeight="clamp(200px, 32vh, 340px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"><Checkbox size="small" /></TableCell>
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
                {CHARACTERISTICS.map((row) => (
                  <TableRow key={row.no} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(row.no)} onChange={() => toggleRow(setChecked, row.no)} />
                    </TableCell>
                    <TableCell>{row.no}</TableCell>
                    <TableCell>{row.characteristic}</TableCell>
                    <TableCell>{row.spec}</TableCell>
                    <TableCell>{row.method}</TableCell>
                    <TableCell>{row.plan}</TableCell>
                    <TableCell>{row.uom}</TableCell>
                    <TableCell align="right">{row.qty}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
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

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionTitle icon={AssessmentOutlinedIcon}>3. Inspection Results</SectionTitle>
          <ScrollableTableContainer maxHeight="clamp(200px, 32vh, 340px)">
            <Table size="small" stickyHeader sx={{ minWidth: 1100 }}>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"><Checkbox size="small" /></TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>Characteristic</TableCell>
                  <TableCell>Specification</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="center" colSpan={SAMPLE_COLS.length}>Sample No.</TableCell>
                  <TableCell>Result</TableCell>
                  <TableCell>Judgement</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  {SAMPLE_COLS.map((c) => <TableCell key={c} align="center">{c}</TableCell>)}
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {RESULTS.map((row) => (
                  <TableRow key={row.no} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={resultChecked.has(row.no)} onChange={() => toggleRow(setResultChecked, row.no)} />
                    </TableCell>
                    <TableCell>{row.no}</TableCell>
                    <TableCell>{row.characteristic}</TableCell>
                    <TableCell>{row.spec}</TableCell>
                    <TableCell>{row.uom}</TableCell>
                    {row.samples.map((s, idx) => <TableCell key={idx} align="center">{s}</TableCell>)}
                    <TableCell>{row.result}</TableCell>
                    <TableCell><Chip size="small" label={row.judgement} color="success" /></TableCell>
                    <TableCell>{row.remarks}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
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

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionTitle icon={AttachFileOutlinedIcon}>4. Attachments</SectionTitle>
              <Box
                sx={{
                  border: '1.5px dashed', borderColor: 'divider', borderRadius: 1.5,
                  py: 4, textAlign: 'center', color: 'text.secondary',
                }}
              >
                <CloudUploadOutlinedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" sx={{ mb: 1.5 }}>Drag &amp; Drop files here or</Typography>
                <Button variant="outlined" size="small">Browse Files</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionTitle icon={AssessmentOutlinedIcon}>5. Inspection Summary</SectionTitle>
              <Stack spacing={1.25} sx={{ mb: 2 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Total Characteristics</Typography>
                  <Chip size="small" label="5" color="default" />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Accepted</Typography>
                  <Chip size="small" label="5" color="success" />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Rejected</Typography>
                  <Chip size="small" label="0" color="error" />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" color="text.secondary">Result</Typography>
                  <Chip size="small" label="Accepted" color="success" />
                </Stack>
              </Stack>
              <TextField fullWidth size="small" multiline minRows={2} label="Remarks" defaultValue="All inspected characteristics are within specification." />
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionTitle icon={PersonOutlineOutlinedIcon}>6. Approval</SectionTitle>
              <Stack spacing={2}>
                <TextField
                  fullWidth size="small" label="Prepared By" defaultValue="Kannan P"
                  InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <TextField
                  fullWidth size="small" label="Approved By" defaultValue="Radhakrishnan"
                  InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <TextField fullWidth size="small" type="date" label="Approval Date" defaultValue="2026-10-02" InputLabelProps={{ shrink: true }} />
                <TextField fullWidth size="small" select label="Approval Status" defaultValue="Pending" sx={{ '& .MuiInputBase-root': { bgcolor: 'warning.lighter' } }}>
                  {['Pending', 'Approved', 'Rejected'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
