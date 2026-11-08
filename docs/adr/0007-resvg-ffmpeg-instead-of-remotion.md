# ADR 0007: resvg + FFmpeg për eksportin, në vend të Remotion

- Statusi: pranuar (zëvendëson pjesën "Remotion si host" të ADR 0004)
- Data: 2026-11-08

## Konteksti

Motori (`engine/`) prodhon për çdo frame një dokument SVG të plotë, si funksion i pastër i timeline-it.
Remotion do të duhej vetëm për ta kthyer këtë SVG në pixel, por kjo do të thoshte Chromium, React dhe
licencë kompanie nga 4+ persona.

## Vendimi

- **Eksporti MP4:** `engine-worker` rasterizon çdo frame me `@resvg/resvg-js` (Rust, binare të gatshme
  për Windows, macOS dhe Linux) dhe i dërgon pixelat RGBA direkt në FFmpeg (H.264, CRF 18, AAC).
- **Fontet:** Montserrat (SIL OFL) vjen si varësi npm dhe ngarkohet në mënyrë eksplicite. Fontet e sistemit
  nuk përdoren kurrë, kështu që i njëjti timeline jep të njëjtat pixel në çdo kompjuter.
- **Preview-i në Studio (Faza G):** i njëjti `renderFrame(n)` vizatohet si SVG në browser. Remotion nuk duhet.

## Pasojat

- Pa Chromium: render ~35 ms/frame (1080×1920) në një CPU, 14.6 s video në ~24 s.
- resvg 2.6 abortohet kur një grup me `opacity` bie plotësisht jashtë kuadrit. Motori e shmang:
  elementët e thjeshtë përdorin `fill-opacity`/`stroke-opacity`, dhe grupet me opacity marrin një drejtkëndësh
  mbrojtës të padukshëm (`OPACITY_GUARD`). Mbrojtja kushton ~120 ms, ndaj përdoret vetëm gjatë fade-ve dhe
  tranzicioneve. Asetet nuk duhet të përdorin `opacity` në grupe; gjeneratorët u përditësuan.
- Efektet që resvg nuk i mbështet mirë (blur i rëndë, blend modes) shmangen në stilin `erkasa_flat_v1`.
