-- =====================================================================
-- 03_rolle_studi_hotel.sql
-- Rolle für Studierende: nur lesend auf das Schema hotel_bi der
-- Datenbank hotel. Als supabase_admin gegen die Datenbank hotel
-- ausführen; das Skript ist idempotent (läuft beliebig oft fehlerfrei).
--
--   docker exec -i supabase-db psql -U supabase_admin -d hotel \
--       -v ON_ERROR_STOP=1 -f - < sql/03_rolle_studi_hotel.sql
--
-- Das Kennwort steht bewusst hier: Der Datensatz ist öffentlich, und die
-- Rolle darf nichts verändern.
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

-- Nur lesen: jede Transaktion ist nur lesend, Abfragen enden nach zehn
-- Minuten, offene Transaktionen ohne Aktivität nach fünf Minuten.
ALTER ROLE studi_hotel SET default_transaction_read_only = on;
ALTER ROLE studi_hotel SET search_path = hotel_bi;
ALTER ROLE studi_hotel SET statement_timeout = '10min';
ALTER ROLE studi_hotel SET idle_in_transaction_session_timeout = '5min';

-- Nur diese Datenbank: CONNECT gehört nicht mehr allen, sondern
-- dem Betreiberkonto und der Studierendenrolle.
REVOKE CONNECT ON DATABASE hotel FROM PUBLIC;
GRANT  CONNECT ON DATABASE hotel TO postgres, studi_hotel;

-- Lesen im Schema hotel_bi.
GRANT USAGE ON SCHEMA hotel_bi TO studi_hotel;
GRANT SELECT ON ALL TABLES IN SCHEMA hotel_bi TO studi_hotel;

-- Tabellen und Sichten, die postgres später anlegt, sind automatisch lesbar.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA hotel_bi
    GRANT SELECT ON TABLES TO studi_hotel;
