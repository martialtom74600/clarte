"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Coins, LayoutGrid, ShoppingBag } from "lucide-react";
import { StaggerList, StaggerItem } from "@/components/ui";
import { clarteGlassCard } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";
import { scaleTap } from "@/lib/motion";

interface DashboardCardsProps {
  userName: string | null;
  companyName: string;
  creditBalance: number;
  geoZones: string[];
  partnerType: string;
}

export function DashboardCards({
  userName,
  companyName,
  creditBalance,
  geoZones,
  partnerType,
}: DashboardCardsProps) {
  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32 }}
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Bonjour{userName ? `, ${userName}` : ""}
        </h1>
        <p className="mt-1 text-slate-600">{companyName}</p>
      </motion.div>

      <StaggerList className="mt-8 grid gap-4 md:grid-cols-3">
        <StaggerItem>
          <div className={cn(clarteGlassCard, "p-6")}>
            <Coins className="mb-3 h-8 w-8 text-brand-600" />
            <p className="text-sm text-slate-500">Solde crédits</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{creditBalance}</p>
          </div>
        </StaggerItem>
        <StaggerItem>
          <motion.div {...scaleTap}>
            <Link href="/pro/leads" className={cn(clarteGlassCard, "block p-6 hover:shadow-lg transition-shadow")}>
              <LayoutGrid className="mb-3 h-8 w-8 text-brand-600" />
              <p className="font-semibold text-slate-900">Mur de leads</p>
              <p className="mt-1 text-sm text-slate-600">Prospects qualifiés dans votre zone</p>
            </Link>
          </motion.div>
        </StaggerItem>
        <StaggerItem>
          <motion.div {...scaleTap}>
            <Link href="/pro/purchases" className={cn(clarteGlassCard, "block p-6 hover:shadow-lg transition-shadow")}>
              <ShoppingBag className="mb-3 h-8 w-8 text-brand-600" />
              <p className="font-semibold text-slate-900">Mes achats</p>
              <p className="mt-1 text-sm text-slate-600">Contacts débloqués</p>
            </Link>
          </motion.div>
        </StaggerItem>
      </StaggerList>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.32 }}
        className={cn(clarteGlassCard, "mt-8 border-brand-200/50 bg-brand-50/50 p-6")}
      >
        <p className="text-sm text-brand-800">
          Zones actives : {geoZones.join(", ") || "—"} · Profil : {partnerType}
        </p>
        <Link
          href="/pro/credits"
          className="mt-4 inline-block text-sm font-medium text-brand-700 hover:underline"
        >
          Acheter des crédits →
        </Link>
      </motion.div>
    </div>
  );
}
