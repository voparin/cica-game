# ADR-0010: Háztípusok és berendezett lakószoba

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A felhasználó hatféle házat kért (lakóház, gyár, iskola, iroda, bolt, étterem),
kívülről is megkülönböztethetően, és a lakóháznak egy konkrétan berendezett
belsővel. A város determinisztikus, képletből generált (ADR-0003), ezért a
típusnak is a seedből kell jönnie, és nem befolyásolhatja az ütközést (ADR-0008
mintájára).

## Döntés
- `houseType(seed)` – determinisztikus típus a seedből: a lakóház ~50%, a másik öt
  a maradékon osztozik. A `housesInBlock` minden háznak `type` mezőt ad.
- `houseSign(type)` – a speciális típusok (gyár/iskola/iroda/bolt/étterem) táblát
  kapnak: **teljes név** (rövidítés nélkül) + **ikon** + szín (`drawHouseIcon`). A
  `drawHouse` kívül (az ajtó fölött), a `drawRoomHeader` belül (a szoba tetején)
  rajzolja. A lakóházhoz nincs tábla (helyette otthonos jegyek: kémény, kertkapu).
- `roomFor(type)` – a belső leírása: a lakóház berendezett (`furnished: true`,
  felirat nélkül), a többi egyszerű szoba a típus magyar nevével (`label`).
  Az `enterHouse` a `player.inHouse`-ba teszi a `type`-ot és a `room`-ot.
- `drawBedroom(...)` – a lakószoba berendezése felülnézetben: bal oldalon ágy,
  középen szőnyeg, jobb oldalon szekrény; a szekrény tetején 3 könyv + egy társas,
  alatta a padlón egy könyv, 3 színes ceruza és egy maci.
- **Iskola (0.7.0):** az iskola is berendezett belsőt kap (`roomFor` `school: true`):
  `schoolLayout` padokkal rácsban + tábla; `drawSchool` rajzolja. A padnál E-vel
  leülés (`player.sitting`), ekkor egy nyitott könyv jelenik meg (`drawOpenBook`,
  `BOOK_LETTERS = A O I M E`).
- **Étterem (0.9.0):** `roomFor` `dining: true`; `restaurantLayout` 3-4 asztallal;
  `drawRestaurant` rajzolja. Az asztalnál E-vel leülés (`player.sitting` újrahasznosítva),
  ekkor a terítés jelenik meg (`drawMeal`: hús a tányéron, répa, pohár víz).
- **Bolt / iroda / gyár (0.10.0):** a bolt (`shop: true`) polcokon mutatja az árut
  (`shopLayout`/`drawShop`: répa, 3 paradicsom, 3 virsli, 2 uborka) – mindig látszik,
  nincs leülés. Az iroda és a gyár (`work: 'iroda'` / `'gyar'`) asztalokat kap
  (`workLayout`/`drawWork`), és az asztalnál E-vel leülve az iroda nyitott könyvet
  + ceruzát (`drawOpenBook` + `drawItem('ceruza')`), a gyár horgolást (`drawCrochet`:
  fonalgombolyag, horgolótű, félkész darab) mutat. Ezzel mind a hat típusnak van
  berendezett belseje.
- Az **ütközés a típustól független** (a `w`/`h` alaprajz dönt).

## Elvetett alternatívák
- Minden típushoz azonnal külön berendezés: sok munka; lépésenként bővítjük (0.4.0
  lakóház, 0.7.0 iskola).
- Textúra-képek a házakhoz/bútorokhoz: fájl-függőség (ADR-0001 ellen).

## Következmények
- (+) Változatos, kívülről felismerhető város; mind a hat típusnak berendezett a belseje.
- (−) A típusoknak még nincs valódi funkciójuk (a bolt nem ad el; az iskolai könyv
  és a gyári horgolás dísz, nincs kvíz/termelés). A berendezés fix (nem a seedből
  változik) – később bővíthető.
