// Zahlen- und Datumsformate für das Dashboard (deutsche Schreibweise).
// Alle Diagramme und Kacheln holen ihre Formate hier, damit sie überall gleich sind.

const ZAHL = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const ZAHL_1 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const ZAHL_2 = new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONATE_KURZ = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
const MONATE_LANG = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
  "September", "Oktober", "November", "Dezember"];

// Ganze Zahl mit Tausenderpunkt: 119390 -> "119.390".
function zahl(wert) {
  return wert == null ? "–" : ZAHL.format(wert);
}

// Anteil als Prozent mit einer Nachkommastelle: 0.3704 -> "37,0 %".
function prozent(wert) {
  return wert == null ? "–" : ZAHL_1.format(wert * 100) + " %";
}

// Betrag mit zwei Nachkommastellen: 101.8311 -> "101,83".
function dezimal(wert) {
  return wert == null ? "–" : ZAHL_2.format(wert);
}

// Betrag mit einer Nachkommastelle: 104.01 -> "104,0".
function dezimal1(wert) {
  return wert == null ? "–" : ZAHL_1.format(wert);
}

// Große Beträge kurz: 42723498 -> "42,7 Mio.", 261598 -> "262 Tsd.".
function kurz(wert) {
  if (wert == null) return "–";
  if (Math.abs(wert) >= 1e6) return ZAHL_1.format(wert / 1e6) + " Mio.";
  if (Math.abs(wert) >= 1e4) return ZAHL.format(wert / 1e3) + " Tsd.";
  return ZAHL.format(wert);
}

// Monat aus Jahr und Monatszahl als Datum (erster Tag).
function monatsdatum(jahr, monat) {
  return new Date(jahr, monat - 1, 1);
}

// Datum als "Jul 2015".
function monatstext(datum) {
  return MONATE_KURZ[datum.getMonth()] + " " + datum.getFullYear();
}

// Datum als "2015-07" für die Filter von/bis.
function monatsschluessel(datum) {
  return datum.getFullYear() + "-" + String(datum.getMonth() + 1).padStart(2, "0");
}
