# Interaktives Dashboard — Umsetzungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard `dashboard/` (FastAPI + Plotly.js) mit allen Funktionen der Power-BI-Lösung plus Kreuzfilterung, Karte, SQL-Anzeige; live auf Render.

**Architecture:** Backend baut aus einem Filterzustand parametrisierte SQL-Aggregate gegen `hotel_bi` und liefert JSON samt SQL-Text; Frontend hält den Filterzustand (auch in der URL), lädt alle Routen parallel und zeichnet mit Plotly.js; Klicks in Diagrammen ändern den Zustand.

**Tech Stack:** Python 3.12, FastAPI, SQLAlchemy (psycopg2), Plotly.js 3.1.0, Docker, Render Blueprint.

**Spec:** `docs/superpowers/specs/2026-09-12-dashboard-design.md`

## Global Constraints

* Lehrcode: kurze Funktionen, deutsche Namen, ein Kommentar je Funktion, keine Tricks; echte Umlaute in Kommentaren.
* Kennzahlen wortgleich zum Katalog; Kontrollwerte wie Notebook/Power BI.
* Nur Leserechte (`studi_hotel`); keine Änderungen an der Datenbank.

---

### Task 1: Backend (Datenbank, Filter, Abfragen, Routen) mit Tests
- [x] `datenbank.py`, `filter.py`, `abfragen.py`, `main.py`, `requirements.txt` schreiben.
- [x] `tests/test_abfragen.py`: Kontrollwerte (119390, 37,0 %, 101,83, 25.996.260; City Hotel 79330; PRT 48590; Filterkombination), Routen per TestClient.
- [x] `pytest` grün; Commit.

### Task 2: Frontend
- [x] `index.html`, `style.css`, `app.js`: Filterleiste, Chips, Kacheln, 14 Diagramme/Tabelle, Klick-Filter, URL-Zustand, SQL-Anzeige, CSV-Export.
- [x] Lokal starten (Port 8765), im Browser prüfen: Kennzahlen, Klick-Filter, Karte, Tabelle sortieren, Link; Commit.

### Task 3: Container und Render
- [x] `Dockerfile`, `.dockerignore`, `render.yaml` (Root, `rootDir: dashboard`); lokaler `docker build` und Start; Commit, Push.
- [x] Render: Blueprint anlegen (Chrome, Roberts Konto), Build abwarten, URL prüfen.

### Task 4: Dokumentation
- [x] `dashboard/README.md` (Funktionen, lokal starten, Aufbau, Routen, Deploy), Haupt-README (Link, URL), Bildschirmfoto; Plan abhaken; Commit, Push.
