import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatPartnerAddress, cleanAddressText } from '../../lib/addressFormat';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../../store/authSlice';
import { useNavigate } from 'react-router-dom';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
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
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import EventIcon from '@mui/icons-material/Event';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import BoltIcon from '@mui/icons-material/Bolt';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import AccountCircleOutlinedIcon from '@mui/icons-material/AccountCircleOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import usePriceListRates from '../../hooks/usePriceListRates';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import WarehouseCodeSelect from '../../components/form/WarehouseCodeSelect';
import PartyCodeSelect, { buildPartyCodeOptions } from '../../components/form/PartyCodeSelect';
import SalesShipTo from '../../components/form/SalesShipTo';
import { applySalesPartyAddresses } from '../../lib/salesPartyAddress';
import MachineryCodeSelect from '../../components/form/MachineryCodeSelect';
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
import { salesQuotationSchema, QUOTATION_STATUS_OPTIONS } from '../../lib/validation/salesSchemas';
import { buildDocument, round2, isInterState, computeFreightGross, computeItemDiscountTotal } from '../../lib/documentTotals';
import DocumentTotalsPanel from '../../components/form/DocumentTotalsPanel';
import { PRICE_LIST_OPTIONS } from '../../lib/validation/partnerSchemas';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import { salesQuotationApi, salesOrderApi, deliveryChallanApi, salesInvoiceApi, customerApi, supplierApi, productApi, taxCodeApi, enquiryApi, salesEmployeeApi, houseBankApi, useSendSalesQuotationWhatsAppMutation } from '../../features/resources';
import SalesQuotationPrintable, { printSalesQuotation, captureSalesQuotationPdf } from '../../components/print/SalesQuotationPrintable';
import { useBranchNameOptions } from '../../lib/useBranchOptions';
import { useWarehouseOptions, warehouseCodesForBranch } from '../../lib/useWarehouseOptions';
import { productOptionsFor, PRODUCT_USAGE } from '../../lib/productUsage';
import { buildTaxCodeOptions, taxTypeFamilyFor, pickDefaultTaxCode, withDefaultTaxCode } from '../../lib/taxCodeOptions';
import { itemTableSx } from '../../lib/columnWidth';
import { useGetCompanyDetailsQuery, usePeekDocumentNumberMutation } from '../../features/company/companyDetailsApi';
import { peekNextDocumentNumber } from '../../components/form/DocumentNoField';
import DocumentSeriesNoField from '../../components/form/DocumentSeriesNoField';
import useServerListTable from '../../components/data-display/useServerListTable';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer, { dragScrollbarSx } from '../../components/data-display/ScrollableTableContainer';

import { CanAdd, CanEdit, CanDelete, CanCancel } from '../../components/common/PermissionGate';
import BulkImportDialog from '../../components/common/BulkImportDialog';
import ImportItemsDialog from '../../components/common/ImportItemsDialog';
import SmartAddHistoryDialog from '../../components/common/SmartAddHistoryDialog';
import { canDelete } from '../../config/deleteConfig';
import { canDuplicate } from '../../config/duplicateConfig';
import TableFilterPanel from '../../components/data-display/TableFilterPanel';
import EmptyState from '../../components/data-display/EmptyState';
import RouteMapButton from '../../components/common/RouteMapButton';
import RouteMapContextMenu from '../../components/common/RouteMapContextMenu';
import CopyFromDocumentDialog from '../../components/common/CopyFromDocumentDialog';
import CopyToButton from '../../components/common/CopyToButton';
import WhatsAppShareButton from '../../components/common/WhatsAppShareButton';

// Columns for the "Find Sales Enquiry" dialog opened by Copy From. The party
// column here is `customerName` — the sales chain's equivalent of the purchase
// documents' `supplier` — which is also what the dialog filters on.
const ENQUIRY_COPY_COLUMNS = [
  { field: 'enquiryNo', headerName: 'Enquiry No', nowrap: true },
  { field: 'customerName', headerName: 'Customer Name' },
  { field: 'enquiryDate', headerName: 'Document Date', type: 'date' },
  { field: 'status', headerName: 'Status' },
];
// warehouse: '' — no header warehouse exists on a quotation to seed this
// from, so a new row simply starts blank until picked. See
// salesQuotationItemSchema in lib/validation/salesSchemas.js.
const emptyItem = { productCode: '', productName: '', description: '', hsnCode: '', uom: '', quantity: 1, unitPrice: 0, discountPercent: 0, taxPercent: 18, taxCodeId: null, warehouse: '' };

// "Other Details" classification fields — fixed-option (CFL-style) selects,
// not free text. Billing Type/Purchase Type/Type of Purchase/Type of
// Sales/Transport Mode reuse the exact same vocabulary as Purchase Order's
// own "Other Details" section (see PurchaseOrder.jsx).
const BILLING_TYPE_OPTIONS = ['B2B', 'B2C'].map((v) => ({ label: v, value: v }));
const SALES_TYPE_OPTIONS = ['UPI', 'NEFT', 'CASH', 'CHECK', 'DEBIT/CREDIT CARD'].map((v) => ({ label: v, value: v }));
const SALES_CATEGORY_OPTIONS = ['Parts', 'Machine', 'Services', 'Claims'].map((v) => ({ label: v, value: v }));
// A Machine-category quotation always routes approval to this one fixed
// Sales Employee -- Approved By becomes locked/read-only rather than a
// picker (see the salesCategoryValue === 'Machine' branches below).
// Parts/Services/Claims are unaffected: Approved By there is still the
// same employee picker, scoped to approvalAuthorization === true.
const MACHINE_APPROVER_EMPLOYEE_CODE = 'KE2021000';
const TYPE_OF_PURCHASE_OPTIONS = [
  'Breakdown with Warranty', 'Stock Order', 'Machine Order', 'Non Warranty Order',
  'Branch Transfer', 'Services', 'Standard Priority Order', 'Sales', 'Admin',
].map((v) => ({ label: v, value: v }));
const TRANSPORT_MODE_OPTIONS = ['Road', 'Air', 'Rail', 'Ship'].map((v) => ({ label: v, value: v }));

// Best-effort reverse lookup for rows saved before taxCodeId existed (or a
// row whose Tax Code was since made Inactive/retired): picks the first
// active Tax Code with a matching rate so the field isn't just left blank.
// If more than one active code shares that rate, which one comes back here
// is genuinely a guess — that ambiguity is exactly the bug taxCodeId exists
// to prevent going forward (see the schema.prisma comment on
// SalesQuotationItem.taxCodeId); it can't be resolved retroactively for a
// line the app never recorded a Tax Code against in the first place.
function buildTaxCodeIdByRate(taxCodes) {
  const map = new Map();
  for (const t of (taxCodes || [])) {
    if (t.status !== 'Active') continue;
    const rate = t.taxRate == null ? 0 : Number(t.taxRate);
    if (!map.has(rate)) map.set(rate, t.id);
  }
  return map;
}

// Ship From/Ship To are frozen, derived display fields — not user-editable
// free text. Formatting mirrors PurchaseOrder.jsx's own
// formatBusinessPartnerAddress (Ship From auto-fill there), reused verbatim
// here so a Business Partner address reads identically on both sides.
function formatBusinessPartnerAddress(addr) {
  // Address Name, Street, Street No, Building/Floor/Room, Block, Country,
  // State, City, Zip Code -- see lib/addressFormat.js (no double commas).
  return formatPartnerAddress(addr);
}

// Picks the customer's default (or first) address of the given type
// ('Billing' or 'Shipping') off their Business Partner record's addresses
// array — customerApi rows already carry `.addresses` (see resources.js'
// makeLegacyPartnerApi), same as supplierApi on the Purchase side.
function customerAddressFor(customerRecord, addressType) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === addressType);
  const chosen = list.find((a) => a.isDefault) || list[0];
  return formatBusinessPartnerAddress(chosen) || '';
}

// GST No. field — same "customer's own Business Partner default (or first)
// Billing address" lookup deriveBillingType already does, just returning the
// GST number itself instead of the B2B/B2C classification derived from it.
function customerGstNo(customerRecord) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
  const chosen = list.find((a) => a.isDefault) || list[0];
  return (chosen?.gstNumber || '').trim();
}

// GSTIN format check — same regex as lib/validation/common.js' gstin(),
// reused verbatim so "valid GST number" means the same thing here as it
// does on the Business Partner Address form that captures it.
const GSTIN_FORMAT_REGEX = /^\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z][A-Z0-9]$/;

// Billing Type is frozen/derived, not hand-picked: B2B when the customer's
// own Business Partner default (or first) Billing address carries a
// non-empty, valid-format GST number, B2C otherwise.
function deriveBillingType(customerRecord) {
  const list = (customerRecord?.addresses || []).filter((a) => a.addressType === 'Billing');
  const chosen = list.find((a) => a.isDefault) || list[0];
  const gst = (chosen?.gstNumber || '').trim().toUpperCase();
  return GSTIN_FORMAT_REGEX.test(gst) ? 'B2B' : 'B2C';
}

function getEmptyValues(preparedBy, defaultTaxCode) {
  return {
    customerState: '',
    quotationNo: '', seriesId: '', branch: '', customer: '', supplier: '', contactPerson: '', phone: '', email: '', machineryCode: '', gstNo: '',
    // Valid Till defaults to 10 days out from today, same rule as every
    // other "valid till" field (Purchase Quotation's Valid Upto included) —
    // computed here (inside the function, not a module-level constant) so
    // each new quotation gets it relative to the day it's actually created.
    quotationDate: new Date(), expiryDate: dayjs().add(10, 'day').toDate(), referenceNo: '',
    // The enquiry this quotation answers — optional, since a quotation raised
    // directly with no enquiry behind it is normal. See the Enquiry No. field
    // below and the Route Map it feeds.
    enquiryNo: '',
    currency: 'INR', priceList: '', receiver: '', receiverPhone: '', billingAddress: '', shippingAddress: '', shipToDifferentCustomer: false, shipToCustomer: '', billToDifferentCustomer: false, billToCustomer: '', billToGstNo: '', billToGstType: '', billToPanNo: '', shipToGstNo: '', shipToGstType: '', shipToPanNo: '', salesPerson: '',
    termsConditions: '', preparedBy: preparedBy || '', approvedBy: '', attachmentName: '', discountPercent: 0, status: 'Open',
    // "Other Details" classification fields — see the constants above.
    billingType: '', typeOfPurchase: '', salesType: '', transportMode: '', invoiceType: '', salesCategory: 'Parts',
    // Freight Charges — see FreightChargesEditor. freightGrossAmount is kept
    // in sync live by that component; the rest just start blank.
    freightTransportId: null, freightName: '', freightRemarks: '', freightTaxCodeId: null,
    freightTaxAmount: 0, freightNetAmount: 0, freightGrossAmount: 0,
    // Road Tax is a Yes/No toggle on this document — see computeTotals below
    // and DocumentTotalsPanel's roadTaxCheckboxField. Off by default.
    roadTaxApplicable: false,
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
// Freight Charges is intentionally NOT folded into Taxable Amount here.
// Freight Charges already carries its own tax (freight.netAmount/taxAmount,
// entered via FreightChargesEditor), so folding its net into the taxable
// base and running it through the same per-line GST ratio as the goods
// double-taxes it: once implicitly via the inflated ratio, and again
// explicitly when freight.taxAmount used to get added to grandTotal below.
// Taxable Amount, CGST/SGST and the 8.2% Road Tax surcharge below all now
// derive from the goods-only amount; Freight Charges' Net + Tax
// (freightGrossAmount) is added to Grand Total as a single already-taxed
// lump sum instead. Must stay in lockstep with the backend mirror in
// backend/src/routes/resources.js's computeSalesQuotationTotals.
function computeTotals(items, discountPercent, interState = false, freight = {}, roadTaxApplicable = false) {
  const { totals } = buildDocument(items, discountPercent, {
    interState,
    roundOff: true,
  });
  const roadTax = roadTaxApplicable ? round2(totals.amount * 0.082) : 0;
  // Road Tax is added after the engine's own whole-number rounding pass, so
  // it can reintroduce fractional cents into the Grand Total. Do a second
  // rounding pass here and fold its delta into the displayed Round Off so
  // Round Off keeps reconciling with Grand Total whenever Road Tax applies.
  const preRoundWithRoadTax = round2(totals.amount + roadTax);
  const amountWithRoadTax = Math.round(preRoundWithRoadTax);
  const additionalRoundOff = round2(amountWithRoadTax - preRoundWithRoadTax);
  const combinedRoundOff = round2((totals.roundOff || 0) + additionalRoundOff);
  const freightGrossAmount = computeFreightGross(freight.netAmount, freight.taxAmount);
  return {
    ...totals,
    // Sum of every line's own discount — see computeItemDiscountTotal's own
    // comment. Read-only in the totals panel now (discountField={null}
    // below); the header Discount % field/editable-percent UI is gone from
    // this document, item-level discount is the only discount that exists.
    discount: computeItemDiscountTotal(items),
    roadTax,
    roundOff: combinedRoundOff,
    freightGrossAmount,
    grandTotal: round2(amountWithRoadTax + freightGrossAmount),
  };
}

function rowToFormValues(row, taxCodes) {
  const taxCodeIdByRate = buildTaxCodeIdByRate(taxCodes);
  return {
    customerState: row.customerState || '',
    quotationNo: row.quotationNo, seriesId: '', branch: row.branch || '', customer: row.customer || '', supplier: row.supplier || '', contactPerson: row.contactPerson || '', gstNo: row.gstNo || '',
    phone: row.phone || '', email: row.email || '', machineryCode: row.machineryCode || '',
    quotationDate: row.quotationDate, expiryDate: row.expiryDate, referenceNo: row.referenceNo || '',
    enquiryNo: row.enquiryNo || '',
    currency: row.currency || 'INR', priceList: row.priceList || '',
    receiver: row.receiver || '', receiverPhone: row.receiverPhone || '',
    billingAddress: cleanAddressText(row.billingAddress), shippingAddress: cleanAddressText(row.shippingAddress), shipToDifferentCustomer: !!row.shipToDifferentCustomer, shipToCustomer: row.shipToCustomer || '', billToDifferentCustomer: false, billToCustomer: '', billToGstNo: row.billToGstNo || '', billToGstType: row.billToGstType || '', billToPanNo: row.billToPanNo || '', shipToGstNo: row.shipToGstNo || '', shipToGstType: row.shipToGstType || '', shipToPanNo: row.shipToPanNo || '', salesPerson: row.salesPerson || '',
    termsConditions: row.termsConditions || '', preparedBy: row.preparedBy || '', approvedBy: row.approvedBy || '', attachmentName: row.attachmentName || '',
    discountPercent: row.discountPercent != null ? Number(row.discountPercent) : 0, status: row.status || 'Draft',
    billingType: row.billingType || '', typeOfPurchase: row.typeOfPurchase || '',
    salesType: row.salesType || '', transportMode: row.transportMode || '', invoiceType: row.invoiceType || '', salesCategory: row.salesCategory || 'Parts',
    machineSerialNo: row.machineSerialNo || '', engineNo: row.engineNo || '', hypothecation: row.hypothecation || '', customerRefNo: row.customerRefNo || '',
    freightTransportId: row.freightTransportId != null ? Number(row.freightTransportId) : null,
    freightName: row.freightName || '', freightRemarks: row.freightRemarks || '',
    freightTaxCodeId: row.freightTaxCodeId != null ? Number(row.freightTaxCodeId) : null,
    freightTaxAmount: row.freightTaxAmount != null ? Number(row.freightTaxAmount) : 0,
    freightNetAmount: row.freightNetAmount != null ? Number(row.freightNetAmount) : 0,
    freightGrossAmount: row.freightGrossAmount != null ? Number(row.freightGrossAmount) : 0,
    roadTaxApplicable: !!row.roadTaxApplicable,
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
      // No header warehouse to fall back to on this document — see emptyItem.
      warehouse: i.warehouse || '',
    })),
  };
}

const PAGE_SIZE = 10;
const STATUS_FILTERS = ['All Status', ...QUOTATION_STATUS_OPTIONS];

// Open (not yet ordered against) amber, Closed (an order was raised) green.
// Set by the server — see recomputeSalesQuotationStatus in backend
// utils/documentFlow.js — so there is no status control on the form.
const STATUS_COLORS = { Open: 'warning', Closed: 'success', Cancelled: 'error' };

const SALES_QUOTATION_LIST_TABLE_ROW_HEIGHT = 0;
const SALES_QUOTATION_LIST_TABLE_CELL_PADDING_Y = 6;
export default function SalesQuotation({ openDocNo } = {}) {
  const currentUser = useSelector(selectCurrentUser);
  // Every currency dropdown reads live from Currency Master instead of a
  // hardcoded list — see lib/currencyOptions.js.
  const currencyOptions = useCurrencyOptions();
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const [sendQuotationWhatsAppMutation, { isLoading: sendingQuotationWhatsApp }] = useSendSalesQuotationWhatsAppMutation();
  // Shared by both the form footer's WhatsAppShareButton (already viewing
  // the row being sent) and the list row's own icon (which first switches
  // into viewing that row -- see handleSendRowWhatsApp below -- so that by
  // the time this runs, captureSalesQuotationPdf() is screenshotting THIS
  // row's printable, not whatever was on screen before).
  const handleSendQuotationWhatsApp = async (row) => {
    try {
      const pdfBlob = await captureSalesQuotationPdf();
      const formData = new FormData();
      formData.append('file', pdfBlob, `${row.quotationNo || 'quotation'}.pdf`);
      const targetPhone = row.phone || (customers || []).find((c) => c.customerName === row.customer || c.customerCode === row.customer)?.phone;
      if (targetPhone) formData.append('phone', targetPhone);
      await sendQuotationWhatsAppMutation({ id: row.id, formData }).unwrap();
      notify.success('Sent via WhatsApp');
    } catch (err) {
      notify.error(err?.data?.message || err?.message || 'Could not send via WhatsApp');
    }
  };
  const isMobile = useIsMobileListView();
  const itemScrollRef = useDragScroll();
  // Phase 6 of the data-loading performance work (pure data-access, no
  // business-logic change) — the list below now fetches ONE page at a time
  // via salesQuotationApi.useListPaged (see useServerListTable below and the
  // paginatedFindMany-based /sales/quotations route in
  // backend/src/routes/resources.js), instead of the whole quotation table.
  // `quotationsForHistory`/orders/challans/invoices below stay on
  // `.useList()` — they feed allSalesDocuments, a cross-document lookup that
  // needs to see records across the whole set, not one page — but that call
  // is itself now capped server-side (see paginatedFindMany's
  // `maxPageSize`) instead of genuinely unbounded.
  const { data: quotationsForHistory } = salesQuotationApi.useList();
  const { data: orders } = salesOrderApi.useList();
  const { data: challans } = deliveryChallanApi.useList();
  const { data: invoices } = salesInvoiceApi.useList();
  const allSalesDocuments = useMemo(
    () => [
      ...(quotationsForHistory || []),
      ...(orders || []),
      ...(challans || []),
      ...(invoices || []),
    ],
    [quotationsForHistory, orders, challans, invoices]
  );
  const { data: customers } = customerApi.useList();
  // Supplier (Business Partner / Vendor) chosen on "Customer & Document
  // Details" so their logo can be printed alongside the KEMACH logo — see
  // the `supplier` field/printSupplierRecord below and
  // SalesQuotationPrintable.jsx.
  const { data: suppliers } = supplierApi.useList();
  const { data: products } = productApi.useList({ view: 'picker' });
  const { rates: priceListRates } = usePriceListRates('CLP');
  const { data: enquiries } = enquiryApi.useList();
  const { data: salesEmployees } = salesEmployeeApi.useList();
  const salesPersonOptions = (salesEmployees || []).map((s) => ({ label: s.employeeName, value: s.employeeName }));
  // Prepared By lists every Sales Employee; Approved By is scoped to the
  // ones flagged with approval authorization on the Sales Employee master.
  const approvedByOptions = (salesEmployees || []).filter((s) => s.approvalAuthorization === true).map((s) => ({ label: s.employeeName, value: s.employeeName }));
  // Without this, SalesQuotationPrintable's houseBank prop is always
  // undefined and the Bank Name/Branch/A/c No/IFSC/Type fields print blank
  // — same fix as SalesOrder.jsx/SalesInvoice.jsx.
  const { data: houseBanks } = houseBankApi.useList();
  const printHouseBank = useMemo(
    () => (houseBanks || []).find((b) => b.isDefault === true) || (houseBanks || []).find((b) => b.status === 'Active') || null,
    [houseBanks]
  );
  // An Enquiry already marked Closed has already been quoted (or otherwise
  // resolved), so it's dropped from the Copy From dialog's pickable list.
  const copyableEnquiries = useMemo(
    () => (enquiries || []).filter((e) => e.status !== 'Closed'),
    [enquiries]
  );
  const { data: taxCodes } = taxCodeApi.useList();
  // A brand-new item row's Tax (%) CFL defaults to this Tax Code instead of
  // showing empty — see pickDefaultTaxCode's own doc comment.
  const defaultTaxCode = useMemo(() => pickDefaultTaxCode(taxCodes), [taxCodes]);
  // Keyed by Tax Code id, not by rate — this document has no Place of
  // Supply/taxType filter, so a GST code and an IGST code sharing a rate
  // (e.g. both 18%) are both real, distinct options; keying by rate would
  // collapse them into one and leave no way to tell which was picked (see
  // the schema.prisma comment on SalesQuotationItem.taxCodeId, and
  // buildTaxCodeOptions in taxCodeOptions.js).
  const taxCodeOptions = useMemo(() => buildTaxCodeOptions(taxCodes), [taxCodes]);
  // Tax (%) shows the tax code's own NAME in the closed field, which runs
  // well past the bare rate the row stores — so the item table sizes that
  // column from the rendered label it finds here, not from the raw number.
  const taxCodeById = useMemo(() => new Map(taxCodeOptions.map((o) => [o.value, o])), [taxCodeOptions]);
  const { data: company } = useGetCompanyDetailsQuery();
  const [create, { isLoading: creating }] = salesQuotationApi.useCreate();
  const [update, { isLoading: updating }] = salesQuotationApi.useUpdate();
  const [remove] = salesQuotationApi.useDelete();
  const [cancelQuotation] = salesQuotationApi.useCancel();
  const [peekDocumentNumber] = usePeekDocumentNumberMutation();

  const customerOptions = (customers || []).map((c) => ({ label: c.customerName, value: c.customerName }));
  // Create/edit form's Customer field only (the shared PartyCodeSelect) —
  // shows Code/Name, value stays the customer name. The list-view filter
  // keeps using customerOptions (names) unchanged.
  // Memoized so typing in the form doesn't rebuild a fresh options array
  // (and fresh option objects) on every keystroke, which was racing
  // Autocomplete's own filtered/highlighted state and intermittently
  // showing stale/unrelated rows while typing quickly.
  const customerFieldOptions = useMemo(
    () => buildPartyCodeOptions(customers, 'customerCode', 'customerName'),
    [customers]
  );
  // Same Code/Name party-select shape as customerFieldOptions, for the new
  // Supplier field.
  const supplierFieldOptions = useMemo(
    () => buildPartyCodeOptions(suppliers, 'supplierCode', 'supplierName'),
    [suppliers]
  );

  // View toggles between the quotation list and the full-page Create/Edit
  // form — same page, no dialog/popup, per the standard CRUD page template.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  const { options: branchOptions, branches } = useBranchNameOptions({ currentValue: editingRow?.branch });

  // selectableProducts/productCodeOptions/productNameOptions used to live
  // here, computed from editingRow?.items — a static snapshot that only
  // reflected the record's lines as of page load. That went stale the moment
  // Copy From replaced the items array with a different document's lines, so
  // it's now computed live inside AppForm's render prop instead, keyed off
  // watchedItems (the form's actual current rows).
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  // Copy From ("Find Sales Enquiry") dialog. Held at page level rather than
  // inside AppForm's render prop so remounting the form on formKey change
  // can't leave a dialog orphaned open over a freshly reset form.
  const [copyFromOpen, setCopyFromOpen] = useState(false);
  const [dateAnchor, setDateAnchor] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState([]);

  // Enquiries are no longer offered as a dropdown on the form — they are
  // picked through the Copy From dialog, which scopes the list to the selected
  // customer and shows the number, name, date and status as columns rather
  // than crushing them into one "SE/26/0130 — Kaefer Insulation LLC" label.
  // The raw `enquiries` list is what that dialog takes.
  //
  // The dropdown's "keep the saved enquiry in the list even when it isn't in
  // the fetched set" rule is gone with it: the field is read-only now, so an
  // existing quotation's own link is simply displayed and never has to survive
  // a filter to keep showing.
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [rowMenuTarget, setRowMenuTarget] = useState(null);
  const pendingStatusRef = useRef('Draft');

  // Column definitions drive the global search, the sort icons and the
  // per-column filter popover — see useServerListTable.js. `server: true`
  // pushes that column's sort/filter to the /sales/quotations route (see its
  // SALES_QUOTATION_FILTER_SPEC/SALES_QUOTATION_SORT_FIELDS in
  // backend/src/routes/resources.js) instead of applying it only to
  // whatever page happens to already be loaded. The Customer/Status/Date
  // Range Autocomplete row below (the page's own bespoke filter UI) writes
  // into this SAME `table.filters` state via `table.setFilter` — one filter
  // engine, two widgets, so neither can silently disagree with the other
  // about what "filtered" means.
  const tableColumns = useMemo(() => ([
    { field: 'id', headerName: 'Select', filter: false, searchable: false },
    { field: 'quotationNo', headerName: 'Quotation No.', filter: 'text', server: true },
    { field: 'customer', headerName: 'Customer', filter: 'text', server: true },
    { field: 'quotationDate', headerName: 'Quotation Date', filter: 'dateRange', server: true, sortValue: (row) => (row.quotationDate ? new Date(row.quotationDate).getTime() : null) },
    { field: 'expiryDate', headerName: 'Valid Till', filter: 'dateRange', sortValue: (row) => (row.expiryDate ? new Date(row.expiryDate).getTime() : null) },
    { field: 'amount', headerName: 'Amount (₹)', filter: 'numberRange', sortValue: (row) => (row.amount == null || row.amount === '' ? null : Number(row.amount)) },
    { field: 'status', headerName: 'Status', filter: 'select', server: true },
  ]), []);
  const table = useServerListTable(salesQuotationApi.useListPaged, {
    columns: tableColumns,
    initialPageSize: PAGE_SIZE,
  });
  const { page, setPage, pageSize, setPageSize } = table;
  const rows = table.rows;
  const filteredRows = rows;
  const isLoading = table.isLoading;
  const refetchQuotations = table.refetch;

  const customerFilter = table.filters.customer ? { value: table.filters.customer } : null;
  const setCustomerFilter = (v) => table.setFilter('customer', v?.value || '');
  const statusFilter = table.filters.status || 'All Status';
  const setStatusFilter = (v) => table.setFilter('status', v === 'All Status' ? '' : v);
  const quotationDateFilter = table.filters.quotationDate || {};
  const dateFrom = quotationDateFilter.from ? dayjs(quotationDateFilter.from) : null;
  const dateTo = quotationDateFilter.to ? dayjs(quotationDateFilter.to) : null;
  const setDateFrom = (v) => table.setFilter('quotationDate', { ...quotationDateFilter, from: v ? v.format('YYYY-MM-DD') : '' });
  const setDateTo = (v) => table.setFilter('quotationDate', { ...quotationDateFilter, to: v ? v.format('YYYY-MM-DD') : '' });

  // checkedIds used to be pruned here against every loaded quotation so a
  // row deleted out from under a checked box (elsewhere, or by another
  // tab/user) couldn't leave "Delete Selected (N)" counting an id that no
  // longer exists. Only ONE page of quotations is loaded at a time now (see
  // the Phase 6 comment above), so that same prune can no longer tell
  // "gone" apart from "just not on this page" — pruning against the loaded
  // page would wipe out a selection made on a page the user has since
  // navigated away from. Left unpruned; the bulk-delete handler already
  // deletes one id at a time and reports per-row failures, so a stale id
  // here surfaces as a normal "not found" error on that one row instead of
  // a crash.

  const pagedRows = rows;

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
    setCopyFromOpen(false);
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

  // Printing a row from the list needs the FORM to actually finish
  // re-rendering with THIS row's data before window.print() runs -- a fixed
  // setTimeout(..., 300) is a guess, and when it fires too early the
  // previously-viewed document (e.g. a Sales Order looked at earlier in
  // this tab's session) is still what's on screen and gets printed/opened
  // instead. printRequestQuotationNo + the effect below only fire the
  // print once editingRow has actually become the row that was clicked.
  const [printRequestQuotationNo, setPrintRequestQuotationNo] = useState(null);

  const handlePrint = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setPrintRequestQuotationNo(row.quotationNo);
  };

  useEffect(() => {
    if (!printRequestQuotationNo) return;
    if (!editingRow || editingRow.quotationNo !== printRequestQuotationNo) return;
    setPrintRequestQuotationNo(null);
    // Printing from the LIST should leave the user back on the list once
    // the browser's print dialog is dismissed, not stranded inside the
    // quotation it had to open in order to print -- 'afterprint' fires
    // either way (printed or cancelled). The form footer's own Print
    // button calls printSalesQuotation() directly, not through this
    // effect, so it's deliberately unaffected -- staying on the form there
    // is correct.
    const returnToListAfterPrint = () => {
      window.removeEventListener('afterprint', returnToListAfterPrint);
      backToList();
    };
    window.addEventListener('afterprint', returnToListAfterPrint);
    printSalesQuotation();
  }, [printRequestQuotationNo, editingRow]);

  // Same "switch into viewing this row, then act once it's actually on
  // screen" trick as Print above -- captureSalesQuotationPdf() screenshots
  // whatever's currently rendered, so it has to wait for editingRow to
  // actually become this row first.
  const [whatsappRequestQuotationNo, setWhatsappRequestQuotationNo] = useState(null);

  const handleSendRowWhatsApp = (row) => {
    setRowMenuAnchor(null);
    handleView(row);
    setWhatsappRequestQuotationNo(row.quotationNo);
  };

  useEffect(() => {
    if (!whatsappRequestQuotationNo) return;
    if (!editingRow || editingRow.quotationNo !== whatsappRequestQuotationNo) return;
    setWhatsappRequestQuotationNo(null);
    // Sending from the LIST should leave the user back on the list once the
    // send finishes (success or failure -- handleSendQuotationWhatsApp
    // already shows its own toast either way), not stranded inside the
    // quotation it had to open in order to capture the PDF. The form
    // footer's own WhatsAppShareButton calls handleSendQuotationWhatsApp
    // directly, not through this effect, so it's deliberately unaffected --
    // staying on the form there is correct.
    handleSendQuotationWhatsApp(editingRow).then(() => backToList());
  }, [whatsappRequestQuotationNo, editingRow]);

  const handleDuplicate = async (row) => {
    const quotationNo = await peekNextDocumentNumber(peekDocumentNumber, 'SQ', notify);
    // A duplicate is a fresh quotation nothing has been ordered against, so
    // it starts Open regardless of what the original had reached. The server
    // recomputes this anyway; it is set here so the optimistic row is right.
    const payload = { ...rowToFormValues(row, taxCodes), quotationNo, status: 'Open' };
    try {
      await create(payload).unwrap();
      notify.success('Quotation duplicated');
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
  // (status becomes "Cancelled") and is dropped from the Sales Order Copy
  // From picker; View/Edit/Delete/Cancel get blocked for it below once
  // isCancelled is true. A non-posting document, so nothing to reverse — the
  // backend (PATCH /sales/quotations/:id/cancel) just refuses while a live
  // Sales Order still references it, and reopens the source enquiry.
  const handleCancel = async (row) => {
    setRowMenuAnchor(null);
    const ok = await confirmDialog({
      title: 'Cancel sales quotation',
      message: `Are you sure you want to cancel "${row.quotationNo}"? This cannot be undone — the quotation will be locked and hidden from Sales Order creation.`,
      confirmLabel: 'Cancel Quotation',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await cancelQuotation(row.id).unwrap();
      notify.success('Sales quotation cancelled');
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

      {view === 'form' ? (
        <RouteMapContextMenu flow="sales" type="quotation" docNo={editingRow?.quotationNo}>
          <AppForm
            key={formKey}
            schema={salesQuotationSchema}
            defaultValues={editingRow ? rowToFormValues(editingRow, taxCodes) : getEmptyValues(currentUser?.name || currentUser?.email, defaultTaxCode)}
            onSubmit={handleSubmit}
          >
            {(methods) => {
              const { control, watch, setValue } = methods;
              // Machine No./Engine No./Hypothecation only make sense on a
              // Parts/Services/Claims document -- switching to "Machine"
              // blanks them out (both on screen and in what gets saved)
              // instead of leaving stale data on a Machine document.
              // Switching back to Parts/Services/Claims within the same
              // editing session restores whatever was typed before the
              // switch, via this ref, rather than losing it for good.
              const machineFieldsCacheRef = useRef({ machineSerialNo: '', engineNo: '', hypothecation: '' });
              const salesCategoryValue = watch('salesCategory');
              const prevSalesCategoryRef = useRef(salesCategoryValue);
              // Looked up by Employee Code (not hardcoded) so a rename in
              // Sales Employee Master is reflected here automatically; falls
              // back to the bare code if that master hasn't loaded yet or no
              // longer has a matching employee, so the field never silently
              // renders blank.
              const machineApprover = (salesEmployees || []).find((e) => e.employeeCode === MACHINE_APPROVER_EMPLOYEE_CODE);
              const machineApproverName = machineApprover?.employeeName || MACHINE_APPROVER_EMPLOYEE_CODE;
              const approvedByCacheRef = useRef('');
              useEffect(() => {
                const prevCategory = prevSalesCategoryRef.current;
                prevSalesCategoryRef.current = salesCategoryValue;
                if (prevCategory === salesCategoryValue) return;
                if (salesCategoryValue === 'Machine') {
                  machineFieldsCacheRef.current = {
                    machineSerialNo: methods.getValues('machineSerialNo') || '',
                    engineNo: methods.getValues('engineNo') || '',
                    hypothecation: methods.getValues('hypothecation') || '',
                  };
                  setValue('machineSerialNo', '');
                  setValue('engineNo', '');
                  setValue('hypothecation', '');
                  // Machine documents don't let the user choose an approver --
                  // it's always this one fixed employee. Whatever was picked
                  // before the switch is cached, same as the machine fields
                  // above, so switching back restores it instead of losing it.
                  approvedByCacheRef.current = methods.getValues('approvedBy') || '';
                  setValue('approvedBy', machineApproverName, { shouldValidate: true });
                } else if (salesCategoryValue !== 'Machine' && prevCategory === 'Machine') {
                  const cached = machineFieldsCacheRef.current;
                  setValue('machineSerialNo', cached.machineSerialNo);
                  setValue('engineNo', cached.engineNo);
                  setValue('hypothecation', cached.hypothecation);
                  setValue('approvedBy', approvedByCacheRef.current || '', { shouldValidate: true });
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [salesCategoryValue]);
              const { fields, append, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });

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
                  warehouse: raw.warehouse || (''),
                };
              };
              const handleItemsImported = (rawItems) => {
                append(rawItems.map(resolveImportedItem));
              };

              const [smartAddOpen, setSmartAddOpen] = useState(false);
              const smartAddEnabled = useSelector((s) => s.theme.smartAddEnabled);
              const handleSmartAddImport = (selectedItems) => {
                const currentItems = watch('items') || [];
                const isFirstItemEmpty = currentItems.length === 1 && !currentItems[0].productCode && !currentItems[0].productName;

                const mappedItems = selectedItems.map((item) => ({
                  ...emptyItem,
                  productCode: item.productCode || '',
                  productName: item.productName || '',
                  description: item.description || item.productName || '',
                  hsnCode: item.hsnCode || '',
                  uom: item.uom || '',
                  quantity: Number(item.quantity) || 1,
                  unitPrice: Number(item.unitPrice) || 0,
                  discountPercent: Number(item.discountPercent) || 0,
                  taxCodeId: item.taxCodeId || null,
                  taxPercent: Number(item.taxPercent) || 18,
                  warehouse: item.warehouse || '',
                }));

                if (isFirstItemEmpty) {
                  replaceItems(mappedItems);
                } else {
                  mappedItems.forEach((item) => append(item));
                }
                setSmartAddOpen(false);
              };
              const watchedItems = watch('items') || [];

              // Shadows the outer-scope selectableProducts (computed from
              // editingRow?.items, a static snapshot) with a live version
              // keyed off the form's actual current lines -- a product Copy
              // From just brought in wasn't in that static list and its
              // Item No / Description Select rendered blank.
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
                  PRODUCT_USAGE.SALES,
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
              const quotationDateValue = watch('quotationDate');
              const quotationDateForMin = quotationDateValue ? dayjs(quotationDateValue) : null;
              const today = dayjs();
              const expiryDateMinDate = quotationDateForMin && quotationDateForMin.isAfter(today, 'day') ? quotationDateForMin : today;

              // Every column of this item table is sized to show its values IN FULL —
              // no ellipsis, no wrapping, no hover, however long the text is. The
              // spec below is positional: it mirrors the header row top to bottom,
              // and `null` leaves a column (the # counter, the action column) at
              // whatever width it already has. See itemTableSx in lib/columnWidth.js.
              // Claims documents move no stock, so the item grid hides its
              // Warehouse column entirely (header, cells and width spec).
              const isClaimsCategory = watch('salesCategory') === 'Claims';
              const itemColumnsSx = itemTableSx(watchedItems, [
                null,
                { header: 'Item No *', get: (i) => i?.productCode, field: 'select' },
                { header: 'Description', get: (i) => i?.productName, field: 'select' },
                { header: 'HSN/SAC', get: (i) => i?.hsnCode, field: 'text' },
                { header: 'Unit', get: (i) => i?.uom, field: 'text' },
                ...(isClaimsCategory ? [] : [{ header: 'Warehouse *', get: (i) => i?.warehouse, field: 'select' }]),
                { header: 'Quantity *', get: (i) => i?.quantity, field: 'text' },
                { header: 'Rate (₹) *', get: (i) => i?.unitPrice, field: 'text' },
                { header: 'Discount (%)', get: (i) => i?.discountPercent, field: 'text' },
                { header: 'Tax (%)', get: (i) => taxCodeById.get(i?.taxCodeId)?.label ?? i?.taxPercent, field: 'select' },
                { header: 'Amount (₹)', get: (i) => ((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0)).toFixed(2), field: 'plain', min: 110 },
                null,
              ]);
              const branch = watch('branch');
              // Once Branch is picked, the Warehouse dropdown is scoped to
              // that branch's warehouses only — see useWarehouseOptions.js.
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
              // it just loaded. No header Warehouse exists on this document,
              // so only the per-row values need this.
              const prevQuotationBranchRef = useRef(branch);
              useEffect(() => {
                if (prevQuotationBranchRef.current === branch) return;
                prevQuotationBranchRef.current = branch;
                const allowed = warehouseCodesForBranch(warehouses, branch);
                (watch('items') || []).forEach((it, idx) => {
                  if (it.warehouse && !allowed.has(it.warehouse)) setValue(`items.${idx}.warehouse`, '');
                });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [branch]);
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
              // Inter-state supplies are taxed wholly as IGST. The server works
              // this out by comparing Place of Supply against the company's
              // registered state; passing the same flag here is what stops the
              // panel showing a CGST/SGST split for a record saved as IGST.
              // State -- display-only, auto-filled from the selected customer's
              // Business Partner Billing address (same pattern as the purchase
              // documents' supplier State), never hand-typed. This -- NOT Place
              // of Supply -- decides CGST/SGST vs IGST and which Tax Code family
              // the Tax (%) column offers.
              const selectedCustomerForState = watch('customer');
              const derivedCustomerState = useMemo(() => {
                const selected = selectedCustomerForState;
                const found = selected
                  ? (customers || []).find((c) => c.customerName === selected || c.customerCode === selected)
                  : null;
                const billing = (found?.addresses || []).filter((a) => a.addressType === 'Billing');
                const defaultBilling = billing.find((a) => a.isDefault) || billing[0];
                return defaultBilling?.state || '';
              }, [customers, selectedCustomerForState]);
              useEffect(() => {
                // Wait for the customer list so an existing document's saved
                // State isn't blanked while it is still loading.
                if (!customers) return;
                setValue('customerState', derivedCustomerState || '', { shouldValidate: true });
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [customers, derivedCustomerState]);
              const interState = isInterState(watch('customerState'), company?.state);
              // taxType (from each line's own taxCodeId) drives the TCS
              // carve-out in documentTotals.js's computeTotals -- see
              // buildTaxCodeOptions/taxCodeById above, which now carries
              // taxType alongside label/value/rate.
              const itemsForTotals = watchedItems.map((it) => ({ ...it, taxType: taxCodeById.get(it.taxCodeId)?.taxType || '' }));
              const freightNetAmount = watch('freightNetAmount');
              const freightTaxAmount = watch('freightTaxAmount');
              const roadTaxApplicable = watch('roadTaxApplicable');
              const totals = computeTotals(itemsForTotals, discountPercent, interState, { netAmount: freightNetAmount, taxAmount: freightTaxAmount }, roadTaxApplicable);
              // Kerala customer State -> GST family (GST, GST+TCS) only;
              // any other state -> IGST family (IGST, IGST+TCS) only. See
              // taxTypeFamilyFor in lib/taxCodeOptions.js.
              const taxCodeOptionsForRow = useMemo(
                () => buildTaxCodeOptions(taxCodes, { taxType: taxTypeFamilyFor(interState) }),
                [taxCodes, interState]
              );
              // Default Tax Code for a row added via "Add Item" once Place
              // of Supply is known — GST@18% intra-state, IGST@18%
              // inter-state, following the same family the dropdown itself
              // is filtered to. The plain top-level defaultTaxCode (GST@18%)
              // is still what seeds getEmptyValues' very first row.
              const liveDefaultTaxCode = useMemo(
                () => pickDefaultTaxCode(taxCodes, { taxType: taxTypeFamilyFor(interState) }),
                [taxCodes, interState]
              );

              const allValues = watch();
              const printCustomerRecord = (customers || []).find((c) => c.customerName === allValues.customer);
              // The chosen Supplier's own Business Partner row — carries
              // logoUrl/logoVisible for SalesQuotationPrintable's
              // supplier-logo block.
              const printSupplierRecord = (suppliers || []).find((s) => s.supplierName === allValues.supplier);
              // The document's own "Branch *" field, matched against Branch
              // Master, so the header prints that branch's own address
              // instead of head office's — see
              // SalesQuotationPrintable.jsx's branchRecord prop (mirrors
              // SalesOrder.jsx/SalesInvoice.jsx's identical printBranchRecord).
              const printBranchRecord = (branches || []).find((b) => (b.branchName || '').trim() === (allValues.branch || '').trim());
              // items: itemsForTotals (not allValues.items) so each line
              // carries its resolved taxType -- SalesQuotationPrintable's own
              // local recompute reads item.taxType to detect a TCS-typed
              // line, and the raw watched item only ever has taxCodeId.
              // roadTax: totals.roadTax -- unlike Sales Order/Invoice/Return,
              // this document has no roadTax form field at all (only the
              // roadTaxApplicable checkbox); the 8.2% amount only exists as
              // this computed totals.roadTax, so without passing it through,
              // the printable's own `order.roadTax` read comes back undefined
              // and Road Tax prints as 0 even when the checkbox is ticked.
              const printOrder = { ...allValues, items: itemsForTotals, roadTax: totals.roadTax, status: editingRow?.status || 'Open' };
              // Signature shown on the printable is the approver's own
              // uploaded signature (SalesEmployee.signatureUrl), not a fixed
              // stationery stamp -- blank when the approver has none on file.
              // Same convention as SalesOrder.jsx/SalesInvoice.jsx's own
              // approverSignatureUrl.
              const approverSignatureUrl = (salesEmployees || []).find((s) => s.employeeName === allValues.approvedBy)?.signatureUrl || null;

              const customerValue = watch('customer');
              const supplierValue = watch('supplier');
              // MachineryCodeSelect needs the selected Customer's Business
              // Partner id (Machineries are scoped per partner, not global —
              // see the "Machineries" tab on BusinessPartner.jsx), but this
              // form only stores the customer's NAME (see PartyCodeSelect's
              // own convention). Resolved the same way the customer-change
              // effect below looks the customer row up.
              const machineryBusinessPartnerId = (customers || []).find((c) => c.customerName === customerValue)?.id || null;
              // Settings > Developer Settings > Master Quick Link — a small
              // profile icon next to Customer that jumps straight into that
              // customer's own record on Customer Master (see
              // BusinessPartner.jsx's openPartnerId effect), gated behind
              // this toggle so it stays hidden until explicitly turned on.
              const masterQuickLinkEnabled = useSelector((s) => s.theme.masterQuickLinkEnabled);
              const navigate = useNavigate();
              const goToCustomerMaster = () => {
                if (!machineryBusinessPartnerId) return;
                navigate('/partner/business-partner/create', { state: { openPartnerId: machineryBusinessPartnerId } });
              };
              const prevCustomer = useRef(editingRow ? editingRow.customer : null);
              useEffect(() => {
                if (customerValue !== prevCustomer.current) {
                  const found = (customers || []).find((c) => c.customerName === customerValue);
                  // A Machinery picked for the PREVIOUS customer is almost
                  // certainly not one of the new customer's own machineries
                  // (Machineries are scoped per Business Partner) — cleared
                  // on every actual customer change.
                  setValue('machineryCode', '', { shouldValidate: true });
                  if (found) {
                    setValue('contactPerson', found.salesPerson || '', { shouldValidate: true });
                    setValue('phone', found.phone || '', { shouldValidate: true });
                    setValue('email', found.email || '', { shouldValidate: true });
                    // Ship From/Ship To are frozen fields now — always the
                    // selected customer's own Business Partner Billing/
                    // Shipping address, never hand-typed.
                    // Bill To follows the customer (SalesShipTo's SalesBillTo keeps the picked Billing address).
                    if (!watch('billToDifferentCustomer')) setValue('billingAddress', customerAddressFor(found, 'Billing'), { shouldValidate: true });
                    // Ship To keeps the address picked under "Ship to a different customer"
                    // (see SalesShipTo) instead of snapping back to this customer's own.
                    if (!watch('shipToDifferentCustomer')) setValue('shippingAddress', customerAddressFor(found, 'Shipping'), { shouldValidate: true });
                    setValue('billingType', deriveBillingType(found), { shouldValidate: true });
                    setValue('priceList', found.priceList || '', { shouldValidate: true });
                    setValue('discountPercent', found.discountPercent != null ? Number(found.discountPercent) : 0, { shouldValidate: true });
                    setValue('gstNo', customerGstNo(found), { shouldValidate: true });
                  }
                  prevCustomer.current = customerValue;
                }
                // eslint-disable-next-line react-hooks/exhaustive-deps
              }, [customerValue]);

              // Copy From pre-fills everything the enquiry already captured
              // about the prospect, so nobody retypes a name/contact/address
              // that was already written down at the enquiry stage.
              //
              // This used to run as an effect watching the Enquiry No. dropdown,
              // guarded by a ref so it fired only on a real change. It is a plain
              // function now, called only from the dialog's Choose button: an
              // effect keyed on a form value also fires when that value is
              // restored on edit or reset, which is what the ref bookkeeping
              // existed to detect. An explicit call has no such ambiguity.
              const applyEnquiry = (found) => {
                if (found) {
                  setValue('enquiryNo', found.enquiryNo || '', { shouldValidate: true });
                  setValue('customer', found.customerName || '', { shouldValidate: true });
                  // Also sync the customer-effect's own "previous value" ref
                  // so it doesn't think the user just picked a new customer
                  // and re-fire on the next render — that effect looks up
                  // Contact Person/Phone/Email/Address fresh from Customer
                  // Master (only when the enquiry's customer name happens to
                  // already exist there), which would clobber the values
                  // just set from the enquiry's own snapshot below.
                  prevCustomer.current = found.customerName || '';
                  setValue('branch', found.branch || '', { shouldValidate: true });
                  setValue('contactPerson', found.contactPerson || '', { shouldValidate: true });
                  setValue('phone', found.mobileNo || '', { shouldValidate: true });
                  setValue('email', found.emailId || '', { shouldValidate: true });
                  // Ship From/Ship To are frozen/derived — re-derive from the
                  // enquiry's own customer's Business Partner record rather
                  // than the enquiry's free-text address (which pre-dates the
                  // customer becoming an actual Business Partner and may not
                  // match it). If that customer has no Business Partner
                  // record yet, this comes back blank rather than falling
                  // back to the enquiry's typed address.
                  const enquiryCustomerRecord = (customers || []).find((c) => c.customerName === (found.customerName || ''));
                  applySalesPartyAddresses(setValue, found, enquiryCustomerRecord, customerAddressFor);
                  setValue('billingType', deriveBillingType(enquiryCustomerRecord), { shouldValidate: true });
                  setValue('gstNo', customerGstNo(enquiryCustomerRecord), { shouldValidate: true });
                }
              };

              // Undo a Copy From: drop the link and the values that came across
              // with it, rather than leaving a stale enquiry's details sitting in
              // a quotation that no longer claims to reference it.
              //
              // The customer is deliberately NOT cleared. It is the user's own
              // selection — it is what made Copy From available in the first
              // place, and clearing it would close the dialog off and force a
              // re-pick just to try a different enquiry from the same customer.
              // Contact Person / Phone / Email / addresses stay too: they belong
              // to the customer, not the enquiry.
              const enquiryValue = watch('enquiryNo');
              const clearEnquiry = () => {
                setValue('enquiryNo', '', { shouldValidate: true });
              };

              const handleFile = (file) => {
                if (file) setValue('attachmentName', file.name, { shouldValidate: true });
              };

              return (
                // minWidth: 0 is required — fieldsets default to min-width: min-content,
                // which lets the wide item table blow out the page width on mobile.
                // The Back to List / Cancel buttons are kept outside the fieldset(s)
                // so they stay clickable in read-only (view) mode -- a native
                // <fieldset disabled> disables every descendant control, buttons
                // included.
                <>
                  <CopyFromDocumentDialog
                    open={copyFromOpen}
                    onClose={() => setCopyFromOpen(false)}
                    onChoose={applyEnquiry}
                    documents={copyableEnquiries}
                    party={customerValue}
                    partyField="customerName"
                    partyLabel="customer"
                    title="Find Sales Enquiry"
                    columns={ENQUIRY_COPY_COLUMNS}
                    emptyMessage="No enquiries found for"
                  />
                  <SalesQuotationPrintable
                    order={printOrder}
                    company={company}
                    customerRecord={printCustomerRecord}
                    supplierRecord={printSupplierRecord}
                    branchRecord={printBranchRecord}
                    houseBank={printHouseBank}
                    approverSignatureUrl={approverSignatureUrl}
                  />
                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Typography variant="subtitle1" fontWeight={700}>
                          {readOnly ? 'Customer & Document Details (View Only)' : 'Customer & Document Details'}
                        </Typography>
                        <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                          Back to List
                        </Button>
                      </Stack>

                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        {/* Left column: Branch, Customer, Phone No., Bill To,
                        Sales Person. Right column: Quotation No., Quotation
                        Date, Currency, Ship To. Listed left-item, right-item
                        per row so the 2-column grid lays out the two stacks
                        rather than flowing row-major top to bottom — same
                        convention as Purchase Order's "Supplier & Document
                        Details". "Bill To"/"Ship To" reuse the existing
                        billingAddress/shippingAddress columns, now frozen and
                        derived from the customer's Business Partner Billing/
                        Shipping address (Receiver/Receiver Phone No. sit
                        above them as new, genuinely editable fields).
                        Contact Person,
                        Email, Enquiry No., Price List and Reference No. are
                        no longer shown on this card — they still exist on
                        the record (auto-filled from the customer / set by
                        Copy From) and still submit with the form, just with
                        no visible input. Valid Till keeps its existing
                        10-days-out default (see getEmptyValues) since it is
                        a required field with no field here to set it from. */}
                        {/* Laid out as the 10 left|right pairs requested:
                        Sales Type|Quotation No, Branch|Quotation Date,
                        Customer Code|Contact No, Customer Name|GST No,
                        Currency|Sales Person, Supplier Code|Supplier Name,
                        Receiver|Receiver Phone No, Bill To|Ship To,
                        Machine No|Engine No, Hypothecation (alone). FormGrid
                        fills left-to-right/top-to-bottom in child order, so
                        the pairing above is exactly this list's order. The
                        Machine fields (Machine No./Engine No./Hypothecation)
                        are folded into this same grid rather than their own
                        -- nothing here conditionally shows/hides them (only
                        their VALUES get cleared when Sales Type leaves
                        "Machine", see machineFieldsCacheRef below), so
                        sharing one grid doesn't risk disturbing that. */}
                        <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                          <LabeledField label="Sales Type *">
                            <FormSelect name="salesCategory" label="" placeholder="Select sales type" options={SALES_CATEGORY_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Quotation No. *">
                            <DocumentSeriesNoField documentCode="SQ" seriesFieldName="seriesId" numberFieldName="quotationNo" isCreate={!editingRow} />
                          </LabeledField>

                          <LabeledField label="Branch *">
                            <FormSelect name="branch" label="" placeholder="Select branch" options={branchOptions} />
                          </LabeledField>
                          <LabeledField label="Quotation Date *">
                            <FormDatePicker name="quotationDate" label="" triggerFields={['expiryDate']} />
                          </LabeledField>

                          <LabeledField label="Customer Code *">
                            {/* showNameBelow off — this label-left layout packs
                            rows with zero vertical gap (FIELD_ROW_SPACING), so
                            PartyCodeSelect's own "name echoed below" caption had
                            no room of its own and visually ran into the very
                            next row's label/box below it (looking like it
                            belonged to Phone No. instead of Customer). Purchase
                            Order's Supplier field turns the same caption off for
                            the same reason. */}
                            <Stack direction="row" alignItems="center" spacing={0.5}>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <PartyCodeSelect name="customer" label="" placeholder="Select customer" options={customerFieldOptions} showNameBelow={false} />
                              </Box>
                              {masterQuickLinkEnabled && (
                                <Tooltip title={machineryBusinessPartnerId ? 'Open in Customer Master' : 'Select a customer first'}>
                                  <span>
                                    <IconButton
                                      size="small"
                                      onClick={goToCustomerMaster}
                                      disabled={!machineryBusinessPartnerId}
                                      aria-label="Open customer in Customer Master"
                                      sx={{ p: 0.25 }}
                                    >
                                      <AccountCircleOutlinedIcon fontSize="small" />
                                    </IconButton>
                                  </span>
                                </Tooltip>
                              )}
                            </Stack>
                          </LabeledField>
                          <LabeledField label="Contact No">
                            <FormTextField name="phone" label="" placeholder="Auto-filled from customer" digitsOnly maxLength={10} disabled />
                          </LabeledField>

                          {/* Read-only echo of the selected customer's full
                          name — the Customer field above shows only its Code,
                          so this is what tells the user which customer that
                          code actually is. Not a stored field: it just
                          displays the current value of `customer`, which
                          already holds the customer's name (see
                          customerFieldOptions above). Same pattern as
                          Purchase Order's Supplier Name field. */}
                          <LabeledField label="Customer Name">
                            <TextField
                              value={customerValue || ''}
                              label=""
                              placeholder="—"
                              fullWidth
                              size="small"
                              InputProps={{ readOnly: true }}
                              sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
                            />
                          </LabeledField>
                          <LabeledField label="GST No.">
                            <FormTextField name="gstNo" label="" placeholder="Auto-filled from customer" disabled />
                          </LabeledField>

                          {/* Display-only, auto-filled from the selected customer's
                          Business Partner address -- drives CGST/SGST vs IGST. The
                          empty cell beside it keeps every row below paired as before. */}
                          <LabeledField label="State">
                            <FormTextField name="customerState" label="" placeholder="Auto-filled from customer" disabled />
                          </LabeledField>
                          <Box sx={{ display: { xs: 'none', sm: 'block' } }} />

                          {/* Currency paired with Sales Person here — both
                          short selects — rather than with a multiline
                          address box, so every row in this grid pairs
                          fields of matching height (that mismatch was what
                          left a visible gap between Currency and Ship To).
                          Bill To/Ship To are grouped together in their own
                          row below, both the same size. */}
                          <LabeledField label="Currency *">
                            <FormSelect name="currency" label="" options={currencyOptions} />
                          </LabeledField>
                          <LabeledField label="Sales Person *">
                            <FormSelect name="salesPerson" label="" placeholder="Select sales person" options={salesPersonOptions} />
                          </LabeledField>

                          {/* Supplier — a Business Partner (Vendor), separate from
                          the Customer above, chosen purely so their logo can be
                          printed next to the KEMACH logo when the partner's own
                          Logo Visibility is Yes (see SalesQuotationPrintable.jsx).
                          Paired with a read-only Supplier Name echo, same
                          Code-field/Name-echo pattern as Customer/Customer Name
                          above, so both fields in this row stay the same short
                          height and the grid doesn't gap. */}
                          <LabeledField label="Supplier Code">
                            <PartyCodeSelect name="supplier" label="" placeholder="Select supplier" options={supplierFieldOptions} showNameBelow={false} />
                          </LabeledField>
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

                          <LabeledField label="Receiver">
                            <FormTextField name="receiver" label="" placeholder="Enter receiver name" />
                          </LabeledField>
                          <LabeledField label="Receiver Phone No.">
                            <FormTextField name="receiverPhone" label="" placeholder="Enter receiver phone no." />
                          </LabeledField>

                          {/* Bill To — relabelled billingAddress (was "Ship
                          From"/"Address"). Multiline, same row height as Ship
                          To next to it and as the Bill To/Ship To boxes on
                          the other sales forms, so every address-style field
                          in Sales reads as one consistent size. Frozen: it is
                          the selected customer's own Business Partner Billing
                          address now, never hand-typed. */}
                          <LabeledField label="Bill To">
                            <SalesShipTo mode="bill" customers={customers} formatAddress={formatBusinessPartnerAddress} />
                          </LabeledField>
                          {/* Ship To — the selected customer's own Business
                          Partner Shipping address. Frozen, same as Bill To. */}
                          <LabeledField label="Ship To">
                            <SalesShipTo customers={customers} formatAddress={formatBusinessPartnerAddress} />
                          </LabeledField>

                          <LabeledField label={watch('salesCategory') === 'Parts' || watch('salesCategory') === 'Services' ? 'Machine No. *' : 'Machine No.'}>
                              <MachineryCodeSelect name="machineSerialNo" label="" placeholder="Select machine serial no." businessPartnerId={machineryBusinessPartnerId} creatable={watch('salesCategory') === 'Machine'} showNameBelow={false} />
                            </LabeledField>
                          <LabeledField label="Engine No.">
                              <FormTextField name="engineNo" label="" placeholder="Enter engine no." />
                            </LabeledField>

                          <LabeledField label="Hypothecation">
                              <FormTextField name="hypothecation" label="" placeholder="Enter hypothecation" />
                            </LabeledField>
                          <LabeledField label="Customer PO No.">
                              <FormTextField name="customerRefNo" label="" placeholder="Enter customer PO no." />
                            </LabeledField>
                        </FormGrid>

                        {/* Not shown on this card, but still submitted with
                        the form: Contact Person/Email/Price List/Reference
                        No. (optional, auto-filled from the customer or Copy
                        From) and Enquiry No. (read-only, set only by Copy
                        From). Valid Till (expiryDate) is required and has no
                        field here to set it from, so it keeps the 10-days-out
                        default set in getEmptyValues. */}
                      </fieldset>
                    </CardContent>
                  </Card>

                  <Card variant="outlined" sx={{ mb: 2 }}>
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 2 }}>Other Details</Typography>
                      <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                        <FormGrid columns={2} rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING} singleColumnOnMobile>
                          <LabeledField label="Billing Type">
                            <FormSelect name="billingType" label="" placeholder="Select billing type" options={BILLING_TYPE_OPTIONS} disabled />
                          </LabeledField>
                          <LabeledField label="Type of Purchase">
                            <FormSelect name="typeOfPurchase" label="" placeholder="Select type of purchase" options={TYPE_OF_PURCHASE_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Payment Method *">
                            <FormSelect name="salesType" label="" placeholder="Select payment method" options={SALES_TYPE_OPTIONS} />
                          </LabeledField>
                          <LabeledField label="Transport Mode">
                            <FormSelect name="transportMode" label="" placeholder="Select transport mode" options={TRANSPORT_MODE_OPTIONS} />
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
                            <Button type="button" variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => append(withDefaultTaxCode({ ...emptyItem, warehouse: '' }, liveDefaultTaxCode))}>
                              Add Item
                            </Button>
                            {smartAddEnabled && (
                              <Button type="button" variant="outlined" color="primary" size="small" startIcon={<BoltIcon />} onClick={() => {
                                if (!watch('customer')) {
                                  notify.error('Please select a customer first to use Smart Add.');
                                  return;
                                }
                                setSmartAddOpen(true);
                              }}>
                                Smart Add
                              </Button>
                            )}
                          </Stack>
                        </Stack>

                        {isMobile ? (
                          <Box>
                            {fields.map((field, index) => {
                              const qty = Number(watch(`items.${index}.quantity`)) || 0;
                              const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                              const disc = Number(watch(`items.${index}.discountPercent`)) || 0;
                              const gross = qty * price;
                              const rowAmount = gross - gross * (disc / 100);
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
                                  <FormTextField name={`items.${index}.description`} label="Description" placeholder="Description" />
                                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 1.5, rowGap: 1.5 }}>
                                    <FormTextField name={`items.${index}.hsnCode`} label="HSN/SAC" placeholder="HSN/SAC" digitsOnly maxLength={8} />
                                    <FormTextField name={`items.${index}.uom`} label="Unit" placeholder="Unit" />
                                    {!isClaimsCategory && (
                                      <WarehouseCodeSelect
                                        name={`items.${index}.warehouse`}
                                        label="Warehouse *"
                                        placeholder={branch ? 'Select' : 'Select branch first'}
                                        options={branchWarehouseOptions}
                                        disabled={!branch}
                                      />
                                    )}
                                    <FormTextField name={`items.${index}.quantity`} label="Quantity *" type="number" />
                                    <FormTextField name={`items.${index}.unitPrice`} label="Rate (₹) *" type="number" />
                                    <FormTextField name={`items.${index}.discountPercent`} label="Discount (%)" type="number" />
                                    <FormSelect
                                      name={`items.${index}.taxCodeId`}
                                      label="Tax (%)"
                                      options={taxCodeOptionsForRow}
                                      popupFitContent
                                      onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })}
                                    />
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
                                  <TableCell width={40}>#</TableCell>
                                  <TableCell>Item No<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                                  <TableCell>Description</TableCell>
                                  <TableCell>HSN/SAC</TableCell>
                                  <TableCell>Unit</TableCell>
                                  {!isClaimsCategory && <TableCell>Warehouse<span style={{ color: '#d32f2f' }}> *</span></TableCell>}
                                  <TableCell>Quantity<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                                  <TableCell>Rate (₹)<span style={{ color: '#d32f2f' }}> *</span></TableCell>
                                  <TableCell>Discount (%)</TableCell>
                                  <TableCell>Tax (%)</TableCell>
                                  <TableCell align="right">Amount (₹)</TableCell>
                                  <TableCell width={48} />
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {fields.map((field, index) => {
                                  const qty = Number(watch(`items.${index}.quantity`)) || 0;
                                  const price = Number(watch(`items.${index}.unitPrice`)) || 0;
                                  const disc = Number(watch(`items.${index}.discountPercent`)) || 0;
                                  const gross = qty * price;
                                  const rowAmount = gross - gross * (disc / 100);
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
                                      {!isClaimsCategory && (
                                        <TableCell>
                                          <WarehouseCodeSelect
                                            name={`items.${index}.warehouse`}
                                            label=""
                                            placeholder={branch ? 'Select' : 'Select branch first'}
                                            options={branchWarehouseOptions}
                                            disabled={!branch}
                                            popupFitContent
                                            showNameBelow={false}
                                          />
                                        </TableCell>
                                      )}
                                      <TableCell>
                                        <FormTextField name={`items.${index}.quantity`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.unitPrice`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormTextField name={`items.${index}.discountPercent`} label="" type="number" />
                                      </TableCell>
                                      <TableCell>
                                        <FormSelect
                                          name={`items.${index}.taxCodeId`}
                                          label=""
                                          options={taxCodeOptionsForRow}
                                          disableClearable
                                          sx={{ minWidth: 96 }}
                                          popupFitContent
                                          onValueChange={(_v, option) => setValue(`items.${index}.taxPercent`, option ? option.rate : 0, { shouldValidate: true })}
                                        />
                                      </TableCell>
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
                          {/* Notes removed from this form — Terms & Conditions now
                              matches Sales Order's own single field/label. */}
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
                              <DocumentTotalsPanel totals={totals} interState={interState} discountField={null} showFreight showRoadTax roadTaxCheckboxField="roadTaxApplicable" roadTaxChecked={roadTaxApplicable} />
                            </Box>
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Prepared By</Typography>
                            <FormTextField name="preparedBy" label="" disabled />
                          </Grid>

                          <Grid item xs={12} md={4}>
                            <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Approved By</Typography>
                            {salesCategoryValue === 'Machine' ? (
                              <FormTextField name="approvedBy" label="" disabled />
                            ) : (
                              <FormSelect name="approvedBy" label="" placeholder="Select employee" options={approvedByOptions} />
                            )}
                          </Grid>
                        </Grid>
                      </fieldset>

                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.5}
                        justifyContent={{ xs: 'stretch', sm: 'flex-end' }}
                        sx={{ mt: 3 }}
                      >
                        {/* Sits immediately left of Copy To — opens WhatsApp's
                          click-to-chat, pre-addressed to this customer's saved
                          mobile number, with a message naming this quotation.
                          See WhatsAppShareButton.jsx for why this isn't a fully
                          automated send. */}
                        <WhatsAppShareButton
                          fullWidth={isMobile}
                          phone={printCustomerRecord?.phone}
                          customerName={allValues.customer}
                          docLabel="Sales Quotation"
                          docNo={allValues.quotationNo}
                          onClick={() => handleSendQuotationWhatsApp(editingRow)}
                          sending={sendingQuotationWhatsApp}
                          disabled={creating || updating || !editingRow?.id}
                        />
                        <CopyToButton
                          sourceType="salesQuotation"
                          sourceDoc={editingRow}
                          sourceLabel="Sales Quotation"
                          docNoField="quotationNo"
                          targets={[
                            { key: 'salesOrder', label: 'Sales Order', path: '/sales/order' },
                            { key: 'deliveryChallan', label: 'Delivery Challan', path: '/sales/delivery-challan' },
                            { key: 'salesInvoice', label: 'Sales Invoice', path: '/sales/invoice' },
                          ]}
                        />
                        {/* Copy From sits immediately left of Cancel and stays
                          disabled until a Customer is chosen — the dialog it
                          opens lists that customer's enquiries, so with no
                          customer there is nothing for it to show. Hidden in
                          view mode, where nothing is being filled in. */}
                        {!readOnly && (
                          enquiryValue ? (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              color="inherit"
                              startIcon={<CloseIcon />}
                              onClick={clearEnquiry}
                              disabled={creating || updating}
                            >
                              Clear Copied Enquiry
                            </Button>
                          ) : (
                            <Button
                              fullWidth={isMobile}
                              type="button"
                              variant="outlined"
                              startIcon={<ContentCopyOutlinedIcon />}
                              onClick={() => setCopyFromOpen(true)}
                              disabled={!customerValue || creating || updating}
                            >
                              Copy From
                            </Button>
                          )
                        )}
                        <Button fullWidth={isMobile} type="button" variant="outlined" color="inherit" startIcon={<CloseIcon />} onClick={backToList} disabled={creating || updating}>
                          Cancel
                        </Button>
                        <Button fullWidth={isMobile} type="button" variant="outlined" startIcon={<PrintOutlinedIcon />} onClick={() => printSalesQuotation()}>
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
                              onClick={() => { pendingStatusRef.current = 'Sent'; }}
                              disabled={creating || updating}
                              loading={creating || updating}
                            >
                              {editingRow ? 'Update Quotation' : 'Save & Send Quotation'}
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
                    templateUrl="/sales/quotations/items-import/template"
                    importUrl="/sales/quotations/items-import"
                    onImported={handleItemsImported}
                  />
                  <SmartAddHistoryDialog
                    open={smartAddOpen}
                    onClose={() => setSmartAddOpen(false)}
                    onImport={handleSmartAddImport}
                    customer={watch('customer')}
                    documents={allSalesDocuments}
                    products={products || []}
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
                <TableSearchFilter table={table} placeholder="Search by quotation no, customer..." showFilter={false} />
                <Stack direction="row" spacing={1.5}>
                  <Button size="small" variant="outlined" color="inherit" startIcon={<FilterListIcon />} onClick={() => setShowFilters((v) => !v)} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                    Filter
                  </Button>
                  <CanAdd>
                    {/* React.Children.only needs one child — group both buttons in a Stack. */}
                    <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        startIcon={<UploadFileIcon />}
                        onClick={() => setBulkImportOpen(true)}
                        sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}
                      >
                        Import from Excel
                      </Button>
                      <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={openCreate} sx={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Create Quotation
                      </Button>
                    </Stack>
                  </CanAdd>
                </Stack>
              </Stack>
            </Stack>

            <Collapse in={showFilters} unmountOnExit>
              <Box sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
                <FormGrid columns={3} singleColumnOnMobile>
                  <FilterAutocomplete
                    label="Customer"
                    allLabel="All Customers"
                    options={customerOptions}
                    value={customerFilter}
                    onChange={(v) => { setCustomerFilter(v); setPage(0); }}
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
                      { label: 'Customer', value: row.customer || '—' },
                      { label: 'Quotation Date', value: row.quotationDate ? dayjs(row.quotationDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Valid Till', value: row.expiryDate ? dayjs(row.expiryDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Amount', value: `₹${Number(row.amount).toFixed(2)}` },
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
                  <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No quotations found" message="Add your first quotation to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table
                  size="small"
                  stickyHeader
                  sx={{
                    '& th, & td': {
                      height: SALES_QUOTATION_LIST_TABLE_ROW_HEIGHT,
                      paddingTop: `${SALES_QUOTATION_LIST_TABLE_CELL_PADDING_Y}px`,
                      paddingBottom: `${SALES_QUOTATION_LIST_TABLE_CELL_PADDING_Y}px`,
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
                      <SortableHeaderCell field="customer" sort={table.sort} onSort={table.toggleSort}>Customer</SortableHeaderCell>
                      <SortableHeaderCell field="quotationDate" sort={table.sort} onSort={table.toggleSort}>Quotation Date</SortableHeaderCell>
                      <SortableHeaderCell field="expiryDate" sort={table.sort} onSort={table.toggleSort}>Valid Till</SortableHeaderCell>
                      <SortableHeaderCell align="right" field="amount" sort={table.sort} onSort={table.toggleSort}>Amount (₹)</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
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
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.customer || '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.quotationDate ? dayjs(row.quotationDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.expiryDate ? dayjs(row.expiryDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{Number(row.amount).toFixed(2)}</TableCell>
                        <TableCell>
                          <Chip size="small" label={row.status} color={STATUS_COLORS[row.status] || 'default'} variant="outlined" />
                        </TableCell>
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
                            <RouteMapButton flow="sales" type="quotation" docNo={row.quotationNo} />
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
                            {/* Row-level equivalent of the form footer's own
                              WhatsAppShareButton — looked up by customer name
                              since the list row itself only carries the
                              customer's name/quotation No., not their phone. */}
                            <WhatsAppShareButton
                              iconOnly
                              phone={(customers || []).find((c) => c.customerName === row.customer)?.phone}
                              customerName={row.customer}
                              docLabel="Sales Quotation"
                              docNo={row.quotationNo}
                              onClick={() => handleSendRowWhatsApp(row)}
                              sending={sendingQuotationWhatsApp && whatsappRequestQuotationNo === row.quotationNo}
                            />
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
                        <TableCell colSpan={9}>
                          <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 48 }} />} title="No quotations found" message="Add your first quotation to get started" />
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

            <EntityListPagination total={table.total} page={page} onChange={setPage} pageSize={pageSize} onPageSizeChange={(v) => { setPageSize(v); setPage(0); }} />
          </CardContent>
        </Card>
      )}

      <BulkImportDialog
        open={bulkImportOpen}
        onClose={() => setBulkImportOpen(false)}
        resourceName="Sales Quotations"
        templateUrl="/sales/quotations/bulk-import/template"
        importUrl="/sales/quotations/bulk-import"
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
