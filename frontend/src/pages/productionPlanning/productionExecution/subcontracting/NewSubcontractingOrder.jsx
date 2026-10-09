import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  FormControlLabel, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DownloadDoneOutlinedIcon from '@mui/icons-material/DownloadDoneOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EntityHeaderCard from '../../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "New Subcontracting Order" create screen under
// Production Execution > Subcontracting. No reference screenshots were
// supplied for this request; the form follows the same convention already
// used for Create Requisition / Create Issue (header fields card + editable
// item table + attachments/notes + bottom action bar). No Subcontracting
// data model exists in this schema -- fixed mock data only, Submit/Save as
// Draft/Reset do not persist or call the server.
// ---------------------------------------------------------------------------

const VENDORS = ['Precision Platers Pvt Ltd', 'Shree Heat Treatment Works', 'Apex Coatings Ltd', 'Sun Plating Industries', 'Metro Surface Finishers'];
const PROCESSES = ['Electroplating', 'Heat Treatment', 'Powder Coating', 'Zinc Plating', 'Anodizing', 'Painting'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing', uom: 'Nos', qty: 200, rate: 45, deliveryDate: '2026-10-15', remarks: 'For PO-2026-001' },
  { no: 2, code: 'FG-1004', desc: 'Shaft', uom: 'Nos', qty: 150, rate: 60, deliveryDate: '2026-10-15', remarks: '' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function NewSubcontractingOrder() {
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [orderNo] = useState('SC-2026-015');
  const [orderDate, setOrderDate] = useState('2026-10-09');
  const [vendor, setVendor] = useState('Precision Platers Pvt Ltd');
  const [process, setProcess] = useState('Electroplating');
  const [plant, setPlant] = useState('Main Plant');
  const [dueDate, setDueDate] = useState('2026-10-19');
  const [productionOrder, setProductionOrder] = useState('PO-2026-001');
  const [priority, setPriority] = useState('High');
  const [paymentTerms, setPaymentTerms] = useState('Net 30 Days');
  const [deliveryTerms, setDeliveryTerms] = useState('Ex-Works');
  const [notes, setNotes] = useState('Subcontract processing as per the agreed quality specification.');

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
      { no: (prev[prev.length - 1]?.no || 0) + 1, code: '', desc: '', uom: '', qty: 0, rate: 0, deliveryDate: '', remarks: '' },
    ]);
  };

  const totalAmount = items.reduce((sum, it) => sum + Number(it.qty || 0) * Number(it.rate || 0), 0);

  return (
    <Box>
      <EntityHeaderCard
        icon={<PrecisionManufacturingIcon />}
        title="New Subcontracting Order"
        subtitle="Create a new order for a subcontracted process or outsourced operation with a vendor."
      />

      {/* Order Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Subcontract Order Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Subcontract Order No." value={orderNo} disabled />
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                label={<Typography variant="caption">Auto Generate</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required type="date" label="Order Date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                {VENDORS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Subcontract Process" value={process} onChange={(e) => setProcess(e.target.value)}>
                {PROCESSES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Plant / Location" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required type="date" label="Due Date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Production Order"
                value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}
                sx={{ '& .MuiOutlinedInput-root': { bgcolor: priority === 'High' ? 'error.lighter' : priority === 'Medium' ? 'warning.lighter' : 'info.lighter' } }}
              >
                {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Payment Terms" value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Delivery Terms" value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Items */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Items to Subcontract</Typography>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              <Button size="small" variant="outlined" startIcon={<DownloadDoneOutlinedIcon />}>Import from Production Order</Button>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 600px), 360px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell sx={{ minWidth: 120 }}>Item Code *</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Item Description</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right" sx={{ minWidth: 90 }}>Qty *</TableCell>
                  <TableCell align="right" sx={{ minWidth: 90 }}>Rate</TableCell>
                  <TableCell align="right">Amount</TableCell>
                  <TableCell sx={{ minWidth: 130 }}>Delivery Date</TableCell>
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
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={it.qty}
                        onChange={(e) => updateItem(it.no, 'qty', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={it.rate}
                        onChange={(e) => updateItem(it.no, 'rate', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell align="right">{numberFmt(Number(it.qty || 0) * Number(it.rate || 0))}</TableCell>
                    <TableCell>
                      <TextField
                        size="small" variant="standard" type="date" value={it.deliveryDate}
                        onChange={(e) => updateItem(it.no, 'deliveryDate', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField size="small" variant="standard" value={it.remarks} onChange={(e) => updateItem(it.no, 'remarks', e.target.value)} />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.25}>
                        <IconButton size="small" color="primary"><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => removeItem(it.no)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={7} />
                  <TableCell align="right"><Typography variant="body2" fontWeight={700}>₹ {numberFmt(totalAmount)}</Typography></TableCell>
                  <TableCell colSpan={3} />
                </TableRow>
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      {/* Attachments + Notes */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Attachments</Typography>
                <Button size="small" variant="outlined" startIcon={<CloudUploadOutlinedIcon />}>Upload File</Button>
              </Stack>
              <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, py: 4, textAlign: 'center', mb: 2, bgcolor: 'action.hover' }}>
                <CloudUploadOutlinedIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={600}>Drag &amp; drop files here or click to upload</Typography>
                <Typography variant="caption" color="text.secondary">(PDF, Excel, Word, Image | Max size 10 MB per file)</Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>File Name</TableCell>
                    <TableCell>Uploaded By</TableCell>
                    <TableCell>Uploaded On</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 2.5 }}>No files uploaded yet.</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Notes</Typography>
              <TextField
                fullWidth multiline minRows={6} value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 500))}
                placeholder="Add any notes about this subcontract order..."
              />
              <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 0.5 }}>
                {notes.length}/500
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Bottom action bar */}
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
