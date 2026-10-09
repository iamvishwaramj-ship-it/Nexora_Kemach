import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatPartnerAddress, formatCompanyAddress, joinAddressParts, cleanAddressText } from '../../lib/addressFormat';
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
import ReceiptOutlinedIcon from '@mui/icons-material/ReceiptOutlined';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EventIcon from '@mui/icons-material/Event';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../components/form/PartyCodeSelect';
import { FormCheckbox } from '../../components/form/FormCheckbox';
import FormDatePicker from '../../components/form/FormDatePicker';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import PurchaseOtherDetailsCard from '../../components/common/PurchaseOtherDetailsCard';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
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
import { purchaseInvoiceSchema, INVOICE_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } from '../../lib/validation/purchaseSchemas';
import { buildDocument, round2, num, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { SUPPLIER_PAYMENT_TERMS_OPTIONS } from '../../lib/validation/partnerSchemas';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import { purchaseInvoiceApi, goodsReceivedNoteApi, purchaseReturnApi, purchaseOrderApi, supplierApi, customerApi, productApi, taxCodeApi, salesEmployeeApi } from '../../features/resources';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { buildTaxCodeOptions, taxTypeFamilyFor, buildTaxCodeIdByRate, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { itemTableSx } from '../../lib/columnWidth';
import { useWarehouseOptions } from '../../lib/useWarehouseOptions';
import { useWarehouseStock } from '../../lib/useWarehouseStock';
import { branchAddressLines } from '../../lib/branchAddress';
import { useGetCompanyDetailsQuery } from '../../features/company/companyDetailsApi';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import PurchaseInvoicePrintable, { printPurchaseInvoice } from '../../components/print/PurchaseInvoicePrintable';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import { canDelete } from '../../config/deleteConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import CopyFromDocumentDialog from '../../components/common/CopyFromDocumentDialog';
import JournalEntryViewDialog from '../../components/accounting/JournalEntryViewDialog';
import BatchSerialSetupDialog from '../../components/common/BatchSerialSetupDialog';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import { useDispatch, useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import { clearCopyIntent } from '../../store/copyIntentSlice';
import usePriceListRates from '../../hooks/usePriceListRates';

// A purchase invoice can be raised off either step of the chain above it: the
// Purchase Order (billed before or without a receipt) or the GRN (billed
// against what actually arrived). Copy From therefore asks which one first,
// then opens the matching Find dialog. Each source gets its own columns
// because each document names things differently.
const PO_COPY_COLUMNS = [
  { field: 'poNo', headerName: 'Order No', nowrap: true },
  { field: 'supplier', headerName: 'Vendor Name' },
  { field: 'poDate', headerName: 'Order Date', type: 'date' },
  { field: 'remarks', headerName: 'Comments', type: 'optional' },
];

const GRN_COPY_COLUMNS = [
  { field: 'grnNo', headerName: 'Receipt No', nowrap: true },
  { field: 'supplier', headerName: 'Supplier Name' },
  { field: 'receivedDate', headerName: 'Document Date', type: 'date' },
  { field: 'notes', headerName: 'Comments', type: 'optional' },
];

// machineSerialNo/machineModel: shown (and only ever meaningful) when the
// HEADER's Purchase Type is 'Machine' — see isMachinePurchase below. Unlike
// warehouse above, which every line carries regardless of Purchase Type,
// these two only ever matter for that one header value.
const emptyItem = {
  productCode: '', productName: '', description: '', hsnCode: '', uom: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxPercent: 18, taxCodeId: null, warehouse: '', machineSerialNo: '', machineModel: '', machineEngineNo: '',
  // Populated via the "Batches - Setup" / "Serial Numbers - Setup" dialog —
  // see BatchSerialSetupDialog and the Batch/Serial column below. Only ever
  // shown (and only ever meaningful) when this invoice is direct — no base
  // GRN, see isDirectInvoice below — since a GRN-backed invoice moves no
  // stock and the GRN itself already created whatever it received. Mirrors
  // PurchaseGRN.jsx's own emptyItem exactly.
  batches: [], serials: [],
};

/**
 * Batch/Serial allocation on a direct invoice (no base GRN — see
 * isDirectInvoice) is optional, not mandatory: a line left without full
 * batch/serial coverage no longer blocks Save, matching the server's own
 * assertBatchSerialAllocation({ optional: true }) in utils/businessRules.js.
 * This still catches the one thing that stays an error either way — the
 * same serial number assigned on more than one line — since that's a
 * data-integrity problem regardless of whether coverage is complete. Batch
 * numbers are deliberately NOT checked for duplicates here (see
 * PurchaseGRN.jsx's own validateBatchSerialAllocation doc comment): they're
 * free to repeat within this one document (Purchase Invoice has its own
 * separate batchScope, same idea as GRN's).
 */
function validateBatchSerialAllocation(items) {
  const seenSerialNos = new Map();

  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];

    for (const s of item.serials || []) {
      const no = (s.serialNo || '').trim();
      if (!no) continue;
      if (seenSerialNos.has(no)) return `Serial number "${no}" is used on more than one line.`;
      seenSerialNos.set(no, i);
    }
  }
  return null;
}

function getEmptyValues(preparedBy, defaultTaxCode) {
  return {
    invoiceNo: '', seriesId: '', branch: '', supplier: '', invoiceDate: new Date(), grnNo: '', poNo: '',
    warehouse: '',
    currency: 'INR', paymentTerms: '', dueDate: null,
    vendorRefNo: '', billFrom: '', supplierState: '', shipTo: '', notes: '',
    shipToDifferentCustomer: false, shipToCustomer: '',
    termsConditions: '', attachmentName: '', discountPercent: 0,
    status: 'Draft', paymentStatus: 'Unpaid',
    // "Other Details" card — see PurchaseOtherDetailsCard.jsx. Same field
    // set/CFL behaviour as Purchase Order's own Other Details card. No
    // invoiceType any more — Invoice Type has been removed from every
    // purchase document's UI.
    billingType: '', purchaseType: '', typeOfPurchase: '', salesType: '',
    purchaseEmployee: '', transportMode: '',
    preparedBy: preparedBy || '', approvedBy: '',
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
// decides CGST/SGST vs IGST by comparing this document's supplierState
// against the company's registered state (Purchase Invoice has no Place of
// Supply field), and for a long time no page passed the flag at all — so an
// inter-state document displayed a CGST/SGST split while the record it saved
// held IGST.
//
function computeTotals(items, discountPercent, interState = false, extraCharges = {}) {
  const { totals } = buildDocument(items, discountPercent, {
    interState,
    roundOff: true,
    freightAmount: extraCharges.freightNetAmount,
  });
  // Road Tax Amount has been removed from this document's UI/print and no
  // longer feeds the grand total. Freight Charges mirrors the Sales
  // documents' Freight Charges feature exactly (see FreightChargesEditor.jsx)
  // and is folded into grandTotal here so the panel and the saved record
  // can't disagree.
  const freightGrossAmount = computeFreightGross(extraCharges.freightNetAmount, extraCharges.freightTaxAmount);
  return {
    ...totals,
    discount: computeItemDiscountTotal(items),
    freightGrossAmount,
    grandTotal: round2(totals.amount + num(extraCharges.freightTaxAmount)),
  };
}

function rowToFormValues(row, taxCodes) {
  const taxCodeIdByRate = buildTaxCodeIdByRate(taxCodes);
  return {
    invoiceNo: row.invoiceNo, seriesId: '', branch: row.branch || '', supplier: row.supplier || '', invoiceDate: row.invoiceDate,
    grnNo: row.grnNo || '', poNo: row.poNo || '',
    warehouse: row.warehouse || '',
    currency: row.currency || 'INR', paymentTerms: row.paymentTerms || '', dueDate: row.dueDate,
    vendorRefNo: row.vendorRefNo || '', billFrom: cleanAddressText(row.billFrom), supplierState: row.supplierState || '', shipTo: cleanAddressText(row.shipTo),
    shipToDifferentCustomer: !!row.shipToDifferentCustomer, shipToCustomer: row.shipToCustomer || '',
    notes: row.notes || '', termsConditions: row.termsConditions || '', attachmentName: row.attachmentName || '',
    discountPercent: row.discountPercent != null ? Number(row.discountPercent) : 0,
    status: row.status || 'Draft', paymentStatus: row.paymentStatus || 'Unpaid',
    billingType: row.billingType || '', purchaseType: row.purchaseType || '',
    typeOfPurchase: row.typeOfPurchase || '', salesType: row.salesType || '',
    purchaseEmployee: row.purchaseEmployee || '', transportMode: row.transportMode || '',
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
      discountPercent: i.discountPercent != null ? Number(i.discountPercent) : 0,
      taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
      taxCodeId: i.taxCodeId != null
        ? Number(i.taxCodeId)
        : (taxCodeIdByRate.get(i.taxPercent != null ? Number(i.taxPercent) : 18) ?? null),
      // Line-first, header-fallback — same convention as GRN's
      // toGrnItemData: a row saved before this field existed still shows the
      // invoice's own warehouse rather than a blank.
      warehouse: i.warehouse || row.warehouse || '',
      // Only ever meaningful (and only ever shown) when the HEADER's
      // Purchase Type is 'Machine' — see isMachinePurchase. Reload as ''
      // like every other free-text line field, whatever the header's
      // current Purchase Type happens to be on open.
      machineSerialNo: i.machineSerialNo || '', machineModel: i.machineModel || '', machineEngineNo: i.machineEngineNo || '',
      // Coerced like quantity/unitPrice above — the API returns a saved
      // batch line's quantity as a string, and productBatchLineSchema wants
      // a number. Only ever populated when this invoice was direct at save
      // time — see purchaseInvoiceInclude in resources.js.
      batches: (i.batches || []).map((b) => ({
        ...b,
        quantity: b.quantity != null ? Number(b.quantity) : 0,
      })),
      serials: i.serials || [],
    })),
  };
}

// Supplier (Business Partner, carries .addresses) -> its default Billing
// address; Company Details -> address, city, state, country, pincode. Same
// order as every other page (lib/addressFormat.js), no double commas. The
// old version appended city/state/pincode/country AFTER a billingAddress
// that already contained them, printing them twice.
function formatAddress(entity) {
  if (!entity) return '';
  const billing = (entity.addresses || []).filter((a) => a.addressType === 'Billing');
  const chosen = billing.find((a) => a.isDefault) || billing[0];
  if (chosen) return formatPartnerAddress(chosen);
  if (entity.billingAddress) return joinAddressParts(cleanAddressText(entity.billingAddress).split('\n'));
  return formatCompanyAddress(entity);
}

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', ...INVOICE_STATUS_OPTIONS];
const PAYMENT_STATUS_FILTERS = ['All', ...PAYMENT_STATUS_OPTIONS];

const STATUS_COLORS = { Draft: 'info', Posted: 'success', Cancelled: 'error' };
const PAYMENT_STATUS_COLORS = { Unpaid: 'error', 'Partially Paid': 'warning', Paid: 'success' };

const PURCHASE_INVOICE_LIST_TABLE_ROW_HEIGHT = 0;
const PURCHASE_INVOICE_LIST_TABLE_CELL_PADDING_Y = 6;
export default function PurchaseInvoice({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  // Every currency dropdown reads live from Currency Master instead of a
  // hardcoded list — see lib/currencyOptions.js.
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  const { data: invoices, isLoading, refetch: refetchInvoices } = purchaseInvoiceApi.useList();
  const { data: grns } = goodsReceivedNoteApi.useList();
  // Needed to know which GRNs have already had a Purchase Return raised
  // against them — see copyableGrns below.
  const { data: purchaseReturns } = purchaseReturnApi.useList();
  const { data: purchaseOrders } = purchaseOrderApi.useList();
  // A Purchase Order already marked Closed has nothing left to invoice, so
  // it's dropped from the Copy From dialog's pickable list.
  const copyablePurchaseOrders = useMemo(
    () => (purchaseOrders || []).filter((po) => po.status !== 'Closed'),
    [purchaseOrders]
  );
  const { data: suppliers, isLoading: suppliersLoading } = supplierApi.useList();
  // "Ship to a different customer" — the new Customer CFL revealed by that
  // checkbox on the Supplier & Document Details card. Same picker source
  // (businessPartnerApi, filtered to partnerType Customer) the Sales pages
  // use for their own Customer field, and each row already carries a
  // pre-resolved `shippingAddress` string (see toLegacyPartnerShape in
  // features/resources.js) — no separate address lookup needed here.
  const { data: shipToCustomers, isLoading: shipToCustomersLoading } = customerApi.useList();
  const { data: products, isLoading: productsLoading } = productApi.useList({ view: 'picker' });
  // Looked up per row to decide whether the Batch/Serial column applies —
  // Product Master's Manage Item By select is what makes a line ask for it.
  // Mirrors PurchaseGRN.jsx's own productsByCode.
  const productsByCode = useMemo(
    () => Object.fromEntries((products || []).map((p) => [p.productCode, p])),
    [products]
  );
  // Which row's Batch/Serial "Setup" dialog is open, if any — see
  // BatchSerialCell and the BatchSerialSetupDialog render below.
  const [batchDialog, setBatchDialog] = useState(null);
  const { rates: priceListRates } = usePriceListRates('DLP');
  // Warehouse master, for validating a warehouse still belongs to the branch
  // when the branch changes — see the effect in the form body.
  const { warehouses } = useWarehouseOptions();
  const { data: taxCodes, isLoading: taxCodesLoading } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  const { data: salesEmployees } = salesEmployeeApi.useList();
  // Tax (%) is now a Tax Code CFL: every active Tax Code master entry gets
  // its own option (never collapsed by rate — see buildTaxCodeOptions),
  // keyed by taxCodeId (not the rate), so two Tax Codes that happen to
  // share a rate both still show up in the dropdown, and GL posting
  // (backend/src/utils/glPosting.js) can prefer that exact Tax Code's own
  // Purchase account over GlAccountDetermination's company-wide default.
  // Filtered live to the GST/IGST family the document's own Supplier State
  // vs. Company State comparison calls for — computed inside the form body
  // below (requiredTaxFamily), since that comparison needs
  // `watch('supplierState')`.
  const { data: company, isLoading: companyLoading } = useGetCompanyDetailsQuery();
  // View toggles between the invoice list and the full-page Create/Edit
  // form — same page, no dialog/popup, per the standard CRUD page template.
  // Declared here (ahead of where it's used further down originally) so
  // editingRow is available to seed useBranchNameOptions' currentValue.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions, isLoading: branchesLoading, branches } = useBranchNameOptions({ currentValue: editingRow?.branch });
  // The masters this page cannot meaningfully render without — supplier/
  // product pickers, tax rates, branch list, the company record the tax
  // calc and Ship To block need. Gating first paint on all of them together
  // (rather than only purchaseInvoiceApi's own isLoading, as before) means
  // the page renders once with everything it needs instead of painting once
  // per response as each query resolves on its own — that trickle was the
  // "loads multiple times" re-render churn on first open. See the
  // CircularProgress guard below, which now checks this alongside the
  // existing openDocNo case.
  const mastersLoading = suppliersLoading || productsLoading || branchesLoading || taxCodesLoading || companyLoading;
  const [create, { isLoading: creating }] = purchaseInvoiceApi.useCreate();
  const [update, { isLoading: updating }] = purchaseInvoiceApi.useUpdate();
  const [remove] = purchaseInvoiceApi.useDelete();
  const [cancelInvoice] = purchaseInvoiceApi.useCancel();

  // Memoized so these option arrays are only rebuilt when the query data
  // that feeds them actually changes, instead of on every render (typing in
  // a field, opening a menu, ...) — same reasoning as the mastersLoading
  // gate above: this page used to re-render once per master query as each
  // one resolved, on top of rebuilding every option array each time.
  const supplierOptions = useMemo(
    () => (suppliers || []).map((s) => ({ label: s.supplierName, value: s.supplierName })),
    [suppliers]
  );
  // Prepared By lists every Sales Employee; Approved By is scoped to the
  // ones flagged with approval authorization on the Sales Employee master.
  const approvedByOptions = (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName }));
  // Create/edit form's Supplier field only (the shared PartyCodeSelect) —
  // shows Code/Name, value stays the supplier name. The list-view filter
  // keeps using supplierOptions (names) unchanged.
  const supplierFieldOptions = useMemo(
    () => buildPartyCodeOptions(suppliers, 'supplierCode', 'supplierName'),
    [suppliers]
  );
  // "Ship to a different customer" Customer CFL — same buildPartyCodeOptions
  // helper as the Supplier CFL above, showing Customer Code/Name, value
  // stays the customer name (matching shipToCustomer's shape).
  const shipToCustomerFieldOptions = useMemo(
    () => buildPartyCodeOptions(shipToCustomers, 'customerCode', 'customerName'),
    [shipToCustomers]
  );
  // Purchase orders and GRNs are no longer offered as dropdowns on the form —
  // they are picked through the Copy From dialogs, which scope their lists to
  // the selected supplier. Those dialogs take the raw record lists.
  // Fallback only — used when the selected branch has no address of its own
  // set on the Branch Master row (or no branch is selected yet). Ship To
  // itself now defaults from the BRANCH's address (branchShipTo below, built
  // with the selected branch's own record), not the company's head-office
  // address, so the field actually varies by branch instead of always
  // showing the same company-wide default. See branchAddressLines.js's own
  // header note: it returns [] for a missing/blank branch, which is the
  // signal to fall back to this company address rather than an empty box —
  // matching the printable's own fallback order (branch -> shipTo -> company).
  const companyShipTo = useMemo(() => {
    if (!company) return '';
    const lines = [company.companyName ? `${company.companyName} - Head Office` : '', formatAddress(company)].filter(Boolean);
    return lines.join('\n');
  }, [company]);

  // selectableProducts/productCodeOptions/productNameOptions used to live
  // here, computed from editingRow?.items — a static snapshot that only
  // reflected the record's lines as of page load. That went stale the moment
  // Copy From replaced the items array with a different document's lines, so
  // it's now computed live inside AppForm's render prop instead, keyed off
  // watchedItems (the form's actual current rows).
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Journal Entry view popup — opened from the header's "View Journal Entry"
  // icon (rendered only once editingRow.journalEntryId exists, i.e. this
  // invoice already has a linked entry). See attachJournalEntryRefs in
  // routes/resources.js for how that id is resolved server-side. Same
  // pattern as Purchase GRN's own Journal Entry link.
  const [journalViewOpen, setJournalViewOpen] = useState(false);
  // Copy From. Two pieces of state because it is a two-step control: the
  // button opens a source menu (anchored to it), and the chosen source then
  // opens the matching Find dialog. Both live at page level rather than inside
  // AppForm's render prop so remounting the form on formKey change can't leave
  // a menu or dialog orphaned open over a freshly reset form.
  const [copyFromAnchor, setCopyFromAnchor] = useState(null);
  const [copyFromSource, setCopyFromSource] = useState(null); // 'po' | 'grn' | null

  // A GRN can be picked here for as long as ANY of its lines still has
  // quantity that hasn't gone back on a return — quantity-aware, not merely
  // "has this GRN ever had a return raised against it": ordering 10 and
  // returning 1-9 still leaves something to invoice, and only returning the
  // full 10 empties it out. (A return itself can only be raised before the
  // GRN is invoiced — see assertReturnAllowed in utils/routeMap.js — so this
  // is the matching guard on the other side of that same rule.)
  //
  // Returned-so-far is summed per product code across every non-cancelled
  // Purchase Return raised against the GRN — a GRN can be returned against
  // more than once over time, and each one only carries its own increment.
  const returnedByGrnProduct = useMemo(() => {
    const totals = new Map(); // "<grnNo>::<productCode>" -> quantity returned
    (purchaseReturns || [])
      .filter((r) => r.status !== 'Cancelled' && r.grnNo)
      .forEach((r) => {
        (r.items || []).forEach((item) => {
          if (!item.productCode) return;
          const key = `${r.grnNo}::${item.productCode}`;
          totals.set(key, (totals.get(key) || 0) + (Number(item.returnQuantity) || 0));
        });
      });
    return totals;
  }, [purchaseReturns]);

  // A GRN with no lines at all is left alone (nothing to judge it by) rather
  // than being treated as fully returned.
  const fullyReturnedGrnNos = useMemo(() => {
    const fully = new Set();
    (grns || []).forEach((g) => {
      const items = g.items || [];
      if (!items.length) return;
      const somethingRemains = items.some((item) => {
        const received = Number(item.receivedQuantity) || 0;
        const returned = returnedByGrnProduct.get(`${g.grnNo}::${item.productCode}`) || 0;
        return received - returned > 0.005;
      });
      if (!somethingRemains) fully.add(g.grnNo);
    });
    return fully;
  }, [grns, returnedByGrnProduct]);

  // What the Copy From > Purchase GRN dialog is allowed to offer. A GRN whose
  // every line has already gone back on a purchase return has nothing left to
  // bill, so copying from it could only produce an invoice for goods the
  // supplier no longer holds our money for. A Cancelled one (PurchaseGRN.jsx's
  // Cancel action) is dropped the same way — it was never actually received,
  // so there is nothing to invoice against.
  //
  // This used to build the options for a GRN dropdown; it is now the record
  // list handed to the dialog. The "already on the record being edited stays
  // selectable" case the dropdown needed is gone with it — the field is
  // read-only now, so an existing invoice's own link is simply displayed and
  // never has to survive a filter to keep showing.
  const copyableGrns = useMemo(
    () => (grns || []).filter((g) => g.status !== 'Closed' && g.status !== 'Cancelled' && !fullyReturnedGrnNos.has(g.grnNo)),
    [grns, fullyReturnedGrnNos]
  );

  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('All');
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
  const pendingStatusRef = useRef('Draft');

  const rows = invoices || [];

  const baseTableRows = useMemo(() => {
    const q = '';
    const ref = refFilter.trim().toLowerCase();
    return rows.filter((r) => {
      const matchesSearch = !q || [r.invoiceNo, r.supplier, r.grnNo, r.poNo].some((v) => String(v || '').toLowerCase().includes(q));
      const matchesSupplier = !supplierFilter || r.supplier === supplierFilter.value;
      const matchesStatus = statusFilter === 'All Status' || r.status === statusFilter;
      const matchesPaymentStatus = paymentStatusFilter === 'All' || r.paymentStatus === paymentStatusFilter;
      const matchesRef = !ref || [r.grnNo, r.poNo].some((v) => String(v || '').toLowerCase().includes(ref));
      const id = r.invoiceDate ? dayjs(r.invoiceDate) : null;
      const matchesFrom = !dateFrom || (id && !id.isBefore(dateFrom, 'day'));
      const matchesTo = !dateTo || (id && !id.isAfter(dateTo, 'day'));
      return matchesSearch && matchesSupplier && matchesStatus && matchesPaymentStatus && matchesRef && matchesFrom && matchesTo;
    });
  }, [rows, supplierFilter, statusFilter, paymentStatusFilter, refFilter, dateFrom, dateTo]);

  // Column definitions drive the global search, the sort icons and the filter
  // popover — see components/data-display/useTableFeatures.js.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'invoiceNo', headerName: 'Invoice No.', filter: 'text' },
    { field: 'supplier', headerName: 'Supplier', filter: 'text' },
    { field: 'invoiceDate', headerName: 'Invoice Date', filter: 'dateRange', sortValue: (row) => (row.invoiceDate ? new Date(row.invoiceDate).getTime() : null) },
    { field: 'dueDate', headerName: 'Due Date', filter: 'dateRange', sortValue: (row) => (row.dueDate ? new Date(row.dueDate).getTime() : null) },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'status', headerName: 'Status', filter: 'select' },
    { field: 'paymentStatus', headerName: 'Payment Status', filter: 'select' },
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
    setCopyFromAnchor(null);
    setCopyFromSource(null);
  };

  const handleView = (row) => {
    setEditingRow(row);
    setReadOnly(true);
    setFormKey((k) => k + 1);
    setView('form');
  };

  // Opened from the Route Map's document preview popup: jump straight into
  // this record's own read-only View, exactly as clicking it in the list
  // would, instead of requiring the user to find and click the row.
  useEffect(() => {
    if (!openDocNo) return;
    if (editingRow && editingRow.invoiceNo === openDocNo) return;
    const match = rows.find((r) => r.invoiceNo === openDocNo);
    if (match) handleView(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openDocNo, rows]);

  // "Copy To > Purchase Invoice" lands the browser on this page's route, but
  // that alone used to leave the user on the LIST view — the intent-
  // consuming effect that actually applies the source document's data lives
  // inside AppForm's render prop below, which only mounts once `view` is
  // 'form', so nothing happened until the user clicked "+ Add New"
  // themselves first. Mirrors the openDocNo effect just above: notice a
  // pending intent addressed to this page on arrival and open the create
  // form immediately, so the user lands straight on a pre-filled invoice.
  const pendingCopyIntentForAutoOpen = useSelector((s) => s.copyIntent.pending);
  useEffect(() => {
    if (!pendingCopyIntentForAutoOpen || pendingCopyIntentForAutoOpen.targetKey !== 'purchaseInvoice') return;
    if (view === 'form') return;
    openCreate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingCopyIntentForAutoOpen]);

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setView('form');
    setRowMenuAnchor(null);
  };

  const [printRequestInvoiceNo, setPrintRequestInvoiceNo] = useState(null);

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestInvoiceNo(row.invoiceNo);
  };

  useEffect(() => {
    if (!printRequestInvoiceNo) return;
    if (!editingRow || editingRow.invoiceNo !== printRequestInvoiceNo) return;

    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      setPrintRequestInvoiceNo(null);
      backToList();
    };

    window.addEventListener('afterprint', returnToListAfterPrint);
    printPurchaseInvoice();
  }, [printRequestInvoiceNo, editingRow]);

  const handleDelete = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Delete purchase invoice',
      message: `Are you sure you want to delete "${row.invoiceNo}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Purchase invoice deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  // Cancel — a soft alternative to Delete: the invoice stays in the list
  // (status becomes "Cancelled") but is locked once isCancelled is true. The
  // backend (PATCH /purchase/invoices/:id/cancel) reverses the stock and G/L
  // this invoice posted, reopens the PO/GRN it had closed, and refuses with
  // a clear message while a payment or a live Purchase Credit Memo still
  // references it.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel purchase invoice',
      message: `Are you sure you want to cancel "${row.invoiceNo}"? This cannot be undone — the invoice will be locked and its stock and accounting entries reversed.`,
      confirmLabel: 'Cancel Invoice',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelInvoice(row.id).unwrap();
      notify.success('Purchase invoice cancelled');
    } catch (err) {
      notify.error(err?.data?.message || 'Cancel failed');
    }
  };

  const removeSelected = async () => {
    const ok = await confirmDialog({
      title: 'Delete selected purchase invoices',
      message: `Delete ${checkedIds.length} selected purchase invoice${checkedIds.length > 1 ? 's' : ''}? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await Promise.all(checkedIds.map((id) => remove(id).unwrap()));
      notify.success('Selected purchase invoices deleted');
      setCheckedIds([]);
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    // A Batch/Serial-tracked line whose quantity isn't fully accounted for
    // cannot be saved — see validateBatchSerialAllocation above. The server
    // enforces the same rule (assertBatchSerialAllocation) so this is a
    // fast local check, not the only line of defence. Only reached when
    // this invoice is direct — a GRN-backed invoice never shows the
    // Batch/Serial column and carries none of its own to check.
    const isDirect = !values.grnNo || String(values.grnNo).trim() === '';
    if (isDirect) {
      const allocationError = validateBatchSerialAllocation(values.items);
      if (allocationError) {
        notify.error(allocationError);
        return;
      }
    }
    const payload = { ...values, status: pendingStatusRef.current };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Purchase invoice updated');
      } else {
        await create(payload).unwrap();
        notify.success('Purchase invoice saved');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  const dateRangeLabel = dateFrom && dateTo
    ? `${dateFrom.format('DD/MM/YYYY')} - ${dateTo.format('DD/MM/YYYY')}`
    : 'Select date range';

  // mastersLoading added alongside the existing openDocNo wait: both are
  // "there is nothing sensible to paint yet" states, so both use the same
  // spinner rather than the page flashing its shell before the data it
  // needs has arrived.
  if ((openDocNo && (!editingRow || editingRow.invoiceNo !== openDocNo)) || mastersLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  return (
    <Box>

      {view === 'form' ? (
        <RouteMapContextMenu flow="purchase" type="invoice" docNo={editingRow?.invoiceNo}>
          <AppForm
            key={formKey}
            schema={purchaseInvoiceSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow, taxCodes) : getEmptyValues(currentUser?.name || currentUser?.email, defaultTaxCode)}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              const { control, watch, setValue } = methods;
              const { fields, append, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
              // "Copy To" hand-off — see copyIntentSlice.js and CopyToButton.jsx.
              const dispatch = useDispatch();
              const pendingCopyIntent = useSelector((s) => s.copyIntent.pending);

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
                  discountPercent: raw.discountPercent ?? 0,
                  taxCodeId: taxMatch ? taxMatch.id : null,
                  taxPercent: taxMatch ? (Number(taxMatch.taxRate) || 0) : 0,
                  warehouse: raw.warehouse || (watch('warehouse') || ''),
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
              const selectableProducts = productOptionsFor(
                products,
                PRODUCT_USAGE.PURCHASE,
                watchedItems.map((i) => i.productCode)
              );
              const productCodeOptions = selectableProducts.map((p) => ({ label: p.productCode, value: p.productCode }));
              const productNameOptions = selectableProducts.map((p) => ({ label: p.productName, value: p.productCode }));

              // Inter-state supplies are taxed wholly as IGST. Computed here
              // (ahead of the item columns/Tax (%) options below, which both
              // depend on it) by comparing State — supplierState, auto-filled
              // from the selected SUPPLIER's own Business Partner Billing
              // address (see the supplierState effect below), NOT Place of
              // Supply (which is auto-filled from the BRANCH and stays on the
              // form for printing/saving only) — against the company's
              // registered state, the same comparison the server makes when
              // it recomputes GST at save time. A purchase's GST/IGST split
              // depends on where the supplier is registered, not which
              // branch bought the goods.
              const interState = isInterState(watch('supplierState'), company?.state);
              // Tax (%) only ever offers the type this comparison calls for:
              // GST (CGST+SGST) intra-state, IGST inter-state. Recomputed live
              // as the supplier (and so State) changes, so picking a
              // different supplier switches the dropdown's contents
              // immediately rather than only on the next save.
              const requiredTaxFamily = taxTypeFamilyFor(interState);
              const taxCodeOptions = useMemo(
                () => buildTaxCodeOptions(taxCodes, { taxType: requiredTaxFamily }),
                [taxCodes, requiredTaxFamily]
              );
              const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
              // Default Tax Code for a row added via "Add Item" once the
              // supplier (and so State) is known — GST@18% intra-state,
              // IGST@18% inter-state, following the same requiredTaxFamily
              // the dropdown itself is filtered to. The plain top-level
              // defaultTaxCode (GST@18%) is still what seeds getEmptyValues'
              // very first row, since no supplier is chosen yet at that point.
              const liveDefaultTaxCode = useMemo(
                () => pickDefaultTaxCode(taxCodes, { taxType: requiredTaxFamily }),
                [taxCodes, requiredTaxFamily]
              );
              // A Tax Code left over from before State (supplierState) flipped
              // intra <-> inter-state (e.g. an IGST code still selected on a
              // line, then the user switches to a supplier registered in the
              // same state as the company) is no longer one of the options
              // above. Skipped on first render — same prevRef pattern as the
              // branch/warehouse effect above — so loading an existing,
              // already-consistent invoice for edit/view never clears its
              // rows; it only resets a row picked before the user's own
              // supplier change made it invalid.
              const prevRequiredTaxFamily = useRef(requiredTaxFamily);
              useEffect(() => {
                if (prevRequiredTaxFamily.current === requiredTaxFamily) return;
                prevRequiredTaxFamily.current = requiredTaxFamily;
                const validTaxCodeIds = new Set(taxCodeOptions.map((o) => o.value));
                watchedItems.forEach((item, idx) => {
                  if (item?.taxCodeId != null && !validTaxCodeIds.has(Number(item.taxCodeId))) {
                    // Re-default to the OTHER family's plain rate (GST<->IGST)
                    // rather than clearing the field blank — the supplier's
                    // State changing is what invalidated the old code in the
                    // first place, so the row should follow it to the new
                    // family's own default, same as a brand-new row would.
                    setValue(`items.${idx}.taxCodeId`, liveDefaultTaxCode ? liveDefaultTaxCode.id : null, { shouldValidate: true });
                    setValue(`items.${idx}.taxPercent`, liveDefaultTaxCode ? liveDefaultTaxCode.rate : null, { shouldValidate: true });
                  }
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [requiredTaxFamily, taxCodeOptions, liveDefaultTaxCode]);

              // Belt-and-braces for a brand-new invoice opened before the Tax
              // Code master had finished loading: getEmptyValues' own default
              // (defaultTaxCode, computed from taxCodes at the moment this
              // page first mounted) can resolve to nothing if that fetch was
              // still in flight, leaving the first row's Tax (%) genuinely
              // blank with no invalid code for the effect above to catch and
              // replace. This backfills it the moment Tax Codes (and so
              // liveDefaultTaxCode) become available — once only, and only
              // for a genuinely new document, so it never touches a row the
              // user (or Copy From/Smart Add/Import) deliberately left blank
              // afterwards.
              const backfilledDefaultTaxCode = useRef(false);
              useEffect(() => {
                if (editingRow || backfilledDefaultTaxCode.current || !liveDefaultTaxCode) return;
                backfilledDefaultTaxCode.current = true;
                watchedItems.forEach((item, idx) => {
                  if (item?.taxCodeId == null) {
                    setValue(`items.${idx}.taxCodeId`, liveDefaultTaxCode.id, { shouldValidate: true });
                    setValue(`items.${idx}.taxPercent`, liveDefaultTaxCode.rate, { shouldValidate: true });
                  }
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [liveDefaultTaxCode]);

              // Machine Serial No / Machine Model are only ever meaningful
              // while Purchase Type is 'Machine' — if the user picks
              // 'Machine', types into these columns, then switches Purchase
              // Type to something else, the columns disappear but the
              // now-invisible values would otherwise linger in form state
              // and silently resurface (or get saved) if the user flips
              // back. Cleared only on an actual change AWAY from 'Machine'
              // (never on first render/load, and never while just typing —
              // same prevRef guard shape as prevRequiredTaxFamily above), so
              // an existing invoice loaded with Purchase Type already
              // something other than 'Machine' is left alone rather than
              // having its (already-blank) fields rewritten on mount.
              const purchaseTypeValue = watch('purchaseType');
              const prevPurchaseTypeRef = useRef(purchaseTypeValue);
              useEffect(() => {
                if (prevPurchaseTypeRef.current === purchaseTypeValue) return;
                const wasMachine = prevPurchaseTypeRef.current === 'Machine';
                prevPurchaseTypeRef.current = purchaseTypeValue;
                if (!wasMachine || purchaseTypeValue === 'Machine') return;
                watchedItems.forEach((_item, idx) => {
                  setValue(`items.${idx}.machineSerialNo`, '', { shouldValidate: true });
                  setValue(`items.${idx}.machineModel`, '', { shouldValidate: true });
                  setValue(`items.${idx}.machineEngineNo`, '', { shouldValidate: true });
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [purchaseTypeValue]);

              // A purchase invoice with no GRN behind it is the document that
              // receives the goods (see the purchaseInvoice headerFilter in
              // backend utils/stockLedger.js), so it — and only it — has to name
              // a warehouse. With a GRN this invoice is finance-only.
              const grnNo = watch('grnNo');
              const isDirectInvoice = !grnNo || String(grnNo).trim() === '';
              const branch = watch('branch');
              // Both the header warehouse (direct invoice) and each line's own
              // warehouse need to survive edit/view even when they don't
              // belong to the currently-selected branch's list — see
              // useWarehouseOptions.js.
              const { options: branchWarehouseOptions } = useWarehouseOptions({
                currentValue: [editingRow?.warehouse, ...watchedItems.map((i) => i.warehouse)],
                branch,
              });

              // Switching branch invalidates a warehouse from the old one.
              // Skipped on first render so loading a record for edit/view does
              // not wipe the value it just loaded.
              const prevBranchRef = useRef(branch);
              useEffect(() => {
                if (prevBranchRef.current === branch) return;
                prevBranchRef.current = branch;
                const allowed = new Set(
                  (warehouses || []).filter((w) => !branch || w.branch === branch).map((w) => w.whsCode)
                );
                if (watch('warehouse') && !allowed.has(watch('warehouse'))) setValue('warehouse', '');
                (watch('items') || []).forEach((it, idx) => {
                  if (it.warehouse && !allowed.has(it.warehouse)) setValue(`items.${idx}.warehouse`, '');
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branch]);
              const headerWarehouse = watch('warehouse');
              const prevHeaderWarehouseRef = useRef(headerWarehouse);
              useEffect(() => {
                if (prevHeaderWarehouseRef.current === headerWarehouse) return;
                const oldWh = prevHeaderWarehouseRef.current;
                prevHeaderWarehouseRef.current = headerWarehouse;
                if (!headerWarehouse) return;
                // const allowed = new Set(
                //   (warehouses || []).filter((w) => !branch || w.branch === branch).map((w) => w.whsCode)
                // );
                // (watch('warehouse') && !allowed.has(watch('warehouse'))) setValue('warehouse', '');
                // Same invalidation, per row — a line's own Warehouse has no
                // more meaning under the new branch than the header's did.
                (watch('items') || []).forEach((it, idx) => {
                  if (!it.warehouse || it.warehouse === oldWh) setValue(`items.${idx}.warehouse`, headerWarehouse, { shouldValidate: true });
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [headerWarehouse]);

              // Machine Serial No / Machine Model — shown only when the
              // HEADER's Purchase Type is 'Machine' (see PURCHASE_TYPE_OPTIONS
              // in purchaseOtherDetailsOptions.js). A single header-level
              // switch that shows or hides two whole columns for every row at
              // once — read once here rather than per line.
              const isMachinePurchase = watch('purchaseType') === 'Machine';
              // Every column of this item table is sized to show its values IN FULL —
              // no ellipsis, no wrapping, no hover, however long the text is. The
              // spec below is positional: it mirrors the header row top to bottom,
              // and `null` leaves a column (the # counter, the action column) at
              // whatever width it already has. See itemTableSx in lib/columnWidth.js.
              const itemColumnsSx = itemTableSx(watchedItems, [
                null,
                { header: 'Item No', get: (i) => i?.productCode, field: 'select' },
                { header: 'Description', get: (i) => i?.productName, field: 'select' },
                { header: 'HSN/SAC', get: (i) => i?.hsnCode, field: 'text' },
                { header: 'Unit', get: (i) => i?.uom, field: 'text' },
                { header: 'Warehouse', get: (i) => i?.warehouse, field: 'select' },
                { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
                { header: 'Unit Price (₹) *', get: (i) => i?.unitPrice, field: 'text' },
                { header: 'Discount (%)', get: (i) => i?.discountPercent, field: 'text' },
                { header: 'Tax (%)', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                // Positionally matches the two conditional <TableCell>s added
                // to the JSX below — present in this descriptor array only
                // when isMachinePurchase, exactly like the JSX, so the
                // measured widths always line up 1:1 with what's actually
                // rendered. A `null` here (rather than omitting the spread)
                // would still reserve a blank cell's worth of width for a
                // column the table isn't drawing.
                ...(isMachinePurchase ? [
                  { header: 'Machine Serial No', get: (i) => i?.machineSerialNo, field: 'text' },
                  { header: 'Machine Model', get: (i) => i?.machineModel, field: 'text' },
                  { header: 'Machine Engine No.', get: (i) => i?.machineEngineNo, field: 'text' },
                ] : []),
                // Batch / Serial column (direct invoice only). It MUST have an
                // entry here: itemTableSx sizes columns by position
                // (nth-of-type), so without one the Amount width landed on the
                // Batch / Serial column and the Batch/Serial button was
                // squeezed/clipped while Amount went unsized.
                ...(isDirectInvoice ? [
                  { header: 'Batch / Serial', get: () => 'Serial: 000/000', field: 'plain', min: 130 },
                ] : []),
                { header: 'Amount (₹)', get: (i) => ((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]);
              // Discount % in the totals panel is a header-level discount taken
              // off the sum of the (already line-discounted) item amounts —
              // exactly what the server does with the `discountPercent` it
              // receives.
              //
              // It used to be a read-only mirror of whichever item row was
              // edited last, and computeTotals was called with a hard-coded 0
              // so the mirrored figure wouldn't deduct the line discount twice
              // on screen. But the mirrored figure was still posted, and the
              // server had no way to know it was only meant for display: it
              // applied that percentage on top of line amounts that already had
              // it baked in, saving a total below the one the user approved.
              const discountPercent = watch('discountPercent');
              // interState was already computed above (ahead of the Tax (%)
              // options, which need it too) — reused here rather than
              // recomputed so the totals panel and the dropdown can never
              // disagree about which state this document is in.
              // taxType (from each line's own taxCodeId) drives the TCS
              // carve-out in documentTotals.js's computeTotals -- see
              // buildTaxCodeOptions/taxCodeById above, which now carries
              // taxType alongside label/value/rate.
              const itemsForTotals = watchedItems.map((it) => ({ ...it, taxType: taxCodeById.get(it.taxCodeId)?.taxType || '' }));
              const freightNetAmount = watch('freightNetAmount');
              const freightTaxAmount = watch('freightTaxAmount');
              const totals = computeTotals(itemsForTotals, discountPercent, interState, { freightNetAmount, freightTaxAmount });

              const invoiceDateValueForRange = watch('invoiceDate');
              const dueDateMinDate = invoiceDateValueForRange ? dayjs(invoiceDateValueForRange) : undefined;

              const allValues = watch();
              const printSupplierRecord = (suppliers || []).find((s) => s.supplierName === allValues.supplier);
              const printGrnRecord = (grns || []).find((g) => g.grnNo === allValues.grnNo);
              const printPoRecord = (purchaseOrders || []).find((p) => p.poNo === allValues.poNo);
              // The Branch Master row for this document's own "Branch *" field —
              // what the print's Shipping Address box gets its address lines
              // from (see PurchaseGRNPrintable/PurchaseInvoicePrintable).
              // Matched on branchName because that is what the Branch
              // FormSelect stores: useBranchNameOptions' options are
              // {label: branchName, value: branchName}, NOT the branch id.
              const printBranchRecord = (branches || []).find((b) => b.branchName === allValues.branch);
              // items: itemsForTotals, not allValues.items — same fix
              // SalesInvoice.jsx's own printOrder already applies. A form
              // item row only ever carries taxCodeId, never the resolved
              // taxType ('GST'/'IGST'/'GST+TCS'/'IGST+TCS') itself;
              // itemsForTotals above is what joins the two (for the live
              // totals panel) and is the only place in this component that
              // has it. Passing allValues.items straight through left every
              // print item's taxType undefined, so
              // PurchaseInvoicePrintable's isTcsTaxType(it.taxType) check
              // could never see a TCS-typed line no matter what Tax Code it
              // used.
              const printOrder = { ...allValues, items: itemsForTotals, status: editingRow?.status || 'Draft' };
              // See SalesInvoice.jsx's identical approverSignatureUrl comment.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              // Ship To's own default: the selected branch's address (same
              // Branch Master row/helper the printable resolves via
              // printBranchRecord above), falling back to the company's own
              // address only when the branch carries no address of its own
              // (or none is picked yet) — see branchAddressLines.js.
              const branchShipTo = useMemo(() => {
                const lines = branchAddressLines(printBranchRecord);
                return lines.length ? lines.join('\n') : companyShipTo;
              }, [printBranchRecord, companyShipTo]);

              const supplierValue = watch('supplier');
              const prevSupplier = useRef(editingRow ? editingRow.supplier : null);
              useEffect(() => {
                if (supplierValue !== prevSupplier.current) {
                  const found = (suppliers || []).find((s) => s.supplierName === supplierValue);
                  if (found) {
                    setValue('billFrom', [found.supplierName, formatAddress(found)].filter(Boolean).join('\n'), { shouldValidate: true });
                    if (found.paymentTerms) setValue('paymentTerms', found.paymentTerms, { shouldValidate: true });
                  }
                  prevSupplier.current = supplierValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [supplierValue]);

              // State — display-only, auto-filled from the selected
              // supplier's own Business Partner record (same `.state` field
              // formatAddress reads for billFrom above), but never
              // hand-typed, so unlike billFrom this isn't gated behind "did
              // the supplier just change": it stays in sync unconditionally,
              // including populating immediately for an existing record on
              // open. This is also what drives CGST/SGST vs IGST — see
              // interState below.
              const supplierState = useMemo(
                () => (suppliers || []).find((s) => s.supplierName === supplierValue)?.state || '',
                [suppliers, supplierValue]
              );
              useEffect(() => {
                setValue('supplierState', supplierState || '', { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [supplierState]);

              // Default Ship To to the selected branch's own address, and
              // keep it in step as Branch changes — not just once when the
              // company record loads. lastAutoShipToRef remembers the value
              // WE last wrote so a branch switch only re-fills a field that
              // still holds our own previous auto-fill (or is empty); a
              // value the user typed themselves is left alone, same as the
              // rest of this form's auto-fill effects (e.g. the supplier
              // effect above, which is safe to always overwrite because
              // billFrom isn't user-typable the same way).
              const lastAutoShipToRef = useRef(editingRow ? null : '');
              const shipToDifferentCustomer = watch('shipToDifferentCustomer');
              useEffect(() => {
                if (editingRow) return;
                // "Ship to a different customer" owns Ship To while checked —
                // see the customer-driven effect below. Left alone here means
                // unchecking it (handled below too) is what hands Ship To
                // back to this branch default, rather than this effect
                // fighting the customer-derived value on every render.
                if (shipToDifferentCustomer) return;
                const current = watch('shipTo');
                if (!current || current === lastAutoShipToRef.current) {
                  if (branchShipTo !== current) {
                    setValue('shipTo', branchShipTo, { shouldValidate: true });
                  }
                  lastAutoShipToRef.current = branchShipTo;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branchShipTo, shipToDifferentCustomer]);

              // "Ship to a different customer" — unchecking it hands Ship To
              // straight back to the ordinary branch default above (and drops
              // whichever customer was selected), exactly as though the
              // checkbox had never been touched. Checking it on its own does
              // nothing yet — nothing to derive from until a customer is
              // actually picked, below.
              const prevShipToDifferentCustomer = useRef(shipToDifferentCustomer);
              useEffect(() => {
                if (prevShipToDifferentCustomer.current && !shipToDifferentCustomer) {
                  setValue('shipToCustomer', '', { shouldValidate: true });
                  setValue('shipTo', branchShipTo, { shouldValidate: true });
                  lastAutoShipToRef.current = branchShipTo;
                }
                prevShipToDifferentCustomer.current = shipToDifferentCustomer;
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [shipToDifferentCustomer]);

              // Selecting a Customer in the "ship to a different customer"
              // CFL fills Ship To from that Business Partner's own Shipping
              // Address — shipToCustomers already carries a pre-resolved
              // `shippingAddress` string per row (see toLegacyPartnerShape in
              // features/resources.js — the same field Sales Order/Delivery
              // Challan read for their own Ship To). Same "only act on an
              // actual change" shape as the supplier -> billFrom effect
              // above: it fires once per customer selection (including
              // during edit, so switching who a saved invoice ships to keeps
              // working), then leaves Ship To alone as a plain editable field
              // until the customer selection changes again — per this
              // feature's own requirement, an edit made after autofill is
              // what gets saved and printed, not the customer's address.
              //
              // Address text only (not name + address like billFrom above) —
              // the customer's name is already shown by the CFL itself, and
              // the print template (see PurchaseInvoicePrintable) reads the
              // customer's name for that box straight off the saved
              // shipToCustomer field rather than parsing it out of shipTo, so
              // folding it into this text too would just show it twice.
              const shipToCustomerValue = watch('shipToCustomer');
              const prevShipToCustomer = useRef(editingRow ? (editingRow.shipToCustomer || '') : '');
              useEffect(() => {
                if (shipToCustomerValue !== prevShipToCustomer.current) {
                  if (shipToDifferentCustomer) {
                    const found = (shipToCustomers || []).find((c) => c.customerName === shipToCustomerValue);
                    setValue('shipTo', found?.shippingAddress || '', { shouldValidate: true });
                  }
                  prevShipToCustomer.current = shipToCustomerValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [shipToCustomerValue, shipToDifferentCustomer, shipToCustomers]);


              // Copy From > Purchase GRN pulls PO No. and the item details
              // (product, HSN/SAC, unit, quantity, unit price) straight from that
              // GRN as a starting point.
              //
              // Supplier is NOT pulled across, because on this form supplier is
              // now the input rather than the output: it is what the user picks
              // first, what enables Copy From, and what the dialogs filter their
              // lists by. Every record they can offer already belongs to that
              // supplier, so copying it back would only re-set it to the value it
              // already holds.
              //
              // The pulled item columns used to render `disabled`, on the
              // grounds that they mirror the GRN and aren't invoice-specific
              // data. In practice that made it impossible to record what a
              // supplier invoice actually says: a line billed at a different
              // rate than the GRN, a corrected HSN/unit, or a charge with no
              // GRN line behind it at all. They are editable now; the GRN
              // lookup still pre-fills them, it just no longer forbids a
              // correction. Nothing downstream depends on these columns
              // matching the GRN — the invoice is its own record of what was
              // billed.
              //
              // Everything else on this form (invoice no./date, currency,
              // payment terms, due date, place of supply, bill from/ship to,
              // notes, terms, attachment) was already editable.
              //
              // This used to run as an effect watching the GRN No. dropdown. It
              // is a plain function now, called only from the dialog's Choose
              // button: an effect keyed on a form value also fires when that
              // value is restored on edit or reset, which is why it needed the
              // prevGrn bookkeeping to tell "user picked a GRN" apart from "form
              // loaded". An explicit call has no such ambiguity.
              const applyGrn = (found) => {
                if (found) {
                  setValue('grnNo', found.grnNo || '', { shouldValidate: true });
                  setValue('branch', found.branch || '', { shouldValidate: true });
                  // Only reachable via Copy To — this page's own Copy From
                  // dialog is already filtered by supplier, so it never
                  // needed this; landing here fresh from Copy To, Supplier
                  // was never carried across at all until now. Synced into
                  // prevSupplier too, so the supplier-select effect below
                  // doesn't think a new supplier was just picked and re-fire
                  // on the next render, overwriting Bill From/Payment Terms
                  // with the supplier master's own generic defaults instead
                  // of what was just set from this GRN/PO above.
                  setValue('supplier', found.supplier || '', { shouldValidate: true });
                  prevSupplier.current = found.supplier || '';
                  setValue('poNo', found.poNo || '', { shouldValidate: true });
                  setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                  setValue('notes', found.notes || '', { shouldValidate: true });
                  // The GRN itself carries no currency/discount — those live
                  // one level further up, on the Purchase Order it was
                  // received against. Reached transitively via the GRN's own
                  // poNo, same idea as the terms/notes just pulled straight
                  // off the GRN above.
                  const sourcePo = (purchaseOrders || []).find((p) => p.poNo === found.poNo);
                  if (sourcePo) {
                    setValue('currency', sourcePo.currency || 'INR', { shouldValidate: true });
                    setValue('discountPercent', sourcePo.discountPercent != null ? Number(sourcePo.discountPercent) : 0, { shouldValidate: true });
                    // Payment Terms lives on the order too, same as currency
                    // above — the GRN itself carries none.
                    setValue('paymentTerms', sourcePo.paymentTerms || '', { shouldValidate: true });
                  }
                  // Ship To itself DOES live on the GRN (the GRN now has its
                  // own real "ship to a different customer" feature, not just
                  // a mirror of the order's — see PurchaseGRN.jsx), so it
                  // takes priority over sourcePo's own shipTo above; sourcePo
                  // is only the fallback for a GRN that was saved before this
                  // feature existed (found.shipToDifferentCustomer/shipTo
                  // will both already be blank on those, same effect as
                  // before). Sync prevShipToDifferentCustomer/
                  // prevShipToCustomer to the incoming value FIRST, so the
                  // toggle-off-revert effect and the customer-autofill effect
                  // below don't see a "change" on the next render and
                  // overwrite the shipTo set explicitly here right after.
                  prevShipToDifferentCustomer.current = !!found.shipToDifferentCustomer;
                  setValue('shipToDifferentCustomer', !!found.shipToDifferentCustomer, { shouldValidate: true });
                  prevShipToCustomer.current = found.shipToCustomer || '';
                  setValue('shipToCustomer', found.shipToCustomer || '', { shouldValidate: true });
                  setValue('shipTo', found.shipTo || sourcePo?.shipTo || '', { shouldValidate: true });
                  // Carried on the GRN but previously left behind on
                  // Copy To — the Other Details block and Vendor Ref No.
                  // both exist on the GRN and the invoice.
                  setValue('billingType', found.billingType || '', { shouldValidate: true });
                  setValue('purchaseType', found.purchaseType || '', { shouldValidate: true });
                  setValue('typeOfPurchase', found.typeOfPurchase || '', { shouldValidate: true });
                  setValue('salesType', found.salesType || '', { shouldValidate: true });
                  setValue('purchaseEmployee', found.purchaseEmployee || '', { shouldValidate: true });
                  setValue('transportMode', found.transportMode || '', { shouldValidate: true });
                  setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                  setValue('vendorRefNo', found.vendorRefNo || '', { shouldValidate: true });
                  if (found.items && found.items.length) {
                    // Invoice only what the GRN received MINUS what has already
                    // gone back on a Purchase Return against it — pulling the
                    // full received quantity would let goods that were already
                    // returned get invoiced anyway. returnedByGrnProduct is the
                    // same per-product return total the GRN dropdown itself is
                    // filtered by (see fullyReturnedGrnNos above), so the two
                    // can never disagree about what's left. A line with nothing
                    // remaining is dropped rather than pulled in at zero — a
                    // zero-quantity line would fail validation anyway.
                    // `line` is captured BEFORE the filter: base_line has to
                    // name the row's position on the GRN, not its position in
                    // whatever subset survived the remaining-quantity filter.
                    const remaining = found.items
                      .map((i, n) => {
                        const received = i.receivedQuantity != null ? Number(i.receivedQuantity) : 0;
                        const returned = returnedByGrnProduct.get(`${found.grnNo}::${i.productCode}`) || 0;
                        return { item: i, line: n + 1, qty: round2(received - returned) };
                      })
                      .filter(({ qty }) => qty > 0.005);
                    const mappedItems = remaining.length
                      ? remaining.map(({ item: i, line, qty }) => ({
                        productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                        hsnCode: i.hsnCode || '', uom: i.uom || '',
                        quantity: qty,
                        unitPrice: priceListRates?.get(i.productCode) ?? (i.unitPrice != null ? Number(i.unitPrice) : 0),
                        discountPercent: 0,
                        // Preserve the GRN line's own tax rate — different
                        // lines on the same GRN can carry different GST
                        // rates, and the invoice must bill each at the same
                        // rate the goods were received at, not a flat
                        // default. See applyOrder's identical fallback below
                        // for the Copy From > Purchase Order path.
                        taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
                        taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                        // Not required on this path (the GRN already moved
                        // the stock), but carried across for the record —
                        // line-first, GRN-header fallback.
                        warehouse: i.warehouse || '',
                        // Carried straight across from the GRN line, unlike
                        // the PO leg below (applyOrder) which has no such
                        // data to bring — Copy From > Purchase GRN is the one
                        // path that already has real Machine Serial No/Model
                        // values to preserve.
                        machineSerialNo: i.machineSerialNo || '', machineModel: i.machineModel || '', machineEngineNo: i.machineEngineNo || '',
                        // Copy From: the GRN, which is the immediate source —
                        // not the PO behind it, even though the PO started the
                        // chain.
                        baseType: 'Purchase GRN',
                        baseEntry: found.id ?? null,
                        baseNo: found.grnNo || null,
                        baseLine: line,
                      }))
                      : [{ ...emptyItem }];
                    replaceItems(mappedItems);
                    // Belt-and-braces: each row's own Product Code cell
                    // (ProductCell) has its own master-lookup effect that
                    // re-fills Description/HSN/Unit/Rate from the Product
                    // Master the instant it notices a productCode change.
                    // replaceItems() giving every row a fresh field id is
                    // meant to stop that effect from treating this as a
                    // "change" in the first place, but that guard has been
                    // observed losing the race in practice (reported: Rate
                    // landing at the Product Master's own default instead of
                    // the source document's). Reasserting the correct values
                    // a moment later — after that cell's effect has had every
                    // chance to run and lose — guarantees the copied figures
                    // win regardless of exactly how that race goes.
                    if (remaining.length) {
                      setTimeout(() => {
                        mappedItems.forEach((item, idx) => {
                          setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldValidate: true });
                          setValue(`items.${idx}.hsnCode`, item.hsnCode, { shouldValidate: true });
                          setValue(`items.${idx}.uom`, item.uom, { shouldValidate: true });
                          setValue(`items.${idx}.productName`, item.productName, { shouldValidate: true });
                          setValue(`items.${idx}.taxPercent`, item.taxPercent, { shouldValidate: true });
                        });
                      }, 60);
                    }
                  }
                }
                // Force a full validation pass so any field that Copy From
                // left invalid — but that RHF hasn't touched/blurred yet —
                // shows its red error text immediately, instead of silently
                // keeping Save disabled with no visible reason.
                setTimeout(() => methods.trigger(), 0);
              };

              // Copy From > Purchase Order. Billing straight off the order —
              // before any goods are received, or for a charge that never passes
              // through a GRN at all — so the full ordered quantity is pulled
              // and there is no returns arithmetic to do: nothing can have gone
              // back on goods that were never received.
              //
              // grnNo is cleared, not left as it was: the invoice now references
              // this PO directly, and leaving a stale receipt number beside it
              // would claim a provenance the lines no longer have (their
              // baseType/baseNo below name the order).
              const applyOrder = (found) => {
                if (!found) return;
                setValue('poNo', found.poNo || '', { shouldValidate: true });
                setValue('grnNo', '', { shouldValidate: true });
                setValue('branch', found.branch || '', { shouldValidate: true });
                // Only reachable via Copy To (not this page's own Copy From
                // menu) — see the matching note on applyGrn above.
                setValue('supplier', found.supplier || '', { shouldValidate: true });
                prevSupplier.current = found.supplier || '';
                setValue('currency', found.currency || 'INR', { shouldValidate: true });
                setValue('paymentTerms', found.paymentTerms || '', { shouldValidate: true });
                // Carry the order's "ship to a different customer" selection
                // across too, not just the resolved shipTo text — same
                // reasoning and same ref-sync-first pattern as applyGrn
                // above (PurchaseOrder.jsx now has this feature too).
                prevShipToDifferentCustomer.current = !!found.shipToDifferentCustomer;
                setValue('shipToDifferentCustomer', !!found.shipToDifferentCustomer, { shouldValidate: true });
                prevShipToCustomer.current = found.shipToCustomer || '';
                setValue('shipToCustomer', found.shipToCustomer || '', { shouldValidate: true });
                setValue('shipTo', found.shipTo || '', { shouldValidate: true });
                setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                setValue('notes', found.remarks || '', { shouldValidate: true });
                // The order's own header-level discount was never carried
                // across — it's a real PurchaseOrder field (order items
                // themselves carry no discount of their own, which is why
                // each copied line's discountPercent stays 0 below).
                setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                // Carried on the order but previously left behind on
                // Copy To — see the matching fix on applyGrn above.
                setValue('billingType', found.billingType || '', { shouldValidate: true });
                setValue('purchaseType', found.purchaseType || '', { shouldValidate: true });
                setValue('typeOfPurchase', found.typeOfPurchase || '', { shouldValidate: true });
                setValue('salesType', found.salesType || '', { shouldValidate: true });
                setValue('purchaseEmployee', found.purchaseEmployee || '', { shouldValidate: true });
                setValue('transportMode', found.transportMode || '', { shouldValidate: true });
                setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                setValue('vendorRefNo', found.vendorRefNo || '', { shouldValidate: true });
                if (found.items && found.items.length) {
                  const mappedItems = found.items.map((i, n) => ({
                    productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                    hsnCode: i.hsnCode || '', uom: i.uom || '',
                    quantity: i.quantity != null ? Number(i.quantity) : 1,
                    unitPrice: priceListRates?.get(i.productCode) ?? (i.unitPrice != null ? Number(i.unitPrice) : 0),
                    discountPercent: 0,
                    taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
                    taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                    // Required on this path (billed direct off the order,
                    // no GRN — this invoice is what moves the stock). The
                    // order's own line may already carry one; otherwise
                    // fall back to whatever the invoice header already has.
                    warehouse: i.warehouse || '',
                    // Copy From: the PO, which is the immediate source here —
                    // this invoice was raised against the order, not a receipt.
                    baseType: 'Purchase Order',
                    baseEntry: found.id ?? null,
                    baseNo: found.poNo || null,
                    baseLine: n + 1,
                    // The Purchase Order has no Machine Serial No/Model of
                    // its own (they only ever exist on GRN/Invoice lines),
                    // so there is nothing to carry across here. Set
                    // explicitly to '' rather than omitted, matching every
                    // other controlled field on this row.
                    machineSerialNo: '', machineModel: '', machineEngineNo: '',
                  }));
                  replaceItems(mappedItems);
                  // Belt-and-braces reassert — see the matching comment on
                  // applyGrn above.
                  setTimeout(() => {
                    mappedItems.forEach((item, idx) => {
                      setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldValidate: true });
                      setValue(`items.${idx}.hsnCode`, item.hsnCode, { shouldValidate: true });
                      setValue(`items.${idx}.uom`, item.uom, { shouldValidate: true });
                      setValue(`items.${idx}.productName`, item.productName, { shouldValidate: true });
                      setValue(`items.${idx}.taxPercent`, item.taxPercent, { shouldValidate: true });
                    });
                  }, 60);
                }
                setTimeout(() => methods.trigger(), 0);
              };

              // "Copy To > Purchase Invoice" from a Purchase Quotation — not
              // reachable from this page's own Copy From menu (PO/GRN only),
              // only from the intent-consuming effect below. Billed direct off
              // the quotation, before any PO/GRN exists, so — like applyOrder
              // above — there is no returns arithmetic to do.
              const applyQuotation = (found) => {
                if (!found) return;
                setValue('poNo', '', { shouldValidate: true });
                setValue('grnNo', '', { shouldValidate: true });
                setValue('branch', found.branch || '', { shouldValidate: true });
                // Only reachable via Copy To — see the matching note on
                // applyGrn above.
                setValue('supplier', found.supplier || '', { shouldValidate: true });
                prevSupplier.current = found.supplier || '';
                setValue('currency', found.currency || 'INR', { shouldValidate: true });
                setValue('paymentTerms', found.paymentTerms || '', { shouldValidate: true });
                setValue('shipTo', found.shipTo || '', { shouldValidate: true });
                setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                // Carried on the quotation but previously left behind on
                // Copy To (the quotation has no Other Details block, so
                // this is all there is to bring across).
                setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                if (found.items && found.items.length) {
                  const mappedItems = found.items.map((i, n) => ({
                    productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                    hsnCode: i.hsnCode || '', uom: i.uom || '',
                    quantity: i.quantity != null ? Number(i.quantity) : 1,
                    unitPrice: priceListRates?.get(i.productCode) ?? (i.unitPrice != null ? Number(i.unitPrice) : 0),
                    discountPercent: 0,
                    taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
                    taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                    warehouse: i.warehouse || '',
                    baseType: 'Purchase Quotation',
                    baseEntry: found.id ?? null,
                    baseNo: found.quotationNo || null,
                    baseLine: n + 1,
                  }));
                  replaceItems(mappedItems);
                  // Belt-and-braces reassert — see the matching comment on
                  // applyGrn above.
                  setTimeout(() => {
                    mappedItems.forEach((item, idx) => {
                      setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldValidate: true });
                      setValue(`items.${idx}.hsnCode`, item.hsnCode, { shouldValidate: true });
                      setValue(`items.${idx}.uom`, item.uom, { shouldValidate: true });
                      setValue(`items.${idx}.productName`, item.productName, { shouldValidate: true });
                      setValue(`items.${idx}.taxPercent`, item.taxPercent, { shouldValidate: true });
                    });
                  }, 60);
                }
                setTimeout(() => methods.trigger(), 0);
              };

              // "Copy To > Purchase Invoice" from a Purchase Return — also
              // only reachable via the intent-consuming effect below, not this
              // page's own Copy From menu. Each returned line's own
              // returnQuantity becomes the invoice line's quantity.
              const applyReturn = (found) => {
                if (!found) return;
                setValue('poNo', '', { shouldValidate: true });
                setValue('grnNo', found.grnNo || '', { shouldValidate: true });
                setValue('branch', found.branch || '', { shouldValidate: true });
                // Only reachable via Copy To — see the matching note on
                // applyGrn above.
                setValue('supplier', found.supplier || '', { shouldValidate: true });
                prevSupplier.current = found.supplier || '';
                setValue('termsConditions', found.termsConditions || '', { shouldValidate: true });
                setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                // Carried on the return but previously left behind on
                // Copy To (the return schema has no Other Details block, so
                // this is all there is to bring across).
                setValue('approvedBy', found.approvedBy || '', { shouldValidate: true });
                setValue('paymentTerms', found.paymentTerms || '', { shouldValidate: true });
                const items = (found.items || []).filter((i) => (Number(i.returnQuantity) || 0) > 0.005);
                const mappedItems = items.length
                  ? items.map((i, n) => ({
                    productCode: i.productCode || '', productName: i.productName || '', description: i.description || '',
                    hsnCode: i.hsnCode || '', uom: i.uom || '',
                    quantity: Number(i.returnQuantity) || 0,
                    unitPrice: priceListRates?.get(i.productCode) ?? (i.unitPrice != null ? Number(i.unitPrice) : 0),
                    discountPercent: i.discountPercent != null ? Number(i.discountPercent) : 0,
                    taxPercent: i.taxPercent != null ? Number(i.taxPercent) : 18,
                    taxCodeId: i.taxCodeId != null ? Number(i.taxCodeId) : null,
                    warehouse: i.warehouse || '',
                    baseType: 'Purchase Return',
                    baseEntry: found.id ?? null,
                    baseNo: found.returnNo || null,
                    baseLine: n + 1,
                  }))
                  : [{ ...emptyItem }];
                replaceItems(mappedItems);
                // Belt-and-braces reassert — see the matching comment on
                // applyGrn above.
                if (items.length) {
                  setTimeout(() => {
                    mappedItems.forEach((item, idx) => {
                      setValue(`items.${idx}.unitPrice`, item.unitPrice, { shouldValidate: true });
                      setValue(`items.${idx}.hsnCode`, item.hsnCode, { shouldValidate: true });
                      setValue(`items.${idx}.uom`, item.uom, { shouldValidate: true });
                      setValue(`items.${idx}.productName`, item.productName, { shouldValidate: true });
                      setValue(`items.${idx}.taxPercent`, item.taxPercent, { shouldValidate: true });
                    });
                  }, 60);
                }
                setTimeout(() => methods.trigger(), 0);
              };

              // Undo a Copy From: drop both links and the values that came
              // across with them, rather than leaving a stale document's figures
              // sitting in an invoice that no longer claims to reference it.
              //
              // Supplier is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialogs off and force a
              // re-pick just to try a different source from the same vendor.
              const grnValue = watch('grnNo');
              const poValue = watch('poNo');
              const clearSource = () => {
                setValue('grnNo', '', { shouldValidate: true });
                setValue('poNo', '', { shouldValidate: true });
                setValue('termsConditions', '', { shouldValidate: true });
                setValue('notes', '', { shouldValidate: true });
                setValue('currency', 'INR', { shouldValidate: true });
                setValue('shipTo', branchShipTo || '', { shouldValidate: true });
                lastAutoShipToRef.current = branchShipTo;
                setValue('discountPercent', 0, { shouldValidate: true });
                replaceItems([{ ...emptyItem }]);
              };

              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

              // Due Date auto-calculated from Payment Terms (e.g. "45 Days")
              // off of Invoice Date, mirroring Sales Invoice's identical rule.
              // Stored the same way FormDatePicker itself stores a pick: a
              // UTC-midnight Date, not a local-time one, so the value that
              // round-trips back through the picker doesn't drift a day
              // depending on the browser's timezone. Only fires on an actual
              // user change to either field, not on initial load of an
              // existing invoice, so it doesn't clobber a due date that was
              // manually adjusted away from the term's default.
              const paymentTermsValue = watch('paymentTerms');
              const invoiceDateValue = watch('invoiceDate');
              const prevPaymentTerms = useRef(editingRow ? editingRow.paymentTerms : null);
              const prevInvoiceDate = useRef(editingRow ? editingRow.invoiceDate : null);
              useEffect(() => {
                const termsChanged = paymentTermsValue !== prevPaymentTerms.current;
                const dateChanged = invoiceDateValue !== prevInvoiceDate.current;
                if (termsChanged || dateChanged) {
                  if (paymentTermsValue) {
                    const days = Number(paymentTermsValue.match(/\d+/)?.[0] || 0);
                    const base = invoiceDateValue ? dayjs(invoiceDateValue) : dayjs();
                    const due = base.add(days, 'day');
                    setValue('dueDate', new Date(Date.UTC(due.year(), due.month(), due.date())), { shouldValidate: true });
                  }
                  prevPaymentTerms.current = paymentTermsValue;
                  prevInvoiceDate.current = invoiceDateValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [paymentTermsValue, invoiceDateValue]);

              // Consume a pending "Copy To" intent addressed to this page —
              // see copyIntentSlice.js and CopyToButton.jsx.
              useEffect(() => {
                if (!pendingCopyIntent || pendingCopyIntent.targetKey !== 'purchaseInvoice') return;
                if (pendingCopyIntent.sourceType === 'purchaseOrder') applyOrder(pendingCopyIntent.sourceDoc);
                else if (pendingCopyIntent.sourceType === 'purchaseGRN') applyGrn(pendingCopyIntent.sourceDoc);
                else if (pendingCopyIntent.sourceType === 'purchaseQuotation') applyQuotation(pendingCopyIntent.sourceDoc);
                else if (pendingCopyIntent.sourceType === 'purchaseReturn') applyReturn(pendingCopyIntent.sourceDoc);
                dispatch(clearCopyIntent());
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [pendingCopyIntent]);

              return (
                // minWidth: 0 is required — fieldsets default to min-width: min-content,
                // which lets the wide item table blow out the page width on mobile.
                // The Back to List button is kept outside the fieldset so it stays
                // clickable in read-only (view) mode -- a native <fieldset disabled>
                // disables every descendant control, buttons included.
                <>
                  {/* One dialog component, two configurations — which one is
                  mounted follows the source picked from the Copy From menu. */}
                  <CopyFromDocumentDialog
                    open={copyFromSource === 'po'}
                    onClose={() => setCopyFromSource(null)}
                    onChoose={applyOrder}
                    documents={copyablePurchaseOrders}
                    party={supplierValue}
                    title="Find Purchase Order"
                    columns={PO_COPY_COLUMNS}
                    emptyMessage="No purchase orders found for"
                  />
                  <CopyFromDocumentDialog
                    open={copyFromSource === 'grn'}
                    onClose={() => setCopyFromSource(null)}
                    onChoose={applyGrn}
                    documents={copyableGrns}
                    party={supplierValue}
                    title="Find Purchase Receipt"
                    columns={GRN_COPY_COLUMNS}
                    emptyMessage="No goods receipts left to invoice for"
                  />
                  <Menu
                    anchorEl={copyFromAnchor}
                    open={Boolean(copyFromAnchor)}
                    onClose={() => setCopyFromAnchor(null)}
                  >
                    <MenuItem onClick={() => { setCopyFromAnchor(null); setCopyFromSource('po'); }}>
                      <ListItemText primary="Purchase Order" secondary="Bill against an order" />
                    </MenuItem>
                    <MenuItem onClick={() => { setCopyFromAnchor(null); setCopyFromSource('grn'); }}>
                      <ListItemText primary="Purchase GRN" secondary="Bill against goods received" />
                    </MenuItem>
                  </Menu>
                  <PurchaseInvoicePrintable
                    order={printOrder}
                    company={company}
                    supplierRecord={printSupplierRecord}
                    grnRecord={printGrnRecord}
                    poRecord={printPoRecord}
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
                        {/* Two columns, top to bottom: Branch / Supplier /
                        Vendor Reference No. / Payment Terms / Currency on the
                        left, Invoice No. / Supplier Name / Invoice Date / Due
                        Date / GRN No. on the right — FormGrid(columns=2) lays
                        fields out left-right-left-right, so the order below IS
                        the column assignment. (Place of Supply used to be
                        pulled out into its own single-column grid right after
                        this — removed entirely, see supplierState above.)
                        Billing From / Shipping To close the card in a
                        grid of their own: both are multiline (rows=3), so
                        pairing them keeps the row's two halves the same
                        height — pairing a multiline field against a
                        single-line one is what produced the visible gap bug
                        fixed elsewhere this session. */}
                        <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                          <LabeledField label="Branch *">
                            <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} fullWidth />
                          </LabeledField>
                          <LabeledField label="Invoice No. *">
                            {/* DocumentSeriesNoField splits into a series-select
                            + number-display pair internally; each inner control
                            is already fullWidth, but the split itself renders
                            narrower-looking than a single plain field, so the
                            outer Box pins its own boundary to the full column
                            width to keep this row matching the plain fields
                            around it. */}
                            <Box sx={{ width: '100%' }}>
                              <DocumentSeriesNoField documentCode="PI" seriesFieldName="seriesId" numberFieldName="invoiceNo" isCreate={!editingRow} />
                            </Box>
                          </LabeledField>

                          {/* Supplier drives this form now: it is picked first, it
                          enables Copy From, and it scopes the lists both
                          dialogs show. It used to be disabled and filled only
                          by the GRN dropdown, which made an invoice without a
                          GRN impossible to enter. */}
                          <LabeledField label="Supplier *">
                            <PartyCodeSelect name="supplier" label="" placeholder="Select supplier" options={supplierFieldOptions} showNameBelow={false} fullWidth />
                          </LabeledField>
                          {/* Read-only echo of the selected supplier's full
                          name — the Supplier field just stores/shows the
                          code, so this is what tells the user which supplier
                          that code actually is. Not a stored field: it just
                          displays the current value of `supplier`, which
                          already holds the supplier's name. Same pattern as
                          Purchase Order/Purchase Quotation's Supplier Name
                          field. */}
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

                          <LabeledField label="Invoice Date *">
                            <FormDatePicker name="invoiceDate" label="" maxDate={dayjs()} triggerFields={['dueDate']} fullWidth />
                          </LabeledField>

                          <LabeledField label="Payment Terms *">
                            <FormSelect name="paymentTerms" label="" placeholder="Select payment terms" options={SUPPLIER_PAYMENT_TERMS_OPTIONS} fullWidth />
                          </LabeledField>
                          <LabeledField label="Due Date *">
                            <FormDatePicker name="dueDate" label="" minDate={dueDateMinDate} triggerFields={['invoiceDate']} fullWidth />
                          </LabeledField>

                          <LabeledField label="Currency *">
                            <FormSelect name="currency" label="" options={currencyOptions} fullWidth />
                          </LabeledField>
                          {/* Display-only, auto-filled from the selected
                          supplier's own Business Partner record — see the
                          supplierState useMemo above. */}
                          <LabeledField label="State">
                            <FormTextField name="supplierState" label="" placeholder="Supplier state" disabled fullWidth />
                          </LabeledField>
                        </FormGrid>

                        <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                          <LabeledField label="Billing From" align="flex-start">
                            <FormTextField name="billFrom" label="" placeholder="Supplier billing address" multiline rows={3} fullWidth disabled />
                          </LabeledField>
                          {/* Shipping To: unchecked (default) keeps deriving
                          from the selected Branch exactly as before this
                          checkbox existed — see branchShipTo/lastAutoShipToRef
                          above. Checked reveals the Customer CFL below it;
                          picking a customer there fills Shipping To from that
                          Business Partner's own Shipping Address instead (see
                          the shipToCustomerValue effect above). Either way the
                          field itself is a plain editable textarea now (it
                          used to be permanently disabled) so a hand edit after
                          autofill is what actually gets saved/printed, per
                          this feature's own requirement. */}
                          <LabeledField label="Shipping To" align="flex-start">
                            <Box sx={{ width: '100%' }}>
                              <FormCheckbox name="shipToDifferentCustomer" label="Ship to a different customer" compact />
                              {shipToDifferentCustomer && (
                                <Box sx={{ mb: 1 }}>
                                  <PartyCodeSelect
                                    name="shipToCustomer"
                                    label=""
                                    placeholder="Select customer"
                                    options={shipToCustomerFieldOptions}
                                    showNameBelow={false}
                                    fullWidth
                                    disabled={shipToCustomersLoading}
                                  />
                                </Box>
                              )}
                              <FormTextField name="shipTo" label="" placeholder="Branch delivery address" multiline rows={3} fullWidth />
                            </Box>
                          </LabeledField>
                        </FormGrid>
                      </fieldset>

                      {/* Deliberately OUTSIDE the <fieldset disabled={readOnly}> above —
                      see the matching comment on Purchase GRN for why: a native
                      <fieldset disabled> disables every descendant control,
                      plain <button>s included, which would silently kill this
                      icon's onClick in View mode, the one place it matters most. */}
                      {editingRow?.journalEntryNo && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1.5 }}>
                          <Typography variant="caption" color="text.secondary">Journal Entry:</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>{editingRow.journalEntryNo}</Typography>
                          <Tooltip title="View Journal Entry">
                            <IconButton
                              size="small"
                              type="button"
                              onClick={() => setJournalViewOpen(true)}
                            >
                              <VisibilityOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      )}
                    </CardContent>
                  </Card>

                  <PurchaseOtherDetailsCard />

                  <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                    <Card variant="outlined" sx={{ mb: 2 }}>
                      <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                          <Typography variant="subtitle1" fontWeight={700}>Item Details</Typography>
                          <Stack direction="row" spacing={1.5}>
                            <Button type="button" variant="outlined" color="inherit" size="small" startIcon={<UploadFileIcon />} onClick={() => setItemsImportOpen(true)}>
                              Import from Excel
                            </Button>
                            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append(withDefaultTaxCode({ ...emptyItem, warehouse: watch('warehouse') || '' }, liveDefaultTaxCode))}>
                              Add Item
                            </Button>
                          </Stack>
                        </Stack>

                        {isMobile ? (
                          <Box>
                            {fields.map((field, index) => {
                              const qty = Number(watch(`items.${index}.quantity`)) || 0;
                              const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                              const itemDiscount = Number(watch(`items.${index}.discountPercent`)) || 0;
                              const gross = qty * price;
                              const rowAmount = gross - gross * (itemDiscount / 100);
                              return (
                                <MobileItemCard
                                  key={field.id}
                                  index={index}
                                  amount={rowAmount.toFixed(2)}
                                  onRemove={() => removeItem(index)}
                                  removeDisabled={fields.length <= 1}
                                >
                                  <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} label="Item No" placeholder="Select product" />
                                  <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} label="Description" placeholder="Select product" />
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                    <FormTextField name={`items.${index}.hsnCode`} label="HSN/SAC" placeholder="4, 6 or 8 digits" digitsOnly maxLength={8} />
                                    <FormTextField name={`items.${index}.uom`} label="Unit" placeholder="Unit" />
                                    <WarehouseCodeSelect name={`items.${index}.warehouse`} label={isDirectInvoice ? 'Warehouse *' : 'Warehouse'} placeholder={branch ? 'Select warehouse' : 'Select a branch first'} options={branchWarehouseOptions} disabled={!branch} />
                                    <FormTextField name={`items.${index}.quantity`} label="Quantity *" type="number" />
                                    <AvailableStockCell index={index} methods={methods} products={products} />
                                    <FormTextField name={`items.${index}.unitPrice`} label="Unit Price (₹) *" type="number" />
                                    <FormTextField name={`items.${index}.discountPercent`} label="Discount (%)" type="number" />
                                    <FormSelect name={`items.${index}.taxCodeId`} label="Tax (%)" options={taxCodeOptions} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
                                  </Box>
                                  {isMachinePurchase ? (
                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5, mt: 1.5 }}>
                                      <FormTextField name={`items.${index}.machineSerialNo`} label="Machine Serial No" placeholder="Serial No" />
                                      <FormTextField name={`items.${index}.machineModel`} label="Machine Model" placeholder="Model" />
                                      <FormTextField name={`items.${index}.machineEngineNo`} label="Machine Engine No." placeholder="Engine No" />
                                    </Box>
                                  ) : null}
                                  {/* Batch/Serial capture — only the direct path
                                  receives goods of its own; a GRN-backed line
                                  carries none, the GRN already created them. */}
                                  {isDirectInvoice && (
                                    <Box sx={{ mt: 1.5 }}>
                                      <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
                                    </Box>
                                  )}
                                </MobileItemCard>
                              );
                            })}
                          </Box>
                        ) : (
                          <TableContainer ref={itemScrollRef} sx={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', cursor: 'grab', ...dragScrollbarSx }}>
                            <Table size="small" sx={[itemColumnsSx, { '& tbody .MuiFormHelperText-root:not(.Mui-error)': { display: 'none' } }]}>
                              <TableHead>
                                <TableRow>
                                  <TableCell width={40}>#</TableCell>
                                  <TableCell>Item No *</TableCell>
                                  <TableCell>Description</TableCell>
                                  <TableCell>HSN/SAC</TableCell>
                                  <TableCell>Unit</TableCell>
                                  <TableCell>{isDirectInvoice ? 'Warehouse *' : 'Warehouse'}</TableCell>
                                  <TableCell>Quantity *</TableCell>
                                  <TableCell>Unit Price (₹) *</TableCell>
                                  <TableCell>Discount (%)</TableCell>
                                  <TableCell>Tax (%)</TableCell>
                                  {isMachinePurchase ? (
                                    <>
                                      <TableCell>Machine Serial No</TableCell>
                                      <TableCell>Machine Model</TableCell>
                                      <TableCell>Machine Engine No.</TableCell>
                                    </>
                                  ) : null}
                                  {isDirectInvoice && (
                                    <TableCell>Batch / Serial</TableCell>
                                  )}
                                  <TableCell align="right">Amount (₹)</TableCell>
                                  <TableCell width={48} />
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {fields.map((field, index) => {
                                  const qty = Number(watch(`items.${index}.quantity`)) || 0;
                                  const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                                  const itemDiscount = Number(watch(`items.${index}.discountPercent`)) || 0;
                                  const gross = qty * price;
                                  const rowAmount = gross - gross * (itemDiscount / 100);
                                  return (
                                    <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                      <TableCell>{index + 1}</TableCell>
                                      <TableCell>
                                        <ProductCell index={index} methods={methods} options={productCodeOptions} products={products} priceListRates={priceListRates} placeholder="Select product" />
                                      </TableCell>
                                      <TableCell>
                                        <ProductCell index={index} methods={methods} options={productNameOptions} products={products} priceListRates={priceListRates} placeholder="Select product" />
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
                                        <AvailableStockCell index={index} methods={methods} products={products} />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.unitPrice`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.discountPercent`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormSelect name={`items.${index}.taxCodeId`} label="" options={taxCodeOptions} disableClearable sx={{ minWidth: 96 }} popupFitContent onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })} />
                                      </TableCell>
                                      {isMachinePurchase ? (
                                        <>
                                          <TableCell>
                                            <FormTextField name={`items.${index}.machineSerialNo`} label="" placeholder="Serial No" />
                                          </TableCell>
                                          <TableCell>
                                            <FormTextField name={`items.${index}.machineModel`} label="" placeholder="Model" />
                                          </TableCell>
                                          <TableCell>
                                            <FormTextField name={`items.${index}.machineEngineNo`} label="" placeholder="Engine No" />
                                          </TableCell>
                                        </>
                                      ) : null}
                                      {isDirectInvoice && (
                                        <TableCell>
                                          <BatchSerialCell index={index} methods={methods} product={productsByCode[watch(`items.${index}.productCode`)]} onOpen={(mode) => setBatchDialog({ index, mode })} />
                                        </TableCell>
                                      )}
                                      <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{rowAmount.toFixed(2)}</TableCell>
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
                              <DocumentTotalsPanel totals={totals} interState={interState} discountField={null} showFreight />
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
                        {/* Copy From sits immediately left of Cancel and stays
                          disabled until a Supplier is chosen — the dialogs it
                          leads to list that supplier's orders and receipts, so
                          with no supplier there is nothing for them to show.
                          Hidden in view mode, where nothing is being filled
                          in. */}
                        {!readOnly && (
                          (grnValue || poValue) ? (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              color="inherit"
                              startIcon={<CloseIcon />}
                              onClick={clearSource}
                              disabled={creating || updating}
                            >
                              Clear Copied {grnValue ? 'GRN' : 'Order'}
                            </Button>
                          ) : (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              startIcon={<ContentCopyOutlinedIcon />}
                              endIcon={<ArrowDropDownIcon />}
                              onClick={(e) => setCopyFromAnchor(e.currentTarget)}
                              disabled={!supplierValue || creating || updating}
                            >
                              Copy From
                            </Button>
                          )
                        )}
                        <Button fullWidth={isMobile} type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                          Cancel
                        </Button>
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printPurchaseInvoice()}>
                          Print
                        </Button>
                        {!readOnly && (
                          <>
                            <FormSubmitButton
                              fullWidth={isMobile}
                              variant="outlined"
                              onClick={() => { pendingStatusRef.current = 'Draft'; }}
                              disabled={creating || updating}
                              loading={creating || updating}
                            >
                              Save as Draft
                            </FormSubmitButton>
                            <FormSubmitButton
                              fullWidth={isMobile}
                              onClick={() => { pendingStatusRef.current = 'Posted'; }}
                              disabled={creating || updating}
                              loading={creating || updating}
                            >
                              {editingRow ? 'Update Invoice' : 'Save & Post Invoice'}
                            </FormSubmitButton>
                          </>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>

                  {batchDialog && batchDialog.index < fields.length && (
                    <BatchSerialSetupDialog
                      open
                      onClose={() => setBatchDialog(null)}
                      mode={batchDialog.mode}
                      readOnly={readOnly}
                      docNo={editingRow?.invoiceNo}
                      itemNumber={watch(`items.${batchDialog.index}.productCode`)}
                      itemDescription={watch(`items.${batchDialog.index}.productName`)}
                      warehouseCode={watch(`items.${batchDialog.index}.warehouse`) || watch('warehouse')}
                      warehouseName={(branchWarehouseOptions.find((w) => w.value === (watch(`items.${batchDialog.index}.warehouse`) || watch('warehouse'))) || {}).label}
                      totalNeeded={Number(watch(`items.${batchDialog.index}.quantity`)) || 0}
                      value={watch(`items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batches' : 'serials'}`)}
                      onSave={(rows) => setValue(
                        `items.${batchDialog.index}.${batchDialog.mode === 'Batch' ? 'batches' : 'serials'}`,
                        rows,
                        { shouldValidate: true }
                      )}
                    />
                  )}

                  <JournalEntryViewDialog
                    open={journalViewOpen}
                    journalEntryId={editingRow?.journalEntryId}
                    onClose={() => setJournalViewOpen(false)}
                  />
                  <ImportItemsDialog
                    open={itemsImportOpen}
                    onClose={() => setItemsImportOpen(false)}
                    resourceName="Items"
                    templateUrl="/purchase/invoices/items-import/template"
                    importUrl="/purchase/invoices/items-import"
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
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'stretch', md: 'center' }}
              justifyContent="space-between"
              flexWrap="wrap"
              gap={1.5}
              sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}
            >
              <Typography variant="subtitle1" fontWeight={700}>Purchase Invoice List</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} flexWrap="wrap" useFlexGap sx={{ width: { xs: '100%', md: 'auto' } }}>
                <TableSearchFilter table={table} placeholder="Search by invoice no., supplier, GRN/PO..." showFilter={false} />
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
                        endIcon={<ArrowDropDownIcon />}
                        onClick={openCreate}
                        sx={{ width: { xs: '100%', sm: 'auto' }, height: 40, whiteSpace: 'nowrap' }}
                      >
                        Create Invoice
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
                    fullWidth
                    options={supplierOptions}
                    value={supplierFilter}
                    onChange={(v) => { setSupplierFilter(v); setPage(0); }}
                  />
                  <Autocomplete
                    size="small"
                    fullWidth
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
                  <TextField
                    size="small"
                    fullWidth
                    label="Reference (GRN / PO No.)"
                    value={refFilter}
                    onChange={(e) => { setRefFilter(e.target.value); setPage(0); }}
                    placeholder="Enter GRN or PO no."
                    InputLabelProps={{ shrink: true }}
                  />
                  <Autocomplete
                    size="small"
                    fullWidth
                    options={PAYMENT_STATUS_FILTERS}
                    value={paymentStatusFilter}
                    onChange={(_e, v) => { setPaymentStatusFilter(v || 'All'); setPage(0); }}
                    disableClearable
                    renderInput={(params) => <TextField {...params} label="Payment Status" InputLabelProps={{ shrink: true }} />}
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
                    title={row.invoiceNo}
                    statusChip={<Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Supplier', value: row.supplier || '—' },
                      { label: 'Invoice Date', value: row.invoiceDate ? dayjs(row.invoiceDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Due Date', value: row.dueDate ? dayjs(row.dueDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
                      { label: 'Payment Status', value: row.paymentStatus || '—' },
                    ]}
                    // Cancelled invoices are fully locked — only the status chip
                    // shows "Cancelled".
                    onEdit={row.isCancelled || row.status === 'Cancelled' ? undefined : () => handleEdit(row)}
                    onDelete={row.isCancelled || row.status === 'Cancelled' ? undefined : () => handleDelete(row)}
                    extraActions={row.isCancelled || row.status === 'Cancelled' ? [] : [
                      { key: 'cancel', label: 'Cancel', icon: <CancelOutlinedIcon fontSize="small" />, color: 'warning', onClick: () => handleCancel(row) },
                    ]}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchase invoices found" message="Add your first purchase invoice to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: PURCHASE_INVOICE_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${PURCHASE_INVOICE_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${PURCHASE_INVOICE_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="invoiceNo" sort={table.sort} onSort={table.toggleSort}>Invoice No.</SortableHeaderCell>
                      <SortableHeaderCell field="supplier" sort={table.sort} onSort={table.toggleSort}>Supplier</SortableHeaderCell>
                      <SortableHeaderCell field="invoiceDate" sort={table.sort} onSort={table.toggleSort}>Invoice Date</SortableHeaderCell>
                      <SortableHeaderCell field="dueDate" sort={table.sort} onSort={table.toggleSort}>Due Date</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="amount" sort={table.sort} onSort={table.toggleSort}>Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <SortableHeaderCell field="paymentStatus" sort={table.sort} onSort={table.toggleSort}>Payment Status</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.invoiceNo}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.supplier || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.invoiceDate ? dayjs(row.invoiceDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.dueDate ? dayjs(row.dueDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={row.paymentStatus} color={PAYMENT_STATUS_COLORS[row.paymentStatus] || 'default'} variant="outlined" />
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="View">
                              <IconButton size="small" onClick={() => handleView(row)} aria-label="view">
                                <VisibilityOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <RouteMapButton flow="purchase" type="invoice" docNo={row.invoiceNo} />
                            <Tooltip title="Print">
                              <IconButton size="small" onClick={() => handlePrint(row)} aria-label="print">
                                <PrintOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            {!(row.isCancelled || row.status === 'Cancelled') && (
                              <CanCancel>
                                <Tooltip title="Cancel">
                                  <IconButton size="small" color="warning" onClick={() => handleCancel(row)} aria-label="cancel">
                                    <CancelOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </CanCancel>
                            )}
                            {!(row.isCancelled || row.status === 'Cancelled') && (
                              <IconButton
                                size="small"
                                onClick={(e) => { setRowMenuAnchor(e.currentTarget); setRowMenuTarget(row); }}
                                aria-label="more actions"
                              >
                                <MoreVertIcon fontSize="small" />
                              </IconButton>
                            )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!isLoading && filteredRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={11}>
                          <EmptyState icon={<ShoppingCartOutlinedIcon sx={{ fontSize: 48 }} />} title="No purchase invoices found" message="Add your first purchase invoice to get started" />
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
        resourceName="Purchase Invoices"
        templateUrl="/purchase/invoices/bulk-import/template"
        importUrl="/purchase/invoices/bulk-import"
        onImported={refetchInvoices}
      />
    </Box>
  );
}

// Isolated so the per-row product-select auto-fill effect only re-runs for
// the row whose product actually changed, not every row on every keystroke.
// Both the Item No and Description columns are selects over the same
// underlying items.{index}.productCode field — Item No lists codes,
// Description lists names. Both render disabled here: invoice items come
// straight from the selected GRN's item list (see the grnNo effect above,
// which calls replaceItems), so the product on an invoice row isn't
// something the user picks by hand — it's whatever the GRN said, read-only.
function ProductCell({ index, methods, options, products, priceListRates, label = '', placeholder = 'Select product', disabled = false, multiline = false, sx }) {
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
      label: otherSelectedCodes.has(String(opt.value).trim().toUpperCase()) ? `${opt.label} (Already selected)` : opt.label,
    }));
  }, [options, otherSelectedCodes]);

  useEffect(() => {
    if (productCodeValue !== prevValue.current) {
      if (productCodeValue) {
        const normalized = String(productCodeValue).trim().toUpperCase();

        if (otherSelectedCodes.has(normalized)) {
          const duplicateIdx = allItems.findIndex((it, i) => i !== index && String(it?.productCode).trim().toUpperCase() === normalized);
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
      // A different product means different batches/serials: whatever was
      // captured for the previous product must not ride along to this one
      // (it would be saved against the wrong item and show a stale
      // "Batch: 5/5" on a product that has never been set up). Only runs on
      // a real change -- prevValue starts equal to the loaded value, so
      // opening a saved invoice never wipes its allocations.
      if (prevValue.current !== productCodeValue) {
        setValue(`items.${index}.batches`, [], { shouldValidate: true });
        setValue(`items.${index}.serials`, [], { shouldValidate: true });
      }
      prevValue.current = productCodeValue;
      trigger('items')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productCodeValue]);

  return (
    <FormSelect
      name={`items.${index}.productCode`}
      label={label}
      placeholder={placeholder}
      options={optionsWithDisabledLabel}
      getOptionDisabled={(opt) => otherSelectedCodes.has(String(opt.value).trim().toUpperCase())}
      disabled={disabled}
      multiline={multiline}
      sx={sx}
      popupFitContent
    />
  );
}
// Same button/dialog trigger as PurchaseGRN.jsx's own BatchSerialCell —
// shows Batch/Serial allocation progress for this line and opens
// BatchSerialSetupDialog on click. Only ever mounted on the direct path (see
// the isDirectInvoice gate at both call sites).
function BatchSerialCell({ index, methods, product, onOpen }) {
  const { watch } = methods;
  const trackingMode = product?.manageItemBy;
  if (trackingMode !== 'Batch' && trackingMode !== 'Serial') {
    // No item picked yet vs. an item that simply isn't batch/serial tracked
    // (Product Master > Manage Item By = None) -- say which, instead of an
    // identical dash that looks like the feature is broken.
    const hasItem = Boolean(watch(`items.${index}.productCode`));
    return (
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {hasItem ? 'Not tracked' : 'Select item'}
      </Typography>
    );
  }
  const needed = Number(watch(`items.${index}.quantity`)) || 0;
  const batches = watch(`items.${index}.batches`) || [];
  const serials = watch(`items.${index}.serials`) || [];
  const allocated = trackingMode === 'Batch'
    ? batches.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
    : serials.length;
  const complete = needed > 0 && Math.abs(allocated - needed) < 0.005;

  return (
    <Button
      type="button"
      size="small"
      variant="outlined"
      color={complete ? 'success' : 'warning'}
      startIcon={<Inventory2OutlinedIcon fontSize="small" />}
      onClick={() => onOpen(trackingMode)}
      sx={{ whiteSpace: 'nowrap' }}
    >
      {trackingMode}: {allocated}/{needed}
    </Button>
  );
}

function AvailableStockCell({ index, methods, products }) {
  const { watch } = methods;
  const productCode = watch(`items.${index}.productCode`);
  const lineWarehouse = watch(`items.${index}.warehouse`);
  const headerWarehouse = watch('warehouse');
  const warehouse = lineWarehouse || headerWarehouse;
  // A non-inventory product (Product Master's Inventory Item unchecked) is
  // never stock-tracked — no ledger posting, no quantity validation, on the
  // server (see attachInventoryItemFlag in routes/resources.js) — so its
  // line gets a neutral placeholder here instead of a live figure.
  const isNonInventory = (products || []).find((p) => p.productCode === productCode)?.inventoryItem === false;
  const { onHand, isLoading } = useWarehouseStock(isNonInventory ? null : productCode, warehouse);

  if (!productCode || !warehouse) return null;
  if (isNonInventory) {
    return (
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'nowrap', mt: 0.25 }}>
        In Stock: —
      </Typography>
    );
  }
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', whiteSpace: 'nowrap', mt: 0.25 }}>
      {isLoading ? 'In Stock: …' : `In Stock: ${onHand}`}
    </Typography>
  );
}