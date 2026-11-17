# ADR-0011: Házrajz javítás (csak a kamera felőli falak) és nagy ajtó

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A házak átlátszónak tűntek: a `drawHouse` mind a négy oldalfalat kirajzolta fix
sorrendben, és izometrikus nézetben a két „hátsó" fal átfestette a két elülsőt.
Emellett a ház ajtaja túl kicsi volt, nem volt egyértelmű, hol lehet belépni.

## Döntés
- Csak a **két kamera felőli oldalfalat** rajzoljuk (`visibleWalls()` → `['ny','nx']`,
  hátulról előre), majd a tetőt – így a ház tömör, nem átlátszó.
- Minden laphoz vékony sötét **körvonal** (`stroke`), hogy elváljanak az élek.
- A ház **ajtaja nagy, keretes** (világos keret + sötét ajtólap + kilincs) a front
  (ny) falon, hogy messziről egyértelmű legyen a bejárat.

## Elvetett alternatívák
- Mind a négy fal kirajzolása: ez okozta az átlátszóságot.
- Teljes z-buffer / mélységi takarás pixelenként: túl bonyolult egy 2D Canvas-hoz.

## Következmények
- (+) Tömör, hihető házak, egyértelmű ajtóval.
- (−) A látható falak a kamera fix (−x,−y) irányára épülnek; ha a nézet valaha
  forogna, a `visibleWalls`-t frissíteni kellene.
