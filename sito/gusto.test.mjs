// node --test sito/
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "./abbinamenti.js";
import * as g from "./gusto.js";

const capo = (id, categoria, hex, extra = {}) => ({
  id, categoria, hex, colore: extra.colore ?? "x", stato: "attivo",
  stagione: ["primavera", "estate", "autunno", "inverno"], occasione: ["casual"], ...extra,
});
const P = (...c) => m.prepara(c);

test("forma: camicie, t-shirt e strati riconosciuti dal file del capo", () => {
  const [ox, el, li, st, tee, gr, polo, hz, ho, fe, pz, dv, v, gc] = P(
    capo("1", "camicia", "#bbc8da"), capo("2", "camicia", "#e6e7dd", { occasione: ["elegante", "smart-casual"] }),
    capo("3", "camicia", "#dfe1da", { materiale: "100% lino" }), capo("4", "camicia", "#bcc7c5", { modello: "stampa monogram all-over" }),
    capo("5", "t-shirt", "#191d1f", { modello: "logo tono su tono" }), capo("6", "maglia manica lunga", "#282a2b", { modello: "stampa fotografica montagne" }),
    capo("7", "polo", "#263c47"), capo("8", "felpa con cappuccio (zip)", "#181816"), capo("9", "felpa con cappuccio", "#2c2e2f"),
    capo("10", "felpa girocollo", "#202428"), capo("11", "pile", "#3b5772", { modello: "pile con zip intera" }),
    capo("12", "maglione", "#e3e3d1", { modello: "dolcevita" }), capo("13", "maglione", "#d7cfb3", { modello: "scollo a V" }),
    capo("14", "giacca", "#474e5e"),
  );
  assert.deepEqual([ox, el, li, st, tee, polo].map(g.forma), ["oxford", "camicia_elegante", "camicia_lino", "camicia_stampata", "tee", "polo"]);
  assert.equal(g.forma(gr), "girocollo", "la maglia a manica lunga è uno strato");
  assert.deepEqual([hz, ho, fe, pz, dv, v, gc].map(g.forma), ["hoodie_zip", "hoodie", "felpa", "pile_zip", "dolcevita", "scollo_v", "giacca"]);
});

test("layering: niente camicie o polo sotto felpe col cappuccio o con zip", () => {
  const [cam, polo, tee, hz, ho, giro] = P(
    capo("c", "camicia", "#bbc8da"), capo("p", "polo", "#263c47"), capo("t", "t-shirt", "#f1f1ed"),
    capo("hz", "felpa con cappuccio (zip)", "#181816"), capo("h", "felpa con cappuccio", "#2c2e2f"), capo("g", "maglione", "#254059"),
  );
  for (const sotto of [cam, polo]) for (const sopra of [hz, ho]) assert.ok(g.gusto([sotto, sopra]).vietato, `${sotto.id} sotto ${sopra.id}`);
  assert.equal(g.gusto([tee, ho]).vietato, null);
  assert.ok(g.strati(cam, giro).voto > g.strati(polo, giro).voto, "camicia sotto girocollo > polo");
  assert.ok(g.strati(tee, ho).voto > 0, "t-shirt sotto hoodie è il classico");
});

test("outfit generati e builder rispettano i divieti", () => {
  const capi = P(
    capo("hz", "felpa con cappuccio (zip)", "#181816"), capo("c", "camicia", "#bbc8da"), capo("t", "t-shirt", "#e6e7dd"),
    capo("j", "jeans", "#748991"), capo("s", "sneaker", "#d2d4ce"),
  );
  const { outfit } = m.outfit(capi[0], capi);
  assert.ok(outfit.length && outfit.every((o) => !o.pezzi.some((p) => p.id === "c")));
  const r = m.outfitDa([capi[0], capi[1]], capi);
  assert.equal(r.outfit.length, 0);
  assert.match(r.vietato, /non si porta/);
});

test("lino con un capo invernale: vietato", () => {
  const [lino, lana, cotone] = P(
    capo("l", "camicia", "#dfe1da", { materiale: "100% lino" }),
    capo("w", "maglione", "#2a322e", { stagione: ["autunno", "inverno"] }),
    capo("v", "maglione", "#d7cfb3", { modello: "scollo a V", stagione: ["primavera", "autunno"] }),
  );
  assert.ok(g.gusto([lino, lana]).vietato);
  assert.equal(g.gusto([lino, cotone]).vietato, null);
});

test("cintura nera con stivali marroni in pelle: vietato; con sneaker libero", () => {
  const [cintN, cintM, stiv, snk] = P(
    capo("cn", "cintura", "#1e1f1d", { materiale: "pelle" }), capo("cm", "cintura", "#826846", { materiale: "pelle" }),
    capo("st", "stivale", "#b0642c", { materiale: "nabuk" }), capo("sn", "sneaker", "#181517", { materiale: "pelle" }),
  );
  const [cam] = P(capo("c", "camicia", "#bbc8da"));
  assert.ok(g.gusto([cam, cintN, stiv]).vietato);
  assert.equal(g.gusto([cam, cintM, stiv]).vietato, null);
  assert.equal(g.gusto([cintM, snk]).vietato, null);
});

test("colori: tre capi accesi vietati, uno solo premiato", () => {
  const [ross, gial, verd, jeans, bianco] = P(
    capo("r", "maglione", "#c0302a"), capo("y", "pantalone", "#e8c020"), capo("v", "sneaker", "#20a050"),
    capo("j", "jeans", "#33424d"), capo("w", "sneaker", "#f1f1ed"),
  );
  assert.ok(g.gusto([ross, gial, verd]).vietato);
  assert.ok(g.gusto([ross, jeans, bianco]).delta > g.gusto([ross, gial, bianco]).delta);
});

test("contrasto sopra/sotto a campana: la stessa luce è l'effetto tuta", () => {
  const [chiaro, medio, jeans] = P(capo("a", "maglione", "#e2dfc6"), capo("b", "maglione", "#33424d"), capo("j", "jeans", "#33424d"));
  assert.ok(g.gusto([chiaro, jeans]).delta > g.gusto([medio, jeans]).delta);
  assert.ok(g.gusto([medio, jeans]).note.some((n) => /tuta/.test(n.testo)));
});

test("denim su denim: quasi uguali vietato, ben diversi ok", () => {
  const [gS, gC, j] = P(
    capo("a", "giacca", "#4a5d70", { materiale: "denim" }), capo("b", "giacca", "#a7b8c8", { materiale: "denim" }), capo("j", "jeans", "#33424d"),
  );
  assert.ok(g.gusto([gS, j]).vietato);
  assert.equal(g.gusto([gC, j]).vietato, null);
});

test("navy e marrone premiati; scuro sotto chiaro ok solo se non è la camicia elegante", () => {
  const [navy, marr, nero] = P(capo("n", "maglione", "#1f2a44"), capo("m", "pantalone", "#6b4a33"), capo("k", "pantalone", "#56524c"));
  assert.ok(g.gusto([navy, marr]).note.some((n) => /Navy e marrone/.test(n.testo)));
  const [ele, ox, chiaro, pant] = P(
    capo("e", "camicia", "#1f2a44", { occasione: ["elegante"] }), capo("o", "camicia", "#1f2a44"),
    capo("c", "maglione", "#e2dfc6"), capo("p", "pantalone", "#1d2426"),
  );
  assert.ok(g.gusto([ox, chiaro, pant]).delta > g.gusto([ele, chiaro, pant]).delta);
  assert.ok(nero);
});

test("contrasto personale: capelli scuri su pelle chiara spostano la campana in alto", () => {
  const [top, bot] = P(capo("a", "maglione", "#f1f1ed"), capo("b", "jeans", "#191d1f"));
  g.impostaContrasto(m.oklch("#ddb095"), "biondo");
  const basso = g.gusto([top, bot]).delta;
  g.impostaContrasto(m.oklch("#ddb095"), "castano scuro/nero");
  assert.ok(g.gusto([top, bot]).delta > basso);
});

test("fantasie: due uguali penalizzate", () => {
  const [r1, r2, liscio] = P(
    capo("a", "maglione", "#ded6bb", { colore: "panna a righe" }), capo("b", "camicia", "#1f2a44", { colore: "navy a righe" }),
    capo("c", "camicia", "#1f2a44"),
  );
  assert.ok(g.gusto([r2, r1]).delta < g.gusto([liscio, r1]).delta);
});

test("cintura nera e stivali marroni: vietato solo se la cintura si vede", () => {
  const [cint, stiv, cam, magl] = P(
    capo("cn", "cintura", "#1e1f1d", { materiale: "pelle" }), capo("st", "stivale", "#b0642c", { materiale: "nabuk" }),
    capo("c", "camicia", "#bbc8da"), capo("m", "maglione", "#2a322e"),
  );
  assert.ok(g.gusto([cam, cint, stiv]).vietato, "camicia senza strato: cintura in vista");
  const coperta = g.gusto([cam, magl, cint, stiv]);
  assert.equal(coperta.vietato, null);
  assert.ok(coperta.delta < g.gusto([cam, magl, stiv]).delta, "ma resta sconsigliato");
});

test("peso del tessuto dal file del capo", () => {
  const [grossa, merino, sottile, tee, pile, lino] = P(
    capo("a", "maglione", "#1c1e1d", { modello: "girocollo, maglia a grana grossa" }),
    capo("b", "maglione", "#254059", { materiale: "50% lana merino, 50% cotone" }),
    capo("c", "maglione", "#d7cfb3", { modello: "scollo a V, maglia sottile" }), capo("d", "t-shirt", "#191d1f"),
    capo("e", "pile", "#d8aa44"), capo("f", "pantalone", "#e6e7db", { materiale: "lino" }),
  );
  assert.deepEqual([grossa, merino, sottile, tee, pile].map(g.peso), [3, 3, 1, 1, 3]);
  assert.ok(g.gusto([grossa, lino]).note.some((n) => /pesi diversi/.test(n.testo)));
});

test("proporzioni: solo se la vestibilità è nel file del capo", () => {
  const [ampio, senza, minimal, boot] = P(
    capo("a", "pantalone", "#ded9c7", { vestibilita: "ampio" }), capo("b", "pantalone", "#ded9c7"),
    capo("m", "sneaker", "#d2d4ce", { modello: "cupsole minimal, profilo basso" }), capo("s", "stivale", "#b0642c"),
  );
  assert.equal(g.volume(minimal), "sottile");
  assert.equal(g.volume(boot), "pesante");
  assert.ok(g.gusto([ampio, minimal]).delta < g.gusto([senza, minimal]).delta);
});

test("taratura: con 5 outfit approvati la fascia di contrasto segue i tuoi", () => {
  g.impostaContrasto(null);
  const [top, bot] = P(capo("a", "maglione", "#e2dfc6"), capo("b", "jeans", "#dce1d4"));
  assert.deepEqual(g.taraSuApprovati([[top, bot]]), [0.15, 0.45], "pochi dati: resta la ricerca");
  // cinque outfit tonali (ΔL ~0.05): la fascia scende
  const [lo, hi] = g.taraSuApprovati(Array(5).fill([top, bot]));
  assert.ok(lo < 0.15 && hi < 0.45);
  g.taraSuApprovati([]);
});
