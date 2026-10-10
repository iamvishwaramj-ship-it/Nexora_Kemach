import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, InputAdornment, Checkbox, Chip,
} from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import ListAltOutlinedIcon from '@mui/icons-material/ListAltOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
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
// Static, UI-only mock of the "Alternate Routing" screen, built to match the
// reference screenshot the user supplied. Reachable from the Production
// Master menu. Same convention as the rest of pages/productionMaster/:
// fixed mock data only -- nothing persists or calls the server; Save /
// Save & New / Submit only toast + (for Submit) navigate back to the list.
// ---------------------------------------------------------------------------

const ITEM_GROUPS = ['Finished Goods', 'Semi-Finished Goods', 'Raw Material'];
const ROUTING_TYPES = ['Manufacturing', 'Engineering', 'Sales'];
const STATUS_OPTIONS = ['Active', 'Inactive'];
const DETAIL_TABS = ['1. Routing Header', '2. Operations', '3. Tools & Fixtures', '4. Documents'];

const ALT_ROUTING_ROWS = [
  { no: 1, code: 'ROUT-001', name: 'Gear Housing - Standard', itemCode: 'FG-001', itemName: 'Gear Housing', version: 'V1', baseRouting: '-', effFrom: '01-Jan-2025', effTo: '31-Dec-2099', status: 'Active' },
  { no: 2, code: 'ROUT-001A', name: 'Gear Housing - Alternate 1', itemCode: 'FG-001', itemName: 'Gear Housing', version: 'V1', baseRouting: 'ROUT-001', effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Active' },
  { no: 3, code: 'ROUT-001B', name: 'Gear Housing - Alternate 2', itemCode: 'FG-001', itemName: 'Gear Housing', version: 'V1', baseRouting: 'ROUT-001', effFrom: '01-Oct-2026', effTo: '31-Dec-2099', status: 'Inactive' },
];

export default function AlternateRouting() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [itemCode, setItemCode] = useState('FG-001');
  const [itemName, setItemName] = useState('Gear Housing');
  const [itemGroup, setItemGroup] = useState('Finished Goods');
  const [routingType, setRoutingType] = useState('Manufacturing');
  const [baseRouting, setBaseRouting] = useState('ROUT-001');
  const [baseRoutingName, setBaseRoutingName] = useState('Gear Housing - Standard');

  const [altRoutingCode, setAltRoutingCode] = useState('ROUT-001A');
  const [altRoutingName, setAltRoutingName] = useState('Gear Housing - Alternate 1');
  const [version, setVersion] = useState('V1');
  const [effFrom, setEffFrom] = useState('01-Oct-2026');
  const [effTo, setEffTo] = useState('31-Dec-2099');
  const [status, setStatus] = useState('Active');
  const [remarks, setRemarks] = useState('Alternate routing for cast iron material.');

  const [checked, setChecked] = useState(() => new Set());
  const toggleAll = () => {
    setChecked((prev) => (prev.size === ALT_ROUTING_ROWS.length ? new Set() : new Set(ALT_ROUTING_ROWS.map((r) => r.no))));
  };
  const toggleOne = (no) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(no)) next.delete(no); else next.add(no);
      return next;
    });
  };

  const [activeTab, setActiveTab] = useState(0);
  const [detAltRoutingCode, setDetAltRoutingCode] = useState('ROUT-001A');
  const [detAltRoutingName, setDetAltRoutingName] = useState('Gear Housing - Alternate 1');
  const [detVersion, setDetVersion] = useState('V1');
  const [detBaseRouting, setDetBaseRouting] = useState('ROUT-001');
  const [detEffFrom, setDetEffFrom] = useState('01-Oct-2026');
  const [detEffTo, setDetEffTo] = useState('31-Dec-2099');
  const [detStatus, setDetStatus] = useState('Active');

  const handleBackToList = () => navigate('/production-master/routing');
  const handleSave = () => notify.success('Alternate Routing saved.');
  const handleSaveAndNew = () => notify.success('Alternate Routing saved. Ready for a new entry.');
  const handleSubmit = () => {
    notify.success('Alternate Routing submitted.');
    navigate('/production-master/routing');
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
        title="Alternate Routing"
        subtitle="Create and manage alternate routing for an item."
        rightContent={headerActions}
      />

      {/* Item & Routing Information */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5 }}>
            <AccountTreeOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Item &amp; Routing Information</Typography>
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
                <TextField fullWidth size="small" select label="Routing Type" value={routingType} onChange={(e) => setRoutingType(e.target.value)}>
                  {ROUTING_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </TextField>
                <TextField
                  fullWidth size="small" label="Base Routing" value={baseRouting} onChange={(e) => setBaseRouting(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField fullWidth size="small" label="Base Routing Name" value={baseRoutingName} onChange={(e) => setBaseRoutingName(e.target.value)} InputProps={{ readOnly: true }} />
              </Stack>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack spacing={2.5}>
                <TextField fullWidth size="small" required label="Alternate Routing Code" value={altRoutingCode} onChange={(e) => setAltRoutingCode(e.target.value)} />
                <TextField fullWidth size="small" required label="Alternate Routing Name" value={altRoutingName} onChange={(e) => setAltRoutingName(e.target.value)} />
                <TextField fullWidth size="small" label="Version" value={version} onChange={(e) => setVersion(e.target.value)} InputProps={{ readOnly: true }} />
                <TextField
                  fullWidth size="small" required label="Effective From" value={effFrom} onChange={(e) => setEffFrom(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField
                  fullWidth size="small" label="Effective To" value={effTo} onChange={(e) => setEffTo(e.target.value)}
                  InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                />
                <TextField
                  fullWidth size="small" required select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}
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

      {/* Alternate Routing List */}
      <Card variant="outlined" sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction="row" justifyContent="space-between" alignItems="center" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <ListAltOutlinedIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={700}>Alternate Routing List ({ALT_ROUTING_ROWS.length} records)</Typography>
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
                      checked={checked.size === ALT_ROUTING_ROWS.length}
                      indeterminate={checked.size > 0 && checked.size < ALT_ROUTING_ROWS.length}
                      onChange={toggleAll}
                    />
                  </TableCell>
                  <TableCell>S.No</TableCell>
                  <TableCell>Routing Code</TableCell>
                  <TableCell>Routing Name</TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Item Name</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Base Routing</TableCell>
                  <TableCell>Effective From</TableCell>
                  <TableCell>Effective To</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {ALT_ROUTING_ROWS.map((r) => (
                  <TableRow key={r.no} hover selected={checked.has(r.no)}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={checked.has(r.no)} onChange={() => toggleOne(r.no)} />
                    </TableCell>
                    <TableCell>{r.no}</TableCell>
                    <TableCell>
                      <Typography variant="body2" color="primary.main" fontWeight={600}>{r.code}</Typography>
                    </TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.itemCode}</TableCell>
                    <TableCell>{r.itemName}</TableCell>
                    <TableCell>{r.version}</TableCell>
                    <TableCell>{r.baseRouting}</TableCell>
                    <TableCell>{r.effFrom}</TableCell>
                    <TableCell>{r.effTo}</TableCell>
                    <TableCell>
                      <Chip size="small" label={r.status} color={r.status === 'Active' ? 'success' : 'error'} />
                    </TableCell>
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

      {/* Alternate Routing Details */}
      <Card variant="outlined">
        <CardContent>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <SettingsOutlinedIcon color="primary" fontSize="small" />
            <Typography variant="subtitle1" fontWeight={700}>Alternate Routing Details</Typography>
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
                  <TextField fullWidth size="small" required label="Alternate Routing Code" value={detAltRoutingCode} onChange={(e) => setDetAltRoutingCode(e.target.value)} />
                  <TextField fullWidth size="small" required label="Alternate Routing Name" value={detAltRoutingName} onChange={(e) => setDetAltRoutingName(e.target.value)} />
                  <TextField fullWidth size="small" label="Version" value={detVersion} onChange={(e) => setDetVersion(e.target.value)} InputProps={{ readOnly: true }} />
                </Stack>
              </Grid>
              <Grid item xs={12} md={6}>
                <Stack spacing={2.5}>
                  <TextField
                    fullWidth size="small" label="Base Routing" value={detBaseRouting} onChange={(e) => setDetBaseRouting(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><SearchIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                  <TextField
                    fullWidth size="small" required label="Effective From" value={detEffFrom} onChange={(e) => setDetEffFrom(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                  <TextField
                    fullWidth size="small" label="Effective To" value={detEffTo} onChange={(e) => setDetEffTo(e.target.value)}
                    InputProps={{ endAdornment: <InputAdornment position="end"><IconButton size="small" edge="end"><EventOutlinedIcon fontSize="small" /></IconButton></InputAdornment> }}
                  />
                  <TextField
                    fullWidth size="small" required select label="Status" value={detStatus} onChange={(e) => setDetStatus(e.target.value)}
                    sx={detStatus === 'Active' ? { '& .MuiOutlinedInput-root': { bgcolor: 'success.lighter' } } : undefined}
                  >
                    {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                  </TextField>
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
