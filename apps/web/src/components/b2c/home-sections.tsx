"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, Users, Shield } from "lucide-react";
import { staggerContainer, staggerItem, spring } from "@/lib/motion";
import { clarte, clarteGlassCard } from "@/lib/clarte-design";
import { cn } from "@/lib/utils";

export function HomeHero() {
  return (
    <section className={`${clarte.hero} relative overflow-hidden text-white`}>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_80%_20%,rgba(255,255,255,0.08),transparent)]" />
      <div className="relative mx-auto max-w-6xl px-4 py-20 md:py-28">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <p className="mb-4 text-sm font-medium uppercase tracking-wider text-brand-200">
            Réorganisation patrimoniale
          </p>
          <h1 className="text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Comprenez votre situation financière en 8 minutes
          </h1>
          <p className="mt-6 text-lg text-brand-100">
            Soulte, partage immobilier, dettes et épargne — sans avocat, sans jugement, avec des
            chiffres clairs.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} transition={spring.snappy}>
              <Link
                href="/simulation"
                className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-brand-800 shadow-lg hover:bg-brand-50 transition-colors"
              >
                Estimer ma situation
                <ArrowRight className="h-5 w-5" />
              </Link>
            </motion.div>
            <Link
              href="/simulateur-soulte"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 px-8 py-4 font-medium hover:bg-white/10 transition-colors"
            >
              En savoir plus
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export function HomeFeatures() {
  const features = [
    {
      icon: Sparkles,
      title: "Résultat en 90 secondes",
      desc: "Estimez votre soulte avant même de saisir votre email.",
    },
    {
      icon: Users,
      title: "Double miroir",
      desc: "Visualisez la part de chacun en temps réel. Approche équilibrée.",
    },
    {
      icon: Shield,
      title: "Confidentialité d'abord",
      desc: "Données locales. Mode discret. RGPD compliant.",
    },
  ];

  return (
    <section className={`${clarte.mesh} ${clarte.container} py-16`}>
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-80px" }}
        className="grid gap-6 md:grid-cols-3"
      >
        {features.map((f) => (
          <motion.div
            key={f.title}
            variants={staggerItem}
            className={cn(clarteGlassCard, "p-8 transition-shadow hover:shadow-lg")}
          >
            <f.icon className="mb-4 h-10 w-10 text-brand-600" />
            <h3 className="text-lg font-semibold text-slate-900">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{f.desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}

export function HomeCta() {
  return (
    <section className="border-y border-slate-200/60 bg-white/40 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.4 }}
        className="mx-auto max-w-6xl px-4 py-16 text-center"
      >
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Concubinage, PACS ou Mariage
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-slate-600">
          Notre moteur adapte les règles de répartition selon votre statut et régime matrimonial.
        </p>
        <motion.div className="mt-8" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="/simulation"
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-8 py-4 font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
          >
            Démarrer gratuitement
            <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
