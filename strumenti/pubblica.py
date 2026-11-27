"""Pubblica il sito su GitHub Pages (ramo gh-pages) come versione statica in sola lettura.
Uso: .venv/bin/python strumenti/pubblica.py   ->  https://<utente>.github.io/closetune/
I dati (capi, foto, outfit) diventano pubblici: è voluto, il sito si mostra agli amici.
"""
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

import server

ROOT = server.ROOT


def costruisci(out, root=server.DATI, sito=ROOT / "sito"):
    """Scrive in `out` index.html, sito/, foto/ e api/capi (JSON statico)."""
    out = Path(out)
    shutil.copytree(sito, out / "sito", ignore=shutil.ignore_patterns("*.test.*", "brand.html"))
    shutil.copy(sito / "index.html", out / "index.html")
    dati = server.carica(root)
    dati["statico"] = True  # niente server: il sito nasconde i pulsanti che scrivono
    usate = {p for c in dati["capi"] for p in (c.get("foto_web"), c.get("foto")) if p}
    for p in usate:
        if (root / p).exists():
            (out / p).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy(root / p, out / p)
    (out / "api").mkdir()
    (out / "api" / "capi").write_text(json.dumps(dati, ensure_ascii=False))
    (out / ".nojekyll").touch()  # Pages serve i file così come sono
    return out


def main():
    remoto = subprocess.check_output(["git", "remote", "get-url", "origin"], cwd=ROOT, text=True).strip()
    with tempfile.TemporaryDirectory() as tmp:
        costruisci(tmp)
        git = lambda *a: subprocess.run(["git", *a], cwd=tmp, check=True)
        git("init", "-q", "-b", "gh-pages")
        git("add", "-A")
        git("commit", "-q", "-m", "pubblica sito")
        git("push", "-qf", remoto, "gh-pages")
    print("pubblicato sul ramo gh-pages")


if __name__ == "__main__":
    sys.exit(main())
