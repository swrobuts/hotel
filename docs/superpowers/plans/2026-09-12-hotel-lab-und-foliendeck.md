# Hotel-Lab und Foliendeck – Umsetzungsplan

> Ausführung in dieser Sitzung (executing-plans), Aufgabe für Aufgabe mit Prüfung.

**Ziel:** Lernumgebung `Hotel-Lab` (GitHub Pages) und Foliendeck `Winf_Hotel.pptx` nach dem
Entwurf `docs/superpowers/specs/2026-09-12-hotel-lab-und-foliendeck-design.md`.

**Vorgaben:** nur Deutsch, Anthrazit #2E3238 / Kupfer #C0662B, echtes Sternschema in PGlite,
Konventionen des WInf-SP-Autorenleitfadens, Deck über Bauskript mit Skill `thws-slides`.

---

### Aufgabe 1: Gerüst des Hotel-Lab
- [ ] Ordner `Lernumgebungen/Hotel-Lab` anlegen; aus WInf-SP kopieren: `assets/winf.js` → `assets/hotel.js`,
      `assets/winf.css` → `assets/hotel.css`, `pruefung.js`, `jsonpruefung.js`, `regal.js`, `deploy.js`,
      `assets/pglite/`, `tools/verify.mjs`, `tools/sql.mjs`, `.gitignore`, `.nojekyll`.
- [ ] Farben in `hotel.css` auf Anthrazit/Kupfer umstellen; Kopfzeile ohne Sprachumschalter.
- [ ] `hotel.js`: Schlüssel `hotel:*`, `LABS` neu, `MASCHINEN.postgres` lädt Schema + CSV per COPY,
      Neusäen nur bei `vorher`/`kontrolle`; Regal-Farben Anthrazit-Familie.
- [ ] `data/`: `schema.sql` (aus `sql/01_schema.sql`), neun CSV-Dateien, `regal-buchungen.json` (5.000 Zeilen).
- [ ] Prüfung: `python3 -m http.server`, Seite lädt, Datenbankband „bereit", Zählung 119.390.

### Aufgabe 2: index.html und Lab 00 (Fallstudie und Vorgehen)
- [ ] `index.html` mit zehn Kacheln, Hero, Fortschritt; `lab-00-fallstudie.html` + `data/uebungen/lab-00.json`.
- [ ] `node tools/verify.mjs` grün.

### Aufgabe 3: Lab 01 Datenquelle, Lab 02 Colab (1:1), Lab 03 Notebook
- [ ] Lab 02: WInf-SP `lab-04-colab.html` kopieren, `lang="en"`-Spans entfernen, JSON auf `de` reduzieren,
      Verweise auf Velo City durch das Hotel-Notebook ersetzen.
- [ ] Lab 01 und 03 schreiben (Nachbildungen der Notebook-Zellen), Übungen, verify grün.

### Aufgabe 4: Lab 04 Sternschema, Lab 05 Datenbank, Lab 06 Kennzahlen (SQL)
- [ ] Musterlösungen mit `node tools/sql.mjs postgres "…"` prüfen; Kennzahlen gegen Dashboard.

### Aufgabe 5: Lab 07 Power BI (Regal), Lab 08 Dashboard (Deploy), Lab 09 Handlungsempfehlung
- [ ] Regal-Felder und Ziele, Deploy-Repository `hotel`, Übungen, verify grün.

### Aufgabe 6: Veröffentlichen
- [ ] README, `gh repo create swrobuts/Hotel-Lab --public --source=. --push`, Pages einschalten,
      Live-URL prüfen (PGlite lädt, Übung prüfbar), Link im Hotel-README.

### Aufgabe 7: Foliendeck
- [ ] `references/folienmaster.md` lesen; Master aus `Winf_FitTrack.pptx` (Folien entfernen).
- [ ] Bilder: Dashboard-Ausschnitte (Headless Chrome), Power-BI-Seiten, Sternschema-Zeichnung.
- [ ] `Winf_Hotel_bau.py` schreiben, Deck bauen, rendern, `sprache_check.py`, `trennstrich_check.py`,
      Folienzahl = PDF-Seiten, Sichtprüfung der Renderbilder.
