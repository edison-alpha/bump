"use client";

import { useEffect, useState } from "react";

/**
 * useState that persists to localStorage. Hydration-safe: the first render always uses
 * `initial`, stored data is applied after mount and `ready` flips to true.
 */
export function useLocalStorageState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) setValue({ ...initial, ...JSON.parse(raw) });
    } catch {
      /* storage blocked or corrupt: keep initial */
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / private mode */
    }
  }, [key, value, ready]);

  return [value, setValue, ready] as const;
}
