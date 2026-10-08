import React, { useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Box, Typography, Select, MenuItem,
} from '@mui/material';

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

/**
 * "Find Business Partner" — opened from a Journal Line's search icon with
 * Ctrl/Cmd+click (a plain click opens FindAccountsDialog instead). Search +
 * paginated table over every Business Partner (Customer and Vendor alike,
 * same list JournalEntry.jsx's own businessPartnerCode dropdown uses);
 * double-clicking a row, or selecting it and pressing Ok, calls onSelect
 * with that partner and closes the dialog. Selecting a partner here fills
 * only that line's Business Partner code+name — it never touches G/L
 * Account, which is what the plain-click Find Accounts popup is for.
 *
 * partners: [{ partnerCode, partnerName, partnerType, ... }]
 * onSelect(partner) — called with the chosen partner row
 */
export default function FindBusinessPartnersDialog({ open, partners, onClose, onSelect }) {
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [selectedCode, setSelectedCode] = useState(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners || [];
    return (partners || []).filter(
      (p) => p.partnerCode?.toLowerCase().includes(q) || p.partnerName?.toLowerCase().includes(q)
    );
  }, [partners, search]);

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

  const choose = (partner) => {
    onSelect?.(partner);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { height: '80vh' } }}>
      <DialogTitle sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>Find Business Partner</DialogTitle>
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
                <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>Partner Code</TableCell>
                <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>Partner Name</TableCell>
                <TableCell sx={{ bgcolor: 'primary.main', color: 'primary.contrastText' }}>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {pagedRows.map((partner, i) => (
                <TableRow
                  key={partner.partnerCode}
                  hover
                  selected={selectedCode === partner.partnerCode}
                  onClick={() => setSelectedCode(partner.partnerCode)}
                  onDoubleClick={() => choose(partner)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{page * pageSize + i + 1}</TableCell>
                  <TableCell>{partner.partnerCode}</TableCell>
                  <TableCell>{partner.partnerName}</TableCell>
                  <TableCell>{partner.partnerType}</TableCell>
                </TableRow>
              ))}
              {pagedRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>No business partners found</Typography>
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
            const partner = (partners || []).find((p) => p.partnerCode === selectedCode);
            if (partner) choose(partner);
          }}
        >
          Ok
        </Button>
        <Button variant="outlined" color="error" onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
