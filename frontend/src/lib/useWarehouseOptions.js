import { useMemo } from 'react';
import { warehouseMasterApi } from '../features/resources';

// The single source of warehouse dropdown options for the whole application.
//
// Before this existed, warehouse lists were invented independently on every
// screen, from four unrelated sources:
//
//   * Stock Receipt / Issue / Adjustment, Purchase GRN, Delivery Challan
//     offered the literal string 'Main Warehouse' plus every BRANCH name —
//     branches, not warehouses;
//   * five inventory reports built their list from the distinct free-text
//     values of Product.defaultLocation;
//   * Stock Summary used '<branch> Warehouse' strings;
//   * only Opening Balance read an actual warehouse master.
//
// So no two screens offered the same list, and a warehouse chosen on a Stock
// Receipt could not be filtered for in a report. Everything now reads the
// Warehouse Master (Prisma WarehouseMaster, table [dbo].[warehouse]).
//
// --- What gets STORED ------------------------------------------------------
// The warehouse CODE ('WND220'), not the name. Two reasons: a code survives a
// rename, and the stock journal's Warehouse column is NVARCHAR(8) — codes fit,
// full names were being silently truncated. The label shows both so the code
// is never something anyone has to memorise.

/** 'WND220 — WAYANAD BHL WH', or just the code when the name is missing. */
export function warehouseLabel(w) {
  const code = String(w?.whsCode ?? '').trim();
  const name = String(w?.whsName ?? '').trim();
  if (!name) return code;
  return `${code} — ${name}`;
}

/**
 * The set of warehouse codes valid for `branch`, applying the exact same
 * "branch scoping only actually applies once someone has used it" rule as
 * useWarehouseOptions below — see that hook's doc comment on `branch` for
 * why. Exported so every page's own "switching branch invalidates a
 * Warehouse choice from the old one" effect checks a line's warehouse
 * against the same rule the dropdown itself used to offer it, instead of
 * each page re-deriving a plain `w.branch === branch` filter that would
 * wipe every line's warehouse the moment a document's branch is set, on any
 * data where WarehouseMaster.branch has never been filled in.
 */
export function warehouseCodesForBranch(warehouses, branch) {
  const branchScopingInUse = (warehouses || []).some((w) => String(w.branch || '').trim() !== '');
  return new Set(
    (warehouses || [])
      .filter((w) => !branch || !branchScopingInUse || w.branch === branch)
      .map((w) => w.whsCode)
  );
}

/**
 * Warehouse options for a FormSelect.
 *
 * @param {object}  opts
 * @param {string|string[]} opts.currentValue  the value(s) already stored on
 *   the record being edited. THIS IS NOT OPTIONAL IN PRACTICE on any edit
 *   form. Documents saved before the master existed hold values like 'Main
 *   Warehouse' or a branch name, which match no warehouse; a multi-line
 *   document (Sales/Purchase Order, Quotation, Invoice, ...) can also have a
 *   different, perfectly valid warehouse on each line, one that simply isn't
 *   in the *currently selected* branch's list. Without passing every one of
 *   them in, the select finds no matching option, renders blank on edit/view
 *   even though the field's real value is intact, and the next save silently
 *   rewrites a posted document's warehouse to null — changing what the stock
 *   ledger says about where the stock went. Pass a single code, or an array
 *   (e.g. every line's warehouse) when more than one value needs to survive.
 *   Each survives as a selectable option marked (not in Warehouse Master)
 *   when it isn't a live one, so it is visible, preserved, and obviously in
 *   need of correction.
 * @param {string}  opts.allLabel  when set, prepends an "all warehouses" option
 *   carrying the empty string — for report filters, where blank means
 *   unfiltered rather than unset.
 * @param {boolean} opts.includeInactive  inactive warehouses are hidden by
 *   default; an existing record's warehouse is kept regardless via currentValue.
 * @param {string}  opts.branch  when set, only warehouses whose
 *   WarehouseMaster.branch matches are offered — every branch-mandatory
 *   transaction form (Stock Receipt/Issue/Adjustment/Transfer, Purchase GRN,
 *   Delivery Challan, Opening Balance, ...) picks its warehouse this way now,
 *   so the branch on the header actually governs what can be picked rather
 *   than being a separate, unconnected field. `currentValue` still wins if it
 *   doesn't match the branch — an existing document's stored warehouse stays
 *   visible and selectable (see the currentValue note above) rather than
 *   disappearing the moment its branch stops matching.
 *
 *   The `branch` column was added to WarehouseMaster after the master was
 *   already being bulk-imported from Master Data.xlsx (see
 *   seed_warehouse_master.js, which never wrote it), so on data imported that
 *   way every warehouse can easily have a blank branch — nobody has gone
 *   through Warehouse Master assigning one to each row yet. Filtering
 *   strictly in that state leaves every branch-mandatory document's Warehouse
 *   dropdown with nothing to pick at all, on every single row, which reads as
 *   "warehouse isn't fetching" even though the master itself is populated
 *   fine. So the branch filter only actually applies once at least one
 *   warehouse has been assigned to at least one branch — i.e. once someone
 *   has actually started using it — otherwise every active warehouse is
 *   offered regardless of branch, which is exactly what an unset scoping rule
 *   should mean.
 */
export function useWarehouseOptions({
  currentValue = null, allLabel = null, includeInactive = false, branch = null,
} = {}) {
  const { data: warehouses, isLoading } = warehouseMasterApi.useList();

  const options = useMemo(() => {
    const allowedForBranch = warehouseCodesForBranch(warehouses, branch);

    const rows = (warehouses || [])
      .filter((w) => includeInactive || w.status === 'Active')
      .filter((w) => allowedForBranch.has(w.whsCode))
      .slice()
      .sort((a, b) => String(a.whsCode || '').localeCompare(String(b.whsCode || ''), undefined, { numeric: true }));

    // code/name (alongside the existing label/value) are for WarehouseCodeSelect
    // — the item table's Code/Name dropdown — which needs the two apart to
    // render its two-column list and its name-below line; every existing
    // consumer keeps reading label/value exactly as before.
    const out = rows.map((w) => ({ label: warehouseLabel(w), value: w.whsCode, code: w.whsCode, name: w.whsName || '' }));

    // Accept either a single code or an array of them (one per line on a
    // multi-line document) — see the doc comment above.
    const currentList = Array.isArray(currentValue) ? currentValue : [currentValue];
    const seen = new Set(out.map((o) => o.value));
    currentList
      .map((v) => (v == null ? '' : String(v)))
      .forEach((current) => {
        if (current === '' || seen.has(current)) return;
        seen.add(current);
        // Sorted in rather than appended, so an inactive-but-still-valid
        // warehouse sits where it belongs; a genuinely unknown legacy value is
        // labelled so nobody mistakes it for a live warehouse.
        const known = (warehouses || []).find((w) => w.whsCode === current);
        out.unshift({
          label: known ? warehouseLabel(known) : `${current} (not in Warehouse Master)`,
          value: current,
          code: current,
          name: known ? (known.whsName || '') : 'Not in Warehouse Master',
        });
      });

    if (allLabel) out.unshift({ label: allLabel, value: '', code: '', name: '' });
    return out;
  }, [warehouses, JSON.stringify(currentValue), allLabel, includeInactive, branch]);

  return { options, isLoading, warehouses: warehouses || [] };
}

/**
 * Turns a stored warehouse value into something readable for a table cell or a
 * printed document.
 *
 * Falls back to the raw value rather than to a dash: a legacy 'Main Warehouse'
 * is still the truth about where that stock went, and blanking it in a list
 * would make posted documents look as though they had no warehouse at all.
 */
export function useWarehouseLabeller() {
  const { data: warehouses } = warehouseMasterApi.useList();
  return useMemo(() => {
    const byCode = new Map((warehouses || []).map((w) => [w.whsCode, w]));
    return (value) => {
      if (value == null || value === '') return '';
      const found = byCode.get(value);
      return found ? warehouseLabel(found) : String(value);
    };
  }, [warehouses]);
}
