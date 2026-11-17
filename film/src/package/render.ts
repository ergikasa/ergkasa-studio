/**
 * The engine reading a Render Package (E1.4). The Validation Gate runs first; a refused package yields its
 * findings and nothing else (no frame, no encoder). An accepted one is drawn only from what the gate verified:
 * the parsed package and manifest it returns and the bytes of every file asset it hashed. No path is reopened,
 * and nothing of a plan, a script, timing, performances or the stager is imported (test: package boundary).
 *
 * The package carries no audio: frames and video are silent.
 */
import { spawn } from "node:child_process";
import { GlobalFonts } from "@napi-rs/canvas";
import { EASES } from "../motion.js";
import { validate, type Budgets, type Finding, type RenderCapabilities } from "@erkasa/gate";
import type { AssetManifest, RenderPackage } from "@erkasa/contracts";
import { capabilities } from "../capabilities.js";
import { rasterize } from "../raster.js";
import { fontFiles } from "../style.js";
import { v2Frame } from "../v2frame.js";
import { compositeFrame, finalPixels } from "../w0/compositor.js";
import { captionsSvg, flatScene, screenSvg, w0Scene, type Library } from "./draw.js";
import { Assets, type Captions, type Scene } from "./scene.js";

export interface PackageInput {
  /** The package exactly as written (bytes or text). */
  package: Uint8Array | string;
  /** The package root: the manifest and every file asset resolve inside it. */
  root: string;
  budgets?: Partial<Budgets>;
}

/**
 * What the gate checks the package against: this engine's capabilities. Overridable only so a test can give the
 * renderer and the gate the very same (broken) description and compare their findings.
 */
export interface GateOptions {
  capabilities?: RenderCapabilities;
}

export type Opened =
  | { ok: false; errors: Finding[]; warnings: Finding[] }
  | { ok: true; warnings: Finding[]; renderer: PackageRenderer };

/** Validates, then opens a renderer over the verified package. */
export function openPackage(input: PackageInput, opts: GateOptions = {}): Opened {
  const r = validate({
    package: input.package,
    root: input.root,
    capabilities: opts.capabilities ?? (capabilities().render as RenderCapabilities),
    ...(input.budgets ? { budgets: input.budgets } : {}),
  });
  if (!r.ok || !r.verified) return { ok: false, errors: r.errors, warnings: r.warnings };
  const { package: pkg, manifest, files } = r.verified;
  const bytes = (key: string): Buffer => {
    const f = files.get(key);
    if (!f) throw new Error(`no verified file for ${key}`);
    return f.bytes;
  };
  return {
    ok: true,
    warnings: r.warnings,
    renderer: new PackageRenderer(pkg as RenderPackage, manifest as AssetManifest, bytes),
  };
}

type Cut = RenderPackage["edit"][number];

/** Skia draws W0's type and captions as SVG: it needs the engine's fonts, as the W0 CLI registers them. */
let skiaFonts = false;
function registerFonts(): void {
  if (skiaFonts) return;
  for (const f of fontFiles()) GlobalFonts.registerFromPath(f, "Montserrat");
  skiaFonts = true;
}

export class PackageRenderer {
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly frames: number;
  private readonly lib: Library;
  private readonly scenes: Map<string, Scene>;
  private readonly captions: Captions[];

  constructor(
    readonly pkg: RenderPackage,
    manifest: AssetManifest,
    bytes: (key: string) => Buffer,
  ) {
    this.width = pkg.output.width;
    this.height = pkg.output.height;
    this.fps = pkg.output.fps;
    this.frames = Math.round(pkg.output.duration * pkg.output.fps);
    this.lib = { assets: new Assets(manifest), bytes };
    this.scenes = new Map(pkg.scenes.map((s) => [s.id, s]));
    this.captions = pkg.overlays.filter((o): o is Captions => o.kind === "captions");
  }

  /** The time of frame k, its cut, and, inside a transition, the cut before it and the progress (0..1). */
  at(k: number): { t: number; cur: Scene; prev?: { scene: Scene; kind: "dissolve" | "whip"; p: number } } {
    const t = k / this.fps;
    const edit = this.pkg.edit;
    let i = edit.findIndex((c) => t >= c.start && t < c.end);
    if (i < 0) i = edit.length - 1;
    const cut = edit[i] as Cut;
    const before = edit[i - 1];
    const cur = this.scene(cut.scene);
    const local = t - cut.start;
    const kind = cut.enter.kind;
    if (!before || kind === "cut" || cut.enter.duration <= 0 || local >= cut.enter.duration)
      return { t, cur };
    if (kind !== "dissolve" && kind !== "whip")
      throw new Error(`${cut.scene}: transition '${kind}' is not drawn`);
    return { t, cur, prev: { scene: this.scene(before.scene), kind, p: local / cut.enter.duration } };
  }

  private scene(id: string): Scene {
    const s = this.scenes.get(id);
    if (!s) throw new Error(`the edit names scene ${id}, which is not in the package`);
    return s;
  }

  private static parallax = (s: Scene): boolean => s.camera.projection === "parallax";

  /** The SVG of frame k of a flat package (undefined for a frame drawn by the W0 compositor). */
  svg(k: number): string | undefined {
    const { t, cur, prev } = this.at(k);
    if (PackageRenderer.parallax(cur)) return undefined;
    if (prev && PackageRenderer.parallax(prev.scene))
      throw new Error(`${cur.id}: a transition from a parallax scene into a flat one is not drawn`);
    return v2Frame(
      flatScene(this.lib, cur, t),
      prev ? { drawn: flatScene(this.lib, prev.scene, t), kind: prev.kind, p: EASES.io(prev.p) } : undefined,
      captionsSvg(this.lib, this.captions, t),
    );
  }

  /** RGBA bytes of frame k. */
  async pixels(k: number): Promise<Buffer> {
    const svg = this.svg(k);
    if (svg !== undefined) return rasterize(svg);
    registerFonts();
    const { t, cur, prev } = this.at(k);
    if (prev && (!PackageRenderer.parallax(prev.scene) || prev.kind !== "dissolve"))
      throw new Error(
        `${cur.id}: a parallax scene enters only by cut or dissolve from another parallax scene`,
      );
    const c = await compositeFrame(
      w0Scene(this.lib, cur, t),
      prev ? { view: w0Scene(this.lib, prev.scene, t), p: prev.p } : undefined,
    );
    return finalPixels(c, screenSvg(this.lib, cur, t) + captionsSvg(this.lib, this.captions, t));
  }
}

export interface FrameSink {
  /** Called once, only for an accepted package, before the first frame. */
  begin(info: { width: number; height: number; fps: number; frames: number }): void;
  frame(k: number, rgba: Buffer): Promise<void> | void;
  end(): Promise<void> | void;
}

export interface RenderOutcome {
  ok: boolean;
  errors: Finding[];
  warnings: Finding[];
  /** Frames handed to the sink. */
  frames: number;
}

/** Validates and renders every frame into `sink`. A refused package never reaches the sink. */
export async function renderPackage(
  input: PackageInput,
  sink: FrameSink,
  range?: { from: number; to: number },
  opts: GateOptions = {},
): Promise<RenderOutcome> {
  const o = openPackage(input, opts);
  if (!o.ok) return { ok: false, errors: o.errors, warnings: o.warnings, frames: 0 };
  const r = o.renderer;
  const from = range?.from ?? 0;
  const to = Math.min(r.frames, range?.to ?? r.frames);
  sink.begin({ width: r.width, height: r.height, fps: r.fps, frames: to - from });
  let n = 0;
  for (let k = from; k < to; k++) {
    await sink.frame(k, await r.pixels(k));
    n++;
  }
  await sink.end();
  return { ok: true, errors: [], warnings: o.warnings, frames: n };
}

/** A sink that encodes silent H.264 with FFmpeg (started in `begin`, so never for a refused package). */
export function ffmpegSink(out: string, ffmpeg = process.env["ERKASA_FFMPEG"] ?? "ffmpeg"): FrameSink {
  let p: ReturnType<typeof spawn> | undefined;
  let done: Promise<void> | undefined;
  return {
    begin({ width, height, fps }) {
      p = spawn(
        ffmpeg,
        [
          ...["-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgba"],
          ...["-s", `${width}x${height}`, "-r", String(fps), "-i", "-", "-an"],
          ...["-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", out],
        ],
        { stdio: ["pipe", "ignore", "pipe"] },
      );
      let err = "";
      p.stderr?.on("data", (d: Buffer) => (err = (err + d.toString()).slice(-2000)));
      done = new Promise((resolve, reject) => {
        p?.on("error", reject);
        p?.on("close", (code) =>
          code === 0 ? resolve() : reject(new Error(`ffmpeg exited ${code}: ${err}`)),
        );
      });
    },
    async frame(_k, rgba) {
      const stdin = p?.stdin;
      if (!stdin) throw new Error("the encoder is not running");
      if (!stdin.write(rgba)) await new Promise<void>((r) => stdin.once("drain", () => r()));
    },
    async end() {
      p?.stdin?.end();
      await done;
    },
  };
}
