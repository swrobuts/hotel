# Bugprüfung vom 14. September 2026

Ausgangsstand: `d342a668095787e6c994193be59a90d10280b6dc`.
GitHub und das lokale Repository hatten zu Beginn dieselben Dateiinhalte.
Die lokal als geändert angezeigten Power-BI-Dateien unterschieden sich nur
im ausführbaren Dateimodus, den Windows nicht wie Linux verwaltet.

## Behobene Fehler

| Bereich | Auslöser und bisherige Folge | Korrektur |
|---|---|---|
| Zeitfilter | Etwa `jahr=abc`, `bis=2016-13` oder ein umgekehrter Zeitraum verursachten Serverfehler oder ungültige SQL-Parameter. | Jahres-/Monatsprüfung vor der Abfrage, HTTP 422 bei ungültigen Werten; leere Filter bleiben zulässig. |
| Paralleles Laden | Eine ältere, langsamere Antwort überschrieb die Ergebnisse einer neueren Filterauswahl; veraltete Fehler beendeten deren Ladeanzeige. | Nur der aktuelle Ladevorgang darf Daten, Fehleranzeige und Ladezustand ändern. |
| Nullumsatz | Bei ausschließlich stornierten Buchungen lieferte SQL `NULL` als stornobereinigten Umsatz; die Kanalauswahl brach anschließend mit einem JavaScript-Fehler ab. Reales Beispiel: `land=NIC`. | Umsatzsummen liefern 0, Texte und Anteilsberechnungen berücksichtigen fehlenden Umsatz. |
| URL-Inhalte | HTML aus einem Filterwert wurde in Filterchips als Markup eingefügt. | Filterchips und Zeitbeschriftungen setzen benutzerbestimmte Inhalte mit `textContent`. |
| Zeitvergleiche | Ein Zeitraum ohne Treffer nutzte einen Bezugsmonat außerhalb des Filters; fehlende Kennzahlen konnten als −100 % erscheinen. | Bezugsmonat ausschließlich aus dem Zeitfilter; fehlende Werte bleiben ohne prozentuale Änderung. |
| Herkunft und Stornotexte | Unbekannte Herkunft wurde als Ausland gezählt; fehlende Auslandsbuchungen ergaben scheinbar 0 %; feste Aussagen behaupteten auch bei anderen Filterergebnissen steigende Stornoquoten. | Unbekannte Herkunft ausgeschlossen, fehlende Quoten bleiben leer, Beschreibungen nennen die tatsächlich gefilterten Werte. |
| Startfehler | Ein Fehler beim Laden der Filterlisten blieb ohne sichtbare Meldung. | Auch Startfehler erscheinen im Fehlerkasten. |
| CSV-Import | Jede Tabelle wurde separat bestätigt. Ein Fehler in einer späteren CSV hinterließ bereits geleerte oder ersetzte Tabellen. `astype(bool)` machte ungültige Werte wie 2 oder NaN zu `True`. | Alle neun Tabellen werden in einer gemeinsamen Transaktion ersetzt; fehlende Dateien werden vorab geprüft, ungültige Booleanwerte abgewiesen. TRUNCATE nennt alle Projekt-Tabellen ausdrücklich und verwendet kein CASCADE. |

## Prüfung

- **31 API-Tests bestanden**, einschließlich lesender Abfragen gegen die
  PostgreSQL-Lehrdatenbank, der bisherigen Kennzahlen und der neuen Randfälle.
- **9 Importtests bestanden**: erfolgreicher Import, fehlende Datei, Rollback
  nach einem Primärschlüsselfehler in der letzten Tabelle und Booleanvalidierung.
  Die Transaktionsprüfung nutzt SQLAlchemy mit SQLite; PostgreSQL-spezifisches
  TRUNCATE/COPY ist dabei durch lokale Testoperationen ersetzt.
- **10 Frontendtests bestanden**, mit jsdom und den auf der Webseite verwendeten
  Versionen von D3 und Observable Plot. Die Regressionen wurden zusätzlich
  gegen den unveränderten Ausgangsstand geprüft.
- Syntax aller Python-Dateien und der 16 Notebook-Codezellen geprüft.
- 42 Power-BI-Metadatendateien syntaktisch geprüft; Beziehungen mit dem
  Sternschema abgeglichen.
- Alle 119.390 Fakten auf Schlüssel und abgeleitete Nächte-, Gäste- und
  Umsatzwerte geprüft. Die neun CSV-Kopien in `data/` und `notebooks/` stimmen überein.

Die Tests haben keine Daten in der Lehrdatenbank verändert. Das vollständige
Notebook einschließlich des Downloads und Power BI Desktop wurden nicht ausgeführt;
die PBIX-Datei wurde nicht neu erzeugt. Testbefehle stehen in den beiden READMEs.
