"""Build static font instances for the Briefing PDF renderer (Phase 9.3).

The email/PDF template uses Plus Jakarta Sans (display, headlines, body, lede,
pull-quote, byline, colophon) and JetBrains Mono (editorial labels, datelines).
For email those load from the Google Fonts CDN; for the PDF we embed them so the
output is self-contained and deterministic.

This downloads the upstream *variable* fonts (OFL, from github.com/google/fonts)
and uses fonttools to instance them into the exact static weights the template
requests, writing the results to app/services/newsletter/fonts/. Run it once;
the instanced .ttf files and their OFL licenses are committed, so rendering never
needs the network.

    python scripts/build_pdf_fonts.py
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

from fontTools import ttLib
from fontTools.varLib.instancer import instantiateVariableFont

OUT_DIR = Path(__file__).resolve().parents[1] / "app" / "services" / "newsletter" / "fonts"

RAW = "https://github.com/google/fonts/raw/main/ofl"

# (family slug, css family name, variable-font URL, [weights], is_italic)
SOURCES = [
    ("plusjakartasans", "PlusJakartaSans", f"{RAW}/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf",
     [400, 500, 600, 700, 800], False),
    ("plusjakartasans", "PlusJakartaSans-Italic", f"{RAW}/plusjakartasans/PlusJakartaSans-Italic%5Bwght%5D.ttf",
     [400, 500, 600, 700, 800], True),
    ("jetbrainsmono", "JetBrainsMono", f"{RAW}/jetbrainsmono/JetBrainsMono%5Bwght%5D.ttf",
     [400, 500, 600], False),
]

LICENSES = [
    ("plusjakartasans", "PlusJakartaSans-OFL.txt", f"{RAW}/plusjakartasans/OFL.txt"),
    ("jetbrainsmono", "JetBrainsMono-OFL.txt", f"{RAW}/jetbrainsmono/OFL.txt"),
]


def _download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "nlab-font-build"})
    with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 — trusted upstream
        return resp.read()


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    for _slug, family, url, weights, _italic in SOURCES:
        print(f"↓ {family} variable font")
        var_bytes = _download(url)
        tmp = OUT_DIR / f"_src_{family}.ttf"
        tmp.write_bytes(var_bytes)
        for wght in weights:
            font = ttLib.TTFont(str(tmp))
            instantiateVariableFont(font, {"wght": wght}, inplace=True)
            out = OUT_DIR / f"{family}-{wght}.ttf"
            font.save(str(out))
            print(f"   · {out.name}  ({out.stat().st_size // 1024} KB)")
        tmp.unlink()

    for _slug, name, url in LICENSES:
        print(f"↓ {name}")
        (OUT_DIR / name).write_bytes(_download(url))

    print(f"\nDone → {OUT_DIR}")


if __name__ == "__main__":
    main()
