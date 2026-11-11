import { useEffect, useState } from 'react';

/**
 * Returns `value` after it has stopped changing for `delayMs`. Useful for
 * debouncing search inputs and other rapidly-changing values feeding into
 * heavy computations (fuzzy search, network calls, query keys).
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}