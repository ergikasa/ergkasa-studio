# Character v3: si i ndërtojmë personazhet (studim dhe prototip vizual)

| Fusha      | Vlera                                                                                                                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Data       | 2026-11-20                                                                                                                                                                                                                   |
| Kërkesa    | PO: personazhe 2D të stilizuara me tipare njerëzore bindëse; prototip i ri me strukturë SVG për animim; vlerësim nëse duhet të evoluojë vetë mënyra e ndërtimit. Pa production para miratimit të dizajnit.                   |
| Prototipi  | `prototypes/character-v3/`, i ndarë plotësisht nga production-i (asnjë import nga ose drejt `film/`, `stager/`, `gate/`)                                                                                                     |
| Rezultatet | `out/v3-model-sheet.png`, `v3-expressions.png`, `v3-eyes.png`, `v3-hands.png`, `v3-before-after.png`, `v3-performance.mp4` (8,4 s, 1080×1920, 30 fps), `v3-performance-contact.png`; faqja interaktive "Erkasa Character v3" |
| Statusi    | **Pret miratimin e dizajnit.** Production, golden-et dhe W3 nuk preken.                                                                                                                                                      |

## 1. Përfundimi

**Po, mënyra e ndërtimit duhet të ndryshojë, jo vetëm vizatimi.** Rig-u aktual ka arritur tavanin e vet. Është ndërtuar nga primitive (elipsa, vija me fund të rrumbullakët), secila me një ose dy parametra, dhe asnjë përmirësim i vogël nuk e kalon atë kufi.

Prototipi provon një metodë tjetër, të përbërë nga katër pjesë:

1. **Forma të dizajnuara** (kontura të vizatuara për kokën, flokët, veshin, hundën, buzët, sytë), jo primitive.
2. **Skeleton me profile gjerësie** për trupin, gjymtyrët dhe çdo gisht. Kontura llogaritet nga kockat në çdo kuadër, me ngushtim, muskul dhe një bërryl që përkulet si një formë e vetme.
3. **Njësi veprimi (FACS-lite)** për fytyrën. Çdo shprehje është një përzierje e të njëjtave forma, kështu që kalimet janë të buta dhe personazhi mbetet i njëjti.
4. **Shtresa e performancës:** shikimi me objektiva reale, shkelja e syrit me rregulla, successive breaking në krah.

## 2. Pse rig-u aktual duket si kukull (shkaqet e metodës)

| Shkaku                                                                       | Pasoja në video                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| Çdo pjesë është një primitiv (elipsë, vijë 34–52 px me fund të rrumbullakët) | "kukull me fije": tuba, topa, pa formë anatomike       |
| Asnjë formë e dizajnuar: koka është elipsë, hunda gungë, syri pikë           | fytyra pa strukturë: s'ka ballë, faqe, nofull ose buzë |
| Fytyra ka 6 parametra, vetulla 1 bosht                                       | emocionet nuk dallohen; worry = anger                  |
| Vetëm profil                                                                 | sytë nuk mund të shohin partnerin ose kamerën          |
| Pa deformim: pjesët rrotullohen të ngurta                                    | bërryli dhe gjuri si nyje kukulle                      |
| Lëvizje të rastësishme të syve, pa ndjekje të objekteve                      | sytë "të vdekur" ose nervozë pa arsye                  |

## 3. Metodat e vlerësuara

| Metoda                                                            | Cilësia (tavani)        | Lëvizje organike                         | Konsistencë                      | Determinist | E ndërtueshme nga ne                         | Zëvendësohet nga artisti                                     | Vendimi                                                    |
| ----------------------------------------------------------------- | ----------------------- | ---------------------------------------- | -------------------------------- | ----------- | -------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| A. Primitive procedurale (sot)                                    | e ulët                  | e ulët                                   | e lartë                          | po          | po                                           | jo                                                           | **braktiset**                                              |
| B. Cut-out me pjesë të vizatuara dhe pivote (stili i studiove 2D) | e lartë                 | mesatare: nyjet kanë "tegela"            | e lartë                          | po          | jo pa ilustrues                              | **po**                                                       | përfshihet si format pjesësh                               |
| C. Skeleton + kontura me profil gjerësie (prototipi)              | mesatare-e lartë        | **e lartë**: nyjet përkulen si një formë | e lartë (përmasat janë të dhëna) | po          | **po**                                       | pjesërisht (format e profilit)                               | **zgjidhet për trupin, gjymtyrët, gishtat**                |
| D. Mesh deformation me peshë (stili Live2D/Spine)                 | e lartë                 | e lartë                                  | e lartë                          | po          | e vështirë (editor peshash, renderer mesh-i) | po                                                           | jo tani: kosto e lartë, përfitim i vogël kundrejt C në SVG |
| E. Morph targets / njësi veprimi mbi forma të dizajnuara          | e lartë për fytyrën     | e lartë                                  | e lartë                          | po          | **po**                                       | **po** (artisti vizaton format kyçe me të njëjtën topologji) | **zgjidhet për fytyrën**                                   |
| F. Gjenerim imazhesh AI                                           | e lartë si foto statike | asnjë (s'ka rig)                         | e ulët mes kuadrove              | jo          | —                                            | —                                                            | vetëm referencë për model sheet                            |
| G. Animacion kuadër për kuadër                                    | shumë e lartë           | shumë e lartë                            | varet nga artisti                | —           | jo                                           | —                                                            | jo për prodhim automatik                                   |

**Rekomandimi: një hibrid.**

- **C** për trupin, gjymtyrët dhe gishtat.
- **E** për fytyrën.
- **Swap sets** për pamjet (koka në profil, 3/4 dhe ballë; pamjet e dorës).
- Gjithçka mbi **një model sheet si të dhëna**: format janë kontura me pika kontrolli të emërtuara. Një ilustrues mund t'i rivizatojë në një editor vektorial dhe t'i eksportojë me të njëjtat ID, pa ndryshuar animimin.

## 4. Çfarë provon prototipi

| Kërkesa e PO-së                     | Në prototip                                                                                                                                                                                      | Ku ta shohësh                           |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| Proporcione dhe anatomi më natyrale | 7,5 koka; shpatulla të pjerrëta, qafë, gjymtyrë me muskul dhe ngushtim; pamje 3/4                                                                                                                | `v3-model-sheet.png`                    |
| Fytyra me detaje dhe karakter       | ballë, harqe vetullash, hundë me krah dhe vrimë, faqe, nofull, vesh, buzë me hark; cel shading me plane drite dhe hije                                                                           | `v3-before-after.png`                   |
| Sy realistë në strukturë            | sklerë, iris me gradient dhe unazë, bebëz me madhësi të ndryshueshme, dy shkëlqime, qepalla sipër (me palosje dhe linjë qerpikësh) dhe poshtë që e presin irisin, hija e qepallës mbi syrin      | `v3-eyes.png`                           |
| Shprehje të dallueshme              | 10 emocione nga 18 njësi veprimi: neutral, joy, sadness, worry, fear, anger, surprise, convince, reassure, thinking                                                                              | `v3-expressions.png`                    |
| Duar dhe gishta të artikuluara      | 4 gishta me 3 falanga dhe gishti i madh me 2, secili me kockat e veta; 6 poza (relaxed, open, point, fist, grip, explain) me përzierje mes tyre                                                  | `v3-hands.png`                          |
| Lëvizje organike                    | successive breaking (krahu → parakrahu +2 kuadro → kyçi +4 → gishtat +5); anticipim para gjestit; frymëmarrje; ndjekja e shikimit dhe koka që ndjek me vonesë                                    | `v3-performance.mp4`                    |
| Sjellja e syve                      | fixation, saccade 4 kuadro, smooth pursuit (letra që bie, me vonesë 2 kuadro), shkelje syri në saccade-t e mëdha, shmangie drejt dyshemesë, rikthim te partneri; **asnjë lëvizje e rastësishme** | `v3-performance.mp4`, faqja interaktive |
| Strukturë SVG për animim            | çdo pjesë në grupin e vet; kontrollet me emër; kontura të llogaritura nga skeleti; `clipPath` për irisin brenda qepallave dhe për gojën                                                          | kodi në `prototypes/character-v3/`      |

Shpejtësia: 252 kuadro 1080×1920 renderohen në ~18 s (resvg + FFmpeg), rreth 14 kuadro/s. Ky ritëm përshtatet me pipeline-in aktual.

## 5. Kufijtë e prototipit (të sinqertë)

- Ka **një pamje** (3/4 djathtas). Pamja majtas del me pasqyrim; profili dhe ballë mungojnë ende.
- Ka **një personazh**. Grua, moshë, trup dhe flokë të tjerë kërkojnë parametrat e identitetit (W1) mbi modelin e ri.
- **Dora** vizatohet vetëm nga ana e gishtit të madh. Pamja nga shpina e dorës mungon.
- Ecja dhe këmbët nuk janë animuar ende me modelin e ri. Logjika e ecjes (foot planting, W2) duhet portuar.
- Format e gojës për të folurin (visemes) janë të mundshme nga kontrollet (`open`, `round`, `wideM`, `press`), por ende nuk lidhen me kohët e shkronjave të ElevenLabs.
- Kontrolli i ndërprerjeve (dora nëpër trup) nuk është ende në prototip.
- **Dobësitë vizuale që shoh vetë:**
  - hija është e sheshtë (një nivel);
  - flokët kanë një stil të vetëm;
  - hunda del pak e theksuar;
  - goja duket e vogël në plan të gjerë;
  - dora ende ka pak "bllok" te pëllëmba.

  Një kalim i ilustruesit mbi model sheet do t'i përmirësonte. Metoda e lejon këtë pa ndryshuar kodin e animimit.

## 6. Rruga drejt production-it (vetëm pas miratimit të dizajnit)

| Faza | Çfarë                                                                                                                      | Porta                        |
| ---- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| V1   | Dizajni final i modelit: korrigjimet e tua, pamjet profil/3-4/ballë, një personazh femër dhe një i moshuar                 | miratimi yt vizual           |
| V2   | `rig @3` në pipeline: kanalet e reja në paketë, Gate dhe renderer (filmat e vjetër mbeten `@1`/`@2`, golden-et nuk preken) | testet + video para/pas      |
| V3   | Portimi i W1 (veshjet mbi trupin e ri) dhe i W2 (acting, intent, sekuenca)                                                 | benchmark-u A–F              |
| V4   | Ecja me këmbët e reja, visemes, ndërprerjet, pamja e dorës nga shpina                                                      | benchmark-u A–F              |
| V5   | Kalimi i filmave të benchmark-ut në `@3`                                                                                   | **miratimi yt i golden-eve** |

## 7. Vendimet që kërkohen

1. **Drejtimi vizual:** a është ky stil (editorial, me plane drite, sy realistë në strukturë, proporcione 7,5 koka) drejtimi që do? Nëse jo, çfarë ndryshon: fytyra, proporcionet, ngjyrat, niveli i detajit?
2. **Metoda:** hibridi C + E + swap sets mbi një model sheet si të dhëna.
3. **Ilustruesi:** a do që një ilustrues ta rafinojë model sheet-in mbi këtë strukturë, apo vazhdoj unë?
