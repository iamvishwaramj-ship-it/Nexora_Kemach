import React, { useState, useCallback } from 'react';
import {
  AppBar, Toolbar, IconButton, Typography, Box,
  Avatar, Menu, MenuItem, Divider, Tooltip, ListItemIcon, useMediaQuery,
  Badge, List, ListItemButton, ListItemText, Button, Stack, CircularProgress,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import MenuIcon from '@mui/icons-material/Menu';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import PersonIcon from '@mui/icons-material/Person';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import LanguageIcon from '@mui/icons-material/Language';
import PaletteIcon from '@mui/icons-material/Palette';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import NotificationsIcon from '@mui/icons-material/Notifications';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toggleSidebar, toggleMobileSidebar } from '../../store/uiSlice';
import { setColorScheme, toggleMode } from '../../store/themeSlice';
import { colorSchemeList } from '../../theme/colorSchemes';
import { selectCurrentUser, selectAccessToken } from '../../store/authSlice';
import { useLogoutMutation } from '../../features/auth/authApi';
import {
  useGetNotificationsQuery, useMarkNotificationReadMutation,
  useApproveNotificationMutation, useRejectNotificationMutation,
} from '../../features/resources';
import useNotificationSocket from '../../lib/useNotificationSocket';
import { useNotify } from '../feedback/NotificationProvider';
import GlobalSearch from '../navigation/GlobalSearch';
import NexoraLogo, { AnimatedLogo } from './Nexora_Logo';
import CompanyLogo from './CompanyLogo';
import NavbarDate from '../common/NavbarDate';
import { SIDEBAR_WIDTH, SIDEBAR_WIDTH_COLLAPSED, SIDEBAR_TOGGLE_OFFSET } from './Sidebar';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ta', label: 'தமிழ்' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'ml', label: 'മലയാളം' },
];

// Single knob for where the "Search menus, features..." field sits in the
// toolbar: 'right' -- next to the language/theme/mode/profile cluster (the
// current default) -- or 'left' -- back in the brand area, alongside the
// company logo, which is where it used to live before the company-logo slot
// was added. Flip this one constant to switch layouts; nothing else in the
// component needs to change.
const SEARCH_POSITION = 'left'; // 'left' | 'right'

const Header = React.memo(() => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  // Same breakpoint Sidebar.jsx uses to decide permanent vs temporary drawer
  // — the hamburger button must toggle whichever state that drawer is
  // actually reading, or it silently does nothing (or toggles the wrong,
  // persisted desktop-collapse state instead of the transient mobile one).
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  // Separate, narrower breakpoint than `isMobile`: tablets (600-900px) still
  // have room for the wordmark and an always-visible search field, phones do
  // not. Below 600px the navbar switches to icon-only + reveal-on-tap search.
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'));
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector(selectCurrentUser);
  const mode = useSelector((s) => s.theme.mode);
  const colorScheme = useSelector((s) => s.theme.colorScheme);
  const collapsed = useSelector((s) => s.ui.sidebarCollapsed);
  // Matches Sidebar's own width exactly, so the search bar (and everything
  // after it) starts right where the sidebar ends instead of wherever the
  // hamburger+logo cluster happens to measure.
  const brandWidth = isMobile ? 'auto' : (collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH);
  // Horizontal centre for the collapse-toggle button: the sidebar's actual
  // right border for whichever width is currently in effect, nudged by the
  // single SIDEBAR_TOGGLE_OFFSET knob (see Sidebar.jsx) if it's ever off.
  // Only the expanded case renders the button today, but this stays correct
  // for the collapsed width too so nothing here needs revisiting if that
  // changes.
  const sidebarToggleLeft = (collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH) + SIDEBAR_TOGGLE_OFFSET;
  const [logout] = useLogoutMutation();
  const [userMenuAnchor, setUserMenuAnchor] = useState(null);
  const [langMenuAnchor, setLangMenuAnchor] = useState(null);
  const [themeMenuAnchor, setThemeMenuAnchor] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // --- Notification bell ---------------------------------------------------
  const notify = useNotify();
  const accessToken = useSelector(selectAccessToken);
  const [notifMenuAnchor, setNotifMenuAnchor] = useState(null);
  const [actingOnId, setActingOnId] = useState(null);
  // No polling and no refetch-on-event: the list is fetched once here and
  // then kept current by useNotificationSocket() patching this same cache
  // entry (same `undefined` arg) from socket events that carry their data.
  const { data: notifData } = useGetNotificationsQuery(undefined, {
    skip: !accessToken,
  });
  useNotificationSocket();
  const notifications = notifData?.data || [];
  const unreadCount = notifData?.unreadCount || 0;
  const [markNotificationRead] = useMarkNotificationReadMutation();
  const [approveNotification] = useApproveNotificationMutation();
  const [rejectNotification] = useRejectNotificationMutation();

  const handleNotificationClick = useCallback((notification) => {
    if (notification.status === 'Unread') {
      markNotificationRead(notification.id);
    }
    // A result is informational: clicking it opens the request it is about.
    if (notification.type === 'ApprovalResult' && notification.referenceType === 'StockTransferRequest') {
      setNotifMenuAnchor(null);
      navigate('/inventory/stock-transfer/request');
    }
  }, [markNotificationRead, navigate]);

  const handleApprove = useCallback(async (e, id) => {
    e.stopPropagation();
    setActingOnId(id);
    // Previously this caught-and-swallowed every failure with the comment
    // "error surfaced via list refetch" — but invalidatesTags only fires on
    // a *successful* mutation, so a failed approve (expired token, someone
    // else already actioned it, the record was deleted, ...) refetched
    // nothing and left the user staring at unchanged Pending/unread state
    // with zero feedback. Surface it like every other mutation in the app.
    try { await approveNotification(id).unwrap(); } catch (err) { notify.error(err?.data?.message || 'Failed to approve this request'); }
    setActingOnId(null);
  }, [approveNotification, notify]);

  const handleReject = useCallback(async (e, id) => {
    e.stopPropagation();
    setActingOnId(id);
    try { await rejectNotification(id).unwrap(); } catch (err) { notify.error(err?.data?.message || 'Failed to reject this request'); }
    setActingOnId(null);
  }, [rejectNotification, notify]);

  const handleLanguageChange = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('nexora_language', code);
    setLangMenuAnchor(null);
  };

  const handleLogout = async () => {
    setUserMenuAnchor(null);
    const refreshToken = localStorage.getItem('nexora_refresh_token');
    try { await logout(refreshToken).unwrap(); } catch { /* ignore */ }
    navigate('/login');
  };

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', color: 'text.primary' }}
    >
      <Toolbar disableGutters sx={{ gap: { xs: 0.25, sm: 1.5 }, minHeight: '64px !important', pr: { xs: 0.5, sm: 2 } }}>
        {isCompact && searchOpen ? (
          /* Phone-width search: there's no room for a permanent field next to
             six controls, so the search icon takes over the whole toolbar
             until the user backs out or picks a result. */
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, width: '100%', pl: 0.5, pr: 1 }}>
            <IconButton onClick={() => setSearchOpen(false)} aria-label={t('common.close')}>
              <ArrowBackIcon />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <GlobalSearch fullWidth autoFocus onNavigate={() => setSearchOpen(false)} />
            </Box>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                display: 'flex', alignItems: 'center', gap: 1,
                // On phones the wordmark is the one thing that *may* give ground:
                // let it ellipsis rather than shove the action icons off-screen on
                // a 320px device. Everything else in the bar is flexShrink: 0.
                flexShrink: isCompact ? 1 : 0, minWidth: 0,
                width: brandWidth,
                // Both states line the leading control up with the vertical axis
                // of the sidebar nav icons directly beneath it:
                //   expanded  -> List px:1 (8px) + ListItemButton pl (16px) + half
                //                of the 20px icon = 34px centre. A small
                //                IconButton is 34px wide, so pl:17px centres it
                //                on 34px too.
                //   collapsed -> the 72px rail centres its icons on 36px, and this
                //                box is exactly 72px wide with a single centred
                //                child, so it lands on 36px as well.
                // On phones the sidebar is a temporary drawer, so there are no
                // rail icons to line up with -- reclaim the inset for content.
                pl: !isMobile && collapsed ? 0 : (isCompact ? 0.5 : '17px'),
                justifyContent: !isMobile && collapsed ? 'center' : 'flex-start',
                transition: 'width 0.2s',
              }}
            >
              {!isMobile && collapsed ? (
                /* Collapsed rail is only 72px wide -- a hamburger *and* a logo
                   can't both sit there without one of them falling off the icon
                   axis. So the rail shows the brand mark alone, and the brand
                   mark itself becomes the expand affordance: hovering swaps it
                   for a chevron so it's obvious it's clickable. */
                <Tooltip title={t('common.expandSidebar')} placement="right">
                  <IconButton
                    onClick={() => dispatch(toggleSidebar())}
                    aria-label={t('common.expandSidebar')}
                    sx={{
                      p: 0.75,
                      '&:hover .brand-mark': { opacity: 0 },
                      '&:hover .expand-mark': { opacity: 1 },
                    }}
                  >
                    <Box sx={{ position: 'relative', width: 24, height: 24, display: 'grid', placeItems: 'center' }}>
                      <Box
                        className="brand-mark"
                        sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', transition: 'opacity 0.15s' }}
                      >
                        <AnimatedLogo size={24} />
                      </Box>
                      <ChevronRightIcon
                        className="expand-mark"
                        sx={{ position: 'absolute', fontSize: 22, opacity: 0, transition: 'opacity 0.15s' }}
                      />
                    </Box>
                  </IconButton>
                </Tooltip>
              ) : isMobile ? (
                <>
                  {/* Phones/tablets: sidebar is a temporary overlay drawer, not a
                  permanent rail, so there's no sidebar edge to anchor a
                  straddling button on -- the hamburger stays the expand/close
                  affordance here, unchanged. */}
                  <IconButton
                    onClick={() => dispatch(toggleMobileSidebar())}
                    size="small"
                    aria-label={t('common.collapseSidebar')}
                  >
                    <MenuIcon />
                  </IconButton>
                  {/* Full wordmark in every state, just a size down on phones.
                  The room for it comes from moving the language switcher
                  into the profile menu below sm. */}
                  <NexoraLogo size={isCompact ? 28 : 32} light={theme.palette.mode === 'dark'} />
                </>
              ) : (
                /* Desktop, expanded: no hamburger -- the logo alone sits at the
                   left edge of the navbar (requirement 4). The collapse control
                   moves to the small edge-straddling button below, matching the
                   reference screenshot instead of a far-left hamburger. */
                <NexoraLogo size={32} light={theme.palette.mode === 'dark'} />
              )}
            </Box>

            {/* Collapse trigger for the expanded desktop sidebar -- a small round
            button sitting right on the boundary between the sidebar's right
            edge and the navbar/content area (half over the rail, half over
            the header), same look as the reference screenshot. Only the
            expanded -> collapsed direction moves here; the collapsed rail
            keeps its existing logo/chevron hover affordance untouched
            (see the `!isMobile && collapsed` branch above). Positioned
            relative to the AppBar itself (position: fixed on AppBar makes it
            the containing block), so it lines up with the sidebar's actual
            edge regardless of the Toolbar's own flex layout. */}
            {!isMobile && !collapsed && (
              <Tooltip title={t('common.collapseSidebar')} placement="right">
                <IconButton
                  onClick={() => dispatch(toggleSidebar())}
                  aria-label={t('common.collapseSidebar')}
                  size="small"
                  sx={{
                    position: 'absolute',
                    left: sidebarToggleLeft,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 28,
                    height: 28,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    boxShadow: 1,
                    zIndex: (theme) => theme.zIndex.drawer + 2,
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                >
                  <ChevronLeftIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}

            {/* Tenant/company logo slot -- distinct from the Nexora product
            wordmark in the brand cluster above, which stays put. Hidden at
            the same breakpoint the search field collapses at, so a phone
            navbar doesn't have to fit brand mark + company logo + six action
            icons in one row. */}
            {!isCompact && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                <CompanyLogo size={44} />
                {SEARCH_POSITION === 'left' && <GlobalSearch />}
              </Box>
            )}

            <Box sx={{ flex: 1 }} />

            {/* Search sits here, immediately before the language/theme/mode/
            profile cluster, only when SEARCH_POSITION is 'right' -- see the
            constant above. */}
            {!isCompact && SEARCH_POSITION === 'right' && <GlobalSearch />}

            {isCompact && (
              <IconButton size="small" onClick={() => setSearchOpen(true)} aria-label={t('common.search')} sx={{ flexShrink: 0 }}>
                <SearchIcon fontSize="small" />
              </IconButton>
            )}

            {/* Today's date + day, immediately before the language switcher.
            Desktop/tablet only, same visibility rule as the language cluster
            below -- there's no room for it once the navbar drops to phone
            width. */}
            {!isCompact && <NavbarDate />}

            {/* Language switcher -- desktop/tablet only. Below sm it lives inside
            the profile menu instead, which is what buys the wordmark its
            space back in the phone navbar. */}
            {!isCompact && (
              <>
                <Tooltip title={t('common.language')}>
                  <IconButton size="small" onClick={(e) => setLangMenuAnchor(e.currentTarget)} sx={{ flexShrink: 0 }}>
                    <LanguageIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Menu anchorEl={langMenuAnchor} open={Boolean(langMenuAnchor)} onClose={() => setLangMenuAnchor(null)}>
                  {LANGUAGES.map((l) => (
                    <MenuItem key={l.code} selected={i18n.language === l.code} onClick={() => handleLanguageChange(l.code)}>
                      {l.label}
                    </MenuItem>
                  ))}
                </Menu>
              </>
            )}

            {/* Theme color switcher */}
            <Tooltip title={t('common.theme')}>
              <IconButton size="small" onClick={(e) => setThemeMenuAnchor(e.currentTarget)} sx={{ flexShrink: 0 }}>
                <PaletteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={themeMenuAnchor} open={Boolean(themeMenuAnchor)} onClose={() => setThemeMenuAnchor(null)}>
              {colorSchemeList.map((s) => (
                <MenuItem key={s.key} selected={colorScheme === s.key} onClick={() => { dispatch(setColorScheme(s.key)); setThemeMenuAnchor(null); }}>
                  <ListItemIcon>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', background: `linear-gradient(135deg, ${s.primary}, ${s.accent})` }} />
                  </ListItemIcon>
                  {s.label}
                </MenuItem>
              ))}
            </Menu>

            {/* Light/dark mode */}
            <Tooltip title={mode === 'light' ? t('common.darkMode') : t('common.lightMode')}>
              <IconButton size="small" onClick={() => dispatch(toggleMode())} sx={{ flexShrink: 0 }}>
                {mode === 'light' ? <DarkModeIcon fontSize="small" /> : <LightModeIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            {/* Notification bell */}
            <Tooltip title={t('common.notifications', 'Notifications')}>
              <IconButton size="small" onClick={(e) => setNotifMenuAnchor(e.currentTarget)} sx={{ flexShrink: 0 }}>
                <Badge badgeContent={unreadCount} color="error" max={99}>
                  <NotificationsIcon fontSize="small" />
                </Badge>
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={notifMenuAnchor}
              open={Boolean(notifMenuAnchor)}
              onClose={() => setNotifMenuAnchor(null)}
              PaperProps={{ sx: { mt: 1, width: 380, maxHeight: 480 } }}
            >
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2">{t('common.notifications', 'Notifications')}</Typography>
              </Box>
              <Divider />
              {notifications.length === 0 && (
                <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                  <Typography variant="body2" color="text.secondary">
                    {t('common.noNotifications', 'No notifications yet')}
                  </Typography>
                </Box>
              )}
              <List disablePadding>
                {notifications.map((n) => (
                  <ListItemButton
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    alignItems="flex-start"
                    sx={{
                      py: 1.25,
                      bgcolor: n.status === 'Unread' ? 'action.hover' : 'transparent',
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <ListItemText
                      primary={n.title}
                      secondary={n.message}
                      primaryTypographyProps={{ fontSize: '0.8125rem', fontWeight: n.status === 'Unread' ? 700 : 500 }}
                      secondaryTypographyProps={{ fontSize: '0.75rem' }}
                    />
                    {n.type === 'ApprovalRequest' && !n.actionStatus && (
                      <Stack direction="row" spacing={0.5} sx={{ ml: 1, mt: 0.25, flexShrink: 0 }}>
                        {actingOnId === n.id ? (
                          <CircularProgress size={20} sx={{ mx: 1 }} />
                        ) : (
                          <>
                            <Tooltip title={t('common.approve', 'Approve')}>
                              <IconButton size="small" color="success" onClick={(e) => handleApprove(e, n.id)}>
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('common.reject', 'Reject')}>
                              <IconButton size="small" color="error" onClick={(e) => handleReject(e, n.id)}>
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </Stack>
                    )}
                    {/* ApprovalResult rows are read-only: the decision text
                        only, never Approve/Reject icons. */}
                    {n.type === 'ApprovalResult' && (
                      <Typography
                        variant="caption"
                        sx={{
                          ml: 1, mt: 0.5, flexShrink: 0, fontWeight: 600,
                          color: /rejected/i.test(n.title) ? 'error.main' : 'success.main',
                        }}
                      >
                        {/rejected/i.test(n.title) ? 'Rejected' : 'Approved'}
                      </Typography>
                    )}
                    {n.type === 'ApprovalRequest' && n.actionStatus && (
                      <Typography
                        variant="caption"
                        sx={{
                          ml: 1, mt: 0.5, flexShrink: 0, fontWeight: 600,
                          // 'Cancelled' (the underlying request was deleted —
                          // see resources.js's STR delete route and
                          // notifications.js's resolveApproval) isn't a
                          // rejection, so it shouldn't read as one in the
                          // same alarming red.
                          color: n.actionStatus === 'Approved'
                            ? 'success.main'
                            : n.actionStatus === 'Cancelled' ? 'text.secondary' : 'error.main',
                        }}
                      >
                        {n.actionStatus}
                      </Typography>
                    )}
                  </ListItemButton>
                ))}
              </List>
            </Menu>

            {/* Profile */}
            <Box
              onClick={(e) => setUserMenuAnchor(e.currentTarget)}
              sx={{
                display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', flexShrink: 0,
                px: { xs: 0.5, sm: 1 }, py: 0.5, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Avatar src={user?.profilePhotoUrl} sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem', fontWeight: 600 }}>
                {user?.name?.charAt(0) || 'U'}
              </Avatar>
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>
                <Typography sx={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.2 }}>{user?.name || 'User'}</Typography>
                <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', lineHeight: 1.2 }}>{user?.role || 'Admin'}</Typography>
              </Box>
              {/* The caret only labels the (hidden) name block -- on a phone it's
              a bare arrow next to an avatar, which reads as clutter. */}
              <KeyboardArrowDownIcon sx={{ fontSize: 16, display: { xs: 'none', md: 'block' } }} />
            </Box>
          </>
        )}

        <Menu anchorEl={userMenuAnchor} open={Boolean(userMenuAnchor)} onClose={() => setUserMenuAnchor(null)} PaperProps={{ sx: { mt: 1, minWidth: 200 } }}>
          <Box sx={{ px: 2, py: 1.5 }}>
            <Typography variant="subtitle2">{user?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => { navigate('/settings/profile'); setUserMenuAnchor(null); }} sx={{ gap: 1.5, fontSize: '0.875rem' }}>
            <PersonIcon fontSize="small" /> {t('common.profile')}
          </MenuItem>
          <MenuItem onClick={() => { navigate('/settings'); setUserMenuAnchor(null); }} sx={{ gap: 1.5, fontSize: '0.875rem' }}>
            <SettingsIcon fontSize="small" /> {t('common.settings')}
          </MenuItem>

          {/* Phone-only: the language options are listed inline rather than
              behind a nested menu. A submenu would have to anchor on a
              MenuItem that unmounts the moment this menu closes, which is
              exactly the kind of dangling-anchor bug worth avoiding. */}
          {isCompact && <Divider key="lang-divider" />}
          {isCompact && (
            <Box key="lang-heading" sx={{ px: 2, pt: 1, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <LanguageIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              <Typography variant="caption" color="text.secondary">{t('common.language')}</Typography>
            </Box>
          )}
          {isCompact && LANGUAGES.map((l) => (
            <MenuItem
              key={`lang-${l.code}`}
              selected={i18n.language === l.code}
              onClick={() => { handleLanguageChange(l.code); setUserMenuAnchor(null); }}
              sx={{ pl: 5.5, fontSize: '0.875rem' }}
            >
              {l.label}
            </MenuItem>
          ))}

          <Divider />
          <MenuItem onClick={handleLogout} sx={{ gap: 1.5, fontSize: '0.875rem', color: 'error.main' }}>
            <LogoutIcon fontSize="small" /> {t('common.logout')}
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
});

export default Header;
