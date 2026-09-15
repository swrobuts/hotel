"""Live-Abnahme des Demo-Zugangs; alle Schreibproben werden zurueckgerollt.

Aufruf: python sql/06_pruefe_leserechte.py
Optionaler abweichender Demo-DSN ueber STUDI_HOTEL_URL. Niemals Admin-Zugang
verwenden. Die Gegenproben testen dieselbe Rolle in allen anderen Datenbanken,
lesen dort aber keine Daten. Fehler oder unklare Ergebnisse ergeben Exitcode 1.
"""

import os
import sys
import uuid

import psycopg2
from psycopg2 import sql

DSN = os.environ.get(
    "STUDI_HOTEL_URL",
    "postgresql://studi_hotel:thws@supabase.butscher.cloud:5433/hotel",
)
LO_WRITERS = (
    "lo_creat", "lo_create", "lo_from_bytea", "lo_put", "lowrite", "lo_unlink",
    "lo_truncate", "lo_truncate64", "lo_import", "lo_export",
)
EXPECTED_COUNTS = {
    "dim_hotel": 2, "dim_date": 1064, "dim_country": 178,
    "dim_market_segment": 8, "dim_distribution_channel": 5,
    "dim_customer_type": 4, "dim_meal": 5, "dim_deposit_type": 3,
    "fact_bookings": 119390,
}


def audit():
    failures = []
    checks = 0

    def check(name, passed):
        nonlocal checks
        checks += 1
        print(f"{'OK' if passed else 'FEHLER'}: {name}")
        if not passed:
            failures.append(name)

    conn = psycopg2.connect(DSN, connect_timeout=10, application_name="hotel_readonly_audit")
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT current_user, current_database()")
            if cur.fetchone() != ("studi_hotel", "hotel"):
                raise RuntimeError("Abnahme muss als studi_hotel in hotel laufen")
            cur.execute("SET statement_timeout='15s'; SET lock_timeout='1s'")
            cur.execute("""SELECT NOT (rolsuper OR rolcreaterole OR rolcreatedb
                OR rolreplication OR rolbypassrls) FROM pg_roles WHERE rolname=current_user""")
            check("Keine administrativen Rollenattribute", cur.fetchone()[0])
            cur.execute("SELECT NOT EXISTS (SELECT 1 FROM pg_auth_members WHERE member=current_user::regrole)")
            check("Keine geerbten Rollen", cur.fetchone()[0])
            cur.execute("""SELECT NOT has_database_privilege(current_user,current_database(),'CREATE')
                AND NOT has_database_privilege(current_user,current_database(),'TEMP')""")
            check("Keine CREATE- oder TEMP-Rechte", cur.fetchone()[0])
            cur.execute("""SELECT NOT EXISTS (SELECT 1 FROM pg_namespace
                WHERE nspname NOT LIKE 'pg_%' AND nspname<>'information_schema'
                AND has_schema_privilege(current_user,oid,'CREATE'))""")
            check("Kein beschreibbares Anwendungsschema", cur.fetchone()[0])
            cur.execute("""SELECT NOT EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
                WHERE n.nspname NOT LIKE 'pg_%' AND n.nspname<>'information_schema'
                  AND c.relkind IN ('r','p','v','m','f') AND (
                    c.relowner=current_user::regrole
                    OR has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
                    OR has_any_column_privilege(current_user,c.oid,'INSERT,UPDATE,REFERENCES')))""")
            check("Keine Tabellen-/Spaltenschreibrechte oder Eigentumsrechte", cur.fetchone()[0])
            cur.execute("""SELECT NOT EXISTS (SELECT 1 FROM pg_proc p
                WHERE p.pronamespace='pg_catalog'::regnamespace AND p.proname=ANY(%s)
                AND has_function_privilege(current_user,p.oid,'EXECUTE'))""", (list(LO_WRITERS),))
            check("Keine aufrufbaren Large-Object-Schreibfunktionen", cur.fetchone()[0])
            cur.execute("""SELECT NOT EXISTS (SELECT 1 FROM pg_proc p WHERE p.prosecdef
                AND has_schema_privilege(current_user,p.pronamespace,'USAGE')
                AND has_function_privilege(current_user,p.oid,'EXECUTE'))""")
            check("Keine aufrufbaren SECURITY-DEFINER-Funktionen", cur.fetchone()[0])
            cur.execute("SELECT NOT EXISTS (SELECT 1 FROM pg_largeobject_metadata WHERE lomowner=current_user::regrole)")
            check("Keine eigenen persistenten Large Objects", cur.fetchone()[0])

            for table, expected in EXPECTED_COUNTS.items():
                cur.execute(sql.SQL("SELECT count(*) FROM hotel_bi.{}").format(sql.Identifier(table)))
                check(f"{table}: {expected} Zeilen lesbar", cur.fetchone()[0] == expected)

            probe_table = sql.Identifier("readonly_probe_" + uuid.uuid4().hex)
            probes = {
                "INSERT": "EXPLAIN INSERT INTO hotel_bi.dim_hotel SELECT * FROM hotel_bi.dim_hotel WHERE false",
                "UPDATE": "EXPLAIN UPDATE hotel_bi.dim_hotel SET hotel=hotel WHERE false",
                "DELETE": "EXPLAIN DELETE FROM hotel_bi.dim_hotel WHERE false",
                "Tabelle anlegen": sql.SQL("CREATE TABLE hotel_bi.{} (id int)").format(probe_table),
                "Temporäre Tabelle anlegen": sql.SQL("CREATE TEMP TABLE {} (id int)").format(probe_table),
                "lo_create": "SELECT lo_create(0)",
                "lo_creat": "SELECT lo_creat(-1)",
                "lo_from_bytea": "SELECT lo_from_bytea(0, ''::bytea)",
            }
            for name, statement in probes.items():
                blocked = False
                try:
                    # Absichtlich ohne die abschaltbare Read-only-Voreinstellung.
                    cur.execute("BEGIN READ WRITE")
                    cur.execute(statement)
                except psycopg2.Error as exc:
                    blocked = exc.pgcode == "42501"
                finally:
                    cur.execute("ROLLBACK")
                check(f"{name} auch mit READ WRITE verweigert", blocked)

            cur.execute("SELECT datname FROM pg_database WHERE datallowconn AND datname<>current_database() ORDER BY datname")
            other_databases = [row[0] for row in cur.fetchall()]

        for database in other_databases:
            denied = False
            try:
                other = psycopg2.connect(DSN, dbname=database, connect_timeout=5,
                                        application_name="hotel_readonly_audit")
            except psycopg2.Error as exc:
                # Ein Timeout/Netzwerkfehler gilt nicht als erfolgreicher Rechte-Test.
                denied = "pg_hba.conf rejects connection" in str(exc) or exc.pgcode == "42501"
            else:
                other.close()
            check(f"Anmeldung in {database} abgelehnt", denied)
    finally:
        conn.close()

    print(f"{checks} Prüfungen, {len(failures)} Fehler")
    return 1 if failures else 0


if __name__ == "__main__":
    try:
        sys.exit(audit())
    except (psycopg2.Error, RuntimeError) as error:
        print(f"Abnahme abgebrochen: {error}", file=sys.stderr)
        sys.exit(1)
