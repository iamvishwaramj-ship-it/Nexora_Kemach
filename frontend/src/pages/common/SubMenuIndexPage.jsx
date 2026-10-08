import React from 'react';
import { useSelector } from 'react-redux';
import SubMenuGrid from '../../components/navigation/SubMenuGrid';
import { flatNav } from '../../router/navConfig';
import { visibleNav } from '../../lib/permissions';
import { selectCurrentUser } from '../../store/authSlice';

// Generic card-grid landing page for any nav node with children — top-level
// sections (Company Setup, Product Setup, ...) as well as nested sub-menus
// (Sales > Enquiry, Sales > Follow-up). flatNav includes parents at every
// depth, so any node key with children works here.
//
// Children are filtered to what the signed-in user may view, so this grid
// offers the same set of pages the sidebar does — otherwise someone granted
// only Branch would still see a card for every other Company Setup page and
// hit the "no access" screen on clicking one.
export default function SubMenuIndexPage({ navKey }) {
  const user = useSelector(selectCurrentUser);
  const node = flatNav.find((n) => n.key === navKey);
  if (!node?.children) return null;
  return <SubMenuGrid items={visibleNav(user, node.children)} title={node.labelKey} />;
}
