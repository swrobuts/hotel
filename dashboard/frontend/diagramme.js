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
  const breite = Math.min(breiteVon(element), o.maxBreite || 960);
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
    width: breite, height: 32 * zeilen.length + (o.referenz != null ? 36 : 14),
    marginLeft: BESCHRIFTUNG(), marginRight: WERTSPALTE(), marginTop: o.referenz != null ? 26 : 4, marginBottom: 10,
    x: { axis: null, domain: [0, maximum] },
    y: { label: null, tickSize: 0, tickPadding: 10, domain: zeilen.map((d) => d[o.kategorie]), tickFormat: (k) => kurzerName(o.klarname ? o.klarname(k) : String(k)) },
    style: { fontSize: "13px", color: FARBE.tinte },
    marks,
  });
}

// Zwei Anteile je Kategorie nebeneinander (z. B. Anteil an den Buchungen und Anteil am
// Umsatz), gleiche Zeilen, gleiche Prozentskala, absolute Werte in Klammern.
// daten: [{kategorie, anteil1, absolut1, anteil2, absolut2, ...}]; Optionen: kategorie, titel1, titel2,
// format1, format2 (für die absoluten Werte), klarname, aktiv, beiKlick, tipp.
function balkenPaar(element, daten, o) {
  const zeilen = [...daten].sort((a, b) => b.anteil1 - a.anteil1);
  const lang = zeilen.flatMap((z) => [
    { ...z, mass: o.titel1, anteil: z.anteil1, absolut: o.format1(z.absolut1) },
    { ...z, mass: o.titel2, anteil: z.anteil2, absolut: o.format2(z.absolut2) },
  ]);
  const maximum = d3.max(lang, (d) => d.anteil) || 1;
  const name = (k) => (o.klarname ? o.klarname(k) : String(k));
  return Plot.plot({
    width: breiteVon(element), height: 32 * zeilen.length + 44,
    marginLeft: BESCHRIFTUNG(), marginRight: 16, marginTop: 30, marginBottom: 10,
    facet: { data: lang, x: "mass", label: null },
    fx: { domain: [o.titel1, o.titel2], padding: 0.12, tickSize: 0, axis: "top", tickPadding: 8 },
    x: { axis: null, domain: [0, maximum * 1.55] },
    y: { label: null, tickSize: 0, tickPadding: 10, domain: zeilen.map((z) => z[o.kategorie]), tickFormat: (k) => kurzerName(name(k)) },
    style: { fontSize: "13px", color: FARBE.tinte },
    marks: [
      Plot.ruleY(lang, { y: o.kategorie, x1: 0, x2: maximum * 1.55, stroke: FARBE.fuehrung, strokeDasharray: "1,3" }),
      Plot.barX(lang, { x: "anteil", y: o.kategorie, fill: (d) => (o.aktiv != null && d[o.kategorie] === o.aktiv ? FARBE.akzent : FARBE.balken), title: o.tipp, render: klickbar(lang, o.beiKlick) }),
      Plot.text(lang, { x: "anteil", y: o.kategorie, text: (d) => prozent0(d.anteil) + "  (" + d.absolut + ")", dx: 6, textAnchor: "start", fill: FARBE.grau, fontSize: 12.5 }),
      Plot.tip(lang, Plot.pointerY({ x: "anteil", y: o.kategorie, title: o.tipp })),
    ],
  });
}

// Gemeinsame Zeitachse für Säulendiagramme: Ticks je Quartal, Januar mit Jahreszahl.
function zeitachse(bereich) {
  const erster = +bereich[0];
  return {
    label: null, domain: bereich, ticks: schmal() ? d3.utcMonth.every(6) : d3.utcMonth.every(3), tickSize: 4,
    tickFormat: (d) => (d.getUTCMonth() === 0 || +d === erster ? MONATE_KURZ[d.getUTCMonth()] + " " + d.getUTCFullYear() : MONATE_KURZ[d.getUTCMonth()]),
  };
}

// Abstand zwischen den Säulen: die Säule nimmt etwa 55 % ihres Monatsfelds ein.
function saeulenabstand(breite, anzahl, rand) {
  const feld = (breite - rand) / Math.max(anzahl, 1);
  return Math.max(2, feld * 0.22);
}

// Trennlinien und Jahreszahlen an den Jahresgrenzen als Führung.
function jahresmarken(bereich) {
  return d3.utcYears(bereich[0], bereich[1]);
}

// Hebt Beschriftungen über die höhere Nachbarsäule, damit sie keine Säule überdecken;
// liegt die Beschriftung höher als die eigene Säule, verbindet eine dünne Linie beide.
function beschriftungenHeben(daten, beschriftet, oben) {
  return beschriftet.map((d) => {
    const i = daten.indexOf(d);
    const nachbarn = [daten[i - 1], d, daten[i + 1]].filter(Boolean);
    const hoehe = d3.max(nachbarn, oben);
    return { ...d, __eigene: oben(d), __hoehe: hoehe, __mitte: d3.utcMonth.offset(d.datum, 0.5), __text: null };
  });
}

// Die beiden Marks für gehobene Beschriftungen: Hinweislinie und Text.
function beschriftungsMarks(gehoben, format) {
  return [
    Plot.ruleX(gehoben.filter((d) => d.__hoehe > d.__eigene), { x: "__mitte", y1: "__eigene", y2: "__hoehe", stroke: FARBE.fuehrung }),
    Plot.text(gehoben, { x: "__mitte", y: "__hoehe", dy: -8, text: (d) => format(d), fill: FARBE.tinte, fontSize: 11.5, textAnchor: "middle", stroke: "#fff", strokeWidth: 3 }),
  ];
}

// Säulen je Monat mit Versatzstück zum Vorjahresmonat (IBCS). Die Säule zeigt immer den
// Ist-Wert. Liegt er über dem Vorjahresmonat, ist der Teil oberhalb des Vorjahreswerts
// gefüllt; liegt er darunter, zeigt ein Umriss über der Säule den Fehlbetrag bis zum
// Vorjahreswert. Blau = betriebswirtschaftlich besser, Rot = schlechter.
// daten: [{datum, wert, vorjahr, vormonat, imFilter, bezug}]; Optionen: format, hoeherBesser, hoehe, klickMonat, tipp.
function saeulen(element, daten, o) {
  const istBesser = (d) => (o.hoeherBesser ? d.wert >= d.vorjahr : d.wert <= d.vorjahr);
  const farbe = (d) => (istBesser(d) ? FARBE.besser : FARBE.schlechter);
  const mitVorjahr = daten.filter((d) => d.vorjahr != null && d.wert !== d.vorjahr);
  const ueberschuss = mitVorjahr.filter((d) => d.wert > d.vorjahr);
  const fehlbetrag = mitVorjahr.filter((d) => d.wert < d.vorjahr);
  const deckkraft = (d) => (d.imFilter === false ? 0.35 : 1);
  const bereich = [d3.min(daten, (d) => d.datum), d3.utcMonth.offset(d3.max(daten, (d) => d.datum), 1)];
  const breite = breiteVon(element), links = schmal() ? 56 : 72, rechts = 24;
  const inset = saeulenabstand(breite, daten.length, links + rechts);
  // Beschriftet werden erster Monat, Minimum, Maximum und Bezugsmonat.
  const beschriftet = [...new Set([daten[0], d3.least(daten, (d) => d.wert), d3.greatest(daten, (d) => d.wert), daten.find((d) => d.bezug)].filter(Boolean))];
  const oben = (d) => (d.vorjahr != null ? Math.max(d.wert, d.vorjahr) : d.wert);
  const gehoben = beschriftungenHeben(daten, beschriftet, oben);
  return Plot.plot({
    width: breite, height: o.hoehe || 230, marginLeft: links, marginRight: rechts, marginTop: 28, marginBottom: 30,
    x: { ...zeitachse(bereich), insetLeft: 14, insetRight: 6 },
    y: { label: null, grid: true, tickFormat: (d) => o.format(d), nice: true, zero: true, ticks: 4, tickSize: 0 },
    style: { fontSize: "12px", color: FARBE.grau },
    marks: [
      Plot.ruleX(jahresmarken(bereich), { stroke: FARBE.fuehrung, strokeDasharray: "2,3" }),
      Plot.rectY(daten, { x: "datum", interval: "month", y1: 0, y2: "wert", fill: FARBE.balken, fillOpacity: deckkraft, insetLeft: inset, insetRight: inset,
        render: klickbar(daten, (d) => o.klickMonat && o.klickMonat(d.datum)) }),
      Plot.rectY(ueberschuss, { x: "datum", interval: "month", y1: "vorjahr", y2: "wert", fill: farbe, fillOpacity: deckkraft, insetLeft: inset, insetRight: inset }),
      Plot.rectY(fehlbetrag, { x: "datum", interval: "month", y1: "wert", y2: "vorjahr", fill: farbe, fillOpacity: 0.15, stroke: farbe, strokeWidth: 1.2, strokeOpacity: deckkraft, insetLeft: inset, insetRight: inset }),
      ...beschriftungsMarks(gehoben, (d) => o.format(d.wert)),
      Plot.ruleY([0], { stroke: FARBE.grau }),
      Plot.tip(daten, Plot.pointerX({ x: "datum", y: "wert", title: o.tipp })),
    ],
  });
}

// Gestapelte Säulen je Monat: unten der realisierte Betrag (grau), oben der durch
// Stornierung entgangene (rotbraun). daten: [{datum, realisiert, storniert, imFilter}].
function gestapelteSaeulen(element, daten, o) {
  const bereich = [d3.min(daten, (d) => d.datum), d3.utcMonth.offset(d3.max(daten, (d) => d.datum), 1)];
  const deckkraft = (d) => (d.imFilter === false ? 0.35 : 1);
  const breite = breiteVon(element), links = schmal() ? 56 : 72, rechts = 24;
  const inset = saeulenabstand(breite, daten.length, links + rechts);
  const gesamt = (d) => d.realisiert + d.storniert;
  const beschriftet = [...new Set([daten[0], d3.least(daten, gesamt), d3.greatest(daten, gesamt), daten.find((d) => d.bezug) || daten.at(-1)].filter(Boolean))];
  const gehoben = beschriftungenHeben(daten, beschriftet, gesamt);
  return Plot.plot({
    width: breite, height: 280, marginLeft: links, marginRight: rechts, marginTop: 28, marginBottom: 30,
    x: { ...zeitachse(bereich), insetLeft: 14, insetRight: 6 },
    y: { label: null, grid: true, tickFormat: (d) => kurz(d), nice: true, zero: true, ticks: 4, tickSize: 0 },
    style: { fontSize: "12px", color: FARBE.grau },
    marks: [
      Plot.ruleX(jahresmarken(bereich), { stroke: FARBE.fuehrung, strokeDasharray: "2,3" }),
      Plot.rectY(daten, { x: "datum", interval: "month", y1: 0, y2: "realisiert", fill: FARBE.balken, fillOpacity: deckkraft, insetLeft: inset, insetRight: inset,
        render: klickbar(daten, (d) => o.klickMonat && o.klickMonat(d.datum)) }),
      Plot.rectY(daten, { x: "datum", interval: "month", y1: "realisiert", y2: (d) => d.realisiert + d.storniert, fill: FARBE.storno, fillOpacity: deckkraft, insetLeft: inset, insetRight: inset }),
      ...beschriftungsMarks(gehoben, (d) => kurz(gesamt(d))),
      Plot.ruleY([0], { stroke: FARBE.grau }),
      Plot.tip(daten, Plot.pointerX({ x: "datum", y: (d) => d.realisiert + d.storniert, title: o.tipp })),
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
