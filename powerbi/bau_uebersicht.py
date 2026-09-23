"""Baut die Seite „Übersicht“ des Power-BI-Projekts Hotel.pbip im reduzierten Design
(Skill thws-dashboard) und ergänzt Modell und Design:

* FACT_BOOKINGS.tmdl: Measures für Kacheln (Bezugsjahr, Vergleichsmonate, Veränderung, Farbe,
  Minisäulen), Zeitreihe (Saisonpunkte, Letzter Monat) und Untertitel
* DIM_COUNTRY.tmdl: berechnete Spalte Land (deutsche Ländernamen)
* Jahre.tmdl: beziehungslose Tabelle für die Minisäulen
* Hotel.Report: Seite uebersicht (1920 × 1080) mit Kacheln, Balken, Linie und zwei Slicern,
  Designdatei THWS_klar.json

Aufruf aus powerbi/:  python3 bau_uebersicht.py   (idempotent)
"""
import json
import re
import shutil
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SM = HERE / "Hotel.SemanticModel" / "definition"
REP = HERE / "Hotel.Report"
PAGE = REP / "definition" / "pages" / "uebersicht"

AKZENT, GRAU, HELL, ROT, PUNKT, TEXT, TEXT2 = "#1E3A8A", "#4B5563", "#CBD5E1", "#B23B1E", "#94A3B8", "#131B2E", "#6B7280"


def tag():
    return str(uuid.uuid4())


# ------------------------------------------------------------------ 1  Measures (DAX)
def measure(name, dax, fmt=None):
    lines = dax.strip("\n").split("\n")
    body = "\n".join("\t\t\t" + l for l in lines)
    s = f"\tmeasure '{name}' =\n{body}\n"
    if fmt:
        s += f"\t\tformatString: {fmt}\n"
    s += f"\t\tlineageTag: {tag()}\n\n"
    return s


VGL = """VAR j = [Bezugsjahr]
VAR mb = CALCULATETABLE(SUMMARIZE(FACT_BOOKINGS, DIM_DATE[month]), REMOVEFILTERS(DIM_DATE), DIM_DATE[year] = j)
VAR mv = CALCULATETABLE(SUMMARIZE(FACT_BOOKINGS, DIM_DATE[month]), REMOVEFILTERS(DIM_DATE), DIM_DATE[year] = j - 1)
VAR m = INTERSECT(mb, mv)"""

M = ""
M += measure("Bezugsjahr", "IF(ISFILTERED(DIM_DATE[year]), MAX(DIM_DATE[year]), 2016)", "0")
M += measure("Vergleichszeitraum", VGL + """
VAR mn = MINX(m, DIM_DATE[month])
VAR mx = MAXX(m, DIM_DATE[month])
RETURN IF(ISEMPTY(m), BLANK(),
    IF(mn = mx, FORMAT(DATE(2000, mn, 1), "MMM"), FORMAT(DATE(2000, mn, 1), "MMM") & "–" & FORMAT(DATE(2000, mx, 1), "MMM"))
    & " " & FORMAT(j - 1, "0"))""")

KPIS = [  # (Präfix, Basis-Measure, Kacheltitel, Format, Art)
    ("Umsatz", "[Umsatz]", "UMSATZ", "#,0", "prozent"),
    ("Buchungen", "[Anzahl Buchungen]", "BUCHUNGEN", "#,0", "prozent"),
    ("Stornoquote", "[Stornoquote %]", "STORNOQUOTE", "0.0 %", "punkte"),
    ("ADR", "[Ø ADR]", "Ø ADR", "#,0.00", "prozent"),
]
for k, base, titel, fmt, art in KPIS:
    M += measure(f"{k} Bezugsjahr", f"VAR j = [Bezugsjahr]\nRETURN CALCULATE({base}, REMOVEFILTERS(DIM_DATE), DIM_DATE[year] = j)", fmt)
    M += measure(f"{k} Vergleich Bezugsjahr", VGL + f"\nRETURN CALCULATE({base}, REMOVEFILTERS(DIM_DATE), DIM_DATE[year] = j, m)", fmt)
    M += measure(f"{k} Vergleich Vorjahr", VGL + f"\nRETURN CALCULATE({base}, REMOVEFILTERS(DIM_DATE), DIM_DATE[year] = j - 1, m)", fmt)
    if art == "prozent":
        M += measure(f"{k} Veränderung", f"""VAR a = [{k} Vergleich Bezugsjahr]
VAR v = [{k} Vergleich Vorjahr]
VAR d = DIVIDE(a - v, v)
RETURN IF(ISBLANK(v), "kein Vorjahr im Datensatz",
    IF(d >= 0, "+", "−") & FORMAT(ABS(d) * 100, "0.0") & " % zu " & [Vergleichszeitraum])""")
        M += measure(f"{k} Farbe", f'IF(ISBLANK([{k} Vergleich Vorjahr]) || [{k} Vergleich Bezugsjahr] >= [{k} Vergleich Vorjahr], "{AKZENT}", "{ROT}")')
    else:
        M += measure(f"{k} Veränderung", f"""VAR a = [{k} Vergleich Bezugsjahr]
VAR v = [{k} Vergleich Vorjahr]
VAR d = (a - v) * 100
RETURN IF(ISBLANK(v), "kein Vorjahr im Datensatz",
    IF(d > 0, "+", IF(d < 0, "−", "±")) & FORMAT(ABS(d), "0.0") & " Punkte zu " & [Vergleichszeitraum])""")
        M += measure(f"{k} Farbe", f'IF(ISBLANK([{k} Vergleich Vorjahr]) || [{k} Vergleich Bezugsjahr] <= [{k} Vergleich Vorjahr], "{AKZENT}", "{ROT}")')
    M += measure(f"{k} Titel", f'"{titel} " & FORMAT([Bezugsjahr], "0")')
    M += measure(f"{k} Aktuell", f"""VAR j = [Bezugsjahr]
VAR y = MAX(Jahre[Jahr])
RETURN IF(y = j, CALCULATE({base}, REMOVEFILTERS(DIM_DATE), DIM_DATE[year] = y))""", fmt)
    M += measure(f"{k} Vorjahre", f"""VAR j = [Bezugsjahr]
VAR y = MAX(Jahre[Jahr])
RETURN IF(y <> j, CALCULATE({base}, REMOVEFILTERS(DIM_DATE), DIM_DATE[year] = y))""", fmt)

M += measure("Letzter Monat Datum", "MAXX(CALCULATETABLE(SUMMARIZE(FACT_BOOKINGS, DIM_DATE[Monat]), ALLSELECTED()), DIM_DATE[Monat])", "MMMM yyyy")
M += measure("Erster Monat Datum", "MINX(CALCULATETABLE(SUMMARIZE(FACT_BOOKINGS, DIM_DATE[Monat]), ALLSELECTED()), DIM_DATE[Monat])", "MMMM yyyy")
M += measure("Letzter Monat", "IF(MAX(DIM_DATE[Monat]) = [Letzter Monat Datum], [Umsatz])", "#,0")
M += measure("Saisonpunkte", """VAR y = MAX(DIM_DATE[year])
VAR cur = [Umsatz]
VAR mx = MAXX(CALCULATETABLE(SUMMARIZE(FACT_BOOKINGS, DIM_DATE[Monat]), ALLSELECTED(), DIM_DATE[year] = y), [Umsatz])
RETURN IF(cur = mx && MAX(DIM_DATE[Monat]) < [Letzter Monat Datum], cur)""", "#,0")
M += measure("Zeitraum", """VAR t = CALCULATETABLE(SUMMARIZE(FACT_BOOKINGS, DIM_DATE[year]), ALLSELECTED())
VAR mn = MINX(t, DIM_DATE[year])
VAR mx = MAXX(t, DIM_DATE[year])
RETURN IF(mn = mx, FORMAT(mn, "0"), FORMAT(mn, "0") & "–" & FORMAT(mx, "0"))""")
M += measure("Hotelauswahl", 'IF(HASONEVALUE(DIM_HOTEL[hotel]), MAX(DIM_HOTEL[hotel]), "beide Hotels")')
M += measure("Untertitel Segment", '"Umsatz in Euro je Marktsegment, " & [Zeitraum] & ", " & [Hotelauswahl]')
M += measure("Untertitel Vorlaufzeit", '"Stornoquote in % je Vorlaufzeit-Klasse, " & [Zeitraum] & ", " & [Hotelauswahl]')
M += measure("Untertitel Länder", '"Umsatz in Euro je Herkunftsland, die zwölf größten von 178, " & [Zeitraum] & ", " & [Hotelauswahl]')
M += measure("Untertitel Monate", '"Umsatz je Anreisemonat in Euro, " & FORMAT([Erster Monat Datum], "MMMM yyyy") & " bis " & FORMAT([Letzter Monat Datum], "MMMM yyyy") & ", " & [Hotelauswahl]')

fact = SM / "tables" / "FACT_BOOKINGS.tmdl"
s = fact.read_text(encoding="utf-8")
if "\tmeasure 'Bezugsjahr' =" in s:   # idempotent: alte Fassung der Dashboard-Measures entfernen
    s = s[:s.index("\tmeasure 'Bezugsjahr' =")] + s[s.index("\tcolumn booking_id\n"):]
s = s.replace("\tcolumn booking_id\n", M + "\tcolumn booking_id\n", 1)
# Vorlaufzeit-Klassen lesbar beschriften (gleiche Klassen wie bisher)
s = s.replace('"0-7",', '"0–7 Tage",').replace('"8-30",', '"8–30 Tage",').replace('"31-90",', '"31–90 Tage",').replace('    "90+")', '    "über 90 Tage")')
fact.write_text(s, encoding="utf-8")

# ------------------------------------------------------------------ 2  Ländernamen
js = (ROOT / "dashboard" / "frontend" / "laendernamen.js").read_text(encoding="utf-8")
namen = json.loads(re.search(r"\{.*\}", js, re.S).group(0))
paare = ", ".join(f'"{k}", "{v}"' for k, v in sorted(namen.items()))
land = f"""\tcolumn Land = SWITCH(DIM_COUNTRY[country], {paare}, DIM_COUNTRY[country])
\t\tdataType: string
\t\tlineageTag: {tag()}
\t\tsummarizeBy: none

\t\tannotation SummarizationSetBy = User

"""
c = SM / "tables" / "DIM_COUNTRY.tmdl"
s = c.read_text(encoding="utf-8")
s = re.sub(r"\tcolumn Land = .*?annotation SummarizationSetBy = User\n\n", "", s, flags=re.S)
s = s.replace("\tpartition DIM_COUNTRY = m", land + "\tpartition DIM_COUNTRY = m", 1)
c.write_text(s, encoding="utf-8")

# ------------------------------------------------------------------ 3  Tabelle Jahre
(SM / "tables" / "Jahre.tmdl").write_text(f"""table Jahre
\tlineageTag: {tag()}

\tcolumn Jahr
\t\tdataType: int64
\t\tformatString: 0
\t\tlineageTag: {tag()}
\t\tsummarizeBy: none
\t\tisNameInferred
\t\tsourceColumn: [Jahr]

\t\tannotation SummarizationSetBy = Automatic

\tcolumn 'Jahr kurz'
\t\tdataType: string
\t\tlineageTag: {tag()}
\t\tsummarizeBy: none
\t\tisNameInferred
\t\tsourceColumn: [Jahr kurz]
\t\tsortByColumn: Jahr

\t\tannotation SummarizationSetBy = Automatic

\tpartition Jahre = calculated
\t\tmode: import
\t\tsource = ADDCOLUMNS(SELECTCOLUMNS(SUMMARIZE(FACT_BOOKINGS, DIM_DATE[year]), "Jahr", DIM_DATE[year]), "Jahr kurz", "'" & RIGHT(FORMAT([Jahr], "0"), 2))

\tannotation PBI_Id = {uuid.uuid4().hex}
""", encoding="utf-8")
m = SM / "model.tmdl"
s = m.read_text(encoding="utf-8")
if "ref table Jahre" not in s:
    s = s.rstrip("\n") + "\nref table Jahre\n"
m.write_text(s, encoding="utf-8")

# ------------------------------------------------------------------ 4  Designdatei
theme = {"name": "THWS klar", "dataColors": [AKZENT, GRAU, "#9CA3AF", HELL, "#6B7280", "#2563EB"],
         "background": "#FFFFFF", "foreground": TEXT, "tableAccent": AKZENT,
         "visualStyles": {"*": {"*": {
             "background": [{"show": False}], "border": [{"show": False}],
             "title": [{"show": True, "fontSize": 12, "fontColor": {"solid": {"color": TEXT}}, "alignment": "left"}],
             "legend": [{"show": False}],
             "categoryAxis": [{"gridlines": False, "showAxisTitle": False, "labelColor": {"solid": {"color": "#4E5A6E"}}, "fontSize": 9}],
             "valueAxis": [{"gridlines": False, "showAxisTitle": False, "labelColor": {"solid": {"color": "#9CA3AF"}}, "fontSize": 9}],
             "labels": [{"show": True, "color": {"solid": {"color": TEXT}}, "fontSize": 9}],
             "lineStyles": [{"strokeWidth": 2, "showMarker": False}]}},
             "lineChart": {"*": {"labels": [{"show": False}], "valueAxis": [{"gridlines": True, "gridlineColor": {"solid": {"color": "#EEF0F4"}}}]}},
             "clusteredBarChart": {"*": {"valueAxis": [{"show": False}]}}}}
res = REP / "StaticResources" / "RegisteredResources"
res.mkdir(parents=True, exist_ok=True)
(res / "THWS_klar.json").write_text(json.dumps(theme, ensure_ascii=False, indent=2), encoding="utf-8")
rj = REP / "definition" / "report.json"
r = json.loads(rj.read_text(encoding="utf-8"))
r["themeCollection"] = {"customTheme": {"name": "THWS_klar.json", "type": "RegisteredResources",
                                         "reportVersionAtImport": {"visual": "2.7.0", "report": "3.2.0", "page": "2.0.0"}}}
r["resourcePackages"] = [{"name": "RegisteredResources", "type": "RegisteredResources",
                          "items": [{"name": "THWS_klar.json", "path": "THWS_klar.json", "type": "CustomTheme"}]}]
rj.write_text(json.dumps(r, ensure_ascii=False, indent=2), encoding="utf-8")

# ------------------------------------------------------------------ 5  Seite Übersicht
if PAGE.exists():
    shutil.rmtree(PAGE)
(PAGE / "visuals").mkdir(parents=True)
(PAGE / "page.json").write_text(json.dumps({
    "$schema": "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.0.0/schema.json",
    "name": "uebersicht", "displayName": "Übersicht", "displayOption": "FitToPage", "height": 1080, "width": 1920,
    "objects": {"background": [{"properties": {"color": {"solid": {"color": {"expr": {"Literal": {"Value": "'#FFFFFF'"}}}}}, "transparency": {"expr": {"Literal": {"Value": "0D"}}}}}]}
}, ensure_ascii=False, indent=2), encoding="utf-8")

SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.7.0/schema.json"
Z = [1]


def lit(v):
    return {"expr": {"Literal": {"Value": v}}}


def meas(entity, name):
    return {"expr": {"Measure": {"Expression": {"SourceRef": {"Entity": entity}}, "Property": name}}}


def fmeasure(entity, name):
    return {"field": {"Measure": {"Expression": {"SourceRef": {"Entity": entity}}, "Property": name}}, "queryRef": f"{entity}.{name}", "nativeQueryRef": name}


def fcolumn(entity, name):
    return {"field": {"Column": {"Expression": {"SourceRef": {"Entity": entity}}, "Property": name}}, "queryRef": f"{entity}.{name}", "nativeQueryRef": name, "active": True}


def visual(name, vtype, x, y, w, h, query=None, objects=None, container=None, extra=None, filters=None):
    Z[0] += 1
    v = {"$schema": SCHEMA, "name": name, "position": {"x": x, "y": y, "z": Z[0], "width": w, "height": h, "tabOrder": Z[0]},
         "visual": {"visualType": vtype, "drillFilterOtherVisuals": True}}
    if query:
        v["visual"]["query"] = query
    if objects:
        v["visual"]["objects"] = objects
    if container:
        v["visual"]["visualContainerObjects"] = container
    if extra:
        v["visual"].update(extra)
    if filters:
        v["filterConfig"] = {"filters": filters}
    d = PAGE / "visuals" / name
    d.mkdir()
    (d / "visual.json").write_text(json.dumps(v, ensure_ascii=False, indent=2), encoding="utf-8")


def titel(text, untertitel_measure):
    return {"title": [{"properties": {"show": lit("true"), "text": lit(f"'{text}'"), "fontSize": lit("12D"), "bold": lit("true"),
                                       "titleWrap": lit("true"), "alignment": lit("'left'"), "fontColor": {"solid": {"color": lit(f"'{TEXT}'")}}}}],
            "subTitle": [{"properties": {"show": lit("true"), "text": meas("FACT_BOOKINGS", untertitel_measure), "fontSize": lit("10D"),
                                          "fontColor": {"solid": {"color": lit(f"'{TEXT2}'")}}}}]}


F = "FACT_BOOKINGS"
# Kopf
visual("titel", "textbox", 60, 40, 1340, 80, objects={"general": [{"properties": {"paragraphs": [
    {"textRuns": [{"value": "Hotel Booking Demand 2015–2017: 26,0 Mio. Euro Umsatz, 37 % der Buchungen storniert", "textStyle": {"fontSize": "20pt", "fontWeight": "bold", "color": TEXT}}]},
    {"textRuns": [{"value": "119.390 Buchungen, Anreisen Juli 2015 bis August 2017 · Umsatz in Euro ohne stornierte Buchungen · Quelle: Antonio, de Almeida, Nunes (2019)", "textStyle": {"fontSize": "10pt", "color": TEXT2}}]}]}}]})
slicer_obj = lambda kopf: {"data": [{"properties": {"mode": lit("'Dropdown'")}}],
                            "selection": [{"properties": {"singleSelect": lit("false"), "selectAllCheckboxEnabled": lit("true")}}],
                            "header": [{"properties": {"show": lit("true"), "text": lit(f"'{kopf}'"), "fontSize": lit("10D")}}]}
visual("slicer_jahr", "slicer", 1440, 44, 200, 64, query={"queryState": {"Values": {"projections": [fcolumn("DIM_DATE", "year")]}}},
       objects=slicer_obj("Anreisejahr"), container={"title": [{"properties": {"show": lit("false")}}]},
       filters=[{"name": "jahre_mit_anreisen", "field": {"Column": {"Expression": {"SourceRef": {"Entity": "DIM_DATE"}}, "Property": "year"}}, "type": "Categorical",
                 "filter": {"Version": 2, "From": [{"Name": "d", "Entity": "DIM_DATE", "Type": 0}],
                            "Where": [{"Condition": {"In": {"Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": "d"}}, "Property": "year"}}],
                                                            "Values": [[{"Literal": {"Value": "2015L"}}], [{"Literal": {"Value": "2016L"}}], [{"Literal": {"Value": "2017L"}}]]}}}]}}])
visual("slicer_hotel", "slicer", 1660, 44, 200, 64, query={"queryState": {"Values": {"projections": [fcolumn("DIM_HOTEL", "hotel")]}}},
       objects=slicer_obj("Hotel"), container={"title": [{"properties": {"show": lit("false")}}]})

# Kacheln
for i, (k, base, _t, fmt, art) in enumerate(KPIS):
    x = 64 + i * 453
    einheit, praez = ("1D", "0D") if k in ("Umsatz", "Buchungen") else ("1D", "1D" if k == "Stornoquote" else "2D")
    visual(f"k_{k.lower()}_titel", "card", x, 104, 230, 60, query={"queryState": {"Values": {"projections": [fmeasure(F, f"{k} Titel")]}}},
           objects={"labels": [{"properties": {"fontSize": lit("10D"), "color": {"solid": {"color": lit(f"'{TEXT2}'")}}}}], "categoryLabels": [{"properties": {"show": lit("false")}}]})
    visual(f"k_{k.lower()}_wert", "card", x, 189, 230, 62, query={"queryState": {"Values": {"projections": [fmeasure(F, f"{k} Bezugsjahr")]}}},
           objects={"labels": [{"properties": {"labelDisplayUnits": lit(einheit), "labelPrecision": lit(praez), "fontSize": lit("28D"), "color": {"solid": {"color": lit(f"'{TEXT}'")}}}}],
                    "categoryLabels": [{"properties": {"show": lit("false")}}]})
    visual(f"k_{k.lower()}_delta", "card", x, 247, 230, 48, query={"queryState": {"Values": {"projections": [fmeasure(F, f"{k} Veränderung")]}}},
           objects={"labels": [{"properties": {"fontSize": lit("11D"), "color": {"solid": {"color": meas(F, f"{k} Farbe")}}}}], "categoryLabels": [{"properties": {"show": lit("false")}}]})
    visual(f"k_{k.lower()}_saeulen", "columnChart", x + 214, 147, 200, 166,
           query={"queryState": {"Category": {"projections": [fcolumn("Jahre", "Jahr kurz")]},
                                 "Y": {"projections": [fmeasure(F, f"{k} Vorjahre"), fmeasure(F, f"{k} Aktuell")]}},
                  "sortDefinition": {"sort": [{"field": {"Column": {"Expression": {"SourceRef": {"Entity": "Jahre"}}, "Property": "Jahr"}}, "direction": "Ascending"}], "isDefaultSort": True}},
           objects={"labels": [{"properties": {"show": lit("false")}}], "valueAxis": [{"properties": {"show": lit("false")}}],
                    "categoryAxis": [{"properties": {"showAxisTitle": lit("false"), "fontSize": lit("8D"), "innerPadding": lit("20D")}}],
                    "dataPoint": [{"properties": {"fill": {"solid": {"color": lit(f"'{HELL}'")}}}, "selector": {"metadata": f"{F}.{k} Vorjahre"}},
                                  {"properties": {"fill": {"solid": {"color": lit(f"'{AKZENT}'")}}}, "selector": {"metadata": f"{F}.{k} Aktuell"}}],
                    "legend": [{"properties": {"show": lit("false")}}]},
           container={"title": [{"properties": {"show": lit("false")}}]})


def balken(name, x, y, w, h, entity, column, measure_name, aussage, untertitel, filters=None):
    visual(name, "clusteredBarChart", x, y, w, h,
           query={"queryState": {"Category": {"projections": [fcolumn(entity, column)]}, "Y": {"projections": [fmeasure(F, measure_name)]}},
                  "sortDefinition": {"sort": [{"field": {"Measure": {"Expression": {"SourceRef": {"Entity": F}}, "Property": measure_name}}, "direction": "Descending"}], "isDefaultSort": True}},
           objects={"labels": [{"properties": {"show": lit("true"), "labelDisplayUnits": lit("1D"), "labelPrecision": lit("1D" if measure_name.startswith("Stornoquote") else "0D"), "fontSize": lit("9D")}}],
                    "valueAxis": [{"properties": {"show": lit("false")}}],
                    "categoryAxis": [{"properties": {"showAxisTitle": lit("false"), "fontSize": lit("10D"), "preferredCategoryWidth": lit("20D")}}],
                    "dataPoint": [{"properties": {"fill": {"solid": {"color": lit(f"'{GRAU}'")}}}}],
                    "legend": [{"properties": {"show": lit("false")}}]},
           container=titel(aussage, untertitel), filters=filters)


balken("b_segment", 64, 365, 640, 238, "DIM_MARKET_SEGMENT", "market_segment", "Umsatz",
       "Online TA liefert 53 % des Umsatzes, Groups nur 7 %", "Untertitel Segment",
       filters=[{"name": "ohne_undefined", "field": {"Column": {"Expression": {"SourceRef": {"Entity": "DIM_MARKET_SEGMENT"}}, "Property": "market_segment"}}, "type": "Categorical",
                 "filter": {"Version": 2, "From": [{"Name": "m", "Entity": "DIM_MARKET_SEGMENT", "Type": 0}],
                            "Where": [{"Condition": {"Not": {"Expression": {"In": {"Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": "m"}}, "Property": "market_segment"}}],
                                                                                        "Values": [[{"Literal": {"Value": "'Undefined'"}}]]}}}}}]}}])
balken("b_vorlaufzeit", 64, 615, 640, 165, F, "Lead-Time-Bucket", "Stornoquote %",
       "Ab 90 Tagen Vorlauf wird jede zweite Buchung storniert, unter 8 Tagen jede zehnte", "Untertitel Vorlaufzeit")
top12 = {"name": "top12_laender", "field": {"Column": {"Expression": {"SourceRef": {"Entity": "DIM_COUNTRY"}}, "Property": "Land"}}, "type": "TopN",
         "filter": {"Version": 2, "From": [{"Name": "subquery", "Expression": {"Subquery": {"Query": {"Version": 2,
                    "From": [{"Name": "d", "Entity": "DIM_COUNTRY", "Type": 0}, {"Name": "f", "Entity": F, "Type": 0}],
                    "Select": [{"Column": {"Expression": {"SourceRef": {"Source": "d"}}, "Property": "Land"}, "Name": "field"}],
                    "OrderBy": [{"Direction": 2, "Expression": {"Measure": {"Expression": {"SourceRef": {"Source": "f"}}, "Property": "Umsatz"}}}], "Top": 12}}}, "Type": 2},
                    {"Name": "d", "Entity": "DIM_COUNTRY", "Type": 0}],
                    "Where": [{"Condition": {"In": {"Expressions": [{"Column": {"Expression": {"SourceRef": {"Source": "d"}}, "Property": "Land"}}], "Table": {"SourceRef": {"Source": "subquery"}}}}}]}}
balken("b_laender", 744, 365, 1120, 700, "DIM_COUNTRY", "Land", "Umsatz",
       "Fünf Länder liefern 66 % des Umsatzes, Portugal allein 21 %", "Untertitel Länder", filters=[top12])

visual("l_monat", "lineChart", 64, 792, 640, 273,
       query={"queryState": {"Category": {"projections": [fcolumn("DIM_DATE", "Monat")]},
                             "Y": {"projections": [fmeasure(F, "Umsatz"), fmeasure(F, "Saisonpunkte"), fmeasure(F, "Letzter Monat")]}}},
       objects={"lineStyles": [{"properties": {"strokeWidth": lit("2D"), "showMarker": lit("false"), "lineChartType": lit("'linear'")}},
                               {"properties": {"strokeWidth": lit("0D"), "showMarker": lit("true"), "markerShape": lit("'circle'"), "markerSize": lit("4D"), "markerColor": {"solid": {"color": lit(f"'{PUNKT}'")}}}, "selector": {"metadata": f"{F}.Saisonpunkte"}},
                               {"properties": {"strokeWidth": lit("0D"), "showMarker": lit("true"), "markerShape": lit("'circle'"), "markerSize": lit("5D"), "markerColor": {"solid": {"color": lit(f"'{ROT}'")}}}, "selector": {"metadata": f"{F}.Letzter Monat"}}],
                "dataPoint": [{"properties": {"fill": {"solid": {"color": lit(f"'{AKZENT}'")}}}, "selector": {"metadata": f"{F}.Umsatz"}},
                              {"properties": {"fill": {"solid": {"color": lit(f"'{PUNKT}'")}}}, "selector": {"metadata": f"{F}.Saisonpunkte"}},
                              {"properties": {"fill": {"solid": {"color": lit(f"'{ROT}'")}}}, "selector": {"metadata": f"{F}.Letzter Monat"}}],
                "labels": [{"properties": {"show": lit("true"), "fontSize": lit("9D"), "labelDisplayUnits": lit("1D"), "labelPrecision": lit("0D"), "labelPosition": lit("'Above'")}},
                           {"properties": {"show": lit("false")}, "selector": {"metadata": f"{F}.Umsatz"}},
                           {"properties": {"show": lit("true"), "color": {"solid": {"color": lit(f"'{TEXT2}'")}}}, "selector": {"metadata": f"{F}.Saisonpunkte"}},
                           {"properties": {"show": lit("true"), "labelPosition": lit("'Under'"), "color": {"solid": {"color": lit(f"'{ROT}'")}}}, "selector": {"metadata": f"{F}.Letzter Monat"}}],
                "valueAxis": [{"properties": {"show": lit("false"), "gridlines": lit("false")}}],
                "categoryAxis": [{"properties": {"showAxisTitle": lit("false"), "fontSize": lit("9D"), "start": lit("datetime'2015-07-01T00:00:00'"), "end": lit("datetime'2017-08-01T00:00:00'")}}],
                "legend": [{"properties": {"show": lit("false")}}]},
       container=titel("Jahreshoch jedes Jahr im August, zuletzt 1,97 Mio.", "Untertitel Monate"))

print("Seite uebersicht:", sorted(p.name for p in (PAGE / "visuals").iterdir()))
print("Measures ergänzt:", M.count("\tmeasure '"))
