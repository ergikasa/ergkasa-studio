"""Places of a world: layered backgrounds built from modules (sky, far land, buildings, the walkway the cast
stands on) with the time of day, the two story colours and a seed as parameters.

Same frame rules as the studio backgrounds: 2560x1920 world, feet on y = 1690, the 9:16 frame shows
x 740..1820, far layers drawn wider than the frame for pans.
"""
from __future__ import annotations

import math
import random

from backgrounds_v2 import GROUND_Y, H, W, X0, X1, cloud, layer
from bglib import CENTER, SAFE, skyline, stars_field, tree
from editorial import LICENSE, P, Defs, circle, ellipse, line, path, poly, rect, sheen

SKIES = {
    "day": ("#8FCBEA", "#DDF1FB"),
    "golden": ("#E9B9C9", "#F7E3C6"),
    "dusk": ("#5B4E8A", "#E59A7A"),
    "night": ("#121A30", "#2B3660"),
}


def _sky(d: Defs, time: str) -> str:
    top, bottom = SKIES[time]
    out = rect(X0 - 400, -600, X1 - X0 + 800, 2700, d.v("sky", top, bottom))
    if time in ("golden", "dusk"):
        out += circle(1880, 520, 120, P["warm_light2"]) + circle(1880, 520, 320, d.glow("sun", P["warm_light"], 0.55, 0.0))
    return out


def _shield(x, y, s, color, motif):
    out = path(f"M{x-34*s},{y} H{x+34*s} V{y+36*s} Q{x+34*s},{y+70*s} {x},{y+86*s} Q{x-34*s},{y+70*s} {x-34*s},{y+36*s} Z", color)
    out += path(f"M{x-34*s},{y} H{x} V{y+86*s} Q{x-34*s},{y+70*s} {x-34*s},{y+36*s} Z", "#FFFFFF", 'fill-opacity="0.12"')
    if motif == 0:
        out += circle(x, y + 36 * s, 14 * s, P["gold_l"]) + circle(x + 6 * s, y + 32 * s, 12 * s, color)
    else:
        out += poly([(x, y + 14 * s), (x + 8 * s, y + 32 * s), (x + 26 * s, y + 34 * s), (x + 12 * s, y + 46 * s),
                     (x + 16 * s, y + 64 * s), (x, y + 54 * s), (x - 16 * s, y + 64 * s), (x - 12 * s, y + 46 * s),
                     (x - 26 * s, y + 34 * s), (x - 8 * s, y + 32 * s)], P["gold_l"])
    return out


def _pennant(x, y, h, color):
    return (line(f"M{x},{y} V{y+h}", P["wood_dd"], 8)
            + path(f"M{x+4},{y+6} Q{x+80},{y+20} {x+150},{y+44} Q{x+80},{y+62} {x+4},{y+86} Z", color)
            + path(f"M{x+4},{y+6} Q{x+80},{y+20} {x+150},{y+44} L{x+4},{y+44} Z", "#FFFFFF", 'fill-opacity="0.18"'))


def _tent(x, base, s, color):
    out = poly([(x - 90 * s, base), (x, base - 150 * s), (x + 90 * s, base)], P["cream"])
    out += "".join(poly([(x - 90 * s + i * 36 * s, base), (x, base - 150 * s), (x - 72 * s + i * 36 * s, base)], color) for i in range(0, 5, 2))
    return out + line(f"M{x},{base-150*s} V{base-190*s}", P["wood_dd"], 4 * s) + poly([(x, base - 190 * s), (x + 36 * s, base - 180 * s), (x, base - 170 * s)], color)


def _house(x, base, s, wall, roof):
    return (rect(x - 40 * s, base - 70 * s, 80 * s, 70 * s, wall)
            + poly([(x - 50 * s, base - 70 * s), (x, base - 112 * s), (x + 50 * s, base - 70 * s)], roof)
            + rect(x - 10 * s, base - 30 * s, 20 * s, 30 * s, P["wood_dd"]))


def castle_rampart(d: Defs, time: str, sides: tuple[str, str], seed: int):
    rng = random.Random(seed)
    a, b = sides
    sky = _sky(d, time) + cloud(980, 360, 1.3) + cloud(1640, 220, 0.9) + cloud(420, 520, 1.1)
    # far land: hills, a village with red roofs, two army camps in the story colours
    far = path(f"M{X0-200},1060 Q500,880 1180,980 Q1800,1060 2400,900 Q2800,860 {X1+200},960 V1700 H{X0-200} Z", d.v("hill1", "#B9D39A", "#8FBF84"))
    far += path(f"M{X0-200},1160 Q700,1040 1500,1120 Q2200,1180 {X1+200},1080 V1700 H{X0-200} Z", d.v("hill2", "#9CC48A", "#62A06C"))
    for i in range(16):
        x = 980 + i * 52 + rng.uniform(-14, 14)
        far += _house(x, 1000 + rng.uniform(-10, 18), rng.uniform(0.55, 0.8), P["cream"], rng.choice([P["red"], P["red_d"], P["orange_d"]]))
    far += _house(1260, 940, 1.1, P["cream2"], P["red_d"]) + rect(1240, 820, 40, 120, P["cream2"]) + poly([(1232, 820), (1260, 770), (1288, 820)], P["blue_d"])
    for i in range(5):
        far += _tent(420 + i * 120, 1120 + (i % 2) * 20, 0.7, a)
        far += _tent(2020 + i * 120, 1110 + (i % 2) * 20, 0.7, b)
    for x in (300, 700, 1960, 2300):
        far += tree(x, 1180, 0.8, P["green"], P["green_d"])
    # the castle behind the cast: two towers with conical roofs and banners
    towers = ""
    for x, color in ((560, a), (2000, b)):
        towers += rect(x - 130, 520, 260, 1100, d.h(f"tw{x}", "#EADFCF", "#C9BBA5"))
        towers += "".join(rect(x - 130 + i * 66, 470, 46, 60, "#E3D6C1") for i in range(4))
        towers += poly([(x - 160, 470), (x, 230), (x + 160, 470)], color) + poly([(x - 160, 470), (x, 230), (x, 470)], "#FFFFFF", 'fill-opacity="0.15"')
        towers += rect(x - 26, 700, 52, 110, P["slate_d"], rx=26) + rect(x - 26, 980, 52, 110, P["slate_d"], rx=26)
        towers += _pennant(x, 120, 120, color)
    # the walkway: back parapet with merlons, the stone floor where the cast stands, the front wall with shields
    back = rect(X0, 1380, X1 - X0, 240, d.v("parapet", "#F1E7D6", "#D9CBB4"))
    back += "".join(rect(x, 1320, 110, 70, "#EDE2CF", rx=4) for x in range(X0, X1, 180))
    back += "".join(rect(x, 1380, 3, 240, "#CDBEA6") for x in range(X0 + 60, X1, 120))
    back += "".join(rect(X0, y, X1 - X0, 3, "#CDBEA6") for y in (1460, 1540))
    walk = rect(X0, 1600, X1 - X0, 120, d.v("walk", "#E8DCC6", "#D2C2A6"))
    walk += rect(X0, 1712, X1 - X0, 18, "#BFAE92")
    wall = rect(X0, 1730, X1 - X0, 400, d.v("wall", "#E6D9C2", "#CDBDA2"))
    wall += "".join(rect(x + (60 if (i // 1) % 2 else 0), y, 3, 70, "#C4B396") for i, y in enumerate(range(1730, 2100, 70)) for x in range(X0, X1, 120))
    wall += "".join(rect(X0, y, X1 - X0, 3, "#C4B396") for y in range(1800, 2100, 70))
    for i, x in enumerate(range(X0 + 60, X1, 150)):
        wall += _shield(x, 1770, 0.9, a if i % 2 == 0 else b, i % 2)
    wall += "".join(path(f"M{x},1752 Q{x+40},1780 {x+75},1752", "none", f'stroke="{a if i % 2 else b}" stroke-width="10"') for i, x in enumerate(range(X0, X1, 75)))
    layers = [("sky", 8, sky), ("far", 4, far), ("towers", 1.2, towers), ("walk", 0, back + walk + wall)]
    info = {"mood": ["storybook", "medieval", "royal", time], "anchors": {"center": [CENTER, GROUND_Y]}}
    return layers, info, ["castle", "rampart", "medieval", "kingdom", "royal", "history"], "A castle rampart over a green kingdom, two army camps in the story colours."


def office_floor(d: Defs, time: str, sides: tuple[str, str], seed: int):
    rng = random.Random(seed)
    a, b = sides
    sky = _sky(d, time)
    city = skyline(d, rng, 1500, 14, 380, 900, 140, 260, [P["blue_d"], P["slate"], P["blue_dd"]], P["glass"],
                   lit=0.5 if time in ("dusk", "night") else 0.08, x_from=X0, x_to=X1)
    # glass wall: tall windows with mullions; a light floor; two accent planters in the story colours
    frames = ""
    for x in range(X0, X1, 420):
        frames += rect(x, -300, 26, 1900, P["slate_d"]) + sheen(f"M{x+60},-300 L{x+200},-300 L{x+90},1560 L{x+40},1560 Z", 0.08)
    frames += rect(X0, 1220, X1 - X0, 16, P["slate_d"]) + rect(X0, -300, X1 - X0, 140, P["slate_dd"])
    frames += "".join(rect(x, -170, 260, 20, P["warm_light2"], rx=10) for x in range(X0 + 80, X1, 520))
    floor = rect(X0, 1560, X1 - X0, 560, d.v("floor", "#E9E4DC", "#CFC7BA")) + ellipse(CENTER, 1640, 1100, 90, d.glow("sh", P["white"], 0.5, 0.0))
    floor += rect(X0, 1550, X1 - X0, 14, P["slate_d"])
    for x, c in ((470, a), (2090, b)):
        floor += rect(x - 70, 1440, 140, 180, c, rx=16) + circle(x, 1360, 110, P["green"]) + circle(x - 60, 1300, 70, P["green_d"]) + circle(x + 50, 1280, 80, P["green_l"])
    layers = [("sky", 8, sky), ("city", 3, city), ("glass", 0, frames + floor)]
    info = {"mood": ["corporate", "modern", "clean", time], "anchors": {"center": [CENTER, GROUND_Y]}}
    return layers, info, ["office", "corporate", "tower", "business", "modern", "work"], "A glass office floor high over the city."


def rooftop_night(d: Defs, time: str, sides: tuple[str, str], seed: int):
    rng = random.Random(seed)
    a, b = sides
    sky = _sky(d, "night") + stars_field(rng, 140, X0, -300, X1, 1100) + circle(700, 380, 90, "#F4F1EA") + circle(700, 380, 300, d.glow("moon", "#F4F1EA", 0.25, 0.0))
    city = skyline(d, rng, 1450, 16, 420, 1000, 140, 260, ["#1E2533", "#2B3445", "#28324F"], "#3B4770", lit=0.55, x_from=X0, x_to=X1)
    # roof: water tower, a ledge, string lights in the story colours
    roof = rect(1980, 900, 300, 380, d.h("tank", P["wood"], P["wood_dd"]), rx=20) + poly([(1960, 900), (2130, 780), (2300, 900)], P["wood_ddd"])
    roof += "".join(line(f"M{x},1280 L{x+30},1560", P["slate_d"], 14) for x in (2000, 2120, 2240))
    roof += rect(X0, 1380, X1 - X0, 200, d.v("ledge", "#3B4252", "#2A303C"))
    roof += "".join(rect(x, 1380, 4, 200, "#232833") for x in range(X0, X1, 160))
    for i, x in enumerate(range(X0, X1, 70)):
        y = 1080 + 60 * math.sin((x - X0) / 260)
        c = a if i % 2 == 0 else b
        roof += circle(x, y + 18, 10, c) + circle(x, y + 18, 34, d.glow(f"bulb{i % 2}", c, 0.5, 0.0))
    roof += path("M" + " L".join(f"{x},{1080 + 60 * math.sin((x - X0) / 260):.0f}" for x in range(X0, X1, 70)), "none", 'stroke="#1E2533" stroke-width="4"')
    floor = rect(X0, 1580, X1 - X0, 560, d.v("roof", "#3E4656", "#262B36")) + ellipse(CENTER, 1660, 900, 110, d.glow("pool", P["warm_light"], 0.22, 0.0))
    layers = [("sky", 8, sky), ("city", 3, city), ("roof", 0, roof + floor)]
    info = {"mood": ["night", "urban", "moody", "noir"], "anchors": {"center": [CENTER, GROUND_Y]}}
    return layers, info, ["rooftop", "night", "city", "urban", "street", "noir"], "A city rooftop at night, string lights in the story colours."


BUILDERS = {"castle_rampart": castle_rampart, "office_floor": office_floor, "rooftop_night": rooftop_night}


def build_place(spec: dict, style: str) -> tuple[str, dict]:
    pid = spec["id"]
    d = Defs(pid)
    sides = tuple(spec.get("sides") or (P["blue_d"], P["red"]))
    layers, info, tags, description = BUILDERS[spec["kind"]](d, spec.get("time", "day"), sides, spec.get("seed", 1))
    body = "".join(layer(lid, dep, c) for lid, dep, c in layers)
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
           f'<defs>{d.xml()}</defs><g id="{pid}">{body}</g></svg>\n')
    meta = {
        "schema": "erkasa.asset/1", "assetId": pid, "version": 1, "name": spec["kind"].replace("_", " "),
        "description": description, "category": "background", "subcategory": "world",
        "kind": "layered_background", "adapter": "svg", "style": f"world_{style}", "files": {"svg": "asset.svg"},
        "viewBox": [0, 0, W, H], "layers": [{"id": f"layer_{lid}", "depth": dep} for lid, dep, _ in layers],
        "groundY": GROUND_Y, "actorZones": [[300, 2260]], "anchors": info["anchors"], "safeFrames": SAFE,
        "capabilities": {"camera": ["pan", "zoom", "parallax", "shake"]}, "mood": info["mood"],
        "themes": ["psychology", "decisions"], "tags": tags, "license": LICENSE,
    }
    return svg, meta
