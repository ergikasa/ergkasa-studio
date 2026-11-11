"""Objektet e skenës (props) në stilin erkasa_flat_v1, të vizatuara me kod.

Ndryshe nga ikonat (Fluent/Phosphor), këto objekte qëndrojnë pranë personazheve dhe ndërveprojnë me ta,
ndaj vizatohen në të njëjtin stil dhe në të njëjtën shkallë:

- 1 njësi e viewBox-it = 1 px i botës kur personazhi ka shkallën standarde 0.92 (lartësia ~810 px).
- Fundi i viewBox-it është dyshemeja për objektet që qëndrojnë në dysheme.
- `anchors` janë të normalizuara (0..1) brenda viewBox-it: `ground`, `hip` (ku bie kyçi i ijës së
  personazhit të ulur), `top` (sipërfaqja e tavolinës), `hinge`...
- Pamja anësore vizatohet e kthyer djathtas; motori e kthen majtas me `props.flip`.

Lartësitë rrjedhin nga rig-u anësor (engine: SEAT.hipHeight ≈ 259 px rig → 238 px botë):
  sipërfaqja e ndenjëses = 212 px mbi dysheme, tavolina = 348 px (≈ 75 cm për një njeri 175 cm).
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INK = "#2A1E18"
SEAT_Y_ABOVE_FLOOR = 212
DESK_TOP_ABOVE_FLOOR = 348
HIP_ABOVE_SEAT = 26


def g(gid, content, pivot=None):
    pv = f' data-pivot="{pivot[0]},{pivot[1]}"' if pivot else ""
    return f'<g id="{gid}"{pv}>{content}</g>'


def rect(x, y, w, h, fill, rx=0, extra=""):
    return f'<rect x="{x:.0f}" y="{y:.0f}" width="{w:.0f}" height="{h:.0f}" rx="{rx}" fill="{fill}" {extra}/>'


def circle(cx, cy, r, fill, extra=""):
    return f'<circle cx="{cx:.0f}" cy="{cy:.0f}" r="{r:.1f}" fill="{fill}" {extra}/>'


def path(d, fill, extra=""):
    return f'<path d="{d}" fill="{fill}" {extra}/>'


# ---------------------------------------------------------------- karrige zyre (anash)
def chair_office_side():
    w, h = 260, 560
    seat = h - SEAT_Y_ABOVE_FLOOR
    body = (
        g("base",
          rect(126, seat + 24, 16, 96, "#4A5568")                      # kolona e gazit
          + path(f"M40,{h-34} L130,{h-56} L220,{h-34} L220,{h-26} L130,{h-44} L40,{h-26} Z", "#2B3445")
          + circle(48, h - 14, 14, "#1E2533") + circle(212, h - 14, 14, "#1E2533") + circle(130, h - 20, 12, "#1E2533"))
        + g("seat",
            rect(36, seat - 6, 196, 34, "#3E4A5C", rx=14)
            + rect(44, seat + 18, 180, 10, "#2B3445", rx=5))
        + g("back",
            path(f"M58,{seat-10} L48,{seat-60} Q30,{seat-240} 60,{seat-290} Q86,{seat-310} 96,{seat-270} L92,{seat-10} Z", "#3E4A5C")
            + path(f"M64,{seat-40} Q48,{seat-220} 70,{seat-268} L80,{seat-262} Q62,{seat-210} 76,{seat-40} Z", "#4D5B70"))
        + g("armrest", rect(150, seat - 92, 70, 14, "#2B3445", rx=7) + rect(176, seat - 80, 14, 74, "#2B3445", rx=5))
    )
    anchors = {"ground": [0.5, 1.0], "hip": [100 / w, (seat - HIP_ABOVE_SEAT) / h], "seat": [100 / w, seat / h]}
    return "Karrige zyre (anash)", body, (w, h), anchors, ["office", "chair", "furniture", "sit"], \
        {"part": "pa animim; personazhi ulet me `sit` dhe ijët në anchor `hip`"}


# ---------------------------------------------------------------- tavolinë pune (pamje ballore anash)
def desk_side():
    # in profile we see the desk's depth (~70 cm), not its width
    w, h = 300, 380
    top = h - DESK_TOP_ABOVE_FLOOR
    body = (
        g("legs", rect(22, top + 26, 26, h - top - 26, "#6B4F3A") + rect(w - 48, top + 26, 26, h - top - 26, "#6B4F3A"))
        + g("panel", rect(48, top + 26, w - 96, 150, "#B08A68") + rect(48, top + 168, w - 96, 8, "#9C7656"))
        + g("top", rect(0, top, w, 30, "#A9825F", rx=6) + rect(0, top + 22, w, 8, "#8A6849", rx=3))
    )
    anchors = {"ground": [0.5, 1.0], "top": [0.5, top / h]}
    return "Tavolinë pune", body, (w, h), anchors, ["office", "desk", "table", "furniture", "work"], \
        {"part": "shtresë përpara: mbulon këmbët e personazheve të ulur"}


# ---------------------------------------------------------------- laptop (anash, i hapur)
def laptop_side():
    w, h = 220, 170
    body = (
        g("lid", path("M34,150 L12,18 Q10,8 20,8 L30,8 Q38,8 40,16 L58,150 Z", "#B8C1CC")
          + path("M44,150 L28,24 L36,22 L52,150 Z", "#D7DEE6")
          + path("M58,150 L40,16 L46,16 L64,150 Z", "#7FB7E0", 'opacity="0.55"'), (46, 150))
        + g("base", rect(30, 146, 180, 14, "#8E99A6", rx=5) + rect(30, 156, 180, 6, "#6F7A86", rx=3))
    )
    anchors = {"ground": [0.5, 162 / h], "hinge": [46 / w, 150 / h]}
    return "Laptop (anash)", body, (w, h), anchors, ["office", "laptop", "computer", "work", "tech"], \
        {"lid": "rotation: mbyllet/hapet rreth menteshës"}


# ---------------------------------------------------------------- derë (në mur, hapet)
def door():
    w, h = 300, 930
    frame = rect(0, 0, w, h, "#7A5A43", rx=6) + rect(18, 18, w - 36, h - 18, "#3B3430")
    leaf = (rect(18, 18, w - 36, h - 18, "#B88A63")
            + rect(48, 60, w - 96, 330, "#A97C57", rx=8) + rect(48, 430, w - 96, 420, "#A97C57", rx=8)
            + circle(w - 58, 470, 13, "#E3B66B") + rect(w - 64, 466, 34, 9, "#E3B66B", rx=4))
    body = g("frame", frame) + g("leaf", leaf, (18, h / 2))
    anchors = {"ground": [0.5, 1.0], "hinge": [18 / w, 0.5], "center": [0.5, 0.5]}
    return "Derë", body, (w, h), anchors, ["door", "entrance", "office", "home", "enter", "exit"], \
        {"leaf": "scaleX 1 → 0.1 (hapet rreth menteshës majtas)", "frame": "statike"}


# ---------------------------------------------------------------- bimë në vazo
def plant_floor():
    w, h = 220, 420
    body = (
        g("leaves",
          path("M110,250 Q40,200 30,90 Q80,140 110,250 Z", "#4F8A5B")
          + path("M110,250 Q180,190 196,70 Q140,130 110,250 Z", "#62A06C")
          + path("M110,250 Q100,120 120,10 Q150,120 110,250 Z", "#4F8A5B")
          + path("M110,250 Q60,230 10,200 Q70,180 110,250 Z", "#62A06C")
          + path("M110,250 Q170,240 214,190 Q150,190 110,250 Z", "#4F8A5B"), (110, 250))
        + g("pot", path("M50,250 L170,250 L156,410 Q155,420 145,420 L75,420 Q65,420 64,410 Z", "#E8E2D8")
            + rect(44, 244, 132, 22, "#D9D1C4", rx=6))
    )
    return "Bimë në vazo", body, (w, h), {"ground": [0.5, 1.0]}, ["plant", "office", "home", "decor"], \
        {"leaves": "sway e lehtë"}


# ---------------------------------------------------------------- orë muri
def wall_clock():
    w = h = 200
    body = (
        g("face", circle(100, 100, 92, "#F6F3EE") + f'<circle cx="100" cy="100" r="92" fill="none" stroke="#2B3445" stroke-width="12"/>'
          + "".join(rect(97, 18, 6, 18, "#2B3445", extra=f'transform="rotate({a} 100 100)"') for a in range(0, 360, 30)))
        + g("hour", rect(95, 52, 10, 54, INK, rx=5), (100, 100))
        + g("minute", rect(97, 28, 6, 78, INK, rx=3), (100, 100))
        + g("pin", circle(100, 100, 8, "#C2554D"))
    )
    return "Orë muri", body, (w, h), {"center": [0.5, 0.5]}, ["clock", "time", "office", "deadline"], \
        {"hour": "rotation (orët)", "minute": "rotation (minutat)"}


# ---------------------------------------------------------------- filxhan
def mug():
    w, h = 90, 90
    body = g("mug", path("M14,20 L66,20 L62,84 Q61,88 57,88 L23,88 Q19,88 18,84 Z", "#F6F3EE")
             + path("M64,34 Q86,34 84,54 Q82,70 62,68", "none", 'stroke="#F6F3EE" stroke-width="9"')
             + rect(14, 20, 52, 10, "#D9D1C4", rx=3))
    return "Filxhan", body, (w, h), {"ground": [0.5, 88 / h]}, ["mug", "coffee", "office", "break"], {"mug": "statik"}


# ---------------------------------------------------------------- CV e shtrirë mbi tavolinë
def cv_flat():
    w, h = 120, 30
    body = g("sheet", path("M6,24 L18,6 L116,6 L104,24 Z", "#FFFFFF")
             + path("M6,24 L18,6 L116,6 L104,24 Z", "none", 'stroke="#C9CED8" stroke-width="2"')
             + path("M30,15 L88,15 M26,20 L70,20", "none", 'stroke="#A7AEBB" stroke-width="3" stroke-linecap="round"')
             + rect(92, 9, 14, 9, "#C2D3E3", rx=2))
    return "CV mbi tavolinë", body, (w, h), {"ground": [0.5, 24 / h]}, ["cv", "resume", "document", "paper", "office", "interview"], \
        {"sheet": "pop_in, slide (x) mbi tavolinë"}


# ---------------------------------------------------------------- aureola (metaforë e Halo Effect)
def halo():
    w, h = 260, 120
    body = (
        g("glow", '<ellipse cx="130" cy="60" rx="124" ry="52" fill="#FFE7A8" opacity="0.45"/>', (130, 60))
        + g("ring", '<ellipse cx="130" cy="60" rx="96" ry="30" fill="none" stroke="#E3B66B" stroke-width="16"/>'
            '<path d="M44,56 Q130,20 216,56" fill="none" stroke="#F7D98A" stroke-width="6" stroke-linecap="round"/>', (130, 60))
    )
    return "Aureolë", body, (w, h), {"center": [0.5, 0.5]}, ["halo", "halo-effect", "bias", "impression", "psychology"], \
        {"ring": "pop_in, bob", "glow": "pulse (scale + opacity)"}


PROPS = [
    ("prop_chair_office_side_01", chair_office_side),
    ("prop_desk_side_01", desk_side),
    ("prop_laptop_side_01", laptop_side),
    ("prop_door_01", door),
    ("prop_plant_floor_01", plant_floor),
    ("prop_wall_clock_01", wall_clock),
    ("prop_mug_01", mug),
    ("prop_halo_01", halo),
    ("prop_cv_flat_01", cv_flat),
]


def main() -> None:
    out_root = ROOT / "assets" / "props"
    for asset_id, fn in PROPS:
        name, body, (w, h), anchors, tags, parts = fn()
        d = out_root / asset_id
        d.mkdir(parents=True, exist_ok=True)
        svg = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"><g id="{asset_id}">{body}</g></svg>\n'
        (d / "asset.svg").write_text(svg)
        meta = {
            "schema": "erkasa.asset/1", "assetId": asset_id, "version": 1, "name": name,
            "category": "object", "subcategory": "scene_prop", "kind": "prop", "adapter": "svg",
            "style": "erkasa_flat_v1", "files": {"svg": "asset.svg"}, "viewBox": [0, 0, w, h],
            "capabilities": {"animations": ["pop_in", "fade", "slide"], "scale": "1 = shkalla e personazhit standard (0.92)"},
            "anchors": anchors, "parts": parts,
            "themes": ["psychology", "decisions", "growth"], "tags": tags,
            "license": {"spdx": "LicenseRef-Erkasa-Original", "source": "Erkasa (origjinal, i gjeneruar me kod)",
                        "commercial": True, "attributionRequired": False},
        }
        (d / "asset.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(PROPS)} props")


if __name__ == "__main__":
    main()
