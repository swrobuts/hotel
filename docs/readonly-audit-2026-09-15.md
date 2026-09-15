# Rechteprüfung studi_hotel vom 15.09.2026

Ziel: Der öffentliche Demo-Zugang `studi_hotel` darf die Datenbank `hotel` lesen,
aber weder Daten ändern noch eigene Datenbankobjekte anlegen.

## Befund vor der Korrektur

- Alle neun Tabellen in `hotel_bi` gewährten bereits ausschließlich SELECT.
  Auch Spalten-, Verwaltungs- und Eigentumsrechte erlaubten keine Änderungen.
- Der Benutzer hatte keine administrativen Rollenattribute oder Rollenmitgliedschaften.
- Trotzdem waren temporäre Tabellen und neue Large Objects erlaubt. Beide
  Möglichkeiten wurden in expliziten READ-WRITE-Transaktionen nachgewiesen;
  die Testobjekte wurden jeweils vollständig zurückgerollt.
- Verbindungen als `studi_hotel` nach `postgres` und `analytics_sakila` waren
  ebenfalls möglich. Auch dort waren TEMP und Large-Object-Funktionen zugänglich.

## Umgesetzte Korrektur

1. `04_nur_lesen_haerten.sql` wurde als `supabase_admin` gegen `hotel` ausgeführt.
   TEMP sowie die schreibenden Large-Object-Funktionen sind für `studi_hotel`
   gesperrt. Bisherige effektive Rechte anderer vorhandener Rollen bleiben erhalten.
2. Vier vorangestellte HBA-Regeln verweigern ausschließlich dieser Rolle alle
   anderen Datenbanken und physische Replikation. Die vorhandenen Regeln für
   `hotel` und andere Benutzer bleiben unverändert. PostgreSQL hat die neue
   Konfiguration ohne Fehler eingelesen; Aktivierung durch `pg_reload_conf()`.
3. Die HBA-Datei liegt zusätzlich auf dem Host und ist in der vorhandenen
   Compose-Ergänzung als Bind-Mount für spätere Container-Neuerstellungen
   hinterlegt. `docker compose config --quiet` war erfolgreich. Es wurde kein
   Container-Neustart durchgeführt.
4. Die eine vorhandene Demo-Sitzung wurde beendet, damit keine früheren
   temporären Objekte weiter nutzbar bleiben. Es existierten keine eigenen
   persistenten Large Objects dieser Rolle.

Sicherungen der bisherigen ACLs, HBA-Datei und Compose-Ergänzung liegen privat
auf dem VPS unter `/root/hotel-readonly-20260915-h1XwKI/`.

## Verifikation

- Isolierter PostgreSQL-Test der SQL-Korrektur: **20 Prüfungen bestanden**,
  einschließlich wiederholter Anwendung, Schutz vor falscher Zieldatenbank,
  unveränderter Rechte einer zweiten Rolle und praktisch abgewiesener Schreibzugriffe.
- `python sql/06_pruefe_leserechte.py`: **36 Prüfungen, 0 Fehler**.
  Alle neun Tabellen bleiben mit ihren bisherigen Zeilenzahlen lesbar, darunter
  119.390 Buchungen. Die Schreibproben scheitern auch mit `BEGIN READ WRITE` an
  fehlenden Berechtigungen. Verbindungen in alle elf anderen verbindbaren
  Datenbanken werden durch die HBA-Regeln abgelehnt.
- Das Dashboard und dessen Kennzahlen-API wurden nach der Korrektur geprüft.

Der isolierte Test ist als `tests/readonly-policy.mjs` enthalten. Dafür
`PGLITE_MODULE` auf den absoluten Pfad zu `assets/pglite/index.js` aus Hotel-Lab
setzen und `node tests/readonly-policy.mjs` ausführen. Er verwendet ausschließlich
eine lokale Testdatenbank; nur deren Name `postgres` ersetzt den Zielnamen `hotel`.

`default_transaction_read_only` ist weiterhin als Komfortvorgabe gesetzt.
Es ersetzt keine Berechtigungsprüfung. Neue Rollen benötigen künftig bei Bedarf
ausdrückliche TEMP-/Large-Object-Grants; `studi_hotel` darf keine Schreibrechte
oder zusätzliche Rollenmitgliedschaften erhalten. Bei einem Datenbank-Upgrade
muss die eingebundene HBA-Datei mit den neuen Herstellervorgaben abgeglichen werden.

Grundlagen: [PostgreSQL REVOKE](https://www.postgresql.org/docs/17/sql-revoke.html),
[pg_hba.conf](https://www.postgresql.org/docs/17/auth-pg-hba-conf.html).
