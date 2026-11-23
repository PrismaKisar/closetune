# closetune

Il tuo armadio digitale, in locale. Ogni capo è un file Markdown con il colore misurato da una foto
calibrata; il sito filtra i capi, genera gli outfit rispettando gli strati (sotto, sopra, pantaloni,
cintura, scarpe), li ordina per armonia cromatica e spiega perché i colori stanno bene insieme.

## Avvio

Serve Python 3.10+ (macOS o Linux).

```sh
git clone https://github.com/PrismaKisar/closetune.git
cd closetune
./closetune
```

Al primo avvio crea `.venv` con le dipendenze, poi apre il sito su http://127.0.0.1:8765/.
Il server resta acceso in background e si spegne da solo dopo 15 minuti senza richieste
(`INATTIVO_MIN` in `strumenti/server.py`); `./closetune stop` lo spegne subito.
Per lanciarlo da qualsiasi cartella scrivendo solo `closetune`:

```sh
mkdir -p ~/.local/bin && ln -sf "$PWD/closetune" ~/.local/bin/closetune   # ~/.local/bin deve essere nel PATH
```

## Struttura

```
closetune     comando di avvio
sito/         il sito: index.html, app.js, abbinamenti.js (colori e outfit), style.css
strumenti/    server.py, foto.py (foto calibrate), cinture.py, foto_web.py, test
dati/         i tuoi dati (privati)
```

## I tuoi dati

Stanno in `dati/`, che resta sul tuo computer e non finisce nel repo:

```
dati/
  capi/NNN-nome.md   un file per capo (formato in CLAUDE.md)
  foto/NNN.webp      foto calibrate dei capi
  outfit.md          outfit approvati, una riga per outfit: - [001, 069, 051]
  profilo.md         facoltativo
```

In `profilo.md`: con `pelle: "#rrggbb"` nel frontmatter gli outfit tengono conto
  anche di quanto i colori vicino al viso stanno bene con la tua pelle.

```yaml
---
pelle: "#ddb095"
---
```

Le regole sulla pelle oggi sono pensate per un sottotono caldo con contrasto alto.

## Foto calibrate

Stampa due volte `strumenti/griglia_grigi.pdf` (A4 al 100%), mettile ai lati del capo e fotografa con luce
diurna. Poi:

```sh
.venv/bin/pip install -r requirements-foto.txt   # una volta (scontorno con rembg)
.venv/bin/python strumenti/foto.py ~/Downloads/IMG.jpg 001
```

Stampa l'hex del capo e salva `dati/foto/001.webp`.

## Test

```sh
node --test sito/*.test.mjs
cd strumenti && ../.venv/bin/python test_server.py && ../.venv/bin/python test_foto_web.py
```
