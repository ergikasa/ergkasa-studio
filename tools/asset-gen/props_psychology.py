"""Psikologjia dhe sjellja njerëzore: objektet dhe metaforat (lista e prodhimit, kategoria 02).

Objektet shkojnë te `assets/props/`, metaforat (me pjesë që lëvizin dhe receta te kompilatori) te
`assets/metaphors/`. Stili dhe shkalla: `editorial.py`.

Përdorimi: python3 tools/asset-gen/props_psychology.py
"""
from __future__ import annotations

import math
import random

from editorial import (HIP_ABOVE_SEAT, INK, P, SEAT_Y_ABOVE_FLOOR, Defs, blob, circle, contact_shadow, ellipse, g,
                       lathe, line, obj, path, poly, rect, run, sheen, star)


# ---------------------------------------------------------------- trupi dhe mendja
def brain_shape(cx, cy, s=1.0):
    """Silueta e trurit në profil (balli djathtas)."""
    return (f"M{cx-150*s},{cy+10*s} Q{cx-170*s},{cy-80*s} {cx-90*s},{cy-118*s} Q{cx-40*s},{cy-150*s} {cx+20*s},{cy-132*s} "
            f"Q{cx+90*s},{cy-140*s} {cx+130*s},{cy-90*s} Q{cx+178*s},{cy-40*s} {cx+150*s},{cy+30*s} Q{cx+130*s},{cy+80*s} {cx+60*s},{cy+82*s} "
            f"Q{cx},{cy+96*s} {cx-60*s},{cy+80*s} Q{cx-140*s},{cy+80*s} {cx-150*s},{cy+10*s} Z")


def brain(d: Defs):
    w, h = 400, 330
    cx, cy = 200, 160
    gyri = [f"M{cx-120},{cy-20} Q{cx-90},{cy-70} {cx-40},{cy-60} Q{cx-10},{cy-30} {cx+30},{cy-70}",
            f"M{cx-70},{cy-110} Q{cx-50},{cy-80} {cx-10},{cy-100} Q{cx+30},{cy-118} {cx+60},{cy-96}",
            f"M{cx+50},{cy-40} Q{cx+90},{cy-60} {cx+120},{cy-20} Q{cx+136},{cy+10} {cx+110},{cy+40}",
            f"M{cx-130},{cy+30} Q{cx-90},{cy+10} {cx-60},{cy+40} Q{cx-20},{cy+60} {cx+20},{cy+30}",
            f"M{cx-30},{cy} Q{cx},{cy-20} {cx+30},{cy+10} Q{cx+60},{cy+30} {cx+70},{cy+60}",
            f"M{cx+80},{cy-100} Q{cx+100},{cy-80} {cx+96},{cy-60}"]
    body = (
        g("stem", path(f"M{cx-10},{cy+70} Q{cx-6},{cy+130} {cx-30},{cy+160} L{cx+16},{cy+160} Q{cx+26},{cy+120} {cx+30},{cy+74} Z", d.h("stem", P["pink"], P["pink_d"])))
        + g("cerebellum", ellipse(cx - 70, cy + 92, 70, 40, d.d("cb", P["pink"], P["pink_d"]))
            + "".join(line(f"M{cx-128},{cy+86+i*12} Q{cx-70},{cy+70+i*14} {cx-12},{cy+88+i*10}", P["pink_d"], 4, 'opacity="0.6"') for i in range(3)))
        + g("cortex", path(brain_shape(cx, cy), d.d("cx", P["pink_l"], P["pink_d"]))
            + "".join(line(q, P["pink_d"], 7, 'opacity="0.75"') for q in gyri)
            + line(f"M{cx-150},{cy+10} Q{cx-60},{cy+40} {cx+40},{cy+12}", P["pink_d"], 8)
            + sheen(f"M{cx-100},{cy-100} Q{cx-40},{cy-136} {cx+30},{cy-122} Q{cx-30},{cy-110} {cx-90},{cy-80} Z", 0.45))
    )
    return obj("Tru njerëzor", (w, h), body, {"center": [0.5, 0.48], "ground": [cx / w, (cy + 160) / h]},
               ["brain", "mind", "thinking", "psychology", "neuroscience", "memory", "cognition", "intelligence"],
               {"cortex": "pulse = mendim intensiv", "cerebellum": "statik", "stem": "statik"},
               "A stylised human brain in profile, pink, with folds, cerebellum and brain stem.",
               "Anything about the mind: how we think, memory, decisions, cognitive biases, what happens 'inside the head'.",
               animations=("pop_in", "fade", "slide", "pulse", "float"))


def head_profile_path(x0, y0, s=1.0):
    """Koka në profil (fytyra djathtas), me qafë. Origjina = maja e kokës, mesi."""
    pts = (f"M{x0-150*s},{y0+170*s} Q{x0-170*s},{y0+40*s} {x0-90*s},{y0-10*s} Q{x0},{y0-50*s} {x0+90*s},{y0} "
           f"Q{x0+150*s},{y0+40*s} {x0+150*s},{y0+130*s} L{x0+168*s},{y0+200*s} Q{x0+172*s},{y0+214*s} {x0+156*s},{y0+218*s} "
           f"L{x0+150*s},{y0+250*s} Q{x0+158*s},{y0+262*s} {x0+146*s},{y0+272*s} Q{x0+152*s},{y0+290*s} {x0+138*s},{y0+300*s} "
           f"Q{x0+120*s},{y0+330*s} {x0+70*s},{y0+322*s} L{x0+60*s},{y0+380*s} L{x0-90*s},{y0+400*s} "
           f"Q{x0-80*s},{y0+330*s} {x0-110*s},{y0+290*s} Q{x0-160*s},{y0+240*s} {x0-150*s},{y0+170*s} Z")
    return pts


def head_silhouette(d: Defs):
    w, h = 420, 520
    body = (
        g("head", path(head_profile_path(200, 70), d.d("hd", P["slate_l"], P["slate_dd"]))
          + path(f"M60,240 Q50,120 120,70 Q90,140 96,260 Q100,330 128,372 Q70,330 60,240 Z", P["white"], 'opacity="0.07"'))
        + g("mind", circle(196, 210, 96, d.glow("mind", P["warm_light"], 0.55, 0.0)), (196, 210))
    )
    return obj("Kokë njerëzore në profil (siluetë)", (w, h), body, {"center": [0.5, 0.5], "mind": [196 / w, 210 / h], "ground": [0.5, 0.92]},
               ["head", "profile", "silhouette", "mind", "thoughts", "identity", "psychology", "inner-voice"],
               {"head": "statike", "mind": "pulse/fade: drita e mendimit; vendos objekte mbi anchor `mind`"},
               "A dark slate human head in profile with a soft warm glow where the mind is.",
               "A container for ideas: put a brain, a thought, a maze or a memory over the `mind` anchor. Inner voice, overthinking, beliefs.",
               animations=("pop_in", "fade", "slide", "pulse"))


def brain_network(d: Defs):
    w, h = 420, 340
    rng = random.Random(41)
    cx, cy = 210, 170
    nodes = [(cx + 120 * math.cos(a) * r, cy - 10 + 92 * math.sin(a) * r) for a, r in
             [(rng.uniform(0, 2 * math.pi), rng.uniform(0.15, 0.95)) for _ in range(26)]]
    links = []
    for i, a in enumerate(nodes):
        near = sorted(nodes, key=lambda b: (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)[1:4]
        links += [line(f"M{a[0]:.0f},{a[1]:.0f} L{b[0]:.0f},{b[1]:.0f}", P["sky"], 3, 'opacity="0.8"') for b in near]
    body = (
        g("shell", path(brain_shape(cx, cy, 1.18), d.d("sh", P["blue_d"], P["night"]))
          + path(brain_shape(cx, cy, 1.18), "none", f'stroke="{P["sky"]}" stroke-width="5" opacity="0.7"')
          + ellipse(cx, cy - 10, 150, 110, d.glow("core", P["blue_l"], 0.45, 0.0)))
        + g("links", "".join(links), (cx, cy))
        + g("nodes", "".join(circle(x, y, rng.choice([5, 6, 8]), P["sky_l"]) + circle(x, y, 14, d.glow("nd", P["sky"], 0.6, 0.0)) for x, y in nodes), (cx, cy))
    )
    return obj("Tru me lidhje neurale", (w, h), body, {"center": [0.5, 0.5]},
               ["brain", "neurons", "network", "connections", "learning", "neuroplasticity", "habit", "memory", "neuroscience"],
               {"nodes": "pulse = sinjale neurale", "links": "fade/pulse", "shell": "statik"},
               "A glowing dark-blue brain outline filled with a network of light nodes and connections.",
               "Learning and neuroplasticity, habits wiring in, memory, dopamine signals, 'your brain is rewiring itself'.",
               animations=("pop_in", "fade", "slide", "pulse", "float"))


def brain_split(d: Defs):
    w, h = 440, 360
    cx, cy = 220, 180

    def half(sign, grad):
        s = sign
        return path(f"M{cx+s*6},{cy-150} Q{cx+s*120},{cy-170} {cx+s*180},{cy-80} Q{cx+s*214},{cy+10} {cx+s*180},{cy+90} "
                    f"Q{cx+s*130},{cy+170} {cx+s*6},{cy+150} Z", grad)

    left = (half(-1, d.d("l", P["blue_l"], P["blue_d"]))
            + "".join(line(f"M{cx-30-i*30},{cy-120+i*8} V{cy+110-i*10}", P["blue_dd"], 4, 'opacity="0.5"') for i in range(5))
            + "".join(line(f"M{cx-170},{cy-60+i*44} H{cx-20}", P["blue_dd"], 4, 'opacity="0.5"') for i in range(4))
            + "".join(circle(cx - 30 - i * 30, cy - 60 + (i % 4) * 44, 7, P["sky_l"]) for i in range(5)))
    right = (half(1, d.d("r", P["gold_l"], P["orange_d"]))
             + "".join(line(f"M{cx+30},{cy-100+i*60} Q{cx+120},{cy-150+i*60} {cx+160},{cy-80+i*60} T{cx+40},{cy-40+i*60}", P["red_d"], 5, 'opacity="0.45"') for i in range(4))
             + circle(cx + 110, cy - 70, 16, P["red_l"]) + circle(cx + 70, cy + 70, 12, P["teal"]) + circle(cx + 150, cy + 30, 10, P["violet"]))
    body = (
        contact_shadow(d, cx, h, 170, 14, 0.2)
        + g("left", left, (cx, cy)) + g("right", right, (cx, cy))
        + rect(cx - 4, cy - 150, 8, 300, P["cream"], rx=4)
    )
    return obj("Tru i ndarë në dy pjesë", (w, h), body, {"center": [0.5, 0.5], "left": [0.25, 0.5], "right": [0.75, 0.5]},
               ["brain", "two-systems", "logic", "emotion", "creativity", "inner-conflict", "system-1", "system-2", "decision"],
               {"left": "gjysma e ftohtë: logjika (slide majtas për ndarje)", "right": "gjysma e ngrohtë: emocioni, kreativiteti"},
               "A brain seen from above split in two halves: a cool blue, orderly left side and a warm, swirling right side.",
               "Logic versus emotion, fast versus slow thinking (System 1 and System 2), inner conflict between reason and feeling.",
               animations=("pop_in", "fade", "slide", "pulse"))


def heart(d: Defs):
    w, h = 320, 360
    body = (
        g("vessels",
          path("M150,110 Q140,40 180,22 Q214,10 226,40 L208,52 Q196,36 182,46 Q166,60 176,118 Z", d.h("ao", P["red_l"], P["red_d"]))
          + path("M120,120 Q96,60 110,30 L134,30 Q126,64 146,118 Z", d.h("vc", P["blue_l"], P["blue_d"]))
          + path("M206,104 Q240,80 268,92 L262,112 Q238,104 218,124 Z", d.h("pa", P["blue"], P["blue_dd"]))
          + rect(108, 22, 32, 14, P["blue_d"], rx=7) + rect(186, 14, 34, 14, P["red_d"], rx=7, extra='transform="rotate(20 203 21)"'))
        + g("heart",
            path("M160,340 Q60,280 46,190 Q36,118 96,104 Q140,96 164,132 Q186,92 236,100 Q292,112 286,186 Q278,270 160,340 Z",
                 d.d("ht", P["red_l"], P["red_d"]))
            + path("M164,132 Q150,220 176,330", "none", f'stroke="{P["red_d"]}" stroke-width="6" opacity="0.7"')
            + line("M120,170 Q140,200 132,240 M212,160 Q234,190 226,230", P["red_d"], 5, 'opacity="0.5"')
            + sheen("M70,170 Q72,124 108,116 Q86,140 88,190 Z", 0.4), (166, 220))
    )
    return obj("Zemër njerëzore", (w, h), body, {"center": [0.5, 0.58]},
               ["heart", "emotion", "love", "fear", "anxiety", "stress", "body", "health", "pulse"],
               {"heart": "pulse = rrahje zemre; scale_pulse më i shpejtë për frikë/stres", "vessels": "statike"},
               "A stylised anatomical heart, red, with the aorta and blue veins on top.",
               "Emotions in the body: fear and the racing heart, love, stress, the physical side of anxiety.",
               animations=("pop_in", "fade", "slide", "pulse", "scale_pulse"))


def eye_shape(cx, cy, w, h):
    return f"M{cx-w},{cy} Q{cx},{cy-h*2} {cx+w},{cy} Q{cx},{cy+h*2} {cx-w},{cy} Z"


def eye(d: Defs):
    w, h = 420, 240
    cx, cy = 210, 120
    body = (
        g("white", path(eye_shape(cx, cy, 180, 78), d.v("sc", P["white"], P["cream2"])))
        + g("iris", circle(cx, cy, 70, d.d("ir", P["teal"], P["teal_d"]))
            + "".join(line(f"M{cx + 30 * math.cos(a):.0f},{cy + 30 * math.sin(a):.0f} L{cx + 66 * math.cos(a):.0f},{cy + 66 * math.sin(a):.0f}", P["teal_d"], 3, 'opacity="0.6"')
                      for a in [i * math.pi / 9 for i in range(18)])
            + circle(cx, cy, 32, INK) + circle(cx - 22, cy - 24, 14, P["white"]) + circle(cx + 20, cy + 18, 6, P["white"], 'opacity="0.7"'), (cx, cy))
        + g("lid", path(f"M{cx-196},{cy} Q{cx},{cy-176} {cx+196},{cy} Q{cx},{cy-150} {cx-196},{cy} Z", d.v("lid", P["skin"], P["skin_d"]))
            + path(f"M{cx-180},{cy} Q{cx},{cy-156} {cx+180},{cy}", "none", f'stroke="{INK}" stroke-width="10" stroke-linecap="round"')
            + "".join(line(f"M{cx + 150 * math.cos(a):.0f},{cy - 76 * math.sin(a) - 4:.0f} l{14 * math.cos(a):.0f},{-22 * math.sin(a) - 4:.0f}", INK, 5)
                      for a in [math.pi * (0.18 + 0.1 * i) for i in range(7)]), (cx, cy - 70))
        + path(f"M{cx-180},{cy} Q{cx},{cy+160} {cx+180},{cy}", "none", f'stroke="{P["skin_d"]}" stroke-width="8" stroke-linecap="round"')
    )
    return obj("Sy njerëzor", (w, h), body, {"center": [0.5, 0.5]},
               ["eye", "vision", "attention", "perception", "seeing", "focus", "observation", "bias"],
               {"lid": "scaleY 1 → 0.1 = mbyll sytë (pulsi i pivot-it lart)", "iris": "x ±40 = shikon majtas/djathtas"},
               "A large open human eye: almond shape, teal iris with highlights, upper eyelid and lashes.",
               "Attention and perception: what we notice and what we miss, selective attention, 'seeing' a bias.",
               animations=("pop_in", "fade", "slide", "pulse"))


def hand(d: Defs):
    w, h = 280, 400
    skin = d.v("sk", P["skin_l"], P["skin_d"])
    fingers = [(72, 120, 26, -14), (112, 70, 27, -5), (152, 62, 27, 3), (190, 90, 25, 11)]
    body = g("hand",
             "".join(f'<rect x="{x - wdt / 2:.0f}" y="{y:.0f}" width="{wdt}" height="{200 - y + 40:.0f}" rx="{wdt / 2:.0f}" fill="{skin}" transform="rotate({r} {x} 240)"/>'
                     + f'<rect x="{x - wdt / 2 + 6:.0f}" y="{y + 10:.0f}" width="{wdt - 12}" height="22" rx="8" fill="{P["skin_l"]}" opacity="0.7" transform="rotate({r} {x} 240)"/>'
                     for x, y, wdt, r in fingers)
             + path("M52,220 Q48,330 100,370 L190,370 Q228,330 226,220 Q200,200 140,204 Q80,200 52,220 Z", skin)
             + path("M226,250 Q260,210 270,180 Q284,160 270,150 Q252,146 236,176 Q220,206 206,232 Z", skin)
             + line("M80,290 Q130,270 180,286 M96,320 Q140,330 176,316", P["skin_d"], 4, 'opacity="0.6"')
             + rect(92, 366, 104, 34, d.h("wr", P["skin"], P["skin_d"]), rx=6), (140, 380))
    return obj("Dorë njerëzore (pëllëmbë e hapur)", (w, h), body, {"center": [0.5, 0.5], "palm": [0.5, 0.7]},
               ["hand", "palm", "open-hand", "help", "giving", "stop", "control", "offer", "human"],
               {"hand": "sway / pop_in; vendos objekte mbi anchor `palm`"},
               "An open human hand, palm facing the viewer, fingers slightly spread.",
               "Offering or receiving, help, control ('in your hands'), stop. Place a small object over the palm anchor.")


def human_shadow(d: Defs):
    w, h = 420, 1300
    fill = d.v("sh", P["slate_dd"], INK)
    body = g("shadow",
             "<g opacity=\"0.55\">"
             + ellipse(210, 150, 70, 92, fill)
             + path("M150,236 Q210,220 270,236 L330,300 Q356,330 350,420 L346,640 Q342,680 320,676 L306,520 L300,760 L292,1260 Q286,1290 250,1290 L234,820 L222,820 L206,1290 Q170,1290 166,1260 L150,760 L144,520 L128,676 Q104,680 100,640 L94,420 Q88,330 112,300 Z", fill)
             + "</g>")
    return obj("Hija e njeriut (e zgjatur)", (w, h), body, {"ground": [0.5, 1.0], "feet": [0.5, 0.99]},
               ["shadow", "fear", "dark-side", "past", "insecurity", "shadow-self", "jung", "anxiety"],
               {"shadow": "scaleY rritet = frika rritet; fade; skewX për hije të shtrembër"},
               "A tall, stretched, semi-transparent human shadow, as if cast on a wall behind someone.",
               "The shadow self, fears that look bigger than they are, the past following someone. Place it behind a character, feet to feet.")


def broken_mirror(d: Defs):
    w, h = 460, 680
    cx, cy = 230, 300
    rng = random.Random(7)
    cracks = "".join(line(f"M{cx},{cy} L{cx + r * math.cos(a):.0f},{cy + r * 1.3 * math.sin(a):.0f}"
                          + f" l{rng.uniform(-30, 30):.0f},{rng.uniform(-30, 30):.0f}", P["white"], rng.choice([3, 4, 5]))
                     for a, r in [(i * 0.55 + rng.uniform(-0.2, 0.2), rng.uniform(120, 180)) for i in range(12)])
    shards = "".join(poly([(x, h - 6), (x + rng.uniform(16, 40), h - rng.uniform(16, 44)), (x + rng.uniform(30, 60), h - 4)],
                          d.d("sd", P["sky_l"], P["glass"])) for x in (40, 120, 300, 360))
    body = (
        contact_shadow(d, cx, h, 200, 12, 0.18)
        + g("frame", ellipse(cx, cy, 196, 270, d.d("fr", P["brass_l"], P["brass_d"])) + ellipse(cx, cy, 172, 246, P["brass_d"]))
        + g("glass", ellipse(cx, cy, 168, 242, d.d("gl", P["sky_l"], P["glass"]))
            + sheen(f"M{cx-120},{cy-150} Q{cx-60},{cy-230} {cx+10},{cy-236} L{cx-110},{cy+40} Q{cx-150},{cy-40} {cx-120},{cy-150} Z", 0.45))
        + g("cracks", f'<clipPath id="{d.prefix}__clip"><ellipse cx="{cx}" cy="{cy}" rx="168" ry="242"/></clipPath>'
            f'<g clip-path="url(#{d.prefix}__clip)">{cracks}' + circle(cx, cy, 14, P["white"]) + "</g>")
        + g("shards", shards)
    )
    return obj("Pasqyrë e thyer", (w, h), body, {"center": [cx / w, cy / h], "ground": [0.5, 1.0]},
               ["mirror", "broken", "self-image", "identity", "trauma", "self-esteem", "shattered", "reflection"],
               {"frame": "statike", "glass": "statik", "cracks": "opacity 0 → 1 = plasaritja (receta `crack`)", "shards": "copëzat në dysheme (fade)"},
               "An oval brass-framed mirror with a crack spreading from the centre and shards on the floor.",
               "A broken self-image: shame, trauma, losing a sense of identity, how criticism breaks self-esteem.",
               animations=("pop_in", "fade", "slide", "shake", "crack"))


def theater_mask(d: Defs):
    w, h = 300, 360
    face = "M40,60 Q40,20 150,16 Q260,20 260,60 Q266,200 214,280 Q180,330 150,334 Q120,330 86,280 Q34,200 40,60 Z"
    body = g("mask",
             path(face, d.d("mk", P["white"], P["marble_d"]))
             + path("M70,70 Q72,40 150,36 Q100,60 92,170 Q86,220 108,280 Q60,200 70,70 Z", P["white"], 'opacity="0.6"')
             + path("M76,130 Q100,104 128,128 Q104,150 76,130 Z", INK) + path("M172,128 Q200,104 224,130 Q196,150 172,128 Z", INK)
             + line("M70,104 Q100,84 130,100 M170,100 Q200,84 230,104", P["marble_dd"], 6)
             + path("M150,150 L140,210 Q150,218 160,210 Z", P["marble_d"])
             + path("M112,248 Q150,262 188,248 Q150,276 112,248 Z", P["red_d"])
             + line("M40,90 Q10,96 4,130 M260,90 Q290,96 296,130", P["red"], 6), (150, 180))
    return obj("Maskë teatri", (w, h), body, {"center": [0.5, 0.5], "face": [0.5, 0.45]},
               ["mask", "theater", "persona", "fake", "social-mask", "hiding", "identity", "pretending", "impostor"],
               {"mask": "pop_in, sway; mund të vendoset para fytyrës së një personazhi"},
               "A white theatre mask with a calm neutral face, dark eye holes and red ribbons.",
               "The social mask: the persona we show, hiding true feelings, impostor syndrome. Place it over a character's face.")


def theater_masks(d: Defs):
    w, h = 520, 400

    def mask(cx, cy, rot, fill, happy, gid):
        mouth = (f"M{cx-46},{cy+60} Q{cx},{cy+120} {cx+46},{cy+60} Q{cx},{cy+86} {cx-46},{cy+60} Z" if happy
                 else f"M{cx-44},{cy+92} Q{cx},{cy+40} {cx+44},{cy+92} Q{cx},{cy+70} {cx-44},{cy+92} Z")
        eyes = ((f"M{cx-74},{cy-10} Q{cx-48},{cy-40} {cx-20},{cy-10} Q{cx-48},{cy+2} {cx-74},{cy-10} Z", f"M{cx+20},{cy-10} Q{cx+48},{cy-40} {cx+74},{cy-10} Q{cx+48},{cy+2} {cx+20},{cy-10} Z")
                if happy else
                (f"M{cx-74},{cy-16} Q{cx-48},{cy+10} {cx-20},{cy-16} Q{cx-48},{cy-34} {cx-74},{cy-16} Z", f"M{cx+20},{cy-16} Q{cx+48},{cy+10} {cx+74},{cy-16} Q{cx+48},{cy-34} {cx+20},{cy-16} Z"))
        brows = (f"M{cx-80},{cy-44} Q{cx-50},{cy-64} {cx-18},{cy-46} M{cx+18},{cy-46} Q{cx+50},{cy-64} {cx+80},{cy-44}" if happy
                 else f"M{cx-80},{cy-30} Q{cx-50},{cy-60} {cx-18},{cy-62} M{cx+18},{cy-62} Q{cx+50},{cy-60} {cx+80},{cy-30}")
        return g(gid, f'<g transform="rotate({rot} {cx} {cy})">'
                 + path(f"M{cx-110},{cy-90} Q{cx-110},{cy-130} {cx},{cy-134} Q{cx+110},{cy-130} {cx+110},{cy-90} Q{cx+116},{cy+40} {cx+64},{cy+120} Q{cx+30},{cy+166} {cx},{cy+168} Q{cx-30},{cy+166} {cx-64},{cy+120} Q{cx-116},{cy+40} {cx-110},{cy-90} Z", fill)
                 + path(eyes[0], INK) + path(eyes[1], INK) + line(brows, INK, 7) + path(mouth, INK) + "</g>", (cx, cy))

    body = (mask(340, 200, 14, d.d("trag", P["blue_l"], P["blue_dd"]), False, "tragedy")
            + mask(180, 196, -12, d.d("com", P["gold_l"], P["gold_d"]), True, "comedy")
            + line("M80,120 Q30,170 60,250 Q80,300 40,340 M440,120 Q500,160 470,240 Q450,300 490,350", P["red"], 7))
    return obj("Dy maska teatri (gëzim dhe trishtim)", (w, h), body, {"center": [0.5, 0.5]},
               ["masks", "theater", "comedy", "tragedy", "duality", "emotions", "persona", "two-faces", "hypocrisy", "manipulation"],
               {"comedy": "maska e gëzuar (e artë)", "tragedy": "maska e trishtuar (blu); secila sway/fade më vete"},
               "Two overlapping theatre masks: a smiling gold comedy mask and a sad blue tragedy mask, with ribbons.",
               "Duality and two faces: the smile we show versus what we feel, manipulation, politics and acting.",
               themes=["psychology", "decisions", "philosophy"])


def mirror_reflection(d: Defs):
    w, h = 340, 560
    cx, cy = 170, 200
    body = (
        contact_shadow(d, cx, h, 110, 10)
        + g("stand", lathe(d, "st", cx, [(370, 10), (520, 10), (540, 60), (560, 70)], P["brass_l"], P["brass_d"]))
        + g("frame", circle(cx, cy, 168, d.d("fr", P["brass_l"], P["brass_d"])) + circle(cx, cy, 150, P["brass_d"]))
        + g("glass", circle(cx, cy, 146, d.d("gl", P["sky_l"], P["glass"])))
        + g("reflection",
            path(f"M{cx-60},{cy+146} Q{cx-70},{cy+70} {cx-30},{cy+56} L{cx+30},{cy+56} Q{cx+70},{cy+70} {cx+60},{cy+146} Z", P["blue_l"], 'opacity="0.75"')
            + ellipse(cx, cy - 10, 58, 72, P["blue_l"], 'opacity="0.75"')
            + path(f"M{cx-58},{cy-14} Q{cx-60},{cy-90} {cx},{cy-90} Q{cx+60},{cy-90} {cx+58},{cy-14} Q{cx+40},{cy-60} {cx},{cy-58} Q{cx-40},{cy-60} {cx-58},{cy-14} Z", P["blue"], 'opacity="0.75"')
            + line(f"M{cx-28},{cy-6} h18 M{cx+10},{cy-6} h18 M{cx-14},{cy+36} Q{cx},{cy+30} {cx+14},{cy+36}", P["blue_dd"], 5, 'opacity="0.7"'))
        + sheen(f"M{cx-110},{cy-80} Q{cx-70},{cy-140} {cx-10},{cy-146} L{cx-120},{cy+40} Q{cx-140},{cy-20} {cx-110},{cy-80} Z", 0.45)
    )
    return obj("Fytyrë e reflektuar në pasqyrë", (w, h), body, {"ground": [0.5, 1.0], "glass": [cx / w, cy / h]},
               ["mirror", "reflection", "face", "self-reflection", "identity", "self-awareness", "introspection", "vanity"],
               {"reflection": "fade: reflektimi shfaqet/zhduket; mund të ndryshohet me shprehje tjetër", "glass": "statik"},
               "A round brass vanity mirror on a stand, showing the soft blue reflection of a face.",
               "Self-reflection and self-awareness: looking at yourself honestly, how others see you, identity.")


def labyrinth_entrance(d: Defs):
    w, h = 980, 640
    hedge = d.v("hg", P["green"], P["green_dd"])
    leaves = "".join(circle(x, y, 18, P["green_l"], 'opacity="0.35"') for x, y in
                     [(60, 120), (140, 90), (240, 140), (90, 260), (200, 330), (300, 220), (700, 110), (820, 150), (900, 90), (760, 300), (880, 360), (690, 240)])
    body = (
        contact_shadow(d, 490, h, 480, 20, 0.25)
        + g("path_in", poly([(380, h), (600, h), (540, 330), (440, 330)], d.v("pth", P["sand"], P["sand2"])))
        + g("inner", rect(420, 150, 140, 190, d.v("in", P["green_dd"], INK)) + rect(440, 300, 100, 40, P["green_dd"]))
        + g("walls",
            path(f"M0,{h} V120 Q0,70 60,60 L360,40 Q400,40 400,80 V{h} Z", hedge)
            + path(f"M{w},{h} V120 Q{w},70 {w-60},60 L620,40 Q580,40 580,80 V{h} Z", hedge)
            + path("M400,80 Q490,-10 580,80 V150 Q490,90 400,150 Z", hedge)
            + leaves
            + rect(0, h - 40, 400, 40, P["green_dd"], extra='opacity="0.5"') + rect(580, h - 40, 400, 40, P["green_dd"], extra='opacity="0.5"'))
    )
    return obj("Hyrja e labirintit", (w, h), body, {"ground": [0.5, 1.0], "entrance": [0.5, 0.52]},
               ["labyrinth", "maze", "entrance", "hedge", "confusion", "journey", "unknown", "complexity", "beginning"],
               {"walls": "statike", "inner": "errësira e brendshme", "path_in": "shtegu hyrës"},
               "A tall green hedge wall with an arched opening and a sandy path leading into a dark maze.",
               "Stepping into confusion or a complex problem, the start of a hard journey, choices with no map.",
               themes=["psychology", "philosophy", "decisions"])


def cage(d: Defs, mode: str = "locked"):
    w, h = 640, 1060
    x0, x1, top, base = 40, 600, 150, h - 40
    bars = lambda xs: "".join(rect(x - 7, top + 20, 14, base - top - 30, d.h("bar", P["steel_l"], P["steel_dd"]), rx=5) for x in xs)
    door_xs = [240, 300, 360, 420]
    door = (bars(door_xs) + rect(228, 360, 204, 16, P["steel_d"], rx=6) + rect(228, 700, 204, 16, P["steel_d"], rx=6))
    lock = rect(406, 520, 52, 46, d.d("lk", P["gold_l"], P["gold_d"]), rx=8) + path("M416,522 V500 Q432,476 448,500 V522", "none", f'stroke="{P["steel_d"]}" stroke-width="9"')
    door_g = g("door", door, (228, 540))
    if mode == "open":
        door_g = f'<g id="door" data-pivot="228,540"><g transform="translate(228 0) scale(-0.35 1) translate(-228 0)">{door}</g></g>'
        lock = ""
    body = (
        contact_shadow(d, 320, h, 320, 22)
        + g("back", bars([100, 160, 480, 540]) + ellipse(320, base, 280, 30, P["steel_dd"], 'opacity="0.5"'))
        + g("frame",
            path(f"M{x0},{top+40} Q{x0},{top-120} 320,{top-130} Q{x1},{top-120} {x1},{top+40} Z", "none", f'stroke="{P["steel_d"]}" stroke-width="16"')
            + rect(304, 0, 32, 30, P["steel_d"], rx=8) + circle(320, 8, 22, "none", f'stroke="{P["steel_d"]}" stroke-width="10"')
            + rect(x0 - 20, top + 30, x1 - x0 + 40, 24, d.v("rim", P["steel_l"], P["steel_dd"]), rx=10)
            + rect(x0 - 30, base - 20, x1 - x0 + 60, 40, d.v("base", P["slate_l"], P["slate_dd"]), rx=12)
            + bars([x0 + 10, x1 - 10]))
        + door_g
        + g("lock", lock)
    )
    return obj("Kafaz", (w, h), body, {"ground": [0.5, 1.0], "inside": [0.5, 0.94], "door": [228 / w, 540 / h]},
               ["cage", "trapped", "prison", "limiting-beliefs", "fear", "comfort-zone", "freedom", "control", "locked"],
               {"door": "receta `open`: dera hapet (scaleX)", "lock": "dryni zhduket kur hapet", "frame": "statik", "back": "hekurat e pasmë"},
               "A tall steel cage with a domed top and a padlocked front door. A standing character fits inside (anchor inside).",
               "Feeling trapped: limiting beliefs, fear, a toxic job or relationship. Open it (recipe `open` or variant `open`) for freedom.",
               animations=("pop_in", "fade", "slide", "shake", "open"), variants={"open": "open.svg"})


def glass_wall(d: Defs, mode: str = "wall"):
    w, h = 820, 1100
    pane = lambda x0, y0, x1, y1, name: (
        poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], d.d(name, P["sky_l"], P["glass"]), 'opacity="0.55"')
        + line(f"M{x0},{y0} H{x1} V{y1} H{x0} Z", P["white"], 6, 'opacity="0.9"')
        + poly([(x0 + 40, y0), (x0 + 140, y0), (x0 + 40, y1 - 200), (x0, y1 - 200), (x0, y0 + 60)], P["white"], 'opacity="0.22"')
        + poly([(x0 + 210, y0), (x0 + 250, y0), (x0 + 120, y1), (x0 + 80, y1)], P["white"], 'opacity="0.14"'))
    if mode == "box":
        body = (contact_shadow(d, 410, h, 380, 20, 0.2)
                + g("back", poly([(150, 100), (670, 100), (670, h - 80), (150, h - 80)], P["glass"], 'opacity="0.3"')
                    + line(f"M150,100 H670 V{h-80} H150 Z", P["white"], 4, 'opacity="0.7"'))
                + g("sides", poly([(40, 40), (150, 100), (150, h - 80), (40, h - 10)], P["glass"], 'opacity="0.45"')
                    + poly([(780, 40), (670, 100), (670, h - 80), (780, h - 10)], P["glass"], 'opacity="0.45"')
                    + line(f"M40,40 L150,100 M780,40 L670,100 M40,{h-10} L150,{h-80} M780,{h-10} L670,{h-80}", P["white"], 5, 'opacity="0.8"'))
                + g("pane", pane(40, 40, 780, h - 10, "pf")))
    else:
        body = (contact_shadow(d, 410, h, 400, 14, 0.15)
                + g("pane", pane(30, 30, 790, h - 30, "pf"))
                + g("feet", rect(60, h - 40, 140, 40, P["steel_d"], rx=8) + rect(620, h - 40, 140, 40, P["steel_d"], rx=8)))
        if mode == "cracked":
            rng = random.Random(3)
            c = (520, 520)
            body += g("crack", "".join(line(f"M{c[0]},{c[1]} L{c[0] + r * math.cos(a):.0f},{c[1] + r * math.sin(a):.0f} l{rng.uniform(-40, 40):.0f},{rng.uniform(-40, 40):.0f}", P["white"], 4)
                                       for a, r in [(i * 0.7, rng.uniform(140, 260)) for i in range(9)])
                      + "".join(f'<circle cx="{c[0]}" cy="{c[1]}" r="{r}" fill="none" stroke="{P["white"]}" stroke-width="3" opacity="0.8"/>' for r in (24, 60)))
    return obj("Mur xhami i padukshëm", (w, h), body, {"ground": [0.5, 1.0], "behind": [0.5, 0.97]},
               ["glass", "invisible-wall", "barrier", "glass-ceiling", "isolation", "boundary", "trapped", "separation"],
               {"pane": "xhami (fade = bëhet i dukshëm)", "feet": "mbajtëset në dysheme"},
               "A tall clear glass pane standing on the floor with soft reflections. Variants: `box` (glass box around a person), `cracked`.",
               "Invisible barriers: the glass ceiling, feeling separated from others, a boundary you only notice when you hit it. Put a character behind it.",
               variants={"box": "box.svg", "cracked": "cracked.svg"})


def heavy_chains(d: Defs):
    w, h = 760, 300

    def link(cx, cy, rot, name):
        return (f'<g transform="rotate({rot} {cx} {cy})">'
                + f'<rect x="{cx-42}" y="{cy-24}" width="84" height="48" rx="24" fill="none" stroke="{d.d(name, P["steel_l"], P["steel_dd"])}" stroke-width="22"/>'
                + f'<rect x="{cx-38}" y="{cy-24}" width="40" height="8" rx="4" fill="{P["white"]}" opacity="0.4"/></g>')

    pts = [(40 + i * 62, 90 + 70 * math.sin(i / 11 * math.pi)) for i in range(12)]
    links = "".join(link(x, y, (i % 2) * 90 + 10 * math.cos(i / 11 * math.pi), "ln") for i, (x, y) in enumerate(pts))
    body = (
        g("chain", links)
        + g("padlock", rect(330, 180, 110, 96, d.d("pl", P["slate_l"], P["slate_dd"]), rx=14)
            + path("M350,182 V150 Q385,104 420,150 V182", "none", f'stroke="{P["steel"]}" stroke-width="16"')
            + circle(385, 222, 12, INK) + rect(380, 222, 10, 30, INK, rx=4), (385, 150))
    )
    return obj("Zinxhirë të rëndë", (w, h), body, {"center": [0.5, 0.45]},
               ["chains", "heavy", "burden", "addiction", "debt", "guilt", "trapped", "habit", "restriction"],
               {"chain": "sway i rëndë", "padlock": "shake"},
               "A heavy steel chain sagging across the frame with a dark padlock hanging from the middle.",
               "What weighs on us: debt, guilt, addiction, bad habits, obligations that hold someone back.",
               animations=("pop_in", "fade", "slide", "shake", "sway"))


def door_light(d: Defs, mode: str = "closed"):
    w, h = 560, 1080
    fx0, fx1, ftop, base = 90, 470, 80, h - 30
    light = (poly([(fx0 + 20, ftop + 20), (fx1 - 20, ftop + 20), (fx1 + 60, base), (fx0 - 60, base)], d.glow("spill", P["warm_light"], 0.6, 0.0))
             + rect(fx0 + 20, ftop + 20, fx1 - fx0 - 40, base - ftop - 20, d.v("lit", P["warm_light2"], P["warm_light"])))
    leaf = (rect(fx0 + 20, ftop + 20, fx1 - fx0 - 40, base - ftop - 20, d.h("lf", P["wood"], P["wood_dd"]))
            + rect(fx0 + 50, ftop + 60, fx1 - fx0 - 100, 330, P["wood_d"], rx=8) + rect(fx0 + 50, ftop + 440, fx1 - fx0 - 100, 440, P["wood_d"], rx=8)
            + circle(fx1 - 56, ftop + 480, 14, P["gold"]))
    if mode == "open":
        leaf_g = (f'<g id="leaf" data-pivot="{fx0+20},{(ftop+base)/2:.0f}"><g transform="translate({fx0+20} 0) scale(0.16 1) translate({-(fx0+20)} 0)">{leaf}</g></g>')
    else:
        leaf_g = g("leaf", leaf, (fx0 + 20, (ftop + base) / 2))
    chains = ""
    if mode == "locked":
        light = rect(fx0 + 20, ftop + 20, fx1 - fx0 - 40, base - ftop - 20, P["slate_dd"])
        chains = g("chains", line(f"M{fx0},{ftop+300} L{fx1},{ftop+700} M{fx1},{ftop+300} L{fx0},{ftop+700}", P["steel_dd"], 22)
                   + line(f"M{fx0},{ftop+300} L{fx1},{ftop+700} M{fx1},{ftop+300} L{fx0},{ftop+700}", P["steel"], 10, 'stroke-dasharray="26 12"')
                   + rect(fx0 + 130, ftop + 470, 120, 104, d.d("pl", P["gold_l"], P["gold_d"]), rx=14)
                   + path(f"M{fx0+150},{ftop+472} V{ftop+440} Q{fx0+190},{ftop+390} {fx0+230},{ftop+440} V{ftop+472}", "none", f'stroke="{P["steel_d"]}" stroke-width="16"'))
    seam = "" if mode != "closed" else line(f"M{fx1-22},{ftop+24} V{base}", P["warm_light2"], 10)
    halo = "" if mode == "locked" else ellipse(w / 2, ftop + 480, 300, 560, d.glow("halo", P["warm_light"], 0.65, 0.0, 0.3))
    floor_light = "" if mode != "closed" else poly([(fx0 + 20, base - 4), (fx1 - 20, base - 4), (fx1 + 30, base + 20), (fx0 - 30, base + 20)], P["warm_light"], 'opacity="0.8"')
    body = (
        contact_shadow(d, w / 2, h, 240, 14, 0.25)
        + halo
        + g("light", light)
        + leaf_g + seam
        + g("frame", path(f"M{fx0-20},{base} V{ftop} H{fx1+20} V{base} H{fx1-20} V{ftop+20} H{fx0+20} V{base} Z", d.h("fr", P["cream"], P["sand3"])))
        + chains + floor_light
    )
    return obj("Derë drejt dritës", (w, h), body, {"ground": [0.5, 1.0], "doorway": [0.5, 0.97], "hinge": [(fx0 + 20) / w, 0.5]},
               ["door", "opportunity", "new-beginning", "choice", "unknown", "light", "hope", "change", "locked", "closed-door"],
               {"leaf": "receta `open`: dera hapet (scaleX → 0.16) dhe zbulon dritën", "light": "drita pas derës", "frame": "kasa"},
               "A freestanding door frame with warm light glowing at the edges of the closed door. Variants: `open` (light pours out), `locked` (chained, dark).",
               "Opportunity and change: a new beginning, stepping into the unknown. Locked variant: a closed opportunity, fear, rejection.",
               animations=("pop_in", "fade", "slide", "shake", "open"), variants={"open": "open.svg", "locked": "locked.svg"})


def many_doors(d: Defs):
    w, h = 1500, 900
    cols = [(P["teal"], P["teal_d"]), (P["red"], P["red_d"]), (P["blue"], P["blue_dd"]), (P["gold"], P["gold_d"]), (P["violet"], P["violet_d"])]
    doors = ""
    for i, (c1, c2) in enumerate(cols):
        x = 60 + i * 285
        leaf = (rect(x + 18, 120, 194, h - 160, d.h(f"d{i}", c1, c2)) + rect(x + 40, 160, 150, 260, c2, rx=8, extra='opacity="0.6"')
                + rect(x + 40, 460, 150, 260, c2, rx=8, extra='opacity="0.6"') + circle(x + 186, 500, 11, P["gold_l"]))
        doors += (rect(x, 100, 230, h - 120, d.h(f"fr{i}", P["cream"], P["sand3"]))
                  + rect(x + 18, 120, 194, h - 140, d.v(f"in{i}", P["warm_light"], P["gold"]))
                  + g(f"door_{i+1}", leaf, (x + 18, h / 2)))
    body = contact_shadow(d, w / 2, h, 720, 20, 0.22) + rect(20, h - 24, w - 40, 24, P["sand3"], rx=8) + doors
    return obj("Shumë dyer", (w, h), body, {"ground": [0.5, 1.0], **{f"door_{i+1}": [(173 + i * 285) / w, 0.5] for i in range(5)}},
               ["doors", "choices", "options", "paradox-of-choice", "decision", "opportunity", "overwhelm", "fomo"],
               {**{f"door_{i+1}": "scaleX 1 → 0.15 = hapet (receta `open_middle` hap të tretën)" for i in range(5)}},
               "Five coloured doors standing side by side, warm light behind each one.",
               "Too many options: the paradox of choice, decision paralysis, FOMO, picking one path out of many.",
               animations=("pop_in", "fade", "slide", "open_middle"), themes=["psychology", "decisions", "money"])


def key(d: Defs):
    w, h = 440, 170
    body = (
        g("key",
          circle(84, 85, 70, d.d("bw", P["gold_l"], P["gold_d"])) + circle(84, 85, 38, P["cream"], 'opacity="0"')
          + f'<circle cx="84" cy="85" r="40" fill="none" stroke="{P["gold_d"]}" stroke-width="6"/>'
          + star(84, 85, 30, 12, 6, P["gold_d"]) + circle(84, 85, 12, P["gold_l"])
          + rect(146, 70, 260, 30, d.v("sh", P["gold_l"], P["gold_d"]), rx=12)
          + rect(160, 64, 22, 42, P["gold"], rx=8)
          + path("M330,96 h26 v40 h-12 v-18 h-14 Z M370,96 h30 v54 h-14 v-24 h-16 Z", d.v("bit", P["gold"], P["gold_d"]))
          + sheen("M150,72 H390 V78 H150 Z", 0.6) + sheen("M40,60 Q60,24 100,20 Q60,40 52,74 Z", 0.5), (220, 85))
    )
    return obj("Çelës i artë antik", (w, h), body, {"center": [0.5, 0.5]},
               ["key", "solution", "secret", "access", "unlock", "answer", "power", "opportunity", "insight"],
               {"key": "spin/rotation = hap derën; pop_in"},
               "A large antique golden key with an ornate star-shaped bow.",
               "The key to something: the answer, the secret, access to a locked room or opportunity, unlocking potential.",
               animations=("pop_in", "fade", "slide", "spin", "float"))


def stopwatch(d: Defs):
    w, h = 240, 290
    cx, cy, r = 120, 168, 100
    body = (
        g("case", rect(104, 20, 32, 34, d.h("cr", P["steel_l"], P["steel_dd"]), rx=6) + rect(94, 10, 52, 16, P["steel_d"], rx=6)
          + rect(186, 56, 34, 22, P["steel_d"], rx=6, extra='transform="rotate(40 203 67)"')
          + circle(cx, cy, r + 12, d.d("cs", P["steel_l"], P["steel_dd"])) + circle(cx, cy, r, d.d("fc", P["white"], P["cream2"]))
          + "".join(rect(cx - 2, cy - r + 8, 4, 10 if a % 30 else 18, INK if a % 30 == 0 else P["steel_d"], extra=f'transform="rotate({a} {cx} {cy})"') for a in range(0, 360, 6))
          + circle(cx, cy - 40, 22, "none", f'stroke="{P["steel"]}" stroke-width="3"'))
        + g("hand", rect(cx - 3, cy - 88, 6, 98, P["red"], rx=3), (cx, cy))
        + circle(cx, cy, 9, P["red_d"])
        + sheen(f"M{cx-70},{cy-50} Q{cx-30},{cy-96} {cx+20},{cy-96} Q{cx-36},{cy-76} {cx-60},{cy-26} Z", 0.6)
    )
    return obj("Kronometër", (w, h), body, {"center": [cx / w, cy / h]},
               ["stopwatch", "time", "timer", "deadline", "speed", "pressure", "urgency", "race", "productivity"],
               {"hand": "rotation e vazhdueshme (spin) = koha rrjedh", "case": "statik"},
               "A silver stopwatch with a red second hand and a crown button.",
               "Time pressure and urgency, deadlines, speed, productivity, the countdown before a decision.",
               animations=("pop_in", "fade", "slide", "shake", "pulse"))


def wall_calendar(d: Defs):
    w, h = 320, 400
    cells = ""
    for r in range(5):
        for c in range(7):
            x, y = 34 + c * 37, 150 + r * 44
            cells += rect(x, y, 30, 36, P["cream2"] if (r, c) != (2, 4) else P["white"], rx=4)
            if r * 7 + c < 16:
                cells += line(f"M{x+6},{y+8} L{x+24},{y+28} M{x+24},{y+8} L{x+6},{y+28}", P["red"], 4, 'opacity="0.75"')
    body = (
        g("board", rect(14, 40, 292, 350, d.v("bd", P["white"], P["cream2"]), rx=10) + rect(14, 370, 292, 20, P["cream3"], rx=8))
        + g("header", rect(14, 40, 292, 88, d.v("hd", P["red_l"], P["red_d"]), rx=10) + rect(14, 110, 292, 18, P["red_d"])
            + rect(110, 70, 100, 16, P["white"], rx=8, extra='opacity="0.75"'))
        + "".join(rect(x, 22, 12, 40, P["steel_d"], rx=6) for x in (70, 120, 190, 240))
        + g("days", cells + f'<circle cx="{34+4*37+15}" cy="{150+2*44+18}" r="24" fill="none" stroke="{P["red"]}" stroke-width="5"/>')
        + path("M296,390 L306,370 L306,390 Z", P["cream3"])
    )
    return obj("Kalendar muri", (w, h), body, {"center": [0.5, 0.5], "today": [(34 + 4 * 37 + 15) / w, (150 + 2 * 44 + 18) / h]},
               ["calendar", "dates", "deadline", "time", "habit", "streak", "planning", "routine", "days-passing"],
               {"days": "ditët e kaluara janë kryqëzuar; dita e rrethuar = sot / afati", "header": "statik"},
               "A spiral wall calendar with a red header; past days crossed out in red and one day circled.",
               "Time passing, a deadline approaching, habit streaks, 'it has been 30 days', planning versus doing.")


def candle(d: Defs):
    w, h = 140, 320
    body = (
        contact_shadow(d, 70, h, 56, 6)
        + g("glow", circle(70, 64, 70, d.glow("gl", P["warm_light"], 0.7, 0.0)), (70, 64))
        + g("candle", rect(36, 112, 68, h - 118, d.h("cd", P["cream"], P["marble_d"], P["white"]), rx=6)
            + path("M36,118 Q36,108 52,108 L92,108 Q104,108 104,118 L104,150 Q98,160 96,140 Q94,124 86,130 L80,170 Q74,182 70,166 L66,128 Q58,120 52,136 Q48,150 42,140 Z", P["white"])
            + line("M70,110 V86", INK, 4))
        + g("flame", path("M70,30 Q90,62 86,80 Q82,98 70,98 Q58,98 54,80 Q50,62 70,30 Z", d.v("fl", P["warm_light2"], P["orange"]))
            + path("M70,60 Q78,76 76,86 Q74,94 70,94 Q66,94 64,86 Q62,76 70,60 Z", P["white"]), (70, 98))
    )
    return obj("Qiri që digjet", (w, h), body, {"ground": [0.5, 1.0], "flame": [0.5, 64 / h]},
               ["candle", "flame", "hope", "time", "burnout", "fragile", "light-in-darkness", "memory", "mourning"],
               {"flame": "sway i lehtë = flaka dridhet", "glow": "pulse", "candle": "scaleY zvogëlohet = koha që digjet"},
               "A white pillar candle with wax drips and a warm flickering flame.",
               "Hope in darkness, time burning away, burnout ('burning the candle at both ends'), remembrance.",
               animations=("pop_in", "fade", "slide", "sway", "pulse"))


def thought_bubble(d: Defs):
    w, h = 560, 460
    rng = random.Random(5)
    lumps = [(280 + 200 * math.cos(a), 170 + 120 * math.sin(a)) for a in [i * math.pi / 5 for i in range(10)]]
    cloud = "".join(circle(x, y, rng.uniform(70, 92), P["white"]) for x, y in lumps) + ellipse(280, 170, 220, 130, P["white"])
    shade = "".join(circle(x, y + 12, rng.uniform(64, 84), P["cream3"]) for x, y in lumps if y > 170)
    body = (
        g("cloud", shade + cloud, (280, 170))
        + g("dot_1", circle(130, 360, 32, P["white"]) + circle(130, 368, 28, P["cream3"], 'opacity="0.5"'), (130, 360))
        + g("dot_2", circle(70, 420, 18, P["white"]), (70, 420))
    )
    return obj("Flluskë mendimi", (w, h), body, {"content": [0.5, 0.37], "tail": [70 / w, 420 / h]},
               ["thought", "bubble", "thinking", "idea", "imagination", "inner-voice", "daydream", "worry"],
               {"cloud": "pop_in pas pikave; vendos përmbajtjen mbi anchor `content`", "dot_1": "pop_in", "dot_2": "pop_in (e para)"},
               "A white cloud-shaped thought bubble with two small circles trailing to the lower left.",
               "What a character is thinking, imagining or worrying about. Put the tail near the head and an object over `content`.",
               animations=("pop_in", "fade", "float", "bob"))


def puzzle_piece_path(x, y, s, knobs):
    """Pjesë puzzle-i katrore s×s; knobs = (lart, djathtas, poshtë, majtas) me 1 jashtë, -1 brenda, 0 drejt."""
    t, r, b, l = knobs
    k = s * 0.18

    def edge(x0, y0, dx, dy, kn):
        if kn == 0:
            return f" L{x0+dx},{y0+dy}"
        nx, ny = -dy / s * kn * k * 1.4, dx / s * kn * k * 1.4
        nx, ny = -nx, -ny
        mx, my = x0 + dx * 0.38, y0 + dy * 0.38
        ex, ey = x0 + dx * 0.62, y0 + dy * 0.62
        return (f" L{mx:.1f},{my:.1f} C{mx + nx * 0.2 - dx * 0.1:.1f},{my + ny * 0.2 - dy * 0.1:.1f} {mx + nx - dx * 0.12:.1f},{my + ny - dy * 0.12:.1f} {x0 + dx * 0.5 + nx:.1f},{y0 + dy * 0.5 + ny:.1f}"
                f" C{ex + nx + dx * 0.12:.1f},{ey + ny + dy * 0.12:.1f} {ex + nx * 0.2 + dx * 0.1:.1f},{ey + ny * 0.2 + dy * 0.1:.1f} {ex:.1f},{ey:.1f} L{x0+dx},{y0+dy}")
    return (f"M{x},{y}" + edge(x, y, s, 0, t) + edge(x + s, y, 0, s, r) + edge(x + s, y + s, -s, 0, b) + edge(x, y + s, 0, -s, l) + " Z")


def puzzle_pieces(d: Defs):
    w, h = 560, 440
    s = 150
    pieces = [((90, 90), (0, 1, -1, 0), P["teal"], P["teal_d"]), ((240, 90), (0, 0, 1, -1), P["gold"], P["gold_d"]),
              ((90, 240), (1, -1, 0, 0), P["blue"], P["blue_dd"]), ((390, 270), (-1, 0, 0, 1), P["red"], P["red_d"])]
    body = contact_shadow(d, 280, h, 230, 14, 0.18)
    for i, ((x, y), kn, c1, c2) in enumerate(pieces):
        rot = ' transform="rotate(14 465 345)"' if i == 3 else ""
        body += g(f"piece_{i+1}", f"<g{rot}>" + path(puzzle_piece_path(x, y + 8, s, kn), c2) + path(puzzle_piece_path(x, y, s, kn), d.d(f"p{i}", c1, c2))
                  + sheen(f"M{x+12},{y+12} H{x+80} L{x+12},{y+60} Z", 0.3) + "</g>", (x + s / 2, y + s / 2))
    return obj("Pjesë puzzle-i", (w, h), body, {"center": [0.5, 0.5], "gap": [(240 + 75) / w, (240 + 75) / h]},
               ["puzzle", "pieces", "missing-piece", "problem-solving", "fit", "teamwork", "understanding", "connection"],
               {f"piece_{i+1}": "slide/pop_in më vete; piece_4 është jashtë dhe mund të futet te anchor `gap`" for i in range(4)},
               "Three interlocking jigsaw pieces in teal, gold and blue, with a red fourth piece lying apart.",
               "The missing piece, solving a problem step by step, things finally fitting together, teamwork.")


def dice(d: Defs):
    w, h = 340, 240

    def die(x, y, s, name, top_pips, front_pips, side_pips):
        dx, dy = s * 0.45, s * 0.3
        top = poly([(x, y), (x + s, y), (x + s + dx, y - dy), (x + dx, y - dy)], P["white"])
        front = poly([(x, y), (x + s, y), (x + s, y + s), (x, y + s)], d.v(name, P["cream"], P["cream3"]))
        side = poly([(x + s, y), (x + s + dx, y - dy), (x + s + dx, y + s - dy), (x + s, y + s)], P["marble_d"])

        def pips(face, n):
            pos = {1: [(0.5, 0.5)], 2: [(0.25, 0.25), (0.75, 0.75)], 3: [(0.25, 0.25), (0.5, 0.5), (0.75, 0.75)],
                   4: [(0.25, 0.25), (0.75, 0.25), (0.25, 0.75), (0.75, 0.75)], 5: [(0.25, 0.25), (0.75, 0.25), (0.5, 0.5), (0.25, 0.75), (0.75, 0.75)],
                   6: [(0.25, 0.22), (0.75, 0.22), (0.25, 0.5), (0.75, 0.5), (0.25, 0.78), (0.75, 0.78)]}[n]
            out = ""
            for u, v in pos:
                if face == "front":
                    out += circle(x + u * s, y + v * s, s * 0.08, P["red"] if n == 1 else INK)
                elif face == "top":
                    out += ellipse(x + u * s + (1 - v) * dx, y - (1 - v) * dy, s * 0.07, s * 0.045, INK)
                else:
                    out += ellipse(x + s + u * dx, y - u * dy + v * s, s * 0.035, s * 0.07, INK)
            return out
        return top + front + side + pips("top", top_pips) + pips("front", front_pips) + pips("side", side_pips)

    body = (contact_shadow(d, 170, h, 150, 12)
            + g("die_1", die(30, 110, 110, "d1", 2, 5, 3), (85, 165))
            + g("die_2", f'<g transform="rotate(-8 230 170)">' + die(180, 120, 100, "d2", 4, 1, 2) + "</g>", (230, 170)))
    return obj("Zare", (w, h), body, {"ground": [0.5, 1.0], "center": [0.5, 0.6]},
               ["dice", "chance", "luck", "random", "gambling", "risk", "probability", "gambler-fallacy", "fate"],
               {"die_1": "spin/bounce = hedhje", "die_2": "spin/bounce"},
               "Two white dice in three-quarter view showing pips, one with a red single pip.",
               "Chance and risk: luck versus skill, the gambler's fallacy, probability, decisions under uncertainty.",
               animations=("pop_in", "fade", "slide", "bounce", "spin", "shake"), themes=["psychology", "decisions", "money"])


def suit_shape(kind, cx, cy, s, fill):
    if kind == "heart":
        return path(f"M{cx},{cy+s} Q{cx-s*1.2},{cy+s*0.1} {cx-s*0.9},{cy-s*0.5} Q{cx-s*0.5},{cy-s*1.1} {cx},{cy-s*0.4} Q{cx+s*0.5},{cy-s*1.1} {cx+s*0.9},{cy-s*0.5} Q{cx+s*1.2},{cy+s*0.1} {cx},{cy+s} Z", fill)
    if kind == "diamond":
        return poly([(cx, cy - s), (cx + s * 0.75, cy), (cx, cy + s), (cx - s * 0.75, cy)], fill)
    if kind == "spade":
        return (path(f"M{cx},{cy-s} Q{cx+s*1.2},{cy-s*0.1} {cx+s*0.9},{cy+s*0.5} Q{cx+s*0.5},{cy+s*0.95} {cx},{cy+s*0.4} Q{cx-s*0.5},{cy+s*0.95} {cx-s*0.9},{cy+s*0.5} Q{cx-s*1.2},{cy-s*0.1} {cx},{cy-s} Z", fill)
                + poly([(cx, cy + s * 0.3), (cx + s * 0.35, cy + s * 1.1), (cx - s * 0.35, cy + s * 1.1)], fill))
    return (circle(cx, cy - s * 0.45, s * 0.42, fill) + circle(cx - s * 0.48, cy + s * 0.15, s * 0.42, fill) + circle(cx + s * 0.48, cy + s * 0.15, s * 0.42, fill)
            + poly([(cx, cy), (cx + s * 0.3, cy + s * 1.05), (cx - s * 0.3, cy + s * 1.05)], fill))


def playing_cards(d: Defs):
    w, h = 460, 360
    cards = [("club", INK, -24), ("diamond", P["red"], -8), ("spade", INK, 8), ("heart", P["red"], 24)]
    body = contact_shadow(d, 230, h, 170, 12, 0.18)
    for i, (k, c, rot) in enumerate(cards):
        x, y = 160, 60
        body += g(f"card_{i+1}", f'<g transform="rotate({rot} 230 330)">'
                  + rect(x + 4, y + 6, 140, 200, P["marble_d"], rx=12) + rect(x, y, 140, 200, d.v("cd", P["white"], P["cream2"]), rx=12)
                  + rect(x + 8, y + 8, 124, 184, "none", rx=8, extra=f'stroke="{P["cream3"]}" stroke-width="2"')
                  + suit_shape(k, x + 24, y + 30, 10, c) + suit_shape(k, x + 116, y + 168, 10, c) + suit_shape(k, x + 70, y + 98, 30, c) + "</g>", (230, 330))
    return obj("Letra loje", (w, h), body, {"center": [0.5, 0.45]},
               ["cards", "playing-cards", "gamble", "bluff", "risk", "strategy", "deception", "luck", "hidden-information"],
               {f"card_{i+1}": "pop_in/slide një nga një" for i in range(4)},
               "Four playing cards fanned out, each with one large suit symbol (club, diamond, spade, heart). No letters or numbers.",
               "Bluffing and hidden information, risk-taking, strategy and deception, 'playing your cards right'.",
               themes=["psychology", "decisions", "money"])


def warning_light(d: Defs):
    w, h = 260, 300
    body = (
        contact_shadow(d, 130, h, 100, 10)
        + g("glow", circle(130, 120, 130, d.glow("gl", P["red"], 0.55, 0.0)), (130, 120))
        + g("base", rect(50, 220, 160, 70, d.v("bs", P["slate_l"], P["slate_dd"]), rx=10) + rect(40, 206, 180, 22, P["slate"], rx=8))
        + g("dome", path("M64,208 V130 Q64,50 130,50 Q196,50 196,130 V208 Z", d.h("dm", P["red_l"], P["red_d"], P["red"]))
            + rect(104, 90, 52, 100, P["warm_light"], rx=10, extra='opacity="0.75"')
            + sheen("M80,190 V130 Q80,74 120,64 Q96,90 96,190 Z", 0.5), (130, 130))
    )
    return obj("Dritë paralajmëruese e kuqe", (w, h), body, {"ground": [0.5, 1.0], "center": [0.5, 0.42]},
               ["warning", "alarm", "danger", "red-flag", "alert", "stress", "fight-or-flight", "emergency", "amygdala"],
               {"glow": "pulse = alarmi ndizet e fiket", "dome": "statik"},
               "A red rotating warning beacon on a dark base, glowing.",
               "Alarm and danger signals: red flags in a relationship, the amygdala's fight-or-flight response, a warning sign.",
               animations=("pop_in", "fade", "slide", "pulse", "shake"))


def watching_eye(d: Defs):
    w, h = 760, 760
    cx, cy = 380, 380
    rays = "".join(poly([(cx + 220 * math.cos(a - 0.05), cy + 220 * math.sin(a - 0.05)), (cx + 370 * math.cos(a), cy + 370 * math.sin(a)),
                         (cx + 220 * math.cos(a + 0.05), cy + 220 * math.sin(a + 0.05))], P["gold_l"], 'opacity="0.55"') for a in [i * math.pi / 12 for i in range(24)])
    body = (
        g("rays", circle(cx, cy, 360, d.glow("aura", P["warm_light"], 0.6, 0.0)) + rays, (cx, cy))
        + g("white", path(eye_shape(cx, cy, 260, 110), d.v("sc", P["white"], P["cream2"])))
        + g("iris", circle(cx, cy, 104, d.d("ir", P["blue"], P["blue_dd"])) + circle(cx, cy, 48, INK)
            + circle(cx - 34, cy - 36, 20, P["white"]), (cx, cy))
        + g("lid", path(f"M{cx-280},{cy} Q{cx},{cy-250} {cx+280},{cy} Q{cx},{cy-220} {cx-280},{cy} Z", d.v("ld", P["slate_l"], P["slate_d"])), (cx, cy - 110))
        + path(eye_shape(cx, cy, 260, 110), "none", f'stroke="{INK}" stroke-width="12"')
    )
    return obj("Syri që vëzhgon", (w, h), body, {"center": [0.5, 0.5]},
               ["eye", "watching", "surveillance", "judgement", "social-pressure", "spotlight-effect", "big-brother", "observed", "paranoia"],
               {"iris": "receta `look_around`: shikon majtas-djathtas", "lid": "receta `blink`", "rays": "spin i ngadaltë"},
               "A huge open eye floating in a golden aura with rays, staring at the viewer.",
               "Being watched: social pressure, the spotlight effect, surveillance, judgement, the Hawthorne effect.",
               animations=("pop_in", "fade", "pulse", "blink", "look_around"))


def puppet_controller(d: Defs):
    w, h = 480, 760
    ends = [(60, 150), (420, 150), (240, 60), (240, 250), (150, 150), (330, 150)]
    strings = "".join(line(f"M{x},{y} L{x + (x - 240) * 0.15:.0f},{h - 30}", P["cream3"], 3) + circle(x + (x - 240) * 0.15, h - 26, 8, P["brass"]) for x, y in ends)
    body = (
        g("strings", strings)
        + g("control", rect(40, 136, 400, 30, d.v("bar", P["wood_l"], P["wood_dd"]), rx=12)
            + rect(225, 40, 30, 230, d.h("bar2", P["wood_l"], P["wood_dd"]), rx=12)
            + "".join(circle(x, y, 13, P["wood_dd"]) for x, y in ends), (240, 150))
        + g("hook", line("M240,40 V6", P["steel_d"], 6) + circle(240, 6, 6, P["steel_d"]))
    )
    return obj("Kontrolli i kukullës me fije", (w, h), body, {"top": [0.5, 0.0], "strings_end": [0.5, (h - 26) / h]},
               ["puppet", "strings", "control", "manipulation", "puppet-master", "influence", "power", "free-will"],
               {"control": "sway = dikush tërheq fijet", "strings": "statike; mbarojnë te anchor `strings_end`", "hook": "statik"},
               "A wooden marionette control cross hanging from a hook, with six strings hanging down.",
               "Manipulation and hidden control: who pulls the strings, the puppet master, propaganda, lack of free will. Hang it above a character.",
               animations=("pop_in", "fade", "slide", "sway"), themes=["psychology", "decisions", "philosophy"])


def compass(d: Defs):
    w, h = 280, 300
    cx, cy = 140, 160
    body = (
        contact_shadow(d, cx, h, 110, 8, 0.2)
        + g("case", rect(124, 16, 32, 28, d.h("cr", P["brass_l"], P["brass_d"]), rx=8) + circle(140, 14, 14, "none", f'stroke="{P["brass_d"]}" stroke-width="6"')
            + circle(cx, cy, 124, d.d("cs", P["brass_l"], P["brass_d"])) + circle(cx, cy, 104, d.d("fc", P["parch_l"], P["parch"]))
            + star(cx, cy, 86, 18, 4, P["parch_d"], -90) + star(cx, cy, 60, 12, 4, P["parch_d"], -45, 'opacity="0.6"')
            + "".join(rect(cx - 1.5, cy - 100, 3, 12, P["brass_d"], extra=f'transform="rotate({a} {cx} {cy})"') for a in range(0, 360, 15)))
        + g("needle", poly([(cx, cy - 84), (cx + 14, cy), (cx - 14, cy)], P["red"]) + poly([(cx, cy + 84), (cx + 14, cy), (cx - 14, cy)], P["slate_l"]), (cx, cy))
        + circle(cx, cy, 10, P["brass"])
        + sheen(f"M{cx-80},{cy-50} Q{cx-40},{cy-100} {cx+20},{cy-100} Q{cx-40},{cy-80} {cx-70},{cy-20} Z", 0.4)
    )
    return obj("Busull", (w, h), body, {"center": [cx / w, cy / h]},
               ["compass", "direction", "values", "purpose", "navigation", "moral-compass", "guidance", "lost"],
               {"needle": "rotation: gjilpëra lëkundet (shake) ose rrotullohet (spin) kur je i humbur", "case": "statik"},
               "A brass pocket compass with a parchment face, compass rose and a red needle.",
               "Inner direction: values, purpose, the moral compass, feeling lost and finding your way.",
               animations=("pop_in", "fade", "slide", "spin", "shake"), themes=["philosophy", "growth", "decisions"])


def signpost(d: Defs):
    w, h = 420, 820

    def board(y, dx, rot, c1, c2, name):
        x0 = 210 if dx > 0 else 210 - 190
        tip = x0 + 190 + 40 if dx > 0 else x0 - 40
        pts = [(x0, y), (x0 + 190, y), (tip, y + 32), (x0 + 190, y + 64), (x0, y + 64)] if dx > 0 else [(x0 + 190, y), (x0, y), (tip, y + 32), (x0, y + 64), (x0 + 190, y + 64)]
        return g(name, f'<g transform="rotate({rot} 210 {y + 32})">' + poly(pts, d.v(name, c1, c2))
                 + line(f"M{x0+30},{y+24} H{x0+160} M{x0+30},{y+42} H{x0+120}", c2, 5, 'opacity="0.5"') + "</g>", (210, y + 32))

    body = (
        contact_shadow(d, 210, h, 90, 10)
        + rect(196, 60, 28, h - 60, d.h("post", P["wood"], P["wood_ddd"]), rx=6) + poly([(196, 60), (224, 60), (210, 40)], P["wood_d"])
        + board(120, 1, -6, P["teal"], P["teal_d"], "sign_1") + board(240, -1, 4, P["orange"], P["orange_d"], "sign_2")
        + board(360, 1, 8, P["gold"], P["gold_d"], "sign_3")
        + "".join(circle(210, y + 32, 6, P["steel_d"]) for y in (120, 240, 360))
    )
    return obj("Tabelë udhëkryqi", (w, h), body, {"ground": [0.5, 1.0]},
               ["signpost", "crossroads", "direction", "choice", "decision", "options", "path", "uncertainty"],
               {f"sign_{i}": "shigjeta e drejtimit (pop_in/sway më vete)" for i in (1, 2, 3)},
               "A wooden signpost with three coloured arrow boards pointing in different directions. No text.",
               "Choosing a direction: a decision with several paths, uncertainty about the future, career or life choices.",
               themes=["decisions", "philosophy", "growth"])


def ladder(d: Defs):
    w, h = 300, 1000
    rails = rect(40, 0, 30, h, d.h("rl", P["wood_l"], P["wood_dd"]), rx=8) + rect(230, 0, 30, h, d.h("rr", P["wood_l"], P["wood_dd"]), rx=8)
    rungs = "".join(rect(62, y, 176, 20, d.v("rg", P["wood_l"], P["wood_d"]), rx=6) for y in range(80, h - 40, 120))
    body = contact_shadow(d, 150, h, 150, 10) + g("ladder", rungs + rails)
    return obj("Shkallë dore", (w, h), body, {"ground": [0.5, 1.0], "top": [0.5, 0.0]},
               ["ladder", "climb", "success", "career", "progress", "status", "ambition", "step-by-step", "social-ladder"],
               {"ladder": "statike"},
               "A tall wooden ladder standing upright, seen from the front.",
               "Climbing: career ladder, social status, ambition, progress step by step.",
               themes=["growth", "money", "decisions"])


def broken_stairs(d: Defs):
    w, h = 1200, 900
    steps = ""
    for i in range(9):
        x, y = 60 + i * 115, h - 60 - i * 85
        if i in (6, 7):
            continue
        steps += rect(x, y, 120, h - y, d.v(f"st{i}", P["sand"], P["sand3"]))
        steps += rect(x, y, 120, 16, P["marble_l"]) + rect(x + 112, y, 8, h - y, P["sand3"], extra='opacity="0.7"')
    falling = (f'<g transform="rotate(18 {60+6*115+60} {h-60-6*85+60})">' + rect(60 + 6 * 115, h - 60 - 6 * 85 + 60, 120, 60, d.v("fl", P["sand"], P["sand3"])) + "</g>"
               + f'<g transform="rotate(-24 {60+7*115+40} {h-60-7*85+200})">' + rect(60 + 7 * 115, h - 60 - 7 * 85 + 180, 100, 50, d.v("fl2", P["sand"], P["sand3"])) + "</g>"
               + "".join(poly([(x, y), (x + 22, y - 18), (x + 36, y + 8)], P["sand3"]) for x, y in [(790, 560), (860, 640), (900, 520), (930, 700)]))
    gap = rect(60 + 6 * 115, h - 60 - 5 * 85, 230, 5 * 85 + 60, d.v("gap", P["slate_d"], INK), extra='opacity="0.25"')
    body = (contact_shadow(d, 560, h, 560, 18, 0.25) + gap + g("stairs", steps) + g("falling", falling)
            + poly([(60 + 8 * 115 + 120, h - 60 - 8 * 85), (w, h - 60 - 8 * 85), (w, h - 60 - 8 * 85 + 14), (60 + 8 * 115 + 120, h - 60 - 8 * 85 + 14)], P["white"], 'opacity="0.3"'))
    return obj("Shkallë e thyer", (w, h), body, {"ground": [0.5, 1.0], "gap": [(60 + 6.5 * 115) / w, (h - 60 - 6 * 85) / h], "top": [(60 + 8 * 115 + 60) / w, (h - 60 - 8 * 85) / h]},
               ["stairs", "broken", "gap", "failure", "setback", "obstacle", "progress", "collapse", "missing-step"],
               {"stairs": "statike", "falling": "receta `collapse`: copat bien (y)"},
               "A pale stone staircase rising to the right with two steps missing near the top and broken pieces falling.",
               "A broken path to success: setbacks, a missing step, the gap between where you are and the goal, a system that failed.",
               animations=("pop_in", "fade", "slide", "shake", "collapse"), themes=["growth", "psychology", "decisions"])


def spotlight(d: Defs):
    w, h = 1000, 1800
    cx = 500
    body = (
        g("beam", poly([(cx - 70, 190), (cx + 70, 190), (cx + 420, h - 120), (cx - 420, h - 120)], d.v("bm", P["warm_light2"], P["warm_light"]), 'opacity="0.42"')
          + poly([(cx - 30, 190), (cx + 30, 190), (cx + 220, h - 120), (cx - 220, h - 120)], P["white"], 'opacity="0.18"'))
        + g("pool", ellipse(cx, h - 110, 440, 90, d.glow("pool", P["warm_light2"], 0.85, 0.0, 0.4)))
        + g("lamp", rect(cx - 6, 0, 12, 70, P["slate_dd"]) + poly([(cx - 70, 70), (cx + 70, 70), (cx + 90, 190), (cx - 90, 190)], d.h("lp", P["slate_l"], P["slate_dd"]))
            + ellipse(cx, 190, 90, 20, P["warm_light2"]))
    )
    return obj("Prozhektor (spotlight)", (w, h), body, {"ground": [0.5, (h - 110) / h], "center_stage": [0.5, (h - 110) / h], "lamp": [0.5, 0.06]},
               ["spotlight", "attention", "stage", "fame", "spotlight-effect", "public-speaking", "exposed", "center-of-attention", "power"],
               {"beam": "receta `switch_on`: drita ndizet (opacity)", "pool": "rrethi i dritës në dysheme", "lamp": "statik"},
               "A stage spotlight hanging at the top with a wide cone of warm light ending in a bright pool on the floor.",
               "Being the centre of attention: the spotlight effect, fame and power, stage fright, feeling exposed. Put a character in the pool.",
               animations=("pop_in", "fade", "pulse", "switch_on"), themes=["psychology", "decisions", "money"])


def park_bench(d: Defs):
    w, h = 760, 420
    seat = h - SEAT_Y_ABOVE_FLOOR
    iron = d.h("ir", P["slate_l"], P["slate_dd"])
    body = (
        contact_shadow(d, 380, h, 380, 16)
        + g("frame", path(f"M60,{h} L80,{seat+10} L120,{seat+10} L110,{h} Z", iron) + path(f"M700,{h} L680,{seat+10} L640,{seat+10} L650,{h} Z", iron)
            + path(f"M84,{seat} L64,40 L100,40 L120,{seat} Z", iron) + path(f"M676,{seat} L696,40 L660,40 L640,{seat} Z", iron)
            + path(f"M40,{seat-110} Q30,{seat-150} 60,{seat-150} L84,{seat-150} L90,{seat-120} L60,{seat-118} Z", iron)
            + path(f"M720,{seat-110} Q730,{seat-150} 700,{seat-150} L676,{seat-150} L670,{seat-120} L700,{seat-118} Z", iron))
        + g("slats", "".join(rect(54, y, 652, 22, d.v(f"sl{i}", P["wood_l"], P["wood_d"]), rx=6) for i, y in enumerate((60, 100, 140)))
            + "".join(rect(40, seat - 16 + i * 26, 680, 22, d.v(f"ss{i}", P["wood_l"], P["wood_d"]), rx=6) for i in range(2)))
    )
    anchors = {"ground": [0.5, 1.0], "seat_left": [0.3, (seat - 16) / h], "seat_right": [0.7, (seat - 16) / h],
               "hip_left": [0.3, (seat - 16 - HIP_ABOVE_SEAT + 12) / h], "hip_right": [0.7, (seat - 16 - HIP_ABOVE_SEAT + 12) / h]}
    return obj("Stol parku", (w, h), body, anchors,
               ["bench", "park", "sit", "alone", "waiting", "reflection", "loneliness", "outdoor", "furniture"],
               {"slats": "statike", "frame": "statike"},
               "A wooden park bench with dark iron legs and armrests, seen from the front.",
               "Sitting alone, waiting, reflecting, two people sitting apart. Two seat anchors.",
               collection="everyday", themes=["psychology", "growth", "philosophy"])


PROPS = [
    ("prop_brain_01", brain), ("prop_head_silhouette_01", head_silhouette), ("prop_brain_network_01", brain_network),
    ("prop_brain_split_01", brain_split), ("prop_heart_01", heart), ("prop_eye_01", eye), ("prop_hand_01", hand),
    ("prop_human_shadow_01", human_shadow), ("prop_theater_mask_01", theater_mask), ("prop_theater_masks_01", theater_masks),
    ("prop_mirror_reflection_01", mirror_reflection), ("prop_labyrinth_entrance_01", labyrinth_entrance),
    ("prop_heavy_chains_01", heavy_chains), ("prop_key_01", key), ("prop_stopwatch_01", stopwatch),
    ("prop_wall_calendar_01", wall_calendar), ("prop_candle_01", candle), ("prop_thought_bubble_01", thought_bubble),
    ("prop_puzzle_pieces_01", puzzle_pieces), ("prop_dice_01", dice), ("prop_playing_cards_01", playing_cards),
    ("prop_warning_light_01", warning_light), ("prop_puppet_controller_01", puppet_controller), ("prop_compass_01", compass),
    ("prop_signpost_01", signpost), ("prop_ladder_01", ladder), ("prop_park_bench_01", park_bench),
]
METAPHORS = [
    ("met_broken_mirror_01", broken_mirror), ("met_cage_01", cage), ("met_glass_wall_01", glass_wall),
    ("met_door_light_01", door_light), ("met_many_doors_01", many_doors), ("met_watching_eye_01", watching_eye),
    ("met_broken_stairs_01", broken_stairs), ("met_spotlight_01", spotlight),
]


def main() -> None:
    a = run(PROPS, "psychology")
    b = run(METAPHORS, "psychology", folder="metaphors", category="metaphor", subcategory="interactive", kind="animated_metaphor")
    print(f"{len(a)} objekte + {len(b)} metafora (psikologji)")


if __name__ == "__main__":
    main()
