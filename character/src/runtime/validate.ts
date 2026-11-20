/**
 * The package's internal consistency, beyond its schema: every reference resolves, the skeleton is a tree, the
 * geometry's indices are in range, weights are normalised, views of a group tile their channel's range without
 * overlap, and every capability the manifest declares is backed by data. (That each declared channel also has a
 * visible effect is the self-check, selfcheck.ts.)
 */
import { isHumanoidChannel } from "@erkasa/contracts";
import type { Finding } from "./errors.js";
import type { LoadedCharacter } from "./load.js";

type Input = Pick<LoadedCharacter, "manifest" | "parts" | "partById" | "textures">;

/** Channels the runtime consumes without a control: the gaze target, read by the eyes. */
export const GAZE_CHANNELS = ["gaze_x", "gaze_y", "gaze_z"] as const;

export function validateCharacter(c: Input): Finding[] {
  const out: Finding[] = [];
  const err = (code: string, where: string, message: string): void => {
    out.push({ level: "error", code, where, message });
  };
  const warn = (code: string, where: string, message: string): void => {
    out.push({ level: "warning", code, where, message });
  };
  const m = c.manifest;

  // ---------------------------------------------------------------------------------------------- skeleton
  const bones = new Map(m.skeleton.bones.map((b) => [b.id, b]));
  if (bones.size !== m.skeleton.bones.length)
    err("BONE_DUPLICATE", "skeleton.bones", "two bones with the same id");
  for (const b of m.skeleton.bones) {
    if (b.parent !== undefined && !bones.has(b.parent))
      err("BONE_PARENT_UNKNOWN", `skeleton.bones.${b.id}`, `parent '${b.parent}' is not a bone`);
    const seen = new Set<string>([b.id]);
    for (let p = b.parent; p !== undefined; p = bones.get(p)?.parent) {
      if (seen.has(p)) {
        err("BONE_CYCLE", `skeleton.bones.${b.id}`, "the bone is its own ancestor");
        break;
      }
      seen.add(p);
    }
  }
  if (!bones.has(m.origin)) err("ORIGIN_UNKNOWN", "origin", `'${m.origin}' is not a bone`);
  for (const s of [...m.skeleton.sockets, ...m.skeleton.contacts])
    if (!bones.has(s.bone)) err("SOCKET_BONE_UNKNOWN", `skeleton.${s.id}`, `bone '${s.bone}' does not exist`);

  // ---------------------------------------------------------------------------------------------- parts
  const morphs = new Set<string>();
  for (const p of c.parts) {
    const where = `${p.file}#${p.id}`;
    const n = p.vertices.length;
    if (p.binding.kind === "rigid") {
      if (!bones.has(p.binding.bone))
        err("PART_BONE_UNKNOWN", where, `bone '${p.binding.bone}' does not exist`);
    } else {
      for (const b of p.binding.bones)
        if (!bones.has(b)) err("PART_BONE_UNKNOWN", where, `bone '${b}' does not exist`);
      if (p.binding.weights.length !== n)
        err("WEIGHTS_COUNT", where, `${p.binding.weights.length} weight lists for ${n} vertices`);
      p.binding.weights.forEach((ws, i) => {
        const sum = ws.reduce((s, [, w]) => s + w, 0);
        if (Math.abs(sum - 1) > 1e-4) err("WEIGHTS_SUM", where, `vertex ${i}: weights sum to ${sum}`);
        for (const [bi] of ws)
          if (bi >= (p.binding.kind === "skin" ? p.binding.bones.length : 0))
            err("WEIGHT_BONE_INDEX", where, `vertex ${i}: bone index ${bi} out of range`);
      });
    }
    const ids = new Set<string>();
    for (const mo of p.morphs) {
      if (ids.has(mo.id)) err("MORPH_DUPLICATE", where, `morph '${mo.id}' twice`);
      ids.add(mo.id);
      morphs.add(mo.id);
      for (const [i] of mo.deltas)
        if (i >= n) err("MORPH_INDEX", where, `morph '${mo.id}': vertex ${i} out of range`);
    }
    if (p.kind === "vector") {
      p.paths.forEach((path, k) => {
        if (path.cmds[0]?.[0] !== "M") err("PATH_START", where, `path ${k} does not start with M`);
        for (const cmd of path.cmds)
          for (const i of cmd.slice(1) as number[])
            if (i >= n) err("PATH_INDEX", where, `path ${k}: vertex ${i} out of range`);
        if (!path.fill && !path.stroke) err("PATH_INVISIBLE", where, `path ${k} has neither fill nor stroke`);
        for (const paint of [path.fill, path.stroke?.paint]) {
          if (!paint || paint.kind === "solid") continue;
          const idx = paint.kind === "linear" ? [paint.from, paint.to] : [paint.center, paint.edge];
          for (const i of idx) if (i >= n) err("PAINT_INDEX", where, `gradient vertex ${i} out of range`);
        }
      });
    } else {
      if (p.uv.length !== n) err("UV_COUNT", where, `${p.uv.length} uv for ${n} vertices`);
      for (const t of p.triangles)
        for (const i of t) if (i >= n) err("TRIANGLE_INDEX", where, `vertex ${i} out of range`);
      for (const [lod, img] of Object.entries(p.images))
        if (img !== undefined && !c.textures.has(img))
          err("TEXTURE_FILE", where, `${lod} image '${img}' is not a texture of the package`);
    }
  }

  // ---------------------------------------------------------------------------------------------- controls
  const controlled = new Map<string, (typeof m.controls)[number]>();
  m.controls.forEach((ctl, k) => {
    const where = `controls[${k}] ${ctl.channel}`;
    if (controlled.has(ctl.channel)) err("CONTROL_DUPLICATE", where, "two controls for this channel");
    controlled.set(ctl.channel, ctl);
    if (!isHumanoidChannel(ctl.channel))
      err("CONTROL_CHANNEL", where, "not an erkasa.humanoid/1 channel and not an x_ extension");
    const [lo, hi] = ctl.range;
    if (!(lo < hi)) err("CONTROL_RANGE", where, "range is empty");
    if (ctl.rest < lo || ctl.rest > hi) err("CONTROL_REST", where, "rest is outside the range");
    for (const d of ctl.drives) {
      if (d.kind === "bone" && !bones.has(d.bone)) err("DRIVE_BONE_UNKNOWN", where, `bone '${d.bone}'`);
      if (d.kind === "morph" && !morphs.has(d.morph))
        err("DRIVE_MORPH_UNKNOWN", where, `no part has morph '${d.morph}'`);
      if (d.kind === "opacity" && !c.partById.has(d.part))
        err("DRIVE_PART_UNKNOWN", where, `part '${d.part}'`);
      if (d.kind !== "bone" && d.from === d.to) err("DRIVE_SPAN", where, "from equals to");
    }
  });

  // ---------------------------------------------------------------------------------------------- views
  const viewIds = new Map<string, string[]>();
  for (const [group, g] of Object.entries(m.views)) {
    if (!g) continue;
    const where = `views.${group}`;
    if (!isHumanoidChannel(g.yawChannel))
      err("VIEW_CHANNEL", where, `'${g.yawChannel}' is not a humanoid channel`);
    const sorted = [...g.views].sort((a, b) => a.yaw[0] - b.yaw[0]);
    viewIds.set(
      group,
      g.views.map((v) => v.id),
    );
    sorted.forEach((v, i) => {
      if (!(v.yaw[0] < v.yaw[1])) err("VIEW_RANGE", `${where}.${v.id}`, "empty yaw range");
      if (v.center.yaw < v.yaw[0] || v.center.yaw > v.yaw[1])
        err("VIEW_CENTER", `${where}.${v.id}`, "centre outside its range");
      const next = sorted[i + 1];
      if (next && Math.abs(next.yaw[0] - v.yaw[1]) > 1e-9)
        err("VIEW_TILING", `${where}.${v.id}`, `ends at ${v.yaw[1]}, the next view starts at ${next.yaw[0]}`);
      if (
        next &&
        v.blend > 0 &&
        (v.blend * 2 > v.yaw[1] - v.yaw[0] || v.blend * 2 > next.yaw[1] - next.yaw[0])
      )
        err("VIEW_BLEND", `${where}.${v.id}`, "the blend band is wider than a view");
      for (const p of v.parts)
        if (!c.partById.has(p)) err("VIEW_PART_UNKNOWN", `${where}.${v.id}`, `part '${p}'`);
    });
    const owner = new Map<string, string>();
    for (const v of g.views)
      for (const p of v.parts) {
        if (owner.has(p))
          err("VIEW_PART_TWICE", `${where}.${v.id}`, `part '${p}' is also in view ${owner.get(p)}`);
        owner.set(p, v.id);
      }
  }

  // ---------------------------------------------------------------------------------------------- face, eyes, hands
  const face = m.face;
  for (const au of face.aus)
    if (!controlled.get(au)?.drives.some((d) => d.kind === "morph"))
      err("FACE_AU_WITHOUT_CONTROL", `face.aus.${au}`, "no control drives a morph for this unit");
  for (const v of face.visemes) {
    for (const au of Object.keys(v.aus))
      if (!face.aus.includes(au as (typeof face.aus)[number]))
        err("VISEME_AU_UNDECLARED", `face.visemes.${v.id}`, `unit ${au} is not in face.aus`);
    if (v.jaw > 0 && !controlled.has("jaw_open"))
      err("VISEME_JAW", `face.visemes.${v.id}`, "uses the jaw, no jaw_open control");
  }
  if (face.blink) {
    for (const [side, morph] of Object.entries(face.blink)) {
      if (!morphs.has(morph))
        err("BLINK_MORPH_UNKNOWN", `face.blink.${side}`, `no part has morph '${morph}'`);
      if (!controlled.get(`lid_${side}`)?.drives.some((d) => d.kind === "morph" && d.morph === morph))
        err("BLINK_CONTROL", `face.blink.${side}`, `lid_${side} does not drive '${morph}'`);
    }
  }
  const headViews = viewIds.get("head") ?? [];
  for (const eye of m.eyes) {
    const where = `eyes.${eye.id}`;
    if (!bones.has(eye.bone)) err("EYE_BONE_UNKNOWN", where, `bone '${eye.bone}'`);
    for (const ev of eye.views) {
      if (headViews.length ? !headViews.includes(ev.view) : ev.view !== "default")
        err(
          "EYE_VIEW_UNKNOWN",
          `${where}.${ev.view}`,
          "not a head view (a face without head views uses 'default')",
        );
      const clip = c.partById.get(ev.clip);
      if (!clip) err("EYE_CLIP_UNKNOWN", `${where}.${ev.view}`, `part '${ev.clip}'`);
      else if (ev.centerVertex >= clip.vertices.length)
        err("EYE_CENTER_VERTEX", `${where}.${ev.view}`, "out of range");
      if (ev.over !== undefined && !c.partById.has(ev.over))
        err("EYE_OVER_UNKNOWN", `${where}.${ev.view}`, `part '${ev.over}'`);
    }
    for (const hv of headViews)
      if (!eye.views.some((ev) => ev.view === hv))
        warn("EYE_VIEW_MISSING", where, `no geometry for head view '${hv}'`);
  }
  if (m.eyes.length && !face.gaze) err("GAZE_RIG", "face.gaze", "eyes without a gaze rig");
  for (const h of m.hands) {
    const where = `hands.${h.side}`;
    if (!bones.has(h.wrist)) err("HAND_BONE_UNKNOWN", where, `wrist '${h.wrist}'`);
    for (const f of h.fingers)
      for (const b of f.bones) if (!bones.has(b)) err("HAND_BONE_UNKNOWN", where, `finger bone '${b}'`);
    if (!m.skeleton.sockets.some((s) => s.id === h.socket))
      err("HAND_SOCKET_UNKNOWN", where, `socket '${h.socket}'`);
  }

  // ---------------------------------------------------------------------------------------------- wardrobe
  const garmentParts = new Set<string>();
  for (const o of m.wardrobe) {
    for (const g of o.garments)
      for (const p of g.parts) {
        if (!c.partById.has(p)) err("OUTFIT_PART_UNKNOWN", `wardrobe.${o.id}`, `part '${p}'`);
        garmentParts.add(p);
      }
    for (const p of o.hides)
      if (!c.partById.has(p)) err("OUTFIT_HIDES_UNKNOWN", `wardrobe.${o.id}`, `part '${p}'`);
  }
  for (const g of Object.values(m.views))
    for (const v of g?.views ?? [])
      for (const p of v.parts)
        if (garmentParts.has(p))
          err("OUTFIT_PART_IN_VIEW", `views.${v.id}`, `garment part '${p}' cannot also be a view's part`);

  // ---------------------------------------------------------------------------------------------- capabilities
  const cap = m.capabilities;
  const consumed = new Set<string>([...controlled.keys()]);
  if (face.gaze) for (const g of GAZE_CHANNELS) consumed.add(g);
  for (const g of Object.values(m.views)) if (g) consumed.add(g.yawChannel);
  for (const ch of cap.channels)
    if (!consumed.has(ch))
      err("CAP_CHANNEL_UNDECLARED", `capabilities.channels.${ch}`, "nothing in the package consumes it");
  for (const ch of consumed)
    if (!cap.channels.includes(ch))
      warn("CAP_CHANNEL_UNLISTED", `capabilities.channels`, `'${ch}' is consumed but not declared`);
  for (const [group, ids] of Object.entries(cap.views))
    for (const id of ids)
      if (!(viewIds.get(group) ?? []).includes(id))
        err("CAP_VIEW", `capabilities.views.${group}`, `no view '${id}'`);
  for (const au of cap.face.aus)
    if (!face.aus.includes(au)) err("CAP_FACE", "capabilities.face.aus", `${au} is not in face.aus`);
  for (const v of cap.face.visemes)
    if (!face.visemes.some((x) => x.id === v))
      err("CAP_FACE", "capabilities.face.visemes", `viseme ${v} is not defined`);
  if (cap.face.blink && !face.blink) err("CAP_FACE", "capabilities.face.blink", "no blink rig");
  if (cap.face.gaze && (!face.gaze || m.eyes.length === 0))
    err("CAP_FACE", "capabilities.face.gaze", "no eyes or gaze rig");
  if (cap.face.jaw && !controlled.has("jaw_open"))
    err("CAP_FACE", "capabilities.face.jaw", "no jaw_open control");
  if (cap.hands.fingers && !m.hands.some((h) => h.fingers.length > 0))
    err("CAP_HANDS", "capabilities.hands.fingers", "no hand has finger bones");
  for (const o of cap.wardrobe)
    if (!m.wardrobe.some((w) => w.id === o)) err("CAP_WARDROBE", "capabilities.wardrobe", `no outfit '${o}'`);
  for (const w of m.wardrobe)
    if (!cap.wardrobe.includes(w.id))
      warn("CAP_WARDROBE_UNLISTED", "capabilities.wardrobe", `outfit '${w.id}' is not declared`);
  const listed = new Map(m.files.map((f) => [f.path, f]));
  const evidenced = new Set(cap.evidence.map((e) => e.capability));
  for (const e of cap.evidence)
    if (listed.get(e.report)?.role !== "report")
      err(
        "CAP_EVIDENCE",
        `capabilities.evidence.${e.capability}`,
        `report '${e.report}' is not a report file of the package`,
      );
  for (const l of cap.locomotion)
    if (!evidenced.has(`locomotion.${l}`))
      err("CAP_EVIDENCE", `capabilities.locomotion.${l}`, "declared without a passing report");
  for (const i of cap.interactions)
    if (!evidenced.has(`interactions.${i}`))
      err("CAP_EVIDENCE", `capabilities.interactions.${i}`, "declared without a passing report");
  for (const lod of cap.lod)
    for (const p of c.parts)
      if (p.kind === "texture" && p.images[lod] === undefined)
        err("CAP_LOD", `capabilities.lod.${lod}`, `texture part '${p.id}' has no ${lod} image`);
  return out;
}
