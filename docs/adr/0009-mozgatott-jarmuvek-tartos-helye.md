# ADR-0009: Mozgatott járművek tartós helye (kivétel a determinisztikus világ alól)

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A világ determinisztikus, képletből generált (ADR-0003): a járművek is a
kereszteződés rácsindexéből számolódnak (`vehiclesInCell`). Emiatt, amikor a
játékos elvezetett egy járművet és leszállt, a következő képkockán a `vehiclesIn`
újra a formula-helyen hozta létre – a jármű „visszaugrott". A felhasználó azt
kérte, hogy a jármű ott maradjon, ahol leszállt, és ez újratöltés után is maradjon.

## Döntés
Egyetlen kivétel a változatlan, képletből számolt világ alól (mint a gta-game-ben
a lerombolt házak): a **mozgatott járművek** tartós helye.
- `movedVehicles` (Map: formula-ID → `{x, y, angle, speed, kind, color}`).
- Leszálláskor (`toggleVehicle`) a jármű aktuális állapota ide kerül, és
  `saveVehicles()` localStorage-ba írja (`szofi.vehicles`). Indításkor
  `loadVehicles()` visszaolvassa.
- A `vehiclesInCell` a formula-pozíció helyett a mozgatott helyet adja, ha van
  bejegyzés az adott ID-hez.
- A `vehiclesIn` a formula-cellák mellett a `movedVehicles` bejegyzéseket is nézi,
  mert egy elvezetett jármű más cellába sodródhat, mint amiben a formula-ID-je
  iterál (különben a saját új helyén nem lenne megtalálható be-/felszálláshoz).

## Elvetett alternatívák
- Csak a munkamenetig megjegyezni (nincs mentés): egyszerűbb, de a felhasználó
  tartós helyet kért.
- A járművek azonosítása pozíció szerint: a mozgatás után elveszne a kapcsolat a
  formula-cellával; a stabil formula-ID tisztább.

## Következmények
- (+) A járművek ott maradnak, ahol hagytuk, újratöltés után is.
- (−) Ez az első tartós, nem képletből jövő világállapot; a mentés nőhet, ha sok
  járművet mozgatunk (ID-nként egy kis rekord). Később érdemes lehet korlátozni a
  tárolt bejegyzések számát.
