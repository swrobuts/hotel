// Hotel Booking Demand – Dashboard.
//
// Ablauf: Der Filterzustand steht in `zustand.filter` und in der Adresszeile.
// Bei jeder Änderung lädt `allesLaden` die Routen des Backends parallel und
// `allesZeichnen` baut Kacheln, Diagramme und Tabelle neu auf. Ein Klick in ein
// Diagramm ändert nur den Filterzustand; der Rest folgt daraus.

const FILTER_NAMEN = ["hotel", "jahr", "von", "bis", "segment", "kanal", "kundentyp", "kaution", "land", "vorlaufzeit"];
const FILTER_TITEL = { hotel: "Hotel", jahr: "Anreisejahr", von: "ab", bis: "bis", segment: "Marktsegment",
  kanal: "Vertriebskanal", kundentyp: "Kundentyp", kaution: "Kautionstyp", land: "Land", vorlaufzeit: "Vorlaufzeit" };
const ROUTEN = ["kennzahlen", "monate", "hotels", "segmente", "kanaele", "kautionen", "vorlaufzeit",
  "segment_kundentyp", "erloes_datum", "laender"];

const zustand = { filter: {}, daten: {}, gesamt: null, welt: null, sortierung: { spalte: "anzahl", absteigend: true } };

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
  const adresse = parameter.toString() ? "?" + parameter.toString() : location.pathname;
  history.replaceState(null, "", adresse);
}

// Setzt einen Filter; derselbe Wert ein zweites Mal hebt ihn wieder auf (Umschalten per Klick).
function filterSetzen(name, wert) {
  if (zustand.filter[name] === wert || wert === "" || wert == null) delete zustand.filter[name];
  else zustand.filter[name] = wert;
  filterInAdresse();
  allesLaden();
}

// Ein Klick auf einen Monat grenzt den Zeitraum auf genau diesen Monat ein.
function monatSetzen(datum) {
  const schluessel = monatsschluessel(datum);
  if (zustand.filter.von === schluessel && zustand.filter.bis === schluessel) {
    delete zustand.filter.von; delete zustand.filter.bis;
  } else {
    zustand.filter.von = schluessel; zustand.filter.bis = schluessel;
  }
  filterInAdresse();
  allesLaden();
}

// Alle Filter löschen.
function filterZuruecksetzen() {
  zustand.filter = {};
  filterInAdresse();
  allesLaden();
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

// Einmalig beim Start: Auswahllisten, Gesamtbestand als Vergleich, Weltkarte.
async function startdatenLaden() {
  const [filterwerte, gesamt, welt] = await Promise.all([
    holen("filterwerte", {}), holen("kennzahlen", {}), fetch("daten/welt-110m.json").then((a) => a.json()),
  ]);
  zustand.gesamt = gesamt.daten[0];
  zustand.welt = welt;
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

// Stellt die Auswahllisten und Monatsfelder auf den aktuellen Filterzustand ein.
function filterleisteAktualisieren() {
  for (const name of FILTER_NAMEN) {
    const feld = document.querySelector(`[name=${name}]`);
    if (feld) feld.value = zustand.filter[name] || "";
  }
  chipsZeichnen();
}

// Zeigt jeden aktiven Filter als Chip; Klick auf den Chip entfernt ihn.
function chipsZeichnen() {
  const kasten = document.getElementById("chips");
  kasten.replaceChildren();
  const aktive = FILTER_NAMEN.filter((name) => zustand.filter[name]);
  document.getElementById("zuruecksetzen").hidden = aktive.length === 0;
  for (const name of aktive) {
    if (name === "bis" && zustand.filter.von === zustand.filter.bis) continue; // ein Chip für einen einzelnen Monat
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.innerHTML = `<span>${chipText(name)}</span><span aria-hidden="true">×</span>`;
    chip.title = "Filter entfernen";
    chip.addEventListener("click", () => {
      if (name === "von" && zustand.filter.von === zustand.filter.bis) delete zustand.filter.bis;
      filterSetzen(name, zustand.filter[name]);
    });
    kasten.append(chip);
  }
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
// Zeichnen
// ---------------------------------------------------------------------------

// Baut Kacheln, Diagramme und Tabelle aus den geladenen Daten neu.
function allesZeichnen() {
  filterleisteAktualisieren();
  const monate = monateVorbereiten(zustand.daten.monate.daten);
  kachelnZeichnen(zustand.daten.kennzahlen.daten[0], monate.gesamt);
  uebersichtZeichnen(monate);
  vertriebZeichnen();
  stornoZeichnen();
  saisonZeichnen(monate);
  laenderZeichnen();
  sqlAnzeigen();
}

// Ergänzt die Monatszeilen um ein Datum und bildet Summen über beide Hotels.
function monateVorbereiten(zeilen) {
  const jeHotel = zeilen.map((z) => ({ ...z, datum: monatsdatum(z.jahr, z.monat) }));
  const gruppen = d3.groups(jeHotel, (z) => +z.datum);
  const gesamt = gruppen.map(([, zeilen]) => {
    const summe = (feld) => d3.sum(zeilen, (z) => z[feld]);
    const anzahl = summe("anzahl");
    return {
      datum: zeilen[0].datum, jahr: zeilen[0].jahr, monat: zeilen[0].monat, anzahl,
      stornoquote: summe("stornierungen") / anzahl, adr: summe("adr_summe") / anzahl,
      erloes: summe("erloes"), erloes_nicht_storniert: summe("erloes_nicht_storniert"), naechte: summe("naechte"),
      vorlaufzeit: summe("vorlaufzeit_summe") / anzahl, aufenthaltsdauer: summe("naechte") / anzahl,
      wiederholungsgaeste: summe("wiederholungsgaeste") / anzahl, sonderwuensche: summe("sonderwuensche") / anzahl,
    };
  });
  return { jeHotel, gesamt };
}

// Die zehn Kennzahlen des Katalogs als Kacheln: Wert, Sparkline über die Monate, Gesamtbestand als Vergleich.
function kachelnZeichnen(k, monate) {
  const definitionen = [
    ["Anzahl Buchungen", zahl(k.anzahl_buchungen), "anzahl", zahl(zustand.gesamt.anzahl_buchungen)],
    ["Stornoquote", prozent(k.stornoquote), "stornoquote", prozent(zustand.gesamt.stornoquote), FARBE.storno],
    ["Ø ADR (EUR je Nacht)", dezimal(k.adr), "adr", dezimal(zustand.gesamt.adr)],
    ["Gesamterlös (EUR)", zahl(k.gesamterloes), "erloes", zahl(zustand.gesamt.gesamterloes)],
    ["Erlös nicht stornierter Buchungen (EUR)", zahl(k.erloes_nicht_storniert), "erloes_nicht_storniert", zahl(zustand.gesamt.erloes_nicht_storniert)],
    ["Gebuchte Zimmernächte", zahl(k.zimmernaechte), "naechte", zahl(zustand.gesamt.zimmernaechte)],
    ["Ø Vorlaufzeit (Tage)", dezimal1(k.vorlaufzeit), "vorlaufzeit", dezimal1(zustand.gesamt.vorlaufzeit)],
    ["Ø Aufenthaltsdauer (Nächte)", dezimal(k.aufenthaltsdauer), "aufenthaltsdauer", dezimal(zustand.gesamt.aufenthaltsdauer)],
    ["Wiederholungsgäste", prozent(k.wiederholungsgaeste), "wiederholungsgaeste", prozent(zustand.gesamt.wiederholungsgaeste)],
    ["Buchungen mit Sonderwünschen", prozent(k.sonderwuensche), "sonderwuensche", prozent(zustand.gesamt.sonderwuensche)],
  ];
  const gefiltert = Object.keys(zustand.filter).length > 0;
  const kasten = document.getElementById("kacheln");
  kasten.replaceChildren();
  for (const [titel, wert, feld, vergleich, farbe] of definitionen) {
    const kachel = document.createElement("div");
    kachel.className = "kachel";
    kachel.innerHTML = `<div class="kachel-titel">${titel}</div>`
      + `<div class="kachel-zeile"><div class="kachel-wert">${k.anzahl_buchungen ? wert : "–"}</div><div class="kachel-linie"></div></div>`
      + `<div class="kachel-vergleich">${gefiltert ? "Gesamtbestand " + vergleich : "Verlauf je Anreisemonat"}</div>`;
    if (monate.length > 1) kachel.querySelector(".kachel-linie").append(sparkline(monate.map((m) => m[feld]), farbe));
    kasten.append(kachel);
  }
}

// Übersicht: Buchungen und Erlös je Anreisemonat, eine Linie je Hotel.
function uebersichtZeichnen({ jeHotel, gesamt }) {
  const farben = { "City Hotel": FARBE.tinte, "Resort Hotel": FARBE.vergleich };
  const spitze = d3.greatest(gesamt, (m) => m.anzahl);
  zeichnen("linie-buchungen", (el) => linien(el, jeHotel, { reihe: "hotel", wert: "anzahl", format: zahl, klickMonat: monatSetzen, farben }),
    spitze ? `Buchungen je Anreisemonat – Spitze ${monatstext(spitze.datum)} mit ${zahl(spitze.anzahl)}` : "Buchungen je Anreisemonat");
  const erloesSpitze = d3.greatest(gesamt, (m) => m.erloes);
  zeichnen("linie-erloes", (el) => linien(el, jeHotel, { reihe: "hotel", wert: "erloes", format: kurz, klickMonat: monatSetzen, farben }),
    erloesSpitze ? `Gesamterlös je Anreisemonat – Spitze ${monatstext(erloesSpitze.datum)} mit ${kurz(erloesSpitze.erloes)} EUR` : "Gesamterlös je Anreisemonat");
}

// Vertrieb: Marktsegmente, Vertriebskanäle, Small Multiples je Kundentyp.
function vertriebZeichnen() {
  const segmente = zustand.daten.segmente.daten;
  const kanaele = zustand.daten.kanaele.daten;
  const gesamt = d3.sum(segmente, (d) => d.anzahl);
  const top = segmente[0];
  zeichnen("balken-segment", (el) => balken(el, segmente, { kategorie: "segment", wert: "anzahl", format: zahl, aktiv: zustand.filter.segment, beiKlick: (d) => filterSetzen("segment", d.segment) }),
    top ? `Anzahl Buchungen nach Marktsegment – ${top.segment} bringt ${prozent(top.anzahl / gesamt)}` : "Anzahl Buchungen nach Marktsegment");
  const topKanal = [...kanaele].sort((a, b) => b.erloes - a.erloes)[0];
  zeichnen("balken-kanal", (el) => balken(el, kanaele, { kategorie: "kanal", wert: "erloes", format: kurz, aktiv: zustand.filter.kanal, beiKlick: (d) => filterSetzen("kanal", d.kanal) }),
    topKanal ? `Gesamterlös nach Vertriebskanal – ${topKanal.kanal} mit ${kurz(topKanal.erloes)} EUR` : "Gesamterlös nach Vertriebskanal");
  zeichnen("multiples-segment-kundentyp", (el) => kleineVielfache(el, zustand.daten.segment_kundentyp.daten, {
    aktivSegment: zustand.filter.segment, beiKlick: (d) => { zustand.filter.segment = d.segment; filterSetzen("kundentyp", d.kundentyp); } }),
    "Anzahl Buchungen nach Marktsegment, je Kundentyp ein Feld (gemeinsame Skala)");
}

// Storno: Quoten nach Hotel, Segment, Kaution, Vorlaufzeit; Erlös nach Anreise- und Stornodatum.
function stornoZeichnen() {
  const referenz = zustand.daten.kennzahlen.daten[0].stornoquote;
  const vorlauf = zustand.daten.vorlaufzeit.daten;
  const kautionen = zustand.daten.kautionen.daten;
  const stornoBalken = (id, daten, kategorie, filterName, titel) =>
    zeichnen(id, (el) => balken(el, daten, { kategorie, wert: "stornoquote", format: prozent, farbe: FARBE.storno, aktiv: zustand.filter[filterName],
      referenz, beiKlick: (d) => filterSetzen(filterName, d[kategorie]) }), titel);
  const hotels = zustand.daten.hotels.daten;
  stornoBalken("balken-storno-hotel", hotels, "hotel", "hotel",
    hotels.length === 2 ? `Stornoquote nach Hotel – ${hotels.map((h) => h.hotel + " " + prozent(h.stornoquote)).join(", ")}` : "Stornoquote nach Hotel");
  const segmente = zustand.daten.segmente.daten;
  const hoechstes = d3.greatest(segmente, (d) => d.stornoquote);
  stornoBalken("balken-storno-segment", segmente, "segment", "segment",
    hoechstes ? `Stornoquote nach Marktsegment – am höchsten bei ${hoechstes.segment} (${prozent(hoechstes.stornoquote)})` : "Stornoquote nach Marktsegment");
  const nonRefund = kautionen.find((d) => d.kaution === "Non Refund");
  stornoBalken("balken-storno-kaution", kautionen, "kaution", "kaution",
    nonRefund ? `Stornoquote nach Kautionstyp – Non Refund wird zu ${prozent(nonRefund.stornoquote)} storniert` : "Stornoquote nach Kautionstyp");
  const erster = vorlauf[0], letzter = vorlauf.at(-1);
  zeichnen("balken-storno-vorlaufzeit", (el) => vorlaufzeitBalken(el, vorlauf, referenz),
    erster && letzter && vorlauf.length > 1
      ? `Stornoquote steigt mit der Vorlaufzeit – ${prozent(erster.stornoquote)} bei ${erster.vorlaufzeit} Tagen, ${prozent(letzter.stornoquote)} bei ${letzter.vorlaufzeit} Tagen`
      : "Stornoquote nach Vorlaufzeit (Tage)");
  const reihen = zustand.daten.erloes_datum.daten.map((z) => ({ ...z, datum: monatsdatum(z.jahr, z.monat) }));
  zeichnen("linie-erloes-datum", (el) => linien(el, reihen, { reihe: "datum_art", wert: "erloes", format: kurz, klickMonat: monatSetzen,
    farben: { Anreisedatum: FARBE.tinte, Stornodatum: FARBE.storno } }),
    "Erlös je Monat – nach Anreisedatum und nach Datum des Reservierungsstatus (die zweite Beziehung zur Datumstabelle)");
}

// Senkrechte Balken für die vier Vorlaufzeit-Buckets in fester Reihenfolge.
function vorlaufzeitBalken(element, daten, referenz) {
  return Plot.plot({
    width: breiteVon(element), height: 240, marginTop: 24, marginLeft: 40,
    x: { label: "Vorlaufzeit in Tagen", domain: daten.map((d) => d.vorlaufzeit), tickSize: 0 },
    y: { axis: null, domain: [0, Math.max(...daten.map((d) => d.stornoquote)) * 1.2] },
    style: { fontSize: "12px", color: FARBE.tinte },
    marks: [
      Plot.barY(daten, { x: "vorlaufzeit", y: "stornoquote", fill: (d) => (d.vorlaufzeit === zustand.filter.vorlaufzeit ? FARBE.akzent : FARBE.storno),
        render: klickbar(daten, (d) => filterSetzen("vorlaufzeit", d.vorlaufzeit)) }),
      Plot.text(daten, { x: "vorlaufzeit", y: "stornoquote", text: (d) => prozent(d.stornoquote), dy: -8, fill: FARBE.grau }),
      Plot.ruleY([referenz], { stroke: FARBE.tinte, strokeDasharray: "3,3" }),
      Plot.text([referenz], { y: referenz, frameAnchor: "right", dx: -4, dy: -7, text: () => "Gesamt " + prozent(referenz), fill: FARBE.tinte, fontSize: 11 }),
    ],
  });
}

// Saison und Herkunft: Buchungen je Monat und Jahr, Karte.
function saisonZeichnen({ gesamt }) {
  const spitze = d3.greatest(gesamt, (m) => m.anzahl);
  zeichnen("linie-monat-jahr", (el) => saisonlinien(el, gesamt, { wert: "anzahl", format: zahl, klickMonat: monatSetzen }),
    spitze ? `Buchungen je Anreisemonat und Jahr – die Nachfrage folgt der Saison, Spitze ${MONATE_LANG[spitze.monat - 1]} ${spitze.jahr}` : "Buchungen je Anreisemonat und Jahr");
  const laender = zustand.daten.laender.daten;
  const gesamtBuchungen = d3.sum(laender, (d) => d.anzahl);
  const top = laender[0];
  zeichnen("karte", (el) => karte(el, laender, zustand.welt, { aktiv: zustand.filter.land, beiKlick: (d) => filterSetzen("land", d.land) }),
    top ? `Herkunftsländer der Gäste – ${top.land} stellt ${prozent(top.anzahl / gesamtBuchungen)} der Buchungen, ${laender.length} Länder insgesamt` : "Herkunftsländer der Gäste");
}

// Top 10 als Balken und alle Länder als sortierbare Tabelle mit Datenbalken.
function laenderZeichnen() {
  const laender = zustand.daten.laender.daten;
  zeichnen("balken-laender", (el) => balken(el, laender.slice(0, 10), { kategorie: "land", wert: "anzahl", format: zahl, aktiv: zustand.filter.land, beiKlick: (d) => filterSetzen("land", d.land) }),
    "Top-10-Herkunftsländer nach Anzahl Buchungen");
  tabelleZeichnen(laender);
}

// Zeichnet ein Diagramm in seinen Kasten und setzt den Aussage-Titel darüber.
function zeichnen(id, bauen, titel) {
  const kasten = document.getElementById(id);
  const ueberschrift = kasten.parentElement.querySelector("h3");
  if (ueberschrift && titel) ueberschrift.textContent = titel;
  kasten.replaceChildren(bauen(kasten));
}

// ---------------------------------------------------------------------------
// Tabelle, Export, SQL
// ---------------------------------------------------------------------------

const SPALTEN = [
  ["land", "Land", (d) => d.land, false],
  ["anzahl", "Buchungen", (d) => zahl(d.anzahl), true],
  ["naechte", "Zimmernächte", (d) => zahl(d.naechte), true],
  ["erloes", "Erlös (EUR)", (d) => zahl(d.erloes), true],
  ["stornoquote", "Stornoquote", (d) => prozent(d.stornoquote), true],
  ["adr", "Ø ADR", (d) => dezimal(d.adr), true],
];

// Tabelle aller Länder; Klick auf eine Spaltenüberschrift sortiert, Balken zeigen den Anteil am Maximum.
function tabelleZeichnen(laender) {
  const { spalte, absteigend } = zustand.sortierung;
  const sortiert = [...laender].sort((a, b) => {
    const [x, y] = [a[spalte], b[spalte]];
    const ergebnis = typeof x === "string" ? x.localeCompare(y) : x - y;
    return absteigend ? -ergebnis : ergebnis;
  });
  const maximum = d3.max(laender, (d) => d[spalte]) || 1;
  const tabelle = document.getElementById("tabelle-laender");
  const kopf = SPALTEN.map(([name, titel, , numerisch]) =>
    `<th class="${numerisch ? "zahl" : ""}${name === spalte ? " sortiert" : ""}" data-spalte="${name}">${titel}${name === spalte ? (absteigend ? " ▾" : " ▴") : ""}</th>`).join("");
  const zeilen = sortiert.map((d) => "<tr" + (d.land === zustand.filter.land ? ' class="aktiv"' : "") + ` data-land="${d.land}">`
    + SPALTEN.map(([name, , format, numerisch]) => {
      const balken = numerisch && name === spalte ? `<span class="datenbalken" style="width:${(100 * d[name]) / maximum}%"></span>` : "";
      return `<td class="${numerisch ? "zahl" : ""}">${balken}<span class="wert">${format(d)}</span></td>`;
    }).join("") + "</tr>").join("");
  tabelle.innerHTML = `<thead><tr>${kopf}</tr></thead><tbody>${zeilen}</tbody>`;
  tabelle.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
    const name = th.dataset.spalte;
    zustand.sortierung = { spalte: name, absteigend: name === spalte ? !absteigend : name !== "land" };
    tabelleZeichnen(laender);
  }));
  tabelle.querySelectorAll("tbody tr").forEach((tr) => tr.addEventListener("click", () => filterSetzen("land", tr.dataset.land)));
  document.getElementById("tabelle-hinweis").textContent = `${laender.length} Länder im gefilterten Bestand · Klick auf eine Zeile filtert, Klick auf eine Überschrift sortiert`;
}

// Lädt die Ländertabelle als CSV herunter (deutsches Format: Semikolon, Komma als Dezimalzeichen).
function csvExport() {
  const laender = zustand.daten.laender.daten;
  const zeilen = [["land", "buchungen", "zimmernaechte", "erloes", "stornoquote", "adr"].join(";")];
  for (const d of laender) zeilen.push([d.land, d.anzahl, d.naechte, d.erloes, d.stornoquote, d.adr].map((w) => String(w).replace(".", ",")).join(";"));
  const datei = new Blob(["﻿" + zeilen.join("\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(datei);
  link.download = "herkunftslaender.csv";
  link.click();
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
  knopf.textContent = "Link kopiert";
  setTimeout(() => (knopf.textContent = "Link kopieren"), 2000);
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

// Verbindet die Bedienelemente und lädt die Daten.
async function start() {
  zustand.filter = filterAusAdresse();
  document.querySelectorAll("#filterleiste select, #filterleiste input").forEach((feld) =>
    feld.addEventListener("change", () => filterSetzen(feld.name, feld.value)));
  document.getElementById("zuruecksetzen").addEventListener("click", filterZuruecksetzen);
  document.getElementById("csv").addEventListener("click", csvExport);
  document.getElementById("link").addEventListener("click", (e) => linkKopieren(e.target));
  let zeitgeber = null;
  window.addEventListener("resize", () => { clearTimeout(zeitgeber); zeitgeber = setTimeout(() => zustand.daten.kennzahlen && allesZeichnen(), 250); });
  await startdatenLaden();
  await allesLaden();
}

start();
