import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  FormControlLabel, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import MoveToInboxOutlinedIcon from '@mui/icons-material/MoveToInboxOutlined';
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
// Static, UI-only mock of "New Inward" (receipt of processed goods from a
// vendor) under Production Execution > Subcontracting. No reference
// screenshots supplied. Received goods start as "pending inspection" --
// Accepted Qty is left blank here deliberately since that is decided on the
// Quality Inspection screen, not at the point of receipt.
// ---------------------------------------------------------------------------

const VENDORS = ['Precision Platers Pvt Ltd', 'Shree Heat Treatment Works', 'Apex Coatings Ltd', 'Sun Plating Industries', 'Metro Surface Finishers'];
const SUBCONTRACT_ORDERS = ['SC-2026-014', 'SC-2026-013', 'SC-2026-012', 'SC-2026-011'];

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1002', desc: 'Cover Plate', uom: 'Nos', challanQty: 300, receivedQty: 300, remarks: 'Powder coated as specified' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function SubconNewInward() {
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [inwardNo] = useState('SCI-2026-032');
  const [inwardDate, setInwardDate] = useState('2026-10-09');
  const [subcontractOrder, setSubcontractOrder] = useState('SC-2026-012');
  const [vendor, setVendor] = useState('Apex Coatings Ltd');
  const [challanNo, setChallanNo] = useState('VCH-5521');
  const [challanDate, setChallanDate] = useState('2026-10-09');
  const [vehicleNo, setVehicleNo] = useState('TN-09-CD-7781');
  const [plant, setPlant] = useState('Main Plant');
  const [notes, setNotes] = useState('Goods received as per vendor delivery challan; pending quality inspection.');

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
      { no: (prev[prev.length - 1]?.no || 0) + 1, code: '', desc: '', uom: '', challanQty: 0, receivedQty: 0, remarks: '' },
    ]);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<MoveToInboxOutlinedIcon />}
        title="New Inward - Subcontract Inward"
        subtitle="Record goods received back from a vendor against a subcontract order, pending quality inspection."
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Inward Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Inward No." value={inwardNo} disabled />
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                label={<Typography variant="caption">Auto Generate</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required type="date" label="Inward Date" value={inwardDate} onChange={(e) => setInwardDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Subcontract Order No." value={subcontractOrder} onChange={(e) => setSubcontractOrder(e.target.value)}>
                {SUBCONTRACT_ORDERS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                {VENDORS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vendor Challan No." value={challanNo} onChange={(e) => setChallanNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Challan Date" value={challanDate} onChange={(e) => setChallanDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vehicle No." value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Plant / Store" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Items Received</Typography>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              <Button size="small" variant="outlined" startIcon={<DownloadDoneOutlinedIcon />}>Import from Subcontract Order</Button>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 620px), 320px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Item Code *</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Item Description</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Challan Qty</TableCell>
                  <TableCell align="right" sx={{ minWidth: 100 }}>Received Qty *</TableCell>
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
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={it.challanQty}
                        onChange={(e) => updateItem(it.no, 'challanQty', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={it.receivedQty}
                        onChange={(e) => updateItem(it.no, 'receivedQty', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 70 }}
                      />
                    </TableCell>
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
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            Accepted / rejected quantities are recorded during Quality Inspection, once this inward is submitted.
          </Typography>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2.5 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Notes</Typography>
          <TextField
            fullWidth multiline minRows={4} value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            placeholder="Add any notes about this inward receipt..."
          />
          <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 0.5 }}>{notes.length}/500</Typography>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>Back to List</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<RestartAltIcon />}>Reset</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />}>Save as Draft</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />}>Submit for Inspection</Button>
      </Stack>
    </Box>
  );
}
