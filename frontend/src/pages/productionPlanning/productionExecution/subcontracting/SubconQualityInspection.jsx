import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Chip, Checkbox, InputAdornment, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterListOutlinedIcon from '@mui/icons-material/FilterListOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EntityHeaderCard from '../../../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../../../components/data-display/ScrollableTableContainer';
import EntityListPagination from '../../../../components/data-display/EntityListPagination';

// ---------------------------------------------------------------------------
// Static, UI-only mock of "Quality Inspection" for subcontracted goods under
// Production Execution > Subcontracting. No reference screenshots supplied;
// built from scratch following the same filter/list/pagination convention
// used across this module.
// ---------------------------------------------------------------------------

const VENDORS = ['All Vendors', 'Precision Platers Pvt Ltd', 'Shree Heat Treatment Works', 'Apex Coatings Ltd', 'Sun Plating Industries', 'Metro Surface Finishers'];
const RESULT_OPTIONS = ['All', 'Pass', 'Fail', 'Partial'];
const RESULT_COLOR = { Pass: 'success', Fail: 'error', Partial: 'warning' };

const INSPECTIONS = [
  { no: 'QI-2026-041', date: '07-Oct-2026', inward: 'SCI-2026-030', vendor: 'Sun Plating Industries', itemCode: 'FG-1006', itemDesc: 'Bracket', inspected: 150, accepted: 150, rejected: 0, result: 'Pass' },
  { no: 'QI-2026-040', date: '04-Oct-2026', inward: 'SCI-2026-029', vendor: 'Metro Surface Finishers', itemCode: 'FG-1001', itemDesc: 'Gear Housing', inspected: 400, accepted: 390, rejected: 10, result: 'Partial' },
  { no: 'QI-2026-039', date: '02-Oct-2026', inward: 'SCI-2026-028', vendor: 'Precision Platers Pvt Ltd', itemCode: 'FG-1003', itemDesc: 'Pin', inspected: 1000, accepted: 940, rejected: 60, result: 'Partial' },
  { no: 'QI-2026-038', date: '27-Sep-2026', inward: 'SCI-2026-027', vendor: 'Shree Heat Treatment Works', itemCode: 'FG-1004', itemDesc: 'Shaft', inspected: 280, accepted: 0, rejected: 280, result: 'Fail' },
  { no: 'QI-2026-037', date: '21-Sep-2026', inward: 'SCI-2026-026', vendor: 'Apex Coatings Ltd', itemCode: 'FG-1002', itemDesc: 'Cover Plate', inspected: 320, accepted: 320, rejected: 0, result: 'Pass' },
];

function numberFmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

export default function SubconQualityInspection() {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-10-31');
  const [vendor, setVendor] = useState('All Vendors');
  const [result, setResult] = useState('All');
  const [inwardSearch, setInwardSearch] = useState('');
  const [search, setSearch] = useState('');
  const [checked, setChecked] = useState(() => new Set());
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const rows = useMemo(() => INSPECTIONS.filter((i) => {
    if (vendor !== 'All Vendors' && i.vendor !== vendor) return false;
    if (result !== 'All' && i.result !== result) return false;
    if (inwardSearch && !i.inward.toLowerCase().includes(inwardSearch.toLowerCase())) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return i.no.toLowerCase().includes(q) || i.vendor.toLowerCase().includes(q) || i.itemCode.toLowerCase().includes(q);
  }), [vendor, result, inwardSearch, search]);

  const summary = useMemo(() => ({
    total: INSPECTIONS.length,
    pass: INSPECTIONS.filter((i) => i.result === 'Pass').length,
    partial: INSPECTIONS.filter((i) => i.result === 'Partial').length,
    fail: INSPECTIONS.filter((i) => i.result === 'Fail').length,
  }), []);

  const toggleRow = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const headerActions = (
    <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/production-execution/subcontracting/new-inspection')}>
        New Inspection
      </Button>
    </Stack>
  );

  const tiles = [
    { label: 'Total Inspections', value: summary.total, icon: FactCheckOutlinedIcon, color: 'primary' },
    { label: 'Passed', value: summary.pass, icon: CheckCircleOutlineIcon, color: 'success' },
    { label: 'Partial', value: summary.partial, icon: HourglassBottomOutlinedIcon, color: 'warning' },
    { label: 'Failed', value: summary.fail, icon: CancelOutlinedIcon, color: 'error' },
  ];

  return (
    <Box>
      <EntityHeaderCard
        icon={<RuleOutlinedIcon />}
        title="Quality Inspection"
        subtitle="Inspect goods received from subcontract vendors and record accepted / rejected quantities."
        rightContent={headerActions}
      />

      <Grid container spacing={2} sx={{ mb: 2 }}>
        {tiles.map((t) => {
          const Icon = t.icon;
          return (
            <Grid item xs={12} sm={6} md={3} key={t.label}>
              <Card variant="outlined">
                <CardContent>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: `${t.color}.lighter`, color: `${t.color}.main`, flexShrink: 0 }}>
                      <Icon fontSize="small" />
                    </Box>
                    <Box>
                      <Typography variant="h6" fontWeight={700} lineHeight={1.2}>{t.value}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.label}</Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>

      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2.5 }}>
            <FilterListOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>Filter / Search</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" type="date" label="From Date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" type="date" label="To Date" value={toDate} onChange={(e) => setToDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Vendor" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                {VENDORS.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Result" value={result} onChange={(e) => setResult(e.target.value)}>
                {RESULT_OPTIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField
                fullWidth size="small" label="Inward No." placeholder="Search inward..."
                value={inwardSearch} onChange={(e) => setInwardSearch(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={1}>
              <Button fullWidth variant="contained" color="warning" startIcon={<SearchIcon />} sx={{ height: '40px' }}>Search</Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
          <Stack direction="row" alignItems="center" spacing={1.25}>
            <Typography variant="subtitle1" fontWeight={700}>Quality Inspection</Typography>
            <Chip size="small" label={rows.length} color="primary" />
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
            <TextField
              size="small" placeholder="Search in list..." value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              sx={{ minWidth: 220 }}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Button variant="outlined" size="small" startIcon={<FileDownloadOutlinedIcon />}>Export</Button>
          </Stack>
        </Stack>

        <ScrollableTableContainer maxHeight="clamp(260px, calc(100vh - 560px), 460px)">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" />
                <TableCell>S.No</TableCell>
                <TableCell>Inspection No.</TableCell>
                <TableCell>Inspection Date</TableCell>
                <TableCell>Inward No.</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Item</TableCell>
                <TableCell align="right">Inspected Qty</TableCell>
                <TableCell align="right">Accepted Qty</TableCell>
                <TableCell align="right">Rejected Qty</TableCell>
                <TableCell>Result</TableCell>
                <TableCell>Action</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((i, idx) => (
                <TableRow key={i.no} hover>
                  <TableCell padding="checkbox">
                    <Checkbox size="small" checked={checked.has(i.no)} onChange={() => toggleRow(i.no)} />
                  </TableCell>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.no}</Typography></TableCell>
                  <TableCell>{i.date}</TableCell>
                  <TableCell><Typography variant="body2" color="primary.main" fontWeight={600}>{i.inward}</Typography></TableCell>
                  <TableCell>{i.vendor}</TableCell>
                  <TableCell>{i.itemCode} - {i.itemDesc}</TableCell>
                  <TableCell align="right">{numberFmt(i.inspected)}</TableCell>
                  <TableCell align="right">{numberFmt(i.accepted)}</TableCell>
                  <TableCell align="right">{numberFmt(i.rejected)}</TableCell>
                  <TableCell><Chip size="small" label={i.result} color={RESULT_COLOR[i.result] || 'default'} /></TableCell>
                  <TableCell>
                    <Button size="small" endIcon={<KeyboardArrowDownIcon />}>View</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollableTableContainer>

        <EntityListPagination
          total={rows.length}
          page={page}
          onChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={(size) => { setPageSize(size); setPage(0); }}
        />
      </Card>
    </Box>
  );
}
