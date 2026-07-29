import { getTenantConfig } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tenantId: string }> }
) {
  const { tenantId } = await params;
  const tenant = await getTenantConfig(tenantId);

  return NextResponse.json({
    id: tenant.id,
    name: tenant.name,
    logoUrl: tenant.logoUrl ?? null,
    primaryColor: tenant.primary_color ?? "#0c8ce9",
    embedUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/embed?tenant=${tenantId}`,
  });
}
