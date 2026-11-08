import { useEffect, useMemo, useState } from "react";
import { assetUrl, loadManifest, type Manifest, type ManifestEntry } from "../lib/assets";
import { Button, Field } from "../ui";

const PAGE = 120;

/** Thumbnail file per kind: the first declared svg, read from asset.json lazily on selection. */
function thumbFile(a: ManifestEntry): string {
  return a.kind === "crowd_figure" ? "variant_a.svg" : "asset.svg";
}

export function AssetLibrary() {
  const [manifest, setManifest] = useState<Manifest>();
  const [category, setCategory] = useState("all");
  const [theme, setTheme] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [selected, setSelected] = useState<ManifestEntry>();
  const [meta, setMeta] = useState<string>();

  useEffect(() => {
    loadManifest().then(setManifest, (e: unknown) => console.error(e));
  }, []);

  useEffect(() => {
    setMeta(undefined);
    if (!selected) return;
    fetch(assetUrl(selected, "asset.json"))
      .then((r) => r.text())
      .then((t) => setMeta(JSON.stringify(JSON.parse(t), null, 2)))
      .catch((e: unknown) => setMeta(String(e)));
  }, [selected]);

  const themes = useMemo(
    () => [...new Set(manifest?.assets.flatMap((a) => a.themes) ?? [])].sort(),
    [manifest],
  );
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (manifest?.assets ?? []).filter(
      (a) =>
        (category === "all" || a.category === category) &&
        (theme === "all" || a.themes.includes(theme)) &&
        (!needle || a.assetId.includes(needle) || a.tags.some((t) => t.includes(needle))),
    );
  }, [manifest, category, theme, q]);

  if (!manifest) return <div className="p-6 text-ink-300">Loading manifest…</div>;

  return (
    <div className="grid h-full grid-cols-[1fr_380px]">
      <section className="flex min-h-0 flex-col">
        <div className="flex flex-wrap items-end gap-4 border-b border-ink-800 px-5 py-3">
          <Field label="Category">
            <div className="flex gap-1">
              {["all", ...Object.keys(manifest.counts)].map((c) => (
                <Button key={c} active={category === c} onClick={() => setCategory(c)}>
                  {c} {c === "all" ? manifest.total : manifest.counts[c]}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="Theme">
            <div className="flex flex-wrap gap-1">
              {["all", ...themes].map((t) => (
                <Button key={t} active={theme === t} onClick={() => setTheme(t)}>
                  {t}
                </Button>
              ))}
            </div>
          </Field>
          <Field label="Search id or tag">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="coin, growth, brain…"
              className="w-56 rounded-md border border-ink-700 bg-ink-950 px-2 py-1 text-sm"
            />
          </Field>
          <span className="ml-auto text-sm text-ink-300">{filtered.length} assets</span>
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-[150px] grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 overflow-y-auto p-5">
          {filtered.slice(0, limit).map((a) => (
            <button
              key={a.assetId}
              type="button"
              onClick={() => setSelected(a)}
              className={`flex flex-col overflow-hidden rounded-lg border bg-ink-900 text-left ${
                selected?.assetId === a.assetId ? "border-accent" : "border-ink-800 hover:border-ink-500"
              }`}
            >
              <div className="flex min-h-0 flex-1 items-center justify-center bg-[#f4efe6] p-2">
                <img
                  src={assetUrl(a, thumbFile(a))}
                  alt={a.assetId}
                  loading="lazy"
                  className="max-h-full max-w-full"
                />
              </div>
              <div className="truncate px-2 py-1 text-[11px] text-ink-300">{a.assetId}</div>
            </button>
          ))}
          {filtered.length > limit && (
            <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="text-sm text-accent">
              Show more ({filtered.length - limit})
            </button>
          )}
        </div>
      </section>
      <aside className="flex min-h-0 flex-col border-l border-ink-800 bg-ink-900">
        {selected ? (
          <>
            <div className="border-b border-ink-800 p-4">
              <div className="font-semibold">{selected.assetId}</div>
              <div className="mt-1 text-xs text-ink-300">
                {selected.category} · {selected.kind} · adapter {selected.adapter} · {selected.license}
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {selected.tags.map((t) => (
                  <span key={t} className="rounded bg-ink-800 px-1.5 py-0.5 text-[11px]">
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <pre className="min-h-0 flex-1 overflow-auto p-4 text-[11px] leading-relaxed text-ink-300">
              {meta ?? "Loading asset.json…"}
            </pre>
          </>
        ) : (
          <div className="p-4 text-sm text-ink-300">Select an asset to see its asset.json.</div>
        )}
      </aside>
    </div>
  );
}
