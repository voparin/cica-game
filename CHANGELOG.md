# Változásnapló

A verziószám jelentése: nagy.közepes.kicsi (SemVer-szerűen).

## 0.3.2 – 2026-11-17

- 2× szélesebb úttest (`ROAD_HALF`).
- Az autók 2× akkorák, és a talajon fekve, menetirányba forgatva rajzolódnak
  (`vehicleQuad` + talaj-sík izometrikus vetítés) – nincs több „dőlt" jármű.
- A ló is a talajon áll (ugyanaz a vetítés), nem dől.
- A korábbi `rotate+scale` megoldás nyírta a sprite-ot (ez okozta a dőlést);
  helyette minden jármű-sarkot a világban forgatunk, majd izometriába vetítünk.

## 0.3.1 – 2026-11-17

Látvány- és járműjavítások (a felhasználó jelzései alapján):

- A járművek az izometrikus szögük szerint állnak (`isoAngle`), nem „fejjel lefelé".
- Nagyobb autó- és ló-sprite-ok, arányos árnyékkal.
- A játékos látszik a lovon és az autóban (a rajzlista a járművet ÉS a rajta ülő
  személyt is tartalmazza; a többi játékoson is látszik, amin ül).
- A járművek ott maradnak, ahol leszálltunk, és a hely mentődik (localStorage,
  ADR-0009); egy elvezetett jármű az új helyén is megtalálható be-/felszálláshoz.

## 0.3.0 – 2026-11-17

Látvány: 2.5D izometrikus nézet (a játékmenet változatlan):

- Izometrikus vetítés (ADR-0006): `iso`, `worldToScreen` magassággal; a nyilak a
  képernyőhöz igazodnak (`screenToWorldDir`).
- Mélység szerinti takarás (ADR-0007): `buildDrawList` + `depthKey` – a házak,
  járművek és szereplők helyesen fedik egymást.
- Változatos, többszínű házak (ADR-0008): falszín/tetőszín paletta, 3-féle tető
  (nyereg/sátor/lapos), magasság; az ütközés változatlan (a `w`/`h` alaprajz).
- Változatos utcák izometrikusan (`drawStreets`, `streetStyle`).
- Felismerhető szereplők: ember/autó/ló alakú sprite-ok árnyékkal (`drawPerson`,
  `drawCarSprite`, `drawHorseSprite`).
- A fizika, a hálózat és a `server.js` érintetlen (`server.test.js` 58/58).

## 0.2.0 – 2026-11-17

A tényleges játék első rétege (nulláról, függőség nélkül):

- Végtelen, determinisztikusan generált város: utcarács és házak, mindig csak a
  kamera körüli cellák (ADR-0003: `hash32`, `onRoad`, `nearestRoad`, `housesIn`).
- Gyalogos játékos házütközéssel (`pushOutOfRect`, `collideHouses`).
- Elérhető lovak és autók az utak mentén (`vehiclesIn`).
- Közös, irányított járműfizika autóra és lóra (ADR-0004: `updateVehiclePhysics`,
  `VEH`); `E`-vel be-/felszállás (`toggleVehicle`), vezetés a nyilakkal.
- `E`-vel belépés a házakba külön belső szobába, kijárat `E`-vel (ADR-0005:
  `enterHouse`, `leaveHouse`, `updateInterior`, `drawInterior`).
- Többjátékos: a jármű/ló látszik a többieknek (`car`/`kind` a `netState`-ben);
  házban lét alatt a bejárati ajtó pozíciója utazik (szerver-módosítás nélkül).
- Vezérlő-súgó a HUD-on; új ADR-ek (0003–0005).

## 0.1.0 – 2026-11-17

A projekt váza létrehozva (a `gta-game` mintájára, függőség nélkül, build nélkül):

- `index.html` + `game.js`: minimális játék-csonk – nyilakkal mozgatható játékos,
  a többi játékos kirajzolása a szerverről (ADR-0001).
- `server.js`: függőség nélküli többjátékos WebSocket-szerver, fiókokkal,
  Google-belépéssel és PvP-vel (ADR-0002).
- `tests/smoke.test.js`: füstteszt a csonkhoz (kamu böngészőkörnyezet, Node).
- `tests/server.test.js`: a szerver tesztje két valódi WebSocket-klienssel.
- `.github/workflows/deploy.yml`: CI – teszt, majd publikálás GitHub Pages-re.
- `Dockerfile`, `.gcloudignore`: a szerver a Google Cloud Runra (külön `szofi-game`
  projekt).
- `docs/adr/`: architekturális döntések naplója.
