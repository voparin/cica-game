# ADR-0001: Böngészős játék tiszta HTML + JavaScript (Canvas 2D) alapon

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A Cica game egy felülnézetes, GTA-szerű böngészős játéknak indul, hobbiprojektként.
A cél a gyors, telepítés nélküli kipróbálhatóság, a már bevált `gta-game` mintáját
követve.

## Döntés
A játék egyetlen `index.html` + `game.js` párosból áll, a Canvas 2D API-t
használja, nincs build lépés, nincs npm-függőség. Megnyitható dupla kattintással,
és statikus tárhelyen (GitHub Pages) futtatható. A hibákat Node-ban futó füstteszt
(`tests/smoke.test.js`) fogja meg, szintén függőség nélkül.

## Elvetett alternatívák
- Phaser 3 / Vite + TypeScript: kész fizika, de build lépés és függőségek kellenek.
- Godot 4 / Unity: 3D lehetőség, de nem fut azonnal a böngészőben, nagyobb belépési küszöb.

## Következmények
- (+) Nulla telepítés, azonnali kipróbálás, egyszerű publikálás GitHub Pages-re.
- (−) Fizikát, ütközést, kamerát magunknak kell megírni.
- (−) Típusellenőrzés nincs; a füstteszt fogja meg a hibákat.
