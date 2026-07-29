import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Séparation immobilière et soulte — Guide complet",
  description:
    "Guide complet sur la séparation immobilière : soulte, partage, crédit, régimes matrimoniaux.",
};

export default function SeparationImmobilierePage() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-4xl font-bold text-slate-900">
        Séparation immobilière : soulte et partage
      </h1>
      <p className="mt-6 text-lg text-slate-600">
        Le logement est souvent l&apos;enjeu principal d&apos;une séparation. Que vous
        soyez concubins, pacsés ou mariés, les règles de partage diffèrent.
      </p>
      <Link href="/simulation" className="mt-8 inline-block text-brand-600 font-semibold hover:underline">
        Lancer la simulation →
      </Link>
    </article>
  );
}
