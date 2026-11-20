# Rregullimi: kuadri i parë i çdo shot-i

| Fusha    | Vlera                                                                                                                                                   |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch-i | `fix-shot-first-frame` (mbi `g0-advanced-engines`)                                                                                                      |
| Statusi  | **Pret miratimin e PO-së për golden-et e reja.** Pa merge. Hapi `golden` i CI-së dështon në këtë branch derisa golden-et të ri-regjistrohen me miratim. |

## Defekti

Gjendja fillestare e një personazhi (humori, krahu që mban CV-në, koka sipas shikimit) vendosej me një rampë 0,01 s që niste në t = 0. Prandaj **kuadri 0 i shot-it vizatonte trupin para gjendjes**, dhe kuadri 1 kërcente te poza e vërtetë.

- Matur në B1–B5: **30 nga 39 personazh-shot-e**, deri në 31° në një kuadër.
- Shembuj: B2, krahu i Alex-it 6°/10° → 22°/84° (CV-ja "kërcen" në dorë); B1, koka e Dritan-it +9°.

## Rregullimi

- `film/src/perform.ts`, `Track.to`: një ndryshim që nis në çastin e parë të shot-it dhe zgjat më pak se një kuadër është gjendja fillestare, jo lëvizje. Mbahet që nga kuadri 0.
- `gazeTo`: shikimi fillestar (speed < 0.1) është i menjëhershëm (më parë 0,0012 s).

Rezultati: **0 nga 39** personazh-shot-e me kërcim mes kuadrit 0 dhe 1. Testi `film/test/acting.test.ts` e kontrollon për çdo film të benchmark-ut.

## Çfarë ndryshon në golden-et

**212 nga 405** kuadro v2 të B1–B5. W0 nuk ndryshon. Ka dy shkaqe:

1. **Kuadri i parë i shot-eve**, si më sipër.
2. **Kamera** në 37 nga 74 matje (fillim dhe mes shot-i): në disa shot-e kamera synon kokën e subjektit në kuadrin 0. Më parë synonte pozën e gabuar (para gjendjes), prandaj korniza ishte e zhvendosur për gjithë shot-in. Zhvendosja maksimale është 140 px në ekran (B5 sh06, B1 sh03).

`framing-before-after.png` (majtas = para, djathtas = pas), për B1 sh03, B5 sh06 dhe B4 sh07: me rregullimin, personazhi ka më shumë hapësirë nga ana ku shikon (look room, CC-A4). Korniza e re është kamera e zbatuar mbi pozën e vërtetë, jo një stil i ri.

## Ndryshime të tjera

- `gate/test/executable-cases.ts` (rasti E1, 24 fps): dy kanale të skenës 1 tani janë konstante që nga kuadri 0, jo të mostruara, prandaj Gate-i nuk ka më normë mostrimi për t'u refuzuar te to. Lista pritet 4 gjetje më e shkurtër.
- Asnjë tjetër. Contracts, gate, stager dhe film (përveç dy testeve golden në `boundary.test.ts`) janë jeshile.

## Për ta pranuar

1. Shiko `framing-before-after.png` dhe disa kuadro të B1–B5.
2. Nëse e pranon: ri-regjistrimi i golden-eve (`golden.json`, `golden-evidence.json`, `golden-package.json`) dhe merge.
