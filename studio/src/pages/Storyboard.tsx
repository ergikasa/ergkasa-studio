import { useEffect, useState } from "react";
import { ApiError, api, type RunDetail, type Storyboard as StoryboardData } from "../lib/api";
import { Button } from "../ui";

/** A render cannot take less than this, whatever the estimate says. */
const minutes = (sec: number): string =>
  sec < 90 ? `${Math.max(1, Math.round(sec / 10) * 10)} s` : `~${Math.round(sec / 60)} min`;

/**
 * The scenes of a video before it is rendered: two frames each, the narration, the length. The producer can
 * redo a scene (again, or in words) and approve; only then the expensive render starts.
 */
export function Storyboard({ detail, onChange }: { detail: RunDetail; onChange: (d: RunDetail) => void }) {
  const id = detail.run.id;
  const [data, setData] = useState<StoryboardData>();
  const [open, setOpen] = useState<string>();
  const [wish, setWish] = useState("");
  const [error, setError] = useState<string>();
  const steps = detail.steps;
  const redoing = steps.some((s) => s.id.startsWith("redo-") && s.status !== "SUCCEEDED");
  const rendering = steps.some((s) => s.id === "render");
  const ready =
    steps.some((s) => s.id === "storyboard" && s.status === "SUCCEEDED") && !rendering && !redoing;

  // redrawn after every redo: the run's update time changes while the step runs
  const stamp = `${detail.run.updatedAt}|${steps.map((s) => s.status).join("")}`;
  useEffect(() => {
    api
      .storyboard(id)
      .then(setData)
      .catch(() => undefined);
  }, [id, stamp]);

  const act = async (fn: () => Promise<RunDetail>): Promise<void> => {
    setError(undefined);
    try {
      onChange(await fn());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  };

  if (!data) return null;
  const v = Date.parse(detail.run.updatedAt ?? "") || 0;
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="text-sm font-semibold">
          Storyboard: {data.scenes.length} scenes, {data.totalSec} s
        </h2>
        <span className="text-xs text-ink-500">render {minutes(data.estimate.renderSec)}</span>
        {ready && (
          <span className="ml-auto">
            <Button active onClick={() => void act(() => api.render(id))}>
              Looks good: render ▸
            </Button>
          </span>
        )}
        {redoing && <span className="ml-auto text-xs text-ink-300">redoing a scene…</span>}
      </div>
      {error && <div className="mb-2 text-sm text-red-300">{error}</div>}
      <ol className="grid grid-cols-2 gap-3">
        {data.scenes.map((s) => (
          <li key={s.sceneId} className="rounded-lg bg-ink-900 p-3 text-sm">
            <div className="flex gap-2">
              {s.frames.map((f) => (
                <img
                  key={f}
                  src={`${api.fileUrl(id, f)}?v=${v}`}
                  alt={`${s.sceneId} frame`}
                  className="w-1/2 rounded bg-ink-950"
                  loading="lazy"
                />
              ))}
            </div>
            <div className="mt-2 text-xs text-ink-500">
              {s.sceneId} · {s.seconds} s
            </div>
            <div className="mt-1 text-ink-100">{s.narration}</div>
            {s.idea && <div className="mt-1 text-xs text-ink-300">{s.idea}</div>}
            {s.warnings.map((w) => (
              <div key={w} className="mt-1 text-[11px] text-amber-300">
                {w}
              </div>
            ))}
            {ready && (
              <div className="mt-2">
                {open === s.sceneId ? (
                  <div className="flex flex-col gap-2">
                    <input
                      value={wish}
                      onChange={(e) => setWish(e.target.value)}
                      maxLength={500}
                      placeholder="What do you want? (empty = try again)"
                      className="w-full rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-xs"
                    />
                    <div className="flex gap-2">
                      <Button
                        active
                        onClick={() => {
                          const w = wish;
                          setOpen(undefined);
                          setWish("");
                          void act(() => api.redo(id, s.sceneId, w));
                        }}
                      >
                        Redo
                      </Button>
                      <Button onClick={() => setOpen(undefined)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setOpen(s.sceneId)}>Redo this scene…</Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
