# Szofi-game váz (scaffold) – terv

- **Dátum:** 2026-11-16
- **Státusz:** Elfogadva

## Cél

A `szofi-game` mappát felszerelni egy fejlesztésre kész vázzal, a `gta-game`
bevált mintáját követve: függőség nélküli, build nélküli, felülnézetes böngészős
játék. A felhasználó most **a GitHub-munkafolyamatot (CI)** és a **többjátékos
mód alapját** kéri – a tényleges játék tartalom (világ, járművek, NPC-k) nem
most készül.

A megrendelő döntései:
- **Teljes tükrözés** a `gta-game`-ről, de a játék kód nélkül.
- `server.js`: a `gta-game` szervere **szó szerint átmásolva** (no-dep WebSocket).
- `game.js`: **minimális, játszható csonk** (mozgatható játékos + `/ws` kapcsolat).
- Repó: `voparin/szofi-game`, GitHub Pages: `voparin.github.io/szofi-game`.
- Nyelv: **magyar** (kommentek, dokumentáció, CI lépésnevek).
- Google Cloud: **külön projekt/szolgáltatás `szofi-game`** (elkülönített Firestore).
- JS fájlnevek: **változatlanok** (`game.js`, `server.js`).

## Fájlszerkezet

```
szofi-game/
├── index.html              # betölti a canvas-t + game.js
├── game.js                 # minimális csonk: mozgatható játékos + /ws kapcsolat
├── server.js               # a gta-game server.js szó szerint átmásolva
├── Dockerfile              # Cloud Run: node:22-slim, server.js + index.html + game.js
├── .dockerignore
├── .gcloudignore
├── .gitignore              # .claude/  .DS_Store  data/
├── CLAUDE.md               # szofi-ra szabott fejlesztési útmutató
├── CHANGELOG.md            # 0.1.0 – váz létrehozva
├── .github/workflows/
│   └── deploy.yml          # teszt → GitHub Pages publikálás
├── docs/adr/
│   ├── README.md           # ADR index
│   ├── template.md         # ADR sablon
│   ├── 0001-bongeszos-jatek-tiszta-html-javascript-canvas.md
│   └── 0002-tobbjatekos-szerver-websockettel.md
└── tests/
    ├── smoke.test.js       # ÚJRAÍRVA a csonkhoz (nem a gta-game 242KB-os)
    └── server.test.js      # a gta-game-ből szó szerint átmásolva
```

## Fő döntések és indoklás

### 1. `server.js` – szó szerint átmásolva
A teljes, függőség nélküli többjátékos szerver: HTTP fájlkiszolgálás, `/ws`
WebSocket (kézzel írt RFC 6455 keretkódoló), a játékosok helyzetének szétküldése
100 ms-enként, Origin-ellenőrzés, fiókok (scrypt + HMAC-jegy), Google-belépés,
PvP harc, Firestore (Cloud Run) / fájltár (helyi). Az alapértelmezett engedélyezett
Pages-origin `https://voparin.github.io` – ez egyezik a `voparin/szofi-game`
repóval, így változtatás nélkül jó.

### 2. `game.js` – minimális játszható csonk
Vászon, nyilakkal mozgatható játékos-négyzet, a többi játékos kirajzolása a
szerverről, és egy valódi `netConnect`/`net` objektum. Ez két okból fontos:
- így a többjátékos mód bizonyíthatóan működik;
- a szerverteszt `includes('netConnect')` állítása átmegy.
A hálózati protokoll megegyezik a `gta-game`-ével (`{t:'state', s:{name,x,y,a,...}}`
→ `{t:'players', list:[...]}`), így a kliens és a másolt szerver kompatibilis.

### 3. `smoke.test.js` – újraírva
A `gta-game` füsttesztje a `game.js`-t egy kamu böngészőkörnyezetben `eval`-eli,
és ~300 játék-szimbólumot vár, amelyek a csonkban nem léteznek. Ezért új,
kicsi füsttesztet írunk, ami a csonk valódi felületét ellenőrzi: a játékos
objektum létrejön, billentyűre mozog, a `netConnect` definiált, és a rajzolás
nem dob hibát.

### 4. `server.test.js` – szó szerint átmásolva
Önálló: közvetlenül WebSocket-klienseket vezérel, a `game.js` tartalmától
független (kivéve két kiszolgálási állítást: `html.includes('game.js')` és a
kiszolgált `game.js` `.includes('netConnect')`). Mindkettőt a csonk teljesíti.
Teszteli: WS-csatlakozás, helyzet-szinkron, Origin-elutasítás, fiókok,
Google-belépés, PvP.

### 5. CI `deploy.yml` – átmásolva (magyar lépésnevek)
Tesztkapu (`node --check` + mindkét teszt) → GitHub Pages publikálás
`?v=SHA` gyorsítótár-törővel.

### 6. `docs/adr`
Friss ADR README + sablon, és két kezdő ADR: 0001 (technológia-választás:
tiszta HTML/JS/Canvas) és 0002 (WebSocket többjátékos mód).

### 7. Google Cloud – külön `szofi-game`
Külön projekt + Cloud Run szolgáltatás + Firestore, mind `szofi-game` néven,
elkülönítve a `gta-game`-től. A tényleges projektet a felhasználó hozza létre
később; a Dockerfile/CLAUDE.md/.gcloudignore és a deploy parancs `szofi-game`-re
van hangolva.

### 8. git init
A repó inicializálása és egy kezdő commit.

## Amit NEM csinálunk (YAGNI)
- Nincs valódi játék tartalom (világ, járművek, NPC-k).
- Nincs tényleges Cloud Run deploy.
- Nincs `git remote` / push.

## Ellenőrzés
A váz elkészülte után: `node --check game.js`, `node --check server.js`, majd
`node tests/smoke.test.js` és `node tests/server.test.js` – a tényleges kimenet
jelentésével.
