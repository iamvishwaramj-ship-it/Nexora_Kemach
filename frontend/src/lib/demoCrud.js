import { useCallback, useEffect, useState } from 'react';
import { isDemoMode } from './demoMode';

// Wraps a createCrudApi()-shaped api object ({ useList, useGet, useCreate,
// useUpdate, useDelete, ... }) so a handful of Production Planning demo
// screens can show fixed, offline data during a client demo instead of
// hitting the real backend. When demo mode is off (the default — see
// demoMode.js), withDemoCrud returns `realApi` completely untouched, so
// every screen that uses it behaves exactly as it does today. This file
// never modifies createCrudApi.js, the real api objects, or any backend
// code — it only ever substitutes what a SCREEN sees, and only when demo
// mode is explicitly on.
//
// One in-memory store per seed array (keyed by that array's own identity),
// so a screen's useList/useCreate/useUpdate/useDelete calls all read and
// mutate the same rows, and the on-screen table updates immediately after a
// demo Save/Delete — the minimum needed for Save/Delete to look real in a
// live demo, without pulling in a state-management library. Nothing here
// is persisted anywhere: a page refresh resets back to the seed data, which
// is the right behavior for a demo fixture, not a real record.
const stores = new WeakMap();

function getStore(seedRows) {
  let store = stores.get(seedRows);
  if (!store) {
    store = { rows: seedRows.map((r) => ({ ...r })), listeners: new Set() };
    stores.set(seedRows, store);
  }
  return store;
}

function notify(store) {
  store.listeners.forEach((listener) => listener());
}

function nextId(store) {
  return (store.rows.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) || 0) + 1;
}

function useDemoList(seedRows) {
  const store = getStore(seedRows);
  const [rows, setRows] = useState(store.rows);
  useEffect(() => {
    const listener = () => setRows(store.rows);
    store.listeners.add(listener);
    return () => store.listeners.delete(listener);
  }, [store]);
  // Same shape callers already destructure ({ data, isLoading }) from the
  // real useList/useListQuery hook.
  return { data: rows, isLoading: false, isFetching: false, refetch: () => {} };
}

function useDemoGet(seedRows, id) {
  const { data } = useDemoList(seedRows);
  return { data: (data || []).find((r) => String(r.id) === String(id)), isLoading: false };
}

function useDemoCreate(seedRows) {
  const store = getStore(seedRows);
  const trigger = useCallback(
    (body) => {
      const row = { id: nextId(store), ...body };
      store.rows = [...store.rows, row];
      notify(store);
      return { unwrap: () => Promise.resolve(row) };
    },
    [store],
  );
  return [trigger, { isLoading: false }];
}

function useDemoUpdate(seedRows) {
  const store = getStore(seedRows);
  const trigger = useCallback(
    ({ id, ...body }) => {
      store.rows = store.rows.map((r) => (String(r.id) === String(id) ? { ...r, ...body } : r));
      notify(store);
      const row = store.rows.find((r) => String(r.id) === String(id));
      return { unwrap: () => Promise.resolve(row) };
    },
    [store],
  );
  return [trigger, { isLoading: false }];
}

function useDemoDelete(seedRows) {
  const store = getStore(seedRows);
  const trigger = useCallback(
    (id) => {
      store.rows = store.rows.filter((r) => String(r.id) !== String(id));
      notify(store);
      return { unwrap: () => Promise.resolve({ id }) };
    },
    [store],
  );
  return [trigger, { isLoading: false }];
}

// Mirrors the real productionOrderApi.useCancel() hook used by
// ViewOrder.jsx's Cancel action: marks the row cancelled in place (rather
// than removing it, since a cancelled order is still shown, just flagged)
// without any real database write or downstream transaction.
function useDemoCancel(seedRows) {
  const store = getStore(seedRows);
  const trigger = useCallback(
    (id) => {
      store.rows = store.rows.map((r) =>
        String(r.id) === String(id) ? { ...r, isCancelled: true, status: 'Cancelled' } : r,
      );
      notify(store);
      const row = store.rows.find((r) => String(r.id) === String(id));
      return { unwrap: () => Promise.resolve(row) };
    },
    [store],
  );
  return [trigger, { isLoading: false }];
}

// `isDemoMode()` is a fixed build-time constant (see demoMode.js), not
// something that changes between renders within one running app, so which
// branch below a given hook call takes never changes mid-session — the set
// of hooks React sees called stays consistent, satisfying the rules of
// hooks.
export function withDemoCrud(realApi, seedRows) {
  if (!isDemoMode()) return realApi;
  return {
    ...realApi,
    useList: () => useDemoList(seedRows),
    useGet: (id) => useDemoGet(seedRows, id),
    useCreate: () => useDemoCreate(seedRows),
    useUpdate: () => useDemoUpdate(seedRows),
    useDelete: () => useDemoDelete(seedRows),
    useCancel: () => useDemoCancel(seedRows),
  };
}
