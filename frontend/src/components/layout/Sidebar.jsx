import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText, Tooltip, Typography, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { setMobileSidebarOpen } from '../../store/uiSlice';
import { openTab } from '../../store/tabsSlice';
import { getNavIcon } from '../../router/iconMap';
import { useVisibleNav } from '../../lib/permissions';
import { getSidebarIconColor } from './sidebarIconColors';
import DigitalClock from '../common/DigitalClock';
import VersionHistory from '../common/VersionHistory';
import { SHOW_VERSION_LABEL, VERSION_LABEL_NAME } from '../../config/versionHandle';

export const SIDEBAR_WIDTH = 265;
export const SIDEBAR_WIDTH_COLLAPSED = 72;

// Header.jsx's sidebar collapse/expand toggle button is positioned by
// straddling the sidebar's right border -- its centre should land exactly on
// SIDEBAR_WIDTH (expanded) / SIDEBAR_WIDTH_COLLAPSED (collapsed). This is the
// one knob for nudging that off the exact border if it ever looks
// mis-centred against the real rendered edge (sub-pixel rounding, a theme
// border width change, etc.) -- Header.jsx reads ONLY this constant, so
// changing the number here is the entire fix; no layout/positioning code
// needs to change alongside it.
//   0        -> button's centre sits exactly on the border (default).
//   negative -> shifts the button left, further into the sidebar rail.
//   positive -> shifts the button right, further into the content area.
export const SIDEBAR_TOGGLE_OFFSET = -25;

// --- Nav button sizing -----------------------------------------------------
// Every edge of the sidebar's nav buttons is its own variable. Change a value
// here and every button updates; nothing else needs touching. All numbers are
// px unless noted.
//
// THREE things stack to make the vertical space you see around a label like
// "Accounting", from the outside in:
//   1. sidebar_button_margin_*   space BETWEEN buttons (outside the pill)
//   2. sidebar_button_padding_*  space inside the pill, above/below its content
//   3. sidebar_button_label_margin_*  ListItemText's own margin (MUI ships 4px)
//      + sidebar_button_label_line_height, the line box around the glyphs.
// If a button still looks taller than padding_top + padding_bottom suggests,
// it's #3 doing it — set both label margins to 0 and line height to ~1.2.
//
// sidebar_button_width  '100%' fills the rail (minus the List's own px:1
//                       padding). Give it a number for a fixed pixel width —
//                       the button then centres itself in the rail via the
//                       mx:'auto' below. Keep it at or under
//                       SIDEBAR_WIDTH_COLLAPSED (72) if you want a fixed width
//                       to still fit while the sidebar is collapsed.
// sidebar_button_height minimum height of each button. Note this is a FLOOR,
//                       not a target: padding + icon (~20px) can push a button
//                       taller than this. Lower the paddings to actually shrink.
export const sidebar_button_width = '100%';
export const sidebar_button_height = 5;
// Corner rounding of the button, in px. 0 = square corners.
export const sidebar_button_border_radius = 0;

// Outside the button — the gap between one pill and the next.
export const sidebar_button_margin_top = 0;
export const sidebar_button_margin_bottom = 4;

// Inside the button — space between its edge and the icon/label row.
export const sidebar_button_padding_top = 4;
export const sidebar_button_padding_bottom = 4;
export const sidebar_button_padding_left = 16;
export const sidebar_button_padding_right = 16;

// The label itself. MUI's ListItemText ships a 4px margin top and bottom that
// stacks on the padding above; these override it edge by edge.
export const sidebar_button_label_margin_top = 0;
export const sidebar_button_label_margin_bottom = 0;
// Line box around the text. MUI's default (~1.5) pads a couple more px above
// and below the glyphs; 1.2–1.3 tightens that up. Unitless multiplier.
export const sidebar_button_label_line_height = 1.25;

// --- 3D hover / focus lift --------------------------------------------------
// On hover and keyboard focus, a nav button "comes forward" toward the
// viewer, then settles back on mouse-out. Same convention as the sizing
// block above: every dimension is its own variable here, so tuning the feel
// never means hunting through the sx below.
//
// Only respected when the user hasn't asked for reduced motion (see the
// `@media (prefers-reduced-motion: no-preference)` guard around every use of
// these below) -- with reduced motion on, buttons keep MUI's ordinary flat
// hover tint (unselected) / brightness dip (selected) and nothing scales or
// lifts.
export const sidebar_hover_perspective = 600; // px -- set on the List so every button shares one vanishing point
export const sidebar_hover_translate_z = 12; // px -- how far the button lifts toward the viewer
export const sidebar_hover_scale = 1.04; // scale factor while lifted
export const sidebar_hover_rotate_y = 2; // deg -- subtle tilt for depth; 0 disables it
export const sidebar_hover_shadow = 4; // index into theme.shadows for the lifted state (0 = none, higher = heavier)
// Extra horizontal breathing room on the List so the scaled-up button and its
// shadow aren't clipped by the List's own vertical scrollbar clipping (a
// List with overflowY set clips overflowX too, per the CSS overflow spec --
// there's no way to scroll one axis and leave the other truly unclipped).
// Generous padding here, paired with a modest shadow above, keeps the lift
// visually intact without giving up the scrollbar for long menus.
export const sidebar_list_horizontal_padding = 16; // px, each side

// The Header is a fixed AppBar at zIndex `drawer + 1`. MUI gives BOTH drawer
// variants a zIndex of `drawer`, so in either mode the AppBar paints over the
// drawer's top 64px -- silently swallowing the first nav item (Dashboard).
// Both papers therefore start below the header rather than at y=0.
const BELOW_HEADER = { top: 64, height: 'calc(100% - 64px)' };

// Collapsible sidebar. NOTE: per design-system.md, items with sub-items do
// NOT open a flyout — clicking them navigates to a dedicated card-grid page
// (see pages/*/index pages using SubMenuGrid). Only leaf items link directly.
export default function Sidebar() {
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const dispatch = useDispatch();
  const collapsed = useSelector((s) => s.ui.sidebarCollapsed);
  const mobileOpen = useSelector((s) => s.ui.mobileSidebarOpen);
  // Settings > Theme "Sidebar 3D hover effect" radio button. Independent of
  // (and layered on top of) the OS-level prefers-reduced-motion query below
  // -- either one being "off" suppresses the lift.
  const sidebar3dHoverEnabled = useSelector((s) => s.theme.sidebar3dHoverEnabled);
  // Settings > Theme "Sidebar icon colors" radio button. Off falls every icon
  // back to inheriting the button's colour -- see sidebarIconColors.js.
  const sidebarIconColorsEnabled = useSelector((s) => s.theme.sidebarIconColorsEnabled);
  const location = useLocation();
  const navigate = useNavigate();
  // Only the sections this user holds a View permission on (directly, or on
  // something beneath them). Admins get the full tree — see lib/permissions.js.
  const visibleNav = useVisibleNav();
  // Double-clicking the version label at the foot of the sidebar opens the
  // hand-maintained changelog popup — see VersionHistory.jsx.
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);

  // The rail is only narrow when it's collapsed AND not the mobile drawer —
  // the drawer always opens at full width. Named once here because both the
  // nav buttons and the clock at the foot key off the same condition.
  const isCompact = collapsed && !isMobile;
  const width = isCompact ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  const handleNavigate = (node) => {
    if (document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
          document.activeElement.blur();
    }
    navigate(node.path);
    dispatch(openTab({ path: node.path, title: node.labelKey?.startsWith('nav.') ? t(node.labelKey) : node.labelKey }));
    if (isMobile) dispatch(setMobileSidebarOpen(false));
  };

  // Sidebar nav uses its own font + bold/italic/underline (Settings >
  // Fonts), independent of the body's. MUI applies fontFamily/fontWeight to
  // descendants via generated classes (e.g. .MuiTypography-root, variant
  // weights), so plain inherited CSS on this Box wouldn't win — force it on
  // every descendant instead.
  const content = (
    <Box
      sx={{
        height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper',
        fontFamily: (t) => t.custom.sidebarFontFamily,
        '& *': (t) => ({ fontFamily: 'inherit !important', ...t.custom.sidebarTextOverrides }),
      }}
    >
      {/* No brand row here: the AppBar directly above already renders the
          logo + wordmark, and its hamburger (or, when collapsed, the logo
          itself) owns the expand/collapse toggle. Repeating the app name and
          a second chevron here just duplicated the header. */}
      <List
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: `${sidebar_list_horizontal_padding}px`,
          pt: 2,
          // Shared vanishing point for every child button's 3D hover/focus
          // lift below -- perspective belongs on the parent, not each item,
          // or every button would appear to tilt toward its own centre
          // instead of a single consistent point.
          perspective: `${sidebar_hover_perspective}px`,
        }}
      >
        {visibleNav.map((node) => {
          const Icon = getNavIcon(node.icon);
          const isActive = location.pathname === node.path || location.pathname.startsWith(node.path + '/');
          const iconColor = sidebarIconColorsEnabled ? getSidebarIconColor(node.key) : undefined;
          const button = (
            <ListItemButton
              key={node.key}
              selected={isActive}
              onClick={() => handleNavigate(node)}
              sx={{
                borderRadius: `${sidebar_button_border_radius}px`,
                // Sizing comes from the three variables at the top of this
                // file. mx:'auto' keeps a fixed-width button centred in the
                // rail instead of hugging the left edge.
                width: sidebar_button_width,
                mx: 'auto',
                minHeight: sidebar_button_height,
                // Overrides MUI's built-in 8px/16px padding, which would
                // otherwise keep the button tall however small minHeight is.
                pt: `${sidebar_button_padding_top}px`,
                pb: `${sidebar_button_padding_bottom}px`,
                pl: `${sidebar_button_padding_left}px`,
                pr: `${sidebar_button_padding_right}px`,
                mt: `${sidebar_button_margin_top}px`,
                mb: `${sidebar_button_margin_bottom}px`,
                justifyContent: collapsed && !isMobile ? 'center' : 'flex-start',
                // ListItemText ships its own 4px top/bottom margin, which
                // stacks with the padding above and puffs up the label.
                '& .MuiListItemText-root': {
                  mt: `${sidebar_button_label_margin_top}px`,
                  mb: `${sidebar_button_label_margin_bottom}px`,
                },
                // Base "come forward" hover/focus lift -- transform and
                // box-shadow only (no layout properties), so this animates
                // on its own compositor layer without triggering a reflow.
                // Applies identically in the collapsed/mini rail: the whole
                // button (icon included) is still the element being
                // transformed, there's just no label to go with it.
                // Gated behind Settings > Theme "Sidebar 3D hover effect"
                // (sidebar3dHoverEnabled) -- when off, none of this is even
                // added to the sx object, so hover/focus fall back to MUI's
                // plain default ListItemButton background highlight.
                ...(sidebar3dHoverEnabled ? {
                  transition: (t) => t.transitions.create(['transform', 'box-shadow'], {
                    duration: t.transitions.duration.shorter,
                    easing: t.transitions.easing.easeOut,
                  }),
                  '@media (prefers-reduced-motion: no-preference)': {
                    willChange: 'transform',
                    '&:hover, &.Mui-focusVisible': {
                      transform:
                        `perspective(${sidebar_hover_perspective}px) `
                        + `translateZ(${sidebar_hover_translate_z}px) `
                        + `scale(${sidebar_hover_scale}) `
                        + `rotateY(${sidebar_hover_rotate_y}deg)`,
                      boxShadow: (t) => t.shadows[sidebar_hover_shadow],
                      // Lifts the hovered/focused item's shadow above its
                      // still-flat neighbours in the stack instead of letting
                      // the next pill's opaque background paint over it.
                      zIndex: 1,
                    },
                  },
                } : {}),
                // Existing active-item styling, untouched -- the 3D lift
                // above layers on top of it (same '&:hover'/focus-visible
                // selectors, so both the gradient-hover brightness dip and
                // the transform/shadow apply together) rather than
                // replacing the selected indicator.
                '&.Mui-selected': {
                  backgroundImage: (t) => t.custom.gradient, color: 'primary.contrastText',
                  '&:hover': { backgroundImage: (t) => t.custom.gradient, filter: 'brightness(0.94)' },
                },
              }}
            >
              {/* The section's own colour, except while selected: the active
                  button paints itself with the theme gradient, and a mid-tone
                  hue on top of that is the one place the icon stops being
                  legible -- so the selected item inherits the button's
                  foreground colour exactly as it did before. */}
              <ListItemIcon sx={{ minWidth: collapsed && !isMobile ? 0 : 40, color: isActive ? 'inherit' : (iconColor || 'inherit') }}>
                <Icon fontSize="small" />
              </ListItemIcon>
              {(!collapsed || isMobile) && (
                <ListItemText
                  primary={node.labelKey?.startsWith('nav.') ? t(node.labelKey) : node.labelKey}
                  primaryTypographyProps={{
                    fontSize: '0.875rem',
                    fontWeight: isActive ? 600 : 500,
                    lineHeight: sidebar_button_label_line_height,
                  }}
                />
              )}
            </ListItemButton>
          );
          return collapsed && !isMobile ? (
            <Tooltip key={node.key} title={node.labelKey?.startsWith('nav.') ? t(node.labelKey) : node.labelKey} placement="right">
              {button}
            </Tooltip>
          ) : button;
        })}
      </List>

      {/* Pinned to the foot of the rail: the List above takes flex:1 and
          scrolls on its own, so the clock stays put however long the menu
          gets. Drops to just HH:MM with no seconds or date when the sidebar
          is collapsed — at the 44px rail width there's no room for either. */}
      <Box sx={{ px: 1, pt: 1, pb: 2, borderTop: '1px solid', borderColor: 'divider' }}>
        <DigitalClock compact={isCompact} />
        {SHOW_VERSION_LABEL && (
          <Typography
            variant="caption"
            align="center"
            onDoubleClick={() => setVersionHistoryOpen(true)}
            sx={{ display: 'block', mt: 0.5, color: 'text.secondary', cursor: 'pointer', userSelect: 'none' }}
          >
            {VERSION_LABEL_NAME}
          </Typography>
        )}
      </Box>
      {/* Double-click the version label above to open this — a hand-maintained
          changelog, see VERSION_HISTORY in components/common/VersionHistory.jsx. */}
      <VersionHistory open={versionHistoryOpen} onClose={() => setVersionHistoryOpen(false)} />
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => dispatch(setMobileSidebarOpen(false))}
        ModalProps={{ keepMounted: true }}
        sx={{
          '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, boxSizing: 'border-box', ...BELOW_HEADER },
          // Dim the page but not the header -- the hamburger stays live so the
          // same control that opened the drawer can close it.
          '& .MuiBackdrop-root': BELOW_HEADER,
        }}
      >
        {content}
      </Drawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width, flexShrink: 0,
        '& .MuiDrawer-paper': {
          width, boxSizing: 'border-box', border: 'none', borderRight: '1px solid', borderColor: 'divider', transition: 'width 0.2s',
          ...BELOW_HEADER,
        },
      }}
    >
      {content}
    </Drawer>
  );
}
