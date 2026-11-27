// node --test web/
import { test } from "node:test";
import assert from "node:assert/strict";
import * as m from "./abbinamenti.js";

m.impostaPelle("#ddb095");

const capo = (id, categoria, hex, extra = {}) => ({
  id, categoria, hex, colore: extra.colore ?? "x", stato: "attivo",
  stagione: ["primavera", "estate", "autunno", "inverno"], occasione: ["casual"], ...extra,
});

test("oklch: valori noti", () => {
  const w = m.oklch("#ffffff");
  assert.ok(Math.abs(w.L - 1) < 1e-3 && w.C < 1e-3);
  assert.ok(m.oklch("#000000").L < 1e-6);
  const r = m.oklch("#ff0000");
  assert.ok(Math.abs(r.L - 0.628) < 0.01 && Math.abs(r.h - 29.2) < 1);
});

test("distanza tinta gira sul cerchio", () => {
  assert.equal(m.distanzaTinta(350, 10), 20);
  assert.equal(m.distanzaTinta(0, 180), 180);
});

test("famiglie colore", () => {
  const f = (h) => m.famiglia(m.oklch(h));
  assert.equal(f("#191d1f"), "scuri");
  assert.equal(f("#f1f1ed"), "chiari");
  assert.equal(f("#8a8d90"), "grigi");
  assert.equal(f("#1f2a44"), "blu");
  assert.equal(f("#d8aa44"), "gialli");
  assert.equal(f("#cbb994"), "terra");
  assert.equal(f("#6b6b3a"), "verdi"); // oliva
  assert.equal(f("#4f7a4f"), "verdi");
  assert.equal(f("#b2302f"), "rossi");
});

test("slot e tipo dalle categorie reali", () => {
  assert.equal(m.slot("pantalone elegante"), "bottom");
  assert.equal(m.slot("jeans"), "bottom");
  assert.equal(m.slot("scarpa elegante (derby/oxford)"), "shoes");
  assert.equal(m.slot("cintura"), "belt");
  // strato sopra: felpe, pile, maglioni, giacche
  for (const c of ["felpa con cappuccio (zip)", "felpa girocollo", "pile", "maglione", "maglione (full-zip)", "giacca"])
    assert.equal(m.slot(c), "mid", c);
  // base: quello che si porta sotto
  for (const c of ["t-shirt", "polo", "canottiera", "camicia"]) assert.equal(m.slot(c), "base", c);
  assert.equal(m.tipo("pile"), "felpe");
  assert.equal(m.tipo("giacca"), "capispalla");
  assert.equal(m.tipo("maglione (full-zip)"), "maglioni");
  assert.equal(m.tipo("maglione"), "maglioni");
  assert.equal(m.tipo("maglia manica lunga"), "maglie");
  assert.equal(m.tipo("polo"), "tshirt");
  assert.equal(m.tipo("felpa girocollo"), "felpe");
});

test("giudizio a fasce", () => {
  assert.equal(m.giudizio(0.9), "Ottimo");
  assert.equal(m.giudizio(0.75), "Buono");
  assert.equal(m.giudizio(0.6), "Discreto");
  assert.equal(m.giudizio(0.3), "Azzardato");
});

test("filtra per tipo, famiglia, stagione, stato e testo", () => {
  const capi = m.prepara([
    capo("1", "t-shirt", "#191d1f", { marca: "Gas", stagione: ["estate"] }),
    capo("2", "jeans", "#2c3e5c", { stato: "dismesso" }),
    capo("3", "maglione", "#d8aa44", { stagione: ["inverno"], materiale: "100% lana merino" }),
  ]);
  const ids = (f) => m.filtra(capi, f).map((c) => c.id);
  assert.deepEqual(ids({ stato: "attivo" }), ["1", "3"]);
  assert.deepEqual(ids({ stato: "tutti", tipi: ["pantaloni"] }), ["2"]);
  assert.deepEqual(ids({ famiglie: ["gialli", "scuri"] }), ["1", "3"]);
  assert.deepEqual(ids({ stagioni: ["inverno"] }), ["2", "3"]);
  assert.deepEqual(ids({ testo: "gas" }), ["1"]);
  assert.deepEqual(ids({ testo: "merino" }), ["3"]);
});

test("relazioni cromatiche", () => {
  const [nero, senape, navy, petrolio, bianco, jeans] = m.prepara([
    capo("a", "t-shirt", "#191d1f"), capo("b", "maglione", "#d8aa44"), capo("c", "pantalone", "#1f2a44"),
    capo("d", "pantalone", "#1f4e5a"), capo("e", "camicia", "#f1f1ed"), capo("f", "jeans", "#2c3e5c"),
  ]);
  assert.equal(m.relazione(senape, navy), "neutro+colore", "il navy fa da neutro");
  assert.equal(m.relazione(senape, m.prepara([capo("z", "pantalone", "#3b5bb0")])[0]), "complementari");
  assert.equal(m.relazione(navy, petrolio), "neutro+colore");
  const [blu, celeste] = m.prepara([capo("y1", "maglione", "#3b5bb0"), capo("y2", "pantalone", "#2f8fb8")]);
  assert.equal(m.relazione(blu, celeste), "analoghi");
  assert.equal(m.relazione(nero, senape), "neutro+colore");
  assert.equal(m.relazione(nero, bianco), "neutri");
  assert.ok(jeans.neutro, "il denim conta come neutro");
  // stessa luce tra neutri -> monocromatico, punteggio più basso del contrasto
  const [n2] = m.prepara([capo("g", "pantalone", "#1c1c1e")]);
  assert.equal(m.relazione(nero, n2), "monocromatico");
  assert.ok(m.coppia(nero, bianco).punteggio > m.coppia(nero, n2).punteggio);
});

test("viso: profilo a sottotono caldo", () => {
  const [nero, senape, navy, pant] = m.prepara([
    capo("a", "t-shirt", "#191d1f"), capo("b", "maglione", "#d8aa44", { colore: "giallo senape" }),
    capo("c", "polo", "#1f2a44"), capo("d", "jeans", "#d8aa44"),
  ]);
  assert.ok(m.viso(nero).delta < 0);
  assert.ok(m.viso(senape).delta > 0);
  assert.ok(m.viso(navy).delta > 0);
  assert.equal(m.viso(pant), null, "i pantaloni non stanno vicino al viso");
});

const ARMADIO = () =>
  m.prepara([
    capo("top", "maglione", "#d8aa44", { colore: "giallo senape", stagione: ["autunno", "inverno"] }),
    capo("p1", "pantalone", "#1f2a44", { colore: "blu navy" }),
    capo("p2", "jeans", "#2c3e5c", { colore: "blu denim scuro" }),
    capo("p3", "pantalone", "#d9a75a", { colore: "giallo grano" }),
    capo("p4", "pantalone elegante", "#1c1c1e", { colore: "nero", occasione: ["elegante", "cerimonia"] }),
    capo("pe", "pantalone", "#cbb994", { colore: "beige", stagione: ["estate"] }),
    capo("s1", "sneaker", "#f4f4f1", { colore: "bianco" }),
    capo("s2", "stivale", "#6b4a33", { colore: "marrone" }),
    capo("b1", "cintura", "#6b4a33", { colore: "marrone" }),
    capo("b2", "cintura", "#1c1c1e", { colore: "nero" }),
    capo("t2", "t-shirt", "#191d1f"),
  ]);

test("outfit: uno per slot, niente doppioni, stagione e formalità rispettate", () => {
  const capi = ARMADIO();
  const top = capi[0];
  const { outfit, mancanti } = m.outfit(top, capi, { n: 3 });
  assert.equal(outfit.length, 3);
  assert.deepEqual(mancanti, []);
  for (const o of outfit) {
    assert.equal(o.pezzi[0], top);
    const slots = o.pezzi.map((p) => p.slot);
    assert.equal(new Set(slots).size, slots.length, "uno per slot");
    assert.ok(!o.pezzi.some((p) => p.id === "pe"), "fuori stagione");
    assert.ok(!o.pezzi.some((p) => p.id === "p4"), "troppo elegante per un capo casual");
    assert.deepEqual(slots.slice().sort(), ["base", "belt", "bottom", "mid", "shoes"]);
    assert.ok(o.punteggio >= 0 && o.punteggio <= 1);
    assert.ok(o.perche.length >= 2);
  }
  const chiavi = outfit.map((o) => o.pezzi.map((p) => p.id).join());
  assert.equal(new Set(chiavi).size, 3, "tre outfit diversi");
  // i blu (navy e denim, neutri) battono il giallo grano tono su tono
  assert.ok(m.coppia(top, capi[1]).punteggio > m.coppia(top, capi[3]).punteggio);
  assert.ok(outfit.some((o) => o.perche[0].tipo === "neutro+colore"));
});

test("outfit: cintura in tinta con scarpe non sneaker", () => {
  const capi = ARMADIO();
  const { outfit } = m.outfit(capi[0], capi, { n: 5 });
  const conStivale = outfit.find((o) => o.pezzi.some((p) => p.id === "s2"));
  assert.ok(conStivale);
  assert.equal(conStivale.pezzi.find((p) => p.slot === "belt").id, "b1");
});

test("motivazioni: niente regola cintura/scarpe con le sneaker", () => {
  const capi = ARMADIO();
  const [top, , , , , , sneaker, stivale, cintura] = capi;
  assert.ok(!m.perche([top, capi[1], sneaker, cintura], top).some((r) => r.tipo === "cintura"));
  assert.ok(m.perche([top, capi[1], stivale, cintura], top).some((r) => r.tipo === "cintura"));
});

test("outfit: slot mancanti segnalati, pool vuoto -> nessun outfit", () => {
  const capi = ARMADIO();
  // solo strati: propone comunque cosa mettere sotto e segnala il resto
  const soloStrati = m.outfit(capi[0], [capi[0], capi[10]]);
  assert.deepEqual(soloStrati.mancanti, ["bottom", "shoes", "belt"]);
  assert.deepEqual(soloStrati.outfit[0].pezzi.map((p) => p.id), ["top", "t2"]);
  assert.deepEqual(m.outfit(capi[0], [capi[0]]).outfit, []);
  const senzaCinture = m.outfit(capi[0], capi.filter((c) => c.slot !== "belt"));
  assert.deepEqual(senzaCinture.mancanti, ["belt"]);
  assert.ok(senzaCinture.outfit.length > 0);
});

test("outfit approvato riceve il bonus e la motivazione", () => {
  const capi = ARMADIO();
  const approvati = [["top", "t2", "p3", "s1", "b2"]];
  const base = m.punteggioOutfit(capi.filter((c) => approvati[0].includes(c.id)));
  const bonus = m.punteggioOutfit(capi.filter((c) => approvati[0].includes(c.id)), approvati);
  assert.ok(bonus > base);
  const { outfit } = m.outfit(capi[0], capi, { approvati, n: 3 });
  const app = outfit.find((o) => o.pezzi.map((p) => p.id).sort().join() === [...approvati[0]].sort().join());
  assert.ok(app, "l'approvato è tra i proposti");
  assert.ok(app.perche.some((r) => r.tipo === "approvato"));
});

test("strati: mai due capi dello stesso strato (pile + felpa, t-shirt + camicia)", () => {
  const capi = m.prepara([
    capo("pile", "pile", "#d8aa44"), capo("felpa", "felpa con cappuccio", "#2c2e2f"),
    capo("magl", "maglione", "#e2dfc6"), capo("tee", "t-shirt", "#191d1f"), capo("cam", "camicia", "#f1f1ed"),
    capo("j", "jeans", "#2c3e5c"), capo("s", "sneaker", "#f4f4f1"),
  ]);
  for (const scelto of capi.slice(0, 5)) {
    const { outfit } = m.outfit(scelto, capi, { n: 5 });
    assert.ok(outfit.length > 0, scelto.id);
    for (const o of outfit) {
      assert.ok(o.pezzi.filter((p) => p.slot === "mid").length <= 1, `${scelto.id}: al massimo uno strato sopra`);
      assert.equal(o.pezzi.filter((p) => p.slot === "base").length, 1, `${scelto.id}: una base`);
    }
  }
});

test("strati: una t-shirt estiva va sotto un maglione invernale", () => {
  const capi = m.prepara([
    capo("tee", "t-shirt", "#191d1f", { stagione: ["primavera", "estate"] }),
    capo("magl", "maglione", "#e2dfc6", { stagione: ["autunno", "inverno"] }),
    capo("lino", "pantalone", "#cbb994", { stagione: ["estate"] }),
    capo("j", "jeans", "#2c3e5c", { stagione: ["autunno", "inverno"] }),
  ]);
  const { outfit } = m.outfit(capi[0], capi, { n: 5 });
  assert.ok(outfit.some((o) => o.pezzi.some((p) => p.id === "magl")));
  // ma un maglione invernale non va coi pantaloni di lino estivi
  for (const o of outfit) assert.ok(!(o.pezzi.some((p) => p.id === "magl") && o.pezzi.some((p) => p.id === "lino")));
  assert.ok(outfit[0].perche.some((r) => r.tipo === "strati"));
});

test("giacca scelta: servono base, pantaloni, scarpe", () => {
  const capi = m.prepara([
    capo("g", "giacca", "#474e5e"), capo("t", "t-shirt", "#f1f1ed"), capo("p", "jeans", "#2c3e5c"),
    capo("s", "sneaker", "#f4f4f1"),
  ]);
  const { outfit, mancanti } = m.outfit(capi[0], capi);
  assert.deepEqual(mancanti, ["belt"]);
  assert.deepEqual(outfit[0].pezzi.map((p) => p.slot), ["mid", "base", "bottom", "shoes"]);
});

test("outfit: senza limite li propone tutti, una volta sola, il migliore per primo", () => {
  const capi = ARMADIO();
  const top = capi[0];
  const { outfit } = m.outfit(top, capi);
  // candidati validi: base t2; pantaloni p1 p2 p3 (pe fuori stagione, p4 troppo elegante); scarpe s1 s2; cinture b1 b2
  assert.equal(outfit.length, 1 * 3 * 2 * 2);
  const chiavi = outfit.map((o) => o.pezzi.map((p) => p.id).join());
  assert.equal(new Set(chiavi).size, outfit.length, "nessun doppione");
  const migliore = Math.max(...outfit.map((o) => o.punteggio));
  assert.equal(outfit[0].punteggio, migliore);
});

test("outfit: perSlot limita i candidati per ruolo", () => {
  const capi = ARMADIO();
  const { outfit } = m.outfit(capi[0], capi, { perSlot: 1 });
  assert.equal(outfit.length, 1);
});

test("motivazioni strati: chi è il neutro", () => {
  const [panna, oliva, nero] = m.prepara([
    capo("m", "maglione", "#e2dfc6"), capo("o", "polo", "#a0532f", { colore: "ruggine" }), capo("n", "t-shirt", "#191d1f", { colore: "nero" }),
  ]);
  const strati = (pz) => m.perche(pz, pz[0]).find((r) => r.tipo === "strati").testo;
  assert.match(strati([panna, oliva]), /tocco di colore sotto un neutro/);
  const [senape] = m.prepara([capo("s", "maglione", "#d8aa44")]);
  assert.match(strati([senape, nero]), /neutro che non disturba/);
});

test("outfit del giorno: stabile nel giorno, cambia col giro, rispetta la stagione", () => {
  const capi = m.prepara([
    { id: "t1", categoria: "t-shirt", colore: "nero", hex: "#1e1e1e", stagione: ["estate"], occasione: ["casual"] },
    { id: "t2", categoria: "t-shirt", colore: "bianco", hex: "#eeeeea", stagione: ["estate"], occasione: ["casual"] },
    { id: "f1", categoria: "felpa", colore: "oliva", hex: "#5f5e3a", stagione: ["autunno", "inverno"], occasione: ["casual"] },
    { id: "f2", categoria: "felpa", colore: "ruggine", hex: "#a0532f", stagione: ["autunno", "inverno"], occasione: ["casual"] },
    { id: "f3", categoria: "maglione", colore: "azzurro", hex: "#b2c6cf", stagione: ["primavera"], occasione: ["casual"] },
    { id: "j1", categoria: "jeans", colore: "blu", hex: "#33424d", stagione: ["autunno", "inverno"], occasione: ["casual"] },
    { id: "j2", categoria: "jeans", colore: "chiaro", hex: "#9dafb2", stagione: ["primavera", "estate"], occasione: ["casual"] },
  ]);
  const nov = new Date(2026, 10, 23);
  const a = m.delGiorno(capi, nov), b = m.delGiorno(capi, nov);
  assert.equal(a.stagione, "autunno");
  assert.deepEqual(a.outfit.pezzi.map((p) => p.id), b.outfit.pezzi.map((p) => p.id));
  assert.equal(a.scelto.slot, "mid");
  assert.ok(a.outfit.pezzi.every((p) => p.id !== "f3" && p.id !== "j2"), "niente capi fuori stagione");
  const giri = new Set([0, 1, 2, 3, 4, 5].map((g) => m.delGiorno(capi, nov, g).outfit.pezzi.map((p) => p.id).join()));
  assert.ok(giri.size > 1, "un altro giro propone altro");
  const lug = m.delGiorno(capi, new Date(2026, 6, 10));
  assert.equal(lug.scelto.slot, "base");
  assert.ok(lug.outfit.pezzi.every((p) => p.slot !== "mid"));
  assert.equal(m.delGiorno([], nov).outfit, null);
  for (let g = 0; g < 8; g++) assert.ok(m.viso(m.delGiorno(capi, nov, g).scelto).voto >= 0.6, "parte da un capo che sta bene col viso");
});

test("filtra per strato (sopra, sotto, pantaloni)", () => {
  const capi = m.prepara([
    { id: "1", categoria: "t-shirt", colore: "nero", hex: "#1e1e1e" },
    { id: "2", categoria: "felpa con cappuccio", colore: "oliva", hex: "#5f5e3a" },
    { id: "3", categoria: "pile", colore: "senape", hex: "#d8aa44" },
    { id: "4", categoria: "jeans", colore: "blu", hex: "#33424d" },
  ]);
  const ids = (f) => m.filtra(capi, f).map((c) => c.id).join();
  assert.equal(ids({ ruoli: ["mid"] }), "2,3");
  assert.equal(ids({ ruoli: ["base", "bottom"] }), "1,4");
  assert.equal(ids({ ruoli: [] }), "1,2,3,4");
});

test("pelle: caldi e profondi in alto, nero e freddi chiari in basso; conta nell'ordine", () => {
  const [nero, oliva, ruggine, azzurro, panna, navyNome, jeans, tee, maglia] = m.prepara([
    capo("a", "felpa", "#191d1f", { colore: "nero" }), capo("b", "felpa", "#5f5e3a", { colore: "verde oliva" }),
    capo("c", "felpa", "#a0532f", { colore: "ruggine" }), capo("d", "felpa", "#bbcadb", { colore: "azzurro polvere" }),
    capo("e", "felpa", "#e5e5da", { colore: "panna" }), capo("f", "felpa", "#202428", { colore: "blu navy" }),
    capo("g", "jeans", "#1d2426"), capo("h", "t-shirt", "#1e2328", { colore: "blu notte" }),
    capo("i", "maglia manica lunga", "#333b48"),
  ]);
  assert.equal(maglia.slot, "mid", "la maglia a manica lunga si mette sopra");
  assert.ok(m.viso(oliva).voto > m.viso(panna).voto && m.viso(ruggine).voto > m.viso(panna).voto);
  assert.ok(m.viso(panna).voto > m.viso(azzurro).voto && m.viso(azzurro).voto > m.viso(nero).voto);
  assert.ok(m.viso(navyNome).voto > m.viso(nero).voto, "navy quasi nero non è nero");
  assert.match(m.viso(oliva).testo, /^Verde oliva vicino al viso/);
  assert.equal(m.giudizioPelle(m.pelleOutfit([oliva, tee, jeans])), "Valorizza");
  assert.equal(m.giudizioPelle(m.pelleOutfit([nero, tee, jeans])), "Spegne");
  const { outfit: o } = m.outfit(jeans, [nero, oliva, azzurro, tee, jeans]);
  const primo = o[0].pezzi.find((p) => p.slot === "mid");
  assert.equal(primo.id, "b", "a parità di armonia vince il colore che sta bene alla pelle");
  assert.ok(o.every((x) => typeof x.pelle === "number"));
});

test("percentuale del materiale cercato", () => {
  assert.equal(m.percentuale("8,6% lana, 91,4% acrilico", "lana"), 8.6);
  assert.equal(m.percentuale("8,6% lana, 91,4% acrilico", "acrilico"), 91.4);
  assert.equal(m.percentuale("cotone 98%, elastan 2%", "cotone"), 98);
  assert.equal(m.percentuale("70% cotone, 30% cotone riciclato", "cotone"), 100);
  assert.equal(m.percentuale("50% lana merino, 50% cotone", "merino"), 50);
  assert.equal(m.percentuale("pelle", "pelle"), 100);
  assert.equal(m.percentuale("100% cotone", "lana"), -1);
  assert.equal(m.percentuale("100% cotone", ""), -1);
  assert.equal(m.percentuale(undefined, "lana"), -1);
});

test("senza pelle nel profilo: niente voto pelle, outfit del giorno funziona", () => {
  m.impostaPelle(null);
  try {
    const capi = m.prepara([capo("1", "maglione", "#6b2a34"), capo("2", "t-shirt", "#f1f1ed"), capo("3", "jeans", "#2c3e5c")]);
    assert.equal(m.viso(capi[0]), null);
    assert.equal(m.outfit(capi[0], capi).outfit[0].pelle, undefined);
    assert.ok(m.delGiorno(capi, new Date(2026, 10, 23)).scelto);
  } finally { m.impostaPelle("#ddb095"); }
});

test("i capi da casa non entrano negli abbinamenti", () => {
  const capi = m.prepara([
    capo("1", "maglione", "#6b2a34"), capo("2", "t-shirt", "#f1f1ed"), capo("3", "jeans", "#2c3e5c"),
    capo("4", "pile", "#3b5772", { stato: "casa" }), capo("5", "felpa", "#5f5e3a"),
  ]);
  const ids = m.outfit(capi[1], capi).outfit.flatMap((o) => o.pezzi.map((p) => p.id));
  assert.ok(ids.includes("1") && !ids.includes("4"));
  assert.deepEqual(m.outfit(capi[3], capi), { outfit: [], mancanti: [] });
  assert.deepEqual(m.filtra(capi, { stato: "casa" }).map((c) => c.id), ["4"]);
  assert.ok(!m.filtra(capi, { stato: "attivo" }).some((c) => c.id === "4"));
});

test("ordine arcobaleno: solo sopra, bianchi → caldi → blu → verdi → neri", () => {
  const capi = m.prepara([
    capo("n", "t-shirt", "#222422"), capo("v", "maglione", "#2a322e"), capo("w2", "camicia", "#bcc7c5"), capo("b2", "maglione", "#254059"),
    capo("b1", "camicia", "#95bed5"), capo("m", "felpa", "#846d4f"), capo("g", "maglione", "#e6d78e"),
    capo("p", "maglione", "#e2dfc6"), capo("w", "camicia", "#e6e7dd"), capo("r", "maglione", "#cdb3b1"),
    capo("j", "jeans", "#e6e7dd"), capo("x", "t-shirt", "#ffffff", { stato: "dismesso" }),
    capo("k", "pile", "#141a20", { stato: "casa" }),
  ]);
  assert.deepEqual(m.ordineArcobaleno(capi).map((c) => c.id), ["w2", "w", "p", "g", "m", "r", "b1", "b2", "k", "v", "n"]);
});

test("outfit builder: più capi fissati, completa solo gli strati liberi", () => {
  const capi = m.prepara([
    capo("t", "t-shirt", "#f1f1ed"), capo("t2", "t-shirt", "#191d1f"), capo("f", "felpa", "#1f2a44"),
    capo("j", "jeans", "#33424d"), capo("j2", "jeans", "#dce1d4"), capo("s", "sneaker", "#f1f1ed"),
    capo("c", "cintura", "#3b3530"),
  ]);
  const [t, , f, j] = capi;
  const { outfit: o } = m.outfitDa([t, j], capi);
  assert.ok(o.length > 0);
  for (const x of o) {
    assert.ok(x.pezzi.includes(t) && x.pezzi.includes(j));
    assert.equal(new Set(x.pezzi.map((p) => p.slot)).size, x.pezzi.length); // uno per strato
  }
  for (let i = 1; i < o.length; i++) assert.ok(o[i - 1].punteggio >= o[i].punteggio - 0.5);
  // due capi nello stesso strato non stanno insieme
  assert.equal(m.outfitDa([t, capi[1]], capi).doppi, true);
  // tutti gli strati fissati: un solo outfit, quello
  assert.equal(m.outfitDa(capi.filter((c) => c.id !== "t2" && c.id !== "j2"), capi).outfit.length, 1);
  assert.deepEqual(m.outfitDa([f], capi).outfit[0].pezzi.length, m.outfit(f, capi).outfit[0].pezzi.length);
});

test("strato sopra facoltativo: d'estate la polo va da sola, d'inverno serve lo strato", () => {
  const estate = { stagione: ["primavera", "estate"] }, inverno = { stagione: ["autunno", "inverno"] };
  const capi = m.prepara([
    capo("polo", "polo", "#263c47", estate), capo("magl", "maglione", "#e2dfc6", { stagione: ["primavera", "autunno"] }),
    capo("j", "jeans", "#dce1d4", estate), capo("s", "sneaker", "#d2d4ce"),
    capo("jw", "jeans", "#1d2426", inverno), capo("mw", "maglione", "#2a322e", inverno),
  ]);
  const [polo, , , , jw] = capi;
  const { outfit: o } = m.outfit(polo, capi);
  assert.ok(!o[0].pezzi.some((p) => p.slot === "mid"), "la polo da sola batte la polo sotto il maglione");
  assert.ok(o.some((x) => x.pezzi.some((p) => p.slot === "mid")), "lo strato resta tra le proposte");
  // i jeans invernali non reggono un outfit senza strato
  for (const x of m.outfit(jw, capi).outfit) assert.ok(x.pezzi.some((p) => p.slot === "mid"));
});
