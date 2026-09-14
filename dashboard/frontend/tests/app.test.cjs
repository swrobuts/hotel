const assert = require("node:assert/strict");
const { test, afterEach } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const frontend = path.join(__dirname, "..");
const offen = [];
afterEach(() => { offen.splice(0).forEach((dom) => dom.window.close()); });
function dashboard() {
  const dom = new JSDOM(fs.readFileSync(path.join(frontend, "index.html"), "utf8"), {
    url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true,
  });
  offen.push(dom);
  const w = dom.window;
  for (const [name, file] of [["d3", "d3.min.js"], ["@observablehq/plot", "plot.umd.min.js"]]) {
    w.eval(fs.readFileSync(path.resolve(path.dirname(require.resolve(name)), "../dist", file), "utf8"));
  }
  w.eval(["format", "laendernamen", "bezeichnungen", "diagramme", "tabelle", "texte", "app"]
    .map((name) => fs.readFileSync(path.join(frontend, name + ".js"), "utf8").replace(/\nstart\(\);\s*$/, "\n"))
    .join("\n") + "\nwindow.testZustand = zustand;");
  return { dom, w, state: w.testZustand };
}

function daten(w, storniert = false) {
  const zeile = {
    anzahl: 2, stornierungen: storniert ? 2 : 1, stornoquote: storniert ? 1 : 0.5,
    adr: 100, adr_summe: 200, erloes: 400, erloes_nicht_storniert: storniert ? null : 200,
    naechte: 4, vorlaufzeit_summe: 40, wiederholungsgaeste: 0, sonderwuensche: 0,
  };
  const antwort = (rows) => ({ daten: rows, sql: "SELECT ...", parameter: {} });
  return {
    kennzahlen: antwort([w.kennzahlenAus(zeile)]),
    monate: antwort([1, 2].map((monat) => ({ ...zeile, jahr: 2016, monat, hotel: "City Hotel" }))),
    hotels_beide: antwort([{ ...zeile, hotel: "City Hotel" }]),
    segmente: antwort([{ ...zeile, segment: "Direct" }]),
    kanaele: antwort([{ ...zeile, kanal: "Direct" }]),
    kautionen: antwort([{ ...zeile, kaution: "No Deposit" }]),
    vorlaufzeit: antwort([{ ...zeile, vorlaufzeit: "8-30" }]),
    segment_kundentyp: antwort([{ segment: "Direct", kundentyp: "Transient", hotel: "City Hotel", anzahl: 2 }]),
    laender: antwort([{ ...zeile, land: "DEU" }]),
    laender_hotel: antwort([{ ...zeile, land: "DEU", hotel: "City Hotel" }]),
  };
}

test("das Dashboard zeichnet auch bei ausschließlich stornierten Buchungen", () => {
  const { dom, w, state } = dashboard();
  state.daten = daten(w, true);
  assert.doesNotThrow(() => w.allesZeichnen());
  assert.equal(w.document.querySelectorAll(".kachel").length, 6);
  assert.doesNotMatch(w.document.body.textContent, /NaN|Infinity/);
  dom.window.close();
});

test("Filter ohne Treffer haben keinen Bezugsmonat außerhalb des Zeitraums", () => {
  const { dom, w, state } = dashboard();
  state.daten = daten(w);
  state.filter = { jahr: "2017" };
  state.daten.kennzahlen.daten = [w.kennzahlenAus({ anzahl: 0 })];
  assert.equal(w.kontextBilden().bezug, undefined);
  dom.window.close();
});

test("Filterchips behandeln Inhalte der URL als Text", () => {
  const { dom, w, state } = dashboard();
  state.filter = { hotel: '<img src="x" onerror="alert(1)">' };
  w.chipsZeichnen(["hotel"]);
  assert.equal(w.document.querySelector("#chips img"), null);
  assert.match(w.document.getElementById("chips").textContent, /<img/);
  dom.window.close();
});

test("veraltete Antworten überschreiben keine neueren Filterergebnisse", async () => {
  const { dom, w, state } = dashboard();
  const anfragen = [];
  w.holen = () => new Promise((resolve, reject) => anfragen.push({ resolve, reject }));
  let zeichnungen = 0;
  w.allesZeichnen = () => zeichnungen++;
  const alt = w.allesLaden();
  const anzahl = anfragen.length;
  const neu = w.allesLaden();
  anfragen.slice(anzahl).forEach(({ resolve }) => resolve({ stand: "neu" }));
  await neu;
  anfragen.slice(0, anzahl).forEach(({ resolve }) => resolve({ stand: "alt" }));
  await alt;
  assert.equal(state.daten.kennzahlen.stand, "neu");
  assert.equal(zeichnungen, 1);
  dom.window.close();
});

test("ein veralteter Fehler beendet nicht die Ladeanzeige der aktuellen Anfrage", async () => {
  const { dom, w } = dashboard();
  const anfragen = [];
  w.holen = () => new Promise((resolve, reject) => anfragen.push({ resolve, reject }));
  w.allesZeichnen = () => {};
  w.console.error = () => {};
  const alt = w.allesLaden(), anzahl = anfragen.length;
  const neu = w.allesLaden();
  anfragen[0].reject(new Error("alte Anfrage"));
  await alt;
  assert.equal(w.document.body.classList.contains("laedt"), true);
  assert.equal(w.document.getElementById("fehler").hidden, true);
  anfragen.slice(anzahl).forEach(({ resolve }) => resolve({}));
  await neu;
  assert.equal(w.document.body.classList.contains("laedt"), false);
  dom.window.close();
});

test("Fehler beim Start laden erscheinen im Fehlerkasten", async () => {
  const { dom, w } = dashboard();
  w.startdatenLaden = async () => { throw new Error("Filterwerte nicht verfügbar"); };
  w.console.error = () => {};
  await w.start();
  assert.equal(w.document.getElementById("fehler").hidden, false);
  assert.match(w.document.getElementById("fehler").textContent, /Filterwerte/);
  dom.window.close();
});

test("keine Treffer lassen sich ohne ungültige Diagrammkoordinaten darstellen", () => {
  const { w, state } = dashboard();
  state.daten = daten(w);
  for (const antwort of Object.values(state.daten)) antwort.daten = [];
  state.daten.kennzahlen.daten = [w.kennzahlenAus({ anzahl: 0 })];
  assert.doesNotThrow(() => w.allesZeichnen());
  assert.doesNotMatch(w.document.body.innerHTML, /NaN|Infinity/);
});

test("unbekannte Länder und fehlende Auslandsbuchungen erzeugen keine Auslandsquote", () => {
  const { w, state } = dashboard();
  state.daten = daten(w);
  state.daten.laender.daten = [
    { land: "PRT", anzahl: 10, stornierungen: 2, stornoquote: 0.2 },
    { land: "UNK", anzahl: 5, stornierungen: 5, stornoquote: 1 },
  ];
  const kontext = w.kontextBilden();
  assert.equal(kontext.stornoAusland, null);
  assert.doesNotMatch(w.leadHerkunft(kontext), /Ausland/);
});

test("fehlende Monatswerte werden nicht als Rückgang um 100 Prozent gerechnet", () => {
  const { w } = dashboard();
  const zeilen = [
    { jahr: 2016, monat: 1, adr: 100 },
    { jahr: 2016, monat: 2, adr: null },
  ];
  assert.equal(w.reihe(zeilen, "adr")[1].dVormonat, null);
});

test("Stornoaussagen gelten auch bei fallenden Quoten und nur einem Bucket", () => {
  const { w, state } = dashboard();
  state.daten = daten(w);
  const vorlauf = [{ vorlaufzeit: "0-7", stornoquote: 0.8 }, { vorlaufzeit: "90+", stornoquote: 0.2 }];
  state.daten.vorlaufzeit.daten = vorlauf;
  const kontext = w.kontextBilden();
  assert.doesNotMatch(w.aussagen(kontext).storno[0], /steigt/);
  assert.doesNotMatch(w.deutungen(kontext).storno[0], /steigt/);
  assert.match(w.aussagen(kontext).storno[0], /80,0 %.*20,0 %/);
  state.daten.vorlaufzeit.daten = vorlauf.slice(0, 1);
  assert.match(w.aussagen(w.kontextBilden()).storno[0], /80,0 %/);
});
