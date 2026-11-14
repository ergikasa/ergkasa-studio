# Benchmark-u i Erkasa-s

Progresi matet me videon finale, jo me kod. Çdo version i studios i prodhon të njëjtat 5 video, i matim
me të njëjtat rregulla dhe i krahasojmë me versionin e mëparshëm dhe me videot e referencës.

**Rregull:** asnjë merge në `main` pa videot e benchmark-ut të versionit të ri, matjet automatike dhe fletën e
vlerësimit. Asnjë fushë nuk lejohet të bjerë.

## 1. Inputet e ngrira

`benchmark/scripts/` ka 5 skenarë që nuk ndryshojnë. Secili teston një lloj filmi:

| Skenari               | Çfarë teston                                                            |
| --------------------- | ----------------------------------------------------------------------- |
| `b1-why-we-stay`      | Një person dhe objekte: aktrim, shikim, ulje/ngritje, metaforë si skenë |
| `b2-same-answers`     | Dy njerëz në një situatë: ndërveprim, reagime, dorëzim, shot/reverse    |
| `b3-every-yes`        | Koncept abstrakt pa protagonist: motion design editorial, tipografi     |
| `b4-one-percent`      | Numra dhe krahasim: vizualizim të dhënash                               |
| `b5-planning-fallacy` | Koha që kalon dhe vazhdimësia: i njëjti vend në javë të ndryshme        |

Zëri i secilit gjenerohet **një herë** dhe ruhet. Të gjitha versionet përdorin të njëjtin zë, që krahasimi të jetë vetëm për pamjen.

## 2. Matjet automatike

```bash
pnpm bench video1.mp4 video2.mp4                       # matjet në terminal
pnpm bench out/*.mp4 --json benchmark/results/<data>.json
pnpm bench video.mp4 --ignore-band 0.62:0.82           # fsheh brezin e titrave që ndryshojnë çdo fjalë
```

Mjeti (`tools/benchmark/measure.py`) lexon vetëm pikselat e MP4. Prandaj vlen njësoj për Erkasa-n, previz-in dhe
referencat. Mat:

- **kohën e vdekur:** pjesët ≥2 s ku asgjë nuk lëviz;
- **sa sekonda kanë ndryshim;**
- **numrin e kuadrove dhe gjatësinë e tyre.** Prerjet, whip-et dhe slide-t gjenden; fade-t e ngadalta jo.

Matjet e para (14 nëntor 2026):

| Video                                 | Kohëzgjatja | Kuadro | Mediana e kuadrit | Kohë e vdekur | Sekonda me ndryshim |
| ------------------------------------- | ----------- | ------ | ----------------- | ------------- | ------------------- |
| Why We Stay, motori aktual            | 66.8 s      | 8      | 7.7 s             | 26.6 s (40%)  | 67%                 |
| Why We Stay, previz i drejtimit të ri | 36.7 s      | 6      | 6.8 s             | 0 s (0%)      | 97%                 |

Previz-i e zhduk kohën e vdekur, por kuadrot e tij janë ende të gjata për standardin (synimi 2–4 s).

## 3. Vlerësimi njerëzor

Çdo video vlerësohet nga 3+ vlerësues, pa ditur cili version është. Videot e referencës (3–5 explainer
profesionalë në 9:16) përzihen me tonat. Përdoren vetëm brenda ekipit për krahasim, kurrë nuk publikohen.

Nota 1–5 për secilën fushë, në `benchmark/scores.csv`:

| Fusha                          | 5 =                                                                      | 1 =                             |
| ------------------------------ | ------------------------------------------------------------------------ | ------------------------------- |
| **Aktrimi**                    | Gjendja e personazhit kuptohet nga trupi; shikon diçka me qëllim; reagon | Kukull që lëviz krahët          |
| **Lëvizja**                    | Peshë, anticipation, mbajtje; asgjë nuk rrëshqet                         | Mekanike, lineare, rrëshqitëse  |
| **Kompozimi**                  | Syri shkon aty ku duhet; asgjë nuk mbulon fytyrën                        | Elementë të vendosur rastësisht |
| **Storytelling (testi pa zë)** | E kupton historinë pa zë                                                 | Pa zë nuk kuptohet asgjë        |
| **Koherenca vizuale**          | Një vepër me një stil                                                    | Copa nga stile të ndryshme      |
| **Kinematografia**             | Çdo kuadër dhe lëvizje kamere ka arsye                                   | Zoom dhe prerje pa motiv        |
| **Ritmi**                      | Ndjek kuptimin; asnjë kohë e vdekur                                      | Monoton ose i ngadaltë          |
| **Sinkronizimi**               | Pamja dhe zëri godasin bashkë                                            | Ngjarjet vijnë vonë ose herët   |

Plus dy pyetje po/jo: "Do ta publikoja pa ndryshime?" dhe "Duket e prodhuar nga një studio?".

**Testi pa zë:** vlerësuesi e sheh videon pa zë dhe shkruan në një fjali çfarë ndodh në çdo pjesë. Pastaj krahasohet me momentet e skenarit. Përqindja e momenteve të kuptuara shkon te kolona `mute_understood_pct`.

**Pragu për produkt:** mesatarja ≥4 në çdo fushë dhe ≥80% "do ta publikoja".

## 4. Si bëhet një raund

1. Prodho 5 videot nga skenarët e ngrirë me versionin e ri.
2. `pnpm bench … --json benchmark/results/<data>-<version>.json`.
3. Përziej me referencat dhe versionin e mëparshëm, riemërtoji pa shenja, jepua vlerësuesve.
4. Plotëso `scores.csv`.
5. Krahaso me raundin e kaluar. Merge vetëm nëse asnjë fushë nuk bie.
