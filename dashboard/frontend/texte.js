// Leitsätze, Aussagen, Interpretationen und Handlungsempfehlungen.
//
// Jede Funktion bekommt den Datenkontext `d` und formuliert kurze Sätze; alle
// Zahlen kommen aus den Daten. Kürzel des Datensatzes werden über klarname()
// in Klarnamen übersetzt.

const groesster = (liste, feld) => d3.greatest(liste, (z) => z[feld]);
const kleinster = (liste, feld) => d3.least(liste, (z) => z[feld]);
const anteil = (teil, ganz) => (ganz ? prozent(teil / ganz) : "–");
const liste = (teile) => (teile.length <= 1 ? teile.join("") : teile.slice(0, -1).join(", ") + " und " + teile.at(-1));
const monatLang = (m) => MONATE_LANG[m.monat - 1] + " " + m.jahr;
// Text nur, wenn die Bedingung gilt; als Funktion übergeben, damit er nicht vorab ausgewertet wird.
const wenn = (bedingung, text) => (bedingung ? (typeof text === "function" ? text() : text) : "");

// Nennt die Kategorie, deren Umsatzanteil am stärksten vom Buchungsanteil abweicht (mindestens 2 Prozentpunkte).
function abweicher(zeilen, dimension) {
  const gesamtAnzahl = d3.sum(zeilen, (z) => z.anzahl), gesamtUmsatz = d3.sum(zeilen, (z) => z.erloes_nicht_storniert);
  const mitDelta = zeilen.map((z) => ({ ...z, delta: z.erloes_nicht_storniert / gesamtUmsatz - z.anzahl / gesamtAnzahl }));
  const groesster = d3.greatest(mitDelta, (z) => Math.abs(z.delta));
  if (!groesster || Math.abs(groesster.delta) < 0.02) return "";
  return ` – ${klarname(dimension, groesster[dimension])} bringt ${groesster.delta > 0 ? "mehr" : "weniger"} Umsatz als Buchungen (${dezimal1(Math.abs(groesster.delta) * 100)} Prozentpunkte)`;
}

// ---------------------------------------------------------------------------
// Leitsätze der Abschnitte
// ---------------------------------------------------------------------------

function leadUeberblick(d) {
  const k = d.kennzahlen;
  if (!k.anzahl_buchungen) return "Keine Buchungen für diese Filterkombination.";
  return `${kurz(k.erloes_nicht_storniert)} EUR stornobereinigter Umsatz aus ${zahl(k.anzahl_buchungen)} Buchungen, ${prozent(k.stornoquote)} storniert.`;
}

function leadZeit(d) {
  const m = d.monateImFilter;
  if (m.length < 2) return "Für einen Zeitverlauf braucht es mindestens zwei Monate.";
  const spitze = groesster(m, "anzahl_buchungen"), tief = kleinster(m, "anzahl_buchungen");
  return `Stärkster Monat ${monatLang(spitze)} (${zahl(spitze.anzahl_buchungen)} Buchungen), schwächster ${monatLang(tief)} (${zahl(tief.anzahl_buchungen)}).`;
}

function leadVertrieb(d) {
  const s = d.segmente, gesamt = d3.sum(s, (z) => z.anzahl);
  if (!s.length) return "Keine Buchungen im gewählten Ausschnitt.";
  const kanal = groesster(d.kanaele, "erloes_nicht_storniert");
  return `${klarname("segment", s[0].segment)}: ${anteil(s[0].anzahl, gesamt)} der Buchungen. Größter Umsatzkanal: ${klarname("kanal", kanal.kanal)} (${anteil(kanal.erloes_nicht_storniert, d3.sum(d.kanaele, (z) => z.erloes_nicht_storniert))}).`;
}

function leadStorno(d) {
  const k = d.kennzahlen, vl = d.vorlauf, kaution = d.kautionen.length ? groesster(d.kautionen, "stornoquote") : null;
  if (!k.anzahl_buchungen) return "Keine Buchungen im gewählten Ausschnitt.";
  return `${prozent(k.stornoquote)} storniert, ${kurz(k.erloes_storniert)} EUR durch Stornierung entgangener Umsatz.`
    + `${wenn(kaution, () => ` ${klarname("kaution", kaution.kaution)}: ${prozent(kaution.stornoquote)}`)}${wenn(vl.length > 1, () => `, Vorlaufzeit ${klarname("vorlaufzeit", vl.at(-1).vorlaufzeit)}: ${prozent(vl.at(-1).stornoquote)}.`)}`;
}

function leadHerkunft(d) {
  const l = d.laender, gesamt = d3.sum(l, (z) => z.anzahl);
  if (!l.length) return "Keine Buchungen im gewählten Ausschnitt.";
  const inland = l.find((z) => z.land === "PRT");
  return `${klarname("land", l[0].land)}: ${anteil(l[0].anzahl, gesamt)} der Gäste aus ${l.length} Ländern.`
    + `${wenn(inland, () => ` Stornoquote Inland ${prozent(inland.stornoquote)}, Ausland ${prozent(d.stornoAusland)}.`)}`;
}

// ---------------------------------------------------------------------------
// Aussage (Überschrift) und Beschreibung je Figur
// ---------------------------------------------------------------------------

function aussagen(d) {
  const k = d.kennzahlen, m = d.monateImFilter, leer = !k.anzahl_buchungen;
  const spitze = m.length ? groesster(m, "anzahl_buchungen") : null;
  const erloesSpitze = m.length ? groesster(m, "erloes_nicht_storniert") : null;
  const top = d.segmente[0], kanal = d.kanaele.length ? groesster(d.kanaele, "erloes_nicht_storniert") : null;
  const nonRefund = d.kautionen.find((z) => z.kaution === "Non Refund");
  const vl = d.vorlauf, land = d.laender[0];
  const gesamtLaender = d3.sum(d.laender, (z) => z.anzahl);
  const verlust = m.length ? groesster(m, "erloes_storniert") : null;
  const beschreibung = (messgroesse) => `${messgroesse} · ${d.zeitraumText}${d.filterText ? " · " + d.filterText : ""}`;
  const hv = d.hotelvergleich, city = hv.City, resort = hv.Resort;
  return {
    kennzahlen: [leer ? "Keine Buchungen im gewählten Ausschnitt" : city && resort
      ? `${city.anzahl_buchungen > resort.anzahl_buchungen ? "City Hotel" : "Resort Hotel"} hat mehr Buchungen, ${city.adr > resort.adr ? "City Hotel" : "Resort Hotel"} den höheren Zimmerpreis, ${city.stornoquote < resort.stornoquote ? "City Hotel" : "Resort Hotel"} die niedrigere Stornoquote`
      : `${zahl(k.anzahl_buchungen)} Buchungen, ${prozent(k.stornoquote)} storniert, ${dezimal(k.adr)} EUR mittlerer Zimmerpreis`,
      beschreibung("Die zehn Kennzahlen des Katalogs je Hotel und für beide zusammen, mit Verlauf je Anreisemonat und Abweichung zum Vormonat und Vorjahresmonat")],
    zeitverlauf: [spitze ? `${monatLang(spitze)} war der stärkste Anreisemonat: ${zahl(spitze.anzahl_buchungen)} Buchungen${erloesSpitze ? `; höchster Umsatz im ${monatLang(erloesSpitze)} (${kurz(erloesSpitze.erloes_nicht_storniert)} EUR)` : ""}` : "Kein Zeitverlauf verfügbar",
      beschreibung("Anzahl Buchungen, stornobereinigter Umsatz in EUR und Stornoquote je Anreisemonat; Versatzstück = Abweichung zum Vorjahresmonat")],
    segment: [top ? `${klarname("segment", top.segment)}: ${anteil(top.anzahl, d3.sum(d.segmente, (z) => z.anzahl))} der Buchungen, ${anteil(top.erloes_nicht_storniert, d3.sum(d.segmente, (z) => z.erloes_nicht_storniert))} des Umsatzes${abweicher(d.segmente, "segment")}` : "Keine Buchungen",
      beschreibung("Je Marktsegment der Anteil an den Buchungen neben dem Anteil am stornobereinigten Umsatz, gleiche Skala, absolute Werte in Klammern")],
    kanal: [kanal ? `${klarname("kanal", kanal.kanal)}: ${anteil(kanal.erloes_nicht_storniert, d3.sum(d.kanaele, (z) => z.erloes_nicht_storniert))} des Umsatzes bei ${anteil(kanal.anzahl, d3.sum(d.kanaele, (z) => z.anzahl))} der Buchungen${abweicher(d.kanaele, "kanal")}` : "Keine Buchungen",
      beschreibung("Je Vertriebskanal der Anteil an den Buchungen neben dem Anteil am stornobereinigten Umsatz, gleiche Skala, absolute Werte in Klammern")],
    pivot: [d.pivotTop ? `${klarname("kundentyp", d.pivotTop.kundentyp)} sind der häufigste Kundentyp – ${anteil(d.pivotTop.anzahl, d3.sum(d.pivot, (z) => z.anzahl))} der Buchungen` : "Keine Buchungen",
      beschreibung("Anzahl Buchungen je Marktsegment (Zeilen) und Kundentyp (Spalten), Balken relativ zum Spaltenmaximum")],
    storno: [vl.length > 1 ? `Stornorisiko steigt mit der Vorlaufzeit: ${prozent(vl[0].stornoquote)} bei ${klarname("vorlaufzeit", vl[0].vorlaufzeit)}n, ${prozent(vl.at(-1).stornoquote)} bei ${klarname("vorlaufzeit", vl.at(-1).vorlaufzeit)}n${nonRefund ? ` – nicht erstattbare Buchungen ${prozent(nonRefund.stornoquote)}` : ""}` : "Keine Stornodaten",
      beschreibung("Stornoquote = Anteil stornierter Buchungen, je Hotel, Kautionstyp, Marktsegment und Vorlaufzeit")],
    erloesverlust: [k.anzahl_buchungen ? `${kurz(k.erloes_storniert)} EUR (${anteil(k.erloes_storniert, k.gesamterloes)} des gebuchten Umsatzes) gingen durch Stornierungen verloren${verlust ? `, am meisten im ${monatLang(verlust)}` : ""}` : "Keine Daten",
      beschreibung("Gebuchter Umsatz je Anreisemonat in EUR, aufgeteilt in stornobereinigten Umsatz und durch Stornierung entgangenen Umsatz")],
    laender: [land ? `${klarname("land", land.land)} stellt ${anteil(land.anzahl, gesamtLaender)} der Gäste, die fünf größten Länder ${anteil(d3.sum(d.laender.slice(0, 5), (z) => z.anzahl), gesamtLaender)}` : "Keine Buchungen",
      beschreibung("Anzahl Buchungen je Herkunftsland, die 15 größten einzeln, die übrigen zusammengefasst")],
    laendertabelle: [d.laender.length ? `${d.laender.length} Herkunftsländer im Vergleich – Buchungen, Nächte, Umsatz, Stornoquote und Zimmerpreis` : "Keine Buchungen",
      beschreibung("Alle Herkunftsländer; Sortierung per Klick auf die Spalte, Gruppierung nach Hotel mit Zwischensummen")],
  };
}

// ---------------------------------------------------------------------------
// Interpretation und Handlungsempfehlung je Figur
// ---------------------------------------------------------------------------

function deutungen(d) {
  const k = d.kennzahlen, m = d.monateImFilter;
  const spitze = m.length ? groesster(m, "anzahl_buchungen") : null, tief = m.length ? kleinster(m, "anzahl_buchungen") : null;
  const erloesSpitze = m.length ? groesster(m, "erloes_nicht_storniert") : null;
  const stornoSpitze = m.length ? groesster(m, "stornoquote") : null, stornoTief = m.length ? kleinster(m, "stornoquote") : null;
  const hv = d.hotelvergleich, city = hv.City, resort = hv.Resort;
  const s = d.segmente, segGesamt = d3.sum(s, (z) => z.anzahl), top = s[0];
  const groups = s.find((z) => z.segment === "Groups"), direct = s.find((z) => z.segment === "Direct");
  const kan = d.kanaele, kanGesamt = d3.sum(kan, (z) => z.erloes_nicht_storniert), directK = kan.find((z) => z.kanal === "Direct"), topK = kan.length ? groesster(kan, "erloes_nicht_storniert") : null;
  const nonRefund = d.kautionen.find((z) => z.kaution === "Non Refund"), noDeposit = d.kautionen.find((z) => z.kaution === "No Deposit");
  const vl = d.vorlauf, segStorno = s.length ? groesster(s, "stornoquote") : null;
  const l = d.laender, lGesamt = d3.sum(l, (z) => z.anzahl), prt = l.find((z) => z.land === "PRT"), top5 = l.slice(0, 5);
  const jahre = d3.groups(m, (z) => z.jahr).map(([jahr, zeilen]) => ({ jahr, anzahl: d3.sum(zeilen, (z) => z.anzahl_buchungen) }));
  const j2016 = jahre.find((j) => j.jahr === 2016);
  const verlust = m.length ? groesster(m, "erloes_storniert") : null;
  const leer = !k.anzahl_buchungen;
  const T = {};

  T.kennzahlen = leer ? ["Keine Buchungen im gewählten Ausschnitt.", "Filter lockern."] : [
    `${wenn(city && resort, () => `Das City Hotel hat ${anteil(city.anzahl_buchungen, city.anzahl_buchungen + resort.anzahl_buchungen)} der Buchungen und ${city.stornoquote > resort.stornoquote ? "die höhere" : "die niedrigere"} Stornoquote (${prozent(city.stornoquote)} gegenüber ${prozent(resort.stornoquote)}); `
      + `das Resort Hotel hat ${resort.aufenthaltsdauer > city.aufenthaltsdauer ? "längere" : "kürzere"} Aufenthalte (${dezimal(resort.aufenthaltsdauer)} gegenüber ${dezimal(city.aufenthaltsdauer)} Nächte) und ${resort.adr > city.adr ? "den höheren" : "den niedrigeren"} Zimmerpreis (${dezimal(resort.adr)} gegenüber ${dezimal(city.adr)} EUR). `)}`
    + `Gäste buchen im Mittel ${dezimal1(k.vorlaufzeit)} Tage im Voraus für ${dezimal(k.aufenthaltsdauer)} Nächte; nur ${prozent(k.wiederholungsgaeste)} sind Wiederholungsgäste.`,
    `Ein Prozentpunkt weniger Stornierungen entspricht etwa ${zahl(k.gesamterloes / 100)} EUR gebuchtem Umsatz – die Stornoquote ist der größte Hebel. `
    + `${wenn(city && resort, () => `Die Hotels nicht über einen Kamm scheren: Stornoregeln und Überbuchung am ${city.stornoquote > resort.stornoquote ? "City" : "Resort"} Hotel schärfer, Preis- und Paketpolitik an der Saison des jeweiligen Hauses ausrichten. `)}`
    + `Der geringe Anteil an Wiederholungsgästen spricht für ein Bindungsprogramm.`,
  ];

  T.zeitverlauf = m.length < 2 ? ["Zu wenige Monate für eine Interpretation.", "Zeitraum erweitern."] : [
    `Buchungen zwischen ${zahl(tief.anzahl_buchungen)} (${monatLang(tief)}) und ${zahl(spitze.anzahl_buchungen)} (${monatLang(spitze)}); `
    + `der Umsatz ist im ${monatLang(erloesSpitze)} am höchsten (${kurz(erloesSpitze.erloes_nicht_storniert)} EUR). `
    + `Blaue Versatzstücke zeigen Verbesserungen gegenüber dem Vorjahresmonat, rote Verschlechterungen. Die Stornoquote schwankt zwischen ${prozent(stornoTief.stornoquote)} und ${prozent(stornoSpitze.stornoquote)}.`,
    `Planung an der Saisonkurve ausrichten; Prognosen auf 2016 stützen, das einzige vollständige Jahr. Überbuchung am Monatswert der Stornoquote kalibrieren; Tiefmonate über Preis und Pakete stützen statt Hochsaison zu rabattieren.`,
  ];

  T.segment = !top ? ["Keine Daten.", "–"] : [
    `${klarname("segment", top.segment)}: ${anteil(top.anzahl, segGesamt)} der Buchungen. Liegt der Umsatzanteil eines Segments über seinem Buchungsanteil, zahlt es überdurchschnittliche Zimmerpreise, bleibt länger oder storniert seltener. ${wenn(direct, () => `Direktbuchungen: ${anteil(direct.anzahl, segGesamt)}. `)}`
    + `${wenn(groups, () => `Gruppen (${anteil(groups.anzahl, segGesamt)}) sind zahlenmäßig klein, aber mit ${prozent(groups.stornoquote)} Stornoquote das riskanteste Segment.`)}`,
    `Abhängigkeit von Online-Reisebüros verringern: Direktbuchungen mit Vorteilen fördern, die es nur über die eigene Seite gibt. ${wenn(groups, "Gruppen nur mit gestaffelten Anzahlungen annehmen.")}`,
  ];

  T.kanal = !topK ? ["Keine Daten.", "–"] : [
    `${klarname("kanal", topK.kanal)}: ${anteil(topK.erloes_nicht_storniert, kanGesamt)} des Umsatzes${wenn(directK, () => `, Direktvertrieb ${anteil(directK.erloes_nicht_storniert, kanGesamt)}`)}. `
    + `Umsatz = Zimmerpreis × Nächte der nicht stornierten Buchungen; die Stornoquoten je Kanal stehen in der Stornoanalyse.`,
    `Direktvertriebsanteil als Kennzahl führen; Provisionen je Kanal dem Umsatz gegenüberstellen und den Nettobeitrag steuern, nicht den Umsatz.`,
  ];

  T.pivot = !d.pivotTop ? ["Keine Daten.", "–"] : [
    `${klarname("kundentyp", d.pivotTop.kundentyp)} stellen ${anteil(d.pivotTop.anzahl, d3.sum(d.pivot, (z) => z.anzahl))} der Buchungen; Einzelreisende in Gruppe konzentrieren sich auf Gruppen- und Offline-Segmente, Vertragskunden sind selten.`,
    `Einzelreisende über Online-Kanäle und Preisdifferenzierung ansprechen; Reisegruppen und Vertragskunden über Rahmenvereinbarungen mit fester Kontingent- und Stornoregel.`,
  ];

  T.storno = !vl.length ? ["Keine Daten.", "–"] : [
    `${wenn(city && resort, () => `Das City Hotel storniert häufiger als das Resort Hotel (${prozent(city.stornoquote)} gegenüber ${prozent(resort.stornoquote)}). `)}`
    + `${wenn(nonRefund, () => `Nicht erstattbare Buchungen werden zu ${prozent(nonRefund.stornoquote)} storniert${wenn(noDeposit, () => ` – ohne Anzahlung sind es ${prozent(noDeposit.stornoquote)}`)}; das ist fachlich unplausibel und als Eigenheit der Datenquelle bekannt (vermutlich Sammelbuchungen, die nach Nichterscheinen storniert wurden). `)}`
    + `${wenn(segStorno, () => `Nach Marktsegment ist das Risiko bei ${klarname("segment", segStorno.segment)} am höchsten (${prozent(segStorno.stornoquote)}). `)}`
    + `Mit der Vorlaufzeit steigt die Quote von ${prozent(vl[0].stornoquote)} auf ${prozent(vl.at(-1).stornoquote)}: Je früher gebucht, desto eher wird storniert.`,
    `Stornobedingungen nach Vorlaufzeit staffeln (lange Vorlaufzeit nur mit Anzahlung), vor der Anreise rückbestätigen, Überbuchung an den Quoten je Segment ausrichten. Die Quote der nicht erstattbaren Buchungen mit der Buchungsabteilung klären – ein Daten- oder Prozessproblem, keine Gästeentscheidung.`,
  ];

  T.erloesverlust = leer ? ["Keine Daten.", "–"] : [
    `Von ${kurz(k.gesamterloes)} EUR gebuchtem Umsatz wurden ${kurz(k.erloes_nicht_storniert)} EUR Umsatz erzielt; ${kurz(k.erloes_storniert)} EUR gingen durch Stornierungen verloren (${anteil(k.erloes_storniert, k.gesamterloes)}). `
    + `${wenn(verlust, () => `Der größte Verlust fiel im ${monatLang(verlust)} an (${kurz(verlust.erloes_storniert)} EUR) – in der Hochsaison wiegt jede Stornierung am schwersten.`)}`,
    `Den durch Stornierung entgangenen Umsatz je Monat als Kennzahl führen und mit der Überbuchungsquote gegensteuern; stornierte Zimmer der Hochsaison über Wartelisten und kurzfristige Angebote nachbelegen.`,
  ];

  T.laender = !l.length ? ["Keine Daten.", "–"] : [
    `${top5.map((z) => `${klarname("land", z.land)} ${anteil(z.anzahl, lGesamt)}`).join(", ")} – zusammen ${anteil(d3.sum(top5, (z) => z.anzahl), lGesamt)}; die übrigen ${Math.max(0, l.length - 5)} Länder ${anteil(d3.sum(l.slice(5), (z) => z.anzahl), lGesamt)}. `
    + `${wenn(prt, () => `Portugiesische Gäste stornieren mit ${prozent(prt.stornoquote)} deutlich häufiger als ausländische (${prozent(d.stornoAusland)}); der Inlandsmarkt ist groß, aber unzuverlässig.`)}`,
    `Stornobedingungen nach Markt differenzieren (Inland strenger); Marketingbudget auf Länder mit hohem Umsatz je Buchung und niedriger Stornoquote lenken.`,
  ];

  T.laendertabelle = !l.length ? ["Keine Daten.", "–"] : [
    `Sortierung nach Stornoquote zeigt die riskanten Märkte, nach Zimmerpreis die zahlungskräftigen, nach Zimmernächten die aufenthaltsstarken; die Gruppierung nach Hotel zeigt, dass dieselben Länder in City und Resort unterschiedlich buchen.`,
    `Märkte nach Nettobeitrag (Umsatz je Buchung und Stornoquote) bewerten, nicht nach Volumen.`,
  ];
  return T;
}
