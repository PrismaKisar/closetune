// Gusto: le regole di stile della ricerca (ricerca/gusto-abbinamenti.md) tradotte in vincoli e punteggi.
// `gusto(pezzi)` dice se un outfit è vietato e di quanto alzarne o abbassarne il punteggio, con il perché.
// Soglie OKLCH = stime di lavoro della ricerca, da tarare sugli outfit approvati.

const dh = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const testo = (c) => `${c.categoria} ${c.modello ?? ""} ${c.colore ?? ""}`.toLowerCase();
const mat = (c) => (c.materiale ?? "").toLowerCase();

// ---------- attributi derivati dal file del capo ----------
/** Forma del capo per il layering: tipo di base o di strato. */
export function forma(c) {
  const t = testo(c);
  if (c.slot === "base") {
    if (/polo/.test(t)) return "polo";
    if (/camicia/.test(t)) {
      if (/lino/.test(mat(c)) || /coreano/.test(t)) return "camicia_lino";
      if (/stampa|monogram|fantasia|quadri|righe|pois/.test(t)) return "camicia_stampata";
      if (c.occasione?.includes("elegante")) return "camicia_elegante";
      return "oxford"; // camicia casual col colletto
    }
    return /stampa (grande|fotografica)|scritta|all-over/.test(t) ? "tee_grafica" : "tee";
  }
  if (c.slot !== "mid") return null;
  // il tipo lo dice la categoria; il modello solo i dettagli (una hoodie "con interno in pile" resta una hoodie)
  const cat = c.categoria.toLowerCase();
  if (/pile/.test(cat)) return /zip/.test(t) ? "pile_zip" : "pile";
  if (/giacca|giubbott|cappotto/.test(cat)) return "giacca";
  if (/cappuccio|hoodie/.test(t)) return /zip/.test(t) ? "hoodie_zip" : "hoodie";
  if (/felpa/.test(cat)) return /zip/.test(t) ? "hoodie_zip" : "felpa";
  if (/zip/.test(t)) return "maglia_zip";
  if (/dolcevita|collo alto/.test(t)) return "dolcevita";
  if (/scollo a v/.test(t)) return "scollo_v";
  return "girocollo";
}

/** Fantasia visibile: righe, quadri, pois, blocchi, stampa; null se tinta unita. */
export function fantasia(c) {
  const t = `${c.colore ?? ""} ${c.modello ?? ""}`.toLowerCase();
  if (/\bpois\b/.test(t)) return "pois";
  if (/quadri/.test(t)) return "quadri";
  if (/\brigh?[ea]\b|righe|a righ/.test(t)) return "righe";
  if (/blocchi/.test(t)) return "blocchi";
  if (/monogram|all-over|fantasia|multicolore/.test(t)) return "stampa";
  return null;
}

const denim = (c) => /denim|jeans/.test(`${c.categoria} ${c.materiale ?? ""}`.toLowerCase());
const pelleCuoio = (c) => /pelle|nabuk|camoscio|cuoio/.test(mat(c)) && !/tessuto/.test(mat(c));
const sneaker = (c) => /sneaker/i.test(c.categoria);
const stivale = (c) => /stival|boot/i.test(`${c.categoria} ${c.modello ?? ""}`);
// formalità: occasione più bassa del capo (0 sport … 3 elegante), dalla scala di abbinamenti.js
const soloElegante = (c) => c.formalita?.[0] >= 3;

// famiglie di colore usate dalle regole (OKLCH)
export const nero = ({ L, C }) => C < 0.03 && L < 0.32;
export const navy = ({ L, C, h }) => h >= 225 && h <= 275 && L < 0.42 && C >= 0.015 && C < 0.12;
export const marrone = ({ L, C, h }) => h >= 25 && h <= 95 && C >= 0.03 && L < 0.72;
const oliva = ({ L, C, h }) => h >= 100 && h <= 135 && C >= 0.03 && C < 0.09 && L < 0.58;
const tan = ({ L, C, h }) => h >= 50 && h <= 90 && C >= 0.03 && L >= 0.55 && L < 0.85;
/** Neutri estesi (Mr Porter): oltre a bianco/nero/grigi anche navy, beige/marrone, oliva. */
export const neutroEsteso = (lch) => lch.C < 0.035 || navy(lch) || (lch.h >= 50 && lch.h <= 95 && lch.C < 0.08) || oliva(lch);

// ---------- layering: base (riga) sotto strato (colonna) ----------
// V vietato · S sconsigliato · O ok · C consigliato. Camicie e polo sotto hoodie e felpe con zip: vietato
// per scelta dell'utente (più severo della ricerca, che tollera la oxford sotto la hoodie con zip).
const COLONNE = ["girocollo", "scollo_v", "maglia_zip", "dolcevita", "felpa", "hoodie", "hoodie_zip", "pile", "pile_zip", "giacca"];
const MATRICE = {
  tee:              "O C O O C C C C C C",
  tee_grafica:      "S S S O O O O O O O",
  polo:             "S S O V S V V S S O",
  oxford:           "C C C V O V V S S O",
  camicia_elegante: "O C S V S V V S S O",
  camicia_lino:     "S S S V S V V S S O",
  camicia_stampata: "S S S V S V V S S O",
};
const VOTO = { V: null, S: -0.12, O: 0, C: 0.05 };
const NOMI = {
  tee: "la t-shirt", tee_grafica: "la t-shirt stampata", polo: "la polo", oxford: "la camicia",
  camicia_elegante: "la camicia elegante", camicia_lino: "la camicia di lino", camicia_stampata: "la camicia stampata",
  girocollo: "un girocollo", scollo_v: "uno scollo a V", maglia_zip: "una maglia con zip", dolcevita: "un dolcevita",
  felpa: "una felpa", hoodie: "una felpa col cappuccio", hoodie_zip: "una felpa con zip", pile: "un pile", pile_zip: "un pile con zip", giacca: "una giacca",
};
export function strati(base, mid) {
  const fb = forma(base), fm = forma(mid);
  const cella = MATRICE[fb]?.split(" ")[COLONNE.indexOf(fm)] ?? "O";
  return { classe: cella, voto: VOTO[cella], testo: `${NOMI[fb]} sotto ${NOMI[fm]}` };
}

// ---------- contrasto personale (capelli vs pelle) ----------
let CONTRASTO = "medio";
/** Dal profilo: pelle in OKLCH e capelli a parole. Capelli scuri su pelle chiara = contrasto alto. */
export function impostaContrasto(pelle, capelli = "") {
  const Lcap = /nero|castano scuro/.test(capelli) ? 0.25 : /castano/.test(capelli) ? 0.4 : /rosso|ramat/.test(capelli) ? 0.5 : /biond/.test(capelli) ? 0.72 : null;
  if (!pelle || Lcap === null) { CONTRASTO = "medio"; return; }
  const d = pelle.L - Lcap;
  CONTRASTO = d > 0.45 ? "alto" : d < 0.25 ? "basso" : "medio";
}
const FASCIA = { alto: [0.25, 0.6], medio: [0.15, 0.45], basso: [0.12, 0.3] };

// ---------- il giudizio ----------
/** { vietato: motivo | null, delta: correzione del punteggio, note: [{ tipo, testo }] } */
export function gusto(pezzi) {
  const per = (s) => pezzi.find((p) => p.slot === s);
  const base = per("base"), mid = per("mid"), bottom = per("bottom"), shoes = per("shoes"), belt = per("belt");
  const note = [];
  let delta = 0;
  const no = (motivo) => ({ vietato: motivo, delta: 0, note: [] });

  // L1–L8 layering
  if (base && mid) {
    const s = strati(base, mid);
    if (s.voto === null) return no(`${cap(s.testo)}: non si porta.`);
    delta += s.voto;
    if (s.classe === "C") note.push({ tipo: "strati", testo: `${cap(s.testo)}: un classico.` });
    if (s.classe === "S") note.push({ tipo: "attenzione", testo: `${cap(s.testo)}: si può, ma stona un po'.` });
  }
  // solo a outfit completo: mentre si costruisce, la base può ancora arrivare
  if (mid && !base && bottom && shoes && /zip|giacca/.test(forma(mid))) return no(`Sotto ${NOMI[forma(mid)]} serve una base.`);

  // G2 lino con lana pesante o pile
  const lino = pezzi.find((p) => /lino/.test(mat(p)));
  if (lino && mid && mid !== lino) {
    const invernale = mid.stagione?.includes("inverno") && !mid.stagione?.includes("estate") && !mid.stagione?.includes("primavera");
    if (invernale) return no("Lino estivo con un capo invernale: stagioni opposte.");
    if (lino.slot === "base") { delta -= 0.06; note.push({ tipo: "attenzione", testo: "Lino sotto la maglia: meglio una camicia di cotone." }); }
  }

  // B1–B4 cintura e scarpe
  if (belt && shoes && !sneaker(shoes) && pelleCuoio(shoes) && pelleCuoio(belt)) {
    if ((nero(belt.lch) && marrone(shoes.lch)) || (marrone(belt.lch) && nero(shoes.lch)))
      return no("Cintura e scarpe in pelle, una nera e una marrone: mai.");
  }
  if (belt && shoes && soloElegante(shoes) && /tessuto/.test(mat(belt))) { delta -= 0.08; note.push({ tipo: "attenzione", testo: "Cintura in tessuto con scarpe eleganti." }); }

  // S2–S3 scarpe e formalità
  if (shoes && stivale(shoes) && pezzi.some(soloElegante)) return no("Stivali da lavoro con un capo elegante.");
  if (shoes && sneaker(shoes) && shoes.occasione?.includes("sportivo") && bottom && soloElegante(bottom)) { delta -= 0.1; note.push({ tipo: "attenzione", testo: "Sneaker sportive con pantalone elegante." }); }

  // K3 capi saturi, S1 sneaker colorate
  const grandi = pezzi.filter((p) => p.slot !== "belt");
  const saturi = grandi.filter((p) => p.lch.C > 0.15);
  if (saturi.length >= 3) return no("Tre capi accesi insieme: troppo.");
  if (saturi.length === 2 && dh(saturi[0].lch.h, saturi[1].lch.h) > 30) { delta -= 0.12; note.push({ tipo: "attenzione", testo: "Due colori accesi diversi: meglio un solo protagonista." }); }
  if (shoes && !shoes.neutro && shoes.lch.C > 0.08 && grandi.some((p) => p !== shoes && !p.neutro && p.lch.C > 0.1 && dh(p.lch.h, shoes.lch.h) > 40)) {
    delta -= 0.08; note.push({ tipo: "attenzione", testo: "Le scarpe colorate vogliono il resto neutro." });
  }

  // K2 numero di colori non neutri (la base conta solo se è ciò che si vede sopra)
  const visibili = [mid ?? base, bottom, shoes].filter(Boolean);
  const colori = visibili.filter((p) => !neutroEsteso(p.lch));
  if (colori.length <= 1) delta += 0.03;
  else if (colori.length === 2 && !(dh(colori[0].lch.h, colori[1].lch.h) < 60 || colori.every((p) => p.lch.C < 0.08))) delta -= 0.06;
  else if (colori.length >= 3) { delta -= 0.12; note.push({ tipo: "attenzione", testo: "Tre colori diversi: ne basta uno su una base neutra." }); }

  // T1–T3 contrasto sopra/sotto: campana sulla luminosità, centrata sul contrasto personale
  const top = mid ?? base;
  if (top && bottom) {
    const d = top.lch.L - bottom.lch.L, ad = Math.abs(d);
    const [lo, hi] = FASCIA[CONTRASTO];
    const totalNero = nero(top.lch) && nero(bottom.lch);
    if (ad < 0.06 && !totalNero) { delta -= 0.08; note.push({ tipo: "attenzione", testo: "Sopra e sotto hanno la stessa luce: effetto tuta." }); }
    else if (totalNero && ad < 0.05) delta -= 0.04;
    else if (ad >= lo && ad <= hi) delta += 0.06;
    else if (ad > hi && ad <= hi + 0.15) delta += 0.02;
    if (d > 0.06) delta += 0.02; // chiaro sopra, scuro sotto: il default
    // T6 navy e nero quasi uguali
    if (((navy(top.lch) && nero(bottom.lch)) || (nero(top.lch) && navy(bottom.lch))) && ad < 0.06 && !pezzi.some((p) => p.lch.L > 0.8)) {
      delta -= 0.08; note.push({ tipo: "attenzione", testo: "Navy e nero quasi uguali: sembra un errore, non una scelta." });
    }
  }

  // L10–L13 luce tra base e strato
  if (base && mid) {
    const d = base.lch.L - mid.lch.L;
    if (d > 0.06) delta += 0.02; // chiaro dentro, scuro fuori
    else if (d < -0.15) {
      if (forma(base) === "camicia_elegante") { delta -= 0.08; note.push({ tipo: "attenzione", testo: "Camicia elegante scura sotto una maglia chiara: stona." }); }
      else if (bottom && !(bottom.lch.L < 0.4 || (bottom.lch.L >= base.lch.L && bottom.lch.L <= mid.lch.L))) delta -= 0.04;
      else note.push({ tipo: "strati", testo: "Scuro sotto e chiaro sopra: funziona perché i pantaloni bilanciano." });
    }
    if (Math.abs(d) < 0.06 && dh(base.lch.h, mid.lch.h) < 20 && Math.abs(base.lch.C - mid.lch.C) < 0.03 && forma(mid) !== "dolcevita") delta -= 0.05;
  }

  // T5 denim su denim
  const jeans = pezzi.filter(denim);
  if (jeans.length >= 2) {
    const dL = Math.abs(jeans[0].lch.L - jeans[1].lch.L);
    if (dL >= 0.05 && dL <= 0.15) return no("Due denim quasi uguali: o identici o ben diversi.");
    if (dL > 0.2) delta += 0.04;
  }

  // K7 coppie note tra i capi grandi
  const coppie = [];
  for (let i = 0; i < visibili.length; i++) for (let j = i + 1; j < visibili.length; j++) coppie.push([visibili[i].lch, visibili[j].lch]);
  const c2 = (f, g) => coppie.some(([a, b]) => (f(a) && g(b)) || (f(b) && g(a)));
  if (c2(navy, marrone)) { delta += 0.05; note.push({ tipo: "colore", testo: "Navy e marrone: una coppia elegante." }); }
  if (c2(oliva, tan)) { delta += 0.05; note.push({ tipo: "colore", testo: "Oliva e tan: contrasto sottile e riuscito." }); }
  if (c2(nero, (x) => marrone(x) && x.L >= 0.3 && x.L <= 0.65)) delta -= 0.06;

  // K6 zona "fangosa" su un capo grande (giallo-verde spento a media luce)
  if ([mid, bottom].some((p) => p && p.lch.L > 0.42 && p.lch.L < 0.6 && p.lch.h > 95 && p.lch.h < 118 && p.lch.C > 0.04 && p.lch.C < 0.1 && !oliva(p.lch))) delta -= 0.03;

  // P1 fantasie
  const fant = [mid, base, bottom].filter(Boolean).map(fantasia).filter(Boolean);
  if (fant.length >= 3) { delta -= 0.12; note.push({ tipo: "attenzione", testo: "Tre fantasie insieme: troppe." }); }
  else if (fant.length === 2) {
    if (fant[0] === fant[1]) { delta -= 0.1; note.push({ tipo: "attenzione", testo: "Due fantasie uguali vicine: si confondono." }); }
    else delta -= 0.03;
  }

  return { vietato: null, delta, note };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
