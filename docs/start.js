"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Start der eigenständigen Web-App: Dienst-Skript (sw.js) anmelden, Rechenkern (kern.js) starten, dann die gewohnte Oberfläche (die Skripte aus index.html) laden.
// Die Oberfläche fragt wie immer „api/…“. Das Dienst-Skript fängt diese Anfragen ab und gibt sie hierher; von hier gehen sie an den Rechenkern.
// Nichts davon verlässt das Gerät.
(() => {
  const VERSION = new URL(document.currentScript.src).searchParams.get("v") || "";
  const SKRIPTE = (document.body.dataset.skripte || "").split(" ").filter(Boolean);   // Skripte der Oberfläche in Ladereihenfolge (web_bauen.startseite)
  const LADEFEHLER = "Die Oberfläche lässt sich nicht laden.";
  const ERSTER_START = "Die App wird einmalig auf dieses Gerät geladen. Danach startet sie auch ohne Internet.";
  const NICHT_ANGEMELDET = "Deine Anmeldung ist abgelaufen. Tippe auf „Anmelden“ und melde dich neu an. Deine Einträge bleiben auf diesem Gerät.";
  const NICHT_BEREIT = "Die App ist nicht bereit. Bitte die Seite neu laden.";
  const PERSON_MUSTER = /^[0-9a-z-]{1,40}$/;                 // IDs des Anmeldedienstes; dasselbe Muster prüft kern.js
  const MERKER_ANMELDUNG = "ho_mit_anmeldung";
  const MERKER_ALT = "ho_person";                            // merkt sich die Oberfläche (grundlage.js) schon länger: Geräte von vor dem Update haben nur diesen
  const WEITER = "weiter";                                   // Bitte an ein wartendes Dienst-Skript, zu übernehmen (sw.js)
  const UEBERNAHME_MS = 8000;
  const tafel = document.createElement("div");
  tafel.id = "start";
  tafel.setAttribute("role", "status");
  tafel.innerHTML = '<img src="icon.svg" alt="" width="84" height="84"><b>Zeiterfassung</b><p id="start-text">wird gestartet …</p><div id="start-knopf"></div>';
  document.body.appendChild(tafel);
  // Setzt den Text auf der Starttafel.
  const text = t => { tafel.querySelector("#start-text").textContent = t; };
  // Zeigt einen Fehler auf der Starttafel mit einem Knopf (ohne Angabe „Neu laden“, sonst Beschriftung und Aktion); knopf === false lässt ihn weg.
  function halt(meldung, knopf = "Neu laden", aktion = () => location.reload()) {
    tafel.classList.add("fehler");
    text(meldung);
    if (knopf === false) return;
    const b = document.createElement("button");
    b.textContent = knopf;
    b.onclick = aktion;
    tafel.querySelector("#start-knopf").replaceChildren(b);
  }

  let kern, nr = 0;
  const offen = new Map();
  // Schickt eine Nachricht an den Rechenkern und liefert dessen Antwort mit gleicher Nummer.
  function anKern(nachricht, weitergeben) {
    return new Promise(ok => { const n = ++nr; offen.set(n, ok); kern.postMessage({ nr: n, ...nachricht }, weitergeben || []); });
  }
  // Startet den Rechenkern als Arbeitsfaden (kern.js) mit dem Datenordner der Person ("" ohne Anmeldedienst);
  // fertig, sobald er „bereit“ meldet, Fehler bei „fehler“.
  function kernStarten(person) {
    return new Promise((ok, fehler) => {
      kern = new Worker("kern.js?v=" + VERSION + (person ? "&p=" + person : ""), { type: "module" });
      kern.onerror = e => fehler(new Error(e.message || "Der Rechenkern lässt sich nicht laden."));
      kern.onmessage = ev => {
        const d = ev.data;
        if (d.art === "bereit") return ok(d.ms);
        if (d.art === "fehler") return fehler(new Error(d.text));
        const fertig = offen.get(d.nr);
        offen.delete(d.nr);
        if (fertig) fertig(d);
      };
    });
  }
  // Anfragen der Oberfläche kommen vom Dienst-Skript: beantworten, sobald der Rechenkern läuft.
  // Hat sich inzwischen in einem anderen Tab eine andere Person angemeldet (oder abgemeldet), nichts mehr beantworten und neu starten:
  // Sonst tauschte der Sync dieses Fensters mit der Sitzung der anderen Person und ihre Dateien landeten im falschen Datenordner.
  function anfragenAnnehmen(bereit, person) {
    navigator.serviceWorker.addEventListener("message", async ev => {
      const d = ev.data, zurueck = ev.ports[0];
      if (!d || d.art !== "anfrage" || !zurueck) return;
      try {
        await bereit;
        if (personFeststellen() !== person) { zurueck.postMessage({ fehler: NICHT_BEREIT }); location.reload(); return; }
        const a = await anKern({ methode: d.methode, pfad: d.pfad, typ: d.typ, cookie: kekse(), koerper: d.koerper }, d.koerper ? [d.koerper] : []);
        zurueck.postMessage(a, a.koerper ? [a.koerper] : []);
      } catch (e) { zurueck.postMessage({ fehler: NICHT_BEREIT }); }
    });
    navigator.serviceWorker.startMessages();
  }
  // In einem Unterordner (…/mobil/ auf dem eigenen Server) teilt sich die App Cookies und Speicher mit der Seite darüber: Sie benutzt eigene Namen
  // („m_“ vor jedem Cookie, der Ort vor jedem Speicher-Schlüssel, siehe EIGEN und KEKS der Oberfläche) und reicht dem Rechenkern nur ihre eigenen Cookies.
  const ORT = location.pathname.replace(/[^/]*$/, ""), EIGEN = ORT === "/" ? "" : ORT;
  // Liefert die Cookies, die der Rechenkern bekommt (in einem Unterordner nur die eigenen mit „m_“).
  const kekse = () => ORT === "/" ? document.cookie : document.cookie.split(";").map(c => c.trim()).filter(c => c.startsWith("m_")).map(c => c.slice(2)).join("; ");
  // Hinter dem Anmeldedienst teilen sich alle, die sich in diesem Browser anmelden, diese Adresse und damit den Speicher.
  // Deshalb bekommt jede Person ihren eigenen Datenordner, benannt nach ihrer ID (Cookie ho_person des Anmeldedienstes, kein Geheimnis).
  // Läuft die Anmeldung ab, fehlt das Cookie: Dann startet die App nicht, statt in den gemeinsamen Ordner auszuweichen (erkannt an einem der Merker).
  // Liefert die ID, "" ohne Anmeldedienst, null, wenn die App hier nicht starten darf.
  function personFeststellen() {
    const person = (document.cookie.match(/(?:^|; )ho_person=([^;]*)/) || [])[1] || "";
    const merker = EIGEN + MERKER_ANMELDUNG;
    try {
      if (person) localStorage.setItem(merker, "1");
      else if (localStorage.getItem(merker) === "1" || localStorage.getItem(EIGEN + MERKER_ALT)) return null;
    } catch (e) {}
    return !person || PERSON_MUSTER.test(person) ? person : null;
  }
  // Steuert das eigene Dienst-Skript (sw.js in diesem Ordner) die Seite? Unter …/mobil/ des Servers steuert beim ersten Besuch
  // das Dienst-Skript der Server-Oberfläche (Bereich /): Das ist kein Folgestart.
  const eigenerDienst = () => (navigator.serviceWorker.controller?.scriptURL || "").startsWith(new URL("sw.js", location.href).href);
  // Meldet das Dienst-Skript (sw.js) an und wartet, bis es diese Seite steuert; meldet statt endlos zu warten, wenn das erste Einrichten scheitert.
  async function dienstAnmelden() {
    const hatte = eigenerDienst();
    if (!hatte) text(ERSTER_START);
    const neu = !hatte && (await navigator.serviceWorker.register("sw.js")).installing;
    if (hatte) updateBeobachten(await navigator.serviceWorker.register("sw.js"));
    // Scheitert das erste Einrichten (Netz weg, Datei beschädigt), verwirft der Browser das Dienst-Skript, und „ready“ käme nie: melden statt endlos warten.
    await Promise.race([navigator.serviceWorker.ready, new Promise((_, fehler) => neu && neu.addEventListener("statechange", () => neu.state === "redundant" &&
      fehler(new Error("Die App wurde nicht vollständig geladen. Bitte die Verbindung prüfen und neu laden."))))]);
    if (!eigenerDienst()) {                                  // erster Besuch: warten, bis das eigene Dienst-Skript diese Seite übernimmt
      await new Promise(ok => { navigator.serviceWorker.addEventListener("controllerchange", ok, { once: true }); setTimeout(ok, 8000); });
      if (!eigenerDienst()) { location.reload(); await new Promise(() => {}); }
    }
  }
  // Zeigt unten eine Leiste mit Meldung und Knopf, der die Seite neu lädt (nur eine Leiste zugleich).
  function leisteZeigen(meldung, knopf) {
    if (document.getElementById("neu-leiste")) return;
    const leiste = document.createElement("div");
    leiste.id = "neu-leiste";
    leiste.setAttribute("role", "status");
    const t = document.createElement("span");
    t.textContent = meldung;
    const b = document.createElement("button");
    b.textContent = knopf;
    b.onclick = () => location.reload();
    leiste.append(t, b);
    document.body.appendChild(leiste);
  }
  // Beim Start läuft noch nichts (kein Rechenkern, keine Eingabe): Wartet ein neues Dienst-Skript (geladen, während die App offen war),
  // übernimmt es jetzt. Rückgabe true, wenn es übernommen hat (dann neu laden); ohne Wechsel binnen UEBERNAHME_MS false, damit die Seite nie endlos neu lädt.
  async function wartendeUebernehmen() {
    const wartend = eigenerDienst() && (await navigator.serviceWorker.getRegistration())?.waiting;
    if (!wartend) return false;
    const uebernommen = new Promise(ok => { navigator.serviceWorker.addEventListener("controllerchange", () => ok(true), { once: true }); setTimeout(() => ok(false), UEBERNAHME_MS); });
    wartend.postMessage(WEITER);
    return uebernommen;
  }
  // Scheitert ein Update (Datei fehlt, Summe passt nicht, Virenschutz ändert eine Datei), liefe still die alte Fassung weiter, ohne ihre Korrekturen
  function updateBeobachten(reg) {
    const beobachten = w => w && w.addEventListener("statechange", () => {
      if (w.state === "redundant" && !reg.installing && !reg.waiting) leisteZeigen("Das Update der App ließ sich nicht laden. Es läuft weiter die bisherige Version.", "Erneut versuchen");
    });
    beobachten(reg.installing);
    reg.addEventListener("updatefound", () => beobachten(reg.installing));
  }
  // Der Browser darf den Speicher einer Seite leeren. Die Bitte um dauerhaften Speicher senkt das Risiko; die Antwort zeigt die Seite „Export & Sicherung“.
  async function speicherFest() {
    let fest = false;
    try { fest = !!(navigator.storage && navigator.storage.persist && await navigator.storage.persist()); } catch (e) {}
    try { localStorage.setItem(EIGEN + "ho_speicher_fest", fest ? "1" : "0"); } catch (e) {}
  }

  // Ablauf beim Start: Prüfungen (nicht eingebettet, sicherer Kontext, Browser-Fähigkeiten, nur ein Fenster),
  // dann Dienst-Skript, Rechenkern und Oberfläche laden; mit ?selbsttest nur den Selbsttest ausführen.
  async function los() {
    if (window.top !== window.self) return halt("Die App läuft nicht eingebettet in einer anderen Seite.", false);   // die Richtlinie der Seite kann das Einbetten nicht verbieten (Meta-Angabe)
    if (!window.isSecureContext)                             // über http mit IP und Port: Der Browser gibt dann weder Dienst-Skript noch Sperren frei, daran lässt sich nichts ändern
      return halt("Ohne Verbindung arbeitet die App nur über eine https-Adresse, der das Handy vertraut. Bitte die Zeiterfassung des Servers benutzen: diese Adresse ohne „mobil/“ am Ende.", false);
    if (!("serviceWorker" in navigator) || !window.WebAssembly || !window.indexedDB || !navigator.locks)
      return halt("Dieser Browser kann die App nicht ausführen. Bitte einen aktuellen Browser benutzen (am iPhone Safari, nicht im privaten Modus).", false);
    const person = personFeststellen();
    if (person === null) return halt(NICHT_ANGEMELDET, "Anmelden", () => { location.href = new URL("../", location.href).href; });
    // Nur ein Fenster darf mit der Datenbank arbeiten: Zwei Fenster würden sich gegenseitig den Stand überschreiben.
    const frei = await new Promise(ok => navigator.locks.request("zeiterfassung-daten", { ifAvailable: true }, sperre => { ok(!!sperre); return sperre ? new Promise(() => {}) : undefined; }));
    if (!frei) return halt("Die App ist schon in einem anderen Fenster offen. Bitte dort weiterarbeiten oder das andere Fenster schließen.");
    if (await wartendeUebernehmen()) return location.reload();   // erst nach der Sperre: Ein zweites Fenster bekäme sonst mitten in der Arbeit die neue Version
    const t0 = performance.now();
    // Erster Start: erst das Dienst-Skript einrichten (es prüft jede Datei gegen die Summe aus dem Bau), dann den Rechenkern daraus laden.
    // Sonst käme der Rechenkern ungeprüft und ein zweites Mal aus dem Netz.
    const erst = !eigenerDienst();
    if (erst) await dienstAnmelden();
    const bereit = kernStarten(person);
    bereit.catch(() => {});
    anfragenAnnehmen(bereit, person);
    const selbsttest = location.search === "?selbsttest";
    // Lädt die Skripte der Oberfläche in der Reihenfolge der Seite und meldet einen Fehler, wenn eines fehlt oder die Liste leer ist.
    const oberflaecheLaden = () => SKRIPTE.length ? Promise.all(SKRIPTE.map(name => new Promise((ok, fehler) => {
      const s = document.createElement("script");
      s.src = name + "?v=" + VERSION;
      s.async = false;                                       // eingefügte Skripte liefen sonst in der Reihenfolge ihrer Ankunft
      s.onload = ok;
      s.onerror = () => fehler(new Error(LADEFEHLER));       // die Skripte danach führt der Browser trotzdem aus; die Fehlertafel erscheint
      document.body.appendChild(s);
    }))) : Promise.reject(new Error(LADEFEHLER));
    // Die Oberfläche lädt gleichzeitig mit dem Rechenkern; ihre Anfragen warten im Dienst-Skript, bis er bereit ist.
    // Gemessen (22.11.2026, 4× gedrosselt): Folgestart rund 1,4 s schneller, seit der Rechenkern als Bytecode kommt; beim ersten Start rund 0,4 s.
    const frueh = selbsttest ? null : oberflaecheLaden();
    frueh?.catch(() => {});
    if (!erst) await dienstAnmelden();
    const kernMs = await bereit;
    speicherFest();
    window.ZEIT_START = { kern_ms: kernMs, gesamt_ms: Math.round(performance.now() - t0) };
    if (selbsttest) {
      text("Selbsttest läuft …");
      const r = await anKern({ art: "selbsttest" });
      return text(r.text ? `Selbsttest: ${r.text} (Start ${window.ZEIT_START.gesamt_ms} ms, Version ${VERSION})` : r.fehler);
    }
    await (frueh || oberflaecheLaden());
    tafel.remove();
  }
  los().catch(e => { console.error(e); halt("Die App lässt sich gerade nicht starten. Beim ersten Start braucht sie eine Verbindung zum Internet. (" + (e && e.message || e) + ")"); });
})();
