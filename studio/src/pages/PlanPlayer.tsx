import { compileVideo, type CompileResult } from "@erkasa/compiler";
import { Engine } from "@erkasa/engine";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import habitsPlan from "../../../engine-worker/demo/habits.video-plan.json?raw";
import { PREVIEW_PLAN_KEY, store, stored } from "../lib/api";
import { PreloadedAssetSource, loadManifest, referencedAssets } from "../lib/assets";
import { useAnimationFrame } from "../lib/useAnimationFrame";
import { Button } from "../ui";

/** Same seed as the render worker (engine-worker/src/render.ts), so the preview matches the export frame-for-frame. */
const SEED = 20261108;

interface Compiled {
  result: CompileResult;
  engine?: Engine;
  ms: number;
}

/** A plan handed over from a run ("Open the plan in Plan Preview"), used once. */
function takeHandedPlan(): string | undefined {
  const text = stored(PREVIEW_PLAN_KEY);
  if (text === null) return undefined;
  store(PREVIEW_PLAN_KEY, null);
  return text;
}

export function PlanPlayer() {
  const [initial] = useState(() => takeHandedPlan() ?? habitsPlan);
  const [text, setText] = useState(initial);
  const [compiled, setCompiled] = useState<Compiled>();
  const [busy, setBusy] = useState(false);
  const [fatal, setFatal] = useState<string>();
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);
  const renderMs = useRef(0);

  const compile = useCallback(async (source: string) => {
    setBusy(true);
    setFatal(undefined);
    setPlaying(false);
    try {
      const plan: unknown = JSON.parse(source);
      const manifest = await loadManifest();
      const assets = new PreloadedAssetSource(manifest);
      await assets.loadAll(referencedAssets(plan, manifest));
      const t0 = performance.now();
      const result = compileVideo(plan, { assets, seed: SEED });
      const engine = result.timeline ? new Engine(result.timeline, { assets }) : undefined;
      setCompiled({ result, ms: performance.now() - t0, ...(engine ? { engine } : {}) });
      setFrame(0);
    } catch (e) {
      setFatal(e instanceof Error ? e.message : String(e));
      setCompiled(undefined);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void compile(initial);
  }, [compile, initial]);

  const engine = compiled?.engine;
  const total = engine?.totalFrames ?? 0;
  const fps = engine?.timeline.fps ?? 30;

  useAnimationFrame(playing && !!engine, (dt) =>
    setFrame((f) => {
      const next = f + dt * fps;
      if (next >= total) {
        setPlaying(false);
        return total - 1;
      }
      return next;
    }),
  );

  const svg = useMemo(() => {
    if (!engine) return "";
    const t0 = performance.now();
    try {
      return engine.renderFrame(Math.min(total - 1, Math.floor(frame)));
    } catch (e) {
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920"><text x="40" y="200" font-size="40" fill="red">${String(e)}</text></svg>`;
    } finally {
      renderMs.current = performance.now() - t0;
    }
  }, [engine, frame, total]);

  const issues = compiled?.result.issues ?? [];
  const scenes = compiled?.result.scenes ?? [];
  const n = Math.floor(frame);

  return (
    <div className="grid h-full grid-cols-[minmax(460px,1fr)_auto]">
      <section className="flex min-h-0 flex-col border-r border-ink-800">
        <div className="flex items-center gap-2 border-b border-ink-800 px-4 py-3">
          <h1 className="font-semibold">Video plan</h1>
          <span className="text-xs text-ink-500">erkasa.video-plan/1 · compiled in the browser</span>
          <div className="ml-auto flex gap-1">
            <Button onClick={() => setText(habitsPlan)}>Load demo</Button>
            <Button active onClick={() => void compile(text)} disabled={busy}>
              {busy ? "Compiling…" : "Compile ▸"}
            </Button>
          </div>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="min-h-0 flex-1 resize-none bg-ink-950 p-4 font-mono text-xs leading-relaxed text-ink-100 outline-none"
        />
        <div className="max-h-56 overflow-y-auto border-t border-ink-800 bg-ink-900 p-4 text-xs">
          {fatal && <div className="text-red-300">{fatal}</div>}
          {compiled && (
            <div className="mb-2 text-ink-300">
              {compiled.engine
                ? `OK · ${scenes.length} scenes · ${total} frames (${(total / fps).toFixed(1)} s) · compile ${compiled.ms.toFixed(0)} ms`
                : "Compile failed"}
              {" · "}
              {issues.length} issue{issues.length === 1 ? "" : "s"}
            </div>
          )}
          {issues.map((i, k) => (
            <div key={k} className={i.level === "error" ? "text-red-300" : "text-amber-300"}>
              <span className="font-semibold">{i.code}</span>{" "}
              {i.path && <span className="text-ink-500">{i.path}</span>} {i.message}
              {"hint" in i && i.hint ? <span className="text-ink-300"> — {String(i.hint)}</span> : null}
            </div>
          ))}
        </div>
      </section>
      <section className="flex min-h-0 flex-col items-center gap-3 bg-ink-950 p-5">
        <div
          className="svg-fill aspect-[9/16] min-h-0 flex-1 overflow-hidden rounded-xl bg-black shadow-2xl"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
        <div className="w-full max-w-[520px]">
          <input
            type="range"
            min={0}
            max={Math.max(0, total - 1)}
            value={n}
            onChange={(e) => {
              setPlaying(false);
              setFrame(Number(e.target.value));
            }}
            className="w-full accent-accent"
          />
          <div className="relative h-4">
            {scenes.map((s) => (
              <button
                type="button"
                key={s.sceneId}
                onClick={() => setFrame(s.from)}
                style={{ left: `${(s.from / Math.max(1, total)) * 100}%` }}
                className="absolute text-[10px] text-ink-500 hover:text-accent"
              >
                {s.sceneId}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs">
            <Button
              active={playing}
              disabled={!engine}
              onClick={() => {
                if (n >= total - 1) setFrame(0);
                setPlaying((p) => !p);
              }}
            >
              {playing ? "Pause" : "Play"}
            </Button>
            <Button onClick={() => setFrame((f) => Math.max(0, Math.floor(f) - 1))}>−1</Button>
            <Button onClick={() => setFrame((f) => Math.min(total - 1, Math.floor(f) + 1))}>+1</Button>
            <span className="tabular-nums text-ink-300">
              {n} / {total} · {(n / fps).toFixed(2)} s · frame {renderMs.current.toFixed(1)} ms
            </span>
          </div>
          <p className="mt-2 text-[11px] text-ink-500">
            Silent preview: narration voice and the audio mix arrive with the voice worker (Phase E). Export
            with <code>pnpm demo:plan</code>.
          </p>
        </div>
      </section>
    </div>
  );
}
