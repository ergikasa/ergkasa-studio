"""Fleta e prezantimit për personazhet: trupi i plotë + çdo shprehje (koka).

Ndërron gjendjet e fytyrës (data-state) ashtu si do ta bëjë motori.
Përdorimi: python3 tools/asset-preview/character_sheet.py out.png
"""
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)
EXPR = ["neutral", "happy", "sad", "surprised", "angry", "thinking", "blink"]


def with_state(svg_text: str, expr: str) -> str:
    root = ET.fromstring(svg_text)
    want = {"eyes": expr, "brows": "neutral" if expr == "blink" else expr, "mouth": "neutral" if expr == "blink" else expr}
    for slot_el in root.iter(f"{{{NS}}}g"):
        slot = slot_el.get("data-slot")
        if not slot:
            continue
        for child in slot_el:
            if child.get("data-state") == want[slot]:
                child.attrib.pop("display", None)
            else:
                child.set("display", "none")
    inner = ET.tostring(root, encoding="unicode")
    return re.sub(r"^<svg[^>]*>|</svg>$", "", inner.strip())


def main() -> None:
    out = Path(sys.argv[1])
    chars = sorted(p for p in (ROOT / "assets" / "characters").iterdir() if (p / "rig.json").exists())
    row_h, w = 470, 220 + len(EXPR) * 120
    parts = [f'<svg xmlns="{NS}" viewBox="0 0 {w} {row_h*len(chars)}" width="{w}" height="{row_h*len(chars)}">',
             f'<rect width="{w}" height="{row_h*len(chars)}" fill="#F3F1EC"/>']
    for r, folder in enumerate(chars):
        src = (folder / "asset.svg").read_text()
        y0 = r * row_h
        parts.append(f'<svg x="10" y="{y0+10}" width="200" height="440" viewBox="0 0 400 880">{with_state(src, "neutral")}</svg>')
        parts.append(f'<text x="230" y="{y0+40}" font-family="DejaVu Sans" font-size="20" font-weight="bold" fill="#2A1E18">{folder.name}</text>')
        for i, e in enumerate(EXPR):
            x = 230 + i * 120
            parts.append(f'<rect x="{x}" y="{y0+60}" width="110" height="140" rx="10" fill="#FFF" stroke="#E4E0D8"/>')
            parts.append(f'<svg x="{x}" y="{y0+60}" width="110" height="125" viewBox="130 40 140 160">{with_state(src, e)}</svg>')
            parts.append(f'<text x="{x+55}" y="{y0+194}" text-anchor="middle" font-family="DejaVu Sans" font-size="11" fill="#5B5249">{e}</text>')
    crowd = ROOT / "assets" / "characters" / "char_crowd_01"
    if crowd.exists():
        y0 = row_h * len(chars) - 240
        for i, f in enumerate(sorted(crowd.glob("variant_*.svg"))):
            body = re.sub(r"^<svg[^>]*>|</svg>\s*$", "", f.read_text().strip())
            parts.append(f'<svg x="{240 + i*70}" y="{y0}" width="60" height="130" viewBox="0 0 120 260">{body}</svg>')
        parts.append(f'<text x="240" y="{y0-10}" font-family="DejaVu Sans" font-size="13" fill="#5B5249">char_crowd_01 (6 variante)</text>')
    parts.append("</svg>")
    tmp = out.with_suffix(".svg")
    tmp.write_text("".join(parts))
    subprocess.run(["rsvg-convert", str(tmp), "-o", str(out)], check=True)
    tmp.unlink()


if __name__ == "__main__":
    main()
