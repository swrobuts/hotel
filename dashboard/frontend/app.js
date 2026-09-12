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
const ROUTEN = ["kennzahlen", "monate", "hotels", "segmente", "kanaele", "kautionen", "vorlaufzeit",
  "segment_kundentyp", "erloes_datum", "laender", "laender_hotel"];
const HOTELFARBEN = { "City Hotel": FARBE.tinte, "Resort Hotel": FARBE.vergleich };

const zustand = {
  filter: {}, daten: {}, gesamt: null, gesamtMonate: null,
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
  return FILTER_NAMEN.filter((n) => zustand.filter[n] && !["jahr", "von", "bis"].includes(n))
    .map((n) => FILTER_TITEL[n] + " " + zustand.filter[n]).join(", ");
}

// ---------------------------------------------------------------------------
// Daten laden
// ---------------------------------------------------------------------------

// Holt eine Route mit den aktuellen Filtern als Parametern.
async function holen(route, filter = zustand.filter) {
  const parameter = new URLSearchParams(filter);
  const antwort = await fetch("/api/" + route + (parameter.toString() ? "?" + parameter : ""));
  if (!antwort.ok) throw new Error(route + ": " + antwort.status);
  return antwort.json();
}

// Lädt alle Routen parallel und zeichnet danach alles neu.
async function allesLaden() {
  document.body.classList.add("laedt");
  try {
    const antworten = await Promise.all(ROUTEN.map((route) => holen(route)));
    ROUTEN.forEach((route, i) => (zustand.daten[route] = antworten[i]));
    allesZeichnen();
    document.getElementById("fehler").hidden = true;
  } catch (fehler) {
    const kasten = document.getElementById("fehler");
    kasten.textContent = "Daten konnten nicht geladen werden (" + fehler.message + "). Bitte neu laden.";
    kasten.hidden = false;
  } finally {
    document.body.classList.remove("laedt");
  }
}

// Einmalig beim Start: Auswahllisten und der Gesamtbestand als Vergleichsgröße.
async function startdatenLaden() {
  const [filterwerte, gesamt, monate] = await Promise.all([holen("filterwerte", {}), holen("kennzahlen", {}), holen("monate", {})]);
  zustand.gesamt = gesamt.daten[0];
  zustand.gesamtMonate = monateVerdichten(monate.daten);
  filterleisteFuellen(filterwerte.daten);
}

// ---------------------------------------------------------------------------
// Filterleiste und Chips
// ---------------------------------------------------------------------------

// Füllt die Auswahllisten mit den Ausprägungen aus der Datenbank (mit Anzahl Buchungen).
function filterleisteFuellen(zeilen) {
  for (const name of ["hotel", "jahr", "segment", "kanal", "kundentyp", "kaution", "land", "vorlaufzeit"]) {
    const auswahl = document.querySelector(`select[name=${name}]`);
    const werte = name === "vorlaufzeit"
      ? [["0-7", "0–7 Tage"], ["8-30", "8–30 Tage"], ["31-90", "31–90 Tage"], ["90+", "über 90 Tage"]]
      : zeilen.filter((z) => z.filter === name).map((z) => [z.wert, z.wert + " (" + zahl(z.anzahl) + ")"]);
    if (name === "jahr") werte.sort((a, b) => a[0].localeCompare(b[0]));
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
  if (name === "vorlaufzeit") return "Vorlaufzeit: " + wert + " Tage";
  return FILTER_TITEL[name] + ": " + wert;
}

// ---------------------------------------------------------------------------
// Daten aufbereiten
// ---------------------------------------------------------------------------

// Fasst Monatszeilen je Hotel zu einer Zeile je Monat zusammen (Summen, daraus Quoten und Mittelwerte).
function monateVerdichten(zeilen) {
  const jeHotel = zeilen.map((z) => ({ ...z, datum: monatsdatum(z.jahr, z.monat) }));
  return d3.groups(jeHotel, (z) => +z.datum).map(([, gruppe]) => {
    const summe = (feld) => d3.sum(gruppe, (z) => z[feld]);
    const anzahl = summe("anzahl");
    return {
      datum: gruppe[0].datum, jahr: gruppe[0].jahr, monat: gruppe[0].monat, anzahl,
      stornoquote: summe("stornierungen") / anzahl, adr: summe("adr_summe") / anzahl,
      erloes: summe("erloes"), erloes_nicht_storniert: summe("erloes_nicht_storniert"), naechte: summe("naechte"),
      vorlaufzeit: summe("vorlaufzeit_summe") / anzahl, aufenthaltsdauer: summe("naechte") / anzahl,
      wiederholungsgaeste: summe("wiederholungsgaeste") / anzahl, sonderwuensche: summe("sonderwuensche") / anzahl,
      gesamterloes: summe("erloes"), zimmernaechte: summe("naechte"), erloes_storniert: summe("erloes") - summe("erloes_nicht_storniert"),
    };
  });
}

// Fasst Zeilen mit denselben Kennzahlspalten je Schlüssel zusammen (für Tabellen ohne Gruppierung).
function verdichten(zeilen, schluessel) {
  return d3.groups(zeilen, (z) => z[schluessel]).map(([wert, gruppe]) => {
    const summe = (feld) => d3.sum(gruppe, (z) => z[feld]);
    const anzahl = summe("anzahl");
    return { [schluessel]: wert, anzahl, stornierungen: summe("stornierungen"), stornoquote: summe("stornierungen") / anzahl,
      adr: summe("adr_summe") / anzahl, adr_summe: summe("adr_summe"), erloes: summe("erloes"), naechte: summe("naechte") };
  });
}

// Baut den Datenkontext, aus dem Texte, Kacheln und Diagramme entstehen.
function kontextBilden() {
  const D = zustand.daten;
  const jeHotel = D.monate.daten.map((z) => ({ ...z, datum: monatsdatum(z.jahr, z.monat) }));
  const monate = monateVerdichten(D.monate.daten);
  const pivot = D.segment_kundentyp.daten;
  const jeKundentyp = verdichten(pivot.map((z) => ({ ...z, stornierungen: 0, adr_summe: 0, erloes: 0, naechte: 0 })), "kundentyp");
  const laender = D.laender.daten;
  const ausland = laender.filter((z) => z.land !== "PRT");
  return {
    kennzahlen: D.kennzahlen.daten[0], gesamt: zustand.gesamt, monate, jeHotel,
    hotels: D.hotels.daten, segmente: D.segmente.daten, kanaele: D.kanaele.daten, kautionen: D.kautionen.daten,
    vorlauf: D.vorlaufzeit.daten, pivot, pivotTop: jeKundentyp.length ? d3.greatest(jeKundentyp, (z) => z.anzahl) : null,
    erloesDatum: D.erloes_datum.daten.map((z) => ({ ...z, datum: monatsdatum(z.jahr, z.monat) })),
    laender, laenderHotel: D.laender_hotel.daten,
    stornoAusland: d3.sum(ausland, (z) => z.stornierungen) / (d3.sum(ausland, (z) => z.anzahl) || 1),
    saison: saisonprofil(monate),
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
  zeichnen("saison", (el) => saisonlinien(el, d.monate, { wert: "anzahl", format: zahl, klickMonat: monatSetzen }));
  vertriebZeichnen(d);
  stornoZeichnen(d);
  herkunftZeichnen(d);
  sqlAnzeigen();
}

// Vier Kennzahlen als Kacheln, mit dem Gesamtbestand als Vergleich, sobald gefiltert wird.
function kachelnZeichnen(d) {
  const k = d.kennzahlen, g = d.gesamt;
  const definitionen = [
    ["Anzahl Buchungen", zahl(k.anzahl_buchungen), zahl(g.anzahl_buchungen), ""],
    ["Stornoquote", prozent(k.stornoquote), prozent(g.stornoquote), "storno"],
    ["Ø Tagesrate (ADR) in EUR", dezimal(k.adr), dezimal(g.adr), ""],
    ["Erlös nicht storniert in EUR", zahl(k.erloes_nicht_storniert), zahl(g.erloes_nicht_storniert), ""],
  ];
  const kasten = document.getElementById("kacheln");
  kasten.replaceChildren();
  for (const [titel, wert, vergleich, klasse] of definitionen) {
    const kachel = document.createElement("div");
    kachel.className = "kachel";
    kachel.innerHTML = `<div class="kachel-titel">${titel}</div><div class="kachel-wert ${klasse}">${k.anzahl_buchungen ? wert : "–"}</div>`
      + `<div class="kachel-vergleich">${d.gefiltert ? "Gesamtbestand " + vergleich : "Jul 2015 – Aug 2017"}</div>`;
    kasten.append(kachel);
  }
}

// Grafische Tabelle aller zehn Kennzahlen: Wert, Gesamtbestand, Abweichung, Verlauf mit Minimum und Maximum.
function kennzahlentabelleZeichnen(d) {
  const k = d.kennzahlen, g = d.gesamt, m = d.monate;
  const definitionen = [
    ["Anzahl Buchungen", "anzahl_buchungen", zahl, "anzahl", "Zeilen der Faktentabelle im gefilterten Bestand"],
    ["Stornoquote", "stornoquote", prozent, "stornoquote", "Anteil der Buchungen mit is_canceled = 1", "storno"],
    ["Ø Vorlaufzeit (Tage)", "vorlaufzeit", dezimal1, "vorlaufzeit", "Mittelwert von lead_time"],
    ["Ø Aufenthaltsdauer (Nächte)", "aufenthaltsdauer", dezimal, "aufenthaltsdauer", "Mittelwert von total_nights"],
    ["Gebuchte Zimmernächte", "zimmernaechte", zahl, "naechte", "Summe von total_nights; Ersatz für die Auslastung, weil die Kapazität fehlt"],
    ["Ø ADR (EUR je Nacht)", "adr", dezimal, "adr", "Mittelwert von adr (Average Daily Rate)"],
    ["Gesamterlös (EUR)", "gesamterloes", zahl, "erloes", "Summe von revenue = adr × total_nights, auch stornierte Buchungen"],
    ["Erlös nicht stornierter Buchungen (EUR)", "erloes_nicht_storniert", zahl, "erloes_nicht_storniert", "revenue der Buchungen mit is_canceled = 0"],
    ["Wiederholungsgast-Anteil", "wiederholungsgaeste", prozent, "wiederholungsgaeste", "Anteil der Buchungen mit is_repeated_guest = 1"],
    ["Anteil mit Sonderwünschen", "sonderwuensche", prozent, "sonderwuensche", "Anteil der Buchungen mit total_of_special_requests > 0"],
  ];
  const zeilen = definitionen.map(([titel, feld, format, monatsfeld, definition, klasse], i) => {
    const verlauf = m.map((z) => z[monatsfeld]);
    return { reihenfolge: i, kennzahl: titel, wert: k[feld], gesamt: g[feld], abweichung: g[feld] ? k[feld] / g[feld] - 1 : null,
      verlauf, minimum: verlauf.length ? d3.min(verlauf) : null, maximum: verlauf.length ? d3.max(verlauf) : null, format, definition, klasse };
  });
  const spalten = [
    { feld: "kennzahl", titel: "Kennzahl", format: (w, z) => `${w}<span class="definition">${z.definition}</span>` },
    { feld: "wert", titel: d.gefiltert ? "Gefilterter Bestand" : "Wert", format: (w, z) => z.format(w), numerisch: true },
    ...(d.gefiltert ? [
      { feld: "gesamt", titel: "Gesamtbestand", format: (w, z) => z.format(w), numerisch: true },
      { feld: "abweichung", titel: "Abweichung", format: (w) => (w > 0 ? "+" : "") + prozent(w), numerisch: true },
    ] : []),
    { feld: "verlauf", titel: "Verlauf je Monat", format: () => "", zeichnen: (z) => (z.verlauf.length > 1 ? sparkline(z.verlauf, z.klasse === "storno" ? FARBE.storno : FARBE.balken) : null) },
    { feld: "minimum", titel: "Minimum", format: (w, z) => z.format(w), numerisch: true },
    { feld: "maximum", titel: "Maximum", format: (w, z) => z.format(w), numerisch: true },
  ];
  tabelleBauen(document.getElementById("tabelle-kennzahlen"), spalten, zeilen, {
    sortierung: zustand.sortierung.kennzahlen, gruppierung: null,
    beiSortierung: (s) => { zustand.sortierung.kennzahlen = s; kennzahlentabelleZeichnen(d); },
  });
}

// Drei Felder untereinander mit einer Zeitachse: Buchungen, Erlös, Stornoquote – je Hotel eine Linie.
function zeitverlaufZeichnen(d) {
  const daten = d.jeHotel;
  if (daten.length < 2) { for (const id of ["zeit-buchungen", "zeit-erloes", "zeit-storno"]) document.getElementById(id).replaceChildren(); return; }
  const bereich = d3.extent(daten, (z) => z.datum);
  const gemeinsam = { reihe: "hotel", bereich, farben: HOTELFARBEN, klickMonat: monatSetzen };
  const feld = (id, titel, bauen) => {
    const kasten = document.getElementById(id);
    const ueberschrift = document.createElement("h4"); ueberschrift.textContent = titel;
    kasten.replaceChildren(ueberschrift, bauen(kasten));
  };
  feld("zeit-buchungen", "Anzahl Buchungen", (el) => zeitfeld(el, daten, { ...gemeinsam, wert: "anzahl", format: zahl, achse: false }));
  feld("zeit-erloes", "Gesamterlös in EUR", (el) => zeitfeld(el, daten, { ...gemeinsam, wert: "erloes", format: kurz, achse: false }));
  feld("zeit-storno", "Stornoquote", (el) => zeitfeld(el, daten, { ...gemeinsam, wert: "stornoquote", format: prozent, achse: true,
    farben: { "City Hotel": FARBE.storno, "Resort Hotel": "#d9a58f" }, hoehe: 190 }));
}

// Vertrieb: Marktsegmente, Vertriebskanäle, Tabelle Marktsegment × Kundentyp.
function vertriebZeichnen(d) {
  zeichnen("balken-segment", (el) => balken(el, d.segmente, { kategorie: "segment", wert: "anzahl", format: zahl, aktiv: zustand.filter.segment,
    beiKlick: (z) => filterSetzen("segment", z.segment), zusatz: (z) => "  (" + prozent(z.anzahl / d3.sum(d.segmente, (x) => x.anzahl)) + ")" }));
  zeichnen("balken-kanal", (el) => balken(el, d.kanaele, { kategorie: "kanal", wert: "erloes", format: kurz, aktiv: zustand.filter.kanal,
    beiKlick: (z) => filterSetzen("kanal", z.kanal), zusatz: (z) => "  (" + prozent(z.erloes / d3.sum(d.kanaele, (x) => x.erloes)) + ")" }));
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
    { feld: "segment", titel: "Marktsegment", format: (w) => w, aggregat: () => "alle Segmente" },
    ...kundentypen.map((typ) => ({ feld: typ, titel: typ, format: zahl, numerisch: true, balken: true, aggregat: summe(typ) })),
    { feld: "gesamt", titel: "Gesamt", format: zahl, numerisch: true, aggregat: summe("gesamt") },
  ];
  tabelleBauen(document.getElementById("tabelle-pivot"), spalten, zeilen, {
    sortierung: zustand.sortierung.pivot, gruppierung: gruppierung || null,
    aktiv: (z) => z.segment === zustand.filter.segment, beiKlick: (z) => filterSetzen("segment", z.segment),
    beiSortierung: (s) => { zustand.sortierung.pivot = s; pivotZeichnen(d); },
  });
}

// Stornoquoten auf einer gemeinsamen Skala von 0 bis 100 %, Referenzlinie Gesamtbestand.
function stornoZeichnen(d) {
  const referenz = d.kennzahlen.stornoquote;
  const gemeinsam = { wert: "stornoquote", format: prozent, farbe: FARBE.storno, domain: [0, 1.15], referenz };
  zeichnen("storno-hotel", (el) => balken(el, d.hotels, { ...gemeinsam, kategorie: "hotel", aktiv: zustand.filter.hotel, beiKlick: (z) => filterSetzen("hotel", z.hotel) }));
  zeichnen("storno-kaution", (el) => balken(el, d.kautionen, { ...gemeinsam, kategorie: "kaution", aktiv: zustand.filter.kaution, beiKlick: (z) => filterSetzen("kaution", z.kaution) }));
  zeichnen("storno-segment", (el) => balken(el, d.segmente, { ...gemeinsam, kategorie: "segment", aktiv: zustand.filter.segment, beiKlick: (z) => filterSetzen("segment", z.segment) }));
  zeichnen("storno-vorlaufzeit", (el) => balken(el, d.vorlauf, { ...gemeinsam, kategorie: "vorlaufzeit", sortieren: false, aktiv: zustand.filter.vorlaufzeit, beiKlick: (z) => filterSetzen("vorlaufzeit", z.vorlaufzeit) }));
  const bereich = d3.extent(d.erloesDatum, (z) => z.datum);
  zeichnen("erloes-datum", (el) => (d.erloesDatum.length ? zeitfeld(el, d.erloesDatum, { reihe: "datum_art", wert: "erloes", format: kurz, bereich, achse: true, hoehe: 260,
    farben: { Anreisedatum: FARBE.tinte, Stornodatum: FARBE.storno }, klickMonat: monatSetzen }) : document.createElement("div")));
}

// Herkunft: die 15 größten Länder als Balken (plus Rest), alle Länder als Tabelle.
function herkunftZeichnen(d) {
  const l = d.laender, gesamt = d3.sum(l, (z) => z.anzahl);
  const top = l.slice(0, 15).map((z) => ({ ...z }));
  const rest = l.slice(15);
  if (rest.length) top.push({ land: `übrige ${rest.length} Länder`, anzahl: d3.sum(rest, (z) => z.anzahl), rest: true });
  zeichnen("balken-laender", (el) => balken(el, top, { kategorie: "land", wert: "anzahl", format: zahl, sortieren: false, aktiv: zustand.filter.land,
    farbeVon: (z) => (z.rest ? FARBE.balkenHell : FARBE.balken), beiKlick: (z) => { if (!z.rest) filterSetzen("land", z.land); },
    zusatz: (z) => "  (" + prozent(z.anzahl / gesamt) + ")" }));
  laendertabelleZeichnen(d);
}

// Tabelle aller Länder, sortierbar, gruppierbar nach Hotel, mit Datenbalken.
function laendertabelleZeichnen(d) {
  const gruppierung = zustand.gruppierung.laender;
  const zeilen = gruppierung ? d.laenderHotel.map((z) => ({ ...z })) : verdichten(d.laenderHotel, "land");
  const gesamt = d3.sum(d.laender, (z) => z.anzahl);
  for (const z of zeilen) z.anteil = z.anzahl / gesamt;
  const spalten = [
    ...(gruppierung ? [{ feld: "hotel", titel: "Hotel", format: (w) => w, aggregat: (g) => g[0].hotel }] : []),
    { feld: "land", titel: "Land", format: (w) => w, aggregat: (g) => g.length + " Länder" },
    { feld: "anzahl", titel: "Buchungen", format: zahl, numerisch: true, balken: true, aggregat: summe("anzahl") },
    { feld: "anteil", titel: "Anteil", format: prozent, numerisch: true, aggregat: (g) => summe("anzahl")(g) / gesamt },
    { feld: "naechte", titel: "Zimmernächte", format: zahl, numerisch: true, balken: true, aggregat: summe("naechte") },
    { feld: "erloes", titel: "Erlös (EUR)", format: zahl, numerisch: true, balken: true, aggregat: summe("erloes") },
    { feld: "stornoquote", titel: "Stornoquote", format: prozent, numerisch: true, balken: true, klasse: "storno", aggregat: quote("stornierungen", "anzahl") },
    { feld: "adr", titel: "Ø ADR", format: dezimal, numerisch: true, aggregat: quote("adr_summe", "anzahl") },
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
  const zeilen = [["land", "buchungen", "zimmernaechte", "erloes", "stornoquote", "adr"].join(";")];
  for (const z of zustand.daten.laender.daten) zeilen.push([z.land, z.anzahl, z.naechte, z.erloes, z.stornoquote, z.adr].map((w) => String(w).replace(".", ",")).join(";"));
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
