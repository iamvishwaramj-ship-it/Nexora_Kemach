import { useGetProductWarehouseStockQuery } from '../features/resources';

// Live on-hand quantity for one (productCode, warehouse) line, shared by
// every stock-reducing line-item table: Sales Order, Delivery Challan,
// direct Sales Invoice, Stock Issue, and a Decrease Stock Adjustment line.
//
// Wraps GET /products/:productCode/stock — a lightweight single-pair lookup
// (see backend routes/resources.js), not the heavier all-warehouses
// '/products/:productCode/inventory' endpoint StockTransferItem.totalStock
// uses, since this refetches on effectively every warehouse/quantity
// keystroke across many tables at once.
//
// The query is automatically re-run by RTK Query whenever productCode or
// warehouse change, which is what makes the max/available figure refresh
// per warehouse rather than staying cached from whichever warehouse was
// selected first — the re-validate-on-warehouse-change requirement.
//
// Server-side is still the authority: this hook is for the inline "Available:
// N" hint and for disabling Save early, exactly like
// StockAdjustmentItem.systemQuantity / StockTransferItem.totalStock are
// client-side hints that get recomputed and enforced again on save.
export function useWarehouseStock(productCode, warehouse) {
  const skip = !productCode || !warehouse;
  const { data, isFetching } = useGetProductWarehouseStockQuery(
    { productCode, warehouse },
    { skip, refetchOnMountOrArgChange: true }
  );
  return {
    onHand: skip ? null : Number(data?.onHand ?? 0),
    isLoading: !skip && isFetching,
  };
}
