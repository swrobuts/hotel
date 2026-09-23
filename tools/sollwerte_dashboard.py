"""Sollwerte für die Titel des Management-Dashboards (Tableau und Power BI).

Jede Zahl, die in einem Diagrammtitel oder einer Kennzahlkachel steht, wird
hier aus den CSV-Dateien des Sternschemas nachgerechnet. Aufruf aus dem
Repo-Root:  python3 tools/sollwerte_dashboard.py
"""
from pathlib import Path

import pandas as pd

D = Path(__file__).resolve().parent.parent / "data"

f = pd.read_csv(D / "fact_bookings.csv")
d = pd.read_csv(D / "dim_date.csv", parse_dates=["full_date"])
f = f.merge(d[["date_key", "full_date", "year", "month"]], left_on="arrival_date_key", right_on="date_key")
for tabelle, spalte in [("dim_hotel", "hotel"), ("dim_market_segment", "market_segment"),
                        ("dim_country", "country")]:
    f = f.merge(pd.read_csv(D / f"{tabelle}.csv"), on=f"{spalte}_id")
f["umsatz"] = f.revenue.where(f.is_canceled == 0, 0)   # Umsatz = nur nicht stornierte Buchungen


def kennzahlen(x):
    return pd.Series({"Umsatz": x.umsatz.sum(), "Buchungen": len(x),
                      "Stornoquote %": x.is_canceled.mean() * 100, "Ø ADR": x.adr.mean()})


print("Gesamt:", kennzahlen(f).round(2).to_dict())
print("Anreisen von", f.full_date.min().date(), "bis", f.full_date.max().date())

print("\nJe Jahr (2015 ab Juli, 2017 bis August):")
print(f.groupby("year").apply(kennzahlen).round(2))

print("\nVeränderung zum Vorjahr über die Monate, die in beiden Jahren vorliegen:")
for j in (2016, 2017):
    monate = sorted(set(f[f.year == j].month) & set(f[f.year == j - 1].month))
    a = kennzahlen(f[(f.year == j) & f.month.isin(monate)])
    v = kennzahlen(f[(f.year == j - 1) & f.month.isin(monate)])
    print(f"  {j} vs {j-1}, Monate {monate[0]}–{monate[-1]}:",
          {k: f"{(a[k]-v[k])/v[k]*100:+.1f} %" for k in ("Umsatz", "Buchungen", "Ø ADR")},
          f"Stornoquote {a['Stornoquote %']-v['Stornoquote %']:+.1f} Punkte")

print("\nUmsatz je Marktsegment, Anteil in %:")
s = f.groupby("market_segment").umsatz.sum().sort_values(ascending=False)
print((s / s.sum() * 100).round(1).to_dict())
print("Online TA + Offline TA/TO:", round((s["Online TA"] + s["Offline TA/TO"]) / s.sum() * 100, 1), "%")

print("\nStornoquote je Vorlaufzeit-Klasse in %:")
klasse = pd.cut(f.lead_time, [-1, 7, 30, 90, 10_000], labels=["0-7", "8-30", "31-90", "90+"])
print((f.groupby(klasse, observed=True).is_canceled.mean() * 100).round(1).to_dict())

print("\nUmsatz je Herkunftsland, die zwölf größten von", f.country.nunique(), "Ländern:")
c = f.groupby("country").umsatz.sum().sort_values(ascending=False)
anteil = (c / c.sum() * 100).round(1)
print(anteil.head(12).to_dict())
print("Top 5 zusammen:", round(anteil.head(5).sum(), 1), "%  Portugal:", anteil["PRT"], "%")

print("\nUmsatz je Anreisemonat, Jahreshoch je Jahr und letzter Monat:")
m = f.groupby(f.full_date.dt.to_period("M")).umsatz.sum()
for jahr in sorted(set(m.index.year)):
    mm = m[m.index.year == jahr]
    print(f"  {jahr}: Hoch {mm.idxmax()} mit {mm.max():,.0f}".replace(",", "."))
print(f"  letzter Monat {m.index[-1]}: {m.iloc[-1]:,.0f}".replace(",", "."))
