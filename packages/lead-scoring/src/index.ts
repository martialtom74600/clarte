import type {
  LeadQualification,
  LeadScore,
  SimulationInput,
  SimulationResult,
} from "@separation/schemas";

const CPL_THRESHOLD = 55;

export function scoreLead(
  qualification: LeadQualification,
  simulation?: SimulationInput,
  result?: SimulationResult
): LeadScore {
  let score = 0;
  const partners = new Set<"notaire" | "courtier" | "agence">();

  const propertyValue =
    qualification.propertyValue ??
    simulation?.assets
      .filter((a) => a.type === "real_estate")
      .reduce((s, a) => s + a.grossValue.amount, 0) ??
    0;

  if (propertyValue > 150000) {
    score += 30;
    partners.add("notaire");
  }

  const hasMortgage = simulation?.liabilities.some((l) => l.type === "mortgage");
  if (hasMortgage) {
    score += 15;
    partners.add("courtier");
  }

  const complexity = result?.complexityScore ?? 0;
  if (complexity > 60) {
    score += 20;
    partners.add("notaire");
  }

  const scenario =
    qualification.scenarioPreference ?? simulation?.options.scenario;
  if (scenario === "sell") {
    score += 25;
    partners.add("agence");
  }

  if (
    qualification.urgencyMonths !== undefined &&
    qualification.urgencyMonths <= 3
  ) {
    score += 10;
  }

  if (qualification.hasMinorChildren) {
    score += 5;
    partners.add("notaire");
  }

  score = Math.min(100, score);

  let tier: LeadScore["tier"] = "cold";
  if (score >= 70) tier = "hot";
  else if (score >= 40) tier = "warm";

  const qualifiesForCpl =
    score >= CPL_THRESHOLD && qualification.optInPartnerMatch === true;

  return {
    score,
    tier,
    recommendedPartners: Array.from(partners),
    qualifiesForCpl,
  };
}

export function buildLeadPayload(
  qualification: LeadQualification,
  simulation: SimulationInput,
  result: SimulationResult,
  leadScore: LeadScore
) {
  return {
    email: qualification.email,
    tenantId: qualification.tenantId ?? simulation.tenantId ?? "default",
    score: leadScore.score,
    tier: leadScore.tier,
    qualifiesForCpl: leadScore.qualifiesForCpl,
    recommendedPartners: leadScore.recommendedPartners,
    simulationSummary: {
      status: simulation.status,
      marriageRegime: simulation.marriageRegime,
      complexityScore: result.complexityScore,
      netWorthA: result.netWorthByPerson.A.amount,
      netWorthB: result.netWorthByPerson.B.amount,
      soulteAmount: result.soulte?.amount.amount,
      scenario: simulation.options.scenario,
      urgencyMonths: qualification.urgencyMonths,
      hasMinorChildren: qualification.hasMinorChildren,
    },
    createdAt: new Date().toISOString(),
  };
}
