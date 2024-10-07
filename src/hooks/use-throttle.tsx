import { useCallback, useRef } from "react";

export function useThrottle(
  callback: (...args: unknown[]) => void,
  limit: number,
) {
  const lastCallRef = useRef<number>(0);

  return useCallback(
    (...args: unknown[]) => {
      const now = Date.now();
      /* const force = typeof window !== "undefined" && window.scrollY < 100;

      if (force) {
        console.log("force", Date.now());
      } */
      if (/* force || */ now - lastCallRef.current >= limit) {
        lastCallRef.current = now;
        callback(...args);
      }
    },
    [callback, limit],
  );
}
