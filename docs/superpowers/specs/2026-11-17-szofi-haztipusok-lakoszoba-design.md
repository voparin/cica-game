# Szofi – háztípusok és berendezett lakószoba (0.4.0) – terv

- **Dátum:** 2026-11-17
- **Státusz:** Elfogadva

## Cél

Hatféle háztípus (lakóház, gyár, iskola, iroda, bolt, étterem), mindegyiknek
ajtóval, és kívülről is megkülönböztethetően. A lakóház belseje egy konkrétan
berendezett szoba; a másik öt típus belseje egyelőre egyszerű, a típus nevével
kiírva (a lakóházra nincs felirat).

A felhasználó döntései:
- A háztípus **kívülről is látszik** (ikon/szín/jel az ajtó fölött vagy a tetőn).
- Most **csak a lakóház** belsejét rendezzük be részletesen.
- A másik öt típus belseje egyszerű szoba, középen a típus nevével kiírva.
- A **lakóházra nincs felirat** bent.
- Elrendezés: **ágy bal oldalon**, **szekrény jobb oldalon**, **szőnyeg középen**.

## 1. Háztípusok (`housesInBlock` bővítése)

- Minden ház determinisztikusan kap egy `type` mezőt a seedből:
  `lakohaz` | `gyar` | `iskola` | `iroda` | `bolt` | `etterem`.
  A lakóház a leggyakoribb (~50%), a másik öt osztozik a maradékon.
  Tiszta függvény: `houseType(seed)`.
- Kívülről megkülönböztethető: típusonként jellemző **jel** (kis vektoros ikon
  vagy 1–2 betűs tábla) az ajtó fölött/tetőn, és/vagy eltérő hangsúlyszín. A
  `drawHouse` a `type` szerint rajzolja a jelet (a meglévő falak+tető fölé).
- Az **ajtó** mindegyiken megvan (változatlan logika).
- A `type` **nem** befolyásolja az ütközést (az továbbra is a `w`/`h` alaprajz).

## 2. Belső szoba típus szerint (`enterHouse` / `drawInterior`)

- Belépéskor a szoba a ház `type`-ja szerint rendeződik. Tiszta leíró:
  `roomFor(type)` → a berendezés (lakóház) vagy a felirat (többi).
- **Lakóház**: a berendezett szoba, felirat nélkül.
- **A másik öt**: egyszerű szoba, középen a típus magyar neve kiírva
  (`Gyár` / `Iskola` / `Iroda` / `Bolt` / `Étterem`). A fal/padló színe lehet
  típusfüggő, hogy ne legyen egyforma.

## 3. Lakószoba berendezése (felülnézetes szoba)

A `drawInterior` a szoba téglalapjába rajzolja (vektorral, függőség nélkül):
- **Bal oldal**: ágy (keret + párna + takaró).
- **Közép, padló**: szőnyeg (színes, mintás téglalap).
- **Jobb oldal**: szekrény (téglalap), és fölé/alá rajzolva:
  - **felül** (a szekrény tetején): 3 könyv (3 színes gerinc egymás mellett),
    **mellette** egy társas (kis négyzet rácsmintával);
  - **alul** (a szekrény alatt a padlón): 1 könyv, 3 színes ceruza (3 vékony
    színes vonal), és egy maci (fej + has körökből, kis fülek).
- A játékos (ember-sprite) és a kijárat (E) változatlan.

## 4. Tesztek (függőség nélkül, `tests/smoke.test.js`)

- `houseType(seed)` determinisztikus és a hat érték egyike; sok seeden a lakóház
  a leggyakoribb.
- `housesIn` minden háznak ad `type` mezőt (a hat érték egyike).
- `roomFor('lakohaz')` a berendezés-listát adja (tartalmaz ágyat, szőnyeget,
  szekrényt, macit); `roomFor('gyar')` stb. a feliratot adja; determinisztikus.
- `drawInterior` kamu ctx-szel nem dob hibát a lakóházra ÉS mind az 5 másik
  típusra; a típus-jeles `drawHouse` sem dob.
- A meglévő tesztek (ház be/ki, be-/felszállás, netState, járművek) változatlanul
  zöldek; `tests/server.test.js` 58/58.

## 5. ADR
- **0010**: Háztípusok a seedből (`houseType`), kívül jellel, belül berendezéssel;
  a lakószoba berendezés-leírása; az ütközés a típustól független.

## Amit NEM csinálunk most (YAGNI)
A típusoknak nincs funkciójuk (a bolt nem ad el, az iskola nem tanít) – csak a
kinézet. A másik öt belseje egyelőre felirat. Nincs textúra-kép (minden vektor).

## Ellenőrzés
`node --check game.js`, `node tests/smoke.test.js` (bővített), `node tests/server.test.js`
(58/58). Helyi próba: `node server.js`, böngésző – a házakon látszik a típus;
lakóházba lépve a berendezett szoba (felirat nélkül), a többibe lépve a típus
neve. Végül push → CI → Pages.
