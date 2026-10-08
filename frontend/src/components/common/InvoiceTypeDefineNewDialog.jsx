import React, { useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';

/**
 * Invoice Type's "Define New" option, opened from PurchaseOtherDetailsCard
 * (Purchase Order / Purchase GRN / Purchase Invoice's "Other Details" card).
 * A small standalone dialog — not wired through react-hook-form — because
 * it writes to a different resource (POST /invoice-types) than whichever
 * document form it was opened from, then hands the created name back via
 * onCreated to be set on that form's own invoiceType field.
 */
export default function InvoiceTypeDefineNewDialog({ open, onClose, onCreated, createInvoiceType, creating, existingNames = [], notify }) {
  const [name, setName] = useState('');

  useEffect(() => {
    if (open) setName('');
  }, [open]);

  const trimmed = name.trim();
  // Client-side duplicate check purely for a snappier error — the server's
  // own unique constraint on InvoiceType.name (see schema.prisma) is what
  const isDuplicate = Boolean(trimmed) && existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase());

  const handleSave = async () => {
    if (!trimmed || isDuplicate) return;
    try {
      const created = await createInvoiceType({ name: trimmed }).unwrap();
      notify.success(`Invoice Type "${created.name}" added.`);
      onCreated(created.name);
      onClose();
    } catch (err) {
      notify.error(err?.data?.message || 'Could not save the new Invoice Type.');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Define New Invoice Type</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label="Invoice Type"
          placeholder="Enter a new invoice type"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
          error={isDuplicate}
          helperText={isDuplicate ? 'This Invoice Type already exists.' : ' '}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={!trimmed || isDuplicate || creating}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
