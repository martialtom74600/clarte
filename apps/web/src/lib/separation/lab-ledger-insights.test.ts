import { describe, it, expect } from "vitest";
import {
  debtThresholdMessage,
  normalizeKeepFooterDetail,
  shouldOpenLedgerInsights,
} from "@/lib/separation/lab-ledger-insights";

describe("lab-ledger-insights", () => {
  it("normalise keep_b pour le lecteur (personne A)", () => {
    const detail =
      "Votre endettement sera de 42 % (mensualité totale de 1 200 € / revenus de 2 850 €).\n-> Projet qui dépasse la limite bancaire de 35 %";
    expect(normalizeKeepFooterDetail(detail, "keep_b")).toContain(
      "L'endettement de l'autre sera"
    );
    expect(normalizeKeepFooterDetail(detail, "keep_b")).toContain(
      "pour l'autre"
    );
  });

  it("formule le dépassement HCSF sans doublon séparé", () => {
    expect(debtThresholdMessage(42, "keep_a")).toBe(
      "Votre taux d'endettement (42 %) dépasse le plafond légal de 35 %."
    );
    expect(debtThresholdMessage(42, "keep_b")).toContain("L'endettement de l'autre");
    expect(debtThresholdMessage(30, "keep_a")).toBeUndefined();
  });

  it("ouvre l'accordéon pour verdict serré ou difficile", () => {
    expect(shouldOpenLedgerInsights("orange")).toBe(true);
    expect(shouldOpenLedgerInsights("red")).toBe(true);
    expect(shouldOpenLedgerInsights("green")).toBe(false);
  });
});
