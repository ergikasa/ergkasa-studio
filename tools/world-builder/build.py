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
import re
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


def set_function(out: Path, entry: dict, prop: dict) -> None:
    """The object's job in this story (from the World Spec) becomes its storyUse: the planner reads it."""
    if not prop.get("function"):
        return
    f = out / entry["path"] / "asset.json"
    meta = json.loads(f.read_text(encoding="utf-8"))
    meta["storyUse"] = prop["function"] + (f" (scenes {', '.join(prop['scenes'])})" if prop.get("scenes") else "")
    f.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


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


# The staged sets of the compiler (compiler/src/sets.ts, SETS[id].background / .assets): a world copies the
# background and every piece of furniture, graded, so people can enter, walk, sit and hand things over in it.
SETS = {
    "interview_office": {
        "background": "bg_interview_office_01",
        "assets": {"door": "prop_door_01", "clock": "prop_wall_clock_01", "plant": "prop_plant_floor_01",
                   "chair": "prop_chair_office_side_01", "desk": "prop_desk_side_01",
                   "laptop": "prop_laptop_side_01", "mug": "prop_mug_01"},
    },
}


def build_set(out: Path, place: dict, style: str) -> list[dict]:
    st = SETS[place["set"]]
    key = place["id"].removeprefix("wld_place_")
    entries, refs = [], {}
    for role, lib in st["assets"].items():
        rid = f"wld_set_{key}_{role}"
        entries.append(copy_library(out, rid, lib, style, "props", ("object",)))
        refs[role] = rid
    bg = copy_library(out, place["id"], st["background"], style, "backgrounds", ("background",))
    meta_file = out / bg["path"] / "asset.json"
    meta = json.loads(meta_file.read_text(encoding="utf-8"))
    meta["capabilities"]["set"] = place["set"]
    meta["capabilities"]["setAssets"] = refs
    meta_file.write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return [bg, *entries]


def custom_prop(out: Path, prop: dict, style: str, custom_dir: Path | None) -> dict | None:
    """A prop drawn for this video (asset maker): graded with the world's style kit like everything else."""
    src = (custom_dir / f"{prop['id']}.svg") if custom_dir else None
    if not src or not src.exists():
        print(f"warning: custom prop '{prop['id']}' has no drawing; left out", file=sys.stderr)
        return None
    svg = src.read_text(encoding="utf-8")
    m = re.search(r'viewBox\s*=\s*"\s*0\s+0\s+([\d.]+)\s+([\d.]+)', svg)
    w, h = (float(m.group(1)), float(m.group(2))) if m else (200.0, 200.0)
    brief = prop.get("brief", "")
    words = [x for x in re.findall(r"[a-z]{3,}", brief.lower())][:8]
    meta = {
        "schema": "erkasa.asset/1", "assetId": prop["id"], "version": 1, "name": brief[:40] or prop["id"],
        "description": brief, "category": "object", "subcategory": "scene_prop", "collection": "world",
        "storyUse": brief, "kind": "prop", "adapter": "svg", "style": f"world_{style}",
        "files": {"svg": "asset.svg"}, "viewBox": [0, 0, w, h],
        "capabilities": {"animations": ["pop_in", "fade", "slide", "shake", "bounce"], "scale": "1 = standard"},
        "anchors": {"ground": [0.5, 1.0], "center": [0.5, 0.5]},
        "themes": ["psychology", "growth", "decisions"], "tags": ["custom", *words],
        "license": {"spdx": "LicenseRef-Erkasa-Original", "source": "Erkasa (drawn by Claude for this video, gated)",
                    "commercial": True, "attributionRequired": False},
    }
    if prop.get("function"):
        meta["storyUse"] = prop["function"] + (f" (scenes {', '.join(prop['scenes'])})" if prop.get("scenes") else "")
    return write(out, "props", meta, {"asset.svg": grade(svg, style)})


def build(spec: dict, out: Path, custom_dir: Path | None = None) -> dict:
    style = spec["style"]
    entries = []
    t0 = time.perf_counter()
    for place in spec["places"]:
        if place["kind"] == "library":
            entries.append(copy_library(out, place["id"], place["from"], style, "backgrounds", ("background",)))
            continue
        if place["kind"] == "set":
            entries.extend(build_set(out, place, style))
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
            entry = copy_library(out, prop["id"], prop["from"], style, "props", ("object", "metaphor", "icon"))
            set_function(out, entry, prop)
            entries.append(entry)
            continue
        if prop["kind"] == "custom":
            entry = custom_prop(out, prop, style, custom_dir)
            if entry:
                entries.append(entry)
            continue
        svg, meta = build_prop(prop, style)
        if prop.get("function"):
            meta["storyUse"] = prop["function"] + (f" (scenes {', '.join(prop['scenes'])})" if prop.get("scenes") else "")
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
    ap.add_argument("--custom", help="folder with the drawings of kind custom props (<propId>.svg)")
    a = ap.parse_args()
    spec = json.loads(Path(a.spec).read_text(encoding="utf-8"))
    if spec.get("schema") != "erkasa.world-spec/1":
        raise SystemExit(f"{a.spec}: not a world spec (schema erkasa.world-spec/1)")
    out = Path(a.out) if a.out else ROOT / "out" / "worlds" / spec["worldId"]
    out.mkdir(parents=True, exist_ok=True)
    res = build(spec, out, Path(a.custom) if a.custom else None)
    print(f"world '{spec['worldId']}' ({spec['style']}): {res['assets']} assets in {res['seconds']} s -> {out}")


_ = replace  # outfits per world come in a later step
if __name__ == "__main__":
    main()
