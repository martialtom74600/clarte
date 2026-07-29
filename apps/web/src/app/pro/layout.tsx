import { requirePartnerSession } from "@/lib/partner-auth";
import { ClarteHeaderPro } from "@/components/ui";
import { clarte } from "@/lib/clarte-design";

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePartnerSession();

  if (!session) {
    return <>{children}</>;
  }

  return (
    <div className={`min-h-screen ${clarte.mesh}`}>
      <ClarteHeaderPro creditBalance={session.partner.credit_balance} />
      <main className={`${clarte.container} py-8`}>{children}</main>
    </div>
  );
}
