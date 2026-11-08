/**
 * Compiles an asset SVG into a fast template whose named parts can be transformed per frame.
 *
 * Every `<g id="...">` becomes addressable: the engine can rotate/scale/move it around its
 * `data-pivot` and change its opacity. Every `<g data-state="...">` inside a `data-slot` group
 * can be shown or hidden (eyes, brows, mouth). The asset generators in tools/asset-gen produce
 * exactly this structure; compile() fails loudly if an expected part is missing.
 */

export interface PartPose {
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  x?: number;
  y?: number;
  opacity?: number;
}

export interface TemplateRenderInput {
  parts?: Record<string, PartPose>;
  /** slot -> visible state */
  states?: Record<string, string>;
}

interface PartInfo {
  pivot: [number, number];
  existingTransform: string;
  follows?: string;
}

/**
 * resvg 2.6 aborts the process when a group/element with `opacity` ends up entirely outside the
 * frame (it allocates an empty layer). An invisible, huge rect inside every opacity group keeps the
 * layer non-empty; pixels are identical. Leaf shapes use fill-/stroke-opacity, which need no layer.
 */
export const OPACITY_GUARD =
  '<rect x="-100000" y="-100000" width="200000" height="200000" fill="#000" fill-opacity="0"/>';

/** Rewrites `opacity` so no element can trigger the resvg empty-layer abort. */
export function safeOpacity(markup: string): string {
  return markup
    .replace(
      /<(circle|rect|ellipse|path|polygon|polyline|line|text)\b([^>]*?)\sopacity="([\d.]+)"([^>]*)>/g,
      (m, tag: string, a: string, o: string, b: string) =>
        /fill-opacity|stroke-opacity/.test(a + b)
          ? m
          : `<${tag}${a} fill-opacity="${o}" stroke-opacity="${o}"${b}>`,
    )
    .replace(/<g\b([^>]*?)\sopacity="([\d.]+)"([^>]*?)(?<!\/)>/g, (m) => m + OPACITY_GUARD);
}

const PART_MARK = "\u0000P:";
const CHILD_MARK = "\u0000C:";
const STATE_MARK = "\u0000S:";
const END = "\u0000";

export class SvgTemplate {
  readonly viewBox: [number, number, number, number];
  readonly parts: ReadonlyMap<string, PartInfo>;
  readonly slots: ReadonlyMap<string, string[]>;
  /** Root-level attributes worth keeping (e.g. `color` on themable icons). */
  readonly rootColor: string | undefined;
  readonly defs: string;
  private readonly chunks: string[];

  private constructor(
    viewBox: [number, number, number, number],
    parts: Map<string, PartInfo>,
    slots: Map<string, string[]>,
    rootColor: string | undefined,
    defs: string,
    chunks: string[],
  ) {
    this.viewBox = viewBox;
    this.parts = parts;
    this.slots = slots;
    this.rootColor = rootColor;
    this.defs = defs;
    this.chunks = chunks;
  }

  static compile(svgText: string, name = "asset"): SvgTemplate {
    const root = /<svg\b([^>]*)>([\s\S]*)<\/svg>\s*$/.exec(svgText.trim());
    if (!root) throw new Error(`${name}: not an <svg> document`);
    const attrs = root[1] ?? "";
    let body = root[2] ?? "";
    const vb = /viewBox="([-\d.\s]+)"/.exec(attrs)?.[1]?.trim().split(/\s+/).map(Number);
    if (!vb || vb.length !== 4) throw new Error(`${name}: missing viewBox`);
    const color = /\scolor="([^"]+)"/.exec(attrs)?.[1];

    let defs = "";
    body = safeOpacity(body);
    body = body.replace(/<defs>([\s\S]*?)<\/defs>/g, (_m, inner: string) => {
      defs += inner;
      return "";
    });

    const parts = new Map<string, PartInfo>();
    const slots = new Map<string, string[]>();
    let currentSlot: string | undefined;

    const tagRe = /<g\b([^>]*)>/g;
    let out = "";
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(body)) !== null) {
      const tagAttrs = m[1] ?? "";
      const id = /\bid="([^"]+)"/.exec(tagAttrs)?.[1];
      const slot = /\bdata-slot="([^"]+)"/.exec(tagAttrs)?.[1];
      const state = /\bdata-state="([^"]+)"/.exec(tagAttrs)?.[1];
      if (slot) {
        currentSlot = slot;
        slots.set(slot, []);
      }
      let replacement: string | undefined;
      if (state !== undefined && currentSlot) {
        slots.get(currentSlot)?.push(state);
        const cleaned = tagAttrs.replace(/\sdisplay="[^"]*"/, "");
        replacement = `<g${cleaned}${STATE_MARK}${currentSlot}:${state}${END}>`;
      } else if (id !== undefined && !parts.has(id)) {
        const pv = /\bdata-pivot="([-\d.]+),([-\d.]+)"/.exec(tagAttrs);
        const existing = /\stransform="([^"]*)"/.exec(tagAttrs)?.[1] ?? "";
        const follows = /\bdata-follows="([^"]+)"/.exec(tagAttrs)?.[1];
        const info: PartInfo = {
          pivot: [Number(pv?.[1] ?? 0), Number(pv?.[2] ?? 0)],
          existingTransform: existing,
        };
        if (follows) info.follows = follows;
        parts.set(id, info);
        const cleaned = tagAttrs.replace(/\stransform="[^"]*"/, "");
        replacement = `<g${cleaned}${PART_MARK}${id}${END}>${CHILD_MARK}${id}${END}`;
      }
      if (replacement !== undefined) {
        out += body.slice(last, m.index) + replacement;
        last = m.index + m[0].length;
      }
    }
    out += body.slice(last);

    return new SvgTemplate(
      vb as [number, number, number, number],
      parts,
      slots,
      color,
      defs,
      out.split("\u0000"),
    );
  }

  /** Throws if a part the caller relies on is not in the SVG. */
  requireParts(ids: Iterable<string>, name: string): void {
    const missing = [...ids].filter((id) => !this.parts.has(id));
    if (missing.length) throw new Error(`${name}: missing parts ${missing.join(", ")}`);
  }

  render(input: TemplateRenderInput = {}): string {
    const poses = input.parts ?? {};
    let s = "";
    for (let i = 0; i < this.chunks.length; i++) {
      const c = this.chunks[i] as string;
      if (i % 2 === 0) {
        s += c;
        continue;
      }
      if (c.startsWith("P:")) {
        const id = c.slice(2);
        const info = this.parts.get(id) as PartInfo;
        const pose = poses[id] ?? (info.follows ? poses[info.follows] : undefined);
        s += partAttrs(info, pose);
      } else if (c.startsWith("C:")) {
        const pose = poses[c.slice(2)];
        if (pose?.opacity !== undefined && pose.opacity < 1) s += OPACITY_GUARD;
      } else if (c.startsWith("S:")) {
        const [slot, state] = c.slice(2).split(":") as [string, string];
        const wanted = input.states?.[slot] ?? "neutral";
        if (wanted !== state) s += ' display="none"';
      }
    }
    return s;
  }
}

function partAttrs(info: PartInfo, pose: PartPose | undefined): string {
  const t: string[] = [];
  if (info.existingTransform) t.push(info.existingTransform);
  let opacity = "";
  if (pose?.opacity === 0) return ' display="none"';
  if (pose) {
    const [px, py] = info.pivot;
    if (pose.x || pose.y) t.push(`translate(${fmt(pose.x ?? 0)} ${fmt(pose.y ?? 0)})`);
    if (pose.rotation) t.push(`rotate(${fmt(pose.rotation)} ${px} ${py})`);
    const sx = pose.scaleX ?? 1;
    const sy = pose.scaleY ?? 1;
    if (sx !== 1 || sy !== 1)
      t.push(`translate(${px} ${py}) scale(${fmt(sx)} ${fmt(sy)}) translate(${-px} ${-py})`);
    if (pose.opacity !== undefined && pose.opacity < 1)
      opacity = ` opacity="${fmt(Math.max(0, pose.opacity))}"`;
  }
  return (t.length ? ` transform="${t.join(" ")}"` : "") + opacity;
}

export const fmt = (n: number): string => (Math.round(n * 1000) / 1000).toString();

/** Splits the direct children `<g ...>...</g>` of an SVG body (used for background layers). */
export function topLevelGroups(body: string): Array<{ attrs: string; inner: string }> {
  const out: Array<{ attrs: string; inner: string }> = [];
  const re = /<(\/?)g\b([^>]*?)(\/?)>/g;
  let depth = 0;
  let start = -1;
  let startAttrs = "";
  let innerStart = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const closing = m[1] === "/";
    const selfClosing = m[3] === "/";
    if (!closing && !selfClosing) {
      if (depth === 0) {
        start = m.index;
        startAttrs = m[2] ?? "";
        innerStart = m.index + m[0].length;
      }
      depth++;
    } else if (closing) {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push({ attrs: startAttrs, inner: body.slice(innerStart, m.index) });
        start = -1;
      }
    }
  }
  return out;
}
