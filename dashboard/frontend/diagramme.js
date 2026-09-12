// Ein Diagramm je Funktion, gezeichnet mit Observable Plot.
//
// Regeln (Tufte, Few, Hichert, Bissantz): wenig Tinte ohne Daten; Werte direkt
// am Balken statt auf einer Achse; Linien enden mit ihrer Beschriftung; Zeit
// läuft waagerecht, Struktur steht senkrecht; gleiche Skalen, wo verglichen
// wird; eine Farbe je Bedeutung: Grau für Mengen und Beträge, Rotbraun für
// Stornierungen, Petrol für die aktive Auswahl.

const FARBE = {
  tinte: "#1b1b1b",
  grau: "#6f6f6f",
  balken: "#5f5f5f",
  balkenHell: "#b9b9b9",
  storno: "#a84b2f",
  akzent: "#20808d",
  vergleich: "#a9a9a9",
  raster: "#e6e6e6",
};

// Alle Balkendiagramme einer Seite teilen sich diese Beschriftungsbreite, damit
// Balken und Werte über die Diagramme hinweg in einer Flucht stehen.
// Auf schmalen Bildschirmen (Telefon) sind die Ränder kleiner.
const schmal = () => window.innerWidth < 600;
const BESCHRIFTUNG = () => (schmal() ? 104 : 150);
const WERTSPALTE = () => (schmal() ? 70 : 80);
const LINIENRAND = () => (schmal() ? 96 : 150);

// Breite des Diagramms aus der Breite seines Kastens (für schmale Bildschirme).
function breiteVon(element, mindestens = 280) {
  return Math.max(mindestens, element.clientWidth || 800);
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

// Waagerechte Balken, absteigend sortiert, Wert am Balkenende, aktive Auswahl in Petrol.
// Optionen: kategorie, wert, format, farbe, aktiv, beiKlick, referenz (gestrichelte Linie),
// domain (feste Skala, z. B. [0, 1] für Quoten), sortieren (Standard: absteigend nach Wert).
function balken(element, daten, o) {
  const zeilen = o.sortieren === false ? [...daten] : [...daten].sort((a, b) => b[o.wert] - a[o.wert]);
  const maximum = o.domain ? o.domain[1] : Math.max(...zeilen.map((d) => d[o.wert])) * 1.12;
  const marks = [
    Plot.barX(zeilen, {
      x: o.wert, y: o.kategorie, sort: o.sortieren === false ? undefined : { y: "-x" },
      fill: (d) => (o.aktiv != null && d[o.kategorie] === o.aktiv ? FARBE.akzent : (o.farbeVon ? o.farbeVon(d) : o.farbe || FARBE.balken)),
      render: klickbar(zeilen, o.beiKlick),
    }),
    Plot.text(zeilen, { x: o.wert, y: o.kategorie, text: (d) => o.format(d[o.wert]) + (o.zusatz ? o.zusatz(d) : ""), dx: 6, textAnchor: "start", fill: FARBE.grau, fontSize: 12.5 }),
  ];
  if (o.referenz != null) {
    marks.push(Plot.ruleX([o.referenz], { stroke: FARBE.tinte, strokeDasharray: "3,3" }));
    marks.push(Plot.text([o.referenz], { x: o.referenz, frameAnchor: "top", dy: -8, text: () => "Gesamt " + o.format(o.referenz), fill: FARBE.tinte, fontSize: 11.5, textAnchor: "middle" }));
  }
  return Plot.plot({
    width: breiteVon(element), height: 28 * zeilen.length + (o.referenz != null ? 34 : 14),
    marginLeft: BESCHRIFTUNG(), marginRight: WERTSPALTE(), marginTop: o.referenz != null ? 24 : 4, marginBottom: 10,
    x: { axis: null, domain: [0, maximum] },
    y: { label: null, tickSize: 0, tickPadding: 8, domain: o.sortieren === false ? zeilen.map((d) => d[o.kategorie]) : undefined },
    style: { fontSize: "13px", color: FARBE.tinte },
    marks,
  });
}

// Ein Feld einer gestapelten Zeitreihe: gleiche Breite und Zeitachse für alle Felder,
// je Reihe eine Linie, Beschriftung am Linienende. Nur das unterste Feld zeigt die Zeitachse.
// Optionen: reihe, wert, format, bereich ([Anfang, Ende]), farben, achse (true/false), titel, klickMonat, hoehe.
function zeitfeld(element, daten, o) {
  const reihen = [...new Set(daten.map((d) => d[o.reihe]))];
  const farbe = (d) => o.farben?.[d[o.reihe]] || FARBE.tinte;
  const letzte = reihen.map((name) => daten.filter((d) => d[o.reihe] === name).at(-1)).filter(Boolean);
  const jahresanfaenge = d3.timeYears(o.bereich[0], o.bereich[1]);
  const svg = Plot.plot({
    width: breiteVon(element), height: o.hoehe || 170, marginLeft: schmal() ? 60 : 64, marginRight: LINIENRAND(), marginTop: 12, marginBottom: o.achse ? 28 : 6,
    x: { label: null, domain: o.bereich, axis: o.achse ? "bottom" : null, tickFormat: (d) => monatstext(d), ticks: "6 months" },
    y: { label: null, grid: true, tickFormat: (d) => o.format(d), nice: true, zero: true, ticks: 3 },
    style: { fontSize: "12px", color: FARBE.tinte },
    marks: [
      Plot.ruleX(jahresanfaenge, { stroke: FARBE.raster }),
      Plot.lineY(daten, { x: "datum", y: o.wert, z: o.reihe, stroke: farbe, strokeWidth: 1.6 }),
      Plot.dot(daten, { x: "datum", y: o.wert, z: o.reihe, r: 5, fill: FARBE.tinte, fillOpacity: 0, stroke: "none", render: klickbar(daten, (d) => o.klickMonat(d.datum)) }),
      Plot.text(letzte, { x: "datum", y: o.wert, text: (d) => (reihen.length > 1 ? (schmal() ? d[o.reihe].replace(" Hotel", "") : d[o.reihe]) + " " : "") + o.format(d[o.wert]), dx: 8, textAnchor: "start",
        fill: farbe, fontSize: 11.5, stroke: "#fff", strokeWidth: 4, className: "endbeschriftung" }),
      Plot.tip(daten, Plot.pointerX({ x: "datum", y: o.wert, z: o.reihe, title: (d) => monatstext(d.datum) + "\n" + d[o.reihe] + ": " + o.format(d[o.wert]) })),
    ],
  });
  beschriftungenEntzerren(svg, letzte.map((d) => d[o.wert]));
  return svg;
}

// Schiebt Beschriftungen am Linienende auseinander, wenn sie sich überlappen würden.
function beschriftungenEntzerren(svg, werte, mindestabstand = 14) {
  const skala = svg.scale("y");
  const texte = [...svg.querySelectorAll("g.endbeschriftung text")];
  if (!skala || texte.length < 2) return;
  const lagen = texte.map((t, i) => ({ t, y: skala.apply(werte[i]) })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < lagen.length; i++) {
    if (lagen[i].y - lagen[i - 1].y < mindestabstand) lagen[i].y = lagen[i - 1].y + mindestabstand;
  }
  for (const { t, y } of lagen) {
    const original = Number(t.getAttribute("y")) || 0;
    const verschiebung = y - skala.apply(werte[texte.indexOf(t)]);
    if (verschiebung) t.setAttribute("y", original + verschiebung);
  }
}

// Zwölf Monate auf der x-Achse, eine Linie je Jahr in Graustufen; Saisonverlauf im Jahresvergleich.
function saisonlinien(element, daten, o) {
  const jahre = [...new Set(daten.map((d) => d.jahr))].sort();
  const graustufen = { 2015: "#b4b4b4", 2016: "#6f6f6f", 2017: "#1b1b1b" };
  const letzte = jahre.map((jahr) => daten.filter((d) => d.jahr === jahr).at(-1));
  return Plot.plot({
    width: breiteVon(element), height: 280, marginRight: 50, marginLeft: schmal() ? 50 : 64, marginTop: 16,
    x: { label: null, domain: [1, 12], ticks: schmal() ? 6 : 12, tickFormat: (m) => MONATE_KURZ[m - 1], tickSize: 0 },
    y: { label: null, grid: true, tickFormat: (d) => kurz(d), nice: true, zero: true, ticks: 4 },
    style: { fontSize: "12px", color: FARBE.tinte },
    marks: [
      Plot.lineY(daten, { x: "monat", y: o.wert, z: "jahr", stroke: (d) => graustufen[d.jahr] || FARBE.balken, strokeWidth: 1.6 }),
      Plot.dot(daten, { x: "monat", y: o.wert, z: "jahr", r: 5, fill: FARBE.tinte, fillOpacity: 0, stroke: "none", render: klickbar(daten, (d) => o.klickMonat(monatsdatum(d.jahr, d.monat))) }),
      Plot.text(letzte, { x: "monat", y: o.wert, text: (d) => String(d.jahr), fill: (d) => graustufen[d.jahr], fontSize: 12, stroke: "#fff", strokeWidth: 4,
        dx: (d) => (d.monat === 12 ? 8 : 0), dy: (d) => (d.monat === 12 ? 0 : -12), textAnchor: (d) => (d.monat === 12 ? "start" : "middle") }),
      Plot.tip(daten, Plot.pointerX({ x: "monat", y: o.wert, z: "jahr", title: (d) => MONATE_LANG[d.monat - 1] + " " + d.jahr + ": " + o.format(d[o.wert]) })),
    ],
  });
}

// Winzige Linie ohne Achsen für Tabellenzeilen; Minimum und Maximum stehen als Zahlen daneben.
function sparkline(werte, farbe = FARBE.balken) {
  const punkte = werte.map((wert, i) => ({ i, wert }));
  return Plot.plot({
    width: 120, height: 26, margin: 3, axis: null,
    marks: [
      Plot.lineY(punkte, { x: "i", y: "wert", stroke: farbe, strokeWidth: 1.2 }),
      Plot.dot(punkte.slice(-1), { x: "i", y: "wert", r: 2.2, fill: farbe }),
    ],
  });
}
