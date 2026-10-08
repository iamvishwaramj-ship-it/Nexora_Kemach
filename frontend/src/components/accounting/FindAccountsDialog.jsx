import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Box, Typography, Select, MenuItem,
} from '@mui/material';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * "Find Accounts" — the popup selection page from Chart Of Accounts that the
 * legacy Journal Entry screen opened from its G/L Acct/BP No. field's search
 * icon. Search + paginated table over whatever posting accounts the caller
 * hands it (JournalEntry.jsx passes the same postable-only filter its own
 * G/L Account dropdown uses); double-clicking a row, or selecting it and
 * pressing Ok, calls onSelect with that account and closes the dialog.
 *
 * accounts: [{ accountCode, accountName, accountNature, status, ... }]
 * onSelect(account) — called with the chosen account row
 */
export default function FindAccountsDialog({ open, accounts, onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [selectedCode, setSelectedCode] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts || [];
    return (accounts || []).filter(
      (a) => a.accountCode?.toLowerCase().includes(q) || a.accountName?.toLowerCase().includes(q)
    );
  }, [accounts, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pagedRows = useMemo(
    () => filtered.slice(page * pageSize, page * pageSize + pageSize),
    [filtered, page, pageSize]
  );

  // Reset to a clean state every time the dialog opens, rather than leaving
  // a stale search/page from the last time it was used on a different line.
  React.useEffect(() => {
    if (open) {
      setSearch('');
      setPageSize(50);
      setPage(0);
      setSelectedCode(null);
    }
  }, [open]);

  const choose = (account) => {
    onSelect?.(account);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { height: '80vh' } }}>
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>Find Accounts</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, py: 1.5, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 260 }}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">Show</Typography>
            <Select
              size="small"
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>
            <Typography variant="body2" color="text.secondary">per page</Typography>
          </Box>
        </Box>

        <TableContainer sx={{ flex: 1, border: '1px solid', borderColor: 'divider' }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={48} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>#</TableCell>
                <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>Account No</TableCell>
                <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>Account Name</TableCell>
                <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedRows.map((account, i) => (
                <TableRow
                  key={account.accountCode}
                  hover
                  selected={selectedCode === account.accountCode}
                  onClick={() => setSelectedCode(account.accountCode)}
                  onDoubleClick={() => choose(account)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{page * pageSize + i + 1}</TableCell>
                  <TableCell>{account.accountCode}</TableCell>
                  <TableCell>{account.accountName}</TableCell>
                  <TableCell>{account.status === 'I' ? 'Inactive' : 'Active'}</TableCell>
                </TableRow>
              ))}
              {pagedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>No accounts found</Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, pt: 1.5, flexWrap: 'wrap' }}>
          <Button size="small" disabled={page === 0} onClick={() => setPage(0)}>First</Button>
          <Button size="small" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Previous</Button>
          <Typography variant="body2" color="text.secondary" sx={{ mx: 1 }}>Page {page + 1} of {pageCount}</Typography>
          <Button size="small" disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>Next</Button>
          <Button size="small" disabled={page >= pageCount - 1} onClick={() => setPage(pageCount - 1)}>Last</Button>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button
          variant="contained"
          disabled={!selectedCode}
          onClick={() => {
            const account = (accounts || []).find((a) => a.accountCode === selectedCode);
            if (account) choose(account);
          }}
        >
          Ok
        </Button>
        <Button variant="outlined" color="error" onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
