"""World Builder: World Spec -> the assets of one video.

    python tools/world-builder/build.py worlds/castle.world.json            # -> out/worlds/castle/
    python tools/world-builder/build.py worlds/castle.world.json -o some/dir

Writes, in the output folder, one asset folder per place, character and prop of the spec plus a
`manifest.json`, in the same format as the studio library: the render worker reads the folder as a second
asset root (`--world`), checked before the library. Every asset is graded with the world's style kit.
Nothing in assets/ is touched.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import replace
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "tools" / "asset-gen"))
sys.path.insert(0, str(HERE))

from cast import look_for  # noqa: E402
from characters import asset_json, character_svg, rig_json  # noqa: E402
from characters_side import side_rig, side_svg  # noqa: E402
from places import build_place  # noqa: E402
from props import build_prop  # noqa: E402
from style import grade  # noqa: E402


def write(out: Path, folder: str, meta: dict, files: dict[str, str]) -> dict:
    d = out / folder / meta["assetId"]
    d.mkdir(parents=True, exist_ok=True)
    for name, text in files.items():
        (d / name).parent.mkdir(parents=True, exist_ok=True)
        (d / name).write_text(text, encoding="utf-8")
    (d / "asset.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"assetId": meta["assetId"], "category": meta["category"], "kind": meta["kind"], "adapter": meta["adapter"],
            "style": meta["style"], "path": f"{folder}/{meta['assetId']}", "themes": meta["themes"], "tags": meta["tags"],
            "license": meta["license"]["spdx"]}


LIBRARY = ROOT / "assets"
_library_paths: dict[str, str] | None = None


def library_path(asset_id: str) -> Path:
    global _library_paths
    if _library_paths is None:
        manifest = json.loads((LIBRARY / "manifest.json").read_text(encoding="utf-8"))
        _library_paths = {a["assetId"]: a["path"] for a in manifest["assets"]}
    rel = _library_paths.get(asset_id)
    if not rel:
        raise SystemExit(f"library asset '{asset_id}' does not exist")
    return LIBRARY / rel


def copy_library(out: Path, new_id: str, from_id: str, style: str, folder: str, expect: tuple[str, ...]) -> dict:
    """A library asset copied into the world under a role id, every SVG graded with the world's style kit.
    The original keeps its recipes: a metaphor names its library id in capabilities.recipes."""
    src = library_path(from_id)
    meta = json.loads((src / "asset.json").read_text(encoding="utf-8"))
    if meta["category"] not in expect:
        raise SystemExit(f"'{from_id}' is a {meta['category']}, expected {' or '.join(expect)}")
    files: dict[str, str] = {}
    for f in sorted(src.rglob("*")):
        if f.is_file() and f.name != "asset.json":
            text = f.read_text(encoding="utf-8")
            files[f.relative_to(src).as_posix()] = grade(text, style) if f.suffix == ".svg" else text
    meta["assetId"] = new_id
    meta["style"] = f"world_{style}"
    meta["subcategory"] = "world"
    meta["description"] = f"{meta.get('description') or meta['name']} (from {from_id})"
    if meta["category"] == "metaphor":
        meta["capabilities"]["recipes"] = from_id
    return write(out, folder, meta, files)


def build(spec: dict, out: Path) -> dict:
    style = spec["style"]
    entries = []
    t0 = time.perf_counter()
    for place in spec["places"]:
        if place["kind"] == "library":
            entries.append(copy_library(out, place["id"], place["from"], style, "backgrounds", ("background",)))
            continue
        svg, meta = build_place(place, style)
        entries.append(write(out, "backgrounds", meta, {"asset.svg": grade(svg, style)}))
    for i, ch in enumerate(spec["cast"]):
        if ch.get("from"):
            entries.append(copy_library(out, ch["id"], ch["from"], style, "characters", ("character",)))
            continue
        look = look_for(ch, i)
        meta = asset_json(look)
        meta["style"] = f"world_{style}"
        meta["subcategory"] = "world"
        meta["capabilities"]["outfits"] = {"default": "default", "available": ["default"]}
        if ch.get("plays"):
            meta["tags"] = [*meta["tags"], f"plays:{ch['plays']}"]
        files = {
            "asset.svg": grade(character_svg(look), style),
            "rig.json": json.dumps(rig_json(look), indent=2) + "\n",
            "asset_side.svg": grade(side_svg(look), style),
            "rig_side.json": json.dumps(side_rig(look), indent=2) + "\n",
        }
        entries.append(write(out, "characters", meta, files))
    for prop in spec.get("props", []):
        if prop["kind"] == "library":
            entries.append(copy_library(out, prop["id"], prop["from"], style, "props", ("object", "metaphor", "icon")))
            continue
        svg, meta = build_prop(prop, style)
        entries.append(write(out, "props", meta, {"asset.svg": grade(svg, style)}))
    counts: dict[str, int] = {}
    for e in entries:
        counts[e["category"]] = counts.get(e["category"], 0) + 1
    manifest = {"schema": "erkasa.asset-manifest/1", "world": spec["worldId"], "style": style,
                "total": len(entries), "counts": counts, "assets": entries}
    (out / "manifest.json").write_text(json.dumps(manifest, indent=1) + "\n", encoding="utf-8")
    (out / "world.json").write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return {"assets": len(entries), "seconds": round(time.perf_counter() - t0, 2)}


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec")
    ap.add_argument("-o", "--out")
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text(encoding="utf-8"))
    if spec.get("schema") != "erkasa.world-spec/1":
        raise SystemExit(f"{a.spec}: not a world spec (schema erkasa.world-spec/1)")
    out = Path(a.out) if a.out else ROOT / "out" / "worlds" / spec["worldId"]
    out.mkdir(parents=True, exist_ok=True)
    res = build(spec, out)
    print(f"world '{spec['worldId']}' ({spec['style']}): {res['assets']} assets in {res['seconds']} s -> {out}")


_ = replace  # outfits per world come in a later step
if __name__ == "__main__":
    main()
