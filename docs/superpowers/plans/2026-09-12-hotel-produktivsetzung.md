# Produktivsetzung „Hotel Booking Demand" — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Datenbank `hotel` mit Rolle `studi_hotel` auf dem VPS in Betrieb nehmen, das Lehrmaterial korrigieren und als öffentliches Repo `swrobuts/hotel` veröffentlichen.

**Architecture:** Eigene Datenbank `hotel` (Schema `hotel_bi`, Sternschema) auf der bestehenden Supabase-Postgres-Instanz `supabase-db` des VPS; lesende Rolle `studi_hotel`; Repo mit Notebook, SQL, Ladeskript, CSV-Daten und README. Alles wird von dieser Sitzung ausgeführt und am lebenden System nachgewiesen.

**Tech Stack:** PostgreSQL 17.6 (Supabase-Image, `docker exec supabase-db`), Python 3.12 mit pandas/SQLAlchemy/psycopg2, Jupyter nbconvert, `gh`, SSH-Alias `vps`.

**Spec:** `docs/superpowers/specs/2026-09-12-hotel-produktivsetzung-design.md`

## Global Constraints

* Deutsche Texte mit echten Umlauten (ü, ö, ä, ß); Bezeichner, Dateinamen und Spaltennamen bleiben ASCII.
* Sachlicher Ton in Notebook, README und Anleitung: keine Metaphern, keine Pointen, keine rhetorischen Ausrufe.
* Rolle `studi_hotel` darf nur lesen; Kennwort `thws` steht bewusst im Repo.
* `*.docx` und `.env` werden nie committet.
* Schreibende Befehle auf dem VPS nur gegen die Datenbank `hotel` und die Rolle `studi_hotel`; nichts an `postgres`, `supabase-db`-Konfiguration oder anderen Rollen ändern.
* Admin-Kennwort der Rolle `postgres` zur Laufzeit aus `../BurgerMetrics/BurgerMetrics_Website/.env` lesen (`PGPASSWORD=`), nie ausgeben, nie in Dateien schreiben.

---

### Task 1: Datenbank `hotel` und Rolle `studi_hotel` auf dem VPS

**Files:**
- Create: `sql/03_rolle_studi_hotel.sql`

**Interfaces:**
- Produces: Datenbank `hotel` (Owner `postgres`) und Login-Rolle `studi_hotel`; Task 2 lädt in diese Datenbank, Task 3 prüft die Rolle.

- [ ] **Step 1: Rollenskript schreiben**

```sql
-- =====================================================================
-- 03_rolle_studi_hotel.sql
-- Rolle für Studierende: nur lesend auf das Schema hotel_bi der
-- Datenbank hotel. Als supabase_admin gegen die Datenbank hotel
-- ausführen; das Skript ist idempotent.
--
--   docker exec -i supabase-db psql -U supabase_admin -d hotel \
--       -v ON_ERROR_STOP=1 -f - < sql/03_rolle_studi_hotel.sql
-- =====================================================================

-- Rolle anlegen (oder Kennwort setzen, falls sie schon existiert).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'studi_hotel') THEN
        CREATE ROLE studi_hotel LOGIN PASSWORD 'thws';
    ELSE
        ALTER ROLE studi_hotel WITH LOGIN PASSWORD 'thws';
    END IF;
END
$$;

-- Nur lesen, und nur in dieser Datenbank.
ALTER ROLE studi_hotel SET default_transaction_read_only = on;
ALTER ROLE studi_hotel SET search_path = hotel_bi;
ALTER ROLE studi_hotel SET statement_timeout = '10min';
ALTER ROLE studi_hotel SET idle_in_transaction_session_timeout = '5min';

REVOKE CONNECT ON DATABASE hotel FROM PUBLIC;
GRANT  CONNECT ON DATABASE hotel TO postgres, studi_hotel;

GRANT USAGE ON SCHEMA hotel_bi TO studi_hotel;
GRANT SELECT ON ALL TABLES IN SCHEMA hotel_bi TO studi_hotel;

-- Tabellen und Sichten, die postgres später anlegt, sind automatisch lesbar.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hotel_bi
    GRANT SELECT ON TABLES TO studi_hotel;
```

- [ ] **Step 2: Datenbank anlegen (nur wenn sie fehlt) und Schema einspielen**

```bash
ssh vps 'docker exec -i supabase-db psql -U supabase_admin -d postgres -Atc "SELECT 1 FROM pg_database WHERE datname = '"'"'hotel'"'"'"'
# Erwartung: leer. Dann:
ssh vps 'docker exec -i supabase-db psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE hotel OWNER postgres"'
ssh vps 'docker exec -i supabase-db psql -U postgres -d hotel -v ON_ERROR_STOP=1 -f -' < sql/01_schema.sql
```

Erwartung: `CREATE DATABASE`, danach `CREATE SCHEMA` … `CREATE INDEX` ohne Fehler.

- [ ] **Step 3: Rollenskript einspielen**

```bash
ssh vps 'docker exec -i supabase-db psql -U supabase_admin -d hotel -v ON_ERROR_STOP=1 -f -' < sql/03_rolle_studi_hotel.sql
```

- [ ] **Step 4: Prüfen**

```bash
ssh vps 'docker exec -i supabase-db psql -U supabase_admin -d hotel -Atc "SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolconfig FROM pg_roles WHERE rolname = '"'"'studi_hotel'"'"'"'
ssh vps 'docker exec -i supabase-db psql -U supabase_admin -d hotel -Atc "SELECT has_database_privilege('"'"'studi_hotel'"'"', '"'"'hotel'"'"', '"'"'CONNECT'"'"'), has_database_privilege('"'"'studi_daba'"'"', '"'"'hotel'"'"', '"'"'CONNECT'"'"')"'
```

Erwartung: `studi_hotel|t|f|f|{default_transaction_read_only=on,search_path=hotel_bi,statement_timeout=10min,idle_in_transaction_session_timeout=5min}` und `t|f`.

- [ ] **Step 5: Zweiter Lauf des Rollenskripts (Idempotenz), dann Commit**

```bash
ssh vps 'docker exec -i supabase-db psql -U supabase_admin -d hotel -v ON_ERROR_STOP=1 -f -' < sql/03_rolle_studi_hotel.sql
git add sql/03_rolle_studi_hotel.sql
git commit -m "Rolle studi_hotel: nur lesend auf hotel_bi"
```

---

### Task 2: Ladeskript bereinigen und Daten laden

**Files:**
- Modify: `sql/02_load_data.py` (nur Docstring und Kommentare: echte Umlaute; Beispiel-URL auf `hotel`)
- Create: `requirements.txt`, `.env.example`

**Interfaces:**
- Consumes: Datenbank `hotel` mit Schema `hotel_bi` aus Task 1.
- Produces: gefüllte Tabellen; Task 3 prüft die Zeilenzahlen (siehe Erwartung in Step 4).

- [ ] **Step 1: Umgebungsdateien anlegen**

`requirements.txt`:
```
pandas>=2.2
sqlalchemy>=2.0
psycopg2-binary>=2.9
```

`.env.example`:
```
# Verbindung für das Ladeskript sql/02_load_data.py (nur Dozierende).
# Studierende brauchen das nicht: die Datenbank ist bereits geladen.
DATABASE_URL=postgresql://postgres:KENNWORT@supabase.butscher.cloud:5433/hotel
```

- [ ] **Step 2: Docstring und Kommentare des Ladeskripts mit echten Umlauten schreiben**

Alle Vorkommen von `fuer`, `laedt`, `Fremdschluessel`, `ausschliesslich`, `ueber`, `Uebungs`, `fuehrt`, `geloescht`, `gewuenscht`, `Ausfuehrung`, `Praefix`, `muessen`, `abhaengt`, `Bestaetigung`, `Ausfuehrende`, `abhaengige`, `gross`, `Uebung`, `Dateiname_ohne_endung` in Kommentaren und Strings durch die Umlautschreibweise ersetzen; Beispiel-URL in Docstring und Fehlermeldung auf `…@supabase.butscher.cloud:5433/hotel` setzen; den Verweis `docs/Supabase_Setup_VPS.md` beibehalten. Bezeichner nicht anfassen.

Prüfen:
```bash
grep -nE "fuer|laedt|ueber|muess|schluess" sql/02_load_data.py
```
Erwartung: keine Treffer. `python3 -m py_compile sql/02_load_data.py` ohne Fehler.

- [ ] **Step 3: Daten laden**

```bash
ADMIN_PW=$(grep '^PGPASSWORD=' "../BurgerMetrics/BurgerMetrics_Website/.env" | cut -d= -f2-)
DATABASE_URL="postgresql://postgres:${ADMIN_PW}@supabase.butscher.cloud:5433/hotel" python3 sql/02_load_data.py
```

Erwartung: neun Zeilen `Lade … -> hotel_bi.… ` mit „Zeilen geladen", zuletzt `fact_bookings` mit `119.390 Zeilen geladen.`

- [ ] **Step 4: Zeilenzahlen prüfen**

```bash
ssh vps 'docker exec -i supabase-db psql -U postgres -d hotel -Atc "SELECT '"'"'dim_hotel'"'"', count(*) FROM hotel_bi.dim_hotel UNION ALL SELECT '"'"'dim_date'"'"', count(*) FROM hotel_bi.dim_date UNION ALL SELECT '"'"'dim_market_segment'"'"', count(*) FROM hotel_bi.dim_market_segment UNION ALL SELECT '"'"'dim_distribution_channel'"'"', count(*) FROM hotel_bi.dim_distribution_channel UNION ALL SELECT '"'"'dim_customer_type'"'"', count(*) FROM hotel_bi.dim_customer_type UNION ALL SELECT '"'"'dim_meal'"'"', count(*) FROM hotel_bi.dim_meal UNION ALL SELECT '"'"'dim_deposit_type'"'"', count(*) FROM hotel_bi.dim_deposit_type UNION ALL SELECT '"'"'dim_country'"'"', count(*) FROM hotel_bi.dim_country UNION ALL SELECT '"'"'fact_bookings'"'"', count(*) FROM hotel_bi.fact_bookings"'
```

Erwartung: `dim_hotel|2`, `dim_date|1064`, `dim_market_segment|8`, `dim_distribution_channel|5`, `dim_customer_type|4`, `dim_meal|5`, `dim_deposit_type|3`, `dim_country|178`, `fact_bookings|119390` (Zeilen der CSV-Dateien ohne Kopfzeile).

- [ ] **Step 5: Commit**

```bash
git add sql/02_load_data.py requirements.txt .env.example
git commit -m "Ladeskript: echte Umlaute, Beispiel-URL auf hotel; Umgebungsdateien"
```

---

### Task 3: Rolle von außen prüfen

**Files:** keine Änderung (reine Prüfung, Ergebnis geht ins README von Task 6).

**Interfaces:**
- Consumes: Rolle `studi_hotel` (Task 1), geladene Tabellen (Task 2).

- [ ] **Step 1: Lesen als studi_hotel vom Mac aus**

```bash
python3 - <<'PY'
from sqlalchemy import create_engine, text
e = create_engine("postgresql://studi_hotel:thws@supabase.butscher.cloud:5433/hotel")
with e.connect() as c:
    print(c.execute(text("SHOW search_path")).scalar())
    print(c.execute(text("SELECT count(*) FROM fact_bookings")).scalar())
    print(c.execute(text("SELECT hotel, count(*) FROM fact_bookings f JOIN dim_hotel h USING (hotel_id) GROUP BY hotel ORDER BY hotel")).all())
PY
```

Erwartung: `hotel_bi`, `119390`, `[('City Hotel', 79330), ('Resort Hotel', 40060)]`.

- [ ] **Step 2: Schreiben muss scheitern, andere Datenbank muss scheitern**

```bash
python3 - <<'PY'
from sqlalchemy import create_engine, text
e = create_engine("postgresql://studi_hotel:thws@supabase.butscher.cloud:5433/hotel")
for sql in ["INSERT INTO dim_hotel VALUES (99, 'Test')", "CREATE TABLE hotel_bi.t (x int)", "DROP TABLE dim_meal"]:
    try:
        with e.begin() as c:
            c.execute(text(sql))
        print("FEHLER: ging durch:", sql)
    except Exception as ex:
        print("abgelehnt:", sql, "->", str(ex).splitlines()[0][:90])
try:
    create_engine("postgresql://studi_hotel:thws@supabase.butscher.cloud:5433/postgres").connect()
    print("FEHLER: Verbindung zu postgres möglich")
except Exception as ex:
    print("abgelehnt: postgres ->", str(ex).splitlines()[0][:90])
PY
```

Erwartung: drei Zeilen `abgelehnt: … read-only transaction` bzw. `permission denied`, und `abgelehnt: postgres -> … permission denied for database` (falls `PUBLIC` dort `CONNECT` hat, ist die Verbindung möglich; dann stattdessen prüfen, dass `SELECT * FROM burgermetrics.fact_orders LIMIT 1` mit `permission denied for schema` scheitert, und das Ergebnis im Bericht nennen).

---

### Task 4: Notebook korrigieren und verifizieren

**Files:**
- Modify: `notebooks/BI_Hotel_Booking_Demand.ipynb` (Zellen 0, 6, 7, 9, 10, 19, 20, 25, 27, 28)

**Interfaces:**
- Consumes: Rolle `studi_hotel` (Task 1) für Zelle 28.

- [ ] **Step 1: Änderungen per Python-Skript einspielen (nbformat)**

Zelle 0: nach der ersten Überschrift einen Colab-Link einfügen:
```
[![In Colab öffnen](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/swrobuts/hotel/blob/main/notebooks/BI_Hotel_Booking_Demand.ipynb)
```
und den Hinweis „Datei → In Colab öffnen, oder Link teilen" durch „Über den Link oben öffnet sich das Notebook direkt in Google Colab; zum Bearbeiten *Datei → Kopie in Drive speichern*." ersetzen.

Zelle 6 (Markdown): die drei Aufzählungspunkte ersetzen durch
```
- `children` hat vier fehlende Werte (`NaN`) → wir setzen sie auf 0 (Annahme: keine Angabe = kein Kind)
- `country` hat 488 fehlende Werte → wir markieren sie explizit als „unbekannt" (`UNK`)
- `agent` und `company` sind in der Quelldatei mit dem Text `NULL` gefüllt, wenn keine Agentur bzw. Firma beteiligt war. pandas erkennt diesen Text beim Einlesen bereits als fehlenden Wert; die beiden `replace`-Zeilen unten sichern das für andere Quellen ab, in denen `NULL` als Text stehen bleibt.
```
„**Didaktischer Punkt:**" bleibt.

Zelle 9: `begrenzt!` → `begrenzt.`; „ein sehr reales BI-Problem" → „ein typisches BI-Problem".

Zelle 10: `kpis = pd.Series({...})` wird `kpis = pd.Series({...}, dtype="object")`, damit ganze Zahlen ohne Nachkommastellen erscheinen.

Zelle 19: `df.groupby("lead_time_bucket")` → `df.groupby("lead_time_bucket", observed=True)`.

Zelle 20: `Für ein "richtiges" BI-System` → `Für ein BI-System`.

Zelle 25 (Markdown) neuer Text:
```
## 7. Export für Supabase & Power BI

Wir speichern Fakt- und Dimensionstabellen als CSV. Diese Dateien können direkt:

- in **Power BI** importiert werden („Daten abrufen" → Text/CSV), oder
- über das SQL-Schema (`sql/01_schema.sql`) und das Ladeskript (`sql/02_load_data.py`)
  in eine **Postgres-Datenbank** geladen werden.

Für die Vorlesung ist dieser Schritt bereits erledigt: Die Tabellen liegen in der
Datenbank `hotel` auf dem Server der Vorlesung (siehe Abschnitt 7.1).

In Colab landen die Dateien im temporären Colab-Dateisystem – über das Ordnersymbol
links könnt ihr sie herunterladen bzw. bei Bedarf direkt an Google Drive anbinden.
```

Zelle 27 (Markdown) neuer Text:
```
### 7.1 Lesender Zugriff auf die fertige Datenbank

Die Tabellen aus Abschnitt 6 liegen bereits in einer PostgreSQL-Datenbank auf dem
Server der Vorlesung. Der Zugang ist lesend; dieselben Zugangsdaten gelten für
Power BI, Tableau, DBeaver und `psql`:

| Angabe | Wert |
|---|---|
| Host | `supabase.butscher.cloud` |
| Port | `5433` |
| Datenbank | `hotel` |
| Schema | `hotel_bi` |
| Benutzer | `studi_hotel` |
| Kennwort | `thws` |

Die folgende Zelle liest die Stornoquote je Hoteltyp direkt aus der Datenbank.
Das Ergebnis muss mit Abschnitt 5.1 übereinstimmen.
```

Zelle 28 (Code) neuer Inhalt:
```python
%pip install -q sqlalchemy psycopg2-binary
from sqlalchemy import create_engine

engine = create_engine("postgresql://studi_hotel:thws@supabase.butscher.cloud:5433/hotel")

sql = """
SELECT h.hotel,
       COUNT(*)                                        AS buchungen,
       ROUND(AVG(f.is_canceled::int) * 100, 1)         AS stornoquote_pct
FROM   hotel_bi.fact_bookings f
JOIN   hotel_bi.dim_hotel     h ON h.hotel_id = f.hotel_id
GROUP  BY h.hotel
ORDER  BY h.hotel
"""
pd.read_sql(sql, engine)
```

- [ ] **Step 2: Notebook ausführen, Ausgaben prüfen**

```bash
cd notebooks && MPLBACKEND=Agg python3 -m jupyter nbconvert --to notebook --execute --ExecutePreprocessor.timeout=300 BI_Hotel_Booking_Demand.ipynb --output /tmp/hotel_nb_out.ipynb
```

Erwartung: kein `error`-Output; Zelle 28 liefert `City Hotel 79330 41.7` und `Resort Hotel 40060 27.8`; Zelle 10 zeigt `Anzahl Buchungen 119390` ohne Nachkommastellen; keine `FutureWarning`.

- [ ] **Step 3: CSV-Ausgabe mit `data/` vergleichen, Ausgaben entfernen**

```bash
for f in notebooks/*.csv; do cmp "$f" "data/$(basename "$f")" && echo "identisch: $(basename "$f")"; done
rm notebooks/*.csv
python3 -m jupyter nbconvert --clear-output --inplace notebooks/BI_Hotel_Booking_Demand.ipynb
```

Erwartung: neun Mal `identisch`.

- [ ] **Step 4: Commit**

```bash
git add notebooks/BI_Hotel_Booking_Demand.ipynb
git commit -m "Notebook: Colab-Link, lesender Zugriff auf hotel, pandas-Warnung, Textkorrekturen"
```

---

### Task 5: Anleitung auf die reale Instanz umschreiben

**Files:**
- Modify: `docs/Supabase_Setup_VPS.md` (vollständig neu)

- [ ] **Step 1: Datei neu schreiben** mit den Abschnitten
  1. Die Instanz (VPS, `supabase-db`, PostgreSQL 17.6, Port 5433, SSL aus, Datenbank `hotel`, Schema `hotel_bi`).
  2. Verbindungsdaten (Tabelle wie in Zelle 27; Admin: `postgres`, Kennwort auf dem VPS in `/root/supabase/docker/.env`).
  3. Neuaufbau der Datenbank in drei Befehlen (`CREATE DATABASE hotel OWNER postgres`, `01_schema.sql`, `02_load_data.py`, `03_rolle_studi_hotel.sql`) mit den exakten Kommandos aus Task 1 und 2.
  4. Sicherheit: warum die Rolle nur liest, warum das Kennwort im Repo steht, dass SSL aus ist und was das für Power BI/Tableau bedeutet.
  5. Quelle: Self-Hosting-Doku von Supabase.

- [ ] **Step 2: Commit**

```bash
git add docs/Supabase_Setup_VPS.md
git commit -m "Anleitung: reale Instanz, Zugang, Neuaufbau"
```

---

### Task 6: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: README schreiben** mit den Abschnitten
  1. Titel, ein Absatz Zweck, Colab-Badge.
  2. Zugang zur Datenbank (Tabelle Host/Port/Datenbank/Schema/Benutzer/Kennwort).
  3. Schnellstart je Werkzeug: Colab (Link), Power BI Desktop (PostgreSQL-Datenbank, Server `supabase.butscher.cloud:5433`, Datenbank `hotel`, Import-Modus, Anmeldung „Datenbank", Nachfrage zur unverschlüsselten Verbindung bestätigen, im Navigator Schema `hotel_bi`), Tableau (PostgreSQL, Treiber-Hinweis, SSL aus), DBeaver/psql (Verbindungszeile), Python (drei Zeilen mit `pd.read_sql`).
  4. Inhalt des Repos (Tabelle).
  5. Datenmodell (Fakt + 8 Dimensionen, `dim_date` doppelt referenziert).
  6. Neuaufbau für Dozierende (Verweis auf `docs/Supabase_Setup_VPS.md`).
  7. Datenquelle und Lizenz (Antonio, de Almeida & Nunes 2019; Kaggle; TidyTuesday).
  8. Was als Nächstes kommt (Power BI/Tableau, Dashboard) — ein Satz.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "README: Zugang, Schnellstart, Aufbau"
```

---

### Task 7: GitHub-Repo, Push, Abnahme

- [ ] **Step 1: Repo anlegen und pushen**

```bash
gh repo create swrobuts/hotel --public --description "BI-Lehrprojekt Hotel Booking Demand: Colab-Notebook, Sternschema, Postgres-Datenbank hotel" --source . --remote origin --push
```

- [ ] **Step 2: Frischer Klon, Ladeskript daraus**

```bash
git clone https://github.com/swrobuts/hotel.git /tmp/hotel-klon && cd /tmp/hotel-klon
ls data sql notebooks; test ! -e "*.docx"
ADMIN_PW=$(grep '^PGPASSWORD=' "<BurgerMetrics_Website>/.env" | cut -d= -f2-)
DATABASE_URL="postgresql://postgres:${ADMIN_PW}@supabase.butscher.cloud:5433/hotel" python3 sql/02_load_data.py
```

Erwartung: kein `.docx` im Klon; Ladeskript endet mit `Fertig.`; Zeilenzahlen wie in Task 2 Step 4.

- [ ] **Step 3: Colab-Link und Repo-Seite aufrufen**

Browser: `https://colab.research.google.com/github/swrobuts/hotel/blob/main/notebooks/BI_Hotel_Booking_Demand.ipynb` und `https://github.com/swrobuts/hotel` — Notebook öffnet sich, README wird angezeigt.

- [ ] **Step 4: Plan-Häkchen setzen, Commit, Push**

```bash
git add docs/superpowers/plans/2026-09-12-hotel-produktivsetzung.md
git commit -m "Plan: Umsetzung abgeschlossen"
git push
```
