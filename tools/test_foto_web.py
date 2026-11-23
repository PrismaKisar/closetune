"""cd tools && ../.venv/bin/python test_foto_web.py"""
import unittest

import numpy as np
from PIL import Image

import foto_web as fw


def finta(colore, trama=0.0, lato=300):
    """Capo rettangolare con trama a righe su sfondo di foto.py."""
    a = np.tile(fw.SRC_BG, (lato, lato, 1))
    y, x = np.mgrid[:lato, :lato]
    capo = (y > 60) & (y < 240) & (x > 70) & (x < 230)
    righe = np.sin(y / 1.2)[..., None] * trama  # ~7 px: una trama di maglia, più fine del raggio di chiarezza
    a[capo] = np.clip(np.array(colore, float) + righe[capo], 0, 255)
    return Image.fromarray(a.astype(np.uint8)), capo


class TestFotoWeb(unittest.TestCase):
    def test_sagoma(self):
        img, capo = finta((250, 250, 248))  # bianco più chiaro dello sfondo
        m = fw.sagoma(np.asarray(img, float))
        self.assertGreater((m & capo).sum() / capo.sum(), 0.95)
        self.assertLess((m & ~capo).sum(), 50)

    def test_tono(self):
        L = np.array([0.0, 0.05, 0.5, 0.8, 1.0])
        out = fw.tono(L)
        self.assertAlmostEqual(out[2], 0.5)                 # i medi non cambiano
        self.assertLessEqual(out[-1], fw.TETTO + 1e-9)       # il bianco puro scende sotto lo sfondo
        self.assertGreater(out[1], 0.05)                     # le ombre si aprono
        self.assertTrue(np.all(np.diff(out) > 0))            # la curva resta monotona

    def test_bianco_non_sparato_e_trama_visibile(self):
        img, capo = finta((252, 252, 250), trama=3)
        out = np.asarray(fw.ritocca(img), float)
        dentro = capo[80:220, 90:210]
        prima = np.asarray(img, float)[80:220, 90:210][dentro].mean(-1)
        dopo = out[80:220, 90:210][dentro].mean(-1)
        self.assertLess(dopo.mean(), prima.mean() - 10)      # luci compresse
        self.assertGreater(dopo.std(), prima.std())          # trama più leggibile

    def test_ombra_sotto_e_sfondo_caldo(self):
        img, _ = finta((120, 60, 40))
        out = np.asarray(fw.ritocca(img), float)
        self.assertTrue(np.allclose(out[5, 5], fw.BG, atol=2))   # angolo = sfondo web
        sotto, sopra = out[250, 150].mean(), out[50, 150].mean()
        self.assertLess(sotto, sopra - 3)                         # l'ombra cade in basso


if __name__ == "__main__":
    unittest.main()
