// Ein Diagramm je Funktion, gezeichnet mit Observable Plot.
//
// Regeln (Tufte, Few, Hichert/IBCS, Bissantz): wenig Tinte ohne Daten; Werte
// direkt am Balken; Zeit waagerecht als Säulen, Struktur senkrecht als Balken;
// gleiche Skalen, wo verglichen wird; eine Farbe je Bedeutung: Grau für Mengen
// und Beträge, Rotbraun für Stornierungen, Petrol für die aktive Auswahl,
// Blau/Rot nur als Signal "besser/schlechter" im Vergleich zum Vorjahresmonat.

const FARBE = {
  tinte: "#1b1b1b",
  grau: "#6f6f6f",
  balken: "#5f5f5f",
  balkenHell: "#c4c4c4",
  storno: "#a84b2f",
  stornoHell: "#dcb3a3",
  akzent: "#20808d",
  raster: "#e6e6e6",
  fuehrung: "#cfcfcf",
  besser: "#2f7fbf",   // Signal: betriebswirtschaftlich besser als der Vergleichswert
  schlechter: "#c8412b", // Signal: schlechter
};

const schmal = () => window.innerWidth < 600;
// Alle Balkendiagramme teilen sich diese Beschriftungsbreite, damit Balken und
// Werte über die Seite hinweg in einer Flucht stehen.
const BESCHRIFTUNG = () => (schmal() ? 140 : 250);
const WERTSPALTE = () => (schmal() ? 64 : 84);

// Breite des Diagramms aus der Breite seines Kastens (für schmale Bildschirme).
function breiteVon(element, mindestens = 280) {
  return Math.max(mindestens, element.clientWidth || 800);
}

// Kürzt lange Beschriftungen auf schmalen Bildschirmen.
function kurzerName(text) {
  const grenze = schmal() ? 18 : 40;
  return text.length > grenze ? text.slice(0, grenze - 1) + "…" : text;
}

// Macht die gezeichneten Elemente eines Marks anklickbar; beiKlick bekommt die Datenzeile.
function klickbar(daten, beiKlick) {
  return (index, scales, values, dimensions, context, next) => {
    const gruppe = next(index, scales, values, dimensions, context);
    const elemente = gruppe.querySelectorAll("rect, circle, path");
    index.forEach((i, k) => {
      const element = elemente[k];
      if (!element || !beiKlick) return;
      element.style.cursor = "pointer";
      element.addEventListener("click", () => beiKlick(daten[i]));
    });
    return gruppe;
  };
}

// Vorzeichenbehaftete Prozentänderung als Text: +3,2 % / −1,8 %.
function abweichungText(anteil) {
  if (anteil == null || !isFinite(anteil)) return "–";
  return (anteil > 0 ? "+" : anteil < 0 ? "−" : "±") + prozent(Math.abs(anteil));
}

// Farbe eines Signals: besser = blau, schlechter = rot; "hoeherBesser" sagt, welche Richtung gut ist.
function signalFarbe(anteil, hoeherBesser) {
  if (anteil == null || !isFinite(anteil) || anteil === 0 || hoeherBesser == null) return FARBE.grau;
  const besser = hoeherBesser ? anteil > 0 : anteil < 0;
  return besser ? FARBE.besser : FARBE.schlechter;
}

// Waagerechte Balken, absteigend sortiert, Wert am Balkenende, Führungslinie je Zeile,
// aktive Auswahl in Petrol. Optionen: kategorie, wert, format, klarname, farbe, aktiv,
// beiKlick, referenz (gestrichelte Linie mit Text "insgesamt"), domain, sortieren, tipp(d) -> Text.
function balken(element, daten, o) {
  const zeilen = o.sortieren === false ? [...daten] : [...daten].sort((a, b) => b[o.wert] - a[o.wert]);
  const maximum = o.domain ? o.domain[1] : Math.max(...zeilen.map((d) => d[o.wert])) * 1.12;
  const name = (d) => (o.klarname ? o.klarname(d[o.kategorie]) : String(d[o.kategorie]));
  const marks = [
    Plot.ruleY(zeilen, { y: o.kategorie, x1: 0, x2: maximum, stroke: FARBE.fuehrung, strokeDasharray: "1,3" }),
    Plot.barX(zeilen, {
      x: o.wert, y: o.kategorie,
      fill: (d) => (o.aktiv != null && d[o.kategorie] === o.aktiv ? FARBE.akzent : (o.farbeVon ? o.farbeVon(d) : o.farbe || FARBE.balken)),
      title: o.tipp, render: klickbar(zeilen, o.beiKlick),
    }),
    Plot.text(zeilen, { x: o.wert, y: o.kategorie, text: (d) => o.format(d[o.wert]) + (o.zusatz ? o.zusatz(d) : ""), dx: 6, textAnchor: "start", fill: FARBE.grau, fontSize: 12.5 }),
  ];
  if (o.referenz != null) {
    marks.push(Plot.ruleX([o.referenz], { stroke: FARBE.tinte, strokeDasharray: "4,3" }));
    marks.push(Plot.text([o.referenz], { x: o.referenz, frameAnchor: "top", dy: -9, text: () => "insgesamt " + o.format(o.referenz), fill: FARBE.tinte, fontSize: 11.5, textAnchor: "middle" }));
  }
  if (o.tipp) marks.push(Plot.tip(zeilen, Plot.pointerY({ x: o.wert, y: o.kategorie, title: o.tipp })));
  return Plot.plot({
    width: breiteVon(element), height: 32 * zeilen.length + (o.referenz != null ? 36 : 14),
    marginLeft: BESCHRIFTUNG(), marginRight: WERTSPALTE(), marginTop: o.referenz != null ? 26 : 4, marginBottom: 10,
    x: { axis: null, domain: [0, maximum] },
    y: { label: null, tickSize: 0, tickPadding: 10, domain: zeilen.map((d) => d[o.kategorie]), tickFormat: (k) => kurzerName(o.klarname ? o.klarname(k) : String(k)) },
    style: { fontSize: "13px", color: FARBE.tinte },
    marks,
  });
}

// Säulen je Monat mit Versatzstück zum Vorjahresmonat (IBCS): liegt der Wert über dem
// Vorjahresmonat, ist der Überschuss blau, sonst ist der Fehlbetrag rot – bei Kennzahlen,
// deren Anstieg gut ist. Für "niedriger ist besser" (Stornoquote) sind die Farben getauscht.
// daten: [{datum, wert, vorjahr, vormonat, imFilter}]; Optionen: format, hoeherBesser, achse, hoehe, klickMonat, tipp.
function saeulen(element, daten, o) {
  // Die Säule zeigt immer den Ist-Wert. Liegt er über dem Vorjahresmonat, ist der
  // Teil oberhalb des Vorjahreswerts farbig gefüllt; liegt er darunter, zeigt ein
  // farbiger Umriss über der Säule den Fehlbetrag bis zum Vorjahreswert.
  const istBesser = (d) => (o.hoeherBesser ? d.wert >= d.vorjahr : d.wert <= d.vorjahr);
  const farbe = (d) => (istBesser(d) ? FARBE.besser : FARBE.schlechter);
  const mitVorjahr = daten.filter((d) => d.vorjahr != null && d.wert !== d.vorjahr);
  const ueberschuss = mitVorjahr.filter((d) => d.wert > d.vorjahr);
  const fehlbetrag = mitVorjahr.filter((d) => d.wert < d.vorjahr);
  const deckkraft = (d) => (d.imFilter === false ? 0.35 : 1);
  const bereich = [d3.min(daten, (d) => d.datum), d3.utcMonth.offset(d3.max(daten, (d) => d.datum), 1)];
  return Plot.plot({
    width: breiteVon(element), height: o.hoehe || 210, marginLeft: schmal() ? 60 : 72, marginRight: 16, marginTop: 10, marginBottom: o.achse ? 28 : 6,
    x: { label: null, domain: bereich, axis: o.achse ? "bottom" : null, tickFormat: (d) => monatstext(d), ticks: "6 months" },
    y: { label: null, grid: true, tickFormat: (d) => o.format(d), nice: true, zero: true, ticks: 4 },
    style: { fontSize: "12px", color: FARBE.tinte },
    marks: [
      Plot.rectY(daten, { x: "datum", interval: "month", y1: 0, y2: "wert", fill: FARBE.balken, fillOpacity: deckkraft, insetLeft: 1.5, insetRight: 1.5,
        render: klickbar(daten, (d) => o.klickMonat && o.klickMonat(d.datum)) }),
      Plot.rectY(ueberschuss, { x: "datum", interval: "month", y1: "vorjahr", y2: "wert", fill: farbe, fillOpacity: deckkraft, insetLeft: 1.5, insetRight: 1.5 }),
      Plot.rectY(fehlbetrag, { x: "datum", interval: "month", y1: "wert", y2: "vorjahr", fill: farbe, fillOpacity: 0.18, stroke: farbe, strokeWidth: 1.2, strokeOpacity: deckkraft, insetLeft: 1.5, insetRight: 1.5 }),
      Plot.ruleY([0], { stroke: FARBE.grau }),
      Plot.tip(daten, Plot.pointerX({ x: "datum", y: "wert", title: o.tipp })),
    ],
  });
}

// Gestapelte Säulen je Monat: unten der realisierte Erlös (grau), oben der durch
// Stornierung verlorene (rotbraun). daten: [{datum, realisiert, storniert, imFilter}].
function gestapelteSaeulen(element, daten, o) {
  const bereich = [d3.min(daten, (d) => d.datum), d3.utcMonth.offset(d3.max(daten, (d) => d.datum), 1)];
  const deckkraft = (d) => (d.imFilter === false ? 0.35 : 1);
  return Plot.plot({
    width: breiteVon(element), height: 260, marginLeft: schmal() ? 60 : 72, marginRight: 16, marginTop: 10, marginBottom: 28,
    x: { label: null, domain: bereich, tickFormat: (d) => monatstext(d), ticks: "6 months" },
    y: { label: null, grid: true, tickFormat: (d) => kurz(d), nice: true, zero: true, ticks: 4 },
    style: { fontSize: "12px", color: FARBE.tinte },
    marks: [
      Plot.rectY(daten, { x: "datum", interval: "month", y1: 0, y2: "realisiert", fill: FARBE.balken, fillOpacity: deckkraft, insetLeft: 1.5, insetRight: 1.5,
        render: klickbar(daten, (d) => o.klickMonat && o.klickMonat(d.datum)) }),
      Plot.rectY(daten, { x: "datum", interval: "month", y1: "realisiert", y2: (d) => d.realisiert + d.storniert, fill: FARBE.storno, fillOpacity: deckkraft, insetLeft: 1.5, insetRight: 1.5 }),
      Plot.ruleY([0], { stroke: FARBE.grau }),
      Plot.tip(daten, Plot.pointerX({ x: "datum", y: (d) => d.realisiert + d.storniert, title: o.tipp })),
    ],
  });
}

// Zwölf Monate auf der x-Achse, eine Linie je Jahr in Graustufen; Saisonverlauf im Jahresvergleich.
function saisonlinien(element, daten, o) {
  const jahre = [...new Set(daten.map((d) => d.jahr))].sort();
  const graustufen = { 2015: "#b4b4b4", 2016: "#6f6f6f", 2017: "#1b1b1b" };
  const letzte = jahre.map((jahr) => daten.filter((d) => d.jahr === jahr).at(-1));
  return Plot.plot({
    width: breiteVon(element), height: 280, marginRight: 50, marginLeft: schmal() ? 60 : 64, marginTop: 16,
    x: { label: null, domain: [1, 12], ticks: schmal() ? 6 : 12, tickFormat: (m) => MONATE_KURZ[m - 1], tickSize: 0 },
    y: { label: null, grid: true, tickFormat: (d) => kurz(d), nice: true, zero: true, ticks: 4 },
    style: { fontSize: "12px", color: FARBE.tinte },
    marks: [
      Plot.lineY(daten, { x: "monat", y: o.wert, z: "jahr", stroke: (d) => graustufen[d.jahr] || FARBE.balken, strokeWidth: 1.6 }),
      Plot.dot(daten, { x: "monat", y: o.wert, z: "jahr", r: 5, fill: FARBE.tinte, fillOpacity: 0, stroke: "none", render: klickbar(daten, (d) => o.klickMonat(monatsdatum(d.jahr, d.monat))) }),
      Plot.text(letzte, { x: "monat", y: o.wert, text: (d) => String(d.jahr), fill: (d) => graustufen[d.jahr], fontSize: 12, stroke: "#fff", strokeWidth: 4,
        dx: (d) => (d.monat === 12 ? 8 : 0), dy: (d) => (d.monat === 12 ? 0 : -12), textAnchor: (d) => (d.monat === 12 ? "start" : "middle") }),
      Plot.tip(daten, Plot.pointerX({ x: "monat", y: o.wert, z: "jahr", title: o.tipp || ((d) => MONATE_LANG[d.monat - 1] + " " + d.jahr + ": " + o.format(d[o.wert])) })),
    ],
  });
}

// Winzige Säulen ab null für Kacheln und Tabellenzeilen: gleiche Zeitachse für alle,
// Skala je Kennzahl von null bis zum Maximum; der Bezugsmonat ist dunkel, Monate außerhalb des Filters hell.
function minisaeulen(daten, o = {}) {
  const farbe = (d) => (d.bezug ? (o.farbe || FARBE.tinte) : d.imFilter === false ? FARBE.balkenHell : (o.farbe || FARBE.balken));
  return Plot.plot({
    width: o.breite || 150, height: o.hoehe || 34, marginLeft: 2, marginRight: 2, marginTop: 2, marginBottom: 2, axis: null,
    x: { domain: [d3.min(daten, (d) => d.datum), d3.utcMonth.offset(d3.max(daten, (d) => d.datum), 1)] },
    y: { domain: [0, d3.max(daten, (d) => d.wert) || 1] },
    marks: [Plot.rectY(daten, { x: "datum", interval: "month", y1: 0, y2: "wert", fill: farbe, insetLeft: 0.6, insetRight: 0.6, title: (d) => monatstext(d.datum) + ": " + (o.format || zahl)(d.wert) })],
  });
}
