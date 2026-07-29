import type { Metadata } from "next";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { Header, Footer } from "@/components/layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clarté — Simulateur patrimonial de séparation",
  description:
    "Comprenez votre situation financière lors d'une séparation : soulte, partage immobilier, dettes et épargne. Simulation gratuite et rassurante.",
  keywords: [
    "séparation",
    "soulte",
    "simulateur",
    "divorce",
    "PACS",
    "concubinage",
    "patrimoine",
  ],
  openGraph: {
    title: "Clarté — Simulateur patrimonial de séparation",
    description: "Estimez votre soulte et vos scénarios en 8 minutes.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen flex flex-col antialiased">
        <AnalyticsProvider>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </AnalyticsProvider>
      </body>
    </html>
  );
}
