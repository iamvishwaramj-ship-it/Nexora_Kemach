import React, { Suspense, useCallback, useEffect } from 'react';
import { Box, Toolbar } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';
import Header from './Header';
import TabBar from '../navigation/TabBar';
import AppBreadcrumbs from '../navigation/AppBreadcrumbs';
import KeepAliveOutlet from '../navigation/KeepAliveOutlet';
import Spinner from '../ui/Spinner';
import { RequireView } from '../common/PermissionGate';
import { openTab } from '../../store/tabsSlice';
import { userUpdated } from '../../store/authSlice';
import { useGetMeQuery, useLogoutMutation } from '../../features/auth/authApi';
import { findNavByPath } from '../../router/navConfig';
import useIdleTimer from '../../hooks/useIdleTimer';
import { useNotify } from '../feedback/NotificationProvider';

// Session auto-logout: no mouse/keyboard/touch activity anywhere in the
// authenticated app for this long ends the session client-side, same as
// clicking Logout by hand.
const SESSION_IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// DashboardLayout — combines Sidebar + Header (navbar) + chrome-style TabBar
// + breadcrumbs + routed page content. Every navigable page renders here.
const MainLayout = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const notify = useNotify();
  const tabs = useSelector((s) => s.tabs.tabs);
  const dirtyPaths = useSelector((s) => s.tabs.dirtyPaths);
  const refreshToken = useSelector((s) => s.auth.refreshToken);
  const [logout] = useLogoutMutation();

  // 15 minutes of no activity anywhere in the authenticated app -> end the
  // session. `logout` (features/auth/authApi.js) always dispatches
  // `loggedOut()` in its own finally block, whether or not the server call
  // actually succeeds, so an idle user never stays "logged in" just because
  // the revoke request failed or timed out -- we only need to redirect here.
  const handleSessionIdle = useCallback(async () => {
    try {
      await logout(refreshToken).unwrap();
    } catch {
      // Client-side session was already cleared by authApi's logout
      // mutation regardless; nothing further to do here.
    } finally {
      notify.info(t('common.sessionTimedOut', 'You were signed out after 15 minutes of inactivity.'));
      navigate('/login', { replace: true });
    }
  }, [logout, refreshToken, notify, t, navigate]);

  useIdleTimer({ timeout: SESSION_IDLE_TIMEOUT_MS, onIdle: handleSessionIdle });

  // Native "leaving site" prompt when the whole browser tab/window is being
  // closed (or refreshed/navigated away from) while any open tab -- not just
  // the visible one, since backgrounded tabs keep their own unsaved edits
  // too -- still has unsaved changes. Browsers ignore any custom message and
  // show their own generic wording, but preventDefault + returnValue is
  // still what's required to trigger it at all.
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (Object.keys(dirtyPaths || {}).length > 0) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
      return undefined;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirtyPaths]);

  // Re-read the signed-in user (and, importantly, their menu permissions) once
  // per app load. Without this the permission grid would only ever be the
  // snapshot taken at login, so an admin granting or revoking access would not
  // reach that user until they logged out and back in.
  const { data: me } = useGetMeQuery();
  useEffect(() => {
    if (me?.user) dispatch(userUpdated(me.user));
  }, [me, dispatch]);

  // Dashboard is a static, permanent tab -- always present and never
  // closeable, regardless of which page the user actually lands on first
  // (deep link, refresh, etc.), so it's pinned once here on mount rather
  // than only when the user happens to navigate to it.
  useEffect(() => {
    dispatch(openTab({ path: '/dashboard', title: t('nav.dashboard'), closable: false }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Every route the user lands on gets a tab, per the chrome-tab-system rule.
  useEffect(() => {
    const navEntry = findNavByPath(location.pathname);
    if (navEntry) {
      dispatch(openTab({
        path: navEntry.path,
        title: navEntry.labelKey?.startsWith('nav.') ? t(navEntry.labelKey) : navEntry.labelKey,
        closable: navEntry.path !== '/dashboard',
      }));
    }
  }, [location.pathname, dispatch, t]);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Header />
      <Sidebar />
      <Box
        component="main"
        data-font-scope="body"
        sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}
      >
        <Toolbar sx={{ minHeight: '64px !important' }} />
        <TabBar />
        <Box sx={{ px: { xs: 2, md: 3 }, pt: 1.5 }}>
          <AppBreadcrumbs />
        </Box>
        <Box sx={{ p: { xs: 2, md: 3 }, flex: 1 }}>
          {/* One guard for every routed page: RequireView reads the current
              pathname, resolves it to its navConfig entry and refuses to render
              a section the user holds no View permission on. Guarding here
              rather than route by route means a page added later is covered
              automatically instead of being forgotten. */}
          <Suspense fallback={<Spinner label={t('common.loading')} />}>
            <RequireView>
              <KeepAliveOutlet openPaths={tabs.map((tb) => tb.path)} />
            </RequireView>
          </Suspense>
        </Box>
      </Box>
    </Box>
  );
};

export default MainLayout;
