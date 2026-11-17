# Cica game – állatok a házon kívül, fára mászó macska, ugató kutyák (0.6.0) – terv

- **Dátum:** 2026-11-17
- **Státusz:** Elfogadva

## Cél

- **Hiba:** a kutyák/macskák rámásznak a házak falára – ezt javítani (az állatok
  ne kerüljenek a ház alaprajzába).
- **Macska a fán:** a macskák időnként felmásznak a legközelebbi fára (a lombnál
  látszanak), majd lejönnek.
- **Kutya-ugatás:** ha két kutya közel kerül egymáshoz, egy „Vau!" buborék jelenik
  meg felettük (csak vizuális, nincs hang).

## Felhasználói döntések
- Az állatok a házból kiszorítva kóboroljanak.
- A macska a legközelebbi fára mászik, és a **lombnál** (a fa tetején) látszik.
- A kutya „Vau!" buborékot kap, ha egy másik kutya közel van. Nincs hang.

## A) Bug: állatok ne menjenek a házba

**Gyökérok:** az állat kezdőpontja (`hx = h.x + h.w/2 + 26`) túl közel van a házhoz,
és a kóborlási sugár visszanyúlik a ház alaprajzába (igazolva: egy kutya x-tartománya
átfedi a ház x-tartományát), ezért a falon „mászik".

**Javítás:**
- Minden állat ismerje a **saját házát**: `animalFor(h)` eltárolja `an.house = { x, y, w, h }`.
- Az `animalPose` kiszámolja az alap-pozíciót, majd a **meglévő `pushOutOfRect`-tel**
  (a játékoséval azonos logika) kiszorítja a ház téglalapjából, kis ráhagyással.
  Így az állat soha nem kerül a házba/falra.
- Tesztelhető: `animalPose` eredménye a ház téglalapján kívül van, minden `t`-re.

## B) Macska a fán

- `animalFor` a macskához eltárolja a **legközelebbi fát** (`treesIn` a kezdőpont
  körül): `an.tree = { x, y } | null`.
- Az `animalPose` az időből + seedből determinisztikus fázisban `onTree: true`
  állapotba kerül (ciklus: kóborol → fent a fán → lejön). Fenn a pozíció a fa
  helye; a rajz a **lombnál** (feljebb) jelenik meg. Ha nincs közeli fa, végig
  kóborol. Kutyánál `onTree` sosem igaz.

## C) Kutya „Vau!" buborék közelségre

- `animalsIn` kiszámolja a közeli állatok pillanatnyi helyét; ha **két kutya**
  távolsága egy küszöb (`BARK_RANGE`, pl. 130px) alatt van, mindkettőt megjelöli
  `barking: true`-val, és egymás felé fordítja. Determinisztikus (a pozíciókból),
  nincs tárolás.
- A `drawAnimal` a kutya fölé kis fehér **„Vau!" buborékot** rajzol, ha `barking`.

## Rajz
- Fán ülő macska: a `drawCity` a `onTree` esetén a lomb magasságában rajzolja;
  a rajzlista kulcsa a pozícióból jön (helyes takarás).
- „Vau!" buborék: kis fehér buborék + „Vau!" a kutya fölött.

## Tesztek (függőség nélkül, `tests/smoke.test.js`)
- `animalPose` eredménye a **ház téglalapján kívül** (több seed, több `t`) – a
  bug-fix regresszió-védelme.
- A macska `animalPose`-ja időnként `onTree: true`, és akkor a pozíció a fánál van;
  kutyánál soha nincs `onTree`.
- `animalsIn`: ha két kutya közel van, mindkettő `barking: true`; ha távol, egyik sem.
- `drawAnimal` a `barking`/`onTree` jelzőkkel nem dob hibát.
- A meglévő állat-tesztek (fajspecifikus mozgás, fáziseltolás, korlátos távolság)
  és a `server.test.js` (59/59) változatlanul zöldek.

## ADR
- A **0012** (fák és állatok) bővítése: az állat a házból kiszorítva kóborol;
  macska fára mászás; kutya-ugatás közelségre – determinisztikus, tárolás nélkül.

## Amit NEM csinálunk most (YAGNI)
Nincs hang. Az ugatás/fán-ülés nem utazik külön a hálózaton (determinisztikus, így
a kliensek úgyis egyeznek). Az állatok nem interaktívak (nem simogathatók).

## Ellenőrzés
`node --check game.js`, `node tests/smoke.test.js`, `node tests/server.test.js`
(59/59). Helyi próba: `node server.js`, böngésző – az állatok a házak mellett
kóborolnak (nem a falon); a macskák időnként a fák tetején ülnek; két közeli kutya
fölött „Vau!" buborék. Végül push → CI → Pages.
