import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Checkbox,
  FormControlLabel, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
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
// Static, UI-only mock of the "Material Issue - Create" screen, built to
// match the reference design the user supplied for the Production
// Execution > Create Issue submenu. Same convention as the other
// Production Execution screens (Production Orders, View Order,
// Operations, Material Requisition, Material Issue, Material Receipt):
// there is no MaterialIssue / MaterialRequisition / BOM data model in this
// schema, so this lays out the form exactly as designed with fixed mock
// data rather than fabricating "real" records against tables that don't
// exist. Local state only -- nothing here persists or calls the server;
// Submit/Save as Draft/Reset do not navigate or clear real data.
// ---------------------------------------------------------------------------

const DEPARTMENTS = ['Production', 'Maintenance', 'Tool Room', 'Quality'];
const WORK_CENTERS = ['WC-01 - Machining', 'WC-02 - Assembly', 'WC-03 - Welding', 'QC-01 - Inspection'];
const ISSUE_TYPES = ['Production Issue', 'Maintenance Issue', 'Tooling Issue', 'Quality Issue'];

const INITIAL_ITEMS = [
  { no: 1, code: 'RM-1001', desc: 'Cast Iron', uom: 'Kg', required: 6000, stock: 8500, issueQty: 6000, batch: 'CI-2026-09', bin: 'A-01-01', remarks: '-' },
  { no: 2, code: 'RM-1002', desc: 'Bearing 6205', uom: 'Nos', required: 1000, stock: 1250, issueQty: 1000, batch: 'BR-6205-01', bin: 'B-02-03', remarks: '-' },
  { no: 3, code: 'RM-1003', desc: 'Seal Ring', uom: 'Nos', required: 500, stock: 600, issueQty: 500, batch: 'SR-001', bin: 'B-02-05', remarks: '-' },
  { no: 4, code: 'RM-1004', desc: 'Gasket', uom: 'Nos', required: 500, stock: 750, issueQty: 480, batch: 'GK-001', bin: 'C-01-02', remarks: 'Partial issue' },
  { no: 5, code: 'RM-1005', desc: 'Grease', uom: 'Kg', required: 250, stock: 400, issueQty: 250, batch: 'GR-001', bin: 'C-01-04', remarks: '-' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function CreateIssue() {
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [issueNo] = useState('MI-2026-011');
  const [issueDate, setIssueDate] = useState('2026-10-08');
  const [issueType, setIssueType] = useState('Production Issue');
  const [productionOrder, setProductionOrder] = useState('PO-2026-001');
  const [department, setDepartment] = useState('Production');
  const [workCenter, setWorkCenter] = useState('WC-01 - Machining');
  const [materialRequisition, setMaterialRequisition] = useState('MR-2026-001');
  const [costCenter, setCostCenter] = useState('PROD-01');
  const [issuedBy, setIssuedBy] = useState('Kannan P');
  const [remarks, setRemarks] = useState('Material issued for production as per plan.');
  const [notes, setNotes] = useState('Material issued as per BOM for production.');

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
      { no: (prev[prev.length - 1]?.no || 0) + 1, code: '', desc: '', uom: '', required: 0, stock: 0, issueQty: 0, batch: '', bin: '', remarks: '-' },
    ]);
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<NoteAddIcon />}
        title="Material Issue - Create"
        subtitle="Issue raw materials and components to production orders."
      />

      {/* Issue Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Issue Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Issue No." value={issueNo} disabled
              />
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox size="small" checked={autoGenerate} onChange={(e) => setAutoGenerate(e.target.checked)} />}
                label={<Typography variant="caption">Auto Generate</Typography>}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required type="date" label="Issue Date"
                value={issueDate} onChange={(e) => setIssueDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Issue Type" value={issueType} onChange={(e) => setIssueType(e.target.value)}>
                {ISSUE_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
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
              <TextField fullWidth size="small" required select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                {DEPARTMENTS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                {WORK_CENTERS.map((w) => <MenuItem key={w} value={w}>{w}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Material Requisition"
                value={materialRequisition} onChange={(e) => setMaterialRequisition(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <TextField fullWidth size="small" select label="Cost Center" value={costCenter} onChange={(e) => setCostCenter(e.target.value)}>
                <MenuItem value="PROD-01">PROD-01</MenuItem>
                <MenuItem value="MAINT-01">MAINT-01</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={1.5}>
              <TextField
                fullWidth size="small" required label="Issued By"
                value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth size="small" label="Remarks" multiline minRows={2}
                value={remarks} onChange={(e) => setRemarks(e.target.value)}
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
              <Button size="small" variant="outlined" startIcon={<DownloadDoneOutlinedIcon />}>Import from Requisition</Button>
              <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />}>Import from BOM</Button>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(240px, calc(100vh - 560px), 420px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell sx={{ minWidth: 130 }}>Item Code *</TableCell>
                  <TableCell sx={{ minWidth: 150 }}>Item Description</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Required Qty</TableCell>
                  <TableCell align="right">Stock Available</TableCell>
                  <TableCell align="right" sx={{ minWidth: 110 }}>Issue Qty *</TableCell>
                  <TableCell>Batch No.</TableCell>
                  <TableCell>Bin Location</TableCell>
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
                        inputProps={{ style: { textAlign: 'right' } }}
                        sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell>{it.batch}</TableCell>
                    <TableCell>{it.bin}</TableCell>
                    <TableCell>{it.remarks}</TableCell>
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
                placeholder="Add any notes about this material issue..."
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
        <Button variant="contained" startIcon={<SendOutlinedIcon />}>Submit Issue</Button>
      </Stack>
    </Box>
  );
}
