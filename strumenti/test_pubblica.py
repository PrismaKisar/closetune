"""cd strumenti && ../.venv/bin/python test_pubblica.py"""
import json
import tempfile
import unittest
from pathlib import Path

import pubblica

CAPO = """---
id: 001
categoria: t-shirt
colore: nero
hex: "#191d1f"
stato: attivo
foto: foto/001.webp
---
"""


class TestCostruisci(unittest.TestCase):
    def test_sito_statico(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            dati, out = d / "dati", d / "out"
            (dati / "capi").mkdir(parents=True)
            (dati / "foto" / "web").mkdir(parents=True)
            (dati / "capi" / "001-t.md").write_text(CAPO)
            (dati / "foto" / "001.webp").write_bytes(b"x")
            (dati / "foto" / "web" / "001.webp").write_bytes(b"y")
            (dati / "foto" / "999.webp").write_bytes(b"z")  # nessun capo la usa
            pubblica.costruisci(out, root=dati)
            api = json.loads((out / "api" / "capi").read_text())
            self.assertTrue(api["statico"])
            self.assertEqual(api["capi"][0]["foto_web"], "foto/web/001.webp")
            self.assertTrue((out / "index.html").exists() and (out / "sito" / "app.js").exists())
            self.assertTrue((out / "foto" / "web" / "001.webp").exists())
            self.assertFalse((out / "foto" / "999.webp").exists())
            self.assertFalse(list((out / "sito").glob("*.test.*")))
            # i percorsi devono essere relativi: su Pages il sito vive in /closetune/
            self.assertNotIn('"/sito/', (out / "index.html").read_text())


if __name__ == "__main__":
    unittest.main()
