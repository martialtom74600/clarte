/**
 * Résout l'URL CSV la plus récente de la Carte des loyers (ANIL / data.gouv).
 * France entière hors Mayotte — actualisation annuelle.
 */

const DATASET_SEARCH =
  "https://www.data.gouv.fr/api/1/datasets/?q=carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune&organization=ministere-de-la-transition-ecologique&page_size=12";

/** Filet si l'API data.gouv est down — millésime 2025. */
export const CARTE_LOYERS_FALLBACK_CSV =
  "https://static.data.gouv.fr/resources/carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025/20251211-145010/pred-app-mef-dhup.csv";

export const CARTE_LOYERS_FALLBACK_YEAR = 2025;

export interface CarteLoyersSource {
  url: string;
  year: number;
  datasetSlug: string;
  title: string;
}

interface DataGouvDatasetListItem {
  id: string;
  slug: string;
  title: string;
  last_modified?: string;
}

interface DataGouvResource {
  title: string;
  format?: string;
  url: string;
  latest?: string;
}

interface DataGouvDatasetDetail {
  slug: string;
  title: string;
  resources: DataGouvResource[];
}

const SLUG_YEAR = /carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-(\d{4})/i;

/** Titre du CSV appartements « toutes typologies » (pas T1-T2, pas T3+, pas maisons). */
function isApartmentAllTypesCsv(title: string): boolean {
  const t = title.toLowerCase();
  if (!t.includes("appartement")) return false;
  if (t.includes("maison")) return false;
  if (t.includes("1 ou 2") || t.includes("1 et 2") || t.includes("t1")) return false;
  if (t.includes("3 pièces") || t.includes("3 piece") || t.includes("t3")) return false;
  return true;
}

let cachedSource: { value: CarteLoyersSource; expiresAt: number } | null = null;
const SOURCE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function clearCarteLoyersSourceCache(): void {
  cachedSource = null;
}

export function pickLatestCarteLoyersDataset(
  items: DataGouvDatasetListItem[]
): DataGouvDatasetListItem | null {
  let best: { item: DataGouvDatasetListItem; year: number } | null = null;
  for (const item of items) {
    const m = item.slug.match(SLUG_YEAR) ?? item.title.match(/en\s+(\d{4})/i);
    if (!m) continue;
    const year = Number(m[1]);
    if (!best || year > best.year) best = { item, year };
  }
  return best?.item ?? null;
}

export function pickApartmentCsvResource(
  resources: DataGouvResource[]
): DataGouvResource | null {
  const csv = resources.filter(
    (r) =>
      (r.format?.toLowerCase() === "csv" || r.url.toLowerCase().endsWith(".csv")) &&
      isApartmentAllTypesCsv(r.title)
  );
  return csv[0] ?? null;
}

/**
 * Découvre le millésime le plus récent sur data.gouv, sinon fallback 2025 embarqué.
 */
export async function resolveLatestCarteLoyersSource(options?: {
  fetchJson?: (url: string) => Promise<unknown>;
  bypassCache?: boolean;
}): Promise<CarteLoyersSource> {
  if (!options?.bypassCache && cachedSource && Date.now() < cachedSource.expiresAt) {
    return cachedSource.value;
  }

  const fetchJson =
    options?.fetchJson ??
    (async (url: string) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          next: { revalidate: 86_400 },
        } as RequestInit);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timer);
      }
    });

  const fallback: CarteLoyersSource = {
    url: CARTE_LOYERS_FALLBACK_CSV,
    year: CARTE_LOYERS_FALLBACK_YEAR,
    datasetSlug: "carte-des-loyers-indicateurs-de-loyers-dannonce-par-commune-en-2025",
    title: "Carte des loyers (fallback 2025)",
  };

  try {
    const list = (await fetchJson(DATASET_SEARCH)) as { data?: DataGouvDatasetListItem[] };
    const latest = pickLatestCarteLoyersDataset(list.data ?? []);
    if (!latest) {
      cachedSource = { value: fallback, expiresAt: Date.now() + SOURCE_TTL_MS };
      return fallback;
    }

    const yearMatch = latest.slug.match(SLUG_YEAR);
    const year = yearMatch ? Number(yearMatch[1]) : CARTE_LOYERS_FALLBACK_YEAR;

    const detail = (await fetchJson(
      `https://www.data.gouv.fr/api/1/datasets/${latest.slug}/`
    )) as DataGouvDatasetDetail;

    const resource = pickApartmentCsvResource(detail.resources ?? []);
    if (!resource?.url) {
      cachedSource = { value: fallback, expiresAt: Date.now() + SOURCE_TTL_MS };
      return fallback;
    }

    const value: CarteLoyersSource = {
      url: resource.latest ?? resource.url,
      year,
      datasetSlug: latest.slug,
      title: latest.title,
    };
    cachedSource = { value, expiresAt: Date.now() + SOURCE_TTL_MS };
    return value;
  } catch {
    cachedSource = { value: fallback, expiresAt: Date.now() + SOURCE_TTL_MS };
    return fallback;
  }
}
