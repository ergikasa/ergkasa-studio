"""Sfondet e reja në stilin `erkasa_editorial_v2` (plani i 300 aseteve).

Të njëjtat rregulla si te `backgrounds.py`: 2560×1920, shtresa <g id="layer_*" data-depth="d">, shtresat larg
vizatohen më gjerë se kuadri. Ndryshimet e stilit të ri:
- muri dhe dyshemeja kanë gradient (drita bie nga lart-majtas) dhe një pellg drite në dysheme;
- muri i brendshëm ka thellësi 0, si te zyra e intervistës, që objektet e skenës (props) të qëndrojnë
  saktë pranë tij; mobiljet ku ulen ose që prekin personazhet janë props, jo pjesë e sfondit;
- dyshemeja mbetet e lirë: `anchors` tregon ku vendosen mobiljet kryesore.

Përdorimi: python3 tools/asset-gen/backgrounds_v2.py
"""
from __future__ import annotations

import random

from editorial import LICENSE, P, STYLE, Defs, circle, ellipse, line, path, poly, rect, sheen, write_asset

W, H = 2560, 1920
FLOOR_Y, GROUND_Y = 1560, 1690
X0, X1 = -400, W + 400          # shtrirja e shtresave, më e gjerë se kuadri


def layer(lid, depth, content):
    return f'<g id="layer_{lid}" data-depth="{depth}">{content}</g>'


def wall(fill, holes=()):
    """Muri zbret pas dyshemesë, që zoom-i të mos hapë boshllëk. `holes` = dritare (x, y, w, h)."""
    dd = f"M{X0},-300 H{X1} V2100 H{X0} Z" + "".join(f" M{x},{y} V{y+h} H{x+w} V{y} Z" for x, y, w, h in holes)
    return f'<path d="{dd}" fill="{fill}" fill-rule="evenodd"/>'


def baseboard(color, shade):
    return rect(X0, FLOOR_Y - 46, X1 - X0, 46, color) + rect(X0, FLOOR_Y - 8, X1 - X0, 8, shade)


def wood_floor(d: Defs, light, dark, seam):
    out = rect(X0, FLOOR_Y, X1 - X0, 500, d.v("floor", light, dark))
    out += "".join(rect(X0, FLOOR_Y + i * 76, X1 - X0, 4, seam, extra='opacity="0.7"') for i in range(1, 5))
    out += "".join(rect(x, FLOOR_Y + (i % 5) * 76, 4, 76, seam, extra='opacity="0.7"') for i, x in enumerate(range(X0 + 90, X1, 430)))
    return out


def light_pool(d: Defs, cx, cy, rx, ry, color=P["warm_light2"], strength=0.5, name="pool"):
    return ellipse(cx, cy, rx, ry, d.glow(name, color, strength, 0.0))


def window(d: Defs, x, y, w, h, frame=P["white"], shade=P["cream3"], t=24, bars=(1, 1), glare=0.14):
    out = (rect(x - t, y - t, w + 2 * t, t, frame) + rect(x - t, y, t, h, frame) + rect(x + w, y, t, h, shade)
           + rect(x - t - 16, y + h, w + 2 * t + 32, t + 12, frame, rx=6) + rect(x - t - 6, y + h + t + 10, w + 2 * t + 12, 12, shade, rx=5))
    for i in range(1, bars[0] + 1):
        out += rect(x + w * i / (bars[0] + 1) - 8, y, 16, h, frame)
    for i in range(1, bars[1] + 1):
        out += rect(x, y + h * i / (bars[1] + 1) - 7, w, 14, frame)
    out += sheen(f"M{x+w*0.08},{y} L{x+w*0.3},{y} L{x+w*0.12},{y+h} L{x},{y+h} L{x},{y+h*0.4} Z", glare)
    return out


def cloud(cx, cy, s, fill=P["white"]):
    return (circle(cx, cy, 60 * s, fill) + circle(cx + 70 * s, cy - 25 * s, 75 * s, fill) + circle(cx + 150 * s, cy, 55 * s, fill)
            + rect(cx - 10 * s, cy, 170 * s, 55 * s, fill, rx=int(27 * s)))


def picture(d: Defs, x, y, w, h, kind=0, frame=P["wood_d"]):
    inner = [P["gold_l"], P["sky"], P["cream2"]][kind % 3]
    art = [poly([(x + 18, y + h - 18), (x + w * 0.42, y + h * 0.42), (x + w * 0.62, y + h * 0.66), (x + w * 0.76, y + h * 0.52), (x + w - 18, y + h - 18)], P["teal"])
           + circle(x + w * 0.72, y + h * 0.3, w * 0.08, P["warm_light2"]),
           path(f"M{x+18},{y+h*0.7} Q{x+w*0.4},{y+h*0.5} {x+w-18},{y+h*0.66} V{y+h-18} H{x+18} Z", P["blue_d"]) + circle(x + w * 0.3, y + h * 0.34, w * 0.09, P["white"]),
           circle(x + w * 0.5, y + h * 0.5, min(w, h) * 0.24, P["red"]) + rect(x + w * 0.2, y + h * 0.72, w * 0.6, 8, P["sand3"], rx=4)][kind % 3]
    return rect(x, y, w, h, frame, rx=6) + rect(x + 14, y + 14, w - 28, h - 28, inner) + art


def books(rng, x, base, n, hmin=90, hmax=150):
    cols = [P["red"], P["teal"], P["gold"], P["steel_dd"], P["violet"], P["blue"], P["orange"], P["green_d"], P["cream2"]]
    out, cx = "", x
    for _ in range(n):
        bw, bh = rng.randint(30, 46), rng.randint(hmin, hmax)
        out += rect(cx, base - bh, bw, bh, rng.choice(cols), rx=4) + rect(cx + 6, base - bh + 16, bw - 12, 6, P["cream"], extra='opacity="0.55"')
        cx += bw + 4
    return out


def plant(x, base, s=1.0, pot=P["orange_d"]):
    leaves = ""
    for i, (dx, dy, rot) in enumerate([(-40, -170, -30), (30, -190, 25), (0, -230, 0), (-70, -120, -55), (60, -130, 50)]):
        leaves += (f'<ellipse cx="{x+dx*s:.0f}" cy="{base+dy*s:.0f}" rx="{26*s:.0f}" ry="{70*s:.0f}" '
                   f'fill="{P["green_d"] if i % 2 else P["green"]}" transform="rotate({rot} {x+dx*s:.0f} {base+dy*s:.0f})"/>')
    return leaves + poly([(x - 60 * s, base - 110 * s), (x + 60 * s, base - 110 * s), (x + 45 * s, base), (x - 45 * s, base)], pot)


# ================================================================ shtëpia
def bg_home_kitchen(d: Defs):
    hx, hy, hw, hh = 1010, 330, 540, 500
    counter = 1150
    view = (rect(X0, -400, X1 - X0, 2000, d.v("sky", P["sky"], P["sky_l"])) + cloud(1120, 520, 0.7) + cloud(1400, 430, 0.5)
            + path(f"M{X0},800 Q1100,700 1400,760 T{X1},720 V1300 H{X0} Z", P["green_l"]))
    tiles = ("".join(rect(X0, y, X1 - X0, 4, P["cream3"]) for y in range(730, counter, 84))
             + "".join(rect(x, 730 + (i % 5) * 84, 4, 84, P["cream3"]) for i, x in enumerate(range(X0, X1, 168))))

    def upper(x, w):
        n = max(1, round(w / 330))
        dw = w / n
        return (rect(x, 250, w, 440, d.v("up", P["cream"], P["cream2"]), rx=10) + rect(x, 678, w, 18, P["sand2"], rx=6)
                + "".join(rect(x + i * dw + 14, 266, dw - 28, 396, d.v("upd", P["white"], P["cream2"]), rx=8)
                          + rect(x + i * dw + dw - 44, 560, 12, 70, P["steel_d"], rx=6) for i in range(n)))

    def lower(x, w):
        n = max(1, round(w / 300))
        dw = w / n
        return "".join(rect(x + i * dw + 12, counter + 62, dw - 24, FLOOR_Y - counter - 110, d.v("lwd", P["teal"], P["teal_d"]), rx=8)
                       + rect(x + i * dw + dw / 2 - 40, counter + 86, 80, 12, P["steel_l"], rx=6) for i in range(n))

    oven_x = 420
    wallc = (wall(d.v("wall", P["cream"], P["sand"]), [(hx, hy, hw, hh)])
             + rect(X0, 716, X1 - X0, counter - 716, P["cream2"]) + tiles
             + window(d, hx, hy, hw, hh)
             + upper(250, 660) + upper(1650, 660)
             # sirtarët e poshtëm dhe banaku
             + rect(X0, counter + 40, X1 - X0, FLOOR_Y - counter - 40, d.v("lw", P["teal"], P["teal_d"]))
             + lower(X0 + 20, oven_x - X0 - 20) + lower(oven_x + 400, X1 - oven_x - 400)
             # furra
             + rect(oven_x, counter + 40, 400, FLOOR_Y - counter - 86, d.v("ov", P["steel_l"], P["steel_d"]), rx=8)
             + rect(oven_x + 30, counter + 130, 340, 220, d.d("ovg", P["slate"], P["slate_dd"]), rx=12)
             + sheen(f"M{oven_x+50},{counter+130} L{oven_x+130},{counter+130} L{oven_x+80},{counter+350} L{oven_x+30},{counter+350} L{oven_x+30},{counter+200} Z", 0.14)
             + rect(oven_x + 40, counter + 98, 320, 14, P["steel_dd"], rx=7)
             + "".join(circle(oven_x + 70 + i * 86, counter + 68, 13, P["slate"]) for i in range(4))
             + rect(X0, FLOOR_Y - 46, X1 - X0, 46, P["slate_d"])
             + rect(X0, counter, X1 - X0, 44, d.v("ct", P["white"], P["cream3"])) + rect(X0, counter + 36, X1 - X0, 8, P["sand3"])
             # pllaka e gatimit dhe tenxherja
             + rect(oven_x + 20, counter - 10, 360, 12, P["slate_dd"], rx=5)
             + rect(oven_x + 70, counter - 100, 180, 92, d.h("pot", P["red_l"], P["red_d"], P["red"]), rx=12) + rect(oven_x + 58, counter - 112, 204, 18, P["red_d"], rx=9)
             + rect(oven_x + 140, counter - 128, 40, 18, P["slate_d"], rx=8)
             # lavamani poshtë dritares
             + rect(hx + 120, counter - 6, 300, 10, P["steel_d"], rx=5)
             + line(f"M{hx+270},{counter} V{counter-110} Q{hx+270},{counter-150} {hx+320},{counter-150} H{hx+340} V{counter-124}", P["steel_d"], 16)
             # sende mbi banak
             + rect(1640, counter - 150, 70, 150, d.h("jar", P["glass"], P["steel"]), rx=12) + rect(1636, counter - 166, 78, 22, P["wood"], rx=8)
             + rect(1740, counter - 110, 60, 110, d.h("jar2", P["gold_l"], P["gold_d"]), rx=12) + rect(1736, counter - 124, 68, 20, P["wood"], rx=8)
             + plant(2140, counter, 0.72, P["cream3"])
             + rect(1100, hy + hh + 36, 14, 0, P["white"])
             # varëse me vegla
             + rect(1680, 800, 520, 12, P["steel_d"], rx=6)
             + "".join(line(f"M{x},812 V{900 + (i % 2) * 40}", P["steel_dd"], 8) + ellipse(x, 940 + (i % 2) * 40, 26, 38, P["steel"]) for i, x in enumerate((1740, 1840, 1940, 2040, 2140))))
    floor = (rect(X0, FLOOR_Y, X1 - X0, 500, d.v("floor", P["cream"], P["sand2"]))
             + "".join(rect(X0, FLOOR_Y + i * 90, X1 - X0, 4, P["sand3"], extra='opacity="0.6"') for i in range(1, 5))
             + "".join(rect(x, FLOOR_Y, 4, 500, P["sand3"], extra='opacity="0.6"') for x in range(X0 + 40, X1, 220))
             + light_pool(d, 1280, 1720, 620, 110))
    return ([("window_view", 4, view), ("wall", 0, wallc), ("floor", 0, floor)],
            {"groundY": GROUND_Y, "actorZone": [[250, 2350]], "mood": ["home", "warm", "day", "routine"],
             "anchors": {"counter": [1280, counter], "table": [1280, GROUND_Y], "fridge": [2330, FLOOR_Y + 30], "window": [1280, 580]}},
            "Kuzhinë", ["home", "kitchen", "day", "indoor", "family", "food", "morning", "habit"], ["psychology", "growth", "decisions"],
            "A warm home kitchen: teal lower cabinets, white counter, window over the sink, tiled wall. The floor is free for a table and chairs.",
            "Family life, eating habits, morning routines, conversations at the kitchen table.")


def bg_home_bedroom_day(d: Defs):
    rng = random.Random(21)
    hx, hy, hw, hh = 1520, 330, 640, 720
    view = (rect(X0, -400, X1 - X0, 2000, d.v("sky", P["sky"], P["warm_light2"])) + circle(1960, 520, 90, P["warm_light"])
            + cloud(1600, 560, 0.8) + path(f"M{X0},900 Q1500,780 1900,860 T{X1},820 V1400 H{X0} Z", P["green_l"])
            + path(f"M{X0},980 Q1600,880 2000,950 T{X1},920 V1400 H{X0} Z", P["green"]))

    def curtain(x, flip):
        s = -1 if flip else 1
        return path(f"M{x},{hy-70} Q{x+s*60},{hy+380} {x-s*30},{hy+hh+90} H{x+s*110} Q{x+s*150},{hy+380} {x+s*120},{hy-70} Z", d.h("cur" + ("r" if flip else "l"), P["gold_l"], P["gold"]))

    wallc = (wall(d.v("wall", P["sky_l"], P["glass"]), [(hx, hy, hw, hh)])
             + window(d, hx, hy, hw, hh)
             + curtain(hx - 130, False) + curtain(hx + hw + 130, True)
             + rect(hx - 190, hy - 96, hw + 380, 24, P["wood_d"], rx=10)
             # dollapi në të majtë
             + rect(120, 300, 560, FLOOR_Y - 300, d.v("wd", P["cream"], P["cream3"]), rx=12)
             + rect(140, 320, 250, FLOOR_Y - 360, d.v("wdd", P["white"], P["cream2"]), rx=8) + rect(410, 320, 250, FLOOR_Y - 360, d.v("wdd", P["white"], P["cream2"]), rx=8)
             + rect(362, 860, 14, 150, P["wood_d"], rx=7) + rect(424, 860, 14, 150, P["wood_d"], rx=7)
             # raft dhe piktura mbi krevat
             + picture(d, 860, 520, 240, 300, 0) + picture(d, 1140, 580, 200, 240, 2)
             + rect(820, 1010, 560, 22, P["wood_d"], rx=8) + books(rng, 850, 1010, 5, 80, 130) + plant(1290, 1010, 0.5, P["cream3"])
             + baseboard(P["white"], P["cream3"]))
    floor = (wood_floor(d, P["wood_l"], P["wood"], P["wood_d"])
             + poly([(1380, FLOOR_Y), (2180, FLOOR_Y), (1900, 1920), (860, 1920)], d.v("sun", P["warm_light2"], P["warm_light"]), 'opacity="0.34"')
             + ellipse(1180, 1740, 700, 110, d.v("rug", P["cream"], P["cream3"]))
             + f'<ellipse cx="1180" cy="1740" rx="600" ry="80" fill="none" stroke="{P["blue_l"]}" stroke-width="12"/>')
    return ([("window_view", 4, view), ("wall", 0, wallc), ("floor", 0, floor)],
            {"groundY": GROUND_Y, "actorZone": [[700, 2300]], "mood": ["home", "morning", "day", "calm", "fresh"],
             "anchors": {"bed": [1080, GROUND_Y], "window": [1840, 690], "wardrobe": [400, FLOOR_Y], "nightstand": [1660, GROUND_Y]}},
            "Dhomë gjumi (ditë)", ["home", "bedroom", "day", "morning", "indoor", "wake-up"], ["psychology", "growth", "decisions"],
            "A bright bedroom in the morning: pale blue wall, sunny window with yellow curtains, wardrobe, shelf. The floor is free for the bed prop.",
            "Waking up, snoozing, morning procrastination, a fresh start. Pairs with the night bedroom for before/after.")


def bg_home_living_night(d: Defs):
    rng = random.Random(22)
    hx, hy, hw, hh = 1540, 360, 640, 700
    view = (rect(X0, -400, X1 - X0, 2000, d.v("sky", P["night"], P["night3"]))
            + circle(2010, 560, 70, P["warm_light2"]) + circle(2040, 540, 62, P["night2"])
            + "".join(circle(rng.uniform(1300, 2500), rng.uniform(300, 800), rng.uniform(1.5, 4), P["white"], f'opacity="{rng.uniform(0.4, 0.9):.2f}"') for _ in range(40)))
    for x, bw, bh in ((1380, 200, 300), (1600, 160, 420), (1790, 230, 260), (2040, 180, 380), (2240, 220, 300)):
        view += rect(x, 1100 - bh, bw, bh + 300, P["night2"])
        view += "".join(rect(x + 24 + c * 50, 1100 - bh + 30 + r * 64, 24, 32, P["warm_light"], extra='opacity="0.9"')
                        for c in range(int(bw // 50)) for r in range(int(bh // 64)) if rng.random() < 0.3)
    lamp_x = 640
    wallc = (wall(d.v("wall", P["night3"], P["night2"]), [(hx, hy, hw, hh)])
             + circle(lamp_x, 860, 520, d.glow("lamp", P["warm_light"], 0.5, 0.0, 0.16))
             + window(d, hx, hy, hw, hh, frame=P["steel_d"], shade=P["steel_dd"], glare=0.06)
             + path(f"M{hx-90},{hy-60} Q{hx-40},{hy+400} {hx-110},{hy+hh+60} H{hx-20} Q{hx+20},{hy+400} {hx-10},{hy-60} Z", d.h("cl", P["red_d"], P["slate_d"]))
             + path(f"M{hx+hw+90},{hy-60} Q{hx+hw+40},{hy+400} {hx+hw+110},{hy+hh+60} H{hx+hw+20} Q{hx+hw-20},{hy+400} {hx+hw+10},{hy-60} Z", d.h("cr", P["red_d"], P["slate_d"]))
             + rect(hx - 140, hy - 80, hw + 280, 22, P["wood_ddd"], rx=8)
             + rect(940, 470, 300, 240, P["wood_ddd"], rx=6) + rect(954, 484, 272, 212, P["night"])
             + path("M954,640 Q1060,590 1226,630 V696 H954 Z", P["blue_dd"]) + circle(1040, 550, 26, P["blue_l"])
             # llamba e dyshemesë (burimi i dritës)
             + rect(lamp_x - 8, 900, 16, FLOOR_Y - 900, P["slate_dd"]) + rect(lamp_x - 80, FLOOR_Y - 16, 160, 16, P["slate_dd"], rx=6)
             + poly([(lamp_x - 110, 900), (lamp_x + 110, 900), (lamp_x + 70, 740), (lamp_x - 70, 740)], d.v("shade", P["warm_light2"], P["gold"]))
             + rect(X0, FLOOR_Y - 46, X1 - X0, 46, P["slate_dd"]))
    floor = (wood_floor(d, P["wood_dd"], P["wood_ddd"], P["slate_dd"])
             + light_pool(d, lamp_x, 1700, 620, 130, P["warm_light"], 0.42, "lpool")
             + poly([(1560, FLOOR_Y), (2180, FLOOR_Y), (2300, 1920), (1480, 1920)], d.v("moon", P["blue_l"], P["blue"]), 'opacity="0.16"'))
    return ([("window_view", 5, view), ("wall", 0, wallc), ("floor", 0, floor)],
            {"groundY": GROUND_Y, "actorZone": [[500, 2300]], "mood": ["home", "night", "lonely", "quiet", "late"],
             "anchors": {"sofa": [1220, GROUND_Y], "tv": [2200, GROUND_Y], "lamp": [lamp_x, 820], "window": [1860, 710]}},
            "Dhomë ndenjeje (natë)", ["home", "living-room", "night", "indoor", "lonely", "late"], ["psychology", "growth", "philosophy"],
            "A living room at night: dark blue wall, one warm floor lamp, city lights and a moon in the window. The floor is free for the sofa and TV props.",
            "Loneliness, binge-watching, late-night thoughts and doomscrolling. Pairs with the day living room.")


def bg_home_office(d: Defs):
    rng = random.Random(23)
    hx, hy, hw, hh = 420, 340, 560, 640
    view = (rect(X0, -400, X1 - X0, 2000, d.v("sky", P["sky"], P["sky_l"])) + cloud(520, 520, 0.7) + cloud(820, 640, 0.5)
            + path(f"M{X0},860 Q500,780 800,840 T{X1},800 V1400 H{X0} Z", P["green_l"]))
    shelves = ""
    for i, y in enumerate((520, 760, 1000)):
        shelves += rect(1240, y, 760, 24, d.v("sh", P["wood_l"], P["wood_d"]), rx=8) + rect(1260, y + 24, 20, 30, P["wood_dd"]) + rect(1960, y + 24, 20, 30, P["wood_dd"])
        shelves += books(rng, 1270 + (i % 2) * 300, y, 5 + i)
    shelves += plant(1900, 520, 0.5, P["cream3"]) + rect(1290, 660, 130, 100, d.d("box", P["sand"], P["sand3"]), rx=8) + rect(1800, 920, 110, 80, d.d("box2", P["teal"], P["teal_d"]), rx=8)
    cork_x, cork_y = 2100, 520
    cork = (rect(cork_x, cork_y, 380, 300, P["wood_d"], rx=8) + rect(cork_x + 16, cork_y + 16, 348, 268, d.v("cork", P["wood_l"], P["wood"]))
            + "".join(rect(cork_x + 40 + (i % 3) * 104, cork_y + 40 + (i // 3) * 118, 84, 84, c, extra=f'transform="rotate({r} {cork_x + 82 + (i % 3) * 104} {cork_y + 82 + (i // 3) * 118})"')
                      + circle(cork_x + 82 + (i % 3) * 104, cork_y + 48 + (i // 3) * 118, 7, P["red"])
                      for i, (c, r) in enumerate(((P["gold_l"], -4), (P["white"], 3), (P["sky"], -2), (P["white"], 5), (P["red_l"], -3), (P["gold_l"], 2)))))
    wallc = (wall(d.v("wall", P["cream"], P["sand"]), [(hx, hy, hw, hh)]) + window(d, hx, hy, hw, hh)
             + "".join(rect(hx + 14, hy + 14 + i * 36, hw - 28, 14, P["cream"], extra='opacity="0.9"') for i in range(5))
             + shelves + cork + baseboard(P["white"], P["cream3"]))
    floor = (wood_floor(d, P["wood_l"], P["wood"], P["wood_d"])
             + poly([(380, FLOOR_Y), (1020, FLOOR_Y), (1500, 1920), (520, 1920)], d.v("sun", P["warm_light2"], P["warm_light"]), 'opacity="0.3"')
             + rect(900, 1640, 1000, 190, d.v("rug", P["blue_l"], P["blue"]), rx=30) + rect(940, 1664, 920, 142, P["blue_d"], rx=20, extra='opacity="0.25"'))
    return ([("window_view", 4, view), ("wall", 0, wallc), ("floor", 0, floor)],
            {"groundY": GROUND_Y, "actorZone": [[300, 2400]], "mood": ["home", "work", "focus", "day"],
             "anchors": {"desk": [1500, GROUND_Y], "chair": [1150, GROUND_Y], "window": [700, 660], "shelves": [1620, 760]}},
            "Kënd pune në shtëpi", ["home", "home-office", "work", "remote", "desk", "indoor", "day", "study"], ["growth", "psychology", "decisions"],
            "A home-office corner: warm wall with book shelves and a cork board, window with blinds on the left, blue rug. The floor is free for a desk and chair.",
            "Remote work, the blurred line between work and life, studying, procrastinating at the desk.")


# ================================================================ puna dhe qyteti
def bg_meeting_room(d: Defs):
    rng = random.Random(24)
    hx, hy, hw, hh = 1820, 300, 1100, 820
    view = rect(X0, -400, X1 - X0, 2200, d.v("sky", P["sky"], P["sky_l"])) + cloud(2000, 430, 0.8)
    for x, bw, bh in ((1760, 240, 520), (2020, 200, 700), (2240, 260, 440), (2520, 220, 620), (2760, 240, 500)):
        view += rect(x, 1200 - bh, bw, bh + 300, d.v(f"b{x}", P["steel"], P["steel_d"]))
        view += "".join(rect(x + 24 + c * 54, 1200 - bh + 36 + r * 70, 28, 40, P["glass"]) for c in range(int(bw // 54)) for r in range(int(bh // 70)) if rng.random() < 0.8)
    sx, sy, sw, sh = 760, 380, 880, 520
    wallc = (wall(d.v("wall", P["steel_l"], P["glass"]), [(hx, hy, hw, hh)])
             + window(d, hx, hy, hw, hh, frame=P["slate"], shade=P["slate_d"], t=20, bars=(3, 0))
             # paneli akustik dhe ekrani
             + rect(X0, 250, 1000 - X0 + 760, 950, P["steel_l"])
             + "".join(rect(x, 250, 6, 950, P["steel"], extra='opacity="0.6"') for x in range(X0 + 60, 1740, 180))
             + rect(sx - 20, sy - 20, sw + 40, sh + 40, d.d("bz", P["slate"], P["slate_dd"]), rx=14)
             + rect(sx, sy, sw, sh, d.d("sc", P["white"], P["cream2"]), rx=4)
             + sheen(f"M{sx+40},{sy} L{sx+220},{sy} L{sx+90},{sy+sh} L{sx},{sy+sh} L{sx},{sy+220} Z", 0.5)
             + rect(sx + sw / 2 - 30, sy + sh + 20, 60, 14, P["slate_dd"])
             # ora dhe drita e tavanit
             + circle(360, 520, 70, P["white"]) + f'<circle cx="360" cy="520" r="70" fill="none" stroke="{P["slate_d"]}" stroke-width="12"/>'
             + rect(355, 470, 10, 54, P["slate_dd"], rx=5) + rect(356, 516, 44, 9, P["slate_dd"], rx=4)
             + rect(500, 120, 1500, 30, P["white"], rx=15) + ellipse(1250, 150, 900, 150, d.glow("ceil", P["white"], 0.5, 0.0))
             + rect(X0, 1200, X1 - X0, FLOOR_Y - 1200, d.v("dado", P["slate_l"], P["slate"])) + rect(X0, 1192, X1 - X0, 12, P["steel_d"])
             + rect(X0, FLOOR_Y - 30, X1 - X0, 30, P["slate_dd"]))
    floor = (rect(X0, FLOOR_Y, X1 - X0, 500, d.v("floor", P["blue"], P["blue_dd"]))
             + "".join(rect(x, FLOOR_Y, 4, 500, P["blue_dd"], extra='opacity="0.4"') for x in range(X0 + 100, X1, 320))
             + "".join(rect(X0, FLOOR_Y + i * 120, X1 - X0, 4, P["blue_dd"], extra='opacity="0.4"') for i in range(1, 4))
             + light_pool(d, 1280, 1720, 900, 130, P["sky_l"], 0.3))
    return ([("window_view", 3, view), ("wall", 0, wallc), ("floor", 0, floor)],
            {"groundY": GROUND_Y, "actorZone": [[250, 2350]], "mood": ["work", "formal", "pressure", "corporate"],
             "anchors": {"screen": [sx + sw / 2, sy + sh / 2], "table": [1280, GROUND_Y], "presenter": [620, GROUND_Y], "window": [2300, 700]}},
            "Sallë mbledhjesh", ["office", "meeting", "work", "presentation", "indoor", "corporate", "team"], ["psychology", "decisions", "money"],
            "A corporate meeting room: cool grey panels, a large presentation screen, a city window on the right, blue carpet. The floor is free for a table.",
            "Groupthink, authority, presenting under pressure, a decision made by a team. Content can be placed on the screen anchor.")


def bg_supermarket(d: Defs):
    rng = random.Random(25)
    cols = [P["red"], P["orange"], P["gold"], P["green"], P["teal"], P["blue"], P["violet"], P["blue_d"], P["red_l"], P["green_l"], P["gold_l"], P["blue_l"]]
    shelves = ""
    unit_w = 640
    for ux in range(X0, X1, unit_w + 26):
        shelves += rect(ux, 330, unit_w, FLOOR_Y - 330, d.v("unit", P["cream2"], P["sand2"]), rx=6)
        for row, y in enumerate((560, 790, 1020, 1250, 1480)):
            x = ux + 16
            kind = rng.randint(0, 2)
            base = rng.choice(cols)
            while x < ux + unit_w - 60:
                c = base if rng.random() < 0.72 else rng.choice(cols)
                if kind == 0:      # kuti
                    bw, bh = rng.randint(52, 70), rng.randint(120, 170)
                    shelves += rect(x, y - bh, bw, bh, c, rx=5) + rect(x + 8, y - bh + 18, bw - 16, bh * 0.3, P["cream"], rx=3, extra='opacity="0.75"')
                elif kind == 1:    # shishe
                    bw, bh = 42, rng.randint(140, 176)
                    shelves += rect(x, y - bh + 40, bw, bh - 40, c, rx=10) + rect(x + 12, y - bh, 18, 46, c, rx=5) + rect(x + 10, y - bh - 6, 22, 12, P["slate_d"], rx=4)
                else:              # kanaçe
                    bw, bh = 50, rng.randint(84, 104)
                    shelves += rect(x, y - bh, bw, bh, c, rx=9) + rect(x, y - bh + 22, bw, 22, P["cream"], extra='opacity="0.7"')
                    shelves += rect(x, y - 2 * bh - 4, bw, bh, c, rx=9) + rect(x, y - 2 * bh + 18, bw, 22, P["cream"], extra='opacity="0.7"')
                x += bw + 8
            shelves += rect(ux, y, unit_w, 26, d.v("shelf", P["white"], P["cream3"])) + rect(ux, y + 26, unit_w, 10, P["sand3"], extra='opacity="0.6"')
            shelves += "".join(rect(ux + 30 + i * 150, y + 4, 70, 18, P["gold_l"] if (i + row) % 3 else P["red"], rx=3) for i in range(4))
    signs = ""
    for i, x in enumerate((420, 1280, 2140)):
        signs += (line(f"M{x-150},0 V150 M{x+150},0 V150", P["steel_d"], 6)
                  + rect(x - 240, 150, 480, 130, [P["teal"], P["red"], P["blue_d"]][i], rx=16)
                  + rect(x - 190, 186, 220, 22, P["cream"], rx=11) + rect(x - 190, 224, 330, 16, P["cream"], rx=8, extra='opacity="0.7"')
                  + circle(x + 170, 215, 34, P["gold_l"]))
    wallc = (rect(X0, -300, X1 - X0, 2400, d.v("wall", P["steel_l"], P["cream"]))
             + "".join(rect(x, 40, 520, 26, P["white"], rx=13) + ellipse(x + 260, 70, 420, 110, d.glow("tube", P["white"], 0.55, 0.0)) for x in range(X0 + 120, X1, 760))
             + shelves + signs + rect(X0, FLOOR_Y - 26, X1 - X0, 26, P["slate"]))
    floor = (rect(X0, FLOOR_Y, X1 - X0, 500, d.v("floor", P["cream"], P["cream3"]))
             + "".join(rect(x, FLOOR_Y, 4, 500, P["sand2"], extra='opacity="0.7"') for x in range(X0 + 60, X1, 260))
             + "".join(rect(X0, FLOOR_Y + i * 110, X1 - X0, 4, P["sand2"], extra='opacity="0.7"') for i in range(1, 4))
             + "".join(ellipse(x + 260, 1700, 380, 60, d.glow("refl", P["white"], 0.6, 0.0)) for x in range(X0 + 120, X1, 760)))
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"groundY": GROUND_Y, "actorZone": [[200, 2400]], "mood": ["shopping", "bright", "busy", "choice"],
             "anchors": {"shelf": [1280, 1020], "cart": [1500, GROUND_Y], "sign": [1280, 215]}},
            "Korridor supermarketi", ["supermarket", "store", "shopping", "shelves", "consumer", "choice", "indoor", "money"], ["money", "psychology", "decisions"],
            "A supermarket aisle seen from the front: full shelves of colourful products with price tags, hanging aisle signs, bright shiny floor.",
            "Consumer behaviour, the paradox of choice, impulse buying, anchoring and product placement.")


def bg_park(d: Defs):
    rng = random.Random(26)
    sky = (rect(X0, -400, X1 - X0, 2400, d.v("sky", P["sky"], P["sky_l"])) + circle(2050, 330, 110, P["warm_light2"])
           + cloud(500, 380, 1.1) + cloud(1400, 260, 0.8) + cloud(2300, 520, 0.9))
    city = "".join(rect(x, 1180 - bh, bw, bh + 200, P["glass"]) for x, bw, bh in
                   ((X0 + 100, 220, 300), (60, 180, 420), (300, 240, 280), (640, 160, 480), (900, 220, 340), (1500, 200, 400), (1780, 260, 300), (2200, 180, 460), (2460, 240, 320)))

    def tree(x, base, s, tone=0):
        c1, c2 = [(P["green"], P["green_d"]), (P["green_d"], P["green_dd"]), (P["green_l"], P["green"])][tone % 3]
        return (path(f"M{x-22*s},{base} L{x-14*s},{base-330*s} L{x+14*s},{base-330*s} L{x+22*s},{base} Z", P["wood_dd"])
                + circle(x, base - 470 * s, 190 * s, c2) + circle(x - 130 * s, base - 380 * s, 130 * s, c2) + circle(x + 130 * s, base - 390 * s, 140 * s, c2)
                + circle(x - 40 * s, base - 500 * s, 150 * s, c1) + circle(x + 80 * s, base - 440 * s, 110 * s, c1))

    far_trees = (path(f"M{X0},1260 Q400,1150 900,1230 T1900,1200 T{X1},1230 V1700 H{X0} Z", P["green_l"])
                 + "".join(tree(x, 1300, 0.62, i) for i, x in enumerate(range(X0 + 150, X1, 420))))
    mid = (path(f"M{X0},1420 Q700,1340 1300,1400 T{X1},1380 V1700 H{X0} Z", d.v("lawn2", P["green"], P["green_d"]))
           + tree(330, 1500, 1.25, 1) + tree(2330, 1500, 1.2, 0)
           # llamba e parkut
           + rect(1846, 880, 18, 690, d.h("post", P["slate_l"], P["slate_dd"])) + rect(1826, 1540, 58, 30, P["slate_dd"], rx=6)
           + path("M1800,880 Q1855,800 1910,880 Z", P["slate_dd"]) + rect(1815, 880, 80, 60, d.v("lmp", P["warm_light2"], P["gold_l"]), rx=10)
           # shkurre
           + "".join(circle(x, 1540, r, c) for x, r, c in ((760, 80, P["green_d"]), (860, 100, P["green"]), (970, 76, P["green_d"]), (1420, 70, P["green"]), (1510, 92, P["green_d"])))
           + "".join(circle(x, y, 9, c) for x, y, c in ((800, 1500, P["red_l"]), (880, 1470, P["gold_l"]), (950, 1510, P["red_l"]), (1470, 1490, P["gold_l"]), (1530, 1520, P["white"]))))
    ground = (rect(X0, FLOOR_Y - 20, X1 - X0, 520, d.v("lawn", P["green_l"], P["green"]))
              + path(f"M{X0},1610 Q1280,1570 {X1},1610 V1800 Q1280,1760 {X0},1800 Z", d.v("path", P["sand"], P["sand2"]))
              + path(f"M{X0},1796 Q1280,1756 {X1},1796 V1812 Q1280,1772 {X0},1812 Z", P["sand3"], 'opacity="0.6"')
              + "".join(ellipse(rng.uniform(X0, X1), rng.uniform(1640, 1760), rng.uniform(8, 18), 4, P["sand3"], 'opacity="0.55"') for _ in range(40))
              + "".join(line(f"M{x},{y} l-8,-26 M{x},{y} l4,-30 M{x},{y} l14,-22", P["green_d"], 5) for x, y in
                        ((rng.uniform(X0, X1), rng.uniform(1840, 1900)) for _ in range(26)))
              + light_pool(d, 1500, 1690, 700, 90, P["warm_light2"], 0.35))
    fg = (circle(-80, 80, 330, P["green_dd"]) + circle(240, -60, 260, P["green_d"]) + circle(2700, 40, 340, P["green_dd"]) + circle(2420, -90, 240, P["green_d"]))
    return ([("sky", 8, sky), ("city", 4, city), ("far_trees", 1.6, far_trees), ("mid", 0.25, mid), ("ground", 0, ground), ("foreground", -0.4, fg)],
            {"groundY": GROUND_Y, "actorZone": [[150, 2400]], "mood": ["outdoor", "calm", "day", "reflective", "nature"],
             "anchors": {"bench": [1180, GROUND_Y], "lamp": [1855, 910], "path": [1280, GROUND_Y]}},
            "Park", ["park", "outdoor", "nature", "trees", "walk", "city", "day", "bench"], ["psychology", "growth", "philosophy"],
            "A city park on a sunny day: lawn, a sandy path, trees, a lamp post and a pale skyline far away. The path is free for a bench and walking characters.",
            "Reflection, a walk to clear the head, meeting someone, being alone among people.")


# ================================================================ abstrakte
def bg_abstract_dark(d: Defs):
    rng = random.Random(27)
    back = (rect(X0, -400, X1 - X0, 2600, d.v("bg", P["night"], P["night2"]))
            + ellipse(1280, 900, 1100, 900, d.glow("halo", P["night3"], 0.95, 0.0, 0.5))
            + "".join(circle(rng.uniform(X0, X1), rng.uniform(100, 1400), rng.uniform(2, 6), P["blue_l"], f'opacity="{rng.uniform(0.15, 0.5):.2f}"') for _ in range(46)))
    beam = (poly([(1060, -300), (1500, -300), (2000, GROUND_Y + 40), (560, GROUND_Y + 40)], d.v("beam", P["blue_l"], P["night3"]), 'opacity="0.14"')
            + path(f"M300,1100 Q1280,900 2260,1100", "none", f'stroke="{P["night3"]}" stroke-width="6" opacity="0.6"'))
    floor = (rect(X0, FLOOR_Y - 40, X1 - X0, 560, d.v("floor", P["night2"], P["night"]))
             + rect(X0, FLOOR_Y - 40, X1 - X0, 5, P["night3"])
             + ellipse(1280, GROUND_Y + 20, 760, 150, d.glow("spot", P["blue_l"], 0.42, 0.0, 0.18))
             + ellipse(1280, GROUND_Y + 20, 420, 76, d.glow("core", P["sky_l"], 0.3, 0.0)))
    return ([("backdrop", 3, back), ("beam", 0.5, beam), ("floor", 0, floor)],
            {"groundY": GROUND_Y, "actorZone": [[500, 2060]], "mood": ["dark", "abstract", "tense", "inner", "dramatic"],
             "anchors": {"spot": [1280, GROUND_Y], "above": [1280, 700]}},
            "Hapësirë abstrakte e errët", ["abstract", "dark", "void", "spotlight", "mind", "inner", "fear", "night"], ["psychology", "philosophy", "decisions"],
            "A dark abstract space: deep navy backdrop with faint particles and one pool of cool light on the floor.",
            "The stage for metaphors of fear, isolation and inner conflict: the character alone inside their own mind.")


def bg_abstract_light(d: Defs):
    back = (rect(X0, -400, X1 - X0, 2600, d.v("bg", P["cream"], P["sand"]))
            + circle(1280, 800, 500, d.d("disc", P["gold_l"], P["orange"]))
            + circle(1730, 360, 150, d.d("disc2", P["sky_l"], P["blue_l"]))
            + rect(250, 240, 26, 900, P["white"], extra='opacity="0.7" transform="rotate(18 263 690)"')
            + rect(360, 240, 10, 900, P["white"], extra='opacity="0.7" transform="rotate(18 365 690)"')
            + circle(2260, 1040, 210, d.d("disc3", P["sky_l"], P["blue_l"])))
    shapes = (f'<circle cx="1280" cy="800" r="580" fill="none" stroke="{P["white"]}" stroke-width="6" opacity="0.7"/>'
              + "".join(circle(800 + i * 54, 250, 9, P["sand3"]) for i in range(6)) + "".join(circle(800 + i * 54, 304, 9, P["sand3"]) for i in range(6)))
    floor = (path(f"M{X0},{FLOOR_Y-60} Q1280,{FLOOR_Y-150} {X1},{FLOOR_Y-60} V2100 H{X0} Z", d.v("floor", P["cream2"], P["sand2"]))
             + path(f"M{X0},{FLOOR_Y-60} Q1280,{FLOOR_Y-150} {X1},{FLOOR_Y-60} V{FLOOR_Y-48} Q1280,{FLOOR_Y-138} {X0},{FLOOR_Y-48} Z", P["white"], 'opacity="0.7"')
             + ellipse(1280, GROUND_Y + 14, 700, 70, d.glow("sh", P["wood_ddd"], 0.2, 0.0)))
    return ([("backdrop", 2.5, back), ("shapes", 1.2, shapes), ("floor", 0, floor)],
            {"groundY": GROUND_Y, "actorZone": [[400, 2160]], "mood": ["light", "abstract", "clean", "neutral", "editorial"],
             "anchors": {"center": [1280, GROUND_Y], "above": [1280, 700]}},
            "Studio abstrakte e çelët", ["abstract", "light", "studio", "neutral", "concept", "editorial", "clean"], ["psychology", "growth", "decisions", "money", "philosophy", "science"],
            "A bright editorial studio: cream backdrop with a large warm disc, a soft blue disc and a curved floor.",
            "A neutral stage for metaphors, concepts and the host explaining an idea, without a real-world location.")


SCENES = [
    ("bg_home_kitchen_01", bg_home_kitchen), ("bg_home_bedroom_day_01", bg_home_bedroom_day),
    ("bg_home_living_night_01", bg_home_living_night), ("bg_home_office_01", bg_home_office),
    ("bg_meeting_room_01", bg_meeting_room), ("bg_supermarket_01", bg_supermarket), ("bg_park_01", bg_park),
    ("bg_abstract_dark_01", bg_abstract_dark), ("bg_abstract_light_01", bg_abstract_light),
]


def main() -> None:
    for asset_id, fn in SCENES:
        d = Defs(asset_id)
        layers, info, name, tags, themes, description, story_use = fn(d)
        body = "".join(layer(lid, dep, c) for lid, dep, c in layers)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
               f'<defs>{d.xml()}</defs><g id="{asset_id}">{body}</g></svg>\n')
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1, "name": name, "description": description,
            "category": "background", "collection": "backgrounds", "storyUse": story_use,
            "kind": "layered_background", "adapter": "svg", "style": STYLE, "files": {"svg": "asset.svg"},
            "viewBox": [0, 0, W, H],
            "layers": [{"id": f"layer_{lid}", "depth": dep} for lid, dep, _ in layers],
            "groundY": info["groundY"], "actorZones": info["actorZone"], "anchors": info["anchors"],
            "safeFrames": {"9:16": [740, 0, 1080, 1920], "16:9": [0, 240, 2560, 1440], "1:1": [320, 0, 1920, 1920]},
            "capabilities": {"camera": ["pan", "zoom", "parallax", "shake"]},
            "mood": info["mood"], "themes": themes, "tags": tags, "license": LICENSE,
        }
        write_asset("backgrounds", meta, {"asset.svg": svg})
    print(f"{len(SCENES)} sfonde ({STYLE})")


if __name__ == "__main__":
    main()
