export { FsAssetSource } from "./fs-assets.js";
export {
  audioArgs,
  fontFiles,
  loadEngine,
  loadInput,
  renderStill,
  svgToPng,
  svgCoverage,
  type SvgCoverage,
  renderVideo,
  type RenderOptions,
  type VoiceClip,
} from "./render.js";
export {
  catalogPath,
  libraryDir,
  loadAudioCatalog,
  openLibrary,
  saveAudioCatalog,
  type AudioLibrary,
  type LibraryItem,
} from "./sound/library.js";
export {
  designSoundtrack,
  roleFor,
  DEFAULT_VOICE_LUFS,
  type DesignInput,
  type DesignResult,
  type SceneStory,
} from "./sound/design.js";
export { measureVoiceLufs, mixGraph, renderMix, type MixResult, type Resolve } from "./sound/mix.js";
export { applyListeningNotes, importLibrary } from "./sound/importer.js";
export { sha256File } from "./sound/measure.js";
