# Változásnapló

A verziószám jelentése: nagy.közepes.kicsi (SemVer-szerűen).

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
