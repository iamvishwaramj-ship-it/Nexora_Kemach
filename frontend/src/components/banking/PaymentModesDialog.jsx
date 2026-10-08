import React, { useEffect, useMemo, useState } from 'react';
import {
  Box, Dialog, DialogContent, DialogActions, Button, IconButton, Typography, Stack,
  Tabs, Tab, TextField, Autocomplete, Table, TableHead, TableBody, TableRow, TableCell,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RemoveIcon from '@mui/icons-material/Remove';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { chartOfAccountApi } from '../../features/resources';
import { useCurrencyOptions } from '../../lib/currencyOptions';
import { countries } from '../../lib/constants/locations';
import ScrollableTableContainer from '../data-display/ScrollableTableContainer';

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const emptyChequeRow = () => ({
  dueDate: '', amount: '', bankName: '', branch: '', account: '', glAccount: '',
  country: '', chequeNo: '', chequeDate: '', type: '', endors: '', issuedBy: '',
});

// G/L Account picker as a searchable Autocomplete, sourced from the same
// chartOfAccountApi list every other G/L Account field in the app uses
// (see AccountCodeDropdownPaper in WarehouseMaster.jsx/ProductGroup.jsx).
// Matches the searchable G/L Account column in the cheque rows table and
// the Currency field above — type-to-filter by account code or name.
function GLAccountField({ label, value, onChange, options, required }) {
  return (
    <Box>
      {label && (
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
          {label}{required && <Box component="span" sx={{ color: 'error.main' }}> *</Box>}
        </Typography>
      )}
      <Autocomplete
        size="small"
        fullWidth
        autoHighlight
        options={options}
        value={options.find((o) => o.value === value) || null}
        isOptionEqualToValue={(o, v) => o.value === v.value}
        getOptionLabel={(o) => o.label || ''}
        onChange={(_e, v) => onChange(v?.value ?? '')}
        renderInput={(params) => <TextField {...params} placeholder="Select..." />}
      />
    </Box>
  );
}

function LabeledField({ label, required, children }) {
  return (
    <Box>
      {label && (
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
          {label}{required && <Box component="span" sx={{ color: 'error.main' }}> *</Box>}
        </Typography>
      )}
      {children}
    </Box>
  );
}

// A record saved before this tab's option list was narrowed (or one saved
// under a different name convention) may hold a code that isn't in the
// filtered list. Rather than silently blanking the field, append it so the
// stored value keeps showing -- the backend re-validates the code on save
// regardless of what the dropdown offers.
function withFallback(filteredOptions, value, allOptions) {
  if (!value || filteredOptions.some((o) => o.value === value)) return filteredOptions;
  const fallback = allOptions.find((o) => o.value === value);
  return fallback ? [...filteredOptions, fallback] : filteredOptions;
}

/**
 * "Payment Modes" popup — reached from the eye icon next to Applied Amount
 * on Payment Receipt and Payment Voucher. Currency + Cash / Cheque / Bank
 * Transfer sub-tabs, each with its own G/L Account and amount, plus a
 * shared Bank Charges / Overall Amount / Discount / Balance Due / Paid
 * Amount section underneath every tab.
 *
 * Self-contained local state rather than wired into the host page's
 * react-hook-form instance — it's a satellite breakdown of how the payment
 * splits across modes, not itself a field the parent schema validates.
 * `onApply` (optional) hands the finished breakdown back to the caller.
 */
export default function PaymentModesDialog({ open, onClose, appliedAmount = 0, defaultCurrency = 'INR', onApply, initial = null }) {
  // Every currency dropdown reads live from Currency Master instead of a
  // hardcoded list — see lib/currencyOptions.js.
  const currencyOptions = useCurrencyOptions();
  const { data: accounts } = chartOfAccountApi.useList();
  const accountOptions = useMemo(() => (accounts || [])
    .filter((a) => a.accountNature === 'A' && a.status === 'A')
    .map((a) => ({ label: `${a.accountCode} — ${a.accountName}`, value: a.accountCode })),
  [accounts]);

  // Cash only ever moves through a Petty Cash account, and Cheque/Bank
  // Transfer only ever move through a bank account -- so each tab's G/L
  // Account picker is narrowed to the accounts that actually apply to it,
  // rather than offering the entire (very long) chart of accounts on every
  // tab. Bank Charges is a bank-side deduction too, so it shares the same
  // bank list. Matched by name since neither concept has its own flag on
  // ChartOfAccount.
  const pettyCashOptions = useMemo(() => (accounts || [])
    .filter((a) => a.accountNature === 'A' && a.status === 'A' && /petty cash/i.test(a.accountName || ''))
    .map((a) => ({ label: `${a.accountCode} — ${a.accountName}`, value: a.accountCode })),
  [accounts]);
  const bankOptions = useMemo(() => (accounts || [])
    .filter((a) => a.accountNature === 'A' && a.status === 'A' && /bank/i.test(a.accountName || ''))
    .map((a) => ({ label: `${a.accountCode} — ${a.accountName}`, value: a.accountCode })),
  [accounts]);

  const [currency, setCurrency] = useState(defaultCurrency);
  const [tab, setTab] = useState(0);
  const [cash, setCash] = useState({ glAccount: '', primaryFormItem: '', total: '' });
  const [cheque, setCheque] = useState({ glAccount: '', rows: [] });
  const [bankTransfer, setBankTransfer] = useState({ glAccount: '', transferDate: '', reference: '', total: '' });
  const [bankChargesAccount, setBankChargesAccount] = useState('');
  const [bankChargesAmount, setBankChargesAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [paidAmount, setPaidAmount] = useState('');

  // Re-seed every field whenever the dialog is (re)opened, so a value typed
  // and then cancelled doesn't linger the next time it's reopened, and the
  // Overall Amount always reflects whatever the host form's Applied Amount
  // currently is. `initial` (the mode/account/bank-charges breakdown the
  // host page persisted from a previous Ok) re-selects the tab and account
  // that were chosen last time, rather than always starting blank -- see
  // PaymentReceipt.jsx / PaymentVoucher.jsx onApply.
  useEffect(() => {
    if (!open) return;
    setCurrency(defaultCurrency);
    const modeIndex = Math.max(0, ['Cash', 'Cheque', 'Bank Transfer'].indexOf(initial?.mode));
    setTab(modeIndex);
    setCash({ glAccount: modeIndex === 0 ? (initial?.glAccount || '') : '', primaryFormItem: '', total: '' });
    setCheque({ glAccount: modeIndex === 1 ? (initial?.glAccount || '') : '', rows: [] });
    setBankTransfer({ glAccount: modeIndex === 2 ? (initial?.glAccount || '') : '', transferDate: '', reference: '', total: '' });
    setBankChargesAccount(initial?.bankChargesAccount || '');
    setBankChargesAmount(initial?.bankChargesAmount ? String(initial.bankChargesAmount) : '');
    setDiscountPercent('');
    setPaidAmount(appliedAmount ? String(round2(appliedAmount)) : '');
  }, [open, defaultCurrency, appliedAmount, initial]);

  const overallAmount = round2(appliedAmount);
  const balanceDue = round2(overallAmount - (Number(paidAmount) || 0));
  const chequeTotal = round2(cheque.rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0));

  const updateChequeRow = (index, patch) => {
    setCheque((prev) => ({
      ...prev,
      rows: prev.rows.map((r, i) => (i === index ? { ...r, ...patch } : r)),
    }));
  };
  const addChequeRow = () => setCheque((prev) => ({ ...prev, rows: [...prev.rows, emptyChequeRow()] }));
  const removeChequeRow = (index) => setCheque((prev) => ({ ...prev, rows: prev.rows.filter((_, i) => i !== index) }));

  const handleOk = () => {
    onApply?.({
      currency, mode: ['Cash', 'Cheque', 'Bank Transfer'][tab],
      cash, cheque: { ...cheque, total: chequeTotal }, bankTransfer,
      bankChargesAccount, bankChargesAmount: Number(bankChargesAmount) || 0,
      overallAmount, discountPercent: Number(discountPercent) || 0,
      balanceDue, paidAmount: Number(paidAmount) || 0,
    });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      {/* Title bar styled after the reference screen — a solid primary strip
          with a thin accent line beneath it, rather than the app's usual
          plain DialogTitle, since this popup is meant to read as a
          self-contained "mode" screen. */}
      <Box sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', px: 3, py: 1.75, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle1" fontWeight={700}>Payment Modes</Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton size="small" sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,0.15)' }} disabled>
            <RemoveIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" sx={{ color: 'inherit', bgcolor: 'rgba(255,255,255,0.15)' }} disabled>
            <OpenInFullIcon fontSize="small" sx={{ fontSize: 16 }} />
          </IconButton>
          <IconButton size="small" onClick={onClose} sx={{ color: '#fff', bgcolor: 'error.main', '&:hover': { bgcolor: 'error.dark' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Box>
      <Box sx={{ height: 4, bgcolor: 'success.main' }} />

      <DialogContent sx={{ p: 3 }}>
        <Box sx={{ maxWidth: 360, mb: 3 }}>
          <LabeledField label="Currency">
            <Autocomplete
              size="small"
              options={currencyOptions}
              value={currencyOptions.find((o) => o.value === currency) || null}
              isOptionEqualToValue={(o, v) => o.value === v.value}
              getOptionLabel={(o) => o.label || ''}
              onChange={(_e, v) => setCurrency(v?.value ?? '')}
              renderInput={(params) => <TextField {...params} />}
            />
          </LabeledField>
        </Box>

        <Tabs value={tab} onChange={(_e, v) => setTab(v)} sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Cash" />
          <Tab label="Cheque" />
          <Tab label="Bank Transfer" />
        </Tabs>

        {/* Cash: one combined grid rather than the tab's own two fields
        (G/L Account, Total, Primary Form Item — the last of which never had
        real options to begin with) plus a separate shared totals block below
        it. G/L Account is still Cash's own field; everything alongside it
        (Total Due/Discount/Paid Amount/Balance Due/Bank Charges) is the same
        shared state Cheque and Bank Transfer use too, just laid out here as
        a single grid instead of split across two blocks. Cheque and Bank
        Transfer keep their own tab content plus the shared block underneath,
        unchanged, below. */}
        {tab === 0 && (
          <Box sx={{ mb: 3 }}>
            {/* Grid 1: G/L Account, Discount %, Balance Due, Total Due,
            Paid Amount — the first 5 fields, together, in their own
            outlined box. */}
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                <Stack spacing={2} sx={{ flex: 1 }}>
                  <GLAccountField
                    label="G/L Account" required
                    value={cash.glAccount}
                    onChange={(v) => setCash((p) => ({ ...p, glAccount: v }))}
                    options={withFallback(pettyCashOptions, cash.glAccount, accountOptions)}
                  />
                  <LabeledField label="Discount %">
                    <TextField size="small" type="number" placeholder="Discount Amount" fullWidth
                      value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
                  </LabeledField>
                  <LabeledField label="Balance Due">
                    <TextField size="small" fullWidth disabled value={balanceDue.toFixed(3)} />
                  </LabeledField>
                </Stack>
                <Stack spacing={2} sx={{ flex: 1 }}>
                  <LabeledField label="Total Due" required>
                    <TextField size="small" fullWidth disabled value={overallAmount.toFixed(3)} />
                  </LabeledField>
                  <LabeledField label="Paid Amount" required>
                    <TextField size="small" type="number" fullWidth
                      value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
                  </LabeledField>
                  {/* Balance Due (left column, same row) has no partner field
                  — left blank rather than inventing one. */}
                  <Box />
                </Stack>
              </Stack>
            </Box>

            {/* Grid 2: Bank Charges G/L Account, Bank Charges Amount — the
            next 2 fields, on their own, in their own outlined box. */}
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mt: 3 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                <Stack spacing={2} sx={{ flex: 1 }}>
                  <GLAccountField
                    label="Bank Charges G/L Account"
                    value={bankChargesAccount}
                    onChange={setBankChargesAccount}
                    options={withFallback(bankOptions, bankChargesAccount, accountOptions)}
                  />
                </Stack>
                <Stack spacing={2} sx={{ flex: 1 }}>
                  <LabeledField label="Bank Charges Amount">
                    <TextField size="small" type="number" placeholder="Charges Amount" fullWidth
                      value={bankChargesAmount} onChange={(e) => setBankChargesAmount(e.target.value)} />
                  </LabeledField>
                </Stack>
              </Stack>
            </Box>

            {/* Overall Amount — outside both outlines, still below Bank
            Charges Amount on the right side. */}
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} sx={{ mt: 2 }}>
              <Box sx={{ flex: 1 }} />
              <Box sx={{ flex: 1, textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary">Overall Amount</Typography>
                <Typography variant="h5" fontWeight={700}>{overallAmount.toFixed(3)}</Typography>
              </Box>
            </Stack>
          </Box>
        )}

        {tab === 1 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ maxWidth: 420, mb: 2 }}>
              <GLAccountField
                label="G/L Account" required
                value={cheque.glAccount}
                onChange={(v) => setCheque((p) => ({ ...p, glAccount: v }))}
                options={withFallback(bankOptions, cheque.glAccount, accountOptions)}
              />
            </Box>

            <ScrollableTableContainer maxHeight={280}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={40}>#</TableCell>
                    <TableCell>Due Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell>Bank Name</TableCell>
                    <TableCell>Branch</TableCell>
                    <TableCell>Account</TableCell>
                    <TableCell>G/L Account</TableCell>
                    <TableCell>Country</TableCell>
                    <TableCell>Cheque No. *</TableCell>
                    <TableCell>Cheque Date *</TableCell>
                    <TableCell>Type</TableCell>
                    <TableCell>Endors</TableCell>
                    <TableCell>Originally Issued By</TableCell>
                    <TableCell width={40} />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cheque.rows.length === 0 && (
                    <TableRow>
                      <TableCell />
                      <TableCell colSpan={12}>
                        <Typography variant="caption" color="text.secondary">Total</Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">{chequeTotal.toFixed(3)}</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {cheque.rows.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell sx={{ minWidth: 130 }}>
                        <TextField size="small" type="date" fullWidth value={row.dueDate} onChange={(e) => updateChequeRow(i, { dueDate: e.target.value })} />
                      </TableCell>
                      <TableCell align="right" sx={{ minWidth: 90 }}>
                        <TextField inputProps={{ style: { textAlign: 'right' } }} size="small" type="number" fullWidth value={row.amount} onChange={(e) => updateChequeRow(i, { amount: e.target.value })} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 130 }}>
                        <TextField size="small" fullWidth value={row.bankName} onChange={(e) => updateChequeRow(i, { bankName: e.target.value })} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 110 }}>
                        <TextField size="small" fullWidth value={row.branch} onChange={(e) => updateChequeRow(i, { branch: e.target.value })} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 110 }}>
                        <TextField size="small" fullWidth value={row.account} onChange={(e) => updateChequeRow(i, { account: e.target.value })} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>
                        <Autocomplete
                          size="small"
                          options={withFallback(bankOptions, row.glAccount, accountOptions)}
                          value={accountOptions.find((o) => o.value === row.glAccount) || null}
                          isOptionEqualToValue={(o, v) => o.value === v.value}
                          getOptionLabel={(o) => o.label || ''}
                          onChange={(_e, v) => updateChequeRow(i, { glAccount: v?.value ?? '' })}
                          renderInput={(params) => <TextField {...params} placeholder="Search..." />}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 130 }}>
                        <Autocomplete
                          size="small"
                          options={countries}
                          value={countries.find((c) => c.value === row.country) || null}
                          isOptionEqualToValue={(o, v) => o.value === v.value}
                          getOptionLabel={(o) => o.label || ''}
                          onChange={(_e, v) => updateChequeRow(i, { country: v?.value ?? '' })}
                          renderInput={(params) => <TextField {...params} />}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <TextField size="small" fullWidth value={row.chequeNo} onChange={(e) => updateChequeRow(i, { chequeNo: e.target.value })} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 130 }}>
                        <TextField size="small" type="date" fullWidth value={row.chequeDate} onChange={(e) => updateChequeRow(i, { chequeDate: e.target.value })} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 100 }}>
                        <TextField size="small" fullWidth value={row.type} onChange={(e) => updateChequeRow(i, { type: e.target.value })} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 100 }}>
                        <TextField size="small" fullWidth value={row.endors} onChange={(e) => updateChequeRow(i, { endors: e.target.value })} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 160 }}>
                        <TextField size="small" fullWidth value={row.issuedBy} onChange={(e) => updateChequeRow(i, { issuedBy: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" color="error" onClick={() => removeChequeRow(i)} aria-label="remove cheque row">
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                  {cheque.rows.length > 0 && (
                    <TableRow>
                      <TableCell />
                      <TableCell colSpan={2}>
                        <Typography variant="caption" color="text.secondary">Total: {chequeTotal.toFixed(3)}</Typography>
                      </TableCell>
                      <TableCell colSpan={10} />
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollableTableContainer>
            <Button size="small" startIcon={<AddIcon />} onClick={addChequeRow} sx={{ mt: 1 }}>
              Add Cheque
            </Button>
          </Box>
        )}

        {/* Bank Transfer: same combined-grid pattern as Cash — its own G/L
        Account/Transfer Date paired with the shared Discount/Total Due/
        Balance Due/Paid Amount fields, each half in its own outlined box,
        Overall Amount below both, outside either outline. Reference and the
        old free-entry Total field are dropped, same as Cash's Primary Form
        Item/Total were — neither was read anywhere outside this dialog's own
        local state. */}
        {tab === 2 && (
          <Box sx={{ mb: 3 }}>
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                <Stack spacing={2} sx={{ flex: 1 }}>
                  <GLAccountField
                    label="G/L Account" required
                    value={bankTransfer.glAccount}
                    onChange={(v) => setBankTransfer((p) => ({ ...p, glAccount: v }))}
                    options={withFallback(bankOptions, bankTransfer.glAccount, accountOptions)}
                  />
                  <LabeledField label="Discount %">
                    <TextField size="small" type="number" placeholder="Discount Amount" fullWidth
                      value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
                  </LabeledField>
                  <LabeledField label="Balance Due">
                    <TextField size="small" fullWidth disabled value={balanceDue.toFixed(3)} />
                  </LabeledField>
                </Stack>
                <Stack spacing={2} sx={{ flex: 1 }}>
                  <LabeledField label="Transfer Date">
                    <TextField size="small" type="date" fullWidth
                      value={bankTransfer.transferDate} onChange={(e) => setBankTransfer((p) => ({ ...p, transferDate: e.target.value }))} />
                  </LabeledField>
                  <LabeledField label="Total Due" required>
                    <TextField size="small" fullWidth disabled value={overallAmount.toFixed(3)} />
                  </LabeledField>
                  <LabeledField label="Paid Amount" required>
                    <TextField size="small" type="number" fullWidth
                      value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
                  </LabeledField>
                </Stack>
              </Stack>
            </Box>

            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1, p: 2, mt: 3 }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                <Stack spacing={2} sx={{ flex: 1 }}>
                  <GLAccountField
                    label="Bank Charges G/L Account"
                    value={bankChargesAccount}
                    onChange={setBankChargesAccount}
                    options={withFallback(bankOptions, bankChargesAccount, accountOptions)}
                  />
                </Stack>
                <Stack spacing={2} sx={{ flex: 1 }}>
                  <LabeledField label="Bank Charges Amount">
                    <TextField size="small" type="number" placeholder="Charges Amount" fullWidth
                      value={bankChargesAmount} onChange={(e) => setBankChargesAmount(e.target.value)} />
                  </LabeledField>
                </Stack>
              </Stack>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={4} sx={{ mt: 2 }}>
              <Box sx={{ flex: 1 }} />
              <Box sx={{ flex: 1, textAlign: 'right' }}>
                <Typography variant="body2" color="text.secondary">Overall Amount</Typography>
                <Typography variant="h5" fontWeight={700}>{overallAmount.toFixed(3)}</Typography>
              </Box>
            </Stack>
          </Box>
        )}

        {/* Shared, Cheque only now — Cash and Bank Transfer each have their
        own combined grid (with the same fields) inline above instead of
        this block. */}
        {tab === 1 && (
        <Box sx={{ borderTop: 1, borderColor: 'divider', pt: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
            <Stack spacing={2} sx={{ flex: 1 }}>
              <GLAccountField
                label="Bank Charges G/L Account"
                value={bankChargesAccount}
                onChange={setBankChargesAccount}
                options={withFallback(bankOptions, bankChargesAccount, accountOptions)}
              />
              <LabeledField label="Overall Amount" required>
                <TextField size="small" fullWidth disabled value={overallAmount.toFixed(3)} />
              </LabeledField>
              <LabeledField label="Balance Due">
                <TextField size="small" fullWidth disabled value={balanceDue.toFixed(3)} />
              </LabeledField>
            </Stack>
            <Stack spacing={2} sx={{ flex: 1 }}>
              <LabeledField label="Bank Charges Amount">
                <TextField size="small" type="number" placeholder="Charges Amount" fullWidth
                  value={bankChargesAmount} onChange={(e) => setBankChargesAmount(e.target.value)} />
              </LabeledField>
              <LabeledField label="Discount %">
                <TextField size="small" type="number" placeholder="Discount Amount" fullWidth
                  value={discountPercent} onChange={(e) => setDiscountPercent(e.target.value)} />
              </LabeledField>
              <LabeledField label="Paid Amount" required>
                <TextField size="small" type="number" fullWidth
                  value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} />
              </LabeledField>
            </Stack>
          </Stack>
        </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={handleOk}>Ok</Button>
        <Button variant="contained" color="error" onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
