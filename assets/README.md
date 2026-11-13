# Erkasa Asset Library (v1)

402 asete për gjashtë temat e kanalit: psikologji, para, rritje personale, filozofi, shkencë, vendime.

| Dosja | Sa | Çfarë janë | Burimi |
|---|---|---|---|
| `characters/` | 4 + turma | Drini, Era, Arti, Bardhi (të rig-uar, 6 shprehje, 3 visema) + figurë turme me 6 ngjyra | origjinale |
| `backgrounds/` | 10 | sfonde 2560×1920 me 3–6 shtresa parallax | origjinale |
| `metaphors/` | 15 | ajsbergu, kukulla, labirinti, udhëkryqi, dominot, topi i borës, fara→pema, shkallët, mali, peshorja, dy dyert, ora e rërës, zona e rehatisë, koka me ingranazhe, zinxhiri | origjinale |
| `objects/` | 183 | objekte me ngjyra (para, tru, shkencë, kohë, vendime…) | Fluent Emoji Flat (MIT) |
| `icons/` | 189 | ikona duotone për lista dhe infografikë; ngjyra ndryshon me `color` | Phosphor (MIT) |

`manifest.json` është indeksi që lexon motori dhe Visual Planner. Gjenerohet nga validatori.

## Struktura e një aseti

```
<kategoria>/<assetId>/
  asset.json   metadata: lloji, adapter-i, temat, etiketat, licenca, pjesët/shtresat
  asset.svg    vizatimi
  rig.json     (vetëm personazhet) kockat, pivot-et, gjendjet e fytyrës
```

## Konventat

- **Personazhet** ndajnë skeletin `erkasa_biped_front_v1`. Çdo veprim i shkruar për njërin vlen për të gjithë.
  Gjendjet e fytyrës janë grupe me `data-state` brenda slot-eve `eyes`, `brows`, `mouth`. Vetëm `neutral` është i dukshëm.
- **Sfondet**: `<g id="layer_*" data-depth="d">`. Me d > 0 shtresa është larg dhe lëviz me faktorin 1/(1+d). Me d = 0 është toka. Me d < 0 është para kamerës.
  `groundY` tregon ku qëndrojnë këmbët e personazheve. `safeFrames` jep kuadrin për 9:16, 16:9 dhe 1:1.
- **Metaforat**: pjesët që lëvizin janë grupe me `data-pivot`. `parts` te asset.json përshkruan lëvizjen e secilës.

## Komandat

```bash
# rigjenero asetet origjinale
python3 tools/asset-gen/characters.py
python3 tools/asset-gen/backgrounds.py
python3 tools/asset-gen/metaphors.py

# ri-importo objektet dhe ikonat
(cd tools/vendor && npm install)
python3 tools/asset-import/import_open_assets.py

# valido + gjenero manifest.json (del me kod 1 nëse ka gabime)
python3 tools/asset-validate/validate.py
```

## Ende jo (vjen në Fazën B dhe D)

- Pamja anash e personazheve, e nevojshme për ecje dhe vrapim.
- Pozat ulur dhe duart që mbajnë objekte.
- Grafikët, stilet e tekstit dhe efektet. Këto nuk janë vizatime: i gjeneron motori me kod.

## Stili `erkasa_editorial_v2` (plani i 300 aseteve)

Asetet e reja vizatohen me kod si më parë, por me thellësi: gradient për vëllimin (drita nga lart-majtas),
hije kontakti, paletë e mbyllur. Rregullat janë te `tools/asset-gen/editorial.py` dhe i zbaton validatori
(ngjyra jashtë paletës, raster, tekst, filtra ose gradient pa prefiksin e asetit = gabim).

- Metadata shtesë, të detyrueshme për këtë stil: `description` dhe `storyUse` (anglisht, i lexon dhe i kërkon
  planeri), `collection` (kategoria e bibliotekës).
- `variants`: vizatime të tjera të të njëjtit objekt (p.sh. `prop_window_01`: `night`, `rain`). Në timeline
  zgjidhen me `props.variant`.
- Sfondet e reja e lënë dyshemenë të lirë; `anchors` tregon ku vendosen mobiljet (props).

```bash
python3 tools/asset-gen/props_v2.py          # objektet
python3 tools/asset-gen/backgrounds_v2.py    # sfondet
python3 tools/asset-preview/style_sheet.py out.png --style erkasa_editorial_v2   # fleta e stilit, në shkallë reale
```

Grupi 1 (25 asete): 16 objekte te `props/` dhe 9 sfonde te `backgrounds/`.
