import React, { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, CircularProgress, Alert,
  Link,
} from '@mui/material';
import dayjs from 'dayjs';
import { journalEntryApi } from '../../features/resources';

const STATUS_COLORS = {
  Draft: 'info', Posted: 'success', 'Pending G/L': 'warning',
  // Superseded by a reversal (see reverseJournalEntry in utils/glPosting.js)
  // rather than deleted -- still worth its own color so it doesn't read as
  // just another Draft/Posted state.
  Reversed: 'default',
};

function Field({ label, value }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Typography variant="caption" color="text.secondary" component="div">{label}</Typography>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{value || value === 0 ? value : '—'}</Typography>
    </Grid>
  );
}

/**
 * Read-only Journal Entry viewer, opened from a source document (Purchase
 * GRN's "View Journal Entry" icon) without navigating away from that
 * document's own screen. Fetches the entry fresh by its id — the id must
 * come from the caller's own document (e.g. the GRN's journalEntryId,
 * attached server-side via attachJournalEntryRefs in routes/resources.js,
 * itself a reverse lookup on JournalEntry.sourceType/sourceDocNo — see
 * postJournalEntry in utils/glPosting.js). Never resolved by matching
 * journalEntryNo text, so it can never show a different document's entry.
 *
 * Deliberately does not reuse JournalEntryForm.jsx: that form is built
 * around react-hook-form editing state (manual entries, add/remove lines),
 * which is unnecessary weight for a pure read-only popup. Instead this
 * mirrors the same Dialog structure/styling used across the app's other
 * view popups (see FindAccountsDialog.jsx) and the same field/status
 * conventions as JournalEntry.jsx's own list and detail views.
 *
 * journalEntryId: number | null | undefined — when falsy, the dialog (if
 * open) shows a "not available" state rather than firing a request.
 *
 * Reversed-by / reverses navigation: `entry.reversedEntry` (present when
 * THIS entry is an original that has since been reversed — see
 * journalEntryInclude in routes/resources.js) and `entry.reversalOf`
 * (present when THIS entry IS a reversal) each render as a link that swaps
 * the dialog to that other entry, via local `viewId` state rather than a
 * second dialog instance — `viewId` defaults to the caller's own
 * `journalEntryId` and is reset to it whenever the dialog (re)opens or the
 * caller points it at a different entry, so following a link and closing the
 * dialog never leaves the NEXT open showing the wrong entry.
 */
export default function JournalEntryViewDialog({ open, journalEntryId, onClose }) {
  const { useGet } = journalEntryApi;
  const [viewId, setViewId] = useState(journalEntryId);
  useEffect(() => {
    if (open) setViewId(journalEntryId);
  }, [open, journalEntryId]);

  const {
    data: entry, isFetching, isError,
  } = useGet(viewId, { skip: !open || !viewId });

  const lines = entry?.lines || [];
  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { maxHeight: '85vh' } }}>
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>
        View Journal Entry
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
        {!journalEntryId && (
          <Alert severity="info">No Journal Entry is linked to this document yet.</Alert>
        )}

        {journalEntryId && isFetching && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {journalEntryId && !isFetching && (isError || !entry) && (
          <Alert severity="warning">
            This Journal Entry could not be found — it may have been deleted or reversed.
          </Alert>
        )}

        {journalEntryId && !isFetching && entry && (
          <>
            <Grid container spacing={2}>
              <Field label="Journal No" value={entry.journalEntryNo} />
              <Field label="Journal Date" value={entry.postingDate ? dayjs(entry.postingDate).format('DD/MM/YYYY') : ''} />
              <Grid item xs={12} sm={6} md={4}>
                <Typography variant="caption" color="text.secondary" component="div">Status</Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                  <Chip
                    size="small"
                    label={entry.status}
                    color={STATUS_COLORS[entry.status] || 'default'}
                  />
                  {/* isReversal marks the mirrored entry itself (see
                      reverseJournalEntry in utils/glPosting.js) -- called out
                      separately from Status since a reversal is always
                      Posted, "Reversed" only ever describes the ORIGINAL it
                      was created against. */}
                  {entry.isReversal && (
                    <Chip size="small" label="Reversal" color="secondary" variant="outlined" />
                  )}
                </Box>
              </Grid>
              {/* Reversal linkage -- at most one of these is ever present on
                  a given entry (see the field's own doc comment in
                  schema.prisma): reversedEntry when THIS entry is an
                  original that has since been reversed, reversalOf when
                  THIS entry IS the reversal. Clicking either swaps the
                  dialog to that other entry instead of opening a second one. */}
              {entry.reversedEntry && (
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" color="text.secondary" component="div">Reversed By</Typography>
                  <Link component="button" type="button" variant="body2" onClick={() => setViewId(entry.reversedEntry.id)}>
                    {entry.reversedEntry.journalEntryNo}
                  </Link>
                </Grid>
              )}
              {entry.reversalOf && (
                <Grid item xs={12} sm={6} md={4}>
                  <Typography variant="caption" color="text.secondary" component="div">Reverses</Typography>
                  <Link component="button" type="button" variant="body2" onClick={() => setViewId(entry.reversalOf.id)}>
                    {entry.reversalOf.journalEntryNo}
                  </Link>
                </Grid>
              )}
              <Field label="Reference / Source Document" value={entry.sourceDocNo || entry.referenceNo} />
              <Field label="Currency" value={entry.currency} />
              <Field label="Total Debit" value={Number(totalDebit).toFixed(2)} />
              <Field label="Total Credit" value={Number(totalCredit).toFixed(2)} />
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary" component="div">Description / Memo</Typography>
                <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>{entry.remarks || '—'}</Typography>
              </Grid>
            </Grid>

            {entry.glError && (
              <Alert severity="warning">{entry.glError}</Alert>
            )}

            <TableContainer sx={{ maxHeight: 320, border: '1px solid', borderColor: 'divider' }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>G/L Account</TableCell>
                    <TableCell>Account Name</TableCell>
                    <TableCell align="right">Debit</TableCell>
                    <TableCell align="right">Credit</TableCell>
                    <TableCell>Warehouse</TableCell>
                    <TableCell>Remarks</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lines.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary">No journal lines.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                  {lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell>{line.accountCode}</TableCell>
                      <TableCell>{line.accountName || '—'}</TableCell>
                      <TableCell align="right">{Number(line.debit) ? Number(line.debit).toFixed(2) : ''}</TableCell>
                      <TableCell align="right">{Number(line.credit) ? Number(line.credit).toFixed(2) : ''}</TableCell>
                      <TableCell>{line.warehouse || '—'}</TableCell>
                      <TableCell>{line.description || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
