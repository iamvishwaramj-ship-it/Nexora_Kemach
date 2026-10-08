// Flattens a parent/child list into indented, depth-first order — the same
// shape the org's recursive AccountTree CTE produces (SortPath order, each
// child immediately under its parent), but computed client-side since the
// API returns a flat list.
//
// Returns a NEW array of { ...row, depth } — depth 0 for a root row, +1 per
// level under its parent. Rows whose parentField points at an id not present
// in `rows` (e.g. deleted, or filtered out by a search/status filter) are
// treated as roots rather than silently dropped, so nothing disappears from
// the list.
export function buildTreeRows(rows, { idField = 'id', parentField = 'parentId' } = {}) {
  const byParent = new Map();
  const idSet = new Set(rows.map((r) => r[idField]));

  rows.forEach((row) => {
    const parentId = row[parentField];
    const key = parentId != null && idSet.has(parentId) ? parentId : null;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(row);
  });

  const out = [];
  // Defensive against a malformed/cyclic parent chain (shouldn't happen given
  // the FK, but a broken chain must not hang the UI in an infinite loop).
  const visiting = new Set();

  function walk(parentKey, depth) {
    const children = byParent.get(parentKey) || [];
    children.forEach((row) => {
      const id = row[idField];
      if (visiting.has(id)) return;
      visiting.add(id);
      out.push({ ...row, depth });
      walk(id, depth + 1);
      visiting.delete(id);
    });
  }

  walk(null, 0);
  return out;
}

// Adds the information a list needs to draw connector lines — the elbows and
// the vertical trunks running down between them, as a file explorer does.
//
// Indentation alone shows depth but not structure: you can see that a row is
// two levels in, but not which branch it belongs to once its parent has
// scrolled out of view. The lines carry that.
//
// Works on any already-flattened depth-first list (the output of
// buildTreeRows, or one assembled by hand from several subtrees), so it
// doesn't care how the nesting was produced. Returns a NEW array of
// { ...row, isLastChild, ancestorLines }:
//
//   isLastChild    no further sibling below it, so its elbow is the closing
//                  one and its trunk stops there instead of carrying on down.
//   ancestorLines  one boolean per rail LEFT OF the row's own elbow — length
//                  depth-1, not depth. A row at depth d draws d rails, and the
//                  last of them is its own elbow up to its parent; only the
//                  d-1 rails before that belong to ancestors. So
//                  ancestorLines[k] describes the ancestor at depth k+1, not
//                  depth k. Indexing them from 0 instead is the natural
//                  mistake here and draws a phantom trunk down the left of
//                  every subtree whose root has a later sibling.
//
// Computed in a single backward pass. Walking from the bottom is what makes
// "is there a later sibling" answerable at all — forwards, you'd have to look
// ahead an unbounded distance at every row.
export function attachTreeGuides(rows) {
  // nextAt[d] — having already scanned everything below this row, is there a
  // row at depth d that is still a sibling (no shallower row in between)?
  const nextAt = [];
  const out = new Array(rows.length);

  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const depth = rows[i].depth || 0;

    // Anything deeper belongs to a subtree this row closes off, so it can no
    // longer be a sibling of anything above.
    for (let k = depth + 1; k < nextAt.length; k += 1) nextAt[k] = false;

    // Rail k sits under the ancestor at depth k+1 — see the note above.
    const ancestorLines = [];
    for (let k = 1; k < depth; k += 1) ancestorLines.push(Boolean(nextAt[k]));

    out[i] = { ...rows[i], isLastChild: !nextAt[depth], ancestorLines };

    // Read first, mark second — that ordering is what stops a row counting
    // itself as its own following sibling.
    nextAt[depth] = true;
  }

  return out;
}
