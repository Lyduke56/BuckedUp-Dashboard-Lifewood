"use client";

import { useEffect, useState } from "react";

// Portals render into document.body, which doesn't exist during SSR —
// this defers portal rendering until after the first client-side render,
// avoiding a hydration mismatch. Mount detection is one of the few
// sanctioned uses of setState directly in an effect (not derived state,
// there's no other way to know we're past the first client render).
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  return mounted;
}
