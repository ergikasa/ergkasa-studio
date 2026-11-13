"""Stili `erkasa_editorial_v2`: baza e përbashkët për asetet e reja të bibliotekës (plani i 300 aseteve).

I njëjti vizatim vektorial me kod si `erkasa_flat_v1`, por me thellësi:
- drita vjen gjithmonë nga lart-majtas; çdo vëllim ka një gradient (anë e ndriçuar → anë në hije);
- objektet në dysheme kanë hije kontakti (elips me gradient radial), jo filtra (filtrat janë të ngadaltë);
- paleta është e mbyllur (PALETTE më poshtë) dhe validatori refuzon ngjyra jashtë saj;
- pa tekst, pa raster, pa referenca të jashtme.

Shkalla është ajo e props-ave të PoC-së: 1 njësi e viewBox-it = 1 px i botës kur personazhi ka shkallën
standarde 0.92 (lartësia ~810 px, pra ~4.6 px për cm). Fundi i viewBox-it është dyshemeja.

ID-të e gradientëve marrin si prefiks ID-në e asetit, sepse motori i bashkon <defs> të të gjitha
aseteve të skenës në një dokument të vetëm.
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STYLE = "erkasa_editorial_v2"

SEAT_Y_ABOVE_FLOOR = 212      # sipërfaqja e ndenjëses (si te props.py)
TABLE_TOP_ABOVE_FLOOR = 348   # sipërfaqja e tavolinës
HIP_ABOVE_SEAT = 26

# ---------------------------------------------------------------- paleta
INK = "#2A1E18"
P = {
    # neutrale të ngrohta
    "ink": INK, "white": "#FFFFFF", "cream": "#F6F3EE", "cream2": "#E8E2D8", "cream3": "#D9D1C4",
    "sand": "#EADFCF", "sand2": "#D4C5B0", "sand3": "#B9A792",
    # dru
    "wood_l": "#C9A27E", "wood": "#A9825F", "wood_d": "#8A6849", "wood_dd": "#6B4F3A", "wood_ddd": "#4A3628",
    # metal / plastikë
    "steel_l": "#E3E8EE", "steel": "#B8C1CC", "steel_d": "#8E99A6", "steel_dd": "#6F7A86",
    "slate_l": "#4D5B70", "slate": "#3E4A5C", "slate_d": "#2B3445", "slate_dd": "#1E2533",
    # ngjyrat e theksit
    "red": "#C2554D", "red_d": "#9C3F3A", "red_l": "#DA7A70",
    "orange": "#E8833A", "orange_d": "#C96A28",
    "gold_l": "#F7D98A", "gold": "#E3B66B", "gold_d": "#B98A45",
    "green_l": "#8FBF84", "green": "#62A06C", "green_d": "#4F8A5B", "green_dd": "#3A6B47",
    "teal": "#2F8F8A", "teal_d": "#226B68",
    "blue_l": "#8FB1D4", "blue": "#5B7FA6", "blue_d": "#3E5F86", "blue_dd": "#2C4666",
    "sky_l": "#DDF1FB", "sky": "#8FCBEA", "glass": "#C2D3E3", "screen": "#7FB7E0",
    "violet": "#8E6BB0", "violet_d": "#6B4E8A",
    "night": "#1B2238", "night2": "#28324F", "night3": "#3B4770",
    "warm_light": "#FFE7A8", "warm_light2": "#FFF3D6",
    # trup, mermer, organe
    "skin_l": "#F1C6A6", "skin": "#E2B08C", "skin_d": "#C98F68",
    "pink_l": "#F4C2B8", "pink": "#E6A096", "pink_d": "#C97A72",
    "marble_l": "#FAF8F4", "marble": "#E6E2DA", "marble_d": "#C9C3B8", "marble_dd": "#A9A297",
    "brass_l": "#F2D49A", "brass": "#C9A15A", "brass_d": "#8F6E36",
    "parch_l": "#F5E6C4", "parch": "#E5CE9C", "parch_d": "#C4A56C",
}
PALETTE = sorted(set(P.values()))


# ---------------------------------------------------------------- vizatim
def rect(x, y, w, h, fill, rx=0, extra=""):
    return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{rx}" fill="{fill}" {extra}/>'


def circle(cx, cy, r, fill, extra=""):
    return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{fill}" {extra}/>'


def ellipse(cx, cy, rx, ry, fill, extra=""):
    return f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{fill}" {extra}/>'


def path(d, fill, extra=""):
    return f'<path d="{d}" fill="{fill}" {extra}/>'


def poly(pts, fill, extra=""):
    return f'<polygon points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="{fill}" {extra}/>'


def line(d, color, width, extra=""):
    return f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'


def g(gid, content, pivot=None):
    pv = f' data-pivot="{pivot[0]:.0f},{pivot[1]:.0f}"' if pivot else ""
    return f'<g id="{gid}"{pv}>{content}</g>'


class Defs:
    """Gradientët e një aseti. `prefix` = assetId, që ID-të të jenë unike në të gjithë skenën."""

    def __init__(self, prefix: str):
        self.prefix = prefix
        self.items: dict[str, str] = {}

    def _url(self, name: str, xml: str) -> str:
        gid = f"{self.prefix}__{name}"
        self.items[gid] = xml.replace("{id}", gid)
        return f"url(#{gid})"

    def v(self, name, top, bottom, mid=None):
        """Gradient vertikal: lart (i ndriçuar) → poshtë (në hije)."""
        stops = [(0, top)] + ([(0.5, mid)] if mid else []) + [(1, bottom)]
        return self._lin(name, stops, 0, 0, 0, 1)

    def h(self, name, left, right, mid=None):
        """Gradient horizontal: majtas (i ndriçuar) → djathtas (në hije). Për cilindra jep `mid`."""
        stops = [(0, left)] + ([(0.45, mid)] if mid else []) + [(1, right)]
        return self._lin(name, stops, 0, 0, 1, 0)

    def d(self, name, light, dark):
        """Gradient diagonal lart-majtas → poshtë-djathtas (drejtimi i dritës së stilit)."""
        return self._lin(name, [(0, light), (1, dark)], 0, 0, 1, 1)

    def _lin(self, name, stops, x1, y1, x2, y2):
        s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
        return self._url(name, f'<linearGradient id="{{id}}" x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}">{s}</linearGradient>')

    def glow(self, name, color, a0=0.9, a1=0.0, mid=None):
        """Gradient radial që shuhet drejt skajit: dritë, shkëlqim, hije kontakti."""
        stops = [(0, color, a0)] + ([(0.5, color, mid)] if mid is not None else []) + [(1, color, a1)]
        s = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
        return self._url(name, f'<radialGradient id="{{id}}">{s}</radialGradient>')

    def xml(self) -> str:
        return "".join(self.items.values())


def contact_shadow(defs: Defs, cx, floor_y, rx, ry=None, strength=0.34):
    """Hija e kontaktit me dyshemenë. Qëndron brenda viewBox-it (gjysma e sipërme e elipsit)."""
    ry = ry or max(8.0, rx * 0.09)
    return ellipse(cx, floor_y - ry * 0.35, rx, ry, defs.glow("shadow", INK, strength, 0.0, strength * 0.55))


def sheen(d, opacity=0.28):
    """Shkëlqim i bardhë mbi një sipërfaqe të lëmuar (xham, metal, ekran)."""
    return f'<path d="{d}" fill="#FFFFFF" opacity="{opacity}"/>'


# ---------------------------------------------------------------- shkrimi i asetit
LICENSE = {"spdx": "LicenseRef-Erkasa-Original", "source": "Erkasa (origjinal, i gjeneruar me kod)",
           "commercial": True, "attributionRequired": False}


def svg_doc(asset_id: str, w: float, h: float, defs: str, body: str) -> str:
    d = f"<defs>{defs}</defs>" if defs else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}">'
            f'{d}<g id="{asset_id}">{body}</g></svg>\n')


def write_asset(folder: str, meta: dict, files: dict[str, str]) -> None:
    d = ROOT / "assets" / folder / meta["assetId"]
    d.mkdir(parents=True, exist_ok=True)
    for name, text in files.items():
        (d / name).write_text(text, encoding="utf-8")
    (d / "asset.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


# ================================================================ ndihmës për formë
def lathe(defs: "Defs", name: str, cx: float, profile, light: str, dark: str, mid: str | None = None, extra: str = "") -> str:
    """Trup simetrik rrotullimi (figura shahu, kolona, shandanë, shishe): `profile` = [(y, gjysmë-gjerësia), ...]
    nga lart poshtë. Hija vjen nga gradienti horizontal (drita majtas)."""
    left = [(cx - w, y) for y, w in profile]
    right = [(cx + w, y) for y, w in reversed(profile)]
    pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in left + right)
    return f'<polygon points="{pts}" fill="{defs.h(name, light, dark, mid)}" {extra}/>'


def smooth_lathe(defs: "Defs", name: str, cx: float, profile, light: str, dark: str, mid: str | None = None) -> str:
    """Si `lathe`, por me kthesa të buta (Catmull-Rom → Bézier) në të dy anët."""
    def side(pts):
        out = f"L{pts[0][0]:.1f},{pts[0][1]:.1f}"
        for i in range(len(pts) - 1):
            p0, p1, p2 = pts[max(i - 1, 0)], pts[i], pts[i + 1]
            p3 = pts[min(i + 2, len(pts) - 1)]
            c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
            c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
            out += f" C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}"
        return out
    left = [(cx - w, y) for y, w in profile]
    right = [(cx + w, y) for y, w in reversed(profile)]
    d = "M" + side(left)[1:] + " " + side(right) + " Z"
    return f'<path d="{d}" fill="{defs.h(name, light, dark, mid)}"/>'


def star(cx, cy, r_out, r_in, n, fill, rot=-90, extra=""):
    import math
    pts = []
    for i in range(n * 2):
        r = r_out if i % 2 == 0 else r_in
        a = math.radians(rot + i * 180 / n)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return poly(pts, fill, extra)


def blob(cx, cy, r, n, rng, jitter, fill, extra=""):
    """Formë organike e mbyllur (tym, bojë, gjethe): rreth me rreze që lëkundet."""
    import math
    pts = [(cx + r * (1 + rng.uniform(-jitter, jitter)) * math.cos(2 * math.pi * i / n),
            cy + r * (1 + rng.uniform(-jitter, jitter)) * math.sin(2 * math.pi * i / n)) for i in range(n)]
    d = ""
    for i in range(n):
        p0, p1 = pts[i], pts[(i + 1) % n]
        m = ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2)
        d += (f"M{m[0]:.1f},{m[1]:.1f}" if i == 0 else "") + f" Q{p1[0]:.1f},{p1[1]:.1f} {((p1[0] + pts[(i + 2) % n][0]) / 2):.1f},{((p1[1] + pts[(i + 2) % n][1]) / 2):.1f}"
    return f'<path d="{d} Z" fill="{fill}" {extra}/>'


# ================================================================ shkrimi i një grupi objektesh
THEMES_BY_COLLECTION = {
    "home": ["psychology", "growth", "decisions"], "everyday": ["psychology", "growth", "decisions"],
    "psychology": ["psychology", "decisions", "growth"], "power": ["psychology", "decisions", "money"],
    "business": ["money", "decisions"], "philosophy": ["philosophy", "growth", "decisions"],
    "history": ["philosophy", "decisions", "science"], "effects": ["everyday"],
}


def obj(name, size, body, anchors, tags, parts, description, story_use, animations=("pop_in", "fade", "slide"),
        variants=None, collection=None, themes=None):
    """Përshkrimi i një objekti nga funksioni vizatues; `run` plotëson pjesën tjetër të metadata-ve."""
    return {"name": name, "size": size, "body": body, "anchors": anchors, "tags": tags, "parts": parts,
            "description": description, "storyUse": story_use, "animations": list(animations),
            "variants": variants or {}, "collection": collection, "themes": themes}


def run(items, collection: str, folder: str = "props", category: str = "object", subcategory: str = "scene_prop",
        kind: str = "prop") -> list[str]:
    """Shkruan asetet. `items` = [(assetId, funksion)]; funksioni merr Defs (dhe çelësin e variantit, nëse ka)."""
    written = []
    for asset_id, fn in items:
        d = Defs(asset_id)
        p = fn(d)
        w, h = p["size"]
        files = {"asset.svg": svg_doc(asset_id, w, h, d.xml(), p["body"])}
        for key, fname in p["variants"].items():
            dv = Defs(f"{asset_id}_{key}")
            variant_body = fn(dv, key)["body"]          # vizato së pari: gradientët regjistrohen gjatë vizatimit
            files[fname] = svg_doc(asset_id, w, h, dv.xml(), variant_body)
        coll = p["collection"] or collection
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1, "name": p["name"],
            "description": p["description"], "category": category, "subcategory": subcategory,
            "collection": coll, "storyUse": p["storyUse"],
            "kind": kind, "adapter": "svg", "style": STYLE, "files": {"svg": "asset.svg"},
            **({"variants": p["variants"]} if p["variants"] else {}),
            "viewBox": [0, 0, w, h],
            "capabilities": {"animations": p["animations"], "scale": "1 = shkalla e personazhit standard (0.92)"},
            "anchors": p["anchors"], "parts": p["parts"],
            "themes": p["themes"] or THEMES_BY_COLLECTION.get(coll, ["psychology", "decisions"]),
            "tags": p["tags"], "license": LICENSE,
        }
        write_asset(folder, meta, files)
        written.append(asset_id)
    return written
