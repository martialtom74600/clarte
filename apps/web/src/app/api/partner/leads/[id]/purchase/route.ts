import { NextResponse } from "next/server";
import { requirePartnerSession } from "@/lib/partner-auth";
import { purchaseLeadRpc } from "@/lib/supabase";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requirePartnerSession();
    if (!session) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id: leadId } = await params;

    const contact = await purchaseLeadRpc(session.partner.id, leadId);

    return NextResponse.json({ success: true, contact });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const pgMessage =
      typeof error === "object" && error !== null && "message" in error
        ? String((error as { message: string }).message)
        : message;

    const knownErrors = [
      "INSUFFICIENT_CREDITS",
      "LEAD_NOT_AVAILABLE",
      "LEAD_EXPIRED",
      "GEO_MISMATCH",
      "TYPE_MISMATCH",
      "LEAD_NOT_FOUND",
    ];

    for (const code of knownErrors) {
      if (pgMessage.includes(code)) {
        return NextResponse.json({ error: code, message: pgMessage }, { status: 409 });
      }
    }

    console.error("Purchase error:", error);
    return NextResponse.json({ error: "PURCHASE_FAILED" }, { status: 500 });
  }
}
