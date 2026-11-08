"""Krijon një fletë pamjeje (PNG) për një kategori asetesh, që të kontrollohen me sy.

Përdorimi: python3 tools/asset-preview/contact_sheet.py objects out.png [kolona] [madhësia_qelizës]
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def inner(svg_text: str) -> tuple[str, str]:
    m = re.search(r"<svg([^>]*)>(.*)</svg>", svg_text, re.S)
    attrs, body = m.group(1), m.group(2)
    vb = re.search(r'viewBox="([^"]+)"', attrs).group(1)
    color = re.search(r'color="([^"]+)"', attrs)
    return vb, (f'<g color="{color.group(1)}">{body}</g>' if color else body)


def main() -> None:
    category, out = sys.argv[1], Path(sys.argv[2])
    cols = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    cell = int(sys.argv[4]) if len(sys.argv) > 4 else 110
    folders = sorted(p for p in (ROOT / "assets" / category).iterdir() if (p / "asset.json").exists())
    rows = (len(folders) + cols - 1) // cols
    label_h = 18
    w, h = cols * cell, rows * (cell + label_h) + 20
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">',
             f'<rect width="{w}" height="{h}" fill="#F3F1EC"/>']
    for i, folder in enumerate(folders):
        meta = json.loads((folder / "asset.json").read_text())
        svg_file = folder / meta["files"].get("svg", "asset.svg")
        vb, body = inner(svg_file.read_text())
        x, y = (i % cols) * cell, (i // cols) * (cell + label_h) + 10
        pad = cell * 0.14
        parts.append(f'<svg x="{x+pad}" y="{y+pad*0.5}" width="{cell-2*pad}" height="{cell-2*pad}" viewBox="{vb}">{body}</svg>')
        label = meta["assetId"].split("_", 1)[1][:16]
        parts.append(f'<text x="{x+cell/2}" y="{y+cell-2}" font-family="DejaVu Sans" font-size="9.5" '
                     f'text-anchor="middle" fill="#5B5249">{label}</text>')
    parts.append("</svg>")
    tmp = out.with_suffix(".svg")
    tmp.write_text("".join(parts))
    subprocess.run(["rsvg-convert", str(tmp), "-o", str(out)], check=True)
    tmp.unlink()
    print(f"{len(folders)} assets -> {out}")


if __name__ == "__main__":
    main()
