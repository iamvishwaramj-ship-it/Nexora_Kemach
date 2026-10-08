import { z } from 'zod';
import { requiredString, positiveNumber } from './common';

// Shared by Delivery Challan and Stock Issue — the "Batches Number -
// Selection" / "Serial Numbers - Selection" dialog (BatchSerialSelectionDialog)
// lets a Batch/Serial-tracked line pick FROM stock already on hand, rather
// than create new numbers the way Purchase GRN/Stock Receipt's "... - Setup"
// dialog does (see productBatchLineSchema/productSerialLineSchema in
// purchaseSchemas.js for that side). The shapes are deliberately smaller:
// an allocation only needs to name which existing batch/serial was taken and
// (for a batch) how much of it — every other attribute already lives on the
// ProductBatch/ProductSerial row created when that stock came in.
export const batchAllocationLineSchema = z.object({
  batchNo: requiredString('Batch No.'),
  // positiveNumber(), not a bare z.number(): the helper preprocesses through
  // toNumberInput, so a quantity that arrives from the API as a string parses
  // instead of failing with "Quantity must be a number". Sub-rows like this
  // one are the exposed case — every page coerces its own top-level item
  // fields in rowToFormValues, but a nested array is easy to pass straight
  // through untouched, and the Save button is gated on live schema validation
  // (FormSubmitButton in AppForm.jsx), so one string here disables saving from
  // the first render with no visible field error to explain it. Same bug class
  // as the one described on optionalDate() in common.js. Messages are
  // unchanged: positiveNumber('Quantity') emits exactly these two strings.
  quantity: positiveNumber('Quantity'),
});

export const serialAllocationLineSchema = z.object({
  serialNo: requiredString('Serial No.'),
});
