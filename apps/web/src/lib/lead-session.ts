import { getSimulationByToken, getSupabaseAdmin } from "@/lib/supabase";

export async function verifyLeadPublishSession(
  email: string,
  shareToken: string
): Promise<{ simulationId: string | null } | null> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const simulation = await getSimulationByToken(shareToken);
  if (!simulation) return null;

  const { data: leads } = await supabase
    .from("leads")
    .select("simulation_data")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1);

  const lead = leads?.[0];
  if (!lead) return null;

  const simulationData = lead.simulation_data as Record<string, unknown> | null;
  if (simulationData?.shareToken !== shareToken) return null;

  return { simulationId: simulation.id ?? null };
}
