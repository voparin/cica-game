# Szofi város – gyalogos, lovak, autók, házak (0.2.0) – terv

- **Dátum:** 2026-11-17
- **Státusz:** Elfogadva

## Cél

A `szofi-game` csonkra (0.1.0) felépíteni a tényleges játékot: felülnézetes,
végtelen, determinisztikusan generált város, ahol a gyalogos játékos az utcákon
jár, lovak és autók érhetők el, és `E` gombbal be lehet menni a házakba, illetve
fel lehet szállni a lóra / beszállni az autóba.

A felhasználó döntései:
- **Nulláról, saját kódként** (nem a gta-game átemelve), tiszta, érthető kóddal.
- Város: **végtelen, generált** (determinisztikusan, képletből).
- Ház belseje: **külön belső szoba** (saját koordináták).
- Járműfizika: **irányított (forgó)** – fel/le gyorsít-fékez, bal/jobb forgat.
- Többjátékos: a jármű/ló **látszik a többieknek**; a házban lét **szerver-módosítás
  nélkül** (a házban lévőt a többiek az ajtónál állva látják).

## Fő rendszerek (a `game.js` bővítése)

### 1. Világ (végtelen, generált) – ADR-0003
- **Utcarács**: vízszintes és függőleges utak `ROAD_SPACING` távolságra. Tiszta
  függvények: `onRoad(x, y)`, `nearestRoad(x, y)`. Nincs világbejárás – mindig
  csak a közeli rácsvonalakat nézzük.
- **Házak**: minden háztömbben determinisztikusan (pozíció-alapú hash `seed`-ből)
  elhelyezett házak. `housesIn(x, y, sugár)` csak a közeli házakat adja vissza.
  Minden ház: téglalap-akadály (ütközés) + egy **ajtó** pont (az út felőli oldalon).
- **Rajzolás és ütközés**: mindig csak a kamera körüli néhány cella
  (`cellsAround`), sosem az egész világ.

### 2. Játékos és mozgás
- **Gyalogos**: 8 irányú mozgás (a mostani csonk alapja), de ütközik a házakkal
  (nem megy át a falon; `pushOutOfRect`). A kamera a játékost követi.
- **Járműfizika (irányított, forgó) – ADR-0004**: közös
  `updateVehiclePhysics(v, input)` az autóra és a lóra: `v.speed`, `v.angle`;
  fel/le gyorsít-fékez, bal/jobb forgat, súrlódás lassít. Az autó gyorsabb és
  lomhább, a ló fürgébb.

### 3. Lovak és autók
- **Determinisztikus elhelyezés**: `horsesIn(…)` / `carsIn(…)` – cellánként
  képletből pár ló és parkoló autó az utak mentén. Nincs AI-forgalom (YAGNI),
  csak elérhető járművek.
- **Be-/kiszállás (E) – ADR-0004**: a legközelebbi járműhöz (sugáron belül) E-vel
  beszállsz: `player.riding = jármű`, az irányítás a járműé, a gyalogos „eltűnik".
  Újra E-vel kiszállsz a jármű mellé. Közös mechanizmus lóra és autóra.

### 4. Házba belépés (E) – külön belső szoba – ADR-0005
- Az ajtóhoz érve E: `player.inHouse = { ház }`, átváltunk egy belső szobára
  (saját koordináták, négy fal, egy kijárati ajtó). A külső világ nem látszik és
  nem frissül közben. Újra E a kijáratnál → vissza a városba, a bejárati ajtó elé.
- A szoba mérete determinisztikus a ház seedjéből (hogy tesztben is egyezzen).

### 5. Többjátékos (látszanak a többieknek)
- A `netState` kiegészül: `car` (járműben van-e), `kind` (`'auto'` / `'lo'` / `''`),
  a szín (`shirt` / `c0`). A szerver `cleanState`-je ezeket **már átengedi**, nem
  kell szerver-módosítás. A `drawOthers` eszerint rajzol (gyalogos / autó / ló).
- **Házban lét**: a szerver `cleanState`-jében nincs erre mező, és nem is veszünk
  fel újat. A kliens házban léte alatt egyszerűen a **bejárati ajtó pozícióját**
  küldi tovább – így a többiek az ajtónál állva látják. Nincs szerver-módosítás,
  nincs új ADR a szerverhez.

## Vezérlők
- **Nyilak**: mozgás / vezetés.
- **E**: kontextusfüggő – ha ajtó közelében: ház be/ki; ha jármű közelében:
  be-/kiszállás. A képernyő tetején rövid súgó-felirat.

## Tesztek (függőség nélkül, a `tests/smoke.test.js` bővítése)
Tiszta függvényeket tesztelünk, nem véletlen szimulációt vagy időzítési szerencsét:
- `onRoad` / `nearestRoad` helyes a rácson;
- `housesIn` determinisztikus (ugyanaz a pozíció → ugyanaz a ház), és a ház ajtaja
  elérhető (az út felőli oldalon);
- E-interakció: a játékos a jármű közelében beszáll (`player.riding` beáll),
  majd kiszáll;
- ház be/ki: `inHouse` beáll és törlődik, a kijárat a bejárati ajtóhoz tesz vissza;
- járműfizika: előre nyíl → nő a `speed`; forgatás → változik az `angle`;
- `netState`: házban a bejárati ajtó pozícióját küldi.

A `tests/server.test.js` változatlan (a szerver nem módosul).

## ADR-ek (új)
- **0003**: Cella-alapú, determinisztikus, generált város (képletből).
- **0004**: Közös, irányított járműfizika (autó + ló) és `player.riding` be-/kiszállás.
- **0005**: Házak belseje külön koordináta-rendszerű szobaként.

## Amit NEM csinálunk most (YAGNI)
Nincs AI-forgalom, rendőrség, benzin, pénz, nappal/éjszaka, hang, küldetés,
fegyver – csak a kért öt dolog (város, gyalogos, lovak+autók, E-s házbelépés,
E-s be-/felszállás). Később bővíthető.

## Ellenőrzés
`node --check game.js`, `node tests/smoke.test.js` (bővített), `node tests/server.test.js`
(változatlanul zöld) – a tényleges kimenet jelentésével. Végül a CI (push a main-re)
és a Pages (`https://voparin.github.io/szofi-game/`) frissülésének ellenőrzése.
