"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { PartnerNav } from "@/components/partner/partner-nav";
import { CreditCounter } from "@/components/pro/credit-counter";
import { CommandMenu } from "@/components/pro/command-menu";
import { ClarteLogo, ClarteLogoPro } from "./clarte-logo";
import { clarte } from "@/lib/clarte-design";
import { spring } from "@/lib/motion";

const PUBLIC_LINKS = [
  { href: "/simulateur-soulte", label: "Simulateur soulte" },
  { href: "/separation-pacs", label: "Séparation PACS" },
  { href: "/concubinage-indivision", label: "Concubinage" },
];

export function ClarteHeaderPublic() {
  return (
    <header
      className={`sticky top-0 z-50 border-b border-slate-200/60 ${clarte.headerLight}`}
    >
      <div className={`${clarte.container} flex items-center justify-between py-4`}>
        <Link href="/">
          <ClarteLogo />
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-slate-600 md:flex">
          {PUBLIC_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="transition-colors hover:text-brand-600">
              {link.label}
            </Link>
          ))}
          <Link href="/pro/login" className="transition-colors hover:text-brand-600">
            Espace Pro
          </Link>
        </nav>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring.snappy}>
          <Link href="/simulation" className={`px-5 py-2.5 text-sm ${clarte.btnPrimary}`}>
            Démarrer
          </Link>
        </motion.div>
      </div>
    </header>
  );
}

export function ClarteHeaderPro({ creditBalance }: { creditBalance: number }) {
  return (
    <header className={`sticky top-0 z-40 border-b border-white/10 ${clarte.headerDark}`}>
      <div className={`${clarte.container} flex items-center justify-between gap-4 py-4`}>
        <Link href="/pro" className="shrink-0">
          <ClarteLogoPro />
        </Link>
        <PartnerNav />
        <div className="flex shrink-0 items-center gap-3">
          <CommandMenu />
          <CreditCounter balance={creditBalance} />
        </div>
      </div>
    </header>
  );
}
