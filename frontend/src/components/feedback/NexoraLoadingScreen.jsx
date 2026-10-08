import React from 'react';
import { Box, Typography } from '@mui/material';

// ---------------------------------------------------------------------------
// Full-screen brand loading state.
//
// Same "NEXORA" wordmark as NexoraLogo (components/layout/Nexora_Logo.jsx),
// but for the moment there's nothing else on screen yet — a route chunk
// still downloading, an auth check still in flight. Rather than sitting a
// separate spinner next to a static logo, the orange "O" itself becomes the
// spinner: it renders as an open ring and spins in place, so the wordmark
// you'd see anyway is what tells you something is loading.
//
// Used as the app's single Suspense fallback (see AppRouter.jsx). Its look
// is deliberately duplicated (not shared via import) in index.html's own
// plain-CSS splash, which covers the instant before React has mounted at
// all — there's no bundle yet at that point for a real import to reach.
// Keep the two in sync if this one's colors/sizing ever change.
// ---------------------------------------------------------------------------
const NEXORA_LETTERS = ['N', 'E', 'X', 'O', 'R', 'A'];
const NEXORA_TEXT_COLOR = '#57534E';
const ORANGE = '#F97316';

export default function NexoraLoadingScreen({ label = 'Loading' }) {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 1400,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2.5,
        bgcolor: 'background.default',
      }}
    >
      <Typography
        component="div"
        sx={{
          display: 'flex',
          alignItems: 'center',
          // Spacing between letters comes entirely from this flex `gap`,
          // not `letter-spacing` — letter-spacing only pads the trailing
          // edge of actual text, so with each letter as its own flex item
          // it left the O's ring (which has no text content) sitting on
          // just its own tiny margin while every real letter got a full
          // 0.2em of trailing space, reading as a tighter O-R gap. `gap`
          // applies uniformly between flex items regardless of what's
          // inside them, so every letter — ring included — gets the same
          // space on both sides.
          gap: '0.2em',
          fontWeight: 900,
          fontSize: { xs: '2.4rem', sm: '3rem' },
          lineHeight: 1,
        }}
      >
        {NEXORA_LETTERS.map((letter, i) =>
          letter === 'O' ? (
            // The "O" — an open ring (one side transparent) instead of a
            // solid letter, spinning continuously. Sized off 1em so it
            // always matches whatever font-size the surrounding letters are
            // rendering at (see the responsive fontSize above). No margin
            // of its own — spacing comes from the flex `gap` above, same as
            // every other letter.
            <Box
              key={i}
              component="span"
              aria-hidden="true"
              sx={{
                display: 'inline-block',
                width: '0.72em',
                height: '0.72em',
                borderRadius: '50%',
                border: '0.13em solid',
                borderColor: `${ORANGE} ${ORANGE} transparent ${ORANGE}`,
                animation: 'nx-o-spin 0.85s linear infinite',
                '@keyframes nx-o-spin': {
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
                },
              }}
            />
          ) : (
            <Box key={i} component="span" sx={{ color: NEXORA_TEXT_COLOR }}>
              {letter}
            </Box>
          )
        )}
      </Typography>
      {/* "Loading" + three staggered dots — echoes the orange O rather than
          competing with it, so the eye reads NEXORA first. */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.9 }}>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.72rem' }}
        >
          {label}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                bgcolor: ORANGE,
                animation: 'nx-dot-pulse 1.2s ease-in-out infinite',
                animationDelay: `${i * 0.15}s`,
                '@keyframes nx-dot-pulse': {
                  '0%, 80%, 100%': { opacity: 0.25, transform: 'scale(0.8)' },
                  '40%': { opacity: 1, transform: 'scale(1.2)' },
                },
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
