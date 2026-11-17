/** @erkasa/gate — the Validation Gate. Depends only on @erkasa/contracts and saxes. */
export { validate, type GateInput, type GateResult } from "./validate.js";
export { DEFAULT_BUDGETS, type Budgets } from "./budgets.js";
export {
  capabilityProblems,
  CAPABILITIES_VERSION,
  PLACEMENT,
  type RenderCapabilities,
  type BuiltinCapability,
  type CapabilityParameter,
  type FieldClass,
  type LayerRole,
  type PlacementField,
  type ProjectionRule,
} from "./capabilities.js";
export { checkSvg, type SvgVerdict } from "./svg.js";
export { readContained, lexicalProblem, type VerifiedFile, type ReadOutcome } from "./files.js";
export { compareFindings, pointer, type Finding, type GateFile, type GateReport } from "./report.js";
