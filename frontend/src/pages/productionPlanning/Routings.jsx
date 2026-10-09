import React, { useState } from 'react';
import {
  Box, Card, CardContent, Stack, Typography, Grid, TextField, MenuItem, Button, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, IconButton, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControlLabel, Checkbox, Autocomplete,
} from '@mui/material';
import TimelineIcon from '@mui/icons-material/Timeline';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { productApi } from '../../features/resources';
import { routingApi, workCenterApi } from '../../features/productionApi';

// Production Planning > Routing — Phase A manufacturing foundation. Same
// minimum-UI convention as BillOfMaterials.jsx: a list + a single
// create/edit dialog with header fields and an inline operations grid,
// wired to /api/production/routings (routes/productionMasters.js).

function emptyOperation() {
  return { key: Math.random().toString(36).slice(2), operationNo: '', operationName: '', workCenterCode: '', standardTimeMins: '' };
}

function emptyHeader() {
  return { routingCode: '', productCode: '', version: '1.0', isDefault: false, status: 'Active' };
}

export default function Routings() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const { data: routings, isLoading } = routingApi.useList();
  const { data: products } = productApi.useList();
  const { data: workCenters } = workCenterApi.useList();
  const [create, { isLoading: creating }] = routingApi.useCreate();
  const [update, { isLoading: updating }] = routingApi.useUpdate();
  const [remove] = routingApi.useDelete();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [header, setHeader] = useState(emptyHeader());
  const [operations, setOperations] = useState([emptyOperation()]);

  const productOptions = products || [];
  const workCenterOptions = workCenters || [];

  const openCreate = () => {
    setEditingId(null);
    setHeader(emptyHeader());
    setOperations([{ ...emptyOperation(), operationNo: 10 }]);
    setDialogOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setHeader({ routingCode: row.routingCode, productCode: row.productCode, version: row.version, isDefault: row.isDefault, status: row.status });
    setOperations((row.operations || []).map((op) => ({
      key: String(op.id), operationNo: op.operationNo, operationName: op.operationName,
      workCenterCode: op.workCenterCode || '', standardTimeMins: op.standardTimeMins ?? '',
    })));
    setDialogOpen(true);
  };

  const updateOperation = (key, field, value) => {
    setOperations((prev) => prev.map((op) => (op.key === key ? { ...op, [field]: value } : op)));
  };

  const addOperation = () => setOperations((prev) => [
    ...prev,
    { ...emptyOperation(), operationNo: (Number(prev[prev.length - 1]?.operationNo) || 0) + 10 },
  ]);
  const removeOperation = (key) => setOperations((prev) => prev.filter((op) => op.key !== key));

  const handleSave = async () => {
    const payload = {
      ...header,
      operations: operations
        .filter((op) => op.operationName)
        .map((op, idx) => ({ ...op, sequenceNo: idx + 1 })),
    };
    try {
      if (editingId) {
        await update({ id: editingId, ...payload }).unwrap();
        notify.success('Routing updated');
      } else {
        await create(payload).unwrap();
        notify.success('Routing created');
      }
      setDialogOpen(false);
    } catch (err) {
      notify.error(err?.data?.message || 'Could not save routing');
    }
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete routing',
      message: `Delete routing '${row.routingCode}'? Production orders already created from it keep their own snapshot and are unaffected.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Routing deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<TimelineIcon />}
        title="Routing"
        subtitle="Define the operation sequence and work centers a Production Order snapshots when it is created."
        rightContent={<Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Create Routing</Button>}
      />

      <Card variant="outlined">
        <CardContent>
          <ScrollableTableContainer maxHeight="clamp(300px, calc(100vh - 360px), 600px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Routing Code</TableCell>
                  <TableCell>Product Code</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell align="right">Operations</TableCell>
                  <TableCell>Default</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isLoading && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}>Loading...</TableCell></TableRow>
                )}
                {!isLoading && (routings || []).length === 0 && (
                  <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>No routings created yet.</TableCell></TableRow>
                )}
                {(routings || []).map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell><Typography variant="body2" fontWeight={600}>{row.routingCode}</Typography></TableCell>
                    <TableCell>{row.productCode}</TableCell>
                    <TableCell>{row.version}</TableCell>
                    <TableCell align="right">{(row.operations || []).length}</TableCell>
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
        <DialogTitle>{editingId ? 'Edit Routing' : 'Create Routing'}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField fullWidth size="small" label="Routing Code" value={header.routingCode} onChange={(e) => setHeader((h) => ({ ...h, routingCode: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Autocomplete
                size="small"
                options={productOptions}
                getOptionLabel={(o) => (typeof o === 'string' ? o : `${o.productCode} - ${o.productName || ''}`)}
                value={productOptions.find((p) => p.productCode === header.productCode) || null}
                isOptionEqualToValue={(o, v) => o.productCode === v.productCode}
                onChange={(e, val) => setHeader((h) => ({ ...h, productCode: val?.productCode || '' }))}
                renderInput={(params) => <TextField {...params} label="Finished Product" />}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" label="Version" value={header.version} onChange={(e) => setHeader((h) => ({ ...h, version: e.target.value }))} />
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <TextField fullWidth size="small" select label="Status" value={header.status} onChange={(e) => setHeader((h) => ({ ...h, status: e.target.value }))}>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControlLabel
                control={<Checkbox checked={header.isDefault} onChange={(e) => setHeader((h) => ({ ...h, isDefault: e.target.checked }))} />}
                label="Default for this product"
              />
            </Grid>
          </Grid>

          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Operations</Typography>
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={addOperation}>Add Operation</Button>
          </Stack>
          <ScrollableTableContainer maxHeight="clamp(200px, calc(100vh - 640px), 360px)">
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Op. No.</TableCell>
                  <TableCell>Operation Name</TableCell>
                  <TableCell>Work Center</TableCell>
                  <TableCell align="right">Std. Time (min)</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {operations.map((op) => (
                  <TableRow key={op.key}>
                    <TableCell sx={{ width: 90 }}>
                      <TextField
                        size="small" variant="standard" type="number" value={op.operationNo}
                        onChange={(e) => updateOperation(op.key, 'operationNo', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <TextField
                        size="small" variant="standard" value={op.operationName} placeholder="e.g. Machining"
                        onChange={(e) => updateOperation(op.key, 'operationName', e.target.value)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 200 }}>
                      <Autocomplete
                        size="small"
                        options={workCenterOptions}
                        getOptionLabel={(o) => (typeof o === 'string' ? o : `${o.workCenterCode} - ${o.name}`)}
                        value={workCenterOptions.find((w) => w.workCenterCode === op.workCenterCode) || null}
                        isOptionEqualToValue={(o, v) => o.workCenterCode === v.workCenterCode}
                        onChange={(e, val) => updateOperation(op.key, 'workCenterCode', val?.workCenterCode || '')}
                        renderInput={(params) => <TextField {...params} variant="standard" placeholder="Select work center" />}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small" variant="standard" type="number" value={op.standardTimeMins}
                        onChange={(e) => updateOperation(op.key, 'standardTimeMins', e.target.value)}
                        inputProps={{ style: { textAlign: 'right' } }} sx={{ width: 90 }}
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton size="small" color="error" onClick={() => removeOperation(op.key)}><DeleteOutlineIcon fontSize="small" /></IconButton>
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
