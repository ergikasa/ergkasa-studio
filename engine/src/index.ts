export { Engine, type EngineOptions } from "./core/engine.js";
export { parseAssetRef, resolveAsset, type AssetSource } from "./core/assets.js";
export { easeFn, smoothstep } from "./core/easing.js";
export { sampleNumber, sampleDiscrete } from "./core/tracks.js";
export { SvgTemplate, topLevelGroups, OPACITY_GUARD, safeOpacity } from "./core/svg-template.js";
export { parallaxFactor } from "./core/camera.js";
export {
  ACTIONS,
  ACTION_NAMES,
  SIDE_ACTIONS,
  ACTIONS_BY_SKELETON,
  SEAT,
  SIDE_FLOOR_Y,
  sideGaitSpeed,
  sideHandItem,
} from "./adapters/actions.js";
export { TEXT_STYLES } from "./adapters/text.js";
export {
  visemeFor,
  prepareCharacter,
  renderCharacter,
  actionsFor,
  type PreparedCharacter,
  type Facing,
  type SpeechSample,
} from "./adapters/character.js";
export type { Word } from "./adapters/captions.js";
export { CHART_KINDS, formatValue } from "./adapters/charts.js";
