# Entwurf: Produktivsetzung des BI-Lehrprojekts „Hotel Booking Demand"

Stand: 12.09.2026, mit Robert abgestimmt.

## Ausgangslage

Der Ordner enthält ein fertiges Beispiel für ein BI-Einstiegsprojekt: ein
Colab-Notebook (Rohdaten → Bereinigung → Kennzahlen → Sternschema → Export),
das Sternschema als SQL (`hotel_bi`, acht Dimensionen und eine Faktentabelle),
ein Ladeskript, die neun CSV-Dateien und eine Setup-Anleitung. Das Notebook
läuft fehlerfrei durch; seine CSV-Ausgabe ist byteidentisch mit den
gelieferten Dateien. Die Word-Datei mit dem Power-BI-Grundgerüst bleibt lokal.

## Ziel

Studierende sollen ohne eigene Vorbereitung arbeiten können: das Notebook in
Colab öffnen, die fertige Datenbank mit Power BI, Tableau, `psql` oder Python
lesen. Robert führt selbst keine Skripte aus; die Sitzung nimmt alles in
Betrieb und weist es am lebenden System nach.

## Entscheidungen

### Datenbank

* Eigene Datenbank `hotel` (Owner `postgres`) auf der bestehenden
  Supabase-Instanz des VPS (`supabase-db`, PostgreSQL 17.6,
  `supabase.butscher.cloud:5433`). Die Instanz trägt bereits mehrere
  eigenständige Datenbanken; ein eigenes Schema in `postgres` (Muster
  BurgerMetrics) ist verworfen, weil die Datenbank ausdrücklich `hotel`
  heißen soll und BI-Werkzeuge so nur die Hotel-Tabellen sehen.
* Darin das unveränderte Sternschema im Schema `hotel_bi`.
* `CONNECT` auf `hotel` wird `PUBLIC` entzogen und nur `postgres` und
  `studi_hotel` gewährt.
* SSL bleibt auf der Instanz aus (gemeinsamer Container mit BurgerMetrics
  und VeloCity). Folge für Power BI und Tableau: unverschlüsselte Verbindung
  bestätigen; das README beschreibt den Klick.

### Rolle für Studierende

* `studi_hotel`, Kennwort `thws`, `LOGIN`, nur lesend:
  `default_transaction_read_only = on`, `USAGE` und `SELECT` auf `hotel_bi`,
  Default-Privileges für künftige Tabellen und Sichten, `search_path =
  hotel_bi`, `statement_timeout = 10min`,
  `idle_in_transaction_session_timeout = 5min`.
* Angelegt als `supabase_admin` über `docker exec` auf dem VPS; das Skript
  liegt im Repo (`sql/03_rolle_studi_hotel.sql`) und ist idempotent.
* Das Kennwort steht bewusst im Repo: Der Datensatz ist öffentlich
  (Antonio, de Almeida & Nunes 2019; Kaggle, TidyTuesday), die Rolle darf
  nur lesen.

### Repository

* GitHub `swrobuts/hotel`, öffentlich. Lokale Wurzel ist der Ordner `Hotel/`
  selbst (eigenes Repo wie FitTrack; im Elternrepo per `.gitignore`
  ausgeschlossen).
* Aufbau:

  | Pfad | Inhalt |
  |---|---|
  | `README.md` | Zugang, Schnellstart (Colab, Power BI, Tableau, psql, Python), Struktur, Neuaufbau |
  | `notebooks/BI_Hotel_Booking_Demand.ipynb` | Colab-Notebook mit Open-in-Colab-Link, ohne gespeicherte Ausgaben |
  | `data/*.csv` | die neun CSV-Dateien des Sternschemas |
  | `sql/01_schema.sql` | Sternschema (unverändert) |
  | `sql/02_load_data.py` | Ladeskript (Kommentare mit echten Umlauten) |
  | `sql/03_rolle_studi_hotel.sql` | Rolle `studi_hotel` |
  | `docs/Supabase_Setup_VPS.md` | die reale Instanz, Verbindungsdaten, Neuaufbau der Datenbank |
  | `requirements.txt`, `.env.example`, `.gitignore` | Umgebung; `*.docx` und `.env` bleiben lokal |

### Notebook

Behobene Mängel:

1. Zelle 19: `groupby` auf der `pd.cut`-Kategorie ohne `observed=True`
   erzeugt in Colab (pandas 2.2) eine `FutureWarning`.
2. Zellen 6/7: Der Text behauptet, `agent` und `company` enthielten den
   String `"NULL"`; pandas liest `NULL` bereits als fehlenden Wert, die
   `replace`-Zeilen sind wirkungslos. Text und Code werden angeglichen.
3. Zelle 10: Die KPI-Tabelle erscheint als float („Anzahl Buchungen
   119390.00").
4. Abschnitt 7.1 (auskommentierter Upload per Colab-Secret) wird ersetzt
   durch eine lesende Beispielabfrage gegen die Produktivdatenbank mit
   `studi_hotel`.
5. Tonkorrekturen gemäß sachlichem Stil (Ausrufezeichen, Anführungszeichen
   als Wertung).

### Nicht Teil dieses Schritts

Power-BI- und Tableau-Umsetzung, das interaktive Dashboard (Python/JavaScript,
Render) und zusätzliche Sichten in der Datenbank. Sie folgen in eigenen
Schritten.

## Nachweis

* Notebook vollständig ausgeführt, CSV-Ausgabe gegen `data/` verglichen.
* Frischer Klon des Repos; Schema und Ladeskript daraus gegen `hotel`
  ausgeführt.
* Als `studi_hotel` von außen: Zeilenzahlen aller neun Tabellen
  (`fact_bookings` = 119.390), Schreibversuch abgelehnt, andere Datenbanken
  nicht erreichbar.
* Colab-Link aus dem README aufgerufen.
