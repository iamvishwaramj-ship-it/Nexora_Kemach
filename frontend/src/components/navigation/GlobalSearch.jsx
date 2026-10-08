import React, { useState } from 'react';
import { Autocomplete, TextField, InputAdornment, Box, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { flatNav } from '../../router/navConfig';
import { getNavIcon } from '../../router/iconMap';
import { selectCurrentUser } from '../../store/authSlice';
import { isAdmin, can } from '../../lib/permissions';

// Global search in the top navbar: searches across menu items AND sub-menu
// items so a user can jump straight to a feature by typing its name.
//
// `fullWidth`/`autoFocus`/`onNavigate` exist for the mobile navbar, where the
// field isn't permanently on screen -- it's revealed as a full-width row by a
// search icon, wants focus the moment it appears, and has to tell the header
// to close that row again once the user picks a result.
export default function GlobalSearch({ fullWidth = false, autoFocus = false, onNavigate }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSelector(selectCurrentUser);
  const admin = isAdmin(user);
  const [inputValue, setInputValue] = useState('');

  // A hidden menu (and anything under it, via its `trail`) stays out of
  // search results too — see the `hidden` note on visibleNav() in
  // lib/permissions.js.
  //
  // canView is checked here as well, on every leaf's own menu key, exactly
  // like the sidebar's visibleNav() does — otherwise a page hidden from the
  // sidebar by permission was still one search-and-click away, which is the
  // whole point of restricting it in the first place. A leaf with no `key`
  // (shouldn't happen per navConfig's shape comment, but stay defensive) is
  // treated as ungoverned/permitted, same as usePermissions() does.
  const options = flatNav.filter((n) => (!n.isParent || !n.children)
    && !n.trail?.some((t) => t.hidden)
    && (admin || !n.key || can(user, n.key, 'canView')));

  return (
    <Autocomplete
      size="small"
      options={options}
      inputValue={inputValue}
      onInputChange={(_e, v) => setInputValue(v)}
      getOptionLabel={(o) => (o.labelKey?.startsWith('nav.') ? t(o.labelKey) : o.labelKey) || ''}
      noOptionsText={t('common.noResults')}
      onChange={(_e, value) => {
        if (value) {
          navigate(value.path);
          setInputValue('');
          onNavigate?.();
        }
      }}
      renderOption={(props, option) => {
        const Icon = getNavIcon(option.icon);
        const trailLabel = option.trail?.slice(0, -1).map((n) => (n.labelKey?.startsWith('nav.') ? t(n.labelKey) : n.labelKey)).join(' / ');
        return (
          <Box component="li" {...props} key={option.path} sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            <Icon fontSize="small" color="action" />
            <Box>
              <Typography variant="body2">{option.labelKey?.startsWith('nav.') ? t(option.labelKey) : option.labelKey}</Typography>
              {trailLabel && <Typography variant="caption" color="text.secondary">{trailLabel}</Typography>}
            </Box>
          </Box>
        );
      }}
      sx={{ width: fullWidth ? '100%' : { sm: 240, md: 340 } }}
      renderInput={(params) => (
        <TextField
          {...params}
          autoFocus={autoFocus}
          placeholder={t('common.searchPlaceholder')}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      )}
    />
  );
}
