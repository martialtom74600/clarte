"use client";

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

/** Affiche header/footer public sauf sur /pro/*, /embed/* et /simulation/* (funnel immersif). */
export function ClartePublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const segments = useSelectedLayoutSegments();
  const hideChrome = shouldHidePublicChrome(pathname, segments);

  if (hideChrome) {
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
