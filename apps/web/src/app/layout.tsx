import type { Metadata } from "next";
import { AnalyticsProvider } from "@/components/analytics-provider";
import { ClarteProviders, ClartePublicChrome } from "@/components/ui";
import { clarte } from "@/lib/clarte-design";
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
      <body className={`flex min-h-screen flex-col antialiased ${clarte.mesh}`}>
        <AnalyticsProvider>
          <ClarteProviders>
            <ClartePublicChrome>{children}</ClartePublicChrome>
          </ClarteProviders>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
