"use client";

import { usePathname } from "next/navigation";
import { ClarteHeaderPublic } from "./clarte-header";
import { ClarteFooter } from "./clarte-footer";

/** Affiche header/footer public sauf sur /pro/* (géré par pro/layout). */
export function ClartePublicChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPro = pathname.startsWith("/pro");
  const isEmbed = pathname.startsWith("/embed");

  if (isPro || isEmbed) {
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
