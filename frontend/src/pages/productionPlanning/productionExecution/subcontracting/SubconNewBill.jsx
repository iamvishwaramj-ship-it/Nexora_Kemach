import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  FormControlLabel, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import AddIcon from '@mui/icons-material/Add';
import DownloadDoneOutlinedIcon from '@mui/icons-material/DownloadDoneOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EntityHeaderCard from '../../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of "New Bill" (vendor billing for subcontracted
// processes) under Production Execution > Subcontracting. No reference
// screenshots supplied. Billed quantity defaults to the accepted quantity
// from Quality Inspection -- rejected quantity is never billable.
// ---------------------------------------------------------------------------

const VENDORS = ['Precision Platers Pvt Ltd', 'Shree Heat Treatment Works', 'Apex Coatings Ltd', 'Sun Plating Industries', 'Metro Surface Finishers'];
const SUBCONTRACT_ORDERS = ['SC-2026-014', 'SC-2026-013', 'SC-2026-012', 'SC-2026-011'];
const PAYMENT_TERMS = ['Net 15 Days', 'Net 30 Days', 'Net 45 Days', 'Advance'];

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1002', desc: 'Cover Plate', uom: 'Nos', acceptedQty: 290, rate: 42, remarks: '' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function SubconNewBill() {
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [billNo] = useState('SCB-2026-052');
  const [billDate, setBillDate] = useState('2026-10-09');
  const [vendor, setVendor] = useState('Apex Coatings Ltd');
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('INV-AC-2026-0871');
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState('2026-10-08');
  const [subcontractOrder, setSubcontractOrder] = useState('SC-2026-012');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [freight, setFreight] = useState(0);
  const [taxPct, setTaxPct] = useState(18);
  const [notes, setNotes] = useState('Bill raised for accepted quantity as per Quality Inspection QI-2026-040.');

  const [items, setItems] = useState(INITIAL_ITEMS);
  const [checked, setChecked] = useState(() => new Set());

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

  const removeItem = (no) => setItems((prev) => prev.filter((it) => it.no !== no));

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { no: (prev[prev.length - 1]?.no || 0) + 1, code: '', desc: '', uom: '', acceptedQty: 0, rate: 0, remarks: '' },
    ]);
  };

  const subTotal = items.reduce((s, it) => s + Number(it.acceptedQty || 0) * Number(it.rate || 0), 0);
  const taxAmount = Math.round(subTotal * (Number(taxPct || 0) / 100));
  const grandTotal = subTotal + Number(freight || 0) + taxAmount;

  return (
    <Box>
      <EntityHeaderCard
        icon={<ReceiptLongOutlinedIcon />}
        title="New Bill - Subcontract Bills"
        subtitle="Raise a vendor bill for accepted quantities under a subcontract order."
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Bill Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Bill No." value={billNo} disabled />
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                label={<Typography variant="caption">Auto Generate</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required type="date" label="Bill Date" value={billDate} onChange={(e) => setBillDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                {VENDORS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Subcontract Order No." value={subcontractOrder} onChange={(e) => setSubcontractOrder(e.target.value)}>
                {SUBCONTRACT_ORDERS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vendor Invoice No." value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Vendor Invoice Date" value={vendorInvoiceDate} onChange={(e) => setVendorInvoiceDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Payment Terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)}>
                {PAYMENT_TERMS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Billed Items</Typography>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              <Button size="small" variant="outlined" startIcon={<DownloadDoneOutlinedIcon />}>Import Accepted Qty from Inspection</Button>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 600px), 320px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Item Description</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Accepted Qty</TableCell>
                  <TableCell align="right" sx={{ minWidth: 90 }}>Rate</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.no} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(it.no)} onChange={() => toggleRow(it.no)} />
                    </TableCell>
                    <TableCell>{it.no}</TableCell>
                    <TableCell>
                      <TextField size="small" variant="standard" value={it.code} onChange={(e) => updateItem(it.no, 'code', e.target.value)} />
                    </TableCell>
                    <TableCell>{it.desc}</TableCell>
                    <TableCell>{it.uom}</TableCell>
                    <TableCell align="right">{numberFmt(it.acceptedQty)}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={it.rate}
                        onChange={(e) => updateItem(it.no, 'rate', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell align="right">{numberFmt(Number(it.acceptedQty || 0) * Number(it.rate || 0))}</TableCell>
                    <TableCell>
                      <TextField size="small" variant="standard" value={it.remarks} onChange={(e) => updateItem(it.no, 'remarks', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" color="error" onClick={() => removeItem(it.no)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Notes</Typography>
              <TextField
                fullWidth multiline minRows={6} value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                placeholder="Add any notes about this bill..."
              />
              <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 0.5 }}>{notes.length}/500</Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Charges &amp; Total</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth size="small" type="number" label="Freight / Other Charges" value={freight}
                    onChange={(e) => setFreight(Number(e.target.value))}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth size="small" type="number" label="Tax %" value={taxPct}
                    onChange={(e) => setTaxPct(Number(e.target.value))}
                  />
                </Grid>
              </Grid>
              <Stack spacing={0.75} sx={{ mt: 2.5 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Sub Total</Typography>
                  <Typography variant="body2" fontWeight={600}>₹ {numberFmt(subTotal)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Freight / Other Charges</Typography>
                  <Typography variant="body2" fontWeight={600}>₹ {numberFmt(freight)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">Tax ({taxPct}%)</Typography>
                  <Typography variant="body2" fontWeight={600}>₹ {numberFmt(taxAmount)}</Typography>
                </Stack>
                <Stack direction="row" justifyContent="space-between" sx={{ pt: 0.5, borderTop: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="subtitle1" fontWeight={700}>Grand Total</Typography>
                  <Typography variant="subtitle1" fontWeight={700} color="primary.main">₹ {numberFmt(grandTotal)}</Typography>
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>Back to List</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<RestartAltIcon />}>Reset</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />}>Save as Draft</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />}>Submit for Approval</Button>
      </Stack>
    </Box>
  );
}
