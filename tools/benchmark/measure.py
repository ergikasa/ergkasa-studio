"""Measures a finished video from its pixels alone, so the same numbers apply to an Erkasa render, a hand-made
reference and a previz: how often the picture changes, where nothing happens, where the cuts are and how long
the shots last. No Erkasa files are read; only the MP4.

    python tools/benchmark/measure.py video.mp4 [more.mp4 ...] [--ignore-band 0.62:0.82] [--json out.json]

--ignore-band hides a horizontal band (fractions of the height) before measuring, e.g. burned-in captions that
change every word and would otherwise count as "something happening". Hard cuts, whips and slides are found;
slow cross-fades are not (a fade changes too little from one frame to the next). Needs ffmpeg and ffprobe.
Python 3.10+, standard library only.
"""

from __future__ import annotations

import argparse
import json
import re
import statistics
import subprocess
import sys
from dataclasses import asdict, dataclass, field

FPS = 10  # analysis rate: enough to see motion, cheap to compute
STILL = 0.35  # mean luma difference (0-255) below which a frame counts as "nothing moved" (after blur)
DEAD_SEC = 2.0  # a still stretch at least this long is dead time
CUT = 0.10  # ffmpeg scene score above which a frame starts a new shot (hard cuts score ~0.12-1.0, motion < 0.08)
MERGE_SEC = 0.5  # detections closer than this belong to one transition (a whip or slide spans frames)


@dataclass
class Report:
    video: str
    durationSec: float
    shots: int
    shotLengthsSec: list[float]
    medianShotSec: float
    longestShotSec: float
    deadSegments: list[tuple[float, float]]
    deadTimeSec: float
    deadTimePct: float
    changingSecondsPct: float
    activityPerSecond: list[float] = field(repr=False)


def _run(cmd: list[str]) -> str:
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        sys.exit(f"{cmd[0]} failed: {res.stderr.strip()[-400:]}")
    return res.stdout + res.stderr


def duration(video: str) -> float:
    out = _run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", video])
    return float(out.strip().splitlines()[0])


def _mask(bands: list[tuple[float, float]]) -> str:
    return "".join(f",drawbox=x=0:y=ih*{a}:w=iw:h=ih*{b - a}:color=black:t=fill" for a, b in bands)


def activity(video: str, bands: list[tuple[float, float]]) -> list[float]:
    """Mean absolute luma difference between consecutive analysis frames (grain is blurred away first)."""
    vf = (
        f"fps={FPS},scale=270:480,format=gray,gblur=sigma=2.5{_mask(bands)},"
        "tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-"
    )
    out = _run(["ffmpeg", "-hide_banner", "-nostats", "-i", video, "-vf", vf, "-an", "-f", "null", "-"])
    return [float(v) for v in re.findall(r"lavfi\.signalstats\.YAVG=([\d.]+)", out)]


def cuts(video: str, bands: list[tuple[float, float]]) -> list[float]:
    vf = f"scale=270:480{_mask(bands)},select='gt(scene,{CUT})',metadata=print:file=-"
    out = _run(["ffmpeg", "-hide_banner", "-nostats", "-i", video, "-vf", vf, "-an", "-f", "null", "-"])
    found = [float(t) for t in re.findall(r"pts_time:([\d.]+)", out)]
    merged: list[float] = []
    for t in found:
        if not merged or t - merged[-1] > MERGE_SEC:
            merged.append(t)
    return merged


def measure(video: str, bands: list[tuple[float, float]]) -> Report:
    dur = duration(video)
    act = activity(video, bands)
    # dead segments: runs of still frames
    dead: list[tuple[float, float]] = []
    start = None
    for i, a in enumerate(act + [STILL + 1]):
        t = (i + 1) / FPS  # difference i is between frame i and i+1
        if a < STILL and start is None:
            start = i / FPS
        elif a >= STILL and start is not None:
            if t - start >= DEAD_SEC:
                dead.append((round(start, 1), round(min(t, dur), 1)))
            start = None
    per_sec = [max(act[s * FPS : (s + 1) * FPS] or [0.0]) for s in range(int(dur + 0.999))]
    bounds = [0.0] + [c for c in cuts(video, bands) if 0.2 < c < dur - 0.2] + [dur]
    shots = [round(b - a, 2) for a, b in zip(bounds, bounds[1:]) if b - a > 0.15]
    dead_total = round(sum(b - a for a, b in dead), 1)
    return Report(
        video=video,
        durationSec=round(dur, 2),
        shots=len(shots),
        shotLengthsSec=shots,
        medianShotSec=round(statistics.median(shots), 2) if shots else 0.0,
        longestShotSec=max(shots) if shots else 0.0,
        deadSegments=dead,
        deadTimeSec=dead_total,
        deadTimePct=round(100 * dead_total / dur, 1) if dur else 0.0,
        changingSecondsPct=round(100 * sum(1 for p in per_sec if p >= STILL) / max(1, len(per_sec)), 1),
        activityPerSecond=[round(p, 2) for p in per_sec],
    )


def bar(values: list[float]) -> str:
    """One character per second: blank = still, then more ink for more motion."""
    marks = " .:-=+*#"
    return "".join(marks[min(len(marks) - 1, int(v / STILL))] if v >= STILL else "_" for v in values)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("videos", nargs="+")
    ap.add_argument("--ignore-band", action="append", default=[], help="y0:y1 as fractions of the height")
    ap.add_argument("--json", help="write all reports to this file")
    args = ap.parse_args()
    bands = [tuple(float(x) for x in b.split(":")) for b in args.ignore_band]
    reports = [measure(v, bands) for v in args.videos]  # type: ignore[arg-type]
    for r in reports:
        print(f"\n{r.video}")
        print(f"  duration           {r.durationSec:.1f} s")
        print(f"  shots              {r.shots}  (median {r.medianShotSec:.1f} s, longest {r.longestShotSec:.1f} s)")
        print(f"  dead time          {r.deadTimeSec:.1f} s = {r.deadTimePct:.0f}%  (still for {DEAD_SEC:.0f} s or more)")
        print(f"  seconds with change {r.changingSecondsPct:.0f}%")
        for a, b in r.deadSegments:
            print(f"    still {a:5.1f} - {b:5.1f} s")
        print(f"  per second  |{bar(r.activityPerSecond)}|")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump([asdict(r) for r in reports], fh, indent=2)


if __name__ == "__main__":
    main()
