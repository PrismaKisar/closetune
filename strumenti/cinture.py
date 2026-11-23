"""cinture.py IN.jpg NNN [cm] -> dati/foto/NNN.webp: una cintura (foto singola, fogli grigi accanto), fibbia in alto,
raddrizzata e tagliata a `cm` cm dalla cima della fibbia (default 22), sfondo tolto (rembg sul ritaglio) e messo sul grigio di default.
Cinta stretta e scura su asciugamano: niente rembg, si segmenta per scarto dal colore dello sfondo."""
import sys

import numpy as np
from PIL import Image, ImageOps
from scipy import ndimage as ndi

from foto import BG, DATI, calibrate, cutout, find_sheets

MAXSIDE = 1600   # cinte strette: più risoluzione del default per non sgranare


def angolo(mask):
    """Inclinazione (gradi) dell'asse lungo della maschera rispetto alla verticale: >0 = in basso verso destra."""
    ys, xs = np.nonzero(mask)
    c = np.cov(np.vstack([xs - xs.mean(), ys - ys.mean()]))
    w, v = np.linalg.eigh(c)
    vx, vy = v[:, 1]                       # asse principale
    if vy < 0:
        vx, vy = -vx, -vy
    return float(np.degrees(np.arctan2(vx, vy)))


def finalizza(out, nnn):
    """Toglie lo sfondo (rembg sul ritaglio: la cinta è il soggetto), metti sul grigio di default, salva e ritorna l'hex."""
    a = cutout(out)
    lab, n = ndi.label(a > 128)
    keep = lab == np.argmax(ndi.sum(a > 128, lab, range(1, n + 1))) + 1      # i buchi (dentro la fibbia) restano sfondo
    soft = ndi.gaussian_filter(keep.astype(float), 1.0)[..., None]
    arr = np.array(out)
    comp = Image.fromarray((arr * soft + np.array(BG) * (1 - soft)).astype(np.uint8))
    ys, xs = np.nonzero(keep)
    comp = ImageOps.expand(comp.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)), int(0.05 * max(np.ptp(xs), np.ptp(ys))), fill=BG)
    comp.thumbnail((MAXSIDE, MAXSIDE))
    dst = DATI / "foto" / f"{nnn}.webp"
    comp.save(dst, quality=90, method=6)
    body = ndi.binary_erosion(keep, iterations=6)
    body[: int(.4 * body.shape[0])] = False                                   # senza fibbia
    r, g, b = np.median(arr[body], 0).astype(int)
    print(f"{dst} {dst.stat().st_size // 1024}KB hex=#{r:02x}{g:02x}{b:02x}")


def main(src, nnn, cm=22, modo="auto"):
    rgb = np.array(ImageOps.exif_transpose(Image.open(src)).convert("RGB"))
    sheets = find_sheets(rgb)
    cal = calibrate(rgb, sheets)
    H, W = cal.shape[:2]
    pxcm = np.mean([(s[3][3] - s[3][2]) / 21.2 for s in sheets])
    bg = np.median(cal[int(.3 * H):int(.9 * H)].reshape(-1, 3), 0)
    if modo.count(",") == 2:                          # a mano: "cx,y0,angolo" = centro cinta a metà lunghezza, cima fibbia, inclinazione
        cx, y0, a = map(float, modo.split(","))
        L, half = int(cm * pxcm), int(2.3 * 3.5 * pxcm)
        y1 = min(int(y0 + L), H)
        piece = Image.fromarray(cal).crop((int(cx - 3 * half), int(y0), int(cx + 3 * half), y1))
        piece = piece.rotate(-a, resample=Image.BICUBIC, fillcolor=tuple(int(v) for v in bg))
        finalizza(piece.crop((piece.width // 2 - half, 0, piece.width // 2 + half, piece.height)), nnn)
        return
    diff = ndi.median_filter(np.linalg.norm(cal.astype(float) - bg, axis=-1), size=5)
    for *_, (ya, yb, xa, xb) in sheets:
        diff[max(ya, 0):yb, max(xa, 0):xb] = 0
    diff[: int(.3 * H)] = 0                           # sopra: piumone e lenzuolo
    lum = cal.astype(float).mean(2)
    lum[: int(.3 * H)] = 255
    for *_, (ya, yb, xa, xb) in sheets:
        lum[max(ya, 0):yb, max(xa, 0):xb] = 255
    # cinta scura: nucleo = pixel molto più scuri dell'asciugamano (le ombre della spugna non lo sono), poi si allarga ai pixel diversi vicini
    # cinta chiara/colorata (modo "d"): solo lo scarto di colore
    scura = ndi.binary_opening(ndi.median_filter(lum, size=5) < 0.45 * bg.mean(), iterations=6)
    base = (diff > 40) if modo == "d" or scura.sum() < 0.002 * H * W else scura
    base = ndi.binary_opening(base, iterations=14 if base is not scura else 4)
    lab, n = ndi.label(base)
    best, keep = 0, None
    for i, sl in enumerate(ndi.find_objects(lab), 1):  # lenzuolo/piumone sono larghi o toccano il bordo, la cinta no
        w = sl[1].stop - sl[1].start
        if w < .16 * W and sl[1].start > 0 and sl[1].stop < W and (lab[sl] == i).sum() > best:
            best, keep = (lab[sl] == i).sum(), lab == i
    if base is scura:
        keep = ndi.binary_closing((diff > 40) & ndi.binary_dilation(keep, iterations=int(0.02 * W)), iterations=8) | keep
        keep = ndi.binary_opening(keep, iterations=6)
    a = angolo(keep)
    img = Image.fromarray(cal).rotate(-a, resample=Image.BICUBIC, expand=True, fillcolor=tuple(int(v) for v in bg))
    m = np.array(Image.fromarray((keep * 255).astype(np.uint8)).rotate(-a, resample=Image.BILINEAR, expand=True)) > 127
    ys, xs = np.nonzero(m)
    w = xs.max() - xs.min()
    top = ys.min() - (0 if base is not scura else int(7.0 * pxcm))      # il nucleo scuro non include la fibbia d'argento
    top = max(top - int(0.6 * pxcm), 0)
    finalizza(img.crop((max(xs.min() - w, 0), top, xs.max() + w, min(ys.max() + 1, int(top + cm * pxcm)))), nnn)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], *([float(sys.argv[3])] if len(sys.argv) > 3 else []), *sys.argv[4:5])
