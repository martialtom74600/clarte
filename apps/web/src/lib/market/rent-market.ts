import { rentPerSqm } from "@separation/engine";
import { resolveInseeCodesForPostal } from "@/lib/market/postal-insee";
import {
  CARTE_LOYERS_FALLBACK_YEAR,
  resolveLatestCarteLoyersSource,
} from "@/lib/market/carte-loyers-source";

/** Snapshot loyer €/m²/mois — injecté dans le store puis le moteur (sync). */
export interface RentMarketSnapshot {
  postalCode: string;
  communeCode: string | null;
  communeName: string | null;
  /** Médiane / prédite (loypredm2). */
  medianRentPerSqm: number;
  /** Bas de fourchette (lwr.IPm2) ou médiane × 0,9. */
  minRentPerSqm: number;
  /** Haut de fourchette (upr.IPm2) ou médiane × 1,15. */
  maxRentPerSqm: number;
  source: "carte_loyers" | "fallback";
  /** Millésime Carte des loyers (ex. 2025). */
  asOfYear: number;
  fetchedAt: number;
}

export interface CarteLoyersRow {
  insee: string;
  name: string;
  rentPerSqm: number;
  lowPerSqm: number;
  highPerSqm: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const RENT_ENTRY_COEFF = 0.9;
const RENT_HIGH_COEFF = 1.15;

type CacheEntry = { value: RentMarketSnapshot; expiresAt: number };

const memoryCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<RentMarketSnapshot>>();

let carteIndexPromise: Promise<{
  index: Map<string, CarteLoyersRow>;
  asOfYear: number;
}> | null = null;
let carteIndexOverride: Map<string, CarteLoyersRow> | null = null;

export function clearRentMarketCache(): void {
  memoryCache.clear();
  inflight.clear();
  carteIndexPromise = null;
  carteIndexOverride = null;
}

/** Injection pour tests unitaires. */
export function setCarteLoyersIndexForTests(index: Map<string, CarteLoyersRow> | null): void {
  carteIndexOverride = index;
  carteIndexPromise = null;
}

function cacheGet(postalCode: string): RentMarketSnapshot | null {
  const hit = memoryCache.get(postalCode);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(postalCode);
    return null;
  }
  return hit.value;
}

function cacheSet(value: RentMarketSnapshot): void {
  memoryCache.set(value.postalCode, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function roundRent(n: number): number {
  return Math.round(n * 100) / 100;
}

function bandFromMedian(median: number): {
  medianRentPerSqm: number;
  minRentPerSqm: number;
  maxRentPerSqm: number;
} {
  const medianRentPerSqm = roundRent(median);
  return {
    medianRentPerSqm,
    minRentPerSqm: roundRent(medianRentPerSqm * RENT_ENTRY_COEFF),
    maxRentPerSqm: roundRent(medianRentPerSqm * RENT_HIGH_COEFF),
  };
}

function fallbackSnapshot(postalCode: string): RentMarketSnapshot {
  const median = rentPerSqm(postalCode);
  return {
    postalCode: postalCode.replace(/\D/g, "").slice(0, 5) || postalCode,
    communeCode: null,
    communeName: null,
    ...bandFromMedian(median),
    source: "fallback",
    asOfYear: new Date().getFullYear(),
    fetchedAt: Date.now(),
  };
}

function parseFrNumber(raw: string): number {
  const n = Number(raw.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

/** Parse une ligne CSV Carte des loyers (appartements). */
export function parseCarteLoyersLine(line: string): CarteLoyersRow | null {
  const cells = line.split(";").map((c) => c.replace(/^"|"$/g, "").trim());
  if (cells.length < 9) return null;
  const insee = cells[1];
  const name = cells[2];
  const rent = parseFrNumber(cells[6]);
  const lowPerSqm = parseFrNumber(cells[7]);
  const highPerSqm = parseFrNumber(cells[8]);
  if (!insee || !Number.isFinite(rent) || rent <= 0) return null;
  return {
    insee,
    name,
    rentPerSqm: roundRent(rent),
    lowPerSqm:
      Number.isFinite(lowPerSqm) && lowPerSqm > 0
        ? roundRent(lowPerSqm)
        : roundRent(rent * RENT_ENTRY_COEFF),
    highPerSqm:
      Number.isFinite(highPerSqm) && highPerSqm > 0
        ? roundRent(highPerSqm)
        : roundRent(rent * RENT_HIGH_COEFF),
  };
}

export function buildCarteLoyersIndex(csvText: string): Map<string, CarteLoyersRow> {
  const map = new Map<string, CarteLoyersRow>();
  const lines = csvText.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line) continue;
    const row = parseCarteLoyersLine(line);
    if (row) map.set(row.insee, row);
  }
  return map;
}

async function loadCarteLoyersIndex(
  fetchCsv?: () => Promise<string | null>
): Promise<{ index: Map<string, CarteLoyersRow>; asOfYear: number }> {
  if (carteIndexOverride) {
    return { index: carteIndexOverride, asOfYear: CARTE_LOYERS_FALLBACK_YEAR };
  }
  if (carteIndexPromise) return carteIndexPromise;

  carteIndexPromise = (async () => {
    try {
      let text: string | null = null;
      let asOfYear = CARTE_LOYERS_FALLBACK_YEAR;

      if (fetchCsv) {
        text = await fetchCsv();
      } else {
        const source = await resolveLatestCarteLoyersSource();
        asOfYear = source.year;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 20_000);
        try {
          const res = await fetch(source.url, {
            signal: controller.signal,
            next: { revalidate: 86_400 },
          } as RequestInit);
          if (res.ok) text = await res.text();
        } finally {
          clearTimeout(timer);
        }
      }

      if (!text) return { index: new Map(), asOfYear };
      return { index: buildCarteLoyersIndex(text), asOfYear };
    } catch {
      return { index: new Map(), asOfYear: CARTE_LOYERS_FALLBACK_YEAR };
    }
  })();

  return carteIndexPromise;
}

export interface ResolveRentMarketOptions {
  fetchCsv?: () => Promise<string | null>;
  fetchCommunes?: (
    postalCode: string,
    signal: AbortSignal
  ) => Promise<{ nom: string; code: string }[]>;
  bypassCache?: boolean;
  /** Index préchargé (tests). */
  index?: Map<string, CarteLoyersRow>;
  asOfYear?: number;
}

/**
 * Résout le marché locatif pour un CP (France entière) :
 * dernière Carte des loyers ANIL → barème départemental.
 */
export async function resolveRentMarket(
  postalCode: string,
  options: ResolveRentMarketOptions = {}
): Promise<RentMarketSnapshot> {
  const cp = postalCode.replace(/\D/g, "").slice(0, 5);
  if (cp.length < 5) return fallbackSnapshot(postalCode || "00000");

  if (!options.bypassCache) {
    const cached = cacheGet(cp);
    if (cached) return cached;
    const pending = inflight.get(cp);
    if (pending) return pending;
  }

  const task = (async (): Promise<RentMarketSnapshot> => {
    const loaded =
      options.index != null
        ? {
            index: options.index,
            asOfYear: options.asOfYear ?? CARTE_LOYERS_FALLBACK_YEAR,
          }
        : await loadCarteLoyersIndex(options.fetchCsv);

    const inseeCodes = await resolveInseeCodesForPostal(cp, {
      fetchCommunes: options.fetchCommunes,
    });

    for (const code of inseeCodes) {
      const row = loaded.index.get(code);
      if (!row) continue;
      const snap: RentMarketSnapshot = {
        postalCode: cp,
        communeCode: row.insee,
        communeName: row.name,
        medianRentPerSqm: row.rentPerSqm,
        minRentPerSqm: row.lowPerSqm,
        maxRentPerSqm: row.highPerSqm,
        source: "carte_loyers",
        asOfYear: loaded.asOfYear,
        fetchedAt: Date.now(),
      };
      cacheSet(snap);
      return snap;
    }

    const snap = fallbackSnapshot(cp);
    cacheSet(snap);
    return snap;
  })();

  if (!options.bypassCache) {
    inflight.set(cp, task);
    try {
      return await task;
    } finally {
      inflight.delete(cp);
    }
  }

  return task;
}
