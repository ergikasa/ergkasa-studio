/**
 * Reading a verified package at one instant, only through the contract's evaluator (@erkasa/contracts). A value
 * without a track is the node's own placement, or the rest value the engine documents for the builtin.
 */
import { numberAt, visibleAt, type AssetManifest, type RenderPackage } from "@erkasa/contracts";

export type Scene = RenderPackage["scenes"][number];
export type Layer = Scene["layers"][number];
export type ScreenLayer = NonNullable<Scene["screen"]>[number];
export type PNode = Layer["nodes"][number];
export type AssetNode = Extract<PNode, { kind: "asset" }>;
export type Asset = AssetManifest["assets"][number];
export type VectorAsset = Extract<Asset, { kind: "vector" }>;
export type Captions = Extract<RenderPackage["overlays"][number], { kind: "captions" }>;
type TargetKind = "node" | "actor" | "camera";

export class At {
  constructor(
    readonly scene: Scene,
    readonly t: number,
  ) {}

  has(kind: TargetKind, id: string | undefined, channel: string): boolean {
    return this.scene.tracks.some(
      (tr) =>
        tr.channel === channel &&
        tr.target.kind === kind &&
        (kind === "camera" || ("id" in tr.target && tr.target.id === id)),
    );
  }

  /** The value of a channel; `rest` when the package does not drive it. */
  n(kind: TargetKind, id: string | undefined, channel: string, rest?: number): number {
    if (rest !== undefined && !this.has(kind, id, channel)) return rest;
    return numberAt(this.scene, kind, id, channel, this.t);
  }

  visible(node: string): boolean {
    return visibleAt(this.scene, node, this.t);
  }

  /** A node's placement channel: its track, or the value written on the node. */
  place(n: AssetNode, channel: "x" | "y" | "scale" | "rotation" | "opacity"): number {
    return this.n("node", n.id, channel, n[channel]);
  }
}

/** The manifest, indexed by `id@version`. */
export class Assets {
  private readonly byRef: Map<string, Asset>;
  constructor(manifest: AssetManifest) {
    this.byRef = new Map(manifest.assets.map((a) => [`${a.id}@${a.version}`, a]));
  }
  get(ref: string): Asset {
    const a = this.byRef.get(ref);
    if (!a) throw new Error(`the manifest has no ${ref}`);
    return a;
  }
  /** The source a node draws: its state's own source, or the asset's. */
  source(n: AssetNode): { asset: VectorAsset; source: VectorAsset["source"]; key: string } {
    const asset = this.get(n.asset);
    if (asset.kind !== "vector") throw new Error(`${n.id}: ${n.asset} is not a drawing`);
    const st = asset.states.find((s) => s.name === n.state);
    if (!st) throw new Error(`${n.id}: ${n.asset} has no state ${n.state}`);
    if ("source" in st) return { asset, source: st.source, key: `${n.asset}#${st.name}` };
    // a state drawn as one element of the main file: not drawn by this engine yet (E1.5)
    throw new Error(
      `${n.id}: state '${n.state}' is an element of ${n.asset}'s file; this engine draws only states with their own source`,
    );
  }
}
