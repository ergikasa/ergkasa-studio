"""Grupe njerëzish si objekte skene: `prop_people_group_01` (6 vetë) dhe `prop_crowd_mass_01` (turmë e dendur).

Njerëzit janë figurantë të përgjithshëm, të vizatuar me të njëjtin gjenerator si personazhet (`characters.py`),
por me pamje që nuk ngjasojnë me kastin (Arti, Era, Drini...). Kështu një grup në sfond nuk ngatërrohet me
protagonistin. Nuk kanë rig: janë një vizatim i vetëm, që lëviz si objekt (fade, slide, bob).

Përdorimi: python3 tools/asset-gen/people.py
"""
from __future__ import annotations

import json
import random
import re
from dataclasses import replace

from characters import LOOKS, ROOT, Look, character_svg
from characters_side import side_svg

STYLE = "erkasa_flat_v1"   # stili i personazheve: këta janë njerëz, jo objekte editoriale
LICENSE = {"spdx": "LicenseRef-Erkasa-Original", "source": "Erkasa (origjinal, i gjeneruar me kod)",
           "commercial": True, "attributionRequired": False}

BASE = next(l for l in LOOKS if l.asset_id == "char_genti_01")

# figurantët: lëkurë, flokë dhe rroba të ndryshme nga kasti
EXTRAS = [
    dict(skin="#D9A07A", skin_sh="#BF8662", hair="#1E1A18", hair_hi="#3A3330", hair_style="short_messy", beard=None,
         top="hoodie", top_main="#5B7FA6", top_sh="#4A6B8E", top_dk="#3E5F86", pants="#2E323C", pants_sh="#24272F",
         shoes="sneaker", shoe_main="#F4F1EA", shoe_sh="#D9D1C4", sole="#B9A792", glasses=False, age_lines=False),
    dict(skin="#F3CDB0", skin_sh="#DDB094", hair="#C98F4E", hair_hi="#E0AE6C", hair_style="long", beard=None,
         top="blouse", top_main="#E3B66B", top_sh="#C99A50", top_dk="#A87A30", pants="#4A4E57", pants_sh="#3C4048",
         shoes="shoe", shoe_main="#6B4F3A", shoe_sh="#4A3628", sole="#2A1E18", lashes=True, blush=True, lips="#B0574F",
         glasses=False, age_lines=False),
    dict(skin="#8E5B3E", skin_sh="#76482E", hair="#151210", hair_hi="#2E2622", hair_style="buzz", beard="moustache",
         beard_main="#151210", top="shirt", top_main="#62A06C", top_sh="#4F8A5B", top_dk="#3A6B47", pants="#5C5048",
         pants_sh="#4A4038", shoes="shoe", shoe_main="#2A1E18", shoe_sh="#1A120E", sole="#120C09", glasses=False, age_lines=False),
    dict(skin="#E7B796", skin_sh="#CE9A78", hair="#B8B2AA", hair_hi="#D6D0C8", hair_style="bob", beard=None,
         top="cardigan", top_main="#8E6BB0", top_sh="#7A5A9A", top_dk="#6B4E8A", inner="#F4F1EA", pants="#3A3F4C",
         pants_sh="#2E323C", shoes="shoe", shoe_main="#2A1E18", shoe_sh="#1A120E", sole="#120C09", lashes=True,
         glasses=True, age_lines=True),
    dict(skin="#C98F68", skin_sh="#B07652", hair="#4A3A30", hair_hi="#6B5644", hair_style="swept", beard="full",
         beard_main="#4A3A30", beard_sh="#3A2D25", top="suit", top_main="#5C6066", top_sh="#4A4E54", top_dk="#3A3E44",
         inner="#F4F1EA", tie="#C2554D", pants="#5C6066", pants_sh="#4A4E54", shoes="shoe", shoe_main="#1A120E",
         shoe_sh="#120C09", sole="#060403", glasses=False, age_lines=False),
    dict(skin="#F1C6A6", skin_sh="#DDA584", hair="#2A211C", hair_hi="#4A3A30", hair_style="long", beard=None,
         top="hoodie", top_main="#C2554D", top_sh="#9C3F3A", top_dk="#7E302C", pants="#3E5F86", pants_sh="#2C4666",
         shoes="sneaker", shoe_main="#F4F1EA", shoe_sh="#D9D1C4", sole="#B9A792", lashes=True, glasses=False, age_lines=False),
]


def extra(i: int) -> Look:
    fields = {"lashes": False, "blush": False, "inner": None, "tie": None, "pocket_square": None, "watch": False}
    fields.update(EXTRAS[i % len(EXTRAS)])
    return replace(BASE, asset_id=f"extra_{i}", name="", description="", tags=[], **fields)


def flat(svg: str) -> str:
    """Një personazh si vizatim i thjeshtë: pa ID, pa pivot-e, pa gjendje të fshehura (vetëm `neutral`)."""
    body = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
    body = re.sub(r'<g data-state="[^"]+" display="none">(?:(?!</?g\b).)*?</g>', "", body, flags=re.S)
    body = re.sub(r'\s(?:id|data-[a-z-]+)="[^"]*"', "", body)
    return body


def tone(svg: str, k: float, toward: tuple[int, int, int]) -> str:
    """Përzien çdo ngjyrë me `toward`: figurat larg dalin më të zbehta, si në perspektivë ajrore."""
    def mix(m):
        h = m.group(0)[1:]
        c = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
        return "#" + "".join(f"{round(a + (b - a) * k):02X}" for a, b in zip(c, toward))
    return re.sub(r"#[0-9A-Fa-f]{6}\b", mix, svg)


def people_group() -> tuple[str, list[int]]:
    """Gjashtë vetë në dy rreshta, të kthyer pak nga njëri-tjetri. Shkalla e personazhit standard (0.92)."""
    s = 0.92
    back = [(250, 1, False), (560, 3, True), (850, 5, False)]
    front = [(90, 0, False), (410, 2, True), (720, 4, False)]
    w, h = 1120, int(880 * s) + 30
    out = []
    for x, i, side in back:
        art = flat(side_svg(extra(i)) if side else character_svg(extra(i)))
        flip = f" translate(400 0) scale(-1 1)" if side and x > 500 else ""
        out.append(f'<g transform="translate({x} 6) scale({s * 0.94:.3f}){flip}">{tone(art, 0.22, (217, 209, 196))}</g>')
    for x, i, side in front:
        art = flat(side_svg(extra(i)) if side else character_svg(extra(i)))
        out.append(f'<g transform="translate({x} {h - 30 - 880 * s:.0f}) scale({s})">{art}</g>')
    shadow = '<ellipse cx="560" cy="{:.0f}" rx="540" ry="20" fill="#2A1E18" fill-opacity="0.16"/>'.format(h - 22)
    return shadow + "".join(out), [w, h]


def crowd_mass() -> tuple[str, list[int]]:
    """Turmë e dendur nga pas: koka dhe supe në 5 rreshta, më të vogla dhe më të zbehta larg."""
    rng = random.Random(275)
    tops = ["#5B7FA6", "#C2554D", "#62A06C", "#E3B66B", "#8E6BB0", "#3E4A5C", "#E8833A", "#7D858F", "#2F8F8A", "#A9825F"]
    hairs = ["#1E1A18", "#2A211C", "#4A3A30", "#6B3F2A", "#C98F4E", "#9A948C", "#151210"]
    skins = ["#F1C6A6", "#E7B796", "#D9A07A", "#C98F68", "#8E5B3E", "#EDBE9C"]
    w, h = 2560, 760
    rows = [(0.42, 300, 0.42), (0.55, 370, 0.32), (0.7, 460, 0.2), (0.86, 570, 0.1), (1.04, 700, 0.0)]
    out = []
    for scale, base, fade in rows:
        step = 118 * scale
        x = -rng.uniform(0, step)
        while x < w + step:
            sx = x + rng.uniform(-14, 14) * scale
            sy = base + rng.uniform(-10, 10) * scale
            top, hair, skin = rng.choice(tops), rng.choice(hairs), rng.choice(skins)
            r = 34 * scale
            fig = (f'<path d="M{sx - 64 * scale:.1f},{sy + 140 * scale:.1f} Q{sx - 62 * scale:.1f},{sy + 36 * scale:.1f} {sx:.1f},{sy + 30 * scale:.1f} '
                   f'Q{sx + 62 * scale:.1f},{sy + 36 * scale:.1f} {sx + 64 * scale:.1f},{sy + 140 * scale:.1f} Z" fill="{top}"/>'
                   f'<rect x="{sx - 11 * scale:.1f}" y="{sy + 8 * scale:.1f}" width="{22 * scale:.1f}" height="{26 * scale:.1f}" fill="{skin}"/>'
                   f'<ellipse cx="{sx - r * 0.96:.1f}" cy="{sy - 8 * scale:.1f}" rx="{7 * scale:.1f}" ry="{11 * scale:.1f}" fill="{skin}"/>'
                   f'<ellipse cx="{sx + r * 0.96:.1f}" cy="{sy - 8 * scale:.1f}" rx="{7 * scale:.1f}" ry="{11 * scale:.1f}" fill="{skin}"/>'
                   f'<circle cx="{sx:.1f}" cy="{sy - 14 * scale:.1f}" r="{r:.1f}" fill="{hair}"/>'
                   f'<path d="M{sx - r * 0.5:.1f},{sy - 14 * scale - r * 0.7:.1f} Q{sx:.1f},{sy - 14 * scale - r * 0.95:.1f} {sx + r * 0.4:.1f},{sy - 14 * scale - r * 0.75:.1f}" '
                   f'fill="none" stroke="#FFFFFF" stroke-opacity="0.18" stroke-width="{5 * scale:.1f}" stroke-linecap="round"/>')
            out.append(tone(fig, fade, (217, 209, 196)))
            x += step * rng.uniform(0.82, 1.08)
    return "".join(out), [w, h]


ASSETS = [
    ("prop_people_group_01", "Grup njerëzish", people_group,
     "A group of six ordinary people standing together in two staggered rows; the middle pair turn towards each other. Generic extras, not the main cast.",
     "Social groups, belonging, peer pressure, conformity (Asch), the in-group; a group the protagonist joins or stands apart from.",
     ["group", "people", "team", "colleagues", "friends", "social", "conformity", "peer-pressure", "belonging", "in-group"],
     ["pop_in", "fade", "slide", "bob"]),
    ("prop_crowd_mass_01", "Turmë", crowd_mass,
     "A dense crowd seen from behind: five rows of heads and shoulders, smaller and paler towards the back. Spans the full background width.",
     "Mass behaviour, herd mentality, the bystander effect, social proof, feeling lost or anonymous in a crowd. Place it low in the frame, in front of the scene.",
     ["crowd", "people", "mass", "audience", "public", "herd", "social-proof", "bystander", "anonymous", "society"],
     ["fade", "slide", "bob"]),
]


def main() -> None:
    for asset_id, name, fn, description, story_use, tags, animations in ASSETS:
        body, (w, h) = fn()
        d = ROOT / "assets" / "props" / asset_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "asset.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><g id="{asset_id}">{body}</g></svg>\n',
            encoding="utf-8")
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1, "name": name, "description": description,
            "category": "object", "subcategory": "people", "collection": "characters", "storyUse": story_use,
            "kind": "prop", "adapter": "svg", "style": STYLE, "files": {"svg": "asset.svg"}, "viewBox": [0, 0, w, h],
            "capabilities": {"animations": animations, "scale": "1 = shkalla e personazhit standard (0.92)"},
            "anchors": {"ground": [0.5, 1.0]}, "themes": ["psychology", "everyday", "decisions"], "tags": tags,
            "license": LICENSE,
        }
        (d / "asset.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"{len(ASSETS)} grupe njerëzish")


if __name__ == "__main__":
    main()
