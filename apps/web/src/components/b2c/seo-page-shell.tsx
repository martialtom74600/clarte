import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { clarte, clarteGlassCard } from "@/lib/clarte-design";

interface SeoPageShellProps {
  title: string;
  children: React.ReactNode;
  ctaLabel?: string;
}

export function SeoPageShell({
  title,
  children,
  ctaLabel = "Estimer ma situation gratuitement",
}: SeoPageShellProps) {
  return (
    <article className={`${clarte.containerNarrow} py-16`}>
      <div className={`${clarteGlassCard} ${clarte.radiusLg} p-8 md:p-12`}>
        <h1 className="text-4xl font-bold tracking-tight text-slate-900">{title}</h1>
        <div className="prose prose-slate mt-6 max-w-none text-slate-600">{children}</div>
        <Link
          href="/simulation"
          className={`mt-10 inline-flex items-center gap-2 px-8 py-4 ${clarte.btnPrimary}`}
        >
          {ctaLabel}
          <ArrowRight className="h-5 w-5" />
        </Link>
      </div>
    </article>
  );
}
