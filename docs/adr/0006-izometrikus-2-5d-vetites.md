# ADR-0006: Izometrikus 2.5D vetítés

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
A felhasználó szép, mélységérzetes látványt kért (házak oldalfallal és tetővel).
A tiszta felülnézet ezt nem adja; a teljes 3D túl nagy ugrás lenne egy függőség
nélküli Canvas-játékban.

## Döntés
2.5D izometrikus vetítés, a kirajzolásban (a játékmenet változatlan):
- `iso(wx, wy, wz)` – 2:1 izometria: `sx = (wx-wy)*ISO_X`, `sy = (wx+wy)*ISO_Y - wz`;
  a `wz` (magasság) felfelé tol.
- `worldToScreen(x, y, z)` a kamerát a játékosra centrálja (szintén `iso`).
- A világ `(x, y)` koordinátái és a fizika VÁLTOZATLANOK; csak a vetítés izometrikus.
- A bemenet a képernyőhöz igazodik: `screenToWorldDir(dx, dy)` az izo inverze,
  így a nyilak a képernyő szerint mozgatnak (fel = a képernyőn felfelé).

## Elvetett alternatívák
- Tiszta felülnézet: egyszerű, de lapos, nincs mélység.
- Valódi 3D (WebGL): szebb lehet, de függőség/összetettség, nem fér a keretbe.

## Következmények
- (+) Mélységérzet, látszó oldalfalak és tetők, GTA-szerű izo-város.
- (−) A bemenetet forgatni kell; a rajz drágább (sokszögek); a takaráshoz rendezés
  kell (ADR-0007).
