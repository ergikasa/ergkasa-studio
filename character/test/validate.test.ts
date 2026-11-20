import { describe, expect, it } from "vitest";
import type { CharacterPart } from "@erkasa/contracts";
import { selfCheck } from "../src/runtime/index.js";
import type { PackageSpec } from "../src/builder/index.js";
import { codesOf, loadEdited, must } from "./helpers.js";

const part = (s: PackageSpec, id: string): CharacterPart => {
  const p = s.parts.flatMap((f) => f.parts).find((x) => x.id === id);
  if (!p) throw new Error(`no part ${id}`);
  return p;
};
const bones = (s: PackageSpec) => s.manifest.skeleton.bones;

/** Each case breaks one rule of the package; the loader must refuse it with that code. */
const CASES: Array<[string, string, (s: PackageSpec) => void]> = [
  [
    "a bone whose parent does not exist",
    "BONE_PARENT_UNKNOWN",
    (s) => void (must(bones(s)[1]).parent = "nope"),
  ],
  [
    "a skeleton with a cycle",
    "BONE_CYCLE",
    (s) => {
      const root = bones(s).find((b) => b.id === "root");
      if (root) root.parent = "head";
    },
  ],
  ["an unknown origin bone", "ORIGIN_UNKNOWN", (s) => void (s.manifest.origin = "pelvis")],
  [
    "skin weights that do not sum to 1",
    "WEIGHTS_SUM",
    (s) => {
      const b = part(s, "arm_l").binding;
      if (b.kind === "skin" && b.weights[0]?.[0]) b.weights[0][0][1] = 0.5;
    },
  ],
  [
    "a morph vertex out of range",
    "MORPH_INDEX",
    (s) => part(s, "torso_skin").morphs[0]?.deltas.push([9999, 1, 1]),
  ],
  [
    "a path vertex out of range",
    "PATH_INDEX",
    (s) => {
      const p = part(s, "neck");
      if (p.kind === "vector") p.paths[0]?.cmds.splice(1, 0, ["L", 9999]);
    },
  ],
  [
    "a texture triangle out of range",
    "TRIANGLE_INDEX",
    (s) => {
      const p = part(s, "tee");
      if (p.kind === "texture") p.triangles.push([0, 1, 9999]);
    },
  ],
  [
    "views that leave a gap",
    "VIEW_TILING",
    (s) => {
      const v = s.manifest.views.head?.views[1];
      if (v) v.yaw = [16, 40];
    },
  ],
  [
    "a part in two views of a group",
    "VIEW_PART_TWICE",
    (s) => s.manifest.views.head?.views[1]?.parts.push("head_front"),
  ],
  [
    "a control for a channel outside erkasa.humanoid/1",
    "CONTROL_CHANNEL",
    (s) =>
      s.manifest.controls.push({
        channel: "tail_wag",
        range: [0, 1],
        rest: 0,
        drives: [{ kind: "bone", bone: "spine", degPerUnit: 1 }],
      }),
  ],
  [
    "a drive for a morph no part has",
    "DRIVE_MORPH_UNKNOWN",
    (s) => s.manifest.controls[0]?.drives.push({ kind: "morph", morph: "nowhere", from: 0, to: 1 }),
  ],
  [
    "a declared channel nothing consumes",
    "CAP_CHANNEL_UNDECLARED",
    (s) => s.manifest.capabilities.channels.push("leg_l_upper"),
  ],
  [
    "walking declared without a passing report",
    "CAP_EVIDENCE",
    (s) => s.manifest.capabilities.locomotion.push("walk"),
  ],
  [
    "grasping declared without a passing report",
    "CAP_EVIDENCE",
    (s) => s.manifest.capabilities.interactions.push("grasp"),
  ],
  ["visemes declared but not defined", "CAP_FACE", (s) => s.manifest.capabilities.face.visemes.push("aa")],
  [
    "fingers declared without finger bones",
    "CAP_HANDS",
    (s) => void (s.manifest.capabilities.hands.fingers = true),
  ],
  ["a level of detail the textures do not have", "CAP_LOD", (s) => s.manifest.capabilities.lod.push("close")],
  [
    "an eye clipped by a part that does not exist",
    "EYE_CLIP_UNKNOWN",
    (s) => {
      const v = s.manifest.eyes[0]?.views[0];
      if (v) v.clip = "eye_white_x";
    },
  ],
  [
    "an outfit with a garment part that does not exist",
    "OUTFIT_PART_UNKNOWN",
    (s) => s.manifest.wardrobe[0]?.garments[0]?.parts.push("cape"),
  ],
  [
    "an outfit that hides a part that does not exist",
    "OUTFIT_HIDES_UNKNOWN",
    (s) => s.manifest.wardrobe[0]?.hides.push("skirt"),
  ],
  ["an action unit without a control", "FACE_AU_WITHOUT_CONTROL", (s) => s.manifest.face.aus.push("au20")],
];

describe("package validation refuses broken packages", () => {
  for (const [what, code, edit] of CASES)
    it(`${what} (${code})`, async () => {
      expect(await codesOf(loadEdited(edit))).toContain(code);
    });
});

describe("the capability self-check", () => {
  it("passes for the test character", async () => {
    const c = await loadEdited(() => undefined);
    expect(selfCheck(c)).toEqual([]);
  });

  it("refuses a declared channel that moves nothing (CAP_NO_EFFECT)", async () => {
    const c = await loadEdited((s) => {
      s.manifest.skeleton.bones.push({ id: "tail", parent: "root", at: [0, 0], angle: 90, length: 10 });
      s.manifest.controls.push({
        channel: "x_tail",
        range: [0, 1],
        rest: 0,
        drives: [{ kind: "bone", bone: "tail", degPerUnit: 30 }],
      });
      s.manifest.capabilities.channels.push("x_tail");
    });
    expect(selfCheck(c).map((f) => f.code)).toEqual(["CAP_NO_EFFECT"]);
  });

  it("the test character declares no capability it has not proved", async () => {
    const c = await loadEdited(() => undefined);
    const cap = c.manifest.capabilities;
    expect(cap.locomotion).toEqual([]);
    expect(cap.interactions).toEqual([]);
    expect(cap.hands.fingers).toBe(false);
    expect(cap.face.visemes).toEqual([]);
    expect(cap.lod).toEqual(["medium"]);
  });
});
