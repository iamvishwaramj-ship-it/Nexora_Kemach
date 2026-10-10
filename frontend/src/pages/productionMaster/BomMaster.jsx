import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell, IconButton, Pagination,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "BOM Master" list screen, built to match the
// reference screenshot the user supplied. Same convention as the rest of
// this project: fixed mock data only -- nothing persists or calls the
// server. Lives under Production Master > BOM (see navConfig.js /
// AppRouter.jsx); the "New BOM" button opens the NewBom create screen.
// ---------------------------------------------------------------------------

const BOM_TYPES = ['All', 'Manufacturing', 'Engineering', 'Sales'];
const ITEM_GROUPS = ['All', 'Fabrication', 'Machining', 'Assembly'];
const REVISIONS = ['All', '00', '01', '02'];
const STATUS_OPTIONS = ['All', 'Active', 'Under Review', 'Inactive'];

const STATUS_COLOR = { Active: 'success', 'Under Review': 'warning', Inactive: 'error' };

const BOMS = [
  { no: 1, bomNo: 'BOM-2026-001', revision: '00', itemCode: 'FG-1001', itemDesc: 'Gear Housing', itemGroup: 'Fabrication', bomType: 'Manufacturing', status: 'Active', effDate: '01-Oct-2026' },
  { no: 2, bomNo: 'BOM-2026-002', revision: '01', itemCode: 'FG-1002', itemDesc: 'Pump Cover', itemGroup: 'Machining', bomType: 'Manufacturing', status: 'Active', effDate: '01-Oct-2026' },
  { no: 3, bomNo: 'BOM-2026-003', revision: '00', itemCode: 'FG-1003', itemDesc: 'Valve Body', itemGroup: 'Machining', bomType: 'Manufacturing', status: 'Under Review', effDate: '05-Oct-2026' },
  { no: 4, bomNo: 'BOM-2026-004', revision: '00', itemCode: 'FG-1004', itemDesc: 'Pump Assembly', itemGroup: 'Assembly', bomType: 'Manufacturing', status: 'Active', effDate: '06-Oct-2026' },
  { no: 5, bomNo: 'BOM-2026-005', revision: '02', itemCode: 'FG-1005', itemDesc: 'Coupling', itemGroup: 'Machining', bomType: 'Manufacturing', status: 'Active', effDate: '10-Oct-2026' },
  { no: 6, bomNo: 'BOM-2026-006', revision: '00', itemCode: 'FG-1006', itemDesc: 'Gear Box', itemGroup: 'Assembly', bomType: 'Manufacturing', status: 'Inactive', effDate: '12-Oct-2026' },
  { no: 7, bomNo: 'BOM-2026-007', revision: '00', itemCode: 'RM-2001', itemDesc: 'Motor Bracket', itemGroup: 'Fabrication', bomType: 'Manufacturing', status: 'Active', effDate: '15-Oct-2026' },
  { no: 8, bomNo: 'BOM-2026-008', revision: '00', itemCode: 'FG-1007', itemDesc: 'Spindle Housing', itemGroup: 'Machining', bomType: 'Manufacturing', status: 'Active', effDate: '18-Oct-2026' },
  { no: 9, bomNo: 'BOM-2026-009', revision: '00', itemCode: 'FG-1008', itemDesc: 'Bearing Cap', itemGroup: 'Machining', bomType: 'Manufacturing', status: 'Active', effDate: '20-Oct-2026' },
  { no: 10, bomNo: 'BOM-2026-010', revision: '00', itemCode: 'FG-1009', itemDesc: 'Assembly Frame', itemGroup: 'Fabrication', bomType: 'Manufacturing', status: 'Under Review', effDate: '22-Oct-2026' },
];

const TOTAL_RECORDS = 18;
const TOTAL_PAGES = 3;

export default function BomMaster() {
  const navigate = useNavigate();
  const [bomNoSearch, setBomNoSearch] = useState('');
  const [itemCodeSearch, setItemCodeSearch] = useState('');
  const [itemDescSearch, setItemDescSearch] = useState('');
  const [bomType, setBomType] = useState('All');
  const [itemGroup, setItemGroup] = useState('All');
  const [revision, setRevision] = useState('All');
  const [status, setStatus] = useState('All');
  const [effFrom, setEffFrom] = useState('');
  const [effTo, setEffTo] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const [checked, setChecked] = useState(() => new Set());

  const toggleAll = () => {
    setChecked((prev) => (prev.size === BOMS.length ? new Set() : new Set(BOMS.map((b) => b.bomNo))));
  };
  const toggleOne = (bomNo) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(bomNo)) next.delete(bomNo); else next.add(bomNo);
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
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-master/new-bom')}>
        New BOM
      </Button>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<AccountTreeOutlinedIcon />}
        title="BOM Master"
        subtitle="Manage Bill of Material master data."
        rightContent={headerActions}
      />

      {/* Filter Criteria */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
            <FilterAltOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Filter Criteria</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" label="BOM No." placeholder="Search BOM No..."
                value={bomNoSearch} onChange={(e) => setBomNoSearch(e.target.value)}
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
              <TextField
                fullWidth size="small" label="Item Description" placeholder="Search Description..."
                value={itemDescSearch} onChange={(e) => setItemDescSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="BOM Type" value={bomType} onChange={(e) => setBomType(e.target.value)}>
                {BOM_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Item Group" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
                {ITEM_GROUPS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <TextField fullWidth size="small" select label="Revision" value={revision} onChange={(e) => setRevision(e.target.value)}>
                {REVISIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
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
        </CardContent>
      </Card>

      {/* BOM Master table */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 1.5 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ListAltOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>BOM Master List ({TOTAL_RECORDS} records)</Typography>
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

          <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 520px), 520px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={checked.size === BOMS.length}
                      indeterminate={checked.size > 0 && checked.size < BOMS.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>BOM No.</TableCell>
                  <TableCell>Revision</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Description</TableCell>
                  <TableCell>Item Group</TableCell>
                  <TableCell>BOM Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Effective Date</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {BOMS.map((b) => (
                  <TableRow key={b.bomNo} hover selected={checked.has(b.bomNo)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(b.bomNo)} onChange={() => toggleOne(b.bomNo)} />
                    </TableCell>
                    <TableCell>{b.no}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{b.bomNo}</Typography></TableCell>
                    <TableCell>{b.revision}</TableCell>
                    <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{b.itemCode}</Typography></TableCell>
                    <TableCell>{b.itemDesc}</TableCell>
                    <TableCell>{b.itemGroup}</TableCell>
                    <TableCell>{b.bomType}</TableCell>
                    <TableCell><Chip size="small" label={b.status} color={STATUS_COLOR[b.status] || 'default'} /></TableCell>
                    <TableCell>{b.effDate}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.25}>
                        <IconButton size="small"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="primary" onClick={() => navigate('/production-master/new-bom')}><EditOutlinedIcon fontSize="small" /></IconButton>
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
