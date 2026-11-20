/**
 * The capability self-check: a package may declare only what it can do. Every declared channel must change the
 * character's geometry (a vertex, an opacity, an iris or the selected view) at one end of its range; every
 * declared view must be selected at its centre; blink must close the eye opening; gaze must move the iris; every
 * declared outfit must add its garments and hide what it covers; every declared level of detail must be drawable.
 * Acting abilities (locomotion, interactions) cannot be proved here: validate.ts requires a passing report.
 */
import type { Finding } from "./errors.js";
import { consumedChannels, evaluate, type Evaluated, type Lod } from "./evaluate.js";
import type { LoadedCharacter } from "./load.js";

/** Smallest change that counts as an effect, package units (or opacity). */
const EPS = 1e-3;

function signature(ev: Evaluated): Map<string, number[]> {
  const sig = new Map<string, number[]>();
  ev.layers.forEach((l, li) => {
    sig.set(`views#${li}`, [l.weight, ...Object.values(l.views).map((v) => v.length)]);
    sig.set(
      `viewnames#${li}`,
      Object.values(l.views).flatMap((v) => [...v].map((ch) => ch.charCodeAt(0))),
    );
    for (const it of l.items) {
      if (it.kind === "part") sig.set(`${li}:${it.part.id}`, [it.opacity, ...it.points]);
      else sig.set(`${li}:iris:${it.eye.id}`, [it.center[0], it.center[1], it.rx, it.ry]);
    }
  });
  return sig;
}

function changed(a: Map<string, number[]>, b: Map<string, number[]>): boolean {
  if (a.size !== b.size) return true;
  for (const [k, va] of a) {
    const vb = b.get(k);
    if (!vb || vb.length !== va.length) return true;
    for (let i = 0; i < va.length; i++)
      if (Math.abs((va[i] as number) - (vb[i] as number)) > EPS) return true;
  }
  return false;
}

/** Area of a part's outline polygon (vertices in path order), for the blink check. */
function outlineArea(ev: Evaluated, partId: string): number {
  for (const l of ev.layers)
    for (const it of l.items)
      if (it.kind === "part" && it.part.id === partId && it.part.kind === "vector") {
        const idx = it.part.paths.flatMap((p) => p.cmds.flatMap((c) => c.slice(1) as number[]));
        let a = 0;
        for (let i = 0; i < idx.length; i++) {
          const j = (i + 1) % idx.length;
          const p = idx[i] as number;
          const q = idx[j] as number;
          a +=
            (it.points[p * 2] as number) * (it.points[q * 2 + 1] as number) -
            (it.points[q * 2] as number) * (it.points[p * 2 + 1] as number);
        }
        return Math.abs(a) / 2;
      }
  return 0;
}

export function selfCheck(c: LoadedCharacter): Finding[] {
  const out: Finding[] = [];
  const fail = (code: string, where: string, message: string): void => {
    out.push({ level: "error", code, where, message });
  };
  const m = c.manifest;
  const cap = m.capabilities;
  const consumed = consumedChannels(c);
  const lod: Lod = cap.lod.includes("medium") ? "medium" : (cap.lod[0] as Lod);
  const base = evaluate(c, { channels: {}, lod });
  const baseSig = signature(base);

  for (const ch of cap.channels) {
    const spec = consumed.get(ch);
    if (!spec) continue; // reported by validate.ts
    const effect = spec.range.some((v) => {
      if (Math.abs(v - spec.rest) < 1e-9) return false;
      return changed(baseSig, signature(evaluate(c, { channels: { [ch]: v }, lod })));
    });
    if (!effect)
      fail("CAP_NO_EFFECT", `capabilities.channels.${ch}`, "neither end of its range changes the character");
  }

  for (const [group, ids] of Object.entries(cap.views)) {
    const g = m.views[group as "head" | "body"];
    if (!g) continue;
    for (const id of ids) {
      const v = g.views.find((x) => x.id === id);
      if (!v) continue;
      const ev = evaluate(c, { channels: { [g.yawChannel]: v.center.yaw }, lod });
      if (!ev.layers.some((l) => l.views[group] === id && l.weight > 0.5))
        fail(
          "CAP_VIEW_NOT_SELECTED",
          `capabilities.views.${group}.${id}`,
          `not selected at its centre (${v.center.yaw})`,
        );
    }
  }

  if (cap.face.blink && m.face.blink) {
    for (const eye of m.eyes) {
      const lid = `lid_${eye.id}`;
      const spec = consumed.get(lid);
      const clip = eye.views[0]?.clip;
      if (!spec || !clip) continue;
      const channels: Record<string, number> = {};
      const g = m.views.head;
      if (g) channels[g.yawChannel] = g.views.find((v) => v.id === eye.views[0]?.view)?.center.yaw ?? 0;
      const open = outlineArea(evaluate(c, { channels, lod }), clip);
      const shut = outlineArea(evaluate(c, { channels: { ...channels, [lid]: spec.range[1] }, lod }), clip);
      if (!(open > 0 && shut <= open * 0.1))
        fail(
          "CAP_BLINK",
          `eyes.${eye.id}`,
          `closing the lid leaves ${(100 * shut) / Math.max(open, 1e-9)}% of the opening`,
        );
    }
  }

  if (cap.face.gaze) {
    const g = consumed.get("gaze_x");
    const iris = (ev: Evaluated): number[] =>
      ev.layers.flatMap((l) =>
        l.items.flatMap((it) => (it.kind === "iris" ? [it.center[0], it.center[1]] : [])),
      );
    if (!g || !iris(base).length) fail("CAP_GAZE", "capabilities.face.gaze", "no iris is drawn at rest");
    else {
      const moved = iris(evaluate(c, { channels: { gaze_x: g.range[1] }, lod }));
      if (!moved.some((v, i) => Math.abs(v - (iris(base)[i] as number)) > EPS))
        fail("CAP_GAZE", "capabilities.face.gaze", "moving the target does not move the iris");
    }
  }

  for (const id of cap.wardrobe) {
    const o = m.wardrobe.find((w) => w.id === id);
    if (!o) continue;
    const ev = evaluate(c, { channels: {}, outfit: id, lod });
    const drawn = new Set(
      ev.layers.flatMap((l) => l.items.flatMap((it) => (it.kind === "part" ? [it.part.id] : []))),
    );
    for (const g of o.garments)
      for (const p of g.parts)
        if (!drawn.has(p) && !Object.values(m.views).some((vg) => vg?.views.some((v) => v.parts.includes(p))))
          fail("CAP_OUTFIT", `wardrobe.${id}`, `garment part '${p}' is not drawn`);
    for (const p of o.hides) if (drawn.has(p)) fail("CAP_OUTFIT", `wardrobe.${id}`, `'${p}' is still drawn`);
  }
  return out;
}
