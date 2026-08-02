import { describe, expect, it } from "vitest";
import {
  pickApartmentCsvResource,
  pickLatestCarteLoyersDataset,
  resolveLatestCarteLoyersSource,
  clearCarteLoyersSourceCache,
  CARTE_LOYERS_FALLBACK_YEAR,
} from "@/lib/market/carte-loyers-source";

describe("carte-loyers-source", () => {
  it("choisit le millésime le plus récent", () => {
    const latest = pickLatestCarteLoyersDataset([
      {
        id: "1",
        slug: "carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2023",
        title: "2023",
      },
      {
        id: "2",
        slug: "carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025",
        title: "2025",
      },
      {
        id: "3",
        slug: "carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2024",
        title: "2024",
      },
    ]);
    expect(latest?.slug).toContain("2025");
  });

  it("sélectionne le CSV appartements toutes typologies", () => {
    const resource = pickApartmentCsvResource([
      {
        title: "Indicateur de loyer appartement de 1 ou 2 pièces",
        format: "csv",
        url: "https://example.com/t12.csv",
      },
      {
        title: "Indicateurs de loyer appartement",
        format: "csv",
        url: "https://example.com/app.csv",
      },
      {
        title: "Indicateurs de loyer maison",
        format: "csv",
        url: "https://example.com/mai.csv",
      },
    ]);
    expect(resource?.url).toContain("app.csv");
  });

  it("bascule sur le fallback si data.gouv est down", async () => {
    clearCarteLoyersSourceCache();
    const source = await resolveLatestCarteLoyersSource({
      bypassCache: true,
      fetchJson: async () => {
        throw new Error("network");
      },
    });
    expect(source.year).toBe(CARTE_LOYERS_FALLBACK_YEAR);
    expect(source.url).toMatch(/pred-app/);
  });
});
