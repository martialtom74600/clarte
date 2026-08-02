import {
  buyPriceBandFromMedian,
  deptFromPostal,
  pricePerSqmForDept,
  samplePostalsForDept,
} from "@separation/engine";

/** Snapshot achat €/m² — injecté dans le store puis le moteur (sync). */
export interface BuyMarketSnapshot {
  postalCode: string;
  medianPricePerSqm: number;
  minPricePerSqm: number;
  maxPricePerSqm: number;
  source: "dvf" | "dvf_dept" | "fallback";
  transactionCount: number;
  /** Année de référence indicative (DVF live → année courante). */
  asOfYear: number;
  fetchedAt: number;
}

export interface DvfRecord {
  valeur_fonciere?: number;
  surface_reelle_bati?: number;
  code_postal?: string;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 2500;
const MIN_TRANSACTIONS = 5;
const DEFAULT_DVF_BASE = "https://api.cquest.org/dvf";

type CacheEntry = { value: BuyMarketSnapshot; expiresAt: number };

const memoryCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<BuyMarketSnapshot>>();

export function clearBuyMarketCache(): void {
  memoryCache.clear();
  inflight.clear();
}

function cacheGet(postalCode: string): BuyMarketSnapshot | null {
  const hit = memoryCache.get(postalCode);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    memoryCache.delete(postalCode);
    return null;
  }
  return hit.value;
}

function cacheSet(value: BuyMarketSnapshot): void {
  memoryCache.set(value.postalCode, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function bandFromMedian(
  postalCode: string,
  median: number,
  source: BuyMarketSnapshot["source"],
  transactionCount: number
): BuyMarketSnapshot {
  const band = buyPriceBandFromMedian(median);
  return {
    postalCode,
    ...band,
    source,
    transactionCount,
    asOfYear: new Date().getFullYear(),
    fetchedAt: Date.now(),
  };
}

function fallbackSnapshot(postalCode: string): BuyMarketSnapshot {
  const dept = deptFromPostal(postalCode);
  const median = pricePerSqmForDept(dept);
  return bandFromMedian(
    postalCode.replace(/\D/g, "").slice(0, 5) || postalCode,
    median,
    "fallback",
    0
  );
}

/** Parse une réponse DVF brute → médiane €/m² si assez de transactions. */
export function medianPriceFromDvfRecords(
  data: DvfRecord[],
  minTransactions = MIN_TRANSACTIONS
): { median: number; count: number } | null {
  const prices = data
    .filter(
      (r) =>
        r.valeur_fonciere != null &&
        r.valeur_fonciere > 0 &&
        r.surface_reelle_bati != null &&
        r.surface_reelle_bati > 10
    )
    .map((r) => r.valeur_fonciere! / r.surface_reelle_bati!)
    .sort((a, b) => a - b);

  if (prices.length < minTransactions) return null;
  return {
    median: Math.round(prices[Math.floor(prices.length / 2)]),
    count: prices.length,
  };
}

type FetchDvfFn = (postalCode: string, signal: AbortSignal) => Promise<DvfRecord[] | null>;

async function defaultFetchDvf(
  postalCode: string,
  signal: AbortSignal
): Promise<DvfRecord[] | null> {
  const url = `${DEFAULT_DVF_BASE}?code_postal=${encodeURIComponent(postalCode)}&limit=120`;
  try {
    const response = await fetch(url, {
      signal,
      next: { revalidate: 86400 },
    } as RequestInit);
    if (!response.ok) return null;
    return (await response.json()) as DvfRecord[];
  } catch {
    return null;
  }
}

async function fetchMedianForPostal(
  postalCode: string,
  fetchDvf: FetchDvfFn
): Promise<{ median: number; count: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const data = await fetchDvf(postalCode, controller.signal);
    if (!data) return null;
    return medianPriceFromDvfRecords(data);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export interface ResolveBuyMarketOptions {
  /** Injection de fetch pour les tests (panne réseau, etc.). */
  fetchDvf?: FetchDvfFn;
  /** Ignore le cache mémoire. */
  bypassCache?: boolean;
}

/**
 * Résout le marché achat pour un CP (France entière) :
 * commune DVF → échantillons départementaux DVF → barème 101 départements.
 */
export async function resolveBuyMarket(
  postalCode: string,
  options: ResolveBuyMarketOptions = {}
): Promise<BuyMarketSnapshot> {
  const cp = postalCode.replace(/\D/g, "").slice(0, 5);
  if (cp.length < 5) return fallbackSnapshot(postalCode || "00000");

  if (!options.bypassCache) {
    const cached = cacheGet(cp);
    if (cached) return cached;
    const pending = inflight.get(cp);
    if (pending) return pending;
  }

  const fetchDvf = options.fetchDvf ?? defaultFetchDvf;

  const task = (async (): Promise<BuyMarketSnapshot> => {
    const commune = await fetchMedianForPostal(cp, fetchDvf);
    if (commune) {
      const snap = bandFromMedian(cp, commune.median, "dvf", commune.count);
      cacheSet(snap);
      return snap;
    }

    const dept = deptFromPostal(cp);
    const samples = samplePostalsForDept(dept, cp).filter((p) => p !== cp);
    for (const sample of samples) {
      const deptResult = await fetchMedianForPostal(sample, fetchDvf);
      if (deptResult) {
        const snap = bandFromMedian(cp, deptResult.median, "dvf_dept", deptResult.count);
        cacheSet(snap);
        return snap;
      }
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
