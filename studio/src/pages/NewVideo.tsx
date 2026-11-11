import type { VoiceCatalog } from "@erkasa/contracts";
import { useEffect, useState } from "react";
import { ApiError, HOST_KEY, THEMES, VOICE_KEY, api, store, stored } from "../lib/api";
import { Button, Field, Toggle } from "../ui";

const THEME_LABELS: Record<string, string> = {
  psychology: "Human Behavior & Psychology",
  money: "Money, Finance & Economics",
  growth: "Personal Growth",
  philosophy: "Philosophy & Critical Thinking",
  science: "Mind-Blowing Science",
  decisions: "Life Lessons & Decisions",
};

export function NewVideo() {
  const [voices, setVoices] = useState<VoiceCatalog>();
  const [loadError, setLoadError] = useState<string>();
  const [topic, setTopic] = useState("");
  const [theme, setTheme] = useState<string>("psychology");
  const [voice, setVoice] = useState<string>(stored(VOICE_KEY) ?? "");
  const [seconds, setSeconds] = useState(45);
  const [notes, setNotes] = useState("");
  const [silent, setSilent] = useState(false);
  const [host, setHost] = useState<string>(stored(HOST_KEY) ?? "char_host_01");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    api
      .voices()
      .then((c) => {
        setVoices(c);
        setVoice((v) => (c.voices.some((x) => x.id === v) ? v : c.default));
      })
      .catch((e: unknown) => setLoadError(e instanceof Error ? e.message : String(e)));
  }, []);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(undefined);
    try {
      store(VOICE_KEY, voice);
      store(HOST_KEY, host);
      const created = await api.create({
        topic: topic.trim(),
        theme,
        voice,
        seconds,
        ...(notes.trim() ? { notes: notes.trim() } : {}),
        silent,
        ...(host ? { host } : {}),
      });
      window.location.hash = `runs/${created.run.id}`;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const valid = topic.trim().length >= 3 && !!voice;

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <h1 className="text-lg font-semibold">New video</h1>
          <p className="mt-1 text-sm text-ink-300">
            Claude writes the script and plans the scenes, ElevenLabs speaks it, the engine animates and
            renders a 9:16 MP4. Needs the backend and <code>pnpm worker</code> running.
          </p>
        </div>
        {loadError && <div className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{loadError}</div>}

        <Field label="Topic">
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="why saving alone keeps you broke"
            className="w-full rounded-md border border-ink-700 bg-ink-950 p-3 text-base"
          />
        </Field>

        <Field label="Theme">
          <div className="grid grid-cols-3 gap-2">
            {THEMES.map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-lg border px-3 py-2 text-left text-sm ${
                  theme === t ? "border-accent bg-ink-800" : "border-ink-800 bg-ink-900 hover:border-ink-500"
                }`}
              >
                {THEME_LABELS[t]}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Narrator">
          <div className="grid grid-cols-3 gap-2">
            {voices?.voices.map((v) => (
              <button
                type="button"
                key={v.id}
                onClick={() => setVoice(v.id)}
                className={`rounded-lg border p-3 text-left ${
                  voice === v.id
                    ? "border-accent bg-ink-800"
                    : "border-ink-800 bg-ink-900 hover:border-ink-500"
                }`}
              >
                <div className="text-sm font-semibold">
                  {v.name}
                  {v.bestFor.includes(theme as (typeof v.bestFor)[number]) && (
                    <span className="ml-2 text-[10px] font-normal text-accent uppercase">fits theme</span>
                  )}
                </div>
                <div className="mt-0.5 text-xs text-ink-300">
                  {[v.gender, v.age?.replace("_", " "), v.accent].filter(Boolean).join(" · ")}
                </div>
              </button>
            ))}
          </div>
          <a href="#voices" className="mt-1 inline-block text-xs text-ink-500 hover:text-accent">
            Listen to the voices →
          </a>
        </Field>

        <Field label={`Length: about ${seconds} seconds`}>
          <input
            type="range"
            min={20}
            max={120}
            step={5}
            value={seconds}
            onChange={(e) => setSeconds(Number(e.target.value))}
            className="w-full accent-accent"
          />
        </Field>

        <Field label="Main character (host)">
          <select
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm"
          >
            <option value="char_host_01">
              The Host: elderly narrator in a suit (appears where the story needs him)
            </option>
            <option value="">No host: only the story's characters</option>
          </select>
        </Field>

        <Field label="Notes for the writer (optional)">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            placeholder="e.g. use a personal example, end with a question"
            className="w-full rounded-md border border-ink-700 bg-ink-950 px-3 py-2 text-sm"
          />
        </Field>

        <Toggle
          checked={silent}
          onChange={setSilent}
          label="Silent test: skip the voice (no ElevenLabs cost, timing is estimated)"
        />

        {error && <div className="rounded-lg bg-red-950 p-3 text-sm text-red-200">{error}</div>}
        <div>
          <Button active disabled={!valid || busy || !voices} onClick={() => void submit()}>
            {busy ? "Starting…" : "Make the video ▸"}
          </Button>
        </div>
      </div>
    </div>
  );
}
