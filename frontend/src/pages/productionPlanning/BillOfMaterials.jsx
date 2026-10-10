import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControlLabel, Checkbox, Autocomplete,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { productApi } from '../../features/resources';
import { bomApi } from '../../features/productionApi';
import { isDemoMode } from '../../lib/demoMode';
import { withDemoCrud } from '../../lib/demoCrud';
import { DEMO_BOMS, DEMO_PRODUCTS } from '../../lib/demoData/productionPlanning';

// Demo-mode-aware api: a pure pass-through to the real bomApi when demo mode
// is off (see ../../lib/demoMode.js) — nothing about this screen's behavior
// changes until that flag is flipped on for a client demo.
const demoAwareBomApi = withDemoCrud(bomApi, DEMO_BOMS);

// Production Planning > Bill of Materials — Phase A manufacturing
// foundation. Minimum UI to manage BOMs, per the approved Phase A scope:
// a list + a single create/edit dialog with header fields and an inline
// component-lines grid (same "editable local-state table inside a dialog"
// convention the other Production Execution create screens already use —
// see CreateRequisition.jsx's Material Items table), wired to the real
// /api/production/boms endpoints (routes/productionMasters.js) rather than
// mock data. Deliberately not an AppForm/zod form: the nested, freely
// add/remove-able lines array doesn't fit that flat-object convention, and
// no other document-with-lines screen in this app uses it either.

function emptyLine() {
  return { key: Math.random().toString(36).slice(2), componentProductCode: '', componentProductName: '', uom: '', quantityPer: '', scrapPercent: 0 };
}

function emptyHeader() {
  return { bomCode: '', productCode: '', productName: '', uom: '', version: '1.0', baseQuantity: 1, isDefault: false, status: 'Active', notes: '' };
}

export default function BillOfMaterials() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const { data: boms, isLoading } = demoAwareBomApi.useList();
  // Skips the real network call in demo mode (no backend involvement at
  // all), falling back to the fixed demo product list instead.
  const { data: realProducts } = productApi.useList(undefined, { skip: isDemoMode() });
  const products = isDemoMode() ? DEMO_PRODUCTS : realProducts;
  const [create, { isLoading: creating }] = demoAwareBomApi.useCreate();
  const [update, { isLoading: updating }] = demoAwareBomApi.useUpdate();
  const [remove] = demoAwareBomApi.useDelete();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [header, setHeader] = useState(emptyHeader());
  const [lines, setLines] = useState([emptyLine()]);

  const productOptions = products || [];

  const openCreate = () => {
    setEditingId(null);
    setHeader(emptyHeader());
    setLines([emptyLine()]);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setHeader({
      bomCode: row.bomCode, productCode: row.productCode, productName: row.productName || '',
      uom: row.uom || '', version: row.version, baseQuantity: row.baseQuantity, isDefault: row.isDefault,
      status: row.status, notes: row.notes || '',
    });
    setLines((row.lines || []).map((l) => ({
      key: String(l.id), componentProductCode: l.componentProductCode, componentProductName: l.componentProductName || '',
      uom: l.uom || '', quantityPer: l.quantityPer, scrapPercent: l.scrapPercent,
    })));
    setDialogOpen(true);
  };

  const updateLine = (key, field, value) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (key) => setLines((prev) => prev.filter((l) => l.key !== key));

  const handleSave = async () => {
    const payload = {
      ...header,
      lines: lines
        .filter((l) => l.componentProductCode)
        .map((l, idx) => ({ ...l, sequenceNo: idx + 1 })),
    };
    try {
      if (editingId) {
        await update({ id: editingId, ...payload }).unwrap();
        notify.success('BOM updated');
      } else {
        await create(payload).unwrap();
        notify.success('BOM created');
      }
      setDialogOpen(false);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not save BOM');
    }
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete BOM',
      message: `Delete BOM '${row.bomCode}'? Production orders already created from it keep their own snapshot and are unaffected.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('BOM deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<AccountTreeIcon />}
        title="Bill of Materials"
        subtitle="Define single-level BOMs — the component list a Production Order snapshots when it is created."
        rightContent={<Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Create BOM</Button>}
      />

      <Card variant="outlined">
        <CardContent>
          <ScrollableTableContainer maxHeight="clamp(300px, calc(100vh - 360px), 600px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>BOM Code</TableCell>
                  <TableCell>Product Code</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell align="right">Lines</TableCell>
                  <TableCell>Default</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}>Loading...</TableCell></TableRow>
                )}
                {!isLoading && (boms || []).length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>No BOMs created yet.</TableCell></TableRow>
                )}
                {(boms || []).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell><Typography variant="body2" fontWeight={600}>{row.bomCode}</Typography></TableCell>
                    <TableCell>{row.productCode}</TableCell>
                    <TableCell>{row.version}</TableCell>
                    <TableCell align="right">{(row.lines || []).length}</TableCell>
                    <TableCell>{row.isDefault ? <Chip size="small" label="Default" color="primary" /> : '-'}</TableCell>
                    <TableCell><Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} /></TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.25}>
                        <IconButton size="small" color="primary" onClick={() => openEdit(row)}><EditOutlinedIcon fontSize="small" /></IconButton>
                        <IconButton size="small" color="error" onClick={() => handleDelete(row)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>{editingId ? 'Edit BOM' : 'Create BOM'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="BOM Code" value={header.bomCode} onChange={(e) => setHeader((h) => ({ ...h, bomCode: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                size="small"
                options={productOptions}
                getOptionLabel={(o) => (typeof o === 'string' ? o : `${o.productCode} - ${o.productName || ''}`)}
                value={productOptions.find((p) => p.productCode === header.productCode) || null}
                isOptionEqualToValue={(o, v) => o.productCode === v.productCode}
                onChange={(e, val) => setHeader((h) => ({ ...h, productCode: val?.productCode || '', productName: val?.productName || '', uom: val?.uom || h.uom }))}
                renderInput={(params) => <TextField {...params} label="Finished Product" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" label="Version" value={header.version} onChange={(e) => setHeader((h) => ({ ...h, version: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" type="number" label="Base Quantity" value={header.baseQuantity} onChange={(e) => setHeader((h) => ({ ...h, baseQuantity: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Status" value={header.status} onChange={(e) => setHeader((h) => ({ ...h, status: e.target.value }))}>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControlLabel
                control={<Checkbox checked={header.isDefault} onChange={(e) => setHeader((h) => ({ ...h, isDefault: e.target.checked }))} />}
                label="Default BOM for this product"
              />
            </Grid>
            <Grid item xs={12} sm={9}>
              <TextField fullWidth size="small" label="Notes" value={header.notes} onChange={(e) => setHeader((h) => ({ ...h, notes: e.target.value }))} />
            </Grid>
          </Grid>

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Component Lines</Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addLine}>Add Line</Button>
          </Stack>
          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 640px), 360px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Component</TableCell>
                  <TableCell>UOM</TableCell>
                  <TableCell align="right">Qty Per</TableCell>
                  <TableCell align="right">Scrap %</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {lines.map((line) => (
                  <TableRow key={line.key}>
                    <TableCell sx={{ minWidth: 240 }}>
                      <Autocomplete
                        size="small"
                        options={productOptions}
                        getOptionLabel={(o) => (typeof o === 'string' ? o : `${o.productCode} - ${o.productName || ''}`)}
                        value={productOptions.find((p) => p.productCode === line.componentProductCode) || null}
                        isOptionEqualToValue={(o, v) => o.productCode === v.productCode}
                        onChange={(e, val) => {
                          updateLine(line.key, 'componentProductCode', val?.productCode || '');
                          updateLine(line.key, 'componentProductName', val?.productName || '');
                          updateLine(line.key, 'uom', val?.uom || line.uom);
                        }}
                        renderInput={(params) => <TextField {...params} variant="standard" placeholder="Select component" />}
                      />
                    </TableCell>
                    <TableCell>{line.uom || '-'}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={line.quantityPer}
                        onChange={(e) => updateLine(line.key, 'quantityPer', e.target.value)}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 90 }}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={line.scrapPercent}
                        onChange={(e) => updateLine(line.key, 'scrapPercent', e.target.value)}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 80 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" color="error" onClick={() => removeLine(line.key)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollableTableContainer>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={creating || updating}>Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
