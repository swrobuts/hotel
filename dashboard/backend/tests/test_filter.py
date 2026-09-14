"""Filtervalidierung ohne Datenbankzugriff."""

import pytest
from fastapi.testclient import TestClient

from backend.app import abfragen
from backend.app.main import app


@pytest.mark.parametrize("parameter", [
    {"jahr": "abc"}, {"jahr": "2016.5"}, {"jahr": "0"}, {"jahr": "10000"},
    {"von": "2016-13"}, {"bis": "2016-00"}, {"bis": "gestern"},
    {"von": "2016-1"}, {"von": "0000-01"}, {"bis": "9999-12"},
    {"von": "2017-01", "bis": "2016-12"},
])
def test_ungueltiger_zeitfilter_ist_ein_clientfehler(monkeypatch, parameter):
    def keine_abfrage(*args, **kwargs):
        pytest.fail("Ungültige Filter dürfen die Datenbank nicht erreichen")

    monkeypatch.setattr(abfragen, "abfragen", keine_abfrage)
    with TestClient(app, raise_server_exceptions=False) as client:
        antwort = client.get("/api/kennzahlen", params=parameter)
    assert antwort.status_code == 422
    assert antwort.json()["detail"]


@pytest.mark.parametrize("parameter, erwartet", [
    ({"jahr": "", "hotel": ""}, {}),
    ({"jahr": "2016", "von": "2016-01", "bis": "2016-12"},
     {"jahr": 2016, "von": "2016-01-01", "bis": "2017-01-01"}),
])
def test_gueltige_filter_bleiben_nutzbar(monkeypatch, parameter, erwartet):
    monkeypatch.setattr(abfragen, "abfragen", lambda sql, params: [])
    with TestClient(app) as client:
        antwort = client.get("/api/kennzahlen", params=parameter)
    assert antwort.status_code == 200
    assert antwort.json()["parameter"] == erwartet
