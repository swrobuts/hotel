# Power-BI-Referenzlösung — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Power-BI-Projekt (TMDL + PBIR) und PBIX mit vier Seiten nach dem Word-Grundgerüst, geprüft in Power BI Desktop.

**Architecture:** Dateien werden auf dem Mac geschrieben (Python erzeugt TMDL und PBIR), in die Windows-VM kopiert und dort von Power BI Desktop 2.152 geöffnet (`prlctl exec --current-user`), Prüfung per Bildschirmfoto in die Mac-Freigabe.

**Tech Stack:** TMDL, PBIR (Schemas visualContainer 2.9.0, page 2.1.0, report 3.3.0), Power Query M, DAX, Parallels `prlctl`, PowerShell.

**Spec:** `docs/superpowers/specs/2026-09-12-power-bi-referenzloesung-design.md`

## Global Constraints

* Sachlicher Ton in allen Texten; echte Umlaute; Bezeichner ASCII außer Measure-Namen (Katalog).
* Zugang im Modell: `studi_hotel`; das Betreiberkennwort erscheint nirgends.
* Keine Änderungen an der Datenbank.

---

### Task 1: Minimal-Projekt öffnen (Formatprobe)

- [x] Minimal-PBIP (Modell: `DIM_HOTEL`; Report: eine Karte) erzeugen, in die VM kopieren (`C:\Users\robert\hotel-pbi`), `PBIDesktop.exe` starten, Bildschirmfoto.
- [x] Kennwortdialog und Verschlüsselungsnachfrage per PowerShell/SendKeys bedienen, Laden prüfen.
- [x] In Desktop speichern (Strg+S); die von Desktop geschriebenen Dateien als Formatreferenz sichern.

### Task 2: Semantisches Modell

- [x] `Hotel.SemanticModel/definition/*.tmdl`: neun Tabellen mit M-Partitionen, Spaltentypen, Beziehungen, Measures, berechnete Spalten, Datumstabelle.
- [x] Öffnen, Laden, Modellansicht per Bildschirmfoto; Kennzahlen mit einer Prüfseite (Karten) gegen das Notebook.

### Task 3: Report-Seiten

- [x] Vier Seiten als PBIR erzeugen (Generator in Python, Positionen auf 1280×720).
- [x] Jede Seite per Bildschirmfoto prüfen; Fehler korrigieren; Karte prüfen oder ersetzen.

### Task 4: Speichern und Übernahme

- [x] Strg+S (PBIP kanonisch), *Speichern unter* `Hotel.pbix`; beides in `powerbi/` übernehmen.
- [x] `powerbi/README.md` und `powerbi/bilder/`, Verweis im Haupt-README; Commit, Push.
