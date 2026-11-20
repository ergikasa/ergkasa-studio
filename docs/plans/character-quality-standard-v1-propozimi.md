# Character Quality Standard V1: propozimi i workflow-t artistik dhe teknik

20 nëntor 2026. Përgjigje për "Advanced 2D Human Character Art Direction". Branch `plan-character-art-standard`, mbi `cl-2-contract` (Faza 2).

Ky dokument është **vetëm propozim**. Nuk është vizatuar, rig-uar apo implementuar asgjë. Kontrata `erkasa.character/1` nuk është ndryshuar.

Shenjat: **[F]** e verifikuar · **[M]** e matur · **[S]** vlerësim · **[R]** rekomandim · **[?]** e paverifikuar.

---

## 0. Përmbledhja

1. **Standardi i ri ndryshon kush e bën artin, jo vetëm si duket.**
   - Pikturë kinematografike, anatomi e besueshme, lëkurë me plane dhe dritë, flokë me masa, rroba me palosje: ky është nivel ilustruesi profesional.
   - **Unë nuk mund ta pikturoj këtë art me kod në këtë nivel.**
     - Portreti v4 është kufiri i asaj që arrita me kod (§1).
     - Gjykuar me standardin e ri, ka qafë cilindër, hije grafike me plane dhe një xhaketë me forma topash.
     - Një v5 me kod do të ishte më e mirë, por jo në nivelin që kërkon. Nuk dua ta paraqes si të tillë.
2. **Rekomandimi [R]: arti master e pikturon një ilustrues profesional. Unë ndërtoj gjithçka përreth.**
   - Unë përgatis specifikimet dhe guidat 3D të anatomisë për të gjitha pamjet.
   - Unë kontrolloj konsistencën dhe bëj importin, mesh-in, skeletin, rig-un e fytyrës, paketën dhe testet e deformimit.
   - Gjenerimi me AI mbetet rrugë eksploruese për më vonë, pas G1, dhe gjithmonë me pikturim sipër nga artisti (§2).
3. **Rendi i punës ndjek §9 të kërkesës:**
   - **Porta A:** arti dhe model sheet-i, për miratimin tënd.
   - **Porta B:** arti i ndarë në shtresa, vetëm pas miratimit të Portës A.
   - **Porta C:** rig-u dhe testet e deformimit.
   - Pa miratimin e Portës A nuk ka rig, animim apo integrim.
4. **Kontrata `erkasa.character/1` e mban këtë art pa ndryshim themelor.**
   - Pjesët me teksturë mbi mesh të deformueshëm, skinning, morph targets, pamjet sipas këndit, opacity për zëvendësim vizatimesh dhe veshjet ekzistojnë dhe janë testuar në Fazën 2.
   - **Propozoj 5 shtesa opsionale** (§6), sepse arti i pikturuar në shtresa i kërkon:
     - mënyra përzierjeje (multiply/screen) për hijet dhe dritat;
     - prerje sipas një pjese tjetër (`clipTo`);
     - iris i pikturuar;
     - kanal për anën e dritës kryesore;
     - pamje që kalojnë 180° (pamja nga pas).
   - Të gjitha ruajnë `/1`. Asnjë nuk implementohet pa miratimin tënd dhe pa një provë performance.
5. **Para se të nisë puna kam nevojë për 6 vendime nga ti** (§9). Kryesorja: kush e pikturon artin.

---

## 1. Ku jemi kundrejt standardit [F]

| Kërkesa e standardit                                | Portreti v4 (kod)                                                        | Karakteri testues i Fazës 2 |
| --------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------- |
| Kafka, mollëzat, nofulla, mjekra me volum           | Pjesërisht: forma e kokës mirë, hijet si plane grafike me skaje të forta | Jo (teknik)                 |
| Qafa me trapez dhe sternocleidomastoid              | **Jo:** qafë cilindër me një brez hijeje                                 | Jo                          |
| Klavikulat, shpatullat, kraharori                   | **Jo:** xhaketa i fsheh dhe shpatullat duken si topa                     | Jo                          |
| Sytë: sklera, iris, bebëz, qepalla, kanali i lotëve | Po, të mira                                                              | Iris vektorial i thjeshtë   |
| Hunda: ura, maja, vrimat, krahët                    | Pjesërisht: hije grafike, jo kalime të buta                              | Jo                          |
| Goja, filtrumi, buzët                               | Pjesërisht                                                               | Jo                          |
| Lëkura me plane anatomike dhe dritë, jo plastike    | **Jo:** gradientë me skaje të forta, pa ndryshim tekstural               | Jo                          |
| Flokë me masa dhe detaje                            | Po, pika më e fortë                                                      | Jo                          |
| Rroba me palosje, tegela, jakë, kopsa               | Pjesërisht: tegela, pa palosje që ndjekin trupin                         | Jo                          |
| Duar me 5 gishta dhe artikulacione                  | Strukturë në kod, e paprovuar në pikturë                                 | Jo                          |
| Pamjet front, 3/4, profil, nga pas, turnaround      | Vetëm 3/4                                                                | Front + 3/4 e kokës         |
| Gati për animim                                     | Jo: SVG 3.5 MB, 13 s për portret                                         | Po, por pa art              |

**Përfundimi:**

- Kodi jep strukturë, konsistencë, saktësi gjeometrike dhe animim.
- Kodi nuk jep pikturim: kalime tonale, ndryshim teksture, gjykim artistik mbi formën.
- Kjo është arsyeja pse rruga A (§2) është rekomandimi im dhe jo një v5 me kod.

---

## 2. Kush e pikturon artin: tri rrugë

| Rruga                                                                                      | Cilësia e pritshme                                                               | Konsistenca mes pamjeve                                | Gati për animim                                            | Rreziku                                                                                                                |
| ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **A. Ilustrues profesional** (pikturë dixhitale), me guidat dhe specifikimet e mia **[R]** | E lartë, nëse portofoli e provon                                                 | E lartë me guidat 3D dhe kontrollin e landmarks (§3.4) | Po, nëse ndjek specifikimin e shtresave (§5)               | Kosto dhe kohë (duhen kuota), varësi nga një person, kontratë me kalim të plotë të të drejtave                         |
| **B. Gjenerim me AI** (modeli ynë në GPU, G1) me kontroll nga guidat 3D, + pikturim sipër  | E ndryshueshme; duart dhe detajet e vogla janë pikë të njohura të dobëta **[?]** | E dobët pa trajnim të veçantë për personazhin **[?]**  | Jo vetë: ndarja në shtresa dhe nën-pikturimi bëhen me dorë | G1 nuk ekziston; MA-D3 ndalon GPU pa benchmark; licencat e modeleve duhen verifikuar; prapë duhet artist për pastrimin |
| **C. Claude me kod** (rruga v4, me tekstura të pikturuara procedurale)                     | **Nën standard** (§1)                                                            | E lartë                                                | Po                                                         | Rezultat që nuk e kalon Portën A                                                                                       |

**[R]**

- **Daniel Vos dhe karakteri femër:** rruga A. Ky është standardi që do të ndjekin të gjitha personazhet e tjera.
- **Rruga B:** provë më vete pas G1. Pyetja e saj: a mund të prodhojë karaktere të tjera në stilin e miratuar me më pak punë artisti? Arti i Danielit bëhet referenca e stilit.
- **Rruga C:** nuk e propozoj për artin. Kodi im shkon te guidat, kontrollet dhe rig-u.

**Ndryshim nga plani i Character System V1:**

- Aty Builder-i parametrik ishte rruga kryesore e autorimit dhe artisti opsional.
- Me standardin e ri, **artisti bëhet burimi i artit dhe Builder-i bëhet mjeti i rig-ut dhe i kontrollit.**
- Formati dhe Runtime-i nuk ndryshojnë për këtë, sepse ndërfaqja `ArtworkSource` ishte projektuar pikërisht për këtë rast.

---

## 3. Workflow-i artistik (Porta A): para çdo rig-u

### 3.1 Style bible e karaktereve të Erkasa-s (identitet origjinal)

- **Përpara Danielit:** 2–3 style frames, ku artisti provon stilin mbi një kokë të thjeshtë.
- **Rregullat që shkruaj unë në style bible:**
  - **Vlerat tonale:** 5–7 nivele për lëkurën, nga drita deri te okluzioni.
  - **Temperatura:** dritë kryesore e ngrohtë, mbushje e ftohtë, rim vetëm kur skena e justifikon.
  - **Saturimi:** i kontrolluar; lëkura pa portokalli plastike.
  - **Vija:** pa kontur të zi. Skajet përcaktohen nga forma, kontrasti dhe ngjyra. Vija e hollë me ngjyrë vetëm në palosje dhe në kufijtë e materialeve.
  - **Furça:** teksturë e lehtë e dukshme në afërsi, e qetë në distancë.
  - **Materialet:** lëkura, flokët, leshi, pambuku, lëkura e këpucëve, metali i orës, secili me mënyrën e vet të ndriçimit.
  - **Lista e asaj që nuk lejohet:** nga §8 e kërkesës, me shembuj vizualë.
- **Konventa e dritës për artin master:**
  - dritë kryesore lart-përpara-majtas, rreth 45°;
  - mbushje e butë nga e djathta;
  - okluzion ambienti i pikturuar.

  Konventa siguron që e njëjta dritë të jetë në çdo pamje dhe shprehje. Si përshtatet me dritën e skenës: §5.8 dhe K4.

### 3.2 Identiteti i Danielit (propozim për miratim)

- **I mbajtur nga v4, vetëm si referencë identiteti:**
  - burrë 44 vjeç, 181 cm, rreth 7.4 koka;
  - flokë kafe të errët me vijë anësore;
  - mjekër e plotë e shkurtuar;
  - sy kafe-qelibar;
  - vetulla e majtë pak më e ngritur (asimetria e identitetit).
- **Shtesat që propozoj:**
  - pak gri në tëmtha (mosha 44);
  - rrudha të lehta në ballë dhe në cepat e syve;
  - hundë me urë të drejtë dhe majë pak të gjerë;
  - asimetri e lehtë në buzëqeshje (ana e djathtë ngrihet më shumë).
- **Profesioni dhe qëndrimi:** profesionist urban, p.sh. konsulent ose arkitekt. Qëndrim i drejtë, por jo i ngurtë, me pak peshë të akumuluar në bel. **Ndryshoje lirisht.**
- **Veshja e parë**, për model sheet-in:
  - xhaketë blu e errët pa strukturë;
  - këmishë oxford e çelët me jakë të hapur;
  - pantallona antracit;
  - këpucë lëkure kafe;
  - orë në dorën e majtë (asimetri e dobishme për kontrollin e pamjeve).
- **Mos e kufizo dizajnin te v4:** artisti merr këtë përshkrim, jo figurën v4 si model për t'u kopjuar.

### 3.3 Model sheet-i: çfarë dorëzohet për Portën A

Në rendin e §9 të kërkesës. Çdo hap ka miratimin tënd para të ardhshmit.

| #   | Dorëzimi                                                                                                                                                                                                                                                                          | Formati                            | Kontrolli                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------- |
| A1  | Portreti me detaje të larta: 3/4 djathtas dhe front, koka + shpatullat                                                                                                                                                                                                            | PNG 3000 px lartësi, PSD/KRA burim | Ti: identiteti dhe cilësia                          |
| A2  | Full body front: poza natyrale **dhe** poza e rig-ut (krahët 30–40° larg trupit, këmbët pak të ndara)                                                                                                                                                                             | PNG 4500 px                        | Proporcionet 7–7.5 koka                             |
| A3  | 3/4 djathtas, profil djathtas, nga pas; pastaj 3/4 majtas dhe profil majtas                                                                                                                                                                                                       | Fletë turnaround                   | Landmarks në të njëjtat lartësi (§3.4)              |
| A4  | Fleta e shprehjeve, 16 koka në 3/4: neutrale, buzëqeshje e lehtë, buzëqeshje e plotë, shqetësim, trishtim, zemërim, habi, frikë, neveri, përbuzje (njëanshme), skepticizëm, të menduarit, lodhje, vendosmëri, dhimbje, qetësi                                                     | Fletë                              | Lexueshmëria në 1/4 të ekranit të telefonit         |
| A5  | Format e gojës: 10 visema në 3/4 dhe front (pushim, A, E, I, O, U, M/B/P, F/V, L, TH), me dhëmbë dhe gjuhë aty ku duken                                                                                                                                                           | Fletë                              | Lexueshmëria                                        |
| A6  | Fleta e duarve, majtas dhe djathtas: e lirshme, e hapur, gishtat e hapur, grusht, tregim, kapje me majat (pinch), kapje cilindri (filxhan), kapje e sheshtë (letër, telefon), pëllëmba lart, dora në mjekër, dora mbi tavolinë, numërim me dy gishta; secila nga para dhe nga pas | Fletë                              | 5 gishta, nyjet, përmasat kundrejt fytyrës          |
| A7  | **Fleta e nyjeve** (shtesë e propozuar, sepse kërkesa thotë "mos krijo art që prishet kur deformohet"): bërryli 0/45/90/135°, shpatulla 0/90/150°, kyçi, gjuri, ijet në ulje, qafa e kthyer dhe e anuar, trungu i përkulur dhe i rrotulluar                                       | Fletë                              | Bëhet referenca e testeve të deformimit në Portën C |
| A8  | Konsistenca: mbivendosja e landmarks dhe e siluetave mes pamjeve + raporti im                                                                                                                                                                                                     | Fletë + raport                     | Unë mat, ti gjykon                                  |

**Matjet janë vetëm roje.** Suksesi i Portës A është gjykimi yt: a duket si studio profesionale në portret, full body, kënde dhe shprehje?

### 3.4 Si e kontrollojmë konsistencën mes pamjeve

1. **Guida 3D e anatomisë.**
   - Pas miratimit të A1 dhe A2, ndërtoj një model 3D të thjeshtë të trupit të Danielit me proporcionet e miratuara. Baza është MakeHuman/MPFB, me output CC0 që lejon përdorim komercial.
   - Nga modeli nxjerr për çdo kënd siluetën, linjat e landmarks dhe pozicionin e nyjeve.
   - Artisti pikturon mbi këto guida. Guidat nuk janë art: ato vetëm mbajnë anatominë të njëjtë në çdo kënd.
2. **Landmarks.**
   - Në çdo pamje shënohen rreth 40 pika: sytë, baza e hundës, goja, mjekra, veshët, supet, bërrylat, kyçet, ijet, gjunjët, nyjet e këmbëve.
   - Mjeti im kontrollon lartësitë mes pamjeve (toleranca ±2% e lartësisë së kokës), proporcionet dhe gjatësitë e gjymtyrëve.
3. **Ngjyra.**
   - Mostrat e lëkurës, flokëve dhe syve krahasohen mes pamjeve dhe shprehjeve.
   - Shmangia mbi një prag shënohet për rishikim, jo refuzohet automatikisht.
4. **Gjykimi yt mbi fletën përfundimtare.** Pamjet nuk duhet të duken si personazhe të ndryshëm.

---

## 4. Workflow-i teknik (Portat B dhe C): vetëm pas miratimit të artit

| Hapi                   | Kush          | Çfarë ndodh                                                                                                                                                                                                                                |
| ---------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B0. Prova teknike      | Unë           | Para artit me shtresa: tekstura sintetike me dendësinë, rezolucionin dhe numrin e shtresave të synuar mbi Runtime-in e Fazës 2. Mat koston për kuadër dhe memorien. Nëse nuk mjafton, rregullohet formati **para** se artisti të pikturojë |
| B1. Arti me shtresa    | Artisti       | Për çdo pamje, PSD/KRA sipas specifikimit të shtresave (§5.1), me nën-pikturim te nyjet                                                                                                                                                    |
| B2. Importi dhe linter | Unë           | `ArtworkSource` për PSD/KRA/ORA. Kontrollon emrat, shtresat që mungojnë, nën-pikturimin, rezolucionin, profilin e ngjyrës dhe vrimat në alpha                                                                                              |
| B3. Mesh-i             | Unë (Builder) | Mesh nga alpha i çdo shtrese, me unaza tehesh pingul me përkuljen te nyjet dhe dendësi më të lartë te sytë dhe goja                                                                                                                        |
| B4. Skeleti            | Unë           | Nga landmarks dhe guida 3D: trupi, qafa (2), koka, nofulla, sytë, gishtat (3 për gisht), këmbët dhe shputat                                                                                                                                |
| B5. Peshat             | Unë           | Automatike nga largësia përgjatë mesh-it, pastaj rregullim i shënuar. Pasqyrim vetëm aty ku arti është simetrik                                                                                                                            |
| C1. Fytyra             | Unë           | Morph-et e AU-ve **përshtaten me vizatimet e artistit** (A4): landmarks mbi neutralen dhe mbi shprehjen, pastaj deformim i mesh-it drejt shprehjes. Visemat zgjidhen me zëvendësim vizatimesh (A5). Sytë: §5.5                             |
| C2. Pamjet             | Unë           | Pjesët për çdo pamje, morph-et e këndit ±15°, kufijtë e pamjeve (§5.6)                                                                                                                                                                     |
| C3. Korrigjueset       | Unë           | Morph korrigjues për bërrylin, shpatullën, kyçin, gjurin dhe qafën, të përshtatur me fletën e nyjeve (A7)                                                                                                                                  |
| C4. Veshjet            | Unë + artisti | Shtresat e veshjes për çdo pamje, me të njëjtin skelet. Palosjet me korrigjues ose zëvendësim                                                                                                                                              |
| C5. Testi i deformimit | Unë → ti      | Runtime-i renderon pozat e fletës A7 dhe shprehjet A4; krahasohen krah për krah me vizatimet e artistit. Video me lëvizjet e kërkuara nga §7 i kërkesës                                                                                    |
| C6. Paketa             | Unë           | `chr_daniel@1`, validimi, vetëkontrolli, benchmark-u, `approval: pending` derisa ta miratosh                                                                                                                                               |

**Ndarja e punës:**

- Artisti vetëm pikturon: art master, model sheet dhe shtresa.
- Rig-u jeton në formatin tonë, me teste dhe me vizatimet e artistit si referencë objektive.
- Nëse artisti që gjen di edhe rigging në Spine, mund ta bëjë ai rig-un dhe ne e importojmë. Licenca e Spine-it për importuesin tonë duhet verifikuar **[?]**.

**Faza e parë e prodhimit (slice 1):**

- Vetëm pamjet 3/4 djathtas dhe front, plus format e gojës, sytë dhe duart për këto pamje.
- Këto provojnë gjithë zinxhirin para se të paguhen pamjet e tjera.
- Pastaj: profilet dhe 3/4 majtas (ecja), dhe më në fund pamja nga pas dhe 3/4 nga pas (turnaround).

---

## 5. Përkthimi në `erkasa.character/1`

### 5.1 Ndarja në shtresa

Emërtimi: `<pamja>/<rajoni>/<pjesa>[_l|_r][@<varianti>]`, p.sh.:

- `q3r/head/brow_l`
- `q3r/mouth/viseme_o`
- `q3r/shade/jaw_neck_ao`
- `front/arm/forearm_r`
- `q3r/outfit_business/jacket_sleeve_upper_r`

| Rajoni           | Shtresat (për çdo pamje)                                                                                                                                             | Pse të ndara                                                        |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Koka             | kafka/fytyra (lëkura me pikturë), veshët, nofulla dhe mjekra (pjesa poshtë gojës)                                                                                    | Nofulla hapet; veshët kthehen ndryshe nga fytyra                    |
| Sytë             | sklera, irisi i pikturuar, bebëza, qepalla e sipërme, qepalla e poshtme, qerpikët, kanali i lotëve, hija e qepallës mbi sy, shkëlqimi                                | Shikimi, pulitja, qepallat që ndjekin shikimin                      |
| Vetullat         | majtas, djathtas                                                                                                                                                     | AU1, AU2, AU4 të pavarura                                           |
| Hunda            | ura dhe maja (në fytyrë), vrimat, krahët e hundës, hija poshtë hundës                                                                                                | AU9 (rrudhja e hundës), morph-et e këndit                           |
| Goja             | buza e sipërme, buza e poshtme, cepat, brendësia, dhëmbët sipër dhe poshtë, gjuha, mustaqet                                                                          | Visemat, buzëqeshja, hapja e nofullës                               |
| Flokët           | masa e pasme, masat anësore, masa e sipërme, balluket, fijet e lira, hija e flokëve mbi ballë                                                                        | Lëvizja dytësore, mbulimi i veshëve sipas pamjes                    |
| Qafa             | qafa me trapezin dhe SCM, hija e nofullës mbi qafë, ana e pasme                                                                                                      | Kthimi i kokës, hija që lëviz me nofullën                           |
| Trungu           | kraharori me klavikulat, barku, shpina, legeni                                                                                                                       | Përkulja, frymëmarrja                                               |
| Krahët           | supi (deltoidi), krahu, bërryli (copë mbivendosjeje), parakrahu, kyçi                                                                                                | Nyjet pa vrima                                                      |
| Duart            | pëllëmba, 5 gishta × 3 segmente, plus vizatime të plota për pozat e forta (grusht, pinch)                                                                            | Artikulimi + zëvendësimi aty ku deformimi nuk mjafton               |
| Këmbët           | kofsha, gjuri, pulpa, kyçi i këmbës, shputa                                                                                                                          | Ecja, ulja                                                          |
| Veshjet          | për çdo veshje dhe pamje: copat sipas pjesës së trupit që mbulojnë, jaka, mëngët sipër dhe poshtë, manshetat, kopsat, xhepat, palosjet në nyje si shtresa të veçanta | Ndjekja e skeletit, fshehja e trupit, palosjet                      |
| Hijet dhe dritat | okluzioni në kontakte (mjekra mbi qafë, jaka, krahu mbi trung), hijet e anës së dritës (majtas dhe djathtas), dritat e buta                                          | Lëvizin me pjesën që i shkakton; ndryshojnë me dritën e skenës (K4) |

Numri i pritshëm **[S]**:

- koka: rreth 60 shtresa për pamje;
- trupi: rreth 45;
- duart: rreth 35 për dorë;
- veshja: 20–30.

### 5.2 Formati i artit

- **Burimi:**
  - PSD ose KRA, me grupe sipas rajonit;
  - mund të pikturohet në 16-bit; eksportohet në 8-bit sRGB;
  - alpha i drejtë (jo i paraprakisht shumëzuar) në PNG/WebP lossless.
- **Rezolucioni:**
  - Full body: 4500 px lartësi, koka rreth 600 px. Jep LOD `medium` dhe `wide`.
  - Koka për plan afër: 2000 px lartësi koke. Jep LOD `close`, vetëm për shtresat e kokës dhe të qafës.
  - Në 1080×1920, një plan afër e vendos kokën rreth 1000 px të lartë. Arti duhet të jetë 2 herë sa ekrani.
- **Nën-pikturimi:**
  - Çdo shtresë vazhdon 10–15% përtej skajit të dukshëm te nyjet, dhe nën shtresat që e mbulojnë.
  - Kështu deformimi nuk hap vrima. Linter-i e kontrollon.
- **Pa kontur të zi.** Vijat e pakta janë pjesë e pikturës së shtresës, që të deformohen me të.

### 5.3 Mesh-i

| Kërkesa           | Vlera **[S]**                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Dendësia          | Rreth 1 kulm çdo 12–20 px të artit `medium`; 2–3 herë më shumë rreth syve, gojës dhe nyjeve |
| Nyjet             | 3–5 unaza tehesh pingul me përkuljen; bërryli dhe gjuri me copë mbivendosjeje               |
| Fytyra            | Kulmet ndjekin rrudhat e shprehjes: vija nazolabiale, cepat e syve, balli                   |
| Kufiri            | Mesh-i ndjek alpha-n me 2–4 px hapësirë; pa trekëndësha në zona plotësisht transparente     |
| Buxheti për pamje | Rreth 6 000–12 000 trekëndësha për trupin + kokën, i matur në B0                            |

### 5.4 Skeleti

- **Trupi:** root, pelvisi, shtylla (3), kraharori, klavikula majtas dhe djathtas, krahu, parakrahu (me një kockë rrotullimi), dora.
- **Gishtat:** 5 × 3 kocka për dorë.
- **Koka:** qafa (2), koka, nofulla, sytë.
- **Këmbët:** kofsha, këmba, shputa, gishtat e këmbës.
- **Flokët:** zinxhirë të shkurtër për masat.
- **Sockets:** kapja për çdo dorë (`grip`), maja e gishtit tregues (`point`), ijet (`seat`).
- **Contacts:** shputat dhe ijet.
- **Brenda kontratës aktuale:** deri në 256 kocka, 32 sockets dhe 32 contacts.

### 5.5 Rig-u i fytyrës

- **AU-të (18):** morph-e të përshtatura me vizatimet A4 (§4, C1). Asimetria e identitetit është në art, jo në kod.
- **Visemat (15 kanale):**
  - me zëvendësim të 10 vizatimeve të gojës (A5), të drejtuara me `opacity`;
  - plus morph-e të buzëve për kalimet mes tyre;
  - dhëmbët dhe gjuha janë pjesë e vizatimit të gojës.
- **Sytë:**
  - Irisi i pikturuar rrotullohet dhe ngjeshet sipas shikimit, i prerë nga sklera (shih K3).
  - Qepalla e sipërme ndjek shikimin vertikal (morph).
  - Hija e qepallës mbi sy pritet nga sklera (shih K1, K2).
  - Pulitja është e pavarur majtas dhe djathtas.
  - Shikimi drejt një pike 3D, prandaj sytë konvergojnë: ekziston dhe është testuar në Fazën 2.
- **Mjekra:** pjesa poshtë gojës lidhet me nofullën dhe zgjatet kur nofulla hapet.

### 5.6 Menaxhimi i pamjeve

- **Grupi `body`:** 8 pamje (0, ±45, ±90, ±135, 180).
- **Grupi `head`:** 0, ±30, ±60, ±90, ±135, 180. Morph-et e këndit mbulojnë ±15° brenda çdo pamjeje.
- **Pasqyrimi:**
  - Daniel është asimetrik (vetulla, vija e flokëve, ora), prandaj koka dhe flokët pikturohen për të dyja anët.
  - Trupi dhe veshja mund të pasqyrohen aty ku janë simetrike. Detajet asimetrike (ora, xhepi) janë shtresa të veçanta.
  - Pasqyrimi **nuk kërkon ndryshim kontrate:** Builder-i krijon pjesë me kulme të pasqyruara që përdorin të njëjtin imazh.
- **Kufijtë e pamjeve:**
  - Kalimi i tërthortë (cross-fade) mes dy pikturave krijon kontur të dyfishtë.
  - **[R]** Morph-et e këndit i afrojnë dy pamjet në kufi.
  - Artisti pikturon një vizatim kufitar ku duhet.
  - Brezi i kalimit ≤ 2° ose prerje e pastër gjatë një kthimi të shpejtë. Matet në C5.
- **Pamja nga pas:** kalon nga +180 në −180. Kjo kërkon K5 (§6).

### 5.7 Veshjet

- Çdo veshje është set shtresash për çdo pamje, me të njëjtin skelet dhe pesha të ngjashme me trupin.
- Fsheh pjesët e trupit që mbulon. Kjo ekziston në kontratë dhe është testuar.
- **Palosjet:**
  - Në nyje, si korrigjues ose shtresa palosjesh që shfaqen me përkuljen (opacity sipas kanalit të bërrylit).
  - Për pozat ekstreme, vizatime zëvendësuese.
- **Lëvizja dytësore** (xhaketa në ecje) **nuk ekziston**: Runtime-i nuk simulon. Do ta japë Character Acting si kanale, në fazë të mëvonshme.
- Fjalori i garderobës mbetet ai i W1, që zgjedhja e veshjes të funksionojë pa ndryshim.

### 5.8 Deformimi i teksturës

| Problemi                                         | Zgjidhja                                                                                                                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hija e pikturuar rrotullohet bashkë me gjymtyrën | Në gjymtyrë pikturohet forma dhe okluzioni me kontrast të butë. Hijet e forta të dritës janë në shtresa më vete. Për pozat e mëdha: vizatime zëvendësuese ose korrigjuese. |
| Tekstura zgjatet ose ngjeshet te nyjet           | Nën-pikturimi, unazat e teheve dhe korrigjueset; kufiri i zgjatjes kontrollohet në C5                                                                                      |
| Drita e skenës vjen nga ana tjetër               | Shtresat e hijes majtas dhe djathtas, të përziera nga kanali i dritës (K4). Pa K4: rregull skene që drita kryesore të jetë në anën e pikturuar                             |
| Vija ndryshon trashësi kur mesh-i zgjatet        | Vijat pak dhe të holla; kontrollohen në C5                                                                                                                                 |
| Skajet e trekëndëshave                           | Ekziston: çdo trekëndësh rritet 0.6 px. Në Fazën 2 nuk pati tegela të dukshme **[M]**                                                                                      |

### 5.9 Përputhshmëria me Runtime-in

| Nevoja                                                               | Runtime-i i Fazës 2 **[F]**                                                  | Çfarë duhet                                                                                                                                                  |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Pjesë me teksturë, skinning, morph-e, opacity, pamje, veshje, LOD    | Po, të testuara                                                              | —                                                                                                                                                            |
| Gishta, visema, pamje trupi                                          | Rruga e përgjithshme ekziston, e paushtruar mbi një karakter                 | Ushtrohen me Danielin                                                                                                                                        |
| Multiply/screen, prerje sipas pjese, iris i pikturuar, pamja nga pas | Jo                                                                           | K1–K5 (§6), revizioni 2 i Runtime-it                                                                                                                         |
| Ngarkimi i teksturave                                                | Të gjitha në fillim                                                          | **R1:** ngarkim sipas pamjes dhe LOD-it, vetëm kur duhen. Nuk prek kontratën                                                                                 |
| Performanca                                                          | Teksturë: 21.7 ms për bluzën në shkallën 1.9 **[M]**; kostoja ndjek pikselët | Një karakter i pikturuar plotësisht, me mbivendosje dhe shtresa multiply: rreth 50–120 ms për kuadër në këtë CPU **[S]**. **B0 e mat para artit me shtresa** |
| Memoria                                                              | 300 MB RSS e qëndrueshme me karakterin testues **[M]**                       | Arti i plotë: 100–300 MB tekstura të dekoduara për pamjet aktive **[S]**, prandaj R1                                                                         |
| Ruajtja                                                              | Git LFS, i bllokuar nga ky mjedis (Faza 2)                                   | Rreth 150–400 MB për karakter **[S]**: duhet zgjidhur LFS ose S3 para B1                                                                                     |

---

## 6. Ndryshimet e propozuara të kontratës

Të gjitha janë fusha opsionale. Paketat ekzistuese mbeten të vlefshme dhe kontrata mbetet `/1`. Një paketë që i përdor deklaron `minRuntime: 2`.

**Asnjë nuk implementohet para:**

- miratimit tënd;
- provës B0, e cila mat edhe koston e tyre.

| #      | Ndryshimi                                                                              | Arsyeja                                                                                                                                                 | Ndikimi                                                                                                                                                      | Alternativa pa ndryshim                                                                           |
| ------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| **K1** | `blend` për çdo pjesë: `normal` (parazgjedhja), `multiply`, `screen`                   | Okluzioni, hijet që lëvizin (nofulla mbi qafë, jaka, flokët mbi ballë) dhe dritat e buta duhet të jenë shtresa të veçanta dhe të përzihen si në pikturë | Runtime: një `globalCompositeOperation` për pjesë, kosto e vogël **[S]**. Validimi: vlerat e lejuara                                                         | Hija pikturohet brenda teksturës: nuk lëviz me nofullën dhe me dritën                             |
| **K2** | `clipTo: <pjesa>`, plus `outline` opsional (poligon kulmesh) për pjesët me teksturë    | Hija e qepallës mbi sy, brendësia e gojës brenda buzëve, hija e flokëve vetëm mbi lëkurë. Iris-i e bën këtë sot vetëm si rast i veçantë                 | Prerja me konturin e kulmeve është e lirë (`clip()` me path). Prerja me alpha të teksturës do të kërkonte shtresë jashtë ekranit, prandaj **nuk e propozoj** | Zëvendësim i plotë i vizatimeve: shumë më tepër art, më pak lëvizje                               |
| **K3** | `iris.image` (teksturë) opsional te sytë                                               | "Iris me strukturë dhe ngjyrë": sot irisi është rreth me ngjyrë dhe unazë                                                                               | Runtime: vizaton imazhin me të njëjtin rrotullim, ngjeshje dhe prerje                                                                                        | Iris vektorial me gradient, nën standard                                                          |
| **K4** | Kanal humanoid `light_key_x` (−1 majtas … +1 djathtas)                                 | "Drejtim i qëndrueshëm i hijeve" me dritën e skenës: shtresat e hijes majtas dhe djathtas përzihen me `opacity`                                         | Profili `erkasa.humanoid/1` merr një emër të ri. Engine-t e drejtojnë nga dritat e skenës në Fazën 5; deri atëherë vlera fikse                               | Rregull skene: drita kryesore gjithmonë në anën e pikturuar. Kufizon Kamerën dhe World Builder-in |
| **K5** | `wrap: true` te grupi i pamjeve: këndi është rrethor dhe një pamje mund të kalojë 180° | Pamja nga pas në turnaround. Sot validimi (`VIEW_TILING`, `VIEW_PART_TWICE`) nuk lejon një pamje në të dy skajet                                        | Validimi dhe zgjedhja e pamjes në Runtime                                                                                                                    | Dy pamje nga pas me pjesë të dyfishuara që ndajnë të njëjtin imazh                                |

**Pa ndryshim kontrate:**

- **R1:** ngarkimi sipas pamjes dhe LOD-it (Runtime).
- Pasqyrimi (Builder).
- Zëvendësimi i vizatimeve (`opacity` ekzistues).
- Dhëmbët dhe gjuha (pjesë të zakonshme).

**Nuk e propozoj tani:**

- **Kanalet standarde për pozat e dorës.** I shtoj vetëm nëse testi i deformimit (C5) tregon që gishtat me segmente nuk mjaftojnë.
- **Simulimi i rrobave dhe flokëve.**

---

## 7. Rreziqet dhe kufizimet

1. **Gjetja e artistit është rreziku kryesor.**
   - Duhet portofol me pikturë njerëzore kinematografike, jo vetëm ilustrim statik, dhe aftësi për turnaround.
   - **[R]** Një provë e paguar para kontratës: portreti A1.
2. **Kosto dhe kohë.** Pa kuota nuk jap çmime.
   - Porta A: 3–5 javë **[S]**.
   - Slice 1 i shtresave: 3–4 javë **[S]**.
   - Pamjet e tjera: 3–5 javë **[S]**.
   - Rig-u im për slice 1: 2–3 javë pas artit **[S]**.
3. **Performanca.** Arti i pikturuar mund të kalojë buxhetin e kuadrit. B0 e mat **para** se të paguhet arti me shtresa. Nëse nuk mjafton:
   - cache e shtresave statike;
   - LOD më agresiv;
   - ose vendimi për GPU, me benchmark (MA-D3).
4. **Kalimet mes pamjeve dhe hijet që rrotullohen** janë kufizimet e njohura të rig-ut 2D me pikturë. Zgjidhen me art plotësues (vizatime kufitare dhe zëvendësuese), jo me kod. Kjo e rrit sasinë e artit.
5. **Ruajtja.** LFS bllokohet nga ky mjedis. Me qindra MB për karakter, duhet zgjidhur para B1.
6. **Të drejtat.** Kontrata me artistin duhet të kalojë të gjitha të drejtat te Erkasa, përfshirë burimet PSD/KRA dhe përdorimin për trajnimin e modelit tonë (rruga B). Kjo kërkon këshillë ligjore; unë nuk jam jurist.
7. **Karakteri femër:** i njëjti artist dhe e njëjta style bible, pasi Daniel të kalojë Portën C.

---

## 8. Plani në porta

| Porta                         | Përmbajtja                                                                                      | Miratimi                 |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------ |
| **0. Vendimet**               | Vendimet e §9 dhe gjetja e artistit                                                             | Ti                       |
| **A. Arti dhe model sheet-i** | Style frames → A1 → A2 → A3 → A4–A7 → A8 (konsistenca). Unë: brief-i i ri, guidat 3D, kontrolli | Ti, për çdo hap          |
| **B. Teknika dhe shtresat**   | B0 (performanca, para artit me shtresa) → B1 slice 1 → B2–B5                                    | Ti: B0 dhe shtresat      |
| **C. Rig-u dhe deformimi**    | C1–C6 për slice 1 → video e testeve krah për krah me vizatimet                                  | Ti: Daniel@1 për prodhim |
| **D. Pamjet e tjera**         | Profilet, 3/4 majtas, nga pas, veshjet e tjera                                                  | Ti                       |
| **E. Integrimi**              | Faza 5 e Character System V1: paketa e render-it, Character Acting                              | Ti                       |

**Pas miratimit të këtij propozimi**, punët e mia të para janë:

- brief-i i ri për artistin, në anglisht, sipas këtij dokumenti: style bible, identiteti, model sheet-i, specifikimi i shtresave, kontrata e të drejtave për t'u verifikuar;
- shabllonet e fletëve me landmarks.

Asgjë tjetër.

---

## 9. Vendimet që duhen nga ti

1. **Kush e pikturon artin?**
   - **[R]** A: ilustrues profesional.
   - B: AI, vetëm pas G1 dhe benchmark-ut.
   - C: unë me kod, nën standard.
2. **Kush e bën rig-un?**
   - **[R]** Unë, në Builder-in tonë, me vizatimet e artistit si referencë.
   - Ose artisti në Spine, me importin tonë; licenca duhet verifikuar.
3. **Identiteti i Danielit (§3.2):** miraton përshkrimin, gri në tëmtha, profesionin dhe veshjen e parë? Ndrysho çfarë të duash.
4. **Pamjet:**
   - 8 pamje trupi dhe 10 pamje koke;
   - pa pasqyrim për kokën dhe flokët;
   - slice 1: vetëm 3/4 djathtas dhe front.
5. **Drita:** shtresat e hijes sipas anës (K4) apo rregull skene me dritën në anën e pikturuar?
6. **Ndryshimet e kontratës K1–K5:** i miraton në parim? Implementohen vetëm pas B0 dhe me miratimin tënd për secilën.

Vendimet e Fazës 2 mbeten të hapura: LFS/S3 dhe rrjedhja e memories në W0. Vendimi për ruajtjen bëhet i nevojshëm para B1.

**Ndalem këtu.** Nuk kam vizatuar, rig-uar apo ndryshuar asgjë në kod a kontratë.

---

Burimet: licenca e output-it të MakeHuman/MPFB (CC0): https://static.makehumancommunity.org/oldsite/faq/can_i_sell_models_created_with_makehuman.html
