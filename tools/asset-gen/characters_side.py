"""Pamja anash (profili, me fytyrë nga e djathta) për personazhet e Erkasa.

Skeleti `erkasa_biped_side_v1`: këmbët dhe krahët janë zinxhirë të vendosur brenda njëri-tjetrit
(thigh ⊃ shin ⊃ foot, arm_upper ⊃ arm_lower ⊃ hand), kështu që një rrotullim i kofshës lëviz gjithë
këmbën. `_n` = ana afër kamerës, `_f` = ana larg (më e errët, vizatohet mbrapa trupit).
Për t'u kthyer majtas, motori e pasqyron (scaleX = -1).
"""
from __future__ import annotations

from characters import EXPRESSIONS, EYE_STATES, INK, ITEMS, MOUTH_STATES, Look, item_slot

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
    if look.hair_style == "bob":
        back = f'<path d="M150,95 Q150,50 205,52 Q244,56 248,96 L224,94 Q196,96 184,118 Q178,160 186,206 Q156,204 140,190 Q138,140 150,95 Z" fill="{h}"/>'
        top = f'<path d="M156,98 Q160,54 210,54 Q248,60 252,108 Q236,86 210,86 Q182,88 170,112 Z" fill="{h}"/><path d="M190,62 Q220,56 240,74 Q216,66 196,70 Z" fill="{hi}"/>'
        return back, top
    if look.hair_style == "buzz":
        top = f'<path d="M156,124 Q152,72 200,60 Q238,56 250,90 Q234,80 210,80 Q182,82 172,104 Q164,114 164,128 Z" fill="{h}"/>'
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
    wrinkle = f'<path d="M214,96 Q232,90 246,98" fill="none" stroke="{look.skin_sh}" stroke-width="2" stroke-linecap="round"/>' if (look.hair_style == "receding" or look.age_lines) else ""
    if look.age_lines:
        wrinkle += f'<path d="M236,150 Q230,162 236,174" fill="none" stroke="{look.skin_sh}" stroke-width="2.4" stroke-linecap="round"/>'
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
        + f'<g id="hair">{top}{_crown(look)}{_hat(look)}</g>'
        + "</g>"
    )


def _crown(look: Look) -> str:
    if look.crown == "king":
        return ('<polygon points="164,70 166,26 184,50 204,14 222,48 242,24 246,70" fill="#E3B66B"/>'
                '<rect x="160" y="58" width="90" height="20" rx="5" fill="#C9963E"/><circle cx="204" cy="12" r="7" fill="#F7D98A"/>'
                '<circle cx="186" cy="68" r="5" fill="#C2554D"/><circle cx="222" cy="68" r="5" fill="#3E5F86"/>')
    if look.crown == "queen":
        return ('<path d="M170,66 L178,44 L192,58 L206,32 L220,56 L234,42 L240,66 Z" fill="#E3B66B"/>'
                '<rect x="168" y="60" width="74" height="12" rx="5" fill="#C9963E"/><circle cx="206" cy="30" r="6" fill="#F7D98A"/>')
    return ""


def _hat(look: Look) -> str:
    """Kapelet e kostumeve në profil (të njëjtat si në pamjen ballore)."""
    c = look.hat_color
    dk = _darken(c, 0.78)
    if look.hat == "chef":
        return ('<rect x="160" y="52" width="94" height="30" rx="6" fill="#F4F1EA"/>'
                '<path d="M160,60 Q146,28 174,22 Q184,0 208,6 Q234,0 240,22 Q268,28 254,60 Z" fill="#FFFFFF"/>'
                '<rect x="160" y="74" width="94" height="8" rx="3" fill="#E2DED6"/>')
    if look.hat == "cap":
        return (f'<path d="M158,92 Q154,46 206,42 Q252,46 254,92 Z" fill="{c}"/>'
                f'<path d="M246,86 Q280,84 290,96 Q270,100 244,96 Z" fill="{dk}"/>')
    if look.hat == "circlet":
        return ('<path d="M166,76 L176,58 L188,72 L200,54 L212,70 L224,56 L238,74 Z" fill="#E3B66B"/>'
                '<rect x="164" y="70" width="80" height="10" rx="4" fill="#C9963E"/>')
    if look.hat == "helmet":
        return (f'<path d="M156,114 Q152,46 208,40 Q262,46 260,112 L252,112 Q250,70 208,66 Q166,70 164,114 Z" fill="{c}"/>'
                f'<rect x="250" y="96" width="9" height="46" rx="3" fill="{dk}"/>')
    if look.hat == "tall_hat":
        return (f'<rect x="168" y="6" width="78" height="78" rx="8" fill="{c}"/>'
                f'<rect x="158" y="74" width="100" height="12" rx="5" fill="{dk}"/>'
                f'<rect x="168" y="60" width="78" height="12" fill="#E3B66B"/>')
    return ""


def _dress(look: Look) -> str:
    """Fundi i gjatë në profil, në dy vizatime që motori i shfaq sipas pozës (`garmentForPose`):
    - `dress_standing`: varet nga trupi (ndjek torson), i hapur poshtë; këmbët lëvizin poshtë tij kur ecën;
    - `dress_seated`: ndjek kofshën e afërt dhe, brenda saj, kërcirin: palohet mbi gjunjë kur ulet."""
    if not look.skirt:
        return ""
    hem, m, sh, dk = look.skirt, look.top_main, look.top_sh, look.top_dk
    flare = 34 + (hem - 700) * 0.42          # sa hapet fundi poshtë: fustani i gjatë më shumë se toga
    l, r = 168 - flare, 238 + flare * 0.9
    trim = ""
    if look.top == "robe":
        trim = (f'<path d="M{l - 2:.0f},{hem - 18} L{r + 2:.0f},{hem - 18} L{r + 2:.0f},{hem} Q200,{hem + 10} {l - 2:.0f},{hem} Z" fill="#F4F1EA"/>'
                + "".join(f'<circle cx="{x:.0f}" cy="{hem - 8}" r="3.5" fill="#2A1E18"/>' for x in (l + 24, 200, r - 24)))
    elif look.top == "toga":
        trim = f'<path d="M{l:.0f},{hem - 2} Q200,{hem + 8} {r:.0f},{hem - 2}" fill="none" stroke="{dk}" stroke-width="7"/>'
    standing = (f'<path d="M166,430 L240,430 L{r:.0f},{hem} Q200,{hem + 10} {l:.0f},{hem} Z" fill="{m}"/>'
                f'<path d="M166,430 L180,430 L{l + 22:.0f},{hem + 4} L{l:.0f},{hem} Z" fill="{sh}"/>'
                f'<path d="M212,470 Q{226 + flare * 0.2:.0f},{(470 + hem) / 2:.0f} {214 + flare * 0.5:.0f},{hem - 6}" fill="none" stroke="{dk}" stroke-width="3" stroke-opacity="0.45"/>'
                f'<path d="M190,480 Q{184 - flare * 0.2:.0f},{(480 + hem) / 2:.0f} {186 - flare * 0.5:.0f},{hem - 6}" fill="none" stroke="{dk}" stroke-width="3" stroke-opacity="0.35"/>'
                + trim)
    lower = (f'<path d="M163,630 L239,630 L{252},{hem} Q200,{hem + 10} {148},{hem} Z" fill="{m}"/>'
             f'<path d="M163,630 L176,630 L162,{hem + 4} L148,{hem} Z" fill="{sh}"/>'
             f'<path d="M216,650 Q222,{(650 + hem) / 2:.0f} 230,{hem - 6}" fill="none" stroke="{dk}" stroke-width="3" stroke-opacity="0.45"/>')
    if look.top == "robe":
        lower += (f'<path d="M146,{hem - 18} L254,{hem - 18} L254,{hem} Q200,{hem + 10} 146,{hem} Z" fill="#F4F1EA"/>'
                  + "".join(f'<circle cx="{x}" cy="{hem - 8}" r="3.5" fill="#2A1E18"/>' for x in (170, 206, 238)))
    elif look.top == "toga":
        lower += f'<path d="M148,{hem - 2} Q200,{hem + 8} 252,{hem - 2}" fill="none" stroke="{dk}" stroke-width="7"/>'
    upper = (f'<path d="M166,462 L238,462 L241,650 L161,650 Z" fill="{m}"/>'
             f'<path d="M166,462 L178,462 L172,650 L161,650 Z" fill="{sh}"/>')
    return (f'<g id="dress_standing" data-pivot="200,430" data-follows="torso">{standing}</g>'
            f'<g id="dress_seated" data-pivot="200,474" data-follows="thigh_n">{upper}'
            f'<g id="dress_lower" data-pivot="200,642" data-follows="shin_n">{lower}</g></g>')


# ---------------------------------------------------------------- trupi në profil
def _arm(look: Look, side: str) -> str:
    far = side == "f"
    k = 0.8 if far else 1.0
    top_m = _darken(look.top_main, k) if far else look.top_main
    top_s = _darken(look.top_sh, k) if far else look.top_sh
    skin = _darken(look.skin, k) if far else look.skin
    skin_s = _darken(look.skin_sh, k) if far else look.skin_sh
    x = 200
    long_sleeve = look.top in ("hoodie", "cardigan", "suit", "blazer", "robe")
    cuff = (look.inner or "#F6F3EE") if look.top in ("suit", "blazer") else "#F4F1EA" if look.top == "robe" else top_s
    hand = (f'<g id="hand_{side}" data-pivot="{x},440">' + (item_slot(x) if side == "n" else "") + f'<path d="M{x-13},436 Q{x-15},462 {x-4},472 Q{x+8},476 {x+14},464 Q{x+16},450 {x+13},436 Z" fill="{skin}"/>'
            f'<path d="M{x+12},446 Q{x+20},456 {x+12},464" fill="none" stroke="{skin_s}" stroke-width="5" stroke-linecap="round"/></g>')
    if long_sleeve:
        fore = f'<rect x="{x-15}" y="334" width="30" height="104" rx="14" fill="{top_m}"/><rect x="{x-16}" y="422" width="32" height="16" rx="6" fill="{cuff}"/>'
    else:
        fore = f'<rect x="{x-13}" y="336" width="26" height="104" rx="13" fill="{skin}"/><rect x="{x-13}" y="350" width="8" height="80" rx="4" fill="{skin_s}" fill-opacity="0.7"/>'
        if look.watch and side == "n":
            fore += f'<rect x="{x-14}" y="418" width="28" height="11" rx="3" fill="#2B2B2E"/>'
    lower = f'<g id="arm_lower_{side}" data-pivot="{x},338">{fore}{hand}</g>'
    if look.top in ("blouse", "tshirt", "toga"):
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
    top_y = {"boot": 812, "sneaker": 828, "shoe": 836, "sandal": 842}[look.shoes]
    stroke = ' stroke="#A79F93" stroke-width="2"' if look.shoes == "sneaker" else ""
    foot = (f'<g id="foot_{side}" data-pivot="{x},828">'
            f'<path d="M{x-24},{top_y} L{x+20},{top_y} L{x+22},836 Q{x+58},842 {x+62},856 L{x+62},864 L{x-26},864 Z" fill="{shoe}"{stroke}/>'
            f'<path d="M{x+22},838 Q{x+56},842 {x+60},856 L{x+40},856 Q{x+34},846 {x+20},844 Z" fill="{shoe_s}"/>'
            f'<rect x="{x-28}" y="862" width="92" height="10" rx="4" fill="{sole}"/>'
            + (f'<path d="M{x-18},846 L{x+40},850 M{x+10},842 L{x+18},862" stroke="#6B4F3A" stroke-width="5" stroke-linecap="round"/>' if look.shoes == "sandal" else "")
            + '</g>')
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
    elif look.top == "suit":
        tie = look.tie or "#7A2E3A"
        detail = (f'<path d="M212,214 L242,232 Q247,280 242,316 L226,316 Q226,270 218,236 Z" fill="{look.inner or "#F6F3EE"}"/>'
                  f'<path d="M222,214 L244,236 L228,250 Z" fill="{look.skin_sh}"/>'
                  f'<path d="M236,236 L244,240 Q248,280 244,322 L236,330 L232,322 Q238,280 236,240 Z" fill="{tie}"/>'
                  f'<path d="M210,214 L230,240 L222,250 L234,316 L222,318 Q214,270 206,232 Z" fill="{sh}"/>'
                  f'<path d="M226,320 Q238,380 236,436" fill="none" stroke="{dk}" stroke-width="2"/>'
                  f'<circle cx="236" cy="372" r="4" fill="{dk}"/><path d="M182,388 L212,388" stroke="{dk}" stroke-width="3" stroke-linecap="round"/>')
    elif look.top == "tshirt":
        detail = f'<path d="M214,214 Q230,226 240,226 L238,214 Z" fill="{look.skin_sh}"/><path d="M212,214 Q230,232 242,228" fill="none" stroke="{dk}" stroke-width="5"/>'
    elif look.top == "blazer":
        detail = (f'<path d="M212,214 L242,232 Q247,280 242,316 L226,316 Q226,270 218,236 Z" fill="{look.inner or "#F6F3EE"}"/>'
                  f'<path d="M222,214 L244,236 L228,250 Z" fill="{look.skin_sh}"/>'
                  f'<path d="M210,214 L230,240 L222,250 L234,316 L222,318 Q214,270 206,232 Z" fill="{sh}"/>'
                  f'<path d="M226,320 Q238,380 236,436" fill="none" stroke="{dk}" stroke-width="2"/><circle cx="236" cy="372" r="4" fill="{dk}"/>')
    elif look.top == "toga":
        detail = (f'<path d="M214,214 Q230,226 240,226 L238,214 Z" fill="{look.skin_sh}"/>'
                  f'<path d="M176,220 Q200,212 214,216 L240,420 L222,436 Z" fill="{sh}"/>'
                  f'<path d="M186,226 L232,410 M200,220 L240,380" fill="none" stroke="{dk}" stroke-width="4" opacity="0.6"/>')
    elif look.top == "robe":
        detail = (f'<path d="M216,214 Q236,222 244,236 Q250,320 240,436 L222,436 Q228,320 214,236 Z" fill="#F4F1EA"/>'
                  + "".join(f'<circle cx="{x}" cy="{y}" r="3.5" fill="#2A1E18"/>' for x, y in ((228, 270), (232, 330), (230, 400)))
                  + '<path d="M172,236 Q206,256 240,240" fill="none" stroke="#E3B66B" stroke-width="6"/>')
    else:
        detail = (f'<path d="M210,214 L240,232 Q248,320 238,436 L226,436 Q232,320 220,236 Z" fill="{look.inner or "#DCE6EE"}"/>'
                  f'<path d="M220,236 Q232,320 226,436" fill="none" stroke="{dk}" stroke-width="3"/>')
    if look.patches:
        detail += f'<rect x="182" y="350" width="30" height="28" rx="3" fill="{dk}" transform="rotate(-6 197 364)"/>'
    belt = ""
    if look.top in ("shirt", "cardigan", "tshirt"):
        belt = f'<rect id="belt" x="168" y="428" width="72" height="14" rx="3" fill="#4B3427"/>'
    hips = f'<path id="hips" d="M170,434 L238,434 L234,492 Q200,500 172,492 Z" fill="{look.pants}"/>'
    if look.top in ("robe", "toga"):
        hips += f'<path d="M166,428 L242,428 L238,496 Q200,504 170,496 Z" fill="{m}"/>'
    if look.top in ("suit", "blazer"):  # jacket hem over the hips
        hips += f'<path d="M166,428 L240,428 L240,470 L168,472 Z" fill="{m}"/><path d="M166,428 L168,472 L180,472 L178,428 Z" fill="{sh}" fill-opacity="0.8"/>'
    return f'<g id="torso" data-pivot="200,430">{base}{detail}{belt}{hips}</g>'


def _neck(look: Look) -> str:
    return f'<g id="neck" data-pivot="200,222"><rect x="186" y="186" width="32" height="44" rx="8" fill="{look.skin_sh}"/></g>'


def side_svg(look: Look) -> str:
    # rendi: krahu larg → këmba larg → trupi → këmba afër → qafa → koka → krahu afër
    body = (f'<g id="{look.asset_id}_side" data-asset="{look.asset_id}">'
            + _arm(look, "f") + _leg(look, "f") + _torso(look) + _leg(look, "n") + _dress(look) + _neck(look) + head_side(look) + _arm(look, "n")
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
        "slots": {"eyes": EYE_STATES, "brows": EXPRESSIONS, "mouth": MOUTH_STATES, "item": ["neutral"] + ITEMS},
        "expressions": {e: {"eyes": e, "brows": e, "mouth": e} for e in EXPRESSIONS},
        "visemes": {"rest": "neutral", "A": "talk_a", "E": "talk_e", "I": "talk_e", "O": "talk_o", "U": "talk_o", "MBP": "neutral", "FV": "talk_e"},
        "limits": {"thigh_n": [-95, 40], "thigh_f": [-95, 40], "shin_n": [0, 110], "shin_f": [0, 110],
                   "arm_upper_n": [-120, 60], "arm_upper_f": [-120, 60], "arm_lower_n": [-130, 0], "arm_lower_f": [-130, 0], "head": [-15, 15]},
    }
