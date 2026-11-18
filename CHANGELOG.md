# Változásnapló

A verziószám jelentése: nagy.közepes.kicsi (SemVer-szerűen).

## 0.12.0 – 2026-11-18

- A kutyák élethűbbek: valódi 4 lábú forma (test, fej, fülek, farok) láb-animációval,
  és céltudatosan kocognak, meg-megállva szaglászni (nem cikcakkoznak).
- A lovak Szilaj-szerűek: ívelt nyak, sörény és farok, 4 láb ügetés-animációval,
  ami a haladáshoz igazodik (állóban nem lép).
- Az autó rendes kabrió: látható eleje (motorháztető) és mind a négy oldala,
  nyitott utastér két üléssel, szélvédővel, kerekekkel, fényszóróval.

## 0.11.0 – 2026-11-18

- A speciális épületeken (gyár, iskola, iroda, bolt, étterem) a típus **teljes
  neve** (rövidítés nélkül) és egy **ikon** látszik kívül (az ajtó fölötti táblán)
  és belül is (fejléc a szoba tetején).
- A lakóházak vizuálisan elkülönülnek: kisebbek/alacsonyabbak, meleg-pasztell
  falszínek, **kémény + kis kertkapu**; a speciális épületek nagyobbak, hűvös
  palettából, lapos tetővel.

## 0.10.1 – 2026-11-18

- A többjátékos szerver kint van a Google Cloud Runon (projekt `cica-game`, régió
  `europe-west1`), Firestore-adatbázissal. A `game.js` `NET_SERVER`-je a felhős
  `wss://` címre mutat, így a GitHub Pages-en is működik a többjátékos mód.

## 0.10.0 – 2026-11-18

- Bolt: a polcokon mindig látszik az áru – répa, 3 paradicsom, 3 virsli, 2 uborka
  (nincs leülés, csak kijárat E-vel).
- Iroda: asztalok; az asztalhoz E-vel leülve egy nyitott könyv és egy ceruza van előtted.
- Gyár: asztal + szék; az asztalhoz E-vel leülve horgolni lehet (fonalgombolyag,
  horgolótű, félkész darab).
- Ezzel mind a hat háztípusnak (lakóház, iskola, étterem, bolt, iroda, gyár) van
  berendezett belseje.

## 0.9.0 – 2026-11-18

- Az étterem belseje berendezett: 3-4 asztal. Az asztalhoz érve E-vel leülsz, és
  megjelenik előtted a terítés: hús a tányéron, egy répa és egy pohár víz; újra
  E-vel felállsz, a kijáratnál E-vel kilépsz.
- A maradék típus (gyár, iroda, bolt) belseje továbbra is a típus nevével.

## 0.8.0 – 2026-11-18

- A felvett tárgyat (könyv, ceruza, társas, maci) E-vel bárhol le lehet tenni a
  földre; ott marad, és bárki (bármelyik játékos) felveheti.
- A letett tárgyak **megosztottak és mentettek**: a szerver közös listában tartja
  (`drop`/`take`/`items` üzenetek), korláttal (max. 300) és letétel-ráta-korláttal;
  a lista a store-ba mentődik (túléli az újraindulást) – ez a szerver első közös
  világállapota (ADR-0014).
- Offline (GitHub Pages, nincs szerver): a letett tárgyak helyben, localStorage-ban.
- Kint, ha nálad van tárgy, az E először leteszi; üres kézzel a közeli tárgyat felveszed.

## 0.7.0 – 2026-11-18

- Az iskola belseje berendezett: padok rácsban (4–6) és egy tábla a terem elején.
- A padhoz E-vel leülve egy nyitott könyv jelenik meg az eddig tanult betűkkel
  (A O I M E); újra E-vel felállás, a kijáratnál E-vel kilépés.
- A többi speciális típus (gyár, iroda, bolt, étterem) belseje továbbra is a típus
  nevével. A fizika/hálózat/szerver változatlan.

## 0.6.0 – 2026-11-17

- Az állatok nem mennek a házba (a háztól egy sima, egyoldali korláttal kint
  maradnak) – nincs több falramászás.
- A macskák időnként felmásznak a legközelebbi fára, és a lomb tetején ülnek,
  majd lejönnek (determinisztikus ciklus).
- Két közeli kutya fölött „Vau!" buborék jelenik meg, és egymás felé fordulnak
  (csak vizuális, nincs hang).

## 0.5.2 – 2026-11-17

- Az ajtók a fal síkjában fekszenek (izometrikus `doorQuad`), nem állnak ki
  billboardként.
- A tetők nem üresek: gerinc, cserépsorok és élek rajzolódnak a tetőlapokra
  (nyereg/sátor/lapos). A `shade` most világosítani is tud (0..255 közé vágva).
- Az állatok fajuknak megfelelően és eltérő fázissal mozognak: a macskák lassan,
  kis körzetben, meg-megállva; a kutyák fürgébben, nagyobb körben; a seedből vett
  fáziseltolás miatt már nem mozog mindegyik egyszerre.

## 0.5.1 – 2026-11-17

- Házrajz-javítás: a házak mostantól a **kamera felőli** (elülső) falakkal
  rajzolódnak, így nem néznek ki féloldalasnak/kinyitott könyvnek (a korábbi kód a
  kamerától elfelé néző falakat rajzolta). A tető is ehhez igazodik.
- Az ajtó a **valódi bejárat** (`h.door`) oldalán jelenik meg: ha elöl van, a nagy
  ajtó oda kerül; ha hátul (nem látható), egy sárga „bejárat" nyíl mutat rá, így
  egyértelmű, hova kell állni az E-hez.

## 0.5.0 – 2026-11-17

- A házak tömörek (nem átlátszók): csak a kamera felőli falak + körvonal (ADR-0011);
  a ház ajtaja nagy és egyértelmű.
- Fák a házak mellett, ütközéssel (ADR-0012): nem lehet átmenni rajtuk.
- Minden háznál egy kóborló kutya vagy macska (a háza körül, a seedből + időből).
- Szoba-interakciók (ADR-0013): az ágynál E-vel lefekvés (rövid alvás, elsötétül,
  majd felébred), a szekrénynél E-vel tárgy felvétele (a kézben látszik, kint is),
  az ajtónál E-vel kilépés (nagy, feliratos kijárat).
- A kézben tartott tárgy és az ágyban fekvés a többi játékosnak is látszik: a
  `netState`/`cleanState` most `hold` és `bed` mezőt is visz (**a szerver bővült**,
  a `server.test.js` is).

## 0.4.0 – 2026-11-17

- Hatféle háztípus a seedből (ADR-0010): lakóház, gyár, iskola, iroda, bolt,
  étterem; mindegyiknek ajtaja. A speciális típusok kis táblát kapnak az ajtó
  fölött (GY/IS/IR/BOLT/ÉT), így kívülről is megkülönböztethetők.
- A lakóház belseje berendezett (felirat nélkül): bal oldalon ágy, középen
  szőnyeg, jobb oldalon szekrény; a szekrény tetején 3 könyv + egy társas, alatta
  a padlón egy könyv, 3 színes ceruza és egy maci.
- A másik öt típus belseje egyszerű szoba, középen a típus nevével.
- Az ütközés, a fizika és a hálózat változatlan.

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
- `Dockerfile`, `.gcloudignore`: a szerver a Google Cloud Runra (külön `cica-game`
  projekt).
- `docs/adr/`: architekturális döntések naplója.
