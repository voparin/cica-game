# ADR-0002: Többjátékos szerver WebSockettel, függőség nélkül

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A Szofiban több játékos lássa egymást valós időben. A játék tiszta HTML/JS,
build és függőség nélkül (ADR-0001) – a szerverre is ugyanez a követelmény.
A megoldás a `gta-game` bevált szervere, változtatás nélkül átemelve.

## Döntés
A `server.js` a Node beépített `http` és `crypto` moduljaival, külső csomag
nélkül:
- kiszolgálja a játék fájljait (`index.html`, `game.js`);
- a `/ws` címen kézzel írt RFC 6455 WebSocket-keretkezeléssel fogadja a
  játékosokat, és `TICK_MS`-enként szétküldi mindenki helyzetét (`{ t:'players',
  list:[…] }`); csatlakozáskor a kliens a saját azonosítóját kapja
  (`{ t:'hello', id }`);
- a kliens állapotát szigorúan szűri (`cleanState`) – a kliensre nem bízunk semmit;
- Origin-ellenőrzéssel csak a saját címről és az engedélyezett GitHub Pages
  oldalról enged csatlakozni (`ALLOWED_ORIGINS`);
- fiókokat kezel (regisztráció/belépés/jegy, `scrypt` + HMAC), tárolás Firestore
  (Cloud Run) vagy helyi JSON-fájl (`data/`);
- Google-fiókos belépést ellenőriz (RS256 ID-token, függőség nélkül);
- játékosok közötti harcot közvetít korlátokkal (`hit` / `frag`).

A kliens oldalon a `net` objektum és a `netConnect` / `netReceive` / `netState`
/ `updateNet` függvények valósítják meg ugyanezt a protokollt. A statikus GitHub
Pages-en nincs saját szerver: ott a `NET_SERVER` felhős címre kell csatlakozni,
ha meg van adva; különben a játék egyjátékos marad.

A szervert a `tests/server.test.js` két valódi WebSocket-klienssel teszteli
(Node 22+ beépített `WebSocket`), függőség nélkül.

## Elvetett alternatívák
- `ws` / Socket.IO npm-csomag: kényelmesebb, de függőség és build kellene (ADR-0001 ellen).
- WebRTC / P2P: nincs tekintélyes (authoritative) szerver, nehezebb a csalás elleni védelem.

## Következmények
- (+) Egyetlen fájl, nulla függőség; a Cloud Runon alvó üzemmódban olcsón fut.
- (+) A szerver a tekintélyes forrás: a kliens adatait szűri, a nevet a fiók adja.
- (−) Az RFC 6455 keretkezelést és a token-ellenőrzést magunknak kell karbantartani.
- Felhős üzemeltetés: külön `szofi-game` Google Cloud projekt/szolgáltatás
  (elkülönített Firestore), lásd a CLAUDE.md telepítési szakaszát.
