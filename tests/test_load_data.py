"""CSV-Prüfung und Rollback des gesamten Imports, ohne Zugriff auf die Lehrdatenbank.

SQLite ersetzt nur PostgreSQL-spezifisches TRUNCATE/COPY. Die echte
SQLAlchemy-Transaktion muss auch bereits geschriebene Dimensionen zurückrollen.
"""

import importlib.util
from pathlib import Path

import pandas as pd
import pytest
from sqlalchemy import create_engine, text

spec = importlib.util.spec_from_file_location(
    "hotel_loader", Path(__file__).resolve().parents[1] / "sql" / "02_load_data.py"
)
loader = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loader)


@pytest.fixture
def import_umgebung(tmp_path, monkeypatch):
    engine = create_engine("sqlite://")
    tables = loader.DIMENSION_TABLES + loader.FACT_TABLES
    with engine.begin() as conn:
        for file_stem, name in tables:
            conn.execute(text(f'CREATE TABLE "{name}" (id INTEGER PRIMARY KEY)'))
            conn.execute(text(f'INSERT INTO "{name}" VALUES (1)'))
            (tmp_path / f"{file_stem}.csv").write_text("id\n2\n", encoding="utf-8")

    def leeren(conn):
        for _, name in tables:
            conn.execute(text(f'DELETE FROM "{name}"'))

    def kopieren(conn, df, table_name):
        for value in df["id"]:
            conn.execute(text(f'INSERT INTO "{table_name}" VALUES (:id)'), {"id": int(value)})

    monkeypatch.setattr(loader, "truncate_tables", leeren)
    monkeypatch.setattr(loader, "copy_dataframe", kopieren)
    yield engine, tmp_path, tables
    engine.dispose()


def inhalt(engine, tables):
    with engine.connect() as conn:
        return [conn.execute(text(f'SELECT id FROM "{name}"')).scalars().all() for _, name in tables]


def test_erfolgreicher_import_ersetzt_alle_tabellen(import_umgebung):
    engine, folder, tables = import_umgebung
    loader.load_tables(engine, folder)
    assert inhalt(engine, tables) == [[2]] * 9


def test_spaeter_importfehler_stellt_alle_tabellen_wieder_her(import_umgebung):
    engine, folder, tables = import_umgebung
    # Erst die letzte CSV scheitert am Primärschlüssel, nach acht Dimensionen.
    (folder / "fact_bookings.csv").write_text("id\n2\n2\n", encoding="utf-8")
    with pytest.raises(Exception, match="UNIQUE constraint failed"):
        loader.load_tables(engine, folder)
    assert inhalt(engine, tables) == [[1]] * 9


def test_fehlende_csv_aendert_keine_tabelle(import_umgebung):
    engine, folder, tables = import_umgebung
    (folder / "fact_bookings.csv").unlink()
    with pytest.raises(FileNotFoundError):
        loader.load_tables(engine, folder)
    assert inhalt(engine, tables) == [[1]] * 9


@pytest.mark.parametrize("wert", [None, float("nan"), 2, -1, "false"])
def test_ungueltige_booleanwerte_werden_nicht_stillschweigend_wahr(wert):
    df = pd.DataFrame({"is_canceled": [0, wert], "is_repeated_guest": [1, 0]})
    with pytest.raises(ValueError, match="is_canceled"):
        loader.prepare_fact_bookings(df)


def test_booleanwerte_aus_der_projekt_csv():
    df = pd.DataFrame({"is_canceled": [0, 1], "is_repeated_guest": [1, 0]})
    result = loader.prepare_fact_bookings(df)
    assert result["is_canceled"].tolist() == [False, True]
    assert result["is_repeated_guest"].tolist() == [True, False]
    assert str(df["is_canceled"].dtype).startswith("int")
