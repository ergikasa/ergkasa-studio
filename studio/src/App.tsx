import { useEffect, useState } from "react";
import { AssetLibrary } from "./pages/AssetLibrary";
import { NewVideo } from "./pages/NewVideo";
import { PlanPlayer } from "./pages/PlanPlayer";
import { RigLab } from "./pages/RigLab";
import { Runs } from "./pages/Runs";
import { Voices } from "./pages/Voices";

const PAGES = {
  new: { label: "New video", view: NewVideo },
  runs: { label: "Runs", view: Runs },
  rig: { label: "Rig Lab", view: RigLab },
  assets: { label: "Asset Library", view: AssetLibrary },
  player: { label: "Plan Preview", view: PlanPlayer },
  voices: { label: "Voices", view: Voices },
} as const;
type PageId = keyof typeof PAGES;

const isPage = (v: string): v is PageId => v in PAGES;
/** `#runs/<id>` selects a run; anything unknown opens New video. */
const fromHash = (): { page: PageId; arg?: string } => {
  const [head = "", ...rest] = window.location.hash.slice(1).split("/");
  const arg = rest.join("/") || undefined;
  return isPage(head) ? { page: head, ...(arg ? { arg } : {}) } : { page: "new" };
};

export function App() {
  const [{ page, arg }, setRoute] = useState(fromHash);
  useEffect(() => {
    const onHash = () => setRoute(fromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

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
        </nav>
      </header>
      <main className="min-h-0 flex-1">
        {page === "runs" ? <Runs {...(arg ? { selected: arg } : {})} /> : <PageView page={page} />}
      </main>
    </div>
  );
}

function PageView({ page }: { page: Exclude<PageId, "runs"> }) {
  const View = PAGES[page].view;
  return <View />;
}
