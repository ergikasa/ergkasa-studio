"""Sfondet e jashtme (lista e prodhimit, kategoria 08).

Shtresat: qielli (larg), qyteti/peizazhi (mesatar), toka ku ecin personazhet (0) dhe ndonjëherë një plan i parë (< 0).

Përdorimi: python3 tools/asset-gen/backgrounds_exterior.py
"""
from __future__ import annotations

import math
import random

from bglib import (CENTER, FLOOR_Y, GROUND_Y, INK, P, X0, X1, arch, circle, cloud, cobbles, cypress, ellipse, facade, floor_plain,
                   floor_tiles, hills, lamp_post, light_pool, line, path, poly, rain, rect, sheen, skyline, sky, stars_field, sun, tower, tree,
                   write_scenes)
from editorial import star

OUT = ["psychology", "growth", "decisions"]


def sidewalk(d, light, dark, curb=P["slate_l"], y0=FLOOR_Y):
    return (rect(X0, y0, X1 - X0, 260, d.v("walk", light, dark)) + "".join(line(f"M{x},{y0} L{x - 60},{y0 + 260}", dark, 3, 'opacity="0.6"') for x in range(X0, X1, 240))
            + rect(X0, y0 + 250, X1 - X0, 24, curb) + rect(X0, y0 + 274, X1 - X0, 300, d.v("road", P["slate"], P["slate_d"])))


# ================================================================ qyteti modern
def bg_city_skyline(d):
    rng = random.Random(51)
    skyc = sky(d, P["orange"], P["warm_light2"]) + sun(d, 1700, 520, 110) + cloud(500, 300, 0.9, P["warm_light2"]) + cloud(1300, 220, 0.6, P["warm_light2"])
    far = skyline(d, rng, 1300, 0, 300, 700, 120, 220, [P["violet"], P["violet_d"]], P["night3"], 0.05)
    mid = skyline(d, rng, 1440, 0, 360, 1000, 160, 260, [P["night3"], P["night2"]], P["slate"], 0.25, roofs=(None, "step", "spire"))
    ground = (rect(X0, 1430, X1 - X0, 140, d.v("water", P["violet"], P["night2"])) + "".join(rect(rng.uniform(X0, X1), rng.uniform(1450, 1550), rng.uniform(40, 140), 4, P["warm_light"], extra='opacity="0.6"') for _ in range(30))
              + rect(X0, FLOOR_Y, X1 - X0, 500, d.v("prom", P["sand3"], P["wood_dd"])) + rect(X0, FLOOR_Y - 90, X1 - X0, 12, P["slate_dd"])
              + "".join(line(f"M{x},{FLOOR_Y - 90} V{FLOOR_Y}", P["slate_dd"], 6) for x in range(X0, X1, 120)) + rect(X0, FLOOR_Y - 4, X1 - X0, 8, P["slate_dd"]))
    return ([("sky", 8, skyc), ("far", 3, far), ("mid", 1.2, mid), ("ground", 0, ground)],
            {"mood": ["sunset", "ambition", "city", "cinematic", "dream"], "anchors": {"railing": [1280, FLOOR_Y - 90], "sun": [1700, 900]}},
            "Siluetë e qytetit modern", ["city", "skyline", "sunset", "urban", "ambition", "dream", "success", "outdoor"], ["money", "growth", "psychology"],
            "A modern city skyline at sunset over a river, seen from a waterside promenade with a railing.",
            "Big dreams and ambition: moving to the city, success, the hustle, looking at the life you want.")


def bg_city_street_night(d):
    rng = random.Random(52)
    skyc = sky(d, P["night"], P["night3"]) + stars_field(rng, 50, X0, -200, X1, 600) + circle(600, 260, 60, P["warm_light2"])
    blds = "".join(tower(d, x, FLOOR_Y, w, h, c, P["night3"], rng, 0.18) for x, w, h, c in
                   [(X0, 520, 1100, P["night2"]), (160, 440, 1300, P["slate_dd"]), (640, 520, 900, P["night2"]), (1200, 460, 1250, P["slate_dd"]), (1700, 560, 1000, P["night2"]), (2300, 640, 1200, P["slate_dd"])])
    shops = "".join(rect(x, FLOOR_Y - 300, 360, 300, P["night"]) + rect(x + 20, FLOOR_Y - 280, 320, 200, P["night3"]) + rect(x, FLOOR_Y - 330, 360, 30, P["slate_d"]) for x in (200, 1000, 1820))
    ground = (sidewalk(d, P["slate"], P["slate_d"], P["slate_l"]) + "".join(lamp_post(d, x, FLOOR_Y + 20, 760, True, f"lp{x}") + light_pool(d, x, 1700, 340, 70, P["warm_light"], 0.45, f"pool{x}") for x in (560, 1860)))
    return ([("sky", 8, skyc), ("buildings", 0.4, blds + shops), ("ground", 0, ground)],
            {"mood": ["night", "empty", "lonely", "quiet", "mystery"], "anchors": {"lamp_left": [560, FLOOR_Y], "lamp_right": [1860, FLOOR_Y], "sidewalk": [1280, GROUND_Y]}},
            "Rrugë qyteti bosh natën", ["street", "night", "empty", "city", "lonely", "late", "walk-home", "outdoor", "urban"], ["psychology", "philosophy", "decisions"],
            "An empty city street at night: dark buildings with a few lit windows, closed shops, two street lamps casting warm pools on the sidewalk.",
            "Loneliness and night thoughts: walking home alone, insomnia, the quiet city, reflection after a hard day.")


def bg_city_street_rain(d):
    rng = random.Random(53)
    skyc = sky(d, P["steel_dd"], P["steel"]) + "".join(ellipse(x, y, 360, 90, P["slate_l"], 'opacity="0.6"') for x, y in ((400, 120), (1300, 60), (2200, 160)))
    blds = "".join(tower(d, x, FLOOR_Y, w, h, c, P["steel_l"], rng, 0.1) for x, w, h, c in
                   [(X0, 500, 1000, P["slate_l"]), (120, 480, 1200, P["slate"]), (620, 560, 950, P["slate_l"]), (1200, 500, 1150, P["slate"]), (1720, 520, 980, P["slate_l"]), (2260, 700, 1100, P["slate"])])
    ground = (sidewalk(d, P["slate_l"], P["slate"], P["steel"]) + "".join(ellipse(x, 1700 + (x % 3) * 30, 160, 18, P["steel_l"], 'opacity="0.5"') for x in range(X0 + 200, X1, 520))
              + "".join(rect(x, FLOOR_Y + 30, 20, 220, P["warm_light"], extra='opacity="0.18"') for x in (560, 1860)) + lamp_post(d, 560, FLOOR_Y + 20, 760, True, "l1") + lamp_post(d, 1860, FLOOR_Y + 20, 760, True, "l2"))
    rainfx = rain(rng, 220, X0, -300, X1, 2000, P["white"], 0.45)
    return ([("sky", 8, skyc), ("buildings", 0.4, blds), ("ground", 0, ground), ("rain", -0.2, rainfx)],
            {"mood": ["rain", "grey", "melancholy", "sad", "cinematic"], "anchors": {"sidewalk": [1280, GROUND_Y]}},
            "Rrugë qyteti me shi", ["rain", "street", "city", "grey", "melancholy", "sadness", "bad-day", "outdoor", "weather"], ["psychology", "philosophy", "decisions"],
            "A grey city street in the rain: wet sidewalk with puddles and reflections, lamps on, rain streaks in the foreground.",
            "Melancholy and bad days: sadness, rejection, a breakup, walking alone in the rain, grey moods.")


def bg_business_district(d):
    rng = random.Random(54)
    skyc = sky(d, P["sky"], P["sky_l"]) + cloud(700, 260, 0.9) + cloud(1900, 180, 0.7)
    far = skyline(d, rng, 1300, 0, 500, 1000, 160, 260, [P["blue_l"], P["steel"]], P["sky_l"], roofs=(None, "spire", "step"))
    mid = "".join(tower(d, x, FLOOR_Y, w, h, c, P["glass"], rng, 0, roof=r) for x, w, h, c, r in
                  [(X0, 520, 1400, P["blue_d"], None), (300, 380, 1500, P["teal_d"], "step"), (1800, 420, 1450, P["blue_d"], None), (2300, 600, 1300, P["teal_d"], "spire")])
    plaza = (floor_tiles(d, P["cream2"], P["sand2"], P["sand3"], 240) + "".join(rect(x - 90, FLOOR_Y - 60, 180, 60, P["slate_l"], rx=10) + tree(x, FLOOR_Y - 60, 0.55, P["green"], P["green_d"]) for x in (860, 1700)))
    return ([("sky", 8, skyc), ("far", 2.5, far), ("towers", 0.5, mid), ("ground", 0, plaza)],
            {"mood": ["business", "corporate", "day", "busy", "modern"], "anchors": {"plaza": [1280, GROUND_Y]}},
            "Lagje biznesi", ["business-district", "downtown", "corporate", "skyscrapers", "office", "career", "outdoor", "city"], ["money", "decisions", "growth"],
            "A modern business district on a sunny day: blue glass towers, a bright plaza with trees in planters.",
            "Corporate life: careers, offices, the 9-to-5, ambition, business deals in the city centre.")


def bg_financial_district(d):
    from props_business import classical_facade
    rng = random.Random(55)
    skyc = sky(d, P["sky"], P["sky_l"]) + cloud(400, 200, 0.7)
    towers = "".join(tower(d, x, FLOOR_Y, w, h, c, P["glass"], rng, 0, roof=r) for x, w, h, c, r in
                     [(X0, 560, 1600, P["slate"], "step"), (240, 360, 1800, P["slate_l"], "spire"), (1860, 400, 1700, P["slate_l"], None), (2260, 560, 1500, P["slate"], "step")])
    exchange = f'<g transform="translate(700 {FLOOR_Y - 900})">' + classical_facade(d, 1160, 900, 6, P["sand"], P["sand3"], name="ex") + "</g>"
    ground = floor_tiles(d, P["sand2"], P["sand3"], P["parch_d"], 260)
    return ([("sky", 8, skyc), ("towers", 0.6, towers + exchange), ("ground", 0, ground)],
            {"mood": ["finance", "power", "wealth", "formal", "day"], "anchors": {"exchange": [1280, FLOOR_Y - 450], "plaza": [1280, GROUND_Y]}},
            "Lagje financiare", ["financial-district", "wall-street", "stock-exchange", "banks", "money", "markets", "finance", "outdoor"], ["money", "decisions", "psychology"],
            "A financial district: a classical stock exchange with columns between tall grey skyscrapers, a stone plaza in front.",
            "Money and markets: the stock exchange, bankers, financial crises, greed and speculation.")


def bg_industrial_district(d):
    rng = random.Random(56)
    skyc = sky(d, P["steel_d"], P["steel_l"]) + "".join(ellipse(x, y, r, r * 0.4, P["steel"], 'opacity="0.7"') for x, y, r in ((500, 200, 400), (1500, 120, 500), (2300, 260, 360)))
    smoke = "".join(circle(x + k * 30, 500 - k * 90, 60 + k * 18, P["steel"], 'opacity="0.55"') for x in (320, 900) for k in range(5))
    far = (rect(200, 760, 90, 800, P["slate"]) + rect(780, 820, 80, 740, P["slate"]) + rect(1500, 900, 600, 660, P["slate_l"])
           + "".join(poly([(1500 + k * 120, 900), (1560 + k * 120, 840), (1620 + k * 120, 900)], P["slate_l"]) for k in range(5))
           + line("M2200,1560 V500 M2200,520 H2600 M2200,520 L2000,700", P["gold_d"], 22) + line("M2560,520 V900", P["slate_d"], 6))
    mid = (rect(X0, 1100, 1000, 460, d.v("w1", P["red_d"], P["wood_ddd"])) + "".join(rect(X0 + 40 + k * 110, 1180, 70, 90, P["warm_light"], extra='opacity="0.6"') for k in range(9))
           + "".join(rect(x, 1360, 260, 200, d.v(f"cn{x}", c, P["slate_d"])) for x, c in ((1100, P["orange"]), (1380, P["teal"]), (1240, P["blue"]))))
    ground = floor_plain(d, P["slate"], P["slate_d"]) + "".join(line(f"M{x},{FLOOR_Y} V{FLOOR_Y - 160}", P["slate_dd"], 8) for x in range(X0, X1, 200)) + line(f"M{X0},{FLOOR_Y - 150} H{X1} M{X0},{FLOOR_Y - 80} H{X1}", P["slate_dd"], 6)
    return ([("sky", 8, skyc), ("smoke", 4, smoke), ("far", 1.5, far), ("mid", 0.4, mid), ("ground", 0, ground)],
            {"mood": ["industrial", "grey", "work", "pollution", "gritty"], "anchors": {"street": [1280, GROUND_Y]}},
            "Zonë industriale", ["industrial", "factories", "chimneys", "port", "containers", "pollution", "working-class", "outdoor"], ["money", "science", "decisions"],
            "An industrial district under a grey sky: chimneys with smoke, a crane, warehouses, stacked shipping containers and a fence.",
            "Industry and labour: working-class life, pollution, globalisation, the engine room of the economy.")


# ================================================================ histori
def bg_ancient_greek_city(d):
    rng = random.Random(57)
    skyc = sky(d, P["sky"], P["sky_l"]) + sun(d, 2100, 260, 70)
    acropolis = (hills(1000, 260, P["sand2"], 1, 700) + f'<g transform="translate(980 600) scale(0.6)">'
                 + rect(0, 0, 1000, 40, P["marble_l"]) + "".join(rect(40 + k * 120, 40, 50, 300, P["marble"]) for k in range(8)) + poly([(0, 0), (500, -120), (1000, 0)], P["marble_l"]) + rect(-20, 340, 1040, 40, P["marble_d"]) + "</g>")
    houses = ""
    for k in range(9):
        x = X0 + 60 + k * 340
        hh = rng.uniform(240, 380)
        houses += rect(x, 1420 - hh, 300, hh + 140, d.v(f"h{k % 3}", P["white"], P["marble"])) + rect(x - 10, 1420 - hh - 20, 320, 26, P["marble_d"])
        houses += arch(x + 40, 1420 - hh + 60, 70, 110, P["blue_d"]) + arch(x + 180, 1420 - hh + 60, 70, 110, P["blue_d"]) + rect(x + 110, 1420 - 120, 80, 120, P["blue"])
    trees = "".join(cypress(x, 1440, 420, P["green_dd"]) for x in (180, 1100, 2400)) + "".join(circle(x, 1360, 80, P["green_d"]) for x in (700, 1800))
    ground = floor_tiles(d, P["sand"], P["sand2"], P["sand3"], 260)
    return ([("sky", 8, skyc), ("acropolis", 2.2, acropolis), ("houses", 0.5, houses + trees), ("ground", 0, ground)],
            {"mood": ["ancient", "sunny", "classical", "philosophy", "warm"], "anchors": {"temple": [1280, 640], "street": [1280, GROUND_Y]}},
            "Qytet i lashtë grek", ["ancient-greece", "athens", "acropolis", "philosophy", "democracy", "history", "mediterranean", "outdoor"], ["philosophy", "science", "decisions"],
            "An ancient Greek city: white houses with blue doors, cypress and olive trees, and a temple on the hill (acropolis) under a clear sky.",
            "Ancient Greece: philosophers in the agora, the birth of democracy, Socratic questions, classical wisdom.")


def bg_roman_city(d):
    skyc = sky(d, P["sky"], P["warm_light2"]) + cloud(600, 220, 0.8) + cloud(1900, 300, 0.6)
    colosseum = f'<g transform="translate(140 760)">' + path("M0,500 V120 Q400,40 800,120 V500 Z", d.v("col", P["parch"], P["parch_d"])) + "".join(
        arch(30 + k * 96, 160 + r * 110, 60, 90, P["wood_dd"], 'opacity="0.7"') for r in range(3) for k in range(8)) + "</g>"
    roofs = "".join(rect(x, 1100, 420, 360, P["parch"]) + poly([(x - 20, 1100), (x + 210, 1000), (x + 440, 1100)], P["red_d"]) + arch(x + 170, 1260, 80, 200, P["wood_dd"]) for x in (X0 + 40, 2560))
    forum = ("".join(rect(x, 980, 70, 580, d.h(f"fc{x}", P["marble_l"], P["marble_d"])) + rect(x - 14, 960, 98, 24, P["marble_l"]) for x in range(1080, 2500, 210))
             + rect(1060, 930, 1460, 40, P["marble"]) + path("M1000,1560 V1080 Q1140,920 1280,1080 V1560 H1220 V1110 Q1140,1000 1060,1110 V1560 Z", P["parch_d"]))
    ground = cobbles(d, FLOOR_Y, P["sand2"], P["sand3"], P["parch_d"], random.Random(58))
    return ([("sky", 8, skyc), ("far", 2, colosseum), ("city", 0.4, roofs + forum), ("ground", 0, ground)],
            {"mood": ["ancient", "empire", "grand", "warm", "history"], "anchors": {"forum": [1700, 1300], "street": [1280, GROUND_Y]}},
            "Qytet romak", ["rome", "roman-empire", "forum", "colosseum", "history", "empire", "politics", "outdoor", "ancient"], ["philosophy", "decisions", "money"],
            "A Roman city: a forum colonnade and a triumphal arch in front of terracotta-roofed houses, with the Colosseum in the distance.",
            "The Roman Empire: power and politics, rise and fall of empires, Stoic emperors, bread and circuses.")


def bg_medieval_village(d):
    rng = random.Random(59)
    skyc = sky(d, P["sky"], P["sky_l"]) + cloud(500, 260, 0.8) + cloud(1600, 180, 0.6)
    far = hills(1200, 300, P["green_l"], 3, 600) + f'<g transform="translate(1500 700) scale(0.35)">' + "".join(rect(x, 300, 160, 700, P["sand3"]) + poly([(x - 20, 300), (x + 80, 120), (x + 180, 300)], P["blue_d"]) for x in (0, 840)) + rect(160, 500, 680, 500, P["sand2"]) + "</g>"
    houses = ""
    for k, x in enumerate((X0 + 60, 380, 900, 1700, 2250)):
        w, hh = 420, rng.uniform(330, 420)
        houses += (rect(x, FLOOR_Y - hh, w, hh, d.v(f"hs{k % 2}", P["parch_l"], P["parch"])) + "".join(line(f"M{x},{FLOOR_Y - hh + j * hh / 3} H{x + w}", P["wood_dd"], 12) for j in range(3))
                   + line(f"M{x + 10},{FLOOR_Y - hh} V{FLOOR_Y} M{x + w - 10},{FLOOR_Y - hh} V{FLOOR_Y} M{x},{FLOOR_Y - hh} L{x + w / 2},{FLOOR_Y} M{x + w},{FLOOR_Y - hh} L{x + w / 2},{FLOOR_Y}", P["wood_dd"], 10)
                   + path(f"M{x - 40},{FLOOR_Y - hh + 10} L{x + w / 2},{FLOOR_Y - hh - 200} L{x + w + 40},{FLOOR_Y - hh + 10} Z", d.v(f"th{k % 2}", P["gold_l"], P["gold_d"]))
                   + rect(x + w / 2 - 50, FLOOR_Y - 180, 100, 180, P["wood_dd"], rx=40))
    well = rect(1340, 1400, 220, 160, d.v("well", P["sand2"], P["sand3"]), rx=10) + line("M1350,1400 V1240 M1550,1400 V1240", P["wood_dd"], 12) + poly([(1320, 1250), (1450, 1170), (1580, 1250)], P["wood_d"])
    ground = rect(X0, FLOOR_Y, X1 - X0, 500, d.v("dirt", P["parch_d"], P["wood_d"])) + "".join(ellipse(rng.uniform(X0, X1), rng.uniform(1620, 1900), rng.uniform(10, 30), 6, P["wood_dd"], 'opacity="0.4"') for _ in range(40))
    return ([("sky", 8, skyc), ("far", 2.2, far), ("village", 0.3, houses + well), ("ground", 0, ground)],
            {"mood": ["medieval", "rural", "simple", "community", "day"], "anchors": {"well": [1450, 1400], "road": [1280, GROUND_Y]}},
            "Fshat mesjetar", ["medieval", "village", "peasants", "feudal", "history", "rural", "community", "outdoor"], ["philosophy", "decisions", "money"],
            "A medieval village: timber-framed houses with thatched roofs, a stone well, a dirt road and a castle on a far hill.",
            "Medieval life: peasants and lords, feudalism, small communities, how people lived before modern comforts.")


def castle_shape(d, x, base, s, stone, roof):
    out = ""
    for tx, tw, th in ((0, 160, 600), (840, 160, 600), (400, 200, 800)):
        out += rect(x + tx * s, base - th * s, tw * s, th * s, stone) + poly([(x + (tx - 20) * s, base - th * s), (x + (tx + tw / 2) * s, base - (th + 200) * s), (x + (tx + tw + 20) * s, base - th * s)], roof)
        out += "".join(rect(x + (tx + k * tw / 4) * s, base - (th + 30) * s, tw / 6 * s, 30 * s, stone) for k in range(4))
    out += rect(x + 160 * s, base - 440 * s, 680 * s, 440 * s, stone) + "".join(rect(x + (160 + k * 60) * s, base - 470 * s, 36 * s, 30 * s, stone) for k in range(12))
    out += path(f"M{x + 430 * s},{base} V{base - 200 * s} Q{x + 500 * s},{base - 290 * s} {x + 570 * s},{base - 200 * s} V{base} Z", INK)
    return out


def bg_castle_exterior(d):
    skyc = sky(d, P["night3"], P["red_l"]) + sun(d, 600, 900, 90, P["warm_light"], P["orange"]) + "".join(ellipse(x, y, 420, 70, P["violet_d"], 'opacity="0.6"') for x, y in ((900, 300), (2000, 220)))
    hill = path(f"M{X0},1500 Q900,900 1300,920 Q1700,900 {X1},1500 V2100 H{X0} Z", d.v("hill", P["green_d"], P["green_dd"]))
    castle = castle_shape(d, 780, 960, 1.0, d.v("st", P["slate_l"], P["slate_d"]), P["blue_dd"])
    ground = (rect(X0, FLOOR_Y, X1 - X0, 500, d.v("grass", P["green_d"], P["green_dd"])) + poly([(1200, FLOOR_Y - 600), (1360, FLOOR_Y - 600), (1700, 2100), (860, 2100)], d.v("path", P["sand2"], P["sand3"]), 'opacity="0.9"'))
    return ([("sky", 8, skyc), ("castle", 1.4, hill + castle), ("ground", 0, ground)],
            {"mood": ["dramatic", "medieval", "power", "dusk", "epic"], "anchors": {"castle": [1280, 700], "path": [1280, GROUND_Y]}},
            "Kështjella nga jashtë", ["castle", "medieval", "kingdom", "fortress", "dusk", "epic", "history", "outdoor", "power"], ["philosophy", "decisions", "psychology"],
            "A dark stone castle on a green hill at dusk with conical towers, a winding path leading up to the gate.",
            "Kingdoms and power: the castle as a symbol of defence, ambition, the fortress you build around yourself.")


def bg_palace_exterior(d):
    skyc = sky(d, P["sky"], P["sky_l"]) + cloud(600, 200, 0.7) + cloud(2000, 160, 0.6)
    palace = f'<g transform="translate(-20 {FLOOR_Y - 820}) scale(2.0 1.08)">' + __import__("props_history").palace(d)["body"] + "</g>"
    garden = ("".join(rect(x, FLOOR_Y - 140, 90, 140, P["green_d"], rx=20) + circle(x + 45, FLOOR_Y - 150, 60, P["green"]) for x in range(X0 + 40, X1, 300))
              + ellipse(1280, FLOOR_Y + 80, 300, 60, d.v("fount", P["marble"], P["marble_d"])) + ellipse(1280, FLOOR_Y + 70, 250, 40, d.v("fw", P["sky"], P["blue_l"]))
              + rect(1260, FLOOR_Y - 130, 40, 200, P["marble"]) + path(f"M1280,{FLOOR_Y - 140} Q1180,{FLOOR_Y - 260} 1120,{FLOOR_Y + 40} M1280,{FLOOR_Y - 140} Q1380,{FLOOR_Y - 260} 1440,{FLOOR_Y + 40}", "none", f'stroke="{P["sky_l"]}" stroke-width="10" opacity="0.8"'))
    ground = rect(X0, FLOOR_Y, X1 - X0, 500, d.v("gravel", P["sand"], P["sand3"]))
    return ([("sky", 8, skyc), ("palace", 0.5, palace), ("ground", 0, ground + garden)],
            {"mood": ["royal", "wealth", "grand", "day", "elite"], "anchors": {"fountain": [1280, FLOOR_Y + 70], "courtyard": [1280, GROUND_Y]}},
            "Pallati nga jashtë", ["palace", "royal", "garden", "fountain", "wealth", "elite", "aristocracy", "outdoor", "history"], ["money", "decisions", "philosophy"],
            "A grand cream palace facade with a teal dome behind clipped hedges and a fountain in a gravel courtyard.",
            "Wealth and the elite: royalty and aristocracy, inequality, the gap between palace and village.")


def bg_public_square(d):
    rng = random.Random(60)
    skyc = sky(d, P["sky"], P["sky_l"]) + cloud(800, 220, 0.8)
    cols = [P["orange"], P["gold_l"], P["red_l"], P["cream"], P["teal"], P["pink"]]
    row = "".join(facade(d, x, 1500, 420, rng.uniform(800, 960), rng.choice(cols), P["cream"], P["night3"], rng, 3, rng.choice([P["green_d"], P["blue_d"], None]), ("flat", 0), P["wood_dd"], rng.random() < 0.5, f"f{x}") for x in range(X0, X1, 420))
    statue = (rect(1180, 1220, 200, 280, d.v("ped", P["marble_l"], P["marble_d"])) + rect(1160, 1200, 240, 26, P["marble"])
              + path("M1250,1200 L1240,980 Q1280,950 1320,980 L1310,1200 Z", d.v("st", P["green_d"], P["teal_d"])) + circle(1280, 940, 34, P["teal_d"]) + line("M1310,1000 L1380,900", P["teal_d"], 18))
    ground = cobbles(d, 1500, P["sand2"], P["sand3"], P["parch_d"], random.Random(61)) + "".join(ellipse(x, 1780, 18, 10, P["slate_l"]) + circle(x + 14, 1770, 7, P["slate_l"]) for x in (700, 760, 1900))
    return ([("sky", 8, skyc), ("buildings", 0.4, row + statue), ("ground", 0, ground)],
            {"mood": ["public", "social", "day", "community", "european"], "groundY": GROUND_Y, "anchors": {"statue": [1280, 1200], "square": [1280, GROUND_Y]}},
            "Shesh publik", ["square", "plaza", "public", "town", "community", "protest", "crowd", "outdoor", "european"], ["psychology", "decisions", "philosophy"],
            "A European public square: colourful old facades with shutters and balconies around a cobbled square with a bronze statue on a pedestal.",
            "Public life: gatherings and protests, social behaviour in crowds, community, the town square of history.")


def bg_old_european_street(d):
    rng = random.Random(62)
    skyc = sky(d, P["sky"], P["warm_light2"]) + cloud(600, 160, 0.6)
    cols = [P["gold_l"], P["orange"], P["pink"], P["cream"], P["red_l"], P["teal"]]
    row = "".join(facade(d, x, FLOOR_Y, 380, rng.uniform(1100, 1300), rng.choice(cols), P["cream"], P["night3"], rng, 4, rng.choice([P["green_d"], P["blue_d"], P["wood_d"]]), ("gable", 120, P["red_d"]), P["wood_dd"], True, f"f{x}") for x in range(X0, X1, 380))
    cafe = path(f"M1000,{FLOOR_Y - 420} H1560 L1600,{FLOOR_Y - 320} H960 Z", d.v("aw", P["red"], P["red_d"])) + "".join(rect(1000 + k * 70, FLOOR_Y - 420, 35, 100, P["white"], extra='opacity="0.8"') for k in range(8))
    ground = cobbles(d, FLOOR_Y, P["sand2"], P["sand3"], P["parch_d"], random.Random(63)) + lamp_post(d, 760, FLOOR_Y + 40, 700, False, "l1") + lamp_post(d, 1900, FLOOR_Y + 40, 700, False, "l2")
    return ([("sky", 8, skyc), ("street", 0, row + cafe), ("ground", 0, ground)],
            {"mood": ["old-town", "warm", "charming", "history", "travel"], "anchors": {"cafe": [1280, FLOOR_Y - 320], "street": [1280, GROUND_Y]}},
            "Rrugë e vjetër europiane", ["old-town", "europe", "street", "cobblestone", "history", "travel", "charm", "outdoor", "cafe"], ["growth", "philosophy", "psychology"],
            "An old European street: tall colourful houses with shutters, balconies and gabled roofs, a red café awning and a cobbled street with lamps.",
            "Old towns and history: travel, a slower life, the past preserved, a historical city street.")


# ================================================================ natyrë dhe udhë
def bg_bridge(d):
    skyc = sky(d, P["orange"], P["warm_light"]) + sun(d, 1280, 1100, 120)
    bridge = (rect(X0, 1080, X1 - X0, 40, P["night2"]) + "".join(rect(x, 400, 70, 820, P["night2"]) + rect(x - 20, 380, 110, 40, P["night2"]) for x in (520, 1980))
              + path("M-400,1080 Q150,980 555,420 Q1280,1060 2015,420 Q2400,900 2960,1080", "none", f'stroke="{P["night2"]}" stroke-width="14"')
              + "".join(line(f"M{x},{1080} V{min(1060, 420 + abs(x - 1280) ** 2 / 1100):.0f}", P["night2"], 4) for x in range(600, 1980, 70)))
    water = rect(X0, 1120, X1 - X0, 500, d.v("water", P["orange"], P["violet_d"])) + "".join(rect(1280 - w / 2, y, w, 6, P["warm_light"], extra='opacity="0.6"') for y, w in ((1180, 300), (1240, 420), (1310, 260), (1400, 380)))
    pier = rect(X0, FLOOR_Y, X1 - X0, 500, d.v("pier", P["wood"], P["wood_dd"])) + "".join(line(f"M{x},{FLOOR_Y} V2100", P["wood_dd"], 4) for x in range(X0, X1, 120)) + rect(X0, FLOOR_Y - 100, X1 - X0, 14, P["wood_ddd"]) + "".join(rect(x, FLOOR_Y - 100, 14, 100, P["wood_ddd"]) for x in range(X0, X1, 240))
    return ([("sky", 8, skyc), ("bridge", 2.5, bridge), ("water", 1, water), ("pier", 0, pier)],
            {"mood": ["sunset", "reflective", "connection", "calm", "cinematic"], "anchors": {"railing": [1280, FLOOR_Y - 100], "sun": [1280, 1100]}},
            "Urë mbi lumë", ["bridge", "river", "sunset", "connection", "crossing", "city", "reflection", "outdoor", "transition"], ["philosophy", "growth", "decisions"],
            "A suspension bridge silhouetted over a river at sunset, seen from a wooden pier with a railing.",
            "Connection and transition: crossing to a new stage of life, bridging two worlds, reflecting at the end of the day.")


def bg_desert(d):
    skyc = sky(d, P["sky"], P["warm_light2"]) + sun(d, 1900, 360, 90, P["white"], P["warm_light"])
    far = path(f"M{X0},1150 Q300,1020 700,1100 T1600,1060 T{X1},1120 V2100 H{X0} Z", P["parch"])
    mid = path(f"M{X0},1350 Q500,1180 1000,1300 Q1500,1420 2000,1260 T{X1},1330 V2100 H{X0} Z", d.v("d2", P["gold_l"], P["gold"]))
    ground = (path(f"M{X0},{FLOOR_Y} Q800,1480 1600,{FLOOR_Y + 30} T{X1},{FLOOR_Y - 20} V2100 H{X0} Z", d.v("d3", P["gold"], P["gold_d"]))
              + "".join(path(f"M{x},{FLOOR_Y + 120 + k * 60} q60,-20 120,0", "none", f'stroke="{P["gold_d"]}" stroke-width="4" opacity="0.5"') for k in range(4) for x in range(X0 + 200, X1, 460))
              + path("M2100,1600 V1380 Q2100,1350 2130,1350 Q2160,1350 2160,1380 V1600 Z M2100,1480 H2060 V1420 Q2060,1400 2045,1400 Q2030,1400 2030,1420 V1500 H2100 Z", P["green_d"]))
    return ([("sky", 8, skyc), ("far", 3, far), ("mid", 1, mid), ("ground", 0, ground)],
            {"mood": ["empty", "hot", "lonely", "endurance", "vast"], "anchors": {"dune": [1280, GROUND_Y]}},
            "Shkretëtirë", ["desert", "dunes", "heat", "lonely", "survival", "journey", "emptiness", "outdoor", "endurance"], ["philosophy", "psychology", "growth"],
            "A desert landscape: layered golden dunes under a pale sun, with one cactus.",
            "Endurance and emptiness: a long hard journey, scarcity, feeling lost, the 'desert' period before success.")


def bg_ocean_horizon(d):
    skyc = sky(d, P["violet_d"], P["warm_light"]) + sun(d, 1280, 1160, 130, P["warm_light2"], P["orange"]) + "".join(ellipse(x, y, 380, 40, P["pink"], 'opacity="0.6"') for x, y in ((600, 600), (1900, 700), (1200, 400)))
    sea = rect(X0, 1160, X1 - X0, 1000, d.v("sea", P["orange_d"], P["night2"])) + "".join(rect(1280 - w / 2, y, w, 6, P["warm_light2"], extra='opacity="0.7"') for y, w in ((1190, 340), (1240, 480), (1300, 300), (1380, 560), (1470, 360)))
    rocks = (path(f"M{X0},{FLOOR_Y} Q100,1460 400,1480 Q700,1440 900,{FLOOR_Y + 20} L{X0},{FLOOR_Y + 60} Z", INK) + path(f"M{X1},{FLOOR_Y} Q2300,1470 2000,1500 Q1800,1470 1700,{FLOOR_Y + 40} L{X1},{FLOOR_Y + 60} Z", INK)
             + rect(X0, FLOOR_Y + 30, X1 - X0, 500, d.v("shore", P["night2"], INK)))
    return ([("sky", 8, skyc), ("sea", 2, sea), ("shore", 0, rocks)],
            {"mood": ["sunset", "calm", "reflective", "infinite", "hope"], "anchors": {"horizon": [1280, 1160], "shore": [1280, GROUND_Y]}},
            "Horizonti i oqeanit", ["ocean", "horizon", "sunset", "sea", "infinite", "calm", "reflection", "future", "outdoor"], ["philosophy", "growth", "psychology"],
            "An open ocean horizon at sunset: the sun on the waterline, a golden path on the sea, dark rocks on the shore.",
            "Big-picture moments: the future, infinity and perspective, calm after a storm, contemplating life.")


def bg_empty_road(d):
    skyc = sky(d, P["blue_l"], P["warm_light2"]) + sun(d, 1280, 1040, 80)
    fields = (rect(X0, 1080, X1 - X0, 1000, d.v("field", P["green_l"], P["green_d"])) + "".join(path(f"M{1280},{1080} L{x},2100", "none", f'stroke="{P["green"]}" stroke-width="5" opacity="0.6"') for x in range(X0, X1, 260)))
    road = (poly([(1250, 1080), (1310, 1080), (2300, 2100), (260, 2100)], d.v("road", P["slate_l"], P["slate_d"]))
            + "".join(poly([(1280 - 4 * (1 + t * 6), 1080 + 1020 * t), (1280 + 4 * (1 + t * 6), 1080 + 1020 * t), (1280 + 4 * (1 + (t + 0.04) * 6), 1080 + 1020 * (t + 0.04)), (1280 - 4 * (1 + (t + 0.04) * 6), 1080 + 1020 * (t + 0.04))], P["warm_light2"]) for t in (0.05, 0.15, 0.28, 0.44, 0.64, 0.88))
            + "".join(line(f"M{1280 + side * (60 + 1600 * t):.0f},{1080 + 1020 * t:.0f} v{-60 - 500 * t:.0f}", P["wood_dd"], 4 + 10 * t) for t in (0.02, 0.1, 0.25, 0.5) for side in (-1, 1)))
    return ([("sky", 8, skyc), ("land", 0, fields + road)],
            {"mood": ["open", "journey", "freedom", "lonely", "future"], "anchors": {"vanishing_point": [1280, 1080], "road": [1280, GROUND_Y]}, "actorZone": [[700, 1860]]},
            "Rrugë bosh drejt horizontit", ["road", "empty", "horizon", "journey", "freedom", "future", "long-road", "outdoor", "path"], ["growth", "philosophy", "decisions"],
            "A straight empty road running to the horizon through green fields, poles along the side and the sun at the end.",
            "The road ahead: a long journey, freedom, starting over, discipline over a long distance.")


def bg_crossroads(d):
    skyc = sky(d, P["sky"], P["warm_light2"]) + cloud(500, 260, 0.8) + cloud(2000, 200, 0.6)
    land = (hills(1140, 140, P["green_l"], 9, 500) + rect(X0, 1120, X1 - X0, 1000, d.v("field", P["green_l"], P["green_d"]))
            + path(f"M1180,2100 Q1240,1500 1280,1340 Q1150,1200 700,1100 L760,1096 Q1200,1180 1290,1300 Q1360,1180 1800,1096 L1860,1100 Q1420,1200 1300,1340 Q1330,1500 1400,2100 Z", d.v("road", P["sand"], P["sand3"]))
            + tree(500, 1140, 0.4, P["green"], P["green_d"]) + tree(2100, 1130, 0.35, P["green"], P["green_dd"]))
    return ([("sky", 8, skyc), ("land", 0, land)],
            {"mood": ["decision", "open", "choice", "day", "uncertain"], "anchors": {"fork": [1290, 1300], "road": [1290, GROUND_Y], "left_path": [760, 1100], "right_path": [1800, 1100]}, "actorZone": [[900, 1700]]},
            "Udhëkryq", ["crossroads", "fork", "road", "choice", "decision", "path", "future", "outdoor", "dilemma"], ["decisions", "philosophy", "growth"],
            "A country road that splits into two paths across green fields, each going to a different horizon.",
            "A life decision: two paths, a dilemma, choosing one future over another, opportunity cost.")


# ================================================================ transporti dhe vende urbane
def bg_train_station(d):
    skyc = rect(X0, -300, X1 - X0, 2400, d.v("hall", P["steel_l"], P["cream2"]))
    roof = (path(f"M{X0},1060 Q1280,-560 {X1},1060 V-300 H{X0} Z", P["slate_l"], 'opacity="0.25"')
            + f'<path d="M{X0},1060 Q1280,-560 {X1},1060" fill="none" stroke="{P["slate_d"]}" stroke-width="26"/>'
            + f'<path d="M{X0 + 260},1060 Q1280,-300 {X1 - 260},1060" fill="none" stroke="{P["slate_d"]}" stroke-width="10" opacity="0.7"/>'
            + "".join(line(f"M1280,{-150} L{1280 + 1700 * math.cos(a):.0f},{-150 + 1300 * math.sin(a):.0f}", P["slate_d"], 6, 'opacity="0.5"') for a in [math.pi * (0.12 + 0.095 * k) for k in range(9)])
            + rect(1180, 560, 200, 200, P["white"], rx=100) + f'<circle cx="1280" cy="660" r="90" fill="none" stroke="{P["slate_dd"]}" stroke-width="12"/>' + line("M1280,660 V600 M1280,660 L1320,680", INK, 8))
    train = (rect(X0, 1060, 1500, 380, d.v("train", P["red"], P["red_d"]), rx=40) + "".join(rect(X0 + 60 + k * 220, 1120, 160, 120, P["sky_l"], rx=10) for k in range(7))
             + rect(X0, 1300, 1500, 30, P["white"]) + rect(X0, 1440, 2000, 30, P["slate_dd"]))
    ground = rect(X0, 1470, X1 - X0, 90, P["slate_dd"]) + floor_tiles(d, P["cream2"], P["steel"], P["steel_d"], 240) + rect(X0, FLOOR_Y + 20, X1 - X0, 24, P["gold"])
    return ([("hall", 2, skyc + roof), ("train", 0.3, train), ("platform", 0, ground)],
            {"mood": ["travel", "departure", "waiting", "transition", "busy"], "anchors": {"clock": [1280, 660], "platform": [1280, GROUND_Y], "train_door": [600, 1300]}},
            "Stacion treni", ["train-station", "platform", "travel", "departure", "goodbye", "waiting", "journey", "outdoor", "transport"], ["decisions", "psychology", "growth"],
            "A train station: a red train at the platform under an arched steel-and-glass roof with a big round clock. No signs or text.",
            "Departures and goodbyes: leaving home, missed chances (the train you didn't take), waiting, a new chapter.")


def bg_airport(d):
    rng = random.Random(64)
    outside = sky(d, P["sky"], P["sky_l"]) + cloud(400, 300, 0.7) + rect(X0, 1000, X1 - X0, 600, P["steel"]) + "".join(line(f"M{x},1100 H{x + 300}", P["white"], 10) for x in range(X0, X1, 500))
    plane = f'<g transform="translate(1500 820)">' + path("M0,140 Q60,80 200,80 H740 Q800,80 820,120 L860,120 L900,40 L940,40 L930,140 Q900,180 820,180 H120 Q40,180 0,140 Z", P["white"]) + path("M380,140 L520,140 L360,280 L300,280 Z", P["steel_l"]) + "".join(circle(260 + k * 50, 120, 12, P["sky"]) for k in range(10)) + "</g>"
    glass = ("".join(rect(x, 160, 20, 1400, P["slate_d"]) for x in range(X0, X1, 400)) + rect(X0, 140, X1 - X0, 40, P["slate_d"]) + rect(X0, 1120, X1 - X0, 20, P["slate_d"])
             + rect(160, 300, 600, 300, P["night2"], rx=10) + "".join(rect(190, 330 + k * 44, 540, 30, P["night3"], rx=4) + rect(560, 336 + k * 44, 140, 18, P["gold"] if k % 2 else P["green_l"], rx=4) for k in range(6))
             + "".join(rect(x, 1380, 80, 120, P["slate"], rx=10) + rect(x - 10, 1360, 100, 30, P["slate_l"], rx=10) for x in range(1300, 2300, 120)))
    ground = floor_tiles(d, P["cream2"], P["steel"], P["steel_d"], 300) + ellipse(1280, 1700, 1000, 100, d.glow("refl", P["white"], 0.4, 0.0))
    return ([("outside", 4, outside + plane), ("terminal", 0, glass), ("floor", 0, ground)],
            {"mood": ["travel", "modern", "departure", "bright", "anticipation"], "anchors": {"board": [460, 450], "seats": [1800, 1440], "window": [1280, 700]}},
            "Aeroport", ["airport", "terminal", "travel", "flight", "departure", "goodbye", "adventure", "indoor", "transport"], ["growth", "decisions", "psychology"],
            "An airport terminal: a glass wall looking onto a plane on the tarmac, a departures board with blank rows and lines of seats.",
            "Leaving and arriving: travel, moving abroad, saying goodbye, starting a new life somewhere else.")


def bg_subway(d):
    wallc = (rect(X0, -300, X1 - X0, 2400, d.v("wall", P["cream"], P["cream2"])) + "".join(line(f"M{X0},{y} H{X1}", P["cream3"], 3) for y in range(0, 1300, 60))
             + "".join(line(f"M{x + (y // 60 % 2) * 60},{y} v60", P["cream3"], 3) for x in range(X0, X1, 120) for y in range(0, 1300, 60))
             + rect(X0, 380, X1 - X0, 80, P["teal"]) + rect(X0, 1240, X1 - X0, 40, P["teal_d"])
             + path(f"M2100,1300 V700 Q2300,500 2500,700 V1300 Z", P["night"]) + ellipse(2300, 900, 80, 60, d.glow("tunnel", P["warm_light"], 0.5, 0.0))
             + "".join(rect(x, 560, 420, 280, d.v(f"ad{x}", c, P["slate_d"]), rx=10) for x, c in ((200, P["red_l"]), (1100, P["gold"]))) + "".join(ceiling_l for ceiling_l in [""]))
    track = rect(X0, 1280, X1 - X0, 280, d.v("pit", P["slate_dd"], INK)) + line(f"M{X0},1420 H{X1} M{X0},1500 H{X1}", P["steel"], 10)
    platform = rect(X0, FLOOR_Y - 20, X1 - X0, 30, P["gold"]) + floor_plain(d, P["steel"], P["steel_d"], FLOOR_Y + 10)
    return ([("wall", 1, wallc), ("track", 0.4, track), ("platform", 0, platform)],
            {"mood": ["urban", "commute", "routine", "waiting", "anonymous"], "anchors": {"tunnel": [2300, 900], "platform": [1280, GROUND_Y]}},
            "Platformë metroje", ["subway", "metro", "underground", "commute", "routine", "city", "anonymous", "waiting", "transport"], ["psychology", "decisions", "growth"],
            "An underground subway platform: white tiled walls with a teal stripe, blank posters, the track pit and a dark tunnel mouth with light coming.",
            "The daily commute: routine, anonymity among strangers, waiting, city life on autopilot.")


def bg_rooftop(d):
    rng = random.Random(65)
    skyc = sky(d, P["night"], P["violet_d"]) + stars_field(rng, 40, X0, -200, X1, 500) + circle(2000, 260, 50, P["warm_light2"])
    city = skyline(d, rng, 1400, 0, 300, 900, 120, 240, [P["night2"], P["night3"]], P["night"], lit=0.3)
    roof = (rect(X0, 1360, X1 - X0, 200, d.v("parapet", P["slate"], P["slate_d"])) + rect(X0, 1350, X1 - X0, 20, P["slate_l"])
            + rect(160, 1000, 260, 360, d.v("tank", P["wood_d"], P["wood_dd"]), rx=20) + line("M180,1360 L140,1560 M400,1360 L440,1560", P["slate_dd"], 10)
            + rect(1900, 1200, 300, 180, d.v("ac", P["steel"], P["steel_d"]), rx=10) + circle(2050, 1290, 60, P["steel_dd"])
            + "".join(circle(x, 1340, 7, P["warm_light"]) for x in range(600, 1800, 80)) + line("M600,1340 Q1200,1300 1800,1340", P["slate_dd"], 3))
    ground = floor_plain(d, P["slate_d"], P["night2"])
    return ([("sky", 8, skyc), ("city", 2, city), ("roof", 0, roof + ground)],
            {"mood": ["night", "reflective", "freedom", "city", "lonely"], "anchors": {"ledge": [1280, 1350], "roof": [1280, GROUND_Y]}},
            "Tarracë në çati", ["rooftop", "night", "city", "view", "reflection", "freedom", "escape", "outdoor", "urban"], ["psychology", "growth", "philosophy"],
            "A city rooftop at night: a parapet with string lights, a water tank and an air-conditioning unit, the lit skyline behind.",
            "Escaping for a moment: late-night reflection above the city, big conversations, dreams and doubts.")


def bg_parking_garage(d):
    wallc = (rect(X0, -300, X1 - X0, 2400, d.v("wall", P["steel"], P["steel_d"])) + rect(X0, -300, X1 - X0, 600, P["slate_l"])
             + "".join(rect(x, 300, 140, 1260, d.h(f"pil{x}", P["steel_l"], P["steel_d"])) + rect(x, 300, 140, 60, P["gold"]) + rect(x, 1460, 140, 60, P["gold"]) for x in (300, 1210, 2120))
             + "".join(rect(x, 330, 360, 18, P["white"], rx=9) + ellipse(x + 180, 360, 360, 160, d.glow(f"fl{x}", P["white"], 0.4, 0.0)) for x in (600, 1500))
             + rect(X0, 1300, X1 - X0, 40, P["steel_d"]))
    ground = floor_plain(d, P["slate_l"], P["slate"]) + "".join(poly([(x, FLOOR_Y), (x + 12, FLOOR_Y), (x + 12 + (x - 1280) * 0.9, 2100), (x + (x - 1280) * 0.9, 2100)], P["white"], 'opacity="0.8"') for x in range(X0 + 200, X1, 420))
    return ([("wall", 0, wallc), ("floor", 0, ground)],
            {"mood": ["cold", "urban", "tense", "empty", "noir"], "anchors": {"center": [1280, GROUND_Y]}},
            "Garazh parkimi", ["parking-garage", "underground", "concrete", "empty", "tense", "secret-meeting", "urban", "indoor", "noir"], ["psychology", "decisions", "money"],
            "An empty concrete parking garage: thick pillars with yellow bands, fluorescent lights and white parking lines.",
            "Tense, anonymous places: a secret meeting, a thriller moment, urban emptiness, the cold side of the city.")


SCENES = [
    ("bg_city_skyline_01", bg_city_skyline), ("bg_old_european_street_01", bg_old_european_street), ("bg_city_street_rain_01", bg_city_street_rain),
    ("bg_city_street_night_01", bg_city_street_night), ("bg_business_district_01", bg_business_district), ("bg_financial_district_01", bg_financial_district),
    ("bg_industrial_district_01", bg_industrial_district), ("bg_ancient_greek_city_01", bg_ancient_greek_city), ("bg_roman_city_01", bg_roman_city),
    ("bg_medieval_village_01", bg_medieval_village), ("bg_castle_exterior_01", bg_castle_exterior), ("bg_palace_exterior_01", bg_palace_exterior),
    ("bg_public_square_01", bg_public_square), ("bg_bridge_01", bg_bridge), ("bg_desert_01", bg_desert), ("bg_ocean_horizon_01", bg_ocean_horizon),
    ("bg_train_station_01", bg_train_station), ("bg_airport_01", bg_airport), ("bg_subway_01", bg_subway), ("bg_rooftop_01", bg_rooftop),
    ("bg_parking_garage_01", bg_parking_garage), ("bg_empty_road_01", bg_empty_road), ("bg_crossroads_01", bg_crossroads),
]


def main() -> None:
    print(f"{write_scenes(SCENES, 'exterior')} sfonde të jashtme")


if __name__ == "__main__":
    main()
