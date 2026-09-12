"""Eine Funktion je Kennzahlblock oder Diagramm — jede mit ihrem SQL.

Alle Abfragen gehen vom Sternschema aus: Faktentabelle plus Dimensionen.
Die Kennzahlen sind so definiert wie im Notebook und im Power-BI-Katalog.
Jede Funktion gibt die Zeilen und den SQL-Text zurück, damit das Dashboard
die Abfrage anzeigen kann.
"""

from .datenbank import abfragen
from .filter import VORLAUFZEIT_BUCKET, Filter, where_klausel

# Das Sternschema als FROM-Teil: Faktentabelle und alle Dimensionen; d = Anreisedatum.
STERN = """FROM hotel_bi.fact_bookings f
  JOIN hotel_bi.dim_hotel h ON h.hotel_id = f.hotel_id
  JOIN hotel_bi.dim_date d ON d.date_key = f.arrival_date_key
  JOIN hotel_bi.dim_market_segment ms ON ms.market_segment_id = f.market_segment_id
  JOIN hotel_bi.dim_distribution_channel dc ON dc.distribution_channel_id = f.distribution_channel_id
  JOIN hotel_bi.dim_customer_type ct ON ct.customer_type_id = f.customer_type_id
  JOIN hotel_bi.dim_deposit_type dt ON dt.deposit_type_id = f.deposit_type_id
  JOIN hotel_bi.dim_country c ON c.country_id = f.country_id"""

# Dieselben Kennzahlen je Gruppe, wie im Katalog definiert. Neben den Quoten
# stehen die Summen, aus denen das Frontend Gruppen korrekt zusammenfassen kann.
KENNZAHLEN = """COUNT(*)                                             AS anzahl,
  SUM(f.is_canceled::int)                              AS stornierungen,
  AVG(f.is_canceled::int)                              AS stornoquote,
  AVG(f.adr)                                           AS adr,
  SUM(f.adr)                                           AS adr_summe,
  SUM(f.revenue)                                       AS erloes,
  SUM(f.revenue) FILTER (WHERE NOT f.is_canceled)      AS erloes_nicht_storniert,
  SUM(f.total_nights)                                  AS naechte,
  SUM(f.lead_time)                                     AS vorlaufzeit_summe,
  SUM(f.is_repeated_guest::int)                        AS wiederholungsgaeste,
  SUM((f.total_of_special_requests > 0)::int)          AS sonderwuensche"""


def ausfuehren(sql: str, parameter: dict) -> dict:
    """Führt die Abfrage aus und verpackt Ergebnis, SQL-Text und Parameter für die Antwort."""
    return {"daten": abfragen(sql, parameter), "sql": sql, "parameter": parameter}


def kennzahlen(filter: Filter) -> dict:
    """Die zehn Kennzahlen des Katalogs für den gefilterten Bestand (eine Zeile)."""
    where, parameter = where_klausel(filter)
    sql = f"""SELECT
  COUNT(*)                                             AS anzahl_buchungen,
  AVG(f.is_canceled::int)                              AS stornoquote,
  AVG(f.lead_time)                                     AS vorlaufzeit,
  AVG(f.total_nights)                                  AS aufenthaltsdauer,
  SUM(f.total_nights)                                  AS zimmernaechte,
  AVG(f.adr)                                           AS adr,
  SUM(f.revenue)                                       AS gesamterloes,
  SUM(f.revenue) FILTER (WHERE NOT f.is_canceled)      AS erloes_nicht_storniert,
  SUM(f.revenue) FILTER (WHERE f.is_canceled)          AS erloes_storniert,
  AVG(f.is_repeated_guest::int)                        AS wiederholungsgaeste,
  AVG((f.total_of_special_requests > 0)::int)          AS sonderwuensche
{STERN}
{where}"""
    return ausfuehren(sql, parameter)


def monate(filter: Filter) -> dict:
    """Kennzahlen je Anreisemonat und Hotel — Grundlage für Zeitreihen und Sparklines."""
    where, parameter = where_klausel(filter)
    sql = f"""SELECT d.year AS jahr, d.month AS monat, h.hotel AS hotel,
  {KENNZAHLEN}
{STERN}
{where}
GROUP BY d.year, d.month, h.hotel
ORDER BY d.year, d.month, h.hotel"""
    return ausfuehren(sql, parameter)


def nach_dimension(filter: Filter, spalte: str, name: str) -> dict:
    """Kennzahlen je Ausprägung einer Dimension, absteigend nach Anzahl Buchungen."""
    where, parameter = where_klausel(filter)
    sql = f"""SELECT {spalte} AS {name},
  {KENNZAHLEN}
{STERN}
{where}
GROUP BY {spalte}
ORDER BY anzahl DESC"""
    return ausfuehren(sql, parameter)


def hotels(filter: Filter) -> dict:
    """Kennzahlen je Hotel."""
    return nach_dimension(filter, "h.hotel", "hotel")


def segmente(filter: Filter) -> dict:
    """Kennzahlen je Marktsegment."""
    return nach_dimension(filter, "ms.market_segment", "segment")


def kanaele(filter: Filter) -> dict:
    """Kennzahlen je Vertriebskanal."""
    return nach_dimension(filter, "dc.distribution_channel", "kanal")


def kautionen(filter: Filter) -> dict:
    """Kennzahlen je Kautionstyp."""
    return nach_dimension(filter, "dt.deposit_type", "kaution")


def laender(filter: Filter) -> dict:
    """Kennzahlen je Herkunftsland (ISO-3-Code)."""
    return nach_dimension(filter, "c.country", "land")


def vorlaufzeit(filter: Filter) -> dict:
    """Kennzahlen je Vorlaufzeit-Bucket, in der Reihenfolge der Buckets."""
    where, parameter = where_klausel(filter)
    sql = f"""SELECT {VORLAUFZEIT_BUCKET} AS vorlaufzeit,
  MIN(f.lead_time) AS sortierung,
  {KENNZAHLEN}
{STERN}
{where}
GROUP BY 1
ORDER BY sortierung"""
    return ausfuehren(sql, parameter)


def segment_kundentyp(filter: Filter) -> dict:
    """Anzahl Buchungen je Marktsegment, Kundentyp und Hotel (Tabelle, gruppierbar nach Hotel)."""
    where, parameter = where_klausel(filter)
    sql = f"""SELECT ms.market_segment AS segment, ct.customer_type AS kundentyp, h.hotel AS hotel,
  COUNT(*) AS anzahl
{STERN}
{where}
GROUP BY ms.market_segment, ct.customer_type, h.hotel
ORDER BY ms.market_segment, ct.customer_type, h.hotel"""
    return ausfuehren(sql, parameter)


def laender_hotel(filter: Filter) -> dict:
    """Kennzahlen je Herkunftsland und Hotel (Tabelle, gruppierbar nach Hotel)."""
    where, parameter = where_klausel(filter)
    sql = f"""SELECT c.country AS land, h.hotel AS hotel,
  {KENNZAHLEN}
{STERN}
{where}
GROUP BY c.country, h.hotel
ORDER BY anzahl DESC"""
    return ausfuehren(sql, parameter)


def erloes_nach_datum(filter: Filter) -> dict:
    """Erlös je Monat, einmal nach Anreisedatum und einmal nach Datum des Reservierungsstatus.

    Die zweite Hälfte verknüpft die Datumstabelle über reservation_status_date_key —
    das ist die inaktive Beziehung aus Power BI (USERELATIONSHIP). Zeitfilter gelten
    dort für das Statusdatum.
    """
    where_anreise, parameter = where_klausel(filter, datum="d")
    where_status, parameter_status = where_klausel(filter, datum="s")
    parameter.update(parameter_status)
    sql = f"""SELECT 'Anreisedatum' AS datum_art, d.year AS jahr, d.month AS monat,
  SUM(f.revenue) AS erloes
{STERN}
{where_anreise}
GROUP BY d.year, d.month
UNION ALL
SELECT 'Stornodatum' AS datum_art, s.year AS jahr, s.month AS monat,
  SUM(f.revenue) AS erloes
{STERN}
  JOIN hotel_bi.dim_date s ON s.date_key = f.reservation_status_date_key
{where_status}
GROUP BY s.year, s.month
ORDER BY datum_art, jahr, monat"""
    return ausfuehren(sql, parameter)


def filterwerte() -> dict:
    """Die Auswahllisten der Filterleiste: alle Ausprägungen jeder Dimension mit Buchungen."""
    sql = """SELECT 'hotel' AS filter, h.hotel AS wert, COUNT(*) AS anzahl
  FROM hotel_bi.fact_bookings f JOIN hotel_bi.dim_hotel h ON h.hotel_id = f.hotel_id
  GROUP BY 1, 2
UNION ALL
SELECT 'jahr', d.year::text, COUNT(*)
  FROM hotel_bi.fact_bookings f JOIN hotel_bi.dim_date d ON d.date_key = f.arrival_date_key
  GROUP BY 1, 2
UNION ALL
SELECT 'segment', ms.market_segment, COUNT(*)
  FROM hotel_bi.fact_bookings f JOIN hotel_bi.dim_market_segment ms ON ms.market_segment_id = f.market_segment_id
  GROUP BY 1, 2
UNION ALL
SELECT 'kanal', dc.distribution_channel, COUNT(*)
  FROM hotel_bi.fact_bookings f JOIN hotel_bi.dim_distribution_channel dc ON dc.distribution_channel_id = f.distribution_channel_id
  GROUP BY 1, 2
UNION ALL
SELECT 'kundentyp', ct.customer_type, COUNT(*)
  FROM hotel_bi.fact_bookings f JOIN hotel_bi.dim_customer_type ct ON ct.customer_type_id = f.customer_type_id
  GROUP BY 1, 2
UNION ALL
SELECT 'kaution', dt.deposit_type, COUNT(*)
  FROM hotel_bi.fact_bookings f JOIN hotel_bi.dim_deposit_type dt ON dt.deposit_type_id = f.deposit_type_id
  GROUP BY 1, 2
UNION ALL
SELECT 'land', c.country, COUNT(*)
  FROM hotel_bi.fact_bookings f JOIN hotel_bi.dim_country c ON c.country_id = f.country_id
  GROUP BY 1, 2
ORDER BY filter, anzahl DESC, wert"""
    return ausfuehren(sql, {})
