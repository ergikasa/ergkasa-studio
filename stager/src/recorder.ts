/**
 * Records, frame by frame, every value a scene needs, then writes each channel as a track.
 *
 * A channel whose value is the same on every recorded frame becomes one key (the contract holds the first key
 * before and after it); any other channel becomes samples at the film's frame rate, starting on the scene's first
 * recorded frame. Both are exact: no value is resampled, rounded or interpolated. Visibility becomes state events
 * at the frames where it changes.
 */
import type { RenderPackage } from "@erkasa/contracts";

type Scene = RenderPackage["scenes"][number];
type Track = Scene["tracks"][number];
type Target = Track["target"];
type StateEvent = Scene["events"][number];

const keyOf = (target: Target, channel: string): string =>
  `${target.kind}:${"id" in target ? target.id : ""}:${channel}`;

export class SceneRecorder {
  private readonly order: string[] = [];
  private readonly tracks = new Map<string, { target: Target; channel: string; values: number[] }>();
  private readonly visible = new Map<string, boolean[]>();
  private frames = 0;
  private current = -1;

  constructor(
    readonly fps: number,
    /** Absolute index of the first recorded frame. */
    readonly firstFrame: number,
  ) {}

  /** Starts the next frame; frames are contiguous from `firstFrame`. */
  frame(): void {
    this.current = this.frames++;
  }

  set(target: Target, channel: string, value: number): void {
    if (!Number.isFinite(value)) throw new Error(`${keyOf(target, channel)}: non-finite value ${value}`);
    const k = keyOf(target, channel);
    let tr = this.tracks.get(k);
    if (!tr) {
      if (this.current !== 0) throw new Error(`${k}: first recorded on frame ${this.current}, not 0`);
      tr = { target, channel, values: [] };
      this.tracks.set(k, tr);
      this.order.push(k);
    }
    if (tr.values.length !== this.current)
      throw new Error(`${k}: frame ${this.current} recorded twice or skipped`);
    tr.values.push(value);
  }

  show(node: string, v: boolean): void {
    let a = this.visible.get(node);
    if (!a) {
      if (this.current !== 0)
        throw new Error(`visibility of ${node}: first recorded on frame ${this.current}`);
      a = [];
      this.visible.set(node, a);
    }
    a.push(v);
  }

  get frameCount(): number {
    return this.frames;
  }

  private time(i: number): number {
    return (this.firstFrame + i) / this.fps;
  }

  tracksOut(): Track[] {
    return this.order.map((k) => {
      const tr = this.tracks.get(k);
      if (!tr || tr.values.length !== this.frames)
        throw new Error(`${k}: ${tr?.values.length} of ${this.frames} frames`);
      const first = tr.values[0] as number;
      if (tr.values.every((v) => Object.is(v, first)))
        return {
          kind: "keys",
          target: tr.target,
          channel: tr.channel,
          keys: [{ t: this.time(0), v: first, ease: "linear" }],
        };
      return {
        kind: "samples",
        target: tr.target,
        channel: tr.channel,
        start: this.time(0),
        rate: this.fps,
        values: tr.values,
      };
    });
  }

  eventsOut(): StateEvent[] {
    const out: StateEvent[] = [];
    for (const [node, a] of this.visible) {
      if (a.length !== this.frames)
        throw new Error(`visibility of ${node}: ${a.length} of ${this.frames} frames`);
      a.forEach((v, i) => {
        // nodes are visible unless an event hides them: write the first frame only when it is hidden
        if ((i === 0 && !v) || (i > 0 && v !== a[i - 1]))
          out.push({ t: this.time(i), node, visible: v, fx: "none", duration: 0 });
      });
    }
    return out.sort((p, q) => p.t - q.t || p.node.localeCompare(q.node));
  }
}
