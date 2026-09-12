"""Hotel Booking Demand – Dashboard-Backend (FastAPI).

Start lokal (aus dem Ordner dashboard/):
    uvicorn backend.app.main:app --reload --port 8765

Jede Route liefert JSON mit den Daten eines Diagramms und dem SQL dahinter.
Alle Routen nehmen dieselben Filterparameter entgegen, z. B.
    /api/kennzahlen?hotel=City%20Hotel&jahr=2016
"""

from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import abfragen
from .filter import Filter, filter_aus_werten

FRONTEND = Path(__file__).resolve().parent.parent.parent / "frontend"

app = FastAPI(title="Hotel Booking Demand – Dashboard", version="1.0.0")


def filter_parameter(
    hotel: str | None = None, jahr: str | None = None, von: str | None = None, bis: str | None = None,
    segment: str | None = None, kanal: str | None = None, kundentyp: str | None = None,
    kaution: str | None = None, land: str | None = None, vorlaufzeit: str | None = None,
) -> Filter:
    """Liest die Filter aus der Adresse; FastAPI übergibt sie jeder Route über Depends."""
    return filter_aus_werten(hotel=hotel, jahr=jahr, von=von, bis=bis, segment=segment, kanal=kanal,
                             kundentyp=kundentyp, kaution=kaution, land=land, vorlaufzeit=vorlaufzeit)


@app.get("/health")
def health() -> dict:
    """Antwortet mit ok, wenn die App läuft; Render prüft diesen Pfad."""
    return {"status": "ok"}


@app.get("/api/filterwerte")
def filterwerte() -> dict:
    """Auswahllisten für die Filterleiste."""
    return abfragen.filterwerte()


@app.get("/api/kennzahlen")
def kennzahlen(filter: Filter = Depends(filter_parameter)) -> dict:
    """Die zehn Kennzahlen des Katalogs."""
    return abfragen.kennzahlen(filter)


@app.get("/api/monate")
def monate(filter: Filter = Depends(filter_parameter)) -> dict:
    """Kennzahlen je Anreisemonat."""
    return abfragen.monate(filter)


@app.get("/api/hotels")
def hotels(filter: Filter = Depends(filter_parameter)) -> dict:
    """Kennzahlen je Hotel."""
    return abfragen.hotels(filter)


@app.get("/api/segmente")
def segmente(filter: Filter = Depends(filter_parameter)) -> dict:
    """Kennzahlen je Marktsegment."""
    return abfragen.segmente(filter)


@app.get("/api/kanaele")
def kanaele(filter: Filter = Depends(filter_parameter)) -> dict:
    """Kennzahlen je Vertriebskanal."""
    return abfragen.kanaele(filter)


@app.get("/api/kautionen")
def kautionen(filter: Filter = Depends(filter_parameter)) -> dict:
    """Kennzahlen je Kautionstyp."""
    return abfragen.kautionen(filter)


@app.get("/api/vorlaufzeit")
def vorlaufzeit(filter: Filter = Depends(filter_parameter)) -> dict:
    """Kennzahlen je Vorlaufzeit-Bucket."""
    return abfragen.vorlaufzeit(filter)


@app.get("/api/segment_kundentyp")
def segment_kundentyp(filter: Filter = Depends(filter_parameter)) -> dict:
    """Anzahl Buchungen je Marktsegment und Kundentyp."""
    return abfragen.segment_kundentyp(filter)


@app.get("/api/erloes_datum")
def erloes_datum(filter: Filter = Depends(filter_parameter)) -> dict:
    """Erlös je Monat nach Anreise- und nach Stornodatum."""
    return abfragen.erloes_nach_datum(filter)


@app.get("/api/laender")
def laender(filter: Filter = Depends(filter_parameter)) -> dict:
    """Kennzahlen je Herkunftsland."""
    return abfragen.laender(filter)


@app.get("/")
def startseite() -> FileResponse:
    """Liefert das Dashboard."""
    return FileResponse(FRONTEND / "index.html")


app.mount("/", StaticFiles(directory=FRONTEND), name="frontend")
