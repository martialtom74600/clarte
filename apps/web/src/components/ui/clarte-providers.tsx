"use client";

import { Toaster } from "sonner";
import { clarteToast } from "@/lib/clarte-design";

export function ClarteProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster {...clarteToast} />
    </>
  );
}
