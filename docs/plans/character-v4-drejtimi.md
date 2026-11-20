# Character v4: drejtimi artistik (për miratim)

**Statusi:** prototip vizual, jo production. Branch `proto-character-v4`. Nuk u prek kodi i production-it, golden references, W3 apo `main`.

**Kërkesa:** "Stylized Human Realism — Premium 2D Cinematic Animation". Personazhet duhet të njihen si njerëz: kafkë, nofull dhe mollëza natyrale; sy me sclera, iris, pupil dhe qepalla; hundë me strukturë dhe vëllim; buzë natyrale; veshë realistë; flokë dhe mjekër të ndërtuara si duhet; asimetri e lehtë njerëzore; shprehje bindëse. Pa karikaturë të thjeshtuar. Fillimisht një portret i përpunuar dhe një dizajn i trupit të plotë; rig-u SVG vjen pas miratimit.

## 1. Çfarë morëm nga dy fotot e referencës

Fotot u përdorën **vetëm për anatominë dhe proporcionet**. Identiteti nuk u kopjua: personazhi është origjinal dhe me qëllim ndryshon në çdo tipar identifikues (flokë me ndarje anash në vend të prerjes së shkurtër anash, sy kafe, hundë më e gjatë me një gungë të lehtë, mjekër e plotë e shkurtër, fytyrë më e gjatë).

Mësimet anatomike që hynë në dizajn:

| Tipari            | Çfarë tregojnë referencat                                                                                            | Si u zbatua në v4                                                                                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kafka dhe nofulla | Nofull e gjerë me kënd të qartë, mollëza që kapin dritën, tëmtha pak e zhytur                                        | Model 3D me 52 pika anatomike (mesatare antropometrike mashkullore), projektuar në kënd 3/4                                                                           |
| Sytë              | Qepalla e sipërme e varur mbi palë, iris i mbuluar pjesërisht, pak e bardhë poshtë irisit, qese të lehta poshtë syve | Sclera që errësohet në cepa dhe nën qepallë, iris me fije dhe unazë limbale, pupil, dy pika drite, qepalla me trashësi, vija e palës, qerpikë të shkurtër mashkullorë |
| Hunda             | Urë e drejtë, majë e rrumbullakët, krahë hunde të dukshëm, vrima në hije                                             | Hunda e ndërtuar nga dritë dhe hije (plani anësor, hija nën majë, hija që hedh mbi faqe), vija vetëm te krahët dhe poshtë majës                                       |
| Buzët             | Buzë mashkullore pak të përcaktuara, buza e poshtme kap dritë, cepat e thellë                                        | Ngjyra afër lëkurës, vija e gojës më e forta në cepa, buza e sipërme pjesërisht nën mustaqe                                                                           |
| Mjekra            | Dendësi që ndryshon (e dendur në mjekër, më e rrallë në faqe), qime që dalin jashtë konturit                         | Vëllimi pikturohet më parë, pastaj tufat dhe në fund qimet e veçanta. Thinja te cepat e gojës, qime të rralla mbi vijën e faqes                                       |
| Asimetria         | Asnjë fytyrë nuk është simetrike                                                                                     | Vetulla e largët pak më lart, cepi i largët i gojës pak i ngritur, gjeometria e syve pak e ndryshme                                                                   |

## 2. Drejtimi i propozuar: "Erkasa Cinematic"

1. **Ndërtimi para stilit.** Çdo tipar ulet mbi pika anatomike në 3D. Stilizimi vjen nga zgjedhjet e dizajnit (plane të thjeshtuara, shpërndarja e detajit), jo nga forma gjeometrike primitive.
2. **Drita si dizajn.** Dritë kryesore e ngrohtë nga lart majtas, në anë të fytyrës (short lighting): ana e gjerë e fytyrës bie në hije, me një trekëndësh drite poshtë syrit (Rembrandt). Dritë e ftohtë nga pas djathtas (rim) ndan siluetën nga sfondi.
3. **Hijet si forma të projektuara.** Buzë e prerë mbi kocka (tëmth, mollëz, hundë), buzë e butë mbi mish (faqe). Kufiri dritë-hije është brezi më i ngrohtë dhe më i ngopur (drita që përhapet nën lëkurë).
4. **Vijë selektive.** Vijë kafe e errët me trashësi që ndryshon: më e rëndë në anën e hijes dhe te mbivendosjet, pothuajse e humbur aty ku drita bie fort. Nuk ka kontur rreth çdo forme.
5. **Zona ngjyre si te njerëzit e vërtetë.** Balli pak më i verdhë, mesi i fytyrës (hunda, faqet, veshët) më i kuq, hijet ngrohen në kufi dhe ftohen në thellësi.
6. **Teksturë e përmbajtur.** Pore, njolla të lehta, kokërr filmi. Cilësia vjen nga format, jo nga zhurma.
7. **Paleta** (shih tabelën e drejtimit): lëkurë ngjyrë pjeshke e ngrohtë, flokë kafe shumë të errët, xhaketë blu marine, triko ngjyrë tërshëre, sfond gri-gjelbër i errët. Kontrast i ngrohtë/i ftohtë për pamje kinematografike.

## 3. Si është ndërtuar (gati për rig-un, por pa rig ende)

- **Koka:** `model.mjs`. 52 pika 3D në centimetra, të projektuara me kthesë (yaw), anim (pitch) dhe rrotullim (roll). Çdo hije dhe dritë e fytyrës është kurbë nëpër pika të projektuara. Kur koka kthehet në rig, format ndjekin pikat. Silueta e lëkurës është ende e vizatuar për këtë kënd, ndërsa rig-u do ta nxjerrë nga modeli.
- **Shtresat,** secila grup SVG me emër, e animueshme veçmas: qafa → lëkura → zonat e ngjyrës → drita → hijet → okluzioni → teksturat → sytë/vetullat/hunda/goja → mjekra → flokët → veshi → vijat.
- **Flokët:** tufa që rriten nga ndarja dhe nga vija e flokëve sipas një fushe rrjedhe të projektuar. Çdo tufë ka gjerësi, anë të ndriçuar, anë të errët, hije kontakti dhe fije brenda. Shkëlqimi është brez që i pret tufat. Në rig, tufa bëhet zinxhir që lëkundet dhe fijet e ndjekin.
- **Mjekra:** vëllimi (pjesa e ndriçuar, plani anësor, pjesa poshtë) → tufat → qimet. Buzët përjashtohen me maskë, ndaj goja mund të lëvizë.
- **Veshi:** dizajnohet një herë në kornizën e vet dhe vendoset me transformim afin nga tri pika (tragus, maja, pjesa e pasme), kështu kthehet me kokën.
- **Trupi:** këmbët ndërtohen mbi skelet (ije, kofshë, gju, pulpë, kyç i këmbës) me gjerësi të ndryshme para dhe prapa, ndaj gjuri dhe pulpa kanë formë. Qëndrim contrapposto: pesha në këmbën e largët, gjuri i afërt pak përpara.
- **Dora:** çdo gisht është zinxhir nyjesh (MCP, PIP, DIP, maja) me gjerësi për nyje, rrudha në nyje dhe thua. Gishti i madh i kundërvihet. Përkulja e lirë rritet nga gishti tregues te i vogli. E njëjta strukturë do të përdoret për pozat e dorës në rig.

## 4. Kufizimet e prototipit (të thëna hapur)

- **Shpejtësia e renderimit.** Portreti 1600×2000 është 3.5 MB SVG dhe del në rreth 13 sekonda. Për video (1080×1920, 30 fps) kjo s'mjafton. Në rig, shtresat statike (fijet e flokëve, teksturat e mjekrës, poret) duhet të ruhen gati si imazh (cache) për çdo personazh dhe kënd, ndërsa animohen vetëm tufat, tiparet dhe trupi. Para çdo vendimi për GPU nevojitet një benchmark (MA-D3).
- **Një kënd dhe një personazh.** Ka vetëm pamjen 3/4 dhe vetëm Daniel Vos-in. Pamja ballore, profili, një grua dhe një i moshuar nuk janë bërë ende. Pikërisht kjo provon nëse metoda funksionon për çdo personazh.
- **Silueta e fytyrës, flokët dhe mjekra janë vizatuar për këtë kënd.** Rig-u duhet t'i nxjerrë nga modeli 3D ose t'i ketë në sete sipas këndit.
- **Trupi i plotë është më pak i përpunuar se portreti.** Rrudhat e pantallonave dhe forma e çizmeve janë në nivel dizajni, jo final.
- **Kufiri i asaj që bëhet me kod.** Kodi jep strukturë, konsistencë dhe animim. Një ilustrues që rafinon model sheet-in mbi këtë strukturë do ta ngrinte edhe më shumë cilësinë e formave (pyetja nga v3 mbetet e hapur).

## 5. Vendimet që duhen

1. **Drejtimi artistik:** miratohet ky stil (realizëm njerëzor i stilizuar, dritë kinematografike, vijë selektive)? Apo duhet ndryshuar diçka konkrete: më shumë ose më pak realizëm, mjekra (më e shkurtër, pa mjekër), flokët, paleta, sasia e vijës?
2. **Personazhi:** Daniel Vos të jetë personazhi i parë i cast-it në rig-un v4, apo vetëm referencë stili?
3. **Ilustruesi:** a do që një ilustrues ta rafinojë model sheet-in mbi këtë strukturë para rig-ut?

## 6. Rruga pas miratimit (vetëm me miratimin tënd për secilën fazë)

1. **V4.1 Pamjet:** pamja ballore, 3/4 dhe profili nga i njëjti model 3D, si dhe një grua dhe një burrë i moshuar me të njëjtën metodë.
2. **V4.2 Fytyra e animueshme:** kontrollet e shprehjeve nga v3 (18 kontrolle të ngjashme me FACS) mbi fytyrën e re, format e gojës për fjalët, shikimi dhe qepalla.
3. **V4.3 Flokët dhe mjekra:** tufa si zinxhirë që lëkunden, tekstura të ruajtura gati (cache) për shpejtësi.
4. **V4.4 Trupi dhe duart:** veshje mbi skelet, gjashtë pozat e dorës, kontakti me objektet.
5. **V4.5 Benchmark:** kohë për kuadër në 1080×1920, objektivi nën 1 s/kuadër në CPU, para çdo vendimi për GPU.
6. **V4.6 Integrimi në pipeline** si version i ri i rig-ut, me teste dhe krahasime para/pas. Golden references preken vetëm me miratimin tënd.

## Skedarët

- `prototypes/character-v4/`: `model.mjs` (koka 3D), `head.mjs` (fytyra e pikturuar), `hair.mjs` (flokët dhe mjekra), `portrait.mjs`, `fullbody.mjs`, `board.mjs`, `render.mjs`
- `prototypes/character-v4/out/v4-portrait.png`, `v4-fullbody.png`, `v4-direction-board.png`
- Rindërtimi: `node prototypes/character-v4/render.mjs portrait`, `node prototypes/character-v4/render.mjs full`, `node prototypes/character-v4/board.mjs`
