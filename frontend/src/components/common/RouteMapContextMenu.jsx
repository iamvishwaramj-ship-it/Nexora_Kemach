import React, { useState } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import RouteMapDialog from './RouteMapDialog';

// Right-click entry point to the Route Map from inside a record's own
// view/edit form — the counterpart to RouteMapButton (which lives in the
// Actions column of the list view). Wrap the form/view content with this
// component and right-clicking anywhere inside it offers "Route Map".
//
// display: 'contents' means this wrapper adds no box of its own — it does
// not affect the layout of the form it wraps, it only listens for the
// context menu event bubbling up from anywhere inside.
//
// @param {'sales'|'purchase'} flow
// @param {string} type   anchor type the backend understands — see RouteMapButton
// @param {string} docNo  the open record's own document number (undefined
//   while creating a new record, since it has no chain to show yet)
export default function RouteMapContextMenu({ flow, type, docNo, children }) {
  const [anchorPosition, setAnchorPosition] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);

  const handleContextMenu = (e) => {
    e.preventDefault();
    setAnchorPosition({ top: e.clientY, left: e.clientX });
  };

  const closeMenu = () => setAnchorPosition(null);

  return (
    <div onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
      {children}
      <Menu
        open={!!anchorPosition}
        onClose={closeMenu}
        anchorReference="anchorPosition"
        anchorPosition={anchorPosition ?? undefined}
      >
        <MenuItem
          disabled={!docNo}
          onClick={() => { closeMenu(); setMapOpen(true); }}
        >
          <ListItemIcon>
            <AccountTreeOutlinedIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{docNo ? 'Relationship Map' : 'Relationship Map (save first)'}</ListItemText>
        </MenuItem>
      </Menu>
      {mapOpen && (
        <RouteMapDialog
          open={mapOpen}
          onClose={() => setMapOpen(false)}
          flow={flow}
          type={type}
          docNo={docNo}
        />
      )}
    </div>
  );
}
