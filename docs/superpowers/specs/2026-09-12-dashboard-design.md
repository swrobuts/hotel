# Entwurf: Interaktives Dashboard (Python/JavaScript, Render)

Stand: 12.09.2026, mit Robert abgestimmt. Anforderung: interaktiv, mindestens
die Funktionen der Power-BI-Referenzlösung, gern mehr.

## Ziel

Eine Webanwendung im Ordner `dashboard/` des Repos `hotel`, die live aus der
Datenbank `hotel` liest (Rolle `studi_hotel`) und auf Render (Free-Plan) unter
einer öffentlichen Adresse läuft. Sie ist zugleich Lehrbeispiel: Python liefert
Zahlen als JSON, JavaScript zeichnet; jedes Diagramm zeigt auf Wunsch sein SQL.

## Aufbau

* `backend/app/datenbank.py` — SQLAlchemy-Engine (Pool), `DATABASE_URL`
  überschreibbar, Standard `studi_hotel`; `abfragen(sql, parameter)`.
* `backend/app/filter.py` — der Filterzustand als Datenklasse (Hotel,
  Anreisejahr, Monat von/bis, Marktsegment, Vertriebskanal, Kundentyp,
  Kautionstyp, Land, Vorlaufzeit-Bucket) und `where_klausel(filter)`, die
  daraus eine parametrisierte WHERE-Bedingung baut. Alle Abfragen nutzen sie.
* `backend/app/abfragen.py` — je Kennzahlblock und Diagramm eine Funktion
  mit ihrem SQL; Rückgabe `{"daten": [...], "sql": "..."}`.
* `backend/app/main.py` — FastAPI: `/health`, `/api/filterwerte`,
  `/api/kennzahlen`, `/api/monate`, `/api/monate_jahr`, `/api/segmente`,
  `/api/kanaele`, `/api/segment_kundentyp`, `/api/storno_hotel`,
  `/api/storno_segment`, `/api/storno_kaution`, `/api/storno_vorlaufzeit`,
  `/api/erloes_datum`, `/api/laender`; statisches Frontend unter `/`.
* `frontend/index.html`, `app.js`, `diagramme.js`, `format.js`, `style.css` —
  Observable Plot 0.6.17 auf D3 7.9 (jsDelivr, Versionen festgelegt); Plotly wurde
  zugunsten der Tufte/Few/Hichert-Gestaltung verworfen (Entscheidung Robert, 12.09.2026).
* `backend/tests/test_abfragen.py` — Kontrollwerte gegen die lebende Datenbank.
* `Dockerfile`, `requirements.txt`, `README.md`; `render.yaml` im Repo-Root
  (`rootDir: dashboard`).

## Funktionen

Gleich wie in der PBIX: zehn Kennzahlen des Katalogs als Kacheln; Buchungen
und Erlös je Anreisemonat; Buchungen nach Marktsegment; Erlös nach
Vertriebskanal; Marktsegment × Kundentyp gestapelt; Stornoquote nach Hotel,
Marktsegment, Kautionstyp, Vorlaufzeit-Bucket; Erlös je Monat nach Anreise-
und nach Stornodatum; Buchungen je Monat und Jahr; Treemap, Top-10 und
Tabelle der Herkunftsländer; Filter Hotel und Anreisejahr.

Darüber hinaus: Klick in ein Diagramm setzt den entsprechenden Filter für
alle Diagramme (Kreuzfilterung), aktive Filter als abwählbare Chips, weitere
Filter (Marktsegment, Vertriebskanal, Kundentyp, Kautionstyp, Land, Zeitraum
nach Monat), Weltkarte der Herkunftsländer (Choroplethenkarte mit
ISO-3-Codes, ohne Anmeldung), sortierbare Ländertabelle mit CSV-Export,
Filterzustand in der Adresse (teilbarer Link), „SQL anzeigen" je Diagramm,
PNG-Export über die Plotly-Werkzeugleiste.

## Betrieb

Live-Abfragen ohne Cache (Aggregate über 119.390 Zeilen, Millisekunden);
Render Web Service `hotel-dashboard`, Docker-Runtime, Free-Plan,
`healthCheckPath: /health`, Auto-Deploy bei Push auf `main`. Einrichtung des
Service über Roberts Render-Konto (freigegeben am 12.09.2026).

## Nachweis

pytest gegen die Datenbank; lokaler Start und Aufruf im Browser; lokaler
Docker-Build; nach dem Deploy Aufruf der Render-Adresse, Kennzahlen ohne
Filter 119.390 / 37,0 % / 101,83 / 25.996.260, Klick-Filter und Link-Zustand
geprüft.
