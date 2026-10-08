import { useMemo, useRef } from 'react';

/**
 * Click-and-drag panning for a scrollable element (e.g. a TableContainer).
 * Grab anywhere on the element -- including on top of an input, select, or
 * button -- and drag to scroll both vertically and horizontally, the same
 * way trackpad/scrollbar dragging would. A real click (press and release
 * with no meaningful movement) still reaches whatever's underneath
 * completely normally, so editing a cell or clicking a row action isn't
 * affected.
 *
 * Usage: const scrollRef = useDragScroll(); <TableContainer ref={scrollRef} sx={{ overflow: 'auto', maxHeight: 560, cursor: 'grab' }}>
 *
 * What this returns is a *callback ref*, not a plain useRef object, and that
 * distinction is the whole reason the feature works on the item-details
 * tables. Those tables live inside `{view === 'form' ? <form/> : <list/>}`,
 * so on first render the element doesn't exist yet. The previous version
 * attached its listeners from a `useEffect(..., [])`, which ran once at mount,
 * found `ref.current === null`, bailed out -- and never ran again when the
 * form (and the table with it) mounted later. The listeners were never
 * attached at all, on any of those pages. A callback ref is invoked by React
 * every time the underlying node changes (mount, unmount, and the
 * mobile/desktop swap between the card list and the table), so the listeners
 * follow the element instead of a one-shot snapshot of it.
 */
// A real click always has a little mouse jitter between mousedown and
// mouseup. Without a deadzone, that jitter was being read as "the user is
// panning" and immediately nudging scrollLeft/scrollTop — which shifts the
// table under a still-descending pointer and makes the mouseup land on a
// different cell than the one the user was aiming at. Icon-sized targets
// (the row action buttons) took the brunt of it: aim at the button, get a
// tiny drag instead of a click. Holding off any scroll change until the
// pointer has moved past this deadzone keeps ordinary clicks click-shaped.
const DRAG_THRESHOLD_PX = 6;

// An item-details row is almost entirely FormTextField/FormSelect cells —
// real <input>/<select> elements covering nearly the full width of every
// column. Earlier versions of this hook refused to even start tracking a
// drag that began on one of these (to keep editing a cell unaffected), but
// since inputs are most of the row's surface, that meant most natural
// "press and drag" gestures were silently ignored from the first pixel —
// the feature only worked from the handful of plain-text cells (the row
// number, a computed Amount column) or the thin padding gaps between cells.
// Nothing was wrong with the panning math; there was almost nowhere left to
// grab it from.
const FORM_CONTROL = 'input, textarea, select, [contenteditable="true"]';

// Wires the pan listeners onto one element and returns the teardown for them.
// Kept outside the hook so the callback ref can attach/detach per node
// without rebuilding any React state.
function attachDragScroll(el) {
  let dragging = false;
  let hasMoved = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;
  let startTarget = null;

  const beginDrag = (x, y, target) => {
    dragging = true;
    hasMoved = false;
    startX = x;
    startY = y;
    startTarget = target;
    startScrollLeft = el.scrollLeft;
    startScrollTop = el.scrollTop;
  };
  const moveDrag = (x, y) => {
    const dx = x - startX;
    const dy = y - startY;
    // Stay a no-op inside the deadzone — this is the click-preserving part.
    // Tracking starts on every mousedown now (even one over an input), so
    // this deadzone is the *only* thing distinguishing "the user clicked
    // into a field" from "the user is panning" — below it, nothing about
    // the field is touched; the instant it's crossed, this is committed to
    // being a drag.
    if (!hasMoved) {
      if (Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) return;
      hasMoved = true;
      el.style.cursor = 'grabbing';
      el.style.userSelect = 'none';
      // The drag started on a form control (or inside one, e.g. selecting
      // its text) — now that it's confirmed to be a pan and not a click,
      // hand focus back so the field isn't left mid-edit with a blinking
      // caret while the table scrolls underneath it, and drop any text
      // selection the browser may have started in the process.
      const formControl = startTarget && startTarget.closest && startTarget.closest(FORM_CONTROL);
      if (formControl) formControl.blur?.();
      window.getSelection?.()?.removeAllRanges?.();
    }
    // Applied from the original start point (not incrementally), so the
    // jump from "ignored" to "panning" the instant we cross the threshold
    // is seamless rather than skipping the first few pixels of motion.
    el.scrollLeft = startScrollLeft - dx;
    el.scrollTop = startScrollTop - dy;
  };

  const onMouseDown = (e) => {
    if (e.button !== 0) return; // left button only
    // No preventDefault here — the gesture isn't known to be a drag yet.
    // Suppressing the browser's default now would also suppress the
    // click/focus a plain press-and-release is supposed to produce.
    beginDrag(e.pageX, e.pageY, e.target);
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    // Only once committed to a drag (past the deadzone) do we take over
    // the browser default — that's what stops a drag that runs across
    // plain cell text from also dragging out a native text selection.
    if (hasMoved) e.preventDefault();
    moveDrag(e.pageX, e.pageY);
  };
  const stopDragging = () => {
    dragging = false;
    hasMoved = false;
    startTarget = null;
    el.style.cursor = 'grab';
    el.style.removeProperty('user-select');
  };

  // Touch: pan the table with one finger the same way, so horizontally
  // overflowing tables are reachable on tablets.
  const onTouchStart = (e) => {
    if (e.touches.length !== 1) return;
    beginDrag(e.touches[0].pageX, e.touches[0].pageY, e.target);
  };
  const onTouchMove = (e) => {
    if (!dragging || e.touches.length !== 1) return;
    moveDrag(e.touches[0].pageX, e.touches[0].pageY);
  };

  el.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', stopDragging);
  el.addEventListener('touchstart', onTouchStart, { passive: true });
  el.addEventListener('touchmove', onTouchMove, { passive: true });
  el.addEventListener('touchend', stopDragging);
  el.addEventListener('touchcancel', stopDragging);

  return () => {
    el.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', stopDragging);
    el.removeEventListener('touchstart', onTouchStart);
    el.removeEventListener('touchmove', onTouchMove);
    el.removeEventListener('touchend', stopDragging);
    el.removeEventListener('touchcancel', stopDragging);
  };
}

export default function useDragScroll() {
  const nodeRef = useRef(null);
  const detachRef = useRef(null);

  // Stable identity across renders — a new function each render would make
  // React detach and re-attach on every single render.
  return useMemo(() => {
    const setNode = (node) => {
      // React calls a callback ref with null before handing over a new node
      // (and on unmount), so this covers both teardown paths.
      if (detachRef.current) {
        detachRef.current();
        detachRef.current = null;
      }
      nodeRef.current = node;
      if (node) detachRef.current = attachDragScroll(node);
    };
    // Some call sites may still want to read the element the normal way, so
    // keep a `.current` that behaves like a regular ref object would.
    Object.defineProperty(setNode, 'current', { get: () => nodeRef.current });
    return setNode;
  }, []);
}
