import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  FormControlLabel, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import SearchIcon from '@mui/icons-material/Search';
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
// Static, UI-only mock of "New Issue" (material issue to a subcontract
// vendor) under Production Execution > Subcontracting. No reference
// screenshots supplied; follows the same header-fields + editable item
// table + bottom action bar convention as Create Requisition / Create
// Issue. No Subcontracting data model exists in this schema.
// ---------------------------------------------------------------------------

const VENDORS = ['Precision Platers Pvt Ltd', 'Shree Heat Treatment Works', 'Apex Coatings Ltd', 'Sun Plating Industries', 'Metro Surface Finishers'];
const SUBCONTRACT_ORDERS = ['SC-2026-014', 'SC-2026-013', 'SC-2026-012', 'SC-2026-011'];

const INITIAL_ITEMS = [
  { no: 1, code: 'RM-2001', desc: 'Cast Iron Casting', uom: 'Nos', required: 200, stock: 320, issueQty: 200, remarks: 'For electroplating' },
  { no: 2, code: 'RM-2010', desc: 'Pin Blank', uom: 'Nos', required: 150, stock: 180, issueQty: 150, remarks: '' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function SubconNewIssue() {
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [issueNo] = useState('MIS-2026-022');
  const [issueDate, setIssueDate] = useState('2026-10-09');
  const [subcontractOrder, setSubcontractOrder] = useState('SC-2026-014');
  const [vendor, setVendor] = useState('Precision Platers Pvt Ltd');
  const [plant, setPlant] = useState('Main Plant');
  const [challanNo, setChallanNo] = useState('CH-2026-0091');
  const [transporter, setTransporter] = useState('Agarwal Transport Co.');
  const [vehicleNo, setVehicleNo] = useState('TN-38-AB-4521');
  const [notes, setNotes] = useState('Material issued as per Subcontract Order SC-2026-014.');

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
      { no: (prev[prev.length - 1]?.no || 0) + 1, code: '', desc: '', uom: '', required: 0, stock: 0, issueQty: 0, remarks: '' },
    ]);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<OutboxOutlinedIcon />}
        title="New Issue - Material Issue to Subcon"
        subtitle="Issue raw material or semi-finished components to a vendor against a subcontract order."
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Issue Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Issue No." value={issueNo} disabled />
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                label={<Typography variant="caption">Auto Generate</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required type="date" label="Issue Date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} InputLabelProps={{ shrink: true }} />
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
              <TextField fullWidth size="small" required select label="Plant / Store" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Delivery Challan No." value={challanNo} onChange={(e) => setChallanNo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Transporter" value={transporter} onChange={(e) => setTransporter(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Vehicle No." value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Items to Issue</Typography>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              <Button size="small" variant="outlined" startIcon={<DownloadDoneOutlinedIcon />}>Import from Subcontract Order</Button>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 600px), 360px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Item Code *</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>Item Description</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Required Qty</TableCell>
                  <TableCell align="right">Stock Available</TableCell>
                  <TableCell align="right" sx={{ minWidth: 90 }}>Issue Qty *</TableCell>
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
                      <TextField
                        size="small" variant="standard" value={it.code}
                        onChange={(e) => updateItem(it.no, 'code', e.target.value)}
                        InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon sx={{ fontSize: 14 }} /></InputAdornment> }}
                      />
                    </TableCell>
                    <TableCell>{it.desc}</TableCell>
                    <TableCell>{it.uom}</TableCell>
                    <TableCell align="right">{numberFmt(it.required)}</TableCell>
                    <TableCell align="right">{numberFmt(it.stock)}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={it.issueQty}
                        onChange={(e) => updateItem(it.no, 'issueQty', Number(e.target.value))}
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
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2.5 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Notes</Typography>
          <TextField
            fullWidth multiline minRows={4} value={notes}
            onChange={(e) => setNotes(e.target.value.slice(0, 500))}
            placeholder="Add any notes about this material issue..."
          />
          <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 0.5 }}>{notes.length}/500</Typography>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />}>Back to List</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<RestartAltIcon />}>Reset</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />}>Save as Draft</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />}>Issue Material</Button>
      </Stack>
    </Box>
  );
}
