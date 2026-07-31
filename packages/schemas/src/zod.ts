import { z } from "zod";

export const moneySchema = z.object({
  amount: z.number().min(0),
  currency: z.literal("EUR").default("EUR"),
});

export const personIdSchema = z.enum(["A", "B"]);

export const ownershipRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("indivision"),
    shares: z.record(personIdSchema, z.number().min(0).max(1)),
  }),
  z.object({
    kind: z.literal("own"),
    owner: personIdSchema,
  }),
  z.object({
    kind: z.literal("community"),
  }),
  z.object({
    kind: z.literal("mixed"),
    communityShare: z.number().min(0).max(1),
    ownerShare: z.record(personIdSchema, z.number().min(0).max(1)),
  }),
]);

export const responsibilityRuleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("indivision"),
    shares: z.record(personIdSchema, z.number().min(0).max(1)),
  }),
  z.object({
    kind: z.literal("own"),
    owner: personIdSchema,
  }),
  z.object({
    kind: z.literal("community"),
  }),
]);

export const assetSchema = z.object({
  id: z.string(),
  type: z.enum(["real_estate", "savings", "investment", "vehicle", "other"]),
  label: z.string().min(1),
  grossValue: moneySchema,
  ownership: ownershipRuleSchema,
  acquisitionDate: z.string().optional(),
  purchasePrice: moneySchema.optional(),
  linkedLiabilityIds: z.array(z.string()).optional(),
  isPrimaryResidence: z.boolean().optional(),
});

export const liabilitySchema = z.object({
  id: z.string(),
  type: z.enum(["mortgage", "consumer_loan", "other"]),
  label: z.string().optional(),
  remainingBalance: moneySchema,
  responsibility: responsibilityRuleSchema,
  linkedAssetId: z.string().optional(),
});

export const simulationInputSchema = z.object({
  status: z.enum(["concubinage", "pacs", "marriage"]),
  marriageRegime: z
    .enum(["communaute_legale", "separation_biens", "communaute_universelle"])
    .optional(),
  marriageDate: z.string().optional(),
  pacsDate: z.string().optional(),
  persons: z.tuple([
    z.object({
      id: z.literal("A"),
      name: z.string().optional(),
      income: moneySchema.optional(),
    }),
    z.object({
      id: z.literal("B"),
      name: z.string().optional(),
      income: moneySchema.optional(),
    }),
  ]),
  assets: z.array(assetSchema),
  liabilities: z.array(liabilitySchema),
  options: z.object({
    primaryResidenceId: z.string().optional(),
    scenario: z.enum(["keep_a", "keep_b", "sell", "rent_out", "compare_all"]),
    notaryFeesRate: z.number().min(0).max(0.15).optional(),
    mortgageRate: z.number().min(0).max(0.2).optional(),
    mortgageDurationYears: z.number().min(1).max(30).optional(),
    monthlyRentOverride: z.number().min(0).optional(),
    sellingCostsRate: z.number().min(0).max(0.15).optional(),
    diagnosticsFlatFee: z.number().min(0).max(20000).optional(),
    vacancyRate: z.number().min(0).max(0.5).optional(),
    propertyTaxAnnual: z.number().min(0).optional(),
    pnoAnnual: z.number().min(0).optional(),
    managementDelegated: z.boolean().optional(),
    managementFeeRate: z.number().min(0).max(0.25).optional(),
    marginalIncomeTaxRate: z.number().min(0).max(0.55).optional(),
    occupationMonths: z.number().min(0).max(120).optional(),
  }),
  hasMinorChildren: z.boolean().optional(),
  urgencyMonths: z.number().optional(),
  tenantId: z.string().optional(),
  postalCode: z.string().optional(),
  propertySurface: z.number().min(1).optional(),
  contributionA: z.number().min(0).optional(),
  contributionB: z.number().min(0).optional(),
  monthlyMortgagePayment: z.number().min(0).optional(),
});

export const leadQualificationSchema = z.object({
  email: z.string().email(),
  simulationId: z.string().optional(),
  urgencyMonths: z.number().optional(),
  hasMinorChildren: z.boolean().optional(),
  propertyValue: z.number().optional(),
  scenarioPreference: z
    .enum(["keep_a", "keep_b", "sell", "rent_out", "compare_all"])
    .optional(),
  optInPartnerMatch: z.boolean().optional(),
  tenantId: z.string().optional(),
});

export type SimulationInputDTO = z.infer<typeof simulationInputSchema>;
export type LeadQualificationDTO = z.infer<typeof leadQualificationSchema>;
