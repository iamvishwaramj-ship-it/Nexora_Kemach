import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DownloadDoneOutlinedIcon from '@mui/icons-material/DownloadDoneOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import EntityHeaderCard from '../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Production Execution - Record Production"
// screen, built to match the reference design the user supplied for the
// Production Execution > Record Production submenu. Same convention as the
// other Production Execution screens (Production Orders, View Order,
// Operations, Material Requisition, Material Issue, Material Receipt,
// Create Issue): there is no ProductionOrder / BOM / QC data model in this
// schema, so this lays out the form exactly as designed with fixed mock
// data rather than fabricating "real" records against tables that don't
// exist. Local state only -- nothing here persists or calls the server;
// Submit Production/Save as Draft/Reset do not navigate or clear real data.
// ---------------------------------------------------------------------------

const ORDER = {
  no: 'PO-2026-001',
  itemCode: 'FG-1001',
  itemDesc: 'Gear Housing',
  plannedQty: 500,
  uom: 'Nos',
  balanceQty: 100,
  status: 'In Progress',
  plant: 'Main Plant',
  workCenter: 'WC-01 - Machining',
  routingOperation: 'OP-10 - Machining',
  bomNo: 'BOM-1001',
  startDate: '2026-10-01',
  dueDate: '2026-10-10',
};

const MATERIALS = [
  { no: 1, code: 'RM-2001', desc: 'Cast Iron', uom: 'Kg', required: 1600, issued: 1600, consumed: 1550, balance: 50 },
  { no: 2, code: 'RM-2002', desc: 'Bearing 6205', uom: 'Nos', required: 100, issued: 100, consumed: 95, balance: 5 },
  { no: 3, code: 'RM-2003', desc: 'Gasket', uom: 'Nos', required: 100, issued: 100, consumed: 95, balance: 5 },
];

const OUTPUTS = [
  { no: 1, code: 'FG-1001', desc: 'Gear Housing', uom: 'Nos', good: 80, rework: 0, scrap: 5 },
];

const RESOURCES = [
  { no: 1, type: 'Machine', code: 'MC-01', name: 'CNC Machine-1', start: '09:00', end: '13:00', hours: '4.00', remarks: '-' },
  { no: 2, type: 'Labour', code: 'OP-001', name: 'Mani', start: '09:00', end: '13:00', hours: '4.00', remarks: '-' },
  { no: 3, type: 'Labour', code: 'OP-002', name: 'Dheena S', start: '09:00', end: '13:00', hours: '4.00', remarks: '-' },
];

const ATTACHMENTS = [
  { no: 1, name: 'production_photo.jpg', type: 'Image', size: '450 KB', uploadedBy: 'Mani', uploadedOn: '03-Oct-2026 13:10' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function RecordProduction() {
  const [goodQty, setGoodQty] = useState(80);
  const [reworkQty, setReworkQty] = useState(0);
  const [scrapQty, setScrapQty] = useState(5);
  const [executionDate, setExecutionDate] = useState('2026-10-03');
  const [shift, setShift] = useState('Day');
  const [workCenter, setWorkCenter] = useState('WC-01 - Machining');
  const [operation, setOperation] = useState('OP-10 - Machining');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [operator, setOperator] = useState('Mani');
  const [prodRemarks, setProdRemarks] = useState('Normal production, 5 nos scrap due to dimension issue.');

  const [inspectionRequired, setInspectionRequired] = useState('Yes');
  const [inspectionResult, setInspectionResult] = useState('Accepted');
  const [qcReference, setQcReference] = useState('QC-2026-001');
  const [qcRemarks, setQcRemarks] = useState('Quality ok as per drawing.');

  const [checkedMaterial, setCheckedMaterial] = useState(() => new Set());
  const [checkedOutput, setCheckedOutput] = useState(() => new Set());
  const [checkedResource, setCheckedResource] = useState(() => new Set());

  const toggleSet = (setFn) => (key) => {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalQty = Number(goodQty || 0) + Number(reworkQty || 0) + Number(scrapQty || 0);

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsIcon />}
        title="Production Execution - Record Production"
        subtitle="Record actual production against a production order and track real-time progress."
      />

      {/* Production Order Details */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Production Order Details</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Production Order No." value={ORDER.no} disabled
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Item Code" value={ORDER.itemCode} disabled
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.5}>
              <TextField fullWidth size="small" label="Item Description" value={ORDER.itemDesc} disabled sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'text.primary' } }} />
            </Grid>
            <Grid item xs={6} sm={3} md={1.5}>
              <TextField fullWidth size="small" label="Planned Qty" value={ORDER.plannedQty} disabled />
            </Grid>
            <Grid item xs={6} sm={3} md={1}>
              <TextField fullWidth size="small" label="UOM" value={ORDER.uom} disabled />
            </Grid>
            <Grid item xs={6} sm={3} md={1}>
              <TextField fullWidth size="small" label="Balance Qty" value={ORDER.balanceQty} disabled />
            </Grid>
            <Grid item xs={6} sm={3} md={1}>
              <Typography variant="caption" color="text.secondary" display="block">Status</Typography>
              <Chip size="small" label={ORDER.status} color="info" sx={{ mt: 0.5 }} />
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Plant / Location" value={ORDER.plant} disabled>
                <MenuItem value={ORDER.plant}>{ORDER.plant}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={ORDER.workCenter} disabled>
                <MenuItem value={ORDER.workCenter}>{ORDER.workCenter}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Routing Operation" value={ORDER.routingOperation} disabled>
                <MenuItem value={ORDER.routingOperation}>{ORDER.routingOperation}</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" label="BOM No." value={ORDER.bomNo} disabled
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={1.2}>
              <TextField fullWidth size="small" type="date" label="Start Date" value={ORDER.startDate} disabled InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={6} sm={3} md={1.2}>
              <TextField fullWidth size="small" type="date" label="Due Date" value={ORDER.dueDate} disabled InputLabelProps={{ shrink: true }} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Production Entry */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2.5 }}>Production Entry</Typography>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField
                fullWidth size="small" required type="date" label="Execution Date"
                value={executionDate} onChange={(e) => setExecutionDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1.6}>
              <TextField fullWidth size="small" select label="Shift" value={shift} onChange={(e) => setShift(e.target.value)}>
                <MenuItem value="Day">Day</MenuItem>
                <MenuItem value="Night">Night</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Work Center" value={workCenter} onChange={(e) => setWorkCenter(e.target.value)}>
                <MenuItem value="WC-01 - Machining">WC-01 - Machining</MenuItem>
                <MenuItem value="WC-02 - Assembly">WC-02 - Assembly</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Operation" value={operation} onChange={(e) => setOperation(e.target.value)}>
                <MenuItem value="OP-10 - Machining">OP-10 - Machining</MenuItem>
                <MenuItem value="OP-20 - Drilling">OP-20 - Drilling</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={6} sm={3} md={1.6}>
              <TextField
                fullWidth size="small" type="time" label="Start Time"
                value={startTime} onChange={(e) => setStartTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={1.6}>
              <TextField
                fullWidth size="small" type="time" label="End Time"
                value={endTime} onChange={(e) => setEndTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField fullWidth size="small" select label="Operator" value={operator} onChange={(e) => setOperator(e.target.value)}>
                <MenuItem value="Mani">Mani</MenuItem>
                <MenuItem value="Dheena S">Dheena S</MenuItem>
                <MenuItem value="Arunkumar">Arunkumar</MenuItem>
              </TextField>
            </Grid>

            <Grid item xs={6} sm={3} md={2}>
              <TextField
                fullWidth size="small" required label="Good Qty" type="number"
                value={goodQty} onChange={(e) => setGoodQty(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">Nos</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                fullWidth size="small" label="Rework Qty" type="number"
                value={reworkQty} onChange={(e) => setReworkQty(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">Nos</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                fullWidth size="small" label="Scrap Qty" type="number"
                value={scrapQty} onChange={(e) => setScrapQty(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end">Nos</InputAdornment> }}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <TextField
                fullWidth size="small" label="Total Qty" value={totalQty} disabled
                InputProps={{ endAdornment: <InputAdornment position="end">Nos</InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth size="small" label="Remarks" multiline minRows={2}
                value={prodRemarks} onChange={(e) => setProdRemarks(e.target.value)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Material Consumption + Output Details */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Material Consumption</Typography>
                <Stack direction="row" spacing={1.25}>
                  <Button size="small" variant="contained" startIcon={<AddIcon />}>Add Materials</Button>
                  <Button size="small" variant="outlined" startIcon={<DownloadDoneOutlinedIcon />}>Fetch from BOM</Button>
                </Stack>
              </Stack>
              <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 700px), 240px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>S.No</TableCell>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Description</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell align="right">Required Qty</TableCell>
                      <TableCell align="right">Issue Qty</TableCell>
                      <TableCell align="right">Consumed Qty</TableCell>
                      <TableCell align="right">Balance Qty</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {MATERIALS.map((m) => (
                      <TableRow key={m.code} hover>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={checkedMaterial.has(m.code)} onChange={() => toggleSet(setCheckedMaterial)(m.code)} />
                        </TableCell>
                        <TableCell>{m.no}</TableCell>
                        <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{m.code}</Typography></TableCell>
                        <TableCell>{m.desc}</TableCell>
                        <TableCell>{m.uom}</TableCell>
                        <TableCell align="right">{numberFmt(m.required)}</TableCell>
                        <TableCell align="right">{numberFmt(m.issued)}</TableCell>
                        <TableCell align="right">{numberFmt(m.consumed)}</TableCell>
                        <TableCell align="right">{numberFmt(m.balance)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Output Details</Typography>
                <Button size="small" variant="outlined" startIcon={<AddIcon />}>Add Output</Button>
              </Stack>
              <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 700px), 240px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>S.No</TableCell>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Description</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell align="right">Good Qty</TableCell>
                      <TableCell align="right">Rework Qty</TableCell>
                      <TableCell align="right">Scrap Qty</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {OUTPUTS.map((o) => (
                      <TableRow key={o.code} hover>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={checkedOutput.has(o.code)} onChange={() => toggleSet(setCheckedOutput)(o.code)} />
                        </TableCell>
                        <TableCell>{o.no}</TableCell>
                        <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{o.code}</Typography></TableCell>
                        <TableCell>{o.desc}</TableCell>
                        <TableCell>{o.uom}</TableCell>
                        <TableCell align="right">{numberFmt(o.good)}</TableCell>
                        <TableCell align="right">{numberFmt(o.rework)}</TableCell>
                        <TableCell align="right">{numberFmt(o.scrap)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Labour & Machine Time */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={700}>Labour &amp; Machine Time</Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />}>Add Time Entry</Button>
          </Stack>
          <ScrollableTableContainer maxHeight="clamp(160px, calc(100vh - 700px), 240px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>S.No</TableCell>
                  <TableCell>Resource Type</TableCell>
                  <TableCell>Resource Code</TableCell>
                  <TableCell>Resource Name</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>End Time</TableCell>
                  <TableCell align="right">Hours</TableCell>
                  <TableCell>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {RESOURCES.map((r) => (
                  <TableRow key={r.code} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checkedResource.has(r.code)} onChange={() => toggleSet(setCheckedResource)(r.code)} />
                    </TableCell>
                    <TableCell>{r.no}</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell>{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.start}</TableCell>
                    <TableCell>{r.end}</TableCell>
                    <TableCell align="right">{r.hours}</TableCell>
                    <TableCell>{r.remarks}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      {/* Attachments + Quality Details */}
      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        <Grid item xs={12} md={7}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                <Typography variant="subtitle1" fontWeight={700}>Attachments</Typography>
                <Button size="small" variant="outlined" startIcon={<UploadFileOutlinedIcon />}>Upload File</Button>
              </Stack>
              <Box sx={{
                border: '1px dashed', borderColor: 'divider', borderRadius: 2, py: 3, textAlign: 'center', mb: 2,
                bgcolor: 'action.hover',
              }}>
                <CloudUploadOutlinedIcon sx={{ fontSize: 26, color: 'text.secondary', mb: 0.5 }} />
                <Typography variant="body2" fontWeight={600}>Drag &amp; drop files here or click to upload</Typography>
                <Typography variant="caption" color="text.secondary">(PDF, Excel, Word, Image | Max size 10 MB per file)</Typography>
              </Box>
              <ScrollableTableContainer maxHeight="clamp(100px, calc(100vh - 720px), 160px)">
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
                    {ATTACHMENTS.map((a) => (
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
              </ScrollableTableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Quality Details</Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" select label="Inspection Required" value={inspectionRequired} onChange={(e) => setInspectionRequired(e.target.value)}>
                    <MenuItem value="Yes">Yes</MenuItem>
                    <MenuItem value="No">No</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField fullWidth size="small" select label="Inspection Result" value={inspectionResult} onChange={(e) => setInspectionResult(e.target.value)}
                    sx={{ '& .MuiSelect-select': { color: inspectionResult === 'Accepted' ? 'success.main' : 'text.primary', fontWeight: 600 } }}
                  >
                    <MenuItem value="Accepted">Accepted</MenuItem>
                    <MenuItem value="Rejected">Rejected</MenuItem>
                    <MenuItem value="Pending">Pending</MenuItem>
                  </TextField>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth size="small" label="QC Reference No."
                    value={qcReference} onChange={(e) => setQcReference(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth size="small" label="Remarks" multiline minRows={3}
                    value={qcRemarks} onChange={(e) => setQcRemarks(e.target.value)}
                  />
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
        <Button variant="contained" startIcon={<CheckCircleOutlineIcon />}>Submit Production</Button>
      </Stack>
    </Box>
  );
}
