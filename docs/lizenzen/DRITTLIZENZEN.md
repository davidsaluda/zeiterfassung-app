# Fremde Bausteine und Lizenzen

Der eigene Code der Zeiterfassung: © 2026 David Saluda, alle Rechte vorbehalten. Für ihn gibt es keine Lizenz.

Die Fassungen bringen fremde Bausteine mit. Sie stehen unten mit Version, Lizenz und Quelle.
Die Lizenztexte liegen als Dateien neben dieser Übersicht (Ordner `lizenzen`). Sie sind aus den installierten Paketen oder von den Seiten der Hersteller kopiert (siehe unten), unverändert bis auf `Python-Anerkennungen.txt` (aus HTML in Text umgewandelt).
Die Spalte „Text“ nennt die Datei. Alle Texte liegen bei, nichts ist mehr offen.

Fassungen: **W** = Windows-App, **A** = Android-App (APK), **P** = Web-App ohne Server (GitHub Pages, auch unter `/mobil/` des Servers).
Das NAS-Zip und der Server enthalten nur den eigenen Code und diese Übersicht. Python bringt dort das Docker-Abbild `python:3.15-slim` mit; es lädt die Person selbst und es ist nicht Teil des Zips.

## Windows-App

| Teil | Version | Lizenz | Fassung | Quelle | Text |
|------|---------|--------|---------|--------|------|
| Python | 3.15.2 | PSF-2.0 (dazu Teile unter eigenen Lizenzen) | W | python.org, Windows-Installer | `Python-LICENSE.txt`, `Python-Anerkennungen.txt` |
| OpenSSL (libcrypto-3, libssl-3) | 3.5.9 | Apache-2.0 | W | mit Python für Windows | `Apache-2.0.txt` |
| SQLite (sqlite3.dll) | 3.53.4 | gemeinfrei | W | mit Python für Windows | – |
| libffi (libffi-8.dll) | 8 (Dateiname) | MIT | W | mit Python für Windows | `Python-LICENSE.txt` |
| Microsoft-Laufzeit (VCRUNTIME140.dll) | – | Microsoft Distributable Code | W | mit Python für Windows | Bedingungen in `Python-LICENSE.txt` („Additional Conditions for this Windows binary build“) |
| PyInstaller-Bootloader | 6.22.3 | GPL-2.0-or-later mit Bootloader-Ausnahme | W | pyinstaller.org | `PyInstaller-COPYING.txt` |
| pywebview | 6.2.1 | BSD-3-Clause | W | github.com/r0x0r/pywebview | `pywebview-LICENSE.txt` |
| domJSON (in pywebview, `webview/js/lib/dom_json.js`) | 0.1.2 | MIT | W | in pywebview | `domJSON-LICENSE.txt` |
| Microsoft WebView2 SDK (Microsoft.Web.WebView2.Core/WinForms.dll, WebView2Loader.dll; in pywebview) | 1.0.3856.49 | Lizenz von Microsoft (BSD-artig) | W | in pywebview | `WebView2-LICENSE.txt` |
| bottle | 0.13.4 | MIT | W | bottlepy.org | `bottle-LICENSE.txt` |
| proxy_tools | 0.1.0 | BSD-3-Clause (Text der Quelle; die Paket-Metadaten nannten MIT) | W | github.com/jtushman/proxy_tools | `proxy_tools-LICENSE.txt` |
| typing_extensions | 4.16.0 | PSF-2.0 | W | github.com/python/typing_extensions | `typing_extensions-LICENSE.txt` |
| cffi | 2.1.1 | MIT-0 (laut Paket-Metadaten) | W | github.com/python-cffi/cffi | `cffi-LICENSE.txt` |
| pycparser | 3.12 | BSD-3-Clause | W | github.com/eliben/pycparser | `pycparser-LICENSE.txt` |
| pythonnet (Python.Runtime.dll) | 3.2.1 | MIT | W | github.com/pythonnet/pythonnet | `pythonnet-LICENSE.txt` |
| clr_loader (ClrLoader.dll) | 0.3.1 | MIT | W | github.com/pythonnet/clr-loader | `clr_loader-LICENSE.txt` |

## Android-App

| Teil | Version | Lizenz | Fassung | Quelle | Text |
|------|---------|--------|---------|--------|------|
| Chaquopy | 17.2.0 | MIT | A | github.com/chaquo/chaquopy | `Chaquopy-LICENSE.txt` |
| Python (Chaquopy) | 3.15.0 | PSF-2.0 (dazu Teile unter eigenen Lizenzen) | A | Chaquopy (`com.chaquo.python:target:3.15.0-0`) | `Python-LICENSE.txt`, `Python-Anerkennungen.txt` |
| OpenSSL (libcrypto, libssl) | 3.5.9 | Apache-2.0 | A | mit Python von Chaquopy | `Apache-2.0.txt` |
| SQLite | 3.53.4 | gemeinfrei | A | mit Python von Chaquopy | – |
| bzip2, libffi, zlib, expat, Zstandard | – | eigene Lizenzen | A | mit Python von Chaquopy | `Python-LICENSE.txt`, `Python-Anerkennungen.txt` |
| xz (liblzma, Modul `_lzma`) | – | 0BSD, ältere Fassungen gemeinfrei | A | mit Python von Chaquopy | `xz-COPYING.txt` |
| CA-Zertifikate (`cacert.pem`) | – | MPL-2.0 | A | mit Chaquopy (Quelle: certifi, Mozilla) | `certifi-LICENSE.txt`, `MPL-2.0.txt` |
| setuptools (Teil `pkg_resources`, in Chaquopy) | 68.2.2 | MIT | A | in Chaquopy | `setuptools-LICENSE.txt` |
| pyelftools (in Chaquopy) | 0.26 | gemeinfrei | A | in Chaquopy | `pyelftools-LICENSE.txt` |
| construct (in pyelftools) | – | MIT | A | in pyelftools | `construct-LICENSE.txt` |
| ZXing core `com.google.zxing:core` | 3.5.3 | Apache-2.0 | A | github.com/zxing/zxing | `Apache-2.0.txt` |
| Kotlin-Standardbibliothek `org.jetbrains.kotlin:kotlin-stdlib` | 2.2.10 | Apache-2.0 | A | kotlinlang.org | `Apache-2.0.txt` |
| JetBrains Annotations `org.jetbrains:annotations` | 13.0 | Apache-2.0 | A | github.com/JetBrains/java-annotations | `Apache-2.0.txt` |

Keines der Java-Pakete (ZXing, Kotlin, Annotations, Chaquopy) enthält eine NOTICE-Datei.

## Web-App ohne Server

| Teil | Version | Lizenz | Fassung | Quelle | Text |
|------|---------|--------|---------|--------|------|
| Pyodide | 314.0.8 | MPL-2.0 | P | github.com/pyodide/pyodide (Quelltext dort) | `MPL-2.0.txt` |
| Python (Pyodide) | 3.14.2 | PSF-2.0 (dazu Teile unter eigenen Lizenzen) | P | in Pyodide | `Python-LICENSE.txt`, `Python-Anerkennungen.txt` |
| Emscripten-Laufzeit (in `pyodide.asm.mjs`) | – | MIT und NCSA | P | in Pyodide | `Emscripten-LICENSE.txt` |
| SQLite (im Kern von Pyodide) | 3.39.0 | SQLite gemeinfrei | P | in Pyodide | – |
| Pyodide-Paket `pycryptodome` (AES-GCM und PBKDF2, ohne OpenSSL) | 3.23.0 | BSD-2-Clause und gemeinfrei (Unlicense) | P | Pyodide-Pakete (pycryptodome.org) | `pycryptodome-LICENSE.txt` |

## Herkunft der Texte

- `Python-LICENSE.txt`: Datei LICENSE.txt der Python-Installation 3.15.2 für Windows (enthält PSF-2.0, bzip2, libffi, Zstandard, Apache-2.0, Tcl/Tk und die Bedingungen für die Microsoft-Laufzeit).
- `Python-Anerkennungen.txt`: Abschnitt „Licenses and Acknowledgements for Incorporated Software“ aus `Doc/html/license.html` derselben Installation, von HTML in Text umgewandelt, mit zwei Kopfzeilen zur Herkunft (OpenSSL, expat, libffi, zlib, libmpdec, mimalloc und weitere).
- `Apache-2.0.txt`: Lizenztext von OpenSSL 3, entnommen aus Git für Windows (`usr/share/licenses/libopenssl/LICENSE.txt`); das ist die Apache License 2.0.
- `MPL-2.0.txt`: Mozilla Public License 2.0, aus einem installierten Python-Paket (pikepdf), wortgleich.
- Von den Seiten der Hersteller geladen am 22.11.2026 (jeweils die Lizenzdatei, unverändert):
  `pycryptodome-LICENSE.txt` aus dem Paket `pycryptodome-3.23.0-cp37-abi3-pyemscripten_2026_0_wasm32.whl` (Pyodide 314.0.8), Datei `pycryptodome-3.23.0.dist-info/licenses/LICENSE.rst`, unverändert;
  `Chaquopy-LICENSE.txt` aus github.com/chaquo/chaquopy, Zweig `master`, Datei LICENSE.txt;
  `proxy_tools-LICENSE.txt` aus github.com/jtushman/proxy_tools, Datei LICENSE.txt;
  `domJSON-LICENSE.txt` aus github.com/azaslavsky/domJSON, Datei `LICENSE.md` (der Kopf der Datei in pywebview nennt den Urheber und MIT);
  `WebView2-LICENSE.txt` aus dem NuGet-Paket `Microsoft.Web.WebView2` 1.0.3856.49 (api.nuget.org), Datei LICENSE.txt; das Paket bringt dazu NOTICE.txt mit Hinweisen auf Fremdcode seiner Werkzeuge, die die App nicht ausliefert;
  `Emscripten-LICENSE.txt` aus github.com/emscripten-core/emscripten, Zweig `main`, Datei `LICENSE`;
  `xz-COPYING.txt` aus github.com/tukaani-project/xz, Zweig `master`, Datei `COPYING` (aktuelle Fassung; für `liblzma` gilt 0BSD, früher gemeinfrei);
  `certifi-LICENSE.txt` aus github.com/certifi/python-certifi, Datei `LICENSE` (Chaquopy hat seine `cacert.pem` aus certifi, Commit „Update to certifi“ in `product/gradle-plugin/src/main/resources/com/chaquo/python/`);
  `construct-LICENSE.txt` aus github.com/construct/construct, Datei `LICENSE`.
- Die Chaquopy-Datei nennt MIT ohne eigene Überschrift; die Lizenz von proxy_tools weicht von den Metadaten des Pakets ab (dort MIT, im Text BSD): maßgeblich ist der Text.
- `PyInstaller-COPYING.txt`, `pywebview-LICENSE.txt`, `bottle-LICENSE.txt`, `typing_extensions-LICENSE.txt`, `cffi-LICENSE.txt`, `pycparser-LICENSE.txt`, `pythonnet-LICENSE.txt`, `clr_loader-LICENSE.txt`: aus den installierten Paketen (`*.dist-info/licenses`).
- `setuptools-LICENSE.txt`, `pyelftools-LICENSE.txt`: aus `bootstrap-17.2.0-3.15.imy` von Chaquopy.
