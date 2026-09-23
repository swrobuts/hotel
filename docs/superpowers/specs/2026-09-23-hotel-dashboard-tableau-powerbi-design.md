# Entwurf: Management-Dashboard Hotel in Tableau und Power BI

Stand 23.09.2026. Grundlage: Skill `thws-dashboard` (reduziertes Management-Dashboard wie
das Superstore-Dashboard in BINT-Lab 05), Measures und Bezeichnungen aus der
Power-BI-Referenzlösung (`powerbi/`), Sternschema `hotel_bi`.

## Konzeptblatt

```
Adressaten:        Hotelleitung, monatlich; Studierende der Vorlesung als Nachbauende
Leitfrage:         Wie entwickeln sich Umsatz, Buchungen, Stornoquote und Zimmerpreis, und
                   welche Segmente, Vorlaufzeiten und Herkunftsländer treiben sie?
Spitzenkennzahlen: Umsatz (Euro, nur nicht stornierte Buchungen) · Anzahl Buchungen ·
                   Stornoquote % · Ø ADR (Euro je Nacht) – Namen wie im Power-BI-Modell
Treiber:           Umsatz je Marktsegment · Stornoquote je Vorlaufzeit-Klasse (0–7, 8–30,
                   31–90, 90+ Tage) · Umsatz je Herkunftsland (zwölf größte von 178) ·
                   Umsatz je Anreisemonat
Vergleiche:        Vorjahr über die Monate, die in beiden Jahren vorliegen; Struktur (Anteile);
                   Verlauf (Monat); kein Ziel (keine Planwerte im Datensatz)
Bezugsjahr:        2016, das einzige vollständige Jahr; Filter darf es umstellen
Filter:            Anreisejahr (Alle, 2015, 2016, 2017) und Hotel (Alle, City, Resort), Dropdowns
Ausschlüsse:       Auslastung und RevPAR (keine Kapazität im Datensatz); Karte (an der THWS
                   gesperrt, Länder als Balken); gebuchter Umsatz vor Storno nur auf Detailseiten
Teiljahre:         2015 nur Juli–Dezember, 2017 nur Januar–August. Kacheln vergleichen deshalb
                   gleiche Monate („+56,1 % zu Jul–Dez 2015“); Untertitel nennen den Zeitraum
```

## Sollwerte (aus `tools/sollwerte_dashboard.py`)

| Element | Botschaft / Wert |
|---|---|
| Seitentitel | Hotel Booking Demand 2015–2017: 26,0 Mio. Euro Umsatz, 37 % der Buchungen storniert |
| Seitenuntertitel | 119.390 Buchungen, Anreisen Juli 2015 bis August 2017 · Umsatz in Euro ohne stornierte Buchungen · Quelle: Antonio, de Almeida, Nunes (2019) |
| Kachel Umsatz 2016 | 11.673.501 · +56,1 % zu Jul–Dez 2015 |
| Kachel Buchungen 2016 | 56.707 · +34,3 % zu Jul–Dez 2015 |
| Kachel Stornoquote 2016 | 35,9 % · −0,1 Punkte zu Jul–Dez 2015 (Anstieg wäre rot) |
| Kachel Ø ADR 2016 | 98,33 · +24,2 % zu Jul–Dez 2015 |
| 2017 (bis August) | Umsatz 9.811.200 (+23,2 % zu Jan–Aug 2016) · Buchungen 40.687 (+10,6 %) · Stornoquote 38,7 % (+4,0 Punkte) · Ø ADR 114,64 (+14,8 %) |
| 2015 (ab Juli) | Umsatz 4.511.559 · Buchungen 21.996 · Stornoquote 37,0 % · Ø ADR 87,18 · „kein Vorjahr im Datensatz“ |
| Marktsegment | Online TA liefert 53 % des Umsatzes, Direct 16 %, Groups nur 7 % |
| Vorlaufzeit | Ab 90 Tagen Vorlauf wird jede zweite Buchung storniert, unter einer Woche jede zehnte (50,7 % / 9,6 %) |
| Länder | Fünf Länder liefern 66 % des Umsatzes, Portugal allein 21 % |
| Zeitreihe | Jahreshoch jedes Jahr im August, zuletzt 1,97 Mio. im August 2017 (Hoch 2015-08 1.137.653, 2016-08 1.809.325, 2017-08 1.970.182) |

## Layout (Tableau 1400 × 860, Power BI 1920 × 1080)

* Kopf: Titel und Untertitel links, Dropdowns Jahr und Hotel rechts.
* Kachelband: vier Kacheln (Bezeichnung mit Bezugsjahr, große Zahl, Veränderung, drei Minisäulen
  ’15 ’16 ’17, Bezugsjahr in Marineblau).
* Linke Spalte (33 %): Balken Umsatz je Marktsegment, Balken Stornoquote je Vorlaufzeit,
  Linie Umsatz je Anreisemonat (graue Punkte am Jahreshoch, letzter Wert rot).
* Rechte Spalte (66 %): Balken Umsatz je Herkunftsland, zwölf größte, volle Höhe.
* Farben, Schriften, Achsen nach `references/gestaltung.md` des Skills.

## Werkzeuge

* Tableau: Verbindung PostgreSQL `supabase.butscher.cloud:5433/hotel`, Schema `hotel_bi`,
  `fact_bookings` mit acht Dimensionen über Beziehungen, Extrakt; Arbeitsmappe
  `tableau/Hotel_Dashboard.twbx`; Veröffentlichung Tableau Public und Tableau Cloud.
* Power BI: bestehendes Modell `powerbi/Hotel.pbip` (Measures unverändert, neue Kachel- und
  Zeitreihen-Measures dazu), Seite „Übersicht“ neu im reduzierten Design, Seiten 2–4 bleiben als
  Detailseiten; Veröffentlichung in den Power-BI-Dienst.
* Hotel-Lab: Lab 07 wird zu „Dashboard in Power BI und Tableau“ mit echten Screenshots
  (Ausnahme von der Regel „Nachbildungen statt Screenshots“, weil die Reihenfolge der Handgriffe
  in beiden Oberflächen das Lernziel ist).

## Ergebnis (23.09.2026)

* Tableau: `tableau/Hotel_Dashboard.twbx` (Extrakt der flachen Tabelle, kein Kennwort nötig);
  Tableau Public <https://public.tableau.com/app/profile/robert.butscher7938/viz/Hotel_Dashboard_17901648227040/HotelDashboard>;
  Tableau Cloud (Site tableau_demos, Projekt Standard, nur Dashboard) <https://prod-uk-a.online.tableau.com/t/tableau_demos/views/Hotel_Dashboard/HotelDashboard>.
* Power BI: Seite „Übersicht“ in `powerbi/Hotel.pbip` und `powerbi/Hotel.pbix`; Dienst <https://app.powerbi.com/groups/me/reports/c0843c14-2f7d-4f5f-9bc0-fc2d21d31608/uebersicht>.
* Hotel-Lab 07 neu geschrieben mit elf Bildschirmfotos (`assets/img/tableau-*.png`, `powerbi-*.png`).
* Abweichung vom Plan: Die Tableau-Datenquelle ist nicht die Live-Verbindung zur Datenbank, sondern die
  flache Tabelle aus `tools/flache_buchungstabelle.py` als Extrakt – die Live-Verbindung fragt bei jedem
  Öffnen nach dem Kennwort, und Tableau Public braucht ohnehin einen Extrakt.
