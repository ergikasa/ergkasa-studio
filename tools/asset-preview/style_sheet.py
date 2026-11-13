"""Fletë stili: objektet e skenës në shkallën reale, pranë një personazhi, për kontrollin me sy të një grupi.

Përdorimi: python3 tools/asset-preview/style_sheet.py out.png prop_bed_side_01 prop_sofa_01 ...
           python3 tools/asset-preview/style_sheet.py out.png --style erkasa_editorial_v2
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CHAR, CHAR_SCALE = "char_arti_01", 0.92
ROW_W, ROW_H, FLOOR = 2600, 1000, 900


def parts(svg_text: str) -> tuple[str, str]:
    body = re.search(r"<svg[^>]*>(.*)</svg>", svg_text, re.S).group(1)
    defs = "".join(re.findall(r"<defs>(.*?)</defs>", body, re.S))
    return defs, re.sub(r"<defs>.*?</defs>", "", body, flags=re.S)


def main() -> None:
    out = Path(sys.argv[1])
    ids = sys.argv[2:]
    if ids and ids[0] == "--style":
        ids = sorted(p.parent.name for p in (ROOT / "assets").glob("*/*/asset.json")
                     if json.loads(p.read_text())["style"] == ids[1] and json.loads(p.read_text())["category"] != "background"
                     and (len(ids) < 3 or json.loads(p.read_text()).get("collection") == ids[2]))
    cdefs, cbody = parts((ROOT / "assets" / "characters" / CHAR / "asset.svg").read_text())
    defs, rows, row, x = [cdefs], [], [], 0.0

    def new_row():
        nonlocal row, x
        row = [f'<g transform="translate(40 {FLOOR - 880 * CHAR_SCALE:.0f}) scale({CHAR_SCALE})">{cbody}</g>']
        x = 460.0
        rows.append(row)

    new_row()
    for aid in ids:
        folder = next((ROOT / "assets").glob(f"*/{aid}"))
        meta = json.loads((folder / "asset.json").read_text())
        _, _, w, h = meta["viewBox"]
        if x + w > ROW_W - 20:
            new_row()
        d, body = parts((folder / "asset.svg").read_text())
        defs.append(d)
        on_floor = "ground" in meta.get("anchors", {})
        y = FLOOR - h * (meta["anchors"]["ground"][1] if on_floor else 1) - (0 if on_floor else 330)
        y = max(20.0, y)
        row.append(f'<g transform="translate({x:.0f} {y:.0f})">{body}</g>')
        row.append(f'<text x="{x + w / 2:.0f}" y="{FLOOR + 56}" font-family="DejaVu Sans" font-size="26" text-anchor="middle" '
                   f'fill="#5B5249">{aid.removeprefix("prop_").removesuffix("_01")}</text>')
        x += w + 70
    total_h = ROW_H * len(rows)
    svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ROW_W} {total_h}" width="{ROW_W}" height="{total_h}"><defs>{"".join(defs)}</defs>']
    for i, r in enumerate(rows):
        svg.append(f'<g transform="translate(0 {i * ROW_H})"><rect width="{ROW_W}" height="{FLOOR}" fill="#EDE5DA"/>'
                   f'<rect y="{FLOOR - 130}" width="{ROW_W}" height="130" fill="#C9A27E"/><rect y="{FLOOR}" width="{ROW_W}" height="{ROW_H - FLOOR}" fill="#F6F3EE"/>'
                   f'{"".join(r)}</g>')
    svg.append("</svg>")
    tmp = out.with_suffix(".svg")
    tmp.write_text("".join(svg), encoding="utf-8")
    subprocess.run(["rsvg-convert", str(tmp), "-o", str(out)], check=True)
    tmp.unlink()
    print(f"{len(ids)} props -> {out}")


if __name__ == "__main__":
    main()
