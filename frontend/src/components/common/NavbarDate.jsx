import React, { useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';

// Today's date + day of week, shown in the navbar just before the language
// switcher — date on top, day underneath. Refreshed once a minute rather
// than once a second (like DigitalClock) — the day only ever changes at
// midnight, so anything faster would just be wasted re-renders.
export default function NavbarDate() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const dateLabel = now.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  const dayLabel = now.toLocaleDateString(undefined, { weekday: 'long' });

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 1.15, flexShrink: 0, mr: 0.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.15 }}>
        {dateLabel}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1.15 }}>
        {dayLabel}
      </Typography>
    </Box>
  );
}
