// Hotel Booking Demand – Dashboard.
//
// Ablauf: Der Filterzustand steht in `zustand.filter` und in der Adresszeile.
// Bei jeder Änderung lädt `allesLaden` die Routen des Backends parallel,
// `kontextBilden` bereitet die Daten auf, `allesZeichnen` baut Texte, Kacheln,
// Diagramme und Tabellen neu. Ein Klick in ein Diagramm ändert nur den
// Filterzustand; alles andere folgt daraus.

const FILTER_NAMEN = ["hotel", "jahr", "von", "bis", "segment", "kanal", "kundentyp", "kaution", "land", "vorlaufzeit"];
const FILTER_TITEL = { hotel: "Hotel", jahr: "Anreisejahr", segment: "Marktsegment", kanal: "Vertriebskanal",
  kundentyp: "Kundentyp", kaution: "Kautionstyp", land: "Land", vorlaufzeit: "Vorlaufzeit" };
const ZEITFILTER = ["jahr", "von", "bis"];
// Routen, die mit allen Filtern geladen werden
const ROUTEN = ["kennzahlen", "segmente", "kanaele", "kautionen", "vorlaufzeit", "segment_kundentyp", "laender", "laender_hotel"];

// Die zehn Kennzahlen des Katalogs: Feldname, Titel, Formate und Wirkung auf das Ergebnis
// ("hoeherBesser": true = mehr ist gut, false = weniger ist gut, null = ohne Wertung).
// Die Wirkung bestimmt die Farbe wie in DeltaMaster: blau für Umsatz und alles, was das
// Ergebnis verbessert, rot für alles, was zu seinen Lasten geht (Stornierungen), grau ohne Wertung.
const KPIS = [
  { feld: "erloes_nicht_storniert", titel: "Stornobereinigter Umsatz in €", format: zahl, kachel: kurz, hoeherBesser: true },
  { feld: "gesamterloes", titel: "Gebuchter Umsatz in €", format: zahl, kachel: kurz, hoeherBesser: true },
  { feld: "anzahl_buchungen", titel: "Anzahl Buchungen", format: zahl, kachel: zahl, hoeherBesser: true },
  { feld: "stornoquote", titel: "Stornoquote", format: prozent, kachel: prozent, hoeherBesser: false },
  { feld: "adr", titel: "Ø Zimmerpreis (ADR) in €", format: dezimal, kachel: dezimal, hoeherBesser: true },
  { feld: "aufenthaltsdauer", titel: "Ø Aufenthalt in Nächten", format: dezimal, kachel: dezimal, hoeherBesser: true },
  { feld: "vorlaufzeit", titel: "Ø Vorlaufzeit in Tagen", format: dezimal1, kachel: dezimal1, hoeherBesser: null },
  { feld: "zimmernaechte", titel: "Gebuchte Zimmernächte", format: zahl, kachel: zahl, hoeherBesser: true },
  { feld: "wiederholungsgaeste", titel: "Wiederholungsgast-Anteil", format: prozent, kachel: prozent, hoeherBesser: true },
  { feld: "sonderwuensche", titel: "Anteil mit Sonderwünschen", format: prozent, kachel: prozent, hoeherBesser: null },
];
const KACHEL_KPIS = KPIS.slice(0, 6);

const zustand = {
  filter: {}, daten: {},
  sortierung: { laender: { feld: "anzahl", absteigend: true }, pivot: { feld: "gesamt", absteigend: true }, kennzahlen: { feld: "reihenfolge", absteigend: false } },
  gruppierung: { laender: "", pivot: "" },
};

// ---------------------------------------------------------------------------
// Filterzustand und Adresse
// ---------------------------------------------------------------------------

// Liest die Filter aus der Adresszeile, z. B. ?hotel=City%20Hotel&jahr=2016.
function filterAusAdresse() {
  const parameter = new URLSearchParams(location.search);
  const filter = {};
  for (const name of FILTER_NAMEN) if (parameter.get(name)) filter[name] = parameter.get(name);
  return filter;
}

// Schreibt die Filter in die Adresszeile, damit der Stand als Link teilbar ist.
function filterInAdresse() {
  const parameter = new URLSearchParams();
  for (const name of FILTER_NAMEN) if (zustand.filter[name]) parameter.set(name, zustand.filter[name]);
  history.replaceState(null, "", parameter.toString() ? "?" + parameter.toString() : location.pathname);
}

// Setzt einen Filter; derselbe Wert ein zweites Mal hebt ihn wieder auf (Umschalten per Klick).
function filterSetzen(name, wert) {
  if (zustand.filter[name] === wert || wert === "" || wert == null) delete zustand.filter[name];
  else zustand.filter[name] = wert;
  filterInAdresse();
  allesLaden();
}

// Ein Klick auf einen Monat grenzt den Zeitraum auf genau diesen Monat ein; ein zweiter hebt das auf.
function monatSetzen(datum) {
  const schluessel = monatsschluessel(datum);
  if (zustand.filter.von === schluessel && zustand.filter.bis === schluessel) { delete zustand.filter.von; delete zustand.filter.bis; }
  else { zustand.filter.von = schluessel; zustand.filter.bis = schluessel; }
  filterInAdresse();
  allesLaden();
}

// Alle Filter löschen.
function filterZuruecksetzen() {
  zustand.filter = {};
  filterInAdresse();
  allesLaden();
}

// Der Filter ohne bestimmte Namen (z. B. ohne Zeitfilter, um den ganzen Verlauf zu laden).
function filterOhne(namen) {
  const rest = {};
  for (const [name, wert] of Object.entries(zustand.filter)) if (!namen.includes(name)) rest[name] = wert;
  return rest;
}

// Liegt der Monat im Zeitfilter? Ohne Zeitfilter gilt jeder Monat.
function imZeitfilter(datum) {
  const f = zustand.filter, schluessel = monatsschluessel(datum);
  if (f.jahr && datum.getUTCFullYear() !== Number(f.jahr)) return false;
  if (f.von && schluessel < f.von) return false;
  if (f.bis && schluessel > f.bis) return false;
  return true;
}

// Der Zeitraum als Text für Beschreibungen, aus den Filtern oder dem ganzen Datensatz.
function zeitraumText() {
  const f = zustand.filter;
  const monat = (s) => { const [j, m] = s.split("-").map(Number); return MONATE_LANG[m - 1] + " " + j; };
  if (f.von && f.bis && f.von === f.bis) return "Anreisemonat " + monat(f.von);
  if (f.von || f.bis) return "Anreisen " + (f.von ? monat(f.von) : "Juli 2015") + " bis " + (f.bis ? monat(f.bis) : "August 2017");
  if (f.jahr) return "Anreisejahr " + f.jahr + (f.jahr === "2015" ? " (ab Juli)" : f.jahr === "2017" ? " (bis August)" : "");
  return "Anreisen Juli 2015 bis August 2017";
}

// Die übrigen aktiven Filter als Text für Beschreibungen.
function filterText() {
  return FILTER_NAMEN.filter((n) => zustand.filter[n] && !ZEITFILTER.includes(n))
    .map((n) => FILTER_TITEL[n] + " " + klarname(n, zustand.filter[n])).join(", ");
}

// ---------------------------------------------------------------------------
// Daten laden
// ---------------------------------------------------------------------------

// Holt eine Route mit Filtern als Parametern.
async function holen(route, filter = zustand.filter) {
  const parameter = new URLSearchParams(filter);
  const antwort = await fetch("/api/" + route + (parameter.toString() ? "?" + parameter : ""));
  if (!antwort.ok) throw new Error(route + ": " + antwort.status);
  return antwort.json();
}

// Lädt alle Routen parallel und zeichnet danach alles neu. Zwei Routen bekommen
// weniger Filter: der Monatsverlauf ohne Zeitfilter (für Vormonat und Vorjahr),
// der Hotelvergleich ohne Hotelfilter (beide Hotels nebeneinander).
async function allesLaden() {
  document.body.classList.add("laedt");
  try {
    const antworten = await Promise.all([
      ...ROUTEN.map((route) => holen(route)),
      holen("monate", filterOhne(ZEITFILTER)),
      holen("hotels", filterOhne(["hotel"])),
    ]);
    ROUTEN.forEach((route, i) => (zustand.daten[route] = antworten[i]));
    zustand.daten.monate = antworten[ROUTEN.length];
    zustand.daten.hotels_beide = antworten[ROUTEN.length + 1];
    allesZeichnen();
    document.getElementById("fehler").hidden = true;
  } catch (fehler) {
    const kasten = document.getElementById("fehler");
    kasten.textContent = "Daten konnten nicht geladen werden (" + fehler.message + "). Bitte neu laden.";
    kasten.hidden = false;
    console.error(fehler);
  } finally {
    document.body.classList.remove("laedt");
  }
}

// Einmalig beim Start: die Auswahllisten der Filterleiste.
async function startdatenLaden() {
  const filterwerte = await holen("filterwerte", {});
  filterleisteFuellen(filterwerte.daten);
}

// ---------------------------------------------------------------------------
// Filterleiste und Chips
// ---------------------------------------------------------------------------

// Füllt die Auswahllisten mit Klarnamen und Anzahl Buchungen; der Wert bleibt das Kürzel der Datenbank.
function filterleisteFuellen(zeilen) {
  for (const name of ["hotel", "jahr", "segment", "kanal", "kundentyp", "kaution", "land", "vorlaufzeit"]) {
    const auswahl = document.querySelector(`select[name=${name}]`);
    let werte = name === "vorlaufzeit"
      ? ["0-7", "8-30", "31-90", "90+"].map((w) => [w, klarname("vorlaufzeit", w)])
      : zeilen.filter((z) => z.filter === name).map((z) => [z.wert, klarname(name, z.wert) + " (" + zahl(z.anzahl) + ")"]);
    if (name === "jahr") werte.sort((a, b) => a[0].localeCompare(b[0]));
    if (name === "land") werte = werte.slice(0, 40); // die 40 größten Länder; die übrigen sind per Klick in der Tabelle erreichbar
    for (const [wert, text] of werte) auswahl.add(new Option(text, wert));
  }
  filterleisteAktualisieren();
}

// Stellt die Felder auf den Filterzustand ein und aktualisiert Chips und Zusammenfassung.
function filterleisteAktualisieren() {
  for (const name of FILTER_NAMEN) {
    const feld = document.querySelector(`[name=${name}]`);
    if (feld) feld.value = zustand.filter[name] || "";
  }
  const aktive = FILTER_NAMEN.filter((name) => zustand.filter[name]);
  document.getElementById("filter-zusammenfassung").textContent = aktive.length ? `Filter (${aktive.length} aktiv)` : "Filter";
  chipsZeichnen(aktive);
}

// Zeigt jeden aktiven Filter als Chip; Klick auf den Chip entfernt ihn.
function chipsZeichnen(aktive) {
  const kasten = document.getElementById("chips");
  kasten.replaceChildren();
  if (!aktive.length) return;
  for (const name of aktive) {
    if (name === "bis" && zustand.filter.von === zustand.filter.bis) continue; // ein Chip für einen einzelnen Monat
    const chip = document.createElement("button");
    chip.className = "chip"; chip.type = "button"; chip.title = "Filter entfernen";
    chip.innerHTML = `<span>${chipText(name)}</span><span aria-hidden="true">×</span>`;
    chip.addEventListener("click", () => {
      if (name === "von" && zustand.filter.von === zustand.filter.bis) delete zustand.filter.bis;
      filterSetzen(name, zustand.filter[name]);
    });
    kasten.append(chip);
  }
  const reset = document.createElement("button");
  reset.id = "zuruecksetzen"; reset.type = "button"; reset.textContent = "Alle Filter zurücksetzen";
  reset.addEventListener("click", filterZuruecksetzen);
  kasten.append(reset);
}

// Beschriftung eines Chips; Monate lesbar, ein einzelner Monat als "Monat: Dez 2015".
function chipText(name) {
  const wert = zustand.filter[name];
  if (name === "von" || name === "bis") {
    const [jahr, monat] = wert.split("-").map(Number);
    const text = monatstext(monatsdatum(jahr, monat));
    if (name === "von" && zustand.filter.von === zustand.filter.bis) return "Monat: " + text;
    return (name === "von" ? "ab " : "bis ") + text;
  }
  return FILTER_TITEL[name] + ": " + klarname(name, wert);
}

// ---------------------------------------------------------------------------
// Daten aufbereiten
// ---------------------------------------------------------------------------

// Bildet aus summierten Rohwerten die zehn Kennzahlen (Quoten und Mittelwerte aus Summen).
function kennzahlenAus(summen) {
  const n = summen.anzahl || 0;
  return {
    anzahl_buchungen: n,
    stornoquote: n ? summen.stornierungen / n : null,
    vorlaufzeit: n ? summen.vorlaufzeit_summe / n : null,
    aufenthaltsdauer: n ? summen.naechte / n : null,
    zimmernaechte: summen.naechte,
    adr: n ? summen.adr_summe / n : null,
    gesamterloes: summen.erloes,
    erloes_nicht_storniert: summen.erloes_nicht_storniert,
    erloes_storniert: (summen.erloes || 0) - (summen.erloes_nicht_storniert || 0),
    wiederholungsgaeste: n ? summen.wiederholungsgaeste / n : null,
    sonderwuensche: n ? summen.sonderwuensche / n : null,
  };
}

// Summiert Rohwertzeilen (Spalten des KENNZAHLEN-Blocks) zu einer Zeile.
function summieren(zeilen) {
  const felder = ["anzahl", "stornierungen", "adr_summe", "erloes", "erloes_nicht_storniert", "naechte", "vorlaufzeit_summe", "wiederholungsgaeste", "sonderwuensche"];
  return Object.fromEntries(felder.map((f) => [f, d3.sum(zeilen, (z) => z[f])]));
}

// Fasst Monatszeilen (je Hotel) zu einer Zeile je Monat zusammen, über den ganzen Datensatz;
// markiert, ob der Monat im Zeitfilter liegt.
function monateVerdichten(zeilen) {
  return d3.groups(zeilen, (z) => z.jahr * 100 + z.monat).map(([, gruppe]) => {
    const datum = monatsdatum(gruppe[0].jahr, gruppe[0].monat);
    return { datum, jahr: gruppe[0].jahr, monat: gruppe[0].monat, imFilter: imZeitfilter(datum), ...kennzahlenAus(summieren(gruppe)) };
  }).sort((a, b) => a.datum - b.datum);
}

// Zeitreihe einer Kennzahl mit Vormonat, Vorjahresmonat und relativen Abweichungen.
function reihe(monate, feld) {
  const nachSchluessel = new Map(monate.map((m) => [m.jahr * 100 + m.monat, m[feld]]));
  return monate.map((m) => {
    const vormonat = nachSchluessel.get(m.monat === 1 ? (m.jahr - 1) * 100 + 12 : m.jahr * 100 + m.monat - 1) ?? null;
    const vorjahr = nachSchluessel.get((m.jahr - 1) * 100 + m.monat) ?? null;
    const wert = m[feld];
    return { datum: m.datum, jahr: m.jahr, monat: m.monat, imFilter: m.imFilter, wert, vormonat, vorjahr,
      dVormonat: vormonat ? wert / vormonat - 1 : null, dVorjahr: vorjahr ? wert / vorjahr - 1 : null, bezug: m.bezug };
  });
}

// Baut den Datenkontext, aus dem Texte, Kacheln und Diagramme entstehen.
function kontextBilden() {
  const D = zustand.daten;
  const monatszeilen = D.monate.daten.filter((z) => !zustand.filter.hotel || z.hotel === zustand.filter.hotel);
  const monate = monateVerdichten(monatszeilen);
  const monateImFilter = monate.filter((m) => m.imFilter);
  const bezug = monateImFilter.at(-1) || monate.at(-1);
  if (bezug) bezug.bezug = true;
  const hotels = D.hotels_beide.daten;
  const hotelvergleich = Object.fromEntries(hotels.map((z) => [z.hotel.replace(" Hotel", ""), kennzahlenAus(z)]));
  hotelvergleich.beide = kennzahlenAus(summieren(hotels));
  const pivot = D.segment_kundentyp.daten;
  const jeKundentyp = d3.rollups(pivot, (g) => d3.sum(g, (z) => z.anzahl), (z) => z.kundentyp).map(([kundentyp, anzahl]) => ({ kundentyp, anzahl }));
  const laender = D.laender.daten;
  const ausland = laender.filter((z) => z.land !== "PRT");
  return {
    kennzahlen: D.kennzahlen.daten[0], monate, monateImFilter, bezug,
    hotels, hotelvergleich, segmente: D.segmente.daten, kanaele: D.kanaele.daten, kautionen: D.kautionen.daten,
    vorlauf: D.vorlaufzeit.daten, pivot, pivotTop: jeKundentyp.length ? d3.greatest(jeKundentyp, (z) => z.anzahl) : null,
    laender, laenderHotel: D.laender_hotel.daten,
    stornoAusland: d3.sum(ausland, (z) => z.stornierungen) / (d3.sum(ausland, (z) => z.anzahl) || 1),
    zeitraumText: zeitraumText(), filterText: filterText(), gefiltert: Object.keys(zustand.filter).length > 0,
  };
}

// ---------------------------------------------------------------------------
// Zeichnen
// ---------------------------------------------------------------------------

// Baut Texte, Kacheln, Diagramme und Tabellen aus den geladenen Daten neu.
function allesZeichnen() {
  filterleisteAktualisieren();
  const d = kontextBilden();
  const A = aussagen(d), T = deutungen(d);
  document.getElementById("lead-ueberblick").textContent = leadUeberblick(d);
  document.getElementById("lead-zeit").textContent = leadZeit(d);
  document.getElementById("lead-vertrieb").textContent = leadVertrieb(d);
  document.getElementById("lead-storno").textContent = leadStorno(d);
  document.getElementById("lead-herkunft").textContent = leadHerkunft(d);
  for (const [id, [aussage, beschreibung]] of Object.entries(A)) {
    const figur = document.getElementById("fig-" + id);
    figur.querySelector(".aussage").textContent = aussage;
    figur.querySelector(".beschreibung").textContent = beschreibung;
    const [interpretation, empfehlung] = T[id];
    figur.querySelector(".deutung-text").innerHTML = `<h4>Interpretation</h4><p>${interpretation}</p><h4>Handlungsempfehlung</h4><p>${empfehlung}</p>`;
  }
  kachelnZeichnen(d);
  kennzahlentabelleZeichnen(d);
  zeitverlaufZeichnen(d);
  vertriebZeichnen(d);
  stornoZeichnen(d);
  erloesverlustZeichnen(d);
  herkunftZeichnen(d);
  sqlAnzeigen();
}

// Eine Abweichung als Text mit Signalfarbe: blau = betriebswirtschaftlich besser, rot = schlechter.
function abweichungHtml(beschriftung, anteil, hoeherBesser) {
  const klasse = anteil == null || !isFinite(anteil) || anteil === 0 || hoeherBesser == null ? "wert-neutral"
    : (hoeherBesser ? anteil > 0 : anteil < 0) ? "wert-besser" : "wert-schlechter";
  return `<span class="abweichung">${beschriftung} <span class="${klasse}">${abweichungText(anteil)}</span></span>`;
}

// Sechs Kennzahlen als Kacheln: Wert, Mini-Säulen über alle Monate (gleiche Zeitachse),
// Abweichung des Bezugsmonats zum Vormonat und zum Vorjahresmonat mit Signal.
function kachelnZeichnen(d) {
  const k = d.kennzahlen, kasten = document.getElementById("kacheln");
  kasten.replaceChildren();
  for (const kpi of KACHEL_KPIS) {
    const r = reihe(d.monate, kpi.feld);
    const b = r.find((z) => z.bezug);
    const kachel = document.createElement("div");
    kachel.className = "kachel";
    kachel.innerHTML = `<div class="kachel-titel">${kpi.titel}</div><div class="kachel-wert">${k.anzahl_buchungen ? kpi.kachel(k[kpi.feld]) : "–"}</div>`
      + `<div class="kachel-vergleich">${d.zeitraumText.replace("Anreisen ", "").replace("Anreisejahr ", "").replace("Anreisemonat ", "")}</div>`
      + `<div class="kachel-verlauf"></div>`
      + (b ? abweichungHtml("Vormonat", b.dVormonat, kpi.hoeherBesser) + abweichungHtml("Vorjahresmonat", b.dVorjahr, kpi.hoeherBesser) : "");
    if (r.length > 1) kachel.querySelector(".kachel-verlauf").append(minisaeulen(r, { breite: 200, hoehe: 36, format: kpi.format, hoeherBesser: kpi.hoeherBesser }));
    kasten.append(kachel);
  }
  const b = d.bezug;
  document.getElementById("kacheln-hinweis").textContent = b
    ? `Mini-Säulen ab null mit gleicher Zeitachse (Juli 2015 bis August 2017); hell = außerhalb des Zeitfilters, gesättigt = Bezugsmonat. Farben wie in DeltaMaster: blau = mehr ist gut für das Ergebnis, rot = mehr geht zu seinen Lasten, grau = ohne Wertung; das gilt für die Säulen wie für die Abweichungen (${MONATE_LANG[b.monat - 1]} ${b.jahr} gegenüber Vormonat und Vorjahresmonat).`
    : "";
}

// Grafische Tabelle aller zehn Kennzahlen: je Hotel, beide Hotels, Verlauf als Mini-Säulen,
// Abweichung des Bezugsmonats zum Vormonat und Vorjahresmonat, Minimum und Maximum.
function kennzahlentabelleZeichnen(d) {
  const hv = d.hotelvergleich, hotels = d.hotels.map((z) => z.hotel);
  const zeilen = KPIS.map((kpi, i) => {
    const r = reihe(d.monate, kpi.feld), b = r.find((z) => z.bezug);
    const imFilter = r.filter((z) => z.imFilter).map((z) => z.wert);
    const zeile = { reihenfolge: i, kpi, kennzahl: kpi.titel, verlauf: r,
      dVormonat: b?.dVormonat ?? null, dVorjahr: b?.dVorjahr ?? null,
      minimum: imFilter.length ? d3.min(imFilter) : null, maximum: imFilter.length ? d3.max(imFilter) : null, beide: hv.beide[kpi.feld] };
    for (const hotel of hotels) zeile[hotel] = hv[hotel.replace(" Hotel", "")]?.[kpi.feld] ?? null;
    return zeile;
  });
  const hotelSpalte = (hotel) => ({ feld: hotel, titel: hotel, numerisch: true, format: (w, z) => z.kpi.format(w) });
  const spalten = [
    { feld: "kennzahl", titel: "Kennzahl", format: (w) => w },
    ...hotels.map(hotelSpalte),
    { feld: "beide", titel: "beide Hotels", numerisch: true, format: (w, z) => z.kpi.format(w) },
    { feld: "verlauf", titel: "Verlauf je Monat", format: () => "", zeichnen: (z) => (z.verlauf.length > 1 ? minisaeulen(z.verlauf, { breite: 160, hoehe: 30, format: z.kpi.format, hoeherBesser: z.kpi.hoeherBesser }) : null) },
    { feld: "dVormonat", titel: "vs. Vormonat", numerisch: true, format: (w, z) => abweichungHtml("", w, z.kpi.hoeherBesser) },
    { feld: "dVorjahr", titel: "vs. Vorjahresmonat", numerisch: true, format: (w, z) => abweichungHtml("", w, z.kpi.hoeherBesser) },
    { feld: "minimum", titel: "Minimum", numerisch: true, format: (w, z) => z.kpi.format(w) },
    { feld: "maximum", titel: "Maximum", numerisch: true, format: (w, z) => z.kpi.format(w) },
  ];
  tabelleBauen(document.getElementById("tabelle-kennzahlen"), spalten, zeilen, {
    sortierung: zustand.sortierung.kennzahlen, gruppierung: null,
    beiSortierung: (s) => { zustand.sortierung.kennzahlen = s; kennzahlentabelleZeichnen(d); },
  });
}

// Tooltip-Text einer Monatssäule: Wert, Abweichung zum Vormonat und zum Vorjahresmonat.
function saeulenTipp(titel, format) {
  return (z) => `${monatstext(z.datum)}\n${titel}: ${format(z.wert)}\nVormonat ${z.vormonat != null ? format(z.vormonat) : "–"}: ${abweichungText(z.dVormonat)}\nVorjahresmonat ${z.vorjahr != null ? format(z.vorjahr) : "–"}: ${abweichungText(z.dVorjahr)}`;
}

// Drei Säulendiagramme untereinander mit einer Zeitachse: Buchungen, Umsatz, Stornoquote;
// Versatzstück zum Vorjahresmonat blau, wenn besser, rot, wenn schlechter.
function zeitverlaufZeichnen(d) {
  const felder = [["zeit-buchungen", "Anzahl Buchungen", "anzahl_buchungen", zahl, true, false],
    ["zeit-erloes", "Stornobereinigter Umsatz in EUR", "erloes_nicht_storniert", kurz, true, false],
    ["zeit-storno", "Stornoquote", "stornoquote", prozent0, false, true]];
  if (d.monate.length < 2) { for (const [id] of felder) document.getElementById(id).replaceChildren(); return; }
  for (const [id, titel, feld, format, hoeherBesser] of felder) {
    const r = reihe(d.monate, feld);
    const kasten = document.getElementById(id);
    const ueberschrift = document.createElement("h4"); ueberschrift.textContent = titel;
    kasten.replaceChildren(ueberschrift, saeulen(kasten, r, { format, hoeherBesser, hoehe: 230, klickMonat: monatSetzen, tipp: saeulenTipp(titel, format === prozent0 ? prozent : format) }));
  }
}

// Tooltip einer Dimensionszeile: Buchungen, Anteil, Stornoquote, Tagesrate.
function dimensionTipp(dimension, kategorie, gesamt) {
  return (z) => `${klarname(dimension, z[kategorie])}\n${zahl(z.anzahl)} Buchungen (${prozent(z.anzahl / gesamt)})\nStornoquote ${prozent(z.stornoquote)}\nØ Zimmerpreis ${dezimal(z.adr)} EUR\nUmsatz ${kurz(z.erloes_nicht_storniert)} EUR`;
}

// Vertrieb: je Marktsegment und je Vertriebskanal der Anteil an den Buchungen neben dem
// Anteil am Umsatz (gleiche Skala), dann die Tabelle Marktsegment × Kundentyp.
function vertriebZeichnen(d) {
  const paar = (id, daten, kategorie, dimension) => {
    const gesamtAnzahl = d3.sum(daten, (z) => z.anzahl), gesamtUmsatz = d3.sum(daten, (z) => z.erloes_nicht_storniert);
    const zeilen = daten.map((z) => ({ ...z, anteil1: z.anzahl / gesamtAnzahl, absolut1: z.anzahl, anteil2: z.erloes_nicht_storniert / gesamtUmsatz, absolut2: z.erloes_nicht_storniert }));
    const tipp = (z) => `${klarname(dimension, z[kategorie])}\n${zahl(z.anzahl)} Buchungen (${prozent(z.anteil1)})\n${kurz(z.erloes_nicht_storniert)} EUR Umsatz (${prozent(z.anteil2)})\nØ Zimmerpreis ${dezimal(z.adr)} EUR · Stornoquote ${prozent(z.stornoquote)}`;
    zeichnen(id, (el) => balkenPaar(el, zeilen, { kategorie, titel1: "Anteil an den Buchungen", titel2: "Anteil am Umsatz", format1: zahl, format2: kurz,
      klarname: (w) => klarname(dimension, w), aktiv: zustand.filter[dimension], beiKlick: (z) => filterSetzen(dimension, z[kategorie]), tipp }));
  };
  paar("balken-segment", d.segmente, "segment", "segment");
  paar("balken-kanal", d.kanaele, "kanal", "kanal");
  pivotZeichnen(d);
}

// Tabelle Marktsegment × Kundentyp mit Datenbalken je Spalte; gruppierbar nach Hotel.
function pivotZeichnen(d) {
  const kundentypen = [...new Set(d.pivot.map((z) => z.kundentyp))].sort();
  const gruppierung = zustand.gruppierung.pivot;
  const schluessel = (z) => (gruppierung ? z.hotel + "|" : "") + z.segment;
  const zeilen = d3.groups(d.pivot, schluessel).map(([, gruppe]) => {
    const zeile = { segment: gruppe[0].segment, hotel: gruppe[0].hotel, gesamt: d3.sum(gruppe, (z) => z.anzahl) };
    for (const typ of kundentypen) zeile[typ] = d3.sum(gruppe.filter((z) => z.kundentyp === typ), (z) => z.anzahl) || null;
    return zeile;
  });
  const spalten = [
    ...(gruppierung ? [{ feld: "hotel", titel: "Hotel", format: (w) => w, aggregat: (g) => g[0].hotel }] : []),
    { feld: "segment", titel: "Marktsegment", format: (w) => klarname("segment", w), aggregat: () => "alle Segmente" },
    ...kundentypen.map((typ) => ({ feld: typ, titel: klarname("kundentyp", typ), format: zahl, numerisch: true, balken: true, aggregat: summe(typ) })),
    { feld: "gesamt", titel: "Gesamt", format: zahl, numerisch: true, aggregat: summe("gesamt") },
  ];
  tabelleBauen(document.getElementById("tabelle-pivot"), spalten, zeilen, {
    sortierung: zustand.sortierung.pivot, gruppierung: gruppierung || null,
    aktiv: (z) => z.segment === zustand.filter.segment, beiKlick: (z) => filterSetzen("segment", z.segment),
    beiSortierung: (s) => { zustand.sortierung.pivot = s; pivotZeichnen(d); },
  });
}

// Stornoquoten untereinander auf einer gemeinsamen Skala 0–100 %, Referenzlinie "insgesamt".
function stornoZeichnen(d) {
  const referenz = d.kennzahlen.stornoquote;
  const tipp = (dimension, kategorie) => (z) => `${klarname(dimension, z[kategorie])}\nStornoquote ${prozent(z.stornoquote)} (${zahl(z.stornierungen)} von ${zahl(z.anzahl)} Buchungen)\n`
    + `${dezimal1(Math.abs(z.stornoquote - referenz) * 100)} Prozentpunkte ${z.stornoquote >= referenz ? "über" : "unter"} der Quote insgesamt`;
  const gemeinsam = { wert: "stornoquote", format: prozent0, farbe: kennzahlFarbe(false, STUFE.wert), domain: [0, 1.15], referenz };
  zeichnen("storno-hotel", (el) => balken(el, d.hotels, { ...gemeinsam, kategorie: "hotel", klarname: (w) => klarname("hotel", w), aktiv: zustand.filter.hotel, beiKlick: (z) => filterSetzen("hotel", z.hotel), tipp: tipp("hotel", "hotel") }));
  zeichnen("storno-kaution", (el) => balken(el, d.kautionen, { ...gemeinsam, kategorie: "kaution", klarname: (w) => klarname("kaution", w), aktiv: zustand.filter.kaution, beiKlick: (z) => filterSetzen("kaution", z.kaution), tipp: tipp("kaution", "kaution") }));
  zeichnen("storno-segment", (el) => balken(el, d.segmente, { ...gemeinsam, kategorie: "segment", klarname: (w) => klarname("segment", w), aktiv: zustand.filter.segment, beiKlick: (z) => filterSetzen("segment", z.segment), tipp: tipp("segment", "segment") }));
  zeichnen("storno-vorlaufzeit", (el) => balken(el, d.vorlauf, { ...gemeinsam, kategorie: "vorlaufzeit", klarname: (w) => klarname("vorlaufzeit", w), sortieren: false, aktiv: zustand.filter.vorlaufzeit, beiKlick: (z) => filterSetzen("vorlaufzeit", z.vorlaufzeit), tipp: tipp("vorlaufzeit", "vorlaufzeit") }));
}

// Umsatz und durch Stornierung entgangener Umsatz je Anreisemonat als gestapelte Säulen.
function erloesverlustZeichnen(d) {
  const daten = d.monate.map((m) => ({ datum: m.datum, imFilter: m.imFilter, bezug: m.bezug, realisiert: m.erloes_nicht_storniert || 0, storniert: m.erloes_storniert || 0 }));
  const tipp = (z) => `${monatstext(z.datum)}\ngebucht ${kurz(z.realisiert + z.storniert)} EUR\nUmsatz ${kurz(z.realisiert)} EUR\ndurch Stornierung entgangen ${kurz(z.storniert)} EUR (${prozent(z.storniert / ((z.realisiert + z.storniert) || 1))})`;
  zeichnen("erloesverlust", (el) => (daten.length ? gestapelteSaeulen(el, daten, { klickMonat: monatSetzen, tipp }) : document.createElement("div")));
}

// Herkunft: die 15 größten Länder als Balken (plus Rest), alle Länder als Tabelle.
function herkunftZeichnen(d) {
  const l = d.laender, gesamt = d3.sum(l, (z) => z.anzahl);
  const top = l.slice(0, 15).map((z) => ({ ...z }));
  const rest = l.slice(15);
  if (rest.length) top.push({ land: `übrige ${rest.length} Länder`, anzahl: d3.sum(rest, (z) => z.anzahl), rest: true });
  const tipp = (z) => (z.rest ? `${z.land}: ${zahl(z.anzahl)} Buchungen (${prozent(z.anzahl / gesamt)})` : dimensionTipp("land", "land", gesamt)(z));
  zeichnen("balken-laender", (el) => balken(el, top, { kategorie: "land", wert: "anzahl", format: zahl, sortieren: false, aktiv: zustand.filter.land,
    klarname: (w) => (w.startsWith("übrige") ? w : klarname("land", w)), farbeVon: (z) => kennzahlFarbe(true, z.rest ? STUFE.hell : STUFE.wert),
    beiKlick: (z) => { if (!z.rest) filterSetzen("land", z.land); }, zusatz: (z) => "  (" + prozent(z.anzahl / gesamt) + ")", tipp }));
  laendertabelleZeichnen(d);
}

// Tabelle aller Länder, sortierbar, gruppierbar nach Hotel, mit Datenbalken.
function laendertabelleZeichnen(d) {
  const gruppierung = zustand.gruppierung.laender;
  const zeilen = gruppierung ? d.laenderHotel.map((z) => ({ ...z })) : d3.groups(d.laenderHotel, (z) => z.land).map(([land, g]) => ({ land, ...summieren(g) }));
  const gesamt = d3.sum(d.laender, (z) => z.anzahl);
  for (const z of zeilen) { z.anteil = z.anzahl / gesamt; z.stornoquote = z.anzahl ? z.stornierungen / z.anzahl : null; z.adr = z.anzahl ? z.adr_summe / z.anzahl : null; z.name = klarname("land", z.land); }
  const spalten = [
    ...(gruppierung ? [{ feld: "hotel", titel: "Hotel", format: (w) => w, aggregat: (g) => g[0].hotel }] : []),
    { feld: "name", titel: "Land", format: (w, z) => `${w} <span class="definition-inline">${z.land}</span>`, aggregat: (g) => g.length + " Länder" },
    { feld: "anzahl", titel: "Buchungen", format: zahl, numerisch: true, balken: true, aggregat: summe("anzahl") },
    { feld: "anteil", titel: "Anteil", format: prozent, numerisch: true, aggregat: (g) => summe("anzahl")(g) / gesamt },
    { feld: "naechte", titel: "Zimmernächte", format: zahl, numerisch: true, balken: true, aggregat: summe("naechte") },
    { feld: "erloes_nicht_storniert", titel: "Umsatz in €", format: zahl, numerisch: true, balken: true, aggregat: summe("erloes_nicht_storniert") },
    { feld: "stornoquote", titel: "Stornoquote", format: prozent, numerisch: true, balken: true, klasse: "storno", aggregat: quote("stornierungen", "anzahl") },
    { feld: "adr", titel: "Ø ADR in €", format: dezimal, numerisch: true, aggregat: quote("adr_summe", "anzahl") },
  ];
  tabelleBauen(document.getElementById("tabelle-laender"), spalten, zeilen, {
    sortierung: zustand.sortierung.laender, gruppierung: gruppierung || null,
    aktiv: (z) => z.land === zustand.filter.land, beiKlick: (z) => filterSetzen("land", z.land),
    beiSortierung: (s) => { zustand.sortierung.laender = s; laendertabelleZeichnen(d); },
  });
  document.getElementById("laender-hinweis").textContent = `${d.laender.length} Länder · Klick auf eine Zeile filtert`;
}

// Zeichnet ein Diagramm in seinen Kasten.
function zeichnen(id, bauen) {
  const kasten = document.getElementById(id);
  kasten.replaceChildren(bauen(kasten));
}

// ---------------------------------------------------------------------------
// Export, SQL, Link
// ---------------------------------------------------------------------------

// Lädt die Ländertabelle als CSV herunter (deutsches Format: Semikolon, Komma als Dezimalzeichen).
function csvExport() {
  const zeilen = [["code", "land", "buchungen", "zimmernaechte", "umsatz", "gebuchter_umsatz", "stornoquote", "adr"].join(";")];
  for (const z of zustand.daten.laender.daten) zeilen.push([z.land, klarname("land", z.land), z.anzahl, z.naechte, z.erloes_nicht_storniert, z.erloes, z.stornoquote, z.adr].map((w) => String(w).replace(".", ",")).join(";"));
  const datei = new Blob(["﻿" + zeilen.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(datei); link.download = "herkunftslaender.csv"; link.click();
  URL.revokeObjectURL(link.href);
}

// Schreibt zu jedem Diagramm das SQL seiner Route in den aufklappbaren Kasten.
function sqlAnzeigen() {
  document.querySelectorAll("[data-route]").forEach((kasten) => {
    const antwort = zustand.daten[kasten.dataset.route];
    if (!antwort) return;
    const parameter = Object.entries(antwort.parameter).map(([k, v]) => `:${k} = ${JSON.stringify(v)}`).join(", ");
    kasten.querySelector("pre").textContent = antwort.sql + (parameter ? "\n\n-- Parameter: " + parameter : "");
  });
}

// Kopiert die Adresse mit dem aktuellen Filterzustand in die Zwischenablage.
async function linkKopieren(knopf) {
  await navigator.clipboard.writeText(location.href);
  const text = knopf.textContent;
  knopf.textContent = "Link kopiert";
  setTimeout(() => (knopf.textContent = text), 2000);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

// Verbindet die Bedienelemente und lädt die Daten.
async function start() {
  zustand.filter = filterAusAdresse();
  document.getElementById("filterfeld").open = window.innerWidth > 860 || Object.keys(zustand.filter).length > 0;
  document.querySelectorAll("#filterfeld select, #filterfeld input").forEach((feld) => feld.addEventListener("change", () => filterSetzen(feld.name, feld.value)));
  document.getElementById("csv").addEventListener("click", csvExport);
  document.getElementById("link").addEventListener("click", (e) => linkKopieren(e.target));
  document.getElementById("laender-gruppierung").addEventListener("change", (e) => { zustand.gruppierung.laender = e.target.value; laendertabelleZeichnen(kontextBilden()); });
  document.getElementById("pivot-gruppierung").addEventListener("change", (e) => { zustand.gruppierung.pivot = e.target.value; pivotZeichnen(kontextBilden()); });
  let zeitgeber = null;
  window.addEventListener("resize", () => { clearTimeout(zeitgeber); zeitgeber = setTimeout(() => zustand.daten.kennzahlen && allesZeichnen(), 250); });
  await startdatenLaden();
  await allesLaden();
}

start();
