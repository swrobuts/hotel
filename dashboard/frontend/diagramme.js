// Ein Diagramm je Funktion, gezeichnet mit Observable Plot.
//
// Gestaltungsregeln (Tufte, Few, Hichert): wenig Tinte, die keine Daten trägt;
// eine Farbe für Mengen (Grau), eine für Stornierungen (Rotbraun), eine für die
// aktive Auswahl (Petrol); Werte stehen direkt am Balken statt auf einer Achse;
// Linien enden mit ihrer Beschriftung statt in einer Legende.

const FARBE = {
  tinte: "#1b1b1b",     // Text und Achsen
  grau: "#6b6b6b",      // Beschriftungen zweiter Ordnung
  balken: "#5a5a5a",    // Mengen und Beträge
  storno: "#a84b2f",    // alles, was Stornierungen misst
  akzent: "#20808d",    // die aktive Auswahl
  vergleich: "#b4b4b4", // zweite Reihe in Liniendiagrammen
  raster: "#e6e6e6",
};

// Breite des Diagramms aus der Breite seines Kastens (für schmale Bildschirme).
function breiteVon(element, mindestens = 280) {
  return Math.max(mindestens, element.clientWidth || 560);
}

// Macht die gezeichneten Elemente eines Marks anklickbar; beiKlick bekommt die Datenzeile.
function klickbar(daten, beiKlick) {
  return (index, scales, values, dimensions, context, next) => {
    const gruppe = next(index, scales, values, dimensions, context);
    const elemente = gruppe.querySelectorAll("rect, circle, path");
    index.forEach((i, k) => {
      const element = elemente[k];
      if (!element) return;
      element.style.cursor = "pointer";
      element.addEventListener("click", () => beiKlick(daten[i]));
    });
    return gruppe;
  };
}

// Waagerechte Balken, absteigend sortiert, Wert am Balkenende, aktive Auswahl hervorgehoben.
// wert: Feldname der Zahl, kategorie: Feldname der Beschriftung, format: Funktion für den Text.
function balken(element, daten, { kategorie, wert, format, farbe = FARBE.balken, aktiv, beiKlick, referenz }) {
  const sortiert = [...daten].sort((a, b) => b[wert] - a[wert]);
  const laengste = Math.max(...sortiert.map((d) => String(d[kategorie]).length), 4);
  const marks = [
    Plot.barX(sortiert, {
      x: wert, y: kategorie, sort: { y: "-x" },
      fill: (d) => (aktiv != null && d[kategorie] === aktiv ? FARBE.akzent : farbe),
      render: klickbar(sortiert, beiKlick),
    }),
    Plot.text(sortiert, { x: wert, y: kategorie, text: (d) => format(d[wert]), dx: 6, textAnchor: "start", fill: FARBE.grau }),
  ];
  if (referenz != null) {
    marks.push(Plot.ruleX([referenz], { stroke: FARBE.tinte, strokeDasharray: "3,3" }));
    marks.push(Plot.text([referenz], { x: referenz, frameAnchor: "top", dy: -6, text: () => "Gesamt " + format(referenz), fill: FARBE.tinte, fontSize: 11 }));
  }
  return Plot.plot({
    width: breiteVon(element), height: 30 * sortiert.length + 40,
    marginLeft: Math.min(150, 8 + laengste * 7), marginRight: 70, marginTop: referenz != null ? 22 : 8,
    x: { axis: null, domain: [0, Math.max(...sortiert.map((d) => d[wert])) * 1.18] },
    y: { label: null, tickSize: 0 },
    style: { fontSize: "12px", color: FARBE.tinte },
    marks,
  });
}

// Zeitreihe je Monat mit einer Linie je Reihe (z. B. je Hotel); Beschriftung am Linienende.
// reihen: Feldname der Reihe, wert: Feldname der Zahl, klickMonat: Funktion(datum).
function linien(element, daten, { reihe, wert, format, klickMonat, farben = {} }) {
  const reihenNamen = [...new Set(daten.map((d) => d[reihe]))];
  const farbe = (d) => farben[d[reihe]] || FARBE.balken;
  const letzte = reihenNamen.map((name) => daten.filter((d) => d[reihe] === name).at(-1)).filter(Boolean);
  return Plot.plot({
    width: breiteVon(element), height: 260, marginRight: 130, marginLeft: 62,
    x: { label: null, tickFormat: (d) => monatstext(d), ticks: "6 months" },
    y: { label: null, grid: true, tickFormat: (d) => kurz(d), nice: true, zero: true },
    style: { fontSize: "12px", color: FARBE.tinte },
    marks: [
      Plot.ruleY([0], { stroke: FARBE.raster }),
      Plot.lineY(daten, { x: "datum", y: wert, z: reihe, stroke: farbe, strokeWidth: 1.6 }),
      Plot.dot(daten, { x: "datum", y: wert, z: reihe, r: 5, fill: farbe, fillOpacity: 0, stroke: "none", render: klickbar(daten, (d) => klickMonat(d.datum)) }),
      Plot.text(letzte, { x: "datum", y: wert, text: (d) => d[reihe] + " " + format(d[wert]), dx: 8, textAnchor: "start", fill: farbe, fontSize: 11 }),
      Plot.tip(daten, Plot.pointerX({ x: "datum", y: wert, z: reihe, title: (d) => monatstext(d.datum) + "\n" + d[reihe] + ": " + format(d[wert]) })),
    ],
  });
}

// Zwölf Monate auf der x-Achse, eine Linie je Jahr; zeigt die Saisonalität.
function saisonlinien(element, daten, { wert, format, klickMonat }) {
  const jahre = [...new Set(daten.map((d) => d.jahr))].sort();
  const graustufen = { 2015: "#b4b4b4", 2016: "#6b6b6b", 2017: "#1b1b1b" };
  const letzte = jahre.map((jahr) => daten.filter((d) => d.jahr === jahr).at(-1));
  return Plot.plot({
    width: breiteVon(element), height: 260, marginRight: 60, marginLeft: 62,
    x: { label: null, domain: [1, 12], ticks: 12, tickFormat: (m) => MONATE_KURZ[m - 1] },
    y: { label: null, grid: true, tickFormat: (d) => kurz(d), nice: true, zero: true },
    style: { fontSize: "12px", color: FARBE.tinte },
    marks: [
      Plot.lineY(daten, { x: "monat", y: wert, z: "jahr", stroke: (d) => graustufen[d.jahr] || FARBE.balken, strokeWidth: 1.6 }),
      Plot.dot(daten, { x: "monat", y: wert, z: "jahr", r: 5, fill: FARBE.tinte, fillOpacity: 0, stroke: "none", render: klickbar(daten, (d) => klickMonat(monatsdatum(d.jahr, d.monat))) }),
      Plot.text(letzte, { x: "monat", y: wert, text: (d) => String(d.jahr), fill: (d) => graustufen[d.jahr], fontSize: 12,
        dx: (d) => (d.monat === 12 ? 8 : 0), dy: (d) => (d.monat === 12 ? 0 : -12), textAnchor: (d) => (d.monat === 12 ? "start" : "middle") }),
      Plot.tip(daten, Plot.pointerX({ x: "monat", y: wert, z: "jahr", title: (d) => MONATE_LANG[d.monat - 1] + " " + d.jahr + ": " + format(d[wert]) })),
    ],
  });
}

// Small Multiples: je Kundentyp ein Feld, darin Balken je Marktsegment mit gemeinsamer Skala.
function kleineVielfache(element, daten, { aktivSegment, beiKlick }) {
  const segmente = [...new Set(daten.map((d) => d.segment))];
  const summen = Object.fromEntries(segmente.map((s) => [s, d3.sum(daten.filter((d) => d.segment === s), (d) => d.anzahl)]));
  const reihenfolge = segmente.sort((a, b) => summen[b] - summen[a]);
  const maximum = d3.max(daten, (d) => d.anzahl) || 1;
  return Plot.plot({
    width: breiteVon(element), height: 26 * reihenfolge.length + 70, marginLeft: 110, marginRight: 20, marginTop: 30,
    facet: { data: daten, x: "kundentyp", label: null },
    fx: { label: null, padding: 0.12, tickSize: 0 },
    x: { axis: null, domain: [0, maximum * 1.45] },
    y: { label: null, domain: reihenfolge, tickSize: 0 },
    style: { fontSize: "12px", color: FARBE.tinte },
    marks: [
      Plot.barX(daten, {
        x: "anzahl", y: "segment", fx: "kundentyp",
        fill: (d) => (d.segment === aktivSegment ? FARBE.akzent : FARBE.balken),
        render: klickbar(daten, beiKlick),
      }),
      Plot.text(daten, { x: "anzahl", y: "segment", fx: "kundentyp", text: (d) => kurz(d.anzahl), dx: 4, textAnchor: "start", fill: FARBE.grau, fontSize: 10 }),
    ],
  });
}

// Choroplethenkarte der Herkunftsländer (ISO-3); fehlende Länder bleiben hell.
function karte(element, laender, welt, { aktiv, beiKlick }) {
  const werte = new Map(laender.map((d) => [d.land === "CN" ? "CHN" : d.land, d]));
  const staaten = topojson.feature(welt, welt.objects.countries).features;
  const maximum = d3.max(laender, (d) => d.anzahl) || 1;
  const skala = d3.scaleSequentialSqrt([0, maximum], d3.interpolateRgb("#e9eef0", "#20808d"));
  return Plot.plot({
    width: breiteVon(element), height: breiteVon(element) * 0.5,
    projection: { type: "equal-earth", rotate: [-10, 0] },
    marks: [
      Plot.geo(staaten, {
        fill: (d) => (aktiv != null && d.id === aktiv ? "#a84b2f" : werte.has(d.id) ? skala(werte.get(d.id).anzahl) : "#f3f3f3"),
        stroke: "#ffffff", strokeWidth: 0.4,
        title: (d) => (werte.has(d.id) ? d.properties.name + ": " + zahl(werte.get(d.id).anzahl) + " Buchungen" : d.properties.name),
        render: klickbar(staaten, (d) => { if (werte.has(d.id)) beiKlick(werte.get(d.id)); }),
      }),
      Plot.sphere({ stroke: FARBE.raster }),
    ],
  });
}

// Winzige Linie ohne Achsen für die Kennzahlkacheln; der letzte Punkt ist markiert.
function sparkline(werte, farbe = FARBE.balken) {
  const punkte = werte.map((wert, i) => ({ i, wert }));
  return Plot.plot({
    width: 120, height: 32, margin: 3, axis: null,
    marks: [
      Plot.lineY(punkte, { x: "i", y: "wert", stroke: farbe, strokeWidth: 1.2 }),
      Plot.dot(punkte.slice(-1), { x: "i", y: "wert", r: 2.2, fill: farbe }),
    ],
  });
}
