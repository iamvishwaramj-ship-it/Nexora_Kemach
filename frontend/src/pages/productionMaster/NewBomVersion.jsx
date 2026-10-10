import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, InputAdornment, Checkbox, FormControlLabel,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import FunctionsOutlinedIcon from '@mui/icons-material/FunctionsOutlined';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useNotify } from '../../components/feedback/NotificationProvider';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "New BOM Version" create screen, built to
// match the reference screenshot the user supplied. Opens from BomVersion's
// "New Version" button. Same convention as NewBom.jsx: fixed mock data
// only -- nothing persists or calls the server; Save / Save & New / Submit
// only toast + (for Submit) navigate back to the BOM Version list.
// ---------------------------------------------------------------------------

const BOM_TYPES = ['Manufacturing', 'Engineering', 'Sales'];
const ITEM_GROUPS = ['Fabrication', 'Machining', 'Assembly'];
const STATUS_OPTIONS = ['Active', 'Under Review', 'Inactive'];
const ISSUE_TYPES = ['Backflush', 'Manual Issue'];
const CATEGORIES = ['Raw Material', 'Bought Out'];
const UOMS = ['Nos', 'Kg', 'Ltr', 'Mtr', 'Set'];

const COMPONENTS = [
  { no: 1, itemCode: 'RM-2001', itemDesc: 'Casting', category: 'Raw Material', uom: 'Nos', qtyPer: 1.0, stdCost: 1250.0, scrapPct: 0.0, issueType: 'Backflush', remarks: 'Main casting' },
  { no: 2, itemCode: 'RM-2002', itemDesc: 'Bush', category: 'Bought Out', uom: 'Nos', qtyPer: 2.0, stdCost: 180.0, scrapPct: 0.0, issueType: 'Manual Issue', remarks: 'Machined bush' },
  { no: 3, itemCode: 'RM-2003', itemDesc: 'Bolt M12', category: 'Bought Out', uom: 'Nos', qtyPer: 8.0, stdCost: 15.0, scrapPct: 2.0, issueType: 'Manual Issue', remarks: 'Fasteners' },
  { no: 4, itemCode: 'RM-2004', itemDesc: 'Oil Seal', category: 'Bought Out', uom: 'Nos', qtyPer: 1.0, stdCost: 220.0, scrapPct: 0.0, issueType: 'Manual Issue', remarks: 'Oil seal' },
  { no: 5, itemCode: 'RM-2005', itemDesc: 'Gasket', category: 'Raw Material', uom: 'Nos', qtyPer: 1.0, stdCost: 45.0, scrapPct: 0.0, issueType: 'Manual Issue', remarks: 'Gasket sheet' },
  { no: 6, itemCode: 'RM-2006', itemDesc: 'Bearing 6205', category: 'Bought Out', uom: 'Nos', qtyPer: 2.0, stdCost: 350.0, scrapPct: 0.0, issueType: 'Manual Issue', remarks: 'Bearing' },
];

function numberFmt(n, decimals = 2) {
  return Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function totalCost(c) {
  return c.qtyPer * c.stdCost;
}

const TABS = ['1. Component Items (BOM)', '2. Routing (Optional)', '3. Remarks & Documents'];

export default function NewBomVersion() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [bomNo, setBomNo] = useState('BOM-2026-001');
  const [version, setVersion] = useState('V2');
  const [revision, setRevision] = useState('01');
  const [itemCode, setItemCode] = useState('FG-1001');
  const [itemDesc, setItemDesc] = useState('Gear Housing');
  const [itemGroup, setItemGroup] = useState('Fabrication');
  const [bomType, setBomType] = useState('Manufacturing');
  const [effFrom, setEffFrom] = useState('01-Apr-2027');
  const [effTo, setEffTo] = useState('31-Dec-2099');
  const [status, setStatus] = useState('Active');
  const [isDefaultVersion, setIsDefaultVersion] = useState(false);
  const [remarks, setRemarks] = useState('Design change - Version 2 with updated components and process');

  const [activeTab, setActiveTab] = useState(0);
  const [checked, setChecked] = useState(() => new Set());

  const toggleAll = () => {
    setChecked((prev) => (prev.size === COMPONENTS.length ? new Set() : new Set(COMPONENTS.map((c) => c.no))));
  };
  const toggleOne = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const totals = COMPONENTS.reduce(
    (acc, c) => {
      acc.components += 1;
      acc.qtyPer += c.qtyPer;
      acc.materialCost += totalCost(c);
      acc.scrapCost += totalCost(c) * (c.scrapPct / 100);
      return acc;
    },
    { components: 0, qtyPer: 0, materialCost: 0, scrapCost: 0 },
  );
  const totalStdCost = totals.materialCost + totals.scrapCost;

  const handleBackToList = () => navigate('/production-master/bom-version');
  const handleSave = () => notify.success('BOM version saved.');
  const handleSaveAndNew = () => notify.success('BOM version saved. Ready for a new entry.');
  const handleSubmit = () => {
    notify.success('BOM version submitted.');
    navigate('/production-master/bom-version');
  };

  const breadcrumb = (
    <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">

    </Stack>
  );

  const headerActions = (
    <Stack spacing={1} alignItems="flex-end">
      {breadcrumb}
      <Stack direction="row" spacing={1.25} flexWrap="wrap" useFlexGap justifyContent="flex-end">
        <Button variant="outlined" startIcon={<ArrowBackOutlinedIcon />} onClick={handleBackToList}>Back to List</Button>
        <Button variant="outlined" startIcon={<SaveOutlinedIcon />} onClick={handleSave}>Save</Button>
        <Button variant="outlined" startIcon={<LibraryAddOutlinedIcon />} onClick={handleSaveAndNew}>Save &amp; New</Button>
        <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={handleSubmit}>Submit</Button>
      </Stack>
    </Stack>
  );

  return (
    <Box>
      <EntityHeaderCard
        icon={<AccountTreeOutlinedIcon />}
        title="New BOM Version"
        subtitle="Create new version for Bill of Material."
        rightContent={headerActions}
      />

      {/* BOM Version Header */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
            <FilterAltOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>BOM Version Header</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="BOM No." value={bomNo} onChange={(e) => setBomNo(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required label="BOM Type" select value={bomType} onChange={(e) => setBomType(e.target.value)}>
                {BOM_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Version" value={version} onChange={(e) => setVersion(e.target.value)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Effective From" value={effFrom} onChange={(e) => setEffFrom(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" required label="Revision" value={revision} onChange={(e) => setRevision(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Effective To" value={effTo} onChange={(e) => setEffTo(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth size="small" required label="Status" select value={status} onChange={(e) => setStatus(e.target.value)}
                sx={status === 'Active' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } } : undefined}
              >
                {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Item Description" value={itemDesc} disabled onChange={(e) => setItemDesc(e.target.value)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                sx={{ mt: 0.5 }}
                control={<Checkbox checked={isDefaultVersion} onChange={(e) => setIsDefaultVersion(e.target.checked)} />}
                label="Is Default Version"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" select label="Item Group" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
                {ITEM_GROUPS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Tabs + component-table actions */}
      <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
        <Stack direction="row" spacing={1}>
          {TABS.map((label, idx) => (
            <Button
              key={label}
              variant={activeTab === idx ? 'contained' : 'outlined'}
              onClick={() => setActiveTab(idx)}
            >
              {label}
            </Button>
          ))}
        </Stack>
        <Stack direction="row" spacing={1.25}>
          <Button variant="outlined" startIcon={<AddIcon />}>Add Item</Button>
          <Button variant="outlined" startIcon={<UploadFileOutlinedIcon />}>Import Items</Button>
          <Button variant="outlined" color="error" startIcon={<DeleteOutlineIcon />}>Delete</Button>
        </Stack>
      </Stack>

      {activeTab === 0 && (
        <>
          {/* Component Items */}
          <Card variant="outlined" sx={{ mb: 2 }}>
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <ListAltOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={700}>Component Items</Typography>
              </Stack>

              <ScrollableTableContainer maxHeight="clamp(220px, calc(100vh - 760px), 400px)">
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox">
                        <Checkbox
                          size="small"
                          checked={checked.size === COMPONENTS.length}
                          indeterminate={checked.size > 0 && checked.size < COMPONENTS.length}
                          onChange={toggleAll}
                        />
                      </TableCell>
                      <TableCell>S.No</TableCell>
                      <TableCell>Item Code</TableCell>
                      <TableCell>Item Description</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell>UOM</TableCell>
                      <TableCell align="right">Quantity per</TableCell>
                      <TableCell align="right">Std. Cost (₹)</TableCell>
                      <TableCell align="right">Total Cost (₹)</TableCell>
                      <TableCell align="right">Scrap %</TableCell>
                      <TableCell>Issue Type</TableCell>
                      <TableCell>Remarks</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {COMPONENTS.map((c) => (
                      <TableRow key={c.no} hover selected={checked.has(c.no)}>
                        <TableCell padding="checkbox">
                          <Checkbox size="small" checked={checked.has(c.no)} onChange={() => toggleOne(c.no)} />
                        </TableCell>
                        <TableCell>{c.no}</TableCell>
                        <TableCell>
                          <TextField size="small" value={c.itemCode} InputProps={{ readOnly: true, endAdornment: <InputAdornment position="end"><SearchIcon fontSize="small" /></InputAdornment> }} sx={{ width: 130 }} />
                        </TableCell>
                        <TableCell>{c.itemDesc}</TableCell>
                        <TableCell>
                          <TextField size="small" select value={c.category} InputProps={{ readOnly: true }} sx={{ width: 130 }}>
                            {CATEGORIES.map((cat) => <MenuItem key={cat} value={cat}>{cat}</MenuItem>)}
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <TextField size="small" select value={c.uom} InputProps={{ readOnly: true }} sx={{ width: 80 }}>
                            {UOMS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                          </TextField>
                        </TableCell>
                        <TableCell align="right">
                          <TextField size="small" value={c.qtyPer.toFixed(3)} InputProps={{ readOnly: true }} sx={{ width: 90 }} />
                        </TableCell>
                        <TableCell align="right">
                          <TextField size="small" value={numberFmt(c.stdCost)} InputProps={{ readOnly: true }} sx={{ width: 100 }} />
                        </TableCell>
                        <TableCell align="right">{numberFmt(totalCost(c))}</TableCell>
                        <TableCell align="right">
                          <TextField size="small" value={c.scrapPct.toFixed(1)} InputProps={{ readOnly: true }} sx={{ width: 70 }} />
                        </TableCell>
                        <TableCell>
                          <TextField size="small" select value={c.issueType} InputProps={{ readOnly: true }} sx={{ width: 130 }}>
                            {ISSUE_TYPES.map((i) => <MenuItem key={i} value={i}>{i}</MenuItem>)}
                          </TextField>
                        </TableCell>
                        <TableCell>{c.remarks}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.25}>
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

          {/* Total Summary */}
          <Card variant="outlined">
            <CardContent>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                <FunctionsOutlinedIcon color="primary" fontSize="small" />
                <Typography variant="subtitle1" fontWeight={700}>Total Summary (Standard Cost)</Typography>
              </Stack>
              <Grid container spacing={2.5} alignItems="center">
                <Grid item xs={6} sm={3} md={2}>
                  <Typography variant="caption" color="text.secondary" display="block">Total Components</Typography>
                  <Typography variant="h6" fontWeight={700}>{totals.components}</Typography>
                </Grid>
                <Grid item xs={6} sm={3} md={2}>
                  <Typography variant="caption" color="text.secondary" display="block">Total Quantity per</Typography>
                  <Typography variant="h6" fontWeight={700}>{totals.qtyPer.toFixed(3)}</Typography>
                </Grid>
                <Grid item xs={6} sm={3} md={2.5}>
                  <Typography variant="caption" color="text.secondary" display="block">Total Material Cost (₹)</Typography>
                  <Typography variant="h6" fontWeight={700}>{numberFmt(totals.materialCost)}</Typography>
                </Grid>
                <Grid item xs={6} sm={3} md={2.5}>
                  <Typography variant="caption" color="text.secondary" display="block">Total Scrap Cost (₹)</Typography>
                  <Typography variant="h6" fontWeight={700}>{numberFmt(totals.scrapCost)}</Typography>
                </Grid>
                <Grid item xs={12} sm={12} md={3}>
                  <Box sx={{ bgcolor: 'primary.lighter', borderRadius: 2, p: 1.5, textAlign: 'center' }}>
                    <Typography variant="caption" color="text.secondary" display="block">Total Standard Cost (₹)</Typography>
                    <Typography variant="h5" fontWeight={700} color="primary.main">{numberFmt(totalStdCost)}</Typography>
                  </Box>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </>
      )}

      {activeTab === 1 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Routing (Optional)</Typography>
            <Typography variant="body2" color="text.secondary">
              No routing linked to this BOM version yet. Use Production Master &gt; Routing / Process Master to attach one.
            </Typography>
          </CardContent>
        </Card>
      )}

      {activeTab === 2 && (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>Remarks &amp; Documents</Typography>
            <TextField fullWidth multiline minRows={4} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
