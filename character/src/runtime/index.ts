/**
 * Character Runtime: executes erkasa.character/1 packages. It loads and verifies a package, reads the channel
 * values the Engines wrote (erkasa.render/1 tracks), deforms the skeleton, meshes and face, and draws through
 * the existing Skia path. It takes no creative decision: what a character does comes from the tracks.
 *
 * Boundary: the runtime imports neither the Library nor the Builder (test/boundary.test.ts).
 */
export { CharacterError, errorsOf, type Finding } from "./errors.js";
export { canonicalJson, identityFingerprint, sha256 } from "./hash.js";
export {
  loadCharacter,
  loadCharacterBytes,
  readPackageDir,
  type LoadedCharacter,
  type PackageBytes,
  type Part,
} from "./load.js";
export { validateCharacter, GAZE_CHANNELS } from "./validate.js";
export {
  boneMatrices,
  morphWeights,
  chooseViews,
  consumedChannels,
  deformPart,
  evaluate,
  resolveValues,
  type CharacterState,
  type DrawItem,
  type Evaluated,
  type IrisItem,
  type Layer,
  type Lod,
  type PartItem,
} from "./evaluate.js";
export { drawCharacter, TRIANGLE_GROW_PX, type Placement } from "./draw.js";
export { actorFrame, type ActorFrame } from "./tracks.js";
export { selfCheck } from "./selfcheck.js";
export { RUNTIME_REVISION } from "./revision.js";
