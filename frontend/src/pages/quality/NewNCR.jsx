import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
  IconButton,
} from '@mui/material';
import ReportGmailerrorredOutlinedIcon from '@mui/icons-material/ReportGmailerrorredOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import NoteAddOutlinedIcon from '@mui/icons-material/NoteAddOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import ReportProblemOutlinedIcon from '@mui/icons-material/ReportProblemOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > Non-Conformance (NCR) > New NCR" -- rebuilt to match the
// user-supplied reference screenshot exactly. Static UI-only mock; no
// Quality data model exists in this schema.
// ---------------------------------------------------------------------------

const DEFECTS = [
  { no: 1, characteristic: 'Hole Diameter', spec: 'Ø20.00 ± 0.05', actual: '20.50', deviation: '+0.50', uom: 'mm', method: 'CMM', remarks: 'Over tolerance' },
  { no: 2, characteristic: 'Hole Position', spec: '0.10', actual: '0.12', deviation: '+0.02', uom: 'mm', method: 'CMM', remarks: 'Out of position' },
  { no: 3, characteristic: 'Surface Finish', spec: 'Ra ≤ 3.2', actual: '3.5', deviation: '+0.30', uom: 'µm', method: 'Surface Roughness Tester', remarks: 'Rough surface' },
  { no: 4, characteristic: 'Appearance', spec: 'No cracks, burrs, defects', actual: 'Burr observed', deviation: '-', uom: 'Nos', method: 'Visual Inspection', remarks: 'Burr near hole' },
];

const ATTACHMENTS = [
  { name: 'Inspection_Report_IN-2026-001.pdf', type: 'PDF', size: '245 KB', uploadedOn: '02-Oct-2026 10:45', uploadedBy: 'Kannan P' },
  { name: 'Photo_Defect.jpg', type: 'Image', size: '480 KB', uploadedOn: '02-Oct-2026 10:46', uploadedBy: 'Kannan P' },
  { name: 'Customer_Drawing_DR-1001.pdf', type: 'PDF', size: '1.2 MB', uploadedOn: '02-Oct-2026 10:50', uploadedBy: 'Kannan P' },
];

const CAPA_ACTIONS = [
  { no: 1, type: 'Immediate Action', description: 'Segregate and hold all affected material', responsible: 'Suresh', target: '02-Oct-2026', status: 'Completed', remarks: 'All material segregated' },
  { no: 2, type: 'Corrective Action', description: 'Tool correction and rework rejected parts', responsible: 'Radhakrishnan', target: '04-Oct-2026', status: 'In Progress', remarks: 'Tool adjusted' },
  { no: 3, type: 'Preventive Action', description: 'Update inspection checklist and operator training', responsible: 'Kannan P', target: '10-Oct-2026', status: 'Pending', remarks: 'To be scheduled' },
];

const CAPA_STATUS_COLOR = { Completed: 'success', 'In Progress': 'warning', Pending: 'error' };

function SectionTitle({ icon: Icon, children, action }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Icon fontSize="small" color="primary" />
        <Typography variant="subtitle1" fontWeight={700} color="primary.main">{children}</Typography>
      </Stack>
      {action}
    </Stack>
  );
}

function BreadcrumbTrail() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexWrap: 'wrap' }}>
      {/* <Typography variant="body2" color="primary.main">Manufacturing</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Quality</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="primary.main">Non-Conformance (NCR)</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>New NCR</Typography> */}
    </Stack>
  );
}

export default function NewNCR() {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(() => new Set());
  const [capaChecked, setCapaChecked] = useState(() => new Set());

  const toggleRow = (setFn, no) => {
    setFn((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/quality/ncr')}>Back to List</Button>
        <Button variant="contained" startIcon={<SaveOutlinedIcon />}>Save</Button>
        <Button variant="contained" startIcon={<NoteAddOutlinedIcon />}>Save &amp; New</Button>
        <Button variant="outlined" startIcon={<VisibilityOutlinedIcon />}>Preview</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />} sx={{ bgcolor: '#17315c', '&:hover': { bgcolor: '#102244' } }}>Submit</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<ReportGmailerrorredOutlinedIcon />}
        title="New Non-Conformance (NCR)"
        subtitle="Create and record non-conformance, take corrective actions and prevent recurrence."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionTitle icon={ArticleOutlinedIcon}>1. NCR Information</SectionTitle>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="NCR No." value="Auto Generate" InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-input': { color: 'text.disabled' } }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="NCR Date" defaultValue="2026-10-02" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Source" defaultValue="Incoming Inspection">
                {['Incoming Inspection', 'In-Process Inspection', 'Final Inspection', 'Subcontract'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Inspection No." defaultValue="IN-2026-001"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Production Order" defaultValue="PO-2026-001"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Item Code" defaultValue="FG-1001"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Item Description" defaultValue="Gear Housing" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Batch / Lot No." defaultValue="BCH-001"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="NCR Type" defaultValue="Dimension Out">
                {['Dimension Out', 'Material Defect', 'Process Deviation', 'Documentation'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Defect Type" defaultValue="Hole Diameter">
                {['Hole Diameter', 'Surface Finish', 'Crack', 'Hardness Low'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Defect Category" defaultValue="Dimension">
                {['Dimension', 'Surface', 'Material', 'Visual'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Severity" defaultValue="Major" sx={{ '& .MuiInputBase-root': { bgcolor: 'error.lighter' } }}>
                {['Minor', 'Major', 'Critical'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Status" defaultValue="Open" sx={{ '& .MuiInputBase-root': { bgcolor: 'error.lighter' } }}>
                {['Open', 'In Progress', 'Closed', 'Reopened'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" required type="number" label="Quantity Involved" defaultValue={20} />
                <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                  {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" required type="number" label="Quantity Rejected" defaultValue={20} />
                <TextField size="small" select defaultValue="Nos" sx={{ minWidth: 80 }}>
                  {['Nos', 'Kg', 'Mtr'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Work Center" defaultValue="ASSEMBLY-01"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Responsible Person" defaultValue="Kannan P"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Reported By" defaultValue="Quality Inspector"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack direction="row" spacing={1}>
                <TextField fullWidth size="small" type="date" label="Detected On" defaultValue="2026-10-02" InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="time" defaultValue="10:30" InputLabelProps={{ shrink: true }} sx={{ minWidth: 110 }} />
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Department" defaultValue="Quality">
                {['Quality', 'Production', 'Stores', 'Subcontracting'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Customer" defaultValue="ABC Engineering Ltd."
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Due Date" defaultValue="2026-10-05" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Reference" defaultValue="Customer Drawing DR-1001" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" multiline minRows={1} label="Remarks" defaultValue="Hole diameter is 0.5 mm over tolerance. Part rejected." />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionTitle
            icon={ReportProblemOutlinedIcon}
            action={<Button variant="outlined" size="small" startIcon={<AddIcon />}>Add Defect</Button>}
          >
            2. Defect Details
          </SectionTitle>
          <ScrollableTableContainer maxHeight="clamp(200px, 32vh, 340px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"><Checkbox size="small" /></TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>Characteristic</TableCell>
                  <TableCell>Specification</TableCell>
                  <TableCell>Actual Value</TableCell>
                  <TableCell>Deviation</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell>Inspection Method</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {DEFECTS.map((row) => (
                  <TableRow key={row.no} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(row.no)} onChange={() => toggleRow(setChecked, row.no)} />
                    </TableCell>
                    <TableCell>{row.no}</TableCell>
                    <TableCell>{row.characteristic}</TableCell>
                    <TableCell>{row.spec}</TableCell>
                    <TableCell>
                      <Chip size="small" label={row.actual} color="error" variant="outlined" sx={{ bgcolor: 'error.lighter' }} />
                    </TableCell>
                    <TableCell>{row.deviation}</TableCell>
                    <TableCell>{row.uom}</TableCell>
                    <TableCell>{row.method}</TableCell>
                    <TableCell>{row.remarks}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" color="primary"><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionTitle icon={AttachFileOutlinedIcon}>3. Attachments</SectionTitle>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={4}>
              <Box
                sx={{
                  border: '1.5px dashed', borderColor: 'divider', borderRadius: 1.5,
                  py: 4, textAlign: 'center', color: 'text.secondary', height: '100%',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <CloudUploadOutlinedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" sx={{ mb: 1.5 }}>Drag &amp; Drop files here or</Typography>
                <Button variant="outlined" size="small">Browse Files</Button>
              </Box>
            </Grid>
            <Grid item xs={12} md={8}>
              <ScrollableTableContainer maxHeight="clamp(160px, 28vh, 260px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>File Name</TableCell>
                      <TableCell>File Type</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Uploaded On</TableCell>
                      <TableCell>Uploaded By</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {ATTACHMENTS.map((f) => (
                      <TableRow key={f.name} hover>
                        <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{f.name}</Typography></TableCell>
                        <TableCell>{f.type}</TableCell>
                        <TableCell>{f.size}</TableCell>
                        <TableCell>{f.uploadedOn}</TableCell>
                        <TableCell>{f.uploadedBy}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <IconButton size="small" color="primary"><FileDownloadOutlinedIcon fontSize="small" /></IconButton>
                            <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent>
          <SectionTitle
            icon={BuildCircleOutlinedIcon}
            action={<Button variant="outlined" size="small" startIcon={<AddIcon />}>Add Action</Button>}
          >
            4. Corrective Action Plan (CAPA)
          </SectionTitle>
          <ScrollableTableContainer maxHeight="clamp(200px, 32vh, 340px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"><Checkbox size="small" /></TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>Action Type</TableCell>
                  <TableCell>Action Description</TableCell>
                  <TableCell>Responsible Person</TableCell>
                  <TableCell>Target Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {CAPA_ACTIONS.map((row) => (
                  <TableRow key={row.no} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={capaChecked.has(row.no)} onChange={() => toggleRow(setCapaChecked, row.no)} />
                    </TableCell>
                    <TableCell>{row.no}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>{row.responsible}</TableCell>
                    <TableCell>{row.target}</TableCell>
                    <TableCell><Chip size="small" label={row.status} color={CAPA_STATUS_COLOR[row.status] || 'default'} /></TableCell>
                    <TableCell>{row.remarks}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <IconButton size="small" color="primary"><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}
