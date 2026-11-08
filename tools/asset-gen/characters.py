"""Gjeneratori i personazheve të Erkasa (stili erkasa_flat_v1).

Të gjithë personazhet ndajnë të njëjtin skelet (kockat dhe pikat e rrotullimit), ndaj
çdo veprim i shkruar për njërin funksionon për të gjithë. Ndryshojnë vetëm pamja:
lëkura, flokët, mjekra, syzet, veshjet dhe këpucët.

Çdo SVG përmban të gjitha gjendjet e fytyrës (sy, vetulla, gojë) si grupe me
data-state; vetëm `neutral` është e dukshme. Motori ndërron gjendjet gjatë animimit.

Output për secilin personazh në assets/characters/<id>/:
  asset.svg   - poza nga para, pjesët si grupe me id dhe data-pivot
  rig.json    - kockat, prindërit, pivot-et, rendi i vizatimit, gjendjet e fytyrës
  asset.json  - metadata për Asset Registry
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INK = "#2A1E18"

EXPRESSIONS = ["neutral", "happy", "sad", "surprised", "angry", "thinking"]
EYE_STATES = EXPRESSIONS + ["blink"]
MOUTH_STATES = EXPRESSIONS + ["talk_a", "talk_e", "talk_o"]


@dataclass
class Look:
    asset_id: str
    name: str
    description: str
    tags: list[str]
    skin: str
    skin_sh: str
    hair: str
    hair_hi: str
    hair_style: str               # swept | long | short_messy | receding
    top: str                      # shirt | blouse | hoodie | cardigan
    top_main: str
    top_sh: str
    top_dk: str
    pants: str
    pants_sh: str
    shoes: str                    # boot | sneaker | shoe
    shoe_main: str
    shoe_sh: str
    sole: str
    beard: str | None = None      # full | moustache | None
    beard_main: str = "#5B3A28"
    beard_sh: str = "#47291B"
    glasses: bool = False
    lashes: bool = False
    blush: bool = False
    lips: str = "#7A3B2E"
    iris: str = "#4C7A93"
    watch: bool = False
    inner: str | None = None      # ngjyra e këmishës nën kardigan
    extra_tags: list[str] = field(default_factory=list)


# ---------------------------------------------------------------- FYTYRA
def _eye_state(state: str, look: Look) -> str:
    out = []
    for cx in (180, 220):
        if state == "blink":
            out.append(f'<path d="M{cx-9},129 Q{cx},133 {cx+9},129" fill="none" stroke="{INK}" stroke-width="2.4" stroke-linecap="round"/>')
            continue
        if state == "happy":
            out.append(f'<path d="M{cx-9},131 Q{cx},122 {cx+9},131" fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round"/>')
            continue
        ry = {"surprised": 7.5, "sad": 4.6, "angry": 4.4}.get(state, 5.2)
        r = 3.2 if state == "surprised" else 3.8
        dx, dy = {"thinking": (-2, -2), "sad": (0, 1)}.get(state, (0, 0))
        out.append(f'<ellipse cx="{cx}" cy="128" rx="8.5" ry="{ry}" fill="#FFFFFF"/>')
        out.append(f'<circle cx="{cx+dx}" cy="{128+dy}" r="{r}" fill="{look.iris}"/>')
        out.append(f'<circle cx="{cx+dx}" cy="{128+dy}" r="{r*0.5:.1f}" fill="{INK}"/>')
        top_y = 128 - ry
        out.append(f'<path d="M{cx-9.5},{top_y+1.5} Q{cx},{top_y-2.5} {cx+9.5},{top_y+1.5}" fill="none" stroke="{INK}" stroke-width="2.2" stroke-linecap="round"/>')
        if look.lashes:
            ox = cx + (9 if cx > 200 else -9)
            sgn = 1 if cx > 200 else -1
            out.append(f'<path d="M{ox},{top_y+2} l{3*sgn},-4 M{ox-3*sgn},{top_y} l{2*sgn},-4" stroke="{INK}" stroke-width="1.8" stroke-linecap="round"/>')
    return "".join(out)


def _brow_state(state: str, look: Look) -> str:
    shapes = {
        "neutral": ((112, 113), (112, 113)), "happy": ((109, 111), (109, 111)),
        "sad": ((106, 114), (106, 114)), "surprised": ((101, 104), (101, 104)),
        "angry": ((118, 109), (118, 109)), "thinking": ((108, 104), (114, 113)),
    }
    (li, lo), (ri, ro) = shapes[state]
    t = 3.0 if look.lashes else 4.5   # vetulla më të holla te personazhet femra
    col = look.hair if look.hair_style != "receding" else "#9A948C"
    left = f'<path d="M168,{lo} Q178,{min(li, lo)-4} 191,{li} L190,{li+t} Q178,{min(li, lo)+1} 168,{lo+t-0.5} Z" fill="{col}"/>'
    right = f'<path d="M232,{ro} Q222,{min(ri, ro)-4} 209,{ri} L210,{ri+t} Q222,{min(ri, ro)+1} 232,{ro+t-0.5} Z" fill="{col}"/>'
    return left + right


def _mouth_state(state: str, look: Look) -> str:
    m = look.lips
    return {
        "neutral": f'<path d="M189,172 Q200,175.5 211,172" fill="none" stroke="{m}" stroke-width="3" stroke-linecap="round"/>',
        "happy": (f'<path d="M184,168 Q200,166 216,168 Q212,186 200,187 Q188,186 184,168 Z" fill="{m}"/>'
                  f'<path d="M186,169 Q200,167.5 214,169 L213,173 Q200,171.5 187,173 Z" fill="#FFFFFF"/>'),
        "sad": f'<path d="M189,176 Q200,169 211,176" fill="none" stroke="{m}" stroke-width="3" stroke-linecap="round"/>',
        "surprised": f'<ellipse cx="200" cy="176" rx="7" ry="9" fill="{m}"/>',
        "angry": (f'<path d="M188,176 Q200,170 212,176 L212,178 Q200,174 188,178 Z" fill="{m}"/>'),
        "thinking": f'<path d="M190,173 Q201,173 211,169" fill="none" stroke="{m}" stroke-width="3" stroke-linecap="round"/>',
        "talk_a": f'<path d="M187,169 Q200,167 213,169 Q209,183 200,184 Q191,183 187,169 Z" fill="{m}"/>',
        "talk_e": f'<path d="M188,170 Q200,168 212,170 Q208,177 200,178 Q192,177 188,170 Z" fill="{m}"/>',
        "talk_o": f'<ellipse cx="200" cy="174" rx="5.5" ry="6.5" fill="{m}"/>',
    }[state]


def _states(slot: str, states: list[str], render) -> str:
    groups = []
    for s in states:
        vis = "" if s == "neutral" else ' display="none"'
        groups.append(f'<g data-state="{s}"{vis}>{render(s)}</g>')
    return f'<g id="{slot}" data-slot="{slot}">' + "".join(groups) + "</g>"


def _hair_front(look: Look) -> str:
    h, hi = look.hair, look.hair_hi
    if look.hair_style == "swept":
        return (f'<path d="M147,124 Q138,62 186,48 Q224,40 248,58 Q266,76 254,124 Q250,104 244,94 Q232,78 206,80 '
                f'Q178,78 164,88 Q154,100 153,124 Z" fill="{h}"/>'
                f'<path d="M168,62 Q196,40 236,52 Q218,50 204,56 Q186,58 168,62 Z" fill="{hi}"/>'
                f'<path d="M150,90 Q144,70 158,60 Q152,76 156,92 Z" fill="{hi}"/>')
    if look.hair_style == "long":
        return (f'<path d="M146,140 Q136,60 196,52 Q258,54 256,132 Q250,98 232,86 Q214,96 186,92 Q164,94 156,112 Q150,124 152,146 Z" fill="{h}"/>'
                f'<path d="M232,86 Q246,104 250,128 Q240,100 226,92 Z" fill="{hi}"/>'
                f'<path d="M172,64 Q200,52 232,62 Q206,60 186,70 Z" fill="{hi}"/>')
    if look.hair_style == "short_messy":
        return (f'<path d="M148,122 Q140,70 168,56 L176,44 L186,54 L198,40 L208,54 L222,44 L226,58 Q258,66 254,122 '
                f'Q250,100 242,92 Q226,82 200,84 Q174,82 160,92 Q152,102 152,122 Z" fill="{h}"/>'
                f'<path d="M186,54 L198,40 L200,60 Z M208,54 L222,44 L218,62 Z" fill="{hi}"/>')
    # receding: tufa anash, pak flokë sipër
    return (f'<path d="M147,132 Q142,96 156,80 Q160,96 158,132 Z" fill="{h}"/>'
            f'<path d="M253,132 Q258,96 244,80 Q240,96 242,132 Z" fill="{h}"/>'
            f'<path d="M168,74 Q200,62 232,74 Q214,70 200,71 Q184,70 168,74 Z" fill="{hi}"/>')


def _hair_back(look: Look) -> str:
    if look.hair_style != "long":
        return ""
    return (f'<g id="hair_back" data-pivot="200,212" data-follows="head">'
            f'<path d="M142,110 Q136,60 200,56 Q264,60 258,110 Q264,200 270,262 Q236,282 200,276 Q164,282 130,262 Q136,200 142,110 Z" fill="{look.hair}"/>'
            f'<path d="M248,150 Q258,210 262,256 Q246,264 236,262 Q246,210 240,150 Z" fill="{look.hair_hi}" opacity="0.7"/></g>')


def _beard(look: Look) -> str:
    if look.beard == "full":
        b, bs = look.beard_main, look.beard_sh
        return (f'<g id="beard"><path d="M151,128 Q150,176 168,196 Q200,222 232,196 Q250,176 249,128 Q244,150 236,160 '
                f'Q226,166 214,163 Q200,158 186,163 Q174,166 164,160 Q156,150 151,128 Z" fill="{b}"/>'
                f'<path d="M176,163 Q190,152 200,156 Q210,152 224,163 Q214,168 200,165 Q186,168 176,163 Z" fill="{bs}"/>'
                f'<path d="M172,198 Q200,214 228,198 Q214,206 200,207 Q186,206 172,198 Z" fill="{bs}" opacity="0.7"/></g>')
    if look.beard == "moustache":
        return (f'<g id="beard"><path d="M178,164 Q190,154 200,158 Q210,154 222,164 Q226,170 218,168 Q208,164 200,166 '
                f'Q192,164 182,168 Q174,170 178,164 Z" fill="{look.beard_main}"/></g>')
    return ""


def head(look: Look) -> str:
    glasses = ""
    if look.glasses:
        glasses = (f'<g id="glasses"><rect x="167" y="117" width="27" height="22" rx="7" fill="#FFFFFF" fill-opacity="0.15" stroke="{INK}" stroke-width="2.4"/>'
                   f'<rect x="206" y="117" width="27" height="22" rx="7" fill="#FFFFFF" fill-opacity="0.15" stroke="{INK}" stroke-width="2.4"/>'
                   f'<path d="M194,126 Q200,122 206,126 M167,124 L153,121 M233,124 L247,121" fill="none" stroke="{INK}" stroke-width="2.2"/></g>')
    blush = ""
    if look.blush:
        blush = '<g id="blush"><ellipse cx="172" cy="150" rx="9" ry="5" fill="#E58A7A" opacity="0.35"/><ellipse cx="228" cy="150" rx="9" ry="5" fill="#E58A7A" opacity="0.35"/></g>'
    wrinkles = ""
    if look.hair_style == "receding":
        wrinkles = f'<path d="M176,96 Q200,90 224,96 M182,104 Q200,99 218,104" fill="none" stroke="{look.skin_sh}" stroke-width="2" stroke-linecap="round"/>'
    return (
        '<g id="head" data-pivot="200,212">'
        f'<g id="ears"><ellipse cx="149" cy="130" rx="9" ry="15" fill="{look.skin_sh}"/><ellipse cx="251" cy="130" rx="9" ry="15" fill="{look.skin_sh}"/></g>'
        f'<path id="face" d="M152,108 Q152,70 200,68 Q248,70 248,108 L248,150 Q247,196 200,201 Q153,196 152,150 Z" fill="{look.skin}"/>'
        f'<path d="M154,104 Q160,84 200,82 Q240,84 246,104 L246,96 Q236,78 200,77 Q164,78 154,96 Z" fill="{look.skin_sh}" opacity="0.5"/>'
        + wrinkles + blush + _beard(look)
        + _states("mouth", MOUTH_STATES, lambda s: _mouth_state(s, look))
        + f'<path id="nose" d="M201,124 Q198,140 191,149 Q200,154 209,149 Q204,142 203,124 Z" fill="{look.skin_sh}"/>'
        + _states("eyes", EYE_STATES, lambda s: _eye_state(s, look))
        + _states("brows", EXPRESSIONS, lambda s: _brow_state(s, look))
        + glasses
        + f'<g id="hair">{_hair_front(look)}</g>'
        + "</g>"
    )


# ---------------------------------------------------------------- TRUPI
def arm(look: Look, side: str) -> str:
    """Zinxhir: arm_upper ⊃ arm_lower ⊃ hand. Pivot-et janë të njëjta për të gjithë personazhet."""
    s = -1 if side == "l" else 1
    x = 200 + s * 78
    long_sleeve = look.top in ("hoodie", "cardigan")
    short_sleeve = look.top == "blouse"
    t_main, t_sh, t_dk = look.top_main, look.top_sh, look.top_dk

    hand = (f'<g id="hand_{side}" data-pivot="{x},440">'
            f'<path d="M{x-14},438 Q{x-17},462 {x-6},472 Q{x+4},478 {x+12},468 Q{x+17},452 {x+14},438 Z" fill="{look.skin}"/>'
            f'<path d="M{x + s*13},444 Q{x + s*20},456 {x + s*14},464" fill="none" stroke="{look.skin_sh}" stroke-width="5" stroke-linecap="round"/></g>')
    if long_sleeve:
        fore = (f'<rect x="{x-16}" y="334" width="32" height="104" rx="15" fill="{t_main}"/>'
                f'<rect x="{x-16 if s<0 else x+4}" y="346" width="12" height="80" rx="6" fill="{t_sh}"/>'
                f'<rect x="{x-17}" y="422" width="34" height="16" rx="6" fill="{t_dk}"/>')
    else:
        fore = (f'<rect x="{x-14}" y="336" width="28" height="104" rx="14" fill="{look.skin}"/>'
                f'<rect x="{x-14 if s<0 else x+4}" y="350" width="10" height="80" rx="5" fill="{look.skin_sh}" opacity="0.7"/>')
        if look.watch and side == "l":
            fore += f'<rect x="{x-15}" y="418" width="30" height="11" rx="3" fill="#2B2B2E"/>'
    lower = f'<g id="arm_lower_{side}" data-pivot="{x},338">{fore}{hand}</g>'

    if short_sleeve:
        upper_shapes = (f'<rect x="{x-15}" y="250" width="30" height="96" rx="15" fill="{look.skin}"/>'
                        f'<rect x="{x-19}" y="226" width="38" height="62" rx="17" fill="{t_main}" stroke="{t_sh}" stroke-width="1.5"/>'
                        f'<rect x="{x-19 if s<0 else x+7}" y="236" width="12" height="44" rx="6" fill="{t_sh}" opacity="0.8"/>')
    else:
        upper_shapes = (f'<rect x="{x-18}" y="226" width="36" height="112" rx="17" fill="{t_main}" stroke="{t_sh}" stroke-width="1.5"/>'
                        f'<rect x="{x-18 if s<0 else x+6}" y="240" width="12" height="90" rx="6" fill="{t_sh}" opacity="0.7"/>')
        if not long_sleeve:  # mëngë të përveshura
            upper_shapes += (f'<rect x="{x-20}" y="318" width="40" height="24" rx="9" fill="{t_sh}"/>'
                             f'<path d="M{x-20},328 L{x+20},328" stroke="{t_dk}" stroke-width="1.5"/>')
    return f'<g id="arm_{side}"><g id="arm_upper_{side}" data-pivot="{x},238">{lower}{upper_shapes}</g></g>'


def leg(look: Look, side: str) -> str:
    s = -1 if side == "l" else 1
    x, o = 200 + s * 28, s
    p, ps = look.pants, look.pants_sh
    thigh = (f'<g id="thigh_{side}" data-pivot="{x},476">'
             f'<path d="M{x-28},462 L{x+28},462 Q{x+29},560 {x+24},648 Q{x},658 {x-24},648 Q{x-29},560 {x-28},462 Z" fill="{p}"/>'
             f'<path d="M{x + o*28},470 Q{x + o*29},560 {x + o*24},640 L{x + o*14},640 Q{x + o*18},560 {x + o*16},470 Z" fill="{ps}"/></g>')
    shin = (f'<g id="shin_{side}" data-pivot="{x},640">'
            f'<path d="M{x-25},632 Q{x},622 {x+25},632 L{x+22},828 L{x-22},828 Z" fill="{p}"/>'
            f'<path d="M{x + o*25},640 L{x + o*22},826 L{x + o*13},826 L{x + o*15},640 Z" fill="{ps}"/>'
            f'<path d="M{x-19},800 Q{x},810 {x+19},800" fill="none" stroke="{ps}" stroke-width="4" stroke-linecap="round"/>'
            f'<path d="M{x-16},654 Q{x},664 {x+12},654" fill="none" stroke="{ps}" stroke-width="3" stroke-linecap="round"/></g>')
    heel, toe = x - s * 24, x + s * 46
    top_y = {"boot": 814, "sneaker": 830, "shoe": 838}[look.shoes]
    m, sh = look.shoe_main, look.shoe_sh
    foot = (f'<g id="foot_{side}" data-pivot="{x},826">'
            f'<path d="M{x - s*22},{top_y} L{heel},864 L{toe},864 L{toe},854 Q{x + s*42},{max(top_y, 836)} {x + s*22},{max(top_y, 832)} L{x + s*22},{top_y} Z" fill="{m}"{' stroke="#A79F93" stroke-width="2"' if look.shoes == "sneaker" else ""}/>'
            f'<path d="M{x + s*22},{max(top_y, 832)} Q{x + s*42},{max(top_y, 836)} {toe},854 L{x + s*30},854 Q{x + s*24},846 {x + s*12},{max(top_y, 842)} Z" fill="{sh}"/>'
            f'<rect x="{min(heel, toe)-2}" y="{860 if look.shoes == "sneaker" else 862}" width="{abs(toe - heel)+4}" '
            f'height="{12 if look.shoes == "sneaker" else 10}" rx="4" fill="{look.sole}"/>')
    if look.shoes == "boot":
        foot += f'<path d="M{x-21},822 L{x+21},822" stroke="{sh}" stroke-width="3"/>'
    if look.shoes == "sneaker":
        foot += f'<path d="M{x + s*4},842 l{s*10},-4 M{x + s*10},848 l{s*10},-4" stroke="{sh}" stroke-width="2.5" stroke-linecap="round"/>'
    foot += "</g>"
    return f'<g id="leg_{side}">{thigh}{shin}{foot}</g>'


def torso(look: Look) -> str:
    m, sh, dk = look.top_main, look.top_sh, look.top_dk
    base = (f'<path d="M128,234 Q148,216 182,214 L218,214 Q252,216 272,234 L266,330 Q263,388 262,436 L138,436 '
            f'Q137,388 134,330 Z" fill="{m}" stroke="{sh}" stroke-width="1.5"/>'
            f'<path d="M134,330 Q137,388 138,436 L156,436 Q150,380 148,300 Z" fill="{sh}" opacity="0.8"/>')
    if look.top == "shirt":
        detail = (f'<path d="M184,214 L200,262 L216,214 Z" fill="{look.skin_sh}"/>'
                  f'<path d="M182,214 L172,236 L200,266 L186,222 Z" fill="{sh}"/><path d="M218,214 L228,236 L200,266 L214,222 Z" fill="{sh}"/>'
                  f'<path d="M200,266 L200,432" stroke="{dk}" stroke-width="2"/>'
                  + "".join(f'<circle cx="205" cy="{y}" r="2.6" fill="{dk}"/>' for y in (290, 330, 370, 410)))
    elif look.top == "blouse":
        detail = (f'<path d="M180,214 Q200,240 220,214 Z" fill="{look.skin_sh}"/>'
                  f'<path d="M178,214 Q200,246 222,214" fill="none" stroke="{dk}" stroke-width="2.5"/>'
                  f'<path d="M140,300 Q200,316 260,300" fill="none" stroke="{sh}" stroke-width="3"/>')
    elif look.top == "hoodie":
        detail = (f'<path d="M168,214 Q200,236 232,214 Q226,232 200,240 Q174,232 168,214 Z" fill="{dk}"/>'
                  f'<path d="M190,236 L188,286 M210,236 L212,286" stroke="#F3EDE4" stroke-width="3" stroke-linecap="round"/>'
                  f'<path d="M158,360 L242,360 L250,420 L150,420 Z" fill="{sh}"/>'
                  f'<path d="M150,424 L250,424" stroke="{dk}" stroke-width="10"/>')
    else:  # cardigan mbi këmishë
        inner = look.inner or "#DCE6EE"
        detail = (f'<path d="M176,214 L224,214 L214,436 L186,436 Z" fill="{inner}"/>'
                  f'<path d="M184,214 L200,250 L216,214 Z" fill="{look.skin_sh}"/>'
                  f'<path d="M184,214 L176,232 L200,254 Z M216,214 L224,232 L200,254 Z" fill="#C9D6E0"/>'
                  f'<path d="M176,214 L190,300 L186,436 M224,214 L210,300 L214,436" fill="none" stroke="{dk}" stroke-width="3"/>'
                  + "".join(f'<circle cx="190" cy="{y}" r="3" fill="{dk}"/>' for y in (320, 360, 400))
                  + f'<rect x="146" y="350" width="30" height="24" rx="4" fill="{sh}"/>')
    belt = ""
    if look.top in ("shirt", "cardigan"):
        belt = f'<rect id="belt" x="138" y="428" width="124" height="14" rx="3" fill="#4B3427"/><rect x="192" y="429" width="16" height="12" rx="2" fill="#B08A4E"/>'
    hips = f'<path id="hips" d="M139,434 L261,434 L258,490 Q200,498 142,490 Z" fill="{look.pants}"/>'
    hood = ""
    if look.top == "hoodie":
        hood = f'<path d="M160,222 Q160,196 200,196 Q240,196 240,222 L232,226 Q226,208 200,208 Q174,208 168,226 Z" fill="{sh}"/>'
    return f'<g id="torso" data-pivot="200,430">{base}{detail}{belt}{hips}{hood}</g>'


def neck(look: Look) -> str:
    shade = look.beard_sh if look.beard == "full" else look.skin_sh
    return (f'<g id="neck" data-pivot="200,222"><rect x="183" y="186" width="34" height="42" rx="8" fill="{look.skin_sh}"/>'
            f'<path d="M184,200 Q200,214 216,200 L216,190 L184,190 Z" fill="{shade}" opacity="0.5"/></g>')


def character_svg(look: Look) -> str:
    # rendi: këmbët → flokët mbrapa → torso → qafa → krahët → koka
    body = (f'<g id="{look.asset_id}" data-asset="{look.asset_id}">'
            + leg(look, "l") + leg(look, "r") + _hair_back(look) + torso(look) + neck(look)
            + arm(look, "l") + arm(look, "r") + head(look) + "</g>")
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 880" width="400" height="880">{body}</svg>\n'


# ---------------------------------------------------------------- RIG + METADATA
BONES = [
    # id, prindi, pivot, z (rendi)
    ("root", None, [200, 870], 0),
    ("hips", "root", [200, 476], 1),
    ("thigh_l", "hips", [172, 476], 2), ("shin_l", "thigh_l", [172, 640], 3), ("foot_l", "shin_l", [172, 826], 4),
    ("thigh_r", "hips", [228, 476], 2), ("shin_r", "thigh_r", [228, 640], 3), ("foot_r", "shin_r", [228, 826], 4),
    ("torso", "hips", [200, 430], 6),
    ("neck", "torso", [200, 222], 7),
    ("arm_upper_l", "torso", [122, 238], 8), ("arm_lower_l", "arm_upper_l", [122, 338], 8), ("hand_l", "arm_lower_l", [122, 440], 8),
    ("arm_upper_r", "torso", [278, 238], 8), ("arm_lower_r", "arm_upper_r", [278, 338], 8), ("hand_r", "arm_lower_r", [278, 440], 8),
    ("head", "neck", [200, 212], 9),
]


def rig_json(look: Look) -> dict:
    bones = [{"id": b, "parent": p, "pivot": pv, "z": z, "svgGroup": b} for b, p, pv, z in BONES]
    if look.hair_style == "long":
        bones.append({"id": "hair_back", "parent": "head", "pivot": [200, 212], "z": 5, "svgGroup": "hair_back"})
    return {
        "schema": "erkasa.rig/1", "assetId": look.asset_id, "skeleton": "erkasa_biped_front_v1",
        "units": "px", "canvas": [400, 880], "ground": [200, 872],
        "bones": bones,
        "slots": {"eyes": EYE_STATES, "brows": EXPRESSIONS, "mouth": MOUTH_STATES},
        "expressions": {e: {"eyes": e, "brows": e, "mouth": e} for e in EXPRESSIONS},
        "visemes": {"rest": "neutral", "A": "talk_a", "E": "talk_e", "I": "talk_e", "O": "talk_o", "U": "talk_o",
                    "MBP": "neutral", "FV": "talk_e"},
        "limits": {"arm_upper_l": [-30, 170], "arm_upper_r": [-170, 30], "arm_lower_l": [-10, 150],
                   "arm_lower_r": [-150, 10], "head": [-15, 15], "thigh_l": [-40, 40], "thigh_r": [-40, 40],
                   "shin_l": [0, 90], "shin_r": [-90, 0]},
    }


def asset_json(look: Look) -> dict:
    return {
        "schema": "erkasa.asset/1", "assetId": look.asset_id, "version": 1, "name": look.name,
        "description": look.description,
        "category": "character", "subcategory": "human", "kind": "rigged_character", "adapter": "character",
        "style": "erkasa_flat_v1",
        "files": {"svg": "asset.svg", "rig": "rig.json", "svg_side": "asset_side.svg", "rig_side": "rig_side.json"},
        "viewBox": [0, 0, 400, 880],
        "capabilities": {
            "facings": ["front", "left", "right"],
            "actions": {
                "front": ["idle", "talk", "wave", "point_side", "point_side_left", "think", "arms_up", "nod", "shake_head"],
                "side": ["idle", "walk", "run", "talk", "point_forward", "jump"],
            },
            "actionsPlanned": ["sit", "hold_object"],
            "expressions": EXPRESSIONS,
            "visemes": "erkasa8",
            "canHold": [],
        },
        "anchors": {"ground": [0.5, 0.99], "head": "bone:head", "hand_l": "bone:hand_l", "hand_r": "bone:hand_r"},
        "sizing": {"heightRatio": 0.42},
        "themes": ["psychology", "money", "growth", "philosophy", "science", "decisions"],
        "tags": look.tags + look.extra_tags,
        "license": {"spdx": "LicenseRef-Erkasa-Original", "source": "Erkasa (origjinal, i gjeneruar me kod)",
                    "commercial": True, "attributionRequired": False},
    }


LOOKS = [
    Look("char_drini_01", "Drini", "Burrë rreth 35 vjeç, mjekër e plotë, këmishë e bardhë me mëngë të përveshura.",
         ["male", "adult", "beard", "casual"],
         skin="#E9B892", skin_sh="#D49A74", hair="#4A2E1F", hair_hi="#5E3B28", hair_style="swept",
         top="shirt", top_main="#F6F3EE", top_sh="#DCD6CB", top_dk="#C3BBAE",
         pants="#3A342F", pants_sh="#2C2723", shoes="boot", shoe_main="#7A4A2A", shoe_sh="#5E3820", sole="#2E211A",
         beard="full", watch=True),
    Look("char_era_01", "Era", "Grua rreth 30 vjeç, flokë të gjata, bluzë ngjyrë jeshile-blu.",
         ["female", "adult", "long-hair", "casual"],
         skin="#F1C6A6", skin_sh="#DDA584", hair="#2F1E17", hair_hi="#4A3226", hair_style="long",
         top="blouse", top_main="#2F8F8A", top_sh="#26746F", top_dk="#1D5C58",
         pants="#E3D7C4", pants_sh="#CDBFA8", shoes="shoe", shoe_main="#8A5A3C", shoe_sh="#6B4329", sole="#3A2A20",
         lashes=True, blush=True, lips="#B4544C", iris="#5A7A4C"),
    Look("char_arti_01", "Arti", "Djalë rreth 20 vjeç, flokë të shkurtra, hoodie portokalli, xhinse.",
         ["male", "young", "student", "casual"],
         skin="#C98F68", skin_sh="#B07652", hair="#1F1714", hair_hi="#3A2A22", hair_style="short_messy",
         top="hoodie", top_main="#E8833A", top_sh="#CC6F2C", top_dk="#A95A22",
         pants="#3E5C82", pants_sh="#304A6B", shoes="sneaker", shoe_main="#F4F2EE", shoe_sh="#C9C4BB", sole="#8E877C",
         lips="#7A3B2E", iris="#5A4030"),
    Look("char_bardhi_01", "Bardhi", "Burrë rreth 70 vjeç, flokë të thinjura, mustaqe, syze, kardigan.",
         ["male", "elder", "glasses", "wise"],
         skin="#E5B08E", skin_sh="#CC9370", hair="#C9C4BC", hair_hi="#E2DED8", hair_style="receding",
         top="cardigan", top_main="#8C5E3C", top_sh="#734B2F", top_dk="#5C3B24",
         pants="#6E6A66", pants_sh="#58554F", shoes="shoe", shoe_main="#3A2A20", shoe_sh="#261B14", sole="#1A1310",
         beard="moustache", beard_main="#D8D3CC", glasses=True, inner="#DCE6EE", iris="#5C6E7A"),
]


# ---------------------------------------------------------------- TURMA
CROWD_COLORS = [("a", "#E8833A"), ("b", "#2F8F8A"), ("c", "#6C7A89"), ("d", "#C2554D"), ("e", "#8E6BB0"), ("f", "#D9A441")]


def crowd_svg(body_color: str) -> str:
    skin = "#E2B08C"
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 260" width="120" height="260">'
            '<g id="crowd_person">'
            f'<g id="body" data-pivot="60,250"><path d="M18,250 L22,140 Q24,104 60,102 Q96,104 98,140 L102,250 Z" fill="{body_color}"/>'
            f'<path d="M22,140 Q24,104 60,102 L60,250 L18,250 Z" fill="#000" opacity="0.08"/></g>'
            f'<g id="head" data-pivot="60,98"><circle cx="60" cy="62" r="34" fill="{skin}"/>'
            '<path d="M26,58 Q28,26 60,26 Q92,26 94,58 Q86,40 60,40 Q34,40 26,58 Z" fill="#3A2A22"/></g>'
            '</g></svg>\n')


# ---------------------------------------------------------------- MAIN
def main() -> None:
    from characters_side import side_rig, side_svg  # noqa: PLC0415 (circular: side imports Look from here)

    out_root = ROOT / "assets" / "characters"
    for look in LOOKS:
        d = out_root / look.asset_id
        d.mkdir(parents=True, exist_ok=True)
        (d / "asset.svg").write_text(character_svg(look))
        (d / "rig.json").write_text(json.dumps(rig_json(look), indent=2, ensure_ascii=False) + "\n")
        (d / "asset_side.svg").write_text(side_svg(look))
        (d / "rig_side.json").write_text(json.dumps(side_rig(look), indent=2, ensure_ascii=False) + "\n")
        (d / "asset.json").write_text(json.dumps(asset_json(look), indent=2, ensure_ascii=False) + "\n")

    d = out_root / "char_crowd_01"
    d.mkdir(parents=True, exist_ok=True)
    for key, color in CROWD_COLORS:
        (d / f"variant_{key}.svg").write_text(crowd_svg(color))
    meta = {
        "schema": "erkasa.asset/1", "assetId": "char_crowd_01", "version": 1, "name": "Figurë turme",
        "description": "Figurë e thjeshtë për turma dhe grupe; 6 variante ngjyrash.",
        "category": "character", "subcategory": "crowd", "kind": "crowd_figure", "adapter": "svg",
        "style": "erkasa_flat_v1", "files": {"svg": "variant_a.svg"},
        "variants": {k: f"variant_{k}.svg" for k, _ in CROWD_COLORS},
        "viewBox": [0, 0, 120, 260],
        "capabilities": {"animations": ["pop_in", "fade", "bob", "turn_color", "highlight", "shrink"]},
        "anchors": {"ground": [0.5, 0.96]},
        "themes": ["psychology", "decisions", "money"], "tags": ["crowd", "group", "society", "people", "herd"],
        "license": {"spdx": "LicenseRef-Erkasa-Original", "source": "Erkasa (origjinal, i gjeneruar me kod)",
                    "commercial": True, "attributionRequired": False},
    }
    (d / "asset.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(LOOKS)} personazhe + turma")


if __name__ == "__main__":
    main()
