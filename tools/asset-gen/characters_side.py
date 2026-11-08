"""Pamja anash (profili, me fytyrë nga e djathta) për personazhet e Erkasa.

Skeleti `erkasa_biped_side_v1`: këmbët dhe krahët janë zinxhirë të vendosur brenda njëri-tjetrit
(thigh ⊃ shin ⊃ foot, arm_upper ⊃ arm_lower ⊃ hand), kështu që një rrotullim i kofshës lëviz gjithë
këmbën. `_n` = ana afër kamerës, `_f` = ana larg (më e errët, vizatohet mbrapa trupit).
Për t'u kthyer majtas, motori e pasqyron (scaleX = -1).
"""
from __future__ import annotations

from characters import EXPRESSIONS, INK, MOUTH_STATES, EYE_STATES, Look

GROUND = (200, 872)


def _darken(hex_color: str, k: float = 0.82) -> str:
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return "#{:02X}{:02X}{:02X}".format(int(r * k), int(g * k), int(b * k))


# ---------------------------------------------------------------- fytyra në profil
def _eye(state: str, look: Look) -> str:
    cx, cy = 232, 126
    if state == "blink":
        return f'<path d="M{cx-8},{cy+1} Q{cx},{cy+4} {cx+7},{cy+1}" fill="none" stroke="{INK}" stroke-width="2.4" stroke-linecap="round"/>'
    if state == "happy":
        return f'<path d="M{cx-8},{cy+3} Q{cx},{cy-5} {cx+7},{cy+3}" fill="none" stroke="{INK}" stroke-width="2.6" stroke-linecap="round"/>'
    ry = {"surprised": 7.0, "sad": 4.4, "angry": 4.2}.get(state, 5.0)
    out = (f'<ellipse cx="{cx}" cy="{cy}" rx="6.5" ry="{ry}" fill="#FFFFFF"/>'
           f'<circle cx="{cx+2.5}" cy="{cy + (1 if state == "sad" else 0)}" r="3.4" fill="{look.iris}"/>'
           f'<circle cx="{cx+3}" cy="{cy}" r="1.7" fill="{INK}"/>'
           f'<path d="M{cx-7},{cy-ry+1.5} Q{cx},{cy-ry-2.5} {cx+7},{cy-ry+2}" fill="none" stroke="{INK}" stroke-width="2.2" stroke-linecap="round"/>')
    if look.lashes:
        out += f'<path d="M{cx+6},{cy-ry+2} l4,-3" stroke="{INK}" stroke-width="1.8" stroke-linecap="round"/>'
    return out


def _brow(state: str, look: Look) -> str:
    y_in, y_out = {"neutral": (110, 111), "happy": (107, 109), "sad": (106, 112), "surprised": (100, 103),
                   "angry": (116, 108), "thinking": (106, 103)}[state]
    col = look.hair if look.hair_style != "receding" else "#9A948C"
    t = 3.0 if look.lashes else 4.5
    return f'<path d="M222,{y_out} Q232,{min(y_in, y_out)-3} 243,{y_in} L242,{y_in+t} Q232,{min(y_in, y_out)+1} 222,{y_out+t} Z" fill="{col}"/>'


def _mouth(state: str, look: Look) -> str:
    m = look.lips
    return {
        "neutral": f'<path d="M238,172 Q245,174 250,171" fill="none" stroke="{m}" stroke-width="3" stroke-linecap="round"/>',
        "happy": f'<path d="M236,168 Q246,167 252,168 Q250,180 243,181 Q237,178 236,168 Z" fill="{m}"/><path d="M238,169 L251,169 L250,172 L238,172 Z" fill="#FFFFFF"/>',
        "sad": f'<path d="M238,175 Q245,170 250,174" fill="none" stroke="{m}" stroke-width="3" stroke-linecap="round"/>',
        "surprised": f'<ellipse cx="245" cy="175" rx="5" ry="7.5" fill="{m}"/>',
        "angry": f'<path d="M237,175 Q245,170 251,175" fill="none" stroke="{m}" stroke-width="3.2" stroke-linecap="round"/>',
        "thinking": f'<path d="M238,173 Q245,173 250,169" fill="none" stroke="{m}" stroke-width="3" stroke-linecap="round"/>',
        "talk_a": f'<path d="M236,169 Q245,167 252,169 Q250,181 243,182 Q237,180 236,169 Z" fill="{m}"/>',
        "talk_e": f'<path d="M237,170 Q245,168 251,170 Q249,176 243,177 Q238,176 237,170 Z" fill="{m}"/>',
        "talk_o": f'<ellipse cx="246" cy="174" rx="4.5" ry="5.5" fill="{m}"/>',
    }[state]


def _states(slot: str, states: list[str], render) -> str:
    groups = "".join(f'<g data-state="{s}"{"" if s == "neutral" else " display=\"none\""}>{render(s)}</g>' for s in states)
    return f'<g id="{slot}" data-slot="{slot}">{groups}</g>'


def _hair(look: Look) -> tuple[str, str]:
    """(pjesa mbrapa kokës, pjesa sipër) në profil."""
    h, hi = look.hair, look.hair_hi
    if look.hair_style == "long":
        back = f'<path d="M150,95 Q150,50 205,52 Q240,56 246,92 L220,92 Q190,94 178,120 Q172,190 186,268 Q150,262 136,240 Q140,170 150,95 Z" fill="{h}"/>'
        top = f'<path d="M156,98 Q160,54 210,54 Q246,60 250,104 Q236,84 210,84 Q182,86 170,110 Z" fill="{h}"/><path d="M190,62 Q220,56 240,74 Q216,66 196,70 Z" fill="{hi}"/>'
        return back, top
    if look.hair_style == "short_messy":
        top = (f'<path d="M152,128 Q146,74 176,58 L186,46 L196,56 L210,44 L218,58 L232,52 Q254,66 250,100 Q236,86 214,86 Q188,88 178,104 Q166,116 166,132 Z" fill="{h}"/>'
               f'<path d="M196,56 L210,44 L208,62 Z" fill="{hi}"/>')
        return "", top
    if look.hair_style == "receding":
        top = f'<path d="M154,140 Q148,108 160,90 Q172,82 182,86 Q172,100 172,140 Z" fill="{h}"/><path d="M170,76 Q196,64 222,72 Q200,70 184,80 Z" fill="{hi}"/>'
        return "", top
    top = (f'<path d="M152,130 Q144,70 190,52 Q230,44 250,74 Q254,86 248,98 Q232,82 208,84 Q184,86 174,104 Q166,116 168,134 Z" fill="{h}"/>'
           f'<path d="M180,58 Q214,44 244,64 Q218,58 198,64 Z" fill="{hi}"/>')
    return "", top


def _beard(look: Look) -> str:
    if look.beard == "full":
        return (f'<path d="M176,140 Q172,180 198,204 Q226,214 246,196 Q254,186 252,178 Q246,184 238,182 Q232,176 230,166 '
                f'L214,160 Q196,150 190,134 Z" fill="{look.beard_main}"/>'
                f'<path d="M232,164 Q244,158 254,164 Q248,168 238,168 Z" fill="{look.beard_sh}"/>')
    if look.beard == "moustache":
        return f'<path d="M232,163 Q244,157 255,164 Q250,170 240,168 Q234,168 232,163 Z" fill="{look.beard_main}"/>'
    return ""


def head_side(look: Look) -> str:
    back, top = _hair(look)
    face = ("M162,118 Q160,70 208,66 Q246,68 252,106 L254,118 Q262,138 266,146 Q262,150 255,151 L254,160 "
            "Q256,168 252,176 Q254,186 246,196 Q232,206 206,204 Q178,200 168,176 Q160,150 162,118 Z")
    glasses = ""
    if look.glasses:
        glasses = (f'<g id="glasses"><rect x="222" y="115" width="24" height="21" rx="7" fill="#FFFFFF" fill-opacity="0.15" stroke="{INK}" stroke-width="2.4"/>'
                   f'<path d="M222,123 L196,120" stroke="{INK}" stroke-width="2.4"/></g>')
    blush = f'<ellipse cx="224" cy="152" rx="9" ry="5" fill="#E58A7A" fill-opacity="0.35"/>' if look.blush else ""
    wrinkle = f'<path d="M214,96 Q232,90 246,98" fill="none" stroke="{look.skin_sh}" stroke-width="2" stroke-linecap="round"/>' if look.hair_style == "receding" else ""
    return (
        '<g id="head" data-pivot="200,212">'
        + back
        + f'<path id="face" d="{face}" fill="{look.skin}"/>'
        + f'<path d="M168,176 Q178,200 206,204 Q190,196 182,176 Z" fill="{look.skin_sh}" fill-opacity="0.6"/>'
        + f'<ellipse cx="190" cy="132" rx="11" ry="16" fill="{look.skin_sh}"/><path d="M186,126 Q192,132 188,140" fill="none" stroke="{_darken(look.skin_sh)}" stroke-width="2.5" stroke-linecap="round"/>'
        + wrinkle + blush + _beard(look)
        + _states("mouth", MOUTH_STATES, lambda s: _mouth(s, look))
        + _states("eyes", EYE_STATES, lambda s: _eye(s, look))
        + _states("brows", EXPRESSIONS, lambda s: _brow(s, look))
        + glasses
        + f'<g id="hair">{top}</g>'
        + "</g>"
    )


# ---------------------------------------------------------------- trupi në profil
def _arm(look: Look, side: str) -> str:
    far = side == "f"
    k = 0.8 if far else 1.0
    top_m = _darken(look.top_main, k) if far else look.top_main
    top_s = _darken(look.top_sh, k) if far else look.top_sh
    skin = _darken(look.skin, k) if far else look.skin
    skin_s = _darken(look.skin_sh, k) if far else look.skin_sh
    x = 200
    long_sleeve = look.top in ("hoodie", "cardigan")
    hand = (f'<g id="hand_{side}" data-pivot="{x},440"><path d="M{x-13},436 Q{x-15},462 {x-4},472 Q{x+8},476 {x+14},464 Q{x+16},450 {x+13},436 Z" fill="{skin}"/>'
            f'<path d="M{x+12},446 Q{x+20},456 {x+12},464" fill="none" stroke="{skin_s}" stroke-width="5" stroke-linecap="round"/></g>')
    if long_sleeve:
        fore = f'<rect x="{x-15}" y="334" width="30" height="104" rx="14" fill="{top_m}"/><rect x="{x-16}" y="422" width="32" height="16" rx="6" fill="{top_s}"/>'
    else:
        fore = f'<rect x="{x-13}" y="336" width="26" height="104" rx="13" fill="{skin}"/><rect x="{x-13}" y="350" width="8" height="80" rx="4" fill="{skin_s}" fill-opacity="0.7"/>'
        if look.watch and side == "n":
            fore += f'<rect x="{x-14}" y="418" width="28" height="11" rx="3" fill="#2B2B2E"/>'
    lower = f'<g id="arm_lower_{side}" data-pivot="{x},338">{fore}{hand}</g>'
    if look.top == "blouse":
        upper = (f'<rect x="{x-14}" y="250" width="28" height="96" rx="14" fill="{skin}"/>'
                 f'<rect x="{x-18}" y="226" width="36" height="62" rx="17" fill="{top_m}" stroke="{top_s}" stroke-width="1.5"/>')
    else:
        upper = f'<rect x="{x-17}" y="226" width="34" height="112" rx="16" fill="{top_m}" stroke="{top_s}" stroke-width="1.5"/>'
        if not long_sleeve:
            upper += f'<rect x="{x-19}" y="318" width="38" height="24" rx="9" fill="{top_s}"/>'
    return f'<g id="arm_upper_{side}" data-pivot="{x},240">{lower}{upper}</g>'


def _leg(look: Look, side: str) -> str:
    far = side == "f"
    k = 0.8 if far else 1.0
    p = _darken(look.pants, k) if far else look.pants
    ps = _darken(look.pants_sh, k) if far else look.pants_sh
    shoe = _darken(look.shoe_main, k) if far else look.shoe_main
    shoe_s = _darken(look.shoe_sh, k) if far else look.shoe_sh
    sole = look.sole
    x = 200
    top_y = {"boot": 812, "sneaker": 828, "shoe": 836}[look.shoes]
    stroke = ' stroke="#A79F93" stroke-width="2"' if look.shoes == "sneaker" else ""
    foot = (f'<g id="foot_{side}" data-pivot="{x},828">'
            f'<path d="M{x-24},{top_y} L{x+20},{top_y} L{x+22},836 Q{x+58},842 {x+62},856 L{x+62},864 L{x-26},864 Z" fill="{shoe}"{stroke}/>'
            f'<path d="M{x+22},838 Q{x+56},842 {x+60},856 L{x+40},856 Q{x+34},846 {x+20},844 Z" fill="{shoe_s}"/>'
            f'<rect x="{x-28}" y="862" width="92" height="10" rx="4" fill="{sole}"/></g>')
    shin = (f'<g id="shin_{side}" data-pivot="{x},642">'
            f'<path d="M{x-24},632 Q{x},622 {x+24},632 L{x+21},830 L{x-21},830 Z" fill="{p}"/>'
            f'<path d="M{x-24},640 L{x-21},828 L{x-12},828 L{x-14},640 Z" fill="{ps}"/>'
            + foot + "</g>")
    thigh = (f'<g id="thigh_{side}" data-pivot="{x},474">'
             f'<path d="M{x-28},462 L{x+28},462 Q{x+30},560 {x+25},650 Q{x},660 {x-25},650 Q{x-30},560 {x-28},462 Z" fill="{p}"/>'
             f'<path d="M{x-28},470 Q{x-30},560 {x-25},640 L{x-15},640 Q{x-18},560 {x-16},470 Z" fill="{ps}"/>'
             + shin + "</g>")
    return thigh


def _torso(look: Look) -> str:
    m, sh, dk = look.top_main, look.top_sh, look.top_dk
    base = (f'<path d="M172,226 Q178,212 206,212 Q236,214 242,236 Q250,300 244,340 Q240,392 236,436 L170,436 Q166,390 166,330 Q164,270 172,226 Z" '
            f'fill="{m}" stroke="{sh}" stroke-width="1.5"/>'
            f'<path d="M166,330 Q166,390 170,436 L184,436 Q180,380 180,300 Z" fill="{sh}" fill-opacity="0.8"/>')
    if look.top == "shirt":
        detail = (f'<path d="M222,214 L244,236 L226,258 Z" fill="{look.skin_sh}"/><path d="M220,214 L214,232 L236,250 Z" fill="{sh}"/>'
                  f'<path d="M236,252 Q242,340 236,432" fill="none" stroke="{dk}" stroke-width="2"/>')
    elif look.top == "blouse":
        detail = f'<path d="M214,214 Q232,230 242,232 L240,218 Z" fill="{look.skin_sh}"/>'
    elif look.top == "hoodie":
        detail = (f'<path d="M168,226 Q160,200 190,198 Q214,198 222,214 Q200,206 186,214 Q174,222 176,238 Z" fill="{sh}"/>'
                  f'<path d="M180,356 L240,356 L242,420 L184,420 Z" fill="{sh}"/><path d="M168,424 L238,424" stroke="{dk}" stroke-width="10"/>')
    else:
        detail = (f'<path d="M210,214 L240,232 Q248,320 238,436 L226,436 Q232,320 220,236 Z" fill="{look.inner or "#DCE6EE"}"/>'
                  f'<path d="M220,236 Q232,320 226,436" fill="none" stroke="{dk}" stroke-width="3"/>')
    belt = ""
    if look.top in ("shirt", "cardigan"):
        belt = f'<rect id="belt" x="168" y="428" width="72" height="14" rx="3" fill="#4B3427"/>'
    hips = f'<path id="hips" d="M170,434 L238,434 L234,492 Q200,500 172,492 Z" fill="{look.pants}"/>'
    return f'<g id="torso" data-pivot="200,430">{base}{detail}{belt}{hips}</g>'


def _neck(look: Look) -> str:
    return f'<g id="neck" data-pivot="200,222"><rect x="186" y="186" width="32" height="44" rx="8" fill="{look.skin_sh}"/></g>'


def side_svg(look: Look) -> str:
    # rendi: krahu larg → këmba larg → trupi → këmba afër → qafa → koka → krahu afër
    body = (f'<g id="{look.asset_id}_side" data-asset="{look.asset_id}">'
            + _arm(look, "f") + _leg(look, "f") + _torso(look) + _leg(look, "n") + _neck(look) + head_side(look) + _arm(look, "n")
            + "</g>")
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 880" width="400" height="880">{body}</svg>\n'


SIDE_BONES = [
    ("root", None, [200, 870], 0),
    ("arm_upper_f", "torso", [200, 240], 1), ("arm_lower_f", "arm_upper_f", [200, 338], 1), ("hand_f", "arm_lower_f", [200, 440], 1),
    ("thigh_f", "root", [200, 474], 2), ("shin_f", "thigh_f", [200, 642], 2), ("foot_f", "shin_f", [200, 828], 2),
    ("torso", "root", [200, 430], 3),
    ("thigh_n", "root", [200, 474], 4), ("shin_n", "thigh_n", [200, 642], 4), ("foot_n", "shin_n", [200, 828], 4),
    ("neck", "torso", [200, 222], 5),
    ("head", "neck", [200, 212], 6),
    ("arm_upper_n", "torso", [200, 240], 7), ("arm_lower_n", "arm_upper_n", [200, 338], 7), ("hand_n", "arm_lower_n", [200, 440], 7),
]


def side_rig(look: Look) -> dict:
    return {
        "schema": "erkasa.rig/1", "assetId": look.asset_id, "skeleton": "erkasa_biped_side_v1",
        "units": "px", "canvas": [400, 880], "ground": [GROUND[0], GROUND[1]],
        "bones": [{"id": b, "parent": p, "pivot": pv, "z": z, "svgGroup": b} for b, p, pv, z in SIDE_BONES],
        "slots": {"eyes": EYE_STATES, "brows": EXPRESSIONS, "mouth": MOUTH_STATES},
        "expressions": {e: {"eyes": e, "brows": e, "mouth": e} for e in EXPRESSIONS},
        "visemes": {"rest": "neutral", "A": "talk_a", "E": "talk_e", "I": "talk_e", "O": "talk_o", "U": "talk_o", "MBP": "neutral", "FV": "talk_e"},
        "limits": {"thigh_n": [-50, 40], "thigh_f": [-50, 40], "shin_n": [0, 110], "shin_f": [0, 110],
                   "arm_upper_n": [-120, 60], "arm_upper_f": [-120, 60], "arm_lower_n": [-130, 0], "arm_lower_f": [-130, 0], "head": [-15, 15]},
    }
