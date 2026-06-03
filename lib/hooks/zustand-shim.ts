"use client";

import { useSyncExternalStore } from "react";

type Listener = () => void;
type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;

export interface Store<T> {
  (): T;
  <U>(selector: (state: T) => U): U;
  getState: () => T;
  setState: SetState<T>;
  subscribe: (listener: Listener) => () => void;
}

export function create<T extends object>(
  initializer: (set: SetState<T>, get: () => T) => T,
): Store<T> {
  let state: T;
  const listeners = new Set<Listener>();

  const setState: SetState<T> = (partial) => {
    const next = typeof partial === "function" ? (partial as (s: T) => Partial<T>)(state) : partial;
    state = { ...state, ...next };
    listeners.forEach((l) => l());
  };

  const getState = () => state;

  state = initializer(setState, getState);

  // Stable subscribe function (defined ONCE per store, not per render). React's
  // useSyncExternalStore requires a stable subscribe — if you pass a new
  // function each render, React detaches the old listener and attaches a new
  // one every render, which can silently drop notifications during the
  // transition window. This is the kind of bug that makes store updates
  // appear "not to propagate" to other components.
  const subscribe = (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  function useStore<U = T>(selector?: (state: T) => U): U {
    const getSnapshot = () => (selector ? selector(state) : (state as unknown as U));
    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  const store = useStore as Store<T>;
  store.getState = () => state;
  store.setState = setState;
  store.subscribe = subscribe;
  return store;
}
