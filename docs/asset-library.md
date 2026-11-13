# Biblioteka vizuale: lista e prodhimit (275)

Ky dokument lidh çdo rresht të listës "Erkasa Visual Asset Production List" me asetin real në `assets/`.
Asnjë rresht nuk mbetet pa mbulim. Kolona **Statusi**:

- **i ri**: aset i krijuar për këtë listë (ID e re në `assets/manifest.json`).
- **ekzistonte**: aseti ishte në bibliotekë para listës.
- **variant**: vizatim tjetër i të njëjtit aset (`variants` / `outfits`), p.sh. kafazi i hapur, veshja `business`.
- **veprim**: pozë e personazhit, e luajtur nga motori (`actions`), jo vizatim më vete; vlen për të gjithë personazhet.
- **kompozim**: personazh + aset(e) në të njëjtën skenë, të ndërtuara nga planeri.
- **bashkuar**: i njëjti koncept del dy herë në listë; ka vetëm një aset.

## Si e përdor Creative Director (planeri)

- Katalogu (`ai-worker/src/catalog.ts`) lexon vetëm manifestin: planeri nuk mund të shpikë ID. Skema e planit pranon vetëm ID ekzistuese.
- Objektet renditen sipas skenarit: etiketat (`tags`) peshojnë më shumë, pastaj ID/emri, pastaj `description` + `storyUse` (maksimumi 2 pikë). Asetet në stilin tonë kanë përparësi të vogël ndaj emoji-ve të të njëjtit koncept.
- Personazhet: veprimet e përbashkëta listohen një herë; për secilin personazh jepen identiteti, sendet në dorë dhe veshjet.
- Efektet mbi ekran (`category: effect`, `placement: screen`) përdoren te `scene.effects` me ID-në si `preset`; efektet në skenë (`placement: world`: zjarr, tym, shkëndija, bojë) janë shtresa `object`.
- Kur një aset nuk ekziston, kompilatori kthen `ASSET_NOT_FOUND` / `EFFECT_UNKNOWN` dhe planeri riprovon; nuk zëvendësohet me diçka pa lidhje.

## Metadata: fushat e listës → `erkasa.asset/1`

| Lista                  | Fusha jonë                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| asset_id               | `assetId` (unik, i qëndrueshëm; validatori refuzon dublikatat)                                                   |
| name                   | `name`                                                                                                           |
| category               | `category` (character, background, metaphor, object, icon, effect) + `collection` (psychology, power, business…) |
| tags                   | `tags`                                                                                                           |
| asset_type             | `kind` (rigged_character, layered_background, prop, animated_metaphor, overlay…)                                 |
| format                 | `files.svg` (SVG vektorial; transparent nga natyra)                                                              |
| transparent_background | po, për çdo objekt/efekt; sfondet janë të plota                                                                  |
| aspect_ratio           | `viewBox`; sfondet 2560×1920 me `safeFrames` për 9:16, 16:9, 1:1                                                 |
| style_id               | `style` (`erkasa_editorial_v2` objekte/sfonde/efekte, `erkasa_flat_v1` personazhe)                               |
| animation_hints        | `capabilities.animations` + `capabilities.idle` + `parts`                                                        |
| source_file            | rruga në `assets/manifest.json` (e verifikuar nga validatori)                                                    |
| (shtesë)               | `description`, `storyUse`: çfarë tregon aseti në një histori, i lexon planeri                                    |

## Gjenerimi

Çdo aset vizatohet me kod (deterministik, pa API të jashtme). Gjeneratorët janë te `tools/asset-gen/`:

| Pjesa                                              | Skedari                                                                                                 |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Personazhet, veshjet, turma                        | `characters.py`, `characters_side.py`, `people.py`                                                      |
| Psikologji / pushtet / biznes / filozofi / histori | `props_psychology.py`, `props_power.py`, `props_business.py`, `props_philosophy.py`, `props_history.py` |
| Shtëpia dhe objektet e përditshme                  | `props_v2.py`                                                                                           |
| Sfondet                                            | `backgrounds_v2.py`, `backgrounds_interior.py`, `backgrounds_exterior.py` (ndihmës: `bglib.py`)         |
| Efektet                                            | `fx.py`                                                                                                 |
| Stili, paleta, ndihmës                             | `editorial.py`                                                                                          |

Pas çdo ndryshimi: `python3 tools/asset-validate/validate.py` (rindërton manifestin dhe kontrollon paletën, elementet e ndaluara, ID-të e gradientëve, metadata-t).

## 01. Human Characters (40)

ekzistonte: 3, i ri: 11, variant: 3, kompozim: 7, veprim: 16

| #   | Në listë                          | Statusi    | Aseti / veprimi                | Shënim                                              |
| --- | --------------------------------- | ---------- | ------------------------------ | --------------------------------------------------- |
| 1   | Male character – young adult      | ekzistonte | `char_arti_01`                 | Arti, ~20 vjeç                                      |
| 2   | Male character – middle-aged      | i ri       | `char_genti_01`                |                                                     |
| 3   | Male character – elderly          | ekzistonte | `char_bardhi_01`               | Bardhi, ~70 vjeç                                    |
| 4   | Female character – young adult    | ekzistonte | `char_era_01`                  | Era, ~30 vjeç                                       |
| 5   | Female character – middle-aged    | i ri       | `char_mira_01`                 |                                                     |
| 6   | Businessman – formal suit         | variant    | `char_drini_01`                | veshja e re `business` e Drinit                     |
| 7   | Businesswoman – formal suit       | variant    | `char_era_01`                  | veshja e re `business` e Erës                       |
| 8   | Worker – casual clothes           | i ri       | `char_dritan_01`               |                                                     |
| 9   | Rich businessman                  | i ri       | `char_viktor_01`               |                                                     |
| 10  | Poor worker                       | variant    | `char_dritan_01`               | veshja e re `worn` e Dritanit                       |
| 11  | Philosopher character             | i ri       | `char_philosopher_01`          |                                                     |
| 12  | Politician character              | i ri       | `char_politician_01`           |                                                     |
| 13  | King character                    | i ri       | `char_king_01`                 |                                                     |
| 14  | Queen character                   | i ri       | `char_queen_01`                |                                                     |
| 15  | Anonymous human silhouette        | i ri       | `char_silhouette_01`           |                                                     |
| 16  | Group of people                   | i ri       | `prop_people_group_01`         | 6 figurantë (jo kasti), objekt skene                |
| 17  | Crowd                             | i ri       | `prop_crowd_mass_01`           | turmë e dendur nga pas; figura char_crowd_01 mbetet |
| 18  | Two people facing each other      | kompozim   | `char_arti_01` + `char_era_01` | dy personazhe anash, `facing` përballë              |
| 19  | Person sitting alone              | kompozim   | `prop_park_bench_01`           | `seated` mbi stolin e parkut                        |
| 20  | Person walking                    | veprim     | `walk`                         | ekziston                                            |
| 21  | Person running                    | veprim     | `run`                          | ekziston                                            |
| 22  | Person thinking                   | veprim     | `think`                        | ekziston                                            |
| 23  | Person pointing                   | veprim     | `point_side`                   | ekziston                                            |
| 24  | Person reading                    | veprim     | `read`                         | ekziston                                            |
| 25  | Person working at desk            | veprim     | `seated_type`                  | ekziston                                            |
| 26  | Person looking at phone           | veprim     | `use_phone`                    | ekziston                                            |
| 27  | Person looking in mirror          | kompozim   | `prop_wall_mirror_01`          | personazh anash përballë pasqyrës                   |
| 28  | Person holding head               | veprim     | `stressed`                     | ekziston                                            |
| 29  | Person standing with crossed arms | veprim     | `cross_arms`                   | i ri                                                |
| 30  | Person shaking hands              | veprim     | `shake_hands`                  | i ri                                                |
| 31  | Person arguing                    | veprim     | `argue`                        | i ri                                                |
| 32  | Person negotiating                | veprim     | `negotiate`                    | i ri                                                |
| 33  | Person presenting                 | veprim     | `present`                      | i ri                                                |
| 34  | Person observing                  | veprim     | `observe`                      | i ri                                                |
| 35  | Person falling                    | veprim     | `fall`                         | i ri                                                |
| 36  | Person climbing stairs            | veprim     | `climb`                        | i ri                                                |
| 37  | Person behind glass               | kompozim   | `met_glass_wall_01`            |                                                     |
| 38  | Person sitting in darkness        | kompozim   | `bg_abstract_dark_01`          |                                                     |
| 39  | Person looking at clock           | kompozim   | `prop_wall_clock_01`           | `look_up` (i ri) ose `check_watch`                  |
| 40  | Person standing at crossroads     | kompozim   | `met_crossroads_01`            |                                                     |

## 02. Psychology & Human Behavior (45)

i ri: 34, ekzistonte: 9, variant: 2

| #   | Në listë                        | Statusi    | Aseti / veprimi              | Shënim                |
| --- | ------------------------------- | ---------- | ---------------------------- | --------------------- |
| 1   | Human brain                     | i ri       | `prop_brain_01`              |                       |
| 2   | Human head silhouette           | i ri       | `prop_head_silhouette_01`    |                       |
| 3   | Brain with neural connections   | i ri       | `prop_brain_network_01`      |                       |
| 4   | Brain divided into two parts    | i ri       | `prop_brain_split_01`        |                       |
| 5   | Human heart                     | i ri       | `prop_heart_01`              |                       |
| 6   | Human eye                       | i ri       | `prop_eye_01`                |                       |
| 7   | Human hand                      | i ri       | `prop_hand_01`               |                       |
| 8   | Human shadow                    | i ri       | `prop_human_shadow_01`       |                       |
| 9   | Mirror                          | ekzistonte | `prop_wall_mirror_01`        |                       |
| 10  | Broken mirror                   | i ri       | `met_broken_mirror_01`       |                       |
| 11  | Theater mask                    | i ri       | `prop_theater_mask_01`       |                       |
| 12  | Two different masks             | i ri       | `prop_theater_masks_01`      |                       |
| 13  | Human face reflection           | i ri       | `prop_mirror_reflection_01`  |                       |
| 14  | Maze                            | ekzistonte | `met_maze_01`                |                       |
| 15  | Labyrinth entrance              | i ri       | `prop_labyrinth_entrance_01` |                       |
| 16  | Locked cage                     | i ri       | `met_cage_01`                |                       |
| 17  | Open cage                       | variant    | `met_cage_01`                | varianti `open`       |
| 18  | Invisible glass wall            | i ri       | `met_glass_wall_01`          |                       |
| 19  | Broken chains                   | ekzistonte | `met_chain_break_01`         |                       |
| 20  | Heavy chains                    | i ri       | `prop_heavy_chains_01`       |                       |
| 21  | Open door                       | i ri       | `met_door_light_01`          |                       |
| 22  | Locked door                     | variant    | `met_door_light_01`          | varianti `locked`     |
| 23  | Multiple doors                  | i ri       | `met_many_doors_01`          |                       |
| 24  | Key                             | i ri       | `prop_key_01`                |                       |
| 25  | Hourglass                       | ekzistonte | `met_hourglass_01`           |                       |
| 26  | Wall clock                      | ekzistonte | `prop_wall_clock_01`         |                       |
| 27  | Stopwatch                       | i ri       | `prop_stopwatch_01`          |                       |
| 28  | Calendar                        | i ri       | `prop_wall_calendar_01`      |                       |
| 29  | Burning candle                  | i ri       | `prop_candle_01`             |                       |
| 30  | Light bulb                      | ekzistonte | `prop_hanging_bulb_01`       |                       |
| 31  | Thought bubble                  | i ri       | `prop_thought_bubble_01`     |                       |
| 32  | Puzzle pieces                   | i ri       | `prop_puzzle_pieces_01`      |                       |
| 33  | Domino pieces                   | ekzistonte | `met_dominoes_01`            |                       |
| 34  | Dice                            | i ri       | `prop_dice_01`               |                       |
| 35  | Playing cards                   | i ri       | `prop_playing_cards_01`      |                       |
| 36  | Red warning light               | i ri       | `prop_warning_light_01`      |                       |
| 37  | Eye watching                    | i ri       | `met_watching_eye_01`        |                       |
| 38  | Puppet strings                  | i ri       | `prop_puppet_controller_01`  |                       |
| 39  | Marionette                      | ekzistonte | `met_puppet_01`              |                       |
| 40  | Compass                         | i ri       | `prop_compass_01`            |                       |
| 41  | Crossroads sign                 | i ri       | `prop_signpost_01`           |                       |
| 42  | Staircase                       | ekzistonte | `met_stairs_01`              |                       |
| 43  | Ladder                          | i ri       | `prop_ladder_01`             |                       |
| 44  | Broken staircase                | i ri       | `met_broken_stairs_01`       |                       |
| 45  | Human silhouette with spotlight | i ri       | `met_spotlight_01`           | me char_silhouette_01 |

## 03. Power & Influence (30)

i ri: 25, bashkuar: 5

| #   | Në listë                    | Statusi  | Aseti / veprimi             | Shënim                               |
| --- | --------------------------- | -------- | --------------------------- | ------------------------------------ |
| 1   | Chess king                  | i ri     | `prop_chess_king_01`        |                                      |
| 2   | Chess queen                 | i ri     | `prop_chess_queen_01`       |                                      |
| 3   | Chess pawn                  | i ri     | `prop_chess_pawn_01`        |                                      |
| 4   | Chess rook                  | i ri     | `prop_chess_rook_01`        |                                      |
| 5   | Chess board                 | i ri     | `prop_chess_board_01`       |                                      |
| 6   | Golden crown                | i ri     | `prop_crown_01`             |                                      |
| 7   | Royal throne                | i ri     | `prop_throne_01`            |                                      |
| 8   | Royal scepter               | i ri     | `prop_scepter_01`           |                                      |
| 9   | Golden medal                | i ri     | `prop_medal_01`             |                                      |
| 10  | Trophy                      | i ri     | `prop_trophy_01`            |                                      |
| 11  | Handshake                   | i ri     | `prop_handshake_01`         |                                      |
| 12  | Contract signing            | i ri     | `prop_contract_signing_01`  |                                      |
| 13  | Negotiation table           | i ri     | `prop_meeting_table_01`     |                                      |
| 14  | Wooden gavel                | i ri     | `prop_gavel_01`             |                                      |
| 15  | Theater masks               | bashkuar | `prop_theater_masks_01`     | = 02 Two different masks             |
| 16  | Puppet controller           | bashkuar | `prop_puppet_controller_01` | = 02 Puppet strings                  |
| 17  | Marionette strings          | bashkuar | `prop_puppet_controller_01` | = 02 Puppet strings                  |
| 18  | Control panel               | i ri     | `prop_control_panel_01`     |                                      |
| 19  | Surveillance camera         | i ri     | `prop_security_camera_01`   |                                      |
| 20  | Microphone                  | i ri     | `prop_microphone_01`        |                                      |
| 21  | Podium                      | i ri     | `prop_podium_01`            |                                      |
| 22  | Presidential desk           | i ri     | `prop_presidential_desk_01` |                                      |
| 23  | Closed briefcase            | i ri     | `prop_briefcase_01`         |                                      |
| 24  | Luxury watch                | i ri     | `prop_luxury_watch_01`      |                                      |
| 25  | Key to a locked room        | bashkuar | `prop_key_01`               | = 02 Key                             |
| 26  | Tall columns                | i ri     | `prop_colonnade_01`         |                                      |
| 27  | Hierarchy pyramid           | i ri     | `met_hierarchy_pyramid_01`  |                                      |
| 28  | Red carpet                  | i ri     | `prop_red_carpet_01`        |                                      |
| 29  | Spotlight                   | bashkuar | `met_spotlight_01`          | = 02 Human silhouette with spotlight |
| 30  | Shadow of a powerful figure | i ri     | `met_power_shadow_01`       |                                      |

## 04. Business & Economics (40)

i ri: 30, ekzistonte: 5, variant: 2, bashkuar: 3

| #   | Në listë             | Statusi    | Aseti / veprimi              | Shënim                                           |
| --- | -------------------- | ---------- | ---------------------------- | ------------------------------------------------ |
| 1   | Dollar banknotes     | i ri       | `prop_dollar_bills_01`       |                                                  |
| 2   | Euro banknotes       | i ri       | `prop_euro_bills_01`         |                                                  |
| 3   | Coin stacks          | i ri       | `prop_coin_stacks_01`        |                                                  |
| 4   | Gold bars            | i ri       | `prop_gold_bars_01`          |                                                  |
| 5   | Wallet               | ekzistonte | `prop_wallet_01`             |                                                  |
| 6   | Open wallet          | variant    | `prop_wallet_01`             | varianti `open`                                  |
| 7   | Safe                 | i ri       | `prop_safe_01`               |                                                  |
| 8   | Bank building        | i ri       | `prop_bank_building_01`      |                                                  |
| 9   | Stock market chart   | i ri       | `prop_stock_chart_01`        |                                                  |
| 10  | Growth chart         | i ri       | `prop_growth_chart_01`       |                                                  |
| 11  | Declining chart      | variant    | `prop_growth_chart_01`       | varianti `down`                                  |
| 12  | Financial calculator | i ri       | `prop_calculator_01`         |                                                  |
| 13  | Laptop               | i ri       | `prop_laptop_01`             | pamje ballore; ekziston edhe prop_laptop_side_01 |
| 14  | Desktop computer     | i ri       | `prop_desktop_computer_01`   |                                                  |
| 15  | Smartphone           | i ri       | `prop_smartphone_01`         |                                                  |
| 16  | Office desk          | i ri       | `prop_office_desk_01`        | pamje ballore; ekziston edhe prop_desk_side_01   |
| 17  | Office chair         | ekzistonte | `prop_chair_office_side_01`  |                                                  |
| 18  | Business briefcase   | bashkuar   | `prop_briefcase_01`          | = 03 Closed briefcase                            |
| 19  | Contract             | i ri       | `prop_contract_01`           |                                                  |
| 20  | Invoice              | i ri       | `prop_invoice_01`            |                                                  |
| 21  | Financial report     | i ri       | `prop_financial_report_01`   |                                                  |
| 22  | Business notebook    | i ri       | `prop_notebook_01`           |                                                  |
| 23  | Pen                  | i ri       | `prop_pen_01`                |                                                  |
| 24  | Factory              | i ri       | `prop_factory_01`            |                                                  |
| 25  | Production machine   | i ri       | `prop_production_machine_01` |                                                  |
| 26  | Warehouse            | i ri       | `prop_warehouse_01`          |                                                  |
| 27  | Shipping container   | i ri       | `prop_shipping_container_01` |                                                  |
| 28  | Delivery truck       | i ri       | `prop_delivery_truck_01`     |                                                  |
| 29  | Retail shop          | i ri       | `prop_shop_front_01`         |                                                  |
| 30  | Shopping cart        | i ri       | `prop_shopping_cart_01`      |                                                  |
| 31  | Real estate building | i ri       | `prop_office_tower_01`       |                                                  |
| 32  | House                | i ri       | `prop_house_01`              |                                                  |
| 33  | Apartment building   | i ri       | `prop_apartment_building_01` |                                                  |
| 34  | Investment portfolio | i ri       | `prop_portfolio_01`          |                                                  |
| 35  | Pie chart            | ekzistonte | `chart:pie`                  | grafik i motorit, i animuar me të dhëna          |
| 36  | Bar chart            | ekzistonte | `chart:bar`                  | grafik i motorit, i animuar me të dhëna          |
| 37  | Balance scale        | ekzistonte | `met_balance_01`             |                                                  |
| 38  | Business handshake   | bashkuar   | `prop_handshake_01`          | = 03 Handshake                                   |
| 39  | Meeting table        | bashkuar   | `prop_meeting_table_01`      | = 03 Negotiation table                           |
| 40  | Desk calendar        | i ri       | `prop_desk_calendar_01`      |                                                  |

## 05. Philosophy & Critical Thinking (25)

i ri: 21, bashkuar: 4

| #   | Në listë                         | Statusi  | Aseti / veprimi              | Shënim             |
| --- | -------------------------------- | -------- | ---------------------------- | ------------------ |
| 1   | Socrates-style philosopher bust  | i ri     | `prop_bust_socratic_01`      |                    |
| 2   | Plato-style philosopher bust     | i ri     | `prop_bust_platonic_01`      |                    |
| 3   | Aristotle-style philosopher bust | i ri     | `prop_bust_aristotelian_01`  |                    |
| 4   | Ancient Greek column             | i ri     | `prop_greek_column_01`       |                    |
| 5   | Marble statue                    | i ri     | `prop_marble_statue_01`      |                    |
| 6   | Ancient library book             | i ri     | `prop_ancient_book_01`       |                    |
| 7   | Open book                        | i ri     | `prop_open_book_01`          |                    |
| 8   | Ancient scroll                   | i ri     | `prop_scroll_01`             |                    |
| 9   | Quill pen                        | i ri     | `prop_quill_01`              |                    |
| 10  | Ink bottle                       | i ri     | `prop_ink_bottle_01`         |                    |
| 11  | Candle holder                    | i ri     | `prop_candle_holder_01`      |                    |
| 12  | Globe                            | i ri     | `prop_globe_01`              |                    |
| 13  | Telescope                        | i ri     | `prop_telescope_01`          |                    |
| 14  | Magnifying glass                 | i ri     | `prop_magnifier_01`          |                    |
| 15  | Balance scales                   | bashkuar | `met_balance_01`             | = 04 Balance scale |
| 16  | Hourglass                        | bashkuar | `met_hourglass_01`           | = 02 Hourglass     |
| 17  | Compass                          | bashkuar | `prop_compass_01`            | = 02 Compass       |
| 18  | Ancient map                      | i ri     | `prop_ancient_map_01`        |                    |
| 19  | Philosophical maze               | bashkuar | `met_maze_01`                | = 02 Maze          |
| 20  | Question mark sculpture          | i ri     | `prop_question_sculpture_01` |                    |
| 21  | Puzzle cube                      | i ri     | `prop_puzzle_cube_01`        |                    |
| 22  | Light beam                       | i ri     | `met_light_beam_01`          |                    |
| 23  | Broken statue                    | i ri     | `prop_broken_statue_01`      |                    |
| 24  | Stone staircase                  | i ri     | `prop_stone_staircase_01`    |                    |
| 25  | Empty frame                      | i ri     | `prop_empty_frame_01`        |                    |

## 06. History & Society (25)

i ri: 17, bashkuar: 8

| #   | Në listë               | Statusi  | Aseti / veprimi               | Shënim                                      |
| --- | ---------------------- | -------- | ----------------------------- | ------------------------------------------- |
| 1   | Roman senate building  | i ri     | `prop_roman_senate_01`        |                                             |
| 2   | Medieval castle        | i ri     | `prop_castle_01`              |                                             |
| 3   | Royal palace           | i ri     | `prop_palace_01`              |                                             |
| 4   | Ancient Greek temple   | i ri     | `prop_greek_temple_01`        |                                             |
| 5   | Historical courtroom   | bashkuar | `bg_courtroom_01`             | = 07 Courtroom (gjykatë klasike prej druri) |
| 6   | Industrial factory     | bashkuar | `prop_factory_01`             | = 04 Factory                                |
| 7   | Old printing press     | i ri     | `prop_printing_press_01`      |                                             |
| 8   | Historical city street | bashkuar | `bg_old_european_street_01`   | = 08 Old European street                    |
| 9   | Medieval market        | i ri     | `prop_market_stall_01`        |                                             |
| 10  | Old merchant shop      | i ri     | `prop_merchant_shop_01`       |                                             |
| 11  | Wooden sailing ship    | i ri     | `prop_sailing_ship_01`        |                                             |
| 12  | Historical world map   | bashkuar | `prop_ancient_map_01`         | = 05 Ancient map                            |
| 13  | Ancient globe          | bashkuar | `prop_globe_01`               | = 05 Globe (glob antik)                     |
| 14  | Vintage newspaper      | i ri     | `prop_vintage_newspaper_01`   |                                             |
| 15  | Historical document    | i ri     | `prop_historical_document_01` |                                             |
| 16  | Wax seal               | i ri     | `prop_wax_seal_01`            |                                             |
| 17  | Old pocket watch       | i ri     | `prop_pocket_watch_01`        |                                             |
| 18  | Medieval sword         | i ri     | `prop_sword_01`               |                                             |
| 19  | Royal throne           | bashkuar | `prop_throne_01`              | = 03 Royal throne                           |
| 20  | Military helmet        | i ri     | `prop_military_helmet_01`     |                                             |
| 21  | Ancient statue         | bashkuar | `prop_marble_statue_01`       | = 05 Marble statue                          |
| 22  | Stone bridge           | i ri     | `prop_stone_bridge_01`        |                                             |
| 23  | Historical train       | i ri     | `prop_steam_train_01`         |                                             |
| 24  | Old bank building      | bashkuar | `prop_bank_building_01`       | = 04 Bank building (fasadë klasike)         |
| 25  | Parliament chamber     | i ri     | `bg_parliament_01`            |                                             |

## 07. Backgrounds & Environments — Interior (25)

ekzistonte: 7, i ri: 18

| #   | Në listë                | Statusi    | Aseti / veprimi                                       | Shënim        |
| --- | ----------------------- | ---------- | ----------------------------------------------------- | ------------- |
| 1   | Modern office           | ekzistonte | `bg_office_01`                                        |               |
| 2   | Dark office             | i ri       | `bg_office_night_01`                                  |               |
| 3   | Luxury office           | i ri       | `bg_luxury_office_01`                                 |               |
| 4   | Small home office       | ekzistonte | `bg_home_office_01`                                   |               |
| 5   | Boardroom               | ekzistonte | `bg_meeting_room_01`                                  |               |
| 6   | Negotiation room        | i ri       | `bg_negotiation_room_01`                              |               |
| 7   | Library                 | i ri       | `bg_library_01`                                       |               |
| 8   | Ancient library         | i ri       | `bg_ancient_library_01`                               |               |
| 9   | Classroom               | ekzistonte | `bg_classroom_01`                                     |               |
| 10  | University lecture hall | i ri       | `bg_lecture_hall_01`                                  |               |
| 11  | Courtroom               | i ri       | `bg_courtroom_01`                                     |               |
| 12  | Bank interior           | i ri       | `bg_bank_interior_01`                                 |               |
| 13  | Factory interior        | i ri       | `bg_factory_interior_01`                              |               |
| 14  | Warehouse interior      | i ri       | `bg_warehouse_interior_01`                            |               |
| 15  | Living room             | ekzistonte | `bg_home_living_01` + `bg_home_living_night_01`       | ditë dhe natë |
| 16  | Bedroom                 | ekzistonte | `bg_home_bedroom_day_01` + `bg_home_bedroom_night_01` | ditë dhe natë |
| 17  | Kitchen                 | ekzistonte | `bg_home_kitchen_01`                                  |               |
| 18  | Prison cell             | i ri       | `bg_prison_cell_01`                                   |               |
| 19  | Empty hallway           | i ri       | `bg_hallway_01`                                       |               |
| 20  | Long corridor           | i ri       | `bg_long_corridor_01`                                 |               |
| 21  | Staircase interior      | i ri       | `bg_stairwell_01`                                     |               |
| 22  | Elevator interior       | i ri       | `bg_elevator_01`                                      |               |
| 23  | Underground tunnel      | i ri       | `bg_tunnel_01`                                        |               |
| 24  | Museum                  | i ri       | `bg_museum_01`                                        |               |
| 25  | Royal throne room       | i ri       | `bg_throne_room_01`                                   |               |

## 08. Backgrounds & Environments — Exterior (25)

i ri: 23, ekzistonte: 2

| #   | Në listë                   | Statusi    | Aseti / veprimi             | Shënim |
| --- | -------------------------- | ---------- | --------------------------- | ------ |
| 1   | Modern city skyline        | i ri       | `bg_city_skyline_01`        |        |
| 2   | Old European street        | i ri       | `bg_old_european_street_01` |        |
| 3   | Rainy city street          | i ri       | `bg_city_street_rain_01`    |        |
| 4   | Empty city street at night | i ri       | `bg_city_street_night_01`   |        |
| 5   | Business district          | i ri       | `bg_business_district_01`   |        |
| 6   | Financial district         | i ri       | `bg_financial_district_01`  |        |
| 7   | Industrial district        | i ri       | `bg_industrial_district_01` |        |
| 8   | Ancient Greek city         | i ri       | `bg_ancient_greek_city_01`  |        |
| 9   | Roman city                 | i ri       | `bg_roman_city_01`          |        |
| 10  | Medieval village           | i ri       | `bg_medieval_village_01`    |        |
| 11  | Castle exterior            | i ri       | `bg_castle_exterior_01`     |        |
| 12  | Palace exterior            | i ri       | `bg_palace_exterior_01`     |        |
| 13  | Public square              | i ri       | `bg_public_square_01`       |        |
| 14  | City park                  | ekzistonte | `bg_park_01`                |        |
| 15  | Bridge                     | i ri       | `bg_bridge_01`              |        |
| 16  | Mountain landscape         | ekzistonte | `bg_nature_mountain_01`     |        |
| 17  | Desert landscape           | i ri       | `bg_desert_01`              |        |
| 18  | Ocean horizon              | i ri       | `bg_ocean_horizon_01`       |        |
| 19  | Train station              | i ri       | `bg_train_station_01`       |        |
| 20  | Airport                    | i ri       | `bg_airport_01`             |        |
| 21  | Underground subway         | i ri       | `bg_subway_01`              |        |
| 22  | Rooftop                    | i ri       | `bg_rooftop_01`             |        |
| 23  | Parking garage             | i ri       | `bg_parking_garage_01`      |        |
| 24  | Empty road                 | i ri       | `bg_empty_road_01`          |        |
| 25  | Crossroads                 | i ri       | `bg_crossroads_01`          |        |

## 09. Visual Effects & Overlays (20)

i ri: 18, ekzistonte: 2

| #   | Në listë             | Statusi    | Aseti / veprimi          | Shënim                                                             |
| --- | -------------------- | ---------- | ------------------------ | ------------------------------------------------------------------ |
| 1   | Smoke                | i ri       | `fx_smoke_01`            |                                                                    |
| 2   | Dust particles       | ekzistonte | `particle:dust`          | efekt i animuar i motorit                                          |
| 3   | Light rays           | i ri       | `fx_light_rays_01`       |                                                                    |
| 4   | Film grain overlay   | i ri       | `fx_film_grain_01`       |                                                                    |
| 5   | Fog                  | i ri       | `fx_fog_01`              |                                                                    |
| 6   | Rain overlay         | i ri       | `fx_rain_01`             | shtresë statike shiu; për pika që bien ekziston edhe particle:rain |
| 7   | Fire                 | i ri       | `fx_fire_01`             |                                                                    |
| 8   | Sparks               | i ri       | `fx_sparks_01`           |                                                                    |
| 9   | Shadow overlay       | i ri       | `fx_shadow_overlay_01`   |                                                                    |
| 10  | Glass reflection     | i ri       | `fx_glass_reflection_01` |                                                                    |
| 11  | Light leak           | i ri       | `fx_light_leak_01`       |                                                                    |
| 12  | Vignette             | i ri       | `fx_vignette_01`         |                                                                    |
| 13  | Screen distortion    | i ri       | `fx_screen_glitch_01`    |                                                                    |
| 14  | Paper texture        | i ri       | `fx_paper_texture_01`    |                                                                    |
| 15  | Old film texture     | i ri       | `fx_old_film_01`         |                                                                    |
| 16  | Ink spreading        | i ri       | `fx_ink_spread_01`       |                                                                    |
| 17  | Liquid ink           | i ri       | `fx_liquid_ink_01`       |                                                                    |
| 18  | Floating particles   | ekzistonte | `particle:bokeh`         | efekt i animuar i motorit (edhe sparkle)                           |
| 19  | Glowing outline      | i ri       | `fx_glow_outline_01`     |                                                                    |
| 20  | Motion blur elements | i ri       | `fx_speed_lines_01`      |                                                                    |
