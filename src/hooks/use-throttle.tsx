import { useCallback, useRef } from "react";

export function useThrottle(
  callback: (...args: unknown[]) => void,
  limit: number,
) {
  const lastCallRef = useRef<number>(0);
  return useCallback(
    (...args: unknown[]) => {
      const now = Date.now();
      if (now - lastCallRef.current >= limit) {
        lastCallRef.current = now;
        callback(...args);
      }
    },
    [callback, limit],
  );
}
