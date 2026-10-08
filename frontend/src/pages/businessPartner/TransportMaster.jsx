import React, { useEffect, useMemo, useRef, useState } from 'react';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Grid, Divider,
  Collapse,
} from '@mui/material';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import FormTimePicker from '../../components/form/FormTimePicker';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import {
  transportSchema, SERVICE_TYPE_OPTIONS, TRANSPORT_TYPE_OPTIONS,
  FREIGHT_PAYMENT_TERMS_OPTIONS, VEHICLE_TYPE_OPTIONS,
} from '../../lib/validation/partnerSchemas';
import { transportApi, houseBankApi } from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import DocumentNoField from '../../components/form/DocumentNoField';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
const emptyValues = {
  transporterCode: '', transporterName: '', status: 'Active', contactPerson: '',
  phone: '', alternatePhone: '', email: '', website: '', gstin: '', panNo: '', address: '',
  serviceType: '', transportType: '', freightPaymentTerms: '', deliveryRegions: '',
  minimumFreight: 0, freightPerKm: 0, loadingTime: '', unloadingTime: '',
  vehicleCapacity: '', vehicleType: '', noOfVehicles: 0, insuranceValidUpto: null,
  bankName: '', accountNumber: '', ifscCode: '', accountHolderName: '', notes: '',
};

const PAGE_SIZE = 10;

const TRANSPORT_LIST_TABLE_ROW_HEIGHT = 0;
const TRANSPORT_LIST_TABLE_CELL_PADDING_Y = 6;
export default function TransportMaster() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: transporters, isLoading } = transportApi.useList();
  const { data: houseBanks } = houseBankApi.useList();
  const [create, { isLoading: creating }] = transportApi.useCreate();
  const [update, { isLoading: updating }] = transportApi.useUpdate();
  const [remove] = transportApi.useDelete();

  const houseBankRows = houseBanks || [];
  const bankNameOptions = houseBankRows.map((b) => ({
    label: b.accountNumber ? `${b.bankName} — ${b.accountNumber}` : b.bankName,
    value: b.bankName,
  }));

  // Form is hidden by default -- it expands in a Collapse ABOVE the list
  // (which stays visible) when "Add Transporter" or an edit action is
  // triggered, per the inline form template (Payment Entry/Deposit Entry),
  // instead of swapping the whole page out for a separate form view.
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);

  const rows = transporters || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.transporterCode, r.transporterName, r.phone, r.email].some((v) => String(v || '').toLowerCase().includes(q));
      return matchesSearch;
    });
  }, [rows]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'transporterCode', headerName: 'Transporter Code', filter: 'text' },
    { field: 'transporterName', headerName: 'Transporter Name', filter: 'text' },
    { field: 'serviceType', headerName: 'Service Type', filter: 'text' },
    { field: 'vehicleType', headerName: 'Vehicle Type', filter: 'text' },
    { field: 'phone', headerName: 'Phone', filter: 'text' },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(baseTableRows, tableColumns, { onChange: setPage });
  const filteredRows = table.rows;

  const pagedRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize]
  );

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
  };

  // Read-only look at a record — same form, every field disabled
  // and the save button removed (see AppForm's readOnly prop).
  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete transporter',
      message: `Are you sure you want to delete "${row.transporterName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Transporter deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Transporter updated');
      } else {
        await create(values).unwrap();
        notify.success('Transporter added');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<LocalShippingOutlinedIcon />}
        title="Transport Master"
        subtitle={showForm ? 'Create a new transporter.' : 'Manage and track your transporters.'}
        rightContent={<CompanyBadge />}
      />

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2 }}>
        <AppForm readOnly={readOnly}
          key={formKey}
          schema={transportSchema}
          defaultValues={editingRow ? { ...emptyValues, ...editingRow } : emptyValues}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            // Auto-fill Account Number / IFSC Code from the selected house
            // bank (still editable), without stomping on values the user
            // already entered when the bank hasn't changed. If more than one
            // house bank account shares the same bank name, the first match
            // is used since `bankName` is a plain string field here.
            const bankNameValue = methods.watch('bankName');
            const prevBankName = useRef(editingRow ? editingRow.bankName : null);
            useEffect(() => {
              if (bankNameValue !== prevBankName.current) {
                const found = houseBankRows.find((b) => b.bankName === bankNameValue);
                if (found) {
                  methods.setValue('accountNumber', found.accountNumber || '', { shouldValidate: true });
                  methods.setValue('ifscCode', found.ifscCode || '', { shouldValidate: true });
                }
                prevBankName.current = bankNameValue;
              }
              // eslint-disable-next-line react-hooks/exhaustive-deps
            }, [bankNameValue]);

            return (
            <>
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent sx={{ p: 3 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                    <Typography variant="subtitle1" fontWeight={700}>Transporter Information</Typography>
                    <Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                      Close
                    </Button>
                  </Stack>

                  <FormGrid columns={4}>
                    {/* Auto-generated from the perpetual TRN numbering series (hidden from
                        the Document Numbering page — see hiddenFromNumberingUI in
                        documentNumberService.js). The field is filled and locked on
                        create, and left untouched on edit so an existing record's code
                        is never rewritten. */}
                    <DocumentNoField documentCode="TRN" name="transporterCode" label="Transporter Code *" isCreate={!editingRow} />
                    <FormTextField name="transporterName" label="Transporter Name *" placeholder="Enter transporter name" />
                    <FormTextField name="contactPerson" label="Contact Person" placeholder="Enter contact person" />
                    

                    <FormTextField name="phone" label="Phone No." placeholder="Enter phone number" digitsOnly maxLength={10} />
                    <FormTextField name="alternatePhone" label="Alternate Phone No." placeholder="Enter alternate phone" digitsOnly maxLength={10} />
                    <FormTextField name="email" label="Email" placeholder="Enter email address" />
                    <FormTextField name="website" label="Website" placeholder="Enter website" />
                    <FormTextField name="gstin" label="GSTIN" placeholder="Enter GSTIN" maxLength={15} inputProps={{ style: { textTransform: 'uppercase' } }} />
                  </FormGrid>

                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormTextField name="panNo" label="PAN No." placeholder="Enter PAN number" maxLength={10} inputProps={{ style: { textTransform: 'uppercase' } }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <FormTextField name="address" label="Address *" placeholder="Enter address" multiline rows={3} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <FormSelect
                        name="status"
                        label="Status *"
                        options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    Vehicle &amp; Operations Information
                  </Typography>

                  <FormGrid columns={4}>
                    <FormSelect name="serviceType" label="Service Type" placeholder="Select service type" options={SERVICE_TYPE_OPTIONS} />
                    <FormSelect name="transportType" label="Transport Type" placeholder="Select transport type" options={TRANSPORT_TYPE_OPTIONS} />
                    <FormSelect name="freightPaymentTerms" label="Freight Payment Terms" placeholder="Select payment terms" options={FREIGHT_PAYMENT_TERMS_OPTIONS} />
                    <FormTextField name="deliveryRegions" label="Delivery Regions" placeholder="e.g. Karnataka, Tamil Nadu" />

                    <FormTextField name="minimumFreight" label="Minimum Freight (₹)" type="number" placeholder="0.00" />
                    <FormTextField name="freightPerKm" label="Freight Per Km (₹)" type="number" placeholder="0.00" />
                    <FormTimePicker name="loadingTime" label="Loading Time" />
                    <FormTimePicker name="unloadingTime" label="Unloading Time" />

                    <FormTextField name="vehicleCapacity" label="Vehicle Capacity" placeholder="e.g. 20 Ton" />
                    <FormSelect name="vehicleType" label="Vehicle Type" placeholder="Select vehicle type" options={VEHICLE_TYPE_OPTIONS} />
                    <FormTextField name="noOfVehicles" label="No. of Vehicles" type="number" placeholder="0" />
                    <FormDatePicker name="insuranceValidUpto" label="Insurance Valid Upto" />
                  </FormGrid>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>
                    Banking Information
                  </Typography>

                  <FormGrid columns={4}>
                    <FormSelect name="bankName" label="Bank Name" placeholder="Select house bank" options={bankNameOptions} />
                    <FormTextField name="accountNumber" label="Account Number" placeholder="Auto-filled from house bank" disabled />
                    <FormTextField name="ifscCode" label="IFSC Code" placeholder="Auto-filled from house bank" disabled />
                    <FormTextField name="accountHolderName" label="Account Holder Name" placeholder="Enter account holder name" />
                  </FormGrid>

                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid item xs={12}>
                      <FormTextField name="notes" label="Notes" placeholder="Enter notes (optional)" multiline rows={3} />
                    </Grid>
                  </Grid>

                  <Divider sx={{ my: 3 }} />

                  <Stack direction="row" spacing={1.5} justifyContent="flex-end">
                    <Button variant="outlined" color={readOnly ? 'error' : 'inherit'} startIcon={<CloseIcon />} onClick={closeForm} disabled={creating || updating}>
                      {readOnly ? 'Close' : 'Cancel'}
                    </Button>
                    <FormSubmitButton startIcon={<SaveIcon />} disabled={creating || updating}>
                      {readOnly ? 'View' : editingRow ? 'Update Transporter' : 'Save Transporter'}
                    </FormSubmitButton>
                  </Stack>
                </CardContent>
              </Card>
            </>
            );
          }}
        </AppForm>
        </Box>
      </Collapse>

      <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Transporter List</Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <TableSearchFilter table={table} placeholder="Search by code, name, phone or email..." width={260} />
                <CanAdd>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    Add Transporter
                  </Button>
                </CanAdd>
              </Stack>

              <TableFilterPanel table={table} />
            </Stack>

            {isMobile ? (
              <Box sx={{ px: 2, pb: 1 }}>
                {!isLoading && pagedRows.map((row) => (
                  <MobileRecordCard
                    key={row.id}
                    title={row.transporterName}
                    statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Transporter Code', value: row.transporterCode },
                      { label: 'Service Type', value: row.serviceType || '—' },
                      { label: 'Vehicle Type', value: row.vehicleType || '—' },
                      { label: 'Phone', value: row.phone || '—' },
                    ]}
                    onView={() => handleView(row)}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<PeopleOutlineIcon sx={{ fontSize: 48 }} />} title="No transporters found" message="Add your first transporter to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: TRANSPORT_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${TRANSPORT_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${TRANSPORT_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell width={48}>#</TableCell>
                      <SortableHeaderCell field="transporterCode" sort={table.sort} onSort={table.toggleSort}>Transporter Code</SortableHeaderCell>
                      <SortableHeaderCell field="transporterName" sort={table.sort} onSort={table.toggleSort}>Transporter Name</SortableHeaderCell>
                      <SortableHeaderCell field="serviceType" sort={table.sort} onSort={table.toggleSort}>Service Type</SortableHeaderCell>
                      <SortableHeaderCell field="vehicleType" sort={table.sort} onSort={table.toggleSort}>Vehicle Type</SortableHeaderCell>
                      <SortableHeaderCell field="phone" sort={table.sort} onSort={table.toggleSort}>Phone</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoading && pagedRows.map((row, i) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{page * pageSize + i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.transporterCode}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.transporterName}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.serviceType || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.vehicleType || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.phone || '—'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                            <CanEdit>
                              <IconButton size="small" color="primary" onClick={() => handleEdit(row)} aria-label="edit">
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </CanEdit>
                            <CanDelete>
                              <IconButton size="small" color="error" onClick={() => handleDelete(row)} aria-label="delete">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </CanDelete>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8}>
                          <EmptyState icon={<PeopleOutlineIcon sx={{ fontSize: 48 }} />} title="No transporters found" message="Add your first transporter to get started" />
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollableTableContainer>
            )}

            <EntityListPagination total={filteredRows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
          </CardContent>
        </Card>
    </Box>
  );
}
