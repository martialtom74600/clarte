/**
 * Mapping CP → codes INSEE candidats (arrondissements + geo.api.gouv.fr).
 */

/** Paris / Lyon / Marseille : le CP d'arrondissement → code INSEE d'arrondissement. */
export function arrondissementInseeFromPostal(postalCode: string): string | null {
  const cp = postalCode.replace(/\D/g, "").slice(0, 5);
  if (cp.length !== 5) return null;

  const paris = cp.match(/^750(0[1-9]|1[0-9]|20)$/);
  if (paris) return `751${paris[1]}`;

  const marseille = cp.match(/^130(0[1-9]|1[0-6])$/);
  if (marseille) return `132${marseille[1]}`;

  const lyon = cp.match(/^6900([1-9])$/);
  if (lyon) return `6938${lyon[1]}`;

  return null;
}

export interface GeoCommune {
  nom: string;
  code: string;
}

type FetchCommunesFn = (postalCode: string, signal: AbortSignal) => Promise<GeoCommune[]>;

async function defaultFetchCommunes(
  postalCode: string,
  signal: AbortSignal
): Promise<GeoCommune[]> {
  const url = `https://geo.api.gouv.fr/communes?codePostal=${encodeURIComponent(postalCode)}&fields=nom,code&format=json`;
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    return (await res.json()) as GeoCommune[];
  } catch {
    return [];
  }
}

/**
 * Liste ordonnée de codes INSEE à tester pour un CP.
 * Arrondissement d'abord (plus précis), puis communes geo.api.
 */
export async function resolveInseeCodesForPostal(
  postalCode: string,
  options?: {
    fetchCommunes?: FetchCommunesFn;
    timeoutMs?: number;
  }
): Promise<string[]> {
  const cp = postalCode.replace(/\D/g, "").slice(0, 5);
  if (cp.length !== 5) return [];

  const codes: string[] = [];
  const ardt = arrondissementInseeFromPostal(cp);
  if (ardt) codes.push(ardt);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options?.timeoutMs ?? 2000);
  try {
    const fetchCommunes = options?.fetchCommunes ?? defaultFetchCommunes;
    const communes = await fetchCommunes(cp, controller.signal);
    for (const c of communes) {
      if (c.code && !codes.includes(c.code)) codes.push(c.code);
    }
  } finally {
    clearTimeout(timer);
  }

  return codes;
}
