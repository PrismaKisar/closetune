import { USCITE, perOccasione, vaPer, mancaPer, diversi, staBene, FAMIGLIE, NOMI_SLOT, TIPI, titoloOutfit, delGiorno, effetto, faccette, filtra, giudizio, giudizioPelle, impostaPelle, ordineArcobaleno, outfit, outfitDa, percentuale, prepara, taraSuApprovati, valuta, alternative } from "./abbinamenti.js";

const STAGIONI = ["primavera", "estate", "autunno", "inverno"];
const OCCASIONI = ["casual", "smart-casual", "elegante", "sportivo", "outdoor"];
const RUOLO = { mid: "Felpa o maglione", base: "Maglia o camicia", bottom: "Pantaloni", shoes: "Scarpe", belt: "Cintura" };
const ETICHETTA_STATO = { dismesso: "dismesso", casa: "da casa" };
const ORDINE = { mid: 0, base: 1, bottom: 2, shoes: 3, belt: 4 };
// tinta rappresentativa di ogni famiglia, per i campioni dei filtri
const TINTA = { chiari: "#efeadb", scuri: "#1e1e20", grigi: "#8d8f91", terra: "#b99a6b", gialli: "#d8aa44", verdi: "#5f7d55", blu: "#2d4a6e", rossi: "#a83a32", rosa: "#c99a95" };

const st = {
  capi: [], approvati: [],
  f: { stato: "attivo", tipi: [], famiglie: [], stagioni: [], occasioni: [], testo: "" },
  pool: "attivo",
  giro: 0, // "Un altro outfit" / "Precedente" in Oggi
  uscita: localStorage.getItem("closetune-uscita") ?? "casual", // "Oggi vado a…"
};

function sceltaUscita() {
  return `<div class="uscita"><span id="uscita-titolo">Oggi vado a…</span>
    <div class="seg" role="group" aria-labelledby="uscita-titolo">${USCITE.map(([v, t]) => `<button type="button" data-uscita="${v}" aria-pressed="${st.uscita === v}">${t}</button>`).join("")}</div></div>`;
}
// null se l'occasione si può vestire, altrimenti l'avviso con cosa manca
function avvisoUscita(pool) {
  const manca = mancaPer(pool, st.uscita);
  if (!manca.length) return null;
  const nome = USCITE.find(([v]) => v === st.uscita)[1].toLowerCase();
  return `<p class="avviso">Per ${esc(nome)} ti mancano: <b>${esc(manca.map((s) => NOMI_SLOT[s]).join(", "))}</b>. Fotografa e censisci quei capi e compariranno qui.</p>`;
}
const $ = (s, el = document) => el.querySelector(s);
const main = $("#contenuto");
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const cap = (s = "") => s.charAt(0).toUpperCase() + s.slice(1);
const marca = (c) => (/^sconosciut/i.test(c.marca || "") ? "" : c.marca || "");

// ---------- pezzi riusabili ----------
function visuale(c, grande = false) {
  if (c.foto && !c.foto_collage)
    return `<img src="${esc(c.foto_web || c.foto)}" alt="${esc(cap(c.categoria))} ${esc(c.colore)}${marca(c) ? ", " + esc(marca(c)) : ""}" ${grande ? "" : 'loading="lazy"'} decoding="async">`;
  // multicolore: il dominante pieno, i secondari in fasce sul fondo
  const sec = (c.hex_secondari || []).filter((h) => /^#[0-9a-f]{6}$/i.test(h));
  const fasce = sec.length ? `;--fasce:linear-gradient(${sec.map((h, i) => `${h} ${(i * 100) / sec.length}% ${((i + 1) * 100) / sec.length}%`).join(",")})` : "";
  return `<div class="campione${sec.length ? " multi" : ""}" style="--c:${esc(c.hex)}${fasce}" role="img" aria-label="${esc(cap(c.categoria))} ${esc(c.colore)}, senza foto">${sagoma(c.slot)}<span>foto mancante</span></div>`;
}
// senza foto: la sagoma del tipo di capo nel suo colore
const SAGOME = {
  mid: "M22 9h5q5 6 10 0h5l14 13 2 28-7 1-4-21v26H17V30l-4 21-7-1 2-28Z",
  base: "M23 10h4q5 7 10 0h4l14 8-5 10-5-3v29H19V25l-5 3-5-10Z",
  bottom: "M19 8h26l3 50H36l-4-32-4 32H16Z",
  shoes: "M8 40c0-8 4-14 8-14s6 6 14 7l16 3c8 1 12 5 12 10v4H8Z",
  belt: "M4 28h56v8H4Z",
};
const sagoma = (s) => `<svg class="sagoma" viewBox="0 0 64 64" aria-hidden="true"><path d="${SAGOME[s] ?? SAGOME.base}"/>${s === "belt" ? '<rect class="fibbia" x="40" y="24" width="10" height="16" rx="2"/>' : ""}</svg>`;

// tipo prima, poi colore, la marca per ultima; pos = posto nell'ordine per colore
function carta(c, pos) {
  return `<li class="carta">${c.stato === "attivo" ? `<a class="carta-componi" href="#crea/${esc(c.id)}" aria-label="Componi un outfit con ${esc(nomeCapo(c))}" title="Componi un outfit con questo">${GRUCCIA}</a>` : ""}<a class="capo${c.stato !== "attivo" ? " spento" : ""}" href="#capo/${esc(c.id)}">
    <div class="cornice">${visuale(c)}${pos ? `<span class="pos">${pos}</span>` : ""}</div>
    <div class="capo-testo">
      <span class="nome">${esc(cap(c.categoria))}</span>
      <span class="colore"><i style="--c:${esc(c.hex)}"></i>${esc(c.nomeColore)}${c.stato !== "attivo" ? ` <em>${ETICHETTA_STATO[c.stato] ?? esc(c.stato)}</em>` : ""}</span>
      ${marca(c) ? `<span class="marca-capo">${esc(marca(c))}</span>` : ""}
    </div>
  </a></li>`;
}

const chip = (gruppo, v, etichetta, attivo, n = 0) =>
  `<button type="button" class="chip" data-f="${gruppo}" data-v="${esc(v)}" aria-pressed="${attivo}" ${n || attivo ? "" : "disabled"}>${etichetta}<b>${n}</b></button>`;
const STATI = [["attivo", "Attivi"], ["casa", "Da casa"], ["dismesso", "Dismessi"], ["tutti", "Tutti"]];
const NOMI_FILTRO = { tipi: Object.fromEntries(TIPI), famiglie: Object.fromEntries(FAMIGLIE), stagioni: {}, occasioni: {} };
const nCapi = (n) => `${n} ${n === 1 ? "capo" : "capi"}`;

// ---------- vista armadio ----------
function vistaArmadio() {
  main.innerHTML = `<div class="armadio">
    <aside class="filtri" id="filtri" aria-label="Filtri">
      <div class="filtri-testa"><h2>Filtri</h2><button type="button" class="chiudi" data-chiudi aria-label="Chiudi i filtri">×</button></div>
      ${[["famiglie", "Colore", "chips"], ["stagioni", "Stagione", "chips"], ["occasioni", "Occasione", "chips"], ["stato", "Stato", "seg"]].map(([g, t, k]) =>
        `<details class="gruppo"${g === "famiglie" || (g === "stato" ? st.f.stato !== "attivo" : st.f[g].length) ? " open" : ""}><summary id="t-${g}">${t}</summary><div class="${k}" id="f-${g}" role="group" aria-labelledby="t-${g}"></div></details>`).join("")}
      <button type="button" class="btn mostra" id="mostra" data-chiudi></button>
    </aside>
    <section class="vetrina" aria-labelledby="titolo-vetrina">
      <div class="vetrina-testa"><h1 id="titolo-vetrina">Il mio armadio</h1><p id="n-risultati" aria-live="polite"></p><a class="btn-arcobaleno" href="#arcobaleno"><i aria-hidden="true"></i>Organizza per colore</a></div>
      <div class="tipi-rapidi" id="f-tipi" role="group" aria-label="Tipo di capo"></div>
      <div class="attivi" id="attivi" role="group" aria-label="Filtri attivi"></div>
      <ul class="griglia" id="griglia"></ul>
    </section>
  </div>`;
  aggiornaArmadio();
}

function aggiornaArmadio() {
  const { f } = st;
  // il bottone premuto viene ridisegnato: il focus torna sul suo gemello
  const a = document.activeElement, daAttivi = a?.parentElement?.id === "attivi";
  const fuoco = a?.dataset?.v && a.parentElement?.id ? `#${a.parentElement.id} [data-f="${a.dataset.f}"][data-v="${a.dataset.v}"]`
    : a?.dataset?.stato && a.parentElement?.id === "f-stato" ? `#f-stato [data-stato="${a.dataset.stato}"]`
    : a?.dataset?.tipiTutti !== undefined ? "[data-tipi-tutti]" : "";
  const [nTipi, nFam, nSta, nOcc] = ["tipi", "famiglie", "stagioni", "occasioni"].map((g) => faccette(st.capi, f, g));

  $("#f-stato").innerHTML = STATI.map(([v, t]) => `<button type="button" data-stato="${v}" aria-pressed="${f.stato === v}">${t}</button>`).join("");
  const totTipi = Object.values(nTipi).reduce((s, n) => s + n, 0);
  $("#f-tipi").innerHTML = `<button type="button" class="chip" data-tipi-tutti aria-pressed="${!f.tipi.length}">Tutti<b>${totTipi}</b></button>`
    + TIPI.filter(([v]) => nTipi[v] || f.tipi.includes(v)).map(([v, t]) => chip("tipi", v, t, f.tipi.includes(v), nTipi[v])).join("");
  $("#f-famiglie").innerHTML = FAMIGLIE.map(([v, t]) => chip("famiglie", v, `<i style="--c:${TINTA[v]}"></i>${t}`, f.famiglie.includes(v), nFam[v])).join("");
  $("#f-stagioni").innerHTML = STAGIONI.map((v) => chip("stagioni", v, cap(v), f.stagioni.includes(v), nSta[v])).join("");
  $("#f-occasioni").innerHTML = OCCASIONI.map((v) => chip("occasioni", v, cap(v), f.occasioni.includes(v), nOcc[v])).join("");

  // riepilogo dei filtri attivi, ognuno si toglie con un tocco
  const togli = (attr, etichetta) => `<button type="button" class="chip togli" ${attr} aria-label="Togli il filtro ${esc(etichetta)}">${esc(etichetta)}<span aria-hidden="true">×</span></button>`;
  const pillole = [
    ...["tipi", "famiglie", "stagioni", "occasioni"].flatMap((g) => f[g].map((v) => togli(`data-f="${g}" data-v="${esc(v)}"`, NOMI_FILTRO[g][v] ?? cap(v)))),
    f.stato !== "attivo" ? togli('data-stato="attivo"', Object.fromEntries(STATI)[f.stato]) : "",
    f.testo.trim() ? togli("data-togli-testo", `“${f.testo.trim()}”`) : "",
  ].filter(Boolean);
  $("#attivi").innerHTML = pillole.length ? pillole.join("") + `<button type="button" class="azzera" id="azzera">Azzera tutto</button>` : "";
  $("#attivi").hidden = !pillole.length;

  const risultati = filtra(st.capi, f).sort((a, b) => percentuale(b.materiale, f.testo) - percentuale(a.materiale, f.testo) || ORDINE[a.slot] - ORDINE[b.slot] || a.tipo.localeCompare(b.tipo) || b.lch.L - a.lch.L);
  const avanzati = f.famiglie.length + f.stagioni.length + f.occasioni.length + (f.stato !== "attivo" ? 1 : 0);
  // il numero va in un badge: il bottone non si allarga e l'header non va a capo
  const bf = $("#apri-filtri");
  bf.toggleAttribute("data-n", !!avanzati);
  if (avanzati) bf.dataset.n = avanzati;
  bf.setAttribute("aria-label", avanzati ? `Filtri, ${avanzati} attivi` : "Filtri");
  $("#mostra").textContent = `Mostra ${nCapi(risultati.length)}`;
  $("#n-risultati").textContent = nCapi(risultati.length);
  $("#griglia").innerHTML = risultati.length
    ? risultati.map((c) => carta(c)).join("")
    : `<li class="vuoto"><p>Nessun capo con questi filtri.</p><button type="button" class="btn" data-azzera>Azzera filtri</button></li>`;
  // tolto dal riepilogo: il focus passa al filtro attivo successivo, o ai tipi
  const prossimo = (fuoco && $(fuoco)) || (daAttivi && ($("#attivi:not([hidden]) button") || $("[data-tipi-tutti]")));
  if (prossimo) prossimo.focus();
}

// ---------- vista dettaglio ----------
function ruota(pezzi, scelto) {
  const S = 176, c = S / 2, r = 70;
  const pos = (p) => {
    if (p.neutro) return [c, c + (0.55 - p.lch.L) * 70]; // asse centrale: in alto i chiari
    const a = (p.lch.h * Math.PI) / 180;
    return [c + r * Math.sin(a), c - r * Math.cos(a)];
  };
  const centro = pos(scelto);
  const linee = pezzi.filter((p) => p !== scelto).map((p) => {
    const [x, y] = pos(p);
    return `<line x1="${centro[0].toFixed(1)}" y1="${centro[1].toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" ${p.neutro || scelto.neutro ? 'stroke-dasharray="3 3"' : ""}/>`;
  }).join("");
  const punti = pezzi.map((p) => {
    const [x, y] = pos(p);
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${p === scelto ? 9 : 7}" fill="${esc(p.hex)}" class="${p === scelto ? "scelto" : ""}"><title>${esc(RUOLO[p.slot])}: ${esc(p.nomeColore)} ${esc(p.hex)}</title></circle>`;
  }).join("");
  return `<div class="ruota" role="img" aria-label="Ruota dei colori dell'outfit">
    <div class="anello" aria-hidden="true"></div>
    <svg viewBox="0 0 ${S} ${S}" aria-hidden="true"><line class="asse" x1="${c}" y1="${c - 38}" x2="${c}" y2="${c + 38}"/><g class="linee">${linee}</g>${punti}</svg>
  </div>`;
}

function luce(pezzi) {
  return `<div class="luce" aria-label="Luminosità dei pezzi">
    <div class="luce-barra">${pezzi.map((p) => `<i style="--c:${esc(p.hex)};left:${(Math.min(1, Math.max(0, p.lch.L)) * 100).toFixed(1)}%" title="${esc(p.nomeColore)}"></i>`).join("")}</div>
    <div class="luce-legenda"><span>scuro</span><span>Luce</span><span>chiaro</span></div>
  </div>`;
}

// quanto si vede ogni pezzo indossato: la base sotto uno strato spunta solo dal collo
const PESO_STRISCIA = { mid: 36, base: 36, bottom: 32, shoes: 12, belt: 5 };
function striscia(pezzi) {
  const conMid = pezzi.some((p) => p.slot === "mid");
  return `<div class="striscia" aria-hidden="true">${pezzi.map((p) => `<span style="--c:${esc(p.hex)};flex-grow:${p.slot === "base" && conMid ? 9 : PESO_STRISCIA[p.slot]}"></span>`).join("")}</div>`;
}

const GRUCCIA = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4.2a1.8 1.8 0 1 1 1.8 1.8L10 7.2M10 7.2 2.6 12.4c-.8.6-.4 1.6.5 1.6h13.8c.9 0 1.3-1 .5-1.6Z"/></svg>`;
const SCAMBIA = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 7h11.5m-3-3 3 3-3 3M16 13H4.5m3 3-3-3 3-3"/></svg>`;
// i voti a parole, separati per dimensione: sono stime, non misure (niente "97/100")
const ARMONIA = { Ottimo: "ottima", Buono: "buona", Discreto: "discreta", Azzardato: "azzardata" };
const SU_PELLE = { Valorizza: "ti valorizza", Bene: "ti sta bene", Neutro: "effetto neutro", Spegne: "ti spegne" };
const SPIEGA_ARMONIA = "Quanto i colori stanno bene tra loro";
const SPIEGA_PELLE = "Quanto i colori vicino al viso valorizzano la tua carnagione";
// il nome del capo come lo chiameresti: "Felpa con cappuccio", non "Sopra"
const tipoCapo = (p) => cap(p.categoria);

// opzioni: livello del titolo, fissi = capi scelti da te (cerchiati), oggi = la composizione grande di Oggi
function schedaOutfit(o, { i = 0, scelto = o.pezzi[0], fissi = [scelto], oggi = null, livello = 3 } = {}) {
  const pezzi = [...o.pezzi].sort((a, b) => ORDINE[a.slot] - ORDINE[b.slot]);
  const g = giudizio(o.punteggio);
  const gp = o.pelle !== undefined ? giudizioPelle(o.pelle) : null;
  // in sintesi il motivo principale (il meteo ha la sua riga in testa alla pagina)
  const sintesi = o.perche.find((m) => m.tipo !== "meteo");
  // nella composizione: strato sopra e pantaloni grandi, il resto piccolo; senza strato la base prende il suo posto
  const area = (p) => (p.slot === "base" && !pezzi.some((x) => x.slot === "mid") ? "mid" : p.slot);
  const h = `h${livello}`;
  // nelle liste (scheda del capo, Componi) i capi fissi stanno già in alto: qui solo quelli che cambiano
  const visti = !oggi && fissi.length && pezzi.some((p) => !fissi.includes(p)) ? pezzi.filter((p) => !fissi.includes(p)) : pezzi;
  const foto = `<ul class="pezzi${oggi ? " look" : ""}" style="--n:${visti.length}">${visti.map((p) => `<li${oggi ? ` style="grid-area:${area(p)}" class="a-${area(p)}"` : ""}><a class="pezzo" href="#capo/${esc(p.id)}" title="${esc(nomeCapo(p))}">
      <div class="cornice">${visuale(p)}</div>
      <span class="ruolo">${esc(tipoCapo(p))}</span>
      <span class="pezzo-nome">${esc(marca(p) || p.nomeColore)}</span>
    </a>${oggi ? `<button type="button" class="cambia" data-cambia="${esc(p.slot)}" aria-haspopup="dialog" aria-label="Cambia ${esc(nomeCapo(p))}" title="Cambia questo capo">${SCAMBIA}</button>` : ""}</li>`).join("")}</ul>`;
  const perche = `<details class="perche">
      <summary>${g === "Azzardato" ? "Perché è un azzardo" : "Perché funziona"}</summary>
      <div class="perche-corpo">
        <div class="perche-testo">
          <dl class="voti">
            <div><dt>Armonia dei colori</dt><dd><b>${ARMONIA[g]}</b><small>${SPIEGA_ARMONIA.toLowerCase()}</small></dd></div>
            ${gp ? `<div><dt>Con la tua pelle</dt><dd data-v="${gp}"><b>${SU_PELLE[gp]}</b><small>${SPIEGA_PELLE.toLowerCase()}</small></dd></div>` : ""}
          </dl>
          <ul class="motivi">${o.perche.filter((m) => m !== sintesi).map((m) => `<li data-tipo="${esc(m.tipo)}">${esc(m.testo)}</li>`).join("")}</ul>
        </div>
        <div class="palette">
          ${striscia(pezzi)}
          <details class="grafici"><summary>Mostra i colori su ruota e luce</summary>
            <div class="palette-grafici">${ruota(pezzi, scelto)}${luce(pezzi)}</div></details>
          <p class="stima">Stime calcolate dai colori delle foto, non regole.</p>
        </div>
      </div>
    </details>`;
  if (oggi) return `<article class="outfit oggi-look" aria-labelledby="titolo-look">
    ${foto}
    <div class="look-testo">
      <${h} id="titolo-look">${esc(titoloOutfit(pezzi))}</${h}>
      <ul class="dimensioni" aria-label="Valutazione">
        <li data-v="${g}">Colori: <b>armonia ${ARMONIA[g]}</b></li>
        ${gp ? `<li data-v="${gp}">Pelle: <b>${SU_PELLE[gp]}</b></li>` : ""}
        <li>Clima: <b>${esc(oggi.clima)}</b></li>
      </ul>
      ${sintesi ? `<p class="sintesi">${esc(sintesi.testo)}</p>` : ""}
      <div class="azioni-look">
        <button type="button" class="btn primario" data-indossa aria-pressed="${oggi.indossato}">${oggi.indossato ? `${SPUNTA}Lo indossi oggi` : "Lo metto oggi"}</button>
        ${bottoneCuore(o.pezzi, true)}
        <a class="btn secondario" href="#crea/${esc(pezzi.map((p) => p.id).join(","))}">Modifica in Componi</a>
      </div>
      ${perche}
    </div>
  </article>`;
  return `<article class="outfit" style="--i:${i}">
    <header class="outfit-testa">
      <${h}>${esc(titoloOutfit(pezzi))}</${h}>
      <span class="armonia" data-v="${g}" title="${SPIEGA_ARMONIA}">Armonia <b>${ARMONIA[g]}</b></span>
      ${bottoneCuore(o.pezzi)}
    </header>
    ${foto}
    ${sintesi ? `<p class="sintesi">${esc(sintesi.testo)}</p>` : ""}
    ${perche}
  </article>`;
}
const SPUNTA = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4.5 10.5 3.5 3.5 7.5-8"/></svg>`;

// prima i 5 migliori diversi tra loro (diversi), poi gli altri a gruppi, solo su richiesta
const PRIMI = 5, PASSO = 6;
let lista = { outfit: [], scelto: null, mostrati: 0 };
const contaOutfit = (n, nome = "abbinamenti") => n > PRIMI ? `${PRIMI} ${nome} consigliati, diversi tra loro · ${n} possibili` : `${n} ${nome}, dal migliore`;

function altriOutfit() {
  const { outfit: tutti, scelto, mostrati, fissi = [scelto] } = lista;
  const nuovi = tutti.slice(mostrati, mostrati + (mostrati ? PASSO : PRIMI));
  $("#lista-outfit").insertAdjacentHTML("beforeend", nuovi.map((o, i) => schedaOutfit(o, { i, scelto, fissi })).join(""));
  lista.mostrati += nuovi.length;
  const restano = tutti.length - lista.mostrati;
  const btn = $("#altri");
  btn.hidden = restano <= 0;
  btn.textContent = `Mostra altri ${Math.min(PASSO, restano)} · ne restano ${restano}`;
}

function vistaDettaglio(c) {
  const pool = filtra(st.capi, { stato: st.pool });
  if (!pool.includes(c)) pool.push(c);
  const { outfit: proposti, mancanti } = outfit(c, pool, { approvati: st.approvati });
  const approvati = st.approvati.filter((o) => o.includes(c.id))
    .map((o) => o.map((id) => st.capi.find((x) => x.id === id)).filter(Boolean));
  const righe = [
    ["Colore", `<span class="colore-info"><i style="--c:${esc(c.hex)}"></i>${esc(c.colore)}${c.hex_stimato ? ' <em>stimato dal nome</em>' : ""}</span>`],
    ["Modello", esc(c.modello)], ["Materiale", esc(c.materiale)],
    ["Stagione", c.stagione.map(cap).join(", ")], ["Occasione", c.occasione.map(cap).join(", ")],
    ["Stato", cap(c.stato)],
  ].filter(([, v]) => v);
  const nomiMancanti = mancanti.map((s) => NOMI_SLOT[s]).join(", ");

  main.innerHTML = `<div class="dettaglio">
    <section class="scheda" aria-labelledby="titolo-capo">
      <a class="indietro" href="#">Tutti i capi</a>
      <div class="cornice grande">${visuale(c, true)}</div>
      <p class="marca">${esc(marca(c) || "Senza marca")} · <span>${esc(c.id)}</span></p>
      <h1 id="titolo-capo">${esc(cap(c.categoria))}</h1>
      ${c.stato === "attivo" ? `<a class="btn primario componi-capo" href="#crea/${esc(c.id)}">${GRUCCIA}Componi un outfit con questo</a>` : ""}
      <details class="dettagli-capo"${matchMedia("(max-width: 600px)").matches ? "" : " open"}><summary>Dettagli del capo</summary>
      <dl class="info">${righe.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
      <div class="azioni-capo"${st.statico ? " hidden" : ""}>
        ${c.stato === "attivo"
          ? `<button type="button" class="btn-stato" data-cambia-stato="casa">Segna da casa</button><button type="button" class="btn-stato" data-cambia-stato="dismesso">Segna come dismesso</button>`
          : `<button type="button" class="btn-stato riattiva" data-cambia-stato="attivo">Rimetti tra gli attivi</button>`}
        <p class="esito" role="status"></p>
      </div></details>
    </section>
    <section class="abbinamenti" aria-labelledby="titolo-abb">
      <div class="abb-testa">
        <h2 id="titolo-abb">Con cosa lo metto</h2>
        <div class="seg piccolo" role="group" aria-label="Suggerisci da"${c.stato === "casa" ? " hidden" : ""}>
          <button type="button" data-pool="attivo" aria-pressed="${st.pool === "attivo"}">Solo attivi</button>
          <button type="button" data-pool="tutti" aria-pressed="${st.pool === "tutti"}">Anche dismessi</button>
        </div>
      </div>
      ${c.stato === "casa" ? `<p class="avviso">Capo da casa: è censito ma non entra negli abbinamenti.</p>` : ""}
      ${mancanti.length ? `<p class="avviso">Nessun capo ${st.pool === "attivo" ? "attivo " : ""}adatto tra: <b>${esc(nomiMancanti)}</b>.${st.pool === "attivo" ? ' <button type="button" class="link" data-pool="tutti">Cerca anche tra i dismessi</button>' : ""}</p>` : ""}
      ${approvati.length ? `<div class="approvati"><h3>${CUORE}Nei tuoi preferiti · ${approvati.length}</h3><ul>${approvati.map((o) => `<li aria-label="${esc(titoloOutfit(o))}">${[...o].sort((a, b) => ORDINE[a.slot] - ORDINE[b.slot]).map((p) => `<a href="#capo/${esc(p.id)}" class="${p === c ? "attuale" : ""}" title="${esc(cap(p.categoria))} ${esc(p.colore)}${marca(p) ? ", " + esc(marca(p)) : ""}"><div class="cornice">${visuale(p)}</div></a>`).join("")}</li>`).join("")}</ul></div>` : ""}
      ${proposti.length ? `<p class="n-abb" aria-live="polite">${proposti.length === 1 ? "1 abbinamento" : contaOutfit(proposti.length, "abbinamenti")}</p>` : ""}
      <div id="lista-outfit"></div>
      <button type="button" class="btn altri" id="altri" hidden></button>
    </section>
  </div>`;
  lista = { outfit: diversi(proposti), scelto: c, mostrati: 0 };
  altriOutfit();
}

// ---------- meteo (Open-Meteo: gratis, senza chiave) ----------
const CITTA = "closetune-citta";
async function caricaMeteo(citta) {
  const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=it&name=${encodeURIComponent(citta)}`)).json();
  const luogo = g.results?.[0];
  if (!luogo) throw new Error("citta");
  const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${luogo.latitude}&longitude=${luogo.longitude}&daily=temperature_2m_min,temperature_2m_max,precipitation_probability_max&timezone=auto&forecast_days=1`)).json();
  const d = f.daily;
  return { citta, nome: luogo.name, giorno: new Date().toDateString(), min: d.temperature_2m_min[0], max: d.temperature_2m_max[0], pioggia: d.precipitation_probability_max[0] ?? 0 };
}
function aggiornaMeteo() {
  const citta = localStorage.getItem(CITTA);
  if (!citta || st.meteoInCorso || (st.meteo?.citta === citta && st.meteo.giorno === new Date().toDateString())) return;
  st.meteoInCorso = true;
  caricaMeteo(citta)
    .then((m) => { st.meteo = m; }, (e) => { st.meteo = { citta, errore: e.message === "citta" ? "Città non trovata." : "Meteo non raggiungibile: uso la stagione." }; })
    .finally(() => { st.meteoInCorso = false; if (location.hash === "#oggi") vistaOggi(); });
}
function motivoMeteo(m) {
  const media = (m.min + m.max) / 2;
  const t = media >= 22 ? "Fa caldo: niente strato sopra, tessuti leggeri." : media >= 15 ? "Mezza stagione: uno strato leggero."
    : media >= 10 ? "Fresco: uno strato sopra." : "Fa freddo: si parte da uno strato pesante.";
  return { tipo: "meteo", testo: m.pioggia >= 50 ? `${t} Pioggia probabile (${m.pioggia}%): niente scarpe in tela.` : t };
}

const PIN = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 18s-5.6-5.4-5.6-9.6a5.6 5.6 0 0 1 11.2 0C15.6 12.6 10 18 10 18Z"/><circle cx="10" cy="8.4" r="2"/></svg>`;
// il meteo come informazione leggibile; il campo città compare solo se manca o se la vuoi cambiare
function rigaMeteo(citta, meteo) {
  const errore = st.meteo?.citta === citta && st.meteo.errore;
  if (meteo && !st.modificaCitta) return `<div class="meteo">${PIN}<p><b>${esc(meteo.nome)}</b> · ${Math.round(meteo.min)}–${Math.round(meteo.max)}°C${meteo.pioggia >= 30 ? ` · pioggia ${meteo.pioggia}%` : ""}<span>${esc(motivoMeteo(meteo).testo)}</span></p><button type="button" class="link" data-modifica-citta>Cambia città</button></div>`;
  if (citta && !errore && !st.modificaCitta) return `<div class="meteo" role="status">${PIN}<p>Leggo il meteo di ${esc(citta)}…</p></div>`;
  return `<form class="meteo citta" id="form-citta">${PIN}<label for="citta">${errore ? esc(errore) : "Con la tua città scelgo gli strati in base alla temperatura di oggi."}</label>
    <span class="citta-campo"><input id="citta" name="citta" placeholder="La tua città" value="${esc(citta)}" autocomplete="address-level2" enterkeyhint="done"><button class="btn">Usa</button></span></form>`;
}

// "Lo metto oggi": resta per tutta la giornata (solo su questo dispositivo)
const INDOSSATO = "closetune-indossato";
const indossatoOggi = () => {
  const v = JSON.parse(localStorage.getItem(INDOSSATO) || "null");
  return v?.data === new Date().toDateString() ? v.ids : null;
};
const stessiCapi = (a = [], b = []) => a.length === b.length && a.every((id) => b.includes(id));

function vistaOggi() {
  aggiornaMeteo();
  const oggi = new Date();
  const citta = localStorage.getItem(CITTA) ?? "";
  const meteo = st.meteo?.citta === citta && !st.meteo.errore ? st.meteo : null;
  const attivi = filtra(st.capi, { stato: "attivo" });
  const manca = avvisoUscita(attivi);
  // all'apertura, se oggi hai già scelto un outfit, si riparte da quello
  if (st.oggiPezzi === undefined) st.oggiPezzi = indossatoOggi();
  let { stagione, scelto, outfit: o, adatti } = manca ? { stagione: delGiorno(attivi, oggi).stagione } : delGiorno(perOccasione(attivi, st.uscita), oggi, st.giro, st.approvati, meteo, st.uscita);
  // pezzi cambiati a mano: gli altri restano fermi
  const cambiati = st.oggiPezzi?.map((id) => st.capi.find((c) => c.id === id)).filter(Boolean);
  if (o && cambiati?.length) {
    scelto = cambiati.find((p) => p.slot === "mid") ?? cambiati[0];
    o = valuta(cambiati, scelto, st.approvati);
  }
  if (o && meteo) o.perche = [motivoMeteo(meteo), ...o.perche];
  st.oggiCorrente = o;
  st.oggiAdatti = adatti;
  const ids = o?.pezzi.map((p) => p.id);
  const data = oggi.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  const clima = meteo ? `pensato per ${Math.round(meteo.min)}–${Math.round(meteo.max)}°C` : `di stagione (${stagione})`;
  main.innerHTML = `<div class="oggi">
    <div class="oggi-testa">
      <div><p class="marca">${esc(cap(data))}</p><h1>Cosa indosso oggi?</h1></div>
      <div class="oggi-azioni"${o ? "" : " hidden"}>
        <button type="button" class="btn secondario" id="precedente"${st.giro ? "" : " disabled"}>Precedente</button>
        <button type="button" class="btn" id="rimescola">Un altro outfit</button>
      </div>
    </div>
    ${rigaMeteo(citta, meteo)}
    ${sceltaUscita()}
    ${manca ?? (o ? schedaOutfit(o, { scelto, fissi: [], oggi: { clima, indossato: stessiCapi(ids, indossatoOggi() ?? []) }, livello: 2 }) : `<p class="avviso">Nessun capo attivo adatto all'${esc(stagione)}.</p>`)}
    <p class="sr" role="status" id="annuncio">${esc(st.annuncio ?? "")}</p>
    <dialog class="picker laterale" id="picker" aria-labelledby="picker-titolo"></dialog>
  </div>`;
  st.annuncio = "";
}

// le alternative in un pannello: l'outfit resta fermo sotto, da confrontare
function apriAlternative(slot) {
  const o = st.oggiCorrente, attuale = o.pezzi.find((p) => p.slot === slot);
  const alt = alternative(o.pezzi, slot, st.oggiAdatti, st.approvati).filter((a) => vaPer(a.pezzi, st.uscita)).slice(0, 6);
  const d = $("#picker");
  d.dataset.slot = slot;
  d.innerHTML = `<div class="picker-dentro">
    <div class="picker-testa"><div><h2 id="picker-titolo">Al posto di: ${esc(tipoCapo(attuale).toLowerCase())}</h2><p>Gli altri capi restano fermi · dalla scelta migliore</p></div>
      <button type="button" class="picker-chiudi" data-chiudi-picker aria-label="Chiudi">${X}</button></div>
    ${alt.length ? `<ul class="alt-lista">${alt.map((a, k) => {
      const c = a.pezzi.find((p) => p.slot === slot);
      const g = giudizio(a.punteggio);
      return `<li><button type="button" class="alt" data-scegli="${esc(c.id)}">
        <span class="cornice">${visuale(c)}</span>
        <span class="alt-testo"><b>${esc(nomeCapo(c))}</b><span>${esc(effetto(attuale, c))}</span>${k === 0 ? "<em>Consigliata</em>" : ""}</span>
        <span class="armonia" data-v="${g}">${ARMONIA[g]}</span></button></li>`;
    }).join("")}</ul>` : `<p class="avviso">Nessun altro capo sta bene col resto dell'outfit.</p>`}
  </div>`;
  d.showModal();
  d.querySelector("[data-scegli], [data-chiudi-picker]").focus();
}

document.addEventListener("submit", (e) => {
  if (e.target.id !== "form-citta") return;
  e.preventDefault();
  const citta = e.target.citta.value.trim();
  if (citta) localStorage.setItem(CITTA, citta); else localStorage.removeItem(CITTA);
  st.meteo = null;
  st.giro = 0;
  st.oggiPezzi = null;
  st.modificaCitta = false;
  vistaOggi();
});

function vistaArcobaleno() {
  const capi = ordineArcobaleno(st.capi);
  main.innerHTML = `<div class="oggi arcobaleno">
    <a class="indietro" href="#">Tutti i capi</a>
    <div class="oggi-testa"><div><p class="marca">${capi.length} capi sopra · da appendere in quest'ordine</p><h1>Organizza per colore</h1></div></div>
    <ol class="sequenza" aria-label="La sequenza, da sinistra a destra">${capi.map((c, i) => `<li style="--c:${esc(c.hex)}" title="${i + 1}. ${esc(nomeCapo(c))}"><span>${i + 1}</span></li>`).join("")}</ol>
    <ol class="griglia">${capi.map((c, i) => carta(c, i + 1)).join("")}</ol>
  </div>`;
}

// ---------- preferiti: gli outfit col cuore, dal più recente ----------
const CUORE = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16.8S2.6 12.4 2.6 7.3A3.9 3.9 0 0 1 10 5.4a3.9 3.9 0 0 1 7.4 1.9c0 5.1-7.4 9.5-7.4 9.5Z"/></svg>`;
function vistaPreferiti() {
  const preferiti = pezziApprovati().filter((p) => p.length).reverse();
  main.innerHTML = `<div class="oggi preferiti">
    <div class="oggi-testa"><div><p class="marca">${preferiti.length} outfit · dal più recente</p><h1>Preferiti</h1>
      <p class="sottotitolo">Tocca il cuore su un outfit, in Oggi, Componi o nella scheda di un capo, per salvarlo qui. Toccalo di nuovo per toglierlo.${st.statico ? " Restano su questo dispositivo." : ""}</p></div></div>
    ${preferiti.length ? preferiti.map((pz, i) => schedaOutfit(valuta(pz, pz[0], st.approvati), { i, fissi: [], livello: 2 })).join("")
      : `<p class="avviso">Ancora nessun preferito: tocca il cuore su un outfit che ti piace.</p>`}
  </div>`;
}

// ---------- outfit builder: scegli i capi, completa il resto ----------
const fissiDaHash = () => (location.hash.match(/^#crea\/([\w,]+)/)?.[1].split(",") ?? [])
  .map((id) => st.capi.find((c) => c.id === id)).filter((c, i, a) => c && a.findIndex((x) => x?.slot === c.slot) === i);
const SLOT_CREA = ["mid", "base", "bottom", "shoes", "belt"];
const X = `<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5.5 5.5 9 9m0-9-9 9"/></svg>`;
const nomeCapo = (c) => `${cap(c.categoria)} ${c.nomeColore}${marca(c) ? ", " + marca(c) : ""}`;

// cinque caselle, una per strato: o il capo fissato o "Auto" (lo completa closetune)
function slotCrea(s, c) {
  return `<li class="slot${c ? " pieno" : ""}">
    <button type="button" class="slot-apri" data-apri="${s}" aria-haspopup="dialog" aria-label="${RUOLO[s]}: ${c ? `${esc(nomeCapo(c))}, scelto da te. Cambia` : "lo sceglie closetune. Scegli un capo"}">
      <span class="cornice">${c ? visuale(c) : `<span class="auto" aria-hidden="true">${sagoma(s)}</span>`}</span>
      <span class="ruolo">${RUOLO[s]}</span>
      <span class="slot-stato">${c ? esc(marca(c) || cap(c.categoria)) : "Scegli tu o lascia a me"}</span>
    </button>
    ${c ? `<button type="button" class="slot-togli" data-auto="${s}" aria-label="Togli ${esc(nomeCapo(c))}">${X}</button>` : ""}
  </li>`;
}

function vistaCrea() {
  const fissi = fissiDaHash();
  main.innerHTML = `<div class="oggi crea">
    <div class="oggi-testa"><div><p class="marca">Scegli i capi che vuoi · il resto lo completo io</p><h1>Componi</h1></div>
      <button type="button" class="btn" id="svuota"${fissi.length ? "" : " hidden"}>Azzera</button></div>
    ${sceltaUscita()}
    <ul class="slot-crea" aria-label="Il tuo outfit">${SLOT_CREA.map((s) => slotCrea(s, fissi.find((f) => f.slot === s))).join("")}</ul>
    <div id="risultati-crea"></div>
    <dialog class="picker" id="picker" aria-labelledby="picker-titolo"></dialog>
  </div>`;
  risultatiCrea();
}

function apriPicker(s) {
  const fissi = fissiDaHash();
  const attuale = fissi.find((f) => f.slot === s);
  const altri = fissi.filter((f) => f !== attuale);
  // ponytail: controllo a coppie (stagione, formalità, gusto), non l'outfit intero; basta a mettere in fondo i capi che non vanno
  const ok = new Set(filtra(st.capi, { stato: "attivo" }).filter((c) => c.slot === s && staBene(altri, c)));
  const capi = filtra(st.capi, { stato: "attivo" }).filter((c) => c.slot === s).sort((a, b) => ok.has(b) - ok.has(a) || b.lch.L - a.lch.L);
  const primoNo = capi.find((c) => !ok.has(c));
  const famiglie = FAMIGLIE.filter(([v]) => capi.some((c) => c.famiglia === v));
  const d = $("#picker");
  d.dataset.slot = s;
  d.innerHTML = `<div class="picker-dentro">
    <div class="picker-testa"><div><h2 id="picker-titolo">${RUOLO[s]}</h2><p>${NOMI_SLOT[s] === RUOLO[s].toLowerCase() ? "" : `${esc(cap(NOMI_SLOT[s]))} · `}${capi.length} capi</p></div>
      <button type="button" class="picker-chiudi" data-chiudi-picker aria-label="Chiudi">${X}</button></div>
    ${famiglie.length > 1 ? `<div class="picker-filtri" role="group" aria-label="Filtra per colore"><button type="button" class="chip" data-pfam="" aria-pressed="true">Tutti</button>${famiglie.map(([v, t]) => `<button type="button" class="chip" data-pfam="${v}" aria-pressed="false"><i style="--c:${TINTA[v]}"></i>${t}</button>`).join("")}</div>` : ""}
    <ul class="picker-griglia">
      <li><button type="button" class="opzione" data-auto="${s}" aria-pressed="${!attuale}"><span class="cornice"><span class="auto" aria-hidden="true">${sagoma(s)}</span></span><span class="opzione-nome">Scegli per me</span><span class="opzione-colore">il migliore col resto</span></button></li>
      ${capi.map((c) => `${c === primoNo ? `<li class="picker-sep" role="presentation">Non vanno con i capi già fissati</li>` : ""}<li data-fam="${c.famiglia}"><button type="button" class="opzione${ok.has(c) ? "" : " no"}" data-metti="${esc(c.id)}" aria-pressed="${c === attuale}" aria-label="${esc(nomeCapo(c))}${ok.has(c) ? "" : ", non va con i capi fissati"}">
        <span class="cornice">${visuale(c)}</span>
        <span class="opzione-nome">${esc(cap(c.categoria))}</span>
        <span class="opzione-colore"><i style="--c:${esc(c.hex)}"></i>${esc(c.nomeColore)}</span>${marca(c) ? `<span class="marca-capo">${esc(marca(c))}</span>` : ""}</button></li>`).join("")}
    </ul></div>`;
  d.showModal();
  d.querySelector('[aria-pressed="true"]').focus();
}

function risultatiCrea() {
  const fissi = fissiDaHash();
  const box = $("#risultati-crea");
  if (!fissi.length) { box.innerHTML = `<p class="avviso">Tocca una casella e scegli almeno un capo: il resto lo completo io, dal migliore.</p>`; return; }
  const attivi = filtra(st.capi, { stato: "attivo" });
  const manca = avvisoUscita(attivi);
  if (manca) { box.innerHTML = manca; return; }
  const r = outfitDa(fissi, perOccasione(attivi, st.uscita, fissi), { approvati: st.approvati });
  const { mancanti, vietato } = r, proposti = r.outfit.filter((o) => vaPer(o.pezzi, st.uscita, fissi));
  if (vietato) { box.innerHTML = `<p class="avviso">${esc(vietato)} Togli uno dei due capi.</p>`; return; }
  // senza capo sotto (es. dolcevita) l'outfit si fa lo stesso: avviso solo se manca davvero qualcosa
  const manchi = proposti.length ? mancanti.filter((s) => s !== "base") : mancanti;
  box.innerHTML = `${manchi.length ? `<p class="avviso">Nessun capo adatto tra: <b>${esc(manchi.map((s) => NOMI_SLOT[s]).join(", "))}</b>.</p>` : ""}
    <h2 class="n-abb" aria-live="polite">${proposti.length ? contaOutfit(proposti.length) : "Questi capi non stanno insieme: stagione, formalità o stile troppo diversi."}</h2>
    <div id="lista-outfit"></div>
    <button type="button" class="btn altri" id="altri" hidden></button>`;
  lista = { outfit: diversi(proposti), scelto: fissi[0], fissi, mostrati: 0 };
  altriOutfit();
  // anteprima: le caselle libere mostrano, sbiaditi, i capi del primo abbinamento
  for (const p of lista.outfit[0]?.pezzi ?? []) {
    const li = $(`[data-apri="${p.slot}"]`)?.closest(".slot");
    if (!li || li.classList.contains("pieno")) continue;
    li.classList.add("proposto");
    li.querySelector(".cornice").innerHTML = visuale(p);
    li.querySelector(".slot-stato").textContent = `Proposto: ${marca(p) || p.nomeColore}`;
  }
}

// un capo per strato: id = quel capo, null = torna "Auto"
function fissa(s, id) {
  const fissi = fissiDaHash().filter((f) => f.slot !== s);
  const c = id && st.capi.find((x) => x.id === id);
  if (c) fissi.push(c);
  history.replaceState(null, "", fissi.length ? `#crea/${fissi.map((f) => f.id).join(",")}` : "#crea");
  if ($("#picker").open) $("#picker").close();
  vistaCrea();
  $(`[data-apri="${s}"]`).focus({ preventScroll: true });
}

// ---------- router ed eventi ----------
function render() {
  const m = location.hash.match(/^#capo\/(\w+)/);
  const c = m && st.capi.find((x) => x.id === m[1]);
  const oggi = location.hash === "#oggi";
  const arcobaleno = location.hash === "#arcobaleno";
  const crea = location.hash.startsWith("#crea");
  const preferiti = location.hash === "#preferiti";
  document.body.classList.toggle("in-dettaglio", !!c || oggi || arcobaleno || crea || preferiti);
  // la sezione corrente: "page" sulla pagina stessa, "true" sulle sottopagine dell'armadio
  const corrente = { "vai-oggi": oggi && "page", "vai-crea": crea && "page", "vai-preferiti": preferiti && "page",
    "vai-armadio": !(oggi || crea || preferiti) && (c || arcobaleno ? "true" : "page") };
  for (const [id, v] of Object.entries(corrente)) v ? $(`#${id}`).setAttribute("aria-current", v) : $(`#${id}`).removeAttribute("aria-current");
  document.body.classList.remove("filtri-aperti");
  if (preferiti) {
    vistaPreferiti();
    document.title = "Preferiti · closetune";
    window.scrollTo(0, 0);
  } else if (crea) {
    vistaCrea();
    document.title = "Componi · closetune";
    window.scrollTo(0, 0);
  } else if (arcobaleno) {
    vistaArcobaleno();
    document.title = "Organizza per colore · closetune";
    window.scrollTo(0, 0);
  } else if (oggi) {
    vistaOggi();
    document.title = "Outfit di oggi · closetune";
    window.scrollTo(0, 0);
  } else if (c) {
    vistaDettaglio(c);
    document.title = `${cap(c.categoria)} ${c.nomeColore} · closetune`;
    window.scrollTo(0, 0);
  } else {
    const y = st.scrollGriglia ?? 0;
    vistaArmadio();
    document.title = "closetune";
    window.scrollTo(0, y);
  }
}

function toggle(lista, v) {
  const i = lista.indexOf(v);
  i < 0 ? lista.push(v) : lista.splice(i, 1);
}

// tocco fuori dal pannello di scelta (sullo sfondo del dialog) = chiudi
document.addEventListener("click", (e) => e.target.tagName === "DIALOG" && e.target.close());
document.addEventListener("click", (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;
  if (t.matches("a.capo")) st.scrollGriglia = window.scrollY;
  if (t.dataset.f) { toggle(st.f[t.dataset.f], t.dataset.v); aggiornaArmadio(); }
  else if (t.dataset.stato) { st.f.stato = t.dataset.stato; st.pool = t.dataset.stato === "attivo" ? "attivo" : "tutti"; aggiornaArmadio(); }
  else if (t.dataset.tipiTutti !== undefined) { st.f.tipi = []; aggiornaArmadio(); }
  else if (t.dataset.togliTesto !== undefined) { st.f.testo = ""; $("#cerca").value = ""; aggiornaArmadio(); }
  else if (t.id === "azzera" || t.dataset.azzera !== undefined) {
    Object.assign(st.f, { stato: "attivo", tipi: [], famiglie: [], stagioni: [], occasioni: [], testo: "" });
    st.pool = "attivo";
    $("#cerca").value = "";
    aggiornaArmadio();
  } else if (t.dataset.cambiaStato) cambiaStato(t);
  else if (t.dataset.pool) { st.pool = t.dataset.pool; render(); }
  else if (t.id === "altri") altriOutfit();
  else if (t.dataset.apri) apriPicker(t.dataset.apri);
  else if (t.dataset.metti) fissa($("#picker").dataset.slot, t.dataset.metti);
  else if (t.dataset.auto) fissa(t.dataset.auto, null);
  else if (t.dataset.pfam !== undefined) {
    t.parentElement.querySelectorAll("[data-pfam]").forEach((b) => b.setAttribute("aria-pressed", b === t));
    $("#picker").querySelectorAll("[data-fam]").forEach((li) => { li.hidden = !!t.dataset.pfam && li.dataset.fam !== t.dataset.pfam; });
    $("#picker").querySelector(".picker-sep")?.toggleAttribute("hidden", !!t.dataset.pfam);
  }
  else if (t.dataset.chiudiPicker !== undefined) t.closest("dialog").close();
  else if (t.dataset.approva) approva(t);
  else if (t.id === "svuota") { history.replaceState(null, "", "#crea"); vistaCrea(); }
  else if (t.dataset.uscita) {
    st.uscita = t.dataset.uscita;
    localStorage.setItem("closetune-uscita", st.uscita);
    document.querySelectorAll("[data-uscita]").forEach((b) => b.setAttribute("aria-pressed", b === t));
    st.giro = 0; st.oggiPezzi = null;
    if (location.hash === "#oggi") { vistaOggi(); $(`[data-uscita="${st.uscita}"]`).focus(); } else risultatiCrea();
  }
  else if (t.id === "rimescola" || t.id === "precedente") {
    st.giro += t.id === "rimescola" ? 1 : -1;
    st.oggiPezzi = null;
    vistaOggi();
    $(`#${st.giro || t.id === "rimescola" ? t.id : "rimescola"}`).focus();
  }
  else if (t.dataset.cambia) apriAlternative(t.dataset.cambia);
  else if (t.dataset.scegli) {
    const nuovo = st.capi.find((c) => c.id === t.dataset.scegli);
    const vecchio = st.oggiCorrente.pezzi.find((p) => p.slot === nuovo.slot);
    st.oggiPezzi = [...st.oggiCorrente.pezzi.filter((p) => p !== vecchio).map((p) => p.id), nuovo.id];
    st.annuncio = `${nomeCapo(nuovo)} al posto di ${nomeCapo(vecchio)}.`;
    $("#picker").close();
    vistaOggi();
    $(`[data-cambia="${nuovo.slot}"]`).focus({ preventScroll: true });
  }
  else if (t.dataset.indossa !== undefined) {
    const ids = st.oggiCorrente.pezzi.map((p) => p.id);
    if (t.getAttribute("aria-pressed") === "true") localStorage.removeItem(INDOSSATO);
    else localStorage.setItem(INDOSSATO, JSON.stringify({ data: new Date().toDateString(), ids }));
    st.oggiPezzi = ids;
    vistaOggi();
    $("[data-indossa]").focus({ preventScroll: true });
  }
  else if (t.dataset.modificaCitta !== undefined) { st.modificaCitta = true; vistaOggi(); $("#citta").focus(); }
  else if (t.id === "apri-filtri" || t.dataset.chiudi !== undefined) {
    const aperto = document.body.classList.toggle("filtri-aperti");
    $("#apri-filtri").setAttribute("aria-expanded", aperto);
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && document.body.classList.contains("filtri-aperti")) {
    document.body.classList.remove("filtri-aperti");
    $("#apri-filtri").setAttribute("aria-expanded", "false");
  }
});

$("#cerca").addEventListener("input", (e) => {
  st.f.testo = e.target.value;
  if (location.hash && location.hash !== "#") {
    Object.assign(st.f, { stato: "attivo", tipi: [], famiglie: [], stagioni: [], occasioni: [] });
    st.pool = "attivo";
    location.hash = "";
  } else aggiornaArmadio();
});

// scrive stato: nel file .md del capo (il file resta: lo storico non si perde)
// ---------- approvare un outfit: finisce in outfit.md e tara il gusto ----------
const giaApprovato = (ids) => st.approvati.some((o) => stessiCapi(o, ids));
// conTesto: il cuore con la parola accanto (Oggi), altrimenti solo l'icona
function bottoneCuore(pezzi, conTesto = false) {
  const ids = pezzi.map((p) => p.id);
  const fatto = giaApprovato(ids);
  return `<button type="button" class="cuore${conTesto ? " btn secondario" : ""}" data-approva="${esc(ids.join(","))}" aria-pressed="${fatto}"${conTesto ? "" : ' aria-label="Salva nei preferiti"'} title="Salva nei preferiti">${CUORE}${conTesto ? `<span>${fatto ? "Salvato" : "Salva"}</span>` : ""}</button>`;
}
// sul sito pubblico (senza server) i preferiti restano su questo dispositivo
const PREFERITI_LOCALI = "closetune-preferiti";
const pezziApprovati = () => st.approvati.map((o) => o.map((id) => st.capi.find((c) => c.id === id)).filter(Boolean));

async function approva(btn) {
  const ids = btn.dataset.approva.split(",");
  const togli = btn.getAttribute("aria-pressed") === "true";
  btn.disabled = true;
  try {
    if (!st.statico) {
      const r = await fetch("api/outfit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, togli }) });
      if (!r.ok) throw new Error(r.status);
    }
    st.approvati = st.approvati.filter((o) => !stessiCapi(o, ids));
    if (!togli) st.approvati.push(ids);
    if (st.statico) localStorage.setItem(PREFERITI_LOCALI, JSON.stringify(st.approvati));
    taraSuApprovati(pezziApprovati());
    btn.setAttribute("aria-pressed", String(!togli));
    btn.title = "Salva nei preferiti";
    const parola = btn.querySelector("span");
    if (parola) parola.textContent = togli ? "Salva" : "Salvato";
  } catch {
    btn.title = "Non salvato: il server è acceso?";
  }
  btn.disabled = false;
}

async function cambiaStato(btn) {
  const c = st.capi.find((x) => location.hash === `#capo/${x.id}`);
  if (!c) return;
  const stato = btn.dataset.cambiaStato;
  btn.disabled = true;
  try {
    const r = await fetch(`api/capi/${encodeURIComponent(c.id)}/stato`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stato }),
    });
    if (!r.ok) throw new Error(r.status);
    c.stato = stato;
    aggiornaRiassunto();
    const y = window.scrollY;
    vistaDettaglio(c);
    window.scrollTo(0, y);
    $(".esito").textContent = { dismesso: "Segnato come dismesso.", casa: "Segnato da casa: non entra negli abbinamenti.", attivo: "Di nuovo tra gli attivi." }[stato];
    $("[data-cambia-stato]").focus();
  } catch {
    btn.disabled = false;
    $(".esito").textContent = "Non sono riuscito a salvare. Il server è acceso?";
  }
}

function aggiornaRiassunto() {
  const attivi = st.capi.filter((c) => c.stato === "attivo").length;
  $("#riassunto").textContent = `${attivi} capi attivi · ${st.capi.length} in tutto`;
}

addEventListener("hashchange", () => {
  // un capo dismesso cerca abbinamenti anche tra i dismessi
  const c = st.capi.find((x) => location.hash === `#capo/${x.id}`);
  if (c) st.pool = c.stato === "dismesso" || st.f.stato !== "attivo" ? "tutti" : "attivo";
  render();
});

// le foto grezze del telefono (non calibrate, molto verticali o orizzontali) riempiono la cornice
document.addEventListener("load", (e) => {
  const img = e.target;
  if (img.tagName !== "IMG") return;
  const r = img.naturalWidth / img.naturalHeight;
  img.classList.toggle("grezza", !img.src.includes("/foto/web/") && (r < 0.8 || r > 1.5));
}, true);

fetch("api/capi")
  .then((r) => r.json())
  .then((d) => {
    impostaPelle(d.profilo?.pelle, d.profilo?.capelli);
    st.statico = !!d.statico; // versione su GitHub Pages: sola lettura
    st.capi = prepara(d.capi);
    st.approvati = (st.statico && JSON.parse(localStorage.getItem(PREFERITI_LOCALI) || "null")) || d.outfit;
    taraSuApprovati(pezziApprovati());
    const iniziale = st.capi.find((x) => location.hash === `#capo/${x.id}`);
    if (iniziale?.stato === "dismesso") st.pool = "tutti";
    aggiornaRiassunto();
    render();
  })
  .catch(() => {
    main.innerHTML = `<p class="errore">Non riesco a leggere i capi. Avvia il server con <code>closetune</code>.</p>`;
  });
