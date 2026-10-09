import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
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
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AssignmentOutlinedIcon from '@mui/icons-material/AssignmentOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "New Bill" (New Subcontract Bill) under Subcontracting -- rebuilt to
// pixel-match the user-supplied reference screenshot. Static UI-only mock;
// no Subcontracting data model exists in this schema.
// ---------------------------------------------------------------------------

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing', process: 'Heat Treatment', uom: 'Nos', receivedQty: 500, rate: 150.0, gstPct: 18, remarks: 'Batch B-001' },
  { no: 2, code: 'FG-1002', desc: 'Motor Bracket', process: 'CNC Machining', uom: 'Nos', receivedQty: 300, rate: 250.0, gstPct: 18, remarks: 'Batch B-002' },
  { no: 3, code: 'RM-2001', desc: 'Cast Iron Housing', process: 'Plating', uom: 'Nos', receivedQty: 400, rate: 120.0, gstPct: 18, remarks: 'As per spec.' },
  { no: 4, code: 'FG-1003', desc: 'Valve Body', process: 'Surface Coating', uom: 'Nos', receivedQty: 300, rate: 180.0, gstPct: 18, remarks: 'Batch B-003' },
];

const DOCUMENTS = [
  { name: 'Invoice_SBHT_125.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
  { name: 'SubcontractOrder.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
  { name: 'InspectionReport.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
  { name: 'GatePass.pdf', type: 'PDF', uploadedOn: '01-Oct-2026' },
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
      <Typography variant="body2" color="primary.main">Subcontract Bills</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>New Bill</Typography> */}
    </Stack>
  );
}

export default function SubconNewBill() {
  const navigate = useNavigate();

  const [billDate, setBillDate] = useState('2026-10-01');
  const [scoNo, setScoNo] = useState('SCO-2026-001');
  const [vendorCode, setVendorCode] = useState('V-001');
  const [vendorName] = useState('Sri Balaji Heat Treatment');
  const [workCenter, setWorkCenter] = useState('Heat Treatment');
  const [gstNo, setGstNo] = useState('33ABCDE1234F1Z5');
  const [invoiceNo, setInvoiceNo] = useState('SBHT/INV/2026/125');
  const [invoiceDate, setInvoiceDate] = useState('2026-10-01');
  const [currency, setCurrency] = useState('INR');
  const [referenceNo, setReferenceNo] = useState('PO-2026-001');
  const [referenceDate, setReferenceDate] = useState('2026-10-01');
  const [paymentTerms, setPaymentTerms] = useState('30 Days');
  const [remarks, setRemarks] = useState('As per subcontract order and received quantity.');

  const [items, setItems] = useState(INITIAL_ITEMS);
  const [checked, setChecked] = useState(() => new Set());

  const [gstType, setGstType] = useState('IGST (Inter-State)');
  const [gstPct, setGstPct] = useState(18);
  const [freightCharges, setFreightCharges] = useState(0);
  const [otherCharges, setOtherCharges] = useState(0);
  const [tdsApplicable, setTdsApplicable] = useState('No');
  const [tdsPct, setTdsPct] = useState(0);
  const [tcsApplicable, setTcsApplicable] = useState('No');
  const [tcsPct, setTcsPct] = useState(0);
  const [taxRemarks, setTaxRemarks] = useState('');

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
      { no: prev.length ? Math.max(...prev.map((p) => p.no)) + 1 : 1, code: '', desc: '', process: '', uom: 'Nos', receivedQty: 0, rate: 0, gstPct: 18, remarks: '' },
    ]);
  };

  const totals = useMemo(() => {
    const subTotal = items.reduce((s, it) => s + Number(it.receivedQty || 0) * Number(it.rate || 0), 0);
    const taxableAmount = subTotal + Number(freightCharges || 0) + Number(otherCharges || 0);
    const gstAmount = items.reduce((s, it) => s + (Number(it.receivedQty || 0) * Number(it.rate || 0) * Number(it.gstPct || 0)) / 100, 0);
    const tdsAmount = tdsApplicable === 'Yes' ? (taxableAmount * Number(tdsPct || 0)) / 100 : 0;
    const tcsAmount = tcsApplicable === 'Yes' ? (taxableAmount * Number(tcsPct || 0)) / 100 : 0;
    const totalBillValue = taxableAmount + gstAmount - tdsAmount + tcsAmount;
    return { subTotal, taxableAmount, gstAmount, tdsAmount, tcsAmount, totalBillValue };
  }, [items, freightCharges, otherCharges, tdsApplicable, tdsPct, tcsApplicable, tcsPct]);

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/subcontracting/subcontract-bills')}>
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
        icon={<ReceiptLongOutlinedIcon />}
        title="New Subcontract Bill"
        subtitle="Create subcontractor invoice for processed components or services."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionHeading icon={DescriptionOutlinedIcon} label="1. Bill Information" />
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Bill No." placeholder="Auto Generate" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Work Center / Process *" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {['Heat Treatment', 'CNC Machining', 'Surface Coating', 'Plating'].map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {['INR', 'USD', 'EUR'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Bill Date *" value={billDate} onChange={(e) => setBillDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="GST No." value={gstNo} onChange={(e) => setGstNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Reference No." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Subcontract Order No. *" value={scoNo} onChange={(e) => setScoNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Invoice No." value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Reference Date" value={referenceDate} onChange={(e) => setReferenceDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Vendor Code *" value={vendorCode} onChange={(e) => setVendorCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Invoice Date *" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3} />

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vendor Name" value={vendorName} InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Payment Terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                {['Immediate', '15 Days', '30 Days', '45 Days', '60 Days'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
            <SectionHeading icon={AssignmentOutlinedIcon} label="2. Bill Items" />
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button variant="contained" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              <Button variant="outlined" startIcon={<FileUploadOutlinedIcon />}>Import from Subcontract Inward</Button>
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
                  <TableCell>Process</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Received Qty</TableCell>
                  <TableCell align="right">Rate (₹)</TableCell>
                  <TableCell align="right">Amount (₹)</TableCell>
                  <TableCell align="right">GST %</TableCell>
                  <TableCell align="right">GST Amount (₹)</TableCell>
                  <TableCell align="right">Total Amount (₹)</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it, idx) => {
                  const amount = Number(it.receivedQty || 0) * Number(it.rate || 0);
                  const gstAmt = (amount * Number(it.gstPct || 0)) / 100;
                  return (
                    <TableRow key={it.no} hover>
                      <TableCell padding="checkbox">
                        <Checkbox size="small" checked={checked.has(it.no)} onChange={() => toggleRow(it.no)} />
                      </TableCell>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{it.code}</Typography></TableCell>
                      <TableCell>{it.desc}</TableCell>
                      <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{it.process}</Typography></TableCell>
                      <TableCell>{it.uom}</TableCell>
                      <TableCell align="right">{it.receivedQty}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 90 }}>
                        <TextField
                          size="small" type="number" value={it.rate}
                          onChange={(e) => updateItem(it.no, 'rate', Number(e.target.value))}
                          inputProps={{ style: { textAlign: 'right' } }}
                        />
                      </TableCell>
                      <TableCell align="right">{money(amount)}</TableCell>
                      <TableCell align="right" sx={{ minWidth: 80 }}>
                        <TextField select size="small" value={it.gstPct} onChange={(e) => updateItem(it.no, 'gstPct', Number(e.target.value))}>
                          {[0, 5, 12, 18, 28].map((p) => <MenuItem key={p} value={p}>{p}%</MenuItem>)}
                        </TextField>
                      </TableCell>
                      <TableCell align="right">{money(gstAmt)}</TableCell>
                      <TableCell align="right">{money(amount + gstAmt)}</TableCell>
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
                  );
                })}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionHeading icon={RequestQuoteOutlinedIcon} label="3. Tax & Charges" />
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" select label="GST Type" value={gstType} onChange={(e) => setGstType(e.target.value)}>
                    {['IGST (Inter-State)', 'CGST + SGST (Intra-State)'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" select label="GST %" value={gstPct} onChange={(e) => setGstPct(Number(e.target.value))}>
                    {[0, 5, 12, 18, 28].map((p) => <MenuItem key={p} value={p}>{p}%</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" type="number" label="Freight Charges (₹)" value={freightCharges} onChange={(e) => setFreightCharges(Number(e.target.value))} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" type="number" label="Other Charges (₹)" value={otherCharges} onChange={(e) => setOtherCharges(Number(e.target.value))} />
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" select label="TDS Applicable" value={tdsApplicable} onChange={(e) => setTdsApplicable(e.target.value)}>
                    {['No', 'Yes'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" select label="TDS %" value={tdsPct} onChange={(e) => setTdsPct(Number(e.target.value))}>
                    {[0, 1, 2, 5, 10].map((p) => <MenuItem key={p} value={p}>{p}%</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" select label="TCS Applicable" value={tcsApplicable} onChange={(e) => setTcsApplicable(e.target.value)}>
                    {['No', 'Yes'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={6}>
                  <TextField fullWidth size="small" select label="TCS %" value={tcsPct} onChange={(e) => setTcsPct(Number(e.target.value))}>
                    {[0, 1, 2, 5].map((p) => <MenuItem key={p} value={p}>{p}%</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth size="small" multiline minRows={2} label="Tax Remarks" value={taxRemarks} onChange={(e) => setTaxRemarks(e.target.value)} />
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
              <SectionHeading icon={FunctionsOutlinedIcon} label="5. Bill Summary" />
              <Stack spacing={1.5}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Sub Total (₹)</Typography>
                  <Typography variant="body2" fontWeight={700}>{money(totals.subTotal)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Freight Charges (₹)</Typography>
                  <Typography variant="body2" fontWeight={700}>{money(freightCharges)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Other Charges (₹)</Typography>
                  <Typography variant="body2" fontWeight={700}>{money(otherCharges)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Taxable Amount (₹)</Typography>
                  <Typography variant="body2" fontWeight={700}>{money(totals.taxableAmount)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">GST ({gstPct}%) (₹)</Typography>
                  <Typography variant="body2" fontWeight={700}>{money(totals.gstAmount)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">TDS (₹)</Typography>
                  <Typography variant="body2" fontWeight={700}>{money(totals.tdsAmount)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">TCS (₹)</Typography>
                  <Typography variant="body2" fontWeight={700}>{money(totals.tcsAmount)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: 'success.lighter', borderRadius: 1, px: 1.5, py: 1.25 }}>
                  <Typography variant="subtitle2" fontWeight={700}>Total Bill Value (₹)</Typography>
                  <Typography variant="subtitle1" fontWeight={700} color="success.dark">{money(totals.totalBillValue)}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
