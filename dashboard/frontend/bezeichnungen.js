// Klarnamen für die englischen Kürzel des Datensatzes. Die Werte selbst bleiben
// unverändert (Filter und SQL arbeiten damit), nur die Anzeige übersetzt.

const BEZEICHNUNGEN = {
  segment: {
    "Online TA": "Reisebüro online", "Offline TA/TO": "Reisebüro offline", "Groups": "Gruppen",
    "Direct": "Direktbuchung", "Corporate": "Firmenkunden", "Complementary": "Kostenfreie Buchung", "Aviation": "Luftfahrt (Crews)",
    "Undefined": "Nicht angegeben",
  },
  kanal: { "TA/TO": "Reisebüro / Veranstalter", "Direct": "Direktvertrieb", "Corporate": "Firmenkunden", "GDS": "Buchungssystem (GDS)", "Undefined": "Nicht angegeben" },
  kundentyp: { "Transient": "Einzelreisende", "Transient-Party": "Einzelreisende in Gruppe", "Contract": "Vertragskunden", "Group": "Reisegruppe" },
  kaution: { "No Deposit": "Ohne Anzahlung", "Non Refund": "Nicht erstattbar", "Refundable": "Erstattbar" },
  vorlaufzeit: { "0-7": "0–7 Tage", "8-30": "8–30 Tage", "31-90": "31–90 Tage", "90+": "über 90 Tage" },
  hotel: { "City Hotel": "City Hotel", "Resort Hotel": "Resort Hotel" },
};

// Klarname zu einem Wert einer Dimension; unbekannte Werte bleiben, wie sie sind.
function klarname(dimension, wert) {
  if (dimension === "land") return LAENDERNAMEN[wert] || wert;
  return (BEZEICHNUNGEN[dimension] || {})[wert] || wert;
}
