import { describe, expect, it } from "vitest";
import { evaluate as evaluateTrack, Track, type RenderPackage } from "@erkasa/contracts";
import { actorFrame, evaluate } from "../src/runtime/index.js";
import { testCharacter, must } from "./helpers.js";

type Scene = RenderPackage["scenes"][number];

/** A scene carrying only tracks: the runtime reads nothing else of it. Every track passes the contract. */
const sceneWith = (tracks: unknown[]): Scene =>
  ({ tracks: tracks.map((t) => Track.parse(t)) }) as unknown as Scene;
const actor = { kind: "actor", id: "ana" };

describe("reading animation commands from erkasa.render/1 tracks", () => {
  const tracks = [
    {
      kind: "keys",
      target: actor,
      channel: "channel.head_yaw",
      keys: [
        { t: 0, v: 0, ease: "linear" },
        { t: 1, v: 30, ease: "linear" },
      ],
    },
    {
      kind: "samples",
      target: actor,
      channel: "channel.au12",
      start: 0,
      rate: 30,
      values: [0, 0.25, 0.5, 0.75, 1],
    },
    { kind: "keys", target: actor, channel: "root.x", keys: [{ t: 0, v: 400, ease: "hold" }] },
    {
      kind: "keys",
      target: { kind: "actor", id: "other" },
      channel: "channel.leg_l_upper",
      keys: [{ t: 0, v: 5, ease: "hold" }],
    },
  ];

  it("evaluates each channel with the contract's evaluator, at the frame's time", async () => {
    const c = await testCharacter();
    const s = sceneWith(tracks);
    const f = actorFrame(c, s, "ana", 2 / 30);
    expect(f.channels["head_yaw"]).toBe(evaluateTrack(must(s.tracks[0]), 2 / 30));
    expect(f.channels["head_yaw"]).toBeCloseTo(2, 9);
    expect(f.channels["au12"]).toBe(0.5);
    expect(f.root).toEqual({ x: 400, y: 0, scale: 1 });
  });

  it("ignores other actors' tracks", async () => {
    const c = await testCharacter();
    expect(Object.keys(actorFrame(c, sceneWith(tracks), "ana", 0).channels).sort()).toEqual([
      "au12",
      "head_yaw",
    ]);
  });

  it("refuses a channel the character does not consume", async () => {
    const c = await testCharacter();
    const s = sceneWith([
      { kind: "keys", target: actor, channel: "channel.leg_l_upper", keys: [{ t: 0, v: 1, ease: "hold" }] },
    ]);
    expect(() => actorFrame(c, s, "ana", 0)).toThrow(/CHANNEL_UNKNOWN/);
  });

  it("refuses the cutout rig's tracks (bone.*, facing, turn)", async () => {
    const c = await testCharacter();
    for (const channel of ["bone.arm", "facing", "turn"]) {
      const s = sceneWith([{ kind: "keys", target: actor, channel, keys: [{ t: 0, v: 1, ease: "hold" }] }]);
      expect(() => actorFrame(c, s, "ana", 0)).toThrow(/TRACK_UNSUPPORTED/);
    }
  });

  it("the values read drive the character (a frame of a real track sequence evaluates)", async () => {
    const c = await testCharacter();
    const f = actorFrame(c, sceneWith(tracks), "ana", 0.5);
    const ev = evaluate(c, { channels: f.channels, outfit: "test_tee" });
    expect(ev.values["head_yaw"]).toBeCloseTo(15, 9);
    expect(ev.layers.length).toBe(2); // 15° is inside the blend band between the two head views
  });
});
