import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { closeTab, closeAllTabs, setActiveTab, confirmOpenPendingTab, cancelPendingTab } from '../../store/tabsSlice';
import { useConfirm } from '../feedback/ConfirmationDialog';

// Chrome-style tab system: every page a user opens gets its own closeable tab.
export default function TabBar() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const confirmDialog = useConfirm();
  const { tabs, activeTabPath, pendingTab, maxTabs, dirtyPaths } = useSelector((s) => s.tabs);

  React.useEffect(() => {
    if (!pendingTab) return;
    (async () => {
      const ok = await confirmDialog({
        title: 'Tab limit reached',
        message: `You have ${maxTabs} tabs open (the max). Close the oldest tab and open "${pendingTab.title}"?`,
        confirmLabel: 'Open anyway',
      });
      if (ok) dispatch(confirmOpenPendingTab());
      else dispatch(cancelPendingTab());
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTab]);

  if (!tabs.length) return null;

  const handleChange = (path) => {
    dispatch(setActiveTab(path));
    navigate(path);
  };

  const handleClose = async (e, path, title) => {
    e.stopPropagation();
    if (dirtyPaths?.[path]) {
      const ok = await confirmDialog({
        title: 'Unsaved changes',
        message: `"${title}" has unsaved changes. Close this tab and discard them?`,
        confirmLabel: 'Discard & close',
        severity: 'error',
      });
      if (!ok) return;
    }
    dispatch(closeTab(path));
    // A tab covers its whole nav section, not just its exact path -- most
    // modules have a "/new", "/create" or "/:id/edit" sub-route (see
    // AppRouter.jsx) that shares its parent's single tab rather than getting
    // one of its own (findNavByPath in navConfig.js only ever resolves the
    // base path). So closing "GL Account Determination" while sitting on
    // .../gl-account-determination/new must still count as closing what's on
    // screen, even though location.pathname there never equals `path`
    // exactly. Matching only on strict equality left that sub-route mounted
    // forever with no tab left to close it from -- it never got pruned from
    // KeepAliveOutlet's cache because that cache keys off the real URL, and
    // pruning only happens once the URL actually changes.
    const onThisTab = location.pathname === path || location.pathname.startsWith(`${path}/`);
    if (onThisTab) {
      const remaining = tabs.filter((t2) => t2.path !== path);
      navigate(remaining[remaining.length - 1]?.path || '/dashboard');
    }
  };

  const handleCloseAll = async () => {
    // closeAllTabs (tabsSlice) keeps the tab the user is currently on, same
    // as Chrome's "Close other tabs" -- so only the OTHER tabs' dirty state
    // matters here. Including the current tab in this check used to prompt
    // "discard changes?" for a tab that was never going to close.
    const others = tabs.filter((t2) => t2.closable !== false && t2.path !== activeTabPath);
    const anyDirty = others.some((t2) => dirtyPaths?.[t2.path]);
    if (anyDirty) {
      const ok = await confirmDialog({
        title: 'Unsaved changes',
        message: 'One or more other open tabs have unsaved changes. Close them and discard those changes?',
        confirmLabel: 'Discard & close others',
        severity: 'error',
      });
      if (!ok) return;
    }
    dispatch(closeAllTabs());
    // No navigate() -- the current tab (and whatever page it's on) is
    // exactly what's left open, so there's nowhere else to send the user.
  };

  const activePath = activeTabPath && tabs.some((t2) => t2.path === activeTabPath) ? activeTabPath : false;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: 64,
        zIndex: (theme) => theme.zIndex.appBar - 1,
        display: 'flex',
        alignItems: 'flex-start',
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          // Mobile: keep every tab on one line and let the user swipe left/right.
          // Desktop: no scrolling at all -- tabs wrap onto additional rows.
          flexWrap: { xs: 'nowrap', md: 'wrap' },
          overflowX: { xs: 'auto', md: 'visible' },
          overflowY: { xs: 'hidden', md: 'visible' },
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {tabs.map((tab) => {
          const selected = tab.path === activePath;
          return (
            <Box
              key={tab.path}
              role="button"
              tabIndex={0}
              onClick={() => handleChange(tab.path)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleChange(tab.path); }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                flexShrink: 0,
                minHeight: 40,
                px: 1.5,
                fontSize: '0.8125rem',
                fontWeight: selected ? 600 : 400,
                color: selected ? 'primary.main' : 'text.primary',
                borderBottom: '2px solid',
                borderColor: selected ? 'primary.main' : 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {tab.title}
              {dirtyPaths?.[tab.path] && (
                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'warning.main', ml: 0.5, flexShrink: 0 }} />
              )}
              {tab.closable !== false && (
                <Box
                  component="span"
                  role="button"
                  aria-label={`close ${tab.title}`}
                  onClick={(e) => handleClose(e, tab.path, tab.title)}
                  sx={{ display: 'inline-flex', ml: 0.5, borderRadius: '50%', p: 0.25, '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      <Tooltip title={t('common.closeAll')}>
        <IconButton size="small" onClick={handleCloseAll} sx={{ mr: 1, mt: 0.5, flexShrink: 0 }}>
          <DeleteSweepIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
