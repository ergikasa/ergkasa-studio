# Erkasa Character v4: auditimi teknik dhe demonstrimi i animimit të avancuar

20 nëntor 2026. Branch `proto-character-v4`, mbi `1773693` (drejtimi v4). Prototipi është në `prototypes/character-v4/rig/`. Asnjë skedar production nuk është prekur. Golden references, `main`, W3 dhe filmat ekzistues mbeten të paprekur.

Shenjat: **[F]** e verifikuar në kod ose në render · **[M]** e matur në këtë makinë · **[S]** vlerësim · **[R]** rekomandim.

---

## 0. Përfundimi në një faqe

1. **Character v4, siç u dorëzua, është një pikturë e vetme, jo një personazh i animueshëm. [F]** Portreti nuk mund të rrotullohet. Silueta, flokët, mjekra dhe hijet janë vizatuar në hapësirën e figurës për një kënd të vetëm. Prova: `out/audit/v4-rotation-experiment.png`.
2. **Korrigjim:** dokumenti i drejtimit v4 përmendte "52 pika anatomike". Kodi ka **130 landmarks të emërtuara** (22 në vijën e mesit, 54 për secilën anë, të pasqyruara, 4 asimetrike). **[F]**
3. **Ndërtova mbi pikturën v4 një rig 2.5D prototip.** Ai përfshin:
   - një kokë 3D proxy me konture dhe hije që llogariten në çdo kuadër;
   - pikturën v4 të lidhur me kokën në mënyrë projektive;
   - fytyrë me Action Units, nofull, buzë, dhëmbë, qepalla dhe sy të pavarur;
   - viseme nga kohët e fjalëve;
   - trup me IK dhe duar me poza;
   - ndërveprim me objekt, ecje dhe ndalim.
4. **Video demo [F]:**
   - `v4-performance.mp4` (22.5 s, 1080×1920, 30 fps, 675 kuadro) mbulon të nëntë pikat e kërkesës;
   - `v4-walk.mp4` (5.6 s) tregon ecjen dhe ndalimin;
   - fletët e provave tregojnë rrotullimin, emocionet, visemet, sytë dhe krahasimin e rasterizuesve.
5. **Çfarë u provua:**
   - koka rrotullohet me anatomi dhe dritë të qëndrueshme brenda një diapazoni;
   - sytë udhëheqin kokën;
   - pulitjet janë të çrregullta dhe të shkurtra, dhe qepalla e sipërme ndjek shikimin;
   - kalimet emocionale prekin gjithë fytyrën dhe trupin;
   - goja ndjek fjalët;
   - dora kap, ngre, mban, lexon dhe lëshon letrën;
   - gjestet bien mbi fjalët e theksuara;
   - këmbët qëndrojnë të ngulura gjatë ecjes.
6. **Çfarë nuk u provua dhe duhet ta dish para vendimit:**
   - **Diapazoni i kokës është i ngushtë.** Brenda yaw 14–34° dhe pitch −4…+15° është i pastër. Në yaw 38–42° dhe në pitch −8° shfaqen defekte. Jashtë kësaj prishet: profili dhe pamja ballore kërkojnë pikturë shtesë.
   - Në demo koka lëviz vetëm në yaw 14–27°, dhe pitch-i rri në kufirin +15° në 47% të kuadrove.
   - **Emocionet janë të lexueshme, por të buta.** Trishtimi, shqetësimi dhe zemërimi dallohen kryesisht nga vetullat.
   - **Visemet e mbyllura (PP, FF, sil) duken pothuajse njësoj** në këtë kënd. Dhëmbët mezi duken.
   - **Trupi dhe veshjet janë shumë poshtë cilësisë së fytyrës.** Xhaketa është formë e thjeshtë, duart nuk kanë pamje të pëllëmbës, dhe ecja është test mekanike.
   - **Kostoja:** 3.8–4.3 s për kuadër për bërthamë CPU, rreth 9 herë më shtrenjtë se W0 (0.45 s). Video 30 fps prodhohet offline, por një minutë video kushton rreth 2 orë CPU. Cache-i i matur jep vetëm 1.4×; fitimi më i madh (2×) vjen nga rajonet e filtrave.
7. **Rruga e matur për performancën:** Skia, që ekziston tashmë në repo te kompozuesi W0, i rasterizon të njëjtat kuadro v4 **4.1× më shpejt** se resvg, me ndryshim figure rreth 0.4/255. **[M]** Me të, kostoja do të ishte rreth 1.2 s për kuadër. **[S]**
8. **[R]** Mos e miratoni v4 për production ende. Ndiqni roadmap-in e §7: pikturë me disa pamje para çdo integrimi, pastaj kontratën `rig@3` pas Gate-it, me filmat ekzistues dhe golden-et të paprekur.

---

## 1. Auditimi teknik (i verifikuar në kod)

Mjeti: `rig/audit.mjs` → `out/audit/audit.json` dhe `out/audit/v4-rotation-experiment.png`.

### 1.1 Pikat anatomike: 130, jo 52

| Çfarë                  | Numri                                                                  | Ku                                 |
| ---------------------- | ---------------------------------------------------------------------- | ---------------------------------- |
| Landmarks të emërtuara | **130**                                                                | `model.mjs`                        |
| Në vijën e mesit       | 22                                                                     | ballë, hundë, buzë, mjekër         |
| Për secilën anë        | 54 (të pasqyruara)                                                     | sy, vetulla, mollëza, nofull, vesh |
| Asimetrike             | 4: `browPeak`, `browTail`, `cheilion`, `lidUpPeak`                     | karakteri i fytyrës                |
| Të shtuara nga rig-u   | 13: stomion sipër/poshtë, skajet e brendshme të buzëve, dhëmbët, gjuha | `rig/face.mjs` (`rigLandmarks`)    |

**Si përfaqësohen [F]:**

- Çdo landmark është një pikë 3D në centimetra.
- Projektori ortografik i rrotullon me yaw, pitch dhe roll dhe i shkallëzon me 36 px/cm.
- Pas projektimit aplikohet një deformim dizajni, `y + 0.42·exp(−((y+4.4)/1.9)²)`.
- Pamja e autorizuar është yaw 22°, pitch 3°, roll −1.5°.

**Si e ndikojnë gjeometrinë [F]:** jo e gjithë koka kalon përmes tyre. Numërimi i pikave të kontrollit në portretin v4:

| Prejardhja e pikës                                        | Numri | Ndjek rrotullimin?               |
| --------------------------------------------------------- | ----- | -------------------------------- |
| Landmark direkt                                           | 149   | Po                               |
| E derivuar në 3D nga landmarks                            | 273   | Po                               |
| E dhënë si koordinatë figure, por e lidhur me projektorin | 184   | **Jo**: e saktë vetëm në yaw 22° |

Pika vetëm në hapësirën e figurës:

| Grupi                | Numri |
| -------------------- | ----- |
| Skica e lëkurës      | 40    |
| Qafa                 | 11    |
| Skica e flokëve      | 38    |
| Shtrirja e flokëve   | 36    |
| Vija e flokëve       | 13    |
| Ndarja               | 5     |
| Udhëzuesit e flokëve | 81    |
| Shkëlqimi            | 6     |
| Zona e mjekrës       | 36    |

Të gjitha fijet e flokëve, qimet e mjekrës, vetullat, qerpikët dhe fibrat e irisit gjenerohen nga këto pika në hapësirën e figurës.

**Pasoja:** kur koka rrotullohet, tiparet lëvizin, por silueta, flokët, mjekra dhe hijet mbeten në vend. Eksperimenti i rrotullimit e tregon këtë qartë.

### 1.2 Vektor apo raster

Inventari i shtresave të kokës v4 **[F]**:

| Shtresa | Madhësia SVG | Path-e | Me filtër | Imazhe raster |
| ------- | ------------ | ------ | --------- | ------------- |
| Flokët  | 2 295 KB     | 577    | 278       | 0             |
| Mjekra  | 1 117 KB     | 21     | 6         | 0             |
| Tiparet | 97 KB        | 66     | 51        | 0             |
| Fytyra  | 35 KB        | 47     | 51        | 0             |
| Qafa    | 6 KB         | 12     | 11        | 0             |
| Veshi   | 6 KB         | 16     | 16        | 0             |

- **Gjithçka është SVG vektor**, pa asnjë imazh të ngulitur.
- Butësia vjen nga `feGaussianBlur`. Teksturat e lëkurës, sfondit dhe xhaketës vijnë nga `feTurbulence`.
- Rasterizimi ndodh vetëm në fund, me resvg 2.6, me të njëjtat cilësime si `film/src/raster.ts`.
- Në rig-un prototip ka vetëm dy përjashtime raster, të dyja si cache: (1) seti statik ruhet një herë si JPEG; (2) grade-i (vinjeta dhe kokrriza) aplikohet në piksele.

Kostoja e rasterizimit të portretit statik v4, për shtresë **[M]**:

| Shtresa    | Koha                         |
| ---------- | ---------------------------- |
| Flokët     | 3 833 ms                     |
| Fytyra     | 1 915 ms                     |
| Sfondi     | 1 908 ms                     |
| Veshjet    | 1 894 ms                     |
| Qafa       | 721 ms                       |
| Mjekra     | 591 ms                       |
| Tiparet    | 110 ms                       |
| Veshi      | 104 ms                       |
| **Totali** | **10 989 ms për një kuadër** |

### 1.3 Kontrolli i pavarur i pjesëve

| Pjesa    | v4 i dorëzuar (portreti) | Rig-u prototip 2.5D                                                                                                              |
| -------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Koka     | Jo (një pamje)           | **Po:** yaw, pitch, roll; pivot në qafë                                                                                          |
| Fytyra   | Jo                       | **Po:** 15 Action Units si fusha deformimi; nofulla rrotullohet rreth TMJ                                                        |
| Sytë     | Jo                       | **Po:** çdo sy synon objektivin 3D veç e veç (konvergjencë), kufi 38°, iris i shkurtuar sipas këndit                             |
| Qepallat | Jo                       | **Po:** pulitje 0–1 për secilin sy; ndjekin shikimin vertikal; AU5 (ngritje) dhe AU7 (shtrëngim)                                 |
| Flokët   | Jo                       | **Pjesërisht:** ndjekin kokën (lidhje projektive), por nuk kanë lëvizje sekondare (pa fizikë)                                    |
| Mjekra   | Jo                       | **Po:** ndjek nofullën dhe buzët; goja e hapur pritet nga maska                                                                  |
| Trupi    | Jo                       | **Po:** shtyllë, shpatulla (shrug), përkulje, rrotullim, frymëmarrje                                                             |
| Krahët   | Jo                       | **Po:** IK me dy kocka, me drejtim të preferuar të bërrylit                                                                      |
| Duart    | Jo                       | **Pjesërisht:** 4 poza (pushim, mbledhur, kapje, hapur) të përziera për çdo nyje; pa pëllëmbë nga përpara, pa gishta individualë |
| Objektet | Jo                       | **Po:** objekti ngjitet në pikën e kapjes; kap, ngre, mban, vendos, lëshon                                                       |

### 1.4 Ruajtja e identitetit nëpër poza dhe kënde

**Portreti v4:** identiteti ruhet vetëm sepse ka vetëm një pozë. **[F]**

**Rig-u:** identiteti ruhet me ndërtim, sepse ekziston vetëm **një** kokë 3D proxy dhe **një** pikturë. **[F]**

- Konturi i fytyrës, qafa, flokët dhe mjekra llogariten nga e njëjta formë 3D në çdo kënd. Proxy-ja ka 16 seksione kyçe, 72 nivele × 64 pika, dhe dy guaska: flokë dhe mjekër.
- Drita është e fiksuar në hapësirën e kamerës, kështu hijet lëvizin mbi fytyrë kur koka kthehet. Nuk janë më të pikturuara.
- Piktura v4 (flokët, mjekra, tiparet) lidhet me proxy-n në pamjen e autorizuar dhe ri-projektohet në çdo kuadër.

**Kufiri:** piktura ekziston vetëm për një pamje. Sa më larg yaw 22°, aq më shumë zgjatet. Fleta `out/evidence/rotation.png` **[F]** tregon:

| Diapazoni                           | Rezultati                                                                              |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| yaw 14–34°, pitch −4…+15°, roll ±8° | I pastër: e njëjta kokë, e njëjta dritë                                                |
| yaw 38–42°                          | Fije flokësh kryqëzohen te tëmthi i largët dhe krijojnë një vijë të errët pranë veshit |
| pitch −8° (mjekra lart)             | Një majë flokësh zbret mbi ballë                                                       |
| yaw ≤ 10° ose ≥ 50°, pitch ≤ −12°   | Prishet: flokët e anës së largët ngjeshen dhe kryqëzohen; mjekra zgjatet               |

Profili dhe pamja ballore **nuk mund** të dalin nga kjo pikturë. Duhen pamje shtesë të pikturuara (§7, V4-1).

### 1.5 Çfarë deformohet dhe çfarë është statike

| Deformohet në çdo kuadër                                                  | Statike (ose vetëm transformohet)                                                |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Kontura e kokës, qafës, flokëve dhe mjekrës (z-buffer → marching squares) | Forma e fijeve të flokëve (vetëm ri-projektohen, nuk lëvizin vetë)               |
| Hijet, gjysmëtonet, vija e terminatorit, drita e reflektuar               | Teksturat e lëkurës (pore, njolla): të lidhura me pamjen, jo me sipërfaqen       |
| Landmarks dhe të gjitha pikat e fytyrës sipas AU-ve dhe nofullës          | Dora: pozat përzihen, por silueta e gishtave nuk ka pamje të tjera               |
| Buzët (skaji i brendshëm veç), brendësia e gojës, dhëmbët, gjuha          | Xhaketa: format lëvizin me shpatullat dhe përkuljen, pa palosje ose rroba fizike |
| Qepallat, irisi (i shkurtuar sipas këndit), pupila                        | Seti (cache)                                                                     |
| Krahët (limb me gjerësi në dy anët, që ndjek IK-në), mëngët               | Personazhi tjetër: figurë e thjeshtë nga pas, vetëm kthehet dhe tund kokën       |

### 1.6 Gjetje që prekin integrimin

1. **`safeOpacity` i production-it prish opacitetin e elementeve me `feTurbulence`. [F]** Teksturat dalin me forcë të plotë: sfondi dhe xhaketa bëhen me njolla.
   - Rig-u e shmang duke e vendosur opacitetin brenda matricës së ngjyrave të filtrit.
   - Në integrim kjo duhet zgjidhur te guard-i ose te autori.
2. **resvg 2.6 dështon (panic `geom.rs:27`) në tri raste**, të gjitha të riprodhuara dhe të shmangura në prototip:
   - (a) një element me filtër që del plotësisht jashtë kanavacës;
   - (b) një path bosh me filtër;
   - (c) guard-i i opacitetit brenda një grupi me turbulencë.
   - Zgjidhjet në prototip: renderim me 48 px pad dhe prerje në piksele, dhe asnjë path bosh. **[F]**
3. **Rajonet e filtrave janë të tepruara.** Çdo blur ka rajon 220% të elementit, ndaj resvg llogarit blur mbi një sipërfaqe 4.8 herë më të madhe se sa duhet.
   - Rregullimi i rajonit (`fitFilters`) e përgjysmon kohën e rasterizimit.
   - Ndryshimi i pikseleve është 0.00003/255. **[M]**

---

## 2. Si është ndërtuar dhe si animohet

### 2.1 Koka: proxy 3D + pikturë e lidhur

```
landmarks (130, cm) ──AU-të──▶ landmarks të deformuara ──projektori (yaw, pitch, roll)──▶ tiparet në figurë
        │
        └─▶ proxy 3D (16 seksione → 72×64) ─┬─ guaska e flokëve (offset 0.75–1.7 cm)
                                             └─ guaska e mjekrës (offset 0.34 cm)
                     │
      në çdo kuadër: z-buffer (qeliza 4 px, materiali më i përparmë, N·L, drita e reflektuar, n_z)
                     │
          marching squares → konture vektoriale → Catmull-Rom
          pragje mbi N·L → hije, bërthamë, gjysmëton, terminator, dritë e reflektuar
                     │
  piktura v4 (flokë, mjekër) ── harta e pozicioneve në yaw 22° ──▶ rrjetë deformimi (8 px / 6 px) ──▶ SVG i ri-shkruar
```

- **Proxy-ja** ndërtohet nga 16 seksione horizontale. Kalimi mes tyre bëhet me Catmull-Rom, dhe normalet llogariten nga sipërfaqja.
- **Konturet:** z-buffer-i ruan materialin më të përparmë (0 kokë, 1 mjekër, 2 flokë). Maskat e flokëve dhe mjekrës nxirren prej tij. Mbulimi nuk mjafton, sepse gjysma e pasme e guaskave projektohet mbi fytyrë.
- **Lidhja projektive:** në pamjen e autorizuar llogaritet, për çdo qelizë të figurës, pika 3D e sipërfaqes nën të. Në çdo kuadër kjo pikë projektohet përsëri, dhe koordinatat e çdo path-i në flokë dhe mjekër (`d="…"`) zhvendosen me interpolim bilinear. Kostoja e lidhjes është 190–430 ms, një herë për personazh. **[M]**

### 2.2 Fytyra

- **Action Units (FACS):** çdo AU është një fushë deformimi Gaussian me dorezë në landmarks. Aplikohet njëlloj te landmarks, te proxy-ja, te pikat e pikturës dhe te mjekra, ndaj lëkura, mjekra dhe kontura lëvizin bashkë.
- **Nofulla:** rrotullohet rreth boshtit TMJ deri në 21°, me peshë sipas pozicionit. Nuk është zhvendosje.
- **Buzët:** skaji i brendshëm i sipërm dhe i poshtëm janë të veçanta nga skaji i jashtëm. Kur hapja është mbi 1.2 px vizatohen brendësia e gojës, dhëmbët dhe gjuha.
- **Emocionet** (`EMOTIONS`: neutral, përqendrim, habi, shqetësim, trishtim, zemërim, gëzim, qetësim) nuk janë vetëm fytyrë. Secili përmban:
  - AU-të;
  - qëndrimin e kokës;
  - sjelljen e shikimit (sa shikon personin);
  - trupin (shpatulla, përkulje).
- **Kalimet:** çdo kalim ka kohëzgjatjen e vet, 0.18–0.9 s. Vetullat nisin 80 ms para pjesës tjetër të fytyrës.

### 2.3 Sytë dhe qepallat

- **Shikimi:** objektivi është një pikë 3D, jo një drejtim. Çdo sy e synon veç, kështu objektet afër shkaktojnë konvergjencë. Këndi kufizohet në 38°.
- **Irisi:** vizatohet si disk i shkurtuar sipas këndit. Pikat e dritës në sy nuk shkurtohen dhe zbehen me qepallat.
- **Rendi i lëvizjes:** sakada e syrit vjen e para dhe koka ndjek 0.12 s më vonë. Në kthesat e mëdha të shikimit ka pulitje.
- **Qepallat:** qepalla e sipërme ndjek shikimin vertikal. Pulitja e përzien qepallën e sipërme drejt të poshtmes.

### 2.4 Të folurit (lip-sync)

- **Hyrja:** fjalë me kohë `{text, start, end}`, e njëjta formë si `TimedWord` i kompilatorit (`compiler/src/words.ts`) që pipeline-i e merr nga ElevenLabs.
- **Fonemat:** rregulla G2P për anglishten ndajnë fjalën në foneme me pesha kohëzgjatjeje.
- **Visemet:** 15 viseme (sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, ih, oh, ou).
- **Koartikulimi:** rampat mbivendosen me fonemat fqinje.
- **Saktësia:** lip-sync-u është aq i saktë sa kohët e fjalëve. **Kohët e fonemave brenda fjalës janë të vlerësuara.** ElevenLabs jep kohë karakteresh, jo foneme.
- **Në demo:** kohët e fjalëve janë të shkruara me dorë dhe nuk ka audio. Testi me audio reale mbetet për V4-2.

### 2.5 Trupi

- **Skeleti 2D:** legen, shtyllë, qafë, shpatulla. Përkulja, shrug-u dhe rrotullimi janë kanale me springs (overshoot dhe qetësim).
- **Krahët:** IK me dy kocka. Drejtimi i preferuar i bërrylit mban bërrylin poshtë dhe jashtë. Mëngët ndjekin nyjet me gjerësi të ndryshme në dy anët.
- **Duart:** 4 poza të përziera nyje për nyje. Pika e kapjes ndjek pozën dhe objekti ngjitet atje.
- **Gjestet:** "beat"-et vendosen mbi fjalët e theksuara, me pohim të lehtë me kokë.
- **Lëvizja sekondare:** frymëmarrja dhe springs në trup, kokë dhe dorë.

### 2.6 Ecja dhe ndalimi

- **Faza:** faza e hapit është distanca e përshkuar ndarë me hapin, kështu ngadalësimi i ngadalëson edhe këmbët.
- **Këmbët:** secila këmbë qëndron e ngulur 60% të ciklit dhe lëviz në hark në pjesën tjetër. Gjunjët zgjidhen me IK.
- **Trupi:** legeni lëkundet; shpatullat rrotullohen kundër hapit; krahët lëkunden.
- **Ndalimi:** hapi i fundit sjell këmbën e pasme pranë asaj të përparme, pastaj trupi qetësohet me spring.
- **Matja [M]:** këmba e ngulur lëviz 0.0 px gjatë 183 kuadro-këmbë. Kjo vjen nga ndërtimi: pozicioni i saj është analitik.

### 2.7 Çfarë nuk ka

- Pikturë për pamje të tjera të kokës (profil, ballë, nga pas).
- Fizikë flokësh ose rrobash.
- Pëllëmbë nga përpara dhe gishta individualë.
- Deformim i xhaketës me palosje.
- Kthim i gjithë trupit (ecja është vetëm në profil 3/4).
- Ulje ose ngritje.
- Personazh i dytë i ndërtuar me të njëjtin sistem.

---

## 3. Demonstrimi video

**`out/demo/v4-performance.mp4`:** 22.5 s, 1080×1920, 30 fps, H.264. Daniel në tavolinë, një koleg në plan të parë (nga pas). Ai merr një letër, e lexon, reagon, kthehet nga kolegu dhe flet.

| #   | Kërkesa                          | Ku (koha)                                                                                                            | Si                                                                                      |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1   | Neutral                          | 0.0–1.7 s                                                                                                            | Shikon kolegun, frymëmarrje, pulitje te 0.7 s                                           |
| 2   | Kthen kokën drejt objektit       | 1.75 s (letra), 12.62 s (kolegu)                                                                                     | Koka ndjek syrin, me rrotullim të trupit                                                |
| 3   | Sytë ndjekin objektin para kokës | 1.75 s; 3.3–4.3 s (sytë ndjekin letrën që ngrihet); 12.62 s                                                          | Sakada 0.12 s para kokës                                                                |
| 4   | Pulitje natyrale                 | 0.7, 1.78, 4.25, 6.4, 8.22, 10.2, 12.64, 15.3, 17.05, 20.4 s, plus në kthesat e mëdha të shikimit                    | Qepalla e sipërme mbi të poshtmen, të shkurtra, të çrregullta                           |
| 5   | Pesë emocione të ndryshme        | Përqendrim 4.25 s → habi 7.05 s → shqetësim 8.1 s → trishtim 9.8 s → zemërim 12.85 s → qetësim 15.6 s → gëzim 19.9 s | 8 gjendje, 7 kalime 0.18–0.9 s, me trup dhe shikim                                      |
| 6   | Flet me forma të ndryshme goje   | 13.3–19.95 s, 16 fjalë: "They shut the whole plant down. But we'll be fine, I promise. We'll figure it out."         | Viseme nga kohët e fjalëve                                                              |
| 7   | Gjest natyral me dorë            | 13.15–20.2 s                                                                                                         | Dora e hapur, gjeste mbi fjalët e theksuara (13.88, 14.58, 16.56, 17.6, 19.02, 19.48 s) |
| 8   | Merr një objekt dhe ndërvepron   | Zgjat dorën 2.5 s → hap 2.62 → kap 3.18 → ngre 3.32 → lexon 4.3–10.6 → vendos 11.2 → lëshon 11.55 → pushim 11.85 s   | Letra ndjek pikën e kapjes                                                              |
| 9   | Reagon ndaj personazhit tjetër   | Kolegu tund kokën te 1.4, 12.3, 20.6 s; Daniel kthehet nga ajo te 12.6 s dhe i flet                                  | Shikim, rrotullim trupi, emocion                                                        |

**`out/demo/v4-walk.mp4`:** 5.6 s. Ecje me shpejtësi të plotë, ngadalësim, hapi i ndalimit te 2.9 s, qetësim, dhe shikim drejt kamerës. Është test mekanike.

**Fletët e provave** (`out/evidence/`):

| Fleta               | Çfarë tregon                                                 |
| ------------------- | ------------------------------------------------------------ |
| `rotation.png`      | Brenda diapazonit dhe jashtë tij (rreshti 3), me etiketa     |
| `emotions.png`      | 8 emocionet                                                  |
| `visemes.png`       | 15 visemet                                                   |
| `eyes.png`          | Shikimi në 5 drejtime, konvergjenca, pulitja 35/70/100%, AU5 |
| `skia-vs-resvg.png` | E njëjta fytyrë me dy rasterizuesit                          |

**Defekte të gjetura dhe të rregulluara gjatë kontrollit:**

1. Kuadri 0 kërcente, sepse springs nisnin jashtë objektivit (diferenca mes kuadrove 0→1 ishte 7.6, kur mesatarja është 1.0). Shtova 1 s pre-roll; diferenca ra në 0.6. Video finale u renderua e plotë me rregullimin.
2. Kuadri 213 (7.1 s) ka lëvizjen më të shpejtë: trupi drejtohet 20 px në 6 kuadro, në fillim të habisë. E kontrollova; nuk është kërcim.

---

## 4. Matjet reale

**Makina:** 2 vCPU Intel Xeon 2.1 GHz, 7.8 GB RAM, **pa GPU**. resvg punon vetëm në CPU. Çdo shifër vjen nga skedarët në `out/demo/` (`summary-*.json`, `bench.json`, `cache-check.json`, `skia-check.json`) dhe nga `out/evidence/sheets.json`.

### 4.1 Skena e plotë: dy renderime të plota

Konfigurimi: LOD 0.55, rajonet e filtrave të rregulluara, seti i cache-uar, grade-i në piksele, 2 procese, H.264 crf 18. **[M]**

|                                    | Run 1 (grade v1)             | Run 2 (video finale)             |
| ---------------------------------- | ---------------------------- | -------------------------------- |
| Kuadro                             | 675                          | 675                              |
| Koha reale                         | 1 492.8 s                    | 1 419.7 s                        |
| Ritmi                              | 0.452 kuadro/s               | 0.475 kuadro/s                   |
| Për kuadër: rig (JS)               | 370 ms                       | 335 ms                           |
| Për kuadër: parse SVG              | 44 ms                        | 41 ms                            |
| Për kuadër: rasterizim             | 3 862 ms                     | 3 691 ms                         |
| Për kuadër: kodim H.264            | 38 ms                        | 38 ms                            |
| **Për kuadër: totali**             | **4 314 ms**                 | **4 106 ms**                     |
| Min / mediana / p95 / max (totali) | —                            | 3 035 / 4 113 / 4 968 / 5 900 ms |
| SVG për kuadër                     | 2 403 KB                     | 2 403 KB                         |
| Memoria maksimale për proces       | 339 MB                       | 337 MB                           |
| CPU gjithsej                       | 2 818 s (94% e 2 bërthamave) | 2 707 s (95%)                    |
| GPU                                | nuk ka                       | nuk ka                           |

- **Përsëritshmëria:** dy renderimet ndryshojnë me 5%.
- **Memoria nuk rritet me kuadrot:** brenda një procesi lëkundet 210–337 MB përgjatë 338 kuadrove (GC), pa rritjen 85 MB/kuadër të W0.
- **Kostoja sipas pjesës së skenës:**

| Pjesa e skenës                  | Ms për kuadër |
| ------------------------------- | ------------- |
| 0–3 s, para letrës              | 3 390         |
| 3–11.5 s, letra                 | 4 212         |
| 13–20 s, të folurit dhe gjestet | 4 212         |

**Ecja** (`v4-walk.mp4`, 168 kuadro, personazhi më i vogël në kuadër):

| Matja                  | Vlera         |
| ---------------------- | ------------- |
| Koha reale             | 117.3 s       |
| Ritmi                  | 1.43 kuadro/s |
| Për kuadër: totali     | 1 316 ms      |
| Për kuadër: rig        | 314 ms        |
| Për kuadër: rasterizim | 929 ms        |
| Memoria maksimale      | 324 MB        |

### 4.2 Efekti i çdo optimizimi, hap pas hapi

Gjashtë kuadro të skenës (0, 95, 200, 330, 450, 600), më i miri nga 2 përsëritje, një proces (`bench.json`). **[M]**

| Konfigurimi                                      | Rig (JS) | Rasterizim | **Totali**    | SVG      | Ndryshimi i figurës nga hapi i mëparshëm                                                            |
| ------------------------------------------------ | -------- | ---------- | ------------- | -------- | --------------------------------------------------------------------------------------------------- |
| **A** bazë: detaje të plota, filtrat siç janë    | 323 ms   | 10 231 ms  | **10 554 ms** | 3 190 KB | —                                                                                                   |
| **B** + rajonet e filtrave të rregulluara        | 297 ms   | 5 211 ms   | **5 508 ms**  | 3 196 KB | 0.00003/255: **i njëjtë**                                                                           |
| **C** + LOD i flokëve dhe mjekrës (0.55)         | 248 ms   | 5 098 ms   | **5 346 ms**  | 2 319 KB | 0.34/255 mesatarisht; 0.7% e pikseleve > 16/255 (fijet e flokëve)                                   |
| **D** + cache: seti si imazh, grade-i në piksele | 262 ms   | 3 556 ms   | **3 817 ms**  | 2 409 KB | Seti: 0.20/255 (**i njëjtë**). Grade-i: 0.47/255 mesatarisht 8×8; vetëm modeli i kokrrizës ndryshon |

**Çfarë tregojnë matjet:**

1. **Fitimi më i madh nuk është cache-i.** Është rregullimi i rajoneve të filtrave: −49%, pa asnjë ndryshim në figurë.
2. **LOD-i i flokëve e ul SVG-në me 27%, por rasterizimin vetëm me 2%.** Numri i fijeve nuk është problemi; problem është sipërfaqja e blur-it.
3. **Cache-i (seti dhe grade-i) e ul rasterizimin me 30%,** pra 1.4× në total. Nga A te D, gjithsej 2.8×. Cache-i vetëm nuk e zgjidh problemin.
4. **Gabim i gjetur nga matja dhe i rregulluar:**
   - Versioni i parë i grade-it në piksele ndryshonte nga grade-i SVG me 6.2/255. Vinjeta ishte me formë tjetër, dhe kokrriza e SVG-së përzihet në linearRGB (gri 0.5 = sRGB 188), jo në 128.
   - Pas kalibrimit ndryshimi ra në 0.47/255.
   - Run 1 u renderua me versionin e parë; video finale (run 2) me versionin e kalibruar. Kjo e ul edhe madhësinë e videos nga 166 MB në 55 MB, sepse kokrriza e parë ishte shumë më e fortë.

### 4.3 Ku shkon koha e një kuadri

**Kostoja e rasterizimit për shtresë** (kuadri 200, konfigurimi C, `profile.mjs`) **[M]**:

| Shtresa              | Koha         |
| -------------------- | ------------ |
| Trupi (pa kokën)     | 1 633 ms     |
| Koka                 | 1 532 ms     |
| Seti                 | 1 145 ms     |
| Grade-i (turbulenca) | 762 ms       |
| Kolegu               | 285 ms       |
| **Kuadri i plotë**   | **5 312 ms** |

Seti dhe grade-i janë ato që heq cache-i. Mbeten koka dhe trupi, rreth 3.2 s.

**Rig-u i kokës në JS** (mesatarja e 6 kuadrove, konfigurimi D) **[M]**:

| Hapi                                                                               | Koha         |
| ---------------------------------------------------------------------------------- | ------------ |
| Deformimi i fytyrës (AU dhe nofulla mbi landmarks)                                 | 0.4 ms       |
| Z-buffer (proxy dhe guaskat)                                                       | 17 ms        |
| Konturet                                                                           | 82 ms        |
| Piktura e tipareve                                                                 | 4 ms         |
| Deformimi i pikturës së flokëve dhe mjekrës (rrjeta dhe ri-shkrimi i koordinatave) | 106 ms       |
| Montimi i SVG-së                                                                   | 41 ms        |
| **Gjithsej për kokën**                                                             | **≈ 250 ms** |

- Trupi, IK-ja dhe duart kushtojnë më pak se 15 ms në JS.
- Simulimi i gjithë skenës (gjurmët, springs, IK) kushton 0.56 ms për kuadër.
- Lidhja e pikturës bëhet një herë për personazh: 190–430 ms.

**Përfundimi:** deformimi i fytyrës dhe i trupit është i lirë. Rreth 90% e kohës është rasterizimi i SVG-së, kryesisht blur-et dhe teksturat.

### 4.4 Dy rasterizuesit që ekzistojnë në repo: resvg kundrejt Skia

`skiacheck.mjs`, `skia-check.json`, `out/evidence/skia-vs-resvg.png`. **[M]**

- Repo-ja ka tashmë dy rrugë: resvg (`film/src/raster.ts`, production) dhe Skia nga `@napi-rs/canvas` (`w0/compositor.ts`, kompozuesi W0).
- I njëjti SVG v4 (konfigurimi D, pa setin dhe pa grade-in, që kompozuesi i vizaton në piksele) dha:

| Kuadri        | resvg        | Skia       | Shpejtësia | Ndryshimi (mesatarja 8×8) | Piksele > 8/255 |
| ------------- | ------------ | ---------- | ---------- | ------------------------- | --------------- |
| 0             | 2 846 ms     | 729 ms     | 3.9×       | 0.40/255                  | 0.4%            |
| 95            | 2 755 ms     | 724 ms     | 3.8×       | 0.39/255                  | 0.4%            |
| 200           | 3 565 ms     | 817 ms     | 4.4×       | 0.34/255                  | 0.1%            |
| 330           | 3 603 ms     | 901 ms     | 4.0×       | 0.47/255                  | 0.5%            |
| 450           | 3 544 ms     | 829 ms     | 4.3×       | 0.38/255                  | 0.1%            |
| 600           | 3 354 ms     | 826 ms     | 4.1×       | 0.37/255                  | 0.1%            |
| **Mesatarja** | **3 278 ms** | **804 ms** | **4.1×**   | ~0.4/255                  |                 |

**Kujdes:**

1. Skia nuk e vizaton imazhin data-URI të setit brenda SVG-së. Prova e parë dha sfond të zi dhe ndryshim 23/255. Në kompozuesin W0 seti vizatohet si imazh në kanavacë, kështu që kjo nuk është pengesë, por duhet ditur.
2. Krahasimi i fytyrës nga afër (fleta) nuk tregon ndryshim të dukshëm. Megjithatë, 0.1–0.5% e pikseleve ndryshojnë mbi 8/255 dhe duhen parë në V4-3.
3. W0 ka pasur rritje memorieje me Skia (85 MB/kuadër). Kjo duhet matur me kuadro v4 para çdo vendimi.

**Projeksion [S]:** rig 0.26 s + Skia 0.8 s + seti, grade-i dhe kodimi rreth 0.1 s ≈ **1.2 s për kuadër për bërthamë**, 3–3.5× më shpejt se sot. Kjo nuk është matur si renderim i plotë. Është hipoteza e parë për V4-3.

### 4.5 Çfarë do të thotë kjo për 30 fps

- **Cilësia profesionale 30 fps:** po. Të dyja videot janë 1080×1920, 30 fps, të renderuara kuadër për kuadër pa ulur rezolucionin. Optimizimi i vetëm që e ndryshon figurën është LOD-i i flokëve (0.34/255), dhe mund të fiket për close-up.
- **Në kohë reale:** jo, dhe nuk është objektiv. 30 fps në kohë reale kërkon 33 ms për kuadër; sot jemi rreth 4.1 s për kuadër për bërthamë, 124× larg.
- **Offline, me matjet e sotme [M]:**
  - 1 minutë video = 1 800 kuadro × 4.1 s ≈ **2.05 orë CPU**;
  - në këtë makinë (2 bërthama, 95%) ≈ **65 minuta**.
- **Offline, me më shumë bërthama [S]:** me 16 bërthama ≈ 8 minuta, nëse shkallëzimi është linear. Linearitetin e kam verifikuar vetëm me 2 procese.
- **Me rrugën Skia [S]:** ≈ 0.6 orë CPU për minutë video.
- **Krahasimi me W0:** W0 renderon rreth 0.45 s për kuadër për proces (auditimi i 16 nëntorit). v4 sot është rreth 9× më i shtrenjtë; me Skia do të ishte rreth 2.7×.
- **GPU:** nuk ka në këtë makinë, dhe as resvg as Skia (napi-rs, raster CPU) nuk e përdorin. Një GPU ndihmon vetëm me një renderer që e përdor. Sipas MA-D3, nuk propozoj GPU pa një benchmark të tillë.
- **Fletët e kokës:** çdo pllakë (koka e vetme, detaje të plota, 800 px) kushton 270–640 ms vizatim dhe 1.35–1.53 s rasterizim (`sheets.json`).

---

## 5. Problemet dhe kufizimet e identifikuara

Renditja është sipas peshës për vendimin.

| #   | Problemi                                                                                                                                                                                       | Pesha                   | Prova                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------------------------------- |
| 1   | **Një pamje e pikturuar.** Koka rrotullohet pastër vetëm në yaw 14–34° dhe pitch −4…+15°. Profili, pamja ballore dhe pamja nga pas nuk ekzistojnë.                                             | Kritike                 | `rotation.png`, rreshti 3           |
| 2   | **Kostoja për kuadër:** 3.8–4.3 s për bërthamë, rreth 9× W0. Cache-i jep vetëm 1.4×. Rruga Skia (4.1× e matur te rasterizimi) është e premtueshme, por nuk është provuar në renderim të plotë. | Kritike                 | §4                                  |
| 3   | **Trupi dhe veshjet** nuk janë në nivelin e fytyrës: xhaketë e thjeshtë, duar pa pëllëmbë, gjoks i sheshtë. Në planet e gjera kjo bie më shumë në sy se fytyra.                                | E lartë                 | Videot, kuadrot 13–20 s             |
| 4   | **Emocionet janë të buta.** Shqetësimi, trishtimi dhe zemërimi dallohen kryesisht nga vetullat. Në një plan mesatar në telefon mund të mos lexohen.                                            | E lartë                 | `emotions.png`                      |
| 5   | **Visemet e mbyllura** (sil, PP, FF) janë pothuajse të njëjta. Dhëmbët mezi duken. Mjekra fsheh shumë nga goja.                                                                                | Mesatare                | `visemes.png`                       |
| 6   | **Lip-sync pa audio reale.** Kohët e fjalëve në demo janë të shkruara me dorë, dhe kohët e fonemave brenda fjalës janë të vlerësuara. G2P mbulon vetëm anglishten.                             | Mesatare                | `face.mjs` (`phonemes`, `lipTrack`) |
| 7   | **Pitch-i u kufizua në 15°** në 47% të kuadrove të demos. Leximi kërkonte kokë më poshtë se sa lejon piktura.                                                                                  | Mesatare                | `states.json`                       |
| 8   | **Flokët dhe mjekra janë të ngurtë**: pa lëvizje sekondare.                                                                                                                                    | Mesatare                | Videot                              |
| 9   | **Ecja** vetëm në një kënd, pa kthim, pa ulje ose ngritje. Pozicioni i këmbëve është analitik (0 px rrëshqitje), por stili i ecjes është mekanik.                                              | Mesatare                | `v4-walk.mp4`                       |
| 10  | **Kolegu** është figurë e thjeshtë nga pas. Nuk është personazh v4.                                                                                                                            | E ulët                  | Videoja                             |
| 11  | **Defekte të resvg 2.6** (tri panic) dhe `safeOpacity`, që prish teksturat me turbulencë. Në prototip janë shmangur, por në integrim duhen zgjidhur.                                           | Mesatare                | §1.6                                |
| 12  | **Mëngët në gjest:** tegelat e bërrylit kryqëzohen kur krahu ngrihet, dhe kyçi takon mëngën me një kufi të fortë.                                                                              | E ulët                  | Videoja, 14–18 s                    |
| 13  | **Teksturat e lëkurës** janë të lidhura me pamjen, jo me sipërfaqen. Kur koka rrotullohet, poret "rrëshqasin" pak mbi lëkurë. Në 1080p mezi duket.                                             | E ulët                  | Videoja, nga afër                   |
| 14  | **Një personazh.** Sistemi nuk është provuar ende me një personazh të dytë (grua, moshë tjetër, pa mjekër).                                                                                    | E lartë (për produktin) | —                                   |

---

## 6. Propozimi teknik për integrimin në arkitekturën ekzistuese

**Parimi:** v4 nuk është Engine i ri. Është një **model personazhi** brenda Character Acting. Kamera, seti dhe efektet mbeten te Engine-t që i zotërojnë sot, dhe renderimi te shtresa e kompozimit. **[R]**

| Pjesa e rig-ut                                                                                                                 | Ku shkon                                                                                      | Skedarët ekzistues që preken (vetëm pas miratimit)                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Modeli i kokës (landmarks, proxy, guaskat, piktura, lidhja), fytyra, sytë, qepallat, visemet, trupi, IK, duart, ecja           | **Character Acting**: modul i ri `film/src/character/v4/` pas një ndërfaqeje `CharacterModel` | `rig.ts` mbetet për `@1`/`@2`; `perform.ts` prodhon kanalet                                                                                          |
| Foljet e planit → kanalet e rig-ut (`look`, `glance`, `pick_up`, `put_down`, `give`, `nod`, `point`, `lean_in`, `hesitate`...) | **Character Acting** (`perform.ts`)                                                           | Përkthimi i foljeve në çelësa (`HAND`, `GAZE`, `BODY` të demos janë forma e tyre)                                                                    |
| `Mood` i planit → emocionet e rig-ut                                                                                           | **Character Acting**                                                                          | Harta: sad → sadness, anxious → worry, happy → joy, thinking → concentration, hopeful → reassure; `tired` dhe `determined` kërkojnë preset-e të reja |
| Kohët e fjalëve → visemet                                                                                                      | **Character Acting**, nga `film/src/timing.ts` (`TimedWord`)                                  | Asnjë ndryshim kontrate: forma është e njëjta                                                                                                        |
| Pikat e kapjes, pozicioni i leximit, sipërfaqet e vendosjes                                                                    | **World Builder** (props me affordances, si në W2-V §3.2)                                     | `props.ts`, kontrata e props                                                                                                                         |
| Seti statik si shtresë e cache-uar                                                                                             | **World Builder** prodhon shtresat; **kompozimi** i cache-on                                  | Kompozuesi W0 tashmë punon me shtresa (`w0/compositor.ts`)                                                                                           |
| Zoom-i mbi fytyrë, paralaksi i planit të parë, kufijtë e këndit të kokës gjatë kuadrimit                                       | **Cinematic Camera**                                                                          | `w0/camera.ts`; kamera duhet ta dijë diapazonin e pikturuar                                                                                          |
| Vinjeta, kokrriza, (më vonë) era në flokë                                                                                      | **Environmental Motion & FX**, aplikuar nga kompozuesi në piksele                             | Kompozuesi W0 tashmë ka kokrrizë në kanavacë                                                                                                         |
| Rregullimi i rajoneve të filtrave, renderimi me pad, guard-i për path-et bosh                                                  | **Renderer** (shtresa e renderimit, jo Engine)                                                | `film/src/raster.ts`, **vetëm për paketat `rig@3`**, që filmat ekzistues të mos ndryshojnë                                                           |

**Kontratat:**

- **`rig@3`**, siç u propozua në W2-V. Filmat ekzistues mbeten në `@1`/`@2`, dhe golden-et B1–B5 nuk preken.
- **Personazhi v4 hyn në Asset Manifest (`erkasa.assets/1`) si aset i versionuar.** Përmban landmarks, parametrat e proxy-së, pikturat për çdo pamje dhe diapazonin e mbështetur. Engine-t e marrin vetëm përmes paketës (`erkasa.render/1`).

**Gate-i (para render-it) duhet të refuzojë:**

- poza koke jashtë diapazonit të pikturuar për pamjen e zgjedhur;
- objektiva shikimi që kërkojnë më shumë se 38°;
- `pick_up` ose `give` për props pa pika kapjeje;
- të folur pa `TimedWord`, pa paralajmërim;
- gjuhë pa G2P.

**QC (pas render-it) shton:**

- kërcimet mes kuadrove: diferenca më shumë se 3× mesatarja e shotit, siç e përdora në këtë auditim;
- rrëshqitjen e këmbës;
- kryqëzimin e flokëve, me një test automatik që duhet ndërtuar në V4-1.

**Pse jo Engine i pestë:** çdo përgjegjësi e rig-ut ka tashmë një pronar në standardin e Engine-ve. Rendering-u nuk është Engine. Një "Character v4 Engine" do ta ndante Character Acting në dysh.

**Rendereri:**

- Nuk propozoj rindërtimin e tij.
- Ka një arsye teknike të matur për të krahasuar dy rasterizuesit që ekzistojnë **tashmë** në repo: resvg (`film/src/raster.ts`) dhe Skia (`w0/compositor.ts`).
- Vendimi merret në V4-3 me matje mbi kuadro v4. Matja e parë është në §4.

---

## 7. Roadmap i implementimit

Çdo fazë:

- ka branch-in e vet, testet, before/after dhe video reale;
- kërkon miratimin tënd para fillimit dhe pas pranimit;
- nuk prek `main`, golden-et ose filmat ekzistues;
- nuk përfshin W3;
- nuk merr me qira GPU pa benchmark (MA-D3).

| Faza                                                   | Çfarë                                                                                                                                                                                    | Kriteret e pranimit                                                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **V4-0** Auditimi dhe demonstrimi (ky dokument)        | Auditimi, rig-u prototip, videot, matjet                                                                                                                                                 | **Pret miratimin tënd**                                                                                                                                                                                                                                                |
| **V4-1** Koka me disa pamje                            | Pikturë për 3–4 pamje (ballë ~0°, 3/4 22°, gjysmë-profil ~45°, profil ~75°) mbi të njëjtin proxy. Përzierje e pikturave sipas yaw-it. Kontroll automatik i kryqëzimit të flokëve         | Fleta e rrotullimit: yaw 0–75°, pitch −12…+18° pa vija ose kryqëzime (kontrolli automatik = 0 dhe rishikimi yt). Video kthimi 3/4 → profil → 3/4 pa kërcime (diferenca mes kuadrove ≤ 2× mesatarja). Distancat mes landmarks brenda 1% në të gjitha pamjet             |
| **V4-2** Fytyra që lexohet dhe flet me audio reale     | Shprehje më të forta (mollëzat, rrudhat, sytë); visemet e mbyllura të dallueshme; dhëmbët; lip-sync me ElevenLabs (ti e ekzekuton `pnpm video`)                                          | Test i verbër: dallon ≥ 6 nga 8 emocionet në një fletë pa etiketa. PP, FF dhe sil dallohen në plan mesatar. Në 3 fjali reale, fillimi i gojës brenda ±1 kuadri nga koha e fjalës                                                                                       |
| **V4-3** Rruga e performancës                          | Renderim i plotë me Skia (sot 4.1× më i shpejtë te rasterizimi, e matur); memoria e Skia me kuadro v4; cache i shtresave në kompozues; LOD sipas madhësisë së planit; rajonet e filtrave | Plani mesatar 1080×1920 me një personazh v4: ≤ 1.5 s për kuadër për bërthamë (1 min video ≤ 45 min CPU), i matur në 3 plane reference. Ndryshimi i figurës kundrejt referencës ≤ 1/255 (mesatarja 8×8). GPU vetëm nëse benchmark-u tregon që rendereri mund ta përdorë |
| **V4-4** Trupi, duart dhe veshjet në nivelin e fytyrës | Duar me pamje të pëllëmbës, grusht, tregim, mbajtje; gishta individualë për kapjen; xhaketë me palosje që reagojnë ndaj krahut; trupi në 3/4 dhe në profil                               | Fletët e duarve dhe të trupit miratohen nga ti. Gabimi i kapjes ≤ 2 px. Asnjë kryqëzim mëngë/krah në 3 skena prove                                                                                                                                                     |
| **V4-5** Lëvizja e gjithë trupit                       | Ecje në 3/4 dhe profil me kthim, ndalim, ulje/ngritje, ecje sipas gjendjes emocionale; flokë me lëvizje sekondare                                                                        | Rrëshqitja e këmbës së ngulur ≤ 0.5 px/kuadër (kontrolli QC ekzistues). Pa kërcime të gjurit. 3 klipe të miratuara nga ti                                                                                                                                              |
| **V4-6** Integrimi (`rig@3`)                           | `CharacterModel` v4 në Character Acting; foljet dhe `Mood` → kanale; Asset Manifest; kontrollet e Gate-it dhe QC-së nga §6                                                               | Të gjitha testet ekzistuese kalojnë. Golden-et B1–B5 bajt për bajt të njëjta. Output-i i filmave ekzistues i pandryshuar (hash). Një film benchmark i ri me `rig@3` kalon Gate-in dhe QC-në. Asnjë Engine i pestë                                                      |
| **V4-7** Personazhi i dytë                             | Një personazh tjetër (p.sh. grua, moshë tjetër, pa mjekër) me të njëjtin sistem                                                                                                          | Ndërtohet pa ndryshuar kodin e rig-ut, vetëm me të dhëna dhe pikturë. Identiteti mbahet në 3 plane. Skenë me dy personazhe v4 që shikojnë njëri-tjetrin                                                                                                                |

**Alternativë për të hyrë më shpejt në film [R]:** pas V4-1, V4-2 dhe V4-3, v4 mund të integrohet vetëm për close-up dhe plane mesatare të ulëta, me Gate që refuzon planet e gjera. Kështu fytyra përdoret para se trupi të arrijë nivelin e saj.

---

## 8. Skedarët

| Skedari                                                                                                          | Çfarë                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `prototypes/character-v4/rig/proxy.mjs`                                                                          | Proxy 3D, guaskat, z-buffer, konturet                                                                       |
| `rig/face.mjs`                                                                                                   | Landmarks të rig-ut, AU, nofulla, emocionet, visemet, G2P, lip-sync                                         |
| `rig/headpaint.mjs`, `rig/headrig.mjs`                                                                           | Piktura e kokës v4 dhe rig-u i kokës (`createHeadRig`)                                                      |
| `rig/body.mjs`                                                                                                   | IK, krahët, duart, trupi, mëngët, qafa                                                                      |
| `rig/demo.mjs`, `rig/walk.mjs`                                                                                   | Skena e performancës dhe ecja (gjurmët kohore, simulimi, kuadrot)                                           |
| `rig/render.mjs`                                                                                                 | Renderimi paralel me segmente H.264 dhe matjet për kuadër                                                   |
| `rig/raster.mjs`, `rig/grade.mjs`                                                                                | Rasterizimi si në production, `fitFilters`, grade-i në piksele                                              |
| `rig/audit.mjs`, `rig/bench.mjs`, `rig/profile.mjs`, `rig/cachecheck.mjs`, `rig/skiacheck.mjs`, `rig/sheets.mjs` | Auditimi, benchmark-u A–D, kostoja për shtresë, kontrolli i cache-it, Skia kundrejt resvg, fletët e provave |
| `hair.mjs`                                                                                                       | LOD për flokët dhe mjekrën; portreti v4 i parazgjedhur mbetet bajt për bajt i njëjtë (MD5 `e1bcdcdb…`)      |
| `out/demo/*.mp4`, `out/demo/*.json`, `out/evidence/*.png`, `out/audit/*`                                         | Videot, matjet, fletët                                                                                      |

Në git janë versionet e lehta të videove (`v4-performance-preview.mp4`, 1.8 MB; `v4-walk-preview.mp4`, 0.4 MB, crf 27). Versionet me cilësi të plotë (crf 18; 55 MB dhe 18 MB) janë dërguar në chat dhe rindërtohen me komandat më poshtë.

**Riprodhimi:**

```
node prototypes/character-v4/rig/render.mjs states && node prototypes/character-v4/rig/render.mjs all 2 cache
SCENE=walk node prototypes/character-v4/rig/render.mjs states && SCENE=walk node prototypes/character-v4/rig/render.mjs all 2 cache
node prototypes/character-v4/rig/bench.mjs && node prototypes/character-v4/rig/cachecheck.mjs && node prototypes/character-v4/rig/skiacheck.mjs
node prototypes/character-v4/rig/sheets.mjs
```

---

**Ndalem këtu.** Asnjë implementim në production, asnjë merge në `main`, asnjë W3. Pres vendimin tënd për V4-1 (ose për alternativën).
