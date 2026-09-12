// Eine sortierbare, gruppierbare Tabelle mit Datenbalken.
//
// spalten: [{ feld, titel, format, numerisch, balken, klasse, aggregat }]
//   aggregat: Funktion (zeilen) -> Wert für Gruppenzeilen; fehlt sie, bleibt die Zelle leer.
// optionen: { sortierung: {feld, absteigend}, gruppierung: feldname | null,
//             aktiv: (zeile) -> bool, beiKlick: (zeile) -> void, beiSortierung: (sortierung) -> void }

// Baut die Tabelle in das table-Element; Klick auf den Kopf sortiert, Gruppen erhalten Summenzeilen.
function tabelleBauen(tabelle, spalten, zeilen, o) {
  const { feld, absteigend } = o.sortierung;
  const sortiere = (liste) => [...liste].sort((a, b) => {
    const [x, y] = [a[feld], b[feld]];
    const ergebnis = typeof x === "string" ? x.localeCompare(y, "de") : (x ?? -Infinity) - (y ?? -Infinity);
    return absteigend ? -ergebnis : ergebnis;
  });
  const maxima = Object.fromEntries(spalten.filter((s) => s.balken).map((s) => [s.feld, d3.max(zeilen, (z) => z[s.feld]) || 1]));

  const kopf = spalten.map((s) =>
    `<th class="spalte-${s.feld}${s.numerisch ? " zahl" : ""}${s.feld === feld ? " sortiert" : ""}" data-feld="${s.feld}">${s.titel}${s.feld === feld ? (absteigend ? " ▾" : " ▴") : ""}</th>`).join("");

  const zelle = (s, zeile, mitBalken) => {
    const wert = zeile[s.feld];
    const balken = mitBalken && s.balken && wert != null
      ? `<span class="datenbalken${s.klasse ? " " + s.klasse : ""}" style="width:${Math.max(0, (100 * wert) / maxima[s.feld])}%"></span>` : "";
    const text = s.zeichnen ? "" : `<span class="wert">${wert == null ? "" : s.format(wert, zeile)}</span>`;
    return `<td class="spalte-${s.feld}${s.numerisch ? " zahl" : ""}${s.lang ? " text-lang" : ""}">${balken}${text}</td>`;
  };
  const datenzeile = (zeile) => `<tr class="${o.beiKlick ? "klickbar" : ""}${o.aktiv?.(zeile) ? " aktiv" : ""}" data-index="${zeile.__index}">`
    + spalten.map((s) => zelle(s, zeile, true)).join("") + "</tr>";

  zeilen.forEach((z, i) => (z.__index = i));
  let koerper = "";
  if (o.gruppierung) {
    const gruppen = d3.groups(zeilen, (z) => z[o.gruppierung]);
    const summen = gruppen.map(([name, glieder]) => {
      const summe = { [o.gruppierung]: name, __gruppe: true };
      for (const s of spalten) summe[s.feld] = s.aggregat ? s.aggregat(glieder) : (s.feld === o.gruppierung ? name : null);
      return [summe, glieder];
    });
    const sortiert = sortiere(summen.map(([summe]) => summe));
    for (const summe of sortiert) {
      const glieder = summen.find(([s]) => s === summe)[1];
      koerper += `<tr class="gruppe">` + spalten.map((s) => zelle(s, summe, false)).join("") + "</tr>";
      koerper += sortiere(glieder).map(datenzeile).join("");
    }
  } else {
    koerper = sortiere(zeilen).map(datenzeile).join("");
  }
  tabelle.innerHTML = `<thead><tr>${kopf}</tr></thead><tbody>${koerper}</tbody>`;

  // Zellen, die eine Grafik statt Text zeigen (Sparklines)
  for (const s of spalten.filter((s) => s.zeichnen)) {
    const spaltenIndex = spalten.indexOf(s);
    tabelle.querySelectorAll("tbody tr[data-index]").forEach((tr) => {
      const zeile = zeilen[Number(tr.dataset.index)];
      const grafik = s.zeichnen(zeile);
      if (grafik) { const halter = document.createElement("span"); halter.className = "sparkline"; halter.append(grafik); tr.children[spaltenIndex].append(halter); }
    });
  }

  tabelle.querySelectorAll("th").forEach((th) => th.addEventListener("click", () => {
    const neu = th.dataset.feld;
    const numerisch = spalten.find((s) => s.feld === neu)?.numerisch;
    o.beiSortierung({ feld: neu, absteigend: neu === feld ? !absteigend : Boolean(numerisch) });
  }));
  if (o.beiKlick) tabelle.querySelectorAll("tbody tr[data-index]").forEach((tr) => tr.addEventListener("click", () => o.beiKlick(zeilen[Number(tr.dataset.index)])));
}

// Aggregate für Gruppenzeilen: Summe eines Feldes bzw. Quote aus zwei Summen.
const summe = (feld) => (zeilen) => d3.sum(zeilen, (z) => z[feld]);
const quote = (zaehler, nenner) => (zeilen) => { const n = d3.sum(zeilen, (z) => z[nenner]); return n ? d3.sum(zeilen, (z) => z[zaehler]) / n : null; };
