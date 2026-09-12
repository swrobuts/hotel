# Setup: Self-hosted Supabase auf einem VPS für das BI-Lehrprojekt "Hotel Booking Demand"

Diese Kurzanleitung richtet sich an Dozent:innen, die Supabase **selbst
gehostet** (nicht die Cloud-Version) per Docker Compose auf einem eigenen
VPS betreiben und das Sternschema aus `01_schema.sql` sowie die CSV-Daten
für das BI-Lehrprojekt einspielen möchten.

## a) Kurzüberblick: Self-hosted Supabase via Docker Compose

Supabase besteht self-hosted aus mehreren Docker-Containern (Postgres,
Studio, API-Gateway/Kong, Auth, Realtime, Storage, Connection Pooler
Supavisor u.a.), die per Docker Compose gemeinsam gestartet werden. Auf
dem VPS werden Git, Docker sowie Docker Compose benötigt. Grundschritte:

```sh
# Schnellstart-Skript (installiert Docker, lädt Konfiguration, erzeugt Secrets)
curl -fsSL https://supabase.link/setup.sh | sh
cd supabase-project && sh run.sh start
```

Alternativ manuell:

```sh
git clone --depth 1 --branch self-hosted/v0.8.1 https://github.com/supabase/supabase
mkdir supabase-project
cp -rf supabase/docker/. supabase-project
cd supabase-project
cp .env.example .env          # .env danach mit eigenen Secrets/Passwörtern befüllen!
docker compose pull
docker compose up -d --wait
docker compose ps             # Status prüfen (sollte "healthy" zeigen)
```

Supabase Studio (Web-Oberfläche inkl. SQL Editor und Table Editor) ist
danach standardmäßig über das API-Gateway auf **Port 8000** des VPS
erreichbar. Die vollständige, aktuelle Referenz mit allen Details zu
Secrets, Reverse Proxy und HTTPS findet sich in der offiziellen
Dokumentation: [Self-Hosting with Docker – Supabase Docs](https://supabase.com/docs/guides/self-hosting/docker).

> **Wichtig:** Die Beispielwerte aus `.env.example` (Passwörter, JWT-Keys)
> dürfen **nie** unverändert produktiv/öffentlich verwendet werden.

## b) Schema aus `01_schema.sql` einspielen

**Option 1 – Supabase SQL Editor (Studio-Weboberfläche):**
1. Studio im Browser öffnen (`http://<VPS-IP>:8000`, ggf. hinter Reverse
   Proxy mit eigener Domain/HTTPS).
2. Im Menü *SQL Editor* → *New query* öffnen.
3. Inhalt von `sql/01_schema.sql` einfügen und mit *Run* ausführen.
4. Kontrolle: Im *Table Editor* sollte links das Schema `hotel_bi` mit
   allen Dimensions- und der Faktentabelle erscheinen.

**Option 2 – `psql` direkt vom Dozenten-Rechner oder auf dem VPS:**

```sh
psql "$DATABASE_URL" -f sql/01_schema.sql
```

`DATABASE_URL` ist dabei die Postgres-Connection-URI (siehe Abschnitt d).

## c) CSV-Daten laden

**Option 1 – mit `02_load_data.py` (empfohlen, da wiederholbar/idempotent):**

```sh
pip install pandas psycopg2-binary sqlalchemy
export DATABASE_URL="postgresql://postgres:<PASSWORT>@<HOST>:5432/postgres"
python sql/02_load_data.py
```

Das Skript leert (`TRUNCATE`) vor jedem Ladevorgang zunächst die
Zieltabelle und lädt dann die aktuelle CSV-Datei per `COPY` neu – so
kann es beim Aktualisieren der Übungsdaten beliebig oft wiederholt
werden, ohne Duplikate zu erzeugen. Die Reihenfolge ist fest codiert:
zuerst alle Dimensionstabellen, danach `fact_bookings`.

**Option 2 – Supabase Studio Table Editor (manueller Import):**
1. Zuerst `01_schema.sql` ausgeführt haben (Tabellen müssen existieren).
2. Im *Table Editor* die jeweilige Tabelle öffnen (z.B. `dim_hotel`),
   Reihenfolge beachten: **erst alle `dim_*`-Tabellen, dann
   `fact_bookings`**.
3. Über den Import-Button (CSV-Icon) die passende Datei aus `data/`
   hochladen und die automatische Spaltenzuordnung prüfen (Spaltennamen
   in CSV und Tabelle stimmen bereits überein).
4. Diese Variante eignet sich für kleine Dimensionstabellen gut; für die
   große Faktentabelle (`fact_bookings.csv`, ca. 120.000 Zeilen) ist das
   Python-Skript mit `COPY` deutlich schneller und robuster.

## d) Connection-String-Daten für Power BI und Python/R finden

Self-hosted Supabase nutzt denselben Postgres-Server wie die Cloud-Version.
Die benötigten Angaben:

| Angabe | Wert / Fundort |
|---|---|
| Host | IP-Adresse oder Domain des VPS |
| Port (direkte Verbindung) | `5432` |
| Port (Connection Pooler / Supavisor) | `6543` – empfohlen bei vielen kurzlebigen Verbindungen (z.B. Web-Apps); für BI-Tools wie Power BI ist meist die direkte Verbindung über `5432` ausreichend |
| Datenbankname | `postgres` (Standardname) |
| Benutzer | `postgres` (Standard-Superuser) |
| Passwort | `POSTGRES_PASSWORD` aus der `.env`-Datei im `supabase-project`-Ordner auf dem VPS (auslesbar z.B. mit `sh run.sh secrets` oder `grep POSTGRES_PASSWORD .env`) |

**Power BI (Postgres-Connector):** *Get Data → PostgreSQL database* →
Server = `<Host>:5432` (oder `:6543` für den Pooler), Datenbank =
`postgres`, danach Benutzer/Passwort eingeben. SSL sollte aktiviert
werden, falls der VPS TLS terminiert (siehe Sicherheit unten).

**Python/R (SQLAlchemy):**

```python
from sqlalchemy import create_engine
engine = create_engine("postgresql://postgres:<PASSWORT>@<HOST>:5432/postgres")
```

In R analog z.B. mit `RPostgres::dbConnect()` unter Verwendung derselben
Host-, Port-, Datenbank-, Benutzer- und Passwortwerte.

## e) Hinweis zu Security

- Den Postgres-Port (`5432`/`6543`) **nicht** ungeschützt aus dem
  öffentlichen Internet erreichbar machen bzw. mindestens durch eine
  Firewall (z.B. nur bestimmte IP-Adressen/Uni-Netz zulassen) absichern.
- Immer ein **starkes, individuelles Passwort** für `POSTGRES_PASSWORD`
  setzen (niemals die Beispielwerte aus `.env.example` übernehmen) und
  Verbindungen nach Möglichkeit über **SSL/TLS** verschlüsseln.
- Für den produktiven Supabase-Einsatz (nicht nur reine BI-Übungszwecke)
  empfiehlt Supabase zusätzlich **Row Level Security (RLS)** auf allen
  Tabellen, die über die Auto-generierte REST-/API-Schicht zugänglich
  sind, um Zugriffe pro Nutzer:in einzuschränken. Für dieses rein
  lehrbezogene BI-Schema (`hotel_bi`), das ausschließlich per
  Datenbank-Connection (Power BI, Python/R) und nicht über die
  öffentliche Supabase-API genutzt wird, ist RLS optional, schadet aber
  als zusätzliche Absicherung nicht.

---
**Quelle:** [Self-Hosting with Docker – offizielle Supabase-Dokumentation](https://supabase.com/docs/guides/self-hosting/docker)
