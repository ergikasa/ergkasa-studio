import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  PREVIEW_PLAN_KEY,
  api,
  store,
  type RunDetail,
  type RunSummary,
  type StepView,
} from "../lib/api";
import { Button } from "../ui";

const POLL_MS = 1500;

const STEP_LABELS: Record<string, string> = {
  script: "Script (Claude)",
  world: "World (Claude + World Builder)",
  voice: "Voice (ElevenLabs)",
  plan: "Visual plan (Claude + compiler)",
  render: "Render (engine + FFmpeg)",
};

const STATUS_COLORS: Record<string, string> = {
  RUNNING: "bg-sky-500/20 text-sky-300",
  QUEUED: "bg-ink-700 text-ink-100",
  PENDING: "bg-ink-800 text-ink-500",
  SUCCEEDED: "bg-emerald-500/20 text-emerald-300",
  FAILED: "bg-red-500/20 text-red-300",
  CANCELLED: "bg-ink-800 text-ink-500",
};

function Badge({ status }: { status: string }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${STATUS_COLORS[status] ?? ""}`}
    >
      {status}
    </span>
  );
}

function ago(iso: string | null): string {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return `${Math.round(s)} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

function took(step: StepView): string {
  if (!step.startedAt || step.status === "CANCELLED" || step.status === "PENDING") return "";
  const end = step.finishedAt ? Date.parse(step.finishedAt) : Date.now();
  const s = (end - Date.parse(step.startedAt)) / 1000;
  return s < 90 ? `${s.toFixed(1)} s` : `${Math.round(s / 60)} min`;
}

function metricLine(step: StepView): string {
  const m = step.metrics;
  const parts: string[] = [];
  if (m["costUsd"] !== undefined) parts.push(`$${m["costUsd"].toFixed(3)}`);
  if (m["inputTokens"] !== undefined)
    parts.push(`${(m["inputTokens"] + (m["outputTokens"] ?? 0)).toLocaleString()} tokens`);
  if (m["characters"] !== undefined) parts.push(`${m["characters"]} characters`);
  if (m["voiceSec"] !== undefined) parts.push(`${m["voiceSec"]} s of voice`);
  if (m["planAttempts"] !== undefined) parts.push(`${m["planAttempts"]} plan attempt(s)`);
  if (m["durationSec"] !== undefined) parts.push(`${m["durationSec"]} s video`);
  if (m["warnings"]) parts.push(`${m["warnings"]} warning(s)`);
  return parts.join(" · ");
}

function StepRow({ step }: { step: StepView }) {
  const active = step.status === "RUNNING" || step.status === "QUEUED";
  return (
    <div className="rounded-lg border border-ink-800 bg-ink-900 p-3">
      <div className="flex items-center gap-2">
        <span className="font-medium">{STEP_LABELS[step.id] ?? step.id}</span>
        <Badge status={step.status} />
        {step.attempt > 1 && (
          <span className="text-[11px] text-amber-300">
            attempt {step.attempt}/{step.maxAttempts}
          </span>
        )}
        <span className="ml-auto text-xs text-ink-500 tabular-nums">{took(step)}</span>
      </div>
      {active && (
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-ink-800">
          <div
            className="h-full bg-accent transition-all"
            style={{ width: `${Math.max(3, step.progress)}%` }}
          />
        </div>
      )}
      {step.message && step.status !== "SUCCEEDED" && (
        <div className="mt-1.5 text-xs text-ink-300">{step.message}</div>
      )}
      {step.error && step.status === "FAILED" && (
        <div className="mt-1.5 rounded bg-red-950/60 p-2 text-xs text-red-200">
          <span className="font-semibold">{step.errorCode}</span> {step.error}
        </div>
      )}
      {step.error && active && (
        <div className="mt-1.5 rounded bg-amber-950/50 p-2 text-xs text-amber-200">
          Previous attempt: <span className="font-semibold">{step.errorCode}</span> {step.error}
        </div>
      )}
      {step.status === "QUEUED" && step.queuedAt && Date.now() - Date.parse(step.queuedAt) > 20_000 && (
        <div className="mt-1.5 text-xs text-amber-300">
          No worker has picked this up yet. Is <code>pnpm worker</code> running, and does it say
          &quot;connected to ...:5673&quot;? Check ERKASA_RABBIT_PORT=5673 in .env.
        </div>
      )}
      {step.status === "SUCCEEDED" && metricLine(step) && (
        <div className="mt-1.5 text-xs text-ink-500">{metricLine(step)}</div>
      )}
    </div>
  );
}

interface ScriptView {
  title: string;
  scenes: Array<{ sceneId: string; narration: string; visualIdea: string }>;
}

function RunPanel({ id }: { id: string }) {
  const [detail, setDetail] = useState<RunDetail>();
  const [error, setError] = useState<string>();
  const [script, setScript] = useState<ScriptView>();

  const load = useCallback(async () => {
    try {
      setDetail(await api.run(id));
      setError(undefined);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    setDetail(undefined);
    setScript(undefined);
    void load();
  }, [load]);

  const running = detail?.run.status === "RUNNING";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(t);
  }, [running, load]);

  const hasScript = detail?.files.includes("script.json") ?? false;
  useEffect(() => {
    if (!hasScript) return;
    fetch(api.fileUrl(id, "script.json"))
      .then((r) => r.json() as Promise<ScriptView>)
      .then(setScript)
      .catch(() => undefined);
  }, [hasScript, id]);

  if (error && !detail) return <div className="p-6 text-sm text-red-300">{error}</div>;
  if (!detail) return <div className="p-6 text-sm text-ink-300">Loading…</div>;
  const { run, steps, files } = detail;
  const cost = steps.reduce((n, s) => n + (s.metrics["costUsd"] ?? 0), 0);
  const chars = steps.reduce((n, s) => n + (s.metrics["characters"] ?? 0), 0);

  const act = async (fn: () => Promise<RunDetail>): Promise<void> => {
    try {
      setDetail(await fn());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };
  const openPlan = async (): Promise<void> => {
    const text = await (await fetch(api.fileUrl(id, "video-plan.json"))).text();
    store(PREVIEW_PLAN_KEY, text);
    window.location.hash = "player";
  };

  return (
    <div className="grid h-full grid-cols-[1fr_340px] gap-0">
      <div className="min-h-0 overflow-y-auto p-6">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold">{run.title ?? run.topic}</h1>
            <div className="mt-1 text-xs text-ink-300">
              {run.theme} · voice {run.voice}
              {run.silent ? " (silent test)" : ""} · ~{run.seconds} s · started {ago(run.createdAt)}
            </div>
          </div>
          <Badge status={run.status} />
          {run.status === "RUNNING" && <Button onClick={() => void act(() => api.cancel(id))}>Cancel</Button>}
          {(run.status === "FAILED" || run.status === "CANCELLED") && (
            <Button active onClick={() => void act(() => api.retry(id))}>
              Resume
            </Button>
          )}
        </div>
        {error && <div className="mt-3 text-sm text-red-300">{error}</div>}
        {run.status === "RUNNING" && run.currentStep && (
          <p className="mt-3 text-xs text-ink-500">
            Steps only move while <code>pnpm worker</code> is running. Resume keeps every finished step.
          </p>
        )}

        <div className="mt-5 flex flex-col gap-2">
          {steps.map((s) => (
            <StepRow key={s.id} step={s} />
          ))}
        </div>
        {(cost > 0 || chars > 0) && (
          <div className="mt-3 text-xs text-ink-500">
            Total: {cost > 0 ? `~$${cost.toFixed(3)} Claude` : ""}
            {chars > 0 ? ` · ${chars} ElevenLabs characters` : ""}
          </div>
        )}

        {script && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-semibold">Script: {script.title}</h2>
            <ol className="flex flex-col gap-2">
              {script.scenes.map((s) => (
                <li key={s.sceneId} className="rounded-lg bg-ink-900 p-3 text-sm">
                  <div className="text-ink-100">
                    <span className="mr-2 text-xs text-ink-500">{s.sceneId}</span>
                    {s.narration}
                  </div>
                  <div className="mt-1 text-xs text-ink-500">{s.visualIdea}</div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <aside className="flex min-h-0 flex-col gap-3 overflow-y-auto border-l border-ink-800 bg-ink-900 p-4">
        {files.includes("video.mp4") ? (
          <video
            key={run.finishedAt ?? "video"}
            controls
            src={api.fileUrl(id, "video.mp4")}
            className="aspect-[9/16] w-full rounded-lg bg-black"
          />
        ) : (
          <div className="flex aspect-[9/16] w-full items-center justify-center rounded-lg bg-ink-950 text-xs text-ink-500">
            {run.status === "RUNNING"
              ? `${run.progress}% — the video appears here when rendered`
              : "No video"}
          </div>
        )}
        {files.includes("video.mp4") && (
          <a href={api.fileUrl(id, "video.mp4")} download={`${id}.mp4`} className="text-sm text-accent">
            Download MP4
          </a>
        )}
        {files.includes("video-plan.json") && (
          <Button onClick={() => void openPlan()}>Open the plan in Plan Preview</Button>
        )}
        <div className="mt-2 text-[11px] tracking-wider text-ink-500 uppercase">Files</div>
        <div className="flex flex-col gap-1 text-xs">
          {files.map((f) => (
            <a
              key={f}
              href={api.fileUrl(id, f)}
              target="_blank"
              rel="noreferrer"
              className="text-ink-300 hover:text-accent"
            >
              {f}
            </a>
          ))}
        </div>
        <div className="mt-2 text-[11px] break-all text-ink-700">out/runs/{id}</div>
      </aside>
    </div>
  );
}

export function Runs({ selected }: { selected?: string }) {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let alive = true;
    const load = () =>
      api
        .runs()
        .then((r) => {
          if (!alive) return;
          setRuns(r);
          setError(undefined);
        })
        .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    void load();
    const t = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const current = selected ?? runs[0]?.id;
  return (
    <div className="grid h-full grid-cols-[300px_1fr]">
      <aside className="flex min-h-0 flex-col border-r border-ink-800 bg-ink-900">
        <div className="flex items-center border-b border-ink-800 p-3">
          <span className="font-semibold">Runs</span>
          <a href="#new" className="ml-auto text-sm text-accent">
            + New video
          </a>
        </div>
        {error && <div className="p-3 text-xs text-red-300">{error}</div>}
        <div className="min-h-0 flex-1 overflow-y-auto">
          {runs.map((r) => (
            <a
              key={r.id}
              href={`#runs/${r.id}`}
              className={`block border-b border-ink-800 px-3 py-2.5 ${current === r.id ? "bg-ink-800" : "hover:bg-ink-800/60"}`}
            >
              <div className="flex items-center gap-2">
                <span className="truncate text-sm">{r.title ?? r.topic}</span>
                <span className="ml-auto shrink-0">
                  <Badge status={r.status} />
                </span>
              </div>
              <div className="mt-1 text-[11px] text-ink-500">
                {r.theme} · {ago(r.createdAt)}
                {r.status === "RUNNING" ? ` · ${r.currentStep ?? ""} ${r.progress}%` : ""}
              </div>
            </a>
          ))}
          {!runs.length && !error && <div className="p-3 text-sm text-ink-500">No videos yet.</div>}
        </div>
      </aside>
      <section className="min-h-0">
        {current ? (
          <RunPanel id={current} />
        ) : (
          <div className="p-6 text-sm text-ink-500">Make your first video.</div>
        )}
      </section>
    </div>
  );
}
