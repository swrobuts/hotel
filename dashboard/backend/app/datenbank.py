"""Verbindung zur Datenbank hotel.

Die Adresse kommt aus der Umgebungsvariablen DATABASE_URL. Fehlt sie, gilt der
lesende Zugang der Vorlesung (Rolle studi_hotel), der auch im README steht.
"""

import os
from decimal import Decimal

from sqlalchemy import create_engine, text

STANDARD_URL = "postgresql://studi_hotel:thws@supabase.butscher.cloud:5433/hotel"

_engine = None


def engine():
    """Baut die Engine beim ersten Aufruf und behält sie; sie verwaltet einen kleinen Verbindungspool."""
    global _engine
    if _engine is None:
        url = os.environ.get("DATABASE_URL", STANDARD_URL)
        _engine = create_engine(url, pool_size=4, max_overflow=4, pool_pre_ping=True)
    return _engine


def als_zahl(wert):
    """Postgres liefert NUMERIC als Decimal; für JSON wird daraus eine gewöhnliche Gleitkommazahl."""
    return float(wert) if isinstance(wert, Decimal) else wert


def abfragen(sql: str, parameter: dict | None = None) -> list[dict]:
    """Führt eine SELECT-Abfrage aus und gibt die Zeilen als Liste von Wörterbüchern zurück."""
    with engine().connect() as verbindung:
        ergebnis = verbindung.execute(text(sql), parameter or {})
        return [{spalte: als_zahl(wert) for spalte, wert in zeile._mapping.items()} for zeile in ergebnis]
