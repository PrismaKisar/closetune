"""Check: cd tools && ../.venv/bin/python test_foto.py"""
import numpy as np
from foto import calibrate, find_sheets, median_hex

cast = np.array([1.08, 1.0, 0.85])      # luce calda
img = np.full((900, 700, 3), 60.0)
GRAYS = (140, 160, 205, 215)            # riquadri neutri (valori "veri" sotto luce neutra)


def sheet(x0):
    img[100:560, x0:x0 + 220] = 235     # carta
    for i, v in enumerate(GRAYS):
        y, x = 130 + (i // 2) * 200, x0 + 20 + (i % 2) * 100
        img[y:y + 90, x:x + 90] = v


sheet(20); sheet(460)
img[650:850, 250:450] = [200, 30, 30]   # capo rosso
img = np.clip(img * cast, 0, 255).astype(np.uint8)

sheets = find_sheets(img)
assert len(sheets) == 2, len(sheets)
cal = calibrate(img, sheets)
for x0 in (20, 460):                    # ogni riquadro neutro dopo la calibrazione
    for i in range(4):
        y, x = 130 + (i // 2) * 200 + 20, x0 + 20 + (i % 2) * 100 + 20
        p = cal[y:y + 50, x:x + 50].reshape(-1, 3).astype(int)
        assert np.ptp(np.median(p, 0)) <= 3, (x0, i, np.median(p, 0))
mask = np.zeros(img.shape[:2], bool); mask[650:850, 250:450] = True
r, g, b = (int(median_hex(cal, mask)[i:i + 2], 16) for i in (1, 3, 5))
assert r > 185 and g < 60 and b < 60, (r, g, b)
from foto import palette
two = cal.copy(); two[650:850, 250:350] = [20, 40, 200]   # capo bicolore: rosso + blu
pal = palette(two, mask)
assert len(pal) >= 2 and abs(pal[0][1] - 0.5) < 0.1, pal
print("ok")

from cinture import angolo
m = np.zeros((400, 400), bool)
for y in range(400): m[y, 100 + y // 4: 140 + y // 4] = True   # cinta inclinata: scende verso destra di ~14 gradi
assert 12 < angolo(m) < 16, angolo(m)
print("ok cinture")
