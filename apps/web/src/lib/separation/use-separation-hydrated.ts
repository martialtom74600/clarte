"use client";

import { useSyncExternalStore } from "react";
import { useSeparationStore } from "@/store/separation-store";

export function useSeparationHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      return useSeparationStore.persist.onFinishHydration(onStoreChange);
    },
    () =>
      typeof window === "undefined" ? false : useSeparationStore.persist.hasHydrated(),
    () => false
  );
}
