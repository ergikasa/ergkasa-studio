import { spawnSync } from "node:child_process";

/**
 * Command lines of the running processes that mention `needle` (the test's own work folder): pgrep on Linux and
 * macOS, the process table through PowerShell on Windows. Empty: none left.
 */
export function processesWith(needle: string): string {
  if (process.platform === "win32") {
    const q = needle.replace(/'/g, "''");
    const r = spawnSync(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains('${q}') -and $_.ProcessId -ne $PID } | ForEach-Object { $_.CommandLine }`,
      ],
      { encoding: "utf8", windowsHide: true },
    );
    if (r.status !== 0) throw new Error(`cannot list processes: ${r.stderr}`);
    return r.stdout.trim();
  }
  const r = spawnSync("pgrep", ["-af", needle], { encoding: "utf8" });
  if (r.error) throw r.error;
  return (r.stdout ?? "")
    .split("\n")
    .filter((l) => l && !l.includes("pgrep"))
    .join("\n")
    .trim();
}
