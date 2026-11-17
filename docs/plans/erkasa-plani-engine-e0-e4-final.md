# Erkasa: plani përfundimtar E0–E4 (për miratim)

17 nëntor 2026. Plan, pa implementim. Baza e kodit: `w0-world-first` @ `880218f`. Përditëson `erkasa-engine-pavaresia-dhe-pergjegjesi-i-aseteve.md` me 6 sqarimet e Ergit.
**[F]** fakt nga kodi · **[S]** vlerësim · **[R]** vendim i propozuar.

---

## 1. Shtresat, kontratat dhe pronarët (E1)

```
 A. PLANIFIKIMI (AI, i zëvendësueshëm)          A2. PËRGJEGJËSI I ASETEVE (kod + AI)
    script → story → world → beat/shot plan  ──►    çdo aset i kërkuar → aset i aprovuar
    DALJE: Planning Package                         DALJE: Asset Manifest
                    │                                          │
                    └──────────────┬───────────────────────────┘
                                   ▼
 B. EKZEKUTIMI / STAGER (kod deterministik, pa AI, pa script)
    plan + manifest + kohët e fjalëve + manifesti i aftësive të Engine-it
    DALJE: Render Package  ──► VALIDATION GATE ──► (refuzim me gabime ose kalim)
                                   ▼
 C. ENGINE (kod deterministik; njeh vetëm Render Package)
    vlerëson gjendjen në kohën t → vizaton → kuadro → FFmpeg → MP4
```

### Kontrata 1: Planning Package (A → B)

Gjuha e planifikimit: **çfarë** dhe **si organizohet**, pa piksela dhe pa sekonda absolute.

| Skedari                         | Përmbajtja                                                                                                                                                           | Statusi                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `film.json` (`erkasa.film/1`)   | Planet/beat-et: vendi, aktorët në marka, folje, objektiva, kamera si qëllim (`framing`, `subject`, `move`), ankora fjalësh (`word:x#n`), drita, teksti, `continuity` | **Ekziston** [F] `film/src/contract.ts` |
| `world.json` (`erkasa.world/1`) | Vendet, entitetet me ID dhe gjendjet e deklaruara, kasti, paleta, rregullat e kamerës                                                                                | **Pjesërisht** (W0 `plan.json` `world`) |
| `asset-requests.json`           | Çdo aset që plani përdor: ID, kategori, përshkrim, gjendjet e nevojshme, affordances                                                                                 | **Mungon**                              |

**Rregulli:** Planning Package nuk përmban koordinata pikselash, kohë në sekonda ose referenca te skedarë SVG. Përmban vetëm ID dhe qëllime.

### Kontrata 2: Asset Manifest (A2 → B dhe C)

Një rresht për çdo aset të përdorur (`erkasa.assets/1`):

| Fusha                       | Përmbajtja                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------- |
| `id`, `version`, `kind`     | `svg` · `rig` · `font` · `audio`                                                            |
| `file`, `sha256`, `viewBox` | Skedari dhe hash-i (Engine-i verifikon që është i njëjti)                                   |
| `size`                      | Përmasat në njësi bote; pika e tokës (`ground`)                                             |
| `states`                    | Emri i gjendjes → skedari ose ID e shtresës brenda SVG-së (p.sh. `closed`, `open`)          |
| `affordances`               | `grip`, `seat`, `surface`, `openable`, `readable`, me pika kontakti në koordinatat e asetit |
| `pivots`                    | Për pjesët që rrotullohen (dorë dere, kapak) dhe për rig-et                                 |
| `style`                     | Kit-i, raporti i Style Gate (ID + nota)                                                     |
| `provenance`                | `kit` · `generator` · `ai`; modeli, hash-i i prompt-it, kostoja                             |
| `approval`                  | `approved` · `pending` · `rejected`; kush dhe kur                                           |

### Kontrata 3: Render Package (B → C)

Instruksione të plota, vetëm numra dhe referenca (`erkasa.render/1`):

| Seksioni      | Përmbajtja                                                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `meta`        | `fps`, përmasat, kohëzgjatja, versioni                                                                                                                      |
| `assets`      | Manifesti i ngrirë (vetëm asetet e përdorura)                                                                                                               |
| `places`      | Plane me thellësi; nyje: `id`, `asset`, `state`, `x`, `y`, `depth`, `scale`, `rotation`, `pivot`, `opacity`, `attach` (te një nyje ose te një kockë aktori) |
| `actors`      | `id`, `rig`, pamja (ngjyrat e kostumit, flokëve)                                                                                                            |
| `tracks`      | Kanale me keyframe: kockat dhe rrënja e aktorëve, nyjet, kamera, drita. **Në E1, kanalet e aktorëve janë mostra për çdo kuadër** (shih më poshtë)           |
| `contacts`    | Kush mban çfarë, nga kur deri kur, në cilën kockë                                                                                                           |
| `stateEvents` | `{node, to, t, fx}` me `fx` nga lista e Engine-it                                                                                                           |
| `overlays`    | Etiketa, ikona, titra: teksti, pozicioni në px ose ankora në nyje, kohët                                                                                    |
| `audio`       | Skedarët dhe kohët (zëri, muzika, SFX)                                                                                                                      |

**Vendim për E1 [R]:** lëvizja e aktorëve dorëzohet si mostra për çdo kuadër (~20 kanale × 30 fps). Për 45 s janë ~27,000 numra për aktor, ~0.5 MB. Kjo e bën Engine-in vlerësues të pastër dhe garanton që videot e sotme dalin identike. Klipet e autorizuara (nga animatori) shtohen më vonë si lloj tjetër `track`, pa ndryshuar Engine-in.

### Pronarët e çdo transformimi

| Transformimi                                            | Pronari                  | Kodi sot [F]                                                    |
| ------------------------------------------------------- | ------------------------ | --------------------------------------------------------------- |
| Script → kuptimi i historisë                            | A                        | `script-writer.ts`; `story.json` (me dorë)                      |
| Historia → plane, vende, folje, kamera si qëllim        | A                        | `film/src/director.ts`                                          |
| Kërkesë aseti → aset i aprovuar                         | A2                       | `asset-maker.ts` (branch i ngrirë)                              |
| Ankorë fjale → sekondë                                  | B                        | `film/src/timing.ts`                                            |
| Markë → koordinatë; folje → lëvizje; IK e këmbëve; ecja | B                        | `film/src/perform.ts`                                           |
| Gjendja nga plani në plan                               | B                        | `film/src/continuity.ts`                                        |
| Qëllimi i kamerës → rruga e kamerës                     | B                        | `film/src/w0/composer.ts` `cameraFor()`, `w0/camera.ts` `aimAt` |
| Validimi i paketës                                      | Validation Gate (para C) | **mungon**                                                      |
| Kanalet → skelet → vizatim i personazhit                | C                        | `film/src/rig.ts`                                               |
| Nyjet + kamera → projeksion 2.5D                        | C                        | `w0/camera.ts` `project()`                                      |
| Drita, thellësia, hijet, kompozimi                      | C                        | `w0/composer.ts`                                                |
| Kuadro → MP4                                            | C                        | `w0/cli.ts`, FFmpeg                                             |

---

## 2. Validation Gate (para çdo render-i)

Engine-i fillon vetëm me një Render Package të vlefshëm. Përndryshe nuk renderon asgjë dhe kthen listën e gabimeve me shteg.

| Kontrolli                 | Shembull gabimi                                                                 |
| ------------------------- | ------------------------------------------------------------------------------- |
| Skema (Zod, versioni)     | `meta.fps` mungon                                                               |
| Integriteti i referencave | `places[0].nodes[3].asset = "book"` nuk është në manifest                       |
| Hash-i i skedarit         | SVG e ndryshuar pas aprovimit                                                   |
| Aprovimi                  | Aset me `approval = pending`                                                    |
| Gjendjet dhe efektet      | `stateEvents[2].to = "burning"` nuk është gjendje e deklaruar; `fx` jo në listë |
| Kohët                     | Keyframe jashtë rendit, `NaN`, jashtë kohëzgjatjes                              |
| Kontaktet                 | Objekti mbahet nga dy aktorë në të njëjtën kohë                                 |
| Buxhetet                  | Nyje, madhësi skedarësh, kohëzgjatje (kufij të konfigurueshëm)                  |
| Aftësitë                  | Gjithçka e kërkuar ekziston në manifestin e aftësive të Engine-it               |

---

## 3. Ndërveprimet si kapacitete të përgjithshme (E2)

**Parimi:** sjellja e objektit vjen nga metadata e asetit (affordances, gjendje, pika kontakti). Foljet janë të përgjithshme dhe nuk njohin ID objektesh.

| Folja                     | Kërkon nga aseti                      | Çfarë bën                                                                                         |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `pick_up`, `put_down`     | `grip`, `surface` te vendi            | Afrim, shtrirje dore me IK, bashkim me dorën, lëshim                                              |
| `hold`                    | `grip`                                | E mban para trupit në një pozë mbajtjeje                                                          |
| `open`, `close`           | `openable` + gjendjet `open`/`closed` | Lëvizje dore + ndryshim gjendjeje në momentin e kontaktit                                         |
| `use`                     | `readable` / `usable` + gjendje       | Pozë përdorimi + shikim te objekti + mikro-lëvizje (leximi është `use` mbi një objekt `readable`) |
| `sit`, `stand_up`         | `seat`                                | Ekziston [F]                                                                                      |
| `walk_to`, `look`, `give` | —                                     | Ekzistojnë [F]                                                                                    |
| `push`                    | `pushable`                            | Shtytje me peshë                                                                                  |

**Testi i të burgosurit** (ulur, merr librin, e hap, lexon, e mbyll, ngrihet, ecën te dera) bëhet si kombinim i këtyre foljeve mbi një aset `book` me `grip`, `openable`, `readable`.

**Prova që nuk është logjikë e posaçme:**

- Të njëjtat folje, pa ndryshim kodi, kalojnë në **tre skena të tjera**: hap një grilë, hap një laptop dhe shkruan, merr një filxhan dhe pi.
- Një test në CI kërkon ID asetesh specifike (`book`, `gate`, `cell`, `prisoner`) në kodin e stager-it dhe Engine-it, dhe dështon nëse gjen ndonjë.

---

## 4. Benchmark-u i `asset-maker.ts` para E3

**Qëllimi:** të dimë sa vlen gjenerimi i SVG-ve me AI përpara se ta ndërtojmë rreth tij.

**Mostra: 30 objekte nga histori reale** (B1–B6 dhe temat tuaja):

- 10 objekte të thjeshta (filxhan, çelës, dosje, orë, monedhë, telefon, letër, laptop, kuti, qiri);
- 10 objekte me gjendje (libër i mbyllur/i hapur, grilë, llambë e ndezur/fikur, kuti e hapur/mbyllur, derë, kafaz, ekran);
- 6 silueta komplekse (karrige, bimë, biçikletë, peshore, shkallë, pishtar);
- 4 kafshë statike (luan i shtrirë, skelet luani, zog, qen).

**Procedura:** model real; deri në 3 përpjekje; çdo rezultat kalon Style Gate (seksioni 5) dhe vlerësohet nga ti mbi një fletë pranë kit-it.

**Raporti përmban:**

| Matja                        | Si                                                                           |
| ---------------------------- | ---------------------------------------------------------------------------- |
| Kalimi i Style Gate          | Në përpjekjen e parë / brenda 3                                              |
| Arsyet e dështimit           | Sipas kriterit të gate                                                       |
| Cilësia                      | Nota jote 1–5 (lexueshmëri në madhësinë reale, koherencë me kit-in, siluetë) |
| Ripunimi                     | Asnjë / i vogël / rivizatim                                                  |
| Kostoja për aset të aprovuar | Tokens dhe USD, përfshirë përpjekjet e dështuara; koha                       |

**Pragjet e vendimit [S]:**

- ≥80% kalojnë gate-in brenda 3 përpjekjeve **dhe** ≥70% marrin ≥4/5 nga ti → E3 vazhdon për të gjitha kategoritë.
- Objektet e thjeshta kalojnë, kafshët dhe siluetat komplekse jo → E3 vetëm për objekte; pjesa tjetër nga kit-i.
- Nën 50% → asset-maker mbetet i ngrirë; planifikimi kufizohet te kit-i.

**Varësia:** kërkon çelësin API të Claude-it. Mund të ekzekutohet paralel me E0–E1.

---

## 5. Style Gate i zgjeruar

| Kriteri                  | Si matet                                                                                                                                                                                       | Lloji                                |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| Paleta                   | Çdo ngjyrë brenda ΔE ≤ 6 nga paleta e World Bible; rolet (dritë, hije, theks) të respektuara                                                                                                   | Automatik                            |
| Trashësia e vijës        | Brenda intervalit të kit-it, në raport me madhësinë e objektit                                                                                                                                 | Automatik                            |
| Silueta                  | Maska në madhësinë reale: raporti i mbushjes, kompaktësia, numri i vrimave, raporti gjerësi/lartësi kundrejt kategorisë së kit-it; lexueshmëria (një model vizioni duhet ta emërtojë objektin) | Automatik + vizion                   |
| Kompleksiteti            | Numri i formave dhe pikave të rrugës, dendësia e detajit për njësi sipërfaqeje, brenda shpërndarjes së kit-it (median ± 2σ)                                                                    | Automatik                            |
| Perspektiva              | Pamja e deklaruar në World Bible (p.sh. ballore ortografike, pa pikë zhdukjeje); heuristikë gjeometrike + model vizioni                                                                        | Vizion + kontroll njerëzor me mostër |
| Koherenca me World Bible | Lloji i hijëzimit (i sheshtë / gradientë), rrumbullakimi i qosheve, drejtimi i dritës, stili i vijës                                                                                           | Automatik + vizion                   |
| Render në kontekst       | Objekti vendoset në një kuadër me asetet e kit-it; krahasim me sy                                                                                                                              | Njerëzor për asetet e reja           |

**Kufizim i ndershëm:** perspektiva dhe "koherenca" nuk maten plotësisht me kod. Për to përdoret një model vizioni në shtresën e planifikimit dhe miratimi yt me mostër. Engine-i nuk përfshihet.

---

## 6. E4: scene graph-i vetëm me prova

Nuk ndërtohet scene graph i përgjithshëm paraprakisht. Ndërtohet një **suitë rastesh**, dhe zgjerohet vetëm ajo që dështon.

| Rasti                                            | A e mban modeli pas E1–E2 (plane me thellësi + nyje + `attach`)? | Zgjerimi, vetëm nëse dështon                                              |
| ------------------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Qelia e të burgosurit                            | Po [S]                                                           | —                                                                         |
| Dera e grilës që rrotullohet në kornizë          | Po, me `pivot` për nyje                                          | —                                                                         |
| Objekti në dorë                                  | Po (`contacts`)                                                  | —                                                                         |
| Kamera hyn nëpër derën III në qeli ("Tri dyert") | Ndoshta: qelia si plan më i thellë pas hapjes                    | Rajon i futur, vetëm nëse prova dështon                                   |
| Turmë me qindra figura                           | **Jo** me efikasitet                                             | Grup instancash me variacion                                              |
| Një spektator largohet, vendi mbetet bosh        | Jo pa grup instancash                                            | Gjendje për instancë                                                      |
| Karrocë që lëviz me objekte sipër                | Jo                                                               | Prind-fëmijë, **vetëm kur ndonjë histori e kërkon** (asnjë benchmark sot) |

**Pranimi i E4:** çdo zgjerim ka një rast që dështonte para dhe kalon pas, me video. Nuk shtohet asnjë veçori pa rast.

---

## 7. Mbrojtja nga regresioni vizual (E0–E2)

- **Golden renders:** B1–B5 (studio-v2) dhe W0 B1, me kuadrot e storyboard-it dhe çdo 0.5 s të filmit, plus matjet ekzistuese (mekanika, vazhdimësia, koha e vdekur).
- **E0:** kuadro **bit për bit identike**.
- **E1:** PSNR ≥ 50 dB për çdo kuadër (devijime vetëm nga rrumbullakimi); metrikat e mekanikës dhe vazhdimësisë identike.
- **E2:** identike, përveç ndryshimeve të deklaruara dhe të miratuara nga ti me video para/pas.
- **Në çdo commit:** 81 testet ekzistuese, typecheck, lint, 6 planet pa gabime.

---

## 8. Fazat, varësitë dhe pranimi

```
E0 ──► E1 ──► E2 ──► E4
 │      │      └──► B6 me dorë (pas E4)
 └─► E3a (benchmark, paralel, kërkon çelës API)
        └─► E3b (implementimi, pas E1 + vendimit nga E3a)
```

| Faza                                     | Puna                                                                                                                                                                                                                     | Varet nga      | Koha [S]   | Pranimi                                                                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **E0 · Kufiri**                          | `director.ts` del nga `film/` në shtresën e planifikimit; rregull lint që ndalon Engine-in të importojë `Script`, LLM, `ai-worker`; golden renders                                                                       | —              | 3–4 ditë   | 0 importe planifikimi në Engine; kuadro bit për bit identike; 81 testet kalojnë                                                                                                            |
| **E1 · Kontratat + stager + gate**       | `erkasa.render/1`, `erkasa.assets/1` (skema); stager nga `perform.ts`, `timing.ts`, `continuity.ts`, `cameraFor()`; Engine-i renderon vetëm nga Render Package; Validation Gate; Render Package ruhet në dosjen e run-it | E0             | 2 javë     | 6 filmat: `film.json → stager → render package → gate → Engine` me PSNR ≥ 50 dB; gate refuzon 10 paketa të prishura qëllimisht me mesazh të saktë; një paketë e shkruar me dorë renderohet |
| **E2 · Asete si të dhëna + ndërveprime** | Set-et, objektet dhe zyra W0 si asete + metadata; gjendje; affordances; foljet e seksionit 3; `stateEvents` të përgjithshme                                                                                              | E1             | 2–2.5 javë | Testi i të burgosurit + 3 skena të tjera me të njëjtat folje; 0 ID asetesh në kod; asnjë regresion në 6 filmat                                                                             |
| **E3a · Benchmark i asset-maker**        | 30 objekte, Style Gate, raporti                                                                                                                                                                                          | E0 + çelës API | 3–4 ditë   | Raporti i seksionit 4 dhe vendimi sipas pragjeve                                                                                                                                           |
| **E3b · Përgjegjësi i aseteve**          | Rendi kit → gjenerator → AI → ndrysho planin; Style Gate; gjendjet si variante; cache; manifesti                                                                                                                         | E1 + E3a       | 1.5 javë   | Një histori e re me 3 asete që mungonin, të krijuara dhe të aprovuara; kosto e matur                                                                                                       |
| **E4 · Zgjerimet e scene graph**         | Vetëm rastet e seksionit 6 që dështojnë                                                                                                                                                                                  | E2             | 1–2 javë   | Çdo zgjerim me rast para/pas; B6 "Tri dyert" me plan me dorë renderohet                                                                                                                    |

**Rregullat për çdo fazë:** branch i dedikuar, video para/pas, matjet e mësipërme, miratimi yt para merge-it.

## 9. Çfarë nuk preket

Mekanika e trupit dhe IK; vazhdimësia; projeksioni i kamerës; drita dhe kompozuesi Skia; render-i deterministik dhe FFmpeg; `erkasa.film/1` si kontratë e planifikimit; script-writer, voice, timing-u i ankorave (vetëm zhvendoset te stager-i); benchmark-et.

## 10. Çfarë më duhet për të filluar

1. Miratimi yt i këtij plani.
2. Akses push në `ergkasa-studio` (ose push-i nga ti).
3. Çelësi API i Claude-it për E3a.
