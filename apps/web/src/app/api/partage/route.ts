import { NextResponse } from "next/server";
import { saveSimulation } from "@/lib/supabase";
import {
  SHARE_SNAPSHOT_KIND,
  saveShareSnapshot,
  type ShareSnapshot,
} from "@/lib/share-snapshot-store";
import type { ExpertExportPack } from "@/lib/separation/export-bilan-model";

function isPack(value: unknown): value is ExpertExportPack {
  if (!value || typeof value !== "object") return false;
  const p = value as ExpertExportPack;
  return Array.isArray(p.chapters) && p.chapters.length > 0 && typeof p.dateLabel === "string";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      pack?: unknown;
      recipientEmail?: string;
      senderLabel?: string;
    };

    if (!isPack(body.pack)) {
      return NextResponse.json({ error: "Pack expert invalide" }, { status: 400 });
    }

    const email = body.recipientEmail?.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Adresse e-mail invalide" }, { status: 400 });
    }

    const token = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    const snapshot: ShareSnapshot = {
      kind: SHARE_SNAPSHOT_KIND,
      createdAt: new Date().toISOString(),
      recipientEmail: email,
      senderLabel: body.senderLabel?.trim() || undefined,
      pack: body.pack,
    };

    saveShareSnapshot(token, snapshot);

    await saveSimulation({
      tenant_id: "default",
      share_token: token,
      input_data: {
        kind: SHARE_SNAPSHOT_KIND,
        recipientEmail: snapshot.recipientEmail,
        senderLabel: snapshot.senderLabel,
        createdAt: snapshot.createdAt,
      },
      result_data: { pack: snapshot.pack },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

    return NextResponse.json({
      token,
      shareUrl: `${baseUrl}/partage/${token}`,
      /** E-mail transactionnel non branché en V1 — le lien suffit pour partager. */
      emailQueued: false,
    });
  } catch (error) {
    console.error("Partage create error:", error);
    return NextResponse.json({ error: "Impossible de créer le lien de partage" }, { status: 500 });
  }
}
