import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import LocalPrintshopOutlinedIcon from '@mui/icons-material/LocalPrintshopOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "New Inspection" (New Quality Inspection) under Subcontracting -- rebuilt
// to pixel-match the user-supplied reference screenshot. Static UI-only
// mock; no Subcontracting data model exists in this schema.
// ---------------------------------------------------------------------------

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing', uom: 'Nos', expectedQty: 500, receivedQty: 500, inspectedQty: 500, acceptedQty: 480, rejectedQty: 20, remarks: 'Minor dimensional issue' },
  { no: 2, code: 'FG-1002', desc: 'Motor Bracket', uom: 'Nos', expectedQty: 300, receivedQty: 300, inspectedQty: 300, acceptedQty: 300, rejectedQty: 0, remarks: 'OK' },
  { no: 3, code: 'FG-1003', desc: 'Valve Body', uom: 'Nos', expectedQty: 300, receivedQty: 300, inspectedQty: 300, acceptedQty: 295, rejectedQty: 5, remarks: 'Surface scratch' },
];

const REJECTED_ITEMS = [
  { no: 1, code: 'FG-1001', qty: 20, reason: 'Minor dimensional issue' },
  { no: 2, code: 'FG-1003', qty: 5, reason: 'Surface scratch' },
];

function money(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function SectionHeading({ icon: Icon, label, color = 'primary.main' }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
      <Icon fontSize="small" sx={{ color }} />
      <Typography variant="subtitle1" fontWeight={700} sx={{ color }}>{label}</Typography>
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
      <Typography variant="body2" color="primary.main">Quality Inspection</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>New Inspection</Typography> */}
    </Stack>
  );
}

export default function SubconNewInspection() {
  const navigate = useNavigate();

  const [inspectionDate, setInspectionDate] = useState('2026-10-01');
  const [scoNo, setScoNo] = useState('SCO-2026-001');
  const [vendorName] = useState('Sri Balaji Heat Treatment');
  const [vendorCode, setVendorCode] = useState('V-001');
  const [workCenter, setWorkCenter] = useState('Heat Treatment');
  const [inspectionType, setInspectionType] = useState('Incoming Inspection');
  const [department, setDepartment] = useState('Production');
  const [referenceNo, setReferenceNo] = useState('LR123456');
  const [inspectionBy, setInspectionBy] = useState('Kannan P');
  const [inspectionStatus, setInspectionStatus] = useState('In Progress');
  const [remarks, setRemarks] = useState('Routine quality check for heat treatment process.');

  const [items, setItems] = useState(INITIAL_ITEMS);
  const [checked, setChecked] = useState(() => new Set());

  const [testParameter, setTestParameter] = useState('Visual & Dimension Check');
  const [standardSpec, setStandardSpec] = useState('As per Drawing');
  const [measuredValue, setMeasuredValue] = useState('Within tolerance');
  const [testResult] = useState('Pass');
  const [testRemarks, setTestRemarks] = useState('All items as per standard except mentioned above.');

  const [additionalNotes, setAdditionalNotes] = useState('Heat treatment process completed. 20 pcs with minor dimension issue kept for rework.');

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

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { no: prev.length ? Math.max(...prev.map((p) => p.no)) + 1 : 1, code: '', desc: '', uom: 'Nos', expectedQty: 0, receivedQty: 0, inspectedQty: 0, acceptedQty: 0, rejectedQty: 0, remarks: '' },
    ]);
  };

  const totals = useMemo(() => {
    const totalInspected = items.reduce((s, it) => s + Number(it.inspectedQty || 0), 0);
    const totalAccepted = items.reduce((s, it) => s + Number(it.acceptedQty || 0), 0);
    const totalRejected = items.reduce((s, it) => s + Number(it.rejectedQty || 0), 0);
    const totalPending = Math.max(totalInspected - totalAccepted - totalRejected, 0);
    const acceptancePct = totalInspected ? ((totalAccepted / totalInspected) * 100).toFixed(2) : '0.00';
    return { totalInspected, totalAccepted, totalRejected, totalPending, acceptancePct };
  }, [items]);

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/subcontracting/quality-inspection')}>
          Back to List
        </Button>
        <Button variant="contained" startIcon={<SaveOutlinedIcon />}>Save</Button>
        <Button variant="contained" startIcon={<LibraryAddOutlinedIcon />}>Save &amp; New</Button>
        <Button variant="outlined" startIcon={<LocalPrintshopOutlinedIcon />}>Print</Button>
      </Stack>
    </Stack>
  );

  const RESULT_TILES = [
    { label: 'Total Inspected', value: money(totals.totalInspected), icon: CheckCircleOutlineIcon, color: 'success' },
    { label: 'Accepted', value: money(totals.totalAccepted), icon: CheckCircleOutlineIcon, color: 'success' },
    { label: 'Rejected', value: money(totals.totalRejected), icon: CancelOutlinedIcon, color: 'error' },
    { label: 'Pending', value: money(totals.totalPending), icon: AccessTimeOutlinedIcon, color: 'info' },
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<RuleOutlinedIcon />}
        title="New Quality Inspection"
        subtitle="Record quality inspection for received components or finished goods."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionHeading icon={DescriptionOutlinedIcon} label="Inspection Header Details" />
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Inspection No." placeholder="Auto Generate" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Work Center / Process" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {['Heat Treatment', 'CNC Machining', 'Surface Coating', 'Grinding'].map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inspection Status" value={inspectionStatus} onChange={(e) => setInspectionStatus(e.target.value)}>
                {['In Progress', 'Completed', 'Pending'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" multiline minRows={4} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Inspection Date *" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Inspection Type *" value={inspectionType} onChange={(e) => setInspectionType(e.target.value)}>
                {['Incoming Inspection', 'In-Process Inspection', 'Final Inspection'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
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
              <TextField fullWidth size="small" select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                {['Production', 'Quality', 'Stores'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vendor Name" value={vendorName} InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Reference No." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Vendor Code" value={vendorCode} onChange={(e) => setVendorCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Inspection By *" value={inspectionBy} onChange={(e) => setInspectionBy(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
            <SectionHeading icon={AssignmentOutlinedIcon} label="Item Details" />
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button variant="contained" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              <Button variant="outlined" startIcon={<FileUploadOutlinedIcon />}>Import from Order</Button>
              <Button variant="outlined" startIcon={<QrCodeScannerOutlinedIcon />}>Scan (Barcode)</Button>
              <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}>Delete</Button>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 680px), 360px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Expected Qty</TableCell>
                  <TableCell align="right">Received Qty</TableCell>
                  <TableCell align="right">Inspected Qty</TableCell>
                  <TableCell align="right">Accepted Qty</TableCell>
                  <TableCell align="right">Rejected Qty</TableCell>
                  <TableCell>Remarks</TableCell>
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
                    <TableCell>{it.uom}</TableCell>
                    <TableCell align="right">{money(it.expectedQty)}</TableCell>
                    <TableCell align="right">{money(it.receivedQty)}</TableCell>
                    <TableCell align="right" sx={{ minWidth: 90 }}>
                      <TextField
                        size="small" type="number" value={it.inspectedQty}
                        onChange={(e) => updateItem(it.no, 'inspectedQty', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }}
                      />
                    </TableCell>
                    <TableCell align="right">{money(it.acceptedQty)}</TableCell>
                    <TableCell align="right">{money(it.rejectedQty)}</TableCell>
                    <TableCell>{it.remarks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
            Showing 1 to {items.length} of {items.length} records
          </Typography>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeading icon={FactCheckOutlinedIcon} label="Inspection Result Summary" />
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                {RESULT_TILES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <Grid item xs={6} key={t.label}>
                      <Card variant="outlined" sx={{ bgcolor: `${t.color}.lighter`, border: 'none' }}>
                        <CardContent sx={{ textAlign: 'center', py: 2 }}>
                          <Box sx={{ width: 36, height: 36, borderRadius: '50%', mx: 'auto', mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${t.color}.main`, color: '#fff' }}>
                            <Icon fontSize="small" />
                          </Box>
                          <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{t.value}</Typography>
                          <Typography variant="caption" color="text.secondary">{t.label}</Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: 'success.lighter', borderRadius: 1, px: 1.5, py: 1.25 }}>
                <Typography variant="subtitle2" fontWeight={700}>Acceptance %</Typography>
                <Typography variant="h6" fontWeight={700} color="success.dark">{totals.acceptancePct} %</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeading icon={CancelOutlinedIcon} label="Rejected Items (if any)" color="error.main" />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>Item Code</TableCell>
                    <TableCell align="right">Qty</TableCell>
                    <TableCell>Reason</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {REJECTED_ITEMS.map((r) => (
                    <TableRow key={r.no} hover>
                      <TableCell>{r.no}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.code}</Typography></TableCell>
                      <TableCell align="right">{r.qty}</TableCell>
                      <TableCell>{r.reason}</TableCell>
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
              <SectionHeading icon={FactCheckOutlinedIcon} label="Quality Test Details" color="warning.dark" />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" select label="Test Parameter" value={testParameter} onChange={(e) => setTestParameter(e.target.value)}>
                    {['Visual & Dimension Check', 'Hardness Test', 'Surface Finish Check'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" select label="Standard / Spec" value={standardSpec} onChange={(e) => setStandardSpec(e.target.value)}>
                    {['As per Drawing', 'As per Process Sheet', 'Customer Spec'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" label="Measured Value" value={measuredValue} onChange={(e) => setMeasuredValue(e.target.value)} />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>Result</Typography>
                  <Box sx={{ bgcolor: 'success.lighter', borderRadius: 1, px: 1.5, py: 1 }}>
                    <Typography variant="subtitle1" fontWeight={700} color="success.dark">{testResult}</Typography>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={testRemarks} onChange={(e) => setTestRemarks(e.target.value)} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card variant="outlined" sx={{ mt: 2 }}>
        <CardContent>
          <SectionHeading icon={DescriptionOutlinedIcon} label="Additional Notes" />
          <TextField fullWidth size="small" multiline minRows={2} value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} />
        </CardContent>
      </Card>
    </Box>
  );
}
