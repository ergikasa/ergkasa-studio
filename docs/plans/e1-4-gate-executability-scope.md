# E1.4 · Gate PASS ⟹ Renderer-i ekzekuton: scope minimal (v2)

|            |                                                                                                                                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Statusi    | **Propozim. Pret miratimin e PO-së. Asgjë nuk implementohet pa miratim.**                                                                                                                                                                                                                                 |
| Zëvendëson | propozimin e parë në këtë skedar (`7a5d8d9`)                                                                                                                                                                                                                                                              |
| Branch     | `e1-4-engine-reads-package` (pa merge në `main`)                                                                                                                                                                                                                                                          |
| Burimet    | `film/test/package/gate-audit.ts` (16 rastet); kodi i renderer-it (`film/src/package/`, `v2frame.ts`, `w0/compositor.ts`); skemat JSON `contracts/json-schema/render-package.schema.json` (180 fusha fundore) dhe `asset-manifest.schema.json` (63); matjet e tetë paketave ekzistuese (§C.3), 2026-11-17 |

**Parimi.** Nëse Gate-i e pranon paketën, renderer-i e ekzekuton atë sipas semantikës së saj në çdo kuadër. Nuk pranohet që Gate-i të miratojë një paketë dhe renderer-i më pas të dështojë, ose të injorojë një fushë.

**Kufijtë.**

- Brenda E1.4 nuk zgjerohet renderer-i dhe nuk preken skemat e paketës dhe të manifestit.
- Nuk preken golden-at dhe baseline-t, pipeline-i default dhe `main`.
- Boshllëku mbyllet vetëm nga Gate-i, mbi deklaratën e aftësive të Engine-it, e cila përshkruan kodin ekzistues.
- "Renderer-i duhet ta mbështesë" del vetëm si kandidat për E1.5.

**Korrigjim i numërimit.** 16 rastet e skriptit të auditimit ndahen kështu:

- **11 pranohen nga Gate-i:** 10 dështojnë gjatë renderimit dhe 1 renderohet gabim (R15, captions `align: "left"` në qendër).
- **5 refuzohen saktë.**

Raporti i E1.4 shkruante "10 pranohen, 6 refuzohen". I gjashti i refuzuar ishte një variant i parë i R7, që nuk është në skript; raporti korrigjohet në të njëjtin commit dokumentimi.

---

## A. Analiza e 16 rasteve

Kategoritë e klasifikimit:

- **GR** (Gate refuzon): renderer-i nuk e vizaton.
- **KK** (kufizim i shprehur në kontratë): `capabilities` deklaron atë që Engine-i vizaton, dhe Gate-i refuzon gjithçka jashtë tij.
- **RM** (renderer mbështet): kandidat për E1.5, jo në E1.4.

Në E1.4 çdo rast i pambështetur është **GR mbi KK**: kufizimi deklarohet në `capabilities` dhe Gate-i e zbaton. Kodet dhe shtigjet janë JSON Pointer brenda skedarit (`package` ose `manifest`). `{x}` është indeksi i gjetur nga testi.

| #   | Rasti (gate-audit.ts)                                                                 | Sot: Gate · Renderer                                                                             | Klasifikimi E1.4 | Rregulli                                                                                                                                                                                   | Kodi · shtegu                                                                                                                                                                                                                                                                                                       | Testi negativ                                                                                                                                                                                   | E1.5                                                 |
| --- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| R1  | Gjendje aseti si element i skedarit kryesor (`element: "seat"`, që as nuk ekziston)   | pranon · dështon (`state 'default' is an element…`)                                              | GR + KK          | çdo gjendje ka `source`, sepse `assets.stateSources` = `["source"]`                                                                                                                        | `CAPABILITY_MISSING` · `manifest:/assets/{chair}/states/0/element`                                                                                                                                                                                                                                                  | N1: rasti R1 si është                                                                                                                                                                           | RM: gjendjet-element, me kontroll të id-së në SVG    |
| R2  | Nyje jo-W0 në skenë `parallax` (B3, `s02_sh02`)                                       | pranon · dështon (`'set.room.back' is not drawn in a parallax scene`)                            | GR + KK          | builtin-i ose skedari i çdo nyjeje ∈ `projections[p].layers` / `.screen`; rolet e `requires` janë të pranishme; vetitë e kamerës, shtresave dhe aktorëve sipas projeksionit                | kryesorja: `CAPABILITY_MISSING` · `package:/scenes/1/layers/{j}/nodes/{k}/asset` dhe `…/screen/{j}/nodes/{k}/asset`; plus `ROLE_MISSING` · `package:/scenes/1/layers` (një për rol) dhe `VALUE_UNSUPPORTED` për `camera/referenceDistance`, `camera/dolly`, `actors/{j}/rim`, `actors/{j}/shadow`, `layers/{j}/lit` | N2a: rasti R2, lista e plotë e gjetjeve e ngrirë në test. N2b (një defekt): W0 me një nyje `set.*.back` në shtresën `mid` → vetëm `CAPABILITY_MISSING` te ajo nyje                              | RM: nyje të përgjithshme në parallax                 |
| R3  | Tranzicion flat → parallax me `dissolve` (B3, `edit/1`)                               | pranon · dështon (`a parallax scene enters only by cut or dissolve from another parallax scene`) | GR + KK          | (`enter.kind`, projeksioni i prerjes para, projeksioni i kësaj) ∈ `transitions`                                                                                                            | `CAPABILITY_MISSING` · `package:/edit/1/enter/kind`, plus gjetjet e R2 për `s02_sh02`                                                                                                                                                                                                                               | N3a: rasti R3. N3b (një defekt): paketë me një skenë flat të vlefshme (office-clock) dhe një skenë W0 të vlefshme, me `dissolve` midis tyre → vetëm `CAPABILITY_MISSING` · `/edit/1/enter/kind` | RM: tranzicione të përziera                          |
| R4  | `whip` në parallax (W0, `s12_sh12`)                                                   | pranon · dështon (i njëjti gabim si R3)                                                          | GR + KK          | si R3: `whip` vetëm flat → flat                                                                                                                                                            | `CAPABILITY_MISSING` · `package:/edit/{s12}/enter/kind`                                                                                                                                                                                                                                                             | N4: rasti R4 (një defekt)                                                                                                                                                                       | RM: `whip` në parallax                               |
| R5  | "parallax → flat": skena 2 e W0 me `projection: "flat"`                               | pranon · dështon (`'w0.sky' is not drawn in a flat scene`)                                       | GR + KK          | **Shënim:** skena 2 hyn me `cut`, i lejuar në çdo kombinim, kështu që rasti nuk teston tranzicionin. Teston builtin-et `w0.*` në flat, njësoj si R6. Rregullat e R2 për projeksionin flat. | `CAPABILITY_MISSING` · `package:/scenes/1/layers/{j}/nodes/{k}/asset` (çdo `w0.*`), `…/screen/0/nodes/{k}/asset` (`type.w0`); `VALUE_UNSUPPORTED` · `…/layers/{j}/blur`, `…/layers/{j}/lit`, `…/actors/{j}/rim`, `…/actors/{j}/shadow`                                                                              | N5a: rasti R5. N5b (tranzicioni i vërtetë parallax → flat): skenë W0 e vlefshme + skenë flat e vlefshme me `dissolve` → vetëm `CAPABILITY_MISSING` · `/edit/1/enter/kind`                       | RM: si R3                                            |
| R6  | Builtin i W0 në skenë flat (W0, skena 1 me `projection: "flat"`)                      | pranon · dështon (`'w0.sky' is not drawn in a flat scene`)                                       | GR + KK          | si R5                                                                                                                                                                                      | si R5, për `scenes/0`                                                                                                                                                                                                                                                                                               | N6: rasti R6                                                                                                                                                                                    | RM: jo e nevojshme (W0 është parallax me përkufizim) |
| R7  | Skenë parallax pa shtresën `mid` të W0 (nyjet, track-et dhe event-et e saj të hequra) | pranon · dështon (`a parallax scene needs W0's mid layer`)                                       | GR + KK          | çdo rol i `projections.parallax.requires` ndodhet saktësisht një herë në skenë                                                                                                             | `ROLE_MISSING` · `package:/scenes/0/layers` (mesazhi: `w0.mid`); rol i dyfishtë: `ID_DUPLICATE` · nyja e dytë                                                                                                                                                                                                       | N7: rasti R7 (një defekt); N7b: dy nyje `w0.sky` → `ID_DUPLICATE`                                                                                                                               | —                                                    |
| R8  | Parametër-kanal pa track (`set_back` `param.t`)                                       | pranon · dështon (`0 tracks for node:set_back:param.t`)                                          | GR               | çdo parametër `channel` i builtin-it ka track për nyjen; kjo del nga deklaratat ekzistuese, pa ndryshim në `capabilities`                                                                  | `TRACK_MISSING` · `package:/scenes/1/layers/{j}/nodes/{k}` (mesazhi: `param.t`)                                                                                                                                                                                                                                     | N8: rasti R8 (një defekt)                                                                                                                                                                       | —                                                    |
| R9  | Kamera pa track `height`                                                              | pranon · dështon (`0 tracks for camera::height`)                                                 | GR + KK          | `x`, `y`, `height` të kamerës kanë track                                                                                                                                                   | `TRACK_MISSING` · `package:/scenes/1/camera` (mesazhi: `height`)                                                                                                                                                                                                                                                    | N9: rasti R9 (një defekt)                                                                                                                                                                       | —                                                    |
| R10 | Pivot që aseti nuk e ka                                                               | **refuzon** (`PIVOT_UNDECLARED` · `package:/scenes/1/layers/0/nodes/3/pivot`)                    | pa ndryshim      | ekziston                                                                                                                                                                                   | ekziston                                                                                                                                                                                                                                                                                                            | N10: rasti R10 si regresion                                                                                                                                                                     | —                                                    |
| R11 | Gjendje që aseti nuk e ka                                                             | **refuzon** (`STATE_UNDECLARED` · `…/nodes/3/state`)                                             | pa ndryshim      | ekziston                                                                                                                                                                                   | ekziston                                                                                                                                                                                                                                                                                                            | N11                                                                                                                                                                                             | —                                                    |
| R12 | Edit me skenë që nuk ekziston                                                         | **refuzon** (`EDIT_SCENE` · `package:/edit/0/scene`)                                             | pa ndryshim      | ekziston                                                                                                                                                                                   | ekziston                                                                                                                                                                                                                                                                                                            | N12                                                                                                                                                                                             | —                                                    |
| R13 | Font i captions që nuk është font                                                     | **refuzon** (`ASSET_KIND` · `package:/overlays/0/style/font`)                                    | pa ndryshim      | ekziston                                                                                                                                                                                   | ekziston                                                                                                                                                                                                                                                                                                            | N13                                                                                                                                                                                             | —                                                    |
| R14 | Rig me burim skedar                                                                   | pranon · dështon (`rig_cutout_man@1 is not a builtin rig`)                                       | GR + KK          | burimi i rig-ut ∈ `assets.rigSources` (`["builtin"]`)                                                                                                                                      | `RIG_UNSUPPORTED` · `manifest:/assets/{rig}/source/kind`                                                                                                                                                                                                                                                            | N14: rasti R14 (një defekt)                                                                                                                                                                     | RM: rig-e nga skedari                                |
| R15 | Captions me `align: "left"` (W0)                                                      | pranon · **renderon gabim** (në qendër, pa gabim)                                                | GR + KK          | `style.align` ∈ `captions.align` (`["center"]`)                                                                                                                                            | `VALUE_UNSUPPORTED` · `package:/overlays/0/style/align`                                                                                                                                                                                                                                                             | N15: rasti R15 (një defekt)                                                                                                                                                                     | RM: `align`, `maxWidth`                              |
| R16 | Nyje `type.kinetic` pa parametrin `lines`                                             | **refuzon** (`PARAM_MISSING` · `package:/scenes/1/screen/0/nodes/1/params`)                      | pa ndryshim      | ekziston                                                                                                                                                                                   | ekziston                                                                                                                                                                                                                                                                                                            | N16                                                                                                                                                                                             | —                                                    |

**Përmbledhje:**

- 11 raste mbyllen nga Gate-i: 10 me `capabilities` v2 dhe 1 (R8) nga deklaratat ekzistuese.
- 5 raste mbeten të refuzuara si sot dhe hyjnë në K5 si regresion.
- Asnjë rast nuk zgjidhet duke zgjeruar renderer-in në E1.4.

### A.2 Gjetje shtesë: matrica e fushave

Pika 5 kërkon garanci që Gate-i nuk pranon semantikë që renderer-i e injoron. 16 rastet janë një mostër, jo garanci. Ndaj i kalova të 243 fushat fundore të dy skemave kundrejt kodit të renderer-it (§B.4). Matrica gjeti **9 boshllëqe të tjera të të njëjtit lloj**. Asnjë nuk përdoret nga tetë paketat ekzistuese.

| #   | Fusha                                                                          | Çfarë bën renderer-i sot                                                                                                             | Rregulli (GR + KK)                                                                            | Kodi · shtegu                                                                                                               |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| X1  | `audio[]` (dhe `mix`)                                                          | e injoron; video del pa zë                                                                                                           | `audio` bosh, sepse `output.audio` = false; `mix` pa efekt kur `audio` është bosh             | `CAPABILITY_MISSING` · `package:/audio/{i}`                                                                                 |
| X2  | `scenes[].events[].state` (ndërrim gjendjeje)                                  | e injoron; vizaton gjendjen statike të nyjes                                                                                         | event-et nuk ndërrojnë gjendje: `events.state` = false                                        | `CAPABILITY_MISSING` · `package:/scenes/{i}/events/{k}/state`                                                               |
| X3  | `scenes[].contacts[]` (aktori mban nyjen në një socket)                        | i injoron                                                                                                                            | `contacts` bosh: `contacts` = false (objektet në dorë vizatohen nga builtin-i `prop.*.held`)  | `CAPABILITY_MISSING` · `package:/scenes/{i}/contacts/{k}`                                                                   |
| X4  | `events[].duration` kur `fx` = `none`                                          | pa efekt (fx `none` është i menjëhershëm)                                                                                            | `duration` = 0 kur `fx` = `none`                                                              | `VALUE_UNSUPPORTED` · `package:/scenes/{i}/events/{k}/duration`                                                             |
| X5  | `actors[].rim`, `shadow`                                                       | flat: i injoron (kurrë pa rim/hije); parallax: i vizaton gjithmonë                                                                   | flat: `false`; parallax: `true`                                                               | `VALUE_UNSUPPORTED` · `package:/scenes/{i}/actors/{j}/rim` (`…/shadow`)                                                     |
| X6  | `overlays[].at` si `{ node                                                     | actor, offset }` (captions që ndjekin diçka)                                                                                         | lexon vetëm `at.x`/`at.y`, pra pozicion `NaN`                                                 | captions vetëm me `{ x, y }`: `captions.anchor` = `["screen"]`                                                              | `CAPABILITY_MISSING` · `package:/overlays/{i}/at` |
| X7  | `overlays[].style.maxWidth`                                                    | e injoron                                                                                                                            | mungon, sepse `captions.maxWidth` = false                                                     | `VALUE_UNSUPPORTED` · `package:/overlays/{i}/style/maxWidth`                                                                |
| X8  | `output.width`, `output.height`                                                | vizaton gjithmonë 1080 × 1920 (konstantet `W`, `H`), por i jep sink-ut madhësinë e paketës: video e korruptuar në çdo madhësi tjetër | `width` × `height` ∈ `output.sizes` (`[[1080, 1920]]`)                                        | `VALUE_UNSUPPORTED` · `package:/output/width` (`…/height`)                                                                  |
| X9  | Fonti i captions: burim skedar, ose `family`/`weight` që nuk janë të Engine-it | vizaton gjithmonë me Montserrat-in e Engine-it                                                                                       | burimi ∈ `assets.fontSources` (`["builtin"]`); `family`/`weight` e asetit = ato të builtin-it | `CAPABILITY_MISSING` · `manifest:/assets/{f}/source/kind`; `VALUE_UNSUPPORTED` · `manifest:/assets/{f}/family` (`…/weight`) |

Boshllëqet nga propozimi i parë që nuk dolën si raste të skriptit mbeten në scope:

| #   | Fusha                                                                                                                                              | Rregulli                                                                                                                          | Kodi · shtegu                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Y1  | `layers[].blur` në flat                                                                                                                            | 0                                                                                                                                 | `VALUE_UNSUPPORTED` · `package:/scenes/{i}/layers/{j}/blur`                |
| Y2  | Blur-i i shtresave në parallax (kompozitori lexon blur-in e `sky` për `city`/`city_near`, dhe të aktorit të parë për të gjithë aktorët dhe `held`) | blur-i sipas tabelës së roleve (`same-as`)                                                                                        | `VALUE_UNSUPPORTED` · `…/layers/{j}/blur`                                  |
| Y3  | `layers[].lit`                                                                                                                                     | flat: `false` (pa drita); parallax: sipas rolit (`sky`, `city`, `city_near`: false; `wall`, `mid`, aktorët, `held`, `near`: true) | `VALUE_UNSUPPORTED` · `…/layers/{j}/lit`                                   |
| Y4  | `camera.aperture`                                                                                                                                  | ∈ `[0]`                                                                                                                           | `VALUE_UNSUPPORTED` · `package:/scenes/{i}/camera/aperture`                |
| Y5  | `camera.referenceDistance`, `dolly` në parallax                                                                                                    | ∈ `[2140]`, `[0.55]` (konstantet e `w0/camera.ts`); në flat: pa efekt me përkufizim                                               | `VALUE_UNSUPPORTED` · `…/camera/referenceDistance` (`…/dolly`)             |
| Y6  | Renditja e aktorëve sipas `y` midis nyjeve                                                                                                         | shtresa e një aktori ka vetëm atë aktor dhe asnjë nyje                                                                            | `VALUE_UNSUPPORTED` · `package:/scenes/{i}/actors/{j}/layer`               |
| Y7  | Vendosja e nyjeve builtin (`x`, `y`, `scale`, `rotation`, `opacity`, `flip`, `pivot`)                                                              | fushat jashtë `builtins[].placement` (props: `["x","y"]`; të tjerët: `[]`) janë identitet (`pivot` null) dhe pa track             | `VALUE_UNSUPPORTED` · `…/nodes/{k}/<fusha>`; track: `…/tracks/{t}/channel` |

---

## B. Ndryshimet e propozuara

### B.1 Engine capabilities v2 (`erkasa.capabilities/2`)

Forma më poshtë është vetëm për qartësi; nuk është kod. Fushat ekzistuese mbeten: `lightKinds`, `fx`, `nodeKinds`, `overlayKinds`, `rigFormats`, `builtins`.

```ts
interface RenderCapabilities {
  contract: "erkasa.render/1";
  lightKinds;
  fx;
  nodeKinds;
  overlayKinds;
  rigFormats; // pa ndryshim
  builtins: BuiltinCapability[]; // + placement, rig.rest, font

  output: { sizes: Array<[number, number]>; fps: number[]; audio: boolean }; // [[1080,1920]], [30], false

  /** projeksion × shtresë × builtin: çfarë vizatohet ku, dhe çfarë kërkohet */
  projections: Record<
    "flat" | "parallax",
    {
      layers: { builtins: string[]; files: boolean }; // flat: set.*, prop.*, template.* + skedarë; parallax: w0.*, prop.*
      screen: { builtins: string[]; files: boolean }; // flat: type.kinetic, overlay.scrim, overlay.ots; parallax: type.w0
      requires: Array<{ role: string; builtin: string; params?: object }>; // parallax: sky, city, city_near, wall, mid
      camera: {
        channels: string[]; // ["x","y","height"]
        aperture: number[]; // [0]
        referenceDistance: number[] | "unused"; // parallax [2140]; flat "unused"
        dolly: number[] | "unused"; // parallax [0.55]; flat "unused"
      };
      layer: {
        blur: "zero" | "by-role";
        lit: boolean | "by-role";
        roles?: Record<string, { blur: "own" | `same-as:${string}`; lit: boolean }>;
      };
      actors: { layer: "own"; rim: boolean; shadow: boolean }; // flat: false/false; parallax: true/true
    }
  >;

  /** tranzicion × projeksioni para × projeksioni pas */
  transitions: Array<{ kind: "cut" | "dissolve" | "whip"; from: string; to: string }>;
  // cut: të gjitha çiftet; dissolve: flat→flat, parallax→parallax; whip: flat→flat

  events: { state: boolean; durationWithoutFx: 0 }; // state: false
  contacts: boolean; // false

  assets: { stateSources: ["source"]; rigSources: ["builtin"]; fontSources: ["builtin"] };

  captions: {
    anchor: ["screen"];
    align: ["center"];
    maxWidth: false;
    semantics: { fadeIn: 0.12; unspokenOpacity: 0.6; strokeOpacity: 0.9; overVignette: true }; // deklaratë
  };

  /** si e trajton Engine-i çdo fushë të skemave (§B.4); i plotë për skemat aktuale */
  fields: Record<
    string /* JSON Pointer me * */,
    "applied" | "restricted" | "refused" | "validated" | "metadata" | "unused"
  >;
}

interface BuiltinCapability {
  // ekzistuese + :
  placement: Array<"x" | "y" | "scale" | "rotation" | "opacity" | "flip" | "pivot">;
  rig?: { /* ekzistuese */ rest: Record<string, number> }; // STANDING, glow 0; root.x 0, root.y 0, root.scale 1, facing 1, turn 1
  font?: { family: string; weight: number }; // font.montserrat-800: Montserrat 800
}
```

### B.2 Kanalet dhe track-et e detyrueshme (nga kodi i renderer-it)

| Tipi                                    | Kanale me track të detyrueshëm                            | Statikë (ekziston `PARAM_MISSING`) |
| --------------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| Kamera                                  | `x`, `y`, `height`                                        | —                                  |
| `set.*.back` / `set.*.front`            | `param.t`, `param.light`, `param.door`                    | —                                  |
| `prop.*.held`                           | `param.facing`, `param.rot`                               | —                                  |
| `prop.*.resting`                        | —                                                         | —                                  |
| `template.*`                            | `param.t`                                                 | `dur`, `params`, `anchors`         |
| `type.kinetic`                          | `param.t`                                                 | `lines`, `y`, `at`, `out`, `dark`  |
| `type.w0`                               | `param.t`                                                 | `lines`, `place`, `at`, `out`      |
| `overlay.scrim`                         | —                                                         | `place`                            |
| `overlay.ots`                           | `param.t`                                                 | `dur`, `facing`                    |
| `w0.sky` (gjendja e vendit)             | `param.t`, `light`, `door`, `lamp`, `clockMin`, `binders` | —                                  |
| `w0.city`                               | —                                                         | `seed`, `near`                     |
| `w0.wall`                               | —                                                         | `world`                            |
| Skedar SVG; vendosja e props (`x`, `y`) | track ose vlera e nyjes                                   | —                                  |
| Aktor                                   | asnjë: pa track, vlen `rig.rest` i publikuar              | —                                  |

Rregulli i përgjithshëm: çdo parametër `channel` i deklaruar nga builtin-i është i detyrueshëm. Sot asnjë builtin nuk ka kanal opsional. Nëse ndonjëherë do ketë, deklarata do t'i duhej një fushë `rest`.

### B.3 Rregullat e reja të Gate-it

| Grupi                                | Rregulli                                                                                                                                                 | Raste                     |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| G-P (projeksion × shtresë × builtin) | builtin-i ose skedari i nyjes ∈ listat e projeksionit; rolet e kërkuara saktësisht një herë; vetitë e kamerës, shtresave dhe aktorëve sipas projeksionit | R2, R5, R6, R7, X5, Y1–Y6 |
| G-T (tranzicion × projeksione)       | (`kind`, `from`, `to`) ∈ `transitions`                                                                                                                   | R3, R4, R5b               |
| G-K (track-e)                        | kanalet e detyrueshme të B.2                                                                                                                             | R8, R9                    |
| G-A (asete)                          | `stateSources`, `rigSources`, `fontSources`, font `family`/`weight`                                                                                      | R1, R14, X9               |
| G-C (captions)                       | `anchor`, `align`, `maxWidth`                                                                                                                            | R15, X6, X7               |
| G-B (vendosja e builtin-eve)         | `placement`                                                                                                                                              | Y7                        |
| G-E (event-e, contacts, dalja)       | `events.state`, `durationWithoutFx`, `contacts`, `output`                                                                                                | X1–X4, X8                 |

**Kodet.** Tre kode të reja të qëndrueshme:

- `VALUE_UNSUPPORTED`: fusha ekziston në kontratë, por kjo vlerë nuk zbatohet nga Engine-i.
- `TRACK_MISSING`: një kanal i detyrueshëm nuk ka track.
- `ROLE_MISSING`: mungon një rol i kërkuar nga projeksioni.

Përdoren edhe kodet ekzistuese `CAPABILITY_MISSING`, `RIG_UNSUPPORTED` dhe `ID_DUPLICATE`.

**Shtigjet.** Shtegu tregon fushën që shkakton problemin. Kur fusha mungon (track, rol), shtegu tregon objektin që duhej ta kishte, dhe mesazhi e emërton. Renditja totale e gjetjeve mbetet si sot.

### B.4 Garancia sistematike: matrica e fushave (pika 5)

Që Gate-i të mos pranojë semantikë që renderer-i injoron, jo vetëm për rastet e njohura:

1. `capabilities.fields` klasifikon **çdo fushë fundore** të `erkasa.render/1` dhe `erkasa.assets/1`:
   - `applied`: renderer-i e zbaton;
   - `restricted`: Gate-i lejon vetëm vlerat e deklaruara;
   - `refused`: duhet të mungojë ose të jetë bosh;
   - `validated`: Gate-i e kontrollon, por nuk ka efekt vizatimi (p.sh. `assetManifest.sha256`, `approval`);
   - `metadata`: pa semantikë vizatimi (p.sh. `producer`, `provenance`);
   - `unused`: pa efekt me përkufizim (p.sh. `depth` dhe `referenceDistance` në flat).
2. **Testi i plotësisë (T7):** lexon fushat fundore nga `contracts/json-schema/*.schema.json` dhe dështon nëse ndonjë fushë nuk ka klasifikim. Kështu një fushë e re në skemë nuk mund të kalojë në heshtje.
3. **Testi i zbatimit (T8):** për çdo fushë `restricted` ose `refused` ekziston të paktën një rast negativ me kodin dhe shtegun e saj.
4. Klasifikimi i propozuar, sipas grupeve (lista e plotë hyn në deklaratë):

| Klasa        | Fushat e paketës dhe të manifestit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `applied`    | `output.duration`, `edit/*` (përveç `enter.kind`: `restricted`), `scenes/*/background`, `camera.projection`, `layers/*/depth` (parallax), `nodes/*/asset`, `state`, `params`, vendosja e skedarëve (`x`, `y`, `scale`, `rotation`, `opacity`, `flip`, `pivot`), `actors/*/rig`, `appearance`, `events/*/t`, `node`, `visible`, `tracks/*` (gjithçka), `overlays/*` captions: `id`, `at.x`, `at.y`, `style.size`, `color`, `stroke`, `highlight`, `phrases`; manifesti: `source` (file/builtin), `states/*/name`, `states/*/source`, `geometry`, `pivots` |
| `restricted` | `output.width`, `height`, `fps`; `edit/*/enter/kind`; `camera.aperture`, `referenceDistance`, `dolly`; `layers/*/blur`, `lit`; `actors/*/layer`, `rim`, `shadow`; vendosja e builtin-eve; `events/*/fx`, `duration`; `overlays/*/kind`, `style.font`, `style.align`; manifesti: `source/kind` (rig, font), `family`, `weight`                                                                                                                                                                                                                            |
| `refused`    | `audio/*`; `scenes/*/lights/*`; `contacts/*`; `events/*/state`; nyjet `text`/`shape` (fushat e tyre); `overlays/*` jo-captions (`appear`, `asset`, `lines`, `panel`, `in`, `out`, `state`, `size`); `overlays/*/at/node`, `at/actor`, `at/offset`; `style.maxWidth`; manifesti: `states/*/element`                                                                                                                                                                                                                                                       |
| `validated`  | `schema`, `id`, `assetManifest/*`, `scenes/*/id`, `layers/*/id`, `screen/*/id`, `nodes/*/id`, `actors/*/id`, `nodes/*/kind`; manifesti: `id`, `version`, `kind`, `source/sha256`, `fingerprint`, `approval/*`, `bones/*`, `channels/*`, `sockets/*`, `slots`, `parameters/*`, `format`, `height`                                                                                                                                                                                                                                                         |
| `metadata`   | `producer/*`; manifesti: `license`, `provenance/*`, `style/*`, `affordances/*` (për Stager-in), `defaultState` (Engine-i përdor `node.state`)                                                                                                                                                                                                                                                                                                                                                                                                            |
| `unused`     | `mix/*` (pa efekt kur `audio` është bosh); `layers/*/depth` dhe `camera.referenceDistance`/`dolly` në flat; `scenes/*/bounds/*` (shih §F.5); manifesti: `durationSec`, `sampleRate` (asete audio, kur `audio` është bosh)                                                                                                                                                                                                                                                                                                                                |

---

## C. Ndikimi në kontrata dhe kompatibilitet

### C.1 Kontratat

| Kontrata                                                                                    | Ndikimi                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `erkasa.render/1` (paketa)                                                                  | **Asnjë ndryshim.** `contracts:gen --check` pa diff. Ndryshon vetëm cilat vlera pranon ky Engine.                                                                                                                                                                                                                                            |
| `erkasa.assets/1` (manifesti)                                                               | **Asnjë ndryshim.**                                                                                                                                                                                                                                                                                                                          |
| `RenderCapabilities` (`gate/src/capabilities.ts`, publikuar nga `film/src/capabilities.ts`) | **Ndryshim i madh: `/1 → /2`.** `projections` dhe `transitions` ndryshojnë formë; shtohen `output`, `events`, `contacts`, `assets`, `captions`, `fields`, `builtins[].placement`, `rig.rest`, `font`. Kontrata përdoret vetëm nga Gate-i, renderer-i dhe testet (u kontrollua me grep). Një dokument v1 refuzohet me `CAPABILITIES_INVALID`. |
| Kodet e Gate-it                                                                             | +3 (`VALUE_UNSUPPORTED`, `TRACK_MISSING`, `ROLE_MISSING`); asnjë kod ekzistues nuk ndryshon kuptim.                                                                                                                                                                                                                                          |
| Gjurmët e builtin-eve                                                                       | **Pa ndryshim.** Asnjë skedar vizatimi nuk preket; `capabilities.ts` nuk është skedar implementues i asnjë builtin-i.                                                                                                                                                                                                                        |
| Renderer-i                                                                                  | **Pa ndryshim.** Ndryshon vetëm Gate-i që ai thërret, dhe deklarata që i jep atij.                                                                                                                                                                                                                                                           |
| Golden-at, baseline-t, contact sheet-i                                                      | **Pa ndryshim.** `--write` refuzon tashmë.                                                                                                                                                                                                                                                                                                   |
| Fixtures A të kontratës                                                                     | Listat e pritura të refuzimeve në `gate/test/films.test.ts` mund të fitojnë gjetje të reja (si me `EASE_UNDEFINED`). Çdo shtesë raportohet. Fixtures A nuk renderohen, ndaj nuk ka efekt vizual.                                                                                                                                             |

### C.2 Kompatibiliteti (pikat 6–7)

Çdo rregull i ri **vetëm refuzon**. Renderer-i, gjurmët dhe të dhënat nuk ndryshojnë, kështu që për çdo paketë që mbetet e pranuar kuadrot janë bit për bit të njëjtë. Rreziku i vetëm është një refuzim i rremë i një pakete ekzistuese. Matjet më poshtë tregojnë që nuk ndodh, dhe testi T2 e provon.

### C.3 Matjet e tetë paketave (2026-11-17)

| Paketa        | Projeksioni | Tranzicionet  | Builtin-et (bota / ekrani)                                                                | Audio | Event-et (fx/duration) | `state` / contacts | Aktorët (rim/shadow) | Captions (`at`, `align`, `maxWidth`) | Kamera (aperture; refDist/dolly) | Blur / `lit`              | Vendosje builtin                    | Dalja        |
| ------------- | ----------- | ------------- | ----------------------------------------------------------------------------------------- | ----- | ---------------------- | ------------------ | -------------------- | ------------------------------------ | -------------------------------- | ------------------------- | ----------------------------------- | ------------ |
| B1–B5         | flat        | cut           | `set.*`, `prop.*`, `template.*` / `type.kinetic`, `overlay.scrim` (B2 edhe `overlay.ots`) | 0     | none/0                 | 0 / 0              | false/false          | —                                    | 0; 1920/0                        | 0 / false                 | identitet (`x`, `y` vetëm te props) | 1080×1920@30 |
| W0            | parallax    | cut, dissolve | `w0.*`, `prop.*` / `type.w0`                                                              | 0     | none/0                 | 0 / 0              | true/true            | `{x,y}`, center, —                   | 0; 2140/0,55                     | sipas rolit / sipas rolit | identitet                           | 1080×1920@30 |
| prisoner-cell | flat        | —             | skedarë                                                                                   | 0     | none/0                 | 0 / 0              | false/false          | `{x,y}`, center, —                   | 0; 1920/0                        | 0 / false                 | —                                   | 1080×1920@30 |
| office-clock  | flat        | whip          | `set.*`, `template.*` / `type.kinetic`                                                    | 0     | —                      | 0 / 0              | false/false          | —                                    | 0; 1920/0                        | 0 / false                 | identitet                           | 1080×1920@30 |

Asnjë nga tetë paketat nuk prek asnjë rregull të ri. Rrezik të ulët, jo zero, kanë vetëm rregullat që mbështeten në vlera që Stager-i i shkruan sot të barabarta (Y2, Y3, Y7). T2 i provon ato në kod.

---

## D. Matrica e testeve

### D.1 Negative (K5): refuzim para renderimit

Çdo rast:

- refuzohet me listën e saktë të gjetjeve (kod dhe shteg), dhe asgjë tjetër;
- `renderPackage` kthen të njëjtat gjetje si `validate()` (gabime dhe paralajmërime), **0 kuadro**, dhe `begin`, `frame`, `end` të sink-ut nuk thirren, pra encoder-i nuk niset.

Rastet shtohen te `gate/test/broken.ts`, kështu që i përdorin edhe testi negativ i Gate-it, edhe K5.

| Grupi                  | Raste                                                                                                   | Burimi                    |
| ---------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------- |
| Ekzistuesit            | 50 (48 të E1.3, `EASE_UNDEFINED`, `SVG_UNSAFE`)                                                         | `broken.ts`               |
| Auditimi               | 16: N1, N2a, N3a, N4, N5a, N6, N7, N8, N9, N10–N13, N14, N15, N16 (R1–R16, siç janë në `gate-audit.ts`) | skripti bëhet raste testi |
| Një defekt për rregull | N2b, N3b, N5b, N7b; X1–X9; Y1–Y7, secili me një defekt mbi bazën e B3 ose të W0                         | të reja                   |
| **Gjithsej**           | **50 + 16 + 4 + 9 + 7 = 86**                                                                            |                           |

### D.2 Pozitive

| #   | Testi                                                                                                                                                                                                                                                                                                                                                                        | Kalon kur                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| P1  | Gate-i v2 mbi tetë paketat (B1–B5 të gjeneruara nga Stager-i, W0, prisoner-cell, office-clock)                                                                                                                                                                                                                                                                               | `ok`, 0 gabime, 0 paralajmërime të reja                                                                                           |
| P2  | Paketa kufitare të lejuara: `cut` midis flat dhe parallax; parallax pa `w0.near`; props me track `x`/`y`; aktor pa track-e (vlen `rig.rest`)                                                                                                                                                                                                                                 | `ok`, dhe renderohen pa gabim                                                                                                     |
| P3  | **Ekzekutueshmëria (T4):** çdo paketë që Gate-i pranon në P1, P2 dhe në matricën e testeve renderohet në çdo kuadër pa gabim; për parallax, kuadri i parë i çdo prerjeje dhe çdo kuadër tranzicioni                                                                                                                                                                          | 0 gabime                                                                                                                          |
| P4  | **Identiteti vizual:** K1 (6 043 kuadro), K2/K3 (`golden:package`), K4 (i–ii), K7                                                                                                                                                                                                                                                                                            | rezultatet e sotme: 0 dështime; 931/931 hash identikë me `golden-package.json` dhe `golden-fixtures-b.json`; asgjë nuk rishkruhet |
| P5  | **Kontrata e aftësive (T5):** v2 deterministe dhe e vlefshme; dokumentet v1 dhe ato të prishura refuzohen me `CAPABILITIES_INVALID`; vlerat provohen kundrejt kodit: `rig.rest` = `STANDING`; `referenceDistance`/`dolly` = konstantet e `w0/camera.ts`; `captions.semantics` = konstantet e `package/draw.ts` dhe `w0/compositor.ts`; `output.sizes` = `W`×`H` i `style.ts` | të gjitha                                                                                                                         |
| P6  | **Plotësia e matricës (T7):** çdo fushë fundore e dy skemave ka klasë në `capabilities.fields`                                                                                                                                                                                                                                                                               | 243/243                                                                                                                           |
| P7  | **Zbatimi i matricës (T8):** çdo fushë `restricted`/`refused` ka të paktën një rast negativ në D.1                                                                                                                                                                                                                                                                           | 100%                                                                                                                              |

---

## E. Kriteret e pranimit

| Kriteri           | Kalon kur                                                                                                                                                                                                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **K5 (i ri)**     | 86/86 paketa të refuzuara (50 ekzistuese + 16 të auditimit + 20 me një defekt). Për secilën: kodi dhe shtegu i saktë (lista e plotë, barazi e saktë); gjetjet e `renderPackage` = `validate()`; **0 kuadro**; sink-u dhe encoder-i nuk nisen. Asnjë nga 11 rastet e auditimit që pranohen sot nuk pranohet më. |
| **K5-inv (i ri)** | Gate PASS ⟹ renderim pa gabim (P3), dhe matrica e fushave është e plotë dhe e zbatuar (P6, P7).                                                                                                                                                                                                                |
| K1–K4, K7         | Të pandryshuara, rishtuara (P4): 6 043/6 043; 451/451; 136/136; 390/390; 931/931.                                                                                                                                                                                                                              |
| K6                | I pandryshuar: grafi i renderer-it dhe testi i mosrihapjes kalojnë.                                                                                                                                                                                                                                            |
| K8                | I pandryshuar; plus P5.                                                                                                                                                                                                                                                                                        |
| K9                | Të gjitha testet, typecheck, lint, format; `contracts:gen --check` pa diff; gjurmët e builtin-eve të pandryshuara; `golden.json`, `golden-evidence.json`, `golden-package.json`, `golden-fixtures-b.json` me 0 bajt ndryshim.                                                                                  |
| Kompatibiliteti   | P1: tetë paketat pranohen.                                                                                                                                                                                                                                                                                     |

---

## F. Rreziqet dhe vendimet që kërkojnë miratimin tënd

| #   | Vendimi                                                                                                                                  | Rekomandimi                                                                                | Alternativa · pasoja                                                                                                                       |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| F1  | Forma v2 e `RenderCapabilities` (§B.1): `projections` si objekt, `transitions` si kombinime                                              | Po                                                                                         | Rregulla të shkruara në Gate pa deklaratë: më e shpejtë, por Engine-i nuk e publikon atë që vizaton, dhe Gate-i mbart njohuri të Engine-it |
| F2  | Tre kodet e reja                                                                                                                         | Po                                                                                         | Vetëm `CAPABILITY_MISSING` me mesazhe të ndryshme: më pak e qartë për Planner-in dhe Stager-in                                             |
| F3  | Matrica e fushave në `capabilities.fields`, me testet e plotësisë dhe të zbatimit (§B.4)                                                 | Po: është garancia e pikës 5                                                               | Pa matricë: garancia mbetet te rastet e njohura, dhe gjetjet X1–X9 tregojnë që ka të tjera                                                 |
| F4  | Gjetjet X1–X9 brenda këtij scope-i                                                                                                       | Po: i njëjti mekanizëm, rrezik zero për tetë paketat                                       | T'i lëmë për më vonë: Gate PASS nuk do ta garantonte parimin                                                                               |
| F5  | `scenes[].bounds`: renderer-i nuk e lexon; kontrata thotë "kamera mbahet brenda". Kjo është kufizim i prodhuesit, jo semantikë vizatimi. | `unused` në E1.4 (Gate-i nuk e verifikon); verifikimi i kamerës brenda kufijve hyn në E1.5 | Ta verifikojë Gate-i tani: kërkon llogaritjen e pamjes së kamerës për projeksionin, dhe nuk e kam matur ende për tetë paketat              |
| F6  | `output`: vetëm 1080×1920@30 dhe pa audio                                                                                                | Po: vetëm kjo është provuar                                                                | Të lejohen fps të tjera: renderer-i duket i aftë, por nuk është provuar me asnjë test                                                      |
| F7  | Kanalet e rig-ut pa track marrin `rig.rest` të publikuar                                                                                 | Po: mban prisoner-cell                                                                     | Track i detyrueshëm për çdo kanal: refuzon prisoner-cell, kërkon fixtures B të reja dhe miratim të ri të K4                                |
| F8  | Rreziku Y2/Y3/Y7: refuzim i rremë nëse Stager-i shkruan diçka ndryshe nga ç'kam matur                                                    | I mbuluar nga P1                                                                           | —                                                                                                                                          |
| F9  | Korrigjimi i numërimit të auditimit (11 + 5, jo 10 + 6) në raportin E1.4                                                                 | Po, në commit dokumentimi                                                                  | —                                                                                                                                          |

**Rendi i punës pas miratimit** (commit-e të vogla, me ndalesë dhe raport për çdo devijim):

1. Kontrata v2 + P5.
2. Deklarata në `film/src/capabilities.ts` + matrica + P6.
3. G-P, G-T.
4. G-K, G-A.
5. G-C, G-B, G-E.
6. Rastet negative D.1 + K5 + P7.
7. P1–P4.
8. Raporti.

Pres miratimin tënd. Deri atëherë nuk implementoj asgjë.
