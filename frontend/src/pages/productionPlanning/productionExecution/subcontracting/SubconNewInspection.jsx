import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  FormControlLabel, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EntityHeaderCard from '../../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of "New Inspection" (quality inspection of goods
// received from a subcontract vendor) under Production Execution >
// Subcontracting. No reference screenshots supplied. Each line item's
// Accepted/Rejected quantities are entered here and must sum to the
// Inspected Qty -- enforced loosely via a derived balance column, with no
// hard validation since this is a static mock with no backing data model.
// ---------------------------------------------------------------------------

const VENDORS = ['Precision Platers Pvt Ltd', 'Shree Heat Treatment Works', 'Apex Coatings Ltd', 'Sun Plating Industries', 'Metro Surface Finishers'];
const INWARDS = ['SCI-2026-031', 'SCI-2026-030', 'SCI-2026-029', 'SCI-2026-028'];
const REJECTION_REASONS = ['', 'Dimensional Mismatch', 'Surface Defect', 'Coating Thickness Low', 'Material Damage', 'Other'];

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1002', desc: 'Cover Plate', uom: 'Nos', inspectedQty: 300, acceptedQty: 290, rejectedQty: 10, reason: 'Surface Defect' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function SubconNewInspection() {
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [inspectionNo] = useState('QI-2026-042');
  const [inspectionDate, setInspectionDate] = useState('2026-10-09');
  const [inward, setInward] = useState('SCI-2026-031');
  const [vendor, setVendor] = useState('Apex Coatings Ltd');
  const [inspectedBy, setInspectedBy] = useState('Dheena S');
  const [notes, setNotes] = useState('Inspected as per the agreed vendor quality specification.');

  const [items, setItems] = useState(INITIAL_ITEMS);

  const updateItem = (no, field, value) => {
    setItems((prev) => prev.map((it) => {
      if (it.no !== no) return it;
      const next = { ...it, [field]: value };
      if (field === 'acceptedQty') next.rejectedQty = Math.max(0, Number(it.inspectedQty || 0) - Number(value || 0));
      if (field === 'rejectedQty') next.acceptedQty = Math.max(0, Number(it.inspectedQty || 0) - Number(value || 0));
      return next;
    }));
  };

  const totalInspected = items.reduce((s, it) => s + Number(it.inspectedQty || 0), 0);
  const totalAccepted = items.reduce((s, it) => s + Number(it.acceptedQty || 0), 0);
  const totalRejected = items.reduce((s, it) => s + Number(it.rejectedQty || 0), 0);

  return (
    <Box>
      <EntityHeaderCard
        icon={<RuleOutlinedIcon />}
        title="New Inspection - Quality Inspection"
        subtitle="Record the quality inspection result for goods received from a subcontract vendor."
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Inspection Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Inspection No." value={inspectionNo} disabled />
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                label={<Typography variant="caption">Auto Generate</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required type="date" label="Inspection Date" value={inspectionDate} onChange={(e) => setInspectionDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Inward No." value={inward} onChange={(e) => setInward(e.target.value)}>
                {INWARDS.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                {VENDORS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required label="Inspected By" value={inspectedBy} onChange={(e) => setInspectedBy(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Inspection Results</Typography>
          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 620px), 320px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>S.No</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Item Description</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Inspected Qty</TableCell>
                  <TableCell align="right" sx={{ minWidth: 100 }}>Accepted Qty *</TableCell>
                  <TableCell align="right" sx={{ minWidth: 100 }}>Rejected Qty *</TableCell>
                  <TableCell sx={{ minWidth: 160 }}>Rejection Reason</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.no} hover>
                    <TableCell>{it.no}</TableCell>
                    <TableCell>{it.code}</TableCell>
                    <TableCell>{it.desc}</TableCell>
                    <TableCell>{it.uom}</TableCell>
                    <TableCell align="right">{numberFmt(it.inspectedQty)}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={it.acceptedQty}
                        onChange={(e) => updateItem(it.no, 'acceptedQty', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={it.rejectedQty}
                        onChange={(e) => updateItem(it.no, 'rejectedQty', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        fullWidth size="small" select variant="standard" value={it.reason}
                        onChange={(e) => updateItem(it.no, 'reason', e.target.value)}
                      >
                        {REJECTION_REASONS.map((r) => <MenuItem key={r || 'none'} value={r}>{r || '-'}</MenuItem>)}
                      </TextField>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={4} />
                  <TableCell align="right"><Typography variant="body2" fontWeight={700}>{numberFmt(totalInspected)}</Typography></TableCell>
                  <TableCell align="right"><Typography variant="body2" fontWeight={700} color="success.main">{numberFmt(totalAccepted)}</Typography></TableCell>
                  <TableCell align="right"><Typography variant="body2" fontWeight={700} color="error.main">{numberFmt(totalRejected)}</Typography></TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2.5 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Notes</Typography>
          <TextField
            fullWidth multiline minRows={4} value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            placeholder="Add any notes about this inspection..."
          />
          <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 0.5 }}>{notes.length}/500</Typography>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>Back to List</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<RestartAltIcon />}>Reset</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />}>Save as Draft</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />}>Submit Inspection Result</Button>
      </Stack>
    </Box>
  );
}
