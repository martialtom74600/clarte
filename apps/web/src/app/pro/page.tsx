import { redirect } from "next/navigation";
import { requirePartnerSession } from "@/lib/partner-auth";
import { DashboardCards } from "@/components/pro/dashboard-cards";

export default async function PartnerDashboardPage() {
  const session = await requirePartnerSession();
  if (!session) redirect("/pro/login");

  const { partner, user } = session;

  return (
    <DashboardCards
      userName={user.full_name}
      companyName={partner.company_name}
      creditBalance={partner.credit_balance}
      geoZones={partner.geo_zones}
      partnerType={partner.type}
    />
  );
}
