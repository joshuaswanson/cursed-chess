import { Suspense, lazy } from "react";
import type { ComponentType, JSX } from "react";

const loaders: (() => Promise<unknown>)[] = [];

/**
 * A component whose code is fetched the first time it is drawn, showing
 * nothing until it arrives. Each waits on its own, so one arriving late
 * never blanks what is round it.
 */
export function later<P extends object>(
  load: () => Promise<ComponentType<P>>,
): ComponentType<P> {
  loaders.push(load);
  const Lazy = lazy(async () => ({ default: await load() }));
  return function Later(props: P) {
    return (
      <Suspense fallback={null}>
        <Lazy {...(props as P & JSX.IntrinsicAttributes)} />
      </Suspense>
    );
  };
}

/** Fetches every such component's code while the page sits idle, so none is waited for in play */
export function fetchLaterOnes(): void {
  const fetchAll = () => {
    for (const load of loaders) void load().catch(() => {});
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(fetchAll, { timeout: 4000 });
  } else {
    setTimeout(fetchAll, 1500);
  }
}
