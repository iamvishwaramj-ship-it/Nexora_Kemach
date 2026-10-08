import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { branchApi } from '../features/resources';
import { selectCurrentUser } from '../store/authSlice';
import { isAdmin } from './permissions';

// Branch dropdown options for the User Management > Branch Access tab (and
// anywhere else a "which branch" FormSelect is needed) — cloned from
// useWarehouseOptions.js's own pattern.
//
// --- What gets STORED ------------------------------------------------------
// The branch's numeric id, stringified. Branch.branchName is not unique in
// the schema the way a code column is, and BranchAccessTable's own rows are
// keyed by id (UserBranch.branchId is a real FK, unlike the "store the name
// as a plain string" convention most other branch-scoped columns in this app
// use — see Branch — WarehouseMaster.branch and friends). Stringified because
// the shared requiredString() validator (lib/validation/common.js) expects a
// string value, and FormSelect's option `value` is what lands in the form
// field as-is.
export function branchLabel(b) {
  return String(b?.branchName ?? '').trim();
}

// Shared by both hooks below: the set of branch names (lower-cased) the
// signed-in user may act on, or null when nothing should be filtered out
// (admin, or the caller opted out via restrictToUserBranches: false).
function useGrantedBranchNames(restrictToUserBranches) {
  const currentUser = useSelector(selectCurrentUser);
  return useMemo(() => {
    if (!restrictToUserBranches || isAdmin(currentUser)) return null;
    return new Set((currentUser?.branches || []).map((b) => String(b).trim().toLowerCase()));
  }, [restrictToUserBranches, currentUser]);
}

/**
 * Branch options for a FormSelect.
 *
 * @param {object}  opts
 * @param {string}  opts.currentValue  the branch id already stored on the row
 *   being edited, so a branch that's been deactivated (or renamed away from
 *   what a stale value pointed at) still shows up as a selectable option
 *   instead of rendering the box blank — same reasoning as
 *   useWarehouseOptions' own currentValue.
 * @param {boolean} opts.includeInactive  inactive branches are hidden by
 *   default; an existing row's branch is kept regardless via currentValue.
 * @param {boolean} opts.restrictToUserBranches  when true (the default),
 *   a non-admin only sees the branches granted on their own account (Branch
 *   tab of User Management — req.user.branches, same list the backend's own
 *   branchScope.js filters record lists by), so a document's Branch field
 *   can't be set to somewhere the signed-in user has no access to. Admins
 *   are never restricted, matching the backend's own "admin bypasses branch
 *   scope" rule. Pass false for the one place that must show every company
 *   branch regardless of who's signed in: BranchAccessTable itself, where an
 *   admin is choosing which branches to GRANT someone else — restricting
 *   that list to the admin's own branches would make it impossible to grant
 *   a branch the admin doesn't personally hold.
 */
export function useBranchOptions({ currentValue = null, includeInactive = false, restrictToUserBranches = true } = {}) {
  const { data: branches, isLoading } = branchApi.useList();
  const grantedNames = useGrantedBranchNames(restrictToUserBranches);

  const options = useMemo(() => {
    const rows = (branches || [])
      .filter((b) => includeInactive || b.status === 'Active')
      .filter((b) => !grantedNames || grantedNames.has(branchLabel(b).toLowerCase()))
      .slice()
      .sort((a, b) => branchLabel(a).localeCompare(branchLabel(b), undefined, { numeric: true }));

    const out = rows.map((b) => ({ label: branchLabel(b), value: String(b.id) }));

    const current = currentValue == null ? '' : String(currentValue);
    if (current !== '' && !out.some((o) => o.value === current)) {
      const known = (branches || []).find((b) => String(b.id) === current);
      out.unshift({
        label: known ? branchLabel(known) : `${current} (not in Branch Master)`,
        value: current,
      });
    }

    return out;
  }, [branches, currentValue, includeInactive, grantedNames]);

  return { options, isLoading, branches: branches || [] };
}

/**
 * Branch options keyed by NAME instead of id — what every Sales/Purchase/
 * Inventory/Banking document's own "Branch" FormSelect actually needs, since
 * those tables all store the branch's name as a plain string (the cross-
 * master-by-name convention noted on branchLabel above), not the id
 * useBranchOptions returns. Was previously hand-rolled per page as
 * `(branches || []).map((b) => ({ label: b.branchName, value: b.branchName }))`
 * straight off branchApi.useList() — which is how a non-admin ended up able
 * to pick (and see data scoped to) a branch they were never granted; every
 * one of those call sites now goes through here instead.
 *
 * Same restrictToUserBranches / currentValue behaviour as useBranchOptions:
 * a non-admin only sees their own granted branches, and an existing
 * document's already-saved branch name is always kept selectable even if it
 * was later deactivated or the user's own grants changed.
 */
export function useBranchNameOptions({ currentValue = null, includeInactive = false, restrictToUserBranches = true } = {}) {
  const { data: branches, isLoading } = branchApi.useList();
  const grantedNames = useGrantedBranchNames(restrictToUserBranches);

  const options = useMemo(() => {
    const rows = (branches || [])
      .filter((b) => includeInactive || b.status === 'Active')
      .filter((b) => !grantedNames || grantedNames.has(branchLabel(b).toLowerCase()))
      .slice()
      .sort((a, b) => branchLabel(a).localeCompare(branchLabel(b), undefined, { numeric: true }));

    const out = rows.map((b) => ({ label: branchLabel(b), value: branchLabel(b) }));

    const current = currentValue ? String(currentValue).trim() : '';
    if (current !== '' && !out.some((o) => o.value === current)) {
      out.unshift({ label: current, value: current });
    }

    return out;
  }, [branches, currentValue, includeInactive, grantedNames]);

  return { options, isLoading, branches: branches || [] };
}
