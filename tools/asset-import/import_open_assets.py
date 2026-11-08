"""Importon objektet (Fluent Emoji Flat) dhe ikonat (Phosphor duotone) në assets/,
një dosje për çdo aset, me asset.json që mban licencën dhe burimin.

Përdorimi:
  cd tools/vendor && npm install @iconify-json/fluent-emoji-flat @iconify-json/ph
  python3 tools/asset-import/import_open_assets.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
VENDOR = ROOT / "tools" / "vendor" / "node_modules" / "@iconify-json"
ASSETS = ROOT / "assets"

sys.path.insert(0, str(Path(__file__).parent))
from selection import EXCLUDE_NAMES, FLUENT_OBJECTS, PHOSPHOR_ICONS  # noqa: E402

SOURCES = {
    "fluent": {
        "pack": "fluent-emoji-flat",
        "source": "Microsoft Fluent Emoji (flat)",
        "url": "https://github.com/microsoft/fluentui-emoji",
        "license_url": "https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE",
    },
    "phosphor": {
        "pack": "ph",
        "source": "Phosphor Icons (duotone)",
        "url": "https://github.com/phosphor-icons/core",
        "license_url": "https://github.com/phosphor-icons/core/blob/main/LICENSE",
    },
}


def load_pack(pack: str) -> dict:
    data = json.loads((VENDOR / pack / "icons.json").read_text())
    info = json.loads((VENDOR / pack / "info.json").read_text())
    assert info["license"]["spdx"] == "MIT", f"{pack}: licenca nuk është MIT"
    return data


def resolve(data: dict, name: str) -> tuple[str, int, int] | None:
    """Kthen (body, width, height) duke ndjekur alias-et e Iconify."""
    w, h = data.get("width", 16), data.get("height", 16)
    seen = 0
    while name not in data["icons"]:
        alias = data.get("aliases", {}).get(name)
        if not alias or seen > 5:
            return None
        name, seen = alias["parent"], seen + 1
    icon = data["icons"][name]
    return icon["body"], icon.get("width", w), icon.get("height", h)


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def write_asset(folder: Path, meta: dict, svg: str) -> None:
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "asset.svg").write_text(svg)
    (folder / "asset.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")


def license_block(src: dict) -> dict:
    return {"spdx": "MIT", "source": src["source"], "url": src["url"], "licenseUrl": src["license_url"],
            "commercial": True, "attributionRequired": False}


def main() -> None:
    missing: list[str] = []
    counts = {"objects": 0, "icons": 0}

    fluent = load_pack("fluent-emoji-flat")
    for name, (themes, tags) in FLUENT_OBJECTS.items():
        if not themes or name in EXCLUDE_NAMES:
            continue
        found = resolve(fluent, name)
        if not found:
            missing.append(f"fluent:{name}")
            continue
        body, w, h = found
        asset_id = f"obj_{slug(name)}"
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w*8}" height="{h*8}">{body}</svg>\n'
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1,
            "name": name.replace("-", " "), "category": "object", "kind": "prop", "adapter": "svg",
            "style": "fluent_flat", "files": {"svg": "asset.svg"},
            "viewBox": [0, 0, w, h],
            "capabilities": {"animations": ["pop_in", "fade", "float", "bounce", "spin", "shake", "scale_pulse"]},
            "anchors": {"center": [0.5, 0.5], "ground": [0.5, 1.0]},
            "themes": themes, "tags": sorted(set(tags + [name])),
            "license": license_block(SOURCES["fluent"]),
        }
        write_asset(ASSETS / "objects" / asset_id, meta, svg)
        counts["objects"] += 1

    ph = load_pack("ph")
    for name, themes in PHOSPHOR_ICONS.items():
        if not themes or name in EXCLUDE_NAMES:
            continue
        found = resolve(ph, f"{name}-duotone")
        if not found:
            missing.append(f"phosphor:{name}")
            continue
        body, w, h = found
        asset_id = f"icon_{slug(name)}"
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="256" height="256" '
               f'color="#2A1E18">{body}</svg>\n')
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1,
            "name": name.replace("-", " "), "category": "icon", "kind": "icon", "adapter": "svg",
            "style": "phosphor_duotone", "files": {"svg": "asset.svg"},
            "viewBox": [0, 0, w, h],
            "themable": {"color": "currentColor", "default": "#2A1E18"},
            "capabilities": {"animations": ["pop_in", "fade", "draw_on", "bounce", "scale_pulse"]},
            "anchors": {"center": [0.5, 0.5]},
            "themes": themes, "tags": [name],
            "license": license_block(SOURCES["phosphor"]),
        }
        write_asset(ASSETS / "icons" / asset_id, meta, svg)
        counts["icons"] += 1

    print(json.dumps(counts))
    if missing:
        print("MISSING:", " ".join(missing))


if __name__ == "__main__":
    main()
