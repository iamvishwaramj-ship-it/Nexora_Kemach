import { createSlice } from '@reduxjs/toolkit';

// Backs the "Copy To" feature — the reverse of the existing per-page "Copy
// From" dialogs. Copy From runs entirely inside one already-open form (pick
// a source document, populate the fields you're looking at); Copy To has to
// reach a DIFFERENT page/tab that may not even be mounted yet, so there is no
// prop or shared closure to hand the chosen source document through. This
// slice is that hand-off: the source page writes one pending intent here and
// navigates to the target tab; the target page's own effect (inside its
// AppForm render prop, right where its "apply<X>" copy-from function already
// lives) notices a pending intent addressed to it, runs that exact same
// apply function against the intent's `sourceDoc`, and clears the intent.
//
// Deliberately NOT persisted to localStorage (unlike tabsSlice) — a pending
// copy is a one-shot, same-session action; there's no sense in it surviving
// a reload and firing again later against a page that reopens for an
// unrelated reason.
const copyIntentSlice = createSlice({
  name: 'copyIntent',
  initialState: { pending: null },
  reducers: {
    // payload: { targetKey, sourceType, sourceLabel, sourceDoc }
    //   targetKey   — the target page's own document-type key (e.g.
    //                 'purchaseOrder'), matched by that page's consume effect.
    //   sourceType  — which source document this came from (e.g.
    //                 'purchaseQuotation') — lets a target with more than one
    //                 possible source (Purchase Invoice: PO/GRN/Return/
    //                 Quotation) pick the right apply<X> function.
    //   sourceLabel — human label for toasts/undo messaging (e.g. "Purchase
    //                 Quotation PQ-0001").
    //   sourceDoc   — the full source document record, exactly the shape a
    //                 Copy From dialog's onChoose already hands to that
    //                 page's apply function.
    setCopyIntent(state, action) {
      state.pending = { ...action.payload, ts: Date.now() };
    },
    clearCopyIntent(state) {
      state.pending = null;
    },
  },
});

export const { setCopyIntent, clearCopyIntent } = copyIntentSlice.actions;
export default copyIntentSlice.reducer;
