-- =====================================================================
-- 01_schema.sql
-- BI-Lehrprojekt "Hotel Booking Demand" – Sternschema (Star Schema)
-- Zielsystem: PostgreSQL (self-hosted Supabase auf einem VPS)
-- =====================================================================
--
-- WAS IST EIN STERNSCHEMA? (kurze Erklärung für Erstsemester)
-- ---------------------------------------------------------------------
-- Ein Sternschema ist ein einfaches, weit verbreitetes Modell für
-- Data-Warehouse- / BI-Datenbanken. Es besteht aus:
--
--   * einer FAKTENTABELLE ("Fact Table"): Sie enthält die eigentlichen
--     Messwerte/Kennzahlen (z.B. Umsatz, Anzahl Nächte, Preis) und ist
--     meist SEHR GROSS (eine Zeile pro Ereignis, hier: eine Zeile pro
--     Hotelbuchung). In diesem Projekt ist das die Tabelle
--     "fact_bookings".
--
--   * mehreren DIMENSIONSTABELLEN ("Dimension Tables"): Sie enthalten
--     beschreibende Attribute (z.B. "Welches Hotel?", "Welches Datum?",
--     "Welcher Vertriebskanal?") und sind meist KLEIN (wenige bis
--     einige hundert Zeilen). In diesem Projekt sind das die Tabellen
--     "dim_hotel", "dim_date", "dim_market_segment", usw.
--
-- Die Faktentabelle referenziert die Dimensionstabellen über
-- Fremdschlüssel (FOREIGN KEYS). Zeichnet man das Modell, ergibt sich
-- optisch ein Stern: die Faktentabelle in der Mitte, die
-- Dimensionstabellen drumherum – daher der Name "Sternschema".
--
-- Vorteil: Analyse-Werkzeuge (z.B. Power BI) können Kennzahlen aus der
-- Faktentabelle sehr einfach nach den Attributen der Dimensionen
-- filtern und gruppieren (z.B. "Umsatz pro Land und Monat").
-- =====================================================================

-- Eigenes Schema (=Namensraum in Postgres) für das BI-Projekt anlegen,
-- damit die Tabellen nicht mit anderen Supabase-Schemas (z.B. "public",
-- "auth") kollidieren.
CREATE SCHEMA IF NOT EXISTS hotel_bi;

-- Ab hier arbeiten wir standardmäßig im Schema hotel_bi.
SET search_path TO hotel_bi;

-- ---------------------------------------------------------------------
-- Bestehende Tabellen (falls vorhanden) entfernen, damit dieses Skript
-- beliebig oft wiederholt ausgeführt werden kann (idempotent).
-- Reihenfolge: zuerst die Faktentabelle (hat die Fremdschlüssel),
-- danach die Dimensionstabellen.
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS hotel_bi.fact_bookings CASCADE;
DROP TABLE IF EXISTS hotel_bi.dim_hotel CASCADE;
DROP TABLE IF EXISTS hotel_bi.dim_date CASCADE;
DROP TABLE IF EXISTS hotel_bi.dim_market_segment CASCADE;
DROP TABLE IF EXISTS hotel_bi.dim_distribution_channel CASCADE;
DROP TABLE IF EXISTS hotel_bi.dim_customer_type CASCADE;
DROP TABLE IF EXISTS hotel_bi.dim_meal CASCADE;
DROP TABLE IF EXISTS hotel_bi.dim_deposit_type CASCADE;
DROP TABLE IF EXISTS hotel_bi.dim_country CASCADE;

-- =====================================================================
-- DIMENSIONSTABELLEN
-- =====================================================================

-- Dimension: Hotel (z.B. "City Hotel" / "Resort Hotel")
CREATE TABLE hotel_bi.dim_hotel (
    hotel_id    INTEGER PRIMARY KEY,   -- eindeutige ID des Hotels (Business Key aus der CSV)
    hotel       TEXT NOT NULL          -- Name/Typ des Hotels
);
COMMENT ON TABLE hotel_bi.dim_hotel IS 'Dimension: beschreibt den Hoteltyp einer Buchung (Teil des Sternschemas).';

-- Dimension: Datum (Kalendertabelle für Zeitanalysen, z.B. pro Monat/Quartal)
CREATE TABLE hotel_bi.dim_date (
    date_key        INTEGER PRIMARY KEY,   -- künstlicher Zeit-Schlüssel (surrogate key)
    year            INTEGER NOT NULL,
    quarter         INTEGER NOT NULL,
    month           INTEGER NOT NULL,
    month_name      TEXT NOT NULL,
    week            INTEGER NOT NULL,
    day             INTEGER NOT NULL,
    weekday_name    TEXT NOT NULL,
    is_weekend      BOOLEAN NOT NULL,
    full_date       DATE NOT NULL          -- echtes Kalenderdatum, Format YYYY-MM-DD
);
COMMENT ON TABLE hotel_bi.dim_date IS 'Dimension: Kalendertabelle. Wird in fact_bookings zweifach genutzt (Anreisedatum und Datum des Reservierungsstatus).';

-- Dimension: Marktsegment (z.B. "Corporate", "Online TA")
CREATE TABLE hotel_bi.dim_market_segment (
    market_segment_id  INTEGER PRIMARY KEY,
    market_segment     TEXT NOT NULL
);
COMMENT ON TABLE hotel_bi.dim_market_segment IS 'Dimension: Marktsegment, über das die Buchung eingegangen ist.';

-- Dimension: Vertriebskanal (z.B. "Direct", "TA/TO", "GDS")
CREATE TABLE hotel_bi.dim_distribution_channel (
    distribution_channel_id  INTEGER PRIMARY KEY,
    distribution_channel     TEXT NOT NULL
);
COMMENT ON TABLE hotel_bi.dim_distribution_channel IS 'Dimension: Vertriebskanal der Buchung.';

-- Dimension: Kundentyp (z.B. "Transient", "Group", "Contract")
CREATE TABLE hotel_bi.dim_customer_type (
    customer_type_id  INTEGER PRIMARY KEY,
    customer_type     TEXT NOT NULL
);
COMMENT ON TABLE hotel_bi.dim_customer_type IS 'Dimension: Art des Kunden/der Buchung.';

-- Dimension: Verpflegungsart (z.B. "BB" = Bed & Breakfast, "HB", "FB")
CREATE TABLE hotel_bi.dim_meal (
    meal_id  INTEGER PRIMARY KEY,
    meal     TEXT NOT NULL
);
COMMENT ON TABLE hotel_bi.dim_meal IS 'Dimension: gebuchte Verpflegungsart.';

-- Dimension: Art der Kaution/Anzahlung (z.B. "No Deposit", "Non Refund")
CREATE TABLE hotel_bi.dim_deposit_type (
    deposit_type_id  INTEGER PRIMARY KEY,
    deposit_type     TEXT NOT NULL
);
COMMENT ON TABLE hotel_bi.dim_deposit_type IS 'Dimension: Art der geleisteten Anzahlung/Kaution.';

-- Dimension: Herkunftsland des Gasts (ISO-3-Ländercode, z.B. "PRT", "GBR")
CREATE TABLE hotel_bi.dim_country (
    country_id  INTEGER PRIMARY KEY,
    country     TEXT NOT NULL
);
COMMENT ON TABLE hotel_bi.dim_country IS 'Dimension: Herkunftsland des Gasts (ISO-3-Code).';

-- =====================================================================
-- FAKTENTABELLE
-- =====================================================================
-- Eine Zeile = eine Hotelbuchung. Enthält die Kennzahlen (z.B. adr,
-- revenue, total_nights) sowie die Fremdschlüssel zu allen Dimensionen.
-- =====================================================================
CREATE TABLE hotel_bi.fact_bookings (
    booking_id                       INTEGER PRIMARY KEY,   -- eindeutige Buchungsnummer

    -- Fremdschlüssel (FKs) zu den Dimensionstabellen ("Strahlen des Sterns")
    hotel_id                         INTEGER NOT NULL REFERENCES hotel_bi.dim_hotel (hotel_id),
    arrival_date_key                 INTEGER NOT NULL REFERENCES hotel_bi.dim_date (date_key),
    reservation_status_date_key      INTEGER NOT NULL REFERENCES hotel_bi.dim_date (date_key),
    market_segment_id                INTEGER NOT NULL REFERENCES hotel_bi.dim_market_segment (market_segment_id),
    distribution_channel_id          INTEGER NOT NULL REFERENCES hotel_bi.dim_distribution_channel (distribution_channel_id),
    customer_type_id                 INTEGER NOT NULL REFERENCES hotel_bi.dim_customer_type (customer_type_id),
    meal_id                          INTEGER NOT NULL REFERENCES hotel_bi.dim_meal (meal_id),
    deposit_type_id                  INTEGER NOT NULL REFERENCES hotel_bi.dim_deposit_type (deposit_type_id),
    country_id                       INTEGER NOT NULL REFERENCES hotel_bi.dim_country (country_id),

    -- Kennzahlen / Attribute der Buchung (Fakten und beschreibende Merkmale)
    is_canceled                      BOOLEAN NOT NULL,       -- 1/0 aus der CSV wird zu true/false
    lead_time                        INTEGER NOT NULL,       -- Tage zwischen Buchung und Anreise
    stays_in_weekend_nights          INTEGER NOT NULL,
    stays_in_week_nights             INTEGER NOT NULL,
    total_nights                     INTEGER NOT NULL,
    adults                           INTEGER NOT NULL,
    children                         NUMERIC(4, 1),          -- kann NULL/Dezimalwerte enthalten
    babies                           INTEGER NOT NULL,
    total_guests                     NUMERIC(6, 1),
    is_repeated_guest                BOOLEAN NOT NULL,
    previous_cancellations           INTEGER NOT NULL,
    previous_bookings_not_canceled   INTEGER NOT NULL,
    reserved_room_type               TEXT NOT NULL,          -- Raumtyp-Code, z.B. "A", "C"
    assigned_room_type               TEXT NOT NULL,
    booking_changes                  INTEGER NOT NULL,
    days_in_waiting_list             INTEGER NOT NULL,
    adr                              NUMERIC(10, 2) NOT NULL, -- Average Daily Rate (kann negativ sein, siehe Datenqualität)
    revenue                          NUMERIC(12, 2) NOT NULL, -- adr * total_nights (o.ä.)
    required_car_parking_spaces      INTEGER NOT NULL,
    total_of_special_requests        INTEGER NOT NULL,
    reservation_status               TEXT NOT NULL           -- z.B. "Check-Out", "Canceled", "No-Show"
);
COMMENT ON TABLE hotel_bi.fact_bookings IS 'Faktentabelle: eine Zeile pro Hotelbuchung, referenziert alle Dimensionstabellen (Zentrum des Sternschemas).';

-- ---------------------------------------------------------------------
-- INDIZES auf den Fremdschlüsseln der Faktentabelle
-- ---------------------------------------------------------------------
-- Warum? Ohne Index muss Postgres bei Joins/Filtern (z.B. "alle
-- Buchungen aus Land X" oder "alle Buchungen im Zeitraum Y") die
-- komplette Faktentabelle durchsuchen. Ein Index auf der jeweiligen
-- FK-Spalte beschleunigt genau solche Joins/Filter erheblich – das ist
-- in Sternschemas Standardpraxis, da BI-Tools (z.B. Power BI) sehr
-- häufig nach Dimensionsattributen filtern.
-- ---------------------------------------------------------------------
CREATE INDEX idx_fact_bookings_hotel_id
    ON hotel_bi.fact_bookings (hotel_id);

CREATE INDEX idx_fact_bookings_arrival_date_key
    ON hotel_bi.fact_bookings (arrival_date_key);

CREATE INDEX idx_fact_bookings_reservation_status_date_key
    ON hotel_bi.fact_bookings (reservation_status_date_key);

CREATE INDEX idx_fact_bookings_market_segment_id
    ON hotel_bi.fact_bookings (market_segment_id);

CREATE INDEX idx_fact_bookings_distribution_channel_id
    ON hotel_bi.fact_bookings (distribution_channel_id);

CREATE INDEX idx_fact_bookings_customer_type_id
    ON hotel_bi.fact_bookings (customer_type_id);

CREATE INDEX idx_fact_bookings_meal_id
    ON hotel_bi.fact_bookings (meal_id);

CREATE INDEX idx_fact_bookings_deposit_type_id
    ON hotel_bi.fact_bookings (deposit_type_id);

CREATE INDEX idx_fact_bookings_country_id
    ON hotel_bi.fact_bookings (country_id);

-- Ende von 01_schema.sql
