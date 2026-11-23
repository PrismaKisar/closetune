"""closetune: serve sito/ + dati/foto/ e /api/capi letto dal vivo da dati/capi/*.md.
Uso: ./closetune  (oppure .venv/bin/python strumenti/server.py [porta]  ->  http://127.0.0.1:8000)
"""
import json
import posixpath
import re
import sys
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parent.parent
DATI = ROOT / "dati"  # dati personali, fuori dal repo
INATTIVO_MIN = 15  # senza richieste per tanto il server si spegne da solo; `closetune` lo riaccende

# Hex stimati dal nome colore, solo per i capi senza `hex` misurato (frase più lunga prima).
NOMI_HEX = {
    "blu navy scurissimo": "#161c2b", "blu navy": "#1f2a44", "navy": "#1f2a44",
    "blu petrolio chiaro": "#2f5f6b", "blu petrolio": "#1f4e5a", "petrolio": "#1f4e5a",
    "blu denim scuro": "#2c3e5c", "blu denim chiaro": "#8aa2bd", "denim slavato": "#a7b3bf",
    "blu ardesia": "#474e5e", "blu melange": "#4a5a78", "blu scuro": "#1d2433", "blu": "#2b4a7a",
    "university blue": "#8fb8de", "azzurro chiaro": "#a9c6e0", "azzurro": "#8fb3d4",
    "bianco panna": "#ece6d2", "bianco puro": "#f4f4f1", "bianco totale": "#f4f4f1", "bianco": "#f1f1ed",
    "panna": "#e6e1cc", "ecru": "#e4dcc6", "beige chiaro": "#ddd0b3", "beige": "#cbb994",
    "tortora": "#a39a8a", "sabbia": "#d2c29d", "cammello": "#b0875a",
    "marrone molto scuro": "#2e2420", "marrone scuro": "#4a3426", "marrone": "#6b4a33",
    "grigio antracite": "#3a3d40", "antracite": "#3a3d40", "grigio scuro": "#4b4e52",
    "grigio-verde chiaro": "#a9ae9c", "grigio-verde": "#9aa08e", "grigio-azzurro chiaro": "#b7c3cf",
    "grigio chiaro": "#b9bcbf", "grigio melange": "#9a9c9e", "grigio": "#8a8d90",
    "verde salvia chiaro": "#b3c1aa", "verde salvia": "#a3b49a", "verde oliva": "#6b6b3a",
    "verde scuro": "#2f4a35", "verde": "#4f7a4f",
    "giallo senape": "#d8aa44", "senape": "#d8aa44", "giallo pastello": "#efe3a0",
    "giallo grano": "#d9a75a", "wheat": "#d9a75a", "giallo": "#e8c64a",
    "rosa antico": "#c99a95", "rosa": "#e4b3b8", "bordeaux": "#6d1f2a", "rosso": "#b2302f",
    "terracotta": "#b5603f", "nero": "#1c1c1e",
}
_NOMI = sorted(NOMI_HEX, key=len, reverse=True)


def hex_da_nome(colore):
    """Primo nome colore che compare nell'etichetta (a parità di posizione il più lungo)."""
    s = colore.lower()
    hits = [(s.find(n), -len(n), n) for n in _NOMI if n in s]
    return NOMI_HEX[min(hits)[2]] if hits else None


def _valore(v):
    v = re.sub(r"\s+#\s.*$", "", v).strip()  # commento YAML (gli hex non hanno spazio dopo #)
    if v.startswith("[") and v.endswith("]"):
        return [x.strip().strip("\"'") for x in v[1:-1].split(",") if x.strip()]
    return v.strip("\"'")


def leggi_capo(testo):
    """Frontmatter piatto (chiave: valore | [lista]) + note libere."""
    m = re.match(r"---\n(.*?)\n---\n?(.*)", testo, re.S)
    if not m:
        return None
    capo = {}
    for riga in m.group(1).splitlines():
        if ":" in riga and not riga.startswith((" ", "#")):
            k, v = riga.split(":", 1)
            capo[k.strip()] = _valore(v)
    capo["note"] = m.group(2).strip()
    if "tutte" in capo.get("stagione", []):
        capo["stagione"] = ["primavera", "estate", "autunno", "inverno"]
    capo["hex_stimato"] = not capo.get("hex")
    if capo["hex_stimato"]:
        capo["hex"] = hex_da_nome(capo.get("colore", "")) or "#9a9690"
    return capo


def carica(root=DATI):
    capi = [c for f in sorted((root / "capi").glob("*.md")) if (c := leggi_capo(f.read_text()))]
    # una foto condivisa da più capi è un collage, non il ritratto del capo
    uso = {}
    for c in capi:
        if c.get("foto"):
            uso[c["foto"]] = uso.get(c["foto"], 0) + 1
    for c in capi:
        c["foto_collage"] = bool(c.get("foto")) and uso[c["foto"]] > 1
        # versione da vetrina (strumenti/foto_web.py), se c'è
        if c.get("foto") and (root / "foto" / "web" / Path(c["foto"]).name).exists():
            c["foto_web"] = f"foto/web/{Path(c['foto']).name}"
    outfit_md = root / "outfit.md"
    outfit = [re.findall(r"\d{3}", r) for r in outfit_md.read_text().splitlines()
              if r.startswith("- [")] if outfit_md.exists() else []
    profilo_md = root / "profilo.md"
    profilo = leggi_capo(profilo_md.read_text()) if profilo_md.exists() else None
    return {"capi": capi, "outfit": outfit, "profilo": {"pelle": (profilo or {}).get("pelle")}}


STATI = ("attivo", "dismesso")


def imposta_stato(id_capo, stato, root=DATI):
    """Riscrive solo la riga `stato:` del frontmatter del capo con quell'id. Ritorna False se non c'è."""
    if stato not in STATI:
        raise ValueError(stato)
    for f in (root / "capi").glob("*.md"):
        testo = f.read_text()
        capo = leggi_capo(testo)
        if not capo or capo.get("id") != id_capo:
            continue
        fm_fine = testo.index("\n---", 3)
        fm = testo[:fm_fine]
        if re.search(r"^stato:.*$", fm, re.M):
            fm = re.sub(r"^stato:.*$", f"stato: {stato}", fm, count=1, flags=re.M)
        else:
            fm += f"\nstato: {stato}"
        f.write_text(fm + testo[fm_fine:])
        return True
    return False


class Handler(SimpleHTTPRequestHandler):
    root = DATI  # i test lo puntano su una cartella temporanea

    ultima = time.monotonic()  # ultima risposta servita, per lo spegnimento automatico

    def end_headers(self):
        Handler.ultima = time.monotonic()
        # foto e codice cambiano spesso: il browser rivalida sempre (304 se il file non è cambiato)
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_GET(self):
        if self.path.split("?")[0] == "/api/capi":
            body = json.dumps(carica(self.root), ensure_ascii=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)
            return
        percorso = posixpath.normpath(unquote(self.path.split("?")[0]))
        if percorso == "/":
            self.path = "/sito/index.html"
        elif percorso.startswith("/foto/"):
            self.path = "/dati" + percorso  # le foto stanno nei dati, l'URL resta /foto/...
        elif not percorso.startswith("/sito/"):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        """POST /api/capi/<id>/stato {"stato": "attivo"|"dismesso"}"""
        m = re.fullmatch(r"/api/capi/(\w+)/stato", self.path)
        if not m:
            return self.send_error(404)
        # solo dalla pagina stessa: JSON (un altro sito non può mandarlo senza preflight) e stessa origine
        origine = self.headers.get("Origin")
        if not self.headers.get("Content-Type", "").startswith("application/json") or (
                origine and origine != f"http://{self.headers.get('Host')}"):
            return self.send_error(403)
        try:
            stato = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))))["stato"]
            trovato = imposta_stato(m.group(1), stato, self.root)
        except (ValueError, KeyError, TypeError):
            return self.send_error(400)
        if not trovato:
            return self.send_error(404)
        self.send_response(204)
        self.end_headers()


def spegni_se_inattivo(srv, secondi, ogni=30):
    """Thread di guardia: spegne il server quando non risponde a richieste da `secondi`."""
    def guardia():
        while time.monotonic() - Handler.ultima < secondi:
            time.sleep(ogni)
        srv.shutdown()
    t = threading.Thread(target=guardia, daemon=True)
    t.start()
    return t


if __name__ == "__main__":
    porta = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    import foto_web  # versioni web mancanti o più vecchie dell'originale
    foto_web.main([])
    srv = ThreadingHTTPServer(("127.0.0.1", porta), partial(Handler, directory=str(ROOT)))
    print(f"closetune su http://127.0.0.1:{porta}, si spegne dopo {INATTIVO_MIN} minuti senza richieste")
    Handler.ultima = time.monotonic()
    spegni_se_inattivo(srv, INATTIVO_MIN * 60)
    srv.serve_forever()
