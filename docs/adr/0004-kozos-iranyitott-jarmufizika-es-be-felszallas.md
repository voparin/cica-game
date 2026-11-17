# ADR-0004: Közös, irányított járműfizika és E-s be-/felszállás

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A játékos autóba és lóra is beszállhat, és GTA-szerűen vezethet. Két külön
jármű-kód duplikáció lenne; a 8 irányú (gyalogos) mozgás járműnek nem elég
természetes.

## Döntés
Egy közös, irányított fizika autóra és lóra:
- `updateVehiclePhysics(v, input, dt)` – `v.speed` (sebesség) és `v.angle` (szög);
  `input.fwd` gyorsít/fékez-hátramenet, `input.turn` forgat; súrlódás lassít.
- `VEH` paraméterek járműtípusonként (`auto`, `lo`): gyorsulás, csúcssebesség,
  fordulékonyság, súrlódás. A ló fürgébb, az autó gyorsabb és lomhább.
- A járművek ütköznek a házakkal (`collideHouses`).
- Be-/felszállás: `player.riding` a jármű; `toggleVehicle()` a legközelebbi
  járműbe szállít (sugáron belül), vagy kiszállít. Vezetés közben a kamera a
  járművet követi (`updateDriving`). Az `E` kontextusfüggő: `onUse()` dönt.

## Elvetett alternatívák
- Külön autó- és ló-kód: duplikáció, nehezebb karbantartás.
- 8 irányú (gyalogos) mozgás járműre is: egyszerűbb, de nem autószerű.

## Következmények
- (+) Egy fizika, kevesebb kód, egyszerű bővítés új járműtípussal (`VEH`-be).
- (−) Új mezők a `player`-en (`riding`); a kamera járműben a járművet követi.
- Nincs AI-forgalom (YAGNI): a járművek csak elérhető (parkoló) járművek.
