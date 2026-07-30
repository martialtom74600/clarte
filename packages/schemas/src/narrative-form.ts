import { z } from "zod";

export const narrativeStatusSchema = z.enum(["concubinage", "pacs", "marriage"]);

export const narrativeMarriageRegimeSchema = z.enum([
  "communaute_legale",
  "separation_biens",
  "communaute_universelle",
]);

export const narrativePropertyValueModeSchema = z.enum(["dvf", "manual"]);

export const narrativeCustodyTypeSchema = z.enum(["classic", "alternate"]);

export const narrativeIntentSchema = z.enum(["keep_home", "walk_away", "amiable_path"]);

export const narrativeFormSchema = z
  .object({
    status: narrativeStatusSchema,
    marriageRegime: narrativeMarriageRegimeSchema.optional(),
    postalCode: z.string(),
    propertySurface: z.number(),
    propertyValueMode: narrativePropertyValueModeSchema,
    propertyValue: z.number(),
    mortgageRemaining: z.number(),
    hasMinorChildren: z.boolean(),
    numberOfChildren: z.number(),
    custodyType: narrativeCustodyTypeSchema,
    incomeAMonthly: z.number(),
    incomeBMonthly: z.number(),
    savingsJoint: z.number().optional(),
    contributionA: z.number().optional(),
    contributionB: z.number().optional(),
    intent: narrativeIntentSchema,
  })
  .superRefine((data, ctx) => {
    if (data.status === "marriage" && !data.marriageRegime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Régime matrimonial requis",
        path: ["marriageRegime"],
      });
    }
    if (data.hasMinorChildren && data.numberOfChildren < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nombre d'enfants requis",
        path: ["numberOfChildren"],
      });
    }
  });

export type NarrativeFormValues = z.infer<typeof narrativeFormSchema>;

export type NarrativeBeatId = "status" | "property" | "children" | "income" | "intent";

/** Beat 1 — cadre juridique */
export const beatStatusSchema = z
  .object({
    status: narrativeStatusSchema,
    marriageRegime: narrativeMarriageRegimeSchema.optional(),
  })
  .superRefine((data, ctx) => {
    if (data.status === "marriage" && !data.marriageRegime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Régime matrimonial requis",
        path: ["marriageRegime"],
      });
    }
  });

/** Beat 2 — bien immobilier */
export const beatPropertySchema = z.object({
  postalCode: z.string().regex(/^\d{5}$/, "Code postal à 5 chiffres"),
  propertySurface: z.number().min(1, "Surface requise"),
  propertyValueMode: narrativePropertyValueModeSchema,
  propertyValue: z.number().min(1, "Valeur du bien requise"),
  mortgageRemaining: z.number().min(0),
});

/** Beat 3 — foyer */
export const beatChildrenSchema = z
  .object({
    hasMinorChildren: z.boolean(),
    numberOfChildren: z.number().min(0),
    custodyType: narrativeCustodyTypeSchema,
  })
  .superRefine((data, ctx) => {
    if (data.hasMinorChildren && data.numberOfChildren < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Nombre d'enfants requis",
        path: ["numberOfChildren"],
      });
    }
  });

/** Beat 4 — revenus */
export const beatIncomeSchema = z.object({
  incomeAMonthly: z.number().min(1, "Revenu requis"),
  incomeBMonthly: z.number().min(1, "Revenu requis"),
  savingsJoint: z.number().min(0).optional(),
  contributionA: z.number().min(0).optional(),
  contributionB: z.number().min(0).optional(),
});

/** Beat 5 — intention */
export const beatIntentSchema = z.object({
  intent: narrativeIntentSchema,
});

export const NARRATIVE_BEAT_SCHEMAS = {
  status: beatStatusSchema,
  property: beatPropertySchema,
  children: beatChildrenSchema,
  income: beatIncomeSchema,
  intent: beatIntentSchema,
} as const;
