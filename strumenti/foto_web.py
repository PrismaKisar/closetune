"""foto_web.py [NNN ...] -> dati/foto/web/NNN.webp: versione da vetrina delle foto calibrate, solo per il sito.

La foto calibrata (foto/NNN.webp) resta la fonte: qui si ritocca solo l'aspetto, l'hex non si misura da qui.
- alte luci compresse con una spalla morbida: i capi bianchi non sembrano "sparaflashati"
- ombre aperte: i capi neri mostrano la trama
- contrasto locale: trecce, coste e pieghe tornano leggibili
- ombra morbida sotto il capo, sfondo caldo chiaro (= --frame del sito)
Senza argomenti rigenera solo le foto mancanti o più vecchie dell'originale.
Uso: .venv/bin/python strumenti/foto_web.py [NNN ...]
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage as ndi

DATI = Path(__file__).resolve().parent.parent / "dati"
SRC_BG = np.array([235, 235, 236], float)  # sfondo scritto da foto.py
BG = np.array([239, 237, 232], float)      # sfondo web, caldo: --frame in sito/style.css
MAXSIDE = 900

SPALLA = 0.72      # da qui in su le luci si comprimono
TETTO = 0.90       # il bianco puro arriva qui, sotto lo sfondo (0.93): il capo resta un capo
PIEDE = 0.10       # sotto questa luminanza le ombre si aprono
APERTURA = 0.45
CHIAREZZA = 0.45   # contrasto locale (sigma ampio)
NITIDEZZA = 0.35   # dettaglio fine


def sagoma(rgb):
    """Maschera del capo: tutto ciò che non è sfondo collegato al bordo, con buchi riempiti."""
    vicino = np.linalg.norm(rgb - SRC_BG, axis=-1) < 2.5  # lo sfondo di foto.py è piatto (rumore <= 1)
    lab, _ = ndi.label(vicino)
    bordo = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    sfondo = np.isin(lab, bordo[bordo > 0])
    capo = ndi.binary_fill_holes(~sfondo)
    # via le frange del ritaglio (resti chiari a gradini sui capi bianchi): l'ombra le renderebbe visibili
    raggio = max(3, round(max(rgb.shape[:2]) / 140))
    disco = np.hypot(*np.mgrid[-raggio:raggio + 1, -raggio:raggio + 1]) <= raggio
    capo = ndi.binary_opening(capo, structure=disco)
    capo = ndi.binary_erosion(capo, iterations=2)  # via l'alone chiaro lasciato dal ritaglio
    lab, n = ndi.label(capo)
    if n > 1:  # via le briciole di compressione, ma restano i pezzi grandi (le due scarpe di un paio)
        aree = ndi.sum(capo, lab, range(1, n + 1))
        capo = np.isin(lab, 1 + np.flatnonzero(aree >= 0.2 * aree.max()))
    return capo


def tono(L):
    """Curva di luminanza (0-1): spalla sulle luci, piede sulle ombre, lineare in mezzo."""
    out = L.copy()
    alte = L > SPALLA
    x = (L[alte] - SPALLA) / (1 - SPALLA)
    out[alte] = SPALLA + (TETTO - SPALLA) * (1 - (1 - x) ** 2) * 0.5 + (TETTO - SPALLA) * x * 0.5
    basse = L < PIEDE
    out[basse] = L[basse] + (PIEDE - L[basse]) * APERTURA * (1 - L[basse] / PIEDE)
    return out


def ritocca(img):
    rgb = np.asarray(img.convert("RGB"), float)
    capo = sagoma(rgb)
    morbida = ndi.gaussian_filter(capo.astype(float), 1.2)

    L = rgb.mean(-1) / 255
    # tone mapping locale: la curva agisce sulla luce d'insieme (passa-basso), la trama si rimette sopra
    # intera e rinforzata, così le luci compresse non perdono coste, trecce e pieghe
    dentro = ndi.gaussian_filter(ndi.binary_erosion(capo, iterations=3).astype(float), 1.5)  # niente alone sul bordo
    base = np.where(capo, L, L[capo].mean() if capo.any() else 0.5)
    insieme = ndi.gaussian_filter(base, max(rgb.shape[:2]) / 90)
    fine = base - ndi.gaussian_filter(base, 1.0)
    locale = tono(insieme) + (1 + CHIAREZZA) * (base - insieme) + NITIDEZZA * fine
    L2 = np.clip(dentro * locale + (1 - dentro) * tono(L), 0, 1)
    rapporto = np.where(L > 1e-3, L2 / np.maximum(L, 1e-3), 1)[..., None]
    nuovo = np.clip(rgb * rapporto, 0, 255)

    # ombra morbida spostata in basso
    h, w = capo.shape
    lato = max(h, w)
    ombra = np.zeros((h, w))
    # solo ombra d'ambiente: un'ombra stretta ricalcherebbe le frange del ritaglio
    for sigma, dy, forza in ((lato * 0.03, lato * 0.02, 0.15),):
        ombra += forza * ndi.shift(ndi.gaussian_filter(capo.astype(float), sigma), (dy, 0), order=1)
    fondo = BG * (1 - np.clip(ombra, 0, 0.3))[..., None]

    out = nuovo * morbida[..., None] + fondo * (1 - morbida[..., None])
    out = Image.fromarray(out.round().astype(np.uint8))
    out.thumbnail((MAXSIDE, MAXSIDE))
    return out


def da_fare(nomi=None):
    sorgenti = sorted(p for p in (DATI / "foto").glob("*.webp"))
    if nomi:
        return [p for p in sorgenti if p.stem in nomi]
    dest = DATI / "foto" / "web"
    return [p for p in sorgenti
            if not (dest / p.name).exists() or (dest / p.name).stat().st_mtime < p.stat().st_mtime]


def main(nomi):
    dest = DATI / "foto" / "web"
    dest.mkdir(parents=True, exist_ok=True)
    for p in da_fare(nomi):
        out = ritocca(Image.open(p))
        out.save(dest / p.name, quality=82, method=6)
        print(f"{dest / p.name} {(dest / p.name).stat().st_size // 1024}KB")


if __name__ == "__main__":
    main(sys.argv[1:])
