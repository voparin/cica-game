# ADR-0012: Fák (ütközéssel) és kóborló állatok

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A város élőbb legyen: fák a házak mellett, és minden háznál egy kutya vagy macska.
A világ determinisztikus, képletből generált (ADR-0003), ezért ezeknek is a
seedből kell jönniük, és a végtelen világban nem tárolhatunk állapotot házanként.

## Döntés
- **Fák:** `treesIn(cx, cy, r)` – háztömbönként determinisztikusan a seedből, az
  úttól távol; minden fa kör-akadály (`{x, y, r}`). `collideTrees(p, pad)` kitolja
  a gyalogost/járművet (a `collideHouses` mintájára), a középpontban is (akkor
  egy rögzített irányba). Az `updatePlayer` és az `updateVehiclePhysics` hívja.
- **Állatok:** `animalFor(h)` – a ház seedjéből faj (kutya/macska), szín és
  kezdőpont. `animalPose(an, t)` – determinisztikus „séta" a kezdőpont körül, az
  időből (`t`) és a seedből számolva, korlátos távolságon belül (`ANIMAL_ROAM`).
  Nincs házankénti állapot-tárolás; minden kliensnél ugyanaz.

## Elvetett alternatívák
- Tárolt, szabadon kóborló állatok: a végtelen világban követni/menteni kellene
  őket; a seedből számolt „séta" olcsóbb és determinisztikus.
- Fák ütközés nélkül (csak dísz): a felhasználó ütközést kért.

## Következmények
- (+) Élőbb város, nulla tárhely, minden kliensnél egyforma.
- (−) Az állatok nem interaktívak (nem simogathatók), és a mozgásuk „gépies"
  (képletből). A fák ütközése a `treesIn` lekérdezést minden mozgásnál lefuttatja
  (korlátos sugáron, olcsó).
