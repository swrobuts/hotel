# Hotel Booking Demand – BI-Einstiegsprojekt

Lehrprojekt für die Vorlesung *Business Intelligence* (BWL, 1. und 3. Semester):
Von den Rohdaten über Bereinigung und Kennzahlen zum Sternschema, das als
PostgreSQL-Datenbank für Power BI, Tableau und eigene Auswertungen bereitsteht.

[![In Colab öffnen](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/swrobuts/hotel/blob/main/notebooks/BI_Hotel_Booking_Demand.ipynb)

Der Datensatz umfasst 119.390 Buchungen eines Stadthotels und eines Resorthotels
in Portugal (Anreisen Juli 2015 bis August 2017).

**Interaktives Dashboard:** <https://hotel-dashboard-cuoi.onrender.com> — liest
live aus der Datenbank, Kreuzfilterung per Klick, SQL je Diagramm
(Beschreibung in [`dashboard/README.md`](dashboard/README.md)).

**Lernumgebung Hotel-Lab:** <https://swrobuts.github.io/Hotel-Lab/> — zehn Labs, die
das Projekt Schritt für Schritt erklären, mit 48 Übungen und dem Sternschema als
PostgreSQL im Browser (Repo [swrobuts/Hotel-Lab](https://github.com/swrobuts/Hotel-Lab)).

## Zugang zur Datenbank

Die Datenbank ist fertig geladen. Der Zugang ist lesend und für alle Werkzeuge
gleich:

| Angabe | Wert |
|---|---|
| Host | `supabase.butscher.cloud` |
| Port | `5433` |
| Datenbank | `hotel` |
| Schema | `hotel_bi` |
| Benutzer | `studi_hotel` |
| Kennwort | `thws` |

Das Kennwort steht bewusst hier: Die Daten sind öffentlich, und die Rolle darf
nichts verändern.

## Schnellstart

### Google Colab

Auf den Colab-Link oben klicken. Das Notebook lädt die Rohdaten aus dem Netz,
braucht keine Installation und liest in Abschnitt 7.1 aus der Datenbank. Zum
Bearbeiten *Datei → Kopie in Drive speichern*.

### Power BI Desktop

1. *Start → Daten abrufen → Weitere… → Datenbank → PostgreSQL-Datenbank*.
2. Server `supabase.butscher.cloud:5433`, Datenbank `hotel`,
   Datenkonnektivitätsmodus *Import*.
3. Im Anmeldedialog links *Datenbank* wählen, Benutzername `studi_hotel`,
   Kennwort `thws`. Das Häkchen *Verbindung verschlüsseln* abwählen; fragt
   Power BI danach, ob es unverschlüsselt verbinden soll, mit *OK* bestätigen
   (die Instanz hat kein SSL-Zertifikat, siehe `docs/Supabase_Setup_VPS.md`).
4. Im Navigator das Schema `hotel_bi` aufklappen, alle neun Tabellen
   auswählen, *Laden*.
5. In der Modellansicht prüfen, ob Power BI die neun Beziehungen erkannt hat.
   `dim_date` ist zweimal verknüpft: über `arrival_date_key` (aktiv) und über
   `reservation_status_date_key` (inaktiv, für `USERELATIONSHIP`).

Die fertige Referenzlösung (Modell, Measures, vier Seiten) liegt unter
[`powerbi/`](powerbi/README.md) — als `Hotel.pbix` zum Öffnen und als
Power-BI-Projekt (`Hotel.pbip`) zum Nachlesen.

### Tableau Desktop

1. *Verbinden → Mit einem Server → PostgreSQL*. Fehlt der Treiber, zeigt
   Tableau einen Link zum Herunterladen an.
2. Server `supabase.butscher.cloud`, Port `5433`, Datenbank `hotel`,
   Authentifizierung *Benutzername und Kennwort* (`studi_hotel` / `thws`),
   *SSL erforderlich* nicht ankreuzen.
3. Schema `hotel_bi` wählen, `fact_bookings` in den Arbeitsbereich ziehen,
   die Dimensionen über ihre `*_id`- bzw. `date_key`-Spalten verknüpfen.

### DBeaver oder psql

```bash
psql "host=supabase.butscher.cloud port=5433 dbname=hotel user=studi_hotel password=thws"
```

In DBeaver: neue Verbindung *PostgreSQL* mit denselben Werten. Der Suchpfad
der Rolle steht auf `hotel_bi`, also genügt `SELECT * FROM fact_bookings`.

### Python

```python
import pandas as pd
from sqlalchemy import create_engine

engine = create_engine("postgresql://studi_hotel:thws@supabase.butscher.cloud:5433/hotel")
pd.read_sql("SELECT hotel, count(*) FROM fact_bookings JOIN dim_hotel USING (hotel_id) GROUP BY hotel", engine)
```

Benötigt `pandas`, `sqlalchemy` und `psycopg2-binary` (siehe `requirements.txt`).

## Daten herunterladen

Das Leserecht genügt, um Tabellen vollständig auf den eigenen Rechner zu
holen; ein Abzug der Faktentabelle (119.390 Zeilen) dauert wenige Sekunden.

| Werkzeug | Vorgehen |
|---|---|
| psql | `\copy (SELECT * FROM fact_bookings) TO 'fact_bookings.csv' CSV HEADER` – läuft auf dem eigenen Rechner, die Datei landet dort |
| DBeaver | Rechtsklick auf die Tabelle → *Daten exportieren* → CSV oder Excel |
| Python | `pd.read_sql("SELECT * FROM fact_bookings", engine).to_csv("fact_bookings.csv", index=False)` |
| Power BI, Tableau | der Import-Modus übernimmt ohnehin alle Zeilen in die eigene Datei |
| ohne Datenbank | dieselben neun CSV-Dateien liegen in diesem Repo unter `data/` |

Serverseitiges `COPY … TO '/pfad'` steht der Rolle nicht offen; es würde auf dem
Server schreiben und wird für den Download nicht gebraucht.

## Inhalt des Repos

| Pfad | Inhalt |
|---|---|
| `notebooks/BI_Hotel_Booking_Demand.ipynb` | Colab-Notebook: Daten laden, sichten, bereinigen, Kennzahlen, Auswertungen, Sternschema, Export, Datenbankzugriff |
| `data/` | die neun CSV-Dateien des Sternschemas, wie das Notebook sie erzeugt |
| `sql/01_schema.sql` | Sternschema als PostgreSQL-DDL (Schema `hotel_bi`) |
| `sql/02_load_data.py` | Ladeskript: leert die Tabellen und lädt die CSV-Dateien per `COPY` |
| `sql/03_rolle_studi_hotel.sql` | lesende Rolle `studi_hotel` |
| `powerbi/` | Referenzlösung des Power-BI-Reports: `Hotel.pbix`, Projekt `Hotel.pbip`, Abbildungen der vier Seiten |
| `dashboard/` | interaktives Dashboard (FastAPI + Observable Plot), Dockerfile; `render.yaml` im Repo-Root |
| `docs/Supabase_Setup_VPS.md` | die Instanz, Verbindungsdaten, Neuaufbau der Datenbank, Sicherheit |
| `docs/superpowers/` | Entwurf und Umsetzungsplan der Produktivsetzung |
| `requirements.txt`, `.env.example` | Python-Abhängigkeiten, Vorlage für die Betreiberverbindung |

## Datenmodell

Sternschema mit einer Faktentabelle und acht Dimensionen:

| Tabelle | Zeilen | Inhalt |
|---|---|---|
| `fact_bookings` | 119.390 | eine Zeile je Buchung: Fremdschlüssel zu allen Dimensionen, `is_canceled`, `lead_time`, `total_nights`, `adr`, `revenue`, … |
| `dim_date` | 1.064 | Kalender vom 17.10.2014 bis 14.09.2017; in `fact_bookings` zweifach referenziert (Anreise, Statusdatum) |
| `dim_country` | 178 | Herkunftsland (ISO-3-Code, `UNK` für unbekannt) |
| `dim_market_segment` | 8 | Marktsegment (z. B. Online TA, Corporate) |
| `dim_distribution_channel` | 5 | Vertriebskanal |
| `dim_meal` | 5 | Verpflegungsart |
| `dim_customer_type` | 4 | Kundentyp |
| `dim_deposit_type` | 3 | Art der Anzahlung |
| `dim_hotel` | 2 | City Hotel, Resort Hotel |

Der Datensatz enthält keine Zimmerkapazität; Auslastung und RevPAR lassen sich
daher nicht berechnen. Das Notebook (Abschnitt 4) begründet die verwendeten
Ersatzkennzahlen.

## Neuaufbau für Dozierende

Datenbank, Schema, Daten und Rolle lassen sich mit vier Befehlen neu aufbauen;
sie stehen in [`docs/Supabase_Setup_VPS.md`](docs/Supabase_Setup_VPS.md).
Das Word-Dokument mit dem Power-BI-Grundgerüst ist nicht Teil des Repos.

## Datenquelle

Antonio, N., de Almeida, A., & Nunes, L. (2019). Hotel booking demand datasets.
*Data in Brief*, 22, 41–49. <https://doi.org/10.1016/j.dib.2018.11.126>
(Lizenz CC BY 4.0). Verwendet wird die Fassung des TidyTuesday-Projekts vom
11.02.2020 (<https://github.com/rfordatascience/tidytuesday/blob/main/data/2020/2020-02-11/readme.md>),
die auch auf Kaggle als *Hotel Booking Demand* verfügbar ist.

## Nächste Schritte

Umsetzung des Reports in Tableau, analog zur Power-BI-Referenzlösung.
