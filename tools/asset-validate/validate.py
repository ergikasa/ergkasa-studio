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
    if meta.get("kind") == "rigged_character" and svg.exists():
        ids = group_ids(svg)
        rig = json.loads((folder / files["rig"]).read_text())
        for bone in rig["bones"]:
            if bone["id"] != "root" and bone["svgGroup"] not in ids and bone["id"] != "hips":
                errors.append(f"{rel}: kocka '{bone['id']}' nuk ka grup në SVG")
        root = ET.parse(svg).getroot()
        for slot, states in rig["slots"].items():
            el = next((e for e in root.iter(f"{NS}g") if e.get("data-slot") == slot), None)
            have = {c.get("data-state") for c in el} if el is not None else set()
            missing = set(states) - have
            if missing:
                errors.append(f"{rel}: slot '{slot}' pa gjendjet {sorted(missing)}")
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
