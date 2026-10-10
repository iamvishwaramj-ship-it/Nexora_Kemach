import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, InputAdornment, Checkbox, Chip,
} from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import LibraryAddOutlinedIcon from '@mui/icons-material/LibraryAddOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useNotify } from '../../components/feedback/NotificationProvider';

// ---------------------------------------------------------------------------
// Static, UI-only mock of the "Alternate BOM" screen, built to match the
// reference screenshot the user supplied. Reachable from the Production
// Master menu. Same convention as the rest of pages/productionMaster/:
// fixed mock data only -- nothing persists or calls the server; Save /
// Save & New / Submit only toast + (for Submit) navigate back to the list.
// ---------------------------------------------------------------------------

const ITEM_GROUPS = ['Finished Goods', 'Semi-Finished Goods', 'Raw Material'];
const BOM_TYPES = ['Manufacturing', 'Engineering', 'Sales'];
const STATUS_OPTIONS = ['Active', 'Inactive'];
const DETAIL_TABS = ['1. BOM Header', '2. Components (Material)', '3. Operations (Routing)', '4. Documents'];

const ALT_BOM_ROWS = [
  { no: 1, code: 'BOM-001', name: 'Gear Housing - Standard', version: 'V1', altNo: 0, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', isDefault: true, status: 'Active', remarks: 'Standard BOM' },
  { no: 2, code: 'BOM-001A', name: 'Gear Housing - Alternate 1', version: 'V1', altNo: 1, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', isDefault: false, status: 'Active', remarks: 'Cast Iron Material' },
  { no: 3, code: 'BOM-001B', name: 'Gear Housing - Alternate 2', version: 'V1', altNo: 2, effFrom: '01-Oct-2026', effTo: '31-Dec-2099', isDefault: false, status: 'Active', remarks: 'Low Cost Alternative' },
];

export default function AlternateBom() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [itemCode, setItemCode] = useState('FG-001');
  const [itemName, setItemName] = useState('Gear Housing');
  const [itemGroup, setItemGroup] = useState('Finished Goods');
  const [baseUom, setBaseUom] = useState('Nos');
  const [baseQty, setBaseQty] = useState('1.00');
  const [bomType, setBomType] = useState('Manufacturing');
  const [bomVersion, setBomVersion] = useState('V1');
  const [defaultBom, setDefaultBom] = useState(false);
  const [status, setStatus] = useState('Active');
  const [remarks, setRemarks] = useState('Alternate BOM for material availability and cost optimization.');

  const [checked, setChecked] = useState(() => new Set());
  const toggleAll = () => {
    setChecked((prev) => (prev.size === ALT_BOM_ROWS.length ? new Set() : new Set(ALT_BOM_ROWS.map((r) => r.no))));
  };
  const toggleOne = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const [activeTab, setActiveTab] = useState(0);
  const [altBomCode, setAltBomCode] = useState('BOM-001A');
  const [altBomName, setAltBomName] = useState('Gear Housing - Alternate 1');
  const [altNo, setAltNo] = useState('1');
  const [altVersion, setAltVersion] = useState('V1');
  const [altEffFrom, setAltEffFrom] = useState('01-Oct-2026');
  const [altEffTo, setAltEffTo] = useState('31-Dec-2099');
  const [altStatus, setAltStatus] = useState('Active');
  const [altRemarks, setAltRemarks] = useState('Cast Iron material alternative BOM.');

  const handleBackToList = () => navigate('/production-master/bom');
  const handleSave = () => notify.success('Alternate BOM saved.');
  const handleSaveAndNew = () => notify.success('Alternate BOM saved. Ready for a new entry.');
  const handleSubmit = () => {
    notify.success('Alternate BOM submitted.');
    navigate('/production-master/bom');
  };



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
        icon={<Inventory2OutlinedIcon />}
        title="Alternate BOM"
        subtitle="Create and manage alternate BOM for an item."
        rightContent={headerActions}
      />

      {/* Item Information */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
            <Inventory2OutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Item Information</Typography>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth size="small" required label="Item Code" value={itemCode} onChange={(e) => setItemCode(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField fullWidth size="small" label="Item Name" value={itemName} onChange={(e) => setItemName(e.target.value)} InputProps={{ readOnly: true }} />
                <TextField fullWidth size="small" select label="Item Group" value={itemGroup} onChange={(e) => setItemGroup(e.target.value)}>
                  {ITEM_GROUPS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" label="Base UOM" value={baseUom} onChange={(e) => setBaseUom(e.target.value)} InputProps={{ readOnly: true }} />
                <TextField fullWidth size="small" label="Base Quantity" value={baseQty} onChange={(e) => setBaseQty(e.target.value)} />
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                <TextField fullWidth size="small" select label="BOM Type" value={bomType} onChange={(e) => setBomType(e.target.value)}>
                  {BOM_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
                <TextField
                  fullWidth size="small" required label="BOM Version" value={bomVersion} onChange={(e) => setBomVersion(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <Stack direction="row" spacing={1} alignItems="center">
                  <Checkbox checked={defaultBom} onChange={(e) => setDefaultBom(e.target.checked)} />
                  <Typography variant="body2">Default BOM</Typography>
                </Stack>
                <TextField
                  fullWidth size="small" select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}
                  sx={status === 'Active' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } } : undefined}
                >
                  {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                </TextField>
                <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </Stack>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Alternate BOM List */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ListAltOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>Alternate BOM List ({ALT_BOM_ROWS.length} records)</Typography>
            </Stack>
            <TextField size="small" select label="Records per page" value="10" sx={{ width: 160 }}>
              <MenuItem value="10">10</MenuItem>
              <MenuItem value="25">25</MenuItem>
              <MenuItem value="50">50</MenuItem>
            </TextField>
          </Stack>
          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 720px), 400px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      size="small"
                      checked={checked.size === ALT_BOM_ROWS.length}
                      indeterminate={checked.size > 0 && checked.size < ALT_BOM_ROWS.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>BOM Code</TableCell>
                  <TableCell>BOM Name</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell align="right">Alternate No.</TableCell>
                  <TableCell>Effective From</TableCell>
                  <TableCell>Effective To</TableCell>
                  <TableCell align="center">Default</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Remarks</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ALT_BOM_ROWS.map((r) => (
                  <TableRow key={r.no} hover selected={checked.has(r.no)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(r.no)} onChange={() => toggleOne(r.no)} />
                    </TableCell>
                    <TableCell>{r.no}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary.main" fontWeight={600}>{r.code}</Typography>
                    </TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.version}</TableCell>
                    <TableCell align="right">{r.altNo}</TableCell>
                    <TableCell>{r.effFrom}</TableCell>
                    <TableCell>{r.effTo}</TableCell>
                    <TableCell align="center">
                      {r.isDefault
                        ? <RadioButtonCheckedIcon fontSize="small" color="primary" />
                        : <RadioButtonUncheckedIcon fontSize="small" color="disabled" />}
                    </TableCell>
                    <TableCell>
                      <Chip size="small" label={r.status} color={r.status === 'Active' ? 'success' : 'error'} />
                    </TableCell>
                    <TableCell>{r.remarks}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.25}>
                        <IconButton size="small" color="primary"><VisibilityOutlinedIcon fontSize="small" /></IconButton>
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

      {/* Alternate BOM Details */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <AccountTreeOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Alternate BOM Details</Typography>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }}>
            {DETAIL_TABS.map((label, idx) => (
              <Button
                key={label}
                variant={activeTab === idx ? 'contained' : 'outlined'}
                onClick={() => setActiveTab(idx)}
              >
                {label}
              </Button>
            ))}
          </Stack>

          {activeTab === 0 ? (
            <Grid container spacing={2.5}>
              <Grid item xs={12} md={6}>
                <Stack spacing={2.5}>
                  <TextField fullWidth size="small" required label="Alternate BOM Code" value={altBomCode} onChange={(e) => setAltBomCode(e.target.value)} />
                  <TextField fullWidth size="small" required label="Alternate BOM Name" value={altBomName} onChange={(e) => setAltBomName(e.target.value)} />
                  <TextField fullWidth size="small" required label="Alternate No." value={altNo} onChange={(e) => setAltNo(e.target.value)} />
                  <TextField fullWidth size="small" label="Version" value={altVersion} onChange={(e) => setAltVersion(e.target.value)} InputProps={{ readOnly: true }} />
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack spacing={2.5}>
                  <TextField
                    fullWidth size="small" required label="Effective From" value={altEffFrom} onChange={(e) => setAltEffFrom(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                  <TextField
                    fullWidth size="small" required label="Effective To" value={altEffTo} onChange={(e) => setAltEffTo(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                  <TextField
                    fullWidth size="small" required select label="Status" value={altStatus} onChange={(e) => setAltStatus(e.target.value)}
                    sx={altStatus === 'Active' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } } : undefined}
                  >
                    {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
                  <TextField fullWidth size="small" multiline minRows={2} label="Remarks" value={altRemarks} onChange={(e) => setAltRemarks(e.target.value)} />
                </Stack>
              </Grid>
            </Grid>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No {DETAIL_TABS[activeTab].replace(/^\d+\.\s*/, '').toLowerCase()} added yet.
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
