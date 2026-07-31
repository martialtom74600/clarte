"use client";

import { useEffect, useState } from "react";
import { usePathname, useSelectedLayoutSegments } from "next/navigation";
import { ClarteHeaderPublic } from "./clarte-header";
import { ClarteFooter } from "./clarte-footer";

function shouldHidePublicChrome(pathname: string, segments: string[]): boolean {
  const rootSegment = segments[0];
  if (rootSegment === "simulation" || rootSegment === "pro" || rootSegment === "embed") {
    return true;
  }
  return (
    pathname.startsWith("/simulation") ||
    pathname.startsWith("/pro") ||
    pathname.startsWith("/embed")
  );
}

/**
 * Header/footer publics — rendus uniquement après montage client pour éviter
 * un mismatch d'hydratation (usePathname / segments instables au 1er paint).
 */
export function ClartePublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const segments = useSelectedLayoutSegments();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const hideChrome = shouldHidePublicChrome(pathname, segments);

  if (!mounted || hideChrome) {
    return <>{children}</>;
  }

  return (
    <>
      <ClarteHeaderPublic />
      {children}
      <ClarteFooter />
    </>
  );
}
