import React from 'react';
import useTableFeatures from './useTableFeatures';

/**
 * Render-prop wrapper that owns a useTableFeatures instance.
 *
 * Some tables live inside a render prop (e.g. the invoice pickers nested in
 * <AppForm>{() => ...}</AppForm>), where their rows are derived from form
 * state and a hook cannot legally be called. This component provides the
 * hook at a valid component boundary and hands the table object back.
 *
 * <TableFeatureScope rows={partyInvoices} columns={INVOICE_COLUMNS}>
 *   {(table) => (
 *     <ScrollableTableContainer>...{table.rows.map(...)}...</ScrollableTableContainer>
 *   )}
 * </TableFeatureScope>
 */
export default function TableFeatureScope({ rows, columns, options, children }) {
  const table = useTableFeatures(rows, columns, options);
  return children(table);
}
