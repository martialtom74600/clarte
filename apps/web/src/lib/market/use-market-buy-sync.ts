"use client";

import { useEffect, useState } from "react";
import { useSeparationStore } from "@/store/separation-store";
import type { BuyMarketSnapshot } from "@/lib/market/buy-market";
import type { RentMarketSnapshot } from "@/lib/market/rent-market";

/**
 * Charge achat (DVF) + location (Carte des loyers) dès qu'un CP à 5 chiffres est connu.
 * Refetch à chaque montage / changement de CP — le cache serveur évite le coût réseau.
 * Toujours applique la réponse (évite un €/m² figé en mémoire après un barème obsolète).
 */
export function useMarketBuySync(): { loading: boolean } {
  const postalCode = useSeparationStore((s) => s.footprint.postalCode);
  const setMarketBuy = useSeparationStore((s) => s.setMarketBuy);
  const setMarketRent = useSeparationStore((s) => s.setMarketRent);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const cp = postalCode.replace(/\D/g, "").slice(0, 5);
    if (cp.length < 5) return;

    let cancelled = false;
    setLoading(true);

    void fetch(`/api/market?postalCode=${cp}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`market ${res.status}`);
        return (await res.json()) as { buy: BuyMarketSnapshot; rent: RentMarketSnapshot };
      })
      .then(({ buy, rent }) => {
        if (cancelled) return;
        setMarketBuy(buy);
        setMarketRent(rent);
      })
      .catch(() => {
        /* HTTP KO : moteur reste sur barèmes (snapshots null). */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postalCode, setMarketBuy, setMarketRent]);

  return { loading };
}

/** Alias explicite — même hook (achat + location). */
export const useMarketSync = useMarketBuySync;
