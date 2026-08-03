export type {
  FootprintState,
  AssumptionsState,
  LabState,
  DerivedState,
  MarketBuyState,
  MarketRentState,
  SeparationState,
  LeverOverrides,
  FootprintField,
} from "./separation-types";
export {
  compileSimulationInput,
  isFootprintComplete,
  defaultAssumptions,
  defaultLabState,
  seedLabFromFootprint,
  leverRequiresOverride,
} from "./compile-simulation-input";
export { recomputeSeparationDerived } from "./recompute-derived";
export {
  buildAllPortes,
  buildPortePresentation,
  DOOR_ORDER,
  PORTE_GROUPS,
  groupPortes,
  pickFeaturedDoorId,
  isValidDoorId,
} from "./porte-presenter";
export type { PortePresentation, PorteGroup } from "./porte-presenter";
export {
  buildExportBilan,
  buildExpertExportPack,
  EXPORT_SCENARIO_TITLES,
  EXPORT_DISCLAIMER,
} from "./export-bilan-model";
export type {
  ExportBilanModel,
  ExportDoorChapter,
  ExpertExportPack,
  ExportInsight,
} from "./export-bilan-model";
export {
  buildDoorHowItWorks,
  buildDoorNextSteps,
  buildMatrixRow,
} from "./export-door-narrative";
