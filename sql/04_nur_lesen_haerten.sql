-- Gezielte Korrektur der am 15.09.2026 bestätigten TEMP-/Large-Object-Rechte.
-- Als supabase_admin in der Datenbank hotel ausführen.
-- Verändert weder Hotel-Daten noch andere Datenbanken.
--
-- PostgreSQL addiert direkte, geerbte und PUBLIC-Rechte. EXECUTE nur von
-- studi_hotel zu entziehen reicht deshalb bei PUBLIC-Funktionen nicht.
-- Vor dem Entzug von PUBLIC behalten alle anderen vorhandenen Rollen die
-- bisherigen Rechte durch explizite Grants. Neue Rollen benötigen künftig
-- einen ausdrücklichen Grant für TEMP bzw. diese Large-Object-Funktionen.
-- studi_hotel darf keine Mitgliedschaft in einer schreibenden Rolle erhalten.

BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

DO $hardening$
DECLARE
    ziel_datenbank text := 'hotel';
    andere_rolle record;
    funktion record;
BEGIN
    IF current_database() <> ziel_datenbank THEN
        RAISE EXCEPTION 'Dieses Skript ist ausschließlich für die Datenbank hotel bestimmt';
    END IF;
    IF NOT (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) THEN
        RAISE EXCEPTION 'Mit einem PostgreSQL-Superuser (supabase_admin) ausführen';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'studi_hotel') THEN
        RAISE EXCEPTION 'Die Rolle studi_hotel fehlt';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_auth_members WHERE member = 'studi_hotel'::regrole) THEN
        RAISE EXCEPTION 'Zuerst die Rollenmitgliedschaften von studi_hotel prüfen';
    END IF;

    -- PUBLIC-TEMP, falls vorhanden, für andere bestehende Rollen bewahren.
    IF EXISTS (
        SELECT 1 FROM pg_database d,
        LATERAL aclexplode(COALESCE(d.datacl, acldefault('d', d.datdba))) a
        WHERE d.datname = ziel_datenbank AND a.grantee = 0
          AND a.privilege_type = 'TEMPORARY'
    ) THEN
        FOR andere_rolle IN SELECT rolname FROM pg_roles WHERE rolname <> 'studi_hotel' LOOP
            EXECUTE format('GRANT TEMPORARY ON DATABASE %I TO %I', ziel_datenbank, andere_rolle.rolname);
        END LOOP;
    END IF;
    EXECUTE format('REVOKE TEMPORARY ON DATABASE %I FROM PUBLIC, studi_hotel', ziel_datenbank);

    -- Alle Standardfunktionen, die Large Objects anlegen, verändern oder
    -- entfernen, einschließlich Varianten für Dateiimport und -export.
    FOR funktion IN
        SELECT p.oid, p.oid::regprocedure::text AS signatur,
               EXISTS (
                   SELECT 1 FROM aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
                   WHERE a.grantee = 0 AND a.privilege_type = 'EXECUTE'
               ) AS public_execute
        FROM pg_proc p
        WHERE p.pronamespace = 'pg_catalog'::regnamespace
          AND p.proname IN ('lo_creat', 'lo_create', 'lo_from_bytea', 'lo_put',
                            'lowrite', 'lo_unlink', 'lo_truncate', 'lo_truncate64',
                            'lo_import', 'lo_export')
    LOOP
        IF funktion.public_execute THEN
            FOR andere_rolle IN SELECT rolname FROM pg_roles WHERE rolname <> 'studi_hotel' LOOP
                EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO %I', funktion.signatur, andere_rolle.rolname);
            END LOOP;
        END IF;
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, studi_hotel', funktion.signatur);
    END LOOP;

    IF has_database_privilege('studi_hotel', ziel_datenbank, 'TEMP') THEN
        RAISE EXCEPTION 'TEMP ist weiterhin erlaubt; Änderungen werden zurückgerollt';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_proc p WHERE p.pronamespace = 'pg_catalog'::regnamespace
          AND p.proname IN ('lo_creat', 'lo_create', 'lo_from_bytea', 'lo_put',
                            'lowrite', 'lo_unlink', 'lo_truncate', 'lo_truncate64',
                            'lo_import', 'lo_export')
          AND has_function_privilege('studi_hotel', p.oid, 'EXECUTE')
    ) THEN
        RAISE EXCEPTION 'Large-Object-Schreibfunktion weiterhin erlaubt; Änderungen werden zurückgerollt';
    END IF;
END
$hardening$;

-- Komfortvorgabe, keine Berechtigungsschranke: vom Benutzer überschreibbar.
ALTER ROLE studi_hotel SET default_transaction_read_only = on;
COMMIT;
