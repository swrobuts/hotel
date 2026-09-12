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
| Auf einen Blick | sechs Kacheln (Gesamterlös, Buchungen, Stornoquote, Ø Zimmerpreis, Ø Vorlaufzeit, Ø Aufenthalt) mit Mini-Säulen über alle Monate (gleiche Zeitachse, ab null) und der Abweichung des Bezugsmonats zum Vormonat und Vorjahresmonat — blau = betriebswirtschaftlich besser, rot = schlechter; Hotelvergleich (Hotels als Zeilen, Summenzeile „beide Hotels", bessere Werte markiert); Kennzahlentabelle mit den zehn Katalog-Kennzahlen je Hotel, Verlauf, Abweichungen, Minimum und Maximum |
| Zeitverlauf | Buchungen, Erlös und Stornoquote als Säulen **untereinander** auf einer Zeitachse; Versatzstück zum Vorjahresmonat nach IBCS (gefüllt = Zuwachs, Umriss = Fehlbetrag; blau besser, rot schlechter); Saisonkurve je Jahr |
| Vertrieb | Buchungen nach Marktsegment, Erlös nach Vertriebskanal (mit Anteilen und Führungslinien), Marktsegment × Kundentyp als Tabelle mit Datenbalken, sortierbar und nach Hotel gruppierbar |
| Stornorisiko | Stornoquote nach Hotel, Kautionstyp, Marktsegment und Vorlaufzeit untereinander auf **einer Skala 0–100 %** mit Referenzlinie „insgesamt"; realisierter und durch Stornierung entgangener Erlös je Monat |
| Herkunft | die 15 größten Länder als Balken (übrige zusammengefasst), alle Länder als sortierbare, nach Hotel gruppierbare Tabelle mit Datenbalken und CSV-Export |
| Interaktion | Hover oder Tippen auf jede Säule, jeden Balken und jede Linie zeigt Wert, Abweichung zum Vormonat und Vorjahresmonat bzw. Anteil, Stornoquote und Abstand zur Gesamtquote; Klick setzt den Filter für alle Diagramme (Kreuzfilterung) |
| Filter | Hotel, Anreisejahr, Zeitraum (Monat ab/bis), Marktsegment, Vertriebskanal, Kundentyp, Kautionstyp, Land, Vorlaufzeit; aktive Filter als abwählbare Chips; der Zustand steht in der Adresse („Link mit Filterzustand kopieren"). Monate außerhalb des Zeitfilters bleiben hell sichtbar, damit Vormonat und Vorjahr vergleichbar bleiben |
| Texte | je Abschnitt ein Leitsatz; je Figur eine Aussage mit Zeitbezug, eine Beschreibung (Messgröße, Einheit, Zeitraum, Filter) und aufklappbar **Interpretation** und **Handlungsempfehlung**, aus den Daten formuliert; „SQL anzeigen" mit der Abfrage samt Parametern |
| Klarnamen | alle Kürzel des Datensatzes werden übersetzt (Marktsegmente, Kanäle, Kundentypen, Kautionstypen, Ländernamen aus ISO-3-Codes); Filter und SQL arbeiten weiter mit den Originalwerten |

Gegenüber der Power-BI-Lösung kommen hinzu: SQL-Anzeige, teilbarer Filterzustand,
Interpretation und Handlungsempfehlung je Figur, Vorjahres- und Vormonatsvergleich
mit Signalfarben, Hotelvergleich, Gruppierung in Tabellen.

## Gestaltung

Nach Tufte, Few, Hichert (IBCS) und Bissantz:

* **Aussage zuerst:** Titel nennt den Befund mit Zeitbezug, die Beschreibung darunter Messgröße, Einheit, Zeitraum und Filter; nur zwei Textebenen (Datawrapper-Regel).
* **Gleiche Skalen, wo verglichen wird:** die vier Stornoquoten-Diagramme teilen eine Skala; Kennzahlen mit verschiedenen Einheiten stehen untereinander auf einer Zeitachse, nie nebeneinander (Bissantz: Kennzahlen untereinander).
* **Fluchten:** alle Balkendiagramme haben dieselbe Beschriftungsbreite, sodass Balken und Werte über die Seite hinweg in einer Linie stehen; eine Spalte, 32 px Abstand, 64 px zwischen Abschnitten.
* **Wenig Tinte ohne Daten:** keine Rahmen und Achsen, wo Werte am Balken stehen; Gitterlinien nur bei Zeitreihen; Linien enden mit ihrer Beschriftung statt in einer Legende.
* **Eine Farbe je Bedeutung:** Grau für Mengen und Beträge, Rotbraun für Stornierungen, Petrol für die aktive Auswahl.
* **Tabellen als grafische Tabellen:** Zahlen rechtsbündig, Datenbalken relativ zum Spaltenmaximum, Sparklines mit explizitem Minimum und Maximum, Gruppenzeilen mit Zwischensummen.
* **Telefon:** eine Spalte, kleinere Ränder, Tabellen zeigen die tragenden Spalten, der Rest ist rollbar.

Quellen: IBCS-SUCCESS-Regeln (Say, Unify, Condense, Check, Express, Simplify, Structure); Datawrapper, *What to consider when using text in data visualizations*; Few, *Common Pitfalls in Dashboard Design*; Bissantz, *Bella berät – 75 Regeln für bessere Visualisierung*.

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
| `frontend/bezeichnungen.js`, `laendernamen.js` | Klarnamen für Kürzel und ISO-3-Ländercodes |
| `frontend/app.js` | Filterzustand, Adresse, Laden, Datenaufbereitung, Abschnitte |
| `frontend/diagramme.js` | ein Diagramm je Funktion mit Observable Plot (Balken mit Führungslinien, Säulen mit Versatzstück, gestapelte Säulen, Saisonlinien, Mini-Säulen) |
| `frontend/tabelle.js` | sortierbare, gruppierbare Tabelle mit Datenbalken |
| `frontend/texte.js` | Leitsätze, Aussagen, Interpretationen und Handlungsempfehlungen aus den Daten |
| `frontend/format.js` | deutsche Zahlen- und Monatsformate |
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
| `/api/laender_hotel` | Kennzahlen je Herkunftsland und Hotel (Gruppierung der Tabelle) |
| `/api/vorlaufzeit` | Kennzahlen je Vorlaufzeit-Bucket (0-7, 8-30, 31-90, 90+ Tage) |
| `/api/segment_kundentyp` | Anzahl Buchungen je Marktsegment, Kundentyp und Hotel |
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

* Ländercodes wie im Datensatz (ISO 3166-1 alpha-3); „CN" steht dort für
  China, „UNK" für unbekannt.
* Die Datenbankverbindung ist unverschlüsselt (siehe
  `../docs/Supabase_Setup_VPS.md`); der Zugang ist lesend und die Daten sind
  öffentlich.
