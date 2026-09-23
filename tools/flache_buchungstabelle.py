"""Flache Buchungstabelle für Tableau: das Sternschema zu einer Tabelle verbunden.

Entspricht in SQL (Lab 06) dem Join der Faktentabelle mit den acht Dimensionen:

    SELECT f.booking_id, h.hotel, d.full_date AS arrival_date, s.full_date AS reservation_status_date,
           m.market_segment, c.distribution_channel, k.customer_type, z.deposit_type, v.meal,
           l.country, f.is_canceled::int, f.lead_time, f.total_nights, f.adults, f.children,
           f.adr, f.revenue, f.reservation_status
    FROM fact_bookings f
    JOIN dim_hotel h USING (hotel_id)
    JOIN dim_date d ON d.date_key = f.arrival_date_key
    JOIN dim_date s ON s.date_key = f.reservation_status_date_key
    JOIN dim_market_segment m USING (market_segment_id)
    JOIN dim_distribution_channel c USING (distribution_channel_id)
    JOIN dim_customer_type k USING (customer_type_id)
    JOIN dim_deposit_type z USING (deposit_type_id)
    JOIN dim_meal v USING (meal_id)
    JOIN dim_country l USING (country_id)

Aufruf:  python3 tools/flache_buchungstabelle.py <zielordner>
Schreibt <zielordner>/hotel_buchungen.csv (119.390 Zeilen) mit zusätzlicher Spalte
country_name (deutsche Ländernamen aus dashboard/frontend/laendernamen.js).
"""
import json
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
D = ROOT / "data"
ziel = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "tableau" / "Data"
ziel.mkdir(parents=True, exist_ok=True)

f = pd.read_csv(D / "fact_bookings.csv")
d = pd.read_csv(D / "dim_date.csv")[["date_key", "full_date"]]
f = f.merge(d.rename(columns={"date_key": "arrival_date_key", "full_date": "arrival_date"}), on="arrival_date_key")
f = f.merge(d.rename(columns={"date_key": "reservation_status_date_key", "full_date": "reservation_status_date"}),
            on="reservation_status_date_key")
for tabelle, spalte in [("dim_hotel", "hotel"), ("dim_market_segment", "market_segment"),
                        ("dim_distribution_channel", "distribution_channel"), ("dim_customer_type", "customer_type"),
                        ("dim_deposit_type", "deposit_type"), ("dim_meal", "meal"), ("dim_country", "country")]:
    f = f.merge(pd.read_csv(D / f"{tabelle}.csv"), on=f"{spalte}_id")

js = (ROOT / "dashboard" / "frontend" / "laendernamen.js").read_text(encoding="utf-8")
namen = json.loads(re.search(r"\{.*\}", js, re.S).group(0))
f["country_name"] = f.country.map(namen).fillna(f.country)

spalten = ["booking_id", "hotel", "arrival_date", "reservation_status_date", "market_segment",
           "distribution_channel", "customer_type", "deposit_type", "meal", "country", "country_name",
           "is_canceled", "lead_time", "total_nights", "adults", "children", "adr", "revenue",
           "reservation_status"]
f = f.sort_values("booking_id")[spalten]
f["is_canceled"] = f.is_canceled.astype(int)
f.to_csv(ziel / "hotel_buchungen.csv", index=False)
print(len(f), "Zeilen nach", ziel / "hotel_buchungen.csv")
print(f.head(3).to_string())
