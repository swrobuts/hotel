# Entwurf: Power-BI-Referenzlösung zum Grundgerüst

Stand: 12.09.2026, mit Robert abgestimmt.

## Ziel

Der Power-BI-Report, den das Word-Grundgerüst beschreibt, liegt fertig im Repo:
als Power-BI-Projekt (PBIP, Textdateien) und als `Hotel.pbix` mit geladenen
Daten. Studierende bauen den Report nach dem Grundgerüst selbst und vergleichen
mit dieser Referenzlösung; Dozierende öffnen die PBIX per Doppelklick.

## Vorgaben aus dem Grundgerüst

* Sternschema `FACT_BOOKINGS` + acht Dimensionen (Tabellennamen in
  Großschreibung, Spaltennamen wie in der Datenbank).
* Beziehungen 1:n von jeder Dimension zur Faktentabelle, Filterrichtung
  einfach; `DIM_DATE` zweimal: `arrival_date_key` aktiv,
  `reservation_status_date_key` inaktiv (`USERELATIONSHIP`).
* Measures wortgleich aus dem Katalog: Anzahl Buchungen, Stornoquote %,
  Ø Vorlaufzeit, Ø Aufenthaltsdauer, Gebuchte Zimmernächte, Ø ADR,
  Gesamterlös, Erlös stornierte Buchungen, Erlös nicht stornierte Buchungen,
  Wiederholungsgast-Anteil %, Anteil mit Sonderwünschen %, Erlös nach
  Stornodatum; zusätzlich Ø Erlös je Buchung (Abschnitt 6).
* Berechnete Spalte `Lead-Time-Bucket` (0–7, 8–30, 31–90, 90+ Tage) mit
  Sortierspalte.
* Vier Seiten: Management-Übersicht, Vertrieb & Kundensegmente,
  Stornoanalyse, Saisonalität & Herkunftsländer — Visuals und Felder wie in
  Abschnitt 5 des Grundgerüsts.

## Entscheidungen

* Datenquelle: `PostgreSQL.Database("supabase.butscher.cloud:5433", "hotel")`,
  Schema `hotel_bi`, Import-Modus, Anmeldung als `studi_hotel`.
* `is_canceled` und `is_repeated_guest` werden in Power Query auf 0/1
  (Ganzzahl) gewandelt, damit die Katalogformeln (`= 1`) gelten.
* `DIM_DATE` als Datumstabelle markiert (`full_date`), automatische
  Datumstabellen aus.
* Kartenvisual auf Seite 4 nur, wenn Azure Maps die ISO-3-Codes auflöst;
  sonst Balkendiagramm Top-10-Länder.
* Ablage `powerbi/Hotel.pbip`, `powerbi/Hotel.SemanticModel/`,
  `powerbi/Hotel.Report/`, `powerbi/Hotel.pbix`, `powerbi/README.md`,
  `powerbi/bilder/` (eine Abbildung je Seite).

## Nachweis

Öffnen in Power BI Desktop 2.152 (Windows-VM), Laden aus Postgres,
Bildschirmfotos der Modellansicht und aller Seiten; Kennzahlen gegen das
Notebook: 119.390 Buchungen, Stornoquote 37,0 %, Ø ADR 101,83,
Erlös nicht storniert 25.996.260.
