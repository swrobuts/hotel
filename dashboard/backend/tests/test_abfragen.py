"""Kontrollwerte gegen die lebende Datenbank hotel.

Die Erwartungswerte stammen aus dem Notebook und der Power-BI-Lösung:
119.390 Buchungen, Stornoquote 37,0 %, Ø ADR 101,83, Erlös nicht storniert 25.996.260.
"""

import pytest
from fastapi.testclient import TestClient

from backend.app.filter import Filter, naechster_monat, where_klausel
from backend.app.main import app

client = TestClient(app)


def test_where_klausel_ohne_filter_ist_leer():
    where, parameter = where_klausel(Filter())
    assert where == "" and parameter == {}


def test_where_klausel_mit_zeitraum():
    where, parameter = where_klausel(Filter(von="2016-01", bis="2016-12"))
    assert "d.full_date >= :von" in where and "d.full_date < :bis" in where
    assert parameter == {"von": "2016-01-01", "bis": "2017-01-01"}


def test_naechster_monat_ueber_jahreswechsel():
    assert naechster_monat("2016-12") == "2017-01-01"
    assert naechster_monat("2016-03") == "2016-04-01"


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_kennzahlen_ohne_filter():
    zeile = client.get("/api/kennzahlen").json()["daten"][0]
    assert zeile["anzahl_buchungen"] == 119390
    assert round(zeile["stornoquote"] * 100, 1) == 37.0
    assert round(zeile["adr"], 2) == 101.83
    assert round(zeile["erloes_nicht_storniert"]) == 25996260
    assert round(zeile["gesamterloes"]) == 42723498


def test_kennzahlen_je_hotel():
    daten = {z["hotel"]: z for z in client.get("/api/hotels").json()["daten"]}
    assert daten["City Hotel"]["anzahl"] == 79330
    assert daten["Resort Hotel"]["anzahl"] == 40060
    assert round(daten["City Hotel"]["stornoquote"] * 100, 1) == 41.7


def test_filter_hotel_und_jahr():
    zeile = client.get("/api/kennzahlen", params={"hotel": "City Hotel", "jahr": 2016}).json()["daten"][0]
    assert 0 < zeile["anzahl_buchungen"] < 79330


def test_filter_leer_wird_ignoriert():
    mit_leer = client.get("/api/kennzahlen", params={"hotel": "", "jahr": ""}).json()["daten"][0]
    assert mit_leer["anzahl_buchungen"] == 119390


def test_vorlaufzeit_buckets_in_reihenfolge():
    buckets = [z["vorlaufzeit"] for z in client.get("/api/vorlaufzeit").json()["daten"]]
    assert buckets == ["0-7", "8-30", "31-90", "90+"]


def test_laender_top_ist_portugal():
    daten = client.get("/api/laender").json()["daten"]
    assert daten[0]["land"] == "PRT" and daten[0]["anzahl"] == 48590
    assert len(daten) == 178


def test_erloes_nach_datum_hat_beide_reihen():
    arten = {z["datum_art"] for z in client.get("/api/erloes_datum").json()["daten"]}
    assert arten == {"Anreisedatum", "Stornodatum"}


def test_antwort_enthaelt_sql():
    antwort = client.get("/api/segmente", params={"land": "DEU"}).json()
    assert "GROUP BY ms.market_segment" in antwort["sql"]
    assert antwort["parameter"] == {"land": "DEU"}


def test_filterwerte_liefert_alle_listen():
    filter_namen = {z["filter"] for z in client.get("/api/filterwerte").json()["daten"]}
    assert filter_namen == {"hotel", "jahr", "segment", "kanal", "kundentyp", "kaution", "land"}


def test_startseite_liefert_html():
    antwort = client.get("/")
    assert antwort.status_code == 200 and "<html" in antwort.text.lower()


def test_laender_hotel_summiert_sich_zu_laendern():
    je_hotel = client.get("/api/laender_hotel", params={"land": "DEU"}).json()["daten"]
    gesamt = client.get("/api/laender", params={"land": "DEU"}).json()["daten"][0]
    assert sum(z["anzahl"] for z in je_hotel) == gesamt["anzahl"] == 7287


def test_segment_kundentyp_enthaelt_hotel():
    zeile = client.get("/api/segment_kundentyp").json()["daten"][0]
    assert {"segment", "kundentyp", "hotel", "anzahl"} <= set(zeile)


def test_umsatz_bei_ausschliesslich_stornierten_buchungen_ist_null_euro():
    # Nicaragua: im Datensatz sind alle Buchungen storniert.
    parameter = {"land": "NIC"}
    kennzahlen = client.get("/api/kennzahlen", params=parameter).json()["daten"][0]
    assert kennzahlen["anzahl_buchungen"] > 0
    assert kennzahlen["stornoquote"] == 1
    assert kennzahlen["erloes_nicht_storniert"] == 0
    for route in ("monate", "hotels", "segmente", "kanaele", "laender"):
        zeilen = client.get("/api/" + route, params=parameter).json()["daten"]
        assert zeilen
        assert all(z["erloes_nicht_storniert"] == 0 for z in zeilen)


def test_umsatz_ohne_buchungen_ist_null_euro():
    kennzahlen = client.get("/api/kennzahlen", params={"jahr": "2018"}).json()["daten"][0]
    assert kennzahlen["anzahl_buchungen"] == 0
    assert kennzahlen["adr"] is None
    assert kennzahlen["gesamterloes"] == 0
    assert kennzahlen["erloes_nicht_storniert"] == 0
    assert kennzahlen["erloes_storniert"] == 0
