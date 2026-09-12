# Hotel-Lab und Foliendeck – Entwurf

Stand 12.09.2026. Freigegeben von Robert im Gespräch (nur Deutsch, voller Umfang).

## Ziel

Zwei Lehrmaterialien zum produktiven BI-Projekt „Hotel Booking Demand" (Repo `swrobuts/hotel`,
Datenbank `hotel` auf Supabase, Notebook, Power-BI-Referenzlösung, Dashboard auf Render):

1. **Foliendeck `Winf_Hotel.pptx`** – beschreibt Vorgehen, Datenquelle, Datenmodell, Datenbank,
   Kennzahlen, Analysen, Power BI und Dashboard für die Vorlesung.
2. **Hotel-Lab** – interaktive Lernumgebung, die dasselbe Schritt für Schritt erklärt und mit
   Übungen prüft; Studierende arbeiten damit selbstständig.

## Foliendeck

* Datei `Vorlesungen/Wintersemester/Wintersemester_2026/Winf_Hotel.pptx`, gebaut von
  `Winf_Hotel_bau.py` daneben (python-pptx, Bausteine und Raster aus der Skill `thws-slides`,
  Master aus `Winf_FitTrack.pptx` – alle Folien entfernt, Layouts behalten). Änderungen laufen
  immer über das Bauskript.
* Rund 45 Folien, Aussagentitel je Folie, Einleitung drei bis vier Zeilen, Quellenzeile befüllt,
  keine Termine, keine Übungsankündigungen, keine Foliennummern in Verweisen.
* Kapitel: 1 Fallstudie und Fragestellungen · 2 Vorgehen (BI-Prozess, Werkzeugkette) ·
  3 Datenquelle (Antonio, de Almeida, Nunes 2019; Kaggle-Fassung; 32 Spalten; Eigenheiten) ·
  4 Datenmodell (Sternschema `hotel_bi`) · 5 Datenbank und Zugang (Supabase/PostgreSQL, Rolle
  `studi_hotel`, psql, Python, Power BI) · 6 Notebook-Ablauf · 7 Kennzahlenkatalog (Umsatz-
  begriffe, DeltaMaster-Farblogik) · 8 Analysen und Befunde (Zeitverlauf, Vertrieb, Storno,
  Herkunft – Bilder aus dem Dashboard) · 9 Power BI (Modell, Measures, Bericht) · 10 Dashboard
  (Architektur, Gestaltungsregeln, Render) · Abschluss: Handlungsempfehlungen, Hotel-Lab.
* Bilder: Dashboard-Ausschnitte per Headless-Chrome aus der Live-Fassung, Power-BI-Seiten aus
  `powerbi/bilder/`, Sternschema als eigene Zeichnung (Baustein), keine fremden Screenshots.
* Prüfung: Render der PDF (LibreOffice-Wrapper der Skill), `sprache_check.py`,
  `trennstrich_check.py`, Seitenzahl PDF = Folienzahl PPTX.

## Hotel-Lab

### Rahmen

* Ordner `Vorlesungen/Lernumgebungen/Hotel-Lab`, GitHub `swrobuts/Hotel-Lab` (öffentlich),
  GitHub Pages aus `main`/Wurzel, `.nojekyll`. Statisch, ohne Build, ohne Anmeldung.
* Laufzeit und Formsprache aus WInf-SP übernommen: `assets/winf.js` → `assets/hotel.js`,
  `assets/winf.css` → `assets/hotel.css`, `pruefung.js`, `jsonpruefung.js`, `regal.js`,
  `deploy.js`, PGlite (`assets/pglite/`). Kein sql.js, kein Terminal (kein Shell-Lehrziel).
* **Nur Deutsch** wie das FitTrack-Lab: keine `lang="en"`-Spans, JSON-Texte nur `de`, kein
  Sprachumschalter; englische Fachbegriffe bleiben englisch. Der Abnahmelauf prüft nur `de`.
* **Farbfamilie Anthrazit:** Leitfarbe #2E3238 (Hero, Lab-Kopf, Text, Links, Buttons; weiße
  Schrift 13:1), aufgehellt #ECEEF0 für Kästen und aktive Navigation; Signalfarbe Kupfer
  #C0662B (Akzentlinie, Badges, Fortschritt, Kachelnummern; nie als Schriftfarbe auf Weiß),
  aufgehellt #F7E6DA; zweite Signalfarbe #8C4A1F (Links, Hover, 7,4:1 auf Weiß).
* **Daten:** das echte Sternschema `hotel_bi` mit allen 119.390 Buchungen in PGlite. Schema aus
  `sql/01_schema.sql`, Daten aus den neun CSV-Dateien des Hotel-Repos per `COPY … FROM
  '/dev/blob'` (gemessen: 4 s in Node). Einmal je Seite laden; SQL-Übungen sind Leseabfragen,
  deshalb kein Neusäen vor jeder Prüfung (nur bei Übungen mit `vorher`/`kontrolle`).
  Kennzahlen zum Gegenprüfen: 119.390 Buchungen, Stornoquote 37,0 %, stornobereinigter Umsatz
  25.996.260 €, gebuchter Umsatz 42.723.498 €.
* Konventionen des `AUTORENLEITFADEN.md` von WInf-SP gelten (Dramaturgie je Lab, Befehlskarten,
  Übungstypen, Oberflächen-Nachbildungen statt Screenshots, Hinweis zur Werkzeugauswahl,
  `verify.mjs` nach jeder Änderung).

### Labs (zehn, rund 50 Übungen)

| Lab | Inhalt | Übungen (Typen) |
|---|---|---|
| 00 Fallstudie und Vorgehen | zwei Hotels, vier Fragestellungen, BI-Prozess, Werkzeugkette, Rollen der Artefakte | quiz, zuordnen, reihenfolge |
| 01 Datenquelle | Antonio et al. 2019, Kaggle/TidyTuesday, 32 Spalten, Typen, Eigenheiten (adr, is_canceled, Non Refund, ISO-3, „CN"), Lizenz | quiz, zuordnen (Spalte → Typ/Bedeutung), json (eine Buchung als JSON) |
| 02 Google Colab | 1:1 aus WInf-SP Lab 04 (deutsche Texte), Verweis auf das Hotel-Notebook | quiz, zuordnen, checkliste, reihenfolge, quiz |
| 03 Das Notebook Schritt für Schritt | Abschnitte 1–8 des Notebooks als Nachbildung von Zellen, Bereinigung, revenue, Diagramme, Live-Abfrage | reihenfolge, quiz, zuordnen, checkliste |
| 04 Sternschema | Fakten und Dimensionen, Schlüssel, Datumsrollen, flach vs. Stern, DDL | zuordnen, quiz, sql (Dimension abfragen), sql (Join) |
| 05 Datenbank und Zugang | Supabase/PostgreSQL auf dem VPS, Rolle `studi_hotel`, psql/DataGrip/Python, Verschlüsselung, Grenzen | checkliste (Verbindung), quiz, sql, sql |
| 06 Kennzahlen | KPI-Katalog, Umsatzbegriffe, Stornoquote, ADR, Vorlaufzeit, DeltaMaster-Farblogik | sql ×3 (Kennzahlen nachrechnen), zuordnen (Kennzahl → Farbe), quiz |
| 07 Power BI | Import, Power Query, Beziehungen, DAX-Measures, Berichtsseiten | regal ×2 (Power-BI-Variante mit Hotel-Feldern), zuordnen (Measure → DAX), reihenfolge, quiz |
| 08 Dashboard | FastAPI + Observable Plot, Routen, Gestaltungsregeln (Tufte, Few, IBCS, Bissantz), Render-Deploy | zuordnen (Regel → Beispiel), quiz, deploy (Hotel-Repo), json (render.yaml-Prüfung) |
| 09 Vom Befund zur Handlungsempfehlung | Aussagen lesen, Abweichungen deuten, Empfehlungen ableiten, Grenzen der Daten (keine Kapazität) | quiz, zuordnen (Befund → Empfehlung), reihenfolge |

Regal-Simulator: flache Buchungstabelle (Stichprobe 5.000 Buchungen) mit Feldern `monat`,
`hotel`, `segment`, `kanal`, `kundentyp`, `kaution`, `land`, `storniert`, `nächte`, `adr`,
`umsatz`. Deploy-Simulator: Repository `hotel` mit `render.yaml`, `dashboard/Dockerfile`,
`requirements.txt`, Variable `DATABASE_URL`.

### Nicht enthalten

Keine Tableau-Einheit (Lizenz offen), kein Terminal, keine englische Fassung, keine Screenshots
als Bilddateien (Nachbildungen), keine Bewertungs- oder Prüfungsaussagen.
