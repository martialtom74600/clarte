"use client";

import { useEffect } from "react";
import { initPostHog } from "@/lib/analytics";

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return <>{children}</>;
}
