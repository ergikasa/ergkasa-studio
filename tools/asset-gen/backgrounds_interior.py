"""Sfondet e brendshme (lista e prodhimit, kategoria 07 + dhoma e parlamentit nga kategoria 06).

Pa personazhe; mobiljet që prekin personazhet janë props më vete. Dyshemeja mbetet e lirë.

Përdorimi: python3 tools/asset-gen/backgrounds_interior.py
"""
from __future__ import annotations

import math
import random

from editorial import star
from bglib import (CENTER, FLOOR_Y, GROUND_Y, INK, P, X0, X1, arch, baseboard, bookcase, books_row, carpet, ceiling_strip,
                   circle, cloud, corridor, door, ellipse, floor_plain, floor_planks, floor_tiles, light_pool, line, panels_wall, path,
                   pendant, picture, poly, rect, sheen, skyline, sky, wainscot, wall, wall_lamp, window, write_scenes)

WORK = ["money", "decisions", "psychology"]


def city_view(d, rng, lit, sky_top, sky_bot, key="v"):
    return (sky(d, sky_top, sky_bot, key + "sky")
            + skyline(d, rng, 1250, 0, 380, 760, 120, 220, [P["slate_l"], P["slate"], P["blue_d"]] if lit else [P["steel"], P["steel_d"], P["blue_l"]],
                      P["night3"] if lit else P["glass"], lit=lit))


# ================================================================ zyra
def bg_office_night(d):
    rng = random.Random(31)
    hx, hy, hw, hh = 300, 260, 1960, 960
    view = city_view(d, rng, 0.35, P["night"], P["night3"]) + circle(1900, 420, 60, P["warm_light2"])
    wallc = (wall(d.v("wall", P["night2"], P["night"]), [(hx, hy, hw, hh)])
             + "".join(rect(x, hy, 26, hh, P["slate_dd"]) for x in range(hx, hx + hw + 1, 392))
             + rect(hx - 20, hy - 26, hw + 40, 26, P["slate_dd"]) + rect(hx - 20, hy + hh, hw + 40, 30, P["slate_dd"])
             # ndarëse zyrash larg, me një monitor të ndezur
             + "".join(rect(x, 1260, 520, 300, d.v("cub", P["slate"], P["slate_dd"]), rx=8) for x in (180, 1020, 1860))
             + rect(1180, 1150, 200, 120, P["slate_dd"], rx=6) + rect(1194, 1162, 172, 96, d.v("mon", P["sky"], P["blue"]))
             + ellipse(1280, 1210, 360, 260, d.glow("mong", P["sky"], 0.32, 0.0))
             + rect(X0, FLOOR_Y - 30, X1 - X0, 30, P["slate_dd"]))
    floor = floor_plain(d, P["night2"], P["night"]) + light_pool(d, 1280, 1700, 700, 110, P["sky"], 0.18, "pool")
    return ([("window_view", 4, view), ("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["night", "work", "lonely", "pressure", "overtime"], "anchors": {"window": [1280, 740], "monitor": [1280, 1210], "desk": [1280, GROUND_Y]}},
            "Zyrë e errët (natën)", ["office", "night", "dark", "overtime", "work", "city", "indoor", "burnout"], WORK,
            "An open office at night: lights off, a wall of windows with a lit city skyline and the moon, partitions and one glowing monitor.",
            "Working late: burnout, ambition, loneliness at work, the last one in the office, pressure and deadlines.")


def bg_luxury_office(d):
    rng = random.Random(32)
    hx, hy, hw, hh = 1180, 220, 1200, 1100
    view = city_view(d, rng, 0.08, P["orange"], P["warm_light2"], "lv") + circle(1700, 640, 90, P["warm_light2"])
    wallc = (wall(d.v("wall", P["wood_d"], P["wood_ddd"]), [(hx, hy, hw, hh)])
             + "".join(rect(x, -300, 8, FLOOR_Y + 300, P["wood_ddd"], extra='opacity="0.6"') for x in range(X0, hx, 260))
             + "".join(rect(hx + k * 300, hy, 18, hh, P["slate_dd"]) for k in range(5)) + rect(hx - 10, hy + hh, hw + 20, 24, P["slate_dd"])
             + bookcase(d, rng, 120, 420, 560, FLOOR_Y, 230, (P["wood"], P["wood_ddd"]), "bc")
             + picture(d, 760, 520, 300, 380, 3, P["gold_d"])
             + wall_lamp(d, 910, 470, "wl")
             + rect(X0, FLOOR_Y - 40, X1 - X0, 40, P["wood_ddd"]))
    floor = (floor_tiles(d, P["marble_l"], P["marble_d"], P["marble_dd"], 260)
             + poly([(hx, FLOOR_Y), (hx + hw, FLOOR_Y), (hx + hw + 300, 2000), (hx - 200, 2000)], d.v("sunf", P["warm_light"], P["gold_l"]), 'opacity="0.3"')
             + ellipse(1250, 1760, 640, 120, d.v("rug", P["red_d"], P["wood_ddd"]), 'opacity="0.85"'))
    return ([("window_view", 4, view), ("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["luxury", "power", "success", "sunset", "wealth"], "anchors": {"window": [1780, 770], "desk": [1250, GROUND_Y], "shelves": [400, 900]}},
            "Zyrë luksoze", ["office", "luxury", "ceo", "executive", "wealth", "power", "success", "indoor", "penthouse"], ["money", "decisions", "psychology"],
            "A luxury executive office: dark wood panelling, a bookcase, framed art, a wall lamp, marble floor and a huge window over the city at sunset.",
            "Success and power: the CEO's office, wealth, the top of the ladder, ambition, a deal made behind closed doors.")


def bg_negotiation_room(d):
    rng = random.Random(33)
    wallc = (panels_wall(d, P["wood"], P["wood_dd"], P["wood_ddd"], 320)
             + wainscot(d, 1180, P["wood_d"], P["wood_ddd"], P["wood_dd"])
             + picture(d, 500, 520, 360, 260, 4, P["gold_d"]) + picture(d, 1700, 520, 360, 260, 1, P["gold_d"])
             + wall_lamp(d, 1280, 560, "wl1") + wall_lamp(d, 300, 620, "wl2") + wall_lamp(d, 2260, 620, "wl3")
             + pendant(d, 980, 160, key="p1") + pendant(d, 1580, 160, key="p2")
             + rect(X0, FLOOR_Y - 30, X1 - X0, 30, P["wood_ddd"]))
    floor = floor_plain(d, P["red_d"], P["wood_ddd"]) + ellipse(1280, 1730, 900, 140, d.glow("pool", P["warm_light"], 0.25, 0.0))
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["tense", "private", "serious", "warm", "negotiation"], "anchors": {"table": [1280, GROUND_Y], "chair_left": [880, GROUND_Y], "chair_right": [1680, GROUND_Y]}},
            "Dhomë negociatash", ["negotiation", "meeting", "private", "deal", "conflict", "business", "indoor", "diplomacy"], ["money", "decisions", "psychology"],
            "A private, warm negotiation room: dark wood panelling, framed art, wall lamps, two pendant lights over the empty floor where a table goes.",
            "Negotiations and tense talks: deals, diplomacy, persuasion, two sides across a table.")


# ================================================================ dije
def bg_library(d):
    rng = random.Random(34)
    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", P["wood_d"], P["wood_ddd"]))
             + "".join(bookcase(d, rng, x, 120, 560, FLOOR_Y, 240, (P["wood"], P["wood_ddd"]), f"bc{i}") for i, x in enumerate((-380, 220, 1440, 2040)))
             + arch(840, 260, 600, 1300, d.v("arch", P["warm_light2"], P["gold_l"])) + "".join(rect(840 + k * 150, 560, 10, 1000, P["wood_d"]) for k in range(1, 4))
             + rect(840, 860, 600, 10, P["wood_d"]) + rect(820, FLOOR_Y - 30, 640, 30, P["wood_ddd"])
             + line("M520,180 L420,1560", P["wood_ddd"], 14) + line("M600,180 L500,1560", P["wood_ddd"], 14) + "".join(line(f"M{520 - k * 7},{180 + k * 100} H{600 - k * 7}", P["wood_ddd"], 10) for k in range(14))
             + pendant(d, 1140, 120, key="p1"))
    floor = floor_planks(d, P["wood_d"], P["wood_ddd"], P["wood_ddd"]) + carpet(d, 900, 1660, FLOOR_Y, P["red"], P["red_d"], P["gold"])
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["quiet", "study", "warm", "knowledge", "calm"], "anchors": {"window": [1140, 900], "reading_spot": [1280, GROUND_Y]}},
            "Bibliotekë", ["library", "books", "study", "knowledge", "reading", "learning", "quiet", "indoor"], ["growth", "philosophy", "science"],
            "A warm wooden library with tall bookcases full of books, a library ladder, a tall arched window and a red carpet.",
            "Learning and knowledge: studying, reading habits, research, quiet focus, wisdom found in books.")


def bg_ancient_library(d):
    rng = random.Random(35)
    stone_l, stone = P["sand"], P["sand3"]
    niches = ""
    for x in range(X0 + 60, X1, 330):
        for y in range(240, 1300, 210):
            niches += rect(x, y, 260, 170, P["wood_ddd"], rx=8)
            for k in range(rng.randint(6, 9)):
                cx, cy = x + 30 + (k % 5) * 48, y + 60 + (k // 5) * 60
                niches += circle(cx, cy, 22, P["parch"]) + circle(cx, cy, 12, P["parch_d"])
    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", stone_l, stone)) + niches
             + "".join(arch(x, -100, 340, 1660, "none", f'stroke="{stone}" stroke-width="40"') for x in range(X0 + 10, X1, 660))
             + "".join(rect(x - 10, 900, 20, 120, P["wood_ddd"]) + path(f"M{x},{880} Q{x+26},{840} {x},{790} Q{x-26},{840} {x},{880} Z", P["orange"])
                       + circle(x, 840, 200, d.glow(f"t{x}", P["warm_light"], 0.45, 0.0)) for x in (560, 2000))
             + rect(X0, FLOOR_Y - 40, X1 - X0, 40, stone))
    floor = floor_tiles(d, P["sand2"], P["sand3"], P["parch_d"], 300) + light_pool(d, 1280, 1720, 800, 110, P["warm_light"], 0.25)
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["ancient", "mystery", "knowledge", "warm", "torchlight"], "anchors": {"center": [1280, GROUND_Y]}},
            "Bibliotekë e lashtë", ["ancient", "library", "scrolls", "alexandria", "knowledge", "history", "philosophy", "indoor"], ["philosophy", "science", "growth"],
            "An ancient stone library: walls of wooden niches filled with scroll ends, stone arches and two burning torches.",
            "Ancient knowledge: the library of Alexandria, philosophers studying, lost wisdom, the history of ideas.")


def bg_lecture_hall(d):
    wallc = (panels_wall(d, P["wood_l"], P["wood"], P["wood_d"], 300)
             + rect(560, 260, 1440, 760, P["slate_dd"], rx=10) + rect(590, 290, 680, 700, d.v("b1", P["green_dd"], P["night"])) + rect(1290, 290, 680, 700, d.v("b2", P["green_dd"], P["night"]))
             + line("M640,420 Q760,380 880,440 T1120,420 M660,520 H1000 M1340,420 L1500,600 L1660,460 L1880,520", P["white"], 6, 'opacity="0.55"')
             + circle(1720, 760, 90, "none", f'stroke="{P["white"]}" stroke-width="6" opacity="0.55"')
             + rect(540, 1020, 1480, 30, P["wood_d"])
             + "".join(rect(x, 110, 420, 120, d.v(f"hw{x}", P["sky_l"], P["glass"]), rx=10) for x in (120, 2020))
             # radhët e ulëseve që ngjiten anash
             + "".join(poly([(X0, 1100 + k * 90), (420 - k * 60, 1180 + k * 70), (420 - k * 60, 1240 + k * 70), (X0, 1160 + k * 90)], P["wood_d"] if k % 2 else P["wood_dd"]) for k in range(5))
             + "".join(poly([(X1, 1100 + k * 90), (2140 + k * 60, 1180 + k * 70), (2140 + k * 60, 1240 + k * 70), (X1, 1160 + k * 90)], P["wood_d"] if k % 2 else P["wood_dd"]) for k in range(5))
             + rect(X0, FLOOR_Y - 30, X1 - X0, 30, P["wood_ddd"]))
    floor = floor_planks(d, P["wood_l"], P["wood"], P["wood_d"]) + light_pool(d, 1280, 1720, 700, 100)
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["academic", "learning", "formal", "bright"], "anchors": {"board": [1280, 640], "lectern": [1900, GROUND_Y], "stage": [1280, GROUND_Y]}},
            "Auditor universiteti", ["university", "lecture-hall", "professor", "education", "academic", "learning", "science", "indoor"], ["growth", "science", "philosophy"],
            "A university lecture hall seen from the stage: a large double chalkboard with diagrams, wood panelling, high windows and rising rows of benches at the sides.",
            "Learning and expertise: a professor explaining, university life, research, the authority of experts.")


# ================================================================ institucione
def bg_courtroom(d):
    wallc = (panels_wall(d, P["wood"], P["wood_dd"], P["wood_ddd"], 280)
             + circle(1280, 420, 150, d.d("seal", P["gold_l"], P["gold_d"])) + circle(1280, 420, 120, P["wood_dd"])
             + path("M1210,380 L1350,380 M1280,320 V480 M1220,380 L1200,440 L1240,440 Z M1340,380 L1320,440 L1360,440 Z", "none", f'stroke="{P["gold"]}" stroke-width="10"')
             + "".join(rect(x, 260, 120, 900, d.h(f"pil{x}", P["wood_l"], P["wood_dd"])) for x in (760, 1680))
             # tribuna e gjyqtarit
             + rect(840, 980, 880, 70, d.v("benchtop", P["wood_l"], P["wood_d"]), rx=8) + rect(860, 1050, 840, 510, d.v("bench", P["wood_d"], P["wood_ddd"]))
             + "".join(rect(x, 1090, 240, 400, P["wood_dd"], rx=8, extra='opacity="0.7"') for x in (900, 1160, 1420))
             + rect(1180, 800, 200, 200, d.v("chair", P["red_d"], INK), rx=30)
             # vendi i dëshmitarit
             + rect(1820, 1220, 420, 50, P["wood_d"], rx=6) + rect(1840, 1270, 380, 290, d.v("wit", P["wood_d"], P["wood_ddd"]))
             + rect(260, 1260, 420, 300, d.v("rail", P["wood_d"], P["wood_ddd"])) + "".join(rect(280 + k * 50, 1200, 16, 70, P["wood_d"]) for k in range(8)) + rect(260, 1190, 420, 20, P["wood_l"])
             + rect(X0, FLOOR_Y - 30, X1 - X0, 30, P["wood_ddd"]))
    floor = floor_planks(d, P["wood_d"], P["wood_ddd"], P["wood_ddd"]) + carpet(d, 1080, 1480, FLOOR_Y, P["red_d"], INK)
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["formal", "serious", "judgement", "tense", "law"], "anchors": {"judge": [1280, 900], "witness": [2030, 1220], "dock": [470, 1260], "center": [1280, GROUND_Y]}},
            "Sallë gjyqi", ["courtroom", "court", "judge", "law", "justice", "trial", "verdict", "history", "indoor"], ["decisions", "philosophy", "psychology"],
            "A classic wooden courtroom: the judge's raised bench and red chair in the centre under a gold seal with scales, a witness stand and a railing.",
            "Judgement and justice: trials, verdicts, guilt and innocence, moral judgement, history's famous cases.")


def bg_bank_interior(d):
    from props_power import column
    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", P["marble_l"], P["marble"]))
             + "".join(column(d, x, 120, FLOOR_Y, 110, f"c{x}") for x in (170, 900, 1660, 2390))
             # dera e kasafortës
             + circle(1280, 820, 330, d.d("vault", P["steel_l"], P["steel_dd"])) + circle(1280, 820, 270, d.d("vd", P["steel"], P["slate_l"]))
             + circle(1280, 820, 90, P["steel_dd"]) + "".join(line(f"M{1280 + 90 * math.cos(a):.0f},{820 + 90 * math.sin(a):.0f} L{1280 + 200 * math.cos(a):.0f},{820 + 200 * math.sin(a):.0f}", P["steel_dd"], 16) for a in [k * math.pi / 3 for k in range(6)])
             + "".join(circle(1280 + 300 * math.cos(a), 820 + 300 * math.sin(a), 16, P["steel_dd"]) for a in [k * math.pi / 6 for k in range(12)])
             # sportelet
             + rect(X0, 1180, 1100 - X0, 380, d.v("ct1", P["wood_d"], P["wood_ddd"])) + rect(1460, 1180, X1 - 1460, 380, d.v("ct2", P["wood_d"], P["wood_ddd"]))
             + rect(X0, 1160, 1100 - X0, 24, P["marble_d"]) + rect(1460, 1160, X1 - 1460, 24, P["marble_d"])
             + "".join(rect(x, 900, 240, 260, P["glass"], extra='opacity="0.45"') + rect(x, 900, 240, 12, P["gold_d"]) for x in (60, 360, 1560, 1860, 2160))
             + "".join(line(f"M{x},-300 V40", P["gold_d"], 4) + circle(x, 80, 60, d.glow(f"ch{x}", P["warm_light"], 0.7, 0.0)) + circle(x, 70, 26, P["gold_l"]) for x in (640, 1920)))
    floor = floor_tiles(d, P["marble_l"], P["marble_d"], P["marble_dd"], 280) + "".join(poly([(1280 + k * 140, FLOOR_Y), (1280 + k * 140 + 70, FLOOR_Y), (1280 + (k * 140 + 70) * 1.9, 2100), (1280 + k * 140 * 1.9, 2100)], P["red_d"], 'opacity="0.15"') for k in range(-3, 3))
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["formal", "wealth", "trust", "cold", "institution"], "anchors": {"vault": [1280, 820], "counter_left": [600, 1180], "counter_right": [2000, 1180]}},
            "Brendësi e bankës", ["bank", "interior", "vault", "money", "finance", "savings", "loans", "institution", "indoor"], ["money", "decisions", "psychology"],
            "A grand marble bank hall with columns, teller counters behind glass, chandeliers and a huge round steel vault door in the centre.",
            "Money and trust: savings and loans, the bank vault, financial crises, the power of banks.")


def bg_factory_interior(d):
    rng = random.Random(36)
    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", P["steel_d"], P["slate"]))
             + "".join(rect(x, 80, 300, 520, P["slate_dd"]) + "".join(rect(x + 10 + c * 72, 90 + r * 84, 64, 76, d.v(f"fw{(c + r) % 2}", P["sky_l"], P["glass"])) for c in range(4) for r in range(6)) for x in range(X0 + 100, X1, 420))
             + "".join(rect(x, -300, 40, FLOOR_Y + 300, d.h(f"beam{x}", P["slate_l"], P["slate_dd"])) for x in range(X0 + 40, X1, 420))
             + rect(X0, 640, X1 - X0, 40, P["slate_dd"]) + "".join(line(f"M{x},680 L{x + 210},640 M{x + 210},640 L{x + 420},680", P["slate_dd"], 10) for x in range(X0, X1, 420))
             # makineri në sfond
             + rect(200, 1060, 800, 500, d.v("mach", P["gold"], P["gold_d"]), rx=12) + rect(240, 1100, 300, 200, P["slate_dd"], rx=8) + circle(800, 1240, 110, P["slate_dd"]) + circle(800, 1240, 60, P["steel"])
             + rect(1500, 1300, 1000, 60, P["slate_dd"], rx=30) + "".join(rect(1520 + k * 200, 1220, 120, 80, d.v(f"box{k}", P["wood_l"], P["wood_d"])) for k in range(5))
             + "".join(line(f"M{x},-300 V{220}", P["slate_dd"], 4) + path(f"M{x-60},{260} L{x+60},{260} L{x+36},{216} L{x-36},{216} Z", P["slate_dd"]) + ellipse(x, 300, 200, 180, d.glow(f"hl{x}", P["warm_light"], 0.3, 0.0)) for x in (700, 1280, 1860)))
    floor = (floor_plain(d, P["steel_d"], P["slate"]) + rect(X0, 1640, X1 - X0, 16, P["gold"]) + rect(X0, 1880, X1 - X0, 16, P["gold"])
             + "".join(poly([(x, 1640), (x + 60, 1640), (x + 30, 1656), (x - 30, 1656)], INK) for x in range(X0, X1, 140)))
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["industrial", "work", "routine", "hard-work", "mechanical"], "anchors": {"machine": [600, 1300], "conveyor": [2000, 1300]}},
            "Brendësi e fabrikës", ["factory", "industrial", "manufacturing", "workers", "assembly-line", "machines", "routine", "indoor"], ["money", "science", "decisions"],
            "A factory floor: steel beams, high grid windows, a yellow machine and a conveyor with boxes in the background, safety lines on the concrete floor.",
            "Industrial work: factory jobs, routine and automation, workers' lives, the industrial revolution.")


def bg_warehouse_interior(d):
    rng = random.Random(37)

    def rack(x):
        out = "".join(rect(x + k * 520, 300, 24, FLOOR_Y - 300, P["blue_d"]) for k in range(2)) + rect(x, 300, 544, 0, P["blue_d"])
        for y in (560, 860, 1160, 1460):
            out += rect(x, y, 544, 26, P["orange"])
            bx = x + 30
            while bx < x + 500:
                bw, bh = rng.randint(90, 150), rng.randint(110, 220)
                out += rect(bx, y - bh, bw, bh, d.v(f"bx{bw % 3}", P["wood_l"], P["wood_d"])) + rect(bx + bw * 0.4, y - bh, bw * 0.2, bh, P["parch"], extra='opacity="0.6"')
                bx += bw + 12
        return out

    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", P["steel_l"], P["steel_d"]))
             + "".join(line(f"M{x},-300 V{FLOOR_Y}", P["steel_d"], 3, 'opacity="0.6"') for x in range(X0, X1, 60))
             + rack(X0 + 40) + rack(1830) + rect(1000, 700, 560, 860, d.v("door", P["slate_l"], P["slate_d"])) + "".join(line(f"M1000,{y} H1560", P["slate_dd"], 3) for y in range(720, 1560, 28))
             + "".join(line(f"M{x},-300 V160", P["slate_dd"], 4) + rect(x - 90, 160, 180, 20, P["white"], rx=10) + ellipse(x, 220, 260, 200, d.glow(f"wl{x}", P["white"], 0.45, 0.0)) for x in (500, 1280, 2060)))
    floor = floor_plain(d, P["steel"], P["steel_d"]) + rect(X0, 1650, X1 - X0, 14, P["gold"]) + light_pool(d, 1280, 1720, 900, 110, P["white"], 0.2)
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["industrial", "logistics", "big", "cold"], "anchors": {"door": [1280, FLOOR_Y], "center": [1280, GROUND_Y]}},
            "Brendësi e magazinës", ["warehouse", "logistics", "storage", "boxes", "supply-chain", "inventory", "indoor", "work"], ["money", "decisions", "science"],
            "A large warehouse: tall blue and orange pallet racks full of cardboard boxes, a roller door in the middle and hanging lights.",
            "Logistics and stuff: supply chains, online shopping, storage of things we buy, the hidden side of consumption.")


def bg_prison_cell(d):
    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", P["steel"], P["slate_l"]))
             + "".join(rect(x + (k % 2) * 90, 60 + k * 90, 170, 80, P["steel_d"], rx=4, extra='opacity="0.35"') for k in range(17) for x in range(X0, X1, 180))
             + rect(1460, 300, 300, 220, P["slate_dd"]) + rect(1476, 316, 268, 188, d.v("night", P["night"], P["night3"])) + circle(1680, 380, 26, P["warm_light2"])
             + "".join(rect(1490 + k * 52, 300, 14, 220, P["slate_d"]) for k in range(5))
             + poly([(1476, 504), (1744, 504), (1500, 1560), (900, 1560)], d.v("beam", P["sky_l"], P["blue_l"]), 'opacity="0.18"')
             + rect(X0, 300, 700 - X0, 1260, P["slate_dd"], extra='opacity="0.25"') + "".join(rect(x, 300, 22, 1260, d.h(f"bar{x % 3}", P["steel"], P["slate_dd"])) for x in range(X0 + 40, 700, 80))
             + rect(X0, 300, 1100, 30, P["slate_d"]) + rect(X0, 900, 1100, 24, P["slate_d"])
             + rect(X0, FLOOR_Y - 30, X1 - X0, 30, P["slate_d"]))
    floor = floor_plain(d, P["slate_l"], P["slate_d"]) + poly([(900, FLOOR_Y), (1500, FLOOR_Y), (1600, 2000), (760, 2000)], P["blue_l"], 'opacity="0.18"')
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["trapped", "cold", "night", "lonely", "regret"], "anchors": {"window": [1610, 410], "light_spot": [1200, GROUND_Y], "bars": [300, 1000]}},
            "Qeli burgu", ["prison", "cell", "trapped", "punishment", "regret", "isolation", "consequences", "indoor", "night"], ["psychology", "decisions", "philosophy"],
            "A cold prison cell: grey block walls, iron bars on the left, a small barred window with the moon and a pale beam of light on the floor.",
            "Being trapped: consequences of choices, guilt and regret, isolation, the prisoner's dilemma, mental prisons.")


# ================================================================ kalime
def bg_hallway(d):
    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", P["cream"], P["sand"]))
             + wainscot(d, 1100, P["sand2"], P["sand3"], P["sand3"])
             + door(d, 180, FLOOR_Y, key="d1") + door(d, 1130, FLOOR_Y, fill=(P["teal"], P["teal_d"]), key="d2") + door(d, 2080, FLOOR_Y, key="d3")
             + picture(d, 640, 560, 260, 200, 0, P["wood_d"]) + picture(d, 1600, 560, 260, 200, 2, P["wood_d"])
             + wall_lamp(d, 770, 470, "wl1") + wall_lamp(d, 1730, 470, "wl2")
             + "".join(ceiling_strip(d, x, 40, 400, f"cs{x}") for x in (300, 1080, 1860))
             + baseboard(P["white"], P["sand3"]))
    floor = floor_planks(d, P["wood_l"], P["wood"], P["wood_d"]) + rect(X0, 1640, X1 - X0, 200, d.v("runner", P["red"], P["red_d"])) + rect(X0, 1660, X1 - X0, 6, P["gold"]) + rect(X0, 1814, X1 - X0, 6, P["gold"])
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["quiet", "waiting", "transition", "neutral"], "anchors": {"door_1": [330, FLOOR_Y], "door_2": [1280, FLOOR_Y], "door_3": [2230, FLOOR_Y]}},
            "Korridor bosh", ["hallway", "corridor", "doors", "apartment", "hotel", "waiting", "transition", "indoor", "choice"], ["psychology", "decisions", "growth"],
            "An empty hallway seen from the side: three doors (one teal), framed pictures, wall lamps and a red runner on a wooden floor.",
            "In-between moments: waiting outside a door, choosing which door to open, a new apartment, a hotel at night.")


def bg_long_corridor(d):
    vp = (1280, 900)
    back = (1180, 760, 1380, 1040)
    base = corridor(d, vp, back, (P["cream"], P["sand2"]), (P["cream"], P["sand2"]), (P["white"], P["cream2"]), (P["sand2"], P["sand3"]))
    lights = "".join(poly([(1280 - 300 * (1 - t), 860 - 1100 * (1 - t) ** 1.1), (1280 + 300 * (1 - t), 860 - 1100 * (1 - t) ** 1.1),
                           (1280 + 260 * (1 - t), 860 - 1060 * (1 - t) ** 1.1), (1280 - 260 * (1 - t), 860 - 1060 * (1 - t) ** 1.1)], P["white"])
                      for t in (0.0, 0.35, 0.58, 0.74, 0.85))
    doors = ""
    for t in (0.05, 0.38, 0.6, 0.76):
        for side in (-1, 1):
            xn = 1280 + side * 1680 * (1 - t)
            xf = 1280 + side * 1680 * (1 - t - 0.08)
            ytop_n, ybot_n = 900 - 760 * (1 - t), 900 + 1100 * (1 - t)
            ytop_f, ybot_f = 900 - 760 * (1 - t - 0.08), 900 + 1100 * (1 - t - 0.08)
            doors += poly([(xn, ytop_n), (xf, ytop_f), (xf, ybot_f), (xn, ybot_n)], P["wood_d"])
    wallc = (base + doors + lights + rect(*back[:2], back[2] - back[0], back[3] - back[1], d.v("end", P["warm_light"], P["gold_l"]))
             + ellipse(1280, 900, 520, 420, d.glow("endglow", P["warm_light2"], 0.6, 0.0)))
    return ([("wall", 0, wallc)],
            {"mood": ["long", "journey", "liminal", "anticipation", "uncertain"], "anchors": {"vanishing_point": [1280, 900], "near": [1280, GROUND_Y]}, "actorZone": [[700, 1860]]},
            "Korridor i gjatë", ["corridor", "long", "perspective", "hospital", "office", "journey", "liminal", "indoor", "endless"], ["psychology", "philosophy", "decisions"],
            "A long, symmetrical corridor in one-point perspective with doors on both sides, ceiling lights and warm light at the far end.",
            "A long road ahead: waiting for news, a hospital or office corridor, liminal spaces, walking towards the unknown.")


def bg_stairwell(d):
    steps, rail = "", ""
    flights = [(FLOOR_Y, 360, 1, 0), (FLOOR_Y - 500, 2200, -1, 1), (FLOOR_Y - 1000, 360, 1, 2)]
    for y0, x0, dirn, k in flights:
        pts = [(x0, y0)]
        for n in range(10):
            x = x0 + dirn * n * 84
            y = y0 - (n + 1) * 50
            pts += [(x, y), (x + dirn * 84, y)]
        xe = x0 + dirn * 840
        pts += [(xe, y0 - 500), (xe, y0 - 400), (x0 + dirn * 160, y0)]
        steps += poly(pts, d.v(f"fl{k}", P["steel_l"], P["steel_d"]))
        steps += "".join(rect(min(x0 + dirn * n * 84, x0 + dirn * (n + 1) * 84), y0 - (n + 1) * 50, 84, 8, P["white"], extra='opacity="0.6"') for n in range(10))
        landing = (xe, y0 - 500)
        steps += rect(landing[0] - (0 if dirn > 0 else 340), landing[1], 340, 30, P["steel_d"])
        rail += line(f"M{x0},{y0 - 170} L{xe},{y0 - 670}", P["slate_dd"], 10)
        rail += "".join(line(f"M{x0 + dirn * 840 * t:.0f},{y0 - 170 - 500 * t:.0f} v150", P["slate_d"], 5) for t in [q / 8 for q in range(9)])
    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", P["cream2"], P["sand2"]))
             + rect(1180, 300, 240, 380, d.v("win", P["sky_l"], P["glass"])) + rect(1180, 300, 240, 380, "none", extra=f'stroke="{P["white"]}" stroke-width="16"')
             + poly([(1180, 680), (1420, 680), (1700, 1560), (1000, 1560)], P["warm_light2"], 'opacity="0.25"')
             + steps + rail + rect(X0, FLOOR_Y - 20, X1 - X0, 20, P["steel_d"]))
    floor = floor_plain(d, P["steel"], P["steel_d"])
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["neutral", "transition", "effort", "climb"], "anchors": {"stairs_bottom": [360, FLOOR_Y], "window": [1300, 490]}},
            "Shkallë brenda ndërtesës", ["stairs", "stairwell", "building", "climb", "effort", "escape", "indoor", "transition"], ["growth", "psychology", "decisions"],
            "A stairwell inside a building: zig-zag concrete flights with metal railings rising up the wall and a window letting in daylight.",
            "Effort and progress one step at a time, taking the stairs instead of the elevator, escaping, going up or down in life.")


def bg_elevator(d):
    back = (720, 160, 1840, 1500)
    sheet = corridor(d, (1280, 830), back, (P["steel_l"], P["steel_d"]), (P["steel_l"], P["steel_d"]), (P["white"], P["steel_l"]), (P["slate"], P["slate_d"]))
    wallc = (sheet + rect(back[0], back[1], back[2] - back[0], back[3] - back[1], d.d("mirror", P["sky_l"], P["glass"]))
             + sheen(f"M{back[0] + 80},{back[1]} L{back[0] + 260},{back[1]} L{back[0] + 120},{back[3]} L{back[0]},{back[3]} L{back[0]},{back[1] + 300} Z", 0.25)
             + rect(back[0], 1060, back[2] - back[0], 22, P["steel_dd"], rx=11)
             + poly([(X0, 1100), (back[0], 1060), (back[0], 1080), (X0, 1130)], P["steel_dd"]) + poly([(X1, 1100), (back[2], 1060), (back[2], 1080), (X1, 1130)], P["steel_dd"])
             + rect(2060, 760, 140, 460, d.v("panel", P["steel"], P["steel_d"]), rx=10) + "".join(circle(2100 + (k % 2) * 60, 820 + (k // 2) * 70, 18, P["warm_light"] if k == 5 else P["white"]) for k in range(10))
             + ellipse(1280, 160, 560, 120, d.glow("ceil", P["white"], 0.7, 0.0)))
    return ([("wall", 0, wallc)],
            {"mood": ["confined", "awkward", "neutral", "social-pressure"], "anchors": {"center": [1280, GROUND_Y], "mirror": [1280, 760]}, "actorZone": [[740, 1820]]},
            "Brendësi e ashensorit", ["elevator", "lift", "confined", "awkward", "social-norms", "office", "indoor", "small-talk"], ["psychology", "decisions", "growth"],
            "Inside an elevator: brushed steel side walls, a mirrored back wall, a handrail, a button panel and bright ceiling light.",
            "Awkward social moments: elevator silence, conformity experiments (everyone facing the wrong way), small talk, confined spaces.")


def bg_tunnel(d):
    rings = ""
    for k, t in enumerate((0.0, 0.25, 0.45, 0.6, 0.72, 0.8)):
        s = 1 - t
        rx, ry, cy = 1500 * s + 60, 1300 * s + 50, 900
        rings += f'<path d="M{1280 - rx:.0f},{cy + ry * 0.6:.0f} V{cy:.0f} A{rx:.0f},{ry:.0f} 0 0 1 {1280 + rx:.0f},{cy:.0f} V{cy + ry * 0.6:.0f}" fill="none" stroke="{P["slate_d"]}" stroke-width="{24 * s + 4:.0f}"/>'
        rings += circle(1280 - rx * 0.9, cy - ry * 0.3, 14 * s + 3, P["warm_light"]) + circle(1280 - rx * 0.9, cy - ry * 0.3, 90 * s + 20, d.glow(f"l{k}", P["warm_light"], 0.5, 0.0))
    wallc = (rect(X0, -300, X1 - X0, 2400, d.v("bg", P["slate"], P["night2"]))
             + ellipse(1280, 900, 300, 260, d.glow("end", P["warm_light2"], 0.55, 0.0)) + ellipse(1280, 900, 90, 80, P["warm_light2"])
             + rings + line(f"M{X0},420 Q1280,820 {X1},420", P["steel_dd"], 18) + line(f"M{X0},500 Q1280,860 {X1},500", P["gold_d"], 10))
    floor = (poly([(X0, 2100), (X1, 2100), (1340, 1000), (1220, 1000)], d.v("fl", P["slate_d"], P["slate_l"]))
             + poly([(1200, 2100), (1360, 2100), (1290, 1000), (1270, 1000)], P["warm_light"], 'opacity="0.25"'))
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["dark", "underground", "journey", "hope", "light-at-the-end"], "anchors": {"light": [1280, 900], "center": [1280, GROUND_Y]}, "actorZone": [[700, 1860]]},
            "Tunel nëntokësor", ["tunnel", "underground", "dark", "light-at-the-end", "journey", "escape", "hope", "indoor"], ["psychology", "growth", "philosophy"],
            "An arched underground tunnel in perspective with warm lamps along the wall and a bright light at the far end.",
            "The light at the end of the tunnel: hard times and hope, an escape route, the long dark middle of a journey.")


def bg_museum(d):
    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", P["white"], P["cream2"]))
             + "".join(picture(d, x, 520, w_, h_, k, P["gold_d"]) + poly([(x + w_ / 2 - 30, 100), (x + w_ / 2 + 30, 100), (x + w_ + 80, 520 + h_ + 60), (x - 80, 520 + h_ + 60)], P["warm_light2"], 'opacity="0.3"')
                       + rect(x + w_ / 2 - 40, 80, 80, 26, P["slate_d"], rx=10)
                       for k, (x, w_, h_) in enumerate(((60, 380, 300), (700, 320, 420), (1640, 320, 420), (2160, 380, 300))))
             + rect(1140, 960, 280, 600, d.h("ped", P["white"], P["marble_d"])) + rect(1120, 940, 320, 26, P["marble"])
             + path("M1220,940 Q1180,840 1230,790 Q1210,740 1250,720 L1310,720 Q1350,740 1330,790 Q1380,840 1340,940 Z", d.d("vase", P["teal"], P["teal_d"]))
             + baseboard(P["cream2"], P["marble_d"]))
    floor = floor_planks(d, P["wood_l"], P["wood"], P["wood_d"]) + ellipse(1280, 1700, 900, 90, d.glow("refl", P["white"], 0.35, 0.0))
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["quiet", "cultural", "contemplative", "bright"], "anchors": {"pedestal": [1280, 940], "center": [1280, GROUND_Y]}},
            "Muze", ["museum", "gallery", "art", "history", "culture", "exhibition", "contemplation", "indoor"], ["philosophy", "growth", "science"],
            "A bright museum gallery: white walls with four framed paintings under spotlights and a teal vase on a pedestal in the middle.",
            "History and culture: looking at the past, art and meaning, how we value things, a quiet moment of contemplation.")


def bg_throne_room(d):
    from props_power import column
    vp_y = 900
    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", P["red_d"], INK))
             + "".join(arch(x, 160, 240, 900, d.v(f"tw{x}", P["warm_light2"], P["gold_l"])) for x in (220, 2100))
             + "".join(path(f"M{x},140 H{x + 200} V760 L{x + 100},700 L{x},760 Z", d.v(f"bn{x}", P["blue"], P["blue_dd"])) + star(x + 100, 400, 40, 16, 5, P["gold"]) for x in (640, 1720))
             + "".join(column(d, x, 60, FLOOR_Y, 120, f"c{x}") for x in (90, 520, 2040, 2470))
             # podiumi dhe froni në sfond
             + rect(1000, 1240, 560, 80, P["gold_d"]) + rect(940, 1320, 680, 80, P["gold"]) + rect(880, 1400, 800, 160, d.v("dais", P["red"], P["red_d"]))
             + path("M1160,1240 V820 Q1160,700 1280,670 Q1400,700 1400,820 V1240 Z", d.v("throne", P["gold_l"], P["gold_d"])) + path("M1200,1240 V860 Q1200,760 1280,740 Q1360,760 1360,860 V1240 Z", P["red"])
             + "".join(line(f"M{x},-300 V60", P["gold_d"], 4) + circle(x, 100, 60, d.glow(f"ch{x}", P["warm_light"], 0.7, 0.0)) + circle(x, 90, 30, P["gold_l"]) for x in (900, 1660)))
    floor = floor_tiles(d, P["marble_l"], P["marble_d"], P["marble_dd"], 300) + carpet(d, 1080, 1480, FLOOR_Y, P["red"], P["red_d"], P["gold"])
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["royal", "power", "grand", "formal", "history"], "anchors": {"throne": [1280, 1240], "carpet": [1280, GROUND_Y]}},
            "Salla e fronit", ["throne-room", "royal", "king", "palace", "power", "court", "history", "monarchy", "indoor"], ["philosophy", "decisions", "money"],
            "A royal throne room: deep red walls, marble columns, blue banners with gold stars, tall arched windows, chandeliers and a golden throne on a dais at the end of a red carpet.",
            "Royal power: kings and courts, petitioners before the throne, the corruption of power, history's rulers.")


def bg_parliament(d):
    seats = ""
    for row in range(6):
        r = 520 + row * 150
        for k in range(26):
            a = math.pi * (0.06 + 0.88 * k / 25)
            x, y = 1280 - r * 1.25 * math.cos(a), 1560 - r * 0.42 * math.sin(a) - row * 70
            seats += rect(x - 26, y - 34, 52, 40, P["blue"] if (k + row) % 7 else P["red_l"], rx=10)
        seats += path(f"M{1280 - r * 1.25:.0f},{1580 - row * 70} Q1280,{1580 - row * 70 - r * 0.84:.0f} {1280 + r * 1.25:.0f},{1580 - row * 70}", "none", f'stroke="{P["wood_dd"]}" stroke-width="14"')
    wallc = (rect(X0, -300, X1 - X0, FLOOR_Y + 300, d.v("wall", P["wood"], P["wood_dd"]))
             + path(f"M{X0},500 Q1280,-200 {X1},500 V-300 H{X0} Z", d.v("dome", P["cream"], P["sand3"]))
             + "".join(line(f"M1280,-120 L{1280 + 1700 * math.cos(a):.0f},{-120 + 700 * math.sin(a):.0f}", P["sand3"], 6) for a in [math.pi * (0.1 + 0.1 * k) for k in range(9)])
             + seats
             + rect(1120, 1300, 320, 260, d.v("speaker", P["wood_d"], P["wood_ddd"]), rx=8) + rect(1100, 1280, 360, 30, P["wood_l"])
             + circle(1280, 1400, 50, d.d("seal", P["gold_l"], P["gold_d"])))
    floor = floor_plain(d, P["blue_d"], P["blue_dd"])
    return ([("wall", 0, wallc), ("floor", 0, floor)],
            {"mood": ["political", "formal", "debate", "institution"], "anchors": {"speaker": [1280, 1300], "center": [1280, GROUND_Y]}},
            "Salla e parlamentit", ["parliament", "politics", "democracy", "government", "debate", "law", "vote", "institution", "indoor"], ["decisions", "philosophy", "psychology"],
            "A parliament chamber: semicircular rows of blue seats (a few red) rising around the speaker's desk, wood walls and a pale dome above.",
            "Politics and democracy: debate, voting, laws, group decisions, polarisation, the history of government.")


SCENES = [
    ("bg_office_night_01", bg_office_night), ("bg_luxury_office_01", bg_luxury_office), ("bg_negotiation_room_01", bg_negotiation_room),
    ("bg_library_01", bg_library), ("bg_ancient_library_01", bg_ancient_library), ("bg_lecture_hall_01", bg_lecture_hall),
    ("bg_courtroom_01", bg_courtroom), ("bg_bank_interior_01", bg_bank_interior), ("bg_factory_interior_01", bg_factory_interior),
    ("bg_warehouse_interior_01", bg_warehouse_interior), ("bg_prison_cell_01", bg_prison_cell), ("bg_hallway_01", bg_hallway),
    ("bg_long_corridor_01", bg_long_corridor), ("bg_stairwell_01", bg_stairwell), ("bg_elevator_01", bg_elevator),
    ("bg_tunnel_01", bg_tunnel), ("bg_museum_01", bg_museum), ("bg_throne_room_01", bg_throne_room), ("bg_parliament_01", bg_parliament),
]


def main() -> None:
    print(f"{write_scenes(SCENES, 'interior')} sfonde të brendshme")


if __name__ == "__main__":
    main()
