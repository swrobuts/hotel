"""Baut die Tableau-Arbeitsmappe Hotel_Dashboard.twb aus XML-Bausteinen.

Aufruf (aus dem Repo-Root):
    python3 tools/flache_buchungstabelle.py <ausgabe>/Data/hotel
    python3 tableau/bau_hotel_dashboard.py <ausgabe>
    cd <ausgabe> && zip -r Hotel_Dashboard.twbx Hotel_Dashboard.twb Data

Gestaltung nach dem Skill thws-dashboard: eine Akzentfarbe, graue Balken, Werte an den Marken,
Aussagentitel mit Zahl, Kacheln mit Bezugsjahr und Vorjahresvergleich, Jahres- und Hotelfilter.
"""
import sys
import uuid
from pathlib import Path
from xml.sax.saxutils import escape

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(".")
DS = "federated.hotel0001"          # Name der Datenquelle
CONN = "textscan.hotel0001"          # Name der Textverbindung
P = "[Parameters].[Parameter 1]"     # Jahr
PH = "[Parameters].[Parameter 2]"    # Hotel
ALLE_JAHRE = "2015–2017"
ALLE_HOTELS = "Alle Hotels"

AKZENT, GRAU, HELL, ROT, PUNKT, TEXT, TEXT2 = "#1e3a8a", "#4b5563", "#cbd5e1", "#b23b1e", "#94a3b8", "#131b2e", "#6b7280"


def uid():
    return "{" + str(uuid.uuid4()).upper() + "}"


def cid_of(name):
    """[Calculation_9000000000000026] -> 26"""
    return int(name.strip("[]")[len("Calculation_"):]) - 9000000000000000


# ---------------------------------------------------------------- Spalten der CSV
CSV_COLS = [  # (name, datatype, caption, role, type)
    ("booking_id", "integer", "Buchungsnummer", "dimension", "ordinal"),
    ("hotel", "string", "Hotel", "dimension", "nominal"),
    ("arrival_date", "date", "Anreisedatum", "dimension", "ordinal"),
    ("reservation_status_date", "date", "Statusdatum", "dimension", "ordinal"),
    ("market_segment", "string", "Marktsegment", "dimension", "nominal"),
    ("distribution_channel", "string", "Vertriebskanal", "dimension", "nominal"),
    ("customer_type", "string", "Kundentyp", "dimension", "nominal"),
    ("deposit_type", "string", "Anzahlungsart", "dimension", "nominal"),
    ("meal", "string", "Verpflegung", "dimension", "nominal"),
    ("country", "string", "Land (ISO-3)", "dimension", "nominal"),
    ("country_name", "string", "Herkunftsland", "dimension", "nominal"),
    ("is_canceled", "integer", "Storniert (0/1)", "measure", "quantitative"),
    ("lead_time", "integer", "Vorlaufzeit (Tage)", "measure", "quantitative"),
    ("total_nights", "integer", "Nächte", "measure", "quantitative"),
    ("adults", "integer", "Erwachsene", "measure", "quantitative"),
    ("children", "real", "Kinder", "measure", "quantitative"),
    ("adr", "real", "ADR (Zimmerpreis je Nacht)", "measure", "quantitative"),
    ("revenue", "real", "Gebuchter Umsatz je Buchung", "measure", "quantitative"),
    ("reservation_status", "string", "Reservierungsstatus", "dimension", "nominal"),
]

# ---------------------------------------------------------------- berechnete Felder
UMS = "(IF [is_canceled] = 0 THEN [revenue] END)"          # Umsatz je Zeile, nur nicht storniert
HOTELBED = f'({PH} = "{ALLE_HOTELS}" OR [hotel] = {PH})'   # Hotelfilter als Bedingung
JAHRBED = f'({P} = "{ALLE_JAHRE}" OR STR(YEAR([arrival_date])) = {P})'
MONAT = 'DATETRUNC("month", [arrival_date])'
MIN_JAHR_M = "{ FIXED MONTH([arrival_date]) : MIN(YEAR([arrival_date])) }"
MAX_JAHR_M = "{ FIXED MONTH([arrival_date]) : MAX(YEAR([arrival_date])) }"


def fmt_tausender(x):
    """Tableau-Formel: ganze Zahl mit Punkt als Tausendertrenner (bis 999.999.999)."""
    x = f"ROUND({x}, 0)"
    return (f'(IF {x} >= 1000000 THEN STR(INT({x} / 1000000)) + "." + RIGHT("000" + STR(INT({x} / 1000) % 1000), 3)'
            f' + "." + RIGHT("000" + STR(INT({x}) % 1000), 3)'
            f' ELSEIF {x} >= 1000 THEN STR(INT({x} / 1000)) + "." + RIGHT("000" + STR(INT({x}) % 1000), 3)'
            f' ELSE STR(INT({x})) END)')


def monatskuerzel(n):
    return (f'(CASE {n} WHEN 1 THEN "Jan" WHEN 2 THEN "Feb" WHEN 3 THEN "Mär" WHEN 4 THEN "Apr" WHEN 5 THEN "Mai"'
            f' WHEN 6 THEN "Jun" WHEN 7 THEN "Jul" WHEN 8 THEN "Aug" WHEN 9 THEN "Sep" WHEN 10 THEN "Okt"'
            f' WHEN 11 THEN "Nov" WHEN 12 THEN "Dez" END)')


CALCS = {}   # id -> dict(caption, datatype, role, type, formula, default_format)


def calc(cid, caption, datatype, role, typ, formula, default_format=None):
    CALCS[cid] = dict(caption=caption, datatype=datatype, role=role, type=typ, formula=formula, fmt=default_format)
    return f"[Calculation_90000000000{cid:05d}]"


# Grundkennzahlen (Namen wie im Power-BI-Modell)
C_BUCH = calc(1, "Anzahl Buchungen", "integer", "measure", "quantitative", "COUNT([booking_id])", "#,##0")
C_UMS = calc(2, "Umsatz", "real", "measure", "quantitative", f"SUM{UMS}", "#,##0")
C_GEB = calc(3, "Gebuchter Umsatz", "real", "measure", "quantitative", "SUM([revenue])", "#,##0")
C_STQ = calc(4, "Stornoquote %", "real", "measure", "quantitative", "AVG([is_canceled])", "0.0%")
C_ADR = calc(5, "Ø ADR", "real", "measure", "quantitative", "AVG([adr])", "#,##0.00")
C_VLK = calc(6, "Vorlaufzeit-Klasse", "string", "dimension", "nominal",
             'IF [lead_time] <= 7 THEN "0–7 Tage" ELSEIF [lead_time] <= 30 THEN "8–30 Tage" '
             'ELSEIF [lead_time] <= 90 THEN "31–90 Tage" ELSE "über 90 Tage" END')
# Filter und Bezugsjahr
C_JAHRGEW = calc(7, "Jahr gewählt", "boolean", "dimension", "nominal", f"{JAHRBED} AND {HOTELBED}")
C_HOTGEW = calc(8, "Hotel gewählt", "boolean", "dimension", "nominal", HOTELBED)
C_BEZJ = calc(10, "Bezugsjahr", "integer", "dimension", "ordinal",
              f'IF {P} = "{ALLE_JAHRE}" THEN 2016 ELSE INT({P}) END')
C_JKURZ = calc(11, "Jahr kurz", "string", "dimension", "nominal", '"\'" + RIGHT(STR(YEAR([arrival_date])), 2)')
C_AKT = calc(12, "Aktuelles Jahr", "string", "dimension", "nominal",
             f'IF YEAR([arrival_date]) = {C_BEZJ} THEN "aktuell" ELSE "früher" END')
# Vergleichsmonate: nur Monate, die im Bezugsjahr UND im Vorjahr vorliegen (Teiljahre 2015 und 2017)
BEZ_ROW = f"YEAR([arrival_date]) = {C_BEZJ}"
BEZ_VGL = f"({BEZ_ROW} AND {C_BEZJ} - 1 >= {MIN_JAHR_M})"
VOR_VGL = f"(YEAR([arrival_date]) = {C_BEZJ} - 1 AND {C_BEZJ} <= {MAX_JAHR_M})"
C_VGLZEIT = calc(13, "Vergleichszeitraum", "string", "measure", "nominal",
                 f'IF MIN(IF {BEZ_VGL} THEN MONTH([arrival_date]) END) = MAX(IF {BEZ_VGL} THEN MONTH([arrival_date]) END) '
                 f'THEN {monatskuerzel(f"MIN(IF {BEZ_VGL} THEN MONTH([arrival_date]) END)")} '
                 f'ELSE {monatskuerzel(f"MIN(IF {BEZ_VGL} THEN MONTH([arrival_date]) END)")} + "–" + '
                 f'{monatskuerzel(f"MAX(IF {BEZ_VGL} THEN MONTH([arrival_date]) END)")} END + " " + STR(MIN({C_BEZJ}) - 1)')

KPIS = {}   # key -> dict mit Feldnamen für Text- und Kachelblätter


def kpi(key, base, titel, agg_bez, agg_vgl, agg_vor, text_bez, art):
    """Legt je Kennzahl die Felder Bezugsjahr, Vergleich, Vorjahr, Veränderung (+/−), Titel an."""
    b = base
    bez = calc(b + 0, f"{key} Bezugsjahr", "real", "measure", "quantitative", agg_bez)
    vgl = calc(b + 1, f"{key} Bezugsjahr Vergleichsmonate", "real", "measure", "quantitative", agg_vgl)
    vor = calc(b + 2, f"{key} Vorjahr Vergleichsmonate", "real", "measure", "quantitative", agg_vor)
    if art == "prozentpunkte":
        d = f"(({vgl} - {vor}) * 100)"
        text = (f'IF ISNULL({vor}) THEN "kein Vorjahr im Datensatz" ELSE (IF {d} > 0 THEN "+" ELSEIF {d} < 0 THEN "−" ELSE "±" END)'
                f' + REPLACE(STR(ROUND(ABS({d}), 1)), ".", ",") + " Punkte zu " + {C_VGLZEIT} END')
        gut = f"(ISNULL({vor}) OR {vgl} <= {vor})"
    else:
        text = (f'IF ISNULL({vor}) OR {vor} = 0 THEN "kein Vorjahr im Datensatz" ELSE (IF {vgl} >= {vor} THEN "+" ELSE "−" END)'
                f' + REPLACE(STR(ROUND(ABS({vgl} / {vor} - 1) * 100, 1)), ".", ",") + " % zu " + {C_VGLZEIT} END')
        gut = f"(ISNULL({vor}) OR {vor} = 0 OR {vgl} >= {vor})"
    ver = calc(b + 3, f"{key} Veränderung", "string", "measure", "nominal", text)
    pos = calc(b + 4, f"{key} Veränderung positiv", "string", "measure", "nominal", f'IF {gut} THEN {ver} ELSE "" END')
    neg = calc(b + 5, f"{key} Veränderung negativ", "string", "measure", "nominal", f'IF NOT {gut} THEN {ver} ELSE "" END')
    tit = calc(b + 6, f"{key} Titel", "string", "measure", "nominal", f'MAX("{titel} " + STR({C_BEZJ}))')
    txt = calc(b + 7, f"{key} Bezugsjahr Text", "string", "measure", "nominal", text_bez(bez))
    KPIS[key] = dict(bez=bez, vgl=vgl, vor=vor, ver=ver, pos=pos, neg=neg, tit=tit, txt=txt)


kpi("Umsatz", 20, "UMSATZ",
    f"SUM(IF {BEZ_ROW} THEN {UMS} END)", f"SUM(IF {BEZ_VGL} THEN {UMS} END)", f"SUM(IF {VOR_VGL} THEN {UMS} END)",
    fmt_tausender, "prozent")
kpi("Buchungen", 30, "BUCHUNGEN",
    f"COUNT(IF {BEZ_ROW} THEN [booking_id] END)", f"COUNT(IF {BEZ_VGL} THEN [booking_id] END)",
    f"COUNT(IF {VOR_VGL} THEN [booking_id] END)", fmt_tausender, "prozent")
kpi("Stornoquote", 40, "STORNOQUOTE",
    f"AVG(IF {BEZ_ROW} THEN [is_canceled] END)", f"AVG(IF {BEZ_VGL} THEN [is_canceled] END)",
    f"AVG(IF {VOR_VGL} THEN [is_canceled] END)",
    lambda x: f'REPLACE(STR(ROUND({x} * 100, 1)), ".", ",") + " %"', "prozentpunkte")
kpi("ADR", 50, "Ø ADR",
    f"AVG(IF {BEZ_ROW} THEN [adr] END)", f"AVG(IF {BEZ_VGL} THEN [adr] END)", f"AVG(IF {VOR_VGL} THEN [adr] END)",
    lambda x: f'(IF LEN(STR(ROUND({x}, 2))) - FIND(STR(ROUND({x}, 2)), ".") = 1 THEN REPLACE(STR(ROUND({x}, 2)), ".", ",") + "0" '
              f'ELSE REPLACE(STR(ROUND({x}, 2)), ".", ",") END)', "prozent")

C_STQ_TXT = calc(9, "Stornoquote Text", "string", "measure", "nominal",
                 'REPLACE(STR(ROUND(AVG([is_canceled]) * 100, 1)), ".", ",") + " %"')
# Zeitreihe
UMS_H = f"(IF [is_canceled] = 0 AND {HOTELBED} THEN [revenue] END)"   # Umsatz je Zeile unter Hotelfilter (für LOD)
MONATSUMS = f"{{ FIXED YEAR([arrival_date]), {MONAT} : SUM{UMS_H} }}"
JAHRESHOCH = f"{{ FIXED YEAR([arrival_date]) : MAX({MONATSUMS}) }}"
LETZTER = f"{{ MAX(IF {JAHRBED} THEN {MONAT} END) }}"
C_LETZT = calc(60, "Letzter Monat", "real", "measure", "quantitative", f"IF {MONAT} = {LETZTER} THEN {UMS} END")
C_SAISON = calc(61, "Saisonpunkte", "real", "measure", "quantitative",
                f"IF {MONATSUMS} = {JAHRESHOCH} OR {MONAT} = {LETZTER} THEN {UMS} END")
C_PUNKT = calc(62, "Punktart", "string", "dimension", "nominal",
               f'IF {MONAT} = {LETZTER} THEN "letzter Monat" ELSE "Jahreshoch" END')
C_ZEITR = calc(63, "Zeitraum Text", "string", "dimension", "nominal",
               f'IF {P} = "{ALLE_JAHRE}" THEN "Juli 2015 bis August 2017" ELSEIF {P} = "2015" THEN "Juli bis Dezember 2015" '
               f'ELSEIF {P} = "2016" THEN "Januar bis Dezember 2016" ELSE "Januar bis August 2017" END')
C_LBL_HOCH = calc(64, "Label Jahreshoch", "string", "measure", "nominal",
                  f'IF SUM({C_LETZT}) > 0 THEN "" ELSE {fmt_tausender(f"SUM({C_SAISON})")} END')
C_LBL_LETZT = calc(65, "Label letzter Monat", "string", "measure", "nominal",
                   f'IF SUM({C_LETZT}) > 0 THEN {fmt_tausender(f"SUM({C_LETZT})")} ELSE "" END')


# ---------------------------------------------------------------- XML-Bausteine
def col_def(name):
    """<column>-Definition für datasource-dependencies (Rohspalte oder berechnetes Feld)."""
    if name.startswith("[Calculation_"):
        c = CALCS[cid_of(name)]
        fmt = f' default-format="{c["fmt"]}"' if c["fmt"] else ""
        return (f'<column caption="{escape(c["caption"])}" datatype="{c["datatype"]}"{fmt} name="{name}" role="{c["role"]}" type="{c["type"]}">\n'
                f'  <calculation class="tableau" formula="{escape(c["formula"], {chr(34): "&quot;"})}" />\n</column>')
    raw = {n: (dt, role, typ) for n, dt, _, role, typ in CSV_COLS}[name.strip("[]")]
    return f'<column datatype="{raw[0]}" name="{name}" role="{raw[1]}" type="{raw[2]}" />'


def inst(name, deriv):
    """column-instance: (name im Datenquellenpräfix, Instanzname)."""
    key = name.strip("[]")
    typ = {"none": "nominal", "usr": None, "sum": "quantitative", "tmn": "quantitative"}[deriv]
    if deriv == "usr":
        c = CALCS[cid_of(name)]
        typ = "quantitative" if c["datatype"] in ("real", "integer") else "nominal"
    suffix = "qk" if typ == "quantitative" else "nk"
    iname = f"[{deriv}:{key}:{suffix}]"
    der = {"none": "None", "usr": "User", "sum": "Sum", "tmn": "Month-Trunc"}[deriv]
    return (f'<column-instance column="{name}" derivation="{der}" name="{iname}" pivot="key" type="{typ}" />', f"[{DS}].{iname}")


def deps(cols, instances, params=()):
    """datasource-dependencies-Blöcke für Hauptquelle und Parameter."""
    defs = "\n".join(col_def(c) for c in cols)
    ins = "\n".join(i[0] for i in instances)
    s = f'<datasource-dependencies datasource="{DS}">\n{defs}\n{ins}\n</datasource-dependencies>'
    if params:
        pdefs = "\n".join(PARAM_DEFS[p] for p in params)
        s += f'\n<datasource-dependencies datasource="Parameters">\n{pdefs}\n</datasource-dependencies>'
    return s


PARAM_DEFS = {
    "Parameter 1": (f'<column caption="Jahr" datatype="string" name="[Parameter 1]" param-domain-type="list" role="measure" type="nominal" value="&quot;{ALLE_JAHRE}&quot;">\n'
                    f'  <calculation class="tableau" formula="&quot;{ALLE_JAHRE}&quot;" />\n</column>'),
    "Parameter 2": (f'<column caption="Hotel" datatype="string" name="[Parameter 2]" param-domain-type="list" role="measure" type="nominal" value="&quot;{ALLE_HOTELS}&quot;">\n'
                    f'  <calculation class="tableau" formula="&quot;{ALLE_HOTELS}&quot;" />\n</column>'),
}
NOBORDER = ('<zone-style><format attr="border-color" value="#000000" /><format attr="border-style" value="none" />'
            '<format attr="border-width" value="0" /><format attr="margin" value="{m}" /></zone-style>')


def titel_xml(aussage, untertitel_runs):
    runs = f'<run bold="true" fontcolor="{TEXT}" fontsize="11">{escape(aussage)}</run>'
    runs += f'<run fontcolor="{TEXT2}" fontsize="9">\n{escape(untertitel_runs[0])}</run>'
    for r in untertitel_runs[1:]:
        runs += f'<run fontcolor="{TEXT2}" fontsize="9">{escape(r)}</run>'
    return f"<layout-options><title><formatted-text>{runs}</formatted-text></title></layout-options>"


def filter_xml(instance_full, instance_short):
    return (f'<filter class="categorical" column="{instance_full}">\n'
            f'  <groupfilter function="member" level="{instance_short}" member="true" />\n</filter>')


WORKSHEETS = []


def ws(name, body):
    WORKSHEETS.append((name, f'<worksheet name="{escape(name)}">\n{body}\n<simple-id uuid="{uid()}" />\n</worksheet>'))


def text_sheet(key):
    k = KPIS[key]
    i_tit, i_txt, i_pos, i_neg, i_hot = inst(k["tit"], "usr"), inst(k["txt"], "usr"), inst(k["pos"], "usr"), inst(k["neg"], "usr"), inst(C_HOTGEW, "none")
    cols = ["[booking_id]", "[hotel]", "[arrival_date]", "[is_canceled]", "[revenue]", "[adr]",
            C_BEZJ, C_VGLZEIT, k["bez"], k["vgl"], k["vor"], k["ver"], k["pos"], k["neg"], k["tit"], k["txt"], C_HOTGEW]
    runs = "".join([
        f'<run fontcolor="{TEXT2}" fontsize="9">&lt;</run><run fontcolor="{TEXT2}" fontsize="9">{i_tit[1]}</run><run fontcolor="{TEXT2}" fontsize="9">&gt;\n</run>',
        f'<run bold="true" fontcolor="{TEXT}" fontsize="20">&lt;</run><run bold="true" fontcolor="{TEXT}" fontsize="20">{i_txt[1]}</run><run bold="true" fontcolor="{TEXT}" fontsize="20">&gt;\n</run>',
        f'<run fontcolor="{AKZENT}" fontsize="9">&lt;</run><run fontcolor="{AKZENT}" fontsize="9">{i_pos[1]}</run><run fontcolor="{AKZENT}" fontsize="9">&gt;</run>',
        f'<run fontcolor="{ROT}" fontsize="9">&lt;</run><run fontcolor="{ROT}" fontsize="9">{i_neg[1]}</run><run fontcolor="{ROT}" fontsize="9">&gt;</run>'])
    body = f"""<table>
  <view>
    <datasources><datasource caption="hotel_buchungen" name="{DS}" /><datasource caption="Parameter" name="Parameters" /></datasources>
    {deps(cols, [i_tit, i_txt, i_pos, i_neg, i_hot], ["Parameter 1", "Parameter 2"])}
    {filter_xml(i_hot[1], i_hot[0].split('name="')[1].split('"')[0])}
    <slices><column>{i_hot[1]}</column></slices>
    <aggregation value="true" />
  </view>
  <style><style-rule element="worksheet"><format attr="display-field-labels" scope="rows" value="false" /></style-rule></style>
  <panes><pane selection-relaxation-option="selection-relaxation-allow">
    <view><breakdown value="auto" /></view>
    <mark class="Text" />
    <encodings><text column="{i_tit[1]}" /><text column="{i_txt[1]}" /><text column="{i_pos[1]}" /><text column="{i_neg[1]}" /></encodings>
    <customized-label><formatted-text>{runs}</formatted-text></customized-label>
    <style><style-rule element="mark"><format attr="mark-labels-show" value="true" /></style-rule></style>
  </pane></panes>
  <rows /><cols />
</table>"""
    ws(f"Text {key}", body)


def kachel_sheet(key, measure):
    i_m, i_jk, i_akt, i_hot = inst(measure, "usr"), inst(C_JKURZ, "none"), inst(C_AKT, "none"), inst(C_HOTGEW, "none")
    cols = ["[booking_id]", "[hotel]", "[arrival_date]", "[is_canceled]", "[revenue]", "[adr]", C_BEZJ, C_JKURZ, C_AKT, measure, C_HOTGEW]
    body = f"""<table>
  <view>
    <datasources><datasource caption="hotel_buchungen" name="{DS}" /><datasource caption="Parameter" name="Parameters" /></datasources>
    {deps(cols, [i_jk, i_akt, i_m, i_hot], ["Parameter 1", "Parameter 2"])}
    {filter_xml(i_hot[1], i_hot[0].split('name="')[1].split('"')[0])}
    <slices><column>{i_hot[1]}</column></slices>
    <aggregation value="true" />
  </view>
  <style>
    <style-rule element="axis"><format attr="display" class="0" field="{i_m[1]}" scope="rows" value="false" /></style-rule>
    <style-rule element="header"><format attr="font-size" value="8" /></style-rule>
    <style-rule element="label"><format attr="text-orientation" field="{i_jk[1]}" value="0" /></style-rule>
    <style-rule element="mark"><encoding attr="color" field="{i_akt[1]}" type="palette">
      <map to="{AKZENT}"><bucket>&quot;aktuell&quot;</bucket></map><map to="{HELL}"><bucket>&quot;früher&quot;</bucket></map></encoding></style-rule>
    <style-rule element="worksheet"><format attr="display-field-labels" scope="cols" value="false" /></style-rule>
    <style-rule element="gridline"><format attr="stroke-size" value="0" /><format attr="line-visibility" scope="rows" value="off" /></style-rule>
  </style>
  <panes><pane selection-relaxation-option="selection-relaxation-allow">
    <view><breakdown value="auto" /></view>
    <mark class="Bar" /><mark-sizing mark-sizing-setting="marks-scaling-off" />
    <encodings><color column="{i_akt[1]}" /></encodings>
    <style><style-rule element="mark"><format attr="mark-labels-show" value="false" /><format attr="size" value="1.6" /></style-rule></style>
  </pane></panes>
  <rows>{i_m[1]}</rows>
  <cols>{i_jk[1]}</cols>
</table>"""
    ws(f"Kachel {key}", body)


def balken_sheet(name, dim, measure, aussage, untertitel, extra_cols=(), top=None, axis_max=None, label_calc=None, exclude=None):
    i_d, i_m, i_f = inst(dim, "none"), inst(measure, "usr"), inst(C_JAHRGEW, "none")
    cols = ["[booking_id]", "[hotel]", "[arrival_date]", "[is_canceled]", "[revenue]", dim, measure, C_JAHRGEW] + list(extra_cols)
    instances = [i_d, i_m, i_f]
    text_enc, label_xml = "", ""
    if label_calc:
        i_l = inst(label_calc, "usr"); cols.append(label_calc); instances.append(i_l)
        text_enc = f'<encodings><text column="{i_l[1]}" /></encodings>'
    cols = list(dict.fromkeys(cols))
    level = i_d[0].split('name="')[1].split('"')[0]
    exf = ""
    if exclude:
        exf = (f'<filter class="categorical" column="{i_d[1]}">\n'
               f'  <groupfilter function="except" user:ui-domain="database" user:ui-enumeration="exclusive" user:ui-marker="enumerate">\n'
               f'    <groupfilter function="level-members" level="{level}" />\n'
               f'    <groupfilter function="member" level="{level}" member="&quot;{exclude}&quot;" />\n'
               f'  </groupfilter>\n</filter>')
    axis = f'<encoding attr="space" class="0" field="{i_m[1]}" field-type="quantitative" max="{axis_max}" min="0.0" range-type="fixed" scope="cols" type="space" />' if axis_max else ""
    topf = ""
    if top:
        topf = (f'<filter class="categorical" column="{i_d[1]}">\n'
                f'  <groupfilter count="{top}" end="top" function="end" units="records" user:ui-marker="end">\n'
                f'    <groupfilter direction="DESC" expression="{escape(CALCS[cid_of(measure)]["formula"], {chr(34): "&quot;"})}" function="order" user:ui-marker="order">\n'
                f'      <groupfilter function="level-members" level="{i_d[0].split(chr(34)+"name="+chr(34))[0] and i_d[0].split("name=" + chr(34))[1].split(chr(34))[0]}" user:ui-marker="level-members" />\n'
                f'    </groupfilter>\n  </groupfilter>\n</filter>')
    body = f"""{titel_xml(aussage, untertitel)}
<table>
  <view>
    <datasources><datasource caption="hotel_buchungen" name="{DS}" /><datasource caption="Parameter" name="Parameters" /></datasources>
    {deps(cols, instances, ["Parameter 1", "Parameter 2"])}
    {filter_xml(i_f[1], i_f[0].split('name="')[1].split('"')[0])}
    {exf}
    {topf}
    <computed-sort column="{i_d[1]}" direction="DESC" using="{i_m[1]}" />
    <slices><column>{i_f[1]}</column>{f'<column>{i_d[1]}</column>' if (top or exclude) else ''}</slices>
    <aggregation value="true" />
  </view>
  <style>
    <style-rule element="axis">{axis}<format attr="display" class="0" field="{i_m[1]}" scope="cols" value="false" /></style-rule>
    <style-rule element="table"><format attr="show-null-value-warning" value="false" /></style-rule>
    <style-rule element="worksheet"><format attr="display-field-labels" scope="rows" value="false" /></style-rule>
    <style-rule element="gridline"><format attr="stroke-size" value="0" /><format attr="line-visibility" scope="cols" value="off" /></style-rule>
  </style>
  <panes><pane selection-relaxation-option="selection-relaxation-allow">
    <view><breakdown value="auto" /></view>
    <mark class="Bar" /><mark-sizing mark-sizing-setting="marks-scaling-off" />
    {text_enc}
    <style><style-rule element="mark"><format attr="mark-color" value="{GRAU}" /><format attr="mark-labels-show" value="true" />
      <format attr="mark-labels-cull" value="true" /><format attr="size" value="1" /></style-rule></style>
  </pane></panes>
  <rows>{i_d[1]}</rows>
  <cols>{i_m[1]}</cols>
</table>"""
    ws(name, body)


def verlauf_sheet():
    i_m, i_s, i_l, i_p, i_f, i_z = inst(C_UMS, "usr"), inst(C_SAISON, "sum"), inst(C_LETZT, "sum"), inst(C_PUNKT, "none"), inst(C_JAHRGEW, "none"), inst(C_ZEITR, "none")
    i_lh, i_ll, i_t = inst(C_LBL_HOCH, "usr"), inst(C_LBL_LETZT, "usr"), inst("[arrival_date]", "tmn")
    cols = ["[booking_id]", "[hotel]", "[arrival_date]", "[is_canceled]", "[revenue]", C_UMS, C_LETZT, C_SAISON, C_PUNKT, C_JAHRGEW, C_ZEITR, C_LBL_HOCH, C_LBL_LETZT]
    runs = (f'<run fontcolor="{TEXT2}" fontsize="8">&lt;</run><run fontcolor="{TEXT2}" fontsize="8">{i_lh[1]}</run><run fontcolor="{TEXT2}" fontsize="8">&gt;</run>'
            f'<run bold="true" fontcolor="{ROT}" fontsize="10">&lt;</run><run bold="true" fontcolor="{ROT}" fontsize="10">{i_ll[1]}</run><run bold="true" fontcolor="{ROT}" fontsize="10">&gt;</run>')
    titel = titel_xml("Jahreshoch jedes Jahr im August, zuletzt 1,97 Mio.",
                      ["Umsatz je Anreisemonat in Euro, ", f"<{i_z[1]}>", ", ", f"<{PH}>"])
    body = f"""{titel}
<table>
  <view>
    <datasources><datasource caption="hotel_buchungen" name="{DS}" /><datasource caption="Parameter" name="Parameters" /></datasources>
    {deps(cols, [i_p, i_f, i_l, i_s, i_t, i_m, i_z, i_lh, i_ll], ["Parameter 1", "Parameter 2"])}
    {filter_xml(i_f[1], i_f[0].split('name="')[1].split('"')[0])}
    <slices><column>{i_f[1]}</column></slices>
    <aggregation value="true" />
  </view>
  <style>
    <style-rule element="axis">
      <encoding attr="space" class="0" field="{i_m[1]}" field-type="quantitative" max="2300000.0" min="0.0" range-type="fixed" scope="rows" type="space" />
      <encoding attr="space" class="0" field="{i_s[1]}" field-type="quantitative" fold="true" max="2300000.0" min="0.0" range-type="fixed" scope="rows" type="space" />
      <format attr="display" class="0" field="{i_s[1]}" scope="rows" value="false" />
      <format attr="display" class="0" field="{i_m[1]}" scope="rows" value="false" />
      <encoding attr="space" class="0" field="{i_t[1]}" field-type="quantitative" max="#2017-08-24 00:00:00#" min="#2015-07-01 00:00:00#" range-type="fixed" scope="cols" type="space" />
      <format attr="title" class="0" field="{i_m[1]}" scope="rows" value="" />
      <format attr="title" class="0" field="{i_t[1]}" scope="cols" value="" />
    </style-rule>
    <style-rule element="mark"><encoding attr="color" field="{i_p[1]}" type="palette">
      <map to="{PUNKT}"><bucket>&quot;Jahreshoch&quot;</bucket></map><map to="{ROT}"><bucket>&quot;letzter Monat&quot;</bucket></map></encoding></style-rule>
    <style-rule element="table"><format attr="show-null-value-warning" value="false" /></style-rule>
    <style-rule element="worksheet"><format attr="display-field-labels" scope="cols" value="false" /></style-rule>
    <style-rule element="table-div"><format attr="line-visibility" scope="rows" value="off" /><format attr="line-visibility" scope="cols" value="off" /></style-rule>
    <style-rule element="axis"><format attr="line-visibility" scope="rows" value="off" /><format attr="line-visibility" scope="cols" value="off" /></style-rule>
    <style-rule element="zeroline"><format attr="stroke-size" value="0" /></style-rule>
    <style-rule element="gridline"><format attr="stroke-size" value="0" /><format attr="line-visibility" scope="rows" value="off" /></style-rule>
  </style>
  <panes>
    <pane selection-relaxation-option="selection-relaxation-allow"><view><breakdown value="auto" /></view><mark class="Automatic" /></pane>
    <pane id="1" selection-relaxation-option="selection-relaxation-allow" y-axis-name="{i_m[1]}">
      <view><breakdown value="auto" /></view><mark class="Line" />
      <encodings><lod column="{i_z[1]}" /></encodings>
      <style><style-rule element="mark"><format attr="mark-labels-show" value="false" /><format attr="mark-labels-cull" value="true" /><format attr="mark-color" value="{AKZENT}" /></style-rule></style>
    </pane>
    <pane id="2" selection-relaxation-option="selection-relaxation-allow" y-axis-name="{i_s[1]}">
      <view><breakdown value="auto" /></view><mark class="Circle" />
      <encodings><color column="{i_p[1]}" /><text column="{i_lh[1]}" /><text column="{i_ll[1]}" /></encodings>
      <customized-label><formatted-text>{runs}</formatted-text></customized-label>
      <style><style-rule element="mark"><format attr="mark-labels-show" value="true" /><format attr="size" value="0.7" /></style-rule></style>
    </pane>
  </panes>
  <rows>({i_m[1]} + {i_s[1]})</rows>
  <cols>{i_t[1]}</cols>
</table>"""
    ws("Umsatzverlauf", body)


# ---------------------------------------------------------------- Blätter anlegen
for key, measure in [("Umsatz", C_UMS), ("Buchungen", C_BUCH), ("Stornoquote", C_STQ), ("ADR", C_ADR)]:
    text_sheet(key)
    kachel_sheet(key, measure)
SUB_TAIL = [", ", f"<{P}>", ", ", f"<{PH}>"]
balken_sheet("Umsatz je Segment", "[market_segment]", C_UMS,
             "Online TA liefert 53 % des Umsatzes, Groups nur 7 %", ["Umsatz in Euro je Marktsegment"] + SUB_TAIL,
             axis_max="18000000.0", exclude="Undefined")
balken_sheet("Storno je Vorlaufzeit", C_VLK, C_STQ,
             "Ab 90 Tagen Vorlauf wird jede zweite Buchung storniert, unter 8 Tagen jede zehnte",
             ["Stornoquote in % je Vorlaufzeit-Klasse"] + SUB_TAIL, extra_cols=["[lead_time]"], axis_max="0.66", label_calc=C_STQ_TXT)
balken_sheet("Umsatz je Land", "[country_name]", C_UMS,
             "Fünf Länder liefern 66 % des Umsatzes, Portugal allein 21 %",
             ["Umsatz in Euro je Herkunftsland, die zwölf größten von 178"] + SUB_TAIL, top=12, axis_max="7200000.0")
verlauf_sheet()

# ---------------------------------------------------------------- Datenquelle
csv_cols_xml = "\n".join(f'<column datatype="{dt}" name="{n}" ordinal="{i}" />' for i, (n, dt, *_r) in enumerate(CSV_COLS))
caption_cols = "\n".join(f'<column caption="{escape(cap)}" datatype="{dt}" name="[{n}]" role="{role}" type="{typ}" />' for n, dt, cap, role, typ in CSV_COLS)
calc_cols = "\n".join(col_def(f"[Calculation_90000000000{cid:05d}]") for cid in sorted(CALCS))
OBJ = "hotel_buchungen.csv_7A1C0E4B2D8F4C3E9B5A6D7E8F9A0B1C"
relation = (f'<relation connection="{CONN}" name="hotel_buchungen.csv" table="[hotel_buchungen#csv]" type="table">\n'
            f'  <columns character-set="UTF-8" header="yes" locale="en_US" separator=",">\n{csv_cols_xml}\n  </columns>\n</relation>')
DATASOURCE = f"""<datasource caption="hotel_buchungen" inline="true" name="{DS}" version="18.1">
  <connection class="federated">
    <named-connections>
      <named-connection caption="hotel_buchungen" name="{CONN}">
        <connection class="textscan" directory="Data/hotel" filename="hotel_buchungen.csv" password="" server="" />
      </named-connection>
    </named-connections>
    {relation}
  </connection>
  <aliases enabled="yes" />
{caption_cols}
{calc_cols}
  <column-instance column="[Calculation_9000000000000012]" derivation="None" name="[none:Calculation_9000000000000012:nk]" pivot="key" type="nominal" />
  <column-instance column="[Calculation_9000000000000062]" derivation="None" name="[none:Calculation_9000000000000062:nk]" pivot="key" type="nominal" />
  <layout dim-ordering="alphabetic" measure-ordering="alphabetic" show-structure="true" />
  <style>
    <style-rule element="mark">
      <encoding attr="color" field="[none:Calculation_9000000000000012:nk]" type="palette">
        <map to="{AKZENT}"><bucket>&quot;aktuell&quot;</bucket></map><map to="{HELL}"><bucket>&quot;früher&quot;</bucket></map>
      </encoding>
      <encoding attr="color" field="[none:Calculation_9000000000000062:nk]" type="palette">
        <map to="{PUNKT}"><bucket>&quot;Jahreshoch&quot;</bucket></map><map to="{ROT}"><bucket>&quot;letzter Monat&quot;</bucket></map>
      </encoding>
    </style-rule>
  </style>
  <date-options start-of-week="monday" />
  <object-graph>
    <objects><object caption="hotel_buchungen.csv" id="{OBJ}"><properties context="">{relation}</properties></object></objects>
  </object-graph>
</datasource>"""

PARAMS = f"""<datasource hasconnection="false" inline="true" name="Parameters" version="18.1">
  <aliases enabled="yes" />
  <column caption="Jahr" datatype="string" name="[Parameter 1]" param-domain-type="list" role="measure" type="nominal" value="&quot;{ALLE_JAHRE}&quot;">
    <calculation class="tableau" formula="&quot;{ALLE_JAHRE}&quot;" />
    <members><member value="&quot;{ALLE_JAHRE}&quot;" /><member value="&quot;2015&quot;" /><member value="&quot;2016&quot;" /><member value="&quot;2017&quot;" /></members>
  </column>
  <column caption="Hotel" datatype="string" name="[Parameter 2]" param-domain-type="list" role="measure" type="nominal" value="&quot;{ALLE_HOTELS}&quot;">
    <calculation class="tableau" formula="&quot;{ALLE_HOTELS}&quot;" />
    <members><member value="&quot;{ALLE_HOTELS}&quot;" /><member value="&quot;City Hotel&quot;" /><member value="&quot;Resort Hotel&quot;" /></members>
  </column>
</datasource>"""

# ---------------------------------------------------------------- Dashboard (Zonen in 1/1000 %)
def zone(name, x, y, w, h, margin=16, show_title=None, zid=None):
    st = f' show-title="{show_title}"' if show_title is not None else ""
    return f'<zone h="{h}" id="{zid or abs(hash(name)) % 900 + 100}" name="{escape(name)}"{st} w="{w}" x="{x}" y="{y}">{NOBORDER.format(m=margin)}</zone>'


def empty(x, y, w, h, zid):
    return f'<zone h="{h}" id="{zid}" type-v2="empty" w="{w}" x="{x}" y="{y}">{NOBORDER.format(m=0)}</zone>'


tiles = ""
zid = 20
for i, key in enumerate(["Umsatz", "Buchungen", "Stornoquote", "ADR"]):
    x0 = 575 + i * 24712
    tiles += zone(f"Text {key}", x0, 7674, 13300, 16181, 10, "false", zid) + zone(f"Kachel {key}", x0 + 13300, 7674, 9600, 16181, 8, "false", zid + 1)
    tiles += empty(x0 + 22900, 7674, 1812, 16181, zid + 2)
    zid += 3

DASHBOARD = f"""<dashboard enable-sort-zone-taborder="true" name="Hotel Dashboard">
  <layout-options><title><formatted-text><run bold="true" fontcolor="{TEXT}" fontsize="16">Hotel Booking Demand 2015–2017: 26,0 Mio. Euro Umsatz, 37 % der Buchungen storniert</run></formatted-text></title></layout-options>
  <style />
  <size maxheight="860" maxwidth="1400" minheight="860" minwidth="1400" sizing-mode="fixed" />
  <datasources><datasource caption="Parameter" name="Parameters" /></datasources>
  <datasource-dependencies datasource="Parameters">
    {PARAM_DEFS["Parameter 1"]}
    {PARAM_DEFS["Parameter 2"]}
  </datasource-dependencies>
  <zones>
    <zone h="100000" id="4" type-v2="layout-basic" w="100000" x="0" y="0">
      <zone h="98140" id="10" param="vert" type-v2="layout-flow" w="98858" x="571" y="930">
        <zone fixed-size="58" h="6744" id="70" is-fixed="true" type-v2="layout-basic" w="98858" x="571" y="930">
          <zone h="3587" id="11" type-v2="title" w="66000" x="571" y="930">{NOBORDER.format(m=4)}</zone>
          <zone h="3157" id="12" type-v2="text" w="66000" x="571" y="4517">
            <formatted-text><run fontcolor="{TEXT2}" fontsize="9">119.390 Buchungen, Anreisen Juli 2015 bis August 2017 · Umsatz in Euro ohne stornierte Buchungen · Quelle: Antonio, de Almeida, Nunes (2019)</run></formatted-text>
            {NOBORDER.format(m=4)}
          </zone>
          <zone h="6744" id="60" mode="compact" param="[Parameters].[Parameter 1]" type-v2="paramctrl" w="14500" x="69929" y="930">{NOBORDER.format(m=4)}</zone>
          <zone h="6744" id="61" mode="compact" param="[Parameters].[Parameter 2]" type-v2="paramctrl" w="14500" x="84929" y="930">{NOBORDER.format(m=4)}</zone>
        </zone>
        <zone h="91396" id="8" type-v2="layout-basic" w="98858" x="571" y="7674">
          <zone h="16181" id="44" type-v2="layout-basic" w="98848" x="575" y="7674">
            {tiles}
          </zone>
          {zone("Umsatz je Segment", 571, 26181, 32762, 24000, 16, None, 5)}
          {zone("Storno je Vorlaufzeit", 571, 50181, 32762, 20500, 16, None, 6)}
          {zone("Umsatzverlauf", 571, 70681, 32762, 28389, 16, None, 3)}
          {zone("Umsatz je Land", 33333, 26181, 66096, 72874, 16, None, 7)}
        </zone>
      </zone>
      {NOBORDER.format(m=8)}
    </zone>
  </zones>
  <simple-id uuid="{uid()}" />
</dashboard>"""

# ---------------------------------------------------------------- Fenster
CARDS = """<cards><edge name="left"><strip size="160"><card type="pages" /><card type="filters" /><card type="marks" /></strip></edge>
<edge name="top"><strip size="2147483647"><card type="columns" /></strip><strip size="2147483647"><card type="rows" /></strip><strip size="31"><card type="title" /></strip></edge></cards>"""
windows = "\n".join(f'<window class="worksheet" name="{escape(n)}">{CARDS}<simple-id uuid="{uid()}" /></window>' for n, _ in WORKSHEETS)
viewpoints = "\n".join(f'<viewpoint name="{escape(n)}"><zoom type="{"entire-view"}" /></viewpoint>' for n, _ in WORKSHEETS)
windows += f'\n<window class="dashboard" maximized="true" name="Hotel Dashboard"><viewpoints>{viewpoints}</viewpoints><active id="-1" /><simple-id uuid="{uid()}" /></window>'

TWB = f"""<?xml version='1.0' encoding='utf-8' ?>
<workbook original-version="18.1" source-build="2026.2.2 (20262.26.0819.2015)" source-platform="mac" version="18.1" xmlns:user="http://www.tableausoftware.com/xml/user">
  <document-format-change-manifest>
    <AccessibleZoneTabOrder /><AnimationOnByDefault /><MarkAnimation /><ObjectModelEncapsulateLegacy /><ObjectModelTableType />
    <SchemaViewerObjectModel /><SetMembershipControl /><SheetIdentifierTracking /><SortTagCleanup /><WindowsPersistSimpleIdentifiers />
  </document-format-change-manifest>
  <preferences><preference name="ui.encoding.shelf.height" value="24" /><preference name="ui.shelf.height" value="26" /></preferences>
  <datasources>
{PARAMS}
{DATASOURCE}
  </datasources>
  <worksheets>
{chr(10).join(b for _, b in WORKSHEETS)}
  </worksheets>
  <dashboards>
{DASHBOARD}
  </dashboards>
  <windows source-height="30">
{windows}
  </windows>
</workbook>
"""
OUT.mkdir(parents=True, exist_ok=True)
(OUT / "Hotel_Dashboard.twb").write_text(TWB, encoding="utf-8")
import xml.etree.ElementTree as E
E.parse(OUT / "Hotel_Dashboard.twb")
print("geschrieben:", OUT / "Hotel_Dashboard.twb", len(TWB), "Zeichen,", len(CALCS), "berechnete Felder,", len(WORKSHEETS), "Blätter")
