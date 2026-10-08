import React from 'react';
import { useOutlet, useLocation } from 'react-router-dom';
import { TabPathProvider } from './TabPathContext';

// Chrome-style tabs are pointless if switching away and back resets the page
// -- a half-filled form should look exactly as the user left it, not bounce
// back to a blank/list view. React Router's default <Outlet/> unmounts the
// previous route's component the instant the URL changes, which throws away
// all of that local/form state. This keeps every open tab's rendered
// element mounted in the tree permanently (just hidden via CSS) instead of
// unmounting it, so switching tabs is purely visual.
//
// openPaths (the redux tabs list) is used only to prune entries once a tab
// is actually closed -- otherwise every page ever visited would stay in
// memory for the life of the session.
export default function KeepAliveOutlet({ openPaths }) {
  const location = useLocation();
  const outlet = useOutlet();
  const cacheRef = React.useRef(new Map()); // pathname -> rendered element

  const pathname = location.pathname;

  if (outlet) {
    cacheRef.current.set(pathname, outlet);
  }

  if (openPaths) {
    const keep = new Set(openPaths);
    keep.add(pathname); // never prune the page currently on screen
    for (const key of Array.from(cacheRef.current.keys())) {
      if (!keep.has(key)) cacheRef.current.delete(key);
    }
  }

  return (
    <>
      {Array.from(cacheRef.current.entries()).map(([path, element]) => (
        <div key={path} style={{ display: path === pathname ? 'block' : 'none' }}>
          <TabPathProvider path={path}>{element}</TabPathProvider>
        </div>
      ))}
    </>
  );
}
