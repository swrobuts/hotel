# Tableau-Referenzlösung

Das Management-Dashboard der Fallstudie als Tableau-Arbeitsmappe, gestaltet nach denselben
Regeln wie die Seite „Übersicht“ des Power-BI-Reports (`../powerbi/`): vier Kennzahlkacheln
mit Bezugsjahr und Vorjahresvergleich, Balken je Marktsegment, Vorlaufzeit-Klasse und
Herkunftsland, Umsatz je Anreisemonat, Filter für Jahr und Hotel. Hotel-Lab 07 erklärt den
Aufbau Schritt für Schritt.

| Datei | Inhalt |
|---|---|
| `Hotel_Dashboard.twbx` | verpackte Arbeitsmappe mit Daten (flache Buchungstabelle als Extrakt), 12 Blätter, 1 Dashboard 1400 × 860 px |
| `bau_hotel_dashboard.py` | erzeugt die Arbeitsmappe (`Hotel_Dashboard.twb`) aus XML-Bausteinen: Datenquelle, 50 berechnete Felder, Blätter, Dashboard |
| `bilder/` | Bildschirmfotos des Dashboards und der Veröffentlichung |

## Öffnen

Doppelklick auf `Hotel_Dashboard.twbx` – Tableau Desktop ab 2026.2 oder Tableau Public
(kostenfrei). Die Arbeitsmappe braucht keine Datenbankverbindung.

## Daten

Die Arbeitsmappe verwendet eine flache Tabelle `hotel_buchungen` (119.390 Zeilen), die dem
Join der Faktentabelle mit den acht Dimensionen entspricht (SQL in Hotel-Lab 06 und im
Kopf von `../tools/flache_buchungstabelle.py`). Sie enthält zusätzlich deutsche Ländernamen
(`country_name`). Wer stattdessen live auf die Datenbank geht: Verbinden → PostgreSQL
(`supabase.butscher.cloud`, Port 5433, Datenbank `hotel`, Rolle `studi_hotel`), dann
*Neues benutzerdefiniertes SQL* mit der Abfrage aus dem Skript und *Daten → Extrakt erstellen*.

## Neu bauen

```bash
python3 tools/flache_buchungstabelle.py /tmp/hotel/Data/hotel
python3 tableau/bau_hotel_dashboard.py /tmp/hotel
cd /tmp/hotel && zip -r Hotel_Dashboard.twbx Hotel_Dashboard.twb Data
```

Danach in Tableau Desktop öffnen, *Daten → hotel_buchungen → Extrakt erstellen*, als
verpackte Arbeitsmappe speichern. Die Sollwerte der Titel liefert `tools/sollwerte_dashboard.py`.

## Kontrollwerte

Ohne Filter (Bezugsjahr 2016): Umsatz 11.673.501 (+56,1 % zu Jul–Dez 2015), Buchungen 56.707
(+34,3 %), Stornoquote 35,9 % (−0,1 Punkte), Ø ADR 98,33 (+24,2 %). Jahr 2017: Umsatz
9.811.200 (+23,2 % zu Jan–Aug 2016). Jahr 2015: „kein Vorjahr im Datensatz“.

## Veröffentlicht

* Tableau Public (offen): https://public.tableau.com/app/profile/robert.butscher7938/viz/Hotel_Dashboard_17901648227040/HotelDashboard
* Tableau Cloud (Site tableau_demos, Konto nötig): https://prod-uk-a.online.tableau.com/t/tableau_demos/views/Hotel_Dashboard/HotelDashboard
