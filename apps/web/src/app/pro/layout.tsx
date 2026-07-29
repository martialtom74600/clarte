import Link from "next/link";
import { requirePartnerSession } from "@/lib/partner-auth";
import { PartnerNav } from "@/components/partner/partner-nav";

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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link href="/pro" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 font-bold text-sm">
              C
            </div>
            <span className="font-semibold">Clarté Pro</span>
          </Link>
          <PartnerNav />
          <div className="text-sm text-slate-300">
            {session.partner.credit_balance} crédits
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
