// Runs a Python script with whichever interpreter exists: python3 (macOS/Linux), python or py (Windows).
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const shell = process.platform === "win32";

for (const cmd of ["python3", "python", "py"]) {
  const probe = spawnSync(cmd, ["--version"], { stdio: "ignore", shell });
  if (probe.status === 0) {
    const run = spawnSync(cmd, args, { stdio: "inherit", shell });
    process.exit(run.status ?? 1);
  }
}

console.error("Python 3 not found. Install it from https://www.python.org/downloads/ and retry.");
process.exit(1);
