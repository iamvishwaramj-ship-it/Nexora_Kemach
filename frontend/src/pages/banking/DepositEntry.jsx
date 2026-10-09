import React, { useMemo, useState } from 'react';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem, ListItemIcon,
  ListItemText, Autocomplete, Grid, Collapse,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import dayjs from 'dayjs';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import MobileItemCard from '../../components/data-display/MobileItemCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { bankDepositSchema } from '../../lib/validation/bankingSchemas';
import { bankDepositApi, houseBankApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
const DEPOSIT_TYPE_OPTIONS = ['Cash', 'Cheque', 'Bank Transfer', 'Mixed'].map((s) => ({ label: s, value: s }));
const PAYMENT_MODE_OPTIONS = ['Cash', 'Cheque', 'Bank Transfer', 'UPI', 'NEFT', 'RTGS'].map((s) => ({ label: s, value: s }));

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', 'Draft', 'Posted'];
const STATUS_COLORS = { Draft: 'info', Posted: 'success' };

const emptyItem = { paymentMode: 'Cash', instrumentNo: '', instrumentDate: null, accountDescription: '', amount: 0 };

function getEmptyValues() {
  const today = new Date();
  return {
    depositNo: '', seriesId: '', branch: '', depositDate: today, depositTo: '', depositType: 'Cash',
    postingDate: today, remarks: '', attachmentName: '',
    interestRate: '', maturityDate: null, maturityAmount: '',
    items: [{ ...emptyItem }],
  };
}

function rowToFormValues(row) {
  return {
    depositNo: row.depositNo, seriesId: '', branch: row.branch || '',
    depositDate: row.depositDate, depositTo: row.depositTo || '',
    depositType: row.depositType || 'Cash', postingDate: row.postingDate,
    remarks: row.remarks || '',
    attachmentName: row.attachmentName || '',
    interestRate: row.interestRate == null ? '' : Number(row.interestRate),
    maturityDate: row.maturityDate || null,
    maturityAmount: row.maturityAmount == null ? '' : Number(row.maturityAmount),
    items: (row.items || []).map((i) => ({
      paymentMode: i.paymentMode || 'Cash', instrumentNo: i.instrumentNo || '',
      instrumentDate: i.instrumentDate || null,
      accountDescription: i.accountDescription || '',
      amount: i.amount != null ? Number(i.amount) : 0,
    })),
  };
}

const DEPOSIT_ENTRY_LIST_TABLE_ROW_HEIGHT = 0;
const DEPOSIT_ENTRY_LIST_TABLE_CELL_PADDING_Y = 6;
export default function DepositEntry() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: deposits, isLoading } = bankDepositApi.useList();
  const { data: houseBanks } = houseBankApi.useList();
  const [create, { isLoading: creating }] = bankDepositApi.useCreate();
  const [update, { isLoading: updating }] = bankDepositApi.useUpdate();
  const [remove] = bankDepositApi.useDelete();

  const depositToOptions = (houseBanks || []).map((b) => ({ label: `${b.bankName} - ${b.accountNumber}`, value: `${b.bankName} - ${b.accountNumber}` }));

  // Form is hidden by default -- it expands in a Collapse ABOVE the list
  // (which stays visible) when "New Deposit" or an edit action is
  // triggered, per the inline form template (PaymentEntry/Branch).
  const [showForm, setShowForm] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const [pendingStatus, setPendingStatus] = useState('Draft');

  const rows = deposits || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    return rows.filter((r) => {
      const matchesSearch = !q || [r.depositNo, r.depositTo].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, statusFilter]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'depositNo', headerName: 'Deposit No.', filter: 'text' },
    { field: 'depositDate', headerName: 'Deposit Date', filter: 'dateRange', sortValue: (row) => (row.depositDate ? new Date(row.depositDate).getTime() : null) },
    { field: 'depositTo', headerName: 'Deposit To', filter: 'text' },
    { field: 'depositType', headerName: 'Deposit Type', filter: 'text' },
    { field: 'totalDepositAmount', headerName: 'Total Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.totalDepositAmount == null || row.totalDepositAmount === '' ? null : Number(row.totalDepositAmount)) },
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
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setShowForm(true);
    setRowMenuAnchor(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete deposit',
      message: `Are you sure you want to delete "${row.depositNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Deposit deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const payload = { ...values, status: pendingStatus };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Deposit updated');
      } else {
        await create(payload).unwrap();
        notify.success('Deposit saved');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2 }}>
          <AppForm readOnly={readOnly}
            key={formKey}
            schema={bankDepositSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow) : getEmptyValues()}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              const { control, watch, setValue } = methods;
              const { fields, append, remove: removeItem } = useFieldArray({ control, name: 'items' });
              const watchedItems = watch('items') || [];
              const totalDeposit = watchedItems.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

              // Maturity Amount stays a plain editable field — the real figure
              // depends on the bank's compounding convention, which isn't
              // knowable here — but a simple-interest estimate is offered as a
              // hint once a rate and maturity date are entered, so the number
              // doesn't have to be worked out by hand.
              const suggestedMaturityAmount = (() => {
                const rate = Number(watch('interestRate'));
                const start = watch('depositDate');
                const end = watch('maturityDate');
                if (!rate || rate <= 0 || !start || !end || !totalDeposit) return null;
                const years = dayjs(end).diff(dayjs(start), 'day') / 365.25;
                if (!(years > 0)) return null;
                return totalDeposit + (totalDeposit * (rate / 100) * years);
              })();

              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

              return (
                <>
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>{readOnly ? 'View Deposit' : editingRow ? 'Edit Deposit' : 'New Deposit'} — Deposit Details</Typography>
                        <Button type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                          Close
                        </Button>
                      </Stack>

                      <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                        {/* The document number leads the form, as it does on every
                          other transaction page. It was labelled "Reference No."
                          while bound to depositNo — the field is the deposit's own
                          number from the DEP numbering series, not a reference to
                          anything else. */}
                        <LabeledField label="Branch *">
                          <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                        </LabeledField>
                        <LabeledField label="Deposit No.">
                          <DocumentSeriesNoField documentCode="DEP" seriesFieldName="seriesId" numberFieldName="depositNo" isCreate={!editingRow} />
                        </LabeledField>
                        <LabeledField label="Deposit Date *">
                          <FormDatePicker name="depositDate" label="" />
                        </LabeledField>
                        <LabeledField label="Deposit To *">
                          <FormSelect name="depositTo" label="" placeholder="Select house bank" options={depositToOptions} />
                        </LabeledField>

                        <LabeledField label="Deposit Type *">
                          <FormSelect name="depositType" label="" options={DEPOSIT_TYPE_OPTIONS} />
                        </LabeledField>
                        <LabeledField label="Posting Date *">
                          <FormDatePicker name="postingDate" label="" />
                        </LabeledField>
                        <LabeledField label="Interest Rate (%)">
                          <FormTextField name="interestRate" label="" type="number" placeholder="e.g. 6.50" helperText="Required together with Maturity Date/Amount for a Fixed/Recurring Deposit" />
                        </LabeledField>
                        <LabeledField label="Maturity Date">
                          <FormDatePicker name="maturityDate" label="" helperText="Must be on/after the Deposit Date" />
                        </LabeledField>
                        <LabeledField label="Maturity Amount (₹)">
                          <FormTextField
                            name="maturityAmount"
                            label=""
                            type="number"
                            placeholder="e.g. 213000.00"
                            helperText={suggestedMaturityAmount != null ? `Simple-interest estimate: ₹${suggestedMaturityAmount.toFixed(2)}` : 'Only for Fixed / Recurring Deposits'}
                          />
                        </LabeledField>
                      </FormGrid>

                      <Grid container spacing={2} sx={{ mt: 0.5 }}>
                        <Grid item xs={12} md={8}>
                          <FormTextField name="remarks" label="Remarks" placeholder="Enter any remarks (optional)" multiline rows={3} />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>Deposit Summary</Typography>
                        <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append({ ...emptyItem })}>
                          Add Deposit Item
                        </Button>
                      </Stack>

                      {isMobile ? (
                        <Box>
                          {fields.map((field, index) => {
                            // Payment Mode and Amount are mandatory on every
                            // line, Cash included. Instrument No., Instrument
                            // Date and Account/Description only become
                            // mandatory once the line is anything other than
                            // Cash — see depositItemSchema's superRefine in
                            // lib/validation/bankingSchemas.js, which is what
                            // actually enforces this; the asterisk here just
                            // tells the user which rule applies before they
                            // hit Save.
                            const rowMode = watch(`items.${index}.paymentMode`);
                            const nonCash = Boolean(rowMode) && rowMode !== 'Cash';
                            return (
                              <MobileItemCard
                                key={field.id}
                                index={index}
                                amount={Number(watch(`items.${index}.amount`) || 0).toFixed(2)}
                                onRemove={() => removeItem(index)}
                              >
                                <FormSelect name={`items.${index}.paymentMode`} label="Payment Mode *" options={PAYMENT_MODE_OPTIONS} />
                                <FormTextField name={`items.${index}.instrumentNo`} label={nonCash ? 'Instrument / Transaction No. *' : 'Instrument / Transaction No.'} />
                                <FormDatePicker name={`items.${index}.instrumentDate`} label={nonCash ? 'Instrument Date *' : 'Instrument Date'} />
                                <FormTextField name={`items.${index}.accountDescription`} label={nonCash ? 'Account / Description *' : 'Account / Description'} />
                                <FormTextField name={`items.${index}.amount`} label="Amount (₹) *" type="number" />
                              </MobileItemCard>
                            );
                          })}
                          {fields.length === 0 && (
                            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No deposit items yet</Typography>
                          )}
                        </Box>
                      ) : (
                        <TableContainer ref={itemScrollRef} sx={{ overflow: 'auto', maxHeight: 420, cursor: 'grab', ...dragScrollbarSx }}>
                          <Table size="small" stickyHeader sx={{ '& tbody .MuiFormHelperText-root:not(.Mui-error)': { display: 'none' } }}>
                            <TableHead>
                              <TableRow>
                                <TableCell width={40}>#</TableCell>
                                {/* Wide enough for the longest option, "Bank Transfer",
                                alongside the Autocomplete's clear and dropdown
                                buttons. At 150 the icons took most of the field
                                and "Cheque" rendered as "Chec". */}
                                <TableCell sx={{ minWidth: 225 }}>Payment Mode *</TableCell>
                                {/* These three are mandatory for every payment mode except Cash — see
                                the per-row asterisk on the field itself, added once a row picks a
                                non-Cash mode, and depositItemSchema's superRefine in
                                lib/validation/bankingSchemas.js, which is what actually enforces it. */}
                                <TableCell sx={{ minWidth: 180 }}>Instrument / Transaction No.</TableCell>
                                <TableCell sx={{ minWidth: 160 }}>Instrument Date</TableCell>
                                <TableCell sx={{ minWidth: 200 }}>Account / Description</TableCell>
                                <TableCell align="right" sx={{ minWidth: 140 }}>Amount (₹) *</TableCell>
                                <TableCell width={48} />
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {fields.map((field, index) => {
                                // See the mobile card above for why: Instrument
                                // No./Date and Account/Description are only
                                // mandatory once THIS row's own Payment Mode
                                // isn't Cash. The label switches to show the
                                // asterisk so the requirement is visible per
                                // row, not just as a table-wide footnote.
                                const rowMode = watch(`items.${index}.paymentMode`);
                                const nonCash = Boolean(rowMode) && rowMode !== 'Cash';
                                return (
                                  <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                    <TableCell>{index + 1}</TableCell>
                                    <TableCell>
                                      <FormSelect name={`items.${index}.paymentMode`} label="" options={PAYMENT_MODE_OPTIONS} />
                                    </TableCell>
                                    <TableCell>
                                      <FormTextField
                                        name={`items.${index}.instrumentNo`}
                                        label={nonCash ? 'Instrument / Transaction No. *' : ''}
                                        placeholder={nonCash ? 'Required' : '—'}
                                      />
                                    </TableCell>
                                    <TableCell>
                                      <FormDatePicker name={`items.${index}.instrumentDate`} label={nonCash ? 'Instrument Date *' : ''} />
                                    </TableCell>
                                    <TableCell>
                                      <FormTextField
                                        name={`items.${index}.accountDescription`}
                                        label={nonCash ? 'Account / Description *' : ''}
                                        placeholder={nonCash ? 'Required' : 'e.g. Cash / bank account'}
                                      />
                                    </TableCell>
                                    <TableCell align="right">
                                      <FormTextField inputProps={{ style: { textAlign: 'right' } }} name={`items.${index}.amount`} label="" type="number" />
                                    </TableCell>
                                    <TableCell>
                                      <IconButton type="button" size="small" color="error" onClick={() => removeItem(index)} aria-label="remove item">
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              {fields.length === 0 && (
                                <TableRow>
                                  <TableCell colSpan={7}>
                                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>No deposit items yet</Typography>
                                  </TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                            {fields.length > 0 && (
                              <TableBody>
                                <TableRow>
                                  <TableCell colSpan={4} />
                                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>Total Deposit Amount (₹)</TableCell>
                                  <TableCell sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>₹{totalDeposit.toFixed(2)}</TableCell>
                                  <TableCell />
                                </TableRow>
                              </TableBody>
                            )}
                          </Table>
                        </TableContainer>
                      )}
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ mb: 0 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Attachments (Optional)</Typography>
                          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Button component="label" variant="outlined" size="small" disabled={readOnly}>
                              Choose File
                              <input type="file" hidden disabled={readOnly} onChange={(e) => handleFile(e.target.files?.[0])} />
                            </Button>
                            {watch('attachmentName') ? (
                              <Chip
                                size="small"
                                label={watch('attachmentName')}
                                onDelete={readOnly ? undefined : () => setValue('attachmentName', '')}
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">No file chosen</Typography>
                            )}
                          </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 3, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <Stack spacing={1}>
                              <Typography variant="body2" color="text.secondary">Total Deposit Amount (₹)</Typography>
                              <Typography variant="h4" fontWeight={700}>₹{totalDeposit.toFixed(2)}</Typography>
                            </Stack>
                          </Box>
                        </Grid>
                      </Grid>

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                        sx={{ mt: 3 }}
                      >
                        <Button fullWidth={isMobile} type="button" variant="outlined" color={readOnly ? 'error' : 'inherit'} startIcon={<CloseIcon />} onClick={closeForm} disabled={creating || updating}>
                          {readOnly ? 'Close' : 'Cancel'}
                        </Button>
                        <FormSubmitButton
                          fullWidth={isMobile}
                          variant="outlined"
                          onClick={() => setPendingStatus('Draft')}
                          disabled={creating || updating}
                        >
                          Save as Draft
                        </FormSubmitButton>
                        <FormSubmitButton
                          fullWidth={isMobile}
                          onClick={() => setPendingStatus('Posted')}
                          disabled={creating || updating}
                        >
                          Save & Post Deposit
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
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            alignItems={{ xs: 'stretch', md: 'center' }}
            justifyContent="space-between"
            flexWrap="wrap"
            gap={1.5}
            sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}
          >
            <Typography variant="subtitle1" fontWeight={700}>Deposit List</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
              <TableSearchFilter table={table} placeholder="Search by deposit no., bank, customer..." showFilter={false} />
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<FilterListIcon />}
                  onClick={() => setShowFilters((v) => !v)}
                  sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                >
                  Filter
                </Button>
                <CanAdd>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={openCreate}
                    sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                  >
                    New Deposit
                  </Button>
                </CanAdd>
              </Stack>
            </Stack>
          </Stack>

          <Collapse in={showFilters} unmountOnExit>
            <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
              <FormGrid columns={4} singleColumnOnMobile>
                <Autocomplete
                  size="small"
                  options={STATUS_FILTERS}
                  value={statusFilter}
                  onChange={(_e, v) => { setStatusFilter(v || 'All Status'); setPage(0); }}
                  disableClearable
                  renderInput={(params) => <TextField {...params} label="Status" InputLabelProps={{ shrink: true }} />}
                />
              </FormGrid>
              <TableFilterPanel table={table} embedded open />
            </Box>
          </Collapse>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {!isLoading && pagedRows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.depositNo}
                  statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Deposit Date', value: row.depositDate ? dayjs(row.depositDate).format('DD/MM/YYYY') : '—' },
                    { label: 'Deposit To', value: row.depositTo || '—' },
                    { label: 'Deposit Type', value: row.depositType || '—' },
                    { label: 'Total Amount', value: `₹${Number(row.totalDepositAmount).toFixed(2)}` },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                />
              ))}
              {!isLoading && filteredRows.length === 0 && (
                <EmptyState icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />} title="No deposits found" message="Add your first deposit to get started" />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table
                size="small"
                stickyHeader
                sx={{
                  '& th, & td': {
                    height: DEPOSIT_ENTRY_LIST_TABLE_ROW_HEIGHT,
                    paddingTop: `${DEPOSIT_ENTRY_LIST_TABLE_CELL_PADDING_Y}px`,
                    paddingBottom: `${DEPOSIT_ENTRY_LIST_TABLE_CELL_PADDING_Y}px`,
                    boxSizing: 'border-box',
                  },
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell width={40}>#</TableCell>
                    <SortableHeaderCell field="depositNo" sort={table.sort} onSort={table.toggleSort}>Deposit No.</SortableHeaderCell>
                    <SortableHeaderCell field="depositDate" sort={table.sort} onSort={table.toggleSort}>Deposit Date</SortableHeaderCell>
                    <SortableHeaderCell field="depositTo" sort={table.sort} onSort={table.toggleSort}>Deposit To</SortableHeaderCell>
                    <SortableHeaderCell field="depositType" sort={table.sort} onSort={table.toggleSort}>Deposit Type</SortableHeaderCell>
                    <SortableHeaderCell align="right" field="totalDepositAmount" sort={table.sort} onSort={table.toggleSort}>Total Amount (₹)</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {!isLoading && pagedRows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{page * pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.depositNo}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.depositDate ? dayjs(row.depositDate).format('DD/MM/YYYY') : '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.depositTo || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.depositType || '—'}</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.totalDepositAmount).toFixed(2)}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={(e) => { setRowMenuAnchor(e.currentTarget); setRowMenuTarget(row); }}
                          aria-label="more actions"
                        >
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!isLoading && filteredRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9}>
                        <EmptyState icon={<AccountBalanceOutlinedIcon sx={{ fontSize: 48 }} />} title="No deposits found" message="Add your first deposit to get started" />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <Menu anchorEl={rowMenuAnchor} open={!!rowMenuAnchor} onClose={() => setRowMenuAnchor(null)}>
            <CanEdit>
              <MenuItem onClick={() => handleEdit(rowMenuTarget)}>
                <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Edit</ListItemText>
              </MenuItem>
            </CanEdit>
            <CanDelete>
              <MenuItem onClick={() => handleDelete(rowMenuTarget)}>
                <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                <ListItemText>Delete</ListItemText>
              </MenuItem>
            </CanDelete>
          </Menu>

          <EntityListPagination total={filteredRows.length} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
        </CardContent>
      </Card>
    </Box>
  );
}
