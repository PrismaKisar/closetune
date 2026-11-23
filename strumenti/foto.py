"""foto.py IN.jpg NNN -> dati/foto/NNN.webp (calibrata sui fogli grigi, ritagliata su grigio) + stampa hex.
Uso: .venv/bin/python strumenti/foto.py ~/Downloads/IMG.jpg 042 [modello soglia]
Fogli: strumenti/griglia_grigi.pdf (2x2: 10/18/50/80%), uno per lato del capo.
"""
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage as ndi

TARGET = 235          # il bianco del foglio diventa questo grigio (non 255: non brucia i capi chiari)
BG = (235, 235, 236)  # sfondo finale, grigio e-commerce
MAXSIDE = 800
ROOT = Path(__file__).resolve().parent.parent
DATI = ROOT / "dati"  # dati personali: capi/, foto/, profilo.md, outfit.md


def _lin(a):  # sRGB 0-1 -> lineare
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def _srgb(a):
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * np.clip(a, 0, None) ** (1 / 2.4) - 0.055)


def find_sheets(rgb):
    """Per ogni foglio: (x centrale, 3 curve per canale in lineare). Cerca i 4 riquadri uniformi.
    Soglia di uniformità crescente finché non si trovano 2 fogli (luce con gradiente sui riquadri scuri)."""
    best = []
    for thr in (3, 5, 8):
        sheets = _find_sheets(rgb, thr)
        if len(sheets) == 2:
            return sheets
        best = best or sheets
    if not best:
        raise SystemExit("nessun foglio con almeno 3 riquadri trovato")
    print("ATTENZIONE: un solo foglio, niente correzione della luce a gradiente", file=sys.stderr)
    return best


def _find_sheets(rgb, sd_thr):
    a = rgb.astype(float)
    h, w, _ = a.shape
    g = a.mean(-1)
    mu = ndi.uniform_filter(g, 15)
    sd = np.sqrt(np.maximum(ndi.uniform_filter(g * g, 15) - mu * mu, 0))
    lab, _ = ndi.label(ndi.binary_opening((sd < sd_thr) & (g > 80) & (g < 235), iterations=5))
    pat = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        m = lab[sl] == i
        ph, pw = m.shape
        if 0.001 * h * w < m.sum() < 0.03 * h * w and m.sum() / m.size > 0.78 and 0.8 < ph / pw < 1.25:
            core = ndi.binary_erosion(m, iterations=min(15, ph // 4))
            pat.append((sl, np.median(a[sl][core], 0), pw))
    pat.sort(key=lambda p: p[0][1].start)
    groups, cur = [], []
    for p in pat:  # nuovo foglio se il salto in x è > 3 larghezze di riquadro
        if cur and p[0][1].start - cur[-1][0][1].start > 3 * p[2]:
            groups.append(cur); cur = []
        cur.append(p)
    groups.append(cur)
    sheets = []
    for grp in groups:
        if not 3 <= len(grp) <= 4:  # il riquadro più chiaro può sparire se la foto è luminosa
            continue
        y0, y1 = min(p[0][0].start for p in grp), max(p[0][0].stop for p in grp)
        x0, x1 = min(p[0][1].start for p in grp), max(p[0][1].stop for p in grp)
        ring = np.zeros((h, w), bool)
        ring[max(y0 - 35, 0):y1 + 35, max(x0 - 35, 0):x1 + 35] = True
        ring[y0 - 10:y1 + 10, x0 - 10:x1 + 10] = False
        px = a[ring]
        px = px[px.mean(-1) >= np.percentile(px.mean(-1), 50)]  # solo carta, non ombre/tavolo
        paper = np.median(px, 0)
        raw = np.array([p[1] for p in grp])               # 4 riquadri x RGB
        gain = _lin(np.full(3, TARGET / 255)) / _lin(paper / 255)
        wb = _lin(raw / 255) * gain                       # dopo bilanciamento bianco
        goal = wb.mean(-1, keepdims=True).repeat(3, 1)    # il grigio stampato deve essere neutro
        xs = np.vstack([np.zeros(3), _lin(raw / 255), _lin(paper / 255)])
        ys = np.vstack([np.zeros(3), goal, np.full(3, _lin(TARGET / 255))])
        o = np.argsort(xs.mean(1))
        cm = (x1 - x0) / 17  # il blocco dei riquadri è 17 cm su A4 (21 x 29,7)
        rect = (int(y0 - 6.4 * cm), int(y1 + 6.4 * cm), int(x0 - 2.1 * cm), int(x1 + 2.1 * cm))
        sheets.append(((x0 + x1) / 2, xs[o], ys[o], rect))
    return sheets


def calibrate(rgb, sheets):
    """Curva per canale (neutralizza grigi e bianco); con 2 fogli si interpola in x tra i due."""
    lin = _lin(rgb / 255.0)
    outs = [np.stack([np.interp(lin[..., c], xs[:, c], ys[:, c]) for c in range(3)], -1)
            for _, xs, ys, *_ in sheets]
    if len(outs) == 1:
        out = outs[0]
    else:
        (xa, *_), (xb, *_) = sheets[0], sheets[-1]
        t = np.clip((np.arange(rgb.shape[1]) - xa) / (xb - xa), 0, 1)[None, :, None]
        out = outs[0] * (1 - t) + outs[-1] * t
    return (_srgb(np.clip(out, 0, 1)) * 255 + 0.5).astype(np.uint8)


def median_hex(rgb, mask):
    mask = ndi.binary_erosion(mask, iterations=5)  # via i bordi sfumati
    r, g, b = np.median(rgb[mask], 0).astype(int)
    return f"#{r:02x}{g:02x}{b:02x}"


def palette(rgb, mask, k=3):
    """Colori del capo: [(hex, quota)] per cluster k-means, dal più grande. Per capi multicolore."""
    from scipy.cluster.vq import kmeans2
    px = rgb[ndi.binary_erosion(mask, iterations=5)][::50].astype(float)
    _, lbl = kmeans2(px, k, minit="++", seed=0)
    out = [(np.median(px[lbl == i], 0).astype(int), (lbl == i).mean()) for i in range(k) if (lbl == i).any()]
    return [("#%02x%02x%02x" % tuple(c), round(q, 2)) for c, q in sorted(out, key=lambda t: -t[1])]


def cutout(img, model=None):
    from rembg import new_session, remove
    return np.array(remove(img, session=new_session(model) if model else None))[..., 3]


def main(src, nnn, model=None, thr=128):
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    rgb = np.array(img)
    sheets = find_sheets(rgb)
    cal = calibrate(rgb, sheets)
    alpha = cutout(Image.fromarray(cal), model)
    for *_, (ya, yb, xa, xb) in sheets:  # i fogli non fanno parte del capo (anche se lo toccano)
        alpha[max(ya, 0):yb, max(xa, 0):xb] = 0
    if os.environ.get("COLS"):  # più capi nella stessa foto: COLS="0.35,0.66" tiene solo quella fascia (frazioni di larghezza)
        a, b = map(float, os.environ["COLS"].split(","))
        w = alpha.shape[1]
        alpha[:, : int(a * w)] = 0
        alpha[:, int(b * w):] = 0
    if model:  # capo chiaro su sfondo chiaro: tieni solo i pixel di colore simile al nucleo sicuro
        core = alpha > 170
        lab, n = ndi.label(core)
        core = lab == (np.argmax(ndi.sum(core, lab, range(1, n + 1))) + 1)
        mu, sd = cal[core].mean(0), cal[core].std(0).mean()
        close = np.linalg.norm(cal.astype(float) - mu, axis=-1) < 1.6 * sd
        alpha = np.where(close, alpha, 0)
        alpha = ndi.binary_closing(alpha > thr, iterations=6) * 255
    lab, n = ndi.label(alpha > thr)
    keep = lab == (np.argmax(ndi.sum(alpha > thr, lab, range(1, n + 1))) + 1)
    keep = ndi.binary_fill_holes(keep)
    opened = ndi.binary_opening(keep, iterations=12)  # toglie propaggini sottili
    lab, n = ndi.label(opened)
    keep = lab == (np.argmax(ndi.sum(opened, lab, range(1, n + 1))) + 1)
    ys, xs = np.where(keep)
    box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
    soft = ndi.gaussian_filter(keep.astype(float), 1.5)[..., None]  # bordo morbido
    out = (cal * soft + np.array(BG) * (1 - soft)).astype(np.uint8)
    out = Image.fromarray(out).crop(box)
    pad = int(0.06 * max(out.size))
    out = ImageOps.expand(out, pad, fill=BG)
    out.thumbnail((MAXSIDE, MAXSIDE))
    dst = DATI / "foto" / f"{nnn}.webp"
    out.save(dst, quality=78, method=6)
    print(f"{dst} {dst.stat().st_size // 1024}KB hex={median_hex(cal, keep)}")
    print("palette:", palette(cal, keep))


if __name__ == "__main__":
    # opzionali: modello rembg e soglia alpha (capi chiari su sfondo chiaro: isnet-general-use 170)
    main(*sys.argv[1:3], *(sys.argv[3:4]), *map(int, sys.argv[4:5]))
