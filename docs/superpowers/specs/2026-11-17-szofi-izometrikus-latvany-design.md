# Szofi – 2.5D izometrikus megjelenés (0.3.0) – terv

- **Dátum:** 2026-11-17
- **Státusz:** Elfogadva

## Cél

A `szofi-game` látványának szépítése: **igazi 2.5D izometrikus nézet**, változatos,
többszínű házak szép (felülről-oldalról látszó) tetővel, változatos utcák, és
felismerhető alakú szereplők: **ember-alakú** játékos, **autó-alakú** autó,
**ló-alakú** ló.

A felhasználó döntései:
- Nézet: **2.5D**, **izometrikus rács** (a világ 45°-kal elforgatva vetítve).
- Takarás: **Y-rendezett rajzolás** (fentebb a képernyőn = távolabb = előbb).
- Házak: **többszínűek**, változatosak, szép tetővel.
- Utcák: változatosak.

## Alapelv: mi változik és mi nem

**NEM változik** (ezeket nem nyúljuk): a világ-generálás logikája (`hash32`,
`onRoad`, `nearestRoad`, `housesInBlock`, `vehiclesInCell` – a *pozíciók* és a
*méretek*), a játékmenet-fizika (`updatePlayer`, `updateVehiclePhysics`,
`collideHouses`, be-/felszállás, ház be/ki), a hálózat (`netState`/`netReceive`
protokoll), és a `server.js` + `tests/server.test.js`.

**Változik**: csak a **kirajzolás** (a `worldToScreen` vetítés izometrikussá
tétele, új rajzoló függvények), plusz a generáláskor a házakra **vizuális mezők**
kerülnek (szín, tetőtípus, magasság) – ezek determinisztikusak a ház seedjéből,
és nem befolyásolják az ütközést (az továbbra is a `w`/`h` alaprajzzal számol).

## Izometrikus vetítés

- Új tiszta függvény: `iso(wx, wy, wz)` → képernyő-eltolás a kamerától.
  Klasszikus 2:1 izo: `sx = (wx - wy) * ISO_X`, `sy = (wx + wy) * ISO_Y - wz`.
  A `worldToScreen(x, y)` ezt hívja `wz = 0`-val (a kamera a játékos világ-
  pozíciójára centrál, szintén `iso`-n át).
- `ISO_X`, `ISO_Y` állandók (pl. 0.5 és 0.25 arány), `wz` a magasság (ház/tető).
- A **mozgás a képernyő szerint** (B változat): a nyíl-bemenetet a vetítés inverzével
  forgatjuk, hogy a „fel" a képernyőn felfelé vigyen. Tiszta függvény:
  `screenToWorldDir(dx, dy)` → világ-irány. Így a `updatePlayer` és a vezetés
  bemenete a képernyőhöz igazodik; a tárolt világ-pozíció/szög változatlan marad.

## Y-rendezett rajzolás (takarás)

- A `draw()` minden képkockán összegyűjt egy **rajzlistát**: házak, járművek, a
  többi játékos, a saját játékos – mindegyik a világ-pozíciójával. A listát a
  **vetített képernyő-y (mélység)** szerint rendezi (kisebb y = távolabb = előbb),
  majd sorban kirajzolja. Így a közelebbi dolgok takarják a távoliakat.
- Tiszta, tesztelhető rész: `depthKey(wx, wy)` (a rendezési kulcs), és
  `buildDrawList(...)` (a listát adja vissza, rajzolás nélkül) – ezt teszteljük.

## Házak: változatos, többszínű, tetős (2.5D)

- A `housesInBlock` a meglévő `x, y, w, h, door, seed` mellé determinisztikusan
  ad: `wall` (falszín a seedből egy palettából), `roof` (tetőszín), `roofType`
  (`'nyereg'` / `'sator'` / `'lapos'`), `height` (falmagasság, pár változatban).
  A paletta a fájl tetején `HOUSE_WALLS` / `HOUSE_ROOFS` tömb.
- Új rajzoló: `drawHouse(h)` – az izo-alaprajzból kiemeli a falakat (oldallapok,
  sötétebb árnyalat a takart oldalon), a tetőt a `roofType` szerint (nyeregtető
  gerinccel, sátortető csúcsba futó élekkel, lapostető peremmel), és az ajtót a
  fal megfelelő oldalára. Árnyék a földre (`drawShadow`).

## Utcák: változatos

- `drawStreets()` az izo-rácson: aszfalt sáv, **járdaszegély** a szélén,
  szaggatott **felezővonal**, és a kereszteződésekben eltérő burkolat
  (determinisztikus a kereszteződés rácsindexéből: pl. minden N-edik „téglás").
  Tiszta segéd: `streetStyle(gx, gy)` → a kereszteződés stílusa (ezt teszteljük).

## Szereplők: felismerhető alak

- `drawPerson(sx, sy, a, color, name)` – ember: fej (kör), törzs (téglalap/kabát),
  a `color` a ruha; a `a` szögből a nézési irány (a test kissé elfordul). Árnyék.
- `drawCarSprite(sx, sy, a, color)` – autó: karosszéria (lekerekített test),
  szélvédő, 4 kerék, fényszóró; az `a` szög szerint elforgatva (izo-kompatibilis).
- `drawHorseSprite(sx, sy, a, color)` – ló: test (ovál), 4 láb, nyak + fej, farok;
  az `a` szerint elforgatva.
- A `drawPlayer` helyére `drawPerson` lép; a `drawCity` jármű-rajza és a `draw()`
  others-ága a `drawCarSprite`/`drawHorseSprite`/`drawPerson`-t hívja a `car`/`kind`
  szerint. A belső szoba (`drawInterior`) is a `drawPerson`-t használja a játékosra.

## Tesztek (függőség nélkül, `tests/smoke.test.js` bővítése)

Tiszta függvényeket ellenőrzünk, nem képpontokat:
- `iso` determinisztikus és invertálható a síkban (`iso` majd `screenToWorldDir`
  oda-vissza konzisztens a mozgásirányra);
- `depthKey` monoton: távolabbi világ-pont kisebb kulcsot ad, mint a közelebbi;
- `buildDrawList` a szereplőket és házakat tartalmazza, és **y szerint rendezett**
  (minden elem kulcsa ≤ a következőé);
- a házak vizuális mezői determinisztikusak és a palettából valók
  (`HOUSE_WALLS`/`HOUSE_ROOFS` tartalmazza a `wall`/`roof`-ot; `roofType` a három
  érték egyike; `height` > 0);
- `streetStyle` determinisztikus;
- egy teljes képkocka (város + szereplők + izo) kamu ctx-szel nem dob hibát;
- a meglévő játékmenet-tesztek (mozgás, ütközés, be-/felszállás, ház be/ki,
  netState) **változatlanul** átmennek – a rajzolás nem törheti el őket.

A `tests/server.test.js` változatlan.

## ADR-ek (új)
- **0006**: Izometrikus 2.5D vetítés (a világ (x,y) változatlan, csak a kirajzolás;
  a bemenet a képernyőhöz forgatva).
- **0007**: Y-rendezett (mélység szerinti) rajzolás a takaráshoz.
- **0008**: Házak vizuális változatossága (paletta, tetőtípus, magasság) a seedből,
  az ütközéstől függetlenül.

## Amit NEM csinálunk most (YAGNI)
Nincs textúra-kép (minden vektoros Canvas-rajz, függőség nélkül), nincs animáció
(lábmozgás), nincs nappal/éjszaka fény. A látvány statikus, de szép és változatos.

## Ellenőrzés
`node --check game.js`, `node tests/smoke.test.js` (bővített), `node tests/server.test.js`
(változatlan 58/58). Helyi próba: `node server.js`, böngésző – a város izometrikusan,
színes tetős házakkal, ember/autó/ló alakú szereplőkkel; a takarás helyes. Végül
push → CI → Pages.
