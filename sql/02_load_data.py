#!/usr/bin/env python3
"""
02_load_data.py
================================================================================
Ladeskript für das BI-Lehrprojekt "Hotel Booking Demand" (Sternschema).
Datenquelle: Nuno Antonio, Ana de Almeida und Luis Nunes, "Hotel booking demand
datasets", Data in Brief, Band 22, Februar 2019 (CC BY 4.0).

Liest die finalen CSV-Dateien aus dem Ordner data/ und lädt sie in die
Tabellen, die von 01_schema.sql im Schema "hotel_bi" angelegt wurden.

VORAUSSETZUNGEN (pip install):
--------------------------------------------------------------------------
    pip install pandas psycopg2-binary sqlalchemy

    (psycopg2-binary reicht für normale Nutzung/Lehrzwecke aus;
    für produktive Systeme ggf. psycopg2 aus dem Quellcode kompilieren.)

VERBINDUNG ZUR DATENBANK:
--------------------------------------------------------------------------
Die Verbindung wird ausschließlich über die Umgebungsvariable
DATABASE_URL aufgebaut, z.B.:

    export DATABASE_URL="postgresql://postgres:MEIN_PASSWORT@supabase.butscher.cloud:5433/hotel"

Bei self-hosted Supabase entspricht das dem POSTGRES_PASSWORD aus der
.env-Datei des Docker-Compose-Setups (siehe docs/Supabase_Setup_VPS.md).

REIHENFOLGE DES LADENS (wichtig wegen Fremdschlüssel-Constraints):
--------------------------------------------------------------------------
1. Zuerst ALLE Dimensionstabellen (dim_*), da die Faktentabelle
   Fremdschlüssel (FOREIGN KEY) auf diese Tabellen besitzt.
2. Danach die Faktentabelle (fact_bookings), da sie von den
   Dimensionen abhängt.

IDEMPOTENZ:
--------------------------------------------------------------------------
Das Skript führt vor jedem Laden ein TRUNCATE der Zieltabelle aus,
damit es beliebig oft wiederholt werden kann, ohne Duplikate zu
erzeugen ("idempotent"). Das bedeutet: ALLE vorher in diesen Tabellen
gespeicherten Daten werden gelöscht und durch den aktuellen Inhalt
der CSV-Dateien ersetzt!
--> Bitte nur ausführen, wenn das so gewünscht ist (z.B. beim
    (Neu-)Aufsetzen der Übungsdatenbank). Für produktive Daten ist
    ein TRUNCATE-basierter Full-Reload NICHT geeignet.

AUSFÜHRUNG:
--------------------------------------------------------------------------
    export DATABASE_URL="postgresql://postgres:PASSWORT@supabase.butscher.cloud:5433/hotel"
    python 02_load_data.py

    Optional: Pfad zum Datenordner über --data-dir angeben
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
# Laden umgewandelt werden müssen.
FACT_BOOLEAN_COLUMNS = ["is_canceled", "is_repeated_guest"]


def get_engine():
    """Baut die Datenbankverbindung ausschließlich über DATABASE_URL auf."""
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        sys.exit(
            "FEHLER: Umgebungsvariable DATABASE_URL ist nicht gesetzt.\n"
            "Beispiel:\n"
            '  export DATABASE_URL="postgresql://postgres:PASSWORT@supabase.butscher.cloud:5433/hotel"'
        )
    # sqlalchemy erwartet das Präfix "postgresql://" (nicht "postgres://")
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)
    return create_engine(database_url)


def load_dataframe(csv_path: Path) -> pd.DataFrame:
    """Liest eine CSV-Datei ein. dtypes werden von pandas automatisch erkannt,
    da die CSVs bereits die finalen Spaltennamen/-typen besitzen."""
    return pd.read_csv(csv_path)


def truncate_table(conn, table_name: str):
    """Leert die Zieltabelle vor dem Neuladen (idempotentes Verhalten).

    BESTÄTIGUNG: Mit dem Aufruf dieses Skripts bestätigt der/die
    Ausführende, dass alle vorhandenen Daten in hotel_bi.<table_name>
    gelöscht und durch den Inhalt der aktuellen CSV-Datei ersetzt
    werden sollen (CASCADE, um abhängige Fremdschlüssel-Zeilen mit
    zu leeren, z.B. fact_bookings beim Leeren einer Dimension).
    """
    print(f"  -> TRUNCATE {SCHEMA}.{table_name} (CASCADE) ...")
    conn.execute(text(f'TRUNCATE TABLE "{SCHEMA}"."{table_name}" CASCADE;'))


def copy_dataframe(conn, df: pd.DataFrame, table_name: str):
    """Lädt einen DataFrame per COPY (schnell, für große Tabellen wie
    fact_bookings geeignet) in die Zieltabelle. Nutzt die raw DBAPI-
    Verbindung von psycopg2 für den COPY-Befehl."""
    buffer = io.StringIO()
    # NaN/NULL sauber als leeren String für COPY markieren
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
        description="Lädt die Hotel-Booking-CSV-Dateien in das hotel_bi-Sternschema."
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
    print("Lade Dimensionstabellen (müssen vor der Faktentabelle geladen werden)")
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
