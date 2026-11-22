"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Dienst-Skript der eigenständigen Web-App. Zwei Aufgaben:
// 1. Alle Programmdateien im Gerät behalten, damit die App ohne Internet startet. Geladen wird nur von der eigenen Adresse.
// 2. Anfragen der Oberfläche („api/…“) nicht ins Netz schicken, sondern an die Seite geben; dort rechnet Python im Gerät (start.js, kern.js).
// VERSION und DATEIEN setzt web_bauen.py ein (Datei -> Kurzform ihrer SHA-256-Summe).
const VERSION = "20261122.1619";
const DATEIEN = {
 "app.zip": "3a85a7fce484948b",
 "buendel.css": "6f31de1ba0412fc0",
 "buendel.js": "4459389317c27fad",
 "icon-180.png": "fde9a08b04e87a26",
 "icon-192.png": "96cb413dec9a6aa3",
 "icon-512.png": "bcdaded6225901de",
 "icon-maskable-512.png": "2f537b32a49ba198",
 "icon.svg": "87e078fd4cfa21bb",
 "index.html": "565eb69af0dab912",
 "kern.js": "fa753112b5116c7a",
 "lizenzen/Apache-2.0.txt": "7d5450cb2d142651",
 "lizenzen/Chaquopy-LICENSE.txt": "345a9fdfeed355d3",
 "lizenzen/DRITTLIZENZEN.md": "c22c43abcc0b4951",
 "lizenzen/Emscripten-LICENSE.txt": "620a78084fc7ca97",
 "lizenzen/MPL-2.0.txt": "1f256ecad1928805",
 "lizenzen/PyInstaller-COPYING.txt": "0598064c7d2718e3",
 "lizenzen/Python-Anerkennungen.txt": "4f94a7d409c4e075",
 "lizenzen/Python-LICENSE.txt": "939d8e9fa591cbaf",
 "lizenzen/WebView2-LICENSE.txt": "0af8f1b807512aae",
 "lizenzen/bottle-LICENSE.txt": "af150257b1f7cce9",
 "lizenzen/certifi-LICENSE.txt": "e93716da6b9c0d5a",
 "lizenzen/cffi-LICENSE.txt": "5ba24ddc57067f92",
 "lizenzen/clr_loader-LICENSE.txt": "dd6bdca10cdc3b24",
 "lizenzen/construct-LICENSE.txt": "1552d70acfd0d3fe",
 "lizenzen/domJSON-LICENSE.txt": "bb23d3c05427c6dc",
 "lizenzen/proxy_tools-LICENSE.txt": "a428fb8a2e762af3",
 "lizenzen/pycparser-LICENSE.txt": "0a9e78156ae8b96c",
 "lizenzen/pycryptodome-LICENSE.txt": "4e04660d77c1c64e",
 "lizenzen/pyelftools-LICENSE.txt": "ae18bf4cb82f92af",
 "lizenzen/pythonnet-LICENSE.txt": "e1dc3a6ff017a680",
 "lizenzen/pywebview-LICENSE.txt": "4a988dd3598832cd",
 "lizenzen/setuptools-LICENSE.txt": "86da0f01aeae4634",
 "lizenzen/typing_extensions-LICENSE.txt": "3b2f81fe21d181c4",
 "lizenzen/xz-COPYING.txt": "616a3ad264ce29b8",
 "manifest.webmanifest": "81fecc906261ccdb",
 "pyodide/pycryptodome-3.23.0-cp37-abi3-pyemscripten_2026_0_wasm32.whl": "67b86abb0de02dce",
 "pyodide/pyodide-lock.json": "c000c96d21b52ac5",
 "pyodide/pyodide.asm.mjs": "22514b8be6980e28",
 "pyodide/pyodide.asm.wasm": "e14d49ceca9b4a0e",
 "pyodide/pyodide.mjs": "1bb8cc14f9405aaa",
 "pyodide/python_stdlib.zip": "feeb3bc404b44f4b",
 "start-320x568-2-dunkel.png": "0a68ca6226201d1c",
 "start-320x568-2.png": "594f60ef5a2ab6b4",
 "start-375x667-2-dunkel.png": "a145cc3a9bbb779e",
 "start-375x667-2.png": "45eeffb8ef239466",
 "start-375x812-3-dunkel.png": "dacff926e9e40cce",
 "start-375x812-3.png": "5b068d5a6a553549",
 "start-390x844-3-dunkel.png": "3e5bd6daccc6ab7f",
 "start-390x844-3.png": "2d1f6ea22edad1ac",
 "start-393x852-3-dunkel.png": "9cc7f752bb180f4a",
 "start-393x852-3.png": "cd93f2582bdeb44d",
 "start-402x874-3-dunkel.png": "c0030b69e45692b3",
 "start-402x874-3.png": "29574ae8abeae091",
 "start-414x736-3-dunkel.png": "0783aa632b53ae16",
 "start-414x736-3.png": "09af85e0188989a6",
 "start-414x896-2-dunkel.png": "ade304003730c9db",
 "start-414x896-2.png": "828982819721bf10",
 "start-414x896-3-dunkel.png": "6cf5dca0b51265a7",
 "start-414x896-3.png": "1aa1e5c29edc68cb",
 "start-420x912-3-dunkel.png": "2a491dbaa2fc5ab0",
 "start-420x912-3.png": "b5547b62952350a3",
 "start-428x926-3-dunkel.png": "81d1405dbc436ba7",
 "start-428x926-3.png": "c1c0ed68e082964c",
 "start-430x932-3-dunkel.png": "5e9bf8a4b96c479e",
 "start-430x932-3.png": "14bf4889d83aa434",
 "start-440x956-3-dunkel.png": "dda310521b29f319",
 "start-440x956-3.png": "7939dc87d7303d33",
 "start.css": "381b02a218df6ca7",
 "start.js": "b117e27aa840f9f0"
};
const LAGER = "zeiterfassung-" + VERSION;
const BASIS = new URL("./", self.location.href).pathname;
const NICHT_BEREIT = "Die App ist nicht bereit. Bitte die Seite neu laden.";
const WARTEN_MS = 120000;

// Name, unter dem eine Datei im Lager liegt (Pfad plus Kurzsumme).
const lagerName = datei => BASIS + datei + "?h=" + DATEIEN[datei];

// Nur einlagern, was zur Summe aus dem Bau passt: weder eine beschädigte Übertragung noch ein fremder Eintrag im Lager dieser Adresse wird Teil der App.
// Ausnahme Startseite: Schutzprogramme auf dem Rechner (Virenschutz mit Web-Schutz) schreiben in HTML-Seiten hinein; die App ließe sich dort sonst nie einrichten.
async function passt(datei, antwort) {
  if (datei === "index.html") return (await antwort.clone().text()).includes("start.js?v=" + VERSION);   // keine Summe (siehe oben), aber sie muss zu dieser Version gehören
  const summe = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await antwort.clone().arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");
  return summe.startsWith(DATEIEN[datei]);
}

// Neue Version: nur geänderte Dateien laden, alle anderen aus dem Lager der alten Version übernehmen (der Rechenkern ist rund 9 MB groß).
async function einlagern() {
  const neu = await caches.open(LAGER);
  for (const datei of Object.keys(DATEIEN)) {
    const name = lagerName(datei);
    if (await neu.match(name)) continue;
    // aus dem Lager der alten Version, wenn der Inhalt stimmt. Die Startseite immer frisch: Sie hat keine Summe, ein fremder Eintrag im Lager dieser Adresse wäre sonst nicht zu erkennen.
    let antwort = datei === "index.html" ? null : await caches.match(name);
    let gut = !!antwort && await passt(datei, antwort);
    if (!gut) {
      antwort = await fetch(BASIS + (datei === "index.html" ? "" : datei), { cache: "no-cache" });
      if (!antwort.ok) throw new Error("Datei fehlt: " + datei);
      gut = await passt(datei, antwort);
    }
    if (!gut) throw new Error("Prüfsumme stimmt nicht: " + datei);
    await neu.put(name, antwort);
  }
}

// Installation: Dateien einlagern, dann sofort übernehmen. Scheitert das Einlagern, bleibt die alte Version.
self.addEventListener("install", ev => ev.waitUntil(einlagern().then(() => self.skipWaiting())));
// Aktivierung: alte Lager dieser App löschen und offene Seiten übernehmen.
self.addEventListener("activate", ev => ev.waitUntil((async () => {
  for (const name of await caches.keys()) if (/^zeiterfassung-\d/.test(name) && name !== LAGER) await caches.delete(name);   // nur die eigenen (zeiterfassung-<Version>): Unter derselben Adresse hat die Server-Oberfläche ihr Lager „zeiterfassung-oberflaeche“
  await self.clients.claim();
})()));

// Fehlerantwort als JSON, nicht zwischenspeichern.
const jsonAntwort = (status, text) => new Response(JSON.stringify({ fehler: text }), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

// Fragt das Fenster der App über einen eigenen Kanal und wartet höchstens WARTEN_MS auf die Antwort.
function fragen(fenster, nachricht) {
  return new Promise((ok, fehler) => {
    const kanal = new MessageChannel();
    const zeit = setTimeout(() => fehler(new Error("Zeit")), WARTEN_MS);
    kanal.port1.onmessage = ev => { clearTimeout(zeit); ev.data && !ev.data.fehler ? ok(ev.data) : fehler(new Error("Fehler")); };
    fenster.postMessage(nachricht, [kanal.port2]);
  });
}

// Beantwortet eine „api/…“-Anfrage nicht aus dem Netz, sondern über das offene Fenster, in dem Python rechnet.
// Nur GET, PUT, POST, DELETE; Seitenaufrufe nur lesend. Von der Antwort kommen nur bekannte Kopfzeilen durch, dazu eine strenge Richtlinie (nichts darf laufen).
async function anPython(ev, pfad) {
  const anfrage = ev.request;
  if (!["GET", "PUT", "POST", "DELETE"].includes(anfrage.method)) return jsonAntwort(405, "Nicht erlaubt");
  // Ein Seitenaufruf hat kein eigenes Fenster und kann von einer fremden Seite kommen (Formular): nur lesen, dann reicht der Download
  if (anfrage.mode === "navigate" && anfrage.method !== "GET") return jsonAntwort(405, "Nicht erlaubt");
  const koerper = anfrage.method === "GET" ? null : await anfrage.arrayBuffer();
  const eigenes = ev.clientId ? await self.clients.get(ev.clientId) : null;
  // Ein Download ist eine neue Seite ohne eigenes Fenster: dann antwortet das offene Fenster der App.
  const fenster = eigenes ? [eigenes] : await self.clients.matchAll({ type: "window" });
  if (!fenster.length) return jsonAntwort(503, NICHT_BEREIT);
  const nachricht = { art: "anfrage", methode: anfrage.method, pfad, typ: anfrage.headers.get("Content-Type") || "", koerper };
  try {
    const a = await Promise.any(fenster.map(f => fragen(f, nachricht)));
    const kopf = new Headers();
    for (const [name, wert] of a.kopf) if (["content-type", "content-disposition", "x-version", "cache-control", "x-content-type-options"].includes(name.toLowerCase())) kopf.set(name, wert);
    kopf.set("Content-Security-Policy", "default-src 'none'; sandbox");   // als Seite geöffnet (Download, Kalender) läuft darin nie etwas
    return new Response([204, 304].includes(a.status) ? null : a.koerper, { status: a.status, headers: kopf });
  } catch (e) { return jsonAntwort(503, NICHT_BEREIT); }
}

// Jede Anfrage: „api/…“ geht an Python, bekannte Programmdateien kommen aus dem Lager, alles andere wird nicht angefasst.
self.addEventListener("fetch", ev => {
  const url = new URL(ev.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASIS)) return;
  const datei = url.pathname.slice(BASIS.length);
  if (datei.startsWith("api/") || datei === "health") return ev.respondWith(anPython(ev, "/" + datei + url.search));
  const name = datei || "index.html";
  if (ev.request.method === "GET" && Object.prototype.hasOwnProperty.call(DATEIEN, name))
    ev.respondWith(caches.open(LAGER).then(l => l.match(lagerName(name))).then(a => a || fetch(ev.request)));
});
