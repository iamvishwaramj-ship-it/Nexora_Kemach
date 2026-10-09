import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
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
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import QrCodeScannerOutlinedIcon from '@mui/icons-material/QrCodeScannerOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "New Issue" (New Material Issue to Subcon) under Subcontracting -- rebuilt
// to pixel-match the user-supplied reference screenshot. Static UI-only
// mock; no Subcontracting data model exists in this schema.
// ---------------------------------------------------------------------------

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing', drawingNo: 'DR-001', spec: 'HT-01', uom: 'Nos', orderQty: 500, pendingQty: 500, issueQty: 100, rate: 250.0, remarks: 'Batch-1' },
  { no: 2, code: 'FG-1002', desc: 'Motor Bracket', drawingNo: 'DR-002', spec: 'QT-01', uom: 'Nos', orderQty: 300, pendingQty: 300, issueQty: 150, rate: 300.0, remarks: 'Batch-1' },
  { no: 3, code: 'FG-1003', desc: 'Valve Body', drawingNo: 'DR-003', spec: 'PL-01', uom: 'Nos', orderQty: 300, pendingQty: 300, issueQty: 100, rate: 280.0, remarks: 'Batch-1' },
  { no: 4, code: 'RM-2001', desc: 'Cast Iron Housing', drawingNo: 'DR-004', spec: 'CI-01', uom: 'Nos', orderQty: 400, pendingQty: 400, issueQty: 100, rate: 150.0, remarks: 'Material for HT' },
];

const DOCUMENTS = [
  { name: 'GatePass_MIS-001.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
  { name: 'ProcessSheet_HT.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
  { name: 'InspectionPlan.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
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
      <Typography variant="body2" color="primary.main">Material Issue to Subcon</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>New Issue</Typography> */}
    </Stack>
  );
}

export default function SubconNewIssue() {
  const navigate = useNavigate();

  const [issueDate, setIssueDate] = useState('2026-10-01');
  const [scoNo, setScoNo] = useState('SCO-2026-001');
  const [vendorCode, setVendorCode] = useState('V-001');
  const [vendorName] = useState('Sri Balaji Heat Treatment');
  const [poNo, setPoNo] = useState('PO-2026-001');
  const [workCenter, setWorkCenter] = useState('Heat Treatment');
  const [issueType, setIssueType] = useState('Raw Material');
  const [department, setDepartment] = useState('Production');
  const [expectedReturn, setExpectedReturn] = useState('2026-10-25');
  const [referenceNo, setReferenceNo] = useState('');
  const [vehicleNo, setVehicleNo] = useState('TN 37 AB 1234');
  const [issuedBy, setIssuedBy] = useState('Kannan P');
  const [remarks, setRemarks] = useState('Material issued for heat treatment as per process sheet.');

  const [items, setItems] = useState(INITIAL_ITEMS);
  const [checked, setChecked] = useState(() => new Set());

  const [packingType, setPackingType] = useState('Pallet');
  const [noOfPackages, setNoOfPackages] = useState(5);
  const [grossWeight, setGrossWeight] = useState(520.0);
  const [transporter, setTransporter] = useState('ABC Logistics');
  const [lrNo, setLrNo] = useState('LR123456');
  const [dispatchDate, setDispatchDate] = useState('');
  const [preparedBy, setPreparedBy] = useState('2026-10-01');
  const [approvedBy, setApprovedBy] = useState('Radhakrishnan');

  const [freightCharges, setFreightCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);

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
      { no: prev.length ? Math.max(...prev.map((p) => p.no)) + 1 : 1, code: '', desc: '', drawingNo: '', spec: '', uom: 'Nos', orderQty: 0, pendingQty: 0, issueQty: 0, rate: 0, remarks: '' },
    ]);
  };

  const totals = useMemo(() => {
    const totalItems = items.length;
    const totalQuantity = items.reduce((s, it) => s + Number(it.issueQty || 0), 0);
    const totalIssueValue = items.reduce((s, it) => s + Number(it.issueQty || 0) * Number(it.rate || 0), 0);
    const netIssueValue = totalIssueValue + Number(freightCharges || 0) + Number(otherCharges || 0);
    return { totalItems, totalQuantity, totalIssueValue, netIssueValue };
  }, [items, freightCharges, otherCharges]);

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/subcontracting/material-issue-to-subcon')}>
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
        icon={<Inventory2OutlinedIcon />}
        title="New Material Issue to Subcon"
        subtitle="Issue raw materials, components or semi-finished goods to subcontract vendor."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionHeading icon={DescriptionOutlinedIcon} label="1. Issue Information" />
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Issue No." value="" placeholder="Auto Generate" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Production Order No." value={poNo} onChange={(e) => setPoNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Reference No." placeholder="e.g., Gate Pass No." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Issue Date *" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Work Center / Process *" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {['Heat Treatment', 'CNC Machining', 'Surface Coating', 'Grinding'].map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vehicle No." value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Subcontract Order No. *" value={scoNo} onChange={(e) => setScoNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Issue Type *" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                {['Raw Material', 'Semi-Finished', 'Component'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Issued By *" value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Vendor Code *" value={vendorCode} onChange={(e) => setVendorCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                {['Production', 'Quality', 'Stores'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vendor Name" value={vendorName} InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Expected Return Date" value={expectedReturn} onChange={(e) => setExpectedReturn(e.target.value)} InputLabelProps={{ shrink: true }} />
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
              <Button variant="outlined" startIcon={<FileUploadOutlinedIcon />}>Import from PO</Button>
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
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Order Qty</TableCell>
                  <TableCell align="right">Pending Qty</TableCell>
                  <TableCell align="right">Issue Qty *</TableCell>
                  <TableCell align="right">Rate (₹)</TableCell>
                  <TableCell align="right">Issue Value (₹)</TableCell>
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
                    <TableCell>{it.uom}</TableCell>
                    <TableCell align="right">{it.orderQty}</TableCell>
                    <TableCell align="right">{it.pendingQty}</TableCell>
                    <TableCell align="right" sx={{ minWidth: 90 }}>
                      <TextField
                        size="small" type="number" value={it.issueQty}
                        onChange={(e) => updateItem(it.no, 'issueQty', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }}
                      />
                    </TableCell>
                    <TableCell align="right">{money(it.rate)}</TableCell>
                    <TableCell align="right">{money(it.issueQty * it.rate)}</TableCell>
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
              <SectionHeading icon={InfoOutlinedIcon} label="3. Additional Information" />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Packing Type" value={packingType} onChange={(e) => setPackingType(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" type="number" label="No. of Packages" value={noOfPackages} onChange={(e) => setNoOfPackages(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" type="number" label="Gross Weight (Kg)" value={grossWeight} onChange={(e) => setGrossWeight(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="Transporter" value={transporter} onChange={(e) => setTransporter(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" label="LR / Challan No." value={lrNo} onChange={(e) => setLrNo(e.target.value)} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" type="date" label="Dispatch Date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" type="date" label="Prepared By" value={preparedBy} onChange={(e) => setPreparedBy(e.target.value)} InputLabelProps={{ shrink: true }} />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth size="small" label="Approved By" value={approvedBy} onChange={(e) => setApprovedBy(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                  />
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
              <SectionHeading icon={FunctionsOutlinedIcon} label="5. Issue Summary" />
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Items</Typography>
                  <Typography variant="body2" fontWeight={700}>{totals.totalItems}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Quantity</Typography>
                  <Typography variant="body2" fontWeight={700}>{totals.totalQuantity} Nos</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Total Issue Value</Typography>
                  <Typography variant="body2" fontWeight={700}>{'₹'} {money(totals.totalIssueValue)}</Typography>
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Freight / Handling Charges</Typography>
                  <TextField
                    size="small" type="number" value={freightCharges}
                    onChange={(e) => setFreightCharges(Number(e.target.value))}
                    sx={{ width: 110 }}
                    inputProps={{ style: { textAlign: 'right' } }}
                  />
                </Stack>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Other Charges</Typography>
                  <TextField
                    size="small" type="number" value={otherCharges}
                    onChange={(e) => setOtherCharges(Number(e.target.value))}
                    sx={{ width: 110 }}
                    inputProps={{ style: { textAlign: 'right' } }}
                  />
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: 'success.lighter', borderRadius: 1, px: 1.5, py: 1.25 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Net Issue Value (₹)</Typography>
                  <Typography variant="subtitle1" fontWeight={700} color="success.dark">{money(totals.netIssueValue)}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
