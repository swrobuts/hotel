// Aussagen, Leittexte, Interpretationen und Handlungsempfehlungen.
//
// Jede Funktion bekommt den Datenkontext `d` (Kennzahlen, Monate, Gruppen, Zeitraum)
// und formuliert daraus Sätze. Zahlen kommen immer aus den Daten; die
// Empfehlungen sind fachlich formuliert und verweisen auf die gemessenen Werte.

// Hilfen für Sätze
const groesster = (liste, feld) => d3.greatest(liste, (z) => z[feld]);
const kleinster = (liste, feld) => d3.least(liste, (z) => z[feld]);
const anteil = (teil, ganz) => (ganz ? prozent(teil / ganz) : "–");
const liste = (teile) => teile.length <= 1 ? teile.join("") : teile.slice(0, -1).join(", ") + " und " + teile.at(-1);
const monatLang = (m) => MONATE_LANG[m.monat - 1] + " " + m.jahr;
// Text nur, wenn die Bedingung gilt; als Funktion übergeben, damit er nicht vorab ausgewertet wird.
// Summiert die Monate über alle Jahre und nennt die zwei stärksten und den schwächsten Monat.
function saisonprofil(monate) {
  const summen = d3.rollups(monate, (z) => d3.sum(z, (x) => x.anzahl), (z) => z.monat).map(([monat, anzahl]) => ({ monat, anzahl }));
  if (summen.length < 3) return null;
  const sortiert = [...summen].sort((a, b) => b.anzahl - a.anzahl);
  return { spitzen: sortiert.slice(0, 2).map((z) => MONATE_LANG[z.monat - 1]), tief: MONATE_LANG[sortiert.at(-1).monat - 1] };
}
const wenn = (bedingung, text) => (bedingung ? (typeof text === "function" ? text() : text) : "");

// ---------------------------------------------------------------------------
// Leittexte der Abschnitte
// ---------------------------------------------------------------------------

function leadUeberblick(d) {
  const k = d.kennzahlen;
  if (!k.anzahl_buchungen) return "Keine Buchungen für diese Filterkombination.";
  return `${zahl(k.anzahl_buchungen)} Buchungen, ${prozent(k.stornoquote)} storniert, ${zahl(k.erloes_nicht_storniert)} EUR Erlös aus nicht stornierten Buchungen.`;
}

function leadZeit(d) {
  const m = d.monate;
  if (m.length < 2) return "Für einen Zeitverlauf braucht es mindestens zwei Monate.";
  const spitze = groesster(m, "anzahl"), tief = kleinster(m, "anzahl");
  return `Stärkster Monat ${monatLang(spitze)} (${zahl(spitze.anzahl)} Buchungen), schwächster ${monatLang(tief)} (${zahl(tief.anzahl)}).`;
}

function leadVertrieb(d) {
  const s = d.segmente, gesamt = d3.sum(s, (z) => z.anzahl);
  if (!s.length) return "Keine Buchungen im gefilterten Bestand.";
  const kanal = groesster(d.kanaele, "erloes");
  return `${s[0].segment}: ${anteil(s[0].anzahl, gesamt)} der Buchungen. Größter Erlöskanal ${kanal.kanal} (${anteil(kanal.erloes, d3.sum(d.kanaele, (z) => z.erloes))}).`;
}

function leadStorno(d) {
  const k = d.kennzahlen, vl = d.vorlauf, kaution = d.kautionen.length ? groesster(d.kautionen, "stornoquote") : null;
  if (!k.anzahl_buchungen) return "Keine Buchungen im gefilterten Bestand.";
  return `${prozent(k.stornoquote)} storniert (${kurz(k.erloes_storniert)} EUR kalkulierter Erlös).`
    + `${wenn(kaution, () => ` ${kaution.kaution} ${prozent(kaution.stornoquote)}`)}${wenn(vl.length > 1, () => `, Vorlaufzeit ${vl.at(-1).vorlaufzeit} Tage ${prozent(vl.at(-1).stornoquote)}.`)}`;
}

function leadHerkunft(d) {
  const l = d.laender, gesamt = d3.sum(l, (z) => z.anzahl);
  if (!l.length) return "Keine Buchungen im gefilterten Bestand.";
  const inland = l.find((z) => z.land === "PRT");
  return `${l[0].land}: ${anteil(l[0].anzahl, gesamt)} der Gäste aus ${l.length} Ländern.`
    + `${wenn(inland, () => ` Stornoquote Inland ${prozent(inland?.stornoquote)}, Ausland ${prozent(d.stornoAusland)}.`)}`;
}

// ---------------------------------------------------------------------------
// Aussage (Überschrift) und Beschreibung je Figur
// ---------------------------------------------------------------------------

function aussagen(d) {
  const k = d.kennzahlen, m = d.monate, leer = !k.anzahl_buchungen;
  const spitze = m.length ? groesster(m, "anzahl") : null;
  const erloesSpitze = m.length ? groesster(m, "erloes") : null;
  const top = d.segmente[0], kanal = d.kanaele.length ? groesster(d.kanaele, "erloes") : null;
  const segStorno = d.segmente.length ? groesster(d.segmente, "stornoquote") : null;
  const nonRefund = d.kautionen.find((z) => z.kaution === "Non Refund");
  const vl = d.vorlauf, land = d.laender[0];
  const gesamtLaender = d3.sum(d.laender, (z) => z.anzahl);
  const beschreibung = (messgroesse) => `${messgroesse} · ${d.zeitraumText}${d.filterText ? " · " + d.filterText : ""}`;
  return {
    kennzahlen: [leer ? "Keine Buchungen im gefilterten Bestand" : `${zahl(k.anzahl_buchungen)} Buchungen, ${prozent(k.stornoquote)} storniert, ${dezimal(k.adr)} EUR mittlere Tagesrate`,
      beschreibung("Die zehn Kennzahlen des Katalogs mit Verlauf je Anreisemonat")],
    zeitverlauf: [spitze ? `${monatLang(spitze)} war der stärkste Anreisemonat: ${zahl(spitze.anzahl)} Buchungen${erloesSpitze ? `; der höchste Erlös fiel im ${monatLang(erloesSpitze)} an` : ""}` : "Kein Zeitverlauf verfügbar",
      beschreibung("Anzahl Buchungen, Gesamterlös in EUR und Stornoquote je Anreisemonat, je Hotel eine Linie")],
    saison: [d.saison ? `Über die Jahre summiert sind ${liste(d.saison.spitzen)} die stärksten Monate, ${d.saison.tief} der schwächste` : "Kein Saisonverlauf verfügbar",
      beschreibung("Anzahl Buchungen je Anreisemonat, Jahre als Linien in Graustufen (2015 hell, 2017 dunkel)")],
    segment: [top ? `${top.segment} bringt ${anteil(top.anzahl, d3.sum(d.segmente, (z) => z.anzahl))} aller Buchungen` : "Keine Buchungen",
      beschreibung("Anzahl Buchungen je Marktsegment, absteigend")],
    kanal: [kanal ? `${kanal.kanal} erwirtschaftet ${anteil(kanal.erloes, d3.sum(d.kanaele, (z) => z.erloes))} des Gesamterlöses` : "Keine Buchungen",
      beschreibung("Gesamterlös in EUR je Vertriebskanal (Tagesrate × Nächte, auch stornierte Buchungen), absteigend")],
    pivot: [d.pivot.length ? `${d.pivotTop.kundentyp} ist der häufigste Kundentyp – ${anteil(d.pivotTop.anzahl, d3.sum(d.pivot, (z) => z.anzahl))} der Buchungen` : "Keine Buchungen",
      beschreibung("Anzahl Buchungen je Marktsegment (Zeilen) und Kundentyp (Spalten), Balken relativ zum Spaltenmaximum")],
    storno: [vl.length > 1 ? `Stornorisiko steigt mit der Vorlaufzeit: ${prozent(vl[0].stornoquote)} bei ${vl[0].vorlaufzeit} Tagen, ${prozent(vl.at(-1).stornoquote)} bei ${vl.at(-1).vorlaufzeit} Tagen${nonRefund ? ` – Non Refund ${prozent(nonRefund.stornoquote)}` : ""}` : "Keine Stornodaten",
      beschreibung("Stornoquote = Anteil stornierter Buchungen, je Hotel, Kautionstyp, Marktsegment und Vorlaufzeit")],
    datum: [d.erloesDatum.length ? `Nach Stornodatum verschiebt sich der Erlös um Monate nach vorn – die Kurve endet mit dem Datenstand` : "Keine Daten",
      beschreibung("Gesamterlös in EUR je Monat, einmal nach Anreisedatum, einmal nach Datum des Reservierungsstatus")],
    laender: [land ? `${land.land} stellt ${anteil(land.anzahl, gesamtLaender)} der Gäste, die fünf größten Länder ${anteil(d3.sum(d.laender.slice(0, 5), (z) => z.anzahl), gesamtLaender)}` : "Keine Buchungen",
      beschreibung("Anzahl Buchungen je Herkunftsland, die 15 größten einzeln, die übrigen zusammengefasst")],
    laendertabelle: [d.laender.length ? `${d.laender.length} Herkunftsländer im Vergleich – Buchungen, Nächte, Erlös, Stornoquote und Tagesrate` : "Keine Buchungen",
      beschreibung("Alle Herkunftsländer; Sortierung per Klick auf die Spalte, Gruppierung nach Hotel mit Zwischensummen")],
  };
}

// ---------------------------------------------------------------------------
// Interpretation und Handlungsempfehlung je Figur
// ---------------------------------------------------------------------------

function deutungen(d) {
  const k = d.kennzahlen, m = d.monate, g = d.gesamt;
  const spitze = m.length ? groesster(m, "anzahl") : null, tief = m.length ? kleinster(m, "anzahl") : null;
  const erloesSpitze = m.length ? groesster(m, "erloes") : null;
  const stornoSpitze = m.length ? groesster(m, "stornoquote") : null, stornoTief = m.length ? kleinster(m, "stornoquote") : null;
  const hotelZeilen = d.hotels, city = hotelZeilen.find((z) => z.hotel === "City Hotel"), resort = hotelZeilen.find((z) => z.hotel === "Resort Hotel");
  const s = d.segmente, segGesamt = d3.sum(s, (z) => z.anzahl), top = s[0];
  const online = s.find((z) => z.segment === "Online TA"), groups = s.find((z) => z.segment === "Groups"), direct = s.find((z) => z.segment === "Direct");
  const kan = d.kanaele, kanGesamt = d3.sum(kan, (z) => z.erloes), ta = kan.find((z) => z.kanal === "TA/TO"), directK = kan.find((z) => z.kanal === "Direct");
  const nonRefund = d.kautionen.find((z) => z.kaution === "Non Refund"), noDeposit = d.kautionen.find((z) => z.kaution === "No Deposit");
  const vl = d.vorlauf, segStorno = s.length ? groesster(s, "stornoquote") : null;
  const l = d.laender, lGesamt = d3.sum(l, (z) => z.anzahl), prt = l.find((z) => z.land === "PRT");
  const top5 = l.slice(0, 5);
  const jahre = d3.groups(m, (z) => z.jahr).map(([jahr, zeilen]) => ({ jahr, anzahl: d3.sum(zeilen, (z) => z.anzahl), monate: zeilen.length }));
  const j2016 = jahre.find((j) => j.jahr === 2016);
  const leer = !k.anzahl_buchungen;
  const T = {};

  T.kennzahlen = leer ? ["Keine Buchungen im gefilterten Bestand.", "Filter lockern."] : [
    `${prozent(k.stornoquote)} der ${zahl(k.anzahl_buchungen)} Buchungen wurden storniert${wenn(d.gefiltert && g, () => ` (Gesamtbestand ${prozent(g.stornoquote)})`)}. `
    + `Gäste buchen im Mittel ${dezimal1(k.vorlaufzeit)} Tage im Voraus für ${dezimal(k.aufenthaltsdauer)} Nächte; nur ${prozent(k.wiederholungsgaeste)} sind Wiederholungsgäste. `
    + `Eine Auslastung ist nicht berechenbar (keine Zimmerkapazität im Datensatz); Zimmernächte sind der Ersatzwert.`,
    `Ein Prozentpunkt weniger Stornierungen entspricht etwa ${zahl(k.gesamterloes / 100)} EUR kalkuliertem Erlös – die Stornoquote ist der größte Hebel. `
    + `Der geringe Anteil an Wiederholungsgästen spricht für ein Bindungsprogramm.`,
  ];

  T.zeitverlauf = m.length < 2 ? ["Zu wenige Monate für eine Interpretation.", "Zeitraum erweitern."] : [
    `Buchungen zwischen ${zahl(tief.anzahl)} (${monatLang(tief)}) und ${zahl(spitze.anzahl)} (${monatLang(spitze)}). `
    + `${wenn(city && resort, () => `Das City Hotel liegt fast durchgehend über dem Resort Hotel; `)}`
    + `der Erlös ist im ${monatLang(erloesSpitze)} am höchsten (${kurz(erloesSpitze.erloes)} EUR)${wenn(city && resort, ", im Sommer trägt das Resort Hotel wegen höherer Tagesraten überproportional bei")}. `
    + `Die Stornoquote schwankt zwischen ${prozent(stornoTief.stornoquote)} und ${prozent(stornoSpitze.stornoquote)}. Der Abfall am rechten Rand ist das Datenende, kein Nachfrageeinbruch.`,
    `Personal- und Kapazitätsplanung an der Saisonkurve ausrichten; Prognosen auf 2016 stützen, das einzige vollständige Jahr. `
    + `Überbuchung an der Stornoquote des jeweiligen Monats kalibrieren; Tiefmonate über Preis und Pakete stützen statt Hochsaison zu rabattieren.`,
  ];

  T.saison = m.length < 2 ? ["Zu wenige Monate.", "Zeitraum erweitern."] : [
    `${d.saison ? `Die Monatsprofile der Jahre laufen weitgehend parallel; am stärksten sind ${liste(d.saison.spitzen)}, am schwächsten ist ${d.saison.tief}. ` : ""}`
    + `${wenn(jahre.some((j) => j.jahr === 2017) && j2016, () => `Januar bis August 2017: ${zahl(d3.sum(m.filter((z) => z.jahr === 2017), (z) => z.anzahl))} Buchungen gegenüber ${zahl(d3.sum(m.filter((z) => z.jahr === 2016 && z.monat <= 8), (z) => z.anzahl))} im gleichen Zeitraum 2016.`)}`,
    `Nur gleiche Monate vergleichen (Vorjahresvergleich), weil die Saison den Unterschied dominiert; 2016 als Budgetbasis, das Wachstum 2017 als Trend.`,
  ];

  T.segment = !top ? ["Keine Daten.", "–"] : [
    `${top.segment} stellt ${anteil(top.anzahl, segGesamt)} der Buchungen${wenn(online && online !== top, () => `; Online TA kommt auf ${anteil(online.anzahl, segGesamt)}`)}. `
    + `${wenn(direct, () => `Direktbuchungen machen ${anteil(direct.anzahl, segGesamt)} aus. `)}`
    + `${wenn(groups, () => `Gruppen (${anteil(groups.anzahl, segGesamt)}) sind zahlenmäßig klein, aber mit ${prozent(groups.stornoquote)} Stornoquote das riskanteste Segment.`)}`,
    `Abhängigkeit von Online-Reisebüros verringern: Direktbuchungen mit Vorteilen fördern, die es nur über die eigene Seite gibt. `
    + `${wenn(groups, "Gruppen nur mit gestaffelten Anzahlungen annehmen.")}`,
  ];

  T.kanal = !ta && !kan.length ? ["Keine Daten.", "–"] : [
    `${kan[0]?.kanal ? `${groesster(kan, "erloes").kanal} bringt ${anteil(groesster(kan, "erloes").erloes, kanGesamt)} des Erlöses` : ""}${wenn(directK, () => `, der Direktvertrieb ${anteil(directK.erloes, kanGesamt)}`)}. `
    + `Der Erlös ist hier kalkuliert (Tagesrate × Nächte) und enthält auch stornierte Buchungen; die Stornoquoten der Kanäle stehen in der Stornoanalyse.`,
    `Direktvertriebsanteil als Kennzahl führen; Provisionen je Kanal dem Erlös gegenüberstellen und den Nettobeitrag steuern, nicht den Bruttoerlös.`,
  ];

  T.pivot = !d.pivot.length ? ["Keine Daten.", "–"] : [
    `${d.pivotTop.kundentyp} stellt ${anteil(d.pivotTop.anzahl, d3.sum(d.pivot, (z) => z.anzahl))} der Buchungen; Transient-Party (mehrere Buchungen unter einer Reservierung) konzentriert sich auf Gruppen- und Offline-Segmente, Verträge sind selten.`,
    `Einzelreisende über Online-Kanäle und Preisdifferenzierung ansprechen; Gruppen und Verträge über Rahmenvereinbarungen mit fester Kontingent- und Stornoregel.`,
  ];

  T.storno = !vl.length ? ["Keine Daten.", "–"] : [
    `${wenn(city && resort, () => `Das City Hotel storniert häufiger als das Resort Hotel (${prozent(city.stornoquote)} gegenüber ${prozent(resort.stornoquote)}). `)}`
    + `${wenn(nonRefund, () => `Buchungen mit Kautionstyp Non Refund werden zu ${prozent(nonRefund.stornoquote)} storniert${wenn(noDeposit, () => ` – ohne Anzahlung sind es ${prozent(noDeposit.stornoquote)}`)}; das ist fachlich unplausibel und in der Literatur zum Datensatz als Eigenheit der Quelle bekannt (vermutlich Sammelbuchungen, die nach Nichterscheinen storniert wurden). `)}`
    + `${wenn(segStorno, () => `Nach Marktsegment ist das Risiko bei ${segStorno.segment} am höchsten (${prozent(segStorno.stornoquote)}). `)}`
    + `Mit der Vorlaufzeit steigt die Quote von ${prozent(vl[0].stornoquote)} (${vl[0].vorlaufzeit} Tage) auf ${prozent(vl.at(-1).stornoquote)} (${vl.at(-1).vorlaufzeit} Tage): Je früher gebucht, desto eher wird storniert.`,
    `Stornobedingungen nach Vorlaufzeit staffeln (lange Vorlaufzeit nur mit Anzahlung), vor der Anreise rückbestätigen, Überbuchung an den Quoten je Segment ausrichten. `
    + `Die Non-Refund-Quote mit der Buchungsabteilung klären – ein Daten- oder Prozessproblem, keine Gästeentscheidung.`,
  ];

  T.datum = !d.erloesDatum.length ? ["Keine Daten.", "–"] : [
    `Nach Anreisedatum zeigt die Kurve, wann Erlös realisiert oder verloren wird; nach Stornodatum verschiebt sich derselbe Betrag auf den Tag der Stornierung oder des Check-outs. `
    + `Die zweite Reihe beginnt früher (Stornierungen vor der ersten Anreise) und fällt am Ende ab, weil Buchungen mit Anreise nach August 2017 nicht im Datensatz sind.`,
    `Erlösberichte nach Anreisedatum, Stornomonitoring nach Statusdatum; die Verknüpfung immer benennen (in Power BI: aktive und inaktive Beziehung).`,
  ];

  T.laender = !l.length ? ["Keine Daten.", "–"] : [
    `${top5.map((z) => `${z.land} ${anteil(z.anzahl, lGesamt)}`).join(", ")} – die fünf größten Länder stellen ${anteil(d3.sum(top5, (z) => z.anzahl), lGesamt)} der Gäste, die übrigen ${Math.max(0, l.length - 5)} Länder zusammen ${anteil(d3.sum(l.slice(5), (z) => z.anzahl), lGesamt)}. `
    + `${wenn(prt, () => `Portugiesische Gäste stornieren mit ${prozent(prt.stornoquote)} deutlich häufiger als ausländische (${prozent(d.stornoAusland)}); `)}`
    + `der Inlandsmarkt ist damit groß, aber unzuverlässig.`,
    `Stornobedingungen nach Markt differenzieren (Inland strenger); Marketingbudget auf Länder mit hohem Erlös je Buchung und niedriger Stornoquote lenken.`,
  ];

  T.laendertabelle = !l.length ? ["Keine Daten.", "–"] : [
    `Sortierung nach Stornoquote zeigt die riskanten Märkte, nach Tagesrate die zahlungskräftigen, nach Zimmernächten die aufenthaltsstarken; die Gruppierung nach Hotel zeigt, dass dieselben Länder in City und Resort unterschiedlich buchen.`,
    `Märkte nach Nettobeitrag (Erlös je Buchung × Stornoquote) bewerten, nicht nach Volumen.`,
  ];
  return T;
}
