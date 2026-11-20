/**
 * Reading animation commands from the existing system: an actor's tracks in an erkasa.render/1 scene, evaluated
 * with the contract's own evaluator (@erkasa/contracts evaluate.ts), so the runtime reads a package exactly as
 * the stager, the Gate and the renderer do.
 *
 *   channel.<id>              a channel of the character (erkasa.humanoid/1 id), in the package's range
 *   root.x, root.y, root.scale  where the character stands, as for every actor
 *
 * A character actor has no `bone.*`, `facing` or `turn` tracks (those drive the cutout rig): they are refused,
 * as is a channel the character does not consume. Nothing is guessed or corrected.
 */
import { evaluate as evaluateTrack, type RenderPackage } from "@erkasa/contracts";
import { CharacterError } from "./errors.js";
import { consumedChannels } from "./evaluate.js";
import type { LoadedCharacter } from "./load.js";

type Scene = RenderPackage["scenes"][number];

export interface ActorFrame {
  channels: Record<string, number>;
  root: { x: number; y: number; scale: number };
}

export function actorFrame(c: LoadedCharacter, scene: Scene, actorId: string, t: number): ActorFrame {
  const consumed = consumedChannels(c);
  const channels: Record<string, number> = {};
  const root = { x: 0, y: 0, scale: 1 };
  for (const tr of scene.tracks) {
    if (tr.target.kind !== "actor" || tr.target.id !== actorId) continue;
    const v = evaluateTrack(tr, t);
    if (typeof v !== "number")
      throw new CharacterError("TRACK_VALUE", `${actorId}:${tr.channel} is not a number`);
    if (tr.channel === "root.x") root.x = v;
    else if (tr.channel === "root.y") root.y = v;
    else if (tr.channel === "root.scale") root.scale = v;
    else if (tr.channel.startsWith("channel.")) {
      const id = tr.channel.slice("channel.".length);
      if (!consumed.has(id))
        throw new CharacterError("CHANNEL_UNKNOWN", `${actorId}: ${c.manifest.id} does not consume '${id}'`);
      channels[id] = v;
    } else
      throw new CharacterError("TRACK_UNSUPPORTED", `${actorId}: '${tr.channel}' does not drive a character`);
  }
  return { channels, root };
}
