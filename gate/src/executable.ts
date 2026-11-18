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
 * RIG_UNSUPPORTED, ID_DUPLICATE, VALUE_RANGE (bounds), CAPTION_CONFLICT (E1.6: kinetic type in the caption band
 * while a phrase is on screen). Paths: the field at fault; when the field is missing, the
 * object that should have it.
 */
import {
  audibleDuration,
  cameraViews,
  captionPhraseWidth,
  kineticTypeExtent,
  MONTSERRAT_ADVANCE,
  type KineticLine,
  clipStartMs,
  outside,
  sceneLens,
  type AssetManifest,
  type RenderPackage,
  type Track,
} from "@erkasa/contracts";
import {
  PLACEMENT,
  type AudioCapability,
  type BuiltinCapability,
  type ProjectionRule,
  type RenderCapabilities,
} from "./capabilities.js";
import { schemaViolations } from "./json-schema.js";
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
  if (!caps.output.audio || !caps.audio)
    pkg.audio.forEach((_, k) =>
      F.error(
        "CAPABILITY_MISSING",
        "package",
        P("audio", k),
        "this engine renders silent frames: no audio clip is played (the mix has nothing to mix)",
      ),
    );
  else checkAudio(F, pkg, manifest, caps.audio);

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
        // static parameters: the values the drawing reads (the manifest says which are set, the engine which values)
        for (const p of d.b.parameters ?? []) {
          if (p.kind !== "static" || !(p.id in (n.params ?? {}))) continue;
          for (const v of schemaViolations(n.params?.[p.id], p.schema))
            F.error(
              "VALUE_UNSUPPORTED",
              "package",
              np("params", p.id) + v.path,
              `'${d.name}' ${p.id}: ${v.message}`,
            );
        }
        // channel parameters with discrete values
        for (const p of d.b.parameters ?? [])
          if (p.kind === "channel" && p.values) {
            const ti = trackIndex("node", n.id, `param.${p.id}`);
            discrete(
              F,
              scene.tracks[ti],
              p.values,
              (...x) => sp("tracks", ti, ...x),
              `'${d.name}' param.${p.id}`,
            );
          }
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
      // rig channels with discrete values (facing: the drawing mirrors by its sign)
      const ra = assets.get(a.rig)?.a;
      const rb =
        ra?.kind === "rig" && ra.source.kind === "builtin" ? builtins.get(ra.source.name) : undefined;
      for (const [c, values] of Object.entries(rb?.rig?.channelValues ?? {})) {
        const ti = trackIndex("actor", a.id, c);
        discrete(F, scene.tracks[ti], values, (...x) => sp("tracks", ti, ...x), `actor '${a.id}' ${c}`);
      }
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

    // bounds (V2, decision B): every view the camera takes, as the engine draws it
    const lens = sceneLens(scene, (n) => drawnBy(n)?.name, rule.camera);
    const views = lens ? cameraViews(scene, width, height, lens) : undefined;
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
    const zone = caps.captions.zone;
    if (!zone) return;
    // E1.6 (E-D2): captions live in their own band at the bottom of the frame
    const stroke = o.style.stroke?.width ?? 0;
    const base = o.at.y * height;
    if (base - o.style.size - stroke / 2 < zone.top || base + 0.3 * o.style.size + stroke / 2 > zone.bottom)
      F.error(
        "VALUE_RANGE",
        "package",
        P("overlays", k, "at", "y"),
        `captions at ${Math.round(base)} px (size ${o.style.size}) leave the caption band ${zone.top}..${zone.bottom} px`,
      );
    const font = assets.get(o.style.font)?.a;
    // a font that is not one of the engine's Montserrat weights is refused elsewhere (it has no builtin to draw it)
    if (font?.kind !== "font" || !MONTSERRAT_ADVANCE[font.weight]) return;
    o.phrases.forEach((ph, p) => {
      const w = captionPhraseWidth(
        ph.words.map((x) => x.text),
        o.style.size,
        font.weight,
        stroke,
      );
      if (w > zone.maxWidth)
        F.error(
          "VALUE_RANGE",
          "package",
          P("overlays", k, "phrases", p),
          `'${ph.words.map((x) => x.text).join(" ")}' is ${Math.round(w)} px wide; the caption band holds ${zone.maxWidth} px`,
        );
      // kinetic type on screen while the phrase is: never inside the band
      pkg.edit.forEach((cut) => {
        if (!(cut.start < ph.out && ph.in < cut.end)) return;
        const scene = pkg.scenes.find((s) => s.id === cut.scene);
        for (const layer of [...(scene?.layers ?? []), ...(scene?.screen ?? [])])
          for (const n of layer.nodes) {
            if (n.kind !== "asset" || !n.params || !Array.isArray(n.params["lines"])) continue;
            const a = assets.get(n.asset)?.a;
            const named =
              a?.kind === "vector" ? a.states.flatMap((st) => ("source" in st ? [st.source] : [])) : [];
            if (!named.some((src) => src.kind === "builtin" && src.name === "type.kinetic")) continue;
            const e = kineticTypeExtent(
              n.params["lines"] as unknown as KineticLine[],
              typeof n.params["y"] === "number" ? n.params["y"] : undefined,
            );
            if (e.bottom > zone.top && e.top < zone.bottom)
              F.error(
                "CAPTION_CONFLICT",
                "package",
                P("overlays", k, "phrases", p),
                `kinetic type ${cut.scene}/${n.id} (${Math.round(e.top)}..${Math.round(e.bottom)} px) reaches into the caption band ${zone.top}..${zone.bottom} px while '${ph.words[0]?.text ?? ""}…' is on screen (${cut.start}..${cut.end} s)`,
              );
          }
      });
    });
  });
}

/**
 * Audio (E1.5): every clip is mixed as the capabilities say, so a field the engine does not apply holds the only
 * value it may; a clip is heard for exactly its audible duration; the mix's fields are the ones the engine uses.
 */
/** Seconds of slack for sums of clip times (floating point): far below one sample at 48 kHz. */
const AUDIO_EPS = 1e-6;

function checkAudio(F: Findings, pkg: Pkg, manifest: AssetManifest, A: AudioCapability): void {
  const named = new Map(manifest.assets.map((a, i) => [`${a.id}@${a.version}`, { a, i }]));
  manifest.assets.forEach((a, i) => {
    if (a.kind === "audio" && !A.formats.includes(a.format))
      F.error(
        "VALUE_UNSUPPORTED",
        "manifest",
        P("assets", i, "format"),
        `'${a.format}': this engine reads ${A.formats.join(", ")} audio`,
      );
  });
  const count = new Map<string, number>();
  pkg.audio.forEach((c, k) => {
    const at = (...x: Array<string | number>): string => P("audio", k, ...x);
    const role = A.roles[c.role];
    if (!role) {
      F.error(
        "VALUE_UNSUPPORTED",
        "package",
        at("role"),
        `'${c.role}': this engine mixes ${Object.keys(A.roles).join(", ")} clips`,
      );
      return;
    }
    count.set(c.role, (count.get(c.role) ?? 0) + 1);
    if ((count.get(c.role) as number) > role.max)
      F.error(
        "VALUE_UNSUPPORTED",
        "package",
        at("role"),
        `more than ${role.max} '${c.role}' clip(s): this engine mixes at most ${role.max}`,
      );
    if (role.start === "zero" && c.start !== 0)
      F.error("VALUE_UNSUPPORTED", "package", at("start"), `${c.start}: a '${c.role}' clip starts at 0`);
    if (role.start === "whole-ms" && clipStartMs(c.start) === undefined)
      F.error(
        "VALUE_UNSUPPORTED",
        "package",
        at("start"),
        `${c.start}: the engine places clips in whole milliseconds`,
      );
    for (const f of ["trim", "fadeIn", "fadeOut", "pan"] as const) {
      const only = A.fixed[f];
      if (only !== undefined && c[f] !== only)
        F.error(
          "VALUE_UNSUPPORTED",
          "package",
          at(f),
          `${c[f]}: the engine does not apply ${f}; it must be ${only}`,
        );
    }
    const a = named.get(c.asset)?.a;
    if (a?.kind === "audio") {
      if (A.duration === "audible") {
        const want = audibleDuration(c.start, a.durationSec, pkg.output.duration);
        if (c.duration !== want)
          F.error(
            "VALUE_UNSUPPORTED",
            "package",
            at("duration"),
            `${c.duration}: the engine mixes the whole file (${a.durationSec} s) from ${c.start} s, heard for ${want} s in a ${pkg.output.duration} s film`,
          );
      } else {
        // at-most-audible (E1.6): the clip plays `duration` s of the file from `trim`, inside the film
        if (c.trim >= a.durationSec)
          F.error(
            "VALUE_RANGE",
            "package",
            at("trim"),
            `${c.trim}: the file lasts ${a.durationSec} s; nothing is left to play after the trim`,
          );
        else if (c.trim + c.duration > a.durationSec + AUDIO_EPS)
          F.error(
            "VALUE_RANGE",
            "package",
            at("duration"),
            `${c.duration}: only ${a.durationSec - c.trim} s of the file are left after a trim of ${c.trim} s`,
          );
        if (c.start + c.duration > pkg.output.duration + AUDIO_EPS)
          F.error(
            "VALUE_RANGE",
            "package",
            at("duration"),
            `${c.duration}: from ${c.start} s it would play past the end of the ${pkg.output.duration} s film`,
          );
      }
    }
    if (c.fadeIn > c.duration + AUDIO_EPS)
      F.error("VALUE_RANGE", "package", at("fadeIn"), `${c.fadeIn}: longer than the clip's ${c.duration} s`);
    else if (c.fadeIn + c.fadeOut > c.duration + AUDIO_EPS)
      F.error(
        "VALUE_RANGE",
        "package",
        at("fadeOut"),
        `fadeIn ${c.fadeIn} s + fadeOut ${c.fadeOut} s exceed the clip's ${c.duration} s`,
      );
  });
  // the mix (V1, E1.4): it has an effect only with audio clips; a package without any is silent, its mix unused
  if (!pkg.audio.length) return;
  const mix = pkg.mix;
  const [d0, d1] = A.duckMusicDb;
  if (mix.duckMusicDb < d0 || mix.duckMusicDb > d1)
    F.error(
      "VALUE_UNSUPPORTED",
      "package",
      P("mix", "duckMusicDb"),
      `${mix.duckMusicDb}: this engine applies ${d0}..${d1} dB (the depth of mix.ducking)`,
    );
  else if (mix.duckMusicDb > 0 && !mix.ducking)
    F.error(
      "VALUE_UNSUPPORTED",
      "package",
      P("mix", "duckMusicDb"),
      `${mix.duckMusicDb}: the engine applies duckMusicDb as the depth of mix.ducking, and the mix has no ducking`,
    );
  const has = (r: string): boolean => pkg.audio.some((c) => c.role === r);
  if (mix.ducking) {
    if (!A.ducking.kinds.includes(mix.ducking.kind))
      F.error(
        "VALUE_UNSUPPORTED",
        "package",
        P("mix", "ducking", "kind"),
        `'${mix.ducking.kind}': this engine ducks by ${A.ducking.kinds.join(", ")}`,
      );
    if (!has("voice") || !has("music"))
      F.error(
        "VALUE_UNSUPPORTED",
        "package",
        P("mix", "ducking"),
        "ducking applies only to a mix with a voice and a music clip; this one would be ignored",
      );
  }
  const L = mix.loudness;
  if (L.rangeLu === undefined)
    F.error(
      "VALUE_UNSUPPORTED",
      "package",
      P("mix", "loudness", "rangeLu"),
      "the engine normalises loudness to a range: rangeLu is required with audio",
    );
  const [i0, i1] = A.loudness.integratedLufs;
  const [p0, p1] = A.loudness.truePeakDb;
  if (L.integratedLufs < i0 || L.integratedLufs > i1)
    F.error(
      "VALUE_UNSUPPORTED",
      "package",
      P("mix", "loudness", "integratedLufs"),
      `${L.integratedLufs}: the engine normalises to ${i0}..${i1} LUFS`,
    );
  if (L.truePeakDb < p0 || L.truePeakDb > p1)
    F.error(
      "VALUE_UNSUPPORTED",
      "package",
      P("mix", "loudness", "truePeakDb"),
      `${L.truePeakDb}: the engine limits true peak to ${p0}..${p1} dB`,
    );
}

/**
 * A track of a channel that takes only `values`: every value is one of them, and between two keys of different
 * values the change is a `hold` (a linear key would pass through values in between).
 */
function discrete(
  F: Findings,
  t: Track | undefined,
  values: number[],
  at: (...x: Array<string | number>) => string,
  what: string,
): void {
  if (!t) return;
  const ok = (v: unknown): boolean => typeof v === "number" && values.includes(v);
  if (t.kind === "samples")
    t.values.forEach((v, k) => {
      if (!ok(v))
        F.error(
          "VALUE_UNSUPPORTED",
          "package",
          at("values", k),
          `${String(v)}: ${what} takes only ${values.join(", ")}`,
        );
    });
  else
    t.keys.forEach((key, k) => {
      if (!ok(key.v))
        F.error(
          "VALUE_UNSUPPORTED",
          "package",
          at("keys", k, "v"),
          `${String(key.v)}: ${what} takes only ${values.join(", ")}`,
        );
      else if (k > 0 && key.ease !== "hold" && key.v !== t.keys[k - 1]?.v)
        F.error(
          "VALUE_UNSUPPORTED",
          "package",
          at("keys", k, "ease"),
          `'${key.ease}' from ${String(t.keys[k - 1]?.v)} to ${String(key.v)}: ${what} changes only by 'hold'`,
        );
    });
}

/**
 * Parallax: every layer has a role, given as the projection declares it (`assign`); a role that does not repeat
 * is given once, required roles in every scene; every builtin is in a layer whose role draws it (`members`); the
 * values the engine reads from one layer (`blur`, `depth`: own, the role's first layer, or another role's) are
 * repeated. Nothing here names a role: what each role is comes from the capabilities.
 */
function checkRoles(
  F: Findings,
  scene: Scene,
  sp: (...x: Array<string | number>) => string,
  rule: ProjectionRule,
  drawnBy: (n: Node) => { name: string; b?: BuiltinCapability } | undefined,
): void {
  const roles = Object.entries(rule.roles);
  const actorRole = roles.find(([, r]) => r.assign === "actor")?.[0];
  const roleOf = new Map<number, string>();
  const nodeOfRole = new Map<string, { j: number; k: number; n: Node }>();
  scene.layers.forEach((l, j) => {
    if (actorRole && scene.actors.some((a) => a.layer === l.id)) roleOf.set(j, actorRole);
    l.nodes.forEach((n, k) => {
      const d = drawnBy(n);
      if (!d) return;
      for (const [role, r] of roles) {
        if (r.assign !== "node" || !matches(r.builtin, d.name)) continue;
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
        if (prev && !r.repeat)
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
  const firstLayer = (role: string): number | undefined =>
    [...roleOf.entries()]
      .filter(([, r]) => r === role)
      .map(([j]) => j)
      .sort((a, b) => a - b)[0];
  for (const [role, r] of roles)
    if (r.required && firstLayer(role) === undefined)
      F.error(
        "ROLE_MISSING",
        "package",
        sp("layers"),
        `a ${scene.camera.projection} scene needs its '${role}' layer (${r.builtin || r.assign})`,
      );
  // every node in a layer whose role draws it
  scene.layers.forEach((l, j) => {
    const role = roleOf.get(j);
    if (!role && l.nodes.length)
      F.error(
        "CAPABILITY_MISSING",
        "package",
        sp("layers", j),
        `layer '${l.id}' has no role in a ${scene.camera.projection} scene; the engine draws only the roles ${roles.map(([x]) => x).join(", ")}`,
      );
    l.nodes.forEach((n, k) => {
      const d = drawnBy(n);
      if (!d) return;
      const drawers = roles.filter(([, r]) => r.members.some((m) => matches(m, d.name))).map(([x]) => x);
      if (drawers.length && !(role && drawers.includes(role)))
        F.error(
          "CAPABILITY_MISSING",
          "package",
          sp("layers", j, "nodes", k, "asset"),
          `'${d.name}' is drawn as part of the ${drawers.map((x) => `'${x}'`).join(" or ")} layer, not ${role ? `'${role}'` : `layer '${l.id}', which has no role`}`,
        );
    });
  });
  // values the engine reads from one layer only
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
      if (r[f] === "own") continue;
      const from = r[f] === "first" ? role : r[f];
      const src = firstLayer(from);
      if (src === j) continue;
      const absent = rule.roles[from]?.absent?.[f];
      const want = src !== undefined ? scene.layers[src]?.[f] : absent;
      const whose =
        src !== undefined
          ? `the ${f} of '${scene.layers[src]?.id}'`
          : `the ${f} it uses when there is no '${from}' layer`;
      if (want !== undefined && l[f] !== want)
        F.error(
          "VALUE_UNSUPPORTED",
          "package",
          sp("layers", j, f),
          `${l[f]}: the engine draws the '${role}' layer with ${whose} (${want})`,
        );
    }
  });
  // the place's state and world: read from one node, every other must repeat them
  const sf = rule.stateFrom;
  const src = sf ? nodeOfRole.get(sf.role) : undefined;
  if (sf && src)
    for (const [role, { j, k, n }] of nodeOfRole) {
      if (role === sf.role) continue;
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
