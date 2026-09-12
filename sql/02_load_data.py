#!/usr/bin/env python3
"""
02_load_data.py
================================================================================
Ladeskript fuer das BI-Lehrprojekt "Hotel Booking Demand" (Sternschema).

Liest die finalen CSV-Dateien aus dem Ordner data/ und laedt sie in die
Tabellen, die von 01_schema.sql im Schema "hotel_bi" angelegt wurden.

VORAUSSETZUNGEN (pip install):
--------------------------------------------------------------------------
    pip install pandas psycopg2-binary sqlalchemy

    (psycopg2-binary reicht fuer normale Nutzung/Lehrzwecke aus;
    fuer produktive Systeme ggf. psycopg2 aus dem Quellcode kompilieren.)

VERBINDUNG ZUR DATENBANK:
--------------------------------------------------------------------------
Die Verbindung wird ausschliesslich ueber die Umgebungsvariable
DATABASE_URL aufgebaut, z.B.:

    export DATABASE_URL="postgresql://postgres:MEIN_PASSWORT@vps-host:5432/postgres"

Bei self-hosted Supabase entspricht das dem POSTGRES_PASSWORD aus der
.env-Datei des Docker-Compose-Setups (siehe docs/Supabase_Setup_VPS.md).

REIHENFOLGE DES LADENS (wichtig wegen Fremdschluessel-Constraints):
--------------------------------------------------------------------------
1. Zuerst ALLE Dimensionstabellen (dim_*), da die Faktentabelle
   Fremdschluessel (FOREIGN KEY) auf diese Tabellen besitzt.
2. Danach die Faktentabelle (fact_bookings), da sie von den
   Dimensionen abhaengt.

IDEMPOTENZ:
--------------------------------------------------------------------------
Das Skript fuehrt vor jedem Laden ein TRUNCATE der Zieltabelle aus,
damit es beliebig oft wiederholt werden kann, ohne Duplikate zu
erzeugen ("idempotent"). Das bedeutet: ALLE vorher in diesen Tabellen
gespeicherten Daten werden geloescht und durch den aktuellen Inhalt
der CSV-Dateien ersetzt!
--> Bitte nur ausfuehren, wenn das so gewuenscht ist (z.B. beim
    (Neu-)Aufsetzen der Uebungsdatenbank). Fuer produktive Daten ist
    ein TRUNCATE-basierter Full-Reload NICHT geeignet.

AUSFUEHRUNG:
--------------------------------------------------------------------------
    export DATABASE_URL="postgresql://postgres:PASSWORT@HOST:5432/postgres"
    python 02_load_data.py

    Optional: Pfad zum Datenordner ueber --data-dir angeben
    (Standard: ../data relativ zu diesem Skript).
================================================================================
"""

import argparse
import io
import os
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

# ------------------------------------------------------------------
# Reihenfolge der Tabellen: zuerst Dimensionen, dann die Faktentabelle.
# (dateiname_ohne_endung, tabellenname_im_schema)
# ------------------------------------------------------------------
DIMENSION_TABLES = [
    ("dim_hotel", "dim_hotel"),
    ("dim_date", "dim_date"),
    ("dim_market_segment", "dim_market_segment"),
    ("dim_distribution_channel", "dim_distribution_channel"),
    ("dim_customer_type", "dim_customer_type"),
    ("dim_meal", "dim_meal"),
    ("dim_deposit_type", "dim_deposit_type"),
    ("dim_country", "dim_country"),
]

FACT_TABLES = [
    ("fact_bookings", "fact_bookings"),
]

SCHEMA = "hotel_bi"

# Spalten der Faktentabelle, die als BOOLEAN in Postgres angelegt sind,
# in den CSV-Dateien aber als 0/1 (int) vorliegen und daher vor dem
# Laden umgewandelt werden muessen.
FACT_BOOLEAN_COLUMNS = ["is_canceled", "is_repeated_guest"]


def get_engine():
    """Baut die Datenbankverbindung ausschliesslich ueber DATABASE_URL auf."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit(
            "FEHLER: Umgebungsvariable DATABASE_URL ist nicht gesetzt.\n"
            "Beispiel:\n"
            '  export DATABASE_URL="postgresql://postgres:PASSWORT@HOST:5432/postgres"'
        )
    # sqlalchemy erwartet das Praefix "postgresql://" (nicht "postgres://")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    return create_engine(database_url)


def load_dataframe(csv_path: Path) -> pd.DataFrame:
    """Liest eine CSV-Datei ein. dtypes werden von pandas automatisch erkannt,
    da die CSVs bereits die finalen Spaltennamen/-typen besitzen."""
    return pd.read_csv(csv_path)


def truncate_table(conn, table_name: str):
    """Leert die Zieltabelle vor dem Neuladen (idempotentes Verhalten).

    BESTAETIGUNG: Mit dem Aufruf dieses Skripts bestaetigt der/die
    Ausfuehrende, dass alle vorhandenen Daten in hotel_bi.<table_name>
    geloescht und durch den Inhalt der aktuellen CSV-Datei ersetzt
    werden sollen (CASCADE, um abhaengige Fremdschluessel-Zeilen mit
    zu leeren, z.B. fact_bookings beim Leeren einer Dimension).
    """
    print(f"  -> TRUNCATE {SCHEMA}.{table_name} (CASCADE) ...")
    conn.execute(text(f'TRUNCATE TABLE "{SCHEMA}"."{table_name}" CASCADE;'))


def copy_dataframe(conn, df: pd.DataFrame, table_name: str):
    """Laedt einen DataFrame per COPY (schnell, fuer grosse Tabellen wie
    fact_bookings geeignet) in die Zieltabelle. Nutzt die raw DBAPI-
    Verbindung von psycopg2 fuer den COPY-Befehl."""
    buffer = io.StringIO()
    # NaN/NULL sauber als leeren String fuer COPY markieren
    df.to_csv(buffer, index=False, header=False, na_rep="\\N")
    buffer.seek(0)

    columns = ", ".join(f'"{c}"' for c in df.columns)
    copy_sql = (
        f'COPY "{SCHEMA}"."{table_name}" ({columns}) '
        f"FROM STDIN WITH (FORMAT csv, NULL '\\N')"
    )

    raw_conn = conn.connection  # zugrunde liegende DBAPI-Verbindung (psycopg2)
    cursor = raw_conn.cursor()
    cursor.copy_expert(copy_sql, buffer)
    cursor.close()


def prepare_fact_bookings(df: pd.DataFrame) -> pd.DataFrame:
    """Wandelt 0/1-Integer-Spalten der Faktentabelle in echte Booleans um,
    damit sie zum BOOLEAN-Datentyp aus 01_schema.sql passen."""
    df = df.copy()
    for col in FACT_BOOLEAN_COLUMNS:
        if col in df.columns:
            df[col] = df[col].astype(bool)
    return df


def load_table(engine, data_dir: Path, file_stem: str, table_name: str):
    csv_path = data_dir / f"{file_stem}.csv"
    if not csv_path.exists():
        sys.exit(f"FEHLER: CSV-Datei nicht gefunden: {csv_path}")

    print(f"Lade {csv_path.name} -> {SCHEMA}.{table_name} ...")
    df = load_dataframe(csv_path)

    if table_name == "fact_bookings":
        df = prepare_fact_bookings(df)

    with engine.begin() as conn:
        truncate_table(conn, table_name)
        copy_dataframe(conn, df, table_name)

    print(f"  -> {len(df):,} Zeilen geladen.".replace(",", "."))


def main():
    parser = argparse.ArgumentParser(
        description="Laedt die Hotel-Booking-CSV-Dateien in das hotel_bi-Sternschema."
    )
    default_data_dir = Path(__file__).resolve().parent.parent / "data"
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=default_data_dir,
        help=f"Ordner mit den CSV-Dateien (Standard: {default_data_dir})",
    )
    args = parser.parse_args()

    engine = get_engine()

    print("=" * 70)
    print("Lade Dimensionstabellen (muessen vor der Faktentabelle geladen werden)")
    print("=" * 70)
    for file_stem, table_name in DIMENSION_TABLES:
        load_table(engine, args.data_dir, file_stem, table_name)

    print()
    print("=" * 70)
    print("Lade Faktentabelle")
    print("=" * 70)
    for file_stem, table_name in FACT_TABLES:
        load_table(engine, args.data_dir, file_stem, table_name)

    print()
    print("Fertig. Alle Tabellen wurden (neu) geladen.")


if __name__ == "__main__":
    main()
