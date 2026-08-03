import { getSimulationByToken } from "@/lib/supabase";
import {
  getShareSnapshot,
  isShareSnapshot,
  type ShareSnapshot,
  SHARE_SNAPSHOT_KIND,
} from "@/lib/share-snapshot-store";
import type { ExpertExportPack } from "@/lib/separation/export-bilan-model";

/** Charge un snapshot de partage (mémoire locale puis Supabase). */
export async function loadShareSnapshot(token: string): Promise<ShareSnapshot | null> {
  const local = getShareSnapshot(token);
  if (local) return local;

  const row = await getSimulationByToken(token);
  if (!row) return null;

  const input = (row.input_data ?? {}) as Record<string, unknown>;
  const result = (row.result_data ?? {}) as Record<string, unknown>;

  if (input.kind === SHARE_SNAPSHOT_KIND && result.pack) {
    const snapshot: ShareSnapshot = {
      kind: SHARE_SNAPSHOT_KIND,
      createdAt:
        typeof input.createdAt === "string" ? input.createdAt : row.created_at ?? new Date().toISOString(),
      recipientEmail:
        typeof input.recipientEmail === "string" ? input.recipientEmail : undefined,
      senderLabel: typeof input.senderLabel === "string" ? input.senderLabel : undefined,
      pack: result.pack as ExpertExportPack,
    };
    if (isShareSnapshot(snapshot)) return snapshot;
  }

  /** Ancien format éventuel : pack stocké à la racine de result_data. */
  if (isShareSnapshot(result)) return result;

  return null;
}
