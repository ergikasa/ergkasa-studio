/**
 * The boundary for artwork made by artists (not implemented in Phase 2; the format already accepts it).
 *
 * An artist delivers, per view, layers of vector outlines (SVG paths) and painted images (PNG/WebP), plus a rig:
 * bones with joints, which layer follows which bones (skin weights or rigid), morph shapes for the face (a drawn
 * key shape per action unit), the eye openings and pivots. An importer turns that delivery into a PackageSpec
 * and hands it to writer.ts, exactly like a parametric source. Nothing in the format limits the art to
 * parametric shapes: any path, any painted texture, any number of views, any skeleton (custom rigs map their
 * controls to erkasa.humanoid/1 channels, or add `x_` channels of their own).
 */
import type { PackageSpec } from "../writer.js";

export interface ArtworkSource {
  /** What the source is (tool, file set, version): written to provenance. */
  describe(): { tool: string; inputsSha256: string };
  /** The package description built from the delivery. */
  toSpec(): Promise<PackageSpec>;
}
