import type {
  Asset,
  Liability,
  Money,
  OwnershipRule,
  PersonId,
  ResponsibilityRule,
  SimulationInput,
} from "@separation/schemas";

export const RULE_PACK_VERSION = "2026.1";

export function eur(amount: number): Money {
  return { amount: round(amount), currency: "EUR" };
}

export function round(amount: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(amount * factor) / factor;
}

export function addMoney(a: Money, b: Money): Money {
  return eur(a.amount + b.amount);
}

export function subtractMoney(a: Money, b: Money): Money {
  return eur(a.amount - b.amount);
}

export function multiplyMoney(m: Money, factor: number): Money {
  return eur(m.amount * factor);
}

export function getShareForPerson(
  rule: OwnershipRule | ResponsibilityRule,
  personId: PersonId
): number {
  switch (rule.kind) {
    case "own":
      return rule.owner === personId ? 1 : 0;
    case "community":
      return 0.5;
    case "indivision":
      return rule.shares[personId] ?? 0;
    case "mixed":
      return rule.communityShare * 0.5 + (rule.ownerShare[personId] ?? 0);
    default:
      return 0;
  }
}

export function getNetAssetValue(asset: Asset, liabilities: Liability[]): Money {
  const linkedDebt = liabilities
    .filter(
      (l) =>
        asset.linkedLiabilityIds?.includes(l.id) ||
        l.linkedAssetId === asset.id
    )
    .reduce((sum, l) => sum + l.remainingBalance.amount, 0);

  return eur(Math.max(0, asset.grossValue.amount - linkedDebt));
}

export function getPersonShareOfAsset(
  asset: Asset,
  personId: PersonId,
  liabilities: Liability[]
): Money {
  const net = getNetAssetValue(asset, liabilities);
  const share = getShareForPerson(asset.ownership, personId);
  return multiplyMoney(net, share);
}

export function getPersonShareOfLiability(
  liability: Liability,
  personId: PersonId
): Money {
  const share = getShareForPerson(liability.responsibility, personId);
  return multiplyMoney(liability.remainingBalance, share);
}

export interface NormalizedPatrimony {
  netByPerson: Record<PersonId, Money>;
  communityMass: Money;
  ownByPerson: Record<PersonId, Money>;
}

export function normalizePatrimony(input: SimulationInput): NormalizedPatrimony {
  const netByPerson: Record<PersonId, Money> = { A: eur(0), B: eur(0) };
  const ownByPerson: Record<PersonId, Money> = { A: eur(0), B: eur(0) };
  let communityMass = eur(0);

  for (const asset of input.assets) {
    const net = getNetAssetValue(asset, input.liabilities);

    if (asset.ownership.kind === "community") {
      communityMass = addMoney(communityMass, net);
    } else if (asset.ownership.kind === "own") {
      ownByPerson[asset.ownership.owner] = addMoney(
        ownByPerson[asset.ownership.owner],
        net
      );
    } else {
      netByPerson.A = addMoney(
        netByPerson.A,
        multiplyMoney(net, getShareForPerson(asset.ownership, "A"))
      );
      netByPerson.B = addMoney(
        netByPerson.B,
        multiplyMoney(net, getShareForPerson(asset.ownership, "B"))
      );
    }
  }

  for (const liability of input.liabilities) {
    if (liability.linkedAssetId) continue;

    if (liability.responsibility.kind === "community") {
      communityMass = subtractMoney(
        communityMass,
        liability.remainingBalance
      );
    } else if (liability.responsibility.kind === "own") {
      ownByPerson[liability.responsibility.owner] = subtractMoney(
        ownByPerson[liability.responsibility.owner],
        liability.remainingBalance
      );
    } else {
      netByPerson.A = subtractMoney(
        netByPerson.A,
        getPersonShareOfLiability(liability, "A")
      );
      netByPerson.B = subtractMoney(
        netByPerson.B,
        getPersonShareOfLiability(liability, "B")
      );
    }
  }

  return { netByPerson, communityMass, ownByPerson };
}

export function estimateMonthlyPayment(
  principal: number,
  annualRate: number,
  years: number
): Money {
  if (principal <= 0) return eur(0);
  const monthlyRate = annualRate / 12;
  const months = years * 12;
  if (monthlyRate === 0) return eur(principal / months);
  const payment =
    (principal * monthlyRate * Math.pow(1 + monthlyRate, months)) /
    (Math.pow(1 + monthlyRate, months) - 1);
  return eur(payment);
}

export function getPrimaryResidence(
  input: SimulationInput
): Asset | undefined {
  if (input.options.primaryResidenceId) {
    return input.assets.find((a) => a.id === input.options.primaryResidenceId);
  }
  return input.assets.find(
    (a) => a.type === "real_estate" && a.isPrimaryResidence
  ) ?? input.assets.find((a) => a.type === "real_estate");
}

export const DEFAULT_DISCLAIMERS = [
  "Simulation indicative ne constituant pas un conseil juridique, fiscal ou notarial.",
  "Les résultats peuvent varier selon votre convention, contrat de mariage ou décisions de justice.",
  "Consultez un notaire ou avocat avant toute décision patrimoniale.",
];
