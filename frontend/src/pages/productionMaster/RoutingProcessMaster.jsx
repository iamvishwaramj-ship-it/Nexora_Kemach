import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Pagination, Collapse,
} from '@mui/material';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Routing / Process Master" list screen, built
// to match the reference screenshot the user supplied. Same convention as
// BomMaster.jsx / BomVersion.jsx: fixed mock data only -- nothing persists
// or calls the server. The "New Routing" button opens the
// NewRoutingProcess create screen.
// ---------------------------------------------------------------------------

const PROCESS_TYPES = ['All', 'Manufacturing', 'Engineering'];
const ROUTING_TYPES = ['All', 'Standard', 'Alternate'];
const ITEM_GROUPS = ['All', 'Fabrication', 'Machining', 'Assembly'];
const STATUS_OPTIONS = ['All', 'Active', 'Under Review', 'Inactive'];

const STATUS_COLOR = { Active: 'success', 'Under Review': 'warning', Inactive: 'error' };

const ROUTINGS = [
  { no: 1, routingNo: 'RO-2026-001', routingName: 'Gear Housing Routing', itemCode: 'FG-1001', itemDesc: 'Gear Housing', processType: 'Manufacturing', ops: 8, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Active' },
  { no: 2, routingNo: 'RO-2026-002', routingName: 'Pump Cover Routing', itemCode: 'FG-1002', itemDesc: 'Pump Cover', processType: 'Manufacturing', ops: 6, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Active' },
  { no: 3, routingNo: 'RO-2026-003', routingName: 'Valve Body Routing', itemCode: 'FG-1003', itemDesc: 'Valve Body', processType: 'Manufacturing', ops: 7, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Active' },
  { no: 4, routingNo: 'RO-2026-004', routingName: 'Pump Assembly Routing', itemCode: 'FG-1004', itemDesc: 'Pump Assembly', processType: 'Manufacturing', ops: 9, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Under Review' },
  { no: 5, routingNo: 'RO-2026-005', routingName: 'Coupling Routing', itemCode: 'FG-1005', itemDesc: 'Coupling', processType: 'Manufacturing', ops: 5, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Active' },
  { no: 6, routingNo: 'RO-2026-006', routingName: 'Gear Box Routing', itemCode: 'FG-1006', itemDesc: 'Gear Box', processType: 'Manufacturing', ops: 10, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Active' },
  { no: 7, routingNo: 'RO-2026-007', routingName: 'Motor Bracket Routing', itemCode: 'RM-2001', itemDesc: 'Motor Bracket', processType: 'Manufacturing', ops: 6, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Inactive' },
  { no: 8, routingNo: 'RO-2026-008', routingName: 'Spindle Housing Routing', itemCode: 'FG-1007', itemDesc: 'Spindle Housing', processType: 'Manufacturing', ops: 8, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Active' },
  { no: 9, routingNo: 'RO-2026-009', routingName: 'Base Frame Routing', itemCode: 'FG-1008', itemDesc: 'Base Frame', processType: 'Manufacturing', ops: 7, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Active' },
  { no: 10, routingNo: 'RO-2026-010', routingName: 'Shaft Routing', itemCode: 'FG-1009', itemDesc: 'Shaft', processType: 'Manufacturing', ops: 6, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Active' },
];

const TOTAL_RECORDS = 12;
const TOTAL_PAGES = 3;

export default function RoutingProcessMaster() {
  const navigate = useNavigate();
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [routingNoSearch, setRoutingNoSearch] = useState('');
  const [routingNameSearch, setRoutingNameSearch] = useState('');
  const [itemCodeSearch, setItemCodeSearch] = useState('');
  const [itemGroup, setItemGroup] = useState('All');
  const [processType, setProcessType] = useState('All');
  const [routingType, setRoutingType] = useState('All');
  const [status, setStatus] = useState('All');
  const [effFrom, setEffFrom] = useState('');
  const [effTo, setEffTo] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState(() => new Set());

  const toggleAll = () => {
    setChecked((prev) => (prev.size === ROUTINGS.length ? new Set() : new Set(ROUTINGS.map((r) => r.routingNo))));
  };
  const toggleOne = (key) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const breadcrumb = (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
 
    </Stack>
  );

  const headerActions = (
    <Stack spacing={1} alignItems="flex-end">
      {breadcrumb}
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-master/new-routing')}>
        New Routing
      </Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<SettingsOutlinedIcon />}
        title="Routing / Process Master"
        subtitle="Define and manage routing / process sequence with operations."
        rightContent={headerActions}
      />

      {/* Filter Criteria */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: filtersOpen ? 2.5 : 0 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <FilterAltOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>Filter Criteria</Typography>
            </Stack>
            <Button
              size="small"
              color="inherit"
              endIcon={filtersOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              {filtersOpen ? 'Collapse' : 'Expand'}
            </Button>
          </Stack>
          <Collapse in={filtersOpen}>
            <Grid container spacing={2.5}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth size="small" label="Routing No." placeholder="Search Routing No..."
                  value={routingNoSearch} onChange={(e) => setRoutingNoSearch(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth size="small" label="Routing Name" placeholder="Search Routing Name..."
                  value={routingNameSearch} onChange={(e) => setRoutingNameSearch(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth size="small" label="Item Code" placeholder="Search Item..."
                  value={itemCodeSearch} onChange={(e) => setItemCodeSearch(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField fullWidth size="small" select label="Item Group" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
                  {ITEM_GROUPS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
              </Grid>

              <Grid item xs={12} sm={6} md={2.4}>
                <TextField fullWidth size="small" select label="Process Type" value={processType} onChange={(e) => setProcessType(e.target.value)}>
                  {PROCESS_TYPES.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <TextField fullWidth size="small" select label="Routing Type" value={routingType} onChange={(e) => setRoutingType(e.target.value)}>
                  {ROUTING_TYPES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <TextField fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <TextField
                  fullWidth size="small" label="Effective Date From" placeholder="dd-mmm-yyyy"
                  value={effFrom} onChange={(e) => setEffFrom(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><EventOutlinedIcon fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <TextField
                  fullWidth size="small" label="Effective Date To" placeholder="dd-mmm-yyyy"
                  value={effTo} onChange={(e) => setEffTo(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><EventOutlinedIcon fontSize="small" color="action" /></InputAdornment> }}
                />
              </Grid>
            </Grid>
            <Stack direction="row" justifyContent="flex-end" spacing={1.5} sx={{ mt: 2 }}>
              <Button variant="outlined">Reset</Button>
              <Button variant="contained" startIcon={<SearchIcon />}>Search</Button>
            </Stack>
          </Collapse>
        </CardContent>
      </Card>

      {/* Routing / Process Master table */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ListAltOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>Routing / Process Master List ({TOTAL_RECORDS} records)</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2" color="text.secondary">Records per page</Typography>
              <TextField select size="small" value={rowsPerPage} onChange={(e) => setRowsPerPage(e.target.value)} sx={{ width: 80 }}>
                <MenuItem value={10}>10</MenuItem>
                <MenuItem value={25}>25</MenuItem>
                <MenuItem value={50}>50</MenuItem>
              </TextField>
            </Stack>
          </Stack>

          <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 560px), 520px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={checked.size === ROUTINGS.length}
                      indeterminate={checked.size > 0 && checked.size < ROUTINGS.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>Routing No.</TableCell>
                  <TableCell>Routing Name</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell>Process Type</TableCell>
                  <TableCell align="right">No. of Operations</TableCell>
                  <TableCell>Effective From</TableCell>
                  <TableCell>Effective To</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ROUTINGS.map((r) => (
                  <TableRow key={r.routingNo} hover selected={checked.has(r.routingNo)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(r.routingNo)} onChange={() => toggleOne(r.routingNo)} />
                    </TableCell>
                    <TableCell>{r.no}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.routingNo}</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.routingName}</Typography></TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{r.itemCode}</Typography></TableCell>
                    <TableCell>{r.itemDesc}</TableCell>
                    <TableCell>{r.processType}</TableCell>
                    <TableCell align="right">{r.ops}</TableCell>
                    <TableCell>{r.effFrom}</TableCell>
                    <TableCell>{r.effTo}</TableCell>
                    <TableCell><Chip size="small" label={r.status} color={STATUS_COLOR[r.status] || 'default'} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.25}>
                        <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="primary" onClick={() => navigate('/production-master/new-routing')}><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small"><ContentCopyOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error"><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>

          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
            <Pagination count={TOTAL_PAGES} page={page} onChange={(e, v) => setPage(v)} color="primary" />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
