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
  const gesamtAnzahl = d3.sum(zeilen, (z) => z.anzahl), gesamtErloes = d3.sum(zeilen, (z) => z.erloes);
  const mitDelta = zeilen.map((z) => ({ ...z, delta: z.erloes / gesamtErloes - z.anzahl / gesamtAnzahl }));
  const groesster = d3.greatest(mitDelta, (z) => Math.abs(z.delta));
  if (!groesster || Math.abs(groesster.delta) < 0.02) return "";
  return ` – ${klarname(dimension, groesster[dimension])} bringt ${groesster.delta > 0 ? "mehr" : "weniger"} Erlös als Buchungen (${dezimal1(Math.abs(groesster.delta) * 100)} Prozentpunkte)`;
}

// ---------------------------------------------------------------------------
// Leitsätze der Abschnitte
// ---------------------------------------------------------------------------

function leadUeberblick(d) {
  const k = d.kennzahlen;
  if (!k.anzahl_buchungen) return "Keine Buchungen für diese Filterkombination.";
  return `${kurz(k.gesamterloes)} EUR Erlös aus ${zahl(k.anzahl_buchungen)} Buchungen, ${prozent(k.stornoquote)} storniert.`;
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
  const kanal = groesster(d.kanaele, "erloes");
  return `${klarname("segment", s[0].segment)}: ${anteil(s[0].anzahl, gesamt)} der Buchungen. Größter Erlöskanal: ${klarname("kanal", kanal.kanal)} (${anteil(kanal.erloes, d3.sum(d.kanaele, (z) => z.erloes))}).`;
}

function leadStorno(d) {
  const k = d.kennzahlen, vl = d.vorlauf, kaution = d.kautionen.length ? groesster(d.kautionen, "stornoquote") : null;
  if (!k.anzahl_buchungen) return "Keine Buchungen im gewählten Ausschnitt.";
  return `${prozent(k.stornoquote)} storniert, ${kurz(k.erloes_storniert)} EUR entgangener Erlös.`
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
  const erloesSpitze = m.length ? groesster(m, "gesamterloes") : null;
  const top = d.segmente[0], kanal = d.kanaele.length ? groesster(d.kanaele, "erloes") : null;
  const nonRefund = d.kautionen.find((z) => z.kaution === "Non Refund");
  const vl = d.vorlauf, land = d.laender[0];
  const gesamtLaender = d3.sum(d.laender, (z) => z.anzahl);
  const verlust = m.length ? groesster(m, "erloes_storniert") : null;
  const beschreibung = (messgroesse) => `${messgroesse} · ${d.zeitraumText}${d.filterText ? " · " + d.filterText : ""}`;
  const hv = d.hotelvergleich, city = hv.City, resort = hv.Resort;
  return {
    hotelvergleich: [city && resort
      ? `${city.anzahl_buchungen > resort.anzahl_buchungen ? "City Hotel" : "Resort Hotel"} hat mehr Buchungen, ${city.adr > resort.adr ? "City Hotel" : "Resort Hotel"} die höhere Tagesrate, ${city.stornoquote < resort.stornoquote ? "City Hotel" : "Resort Hotel"} die niedrigere Stornoquote`
      : "Hotelvergleich",
      beschreibung("Kennzahlen je Hotel und für beide Hotels zusammen")],
    kennzahlen: [leer ? "Keine Buchungen im gewählten Ausschnitt" : `${zahl(k.anzahl_buchungen)} Buchungen, ${prozent(k.stornoquote)} storniert, ${dezimal(k.adr)} EUR mittlere Tagesrate`,
      beschreibung("Die zehn Kennzahlen des Katalogs je Hotel, mit Verlauf je Anreisemonat und Abweichung zum Vormonat und Vorjahresmonat")],
    zeitverlauf: [spitze ? `${monatLang(spitze)} war der stärkste Anreisemonat: ${zahl(spitze.anzahl_buchungen)} Buchungen${erloesSpitze ? `; höchster Erlös im ${monatLang(erloesSpitze)} (${kurz(erloesSpitze.gesamterloes)} EUR)` : ""}` : "Kein Zeitverlauf verfügbar",
      beschreibung("Anzahl Buchungen, Gesamterlös in EUR und Stornoquote je Anreisemonat; Versatzstück = Abweichung zum Vorjahresmonat")],
    segment: [top ? `${klarname("segment", top.segment)}: ${anteil(top.anzahl, d3.sum(d.segmente, (z) => z.anzahl))} der Buchungen, ${anteil(top.erloes, d3.sum(d.segmente, (z) => z.erloes))} des Erlöses${abweicher(d.segmente, "segment")}` : "Keine Buchungen",
      beschreibung("Je Marktsegment der Anteil an den Buchungen neben dem Anteil am Erlös (Tagesrate × Nächte, auch stornierte Buchungen), gleiche Skala, absolute Werte in Klammern")],
    kanal: [kanal ? `${klarname("kanal", kanal.kanal)}: ${anteil(kanal.erloes, d3.sum(d.kanaele, (z) => z.erloes))} des Erlöses bei ${anteil(kanal.anzahl, d3.sum(d.kanaele, (z) => z.anzahl))} der Buchungen${abweicher(d.kanaele, "kanal")}` : "Keine Buchungen",
      beschreibung("Je Vertriebskanal der Anteil an den Buchungen neben dem Anteil am Erlös, gleiche Skala, absolute Werte in Klammern")],
    pivot: [d.pivotTop ? `${klarname("kundentyp", d.pivotTop.kundentyp)} sind der häufigste Kundentyp – ${anteil(d.pivotTop.anzahl, d3.sum(d.pivot, (z) => z.anzahl))} der Buchungen` : "Keine Buchungen",
      beschreibung("Anzahl Buchungen je Marktsegment (Zeilen) und Kundentyp (Spalten), Balken relativ zum Spaltenmaximum")],
    storno: [vl.length > 1 ? `Stornorisiko steigt mit der Vorlaufzeit: ${prozent(vl[0].stornoquote)} bei ${klarname("vorlaufzeit", vl[0].vorlaufzeit)}n, ${prozent(vl.at(-1).stornoquote)} bei ${klarname("vorlaufzeit", vl.at(-1).vorlaufzeit)}n${nonRefund ? ` – nicht erstattbare Buchungen ${prozent(nonRefund.stornoquote)}` : ""}` : "Keine Stornodaten",
      beschreibung("Stornoquote = Anteil stornierter Buchungen, je Hotel, Kautionstyp, Marktsegment und Vorlaufzeit")],
    erloesverlust: [k.anzahl_buchungen ? `${kurz(k.erloes_storniert)} EUR (${anteil(k.erloes_storniert, k.gesamterloes)} des kalkulierten Erlöses) gingen durch Stornierungen verloren${verlust ? `, am meisten im ${monatLang(verlust)}` : ""}` : "Keine Daten",
      beschreibung("Erlös je Anreisemonat in EUR, aufgeteilt in realisiert (nicht storniert) und durch Stornierung entgangen")],
    laender: [land ? `${klarname("land", land.land)} stellt ${anteil(land.anzahl, gesamtLaender)} der Gäste, die fünf größten Länder ${anteil(d3.sum(d.laender.slice(0, 5), (z) => z.anzahl), gesamtLaender)}` : "Keine Buchungen",
      beschreibung("Anzahl Buchungen je Herkunftsland, die 15 größten einzeln, die übrigen zusammengefasst")],
    laendertabelle: [d.laender.length ? `${d.laender.length} Herkunftsländer im Vergleich – Buchungen, Nächte, Erlös, Stornoquote und Tagesrate` : "Keine Buchungen",
      beschreibung("Alle Herkunftsländer; Sortierung per Klick auf die Spalte, Gruppierung nach Hotel mit Zwischensummen")],
  };
}

// ---------------------------------------------------------------------------
// Interpretation und Handlungsempfehlung je Figur
// ---------------------------------------------------------------------------

function deutungen(d) {
  const k = d.kennzahlen, m = d.monateImFilter;
  const spitze = m.length ? groesster(m, "anzahl_buchungen") : null, tief = m.length ? kleinster(m, "anzahl_buchungen") : null;
  const erloesSpitze = m.length ? groesster(m, "gesamterloes") : null;
  const stornoSpitze = m.length ? groesster(m, "stornoquote") : null, stornoTief = m.length ? kleinster(m, "stornoquote") : null;
  const hv = d.hotelvergleich, city = hv.City, resort = hv.Resort;
  const s = d.segmente, segGesamt = d3.sum(s, (z) => z.anzahl), top = s[0];
  const groups = s.find((z) => z.segment === "Groups"), direct = s.find((z) => z.segment === "Direct");
  const kan = d.kanaele, kanGesamt = d3.sum(kan, (z) => z.erloes), directK = kan.find((z) => z.kanal === "Direct"), topK = kan.length ? groesster(kan, "erloes") : null;
  const nonRefund = d.kautionen.find((z) => z.kaution === "Non Refund"), noDeposit = d.kautionen.find((z) => z.kaution === "No Deposit");
  const vl = d.vorlauf, segStorno = s.length ? groesster(s, "stornoquote") : null;
  const l = d.laender, lGesamt = d3.sum(l, (z) => z.anzahl), prt = l.find((z) => z.land === "PRT"), top5 = l.slice(0, 5);
  const jahre = d3.groups(m, (z) => z.jahr).map(([jahr, zeilen]) => ({ jahr, anzahl: d3.sum(zeilen, (z) => z.anzahl_buchungen) }));
  const j2016 = jahre.find((j) => j.jahr === 2016);
  const verlust = m.length ? groesster(m, "erloes_storniert") : null;
  const leer = !k.anzahl_buchungen;
  const T = {};

  T.hotelvergleich = !(city && resort) ? ["Für den Vergleich müssen beide Hotels Buchungen haben.", "Filter lockern."] : [
    `Das City Hotel hat ${anteil(city.anzahl_buchungen, city.anzahl_buchungen + resort.anzahl_buchungen)} der Buchungen und die höhere Stornoquote (${prozent(city.stornoquote)} gegenüber ${prozent(resort.stornoquote)}); `
    + `das Resort Hotel hat längere Aufenthalte (${dezimal(resort.aufenthaltsdauer)} gegenüber ${dezimal(city.aufenthaltsdauer)} Nächte) und ${resort.adr > city.adr ? "die höhere" : "die niedrigere"} Tagesrate (${dezimal(resort.adr)} gegenüber ${dezimal(city.adr)} EUR).`,
    `Die Hotels nicht über einen Kamm scheren: Stornoregeln und Überbuchung am City Hotel schärfer, Preis- und Paketpolitik am Resort Hotel an der Saison ausrichten.`,
  ];

  T.kennzahlen = leer ? ["Keine Buchungen im gewählten Ausschnitt.", "Filter lockern."] : [
    `${prozent(k.stornoquote)} der ${zahl(k.anzahl_buchungen)} Buchungen wurden storniert. Gäste buchen im Mittel ${dezimal1(k.vorlaufzeit)} Tage im Voraus für ${dezimal(k.aufenthaltsdauer)} Nächte; nur ${prozent(k.wiederholungsgaeste)} sind Wiederholungsgäste. `
    + `Eine Auslastung ist nicht berechenbar (keine Zimmerkapazität im Datensatz); Zimmernächte sind der Ersatzwert.`,
    `Ein Prozentpunkt weniger Stornierungen entspricht etwa ${zahl(k.gesamterloes / 100)} EUR kalkuliertem Erlös – die Stornoquote ist der größte Hebel. Der geringe Anteil an Wiederholungsgästen spricht für ein Bindungsprogramm.`,
  ];

  T.zeitverlauf = m.length < 2 ? ["Zu wenige Monate für eine Interpretation.", "Zeitraum erweitern."] : [
    `Buchungen zwischen ${zahl(tief.anzahl_buchungen)} (${monatLang(tief)}) und ${zahl(spitze.anzahl_buchungen)} (${monatLang(spitze)}); `
    + `der Erlös ist im ${monatLang(erloesSpitze)} am höchsten (${kurz(erloesSpitze.gesamterloes)} EUR). `
    + `Blaue Versatzstücke zeigen Monate über dem Vorjahresmonat, rote darunter. Die Stornoquote schwankt zwischen ${prozent(stornoTief.stornoquote)} und ${prozent(stornoSpitze.stornoquote)}.`,
    `Planung an der Saisonkurve ausrichten; Prognosen auf 2016 stützen, das einzige vollständige Jahr. Überbuchung am Monatswert der Stornoquote kalibrieren; Tiefmonate über Preis und Pakete stützen statt Hochsaison zu rabattieren.`,
  ];

  T.segment = !top ? ["Keine Daten.", "–"] : [
    `${klarname("segment", top.segment)}: ${anteil(top.anzahl, segGesamt)} der Buchungen. Liegt der Erlösanteil eines Segments über seinem Buchungsanteil, zahlt es überdurchschnittliche Tagesraten oder bleibt länger. ${wenn(direct, () => `Direktbuchungen: ${anteil(direct.anzahl, segGesamt)}. `)}`
    + `${wenn(groups, () => `Gruppen (${anteil(groups.anzahl, segGesamt)}) sind zahlenmäßig klein, aber mit ${prozent(groups.stornoquote)} Stornoquote das riskanteste Segment.`)}`,
    `Abhängigkeit von Online-Reisebüros verringern: Direktbuchungen mit Vorteilen fördern, die es nur über die eigene Seite gibt. ${wenn(groups, "Gruppen nur mit gestaffelten Anzahlungen annehmen.")}`,
  ];

  T.kanal = !topK ? ["Keine Daten.", "–"] : [
    `${klarname("kanal", topK.kanal)}: ${anteil(topK.erloes, kanGesamt)} des Erlöses${wenn(directK, () => `, Direktvertrieb ${anteil(directK.erloes, kanGesamt)}`)}. `
    + `Der Erlös ist kalkuliert (Tagesrate × Nächte) und enthält stornierte Buchungen; die Stornoquoten je Kanal stehen in der Stornoanalyse.`,
    `Direktvertriebsanteil als Kennzahl führen; Provisionen je Kanal dem Erlös gegenüberstellen und den Nettobeitrag steuern, nicht den Bruttoerlös.`,
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
    `Von ${kurz(k.gesamterloes)} EUR kalkuliertem Erlös wurden ${kurz(k.erloes_nicht_storniert)} EUR realisiert und ${kurz(k.erloes_storniert)} EUR durch Stornierungen nicht erzielt (${anteil(k.erloes_storniert, k.gesamterloes)}). `
    + `${wenn(verlust, () => `Der größte Verlust fiel im ${monatLang(verlust)} an (${kurz(verlust.erloes_storniert)} EUR) – in der Hochsaison wiegt jede Stornierung am schwersten.`)}`,
    `Den entgangenen Erlös je Monat als Kennzahl führen und mit der Überbuchungsquote gegensteuern; stornierte Zimmer der Hochsaison über Wartelisten und kurzfristige Angebote nachbelegen.`,
  ];

  T.laender = !l.length ? ["Keine Daten.", "–"] : [
    `${top5.map((z) => `${klarname("land", z.land)} ${anteil(z.anzahl, lGesamt)}`).join(", ")} – zusammen ${anteil(d3.sum(top5, (z) => z.anzahl), lGesamt)}; die übrigen ${Math.max(0, l.length - 5)} Länder ${anteil(d3.sum(l.slice(5), (z) => z.anzahl), lGesamt)}. `
    + `${wenn(prt, () => `Portugiesische Gäste stornieren mit ${prozent(prt.stornoquote)} deutlich häufiger als ausländische (${prozent(d.stornoAusland)}); der Inlandsmarkt ist groß, aber unzuverlässig.`)}`,
    `Stornobedingungen nach Markt differenzieren (Inland strenger); Marketingbudget auf Länder mit hohem Erlös je Buchung und niedriger Stornoquote lenken.`,
  ];

  T.laendertabelle = !l.length ? ["Keine Daten.", "–"] : [
    `Sortierung nach Stornoquote zeigt die riskanten Märkte, nach Tagesrate die zahlungskräftigen, nach Zimmernächten die aufenthaltsstarken; die Gruppierung nach Hotel zeigt, dass dieselben Länder in City und Resort unterschiedlich buchen.`,
    `Märkte nach Nettobeitrag (Erlös je Buchung und Stornoquote) bewerten, nicht nach Volumen.`,
  ];
  return T;
}
