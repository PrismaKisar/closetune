# Armadio Digitale

Questa directory è l'inventario strutturato dei capi d'abbigliamento dell'utente. Serve per:
1. Consigliare abbinamenti quando l'utente indica un capo di partenza.
2. Suggerire palette colore adatte a incarnato/occhi/capelli (vedi `dati/profilo.md`).
3. Individuare i "buchi" nell'armadio (categorie/colori mancanti) per i prossimi acquisti.

## Struttura

```
closetune          comando: avvia il server e apre il sito
sito/              il sito (index.html, app.js, abbinamenti.js = colori e outfit, gusto.js = regole di stile, style.css)
strumenti/         server.py, foto.py (foto calibrate), cinture.py, foto_web.py (foto da vetrina), pubblica.py (GitHub Pages), test
dati/              dati personali, fuori dal repo git:
  profilo.md         colori pelle/occhi/capelli, taglie, stile; `pelle: "#hex"` per il voto pelle del sito
  capi/NNN-nome.md   un file per ogni capo posseduto
  foto/NNN.webp      foto calibrate (foto/web/ = versioni ritoccate per il sito)
  outfit.md          combinazioni approvate dall'utente (solo liste di id, senza note)
ricerca/           report e note di ricerca, fuori dal repo git
```

I percorsi qui sotto (`capi/`, `foto/`, `profilo.md`, `outfit.md`) sono relativi a `dati/`.

## Censimento di un nuovo capo

L'utente invia una foto. Da quella foto vanno estratte tutte le caratteristiche utili e scritte nel file del capo; il file `.md` resta la fonte di verità primaria per marca/colore/dettagli.

Il **colore** è definito dal campo `hex` (fonte di verità), misurato dalla foto calibrata; `colore:` è solo l'etichetta-nome derivata dall'hex. Per i capi multicolore `hex` è il colore dominante, con `hex_secondari: [...]` opzionale.

**Procedura foto** (luce diurna diffusa, sfondo chiaro, capo intero con margine, telefono parallelo al piano, esposizione bloccata): stampare 2 volte `strumenti/griglia_grigi.pdf` (A4 100%, solo nero, carta opaca) e metterle ai lati opposti del capo. Poi:

```
.venv/bin/python strumenti/foto.py ~/Downloads/IMG.jpg NNN
```

Lo script calibra bianco/grigi sui fogli, ritaglia il capo su sfondo grigio, salva `foto/NNN.webp` (~20-30 KB) e stampa l'hex. Test: `cd strumenti && ../.venv/bin/python test_foto.py`. Il file `.md` resta la fonte per marca/materiale/dettagli; la foto serve come riferimento visivo e va collegata con `foto: foto/NNN.webp` (path relativo a `dati/`).

Cinture: una foto per cintura (fogli grigi accanto, cinta in verticale con la fibbia in alto), `.venv/bin/python strumenti/cinture.py IN.jpg NNN [cm]` salva un ritaglio rettangolare raddrizzato (fibbia + `cm` cm, default 36). Se la rilevazione sbaglia: `... IN.jpg NNN 36 cx,y0,angolo` (centro cinta a metà lunghezza, cima fibbia, inclinazione in gradi).

Il sito (`./closetune`, server in `strumenti/server.py`) mostra una versione ritoccata, `foto/web/NNN.webp` (luci compresse, trama in evidenza, ombra morbida), generata da `strumenti/foto_web.py` e rigenerata in automatico all'avvio del server se manca o è più vecchia. È solo estetica: l'`hex` si misura sempre dalla foto calibrata `foto/NNN.webp`, mai da `foto/web/`.

Ogni file capo usa questo frontmatter:

```yaml
---
id: 001
categoria: camicia        # camicia, maglia, pantalone, giacca, scarpe, accessorio, ecc.
colore: blu navy        # etichetta derivata da hex
hex: "#1f2a44"          # fonte di verità del colore
marca: Zara
modello: slim fit
materiale: cotone
stagione: [primavera, autunno]
occasione: [casual, smart-casual]
stato: attivo             # attivo | casa | dismesso
foto: foto/001.webp       # riferimento alla foto compressa, se disponibile
---
Note libere (pattern particolari, dettagli non catalogabili sopra).
```

Naming file: `capi/NNN-descrizione-breve.md`, NNN = id progressivo a 3 cifre.

Sito online (sola lettura, dati pubblici per scelta dell'utente): https://prismakisar.github.io/closetune/ — si aggiorna con `.venv/bin/python strumenti/pubblica.py` dopo ogni modifica a sito o dati. Le regole di gusto (`sito/gusto.js`) vengono da `ricerca/gusto-abbinamenti.md`.

## Come rispondere alle richieste

- **"Voglio mettere il capo X"** → leggere tutti i file in `capi/`, filtrare per categorie complementari (es. camicia → pantalone/giacca/scarpe), valutare il contrasto cromatico/di luminosità su tutta la gamma di colori disponibile (non solo sui capi già presenti in `outfit.md`), proporre 2-3 abbinamenti motivando la scelta.
- **Consigli colore personali** → usare `profilo.md` per suggerire tonalità coerenti con incarnato/occhi/capelli.
- **Consiglio d'acquisto** → analizzare la distribuzione di categorie/colori/occasioni in `capi/`, segnalare la lacuna più evidente rispetto a un armadio "completo" per l'uso dichiarato (es. lavoro, tempo libero, eventi).

## Regole

- Non inventare caratteristiche non visibili/non dichiarate: se un dettaglio non è chiaro dalla foto, chiedere.
- Aggiungere una combinazione a `outfit.md` solo dopo approvazione esplicita dell'utente (es. "va bene", "confermo"), non per abbinamenti solo proposti.
- Le note libere nei file `capi/` restano descrittive del capo (pattern, dettagli non catalogabili): non scriverci consigli di abbinamento, che vivono solo in `outfit.md`.
- Quando un capo non viene più usato, impostare `stato: dismesso` invece di cancellare il file (mantiene lo storico).
- `stato: casa` = capo usato solo in casa (es. pile, tuta): resta censito ma non entra mai negli abbinamenti né nell'outfit del giorno.
