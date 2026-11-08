import { useEffect, useRef } from "react";

/** Calls `onTick(elapsedSeconds)` every animation frame while `running` is true. */
export function useAnimationFrame(running: boolean, onTick: (dt: number) => void): void {
  const tick = useRef(onTick);
  tick.current = onTick;
  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let id = requestAnimationFrame(function loop(now) {
      tick.current((now - last) / 1000);
      last = now;
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, [running]);
}
