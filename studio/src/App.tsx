import { useEffect, useState } from "react";
import { AssetLibrary } from "./pages/AssetLibrary";
import { PlanPlayer } from "./pages/PlanPlayer";
import { RigLab } from "./pages/RigLab";

const PAGES = {
  rig: { label: "Rig Lab", view: RigLab },
  assets: { label: "Asset Library", view: AssetLibrary },
  player: { label: "Plan Preview", view: PlanPlayer },
} as const;
type PageId = keyof typeof PAGES;

const isPage = (v: string): v is PageId => v in PAGES;
const fromHash = (): PageId => {
  const h = window.location.hash.slice(1);
  return isPage(h) ? h : "rig";
};

/** Not built yet; listed so the Studio never pretends a missing feature exists. */
const PLANNED = ["Projects", "Script & Plan (AI)", "Voice", "Render queue"];

export function App() {
  const [page, setPage] = useState<PageId>(fromHash);
  useEffect(() => {
    const onHash = () => setPage(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const View = PAGES[page].view;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-6 border-b border-ink-800 bg-ink-900 px-5 py-2.5">
        <div className="font-bold tracking-tight">
          Erkasa <span className="text-accent">Studio</span>
        </div>
        <nav className="flex gap-1">
          {(Object.keys(PAGES) as PageId[]).map((id) => (
            <a
              key={id}
              href={`#${id}`}
              className={`rounded-md px-3 py-1.5 text-sm ${
                page === id ? "bg-ink-700 text-ink-100" : "text-ink-300 hover:text-ink-100"
              }`}
            >
              {PAGES[id].label}
            </a>
          ))}
          {PLANNED.map((p) => (
            <span
              key={p}
              title="Not implemented yet"
              className="cursor-not-allowed rounded-md px-3 py-1.5 text-sm text-ink-700"
            >
              {p} <span className="text-[10px] uppercase">soon</span>
            </span>
          ))}
        </nav>
      </header>
      <main className="min-h-0 flex-1">
        <View />
      </main>
    </div>
  );
}
