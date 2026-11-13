"""The cast of a world: a World Spec character (body + costume) becomes a `Look` of the studio's character
generator, so every character of every world is rigged on the same skeleton and plays every action.

Identity (skin, hair, face, age) comes from `body`; the costume preset decides the clothes, hats and long
garments, coloured with the character's own `main` and `accent`.
"""
from __future__ import annotations

import colorsys

from characters import Look

SKIN = {
    "light": ("#F1C6A6", "#DDA584"),
    "medium": ("#E2B08C", "#C98F68"),
    "tan": ("#C98F68", "#AD7652"),
    "brown": ("#A8714D", "#8C5A3B"),
    "dark": ("#7A4E35", "#623D29"),
}
HAIR = {
    "black": ("#2A2422", "#40363A"),
    "brown": ("#5B3A28", "#74503A"),
    "auburn": ("#8C4A2F", "#A8603F"),
    "blond": ("#D9B26A", "#EBCB8A"),
    "grey": ("#9A948C", "#C4BEB6"),
    "white": ("#E6E2DA", "#F6F3EE"),
}
STYLE = {"short": "swept", "swept": "swept", "messy": "short_messy", "long": "long", "bob": "bob",
         "buzz": "buzz", "bald": "receding"}
IRIS = ["#4C7A93", "#5C6E7A", "#6B4F3A", "#4F6B4F", "#3E5F86"]


def shade(h: str, k: float) -> str:
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    hh, ll, ss = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(hh, max(0.0, min(1.0, ll * k)), ss)
    return "#{:02X}{:02X}{:02X}".format(*(round(c * 255) for c in (r, g, b)))


def _clothes(main: str) -> dict:
    return {"top_main": main, "top_sh": shade(main, 0.82), "top_dk": shade(main, 0.64)}


def _pants(color: str) -> dict:
    return {"pants": color, "pants_sh": shade(color, 0.82)}


def _shoes(kind: str, color: str) -> dict:
    return {"shoes": kind, "shoe_main": color, "shoe_sh": shade(color, 0.78), "sole": shade(color, 0.5)}


def costume(preset: str, woman: bool, age: str, main: str | None, accent: str | None) -> dict:
    """Clothing fields of `Look` for a costume preset."""
    m = main or "#5B7FA6"
    a = accent or "#E3B66B"
    if preset == "king":
        return {"top": "robe", **_clothes(main or "#A8323E"), **_pants(main or "#A8323E"), **_shoes("shoe", "#C9963E"),
                "inner": accent or "#E3B66B", "crown": "king", "skirt": 806}
    if preset == "queen":
        return {"top": "robe", **_clothes(main or "#2C4F8A"), **_pants(main or "#2C4F8A"), **_shoes("shoe", "#C9963E"),
                "inner": "#F4F1EA", "crown": "queen", "skirt": 846}
    if preset == "prince":
        return {"top": "blazer", **_clothes(m), "inner": a, **_pants("#3B3330"), **_shoes("boot", "#4A3628"),
                "hat": "circlet"}
    if preset == "knight":
        return {"top": "blazer", **_clothes(main or "#8E99A6"), "inner": a, **_pants("#6F7A86"), **_shoes("boot", "#4A3628"),
                "hat": "helmet", "hat_color": "#B8C1CC"}
    if preset == "peasant":
        return {"top": "tshirt", **_clothes(main or "#A9825F"), "patches": True, **_pants("#6B4F3A"), **_shoes("boot", "#5A4634")}
    if preset == "chef":
        return {"top": "shirt", **_clothes("#F6F3EE"), **_pants("#3B4048"), **_shoes("shoe", "#2A1E18"), "hat": "chef"}
    if preset == "official":
        return {"top": "blazer", **_clothes(main or "#3E5F86"), "inner": a, **_pants("#2A1E18"), **_shoes("boot", "#2A1E18"),
                "hat": "tall_hat", "hat_color": "#2A1E18"}
    if preset == "business_suit":
        if woman:
            return {"top": "blazer", **_clothes(main or "#2C3E5C"), "inner": "#F6F3EE", **_pants(main or "#2C3E5C"),
                    **_shoes("shoe", "#1A120E")}
        return {"top": "suit", **_clothes(main or "#3B4048"), "inner": "#F6F3EE", "tie": accent or "#7A2E3A",
                **_pants(main or "#3B4048"), **_shoes("shoe", "#2A1E18")}
    if preset == "office_casual":
        return {"top": "blouse" if woman else "shirt", **_clothes(m), **_pants(accent or "#3B4048"), **_shoes("shoe", "#2A1E18")}
    if preset == "street":
        if age == "old":
            return {"top": "cardigan", **_clothes(m), "inner": "#DCE6EE", **_pants(accent or "#3B4048"),
                    **_shoes("shoe", "#2A1E18"), "hat": "cap", "hat_color": accent or "#3B4048"}
        return {"top": "hoodie", **_clothes(m), **_pants(accent or "#2C4666"), **_shoes("sneaker", "#F4F1EA")}
    if preset == "worker":
        return {"top": "tshirt", **_clothes(main or "#8C7B66"), **_pants("#5E5850"), **_shoes("boot", "#5A4634"),
                "hat": "cap", "hat_color": accent or "#E8833A"}
    if preset == "toga":
        return {"top": "toga", **_clothes(main or "#F4F1EA"), **_pants(main or "#F4F1EA"), **_shoes("shoe", "#A9825F"),
                "skirt": 840}
    raise ValueError(f"unknown costume preset {preset}")


def look_for(ch: dict, index: int) -> Look:
    b, c = ch["body"], ch["costume"]
    woman = b["presentation"] == "woman"
    skin, skin_sh = SKIN[b["skin"]]
    hair, hair_hi = HAIR[b["hairColor"]]
    style = STYLE[b["hair"]]
    if b["age"] == "old" and style == "swept" and not woman:
        style = "receding"
    beard = None if b.get("beard", "none") == "none" else b["beard"]
    fields = costume(c["preset"], woman, b["age"], c.get("main"), c.get("accent"))
    tags = ["world", c["preset"], b["presentation"], b["age"]]
    return Look(
        ch["id"], ch["name"], f'{ch["name"]}: {ch.get("role", c["preset"])}', tags,
        skin=skin, skin_sh=skin_sh, hair=hair, hair_hi=hair_hi, hair_style=style,
        beard=beard, beard_main=hair, beard_sh=shade(hair, 0.82), glasses=b.get("glasses", False),
        lashes=woman, blush=woman, lips="#A34B4B" if woman else "#7A3B2E", iris=IRIS[index % len(IRIS)],
        age_lines=b["age"] == "old", **fields,
    )
