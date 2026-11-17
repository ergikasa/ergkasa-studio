/**
 * E1.4 final audit F3: the roles the capabilities declare for W0 are the roles the renderer draws. The gate reads
 * only the declaration (gate/src/executable.ts checkRoles names no role); these tests hold the declaration to the
 * code that draws (package/draw.ts w0Scene, the W0 compositor's input):
 *   - assign: a layer gets a role from its node, or from its actor;
 *   - members: a builtin is drawn as part of its role, wherever its node is (resting props with the furniture,
 *     held props with the people); a builtin no role draws is not drawn;
 *   - blur / depth: for a role that reads another's value, its own layer's value is not read; the source's is;
 *     `first` is the first layer of the role; `absent` the value when the source has no layer;
 *   - repeat: roles that repeat draw every layer (two actors, two people).
 */
import { serialise, stageFilm } from "@erkasa/stager";
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { describe, expect, it } from "vitest";
import { renderCapabilities } from "../../src/capabilities.js";
import { w0Scene, type Library } from "../../src/package/draw.js";
import { Assets } from "../../src/package/scene.js";

const w = serialise(stageFilm("w0-office"));
const PKG = JSON.parse(w.pkg) as RenderPackage;
const MANIFEST = JSON.parse(w.manifest) as AssetManifest;
const lib: Library = {
  assets: new Assets(MANIFEST),
  bytes: () => {
    throw new Error("W0 is drawn from builtins only");
  },
};
const ROLES = renderCapabilities().projections["parallax"]?.roles ?? {};
type Scene = RenderPackage["scenes"][number];
/** Scene 7: every layer blurred (people and held 4.5, mid 4.5), a near layer. */
const base = (): Scene => structuredClone(PKG.scenes[7] as Scene);
const T = 0.5;
const layer = (s: Scene, id: string): Scene["layers"][number] => {
  const l = s.layers.find((x) => x.id === id);
  if (!l) throw new Error(id);
  return l;
};
const view = (s: Scene): ReturnType<typeof w0Scene> => w0Scene(lib, s, T);
/** The compositor's input, as JSON (what it draws from). */
const seen = (s: Scene): string => JSON.stringify(view(s));

describe("F3 W0 roles: the declaration is what the renderer draws", () => {
  it("declares every role the renderer reads, and nothing else", () => {
    expect(Object.keys(ROLES).sort()).toEqual(
      ["actors", "city", "city_near", "held", "mid", "near", "sky", "wall"].sort(),
    );
    expect(ROLES["actors"]).toMatchObject({
      assign: "actor",
      repeat: true,
      blur: "first",
      depth: "mid",
      absent: { blur: 0 },
    });
    expect(ROLES["held"]).toMatchObject({
      assign: "node",
      builtin: "prop.*.held",
      repeat: true,
      blur: "actors",
      depth: "mid",
    });
    expect(ROLES["mid"]?.members).toEqual(["w0.mid", "prop.*.resting"]);
    expect(ROLES["city"]).toMatchObject({ blur: "sky" });
    expect(ROLES["city_near"]).toMatchObject({ blur: "sky" });
  });

  // blur and depth sources: the layer's own value is not read when the role reads another's
  const notOwn = Object.entries(ROLES).flatMap(([role, r]) =>
    (["blur", "depth"] as const)
      .filter((f) => r[f] !== "own" && r[f] !== "first")
      .map((f) => [role, f, r[f]] as const),
  );
  it.each(notOwn)("'%s' %s: its own layer's value is not read (it is '%s''s)", (role, f) => {
    const s = base();
    const id = role === "actors" ? (s.actors[0]?.layer as string) : role;
    const before = seen(s);
    layer(s, id)[f] = layer(s, id)[f] + 3;
    expect(seen(s)).toBe(before);
  });
  it.each(notOwn)("'%s' %s: the source's value is read ('%s')", (_, f, from) => {
    const s = base();
    const before = seen(s);
    layer(s, from === "actors" ? (s.actors[0]?.layer as string) : from)[f] += 3;
    expect(seen(s)).not.toBe(before);
  });
  it("actors blur 'first': the first actor layer's blur is the people's; a second actor layer's is not read", () => {
    const s = base();
    const a = s.actors[0] as Scene["actors"][number];
    const j = s.layers.findIndex((l) => l.id === a.layer);
    s.layers.splice(j + 1, 0, {
      ...structuredClone(s.layers[j] as Scene["layers"][number]),
      id: "actor_two",
      blur: 1,
    });
    s.actors.push({ ...structuredClone(a), id: "two", layer: "actor_two" });
    for (const t of s.tracks.filter((x) => x.target.kind === "actor" && x.target.id === a.id))
      s.tracks.push({ ...structuredClone(t), target: { kind: "actor", id: "two" } });
    const v = view(s);
    expect(v.blur.people).toBe(layer(s, a.layer).blur);
    // repeat: both people are drawn
    const one = view(base()).people.length;
    expect(v.people.length).toBeGreaterThan(one);
    layer(s, "actor_two").blur = 7;
    expect(JSON.stringify(view(s))).toBe(JSON.stringify(v));
  });
  it("actors absent: with no person, the people's blur (held props') is the declared 0", () => {
    const s = base();
    const a = s.actors[0] as Scene["actors"][number];
    s.layers = s.layers.filter((l) => l.id !== a.layer);
    s.tracks = s.tracks.filter((t) => !(t.target.kind === "actor" && t.target.id === a.id));
    s.actors = [];
    expect(layer(s, "held").blur).toBe(4.5);
    expect(view(s).blur.people).toBe(ROLES["actors"]?.absent?.blur);
  });

  // members: drawn as part of the role, wherever the node is
  it("a resting prop is drawn with the furniture (mid's member) even from another layer", () => {
    const s = base();
    const mid = layer(s, "mid");
    const k = mid.nodes.findIndex((n) => n.id !== "mid" && !n.id.includes("place"));
    const prop = mid.nodes[k] as Scene["layers"][number]["nodes"][number];
    const before = view(s);
    expect(before.resting).not.toBe("");
    mid.nodes.splice(k, 1);
    layer(s, "wall").nodes.push(prop);
    const after = view(s);
    expect(after.resting).toBe(before.resting);
  });
  it("a held prop is drawn with the people (held) even from the furniture's layer", () => {
    const s = base();
    const held = layer(s, "held");
    const before = view(s);
    expect(before.held).not.toBe("");
    layer(s, "mid").nodes.push(...held.nodes);
    held.nodes = [];
    expect(view(s).held).toBe(before.held);
  });
  it("a builtin that is no role's member is not drawn in a parallax scene", () => {
    const s = base();
    const b3 = serialise(stageFilm("b3-every-yes"));
    const m = JSON.parse(b3.manifest) as AssetManifest;
    const set = (JSON.parse(b3.pkg) as RenderPackage).scenes
      .flatMap((x) => x.layers.flatMap((l) => l.nodes))
      .find((n) => n.kind === "asset" && n.asset.startsWith("set_"));
    expect(set).toBeDefined();
    const both: Library = {
      ...lib,
      assets: new Assets({ ...MANIFEST, assets: [...MANIFEST.assets, ...m.assets] }),
    };
    layer(s, "wall").nodes.push(set as Scene["layers"][number]["nodes"][number]);
    expect(() => w0Scene(both, s, T)).toThrow(/'set\.[a-z]+\.back' is not drawn in a parallax scene/);
  });
});
