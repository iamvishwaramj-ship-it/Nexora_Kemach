import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "New Inward" (New Subcontract Inward) under Subcontracting -- rebuilt to
// pixel-match the user-supplied reference screenshot. Static UI-only mock;
// no Subcontracting data model exists in this schema.
// ---------------------------------------------------------------------------

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing', drawingNo: 'DR-001', spec: 'HT-01', process: 'Heat Treatment', uom: 'Nos', orderQty: 500, pendingQty: 100, receivedQty: 100, acceptedQty: 98, rejectedQty: 2, rate: 250.0, remarks: 'OK' },
  { no: 2, code: 'FG-1002', desc: 'Motor Bracket', drawingNo: 'DR-002', spec: 'QT-01', process: 'CNC Machining', uom: 'Nos', orderQty: 300, pendingQty: 150, receivedQty: 150, acceptedQty: 150, rejectedQty: 0, rate: 300.0, remarks: 'OK' },
  { no: 3, code: 'FG-1003', desc: 'Valve Body', drawingNo: 'DR-003', spec: 'PL-01', process: 'Surface Coating', uom: 'Nos', orderQty: 300, pendingQty: 100, receivedQty: 100, acceptedQty: 95, rejectedQty: 5, rate: 280.0, remarks: 'Minor scratch' },
  { no: 4, code: 'RM-2001', desc: 'Cast Iron Housing', drawingNo: 'DR-004', spec: 'CI-01', process: 'Plating', uom: 'Nos', orderQty: 400, pendingQty: 100, receivedQty: 100, acceptedQty: 100, rejectedQty: 0, rate: 150.0, remarks: 'OK' },
];

const DOCUMENTS = [
  { name: 'GatePass_LR123456.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
  { name: 'InspectionReport.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
  { name: 'ProcessSheet.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
  { name: 'Photos.zip', type: 'ZIP', uploadedOn: '01-Oct-2026' },
];

function money(n) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

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
      <Typography variant="body2" color="primary.main">Subcontracting</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Subcontract Inward</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>New Inward</Typography> */}
    </Stack>
  );
}

export default function SubconNewInward() {
  const navigate = useNavigate();

  const [inwardDate, setInwardDate] = useState('2026-10-01');
  const [scoNo, setScoNo] = useState('SCO-2026-001');
  const [poNo, setPoNo] = useState('PO-2026-001');
  const [vendorCode, setVendorCode] = useState('V-001');
  const [vendorName] = useState('Sri Balaji Heat Treatment');
  const [workCenter, setWorkCenter] = useState('Heat Treatment');
  const [grnNo, setGrnNo] = useState('LR123456');
  const [grnDate, setGrnDate] = useState('2026-10-01');
  const [vehicleNo, setVehicleNo] = useState('TN 37 AB 1234');
  const [receivedBy, setReceivedBy] = useState('Kannan P');
  const [inspectionRequired, setInspectionRequired] = useState('Yes');
  const [department, setDepartment] = useState('Production');
  const [inwardType, setInwardType] = useState('Processed Components');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('Received material as per process sheet.');

  const [items, setItems] = useState(INITIAL_ITEMS);
  const [checked, setChecked] = useState(() => new Set());

  const [inspectionStatus, setInspectionStatus] = useState('Accepted');
  const [inspectionDate, setInspectionDate] = useState('2026-10-01');
  const [inspectedBy, setInspectedBy] = useState('Radhakrishnan');
  const [qualityReportNo, setQualityReportNo] = useState('QC-2026-001');
  const [inspectionRemarks, setInspectionRemarks] = useState('All items inspected and accepted.\nRejected items kept separately.');

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const updateItem = (no, field, value) => {
    setItems((prev) => prev.map((it) => (it.no === no ? { ...it, [field]: value } : it)));
  };

  const removeItem = (no) => {
    setItems((prev) => prev.filter((it) => it.no !== no));
    setChecked((prev) => {
      const next = new Set(prev);
      next.delete(no);
      return next;
    });
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { no: prev.length ? Math.max(...prev.map((p) => p.no)) + 1 : 1, code: '', desc: '', drawingNo: '', spec: '', process: '', uom: 'Nos', orderQty: 0, pendingQty: 0, receivedQty: 0, acceptedQty: 0, rejectedQty: 0, rate: 0, remarks: '' },
    ]);
  };

  const totals = useMemo(() => {
    const totalItems = items.length;
    const totalReceived = items.reduce((s, it) => s + Number(it.receivedQty || 0), 0);
    const totalAccepted = items.reduce((s, it) => s + Number(it.acceptedQty || 0), 0);
    const totalRejected = items.reduce((s, it) => s + Number(it.rejectedQty || 0), 0);
    const totalInwardValue = items.reduce((s, it) => s + Number(it.receivedQty || 0) * Number(it.rate || 0), 0);
    return { totalItems, totalReceived, totalAccepted, totalRejected, totalInwardValue };
  }, [items]);

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/subcontracting/subcontract-inward')}>
          Back to List
        </Button>
        <Button variant="contained" startIcon={<SaveOutlinedIcon />}>Save</Button>
        <Button variant="contained" startIcon={<LibraryAddOutlinedIcon />}>Save &amp; New</Button>
        <Button variant="outlined" startIcon={<VisibilityOutlinedIcon />}>Preview</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />} sx={{ bgcolor: '#17315c', '&:hover': { bgcolor: '#102244' } }}>Submit</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<MoveToInboxOutlinedIcon />}
        title="New Subcontract Inward"
        subtitle="Receive processed components or semi-finished goods from subcontract vendor."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionHeading icon={DescriptionOutlinedIcon} label="1. Inward Information" />
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Inward No." placeholder="Auto Generate" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Work Center / Process *" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {['Heat Treatment', 'CNC Machining', 'Surface Coating', 'Grinding'].map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                {['Production', 'Quality', 'Stores'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Inward Date *" value={inwardDate} onChange={(e) => setInwardDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="GRN / LR No." value={grnNo} onChange={(e) => setGrnNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inward Type" value={inwardType} onChange={(e) => setInwardType(e.target.value)}>
                {['Processed Components', 'Semi-Finished', 'Rejected Return'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Subcontract Order No. *" value={scoNo} onChange={(e) => setScoNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="GRN / LR Date" value={grnDate} onChange={(e) => setGrnDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Reference No." placeholder="e.g., Gate Pass No." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Production Order No." value={poNo} onChange={(e) => setPoNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vehicle No." value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Vendor Code *" value={vendorCode} onChange={(e) => setVendorCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Received By *" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vendor Name" value={vendorName} InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inspection Required" value={inspectionRequired} onChange={(e) => setInspectionRequired(e.target.value)}>
                {['Yes', 'No'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
            <SectionHeading icon={AssignmentOutlinedIcon} label="2. Item Details" />
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button variant="contained" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              <Button variant="outlined" startIcon={<FileUploadOutlinedIcon />}>Import from Order</Button>
              <Button variant="outlined" startIcon={<QrCodeScannerOutlinedIcon />}>Scan (Barcode)</Button>
              <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}>Delete</Button>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 640px), 420px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell>Drawing No.</TableCell>
                  <TableCell>Specification</TableCell>
                  <TableCell>Process</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Order Qty</TableCell>
                  <TableCell align="right">Pending Qty</TableCell>
                  <TableCell align="right">Received Qty *</TableCell>
                  <TableCell align="right">Accepted Qty</TableCell>
                  <TableCell align="right">Rejected Qty *</TableCell>
                  <TableCell align="right">Rate (₹)</TableCell>
                  <TableCell align="right">Amount (₹)</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={it.no} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(it.no)} onChange={() => toggleRow(it.no)} />
                    </TableCell>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{it.code}</Typography></TableCell>
                    <TableCell>{it.desc}</TableCell>
                    <TableCell>{it.drawingNo}</TableCell>
                    <TableCell>{it.spec}</TableCell>
                    <TableCell>{it.process}</TableCell>
                    <TableCell>{it.uom}</TableCell>
                    <TableCell align="right">{it.orderQty}</TableCell>
                    <TableCell align="right">{it.pendingQty}</TableCell>
                    <TableCell align="right" sx={{ minWidth: 90 }}>
                      <TextField
                        size="small" type="number" value={it.receivedQty}
                        onChange={(e) => updateItem(it.no, 'receivedQty', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 90 }}>
                      <TextField
                        size="small" type="number" value={it.acceptedQty}
                        onChange={(e) => updateItem(it.no, 'acceptedQty', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }}
                      />
                    </TableCell>
                    <TableCell align="right" sx={{ minWidth: 90 }}>
                      <TextField
                        size="small" type="number" value={it.rejectedQty}
                        onChange={(e) => updateItem(it.no, 'rejectedQty', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }}
                      />
                    </TableCell>
                    <TableCell align="right">{money(it.rate)}</TableCell>
                    <TableCell align="right">{money(it.receivedQty * it.rate)}</TableCell>
                    <TableCell sx={{ minWidth: 110 }}>
                      <TextField size="small" value={it.remarks} onChange={(e) => updateItem(it.no, 'remarks', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small"><EditOutlinedIcon fontSize="small" color="primary" /></IconButton>
                        <IconButton size="small" onClick={() => removeItem(it.no)}><DeleteOutlineIcon fontSize="small" color="error" /></IconButton>
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
              <SectionHeading icon={RuleOutlinedIcon} label="3. Inspection Details" />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" select label="Inspection Status" value={inspectionStatus} onChange={(e) => setInspectionStatus(e.target.value)}
                    sx={{ '& .MuiInputBase-input': { color: 'success.dark', fontWeight: 600 } }}
                  >
                    {['Accepted', 'Pending', 'Rejected'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" type="date" label="Inspection Date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" label="Inspected By" value={inspectedBy} onChange={(e) => setInspectedBy(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Quality Report No." value={qualityReportNo} onChange={(e) => setQualityReportNo(e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={inspectionRemarks} onChange={(e) => setInspectionRemarks(e.target.value)} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2.5 }}>
                <SectionHeading icon={AttachFileOutlinedIcon} label="4. Documents" />
                <Button variant="outlined" size="small" startIcon={<FileUploadOutlinedIcon />}>Upload File</Button>
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
                      <TableCell><Typography variant="body2" color="primary.main">{d.name}</Typography></TableCell>
                      <TableCell>{d.type}</TableCell>
                      <TableCell>{d.uploadedOn}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small"><VisibilityIcon fontSize="small" color="primary" /></IconButton>
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
              <SectionHeading icon={FunctionsOutlinedIcon} label="5. Inward Summary" />
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Items</Typography>
                  <Typography variant="body2" fontWeight={700}>{totals.totalItems}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Received Quantity</Typography>
                  <Typography variant="body2" fontWeight={700}>{totals.totalReceived} Nos</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Accepted Quantity</Typography>
                  <Typography variant="body2" fontWeight={700} color="success.main">{totals.totalAccepted} Nos</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Rejected Quantity</Typography>
                  <Typography variant="body2" fontWeight={700} color="error.main">{totals.totalRejected} Nos</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: 'success.lighter', borderRadius: 1, px: 1.5, py: 1.25 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Total Inward Value (₹)</Typography>
                  <Typography variant="subtitle1" fontWeight={700} color="success.dark">{money(totals.totalInwardValue)}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
