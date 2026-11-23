// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Rechenkern im Browser: Python (Pyodide, WebAssembly) in einem eigenen Arbeitsfaden, damit die Oberfläche nie hängt.
// Alle Dateien kommen von der eigenen Adresse. Die Datenbank liegt im Ordner /daten, den der Browser dauerhaft im Gerät speichert (IndexedDB).
import { loadPyodide } from "./pyodide/pyodide.mjs";

// Die Richtlinie der Seite (CSP) gilt nicht für diesen Arbeitsfaden, GitHub Pages sendet keine eigene: Ziele hier selbst begrenzen.
// Schutz gegen versehentliche Ziele (Pyodide, Python per XHR), keine dichte Sperre gegen eingeschleusten Code (Web-Sockets und dynamische Importe laufen daran vorbei).
const ERLAUBT = [self.location.origin, "https://api.github.com"];
const zielPruefen = ziel => {
  if (!ERLAUBT.includes(new URL(String(ziel instanceof Request ? ziel.url : ziel), self.location.href).origin)) throw new TypeError("Verbindung nicht erlaubt");
};
const holen = self.fetch.bind(self), oeffnen = XMLHttpRequest.prototype.open;
self.fetch = (ziel, ...rest) => { try { zielPruefen(ziel); } catch (e) { return Promise.reject(e); } return holen(ziel, ...rest); };
XMLHttpRequest.prototype.open = function (methode, ziel, ...rest) { zielPruefen(ziel); return oeffnen.call(this, methode, ziel, ...rest); };

// Hinter dem Anmeldedienst teilen sich alle Personen eines Browsers diese Adresse und damit den Speicher: start.js gibt die ID der Person mit (?p=),
// jede Person bekommt ihren eigenen Ordner. Eine ungültige ID darf nie im gemeinsamen Ordner /daten landen.
const PERSON_MUSTER = /^[0-9a-z-]{1,40}$/;
const PERSON = new URL(self.location.href).searchParams.get("p") || "";
if (PERSON && !PERSON_MUSTER.test(PERSON)) throw new Error("Ungültige Person");
const DATEN = PERSON ? "/daten-" + PERSON : "/daten", APP = "/app";
let py, anfrage, schlange = Promise.resolve();

// Gleicht den Ordner /daten mit dem Speicher des Browsers (IndexedDB) ab: true = aus dem Gerät holen, false = ins Gerät schreiben.
const dateisystemSichern = laden => new Promise((ok, fehler) => py.FS.syncfs(laden, e => e ? fehler(e) : ok()));

// Startet den Rechenkern: lädt Pyodide, bindet den Speicher ein, entpackt app.zip und startet Python.
// Liefert die Startzeit in ms. Wird einmal beim Laden des Arbeitsfadens aufgerufen (Selbsttest und Anfragen warten darauf).
async function starten() {
  const t0 = performance.now();
  let t = t0;
  // Merkt die Dauer eines Startschritts in self.ZEIT_PHASEN (ms); das Messwerkzeug (werkzeuge/pruefen/tempo/webapp_messen.mjs) liest sie im Arbeitsfaden.
  const phase = name => { const jetzt = performance.now(); self.ZEIT_PHASEN[name] = Math.round(jetzt - t); t = jetzt; };
  self.ZEIT_PHASEN = {};
  py = await loadPyodide({ indexURL: new URL("./pyodide/", self.location.href).href });
  phase("pyodide");
  await py.loadPackage(["pycryptodome"], { messageCallback: () => {} });   // AES-GCM und PBKDF2: Pyodide 314 bringt kein OpenSSL mit (aes.py)
  phase("paket");
  py.FS.mkdirTree(DATEN);
  py.FS.mount(py.FS.filesystems.IDBFS, {}, DATEN);
  await dateisystemSichern(true);                                    // gespeicherten Stand aus dem Gerät holen
  phase("speicher");
  const paket = await fetch(new URL("./app.zip", self.location.href));   // gleichzeitig laden brachte gemessen nichts (18.11.2026)
  if (!paket.ok) throw new Error("app.zip fehlt");
  py.unpackArchive(await paket.arrayBuffer(), "zip", { extractDir: APP });
  phase("app_zip");
  py.runPython(`import sys; sys.path.insert(0, "${APP}"); import web_start; web_start.starten("${DATEN}")`);
  anfrage = py.runPython(`lambda m, p, t, c, k: web_start.anfrage(m, p, t, c, k.to_bytes())`);
  phase("python");
  await dateisystemSichern(false);                                   // erster Start: Datenbank und Geräte-Kennung festschreiben
  phase("festschreiben");
  return Math.round(performance.now() - t0);
}

// Gibt eine Anfrage der Seite an Python und liefert Status, Kopfzeilen und Inhalt; nach jeder schreibenden Anfrage wird dauerhaft gespeichert.
async function beantworten(d) {
  const ergebnis = anfrage(d.methode, d.pfad, d.typ || "", d.cookie || "", new Uint8Array(d.koerper || 0));
  const [status, kopf, inhalt] = ergebnis.toJs();
  ergebnis.destroy();
  if (d.methode !== "GET") await dateisystemSichern(false);          // erst dauerhaft speichern, dann „gespeichert“ melden
  return { status, kopf, koerper: inhalt.buffer.slice(inhalt.byteOffset, inhalt.byteOffset + inhalt.byteLength) };
}

const bereit = starten().then(ms => self.postMessage({ art: "bereit", ms }), e => { self.postMessage({ art: "fehler", text: String(e && e.message || e) }); throw e; });

// Nimmt Nachrichten der Seite entgegen (Anfrage oder Selbsttest) und arbeitet sie nacheinander ab.
self.onmessage = ev => {
  const d = ev.data;
  // Eine Anfrage nach der anderen: Python rechnet in einem Faden, und das Speichern gehört zur Anfrage davor.
  schlange = schlange.then(async () => {
    try {
      await bereit;
      if (d.art === "selbsttest") { self.postMessage({ nr: d.nr, text: py.runPython("web_start.selbsttest()") }); return; }
      const a = await beantworten(d);
      self.postMessage({ nr: d.nr, ...a }, [a.koerper]);
    } catch (e) {
      console.error("Rechenkern:", e);
      self.postMessage({ nr: d.nr, fehler: "Die App konnte die Anfrage nicht bearbeiten. Bitte die Seite neu laden." });
    }
  });
};
