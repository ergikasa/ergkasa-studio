/**
 * Character Builder: authoring of erkasa.character/1 packages, offline. Never imported by an Engine or by the
 * Runtime; its only output is a package folder, verified by the Runtime before it is written.
 *
 *   writer.ts                  the one way out (deterministic files, hashes, fingerprint, load-back)
 *   geometry.ts                anchors with weights and morphs, smooth outlines
 *   sources/parametric/        packages generated from parameters (the test character; later the anatomical
 *                              builder grown from the v4 prototype)
 *   sources/artist/ (later)    artwork and rigs made by artists, imported into the same format
 */
export { packageFiles, writePackage, type PackageSpec } from "./writer.js";
export { anchor, combine, PartGeometry, type Anchor, type Vec, type Weights } from "./geometry.js";
export { testMinimalSpec, paintTee } from "./sources/parametric/test-minimal.js";
export type { ArtworkSource } from "./sources/artist.js";
