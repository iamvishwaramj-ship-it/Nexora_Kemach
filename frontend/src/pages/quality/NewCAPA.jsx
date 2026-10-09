import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, FormControlLabel, InputAdornment, Table, TableHead, TableBody,
  TableRow, TableCell, IconButton,
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
import SettingsSuggestOutlinedIcon from '@mui/icons-material/SettingsSuggestOutlined';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import AttachFileOutlinedIcon from '@mui/icons-material/AttachFileOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// "Quality > Corrective Action (CAPA) > New CAPA" -- rebuilt to match the
// user-supplied reference screenshot exactly. Static UI-only mock; no
// Quality data model exists in this schema.
// ---------------------------------------------------------------------------

const ACTIONS = [
  { no: 1, type: 'Immediate Action', description: 'Stop production and segregate affected lot', responsible: 'Suresh', target: '02-Oct-2026', status: 'Completed', remarks: '20 pcs segregated' },
  { no: 2, type: 'Corrective Action', description: 'Calibrate machine and rework rejected parts', responsible: 'Radhakrishnan', target: '05-Oct-2026', status: 'In Progress', remarks: 'Calibration done, rework in progress' },
  { no: 3, type: 'Preventive Action', description: 'Implement preventive maintenance schedule', responsible: 'Kannan P', target: '10-Oct-2026', status: 'Pending', remarks: 'Schedule to be implemented' },
  { no: 4, type: 'Preventive Action', description: 'Update work instruction and operator training', responsible: 'Dheena', target: '12-Oct-2026', status: 'Pending', remarks: 'Training planned' },
];

const ACTION_STATUS_COLOR = { Completed: 'success', 'In Progress': 'warning', Pending: 'error' };

const ATTACHMENTS = [
  { name: 'Root_Cause_Analysis.pdf', type: 'PDF', size: '320 KB', uploadedOn: '02-Oct-2026' },
  { name: 'Machine_Calibration_Report.jpg', type: 'Image', size: '480 KB', uploadedOn: '03-Oct-2026' },
];

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
      <Typography variant="body2" color="primary.main">Corrective Action (CAPA)</Typography>
      <Typography variant="body2" color="text.disabled">&gt;</Typography>
      <Typography variant="body2" color="error.main" fontWeight={700}>New CAPA</Typography> */}
    </Stack>
  );
}

export default function NewCAPA() {
  const navigate = useNavigate();
  const [actionChecked, setActionChecked] = useState(() => new Set());
  const [scope, setScope] = useState({ currentLot: true, previousLots: false, inProcess: true, customer: false, other: false });

  const toggleAction = (no) => {
    setActionChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const toggleScope = (key) => {
    setScope((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const headerRight = (
    <Stack spacing={1} alignItems="flex-end">
      <BreadcrumbTrail />
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate('/quality/capa')}>Back to List</Button>
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
        title="New Corrective Action (CAPA)"
        subtitle="Create and record corrective or preventive action to eliminate root causes and prevent recurrence."
        rightContent={headerRight}
      />

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionTitle icon={ArticleOutlinedIcon}>1. CAPA Information</SectionTitle>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="CAPA No." value="Auto Generate" InputProps={{ readOnly: true }} sx={{ '& .MuiInputBase-input': { color: 'text.disabled' } }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Related NCR No." defaultValue="NCR-2026-001"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Source" defaultValue="Incoming Inspection">
                {['Incoming Inspection', 'In-Process Inspection', 'Final Inspection', 'Subcontract', 'Customer'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Type" defaultValue="Corrective">
                {['Corrective', 'Preventive'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Priority" defaultValue="High" sx={{ '& .MuiInputBase-root': { bgcolor: 'error.lighter' } }}>
                {['Low', 'Medium', 'High'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Target Completion Date" defaultValue="2026-10-10" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Responsible Person" defaultValue="Kannan P"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Status" defaultValue="Open" sx={{ '& .MuiInputBase-root': { bgcolor: 'error.lighter' } }}>
                {['Open', 'In Progress', 'Completed', 'Closed'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" multiline minRows={3} required label="Problem Description" defaultValue="Hole diameter is 0.5 mm over tolerance as per drawing DR-1001." />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={2.5}>
                <TextField fullWidth size="small" select label="Department" defaultValue="Production">
                  {['Production', 'Quality', 'Stores', 'Subcontracting'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" type="date" label="Planned Start Date" required defaultValue="2026-10-02" InputLabelProps={{ shrink: true }} />
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth size="small" label="Customer" defaultValue="ABC Engineering Ltd."
                  InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <TextField fullWidth size="small" type="date" label="Planned End Date" required defaultValue="2026-10-10" InputLabelProps={{ shrink: true }} />
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth size="small" label="Item Code" defaultValue="FG-1001"
                  InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <TextField fullWidth size="small" type="date" label="Actual Start Date" InputLabelProps={{ shrink: true }} />
              </Stack>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required select label="Root Cause Category" defaultValue="Machine">
                {['Machine', 'Man', 'Method', 'Material', 'Measurement'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Item Description" defaultValue="Gear Housing" InputProps={{ readOnly: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Actual End Date" InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" type="date" label="Effectiveness Check Date" InputLabelProps={{ shrink: true }} />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required label="Root Cause" defaultValue="Machine calibration out of range" />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="Work Center" defaultValue="ASSEMBLY-01"
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <TextField fullWidth size="small" multiline minRows={2} label="Remarks" defaultValue="Implement corrective action to eliminate dimension variation and prevent recurrence." />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionTitle icon={SettingsSuggestOutlinedIcon}>2. Root Cause Analysis</SectionTitle>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={5}>
              <Stack spacing={2.5}>
                <TextField fullWidth size="small" select label="Analysis Method" defaultValue="5 Why">
                  {['5 Why', 'Fishbone (Ishikawa)', 'Pareto Analysis', 'Fault Tree Analysis'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
                <TextField
                  fullWidth size="small" multiline minRows={6} label="Details"
                  defaultValue={'1. Why dimension out of tolerance?\n2. Why machining process variation?\n3. Why machine calibration not done?\n4. Why calibration schedule not followed?\n5. Why no monitoring system?\n-> Root Cause: Machine calibration not maintained as per schedule.'}
                />
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Supporting Evidence</Typography>
              <Box
                sx={{
                  border: '1.5px dashed', borderColor: 'divider', borderRadius: 1.5,
                  py: 4, textAlign: 'center', color: 'text.secondary',
                }}
              >
                <CloudUploadOutlinedIcon sx={{ fontSize: 32, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" sx={{ mb: 1.5 }}>Drag &amp; Drop files here or</Typography>
                <Button variant="outlined" size="small">Browse Files</Button>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Affected Scope</Typography>
              <Stack spacing={0.5}>
                {[
                  { key: 'currentLot', label: 'Current Lot' },
                  { key: 'previousLots', label: 'Previous Lots' },
                  { key: 'inProcess', label: 'In-Process' },
                  { key: 'customer', label: 'Customer' },
                  { key: 'other', label: 'Other' },
                ].map((o) => (
                  <FormControlLabel
                    key={o.key}
                    control={<Checkbox size="small" checked={scope[o.key]} onChange={() => toggleScope(o.key)} />}
                    label={<Typography variant="body2">{o.label}</Typography>}
                  />
                ))}
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <SectionTitle
            icon={BuildCircleOutlinedIcon}
            action={<Button variant="outlined" size="small" startIcon={<AddIcon />}>Add Action</Button>}
          >
            3. Action Plan
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
                {ACTIONS.map((row) => (
                  <TableRow key={row.no} hover>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={actionChecked.has(row.no)} onChange={() => toggleAction(row.no)} />
                    </TableCell>
                    <TableCell>{row.no}</TableCell>
                    <TableCell>{row.type}</TableCell>
                    <TableCell>{row.description}</TableCell>
                    <TableCell>{row.responsible}</TableCell>
                    <TableCell>{row.target}</TableCell>
                    <TableCell><Chip size="small" label={row.status} color={ACTION_STATUS_COLOR[row.status] || 'default'} /></TableCell>
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

      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionTitle icon={CheckCircleOutlineIcon}>4. Effectiveness Check</SectionTitle>
              <Stack spacing={2}>
                <TextField fullWidth size="small" type="date" label="Effectiveness Check Date" defaultValue="2026-10-20" InputLabelProps={{ shrink: true }} />
                <TextField fullWidth size="small" select label="Result" defaultValue="Effective">
                  {['Effective', 'Partially Effective', 'Not Effective'].map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" multiline minRows={2} label="Remarks" defaultValue="No further deviation observed in subsequent lots." />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionTitle icon={TaskAltOutlinedIcon}>5. CAPA Closure</SectionTitle>
              <Stack spacing={2}>
                <TextField fullWidth size="small" type="date" label="Closure Date" defaultValue="2026-10-21" InputLabelProps={{ shrink: true }} />
                <TextField
                  fullWidth size="small" label="Closed By" defaultValue="Quality Manager"
                  InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
                />
                <TextField fullWidth size="small" multiline minRows={2} label="Closure Remarks" defaultValue="CAPA actions implemented and verified effective. No recurrence observed." />
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card variant="outlined" sx={{ height: '100%' }}>
            <CardContent>
              <SectionTitle icon={AttachFileOutlinedIcon}>6. Attachments</SectionTitle>
              <Box
                sx={{
                  border: '1.5px dashed', borderColor: 'divider', borderRadius: 1.5,
                  py: 3, textAlign: 'center', color: 'text.secondary', mb: 2,
                }}
              >
                <CloudUploadOutlinedIcon sx={{ fontSize: 28, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body2" sx={{ mb: 1.5 }}>Drag &amp; Drop files here or</Typography>
                <Button variant="outlined" size="small">Browse Files</Button>
              </Box>
              <ScrollableTableContainer maxHeight="clamp(120px, 20vh, 200px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>File Name</TableCell>
                      <TableCell>File Type</TableCell>
                      <TableCell>Size</TableCell>
                      <TableCell>Uploaded On</TableCell>
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
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
