# Cica game – iskola-belső (padok, leülés, nyitott könyv) – terv (0.7.0)

- **Dátum:** 2026-11-18
- **Státusz:** Elfogadva

## Cél

Az iskola (háztípus) belseje kapjon berendezést: padok sorban, egy tábla a terem
elején, és ha a játékos E-vel leül egy padhoz, előtte megjelenik egy **nyitott
könyv** az eddig tanult betűkkel: **A O I M E**.

## Felhasználói döntések
- Padhoz E → **leülés + nyitott könyv** (újra E-vel felállás).
- **4–6 pad** rácsban, bármelyikhez le lehet ülni.
- **Tábla** a terem elején (dísz).
- A könyv lapjain a konkrét betűk: **A O I M E**.

## Szoba-típus kezelése
- `roomFor('iskola')` → `{ furnished: false, label: 'Iskola', school: true }`.
  (A `furnished` a lakószobát jelenti; az iskola külön ág a `school` jelzővel.)
- A `enterHouse` már eltárolja a `type`-ot és a `room`-ot – nincs több dolga.
- A többi típus (gyár, iroda, bolt, étterem) marad feliratos.

## Iskolaterem-elrendezés (egy forrásból, mint a `bedroomLayout`)
- `schoolLayout(rw, rh)` tiszta függvény: 4–6 **pad** rácsban (determinisztikusan a
  méretből), egy **tábla** (`board`) a felső falnál, és a `exit` (kijárat). Ebből
  rajzol a rajz ÉS ebből számol az interakció – egyetlen forrás.

## Rajz: `drawSchool(ox, oy, rw, rh)`
- Tábla a felső falon (sötétzöld + pár krétavonal).
- Padok (barna asztal + ülőke) a rácsban.
- Ha a játékos padnál ül (`player.sitting != null`), elé egy **nyitott könyv**:
  két fehér lap, középen gerinc, a lapokon az **A O I M E** betűk.
- A `drawInterior` az `iskola` (school) esetben a `drawSchool`-t hívja (a feliratos
  ág helyett).

## Interakció (E, az `onUse` iskolaág)
- Ha `room.school`: a legközelebbi **padhoz** érve E → `player.sitting = padindex`
  (a játékos a padhoz ül); újra E → feláll (`sitting = null`). A **kijáratnál** E →
  kilépés. Ülés közben a mozgás szünetel (mint az alvásnál), amíg fel nem áll.

## Többjátékos
- A padnál ülés a házon belül van → a többiek az ajtónál állva látnak (ADR-0005).
  Nincs új hálózati mező (YAGNI).

## Tesztek (függőség nélkül, `tests/smoke.test.js`)
- `roomFor('iskola')` a `school: true` jelzőt adja; `furnished` hamis.
- `schoolLayout(rw, rh)`: 4–6 pad, mind a szobán belül; van `board` és `exit`.
- Interakció: a padnál E → `player.sitting` a legközelebbi padra áll; újra E →
  feláll; a kijáratnál E → kilép.
- `drawSchool` / `drawInterior` az iskolára nem dob hibát (ülve és állva).
- A meglévő tesztek (lakószoba, netState, állatok) és a `server.test.js` (59/59)
  változatlanul zöldek.

## ADR
- A **0010** (háztípusok és berendezett lakószoba) bővítése: az iskola is
  berendezett belsőt kap (padok, tábla, leülés + nyitott könyv `A O I M E`
  betűkkel), a `schoolLayout`/`drawSchool` mintájára; a többi típus feliratos marad.

## Amit NEM csinálunk most (YAGNI)
Nincs tananyag/kvíz (a könyv dísz, fix betűkkel), nincs tanár-NPC, nincs hang, a
padnál ülés nem utazik külön a hálózaton.

## Ellenőrzés
`node --check game.js`, `node tests/smoke.test.js`, `node tests/server.test.js`
(59/59). Helyi próba: `node server.js`, böngésző – lépj be egy iskolába (IS tábla
az ajtó fölött); padok és tábla; ülj le E-vel egy padhoz → nyitott könyv `A O I M E`
betűkkel; E-vel felállás, a kijáratnál E-vel kilépés. Végül push → CI → Pages.
