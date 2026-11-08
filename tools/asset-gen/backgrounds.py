"""Gjeneratori i sfondeve me shtresa (stili erkasa_flat_v1).

Çdo sfond është 2560×1920. Për 9:16 kamera pret një kuadër 1080×1920 nga mesi dhe ka
hapësirë për pan; për 16:9 pret 2560×1440. Shtresat janë grupe <g id="layer_*" data-depth="d">:
  d > 0  larg (lëviz më ngadalë se kamera, faktori 1/(1+d))
  d = 0  rrafshi i tokës, ku qëndrojnë personazhet
  d < 0  para kamerës (lëviz më shpejt)
Rregull: shtresat larg vizatohen më gjerë se kuadri, që parallax-i të mos zbulojë skajet.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
W, H = 2560, 1920


# ---------------------------------------------------------------- ndihmës
def rect(x, y, w, h, fill, rx=0, extra=""):
    return f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" rx="{rx}" fill="{fill}" {extra}/>'


def circle(cx, cy, r, fill, extra=""):
    return f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.1f}" fill="{fill}" {extra}/>'


def path(d, fill, extra=""):
    return f'<path d="{d}" fill="{fill}" {extra}/>'


def poly(pts, fill, extra=""):
    return f'<polygon points="{" ".join(f"{x:.0f},{y:.0f}" for x, y in pts)}" fill="{fill}" {extra}/>'


def lin_grad(gid, stops, vertical=True):
    x2, y2 = ("0", "1") if vertical else ("1", "0")
    s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{gid}" x1="0" y1="0" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def rad_grad(gid, stops):
    s = "".join(f'<stop offset="{o}" stop-color="{c}" stop-opacity="{a}"/>' for o, c, a in stops)
    return f'<radialGradient id="{gid}">{s}</radialGradient>'


def layer(lid, depth, content):
    return f'<g id="layer_{lid}" data-depth="{depth}">{content}</g>'


def cloud(cx, cy, s, fill="#FFFFFF", op=0.95):
    return (f'<g opacity="{op}">' + circle(cx, cy, 60 * s, fill) + circle(cx + 70 * s, cy - 25 * s, 75 * s, fill)
            + circle(cx + 150 * s, cy, 55 * s, fill) + rect(cx - 10 * s, cy, 170 * s, 55 * s, fill, rx=int(27 * s)) + "</g>")


def building(x, base, w, h, color, win, rng, lit=0.0, win_color="#F7E7B4"):
    out = rect(x, base - h, w, h, color)
    cols, rows = max(1, int(w // 70)), max(1, int(h // 90))
    gw, gh = w / cols, h / rows
    for c in range(cols):
        for r in range(rows - 1):
            wc = win_color if rng.random() < lit else win
            out += rect(x + c * gw + gw * 0.25, base - h + r * gh + gh * 0.3, gw * 0.5, gh * 0.45, wc, rx=3)
    return out


def wall_with_hole(color, hx, hy, hw, hh, x0=-400, y0=-200, x1=W + 400, y1=1560):
    d = f"M{x0},{y0} H{x1} V{y1} H{x0} Z M{hx},{hy} V{hy+hh} H{hx+hw} V{hy} Z"
    return f'<path d="{d}" fill="{color}" fill-rule="evenodd"/>'


def window_frame(x, y, w, h, color="#FFFFFF", t=22, cross=True):
    out = (rect(x - t, y - t, w + 2 * t, t, color) + rect(x - t, y + h, w + 2 * t, t + 10, color)
           + rect(x - t, y, t, h, color) + rect(x + w, y, t, h, color))
    if cross:
        out += rect(x + w / 2 - t / 3, y, t * 0.66, h, color) + rect(x, y + h / 2 - t / 3, w, t * 0.66, color)
    return out


def plant(x, base, s=1.0, pot="#C8734A"):
    leaves = ""
    for i, (dx, dy, rot) in enumerate([(-40, -170, -30), (30, -190, 25), (0, -230, 0), (-70, -120, -55), (60, -130, 50)]):
        leaves += f'<ellipse cx="{x+dx*s:.0f}" cy="{base+dy*s:.0f}" rx="{26*s:.0f}" ry="{70*s:.0f}" fill="{"#4F8A5B" if i%2 else "#62A06C"}" transform="rotate({rot} {x+dx*s:.0f} {base+dy*s:.0f})"/>'
    return leaves + poly([(x - 60 * s, base - 110 * s), (x + 60 * s, base - 110 * s), (x + 45 * s, base), (x - 45 * s, base)], pot)


def pine(x, base, h, color="#3F7A55", trunk="#6B4A33"):
    w = h * 0.42
    return (rect(x - h * 0.04, base - h * 0.15, h * 0.08, h * 0.15, trunk)
            + poly([(x, base - h), (x + w * 0.6, base - h * 0.45), (x - w * 0.6, base - h * 0.45)], color)
            + poly([(x, base - h * 0.75), (x + w, base - h * 0.12), (x - w, base - h * 0.12)], color))


def stars(rng, n, x0, y0, x1, y1, rmax=3.0, color="#FFFFFF"):
    return "".join(circle(rng.uniform(x0, x1), rng.uniform(y0, y1), rng.uniform(0.8, rmax), color,
                          f'opacity="{rng.uniform(0.4, 1):.2f}"') for _ in range(n))


# ---------------------------------------------------------------- skenat
def bg_home_living():
    rng = random.Random(11)
    defs = lin_grad("liv_sky", [(0, "#8FCBEA"), (1, "#DDF1FB")])
    hx, hy, hw, hh = 1540, 360, 640, 700
    far = (rect(1200, 200, 1300, 1000, "url(#liv_sky)") + cloud(1450, 520, 1.0) + cloud(1900, 430, 0.8)
           + path("M1200,1000 Q1500,900 1800,960 T2500,930 V1200 H1200 Z", "#8FBF84")
           + path("M1200,1060 Q1600,980 2000,1040 T2500,1010 V1200 H1200 Z", "#6FA86C"))
    wall = (wall_with_hole("#EADFCF", hx, hy, hw, hh) + rect(-400, 1500, W + 800, 60, "#D4C5B0")
            + window_frame(hx, hy, hw, hh)
            + path(f"M{hx-90},{hy-60} Q{hx-40},{hy+400} {hx-110},{hy+hh+60} H{hx-20} Q{hx+20},{hy+400} {hx-10},{hy-60} Z", "#C9644E")
            + path(f"M{hx+hw+90},{hy-60} Q{hx+hw+40},{hy+400} {hx+hw+110},{hy+hh+60} H{hx+hw+20} Q{hx+hw-20},{hy+400} {hx+hw+10},{hy-60} Z", "#C9644E")
            + rect(hx - 140, hy - 80, hw + 280, 22, "#8C6A4F", rx=8)
            + rect(500, 430, 420, 320, "#FFFFFF") + rect(525, 455, 370, 270, "#F4C46B")
            + poly([(525, 725), (680, 540), (800, 680), (850, 620), (895, 725)], "#5E8F8A") + circle(820, 520, 32, "#FFF3D6")
            + rect(300, 1000, 380, 22, "#8C6A4F", rx=6)
            + "".join(rect(320 + i * 46, 1000 - h, 38, h, c, rx=4) for i, (h, c) in enumerate(
                [(120, "#C2554D"), (100, "#2F8F8A"), (140, "#E3B66B"), (110, "#6C7A89"), (95, "#8E6BB0")])))
    furniture = (rect(420, 1370, 980, 200, "#3E5F86", rx=30) + rect(440, 1080, 940, 320, "#5B7FA6", rx=50)
                 + rect(360, 1220, 140, 330, "#4D7099", rx=50) + rect(1320, 1220, 140, 330, "#4D7099", rx=50)
                 + rect(500, 1260, 400, 150, "#6E91B7", rx=40) + rect(920, 1260, 400, 150, "#6E91B7", rx=40)
                 + rect(620, 1140, 160, 130, "#E8833A", rx=30, extra='transform="rotate(-8 700 1200)"')
                 + rect(450, 1560, 30, 40, "#2E2420") + rect(1340, 1560, 30, 40, "#2E2420")
                 + rect(1560, 900, 14, 660, "#2E2420") + poly([(1480, 900), (1655, 900), (1620, 760), (1515, 760)], "#F2D8A7")
                 + rect(1500, 1550, 140, 18, "#2E2420", rx=6) + plant(2250, 1560, 1.4))
    floor = (rect(-400, 1560, W + 800, 400, "#C99B6D")
             + "".join(rect(-400, 1600 + i * 80, W + 800, 4, "#B58757") for i in range(4))
             + f'<ellipse cx="1000" cy="1700" rx="760" ry="110" fill="#D8C3A5"/>'
             + f'<ellipse cx="1000" cy="1700" rx="640" ry="80" fill="none" stroke="#C4AB89" stroke-width="10"/>')
    return defs, [("window_view", 6, far), ("wall", 0.6, wall), ("furniture", 0.15, furniture), ("floor", 0, floor)], \
        {"groundY": 1690, "actorZone": [[700, 1900]], "mood": ["calm", "home", "day"]}


def bg_home_bedroom_night():
    rng = random.Random(22)
    defs = lin_grad("bed_sky", [(0, "#0D1730"), (1, "#283B66")]) + rad_grad("bed_glow", [(0, "#FFD58A", 0.55), (1, "#FFD58A", 0)])
    hx, hy, hw, hh = 1600, 360, 600, 640
    far = (rect(1300, 200, 1200, 1000, "url(#bed_sky)") + stars(rng, 70, 1300, 220, 2500, 820)
           + circle(2030, 520, 70, "#F4EBCF") + circle(2058, 500, 62, "#283B66", 'opacity="0.0"')
           + "".join(building(1300 + i * 120, 1060, 110, rng.randint(140, 380), "#1A2440", "#22305A", rng, lit=0.35, win_color="#F2C66B") for i in range(10)))
    wall = (wall_with_hole("#2C3550", hx, hy, hw, hh) + window_frame(hx, hy, hw, hh, "#4A5577")
            + rect(hx - 80, hy - 60, 70, hh + 140, "#3D4A6E", rx=20) + rect(hx + hw + 10, hy - 60, 70, hh + 140, "#3D4A6E", rx=20)
            + f'<ellipse cx="520" cy="980" rx="520" ry="420" fill="url(#bed_glow)"/>'
            + rect(-400, 1500, W + 800, 60, "#232A40")
            + rect(820, 520, 380, 280, "#4A5577") + rect(840, 540, 340, 240, "#6C7FB0")
            + circle(1010, 650, 60, "#AFC2EA"))
    furniture = (rect(700, 980, 1000, 330, "#6B4F3A", rx=40) + rect(680, 1260, 1060, 170, "#E8E6F0", rx=30)
                 + rect(760, 1180, 330, 120, "#FFFFFF", rx=50) + rect(1130, 1180, 330, 120, "#FFFFFF", rx=50)
                 + path("M680,1320 Q1100,1240 1740,1300 V1470 H680 Z", "#5B6BA8") + rect(680, 1440, 1060, 40, "#4A578F", rx=12)
                 + rect(700, 1480, 40, 80, "#4A3628") + rect(1660, 1480, 40, 80, "#4A3628")
                 + rect(360, 1220, 260, 340, "#5A4433", rx=14) + rect(380, 1300, 220, 8, "#463427")
                 + rect(470, 1080, 20, 140, "#2E2420") + poly([(410, 1080), (550, 1080), (520, 990), (440, 990)], "#FFD58A"))
    floor = rect(-400, 1560, W + 800, 400, "#3A3348") + f'<ellipse cx="1200" cy="1690" rx="700" ry="90" fill="#4A4060"/>'
    return defs, [("window_view", 6, far), ("wall", 0.6, wall), ("furniture", 0.15, furniture), ("floor", 0, floor)], \
        {"groundY": 1680, "actorZone": [[1750, 2300], [200, 650]], "mood": ["night", "lonely", "reflective", "sleep"]}


def bg_office():
    rng = random.Random(33)
    defs = lin_grad("off_sky", [(0, "#B7DDF2"), (1, "#EAF5FB")])
    hx, hy, hw, hh = 260, 260, 2040, 860
    far = (rect(0, 150, W, 1100, "url(#off_sky)") + cloud(600, 380, 0.9) + cloud(1800, 330, 1.1)
           + "".join(building(i * 170 - 100, 1150, 150, rng.randint(250, 650), rng.choice(["#9FB4C8", "#B2C3D3", "#8CA3BA"]), "#C9D7E4", rng, lit=0.1) for i in range(17)))
    mull = "".join(rect(hx + i * (hw / 5) - 9, hy, 18, hh, "#5C6B7A") for i in range(1, 5))
    wall = (wall_with_hole("#E4E7EB", hx, hy, hw, hh) + window_frame(hx, hy, hw, hh, "#5C6B7A", t=18, cross=False) + mull
            + rect(-400, 1500, W + 800, 60, "#C9CED4"))
    furniture = (rect(160, 900, 360, 660, "#7C8A99", rx=10)
                 + "".join(rect(185, 930 + r * 150, 310, 8, "#5E6B78") + "".join(rect(195 + i * 44, 930 + r * 150 + 20, 36, 120, c, rx=4) for i, c in enumerate(["#C2554D", "#2F8F8A", "#E3B66B", "#3E5F86", "#8E6BB0", "#6C7A89"])) for r in range(4))
                 + rect(900, 1200, 1100, 36, "#8A6A4E", rx=8) + rect(930, 1236, 30, 324, "#5E4836") + rect(1940, 1236, 30, 324, "#5E4836")
                 + rect(1180, 900, 520, 300, "#2B3445", rx=16) + rect(1200, 920, 480, 250, "#3E7BB5", rx=8)
                 + path("M1230,1120 L1320,1060 L1400,1090 L1500,990 L1580,1030 L1650,950", "none", 'stroke="#F7F3E8" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"')
                 + rect(1420, 1170, 40, 40, "#2B3445") + rect(1360, 1200, 160, 10, "#2B3445")
                 + rect(1000, 1170, 140, 30, "#F6F3EE", rx=4) + rect(1760, 1150, 70, 50, "#F6F3EE", rx=8)
                 + plant(2250, 1560, 1.3, "#E8E6E0"))
    floor = rect(-400, 1560, W + 800, 400, "#9AA3AD") + rect(-400, 1560, W + 800, 14, "#8A939D")
    return defs, [("window_view", 5, far), ("wall", 0.6, wall), ("furniture", 0.15, furniture), ("floor", 0, floor)], \
        {"groundY": 1690, "actorZone": [[560, 880], [2000, 2400]], "mood": ["work", "career", "corporate"]}


def bg_city_street():
    rng = random.Random(44)
    defs = lin_grad("city_sky", [(0, "#A9D9F2"), (1, "#EAF6FB")])
    sky = rect(-600, -200, W + 1200, 1500, "url(#city_sky)") + cloud(300, 300, 1.2) + cloud(1500, 220, 0.9) + cloud(2300, 360, 1.0)
    far = "".join(building(-600 + i * 190, 1250, 180, rng.randint(350, 820), "#B9C7D6", "#CFDAE5", rng) for i in range(20))
    facades = ["#D98B5F", "#E3B66B", "#8FB3A3", "#C77B7B", "#9C8FC0", "#E0A07A"]
    mid, x = "", -300
    while x < W + 300:
        w = rng.randint(300, 460)
        h = rng.randint(700, 1050)
        c = rng.choice(facades)
        mid += building(x, 1420, w, h, c, "#F3EEE6", rng, lit=0.0, win_color="#FFFFFF")
        mid += rect(x + w * 0.38, 1420 - 190, w * 0.24, 190, "#5A4A40", rx=6)
        mid += path(f"M{x+20},{1420-240} H{x+w-20} L{x+w-50},{1420-200} H{x+50} Z", rng.choice(["#C2554D", "#2F8F8A", "#3E5F86"]))
        x += w + rng.randint(10, 40)
    near = (rect(-400, 1420, W + 800, 190, "#CFC8BD") + rect(-400, 1600, W + 800, 22, "#A8A096")
            + rect(-400, 1622, W + 800, 320, "#4A4E57")
            + "".join(rect(-300 + i * 340, 1760, 180, 16, "#E9E4DA") for i in range(10))
            + "".join(rect(lx, 1000, 18, 600, "#3A3F48") + rect(lx - 30, 990, 78, 26, "#3A3F48", rx=10) + circle(lx + 9, 1020, 16, "#FFE7A8") for lx in (420, 1700))
            + "".join(rect(tx - 50, 1500, 100, 100, "#8C6A4F", rx=8) + circle(tx, 1380, 120, "#5E9E6A") + circle(tx - 60, 1430, 80, "#4F8A5B") + circle(tx + 70, 1420, 90, "#6FB07A") for tx in (1050, 2300)))
    return defs, [("sky", 12, sky), ("skyline", 4, far), ("buildings", 1.0, mid), ("street", 0, near)], \
        {"groundY": 1560, "actorZone": [[100, 2460]], "mood": ["city", "society", "busy", "day"]}


def bg_cafe():
    rng = random.Random(55)
    bricks = "".join(rect((c * 160) - (80 if r % 2 else 0) - 400, r * 60, 150, 52, rng.choice(["#B5654A", "#A95C43", "#BE6E52"]), rx=4)
                     for r in range(26) for c in range(23))
    wall = (rect(-400, -100, W + 800, 1700, "#9A513B") + bricks
            + rect(1650, 300, 640, 440, "#2D2A28", rx=14) + rect(1670, 320, 600, 400, "#3A3633", rx=8)
            + "".join(rect(1720, 380 + i * 70, rng.randint(240, 460), 14, "#E9E4DA", rx=7) for i in range(5))
            + rect(300, 560, 700, 20, "#5E4234", rx=6)
            + "".join(path(f"M{340+i*110},560 h70 l-8,-80 h-54 Z", c) for i, c in enumerate(["#F6F3EE", "#2F8F8A", "#F6F3EE", "#E8833A", "#F6F3EE", "#C2554D"]))
            + "".join(rect(lx, -100, 6, 420, "#2E2420") + path(f"M{lx-90},420 Q{lx+3},300 {lx+96},420 Z", "#2F8F8A") + circle(lx + 3, 430, 24, "#FFE7A8") for lx in (450, 1050, 1550))
            + rect(-400, 1460, W + 800, 100, "#6E4B35"))
    counter = (rect(250, 1120, 1350, 440, "#6E4B35", rx=12) + rect(220, 1090, 1410, 50, "#A47852", rx=10)
               + "".join(rect(290 + i * 220, 1180, 180, 320, "#7C573E", rx=8) for i in range(6))
               + rect(1200, 880, 300, 210, "#B9BEC4", rx=20) + rect(1230, 910, 240, 70, "#2E2420", rx=8) + rect(1290, 1010, 30, 60, "#2E2420")
               + rect(1380, 1010, 30, 60, "#2E2420") + rect(520, 1040, 70, 50, "#F6F3EE", rx=10) + rect(640, 1050, 60, 40, "#E8833A", rx=10))
    floor = rect(-400, 1560, W + 800, 400, "#8C6A4F") + "".join(rect(-400, 1600 + i * 70, W + 800, 4, "#7A5B43") for i in range(5))
    fore = (f'<ellipse cx="2100" cy="1500" rx="300" ry="40" fill="#5E4234"/>' + rect(2085, 1500, 30, 360, "#3A2A20")
            + rect(1960, 1840, 280, 26, "#3A2A20", rx=10) + rect(2140, 1410, 90, 90, "#F6F3EE", rx=16) + rect(2220, 1430, 26, 40, "#F6F3EE", rx=12))
    return defs_none(), [("wall", 0.5, wall), ("counter", 0.15, counter), ("floor", 0, floor), ("foreground", -0.3, fore)], \
        {"groundY": 1690, "actorZone": [[200, 1700]], "mood": ["social", "conversation", "relaxed"]}


def defs_none():
    return ""


def bg_classroom():
    defs = lin_grad("cls_sky", [(0, "#A6D6EE"), (1, "#E3F3FA")])
    hx, hy, hw, hh = 1950, 380, 460, 640
    far = rect(1700, 200, 900, 1000, "url(#cls_sky)") + cloud(2050, 520, 0.8) + circle(2350, 1100, 220, "#7DB27A")
    chalk = 'stroke="#E8EFE9" stroke-width="7" stroke-linecap="round"'
    wall = (wall_with_hole("#E8E1C9", hx, hy, hw, hh) + window_frame(hx, hy, hw, hh, "#FFFFFF")
            + rect(440, 340, 1300, 700, "#8C6A4F", rx=16) + rect(470, 370, 1240, 640, "#2F4A3E", rx=8)
            + path("M560,520 L760,520 M560,600 L840,600 M560,680 L720,680", "none", chalk)
            + path("M1000,800 L1200,480 L1400,800 Z", "none", chalk) + f'<circle cx="1520" cy="560" r="90" fill="none" {chalk}/>'
            + path("M960,900 Q1200,820 1460,900", "none", chalk)
            + rect(470, 1010, 1240, 26, "#8C6A4F") + rect(700, 1012, 90, 14, "#FFFFFF", rx=4)
            + circle(260, 420, 90, "#FFFFFF", 'stroke="#2E2420" stroke-width="12"') + path("M260,420 V360 M260,420 L300,440", "none", 'stroke="#2E2420" stroke-width="10" stroke-linecap="round"')
            + rect(-400, 1500, W + 800, 60, "#CFC6A8"))
    desks = ""
    for row, (y, s) in enumerate([(1330, 0.85), (1480, 1.0)]):
        for i in range(4):
            x = 260 + i * 560 + (row * 80)
            desks += (rect(x, y, 380 * s, 26, "#B88B5E", rx=6) + rect(x + 20, y + 26, 22, 200 * s, "#6B4A33")
                      + rect(x + 380 * s - 42, y + 26, 22, 200 * s, "#6B4A33")
                      + rect(x + 90 * s, y - 90 * s, 200 * s, 26, "#3E5F86", rx=6))
    floor = rect(-400, 1560, W + 800, 400, "#C7B08F") + "".join(rect(-400, 1600 + i * 80, W + 800, 4, "#B59C79") for i in range(4))
    return defs, [("window_view", 6, far), ("wall", 0.6, wall), ("desks", 0.1, desks), ("floor", 0, floor)], \
        {"groundY": 1700, "actorZone": [[200, 2400]], "mood": ["learning", "school", "knowledge"]}


def bg_nature_mountain():
    rng = random.Random(77)
    defs = lin_grad("mnt_sky", [(0, "#9DC9E6"), (0.7, "#FBE3BE"), (1, "#FBD9A5")])
    sky = rect(-800, -200, W + 1600, 1500, "url(#mnt_sky)") + circle(1900, 760, 120, "#FFF1C9") + cloud(400, 360, 1.1) + cloud(1300, 260, 0.8)
    far = (poly([(-800, 1100), (-200, 520), (300, 900), (900, 420), (1500, 950), (2100, 480), (2700, 900), (3300, 600), (3400, 1100)], "#8EA6C4")
           + poly([(-200, 520), (-90, 620), (-260, 600)], "#FFFFFF") + poly([(900, 420), (1010, 530), (840, 520)], "#FFFFFF")
           + poly([(2100, 480), (2210, 580), (2040, 575)], "#FFFFFF"))
    mid = path("M-600,1150 Q0,820 600,1060 T1800,980 T3200,1040 V1400 H-600 Z", "#6E8FA8")
    hills = (path("M-500,1300 Q300,1050 1100,1250 T2700,1180 T3100,1220 V1500 H-500 Z", "#7FB27A")
             + "".join(pine(rng.uniform(-400, 3000), rng.uniform(1260, 1330), rng.uniform(160, 260), "#4F8A5B") for _ in range(26)))
    ground = (rect(-400, 1380, W + 800, 600, "#8CC07F")
              + path("M1150,1920 C1200,1700 1500,1600 1400,1460 C1360,1410 1300,1400 1320,1380 L1360,1380 C1380,1420 1460,1440 1540,1500 C1680,1620 1500,1760 1650,1920 Z", "#D9B98C")
              + "".join(f'<ellipse cx="{rng.uniform(0, W):.0f}" cy="{rng.uniform(1600, 1880):.0f}" rx="{rng.uniform(40, 90):.0f}" ry="{rng.uniform(20, 40):.0f}" fill="#9AA0A6"/>' for _ in range(6)))
    fore = "".join(path(f"M{x},1920 l18,-90 l14,90 l16,-120 l14,120 l18,-80 l12,80 Z", "#6FA86C") for x in (40, 380, 2180, 2440))
    return defs, [("sky", 14, sky), ("far_mountains", 6, far), ("mid_mountains", 3, mid), ("hills", 1.2, hills), ("ground", 0, ground), ("foreground", -0.3, fore)], \
        {"groundY": 1600, "actorZone": [[200, 1100], [1700, 2400]], "mood": ["journey", "goal", "growth", "sunrise"]}


def bg_nature_beach():
    rng = random.Random(88)
    defs = lin_grad("sea_sky", [(0, "#8FD0EE"), (1, "#E6F6FC")]) + lin_grad("sea_water", [(0, "#2F8FB5"), (1, "#5DB8D4")])
    sky = rect(-800, -200, W + 1600, 1400, "url(#sea_sky)") + circle(600, 520, 130, "#FFF1C9") + cloud(1400, 350, 1.1) + cloud(2200, 450, 0.8)
    island = path("M1700,1060 Q1850,960 2000,1000 Q2150,950 2300,1060 Z", "#6E8FA8")
    sea = (rect(-600, 1050, W + 1200, 500, "url(#sea_water)")
           + "".join(path(f"M{x},{y} q30,-14 60,0 t60,0", "none", 'stroke="#BFE6F2" stroke-width="6" stroke-linecap="round"')
                     for x, y in [(rng.uniform(-400, W + 300), rng.uniform(1100, 1400)) for _ in range(30)]))
    sand = (path("M-400,1420 Q400,1360 1200,1400 T2960,1380 V1960 H-400 Z", "#EBD3A2")
            + path("M-400,1420 Q400,1360 1200,1400 T2960,1380 V1405 Q2000,1440 1200,1425 T-400,1445 Z", "#FFFFFF", 'opacity="0.8"')
            + f'<ellipse cx="1900" cy="1700" rx="140" ry="60" fill="#B7A68A"/><ellipse cx="2010" cy="1720" rx="90" ry="44" fill="#A39278"/>')
    palm = (path("M220,1960 Q260,1500 420,1120 L450,1130 Q300,1500 290,1960 Z", "#8C6A4F")
            + "".join(f'<ellipse cx="{430+dx}" cy="{1120+dy}" rx="220" ry="46" fill="{c}" transform="rotate({r} {430+dx} {1120+dy})"/>'
                      for dx, dy, r, c in [(120, 30, 20, "#4F8A5B"), (-130, 40, -25, "#62A06C"), (60, -50, -40, "#4F8A5B"), (-40, -60, 45, "#62A06C"), (150, 90, 50, "#62A06C")]))
    return defs, [("sky", 14, sky), ("island", 6, island), ("sea", 3, sea), ("sand", 0, sand), ("palm", -0.25, palm)], \
        {"groundY": 1660, "actorZone": [[700, 1700]], "mood": ["freedom", "rest", "vacation", "calm"]}


def bg_space():
    rng = random.Random(99)
    defs = (lin_grad("sp_bg", [(0, "#070915"), (1, "#1B1440")])
            + rad_grad("sp_neb1", [(0, "#8E6BB0", 0.55), (1, "#8E6BB0", 0)]) + rad_grad("sp_neb2", [(0, "#2F8F8A", 0.45), (1, "#2F8F8A", 0)])
            + rad_grad("sp_glow", [(0, "#FFE7A8", 0.5), (1, "#FFE7A8", 0)]))
    deep = (rect(-1000, -600, W + 2000, H + 1200, "url(#sp_bg)")
            + f'<ellipse cx="800" cy="700" rx="900" ry="500" fill="url(#sp_neb1)"/><ellipse cx="1900" cy="1300" rx="800" ry="450" fill="url(#sp_neb2)"/>'
            + stars(rng, 380, -1000, -600, W + 1000, H + 600, 2.2))
    near_stars = stars(rng, 60, -600, -400, W + 600, H + 400, 4.5) + "".join(
        circle(x, y, 60, "url(#sp_glow)") + circle(x, y, 7, "#FFFFFF") for x, y in [(500, 400), (2100, 300), (1500, 1650)])
    planet = (f'<ellipse cx="1950" cy="1250" rx="420" ry="90" fill="none" stroke="#E3B66B" stroke-width="26" opacity="0.6" transform="rotate(-15 1950 1250)"/>'
              + circle(1950, 1250, 300, "#C77B7B") + path("M1700,1100 Q1950,1060 2220,1120 L2240,1180 Q1960,1120 1690,1160 Z", "#B06A6A")
              + path("M1660,1300 Q1950,1260 2245,1320 L2235,1370 Q1960,1320 1675,1355 Z", "#B06A6A")
              + f'<path d="M1530,1210 A420,90 0 0 0 2370,1290" fill="none" stroke="#E3B66B" stroke-width="26" transform="rotate(-15 1950 1250)"/>'
              + circle(620, 1450, 90, "#9AA0A6") + circle(590, 1420, 18, "#7E848A") + circle(650, 1480, 12, "#7E848A"))
    return defs, [("deep_space", 20, deep), ("stars_near", 8, near_stars), ("planets", 3, planet)], \
        {"groundY": None, "actorZone": [[200, 2400]], "mood": ["cosmos", "infinity", "wonder", "science"]}


def bg_trading_room():
    rng = random.Random(1010)
    defs = rad_grad("tr_glow", [(0, "#3E7BB5", 0.35), (1, "#3E7BB5", 0)])
    screens = ""
    for r in range(2):
        for c in range(3):
            x, y = 330 + c * 650, 220 + r * 440
            screens += rect(x, y, 600, 400, "#0E131C", rx=16) + rect(x + 16, y + 16, 568, 368, "#121A26", rx=8)
            if (r + c) % 2 == 0:
                price = 250.0
                for k in range(16):
                    o = price
                    price = min(330, max(70, price + rng.uniform(-55, 60)))
                    hi, lo = max(o, price) + rng.uniform(5, 20), min(o, price) - rng.uniform(5, 20)
                    col = "#3DBE7A" if price >= o else "#E25B5B"
                    cx = x + 50 + k * 32
                    screens += rect(cx + 9, y + 380 - hi, 3, hi - lo, col) + rect(cx, y + 380 - max(o, price), 21, max(4, abs(price - o)), col)
            else:
                pts, v = [], 200.0
                for k in range(20):
                    v += rng.uniform(-28, 30)
                    v = min(330, max(40, v))
                    pts.append(f"{x + 40 + k * 27},{y + 380 - v:.0f}")
                screens += f'<polyline points="{" ".join(pts)}" fill="none" stroke="#5DB8D4" stroke-width="6" stroke-linejoin="round"/>'
    ticker = rect(-400, 120, W + 800, 60, "#0E131C") + "".join(rect(-380 + i * 170, 140, 120, 20, rng.choice(["#3DBE7A", "#E25B5B", "#C9D7E4"]), rx=4) for i in range(20))
    wall = rect(-400, -200, W + 800, 1760, "#1B2230") + f'<ellipse cx="1300" cy="650" rx="1300" ry="700" fill="url(#tr_glow)"/>' + ticker + screens + rect(-400, 1500, W + 800, 60, "#121823")
    desk = (rect(200, 1260, 2160, 40, "#2B3445", rx=10) + rect(260, 1300, 40, 260, "#1E2533") + rect(2260, 1300, 40, 260, "#1E2533")
            + "".join(rect(400 + i * 520, 1220, 300, 40, "#3A4558", rx=6) + rect(560 + i * 520, 1080, 160, 120, "#0E131C", rx=8) + rect(570 + i * 520, 1090, 140, 100, "#3E7BB5", rx=4) for i in range(4)))
    floor = rect(-400, 1560, W + 800, 400, "#141A24")
    return defs, [("wall_screens", 0.5, wall), ("desk", 0.12, desk), ("floor", 0, floor)], \
        {"groundY": 1690, "actorZone": [[200, 2400]], "mood": ["money", "markets", "risk", "tension"]}


SCENES = [
    ("bg_home_living_01", "Dhoma e ndenjes (ditë)", bg_home_living, ["home", "living-room", "day", "indoor"], ["psychology", "growth", "decisions"]),
    ("bg_home_bedroom_night_01", "Dhoma e gjumit (natë)", bg_home_bedroom_night, ["home", "bedroom", "night", "indoor"], ["psychology", "growth", "philosophy"]),
    ("bg_office_01", "Zyrë me pamje nga qyteti", bg_office, ["office", "work", "indoor"], ["money", "growth", "decisions"]),
    ("bg_city_street_01", "Rrugë qyteti", bg_city_street, ["city", "street", "outdoor"], ["psychology", "money", "decisions"]),
    ("bg_cafe_01", "Kafene", bg_cafe, ["cafe", "social", "indoor"], ["psychology", "decisions"]),
    ("bg_classroom_01", "Klasë", bg_classroom, ["school", "classroom", "indoor"], ["growth", "science", "philosophy"]),
    ("bg_nature_mountain_01", "Rrugë në mal (agim)", bg_nature_mountain, ["nature", "mountain", "path", "outdoor"], ["growth", "philosophy", "decisions"]),
    ("bg_nature_beach_01", "Plazh", bg_nature_beach, ["nature", "sea", "beach", "outdoor"], ["growth", "money", "philosophy"]),
    ("bg_space_01", "Kozmos", bg_space, ["space", "cosmos", "stars"], ["science", "philosophy"]),
    ("bg_trading_room_01", "Salla e tregtimit (bursa)", bg_trading_room, ["finance", "stocks", "screens", "indoor"], ["money", "decisions"]),
]


def main() -> None:
    out_root = ROOT / "assets" / "backgrounds"
    for asset_id, name, fn, tags, themes in SCENES:
        defs, layers, info = fn()
        body = "".join(layer(lid, d, c) for lid, d, c in layers)
        svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
               f'<defs>{defs}</defs><g id="{asset_id}">{body}</g></svg>\n')
        d = out_root / asset_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "asset.svg").write_text(svg)
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1, "name": name,
            "category": "background", "kind": "layered_background", "adapter": "svg",
            "style": "erkasa_flat_v1", "files": {"svg": "asset.svg"}, "viewBox": [0, 0, W, H],
            "layers": [{"id": f"layer_{lid}", "depth": dep} for lid, dep, _ in layers],
            "groundY": info["groundY"], "actorZones": info["actorZone"],
            "safeFrames": {"9:16": [740, 0, 1080, 1920], "16:9": [0, 240, 2560, 1440], "1:1": [320, 0, 1920, 1920]},
            "capabilities": {"camera": ["pan", "zoom", "parallax", "shake"]},
            "mood": info["mood"], "themes": themes, "tags": tags,
            "license": {"spdx": "LicenseRef-Erkasa-Original", "source": "Erkasa (origjinal, i gjeneruar me kod)",
                        "commercial": True, "attributionRequired": False},
        }
        (d / "asset.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(SCENES)} sfonde")


if __name__ == "__main__":
    main()
