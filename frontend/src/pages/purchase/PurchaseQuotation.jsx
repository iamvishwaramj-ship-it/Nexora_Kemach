import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cleanAddressText } from '../../lib/addressFormat';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, TextField, InputAdornment, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, IconButton, Menu, MenuItem,
  ListItemIcon, ListItemText, Checkbox, Autocomplete, Popover, Grid, Tooltip,
  Collapse, CircularProgress,
} from '@mui/material';
import { useFieldArray } from 'react-hook-form';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import usePriceListRates from '../../hooks/usePriceListRates';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EventIcon from '@mui/icons-material/Event';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../components/form/PartyCodeSelect';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import CopyToButton from '../../components/common/CopyToButton';
import FormDatePicker from '../../components/form/FormDatePicker';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import FilterAutocomplete from '../../components/data-display/FilterAutocomplete';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import MobileItemCard from '../../components/data-display/MobileItemCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import useDragScroll from '../../components/data-display/useDragScroll';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { purchaseQuotationSchema, QUOTATION_STATUS_OPTIONS } from '../../lib/validation/purchaseSchemas';
import { useWarehouseOptions, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { buildDocument, round2, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { SUPPLIER_PAYMENT_TERMS_OPTIONS } from '../../lib/validation/partnerSchemas';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { purchaseQuotationApi, supplierApi, productApi, branchApi, taxCodeApi, salesEmployeeApi } from '../../features/resources';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { buildTaxCodeOptions, taxTypeFamilyFor, buildTaxCodeIdByRate, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { itemTableSx } from '../../lib/columnWidth';
import { useGetCompanyDetailsQuery, usePeekDocumentNumberMutation } from '../../features/company/companyDetailsApi';
import { branchAddressLines } from '../../lib/branchAddress';
import PurchaseQuotationPrintable, { printPurchaseQuotation } from '../../components/print/PurchaseQuotationPrintable';
import { peekNextDocumentNumber } from '../../components/form/DocumentNoField';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
import { canDelete } from '../../config/deleteConfig';
import { canDuplicate } from '../../config/duplicateConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
const emptyItem = { productCode: '', productName: '', description: '', hsnCode: '', uom: '', quantity: 1, unitPrice: 0, taxPercent: 18, taxCodeId: null, warehouse: '' };

function getEmptyValues(preparedBy, defaultTaxCode) {
  return {
    quotationNo: '', seriesId: '', branch: '', supplier: '', contactPerson: '', phone: '', email: '',
    // Valid Upto defaults to 10 days out from today, same rule as every
    // other "valid till" field (Sales Quotation's Valid Till included) —
    // computed here (inside the function, not a module-level constant) so
    // each new quotation gets it relative to the day it's actually created.
    quotationDate: new Date(), validUpto: dayjs().add(10, 'day').toDate(), referenceNo: '',
    currency: 'INR', paymentTerms: '', deliveryDate: null, shipTo: '', supplierState: '',
    termsConditions: '', attachmentName: '', discountPercent: 0, status: 'Open',
    preparedBy: preparedBy || '', approvedBy: '',
    // Freight Charges — see FreightChargesEditor. freightGrossAmount is kept
    // in sync live by that component. Road Tax Amount has been removed from
    // Purchase documents' UI/print and no longer feeds the grand total.
    freightTransportId: null, freightName: '', freightRemarks: '', freightTaxCodeId: null,
    freightTaxAmount: 0, freightNetAmount: 0, freightGrossAmount: 0,
    items: [withDefaultTaxCode({ ...emptyItem }, defaultTaxCode)],
  };
}

// Totals come from the shared engine in lib/documentTotals.js, which the
// backend mirrors exactly — the figures shown here while editing are the
// figures that get saved. Each page used to carry its own copy of this
// arithmetic and the copies had drifted apart; this document in particular
// used to hard-code CGST and SGST at 9% each regardless of what the goods
// actually attract.
//
// `grandTotal` and `discount` are kept in the returned shape because the
// totals panel below reads those names.
// `interState` must be passed through rather than defaulted: the server
// decides CGST/SGST vs IGST by comparing this document's Place of Supply
// against the company's registered state, and for a long time no page passed
// the flag at all — so an inter-state document displayed a CGST/SGST split
// while the record it saved held IGST.
//
function computeTotals(items, discountPercent, interState = false, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    interState,
    roundOff: true,
    freightAmount: extraCharges.freightNetAmount,
  });
  const freightGrossAmount = computeFreightGross(extraCharges.freightNetAmount, extraCharges.freightTaxAmount);
  return {
    ...totals,
    discount: computeItemDiscountTotal(items),
    freightGrossAmount,
    grandTotal: round2(totals.amount + (Number(extraCharges.freightTaxAmount) || 0)),
  };
}

function rowToFormValues(row, taxCodes) {
  const taxCodeIdByRate = buildTaxCodeIdByRate(taxCodes);
  return {
    quotationNo: row.quotationNo, seriesId: '', branch: row.branch || '', supplier: row.supplier || '', contactPerson: row.contactPerson || '',
    phone: row.phone || '', email: row.email || '',
    quotationDate: row.quotationDate, validUpto: row.validUpto, referenceNo: row.referenceNo || '',
    currency: row.currency || 'INR', paymentTerms: row.paymentTerms || '', deliveryDate: row.deliveryDate,
    shipTo: cleanAddressText(row.shipTo), supplierState: row.supplierState || '', termsConditions: row.termsConditions || '', attachmentName: row.attachmentName || '',
    discountPercent: row.discountPercent != null ? Number(row.discountPercent) : 0, status: row.status || 'Open',
    preparedBy: row.preparedBy || '', approvedBy: row.approvedBy || '',
    freightTransportId: row.freightTransportId != null ? Number(row.freightTransportId) : null,
    freightName: row.freightName || '', freightRemarks: row.freightRemarks || '',
    freightTaxCodeId: row.freightTaxCodeId != null ? Number(row.freightTaxCodeId) : null,
    freightTaxAmount: row.freightTaxAmount != null ? Number(row.freightTaxAmount) : 0,
    freightNetAmount: row.freightNetAmount != null ? Number(row.freightNetAmount) : 0,
    freightGrossAmount: row.freightGrossAmount != null ? Number(row.freightGrossAmount) : 0,
    items: (row.items && row.items.length ? row.items : [{ ...emptyItem }]).map((i) => ({
      productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
      hsnCode: i.hsnCode || '', uom: i.uom || '',
      quantity: i.quantity != null ? Number(i.quantity) : 1,
      unitPrice: i.unitPrice != null ? Number(i.unitPrice) : 0,
      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
      taxCodeId: i.taxCodeId != null
        ? Number(i.taxCodeId)
        : (taxCodeIdByRate.get(i.taxPercent != null ? Number(i.taxPercent) : 18) ?? null),
      // No header warehouse exists on this document to fall back to — a row
      // saved before this field existed simply reopens blank.
      warehouse: i.warehouse || '',
    })),
  };
}

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', ...QUOTATION_STATUS_OPTIONS];
const VALID_UPTO_FILTERS = ['All', 'Valid', 'Expired'];

// Open (not yet ordered against) amber, Closed (an order was raised) green.
// Set by the server — see recomputePurchaseQuotationStatus in backend
// utils/documentFlow.js — so there is no status control on the form.
const STATUS_COLORS = { Open: 'warning', Closed: 'success', Cancelled: 'error' };

const PURCHASE_QUOTATION_LIST_TABLE_ROW_HEIGHT = 0;
const PURCHASE_QUOTATION_LIST_TABLE_CELL_PADDING_Y = 6;
export default function PurchaseQuotation({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  // Every currency dropdown reads live from Currency Master instead of a
  // hardcoded list — see lib/currencyOptions.js.
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: quotations, isLoading, refetch: refetchQuotations } = purchaseQuotationApi.useList();
  const { data: suppliers } = supplierApi.useList();
  const { data: products } = productApi.useList({ view: 'picker' });
  const { rates: priceListRates } = usePriceListRates('DLP');
  const { data: branches } = branchApi.useList();
  const { data: taxCodes } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  const { data: salesEmployees } = salesEmployeeApi.useList();
  // Tax (%) is now a Tax Code CFL: every active Tax Code master entry gets
  // its own option (never collapsed by rate — see buildTaxCodeOptions),
  // keyed by taxCodeId (not the rate), so two Tax Codes that happen to
  // share a rate both still show up in the dropdown.
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  const { data: company } = useGetCompanyDetailsQuery();
  const [create, { isLoading: creating }] = purchaseQuotationApi.useCreate();
  const [update, { isLoading: updating }] = purchaseQuotationApi.useUpdate();
  const [remove] = purchaseQuotationApi.useDelete();
  const [cancelQuotation] = purchaseQuotationApi.useCancel();
  const [peekDocumentNumber] = usePeekDocumentNumberMutation();

  const supplierOptions = (suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName }));
  // Prepared By lists every Sales Employee; Approved By is scoped to the
  // ones flagged with approval authorization on the Sales Employee master.
  const approvedByOptions = (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName }));
  // Create/edit form's Supplier field only (the shared PartyCodeSelect) —
  // lets staff search by Code or Name, same as every other Purchase/Sales
  // document. The list-view filter above keeps using supplierOptions
  // (names) unchanged. Memoized so typing in the form doesn't rebuild a
  // fresh options array (and a fresh set of option objects) on every
  // keystroke, which was racing Autocomplete's own filtered/highlighted
  // state and intermittently showing stale/unrelated rows.
  const supplierFieldOptions = useMemo(
    () => buildPartyCodeOptions(suppliers, 'supplierCode', 'supplierName'),
    [suppliers]
  );
  // Ship To used to be a Select of branch NAMES only (Company Head Office +
  // each branch name) — the value stored was just a name, never an actual
  // address, so the field displayed nothing useful and the printable never
  // even reads it (it resolves the branch's address directly via
  // printBranchRecord instead — see below). It's now a free-text field
  // auto-filled with the selected branch's own address, same as
  // Purchase Order/GRN/Invoice — see branchShipTo in the form body.
  // View toggles between the quotation list and the full-page Create/Edit
  // form — same page, no dialog/popup, per the standard CRUD page template.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions } = useBranchNameOptions({ currentValue: editingRow?.branch });

  // selectableProducts/productCodeOptions/productNameOptions used to live
  // here, computed from editingRow?.items — a static snapshot that only
  // reflected the record's lines as of page load. That went stale the moment
  // Copy From replaced the items array with a different document's lines, so
  // it's now computed live inside AppForm's render prop instead, keyed off
  // watchedItems (the form's actual current rows).
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [validUptoFilter, setValidUptoFilter] = useState('All');
  const [refFilter, setRefFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [dateAnchor, setDateAnchor] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [checkedIds, setCheckedIds] = useState([]);
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const pendingStatusRef = useRef('Open');

  const rows = quotations || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    const ref = refFilter.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !q || [r.quotationNo, r.supplier].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesSupplier = !supplierFilter || r.supplier === supplierFilter.value;
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      const matchesRef = !ref || String(r.referenceNo || '').toLowerCase().includes(ref);
      const validUpto = r.validUpto ? dayjs(r.validUpto) : null;
      const isExpired = validUpto ? validUpto.isBefore(dayjs(), 'day') : false;
      const matchesValidUpto = validUptoFilter === 'All'
        || (validUptoFilter === 'Expired' && isExpired)
        || (validUptoFilter === 'Valid' && !isExpired);
      const qd = r.quotationDate ? dayjs(r.quotationDate) : null;
      const matchesFrom = !dateFrom || (qd && !qd.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (qd && !qd.isAfter(dateTo, 'day'));
      return matchesSearch && matchesSupplier && matchesStatus && matchesRef && matchesValidUpto && matchesFrom && matchesTo;
    });
  }, [rows, supplierFilter, statusFilter, refFilter, validUptoFilter, dateFrom, dateTo]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'quotationNo', headerName: 'Quotation No.', filter: 'text' },
    { field: 'supplier', headerName: 'Supplier', filter: 'text' },
    { field: 'quotationDate', headerName: 'Quotation Date', filter: 'dateRange', sortValue: (row) => (row.quotationDate ? new Date(row.quotationDate).getTime() : null) },
    { field: 'validUpto', headerName: 'Valid Upto', filter: 'text' },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'referenceNo', headerName: 'Reference No.', filter: 'text' },
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
    setView('form');
  };

  const backToList = () => {
    setView('list');
    setEditingRow(null);
    setReadOnly(false);
  };

  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setView('form');
  };

  // Row-level Print, so this list carries the same action set as every other
  // purchase list (View / Route Map / Print / more). Opens the row in its
  // read-only View first and prints once that has rendered — the same
  // open-then-print sequence Purchase GRN and Purchase Invoice use, and for
  // the same reason: the printable content only exists once the form for that
  // row is on screen, so printing immediately would catch the list instead.
  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    // printPurchaseQuotation(), not window.print(): it installs the Purchase
    // Quotation sheet's own @page rule and print-scoping classes for the
    // duration of the job (see PurchaseQuotationPrintable.jsx), which is what
    // keeps the output portrait and the ruled frame filling the sheet.
    setTimeout(() => printPurchaseQuotation(), 300);
  };

  // Opened from the Route Map's document preview popup: jump straight into
  // this record's own read-only View, exactly as clicking it in the list
  // would, instead of requiring the user to find and click the row.
  useEffect(() => {
    if (!openDocNo) return;
    if (editingRow && editingRow.quotationNo === openDocNo) return;
    const match = rows.find((r) => r.quotationNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setView('form');
    setRowMenuAnchor(null);
  };

  const handleDuplicate = async (row) => {
    const quotationNo = await peekNextDocumentNumber(peekDocumentNumber, 'PQ', notify);
    const payload = { ...rowToFormValues(row, taxCodes), quotationNo, status: 'Open' };
    try {
      await create(payload).unwrap();
      notify.success('Quotation duplicated as a new draft');
    } catch (err) {
      notify.error(err?.data?.message || 'Duplicate failed');
    }
  };

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete quotation',
      message: `Are you sure you want to delete "${row.quotationNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Quotation deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete: the quotation stays in the list
  // (status becomes "Cancelled") and is dropped from the Purchase Order Copy
  // From picker; View/Edit/Delete/Cancel get blocked for it below once
  // isCancelled is true. A non-posting document, so nothing to reverse — the
  // backend (PATCH /purchase/quotations/:id/cancel) just refuses while a
  // live Purchase Order still references it.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel purchase quotation',
      message: `Are you sure you want to cancel "${row.quotationNo}"? This cannot be undone — the quotation will be locked and hidden from Purchase Order creation.`,
      confirmLabel: 'Cancel Quotation',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelQuotation(row.id).unwrap();
      notify.success('Purchase quotation cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Cancel failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected quotations',
      message: `Delete ${checkedIds.length} selected quotation${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected quotations deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const payload = { ...values, status: pendingStatusRef.current };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Quotation updated');
      } else {
        await create(payload).unwrap();
        notify.success('Quotation saved');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  const dateRangeLabel = dateFrom && dateTo
    ? `${dateFrom.format('DD/MM/YYYY')} - ${dateTo.format('DD/MM/YYYY')}`
    : 'Select date range';

  if (openDocNo && (!editingRow || editingRow.quotationNo !== openDocNo)) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>
      <EntityHeaderCard
        icon={<RequestQuoteOutlinedIcon />}
        title="Purchase Quotation"
        subtitle={view === 'form' ? 'Create a new purchase quotation.' : 'Manage and track all purchase quotations.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <RouteMapContextMenu flow="purchase" type="quotation" docNo={editingRow?.quotationNo}>
          <AppForm
            key={formKey}
            schema={purchaseQuotationSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow, taxCodes) : getEmptyValues(currentUser?.name || currentUser?.email, defaultTaxCode)}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              const { control, watch, setValue } = methods;
              const { fields, append, remove: removeItem } = useFieldArray({ control, name: 'items' });

              const [itemsImportOpen, setItemsImportOpen] = useState(false);
              const resolveImportedItem = (raw) => {
                const found = (products || []).find(
                  (p) => String(p.productCode || '').trim().toLowerCase() === String(raw.productCode || '').trim().toLowerCase()
                );
                const taxMatch = raw.taxCode
                  ? (taxCodes || []).find(
                      (t) => String(t.taxCode || '').trim().toLowerCase() === String(raw.taxCode).trim().toLowerCase()
                    )
                  : null;
                return {
                  ...emptyItem,
                  productCode: found ? found.productCode : raw.productCode,
                  productName: found ? found.productName : '',
                  description: raw.description || (found ? found.productName : ''),
                  hsnCode: found ? (found.hsnCode || '').replace(/[.\s-]/g, '') : '',
                  uom: found ? (found.uom || '') : '',
                  quantity: raw.quantity,
                  unitPrice: raw.unitPrice,
                  taxCodeId: taxMatch ? taxMatch.id : null,
                  taxPercent: taxMatch ? (Number(taxMatch.taxRate) || 0) : 0,
                  warehouse: raw.warehouse || (''),
                };
              };
              const handleItemsImported = (rawItems) => {
                append(rawItems.map(resolveImportedItem));
              };
              const watchedItems = watch('items') || [];

              // Shadows the outer-scope selectableProducts (computed from
              // editingRow?.items, a static snapshot) with a live version
              // keyed off the form's actual current lines -- see the same
              // fix on PurchaseOrder.jsx for why: a product Copy From just
              // brought in wasn't in that static list and its Item No /
              // Description Select rendered blank.
              // Recomputing this from the FULL product master on every render
              // (productOptionsFor filters/maps the whole list, then two more maps
              // build the Select options) is wasted work whenever the render was
              // triggered by something that isn't a product-code change on any line —
              // typing in a header field, a date, the Branch, etc. all re-run this
              // render-prop function, but none of them change which product codes are
              // on the form, and the two fresh option arrays were also handing every
              // line's Autocomplete a new options identity each keystroke. Keyed on
              // the joined codes (a cheap string, not the products list itself) so it
              // only recomputes when a line's product actually changes. Output is
              // identical to calling productOptionsFor directly — this only skips
              // redundant re-invocations on unchanged inputs. Same shape as the
              // already-proven version in PurchaseGRN.jsx.
              const itemProductCodesKey = watchedItems.map((i) => i.productCode || '').join('\u0001');
              const selectableProducts = useMemo(
                () => productOptionsFor(
                  products,
                  PRODUCT_USAGE.PURCHASE,
                  watchedItems.map((i) => i.productCode)
                ),
                // eslint-disable-next-line react-hooks/exhaustive-deps
                [products, itemProductCodesKey]
              );
              const productCodeOptions = useMemo(
                () => selectableProducts.map((p) => ({ label: p.productCode, value: p.productCode })),
                [selectableProducts]
              );
              const productNameOptions = useMemo(
                () => selectableProducts.map((p) => ({ label: p.productName, value: p.productCode })),
                [selectableProducts]
              );

              // Every column of this item table is sized to show its values IN FULL —
              // no ellipsis, no wrapping, no hover, however long the text is. The
              // spec below is positional: it mirrors the header row top to bottom,
              // and `null` leaves a column (the # counter, the action column) at
              // whatever width it already has. See itemTableSx in lib/columnWidth.js.
              //
              // Two columns are measured against something other than the field
              // they write, and both would come out far too narrow otherwise:
              // Description renders productNameOptions, whose LABEL is the product
              // name while its value is the product CODE (both selects write
              // items.N.productCode); and Tax (%) shows the tax code's name, not
              // the bare rate it stores.
              const itemColumnsSx = itemTableSx(watchedItems, [
                null,
                { header: 'Item No *', get: (i) => i?.productCode, field: 'select' },
                { header: 'Description', get: (i) => i?.productName, field: 'select' },
                { header: 'HSN/SAC', get: (i) => i?.hsnCode, field: 'text' },
                { header: 'Unit', get: (i) => i?.uom, field: 'text' },
                { header: 'Warehouse *', get: (i) => i?.warehouse, field: 'select' },
                { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
                { header: 'Unit Price (₹) *', get: (i) => i?.unitPrice, field: 'text' },
                { header: 'Tax (%)', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                { header: 'Amount (₹)', get: (i) => ((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]);
              const quotationDateValue = watch('quotationDate');
              const quotationDateForMin = quotationDateValue ? dayjs(quotationDateValue) : null;
              const today = dayjs();
              const endDateMinDate = quotationDateForMin && quotationDateForMin.isAfter(today, 'day') ? quotationDateForMin : today;
              const discountPercent = watch('discountPercent');
              // Inter-state supplies are taxed wholly as IGST. The server works
              // this out by comparing the supplier's State against the company's
              // registered state; passing the same flag here is what stops the
              // panel showing a CGST/SGST split for a record saved as IGST.
              const interState = isInterState(watch('supplierState'), company?.state);
              // taxType (from each line's own taxCodeId) drives the TCS
              // carve-out in documentTotals.js's computeTotals -- see
              // buildTaxCodeOptions/taxCodeById above, which now carries
              // taxType alongside label/value/rate.
              const itemsForTotals = watchedItems.map((it) => ({ ...it, taxType: taxCodeById.get(it.taxCodeId)?.taxType || '' }));
              const freightNetAmount = watch('freightNetAmount');
              const freightTaxAmount = watch('freightTaxAmount');
              const totals = computeTotals(itemsForTotals, discountPercent, interState, { freightNetAmount, freightTaxAmount });
              // Kerala supplier State -> GST family (GST, GST+TCS) only;
              // any other state -> IGST family (IGST, IGST+TCS) only. See
              // taxTypeFamilyFor in lib/taxCodeOptions.js.
              const taxCodeOptionsForRow = useMemo(
                () => buildTaxCodeOptions(taxCodes, { taxType: taxTypeFamilyFor(interState) }),
                [taxCodes, interState]
              );
              // Default Tax Code for a row added via "Add Item" once the
              // supplier (and so State) is known — GST@18% intra-state,
              // IGST@18% inter-state, following the same family the dropdown
              // itself is filtered to. The plain top-level defaultTaxCode
              // (GST@18%) is still what seeds getEmptyValues' very first row,
              // since no supplier is chosen yet at that point.
              const liveDefaultTaxCode = useMemo(
                () => pickDefaultTaxCode(taxCodes, { taxType: taxTypeFamilyFor(interState) }),
                [taxCodes, interState]
              );

              // Feeds the hidden print sheet below. Resolved exactly the way
              // PurchaseOrder.jsx resolves its own: the supplier's Business
              // Partner record supplies the "To :" address block and vendor
              // logo, and the Ship To branch supplies the Shipping Address
              // lines. Both come from lists this page already loads, so no
              // extra API call is involved.
              const allValues = watch();
              const printSupplierRecord = (suppliers || []).find((s) => s.supplierName === allValues.supplier);
              // Matched on the document's own "Branch *" field, NOT shipTo: shipTo is a
              // free-text SUPPLIER shipping address (auto-filled from Business Partner
              // Master) and never equals a branch name, so the print's Shipping Address
              // box always fell through to the company's default address. Same fix as
              // Purchase Order / GRN / Invoice.
              const printBranchRecord = (branches || []).find((b) => b.branchName === allValues.branch);
              const printQuotation = { ...allValues, status: editingRow?.status || 'Open' };
              // See SalesInvoice.jsx's identical approverSignatureUrl comment.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              const supplierValue = watch('supplier');
              const prevSupplier = useRef(editingRow ? editingRow.supplier : null);
              useEffect(() => {
                if (supplierValue !== prevSupplier.current) {
                  const found = (suppliers || []).find((s) => s.supplierName === supplierValue);
                  if (found) {
                    setValue('contactPerson', found.contactPerson || '', { shouldValidate: true });
                    setValue('phone', found.phone || '', { shouldValidate: true });
                    setValue('email', found.email || '', { shouldValidate: true });
                    setValue('currency', found.currency || 'INR', { shouldValidate: true });
                    setValue('paymentTerms', found.paymentTerms || '', { shouldValidate: true });
                    setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                  }
                  prevSupplier.current = supplierValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [supplierValue]);

              // State -- display-only, auto-filled from the selected supplier's
              // Business Partner Billing address (same as Purchase Order/GRN/
              // Invoice), never hand-typed. This -- NOT Place of Supply -- is
              // what decides CGST/SGST vs IGST (see interState above) and
              // which Tax Code family the Tax (%) column offers.
              const supplierState = useMemo(() => {
                const found = (suppliers || []).find((s) => s.supplierName === supplierValue);
                const billing = (found?.addresses || []).filter((a) => a.addressType === 'Billing');
                const defaultBilling = billing.find((a) => a.isDefault) || billing[0];
                return defaultBilling?.state || found?.state || '';
              }, [suppliers, supplierValue]);
              useEffect(() => {
                // Wait for the supplier list so an existing document's saved
                // State isn't blanked while it is still loading.
                if (!suppliers) return;
                setValue('supplierState', supplierState || '', { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [suppliers, supplierState]);

              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

              // Once Branch is picked, the Warehouse dropdown is scoped to
              // that branch's warehouses only — see useWarehouseOptions.js.
              const branch = watch('branch');

              // Ship To now defaults from the selected branch's own address
              // (the same Branch Master row printBranchRecord above
              // resolves for the printable), rather than storing just the
              // branch's name with no address behind it. branchAddressLines()
              // returns [] for no/blank branch, which just leaves Ship To
              // untouched instead of forcing an empty box.
              const branchShipTo = useMemo(
                () => branchAddressLines(printBranchRecord).join('\n'),
                [printBranchRecord]
              );
              // lastAutoShipToRef remembers the value WE last auto-filled so
              // a branch switch only re-fills a field that still holds our
              // own previous auto-fill (or is empty) — a value the user
              // typed themselves is left alone.
              const lastAutoShipToRef = useRef(editingRow ? null : '');
              useEffect(() => {
                if (editingRow) return;
                if (!branchShipTo) return;
                const current = watch('shipTo');
                if (!current || current === lastAutoShipToRef.current) {
                  if (branchShipTo !== current) {
                    setValue('shipTo', branchShipTo, { shouldValidate: true });
                  }
                  lastAutoShipToRef.current = branchShipTo;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branchShipTo]);

              const { warehouses } = useWarehouseOptions({});
              // Every line can carry a different warehouse, and on edit/view
              // a saved value that isn't in the currently-selected branch's
              // list (a different branch, a since-deactivated warehouse, ...)
              // must still show, not render blank — see useWarehouseOptions.js.
              const { options: branchWarehouseOptions } = useWarehouseOptions({
                branch,
                currentValue: watchedItems.map((i) => i.warehouse),
              });

              // Switching Branch invalidates a Warehouse choice that doesn't
              // belong to the new branch. Skipped on the very first render so
              // loading an existing record for edit/view doesn't wipe a value
              // it just loaded.
              const prevBranchRef = useRef(branch);
              useEffect(() => {
                if (prevBranchRef.current === branch) return;
                prevBranchRef.current = branch;
                const allowed = warehouseCodesForBranch(warehouses, branch);
                (watch('items') || []).forEach((it, idx) => {
                  if (it.warehouse && !allowed.has(it.warehouse)) setValue(`items.${idx}.warehouse`, '');
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branch]);

              return (
                // minWidth: 0 is required — fieldsets default to min-width: min-content,
                // which lets the wide item table blow out the page width on mobile.
                // The Back to List / Cancel buttons are kept outside the fieldset(s)
                // so they stay clickable in read-only (view) mode -- a native
                // <fieldset disabled> disables every descendant control, buttons
                // included.
                <>
                  <PurchaseQuotationPrintable
                    order={printQuotation}
                    company={company}
                    supplierRecord={printSupplierRecord}
                    branchRecord={printBranchRecord}
                    approverSignatureUrl={approverSignatureUrl}
                  />
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {readOnly ? 'Supplier & Document Details (View Only)' : 'Supplier & Document Details'}
                        </Typography>
                        <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                          Back to List
                        </Button>
                      </Stack>

                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        {/* Two columns, top to bottom: Branch / Payment Terms /
                        Supplier / Phone No. / Reference No / Delivery Date on
                        the left, Quotation No / Quotation Date / Supplier
                        Name / Email / Valid Upto / Currency on the right —
                        FormGrid(columns=2) lays fields out left-right-left-
                        right, so the order below IS the column assignment.
                        Contact Person stays in the schema/payload and keeps
                        auto-filling from Supplier Master (see the supplier
                        effect below) — it just has no visible control here.
                        Email is back in view, reusing that same auto-fill
                        (see setValue('email', ...) below) rather than a new
                        field. Ship To (multiline, rows=3) is pulled out of
                        this paired grid entirely and given its own full-width
                        row right after — pairing it with a short single-line
                        field left that row visibly shorter than Ship To, the
                        same height mismatch fixed the same way on the Company
                        Details address field. */}
                        <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                          <LabeledField label="Branch *">
                            <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                          </LabeledField>
                          <LabeledField label="Quotation No. *">
                            <DocumentSeriesNoField documentCode="PQ" seriesFieldName="seriesId" numberFieldName="quotationNo" isCreate={!editingRow} />
                          </LabeledField>

                          <LabeledField label="Payment Terms">
                            <FormSelect name="paymentTerms" label="" placeholder="Select payment terms" options={SUPPLIER_PAYMENT_TERMS_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Quotation Date *">
                            <FormDatePicker name="quotationDate" label="" triggerFields={['validUpto', 'deliveryDate']} />
                          </LabeledField>

                          <LabeledField label="Supplier *">
                            <PartyCodeSelect name="supplier" label="" placeholder="Select supplier" options={supplierFieldOptions} showNameBelow={false} />
                          </LabeledField>
                          {/* Read-only echo of the selected supplier's full
                          name — the Supplier field just stores/shows the
                          code, so this is what tells the user which supplier
                          that code actually is. Not a stored field: it just
                          displays the current value of `supplier`, which
                          already holds the supplier's name (see
                          supplierFieldOptions above). Same pattern as
                          Purchase Order's Supplier Name field. */}
                          <LabeledField label="Supplier Name">
                            <TextField
                              value={supplierValue || ''}
                              label=""
                              placeholder="—"
                              fullWidth
                              size="small"
                              InputProps={{ readOnly: true }}
                              sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
                            />
                          </LabeledField>

                          {/* Display-only, auto-filled from the selected supplier's
                          Business Partner address -- drives CGST/SGST vs IGST. */}
                          <LabeledField label="State">
                            <FormTextField name="supplierState" label="" placeholder="Supplier state" disabled />
                          </LabeledField>

                          <LabeledField label="Phone No.">
                            <FormTextField name="phone" label="" placeholder="Auto-filled from supplier" digitsOnly maxLength={10} />
                          </LabeledField>
                          <LabeledField label="Email">
                            <FormTextField name="email" label="" placeholder="Auto-filled from supplier" />
                          </LabeledField>

                          <LabeledField label="Reference No.">
                            <FormTextField name="referenceNo" label="" placeholder="Enter reference number" />
                          </LabeledField>
                          <LabeledField label="Valid Upto *">
                            <FormDatePicker name="validUpto" label="" minDate={endDateMinDate} triggerFields={['quotationDate']} />
                          </LabeledField>

                          <LabeledField label="Delivery Date *">
                            <FormDatePicker name="deliveryDate" label="" minDate={endDateMinDate} triggerFields={['quotationDate']} />
                          </LabeledField>
                          <LabeledField label="Currency *">
                            <FormSelect name="currency" label="" options={currencyOptions} />
                          </LabeledField>
                        </FormGrid>
                        <FormGrid columns={1} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Ship To" align="flex-start">
                            <FormTextField name="shipTo" label="" placeholder="Branch delivery address" multiline rows={3} disabled />
                          </LabeledField>
                        </FormGrid>
                      </fieldset>
                    </CardContent>
                  </Card>

                  <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                    <Card variant="outlined" sx={{ mb: 2 }}>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                          <Stack direction="row" spacing={1.5}>
                            <Button type="button" variant="outlined" color="inherit" size="small" startIcon={<UploadFileIcon />} onClick={() => setItemsImportOpen(true)}>
                              Import from Excel
                            </Button>
                            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append(withDefaultTaxCode({ ...emptyItem }, liveDefaultTaxCode))}>
                              Add Item
                            </Button>
                          </Stack>
                        </Stack>

                        {isMobile ? (
                          <Box>
                            {fields.map((field, index) => {
                              const qty = Number(watch(`items.${index}.quantity`)) || 0;
                              const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                              const rowAmount = qty * price;
                              return (
                                <MobileItemCard
                                  key={field.id}
                                  index={index}
                                  amount={rowAmount.toFixed(2)}
                                  onRemove={() => removeItem(index)}
                                  removeDisabled={fields.length <= 1}
                                >
                                  <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} label="Item No *" placeholder="Select product code" />
                                  <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} label="Description" placeholder="Select product name" />
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                    <FormTextField name={`items.${index}.hsnCode`} label="HSN/SAC" placeholder="HSN/SAC" digitsOnly maxLength={8} />
                                    <FormTextField name={`items.${index}.uom`} label="Unit" placeholder="Unit" />
                                    <WarehouseCodeSelect name={`items.${index}.warehouse`} label="Warehouse *" placeholder={branch ? 'Select warehouse' : 'Select a branch first'} options={branchWarehouseOptions} disabled={!branch} />
                                    <FormTextField name={`items.${index}.quantity`} label="Quantity *" type="number" />
                                    <FormTextField name={`items.${index}.unitPrice`} label="Unit Price (₹) *" type="number" />
                                    <FormSelect name={`items.${index}.taxCodeId`} label="Tax (%)" options={taxCodeOptionsForRow} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
                                  </Box>
                                </MobileItemCard>
                              );
                            })}
                          </Box>
                        ) : (
                          <TableContainer ref={itemScrollRef} sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab', ...dragScrollbarSx }}>
                            <Table size="small" sx={[itemColumnsSx, { '& tbody .MuiFormHelperText-root:not(.Mui-error)': { display: 'none' } }]}>
                              <TableHead>
                                <TableRow>
                                  {/* Each header carries its column's own sizing sx —
                                the same object the body cells below use — so
                                the column is wide enough for both its heading
                                and its widest value, and neither is clipped or
                                wrapped. */}
                                  <TableCell width={40}>#</TableCell>
                                  <TableCell>Item No *</TableCell>
                                  <TableCell>Description</TableCell>
                                  <TableCell>HSN/SAC</TableCell>
                                  <TableCell>Unit</TableCell>
                                  <TableCell>Warehouse *</TableCell>
                                  <TableCell>Quantity *</TableCell>
                                  <TableCell>Unit Price (₹) *</TableCell>
                                  <TableCell>Tax (%)</TableCell>
                                  <TableCell align="right">Amount (₹)</TableCell>
                                  <TableCell width={48} />
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {fields.map((field, index) => {
                                  const qty = Number(watch(`items.${index}.quantity`)) || 0;
                                  const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                                  const rowAmount = qty * price;
                                  return (
                                    <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell>
                                        <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} placeholder="Select product code" />
                                      </TableCell>
                                      <TableCell>
                                        <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} placeholder="Select product name" />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.hsnCode`} label="" placeholder="HSN/SAC" digitsOnly maxLength={8} />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.uom`} label="" placeholder="Unit" />
                                      </TableCell>
                                      <TableCell>
                                        <WarehouseCodeSelect name={`items.${index}.warehouse`} label="" placeholder={branch ? 'Select' : 'Select branch first'} options={branchWarehouseOptions} disabled={!branch} popupFitContent showNameBelow={false} />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.quantity`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.unitPrice`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormSelect name={`items.${index}.taxCodeId`} label="" options={taxCodeOptionsForRow} disableClearable popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
                                      </TableCell>
                                      <TableCell align="right">{rowAmount.toFixed(2)}</TableCell>
                                      <TableCell>
                                        <IconButton
                                          type="button"
                                          size="small"
                                          color="error"
                                          onClick={() => removeItem(index)}
                                          disabled={fields.length <= 1}
                                          aria-label="remove item"
                                        >
                                          <DeleteIcon fontSize="small" />
                                        </IconButton>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}
                      </CardContent>
                    </Card>
                  </fieldset>

                  <Card variant="outlined">
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        <Grid container spacing={3}>
                          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Terms & Conditions</Typography>
                              <FormTextField name="termsConditions" label="" placeholder="Enter terms and conditions" multiline rows={6}
                                sx={{
                                  flex: 1,
                                  '& .MuiInputBase-root': { height: '100%', alignItems: 'flex-start' },
                                  '& .MuiInputBase-inputMultiline': { height: '100% !important', overflowY: 'auto' },
                                }}
                              />
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Attachments</Typography>
                              <Box
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                                sx={{
                                  flex: 1,
                                  display: 'flex', flexDirection: 'column', justifyContent: 'center',
                                  border: '1px dashed', borderColor: 'divider', borderRadius: 1.5,
                                  p: 3, textAlign: 'center', color: 'text.secondary',
                                }}
                              >
                                <UploadFileIcon sx={{ mb: 1 }} />
                                <Typography variant="body2" sx={{ mb: 1 }}>Drag and drop files here</Typography>
                                <Typography variant="body2" sx={{ mb: 1 }}>or</Typography>
                                <Button component="label" variant="outlined" size="small">
                                  Browse Files
                                  <input type="file" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
                                </Button>
                                <Typography variant="caption" display="block" sx={{ mt: 1 }}>Supported formats: PDF, JPG, PNG (Max. 5MB)</Typography>
                                {watch('attachmentName') && (
                                  <Chip
                                    sx={{ mt: 1.5 }}
                                    size="small"
                                    label={watch('attachmentName')}
                                    onDelete={() => setValue('attachmentName', '')}
                                  />
                                )}
                              </Box>
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={4} sx={{ display: 'flex' }}>
                            <Box sx={{ width: '100%' }}>
                              <DocumentTotalsPanel totals={totals} interState={interState} subtotalLabel="Subtotal" showRoundOff={false} discountField={null} showFreight />
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Prepared By</Typography>
                            <FormTextField name="preparedBy" label="" disabled />
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Approved By</Typography>
                            <FormSelect name="approvedBy" label="" placeholder="Select employee" options={approvedByOptions} />
                          </Grid>
                        </Grid>
                      </fieldset>

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                        sx={{ mt: 3 }}
                      >
                        <Button fullWidth={isMobile} type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                          Cancel
                        </Button>
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printPurchaseQuotation()}>
                          Print
                        </Button>
                        <CopyToButton
                          sourceType="purchaseQuotation"
                          sourceDoc={editingRow}
                          sourceLabel="Purchase Quotation"
                          docNoField="quotationNo"
                          targets={[
                            { key: 'purchaseOrder', label: 'Purchase Order', path: '/purchase/order' },
                            { key: 'purchaseGRN', label: 'Purchase GRN', path: '/purchase/grn' },
                            { key: 'purchaseInvoice', label: 'Purchase Invoice', path: '/purchase/invoice' },
                          ]}
                        />
                        {!readOnly && (
                          <>
                            <FormSubmitButton
                              fullWidth={isMobile}
                              variant="outlined"
                              onClick={() => { pendingStatusRef.current = 'Open'; }}
                              disabled={creating || updating}
                              loading={creating || updating}
                            >
                              Save as Draft
                            </FormSubmitButton>
                            <FormSubmitButton
                              fullWidth={isMobile}
                              onClick={() => { pendingStatusRef.current = 'Sent'; }}
                              disabled={creating || updating}
                              loading={creating || updating}
                            >
                              {editingRow ? 'Update Quotation' : 'Save Quotation'}
                            </FormSubmitButton>
                          </>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                  <ImportItemsDialog
                    open={itemsImportOpen}
                    onClose={() => setItemsImportOpen(false)}
                    resourceName="Items"
                    templateUrl="/purchase/quotations/items-import/template"
                    importUrl="/purchase/quotations/items-import"
                    onImported={handleItemsImported}
                  />
                </>
              );
            }}
          </AppForm>
        </RouteMapContextMenu>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              alignItems={{ xs: 'stretch', sm: 'center' }}
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1.5}
              sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight={700}>Quotation List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', sm: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by quotation no, supplier..." showFilter={false} />
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
                    {/* React.Children.only needs one child — group both buttons in a Stack. */}
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap>
                      <Button
                        variant="outlined"
                        color="inherit"
                        startIcon={<UploadFileIcon />}
                        onClick={() => setBulkImportOpen(true)}
                        sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                      >
                        Import from Excel
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={openCreate}
                        sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                      >
                        Create Quotation
                      </Button>
                    </Stack>
                  </CanAdd>
                </Stack>
              </Stack>
            </Stack>

            <Collapse in={showFilters} unmountOnExit>
              <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
                <FormGrid columns={5} singleColumnOnMobile>
                  <FilterAutocomplete
                    label="Supplier"
                    allLabel="All Suppliers"
                    options={supplierOptions}
                    value={supplierFilter}
                    onChange={(v) => { setSupplierFilter(v); setPage(0); }}
                  />
                  <Autocomplete
                    size="small"
                    options={STATUS_FILTERS}
                    value={statusFilter}
                    onChange={(_e, v) => { setStatusFilter(v || 'All Status'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Status" InputLabelProps={{ shrink: true }} />}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    label="Date Range"
                    value={dateRangeLabel}
                    onClick={(e) => setDateAnchor(e.currentTarget)}
                    InputProps={{
                      readOnly: true,
                      startAdornment: <InputAdornment position="start"><EventIcon fontSize="small" /></InputAdornment>,
                      endAdornment: (dateFrom || dateTo) ? (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDateFrom(null); setDateTo(null); setPage(0); }}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : null,
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{ cursor: 'pointer' }}
                  />
                  <Autocomplete
                    size="small"
                    options={VALID_UPTO_FILTERS}
                    value={validUptoFilter}
                    onChange={(_e, v) => { setValidUptoFilter(v || 'All'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Valid Upto" InputLabelProps={{ shrink: true }} />}
                  />
                  <TextField
                    size="small"
                    fullWidth
                    label="Reference No."
                    value={refFilter}
                    onChange={(e) => { setRefFilter(e.target.value); setPage(0); }}
                    placeholder="Enter reference no."
                    InputLabelProps={{ shrink: true }}
                  />
                </FormGrid>

                <Popover
                  open={!!dateAnchor}
                  anchorEl={dateAnchor}
                  onClose={() => setDateAnchor(null)}
                  anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                >
                  <Stack direction="row" spacing={2} sx={{ p: 2 }}>
                    <DatePicker label="From" value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(0); }} slotProps={{ textField: { size: 'small' } }} />
                    <DatePicker label="To" value={dateTo} onChange={(v) => { setDateTo(v); setPage(0); }} slotProps={{ textField: { size: 'small' } }} />
                  </Stack>
                </Popover>
                <TableFilterPanel table={table} embedded open />
              </Box>
            </Collapse>

            {canDelete && checkedIds.length > 0 && (
              <Box sx={{ px: { xs: 2, sm: 3 }, pb: 1.5 }}>
                <Button variant="outlined" color="error" size="small" startIcon={<DeleteIcon />} onClick={removeSelected}>
                  Delete Selected ({checkedIds.length})
                </Button>
              </Box>
            )}

            {isMobile ? (
              <Box sx={{ px: 2, pb: 1 }}>
                {!isLoading && pagedRows.map((row) => (
                  <MobileRecordCard
                    key={row.id}
                    title={row.quotationNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Supplier', value: row.supplier || '—' },
                      { label: 'Quotation Date', value: row.quotationDate ? dayjs(row.quotationDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Valid Upto', value: row.validUpto ? dayjs(row.validUpto).format('DD/MM/YYYY') : '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                      { label: 'Reference No.', value: row.referenceNo || '—' },
                    ]}
                    // Cancelled quotations are fully locked — only the status
                    // chip above shows "Cancelled".
                    onEdit={row.isCancelled ? undefined : () => handleEdit(row)}
                    onDelete={row.isCancelled ? undefined : () => handleDelete(row)}
                    extraActions={row.isCancelled ? [] : [
                      { key: 'cancel', label: 'Cancel', icon: <CancelOutlinedIcon fontSize="small" />, color: 'warning', onClick: () => handleCancel(row) },
                    ]}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No quotations found" message="Add your first quotation to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: PURCHASE_QUOTATION_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${PURCHASE_QUOTATION_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${PURCHASE_QUOTATION_LIST_TABLE_CELL_PADDING_Y}px`,
                      boxSizing: 'border-box',
                    },
                  }}
                >
                  <TableHead>
                    <TableRow>
                      {canDelete && (
                        <SortableHeaderCell field="id" sort={table.sort} onSort={table.toggleSort} padding="checkbox">
                          <Checkbox
                            size="small"
                            checked={pagedRows.length > 0 && pagedRows.every((r) => checkedIds.includes(r.id))}
                            indeterminate={pagedRows.some((r) => checkedIds.includes(r.id)) && !pagedRows.every((r) => checkedIds.includes(r.id))}
                            onChange={(e) => {
                              const ids = pagedRows.map((r) => r.id);
                              setCheckedIds((prev) => e.target.checked
                                ? Array.from(new Set([...prev, ...ids]))
                                : prev.filter((c) => !ids.includes(c)));
                            }}
                          />
                        </SortableHeaderCell>
                      )}
                      <TableCell width={40}>#</TableCell>
                      <SortableHeaderCell field="quotationNo" sort={table.sort} onSort={table.toggleSort}>Quotation No.</SortableHeaderCell>
                      <SortableHeaderCell field="supplier" sort={table.sort} onSort={table.toggleSort}>Supplier</SortableHeaderCell>
                      <SortableHeaderCell field="quotationDate" sort={table.sort} onSort={table.toggleSort}>Quotation Date</SortableHeaderCell>
                      <SortableHeaderCell field="validUpto" sort={table.sort} onSort={table.toggleSort}>Valid Upto</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="amount" sort={table.sort} onSort={table.toggleSort}>Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <SortableHeaderCell field="referenceNo" sort={table.sort} onSort={table.toggleSort}>Reference No.</SortableHeaderCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoading && pagedRows.map((row, i) => (
                      <TableRow key={row.id} hover>
                        {canDelete && (
                          <TableCell padding="checkbox">
                            <Checkbox
                              size="small"
                              checked={checkedIds.includes(row.id)}
                              onChange={() => setCheckedIds((prev) => prev.includes(row.id) ? prev.filter((c) => c !== row.id) : [...prev, row.id])}
                            />
                          </TableCell>
                        )}
                        <TableCell>{page * pageSize + i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.quotationNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplier || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.quotationDate ? dayjs(row.quotationDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.validUpto ? dayjs(row.validUpto).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.referenceNo || '-'}</TableCell>
                        <TableCell align="right">
                          {row.isCancelled ? (
                            // Fully locked once cancelled — only the status
                            // chip above says "Cancelled".
                            <Typography variant="caption" color="text.secondary">Cancelled</Typography>
                          ) : (
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="View">
                              <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <RouteMapButton flow="purchase" type="quotation" docNo={row.quotationNo} />
                            {canDuplicate && (
                              <Tooltip title="Duplicate">
                                <IconButton size="small" onClick={() => handleDuplicate(row)} aria-label="duplicate">
                                  <ContentCopyOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Print">
                              <IconButton size="small" onClick={() => handlePrint(row)} aria-label="print">
                                <PrintOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <CanCancel>
                              <Tooltip title="Cancel">
                                <IconButton size="small" color="warning" onClick={() => handleCancel(row)} aria-label="cancel">
                                  <CancelOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </CanCancel>
                            <IconButton
                              size="small"
                              onClick={(e) => { setRowMenuAnchor(e.currentTarget); setRowMenuTarget(row); }}
                              aria-label="more actions"
                            >
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10}>
                          <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No quotations found" message="Add your first quotation to get started" />
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
      )}

      <BulkImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        resourceName="Purchase Quotations"
        templateUrl="/purchase/quotations/bulk-import/template"
        importUrl="/purchase/quotations/bulk-import"
        onImported={refetchQuotations}
      />
    </Box>
  );
}

// Isolated so the per-row product-select auto-fill effect only re-runs for
// the row whose product actually changed, not every row on every keystroke.
// Both the Item No and Description columns are selects over the same
// underlying items.{index}.productCode field — Item No lists codes,
// Description lists names, but selecting either one sets the same value, so
// whichever the user picks from, the row's product identity (and therefore
// the auto-filled HSN/UOM/price below) stays in sync.
function ProductCell({ index, methods, options, products, priceListRates, label = '', placeholder = 'Select product', multiline = false, sx }) {
  const notify = useNotify();
  const { watch, setValue, trigger } = methods;
  const productCodeValue = watch(`items.${index}.productCode`);
  const allItems = watch('items') || [];
  const prevValue = useRef(productCodeValue);

  const otherSelectedCodes = useMemo(() => {
    const set = new Set();
    allItems.forEach((it, i) => {
      if (i !== index && it?.productCode) {
        set.add(String(it.productCode).trim().toUpperCase());
      }
    });
    return set;
  }, [allItems, index]);

  const optionsWithDisabledLabel = useMemo(() => {
    return options.map((opt) => ({
      ...opt,
      label: otherSelectedCodes.has(String(opt.value).trim().toUpperCase())
        ? `${opt.label} (Already selected)`
        : opt.label,
    }));
  }, [options, otherSelectedCodes]);

  useEffect(() => {
    if (productCodeValue !== prevValue.current) {
      if (productCodeValue) {
        const normalized = String(productCodeValue).trim().toUpperCase();

        if (otherSelectedCodes.has(normalized)) {
          const duplicateIdx = allItems.findIndex(
            (it, i) => i !== index && String(it?.productCode || '').trim().toUpperCase() === normalized
          );
          notify.error(`Item "${productCodeValue}" is already selected in row ${duplicateIdx + 1}. Please choose a different product.`);
          setValue(`items.${index}.productCode`, '', { shouldValidate: true });
          setValue(`items.${index}.productName`, '', { shouldValidate: true });
          setValue(`items.${index}.description`, '', { shouldValidate: true });
          setValue(`items.${index}.hsnCode`, '', { shouldValidate: true });
          setValue(`items.${index}.uom`, '', { shouldValidate: true });
          setValue(`items.${index}.unitPrice`, 0, { shouldValidate: true });
          prevValue.current = '';
          return;
        }
      }
      const found = (products || []).find((p) => p.productCode === productCodeValue);
      if (found) {
        setValue(`items.${index}.productName`, found.productName, { shouldValidate: true });
        setValue(`items.${index}.description`, found.productName, { shouldValidate: true });
        // found.hsnCode is copied verbatim from Product Master — a code saved
        // there in the dotted customs-tariff style (e.g. "4012.90.90") or with
        // stray spacing fails this line's own digits-only HSN/SAC validation the
        // instant it's copied in, even though "4012.90.90" and "40129090" are
        // the same code. Stripped here so the field lands clean, same rule as
        // stripHsnSeparators() in lib/validation/common.js.
        setValue(`items.${index}.hsnCode`, (found.hsnCode || '').replace(/[.\s-]/g, ''), { shouldValidate: true });
        setValue(`items.${index}.uom`, found.uom || '', { shouldValidate: true });
        const priceListRate = priceListRates?.get(found.productCode);
        setValue(`items.${index}.unitPrice`, priceListRate != null ? priceListRate : (found.unitPrice != null ? Number(found.unitPrice) : 0), { shouldValidate: true });
      }
      prevValue.current = productCodeValue;
      trigger('items');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCodeValue, otherSelectedCodes]);

  return (
    <FormSelect
      name={`items.${index}.productCode`}
      label={label}
      placeholder={placeholder}
      options={optionsWithDisabledLabel}
      getOptionDisabled={(opt) => otherSelectedCodes.has(String(opt.value).trim().toUpperCase())}
      multiline={multiline}
      sx={sx}
      popupFitContent
    />
  );
}
