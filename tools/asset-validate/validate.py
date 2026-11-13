"""Validon bibliotekën e aseteve dhe gjeneron assets/manifest.json.

Kontrollon për çdo aset:
  - asset.json ka fushat e detyrueshme dhe assetId unik që përputhet me emrin e dosjes
  - skedarët e deklaruar ekzistojnë dhe SVG-të janë XML i vlefshëm
  - licenca lejon përdorim komercial
  - temat janë nga lista e lejuar
  - te personazhet: çdo kockë e rig.json ka grupin përkatës në SVG, dhe çdo gjendje fytyre ekziston
  - te metaforat: çdo pjesë e deklaruar ekziston si grup në SVG
Del me kod 1 nëse ka gabime.
"""
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ASSETS = ROOT / "assets"
REQUIRED = ["schema", "assetId", "version", "name", "category", "kind", "adapter", "files", "themes", "tags", "license"]
THEMES = {"psychology", "money", "growth", "philosophy", "science", "decisions", "everyday"}
NS = "{http://www.w3.org/2000/svg}"


def group_ids(svg_path: Path) -> set[str]:
    root = ET.parse(svg_path).getroot()
    return {el.get("id") for el in root.iter() if el.get("id")}


EDITORIAL_STYLE = "erkasa_editorial_v2"


def check_editorial(rel, meta: dict, folder: Path, errors: list[str]) -> None:
    """Rregullat e stilit të ri: metadata për planerin, paletë e mbyllur, pa raster/tekst/referenca, ID unike."""
    sys.path.insert(0, str(ROOT / "tools" / "asset-gen"))
    from editorial import PALETTE  # noqa: PLC0415  (burimi i vetëm i paletës)

    for k in ("description", "collection", "storyUse"):
        if not meta.get(k):
            errors.append(f"{rel}: stili {EDITORIAL_STYLE} kërkon fushën '{k}'")
    names = [meta["files"].get("svg", "asset.svg"), *meta.get("variants", {}).values()]
    for name in names:
        f = folder / name
        if not f.exists():
            errors.append(f"{rel}: varianti '{name}' mungon")
            continue
        text = f.read_text(encoding="utf-8")
        for bad in ("<image", "<text", "<script", "<foreignObject", "<filter", "href=", "<style"):
            if bad in text:
                errors.append(f"{rel}: {name} përmban '{bad}' (i ndaluar në këtë stil)")
        colours = {c.upper() for c in re.findall(r"#[0-9A-Fa-f]{6}\b", text)}
        extra = sorted(colours - set(PALETTE))
        if extra:
            errors.append(f"{rel}: {name} ka ngjyra jashtë paletës {extra}")
        for gid in re.findall(r'<(?:linear|radial)Gradient id="([^"]+)"', text):
            if not gid.startswith(meta["assetId"]):
                errors.append(f"{rel}: gradienti '{gid}' duhet të ketë si prefiks ID-në e asetit")
    vb = meta.get("viewBox") or [0, 0, 1, 1]
    if meta.get("kind") == "prop":
        for key, a in meta.get("anchors", {}).items():
            if not (0 <= a[0] <= 1 and 0 <= a[1] <= 1):
                errors.append(f"{rel}: anchor '{key}' jashtë viewBox-it")
    elif meta.get("kind") == "layered_background":
        for key, a in meta.get("anchors", {}).items():
            if not (0 <= a[0] <= vb[2] and 0 <= a[1] <= vb[3]):
                errors.append(f"{rel}: anchor '{key}' jashtë sfondit")


def check(folder: Path, errors: list[str]) -> dict | None:
    rel = folder.relative_to(ASSETS)
    try:
        meta = json.loads((folder / "asset.json").read_text())
    except Exception as e:  # noqa: BLE001
        errors.append(f"{rel}: asset.json i pavlefshëm ({e})")
        return None
    for k in REQUIRED:
        if k not in meta:
            errors.append(f"{rel}: mungon fusha '{k}'")
    if meta.get("assetId") != folder.name:
        errors.append(f"{rel}: assetId '{meta.get('assetId')}' ≠ emri i dosjes")
    lic = meta.get("license", {})
    if lic.get("commercial") is not True:
        errors.append(f"{rel}: licenca nuk lejon përdorim komercial")
    bad = set(meta.get("themes", [])) - THEMES
    if bad:
        errors.append(f"{rel}: tema të panjohura {sorted(bad)}")

    files = dict(meta.get("files", {}))
    files.update({f"variant_{k}": v for k, v in meta.get("variants", {}).items()})
    for key, name in files.items():
        p = folder / name
        if not p.exists():
            errors.append(f"{rel}: skedari '{name}' mungon")
            continue
        if p.suffix == ".svg":
            try:
                ET.parse(p)
            except ET.ParseError as e:
                errors.append(f"{rel}: {name} nuk është XML i vlefshëm ({e})")

    svg = folder / files.get("svg", "asset.svg")
    views = [("svg", "rig"), ("svg_side", "rig_side")]
    for svg_key, rig_key in views:
        if meta.get("kind") != "rigged_character" or rig_key not in files:
            continue
        svg = folder / files[svg_key]
        ids = group_ids(svg)
        rig = json.loads((folder / files[rig_key]).read_text())
        for bone in rig["bones"]:
            if bone["id"] != "root" and bone["svgGroup"] not in ids and bone["id"] != "hips":
                errors.append(f"{rel}: kocka '{bone['id']}' nuk ka grup në {files[svg_key]}")
        root = ET.parse(svg).getroot()
        for slot, states in rig["slots"].items():
            el = next((e for e in root.iter(f"{NS}g") if e.get("data-slot") == slot), None)
            have = {c.get("data-state") for c in el} if el is not None else set()
            missing = set(states) - have
            if missing:
                errors.append(f"{rel}: slot '{slot}' pa gjendjet {sorted(missing)} ({files[svg_key]})")
    # veshjet: e njëjta kokë (identiteti) në çdo veshje, vetëm rrobat ndryshojnë
    variants = meta.get("variants", {})
    if meta.get("kind") == "rigged_character" and variants:
        def head(p: Path) -> bytes:
            el = next((e for e in ET.parse(p).getroot().iter() if e.get("id") == "head"), None)
            return ET.tostring(el) if el is not None else b""
        for base_key, suffix in (("svg", ""), ("svg_side", "_side")):
            if base_key not in files:
                continue
            ref = head(folder / files[base_key])
            for key, name in variants.items():
                if key.endswith("_side") != bool(suffix) or not (folder / name).exists():
                    continue
                if head(folder / name) != ref:
                    errors.append(f"{rel}: veshja '{key}' ndryshon kokën (identitetin) e personazhit")
    svg = folder / files.get("svg", "asset.svg")
    if meta.get("kind") == "animated_metaphor" and svg.exists():
        ids = group_ids(svg)
        for part in meta.get("parts", {}):
            if part not in ids:
                errors.append(f"{rel}: pjesa '{part}' nuk ekziston në SVG")
    if meta.get("kind") == "layered_background" and svg.exists():
        ids = group_ids(svg)
        for layer in meta.get("layers", []):
            if layer["id"] not in ids:
                errors.append(f"{rel}: shtresa '{layer['id']}' nuk ekziston në SVG")

    if meta.get("style") == EDITORIAL_STYLE:
        check_editorial(rel, meta, folder, errors)

    return {
        "assetId": meta.get("assetId"), "category": meta.get("category"), "kind": meta.get("kind"),
        "adapter": meta.get("adapter"), "style": meta.get("style"), "path": str(rel),
        "themes": meta.get("themes", []), "tags": meta.get("tags", []), "license": lic.get("spdx"),
    }


def main() -> None:
    errors: list[str] = []
    entries, seen = [], set()
    for meta_file in sorted(ASSETS.rglob("asset.json")):
        entry = check(meta_file.parent, errors)
        if entry:
            if entry["assetId"] in seen:
                errors.append(f"assetId i dyfishtë: {entry['assetId']}")
            seen.add(entry["assetId"])
            entries.append(entry)
    counts: dict[str, int] = {}
    for e in entries:
        counts[e["category"]] = counts.get(e["category"], 0) + 1
    manifest = {"schema": "erkasa.asset-manifest/1", "total": len(entries), "counts": counts, "assets": entries}
    (ASSETS / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n")
    print(json.dumps({"total": len(entries), "counts": counts, "errors": len(errors)}, ensure_ascii=False))
    for e in errors:
        print("ERROR", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
