# Változásnapló

A verziószám jelentése: nagy.közepes.kicsi (SemVer-szerűen).

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
