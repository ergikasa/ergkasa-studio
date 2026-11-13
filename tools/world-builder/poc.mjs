// World Builder PoC: builds the three worlds and renders the same 30 s story in each of them.
//   pnpm poc:worlds            -> out/world-poc/coin-{castle,office,rooftop}.mp4
//   pnpm poc:worlds castle     -> only one world
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const worlds = process.argv.slice(2).length ? process.argv.slice(2) : ["castle", "office", "rooftop"];
const run = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
for (const w of worlds) {
  run("node", ["tools/run-python.mjs", "tools/world-builder/build.py", `worlds/${w}.world.json`]);
  run(
    "pnpm",
    [
      "-s",
      "render",
      "demo/world-poc/coin.video-plan.json",
      "--world",
      `../out/worlds/${w}`,
      "--no-captions",
      "--music-placeholder",
      "-o",
      `../out/world-poc/coin-${w}.mp4`,
    ],
    resolve(root, "engine-worker"),
  );
}
