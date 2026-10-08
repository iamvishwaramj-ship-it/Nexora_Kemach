import React from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { Breadcrumbs, Link, Typography } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { useTranslation } from 'react-i18next';
import { findNavByPath } from '../../router/navConfig';

// Profile isn't in navConfig as a real sidebar entry (it's opened via the
// header avatar menu at both /profile and /settings/profile, not clicked
// from the sidebar), so it has no auto-generated trail. Special-case it here
// rather than adding it as a navConfig child of "settings" -- that would
// also change Settings' sidebar/global-search/card-grid behavior, which
// isn't wanted.
const PROFILE_PATHS = ['/profile', '/settings/profile'];

// Every page gets a breadcrumb built off the route config — automatic,
// never hand-written per page.
export default function AppBreadcrumbs() {
  const { t } = useTranslation();
  const location = useLocation();
  const navEntry = findNavByPath(location.pathname);
  const isProfileRoute = PROFILE_PATHS.includes(location.pathname);
  const settingsEntry = findNavByPath('/settings');

  // The Home crumb below always links to /dashboard and reads "Dashboard" --
  // on the Dashboard page itself, navEntry.trail is just [dashboardNode], so
  // without this filter it'd render "Dashboard > Dashboard".
  const trail = isProfileRoute
    ? [settingsEntry, { key: 'profile', labelKey: 'common.profile', path: location.pathname }].filter(Boolean)
    : (navEntry?.trail || []).filter((node) => node.path !== '/dashboard');

  return (
    <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} sx={{ fontSize: '0.8125rem' }}>
      <Link component={RouterLink} to="/dashboard" underline="hover" color="inherit" sx={{ display: 'flex', alignItems: 'center' }}>
        <HomeIcon fontSize="inherit" sx={{ mr: 0.5 }} />
        {t('common.dashboard')}
      </Link>
      {trail.map((node, i) => {
        const isLast = i === trail.length - 1;
        const label = node.labelKey?.startsWith('nav.') || node.labelKey?.startsWith('common.')
          ? t(node.labelKey)
          : node.labelKey;
        return isLast ? (
          <Typography key={node.key} color="text.primary" fontWeight={600} sx={{ fontSize: '0.8125rem' }}>
            {label}
          </Typography>
        ) : (
          <Link key={node.key} component={RouterLink} to={node.path} underline="hover" color="inherit">
            {label}
          </Link>
        );
      })}
    </Breadcrumbs>
  );
}
