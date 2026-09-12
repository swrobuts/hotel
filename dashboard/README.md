# Interaktives Dashboard

Live: **<https://hotel-dashboard-cuoi.onrender.com>** (Render, Free-Plan: nach 15
Minuten ohne Aufruf schläft der Dienst ein, der erste Aufruf danach dauert bis zu
einer Minute).

Das Dashboard liest bei jedem Filterwechsel live aus der Datenbank `hotel`
(Rolle `studi_hotel`) und zeigt dieselben Kennzahlen wie das Notebook und die
Power-BI-Referenzlösung. Es ist zugleich das Lehrbeispiel für die Arbeitsteilung
„Python liefert Zahlen als JSON, JavaScript zeichnet".

![Dashboard](bilder/dashboard.png)

## Funktionen

| | |
|---|---|
| Kennzahlen | die zehn Kennzahlen des Katalogs als Kacheln, jede mit Sparkline über die Anreisemonate und dem Gesamtbestand als Vergleich, sobald ein Filter aktiv ist |
| Diagramme | Buchungen und Erlös je Anreisemonat (je Hotel); Buchungen nach Marktsegment; Erlös nach Vertriebskanal; Marktsegment × Kundentyp als Small Multiples; Stornoquote nach Hotel, Marktsegment, Kautionstyp und Vorlaufzeit mit Referenzlinie „Gesamt"; Erlös je Monat nach Anreise- und nach Stornodatum; Buchungen je Monat und Jahr; Weltkarte, Top 10 und Tabelle der Herkunftsländer |
| Filter | Hotel, Anreisejahr, Zeitraum (Monat ab/bis), Marktsegment, Vertriebskanal, Kundentyp, Kautionstyp, Land, Vorlaufzeit — als Auswahllisten und per Klick in jedes Diagramm (Kreuzfilterung); aktive Filter als abwählbare Chips |
| Aussage-Titel | jeder Diagrammtitel nennt den Befund im gefilterten Bestand, z. B. „Stornoquote steigt mit der Vorlaufzeit – 9,6 % bei 0-7 Tagen, 50,7 % bei 90+ Tagen" |
| Teilen | der Filterzustand steht in der Adresse, „Link kopieren" übernimmt ihn |
| Nachvollziehen | „SQL anzeigen" unter jedem Diagramm zeigt die Abfrage samt Parametern |
| Export | Ländertabelle als CSV, sortierbar per Klick auf die Spaltenüberschrift |

Gegenüber der Power-BI-Lösung kommen hinzu: Weltkarte ohne Anmeldung, SQL-Anzeige,
teilbarer Filterzustand, Sparklines in den Kacheln, Aussage-Titel.

## Gestaltung

Nach Tufte, Few und Hichert: wenig Tinte ohne Daten (keine Rahmen, kein
Farbhintergrund, Gitterlinien nur wo sie Werte ablesbar machen), Werte direkt am
Balken statt auf einer Achse, Linien enden mit ihrer Beschriftung statt in einer
Legende, eine Farbe je Bedeutung — Grau für Mengen und Beträge, Rotbraun für
alles, was Stornierungen misst, Petrol für die aktive Auswahl —, Referenzlinien
für den Gesamtbestand, Small Multiples statt gestapelter Balken.

## Lokal starten

```bash
cd dashboard
pip install -r requirements.txt
uvicorn backend.app.main:app --reload --port 8765
```

Dann <http://localhost:8765> öffnen. Die Datenbankadresse steht in
`backend/app/datenbank.py` (Rolle `studi_hotel`); `DATABASE_URL` in der
Umgebung überschreibt sie.

Tests (gegen die lebende Datenbank, mit den Kontrollwerten des Notebooks):

```bash
cd dashboard
pytest
```

Als Container:

```bash
cd dashboard
docker build -t hotel-dashboard .
docker run -p 8765:8000 hotel-dashboard
```

## Aufbau

| Pfad | Inhalt |
|---|---|
| `backend/app/datenbank.py` | Verbindung (SQLAlchemy, kleiner Pool), `abfragen(sql, parameter)` |
| `backend/app/filter.py` | der Filterzustand und `where_klausel()`, die daraus eine parametrisierte WHERE-Bedingung baut |
| `backend/app/abfragen.py` | je Kennzahlblock und Diagramm eine Funktion mit ihrem SQL |
| `backend/app/main.py` | FastAPI-Routen unter `/api/…`, `/health`, statisches Frontend |
| `backend/tests/test_abfragen.py` | Kontrollwerte und Routen |
| `frontend/index.html`, `style.css` | Seite und Gestaltung |
| `frontend/app.js` | Filterzustand, Adresse, Laden, Kacheln, Tabelle, Export |
| `frontend/diagramme.js` | ein Diagramm je Funktion mit Observable Plot |
| `frontend/format.js` | deutsche Zahlen- und Monatsformate |
| `frontend/daten/welt-110m.json` | Weltkarte (TopoJSON, Natural Earth 1:110 Mio., Kennung ISO-3) |
| `Dockerfile`, `../render.yaml` | Container und Render-Blueprint |

### Routen

Alle Routen nehmen dieselben Filterparameter entgegen, z. B.
`/api/kennzahlen?hotel=City%20Hotel&jahr=2016&segment=Online%20TA`, und
antworten mit `{"daten": [...], "sql": "...", "parameter": {...}}`.

| Route | Inhalt |
|---|---|
| `/api/filterwerte` | Ausprägungen aller Dimensionen mit Anzahl Buchungen (für die Auswahllisten) |
| `/api/kennzahlen` | die zehn Kennzahlen des Katalogs, eine Zeile |
| `/api/monate` | Kennzahlen je Anreisemonat und Hotel |
| `/api/hotels`, `/api/segmente`, `/api/kanaele`, `/api/kautionen`, `/api/laender` | Kennzahlen je Ausprägung der Dimension |
| `/api/vorlaufzeit` | Kennzahlen je Vorlaufzeit-Bucket (0-7, 8-30, 31-90, 90+ Tage) |
| `/api/segment_kundentyp` | Anzahl Buchungen je Marktsegment und Kundentyp |
| `/api/erloes_datum` | Erlös je Monat nach Anreisedatum und nach Datum des Reservierungsstatus |

Filterparameter: `hotel`, `jahr`, `von`, `bis` (Monate als `JJJJ-MM`), `segment`,
`kanal`, `kundentyp`, `kaution`, `land` (ISO-3), `vorlaufzeit`. Zeitfilter gelten
für das Anreisedatum; in `/api/erloes_datum` gilt der Zeitfilter der zweiten
Reihe für das Statusdatum.

## Deploy auf Render

`render.yaml` im Repo-Root beschreibt den Web Service `hotel-dashboard`
(Docker-Runtime, `rootDir: dashboard`, Free-Plan, Health-Check `/health`).
Eingerichtet am 12.09.2026 als Blueprint „hotel" im Render-Konto; jeder Push
auf `main` baut neu. Für eine eigene Instanz: auf render.com *New → Blueprint*,
Repo verbinden, *Deploy Blueprint*.

## Hinweise

* Die Karte zeigt Länder nach ISO-3-Code; „CN" aus dem Datensatz wird als
  China gezeigt, Kleinstaaten (SGP, HKG, MLT …) haben bei 1:110 Mio. keine
  Fläche und erscheinen nur in der Tabelle.
* Die Datenbankverbindung ist unverschlüsselt (siehe
  `../docs/Supabase_Setup_VPS.md`); der Zugang ist lesend und die Daten sind
  öffentlich.
