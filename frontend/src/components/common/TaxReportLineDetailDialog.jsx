import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, Typography,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
} from '@mui/material';
import dayjs from 'dayjs';

const currency = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qty = (v) => Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const percent = (v) => (v === null || v === undefined || v === '' ? '—' : `${Number(v).toFixed(2)}%`);
const formatDate = (d) => (d ? dayjs(d).format('DD-MM-YYYY') : '—');

function Field({ label, value }) {
  return (
    <Grid item xs={12} sm={6} md={3}>
      <Typography variant="caption" color="text.secondary" component="div">{label}</Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value || value === 0 ? value : '—'}</Typography>
    </Grid>
  );
}

/**
 * Read-only detail popup opened from the eye icon on Input Tax Report /
 * Output Tax Report's own Input Tax / Output Tax column (see TaxReport.jsx
 * / OutputTaxReport.jsx). A tax report row is one document LINE, but the
 * ask here is to see the whole source document, so `lines` is every row
 * from that same report matching this row's own documentType+documentNo
 * (all already loaded client-side — both reports fetch every matching
 * line for the applied filters up front, so this never issues its own
 * request), not just the one line that was clicked. The dialog shows the
 * shared header fields once (Posting Date/Party/Party Ref No. are the same
 * across every line of one document) plus every one of its lines with
 * their own Item/Qty/Taxable Value/Tax/Invoice Total figures, and a Total
 * row summing the whole document — so a multi-line invoice shows in full,
 * not just the one line that happened to be clicked.
 *
 * taxLabel/taxField let one component serve both reports: Input Tax Report
 * passes ('Input Tax', 'inputTax'), Output Tax Report passes ('Output Tax',
 * 'outputTax') — same shape otherwise (see buildTaxReportRows in
 * backend/src/routes/resources.js).
 */
export default function TaxReportLineDetailDialog({
  open, onClose, lines, taxLabel, taxField,
}) {
  const head = lines?.[0];
  const totals = (lines || []).reduce((acc, l) => ({
    quantity: acc.quantity + Number(l.quantity || 0),
    taxableValue: acc.taxableValue + Number(l.taxableValue || 0),
    tax: acc.tax + Number(l[taxField] || 0),
    invoiceTotal: acc.invoiceTotal + Number(l.invoiceTotal || 0),
  }), { quantity: 0, taxableValue: 0, tax: 0, invoiceTotal: 0 });

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '85vh' } }}>
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        {head ? `${head.documentType} — ${head.documentNo}` : 'Document Detail'}
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        {head && (
          <>
            <Grid container spacing={2}>
              <Field label="Posting Date" value={formatDate(head.postingDate)} />
              <Field label="Customer/Vendor Code" value={head.partyCode} />
              <Field label="Customer/Vendor Name" value={head.partyName} />
              <Field label="Party Ref No." value={head.partyRefNo} />
            </Grid>

            <TableContainer sx={{ maxHeight: 320, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell align="right">Quantity</TableCell>
                    <TableCell align="right">Unit Price</TableCell>
                    <TableCell align="right">Taxable Value</TableCell>
                    <TableCell align="right">Tax %</TableCell>
                    <TableCell align="right">{taxLabel}</TableCell>
                    <TableCell align="right">Invoice Total</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(lines || []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{l.itemCode || '—'}</TableCell>
                      <TableCell sx={{ minWidth: 160 }}>{l.description || '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{qty(l.quantity)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(l.unitPrice)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(l.taxableValue)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{percent(l.taxPercent)}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(l[taxField])}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{currency(l.invoiceTotal)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>

            <Grid container spacing={2}>
              <Field label="Total Quantity" value={qty(totals.quantity)} />
              <Field label="Total Taxable Value" value={currency(totals.taxableValue)} />
              <Field label={`Total ${taxLabel}`} value={currency(totals.tax)} />
              <Field label="Invoice Total" value={currency(totals.invoiceTotal)} />
            </Grid>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
