import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatEuroDetailed(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(amount);
}

export const DISCLAIMERS = [
  "Simulation indicative ne constituant pas un conseil juridique, fiscal ou notarial.",
  "Les résultats peuvent varier selon votre convention, contrat de mariage ou décisions de justice.",
  "Consultez un notaire ou avocat avant toute décision patrimoniale.",
];
