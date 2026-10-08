import React, { useMemo, useRef, useState } from 'react';
import { useFieldArray } from 'react-hook-form';
import FormatListBulletedOutlinedIcon from '@mui/icons-material/FormatListBulletedOutlined';
import {
  Box, Typography, Button, Card, CardContent, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Chip, IconButton, Autocomplete, TextField,
} from '@mui/material';
import dayjs from 'dayjs';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import AppForm, { FormGrid, FormSubmitButton } from '../../components/form/AppForm';
import FormTextField from '../../components/form/FormTextField';
import FormSelect from '../../components/form/FormSelect';
import FormDatePicker from '../../components/form/FormDatePicker';
import { LabeledField, FIELD_ROW_SPACING, FIELD_COLUMN_SPACING } from '../../components/form/LabeledField';
import EntityHeaderCard from '../../components/common/EntityHeaderCard';
import CompanyBadge from '../../components/common/CompanyBadge';
import EntityListPagination from '../../components/data-display/EntityListPagination';
import MobileRecordCard from '../../components/data-display/MobileRecordCard';
import { useIsMobileListView } from '../../components/data-display/useIsMobileListView';
import { useNotify } from '../../components/feedback/NotificationProvider';
import { applyServerErrors } from '../../lib/formErrors';
import { useConfirm } from '../../components/feedback/ConfirmationDialog';
import { priceListSchema } from '../../lib/validation/productSchemas';
import {
  priceListApi, productApi,
  useParsePriceListXlsxMutation, useExportPriceListXlsxMutation,
} from '../../features/resources';
import useTableFeatures from '../../components/data-display/useTableFeatures';
import TableSearchFilter from '../../components/data-display/TableSearchFilter';
import SortableHeaderCell from '../../components/data-display/SortableHeaderCell';
import ScrollableTableContainer from '../../components/data-display/ScrollableTableContainer';
import { CanAdd, CanEdit, CanDelete } from '../../components/common/PermissionGate';
import EmptyState from '../../components/data-display/EmptyState';

// Base shape only — a brand-new Price List's actual starting rows come from
// defaultCreateItems below (every Active product from Product Master), and
// an edited one's from its own saved editingRow.items; this bare `items: []`
// is just the fallback while `products` hasn't loaded yet.
const emptyValues = {
  priceListName: '', effectiveDate: null, type: 'Other', status: 'Active',
  items: [],
};
const PRICE_LIST_TYPE_OPTIONS = [
  { label: 'DLP (Dealer/Distributor Price List)', value: 'DLP' },
  { label: 'CLP (Customer Price List)', value: 'CLP' },
  { label: 'MRP', value: 'MRP' },
  { label: 'Other', value: 'Other' },
];
const PAGE_SIZE = 10;

// Saves a Blob returned by one of the mutations below as a real file download
// via a throwaway object URL — the browser has no other route from a Blob to
// disk. Shared by Download Excel, Download Template and (indirectly) Upload.
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// The one editable "Item No" picker on this page — every other row's product
// comes pre-filled from Product Master or an uploaded sheet (see the page's
// own defaultCreateItems comment), so this only ever appears on a row just
// added via the "Add" button, before a product has been chosen for it.
// Options exclude Inactive products and anything already on this price list,
// so the same item can't end up on two rows. Once a product is picked, the
// row's productCode is set and this cell switches to the plain-text display
// every other row uses — the picker itself is never shown again for that row.
function NewItemProductPicker({ index, methods, products, existingProductCodes }) {
  const { setValue, formState } = methods;
  const options = useMemo(
    () => (products || [])
      .filter((p) => p.status !== 'Inactive' && !existingProductCodes.has(p.productCode))
      .map((p) => ({ code: p.productCode, name: p.productName, group: p.productGroup || '' })),
    [products, existingProductCodes]
  );
  const errorMessage = formState.errors?.items?.[index]?.productCode?.message;
  return (
    <Autocomplete
      size="small"
      options={options}
      getOptionLabel={(o) => (o?.code ? `${o.code} - ${o.name || ''}` : '')}
      isOptionEqualToValue={(o, v) => o.code === v.code}
      onChange={(_e, val) => {
        if (!val) return;
        setValue(`items.${index}.productCode`, val.code, { shouldValidate: true });
        setValue(`items.${index}.productName`, val.name || '', { shouldValidate: true });
        setValue(`items.${index}.productGroup`, val.group || '', { shouldValidate: true });
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search & select item"
          error={!!errorMessage}
          helperText={errorMessage || ''}
        />
      )}
      sx={{ minWidth: 220 }}
    />
  );
}

export default function PriceList() {
  const notify = useNotify();
  const confirmDialog = useConfirm();
  const isMobile = useIsMobileListView();
  const { data: priceLists, isLoading } = priceListApi.useList();
  // Product Master can genuinely hold tens of thousands of rows (this
  // company's has 15,451) — surface a load error instead of silently
  // treating a failed fetch the same as "still loading", which previously
  // looked identical to an empty Product Master from this page's point of
  // view.
  const { data: products, error: productsError } = productApi.useList();
  const [create, { isLoading: creating }] = priceListApi.useCreate();
  const [update, { isLoading: updating }] = priceListApi.useUpdate();
  const [remove] = priceListApi.useDelete();
  const [parseXlsx, { isLoading: uploading }] = useParsePriceListXlsxMutation();
  // "Download Template" now reuses this same export mutation (see
  // handleDownloadTemplate below) rather than the old fixed-sample-row
  // endpoint, so its own separate loading flag is gone too.
  const [exportXlsx, { isLoading: exporting }] = useExportPriceListXlsxMutation();

  // View toggles between the price list list and a full-page Create/Edit/View
  // form — same page, no popup, matching Stock Transfer/Stock Issue's own
  // "Add"/"Back to List" pattern, instead of the small-dialog form this page
  // used to open "Add Price List" in.
  const [view, setView] = useState('list');
  const [editingRow, setEditingRow] = useState(null);
  const [readOnly, setReadOnly] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const uploadInputRef = useRef(null);

  // The item table itself is windowed separately from the price-list list
  // above — with 15,451 products preloaded into a brand-new Price List,
  // mounting one interactive control per row for every single row at once
  // is what was actually breaking this page: the browser tab had to build,
  // and react-hook-form had to subscribe to, ~15k live rows in one go,
  // which is slow enough that it looked exactly like the table had failed
  // to load rather than that it was still (very slowly) rendering. All
  // 15,451 rows still live in the form's field array — and all of them are
  // saved — only what's painted to the screen at once is limited.
  const [itemsPage, setItemsPage] = useState(0);
  const ITEMS_PAGE_SIZE = 50;
  // Free-text filter over the item table — every row's product is already
  // fixed (it came from Product Master, or from an uploaded sheet), so
  // there's nothing to "pick" per row any more; this is how you find a
  // product among 15,451 rows instead. Matches Item No or Description.
  const [itemSearch, setItemSearch] = useState('');

  // A brand-new Price List starts pre-loaded with every Active product from
  // Product Master, one row each — rather than the single blank row you'd
  // otherwise have to build up by hand with "Add Item". Price is left blank
  // for whoever is filling this list in; unwanted products are simply
  // removed via each row's own delete action. Only used for CREATE — editing
  // an existing Price List still opens with exactly the rows it was saved
  // with (see defaultValues below), not re-seeded from the current product
  // master.
  const defaultCreateItems = useMemo(() => (products || [])
    .filter((p) => p.status !== 'Inactive')
    .map((p) => ({ productCode: p.productCode, productName: p.productName, productGroup: p.productGroup || '', price: '' })),
  [products]);

  const rows = priceLists || [];
  const tableColumns = useMemo(() => ([
    { field: 'priceListName', headerName: 'Price List Name', filter: 'text' },
    { field: 'type', headerName: 'Type', filter: 'select' },
    { field: 'effectiveDate', headerName: 'Effective Date', filter: 'dateRange', sortValue: (row) => (row.effectiveDate ? new Date(row.effectiveDate).getTime() : null) },
    { field: 'items', headerName: 'Items', filter: false, searchable: false, sortValue: (row) => (row.items || []).length },
    { field: 'status', headerName: 'Status', filter: 'select' },
  ]), []);
  const table = useTableFeatures(rows, tableColumns, { onChange: setPage });
  const filteredRows = table.rows;
  const pagedRows = useMemo(
    () => filteredRows.slice(page * pageSize, page * pageSize + pageSize),
    [filteredRows, page, pageSize]
  );

  const openCreate = () => {
    setEditingRow(null);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setItemsPage(0);
    setItemSearch('');
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
    setItemsPage(0);
    setItemSearch('');
    setView('form');
  };

  const handleEdit = (row) => {
    setEditingRow(row);
    setReadOnly(false);
    setFormKey((k) => k + 1);
    setItemsPage(0);
    setItemSearch('');
    setView('form');
  };

  const handleDelete = async (row) => {
    const ok = await confirmDialog({
      title: 'Delete price list',
      message: `Are you sure you want to delete "${row.priceListName}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      severity: 'error',
    });
    if (!ok) return;
    try {
      await remove(row.id).unwrap();
      notify.success('Price list deleted');
    } catch (err) {
      notify.error(err?.data?.message || 'Delete failed');
    }
  };

  const handleSubmit = async (values, formMethods) => {
    const payload = {
      ...values,
      items: (values.items || []).map((it) => ({
        productCode: it.productCode,
        productName: it.productName || '',
        productGroup: it.productGroup || '',
        price: Number(it.price) || 0,
      })),
    };
    try {
      if (editingRow) {
        await update({ id: editingRow.id, ...payload }).unwrap();
        notify.success('Price list updated');
      } else {
        await create(payload).unwrap();
        notify.success('Price list added');
      }
      backToList();
    } catch (err) {
      notify.error(applyServerErrors(err, formMethods.setError));
    }
  };

  return (
    <Box>
      <EntityHeaderCard
        icon={<FormatListBulletedOutlinedIcon />}
        title="Price List"
        subtitle={view === 'form' ? 'Build a named, dated item price list.' : 'Build and maintain named, dated item price lists.'}
        rightContent={<CompanyBadge />}
      />

      {view === 'form' ? (
        <AppForm
          readOnly={readOnly}
          // react-hook-form only reads `defaultValues` once, at the exact
          // moment this AppForm mounts (a later change to the prop does
          // nothing on its own) — so a brand-new Price List opened before
          // Product Master's own list has finished loading would otherwise
          // mount with zero rows forever, with no way to revisit that once
          // `products` actually arrives. Baking readiness into the key
          // forces a full, fresh remount (and so a fresh read of
          // defaultValues, now correctly holding every product) the moment
          // that happens — rather than depending on some effect reaching
          // into an already-mounted form's field array after the fact.
          // Editing/viewing an existing row is always "ready" (its own
          // saved items don't wait on Product Master), so this never
          // remounts mid-edit.
          key={`${formKey}-${editingRow || defaultCreateItems.length > 0 ? 'ready' : 'pending'}`}
          schema={priceListSchema}
          defaultValues={editingRow ? { ...emptyValues, ...editingRow } : { ...emptyValues, items: defaultCreateItems }}
          onSubmit={handleSubmit}
        >
          {(methods) => {
            const { control, watch, setValue } = methods;
            const { fields, append: appendItem, remove: removeItem, replace: replaceItems } = useFieldArray({ control, name: 'items' });
            const watchedItems = watch('items') || [];
            // Every code already on this price list (prefilled or previously
            // added) — used to keep a manually added row's own product
            // picker from offering a product that's already got a row here.
            const existingProductCodes = useMemo(
              () => new Set(watchedItems.map((it) => it?.productCode).filter(Boolean)),
              [watchedItems]
            );
            // Keep each row's real position in the full field array (needed
            // for `items.${index}.*` field names and for remove(index)) while
            // only ever painting one page of rows to the DOM — see itemsPage
            // above for why.
            const indexedFields = fields.map((field, index) => ({ field, index }));
            const searchTerm = itemSearch.trim().toLowerCase();
            const matchedFields = searchTerm
              ? indexedFields.filter(({ index }) => {
                  const item = watchedItems[index];
                  return (item?.productCode || '').toLowerCase().includes(searchTerm)
                    || (item?.productName || '').toLowerCase().includes(searchTerm);
                })
              : indexedFields;
            const itemsPageCount = Math.max(Math.ceil(matchedFields.length / ITEMS_PAGE_SIZE), 1);
            const safeItemsPage = Math.min(itemsPage, itemsPageCount - 1);
            const pagedFields = matchedFields
              .slice(safeItemsPage * ITEMS_PAGE_SIZE, safeItemsPage * ITEMS_PAGE_SIZE + ITEMS_PAGE_SIZE);

            const handleDownloadExcel = async () => {
              try {
                const blob = await exportXlsx(watchedItems).unwrap();
                saveBlob(blob, 'price-list.xlsx');
              } catch (err) {
                notify.error(err?.data?.message || 'Could not export the item table. Try again.');
              }
            };

            // Same export as "Download Excel" above the table — every row
            // currently in the item table, in the same Item No/Description/
            // Item Group/Price shape "Upload Price List" expects back — just
            // saved under the template's filename. Previously this hit a
            // separate endpoint that always returned one blank sample row,
            // regardless of how many products were actually in the table.
            const handleDownloadTemplate = async () => {
              try {
                const blob = await exportXlsx(watchedItems).unwrap();
                saveBlob(blob, 'price-list-template.xlsx');
              } catch (err) {
                notify.error(err?.data?.message || 'Could not download the template. Try again.');
              }
            };

            // Adds one blank row for the user to pick a product into by hand —
            // on top of the table's usual prefill-from-Product-Master/upload
            // flow, for the odd product added after this list was built (or
            // simply missed). Clears any active search/page so the new,
            // still-empty row is actually visible instead of landing behind
            // a filter or on a page the user isn't looking at.
            const handleAddItem = () => {
              appendItem({ productCode: '', productName: '', productGroup: '', price: '' });
              setItemSearch('');
              setItemsPage(Math.floor(fields.length / ITEMS_PAGE_SIZE));
            };

            const handleUploadClick = () => uploadInputRef.current?.click();

            // The server only parses and validates the sheet here — nothing
            // is written to the database. The parsed rows just replace (after
            // confirming, if the table already has rows) what's currently in
            // the item table, exactly as if each had been searched and added
            // by hand; Save is still what actually persists the price list.
            const handleUploadFile = async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;

              if (watchedItems.length > 0) {
                const ok = await confirmDialog({
                  title: 'Replace items?',
                  message: `This price list already has ${watchedItems.length} item(s). Uploading will rebuild the item table from Product Master, using the file's prices where given and 0 for everything else. Continue?`,
                  confirmLabel: 'Replace',
                  severity: 'warning',
                });
                if (!ok) return;
              }

              const formData = new FormData();
              formData.append('file', file);
              try {
                const result = await parseXlsx(formData).unwrap();
                // The sheet only has to carry prices for the products someone
                // actually typed a price for — it doesn't need to list every
                // product to "count". So the table isn't just replaced with
                // whatever rows the sheet had: it's rebuilt from every Active
                // product in Product Master (same as a brand-new Price List),
                // with the sheet's price dropped in wherever its Item No
                // matches and 0 everywhere else — nothing typed in gets lost,
                // and nothing is silently missing from the table either.
                const priceByCode = new Map(result.data.map((it) => [it.productCode, it.price]));
                const codesInMaster = new Set((products || []).map((p) => p.productCode));
                const fullRows = defaultCreateItems.map((row) => ({
                  ...row,
                  price: priceByCode.has(row.productCode) ? priceByCode.get(row.productCode) : 0,
                }));
                // An uploaded Item No Product Master doesn't recognise still
                // makes it into the table (as before) — just appended after
                // the full product list instead of replacing it.
                const extraRows = result.data
                  .filter((it) => !codesInMaster.has(it.productCode))
                  .map((it) => ({
                    productCode: it.productCode,
                    productName: it.productName,
                    productGroup: it.productGroup,
                    price: it.price,
                  }));
                replaceItems([...fullRows, ...extraRows]);
                setItemsPage(0);
                setItemSearch('');
                notify.success(result.message);
                if (result.errors?.length) {
                  // eslint-disable-next-line no-console
                  console.warn('Price List upload — skipped rows:', result.errors);
                }
              } catch (err) {
                notify.error(err?.data?.message || 'Upload failed. Check the file and try again.');
              }
            };

            return (
              <>
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {readOnly ? 'View Price List' : editingRow ? 'Edit Price List' : 'Add Price List'}
                      </Typography>
                      <Button type="button" variant="outlined" color="inherit" startIcon={<ArrowBackIcon />} onClick={backToList}>
                        Back to List
                      </Button>
                    </Stack>
                    <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                      <FormGrid columns={2} singleColumnOnMobile rowSpacing={FIELD_ROW_SPACING} columnSpacing={FIELD_COLUMN_SPACING}>
                        <LabeledField label="Price List Name *">
                          <FormTextField name="priceListName" label="" placeholder="Enter price list name" />
                        </LabeledField>
                        <LabeledField label="Effective Date *">
                          <FormDatePicker name="effectiveDate" label="" />
                        </LabeledField>
                        <LabeledField label="Type *">
                          <FormSelect
                            name="type"
                            label=""
                            options={PRICE_LIST_TYPE_OPTIONS}
                          />
                        </LabeledField>
                        <LabeledField label="Status *">
                          <FormSelect
                            name="status"
                            label=""
                            options={[{ label: 'Active', value: 'Active' }, { label: 'Inactive', value: 'Inactive' }]}
                          />
                        </LabeledField>
                      </FormGrid>
                    </fieldset>
                  </CardContent>
                </Card>

                <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0, minWidth: 0, width: '100%', display: 'block' }}>
                  <Card variant="outlined">
                    <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2 }}>
                        <Stack>
                          <Typography variant="subtitle1" fontWeight={700}>Items</Typography>
                          {fields.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              {fields.length.toLocaleString()} item{fields.length === 1 ? '' : 's'} total
                            </Typography>
                          )}
                        </Stack>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          {/* Item No is no longer a per-row picker — every row's
                              product already comes from Product Master or an
                              uploaded sheet — so this is how you find a row
                              among up to 15,451 of them instead. */}
                          <TableSearchFilter
                            table={{ search: itemSearch, setSearch: (v) => { setItemSearch(v); setItemsPage(0); } }}
                            placeholder="Search item no or description..."
                            width={240}
                            showFilter={false}
                          />
                          {!readOnly && (
                            <Button
                              type="button"
                              variant="outlined"
                              size="small"
                              startIcon={<AddIcon />}
                              onClick={handleAddItem}
                            >
                              Add
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outlined"
                            color="inherit"
                            size="small"
                            startIcon={<DownloadIcon />}
                            onClick={handleDownloadExcel}
                            disabled={exporting || fields.length === 0}
                          >
                            Download Excel
                          </Button>
                        </Stack>
                      </Stack>

                      {productsError && (
                        <Typography variant="body2" color="error" sx={{ mb: 1.5 }}>
                          Could not load Product Master's product list, so this item table couldn't be pre-filled. Reload the page and try again, or upload a price list below instead.
                        </Typography>
                      )}

                      <ScrollableTableContainer>
                        <Table size="small" sx={{ '& tbody .MuiFormHelperText-root:not(.Mui-error)': { display: 'none' } }}>
                          <TableHead>
                            <TableRow>
                              <TableCell width={48}>#</TableCell>
                              <TableCell width={220}>Item No</TableCell>
                              <TableCell>Description</TableCell>
                              <TableCell>Item Group</TableCell>
                              <TableCell width={160}>Price</TableCell>
                              {!readOnly && <TableCell align="right" width={64}>Action</TableCell>}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {pagedFields.map(({ field, index }) => (
                              <TableRow key={field.id} sx={{ '& > td': { verticalAlign: 'middle' } }}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                  {watchedItems[index]?.productCode ? watchedItems[index].productCode : (
                                    <NewItemProductPicker
                                      index={index}
                                      methods={methods}
                                      products={products}
                                      existingProductCodes={existingProductCodes}
                                    />
                                  )}
                                </TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{watchedItems[index]?.productName || '—'}</TableCell>
                                <TableCell sx={{ whiteSpace: 'nowrap' }}>{watchedItems[index]?.productGroup || '—'}</TableCell>
                                <TableCell>
                                  <FormTextField name={`items.${index}.price`} label="" type="number" placeholder="0.00" />
                                </TableCell>
                                {!readOnly && (
                                  <TableCell align="right">
                                    <IconButton type="button" size="small" color="error" onClick={() => removeItem(index)} aria-label="remove item">
                                      <DeleteIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))}
                            {fields.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={readOnly ? 5 : 6}>
                                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                    No items — add products in Product Master, or upload a price list below.
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )}
                            {fields.length > 0 && matchedFields.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={readOnly ? 5 : 6}>
                                  <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                                    No items match "{itemSearch}".
                                  </Typography>
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollableTableContainer>

                      {matchedFields.length > ITEMS_PAGE_SIZE && (
                        <EntityListPagination
                          total={matchedFields.length}
                          page={safeItemsPage}
                          onChange={setItemsPage}
                          pageSize={ITEMS_PAGE_SIZE}
                        />
                      )}

                      {!readOnly && (
                        <Stack direction="row" spacing={1.5} justifyContent="flex-end" flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
                          <input ref={uploadInputRef} type="file" accept=".xlsx,.xls" hidden onChange={handleUploadFile} />
                          <Button
                            type="button"
                            variant="outlined"
                            color="inherit"
                            size="small"
                            startIcon={<UploadFileIcon />}
                            onClick={handleUploadClick}
                            disabled={uploading}
                          >
                            {uploading ? 'Uploading...' : 'Upload Price List'}
                          </Button>
                          <Button
                            type="button"
                            variant="outlined"
                            color="inherit"
                            size="small"
                            startIcon={<DownloadIcon />}
                            onClick={handleDownloadTemplate}
                            disabled={exporting}
                          >
                            Download Template
                          </Button>
                        </Stack>
                      )}
                    </CardContent>
                  </Card>
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
                  <FormSubmitButton fullWidth={isMobile} disabled={creating || updating}>
                    {editingRow ? 'Update' : 'Save'}
                  </FormSubmitButton>
                </Stack>
              </>
            );
          }}
        </AppForm>
      ) : (
        <Card variant="outlined">
          <CardContent sx={{ p: 0 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ px: 3, pt: 2.5, pb: 1.5 }}>
              <Typography variant="subtitle1" fontWeight={700}>Price Lists</Typography>
              <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                <TableSearchFilter table={table} placeholder="Search by price list name..." width={260} showFilter={false} />
                <CanAdd>
                  <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    Add Price List
                  </Button>
                </CanAdd>
              </Stack>
            </Stack>

            {isMobile ? (
              <Box sx={{ px: 2, pb: 1 }}>
                {!isLoading && pagedRows.map((row) => (
                  <MobileRecordCard
                    key={row.id}
                    title={row.priceListName}
                    statusChip={<Chip size="small" label={row.status} color={row.status === 'Active' ? 'success' : 'default'} variant="outlined" />}
                    fields={[
                      { label: 'Type', value: row.type || 'Other' },
                      { label: 'Effective Date', value: row.effectiveDate ? dayjs(row.effectiveDate).format('DD/MM/YYYY') : '—' },
                      { label: 'Items', value: (row.items || []).length },
                    ]}
                    onView={() => handleView(row)}
                    onEdit={() => handleEdit(row)}
                    onDelete={() => handleDelete(row)}
                  />
                ))}
                {!isLoading && filteredRows.length === 0 && (
                  <EmptyState icon={<FormatListBulletedOutlinedIcon sx={{ fontSize: 48 }} />} title="No price lists found" message="Add your first price list to get started" />
                )}
              </Box>
            ) : (
              <ScrollableTableContainer>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell width={48}>#</TableCell>
                      <SortableHeaderCell field="priceListName" sort={table.sort} onSort={table.toggleSort}>Price List Name</SortableHeaderCell>
                      <SortableHeaderCell field="type" sort={table.sort} onSort={table.toggleSort}>Type</SortableHeaderCell>
                      <SortableHeaderCell field="effectiveDate" sort={table.sort} onSort={table.toggleSort}>Effective Date</SortableHeaderCell>
                      <SortableHeaderCell field="items" sort={table.sort} onSort={table.toggleSort}>Items</SortableHeaderCell>
                      <SortableHeaderCell field="status" sort={table.sort} onSort={table.toggleSort}>Status</SortableHeaderCell>
                      <TableCell align="right">Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {!isLoading && pagedRows.map((row, i) => (
                      <TableRow key={row.id} hover>
                        <TableCell>{page * pageSize + i + 1}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.priceListName}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.type || 'Other'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{row.effectiveDate ? dayjs(row.effectiveDate).format('DD/MM/YYYY') : '—'}</TableCell>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>{(row.items || []).length}</TableCell>
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
                        <TableCell colSpan={6}>
                          <EmptyState icon={<FormatListBulletedOutlinedIcon sx={{ fontSize: 48 }} />} title="No price lists found" message="Add your first price list to get started" />
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
      )}
    </Box>
  );
}
