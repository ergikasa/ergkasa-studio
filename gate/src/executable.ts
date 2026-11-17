/**
 * G16 executability (E1.4, capabilities v2): a package the gate passes is one the engine draws as the package
 * says. Every rule reads the engine's published capabilities; nothing here knows the engine's code.
 *
 *   output · audio · asset kinds and sources · rig height · projection × layer × builtin · roles (parallax) ·
 *   placement of builtins · required tracks · camera values · layers · actors · transitions · events · contacts ·
 *   captions · bounds (V2: every view the camera takes lies inside the scene's bounds)
 *
 * Codes: CAPABILITY_MISSING (the engine does not draw this), VALUE_UNSUPPORTED (it does not apply this value),
 * TRACK_MISSING (a channel it reads has no track), ROLE_MISSING (a required part of the projection is missing),
 * RIG_UNSUPPORTED, ID_DUPLICATE, VALUE_RANGE (bounds). Paths: the field at fault; when the field is missing, the
 * object that should have it.
 */
import { cameraViews, outside, type AssetManifest, type RenderPackage, type Track } from "@erkasa/contracts";
import {
  PLACEMENT,
  type BuiltinCapability,
  type ProjectionRule,
  type RenderCapabilities,
} from "./capabilities.js";
import { pointer as P, type Findings } from "./report.js";

type Pkg = RenderPackage;
type Asset = AssetManifest["assets"][number];
type Scene = Pkg["scenes"][number];
type Node = Scene["layers"][number]["nodes"][number];

const IDENTITY: Record<(typeof PLACEMENT)[number], unknown> = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  opacity: 1,
  flip: false,
  pivot: null,
};
const PLACEMENT_CHANNELS = new Set(["x", "y", "scale", "rotation", "opacity"]);
/** A builtin name pattern: an inner `*` is one segment (`prop.*.held`), a final `.*` any rest (`set.*`, `w0.*`). */
const matches = (pattern: string, name: string): boolean => {
  const esc = (x: string): string => x.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const parts = pattern.split("*").map(esc);
  const tail = pattern.endsWith("*") ? parts.slice(0, -1).join("[^.]+") + ".+" : parts.join("[^.]+");
  return new RegExp(`^${tail}$`).test(name);
};
/** The same values over the same times (the target aside). */
const sameTrack = (a: Track, b: Track): boolean =>
  JSON.stringify({ ...a, target: null }) === JSON.stringify({ ...b, target: null });

export function checkExecutable(
  F: Findings,
  pkg: Pkg,
  manifest: AssetManifest,
  assets: Map<string, { a: Asset; i: number }>,
  caps: RenderCapabilities,
): void {
  const builtins = new Map(caps.builtins.map((b) => [b.name, b]));

  // ---- output and audio
  const { width, height, fps } = pkg.output;
  if (!caps.output.sizes.some(([w, h]) => w === width && h === height)) {
    const ws = caps.output.sizes.map((s) => s[0]);
    const hs = caps.output.sizes.map((s) => s[1]);
    const sizes = caps.output.sizes.map((s) => s.join("×")).join(", ");
    if (!ws.includes(width))
      F.error("VALUE_UNSUPPORTED", "package", P("output", "width"), `${width}: this engine draws ${sizes}`);
    if (!hs.includes(height))
      F.error("VALUE_UNSUPPORTED", "package", P("output", "height"), `${height}: this engine draws ${sizes}`);
    if (ws.includes(width) && hs.includes(height))
      F.error(
        "VALUE_UNSUPPORTED",
        "package",
        P("output", "width"),
        `${width}×${height}: this engine draws ${sizes}`,
      );
  }
  if (!caps.output.fps.includes(fps))
    F.error(
      "VALUE_UNSUPPORTED",
      "package",
      P("output", "fps"),
      `${fps} fps: this engine draws ${caps.output.fps.join(", ")} fps`,
    );
  if (!caps.output.audio)
    pkg.audio.forEach((_, k) =>
      F.error(
        "CAPABILITY_MISSING",
        "package",
        P("audio", k),
        "this engine renders silent frames: no audio clip is played (the mix has nothing to mix)",
      ),
    );

  // ---- manifest: asset kinds and sources, rig height
  manifest.assets.forEach((a, i) => {
    const at = (...s: Array<string | number>): string => P("assets", i, ...s);
    if (!caps.assets.kinds.includes(a.kind))
      F.error(
        "CAPABILITY_MISSING",
        "manifest",
        at("kind"),
        `'${a.kind}' assets are not drawn by this engine`,
      );
    if (a.kind === "vector" && !caps.assets.stateSources.includes("element"))
      a.states.forEach((s, k) => {
        if ("element" in s)
          F.error(
            "CAPABILITY_MISSING",
            "manifest",
            at("states", k, "element"),
            `state '${s.name}' is an element of the asset's file: this engine draws only states with their own source`,
          );
      });
    if (a.kind === "rig") {
      if (!caps.assets.rigSources.includes(a.source.kind))
        F.error(
          "RIG_UNSUPPORTED",
          "manifest",
          at("source", "kind"),
          `a rig from a ${a.source.kind} source is not drawn by this engine`,
        );
      const b = a.source.kind === "builtin" ? builtins.get(a.source.name) : undefined;
      if (b?.rig && a.height !== b.rig.height)
        F.error(
          "VALUE_UNSUPPORTED",
          "manifest",
          at("height"),
          `${a.height}: '${b.name}' stands ${b.rig.height} tall`,
        );
    }
    if (a.kind === "font" && !caps.assets.fontSources.includes(a.source.kind))
      F.error(
        "CAPABILITY_MISSING",
        "manifest",
        at("source", "kind"),
        `a font from a ${a.source.kind} source is not drawn by this engine`,
      );
  });

  /** The builtin a node draws (its state's source, else the asset's), "file", or undefined if unresolved. */
  const drawnBy = (n: Node): { name: string; b?: BuiltinCapability } | undefined => {
    if (n.kind !== "asset") return undefined;
    const hit = assets.get(n.asset);
    if (!hit || hit.a.kind !== "vector") return undefined;
    const st = hit.a.states.find((s) => s.name === n.state);
    const src = st && "source" in st ? st.source : hit.a.source;
    if (src.kind === "file") return { name: "file" };
    const b = builtins.get(src.name);
    return b ? { name: src.name, b } : { name: src.name };
  };

  // ---- scenes
  const projection = new Map(pkg.scenes.map((s) => [s.id, s.camera.projection]));
  pkg.scenes.forEach((scene, si) => {
    const sp = (...x: Array<string | number>): string => P("scenes", si, ...x);
    const rule: ProjectionRule | undefined = caps.projections[scene.camera.projection];
    if (!rule) return; // CAPABILITY_MISSING at camera/projection (G15)
    const trackIndex = (kind: string, id: string | undefined, channel: string): number =>
      scene.tracks.findIndex(
        (t) =>
          t.channel === channel &&
          t.target.kind === kind &&
          ("id" in t.target ? t.target.id : undefined) === id,
      );

    // camera: tracks and values
    for (const c of rule.camera.channels)
      if (trackIndex("camera", undefined, c) < 0)
        F.error("TRACK_MISSING", "package", sp("camera"), `the camera's '${c}' has no track`);
    if (!rule.camera.aperture.includes(scene.camera.aperture))
      F.error(
        "VALUE_UNSUPPORTED",
        "package",
        sp("camera", "aperture"),
        `${scene.camera.aperture}: this engine draws aperture ${rule.camera.aperture.join(", ")}`,
      );
    for (const k of ["referenceDistance", "dolly"] as const) {
      const allowed = rule.camera[k];
      if (allowed && !allowed.includes(scene.camera[k]))
        F.error(
          "VALUE_UNSUPPORTED",
          "package",
          sp("camera", k),
          `${scene.camera[k]}: a ${scene.camera.projection} scene is drawn with ${k} ${allowed.join(", ")}`,
        );
    }

    // layers and nodes
    const all = [
      ...scene.layers.map((l, j) => ({ l, j, screen: false })),
      ...(scene.screen ?? []).map((l, j) => ({ l, j, screen: true })),
    ];
    let editorial = false;
    for (const { l, j, screen } of all)
      l.nodes.forEach((n, k) => {
        const np = (...x: Array<string | number>): string =>
          sp(screen ? "screen" : "layers", j, "nodes", k, ...x);
        const d = drawnBy(n);
        if (!d) return; // unresolved: G6/G7/G15 report it
        const allow = screen ? rule.screen : rule.layers;
        const ok = d.name === "file" ? allow.files : allow.builtins.some((p) => matches(p, d.name));
        if (!ok)
          F.error(
            "CAPABILITY_MISSING",
            "package",
            np("asset"),
            `'${d.name}' is not drawn in ${screen ? "the screen of " : ""}a ${scene.camera.projection} scene`,
          );
        if (rule.camera.editorial && d.name.startsWith(rule.camera.editorial.builtins)) editorial = true;
        if (!d.b || n.kind !== "asset") return;
        // placement: a builtin applies only the fields it lists
        const placement = d.b.placement ?? [];
        for (const f of PLACEMENT)
          if (!placement.includes(f) && JSON.stringify(n[f]) !== JSON.stringify(IDENTITY[f]))
            F.error(
              "VALUE_UNSUPPORTED",
              "package",
              np(f),
              `'${d.name}' does not apply ${f} (${JSON.stringify(n[f])}); it must be ${JSON.stringify(IDENTITY[f])}`,
            );
        scene.tracks.forEach((t, ti) => {
          if (
            t.target.kind === "node" &&
            t.target.id === n.id &&
            PLACEMENT_CHANNELS.has(t.channel) &&
            !placement.includes(t.channel as "x")
          )
            F.error(
              "VALUE_UNSUPPORTED",
              "package",
              sp("tracks", ti, "channel"),
              `'${d.name}' does not apply ${t.channel}`,
            );
        });
        // a parameter track the node's own drawing does not read (another state of the asset may read it)
        scene.tracks.forEach((t, ti) => {
          if (t.target.kind !== "node" || t.target.id !== n.id || !t.channel.startsWith("param.")) return;
          const id = t.channel.slice("param.".length);
          if (!(d.b?.parameters ?? []).some((p) => p.kind === "channel" && p.id === id))
            F.error(
              "VALUE_UNSUPPORTED",
              "package",
              sp("tracks", ti, "channel"),
              `'${d.name}' (state '${n.state}') does not read ${t.channel}`,
            );
        });
        // every channel parameter the builtin takes is read on every frame: it needs a track
        for (const p of d.b.parameters ?? [])
          if (p.kind === "channel" && trackIndex("node", n.id, `param.${p.id}`) < 0)
            F.error(
              "TRACK_MISSING",
              "package",
              np(),
              `'${d.name}' reads param.${p.id}, which has no track for '${n.id}'`,
            );
      });

    // editorial camera: centred at x
    if (editorial && rule.camera.editorial) {
      const ti = trackIndex("camera", undefined, "x");
      const t = scene.tracks[ti];
      const want = rule.camera.editorial.x;
      if (t?.kind === "samples")
        t.values.forEach((v, k) => {
          if (v !== want)
            F.error(
              "VALUE_UNSUPPORTED",
              "package",
              sp("tracks", ti, "values", k),
              `${String(v)}: an editorial scene is seen centred at x = ${want}`,
            );
        });
      else if (t?.kind === "keys")
        t.keys.forEach((key, k) => {
          if (key.v !== want)
            F.error(
              "VALUE_UNSUPPORTED",
              "package",
              sp("tracks", ti, "keys", k, "v"),
              `${String(key.v)}: an editorial scene is seen centred at x = ${want}`,
            );
        });
    }

    // layers: blur, lit (and, in parallax, roles)
    if (rule.layer.blur === "zero")
      scene.layers.forEach((l, j) => {
        if (l.blur !== 0)
          F.error(
            "VALUE_UNSUPPORTED",
            "package",
            sp("layers", j, "blur"),
            `${l.blur}: layers of a ${scene.camera.projection} scene are not blurred`,
          );
      });
    if (rule.layer.lit === "false")
      scene.layers.forEach((l, j) => {
        if (l.lit)
          F.error(
            "VALUE_UNSUPPORTED",
            "package",
            sp("layers", j, "lit"),
            `a ${scene.camera.projection} scene has no lights: no layer is lit`,
          );
      });
    if (Object.keys(rule.roles).length) checkRoles(F, scene, sp, rule, drawnBy);

    // actors: a layer of their own; rim and shadow as the projection draws them
    scene.actors.forEach((a, k) => {
      const l = scene.layers.find((x) => x.id === a.layer);
      const others = scene.actors.filter((b) => b.layer === a.layer).length;
      if (l && (l.nodes.length || others > 1))
        F.error(
          "VALUE_UNSUPPORTED",
          "package",
          sp("actors", k, "layer"),
          `'${a.layer}' holds ${l.nodes.length} node(s) and ${others} actor(s): an actor is drawn in a layer of its own (it is not sorted among nodes)`,
        );
      for (const f of ["rim", "shadow"] as const)
        if (a[f] !== rule.actors[f])
          F.error(
            "VALUE_UNSUPPORTED",
            "package",
            sp("actors", k, f),
            `${a[f]}: a ${scene.camera.projection} scene draws actors with ${f} ${rule.actors[f]}`,
          );
    });

    // events: visibility only; contacts: none
    scene.events.forEach((e, k) => {
      if ("state" in e && e.state !== undefined && !caps.events.state)
        F.error(
          "CAPABILITY_MISSING",
          "package",
          sp("events", k, "state"),
          "this engine does not change a node's state over time",
        );
      if (e.fx === "none" && e.duration !== caps.events.durationWithoutFx)
        F.error(
          "VALUE_UNSUPPORTED",
          "package",
          sp("events", k, "duration"),
          `${e.duration} s: a change without fx is instant (${caps.events.durationWithoutFx})`,
        );
    });
    if (!caps.contacts)
      scene.contacts.forEach((_, k) =>
        F.error(
          "CAPABILITY_MISSING",
          "package",
          sp("contacts", k),
          "this engine does not attach nodes to an actor's sockets (held props are drawn by prop.*.held)",
        ),
      );

    // bounds (V2): every view the camera takes
    const views = cameraViews(scene, width, height);
    if (views)
      for (const v of views) {
        const out = outside(scene.bounds, v);
        if (out.length) {
          const what = out.map((o) => `${o.side} by ${o.by}`).join(", ");
          F.error(
            "VALUE_RANGE",
            "package",
            sp("bounds"),
            `at t = ${v.t} s the camera sees [${v.x0}, ${v.x1}] × [${v.y0}, ${v.y1}], outside the bounds (${what})`,
          );
          break; // one finding per scene: the first instant
        }
      }
  });

  // ---- transitions: kind × projection before × projection after
  pkg.edit.forEach((c, k) => {
    if (k === 0) return;
    const from = projection.get(pkg.edit[k - 1]?.scene ?? "");
    const to = projection.get(c.scene);
    if (!from || !to) return; // EDIT_SCENE
    if (!(from in caps.projections) || !(to in caps.projections)) return; // the projection itself is refused (G15)
    // an unknown kind is reported by G15; here, a known kind between projections it is not drawn for
    if (!caps.transitions.some((t) => t.kind === c.enter.kind)) return;
    if (!caps.transitions.some((t) => t.kind === c.enter.kind && t.from === from && t.to === to))
      F.error(
        "CAPABILITY_MISSING",
        "package",
        P("edit", k, "enter", "kind"),
        `'${c.enter.kind}' from a ${from} scene into a ${to} scene is not drawn by this engine`,
      );
  });

  // ---- captions
  pkg.overlays.forEach((o, k) => {
    if (o.kind !== "captions") return;
    // captions are anchored on the screen by the schema itself (ScreenAnchor: x, y); following a node or an actor
    // exists only for overlays this engine refuses by kind
    if (!caps.captions.align.includes(o.style.align))
      F.error(
        "VALUE_UNSUPPORTED",
        "package",
        P("overlays", k, "style", "align"),
        `'${o.style.align}': captions are drawn ${caps.captions.align.join(", ")}`,
      );
    if (o.style.maxWidth !== undefined && !caps.captions.maxWidth)
      F.error(
        "VALUE_UNSUPPORTED",
        "package",
        P("overlays", k, "style", "maxWidth"),
        "captions are not wrapped to a width by this engine",
      );
  });
}

/** Parallax: every layer has a role; required roles once; values the engine reads from one layer are repeated. */
function checkRoles(
  F: Findings,
  scene: Scene,
  sp: (...x: Array<string | number>) => string,
  rule: ProjectionRule,
  drawnBy: (n: Node) => { name: string; b?: BuiltinCapability } | undefined,
): void {
  const roleOf = new Map<number, string>();
  const nodeOfRole = new Map<string, { j: number; k: number; n: Node }>();
  scene.layers.forEach((l, j) => {
    if (scene.actors.some((a) => a.layer === l.id)) return void roleOf.set(j, "actors");
    l.nodes.forEach((n, k) => {
      const d = drawnBy(n);
      if (!d) return;
      for (const [role, r] of Object.entries(rule.roles)) {
        if (!r.builtin || !matches(r.builtin, d.name)) continue;
        const params = (n.kind === "asset" ? n.params : undefined) ?? {};
        if (
          r.params &&
          !Object.entries(r.params).every(([p, v]) => JSON.stringify(params[p]) === JSON.stringify(v))
        )
          continue;
        if (roleOf.has(j) && roleOf.get(j) !== role)
          F.error(
            "VALUE_UNSUPPORTED",
            "package",
            sp("layers", j, "nodes", k),
            `the layer already has the role '${roleOf.get(j)}'; '${d.name}' would make it '${role}'`,
          );
        else roleOf.set(j, role);
        const prev = nodeOfRole.get(role);
        if (prev && role !== "held" && role !== "actors")
          F.error(
            "ID_DUPLICATE",
            "package",
            sp("layers", j, "nodes", k),
            `a second '${role}' (${d.name}); the first is layers/${prev.j}/nodes/${prev.k}`,
          );
        else if (!prev) nodeOfRole.set(role, { j, k, n });
      }
    });
  });
  for (const [role, r] of Object.entries(rule.roles))
    if (r.required && !nodeOfRole.has(role))
      F.error(
        "ROLE_MISSING",
        "package",
        sp("layers"),
        `a parallax scene needs its '${role}' layer (${r.builtin})`,
      );
  // nodes in the right role's layer: resting props on the furniture's plane, held props with the people
  scene.layers.forEach((l, j) => {
    const role = roleOf.get(j);
    if (!role && l.nodes.length)
      F.error(
        "CAPABILITY_MISSING",
        "package",
        sp("layers", j),
        `layer '${l.id}' has no role in a parallax scene; the engine draws only the roles ${Object.keys(rule.roles).join(", ")}`,
      );
    l.nodes.forEach((n, k) => {
      const d = drawnBy(n);
      if (d?.name.match(/^prop\..*\.resting$/) && role !== "mid")
        F.error(
          "CAPABILITY_MISSING",
          "package",
          sp("layers", j, "nodes", k, "asset"),
          `a prop at rest is drawn on the furniture's plane: it belongs to the 'mid' layer, not '${role ?? l.id}'`,
        );
    });
  });
  // values the compositor reads from one layer only
  const layerOf = (role: string): number | undefined =>
    role === "actors" ? [...roleOf].find(([, r]) => r === "actors")?.[0] : nodeOfRole.get(role)?.j;
  scene.layers.forEach((l, j) => {
    const role = roleOf.get(j);
    const r = role ? rule.roles[role] : undefined;
    if (!role || !r) return;
    if (l.lit !== r.lit)
      F.error(
        "VALUE_UNSUPPORTED",
        "package",
        sp("layers", j, "lit"),
        `${l.lit}: the engine draws the '${role}' layer ${r.lit ? "lit" : "unlit"}`,
      );
    for (const f of ["blur", "depth"] as const) {
      const readFrom: string | undefined = r[f] === "own" ? (role === "actors" ? "actors" : undefined) : r[f];
      const srcLayer: number | undefined = readFrom !== undefined ? layerOf(readFrom) : undefined;
      if (srcLayer === undefined || srcLayer === j) continue;
      const want = scene.layers[srcLayer]?.[f];
      if (want !== undefined && l[f] !== want)
        F.error(
          "VALUE_UNSUPPORTED",
          "package",
          sp("layers", j, f),
          `${l[f]}: the engine draws the '${role}' layer with the ${f} of '${scene.layers[srcLayer]?.id}' (${want})`,
        );
    }
  });
  // the place's state and world: read from one node, every other must repeat them
  const sf = rule.stateFrom;
  const src = sf ? nodeOfRole.get(sf.role) : undefined;
  if (sf && src)
    for (const [role, { j, k, n }] of nodeOfRole) {
      if (role === sf.role || role === "held" || role === "actors") continue;
      const d = drawnBy(n);
      for (const c of sf.channels) {
        if (!d?.b?.parameters?.some((p) => p.kind === "channel" && p.id === c)) continue;
        const ti = scene.tracks.findIndex(
          (t) => t.target.kind === "node" && t.target.id === n.id && t.channel === `param.${c}`,
        );
        const si = scene.tracks.findIndex(
          (t) => t.target.kind === "node" && t.target.id === src.n.id && t.channel === `param.${c}`,
        );
        const t = scene.tracks[ti];
        const s = scene.tracks[si];
        if (t && s && !sameTrack(t, s))
          F.error(
            "VALUE_UNSUPPORTED",
            "package",
            sp("tracks", ti),
            `the engine reads param.${c} of the place from '${src.n.id}'; '${n.id}' must repeat it`,
          );
      }
      for (const [p, fromRole] of Object.entries(sf.statics)) {
        const owner = nodeOfRole.get(fromRole);
        if (!owner || owner.n === n || n.kind !== "asset" || owner.n.kind !== "asset") continue;
        if (!(p in (n.params ?? {}))) continue;
        if (JSON.stringify(n.params?.[p]) !== JSON.stringify(owner.n.params?.[p]))
          F.error(
            "VALUE_UNSUPPORTED",
            "package",
            sp("layers", j, "nodes", k, "params", p),
            `the engine reads '${p}' from '${owner.n.id}'; '${n.id}' must repeat it`,
          );
      }
    }
}
