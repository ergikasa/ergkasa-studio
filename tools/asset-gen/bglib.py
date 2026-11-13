"""Ndihmës të përbashkët për sfondet e stilit `erkasa_editorial_v2` (të brendshme dhe të jashtme).

Rregullat janë ato të `backgrounds_v2.py`: 2560×1920, toka e personazheve në y = 1690, dyshemeja nga y = 1560,
kuadri 9:16 = x 740…1820. Përmbajtja kryesore mbahet brenda kuadrit 9:16; anët shërbejnë për pan.
"""
from __future__ import annotations

import math
import random

from backgrounds_v2 import FLOOR_Y, GROUND_Y, H, W, X0, X1, cloud, layer, light_pool, wall, window  # noqa: F401
from editorial import INK, LICENSE, P, STYLE, Defs, circle, ellipse, line, path, poly, rect, sheen, write_asset  # noqa: F401

CENTER = 1280
SAFE = {"9:16": [740, 0, 1080, 1920], "16:9": [0, 240, 2560, 1440], "1:1": [320, 0, 1920, 1920]}


# ---------------------------------------------------------------- dysheme
def floor_planks(d, light, dark, seam, y0=FLOOR_Y):
    out = rect(X0, y0, X1 - X0, 2100 - y0, d.v("floor", light, dark))
    out += "".join(rect(X0, y0 + i * 76, X1 - X0, 4, seam, extra='opacity="0.7"') for i in range(1, 6))
    out += "".join(rect(x, y0 + (i % 5) * 76, 4, 76, seam, extra='opacity="0.7"') for i, x in enumerate(range(X0 + 90, X1, 430)))
    return out


def floor_tiles(d, light, dark, seam, size=180, y0=FLOOR_Y, persp=True):
    """Pllaka në perspektivë: vijat vertikale konvergjojnë drejt qendrës."""
    out = rect(X0, y0, X1 - X0, 2100 - y0, d.v("floor", light, dark))
    for i in range(1, 6):
        y = y0 + (2100 - y0) * (i / 6) ** 1.4
        out += rect(X0, y, X1 - X0, 3, seam, extra='opacity="0.6"')
    for x in range(X0, X1 + 1, size):
        xb = CENTER + (x - CENTER) * 1.9 if persp else x
        out += line(f"M{x},{y0} L{xb:.0f},2100", seam, 3, 'opacity="0.6"')
    return out


def floor_plain(d, light, dark, y0=FLOOR_Y, sheen_strength=0.0):
    out = rect(X0, y0, X1 - X0, 2100 - y0, d.v("floor", light, dark))
    if sheen_strength:
        out += ellipse(CENTER, y0 + 160, 1100, 90, d.glow("floorsheen", P["white"], sheen_strength, 0.0))
    return out


def carpet(d, x0, x1, y0, light, dark, border=None):
    out = poly([(x0, y0), (x1, y0), (x1 + 140, 2000), (x0 - 140, 2000)], d.v("carpet", light, dark))
    if border:
        out += poly([(x0 + 30, y0 + 20), (x1 - 30, y0 + 20), (x1 + 90, 1980), (x0 - 90, 1980)], "none", f'stroke="{border}" stroke-width="10"')
    return out


# ---------------------------------------------------------------- muret dhe detajet
def baseboard(color, shade, y=FLOOR_Y):
    return rect(X0, y - 46, X1 - X0, 46, color) + rect(X0, y - 8, X1 - X0, 8, shade)


def wainscot(d, top, color_l, color_d, panel=None, y1=FLOOR_Y):
    out = rect(X0, top, X1 - X0, y1 - top, d.v("wain", color_l, color_d)) + rect(X0, top - 10, X1 - X0, 16, color_d)
    if panel:
        out += "".join(rect(x + 20, top + 40, 300, y1 - top - 100, "none", rx=6, extra=f'stroke="{panel}" stroke-width="6" opacity="0.7"') for x in range(X0, X1, 340))
    return out


def panels_wall(d, light, dark, seam, step=340, top=-300):
    out = rect(X0, top, X1 - X0, FLOOR_Y - top, d.v("panels", light, dark))
    out += "".join(rect(x, top, 6, FLOOR_Y - top, seam, extra='opacity="0.6"') for x in range(X0, X1, step))
    return out


def picture(d, x, y, w, h, kind=0, frame=P["wood_d"], key="pic"):
    inner = [P["gold_l"], P["sky"], P["cream2"], P["teal"], P["night3"]][kind % 5]
    art = [poly([(x + 18, y + h - 18), (x + w * 0.42, y + h * 0.42), (x + w * 0.62, y + h * 0.66), (x + w * 0.76, y + h * 0.52), (x + w - 18, y + h - 18)], P["teal"])
           + circle(x + w * 0.72, y + h * 0.3, w * 0.08, P["warm_light2"]),
           path(f"M{x+18},{y+h*0.7} Q{x+w*0.4},{y+h*0.5} {x+w-18},{y+h*0.66} V{y+h-18} H{x+18} Z", P["blue_d"]) + circle(x + w * 0.3, y + h * 0.34, w * 0.09, P["white"]),
           circle(x + w * 0.5, y + h * 0.5, min(w, h) * 0.24, P["red"]) + rect(x + w * 0.2, y + h * 0.72, w * 0.6, 8, P["sand3"], rx=4),
           rect(x + w * 0.2, y + h * 0.2, w * 0.3, h * 0.6, P["gold"]) + circle(x + w * 0.66, y + h * 0.5, min(w, h) * 0.18, P["cream"]),
           circle(x + w * 0.5, y + h * 0.45, min(w, h) * 0.2, P["gold_l"]) + path(f"M{x+18},{y+h*0.8} L{x+w*0.5},{y+h*0.6} L{x+w-18},{y+h*0.8} V{y+h-18} H{x+18} Z", P["night"])][kind % 5]
    return rect(x, y, w, h, frame, rx=6) + rect(x + 14, y + 14, w - 28, h - 28, inner) + art


def books_row(rng, x, base, width, hmin=90, hmax=150):
    cols = [P["red"], P["teal"], P["gold"], P["steel_dd"], P["violet"], P["blue"], P["orange"], P["green_d"], P["cream2"], P["red_d"], P["blue_dd"]]
    out, cx = "", x
    while cx < x + width - 30:
        bw, bh = rng.randint(24, 40), rng.randint(hmin, hmax)
        bw = min(bw, int(x + width - cx))
        if rng.random() < 0.08 and cx + 60 < x + width:          # libër i shtrirë
            out += rect(cx, base - 30, 70, 30, rng.choice(cols), rx=3)
            cx += 74
            continue
        out += rect(cx, base - bh, bw, bh, rng.choice(cols), rx=3) + rect(cx + 4, base - bh + 14, bw - 8, 5, P["cream"], extra='opacity="0.5"')
        cx += bw + 3
    return out


def bookcase(d, rng, x, top, w, bottom=FLOOR_Y, shelf_h=230, wood=(P["wood_d"], P["wood_ddd"]), key="bc"):
    out = rect(x, top, w, bottom - top, d.v(key, wood[0], wood[1])) + rect(x + 20, top + 20, w - 40, bottom - top - 40, P["wood_ddd"])
    y = top + 20 + shelf_h
    while y <= bottom - 20:
        out += books_row(rng, x + 26, y, w - 52) + rect(x + 20, y, w - 40, 16, wood[0])
        y += shelf_h
    return out


def pendant(d, x, y, cord_top=-300, shade=P["slate_d"], glow=True, key="pd"):
    out = line(f"M{x},{cord_top} V{y}", P["slate_dd"], 4) + path(f"M{x-70},{y+60} Q{x-60},{y} {x},{y} Q{x+60},{y} {x+70},{y+60} Z", shade)
    if glow:
        out += ellipse(x, y + 66, 64, 12, P["warm_light2"]) + ellipse(x, y + 160, 260, 220, d.glow(key, P["warm_light"], 0.35, 0.0))
    return out


def ceiling_strip(d, x, y, w, key="ceil"):
    return rect(x, y, w, 22, P["white"], rx=11) + ellipse(x + w / 2, y + 20, w * 0.75, 120, d.glow(key, P["white"], 0.5, 0.0))


def arch(x, y, w, h, fill, extra=""):
    return path(f"M{x},{y+h} V{y+w/2} A{w/2},{w/2} 0 0 1 {x+w},{y+w/2} V{y+h} Z", fill, extra)


def wall_lamp(d, x, y, key="wl"):
    return (rect(x - 8, y, 16, 40, P["brass_d"]) + path(f"M{x-40},{y+10} L{x+40},{y+10} L{x+28},{y-50} L{x-28},{y-50} Z", d.v(key + "s", P["warm_light2"], P["gold_l"]))
            + ellipse(x, y - 20, 220, 200, d.glow(key, P["warm_light"], 0.35, 0.0)))


def door(d, x, y_floor, w=300, h=620, fill=(P["wood"], P["wood_dd"]), frame=P["wood_ddd"], key="dr"):
    top = y_floor - h
    return (rect(x - 20, top - 20, w + 40, h + 20, frame) + rect(x, top, w, h, d.h(key, fill[0], fill[1]))
            + rect(x + 34, top + 40, w - 68, h * 0.38, fill[1], rx=6, extra='opacity="0.5"') + rect(x + 34, top + h * 0.5, w - 68, h * 0.42, fill[1], rx=6, extra='opacity="0.5"')
            + circle(x + w - 40, top + h * 0.52, 12, P["brass"]))


# ---------------------------------------------------------------- jashtë
def sky(d, top, bottom, key="sky", y0=-400, y1=2000):
    return rect(X0, y0, X1 - X0, y1 - y0, d.v(key, top, bottom))


def sun(d, x, y, r, color=P["warm_light2"], glow=P["warm_light"], key="sun"):
    return circle(x, y, r * 3.2, d.glow(key, glow, 0.6, 0.0)) + circle(x, y, r, color)


def hills(base, amp, color, seed, step=320):
    rng = random.Random(seed)
    pts, x = f"M{X0},{base}", X0
    while x < X1:
        nx = x + step
        pts += f" Q{x + step / 2},{base - rng.uniform(0.3, 1) * amp:.0f} {nx},{base - rng.uniform(0, 0.4) * amp:.0f}"
        x = nx
    return path(pts + f" V2100 H{X0} Z", color)


def tower(d, x, base, w, h, color, glass, rng, lit=0.0, key=None, roof=None):
    """Kullë qyteti me rrjet dritaresh; `lit` = sa dritare ndriçohen (natë)."""
    out = rect(x, base - h, w, h + 400, color)
    cols, rows = max(1, int(w // 46)), max(1, int(h // 58))
    gw, gh = w / cols, h / rows
    for c in range(cols):
        for r in range(rows):
            wc = P["warm_light"] if rng.random() < lit else glass
            out += rect(x + c * gw + gw * 0.2, base - h + r * gh + gh * 0.24, gw * 0.6, gh * 0.5, wc)
    if roof == "spire":
        out += poly([(x + w * 0.3, base - h), (x + w * 0.5, base - h - 140), (x + w * 0.7, base - h)], color) + line(f"M{x + w / 2},{base - h - 140} V{base - h - 220}", color, 6)
    elif roof == "step":
        out += rect(x + w * 0.15, base - h - 50, w * 0.7, 50, color) + rect(x + w * 0.3, base - h - 90, w * 0.4, 40, color)
    return out


def skyline(d, rng, base, n, hmin, hmax, wmin, wmax, colors, glass, lit=0.0, x_from=X0, x_to=X1, roofs=(None, None, "step", "spire")):
    out, x = "", x_from
    while x < x_to:
        w = rng.uniform(wmin, wmax)
        out += tower(d, x, base, w, rng.uniform(hmin, hmax), rng.choice(colors), glass, rng, lit, roof=rng.choice(roofs))
        x += w + rng.uniform(-10, 30)
    return out


def facade(d, x, base, w, h, wall_c, trim, win, rng, floors=3, shutters=None, roof=(None, None), door_c=None, balcony=False, key="fc"):
    """Fasadë e vjetër europiane: kate me dritare të harkuara, grila, ballkone, çati."""
    out = rect(x, base - h, w, h, wall_c) + rect(x, base - h, w, 18, trim)
    fh = (h - 60) / floors
    cols = max(2, int(w // 150))
    cw = w / cols
    for f in range(floors):
        y = base - h + 40 + f * fh
        for c in range(cols):
            wx = x + c * cw + cw * 0.28
            ww = cw * 0.44
            if f == floors - 1 and door_c and c == cols // 2:
                out += arch(wx - 10, base - fh * 0.85, ww + 20, fh * 0.85, door_c)
                continue
            out += arch(wx, y + fh * 0.15, ww, fh * 0.6, win) + rect(wx - 6, y + fh * 0.75, ww + 12, 10, trim)
            if shutters:
                out += rect(wx - ww * 0.42, y + fh * 0.15 + ww / 2, ww * 0.38, fh * 0.6 - ww / 2, shutters) + rect(wx + ww * 1.04, y + fh * 0.15 + ww / 2, ww * 0.38, fh * 0.6 - ww / 2, shutters)
            if balcony and f < floors - 1:
                out += rect(wx - 16, y + fh * 0.75, ww + 32, 8, P["slate_d"]) + "".join(line(f"M{wx - 12 + k * 14},{y + fh * 0.75} v-34", P["slate_d"], 3) for k in range(int((ww + 24) / 14)))
                out += rect(wx - 16, y + fh * 0.75 - 36, ww + 32, 6, P["slate_d"])
    if roof[0] == "gable":
        out += poly([(x - 20, base - h), (x + w / 2, base - h - roof[1]), (x + w + 20, base - h)], roof[2] if len(roof) > 2 else P["red_d"])
    elif roof[0] == "flat":
        out += rect(x - 10, base - h - 26, w + 20, 26, trim)
    return out


def cobbles(d, y0, light, dark, seam, rng):
    out = rect(X0, y0, X1 - X0, 2100 - y0, d.v("cob", light, dark))
    y, row = y0 + 10, 0
    while y < 2100:
        hh = 18 + (y - y0) * 0.05
        x = X0 + (row % 2) * 40
        while x < X1:
            ww = hh * rng.uniform(1.6, 2.4)
            out += rect(x, y, ww - 6, hh - 5, light if rng.random() < 0.5 else dark, rx=hh * 0.3, extra='opacity="0.55"')
            x += ww
        y += hh
        row += 1
    return out


def lamp_post(d, x, base, h=720, lit=False, key="lp"):
    out = (rect(x - 10, base - h, 20, h, d.h(key + "p", P["slate_l"], P["slate_dd"])) + rect(x - 30, base - 30, 60, 30, P["slate_dd"], rx=6)
           + path(f"M{x-46},{base-h} L{x+46},{base-h} L{x+30},{base-h-80} L{x-30},{base-h-80} Z", P["slate_d"])
           + rect(x - 34, base - h - 74, 68, 70, d.v(key + "g", P["warm_light2"], P["gold_l"]) if lit else P["glass"], rx=6))
    if lit:
        out += circle(x, base - h - 40, 220, d.glow(key, P["warm_light"], 0.55, 0.0))
    return out


def tree(x, base, s, c1, c2, trunk=P["wood_dd"]):
    return (path(f"M{x-22*s},{base} L{x-14*s},{base-330*s} L{x+14*s},{base-330*s} L{x+22*s},{base} Z", trunk)
            + circle(x, base - 470 * s, 190 * s, c2) + circle(x - 130 * s, base - 380 * s, 130 * s, c2) + circle(x + 130 * s, base - 390 * s, 140 * s, c2)
            + circle(x - 40 * s, base - 500 * s, 150 * s, c1) + circle(x + 80 * s, base - 440 * s, 110 * s, c1))


def cypress(x, base, h, color):
    return path(f"M{x},{base-h} Q{x+h*0.16},{base-h*0.5} {x+h*0.08},{base} H{x-h*0.08} Q{x-h*0.16},{base-h*0.5} {x},{base-h} Z", color)


def rain(rng, n, x0, y0, x1, y1, color=P["steel_l"], opacity=0.5):
    return "".join(line(f"M{rng.uniform(x0, x1):.0f},{rng.uniform(y0, y1):.0f} l-16,52", color, 3, f'opacity="{opacity}"') for _ in range(n))


def stars_field(rng, n, x0, y0, x1, y1):
    return "".join(circle(rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(1.2, 3.6), P["white"], f'opacity="{rng.uniform(0.3, 0.9):.2f}"') for _ in range(n))


# ---------------------------------------------------------------- perspektivë me një pikë zhdukjeje
def corridor(d, vp, back, wall_l, wall_r, ceiling, floor_c, key="cor"):
    """Korridor që largohet: `back` = (x0, y0, x1, y1) i murit të fundit. Kthen muret, tavanin dhe dyshemenë."""
    bx0, by0, bx1, by1 = back
    return (poly([(X0, -400), (bx0, by0), (bx0, by1), (X0, 2100)], d.h(key + "l", wall_l[0], wall_l[1]))
            + poly([(X1, -400), (bx1, by0), (bx1, by1), (X1, 2100)], d.h(key + "r", wall_r[1], wall_r[0]))
            + poly([(X0, -400), (X1, -400), (bx1, by0), (bx0, by0)], d.v(key + "c", ceiling[0], ceiling[1]))
            + poly([(X0, 2100), (X1, 2100), (bx1, by1), (bx0, by1)], d.v(key + "f", floor_c[1], floor_c[0])))


def persp_point(vp_x, vp_y, x, y, t):
    """Pika në vijën nga (x, y) drejt pikës së zhdukjes, në pjesën t (0 = afër, 1 = në pikë)."""
    return (x + (vp_x - x) * t, y + (vp_y - y) * t)


# ---------------------------------------------------------------- shkrimi
def write_scenes(scenes, subcategory):
    for asset_id, fn in scenes:
        d = Defs(asset_id)
        layers, info, name, tags, themes, description, story_use = fn(d)
        body = "".join(layer(lid, dep, c) for lid, dep, c in layers)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
               f'<defs>{d.xml()}</defs><g id="{asset_id}">{body}</g></svg>\n')
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1, "name": name, "description": description,
            "category": "background", "subcategory": subcategory, "collection": "backgrounds", "storyUse": story_use,
            "kind": "layered_background", "adapter": "svg", "style": STYLE, "files": {"svg": "asset.svg"},
            "viewBox": [0, 0, W, H],
            "layers": [{"id": f"layer_{lid}", "depth": dep} for lid, dep, _ in layers],
            "groundY": info.get("groundY", GROUND_Y), "actorZones": info.get("actorZone", [[300, 2260]]), "anchors": info.get("anchors", {}),
            "safeFrames": SAFE, "capabilities": {"camera": ["pan", "zoom", "parallax", "shake"]},
            "mood": info["mood"], "themes": themes, "tags": tags, "license": LICENSE,
        }
        write_asset("backgrounds", meta, {"asset.svg": svg})
    return len(scenes)
