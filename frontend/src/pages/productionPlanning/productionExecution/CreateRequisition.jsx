import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  FormControlLabel, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import { useNotify } from '../../../components/feedback/NotificationProvider';
import PostAddIcon from '@mui/icons-material/PostAdd';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DownloadDoneOutlinedIcon from '@mui/icons-material/DownloadDoneOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Material Requisition - Create" screen, built
// to match the reference design the user supplied for the Production
// Execution > Create Requisition submenu. Same convention as the other
// Production Execution screens (Production Orders, View Order, Operations,
// Production Execution, Material Requisition, Material Issue, Material
// Receipt, Create Issue, Record Production, Product Cost, Production
// Completion, Notes): there is no MaterialRequisition / BOM data model in
// this schema, so this lays out the form exactly as designed with fixed
// mock data rather than fabricating "real" records against tables that
// don't exist. Local state only -- nothing here persists or calls the
// server; "Create Requisition" and "Back to List" only navigate back to
// the Material Requisition list (with a confirmation toast on Create), and
// "Save as Draft" is toast-only. No requisition is actually written
// anywhere since there is no backing table for one.
// ---------------------------------------------------------------------------

const REQUISITION_TYPES = ['Production', 'Maintenance', 'Tooling', 'Quality'];
const DEPARTMENTS = ['Production', 'Maintenance', 'Tool Room', 'Quality'];
const WORK_CENTERS = ['WC-01 - Machining', 'WC-02 - Assembly', 'WC-03 - Welding', 'QC-01 - Inspection'];
const PRIORITIES = ['High', 'Medium', 'Low'];

const INITIAL_ITEMS = [
  { no: 1, code: 'RM-2001', desc: 'Cast Iron', uom: 'Kg', required: 6000, stock: 2500, balance: 3500, needBy: '2026-10-09', remarks: 'For housing Machining' },
  { no: 2, code: 'RM-2002', desc: 'Bearing 6205', uom: 'Nos', required: 1000, stock: 750, balance: 250, needBy: '2026-10-09', remarks: 'As per BOM' },
  { no: 3, code: 'RM-2003', desc: 'Seal Ring', uom: 'Nos', required: 500, stock: 300, balance: 200, needBy: '2026-10-10', remarks: 'For assembly' },
  { no: 4, code: 'RM-2004', desc: 'Gasket', uom: 'Nos', required: 500, stock: 500, balance: 0, needBy: '2026-10-10', remarks: 'Available in stock' },
  { no: 5, code: 'RM-2005', desc: 'Grease', uom: 'Kg', required: 250, stock: 100, balance: 150, needBy: '2026-10-10', remarks: 'Lubrication' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function CreateRequisition() {
  const navigate = useNavigate();
  const notify = useNotify();
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [requisitionNo] = useState('MR-2026-013');
  const [requisitionDate, setRequisitionDate] = useState('2026-10-08');
  const [requisitionType, setRequisitionType] = useState('Production');
  const [requiredDate, setRequiredDate] = useState('2026-10-10');
  const [productionOrder, setProductionOrder] = useState('PO-2026-001');
  const [department, setDepartment] = useState('Production');
  const [requestedBy, setRequestedBy] = useState('Kannan P');
  const [priority, setPriority] = useState('High');
  const [plant, setPlant] = useState('Main Plant');
  const [workCenter, setWorkCenter] = useState('WC-01 - Machining');
  const [costCenter, setCostCenter] = useState('PROD-01');
  const [purpose, setPurpose] = useState('Material required for PO-2026-001');
  const [notes, setNotes] = useState('Material required to start production as per plan.');

  const [items, setItems] = useState(INITIAL_ITEMS);
  const [checked, setChecked] = useState(() => new Set());

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no);
      else next.add(no);
      return next;
    });
  };

  const updateItem = (no, field, value) => {
    setItems((prev) => prev.map((it) => (it.no === no ? { ...it, [field]: value } : it)));
  };

  const removeItem = (no) => {
    setItems((prev) => prev.filter((it) => it.no !== no));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { no: (prev[prev.length - 1]?.no || 0) + 1, code: '', desc: '', uom: '', required: 0, stock: 0, balance: 0, needBy: '', remarks: '' },
    ]);
  };

  // No MaterialRequisition data model exists in this schema (see the note
  // above), so there is nothing real to save here -- Create Requisition
  // just confirms the action and takes the user back to the Material
  // Requisition list, the same way CreateProductionOrder.jsx returns to its
  // list after a (real) create.
  const handleCreateRequisition = () => {
    notify.success(`Material requisition ${requisitionNo} created.`);
    navigate('/production-execution/material-requisition');
  };
  const handleSaveAsDraft = () => notify.info('Saved as draft.');
  const handleBackToList = () => navigate('/production-execution/material-requisition');

  return (
    <Box>
      <EntityHeaderCard
        icon={<PostAddIcon />}
        title="Material Requisition - Create"
        subtitle="Create material requisition for production, maintenance or other departments."
      />

      {/* Requisition Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Requisition Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Requisition No." value={requisitionNo} disabled />
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                label={<Typography variant="caption">Auto Generate</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required type="date" label="Requisition Date"
                value={requisitionDate} onChange={(e) => setRequisitionDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Requisition Type" value={requisitionType} onChange={(e) => setRequisitionType(e.target.value)}>
                {REQUISITION_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required type="date" label="Required Date"
                value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Production Order"
                value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                {DEPARTMENTS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Requested By"
                value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required select label="Priority" value={priority} onChange={(e) => setPriority(e.target.value)}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    bgcolor: priority === 'High' ? 'error.lighter' : priority === 'Medium' ? 'warning.lighter' : 'info.lighter',
                  },
                }}
              >
                {PRIORITIES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Plant / Location" value={plant} onChange={(e) => setPlant(e.target.value)}>
                <MenuItem value="Main Plant">Main Plant</MenuItem>
                <MenuItem value="Plant 2">Plant 2</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Cost Center" value={costCenter} onChange={(e) => setCostCenter(e.target.value)}>
                <MenuItem value="PROD-01">PROD-01</MenuItem>
                <MenuItem value="MAINT-01">MAINT-01</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Purpose / Remark"
                value={purpose} onChange={(e) => setPurpose(e.target.value)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Material Items */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Material Items</Typography>
            <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
              <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
              <Button size="small" variant="outlined" startIcon={<DownloadDoneOutlinedIcon />}>Import from BOM</Button>
              <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />}>Import from Production Order</Button>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(240px, calc(100vh - 560px), 420px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell sx={{ minWidth: 130 }}>Item Code *</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Item Description</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right" sx={{ minWidth: 100 }}>Required Qty *</TableCell>
                  <TableCell align="right">Stock Available</TableCell>
                  <TableCell align="right">Balance Qty</TableCell>
                  <TableCell sx={{ minWidth: 130 }}>Need By Date</TableCell>
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
                        size="small" variant="standard" type="number" value={it.required}
                        onChange={(e) => updateItem(it.no, 'required', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell align="right">{numberFmt(it.stock)}</TableCell>
                    <TableCell align="right">{numberFmt(it.balance)}</TableCell>
                    <TableCell>
                      <TextField
                        size="small" variant="standard" type="date" value={it.needBy}
                        onChange={(e) => updateItem(it.no, 'needBy', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small" variant="standard" value={it.remarks}
                        onChange={(e) => updateItem(it.no, 'remarks', e.target.value)}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.25}>
                        <IconButton size="small" color="primary"><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => removeItem(it.no)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
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
                <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />}>Upload File</Button>
              </Stack>
              <Box sx={{
                border: '1px dashed', borderColor: 'divider', borderRadius: 2, py: 4, textAlign: 'center', mb: 2,
                bgcolor: 'action.hover',
              }}>
                <CloudUploadOutlinedIcon sx={{ fontSize: 28, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={600}>Drag &amp; drop files here or click to upload</Typography>
                <Typography variant="caption" color="text.secondary">(PDF, Excel, Word, Image | Max size 10 MB per file)</Typography>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>S.No</TableCell>
                    <TableCell>File Name</TableCell>
                    <TableCell>File Type</TableCell>
                    <TableCell>File Size</TableCell>
                    <TableCell>Uploaded By</TableCell>
                    <TableCell>Uploaded On</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ color: 'text.secondary', py: 2.5 }}>
                      No files uploaded yet.
                    </TableCell>
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
                placeholder="Add any notes about this material requisition..."
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
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={handleBackToList}>Back to List</Button>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" startIcon={<RestartAltIcon />} onClick={() => setItems(INITIAL_ITEMS)}>Reset</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />} onClick={handleSaveAsDraft}>Save as Draft</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={handleCreateRequisition}>Create Requisition</Button>
      </Stack>
    </Box>
  );
}
