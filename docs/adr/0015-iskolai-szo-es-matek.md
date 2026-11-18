# ADR-0015: Iskolai szó és matek – futásidejű, váltakozó tartalom

- **Státusz:** Elfogadva
- **Dátum:** 2026-11-18

## Kontextus
Az iskolában a nyitott könyvben mindig más-más értelmes szó legyen (a tanult
betűkből: A O I M E), a táblán pedig néhány matek példa (összeadás/kivonás 1–10
között), amelyek belépéskor és a táblánál E-re újragenerálódnak; a pad melletti
szó minden leüléskor új, akár ugyanahhoz a padhoz ülve is.

A világ eddig determinisztikus, a seedből számolt (ADR-0003). A „mindig más, akár
ugyanott" követelmény viszont **futásidejű, véletlen** tartalmat kér – ez nem a
világ-generálás része.

## Döntés
- `SCHOOL_WORDS` – kézzel összeállított, A O I M E betűkből álló értelmes magyar
  szavak listája; `randomWord()` választ.
- `makeMathProblems()` – 3-4 példa `{a, op, b, answer, done}`; operandusok 1–10,
  eredmény 0–10; van kész (helyes) és befejezetlen is.
- **Futásidejű állapot a játékoson** (nem a seedből): `player.schoolWord`,
  `player.schoolMath`. Belépéskor (`enterHouse`, iskola) mindkettő generálódik;
  padhoz ülve új szó; a táblánál E-re új matek.
- A `drawOpenBook(cx, cy, word)` a szót, a `drawSchool` a matek példákat rajzolja.

## Elvetett alternatívák
- Seedből számolt (determinisztikus) tartalom: akkor ugyanahhoz a padhoz ülve
  mindig ugyanazt látnánk – a felhasználó kifejezetten „mindig mást" kért.
- Véletlen betűkombinációk „értelmesség-szűrővel": a szűk betűkészletből sok
  értelmetlen szó jönne; a kézi lista garantáltan értelmes.

## Következmények
- (+) Változatos, oktató jellegű tartalom; a tanuló mindig új szót/feladatot lát.
- (−) Ez futásidejű, nem determinisztikus állapot (kivétel az ADR-0003 alól), és
  csak a saját kliens belső nézete – nem utazik a hálózaton (a házban lévőt a
  többiek az ajtónál látják, ADR-0005). A matek nem interaktív feladat (csak látszik).
