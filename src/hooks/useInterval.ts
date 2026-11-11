import { useEffect, useRef } from 'react';

/**
 * Runs a callback on a fixed interval. Safe for React – clears on unmount.
 * @param callback Function to call every `delay` ms
 * @param delay    Interval in milliseconds (pass null to pause)
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
