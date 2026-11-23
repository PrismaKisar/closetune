"""cd strumenti && ../.venv/bin/python test_server.py"""
import json
import tempfile
import threading
import unittest
import urllib.request
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path

import server

CAPO = """---
id: 086
categoria: pile
colore: blu petrolio a quadri
hex: "#3b5772"                        # colore medio d'insieme
hex_secondari: ["#507b9e", "#22313b"]   # azzurro, blu notte
stagione: [tutte]
occasione: [casual, outdoor]
stato: attivo
foto: foto/086.webp
---
Fantasia a quadri.
"""


class TestParser(unittest.TestCase):
    def test_frontmatter(self):
        c = server.leggi_capo(CAPO)
        self.assertEqual(c["id"], "086")
        self.assertEqual(c["hex"], "#3b5772")
        self.assertEqual(c["hex_secondari"], ["#507b9e", "#22313b"])
        self.assertEqual(c["occasione"], ["casual", "outdoor"])
        self.assertEqual(c["stagione"], ["primavera", "estate", "autunno", "inverno"])
        self.assertFalse(c["hex_stimato"])
        self.assertEqual(c["note"], "Fantasia a quadri.")

    def test_hex_stimato_dal_nome(self):
        c = server.leggi_capo("---\nid: 001\ncolore: blu navy con stampa panna\n---\n")
        self.assertTrue(c["hex_stimato"])
        self.assertEqual(c["hex"], server.NOMI_HEX["blu navy"])

    def test_nome_primo_e_piu_lungo(self):
        self.assertEqual(server.hex_da_nome("grigio antracite con stampa gialla"), server.NOMI_HEX["grigio antracite"])
        self.assertEqual(server.hex_da_nome("nero/marrone molto scuro"), server.NOMI_HEX["nero"])
        self.assertIsNone(server.hex_da_nome("multicolore"))

    def test_senza_frontmatter(self):
        self.assertIsNone(server.leggi_capo("solo testo"))

    def test_tutti_i_capi_reali_si_leggono(self):
        d = server.carica()
        self.assertEqual(len(d["capi"]), len(list((server.DATI / "capi").glob("*.md"))))
        for c in d["capi"]:
            self.assertRegex(c["hex"], r"^#[0-9a-fA-F]{6}$", c["id"])
            self.assertIn(c["stato"], ("attivo", "dismesso"), c["id"])


class TestServer(unittest.TestCase):
    def test_armadio_vuoto(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(server.carica(Path(tmp)), {"capi": [], "outfit": [], "profilo": {"pelle": None}})

    def test_api_e_collage(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "capi").mkdir()
            for i in ("001", "002"):
                (root / "capi" / f"{i}.md").write_text(f"---\nid: {i}\ncolore: nero\nfoto: foto/collage.webp\n---\n")
            (root / "outfit.md").write_text("# Outfit\n\n- [001, 002]\n")
            d = server.carica(root)
            self.assertTrue(all(c["foto_collage"] for c in d["capi"]))
            self.assertEqual(d["outfit"], [["001", "002"]])
            self.assertEqual(d["profilo"], {"pelle": None})
            (root / "profilo.md").write_text('---\npelle: "#ddb095"   # selfie\n---\n')
            self.assertEqual(server.carica(root)["profilo"], {"pelle": "#ddb095"})
            self.assertNotIn("foto_web", d["capi"][0])
            (root / "foto" / "web").mkdir(parents=True)
            (root / "foto" / "web" / "collage.webp").write_bytes(b"x")
            self.assertEqual(server.carica(root)["capi"][0]["foto_web"], "foto/web/collage.webp")

        srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(server.Handler, directory=str(server.ROOT)))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{srv.server_port}"
        try:
            d = json.load(urllib.request.urlopen(base + "/api/capi"))
            self.assertIn("capi", d)
            r = urllib.request.urlopen(base + "/sito/index.html")
            self.assertEqual(r.headers["Cache-Control"], "no-cache")  # foto e codice aggiornati si vedono subito
            self.assertTrue(r.headers["Last-Modified"])
            with self.assertRaises(urllib.error.HTTPError):  # niente accesso fuori da sito/ e foto/
                urllib.request.urlopen(base + "/profilo.md")
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(base + "/sito/..%2Fdati%2Fprofilo.md")
            for privato in ("/dati/profilo.md", "/foto/..%2Fprofilo.md", "/strumenti/server.py"):
                with self.assertRaises(urllib.error.HTTPError, msg=privato):
                    urllib.request.urlopen(base + privato)
            una = next(iter(sorted((server.DATI / "foto").glob("*.webp"))), None)
            if una:  # le foto dei dati si vedono su /foto/
                self.assertEqual(urllib.request.urlopen(f"{base}/foto/{una.name}").status, 200)
        finally:
            srv.shutdown()


CAPO_STATO = """---
id: 042
categoria: maglione
colore: blu   # commento
stato: attivo
---
Note con stato: attivo nel testo, da non toccare.
"""


class TestStato(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        (self.root / "capi").mkdir()
        self.file = self.root / "capi" / "042-maglione.md"
        self.file.write_text(CAPO_STATO)

    def tearDown(self):
        self.tmp.cleanup()

    def test_cambia_solo_la_riga_stato(self):
        self.assertTrue(server.imposta_stato("042", "dismesso", self.root))
        self.assertEqual(self.file.read_text(), CAPO_STATO.replace("stato: attivo\n---", "stato: dismesso\n---"))
        self.assertIn("Note con stato: attivo nel testo", self.file.read_text())
        self.assertTrue(server.imposta_stato("042", "attivo", self.root))
        self.assertEqual(self.file.read_text(), CAPO_STATO)

    def test_id_sconosciuto_e_stato_non_valido(self):
        self.assertFalse(server.imposta_stato("999", "dismesso", self.root))
        with self.assertRaises(ValueError):
            server.imposta_stato("042", "cancellato", self.root)
        self.assertEqual(self.file.read_text(), CAPO_STATO)

    def test_http(self):
        handler = type("H", (server.Handler,), {"root": self.root})
        srv = ThreadingHTTPServer(("127.0.0.1", 0), partial(handler, directory=str(self.root)))
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        url = f"http://127.0.0.1:{srv.server_port}/api/capi/042/stato"

        def post(corpo, tipo="application/json", origine=None):
            req = urllib.request.Request(url, data=corpo.encode(), method="POST", headers={"Content-Type": tipo})
            if origine:
                req.add_header("Origin", origine)
            try:
                return urllib.request.urlopen(req).status
            except urllib.error.HTTPError as e:
                return e.code

        try:
            self.assertEqual(post('{"stato": "dismesso"}', tipo="text/plain"), 403)   # form di un altro sito
            self.assertEqual(post('{"stato": "dismesso"}', origine="http://evil.example"), 403)
            self.assertEqual(post('{"stato": "boh"}'), 400)
            self.assertEqual(post("non json"), 400)
            self.assertEqual(self.file.read_text(), CAPO_STATO)                         # nulla è cambiato
            self.assertEqual(post('{"stato": "dismesso"}', origine=f"http://127.0.0.1:{srv.server_port}"), 204)
            self.assertIn("stato: dismesso", self.file.read_text())
            d = json.load(urllib.request.urlopen(f"http://127.0.0.1:{srv.server_port}/api/capi"))
            self.assertEqual(d["capi"][0]["stato"], "dismesso")
            req = urllib.request.Request(url.replace("042", "999"), data=b'{"stato": "attivo"}', method="POST",
                                         headers={"Content-Type": "application/json"})
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(req)
        finally:
            srv.shutdown()


if __name__ == "__main__":
    unittest.main()
