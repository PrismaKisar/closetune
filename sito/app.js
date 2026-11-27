import { FAMIGLIE, NOMI_SLOT, RELAZIONI, TIPI, delGiorno, filtra, giudizio, giudizioPelle, impostaPelle, ordineArcobaleno, outfit, outfitDa, percentuale, prepara, taraSuApprovati } from "./abbinamenti.js";

const STAGIONI = ["primavera", "estate", "autunno", "inverno"];
const OCCASIONI = ["casual", "smart-casual", "elegante", "sportivo", "outdoor"];
const RUOLO = { mid: "Sopra", base: "Sotto", bottom: "Pantaloni", shoes: "Scarpe", belt: "Cintura" };
const ETICHETTA_STATO = { dismesso: "dismesso", casa: "da casa" };
const ORDINE = { mid: 0, base: 1, bottom: 2, shoes: 3, belt: 4 };
// tinta rappresentativa di ogni famiglia, per i campioni dei filtri
const TINTA = { chiari: "#efeadb", scuri: "#1e1e20", grigi: "#8d8f91", terra: "#b99a6b", gialli: "#d8aa44", verdi: "#5f7d55", blu: "#2d4a6e", rossi: "#a83a32", rosa: "#c99a95" };

const st = {
  capi: [], approvati: [],
  f: { stato: "attivo", ruoli: [], tipi: [], famiglie: [], stagioni: [], occasioni: [], testo: "" },
  pool: "attivo",
  giro: 0, // "Un altro" nell'outfit di oggi
};
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
  return `<div class="campione${sec.length ? " multi" : ""}" style="--c:${esc(c.hex)}${fasce}" role="img" aria-label="${esc(cap(c.categoria))} ${esc(c.colore)}, senza foto"><span>${esc(c.hex)}</span></div>`;
}

function carta(c) {
  return `<li><a class="capo${c.stato !== "attivo" ? " spento" : ""}" href="#capo/${esc(c.id)}">
    <div class="cornice">${visuale(c)}<span class="id" aria-label="numero ${esc(c.id)}">${esc(c.id)}</span></div>
    <div class="capo-testo">
      <span class="marca">${esc(marca(c) || "Senza marca")}</span>
      <span class="nome">${esc(cap(c.categoria))}</span>
      <span class="colore"><i style="--c:${esc(c.hex)}"></i>${esc(c.nomeColore)}${c.stato !== "attivo" ? ` <em>${ETICHETTA_STATO[c.stato] ?? esc(c.stato)}</em>` : ""}</span>
    </div>
  </a></li>`;
}

const chip = (gruppo, v, etichetta, attivo, extra = "") =>
  `<button type="button" class="chip" data-f="${gruppo}" data-v="${esc(v)}" aria-pressed="${attivo}" ${extra}>${etichetta}</button>`;

// ---------- vista armadio ----------
function vistaArmadio() {
  main.innerHTML = `<div class="armadio">
    <aside class="filtri" id="filtri" aria-label="Filtri">
      <div class="filtri-testa"><h2>Filtri</h2><button type="button" class="chiudi" data-chiudi aria-label="Chiudi i filtri">×</button></div>
      <div class="gruppo"><h3>Stato</h3><div class="seg" id="f-stato"></div></div>
      <div class="gruppo"><h3>Strato</h3><div class="lista" id="f-ruoli"></div></div>
      <div class="gruppo"><h3>Tipo di capo</h3><div class="lista" id="f-tipi"></div></div>
      <div class="gruppo"><h3>Colore</h3><div class="lista" id="f-famiglie"></div></div>
      <div class="gruppo"><h3>Stagione</h3><div class="chips" id="f-stagioni"></div></div>
      <div class="gruppo"><h3>Occasione</h3><div class="chips" id="f-occasioni"></div></div>
      <button type="button" class="azzera" id="azzera">Azzera filtri</button>
      <button type="button" class="btn mostra" id="mostra" data-chiudi></button>
    </aside>
    <section class="vetrina" aria-labelledby="titolo-vetrina">
      <div class="vetrina-testa"><h1 id="titolo-vetrina">Il mio armadio</h1><a class="btn-arcobaleno" href="#arcobaleno" title="Ordine per l'armadio" aria-label="Ordine per l'armadio"></a><p id="n-risultati" aria-live="polite"></p></div>
      <ul class="griglia" id="griglia"></ul>
    </section>
  </div>`;
  aggiornaArmadio();
}

function aggiornaArmadio() {
  const { f } = st;
  const base = filtra(st.capi, { stato: f.stato });
  const conta = (k, v) => base.filter((c) => (Array.isArray(c[k]) ? c[k].includes(v) : c[k] === v)).length;
  $("#f-stato").innerHTML = [["attivo", "Attivi"], ["casa", "Da casa"], ["dismesso", "Dismessi"], ["tutti", "Tutti"]]
    .map(([v, t]) => `<button type="button" data-stato="${v}" aria-pressed="${f.stato === v}">${t}</button>`).join("");
  $("#f-ruoli").innerHTML = ["mid", "base", "bottom"].map((v) => {
    const n = conta("slot", v);
    return `<button type="button" class="riga" data-f="ruoli" data-v="${v}" aria-pressed="${f.ruoli.includes(v)}" ${n ? "" : "disabled"}><span>${RUOLO[v]}</span><b>${n}</b></button>`;
  }).join("");
  $("#f-tipi").innerHTML = TIPI.map(([v, t]) => {
    const n = conta("tipo", v);
    return `<button type="button" class="riga" data-f="tipi" data-v="${v}" aria-pressed="${f.tipi.includes(v)}" ${n ? "" : "disabled"}><span>${t}</span><b>${n}</b></button>`;
  }).join("");
  $("#f-famiglie").innerHTML = FAMIGLIE.map(([v, t]) => {
    const n = conta("famiglia", v);
    return `<button type="button" class="riga" data-f="famiglie" data-v="${v}" aria-pressed="${f.famiglie.includes(v)}" ${n ? "" : "disabled"}><span><i style="--c:${TINTA[v]}"></i>${t}</span><b>${n}</b></button>`;
  }).join("");
  $("#f-stagioni").innerHTML = STAGIONI.map((v) => chip("stagioni", v, cap(v), f.stagioni.includes(v))).join("");
  $("#f-occasioni").innerHTML = OCCASIONI.map((v) => chip("occasioni", v, cap(v), f.occasioni.includes(v))).join("");

  const risultati = filtra(st.capi, f).sort((a, b) => percentuale(b.materiale, f.testo) - percentuale(a.materiale, f.testo) || ORDINE[a.slot] - ORDINE[b.slot] || a.tipo.localeCompare(b.tipo) || b.lch.L - a.lch.L);
  const attivi = f.ruoli.length + f.tipi.length + f.famiglie.length + f.stagioni.length + f.occasioni.length + (f.testo ? 1 : 0);
  $("#azzera").hidden = !attivi;
  $("#apri-filtri").textContent = attivi ? `Filtri · ${attivi}` : "Filtri";
  $("#mostra").textContent = `Mostra ${risultati.length} ${risultati.length === 1 ? "capo" : "capi"}`;
  $("#n-risultati").textContent = `${risultati.length} ${risultati.length === 1 ? "capo" : "capi"}`;
  $("#griglia").innerHTML = risultati.length
    ? risultati.map(carta).join("")
    : `<li class="vuoto"><p>Nessun capo con questi filtri.</p><button type="button" class="btn" data-azzera>Azzera filtri</button></li>`;
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

function schedaOutfit(o, i, scelto, inGruppo = i, fissi = [scelto]) {
  const pezzi = [...o.pezzi].sort((a, b) => ORDINE[a.slot] - ORDINE[b.slot]);
  const titolo = RELAZIONI[o.perche[0]?.tipo]?.nome ?? "Abbinamento";
  const voto = Math.round(o.punteggio * 100);
  return `<article class="outfit" style="--i:${inGruppo}">
    <header class="outfit-testa">
      <span class="num">${String(i + 1).padStart(2, "0")}</span>
      <h3>${esc(titolo)}</h3>
      ${o.pelle !== undefined ? `<span class="pelle" data-v="${giudizioPelle(o.pelle)}" title="Con la tua pelle: ${Math.round(o.pelle * 100)} su 100">Pelle <b>${giudizioPelle(o.pelle)}</b></span>` : ""}
      <span class="armonia" title="Armonia ${voto} su 100"><span class="armonia-barra" aria-hidden="true"><i style="width:${voto}%"></i></span><b>${giudizio(o.punteggio)}</b></span>
    </header>
    <div class="outfit-corpo">
      <ul class="pezzi" style="--n:${pezzi.length}">${pezzi.map((p) => `<li><a class="pezzo${fissi.includes(p) ? " attuale" : ""}" href="#capo/${esc(p.id)}"${fissi.includes(p) ? ' aria-current="true"' : ""}>
        <div class="cornice">${visuale(p)}<span class="id" aria-label="numero ${esc(p.id)}">${esc(p.id)}</span></div>
        <span class="ruolo">${p.slot === "base" && !pezzi.some((x) => x.slot === "mid") ? "Sopra" : RUOLO[p.slot]}</span>
        <span class="pezzo-nome">${esc(marca(p) || cap(p.categoria))}</span>
        <span class="pezzo-colore"><i style="--c:${esc(p.hex)}"></i><span>${esc(p.nomeColore)}</span></span>
      </a></li>`).join("")}</ul>
      <div class="palette">
        ${striscia(pezzi)}
        <div class="palette-grafici">${ruota(pezzi, scelto)}${luce(pezzi)}</div>
        <ul class="motivi">${o.perche.map((m) => `<li data-tipo="${esc(m.tipo)}">${esc(m.testo)}</li>`).join("")}</ul>
        ${st.statico ? "" : bottoneApprova(o.pezzi)}
      </div>
    </div>
  </article>`;
}

// gli abbinamenti arrivano a gruppi mentre scorri: tutti, senza costruire centinaia di schede in una volta
const PASSO = 6;
let lista = { outfit: [], scelto: null, mostrati: 0 };
let osservatore = null;

function altriOutfit() {
  const { outfit: tutti, scelto, mostrati, fissi = [scelto] } = lista;
  const nuovi = tutti.slice(mostrati, mostrati + PASSO);
  $("#lista-outfit").insertAdjacentHTML("beforeend", nuovi.map((o, i) => schedaOutfit(o, mostrati + i, scelto, i, fissi)).join(""));
  lista.mostrati += nuovi.length;
  const restano = tutti.length - lista.mostrati;
  const btn = $("#altri");
  btn.hidden = restano <= 0;
  btn.textContent = `Mostra altri ${Math.min(PASSO, restano)} · ne restano ${restano}`;
  if (restano <= 0) osservatore?.disconnect();
}

function vistaDettaglio(c) {
  const pool = filtra(st.capi, { stato: st.pool });
  if (!pool.includes(c)) pool.push(c);
  const { outfit: proposti, mancanti } = outfit(c, pool, { approvati: st.approvati });
  const approvati = st.approvati.filter((o) => o.includes(c.id))
    .map((o) => o.map((id) => st.capi.find((x) => x.id === id)).filter(Boolean));
  const righe = [
    ["Colore", `<span class="colore-info"><i style="--c:${esc(c.hex)}"></i>${esc(c.colore)} <code>${esc(c.hex)}</code>${c.hex_stimato ? ' <em>stimato dal nome</em>' : ""}</span>`],
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
      <dl class="info">${righe.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>
      ${c.note ? `<p class="note">${esc(c.note)}</p>` : ""}
      <div class="azioni-capo"${st.statico ? " hidden" : ""}>
        ${c.stato === "attivo"
          ? `<button type="button" class="btn-stato" data-cambia-stato="casa">Segna da casa</button><button type="button" class="btn-stato" data-cambia-stato="dismesso">Segna come dismesso</button>`
          : `<button type="button" class="btn-stato riattiva" data-cambia-stato="attivo">Rimetti tra gli attivi</button>`}
        <p class="esito" role="status"></p>
      </div>
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
      ${approvati.length ? `<div class="approvati"><h3>Già approvati</h3><ul>${approvati.map((o) => `<li>${o.map((p) => `<a href="#capo/${esc(p.id)}" title="${esc(cap(p.categoria))} ${esc(p.colore)}"><i style="--c:${esc(p.hex)}"></i>${esc(cap(p.categoria))}${marca(p) ? ` <span>${esc(marca(p))}</span>` : ""}</a>`).join("")}</li>`).join("")}</ul></div>` : ""}
      ${proposti.length ? `<p class="n-abb" aria-live="polite">${proposti.length} ${proposti.length === 1 ? "abbinamento" : "abbinamenti"}, dal migliore</p>` : ""}
      <div id="lista-outfit"></div>
      <button type="button" class="btn altri" id="altri" hidden></button>
    </section>
  </div>`;
  lista = { outfit: proposti, scelto: c, mostrati: 0 };
  altriOutfit();
  osservatore = new IntersectionObserver((e) => e[0].isIntersecting && altriOutfit(), { rootMargin: "800px 0px" });
  osservatore.observe($("#altri"));
}

function vistaOggi() {
  const oggi = new Date();
  const { stagione, scelto, outfit: o } = delGiorno(filtra(st.capi, { stato: "attivo" }), oggi, st.giro, st.approvati);
  const data = oggi.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
  main.innerHTML = `<div class="oggi">
    <a class="indietro" href="#">Tutti i capi</a>
    <div class="oggi-testa">
      <div><p class="marca">${esc(cap(data))} · ${esc(cap(stagione))}</p><h1>Outfit di oggi</h1></div>
      <button type="button" class="btn" id="rimescola">Un altro</button>
    </div>
    ${o ? schedaOutfit(o, st.giro, scelto) : `<p class="avviso">Nessun capo attivo adatto all'${esc(stagione)}.</p>`}
  </div>`;
}

function vistaArcobaleno() {
  const capi = ordineArcobaleno(st.capi);
  main.innerHTML = `<div class="oggi arcobaleno">
    <a class="indietro" href="#">Tutti i capi</a>
    <div class="oggi-testa"><div><p class="marca">${capi.length} capi sopra · dal primo all'ultimo</p><h1>Ordine per l'armadio</h1></div></div>
    <ol class="griglia">${capi.map(carta).join("")}</ol>
  </div>`;
}

// ---------- outfit builder: scegli i capi, completa il resto ----------
const fissiDaHash = () => (location.hash.match(/^#crea\/([\w,]+)/)?.[1].split(",") ?? [])
  .map((id) => st.capi.find((c) => c.id === id)).filter(Boolean);

function vistaCrea() {
  const fissi = fissiDaHash();
  const scegli = filtra(st.capi, { stato: "attivo" });
  main.innerHTML = `<div class="oggi crea">
    <a class="indietro" href="#">Tutti i capi</a>
    <div class="oggi-testa"><div><p class="marca">Uno per tipo · il resto lo scelgo io</p><h1>Crea outfit</h1></div>
      <button type="button" class="btn" id="svuota"${fissi.length ? "" : " hidden"}>Ricomincia</button></div>
    ${["mid", "base", "bottom", "shoes", "belt"].map((s) => `<div class="scelta">
      <h3>${RUOLO[s]}</h3>
      <ul>${scegli.filter((c) => c.slot === s).sort((a, b) => b.lch.L - a.lch.L).map((c) => `<li><button type="button" class="pezzo" data-fisso="${esc(c.id)}" aria-pressed="${fissi.includes(c)}" title="${esc(cap(c.categoria))} ${esc(c.colore)}${marca(c) ? ", " + esc(marca(c)) : ""}">
        <div class="cornice">${visuale(c)}<span class="id">${esc(c.id)}</span></div></button></li>`).join("")}</ul>
    </div>`).join("")}
    <div id="risultati-crea"></div>
  </div>`;
  risultatiCrea();
}

function risultatiCrea() {
  osservatore?.disconnect();
  const fissi = fissiDaHash();
  const box = $("#risultati-crea");
  if (!fissi.length) { box.innerHTML = `<p class="avviso">Tocca uno o più capi qui sopra: ti propongo gli outfit, dal migliore.</p>`; return; }
  const { outfit: proposti, mancanti, vietato } = outfitDa(fissi, filtra(st.capi, { stato: "attivo" }), { approvati: st.approvati });
  if (vietato) { box.innerHTML = `<p class="avviso">${esc(vietato)} Togli uno dei due capi.</p>`; return; }
  box.innerHTML = `${mancanti.length ? `<p class="avviso">Nessun capo adatto tra: <b>${esc(mancanti.map((s) => NOMI_SLOT[s]).join(", "))}</b>.</p>` : ""}
    <p class="n-abb" aria-live="polite">${proposti.length ? `${proposti.length} outfit, dal migliore` : "Questi capi non stanno insieme: stagione, formalità o stile troppo diversi."}</p>
    <div id="lista-outfit"></div>
    <button type="button" class="btn altri" id="altri" hidden></button>`;
  lista = { outfit: proposti, scelto: fissi[0], fissi, mostrati: 0 };
  altriOutfit();
  osservatore = new IntersectionObserver((e) => e[0].isIntersecting && altriOutfit(), { rootMargin: "800px 0px" });
  osservatore.observe($("#altri"));
}

// un capo per strato: sceglierne un altro dello stesso strato lo sostituisce
function toggleFisso(id) {
  const c = st.capi.find((x) => x.id === id);
  let fissi = fissiDaHash();
  fissi = fissi.includes(c) ? fissi.filter((f) => f !== c) : [...fissi.filter((f) => f.slot !== c.slot), c];
  history.replaceState(null, "", fissi.length ? `#crea/${fissi.map((f) => f.id).join(",")}` : "#crea");
  document.querySelectorAll("[data-fisso]").forEach((b) => b.setAttribute("aria-pressed", fissi.some((f) => f.id === b.dataset.fisso)));
  $("#svuota").hidden = !fissi.length;
  risultatiCrea();
}

// ---------- router ed eventi ----------
function render() {
  osservatore?.disconnect();
  const m = location.hash.match(/^#capo\/(\w+)/);
  const c = m && st.capi.find((x) => x.id === m[1]);
  const oggi = location.hash === "#oggi";
  const arcobaleno = location.hash === "#arcobaleno";
  const crea = location.hash.startsWith("#crea");
  document.body.classList.toggle("in-dettaglio", !!c || oggi || arcobaleno || crea);
  $("#vai-crea").toggleAttribute("aria-current", crea);
  document.body.classList.remove("filtri-aperti");
  $("#vai-oggi").toggleAttribute("aria-current", oggi);
  if (crea) {
    vistaCrea();
    document.title = "Crea outfit · closetune";
    window.scrollTo(0, 0);
  } else if (arcobaleno) {
    vistaArcobaleno();
    document.title = "Ordine per l'armadio · closetune";
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

document.addEventListener("click", (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;
  if (t.matches("a.capo")) st.scrollGriglia = window.scrollY;
  if (t.dataset.f) { toggle(st.f[t.dataset.f], t.dataset.v); aggiornaArmadio(); }
  else if (t.dataset.stato) { st.f.stato = t.dataset.stato; st.pool = t.dataset.stato === "attivo" ? "attivo" : "tutti"; aggiornaArmadio(); }
  else if (t.id === "azzera" || t.dataset.azzera !== undefined) {
    Object.assign(st.f, { ruoli: [], tipi: [], famiglie: [], stagioni: [], occasioni: [], testo: "" });
    $("#cerca").value = "";
    aggiornaArmadio();
  } else if (t.dataset.cambiaStato) cambiaStato(t);
  else if (t.dataset.pool) { st.pool = t.dataset.pool; render(); }
  else if (t.id === "altri") altriOutfit();
  else if (t.dataset.fisso) toggleFisso(t.dataset.fisso);
  else if (t.dataset.approva) approva(t);
  else if (t.id === "svuota") { history.replaceState(null, "", "#crea"); vistaCrea(); }
  else if (t.id === "rimescola") { st.giro++; vistaOggi(); }
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
  if (location.hash.startsWith("#capo/") || location.hash === "#oggi" || location.hash.startsWith("#crea") || location.hash === "#arcobaleno") location.hash = "";
  else aggiornaArmadio();
});

// scrive stato: nel file .md del capo (il file resta: lo storico non si perde)
// ---------- approvare un outfit: finisce in outfit.md e tara il gusto ----------
const giaApprovato = (ids) => st.approvati.some((o) => o.length === ids.length && ids.every((id) => o.includes(id)));
function bottoneApprova(pezzi) {
  const ids = pezzi.map((p) => p.id);
  const fatto = giaApprovato(ids);
  return `<button type="button" class="btn-approva" data-approva="${esc(ids.join(","))}" aria-pressed="${fatto}"${fatto ? " disabled" : ""}>${fatto ? "Approvato" : "Mi piace, approva"}</button>`;
}
const pezziApprovati = () => st.approvati.map((o) => o.map((id) => st.capi.find((c) => c.id === id)).filter(Boolean));

async function approva(btn) {
  const ids = btn.dataset.approva.split(",");
  btn.disabled = true;
  try {
    const r = await fetch("api/outfit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    if (!r.ok) throw new Error(r.status);
    if (!giaApprovato(ids)) st.approvati.push(ids);
    taraSuApprovati(pezziApprovati());
    btn.textContent = "Approvato";
    btn.setAttribute("aria-pressed", "true");
  } catch {
    btn.disabled = false;
    btn.textContent = "Non salvato: il server è acceso?";
  }
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
  $("#riassunto").textContent = `${attivi} attivi · ${st.capi.length} censiti`;
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
    st.approvati = d.outfit;
    taraSuApprovati(pezziApprovati());
    const iniziale = st.capi.find((x) => location.hash === `#capo/${x.id}`);
    if (iniziale?.stato === "dismesso") st.pool = "tutti";
    aggiornaRiassunto();
    render();
  })
  .catch(() => {
    main.innerHTML = `<p class="errore">Non riesco a leggere i capi. Avvia il server con <code>closetune</code>.</p>`;
  });
