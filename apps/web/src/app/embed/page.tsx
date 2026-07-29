import { getTenantConfig } from "@/lib/supabase";
import { EmbedWizard } from "@/components/embed-wizard";

export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const params = await searchParams;
  const tenantId = params.tenant ?? "default";
  const tenant = await getTenantConfig(tenantId);

  return (
    <div
      style={
        tenant.primary_color
          ? ({ "--color-brand-600": tenant.primary_color } as React.CSSProperties)
          : undefined
      }
    >
      {tenant.logoUrl && (
        <div className="px-4 py-3 border-b border-slate-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tenant.logoUrl} alt={tenant.name} className="h-8" />
        </div>
      )}
      <EmbedWizard tenantId={tenantId} />
    </div>
  );
}
