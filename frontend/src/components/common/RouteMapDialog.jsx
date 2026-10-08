import React, { useState, useRef } from 'react';
import {
  Dialog, DialogContent, DialogActions, Box, Typography, Stack, Alert, Chip,
  IconButton, Button, Card, CardContent, Grow, LinearProgress, Tooltip, alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import SwapHorizRoundedIcon from '@mui/icons-material/SwapHorizRounded';
import SwapVertRoundedIcon from '@mui/icons-material/SwapVertRounded';
import { useGetRouteMapQuery } from '../../features/resources';
import RouteMapDocumentPreview from './RouteMapDocumentPreview';

// Route Map — the animated flow diagram of the whole document chain one
// purchase or sales document belongs to.
//
// Opened from the Actions column of every Purchase and Sales list page, and
// shows the same chain whichever document it was opened from: the map is a
// property of the chain, not of the row that launched it.
//
// --- Styling and motion ----------------------------------------------------
// Colours are theme tokens throughout — `theme.custom.gradient` is the same
// primary->accent sweep the sidebar's active item and every contained Button
// already use — so the diagram follows whichever colour scheme the user picked
// and reads correctly in dark mode.
//
// The motion is not decoration for its own sake: each animation encodes
// something about the chain.
//
//   * cards reveal left to right, so the eye reads the flow in document order;
//   * a connector only animates when the flow actually continued through it,
//     so where the chain stopped is visible before a single label is read;
//   * reached stages carry the gradient and a soft glow ring, unreached ones
//     are dashed and still.
//
// Every animation is disabled under `prefers-reduced-motion`, and the layout
// is identical with motion off — nothing here is load-bearing for meaning that
// is not also carried by colour, border style and the "Not raised" label.

const REVEAL_STEP_MS = 90;

/** Turn animations off for users who have asked the OS for less motion. */
const reduceMotion = {
  '@media (prefers-reduced-motion: reduce)': {
    animation: 'none !important',
    transition: 'none !important',
    '&::before, &::after': { animation: 'none !important' },
  },
};

/** Status chip colours, matching the mapping the list pages already use. */
const STATUS_COLORS = {
  Draft: 'default',
  Open: 'info',
  Sent: 'info',
  Pending: 'warning',
  Confirmed: 'success',
  Accepted: 'success',
  Received: 'success',
  'Partially Received': 'info',
  'Partially Delivered': 'warning',
  'Partially Invoiced': 'warning',
  Dispatched: 'info',
  Delivered: 'success',
  Shipped: 'info',
  Closed: 'success',
  Posted: 'success',
  Paid: 'success',
  Overdue: 'error',
  Rejected: 'error',
  Expired: 'error',
  Cancelled: 'error',
};

const themeGradient = (t) => t.custom?.gradient
  || `linear-gradient(135deg, ${t.palette.primary.main} 0%, ${t.palette.secondary.main} 100%)`;

/**
 * The moving dashed rail, along whichever axis is asked for.
 *
 * Shared by the connectors between stages and by the arms of a branch, so a
 * fork out of one document animates in exactly the same language as the
 * straight run between two — they are the same flow, drawn at a corner.
 *
 * `reverse` runs the dashes the other way along the same axis. A fork spreads
 * OUTWARD from wherever the parent's connector lands, so the arms on the near
 * side of that point travel back towards the start while the far ones travel
 * on — all of them moving away from the junction, which is the direction the
 * documents were actually created in.
 */
const flowingRail = (axis, reverse = false) => (axis === 'x'
  ? {
    backgroundImage: (t) => `repeating-linear-gradient(90deg, ${t.palette.primary.main} 0 9px, transparent 9px 18px)`,
    backgroundSize: '18px 100%',
    animation: `${reverse ? 'rmFlowXBack' : 'rmFlowX'} 700ms linear infinite`,
    '@keyframes rmFlowX': { to: { backgroundPositionX: '18px' } },
    '@keyframes rmFlowXBack': { to: { backgroundPositionX: '-18px' } },
    ...reduceMotion,
  }
  : {
    backgroundImage: (t) => `repeating-linear-gradient(180deg, ${t.palette.primary.main} 0 9px, transparent 9px 18px)`,
    backgroundSize: '100% 18px',
    animation: `${reverse ? 'rmFlowYBack' : 'rmFlowY'} 700ms linear infinite`,
    '@keyframes rmFlowY': { to: { backgroundPositionY: '18px' } },
    '@keyframes rmFlowYBack': { to: { backgroundPositionY: '-18px' } },
    ...reduceMotion,
  });

/**
 * A solid arrowhead pointing `down` or `right`.
 *
 * The colour is set after the border shorthands on purpose: `border-top: 9px
 * solid` with no colour in it resets that edge to `currentColor`, so a colour
 * declared earlier would be silently overwritten.
 */
const arrowHead = (dir) => (dir === 'down'
  ? {
    borderLeft: '5px solid transparent',
    borderRight: '5px solid transparent',
    borderTop: '9px solid',
    borderTopColor: 'primary.main',
  }
  : {
    borderTop: '5px solid transparent',
    borderBottom: '5px solid transparent',
    borderLeft: '9px solid',
    borderLeftColor: 'primary.main',
  });

/** dd MMM yyyy — the format the rest of the app prints dates in. */
function formatDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Totals are shown as entered, not padded to two places.
 *
 * The diagram's job is letting someone match figures across documents at a
 * glance; rendering the same stored number differently here than on the list
 * page it came from would defeat that.
 */
function formatTotal(value) {
  if (value == null) return null;
  const n = Number(value);
  if (Number.isNaN(n)) return null;
  return n.toLocaleString('en-IN');
}

/**
 * A labelled line inside a card body.
 *
 * Never wraps: a document number broken across two lines is hard to read back
 * and makes one card taller than its neighbours for no reason. The card sizes
 * itself to the longest line instead — see DocCard's width rules.
 */
function Line({ label, value }) {
  return (
    <Typography variant="body2" sx={{ lineHeight: 1.75, whiteSpace: 'nowrap' }}>
      <Box component="span" sx={{ color: 'text.secondary' }}>{label} : </Box>
      <Box component="span" sx={{ fontWeight: 600 }}>{value}</Box>
    </Typography>
  );
}

/**
 * One document card.
 *
 * A stage nothing has reached yet is still drawn, just dashed, muted and
 * marked "Not raised" — showing the shape of the flow and where it stopped is
 * more use than dropping the stage and implying the chain simply ends there.
 */
function DocCard({ node, index = 0, onOpen }) {
  const date = formatDate(node.docDate);
  const total = formatTotal(node.docTotal);
  const empty = !node.docNo;

  return (
    <Card
      variant="outlined"
      onDoubleClick={empty ? undefined : () => onOpen?.(node)}
      sx={{
        position: 'relative',
        // A real card is opened by double-clicking it — signal that the way
        // any other clickable surface in the app does, rather than leaving
        // the cursor as plain text and the affordance undiscoverable.
        cursor: empty ? 'default' : 'pointer',
        minWidth: 218,
        // No maximum: the body lines do not wrap, so a card has to be allowed
        // to be as wide as its longest one. Capping the width here is what
        // pushed a long document number onto a second line.
        width: 'fit-content',
        flex: '0 0 auto',
        // Column flex so the body can grow and centre "Not raised" instead of
        // leaving it stranded at the top of a card stretched to match its
        // taller neighbours.
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        borderStyle: empty ? 'dashed' : 'solid',
        borderColor: empty ? 'divider' : (t) => alpha(t.palette.primary.main, 0.45),
        bgcolor: 'background.paper',
        // Reached cards sit on a soft coloured glow; unreached ones stay flat,
        // so the depth in the row tracks how far the chain actually got.
        boxShadow: empty ? 'none' : (t) => `0 6px 22px ${alpha(t.palette.primary.main, 0.18)}`,
        opacity: 0,
        animation: 'rmCardIn 520ms cubic-bezier(.21,1.02,.35,1) forwards',
        animationDelay: `${index * REVEAL_STEP_MS}ms`,
        transition: 'transform 220ms ease, box-shadow 220ms ease',
        '&:hover': {
          transform: empty ? 'none' : 'translateY(-4px)',
          boxShadow: empty ? 'none' : (t) => `0 14px 34px ${alpha(t.palette.primary.main, 0.32)}`,
        },
        '@keyframes rmCardIn': {
          from: { opacity: 0, transform: 'translateY(16px) scale(0.96)' },
          to: { opacity: 1, transform: 'translateY(0) scale(1)' },
        },
        ...reduceMotion,
        '@media (prefers-reduced-motion: reduce)': {
          ...reduceMotion['@media (prefers-reduced-motion: reduce)'],
          opacity: 1,
        },
      }}
    >
      {/* Header. Reached stages take the theme gradient with a slow sheen
          sweeping across it; unreached stages take a flat neutral. */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          px: 1.5,
          py: 0.9,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.75,
          backgroundImage: empty ? 'none' : themeGradient,
          bgcolor: empty ? 'action.disabledBackground' : undefined,
          color: empty ? 'text.secondary' : 'primary.contrastText',
          borderBottom: '1px solid',
          borderColor: 'divider',
          '&::after': empty ? undefined : {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.38) 50%, transparent 65%)',
            transform: 'translateX(-120%)',
            animation: 'rmSheen 4.5s ease-in-out infinite',
            animationDelay: `${600 + index * REVEAL_STEP_MS}ms`,
          },
          '@keyframes rmSheen': {
            '0%': { transform: 'translateX(-120%)' },
            '55%, 100%': { transform: 'translateX(120%)' },
          },
          ...reduceMotion,
        }}
      >
        {empty
          ? <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 15, opacity: 0.7 }} />
          : <CheckCircleRoundedIcon sx={{ fontSize: 15 }} />}
        <Typography variant="subtitle2" fontWeight={700} noWrap>{node.stage}</Typography>
      </Box>

      <CardContent
        sx={{
          px: 1.5,
          py: 1.25,
          flex: 1,
          '&:last-child': { pb: 1.25 },
          // Centre the placeholder in the space the card was stretched to
          // fill; a real card's lines still start at the top as normal.
          ...(empty ? { display: 'flex', alignItems: 'center', justifyContent: 'center' } : null),
        }}
      >
        {empty ? (
          <Typography variant="body2" color="text.secondary" fontStyle="italic">
            Not raised
          </Typography>
        ) : (
          <>
            <Line label="Doc No" value={node.docNo} />
            {date && <Line label="Doc Date" value={date} />}
            {total != null && <Line label="Doc Total" value={total} />}
            {node.status && (
              <Chip
                size="small"
                variant="outlined"
                label={node.status}
                color={STATUS_COLORS[node.status] || 'default'}
                sx={{ mt: 0.9, fontWeight: 600 }}
              />
            )}
            {node.moreCount > 0 && (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                +{node.moreCount} more at this stage
              </Typography>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The connector between two cards.
 *
 * `active` means the flow actually continued through here — both the stage
 * before and the stage after exist. Only an active connector animates, so a
 * glance along the row shows where the chain stopped without reading a word.
 */
function Connector({ active = false, back = false, index = 0, vertical = false }) {
  // The whole connector is one shape rotated: laid out horizontally, then
  // turned a quarter turn for the vertical flow. Rotating rather than
  // maintaining two sets of geometry keeps the rail, the travelling pulse and
  // the arrowhead guaranteed to stay aligned with each other in both
  // orientations.
  const rotation = [back ? 180 : 0, vertical ? 90 : 0].reduce((a, b) => a + b, 0);

  return (
    <Box
      aria-hidden
      sx={{
        flex: '0 0 auto',
        alignSelf: 'center',
        position: 'relative',
        // A rotated box still occupies its unrotated footprint, so the
        // vertical form is given a square box the rotated rail fits inside.
        width: vertical ? 34 : 62,
        height: vertical ? 62 : 22,
        display: 'flex',
        alignItems: 'center',
        opacity: 0,
        animation: 'rmConnIn 400ms ease forwards',
        animationDelay: `${index * REVEAL_STEP_MS + 40}ms`,
        '@keyframes rmConnIn': { to: { opacity: 1 } },
        ...reduceMotion,
        '@media (prefers-reduced-motion: reduce)': {
          ...reduceMotion['@media (prefers-reduced-motion: reduce)'],
          opacity: 1,
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          // Centre a 62x22 rail inside whatever box the orientation asked
          // for, then rotate it about that centre.
          top: '50%',
          left: '50%',
          width: 62,
          height: 22,
          transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        }}
      >
        {/* The rail: flowing dashes when active, a flat line when not. */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            mt: active ? '-1.5px' : '-1px',
            left: 0,
            right: 10,
            height: active ? 3 : 2,
            borderRadius: 2,
            ...(active ? flowingRail('x') : { bgcolor: 'divider' }),
            ...reduceMotion,
          }}
        />

        {/* A pulse travelling the length of the rail — the sense of movement
            through the chain, rather than just a line joining two boxes. */}
        {active && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              mt: '-3.5px',
              left: 0,
              width: 7,
              height: 7,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              boxShadow: (t) => `0 0 10px 2px ${alpha(t.palette.primary.main, 0.75)}`,
              // transform, not `left` — a transform animates on the compositor,
              // so several of these running at once cost no layout work. The
              // 48px is the rail's 62px width less the arrowhead and the dot.
              willChange: 'transform',
              animation: 'rmTravel 1.9s cubic-bezier(.5,0,.5,1) infinite',
              animationDelay: `${index * 160}ms`,
              '@keyframes rmTravel': {
                '0%': { transform: 'translateX(0)', opacity: 0 },
                '12%': { opacity: 1 },
                '82%': { opacity: 1 },
                '100%': { transform: 'translateX(48px)', opacity: 0 },
              },
              ...reduceMotion,
              '@media (prefers-reduced-motion: reduce)': { display: 'none' },
            }}
          />
        )}

        {/* Arrowhead */}
        <Box
          sx={{
            position: 'absolute',
            top: '50%',
            mt: '-5px',
            right: 0,
            width: 0,
            height: 0,
            ...arrowHead('right'),
            ...(active ? null : { borderLeftColor: 'divider' }),
          }}
        />
      </Box>
    </Box>
  );
}

/** How far the fork's arms reach before they meet their card. */
const ARM = 26;

/**
 * A split in the flow: one incoming connector, several outgoing lanes.
 *
 * Drawn the way a wiring diagram draws one — the connector from the parent
 * arrives at a spanning rail, and a separate arm leaves that rail into each
 * lane, each ending in its own arrowhead. Every part carries the same moving
 * dashes as the connectors between stages, so a split reads as the flow
 * dividing rather than as a bracket someone drew around some cards.
 *
 * The rail is built from a half-segment on each side of every lane rather
 * than as one bar across the whole group. That way it always begins and ends
 * exactly over the outermost lanes and passes exactly over the inner ones,
 * whatever width each happens to be — a single spanning bar would have to
 * assume every lane was the same size, which is not true once cards size to
 * their own content.
 *
 * Used for both kinds of split the map has: a stage that fanned out into
 * several documents of the SAME type (two GRNs off one PO), and the point
 * where the chain divides into different types (a GRN going on to either an
 * invoice or a return). They are the same shape, so they share the drawing.
 */
function Fork({ lanes, vertical }) {
  const last = lanes.length - 1;
  // Where the parent's connector lands: the middle of the group. Flow leaves
  // that junction outwards in both directions, so a segment before it runs
  // backwards along the axis and one after it runs forwards.
  const junction = last / 2;
  const railHalf = (n, side) => {
    // Roughly where this half-segment sits, in branch units.
    const at = side === 'before' ? n - 0.25 : n + 0.25;
    return {
      position: 'absolute',
      borderRadius: 2,
      ...(vertical
        ? { top: 0, height: 3, ...(side === 'before' ? { left: 0, right: '50%' } : { left: '50%', right: 0 }) }
        : { left: 0, width: 3, ...(side === 'before' ? { top: 0, bottom: '50%' } : { top: '50%', bottom: 0 }) }),
      ...flowingRail(vertical ? 'x' : 'y', at < junction),
    };
  };

  return (
    <Stack
      direction={vertical ? 'row' : 'column'}
      // Branches sit further apart than cards elsewhere in the map: they are
      // parallel paths, and crowding them reads as one block of cards rather
      // than as a split. The rail between them widens with the gap, which is
      // what makes the fork legible.
      spacing={4}
      alignItems="stretch"
    >
      {lanes.map((lane, n) => (
        <Box
          key={lane.key ?? n}
          sx={{
            display: 'flex',
            flexDirection: vertical ? 'column' : 'row',
            alignItems: 'center',
            flex: '0 0 auto',
          }}
        >
          {/* This branch's share of the rail: half a column towards each
              neighbour, omitted at the ends so the rail stops over the
              outermost cards instead of running off into space. */}
          <Box
            aria-hidden
            sx={{
              position: 'relative',
              flex: '0 0 auto',
              // alignSelf stretch, not a percentage: the parent centres its
              // children, so a percentage cross-axis size has nothing
              // definite to resolve against and would collapse.
              alignSelf: 'stretch',
              ...(vertical ? { height: 3 } : { width: 3 }),
            }}
          >
            {n > 0 && <Box sx={railHalf(n, 'before')} />}
            {n < last && <Box sx={railHalf(n, 'after')} />}
          </Box>

          {/* The arm from the rail into this card. */}
          <Box
            aria-hidden
            sx={{
              position: 'relative',
              flex: '0 0 auto',
              ...(vertical ? { width: 3, height: ARM } : { height: 3, width: ARM }),
            }}
          >
            <Box sx={{ position: 'absolute', inset: 0, borderRadius: 2, ...flowingRail(vertical ? 'y' : 'x') }} />
            <Box
              sx={{
                position: 'absolute',
                width: 0,
                height: 0,
                ...(vertical
                  ? { bottom: -1, left: '50%', ml: '-5px' }
                  : { right: -1, top: '50%', mt: '-5px' }),
                ...arrowHead(vertical ? 'down' : 'right'),
              }}
            />
          </Box>
          {lane.content}
        </Box>
      ))}
    </Stack>
  );
}

/**
 * One stage's worth of cards: a single card, or a Fork when the stage holds
 * several documents of the same type (a PO received on two GRNs).
 */
function StageGroup({ stage, index, vertical, onOpen }) {
  const docs = stage.docs && stage.docs.length ? stage.docs : [stage];

  if (docs.length === 1) {
    return <DocCard node={docs[0]} index={index} onOpen={onOpen} />;
  }

  return (
    <Fork
      vertical={vertical}
      lanes={docs.map((doc, n) => ({
        key: doc.docNo || n,
        content: <DocCard node={doc} index={index + n} onOpen={onOpen} />,
      }))}
    />
  );
}

/**
 * A run of document groups along the flow, joined by connectors — the same
 * grammar as the spine, used inside a lane of a fork.
 *
 * `groups` is a list of node arrays: one array per step, holding every
 * document at that step. An empty step is drawn as a single "Not raised"
 * placeholder so a lane still shows the shape of where it would have gone.
 */
function DocRun({ groups, vertical, onOpen }) {
  return (
    <Stack
      direction={vertical ? 'column' : 'row'}
      alignItems="center"
      sx={{ flex: '0 0 auto' }}
    >
      {groups.map((group, i) => (
        <React.Fragment key={group.stage || i}>
          {i > 0 && (
            <Connector
              index={i}
              vertical={vertical}
              // Live only where the step before it actually produced something.
              active={Boolean(groups[i - 1].docs.length && group.docs.length)}
            />
          )}
          <StageGroup
            stage={{ stage: group.stage, docs: group.docs, present: group.docs.length > 0 }}
            index={i}
            vertical={vertical}
            onOpen={onOpen}
          />
        </React.Fragment>
      ))}
    </Stack>
  );
}

/**
 * Click-and-drag panning for the diagram.
 *
 * The diagram can overflow in two different places at once: the spine
 * scrolls horizontally within its own box (`overflowX: auto`), while the
 * dialog body itself is what scrolls vertically (a long vertical-mode chain
 * simply grows taller). One drag gesture, started anywhere in the dialog
 * body, drives both — whichever axis actually has something to scroll moves,
 * the other is a no-op clamp. That means the same drag works whichever way
 * the diagram is currently oriented, without the user having to find the
 * thin native scrollbar for each axis separately.
 *
 * A drag is only recognised past a small pixel threshold, so a plain click or
 * double-click on a card — which does not move the pointer — is completely
 * unaffected. Once a drag DID happen, the click that fires on release is
 * swallowed (via a capturing listener) so releasing the mouse over a card
 * cannot be mistaken for clicking it.
 */
function useDragPan(spineRef) {
  const bodyRef = useRef(null);
  const drag = useRef({ active: false, moved: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    const body = bodyRef.current;
    if (!body) return;
    drag.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      scrollLeft: spineRef.current ? spineRef.current.scrollLeft : 0,
      scrollTop: body.scrollTop,
    };
  };

  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const body = bodyRef.current;
    const dx = e.clientX - drag.current.startX;
    const dy = e.clientY - drag.current.startY;
    if (!drag.current.moved && Math.hypot(dx, dy) > 4) {
      drag.current.moved = true;
      window.getSelection()?.removeAllRanges();
      if (body) body.style.cursor = 'grabbing';
    }
    if (drag.current.moved) {
      if (spineRef.current) spineRef.current.scrollLeft = drag.current.scrollLeft - dx;
      if (body) body.scrollTop = drag.current.scrollTop - dy;
    }
  };

  const endDrag = () => {
    drag.current.active = false;
    if (bodyRef.current) bodyRef.current.style.cursor = '';
  };

  // Capturing so this runs before a card's own onClick/onDoubleClick — a
  // drag-release is not a click on whatever happened to be under the cursor.
  const onClickCapture = (e) => {
    if (drag.current.moved) {
      e.stopPropagation();
      drag.current.moved = false;
    }
  };

  return {
    bodyRef,
    handlers: {
      onMouseDown: onPointerDown,
      onMouseMove: onPointerMove,
      onMouseUp: endDrag,
      onMouseLeave: endDrag,
      onClickCapture,
    },
  };
}

/** Shimmering placeholders while the chain is being resolved. */
function LoadingSkeleton() {
  return (
    <Stack direction="row" alignItems="center" sx={{ py: 2 }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <React.Fragment key={i}>
          {i > 0 && <Box sx={{ width: 62, height: 2, bgcolor: 'divider', flex: '0 0 auto' }} />}
          <Box
            sx={{
              flex: '0 0 auto',
              width: 218,
              height: 148,
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              position: 'relative',
              overflow: 'hidden',
              bgcolor: 'action.hover',
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background: (t) => `linear-gradient(90deg, transparent, ${alpha(t.palette.text.primary, 0.07)}, transparent)`,
                transform: 'translateX(-100%)',
                animation: 'rmShimmer 1.3s ease-in-out infinite',
                animationDelay: `${i * 110}ms`,
              },
              '@keyframes rmShimmer': { to: { transform: 'translateX(100%)' } },
              ...reduceMotion,
            }}
          />
        </React.Fragment>
      ))}
    </Stack>
  );
}

export default function RouteMapDialog({ open, onClose, flow, type, docNo }) {
  // Which way the chain runs. Horizontal reads as a timeline and is the
  // default; vertical suits a long chain, or a stage that fanned out wide, on
  // a narrow screen. Deliberately not persisted — it is a per-look preference,
  // and a map that opened in an orientation the user set days ago on a
  // different document would be more surprising than helpful.
  const [vertical, setVertical] = useState(false);
  const spineScrollRef = useRef(null);
  const { bodyRef: dragBodyRef, handlers: dragHandlers } = useDragPan(spineScrollRef);

  // Double-clicking any real card opens that exact document's own full view
  // page, read-only, in a popup on top of the map — see
  // RouteMapDocumentPreview for how stage + docNo resolve to a page.
  const [preview, setPreview] = useState(null);
  const openPreview = (node) => {
    if (!node?.docNo) return;
    setPreview({ stage: node.stage, docNo: node.docNo });
  };
  const closePreview = () => setPreview(null);

  const { data, isFetching, error } = useGetRouteMapQuery(
    { flow, type, no: docNo },
    // Skip while closed so opening the dialog is what triggers the request,
    // and re-read on every open — see the note on routeMapApi in
    // features/resources.js for why this is not cache-tagged.
    { skip: !open || !docNo, refetchOnMountOrArgChange: true }
  );

  const stages = data?.stages || [];
  const branch = data?.branch;
  const partner = data?.partner;

  const reached = stages.filter((s) => s.present).length;
  const progress = stages.length ? (reached / stages.length) * 100 : 0;

  // The chain divides at the goods document — the GRN on purchase, the
  // Delivery Challan on sales. From there it either goes on to be billed
  // (Invoice, then a Credit Memo against it) or comes back (Return). Those
  // are genuinely alternative routes rather than later stages of one line,
  // so the diagram forks at that point instead of running the invoice along
  // the spine and listing the rest underneath.
  //
  // The invoice is always the last stage the backend returns, so the spine is
  // everything before it.
  const spine = stages.slice(0, -1);
  const invoiceStage = stages.length ? stages[stages.length - 1] : null;
  const goodsStage = spine.length ? spine[spine.length - 1] : null;
  // Only stages a document was actually raised against are drawn — an
  // unreached stage adds nothing once its neighbours already show where the
  // chain stopped, so it is dropped rather than shown dashed/"Not raised".
  const visibleSpine = spine.filter((s) => s.present);

  const docsOf = (stage) => (stage
    ? (stage.docs && stage.docs.length ? stage.docs : (stage.docNo ? [stage] : []))
    : []);
  const branchDocs = (list, single) => (list && list.length ? list : (single ? [single] : []));

  // Lane 1: billing. Lane 2: goods coming back.
  const invoiceDocs = docsOf(invoiceStage);
  const creditMemoDocs = branchDocs(branch?.creditMemoDocs, branch?.creditMemoDoc);
  const paymentDocs = branchDocs(branch?.paymentDocs, branch?.paymentDoc);
  const returnDocs = branchDocs(branch?.returnDocs, branch?.returnDoc);

  // Once billed, the invoice itself is a fork — money can come back to it in
  // two independent ways: a Credit Memo (value reversed against the invoice)
  // and a Payment (money collected/paid against it). Neither leads into the
  // other, so they are drawn as sibling branches off the invoice, matching
  // the SAP flow this map is based on, rather than as a chained sequence.
  const paymentStage = flow === 'purchase' ? 'Outgoing Payment' : 'Incoming Payment';
  // Only a route that actually has a document against it gets a lane — a
  // Payment or Credit Memo the flow merely allows but nobody has raised yet
  // is left off the diagram rather than drawn as an empty branch.
  const billingSubLanes = [
    paymentDocs.length > 0 && {
      key: 'payment',
      content: (
        <StageGroup
          stage={{ stage: paymentStage, docs: paymentDocs, present: true }}
          index={1}
          vertical={vertical}
          onOpen={openPreview}
        />
      ),
    },
    creditMemoDocs.length > 0 && {
      key: 'creditMemo',
      content: (
        <StageGroup
          stage={{ stage: 'Credit Memo', docs: creditMemoDocs, present: true }}
          index={1}
          vertical={vertical}
          onOpen={openPreview}
        />
      ),
    },
  ].filter(Boolean);
  const billingLaneContent = (
    <Stack direction={vertical ? 'column' : 'row'} alignItems="center" sx={{ flex: '0 0 auto' }}>
      <StageGroup
        stage={{ stage: invoiceStage?.stage || 'Invoice', docs: invoiceDocs, present: invoiceDocs.length > 0 }}
        index={0}
        vertical={vertical}
        onOpen={openPreview}
      />
      {billingSubLanes.length > 0 && (
        <>
          <Connector
            index={1}
            vertical={vertical}
            active={Boolean(paymentDocs.length || creditMemoDocs.length)}
          />
          <Fork vertical={vertical} lanes={billingSubLanes} />
        </>
      )}
    </Stack>
  );
  const returnLane = [{ stage: 'Return', docs: returnDocs }];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="xl"
      fullWidth
      scroll="paper"
      TransitionComponent={Grow}
      transitionDuration={{ enter: 320, exit: 180 }}
      PaperProps={{ sx: { overflow: 'hidden', borderRadius: 2 } }}
    >
      {/* Title bar — the theme gradient, with the same slow sheen the reached
          cards carry, so the header and the diagram read as one surface. */}
      <Box
        sx={{
          position: 'relative',
          overflow: 'hidden',
          px: 2.5,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          gap: 1.25,
          backgroundImage: themeGradient,
          color: 'primary.contrastText',
          '&::after': {
            content: '""',
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.22) 50%, transparent 60%)',
            transform: 'translateX(-120%)',
            animation: 'rmTitleSheen 6s ease-in-out infinite',
          },
          '@keyframes rmTitleSheen': {
            '0%': { transform: 'translateX(-120%)' },
            '45%, 100%': { transform: 'translateX(120%)' },
          },
          ...reduceMotion,
        }}
      >
        <AccountTreeOutlinedIcon />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>Relationship Map</Typography>
          {data && (
            <Typography variant="caption" sx={{ opacity: 0.85 }}>
              {reached} of {stages.length} stages complete
            </Typography>
          )}
        </Box>
        <Tooltip title={vertical ? 'Switch to horizontal flow' : 'Switch to vertical flow'}>
          <IconButton
            onClick={() => setVertical((v) => !v)}
            size="small"
            aria-label={vertical ? 'Switch to horizontal flow' : 'Switch to vertical flow'}
            aria-pressed={vertical}
            sx={{ color: 'inherit', '&:hover': { bgcolor: 'rgba(255,255,255,0.16)' } }}
          >
            {/* The icon shows what clicking will GIVE you, not the state you
                are in — the same grammar as every other toggle in the app. */}
            {vertical ? <SwapHorizRoundedIcon fontSize="small" /> : <SwapVertRoundedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <IconButton
          onClick={onClose}
          size="small"
          aria-label="close"
          sx={{ color: 'inherit', '&:hover': { bgcolor: 'rgba(255,255,255,0.16)' } }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* How far along the chain is, as a bar that fills on open.
          Coloured success/info rather than primary: it sits directly beneath
          the primary-gradient title bar, where a primary bar on a primary
          track disappears — and green-when-complete says something the bare
          length does not. */}
      <LinearProgress
        variant={isFetching ? 'indeterminate' : 'determinate'}
        value={progress}
        color={stages.length && reached === stages.length ? 'success' : 'info'}
        sx={{
          height: 5,
          bgcolor: (t) => alpha(t.palette.text.primary, 0.12),
          '& .MuiLinearProgress-bar': {
            transition: 'transform 900ms cubic-bezier(.4,0,.2,1)',
            ...reduceMotion['@media (prefers-reduced-motion: reduce)'],
          },
        }}
      />

      <DialogContent
        dividers
        ref={dragBodyRef}
        {...dragHandlers}
        sx={{
          bgcolor: 'background.default',
          cursor: 'grab',
          // Dragging to pan should not also paint a text selection across the
          // cards it passes over.
          userSelect: 'none',
        }}
      >
        {isFetching && <LoadingSkeleton />}

        {!isFetching && error && (
          <Alert severity="error">
            {error?.data?.message || 'Could not load the route map for this document.'}
          </Alert>
        )}

        {!isFetching && !error && data && (
          <>
            {/* Who the whole chain is with. Tinted rather than gradient-filled,
                so it reads as a header and not as another step in the flow. */}
            {partner && (
              <Grow in timeout={420}>
                <Card
                  variant="outlined"
                  sx={{
                    mb: 3,
                    width: 'fit-content',
                    minWidth: 310,
                    overflow: 'hidden',
                    borderColor: (t) => alpha(t.palette.primary.main, 0.35),
                  }}
                >
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.9,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 0.75,
                      bgcolor: (t) => alpha(t.palette.primary.main, 0.16),
                      // text.primary, not primary.main: on a dark surface a
                      // deep scheme colour like the default maroon is close to
                      // unreadable against its own 16% tint. The tint carries
                      // the brand; the text just has to be legible in both
                      // colour modes and under every scheme.
                      color: 'text.primary',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <PersonOutlineRoundedIcon sx={{ fontSize: 17 }} />
                    <Typography variant="subtitle2" fontWeight={700}>Business Partner</Typography>
                  </Box>
                  <CardContent sx={{ px: 1.5, py: 1.25, '&:last-child': { pb: 1.25 } }}>
                    <Line label={`${partner.kind} Code`} value={partner.code || '—'} />
                    <Line label={`${partner.kind} Name`} value={partner.name} />
                  </CardContent>
                </Card>
              </Grow>
            )}

            {/* The spine. Scrolls along the flow axis rather than wrapping:
                the chain reads as a sequence and wrapping it mid-flow breaks
                that. A stage that fanned out draws every document it holds
                (StageGroup), stacked across the flow. */}
            <Box ref={spineScrollRef} sx={{ overflowX: 'auto', overflowY: 'hidden', pb: 1.5, pt: 0.5 }}>
              <Stack
                direction={vertical ? 'column' : 'row'}
                // Centred in both orientations: the cards and the connectors
                // between them share one centre line, so the flow reads as a
                // single run rather than as cards along one edge with the
                // connectors floating away from them.
                //
                // Centre also means each card is only as tall as its own
                // content. Stretching them to match the tallest card in the
                // row left a block of empty space under the short ones — and
                // stretched a card away from the arrow pointing at it.
                alignItems="center"
                sx={{
                  // Only the horizontal flow needs to out-size its scroller —
                  // forcing max-content on the column makes it as wide as its
                  // widest row, which is what pushed the centred connectors
                  // away from the left-aligned cards.
                  minWidth: vertical ? '100%' : 'max-content',
                  px: 0.5,
                }}
              >
                {visibleSpine.map((stage, i) => (
                  <React.Fragment key={stage.stage}>
                    {i > 0 && (
                      <Connector
                        index={i}
                        vertical={vertical}
                        // Every stage left in visibleSpine was actually reached,
                        // so the connector between any two of them is always live.
                        active
                      />
                    )}
                    <StageGroup stage={stage} index={i} vertical={vertical} onOpen={openPreview} />
                  </React.Fragment>
                ))}

                {/* The split at the goods document: on to billing, or back as
                    a return. Drawn as one fork rather than as a spine plus a
                    separate list, because these are two routes out of the same
                    document and neither continues the other. A route with no
                    document raised against it yet is left off entirely, and
                    the fork itself is skipped once neither route has one. */}
                {goodsStage && (invoiceDocs.length > 0 || returnDocs.length > 0) && (
                  <>
                    <Connector
                      index={visibleSpine.length}
                      vertical={vertical}
                      active={Boolean(goodsStage.present)}
                    />
                    <Fork
                      vertical={vertical}
                      lanes={[
                        invoiceDocs.length > 0 && { key: 'billing', content: billingLaneContent },
                        returnDocs.length > 0 && { key: 'return', content: <DocRun groups={returnLane} vertical={vertical} onOpen={openPreview} /> },
                      ].filter(Boolean)}
                    />
                  </>
                )}
              </Stack>
            </Box>

            {/* Which of the two routes out of the goods document is still
                open. Decided by the backend (routeMap.js) from the same flags
                the write guards enforce, so it can never contradict what a
                save will actually allow. The diagram above shows the shape;
                this says which way is currently passable. */}
            {branch && (
              <Alert
                severity={branch.invoiced ? 'info' : 'success'}
                variant="outlined"
                sx={{ mt: 2, py: 0.25, width: 'fit-content' }}
              >
                <Typography variant="caption">
                  {branch.invoiced
                    ? 'Invoiced — returns are closed. A Credit Memo against the invoice is the route back.'
                    : 'Not yet invoiced — the goods can still be returned.'}
                </Typography>
              </Alert>
            )}

            {stages.every((s) => !s.present) && (
              <Alert severity="info" sx={{ mt: 2 }}>
                No linked documents were found for this record.
              </Alert>
            )}
          </>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Tooltip title="Close the route map">
          <Button onClick={onClose} color="inherit">Close</Button>
        </Tooltip>
      </DialogActions>

      {preview && (
        <RouteMapDocumentPreview
          open
          onClose={closePreview}
          flow={flow}
          stage={preview.stage}
          docNo={preview.docNo}
        />
      )}
    </Dialog>
  );
}
