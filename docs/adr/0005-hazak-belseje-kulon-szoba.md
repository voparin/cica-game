# ADR-0005: Házak belseje külön koordináta-rendszerű szobaként

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-17

## Kontextus
`E`-vel be lehet menni a házakba. Kérdés, mi történjen bent: csak egy felirat,
vagy egy valódi, bejárható tér. A felhasználó külön belső szobát kért.

## Döntés
`player.inHouse` egy külön koordináta-rendszerű szoba:
- a belépés (`enterHouse(h)`) a ház seedjéből determinisztikus méretű szobát ad
  (`rw`, `rh`), egy kijárattal (`exit`) és a bejárat visszatérési pontjával (`back`);
- a szobában a játékos külön koordinátákkal mozog (`player.ix`, `player.iy`),
  a falakon belül; a külső világ nem frissül és nem látszik (`updateInterior`,
  `drawInterior`);
- a kijáratnál `E` (`leaveHouse`) visszatesz a bejárati ajtó elé.
- Többjátékos: a házban léthez nincs szerver-oldali mező. A kliens házban léte
  alatt a bejárati ajtó pozícióját küldi (`netState`), így a többiek az ajtónál
  állva látnak – nincs szerver-módosítás.

## Elvetett alternatívák
- Csak be/ki felirat (a játékos eltűnik): egyszerűbb, de nincs mit csinálni bent.
- Szerver-oldali „házban" mező (hogy a többieknek eltűnjön): szerver-módosítást,
  ADR-t és szervertesztet igényelne – most nem éri meg (YAGNI).

## Következmények
- (+) Van bejárható belső tér; nincs szerver-változás, a `server.test.js` zöld marad.
- (−) A házban lévő játékos a többieknek nem tűnik el, az ajtónál áll.
- Bővíthető: bútor, több szoba, vagy később szerver-oldali „házban" állapot.
