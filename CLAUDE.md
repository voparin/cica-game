# Szofi – fejlesztési útmutató

Felülnézetes, GTA-szerű böngészős játék (induló váz). Tiszta HTML + JavaScript
(Canvas 2D), nincs build lépés és nincs függőség. A `gta-game` bevált mintáját
követi.

- Repó: https://github.com/voparin/szofi-game
- Élő játék (publikálás után): https://voparin.github.io/szofi-game/

## Felépítés

| Fájl | Szerep |
|---|---|
| `index.html` | betölti a canvas-t és a `game.js`-t |
| `game.js` | a játék: 2.5D izometrikus város (utcák, színes tetős házak), ember/autó/ló szereplők, `E`-s interakció (ADR-0001, 0003–0008) |
| `server.js` | többjátékos szerver (ADR-0002): kiszolgálja a játékot, `/ws` – a játékosok helyzete; fiókok, Google-belépés, PvP; függőség nélkül |
| `Dockerfile`, `.gcloudignore` | a szerver a Google Cloud Runra (külön `szofi-game` projekt) |
| `tests/smoke.test.js` | füstteszt kamu böngészőkörnyezetben (Node, függőség nélkül) |
| `tests/server.test.js` | a szerver tesztje két valódi WebSocket-klienssel (Node 22+) |
| `.github/workflows/deploy.yml` | CI: teszt, majd publikálás GitHub Pages-re |
| `CHANGELOG.md` | változásnapló, verziónként |
| `docs/adr/` | architekturális döntések naplója (ADR), lásd: [docs/adr/README.md](docs/adr/README.md) |

## Futtatás helyben

- **Csak a kliens** (egyjátékos): nyisd meg az `index.html`-t böngészőben, vagy
  adj ki egy statikus szervert a mappában.
- **Többjátékos mód helyben:** `node server.js` (alapból a 8080 porton), majd a
  böngészőben `http://localhost:8080`. A fiókok ilyenkor a `data/profiles.json`
  fájlba mentődnek (nincs verziózva, lásd `.gitignore`).

## Vezérlők

- **Nyilak:** gyalogos mozgás; járműben vezetés (fel/le gyorsít-fékez, bal/jobb forgat).
- **E:** kontextusfüggő – ajtó közelében ház be/ki (külön belső szoba), jármű
  közelében be-/felszállás (autó / ló), járműből kiszállás.

## Látvány (2.5D izometrikus, ADR-0006–0008)

- A kirajzolás izometrikus (`iso`, `worldToScreen` magassággal); a világ `(x,y)`
  és a fizika változatlan. A nyíl-bemenet a képernyőhöz igazodik (`screenToWorldDir`).
- A takarás mélység szerint: `buildDrawList` összegyűjti a kamera körüli házakat,
  járműveket és szereplőket, `depthKey` szerint rendezve rajzol. **Új, a világban
  megjelenő dolgot a `buildDrawList`-be is vegyél fel, hogy helyesen takarjon.**
- Házak: `drawHouse` (oldalfalak + tető a `roofType` szerint), színek/magasság a
  seedből (`HOUSE_WALLS`/`HOUSE_ROOFS`/`ROOF_TYPES`); utcák: `drawStreets`.
- Szereplők: `drawPerson` / `drawCarSprite` / `drawHorseSprite` (árnyékkal).

## Tesztek

Függőség nélkül, Node 22+:

```
node --check game.js && node --check server.js
node tests/smoke.test.js
node tests/server.test.js
```

A CI (`deploy.yml`) ugyanezt futtatja a `main`-re tolt minden változásnál, és
csak sikeres teszt után publikál.

## A hálózati protokoll (kliens ↔ szerver)

- A kliens `{ t:'state', s:{ name, x, y, a, shirt, … } }` üzenetben küldi a
  helyzetét (`NET_SEND`-enként). A szerver mindent **szűr** (`cleanState`), a
  kliensre nem bízunk semmit.
- A szerver csatlakozáskor `{ t:'hello', id }`-t küld, majd `TICK_MS`-enként
  `{ t:'players', list:[…] }`-t mindenki helyzetével.
- Fiók nélkül a megjelenített név „Vendég <id>”; belépve a fiók neve.
- Járműben a `netState` a `car: true` és `kind` (`'auto'`/`'lo'`) mezőt is küldi,
  így a többiek járműként látnak. Házban lét alatt a bejárati ajtó pozícióját
  küldjük (a házban lévő a többieknek az ajtónál áll) – nincs szerver-módosítás.

Új, a hálózaton átvitt mezőt a `game.js` `netState`-ben **és** a `server.js`
`cleanState`-ben is fel kell venni, különben a szerver kiszűri.

## Architekturális döntések (ADR)

Minden architekturális döntést a `docs/adr/` mappában naplózunk. Mielőtt egy
meglévő döntéssel ellentétes irányba mennél, olvasd el a vonatkozó ADR-t. Új
döntésnél másold a `docs/adr/template.md`-t a következő sorszámmal, és vedd fel a
`docs/adr/README.md` táblázatába.

---

## Telepítés (egyszeri projekt-beállítás)

### 1. GitHub-repó és automatikus publikálás (GitHub Pages)

1. Hozz létre egy új, üres repót: `voparin/szofi-game` (nyilvános).
2. A helyi mappában (`git init` már megvan):
   ```
   git remote add origin https://github.com/voparin/szofi-game.git
   git push -u origin main
   ```
3. A repó **Settings → Pages** oldalán a *Source* legyen **GitHub Actions**.
4. A `main`-re tolás elindítja a `deploy.yml`-t: előbb teszt, majd publikálás.
   A kész játék: `https://voparin.github.io/szofi-game/`.

A `deploy.yml` a `game.js`-t `?v=<commit>` címkével tölti be, hogy a böngésző ne
a régi, tárolt változatot futtassa.

### 2. Többjátékos szerver a Google Cloud Runon (külön `szofi-game` projekt)

A GitHub Pages statikus: önmagában nincs szerver, így alapból egyjátékos. A
többjátékos módhoz a `server.js` a Google Cloud Runon fut, és a kliens a
`NET_SERVER` címre csatlakozik.

Egyszeri beállítás (`gcloud` CLI kell, belépve: `gcloud auth login`):

```
# 1) új, elkülönített projekt (a gta-game-től független Firestore-ral)
gcloud projects create szofi-game
gcloud config set project szofi-game
# (számlázás bekapcsolása a projekthez a Cloud konzolon)

# 2) a szükséges API-k
gcloud services enable run.googleapis.com firestore.googleapis.com \
  cloudbuild.googleapis.com

# 3) Firestore adatbázis (a fiókok tárolására) – europe-west1
gcloud firestore databases create --location=europe-west1

# 4) a szerver kiadása (a mappából, forrásból építve)
gcloud run deploy szofi-game --source . --region europe-west1 \
  --project szofi-game --allow-unauthenticated --quiet
```

A `gcloud run deploy` a végén kiír egy címet, pl.
`https://szofi-game-XXXXXXXX.europe-west1.run.app`. Ezt két helyen használd:

- **`game.js` → `NET_SERVER`**: a `wss://` változata (pl.
  `wss://szofi-game-XXXXXXXX.europe-west1.run.app`), hogy a GitHub Pages-en is
  legyen többjátékos mód. Commit + push → a Pages frissül.
- A szerver `ALLOWED_ORIGINS` alapértéke `https://voparin.github.io`, ami a
  Pages-címünk – így külön beállítás nélkül jó. Ha máshonnan is engednéd a
  csatlakozást, add meg az `ALLOWED_ORIGINS` környezeti változót a Cloud Run
  szolgáltatáson.

Minden további kiadáshoz (a szerver változásakor) elég a 4. lépés
(`gcloud run deploy …`).

A Cloud Run alvó üzemmódban (min. 0 példány) olcsón fut: ha senki sem játszik,
nem kerül pénzbe.
