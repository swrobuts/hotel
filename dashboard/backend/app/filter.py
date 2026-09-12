"""Der Filterzustand des Dashboards und seine Übersetzung in SQL.

Jeder Filter ist optional. Aus den gesetzten Filtern entsteht eine
WHERE-Bedingung mit benannten Parametern, damit Werte nie in den SQL-Text
gelangen (Schutz vor SQL-Injektion).
"""

from dataclasses import dataclass, fields


@dataclass
class Filter:
    hotel: str | None = None        # z. B. "City Hotel"
    jahr: int | None = None         # Anreisejahr, z. B. 2016
    von: str | None = None          # erster Monat des Zeitraums, "2016-01"
    bis: str | None = None          # letzter Monat des Zeitraums, "2016-12"
    segment: str | None = None      # Marktsegment
    kanal: str | None = None        # Vertriebskanal
    kundentyp: str | None = None
    kaution: str | None = None      # Kautionstyp
    land: str | None = None         # ISO-3-Code
    vorlaufzeit: str | None = None  # Bucket "0-7", "8-30", "31-90", "90+"


# Der Vorlaufzeit-Bucket als SQL-Ausdruck, gleich definiert wie in Power BI.
VORLAUFZEIT_BUCKET = (
    "CASE WHEN f.lead_time <= 7 THEN '0-7' "
    "WHEN f.lead_time <= 30 THEN '8-30' "
    "WHEN f.lead_time <= 90 THEN '31-90' ELSE '90+' END"
)


def naechster_monat(monat: str) -> str:
    """Gibt zu "2016-12" den ersten Tag des Folgemonats zurück ("2017-01-01")."""
    jahr, mon = (int(teil) for teil in monat.split("-"))
    if mon == 12:
        return f"{jahr + 1}-01-01"
    return f"{jahr}-{mon + 1:02d}-01"


def where_klausel(filter: Filter, datum: str = "d") -> tuple[str, dict]:
    """Baut aus dem Filter die WHERE-Bedingung; `datum` ist der Alias der Datumstabelle (Anreise oder Storno)."""
    bedingungen = []
    parameter = {}
    if filter.hotel:
        bedingungen.append("h.hotel = :hotel")
        parameter["hotel"] = filter.hotel
    if filter.jahr:
        bedingungen.append(f"{datum}.year = :jahr")
        parameter["jahr"] = filter.jahr
    if filter.von:
        bedingungen.append(f"{datum}.full_date >= :von")
        parameter["von"] = f"{filter.von}-01"
    if filter.bis:
        bedingungen.append(f"{datum}.full_date < :bis")
        parameter["bis"] = naechster_monat(filter.bis)
    if filter.segment:
        bedingungen.append("ms.market_segment = :segment")
        parameter["segment"] = filter.segment
    if filter.kanal:
        bedingungen.append("dc.distribution_channel = :kanal")
        parameter["kanal"] = filter.kanal
    if filter.kundentyp:
        bedingungen.append("ct.customer_type = :kundentyp")
        parameter["kundentyp"] = filter.kundentyp
    if filter.kaution:
        bedingungen.append("dt.deposit_type = :kaution")
        parameter["kaution"] = filter.kaution
    if filter.land:
        bedingungen.append("c.country = :land")
        parameter["land"] = filter.land
    if filter.vorlaufzeit:
        bedingungen.append(f"{VORLAUFZEIT_BUCKET} = :vorlaufzeit")
        parameter["vorlaufzeit"] = filter.vorlaufzeit
    if not bedingungen:
        return "", parameter
    return "WHERE " + "\n  AND ".join(bedingungen), parameter


def filter_aus_werten(**werte) -> Filter:
    """Baut den Filter aus Abfrageparametern; leere Zeichenketten gelten als nicht gesetzt."""
    bereinigt = {}
    for feld in fields(Filter):
        wert = werte.get(feld.name)
        if wert in (None, ""):
            continue
        bereinigt[feld.name] = int(wert) if feld.name == "jahr" else wert
    return Filter(**bereinigt)
