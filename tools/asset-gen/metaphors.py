"""Metaforat vizuale të animueshme (stili erkasa_flat_v1).

Çdo metaforë është një SVG me pjesë të emërtuara (<g id=... data-pivot=...>).
`parts` te asset.json thotë si lëviz secila pjesë, që Visual Planner dhe kompilatori
ta përdorin pa shpikur komanda.
"""
from __future__ import annotations

import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INK, CREAM = "#2A1E18", "#F6F3EE"
TEAL, ORANGE, RED, YELLOW, BLUE = "#2F8F8A", "#E8833A", "#C2554D", "#E3B66B", "#3E5F86"
SKY, GREEN, DGREEN, GREY, BROWN, PURPLE = "#8FCBEA", "#62A06C", "#4F8A5B", "#9AA0A6", "#8C6A4F", "#8E6BB0"


def g(gid, content, pivot=None, extra=""):
    pv = f' data-pivot="{pivot[0]},{pivot[1]}"' if pivot else ""
    return f'<g id="{gid}"{pv} {extra}>{content}</g>'


def gear(cx, cy, r, teeth, color, hole=CREAM):
    pts = []
    for i in range(teeth * 4):
        a = 2 * math.pi * i / (teeth * 4)
        rr = r * 1.18 if i % 4 in (1, 2) else r
        pts.append(f"{cx + rr * math.cos(a):.1f},{cy + rr * math.sin(a):.1f}")
    return f'<polygon points="{" ".join(pts)}" fill="{color}"/><circle cx="{cx}" cy="{cy}" r="{r*0.38:.1f}" fill="{hole}"/>'


# ---------------------------------------------------------------- 1 ajsbergu
def iceberg():
    body = (
        '<defs><linearGradient id="ice_sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3E8DB5"/><stop offset="1" stop-color="#1B3E5C"/></linearGradient></defs>'
        f'<rect width="800" height="300" fill="#DDF1FB"/>'
        + g("water", '<rect y="300" width="800" height="500" fill="url(#ice_sea)"/>'
            '<path d="M0,300 Q50,290 100,300 T200,300 T300,300 T400,300 T500,300 T600,300 T700,300 T800,300" fill="none" stroke="#BFE6F2" stroke-width="6"/>')
        + g("underwater", '<polygon points="230,300 150,440 175,610 300,735 480,760 615,645 660,470 575,300" fill="#BFE3F0" opacity="0.55"/>'
            '<polygon points="400,300 575,300 660,470 615,645 480,760 430,600" fill="#9FCFE3" opacity="0.5"/>', (400, 520))
        + g("tip", '<polygon points="300,300 352,205 405,150 455,212 500,300" fill="#FFFFFF"/>'
            '<polygon points="405,150 455,212 500,300 420,300" fill="#DCEFF7"/>', (400, 300))
    )
    parts = {"tip": "pop_in, bob", "underwater": "reveal (fade_in or camera tilt down)", "water": "wave"}
    return "Ajsbergu", body, (800, 800), parts, ["psychology", "science", "philosophy"], ["subconscious", "hidden", "iceberg", "visible-vs-hidden"]


# ---------------------------------------------------------------- 2 kukulla me fije
def puppet():
    wood, wd = "#D9A66B", "#BC8A52"
    body = (
        g("control", f'<rect x="230" y="110" width="340" height="22" rx="8" fill="{BROWN}"/><rect x="389" y="60" width="22" height="130" rx="8" fill="{BROWN}"/>', (400, 121))
        + g("strings", f'<path d="M240,121 L272,470 M560,121 L528,470 M400,190 L400,355 M300,121 L345,700 M500,121 L455,700" stroke="{INK}" stroke-width="2" opacity="0.7"/>',
            None, 'data-dynamic="lines"')
        + g("puppet_leg_l", f'<rect x="335" y="590" width="26" height="120" rx="12" fill="{wd}"/>', (348, 590))
        + g("puppet_leg_r", f'<rect x="439" y="590" width="26" height="120" rx="12" fill="{wd}"/>', (452, 590))
        + g("puppet_body", f'<rect x="325" y="440" width="150" height="170" rx="40" fill="{RED}"/><rect x="325" y="560" width="150" height="40" rx="14" fill="#A8473F"/>', (400, 600))
        + g("puppet_arm_l", f'<rect x="262" y="450" width="70" height="24" rx="12" fill="{wd}" transform="rotate(35 330 462)"/>', (330, 462))
        + g("puppet_arm_r", f'<rect x="468" y="450" width="70" height="24" rx="12" fill="{wd}" transform="rotate(-35 470 462)"/>', (470, 462))
        + g("puppet_head", f'<circle cx="400" cy="395" r="52" fill="{wood}"/><circle cx="382" cy="390" r="6" fill="{INK}"/><circle cx="418" cy="390" r="6" fill="{INK}"/>'
            f'<path d="M386,414 Q400,422 414,414" fill="none" stroke="{INK}" stroke-width="4" stroke-linecap="round"/>', (400, 440))
    )
    parts = {"control": "rotate ±15 (komanda)", "puppet_arm_l": "rotate", "puppet_arm_r": "rotate",
             "puppet_head": "tilt", "puppet_leg_l": "rotate", "puppet_leg_r": "rotate",
             "strings": "dynamic lines: control ends -> limb anchors"}
    return "Kukulla me fije", body, (800, 760), parts, ["psychology", "philosophy", "decisions"], ["manipulation", "control", "influence", "puppet"]


# ---------------------------------------------------------------- 3 labirinti
def maze():
    n, cell, ox = 8, 80, 80
    rng = random.Random(5)
    walls = {(x, y, d) for x in range(n) for y in range(n) for d in "NESW"}
    seen, stack = {(0, 0)}, [(0, 0)]
    moves = {"N": (0, -1, "S"), "S": (0, 1, "N"), "E": (1, 0, "W"), "W": (-1, 0, "E")}
    parent = {(0, 0): None}
    while stack:
        x, y = stack[-1]
        opts = [(d, x + dx, y + dy, o) for d, (dx, dy, o) in moves.items() if 0 <= x + dx < n and 0 <= y + dy < n and (x + dx, y + dy) not in seen]
        if not opts:
            stack.pop()
            continue
        d, nx, ny, o = rng.choice(opts)
        walls.discard((x, y, d)), walls.discard((nx, ny, o))
        seen.add((nx, ny)), stack.append((nx, ny))
        parent[(nx, ny)] = (x, y)
    lines = []
    for x, y, d in walls:
        x0, y0 = ox + x * cell, ox + y * cell
        seg = {"N": (x0, y0, x0 + cell, y0), "S": (x0, y0 + cell, x0 + cell, y0 + cell),
               "W": (x0, y0, x0, y0 + cell), "E": (x0 + cell, y0, x0 + cell, y0 + cell)}[d]
        if (x, y, d) in ((0, 0, "W"), (n - 1, n - 1, "E")):
            continue
        lines.append("M{},{} L{},{}".format(*seg))
    node, route = (n - 1, n - 1), []
    while node:
        route.append(node)
        node = parent[node]
    route.reverse()
    pts = " ".join(f"{ox + x*cell + cell/2:.0f},{ox + y*cell + cell/2:.0f}" for x, y in route)
    gx, gy = ox + (n - 1) * cell + cell / 2, ox + (n - 1) * cell + cell / 2
    body = (
        f'<rect width="800" height="800" fill="{CREAM}"/>'
        + g("walls", f'<path d="{" ".join(lines)}" stroke="{BLUE}" stroke-width="12" stroke-linecap="round"/>')
        + g("solution", f'<polyline points="{pts}" fill="none" stroke="{ORANGE}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>',
            None, 'data-animate="draw_on"')
        + g("runner", f'<circle cx="{ox + cell/2}" cy="{ox + cell/2}" r="20" fill="{RED}"/>', (ox + cell / 2, ox + cell / 2))
        + g("goal", f'<rect x="{gx-3}" y="{gy-34}" width="6" height="50" fill="{INK}"/><path d="M{gx+3},{gy-34} l40,12 l-40,12 Z" fill="{GREEN}"/>', (gx, gy + 16))
    )
    parts = {"solution": "draw_on (rruga e zgjidhjes)", "runner": "follow solution path", "goal": "wave", "walls": "static"}
    return "Labirinti", body, (800, 800), parts, ["philosophy", "decisions", "growth"], ["maze", "complexity", "solution", "lost"]


# ---------------------------------------------------------------- 4 udhëkryqi
def crossroads():
    body = (
        '<rect width="900" height="420" fill="#DDF1FB"/><rect y="400" width="900" height="400" fill="#8CC07F"/>'
        '<path d="M0,420 Q200,380 450,400 T900,390 V440 H0 Z" fill="#7FB27A"/>'
        + g("road_left", '<path d="M380,800 C380,640 300,520 120,430 L160,425 C330,500 430,620 450,800 Z" fill="#D9B98C"/>')
        + g("road_right", '<path d="M520,800 C520,640 600,520 780,430 L740,425 C570,500 470,620 450,800 Z" fill="#D9B98C"/>')
        + g("post", f'<rect x="438" y="300" width="24" height="420" rx="6" fill="{BROWN}"/>')
        + g("sign_left", f'<path d="M440,330 H270 L230,365 L270,400 H440 Z" fill="{ORANGE}"/><path d="M300,365 H410" stroke="{CREAM}" stroke-width="10" stroke-linecap="round"/>', (450, 365))
        + g("sign_right", f'<path d="M460,430 H630 L670,465 L630,500 H460 Z" fill="{TEAL}"/><path d="M490,465 H600" stroke="{CREAM}" stroke-width="10" stroke-linecap="round"/>', (450, 465))
    )
    parts = {"sign_left": "swing_in, highlight", "sign_right": "swing_in, highlight", "road_left": "highlight", "road_right": "highlight"}
    return "Udhëkryqi", body, (900, 800), parts, ["decisions", "philosophy", "growth"], ["choice", "fork", "path", "crossroads"]


# ---------------------------------------------------------------- 5 dominot
def dominoes():
    ground, out = 400, ""
    for i in range(7):
        x = 120 + i * 115
        s = 0.8 + i * 0.07
        w, h = 50 * s, 190 * s
        dots = "".join(f'<circle cx="{x + w/2 + dx*w*0.25:.0f}" cy="{ground - h + dy*h*0.12:.0f}" r="{4*s:.1f}" fill="{CREAM}"/>'
                       for dx, dy in [(-1, 1.5), (1, 1.5), (0, 3), (-1, 5.5), (1, 5.5), (0, 7)])
        out += g(f"domino_{i+1}", f'<rect x="{x:.0f}" y="{ground-h:.0f}" width="{w:.0f}" height="{h:.0f}" rx="6" fill="{INK}"/>'
                 f'<rect x="{x:.0f}" y="{ground-h/2-2:.0f}" width="{w:.0f}" height="4" fill="{CREAM}"/>' + dots, (x + w, ground))
    body = f'<rect width="1000" height="500" fill="{CREAM}"/><rect y="{ground}" width="1000" height="100" fill="#E4DDD0"/>' + out
    parts = {f"domino_{i+1}": "fall: rotate 0→78 around pivot, i * 0.12s delay" for i in range(7)}
    return "Dominot", body, (1000, 500), parts, ["decisions", "psychology", "science"], ["chain-reaction", "consequences", "domino-effect", "habits"]


# ---------------------------------------------------------------- 6 topi i borës
def snowball():
    body = (
        f'<rect width="1000" height="700" fill="#CFE8F5"/>'
        '<polygon points="0,180 1000,620 1000,700 0,700" fill="#FFFFFF"/><polygon points="0,180 1000,620 1000,640 0,200" fill="#E3F0F7"/>'
        + g("trail", '<path d="M120,236 L880,570" stroke="#D3E6F0" stroke-width="40" stroke-linecap="round"/>', None, 'data-animate="draw_on"')
        + g("ball", f'<circle cx="0" cy="0" r="85" fill="#FFFFFF" stroke="#A9CADB" stroke-width="6"/><path d="M-30,-20 q20,-12 40,4 M-10,24 q18,6 34,-10" stroke="#D3E6F0" stroke-width="6" fill="none" stroke-linecap="round"/>',
            (0, 0), 'transform="translate(800,455)"')
    )
    parts = {"ball": "move along slope (120,190)→(880,500), scale 0.3→1.6, rotate 0→720", "trail": "draw_on"}
    return "Topi i borës", body, (1000, 700), parts, ["money", "growth", "decisions"], ["compound-interest", "snowball", "momentum", "growth"]


# ---------------------------------------------------------------- 7 farë → pemë
def seed_to_tree():
    gy = 470
    stages = [
        ("stage_seed", 150, f'<path d="M95,{gy+2} Q150,{gy-40} 205,{gy+2} Z" fill="#7A5A40"/><ellipse cx="150" cy="{gy-24}" rx="20" ry="13" fill="#D9A66B" stroke="#8C6A4F" stroke-width="3"/>'),
        ("stage_sprout", 400, f'<path d="M400,{gy} V{gy-60}" stroke="{DGREEN}" stroke-width="8" stroke-linecap="round"/>'
         f'<ellipse cx="380" cy="{gy-70}" rx="24" ry="12" fill="{GREEN}" transform="rotate(-30 380 {gy-70})"/>'
         f'<ellipse cx="420" cy="{gy-70}" rx="24" ry="12" fill="{GREEN}" transform="rotate(30 420 {gy-70})"/>'),
        ("stage_plant", 640, f'<path d="M640,{gy} V{gy-150}" stroke="{DGREEN}" stroke-width="12" stroke-linecap="round"/>'
         + "".join(f'<ellipse cx="{640+dx}" cy="{gy+dy}" rx="40" ry="18" fill="{GREEN}" transform="rotate({r} {640+dx} {gy+dy})"/>'
                   for dx, dy, r in [(-38, -80, -30), (38, -105, 30), (-34, -135, -25), (34, -160, 25)])),
        ("stage_tree", 850, f'<rect x="836" y="{gy-170}" width="28" height="170" rx="10" fill="{BROWN}"/>'
         f'<circle cx="850" cy="{gy-250}" r="100" fill="{DGREEN}"/><circle cx="792" cy="{gy-200}" r="70" fill="{GREEN}"/><circle cx="910" cy="{gy-210}" r="70" fill="{GREEN}"/>'
         f'<circle cx="820" cy="{gy-300}" r="12" fill="{RED}"/><circle cx="885" cy="{gy-250}" r="12" fill="{RED}"/><circle cx="800" cy="{gy-225}" r="12" fill="{RED}"/>'),
    ]
    body = (f'<rect width="1000" height="600" fill="#EAF5FB"/><rect y="{gy}" width="1000" height="130" fill="#8C6A4F"/><rect y="{gy}" width="1000" height="16" fill="#6FA86C"/>'
            + "".join(g(sid, c, (x, gy)) for sid, x, c in stages))
    parts = {s: "grow_in (scaleY 0→1 from pivot); sequence or same-spot morph" for s, _, _ in stages}
    return "Nga fara te pema", body, (1000, 600), parts, ["growth", "money", "science"], ["growth", "patience", "compounding", "stages"]


# ---------------------------------------------------------------- 8 shkallët
def stairs():
    steps = "".join(g(f"step_{i+1}", f'<rect x="{80+i*110}" y="{660-(i+1)*85}" width="{720-i*110}" height="85" fill="{c}"/>', (80 + i * 110, 660))
                    for i, c in enumerate([BLUE, "#4A6E96", "#5C80A8", "#6E91B7", "#82A3C6", "#98B6D4"]))
    fx, fy = 690, 660 - 6 * 85
    body = (f'<rect width="800" height="760" fill="{CREAM}"/><rect y="660" width="800" height="100" fill="#E4DDD0"/>' + steps
            + g("flag", f'<rect x="{fx}" y="{fy-150}" width="8" height="150" fill="{INK}"/><path d="M{fx+8},{fy-150} l90,25 l-90,25 Z" fill="{ORANGE}"/>', (fx + 4, fy)))
    parts = {**{f"step_{i+1}": "pop_in in sequence (0.15s)" for i in range(6)}, "flag": "wave"}
    return "Shkallët", body, (800, 760), parts, ["growth", "money", "decisions"], ["progress", "steps", "levels", "climb"]


# ---------------------------------------------------------------- 9 mali me flamur
def mountain_flag():
    body = (
        '<rect width="800" height="800" fill="#FBE3BE"/><circle cx="640" cy="180" r="70" fill="#FFF1C9"/>'
        f'<polygon points="60,760 400,140 740,760" fill="#7F93AE"/><polygon points="400,140 740,760 520,760 430,300" fill="#6C7F99"/>'
        '<polygon points="400,140 455,240 420,225 395,255 365,228 345,240" fill="#FFFFFF"/>'
        + g("path", '<polyline points="200,740 470,640 280,540 470,440 330,350 430,260 400,170" fill="none" stroke="#F6E2B8" stroke-width="10" stroke-dasharray="18 14" stroke-linecap="round"/>',
            None, 'data-animate="draw_on"')
        + g("climber", f'<circle cx="200" cy="722" r="16" fill="{RED}"/>', (200, 722))
        + g("flag", f'<rect x="397" y="60" width="7" height="85" fill="{INK}"/><path d="M404,60 l70,20 l-70,20 Z" fill="{RED}"/>', (400, 145))
        + '<rect y="760" width="800" height="40" fill="#8CC07F"/>'
    )
    parts = {"path": "draw_on", "climber": "follow path", "flag": "pop_in, wave"}
    return "Mali me flamur", body, (800, 800), parts, ["growth", "decisions"], ["goal", "journey", "summit", "achievement"]


# ---------------------------------------------------------------- 10 peshorja
def balance():
    def pan(cx, gid):
        return g(gid, f'<path d="M{cx},210 L{cx-70},380 M{cx},210 L{cx+70},380" stroke="{GREY}" stroke-width="4"/>'
                 f'<path d="M{cx-100},380 Q{cx},450 {cx+100},380 Z" fill="{YELLOW}"/>', (cx, 210), 'data-hangs-from="beam"')
    body = (f'<rect width="800" height="700" fill="{CREAM}"/>'
            f'<rect x="388" y="190" width="24" height="420" rx="8" fill="{BROWN}"/><rect x="290" y="600" width="220" height="40" rx="14" fill="{BROWN}"/>'
            + g("beam", f'<rect x="170" y="196" width="460" height="26" rx="13" fill="{BROWN}"/><circle cx="400" cy="209" r="22" fill="{YELLOW}"/>', (400, 209))
            + pan(180, "pan_l") + pan(620, "pan_r"))
    parts = {"beam": "tilt ±20", "pan_l": "stay hanging at beam left end", "pan_r": "stay hanging at beam right end"}
    return "Peshorja", body, (800, 700), parts, ["philosophy", "decisions", "money"], ["tradeoff", "balance", "justice", "compare"]


# ---------------------------------------------------------------- 11 dy dyert
def two_doors():
    def door(x, color, gid):
        return (f'<rect x="{x-14}" y="186" width="248" height="434" rx="10" fill="#5E4836"/>'
                f'<rect x="{x}" y="200" width="220" height="420" fill="#FFE7A8"/>'
                + g(gid, f'<rect x="{x}" y="200" width="220" height="420" fill="{color}"/><rect x="{x+24}" y="226" width="172" height="160" rx="6" fill="#000" opacity="0.1"/>'
                    f'<rect x="{x+24}" y="410" width="172" height="180" rx="6" fill="#000" opacity="0.1"/><circle cx="{x+190}" cy="420" r="12" fill="{YELLOW}"/>', (x, 410)))
    body = f'<rect width="900" height="700" fill="#E9DFD0"/><rect y="620" width="900" height="80" fill="#C99B6D"/>' + door(140, TEAL, "door_l") + door(540, ORANGE, "door_r")
    parts = {"door_l": "open: scaleX 1→0.15 around hinge pivot", "door_r": "open: scaleX 1→0.15 around hinge pivot"}
    return "Dy dyert", body, (900, 700), parts, ["decisions", "philosophy"], ["choice", "opportunity", "door", "unknown"]


# ---------------------------------------------------------------- 12 ora e rërës
def hourglass():
    sand = "#E3B66B"
    body = (
        f'<rect width="500" height="800" fill="{CREAM}"/>'
        + g("frame",
            f'<rect x="90" y="80" width="320" height="34" rx="12" fill="{BROWN}"/><rect x="90" y="686" width="320" height="34" rx="12" fill="{BROWN}"/>'
            f'<rect x="110" y="114" width="16" height="572" fill="#6B4A33"/><rect x="374" y="114" width="16" height="572" fill="#6B4A33"/>'
            '<path d="M140,114 C140,300 236,360 240,400 C236,440 140,500 140,686 H360 C360,500 264,440 260,400 C264,360 360,300 360,114 Z" fill="#DDF1FB" opacity="0.8" stroke="#9FCFE3" stroke-width="5"/>'
            + g("sand_top", f'<path d="M165,200 H335 C330,290 262,350 250,385 C238,350 170,290 165,200 Z" fill="{sand}"/>', (250, 385))
            + g("stream", f'<rect x="247" y="385" width="6" height="220" fill="{sand}"/>')
            + g("sand_bottom", f'<path d="M150,686 C170,620 220,595 250,595 C280,595 330,620 350,686 Z" fill="{sand}"/>', (250, 686)),
            (250, 400))
    )
    parts = {"sand_top": "scaleY 1→0 (pivot neck)", "sand_bottom": "scaleY 0→1 (pivot base)", "stream": "flicker", "frame": "flip rotate 180"}
    return "Ora e rërës", body, (500, 800), parts, ["philosophy", "growth", "decisions"], ["time", "deadline", "mortality", "patience"]


# ---------------------------------------------------------------- 13 zona e rehatisë
def comfort_zone():
    body = (
        f'<rect width="800" height="800" fill="{CREAM}"/>'
        + g("zone_outer", f'<circle cx="400" cy="400" r="350" fill="{GREEN}" opacity="0.18"/><circle cx="400" cy="400" r="350" fill="none" stroke="{GREEN}" stroke-width="6" stroke-dasharray="20 14"/>', (400, 400))
        + g("zone_mid", f'<circle cx="400" cy="400" r="230" fill="{YELLOW}" opacity="0.35"/>', (400, 400))
        + g("zone_inner", f'<circle cx="400" cy="400" r="115" fill="{BLUE}" opacity="0.55"/>', (400, 400))
        + g("person", f'<circle cx="400" cy="372" r="18" fill="{INK}"/><path d="M372,440 Q372,396 400,396 Q428,396 428,440 Z" fill="{INK}"/>', (400, 440))
    )
    parts = {"zone_inner": "pop_in", "zone_mid": "pop_in", "zone_outer": "pop_in, rotate dashed ring", "person": "move outward"}
    return "Zona e rehatisë", body, (800, 800), parts, ["growth", "psychology"], ["comfort-zone", "fear", "learning", "growth-zone"]


# ---------------------------------------------------------------- 14 koka me ingranazhe
def brain_gears():
    head = ("M300,720 L300,620 C220,600 170,520 175,430 C180,300 280,190 420,190 C560,190 650,290 650,400 "
            "C650,450 680,480 700,520 C710,540 690,550 670,555 L665,600 C660,630 640,645 610,640 L560,632 L560,720 Z")
    body = (f'<rect width="800" height="800" fill="#EAF5FB"/>' + f'<path d="{head}" fill="{BLUE}"/>'
            + g("gear_1", gear(360, 380, 70, 10, ORANGE, BLUE), (360, 380))
            + g("gear_2", gear(480, 300, 48, 8, YELLOW, BLUE), (480, 300))
            + g("gear_3", gear(500, 450, 40, 7, TEAL, BLUE), (500, 450)))
    parts = {"gear_1": "rotate cw", "gear_2": "rotate ccw ×1.45", "gear_3": "rotate ccw ×1.75"}
    return "Koka me ingranazhe", body, (800, 800), parts, ["psychology", "science", "philosophy"], ["thinking", "mind", "process", "logic"]


# ---------------------------------------------------------------- 15 zinxhiri që këputet
def chain_break():
    metal, ms = "#9AA0A6", "#7E848A"
    out = ""
    for i in range(6):
        x = 110 + i * 140
        if i == 3:
            out += g("spark", f'<path d="M{x-5},150 l-12,-30 M{x+10},146 l4,-34 M{x+24},152 l18,-26 M{x-5},250 l-12,30 M{x+10},254 l4,34 M{x+24},248 l18,26" stroke="{ORANGE}" stroke-width="6" stroke-linecap="round"/>', (x, 200))
            out += g("link_break_l", f'<path d="M{x-60},200 A60,40 0 0 1 {x-14},160" fill="none" stroke="{metal}" stroke-width="22" stroke-linecap="round"/>'
                     f'<path d="M{x-60},200 A60,40 0 0 0 {x-14},240" fill="none" stroke="{ms}" stroke-width="22" stroke-linecap="round"/>', (x - 30, 200))
            out += g("link_break_r", f'<path d="M{x+36},160 A60,40 0 0 1 {x+80},200 A60,40 0 0 1 {x+36},240" fill="none" stroke="{metal}" stroke-width="22" stroke-linecap="round"/>', (x + 40, 200))
        elif i % 2 == 0:
            out += g(f"link_{i+1}", f'<ellipse cx="{x}" cy="200" rx="80" ry="44" fill="none" stroke="{metal}" stroke-width="22"/>', (x, 200))
        else:
            out += g(f"link_{i+1}", f'<rect x="{x-80}" y="189" width="160" height="22" rx="11" fill="{ms}"/>', (x, 200))
    body = f'<rect width="1000" height="400" fill="{CREAM}"/>' + out
    parts = {"spark": "flash", "link_break_l": "fly left + rotate", "link_break_r": "fly right + rotate", **{f"link_{i+1}": "shake" for i in range(6) if i != 3}}
    return "Zinxhiri që këputet", body, (1000, 400), parts, ["psychology", "growth", "philosophy"], ["freedom", "breaking-habits", "liberation", "chains"]


METAPHORS = [
    ("met_iceberg_01", iceberg), ("met_puppet_01", puppet), ("met_maze_01", maze), ("met_crossroads_01", crossroads),
    ("met_dominoes_01", dominoes), ("met_snowball_01", snowball), ("met_seed_to_tree_01", seed_to_tree),
    ("met_stairs_01", stairs), ("met_mountain_flag_01", mountain_flag), ("met_balance_01", balance),
    ("met_two_doors_01", two_doors), ("met_hourglass_01", hourglass), ("met_comfort_zone_01", comfort_zone),
    ("met_brain_gears_01", brain_gears), ("met_chain_break_01", chain_break),
]


def main() -> None:
    out_root = ROOT / "assets" / "metaphors"
    for asset_id, fn in METAPHORS:
        name, body, (w, h), parts, themes, tags = fn()
        d = out_root / asset_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "asset.svg").write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><g id="{asset_id}">{body}</g></svg>\n')
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1, "name": name,
            "category": "metaphor", "kind": "animated_metaphor", "adapter": "svg",
            "style": "erkasa_flat_v1", "files": {"svg": "asset.svg"}, "viewBox": [0, 0, w, h],
            "parts": parts,
            "capabilities": {"animations": ["pop_in", "fade"] + sorted({p.split(":")[0].split(" ")[0].strip(",") for p in parts.values()})},
            "anchors": {"center": [0.5, 0.5]},
            "themes": themes, "tags": tags,
            "license": {"spdx": "LicenseRef-Erkasa-Original", "source": "Erkasa (origjinal, i gjeneruar me kod)",
                        "commercial": True, "attributionRequired": False},
        }
        (d / "asset.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(METAPHORS)} metafora")


if __name__ == "__main__":
    main()
