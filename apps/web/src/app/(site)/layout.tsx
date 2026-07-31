import { ClarteFooter, ClarteHeaderPublic } from "@/components/ui";

/** Pages marketing publiques — header + footer (hors funnel /simulation). */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ClarteHeaderPublic />
      {children}
      <ClarteFooter />
    </>
  );
}
