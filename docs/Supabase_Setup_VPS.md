# Die Datenbank `hotel` auf dem VPS

Diese Anleitung beschreibt, wo die Datenbank des Lehrprojekts „Hotel Booking
Demand" läuft, wie man sich verbindet und wie Dozierende sie bei Bedarf neu
aufbauen. Studierende brauchen nur Abschnitt 2.

## 1. Die Instanz

| | |
|---|---|
| Server | VPS `bot.butscher.cloud` (SSH-Alias `vps`), Docker |
| Datenbanksystem | selbstgehostetes Supabase, Container `supabase-db`, PostgreSQL 17.6 |
| Compose-Verzeichnis | `/root/supabase/docker/` (dort liegt die `.env` mit `POSTGRES_PASSWORD`) |
| Erreichbar unter | `supabase.butscher.cloud`, Port `5433` (direkte Postgres-Verbindung, öffentlich) |
| Datenbank | `hotel` (Owner `postgres`), darin das Schema `hotel_bi` |
| SSL | aus (siehe Abschnitt 4) |

Auf derselben Instanz laufen weitere Datenbanken anderer Fallstudien. Die
Datenbank `hotel` ist davon getrennt: `CONNECT` darauf haben nur `postgres` und
`studi_hotel`; umgekehrt sieht `studi_hotel` in den anderen Datenbanken keine
Tabellen.

Supabase Studio und die REST-Schnittstelle der Instanz sind an die Datenbank
`postgres` gebunden und zeigen `hotel` nicht an. Das ist beabsichtigt: Der
Zugriff auf `hotel` läuft ausschließlich über das Postgres-Protokoll (Power BI,
Tableau, DBeaver, `psql`, Python, R).

## 2. Verbindungsdaten

### Studierende (nur lesen)

| Angabe | Wert |
|---|---|
| Host | `supabase.butscher.cloud` |
| Port | `5433` |
| Datenbank | `hotel` |
| Schema | `hotel_bi` |
| Benutzer | `studi_hotel` |
| Kennwort | `thws` |

Der Suchpfad der Rolle steht auf `hotel_bi`; `SELECT * FROM fact_bookings`
funktioniert also ohne Schemapräfix. Jede Transaktion ist nur lesend, eine
Abfrage wird nach zehn Minuten abgebrochen.

```bash
psql "host=supabase.butscher.cloud port=5433 dbname=hotel user=studi_hotel password=thws"
```

```python
import pandas as pd
from sqlalchemy import create_engine

engine = create_engine("postgresql://studi_hotel:thws@supabase.butscher.cloud:5433/hotel")
pd.read_sql("SELECT * FROM hotel_bi.dim_hotel", engine)
```

### Betreiberkonto (Dozierende)

Benutzer `postgres`, Kennwort auf dem VPS:

```bash
ssh vps 'grep POSTGRES_PASSWORD /root/supabase/docker/.env'
```

Das Ladeskript erwartet die Verbindung in der Umgebungsvariablen
`DATABASE_URL` (Vorlage: `.env.example`):

```
DATABASE_URL=postgresql://postgres:KENNWORT@supabase.butscher.cloud:5433/hotel
```

## 3. Neuaufbau der Datenbank

Alle Schritte sind idempotent und können wiederholt werden. Ausgangspunkt ist
ein Klon dieses Repos auf einem Rechner mit SSH-Zugang zum VPS.

**Schritt 1 – Datenbank anlegen** (nur, wenn sie noch nicht existiert):

```bash
ssh vps 'docker exec -i supabase-db psql -U supabase_admin -d postgres -c "CREATE DATABASE hotel OWNER postgres"'
```

**Schritt 2 – Sternschema einspielen** (löscht vorhandene Tabellen in
`hotel_bi` und legt sie neu an):

```bash
ssh vps 'docker exec -i supabase-db psql -U postgres -d hotel -v ON_ERROR_STOP=1 -f -' < sql/01_schema.sql
```

**Schritt 3 – Daten laden** (leert jede Tabelle und lädt die CSV-Dateien aus
`data/` per `COPY`; dauert unter einer halben Minute):

```bash
pip install -r requirements.txt
export DATABASE_URL="postgresql://postgres:KENNWORT@supabase.butscher.cloud:5433/hotel"
python sql/02_load_data.py
```

**Schritt 4 – Rolle `studi_hotel` anlegen** (als `supabase_admin`, weil nur
diese Rolle auf der Supabase-Instanz Rollen anlegen darf):

```bash
ssh vps 'docker exec -i supabase-db psql -U supabase_admin -d hotel -v ON_ERROR_STOP=1 -f -' < sql/03_rolle_studi_hotel.sql
```

Schritt 4 muss nach Schritt 2 laufen, weil `01_schema.sql` die Tabellen neu
anlegt und `03_rolle_studi_hotel.sql` die Leserechte darauf vergibt. Nach dem
Laden sind die Rechte durch die Default-Privileges der Rolle `postgres`
ohnehin gesetzt; ein erneuter Lauf von Schritt 4 schadet nicht.

**Kontrolle:**

```bash
ssh vps 'docker exec -i supabase-db psql -U postgres -d hotel -c "SELECT count(*) FROM hotel_bi.fact_bookings"'
```

Erwartet: `119390`. Die übrigen Tabellen: `dim_date` 1064, `dim_country` 178,
`dim_market_segment` 8, `dim_distribution_channel` 5, `dim_meal` 5,
`dim_customer_type` 4, `dim_deposit_type` 3, `dim_hotel` 2.

## 4. Sicherheit

* Die Rolle `studi_hotel` hat `USAGE` auf `hotel_bi` und `SELECT` auf dessen
  Tabellen, sonst nichts. Schreibversuche scheitern zweifach: an
  `default_transaction_read_only = on` und – falls jemand diese Einstellung in
  der Sitzung abschaltet – an den fehlenden Rechten (`permission denied`).
* Das Kennwort steht im Repo, weil der Datensatz öffentlich ist (Antonio,
  de Almeida & Nunes 2019; Kaggle; TidyTuesday) und die Rolle nichts verändern
  kann. Für eigene, nicht öffentliche Daten wäre das nicht angemessen.
* SSL ist auf der Instanz nicht aktiviert; der Container wird mit anderen
  Fallstudien geteilt, und ein Zertifikat für den Postgres-Port gehört nicht
  zu diesem Projekt. Folge: Power BI Desktop fragt beim ersten Verbinden, ob es
  unverschlüsselt verbinden soll – das ist zu bestätigen. In Tableau bleibt
  „SSL erforderlich" abgewählt. Die Übertragung ist damit unverschlüsselt, was
  für öffentliche Übungsdaten mit einer lesenden Rolle vertretbar ist.
* Row Level Security ist nicht eingerichtet: Die Datenbank ist nicht über die
  REST-Schnittstelle von Supabase erreichbar, und die Rolle darf ohnehin alles
  im Schema lesen.

## 5. Quellen

* Supabase, *Self-Hosting with Docker*: <https://supabase.com/docs/guides/self-hosting/docker>
* PostgreSQL 17, *Database Roles* und *Privileges*: <https://www.postgresql.org/docs/17/user-manag.html>
