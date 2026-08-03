import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { ExpertExportPack } from "@/lib/separation/export-bilan-model";

export const SHARE_SNAPSHOT_KIND = "expert_share" as const;

export interface ShareSnapshot {
  kind: typeof SHARE_SNAPSHOT_KIND;
  createdAt: string;
  recipientEmail?: string;
  senderLabel?: string;
  pack: ExpertExportPack;
}

type GlobalShare = typeof globalThis & {
  __clarteShareSnapshots?: Map<string, ShareSnapshot>;
};

/** Map partagée entre routes API et pages RSC (évite les Maps dupliquées par bundle). */
function memoryStore(): Map<string, ShareSnapshot> {
  const g = globalThis as GlobalShare;
  if (!g.__clarteShareSnapshots) {
    g.__clarteShareSnapshots = new Map();
  }
  return g.__clarteShareSnapshots;
}

function isSafeToken(token: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(token);
}

function diskPath(token: string): string {
  const dir = join(tmpdir(), "clarte-share-snapshots");
  mkdirSync(dir, { recursive: true });
  return join(dir, `${token}.json`);
}

export function saveShareSnapshot(token: string, data: ShareSnapshot) {
  if (!isSafeToken(token)) {
    throw new Error("Invalid share token");
  }
  memoryStore().set(token, data);
  try {
    writeFileSync(diskPath(token), JSON.stringify(data), "utf8");
  } catch (error) {
    console.warn("Share snapshot disk write failed:", error);
  }
}

export function getShareSnapshot(token: string): ShareSnapshot | null {
  if (!isSafeToken(token)) return null;

  const fromMemory = memoryStore().get(token);
  if (fromMemory) return fromMemory;

  try {
    const path = diskPath(token);
    if (!existsSync(path)) return null;
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (!isShareSnapshot(parsed)) return null;
    memoryStore().set(token, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function isShareSnapshot(value: unknown): value is ShareSnapshot {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.kind === SHARE_SNAPSHOT_KIND && v.pack != null && typeof v.pack === "object";
}
