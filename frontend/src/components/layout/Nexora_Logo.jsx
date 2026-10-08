import React from 'react';
import { Box, Typography } from '@mui/material';

// ---------------------------------------------------------------------------
// Shared Nexora Enterprise brand mark.
//
// This is the single source of truth for the logo image (with its breathing
// animation) and the "NEXORA" / looping-typed "Enterprise" wordmark. It's used
// in the Sidebar header (both expanded and collapsed) and on the Login
// screen, so the mark, its animation, and its color theme stay identical
// everywhere the brand appears — change it here and every usage updates.
// ---------------------------------------------------------------------------
const LOGO_IMAGE_URL = 'https://i.ibb.co/v6qwV2tf/img-logo.png'; // brand mark image
const LOGO_ANIMATION_DURATION = '2.6s';   // speed of the logo's breathing animation
const NEXORA_TEXT_COLOR = '#57534E';      // "NEXORA" wordmark color (dark backgrounds use `light`)
const NEXORA_LETTER_SPACING = '0.15em';   // wide tracking so NEXORA reads letter-by-letter (N E X O R A)
// "NEXORA" split into individual letters so the "O" can be recolored on its
// own (see the orange-O rendering in NexoraLogo below) — a single string
// child couldn't single out one character for its own color.
const NEXORA_LETTERS = ['N', 'E', 'X', 'O', 'R', 'A'];
const ENTERPRISE_TEXT_COLOR = '#F97316';  // "Enterprise" wordmark color -- also the fixed "O" color, independent of `light`
const ENTERPRISE_LETTER_SPACING = '4px';  // "Enterprise" letter spacing
const ENTERPRISE_TEXT = 'Enterprise...';  // word that gets the typing animation
const ENTERPRISE_TYPING_DURATION = '30s'; // full type → hold → erase → loop cycle
// Full revealed width of the typed word. Plain "Nch" undershoots once
// letter-spacing (and bold uppercase glyphs wider than the "ch" unit) are
// added in — pad generously so the whole word always clears before the hold.
const ENTERPRISE_TYPING_WIDTH = `calc(${ENTERPRISE_TEXT.length}ch + ${ENTERPRISE_TEXT.length * parseFloat(ENTERPRISE_LETTER_SPACING)}px + 6px)`;
// Icon sizes for the named presets, plus the font-size ratios measured off
// the sidebar's reference size (34px icon -> 2.30rem "NEXORA" / 0.62rem
// "Enterprise"), so any custom pixel size passed in scales proportionally.
const ICON_SIZES = { sm: 20, md: 30, lg: 40 };
const BASE_ICON_SIZE = 34;
// Roughly double the original 1.15rem -- NEXORA is now the dominant element
// of the lockup, with "Enterprise..." sitting underneath it as the smaller
// supporting line (see the stacked layout in NexoraLogo below).
const BASE_NEXORA_REM = 1.5;
const BASE_ENTERPRISE_REM = 0.7;

// Icon-only animated brand mark (no wordmark) — used wherever just the mark
// is needed, e.g. the collapsed sidebar.
export const AnimatedLogo = ({ size = 34 }) => (
  <Box
    sx={{
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <Box
      component="img"
      src={LOGO_IMAGE_URL}
      alt="Nexora Enterprise"
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        animation: `nx-logo-breathe ${LOGO_ANIMATION_DURATION} ease-in-out infinite`,
        '@keyframes nx-logo-breathe': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.08)' },
        },
      }}
    />
  </Box>
);

// Full brand lockup: animated logo + stacked "NEXORA" / looping typed
// "Enterprise" wordmark, both left-aligned as one block so "Enterprise..."
// starts directly under the "N".
// - size: 'sm' | 'md' | 'lg', or a raw pixel number for the icon.
// - light: flips the "NEXORA" wordmark to white, for dark/colored backgrounds
//   — the "O" stays the fixed brand orange regardless of `light`.
// - showText: false renders just the icon (equivalent to <AnimatedLogo />).
const NexoraLogo = ({ size = 'md', light = false, showText = true }) => {
  const iconSize = typeof size === 'number' ? size : (ICON_SIZES[size] || ICON_SIZES.md);
  if (!showText) return <AnimatedLogo size={iconSize} />;

  const scale = iconSize / BASE_ICON_SIZE;
  const nexoraFontSize = `${(BASE_NEXORA_REM * scale).toFixed(2)}rem`;
  const enterpriseFontSize = `${(BASE_ENTERPRISE_REM * scale).toFixed(2)}rem`;
  const nexoraLetterColor = light ? '#FFFFFF' : NEXORA_TEXT_COLOR;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <AnimatedLogo size={iconSize} />
      {/* Stacked lockup: NEXORA on top, Enterprise directly beneath it, both
          flush against the same left edge -- a plain vertical Box stack
          (no extra indent on either line) is what keeps "Enterprise..."
          starting under the "N". */}
      <Box>
        <Typography
          sx={{
            fontWeight: 900,
            fontSize: nexoraFontSize,
            lineHeight: 1.05,
            letterSpacing: NEXORA_LETTER_SPACING,
          }}
        >
          {NEXORA_LETTERS.map((letter, i) => (
            <Box
              key={i}
              component="span"
              sx={{ color: letter === 'O' ? ENTERPRISE_TEXT_COLOR : nexoraLetterColor }}
            >
              {letter}
            </Box>
          ))}
        </Typography>
        <Typography
          component="div"
          sx={{
            fontWeight: 700,
            fontSize: enterpriseFontSize,
            lineHeight: 1,
            letterSpacing: ENTERPRISE_LETTER_SPACING,
            textTransform: 'uppercase',
            color: ENTERPRISE_TEXT_COLOR,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Box
            component="span"
            sx={{
              display: 'inline-block',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              verticalAlign: 'bottom',
              width: ENTERPRISE_TYPING_WIDTH,
              animation: `nx-enterprise-typing ${ENTERPRISE_TYPING_DURATION} ease-in-out infinite`,
              '@keyframes nx-enterprise-typing': {
                '0%, 5%': { width: '0' },
                '45%, 60%': { width: ENTERPRISE_TYPING_WIDTH },
                '95%, 100%': { width: '0' },
              },
            }}
          >
            {ENTERPRISE_TEXT}
          </Box>
        </Typography>
      </Box>
    </Box>
  );
};

export default NexoraLogo;
