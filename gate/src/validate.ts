/**
 * The Validation Gate: may this Render Package be rendered by this engine?
 *
 * Groups (codes in docs/reports/e1-3-validation-gate.md):
 *   G1 schema · G2 manifest pin · G3 files · G4 approval · G5 builtins · G6 references · G7 states and fx ·
 *   G8 procedural parameters · G9 tracks · G10 ids · G11 times · G12 contacts · G13 actors · G14 budgets ·
 *   G15 capabilities
 *
 * Every check runs and every finding is reported; if the package or the manifest does not match its schema, the
 * checks that rely on its structure are skipped (their findings would be noise).
 */
import { realpathSync, statSync } from "node:fs";
import { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { DEFAULT_BUDGETS, type Budgets } from "./budgets.js";
import { capabilityProblems, type BuiltinCapability, type RenderCapabilities } from "./capabilities.js";
import { readContained, type VerifiedFile } from "./files.js";
import { Findings, pointer as P, type GateReport } from "./report.js";

type Pkg = RenderPackage;
type Manifest = AssetManifest;
type Asset = Manifest["assets"][number];
type Scene = Pkg["scenes"][number];
type Source = Asset["source"];

export interface GateInput {
  /** The package exactly as it will be rendered (bytes or text). */
  package: Uint8Array | string;
  /** The package root: the manifest and every file asset are resolved inside it. */
  root: string;
  /** The engine's render capabilities (film `capabilities().render`), as data. */
  capabilities: RenderCapabilities;
  budgets?: Partial<Budgets>;
}

export interface GateResult extends GateReport {
  /** Only when ok: the documents and every file asset's verified bytes, keyed by `id@version` (state files by `id@version#state`). */
  verified?: { package: Pkg; manifest: Manifest; files: Map<string, VerifiedFile> };
}

const NODE_CHANNELS = new Set(["x", "y", "scale", "rotation", "opacity"]);
const CAMERA_CHANNELS = new Set(["x", "y", "height", "focus", "shake"]);
const LIGHT_CHANNELS = new Set(["intensity", "color", "radius", "x", "y"]);
const ACTOR_CHANNELS = new Set(["root.x", "root.y", "root.scale", "facing", "turn"]);
const EPS = 1e-9;
const ref = (a: { id: string; version: number }): string => `${a.id}@${a.version}`;

export function validate(input: GateInput): GateResult {
  const F = new Findings();
  const budgets: Budgets = { ...DEFAULT_BUDGETS, ...input.budgets };
  const caps = input.capabilities;

  // ---- capabilities: a description the gate cannot trust is a failure of the gate's input, not of the package
  const capProblems = capabilityProblems(caps);
  for (const p of capProblems) F.error("CAPABILITIES_INVALID", "capabilities", "", p);
  if (capProblems.length) return F.report();

  // ---- G14 package size, G1 package schema
  const bytes = typeof input.package === "string" ? Buffer.from(input.package) : Buffer.from(input.package);
  if (bytes.length > budgets.packageBytes)
    F.error("BUDGET_PACKAGE_BYTES", "package", "", `${bytes.length} bytes, budget ${budgets.packageBytes}`);
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString("utf8"));
  } catch (e) {
    F.error("PACKAGE_PARSE", "package", "", `not JSON: ${(e as Error).message}`);
    return F.report();
  }
  const declared = (raw as { schema?: unknown })?.schema;
  if (typeof declared === "string" && declared.startsWith("erkasa.render/") && declared !== caps.contract) {
    F.error(
      "UNKNOWN_VERSION",
      "package",
      P("schema"),
      `'${declared}' is not the contract this engine reads (${caps.contract})`,
    );
    return F.report();
  }
  const parsed = RenderPackage.safeParse(raw);
  if (!parsed.success) {
    for (const i of parsed.error.issues) F.error("SCHEMA", "package", P(...i.path.map(String)), i.message);
    return F.report();
  }
  const pkg = parsed.data;

  // ---- G2 the pinned manifest, read through the same contained reader as every asset
  let rootReal: string;
  try {
    rootReal = realpathSync.native(input.root);
    if (!statSync(rootReal).isDirectory()) throw new Error("not a directory");
  } catch (e) {
    F.error("ROOT_INVALID", "package", "", `package root '${input.root}': ${(e as Error).message}`);
    return F.report();
  }
  const mread = readContained(rootReal, pkg.assetManifest.uri, budgets.packageBytes);
  if (!mread.ok) {
    F.error(mread.code, "package", P("assetManifest", "uri"), mread.message);
    return F.report();
  }
  if (mread.file.sha256 !== pkg.assetManifest.sha256)
    F.error(
      "MANIFEST_HASH",
      "package",
      P("assetManifest", "sha256"),
      `the manifest's sha256 is ${mread.file.sha256}`,
    );
  let mraw: unknown;
  try {
    mraw = JSON.parse(mread.file.bytes.toString("utf8"));
  } catch (e) {
    F.error("MANIFEST_PARSE", "manifest", "", `not JSON: ${(e as Error).message}`);
    return F.report();
  }
  const mdeclared = (mraw as { schema?: unknown })?.schema;
  if (
    typeof mdeclared === "string" &&
    mdeclared.startsWith("erkasa.assets/") &&
    mdeclared !== "erkasa.assets/1"
  ) {
    F.error(
      "UNKNOWN_VERSION",
      "manifest",
      P("schema"),
      `'${mdeclared}' is not a manifest version this gate reads`,
    );
    return F.report();
  }
  const mparsed = AssetManifest.safeParse(mraw);
  if (!mparsed.success) {
    for (const i of mparsed.error.issues) F.error("SCHEMA", "manifest", P(...i.path.map(String)), i.message);
    return F.report();
  }
  const manifest = mparsed.data;

  // ---- manifest: ids, used assets, approval, files, builtins
  const assets = new Map<string, { a: Asset; i: number }>();
  manifest.assets.forEach((a, i) => {
    if (assets.has(ref(a)))
      F.error("ID_DUPLICATE", "manifest", P("assets", i, "id"), `${ref(a)} is declared twice`);
    else assets.set(ref(a), { a, i });
  });
  if (manifest.assets.length > budgets.assets)
    F.error(
      "BUDGET_ASSETS",
      "manifest",
      P("assets"),
      `${manifest.assets.length} assets, budget ${budgets.assets}`,
    );
  const used = usedRefs(pkg);
  for (const [r, { i }] of assets)
    if (!used.has(r)) F.warn("ASSET_UNUSED", "manifest", P("assets", i), `${r} is not used by the package`);

  const builtins = new Map(caps.builtins.map((b) => [b.name, b]));
  const files = new Map<string, VerifiedFile>();
  for (const [r, { a, i }] of assets) {
    const at = (...s: Array<string | number>): string => P("assets", i, ...s);
    // G7 manifest-side state consistency
    if (a.kind === "vector") {
      const names = a.states.map((s) => s.name);
      a.states.forEach((s, k) => {
        if (names.indexOf(s.name) !== k)
          F.error("ID_DUPLICATE", "manifest", at("states", k, "name"), `state '${s.name}' is declared twice`);
      });
      if (!names.includes(a.defaultState))
        F.error(
          "STATE_UNDECLARED",
          "manifest",
          at("defaultState"),
          `'${a.defaultState}' is not a state of ${r}`,
        );
      a.affordances.forEach((af, k) => {
        const refs = af.kind === "openable" ? [af.closed, af.open] : af.kind === "readable" ? [af.state] : [];
        for (const s of refs)
          if (!names.includes(s))
            F.error("STATE_UNDECLARED", "manifest", at("affordances", k), `'${s}' is not a state of ${r}`);
      });
    }
    // G4 approval of what the package uses
    if (used.has(r) && a.approval.status !== "approved")
      F.error("NOT_APPROVED", "manifest", at("approval", "status"), `${r} is '${a.approval.status}'`);
    // G15 rig formats
    if (a.kind === "rig" && !caps.rigFormats.includes(a.format))
      F.error(
        "CAPABILITY_MISSING",
        "manifest",
        at("format"),
        `rig format '${a.format}' is not drawn by this engine`,
      );
    // G3 files and G5 builtins, for the asset's source and every state's own source
    const sources: Array<{ s: Source; path: string; key: string }> = [
      { s: a.source, path: at("source"), key: r },
    ];
    if (a.kind === "vector")
      a.states.forEach((st, k) => {
        if ("source" in st)
          sources.push({ s: st.source, path: at("states", k, "source"), key: `${r}#${st.name}` });
      });
    const seenBuiltins: BuiltinCapability[] = [];
    for (const { s, path, key } of sources) {
      if (s.kind === "file") {
        const out = readContained(rootReal, s.uri, budgets.assetBytes);
        if (!out.ok) F.error(out.code, "manifest", P(...path.split("/").slice(1), "uri"), out.message);
        else if (out.file.sha256 !== s.sha256)
          F.error(
            "FILE_HASH",
            "manifest",
            P(...path.split("/").slice(1), "sha256"),
            `${s.uri}: sha256 is ${out.file.sha256}`,
          );
        else files.set(key, out.file);
        continue;
      }
      const b = builtins.get(s.name);
      const bp = (...x: string[]): string => P(...path.split("/").slice(1), ...x);
      if (!b) {
        F.error("BUILTIN_UNKNOWN", "manifest", bp("name"), `'${s.name}' is not a builtin of this engine`);
        continue;
      }
      if (b.status === "removed")
        F.error("BUILTIN_REMOVED", "manifest", bp("name"), `'${s.name}' was removed from the engine`);
      if (b.status === "deprecated")
        F.warn("BUILTIN_DEPRECATED", "manifest", bp("name"), `'${s.name}' is deprecated`);
      if (b.version !== s.version)
        F.error(
          "BUILTIN_MISMATCH",
          "manifest",
          bp("version"),
          `'${s.name}' is version ${b.version} in this engine, the manifest pins ${s.version}`,
        );
      if (b.fingerprint !== s.fingerprint)
        F.error(
          "BUILTIN_MISMATCH",
          "manifest",
          bp("fingerprint"),
          `'${s.name}' fingerprint differs from the engine's (${b.fingerprint})`,
        );
      if (b.kind !== a.kind)
        F.error(
          "BUILTIN_KIND",
          "manifest",
          bp("name"),
          `'${s.name}' draws a ${b.kind}, the asset is a ${a.kind}`,
        );
      seenBuiltins.push(b);
    }
    // G8 declared parameters of a procedural asset must be what its builtins take
    if (a.kind === "vector") checkParameters(F, at, r, a.parameters ?? [], seenBuiltins);
    if (a.kind === "rig") checkRig(F, at, r, a, seenBuiltins);
    if (a.kind === "font") {
      for (const b of seenBuiltins)
        if (b.font && (b.font.family !== a.family || b.font.weight !== a.weight))
          F.error(
            "BUILTIN_MISMATCH",
            "manifest",
            at("family"),
            `${r} declares ${a.family} ${a.weight}, '${b.name}' is ${b.font.family} ${b.font.weight}`,
          );
    }
  }

  // ---- package
  checkPackage(F, pkg, assets, caps, budgets);

  const report = F.report();
  return report.ok ? { ...report, verified: { package: pkg, manifest, files } } : report;
}

// ------------------------------------------------------------------------------------------------ manifest helpers

function checkParameters(
  F: Findings,
  at: (...s: Array<string | number>) => string,
  r: string,
  params: NonNullable<Extract<Asset, { kind: "vector" }>["parameters"]>,
  builtins: BuiltinCapability[],
): void {
  const engines = builtins.filter((b) => b.kind === "vector");
  if (!engines.length) return;
  // one finding per parameter, naming every builtin of the asset that disagrees
  params.forEach((p, k) => {
    const missing = engines.filter((b) => {
      const e = (b.parameters ?? []).find((x) => x.id === p.id);
      return !e || e.kind !== p.kind;
    });
    if (missing.length) {
      F.error(
        "PARAM_UNSUPPORTED",
        "manifest",
        at("parameters", k),
        `${r}: ${missing.map((b) => `'${b.name}'`).join(", ")} take(s) no ${p.kind} parameter '${p.id}'`,
      );
      return;
    }
    if (p.kind !== "channel") return;
    const narrower = engines.filter((b) => {
      const e = (b.parameters ?? []).find((x) => x.id === p.id);
      return e?.kind === "channel" && (p.range[0] < e.range[0] || p.range[1] > e.range[1]);
    });
    if (narrower.length)
      F.error(
        "PARAM_UNSUPPORTED",
        "manifest",
        at("parameters", k, "range"),
        `${r}: '${p.id}' range [${p.range}] exceeds what ${narrower.map((b) => `'${b.name}'`).join(", ")} accept(s)`,
      );
  });
  const mine = new Set(params.map((p) => p.id));
  const needed = new Map<string, string[]>();
  for (const b of engines)
    for (const e of b.parameters ?? [])
      if (!mine.has(e.id)) {
        const what = `${e.kind} parameter '${e.id}'`;
        needed.set(what, [...(needed.get(what) ?? []), `'${b.name}'`]);
      }
  for (const [what, names] of needed)
    F.error(
      "PARAM_NOT_DECLARED",
      "manifest",
      at(params.length ? "parameters" : "states"),
      `${r}: ${names.join(", ")} need(s) ${what}`,
    );
}

function checkRig(
  F: Findings,
  at: (...s: Array<string | number>) => string,
  r: string,
  a: Extract<Asset, { kind: "rig" }>,
  builtins: BuiltinCapability[],
): void {
  for (const b of builtins) {
    if (!b.rig) continue;
    const rig = b.rig;
    if (rig.format !== a.format)
      F.error("RIG_UNSUPPORTED", "manifest", at("format"), `${r}: '${b.name}' is ${rig.format}`);
    const not = (what: string, xs: string[], have: string[], path: string): void => {
      xs.forEach((x, k) => {
        if (!have.includes(x))
          F.error("RIG_UNSUPPORTED", "manifest", at(path, k), `${r}: '${b.name}' has no ${what} '${x}'`);
      });
    };
    not(
      "bone",
      a.bones.map((x) => x.id),
      rig.bones,
      "bones",
    );
    not(
      "channel",
      a.channels.map((x) => x.id),
      rig.channels,
      "channels",
    );
    not(
      "socket",
      a.sockets.map((x) => x.id),
      rig.sockets,
      "sockets",
    );
    not("slot", a.slots, rig.slots, "slots");
  }
}

/** Every `id@version` the package names. */
function usedRefs(pkg: Pkg): Set<string> {
  const out = new Set<string>();
  for (const s of pkg.scenes) {
    for (const l of [...s.layers, ...(s.screen ?? [])])
      for (const n of l.nodes) {
        if (n.kind === "asset") out.add(n.asset);
        if (n.kind === "text") out.add(n.font);
      }
    for (const a of s.actors) out.add(a.rig);
  }
  for (const o of pkg.overlays) {
    if (o.kind === "icon") out.add(o.asset);
    else out.add(o.style.font);
  }
  for (const c of pkg.audio) out.add(c.asset);
  return out;
}

// ------------------------------------------------------------------------------------------------ package

function checkPackage(
  F: Findings,
  pkg: Pkg,
  assets: Map<string, { a: Asset; i: number }>,
  caps: RenderCapabilities,
  budgets: Budgets,
): void {
  const dur = pkg.output.duration;
  const fps = pkg.output.fps;
  const within = (t: number): boolean => t >= -EPS && t <= dur + EPS;
  const asset = (r: string, kind: Asset["kind"], path: string): Asset | undefined => {
    const hit = assets.get(r)?.a;
    if (!hit) F.error("ASSET_MISSING", "package", path, `${r} is not in the manifest`);
    else if (hit.kind !== kind)
      F.error("ASSET_KIND", "package", path, `${r} is a ${hit.kind}, a ${kind} is needed here`);
    return hit && hit.kind === kind ? hit : undefined;
  };

  // G14 budgets
  if (dur > budgets.durationSec)
    F.error(
      "BUDGET_DURATION",
      "package",
      P("output", "duration"),
      `${dur} s, budget ${budgets.durationSec} s`,
    );
  if (pkg.scenes.length > budgets.scenes)
    F.error("BUDGET_SCENES", "package", P("scenes"), `${pkg.scenes.length} scenes, budget ${budgets.scenes}`);
  let nodes = 0;
  let tracks = 0;
  let samples = 0;

  // G10 scene ids
  const sceneIds = new Map<string, number>();
  pkg.scenes.forEach((s, i) => {
    if (sceneIds.has(s.id))
      F.error("ID_DUPLICATE", "package", P("scenes", i, "id"), `scene '${s.id}' is declared twice`);
    else sceneIds.set(s.id, i);
  });

  pkg.scenes.forEach((scene, si) => {
    const sp = (...x: Array<string | number>): string => P("scenes", si, ...x);
    // G15 projection and lights
    if (!caps.projections.includes(scene.camera.projection))
      F.error(
        "CAPABILITY_MISSING",
        "package",
        sp("camera", "projection"),
        `projection '${scene.camera.projection}' is not drawn by this engine`,
      );
    scene.lights.forEach((l, k) => {
      if (!caps.lightKinds.includes(l.kind))
        F.error(
          "CAPABILITY_MISSING",
          "package",
          sp("lights", k, "kind"),
          `light '${l.kind}' is not drawn by this engine`,
        );
    });
    // G10 ids inside the scene; collect nodes
    const layerIds = new Map<string, string>();
    const nodeIndex = new Map<
      string,
      { n: Scene["layers"][number]["nodes"][number]; path: string; known: boolean; a?: Asset }
    >();
    const groups: Array<["layers" | "screen", Scene["layers"] | NonNullable<Scene["screen"]>]> = [
      ["layers", scene.layers],
      ["screen", scene.screen ?? []],
    ];
    let sceneNodes = 0;
    for (const [g, list] of groups)
      list.forEach((l, li) => {
        if (layerIds.has(l.id))
          F.error("ID_DUPLICATE", "package", sp(g, li, "id"), `layer '${l.id}' is declared twice`);
        else layerIds.set(l.id, g);
        l.nodes.forEach((n, ni) => {
          sceneNodes++;
          const np = sp(g, li, "nodes", ni);
          if (nodeIndex.has(n.id)) {
            F.error(
              "ID_DUPLICATE",
              "package",
              P(...np.split("/").slice(1), "id"),
              `node '${n.id}' is declared twice in scene '${scene.id}'`,
            );
            return;
          }
          if (!caps.nodeKinds.includes(n.kind))
            F.error(
              "CAPABILITY_MISSING",
              "package",
              P(...np.split("/").slice(1), "kind"),
              `node kind '${n.kind}' is not drawn by this engine`,
            );
          let a: Asset | undefined;
          if (n.kind === "asset") {
            a = asset(n.asset, "vector", P(...np.split("/").slice(1), "asset"));
            if (a && a.kind === "vector") {
              if (!a.states.some((s) => s.name === n.state))
                F.error(
                  "STATE_UNDECLARED",
                  "package",
                  P(...np.split("/").slice(1), "state"),
                  `'${n.state}' is not a state of ${n.asset}`,
                );
              if (n.pivot !== null && !a.pivots.some((p) => p.id === n.pivot))
                F.error(
                  "PIVOT_UNDECLARED",
                  "package",
                  P(...np.split("/").slice(1), "pivot"),
                  `'${n.pivot}' is not a pivot of ${n.asset}`,
                );
              const statics = (a.parameters ?? []).filter((p) => p.kind === "static").map((p) => p.id);
              const given = Object.keys(n.params ?? {});
              for (const s of statics)
                if (!given.includes(s))
                  F.error(
                    "PARAM_MISSING",
                    "package",
                    P(...np.split("/").slice(1), "params"),
                    `static parameter '${s}' of ${n.asset} is not set`,
                  );
              for (const g2 of given)
                if (!statics.includes(g2))
                  F.error(
                    "PARAM_UNKNOWN",
                    "package",
                    P(...np.split("/").slice(1), "params", g2),
                    `${n.asset} has no static parameter '${g2}'`,
                  );
            }
          }
          if (n.kind === "text") asset(n.font, "font", P(...np.split("/").slice(1), "font"));
          nodeIndex.set(n.id, { n, path: np, known: n.kind !== "asset" || Boolean(a), ...(a ? { a } : {}) });
        });
      });
    nodes += sceneNodes;
    if (sceneNodes > budgets.nodesPerScene)
      F.error("BUDGET_SCENE_NODES", "package", sp(), `${sceneNodes} nodes, budget ${budgets.nodesPerScene}`);

    // G13 actors
    const actors = new Map<string, { rig?: Extract<Asset, { kind: "rig" }> }>();
    scene.actors.forEach((ac, k) => {
      if (actors.has(ac.id) || nodeIndex.has(ac.id))
        F.error(
          "ID_DUPLICATE",
          "package",
          sp("actors", k, "id"),
          `'${ac.id}' is declared twice in scene '${scene.id}'`,
        );
      const rig = asset(ac.rig, "rig", sp("actors", k, "rig")) as Extract<Asset, { kind: "rig" }> | undefined;
      actors.set(ac.id, rig ? { rig } : {});
      if (layerIds.get(ac.layer) !== "layers")
        F.error(
          "LAYER_MISSING",
          "package",
          sp("actors", k, "layer"),
          `layer '${ac.layer}' is not a world layer of scene '${scene.id}'`,
        );
      if (rig) {
        const keys = Object.keys(ac.appearance).sort();
        const slots = [...rig.slots].sort();
        if (keys.join() !== slots.join())
          F.error(
            "APPEARANCE_SLOTS",
            "package",
            sp("actors", k, "appearance"),
            `sets [${keys}], the rig's slots are [${slots}]`,
          );
      }
    });
    const lightIds = new Set<string>();
    scene.lights.forEach((l, k) => {
      if (lightIds.has(l.id))
        F.error("ID_DUPLICATE", "package", sp("lights", k, "id"), `light '${l.id}' is declared twice`);
      lightIds.add(l.id);
    });

    // G9 + G11 tracks
    const seen = new Set<string>();
    scene.tracks.forEach((tr, k) => {
      tracks++;
      const tp = (...x: Array<string | number>): string => sp("tracks", k, ...x);
      const tg = tr.target;
      const id = "id" in tg ? tg.id : undefined;
      const key = `${tg.kind}:${id ?? ""}:${tr.channel}`;
      if (seen.has(key)) F.error("TRACK_DUPLICATE", "package", tp("channel"), `a second track for ${key}`);
      seen.add(key);
      // the target exists, the channel is one it has, and the values are within the channel's range
      let range: [number, number] | undefined;
      let colour = false;
      let ok: boolean;
      if (tg.kind === "camera") ok = CAMERA_CHANNELS.has(tr.channel);
      else if (tg.kind === "layer") {
        if (!layerIds.has(tg.id))
          return F.error(
            "TARGET_MISSING",
            "package",
            tp("target", "id"),
            `no layer '${tg.id}' in scene '${scene.id}'`,
          );
        ok = NODE_CHANNELS.has(tr.channel);
      } else if (tg.kind === "light") {
        if (!lightIds.has(tg.id))
          return F.error(
            "TARGET_MISSING",
            "package",
            tp("target", "id"),
            `no light '${tg.id}' in scene '${scene.id}'`,
          );
        ok = LIGHT_CHANNELS.has(tr.channel);
        colour = tr.channel === "color";
      } else if (tg.kind === "node") {
        const n = nodeIndex.get(tg.id);
        if (!n)
          return F.error(
            "TARGET_MISSING",
            "package",
            tp("target", "id"),
            `no node '${tg.id}' in scene '${scene.id}'`,
          );
        if (tr.channel.startsWith("param.")) {
          if (!n.known) return undefined; // the node's asset is already reported missing or of the wrong kind
          const p =
            n.a && n.a.kind === "vector"
              ? (n.a.parameters ?? []).find((x) => x.kind === "channel" && x.id === tr.channel.slice(6))
              : undefined;
          ok = Boolean(p);
          if (p && p.kind === "channel") range = p.range;
        } else ok = NODE_CHANNELS.has(tr.channel);
        if (tr.channel === "opacity") range = [0, 1];
      } else {
        const ac = actors.get(tg.id);
        if (!ac)
          return F.error(
            "TARGET_MISSING",
            "package",
            tp("target", "id"),
            `no actor '${tg.id}' in scene '${scene.id}'`,
          );
        if (tr.channel.startsWith("bone.")) {
          const b = ac.rig?.bones.find((x) => x.id === tr.channel.slice(5));
          ok = !ac.rig || Boolean(b);
          range = b?.range;
        } else if (tr.channel.startsWith("channel.")) {
          const c = ac.rig?.channels.find((x) => x.id === tr.channel.slice(8));
          ok = !ac.rig || Boolean(c);
          range = c?.range;
        } else ok = ACTOR_CHANNELS.has(tr.channel);
        if (tr.channel === "turn") range = [0, 1];
        if (tr.channel === "facing") range = [-1, 1];
      }
      if (!ok)
        return F.error(
          "CHANNEL_INVALID",
          "package",
          tp("channel"),
          `'${tr.channel}' is not a channel of ${tg.kind}${id ? ` '${id}'` : ""}`,
        );
      // one finding per track and problem, at the first offending value, with how many values are affected
      const values: Array<number | string> = tr.kind === "keys" ? tr.keys.map((x) => x.v) : tr.values;
      const vp = (vi: number): string => (tr.kind === "keys" ? tp("keys", vi, "v") : tp("values", vi));
      const badType = values.flatMap((v, vi) => ((typeof v === "string") !== colour ? [vi] : []));
      if (badType.length)
        F.error(
          "VALUE_TYPE",
          "package",
          vp(badType[0] as number),
          `'${tr.channel}' takes ${colour ? "colours" : "numbers"}: ${badType.length} value(s) are not`,
        );
      if (range) {
        const r = range;
        const out = values.flatMap((v, vi) =>
          typeof v === "number" && (v < r[0] - EPS || v > r[1] + EPS) ? [vi] : [],
        );
        if (out.length) {
          const nums = out.map((vi) => values[vi] as number);
          F.error(
            "VALUE_RANGE",
            "package",
            vp(out[0] as number),
            `${out.length} value(s) of '${tr.channel}' outside its declared range [${r}] (min ${Math.min(...nums)}, max ${Math.max(...nums)})`,
          );
        }
      }
      if (tr.kind === "keys") {
        tr.keys.forEach((kk, ki) => {
          if (!within(kk.t))
            F.error(
              "TIME_RANGE",
              "package",
              tp("keys", ki, "t"),
              `${kk.t} s is outside the film (0..${dur} s)`,
            );
          const prev = tr.keys[ki - 1];
          if (prev && !(kk.t > prev.t))
            F.error(
              "KEY_ORDER",
              "package",
              tp("keys", ki, "t"),
              `key at ${kk.t} s does not come after ${prev.t} s`,
            );
        });
      } else {
        samples += tr.values.length;
        const end = tr.start + (tr.values.length - 1) / tr.rate;
        if (!within(tr.start) || !within(end))
          F.error(
            "TIME_RANGE",
            "package",
            tp("start"),
            `samples cover ${tr.start}..${end} s, outside the film (0..${dur} s)`,
          );
        if (tg.kind === "actor" && (tr.channel.startsWith("bone.") || tr.channel.startsWith("channel."))) {
          if (tr.rate !== fps)
            F.error(
              "SAMPLE_RATE",
              "package",
              tp("rate"),
              `${tr.rate}/s for '${tr.channel}'; rig channels are sampled at the film's ${fps} fps`,
            );
          if (Math.abs(tr.start * fps - Math.round(tr.start * fps)) > 1e-6)
            F.error("SAMPLE_RATE", "package", tp("start"), `${tr.start} s is not on a frame`);
        }
      }
      return undefined;
    });

    // G7 + G11 events
    scene.events.forEach((e, k) => {
      const ep = (...x: Array<string | number>): string => sp("events", k, ...x);
      if (!within(e.t)) F.error("TIME_RANGE", "package", ep("t"), `${e.t} s is outside the film`);
      if (!caps.fx.includes(e.fx))
        F.error("FX_UNSUPPORTED", "package", ep("fx"), `fx '${e.fx}' is not drawn by this engine`);
      const n = nodeIndex.get(e.node);
      if (!n)
        return F.error("TARGET_MISSING", "package", ep("node"), `no node '${e.node}' in scene '${scene.id}'`);
      if ("state" in e && e.state !== undefined) {
        if (!n.a || n.a.kind !== "vector" || !n.a.states.some((s) => s.name === e.state))
          F.error(
            "STATE_UNDECLARED",
            "package",
            ep("state"),
            `'${e.state}' is not a state of node '${e.node}'`,
          );
      }
      return undefined;
    });

    // G12 contacts
    const holds = new Map<string, Array<{ from: number; to: number; actor: string; k: number }>>();
    scene.contacts.forEach((c, k) => {
      const cp = (...x: Array<string | number>): string => sp("contacts", k, ...x);
      if (!nodeIndex.has(c.node)) F.error("TARGET_MISSING", "package", cp("node"), `no node '${c.node}'`);
      const ac = actors.get(c.actor);
      if (!ac) F.error("TARGET_MISSING", "package", cp("actor"), `no actor '${c.actor}'`);
      else if (ac.rig && !ac.rig.sockets.some((s) => s.id === c.socket))
        F.error(
          "SOCKET_MISSING",
          "package",
          cp("socket"),
          `'${c.socket}' is not a socket of ${c.actor}'s rig`,
        );
      if (!(c.from < c.to))
        F.error("TIME_ORDER", "package", cp("to"), `contact ends at ${c.to} s, not after ${c.from} s`);
      if (!within(c.from) || !within(c.to))
        F.error("TIME_RANGE", "package", cp("from"), `contact ${c.from}..${c.to} s is outside the film`);
      for (const h of holds.get(c.node) ?? [])
        if (c.from < h.to && h.from < c.to)
          F.error(
            "HOLDER_CONFLICT",
            "package",
            cp(),
            `'${c.node}' is held by '${h.actor}' (contacts/${h.k}) and '${c.actor}' at the same time`,
          );
      holds.set(c.node, [...(holds.get(c.node) ?? []), { from: c.from, to: c.to, actor: c.actor, k }]);
    });
  });

  // G11 + G15 edit
  let cursor = 0;
  pkg.edit.forEach((c, k) => {
    const cp = (...x: Array<string | number>): string => P("edit", k, ...x);
    if (!sceneIds.has(c.scene)) F.error("EDIT_SCENE", "package", cp("scene"), `no scene '${c.scene}'`);
    if (Math.abs(c.start - cursor) > EPS)
      F.error(
        "EDIT_GAP",
        "package",
        cp("start"),
        `starts at ${c.start} s; the previous cut ends at ${cursor} s`,
      );
    if (!(c.end > c.start))
      F.error("TIME_ORDER", "package", cp("end"), `ends at ${c.end} s, not after ${c.start} s`);
    if (c.enter.duration > c.end - c.start + EPS)
      F.error(
        "TRANSITION_LENGTH",
        "package",
        cp("enter", "duration"),
        `${c.enter.duration} s transition into a ${c.end - c.start} s cut`,
      );
    if (!caps.transitions.includes(c.enter.kind))
      F.error(
        "CAPABILITY_MISSING",
        "package",
        cp("enter", "kind"),
        `transition '${c.enter.kind}' is not drawn by this engine`,
      );
    cursor = c.end;
  });
  if (Math.abs(cursor - dur) > EPS)
    F.error("EDIT_GAP", "package", P("edit"), `the edit ends at ${cursor} s, the film lasts ${dur} s`);

  // G6 + G11 + G15 overlays and audio
  const overlayIds = new Set<string>();
  pkg.overlays.forEach((o, k) => {
    const op = (...x: Array<string | number>): string => P("overlays", k, ...x);
    if (overlayIds.has(o.id))
      F.error("ID_DUPLICATE", "package", op("id"), `overlay '${o.id}' is declared twice`);
    overlayIds.add(o.id);
    if (!caps.overlayKinds.includes(o.kind))
      F.error("CAPABILITY_MISSING", "package", op("kind"), `overlay '${o.kind}' is not drawn by this engine`);
    if (o.kind === "icon") {
      const a = asset(o.asset, "vector", op("asset"));
      if (a && a.kind === "vector" && !a.states.some((s) => s.name === o.state))
        F.error("STATE_UNDECLARED", "package", op("state"), `'${o.state}' is not a state of ${o.asset}`);
    } else asset(o.style.font, "font", op("style", "font"));
    if (o.kind === "captions") {
      o.phrases.forEach((ph, pi) => {
        if (!(ph.in < ph.out))
          F.error(
            "OVERLAY_TIME",
            "package",
            op("phrases", pi, "out"),
            `phrase ends at ${ph.out} s, not after ${ph.in} s`,
          );
        if (!within(ph.in) || !within(ph.out))
          F.error(
            "TIME_RANGE",
            "package",
            op("phrases", pi),
            `phrase ${ph.in}..${ph.out} s is outside the film`,
          );
        ph.words.forEach((w, wi) => {
          if (!(w.t < w.end))
            F.error(
              "OVERLAY_TIME",
              "package",
              op("phrases", pi, "words", wi, "end"),
              `word '${w.text}' ends at ${w.end} s, not after ${w.t} s`,
            );
          const prev = ph.words[wi - 1];
          if (prev && w.t < prev.t)
            F.error(
              "OVERLAY_TIME",
              "package",
              op("phrases", pi, "words", wi, "t"),
              `word '${w.text}' starts before the word before it`,
            );
        });
      });
    } else {
      if (!(o.in < o.out))
        F.error("OVERLAY_TIME", "package", op("out"), `ends at ${o.out} s, not after ${o.in} s`);
      if (!within(o.in) || !within(o.out))
        F.error("TIME_RANGE", "package", op("in"), `${o.in}..${o.out} s is outside the film`);
    }
  });
  const audioIds = new Set<string>();
  pkg.audio.forEach((c, k) => {
    if (audioIds.has(c.id))
      F.error("ID_DUPLICATE", "package", P("audio", k, "id"), `audio '${c.id}' is declared twice`);
    audioIds.add(c.id);
    asset(c.asset, "audio", P("audio", k, "asset"));
    if (!within(c.start) || !within(c.start + c.duration))
      F.error(
        "TIME_RANGE",
        "package",
        P("audio", k, "start"),
        `${c.start}..${c.start + c.duration} s is outside the film`,
      );
  });

  // G14 aggregate budgets
  if (nodes > budgets.nodes)
    F.error("BUDGET_NODES", "package", P("scenes"), `${nodes} nodes, budget ${budgets.nodes}`);
  if (tracks > budgets.tracks)
    F.error("BUDGET_TRACKS", "package", P("scenes"), `${tracks} tracks, budget ${budgets.tracks}`);
  if (samples > budgets.samples)
    F.error("BUDGET_SAMPLES", "package", P("scenes"), `${samples} sample values, budget ${budgets.samples}`);
}
