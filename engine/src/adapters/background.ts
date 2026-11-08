import type { AssetMeta } from "@erkasa/contracts";
import { safeOpacity, topLevelGroups } from "../core/svg-template.js";

export interface BackgroundLayer {
  id: string;
  depth: number;
  markup: string;
}

export interface PreparedBackground {
  assetId: string;
  width: number;
  height: number;
  groundY: number | null;
  defs: string;
  layers: BackgroundLayer[];
}

/** Splits a layered background SVG into its `layer_*` groups, keeping each layer's depth. */
export function prepareBackground(meta: AssetMeta, svgText: string): PreparedBackground {
  const vb = /viewBox="([-\d.\s]+)"/.exec(svgText)?.[1]?.trim().split(/\s+/).map(Number) ?? [];
  const width = vb[2] ?? 2560;
  const height = vb[3] ?? 1920;
  let defs = "";
  let body = /<svg\b[^>]*>([\s\S]*)<\/svg>/.exec(svgText)?.[1] ?? "";
  body = body.replace(/<defs>([\s\S]*?)<\/defs>/g, (_m, inner: string) => {
    defs += inner;
    return "";
  });
  // The scene groups everything under one root <g id="bg_...">; layers are its children.
  const root = topLevelGroups(body)[0];
  const groups = root ? topLevelGroups(root.inner) : [];
  const layers: BackgroundLayer[] = [];
  for (const g of groups) {
    const id = /\bid="(layer_[^"]+)"/.exec(g.attrs)?.[1];
    const depth = /\bdata-depth="([-\d.]+)"/.exec(g.attrs)?.[1];
    if (id && depth !== undefined) layers.push({ id, depth: Number(depth), markup: safeOpacity(g.inner) });
  }
  if (layers.length === 0) throw new Error(`${meta.assetId}: no layer_* groups found`);
  return { assetId: meta.assetId, width, height, groundY: meta.groundY ?? null, defs, layers };
}
