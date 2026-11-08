import { VoiceCatalog, type VoicePreset } from "@erkasa/contracts";
import { useEffect, useMemo, useState } from "react";
import catalogText from "../../../voices/catalog.json?raw";
import { Button } from "../ui";

const catalog = VoiceCatalog.parse(JSON.parse(catalogText));
const STORAGE_KEY = "erkasa.voice";

function readChoice(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? catalog.default;
  } catch {
    return catalog.default;
  }
}

function Sample({ id }: { id: string }) {
  const [state, setState] = useState<"checking" | "ready" | "missing">("checking");
  const url = `/voice-samples/${id}.mp3`;
  useEffect(() => {
    fetch(url, { method: "HEAD" })
      .then((r) => setState(r.ok ? "ready" : "missing"))
      .catch(() => setState("missing"));
  }, [url]);
  if (state === "ready") return <audio controls preload="none" src={url} className="h-9 w-full" />;
  if (state === "missing")
    return (
      <p className="text-xs text-ink-500">
        No sample yet. Run <code className="text-ink-300">pnpm voices --samples</code> once to hear every
        voice here.
      </p>
    );
  return null;
}

function tags(v: VoicePreset): string {
  return [v.gender, v.age?.replace("_", " "), v.accent].filter(Boolean).join(" · ");
}

export function Voices() {
  const [choice, setChoice] = useState(readChoice);
  const [topic, setTopic] = useState("why saving alone keeps you broke");
  const [theme, setTheme] = useState("money");
  const chosen = catalog.voices.find((v) => v.id === choice) ?? catalog.voices[0];

  const choose = (id: string): void => {
    setChoice(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // storage unavailable: the choice still applies to the command below
    }
  };
  const command = useMemo(
    () =>
      `pnpm video "${topic.replace(/"/g, "'")}" --theme ${theme} --voice ${chosen?.id ?? catalog.default}`,
    [topic, theme, chosen],
  );

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-lg font-semibold">Voices</h1>
        <p className="mt-1 text-sm text-ink-300">
          Narrators from <code>voices/catalog.json</code>. Pick one for your next video. The speaking
          character is matched to the narrator&apos;s gender automatically.
        </p>

        <div className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-4">
          {catalog.voices.map((v) => (
            <button
              type="button"
              key={v.id}
              onClick={() => choose(v.id)}
              className={`flex flex-col gap-3 rounded-xl border bg-ink-900 p-4 text-left transition-colors ${
                choice === v.id ? "border-accent" : "border-ink-800 hover:border-ink-500"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold">{v.name}</span>
                {v.id === catalog.default && (
                  <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] uppercase">default</span>
                )}
                {choice === v.id && (
                  <span className="ml-auto rounded bg-accent px-1.5 py-0.5 text-[10px] font-bold text-accent-ink uppercase">
                    selected
                  </span>
                )}
              </div>
              <div className="text-xs text-ink-300">{tags(v)}</div>
              <p className="text-sm">{v.description}</p>
              {v.bestFor.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {v.bestFor.map((t) => (
                    <span key={t} className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px]">
                      {t}
                    </span>
                  ))}
                </div>
              )}
              <div className="text-[11px] text-ink-500 tabular-nums">
                {v.id} · stability {v.settings.stability} · style {v.settings.style} · speed{" "}
                {v.settings.speed}
              </div>
              <Sample id={v.id} />
            </button>
          ))}
        </div>

        <div className="mt-8 rounded-xl border border-ink-800 bg-ink-900 p-5">
          <h2 className="font-semibold">Make a video with {chosen?.name}</h2>
          <p className="mt-1 text-xs text-ink-500">
            Videos are started from the terminal until the New Video page arrives (Phase F). Copy this command
            and run it from the repo root:
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="min-w-72 flex-1 rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm"
            />
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="rounded-md border border-ink-700 bg-ink-950 px-2 py-1.5 text-sm"
            >
              {["psychology", "money", "growth", "philosophy", "science", "decisions"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-md bg-ink-950 px-3 py-2 text-xs text-accent">{command}</code>
            <Button onClick={() => void navigator.clipboard.writeText(command)}>Copy</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
