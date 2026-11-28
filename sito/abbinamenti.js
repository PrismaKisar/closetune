// Logica pura dell'armadio: colore (OKLCH), filtri, punteggi di abbinamento, outfit e motivazioni.
import { gusto, impostaContrasto, neutroEsteso, peso as pesoTessuto } from "./gusto.js";
export { taraSuApprovati } from "./gusto.js";

// ---------- colore ----------
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function oklch(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [n >> 16, (n >> 8) & 255, n & 255].map((v) => lin(v / 255));
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

export const distanzaTinta = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

const SOGLIA_NEUTRO = 0.035;

export const FAMIGLIE = [
  ["chiari", "Bianchi e panna"], ["scuri", "Neri e scuri"], ["grigi", "Grigi"],
  ["terra", "Terra e beige"], ["gialli", "Gialli"], ["verdi", "Verdi"],
  ["blu", "Blu e azzurri"], ["rossi", "Rossi"], ["rosa", "Rosa e viola"],
];

// solo per i filtri: beige/panna (tinte calde) restano neutri fino a 0.035,
// rosa antico, navy e azzurri polvere si leggono come colore già da 0.02
export function famiglia({ L, C, h }) {
  const soglia = h >= 60 && h <= 130 ? SOGLIA_NEUTRO : 0.02;
  if (C < soglia) return L > 0.82 ? "chiari" : L < 0.42 ? "scuri" : "grigi";
  if (h >= 40 && h < 100 && C < 0.09) return "terra";
  if (h >= 345 || h < 40) return L > 0.7 ? "rosa" : "rossi";
  if (h < 105) return "gialli";
  if (h < 180) return "verdi";
  if (h < 290) return "blu";
  return "rosa";
}

// ---------- capi ----------
// Strati: una base (t-shirt, polo, camicia, maglia) sotto e uno strato sopra (felpa, pile, maglione, giacca).
// Due capi dello stesso strato non stanno mai nello stesso outfit.
export function slot(categoria) {
  const c = categoria.toLowerCase();
  if (/pantalon|jeans|bermuda|short/.test(c)) return "bottom";
  if (/sneaker|stival|scarp|mocassin/.test(c)) return "shoes";
  if (/cintur/.test(c)) return "belt";
  if (/felpa|pile|maglia|maglione|giacca|cardigan|gilet|cappotto|giubbott/.test(c)) return "mid";
  return "base";
}

export const TIPI = [
  ["tshirt", "T-shirt e polo"], ["camicie", "Camicie"], ["maglie", "Maglie"],
  ["maglioni", "Maglioni"], ["felpe", "Felpe"], ["capispalla", "Capispalla"],
  ["pantaloni", "Pantaloni"], ["scarpe", "Scarpe"], ["cinture", "Cinture"],
];

export function tipo(categoria) {
  const c = categoria.toLowerCase();
  if (/t-shirt|polo|canott/.test(c)) return "tshirt";
  if (/camicia/.test(c)) return "camicie";
  if (/maglione|cardigan/.test(c)) return "maglioni";
  if (/maglia/.test(c)) return "maglie";
  if (/felpa|pile/.test(c)) return "felpe";
  if (/giacca|cappotto|giubbott|gilet/.test(c)) return "capispalla";
  return { bottom: "pantaloni", shoes: "scarpe", belt: "cinture" }[slot(c)] ?? "maglie";
}

const LIVELLO = { sportivo: 0, outdoor: 0, vacanza: 0, casual: 1, "smart-casual": 2, elegante: 3, cerimonia: 4 };

/** Arricchisce i capi letti dall'API con i campi calcolati. */
export function prepara(capi) {
  return capi.map((c) => {
    const lch = oklch(c.hex);
    const livelli = (c.occasione || []).map((o) => LIVELLO[o]).filter((x) => x !== undefined);
    const s = slot(c.categoria || "");
    return {
      ...c,
      lch,
      slot: s,
      tipo: tipo(c.categoria || ""),
      famiglia: famiglia(lch),
      // il denim si comporta da neutro
      // navy, beige/marrone e oliva fanno da neutri (gusto.js); il denim pure
      neutro: neutroEsteso(lch) || (/jeans|denim/i.test(c.categoria + c.colore) && lch.C < 0.09),
      formalita: livelli.length ? [Math.min(...livelli), Math.max(...livelli)] : [1, 1],
      stagione: c.stagione || [],
      occasione: c.occasione || [],
      nomeColore: (c.colore || "").split(/ con | a | \(|\//)[0].trim(),
    };
  });
}

export function filtra(capi, f = {}) {
  const q = (f.testo || "").trim().toLowerCase();
  return capi.filter(
    (c) =>
      (!f.stato || f.stato === "tutti" || c.stato === f.stato) &&
      (!f.ruoli?.length || f.ruoli.includes(c.slot)) &&
      (!f.tipi?.length || f.tipi.includes(c.tipo)) &&
      (!f.famiglie?.length || f.famiglie.includes(c.famiglia)) &&
      (!f.stagioni?.length || f.stagioni.some((s) => c.stagione.includes(s))) &&
      (!f.occasioni?.length || f.occasioni.some((o) => c.occasione.includes(o))) &&
      (!q || [c.marca, c.categoria, c.colore, c.modello, c.materiale, c.id].join(" ").toLowerCase().includes(q)),
  );
}

const CAMPO_FILTRO = { stato: "stato", tipi: "tipo", famiglie: "famiglia", stagioni: "stagione", occasioni: "occasione" };

/** Conteggi a faccette: per ogni valore del gruppo, quanti capi passano gli ALTRI filtri attivi e hanno quel valore. */
export function faccette(capi, f, gruppo) {
  const conti = {};
  for (const c of filtra(capi, { ...f, [gruppo]: gruppo === "stato" ? "tutti" : [] }))
    for (const v of [c[CAMPO_FILTRO[gruppo]]].flat()) conti[v] = (conti[v] || 0) + 1;
  return conti;
}

/** Quota (0-100) del materiale cercato nella composizione; -1 se il materiale non c'entra. "pelle" senza % vale 100. */
export function percentuale(materiale, testo) {
  const q = (testo || "").trim().toLowerCase();
  if (!q || !materiale) return -1;
  let tot = -1;
  for (const pezzo of materiale.toLowerCase().split(/,(?!\d)/)) {
    if (!pezzo.includes(q)) continue;
    const n = pezzo.match(/(\d+(?:,\d+)?)\s*%/);
    tot = Math.max(tot, 0) + (n ? parseFloat(n[1].replace(",", ".")) : 100);
  }
  return Math.min(tot, 100);
}

// ---------- armonia ----------
export const RELAZIONI = {
  "neutro+colore": { nome: "Neutro e colore", base: 0.85 },
  neutri: { nome: "Solo neutri", base: 0.78 },
  monocromatico: { nome: "Stessa luce", base: 0.6 },
  "tono su tono": { nome: "Tono su tono", base: 0.74 },
  analoghi: { nome: "Analoghi", base: 0.78 },
  complementari: { nome: "Complementari", base: 0.86 },
  triade: { nome: "Triade", base: 0.68 },
  contrasto: { nome: "Toni slegati", base: 0.42 },
};

export function relazione(a, b) {
  const dL = Math.abs(a.lch.L - b.lch.L);
  if (a.neutro && b.neutro) return dL < 0.12 ? "monocromatico" : "neutri";
  if (a.neutro || b.neutro) return "neutro+colore";
  const dh = distanzaTinta(a.lch.h, b.lch.h);
  if (dh < 15) return "tono su tono";
  if (dh < 60) return "analoghi";
  if (dh >= 150) return "complementari";
  if (dh >= 100) return "triade";
  return "contrasto";
}

const PESI = {
  "bottom|mid": 1, "base|mid": 0.8, "base|bottom": 0.5, "bottom|shoes": 0.7, "mid|shoes": 0.4,
  "base|shoes": 0.2, "belt|shoes": 0.9, "belt|bottom": 0.4, "base|belt": 0.15, "belt|mid": 0.1,
};
// senza strato sopra la base è ciò che si vede: pesa come lo strato sopra
const peso = (a, b, conMid) => {
  const s = (x) => (x.slot === "base" && !conMid ? "mid" : x.slot);
  return PESI[[s(a), s(b)].sort().join("|")] ?? 0.3;
};

/** Cintura e scarpe: contano solo se in tinta (stessa luce e stesso grado di colore). */
function cinturaScarpe(belt, shoes) {
  const inTinta = Math.abs(belt.lch.L - shoes.lch.L) < 0.15 && Math.abs(belt.lch.C - shoes.lch.C) < 0.04;
  return { punteggio: inTinta ? 0.92 : 0.5, tipo: inTinta ? "in tinta" : "non in tinta" };
}

export function coppia(a, b) {
  const [belt, shoes] = a.slot === "belt" ? [a, b] : [b, a];
  if (belt.slot === "belt" && shoes.slot === "shoes") return cinturaScarpe(belt, shoes);
  const tipo = relazione(a, b);
  let p = RELAZIONI[tipo].base;
  // tinte lontane funzionano solo come piccolo accento (scarpe, cintura), non tra capi grandi
  const piccolo = [a, b].some((x) => x.slot === "shoes" || x.slot === "belt");
  if (!piccolo && (tipo === "complementari" || tipo === "triade")) p -= 0.18;
  const dL = Math.abs(a.lch.L - b.lch.L);
  if (tipo !== "monocromatico" && tipo !== "tono su tono") {
    if (dL < 0.1) p -= 0.12;
    else if (dL >= 0.2 && dL <= 0.6) p += 0.1;
  }
  if (tipo === "complementari" && a.lch.C > 0.12 && b.lch.C > 0.12) p -= 0.12; // troppo acceso
  return { punteggio: p, tipo };
}

// pelle: `pelle: "#hex"` nel frontmatter di profilo.md (misurata da un selfie calibrato sul foglio grigio).
// Senza, niente voto pelle. ponytail: le regole sotto valgono per sottotono caldo e contrasto alto;
// per altri profili servono regole per stagione-colore.
let PELLE = null;
export const impostaPelle = (hex, capelli) => { PELLE = hex ? oklch(hex) : null; impostaContrasto(PELLE, capelli); };
const distanzaOk = (a, b) => Math.hypot(a.L - b.L, a.C * Math.cos((a.h * Math.PI) / 180) - b.C * Math.cos((b.h * Math.PI) / 180), a.C * Math.sin((a.h * Math.PI) / 180) - b.C * Math.sin((b.h * Math.PI) / 180));

/** Quanto un capo vicino al viso valorizza la tua pelle: voto 0-1 (0.6 = indifferente) e il perché. */
export function viso(capo) {
  if (!PELLE || !capo || !["base", "mid"].includes(capo.slot)) return null;
  const { L, C, h } = capo.lch;
  const n = capo.nomeColore.charAt(0).toUpperCase() + capo.nomeColore.slice(1);
  const r = (voto, testo) => ({ voto, delta: voto - 0.6, testo: `${n} vicino al viso: ${testo}` });
  const caldo = h >= 20 && h < 120;
  if (C < SOGLIA_NEUTRO) {
    // scurissimi: il nero pieno indurisce, un blu o un verde quasi neri no (l'hex qui è quasi grigio, la tinta la dice il nome)
    if (L < 0.4) return /blu|navy|notte|verde|petrolio|marrone|bordeaux/i.test(capo.nomeColore) ? r(0.72, "scuro ma non nero, più morbido sulla pelle calda.") : r(0.42, "indurisce i lineamenti e spegne la carnagione calda.");
    if (L > 0.82) return caldo ? r(0.75, "un bianco sporco, più morbido del bianco ottico.") : r(0.5, "chiaro e freddo, meglio un panna o un ecru.");
    return caldo ? r(0.65, "un neutro caldo che non ruba la scena.") : r(0.5, "un grigio freddo che spegne un po' il sottotono caldo.");
  }
  if (distanzaOk(capo.lch, PELLE) < 0.08) return r(0.5, "troppo vicino al tono della pelle, ti sbiadisce.");
  if (h >= 20 && h < 110) {
    if (C > 0.18) return r(0.7, "caldo ma molto acceso, meglio in dosi piccole.");
    return L > 0.82 ? r(0.72, "chiaro e caldo; un tono più profondo ti valorizzerebbe di più.") : r(0.88, "caldo come la tua pelle, la illumina.");
  }
  if (h < 20 || h >= 345) return L < 0.5 ? r(0.85, "rosso profondo, ottimo con capelli e occhi scuri.") : r(0.7, "vivace; un tono più profondo ti valorizzerebbe di più.");
  if (h < 180) return L < 0.55 ? r(0.82, "verde profondo, fa risaltare il calore della pelle.") : r(0.6, "verde chiaro, neutro per la tua carnagione.");
  if (h < 280) return L < 0.5 ? r(0.8, "uno dei blu che stanno meglio alla tua carnagione.") : L < 0.72 ? r(0.62, "blu medio, neutro per la tua carnagione.") : r(0.48, "azzurro chiaro e freddo, tende a spegnere il sottotono caldo.");
  return L > 0.7 ? r(0.4, "pastello freddo, non aiuta il sottotono caldo.") : r(0.6, "neutro per la tua carnagione.");
}

/** Pelle dell'outfit: conta soprattutto lo strato esterno, un po' il colletto che spunta sotto. */
export function pelleOutfit(pezzi) {
  const mid = viso(pezzi.find((x) => x.slot === "mid")), base = viso(pezzi.find((x) => x.slot === "base"));
  if (mid && base) return 0.7 * mid.voto + 0.3 * base.voto;
  return (mid ?? base)?.voto ?? 0.6;
}

export const giudizioPelle = (v) => (v >= 0.8 ? "Valorizza" : v >= 0.65 ? "Bene" : v >= 0.55 ? "Neutro" : "Spegne");

const distanzaFormale = (pezzi) => {
  const lo = Math.max(...pezzi.map((p) => p.formalita[0]));
  const hi = Math.min(...pezzi.map((p) => p.formalita[1]));
  return Math.max(0, lo - hi);
};

export function punteggioOutfit(pezzi, approvati = []) {
  const g = gusto(pezzi);
  if (g.vietato) return 0;
  let somma = 0, pesi = 0;
  const conMid = pezzi.some((x) => x.slot === "mid");
  for (let i = 0; i < pezzi.length; i++)
    for (let j = i + 1; j < pezzi.length; j++) {
      const coppiaPz = [pezzi[i], pezzi[j]];
      const scarpa = coppiaPz.find((x) => x.slot === "shoes");
      // con le sneaker la cintura in tinta conta poco
      const conCintura = coppiaPz.some((x) => x.slot === "belt");
      // con le sneaker, o con la cintura coperta da maglione o felpa, la cintura in tinta conta poco
      const w = conCintura && scarpa && /sneaker/i.test(scarpa.categoria) ? 0.3 : conCintura && conMid ? 0.5 * peso(pezzi[i], pezzi[j], conMid) : peso(pezzi[i], pezzi[j], conMid);
      somma += w * coppia(pezzi[i], pezzi[j]).punteggio;
      pesi += w;
    }
  let p = pesi ? somma / pesi : 0;
  p -= 0.12 * distanzaFormale(pezzi);
  p += 0.4 * (pelleOutfit(pezzi) - 0.6); // quanto sta bene con la tua pelle: da -0.08 a +0.11
  p += g.delta; // regole di stile (gusto.js)
  const ids = new Set(pezzi.map((x) => x.id));
  if (approvati.some((o) => o.length && o.every((id) => ids.has(id)))) p += 0.15;
  // tetto morbido: sopra 0.9 il punteggio si avvicina a 1 senza toccarlo, così i migliori restano in ordine
  if (p > 0.9) p = 0.9 + 0.1 * (1 - Math.exp(-(p - 0.9) / 0.1));
  return Math.max(0, Math.min(1, p));
}

const vicinoAlViso = (pezzi) => pezzi.find((x) => x.slot === "mid") ?? pezzi.find((x) => x.slot === "base");

// la base sta sotto uno strato: si porta in ogni stagione; le scarpe si usano tutte tutto l'anno
const stagioni = (c) => (c.slot === "base" || c.slot === "shoes" || !c.stagione.length ? ["primavera", "estate", "autunno", "inverno"] : c.stagione);
const sovrapponeStagione = (a, b) => stagioni(a).some((s) => stagioni(b).includes(s));
// senza strato sopra: solo se tutti i pezzi (con le stagioni vere, anche della base) reggono primavera o estate
const caldo = ["primavera", "estate"];
const senzaStrato = (pezzi) => pezzi.some((p) => p.slot === "base") &&
  caldo.some((s) => pezzi.every((p) => !p.stagione.length || p.stagione.includes(s)));
const stagioneComune = (pezzi) =>
  ["primavera", "estate", "autunno", "inverno"].some((s) => pezzi.every((p) => stagioni(p).includes(s)));

/** `c` può stare con i capi `fissi`? Stagione in comune, formalità vicina, nessuna regola di gusto violata. */
export const staBene = (fissi, c) =>
  fissi.every((f) => sovrapponeStagione(f, c)) && distanzaFormale([...fissi, c]) <= 1 && !gusto([...fissi, c]).vietato;

export const NOMI_SLOT = { base: "t-shirt, polo o camicia", mid: "felpa, pile o maglione", bottom: "pantaloni", shoes: "scarpe", belt: "cintura" };

/** Gli outfit attorno al capo scelto, presi da `pool` (già filtrato per stato): tutte le combinazioni
 * dei `perSlot` capi migliori per ruolo, dal migliore in giù, alternando i pezzi per non ripetersi. */
export function outfit(scelto, pool, opzioni = {}) {
  return outfitDa([scelto], pool, opzioni);
}

/** Come `outfit`, ma attorno a più capi fissati (l'outfit builder): uno per strato, il resto si completa. */
export function outfitDa(fissi, pool, { n = Infinity, approvati = [], perSlot = 6 } = {}) {
  const scelto = fissi[0];
  // i capi da casa (stato: casa) sono censiti ma non entrano mai negli abbinamenti
  if (!scelto || fissi.some((f) => f.stato === "casa")) return { outfit: [], mancanti: [] };
  const occupati = fissi.map((f) => f.slot);
  if (new Set(occupati).size < occupati.length) return { outfit: [], mancanti: [], doppi: true };
  const vietato = gusto(fissi).vietato;
  if (vietato) return { outfit: [], mancanti: [], vietato };
  pool = pool.filter((c) => c.stato !== "casa");
  const servono = ["base", "mid", "bottom", "shoes", "belt"].filter((s) => !occupati.includes(s));
  const candidati = {};
  const mancanti = [];
  for (const s of servono) {
    const lista = pool
      .filter((c) => c.slot === s && staBene(fissi, c))
      .map((c) => ({ c, p: punteggioOutfit([...fissi, c], approvati) }))
      .sort((a, b) => b.p - a.p)
      .slice(0, perSlot)
      .map((x) => x.c);
    if (lista.length) candidati[s] = lista;
    else mancanti.push(s);
  }
  // ponytail: perSlot^4 combinazioni (1296 con 6), ordinamento O(n²); alzare perSlot solo con un ordinamento più furbo
  // lo strato sopra è facoltativo: d'estate la base si porta da sola (null = niente strato)
  const opzionaleMid = servono.includes("mid");
  if (opzionaleMid) candidati.mid = [...(candidati.mid ?? []), null];
  let combo = [fissi];
  for (const s of Object.keys(candidati)) combo = combo.flatMap((pz) => candidati[s].map((c) => (c ? [...pz, c] : pz)));
  combo = combo.filter((pz) => pz.some((p) => p.slot === "mid") || senzaStrato(pz));
  if (!combo.length || (combo.length === 1 && combo[0].length === 1)) return { outfit: [], mancanti };
  // se la base basta da sola, lo strato sopra non "manca"
  if (mancanti.includes("mid") && combo.some((pz) => !pz.some((p) => p.slot === "mid"))) mancanti.splice(mancanti.indexOf("mid"), 1);
  const restanti = combo.filter((pz) => stagioneComune(pz) && !gusto(pz).vietato).map((pezzi) => ({ pezzi, punteggio: punteggioOutfit(pezzi, approvati) }));

  // varietà: ogni volta che un pezzo è già stato proposto, i suoi outfit successivi scendono un po'
  const uso = new Map();
  const scelti = [];
  while (scelti.length < n && restanti.length) {
    let iMigliore = 0, best = -Infinity;
    restanti.forEach((v, i) => {
      const ripetuti = v.pezzi.reduce((k, p) => k + (fissi.includes(p) ? 0 : uso.get(p.id) ?? 0), 0);
      const s = v.punteggio - 0.08 * ripetuti;
      if (s > best) [best, iMigliore] = [s, i];
    });
    const [migliore] = restanti.splice(iMigliore, 1);
    for (const p of migliore.pezzi) uso.set(p.id, (uso.get(p.id) ?? 0) + 1);
    scelti.push(migliore);
  }
  return { outfit: scelti.map((o) => ({ ...o, pelle: PELLE ? pelleOutfit(o.pezzi) : undefined, perche: perche(o.pezzi, scelto, approvati) })), mancanti };
}

/** Riordina gli outfit: prima gli `n` migliori davvero diversi tra loro (scelta golosa per punteggio,
 * con una penalità per i pezzi in comune con quelli già scelti: pesano di più i pezzi grandi,
 * quasi nulla la cintura), poi tutti gli altri dal migliore. */
const PESO_PEZZO = { mid: 3, base: 2, bottom: 3, shoes: 2, belt: 0.5 };
export function diversi(outfit, n = 5, forza = 0.35) {
  const peso = (pz) => pz.reduce((s, p) => s + PESO_PEZZO[p.slot], 0);
  const simile = (a, b) => peso(a.pezzi.filter((p) => b.pezzi.includes(p))) / Math.max(peso(a.pezzi), peso(b.pezzi));
  const resto = [...outfit].sort((a, b) => b.punteggio - a.punteggio);
  const scelti = [];
  while (scelti.length < n && resto.length) {
    let i = 0, best = -Infinity;
    resto.forEach((o, j) => {
      const s = o.punteggio - forza * Math.max(0, ...scelti.map((x) => simile(o, x)));
      if (s > best) [best, i] = [s, j];
    });
    scelti.push(...resto.splice(i, 1));
  }
  return [...scelti, ...resto];
}

/** Un outfit già fatto (es. un preferito) con voto, pelle e motivi, come quelli proposti. */
export const valuta = (pezzi, scelto = pezzi[0], approvati = []) =>
  ({ pezzi, punteggio: punteggioOutfit(pezzi, approvati), pelle: PELLE ? pelleOutfit(pezzi) : undefined, perche: perche(pezzi, scelto, approvati) });

export function giudizio(p) {
  return p >= 0.85 ? "Ottimo" : p >= 0.72 ? "Buono" : p >= 0.55 ? "Discreto" : "Azzardato";
}

// ---------- titolo dell'outfit: i colori che si vedono, in parole semplici ----------
// il nome del colore vince sull'hex: un verde quasi nero resta "verde", non "nero"
const PAROLE = [
  [/navy|notte/, "navy"], [/petrolio/, "petrolio"], [/azzurr|celeste|university/, "azzurro"], [/blu/, "blu"],
  [/panna|ecru|crema|avorio/, "panna"], [/bianc/, "bianco"], [/ner[oa]/, "nero"], [/grigi|antracite|melange/, "grigio"],
  [/verde|oliva|militare/, "verde"], [/beige|tortora|sabbia|kaki/, "beige"], [/wheat|cuoio|cognac|cammello|tabacco/, "cuoio"],
  [/marron|moro/, "marrone"], [/giall|senape/, "giallo"], [/bordeaux/, "bordeaux"], [/rosa/, "rosa"], [/ross/, "rosso"],
];
const DA_FAMIGLIA = { chiari: "bianco", scuri: "nero", grigi: "grigio", terra: "beige", gialli: "giallo", verdi: "verde", blu: "blu", rossi: "rosso", rosa: "rosa" };
const NEUTRE = new Set(["navy", "panna", "bianco", "nero", "grigio", "beige", "cuoio", "marrone", "denim", "denim chiaro", "denim scuro"]);
const CALDE = new Set(["beige", "cuoio", "marrone", "giallo", "rosso", "bordeaux"]);

export function parolaColore(p) {
  const nome = (p.nomeColore || p.colore || "").toLowerCase();
  if (/jeans|denim/.test(`${p.categoria} ${nome}`) && !/^(ner|bianc|panna)/.test(nome))
    return p.lch.L > 0.6 ? "denim chiaro" : p.lch.L < 0.4 ? "denim scuro" : "denim";
  const w = PAROLE.find(([re]) => re.test(nome))?.[1] ?? DA_FAMIGLIA[p.famiglia ?? famiglia(p.lch)];
  // "bianco/nero": decide la luce misurata
  if ((w === "bianco" || w === "panna") && p.lch.L < 0.4) return "nero";
  return w === "nero" && p.lch.L > 0.75 ? "bianco" : w;
}

/** Titolo breve e descrittivo dai colori veri: "Panna e denim", "Scuro con accento azzurro", "Nero su nero"... */
export function titoloOutfit(pezzi) {
  const per = (s) => pezzi.find((p) => p.slot === s);
  const sopra = per("mid") ?? per("base"), sotto = per("bottom");
  const visti = pezzi.filter((p) => p.slot !== "belt");
  const grandi = [sopra, sotto].filter(Boolean);
  if (!grandi.length) return "Abbinamento";
  const w = (p) => parolaColore(p);
  const [a, b = a] = grandi.map(w);
  const tutti = new Set(visti.map(w));
  if (tutti.size === 1) return `Tutto ${a}`;
  const accenti = visti.filter((p) => !NEUTRE.has(w(p)));
  if (visti.every((p) => p.lch.L > 0.72)) return "Tutto chiaro";
  if (!accenti.length && visti.every((p) => p.lch.L < 0.4)) return "Tutto scuro";
  // un solo colore, e su un pezzo piccolo (scarpe o colletto sotto lo strato): è un accento
  if (accenti.length === 1 && !grandi.includes(accenti[0])) {
    const c = w(accenti[0]);
    if (grandi.every((p) => p.lch.L < 0.4)) return `Scuro con accento ${c}`;
    if (grandi.every((p) => p.lch.L > 0.72)) return `Chiaro con accento ${c}`;
    return a === b ? `${cap(a)} con accento ${c}` : `${cap(a)} e ${b}, accento ${c}`;
  }
  if (visti.length >= 3 && visti.every((p) => CALDE.has(w(p)))) return "Toni caldi";
  if (a === b) return `${cap(a)} su ${a}`;
  return `${cap(a)} e ${b}`;
}

// ---------- motivazioni ----------
const FRASI = {
  "neutro+colore": (a, b) => {
    const [col, neu] = a.neutro ? [b, a] : [a, b];
    return `Il ${col.nomeColore} è l'unico colore pieno: il ${neu.nomeColore} gli fa da cornice.`;
  },
  neutri: (a, b) => `${cap(a.nomeColore)} e ${b.nomeColore} fanno entrambi da base neutra: stanno insieme grazie allo stacco tra chiaro e scuro.`,
  monocromatico: (a, b) => `${cap(a.nomeColore)} e ${b.nomeColore} hanno quasi la stessa luce: effetto total look.`,
  "tono su tono": (a, b) => `${cap(a.nomeColore)} e ${b.nomeColore} sono la stessa tinta a intensità diverse: tono su tono.`,
  analoghi: (a, b) => `${cap(a.nomeColore)} e ${b.nomeColore} sono vicini sulla ruota: passaggio morbido, senza stacchi.`,
  complementari: (a, b) => `${cap(a.nomeColore)} e ${b.nomeColore} stanno ai lati opposti della ruota: si accendono a vicenda.`,
  triade: (a, b) => `${cap(a.nomeColore)} e ${b.nomeColore} distano un terzo di ruota: contrasto vivace ma in equilibrio.`,
  contrasto: (a, b) => `${cap(a.nomeColore)} e ${b.nomeColore} non hanno un legame cromatico: è la scelta più rischiosa.`,
};
const STRATI = {
  "neutro+colore": "un neutro che non disturba", neutri: "uno stacco pulito tra due neutri",
  monocromatico: "quasi invisibile, effetto continuo", "tono su tono": "stessa tinta, profondità in più",
  analoghi: "stessa famiglia di colore", complementari: "un piccolo contrasto deciso",
  triade: "un tocco vivace", contrasto: "un accostamento azzardato",
};
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export function perche(pezzi, scelto, approvati = []) {
  const per = (s) => pezzi.find((p) => p.slot === s);
  // la coppia che si vede di più: strato esterno e pantaloni
  const a = vicinoAlViso(pezzi) ?? scelto;
  const b = per("bottom") && per("bottom") !== a ? per("bottom") : pezzi.find((p) => p !== a);
  const righe = [];
  if (b) {
    const tipo = relazione(a, b);
    righe.push({ tipo, testo: FRASI[tipo](a, b) });
    const dL = Math.abs(a.lch.L - b.lch.L);
    if (tipo !== "monocromatico")
      righe.push({
        tipo: "luce",
        testo: dL >= 0.35 ? "Forte stacco chiaro/scuro tra sopra e sotto." : dL >= 0.15 ? "Contrasto di luce moderato tra sopra e sotto." : "Sopra e sotto hanno luce simile: lo stacco lo danno scarpe e cintura.",
      });
  }
  const base = per("base"), mid = per("mid");
  if (base && mid) {
    const r = relazione(base, mid);
    // neutro+colore: conta quale dei due è il neutro
    const come = r === "neutro+colore" && !base.neutro ? "un tocco di colore sotto un neutro" : STRATI[r];
    righe.push({ tipo: "strati", testo: `Dal collo spunta il ${base.nomeColore}: ${come}.` });
  }
  const belt = per("belt"), shoes = per("shoes");
  if (belt && shoes && !/sneaker/i.test(shoes.categoria))
    righe.push({ tipo: "cintura", testo: cinturaScarpe(belt, shoes).tipo === "in tinta" ? "Cintura in tinta con le scarpe." : "Cintura e scarpe non sono in tinta: meglio una cintura più vicina alle scarpe." });
  const v = viso(a);
  if (v) righe.push({ tipo: "viso", testo: v.testo });
  righe.push(...gusto(pezzi).note.slice(0, 2));
  const ids = new Set(pezzi.map((x) => x.id));
  if (approvati.some((o) => o.length && o.every((id) => ids.has(id)))) righe.push({ tipo: "approvato", testo: "È tra i tuoi preferiti." });
  return righe;
}

const STAGIONE_MESE = ["inverno", "inverno", "primavera", "primavera", "primavera", "estate", "estate", "estate", "autunno", "autunno", "autunno", "inverno"];
export const stagioneDi = (data) => STAGIONE_MESE[data.getMonth()];

// mulberry32: stesso seme, stessa sequenza
const caso = (n) => () => {
  n = (n + 0x6d2b79f5) | 0;
  let t = Math.imul(n ^ (n >>> 15), 1 | n);
  t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// ---------- meteo: la temperatura di oggi al posto del mese ----------
/** Stagioni dei capi adatte a una giornata (`meteo` = { min, max, pioggia } in °C e % di probabilità). */
export function stagioniMeteo({ min, max }) {
  const m = (min + max) / 2;
  return m >= 22 ? ["estate"] : m >= 15 ? ["primavera", "estate", "autunno"] : m >= 8 ? ["primavera", "autunno", "inverno"] : ["inverno"];
}
/** Con la pioggia non si esce con le scarpe in tela. */
export const temePioggia = (c) => c.slot === "shoes" && /tela|canvas/i.test(`${c.materiale ?? ""} ${c.modello ?? ""}`);
const PIOVE = 50;

/** L'outfit del giorno: stesso giorno e stesso `giro` danno lo stesso outfit; `giro` + 1 ne propone un altro.
 * Parte da uno strato di sopra della stagione (d'estate dalla base), poi pesca tra i 3 migliori attorno a lui.
 * Con `meteo` la stagione la decide la temperatura di oggi e con la pioggia restano a casa le scarpe in tela. */
export function delGiorno(pool, data = new Date(), giro = 0, approvati = [], meteo = null) {
  const stagione = stagioneDi(data);
  const valide = meteo ? stagioniMeteo(meteo) : [stagione];
  const asciutto = (c) => !(meteo?.pioggia >= PIOVE && temePioggia(c));
  const diStagione = (c) => stagioni(c).some((s) => valide.includes(s));
  // per ogni ruolo: il capo giusto; se non c'è, meglio uno asciutto fuori stagione che niente
  const adatti = [...new Set(pool.map((c) => c.slot))].flatMap((slot) => {
    const qui = pool.filter((c) => c.slot === slot);
    for (const ok of [(c) => asciutto(c) && diStagione(c), asciutto, diStagione]) if (qui.some(ok)) return qui.filter(ok);
    return qui;
  });
  const r = caso(data.getFullYear() * 10000 + (data.getMonth() + 1) * 100 + data.getDate() + giro * 7919);
  // si parte da un capo che sta bene col viso (se ce n'è almeno uno)
  const ok = (c) => (viso(c)?.voto ?? 0.6) >= 0.6;
  const amici = (lista) => (lista.some(ok) ? lista.filter(ok) : lista);
  const media = meteo && (meteo.min + meteo.max) / 2;
  const estivo = meteo ? media >= 22 : stagione === "estate";
  // col freddo vero si parte da uno strato pesante, a mezza stagione da uno leggero
  const giusto = (c) => !meteo || (media < 10 ? pesoTessuto(c) >= 3 : media >= 15 ? pesoTessuto(c) <= 2 : true);
  const mid = adatti.filter((c) => c.slot === "mid");
  const sopra = amici(mid.some(giusto) ? mid.filter(giusto) : mid);
  const partenze = !estivo && sopra.length ? sopra : amici(adatti.filter((c) => c.slot === "base"));
  if (!partenze.length) return { stagione, scelto: null, outfit: null };
  const scelto = partenze[Math.floor(r() * partenze.length)];
  const { outfit: migliori } = outfit(scelto, adatti, { n: 3, approvati });
  return { stagione, scelto, adatti, outfit: migliori[Math.floor(r() * migliori.length)] ?? null };
}

/** Le alternative a un pezzo dell'outfit (ruolo `slot`), con gli altri pezzi fermi: dalla migliore. */
export function alternative(pezzi, slot, pool, approvati = []) {
  const altri = pezzi.filter((p) => p.slot !== slot);
  return pool.filter((c) => c.slot === slot && !pezzi.includes(c))
    .map((c) => [...altri, c])
    .filter((pz) => stagioneComune(pz) && !gusto(pz).vietato)
    .map((pz) => valuta(pz, pz.at(-1), approvati))
    .sort((a, b) => b.punteggio - a.punteggio);
}

// ---------- ordine arcobaleno ----------
/** Capi sopra (base e strato), attivi e da casa, nell'ordine in cui appenderli:
 * bianchi → panna/beige → caldi (beige, giallo, senape, marrone, rosa) → blu dal chiaro allo scuro → verdi → neri. */
export function ordineArcobaleno(capi) {
  const gruppo = ({ L, C, h }) =>
    C < 0.008 ? 4 : L > 0.8 && (C < 0.014 || (h > 60 && h < 130 && C < 0.045)) ? 0 : h < 130 || h >= 290 ? 1 : h < 200 ? 3 : 2;
  // nei caldi la tinta scende da beige/giallo a rosa (viola = tinta negativa, dopo il rosa)
  const chiave = (c) => {
    const g = gruppo(c.lch);
    return [g, g === 0 ? c.lch.C : g === 1 ? -(c.lch.h >= 290 ? c.lch.h - 360 : c.lch.h) : -c.lch.L];
  };
  return capi
    .filter((c) => (c.slot === "base" || c.slot === "mid") && (c.stato === "attivo" || c.stato === "casa"))
    .map((c) => [chiave(c), c])
    .sort(([a], [b]) => a[0] - b[0] || a[1] - b[1])
    .map(([, c]) => c);
}
