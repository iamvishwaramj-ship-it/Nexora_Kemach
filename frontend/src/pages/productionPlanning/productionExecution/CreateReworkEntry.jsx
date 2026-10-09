import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  FormControlLabel, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import RecyclingIcon from '@mui/icons-material/Recycling';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Rework & Scrap - Create Entry" screen, built
// to match the reference design the user supplied for the Production
// Execution > Rework & Scrap > Create Entry submenu. Same convention as the
// other Production Execution "Create ..." screens (Create Issue, Create
// Requisition): there is no Rework/Scrap data model in this schema, so this
// lays out the form exactly as designed with fixed mock data rather than
// fabricating "real" records against tables that don't exist. Local state
// only -- nothing here persists or calls the server; Submit/Save as
// Draft/Reset do not navigate or clear real data.
// ---------------------------------------------------------------------------

const TYPES = ['Rework', 'Scrap'];
const WORK_CENTERS = ['WC-01 - Machining', 'WC-02 - Assembly', 'WC-03 - Welding', 'Stores'];
const REASONS = ['Machining size corrections', 'Dimension out of tolerance', 'Surface finish issue', 'Raw material defect', 'Tool breakage', 'Other'];
const DISPOSITIONS = ['Send to Rework', 'Send to Scrap', 'Send to Stores'];
const REWORK_OPERATIONS = ['Re-Machining', 'Re-Drilling', 'Re-Welding', 'Re-Finishing', 'Inspection Rework'];
const SCRAP_TYPES = ['Dimension Issue', 'Surface Finish', 'Raw Material Defect', 'Machining Error', 'Other'];
const SCRAP_REASONS = ['Out of Tolerance', 'Crack Detected', 'Tool Breakage', 'Material Defect', 'Other'];
const DISPOSAL_METHODS = ['Dispose Internally', 'Return to Vendor', 'Scrap Yard', 'Sell as Scrap'];
const INSPECTION_RESULTS = ['Accepted', 'Rejected', 'Pending'];
const INSPECTORS = ['Mani', 'Dheena S', 'Arunkumar', 'Kannan P'];

const INITIAL_ITEMS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing', uom: 'Nos', good: 0, rework: 10, scrap: 0, remarks: 'Dimension deviation' },
];

const INITIAL_ATTACHMENTS = [
  { no: 1, name: 'rework_photo.jpg', type: 'Image', size: '350 KB', uploadedBy: 'Kannan P', uploadedOn: '10-Oct-2026 11:20' },
];

export default function CreateReworkEntry() {
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [entryNo] = useState('RS-2026-009');
  const [entryDate, setEntryDate] = useState('2026-10-10');
  const [type, setType] = useState('Rework');
  const [productionOrder, setProductionOrder] = useState('PO-2026-001');
  const [workCenter, setWorkCenter] = useState('WC-01 - Machining');
  const [referenceNo, setReferenceNo] = useState('');
  const [reason, setReason] = useState('Machining size corrections');
  const [disposition, setDisposition] = useState('Send to Rework');

  const [items, setItems] = useState(INITIAL_ITEMS);

  const [reworkOperation, setReworkOperation] = useState('Re-Machining');
  const [targetWorkCenter, setTargetWorkCenter] = useState('WC-01 - Machining');
  const [targetCompletionDate, setTargetCompletionDate] = useState('2026-10-12');
  const [reworkRemarks, setReworkRemarks] = useState('Parts require re-machining due to size variation.');

  const [scrapType, setScrapType] = useState('Dimension Issue');
  const [scrapReason, setScrapReason] = useState('Out of Tolerance');
  const [scrapCode, setScrapCode] = useState('SCR-01');
  const [disposalMethod, setDisposalMethod] = useState('Dispose Internally');
  const [estimatedScrapValue, setEstimatedScrapValue] = useState(0);

  const [attachments] = useState(INITIAL_ATTACHMENTS);

  const [qcReferenceNo, setQcReferenceNo] = useState('QC-2026-001');
  const [inspectionResult, setInspectionResult] = useState('Rejected');
  const [inspector, setInspector] = useState('Mani');
  const [qcRemarks, setQcRemarks] = useState('Dimension out of tolerance as per drawing.');

  const updateItem = (no, field, value) => {
    setItems((prev) => prev.map((it) => (it.no === no ? { ...it, [field]: value } : it)));
  };

  const removeItem = (no) => {
    setItems((prev) => prev.filter((it) => it.no !== no));
  };

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      { no: (prev[prev.length - 1]?.no || 0) + 1, code: '', desc: '', uom: '', good: 0, rework: 0, scrap: 0, remarks: '' },
    ]);
  };

  const totalQty = (it) => Number(it.good || 0) + Number(it.rework || 0) + Number(it.scrap || 0);

  return (
    <Box>
      <EntityHeaderCard
        icon={<RecyclingIcon />}
        title="Rework & Scrap - Create Entry"
        subtitle="Record rework or scrap for materials or finished goods."
      />

      {/* Entry Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Entry Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Entry No." value={entryNo} disabled />
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                label={<Typography variant="caption">Auto Generate</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required type="date" label="Entry Date"
                value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
                {TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Production Order"
                value={productionOrder} onChange={(e) => setProductionOrder(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Reference No." placeholder="e.g. QC No. / Production Slip No."
                value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Disposition" value={disposition} onChange={(e) => setDisposition(e.target.value)}>
                {DISPOSITIONS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Item Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addItem}>Add Item</Button>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 620px), 320px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>S.No</TableCell>
                  <TableCell sx={{ minWidth: 130 }}>Item Code *</TableCell>
                  <TableCell sx={{ minWidth: 140 }}>Item Description</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Good Qty</TableCell>
                  <TableCell align="right">Rework Qty</TableCell>
                  <TableCell align="right">Scrap Qty</TableCell>
                  <TableCell align="right">Total Qty</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.no} hover>
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
                        size="small" variant="standard" type="number" value={it.good}
                        onChange={(e) => updateItem(it.no, 'good', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }}
                        sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={it.rework}
                        onChange={(e) => updateItem(it.no, 'rework', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }}
                        sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={it.scrap}
                        onChange={(e) => updateItem(it.no, 'scrap', Number(e.target.value))}
                        inputProps={{ style: { textAlign: 'right' } }}
                        sx={{ width: 70 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField size="small" variant="standard" value={totalQty(it)} disabled inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 70 }} />
                    </TableCell>
                    <TableCell>
                      <TextField
                        size="small" variant="standard" value={it.remarks}
                        onChange={(e) => updateItem(it.no, 'remarks', e.target.value)}
                      />
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

      {/* Rework Details + Scrap Details */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Rework Details</Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" required select label="Rework Operation" value={reworkOperation} onChange={(e) => setReworkOperation(e.target.value)}>
                    {REWORK_OPERATIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" required select label="Target Work Center" value={targetWorkCenter} onChange={(e) => setTargetWorkCenter(e.target.value)}>
                    {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth size="small" type="date" label="Target Completion Date"
                    value={targetCompletionDate} onChange={(e) => setTargetCompletionDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" label="Remarks" multiline minRows={3}
                    value={reworkRemarks} onChange={(e) => setReworkRemarks(e.target.value.slice(0, 500))}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 0.5 }}>
                    {reworkRemarks.length}/500
                  </Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Scrap Details</Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" select label="Scrap Type" value={scrapType} onChange={(e) => setScrapType(e.target.value)}>
                    {SCRAP_TYPES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" select label="Scrap Reason" value={scrapReason} onChange={(e) => setScrapReason(e.target.value)}>
                    {SCRAP_REASONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth size="small" label="Scrap Code"
                    value={scrapCode} onChange={(e) => setScrapCode(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth size="small" select label="Disposal Method" value={disposalMethod} onChange={(e) => setDisposalMethod(e.target.value)}>
                    {DISPOSAL_METHODS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth size="small" type="number" label="Estimated Scrap Value (INR)"
                    value={estimatedScrapValue} onChange={(e) => setEstimatedScrapValue(Number(e.target.value))}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Attachments + Quality Reference */}
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
                  {attachments.map((a) => (
                    <TableRow key={a.no} hover>
                      <TableCell>{a.no}</TableCell>
                      <TableCell>{a.name}</TableCell>
                      <TableCell>{a.type}</TableCell>
                      <TableCell>{a.size}</TableCell>
                      <TableCell>{a.uploadedBy}</TableCell>
                      <TableCell>{a.uploadedOn}</TableCell>
                      <TableCell>
                        <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Quality Reference</Typography>
              <Grid container spacing={2.5}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth size="small" label="QC Reference No."
                    value={qcReferenceNo} onChange={(e) => setQcReferenceNo(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" select label="Inspection Result" value={inspectionResult} onChange={(e) => setInspectionResult(e.target.value)}
                    sx={{ '& .MuiSelect-select': { color: inspectionResult === 'Accepted' ? 'success.main' : inspectionResult === 'Rejected' ? 'error.main' : 'text.primary', fontWeight: 600 } }}
                  >
                    {INSPECTION_RESULTS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" select label="Inspector" value={inspector} onChange={(e) => setInspector(e.target.value)}>
                    {INSPECTORS.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" label="Remarks" multiline minRows={3}
                    value={qcRemarks} onChange={(e) => setQcRemarks(e.target.value.slice(0, 500))}
                  />
                  <Typography variant="caption" color="text.secondary" display="block" textAlign="right" sx={{ mt: 0.5 }}>
                    {qcRemarks.length}/500
                  </Typography>
                </Grid>
              </Grid>
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
        <Button variant="contained" startIcon={<CheckCircleOutlineIcon />}>Submit</Button>
      </Stack>
    </Box>
  );
}
