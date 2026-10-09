import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Grid, Collapse,
  Tabs, Tab, Dialog, DialogTitle, DialogContent, DialogActions, Paper,
  TextField, MenuItem, Checkbox, FormControlLabel, Tooltip, alpha, LinearProgress,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import ContactMailOutlinedIcon from '@mui/icons-material/ContactMailOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import RouteMapDocumentPreview from '../../components/common/RouteMapDocumentPreview';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import {
  businessPartnerSchema, PARTNER_TYPE_OPTIONS, PARTNER_GROUP_OPTIONS,
  PARTNER_CODE_MODE_OPTIONS, SHIPPING_TYPE_OPTIONS, INDUSTRY_OPTIONS, BUSINESS_PARTNER_TYPE_OPTIONS,
  EMAIL_GROUP_OPTIONS, TITLE_OPTIONS, GENDER_OPTIONS, PAYMENT_METHOD_OPTIONS, PAYMENT_PRIORITY_OPTIONS, PAYMENT_TERMS_OPTIONS,
  GST_TYPE_OPTIONS,
} from '../../lib/validation/partnerSchemas';
import { useBpCurrencyOptions } from '../../lib/currencyOptions';
import { optionalMobileNumber, optionalPhoneNumber, optionalEmail, pincode, panNumber } from '../../lib/validation/common';
import {
  businessPartnerApi, salesEmployeeApi, chartOfAccountApi, houseBankApi, usePeekBusinessPartnerCodeMutation,
  useGetBusinessPartnerSummaryQuery, useGetBusinessPartnerInvoicesQuery, useGetBusinessPartnerDocumentsQuery,
  useUploadBusinessPartnerLogoMutation, useRemoveBusinessPartnerLogoMutation,
} from '../../features/resources';
import { countries, getStateOptions } from '../../lib/constants/locations';
import { getCityOptions } from '../../lib/constants/locationsCities';
import useServerListTable from '../../components/data-display/useServerListTable';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import TableSkeleton from '../../components/feedback/TableSkeleton';
import LoadingState from '../../components/feedback/LoadingState';
import EmptyState from '../../components/data-display/EmptyState';

// Label-left field layout, copied from pages/product/ProductMaster.jsx's own
// LabeledField (per "refer the product master add page for the label and
// input field... apply the alignment as same as in the product master add
// page" — kept page-local exactly as ProductMaster's own copy is, rather than
// factored into a shared component, since it's a one-page layout choice, not
// a house style change for the whole app).
// const FIELD_LABEL_WIDTH = 160;
// const FIELD_LABEL_GAP = 1.5;
// const FIELD_ROW_SPACING = 0;
// const FIELD_COLUMN_SPACING = 3;
// const FIELD_MAX_WIDTH = 500;
// const FIELD_LABEL_OFFSET = 0;
// const FIELD_INPUT_SX = {
//   '& .MuiInputBase-input': { paddingTop: '5px', paddingBottom: '5px', fontSize: '0.8125rem' },
//   '& .MuiInputBase-root': { minHeight: 34 },
//   '& .MuiFormHelperText-root': { margin: 0, minHeight: '0.9em', lineHeight: 1.2, fontSize: '0.6875rem' },
// };

// function FieldLabel({ children }) {
//   const text = String(children || '');
//   const required = text.trim().endsWith('*');
//   const base = required ? text.trim().replace(/\*$/, '').trimEnd() : text;
//   return (
//     <Typography
//       variant="body2"
//       sx={{
//         width: { xs: '100%', lg: FIELD_LABEL_WIDTH },
//         flexShrink: 0,
//         fontWeight: 600,
//         color: 'text.primary',
//         pt: { xs: 0, lg: FIELD_LABEL_OFFSET },
//         mb: { xs: 0.5, lg: 0 },
//       }}
//     >
//       {base}
//       {required && <Typography component="span" color="error.main">&nbsp;*</Typography>}
//     </Typography>
//   );
// }

// function LabeledField({ label, children, align = 'flex-start' }) {
//   return (
//     <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { xs: 'stretch', lg: align }, gap: { xs: 0.5, lg: FIELD_LABEL_GAP } }}>
//       <FieldLabel>{label}</FieldLabel>
//       <Box
//         sx={{
//           flex: 1, minWidth: 0, maxWidth: { sm: FIELD_MAX_WIDTH }, ...FIELD_INPUT_SX,
//           ...(align === 'center' ? { display: 'flex', alignItems: 'center', minHeight: 34 } : null),
//         }}
//       >
//         {children}
//       </Box>
//     </Box>
//   );
// }

// Deliveries/Orders (Customer) and Goods Receipt POs/Purchase Orders
// (Vendor) summary totals below Account Balance — read-only,
// grey/disabled display boxes matching the SAP reference screenshots, not
// RHF-controlled fields since they're computed server-side, not submitted.
//
// onView (optional) adds the same drill-down view icon Account Balance has,
// opening BusinessPartnerDocumentDialog over the documents this total is
// summed from. Rendered as a <span> (component="span"), not a <button> --
// see the identical comment on the Account Balance view icon below for why:
// FormGrid puts every field in a native <fieldset disabled={readOnly}>, and
// only a non-form-associated element keeps working once that's disabled in
// View mode.
function SummaryAmountField({ label, value, onView, viewDisabled }) {
  return (
    <LabeledField label={label}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
        <Box
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            px: 1.5,
            borderRadius: 1,
            bgcolor: 'action.disabledBackground',
            border: '1px solid',
            borderColor: 'divider',
            fontSize: '0.8125rem',
            color: 'text.secondary',
          }}
        >
          {value}
        </Box>
        {onView && (
          <Tooltip title={viewDisabled ? 'Save this partner first' : `View ${label}`}>
            <span>
              <IconButton component="span" size="small" disabled={viewDisabled} onClick={onView}>
                <VisibilityOutlinedIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Box>
    </LabeledField>
  );
}

// View icon dialog next to Account Balance — lists the Sales Invoices
// (Customer) or Purchase Invoices (Vendor) that accountBalance's auto-fill
// effect (above, in the AppForm render prop) sums into that field, via GET
// /business-partners/:code/invoices. Read-only: no row selection/Ok action,
// just Close, since this is a "what makes up this total" view rather than a
// picker like FindAccountsDialog.
function BusinessPartnerInvoicesDialog({ open, onClose, partnerType, code }) {
  const { data, isFetching } = useGetBusinessPartnerInvoicesQuery(code, { skip: !open || !code });
  const rows = data || [];
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const formatAmount = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—');
  const title = partnerType === 'Vendor' ? 'Purchase Invoices' : 'Sales Invoices';
  // The row's own View button opens the actual document read-only, straight
  // on top of this dialog — the exact same RouteMapDocumentPreview popup the
  // Route Map feature already uses for this (see that component's own
  // comment), just launched from here instead of from a route-map card.
  // `stage`/`flow` match its stageLoaders keys.
  const flow = partnerType === 'Vendor' ? 'purchase' : 'sales';
  const stage = partnerType === 'Vendor' ? 'Purchase Invoice' : 'Sales Invoice';
  const [previewDocNo, setPreviewDocNo] = useState(null);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>{title}</DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {isFetching ? (
            <LoadingState />
          ) : (
            <Box sx={{ maxHeight: 420, overflow: 'auto', border: '1px solid', borderColor: 'divider' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <TableCell>Invoice No</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount (₹)</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell width={64} align="center">View</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={row.id ?? row.invoiceNo}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{row.invoiceNo || '—'}</TableCell>
                      <TableCell>{formatDate(row.invoiceDate)}</TableCell>
                      <TableCell align="right">{formatAmount(row.amount)}</TableCell>
                      <TableCell>{row.status || '—'}</TableCell>
                      <TableCell align="center">
                        <Tooltip title={row.invoiceNo ? `View ${row.invoiceNo}` : 'No document number'}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!row.invoiceNo}
                              onClick={() => setPreviewDocNo(row.invoiceNo)}
                              aria-label="view"
                            >
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                          No {title.toLowerCase()} found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <Typography variant="subtitle2">Total: ₹{formatAmount(total)}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" color="inherit" onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      {previewDocNo && (
        <RouteMapDocumentPreview
          open={Boolean(previewDocNo)}
          onClose={() => setPreviewDocNo(null)}
          flow={flow}
          stage={stage}
          docNo={previewDocNo}
        />
      )}
    </>
  );
}

// View icon dialog for the four summary tiles below Account Balance --
// Deliveries/Orders (Customer) and Purchase Orders/Goods Receipt POs
// (Vendor). One generic dialog for all four, distinguished by `type` (see
// backend routes/resources.js GET /business-partners/:code/documents and its
// BP_SUMMARY_DOCUMENT_TYPES map); same read-only "what makes up this total"
// shape as BusinessPartnerInvoicesDialog above, just over a document number/
// date instead of an invoice number/date.
// Which RouteMapDocumentPreview flow/stage each of the four summary tiles'
// `type` maps to — same values BP_SUMMARY_DOCUMENT_TYPES on the backend and
// stageLoaders in RouteMapDocumentPreview.jsx already key off, just indexed
// by the tile's own `type` string here.
const BP_DOCUMENT_PREVIEW_TARGET = {
  deliveries: { flow: 'sales', stage: 'Delivery Challan' },
  orders: { flow: 'sales', stage: 'Sales Order' },
  purchaseOrders: { flow: 'purchase', stage: 'Purchase Order' },
  goodsReceiptPOs: { flow: 'purchase', stage: 'Purchase GRN' },
};

function BusinessPartnerDocumentDialog({ open, onClose, code, type, title }) {
  const { data, isFetching } = useGetBusinessPartnerDocumentsQuery({ code, type }, { skip: !open || !code || !type });
  const rows = data || [];
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const formatAmount = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—');
  // The row's own View button — same RouteMapDocumentPreview popup as
  // BusinessPartnerInvoicesDialog's own View column above.
  const previewTarget = BP_DOCUMENT_PREVIEW_TARGET[type];
  const [previewDocNo, setPreviewDocNo] = useState(null);

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>{title}</DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          {isFetching ? (
            <LoadingState />
          ) : (
            <Box sx={{ maxHeight: 420, overflow: 'auto', border: '1px solid', borderColor: 'divider' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <TableCell>Document No</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount (₹)</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell width={64} align="center">View</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, i) => (
                    <TableRow key={row.id ?? row.documentNo}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{row.documentNo || '—'}</TableCell>
                      <TableCell>{formatDate(row.documentDate)}</TableCell>
                      <TableCell align="right">{formatAmount(row.amount)}</TableCell>
                      <TableCell>{row.status || '—'}</TableCell>
                      <TableCell align="center">
                        <Tooltip title={row.documentNo ? `View ${row.documentNo}` : 'No document number'}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!row.documentNo}
                              onClick={() => setPreviewDocNo(row.documentNo)}
                              aria-label="view"
                            >
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>
                          No {(title || 'documents').toLowerCase()} found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          )}
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <Typography variant="subtitle2">Total: ₹{formatAmount(total)}</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button variant="outlined" color="inherit" onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
      {previewDocNo && previewTarget && (
        <RouteMapDocumentPreview
          open={Boolean(previewDocNo)}
          onClose={() => setPreviewDocNo(null)}
          flow={previewTarget.flow}
          stage={previewTarget.stage}
          docNo={previewDocNo}
        />
      )}
    </>
  );
}

const BP_LOGO_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp'];
const BP_LOGO_MAX_BYTES = 2 * 1024 * 1024;

function validateBpLogoFile(file) {
  if (!BP_LOGO_ACCEPTED_TYPES.includes(file.type)) {
    return 'Please choose a PNG, JPG, SVG or WEBP image.';
  }
  if (file.size > BP_LOGO_MAX_BYTES) {
    return 'Image is too large. Maximum size is 2MB.';
  }
  return null;
}

function BusinessPartnerLogoField({ currentLogoUrl, editing, logoFile, previewUrl, removeRequested, onFileSelected, onRemove, error }) {
  const showImage = !removeRequested && (previewUrl || currentLogoUrl);
  const imageSrc = logoFile ? previewUrl : currentLogoUrl;

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file name after an error
    if (!file) return;
    onFileSelected(file);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box
        sx={{
          position: 'relative',
          width: 80, height: 80,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.04),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden', flexShrink: 0,
        }}
      >
        {showImage ? (
          <Box component="img" src={imageSrc} alt="Business partner logo" sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <ImageOutlinedIcon sx={{ fontSize: 34, color: 'text.disabled' }} />
        )}
        {editing && (
          <IconButton
            component="label"
            size="small"
            sx={{ position: 'absolute', bottom: -4, right: -4, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider' }}
          >
            <PhotoCameraIcon fontSize="small" />
            <input type="file" accept={BP_LOGO_ACCEPTED_TYPES.join(',')} hidden onChange={handleChange} />
          </IconButton>
        )}
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          PNG, JPG, SVG or WEBP. Max 2MB.
        </Typography>
        {error && (
          <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
            {error}
          </Typography>
        )}
        {editing && showImage && (
          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={onRemove}
            sx={{ mt: 0.5, px: 0 }}
          >
            Remove
          </Button>
        )}
      </Box>
    </Box>
  );
}

// Width (px) of the Control Account / Accounts Receivable / Accounts Payable
// select's OPEN dropdown — deliberately wider than the closed field so its
// two-column Code/Name layout (see AccountCodeDropdownPaper below) has room
// to read, the way a select2-style combobox does. Same pattern as
// WarehouseMaster's and GLAccountDeterminationForm's own Accounting tabs.
const ACCOUNT_CODE_DROPDOWN_WIDTH = 380;
// How much of ACCOUNT_CODE_DROPDOWN_WIDTH the Code column takes, both in the
// dropdown's header row and in each option row.
const ACCOUNT_CODE_DROPDOWN_CODE_WIDTH = 140;

// The select2-style header row + two-column option layout for the account
// dropdown. MUI's Autocomplete has no "table header inside the popup" prop,
// so this wraps the Paper it renders its listbox in and injects a sticky
// header above `children` (the actual list of options).
function AccountCodeDropdownPaper({ children, ...paperProps }) {
  return (
    <Paper {...paperProps}>
      <Box
        sx={{
          display: 'flex',
          px: 2,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          typography: 'caption',
          fontWeight: 700,
          color: 'text.secondary',
        }}
      >
        <Box sx={{ width: ACCOUNT_CODE_DROPDOWN_CODE_WIDTH, flexShrink: 0 }}>Account Code</Box>
        <Box sx={{ flex: 1 }}>Account Name</Box>
      </Box>
      {children}
    </Paper>
  );
}

// One row of the dropdown: code on the left (fixed width, matching the
// header above), name on the right. `option` is an accountOptions entry —
// value/label is the code alone (see accountOptions below); accountName
// rides along unused by the Autocomplete itself, read here only to fill the
// dropdown's Account Name column.
function renderAccountCodeOption(liProps, option) {
  return (
    <li {...liProps}>
      <Box sx={{ display: 'flex', width: '100%' }}>
        <Box sx={{ width: ACCOUNT_CODE_DROPDOWN_CODE_WIDTH, flexShrink: 0 }}>{option.value}</Box>
        <Box sx={{ flex: 1, color: 'text.secondary' }}>{option.accountName || '—'}</Box>
      </Box>
    </li>
  );
}

const emptyValues = {
  codeMode: 'auto-customer',
  partnerCode: '', partnerName: '', foreignName: '', groupName: '', currency: 'All',
  accountBalance: 0, partnerType: '', status: 'Active',
  telephone: '', mobile: '', email: '', website: '',
  shippingType: '', industry: '', businessPartnerType: '', contactPerson: '', salesPerson: '',
  remarks: '',
  contacts: [], billingAddresses: [], shippingAddresses: [], machineries: [],
  paymentTerms: '', creditDays: 0, creditLimit: 0,
  paymentMethod: '', paymentPriority: '', blockPayment: false, houseBank: '', bankAccountNo: '',
  ifscCode: '', branch: '', state: '',
  controlAccount: '',
  // Whether this partner's logo prints alongside the KEMACH logo when they
  // are chosen as the Supplier on a sales document — see logoVisible on
  // BusinessPartner (Prisma), which is Boolean @default(false). The form
  // itself carries the 'Yes'/'No' string this FormSelect needs; it's
  // converted to/from the real boolean at the submit/hydrate boundary (see
  // rowToFormValues and the submit handler below), same as a brand-new
  // partner defaulting to "No" to match the DB default.
  logoVisible: 'No',
};

// Options for the "Logo Visibility" Yes/No select — see logoVisible above.
const LOGO_VISIBLE_OPTIONS = [
  { label: 'Yes', value: 'Yes' },
  { label: 'No', value: 'No' },
];

const PAGE_SIZE = 10;
// 'Machineries' sits right after 'Accounting' — every tab after it (Remarks,
// Attachments) shifts up by one index; see the `tab === N` blocks below.
const TAB_LABELS = ['General', 'Contact Person', 'Addresses', 'Payment Terms', 'Payment Run', 'Accounting', 'Machineries', 'Remarks', 'Attachments'];

const emptyContactValues = {
  contactId: '', title: '', firstName: '', lastName: '', position: '', address: '',
  telephone: '', mobile: '', email: '', emailGroup: '', password: '',
  birthCountry: '', birthState: '', birthCity: '', dateOfBirth: '', gender: '', profession: '', remarks: '',
  isDefault: false,
};

const emptyMachineryValues = { itemCode: '', itemName: '' };

// Add/Edit Machinery — a small standalone dialog, same "plain useState,
// Save hands a plain object back to the caller" pattern as
// ContactPersonDialog/AddressDialog above. Machine Serial No and Machine
// Model are both plain, independently-typable text fields — there is no
// Product Master lookup here (a Machine is not a Product): the labels say
// "Machine Serial No"/"Machine Model" to match the business terms used
// elsewhere, but the underlying field names (values.itemCode/itemName) and
// the BusinessPartnerMachinery.itemCode/itemName columns they save to are
// left exactly as they are — both are plain strings, not FKs, so there is
// nothing to migrate by renaming them. Only Machine Serial No (itemCode) is
// mandatory — Machine Model (itemName) is optional (see canSave below).
function MachineryDialog({ open, initialValue, onClose, onSave }) {
  const [values, setValues] = useState(emptyMachineryValues);
  useEffect(() => {
    if (open) setValues({ ...emptyMachineryValues, ...(initialValue || {}) });
  }, [open, initialValue]);

  // Machine Model (itemName) is no longer mandatory — only Machine Serial
  // No (itemCode) is required to save a row.
  const canSave = String(values.itemCode || '').trim() !== '';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {initialValue ? 'Edit Machinery' : 'Add Machinery'}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="close"><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0.25 }}>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone
              label="Machine Serial No *"
              value={values.itemCode}
              onChange={(e) => setValues((v) => ({ ...v, itemCode: e.target.value }))}
              placeholder="Enter machine serial no"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone
              label="Machine Model"
              value={values.itemName}
              onChange={(e) => setValues((v) => ({ ...v, itemName: e.target.value }))}
              placeholder="Enter machine model"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={<SaveIcon />} disabled={!canSave} onClick={() => onSave(values)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// Add/Edit Contact Person — a small standalone dialog (plain useState, not a
// nested RHF form) whose Save hands a plain object back to the caller, which
// appends/updates it into the parent form's `contacts` field array. Mirrors
// the content of the "Add Contact Person" reference mockup.
function ContactPersonDialog({ open, initialValue, onClose, onSave }) {
  const [values, setValues] = useState(emptyContactValues);
  useEffect(() => {
    if (open) {
      // dateOfBirth may come back from the backend as a full ISO datetime
      // string ("1990-05-12T00:00:00.000Z") rather than the plain
      // YYYY-MM-DD a native <input type="date"> needs — anything past the
      // first 10 characters leaves the input blank/invalid.
      const next = { ...emptyContactValues, ...(initialValue || {}) };
      next.dateOfBirth = String(next.dateOfBirth ?? '').slice(0, 10);
      setValues(next);
    }
  }, [open, initialValue]);

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));
  // Changing the country/state invalidates whatever was picked underneath it
  // — same cascading-clear rule AddressDialog's own country/state/city
  // fields already follow above.
  const setBirthCountry = (e) => setValues((v) => ({ ...v, birthCountry: e.target.value, birthState: '', birthCity: '' }));
  const setBirthState = (e) => setValues((v) => ({ ...v, birthState: e.target.value, birthCity: '' }));
  // Strips anything that isn't a digit as it's typed (so letters/symbols
  // never appear at all, pasted or not) and caps it at 10 characters — same
  // digitsOnly + maxLength behaviour FormTextField gives the General tab's
  // own Mobile field (see FormTextField.jsx), reproduced by hand here since
  // this dialog manages its own state instead of a nested RHF form.
  const setMobile = (e) => setValues((v) => ({ ...v, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }));

  // Same format rules as businessPartnerContactSchema (lib/validation/
  // partnerSchemas.js) — validating here, before the row is appended into
  // the parent form's `contacts` field array, is what stops a badly
  // formatted mobile/telephone/email from ever reaching the array. Once one
  // does, the whole businessPartnerSchema fails validation with no visible
  // error anywhere (the dialog isn't RHF-connected, so there's nothing to
  // turn red), and FormSubmitButton stays disabled forever.
  const mobileCheck = optionalMobileNumber('Mobile').safeParse(values.mobile);
  const telephoneCheck = optionalPhoneNumber('Telephone').safeParse(values.telephone);
  const emailCheck = optionalEmail().safeParse(values.email);
  const mobileError = !mobileCheck.success ? mobileCheck.error.issues[0]?.message : '';
  const telephoneError = !telephoneCheck.success ? telephoneCheck.error.issues[0]?.message : '';
  const emailError = !emailCheck.success ? emailCheck.error.issues[0]?.message : '';
  const canSave = mobileCheck.success && telephoneCheck.success && emailCheck.success;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>
          {initialValue ? 'Edit Contact Person' : 'Add Contact Person'}
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="close"><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0.25 }}>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Contact ID" value={values.contactId} onChange={set('contactId')} placeholder="Contact ID" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectStandalone label="Title" value={values.title} onChange={set('title')} options={TITLE_OPTIONS} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="First Name" value={values.firstName} onChange={set('firstName')} placeholder="First Name" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Last Name" value={values.lastName} onChange={set('lastName')} placeholder="Last Name" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Position" value={values.position} onChange={set('position')} placeholder="Position" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Address" value={values.address} onChange={set('address')} placeholder="Address" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Telephone" value={values.telephone} onChange={set('telephone')} placeholder="Telephone" error={telephoneError} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone
              label="Mobile"
              value={values.mobile}
              onChange={setMobile}
              placeholder="Mobile"
              error={mobileError}
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 10 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Email" value={values.email} onChange={set('email')} placeholder="Email" error={emailError} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectStandalone label="Email Group" value={values.emailGroup} onChange={set('emailGroup')} options={EMAIL_GROUP_OPTIONS} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Password" value={values.password} onChange={set('password')} type="password" placeholder="Password" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectStandalone label="Birth Country" value={values.birthCountry} onChange={setBirthCountry} options={countries} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectStandalone label="Birth State" value={values.birthState} onChange={setBirthState} options={getStateOptions(values.birthCountry)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectStandalone label="Birth City" value={values.birthCity} onChange={set('birthCity')} options={getCityOptions(values.birthCountry, values.birthState)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Date of Birth" value={values.dateOfBirth} onChange={set('dateOfBirth')} type="date" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectStandalone label="Gender" value={values.gender} onChange={set('gender')} options={GENDER_OPTIONS} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Profession" value={values.profession} onChange={set('profession')} placeholder="Profession" />
          </Grid>
          <Grid item xs={12}>
            <FormTextFieldStandalone label="Remarks" value={values.remarks} onChange={set('remarks')} placeholder="Remarks" multiline rows={2} />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={!!values.isDefault}
                  onChange={(e) => setValues((v) => ({ ...v, isDefault: e.target.checked }))}
                />
              )}
              label="Set as default"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={<SaveIcon />} disabled={!canSave} onClick={() => onSave(values)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

const emptyAddressValues = {
  addressName: '', street: '', streetNo: '', buildingFloorRoom: '', block: '',
  country: 'India', state: '', city: '', zipCode: '', taxOffice: '',
  // Defaults to the common case (see GST_TYPE_OPTIONS) rather than blank —
  // most addresses are a regular GST registration, so this saves picking it
  // every time and still leaves it changeable for the few that aren't.
  gstType: 'Regular/TDS/ISD', gstNumber: '', panNo: '',
  isDefault: false,
};

// Basic client-side GSTIN shape check for the Save-button guard below —
// mirrors the gstin() regex in lib/validation/common.js. The real
// validation (and the error message shown after Save) still runs through
// the zod schema on submit; this is only so an obviously-malformed GST
// number can't even be handed off to it.
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z0-9]$/;

// Add/Edit Address — used for both the Billing Address and Shipping Address
// sections of the Addresses tab; `title` distinguishes which is open. Field
// set/order (Address Name, Street, Street No, Building/Floor/Room, Block,
// Country, State, City, Zip Code, Tax Office, GST Type, GST Number) and the
// Country -> State -> City cascade mirror Branch's own address block.
function AddressDialog({ open, title, initialValue, onClose, onSave }) {
  const [values, setValues] = useState(emptyAddressValues);
  useEffect(() => {
    if (open) setValues({ ...emptyAddressValues, ...(initialValue || {}) });
  }, [open, initialValue]);

  const set = (field) => (e) => setValues((v) => ({ ...v, [field]: e.target.value }));
  const setCountry = (e) => setValues((v) => ({ ...v, country: e.target.value, state: '', city: '' }));
  const setState = (e) => setValues((v) => ({ ...v, state: e.target.value, city: '' }));
  // Same digitsOnly + maxLength treatment as Mobile above — strips anything
  // that isn't a digit as it's typed or pasted and caps it at 6, matching
  // Branch's own Zip Code field (FormTextField digitsOnly maxLength={6}).
  const setZipCode = (e) => setValues((v) => ({ ...v, zipCode: e.target.value.replace(/\D/g, '').slice(0, 6) }));

  const gstValue = String(values.gstNumber || '').trim().toUpperCase();
  // Same reasoning as ContactPersonDialog's own format checks: this dialog
  // isn't RHF-connected, so a badly formatted zip code would otherwise slip
  // straight into the billingAddresses/shippingAddresses array with nothing
  // on screen to turn red — businessPartnerAddressSchema (partnerSchemas.js)
  // would then fail validation on Save with no visible cause, leaving
  // FormSubmitButton disabled with no explanation.
  const zipCheck = pincode('Zip Code').safeParse(values.zipCode);
  const zipError = !zipCheck.success ? zipCheck.error.issues[0]?.message : '';
  // PAN Card Number: optional, but when given it must be AAAAA9999A.
  const panCheck = panNumber('PAN Card Number').safeParse(values.panNo);
  const panError = !panCheck.success ? panCheck.error.issues[0]?.message : '';
  const canSave = String(values.addressName || '').trim().length > 0
    && String(values.country || '').trim().length > 0
    && String(values.state || '').trim().length > 0
    && String(values.city || '').trim().length > 0
    && zipCheck.success
    && panCheck.success
    && (!gstValue || GSTIN_PATTERN.test(gstValue));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, pr: 1 }}>
        <Typography variant="subtitle1" fontWeight={700}>{title}</Typography>
        <IconButton onClick={onClose} size="small" aria-label="close"><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mt: 0.25 }}>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Address Name *" value={values.addressName} onChange={set('addressName')} placeholder="Enter address name" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Street" value={values.street} onChange={set('street')} placeholder="Enter street" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Street No" value={values.streetNo} onChange={set('streetNo')} placeholder="Enter street number" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Building/Floor/Room" value={values.buildingFloorRoom} onChange={set('buildingFloorRoom')} placeholder="Enter building, floor or room" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Block" value={values.block} onChange={set('block')} placeholder="Enter block" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectStandalone label="Country *" value={values.country} onChange={setCountry} options={countries} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectStandalone label="State *" value={values.state} onChange={setState} options={getStateOptions(values.country)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectStandalone label="City *" value={values.city} onChange={set('city')} options={getCityOptions(values.country, values.state)} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone
              label="Zip Code"
              value={values.zipCode}
              onChange={setZipCode}
              placeholder="Enter zip code"
              error={zipError}
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone label="Tax Office" value={values.taxOffice} onChange={set('taxOffice')} placeholder="Enter tax office" />
          </Grid>
          <Grid item xs={12} sm={6}>
            <SelectStandalone label="GST Type" value={values.gstType} onChange={set('gstType')} options={GST_TYPE_OPTIONS} />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone
              label="GST Number"
              value={values.gstNumber}
              onChange={(e) => setValues((v) => ({ ...v, gstNumber: e.target.value.toUpperCase() }))}
              placeholder="e.g. 22AAAAA0000A1Z5"
            />
            {gstValue && !GSTIN_PATTERN.test(gstValue) && (
              <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5 }}>
                Enter a valid 15-character GST number
              </Typography>
            )}
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormTextFieldStandalone
              label="PAN Card Number"
              value={values.panNo}
              onChange={(e) => setValues((v) => ({ ...v, panNo: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) }))}
              placeholder="e.g. ABCDE1234F"
              error={panError}
              inputProps={{ maxLength: 10 }}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={(
                <Checkbox
                  checked={!!values.isDefault}
                  onChange={(e) => setValues((v) => ({ ...v, isDefault: e.target.checked }))}
                />
              )}
              label="Set as default"
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>Cancel</Button>
        <Button variant="contained" startIcon={<SaveIcon />} disabled={!canSave} onClick={() => onSave(values)}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

// Plain (non-RHF) text field for the two dialogs above — they manage their
// own local state rather than a nested react-hook-form instance, so they
// can't use the RHF-bound FormTextField. Built on MUI's own TextField
// (rather than a bare <input> with hand-rolled inline styles) so it reads
// its colors/border/background from the active theme like every other
// input in the app — the old bare <input style={{ border: '1px solid
// rgba(0,0,0,0.23)' }}> was hardcoded to a light-mode border/text color and
// went unreadable in dark mode.
function FormTextFieldStandalone({ label, value, onChange, placeholder, multiline, rows, type, error, inputProps, disabled }) {
  return (
    <Box>
      <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
      <TextField
        fullWidth
        size="small"
        type={type || 'text'}
        value={value ?? ''}
        onChange={onChange}
        placeholder={placeholder}
        multiline={multiline}
        rows={multiline ? (rows || 3) : undefined}
        error={!!error}
        helperText={error || ' '}
        disabled={disabled}
        InputLabelProps={type === 'date' ? { shrink: true } : undefined}
        FormHelperTextProps={{ sx: { mx: 0, mt: 0.25, minHeight: '1.1em', lineHeight: 1.3 } }}
        inputProps={inputProps}
      />
    </Box>
  );
}

function SelectStandalone({ label, value, onChange, options = [] }) {
  return (
    <Box>
      <Typography variant="caption" fontWeight={600} sx={{ display: 'block', mb: 0.5 }}>{label}</Typography>
      <TextField
        select
        fullWidth
        size="small"
        value={value || ''}
        onChange={onChange}
        SelectProps={{ displayEmpty: true }}
      >
        <MenuItem value=""><em>Select</em></MenuItem>
        {options.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
      </TextField>
    </Box>
  );
}

// Enforces "only one default row at a time" for a useFieldArray-backed
// child grid (Contact Person / Billing Address / Shipping Address). Called
// right before the row being saved is written back into the array — if it's
// being marked default, every other row's isDefault is cleared first so the
// row just saved ends up the only one left checked, the same "one default"
// rule AddressDialog's rows already needed and ContactPersonDialog's now
// share.
function applyExclusiveDefault(fieldArray, savedIndex, values) {
  if (!values.isDefault) return;
  fieldArray.fields.forEach((row, i) => {
    if (i !== savedIndex && row.isDefault) fieldArray.update(i, { ...row, isDefault: false });
  });
}

// A single Billing (or Shipping) address is always the default, whether or
// not its own "Default" checkbox was ticked — the server enforces this on
// save too (normalizeAddressDefaults, routes/resources.js), which is the
// part that actually matters once a Sales document goes looking for this
// partner's default address. This is only the Addresses tab's own "Default"
// chip showing that same answer immediately, before the record is saved.
function withSoleRowDefault(fields) {
  if (fields.length !== 1) return fields;
  return [{ ...fields[0], isDefault: true }];
}

// Contact Person / Address child grids — a small table plus Add/Edit/Delete,
// backed by useFieldArray on the surrounding AppForm so the rows travel with
// the rest of the record on submit. Shared between the Contact Person tab and
// each of the two Addresses sections.
const BP_LIST_TABLE_ROW_HEIGHT = 0;
const BP_LIST_TABLE_CELL_PADDING_Y = 6;
const BP_LIST_TABLE_SX = {
  '& th, & td': {
    height: BP_LIST_TABLE_ROW_HEIGHT,
    paddingTop: `${BP_LIST_TABLE_CELL_PADDING_Y}px`,
    paddingBottom: `${BP_LIST_TABLE_CELL_PADDING_Y}px`,
    boxSizing: 'border-box',
  },
};

// This same button renders three different labels across the Contact
// Person tab and the Addresses tab's Billing/Shipping sections — "Add
// Contact Person", "Add Billing Address", "Add Shipping Address" — which,
// left to size itself to its own text, came out a different width in each
// place. Fixed to the widest label's natural width so all three line up
// identically regardless of which section is showing.
const CHILD_ROW_ADD_BUTTON_MIN_WIDTH = 190;

function ChildRowsTable({ rows, columns, onAdd, onEdit, onRemove, onCopy, copyLabel, isCopyDisabled, copyDisabledLabel, addLabel, emptyLabel, readOnly }) {
  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2" fontWeight={700}>{addLabel.replace('Add ', '')}s</Typography>
        {!readOnly && (
          <Button
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            onClick={onAdd}
            sx={{ minWidth: CHILD_ROW_ADD_BUTTON_MIN_WIDTH }}
          >
            {addLabel}
          </Button>
        )}
      </Stack>
      <ScrollableTableContainer>
        <Table size="small" sx={BP_LIST_TABLE_SX}>
          <TableHead>
            <TableRow>
              <TableCell width={48}>#</TableCell>
              {columns.map((c) => <TableCell key={c.field}>{c.headerName}</TableCell>)}
              <TableCell width={70}>Default</TableCell>
              {!readOnly && <TableCell align="right" width={onCopy ? 120 : 90}>Action</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + (readOnly ? 2 : 3)}>
                  <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>{emptyLabel}</Typography>
                </TableCell>
              </TableRow>
            )}
            {rows.map((row, i) => (
              <TableRow key={row.id || i} hover>
                <TableCell>{i + 1}</TableCell>
                {columns.map((c) => <TableCell key={c.field}>{row[c.field] || '—'}</TableCell>)}
                <TableCell>{row.isDefault ? <Chip size="small" label="Default" color="primary" variant="outlined" /> : '—'}</TableCell>
                {!readOnly && (
                  <TableCell align="right">
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      {onCopy && (() => {
                        const copyDisabled = isCopyDisabled ? isCopyDisabled(row) : false;
                        // A disabled IconButton eats pointer events, which
                        // would swallow the Tooltip's own hover trigger along
                        // with it -- wrapping it in a span (MUI's documented
                        // fix) keeps the "already copied" explanation visible
                        // even though the button itself can't be clicked.
                        return (
                          <Tooltip title={copyDisabled ? (copyDisabledLabel || 'Already copied') : (copyLabel || 'Copy')}>
                            <span>
                              <IconButton size="small" onClick={() => onCopy(i)} disabled={copyDisabled} aria-label="copy">
                                <ContentCopyOutlinedIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                        );
                      })()}
                      <IconButton size="small" color="primary" onClick={() => onEdit(i)} aria-label="edit"><EditIcon fontSize="small" /></IconButton>
                      <IconButton size="small" color="error" onClick={() => onRemove(i)} aria-label="delete"><DeleteIcon fontSize="small" /></IconButton>
                    </Stack>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollableTableContainer>
    </Box>
  );
}

export default function BusinessPartner() {
  // Business Partner's Currency field reads live from Currency Master
  // instead of a hardcoded list, with the extra "All" choice — see
  // lib/currencyOptions.js.
  const bpCurrencyOptions = useBpCurrencyOptions();
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  // isFetching also covers a background refetch — e.g. the list re-pulling
  // after a Save/Delete invalidates its tag — where isLoading alone stays
  // false because the previous page's rows are still cached and shown. That
  // refetch is exactly the one this page's known slow query (unindexed
  // business_partner_contacts/addresses joins — see the schema comment and
  // the matching migration) makes visible for 6-10s with no cached data to
  // fall back on the very first time, and with stale rows sitting there
  // looking "done" every time after. The thin top progress bar below covers
  // both: it shows on the very first load same as before, and now also
  // during any later refetch, instead of only ever showing once per session.
  // `view: 'list'` — Phase 2 of the data-loading performance work (pure
  // data-access, no business-logic change): this list only ever renders the
  // six columns in `tableColumns` below, so the server skips the contacts/
  // addresses/machineries include entirely for this one call site (see the
  // `?view=list` branch on the `/business-partners` route in
  // backend/src/routes/resources.js). The full record for one partner is
  // fetched separately, on demand, via `fetchPartner` below whenever a row
  // is actually opened for Edit/View — see openEditor.
  //
  // Phase 3 (server-side paging/search/sort/filter, also pure data-access) —
  // `table` below (useServerListTable) now fetches ONE page at a time via
  // `businessPartnerApi.useListPaged`, with search/sort/filter sent as query
  // params. Unlike Product Master, every column here maps to a plain DB
  // column (no live-computed value like "Stock"), so all six are marked
  // `server: true` for full parity — search, sort and every filter operate
  // over the whole table, not just the currently-loaded page. `partners`/
  // `isLoading`/`isFetching` are gone; the loaded rows live in `table.rows`/
  // `table.isLoading`/`table.isFetching`.
  // `showForm` is declared here (moved up from its original spot further
  // down, where `editingRow`/`readOnly`/`formKey`/`tab` still are) so the
  // three lookup queries just below can be gated by it — see their own
  // comment.
  const [showForm, setShowForm] = useState(false);

  const { data: salesEmployees } = salesEmployeeApi.useList(undefined, { skip: !showForm });
  const { data: accounts } = chartOfAccountApi.useList(undefined, { skip: !showForm });
  const { data: houseBanks } = houseBankApi.useList(undefined, { skip: !showForm });
  const [create, { isLoading: creating }] = businessPartnerApi.useCreate();
  const [update, { isLoading: updating }] = businessPartnerApi.useUpdate();
  const [remove] = businessPartnerApi.useDelete();
  const [fetchPartner, { isFetching: fetchingPartner }] = businessPartnerApi.useLazyGet();
  const [peekCode] = usePeekBusinessPartnerCodeMutation();
  const [uploadLogo, { isLoading: uploadingLogo }] = useUploadBusinessPartnerLogoMutation();
  const [removeLogo, { isLoading: removingLogo }] = useRemoveBusinessPartnerLogoMutation();

  const salesPersonOptions = (salesEmployees || []).map((e) => ({ label: e.employeeName, value: e.employeeName }));
  const houseBankOptions = (houseBanks || []).map((b) => ({ label: `${b.bankName} — ${b.accountName || ''}`.trim(), value: b.bankName }));
  // Payment Run's "State" field has no Country field of its own to key off,
  // so it's scoped to India's states (same default the Addresses tab's
  // country defaults to) rather than adding a new Country selector here.
  const paymentRunStateOptions = getStateOptions('India');
  // Accounting — Control Account. Only accounts flagged "Control Account"
  // (isControlAccount) in Chart of Accounts show up here, same as Customer/
  // Supplier's own Accounts Receivable picker — plus only real posting
  // accounts (not Title rows, the blue "folder" accounts in the Chart of
  // Accounts tree) that are Active.
  // label is the code alone (what the closed field shows once a value is
  // picked, per the select2-style Account Code pickers elsewhere on this
  // app — see AccountCodeDropdownPaper above); accountName rides along for
  // renderAccountCodeOption to show in the open dropdown's second column.
  const accountOptions = (accounts || [])
    .filter((a) => a.accountNature === 'A' && a.status === 'A' && a.isControlAccount)
    .map((a) => ({ label: a.accountCode, value: a.accountCode, accountName: a.accountName }));
  const accountByCode = useMemo(() => new Map((accounts || []).map((a) => [a.accountCode, a])), [accounts]);

  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [tab, setTab] = useState(0);

  // Logo — staged here (not inside the AppForm render-prop) so it survives
  // that render prop re-running on every keystroke; only committed on Save
  // (see handleSubmit) and reset whenever the form is opened or closed.
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [removeLogoRequested, setRemoveLogoRequested] = useState(false);
  const [logoError, setLogoError] = useState(null);

  const resetLogoState = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogoRequested(false);
    setLogoError(null);
  };

  const handleLogoFileSelected = (file) => {
    const validationError = validateBpLogoFile(file);
    if (validationError) {
      setLogoError(validationError);
      return;
    }
    setLogoError(null);
    setRemoveLogoRequested(false);
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleLogoRemoveClick = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoError(null);
    setRemoveLogoRequested(true);
  };

  // Column definitions drive the global search, the sort icons and the
  // filter panel — see components/data-display/useServerListTable.js. Every
  // column here is a plain DB column (see the /business-partners route's
  // BUSINESS_PARTNER_SORTABLE_FIELDS / filter handling in
  // backend/src/routes/resources.js), so all six carry `server: true` —
  // full parity, nothing left client-side-only the way Product Master's
  // "Stock" column is.
  const tableColumns = useMemo(() => ([
    { field: 'partnerCode', headerName: 'Code', filter: 'text', server: true },
    { field: 'partnerName', headerName: 'Name', filter: 'text', server: true },
    { field: 'partnerType', headerName: 'Partner Type', filter: 'select', server: true },
    { field: 'groupName', headerName: 'Group', filter: 'select', server: true },
    { field: 'mobile', headerName: 'Mobile', filter: 'text', server: true },
    { field: 'status', headerName: 'Status', filter: 'select', server: true },
  ]), []);

  const table = useServerListTable(businessPartnerApi.useListPaged, {
    columns: tableColumns,
    baseParams: { view: 'list' },
    initialPageSize: PAGE_SIZE,
  });

  const rows = table.rows;

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setTab(0);
    setFormKey((k) => k + 1);
    resetLogoState();
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRow(null);
    resetLogoState();
  };

  useEffect(() => {
    if (location.state?.openAdd) {
      openCreate();
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Master Quick Link (Settings > Developer Settings) -- a document page's
  // profile icon navigates here with { openPartnerId } in location.state
  // instead of a docNo/code string, since `id` is the one identifier every
  // partner row always has and can't collide on. Opens straight into Edit
  // (not the read-only view RouteMapDocumentPreview uses) since the intent
  // here is "take me to this record", not a look-only preview.
  //
  // Phase 3 note: this used to wait for the target id to show up in `rows`
  // (the full, unpaged list) before opening it, since `rows` was the whole
  // list. Now `rows` is only whatever one page the server just returned, so
  // that lookup would silently stop working for any partner not on the
  // first page — a real regression, not just a slower version of the same
  // behaviour. Fixed by opening the record directly via its id (openEditor/
  // handleEdit already only ever use row.id to call the unchanged, full
  // GET /business-partners/:id — see openEditor above) instead of searching
  // for it in the loaded rows first.
  useEffect(() => {
    if (!location.state?.openPartnerId) return;
    handleEdit({ id: location.state.openPartnerId });
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Edit/View open the form from the FULL partner record (contacts,
  // addresses, machineries, logo, everything), fetched on demand via
  // GET /business-partners/:id (unchanged) — not from the slim list row
  // above, which no longer carries any of that. The row from the list still
  // identifies which partner to fetch (row.id); RTK Query caches the result
  // the same way useGet always has, so reopening the same partner shortly
  // after doesn't refetch. See the `view: 'list'` comment above.
  const openEditor = async (row, ro) => {
    try {
      const full = await fetchPartner(row.id).unwrap();
      setEditingRow(full);
      setReadOnly(ro);
      setTab(0);
      setFormKey((k) => k + 1);
      resetLogoState();
      setShowForm(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      notify.error(err?.data?.message || 'Failed to load business partner details');
    }
  };

  const handleView = (row) => openEditor(row, true);

  const handleEdit = (row) => openEditor(row, false);

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete business partner',
      message: `Are you sure you want to delete "${row.partnerName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Business partner deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (rawValues, formMethods) => {
    // logoVisible travels the form as a 'Yes'/'No' string (see
    // LOGO_VISIBLE_OPTIONS / rowToFormValues above) but the backend column
    // is a real Prisma Boolean, and routes/resources.js writes the request
    // body straight through into `data` with no per-field coercion — so it
    // has to become a boolean here, at the submit boundary, or a literal
    // string 'No' would be stored (and read back truthy) instead of false.
    const values = { ...rawValues, logoVisible: rawValues.logoVisible !== 'No' };
    try {
      if (editingRow) {
        // Logo changes go through their own multipart/DELETE endpoints (OCI
        // Object Storage), so they're applied first, ahead of the plain JSON
        // update for the rest of the fields — a failed logo upload then
        // never leaves the rest of the form silently unsaved along with it.
        if (logoFile) {
          const formData = new FormData();
          formData.append('file', logoFile);
          await uploadLogo({ id: editingRow.id, formData }).unwrap();
        } else if (removeLogoRequested) {
          await removeLogo(editingRow.id).unwrap();
        }
        await update({ id: editingRow.id, ...values }).unwrap();
        notify.success('Business partner updated');
      } else {
        const created = await create(values).unwrap();
        // A logo picked on the Add form has no partner id to upload against
        // until the record exists, so it's uploaded right after creation
        // succeeds instead.
        if (logoFile) {
          const formData = new FormData();
          formData.append('file', logoFile);
          await uploadLogo({ id: created.id, formData }).unwrap();
        }
        notify.success('Business partner added');
      }
      closeForm();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  // Splits the row's flat `addresses` (addressType: 'Billing' | 'Shipping')
  // into the two arrays the form works with.
  const rowToFormValues = (row) => {
    const { addresses, isUsed, logoUrl, createdAt, updatedAt, id, ...rest } = row;
    const clean = {};
    for (const [k, v] of Object.entries(rest)) {
      clean[k] = typeof v === 'string' && v.trim().toUpperCase() === 'NULL' ? '' : (v ?? '');
    }
    return {
      ...emptyValues,
      ...clean,
      // logoVisible is a real boolean on the row (Prisma Boolean
      // @default(true)) but the FormSelect above works in 'Yes'/'No'
      // strings — convert here rather than leaving the raw boolean value
      // for FormSelect/Autocomplete to (fail to) match against its
      // string-valued options.
      logoVisible: row.logoVisible === false ? 'No' : 'Yes',
      contacts: row.contacts || [],
      billingAddresses: (addresses || []).filter((a) => a.addressType === 'Billing'),
      shippingAddresses: (addresses || []).filter((a) => a.addressType === 'Shipping'),
      machineries: row.machineries || [],
    };
  };

  return (
    <Box>

      <Collapse in={showForm} unmountOnExit>
        <Box sx={{ mb: 2 }}>
          <AppForm readOnly={readOnly}
            key={formKey}
            schema={businessPartnerSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow) : emptyValues}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              const contactsArray = useFieldArray({ control: methods.control, name: 'contacts' });
              const billingArray = useFieldArray({ control: methods.control, name: 'billingAddresses' });
              const shippingArray = useFieldArray({ control: methods.control, name: 'shippingAddresses' });
              const machineriesArray = useFieldArray({ control: methods.control, name: 'machineries' });

              const [contactDialog, setContactDialog] = useState(null); // { index } | { index: null } | null
              const [billingDialog, setBillingDialog] = useState(null);
              const [shippingDialog, setShippingDialog] = useState(null);
              const [machineryDialog, setMachineryDialog] = useState(null);

              // Picking a Control Account auto-fills Account Balance from
              // that account's own opening balance — same pattern
              // CustomerMaster uses for Accounts Receivable. Only for a
              // brand-new partner (no editingRow yet): an existing partner's
              // Account Balance is linked to its own BP Opening Balance
              // total instead the moment it has one -- see the effect right
              // below, keyed off partnerSummary once that's fetched further
              // down -- so this initial fill is just what a fresh Add form
              // shows before any opening balance of its own exists.
              const controlAccountValue = methods.watch('controlAccount');
              const prevControlAccount = useRef(editingRow ? editingRow.controlAccount : null);
              useEffect(() => {
                if (editingRow) return;
                if (controlAccountValue !== prevControlAccount.current) {
                  const account = accountByCode.get(controlAccountValue);
                  if (account) {
                    methods.setValue('accountBalance', account.openingBalance != null ? Number(account.openingBalance) : 0, { shouldValidate: true });
                  }
                  prevControlAccount.current = controlAccountValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [controlAccountValue]);

              // Code * — three modes (per the reference screenshots): Manual
              // (typed freely), Auto - Customer (C00001, C00002, ...) and
              // Auto - Supplier (S00001, S00002, ...). Switching modes on the
              // Add form clears the code and, for the two Auto modes, peeks
              // the next code for that prefix from the backend. Only runs on
              // create — an existing record's code is fixed and shown locked.
              const codeModeValue = methods.watch('codeMode');
              const prevCodeMode = useRef(null);
              useEffect(() => {
                if (editingRow) return;
                if (codeModeValue === prevCodeMode.current) return;
                prevCodeMode.current = codeModeValue;
                if (codeModeValue === 'auto-customer' || codeModeValue === 'auto-supplier') {
                  const prefix = codeModeValue === 'auto-customer' ? 'C' : 'S';
                  methods.setValue('partnerCode', '', { shouldValidate: true });
                  peekCode({ prefix }).unwrap()
                    .then((res) => methods.setValue('partnerCode', res?.code || '', { shouldValidate: true }))
                    // Show the server's own message when it has one (e.g. a
                    // permissions 403) rather than always this generic
                    // fallback — same pattern as DocumentNoField's own peek
                    // failure handling.
                    .catch((err) => notify.error(err?.data?.message || 'Could not generate code'));
                } else if (codeModeValue === 'manual') {
                  methods.setValue('partnerCode', '', { shouldValidate: true });
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [codeModeValue]);

              // Type follows Code's own mode: Auto - Customer forces Type to
              // Customer, Auto - Supplier forces it to Vendor — a code minted
              // from the Customer (or Supplier) sequence describing itself
              // as the other type would be a contradiction the rest of the
              // app can't make sense of (Control Account label above, and
              // every Customer/Vendor-filtered dropdown elsewhere, both key
              // off this same field). Manual leaves Type to the user's own
              // choice, same as it always has. Runs on the same "only on
              // create" basis as the Code-mode effect above — an existing
              // record's Type is whatever it already is, never rewritten by
              // this effect on open.
              useEffect(() => {
                if (editingRow) return;
                if (codeModeValue === 'auto-customer') {
                  methods.setValue('partnerType', 'Customer', { shouldValidate: true });
                } else if (codeModeValue === 'auto-supplier') {
                  methods.setValue('partnerType', 'Vendor', { shouldValidate: true });
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [codeModeValue]);

              // General tab's "Contact Person" auto-fills from whichever row
              // in the Contact Person tab is marked Default — same "one
              // default row" rule applyExclusiveDefault enforces on save, so
              // there's at most one name this can ever resolve to.
              //
              // Guarded so it only ever overwrites a value it set itself
              // (tracked in lastAutoContactPerson): a field left blank picks
              // up the default's name, and a field still holding a
              // previous auto-fill follows the default when it's renamed or
              // reassigned — but a name the user typed by hand, or one an
              // existing record was already saved with, is left alone. The
              // first run is skipped outright (only seeds the ref) so
              // opening an existing record never clobbers its saved value on
              // mount.
              const contactsWatch = methods.watch('contacts') || [];
              const defaultContact = contactsWatch.find((c) => c.isDefault);
              const defaultContactName = defaultContact
                ? `${defaultContact.firstName || ''} ${defaultContact.lastName || ''}`.trim()
                : '';
              const lastAutoContactPerson = useRef(null);
              const contactPersonSyncMounted = useRef(false);
              useEffect(() => {
                if (!contactPersonSyncMounted.current) {
                  contactPersonSyncMounted.current = true;
                  lastAutoContactPerson.current = defaultContactName || null;
                  return;
                }
                const current = methods.getValues('contactPerson');
                if (defaultContactName) {
                  if (!current || current === lastAutoContactPerson.current) {
                    methods.setValue('contactPerson', defaultContactName, { shouldDirty: true, shouldValidate: true });
                  }
                  lastAutoContactPerson.current = defaultContactName;
                } else if (current && current === lastAutoContactPerson.current) {
                  methods.setValue('contactPerson', '', { shouldDirty: true, shouldValidate: true });
                  lastAutoContactPerson.current = null;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [defaultContactName]);

              // Customer/Vendor (next to Code) drives the Accounting tab's
              // Control Account label — Accounts Receivable for a Customer,
              // Accounts Payable for a Vendor — same account field either way.
              const partnerTypeValue = methods.watch('partnerType');
              const controlAccountLabel = partnerTypeValue === 'Customer'
                ? 'Accounts Receivable'
                : partnerTypeValue === 'Vendor'
                  ? 'Accounts Payable'
                  : 'Control Account';

              // Payment Terms -> Credit Days: "Net 30" etc. name the credit
              // period in their own label, so picking one auto-fills Credit
              // Days with the number baked into it rather than leaving the
              // two fields free to disagree — same setValue-on-watch pattern
              // as the Control Account -> Account Balance auto-fill above.
              // "Immediate" has no digits, so it simply leaves Credit Days
              // alone rather than zeroing out a value the user may have set.
              const paymentTermsValue = methods.watch('paymentTerms');
              const prevPaymentTerms = useRef(editingRow ? editingRow.paymentTerms : null);
              useEffect(() => {
                if (paymentTermsValue !== prevPaymentTerms.current) {
                  const match = /\d+/.exec(paymentTermsValue || '');
                  if (match) methods.setValue('creditDays', Number(match[0]), { shouldValidate: true });
                  prevPaymentTerms.current = paymentTermsValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [paymentTermsValue]);

              // Payment Run — a Cash partner has no bank to pay through, so
              // House Bank/Bank Account No/IFSC Code/Branch are disabled
              // (not cleared) whenever Payment Method is Cash, the same
              // disabled={...} pattern the Code field's Auto modes use above.
              const paymentMethodValue = methods.watch('paymentMethod');
              const bankFieldsDisabled = paymentMethodValue === 'Cash';

              // Deliveries/Orders (Customer) or Goods Receipt POs/Purchase
              // Orders (Vendor) shown below Account Balance —
              // real totals aggregated from the partner's documents, keyed
              // by partner code so a not-yet-saved partner (no code) skips
              // the request entirely.
              const summaryCode = editingRow ? editingRow.partnerCode : null;
              const { data: partnerSummary } = useGetBusinessPartnerSummaryQuery(summaryCode, { skip: !summaryCode });
              const formatSummaryAmount = (value) => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

              // Account Balance now tracks THIS partner's own Sales Invoice
              // total (Customer) or Purchase Invoice total (Vendor) instead
              // of its BP Opening Balance total -- the view icon next to the
              // field (below) opens the same invoice list this number is
              // summed from, via GET /business-partners/:code/invoices; the
              // aggregate itself comes from /summary's salesInvoices /
              // purchaseInvoices (see that route's own comment). Re-syncs
              // every time this number changes -- reopening this partner
              // after a new or edited invoice referencing them picks up the
              // new total automatically, same as the openingBalance-keyed
              // effect this replaced.
              const invoiceTotalKey = partnerTypeValue === 'Vendor' ? 'purchaseInvoices' : 'salesInvoices';
              // Account Balance = BP Opening Balance total (summed server-side
              // across every BP Opening line under this partner code) + the
              // Sales/Purchase Invoice total. The summary route always returned
              // openingBalance, but this field only read the invoice total, so a
              // partner with an opening balance and no invoices showed 0.
              const invoiceTotal = partnerSummary?.[invoiceTotalKey];
              const bpOpeningTotal = partnerSummary?.openingBalance;
              const accountBalanceTotal = partnerSummary
                ? Math.round(((Number(invoiceTotal) || 0) + (Number(bpOpeningTotal) || 0)) * 100) / 100
                : null;
              useEffect(() => {
                if (!editingRow || accountBalanceTotal == null) return;
                methods.setValue('accountBalance', accountBalanceTotal, { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [accountBalanceTotal]);

              // View icon next to Account Balance — opens
              // BusinessPartnerInvoicesDialog over the same Sales/Purchase
              // Invoice list accountBalance above is summed from. No code
              // yet (a not-yet-saved partner) means nothing to look up, so
              // the icon is disabled rather than hidden -- keeps the field's
              // layout stable between Add and Edit/View.
              const [invoicesDialogOpen, setInvoicesDialogOpen] = useState(false);

              // View icons on the Deliveries/Orders/Purchase Orders/Goods
              // Receipt POs tiles below — one dialog reused for all four,
              // just re-targeted at whichever tile's icon was clicked (see
              // BusinessPartnerDocumentDialog above).
              const [documentDialog, setDocumentDialog] = useState(null); // { type, title } | null

              return (
                <>
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {readOnly ? 'View Business Partner' : editingRow ? 'Edit Business Partner' : 'Add Business Partner'}
                        </Typography>
                        <Button variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={closeForm}>
                          Close
                        </Button>
                      </Stack>

                      <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                        <LabeledField label="Code *">
                          {editingRow ? (
                            <FormTextField name="partnerCode" label="" placeholder="Code" disabled />
                          ) : (
                            // <Stack direction="row" spacing={1} sx={{ width: '100%' }}>
                            //   <Box sx={{ width: { xs: 120, sm: 135 }, flexShrink: 0 }}>
                            //     <FormSelect name="codeMode" label="" options={PARTNER_CODE_MODE_OPTIONS} />
                            //   </Box>
                            //   <Box sx={{ flex: 1, minWidth: 0 }}>
                            //     <FormTextField
                            //       name="partnerCode"
                            //       label=""
                            //       placeholder="Code"
                            //       disabled={codeModeValue !== 'manual'}
                            //     />
                            //   </Box>
                            // </Stack>
                            <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
                              <Box sx={{ flex: '1 1 50%', minWidth: 0 }}>
                                <FormSelect name="codeMode" label="" options={PARTNER_CODE_MODE_OPTIONS} />
                              </Box>
                              <Box sx={{ flex: '1 1 50%', minWidth: 0 }}>
                                <FormTextField
                                  name="partnerCode"
                                  label=""
                                  placeholder="Code"
                                  disabled={codeModeValue !== 'manual'}
                                />
                              </Box>
                            </Box>
                          )}
                        </LabeledField>
                        <LabeledField label="Company Name *">
                          <FormTextField name="partnerName" label="" placeholder="Enter name" />
                        </LabeledField>

                        <LabeledField label="Type *">
                          {/* Non-editable except under Manual code mode — see
                          the codeMode-driven effect above. On an existing
                          record (editingRow set, no live codeModeValue to key
                          off) this falls back to editable, matching every
                          other field on the form that isn't otherwise locked. */}
                          <FormSelect
                            name="partnerType" label="" placeholder="Select type" options={PARTNER_TYPE_OPTIONS}
                            disabled={!editingRow && codeModeValue !== 'manual'}
                          />
                        </LabeledField>
                        <LabeledField label="Foreign Name">
                          <FormTextField name="foreignName" label="" placeholder="Enter foreign name" />
                        </LabeledField>

                        <LabeledField label="Group *">
                          <FormSelect name="groupName" label="" placeholder="Select group" options={PARTNER_GROUP_OPTIONS} />
                        </LabeledField>
                        <LabeledField label="Currency *">
                          <FormSelect name="currency" label="" placeholder="Select currency" options={bpCurrencyOptions} />
                        </LabeledField>

                        <LabeledField label="Account Balance (₹)">
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%' }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <FormTextField
                                name="accountBalance"
                                label=""
                                type="number"
                                placeholder="0.00"
                                disabled
                              />
                            </Box>
                            <Tooltip title={summaryCode ? `View ${partnerTypeValue === 'Vendor' ? 'Purchase' : 'Sales'} Invoices` : 'Save this partner first'}>
                              <span>
                                {/* component="span" -- FormGrid renders every field inside a native
            <fieldset disabled={readOnly}> (see FormGrid's own comment), and
            a disabled fieldset force-disables every "listed" form control
            beneath it -- button included -- with no way for a descendant to
            opt back out. This button has to keep working in View mode (the
            whole point is looking something up, not editing), so it's
            rendered as a <span> instead of a <button>: spans aren't a
            listed/form-associated element, so the fieldset's disabled
            attribute doesn't touch it, while our own disabled={!summaryCode}
            below (a brand-new, not-yet-saved partner has no code to look up)
            still applies exactly as before via MUI's own ButtonBase styling
            rather than the native HTML attribute. */}
                                <IconButton
                                  component="span"
                                  size="small"
                                  disabled={!summaryCode}
                                  onClick={() => setInvoicesDialogOpen(true)}
                                >
                                  <VisibilityOutlinedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Box>
                        </LabeledField>

                        {partnerTypeValue === 'Customer' && (
                          <Stack spacing={1}>
                            <SummaryAmountField
                              label="Deliveries"
                              value={formatSummaryAmount(partnerSummary?.deliveries)}
                              onView={() => setDocumentDialog({ type: 'deliveries', title: 'Deliveries' })}
                              viewDisabled={!summaryCode}
                            />
                            <SummaryAmountField
                              label="Orders"
                              value={formatSummaryAmount(partnerSummary?.orders)}
                              onView={() => setDocumentDialog({ type: 'orders', title: 'Orders' })}
                              viewDisabled={!summaryCode}
                            />
                          </Stack>
                        )}

                        {partnerTypeValue === 'Vendor' && (
                          <Stack spacing={1}>
                            <SummaryAmountField
                              label="Purchase Orders"
                              value={formatSummaryAmount(partnerSummary?.purchaseOrders)}
                              onView={() => setDocumentDialog({ type: 'purchaseOrders', title: 'Purchase Orders' })}
                              viewDisabled={!summaryCode}
                            />
                            <SummaryAmountField
                              label="Goods Receipt POs"
                              value={formatSummaryAmount(partnerSummary?.goodsReceiptPOs)}
                              onView={() => setDocumentDialog({ type: 'goodsReceiptPOs', title: 'Goods Receipt POs' })}
                              viewDisabled={!summaryCode}
                            />
                          </Stack>
                        )}

                        {/* Logo - LEFT COLUMN */}
                        <Box sx={{ mt: -4 }}>
                          <LabeledField label="Logo" align="center">
                            <BusinessPartnerLogoField
                              currentLogoUrl={editingRow?.logoUrl}
                              editing={!readOnly}
                              logoFile={logoFile}
                              previewUrl={logoPreview}
                              removeRequested={removeLogoRequested}
                              onFileSelected={handleLogoFileSelected}
                              onRemove={handleLogoRemoveClick}
                              error={logoError}
                            />
                          </LabeledField>
                        </Box>

                        <Box sx={{ mt: 1 }}>
                          <LabeledField label="Logo Visibility">
                            <FormSelect
                              name="logoVisible"
                              label=""
                              options={LOGO_VISIBLE_OPTIONS}
                            />
                          </LabeledField>
                        </Box>

                      </FormGrid>

                      {/* Left column - Logo below Account Balance */}


                      <Tabs
                        value={tab}
                        onChange={(_e, v) => setTab(v)}
                        variant="scrollable"
                        scrollButtons="auto"
                        sx={{ mt: 2, borderBottom: 1, borderColor: 'divider' }}
                      >
                        {TAB_LABELS.map((label) => <Tab key={label} label={label} />)}
                      </Tabs>

                      <Box sx={{ pt: 3 }}>
                        {tab === 0 && (
                          <FormGrid columns={2} singleColumnOnMobile spacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                            <LabeledField label="Telephone">
                              <FormTextField name="telephone" label="" placeholder="Enter telephone" />
                            </LabeledField>
                            <LabeledField label="Mobile">
                              <FormTextField name="mobile" label="" placeholder="Enter mobile" digitsOnly maxLength={10} />
                            </LabeledField>

                            <LabeledField label="Email">
                              <FormTextField name="email" label="" placeholder="Enter email" />
                            </LabeledField>

                            <LabeledField label="Website">
                              <FormTextField name="website" label="" placeholder="Enter website" />
                            </LabeledField>
                            <LabeledField label="Shipping type">
                              <FormSelect name="shippingType" label="" placeholder="Select shipping type" options={SHIPPING_TYPE_OPTIONS} />
                            </LabeledField>

                            <LabeledField label="Industry">
                              <FormSelect name="industry" label="" placeholder="Select industry" options={INDUSTRY_OPTIONS} />
                            </LabeledField>
                            <LabeledField label="Business Partner Type">
                              <FormSelect name="businessPartnerType" label="" placeholder="Select type" options={BUSINESS_PARTNER_TYPE_OPTIONS} />
                            </LabeledField>

                            <LabeledField label="Contact Person">
                              <FormTextField name="contactPerson" label="" placeholder="Enter contact person" disabled />
                            </LabeledField>
                            <LabeledField label="Sales Employee">
                              <FormSelect name="salesPerson" label="" placeholder="Select sales employee" options={salesPersonOptions} />
                            </LabeledField>

                            <LabeledField label="Status *">
                              <FormSelect
                                name="status"
                                label=""
                                options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                              />
                            </LabeledField>
                          </FormGrid>
                        )}
                        {tab === 0 && (
                          <Grid container spacing={2} sx={{ mt: -2 }}>
                            <Grid item xs={15}>
                              <LabeledField label="Remarks">
                                <FormTextField name="remarks" label="" placeholder="Enter remarks" multiline rows={4} />
                              </LabeledField>
                            </Grid>
                          </Grid>
                        )}

                        {tab === 1 && (
                          <>
                            <ChildRowsTable
                              rows={contactsArray.fields}
                              columns={[
                                { field: 'contactId', headerName: 'Contact Id' },
                                { field: 'firstName', headerName: 'First Name' },
                                { field: 'lastName', headerName: 'Last Name' },
                                { field: 'email', headerName: 'Email' },
                              ]}
                              addLabel="Add Contact Person"
                              emptyLabel="No contact persons added"
                              readOnly={readOnly}
                              onAdd={() => setContactDialog({ index: null })}
                              onEdit={(i) => setContactDialog({ index: i })}
                              onRemove={(i) => contactsArray.remove(i)}
                            />
                            <ContactPersonDialog
                              open={!!contactDialog}
                              initialValue={contactDialog && contactDialog.index != null ? contactsArray.fields[contactDialog.index] : null}
                              onClose={() => setContactDialog(null)}
                              onSave={(values) => {
                                const savedIndex = contactDialog.index != null ? contactDialog.index : contactsArray.fields.length;
                                applyExclusiveDefault(contactsArray, savedIndex, values);
                                if (contactDialog.index != null) contactsArray.update(contactDialog.index, values);
                                else contactsArray.append(values);
                                setContactDialog(null);
                              }}
                            />
                          </>
                        )}

                        {tab === 2 && (
                          <Stack spacing={4}>
                            <Box>
                              <ChildRowsTable
                                rows={withSoleRowDefault(billingArray.fields)}
                                columns={[
                                  { field: 'addressName', headerName: 'Address Name' },
                                  { field: 'city', headerName: 'City' },
                                  { field: 'gstNumber', headerName: 'GST Number' },
                                  { field: 'panNo', headerName: 'PAN Number' },
                                ]}
                                addLabel="Add Billing Address"
                                emptyLabel="No billing addresses added"
                                readOnly={readOnly}
                                onAdd={() => setBillingDialog({ index: null })}
                                onEdit={(i) => setBillingDialog({ index: i })}
                                onRemove={(i) => billingArray.remove(i)}
                                copyLabel="Copy to Shipping Address"
                                copyDisabledLabel="Already copied to Shipping Address"
                                isCopyDisabled={(row) => !!row._copiedToShipping}
                                onCopy={(i) => {
                                  const source = billingArray.fields[i];
                                  if (source._copiedToShipping) return; // icon is disabled too, but guard the click regardless
                                  // Duplicate this billing row into Shipping
                                  // Addresses -- `id` is react-hook-form's own
                                  // field-array key and must not travel along
                                  // with the copy, or the new row would share
                                  // its key with the row it came from.
                                  // `_copiedToShipping` is this component's
                                  // own bookkeeping, not an address field, so
                                  // it's dropped from the copy itself -- only
                                  // the SOURCE billing row gets flagged, one
                                  // shipping copy per billing row.
                                  const { id, _copiedToShipping, ...row } = source;
                                  const copy = { ...row };
                                  if (copy.isDefault) applyExclusiveDefault(shippingArray, shippingArray.fields.length, copy);
                                  shippingArray.append(copy);
                                  billingArray.update(i, { ...source, _copiedToShipping: true });
                                  notify.success('Copied to Shipping Address');
                                }}
                              />
                              <AddressDialog
                                open={!!billingDialog}
                                title={billingDialog && billingDialog.index != null ? 'Edit Billing Address' : 'Add Billing Address'}
                                initialValue={billingDialog && billingDialog.index != null ? billingArray.fields[billingDialog.index] : null}
                                onClose={() => setBillingDialog(null)}
                                onSave={(values) => {
                                  const savedIndex = billingDialog.index != null ? billingDialog.index : billingArray.fields.length;
                                  applyExclusiveDefault(billingArray, savedIndex, values);
                                  if (billingDialog.index != null) billingArray.update(billingDialog.index, values);
                                  else billingArray.append(values);
                                  setBillingDialog(null);
                                }}
                              />
                            </Box>
                            <Box>
                              <ChildRowsTable
                                rows={withSoleRowDefault(shippingArray.fields)}
                                columns={[
                                  { field: 'addressName', headerName: 'Address Name' },
                                  { field: 'city', headerName: 'City' },
                                  { field: 'gstNumber', headerName: 'GST Number' },
                                  { field: 'panNo', headerName: 'PAN Number' },
                                ]}
                                addLabel="Add Shipping Address"
                                emptyLabel="No shipping addresses added"
                                readOnly={readOnly}
                                onAdd={() => setShippingDialog({ index: null })}
                                onEdit={(i) => setShippingDialog({ index: i })}
                                onRemove={(i) => shippingArray.remove(i)}
                              />
                              <AddressDialog
                                open={!!shippingDialog}
                                title={shippingDialog && shippingDialog.index != null ? 'Edit Shipping Address' : 'Add Shipping Address'}
                                initialValue={shippingDialog && shippingDialog.index != null ? shippingArray.fields[shippingDialog.index] : null}
                                onClose={() => setShippingDialog(null)}
                                onSave={(values) => {
                                  const savedIndex = shippingDialog.index != null ? shippingDialog.index : shippingArray.fields.length;
                                  applyExclusiveDefault(shippingArray, savedIndex, values);
                                  if (shippingDialog.index != null) shippingArray.update(shippingDialog.index, values);
                                  else shippingArray.append(values);
                                  setShippingDialog(null);
                                }}
                              />
                            </Box>
                          </Stack>
                        )}

                        {tab === 3 && (
                          <FormGrid columns={2} singleColumnOnMobile spacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                            <LabeledField label="Payment Terms">
                              <FormSelect name="paymentTerms" label="" placeholder="Select payment terms" options={PAYMENT_TERMS_OPTIONS} />
                            </LabeledField>
                            <LabeledField label="Credit Days">
                              <FormTextField name="creditDays" label="" type="number" placeholder="0" />
                            </LabeledField>

                            <LabeledField label="Credit Limit (₹)">
                              <FormTextField name="creditLimit" label="" type="number" placeholder="0.00" />
                            </LabeledField>
                          </FormGrid>
                        )}

                        {tab === 4 && (
                          <FormGrid columns={2} singleColumnOnMobile spacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                            <LabeledField label="Payment Method">
                              <FormSelect name="paymentMethod" label="" placeholder="Select payment method" options={PAYMENT_METHOD_OPTIONS} />
                            </LabeledField>
                            <LabeledField label="Priority">
                              <FormSelect name="paymentPriority" label="" placeholder="Select priority" options={PAYMENT_PRIORITY_OPTIONS} />
                            </LabeledField>

                            <LabeledField label="House Bank">
                              <FormSelect name="houseBank" label="" placeholder="Select house bank" options={houseBankOptions} disabled={bankFieldsDisabled} />
                            </LabeledField>
                            <LabeledField label="Bank Account No">
                              <FormTextField name="bankAccountNo" label="" placeholder="Enter account number" disabled={bankFieldsDisabled} />
                            </LabeledField>

                            <LabeledField label="IFSC Code">
                              <FormTextField name="ifscCode" label="" placeholder="e.g. SBIN0001234" disabled={bankFieldsDisabled} />
                            </LabeledField>
                            <LabeledField label="Branch">
                              <FormTextField name="branch" label="" placeholder="Enter branch" disabled={bankFieldsDisabled} />
                            </LabeledField>
                            <LabeledField label="State">
                              <FormSelect name="state" label="" placeholder="Select state" options={paymentRunStateOptions} disabled={bankFieldsDisabled} />
                            </LabeledField>

                            <LabeledField label="Block Payment" align="center">
                              <FormCheckbox name="blockPayment" label="" />
                            </LabeledField>
                          </FormGrid>
                        )}

                        {tab === 5 && (
                          <FormGrid columns={2} singleColumnOnMobile spacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                            <LabeledField label={controlAccountLabel}>
                              <FormSelect
                                name="controlAccount"
                                label=""
                                placeholder="Select account"
                                options={accountOptions}
                                // select2-style dropdown: a Code/Name header row
                                // (AccountCodeDropdownPaper) above two-column
                                // option rows (renderAccountCodeOption), widened
                                // past the field itself so both columns are
                                // legible — same as WarehouseMaster's and
                                // GLAccountDeterminationForm's Accounting tabs.
                                // Picking a row still just writes the account
                                // code to this field; only the closed field
                                // (code alone) and the open dropdown differ.
                                PaperComponent={AccountCodeDropdownPaper}
                                renderOption={renderAccountCodeOption}
                                componentsProps={{ popper: { style: { width: ACCOUNT_CODE_DROPDOWN_WIDTH } } }}
                              />
                            </LabeledField>
                          </FormGrid>
                        )}

                        {tab === 6 && (
                          <>
                            <ChildRowsTable
                              rows={machineriesArray.fields}
                              columns={[
                                { field: 'itemCode', headerName: 'Machine Serial No' },
                                { field: 'itemName', headerName: 'Machine Model' },
                              ]}
                              addLabel="Add Machinery"
                              emptyLabel="No machineries added"
                              readOnly={readOnly}
                              onAdd={() => setMachineryDialog({ index: null })}
                              onEdit={(i) => setMachineryDialog({ index: i })}
                              onRemove={(i) => machineriesArray.remove(i)}
                            />
                            <MachineryDialog
                              open={!!machineryDialog}
                              initialValue={machineryDialog && machineryDialog.index != null ? machineriesArray.fields[machineryDialog.index] : null}
                              onClose={() => setMachineryDialog(null)}
                              onSave={(values) => {
                                if (machineryDialog.index != null) machineriesArray.update(machineryDialog.index, values);
                                else machineriesArray.append(values);
                                setMachineryDialog(null);
                              }}
                            />
                          </>
                        )}

                        {tab === 7 && (
                          <Grid container spacing={2}>
                            <Grid item xs={12}>
                              <LabeledField label="Remarks">
                                <FormTextField name="remarks" label="" placeholder="Enter remarks" multiline rows={6} />
                              </LabeledField>
                            </Grid>
                          </Grid>
                        )}

                        {tab === 8 && (
                          <Typography variant="body2" color="text.secondary">
                            File attachments are not supported yet — this tab is reserved for a future upload feature.
                          </Typography>
                        )}
                      </Box>

                      <Stack direction="row" spacing={1.5} justifyContent="flex-end" sx={{ mt: 3 }}>
                        <Button variant="outlined" color={readOnly ? 'error' : 'inherit'} startIcon={<CloseIcon />} onClick={closeForm} disabled={creating || updating || uploadingLogo || removingLogo}>
                          {readOnly ? 'Close' : 'Cancel'}
                        </Button>
                        <FormSubmitButton startIcon={<SaveIcon />} disabled={creating || updating || uploadingLogo || removingLogo}>
                          {readOnly ? 'View' : editingRow ? 'Update Business Partner' : 'Save Business Partner'}
                        </FormSubmitButton>
                      </Stack>
                    </CardContent>
                  </Card>

                  <BusinessPartnerInvoicesDialog
                    open={invoicesDialogOpen}
                    onClose={() => setInvoicesDialogOpen(false)}
                    partnerType={partnerTypeValue}
                    code={summaryCode}
                  />

                  <BusinessPartnerDocumentDialog
                    open={!!documentDialog}
                    onClose={() => setDocumentDialog(null)}
                    code={summaryCode}
                    type={documentDialog?.type}
                    title={documentDialog?.title}
                  />
                </>
              );
            }}
          </AppForm>
        </Box>
      </Collapse>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Business Partner List</Typography>
            <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
              <TableSearchFilter table={table} placeholder="Search by code, name, email or mobile..." width={260} />
              <CanAdd>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                  Add Business Partner
                </Button>
              </CanAdd>
            </Stack>

            <TableFilterPanel table={table} />
          </Stack>

          {/* Thin progress bar under the header, visible for isFetching (not
              just isLoading) — so a re-fetch after Save/Delete invalidates
              the list shows something even though the previous rows are
              still on screen and isLoading itself stays false throughout.
              Reserved height (not conditionally rendered) so the header row
              doesn't jump down by 2px every time this appears/disappears. */}
          <Box sx={{ height: 2 }}>
            {table.isFetching && <LinearProgress sx={{ height: 2 }} />}
          </Box>

          {isMobile ? (
            <Box sx={{ px: 2, pb: 1 }}>
              {table.isLoading && <LoadingState label="Loading business partners…" />}
              {!table.isLoading && rows.map((row) => (
                <MobileRecordCard
                  key={row.id}
                  title={row.partnerName}
                  statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                  fields={[
                    { label: 'Code', value: row.partnerCode },
                    { label: 'Partner Type', value: row.partnerType || '—' },
                    { label: 'Group', value: row.groupName || '—' },
                    { label: 'Mobile', value: row.mobile || '—' },
                  ]}
                  onView={() => handleView(row)}
                  onEdit={() => handleEdit(row)}
                  onDelete={() => handleDelete(row)}
                  deleteDisabled={row.isUsed}
                  deleteDisabledReason="Already used on a document — set Status to Inactive instead."
                />
              ))}
              {!table.isLoading && rows.length === 0 && (
                <EmptyState
                  icon={<PeopleOutlineIcon sx={{ fontSize: 48 }} />}
                  title={table.isFiltering ? 'No matches' : 'No business partners yet'}
                  message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first business partner to get started'}
                  action={!table.isFiltering && (
                    <CanAdd>
                      <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Business Partner</Button>
                    </CanAdd>
                  )}
                />
              )}
            </Box>
          ) : (
            <ScrollableTableContainer>
              <Table size="small" stickyHeader sx={BP_LIST_TABLE_SX}>
                <TableHead>
                  <TableRow>
                    <TableCell width={48}>#</TableCell>
                    <SortableHeaderCell field="partnerCode" sort={table.sort} onSort={table.toggleSort}>Code</SortableHeaderCell>
                    <SortableHeaderCell field="partnerName" sort={table.sort} onSort={table.toggleSort}>Name</SortableHeaderCell>
                    <SortableHeaderCell field="partnerType" sort={table.sort} onSort={table.toggleSort}>Partner Type</SortableHeaderCell>
                    <SortableHeaderCell field="groupName" sort={table.sort} onSort={table.toggleSort}>Group</SortableHeaderCell>
                    <SortableHeaderCell field="mobile" sort={table.sort} onSort={table.toggleSort}>Mobile</SortableHeaderCell>
                    <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                    <TableCell align="right">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {table.isLoading && <TableSkeleton columns={8} rows={table.pageSize > 8 ? 8 : table.pageSize} />}
                  {!table.isLoading && rows.map((row, i) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{table.page * table.pageSize + i + 1}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.partnerCode}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.partnerName}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.partnerType || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.groupName || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.mobile || '—'}</TableCell>
                      <TableCell>
                        <Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <IconButton size="small" onClick={() => handleView(row)} aria-label="view" disabled={fetchingPartner}>
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                          <CanEdit>
                            <IconButton size="small" color="primary" onClick={() => handleEdit(row)} aria-label="edit" disabled={fetchingPartner}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </CanEdit>
                          <CanDelete>
                            {row.isUsed ? (
                              <Tooltip title="Already used on a document — set Status to Inactive instead.">
                                <span>
                                  <IconButton size="small" color="error" disabled aria-label="delete">
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                            ) : (
                              <IconButton size="small" color="error" onClick={() => handleDelete(row)} aria-label="delete">
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            )}
                          </CanDelete>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!table.isLoading && rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} sx={{ border: 'none' }}>
                        <EmptyState
                          icon={<PeopleOutlineIcon sx={{ fontSize: 48 }} />}
                          title={table.isFiltering ? 'No matches' : 'No business partners yet'}
                          message={table.isFiltering ? 'Try adjusting your search or filters' : 'Add your first business partner to get started'}
                          action={!table.isFiltering && (
                            <CanAdd>
                              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add Business Partner</Button>
                            </CanAdd>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
          )}

          <EntityListPagination total={table.total} page={table.page} onChange={table.setPage} pageSize={table.pageSize} onPageSizeChange={(v) => { table.setPageSize(v); table.setPage(0); }} />
        </CardContent>
      </Card>
    </Box>
  );
}
