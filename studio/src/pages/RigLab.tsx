import { estimateWords, type TimedWord } from "@erkasa/compiler";
import type { Keyframe } from "@erkasa/contracts";
import {
  actionsFor,
  prepareCharacter,
  renderCharacter,
  type Facing,
  type PreparedCharacter,
  type SpeechSample,
} from "@erkasa/engine";
import { useEffect, useMemo, useRef, useState } from "react";
import { PreloadedAssetSource, loadManifest, type ManifestEntry } from "../lib/assets";
import { useAnimationFrame } from "../lib/useAnimationFrame";
import { Button, Field, Select, Toggle } from "../ui";

const FPS = 30;
const STAGE_W = 900;
const STAGE_H = 1000;
const GROUND_Y = 940;
const FACINGS: Facing[] = ["front", "left", "right"];

/** Discrete tracks keep a history of switches so the engine can cross-fade exactly as it does in videos. */
interface History {
  clip: Keyframe[];
  expression: Keyframe[];
  facing: Keyframe[];
}

function speechAt(words: TimedWord[], t: number): SpeechSample | undefined {
  const last = words[words.length - 1];
  if (!last) return undefined;
  const loop = last.end + 0.8;
  const local = t % loop;
  const w = words.find((x) => local >= x.start && local < x.end);
  return w ? { word: w.word, progress: (local - w.start) / (w.end - w.start) } : undefined;
}

export function RigLab() {
  const [characters, setCharacters] = useState<ManifestEntry[]>([]);
  const [characterId, setCharacterId] = useState<string>("char_drini_01");
  const [prepared, setPrepared] = useState<PreparedCharacter>();
  const [error, setError] = useState<string>();
  const [facing, setFacing] = useState<Facing>("front");
  const [action, setAction] = useState("idle");
  const [expression, setExpression] = useState("neutral");
  const [speaking, setSpeaking] = useState(false);
  const [line, setLine] = useState("Most people think money is a math problem. It is a behavior problem.");
  const [speed, setSpeed] = useState(1);
  const [playing, setPlaying] = useState(true);
  const [frame, setFrame] = useState(0);
  const [blend, setBlend] = useState(8);
  const renderMs = useRef(0);
  const history = useRef<History>({ clip: [], expression: [], facing: [] });
  const frameRef = useRef(0);
  frameRef.current = frame;

  useEffect(() => {
    loadManifest()
      .then((m) => setCharacters(m.assets.filter((a) => a.kind === "rigged_character")))
      .catch((e: unknown) => setError(String(e)));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setPrepared(undefined);
    setError(undefined);
    (async () => {
      const manifest = await loadManifest();
      const source = new PreloadedAssetSource(manifest);
      const meta = await source.load(characterId);
      const f = meta.files;
      const svg = f["svg"];
      const rig = f["rig"];
      if (!svg || !rig) throw new Error(`${characterId}: asset.json has no svg/rig files`);
      const side =
        f["svg_side"] && f["rig_side"]
          ? { svg: source.text(characterId, f["svg_side"]), rig: source.text(characterId, f["rig_side"]) }
          : undefined;
      const c = prepareCharacter(meta, source.text(characterId, svg), source.text(characterId, rig), side);
      if (!cancelled) {
        history.current = {
          clip: [{ f: 0, v: "idle" }],
          expression: [{ f: 0, v: "neutral" }],
          facing: [{ f: 0, v: "front" }],
        };
        setFacing("front");
        setAction("idle");
        setExpression("neutral");
        setFrame(0);
        setPrepared(c);
      }
    })().catch((e: unknown) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [characterId]);

  const push = (track: keyof History, value: string, withBlend: boolean): void => {
    const h = history.current[track];
    const f = Math.max(frameRef.current, (h[h.length - 1]?.f ?? 0) + 1);
    h.push(withBlend ? { f, v: value, blend } : { f, v: value });
  };

  const actions = prepared ? actionsFor(prepared, facing) : [];
  const expressions = prepared ? Object.keys(prepared.front.rig.expressions) : [];

  const chooseFacing = (next: Facing): void => {
    setFacing(next);
    push("facing", next, false);
    if (prepared && !actionsFor(prepared, next).includes(action)) {
      setAction("idle");
      push("clip", "idle", false);
    }
  };
  const chooseAction = (next: string): void => {
    setAction(next);
    push("clip", next, true);
  };
  const chooseExpression = (next: string): void => {
    setExpression(next);
    push("expression", next, false);
  };

  useAnimationFrame(playing, (dt) => setFrame((f) => f + dt * FPS * speed));

  const words = useMemo(() => estimateWords(line, 0.2), [line]);
  const svg = useMemo(() => {
    if (!prepared) return "";
    const n = Math.floor(frame);
    const t0 = performance.now();
    const scale = (STAGE_H * 0.8) / prepared.front.rig.canvas[1];
    const body = renderCharacter(
      prepared,
      "lab",
      {
        x: [{ f: 0, v: STAGE_W / 2 }],
        y: [{ f: 0, v: GROUND_Y }],
        scale: [{ f: 0, v: scale }],
        clip: history.current.clip,
        expression: history.current.expression,
        facing: history.current.facing,
      },
      { speaks: speaking },
      { frame: n, fps: FPS, seed: 7, speech: speaking ? speechAt(words, n / FPS) : undefined },
    );
    renderMs.current = performance.now() - t0;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STAGE_W} ${STAGE_H}">
      <rect width="${STAGE_W}" height="${STAGE_H}" fill="#f4efe6"/>
      <ellipse cx="${STAGE_W / 2}" cy="${GROUND_Y + 4}" rx="190" ry="18" fill="#000" fill-opacity="0.08"/>
      <line x1="0" x2="${STAGE_W}" y1="${GROUND_Y}" y2="${GROUND_Y}" stroke="#d8cfbf" stroke-width="3"/>
      ${body}</svg>`;
    // `frame`, `speaking`, `words` drive re-render; history is a ref mutated alongside state changes.
  }, [prepared, frame, speaking, words]);

  const current = speaking && prepared ? speechAt(words, Math.floor(frame) / FPS) : undefined;

  return (
    <div className="grid h-full grid-cols-[320px_1fr] gap-0">
      <aside className="flex flex-col gap-5 overflow-y-auto border-r border-ink-800 bg-ink-900 p-5">
        <div>
          <h1 className="text-lg font-semibold">Rig Lab</h1>
          <p className="mt-1 text-xs text-ink-300">
            The real engine adapter, rendering in your browser. What you see here is what the video renders.
          </p>
        </div>
        <Field label="Character">
          <Select
            value={characterId}
            onChange={setCharacterId}
            options={characters.map((c) => ({ value: c.assetId, label: c.assetId }))}
          />
        </Field>
        <Field label="Facing">
          <div className="flex gap-1">
            {FACINGS.map((f) => (
              <Button
                key={f}
                active={facing === f}
                disabled={f !== "front" && !prepared?.side}
                onClick={() => chooseFacing(f)}
              >
                {f}
              </Button>
            ))}
          </div>
        </Field>
        <Field label={`Action (${facing === "front" ? "front" : "side"} view)`}>
          <div className="flex flex-wrap gap-1">
            {actions.map((a) => (
              <Button key={a} active={action === a} onClick={() => chooseAction(a)}>
                {a}
              </Button>
            ))}
          </div>
        </Field>
        <Field label="Expression">
          <div className="flex flex-wrap gap-1">
            {expressions.map((x) => (
              <Button key={x} active={expression === x} onClick={() => chooseExpression(x)}>
                {x}
              </Button>
            ))}
          </div>
        </Field>
        <Field label={`Blend into next action: ${blend} frames`}>
          <input
            type="range"
            min={0}
            max={30}
            value={blend}
            onChange={(e) => setBlend(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </Field>
        <Field label="Lip-sync test">
          <Toggle checked={speaking} onChange={setSpeaking} label="Speak this line (estimated timing)" />
          <textarea
            value={line}
            onChange={(e) => setLine(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-md border border-ink-700 bg-ink-950 p-2 text-sm"
          />
        </Field>
        <Field label={`Speed: ${speed}×`}>
          <div className="flex gap-1">
            {[0.25, 0.5, 1, 2].map((s) => (
              <Button key={s} active={speed === s} onClick={() => setSpeed(s)}>
                {s}×
              </Button>
            ))}
          </div>
        </Field>
      </aside>
      <section className="flex min-h-0 flex-col">
        <div className="flex items-center gap-3 border-b border-ink-800 px-5 py-3 text-sm">
          <Button active={playing} onClick={() => setPlaying((p) => !p)}>
            {playing ? "Pause" : "Play"}
          </Button>
          <Button onClick={() => setFrame((f) => Math.max(0, Math.floor(f) - 1))}>−1 frame</Button>
          <Button onClick={() => setFrame((f) => Math.floor(f) + 1)}>+1 frame</Button>
          <span className="tabular-nums text-ink-300">
            frame {Math.floor(frame)} · {(Math.floor(frame) / FPS).toFixed(2)} s · render{" "}
            {renderMs.current.toFixed(1)} ms
          </span>
          {current && (
            <span className="ml-auto rounded bg-accent px-2 py-0.5 font-semibold text-accent-ink">
              {current.word}
            </span>
          )}
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-ink-950 p-6">
          {error ? (
            <pre className="max-w-xl whitespace-pre-wrap rounded-lg bg-red-950 p-4 text-sm text-red-200">
              {error}
            </pre>
          ) : (
            <div
              className="svg-fill aspect-[9/10] h-full max-h-full overflow-hidden rounded-xl shadow-2xl"
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
        </div>
      </section>
    </div>
  );
}
