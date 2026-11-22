"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// ---- grundlage.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
const ARTEN = {"": "–", urlaub: "Erholungsurlaub", angespart: "Angesparter Urlaub", gleittag: "Gleittag", krank: "Krank",
  krank_attest: "Krank mit Attest", krank_dienst: "Krank im Dienst", elternzeit: "Elternzeit", familientag: "Familientag", freizeit: "Freizeitausgleich",
  sonderurlaub_tag: "Sonderurlaub", kind_krank: "Kind krank"};
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const $ = s => document.querySelector(s);
// Maskiert & < > " ' als HTML-Zeichen. Jeder Text aus Daten, Eingaben oder vom Server geht hier durch, bevor er in innerHTML landet:
// So kann kein fremdes HTML oder Skript in die Seite gelangen (Schutz gegen XSS).
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
// Bedienung ohne Inline-Handler (die Seite erlaubt keine eingebetteten Skripte): kl("name", …) schreibt die Aktion als Daten an das Element,
// die zentrale Behandlung am Ende der Datei ruft die gleichnamige Funktion aus AKTIONEN auf.
const kl = (name, ...args) => `data-klick="${name}"` + (args.length ? ` data-arg="${esc(JSON.stringify(args))}"` : "");
const heute = new Date();
let KONFIG = {ho_grenze: 80, gleittage_max: 20, familientage_max: 10, fasching_std: 4, bundesland: "BY", heiligabend_frei: true, silvester_frei: true, wochenstunden: 40, arbeitstage: "Mo,Di,Mi,Do,Fr", pausen: [[360, 30]]};
let jahr = heute.getFullYear(), monat = heute.getMonth() + 1;
// Liegt die Seite in einem Unterordner (die Web-App ohne Server unter …/mobil/ auf dem eigenen Server), teilt sie sich Speicher und Cookies mit der
// Seite darüber. Deshalb bekommt sie eigene Namen: EIGEN vor jedem Speicher-Schlüssel, KEKS vor jedem Cookie (start.js reicht nur diese weiter).
const ORT = location.pathname.replace(/[^/]*$/, ""), EIGEN = ORT === "/" ? "" : ORT, KEKS = EIGEN ? "m_" : "";
const speicher = {
  l(k, v) { try { return localStorage.getItem(EIGEN + k) ?? v; } catch (e) { return v; } },
  s(k, v) { try { localStorage.setItem(EIGEN + k, v); } catch (e) {} }
};

const KEINE_VERBINDUNG = "Keine Verbindung zur App. Deine Eingabe ist nicht gespeichert. Bitte die Verbindung prüfen und es noch einmal versuchen.";
// Version der geladenen Oberfläche (aus der Adresse des ersten Skripts mit ?v=…, alle tragen dieselbe). Meldet der Dienst eine andere, läuft im Tab noch die alte Oberfläche.
const GELADEN = ((document.querySelector('script[src*="?v="]') || {}).src || "").split("v=")[1] || "";
let NEUE_VERSION = false, PLATTFORM = "server", FERN = false, KONFLIKTE = 0, OHNE_NETZ = false;
const MIT_SYNC = ["desktop", "android", "browser", "server"];  // die eigenständige Web-App („browser“) hat keinen Cloud-Ordner: Dort tauscht die Person die Sync-Dateien selbst aus
// Einziger Weg zu den Daten: JSON-Anfrage an „api/…“ mit dem JSON-Kopf, den der Server für Schreibzugriffe verlangt. Bei Fehlern wird ein Error mit der
// deutschen Meldung geworfen (ohne Verbindung mit ohneNetz). Sie merkt eine neue App-Version (Kopf X-Version) und stößt nach jeder Änderung den Sync an.
async function api(methode, pfad, body) {
  let r;
  try { r = await fetch("api" + pfad, {method: methode, headers: {"Content-Type": "application/json"}, body: body ? JSON.stringify(body) : undefined}); }
  catch (x) { const e = new Error(KEINE_VERBINDUNG); e.ohneNetz = true; throw e; }   // der Browser meldet hier nur englische Technik („Failed to fetch“)
  const person = r.headers.get("X-Zeiterfassung-Person");          // nur hinter dem Anmeldedienst (Anmeldung auf der NAS)
  if (person) abmeldenKnopf(person);
  if (person) ADMIN = r.headers.get("X-Zeiterfassung-Admin") === "1";   // nur Anzeige: jede Admin-Aktion prüft der Anmeldedienst selbst
  const benutzer = r.headers.get("X-Zeiterfassung-Benutzer");      // Anmeldename beim Anmeldedienst (in der Karte „Person“ änderbar)
  if (benutzer && !BENUTZER) { try { BENUTZER = decodeURIComponent(benutzer); } catch (e) { BENUTZER = benutzer; } }
  const version = r.headers.get("X-Version");
  if (version && GELADEN && version !== GELADEN && !NEUE_VERSION) { NEUE_VERSION = true; toast("Es gibt eine neue Version der App. Bitte neu laden."); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.fehler || ("Fehler " + r.status)); e.status = r.status; throw e; }   // Status für Rückfragen (409 beim Koppeln)
  if (methode !== "GET" && !pfad.startsWith("/abgleich")) syncBald();
  return d;
}
const COOKIE_SICHER = location.protocol === "https:" ? "; Secure" : "";
const NAMEN = {start: "Übersicht", tag: "Tag", monat: "Monat", woche: "Woche", horest: "HO-Spielraum", jahr: "Jahresübersicht", urlaub: "Urlaub & Gleittage", krank: "Krankmeldungen", steuer: "Homeoffice-Übersicht", export: "Export & Auswertung", sicherung: "Sicherung", sync: "Synchronisieren", einstellungen: "Einstellungen", hilfe: "Hilfe"};
const HANDY_NAV = ["start", "zeit", "+", "homeoffice", "abwesenheit"];   // Bereiche der Tableiste (Entscheidung 19.11.2026); die übrigen stehen hinter „Menü“
// ---- Export-Blatt: Monat, Homeoffice-Übersicht, Kalender und alle Tage in mehreren Formaten
// Teilen: Auf iPhone, iPad, Android und in aktuellen Desktop-Browsern öffnet die Web-Share-API das Teilen-Menü des Geräts.
// Ist "Teilen" an (oder gibt es keinen Download), wird die Datei geladen und geteilt statt gespeichert; sonst normaler Download.
const TEILEN_MIME = {pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", json: "application/json",
  xml: "application/xml", md: "text/markdown", txt: "text/plain", ics: "text/calendar", db: "application/octet-stream", zsich: "application/octet-stream"};
// „In Kalender übernehmen“: dieselbe .ics zum Anzeigen. Der Link läuft am Teilen-Menü vorbei (endet nicht auf .ics), das Gerät bietet sie seinem Kalender an.
const ANSEHEN = "?ansehen=1";
// Prüft, ob der Browser Dateien über das Teilen-Menü des Geräts weitergeben kann (Web-Share).
function teilenMoeglich() {
  try { return !!(navigator.share && navigator.canShare && navigator.canShare({files: [new File(["x"], "x.txt", {type: "text/plain"})]})); } catch (e) { return false; }
}
// Erkennt iPhone, iPad und Android (ein iPad meldet sich als Macintosh mit Touch).
const amHandy = () => /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
// Am Handy als App vom Home-Bildschirm gestartet (ohne Browserleiste): eine geöffnete Datei hätte dort kein „Zurück“, deshalb gilt immer das Teilen-Menü.
// Am Rechner (Desktop-App im Edge-Fenster, installierte Web-App) gibt es Downloads, dort bleibt der Schalter frei.
function alsApp() { try { return amHandy() && (navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches); } catch (e) { return false; } }
// Ob statt eines Downloads geteilt wird: immer in der App vom Home-Bildschirm, sonst nach dem Schalter „Teilen“.
function teilenAn() { try { return alsApp() || localStorage.getItem(EIGEN + "ho_teilen") === "1"; } catch (e) { return false; } }
// Lädt die Datei von der Adresse und gibt sie an das Teilen-Menü des Geräts weiter.
async function dateiTeilen(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).fehler || "Fehler " + r.status);
  const ext = url.split("?")[0].split(".").pop().toLowerCase();
  const m = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || "");
  const name = m ? m[1] : "Zeiterfassung." + ext;
  const datei = new File([await r.blob()], name, {type: TEILEN_MIME[ext] || r.headers.get("Content-Type") || "application/octet-stream"});
  await navigator.share({files: [datei]});                       // ohne Titel: iOS legt ihn bei „In Dateien sichern“ sonst als zweite Datei (.txt) neben die PDF
}
// PDF nie im selben Fenster öffnen: am Rechner „Speichern unter“ mit Zielordner (wo der Browser das kann, sonst normaler Download),
// am Handy das Teilen-Menü des Geräts („In Dateien sichern“, wie bei einem Anhang).
function pdfName(url) {                                              // derselbe Name, den der Server beim Herunterladen vorschlägt
  const n = url.match(/monatsnachweis\/(\d{4})\/(\d{1,2})(?:\/mit-zeiten)?\.pdf$/);
  if (n) return `Monatsnachweis-${n[1]}-${n[2].padStart(2, "0")}.pdf`;
  const m = url.match(/monat\/(\d{4})\/(\d{1,2})\.pdf$/), s = url.match(/steuer\/(\d{4})\.pdf$/);
  return m ? `Zeiterfassung-${m[1]}-${m[2].padStart(2, "0")}.pdf` : s ? `Homeoffice-Uebersicht-${s[1]}.pdf` : "Zeiterfassung.pdf";
}
// Speichert eine PDF: am Handy über das Teilen-Menü, am Rechner mit „Speichern unter“ (wo der Browser das kann), sonst als normaler Download.
async function pdfSpeichern(url) {
  if (amHandy() && teilenMoeglich()) return dateiTeilen(url);          // am Handy: Teilen-Menü; am Rechner (auch im Handy-Design): „Speichern unter“
  if (!window.showSaveFilePicker) { location.href = url; return; }      // Download: der Server liefert die Datei als Anhang
  const r = await fetch(url);                                           // erst laden: nach einem Fehler entsteht keine leere Datei
  if (!r.ok) { const e = new Error((await r.json().catch(() => ({}))).fehler || "Fehler " + r.status); e.name = "LadeFehler"; throw e; }
  const inhalt = await r.blob();
  const ziel = await window.showSaveFilePicker({suggestedName: pdfName(url), types: [{description: "PDF", accept: {"application/pdf": [".pdf"]}}]});
  const s = await ziel.createWritable();
  await s.write(inhalt);
  await s.close();
}
let exportWahl = null;                             // Auswahl auf der Export-Seite, unabhängig von der Jahresauswahl oben
// Liest eine Datei und liefert ihren Inhalt als Base64 (für das Hochladen als JSON).
function dateiBase64(datei) {
  return new Promise((ok, fehler) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = () => fehler(new Error("Datei nicht lesbar")); r.readAsDataURL(datei); });
}
// Merkt den Zeitpunkt der Sicherung von Hand (Download oder Teilen).
function handGesichert() { speicher.s("ho_gesichert", new Date().toISOString()); sichInfo(); }
// Was die App zu `server_anmeldung.fehler` zeigt (Server hinter dem Anmeldedienst).
const SERVER_ANMELDUNG_FEHLER = {
  anmeldung: "Der Server verlangt eine Anmeldung: Benutzername und Passwort eintragen und „Adresse speichern“ wählen.",
  "geraet-ungueltig": "Dieses Gerät ist beim Server abgemeldet (Passwort geändert oder Gerät entfernt). Bitte mit Benutzername und Passwort neu anmelden.",
  gesperrt: "Zu viele Anmeldeversuche. Bitte später noch einmal versuchen.",
  zertifikat: "Dem Zertifikat des Servers vertraut dieses Gerät nicht. Adresse prüfen oder das Zertifikat auf diesem Gerät einrichten.",
};
// Web-App im Browser: Dort läuft nichts im Hintergrund, deshalb stößt die Seite den Sync mit GitHub an (beim Öffnen, alle 15 Minuten, beim Zurückkommen).
// 15 Minuten (Wunsch vom 18.11.2026): eigene Änderungen gehen ohnehin nach 5 Sekunden hinaus, beim Zurückkehren in die App wird sofort synchronisiert.
const SYNC_TAKT = 900000;
const SEITE_TAKT = 120000;                                           // offene Seite neu zeichnen, wenn sich der Datenstand geändert hat (nur lokal, ohne Netz)
const ZURUECK_ABSTAND_MS = 60000;                                    // beim Zurückkehren höchstens einmal je Minute synchronisieren
let STAND = null;
// Nach einer Übernahme im Hintergrund die offene Seite neu zeichnen, aber nie mitten in einer Eingabe, im offenen Blatt oder im Export.
function neuZeichnen() {
  const blattOffen = $("#blatt").classList.contains("auf"), feldAktiv = /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "");
  seitenCacheLeeren();
  if (blattOffen || feldAktiv || ["export", "sicherung", "sync"].includes(seitenName())) return;
  api("GET", "/konfig").then(k => { KONFIG = k.werte; }).catch(() => {}).finally(zeigen); return true;
}
// Symbolleiste: Sync-Status (nur wenn ein Sync eingerichtet ist). Grün = synchronisiert, Rot = Fehler, Passwort nötig oder Konflikt.
// Tippen synchronisiert; bei Rot geht es zur Seite „Synchronisieren“.
let AB_ROT = false;
// Der Server hat den Sync von selbst abgeschaltet (dieses Gerät ist allein übrig) oder der Stand hier ist veraltet: Regeln neu holen
async function syncModulPruefen(s) {
  if (!s || s.modul_aus === undefined || s.modul_aus === !modulAn("abgleich")) return;
  try { KONFIG = (await api("GET", "/konfig")).werte; } catch (e) { return; }
  seitenCacheLeeren(); navAnpassen();
  if (s.allein) toast("Synchronisierung abgeschaltet: Kein anderes Gerät synchronisiert mehr");
  if (!navWeg(seitenName()) && seitenName() === "einstellungen") zeigen();
}
// Ob auf diesem Gerät irgendein Sync eingerichtet ist: Cloud-Ordner, eigener Server (auch per Code gekoppelt), dieses Gerät als Speicherort oder GitHub.
function syncEingerichtet(s) {
  return !!(s.ziel?.eingerichtet || s.server || s.freigabe || s.github);
}
// Zeichnet das Sync-Symbol (Wolke) in der Symbolleiste: Grün = synchronisiert, Rot = Fehler, Anmeldung oder Passwort nötig oder Konflikt, nur bei eingerichtetem Sync.
function syncSymbol(s, laeuft) {
  s = mitAblageFehler(s);
  syncModulPruefen(s);
  const b = $("#sync-symbol"); if (!b || !s) return;
  const l = s.letzter, anmeldung = s.server_anmeldung?.fehler, da = modulAn("abgleich") && !s.fern && (syncEingerichtet(s) || (PLATTFORM === "browser" && NETZ));
  b.hidden = !da; if (!da) return;
  AB_ROT = !!(l && (!l.ok || l.gesperrt)) || s.konflikte.length > 0 || !!anmeldung;
  b.innerHTML = sym("wolke");
  b.classList.toggle("sync-rot", AB_ROT); b.classList.toggle("sync-ok", !AB_ROT && !!l); b.classList.toggle("sync-laeuft", !!laeuft);
  b.title = laeuft ? "Synchronisieren läuft" : anmeldung ? `Synchronisieren: ${SERVER_ANMELDUNG_FEHLER[anmeldung] || SERVER_ANMELDUNG_FEHLER.anmeldung}` : s.konflikte.length ? `Synchronisieren: ${s.konflikte.length} Konflikt(e), antippen zum Entscheiden`
    : l && l.gesperrt ? "Synchronisieren: Passwort nötig" : l && !l.ok ? "Synchronisieren fehlgeschlagen, antippen für Einzelheiten"
    : l ? `Synchronisiert ${zeitpunktText(l.zeit)}, antippen zum Synchronisieren` : "Noch nicht synchronisiert, antippen zum Synchronisieren";
  b.setAttribute("aria-label", b.title);
}
// Holt den Sync-Stand und zeichnet das Symbol.
async function syncSymbolLaden() { try { syncSymbol(await api("GET", "/abgleich")); } catch (e) {} }
const SYNC_FERTIG = "Synchronisiert.";
// Tippen auf die Wolke: Bei Rot geht es zur Seite „Synchronisieren“, sonst wird sofort synchronisiert.
async function syncSymbolTippen() {
  if (AB_ROT) { location.hash = "#/sync"; return; }
  const b = $("#sync-symbol"); b.classList.add("sync-laeuft"); b.setAttribute("aria-busy", "true");
  let ok = true;
  try {
    if (PLATTFORM === "browser") { await githubSync(true); if (!KEINE_ABLAGE) await netzSync(); }
    else if ((await api("POST", "/abgleich/jetzt", {})).letzter?.uebernommen) neuZeichnen();
  } catch (e) { ok = false; toastFehler(e.message); }
  b.classList.remove("sync-laeuft"); b.removeAttribute("aria-busy"); await syncSymbolLaden();
  if (ok && !AB_ROT) toast(SYNC_FERTIG);                               // sonst hörte der Screenreader nur, dass es läuft, aber nie das Ende
}
// Desktop, Android, Server: Beim Zurückkehren in die App sofort synchronisieren (die Automatik im Hintergrund läuft nur alle 15 Minuten)
let ZURUECK_ZULETZT = 0;
// Beim Zurückkehren in die App synchronisieren (höchstens einmal je Minute) und die Seite bei neuem Stand neu zeichnen. Nicht in der Demo: Dort lehnt
// der Dienst den Sync ab; ist der Demo-Stand beim Start noch nicht geladen, wird er nachgefragt.
async function beimZurueckkommen() {
  if (document.hidden) return;
  if (syncErlaubt() && Date.now() - ZURUECK_ZULETZT >= ZURUECK_ABSTAND_MS) {
    ZURUECK_ZULETZT = Date.now();
    try {
      const s = await api("GET", "/abgleich");
      if (s.auto && !s.fern && !(DEMO || await api("GET", "/demo")).aktiv) syncSymbol(await api("POST", "/abgleich/jetzt", {automatik: true}));   // neu zeichnet seiteAktuellHalten, wenn sich der Stand geändert hat
    } catch (e) { /* ohne Verbindung: später noch einmal */ }
  }
  seiteAktuellHalten();
  if (seitenName() !== "start") zutunLaden().then(zutunZahl);          // Zahl am Symbol; die Übersicht fragt selbst
}
// Fragt, ob sich der Datenstand geändert hat (Sync im Hintergrund), und zeichnet die Seite dann neu.
async function seiteAktuellHalten() {
  if (document.hidden || !modulAn("abgleich")) return;
  try {
    const s = await api("GET", "/abgleich"); syncSymbol(s);
    if (STAND !== null && s.stand !== STAND && !neuZeichnen()) return;   // erst als gesehen merken, wenn neu gezeichnet ist
    STAND = s.stand;
  } catch (e) { /* ohne Verbindung: später noch einmal */ }
}
// Web-App: „Automatisch synchronisieren“ gilt je Gerät (Speicher des Browsers), Voreinstellung an. Von Hand („Jetzt synchronisieren“, Wolke) geht es immer.
const autoLokal = () => speicher.l("ho_abgleich_auto", "1") !== "0";
// Eigenständige Web-App: Synchronisiert mit dem GitHub-Repo, wenn eingerichtet und ein Passwort da ist; bei Änderungen wird neu gezeichnet.
async function githubSync(manuell) {
  if ((document.hidden && !LETZTER_OFFEN) || !syncErlaubt() || (!manuell && !autoLokal())) return;
  try {
    const s = await api("GET", "/abgleich");
    if (!s.github || !s.passwort) return;
    const n = await api("POST", "/abgleich/jetzt", {});
    if (n.letzter && n.letzter.uebernommen) neuZeichnen();
    syncSymbol(n);
  } catch (e) { /* ohne Verbindung: später noch einmal */ }
}
// Nach jeder Änderung kurz warten (mehrere Änderungen hintereinander ergeben einen Sync), dann synchronisieren. Desktop, Android und Server machen das selbst.
let BALD = 0;
// Eigenständige Web-App: Plant den Sync 5 Sekunden nach der letzten Änderung (mehrere Änderungen ergeben einen Sync).
function syncBald() {
  if (PLATTFORM !== "browser" || !autoLokal()) return;
  clearTimeout(BALD);
  BALD = setTimeout(() => { githubSync(); if (!KEINE_ABLAGE) netzSync(); }, 5000);
}
// Eigenständige Web-App: Gleicht beim Öffnen, alle 15 Minuten und beim Zurückkehren in die App mit GitHub ab.
function githubAutomatik() {
  if (PLATTFORM !== "browser") return;
  githubSync();
  setInterval(githubSync, SYNC_TAKT);
  document.addEventListener("visibilitychange", githubSync);
}
// ---- Web-App ohne Server, ausgeliefert vom eigenen Server (…/mobil/): synchronisiert selbst mit dessen Ablage (../api/ablage liegt außerhalb der App,
// das Dienst-Skript lässt die Anfrage ins Netz). Von GitHub Pages geladen gibt es keine Ablage; dann bleibt der Austausch über Dateien.
const ABLAGE = "../api/ablage";
let NETZ = false, netzLaeuft = false, KEINE_ABLAGE = false, ABLAGE_FEHLER = "";
const ABLAGE_ABGELEHNT = "Die Ablage hat die Datei abgelehnt. Bitte das Passwort prüfen.";
// Text zur Abweisung der eigenen Datei (403): der Text der Ablage, ohne lesbaren Text der eigene.
const ablageFehlerText = async antwort => { const f = (await antwort.json().catch(() => ({}))).fehler; return typeof f === "string" && f ? f : ABLAGE_ABGELEHNT; };
// Legt eine Abweisung durch die Ablage über den Stand der App: Die App meldet ok, denn den Nachweis prüft erst die Ablage beim Ablegen.
const mitAblageFehler = s => ABLAGE_FEHLER && s?.letzter ? {...s, letzter: {...s.letzter, ok: false, fehler: ABLAGE_FEHLER}} : s;
// SHA-256 eines Blobs als Hex-Text (zum Vergleich der Sync-Dateien).
const hexSumme = async blob => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())), b => b.toString(16).padStart(2, "0")).join("");
// Eigenständige Web-App vom eigenen Server (…/mobil/): Tauscht verschlüsselte Sync-Dateien über dessen Ablage. Liest neue Dateien anderer Geräte ein,
// legt die eigene Datei ab, wenn sie sich geändert hat, und liefert den Stand der App (null ohne Ablage oder Verbindung).
async function netzSync(passwort) {
  if (PLATTFORM !== "browser" || !EIGEN || netzLaeuft || !syncErlaubt()) return null;
  netzLaeuft = true;
  try {
    const r = await fetch(ABLAGE, {cache: "no-store"});
    if (!r.ok) { NETZ = false; KEINE_ABLAGE = r.status === 404; return null; }
    const ablage = await r.json(), liste = ablage.dateien;
    NETZ = true;
    if (!(await api("GET", "/abgleich")).passwort) return null;                  // erst das Passwort festlegen
    const pw = passwort || "", gesehen = JSON.parse(speicher.l("ho_ablage", "{}"));
    let s = await api("POST", "/abgleich/jetzt", {passwort: pw});               // die eigene Datei auf den neuesten Stand bringen
    const eigene = await fetch("api/abgleich/datei"), name = (/filename="([^"]+)"/.exec(eigene.headers.get("Content-Disposition") || "") || [])[1];
    if (!eigene.ok || !name) return null;
    let neues = 0;
    for (const d of liste) {
      if (d.name === name || gesehen[d.name] === d.summe) continue;
      try {
        const roh = await fetch(ABLAGE + "/" + encodeURIComponent(d.name), {cache: "no-store"});
        if (!roh.ok) continue;
        s = await api("POST", "/abgleich/einlesen", {name: d.name, daten: await dateiBase64(await roh.blob()), passwort: pw});
        neues += s.letzter.uebernommen || 0;
        if (!s.letzter.gesperrt) gesehen[d.name] = d.summe;
      } catch (e) { /* eine kaputte Datei hält die anderen nicht auf */ }
    }
    const meine = await (await fetch("api/abgleich/datei")).blob();
    const vorher = (liste.find(d => d.name === name) || {}).summe || "";
    if (vorher !== await hexSumme(meine)) {
      // Schreib-Nachweis (seit 21.11.2026): rechnet die App selbst, der Schlüssel bleibt dort; ohne Ankündigung der Ablage leer (das Feld kennzeichnet neue Geräte).
      // „vorher“ bindet ihn an die Datei, die er ersetzt: Ein mitgelesener Nachweis spielt keinen alten Stand wieder ein.
      const nachweis = ablage.nachweis ? (await api("POST", "/abgleich/nachweis", {ablage: ablage.nachweis, passwort: pw, vorher})).nachweis : "";
      const antwort = await fetch(ABLAGE + "/" + encodeURIComponent(name), {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({daten: await dateiBase64(meine), nachweis})});
      ABLAGE_FEHLER = antwort.status === 403 ? await ablageFehlerText(antwort) : "";
    } else ABLAGE_FEHLER = "";
    speicher.s("ho_ablage", JSON.stringify(gesehen));
    if (neues) neuZeichnen();
    if (s.letzter_offen && !LETZTER_OFFEN) s = await api("POST", "/abgleich/abmelden", {});   // allein übrig: Die Abmeldung liegt jetzt in der Ablage
    s = mitAblageFehler(s);
    syncSymbol(s);
    return s;
  } catch (e) { return null; }                                                    // ohne Verbindung: später noch einmal
  finally { netzLaeuft = false; }
}
// Eigenständige Web-App: Gleicht mit der Ablage des Servers beim Öffnen, alle 15 Minuten und beim Zurückkehren in die App ab.
async function netzAutomatik() {
  if (PLATTFORM !== "browser" || !EIGEN || !modulAn("abgleich")) return;
  if (autoLokal()) await netzSync();
  if (KEINE_ABLAGE) return;                                    // von GitHub Pages geladen: Dort gibt es keine Ablage, also auch nichts zu fragen
  setInterval(() => { if (autoLokal()) netzSync(); }, SYNC_TAKT);
  document.addEventListener("visibilitychange", () => { if (!document.hidden && autoLokal()) netzSync(); });
}
let ZUTUN_IDS = [];                                                     // Einträge der letzten Antwort: Übersicht lässt weg, was die Karte schon sagt
let zeigenZaehler = 0;
// ---- Demo-Modus: eigene Datenbank mit Beispieldaten; der Browser merkt sich das per Cookie (damit auch Downloads die Demo-Daten bekommen)
let DEMO = null, APP_VERSION = "";
// Beim Start eine Abfrage für Symbol, Konflikte und Datenstand (vorher drei gleiche Abfragen hintereinander)
async function syncStart() {
  try {
    const s = await api("GET", "/abgleich"); syncSymbol(s); STAND = s.stand;
    if (modulAn("abgleich") && s.konflikte.length !== KONFLIKTE) { KONFLIKTE = s.konflikte.length; if (seitenName() === "start") zeigen(); }
  } catch (e) { /* ohne Verbindung: später noch einmal */ }
  if (PLATTFORM !== "browser") { setInterval(seiteAktuellHalten, SEITE_TAKT); document.addEventListener("visibilitychange", beimZurueckkommen); beimZurueckkommen(); }   // auch beim Öffnen
}
// Hinter dem Anmeldedienst: Hat sich in diesem Browser eine andere Person angemeldet (Cookie ho_person, setzt der Anmeldedienst), die gemerkten Seiten
// der vorigen verwerfen. Läuft beim Start vor dem ersten Zeichnen, damit nichts von der vorigen Person aufblitzt.
// Auch ohne Cookie (Anmeldung abgelaufen oder abgemeldet): Sonst zeigte die App ohne Verbindung die Seiten der vorigen Person ohne Anmeldung.
function personPruefen(person) {
  const vorher = speicher.l("ho_person", "");
  if (vorher === person) return;
  speicher.s("ho_person", person);
  if (vorher) seitenCacheLeeren();
}
// Hinter dem Anmeldedienst: „Abmelden“ als Symbol in der Leiste (Handy oben neben dem Menü, Rechner links bei den Schnell-Symbolen), im Menü und
// in der Seitenleiste. Der Name kommt URL-codiert vom Anmeldedienst und wird maskiert. Danach kommt die Anmeldeseite, dort wechselt man die Person.
let PERSON = "", BENUTZER = "", ADMIN = false;
function abmeldenKnopf(roh) {
  if (PERSON || !$("#menue")) return;
  try { PERSON = decodeURIComponent(roh); } catch (e) { PERSON = roh; }
  const text = `Abmelden (${esc(PERSON)})`;
  $("#menue").insertAdjacentHTML("beforebegin", `<button id="abmelden-knopf" class="rund leiste" type="button" ${kl("personAbmelden")} aria-label="${text}" title="${text}">${sym("abmelden")}</button>`);
  $("#seitennav").insertAdjacentHTML("beforeend", `<button type="button" id="nav-abmelden" ${kl("personAbmelden")}>${sym("abmelden")}${text}</button>`);
  schnellSymbole();
}
// Meldet beim Anmeldedienst ab (JSON-Kopf wie jeder Schreibzugriff) und lädt neu: Danach kommt seine Anmeldeseite, dort lässt sich die Person wechseln.
async function personAbmelden() {
  try { await fetch("abmelden", {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"}); } catch (e) { toastFehler(KEINE_VERBINDUNG); return; }
  seitenCacheLeeren(); location.reload();
}
// Desktop-Fassung: „App beenden“ in der Fußzeile (wichtig, wenn die App als gewöhnlicher Tab läuft und kein eigenes Fenster hat)
function beendenKnopf() {
  const f = $(".fuss"); if (!f || $("#app-beenden")) return;
  f.insertAdjacentHTML("beforeend", `<span class="fuss-strich"> · </span><button type="button" id="app-beenden" class="link" ${kl("appBeenden")}>App beenden</button>`);
  $("#seitennav").insertAdjacentHTML("beforeend", `<button type="button" id="nav-beenden" ${kl("appBeenden")}>App beenden</button>`);
}
// Beendet die Desktop-App nach Rückfrage und zeigt dann eine Abschlussseite.
async function appBeenden() {
  if (!(await frage("Die Zeiterfassung beenden?\n\nAlle Eingaben sind gespeichert.", "Beenden"))) return;
  try { await api("POST", "/desktop/beenden", {}); } catch (e) { toastFehler(e.message); return; }
  document.body.innerHTML = `<main class="beendet"><h1>Zeiterfassung beendet</h1><p>Alle Eingaben sind gespeichert. Dieses Fenster kannst du schließen.</p></main>`;
}
// Verwirft die gemerkten Seiten im Browser-Speicher (ho_seite_…).
function seitenCacheLeeren() { try { Object.keys(localStorage).filter(k => k.startsWith(EIGEN + "ho_seite_")).forEach(k => localStorage.removeItem(k)); } catch (e) {} }
// Verwirft die gemerkten Seiten und lädt die App neu.
function neuLaden() { seitenCacheLeeren(); location.reload(); }
// Hinweise über jeder Seite: Demo-Modus, veraltete Oberfläche im offenen Tab, offene Konflikte nach einem Sync (nur lokale Fassungen)
// Eigenständige Web-App: Die Daten liegen nur im Speicher des Browsers, und den darf das Gerät leeren. Deshalb erinnert die App an die Sicherung.
const SICHERN_NACH_TAGEN = 7;
// Tage seit der letzten Sicherung von Hand (null, wenn noch nie).
function tageSeitSicherung() { const t = Date.parse(speicher.l("ho_gesichert", "")); return isNaN(t) ? null : Math.floor((Date.now() - t) / 864e5); }
// Eigenständige Web-App: Ist die Sicherung fällig (noch nie oder seit 7 Tagen nicht)? Nicht in der Demo und nicht ohne Einträge.
function sichernFaellig() {
  if (PLATTFORM !== "browser" || !DEMO || DEMO.aktiv || DEMO.leer) return false;
  const tage = tageSeitSicherung();
  return tage === null || tage >= SICHERN_NACH_TAGEN;
}
const JAHRESSEITEN = ["jahr", "urlaub", "krank", "sondertage", "steuer"];        // nur diese Seiten zeigen ein ganzes Jahr; alle anderen blättern selbst (Monat, Woche) oder wählen im Formular (Export)
// Teile der Adresse nach dem „#/“, zum Beispiel [„monat“, „2026“, „11“].
const hashTeile = () => (location.hash.replace(/^#\/?/, "") || "start").split("/");
const seitenName = () => Object.hasOwn(SEITEN, hashTeile()[0]) && !navWeg(hashTeile()[0]) ? hashTeile()[0] : "start";   // abgeschaltete Seite: Übersicht
// Baut die Seite zur aktuellen Adresse (#/seite/…): Titel, Navigation, sofort die gemerkte Fassung, dann mit frischen Daten. Nur die jüngste Anforderung
// darf die Seite füllen. Ohne Verbindung bleibt der letzte Stand mit Hinweis stehen.
async function zeigen() {
  adresseUmstellen();
  const demoLaden = DEMO ? null : api("GET", "/demo").then(d => { DEMO = d; }, () => { DEMO = {}; });   // einmal je Start, vor der Seite: Darstellung, Regeln und Übersicht zeigen je nach Demo andere Knöpfe
  const teile = hashTeile(), name = seitenName();
  if (name !== "export") exportWahl = null;                           // Export: beim Öffnen heute, aus dem Monat dessen Monat (#/export/JJJJ/M)
  else if (teile[1] && !exportWahl) exportWahl = {j: +teile[1], m: Math.min(12, Math.max(1, +teile[2] || 1)), nj: +teile[1]};
  $("#j-anzeige").textContent = jahr;
  document.querySelector(".jahr").style.display = JAHRESSEITEN.includes(name) ? "" : "none";
  const b = bereichVon(name)[0];
  reiterZeichnen(name);
  $("#titel").textContent = bereichName(b);
  document.body.dataset.seite = name;
  if (!zeitDaneben()) zeitDanebenZu();
  document.title = fensterTitel(name) + " · Zeiterfassung";
  $("#zurueck").classList.toggle("da", zurueckDa(name));
  // Markiert einen Eintrag der Navigation als aktuell (Klasse on, aria-current).
  const aktiv = (a, an) => { a.classList.toggle("on", an); an ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"); };
  document.querySelectorAll("#nav a").forEach(a => aktiv(a, a.dataset.t === b));
  document.querySelectorAll("#seitennav a").forEach(a => aktiv(a, a.dataset.t === b));
  navAnpassen();
  const mein = ++zeigenZaehler;                                       // nur die jüngste Anforderung darf die Seite füllen (schnelles Wechseln)
  const merk = "ho_seite_" + location.hash;                           // zuletzt gezeigte Seite sofort anzeigen, dann mit frischen Daten ersetzen
  if (zeigen.letzte !== location.hash) {                              // Seitenwechsel: gemerkte Fassung oder Platzhalter, nie die alte Seite unter dem neuen Titel
    const alt = name !== "start" || OHNE_NETZ ? speicher.l(merk, "") : "";
    $("#inhalt").innerHTML = reiterHuelle(alt || `<div class="lade" role="status" aria-busy="true" aria-label="Lädt …"></div>`);
    if (zeigen.letzte !== undefined) scrollTo(0, 0);
    // Andere Seite oder Unterseite durch Bedienung (nicht beim ersten Laden): Fokus auf die neue Überschrift, damit der Screenreader den Wechsel ansagt und
    // Tab auf der neuen Seite weitergeht. Blättern (Monat, Woche) und die Reiter behalten ihren Fokus.
    const seite = name + "/" + unterseiteName(name, teile[1]);
    if (zeigen.letzte !== undefined && seite !== zeigen.letzteSeite && !document.activeElement?.closest("[role=tablist]")) $("#titel").focus({preventScroll: true});
    zeigen.letzte = location.hash; zeigen.letzteSeite = seite;
  }
  try { if (demoLaden) await demoLaden; const html = await SEITEN[name](); if (mein !== zeigenZaehler) return; OHNE_NETZ = false; const y = scrollY; $("#inhalt").innerHTML = baender() + reiterHuelle(html); beschriften($("#inhalt")); scrollTo(0, y); speicher.s(merk, demoBanner() + html); if (window.nachher) { window.nachher(); window.nachher = null; } }
  catch (e) {
    if (mein !== zeigenZaehler) return;
    const alt = e.ohneNetz ? speicher.l(merk, "") : "";               // ohne Verbindung: die zuletzt gesehene Fassung bleibt stehen, klar gekennzeichnet
    OHNE_NETZ = !!e.ohneNetz;
    $("#inhalt").innerHTML = alt ? OHNE_NETZ_BAND + reiterHuelle(alt) : reiterHuelle(meldung(e.message) + '<div class="schnell"><a class="btn" href="#/start">Zur Übersicht</a></div>');
    if (alt) beschriften($("#inhalt"));
  }
}
const OHNE_NETZ_BAND = `<div class="demo-band" role="status"><span><b>Keine Verbindung</b> · Anzeige vom letzten Stand, Eintragen geht erst wieder mit Verbindung</span><button ${kl("zeigen")}>Neu versuchen</button></div>`;
// Wechselt das Jahr und zeichnet neu.
function setJahr(j) { jahr = j; zeigen(); }
// Blättert den gewählten Monat um d vor oder zurück (mit Jahreswechsel).
function monatWechsel(d) { monat += d; if (monat < 1) { monat = 12; jahr--; } if (monat > 12) { monat = 1; jahr++; } }


// ---- Homeoffice-Modus (Regeln): mit Grenze, ohne Grenze, kein Homeoffice, nur Homeoffice (Wunsch vom 17.11.2026)
const HO_MODI = {grenze: "mit Grenze", ohne: "ohne Grenze", kein: "kein Homeoffice", nur: "nur Homeoffice"};
// Module (Wunsch vom 17.11.2026): Abgeschaltetes zeigt die App nirgends mehr. Meist blendet CSS aus (body[data-ohne] und data-modul), gerechnet wird unverändert.
const modulAn = n => !(KONFIG.module_aus || []).includes(n);
// Sync abgeschaltet: Es geht noch genau ein letzter Sync hinaus, damit die anderen Geräte das Abschalten erfahren und übernehmen. Danach keiner mehr.
let LETZTER_OFFEN = false;
// Synchronisiert dieses Gerät? Nur bei eingeschaltetem Modul „Synchronisieren“ oder für den letzten Sync beim Abschalten.
const syncErlaubt = () => modulAn("abgleich") || LETZTER_OFFEN;
// Beim Abschalten des Moduls „Synchronisieren“: ein letzter Sync (Web-App: auch Abmeldung), damit die anderen Geräte das Abschalten erfahren.
async function letzterSync() {
  LETZTER_OFFEN = true;
  try {
    if (PLATTFORM === "browser") { await githubSync(true); if (!KEINE_ABLAGE) await netzSync(); await api("POST", "/abgleich/abmelden", {}); }
    else await api("POST", "/abgleich/jetzt", {});             // gelingt er nicht (keine Verbindung), versucht es die Automatik weiter
  } catch (e) {}
  LETZTER_OFFEN = false;
}
// Attribut data-modul für Elemente, die CSS bei abgeschaltetem Modul ausblendet.
const md = n => ` data-modul="${n}"`;
const ART_MODUL = {gleittag: "gleittage", familientag: "familientage", angespart: "angespart", freizeit: "freizeit", krank: "krank", krank_attest: "krank", krank_dienst: "krank", sonderurlaub_tag: "sonderurlaub", kind_krank: "kind_krank"};
// Ist die Art eines Tages (z. B. Gleittag) bei den eingeschalteten Modulen wählbar?
const artAn = k => !ART_MODUL[k] || modulAn(ART_MODUL[k]);
const SEITE_MODUL = {monat: "monat", woche: "woche", horest: "horest", jahr: "jahr", urlaub: "urlaub", krank: "krank", steuer: "nachweis", export: "export", sicherung: "sicherung", sync: "abgleich", hilfe: "hilfe", monatsnachweis: "monatsnachweis"};
const SONDERTAGE_MODULE = ["sonderurlaub", "kind_krank"];               // Reiter Sondertage, solange eines davon an ist
// Der Homeoffice-Modus der Regeln: grenze, ohne, kein oder nur.
const hoModus = () => KONFIG.ho_modus || "grenze";
// Gilt die HO-Grenze (Quote, Prognose)?
const mitGrenze = () => hoModus() === "grenze";
const einOrt = () => ({kein: "dst", nur: "ho"})[hoModus()] || "";                 // nur ein Arbeitsort: nichts zu wählen, keine Quote
// Text für die Orte eines Tages, je nach Homeoffice-Modus.
const orteText = (ho, dst) => einOrt() ? `Arbeitszeit ${(einOrt() === "ho" ? ho : dst) || "–"}` : `HO ${ho || "–"} · Büro ${dst || "–"}`;
const ortVersteckt = (ort, wert) => einOrt() && einOrt() !== ort && !wert ? ' data-stil="display:none"' : "";   // ein alter Wert am anderen Ort bleibt sichtbar
// Unsichtbare Ortswahl für den Fall, dass es nur einen Arbeitsort gibt.
const festerOrt = id => `<div class="seg" id="${id}" data-stil="display:none"><button type="button" data-v="${einOrt()}" class="on"></button></div>`;
// Ist eine Seite abgeschaltet (Modus, Modul oder in dieser Fassung ohne Sync)?
const URLAUB_KURZ = "Urlaub";                                          // Name der Urlaub-Seite, wenn das Modul „Gleittage“ aus ist
// Name einer Seite für Titel und Menü: ohne Gleittage heißt „Urlaub & Gleittage“ nur „Urlaub“.
function seitenTitel(n) { return n === "urlaub" && !modulAn("gleittage") ? URLAUB_KURZ : NAMEN[n]; }
const navWeg = n => (n === "horest" && !mitGrenze()) || (n === "steuer" && hoModus() === "kein") || !modulAn(SEITE_MODUL[n] || "") || (n === "sync" && !MIT_SYNC.includes(PLATTFORM)) || (n === "sondertage" && !SONDERTAGE_MODULE.some(modulAn));
// Blendet ganz abgeschaltete Bereiche in Seitenleiste und Tableiste aus und setzt ihre Namen (hängen an Homeoffice-Modus und Modulen).
function navAnpassen() {
  document.body.dataset.ohne = (KONFIG.module_aus || []).join(" ");
  stempelAnzeige();                                                   // Symbol und Beschriftung der Kommen/Gehen-Taste
  document.querySelectorAll("#seitennav a[data-t], #nav a[data-t]").forEach(a => { a.style.display = bereichWeg(a.dataset.t) ? "none" : ""; navBeschriften(a); });
}

// Knopf sperren, bis seine Aktion fertig ist: Ein Doppeltipp (Kommen, Speichern, Eintragen) schickte sonst alles zweimal.
// Nicht über disabled: Der Fokus spränge sonst an den Seitenanfang (Tastatur, Screenreader).
function sperren(knopf, ergebnis) {
  if (!(ergebnis instanceof Promise)) return ergebnis;
  knopf.setAttribute("aria-busy", "true"); knopf.setAttribute("aria-disabled", "true");
  // Gibt den Knopf wieder frei, wenn seine Aktion fertig oder fehlgeschlagen ist.
  const frei = () => { knopf.removeAttribute("aria-busy"); knopf.removeAttribute("aria-disabled"); };
  ergebnis.then(frei, frei);
  return ergebnis;
}
// Ist der Knopf gerade gesperrt, weil seine Aktion noch läuft?
const beschaeftigt = knopf => knopf.getAttribute("aria-busy") === "true";
// Verpackt einen Klick-Handler so, dass ein zweiter Tipp während der Aktion ignoriert wird.
const gesperrt = f => ev => beschaeftigt(ev.currentTarget) ? undefined : sperren(ev.currentTarget, f(ev));
// Meldung, die ein Neuladen übersteht (nach Wiederherstellen und Zurücksetzen lädt die Seite neu)
function nachDemLaden(text) { try { sessionStorage.setItem(EIGEN + "ho_meldung", text); } catch (e) {} location.reload(); }
// Im Monat nur als Knopf zum Aufklappen (die volle Ansicht steht unter HO-Spielraum); offen bleibt offen, auch nach dem Neuzeichnen.
let jpOffen = false;
// Zum aktuellen Monat (bzw. Jahr) springen und den heutigen Tag in die Mitte holen
function zuHeute() {
  jahr = heute.getFullYear(); monat = heute.getMonth() + 1;
  const seite = location.hash.replace(/^#\/?/, "").split("/")[0];
  if (seite === "monat" || seite === "") {
    window.scrollHeute = true;                    // nur seiteMonat liest das Zeichen; sonst bliebe es für das nächste Öffnen des Monats stehen
    const ziel = `#/monat/${jahr}/${monat}`;
    if (location.hash === ziel) zeigen(); else location.hash = ziel;
  } else zeigen();
}
// ---- Krank, Homeoffice-Übersicht
// ---- Regeln (für alle Jahre): Bundesland, freie Tage, Faschingsdienstag, HO-Grenze, Gleit- und Familientage
const BUNDESLAENDER = {BW: "Baden-Württemberg", BY: "Bayern", BE: "Berlin", BB: "Brandenburg", HB: "Bremen", HH: "Hamburg", HE: "Hessen", MV: "Mecklenburg-Vorpommern",
  NI: "Niedersachsen", NW: "Nordrhein-Westfalen", RP: "Rheinland-Pfalz", SL: "Saarland", SN: "Sachsen", ST: "Sachsen-Anhalt", SH: "Schleswig-Holstein", TH: "Thüringen"};
// Sprungziele aus Antworten des Dienstes (Zu tun, Daten prüfen): nur Seiten der App, nie Skript-Links oder fremde Adressen
const ZUTUN_ZIEL = /^#\/[\w\/-]*$/;
// Grenzen der Karte „Zu tun“, bis die Regeln eigene Werte haben (wie die Voreinstellung im Rechenkern: Browser und iPhone erinnern früher an die Sicherung)
const zutunSicherungTage = k => k.zutun_sicherung_tage ?? (PLATTFORM === "browser" ? 14 : 30);
const zutunSaldoGrenze = k => k.zutun_saldo_grenze ?? 40;
// ---- Zentrale Behandlung von Klicks und Änderungen (ersetzt onclick/onchange im HTML)
function monatBlaettern(richtung, mitAdresse) { monatWechsel(richtung); if (mitAdresse) location.hash = "#/monat/" + jahr + "/" + monat; else zeigen(); }
// Kalender des Geräts öffnen. Am Rechner über showPicker(); am Tippgerät (iPhone: weder showPicker() noch click() öffnen dort etwas)
// liegt das unsichtbare Datumsfeld selbst über dem Knopf und nimmt das Tippen an (grundlage.css, .kal-wahl).
function kalenderOeffnen(feld) { const k = $(feld); try { k.showPicker(); } catch (e) { k.focus(); k.click(); } }
// Öffnet den Kalender für den Monat.
function monatKalender() { kalenderOeffnen("#m-kal"); }
function monatDatum(iso) {                       // beliebigen Tag im Kalender gewählt: zu seinem Monat springen
  if (!iso) return;
  jahr = +iso.slice(0, 4); monat = +iso.slice(5, 7);
  if ((location.hash.replace(/^#\/?/, "").split("/")[0] || "monat") === "monat") location.hash = "#/monat/" + jahr + "/" + monat; else zeigen();
}
// ---- darstellung.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Fehlerkasten für Meldungen (role=alert, der Text wird maskiert).
const meldung = t => `<div class="fehler" role="alert">${esc(t)}</div>`;
// Formularfehler (WCAG 3.3.1): zeigt text im Kasten box (role=alert, braucht eine id) und verbindet ihn über aria-describedby mit dem Feld, um das es geht;
// das Feld gilt bis zur nächsten Eingabe als fehlerhaft (aria-invalid). Der Dienst nennt das Feld nur im Text („Wochenstunden: …“): felder ordnet Textanfänge
// Feldern zu. Ohne Feld hängt der Kasten am Knopf, der gesendet hat (er behält den Fokus), damit der Fehler beim Zurückgehen dorthin wieder hörbar ist.
function formFehler(box, text, {feld = null, felder = []} = {}) {
  box.innerHTML = meldung(text); box.scrollIntoView({block: "nearest"});
  const treffer = (felder.find(([anfang]) => text.startsWith(anfang)) || [])[1];
  const f = feld || (treffer && $(treffer)), ziel = f || document.activeElement?.closest("button");
  if (!ziel) return;
  ziel.setAttribute("aria-describedby", box.id);
  if (f) { f.setAttribute("aria-invalid", "true"); f.addEventListener("input", () => f.removeAttribute("aria-invalid"), {once: true}); }
}
// Maße und Farben aus den Vorlagen (data-stil) setzt das Skript: style-Attribute wären eingebettete Stile, die die Seite nicht erlaubt (CSP style-src 'self')
const stilSetzen = e => { e.style.cssText = e.dataset.stil; };
// Felder ohne verknüpfte Beschriftung bekommen den Text des davorstehenden <label> als Namen (für Screenreader)
const TIPPBAR = ".tag[data-d], .kz[data-d], tr.klick, #stempel-banner";          // Zeilen, Kacheln und das Band der Stempeluhr, die sich antippen lassen
// Barrierefreiheit: Tippbare Zeilen und Kacheln werden per Tab erreichbar (role=button), Felder ohne verknüpfte Beschriftung bekommen den Text des davorstehenden
// <label> als aria-label, Gruppen aus mehreren Feldern role=group bzw. radiogroup. Auswahlknöpfe melden ihren Zustand über aria-pressed.
function beschriften(wurzel) {
  wurzel.querySelectorAll(TIPPBAR).forEach(e => {                 // auch mit der Tastatur erreichbar (Tab, dann Enter oder Leertaste)
    if (e.tabIndex >= 0) return;
    e.tabIndex = 0;
    if (e.tagName === "DIV") e.setAttribute("role", "button");    // Tabellenzeilen behalten ihre Rolle
  });
  wurzel.querySelectorAll("label:not([for])").forEach(l => {
    if (l.querySelector("input,select")) return;
    const n = l.nextElementSibling; if (!n) return;
    const felder = n.matches("input,select") ? [n] : [...n.querySelectorAll("input,select")];
    if (felder.length === 1 && !felder[0].closest("label")) { if (!felder[0].getAttribute("aria-label")) felder[0].setAttribute("aria-label", l.textContent.trim()); }
    else if (n.querySelectorAll("input,select,button").length > 1 && !n.hasAttribute("role")) {
      n.setAttribute("role", n.querySelector("input[type=radio]") ? "radiogroup" : "group"); n.setAttribute("aria-label", l.textContent.trim());
    }
  });
  wurzel.querySelectorAll(GEWAEHLT).forEach(gewaehltMelden);
  zahlVorProzentFest(wurzel);
}
// Zahl und Prozentzeichen bleiben in einer Zeile („76,20 %“): Der Kern liefert ein normales Leerzeichen, das auch in Export und PDF steht.
const ZAHL_VOR_PROZENT = /(\d) %/g;
// Ersetzt in allen Texten unter wurzel das Leerzeichen zwischen Zahl und % durch ein geschütztes.
function zahlVorProzentFest(wurzel) {
  const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  for (let n = gang.nextNode(); n; n = gang.nextNode()) if (n.data.includes(" %")) n.data = n.data.replace(ZAHL_VOR_PROZENT, "$1\u00a0%");
}
// Auswahl-Knöpfe (Homeoffice/Büro, Design, Farbe, Varianten, Automatisch): gewählt ist, wer die Klasse on bzw. gew trägt; der Screenreader hört es über aria-pressed
const GEWAEHLT = ".seg > button:not([role=tab]), .farben > button, .varianten > button, .auto-knopf";   // Reiter melden aria-selected, nicht aria-pressed
// Setzt aria-pressed eines Auswahlknopfs nach seiner Klasse on bzw. gew (für Screenreader).
const gewaehltMelden = b => b.setAttribute("aria-pressed", String(b.classList.contains("on") || b.classList.contains("gew")));
// Zahl mit führender Null auf zwei Stellen.
const pad = n => String(n).padStart(2, "0");
// Zahl mit Komma statt Punkt (deutsche Schreibweise, z. B. 2,5).
const komma = n => String(n).replace(".", ",");
// Anzahl mit Einzahl oder Mehrzahl und Dezimalkomma, z. B. „1 Woche“, „2,5 Wochen“.
const anzahl = (n, eins, viele) => `${komma(n)} ${n === 1 ? eins : viele}`;
// Anzahl Tage: „1 Tag“, „2,5 Tage“.
const tage = n => anzahl(n, "Tag", "Tage");
// Datum als JJJJ-MM-TT.
const iso = (j, m, t) => `${j}-${pad(m)}-${pad(t)}`;
// Wandelt „hh:mm“ in Minuten um (0 bei ungültiger Eingabe).
const minuten = t => { const m = /^(\d+):(\d\d)$/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : 0; };
const saldoKlasse = m => m < 0 ? "minus" : (m > 0 ? "plus" : "");                   // Saldo und Konten: minus rot, plus grün, null neutral
// Minuten als hh:mm; negative mit „−“, auf Wunsch positive mit „+“.
const hhmm = (m, vorz) => { const a = Math.abs(m); return (m < 0 ? "−" : (vorz && m > 0 ? "+" : "")) + pad(Math.floor(a / 60)) + ":" + pad(a % 60); };
const pauseNorm = t => /^\s*\d{1,3}\s*$/.test(t || "") ? hhmm(+t) : zeitNorm(t);      // Pause „45“ heißt 45 Minuten, nicht 45 Stunden
// Kurztext „Kommen–Gehen · Pause …“ eines Tages (leer ohne Kommen).
const uhrText = z => z.kommen ? `${z.kommen}–${z.gehen} · Pause ${z.pause}` : "";
// Pausenregel aus „Regeln“ (wie regeln.pause_auto): je Stufe anteilig, damit die Arbeitszeit nie unter die Schwelle fällt
const pauseAuto = dauer => (KONFIG.pausen || []).reduce(([p, vorher], [ab, pause]) => [dauer > ab ? Math.max(p, Math.min(pause, dauer - ab + vorher)) : p, pause], [0, 0])[0];
// Die Pausenregel als Satz, zum Beispiel „über 06:00 Std. 00:30 Pause“.
const pausenText = (stufen = KONFIG.pausen || []) => stufen.length ? stufen.map(([ab, p]) => `über ${zeitText(ab)} Std. ${zeitText(p)} Pause`).join(", ") : "keine Pause";
// ISO-Datum JJJJ-MM-TT als TT.MM.JJJJ.
const de = d => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

// Zeit-Eingabe, immer hh:mm: 845 -> 08:45, 8 -> 08:00, 7:45 -> 07:45
const zweistellig = t => t.padStart(5, "0");
// Macht aus einer freien Zeit-Eingabe hh:mm; was sich nicht lesen lässt, bleibt unverändert.
function zeitNorm(t) {
  t = String(t || "").trim().replace(",", ".");
  if (!t) return "";
  if (/^\d{1,2}:\d{2}$/.test(t)) return zweistellig(t);
  if (/^\d{3,4}$/.test(t)) return zweistellig(t.slice(0, -2) + ":" + t.slice(-2));
  if (/^\d{1,2}$/.test(t)) return zweistellig(t + ":00");
  return t;
}

// ---- Symbole
const SYM = {
  start: '<path d="M4 11.5 12 4l8 7.5V20H4z"/><path d="M10 20v-6h4v6"/>',
  monat: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  wolke: '<path d="M7 18.5h10.2a4.3 4.3 0 0 0 .6-8.56A6.2 6.2 0 0 0 5.9 9.6 4.5 4.5 0 0 0 7 18.5z"/>',
  sonne: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  mond: '<path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/>',
  heute: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17"/><circle cx="12" cy="15" r="2.2" fill="currentColor"/>',
  horest: '<circle cx="12" cy="13" r="8"/><path d="M12 13V8.5M9.5 2.5h5"/>',
  jahr: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  urlaub: '<path d="M3 20h18M12 20V9"/><path d="M12 9c-4-1-7 1-8 4 3-1 6 0 8-4zM12 9c4-1 7 1 8 4-3-1-6 0-8-4zM12 9c0-3 2-5 5-5-1 3-3 5-5 5z"/>',
  krank: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M12 8v8M8 12h8"/>',
  steuer: '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
  einstellungen: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"/>',
  woche: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 14h8"/>',
  planung: '<rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M8 3v4M16 3v4M3.5 10h17M8 15l2.5 2.5L16 13"/>',
  export: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 16v4h16v-4"/>',
  sync: '<path d="M7 18.5h10.2a4.3 4.3 0 0 0 .6-8.56A6.2 6.2 0 0 0 5.9 9.6 4.5 4.5 0 0 0 7 18.5z"/>',
  sicherung: '<path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.800-1.200-8-4.500-8-9V6z"/><path d="M8.500 12l2.500 2.500 4.500-4.500"/>',
  darstellung: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>',
  hilfe: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.8.4-1.1 1-1.1 1.8M12 17h.01"/>',
  mehr: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  abmelden: '<path d="M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h9"/>',
};
// SVG-Symbol aus SYM als HTML (für Screenreader verborgen).
const sym = n => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${SYM[n]}</svg>`;
// Menü am Handy als Blatt: die Bereiche außerhalb der Tableiste, die nicht abgeschaltet sind, (Desktop-Fassung) „App beenden“ und (hinter dem Anmeldedienst) „Abmelden“.
function menueBlatt() {
  blatt(`<h3>Menü</h3><div class="menue">${menueBereiche().map(b => `<a href="#/${b}" data-zu="1">${sym(BEREICH_SYM[b])}<span>${bereichName(b)}</span><i>›</i></a>`).join("")}${$("#app-beenden") ? `<button type="button" data-zu="1" ${kl("appBeenden")}><span>App beenden</span></button>` : ""}${PERSON ? `<button type="button" data-zu="1" ${kl("personAbmelden")}>${sym("abmelden")}<span>Abmelden (${esc(PERSON)})</span></button>` : ""}</div>
    <div class="knoepfe"><button type="button" ${kl("blattZu")}>Schließen</button></div>`);   // VoiceOver und TalkBack haben kein Escape, und den Bereich neben dem Blatt finden sie nicht
  document.querySelectorAll("#blatt-inh [data-zu]").forEach(a => a.addEventListener("click", blattZu));
}
// ---- Darstellung: Design (Web/Handy), Farbe (Hell/Dunkel), Akzent
const AKZENTE = {blau: "#007aff", cyan: "#32ade6", tuerkis: "#00b3a4", gruen: "#30a14e", lindgruen: "#8bc34a", gelb: "#ffcc00", gold: "#d4a017", orange: "#ff9500",
  rot: "#ff3b30", rosa: "#ff2d55", violett: "#af52de", indigo: "#5e5ce6", braun: "#a2845e", graphit: "#8e8e93"};        // Blau ist immer Standard
// Eigene Akzentfarbe: gespeichert wird der Name aus AKZENTE oder ein Hex-Wert (#rrggbb)
// Farbmodus ohne gespeicherte Wahl: wie das System (design.md F-MO1); Grundfarbe für die Statusleiste je Modus (F-F5, wie --bg in grundlage.css)
const FARBE_VORGABE = "auto", GRUND_DUNKEL = "#050608", GRUND_HELL = "#f2f3f7";
// Bezug der Akzent-Helfer je Modus (design.md 4.1, Entscheidung Z1): Grundton (dunkel hellster, hell dunkelster Punkt des Verlaufs), Anteil des Akzent-Schimmers,
// Deckkraft des Glases, --tx-2. Muss zu grundlage.css passen (--bg-oben bzw. --bg-unten, Schimmer 12 bzw. 8 %, --card, --tx-2).
const AKZENT_BEZUG = {dunkel: ["#0b0d14", 0.12, 0.07, "#bcc1ca"], hell: ["#e8eaf0", 0.08, 0.66, "#3c414d"]};
// Dasselbe für die deckenden Stile (themen/<name>.css), Werte wie dort: ohne Glas (Deckkraft 0); Grundton hell die dunkelste, dunkel die hellste Fläche
// (Grund, Karte oder --pop), Schimmer = stärkste Tönung dieser Fläche mit dem Akzent (Flächig: Karte mit --frei, 20 % hell bzw. 18 % dunkel, aufgerundet). Die 14 % von --acc-bg kommen in akzentFlaeche dazu.
const STIL_BEZUG = {glas: AKZENT_BEZUG,
  flaechig: {dunkel: ["#1d1f24", 0.18, 0, "#bcc1ca"], hell: ["#fcfcff", 0.2, 0, "#3c414d"]},
  kompakt: {dunkel: ["#313134", 0, 0, "#bcc1ca"], hell: ["#f4f4f5", 0, 0, "#3c414d"]},
  klar: {dunkel: ["#181818", 0, 0, "#bcc1ca"], hell: ["#ffffff", 0, 0, "#3c414d"]},
  kraeftig: {dunkel: ["#2a2620", 0, 0, "#bcc1ca"], hell: ["#fff1d6", 0, 0, "#3c414d"]},
  terminal: {dunkel: ["#141a14", 0, 0, "#a3d6a3"], hell: ["#f6f4ec", 0, 0, "#3c414d"]}};   // Terminal dunkel mit eigener grüner --tx-2
// Seitengrund je Stil [hell, dunkel] wie --bg in grundlage.css bzw. themen/<name>.css: Statusleiste (theme-color) und Bezug der Bedienfarbe im Dunkeln.
const STIL_GRUND = {glas: [GRUND_HELL, GRUND_DUNKEL], flaechig: ["#f6f7fc", "#121318"], kompakt: ["#f4f4f5", "#1c1c1e"], klar: ["#ffffff", "#101010"], kraeftig: ["#fff1d6", "#1d1a14"], terminal: ["#f6f4ec", "#0a0d0a"]};
const AKZENT_TOENUNG = 0.14, AKZENT_ZIEL = 4.6, BEDIEN_ZIEL = 3.1;   // stärkste Tönung (--acc-bg); Ziele mit Zuschlag über WCAG 4,5 (Text) und 3 (Bedienelement)
const hexOk = h => /^#[0-9a-f]{6}$/i.test(String(h));
// Akzentfarbe als #rrggbb: ein Name aus AKZENTE oder ein Hex-Wert, sonst Blau.
const akzentFarbe = a => AKZENTE[a] || (hexOk(a) ? String(a).toLowerCase() : AKZENTE.blau);
// Relative Helligkeit einer #rrggbb-Farbe nach WCAG (0 = schwarz, 1 = weiß).
function leuchtdichte(c) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
// Kontrastverhältnis zweier Farben nach WCAG.
const kontrast = (a, b) => { const x = leuchtdichte(a), y = leuchtdichte(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
// Mischt Farbe c mit der Farbe „mit“; t ist der Anteil von „mit“ (0 bis 1).
const farbMix = (c, mit, t) => "#" + [1, 3, 5].map(i => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - t) + parseInt(mit.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0")).join("");
// Farbe schrittweise Richtung „zu“ (Schwarz oder Weiß) schieben, bis der Kontrast zur Gegenfarbe reicht
function lesbar(c, gegen, zu, ziel = 4.5) { let r = c; for (let t = 0.03; kontrast(r, gegen) < ziel && t <= 1; t += 0.03) r = farbMix(c, zu, t); return r; }
// Fläche für Knöpfe mit Schrift: die Akzentfarbe, so weit abgedunkelt (oder aufgehellt), dass die Schrift darauf lesbar ist
function knopfFarbe(c) { const weiss = schriftAufFarbe(c) === "#fff"; return lesbar(c, weiss ? "#ffffff" : "#111318", weiss ? "#000000" : "#ffffff"); }
const farbHell = c => leuchtdichte(c) > 0.75;                    // sehr helle Farben (z. B. Weiß) brauchen einen Rand, sonst verschwinden Symbol und Knöpfe
// Ungünstigste Fläche unter Akzent c: Glas über dem Grund mit Schimmer, darauf --tx-2 mit 14 %, mit und ohne 14 % Akzent; dunkel die hellere, hell die dunklere.
// Je Farbe gerechnet, damit auch jede eigene Farbe ihr Ziel erreicht (Z1); thema wählt den Bezug des Stils (STIL_BEZUG).
function akzentFlaeche(c, dunkel, thema = themaAktiv()) {
  const [grund, schimmer, glas, text2] = STIL_BEZUG[thema][dunkel ? "dunkel" : "hell"];
  const neutral = farbMix(farbMix(farbMix(grund, c, schimmer), "#ffffff", glas), text2, AKZENT_TOENUNG), getoent = farbMix(neutral, c, AKZENT_TOENUNG);
  return (leuchtdichte(getoent) > leuchtdichte(neutral)) === dunkel ? getoent : neutral;
}
// Akzent als Schrift (--acc-fg, F-AK1): 4,6:1 gegen die ungünstigste Fläche; sehr helle Farben hell und sehr dunkle dunkel bekommen feste Ersatzfarben.
function akzentSchrift(c, dunkel = istDunkel(), thema = themaAktiv()) {
  const L = leuchtdichte(c);
  if (!dunkel && L > 0.55) return "#2c2c2e";
  if (dunkel && L < 0.06) return "#e5e5ea";
  return lesbar(c, akzentFlaeche(c, dunkel, thema), dunkel ? "#ffffff" : "#000000", AKZENT_ZIEL);
}
// Akzent als Bedienelement (--acc-ui, F-AK2): Fokusring, Rand, Schalter; 3:1 gegen die ungünstigste Fläche und gegen den Grund des Stils (dunkel) bzw. Weiß (hell).
function akzentBedien(c, dunkel = istDunkel(), thema = themaAktiv()) {
  const zu = dunkel ? "#ffffff" : "#000000";
  return lesbar(lesbar(c, akzentFlaeche(c, dunkel, thema), zu, BEDIEN_ZIEL), dunkel ? STIL_GRUND[thema][1] : "#ffffff", zu, BEDIEN_ZIEL);
}
// Rand des Hauptknopfs: sehr helle Farben dunkel umrandet; im Dunkeln wie die Fläche (der rohe Akzent wirkte dort wie ein Fehler-Ring), hell der Akzent.
const akzentRand = (c, dunkel) => farbHell(c) ? "color-mix(in srgb, #000 28%, transparent)" : dunkel ? knopfFarbe(c) : c;
function schriftAufFarbe(c) {                                   // helle Farben bekommen dunkle Schrift, damit Knöpfe lesbar bleiben
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111318" : "#fff";
}
const weitMq = window.matchMedia("(min-width: 900px)");
const GLAS_SCHWACH = 4;                                         // Kerne bzw. GB Speicher: „Automatisch“ schaltet das Glas darunter ab (Unschärfe kostet schwache Geräte Bildrate)
// Glaseffekt aus? „an“ und „aus“ fest, „auto“ nach Gerät: aus bei höchstens GLAS_SCHWACH Kernen oder GB. „Transparenz reduzieren“ des Systems schaltet es im CSS immer ab.
function glasAus(wahl, nav = navigator) {
  return wahl === "aus" || (wahl === "auto" && ((nav.hardwareConcurrency || Infinity) <= GLAS_SCHWACH || (nav.deviceMemory || Infinity) <= GLAS_SCHWACH));
}
// Stile (Themen) je Gerät: Name an :root (data-thema) und sichtbarer Name; die Werte stehen in themen/<name>.css, „glas“ ist grundlage.css selbst.
const THEMEN = {glas: "Glas", flaechig: "Flächig", kompakt: "Kompakt", klar: "Klar", kraeftig: "Kräftig", terminal: "Terminal"}, THEMA_VORGABE = "glas";
// Gespeicherter Stil oder „glas“, wenn er fehlt oder unbekannt ist (hasOwn: Namen wie „toString“ zählen nicht).
const themaWahl = w => Object.hasOwn(THEMEN, w) ? w : THEMA_VORGABE;
// Stil dieses Geräts (nur im Gerät gespeichert, nicht im Profil und nicht in der Synchronisierung).
const themaAktiv = () => themaWahl(speicher.l("ho_thema", THEMA_VORGABE));
// System wechselt Hell/Dunkel: bei „Automatisch“ Farben neu rechnen und die Seite neu zeichnen (wie farbeUmschalten, F-AK3)
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (speicher.l("ho_farbe", FARBE_VORGABE) === "auto") { darstellung(); seitenCacheLeeren(); zeigen(); } });
// Wendet die gespeicherten Einstellungen an: Design (Web oder Handy), Stil, Hell oder Dunkel, Glaseffekt, Akzentfarbe (CSS-Variablen, Cookie für die Exporte, App-Symbol)
// und den Platz der Schnell-Symbole.
function darstellung() {
  const d = speicher.l("ho_design", "auto"), f = speicher.l("ho_farbe", FARBE_VORGABE), a = speicher.l("ho_akzent", "blau"), dunkel = istDunkel();
  document.body.dataset.design = d === "auto" ? (weitMq.matches ? "web" : "handy") : d;
  if (!zeitDaneben()) zeitDanebenZu();
  const thema = themaAktiv();
  document.documentElement.dataset.thema = thema;
  // die anderen Stile sind deckend
  if (thema !== THEMA_VORGABE || glasAus(speicher.l("ho_glas", "auto"))) document.documentElement.dataset.glas = "aus"; else document.documentElement.removeAttribute("data-glas");
  if (f === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = f === "dunkel" ? "dark" : "light";
  const c = akzentFarbe(a);
  document.documentElement.style.setProperty("--acc", c);
  document.documentElement.style.setProperty("--acc-t", schriftAufFarbe(c));
  document.documentElement.style.setProperty("--acc-k", knopfFarbe(c));
  document.documentElement.style.setProperty("--acc-fg", akzentSchrift(c, dunkel, thema));
  document.documentElement.style.setProperty("--acc-ui", akzentBedien(c, dunkel, thema));
  document.documentElement.style.setProperty("--acc-rand", akzentRand(c, dunkel));
  document.documentElement.style.setProperty("--acc-bg", `color-mix(in srgb, ${c} 14%, var(--card))`);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = STIL_GRUND[thema][dunkel ? 1 : 0];   // Statusleiste in der Grundfarbe des Stils, nicht im Akzent
  document.cookie = KEKS + "ho_akzent_hex=" + c.replace("#", "") + "; path=" + ORT + "; SameSite=Lax; max-age=31536000" + COOKIE_SICHER;      // der Server färbt damit die Exportdateien
  symbolFarbe(c);
  // Schnell-Symbole: im Web-Design (Rechner) links unter dem Logo, am Handy oben in der Leiste vor dem Menü (Wunsch vom 17.11.2026)
  schnellSymbole();
  const fk = $("#farb-knopf");
  if (fk) { fk.innerHTML = sym(dunkel ? "sonne" : "mond"); fk.title = dunkel ? "Helle Darstellung" : "Dunkle Darstellung"; fk.setAttribute("aria-label", fk.title); }
}
// Symbolleiste: Hell/Dunkel mit einem Tipp (Wunsch vom 17.11.2026). „Automatisch“ wird dabei zu einer festen Farbe, umstellen geht unter „Einstellungen → Aussehen“.
function istDunkel() { const f = speicher.l("ho_farbe", FARBE_VORGABE); return f === "dunkel" || (f === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches); }
// Wechselt mit einem Tipp zwischen Hell und Dunkel und zeichnet die Seite neu.
function farbeUmschalten() { speicher.s("ho_farbe", istDunkel() ? "hell" : "dunkel"); darstellung(); seitenCacheLeeren(); zeigen(); }
// App-Symbol (Stoppuhr) auf der Fläche c: Logo, Tab-Symbol und Symbol für den Home-Bildschirm
function symbolSvg(c) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180"><rect width="180" height="180" rx="40" fill="${c}"/><rect x="77" y="26" width="26" height="11" rx="4" fill="#fff"/><rect x="85" y="36" width="10" height="12" fill="#fff"/><circle cx="90" cy="102" r="48" fill="none" stroke="#fff" stroke-width="10"/><path d="M90 102V72" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="M90 102l17 12" stroke="#fff" stroke-width="10" stroke-linecap="round"/><path d="M131 61l9-9" stroke="#fff" stroke-width="9" stroke-linecap="round"/></svg>`;
}
function symbolRand(svg, c) {                                   // heller Hintergrund: dünner dunkler Rand um das Symbol
  return farbHell(c) ? svg.replace("</svg>", '<rect x="2" y="2" width="176" height="176" rx="38" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="4"/></svg>') : svg;
}
// Zeichnet das App-Symbol auf der Knopf-Fläche des Akzents (knopfFarbe), die Uhr in der Schrift auf dem Akzent (schriftAufFarbe wie bei Knöpfen), und setzt es
// als Logo, Tab-Symbol und Symbol für den Home-Bildschirm (PNG über ein Canvas). Knopf-Fläche statt rohem Akzent: bei Gold, Cyan und Türkis hatte die weiße Uhr unter 3:1.
function symbolFarbe(c) {
  try {
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(symbolRand(symbolSvg(knopfFarbe(c)).replace(/(["'])#fff\1/g, `$1${schriftAufFarbe(c)}$1`), knopfFarbe(c)));
    const logo = document.querySelector(".marke img"); if (logo) logo.src = url;
    const fav = document.querySelector('link[rel=icon]'); if (fav) fav.href = url;
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement("canvas"); cv.width = cv.height = 180; cv.getContext("2d").drawImage(img, 0, 0, 180, 180);
        const ap = document.querySelector('link[rel=apple-touch-icon]'); if (ap) ap.href = cv.toDataURL("image/png");
      } catch (e) {}
    };
    img.src = url;
  } catch (e) {}
}
// ---- Zahlenfeld mit − und + (statt der eckigen Browser-Pfeile)
function stepper(id, wert, schritt, min, name = "") {
  return `<span class="stepper"><button type="button" ${kl("schritt", String(id), -(schritt), min)} aria-label="weniger">−</button><input id="${id}" type="number" inputmode="decimal" step="${schritt}" min="${min}" value="${wert}"${name ? ` aria-label="${esc(name)}"` : ""}><button type="button" ${kl("schritt", String(id), schritt, min)} aria-label="mehr">+</button></span>`;
}
// Ändert ein Zahlenfeld um d (nicht unter min, auf zwei Stellen gerundet) und meldet die Änderung wie eine Eingabe.
function schritt(id, d, min) {
  const e = document.getElementById(id), v = Math.max(min, Math.round(((parseFloat(String(e.value).replace(",", ".")) || 0) + d) * 100) / 100);
  e.value = v; e.dispatchEvent(new Event("input", {bubbles: true}));
}

// ---- Verschlüsselte Sicherung der Handy-App und der eigenständigen Web-App (HO_PLATTFORM=android|browser; die Web-App auf einem Server hat diese Karte nicht)
const HANDY_ZIEL = {drive: "Google Drive", lokal: "Ordner auf diesem Gerät", browser: "Speicher dieser App im Browser"};
// Zeitpunkt auf Deutsch (TT.MM.JJJJ, hh:mm) oder „noch nie“.
const zeitpunktText = t => t ? new Date(t).toLocaleString("de-DE", {day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"}) : "noch nie";
// ---- Sync mit anderen Geräten (nur in den lokalen Fassungen: Desktop, Android, iPhone)
async function syncKarte(stand, hinweis) {
  const box = $("#sync-karte"); if (!box) return;
  let s = mitAblageFehler(stand);
  try { s = mitAblageFehler(s || await api("GET", "/abgleich")); }
  catch (e) { box.innerHTML = `<div class="card"><h2>Mit anderen Geräten synchronisieren</h2>${meldung(e.message)}</div>`; return; }
  if (!$("#sync-karte")) return;
  syncSymbol(s);
  if (!SYNC_ALLE && syncFuehren(s)) { syncFuehrungZeigen($("#sync-karte"), s); return; }   // noch nichts eingerichtet: geführt (M6)
  const l = s.letzter, fern = !!s.fern, desktop = s.plattform === "desktop" && !fern, browser = s.plattform === "browser", server = s.plattform === "server", bereit = syncEingerichtet(s) && s.passwort, anm = s.server_anmeldung || {};
  KONFLIKTE = s.konflikte.length;
  const letzter = !l ? "noch nie" : zeitpunktText(l.zeit);   // „fehlgeschlagen“ steht in der Beschriftung: Datum und Wort zusammen sprengten bei 375 px die Zeile
  // Einzahl- oder Mehrzahl-Text zu einer Anzahl.
  const zahl = (n, eins, viele) => n === 1 ? eins : `${n} ${viele}`;
  // Knopf für eine Seite („hier“ oder „dort“) eines Konflikts; der neuere Eintrag ist hervorgehoben.
  const seite = (k, wo, name) => `<button type="button" class="${k.neuer === wo ? "prim" : ""}" ${kl("syncWahl", k.art, k.schluessel, wo)}>${name}: ${esc(k[wo].text)}<br><small>${k[wo].zeit ? "geändert " + esc(zeitText(k[wo].zeit)) : "ohne Zeitangabe"}${k.neuer === wo ? " · neuer" : ""}</small></button>`;
  const konflikte = s.konflikte.map(k => `<div class="konflikt"><b>${esc(k.titel)}</b><div class="knoepfe">${seite(k, "hier", "Dieses Gerät")}${seite(k, "dort", "Anderes Gerät")}</div></div>`).join("");
  $("#sync-karte").innerHTML = `<div class="gitter paar"><div class="card"><h2>Mit anderen Geräten synchronisieren</h2>
      ${wegeHtml(PERSON ? "anmeldedienst" : fern ? "fern" : browser && NETZ ? "netz" : s.plattform)}
      ${fern ? "" : server ? `<p class="hinweis" data-stil="margin-top:0">Handy und Desktop legen ihre Einträge verschlüsselt hier ab. Mit dem Passwort synchronisiert auch diese Seite selbst und zeigt dann denselben Stand wie die Geräte.</p>
      ${window.isSecureContext ? `<div class="zeile"><span>Web-App fürs Handy (läuft auch ohne Verbindung)</span><a class="btn" href="mobil/">Öffnen</a></div>`
        : `<p class="hinweis"><b>Web-App fürs Handy:</b> Sie braucht eine https-Adresse, der das Handy vertraut. Diese Seite ist über http geöffnet (zum Beispiel mit IP und Port). So geht es trotzdem: am iPhone diese Seite hier benutzen (mit Verbindung, auch über VPN) und zum Home-Bildschirm hinzufügen. Die Android-App und die Windows-App synchronisieren auch über IP und Port und laufen ohne Verbindung weiter.</p>`}` : browser && NETZ ? `<p class="hinweis" data-stil="margin-top:0">Diese App synchronisiert von selbst mit dem Server, von dem sie kommt: beim Öffnen, beim Zurückkehren in die App, alle 15 Minuten und mit „Jetzt synchronisieren“. Ohne Verbindung arbeitest du normal weiter, die Synchronisierung holt es später nach.</p>` : browser ? `<p class="hinweis" data-stil="margin-top:0">Hält dieses Gerät und deine anderen Geräte auf demselben Stand. Die Web-App kann nicht selbst in einen Cloud-Ordner schreiben. Deshalb tauschst du die verschlüsselten Sync-Dateien von Hand aus:</p>
      <ol class="hinweis"><li>„Jetzt synchronisieren“ wählen, dann „Meine Sync-Datei speichern“ und die Datei in den Sync-Ordner der anderen Geräte legen (zum Beispiel in iCloud Drive; eine ältere Datei ersetzen).</li>
      <li>Aus demselben Ordner die Datei des anderen Geräts wählen („Datei eines anderen Geräts einlesen“).</li></ol>` : `<p class="hinweis" data-stil="margin-top:0">Hält Handy und Desktop auf demselben Stand: Jedes Gerät legt seine Einträge verschlüsselt in denselben Cloud-Ordner und liest die der anderen. Dafür braucht es keinen eigenen Server und keinen fremden Dienst.</p>
      <div class="zeile"><span>Ordner</span><b>${s.ziel.eingerichtet ? esc(HANDY_ZIEL[s.ziel.art]) : "nicht eingerichtet"}</b></div>`}
      ${desktop ? `<label for="sync-ordner">Ordner für die Synchronisierung (ganzer Pfad, zum Beispiel der Ordner „Zeiterfassung“ in iCloud Drive oder Google Drive)</label><input type="text" id="sync-ordner" autocomplete="off" spellcheck="false" value="${esc(s.ordner || "")}">
      <div class="knoepfe"><button ${kl("syncOrdner")}>Ordner speichern</button></div>` : ""}
      ${desktop || s.plattform === "android" ? `<label for="sync-server">Eigener Server als Speicherort (optional): Adresse der Zeiterfassung im Heimnetz, so wie im Browser. Geht auch mit IP und Port, auch über VPN.</label><input type="url" id="sync-server" autocomplete="off" spellcheck="false" placeholder="Adresse wie im Browser" value="${esc(s.server || "")}">
      ${desktop || s.plattform === "android" ? `<label for="sync-s-benutzer">Benutzername (nur bei einem Server mit Anmeldung)</label><input type="text" id="sync-s-benutzer" autocomplete="username" autocapitalize="none" spellcheck="false">
      <label for="sync-s-passwort">Passwort beim Server (wird nicht gespeichert)</label><input type="password" id="sync-s-passwort" autocomplete="current-password">` : ""}
      <div class="knoepfe"><button ${kl("syncServer")}>Adresse speichern</button></div>
      ${anm.angemeldet ? `<div class="zeile"><span>Beim Server angemeldet als Gerät<br><small>${esc(s.server_anmeldung.geraet)}</small></span><button type="button" ${kl("syncServerAbmelden")}>Abmelden</button></div>` : ""}
      ${anm.fehler ? meldung(SERVER_ANMELDUNG_FEHLER[anm.fehler] || SERVER_ANMELDUNG_FEHLER.anmeldung) : ""}
      <div class="zeile"><span>Dieses Gerät als Speicherort<br><small>ohne eigenen Server und ohne Cloud: Die anderen Geräte im selben WLAN oder VPN synchronisieren direkt mit diesem, solange die App hier läuft</small></span><input type="checkbox" ${s.freigabe ? "checked" : ""} data-wechsel="syncFreigabe" aria-label="Dieses Gerät als Speicherort"></div>
      ${s.freigabe_pausiert ? `<p class="hinweis">${SYNC_PAUSIERT}</p>` : ""}
      ${s.freigabe ? `<p class="hinweis">Auf den anderen Geräten unter „Eigener Server als Speicherort“ eintragen: <b>${s.freigabe_adressen.map(esc).join("</b> oder <b>") || "die IP-Adresse dieses Geräts mit :8793"}</b> (die IP, kein Gerätename). Erreichbar ist nur die Ablage der verschlüsselten Sync-Dateien, nicht die App. ${SYNC_IM_NETZ} Fragt Windows nach dem Netzzugriff: für private Netze erlauben.</p>` : ""}` : ""}
      ${desktop ? `<div class="zeile"><span>Diese Zeiterfassung am iPhone oder iPad bedienen<br><small>ohne Server und ohne Synchronisierung: Das Handy öffnet im selben WLAN oder VPN die Oberfläche dieses Rechners, solange die App hier läuft</small></span><input type="checkbox" ${s.oberflaeche ? "checked" : ""} data-wechsel="syncOberflaeche" aria-label="Diese Zeiterfassung am iPhone oder iPad bedienen"></div>
      ${s.oberflaeche ? (s.oberflaeche.qr ? `<div class="koppel-qr">${s.oberflaeche.qr}</div><p class="hinweis">Am Handy die Kamera auf den Code halten und den Link öffnen (iPhone: Safari). Als Lesezeichen sichern oder über Teilen → „Zum Home-Bildschirm“ ablegen. Das Handy zeigt und ändert dann die Daten dieses Rechners. <b>Den Code niemandem zeigen:</b> Wer ihn hat, kann im selben Netz deine Zeiten lesen und ändern. Die Verbindung ist nicht verschlüsselt, deshalb nur im eigenen WLAN oder VPN nutzen. Aus- und wieder Einschalten macht den alten Code ungültig. Am Handy gilt der Zugang 30 Tage, danach den Code noch einmal scannen. Fragt Windows nach dem Netzzugriff: für private Netze erlauben.</p>` : `<p class="hinweis">Dieser Rechner ist gerade in keinem Netz. Bitte WLAN oder Netzwerkkabel prüfen.</p>`) : ""}` : ""}
      ${fern || !modulAn("github") ? "" : `<h3>GitHub als Speicherort</h3>${s.github ? `<div class="zeile"><span>Verbunden mit<br><small>${s.github.privat ? "privates Repo" : "öffentliches Repo"}</small></span><b>${esc(s.github.repo)}</b></div>
      ${s.github.privat ? "" : `<p class="hinweis"><b>Dieses Repo ist öffentlich.</b> Deine Sync-Dateien sind verschlüsselt, aber jeder kann sie abrufen. Sicherer ist ein privates Repo.</p>`}
      <div class="knoepfe"><button type="button" ${kl("syncGithubTrennen")}>Verbindung trennen</button></div>` : `<p class="hinweis" data-stil="margin-top:0">Von überall erreichbar, ohne eigenen Server und ohne VPN: Jedes Gerät legt seine Einträge verschlüsselt in ein eigenes Repo bei GitHub (privat oder öffentlich). So richtest du es ein:</p>
      <ol class="hinweis"><li>Bei GitHub ein leeres Repo nur für die Synchronisierung anlegen, am besten privat.</li><li>Unter Settings → Developer settings → Fine-grained tokens ein Token anlegen: nur für dieses Repo, Berechtigung „Contents: Read and write“.</li><li>Repo und Token hier eintragen. Weitere Geräte bekommen beides beim Koppeln per Code von selbst.</li></ol>
      <label for="sync-gh-repo">Repo (konto/name)</label><input type="text" id="sync-gh-repo" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="konto/name">
      <label for="sync-gh-token">Token</label><input type="password" id="sync-gh-token" autocomplete="off">
      <div class="knoepfe"><button type="button" ${kl("syncGithub")}>Mit GitHub verbinden</button></div>`}`}
      <div class="zeile"><span>Geräte in der Synchronisierung<br><small>dieses mitgezählt${s.geraete_weg ? `, ${zahl(s.geraete_weg, "ein Gerät hat", "Geräte haben")} sich abgemeldet` : ""}</small></span><b>${s.geraete_aktiv}</b></div>
      <div class="zeile"><span class="bez">Letzte Synchronisierung${l && l.ok ? `<small>${zahl(l.geraete, "ein anderes Gerät", "andere Geräte")} gelesen, ${zahl(l.uebernommen, "eine Änderung", "Änderungen")} übernommen</small>` : l ? "<small>fehlgeschlagen</small>" : ""}</span><b>${esc(letzter)}</b></div>
      ${l && !l.ok ? meldung(l.fehler) : ""}
      ${l && l.uebersprungen ? `<p class="hinweis">${uebersprungenText(l.uebersprungen)}</p>` : ""}
      ${!l && !fern ? `<p class="hinweis"><b>Vor der ersten Synchronisierung:</b> Einträge, die nur auf einem Gerät stehen, kommen ohne Rückfrage auf alle anderen. Gefragt wirst du nur, wenn derselbe Tag auf zwei Geräten verschieden ist. Deshalb vorher auf jedem Gerät nachsehen, ob dort nur echte Einträge stehen.</p>` : ""}
      ${l && l.gesperrt ? `<p class="hinweis"><b>Ein anderes Gerät wartet:</b> Um seine Einträge zu lesen, hier einmal das Passwort eingeben (dasselbe wie dort).</p>` : ""}
      ${fern ? "" : s.passwort ? `<label for="sync-pw">Passwort (nur nötig, wenn ein neues Gerät dazukommt)</label><input type="password" id="sync-pw" autocomplete="current-password">${desktop || server ? `
      <details class="auf"><summary>Passwort neu festlegen (auch wenn das alte vergessen ist)</summary>
      <p class="hinweis">Das neue Passwort gilt ab sofort für Synchronisierung und neue Sicherungen. Danach auf jedem anderen Gerät dasselbe neue Passwort festlegen. Ältere Sicherungen öffnet weiter nur das alte Passwort. Deine Einträge bleiben unberührt.</p>
      <label for="sync-pw1">Neues Passwort (mindestens 8 Zeichen)</label><input type="password" id="sync-pw1" autocomplete="current-password">
      <label for="sync-pw2">Neues Passwort wiederholen</label><input type="password" id="sync-pw2" autocomplete="current-password">
      <div class="knoepfe"><button ${kl("syncPasswort")}>Neues Passwort festlegen</button></div></details>` : ""}` : desktop || server ? `<label for="sync-pw1">Passwort für Synchronisierung und Sicherung (mindestens 8 Zeichen, auf allen Geräten dasselbe)</label><input type="password" id="sync-pw1" autocomplete="current-password">
      <label for="sync-pw2">Passwort wiederholen</label><input type="password" id="sync-pw2" autocomplete="current-password">
      <div class="knoepfe"><button ${kl("syncPasswort")}>Passwort festlegen</button></div>
      <p class="hinweis"><b>Ohne dieses Passwort sind die ${server ? "Dateien am Speicherort" : "Dateien im Cloud-Ordner"} nicht lesbar.</b> Es wird nirgends gespeichert. Ein vergessenes Passwort kann niemand auslesen. Du kannst aber jederzeit ein neues festlegen; ältere Sicherungen öffnet weiter nur das alte.</p>` : `<p class="hinweis">Erst oben unter „Passwort der Sicherung“ ein Passwort festlegen. Auf allen Geräten dasselbe Passwort verwenden.</p>`}
      ${server || browser || fern || !modulAn("koppeln") ? "" : `<h3>Geräte koppeln (ohne Adresse und Passwort zu tippen)</h3>
      <p class="hinweis" data-stil="margin-top:0">Beide Geräte müssen im selben WLAN oder VPN sein. Auf dem einen Gerät „Code anzeigen“, auf dem anderen den Code eingeben. Danach synchronisieren beide von selbst miteinander, in beide Richtungen. ${SYNC_IM_NETZ}</p>
      ${s.kopplung ? `<div class="koppel-qr">${s.kopplung.qr}</div><p class="koppel-code" aria-label="Kopplungs-Code">${esc(s.kopplung.code)}</p><p class="hinweis">Diesen Code am anderen Gerät scannen (Android-App: „QR-Code scannen“) oder eingeben. Er gilt noch ${Math.ceil(s.kopplung.sekunden / 60)} Minuten und für genau ein Gerät.</p>` : ""}
      <div class="knoepfe"><button type="button" ${kl("syncKoppeln")}${s.passwort ? "" : " disabled"}>${s.kopplung ? "Neuen Code anzeigen" : "Code anzeigen"}</button></div>
      ${s.passwort ? "" : `<p class="hinweis">Zum Anzeigen eines Codes erst ein Passwort festlegen. Zum Eingeben eines Codes ist keines nötig.</p>`}
      <label for="sync-code">Code vom anderen Gerät</label><input type="text" id="sync-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="24">
      <div class="knoepfe"><button type="button" ${kl("syncKoppelnAnnehmen")}>Koppeln</button>${s.plattform === "android" ? `<button type="button" ${kl("syncScannen")}>QR-Code scannen</button>` : ""}</div>
      <video id="sync-video" class="koppel-video" playsinline muted hidden></video>`}
      ${fern ? "" : `<div class="zeile"><span>Automatisch synchronisieren<br><small>nach jeder Änderung, beim Öffnen und alle 15 Minuten${browser ? ", solange die App offen ist. Aus: nur mit „Jetzt synchronisieren“" : ""}</small></span><input type="checkbox" ${(browser ? autoLokal() : s.auto) ? "checked" : ""}${bereit || browser ? "" : " disabled"} data-wechsel="syncAuto" aria-label="Automatisch synchronisieren"></div>`}
      <div class="knoepfe"><button class="prim" ${kl("syncJetzt")}${bereit ? "" : " disabled"}>Jetzt synchronisieren</button>
        ${browser && bereit && l && l.ok ? `<a class="btn" href="api/abgleich/datei">Meine Sync-Datei speichern</a>` : ""}
        ${browser && bereit ? `<button type="button" ${kl("syncDateiWaehlen")}>Datei eines anderen Geräts einlesen</button><input type="file" id="sync-datei" accept=".zsich,application/octet-stream" hidden data-wechsel="syncEinlesen">` : ""}</div>
      <div id="sync-meldung" role="status">${hinweis ? `<p class="hinweis">${esc(hinweis)}</p>` : ""}</div></div>
    <div class="card"><h2>Konflikte${s.konflikte.length ? ` (${s.konflikte.length})` : ""}</h2>
      ${konflikte ? `<p class="hinweis" data-stil="margin-top:0">Diese Einträge wurden auf zwei Geräten verschieden geändert. Bis du entscheidest, gilt hier der Eintrag dieses Geräts. Die App überschreibt nichts von selbst.</p>${konflikte}
      <label>Alle auf einmal</label><div class="knoepfe"><button ${kl("syncAlle", "hier")}>Überall dieses Gerät</button><button ${kl("syncAlle", "dort")}>Überall das andere Gerät</button></div>` : `<p class="hinweis" data-stil="margin-top:0">Keine. Wird derselbe Tag auf zwei Geräten verschieden geändert, erscheint er hier, und du entscheidest, welcher Eintrag gilt.</p>`}
      <div id="sync-k-meldung"></div></div></div>`;
  beschriften($("#sync-karte"));
}
// Welche Wege zum Sync es in dieser Fassung gibt (und nur diese): je Fassung eine kurze Liste oben in der Karte
const WEGE = {
  desktop: ["<b>Per Code</b> mit der Android-App oder einem anderen Rechner (Windows) im selben WLAN oder VPN", "<b>Cloud-Ordner</b>, den alle Geräte sehen (zum Beispiel iCloud Drive, Google Drive, OneDrive)", "<b>Eigener Server</b> als Speicherort (auch für iPhone und iPad mit der Web-App)", "<b>Dieses Gerät als Speicherort</b> für die anderen im selben WLAN oder VPN (Schalter unten)", "<b>iPhone und iPad ohne Server:</b> Synchronisierung über GitHub, oder das Handy bedient diese Zeiterfassung im WLAN (Schalter unten)"],
  android: ["<b>Per Code oder QR-Code</b> mit einem Rechner (Windows) oder einem anderen Android-Handy im selben WLAN oder VPN", "<b>Cloud-Ordner</b>, den alle Geräte sehen (zum Beispiel Google Drive)", "<b>Eigener Server</b> als Speicherort", "<b>Dieses Gerät als Speicherort</b> für die anderen im selben WLAN oder VPN (Schalter unten)"],
  netz: ["<b>Von selbst mit dem Server</b>, von dem diese App kommt. Über ihn bleiben auch die Desktop-App und die Android-App auf demselben Stand, wenn dort seine Adresse eingetragen ist"],
  browser: ["<b>Sync-Dateien von Hand</b> austauschen, zum Beispiel über iCloud Drive"],
  server: ["<b>Dieser Server ist der Speicherort:</b> Desktop-App, Android-App und die Web-App fürs Handy synchronisieren über ihn"],
  fern: [],
  anmeldedienst: ["<b>Desktop-App und Android-App</b> synchronisieren mit diesem Server: dort unter „Synchronisieren“ Adresse, Benutzername und Passwort eintragen. Die Geräte stehen unter „Einstellungen → Meine Geräte“", "<b>iPhone und iPad</b>: in Safari die Adresse dieses Servers mit <b>/mobil/</b> am Ende öffnen, anmelden und „Zum Home-Bildschirm“ wählen. Diese Web-App synchronisiert über diesen Server"],
};
const WEGE_NICHT = {netz: "Direkt mit der Desktop-App oder per Code geht es in der Web-App nicht: Der Browser lässt das nicht zu.", browser: "Per Code, Cloud-Ordner oder direkt mit der Desktop-App geht es in der Web-App nicht: Der Browser lässt das nicht zu.",
  fern: "Du bedienst hier die Zeiterfassung auf deinem Rechner. Alles, was du einträgst, steht sofort dort: Es gibt nichts zu synchronisieren. Die Synchronisierung mit weiteren Geräten richtest du am Rechner ein."};
const WEG_GITHUB = "<b>GitHub</b>: ein eigenes Repo (privat oder öffentlich) als Speicherort, von überall erreichbar";
// Zeigt die Wege zum Sync, die diese Fassung wirklich hat (WEGE, GitHub nur bei eingeschaltetem Modul), und was in ihr nicht geht.
function wegeHtml(art) {
  const wege = art === "fern" ? [] : [...(WEGE[art] || []), ...(modulAn("github") ? [WEG_GITHUB] : [])];
  return `${wege.length ? `<p class="hinweis" data-stil="margin-top:0"><b>So synchronisiert diese Fassung:</b></p><ul class="hinweis">${wege.map(w => `<li>${w}</li>`).join("")}</ul>` : ""}${WEGE_NICHT[art] ? `<p class="hinweis"${wege.length ? "" : ` data-stil="margin-top:0"`}>${WEGE_NICHT[art]}</p>` : ""}`;
}
// Schnell-Symbole: im Web-Design (Rechner) links unter dem Logo, am Handy oben in der Leiste vor dem Menü (Wunsch vom 17.11.2026)
function schnellSymbole() {
  const web = document.body.dataset.design === "web", ziel = web ? $("#schnell") : $(".kopfleiste");
  if (ziel) for (const id of ["sync-symbol", "farb-knopf", "zu-heute", "abmelden-knopf"]) { const k = $("#" + id); if (k && k.parentNode !== ziel) web ? ziel.append(k) : ziel.insertBefore(k, $("#menue")); }
}
// Desktop-Fassung: in welchem Browser das Fenster der App aufgeht. erstesMal: Frage auf der Übersicht, solange nichts gewählt ist und es eine Wahl gibt.
async function browserWahlHtml(erstesMal) {
  let b;
  try { b = await api("GET", "/desktop/browser"); } catch (e) { return ""; }
  if (!b.desktop || (erstesMal && (b.wahl || b.vorhanden.length < 2))) return "";
  const namen = {edge: "Microsoft Edge", chrome: "Google Chrome", firefox: "Firefox", standard: "Standardbrowser (als Tab)"};
  return `<div class="card"><h2>${erstesMal ? "Welchen Browser bevorzugst du?" : "Browser für das Fenster der App"}</h2>
    <p class="hinweis" data-stil="margin-top:0">Die App zeigt ihr Fenster in einem Browser, der auf diesem Gerät installiert ist. Edge und Chrome öffnen ein eigenes Fenster ohne Adresszeile, Firefox ein gewöhnliches Fenster. Die Wahl gilt ab dem nächsten Start${erstesMal ? " und lässt sich später unter „Einstellungen → Aussehen“ ändern" : ""}.</p>
    <div class="knoepfe">${[...b.vorhanden, "standard"].map(k => `<button type="button" class="${b.wahl === k ? "prim" : ""}" ${kl("browserWaehlen", k)}>${namen[k]}</button>`).join("")}</div></div>`;
}
// Speichert, in welchem Browser das Fenster der Desktop-App aufgeht.
async function browserWaehlen(k) {
  try { await api("PUT", "/desktop/browser", {wahl: k}); } catch (e) { toastFehler(e.message); return; }
  seitenCacheLeeren(); toast("Gespeichert. Gilt ab dem nächsten Start der App."); zeigen();
}
// Band „Seit … Tagen nicht gesichert“ mit Knopf zur Sicherung.
function sichernBand() {
  if (!sichernFaellig() || seitenName() === "sicherung" || !modulAn("sicherung")) return "";
  if (seitenName() === "start" && ZUTUN_IDS.some(id => String(id).startsWith("sicherung-"))) return "";   // auf der Übersicht sagt es die Karte „Zu tun“
  const tage = tageSeitSicherung();
  return `<div class="demo-band" role="status"><span><b>${tage === null ? "Noch nie gesichert" : `Seit ${tage} Tagen nicht gesichert`}</b> · Deine Daten liegen nur auf diesem Gerät</span><a class="btn" href="#/sicherung">Jetzt sichern</a></div>`;
}
// iPhone und iPad: Nur als App vom Home-Bildschirm behält das Gerät die Daten auf Dauer; im Safari-Tab löscht es sie nach einigen Wochen ohne Besuch.
function heimBand() {
  if (PLATTFORM !== "browser" || alsApp() || !/iPhone|iPad|iPod/.test(navigator.userAgent) && !(/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)) return "";
  return `<div class="demo-band" role="status"><span><b>Als App ablegen</b> · Teilen-Symbol, dann „Zum Home-Bildschirm“. Erst dort eintragen: Die App hat einen eigenen Speicher, und nur ihn behält das Gerät auf Dauer.</span></div>`;
}
// Hinweisbänder über jeder Seite: Demo, „Als App ablegen“, Sicherung fällig, neue Version, Konflikte.
function baender() {
  return demoBanner() + heimBand() + sichernBand()
    + (NEUE_VERSION ? `<div class="demo-band"><span><b>Neue Version</b> · In diesem Fenster läuft noch die alte Oberfläche</span><button ${kl("neuLaden")}>Neu laden</button></div>` : "")
    + (KONFLIKTE && seitenName() !== "sync" ? `<div class="demo-band"><span><b>${KONFLIKTE === 1 ? "Ein Konflikt" : KONFLIKTE + " Konflikte"} nach der Synchronisierung</b> · auf zwei Geräten verschieden geändert</span><a class="btn" href="#/sync">Entscheiden</a></div>` : "");
}
// ---- Rundgang (funktionen.md 6.2): fünf kurze Seiten im Blatt, nach der Einrichtung und unter Hilfe („Rundgang starten“); in der Grundlage, weil
// Übersicht und Hilfe ihn öffnen. Seiten zu abgeschalteten Modulen und ohne Homeoffice fallen weg.
const RUNDGANG_SEITEN = [
  {titel: "Übersicht und Plus-Taste", text: () => `Die Übersicht zeigt heute, Gleitzeit, Urlaub und was zu tun ist auf einen Blick. ${modulAn("stempel") ? "Mit der Plus-Taste startest und beendest du die Stempeluhr." : "Mit der Plus-Taste trägst du den heutigen Tag ein."}`},
  {titel: "Zeit", text: () => "Unter Zeit siehst du Tag, Woche und Monat. Tippe auf einen Tag, um ihn einzutragen oder zu ändern."},
  {titel: "Homeoffice", text: () => "Hier stehen deine Homeoffice-Quote und die Jahresübersicht. Mit Grenze zeigt der Spielraum, wie viel Homeoffice noch geht.", nur: () => hoModus() !== "kein"},
  {titel: "Abwesenheit und Auswertung", text: () => "Unter Abwesenheit planst du Urlaub und trägst Krankheit ein. Unter Auswertung findest du Export und Nachweise."},
  {titel: "Daten, Einstellungen, Hilfe", text: () => `Unter Daten sicherst du deine Einträge${modulAn("abgleich") ? " und richtest die Synchronisierung ein" : ""}. In den Einstellungen stehen Regeln, Aussehen und Module. Die Hilfe erklärt alles ausführlich.`},
];
// Seiten des Rundgangs für die Regeln dieser Person: [{titel, text}].
function rundgangSeiten() {
  return RUNDGANG_SEITEN.filter(s => !s.nur || s.nur()).map(s => ({titel: s.titel, text: s.text()}));
}
// Zeigt Seite i des Rundgangs im Blatt (Zurück, Weiter, Beenden; Esc beendet wie jedes Blatt), Fokus auf die Überschrift.
function rundgang(i) {
  const seiten = rundgangSeiten(), s = seiten[i];
  blatt(`<h3 tabindex="-1">${s.titel}</h3><p class="hinweis">Seite ${i + 1} von ${seiten.length}</p><p>${s.text}</p>
    <div class="knoepfe">${i > 0 ? `<button ${kl("rundgang", i - 1)}>Zurück</button>` : ""}${i < seiten.length - 1 ? `<button class="prim" ${kl("rundgang", i + 1)}>Weiter</button>` : ""}<button ${kl("rundgangEnde")}>Beenden</button></div>`);
  $("#blatt-inh h3").focus();
}
// Startet den Rundgang auf der ersten Seite.
function rundgangStart() { rundgang(0); }
// Beendet den Rundgang und merkt auf diesem Gerät, dass er gesehen wurde.
function rundgangEnde() { speicher.s("ho_rundgang", "1"); blattZu(); }
// ---- Hilfen: Art-Wahl (Homeoffice ist vorausgewählt), Toast
function artWahl(id, wert, frage) {
  if (einOrt()) return festerOrt(id);
  return `<label>${frage}</label><div class="seg" id="${id}">${[["ho", "Homeoffice"], ["dst", "Büro"]].map(([k, t]) => `<button type="button" data-v="${k}" class="${wert === k ? "on" : ""}">${t}</button>`).join("")}</div>`;
}
// Macht die beiden Knöpfe einer Ortswahl (Homeoffice oder Büro) zu einer Auswahl.
function artBinden(id) {
  document.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => document.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle("on", x === b)));
}
// Gewählter Ort einer Ortswahl („ho“ oder „dst“, Voreinstellung Homeoffice).
const artWert = id => (document.querySelector(`#${id} button.on`) || {dataset: {v: "ho"}}).dataset.v;
const TOAST_MIN_MS = 3200, TOAST_MS_JE_ZEICHEN = 60;
// Das Meldungsfeld unten (role=status); wird bei Bedarf angelegt.
function toastFeld() { let t = $("#toast"); if (!t) { t = document.createElement("div"); t.id = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); } return t; }
// Meldung oben am Bildschirm (gut sichtbar über der Leiste), sonst wie toast().
function meldungOben(text) { toast(text, undefined, true); }
// Anzeigedauer einer Meldung nach der Länge des Textes.
const toastDauer = text => Math.max(TOAST_MIN_MS, String(text).length * TOAST_MS_JE_ZEICHEN);
// Zeigt eine kurze Meldung unten (oben: am oberen Rand); die Dauer richtet sich nach der Länge des Textes. dringend: sofort ansagen (role=alert).
function toast(text, dauer = toastDauer(text), oben = false, dringend = false) {
  const t = toastFeld();
  t.classList.toggle("oben", oben);
  t.setAttribute("role", dringend ? "alert" : "status");               // vor dem Text: die Rolle entscheidet, wie dringend der Screenreader ihn ansagt
  t.textContent = text; t.classList.add("an"); clearTimeout(t._z); t._z = setTimeout(() => t.classList.remove("an"), dauer);
}
// Fehlermeldung: dringend angesagt und doppelt so lange sichtbar, damit sie sich in Ruhe lesen lässt.
function toastFehler(text) { toast(text, 2 * toastDauer(text), false, true); }
// ---- Jahres-Prognose (fester Bürotag je Woche)
function jahresPrognoseHtml(p) {
  if (!p) return "";
  let satz;
  if (p.status === "ueber") satz = `<b class="rot">${p.quote_ende}</b> am Jahresende, <b>${p.reserve} Std.</b> zu viel HO. ${p.buero_reicht_nicht
    ? `Auch mit Büro an allen restlichen Tagen bleibt es über ${KONFIG.ho_grenze} % (dann ${p.varianten.at(-1).quote}).`
    : `Es fehlen noch mindestens ${tage(p.noetig_tage)} Büro (etwa ${komma(p.noetig_je_woche)} pro Woche).`}`;
  else satz = `<b>${p.quote_ende}</b> am Jahresende. Noch <b>${p.reserve} Std.</b> (${tage(p.reserve_tage)}) HO-Luft bis ${KONFIG.ho_grenze} %.`;
  // Markiert ist die Kachel, die genau die angezeigte Rechnung ist: von Hand gewählt oder Automatisch mit ganzer Zahl (gleiche Rechnung, gleiche Quote).
  const kacheln = p.varianten.map(v => `<button type="button" class="${v.rot ? "rot" : ""} ${v.rate === p.rate ? "gew" : ""}" ${kl("bueroSetzen", String(v.rate))} aria-label="${tage(v.rate)} Büro pro Woche annehmen, Quote ${v.quote}${v.rot ? ", über der Grenze" : ""}"><b>${v.quote}</b><small>${tage(v.rate)}</small></button>`).join("");
  return `<div class="prognose ${p.status}"><span>Jahr ${p.jahr}</span><div>${satz}<br><small>Annahme: ${anzahl(p.restwochen, "Woche", "Wochen")} Rest, ${tage(p.rate)} Büro pro Woche${p.rate_hand ? "" : " (automatisch)"}, Rest Homeoffice.</small>
    <span class="var-titel">Büro pro Woche (antippen, um die Annahme zu wählen):</span><div class="varianten">${kacheln}</div>
    <button type="button" class="auto-knopf ${p.rate_hand ? "" : "gew"}" ${kl("bueroSetzen", "")}>Automatisch (${tage(p.rate_auto)} Büro, nach deinem Jahr)</button></div></div>`;
}
// Wählt die Annahme „Büro pro Woche“ der Jahres-Prognose (leer = automatisch).
async function bueroSetzen(w) { try { await api("PUT", "/buero", {rate: w}); zeigen(); } catch (e) { toastFehler(e.message); } }

// ---- Quote-Ring: Anteil 0–1, Marke bei der HO-Grenze (Einstellung, Voreinstellung 80 %)
function ring(q, text, rot) {
  // 80-%-Marke: kleiner Dreieckspfeil außen am Ring (Spitze zeigt auf die Bahn) mit der Beschriftung „80 %“.
  const R = 52, U = 2 * Math.PI * R, p = q === null ? 0 : Math.min(1, q);
  const phi = (KONFIG.ho_grenze / 100) * 2 * Math.PI, sx = Math.sin(phi), sy = -Math.cos(phi), nx = -sy, ny = sx;       // Richtung nach außen (sx, sy), quer dazu (nx, ny)
  // Punkt der Zeichnung in Richtung der HO-Grenze, im Abstand r und seitlich um q2 verschoben.
  const pt = (r, q2 = 0) => `${(64 + r * sx + q2 * nx).toFixed(1)},${(64 + r * sy + q2 * ny).toFixed(1)}`;
  const spitze = R + 7.5, basis = R + 15.5;
  const lx = 64 + (basis + 3) * sx, ly = 64 + (basis + 3) * sy;
  // Beschriftung: außen neben dem Pfeil. Ragte sie dabei über das Quadrat des Rings hinaus (z. B. 80 % links), rückt sie in die freie Ecke
  // dieses Quadrats, damit sie nie über den Rand einer schmalen Kachel läuft.
  const halb = 13;                                                 // halbe Breite von „100 %“ in Einheiten der Zeichnung
  let tx = lx, ty = ly + 2.6, anker = sx > 0.05 ? "start" : sx < -0.05 ? "end" : "middle";
  if ((anker === "end" && lx - 2 * halb < 0) || (anker === "start" && lx + 2 * halb > 128)) {
    tx = Math.max(halb, Math.min(128 - halb, lx)); anker = "middle";
    const innen = tx < 64 ? tx + halb : tx - halb, hoch = Math.sqrt(Math.max(0, 61 * 61 - (innen - 64) ** 2));    // so weit weg, dass die Schrift den Ring nicht berührt
    ty = sy <= 0 ? 64 - hoch - 1 : 64 + hoch + 9;
  }
  return `<div class="ring ${rot ? "rot" : ""}"><svg viewBox="0 0 128 128" aria-hidden="true"><circle class="bahn" cx="64" cy="64" r="${R}"/>
    <circle class="fort" cx="64" cy="64" r="${R}" stroke-dasharray="${(U * p).toFixed(1)} ${U.toFixed(1)}"/></svg>
    ${mitGrenze() ? `<svg class="m80" viewBox="0 0 128 128" aria-hidden="true"><polygon points="${pt(spitze)} ${pt(basis, 5)} ${pt(basis, -5)}"/><text x="${tx.toFixed(1)}" y="${ty.toFixed(1)}" text-anchor="${anker}">${KONFIG.ho_grenze} %</text></svg>` : ""}
    <div class="mitte"><b>${text}</b><small>HO-Quote</small></div></div>`;
}
// Öffnet das Eintragen für heute (springt vorher in den aktuellen Monat).
function heuteEintragen() {
  if (jahr !== heute.getFullYear() || monat !== heute.getMonth() + 1) { jahr = heute.getFullYear(); monat = heute.getMonth() + 1; location.hash = `#/monat/${jahr}/${monat}`; setTimeout(() => tagBearbeiten(iso(jahr, monat, heute.getDate())), 500); }
  else tagBearbeiten(iso(jahr, monat, heute.getDate()));
}
// ---- demo.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Schaltet das Demo-Cookie ein oder aus; der Server liefert dann Beispieldaten aus einer eigenen Datenbank.
function demoCookie(an) { seitenCacheLeeren(); document.cookie = KEKS + "ho_demo=" + (an ? "1" : "") + "; path=" + ORT + "; SameSite=Lax; max-age=" + (an ? 31536000 : 0) + COOKIE_SICHER; }
// Startet die Demo mit Beispieldaten und lädt die App neu.
async function demoStart() {
  try { await api("POST", "/demo"); demoCookie(true); location.hash = "#/start"; location.reload(); } catch (e) { toastFehler(e.message); }
}
// Beendet die Demo und lädt die App neu.
function demoEnde() { demoCookie(false); location.hash = "#/start"; location.reload(); }
// Band „Demo-Modus“ mit Knopf zum Beenden (nur in der Demo).
function demoBanner() {
  return DEMO && DEMO.aktiv ? `<div class="demo-band"><span><b>Demo-Modus</b> · Beispieldaten, deine echten Daten bleiben unberührt</span><button ${kl("demoEnde")}>Demo beenden</button></div>` : "";
}
// ---- stempeluhr.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Sekunden als hh:mm:ss.
const uhr = s => { s = Math.max(0, Math.floor(s)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`; };

// ---- Stempeluhr: Kommen / Gehen
let stempelDaten = null;
const STEMPEL_KOMMEN = "Kommen", STEMPEL_GEHEN = "Gehen";
// Beschriftung des Stempel-Knopfs: „Gehen“, wenn die Uhr läuft, sonst „Kommen“.
const stempelKnopf = d => d && d.laeuft ? STEMPEL_GEHEN : STEMPEL_KOMMEN;
// Neuer Stand nach Kommen, Gehen oder Verwerfen: Banner, Kommen/Gehen-Taste und der Knopf der Übersicht folgen sofort.
// Andere Seiten werden nur neu gezeichnet, wenn sich Tagesdaten geändert haben (sonst gingen dort Eingaben verloren).
function stempelUebernehmen(daten, tagGeaendert) {
  stempelDaten = daten; stempelDaten.t0 = Date.now();
  blattZu(); stempelAnzeige();
  if (tagGeaendert || seitenName() === "start") zeigen();
}
// Holt den Stand der Stempeluhr und zeichnet Banner und Kommen/Gehen-Taste.
async function stempelLaden() {
  try { stempelDaten = await api("GET", "/stempel"); stempelDaten.t0 = Date.now(); } catch (e) { stempelDaten = null; }
  stempelAnzeige();
}
// Läuft die Zeit seit einem früheren Tag, nennt die Anzeige den Tag (gebucht wird auf den Tag des Beginns).
// Sind es dann schon mehr als 10 Stunden, wurde „Gehen“ vergessen: Das Ende wird nicht mit „jetzt“ vorbelegt.
const STEMPEL_VERGESSEN_S = 10 * 3600;
// Läuft die Stempeluhr seit einem früheren Tag?
function stempelFrueher() {
  const h = new Date(), d = stempelDaten;
  return !!(d && d.laeuft && d.start_datum && d.start_datum !== iso(h.getFullYear(), h.getMonth() + 1, h.getDate()));
}
// Starttag der Stempeluhr als TT.MM.JJJJ.
const stempelTag = () => stempelDaten.start_datum.split("-").reverse().join(".");
// Text „seit …“: Uhrzeit des Beginns, bei einem früheren Tag mit Datum.
const stempelSeit = () => stempelFrueher() ? `${stempelTag().slice(0, 6)}, ${stempelDaten.start_text}` : stempelDaten.start_text;
// Sekunden, die die Stempeluhr schon läuft (Stand vom Server plus die Zeit seitdem).
function stempelSekunden() { return stempelDaten && stempelDaten.laeuft ? stempelDaten.sekunden + (Date.now() - stempelDaten.t0) / 1000 : 0; }
// Minuten der laufenden Stempeluhr für die Kacheln der Übersicht (0 bei früherem Tag).
function laufendeMinuten() {
  const dazu = stempelDaten && stempelDaten.laeuft && !stempelFrueher() ? Math.floor(stempelSekunden() / 60) : 0;
  return dazu;
}
// Hält „Ist Tag“ und „Ist KW“ der Übersicht mit der laufenden Uhr aktuell.
function gleitzeitLaufend() {
  [$("#gz-tag"), $("#gz-kw")].forEach(e => { if (e) e.textContent = zeitText(+e.dataset.min + laufendeMinuten()); });
}
const FAB_PLUS = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`;     // ohne Stempeluhr-Modul: „Heute eintragen“
// Kommen: Play-Dreieck, Gehen: Stopp-Quadrat, beide als Fläche in der Schriftfarbe (Entscheidung vom 19.11.2026)
const FAB_KOMMEN = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.2v13.6L19.5 12z" fill="currentColor" stroke="none"/></svg>`;
const FAB_GEHEN = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.2" y="6.2" width="11.6" height="11.6" rx="2.2" fill="currentColor" stroke="none"/></svg>`;
// Mittlere Taste der Handy-Leiste: läuft die Stempeluhr, sofort ausbuchen (Wunsch vom 18.11.2026); sonst Stempeluhr bzw. „Heute eintragen“.
function plusTaste() {
  if (!modulAn("stempel")) return heuteEintragen();
  return stempelDaten && stempelDaten.laeuft ? schnellGehen() : schnellKommen();
}
// Kommen ohne Eingabe: nur den Ort wählen (zwei große Knöpfe), Beginn ist jetzt. Gibt es nur einen Ort, startet die Uhr sofort.
// „Beginn ändern oder nachtragen“ öffnet das ausführliche Blatt der Stempeluhr.
function schnellKommen() {
  if (einOrt()) return kommenMit(einOrt());
  blatt(`<h3>Kommen</h3><p class="hinweis" data-stil="text-align:center">Beginn jetzt (${jetztZeit()} Uhr). Wo arbeitest du?</p>
    <div class="knoepfe gross"><button class="prim" id="k-ho">Homeoffice</button><button class="prim" id="k-dst">Büro</button></div>
    <div id="s-fehler"></div>
    <div class="knoepfe"><button id="k-mehr">Beginn ändern oder nachtragen</button></div>`);
  $("#k-ho").onclick = gesperrt(() => kommenMit("ho"));
  $("#k-dst").onclick = gesperrt(() => kommenMit("dst"));
  $("#k-mehr").onclick = () => stempelBlatt();
}
// Startet die Stempeluhr am Ort „art“ mit Beginn jetzt und meldet es oben; ein Fehler steht im Blatt.
async function kommenMit(art) {
  try {
    stempelUebernehmen(await api("POST", "/stempel", {aktion: "start", art, beginn: jetztZeit()}), false);
    meldungOben(`Eingebucht um ${jetztZeit()} Uhr · ${art === "ho" ? "Homeoffice" : "Büro"}`);
  } catch (e) { if (!$("#s-fehler")) await stempelBlatt(); formFehler($("#s-fehler"), e.message); }
}
// Bucht mit einem Tipp aus: Ende jetzt, Pause nach Regel, Ort wie beim Kommen; danach die Rückgängig-Leiste (oder die Meldung oben, wenn der Dienst keine anbietet). Seit einem früheren Tag (Gehen vergessen) oder bei einem Fehler
// (z. B. über 10 Stunden) öffnet sich das Blatt, damit nichts Falsches gebucht wird; dort steht der Grund.
async function schnellGehen() {
  if (stempelFrueher()) return stempelBlatt();
  try {
    const r = await api("POST", "/stempel", {aktion: "stop", art: stempelDaten.art, ende: jetztZeit(), pause: null, freigabe: false});
    stempelUebernehmen(r, true);
    const text = `Ausgebucht um ${jetztZeit()} Uhr · ${zeitText(minuten(r.gebucht))} Std. gebucht${r.pause_min ? ` (Pause ${zeitText(r.pause_min)})` : ""}.`;
    rueckgaengigZeigen(r, text) || meldungOben(`${text} Ändern: oben auf „Heute“ tippen und den Tag öffnen.`);   // ohne Rückgängig: Hinweis, wie man es ändert
  } catch (e) { await stempelBlatt(); formFehler($("#s-fehler"), e.message); }
}
// Kurzbefehle am App-Symbol der Android-Fassung: Kennung je Ort fürs Kommen; dazu „gehen“ (Liste der Hülle: KURZBEFEHLE in MainActivity.java).
const KURZBEFEHL_ORT = new Map([["kommen_ho", "ho"], ["kommen_dst", "dst"]]);
const STEMPEL_AUS = "Die Stempeluhr ist ausgeschaltet. Einschalten: Einstellungen → Module.";
// Die Android-Hülle ruft kurzbefehl("<Kennung>") gleich nach dem Laden der Seite auf, mit einer der drei festen Kennungen; jede andere bleibt ohne Wirkung.
// Gebucht wird auf denselben Wegen wie mit der mittleren Taste. Regeln und Stand der Uhr erst holen: Der Aufruf kann vor dem ersten Laden kommen.
// Passt die Lage nicht (Gehen ohne laufende Uhr, Kommen bei laufender Uhr, Ort, den das Profil nicht kennt), bucht er nichts und öffnet das Blatt der Stempeluhr.
async function kurzbefehl(kennung) {
  if (kennung !== "gehen" && !KURZBEFEHL_ORT.has(kennung)) return;
  try { KONFIG = (await api("GET", "/konfig")).werte; } catch (e) { /* ohne Verbindung gelten die zuletzt geladenen Regeln */ }
  if (!modulAn("stempel")) return meldungOben(STEMPEL_AUS);
  await stempelLaden();
  const laeuft = !!(stempelDaten && stempelDaten.laeuft), ort = KURZBEFEHL_ORT.get(kennung);
  if (kennung === "gehen") return laeuft ? schnellGehen() : stempelBlatt();
  if (laeuft || (einOrt() && einOrt() !== ort)) return stempelBlatt();
  return kommenMit(ort);
}
// Zeichnet das Banner der laufenden Stempeluhr und stellt die mittlere Taste um (Symbol und Beschriftung: Kommen oder Gehen).
function stempelAnzeige() {
  const l = !!(stempelDaten && stempelDaten.laeuft), fab = $("#fab");
  if (fab) {
    fab.classList.toggle("laeuft", l); fab.innerHTML = !modulAn("stempel") ? FAB_PLUS : l ? FAB_GEHEN : FAB_KOMMEN;
    fab.setAttribute("aria-label", l ? "Gehen (ausbuchen)" : modulAn("stempel") ? "Kommen (einbuchen)" : "Heute eintragen");
  }
  gleitzeitLaufend();                                              // Kacheln der Übersicht gleich mit der Uhr, nicht erst im nächsten Sekundentakt
  let b = $("#stempel-banner");
  if (!l) { if (b) b.remove(); return; }
  if (!b) {                                                        // Tab, dann Enter oder Leertaste wie die Tage (TIPPBAR)
    b = document.createElement("div"); b.id = "stempel-banner"; b.tabIndex = 0; b.setAttribute("role", "button"); b.onclick = stempelBlatt;
    $("#huelle").insertBefore(b, $("#inhalt"));
  }
  const ort = stempelDaten.art === "ho" ? "Homeoffice" : "Büro";
  b.setAttribute("aria-label", `Stempeluhr läuft: ${ort} seit ${stempelSeit()}. ${STEMPEL_GEHEN}`);   // fester Name: die Uhr im Band tickt jede Sekunde
  b.innerHTML = `<i></i><span>${ort} seit ${esc(stempelSeit())}</span><b id="b-uhr">${uhr(stempelSekunden())}</b><u>${STEMPEL_GEHEN} ›</u>`;
}
// Blatt der Stempeluhr: „Kommen“ mit Beginn und Ort, bei laufender Uhr „Gehen“ mit Ende, Pause und Freigabe oder „Verwerfen“.
async function stempelBlatt() {
  const d = stempelDaten || {laeuft: false, heute: {}};
  const heuteText = `Heute schon: ${orteText(d.heute.ho, d.heute.dst)}`;
  if (!d.laeuft) {
    blatt(`<h3>Stempeluhr</h3><p class="hinweis" data-stil="text-align:center">${heuteText}</p>
      ${artWahl("s-art", "ho", "Wo arbeitest du?")}
      <label>Beginn <small>(jetzt vorbelegt, lässt sich ändern)</small></label><input id="s-beginn" inputmode="numeric" placeholder="hh:mm, zum Beispiel 07:45" value="${jetztZeit()}">
      <div id="s-fehler"></div>
      <div class="knoepfe"><button class="prim" id="s-start">${STEMPEL_KOMMEN}</button></div>
      <p class="hinweis">Ganzen Tag oder einen früheren Tag nachtragen: im Monat den Tag öffnen und „Kommen – Gehen – Pause“ nutzen. Dort kannst du Zeiten auch direkt eintippen.</p>
      <div class="knoepfe"><button id="s-hand">Heute von Hand eintragen</button></div>`);
    artBinden("s-art");
    $("#s-beginn").onblur = e => e.target.value = zeitNorm(e.target.value);
    $("#s-hand").onclick = () => { blattZu(); heuteEintragen(); };
    $("#s-start").onclick = gesperrt(async () => {
      try { stempelUebernehmen(await api("POST", "/stempel", {aktion: "start", art: artWert("s-art"), beginn: zeitNorm($("#s-beginn").value)}), false); toast("Gestartet. Gute Arbeit!"); }
      catch (e) { formFehler($("#s-fehler"), e.message); }
    });
  } else {
    const vergessen = stempelFrueher() && stempelSekunden() > STEMPEL_VERGESSEN_S;
    blatt(`<h3>Stempeluhr läuft</h3><div class="uhr" id="s-uhr">${uhr(stempelSekunden())}</div>
      <p class="hinweis" data-stil="text-align:center">${d.art === "ho" ? "Homeoffice" : "Büro"} seit ${esc(stempelSeit())} Uhr · ${heuteText}</p>
      ${vergessen ? `<p class="hinweis" role="status"><b>„Gehen“ vergessen?</b> Die Zeit läuft seit dem ${esc(stempelTag())}. Trage ein, wann du aufgehört hast. Gebucht wird auf den ${esc(stempelTag())}.</p>` : ""}
      ${artWahl("s-art", d.art, "Wo hast du gearbeitet?")}
      <div class="reihe"><div><label>${vergessen ? "Ende <small>(Uhrzeit)</small>" : "Ende <small>(jetzt vorbelegt)</small>"}</label><input id="s-ende" inputmode="numeric" placeholder="hh:mm" value="${vergessen ? "" : jetztZeit()}"></div>
      <div><label>Pause <small>(nach Regel vorbelegt)</small></label><input id="s-pause" inputmode="numeric" placeholder="hh:mm"></div></div>
      <div class="zeile"><span>Über 10 Stunden freigegeben</span><input type="checkbox" id="s-frei" aria-label="Über 10 Stunden freigegeben"></div>
      <div id="s-fehler"></div>
      <div class="knoepfe"><button class="prim" id="s-stop">${STEMPEL_GEHEN}</button><button class="gef" id="s-weg">Verwerfen</button></div>
      <p class="hinweis">„Gehen“ zählt die Zeit zum Tag des Beginns dazu. Die Pause richtet sich nach der Pausenregel (${pausenText()}, anteilig, unter „Regeln“ einstellbar), außer du änderst sie. Pro Tag sind höchstens 10 Stunden möglich, mehr nur mit Freigabe.</p>`);
    artBinden("s-art");
    const sPause = () => {                              // Vorbelegung: Regel für die Zeit vom Beginn bis zum Ende, solange du die Pause nicht selbst änderst
      const f = $("#s-pause"); if (f.dataset.eigen) return;
      const ende = $("#s-ende").value, d = ende ? (minuten(zeitNorm(ende)) - minuten(stempelDaten.start_text) + 1440) % 1440 : Math.round(stempelSekunden() / 60);
      f.value = hhmm(pauseAuto(d));
    };
    $("#s-ende").onblur = e => { e.target.value = zeitNorm(e.target.value); sPause(); };
    $("#s-pause").onblur = e => { e.target.value = pauseNorm(e.target.value); e.target.dataset.eigen = e.target.value ? 1 : ""; sPause(); };
    sPause();
    $("#s-stop").onclick = gesperrt(async () => {
      try {
        const r = await api("POST", "/stempel", {aktion: "stop", art: artWert("s-art"), ende: zeitNorm($("#s-ende").value), pause: $("#s-pause").dataset.eigen ? minuten(pauseNorm($("#s-pause").value)) : null, freigabe: $("#s-frei").checked});
        stempelUebernehmen(r, true);
        const text = `${zeitText(minuten(r.gebucht))} Std. gebucht${r.pause_min ? ` (Pause ${zeitText(r.pause_min)})` : ""}.`;
        rueckgaengigZeigen(r, text) || toast(text);
      } catch (e) { formFehler($("#s-fehler"), e.message); }
    });
    $("#s-weg").onclick = gesperrt(async () => {
      if (!(await frage("Laufende Zeit verwerfen? Es wird nichts gebucht.", "Verwerfen", true))) return;
      try { stempelUebernehmen(await api("POST", "/stempel", {aktion: "verwerfen"}), false); toast("Verworfen. Es wurde nichts gebucht."); }
      catch (e) { formFehler($("#s-fehler"), e.message); }
    });
  }
}
// Die aktuelle Uhrzeit als hh:mm.
function jetztZeit() { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; }

// ---- bausteine/bereiche.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Bereiche der Navigation (aufbau.md 1 bis 3, 5): Seitenschlüssel bleiben, Bereiche und Reiter sind nur Darstellung. Dazu Weiterleitung alter Adressen
// und die Zahl der offenen Zu-tun-Einträge am Symbol der Übersicht.
// Acht Bereiche in der gewünschten Reihenfolge (19.11.2026, 00:15); je Reiter [Seite, Beschriftung]. Eine Seite steht in genau einem Bereich.
const BEREICHE = [["start", "Übersicht", [["start", "Übersicht"]]],
  ["zeit", "Zeit", [["tag", "Tag"], ["woche", "Woche"], ["monat", "Monat"]]],
  ["homeoffice", "Homeoffice", [["horest", "Spielraum"], ["jahr", "Jahr"]]],
  ["abwesenheit", "Abwesenheit", [["urlaub", "Urlaub"], ["krank", "Krank"], ["sondertage", "Sondertage"]]],
  ["auswertung", "Auswertung", [["monatsnachweis", "Monatsnachweis"], ["export", "Export"], ["steuer", "Steuer"]]],
  ["daten", "Daten", [["sicherung", "Sicherung"], ["sync", "Synchronisierung"]]],
  ["einstellungen", "Einstellungen", [["einstellungen", "Einstellungen"]]],
  ["hilfe", "Hilfe", [["hilfe", "Hilfe"]]]];
// Startreiter, wo nicht der erste: Woche ist die Hauptansicht (Wunsch 18.11.2026, damals in der Tableiste)
const BEREICH_START = {zeit: "woche"};
// Kurze Namen für die Tableiste bis 375 px (design.md F-NV1); eigene Tabelle, damit BEREICHE als JSON lesbar bleibt
const BEREICH_KURZ = {homeoffice: "HO", abwesenheit: "Abwesend"};
// Symbol je Bereich (Schlüssel aus SYM); neue Seiten ohne eigenes Symbol nutzen das ihres Bereichs
const BEREICH_SYM = {start: "start", zeit: "woche", homeoffice: "horest", abwesenheit: "urlaub", auswertung: "export", daten: "sicherung", einstellungen: "einstellungen", hilfe: "hilfe"};
// Unterseiten (#/<seite>/<unterseite>) mit den gewünschten Namen (19.11.2026, 00:15); Reihenfolge = Liste der Einstellungen
const UNTERSEITEN = {einstellungen: [["arbeitszeit", "Arbeitszeit und Regeln"], ["person", "Person und Startwerte"], ["aussehen", "Aussehen"], ["module", "Module und Profile"], ["geraete", "Geräte und Anmeldung"]]};
// Alte Seitenschlüssel und ihr neues Ziel, damit Lesezeichen, Verlauf und ältere Zu-tun-Ziele weiter funktionieren.
const ALTE_ADRESSEN = {planung: "urlaub/planung", darstellung: "einstellungen/aussehen", abgleich: "sync", mehr: "start", admin: "einstellungen/geraete"};
// Zuletzt gewählter Reiter je Bereich, nur in dieser Sitzung (nach dem Neuladen wieder wie ab Werk, darum nicht im Browser-Speicher)
const REITER_ZULETZT = {};
const ADRESSE_START = "#/start";
const NAME_OHNE_HOMEOFFICE = "Jahr";                                   // Festlegung A4: ohne Homeoffice gibt es weder Quote noch Spielraum
const MENUE_WEG = "Menü";                                             // Kopf-Knopf #menue am Handy, Anfang eines Wegs zu Bereichen außerhalb der Leiste
const WEG_TRENNER = " → ";

// Eintrag [Schlüssel, Name, Reiter] des Bereichs, in dem eine Seite steht; unbekannte Seite: Übersicht.
function bereichVon(seite) {
  return BEREICHE.find(([, , reiter]) => reiter.some(([s]) => s === seite)) || BEREICHE[0];
}
// Eintrag eines Bereichs über seinen Schlüssel.
const bereichEintrag = b => BEREICHE.find(([k]) => k === b) || BEREICHE[0];
// Fehlt eine Seite (Modul aus, Modus, Fassung ohne Sync)? Seiten ohne Funktion in SEITEN gelten als abgeschaltet.
const seiteWeg = s => !Object.hasOwn(SEITEN, s) || navWeg(s);
// Reiter eines Bereichs ohne abgeschaltete Seiten; ein Reiter fehlt ganz, er wird nicht ausgegraut.
const reiterSichtbar = b => bereichEintrag(b)[2].filter(([s]) => !seiteWeg(s));
// Bereich ohne sichtbaren Reiter: fehlt in Leiste, Seitenleiste und Menü.
const bereichWeg = b => !reiterSichtbar(b).length;
// Adresse beim Antippen eines Bereichs: zuletzt gewählter sichtbarer Reiter, sonst der Startreiter, sonst der erste sichtbare; ganz ohne Reiter die Übersicht.
function bereichZiel(b) {
  const sichtbar = reiterSichtbar(b).map(([s]) => s);
  const ziel = [REITER_ZULETZT[b], BEREICH_START[b]].find(s => sichtbar.includes(s)) || sichtbar[0];
  return ziel ? seitenAdresse(ziel) : ADRESSE_START;
}
// Adresse eines Reiters; die Zeit-Reiter tragen das gemeinsame Datum mit (Tag → Woche zeigt die Woche des Tages).
const seitenAdresse = s => ZEIT_SEITEN.includes(s) ? zeitAdresse(s, zeitDatum) : "#/" + s;
// Name eines Bereichs für Leiste, Seitenleiste, Menü und Überschrift.
function bereichName(b) {
  return b === "homeoffice" && hoModus() === "kein" ? NAME_OHNE_HOMEOFFICE : bereichEintrag(b)[1];
}
// Kurzer Name für die Tableiste; ohne Homeoffice heißt der Bereich „Jahr“ und braucht keinen.
const bereichKurz = b => bereichName(b) === bereichEintrag(b)[1] ? BEREICH_KURZ[b] || "" : "";
// Bereiche hinter dem Kopf-Knopf „Menü“: alle außerhalb der Handy-Leiste, die nicht ganz abgeschaltet sind.
const menueBereiche = () => BEREICHE.map(([b]) => b).filter(b => !HANDY_NAV.includes(b) && !bereichWeg(b));
// Zurück-Pfeil im Kopf: auf allen Seiten der Bereiche außerhalb der Handy-Leiste.
const zurueckDa = s => !HANDY_NAV.includes(bereichVon(s)[0]);
// Name einer Unterseite (z. B. „Person und Startwerte“) oder leer.
const unterseiteName = (seite, unter) => ((Object.hasOwn(UNTERSEITEN, seite) ? UNTERSEITEN[seite] : []).find(([u]) => u === unter) || [])[1] || "";
// Weg zu einer Seite für Hilfe und Meldungen, z. B. „Abwesenheit → Urlaub“; am Handy mit „Menü → “ davor, wenn der Bereich nicht in der Leiste steht.
function weg(seite, unterseite = "") {
  const [b, , reiter] = bereichVon(seite), teile = [bereichName(b)];
  if (reiter.length > 1) teile.push(reiter.find(([s]) => s === seite)[1]);
  if (unterseiteName(seite, unterseite)) teile.push(unterseiteName(seite, unterseite));
  if (document.body.dataset.design === "handy" && !HANDY_NAV.includes(b)) teile.unshift(MENUE_WEG);
  return teile.join(WEG_TRENNER);
}
// Titel des Fensters: Unterseite, sonst bei sichtbarer Leiste der Reiter, sonst der Bereich.
function fensterTitel(seite) {
  const [b, , reiter] = bereichVon(seite);
  return unterseiteName(seite, hashTeile()[1]) || (reiterSichtbar(b).length > 1 ? reiter.find(([s]) => s === seite)[1] : bereichName(b));
}
// Link eines Bereichs für Seitenleiste und Tableiste (Alias-Adresse); den Text setzt navBeschriften, er hängt an Modus und Modulen.
const navLink = b => `<a href="#/${b}" data-t="${b}">${sym(BEREICH_SYM[b])}<span class="nav-lang"></span><span class="nav-kurz" aria-hidden="true"></span></a>`;
// Schreibt Name und Kurzname in einen Link aus navLink; mit Kurzname trägt der Link den vollen Namen für den Screenreader.
// Die Übersicht hat keinen Kurznamen, ihr aria-label gehört der Zahl am Symbol.
function navBeschriften(a) {
  const b = a.dataset.t, kurz = bereichKurz(b);
  a.querySelector(".nav-lang").textContent = bereichName(b);
  a.querySelector(".nav-kurz").textContent = kurz;
  if (kurz) a.setAttribute("aria-label", bereichName(b));
  else if (b !== "start") a.removeAttribute("aria-label");
}

// ---- Adressen (aufbau.md 2): immer per replaceState, ohne Eintrag im Verlauf, in genau einem Schritt
// Neue Adresse zu den Teilen einer alten oder leer, wenn sie bleibt: alter Schlüssel (Rest dahinter bleibt), Alias eines Bereichs, unbekannte Unterseite.
function neueAdresse([schluessel, ...rest]) {
  if (Object.hasOwn(ALTE_ADRESSEN, schluessel)) return "#/" + [ALTE_ADRESSEN[schluessel], ...rest].join("/");
  if (BEREICHE.some(([b, , reiter]) => b === schluessel && !reiter.some(([s]) => s === schluessel))) return bereichZiel(schluessel);
  if (Object.hasOwn(UNTERSEITEN, schluessel) && rest.length && !unterseiteName(schluessel, rest[0])) return "#/" + schluessel;
  return "";
}
// Stellt eine alte Adresse (#/abgleich/…) auf die neue um (#/sync/…), ohne Eintrag im Verlauf. Erste Anweisung von zeigen().
function adresseUmstellen() {
  const ziel = neueAdresse(hashTeile());
  if (ziel) history.replaceState(null, "", ziel);
}

// ---- Zu tun: gemerkte Wahl dieses Geräts und Zahl am Symbol der Übersicht (aufbau.md 5); in der Grundlage, weil Start und Rückkehr sie brauchen
const ZUTUN_STUFEN = {rot: "Dringend", gelb: "Bald erledigen", info: "Hinweis"};
// Liest eine gemerkte Liste oder Zuordnung dieses Geräts (JSON in speicher), bei Unsinn leer.
const zutunGemerkt = (schluessel, leer) => { try { return JSON.parse(speicher.l(schluessel, "")) || leer; } catch (e) { return leer; } };
// Einträge „Zu tun“ vom Server; die eigenständige Web-App gibt das Datum der letzten Sicherung mit (liegt nur im Browser). Fehler: keine Karte.
function zutunLaden() {
  if (!modulAn("zutun")) return Promise.resolve(null);
  const sicherung = PLATTFORM === "browser" ? "?letzte_sicherung=" + encodeURIComponent(speicher.l("ho_gesichert", "")) : "";
  return api("GET", "/zutun" + sicherung).catch(() => null);
}
// Ist ein Eintrag auf diesem Gerät ausgeblendet („Später“ noch nicht abgelaufen oder „Nicht mehr zeigen“, das nie für rote gilt)?
function zutunVersteckt(e) {
  const bis = zutunGemerkt("ho_zutun_spaeter", {})[e.id];
  return (bis && Date.parse(bis) > Date.now()) || (e.stufe !== "rot" && zutunGemerkt("ho_zutun_aus", []).includes(e.id));
}
// Gültige, nicht ausgeblendete Einträge einer Antwort von GET /api/zutun (die Karte zeigt genau diese).
const zutunSichtbar = antwort => (antwort?.eintraege || []).filter(e => e && ZUTUN_STUFEN[e.stufe] && typeof e.id === "string" && !zutunVersteckt(e));
// Zahl am Symbol aus einer Antwort von GET /api/zutun; bei abgeschaltetem Modul keine.
function zutunZahl(antwort) {
  zahlAmSymbol(modulAn("zutun") ? zutunSichtbar(antwort).length : 0);
}
// Setzt an „Übersicht“ in Tableiste und Seitenleiste ein Abzeichen mit n (nur als Zahl ausgegeben) und den Text für den Screenreader; bei 0 keins.
function zahlAmSymbol(n) {
  const zahl = Number(n) > 0 ? Number(n) : 0;
  document.querySelectorAll("#nav a[data-t=start], #seitennav a[data-t=start]").forEach(a => {
    a.querySelector(".zahl")?.remove();
    if (!zahl) { a.removeAttribute("aria-label"); return; }
    a.insertAdjacentHTML("beforeend", `<span class="zahl" aria-hidden="true">${zahl}</span>`);
    a.setAttribute("aria-label", `${bereichName("start")}, ${zahl} ${zahl === 1 ? "Hinweis" : "Hinweise"}`);
  });
}
// ---- bausteine/blatt.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Das Blatt ist ein Dialog: Die Seite dahinter ist gesperrt (inert), der Fokus geht ins Blatt und beim Schließen zurück zum Knopf, der es geöffnet hat.
let blattVon = null;
// Nie gesperrt: das Blatt selbst und die Meldungen (toast, Rückgängig), sonst fehlten sie im Barrierefreiheits-Baum und der Screenreader sagte sie nicht an.
const BLATT_FREI = ["blatt", "toast", "rueck"];
// Sperrt die Seite hinter dem Blatt (inert), solange das Blatt offen ist.
function blattSperre(offen) { for (const k of document.body.children) if (!BLATT_FREI.includes(k.id)) k.inert = offen; }
// Öffnet das Blatt (Dialog) mit dem gegebenen HTML; der Fokus geht ins Blatt.
function blatt(html) {
  const inh = $("#blatt-inh"), warOffen = $("#blatt").classList.contains("auf");
  if (!warOffen) blattVon = document.activeElement;
  inh.innerHTML = html; beschriften(inh);
  inh.setAttribute("aria-label", inh.querySelector("h3")?.textContent || "Eingabe");
  $("#blatt").classList.add("auf"); blattSperre(true);
  if (!warOffen) inh.focus({preventScroll: true});          // das Blatt selbst, kein Feld: am Handy soll die Tastatur nicht aufspringen
}
// Eigene Rückfrage statt des Browser-Dialogs: passt zu Hell/Dunkel und Akzentfarbe, zeigt in den Apps keine Herkunftszeile, die gefährliche Wahl ist rot.
// Esc, Tipp daneben und „Abbrechen“ heißen nein; der Fokus steht auf „Abbrechen“, ein versehentliches Enter löscht also nichts.
let blattZuRueck = null;
// Rückfrage als Blatt; liefert ein Versprechen: true bei Bestätigen, false bei Abbrechen, Esc oder Tipp daneben.
function frage(text, ja, gefahr = false) {
  return new Promise(ok => {
    // Steht schon ein Blatt offen (Stempeluhr, Abschnitt), bleibt es bei „Abbrechen“ samt Eingaben stehen: Knoten merken statt neu zeichnen
    const inh = $("#blatt-inh"), vorher = $("#blatt").classList.contains("auf") ? {knoten: [...inh.childNodes], name: inh.getAttribute("aria-label"), fokus: document.activeElement} : null;
    const [titel, ...rest] = text.split("\n\n");
    blatt(`<h3>${esc(titel)}</h3>${rest.map((x, i) => `<p class="hinweis" id="frage-text-${i}">${esc(x).replace(/\n/g, "<br>")}</p>`).join("")}
      <div class="knoepfe"><button type="button" class="${gefahr ? "gef" : "prim"}" id="frage-ja">${esc(ja)}</button><button type="button" id="frage-nein">Abbrechen</button></div>`);
    inh.setAttribute("role", "alertdialog");
    if (rest.length) inh.setAttribute("aria-describedby", rest.map((x, i) => "frage-text-" + i).join(" "));   // mit dem Titel liest der Screenreader auch die Folgen vor
    // Beendet die Rückfrage mit der Antwort; bei „nein“ kommt ein zuvor offenes Blatt samt Eingaben zurück (liefert true, wenn es offen bleibt).
    const ende = antwort => {
      blattZuRueck = null; inh.setAttribute("role", "dialog"); inh.removeAttribute("aria-describedby");
      if (vorher && !antwort) { inh.replaceChildren(...vorher.knoten); inh.setAttribute("aria-label", vorher.name || "Eingabe"); if (vorher.fokus?.isConnected) vorher.fokus.focus({preventScroll: true}); }
      ok(antwort);
      return !!vorher && !antwort;                                        // true: das Blatt bleibt offen
    };
    blattZuRueck = () => ende(false);
    $("#frage-ja").onclick = () => { ende(true); blattZu(); };
    $("#frage-nein").onclick = () => blattZu();
    $("#frage-nein").focus({preventScroll: true});
  });
}
// Schließt das Blatt und gibt den Fokus zurück an den Knopf, der es geöffnet hat.
function blattZu() {
  if (!$("#blatt").classList.contains("auf")) return;
  if (blattZuRueck) { const r = blattZuRueck; blattZuRueck = null; if (r()) return; }
  $("#blatt").classList.remove("auf"); blattSperre(false);
  if (blattVon?.isConnected) blattVon.focus({preventScroll: true});
  blattVon = null;
}
// ---- bausteine/dauer.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Anzeige von Dauern im Format der Regel „zeitformat“ (7:30 oder 7,50). Uhrzeiten und Eingabefelder bleiben hh:mm.
const ZEITFORMAT_DEZIMAL = "dezimal";
const MINUTEN_JE_STUNDE = 60;
const HUNDERTSTEL = 100;
// Dauer in Minuten als Text: „hhmm“ wie hhmm (07:30), „dezimal“ als Stunden mit zwei Stellen und Komma (7,50).
// Eingaben: m ganze Minuten (auch negativ), vorz true setzt „+“ vor positive Werte (Salden). Gerundet wird kaufmännisch vom Betrag,
// wie zeit.fmt_dauer im Server (ROUND_HALF_UP); Summen also immer erst in Minuten bilden, dann einmal formatieren.
function zeitText(m, vorz) {
  if (KONFIG.zeitformat !== ZEITFORMAT_DEZIMAL) return hhmm(m, vorz);
  const h = Math.round(Math.abs(m) * HUNDERTSTEL / MINUTEN_JE_STUNDE);     // ganze Zahlen: Math.round rundet .5 auf, also wie ROUND_HALF_UP
  return (m < 0 ? "−" : (vorz && m > 0 ? "+" : "")) + Math.floor(h / HUNDERTSTEL) + "," + pad(h % HUNDERTSTEL);
}
// ---- bausteine/kennzahl.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Kennzahl-Kacheln (design.md 3.2, F-KZ3): die Kachel ist ein div, ein Link über die ganze Fläche führt zum Ziel. Ein Hilfe-Knopf käme neben den Link,
// nie hinein (Parameter erkl, sobald hilfe() in einem Baustein liegt; heute in seiten/horest.js, eine Seite darf dort nicht zugreifen).
let kNr = 0;                                                           // fortlaufend je Kachel: IDs für Wert und Zusatz (aria-describedby)
// Kopf einer klickbaren Kachel: Etikett als Link zum Ziel; mit id beschreiben Wert und Zusatz den Link (der Screenreader liest „Urlaub, 12 Tage, …“).
function kachelKopf(titel, ziel, id = "") {
  return `<span class="kachel-kopf"><a class="kachel-link" href="#/${ziel}"${id ? ` aria-describedby="${id}-w ${id}-z"` : ""}>${titel}</a></span>`;
}
// Klickbare Kachel mit Titel, Wert, Zusatz und Ziel (optional Klasse und Modul für das Ausblenden).
function kachel(titel, wert, sub, ziel, klasse = "", modul = "") {
  const id = "k" + (++kNr);
  return `<div class="card kachel klickbar ${klasse}"${modul && md(modul)}>${kachelKopf(titel, ziel, id)}<b id="${id}-w">${wert}</b><small id="${id}-z">${sub}</small></div>`;
}
// ---- bausteine/reiter.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Reiter-Leiste unter dem Titel (#reiter, aufbau.md 3): WAI-ARIA-Tabs mit manueller Aktivierung, weil jeder Wechsel Daten lädt und die Adresse ändert.
const REITER_ID = "reiter-";
// Zeichnet die Leiste für den Bereich der Seite. Unter 2 sichtbaren Reitern keine Leiste. Neu aufgebaut wird nur, wenn sich Bereich oder Reiter ändern,
// sonst nur die Wahl umgestellt: So bleibt der Tastatur-Fokus beim Neuzeichnen auf dem Reiter. HTML nur aus festen Konstanten (BEREICHE).
function reiterZeichnen(seite) {
  const leiste = $("#reiter"), [b] = bereichVon(seite), reiter = reiterSichtbar(b);
  const kennung = b + ":" + reiter.map(([s]) => s).join(",");
  if (reiter.length < 2) { leiste.hidden = true; leiste.innerHTML = ""; leiste.dataset.kennung = ""; return; }
  if (leiste.dataset.kennung !== kennung) {
    leiste.innerHTML = reiter.map(([s, text]) => `<button type="button" role="tab" id="${REITER_ID}${s}" aria-controls="reiter-inhalt">${text}</button>`).join("");
    leiste.dataset.kennung = kennung;
  }
  leiste.setAttribute("aria-label", bereichName(b));
  leiste.hidden = false;
  leiste.querySelectorAll("[role=tab]").forEach(k => {
    const an = k.id === REITER_ID + seite;
    k.setAttribute("aria-selected", an); k.tabIndex = an ? 0 : -1; k.classList.toggle("on", an);
  });
}
// Legt den Seiteninhalt bei sichtbarer Leiste in das Feld, auf das die Reiter zeigen (aria-controls); ohne Leiste unverändert.
function reiterHuelle(html) {
  const leiste = $("#reiter");
  return leiste.hidden ? html : `<div role="tabpanel" id="reiter-inhalt" aria-labelledby="${leiste.querySelector("[aria-selected=true]")?.id || ""}">${html}</div>`;
}
// Wählt einen Reiter: merkt ihn für diese Sitzung und wechselt die Adresse. Beim schon gewählten Reiter passiert nichts.
function reiterWaehlen(knopf) {
  if (knopf.getAttribute("aria-selected") === "true") return;
  const seite = knopf.id.slice(REITER_ID.length);
  REITER_ZULETZT[bereichVon(seite)[0]] = seite;
  location.hash = seitenAdresse(seite);
}
// Klick oder Tippen in der Leiste.
function reiterKlick(e) {
  const knopf = e.target.closest("[role=tab]");
  if (knopf) reiterWaehlen(knopf);
}
// Tastatur in der Leiste: ←/→ (am Ende weiter vorn bzw. hinten), Pos1 und Ende bewegen nur den Fokus; Enter und Leertaste wählen.
// Die Taste geht nicht weiter an den globalen Griff (Monat blättern).
function reiterTaste(e) {
  const reiter = [...$("#reiter").querySelectorAll("[role=tab]")], i = reiter.indexOf(document.activeElement);
  if (i < 0) return;
  const ziel = {ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: reiter.length - 1}[e.key];
  if (ziel !== undefined) reiter[(ziel + reiter.length) % reiter.length].focus();
  else if (e.key === "Enter" || e.key === " ") reiterWaehlen(reiter[i]);
  else return;
  e.preventDefault(); e.stopPropagation();
}
// ---- bausteine/rueckgaengig.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Rückgängig-Leiste (#rueck, funktionen.md 1): nach Speichern, Leeren, Schnellwahl und Planen eine Stufe zurück, per Knopf oder Strg+Z / ⌘+Z.
// Sie bleibt 10 s; solange Maus oder Fokus darin sind, wartet sie (WCAG 2.2.1) und läuft danach 5 s weiter, nach 55 s schließt sie immer
// (der Dienst nimmt Rückgängig bis 60 s an). Beim Schließen erfährt der Dienst das Ende, damit die Synchronisierung nicht wartet.
const RUECK_MS = 10000, RUECK_NACH_MS = 5000, RUECK_HOECHSTENS_MS = 55000;
const RUECK_LUFT = 8;                                                     // px zwischen einem frei gerollten Tag und der Leiste
const RUECK_ANSAGE = "Rückgängig mit Strg+Z möglich.", RUECK_ABGELAUFEN = "Rückgängig ist abgelaufen.", RUECK_GEMACHT = "Rückgängig gemacht.";
let rueckId = null, rueckUhr = null, rueckEnde = 0, rueckBeobachter = null;

// Zeigt die Leiste für die Antwort einer Aktion ({rueckgaengig: {id, text}}); text ersetzt den Text des Dienstes (Schnellwahl: „Urlaub eingetragen.“).
// Rückgabe false, wenn die Aktion nichts geändert hat (rueckgaengig fehlt oder ist null): dann zeigt der Aufrufer seine Meldung selbst.
function rueckgaengigZeigen(antwort, text) {
  if (!antwort?.rueckgaengig) return false;
  rueckSchliessen(false);
  const leiste = $("#rueck"), t = document.createElement("span"), sr = document.createElement("span"), knopf = document.createElement("button");
  t.textContent = text || antwort.rueckgaengig.text;
  sr.className = "sr"; sr.textContent = " " + RUECK_ANSAGE;
  knopf.type = "button"; knopf.className = "leise"; knopf.dataset.klick = "rueckgaengig"; knopf.textContent = "Rückgängig";
  leiste.hidden = false;                                                  // erst sichtbar, dann der Text: sonst sagt VoiceOver ihn nicht immer an
  rueckId = antwort.rueckgaengig.id; rueckEnde = Date.now() + RUECK_HOECHSTENS_MS;
  const id = rueckId; requestAnimationFrame(() => { if (rueckId === id) leiste.replaceChildren(t, sr, knopf); });
  rueckHoeheVerfolgen(leiste);
  rueckWarten(RUECK_MS);
  return true;
}
// Hält --rueck-h (Platz unter der Fußzeile, grundlage.css) auf der Höhe der Leiste, auch wenn ihr Text umbricht oder die Schrift wächst; ausgeblendet fällt er weg.
function rueckHoeheVerfolgen(leiste) {
  rueckBeobachter ??= new ResizeObserver(() => leiste.hidden ? document.body.style.removeProperty("--rueck-h") : document.body.style.setProperty("--rueck-h", leiste.offsetHeight + "px"));
  rueckBeobachter.observe(leiste);
}
// Stellt die Uhr der Leiste: nach ms schließt sie, außer Maus oder Fokus sind darin (dann noch einmal 5 s), spätestens nach 55 s ab der Aktion.
function rueckWarten(ms) {
  clearTimeout(rueckUhr);
  rueckUhr = setTimeout(() => {
    if (Date.now() >= rueckEnde) { rueckSchliessen(true); toast(RUECK_ABGELAUFEN); return; }
    if ($("#rueck").matches(":hover, :focus-within")) rueckWarten(Math.min(RUECK_NACH_MS, rueckEnde - Date.now()));
    else rueckSchliessen(true);
  }, ms);
}
// Schließt die Leiste; melden: dem Dienst das Ende sagen (Fehler egal, nach 60 s verfällt es dort ohnehin).
function rueckSchliessen(melden) {
  clearTimeout(rueckUhr);
  const id = rueckId;
  rueckId = null; $("#rueck").hidden = true; $("#rueck").replaceChildren();
  if (melden && id) api("POST", "/rueckgaengig/ende", {id}).catch(() => {});
}
// Am Handy: rollt die Seite so weit, dass die Elemente (der geänderte Tag und seine Knöpfe) über der Leiste stehen (bfc-20); den Platz dafür gibt die
// Fußzeile. Erst nach zwei Frames, weil die Leiste ihren Text im nächsten Frame bekommt. Am Rechner steht die Leiste über dem Inhalt, dort rollt nichts.
function rueckFreiRollen(...elemente) {
  if (document.body.dataset.design !== "handy") return;
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const leiste = $("#rueck"), da = elemente.filter(e => e?.isConnected);
    if (!da.length || leiste.hidden) return;
    const ueber = Math.max(...da.map(e => e.getBoundingClientRect().bottom)) + RUECK_LUFT - leiste.getBoundingClientRect().top;
    if (ueber > 0) scrollBy(0, ueber);
  }));
}
// Knopf „Rückgängig“ und Strg+Z: stellt die Tage der letzten Aktion zurück, zeichnet neu und setzt den Fokus auf den Tag (am Rechner auch die Spalte).
// Fehler (inzwischen geändert, abgelaufen) als Meldung; die Leiste schließt in jedem Fall.
async function rueckgaengig() {
  const id = rueckId;
  if (!id) return;
  rueckSchliessen(false);
  try { await api("POST", "/rueckgaengig", {id}); }
  catch (e) { toastFehler(e.message); return; }
  toast(RUECK_GEMACHT); await zeigen();
  const s = $("#tag-daneben");
  if (zeitDaneben() && !s.hidden) await tagBearbeiten(s.dataset.d);              // die Spalte zeigt den zurückgestellten Stand
  [...document.querySelectorAll(`#inhalt [data-d="${zeitDatum}"]`)].find(e => e.offsetParent)?.focus({preventScroll: true});
}
// Strg+Z / ⌘+Z bei offener Leiste (nicht beim Tippen in ein Feld, das prüft der Aufrufer vorher). Rückgabe true, wenn die Taste verbraucht ist.
function rueckTaste(e) {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z" || $("#rueck").hidden) return false;
  e.preventDefault(); rueckgaengig();
  return true;
}
// ---- bausteine/tagblatt.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Vermerk am Tag (konfig.VERMERKE, „—“ = keiner): ändert nichts an der Rechnung, zeigt nur Zeichen und Text am Tag.
const VERMERK_TEXT = {"": "—", dienstreise: "Dienstreise/Außentermin", fortbildung: "Fortbildung"};
const VERMERK_SYM = {dienstreise: '<rect x="3.5" y="7.5" width="17" height="12" rx="2.5"/><path d="M9 7.5V5.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5.5v2M3.5 12.5h17"/>',
  fortbildung: '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5zM20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z"/>'};
// Zeichen des Vermerks (Koffer oder Buch) am Tag in Monat, Woche und Tag; der Text steht daneben bzw. im Namen des Tages, darum aria-hidden. Ohne Vermerk leer.
const vermerkZeichen = v => VERMERK_SYM[v] ? `<span class="vermerk-zeichen" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24">${VERMERK_SYM[v]}</svg></span>` : "";
// Schnellwahl oben im Tag-Blatt (M2): Art, Text, Punkt der Farbe. Ein Tipp trägt den ganzen Tag ein.
const SCHNELLWAHL = [["ho", "Homeoffice", "ho"], ["dst", "Büro", "ds"], ["urlaub", "Urlaub", "a-urlaub"], ["krank", "Krank", "a-krank"], ["gleittag", "Gleittag", "a-gleittag"]];
const SCHNELL_ORT = ["ho", "dst"], SCHNELL_TEXT = {ho: "Homeoffice", dst: "Büro", urlaub: "Urlaub"};
const KD_SATZ = "Die fehlende Zeit bis zur Sollzeit des Tages füllt die App auf. Für die Quote zählt nur die gearbeitete Zeit.";
const VERMERK_HINWEIS = "Zählt nicht anders. Trag die Zeiten so ein, wie sie zählen.";
// Meldungen des Dienstes zu PUT /tag (routen_zeiten.py), die ein Feld eindeutig nennen: Textanfang und Feld (für formFehler)
const TAG_FEHLER_FELD = [["Kommen und Gehen", "#e-kommen"], ["Mehr Homeoffice", "#e-ho"], ["Mehr als 10 Stunden", "#e-frei"], ["Konto", "#e-konto"]];
// Gibt es die Schnellwahl im Profil? Homeoffice und Büro nur, wenn der Ort erfasst wird (nicht bei „nur Büro“ bzw. „nur Homeoffice“), Arten nur mit ihrem Modul.
const schnellwahlAn = a => SCHNELL_ORT.includes(a) ? !einOrt() || einOrt() === a : artAn(a);
// Meldung nach einer Schnellwahl, z. B. „Urlaub eingetragen.“; Arten ohne eigenes Wort mit ihrem Namen („Familientag eingetragen.“).
const schnellText = a => `${SCHNELL_TEXT[a] || ARTEN[a]} eingetragen.`;
// Knöpfe der Schnellwahl (nur, was Profil und Module kennen) und „Mehr“ (öffnet die Einzelheiten).
function schnellwahlHtml() {
  const knoepfe = SCHNELLWAHL.filter(([a]) => schnellwahlAn(a)).map(([a, t, p]) => `<button type="button" data-schnell="${a}"><i class="p ${p}" aria-hidden="true"></i>${t}</button>`);
  return `<div class="schnellwahl" role="group" aria-label="Ganzer Tag">${knoepfe.join("")}<button type="button" class="leise" data-schnell="mehr">Mehr</button></div>`;
}
// Angaben für PUT /tag zu einer Schnellwahl: Homeoffice oder Büro mit dem Tagessoll (soll_konto_min; Uhrzeiten fallen weg), sonst die Art ohne Zeiten.
// Notiz, Attest und Freigabe bleiben, den Vermerk behält der Dienst, weil er in der Anfrage fehlt. Rückgabe null für Homeoffice oder Büro an einem Tag
// ohne Soll: Dann gibt es keinen ganzen Tag einzutragen.
function schnellEintrag(art, z) {
  const ort = SCHNELL_ORT.includes(art), soll = z.soll_konto_min;
  if (ort && !(soll > 0)) return null;
  return {ho: art === "ho" ? hhmm(soll) : "", dst: art === "dst" ? hhmm(soll) : "", art: ort ? "" : (art === "krank" && z.attest ? "krank_attest" : art),
    notiz: z.notiz, attest: z.attest || "", freigabe: z.freigabe || 0};
}
// Blatt zum Eintragen und Ändern eines Tages: oben die Schnellwahl, darunter „Einzelheiten“ mit Stunden, Kommen–Gehen–Pause (auch mit Homeoffice- und
// Büro-Block), Art, Attest, Konto, Freigabe, Anmerkung und Vermerk. Gespeichert wird mit PUT /tag, danach steht die Rückgängig-Leiste da; Fehler erscheinen im
// Blatt, die Eingaben bleiben. Am Rechner steht das Formular im Bereich Zeit rechts daneben (#tag-daneben) statt im Blatt: Speichern schließt dann nichts,
// „Abbrechen“ setzt auf den gespeicherten Stand zurück, die erste Eingabe merkt die Spalte als geändert.
async function tagBearbeiten(datum) {
  const ziel = zeitDaneben() ? document.querySelector("#tag-daneben") : null, w = ziel || document.querySelector("#blatt-inh");
  const $ = s => w.querySelector(s);                     // alle Feldzugriffe über die Wurzel des Formulars: Spalte und Blatt stören sich nie
  // Der Tag kommt aus der zuletzt gezeigten Monats- oder Wochenseite. Kennt die ihn nicht (Aufruf von der Übersicht, anderer Monat, andere Woche),
  // wird sein Monat geholt: sonst öffnete sich nichts oder ein leeres Formular über einem Tag, der schon Einträge hat.
  let z = ((window.monatDaten || {}).tage || []).find(x => x.datum === datum);
  if (!z) {
    try { const m = await api("GET", `/monat/${+datum.slice(0, 4)}/${+datum.slice(5, 7)}`); window.famAktiv = m.familientage_aktiv; z = m.tage.find(x => x.datum === datum); }
    catch (e) { toastFehler(e.message); return; }
  }
  z = z || {datum, tag: +datum.slice(8), wt: "", ho: "", dst: "", art: "", notiz: "", konto: 0, feiertag: "", soll_zeit: "", vermerk: "", geprueft: 0};
  const optArt = Object.entries(ARTEN).filter(([k]) => (artAn(k) || z.art === k) && (k !== "familientag" || z.art === "familientag" || window.famAktiv) && (k !== "freizeit" || z.art === "freizeit" || !z.frei)).map(([k, v]) => `<option value="${k}" ${z.art === k ? "selected" : ""}>${v}</option>`).join("");
  zeigenIn(`<h3>${z.wt} ${z.tag}.${datum.slice(5, 7)}.${datum.slice(0, 4)}</h3>${z.feiertag ? `<div class="hinweis">${esc(z.feiertag)}</div>` : ""}${z.frei ? `<p class="hinweis">Arbeitszeit an diesem freien Tag kommt aufs <b>Freizeitkonto</b>, nicht in die Gleitzeit.</p>` : ""}
    ${schnellwahlHtml()}
    <details class="einzelheiten"${z.vermerk || z.kommen || z.notiz || (z.ho && z.dst) ? " open" : ""}><summary>Einzelheiten</summary>
    <div class="reihe"><div${ortVersteckt("ho", z.ho)}><label>Stunden HO</label><input id="e-ho" inputmode="numeric" placeholder="hh:mm" value="${z.ho}"></div>
    <div${ortVersteckt("dst", z.dst)}><label>Stunden Büro</label><input id="e-dst" inputmode="numeric" placeholder="hh:mm" value="${z.dst}"></div></div>
    <details class="vb" ${z.kommen ? "open" : ""}><summary>Kommen – Gehen – Pause</summary>
      ${einOrt() ? festerOrt("e-ort") : `<label>Wo?</label><div class="seg" id="e-ort">${[["ho", "Homeoffice"], ["dst", "Büro"], ["beides", "Beides"]].map(([k, t]) => `<button type="button" data-v="${k}" class="${k === (z.ho && z.dst ? "beides" : z.dst ? "dst" : "ho") ? "on" : ""}">${t}</button>`).join("")}</div>`}
      <div id="e-bloecke" data-stil="display:none"><div class="reihe"><div><label>Homeoffice von</label><input id="e-hv" inputmode="numeric" placeholder="07:30"></div><div><label>Homeoffice bis</label><input id="e-hb" inputmode="numeric" placeholder="11:00"></div></div>
      <div class="reihe"><div><label>Büro von</label><input id="e-dv" inputmode="numeric" placeholder="12:00"></div><div><label>Büro bis</label><input id="e-db" inputmode="numeric" placeholder="16:00"></div></div></div>
      <div class="reihe"><div class="e-kg-feld"><label>Kommen</label><input id="e-kommen" inputmode="numeric" placeholder="07:30" value="${z.kommen || ""}"></div><div class="e-kg-feld"><label>Gehen</label><input id="e-gehen" inputmode="numeric" placeholder="16:00" value="${z.gehen || ""}"></div>
      <div><label>Pause</label><input id="e-pause" inputmode="numeric" placeholder="hh:mm" value="${z.kommen ? z.pause : ""}" data-eigen="${z.kommen && minuten(z.pause) !== pauseAuto(minuten(z.gehen) - minuten(z.kommen)) ? 1 : ""}"></div></div>
      <div id="e-kg" class="hinweis">Die Pause wird nach der Pausenregel vorbelegt (${pausenText()}, unter „Regeln“ einstellbar) und lässt sich ändern.</div></details>
    <label>Art des Tages</label><select id="e-art">${optArt}</select>
    <div id="kd-hinweis" hidden><p class="hinweis">${KD_SATZ}</p>${z.aufgefuellt_min > 0 ? `<p class="hinweis">Aufgefüllt: ${esc(z.aufgefuellt)} Std.</p>` : ""}</div>
    <div id="attest-zeile" data-stil="display:none"><label>Attest abgegeben am <small>(gilt für alle zusammenhängenden Kranktage; Datum löschen entfernt es für die ganze Folge)</small></label><input id="e-attest" type="date" value="${esc(z.attest || "")}"></div>
    <div id="konto-zeile" data-stil="display:none"><label>Konto (angesparter Urlaub)</label><select id="e-konto"></select></div>
    <div class="zeile"><span>Über 10 Stunden freigegeben<br><small>sonst höchstens 10 Stunden Arbeitszeit pro Tag</small></span><input type="checkbox" id="e-frei" ${z.freigabe ? "checked" : ""} aria-label="Über 10 Stunden freigegeben"></div>
    <label>Anmerkung</label><input id="e-notiz" value="${esc(z.notiz)}">
    <label>Vermerk</label><div class="seg vermerk" id="e-vermerk">${Object.entries(VERMERK_TEXT).map(([k, t]) => `<button type="button" data-v="${k}" class="${k === (z.vermerk || "") ? "on" : ""}">${esc(t).replaceAll("/", "/<wbr>")}</button>`).join("")}</div>
    <p class="hinweis">${VERMERK_HINWEIS}</p>
    <div id="geprueft-zeile"${z.vermerk ? "" : " hidden"}><div class="zeile"><span>Zeiten geprüft</span><input type="checkbox" id="e-geprueft" ${z.geprueft ? "checked" : ""} aria-label="Zeiten geprüft"></div></div></details>
    <div id="e-fehler"></div>
    <div class="knoepfe"><button class="prim" id="e-ok">Speichern</button><button id="e-leer" class="gef">Leeren</button><button id="e-zu">Abbrechen</button></div>`);
  // Schreibt das Formular in die Spalte (eine Karte neben der Ansicht, ohne Blatt) oder ins Blatt.
  function zeigenIn(html) {
    if (!ziel) { blatt(html); return; }
    ziel.innerHTML = `<div class="card">${html}</div>`; beschriften(ziel); ziel.hidden = false;
    ziel.dataset.d = datum; delete ziel.dataset.geaendert;
    zeitDatum = datum; zeitMarkieren();                  // auch „Heute eintragen“: gemeinsames Datum und Markierung folgen der Spalte
    ziel.oninput = () => { ziel.dataset.geaendert = 1; };
  }
  // Normalisiert ein Zeitfeld beim Verlassen zu hh:mm.
  const norm = id => { const e = $(id); e.onblur = () => e.value = zeitNorm(e.value); };
  norm("#e-ho"); norm("#e-dst");
  // Gewählter Vermerk („“ = keiner); der Haken „Zeiten geprüft“ erscheint nur mit Vermerk.
  const vermerkWert = () => $("#e-vermerk button.on")?.dataset.v || "";
  w.querySelectorAll("#e-vermerk button").forEach(b => b.onclick = () => {
    w.querySelectorAll("#e-vermerk button").forEach(x => x.classList.toggle("on", x === b));
    $("#geprueft-zeile").hidden = !vermerkWert();
    if (ziel) ziel.dataset.geaendert = 1;
  });
  // Zeigt je nach Art die Zeile für das Konto (angesparter Urlaub) oder das Attest; die Konten werden erst bei Bedarf geladen.
  async function kontoZeigen() {
    const an = $("#e-art").value === "angespart";
    $("#konto-zeile").style.display = an ? "" : "none";
    $("#attest-zeile").style.display = ["krank", "krank_attest"].includes($("#e-art").value) ? "" : "none";
    $("#kd-hinweis").hidden = $("#e-art").value !== "krank_dienst";
    if (!an || $("#e-konto").dataset.geladen) return;
    const u = await api("GET", `/urlaub/${datum.slice(0, 4)}`);
    $("#e-konto").dataset.geladen = 1;
    $("#e-konto").innerHTML = `<option value="0">automatisch (ältestes zuerst)</option>` + u.konten.filter(k => k.nutzbar && (k.rest >= 1 || k.herkunft === z.konto))
      .map(k => `<option value="${k.herkunft}" ${k.herkunft === z.konto ? "selected" : ""}>aus ${k.herkunft}: ${komma(k.rest)} frei</option>`).join("");
  }
  $("#e-art").onchange = kontoZeigen; kontoZeigen();
  $("#e-zu").onclick = () => ziel ? tagBearbeiten(datum) : blattZu();
  artBinden("e-ort");
  // Mit Kommen und Gehen rechnet die App die Arbeitszeit (Gehen − Kommen − Pause) und trägt sie bei HO bzw. Büro ein; bei „Beides“ ist „Stunden HO“ der HO-Anteil.
  // „Beides“: Homeoffice und Büro mit eigenen Zeiten. Kommen = früherer Beginn, Gehen = späteres Ende, die Lücke dazwischen ist Pause.
  // Verlangt die Pausenregel mehr als die Lücke, geht der Rest vom späteren Block ab. Gespeichert werden Kommen, Gehen, Pause und der HO-Anteil.
  const bloecke = () => {
    const w = id => zeitNorm($(id).value), hv = w("#e-hv"), hb = w("#e-hb"), dv = w("#e-dv"), db = w("#e-db");
    if (!(hv && hb && dv && db)) return null;
    const h = [minuten(hv), minuten(hb)], d = [minuten(dv), minuten(db)];
    if (h[1] <= h[0] || d[1] <= d[0]) return {fehler: "Bei jedem Block muss „bis“ nach „von“ liegen."};
    const [erst, dann] = h[0] <= d[0] ? [h, d] : [d, h];
    if (dann[0] < erst[1]) return {fehler: "Homeoffice und Büro überschneiden sich."};
    const kommen = erst[0], gehen = dann[1], luecke = dann[0] - erst[1], spanne = gehen - kommen;
    const eigen = !!$("#e-pause").dataset.eigen, pause = eigen ? minuten(pauseNorm($("#e-pause").value)) : Math.max(luecke, pauseAuto(spanne));
    if (pause < luecke) return {fehler: `Die Pause muss mindestens die Zeit zwischen den Blöcken sein (${zeitText(luecke)}).`};
    const abzug = pause - luecke, hoMin = (h[1] - h[0]) - (dann === h ? abzug : 0), dstMin = (d[1] - d[0]) - (dann === d ? abzug : 0);
    if (hoMin <= 0 || dstMin <= 0) return {fehler: "Die Pause ist länger als ein Block."};
    return {kommen: hhmm(kommen), gehen: hhmm(gehen), pause, eigen, hoMin, dstMin};
  };
  // Rechnet aus Kommen, Gehen und Pause (bei „Beides“ aus den beiden Blöcken) die Arbeitszeit und füllt Felder und Hinweis.
  const kg = () => {
    const mitBloecken = artWert("e-ort") === "beides";
    $("#e-bloecke").style.display = mitBloecken ? "" : "none";
    w.querySelectorAll(".e-kg-feld").forEach(e => e.style.display = mitBloecken ? "none" : "");
    if (mitBloecken) {
      const b = bloecke();
      if (!b) { $("#e-kg").textContent = "Trag die Zeiten im Homeoffice und im Büro ein. Die Lücke dazwischen zählt als Pause."; return; }
      if (b.fehler) { $("#e-kg").innerHTML = meldung(b.fehler); return; }
      $("#e-kommen").value = b.kommen; $("#e-gehen").value = b.gehen;
      if (!b.eigen) $("#e-pause").value = hhmm(b.pause);
      $("#e-ho").value = hhmm(b.hoMin); $("#e-dst").value = hhmm(b.dstMin);
      $("#e-kg").textContent = `Arbeitszeit ${zeitText(b.hoMin + b.dstMin)} Std. (HO ${zeitText(b.hoMin)}, Büro ${zeitText(b.dstMin)}), ${b.kommen}–${b.gehen}, Pause ${zeitText(b.pause)} ${b.eigen ? "(selbst eingetragen)" : "(Lücke und Pausenregel)"}`;
      return;
    }
    const k = $("#e-kommen").value, g = $("#e-gehen").value;
    if (!k || !g) return;
    const spanne = minuten(zeitNorm(g)) - minuten(zeitNorm(k)), eigen = !!$("#e-pause").dataset.eigen, pause = eigen ? minuten(pauseNorm($("#e-pause").value)) : pauseAuto(spanne), arbeit = spanne - pause, ort = artWert("e-ort");
    if (!eigen && spanne > 0) $("#e-pause").value = hhmm(pause);
    if (spanne <= 0 || arbeit <= 0) { $("#e-kg").innerHTML = meldung("„Gehen“ muss nach „Kommen“ liegen, und die Pause muss kürzer sein als die Zeit dazwischen (nach Mitternacht: z. B. 26:00)."); return; }
    if (ort === "ho") { $("#e-ho").value = hhmm(arbeit); $("#e-dst").value = ""; }
    else if (ort === "dst") { $("#e-dst").value = hhmm(arbeit); $("#e-ho").value = ""; }
    else $("#e-dst").value = hhmm(Math.max(0, arbeit - minuten(zeitNorm($("#e-ho").value))));
    $("#e-kg").textContent = `Arbeitszeit ${zeitText(arbeit)} Std., Pause ${zeitText(pause)} ${eigen ? "(selbst eingetragen)" : "(nach Pausenregel)"}${ort === "beides" ? " · „Stunden HO“ ist der HO-Anteil, der Rest zählt als Büro" : ""}`;
  };
  ["#e-kommen", "#e-gehen"].forEach(id => $(id).onblur = e => { e.target.value = zeitNorm(e.target.value); kg(); });
  $("#e-pause").onblur = e => { e.target.value = pauseNorm(e.target.value); e.target.dataset.eigen = e.target.value ? 1 : ""; kg(); };     // leeren: wieder nach Regel
  $("#e-ho").addEventListener("blur", kg);
  ["#e-hv", "#e-hb", "#e-dv", "#e-db"].forEach(id => $(id).onblur = e => { e.target.value = zeitNorm(e.target.value); kg(); });
  w.querySelectorAll("#e-ort button").forEach(b => b.addEventListener("click", kg));
  kg();
  // Speichert den Tag, schließt das Blatt, bietet Rückgängig an (text: Meldung der Leiste), zeichnet neu und setzt den Fokus zurück auf den Tag.
  const senden = async (daten, text = "Gespeichert.") => {
    try {
      const r = await api("PUT", "/tag", {datum, ...daten}); if (!ziel) blattZu();
      rueckgaengigZeigen(r, text) || toast(text); await zeigen();
      if (ziel) await tagBearbeiten(datum);                                  // die Spalte zeigt den gespeicherten Stand
      const tag = [...document.querySelectorAll(`#inhalt [data-d="${datum}"]`)].find(e => e.offsetParent);
      tag?.focus({preventScroll: true}); rueckFreiRollen(tag, document.querySelector("#inhalt .schnell"));   // Tastatur und Screenreader bleiben beim Tag, die Leiste verdeckt weder ihn noch seine Knöpfe
    } catch (e) { formFehler($("#e-fehler"), e.message, {felder: TAG_FEHLER_FELD}); }
  };
  $("#e-ok").onclick = gesperrt(() => {
    let art = $("#e-art").value; const attest = $("#e-attest").value;
    if (attest && art === "krank") art = "krank_attest";
    return senden({ho: zeitNorm($("#e-ho").value), dst: zeitNorm($("#e-dst").value), kommen: zeitNorm($("#e-kommen").value), gehen: zeitNorm($("#e-gehen").value), pause: $("#e-pause").dataset.eigen || (artWert("e-ort") === "beides" && $("#e-kommen").value) ? pauseNorm($("#e-pause").value) : "", ort: artWert("e-ort"), art, notiz: $("#e-notiz").value, vermerk: vermerkWert(), geprueft: $("#e-geprueft").checked && vermerkWert() ? 1 : 0, konto: +($("#e-konto").value || 0), freigabe: $("#e-frei").checked, attest: ["krank", "krank_attest"].includes(art) ? attest : ""});
  });
  $("#e-leer").onclick = gesperrt(() => senden({ho: "", dst: "", art: "", notiz: "", vermerk: "", geprueft: 0}, "Tag geleert."));
  // Schnellwahl: ein Tipp speichert den ganzen Tag. „Mehr“ und Homeoffice/Büro ohne Soll öffnen stattdessen die Einzelheiten.
  const schnellWaehlen = art => {
    const daten = art === "mehr" ? null : schnellEintrag(art, z);
    if (daten) return senden(daten, schnellText(art));
    $(".einzelheiten").open = true; $(SCHNELL_ORT.includes(art) ? "#e-" + art : "#e-art").focus();
  };
  w.querySelectorAll("[data-schnell]").forEach(b => b.onclick = gesperrt(() => schnellWaehlen(b.dataset.schnell)));
}
// Kachel eines Tages (Ist, Soll, Saldo; Saldo nur bis heute) mit Titel, z. B. „Heute, Mi 19.“ (Woche) oder „Mo 23.02.“ (Tag-Reiter); ohne Tag leer.
function tagKarteHtml(t, vorz, titel) {
  if (!t) return "";
  const kopf = `<h2>${esc(titel)}</h2>`;
  if (t.soll_min === 0 && t.arbeit_min === 0) return `<div class="card">${kopf}<div class="zeile gr"><span>Ist</span><b>${zeitText(t.ist_min || 0)}</b></div>
    <div class="zeile gr"><span>${t.feiertag ? esc(t.feiertag) : "Freier Tag"}</span><b>${t.freizeit ? `<span class="saldo ${vorz(t.freizeit_min)}">Freizeit ${t.freizeit}</span>` : "kein Soll"}</b></div></div>`;
  const saldo = t.ist_soll_min - t.arbeit_min;                 // Ist mit Auffüllung bei „Krank im Dienst“ (zählt für Soll und Ist, U3a); ein Tag nach heute zählt im Kern noch nicht zum Saldo
  return `<div class="card">${kopf}<div class="zeile gr"><span>Ist</span><b>${zeitText(t.ist_soll_min)}</b></div><div class="zeile gr"><span>Soll</span><b>${zeitText(t.arbeit_min)}</b></div>
    ${t.zukunft ? "" : `<div class="zeile gr"><span>Saldo</span><b class="saldo ${vorz(saldo)}">${zeitText(saldo, true)}</b></div>`}
    ${t.aufgefuellt_min > 0 ? `<p class="hinweis">davon Krank im Dienst aufgefüllt ${esc(t.aufgefuellt)}</p>` : ""}
    ${t.art ? `<div class="zeile gr"><span>Art</span><b>${ARTEN[t.art]}</b></div>` : ""}</div>`;
}
// Kennzeichen eines Tages für Zeilen in Monat, Woche und Tag: Homeoffice, Büro, Art und das Zeichen des Vermerks.
const tagChips = z => [z.ho ? `<span class="chip ho">HO ${z.ho}</span>` : "", z.dst ? `<span class="chip ds">Büro ${z.dst}</span>` : "",
  z.art ? `<span class="chip art a-${z.art}">${ARTEN[z.art]}</span>` : "", vermerkZeichen(z.vermerk)].join("");
// Text unter den Kennzeichen (noch nicht maskiert): Feiertag, Kommen–Gehen, Vermerk vor der Notiz („Fortbildung · Kurs“), Auffüllung bei „Krank im Dienst“.
const tagInfo = z => [z.feiertag, uhrText(z), z.vermerk ? VERMERK_TEXT[z.vermerk] : "", z.notiz,
  z.aufgefuellt ? `aufgefüllt ${z.aufgefuellt}` : ""].filter(Boolean).join(" · ");
// Text ohne Eintrag: bis heute der Hinweis auf den fehlenden Eintrag, ein späterer Arbeitstag blass sein Soll (soll_min aus /woche; nur Anzeige, ohne Saldo).
// Freie Tage, Feiertage und Tage mit 0 Minuten Soll bleiben leer.
function tagLeerHtml(z) {
  if (z.zukunft) return z.soll_min > 0 ? `<span class="leer-tag soll-spaeter">Soll ${zeitText(z.soll_min)}</span>` : "";
  return z.soll ? '<span class="leer-tag">noch nichts eingetragen</span>' : "";
}
// Zeile eines Tages (Woche und Tag-Reiter): Datum, HO/Büro, Art, Feiertag, Kommen–Gehen, Vermerk, Notiz, Ist (mit Auffüllung) und Saldo; heute hervorgehoben.
function tagZeileHtml(z, heuteIso, vorz) {
  const chips = tagChips(z), info = tagInfo(z);
  return `<div class="tag ${z.frei ? "frei" : ""} ${z.datum === heuteIso ? "heute" : ""}" data-d="${z.datum}"><div class="dat"><b>${z.tag}</b><small>${z.wt}</small></div>
      <div class="mitte"><div class="zeiten">${chips || tagLeerHtml(z)}</div>${info ? `<div class="info">${esc(info)}</div>` : ""}</div>
      <div class="ist">${z.ist_soll_min ? zeitText(z.ist_soll_min) : ""}${z.saldo && !z.zukunft ? `<small class="saldo ${vorz(z.saldo_min)}">${z.saldo}</small>` : ""}${z.freizeit && !z.zukunft ? `<small class="saldo ${vorz(z.freizeit_min)}"${md("freizeit")}>Freizeit ${z.freizeit}</small>` : ""}</div></div>`;
}
// Hat der Tag irgendeinen Eintrag (Zeiten, Art, Notiz oder Vermerk)?
const tagHatEintrag = z => !!(z.ho || z.dst || z.art || z.notiz || z.vermerk);
// Leerzustand der Zeit-Reiter (funktionen.md 6.3): Karte mit Symbol, Satz und Knopf, wenn im gezeigten Zeitraum kein Tag einen Eintrag hat, sonst leer.
function zeitLeerHtml(tage) {
  if (tage.some(tagHatEintrag)) return "";
  return `<div class="card leer zeit-leer">${sym("monat")}<p>Noch nichts eingetragen.</p><button type="button" class="prim" ${kl("heuteEintragen")}>Heute eintragen</button></div>`;
}
const RASTER_SCHRITT = {"ArrowLeft": -1, "ArrowRight": 1, "ArrowUp": -7, "ArrowDown": 7};   // Pfeile im Raster: ein Tag bzw. eine Woche
// Pfeiltasten auf einem Tag im Monats-Raster (hier, weil die Grundlage keine Seite aufruft): ← → ein Tag, ↑ ↓ eine Woche, nur innerhalb des Monats (Blättern bleibt bei ‹ › und den Pfeilen außerhalb).
// Rückgabe true, wenn die Taste verbraucht ist.
function rasterTaste(e) {
  const tag = document.activeElement?.closest?.("#inhalt .kz[data-d]"), schritt = RASTER_SCHRITT[e.key];
  if (!tag || !schritt || e.altKey || e.ctrlKey || e.metaKey) return false;
  const tage = [...document.querySelectorAll("#inhalt .kz[data-d]")];
  e.preventDefault(); tage[tage.indexOf(tag) + schritt]?.focus();
  return true;
}
// ---- bausteine/zeitnavi.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Bereich Zeit (Tag, Woche, Monat): ein gemeinsames Datum, Blättern, „Heute“, Kalender, Wischen und am Rechner der Tag rechts daneben.
// Die Regeln stehen in reinen Funktionen (ohne DOM, Adresse und Uhr, „heute“ kommt als Parameter), damit die Tests sie in Node nachrechnen.
const ZEIT_SEITEN = ["tag", "woche", "monat"];
const ZEIT_JAHR_MIN = 1970, ZEIT_JAHR_MAX = 2200, ZEIT_BEARBEITEN = "bearbeiten";
const ZEIT_KAL_GRENZEN = `min="${ZEIT_JAHR_MIN}-01-01" max="${ZEIT_JAHR_MAX}-12-31"`;   // Datumsfeld im Kopf: nur, was zeitParameter annimmt
const ZEIT_TAGE = "#inhalt .tag[data-d], #inhalt .kz[data-d]";        // antippbare Tage in Tag, Woche und Monat
const WISCH_STRECKE = 60, WISCH_DAUER_MS = 600, WISCH_RAND = 24;
const WISCH_NICHT = "input, select, textarea, .tbl, [role=tablist], #tag-daneben";

// ---- Reine Regeln
// ISO-Datum (JJJJ-MM-TT) als Date um 12 Uhr Ortszeit: Tage zählen so auch über die Zeitumstellung richtig.
function isoZuDatum(t) {
  return new Date(+t.slice(0, 4), +t.slice(5, 7) - 1, +t.slice(8, 10), 12);
}
// Date als ISO-Datum (JJJJ-MM-TT, Ortszeit).
function datumZuIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// Kalenderwoche nach ISO 8601 als [KW-Jahr, KW]: Der Donnerstag der Woche bestimmt das Jahr (29.12.2025 → [2026, 1], 01.01.2027 → [2026, 53]).
function kwJahr(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())), n = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - n);
  return [t.getUTCFullYear(), Math.ceil(((t - Date.UTC(t.getUTCFullYear(), 0, 1)) / 864e5 + 1) / 7)];
}
// Zeitraum [von, bis] (ISO) eines Tages, seiner Woche (Montag bis Sonntag) oder seines Monats.
function zeitZeitraum(seite, t) {
  const d = isoZuDatum(t);
  if (seite === "tag") return [t, t];
  if (seite === "woche") {
    d.setDate(d.getDate() - ((d.getDay() || 7) - 1));
    const bis = new Date(d); bis.setDate(bis.getDate() + 6);
    return [datumZuIso(d), datumZuIso(bis)];
  }
  return [datumZuIso(new Date(d.getFullYear(), d.getMonth(), 1, 12)), datumZuIso(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))];
}
// Prüft eine Zeit-Adresse (#/tag/D[/bearbeiten], #/woche/J/KW, #/monat/J/M, #/monatsnachweis/J/M), bevor sie gilt.
// Eingaben: teile der Adresse (ohne „#/“), heuteIso. Rückgabe {gueltig, bearbeiten, von, bis}; ungültig (auch Jahr außerhalb 1970 bis 2200,
// KW 53 in einem Jahr ohne KW 53, ein dritter Teil außer „bearbeiten“) liefert den Zeitraum von heute, ohne Fehler und ohne Meldung.
function zeitParameter(teile, heuteIso) {
  const [seite, a, b, rest] = teile, ganz = (x, min, max) => /^\d{1,4}$/.test(x || "") && +x >= min && +x <= max;
  const art = seite === "monatsnachweis" ? "monat" : seite;
  let start = null, bearbeiten = false;
  if (art === "tag" && /^\d{4}-\d\d-\d\d$/.test(a || "") && (b === undefined || b === ZEIT_BEARBEITEN) && rest === undefined && datumZuIso(isoZuDatum(a)) === a && ganz(a.slice(0, 4), ZEIT_JAHR_MIN, ZEIT_JAHR_MAX)) {
    start = a; bearbeiten = b === ZEIT_BEARBEITEN;
  } else if (art === "monat" && rest === undefined && ganz(a, ZEIT_JAHR_MIN, ZEIT_JAHR_MAX) && ganz(b, 1, 12)) {
    start = `${a}-${b.padStart(2, "0")}-01`;
  } else if (art === "woche" && rest === undefined && ganz(a, ZEIT_JAHR_MIN, ZEIT_JAHR_MAX) && ganz(b, 1, 53) && (+b < 53 || kwJahr(new Date(+a, 11, 28))[1] === 53)) {
    const vierter = new Date(+a, 0, 4, 12);                                     // der 4. Januar liegt immer in KW 1
    vierter.setDate(vierter.getDate() - ((vierter.getDay() || 7) - 1) + (+b - 1) * 7);
    start = datumZuIso(vierter);
  }
  const [von, bis] = zeitZeitraum(art, start || heuteIso);
  return {gueltig: !!start, bearbeiten, von, bis};
}
// Datum nach dem Öffnen einer Adresse: #/tag/D setzt D; ohne Parameter bleibt altIso; ungültig heute. Sonst bleibt altIso, wenn es im Zeitraum
// liegt (Tag → Woche → Tag behält den Tag), dann heute, wenn heute darin liegt, sonst der Montag der KW bzw. der Erste des Monats.
function zeitDatumFuer(teile, altIso, heuteIso) {
  if (teile.length < 2) return altIso;
  const p = zeitParameter(teile, heuteIso), drin = t => t >= p.von && t <= p.bis;
  if (!p.gueltig) return heuteIso;
  if (teile[0] === "tag") return p.von;
  return drin(altIso) ? altIso : drin(heuteIso) ? heuteIso : p.von;
}
// Blättert ein Datum um r (−1 oder +1): Tag ±1 Tag, Woche ±7 Tage, Monat ±1 Monat mit dem Tag auf das Monatsende gekappt (31.01. → 28.02., im Schaltjahr 29.02.).
function zeitBlaetternDatum(seite, t, r) {
  const d = isoZuDatum(t);
  if (seite === "monat") {
    const ende = new Date(d.getFullYear(), d.getMonth() + r + 1, 0, 12);
    return datumZuIso(new Date(ende.getFullYear(), ende.getMonth(), Math.min(d.getDate(), ende.getDate()), 12));
  }
  d.setDate(d.getDate() + r * (seite === "woche" ? 7 : 1));
  return datumZuIso(d);
}
// Nur die Nummer der Kalenderwoche (der Monat vergleicht und schreibt sie als Zahl).
function isoKw(d) {
  return kwJahr(d)[1];
}

// ---- Gemeinsames Datum und Adressen
// Heutiges Datum als ISO-Text.
function zeitHeuteIso() { return iso(heute.getFullYear(), heute.getMonth() + 1, heute.getDate()); }
// Gewählter Tag im Bereich Zeit (Start heute); geht nur geprüft über zeitParameter hinein.
let zeitDatum = zeitHeuteIso();
// Adresse eines Zeit-Reiters zu einem Datum: #/tag/D, #/woche/<KW-Jahr>/<KW>, #/monat/J/M.
function zeitAdresse(seite, t) {
  if (seite === "tag") return `#/tag/${t}`;
  if (seite === "woche") return "#/woche/" + kwJahr(isoZuDatum(t)).join("/");
  return `#/monat/${+t.slice(0, 4)}/${+t.slice(5, 7)}`;
}
// Übernimmt beim Zeichnen von Tag, Woche oder Monat das Datum aus der Adresse (Regeln oben) und setzt jahr und monat mit (Spielraum, Export).
// Rückgabe: das gültige Datum.
function zeitAnkommen() {
  zeitDatum = zeitDatumFuer(hashTeile(), zeitDatum, zeitHeuteIso());
  jahr = +zeitDatum.slice(0, 4); monat = +zeitDatum.slice(5, 7);
  return zeitDatum;
}
// Öffnet den Tag zum Bearbeiten (#/tag/D/bearbeiten): Blatt am Handy, Spalte am Rechner, Fokus auf deren Überschrift.
// Die Adresse verliert danach „/bearbeiten“, damit das Neuzeichnen nach dem Speichern das Blatt nicht wieder öffnet.
async function zeitBearbeitenOeffnen(d) {
  history.replaceState(null, "", zeitAdresse("tag", d));
  await tagBearbeiten(d);
  const h3 = document.querySelector(zeitDaneben() ? "#tag-daneben h3" : "#blatt-inh h3");
  if (h3) { h3.tabIndex = -1; h3.focus({preventScroll: true}); }
}

// ---- Blättern, Heute, Kalender
// Blättert den aktuellen Zeit-Reiter um r (−1 zurück, +1 vor); der Monat öffnet dabei oben (Entscheidung vom 19.11.2026).
async function zeitBlaettern(r) {
  const seite = document.body.dataset.seite;
  if (!ZEIT_SEITEN.includes(seite) || !(await zeitVerwerfenOk())) return;
  zeitDatum = zeitBlaetternDatum(seite, zeitDatum, r);
  zeitGehen(seite);
}
// „Heute“ (Knopf und Taste T): heute im aktuellen Reiter; nur der Monat holt den heutigen Tag in die Mitte.
async function zeitHeute() {
  const seite = document.body.dataset.seite;
  if (!ZEIT_SEITEN.includes(seite) || !(await zeitVerwerfenOk())) return;
  zeitDatum = zeitHeuteIso();
  if (seite === "monat") window.scrollHeute = true;
  zeitGehen(seite);
}
// Öffnet den Kalender des Geräts für das Datumsfeld im Kopf.
function zeitKalender(feld) { kalenderOeffnen(feld); }
// Im Kalender gewähltes Datum: wird zeitDatum, der Reiter bleibt. Ein ungültiges Datum (leer, außerhalb 1970 bis 2200) ändert nichts.
async function zeitKalenderDatum(t) {
  const seite = document.body.dataset.seite;
  if (!ZEIT_SEITEN.includes(seite) || !zeitParameter(["tag", t], zeitHeuteIso()).gueltig || !(await zeitVerwerfenOk())) return;
  zeitDatum = t;
  zeitGehen(seite);
}
// Öffnet die Adresse zu zeitDatum; ist sie schon offen, wird nur neu gezeichnet.
function zeitGehen(seite) {
  const ziel = zeitAdresse(seite, zeitDatum);
  if (location.hash === ziel) zeigen(); else location.hash = ziel;
}
// Tastengriff für Tag, Woche und Monat: ← und → blättern, T springt zu heute. Nicht in der Reiterleiste, nicht in der Spalte und nicht mit Alt, Strg
// oder Cmd (Alt+← ist „Zurück“ im Browser). Rückgabe true, wenn die Taste verbraucht ist.
function zeitTaste(e) {
  if (!ZEIT_SEITEN.includes(document.body.dataset.seite) || e.altKey || e.ctrlKey || e.metaKey || document.activeElement?.closest("[role=tablist], #tag-daneben")) return false;
  if (e.key === "ArrowLeft" || e.key === "ArrowRight") { zeitBlaettern(e.key === "ArrowLeft" ? -1 : 1); return true; }
  if (e.key === "t" || e.key === "T") { zeitHeute(); return true; }
  return false;
}

// ---- Wischen (nur Tag, Woche, Monat; ohne Animation)
let wischAnfang = null;
// Merkt den Anfang einer Geste mit Finger oder Stift, außer im Blatt, in Feldern, Tabellen, Reitern, in der Spalte und am Rand (Zurück-Gesten von iOS und Android).
function wischStart(e) {
  wischAnfang = ZEIT_SEITEN.includes(document.body.dataset.seite) && ["touch", "pen"].includes(e.pointerType) && !$("#blatt").classList.contains("auf")
    && !e.target.closest(WISCH_NICHT) && e.clientX >= WISCH_RAND && e.clientX <= innerWidth - WISCH_RAND ? {x: e.clientX, y: e.clientY, t: e.timeStamp} : null;
}
// Blättert bei einer schnellen waagrechten Geste (mind. 60 px, doppelt so weit wie senkrecht, unter 600 ms): nach links vor, nach rechts zurück.
function wischEnde(e) {
  const a = wischAnfang; wischAnfang = null;
  if (!a) return;
  const dx = e.clientX - a.x, dy = e.clientY - a.y;
  if (Math.abs(dx) >= WISCH_STRECKE && Math.abs(dx) > 2 * Math.abs(dy) && e.timeStamp - a.t < WISCH_DAUER_MS) zeitBlaettern(dx < 0 ? 1 : -1);
}
// Bindet das Wischen an ein Element (#inhalt); ein abgebrochener Zeiger (Scrollen) löst nichts aus.
function zeitWischen(feld) {
  feld.addEventListener("pointerdown", wischStart);
  feld.addEventListener("pointerup", wischEnde);
  feld.addEventListener("pointercancel", () => { wischAnfang = null; });
}

// ---- Am Rechner: Tag rechts daneben (#tag-daneben, außerhalb von #inhalt, damit Eingaben das Neuzeichnen überstehen)
// Steht das Formular rechts daneben? Nur im Design „web“ auf Tag, Woche und Monat; sonst das Blatt.
function zeitDaneben() { return document.body.dataset.design === "web" && ZEIT_SEITEN.includes(document.body.dataset.seite); }
// Leert und versteckt die Spalte (Bereich Zeit verlassen, Wechsel aufs Handy-Design); ohne Rückfrage, ein Seitenwechsel lässt sich nicht aufhalten.
function zeitDanebenZu() {
  const s = $("#tag-daneben");
  s.hidden = true; s.innerHTML = ""; delete s.dataset.geaendert; delete s.dataset.d;
}
// Fragt vor dem Wechsel des Tages, wenn die Spalte ungesicherte Änderungen hat. Rückgabe true, wenn weitergehen darf.
async function zeitVerwerfenOk() {
  const s = $("#tag-daneben");
  if (s.hidden || !s.dataset.geaendert) return true;
  const ok = await frage(`Änderungen am ${s.dataset.d.slice(8)}.${s.dataset.d.slice(5, 7)}. verwerfen?`, "Verwerfen");
  if (ok) delete s.dataset.geaendert;
  return ok;
}
// Markiert den gewählten Tag links (Klasse gew, aria-current="date"), nur wenn die Spalte daneben steht.
function zeitMarkieren() {
  document.querySelectorAll(ZEIT_TAGE).forEach(e => {
    const an = zeitDaneben() && e.dataset.d === zeitDatum;
    e.classList.toggle("gew", an);
    if (an) e.setAttribute("aria-current", "date"); else e.removeAttribute("aria-current");
  });
}
// Nach jedem Zeichnen von Tag, Woche oder Monat: Tage antippbar machen, den gewählten markieren und die Spalte auf zeitDatum bringen
// (nur wenn sie einen anderen Tag zeigt, sonst gingen Eingaben verloren).
function zeitSpalte() {
  document.querySelectorAll(ZEIT_TAGE).forEach(e => e.onclick = () => zeitTagWaehlen(e.dataset.d));
  zeitMarkieren();
  const s = $("#tag-daneben");
  if (zeitDaneben() && (s.hidden || s.dataset.d !== zeitDatum)) tagBearbeiten(zeitDatum);
}
// Tippen oder Enter auf einen Tag links: am Rechner wird er zeitDatum und steht in der Spalte, am Handy öffnet das Blatt.
async function zeitTagWaehlen(d) {
  if (!zeitDaneben()) return tagBearbeiten(d);
  if (d === zeitDatum && !$("#tag-daneben").hidden) return;
  if (!(await zeitVerwerfenOk())) return;
  zeitDatum = d; zeitMarkieren();
  return tagBearbeiten(d);
}
// ---- seiten/start.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// ---- Karte „Zu tun“ (Auftrag 18.11.2026): Hinweise vom Rechenkern (GET /api/zutun), auf der Übersicht unter Heute und Quote
const ZUTUN_SPAETER_TAGE = 7;
// Zahl und Einheit bleiben in einer Zeile („50,07 %“, „9 Tage“): geschütztes Leerzeichen statt Leerzeichen.
const einheitFest = s => String(s).replace(/ /g, "\u00a0");
const ZUTUN_RELEASE = "https://github.com/davidsaluda/zeiterfassung-app/releases/latest";   // einzige fremde Adresse (update.RELEASE_SEITE), nur als Link
// Knopf zum Ziel eines Eintrags: Seite der App oder genau die Release-Seite (neues Fenster, ohne Opener und Referrer); sonst keiner.
function zutunKnopf(e) {
  if (!e.knopf) return "";
  if (e.ziel === ZUTUN_RELEASE) return `<a class="btn prim" href="${ZUTUN_RELEASE}" target="_blank" rel="noopener noreferrer">${esc(e.knopf)}</a>`;
  return ZUTUN_ZIEL.test(e.ziel || "") ? `<a class="btn prim" href="${esc(e.ziel)}">${esc(e.knopf)}</a>` : "";
}
// Karte „Zu tun“: je Eintrag Stufe (Farbe und Text für den Screenreader), Text, Knopf zum Ziel, „Später“ und „Nicht mehr zeigen“. Ohne Einträge leer.
function zutunKarte(antwort) {
  const liste = zutunSichtbar(antwort);
  if (!liste.length) return "";
  const zeile = e => `<li class="zt-${e.stufe}" data-zutun="${esc(e.id)}"><p><span class="sr">${ZUTUN_STUFEN[e.stufe]}: </span>${esc(e.text)}</p><div class="knoepfe">`
    + `${zutunKnopf(e)}<button ${kl("zutunSpaeter", e.id)}>Später</button>`
    + `${e.stufe !== "rot" ? `<button ${kl("zutunAus", e.id)}>Nicht mehr zeigen</button>` : ""}</div></li>`;
  return `<section class="card kachel breit zutun" id="zutun" aria-labelledby="zutun-titel"><h2 id="zutun-titel">Zu tun</h2><ul>${liste.map(zeile).join("")}</ul></section>`;
}
// Nimmt einen Eintrag aus der Karte (ohne Neuladen), den letzten samt Karte; der Fokus geht zum nächsten Eintrag. Die Zahl am Symbol sinkt ohne neue Anfrage.
function zutunWeg(id) {
  const li = [...document.querySelectorAll("#zutun li")].find(x => x.dataset.zutun === id); if (!li) return;
  const naechster = li.nextElementSibling || li.previousElementSibling;
  li.remove();
  zahlAmSymbol(document.querySelectorAll("#zutun li").length);
  if (naechster) naechster.querySelector("a, button").focus(); else { $("#zutun").remove(); $("#titel").focus({preventScroll: true}); }
}
// „Später“: blendet den Eintrag auf diesem Gerät für 7 Tage aus.
function zutunSpaeter(id) {
  const spaeter = zutunGemerkt("ho_zutun_spaeter", {});
  spaeter[id] = new Date(Date.now() + ZUTUN_SPAETER_TAGE * 864e5).toISOString();
  speicher.s("ho_zutun_spaeter", JSON.stringify(spaeter)); zutunWeg(id);
}
// „Nicht mehr zeigen“: blendet den Eintrag auf diesem Gerät dauerhaft aus (gibt es nicht für rote Einträge).
function zutunAus(id) {
  speicher.s("ho_zutun_aus", JSON.stringify([...new Set([...zutunGemerkt("ho_zutun_aus", []), id])])); zutunWeg(id);
}

// ---- Jahreswechsel (funktionen.md 4): Karte im Januar unter „Zu tun“; die Schritte kommen vom Dienst (GET /api/jahreswechsel)
const JW_ANSPAR_MAX = 15;                                              // wie urlaub.ANSPAR_MAX im Rechenkern
const JW_STEUER = /^api\/steuer\/\d{4}\.pdf$/;                        // einziges Ziel außerhalb der Seiten: die eigene Homeoffice-Übersicht als PDF
// Bedienung eines offenen Schritts: Ansparen mit Zahl, Gleitzeit bestätigen, Steuerdatei laden (hakt ab), sonst Link zur Seite.
function jahreswechselAktion(x, rest) {
  if (x.id === "ansparen") {
    const max = Math.max(0, Math.min(JW_ANSPAR_MAX, Math.floor(rest)));
    return `<label for="jw-tage">Tage ansparen (0 bis ${max})</label><input type="number" id="jw-tage" min="0" max="${max}" step="1" inputmode="numeric">
      <div class="knoepfe"><button class="prim" ${kl("jahreswechselAnsparen")}>Ansparen</button><button ${kl("jahreswechselErledigt", "ansparen")}>Nicht ansparen</button></div><div id="jw-fehler"></div>`;
  }
  if (x.id === "gleitzeit") return `<div class="knoepfe"><button class="prim" ${kl("jahreswechselErledigt", "gleitzeit")}>${esc(x.knopf)}</button>${ZUTUN_ZIEL.test(x.ziel) ? `<a class="btn" href="${esc(x.ziel)}">Stand ändern</a>` : ""}</div>`;
  if (x.id === "steuer") return JW_STEUER.test(x.ziel) ? `<div class="knoepfe"><a class="btn prim" href="${esc(x.ziel)}" download ${kl("jahreswechselErledigt", "steuer")}>${esc(x.knopf)}</a></div>` : "";
  return ZUTUN_ZIEL.test(x.ziel) ? `<div class="knoepfe"><a class="btn prim" href="${esc(x.ziel)}">${esc(x.knopf)}</a></div>` : "";
}
// Karte „Jahreswechsel“: offene Schritte mit Bedienung, erledigte abgehakt (Text für den Screenreader), dazu „Ausblenden“. Ohne Antwort keine Karte.
function jahreswechselKarte(jw) {
  if (!jw) return "";
  const schritt = x => `<li class="${x.erledigt ? "jw-erledigt" : ""}"><p>${x.erledigt ? `<span class="jw-haken" aria-hidden="true">✓</span><span class="sr">Erledigt: </span>` : ""}${esc(x.text)}</p>${x.erledigt ? "" : jahreswechselAktion(x, jw.rest_urlaub)}</li>`;
  return `<section class="card kachel breit jahreswechsel" id="jahreswechsel" aria-labelledby="jw-titel"><h2 id="jw-titel">Jahreswechsel ${Number(jw.jahr)}/${Number(jw.jahr) + 1}</h2>
    <ul>${jw.schritte.map(schritt).join("")}</ul><div class="knoepfe"><button ${kl("jahreswechselErledigt", "aus")}>Ausblenden</button></div></section>`;
}
// „Ansparen“: ganze Zahl aus dem Feld an den Dienst; der prüft die Grenzen. Fehler stehen am Feld, die Eingabe bleibt.
async function jahreswechselAnsparen() {
  const feld = $("#jw-tage"), box = $("#jw-fehler"), wert = feld.value.trim();
  if (!/^\d+$/.test(wert)) { box.innerHTML = meldung(`Bitte eine ganze Zahl von 0 bis ${feld.max} eingeben.`); feld.focus(); return; }
  try { await api("POST", "/jahreswechsel/ansparen", {tage: +wert}); }
  catch (e) { box.innerHTML = meldung(e.message); feld.focus(); return; }
  toast(`${tage(+wert)} angespart.`); zeigen();
}
// Hakt einen Schritt ab („Nicht ansparen“, „Stimmt“, Steuerdatei) oder blendet die Karte aus (id „aus“).
async function jahreswechselErledigt(id) {
  try { await api("POST", "/jahreswechsel/erledigt", {id}); } catch (e) { toastFehler(e.message); return; }
  zeigen();
}

// ---- Mini-Verlauf der Gleitzeit (Sammlung 1.8)
const MV_PUNKTE = 12, MV_BREITE = 120, MV_HOEHE = 32, MV_RAND = 3;
// Letzte Punkte von GET /api/gleitzeit/verlauf als Linie ohne Achsen, Nulllinie, letzter Punkt nach Vorzeichen. Ins SVG kommen nur Zahlen.
// Unter zwei Punkten kein Verlauf.
function miniVerlauf(v) {
  const p = (v?.punkte || []).slice(-MV_PUNKTE).map(x => Number(x.saldo_min) || 0);
  if (p.length < 2) return "";
  const lo = Math.min(0, ...p), hi = Math.max(0, ...p), spanne = hi - lo || 1;
  const x = i => (MV_RAND + i * (MV_BREITE - 2 * MV_RAND) / (p.length - 1)).toFixed(1), y = m => (MV_RAND + (hi - m) * (MV_HOEHE - 2 * MV_RAND) / spanne).toFixed(1);
  const letzter = p[p.length - 1];
  return `<svg class="mini-verlauf" viewBox="0 0 ${MV_BREITE} ${MV_HOEHE}" aria-hidden="true" focusable="false"><line class="null" x1="0" x2="${MV_BREITE}" y1="${y(0)}" y2="${y(0)}"/>`
    + `<polyline class="linie" points="${p.map((m, i) => `${x(i)},${y(m)}`).join(" ")}"/><circle class="punkt ${letzter < 0 ? "minus" : "plus"}" cx="${x(p.length - 1)}" cy="${y(letzter)}" r="2.5"/></svg>`;
}

// ---- Übersicht (Startseite der App)
// ---- Erster Start (funktionen.md 6.1): Karte „Erster Start“ statt eines sperrenden Dialogs. Die Person kann weg und wiederkommen; Wahl und
// Eingaben bleiben bis zum Neuladen in EINRICHTUNG. Schritt 0 fragt nach einem anderen Gerät, 1 Vorlage, 2 Bundesland, 3 Arbeitszeit, 4 Grenze, 5 Urlaub.
let EINRICHTUNG = null;                                               // {schritt, pr: Antwort von GET /api/profile, werte: Eingaben der Schritte}
const EI_WERKTAGE = ["Mo", "Di", "Mi", "Do", "Fr"];
// Schritte mit Zahl, die diese Person sieht: Vorlage nur bei mindestens zwei aktiven, Grenze nur im Modus „mit Grenze“.
function einrichtungSchritte() {
  return [...(einrichtungVorlagen().length >= 2 ? [1] : []), 2, 3, ...(hoModus() === "grenze" ? [4] : []), 5];
}
// Eingeschaltete feste Profile als Vorlagen (Reihenfolge des Dienstes).
const einrichtungVorlagen = () => (EINRICHTUNG?.pr?.profile || []).filter(x => x.fest && x.aktiv);
// Wert eines Feldes: Eingabe der Person, sonst die gerade geltende Regel.
const einrichtungWert = k => EINRICHTUNG.werte[k] ?? KONFIG[k];
// Inhalt eines Schritts (Überschrift, Felder); Schritt 1 ist die Frage „Wie arbeitest du?“ mit den Vorlagen.
function einrichtungInhalt(schritt) {
  const w = einrichtungWert;
  if (schritt === 0) return ["Nutzt du die App schon auf einem anderen Gerät?", `<small>Dann holst du deine Daten über die Synchronisierung, Regeln inklusive.</small>
    <div class="knoepfe"><a class="btn" href="#/sync">Ja, Daten holen</a><button class="prim" ${kl("einrichtungWeiter")}>Nein, neu beginnen</button></div>`];
  if (schritt === 1) return ["Wie arbeitest du?", `<small>Die App stellt Regeln und Seiten darauf ein. Ändern kannst du das später unter Einstellungen → Module und Profile.</small>
    <div class="profil-wahl">${einrichtungVorlagen().map(x => `<button type="button" class="${x.name === EINRICHTUNG.pr.gewaehlt ? "gew" : ""}" ${kl("profilWaehlen", x.name)}><b>${esc(x.name)}</b><small>${esc(x.beschreibung || "")}</small></button>`).join("")}</div>`];
  if (schritt === 2) return ["In welchem Bundesland arbeitest du?", `<label for="ei-bl">Bundesland (für die Feiertage)</label><select id="ei-bl">${Object.entries(BUNDESLAENDER).map(([c, n]) => `<option value="${c}"${c === w("bundesland") ? " selected" : ""}>${n}</option>`).join("")}</select>`];
  if (schritt === 3) return ["Wie viel arbeitest du?", `<label for="ei-ws">Stunden pro Woche</label><input type="text" id="ei-ws" inputmode="decimal" value="${esc(komma(w("wochenstunden")))}">
    <label>Arbeitstage</label><div class="tage-wahl" id="ei-tage">${EI_WERKTAGE.map(t => `<label><input type="checkbox" value="${t}"${String(w("arbeitstage")).split(",").includes(t) ? " checked" : ""}>${t}</label>`).join("")}</div>
    <p class="hinweis">Teilzeit mit Stunden je Tag stellst du später unter Einstellungen → Arbeitszeit und Regeln ein.</p>`];
  if (schritt === 4) return ["Wie hoch ist deine Homeoffice-Grenze?", `<label for="ei-grenze">Höchstens so viel Prozent der Arbeitszeit im Homeoffice</label><input type="number" id="ei-grenze" min="1" max="100" step="1" inputmode="numeric" value="${Number(w("ho_grenze")) || 80}">`];
  return ["Wie viele Urlaubstage hast du im Jahr?", `<label for="ei-ut">Urlaubstage pro Jahr</label><input type="number" id="ei-ut" min="0" max="60" step="1" inputmode="numeric" value="${Number(w("urlaub_tage") ?? 30)}">`];
}
// Karte „Erster Start“ für den aktuellen Schritt: Zähler „Schritt 2 von 5“ (ohne Schritt 0), Zurück, Weiter bzw. Fertig, Überspringen.
function einrichtungKarte() {
  const s = EINRICHTUNG.schritt, folge = einrichtungSchritte(), nr = folge.indexOf(s) + 1, [titel, felder] = einrichtungInhalt(s);
  const weiter = s === 1 ? "" : s === folge.at(-1) ? `<button class="prim" ${kl("einrichtungFertig")}>Fertig</button>` : `<button class="prim" ${kl("einrichtungWeiter")}>Weiter</button>`;
  return `<section class="card kachel breit einrichtung" id="einrichtung" aria-labelledby="ei-titel"><span>Erster Start${nr ? ` · Schritt ${nr} von ${folge.length}` : ""}</span>
    <div><b class="gross" id="ei-titel" tabindex="-1">${titel}</b>${felder}</div><div id="ei-fehler"></div>
    <div class="knoepfe">${nr > 0 ? `<button ${kl("einrichtungZurueck")}>Zurück</button>${weiter}` : ""}<button class="leise" ${kl("einrichtungUeberspringen")}>Überspringen</button></div></section>`;
}
// Holt die Karte, wenn der Dienst die Einrichtung anbietet (leere App, keine Demo, keine Synchronisierung, noch nicht erledigt); sonst leer.
async function einrichtungHtml() {
  if (!DEMO?.leer || DEMO.aktiv) return "";
  const e = await api("GET", "/einrichtung").catch(() => null);
  if (!e?.zeigen) { EINRICHTUNG = null; return ""; }
  EINRICHTUNG ??= {schritt: 0, pr: await api("GET", "/profile").catch(() => null), werte: {}};
  return einrichtungKarte();
}
// Merkt die Eingaben des gezeigten Schritts (Felder, die es gerade gibt).
function einrichtungMerken() {
  const w = EINRICHTUNG.werte;
  if ($("#ei-bl")) w.bundesland = $("#ei-bl").value;
  if ($("#ei-ws")) { w.wochenstunden = $("#ei-ws").value.trim(); w.arbeitstage = [...document.querySelectorAll("#ei-tage input:checked")].map(x => x.value).join(","); }
  if ($("#ei-grenze")) w.ho_grenze = +$("#ei-grenze").value;
  if ($("#ei-ut")) w.urlaub_tage = +$("#ei-ut").value;
}
// Zeigt einen anderen Schritt: nur die Karte neu, Fokus auf ihre Überschrift (Screenreader sagt den Schritt an).
function einrichtungZeigen(schritt) {
  einrichtungMerken(); EINRICHTUNG.schritt = schritt;
  const k = $("#einrichtung"); if (!k) return;
  k.outerHTML = einrichtungKarte(); beschriften($("#einrichtung")); $("#ei-titel").focus();
}
// Weiter zum nächsten gezeigten Schritt (aus Schritt 0 zum ersten mit Zahl).
function einrichtungWeiter() { const f = einrichtungSchritte(); einrichtungZeigen(f[f.indexOf(EINRICHTUNG.schritt) + 1] ?? f[0]); }
// Zurück zum vorigen Schritt (vor dem ersten mit Zahl: Schritt 0).
function einrichtungZurueck() { const f = einrichtungSchritte(); einrichtungZeigen(f[f.indexOf(EINRICHTUNG.schritt) - 1] ?? 0); }
// Schließt die Einrichtung ab: Demo-Angebot neu fragen (es hängt an der Wahl), Übersicht neu.
async function einrichtungEnde(text) {
  EINRICHTUNG = null; DEMO = await api("GET", "/demo").catch(() => DEMO);
  if (text) toast(text);
  seitenCacheLeeren(); zeigen();
}
// „Fertig“: genau ein Schreiben der Regeln, rückwirkend (die App ist leer), dann die Einrichtung als erledigt merken und den Rundgang anbieten.
// Fehler der Regeln (z. B. Wochenstunden 99) stehen in der Karte, die Eingaben bleiben.
async function einrichtungFertig() {
  einrichtungMerken();
  try {
    KONFIG = (await api("PUT", "/konfig", {werte: EINRICHTUNG.werte, modus: "rueckwirkend"})).werte;
    await api("PUT", "/einrichtung", {stand: "fertig"});
  } catch (e) { $("#ei-fehler").innerHTML = meldung(e.message); return; }
  darstellung(); await einrichtungEnde("Eingerichtet."); rundgangAngebot();
}
// „Überspringen“: Es gelten die Regeln der gewählten Vorlage bzw. der Voreinstellung; gespeichert wird nur, dass die Einrichtung vorbei ist.
async function einrichtungUeberspringen() {
  try { await api("PUT", "/einrichtung", {stand: "uebersprungen"}); } catch (e) { toastFehler(e.message); return; }
  einrichtungEnde("");
}
// Übernimmt die gewählte Vorlage (Regeln für alle Tage, Darstellung des Profils) und geht zum nächsten Schritt der Einrichtung.
async function profilWaehlen(name) {
  let r;
  try { r = await api("POST", "/profile/wahl", {name}); } catch (e) { $("#ei-fehler").innerHTML = meldung(e.message); return; }
  const x = r.profile.find(p => p.name === name) || {};
  if (x.akzent) speicher.s("ho_akzent", x.akzent);
  if (x.farbe) speicher.s("ho_farbe", x.farbe);
  KONFIG = (await api("GET", "/konfig")).werte; darstellung(); navAnpassen();
  EINRICHTUNG.pr = {...EINRICHTUNG.pr, gewaehlt: name}; EINRICHTUNG.werte = {};   // die Vorlage bringt eigene Werte mit
  einrichtungWeiter();
}
// Angebot nach der Einrichtung: kurzer Rundgang jetzt oder später (unter Hilfe).
function rundgangAngebot() {
  blatt(`<h3>Kurzer Rundgang?</h3><p class="hinweis">In fünf kurzen Seiten zeigt die App, wo was steht. Später findest du ihn unter Hilfe.</p>
    <div class="knoepfe"><button class="prim" ${kl("rundgangStart")}>Ja</button><button ${kl("blattZu")}>Später</button></div>`);
}

// Zeile unter den Kranktagen der Übersicht: woraus sie bestehen (Startwerte nur, wenn es welche gibt), „Krank im Dienst“ getrennt, weil es kein Kranktag ist.
// Zeichen vor einer Warnung der Übersicht (3.12, F-ST1): Dreieck mit „!“ als Form, „Achtung“ für den Screenreader; die Farbe ist nie das einzige Zeichen
const WARN_ZEICHEN = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/></svg><span class="sr">Achtung: </span>`;
const krankKachelZusatz = kr => `davon ${kr.krank_start > 0 ? `${kr.krank_start} aus Startwerten · ` : ""}${kr.attest} mit Attest<br>${kr.im_dienst} im Dienst (kein Kranktag)`;
async function seiteStart() {
  const j = heute.getFullYear(), m = heute.getMonth() + 1;
  const [kwJ, kw] = kwJahr(heute);
  const [mo, ja, ho, wo, gz, kr, st, he, zt, jwAntwort, gv] = await Promise.all([api("GET", `/monat/${j}/${m}`), api("GET", `/jahr/${j}`), api("GET", `/horest/${j}/${m}`),
    api("GET", `/woche/${kwJ}/${kw}`), api("GET", "/gleitzeit"), api("GET", `/krank/${j}`), api("GET", "/stempel"), api("GET", "/heute"), zutunLaden(),
    api("GET", "/jahreswechsel").catch(() => null), modulAn("gleitzeit") ? api("GET", `/gleitzeit/verlauf/${j}`).catch(() => null) : null]);   // beide nur Zusatz: ohne sie bleibt die Übersicht
  if (hashTeile()[1] === "stempel") window.nachher = () => { history.replaceState(null, "", "#/start"); stempelBlatt(); };   // Ziel „Gehen nachtragen“ aus „Zu tun“
  zutunZahl(zt);
  stempelDaten = st; stempelDaten.t0 = Date.now(); stempelAnzeige();
  const wahl = await einrichtungHtml();
  const u = ja.urlaub, jp = ja.jahr_prognose;
  const tagHeute = wo.tage.find(x => x.datum === iso(j, m, heute.getDate())) || {};       // für die Zeilen „Ist Tag“ und „Ist KW“ der Gleitzeit-Kachel
  const langes = heute.toLocaleDateString("de-DE", {weekday: "long", day: "numeric", month: "long"});
  let lage;
  if (st.laeuft) lage = `<b class="gross">${st.art === "ho" ? "Homeoffice" : "Büro"} seit ${esc(stempelSeit())} Uhr</b><span>Die Uhr läuft.</span>`;
  else if (st.heute.ho || st.heute.dst) lage = `<b class="gross">Heute eingetragen</b><span>${orteText(st.heute.ho, st.heute.dst)}</span>`;
  else if (he.soll_tag) lage = `<b class="gross">Noch nichts eingetragen</b><span>${modulAn("stempel") ? "Starte die Stempeluhr oder trage die Zeit nach." : "Trage die Zeit ein."}</span>`;
  else lage = `<b class="gross">Heute ist frei</b><span>Kein Arbeitstag.</span>`;
  const mq = mo.rot ? "rot" : "";
  const warnungen = [];
  ZUTUN_IDS = (zt?.eintraege || []).map(e => e?.id);
  const quoteInKarte = ZUTUN_IDS.includes("quote-grenze") || ZUTUN_IDS.includes("quote-monat");   // Prognose und Monat über der Grenze stehen dann in der Karte
  if (!quoteInKarte && mitGrenze() && jp && jp.status === "ueber") warnungen.push(`<a href="#/horest" class="warn">${WARN_ZEICHEN}Jahres-Prognose über ${KONFIG.ho_grenze} % (${jp.quote_ende}): ${jp.buero_reicht_nicht ? "auch mit Büro an allen restlichen Tagen nicht mehr auszugleichen" : `Es fehlen noch ${tage(jp.noetig_tage)} Büro`}</a>`);
  if (!quoteInKarte && mitGrenze() && mo.rot) warnungen.push(`<a href="#/monat" class="warn">${WARN_ZEICHEN}Diesen Monat über ${KONFIG.ho_grenze} % HO (${mo.text.quote})</a>`);
  const jr = jp ? `<div class="ring-klein">${ring(ja.gesamt.quote, ja.text.quote, ja.rot)}</div>` : "";
  const angebot = DEMO?.angebot ? `<div class="card kachel breit demo-angebot"><span>Noch keine Einträge</span><div><b class="gross">Erst einmal ausprobieren?</b><small>Die Demo füllt eine getrennte Beispiel-Datenbank mit zufälligen Beispieltagen, passend zu deinen Regeln. Deine echten Daten bleiben leer und unberührt.</small></div>
      <div class="knoepfe"><button class="prim" ${kl("demoStart")}>Mit Beispieldaten ausprobieren</button><a class="btn" href="#/einstellungen/arbeitszeit">Eigene Regeln einrichten</a></div></div>` : "";
  const zutun = zutunKarte(zt), jw = jahreswechselKarte(jwAntwort);                                        // enthält auch „Attest fehlt“ (früher eigene Warnung hier)
  return `<div class="dash">
    ${wahl}
    ${angebot}
    <div class="card kachel heute-karte"><span>${langes}</span><div>${lage}</div>
      <div class="knoepfe"><button class="prim"${md("stempel")} ${kl("stempelBlatt")}>${stempelKnopf(st)}</button><button ${kl("heuteEintragen")}>Heute eintragen</button></div></div>
    ${einOrt() ? "" : `<div class="card kachel klickbar quote">${kachelKopf(MONATE[m - 1], mitGrenze() ? "horest" : "monat")}<div class="ring-klein">${ring(mo.summe.quote, mo.text.quote, mo.rot)}</div>
      <small>${mo.text.ho} HO · ${mo.text.dst} Büro${mitGrenze() ? `<br>Pfeil am Ring = ${KONFIG.ho_grenze} %-Grenze<br>noch ${ho.monat_block.rest} HO möglich (${einheitFest(tage(ho.monat_block.rest_tage))} und ${ho.monat_block.rest_tage_std})` : ""}</small></div>
    <div class="card kachel klickbar quote">${kachelKopf(`Jahr ${j}`, "jahr")}${jr}<small>${jp && mitGrenze() ? `Prognose Jahresende <b class="${jp.status === "ueber" ? "rot" : ""}">${einheitFest(jp.quote_ende)}</b><br>${jp.status === "ueber" ? `${jp.reserve} Std. zu viel HO` : `${jp.reserve} Std. (${einheitFest(tage(jp.reserve_tage))}) Luft bis ${KONFIG.ho_grenze}\u00a0%`}` : `${ja.text.ho} HO · ${ja.text.dst} Büro`}</small></div>`}
    ${warnungen.length ? `<div class="card kachel breit warnungen">${warnungen.join("")}</div>` : ""}
    ${zutun}
    ${jw}
    ${kachel("Diese Woche", `<span id="gz-kw" data-min="${wo.ist_min}">${zeitText(wo.ist_min + laufendeMinuten())}</span>`, `von ${wo.soll_woche} in KW ${kw}<br>Ist Tag: <span id="gz-tag" data-min="${tagHeute.ist_min || 0}">${zeitText((tagHeute.ist_min || 0) + laufendeMinuten())}</span> von ${zeitText(tagHeute.arbeit_min || 0)}`, "woche", "", "woche")}
    ${kachel("Gleitzeit", `<span class="saldo ${saldoKlasse(gz.konto_min)}">${gz.konto}</span>`, `${miniVerlauf(gv)}Stand heute<br>Saldo dieser Woche: <span class="saldo ${saldoKlasse(wo.saldo_min)}">${wo.saldo}</span>`, "woche", "", "gleitzeit")}
    ${kachel("Urlaub", tage(u.rest), `Urlaubstage übrig: ${komma(u.rest)} von ${komma(u.anspruch + u.uebertrag)}${modulAn("gleittage") ? `<br>Gleittage übrig: ${u.gleittage_rest} von ${u.gleittage_max}` : ""}${u.familientage_aktiv && modulAn("familientage") ? `<br>Familientage übrig: ${u.familientage_rest} von ${u.familientage_max}` : ""}`, "urlaub", "", "urlaub")}
    ${kachel("Freizeitkonto", `<span class="saldo ${saldoKlasse(gz.freizeit_min)}">${gz.freizeit}</span>`, "Wochenend- und Feiertagsarbeit, unabhängig von der Gleitzeit", "woche", "", "freizeit")}
    ${kachel("Krank " + j, tage(kr.kranktage), krankKachelZusatz(kr), "krank", "krank-breit", "krank")}
  </div>`;
}

// ---- seiten/monat.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Buchstabe je Art im Monats-Raster (design.md 3.17), damit kein Tag sich nur über die Farbe unterscheidet; ho und ds: Homeoffice und Büro.
const ART_K = {ho: "H", ds: "B", urlaub: "U", angespart: "U", gleittag: "G", krank: "K", krank_attest: "K", krank_dienst: "KD", elternzeit: "E", freizeit: "F",
  familientag: "FT", sonderurlaub_tag: "S", kind_krank: "KK"};
const ORT_NAME = {ho: "Homeoffice", ds: "Büro"};
const WT_KURZ = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
// ---- Prognose-Text
// Prognose-Kasten des Monats (monat_prognose): „Bei diesem Tempo“ ist immer die Quote von Automatisch, auch wenn eine Zahl von Hand gewählt ist.
// Der Satz folgt der Büro-Zeit, die noch nötig ist (noetig), außer wenn auch Büro an allen Rest-Tagen nicht reicht; status färbt nur den Kasten (Reserve bei der gewählten Annahme).
// Ob Büro an allen Rest-Tagen noch reicht, sagt buero_reicht_nicht (so auch im Jahr, im HO-Spielraum und in der Übersicht). Die letzte Kachel (5 Büro-Tage je Woche)
// taugt dafür nicht: Bei 6 Arbeitstagen deckt sie nicht alle Rest-Tage ab.
function prognoseHtml(p) {
  if (!p) return "";
  const satz = p.buero_reicht_nicht
    ? `Schon jetzt zu viel Homeoffice. Auch mit Büro an allen restlichen Tagen bleibt es über ${KONFIG.ho_grenze} % (dann ${p.varianten.at(-1).quote}).`
    : p.noetig_tage
    ? `Damit es unter ${KONFIG.ho_grenze} % bleibt, brauchst du noch mindestens <b>${p.noetig} Std.</b> Büro (etwa ${tage(p.noetig_tage)}).`
    : `Alle restlichen Tage im Homeoffice wären möglich (dann ${p.varianten[0].quote}).`;
  return `<div class="prognose ${p.status}"><span>Prognose</span><div>Bei diesem Tempo: <b class="${p.auto_rot ? "rot" : ""}">${p.auto_quote}</b> · ${satz}</div></div>`;
}

// Jahres-Prognose als Aufklapp-Feld (für den Monat); der Zustand „offen“ bleibt nach dem Neuzeichnen erhalten.
function jahresPrognoseAufklapp(p) {
  if (!p) return "";
  return `<details class="jp-auf"${jpOffen ? " open" : ""}><summary><span class="am-stueck">Jahres-Prognose ${p.jahr}</span><b class="${p.status === "ueber" ? "rot" : ""}">${p.quote_ende}</b></summary>${jahresPrognoseHtml(p)}</details>`;
}
// ---- Monat
async function seiteMonat() {
  const d = zeitAnkommen();
  const m = await api("GET", `/monat/${jahr}/${monat}`);
  const t = m.text, s = m.summe;
  const heuteIso = zeitHeuteIso();
  let kwAlt = null, woche = [], html = "";
  // Schließt die Wochenzeile im Monat ab: trägt Ist und Soll der Woche ein, nur aus soll_konto_min und saldo_konto_min der Tage (wie die Woche und das Gleitzeit-Konto).
  const wocheZu = () => {
    if (!woche.length) return;
    const summe = feld => woche.reduce((a, z) => a + z[feld], 0);
    const soll = summe("soll_konto_min"), saldoKw = summe("saldo_konto_min"), ist = soll + saldoKw;
    const saldo = soll ? `Soll ${zeitText(soll)} · <span class="saldo ${saldoKlasse(saldoKw)}">${zeitText(saldoKw, true)}</span>` : "";
    html = html.replace("@@KW" + woche[0].datum + "@@", `<span>${ist ? "Ist " + zeitText(ist) : ""}</span><span>${saldo}</span>`);
    woche = [];
  };
  for (const z of m.tage) {
    const kw = isoKw(new Date(+z.datum.slice(0, 4), +z.datum.slice(5, 7) - 1, z.tag));
    if (kw !== kwAlt) { wocheZu(); html += `<div class="kw"><span>KW ${kw}</span>@@KW${z.datum}@@</div>`; kwAlt = kw; }
    woche.push(z);
    const chips = tagChips(z), info = tagInfo(z);
    const klasse = ["tag", z.frei ? "frei" : "", z.datum === heuteIso ? "heute" : ""].join(" ");
    html += `<div class="${klasse}" data-d="${z.datum}"><div class="dat"><b>${z.tag}</b><small>${z.wt}</small></div>
      <div class="mitte"><div class="zeiten">${chips || (z.frei ? "" : `<span class="leer-tag">${z.soll ? "noch nichts eingetragen" : ""}</span>`)}</div>${info ? `<div class="info">${esc(info)}</div>` : ""}</div>
      <div class="ist">${z.ist_soll_min ? zeitText(z.ist_soll_min) : ""}${z.soll_konto_min > 0 ? `<small>Soll ${zeitText(z.soll_konto_min)}</small>` : ""}</div></div>`;
  }
  wocheZu();
  window.monatDaten = m; window.famAktiv = m.familientage_aktiv;
  window.nachher = () => {
    zeitSpalte();
    if (window.scrollHeute) { window.scrollHeute = false; const h = document.querySelector(".tag.heute, .kz.heute"); if (h) h.scrollIntoView({block: "center", behavior: "smooth"}); else window.scrollTo({top: 0, behavior: "smooth"}); }
  };
  const rot = m.rot, q = s.quote;
  const ansicht = speicher.l("ho_monat_ansicht", "kalender");
  const umschalter = `<div class="seg segmitte" role="group" aria-label="Ansicht"><button class="${ansicht === "kalender" ? "on" : ""}" ${kl("monatAnsicht", "kalender")}>Raster</button><button class="${ansicht === "liste" ? "on" : ""}" ${kl("monatAnsicht", "liste")}>Liste</button></div>`;
  const bewertung = monatBewertung(s, rot);
  return `<div class="kopf"><button ${kl("zeitBlaettern", -1)} aria-label="Vorheriger Monat">‹</button><h2>${m.name} ${m.jahr}</h2>
    <div class="kopf-rechts"><span class="kal-wahl"><button type="button" ${kl("zeitKalender", "#m-kal")} aria-label="Monat im Kalender wählen">${sym("monat")}</button><input id="m-kal" type="date" value="${d}" ${ZEIT_KAL_GRENZEN} data-wechsel="zeitKalenderDatum" tabindex="-1" aria-hidden="true"></span><button class="heute-knopf" ${kl("zeitHeute")}>Heute</button><button ${kl("zeitBlaettern", 1)} aria-label="Nächster Monat">›</button></div></div>
    <div class="monat-grid"><div class="rechts">${zeitLeerHtml(m.tage)}${umschalter}<div class="card">${ansicht === "kalender" ? rasterHtml(m, heuteIso) : html}</div></div>
    <div class="links"><div class="card"><div class="hero">${einOrt() ? "" : ring(q, t.quote, rot)}
    <div class="txt"><b>${m.name}</b><span>${einOrt() ? "" : `${t.ho}\u00a0HO · ${t.dst}\u00a0Büro<br>`}Ist-Zeit ${t.ist}${auffuellZeile(m)}</span>${mitGrenze() ? `<span class="chip ${rot ? "rot" : ""}">${letztesWortAmStueck(bewertung)}</span>` : ""}</div></div>${mitGrenze() ? prognoseHtml(m.monat_prognose) + jahresPrognoseAufklapp(m.jahr_prognose) : ""}
    <div class="raster">${einOrt() ? "" : `<div class="ho"><b>${s.ho_tage}</b><span>Tage HO</span></div><div class="ds"><b>${s.dst_tage}</b><span>Tage Büro</span></div>`}<div><b>${s.soll_tage}</b><span>Arbeitstage (Soll)</span></div>
    <div><b>${s.urlaub}</b><span>Urlaub</span></div><div${md("krank")}><b>${s.krank}</b><span>Krank</span></div><div${md("gleittage")}><b>${s.gleittage}</b><span>Gleittage</span></div></div>
    <div class="schnell monat-schnell"><button class="prim"${md("stempel")} ${kl("stempelBlatt")}>Stempeluhr</button><button ${kl("heuteEintragen")}>Heute eintragen</button><a class="btn pdf" href="api/monat/${jahr}/${monat}.pdf">Monats-PDF</a></div></div></div></div>`;
}
// Letztes Wort am Stück: „80-%-Grenze“ brach sonst am Bindestrich um (Terminal, 375 px).
const letztesWortAmStueck = s => s.replace(/ (\S+)$/, ' <span class="am-stueck">$1</span>');
// Bewertung der Quote im Monat (nur aus Feldern des Kerns): genau auf der Grenze „An der …-%-Grenze“ (summe.an_grenze, U10), sonst darüber oder darunter.
function monatBewertung(s, rot) {
  if (s.quote === null) return "Noch keine Zeiten";
  if (s.an_grenze) return `An der ${KONFIG.ho_grenze}-%-Grenze`;
  return `${rot ? "Über" : "Unter"} der ${KONFIG.ho_grenze}-%-Grenze`;
}
// Zeile unter „Ist-Zeit“: die bei „Krank im Dienst“ aufgefüllte Zeit, nur wenn es welche gibt (U2).
const auffuellZeile = m => m.summe.aufgefuellt_min > 0 ? `<br>davon Krank im Dienst aufgefüllt ${esc(m.text.aufgefuellt)}` : "";
// Wechselt im Monat zwischen Raster und Liste (gespeichert als „kalender“ bzw. „liste“).
function monatAnsicht(a) { speicher.s("ho_monat_ansicht", a); zeigen(); }
// Art, nach der ein Tag im Raster gefärbt wird: mit Büro-Zeit als Büro (auch mit Homeoffice dazu, Zählregel), sonst Homeoffice, sonst seine Art.
const rasterArt = z => z.dst ? "ds" : z.ho ? "ho" : ART_K[z.art] ? z.art : "";
// Name einer Raster-Art für Legende und Screenreader („Homeoffice“, „Büro“ oder der Name der Art).
const rasterName = a => ORT_NAME[a] || ARTEN[a];
// Was an einem Tag eingetragen ist, als Satz für den Screenreader (der Tag ist ein Knopf mit diesem Namen).
const rasterWas = z => [z.ho ? "Homeoffice " + z.ho : "", z.dst ? "Büro " + z.dst : "", z.art ? ARTEN[z.art] || z.art : "", z.vermerk ? VERMERK_TEXT[z.vermerk] : "",
  z.feiertag ? "Feiertag " + z.feiertag : ""].filter(Boolean).join(", ") || "kein Eintrag";
// Monat als Raster (M1, design.md 3.17): je Tag ein Knopf (data-d) mit Tönung der Art (t-<art>), Buchstabe, Zeichen des Vermerks und Stunden mit Auffüllung.
function rasterHtml(m, heuteIso) {
  const vorne = (new Date(m.jahr, m.monat - 1, 1).getDay() + 6) % 7;
  const zellen = m.tage.map(z => {
    const a = rasterArt(z), k = z.ho && z.dst ? "H/B" : ART_K[a] || "", istHeute = z.datum === heuteIso;
    const klasse = ["kz", a ? "t-" + a : (z.frei ? "frei" : ""), istHeute ? "heute" : ""].filter(Boolean).join(" ");
    const name = `${z.wt} ${z.tag}. ${MONATE[m.monat - 1]}${istHeute ? ", heute" : ""}${z.frei ? ", frei" : ""}: ${rasterWas(z)}`;
    return `<div class="${klasse}" data-d="${z.datum}" aria-label="${esc(name)}"><b>${z.tag}</b>${k || z.vermerk ? `<small class="art-k" aria-hidden="true">${k}${vermerkZeichen(z.vermerk)}</small>` : ""}${z.ist_soll_min ? `<small>${zeitText(z.ist_soll_min)}</small>` : ""}</div>`;
  });
  return `<div class="kal"><div class="kk" aria-hidden="true">${WT_KURZ.map(x => `<span>${x}</span>`).join("")}</div><div class="kg">${'<div class="kz leer"></div>'.repeat(vorne)}${zellen.join("")}</div></div>${legendeHtml(m.tage)}`;
}
// Legende des Rasters: nur Arten und Vermerke, die im Monat vorkommen, je mit Punkt, Buchstabe und Namen; leer ohne Einträge.
function legendeHtml(tage) {
  const arten = Object.keys(ART_K).filter(a => tage.some(z => rasterArt(z) === a));
  const punkte = arten.map(a => `<span><i class="p ${ORT_NAME[a] ? a : "a-" + a}" aria-hidden="true"></i><b>${ART_K[a]}</b> ${rasterName(a)}</span>`);
  const zeichen = Object.keys(VERMERK_SYM).filter(v => tage.some(z => z.vermerk === v)).map(v => `<span>${vermerkZeichen(v)}${VERMERK_TEXT[v]}</span>`);
  return punkte.length + zeichen.length ? `<div class="legende">${punkte.join("")}${zeichen.join("")}</div>` : "";
}
// ---- seiten/woche.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Wie saldoKlasse, aber für einen angezeigten Text (beginnt mit „−“: minus; enthält eine Ziffer 1–9: plus).
const saldoText = t => saldoKlasse(String(t).startsWith("−") ? -1 : (/[1-9]/.test(t) ? 1 : 0));
// Maße des Gleitzeit-Verlaufs (viewBox): Breite, Höhe, Rand oben/unten für Grenztexte und Achse.
const GZ_BREITE = 360, GZ_HOEHE = 140, GZ_OBEN = 16, GZ_UNTEN = 20, GZ_STRICH = "6 4", GZ_PUNKT_R = 3;
// Saldo mit Vorzeichen wie woche.fmt_saldo im Server: auch 0 mit „+“ (zeitText setzt „+“ nur über 0).
const gzSaldo = m => (m < 0 ? "" : "+") + zeitText(m);
// Datum JJJJ-MM-TT als „TT.MM.“ (maskiert).
const gzTag = d => esc(`${String(d).slice(8, 10)}.${String(d).slice(5, 7)}.`);
// Karte „Gleitzeit-Verlauf <Jahr>“ (funktionen.md 11, U11) aus GET /gleitzeit/verlauf/<J>: Linie des Kontos über das Jahr, Nulllinie, beide Grenzen gestrichelt
// mit Text. Das Bild ist aria-hidden, der Screenreader hört einen Satz mit Stand, höchstem und niedrigstem Stand; darunter die Werte als Tabelle.
// Im Bild stehen nur Zahlen (Number) und Texte aus zeitText; Daten aus der Antwort gehen sonst nur maskiert hinein. Ohne Punkte: Leerzustand.
function gleitzeitVerlaufHtml(v) {
  const jahr = Number(v.jahr), kopf = `<h2>Gleitzeit-Verlauf ${jahr}</h2>`;
  if (!v.punkte.length) return `<div class="card"${md("gleitzeit")}>${kopf}<p class="leer">Noch keine Werte in ${jahr}.</p></div>`;
  const punkte = v.punkte.map(p => ({datum: String(p.datum), m: Number(p.saldo_min) || 0}));
  const plus = Number(v.plus_min) || 0, minus = -(Number(v.minus_min) || 0), werte = punkte.map(p => p.m);
  const hoch = punkte.reduce((a, p) => p.m > a.m ? p : a), tief = punkte.reduce((a, p) => p.m < a.m ? p : a), letzt = punkte.at(-1);
  const oben = Math.max(...werte, plus, 0), unten = Math.min(...werte, minus, 0), spanne = oben - unten || 1;
  const anfang = Date.UTC(jahr, 0, 1), dauer = Date.UTC(jahr + 1, 0, 1) - anfang;
  const x = d => ((Date.parse(d) - anfang) / dauer * GZ_BREITE || 0).toFixed(1);
  const y = m => (GZ_OBEN + (oben - m) / spanne * (GZ_HOEHE - GZ_OBEN - GZ_UNTEN)).toFixed(1);
  const linie = (m, klasse, strich = "") => `<line class="${klasse}" x1="0" x2="${GZ_BREITE}" y1="${y(m)}" y2="${y(m)}"${strich ? ` stroke-dasharray="${strich}"` : ""}/>`;
  const grenze = (m, text) => `${linie(m, "grenze", GZ_STRICH)}<text class="grenze-text" x="${GZ_BREITE}" y="${(y(m) - 4).toFixed(1)}" text-anchor="end">${esc(text)}</text>`;
  const bild = `<svg class="gz-verlauf" viewBox="0 0 ${GZ_BREITE} ${GZ_HOEHE}" aria-hidden="true" focusable="false">${linie(0, "null")}${grenze(plus, "Grenze " + gzSaldo(plus))}${grenze(minus, "Grenze " + zeitText(minus))}
    <polyline class="linie" points="${punkte.map(p => `${x(p.datum)},${y(p.m)}`).join(" ")}"/><circle class="heute" cx="${x(letzt.datum)}" cy="${y(letzt.m)}" r="${GZ_PUNKT_R}"/>
    <text class="achse" x="0" y="${GZ_HOEHE - 4}">01.01.</text><text class="achse" x="${GZ_BREITE}" y="${GZ_HOEHE - 4}" text-anchor="end">31.12.</text></svg>`;
  const satz = `Gleitzeit-Konto ${jahr}: Stand ${gzSaldo(letzt.m)}, höchster Stand ${gzSaldo(hoch.m)} am ${gzTag(hoch.datum)}, niedrigster Stand ${gzSaldo(tief.m)} am ${gzTag(tief.datum)}`;   // das Datum endet schon mit Punkt
  const zeilen = punkte.map(p => `<tr><td>${gzTag(p.datum)}</td><td>${gzSaldo(p.m)}</td></tr>`).join("");
  return `<div class="card"${md("gleitzeit")}>${kopf}${bild}<p class="sr">${satz}</p>
    <details class="auf"><summary>Werte als Tabelle</summary><table class="tbl"><thead><tr><th>Woche bis</th><th>Stand</th></tr></thead><tbody>${zeilen}</tbody></table></details></div>`;
}
// Holt den Gleitzeit-Verlauf des Jahres; ohne Modul Gleitzeit oder bei einem Fehler keine Karte (die Woche zeigt sich trotzdem).
async function gleitzeitVerlauf(jahrText) {
  if (!modulAn("gleitzeit")) return "";
  try { return gleitzeitVerlaufHtml(await api("GET", `/gleitzeit/verlauf/${jahrText}`)); } catch (e) { return ""; }
}
// ---- Woche mit Gleitzeit-Konto
async function seiteWoche() {
  const d = zeitAnkommen(), [kj, kw] = kwJahr(isoZuDatum(d));
  const w = await api("GET", `/woche/${kj}/${kw}`), verlauf = await gleitzeitVerlauf(d.slice(0, 4));
  window.monatDaten = {tage: w.tage}; window.famAktiv = w.familientage_aktiv;
  window.nachher = zeitSpalte;
  const heuteIso = zeitHeuteIso();
  const vorz = saldoKlasse;
  const zeilen = w.tage.map(z => tagZeileHtml(z, heuteIso, vorz)).join("");
  const zeitraumText = (von, bis) => `${von.slice(8)}.${von.slice(5, 7)}.${von.slice(0, 4) === bis.slice(0, 4) ? "" : von.slice(0, 4)} – ${bis.slice(8)}.${bis.slice(5, 7)}.${bis.slice(0, 4)}`;   // Jahr nur einmal, außer über den Jahreswechsel
  const t = w.tage.find(z => z.datum === heuteIso);
  const tagKarte = t ? tagKarteHtml(t, vorz, `Heute, ${t.wt} ${t.tag}.`) : "";   // nur in der laufenden Woche
  return `<div class="kopf"><button ${kl("zeitBlaettern", -1)} aria-label="Vorherige Woche">‹</button><h2 class="kw-kopf"><span class="kw-nr">KW ${w.kw}</span> <span class="kw-zeit">${zeitraumText(w.von, w.bis)}</span></h2>
    <div class="kopf-rechts"><span class="kal-wahl"><button type="button" ${kl("zeitKalender", "#w-kal")} aria-label="Woche im Kalender wählen">${sym("monat")}</button><input id="w-kal" type="date" value="${d}" ${ZEIT_KAL_GRENZEN} data-wechsel="zeitKalenderDatum" tabindex="-1" aria-hidden="true"></span><button class="heute-knopf" ${kl("zeitHeute")}>Heute</button><button ${kl("zeitBlaettern", 1)} aria-label="Nächste Woche">›</button></div></div>
    ${zeitLeerHtml(w.tage)}
    <div class="gitter paar">${tagKarte}<div class="card"><h2>${w.heute_in_woche ? "Diese Woche" : `Woche ${w.kw}`}</h2><div class="zeile gr"><span>Ist</span><b>${zeitText(w.ist_soll_min)}</b></div><div class="zeile gr"><span>Soll der ganzen Woche</span><b>${zeitText(w.soll_woche_min)}</b></div>
      <div class="zeile gr"><span>Saldo der Woche</span><b class="saldo ${vorz(w.saldo_woche_min)}">${zeitText(w.saldo_woche_min, true)}</b></div>
      <div class="zeile gr"><span>Saldo bis ${w.heute_in_woche ? "heute" : "Wochenende"}</span><b class="saldo ${vorz(w.saldo_min)}">${w.saldo}</b></div></div></div>
    <div class="gitter paar"><div class="card"${md("gleitzeit")}><h2>Gleitzeit-Konto</h2><div class="zeile gr"><span>Am Anfang der Woche</span><b class="saldo ${saldoText(w.konto_anfang)}">${w.konto_anfang}</b></div><div class="zeile gr"><span>${w.heute_in_woche ? "Stand heute" : "Am Ende der Woche"}</span><b class="saldo ${vorz(w.konto_min)}">${w.konto}</b></div></div>
    <div class="card"${md("freizeit")}><h2>Freizeitkonto</h2><div class="zeile gr"><span>In dieser Woche</span><b class="saldo ${vorz(w.freizeit_woche_min)}">${w.freizeit_woche}</b></div><div class="zeile gr"><span>${w.heute_in_woche ? "Stand heute" : "Am Ende der Woche"}</span><b class="saldo ${vorz(w.freizeit_konto_min)}">${w.freizeit_konto}</b></div></div></div>
    ${verlauf}
    <div class="card">${zeilen}</div>
    <p class="hinweis">Soll zählt an Arbeitstagen, außer bei Urlaub und Krank. Ein Gleittag bucht das Tagessoll vom Gleitzeit-Konto ab. Arbeit am Wochenende oder an Feiertagen zählt zum Freizeitkonto, nicht zur Gleitzeit. Abgebaut wird es mit der Art „Freizeitausgleich“. Beide Konten kannst du unter „Einstellungen“ auf deinen echten Stand setzen.</p>`;
}
// ---- seiten/horest.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// ---- HO-Spielraum
// Rest in ganzen Tagen plus Stunden; unter einem Tag „weniger als 1 Tag“ statt „0 Tage und …“.
function tageText(t, std) { return t ? `etwa ${tage(t)} und ${std} Std.` : "weniger als 1 Tag"; }
// Erklärung als Popup: Knopf „?“ öffnet ein Fenster mit dem Text (HTML-Popover, ohne eigenes Skript; Schließen per Knopf, Esc oder Tipp daneben).
// Chrome bricht vor einem Knopf um, auch nach einem Wort-Verbinder; erst die nicht umbrechende Klammer mit Wort-Verbinder (U+2060) hält das „?“ am letzten Wort.
function hilfe(id, text) {
  return `<span class="am-wort">&#8288;<button type="button" class="hilfe-knopf" popovertarget="h-${id}" aria-label="Erklärung anzeigen">?</button>
    <div id="h-${id}" popover class="hilfe-pop" role="dialog" aria-label="Erklärung"><p>${text}</p><button type="button" popovertarget="h-${id}" popovertargetaction="hide">Schließen</button></div></span>`;
}
// Karte „HO-Spielraum“ für einen Monat oder das Jahr: wie viel Homeoffice noch möglich ist, mit Erklärungen und Rechenweg.
// b: Block aus /api/horest (monat_block, jahr_block); p: Prognose desselben Zeitraums (monat_prognose, jahr_prognose) oder null.
function restKarte(b, id, p) {
  const ueber = b.ueberschritten_min > 0, g = KONFIG.ho_grenze;
  // Zeile mit Name, Wert und optional einem „?“-Hilfe-Knopf.
  const zeile = (name, wert, h, klasse = "") => `<div class="zeile"><span class="mit-hilfe">${name}${h ? hilfe(id + "-" + h[0], h[1]) : ""}</span><b class="${klasse}">${wert}</b></div>`;
  return `<div class="card spiel"><h2><span class="sr">Spielraum </span>${b.titel}</h2>
    <div class="spiel-kern ${ueber ? "ueber" : b.rot ? "knapp" : ""}"><span class="mit-hilfe">${ueber ? "Über der Grenze um" : "Noch möglich im Homeoffice"}${hilfe(id + "-kern", ueber
      ? `So viel HO-Zeit ist schon mehr als ${g} % der Gesamtzeit. Mehr Tage im Büro senken die Quote wieder.`
      : `So viel HO-Zeit kannst du noch dazunehmen, ohne über ${g} % zu kommen, wenn du an den restlichen Tagen wie geplant (Soll) arbeitest.`)}</span>
      <b>${ueber ? b.ueberschritten : b.rest} Std.</b><small>${tageText(ueber ? b.ueber_tage : b.rest_tage, ueber ? b.ueber_tage_std : b.rest_tage_std)} (1 Tag = ${b.tag_laenge})</small>${!ueber && b.rot ? "<small>Die Quote liegt gerade über der Grenze. Der Wert gilt für den ganzen Monat und stimmt nur, wenn die Zeit aus „Büro noch nötig“ noch dazukommt.</small>" : ""}</div>
    ${zeile("HO-Quote bisher", b.quote, ["quote", "HO-Zeit geteilt durch die ganze gearbeitete Zeit (HO + Büro), minutengenau."])}
    ${p ? zeile("Bei diesem Tempo", p.ohne_daten ? "–" : p.auto_quote, ["tempo", "Die Quote am Ende mit „Automatisch“: so viele Büro-Tage pro Woche wie bisher im Schnitt (bei Teilzeit bezogen auf deine Arbeitstage). Wochen mit Feiertag oder Urlaub zählen anteilig. Ohne gearbeiteten Tag gibt es noch kein Tempo."], !p.ohne_daten && p.auto_rot ? "rot" : "")
      + (p.buero_reicht_nicht
        ? zeile("Büro noch nötig", "nicht mehr möglich", ["dst", `Auch mit Büro an allen restlichen Tagen bleibt die Quote über ${g} %.`], "rot")
        : zeile("Büro noch nötig", `${p.noetig} · ${tage(p.noetig_tage)}`, ["dst", `So viel Zeit im Büro braucht es mindestens noch, damit die Quote unter ${g} % bleibt.`]))
      + zeile("Wenn alles Restliche HO wäre", p.varianten[0].quote, ["nurho", "Die Quote am Ende, wenn du an allen restlichen Soll-Tagen im Homeoffice arbeitest."]) : ""}
    <details class="auf"><summary>So wird gerechnet</summary>
      <div class="zeile"><span>bisher gearbeitet (HO + Büro)</span><b>${b.ist}</b></div>
      <div class="zeile"><span>noch geplant (Soll der restlichen Tage)</span><b>${b.geplant}</b></div>
      <div class="zeile"><span>Gesamtzeit</span><b>${b.gesamt}</b></div>
      <div class="zeile"><span>davon ${g} % (so viel darf HO sein)</span><b>${b.grenze80}</b></div>
      <div class="zeile"><span>bisher HO</span><b>${b.ho}</b></div>
      <p class="hinweis">Soll-Tage sind Mo–Fr ohne Feiertage, freie Tage, Urlaub, Gleittage und Krank, im Stundenumfang deines Abschnitts (z. B. Teilzeit).</p></details></div>`;
}
// Seite „HO-Spielraum“: Karten für Monat und Jahr und die Jahres-Prognose.
async function seiteHoRest() {
  const r = await api("GET", `/horest/${jahr}/${monat}`);
  return `<div class="kopf"><button ${kl("monatBlaettern", -1, false)} aria-label="Vorheriger Monat">‹</button><h2>${MONATE[monat - 1]} ${jahr}</h2><div class="kopf-rechts"><span class="kal-wahl"><button type="button" ${kl("monatKalender")} aria-label="Monat im Kalender wählen">${sym("monat")}</button><input id="m-kal" type="date" value="${jahr}-${pad(monat)}-01" data-wechsel="monatDatum" tabindex="-1" aria-hidden="true"></span><button class="heute-knopf" ${kl("zuHeute")}>Heute</button><button ${kl("monatBlaettern", 1, false)} aria-label="Nächster Monat">›</button></div></div>
    <div class="gitter paar">${restKarte(r.monat_block, "m", r.monat_prognose)}${restKarte(r.jahr_block, "j", r.jahr_prognose)}</div>${jahresPrognoseHtml(r.jahr_prognose)}`;
}

// ---- seiten/jahr.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// ---- Jahr
const VOR_BEGINN = "vor Beginn der Erfassung";       // gleicher Text wie bericht.VOR_BEGINN
const TAG_MS = 864e5;
// Letzter Tag vor „Erfassung gültig ab“ als TT.MM.JJJJ (bis dahin gelten die Startwerte).
const standBis = ab => de(new Date(Date.parse(ab + "T00:00:00Z") - TAG_MS).toISOString().slice(0, 10));
// Säulen der Quote je Monat mit Linie an der Grenze; Monate ohne Quote oder vor Beginn der Erfassung grau.
function jahrBalken(j) {
  const saeulen = j.monate.map(m => {
    const q = m.vor_beginn ? null : m.summe.quote;
    return `<a href="#/monat/${jahr}/${m.monat}" aria-label="${esc(`${m.name}: Quote ${q === null ? "keine" : m.text.quote}${m.vor_beginn ? ", " + VOR_BEGINN : ""}${m.rot ? ", über der Grenze" : ""}`)}"><i class="${q === null ? "nix" : (m.rot ? "rot" : "")}" data-stil="height:${q === null ? 3 : Math.max(3, Math.min(130, q * 130))}px"></i><span>${m.name.slice(0, 3)}</span></a>`;
  }).join("");
  return `<div class="balken">${mitGrenze() ? `<div class="linie" data-stil="bottom:${Math.round(155 * KONFIG.ho_grenze / 100)}px"><small>${KONFIG.ho_grenze} %</small></div>` : ""}${saeulen}</div>`;
}
// Seite „Jahr“: eine Karte mit Ring, Summen und Säulen je Monat, darunter die Tabelle der Monate.
async function seiteJahr() {
  const j = await api("GET", `/jahr/${jahr}`);
  const start = j.gesamt.start ? `<p class="hinweis">Stand bis ${standBis(j.gesamt.start.ab)} (Startwerte)</p>` : "";
  // Eine Zeile der Jahrestabelle; mit Monat ist sie antippbar und öffnet den Monat. Vor Beginn der Erfassung steht statt der Werte (alle 0) der Satz, nicht nur Grau.
  const werte = (s, t, rot) => einOrt() ? `<td>${t.ist}</td>` : `<td class="${rot ? "rot" : ""}">${t.quote}${rot ? '<span class="sr"> über der Grenze</span>' : ""}</td><td>${t.ho}</td><td>${t.dst}</td><td>${s.ho_tage}</td><td>${s.dst_tage}</td>`;
  const zeile = (name, s, t, rot, m, vor) => `<tr class="${m ? "klick" : ""}${vor ? " vor-beginn" : ""}" ${m ? kl("monatOeffnen", m) : ""}><td>${name}</td>${vor ? `<td colspan="${einOrt() ? 3 : 7}">${VOR_BEGINN}</td>` : `${werte(s, t, rot)}<td>${s.urlaub}</td><td>${s.soll_tage}</td>`}</tr>`;
  return `<div class="card jahr-karte"><h2>Jahresübersicht ${jahr}</h2><div class="hero">${einOrt() ? "" : ring(j.gesamt.quote, j.text.quote, j.rot)}
    <div class="txt"><b>${jahr} gesamt</b><span>${einOrt() ? "" : `${j.text.ho} HO · ${j.text.dst} Büro<br>`}Ist-Zeit ${j.text.ist}</span></div></div>${start}
    <div class="raster">${einOrt() ? "" : `<div class="ho"><b>${j.gesamt.ho_tage}</b><span>Tage HO</span></div><div class="ds"><b>${j.gesamt.dst_tage}</b><span>Tage Büro</span></div>`}<div><b>${j.gesamt.urlaub}</b><span>Urlaub</span></div></div>
    ${einOrt() ? "" : jahrBalken(j)}</div>
    <div class="card"><div class="tbl jahr-tbl"><table class="jahr-tab" aria-label="Monate ${jahr}"><tr><th>Monat</th>${einOrt() ? "<th>Ist</th>" : "<th>Quote</th><th>HO</th><th>Büro</th><th>T<br>HO</th><th>T<br>Büro</th>"}<th>Url</th><th>Soll</th></tr>
    ${j.monate.map(m => zeile(m.name.slice(0, 3), m.summe, m.text, m.rot, m.monat, m.vor_beginn)).join("")}${startZeile(j.gesamt.start)}${zeile("<b>Summe</b>", j.gesamt, j.text, j.rot, 0, false)}</table></div>
    <p class="hinweis">${einOrt() ? "Ist = gearbeitete Stunden." : "HO und Büro = Stunden im Homeoffice und im Büro. T HO = Tage nur im Homeoffice, T Büro = Tage im Büro (auch mit HO am selben Tag)."} Soll = Arbeitstage laut Abschnitt.</p></div>`;
}

// Zeile „Startwerte bis TT.MM.JJJJ“ vor der Summe (R6): Die Jahressumme enthält die Startwerte, ohne diese Zeile ginge sie nicht auf.
// Startwerte haben keine Tage und kein Soll, darum „–“ statt Quote, Tagen und Soll. Ohne Startwerte leer.
function startZeile(st) {
  if (!st) return "";
  const name = `Startwerte bis ${standBis(st.ab)}`, OHNE = "<td>–</td>";
  return einOrt() ? `<tr class="start-zeile"><td>${name}</td><td>${zeitText(st.ho_min + st.dst_min)}</td><td>${st.urlaub}</td>${OHNE}</tr>`
    : `<tr class="start-zeile"><td colspan="2">${name}</td><td>${zeitText(st.ho_min)}</td><td>${zeitText(st.dst_min)}</td>${OHNE}${OHNE}<td>${st.urlaub}</td>${OHNE}</tr>`;
}
// Öffnet einen Monat des gewählten Jahres.
function monatOeffnen(m) { monat = m; location.hash = "#/monat/" + jahr + "/" + m; }
// ---- seiten/urlaub.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Fehler in der Karte des Feldes zeigen statt als Browser-Dialog
function kartenFehler(feld, text) {
  const karte = $(feld)?.closest(".card"); if (!karte) { toast(text); return; }
  let box = karte.querySelector(".karten-fehler"); if (!box) { box = document.createElement("div"); box.className = "karten-fehler"; karte.appendChild(box); }
  box.id ||= "kf-" + ($(feld).id || "feld");
  formFehler(box, text, {feld: $(feld)});
}
// ---- Urlaub
async function familientageSchalten(an) {
  try { await api("PUT", "/familientage", {jahr, aktiv: an}); zeigen(); }
  catch (e) { $("#fam-fehler").innerHTML = meldung(e.message); }
}
// Seite „Urlaub & Gleittage“ (ohne Gleittage „Urlaub“): Urlaubskarten, darunter (Modul „planung“) die Urlaubsplanung als Abschnitt mit eigenem Ladezustand.
async function seiteUrlaub() {
  const html = await urlaubKarten();
  if (!modulAn("planung")) return html;
  window.nachher = async () => {
    const mein = zeigenZaehler, ziel = $("#planung");
    try {
      const h = await seitePlanung(true), binden = window.nachher;
      window.nachher = null;
      if (mein !== zeigenZaehler || !ziel.isConnected) return;
      ziel.innerHTML = h; beschriften(ziel); if (binden) binden();
      if (hashTeile()[1] === "planung") ziel.scrollIntoView();
    } catch (e) { if (ziel.isConnected) ziel.innerHTML = meldung(e.message); }
  };
  return html + `<section id="planung" aria-label="Urlaubsplanung"><div class="lade" role="status" aria-busy="true" aria-label="Urlaubsplanung lädt …"></div></section>`;
}
// Karten der Urlaub-Seite: einfache Ansicht mit Verbrauch und Rest, erweiterte mit Anspruch, Übertrag, angespartem Urlaub und freien Tagen.
async function urlaubKarten() {
  const u = await api("GET", `/urlaub/${jahr}`);
  const konten = u.konten.map(k => `<div class="zeile"><span>aus ${k.herkunft}: ${tage(k.tage)}, genommen ${komma(k.genommen)}${k.nutzbar ? "" : " <small>(in " + jahr + " nicht mehr nutzbar)</small>"}</span>
    <span><b>${komma(k.rest)}</b> <button ${kl("kontoLoeschen", k.herkunft)} class="gef" aria-label="Konto aus ${k.herkunft} entfernen">✕</button></span></div>`).join("") || `<div class="leer">Noch kein angesparter Urlaub eingetragen.</div>`;
  window.urlaubDaten = u;
  const ansicht = speicher.l("ho_urlaub_ansicht", "einfach");
  const umschalter = `<div class="seg segmitte"><button class="${ansicht === "einfach" ? "on" : ""}" ${kl("urlaubAnsicht", "einfach")}>Einfach</button><button class="${ansicht === "erweitert" ? "on" : ""}" ${kl("urlaubAnsicht", "erweitert")}>Erweitert</button></div>`;
  if (ansicht === "einfach") {
    // Zeile mit Titel und Wert.
    const z = (t, v, k) => `<div class="zeile gr"><span>${t}</span><b class="${k || ""}">${v}</b></div>`;
    return `${umschalter}<div class="gitter"><div class="card"><h2>Urlaubstage ${jahr}</h2>${z("Gesamt", komma(u.anspruch + u.uebertrag))}
      <p class="hinweis">Gesamt = Jahresanspruch ${komma(u.anspruch)} + Übertrag ${komma(u.uebertrag)} aus ${jahr - 1}.</p>${z("Verbraucht", komma(u.genommen))}${z("Verfügbar", komma(u.rest), u.rest < 0 ? "rot" : "")}</div>
      <div class="card"${md("gleittage")}><h2>Gleittage ${jahr}</h2>${z("Verbraucht", u.gleittage)}${z("Verfügbar", `${u.gleittage_rest} von ${u.gleittage_max}`, u.gleittage_rest === 0 ? "rot" : "")}</div>
      ${u.familientage_aktiv ? `<div class="card"${md("familientage")}><h2>Familientage ${jahr}</h2>${z("Verbraucht", u.familientage)}${z("Verfügbar", `${u.familientage_rest} von ${u.familientage_max}`, u.familientage_rest === 0 ? "rot" : "")}</div>` : ""}</div>
      <p class="hinweis nach-karten">Anspruch, Übertrag und angesparten Urlaub änderst du unter „Erweitert“.</p>`;
  }
  return `${umschalter}<div class="card"><h2>Erholungsurlaub ${jahr}</h2>
    <div class="zeile"><span class="bez">Jahresanspruch<small>Tage pro Jahr</small></span><span class="eingabe">${stepper("u-anspruch", u.anspruch, 1, 0, "Jahresanspruch in Tagen")}<button ${kl("anspruchSpeichern")}>Speichern</button></span></div>
    <div class="zeile"><span class="bez">Übertrag aus ${jahr - 1}<small>${u.uebertrag_hand ? "von Hand" : "automatisch"}</small></span>
      <span class="eingabe">${stepper("u-uebertrag", u.uebertrag, 1, 0, "Resturlaub aus dem Vorjahr in Tagen")}<button ${kl("uebertragSpeichern")}>Speichern</button></span></div>
    ${u.uebertrag_hand ? `<div class="zeile"><span><small>Automatisch wären ${tage(u.uebertrag_auto)}</small></span><button ${kl("uebertragAuto")}>Automatisch</button></div>` : ""}
    <div class="zeile"><span>genommen</span><b>${komma(u.genommen)}</b></div><div class="zeile"><span>Resturlaub (Anspruch + Übertrag − genommen)</span><b class="saldo plus">${komma(u.rest)}</b></div>
    <p class="hinweis">Der Resturlaub eines Jahres wird automatisch ins nächste Jahr übernommen (nie unter 0). Stimmt der Wert nicht, trage ihn hier von Hand ein. Die Folgejahre rechnen dann damit weiter.</p>
    <div class="zeile"${md("gleittage")}><span>Gleittage genommen (höchstens ${u.gleittage_max} pro Jahr)</span><b>${u.gleittage} von ${u.gleittage_max}</b></div>
    <div class="zeile"${md("angespart")}><span>Angesparter Urlaub genommen</span><b>${u.angespart_genommen_jahr}</b></div></div>
  <div class="card"${md("familientage")}><h2>Familientage ${jahr}</h2>
    <div class="zeile"><span>Familientage nutzen <small>(10 % der Arbeitszeit gegen zusätzliche Familientage getauscht, separat beantragt)</small></span>
      <input type="checkbox" ${u.familientage_aktiv ? "checked" : ""} data-wechsel="familientageSchalten" aria-label="Familientage nutzen"></div>
    ${u.familientage_aktiv ? `<div class="zeile"><span>genommen</span><b>${u.familientage} von ${u.familientage_max}</b></div>` : ""}
    <div id="fam-fehler"></div>
    <p class="hinweis">Standardmäßig aus. Ist es eingeschaltet, erscheint „Familientag“ unter „Art des Tages“ (höchstens ${u.familientage_max} pro Jahr, ohne Sollzeit wie Urlaub).</p></div>
  <div class="card"><h2>Verlauf</h2><table><tr><th>Monat</th><th>Url.</th><th${md("angespart")}>Angespart</th><th${md("gleittage")}>Gleittag</th><th>Rest</th></tr>
    ${u.verlauf.map(v => `<tr><td>${v.monat.slice(0, 3)}</td><td>${v.genommen || ""}</td><td${md("angespart")}>${v.angespart || ""}</td><td${md("gleittage")}>${v.gleittage || ""}</td><td>${komma(v.rest_nach)}</td></tr>`).join("")}</table></div>
  <div class="card"${md("angespart")}><h2>Angesparter Urlaub (Konten)</h2>${konten}
    <div class="reihe"><div><label>Herkunftsjahr</label>${stepper("k-jahr", jahr - 1, 1, 2000)}</div><div><label>Tage (max. 15)</label>${stepper("k-tage", 0, 1, 0)}</div></div>
    <div id="k-fehler"></div><div class="knoepfe"><button class="prim" ${kl("kontoSpeichern")}>Konto speichern</button></div>
    <p class="hinweis">Je Herkunftsjahr höchstens 15 Tage, nutzbar im Herkunftsjahr und in den drei Folgejahren. Trägst du einen Tag „Angesparter Urlaub“ ein, schlägt die App das älteste Konto vor.</p></div>
  <div class="card"><h2>Freie Tage</h2><p class="hinweis">Freie Tage wie Brückentage legst du unter Einstellungen bei den Feiertagen an. Sie zählen wie Feiertage und senken die Soll-Arbeitstage.</p>
    <div class="knoepfe"><a class="btn" href="#/einstellungen/arbeitszeit">Zu den Feiertagen</a></div></div>`;
}
// ---- Urlaubsplanung (M3): Blatt mit Monats-Raster. Erster Tipp = erster Tag, zweiter = letzter (davor getippt: getauscht). Geplante Tage sind normale Tageseinträge.
let planArt = "urlaub", planZeiten = [], planTimer = 0, planVon = "", planBis = "", planMonat = "", planFamilie = false, planMonate = {};
const PLAN_WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const PLAN_SCHRITT = {ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7};        // Pfeiltasten im Raster: ein Tag, eine Woche
// Datum als TT.MM. (ohne Jahr).
const planDatum = d => `${d.slice(8)}.${d.slice(5, 7)}.`;
// Zeitraum als Text (ein Tag oder „von–bis“, ohne Leerzeichen wie auf der Seite Krank).
const planBereich = z => z.von === z.bis ? de(z.von) : `${planDatum(z.von)}–${de(z.bis)}`;
// Heutiges Datum als JJJJ-MM-TT in Ortszeit.
const planHeute = () => new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
// Planbare Arten wie planung.PLAN_ARTEN, ohne abgeschaltete Module; „Kind krank“ ist nicht planbar (R5), Familientage nur, wenn sie aktiv sind.
const planArten = familie => [["urlaub", "Urlaub"], ["angespart", "Urlaub (angespart)"], ["gleittag", "Gleittag"], ["sonderurlaub_tag", "Sonderurlaub"]]
  .concat(familie ? [["familientag", "Familientag"]] : []).filter(a => artAn(a[0]));
// Zahl der Soll-Tage im Zeitraum aus den Tageszeilen von GET /api/monat (nur Anzeige; gezählt wird beim Eintragen vom Server).
const planArbeitstage = (tage, von, bis) => tage.filter(t => t.soll && t.datum >= von && t.datum <= (bis || von)).length;
// Merkt einen Tipp im Raster: der erste setzt den ersten Tag, der zweite den letzten, der dritte beginnt neu.
function planTipp(iso) {
  if (!planVon || planBis) { planVon = iso; planBis = ""; }
  else if (iso < planVon) { planBis = planVon; planVon = iso; }
  else planBis = iso;
}
// Abschnitt „Urlaubsplanung“ der Urlaub-Seite: Knopf zum Blatt und die geplanten Zeiträume mit Kalenderdatei.
// eingebettet: ohne die Übersicht der verfügbaren Tage (steht schon darüber).
async function seitePlanung(eingebettet) {
  const heute = planHeute();
  const [u, p] = await Promise.all([api("GET", `/urlaub/${heute.slice(0, 4)}`), api("GET", "/planung")]);
  planZeiten = p.zeitraeume; planFamilie = u.familientage_aktiv;
  window.nachher = () => { planKalenderLink(); document.querySelectorAll(".pl-neu").forEach(b => { b.onclick = planBlattOeffnen; }); };
  // Zeile mit Titel und Wert.
  const z = (t, v, k) => `<div class="zeile gr"><span>${t}</span><b class="${k || ""}">${v}</b></div>`;
  return `${eingebettet ? "" : `<div class="gitter"><div class="card"><h2>Urlaubstage ${heute.slice(0, 4)}</h2>${z("Verfügbar", komma(u.rest), u.rest < 0 ? "rot" : "")}${z("Bereits eingetragen", komma(u.genommen))}</div>
    <div class="card"${md("gleittage")}><h2>Gleittage ${heute.slice(0, 4)}</h2>${z("Verfügbar", `${u.gleittage_rest} von ${u.gleittage_max}`, u.gleittage_rest === 0 ? "rot" : "")}${z("Bereits eingetragen", u.gleittage)}</div></div>`}
    <div class="card"><h2>Geplant</h2><div class="knoepfe"><button type="button" class="prim pl-neu">Urlaub planen</button></div>${planListe()}</div>`;
}
// Liste der geplanten Zeiträume mit Haken für die Kalenderdatei. Arten abgeschalteter Module (z. B. Gleittage) zeigt sie nicht;
// die Nummer data-i bleibt die in planZeiten (Löschen, Kalenderdatei).
function planListe() {
  const sichtbar = planZeiten.map((x, i) => [x, i]).filter(([x]) => artAn(x.art));
  if (!sichtbar.length) return `<div class="leer">Noch nichts geplant.</div>`;
  const nz = sichtbar.map(([x, i]) => `<div class="zeile plan-zeile"><label class="plan-wahl"><input type="checkbox" class="pl-haken" data-i="${i}" checked data-wechsel="planKalenderLink"><span><b>${planBereich(x)}</b><br><small>${x.titel} · ${tage(x.tage)}</small></span></label>
    <button class="gef" ${kl("planLoeschen", i)} aria-label="Zeitraum löschen">✕</button></div>`).join("");
  return `${nz}<div class="knoepfe"><a class="btn prim" id="pl-kal" href="#">In Kalender übernehmen</a><a class="btn" id="pl-ics" href="#">Kalender (.ics)</a><button ${kl("planAlle", true)}>Alle</button><button ${kl("planAlle", false)}>Keine</button></div>
    <p class="hinweis">Nur die angehakten Zeiträume kommen in die Kalenderdatei. Vergangene Tage sind nie dabei.</p>`;
}
// Setzt oder löscht alle Haken der geplanten Zeiträume.
function planAlle(an) { document.querySelectorAll(".pl-haken").forEach(c => { c.checked = an; }); planKalenderLink(); }
// Setzt die Links der Kalenderdatei auf die angehakten Zeiträume (vergangene Tage sind nie dabei).
function planKalenderLink() {
  const a = $("#pl-ics"), k = $("#pl-kal"); if (!a) return;
  const z = [...document.querySelectorAll(".pl-haken:checked")].map(c => `${planZeiten[+c.dataset.i].von}_${planZeiten[+c.dataset.i].bis}`);
  a.setAttribute("href", z.length ? `api/planung/${z.join(",")}.ics` : "#"); a.classList.toggle("aus", !z.length);
  k.setAttribute("href", z.length ? `api/planung/${z.join(",")}.ics${ANSEHEN}` : "#"); k.classList.toggle("aus", !z.length);
}
// Monats-Raster des Blatts (Mo zuerst): je Tag ein Knopf mit Art-Punkt. Feiertag, Art und gewählte Enden stehen in der Ansage;
// vergangene Tage sind gesperrt, nur ein Tag ist mit Tab erreichbar (im Raster wandert der Fokus mit den Pfeiltasten).
function planRaster(m) {
  const bis = planBis || planVon, heute = planHeute();
  const fokus = m.tage.find(t => t.datum === planVon)?.datum || m.tage.find(t => t.datum >= heute)?.datum || m.tage[0].datum;
  const vorne = (new Date(Date.UTC(m.jahr, m.monat - 1, 1)).getUTCDay() + 6) % 7;
  const zellen = [...Array(vorne).fill('<span role="gridcell"></span>'), ...m.tage.map(t => {
    const ende = t.datum === planVon || t.datum === bis, drin = !!planVon && t.datum >= planVon && t.datum <= bis;
    const ansage = [`${t.wt} ${de(t.datum)}`, t.feiertag, ARTEN[t.art], t.datum === planVon ? "erster Tag" : "", planBis && planBis !== planVon && t.datum === planBis ? "letzter Tag" : ""].filter(Boolean).join(", ");
    const klasse = [t.soll ? "" : "frei", drin ? "im-zeitraum" : "", ende ? "gewaehlt" : ""].filter(Boolean).join(" ");
    return `<span role="gridcell"><button type="button" class="${klasse}" data-tag="${t.datum}" aria-pressed="${ende}" aria-label="${esc(ansage)}" tabindex="${t.datum === fokus ? 0 : -1}"${t.datum < heute ? " disabled" : ""}>${t.tag}${t.art ? `<i class="p a-${esc(t.art)}"></i>` : ""}</button></span>`;
  })];
  const zeilen = [];
  for (let i = 0; i < zellen.length; i += PLAN_WT.length) zeilen.push(`<div role="row">${zellen.slice(i, i + PLAN_WT.length).join("")}</div>`);
  return `<div class="plan-raster" role="grid" aria-label="${MONATE[m.monat - 1]} ${m.jahr}"><div role="row" class="plan-kopf">${PLAN_WT.map(w => `<span role="columnheader">${w}</span>`).join("")}</div>${zeilen.join("")}</div>`;
}
// Pfeiltasten im Raster: Fokus einen Tag oder eine Woche weiter; am Monatsrand und vor gesperrten Tagen bleibt er stehen. Enter wählt (Knopf).
function planTaste(e) {
  const schritt = PLAN_SCHRITT[e.key]; if (!schritt) return;
  const knoepfe = [...e.currentTarget.querySelectorAll("button[data-tag]")], i = knoepfe.indexOf(document.activeElement), ziel = knoepfe[i + schritt];
  e.preventDefault();
  if (i < 0 || !ziel || ziel.disabled) return;
  knoepfe[i].tabIndex = -1; ziel.tabIndex = 0; ziel.focus();
}
// Lädt einen Monat (GET /api/monat) einmal je geöffnetem Blatt.
async function planMonatLaden(jm) { return (planMonate[jm] ||= await api("GET", `/monat/${+jm.slice(0, 4)}/${+jm.slice(5, 7)}`)); }
// Zahl der Arbeitstage im Zeitraum über alle Monate von „von“ bis „bis“ (auch über den Jahreswechsel).
async function planArbeitstageLaden(von, bis) {
  const monate = [];
  for (let d = new Date(von.slice(0, 7) + "-01T00:00:00Z"); d.toISOString().slice(0, 7) <= bis.slice(0, 7); d.setUTCMonth(d.getUTCMonth() + 1)) monate.push(d.toISOString().slice(0, 7));
  const alle = (await Promise.all(monate.map(planMonatLaden))).flatMap(m => m.tage);
  return planArbeitstage(alle, von, bis);
}
// Satz unter dem Raster: was gewählt ist und was als Nächstes zu tun ist.
const planWahlText = () => !planVon ? "Tippe auf den ersten Tag." : planBis && planBis !== planVon ? `${de(planVon)} bis ${de(planBis)}` : `${de(planVon)}. Tippe auf den letzten Tag oder trage nur diesen Tag ein.`;
// Öffnet das Blatt „Urlaub planen“ im Monat des ersten gewählten Tages, sonst im laufenden Monat.
function planBlattOeffnen() { planMonate = {}; planMonat = (planVon || planHeute()).slice(0, 7); return planBlattZeichnen(); }
// Blättert im Blatt einen Monat vor oder zurück.
function planMonatWechseln(r) {
  const d = new Date(Date.UTC(+planMonat.slice(0, 4), +planMonat.slice(5, 7) - 1 + r, 1));
  planMonat = d.toISOString().slice(0, 7); planBlattZeichnen();
}
// Zeichnet das Blatt (nach Tipp, Monatswechsel, Art) und gibt den Fokus dem Tag zurück, der ihn hatte.
async function planBlattZeichnen() {
  const fokus = document.activeElement?.dataset?.tag;
  let m;
  try { m = await planMonatLaden(planMonat); } catch (e) { toastFehler(e.message); return; }
  const arten = planArten(planFamilie);
  if (!arten.some(a => a[0] === planArt)) planArt = arten[0]?.[0] || "urlaub";
  blatt(`<h3>Urlaub planen</h3>
    <span class="feld-titel" id="pl-art-titel">Art</span><div class="seg" id="pl-art" role="group" aria-labelledby="pl-art-titel">${arten.map(([k, t]) => `<button type="button" data-v="${k}" class="${planArt === k ? "on" : ""}" aria-pressed="${planArt === k}" ${kl("planArtWaehlen", k)}>${t}</button>`).join("")}</div>
    <div class="plan-monat"><button type="button" id="pl-zurueck" aria-label="Vorheriger Monat">‹</button><b>${MONATE[m.monat - 1]} ${m.jahr}</b><button type="button" id="pl-vor" aria-label="Nächster Monat">›</button></div>
    ${planRaster(m)}<p class="hinweis" id="pl-wahl">${planWahlText()}</p>
    <div id="pl-vorschau" class="plan-vorschau" aria-live="polite"></div><div id="pl-fehler"></div>
    <div class="knoepfe"><button class="prim" id="pl-ok" ${kl("planEintragen")} disabled>Eintragen</button><button type="button" ${kl("planZuruecksetzen")}>Zurücksetzen</button><button type="button" id="pl-zu">Abbrechen</button></div>
    <p class="hinweis">Wochenenden, Feiertage und freie Tage überspringt die App. Geplante Tage zählen genauso wie genommene.</p>`);
  const raster = $("#blatt-inh .plan-raster");
  raster.onclick = e => { const b = e.target.closest("button[data-tag]"); if (b && !b.disabled) { planTipp(b.dataset.tag); planBlattZeichnen(); } };
  raster.onkeydown = planTaste;
  $("#pl-zurueck").onclick = () => planMonatWechseln(-1); $("#pl-vor").onclick = () => planMonatWechseln(1); $("#pl-zu").onclick = blattZu;
  if (fokus) raster.querySelector(`[data-tag="${fokus}"]`)?.focus({preventScroll: true});
  planVorschau();
}
// Wählt die Art der Planung (Urlaub, Gleittag, …) und zeichnet das Blatt neu.
function planArtWaehlen(k) { planArt = k; return planBlattZeichnen(); }
// Rechnet die Vorschau des gewählten Zeitraums (kurz verzögert): Arbeitstage aus /api/monat, dazu beim Server Rest je Jahr und Warnungen.
function planVorschau() {
  clearTimeout(planTimer); $("#pl-vorschau")?.removeAttribute("data-fertig");
  planTimer = setTimeout(async () => {
    const box = $("#pl-vorschau"), ok = $("#pl-ok"), fehler = $("#pl-fehler"); if (!box) return;   // vor dem Warten merken: die Seite kann inzwischen neu gezeichnet sein
    const von = planVon, bis = planBis || planVon;
    try {
      if (!von) { box.innerHTML = ""; ok.disabled = true; }
      else {
        const v = await api("POST", "/planung/vorschau", {art: planArt, von, bis}), n = await planArbeitstageLaden(von, bis);
        const zeilen = v.jahre.map(j => `<div class="zeile gr"><span>${esc(j.bezeichnung)} ${j.jahr}</span><b class="${j.nach < 0 ? "rot" : ""}">${j.vor} → ${j.nach}</b></div>${j.warnung ? `<p class="hinweis rot">${esc(j.warnung)}</p>` : ""}`).join("");
        const sk = v.uebersprungen.length ? `<p class="hinweis">Übersprungen: ${v.uebersprungen.map(x => `${planDatum(x.datum)} (${esc(x.grund)})`).join(", ")}</p>` : "";
        const bereits = v.schon ? `<p class="hinweis">${anzahl(v.schon, "Tag ist", "Tage sind")} schon so eingetragen.</p>` : "";
        box.innerHTML = `<div class="zeile gr"><span>Im Zeitraum</span><b>${anzahl(n, "Arbeitstag", "Arbeitstage")}</b></div>${v.neu.length ? zeilen : `<p class="hinweis">Keine neuen Tage im Zeitraum.</p>`}${sk}${bereits}`;
        ok.disabled = !v.neu.length || v.gesperrt;
      }
      fehler.innerHTML = "";
    } catch (e) { box.innerHTML = ""; ok.disabled = true; fehler.innerHTML = meldung(e.message); }
    box.dataset.fertig = "1";   // Kennzeichen für Prüfwerkzeuge: Vorschau ist gezeichnet
  }, 150);
}
// Zeigt das Ergebnis einer Eintragung oder Löschung mit Rückgängig und zeichnet die Seite neu.
function planErgebnis(r) {
  rueckgaengigZeigen(r);                                    // nichts geändert (rueckgaengig null): keine Leiste
  zeigen();
}
// Trägt den gewählten Zeitraum ein (POST /api/planung), schließt das Blatt und bietet Rückgängig an.
async function planEintragen() {
  try {
    const r = await api("POST", "/planung", {art: planArt, von: planVon, bis: planBis || planVon});
    planVon = planBis = ""; blattZu(); planErgebnis(r);
  } catch (e) { $("#pl-fehler").innerHTML = meldung(e.message); }
}
// Hebt die Auswahl im Blatt auf und stellt die Art auf Urlaub.
function planZuruecksetzen() { planVon = planBis = ""; planArt = "urlaub"; return planBlattZeichnen(); }
// Löscht einen geplanten Zeitraum nach Rückfrage und bietet Rückgängig an.
async function planLoeschen(i) {
  const x = planZeiten[i];
  if (!(await frage(`${x.titel} ${planBereich(x)} (${tage(x.tage)}) löschen?`, "Löschen", true))) return;
  try { planErgebnis(await api("DELETE", `/planung/${x.von}_${x.bis}_${x.art}`)); } catch (e) { toastFehler(e.message); }
}
// Wechselt die Ansicht der Urlaubsseite (einfach oder erweitert).
function urlaubAnsicht(a) { speicher.s("ho_urlaub_ansicht", a); zeigen(); }
// Speichert Anspruch, freie Tage und die übergebenen Änderungen des Urlaubs für das Jahr und zeichnet neu.
async function urlaubPut(extra) {
  const u = window.urlaubDaten;
  await api("PUT", "/urlaub", {jahr, anspruch: u.anspruch, eigene_frei: u.eigene_frei, ...extra}); zeigen();
}
// Speichert eine Änderung des Urlaubs und meldet das Ergebnis; Fehler erscheinen in der Karte des Feldes.
const urlaubSetzen = async (feld, extra, gespeichert = "Gespeichert.") => { try { await urlaubPut(extra); toast(gespeichert); } catch (e) { kartenFehler(feld, e.message); } };
// Speichert den Übertrag aus dem Vorjahr von Hand.
const uebertragSpeichern = () => urlaubSetzen("#u-uebertrag", {uebertrag: $("#u-uebertrag").value});
// Setzt den Übertrag wieder auf automatisch.
const uebertragAuto = () => urlaubSetzen("#u-uebertrag", {uebertrag: null});
// Speichert den Jahresanspruch.
const anspruchSpeichern = () => urlaubSetzen("#u-anspruch", {anspruch: +$("#u-anspruch").value});
// Speichert ein Konto für angesparten Urlaub (Herkunftsjahr und Tage).
async function kontoSpeichern() { try { await urlaubPut({konten: [{herkunft: +$("#k-jahr").value, tage: +$("#k-tage").value}]}); toast("Gespeichert."); } catch (e) { $("#k-fehler").innerHTML = meldung(e.message); } }
// Entfernt das Konto eines Herkunftsjahrs, nach Rückfrage.
async function kontoLoeschen(h) { if ((await frage(`Konto aus ${h} entfernen?`, "Entfernen", true))) await urlaubSetzen("#k-jahr", {konten: [{herkunft: h, tage: 0}]}, "Konto entfernt."); }
// ---- seiten/krank.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Reiter „Krank“: Phasen zusammenhängender Kranktage mit Attest-Status (bis 3 Tage ohne Attest), dazu Einträge vor „Erfassung gültig ab“.
// Zeitraum einer Krankheitsphase als Text.
const krankZeitraum = p => p.von === p.bis ? p.von_text : `${p.von_text.slice(0, 6)}–${p.bis_text}`;
// Ein Tag als Chip; ein nicht gezählter Tag ist grau und sagt es auch dem Screenreader.
const krankTag = d => `<span class="${d.zaehlt ? "" : "aus"}">${esc(d.wt)} ${esc(d.datum)}${d.zaehlt ? "" : '<span class="sr">, zählt nicht</span>'}</span>`;
// Zeile unter dem Kopf einer Phase (gezählte Tage, im Dienst, Notiz); leer, wenn es nichts zu sagen gibt.
function krankPhaseInfo(p) {
  const teile = [p.tage ? tage(p.tage) + " krank" : "", p.im_dienst ? p.im_dienst + " im Dienst" : "", p.notiz ? esc(p.notiz) : ""].filter(Boolean);
  return teile.length ? `<div class="phase-info">${teile.join(" · ")}</div>` : "";
}
// Karte einer Phase mit Text und Farbe ihres Status; antippen öffnet den Monat ihres ersten Tages.
function krankPhase(p, [txt, kl]) {
  return `<a class="phase" href="#/monat/${jahr}/${+p.von.slice(5, 7)}"><div class="phase-kopf"><b>${krankZeitraum(p)}</b><span class="chip-s ${kl}">${txt}${p.status === "attest" ? " " + esc(p.attest.slice(0, 6)) : ""}</span></div>
    ${krankPhaseInfo(p)}<div class="phase-tage">${p.tage_liste.map(krankTag).join("")}</div></a>`;
}
// Einträge vor „Erfassung gültig ab“ (R6): bleiben sichtbar, grau, mit dem Hinweis des Kerns; sie zählen nicht und bilden keine Phase.
function krankVorBeginn(liste) {
  const vor = liste.filter(e => e.vor_beginn);
  if (!vor.length) return "";
  return `<div class="card vor-beginn"><h2>${esc(vor[0].hinweis)}</h2><div class="phase-tage">${vor.map(e => `<span class="aus">${esc(e.wt)} ${esc(e.datum)}<span class="sr">, zählt nicht</span></span>`).join("")}</div>
    <p class="hinweis">Sie zählen nicht mit. Kranktage vor Beginn gehören in den Startwert.</p></div>`;
}
// Seite „Krank“: Kennzahlen, Warnung bei fehlendem Attest, Phasen, Einträge vor Beginn der Erfassung.
async function seiteKrank() {
  const k = await api("GET", `/krank/${jahr}`);
  // Text und Farbe je Status einer Phase; jeder Wert aus bericht.KRANK_STATUS braucht einen Eintrag, sonst bricht die Seite.
  const STATUS = {attest: ["Attest abgegeben", "ok"], ohne: ["ohne Attest (bis 3 Tage)", "mut"], fehlt: ["Attest fehlt", "rot"], dienst: ["Krank im Dienst", "mut"], frei: ["zählt nicht (kein Arbeitstag)", "mut"]};
  const karten = k.phasen.map(p => krankPhase(p, STATUS[p.status])).join("") || `<div class="leer">${k.liste.length ? "Seit Beginn der Erfassung keine Krankmeldungen." : `Keine Krankmeldungen in ${jahr}.`} Kranktage trägst du am Tag über „Art des Tages“ ein.</div>`;
  const warn = k.attest_fehlt ? `<div class="card kachel warnungen"><span class="warn">${tage(k.attest_fehlt)} ohne Attest nach den ersten 3 Kranktagen. Bitte Attest-Datum eintragen.</span></div>` : "";
  return `<div class="krank-kacheln"><div class="card"><b>${k.kranktage}</b><span>Kranktage ${jahr}</span></div>${k.krank_start > 0 ? `<div class="card"><b>${k.krank_start}</b><span>aus Startwerten</span></div>` : ""}<div class="card"><b>${k.attest}</b><span>mit Attest</span></div>
    <div class="card"><b>${k.ohne_attest}</b><span>ohne Attest</span></div><div class="card"><b>${k.im_dienst}</b><span>Krank im Dienst</span><small>kein Kranktag</small></div></div>
    ${warn}<div class="card"><h2>Krankheitsphasen</h2><div class="phasen">${karten}</div>
    <p class="hinweis">Eine Phase sind zusammenhängende Kranktage. Wochenenden und freie Tage unterbrechen sie nicht. Bis 3 Tage gehen ohne Attest. Tippe auf eine Phase, um den Monat zu öffnen. Dort trägst du Kranktage über „Art des Tages“ ein. Das Attest-Datum gilt für die ganze Phase.</p></div>
    ${krankVorBeginn(k.liste)}`;
}
// ---- seiten/steuer.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Seite „Steuer“ (Homeoffice-Übersicht): Jahreswerte (Quote, Stunden, Tage) zur Information, Krank- und Elternzeit-Zeiträume, Startwerte (R8).
const STEUER_FORMATE = [["PDF", "pdf"], ["Excel", "xlsx"], ["CSV", "csv"], ["Word", "docx"], ["ODT", "odt"], ["JSON", "json"], ["XML", "xml"]];
// Zeile mit Titel und Wert, beide maskiert.
const steuerZeile = (t, v) => `<div class="zeile"><span>${esc(t)}</span><b>${esc(v)}</b></div>`;
// Ein Zeitraum (Kranktage oder Elternzeit): Von bis Bis mit Zahl der Tage, Hinweis über die Jahresgrenze; bei Krank Attest-Text und Abgabe-Datum.
function steuerZeitraum(z) {
  const unter = [z.attest_datum ? `Attest abgegeben am ${esc(z.attest_datum)}` : "", esc(z.hinweis)].filter(Boolean).join(" · ");
  return `<div class="zeile zeitraum"><span>${esc(z.von)} bis ${esc(z.bis)} (${anzahl(z.tage, "Tag", "Tage")})${unter ? `<br><small>${unter}</small>` : ""}</span>${z.attest_text ? `<b>${esc(z.attest_text)}</b>` : ""}</div>`;
}
// Karte einer Liste von Zeiträumen mit Zahl im Titel; ohne Zeitraum „Keine.“.
const steuerZeitraeume = (titel, liste) => `<div class="card"><h2>${titel} (${liste.length})</h2>${liste.map(steuerZeitraum).join("") || '<div class="leer">Keine.</div>'}</div>`;
// Block der Startwerte (nur im Jahr von „Erfassung gültig ab“): Stand bis zum Vortag, gleiche Zeilen wie bericht._start_zeilen.
function steuerStart(s) {
  const st = s.start;
  return !st ? "" : `<div class="card"><h2>${esc(`Stand bis ${s.stand_bis} (Startwerte)`)}</h2>
    ${steuerZeile("HO-Stunden", zeitText(st.ho_min))}${steuerZeile("Büro-Stunden", zeitText(st.dst_min))}${steuerZeile("Urlaubstage", st.urlaub)}
    ${steuerZeile("Gleittage", st.gleittage)}${steuerZeile("Kranktage", st.krank)}${modulAn("kind_krank") ? steuerZeile("Kind krank (Tage)", st.kind_krank) : ""}</div>`;
}
// Seite „Steuer“ des gewählten Jahres; Sonderurlaub und Kind krank nur mit eingeschaltetem Modul.
async function seiteSteuer() {
  const s = await api("GET", `/steuer/${jahr}`);
  // Hervorgehobener Wert mit Titel und Zusatztext.
  const kern = (titel, wert, klein) => `<div class="spiel-kern"><span>${titel}</span><b>${esc(wert)}</b><small>${klein}</small></div>`;
  return `<div class="gitter paar"><div class="card spiel"><h2>Homeoffice ${jahr}</h2>
      ${kern("HO-Quote im Jahr", s.quote, `${esc(s.ho_stunden)} Std. Homeoffice · ${esc(s.dst_stunden)} Std. Büro`)}
      ${steuerZeile("Tage im Homeoffice (nur HO)", s.ho_tage)}${steuerZeile("Tage im Büro (auch mit HO am selben Tag)", s.dst_tage)}
      ${steuerZeile("HO-Stunden", s.ho_stunden)}${steuerZeile("Büro-Stunden", s.dst_stunden)}</div>
    <div class="card spiel"><h2>Abwesenheit ${jahr}</h2>
      ${kern("Urlaubstage", s.urlaub, `Erholungsurlaub · dazu ${anzahl(s.gleittage, "Gleittag", "Gleittage")}`)}
      ${steuerZeile("Angesparter Urlaub (Tage)", s.angespart)}${steuerZeile("Gleittage", s.gleittage)}
      ${modulAn("sonderurlaub") ? steuerZeile("Sonderurlaub (Tage)", s.sonderurlaub) : ""}
      ${steuerZeile("Kranktage (ohne „Krank im Dienst“)", s.krank)}${s.start ? steuerZeile("davon vor Beginn der Erfassung", s.start.krank) : ""}${steuerZeile("davon mit Attest", s.krank_attest)}
      ${modulAn("kind_krank") ? steuerZeile("Kind krank (Tage)", s.kind_krank) : ""}
      ${steuerZeile("Krank im Dienst (nur aufgeführt)", s.krank_dienst)}${steuerZeile("Tage in Elternzeit", s.elternzeit_tage)}</div></div>
    ${steuerStart(s)}
    <div class="card"><h2>Übersicht ${jahr} herunterladen</h2>
    <div class="knoepfe">${STEUER_FORMATE.map(([n, e], i) => `<a class="btn${i ? "" : " prim"}" href="api/steuer/${jahr}.${e}">${n}</a>`).join("")}</div></div>
    ${steuerZeitraeume("Kranktage", s.krank_zeitraeume)}${steuerZeitraeume("Elternzeit", s.elternzeit_zeitraeume)}`;
}
// ---- seiten/export.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Seite „Export“ (M5): erste Karte „Teilen statt Herunterladen“, dann je Export eine Karte mit eigener Wahl, Vorschau und Format-Knöpfen.
const EXPORT_VORSCHAU = 5;                                       // Zeilen der Vorschau je Karte
// Felder in exportWahl, die „Heute“ einer Karte zurücksetzt: Monat, Jahr der Homeoffice-Übersicht (nj), Jahr des Kalenders (kj).
const EXPORT_HEUTE = {monat: ["j", "m"], nj: ["nj"], kj: ["kj"]};
const FORMATE_MONAT = [["PDF", "pdf"], ["Word", "docx"], ["ODT", "odt"], ["ODS", "ods"], ["Markdown", "md"], ["Text", "txt"], ["JSON", "json"], ["XML", "xml"], ["CSV", "csv"]];
const FORMATE_UEBERSICHT = [["PDF", "pdf"], ["Excel", "xlsx"], ["Word", "docx"], ["ODT", "odt"], ["ODS", "ods"], ["Markdown", "md"], ["Text", "txt"], ["JSON", "json"], ["XML", "xml"], ["CSV", "csv"]];
const KALENDER_OHNE = ["", "krank_dienst"];                    // Arten ohne Termin im Kalender (export.ICS_ARTEN)
// Speichert den Schalter „Teilen statt Herunterladen“.
function teilenSchalten(an) { try { localStorage.setItem(EIGEN + "ho_teilen", an ? "1" : "0"); } catch (e) {} }
// Übernimmt den gewählten Monat („JJJJ-M“) in die Auswahl der Export-Seite und zeichnet neu.
function exportMonatWaehlen(w) { const [j, m] = w.split("-").map(Number); if (j && m) { exportWahl.j = j; exportWahl.m = m; zeigen(); } }
// Übernimmt ein gewähltes Jahr: Feld data-feld „kj“ für den Kalender, sonst „nj“ für die Homeoffice-Übersicht.
function exportJahrWaehlen(w, e) { exportWahl[e && e.dataset.feld === "kj" ? "kj" : "nj"] = +w; zeigen(); }
// „Heute“ einer Karte: setzt nur deren Wahl zurück (feld aus EXPORT_HEUTE), ohne feld alle; seiteExport füllt sie mit heute.
function exportHeute(feld) { if (exportWahl) (EXPORT_HEUTE[feld] || Object.keys(exportWahl)).forEach(k => delete exportWahl[k]); zeigen(); }
// Wahl der Export-Seite: gültige Felder bleiben, fehlende oder ungültige werden heute (sonst der neueste Zeitraum mit Einträgen).
// Eingaben: alte Wahl (oder null), Monate „JJJJ-MM“ und Jahre mit Einträgen (neueste zuerst). Rückgabe {j, m, nj, kj}.
function exportWahlPruefen(w, mit, jahre) {
  const hm = `${heute.getFullYear()}-${pad(heute.getMonth() + 1)}`, vm = mit.includes(hm) ? hm : mit[0];
  const vj = jahre.includes(heute.getFullYear()) ? heute.getFullYear() : jahre[0], alt = w || {}, monatOk = mit.includes(`${alt.j}-${pad(alt.m)}`);
  return {j: monatOk ? alt.j : +vm.slice(0, 4), m: monatOk ? alt.m : +vm.slice(5), nj: jahre.includes(alt.nj) ? alt.nj : vj, kj: jahre.includes(alt.kj) ? alt.kj : vj};
}
// Format-Knöpfe einer Karte (erster hervorgehoben), nur die von den Modulen erlaubten; leer, wenn keiner bleibt.
function exportKnoepfe(links, titel) {
  const an = links.filter(([, u]) => linkAn(u));
  return an.length ? `<div class="knoepfe">${an.map(([n, u], i) => `<a class="btn${i ? "" : " prim"}" href="${u}" aria-label="${esc(`${titel}: ${n}`)}">${esc(n)}</a>`).join("")}</div>` : "";
}
// Vorschau als Tabelle: Kopf und Zeilen aus Texten, alles maskiert.
function exportTabelle(kopf, zeilen) {
  return `<div class="tbl"><table><thead><tr>${kopf.map(k => `<th scope="col">${esc(k)}</th>`).join("")}</tr></thead>
    <tbody>${zeilen.map(z => `<tr>${z.map(w => `<td>${esc(w)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}
// Auswahl einer Karte mit Etikett und „Heute“ (feld aus EXPORT_HEUTE); wechsel ist der Name aus WECHSEL, data-feld sagt, welches Jahr.
function exportAuswahl(id, etikett, wechsel, feld, werte, gewaehlt, was) {
  return `<label for="${id}">${esc(etikett)}</label><div class="feld-heute"><select id="${id}" data-wechsel="${wechsel}" data-feld="${feld}">${werte.map(([w, t]) => `<option value="${w}"${w === gewaehlt ? " selected" : ""}>${esc(t)}</option>`).join("")}</select><button type="button" class="heute-knopf" ${kl("exportHeute", feld)}>Heute<span class="sr">: ${esc(was)}</span></button></div>`;
}
// Karte eines Exports; ohne erlaubten Format-Knopf fehlt sie ganz.
function exportKarte(id, titel, wahl, vorschau, knoepfe) {
  return knoepfe ? `<section class="card" aria-labelledby="${id}-t"><h2 id="${id}-t">${esc(titel)}</h2>${wahl}<p class="vorschau-titel">Vorschau</p>${vorschau}${knoepfe}</section>` : "";
}
// Vorschau Monat: die ersten Tage mit Eintrag; HO und Büro wie vom Server, Ist aus Minuten, an Tagen ohne Zeit die Art.
function monatVorschau(tage) {
  const zeilen = tage.filter(z => z.art || z.ho || z.dst).slice(0, EXPORT_VORSCHAU)
    .map(z => [`${z.tag}. ${z.wt}`, ...(einOrt() ? [] : [z.ho, z.dst]), z.ist_soll_min ? zeitText(z.ist_soll_min) : ARTEN[z.art] || ""]);
  return exportTabelle(einOrt() ? ["Tag", "Ist"] : ["Tag", "HO", "Büro", "Ist"], zeilen);
}
// Vorschau Homeoffice-Übersicht: die ersten Zeilen der Jahreswerte (wie auf dem Reiter Steuer).
function uebersichtVorschau(s) {
  return exportTabelle(["Angabe", "Wert"], [["HO-Quote im Jahr", s.quote], ["Tage im Homeoffice (nur HO)", s.ho_tage], ["Tage im Büro (auch mit HO am selben Tag)", s.dst_tage],
    ["HO-Stunden", s.ho_stunden], ["Büro-Stunden", s.dst_stunden]]);
}
// Vorschau Kalender: Zahl der Tage je Art im Jahr nj (nur Arten, die als Termin in den Kalender kommen).
function kalenderVorschau(tage, nj) {
  const zahl = {};
  tage.filter(t => +t.datum.slice(0, 4) === nj && !KALENDER_OHNE.includes(t.art)).forEach(t => { zahl[t.art] = (zahl[t.art] || 0) + 1; });
  return exportTabelle(["Art", "Tage"], Object.keys(ARTEN).filter(a => zahl[a]).slice(0, EXPORT_VORSCHAU).map(a => [ARTEN[a], zahl[a]]));
}
// Karte Kalender eines Jahres (nj): Vorschau und die Knöpfe „In Kalender übernehmen“, Jahr, alle Jahre.
function kalenderKarte(nj, jahre, tage) {
  const wahl = exportAuswahl("ex-kal", "Jahr (nur Jahre mit Einträgen)", "exportJahrWaehlen", "kj", jahre.map(x => [x, String(x)]), nj, "aktuelles Jahr, Kalender");
  return exportKarte("ex-kal", "Kalender (Abwesenheiten)", wahl, kalenderVorschau(tage, nj),
    exportKnoepfe([[`${nj} in Kalender übernehmen`, `api/kalender/${nj}.ics${ANSEHEN}`], [`${nj}`, `api/kalender/${nj}.ics`], ["Alle Jahre", "api/kalender.ics"]], "Kalender"));
}
// Vorschau „Alle erfassten Tage“: die ersten Zeilen der Datei (Datum, Art, Stunden aus Minuten).
function alleVorschau(tage) {
  return exportTabelle(["Datum", "Art", "Stunden"], tage.slice(0, EXPORT_VORSCHAU).map(t => [de(t.datum), ARTEN[t.art] || "", t.ho_minuten + t.dienststelle_minuten ? zeitText(t.ho_minuten + t.dienststelle_minuten) : ""]));
}
// Erste Karte: Teilen statt Herunterladen (wo das Gerät es kann) und der Verweis auf den Monatsnachweis.
function teilenKarte() {
  const teilen = teilenMoeglich() ? `<div class="zeile"><span>Teilen statt Herunterladen<br><small>öffnet das Teilen-Menü deines Geräts</small></span><input type="checkbox" ${teilenAn() ? "checked" : ""}${alsApp() ? " disabled" : ""} data-wechsel="teilenSchalten" aria-label="Teilen statt Herunterladen"></div>${alsApp() ? `<p class="hinweis">Als App vom Home-Bildschirm gilt immer das Teilen-Menü („In Dateien sichern“).</p>` : ""}` : `<p class="hinweis">Dieser Browser hat kein Teilen-Menü. Die Dateien werden heruntergeladen.</p>`;
  const nachweis = seiteWeg("monatsnachweis") ? "" : `<p class="hinweis">Den Nachweis für deinen Arbeitgeber erstellst du unter <a href="#/monatsnachweis">${esc(weg("monatsnachweis"))}</a>.</p>`;
  return `<section class="card" aria-label="Teilen">${teilen}${nachweis}</section>`;
}
// Seite „Export“: wählbar sind nur Monate und Jahre mit Einträgen; Vorschauen laden nur für Karten, die ein Modul erlaubt.
async function seiteExport() {
  const mit = (await api("GET", "/zeitraeume")).monate, jahre = [...new Set(mit.map(x => +x.slice(0, 4)))];   // nur Monate und Jahre mit Einträgen, neueste zuerst
  if (!mit.length) return `<div class="card"><h2>Export</h2><div class="leer">Noch keine Einträge. Sobald Tage erfasst sind, stehen hier die Auswertungen der Monate und Jahre mit Einträgen.</div></div>`;
  exportWahl = exportWahlPruefen(exportWahl, mit, jahre);
  const {j: ej, m: em, nj, kj} = exportWahl, mo = `api/monat/${ej}/${em}`;
  const brauchtTage = linkAn("x.ics") || linkAn("x.json") || linkAn("x.xml") || linkAn("x.csv");
  const [monatDaten, s, alle] = await Promise.all([api("GET", `/monat/${ej}/${em}`), modulAn("nachweis") ? api("GET", `/steuer/${nj}`) : null,
    brauchtTage ? api("GET", "/export.json") : {tage: []}]);
  const monatWahl = exportAuswahl("ex-monat", "Monat (nur Monate mit Einträgen)", "exportMonatWaehlen", "monat", mit.map(x => [x, `${MONATE[+x.slice(5) - 1]} ${x.slice(0, 4)}`]), `${ej}-${pad(em)}`, "aktueller Monat");
  const jahrWahl = exportAuswahl("ex-jahr", "Jahr (nur Jahre mit Einträgen)", "exportJahrWaehlen", "nj", jahre.map(x => [x, String(x)]), nj, "aktuelles Jahr, Homeoffice-Übersicht");
  return teilenKarte()
    + exportKarte("ex-monat", "Monat", monatWahl, monatVorschau(monatDaten.tage), exportKnoepfe(FORMATE_MONAT.map(([n, e]) => [n, `${mo}.${e}`]), `Monat ${MONATE[em - 1]} ${ej}`))
    + (s ? exportKarte("ex-jahr", "Homeoffice-Übersicht", jahrWahl, uebersichtVorschau(s), exportKnoepfe(FORMATE_UEBERSICHT.map(([n, e]) => [n, `api/steuer/${nj}.${e}`]), `Homeoffice-Übersicht ${nj}`)) : "")
    + kalenderKarte(kj, jahre, alle.tage)
    + exportKarte("ex-alle", "Alle erfassten Tage", "", alleVorschau(alle.tage), exportKnoepfe([["JSON", "api/export.json"], ["XML", "api/export.xml"], ["CSV", "api/export.csv"]], "Alle Tage"));
}
const ENDUNG_MODUL = {pdf: "ex_pdf", docx: "ex_office", odt: "ex_office", ods: "ex_office", xlsx: "ex_office", md: "ex_text", txt: "ex_text", json: "ex_daten", xml: "ex_daten", csv: "ex_daten", ics: "ex_kalender"};
// Ist der Link eines Exports (nach Dateiendung) bei den eingeschalteten Modulen erlaubt?
const linkAn = u => modulAn(ENDUNG_MODUL[u.split("?")[0].split(".").pop()] || "");
// ---- seiten/sicherung.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Ladezeile, solange Wiederherstellen oder das Passwort der Handy-Sicherung auf eine laufende Synchronisierung warten (W1, bis zu 45 s)
const SICHERUNG_WARTEN = "Bitte warten. Läuft gerade eine Synchronisierung, kann das bis zu 45 Sekunden dauern.";
// Karte „Daten prüfen“ (funktionen.md 10): Zeichen und Name je Schwere, nie nur die Farbe
const PRUEFEN_SCHWERE = {fehler: ["✕", "Fehler"], hinweis: ["!", "Hinweis"]};
const PRUEFEN_LAEDT = "Prüfe …";
// Karte „App prüfen“ (Runde 2.7): Ergebnis des Prüfdatensatzes
const APP_PRUEFEN_OK = "Alle Werte stimmen.";
// Seite „Sicherung“: Daten prüfen, Datenbank herunterladen, aus einer Sicherungsdatei wiederherstellen, (Handy, Web-App) die verschlüsselte Sicherung und App prüfen.
function seiteSicherung() {
  window.nachher = () => { sichInfo(); };
  return `<div class="card" id="pruefen-karte"><h2>Daten prüfen</h2>
      <p class="hinweis" data-stil="margin-top:0">Sucht in allen Tagen nach Unstimmigkeiten: Gehen vor Kommen, Urlaub und Arbeitszeit am selben Tag, Arbeitszeit an Feiertagen, mehr Urlaub als Anspruch. Die Prüfung ändert nichts.</p>
      <div class="knoepfe"><button class="prim" id="pruefen-knopf" ${kl("datenPruefen")}>Daten prüfen</button></div>
      <div id="pruefen-ergebnis" role="status"></div></div>
    <div class="gitter paar"><div class="card"><h2>Sicherung</h2>
      <p class="hinweis" data-stil="margin-top:0">Die komplette Datenbank (alle Tage, Urlaub, Regeln, Einstellungen) als Datei. Damit lässt sich alles wiederherstellen.</p>
      <div class="knoepfe"><a class="btn prim" id="sich-dl" href="api/sicherung">Sicherung herunterladen</a></div>
      <div id="sich-info"></div></div>
    <div class="card"><h2>Wiederherstellen</h2>
      <p class="hinweis" data-stil="margin-top:0">Ersetzt alle Einträge und Einstellungen durch den Stand einer Sicherung. Der jetzige Stand wird vorher automatisch gesichert.</p>
      ${FERN ? `<p class="hinweis">Wiederherstellen geht nur am Rechner, in der App dort.</p>` : `<label>Sicherungsdatei von diesem Gerät (.db)</label>
      <input type="file" id="wh-datei" accept=".db,application/octet-stream" hidden data-wechsel="dateiNameZeigen">
      <div class="knoepfe dateiwahl"><button type="button" ${kl("dateiWaehlen")}>Datei auswählen</button><span id="wh-name">keine Datei gewählt</span></div>
      <div class="knoepfe"><button class="gef" ${kl("wiederherstellen")}>Wiederherstellen …</button></div>`}
      <div id="wh-fehler"></div>
      <div id="wh-davor"></div>
      <p class="hinweis">Exporte als JSON, XML oder CSV enthalten nur die Tage, keine Einstellungen. Sie lassen sich hier nicht einspielen.</p></div></div>
    <div id="handy-sich"></div>
    <div class="card" id="app-pruefen-karte"><h2>App prüfen</h2>
      <p class="hinweis" data-stil="margin-top:0">Rechnet einen festen Satz erfundener Tage durch und vergleicht mit Werten, die von Hand gerechnet sind. Deine Daten fasst die Prüfung nicht an.</p>
      <div class="knoepfe"><button id="app-pruefen-knopf" ${kl("appPruefen")}>App prüfen</button></div>
      <div id="app-pruefen-ergebnis" role="status"></div></div>`;
}
// Fragt den Dienst nach Unstimmigkeiten (nur GET, ändert nichts) und zeigt das Ergebnis. Fehler: Meldung, keine Liste.
function datenPruefen() { return pruefLauf("#pruefen-knopf", "#pruefen-ergebnis", "GET", "/pruefen", pruefenListeHtml); }
// Lässt die App den Prüfdatensatz in Wegwerf-Datenbanken rechnen und zeigt, wie viele Werte stimmen. POST, damit nur die eigene Seite ihn auslöst (ändert nichts).
function appPruefen() { return pruefLauf("#app-pruefen-knopf", "#app-pruefen-ergebnis", "POST", "/selbsttest", selbsttestHtml); }
// Gemeinsamer Ablauf beider Prüfungen: Knopf sperren, Ladezeile, Anfrage, Antwort mit alsHtml in die Box; Fehler (auch 429 „läuft schon“) als Meldung ohne Liste.
async function pruefLauf(knopfWahl, boxWahl, methode, pfad, alsHtml) {
  const knopf = $(knopfWahl);
  knopf.disabled = true; $(boxWahl).innerHTML = `<p class="hinweis">${PRUEFEN_LAEDT}</p>`;
  let html;
  try { html = alsHtml(await api(methode, pfad, methode === "GET" ? undefined : {})); } catch (e) { html = meldung(e.message); }
  const box = $(boxWahl); if (box) { box.innerHTML = html; beschriften(box); }          // die Seite kann inzwischen gewechselt sein
  knopf.disabled = false;
}
// Ergebnis von POST /api/selbsttest {anzahl, abweichungen: [{name, erwartet, gerechnet}]}: ein Satz, bei Abweichungen Zählzeile und Liste (Texte maskiert).
function selbsttestHtml(a) {
  if (!a.abweichungen.length) return `<p class="hinweis">${APP_PRUEFEN_OK}</p>`;
  const [zeichen, name] = PRUEFEN_SCHWERE.fehler;
  const zeile = x => `<li class="pf-fehler"><span class="pf-zeichen" aria-hidden="true">${zeichen}</span><span><span class="sr">${name}: </span>${esc(x.name)}: erwartet ${esc(x.erwartet)}, gerechnet ${esc(x.gerechnet)}</span></li>`;
  return `${meldung(`${a.anzahl - a.abweichungen.length} von ${a.anzahl} Werten stimmen.`)}<ul class="pruef-liste">${a.abweichungen.map(zeile).join("")}</ul>`;
}
// Ergebnis von GET /api/pruefen als Liste: je Fund Zeichen und Schwere, Text maskiert, Link nur zu Seiten der App (ZUTUN_ZIEL). Ohne Funde ein Satz.
function pruefenListeHtml(a) {
  if (!a.funde.length) return `<p class="hinweis">Keine Auffälligkeiten in ${a.tage.toLocaleString("de-DE")} ${a.tage === 1 ? "Tag" : "Tagen"}.</p>`;   // mit Tausenderpunkt
  const zeile = f => {
    const [zeichen, name] = PRUEFEN_SCHWERE[f.schwere] || PRUEFEN_SCHWERE.fehler;
    const text = `<span class="sr">${name}: </span>${esc(f.text)}`;
    return `<li class="pf-${f.schwere === "hinweis" ? "hinweis" : "fehler"}"><span class="pf-zeichen" aria-hidden="true">${zeichen}</span>${ZUTUN_ZIEL.test(f.ziel || "") ? `<a href="${esc(f.ziel)}">${text}</a>` : `<span>${text}</span>`}</li>`;
  };
  return `<ul class="pruef-liste">${a.funde.map(zeile).join("")}</ul>${a.mehr ? `<p class="hinweis">und ${a.mehr.toLocaleString("de-DE")} weitere</p>` : ""}`;
}
// Zeigt die Ladezeile (W1) im Meldungsfeld einer Karte.
function wartenZeigen(box) { box.innerHTML = `<p class="hinweis" role="status">${SICHERUNG_WARTEN}</p>`; }
// Ersetzt alle Daten durch eine gewählte Sicherungsdatei (höchstens 5 MB), nach Rückfrage. Den alten Stand sichert die App vorher.
async function wiederherstellen() {
  const box = $("#wh-fehler"), datei = $("#wh-datei").files[0]; box.innerHTML = "";
  if (!datei) { box.innerHTML = meldung("Erst eine Sicherungsdatei wählen."); return; }
  if (datei.size > 5 * 1024 * 1024) { box.innerHTML = meldung("Die Datei ist zu groß (höchstens 5 MB)."); return; }
  if (!(await frage(`Alle Einträge und Einstellungen durch „${datei.name}“ ersetzen?\n\nDer jetzige Stand wird vorher gesichert.`, "Ersetzen", true))) return;
  wartenZeigen(box);
  try {
    const r = await api("POST", "/sicherung/wiederherstellen", {bestaetigt: true, daten: await dateiBase64(datei)});
    seitenCacheLeeren();
    nachDemLaden(`Wiederhergestellt: ${tage(r.tage)}. Der Stand davor ist gesichert. Du kannst ihn unter „Wiederherstellen“ herunterladen.`);
  } catch (e) { box.innerHTML = meldung(e.message); }
}
// Stand der Sicherungen: letzte Sicherung von Hand; in der Android-App und der Web-App ohne Server zusätzlich die Sicherung über das Konto des Geräts
async function sichInfo() {
  const box = $("#sich-info"); if (!box) return;
  const zeit = zeitpunktText;
  let html = "", davor = null;
  try {
    const i = await api("GET", "/sicherung/info");
    davor = i.davor;
    if (["android", "browser"].includes(i.plattform)) handySicherung();
  } catch (e) {}
  html += `<div class="zeile"><span>Zuletzt von Hand gesichert (dieses Gerät)</span><b>${zeit(speicher.l("ho_gesichert", ""))}</b></div>`;
  if ($("#sich-info")) $("#sich-info").innerHTML = html;
  if ($("#wh-davor")) $("#wh-davor").innerHTML = davor ? `<div class="zeile"><span class="bez">Stand vor dem letzten Wiederherstellen<small>${esc(zeit(davor.zeit))}</small></span>
    <a class="btn" href="api/sicherung/davor/${encodeURIComponent(davor.name)}">Herunterladen</a></div>` : "";
}

const HANDY_RHYTHMUS = [["taeglich", "täglich"], ["woechentlich", "wöchentlich"], ["aenderung", "bei jeder Änderung"]];
// Zeichnet die Karten „Verschlüsselte Sicherung“ und „Passwort der Sicherung“ (Handy-Apps und eigenständige Web-App): Ziel, letzte Sicherung, Rhythmus, Wiederherstellen.
async function handySicherung(stand, hinweis) {
  const box = $("#handy-sich"); if (!box) return;
  let s = stand;
  try { s = s || await api("GET", "/handysicherung"); }
  catch (e) { box.innerHTML = `<div class="card"><h2>Verschlüsselte Sicherung</h2>${meldung(e.message)}</div>`; return; }
  if (!$("#handy-sich")) return;
  const ziel = !s.ziel.eingerichtet ? "nicht eingerichtet" : HANDY_ZIEL[s.ziel.art] + (s.ziel.erreichbar ? "" : " (gerade nicht erreichbar)");
  const l = s.letzte, bereit = s.ziel.eingerichtet && s.passwort, imBrowser = s.plattform === "browser";
  const fest = speicher.l("ho_speicher_fest", "") === "1";
  const letzte = !l ? "noch nie" : zeitpunktText(l.zeit);   // „fehlgeschlagen“ steht in der Beschriftung: Wort und Datum zusammen sprengten bei 375 px die Zeile
  const wahl = s.sicherungen.map(x => `<option value="${esc(x.name)}">${esc(zeitpunktText(x.zeit))}${x.eigene ? "" : " (anderes Gerät)"}, ${Math.max(1, Math.round(x.bytes / 1024))} KB</option>`).join("");
  $("#handy-sich").innerHTML = `<div class="gitter paar"><div class="card"><h2>Verschlüsselte Sicherung</h2>
      <p class="hinweis" data-stil="margin-top:0">${imBrowser ? "Die App erstellt eine verschlüsselte Kopie aller Daten. <b>Speichere die Datei danach außerhalb der App</b> (am iPhone „In Dateien sichern“, zum Beispiel in iCloud Drive): Deine Daten liegen sonst nur im Speicher dieses Browsers, und den kann das Gerät leeren." : "Die App legt eine verschlüsselte Kopie aller Daten in deinen Cloud-Speicher."} Lesen kann sie nur, wer das Passwort kennt.</p>
      <div class="zeile"><span>Ziel</span><b>${esc(ziel)}</b></div>
      ${imBrowser ? `<div class="zeile"><span class="bez">Speicher im Gerät<small>${fest ? "Das Gerät hat zugesagt, ihn nicht von selbst zu leeren." : "Das Gerät darf ihn leeren, zum Beispiel bei Platzmangel oder wenn die App lange nicht benutzt wird."}</small></span><b>${fest ? "dauerhaft" : "nicht zugesagt"}</b></div>
      <div class="zeile"><span>Zuletzt als Datei gespeichert</span><b>${esc(zeitpunktText(speicher.l("ho_gesichert", "")))}</b></div>` : ""}
      <div class="zeile"><span class="bez">Letzte Sicherung${s.geprueft && l && l.ok && s.geprueft !== l.zeit ? `<small>zuletzt geprüft ${esc(zeitpunktText(s.geprueft))}, nichts Neues</small>` : l && !l.ok ? "<small>fehlgeschlagen</small>" : ""}</span><b>${esc(letzte)}</b></div>
      ${l && !l.ok ? meldung(l.fehler) : ""}
      <div class="zeile"><span>Sicherungen im Ziel</span><b>${s.sicherungen.length}</b></div>
      ${s.plattform === "android" ? `<div class="knoepfe"><a class="btn" href="zeiterfassung://ordner">${s.ziel.eingerichtet ? "Anderen Ordner wählen" : "Cloud-Ordner wählen"}</a></div><p class="hinweis">Es öffnet sich die Ordnerauswahl deines Geräts. Wähle dort einen Ordner in Google Drive (oder einen anderen Ordner). Die App darf nur in diesen einen Ordner schreiben.</p>` : ""}
      ${imBrowser ? "" : `<div class="zeile"><span>Automatisch sichern</span><input type="checkbox" ${s.auto ? "checked" : ""}${s.passwort ? "" : " disabled"} data-wechsel="handyAuto" aria-label="Automatisch sichern"></div>
      <label for="hs-rhythmus">Wie oft</label><select id="hs-rhythmus" data-wechsel="handyRhythmus">${HANDY_RHYTHMUS.map(([w, n]) => `<option value="${w}"${w === s.rhythmus ? " selected" : ""}>${n}</option>`).join("")}</select>`}
      <label for="hs-behalten">Aufbewahren</label><select id="hs-behalten" data-wechsel="handyBehalten">${[3, 7, 14, 30].concat([3, 7, 14, 30].includes(s.behalten) ? [] : [s.behalten]).sort((a, b) => a - b).map(n => `<option value="${n}"${n === s.behalten ? " selected" : ""}>die letzten ${n} Sicherungen</option>`).join("")}</select>
      <div class="knoepfe"><button class="prim" ${kl("handyJetzt")}${bereit ? "" : " disabled"}>${imBrowser ? "Sicherung erstellen" : "Jetzt sichern"}</button>
        ${imBrowser && s.sicherungen.length ? `<a class="btn${hinweis ? " prim" : ""}" id="hs-dl" href="api/handysicherung/datei/${encodeURIComponent(s.sicherungen[0].name)}">Neueste Sicherung als Datei speichern</a>` : ""}</div>
      <div id="hs-meldung" role="status">${hinweis ? `<p class="hinweis">${esc(hinweis)}</p>` : ""}</div>
      <p class="hinweis">${imBrowser ? "Gesichert wird die Datenbank der App. Erst die gespeicherte Datei schützt dich: Bewahre sie an einem Ort auf, den dein Gerät selbst sichert (iCloud Drive, „Dateien“)." : `Gesichert wird nur die Datenbank der App. Zusätzlich nimmt die Sicherung deines Geräts (Android-Sicherung im Google-Konto) die Daten mit, wenn sie eingeschaltet ist.`}</p></div>
    <div class="card"><h2>Passwort der Sicherung</h2>
      <p class="hinweis" data-stil="margin-top:0"><b>Ohne dieses Passwort ist die Sicherung nicht lesbar.</b> Es wird nirgends gespeichert. Ein vergessenes Passwort kann niemand auslesen. Du kannst aber jederzeit ein neues festlegen; ältere Sicherungen öffnet weiter nur das alte. Bewahre es getrennt vom Handy auf, zum Beispiel in einem Passwort-Tresor.</p>
      <div class="zeile"><span>Passwort</span><b>${s.passwort ? "festgelegt" : "noch keines"}</b></div>
      <label for="hs-pw1">${s.passwort ? "Neues Passwort" : "Passwort"} (mindestens 8 Zeichen)</label><input type="password" id="hs-pw1" autocomplete="current-password">
      <label for="hs-pw2">Passwort wiederholen</label><input type="password" id="hs-pw2" autocomplete="current-password">
      <div class="knoepfe"><button ${kl("handyPasswort")}>${s.passwort ? "Passwort ändern" : "Passwort festlegen"}</button></div>
      ${s.passwort ? `<p class="hinweis">Nach einer Änderung gilt das neue Passwort für neue Sicherungen. Ältere Sicherungen öffnet weiter das alte Passwort.</p>` : ""}
      <div id="hs-pw-meldung"></div>
      <h2 data-stil="margin-top:18px">Aus Sicherung wiederherstellen</h2>
      <p class="hinweis" data-stil="margin-top:0">Ersetzt alle Einträge und Einstellungen. Der jetzige Stand wird vorher automatisch gesichert.</p>
      ${wahl ? `<label for="hs-datei">Sicherung</label><select id="hs-datei">${wahl}</select>
      <label for="hs-pw3">Passwort der Sicherung (nur nötig bei Sicherungen von einem anderen Gerät oder mit einem früheren Passwort)</label><input type="password" id="hs-pw3" autocomplete="current-password">
      <div class="knoepfe"><button class="gef" ${kl("handyWieder")}>Aus Sicherung wiederherstellen …</button></div>` : `<p class="hinweis">Im Ziel liegt noch keine Sicherung.</p>`}
      <div id="hs-wh-meldung"></div>
      ${imBrowser ? `<h2 data-stil="margin-top:18px">Aus einer Sicherungsdatei wiederherstellen</h2>
      <p class="hinweis" data-stil="margin-top:0">Für ein neues Gerät oder nachdem der Browser-Speicher geleert wurde: die gespeicherte Datei (.zsich) wählen und das Passwort eingeben.</p>
      <input type="file" id="hs-datei-hoch" accept=".zsich,application/octet-stream" hidden data-wechsel="handyDateiName">
      <div class="knoepfe dateiwahl"><button type="button" ${kl("handyDateiWaehlen")}>Datei auswählen</button><span id="hs-datei-name">keine Datei gewählt</span></div>
      <label for="hs-pw4">Passwort der Sicherung</label><input type="password" id="hs-pw4" autocomplete="current-password">
      <div class="knoepfe"><button class="gef" ${kl("handyWiederDatei")}>Aus Datei wiederherstellen …</button></div>
      <div id="hs-whd-meldung"></div>` : ""}</div></div>`;
  beschriften($("#handy-sich"));
}
// Schickt eine geänderte Einstellung der verschlüsselten Sicherung an die App und zeichnet die Karte neu.
async function handySetzen(werte) {
  try { handySicherung(await api("PUT", "/handysicherung", werte)); }
  catch (e) { await handySicherung(); if ($("#hs-meldung")) $("#hs-meldung").innerHTML = meldung(e.message); }
}
// Schaltet die automatische verschlüsselte Sicherung an oder aus.
function handyAuto(an) { handySetzen({auto: an}); }
// Stellt ein, wie oft automatisch gesichert wird.
function handyRhythmus(wert) { handySetzen({rhythmus: wert}); }
// Stellt ein, wie viele Sicherungen aufbewahrt werden.
function handyBehalten(wert) { handySetzen({behalten: +wert}); }
// Erstellt die verschlüsselte Sicherung sofort.
async function handyJetzt() {
  const box = $("#hs-meldung"); box.innerHTML = `<p class="hinweis">Sicherung läuft …</p>`;
  try { const s = await api("POST", "/handysicherung/jetzt", {}); handySicherung(s, s.plattform === "browser" ? "Sicherung erstellt. Jetzt als Datei speichern." : "Gesichert."); }
  catch (e) { await handySicherung(); if ($("#hs-meldung")) $("#hs-meldung").innerHTML = ""; }      // der Fehler steht unter „Letzte Sicherung“
}
// Legt das Passwort der Sicherung fest (mindestens 8 Zeichen, beide Eingaben gleich).
async function handyPasswort() {
  const box = $("#hs-pw-meldung"), a = $("#hs-pw1").value, b = $("#hs-pw2").value;
  if (a.length < 8) { box.innerHTML = meldung("Das Passwort braucht mindestens 8 Zeichen."); return; }
  if (a !== b) { box.innerHTML = meldung("Die beiden Eingaben sind verschieden."); return; }
  wartenZeigen(box);
  try { await handySicherung(await api("POST", "/handysicherung/passwort", {passwort: a})); syncKarte(); $("#hs-pw-meldung").innerHTML = `<p class="hinweis">Passwort gespeichert. Bitte jetzt an einem sicheren Ort notieren.</p>`; }
  catch (e) { box.innerHTML = meldung(e.message); }
}
// Stellt aus einer Sicherung im Ziel wieder her, nach Rückfrage. Das Passwort braucht es nur bei fremden Geräten oder altem Passwort.
async function handyWieder() {
  const box = $("#hs-wh-meldung"), wahl = $("#hs-datei"), text = wahl.options[wahl.selectedIndex].textContent;
  if (!(await frage(`Alle Einträge und Einstellungen durch die Sicherung vom ${text} ersetzen?\n\nDer jetzige Stand wird vorher gesichert.`, "Ersetzen", true))) return;
  wartenZeigen(box);
  try {
    const r = await api("POST", "/handysicherung/wiederherstellen", {bestaetigt: true, datei: wahl.value, passwort: $("#hs-pw3").value});
    seitenCacheLeeren();
    nachDemLaden(`Wiederhergestellt: ${tage(r.tage)}. Der Stand davor ist gesichert. Du kannst ihn unter „Wiederherstellen“ herunterladen.`);
  } catch (e) { box.innerHTML = meldung(e.message); }
}

// Öffnet die Dateiwahl für eine Sicherungsdatei (.zsich).
function handyDateiWaehlen() { $("#hs-datei-hoch").click(); }
// Zeigt den Namen der gewählten Sicherungsdatei.
function handyDateiName() { const d = $("#hs-datei-hoch").files[0]; $("#hs-datei-name").textContent = d ? d.name : "keine Datei gewählt"; }
// Stellt aus einer gewählten Sicherungsdatei (.zsich, höchstens 5 MB) mit Passwort wieder her, nach Rückfrage.
async function handyWiederDatei() {
  const box = $("#hs-whd-meldung"), datei = $("#hs-datei-hoch").files[0]; box.innerHTML = "";
  if (!datei) { box.innerHTML = meldung("Erst eine Sicherungsdatei (.zsich) wählen."); return; }
  if (datei.size > 5 * 1024 * 1024) { box.innerHTML = meldung("Die Datei ist zu groß (höchstens 5 MB)."); return; }
  if (!(await frage(`Alle Einträge und Einstellungen durch „${datei.name}“ ersetzen?\n\nDer jetzige Stand wird vorher gesichert.`, "Ersetzen", true))) return;
  wartenZeigen(box);
  try {
    const r = await api("POST", "/handysicherung/wiederherstellen", {bestaetigt: true, daten: await dateiBase64(datei), passwort: $("#hs-pw4").value});
    seitenCacheLeeren();
    nachDemLaden(`Wiederhergestellt: ${tage(r.tage)}. Der Stand davor ist gesichert. Du kannst ihn unter „Wiederherstellen“ herunterladen.`);
  } catch (e) { box.innerHTML = meldung(e.message); }
}

// Öffnet die Dateiwahl für die Sicherungsdatei.
function dateiWaehlen() { $("#wh-datei").click(); }
// Zeigt den Namen der gewählten Sicherungsdatei.
function dateiNameZeigen(wert, feld) { $("#wh-name").textContent = feld.files[0] ? feld.files[0].name : "keine Datei gewählt"; }
// ---- seiten/sync.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Eigene Seiten seit 17.11.2026 (Wunsch): „Sicherung“ (mit Wiederherstellen und verschlüsselter Sicherung) und „Synchronisieren“, getrennt vom Export
const SYNC_KONFLIKT = 409, SYNC_GEKOPPELT = "Gekoppelt. Die Geräte synchronisieren jetzt miteinander.";
// Feste Hinweise der Karte (U24, Sammlung 6.4): Der Dienst nennt den Grund der Pause nicht, der Text passt deshalb auf alle Fälle.
const SYNC_PAUSIERT = "Pausiert: Der Speicherort ist gerade zu. Im Netz, in dem du ihn eingeschaltet hast, öffnet er meist von selbst wieder. Bist du schon dort (zum Beispiel nach einem Update der App oder wenn das Gerät eine neue Adresse bekommen hat), schalte ihn hier einmal neu ein. Dann gilt ab jetzt dieses Netz.";
const SYNC_IM_NETZ = "Nach dem Koppeln bleibt dieses Gerät Speicherort, aber nur in diesem Netz und ohne Anmeldung. In einem anderen Netz schließt er, zu Hause öffnet er wieder.";
// Hinweis auf Änderungen eines anderen Geräts, die der letzte Lauf nicht übernommen hat (U1); verspricht mit Absicht keine Abhilfe.
function uebersprungenText(n) {
  return `Beim Synchronisieren hat dieses Gerät ${n} ${n === 1 ? "Änderung" : "Änderungen"} eines anderen Geräts nicht übernommen. ${n === 1 ? "Sie passt" : "Sie passen"} nicht zum Stand dieses Geräts. Vergleiche im Zweifel deine Tage auf beiden Geräten.`;
}
// Seite „Synchronisierung“: die Karte zeichnet syncKarte (darstellung.js) in #sync-karte.
function seiteSync() {
  window.nachher = () => { syncKarte(); };
  return `<div id="sync-karte"></div>`;
}
// Schickt eine Sync-Aktion an die App und zeichnet bei Erfolg die Karte neu (liefert true). Bei einem Fehler wird die Karte nicht neu gezeichnet,
// damit getippte Eingaben (Token, Adresse, Code) stehen bleiben; die Meldung erscheint im Feld (liefert false).
async function syncSenden(methode, pfad, werte, hinweis, feld) {
  try { await syncKarte(await api(methode, pfad, werte), hinweis); seitenCacheLeeren(); return true; }
  catch (e) {                                                         // Karte nicht neu zeichnen: getippte Eingaben (Token, Adresse, Code) blieben sonst nicht stehen
    const box = $(feld || "#sync-meldung");
    if (!box) { await syncKarte(); return false; }
    box.innerHTML = meldung(e.message); box.scrollIntoView({block: "nearest"}); return false;
  }
}
// Öffnet die Dateiwahl für die Sync-Datei eines anderen Geräts.
function syncDateiWaehlen() { $("#sync-datei").click(); }
// Eigenständige Web-App: Liest die Sync-Datei eines anderen Geräts ein und synchronisiert damit.
async function syncEinlesen() {
  const datei = $("#sync-datei").files[0]; if (!datei) return;
  const pw = $("#sync-pw") ? $("#sync-pw").value : "";
  $("#sync-meldung").innerHTML = `<p class="hinweis">Datei wird eingelesen …</p>`;
  syncSenden("POST", "/abgleich/einlesen", {name: datei.name, daten: await dateiBase64(datei), passwort: pw}, "Eingelesen und synchronisiert. Jetzt „Meine Sync-Datei speichern“, damit die anderen Geräte deinen Stand bekommen.");
}
// Schaltet den automatischen Sync um. Die Web-App merkt es je Gerät im Browser, die anderen Fassungen in der App.
function syncAuto(an) {
  if (PLATTFORM === "browser") { speicher.s("ho_abgleich_auto", an ? "1" : "0"); toast(an ? "Automatische Synchronisierung an" : "Automatische Synchronisierung aus. Synchronisieren nur noch mit „Jetzt synchronisieren“."); return; }
  syncSenden("PUT", "/abgleich", {auto: an});
}
// Desktop: Gibt die Oberfläche für das Handy im eigenen Netz frei oder beendet die Freigabe (der alte Code gilt dann nicht mehr).
function syncOberflaeche(an) { syncSenden("PUT", "/abgleich", {oberflaeche: an}, an ? "Freigegeben. Jetzt den Code mit dem Handy scannen." : "Freigabe beendet. Der alte Code gilt nicht mehr."); }
// Macht dieses Gerät zum Speicherort (Ablage der verschlüsselten Dateien für andere Geräte) oder beendet das.
function syncFreigabe(an) { return syncSenden("PUT", "/abgleich", {freigabe: an}, an ? "Dieses Gerät ist jetzt der Speicherort." : "Freigabe beendet."); }
// Speichert die Adresse des eigenen Servers als Speicherort; mit Benutzername und Passwort meldet sich das Gerät dort an (das Passwort behält die App nicht).
function syncServer() {
  const benutzer = $("#sync-s-benutzer")?.value.trim() || "", passwort = $("#sync-s-passwort")?.value || "";
  return syncSenden("PUT", "/abgleich", {server: $("#sync-server").value.trim(), ...(benutzer || passwort ? {benutzer, passwort} : {})}, benutzer ? "Angemeldet und Adresse gespeichert." : "Adresse gespeichert.");
}
// Meldet dieses Gerät beim eigenen Server ab (der Schlüssel wird hier gelöscht) und zeichnet die Karte neu.
async function syncServerAbmelden() {
  try { await api("POST", "/abgleich/server-abmelden", {}); await syncKarte(null, "Abgemeldet. Zum Synchronisieren mit dem Server neu anmelden."); }
  catch (e) { $("#sync-meldung").innerHTML = meldung(e.message); }
}
// Verbindet mit einem GitHub-Repo; Repo und Token gehen nur an die App dieses Geräts.
function syncGithub() {
  $("#sync-meldung").innerHTML = `<p class="hinweis">GitHub wird gefragt …</p>`;
  return syncSenden("PUT", "/abgleich", {github: {repo: $("#sync-gh-repo").value.trim(), token: $("#sync-gh-token").value.trim()}}, "Mit GitHub verbunden. Jetzt „Jetzt synchronisieren“ wählen.");
}
// Trennt die Verbindung zu GitHub; die Dateien im Repo bleiben liegen.
function syncGithubTrennen() { syncSenden("PUT", "/abgleich", {github: null}, "Verbindung getrennt. Die Dateien im Repo bleiben liegen."); }
// Speichert den Cloud-Ordner für den Sync (Desktop).
function syncOrdner() { return syncSenden("PUT", "/abgleich", {ordner: $("#sync-ordner").value.trim()}, "Ordner gespeichert."); }
// „Jetzt synchronisieren“: In der Web-App zuerst mit der Ablage des Servers, sonst über die App.
async function syncJetzt() {
  const pw = $("#sync-pw") ? $("#sync-pw").value : "";
  $("#sync-meldung").innerHTML = `<p class="hinweis">Synchronisierung läuft …</p>`;
  if (PLATTFORM === "browser" && EIGEN) { const s = await netzSync(pw); if (s) { await syncKarte(s, s.letzter?.ok ? "Mit dem Server synchronisiert." : ""); return; } }
  syncSenden("POST", "/abgleich/jetzt", {passwort: pw}, "Synchronisiert.");
}
// QR-Code des anderen Geräts mit der Kamera lesen (Android-App). Das Bild bleibt im Gerät; gelesen wird nur der Code.
let scanStrom = null;
// Beendet das Lesen des QR-Codes: Kamera aus, Videofeld verborgen.
function scanStop() { if (scanStrom) { scanStrom.getTracks().forEach(t => t.stop()); scanStrom = null; } const v = $("#sync-video"); if (v) v.hidden = true; }
// Liest den QR-Code des anderen Geräts mit der Kamera (höchstens 60 Sekunden); bei einem Code mit 16 Zeichen wird sofort gekoppelt. Das Kamerabild bleibt im Gerät.
async function syncScannen() {
  const box = $("#sync-meldung");
  if (scanStrom) { scanStop(); return; }
  if (!window.ZeiterfassungHuelle || !navigator.mediaDevices) { box.innerHTML = meldung("Dieses Gerät kann hier keinen QR-Code lesen. Bitte den Code eintippen."); return; }
  try { scanStrom = await navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}}); }
  catch (e) { box.innerHTML = meldung("Ohne Zugriff auf die Kamera geht das Scannen nicht. Bitte den Code eintippen."); return; }
  // Gelesen wird in der Hülle der App (ZXing). Der QR-Leser des WebView bräuchte Google-Play-Dienste und beendet die App ohne sie.
  const v = $("#sync-video"), bild = document.createElement("canvas"), stift = bild.getContext("2d", {willReadFrequently: true}), ende = Date.now() + 60000;
  v.srcObject = scanStrom; v.hidden = false;
  try { await v.play(); } catch (e) {}
  while (scanStrom && Date.now() < ende && $("#sync-video") === v) {           // endet auch, wenn die Seite gewechselt wird
    let code = "";
    const b = Math.min(640, v.videoWidth || 0), h = b ? Math.round(v.videoHeight * b / v.videoWidth) : 0;
    if (b && h) {
      bild.width = b; bild.height = h; stift.drawImage(v, 0, 0, b, h);
      const px = stift.getImageData(0, 0, b, h).data, grau = new Uint8Array(b * h);
      for (let i = 0; i < grau.length; i++) grau[i] = (px[4 * i] * 77 + px[4 * i + 1] * 150 + px[4 * i + 2] * 29) >> 8;
      let text = "";
      for (let i = 0; i < grau.length; i += 8192) text += String.fromCharCode.apply(null, grau.subarray(i, i + 8192));
      try { code = window.ZeiterfassungHuelle.qrLesen(b, h, btoa(text)) || ""; } catch (e) {}
    }
    if (code.replace(/[^A-Za-z0-9]/g, "").length === 16) { scanStop(); $("#sync-code").value = code; syncKoppelnAnnehmen(); return; }
    await new Promise(r => setTimeout(r, 250));
  }
  scanStop();
}
// Zeigt einen Kopplungs-Code an, den das andere Gerät eingibt.
function syncKoppeln() { syncSenden("POST", "/abgleich/koppeln", {}, "Code angezeigt. Jetzt am anderen Gerät eingeben."); }
// Koppelt mit dem Code vom anderen Gerät (16 Zeichen). Synchronisiert das Gerät schon mit dem eigenen Server, antwortet der Dienst mit 409 und
// seinem Text als Frage; erst nach „Trotzdem koppeln“ geht dieselbe Anfrage mit bestaetigt: true noch einmal (der Code bleibt im Feld stehen).
async function syncKoppelnAnnehmen() {
  const code = $("#sync-code").value.trim();
  if (code.replace(/[^A-Za-z0-9]/g, "").length !== 16) { $("#sync-meldung").innerHTML = meldung("Der Code hat 16 Zeichen."); return; }
  try { await api("POST", "/abgleich/koppeln/annehmen", {code}); }
  catch (e) {
    if (e.status !== SYNC_KONFLIKT || !(await frage(e.message, "Trotzdem koppeln", true))) { $("#sync-meldung").innerHTML = meldung(e.message); return; }
    return syncSchrittNach(SYNC_ERSTER_LAUF, () => syncSenden("POST", "/abgleich/koppeln/annehmen", {code, bestaetigt: true}, SYNC_GEKOPPELT));
  }
  if (SYNC_SCHRITT) SYNC_SCHRITT = SYNC_ERSTER_LAUF;                    // geführt: Gekoppelt bringt Speicherort und Passwort mit
  await syncKarte(null, SYNC_GEKOPPELT); seitenCacheLeeren();
}
// Legt das Passwort für Sync und Sicherung fest (mindestens 8 Zeichen, beide Eingaben gleich).
function syncPasswort() {
  const a = $("#sync-pw1").value, b = $("#sync-pw2").value;
  if (a.length < 8) { $("#sync-meldung").innerHTML = meldung("Das Passwort braucht mindestens 8 Zeichen."); return; }
  if (a !== b) { $("#sync-meldung").innerHTML = meldung("Die beiden Eingaben sind verschieden."); return; }
  return syncSenden("POST", "/abgleich/passwort", {passwort: a}, "Passwort gespeichert. Bitte jetzt an einem sicheren Ort notieren.");
}
// Entscheidet einen Konflikt: „hier“ behält den Eintrag dieses Geräts, „dort“ übernimmt den des anderen.
function syncWahl(art, schluessel, wahl) { syncSenden("POST", "/abgleich/entscheiden", {art, schluessel, wahl}, "", "#sync-k-meldung"); }
// Entscheidet alle Konflikte auf einmal, nach Rückfrage.
async function syncAlle(wahl) {
  if (!(await frage(wahl === "hier" ? "Bei allen Konflikten den Eintrag dieses Geräts behalten?" : "Bei allen Konflikten den Eintrag des anderen Geräts übernehmen?", "Übernehmen"))) return;
  syncSenden("POST", "/abgleich/entscheiden", {alle: wahl}, "", "#sync-k-meldung");
}


// ---- Geführte Einrichtung (M6): wer auf Rechner oder Android noch nichts eingerichtet hat, geht vier Schritte (Speicherort, Angaben, Sync-Passwort,
// erster Lauf), je Schritt eine Karte. Die Schritte nutzen dieselben Felder und Wege wie die Karten für Eingerichtete; Fehler lassen die Eingaben stehen.
let SYNC_SCHRITT = null, SYNC_WEG = "", SYNC_GEZEIGT = null;           // null: nicht geführt (Leerzustand oder heutige Karten)
let SYNC_ALLE = false;                                                    // „Alle Einstellungen zeigen“ gilt bis zum Neuladen
const SYNC_SCHRITTE = 4, SYNC_PASSWORT_SCHRITT = 3, SYNC_ERSTER_LAUF = 4;
const SYNC_FUEHRT = ["desktop", "android"];                            // Server, Web-App und freigegebene Oberfläche haben keine Wahl des Speicherorts
// Wege der Wahl in Schritt 1: [Schlüssel, Name, Satz, Modul oder ""]
const SYNC_WEGE = [["ordner", "Cloud-Ordner", "Ein Ordner, den alle Geräte sehen, zum Beispiel in Google Drive oder iCloud Drive.", ""],
  ["server", "Eigener Server", "Die Zeiterfassung auf deinem Server im Heimnetz, auch über VPN.", ""],
  ["koppeln", "Per Code mit einem anderen Gerät", "Im selben WLAN oder VPN: Das andere Gerät zeigt einen Code, du gibst ihn hier ein.", "koppeln"],
  ["freigabe", "Dieses Gerät als Speicherort", "Die anderen Geräte im selben WLAN oder VPN synchronisieren direkt mit diesem.", ""],
  ["github", "GitHub", "Ein eigenes Repo bei GitHub, von überall erreichbar.", "github"]];
// Führt die Karte diese Person? Nur lokale Fassungen, nur ohne eingerichteten Speicherort und ohne bisherigen Lauf (oder mitten in der Führung).
function syncFuehren(s) {
  if (!SYNC_FUEHRT.includes(s.plattform) || s.fern || PERSON) return false;
  return SYNC_SCHRITT !== null || (!syncEingerichtet(s) && !s.letzter);
}
// Felder des gewählten Wegs (Schritt 2); dieselben Kennungen wie in den heutigen Karten, damit syncOrdner, syncServer, syncGithub sie lesen.
function syncAngabenHtml(s) {
  if (SYNC_WEG === "ordner") return s.plattform === "android"
    ? `<p class="hinweis">Es öffnet sich die Ordnerauswahl deines Geräts. Wähle dort einen Ordner in Google Drive (oder einen anderen Ordner).</p><div class="knoepfe"><a class="btn" href="zeiterfassung://ordner">Cloud-Ordner wählen</a></div>`
    : `<label for="sync-ordner">Ordner für die Synchronisierung (ganzer Pfad)</label><input type="text" id="sync-ordner" autocomplete="off" spellcheck="false" value="${esc(s.ordner || "")}">`;
  if (SYNC_WEG === "server") return `<label for="sync-server">Adresse des eigenen Servers, so wie im Browser (auch mit IP und Port)</label><input type="url" id="sync-server" autocomplete="off" spellcheck="false" value="${esc(s.server || "")}">
    <label for="sync-s-benutzer">Benutzername (nur bei einem Server mit Anmeldung)</label><input type="text" id="sync-s-benutzer" autocomplete="username" autocapitalize="none" spellcheck="false">
    <label for="sync-s-passwort">Passwort beim Server (wird nicht gespeichert)</label><input type="password" id="sync-s-passwort" autocomplete="current-password">`;
  if (SYNC_WEG === "github") return `<p class="hinweis">Lege bei GitHub ein leeres, am besten privates Repo an und dazu ein Token nur für dieses Repo mit „Contents: Read and write“.</p>
    <label for="sync-gh-repo">Repo (konto/name)</label><input type="text" id="sync-gh-repo" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="konto/name">
    <label for="sync-gh-token">Token</label><input type="password" id="sync-gh-token" autocomplete="off">`;
  if (SYNC_WEG === "koppeln") return `<p class="hinweis">Am anderen Gerät unter Synchronisierung „Code anzeigen“ wählen. ${SYNC_IM_NETZ}</p>
    <label for="sync-code">Code vom anderen Gerät</label><input type="text" id="sync-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="24">`;
  return `<p class="hinweis">Die anderen Geräte tragen danach die Adresse dieses Geräts als eigenen Server ein. Erreichbar ist nur die Ablage der verschlüsselten Sync-Dateien, nicht die App. ${SYNC_IM_NETZ}</p>`;
}
// Inhalt eines Schritts: [Überschrift, Felder, Knopf „Weiter“ oder die Aktion des Schritts].
function syncSchrittInhalt(s) {
  const wege = SYNC_WEGE.filter(([, , , modul]) => !modul || modulAn(modul));
  if (SYNC_SCHRITT === 1) return ["Wo sollen die Daten liegen?", `<div class="profil-wahl">${wege.map(([k, name, satz]) => `<button type="button" ${kl("syncWegWaehlen", k)}><b>${name}</b><small>${satz}</small></button>`).join("")}</div>`, ""];
  if (SYNC_SCHRITT === 2) return [SYNC_WEGE.find(([k]) => k === SYNC_WEG)[1], syncAngabenHtml(s),
    SYNC_WEG === "koppeln" ? `<button class="prim" ${kl("syncKoppelnAnnehmen")}>Koppeln</button>` : `<button class="prim" ${kl("syncWeiter")}>Weiter</button>`];
  if (SYNC_SCHRITT === SYNC_PASSWORT_SCHRITT) return ["Sync-Passwort festlegen", `<label for="sync-pw1">Sync-Passwort (mindestens 8 Zeichen, auf allen Geräten dasselbe)</label><input type="password" id="sync-pw1" autocomplete="current-password">
    <label for="sync-pw2">Sync-Passwort wiederholen</label><input type="password" id="sync-pw2" autocomplete="current-password">
    <p class="hinweis"><b>Ohne dieses Passwort sind die Sync-Dateien nicht lesbar.</b> Es wird nirgends gespeichert. Bewahre es getrennt vom Gerät auf.</p>`, `<button class="prim" ${kl("syncWeiter")}>Weiter</button>`];
  const l = s.letzter;
  return ["Erste Synchronisierung", `<p class="hinweis">Einträge, die nur auf einem Gerät stehen, kommen ohne Rückfrage auf alle anderen. Gefragt wirst du nur, wenn derselbe Tag auf zwei Geräten verschieden ist.</p>
    ${!l ? "" : l.ok ? `<p class="hinweis"><b>Synchronisiert.</b> ${l.uebernommen === 1 ? "Eine Änderung" : `${Number(l.uebernommen) || 0} Änderungen`} übernommen.</p>` : meldung(l.fehler)}`,
    `<button class="${l?.ok ? "" : "prim"}" ${kl("syncJetzt")}>Jetzt synchronisieren</button><button class="${l?.ok ? "prim" : ""}" ${kl("syncFertig")}>Fertig</button>`];
}
// Karte der Führung: ohne Schritt der Leerzustand mit „Einrichten“, sonst der Schritt mit Zähler, Zurück und seiner Aktion.
function syncEinrichtenKarte(s) {
  if (SYNC_SCHRITT === null) return `<div class="card leer"><h2>Synchronisierung</h2><p>Noch kein Gerät verbunden.</p>
    <p class="hinweis" data-stil="margin-top:0">Hält deine Geräte auf demselben Stand, verschlüsselt und ohne fremden Dienst.</p>
    <div class="knoepfe"><button class="prim" ${kl("syncEinrichten")}>Einrichten</button><button ${kl("syncAlleWege")}>Alle Einstellungen zeigen</button></div></div>`;
  if (SYNC_SCHRITT === SYNC_PASSWORT_SCHRITT && s.passwort) SYNC_SCHRITT = SYNC_ERSTER_LAUF;   // Passwort schon da (zum Beispiel vom Koppeln)
  const [titel, felder, aktion] = syncSchrittInhalt(s);
  return `<div class="card sync-schritt"><p class="hinweis">Synchronisierung einrichten · Schritt ${SYNC_SCHRITT} von ${SYNC_SCHRITTE}</p>
    <h2 id="sync-schritt-titel" tabindex="-1">${esc(titel)}</h2>${felder}
    <div class="knoepfe">${SYNC_SCHRITT > 1 ? `<button ${kl("syncZurueck")}>Zurück</button>` : `<button ${kl("syncAbbrechen")}>Abbrechen</button>`}${aktion}</div>
    <div id="sync-meldung" role="status"></div></div>`;
}
// Zeichnet die Führung in #sync-karte; beim Schrittwechsel geht der Fokus auf die Überschrift (der Screenreader sagt den Schritt an).
function syncFuehrungZeigen(box, s) {
  box.innerHTML = syncEinrichtenKarte(s); beschriften(box);
  if (SYNC_SCHRITT !== SYNC_GEZEIGT && SYNC_SCHRITT !== null) $("#sync-schritt-titel").focus();
  SYNC_GEZEIGT = SYNC_SCHRITT;
}
// Geht zu Schritt n, wenn die Aktion gelingt (sie zeichnet die Karte dann selbst neu); sonst bleibt der Schritt samt Eingaben stehen.
async function syncSchrittNach(n, aktion) {
  const vorher = SYNC_SCHRITT; if (SYNC_SCHRITT) SYNC_SCHRITT = n;
  const ok = await aktion();
  if (!ok) SYNC_SCHRITT = vorher;
  return ok;
}
// Android: Den Ordner wählt die Ordnerauswahl des Geräts; „Weiter“ prüft nur, ob er eingerichtet ist.
async function syncOrdnerGewaehlt() {
  const s = await api("GET", "/abgleich").catch(() => null);
  if (!s?.ziel?.eingerichtet) { $("#sync-meldung").innerHTML = meldung("Erst einen Cloud-Ordner wählen."); return false; }
  await syncKarte(s); return true;
}
// Speichert den gewählten Weg (Schritt 2) über dieselben Wege wie die heutigen Karten; Rückgabe true bei Erfolg.
function syncWegSpeichern() {
  if (SYNC_WEG === "ordner") return $("#sync-ordner") ? syncOrdner() : syncOrdnerGewaehlt();
  return {server: syncServer, github: syncGithub, freigabe: syncFreigabeWeg}[SYNC_WEG]();
}
// Dieses Gerät als Speicherort: Der Dienst öffnet ihn nur mit Sync-Passwort. Ohne Passwort erst Schritt 3, eingeschaltet wird danach (syncPasswortSchritt).
async function syncFreigabeWeg() {
  const s = await api("GET", "/abgleich").catch(() => null);
  if (s && !s.passwort) { await syncKarte(s); return true; }
  return syncFreigabe(true);
}
// Schritt 3: Passwort speichern; beim Weg „Dieses Gerät als Speicherort“ danach die Freigabe einschalten.
async function syncPasswortSchritt() {
  return (await syncPasswort()) === true && (SYNC_WEG !== "freigabe" || syncFreigabe(true));
}
// „Weiter“ in Schritt 2 (Weg speichern) und 3 (Sync-Passwort festlegen).
function syncWeiter() {
  return SYNC_SCHRITT === 2 ? syncSchrittNach(SYNC_PASSWORT_SCHRITT, syncWegSpeichern) : syncSchrittNach(SYNC_ERSTER_LAUF, syncPasswortSchritt);
}
// Startet die Führung mit der Wahl des Speicherorts.
function syncEinrichten() { SYNC_SCHRITT = 1; syncKarte(); }
// Wählt den Weg (Schritt 1) und zeigt seine Angaben.
function syncWegWaehlen(weg) { SYNC_WEG = weg; SYNC_SCHRITT = 2; syncKarte(); }
// Einen Schritt zurück; aus Schritt 4 zurück zu den Angaben (Schritt 3 erscheint nur ohne Passwort).
function syncZurueck() { SYNC_SCHRITT = SYNC_SCHRITT === SYNC_ERSTER_LAUF ? 2 : SYNC_SCHRITT - 1; syncKarte(); }
// Beendet die Führung ohne Änderung (zurück zum Leerzustand).
function syncAbbrechen() { SYNC_SCHRITT = null; syncKarte(); }
// Nach dem ersten Lauf: die heutigen Karten.
function syncFertig() { SYNC_SCHRITT = null; syncKarte(); }
// Zeigt statt der Führung alle heutigen Karten (alle Wege und Schalter auf einmal).
function syncAlleWege() { SYNC_SCHRITT = null; SYNC_ALLE = true; syncKarte(); }
// ---- seiten/einstellungen.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Einstellungen: Liste der fünf Unterseiten mit Demo-Karte; die Unterseiten stehen je in seiten/einstellungen_<unter>.js (Festlegung B7).
// Je Unterseite: Funktion, Symbol (Schlüssel aus SYM) und Kurztext der Zeile in der Liste. Namen und Reihenfolge stehen in UNTERSEITEN (bausteine/bereiche.js).
const EINST_TEILE = {arbeitszeit: [() => einstArbeitszeit(), "woche", "Regeln, Abschnitte, Feiertage"], person: [() => einstPerson(), "start", "Startwerte, Konten, Monatsnachweis"],
  aussehen: [() => einstAussehen(), "darstellung", "Design, Farbe, Zeitformat"], module: [() => einstModule(), "einstellungen", "Module, Profile, Werkseinstellungen"],
  geraete: [() => einstGeraete(), "sync", "Anmeldung, Geräte, neue Version"]};
// Die Demo-Karte erscheint, wenn der Server sie anbietet (leere App ohne Synchronisierung) oder die Demo läuft (zum Beenden).
const demoAngeboten = d => !!d && (d.aktiv || d.angebot);
// Seite „Einstellungen“: ohne Unterseite die Liste, sonst die Unterseite; eine unbekannte Unterseite leitet ohne Verlaufseintrag auf die Liste.
async function seiteEinstellungen() {
  const unter = hashTeile()[1];
  if (!unter) return einstListe();
  if (!Object.hasOwn(EINST_TEILE, unter)) { history.replaceState(null, "", "#/einstellungen"); return einstListe(); }
  return `<h2 class="sr">${esc(unterseiteName("einstellungen", unter))}</h2>` + await EINST_TEILE[unter][0]();   // die Überschrift oben bleibt „Einstellungen“
}
// Liste der Unterseiten: je Zeile ein Link (Symbol, Name, Kurztext, „›“), darunter die Demo-Karte. Lädt nichts.
function einstListe() {
  const zeile = ([k, name]) => `<a href="#/einstellungen/${k}">${sym(EINST_TEILE[k][1])}<b>${name}<small>${EINST_TEILE[k][2]}</small></b><span aria-hidden="true">›</span></a>`;
  return `<nav class="card liste einst-liste" aria-label="Einstellungen">${UNTERSEITEN.einstellungen.map(zeile).join("")}</nav>${demoAngeboten(DEMO) ? demoKarte() : ""}`;
}
// Karte „Demo-Modus“: starten, solange die App leer ist; läuft die Demo, beenden oder neu würfeln.
function demoKarte() {
  return `<div class="card"><h2>Demo-Modus</h2>
    <p class="hinweis" data-stil="margin-top:0">${DEMO.aktiv ? "Die Demo ist an: Du siehst Beispieldaten in einer eigenen Datenbank. Eingaben landen nur dort." : "Zum Ausprobieren mit zufälligen Beispieltagen, passend zu deinen Regeln (Profil). Jede Demo sieht etwas anders aus. Deine echten Daten bleiben getrennt und unberührt. Die Regeln lassen sich in der Demo nicht ändern."}</p>
    <div class="knoepfe">${DEMO.aktiv ? `<button class="prim" ${kl("demoEnde")}>Demo beenden</button><button ${kl("demoStart")}>Beispieldaten neu laden</button>` : `<button class="prim" ${kl("demoStart")}>Demo starten</button>`}</div></div>`;
}
// Bindet Knöpfe und Felder einer Unterseite, die nicht in der zentralen Tabelle (anlauf.js AKTIONEN/WECHSEL) stehen: {id: [Ereignis, Funktion]}.
// Läuft nach dem Zeichnen (window.nachher); ein schon gesetztes nachher läuft zuerst.
function einstBinden(tabelle) {
  const vorher = window.nachher;
  window.nachher = () => {
    if (vorher) vorher();
    Object.entries(tabelle).forEach(([id, [ereignis, f]]) => { const e = document.getElementById(id); if (e) e["on" + ereignis] = ev => f(ev.currentTarget, ev); });
  };
}
// ---- seiten/einstellungen_arbeitszeit.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Einstellungen, Unterseite „Arbeitszeit und Regeln“: Regeln, Zeitleiste der Abschnitte, eigene Feiertage, Kind krank, Gleitzeit-Grenzen.
const ABSCHNITT_ART = {normal: "Normal (Vollzeit)", teilzeit: "Teilzeit", elternzeit: "Elternzeit (0 h)", elternteilzeit: "Elternteilzeit", altersteilzeit: "Altersteilzeit (Arbeitsphase)", altersteilzeit_frei: "Altersteilzeit (Freistellung, 0 h)", pflegezeit: "Pflegezeit / Familienpflegezeit", sonderurlaub: "Sonderurlaub ohne Bezüge (0 h)", mutterschutz: "Mutterschutz (0 h)"};
const ABSCHNITT_OHNE_STUNDEN = ["elternzeit", "altersteilzeit_frei", "sonderurlaub", "mutterschutz"];
const FEIERTAGE_STAND = "gesetzliche Feiertage der 16 Länder, geprüft am 16.11.2026 (zuletzt neu: Frauentag in Mecklenburg-Vorpommern seit 2023)";   // bei Änderungen in app/feiertage.py mitziehen
const WERKTAGE = ["Mo", "Di", "Mi", "Do", "Fr"];
// Kurztext der HO-Regel (Grenze in Prozent oder Modus).
const hoText = w => !w.ho_modus || w.ho_modus === "grenze" ? `${w.ho_grenze} % HO` : HO_MODI[w.ho_modus];
// 0 % = kein Homeoffice, 100 % = ohne Grenze. Gespeichert wird immer eine Grenze von 1 bis 100: Ältere Fassungen kennen nur diese und verwürfen sonst beim Sync alle Regeln.
function hoRegel(modus, grenze) {
  if (modus === "grenze" && grenze <= 0) modus = "kein";
  else if (modus === "grenze" && grenze >= 100) modus = "ohne";
  return {ho_modus: modus, ho_grenze: Math.min(100, Math.max(1, Math.round(grenze) || KONFIG.ho_grenze))};
}
// Zeigt das Feld für die HO-Grenze nur im Modus „mit Grenze“.
function hoModusWahl(v) { $("#r-ho-feld").style.display = v === "grenze" ? "" : "none"; }
// Regeln eines Zeitraums als ein Satz (Bundesland, Stunden, Urlaub, Feiertage, …).
function regelnWerte(w) {
  return `${BUNDESLAENDER[w.bundesland]} · ${komma(w.wochenstunden)} Std. ${w.arbeitstage.replace(/,/g, "/")} · ${hoText(w)} · ${w.urlaub_tage ?? 30} Urlaubstage · ${anzahl(w.gleittage_max, "Gleittag", "Gleittage")} · Familientage höchstens ${w.familientage_max} (nur wenn eingeschaltet)`
    + ` · 24.12. ${w.heiligabend_frei ? "frei" : "Arbeitstag"} · 31.12. ${w.silvester_frei ? "frei" : "Arbeitstag"} ${w.himmelfahrt_frei ? " · 15.8. Feiertag" : ""} · Fasching ${w.fasching_std === null ? "normal" : komma(w.fasching_std) + " Std."} · ${pausenText(w.pausen || [])}`;
}
// Stufen der Pausenregel: die vorhandenen und eine leere zum Ergänzen (höchstens 4)
const pausenZeilen = stufen => [...stufen, null].slice(0, 4).map((st, i) => `<input id="r-pa${i}" inputmode="numeric" placeholder="${i ? "z. B. 09:00" : "06:00"}" value="${st ? hhmm(st[0]) : ""}" aria-label="Stufe ${i + 1}: Kommen bis Gehen länger als (hh:mm)"><input id="r-pp${i}" inputmode="numeric" placeholder="${i ? "z. B. 00:45" : "00:30"}" value="${st ? hhmm(st[1]) : ""}" aria-label="Stufe ${i + 1}: Pause insgesamt (hh:mm)">`).join("");
// Karte „Regeln“ mit allen Feldern (Sonderregeln offen, nicht aufklappbar), Speichern ab einem Datum und der Liste der Gültigkeiten; u: Urlaub des Jahres (Kind krank).
function regelnKarte(kf, u) {
  const k = KONFIG, v = kf.versionen;
  window.konfigStandard = kf.standard;
  const heuteIso = new Date().toISOString().slice(0, 10);
  const liste = v.map(x => `<div class="zeile"><span>${x.ab === "0001-01-01" ? "Von Anfang an" : "Ab " + de(x.ab)}<br><small>${regelnWerte(x.werte)}</small></span>${x.ab === "0001-01-01" ? "" : `<button class="gef" ${kl("regelnVersionWeg", String(x.ab))} aria-label="Version löschen">✕</button>`}</div>`).join("");
  return `<div class="card"><h2>Regeln</h2>
    <label>Bundesland (Feiertage)</label><select id="r-bl">${Object.entries(BUNDESLAENDER).map(([c, n]) => `<option value="${c}"${c === k.bundesland ? " selected" : ""}>${n}</option>`).join("")}</select><p class="hinweis">Die Feiertage werden berechnet (die beweglichen aus dem Osterdatum) und nicht aus einer Liste gelesen. Sie sind deshalb für jedes Jahr vorhanden, ohne Enddatum. Stand der Regeln: ${FEIERTAGE_STAND}. Führt ein Land einen Feiertag neu ein oder schafft einen ab, braucht es eine neue Version der App.</p>
    <div class="zeile"><span>24.12. (Heiligabend) ist frei</span><input type="checkbox" id="r-ha" aria-label="24.12. (Heiligabend) ist frei"${k.heiligabend_frei ? " checked" : ""}></div>
    <div class="zeile"><span>31.12. (Silvester) ist frei</span><input type="checkbox" id="r-sy" aria-label="31.12. (Silvester) ist frei"${k.silvester_frei ? " checked" : ""}></div>
    <div class="zeile"><span>15.8. (Mariä Himmelfahrt) ist Feiertag<br><small>nur Bayern: in Gemeinden mit überwiegend katholischer Bevölkerung</small></span><input type="checkbox" id="r-mh" aria-label="15.8. (Mariä Himmelfahrt) ist Feiertag"${k.himmelfahrt_frei ? " checked" : ""}></div>
    <div class="reihe"><div><label>Standard-Wochenstunden</label>${stepper("r-ws", String(k.wochenstunden), 0.5, 1)}</div>
      <div><label>Homeoffice</label><select id="r-hm" data-wechsel="hoModusWahl">${Object.entries(HO_MODI).map(([c, n]) => `<option value="${c}"${c === hoModus() ? " selected" : ""}>${n}</option>`).join("")}</select></div></div>
    <div id="r-ho-feld"${mitGrenze() ? "" : ' data-stil="display:none"'}><label>HO-Grenze (% der Gesamtzeit)</label>${stepper("r-ho", k.ho_grenze, 1, 0)}<p class="hinweis">0 % heißt kein Homeoffice, 100 % heißt ohne Grenze. Dann gibt es keinen Ring und keine Warnungen.</p></div>
    <label>Standard-Arbeitstage</label><div class="tage-wahl" id="r-tage">${WERKTAGE.map(t => `<label><input type="checkbox" value="${t}" ${k.arbeitstage.split(",").includes(t) ? "checked" : ""}>${t}</label>`).join("")}</div>
    <label>Urlaubstage pro Jahr <small>(für Jahre ohne eigenen Wert unter „${weg("urlaub")} → Erweitert“)</small></label>${stepper("r-ut", k.urlaub_tage ?? 30, 1, 0)}
    <div class="reihe"><div${md("gleittage")}><label>Gleittage pro Jahr (höchstens)</label>${stepper("r-gt", k.gleittage_max, 1, 0)}</div><div${md("familientage")}><label>Familientage pro Jahr (höchstens, falls eingeschaltet)</label>${stepper("r-ft", k.familientage_max, 1, 0)}</div></div>
    <div${md("kind_krank")}><h3 class="unter">Kind krank</h3>
      <div class="reihe kind-krank"><div><label for="kk-dienst">Dienstverhältnis</label><select id="kk-dienst">${Object.entries(KIND_KRANK_DIENSTE).map(([w, n]) => `<option value="${w}"${w === (k.kind_krank_dienst || "gesetzlich") ? " selected" : ""}>${n}</option>`).join("")}</select></div>
        <div><label for="kk-max">Eigener Wert (Tage pro Jahr)</label>${stepper("kk-max", u.kind_krank_max, 1, 0)}</div></div>
      <p class="hinweis" id="kk-gilt">${kindKrankText(u)}</p><div id="kk-fehler"></div>
      <div class="knoepfe"><button type="button" id="kk-speichern">Kind krank ab ${jahr} speichern</button></div></div>
    <div${md("zutun")}><h3 class="unter">Zu tun</h3>
      <label for="r-zs">Erinnerung an Sicherung nach … Tagen</label>${stepper("r-zs", zutunSicherungTage(k), 1, 1)}
      <div class="reihe"><div><label for="r-zg">Hinweis ab Plus (Stunden)</label>${stepper("r-zg", zutunSaldoGrenze(k), 1, 1)}</div><div><label for="r-zm">Hinweis ab Minus (Stunden)</label>${stepper("r-zm", zutunSaldoMinus(k), 1, 0)}</div></div>
      <p class="hinweis">Gleitzeit-Konto: Ab diesen Stunden im Plus oder im Minus steht ein Hinweis unter „Zu tun“. Minus 0 heißt: wie Plus.</p></div>
    <label>Pausenregel <small>(je Stufe hh:mm; leere Zeile zählt nicht)</small></label>
    <div class="pausen-stufen" id="r-pausen"><small>Kommen bis Gehen länger als</small><small>Pause insgesamt</small>${pausenZeilen(k.pausen || [])}</div>
    <label>Faschingsdienstag: Soll höchstens (Stunden, leer = normaler Tag)</label><input id="r-fa" inputmode="decimal" value="${k.fasching_std === null ? "" : komma(k.fasching_std)}">
    <label>Wann soll die Änderung gelten?</label>
    <div class="modus">
      <label><input type="radio" name="r-modus" value="ab_heute" checked> Ab heute (bisherige Tage bleiben unverändert)</label>
      <label><input type="radio" name="r-modus" value="ab_datum"> Ab diesem Datum: <input type="date" id="r-ab" value="${heuteIso}" aria-label="Datum, ab dem die Änderung gilt"></label>
      <label><input type="radio" name="r-modus" value="rueckwirkend"> Rückwirkend für alle Zeiträume (ersetzt auch frühere Regeln)</label>
    </div>
    <div id="r-fehler"></div>
    <div class="knoepfe"><button class="prim" ${kl("regelnSpeichern")}>Regeln speichern</button><button ${kl("regelnStandard")}>Voreinstellung laden</button></div>
    <p class="hinweis">„Ab heute“ ändert nur künftige Tage. Gleitzeit-Konto und vergangene Auswertungen bleiben, wie sie sind. Bei „Rückwirkend“ oder einem Datum in der Vergangenheit ändern sich Soll und Feiertage auch für vergangene Tage. Trage danach den Gleitzeit-Stand unter „Person und Startwerte“ neu ein. Die HO-Grenze und die Höchstzahlen gelten für das Jahr, in dem du sie änderst, und für die folgenden.</p></div>
    <div class="card"><h2>Gültigkeit der Regeln</h2>${liste}<p class="hinweis">Jede Zeile gilt ab ihrem Datum bis zur nächsten. Löschst du eine Zeile, gilt wieder die vorherige Regel.</p></div>`;
}
// Speichert die Regeln (für alle Jahre, ab heute oder ab einem Datum) beim Server und zeichnet neu.
async function regelnSpeichern() {
  const fa = $("#r-fa").value.trim(), modus = document.querySelector("input[name=r-modus]:checked").value;
  try {
    const r = await api("PUT", "/konfig", {modus, ab: $("#r-ab").value, werte: {bundesland: $("#r-bl").value, heiligabend_frei: $("#r-ha").checked, silvester_frei: $("#r-sy").checked, himmelfahrt_frei: $("#r-mh").checked, urlaub_tage: +$("#r-ut").value,
      wochenstunden: $("#r-ws").value, arbeitstage: [...document.querySelectorAll("#r-tage input:checked")].map(e => e.value).join(","),
      fasching_std: fa === "" ? null : fa, ...hoRegel($("#r-hm").value, +$("#r-ho").value), gleittage_max: +$("#r-gt").value, familientage_max: +$("#r-ft").value,
      zutun_sicherung_tage: +$("#r-zs").value, zutun_saldo_grenze: +$("#r-zg").value, zutun_saldo_minus: +$("#r-zm").value,
      pausen: [0, 1, 2, 3].filter(i => $(`#r-pa${i}`)).map(i => [zeitNorm($(`#r-pa${i}`).value), zeitNorm($(`#r-pp${i}`).value)]).filter(([a, b]) => a || b)}});
    KONFIG = r.werte; toast("Regeln gespeichert"); zeigen();
  } catch (e) { $("#r-fehler").innerHTML = meldung(e.message); }
}
// Trägt die Voreinstellung in die Felder der Regeln ein (noch nicht gespeichert).
function regelnStandard() {
  const s = window.konfigStandard;
  $("#r-bl").value = s.bundesland; $("#r-ha").checked = s.heiligabend_frei; $("#r-sy").checked = s.silvester_frei; $("#r-mh").checked = s.himmelfahrt_frei; $("#r-ut").value = s.urlaub_tage; $("#r-ws").value = s.wochenstunden;
  document.querySelectorAll("#r-tage input").forEach(e => { e.checked = s.arbeitstage.split(",").includes(e.value); });
  $("#r-fa").value = s.fasching_std === null ? "" : komma(s.fasching_std); $("#r-ho").value = s.ho_grenze; $("#r-hm").value = s.ho_modus; hoModusWahl(s.ho_modus); $("#r-gt").value = s.gleittage_max; $("#r-ft").value = s.familientage_max;
  $("#r-zs").value = zutunSicherungTage(s); $("#r-zg").value = zutunSaldoGrenze(s); $("#r-zm").value = zutunSaldoMinus(s);
  $("#r-pausen").innerHTML = `<small>Kommen bis Gehen länger als</small><small>Pause insgesamt</small>${pausenZeilen(s.pausen)}`;
  toast("Voreinstellung eingetragen, noch nicht gespeichert");
}
// Löscht die Regeln ab einem Datum, nach Rückfrage; dann gilt wieder die vorherige Regel.
async function regelnVersionWeg(ab) {
  if (!(await frage(`Regeln ab ${de(ab)} löschen?`, "Löschen", true))) return;
  try { KONFIG = (await api("DELETE", `/konfig/${ab}`)).werte; zeigen(); } catch (e) { toastFehler(e.message); }
}
// ---- Kind krank (N5): Vorgabe nach Gesetz und Jahr je Dienstverhältnis; die Zahlen kennt nur der Server (konfig.KIND_KRANK_VORGABE).
const KIND_KRANK_DIENSTE = {"gesetzlich": "Gesetzlich versichert (§ 45 SGB V)", "beamte_by": "Beamte in Bayern (§ 10 Abs. 3 UrlMV)", "eigen": "Eigener Wert"};   // wie konfig.KIND_KRANK_DIENSTE
// Satz unter der Wahl: das Limit, das im gewählten Jahr gilt (aus GET /api/urlaub/<J>).
const kindKrankText = u => `Gilt ${u.jahr}: ${anzahl(u.kind_krank_max, "Tag", "Tage")} „Kind krank“. Die Vorgabe folgt dem Gesetz des Jahres; beim eigenen Wert gilt die Zahl daneben.`;
// Gleitzeit-Grenze im Minus (Regel zutun_saldo_minus, 0 = wie Plus), Spiegel zu zutunSaldoGrenze.
const zutunSaldoMinus = k => k.zutun_saldo_minus ?? 0;
// Wer die Zahl ändert, wählt den eigenen Wert (so rechnet auch der Server, konfig._eigener_kind_krank_wert).
function kindKrankZahl() { $("#kk-dienst").value = "eigen"; }
// Speichert Dienstverhältnis und eigenen Wert ab dem 1.1. des gewählten Jahres für alle folgenden Versionen; bei einem Fehler bleiben die Eingaben.
async function kindKrankSpeichern() {
  try {
    KONFIG = (await api("PUT", "/konfig", {modus: "ab_datum_folgend", ab: `${jahr}-01-01`, werte: {kind_krank_dienst: $("#kk-dienst").value, kind_krank_max: +$("#kk-max").value}})).werte;
    toast(`Kind krank ab ${jahr} gespeichert`); seitenCacheLeeren(); zeigen();
  } catch (e) { $("#kk-fehler").innerHTML = meldung(e.message); }
}

// ---- Arbeitszeit-Abschnitte als Zeitleiste (M4, R4)
const TEILZEIT_ARTEN = ["teilzeit", "elternteilzeit", "altersteilzeit", "pflegezeit"];
const WEG1_HINWEIS = "verteilt auf die Arbeitstage der Regeln";   // Weg 1: nur Wochenstunden, keine eigenen Arbeitstage
// Tag nach einem ISO-Datum (für „Neuer Abschnitt ab …“).
const tagDanach = iso => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };
// Vorgabedatum eines neuen Abschnitts: der Tag nach dem letzten Abschnitt, sonst der 1.1. des gewählten Jahres.
const neuerAbschnittAb = a => a.length ? tagDanach(a.map(x => x.bis).sort().pop()) : `${jahr}-01-01`;
// Stunden je Tag eines Abschnitts als Text („Mo 8:00 · Di 6:30“), leer bei Weg 1 und 2.
const jeTagText = x => Object.entries(x.stunden_je_tag || {}).map(([t, m]) => `${t} ${hhmm(m)}`).join(" · ");
// Karte „Arbeitszeit-Abschnitte“: nach Beginn sortiert, je Zeile Zeitraum, Art, Sollzeit pro Woche und der Weg; ohne Diagramm.
function abschnitteKarte(a) {
  const zeile = x => `<button type="button" class="zeile abschnitt-zeile" ${kl("abschnittBearbeiten", x.id)}><span>${de(x.von)} – ${de(x.bis)}<br>
    <small>${ABSCHNITT_ART[x.art]} · Sollzeit pro Woche: ${x.wochensoll} Std. · ${x.weg === 1 ? WEG1_HINWEIS : esc(jeTagText(x) || x.arbeitstage)}</small></span><span aria-hidden="true">›</span></button>`;
  const liste = [...a].sort((a, b) => a.von.localeCompare(b.von)).map(zeile).join("") || `<div class="leer">Keine Abschnitte.</div>`;
  return `<div class="card"><h2>Arbeitszeit-Abschnitte</h2>${liste}<div class="knoepfe"><button class="prim" ${kl("abschnittBearbeiten", 0)}>Neuer Abschnitt ab ${de(neuerAbschnittAb(a))}</button></div>
    <p class="hinweis">Ohne Abschnitt gilt die Standardarbeitszeit (${komma(KONFIG.wochenstunden)} Stunden, ${KONFIG.arbeitstage.replace(/,/g, ", ")}; unter „Regeln“ einstellbar). Abschnitte beschreiben abweichende Arbeitszeiten für einen Zeitraum, zum Beispiel Teilzeit, Elternzeit oder Elternteilzeit. Bei Teilzeit lassen sich die Stunden je Tag einzeln eintragen.</p></div>`;
}
// Minuten aus „6:30“, „6,5“ oder „6“ für die Anzeige der Summe; was sich nicht lesen lässt, ergibt NaN (prüfen tut der Server).
function dauerMinuten(t) {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (m) return +m[1] * 60 + +m[2];
  return /^\d{1,2}([.,]\d+)?$/.test(t) ? Math.round(parseFloat(t.replace(",", ".")) * 60) : NaN;
}
// Weg 3: Sobald Stunden je Tag eingetragen sind, zeigt „Wochenstunden“ nur ihre Summe; sonst ist das Feld wieder frei.
function wochenstundenNurAnzeige() {
  const werte = WERKTAGE.map(t => $(`#a-t-${t}`).value.trim()).filter(Boolean), feld = $("#a-std");
  feld.readOnly = werte.length > 0;
  const summe = werte.reduce((s, t) => s + dauerMinuten(t), 0);
  if (werte.length && !Number.isNaN(summe)) feld.value = Math.round(summe / 60 * 100) / 100;
}
// Zeigt die Stunden je Tag nur bei den Teilzeit-Arten; Freistellungen setzen die Wochenstunden auf 0.
function abschnittArtWahl() {
  const art = $("#a-art").value;
  $("#a-je-tag").hidden = !TEILZEIT_ARTEN.includes(art);
  if (ABSCHNITT_OHNE_STUNDEN.includes(art)) $("#a-std").value = 0;
}
// Blatt zum Anlegen und Ändern eines Abschnitts (Zeitraum, Art, Wochenstunden, Arbeitstage, bei Teilzeit Stunden je Tag).
function abschnittBearbeiten(id) {
  const a = window.abschnittDaten, x = a.find(v => v.id === id) || {id: 0, von: neuerAbschnittAb(a), bis: `${jahr}-12-31`, wochenstunden: KONFIG.wochenstunden, art: "normal", arbeitstage: KONFIG.arbeitstage, stunden_je_tag: {}};
  const tage = x.arbeitstage.split(","), jeTag = x.stunden_je_tag || {};
  blatt(`<h3>${id ? "Abschnitt bearbeiten" : "Neuer Abschnitt"}</h3>
    <div class="reihe"><div><label for="a-von">Von</label><input id="a-von" type="date" value="${x.von}"></div><div><label for="a-bis">Bis</label><input id="a-bis" type="date" value="${x.bis}"></div></div>
    <label for="a-art">Art</label><select id="a-art">${Object.entries(ABSCHNITT_ART).map(([k, v]) => `<option value="${k}" ${x.art === k ? "selected" : ""}>${v}</option>`).join("")}</select>
    <label for="a-std">Wochenstunden</label>${stepper("a-std", x.wochenstunden, 0.5, 0)}
    <label>Arbeitstage</label><div class="tage-wahl" id="a-tage">${WERKTAGE.map(t => `<label><input type="checkbox" value="${t}" ${tage.includes(t) ? "checked" : ""}>${t}</label>`).join("")}</div>
    <div id="a-je-tag"${TEILZEIT_ARTEN.includes(x.art) ? "" : " hidden"}><label>Stunden je Tag <small>(leer: Wochenstunden gleich verteilt)</small></label>
      <div class="je-tag">${WERKTAGE.map(t => `<div><label for="a-t-${t}">${t}</label><input id="a-t-${t}" inputmode="decimal" placeholder="6:30" value="${jeTag[t] ? hhmm(jeTag[t]) : ""}"></div>`).join("")}</div></div>
    <div id="a-fehler"></div><div class="knoepfe"><button class="prim" id="a-ok">Speichern</button>${id ? `<button class="gef" id="a-del">Löschen</button>` : ""}<button id="a-zu">Abbrechen</button></div>`);
  $("#a-zu").onclick = blattZu;
  $("#a-art").onchange = abschnittArtWahl;
  WERKTAGE.forEach(t => { $(`#a-t-${t}`).oninput = wochenstundenNurAnzeige; });
  wochenstundenNurAnzeige();
  $("#a-ok").onclick = () => abschnittSpeichern(id);
  if (id) $("#a-del").onclick = async () => { if (await frage("Abschnitt löschen?", "Löschen", true)) { try { await api("DELETE", `/abschnitt/${id}`); zeigen(); } catch (e) { toastFehler(e.message); } } };
}
// Speichert den Abschnitt aus dem Blatt; Stunden je Tag nur bei Teilzeit-Arten. Bei einem Fehler (auch teilweise ausgefüllte Stunden) bleibt das Blatt mit allen Eingaben offen.
async function abschnittSpeichern(id) {
  const art = $("#a-art").value, jeTag = TEILZEIT_ARTEN.includes(art) ? Object.fromEntries(WERKTAGE.map(t => [t, $(`#a-t-${t}`).value.trim()])) : undefined;
  try {
    await api("POST", "/abschnitt", {id, von: $("#a-von").value, bis: $("#a-bis").value, art, wochenstunden: $("#a-std").value, stunden_je_tag: jeTag,
      arbeitstage: [...document.querySelectorAll("#a-tage input:checked")].map(e => e.value).join(",")});
    blattZu(); zeigen();
  } catch (e) { formFehler($("#a-fehler"), e.message, {felder: [["Wochenstunden", "#a-std"]]}); }
}

// ---- Eigene Feiertage (R4b, U18): einmalige über PUT /api/urlaub (volle Liste), jährliche und abgewählte über die Regeln ab dem 1.1. des Jahres
const FEIERTAG_QUELLE = {gesetzlich: "gesetzlicher Feiertag", jaehrlich: "eigener, jedes Jahr", einmalig: "eigener, nur in diesem Jahr", abgewaehlt: "abgewählt, Arbeitstag"};
const EIGENER_FREIER_TAG = "Eigener freier Tag";               // wie feiertage.EIGENER_FREIER_TAG
let feiertagDaten = null;                                      // {liste, u, versionen} der gezeigten Seite
// Regeln, die am 1.1. des gewählten Jahres gelten (dort wirken jährliche und abgewählte Feiertage).
const regelnImJahr = () => (feiertagDaten.versionen.filter(v => v.ab <= `${jahr}-01-01`).pop() || {werte: KONFIG}).werte;
// Eine Zeile der Feiertagsliste: berechnete mit Schalter „frei“, eigene mit Entfernen.
function feiertagZeile(f, i) {
  const aktion = f.quelle === "gesetzlich" || f.quelle === "abgewaehlt"
    ? `<input type="checkbox" data-ft="${i}" ${f.frei ? "checked" : ""} aria-label="${esc(f.name)} ist frei">`
    : `<button type="button" class="gef" data-ft="${i}" aria-label="${esc(f.name)} entfernen">✕</button>`;
  return `<div class="zeile"><span>${de(f.datum)} · ${esc(f.name)}<br><small>${FEIERTAG_QUELLE[f.quelle]}</small></span>${aktion}</div>`;
}
// Karte „Feiertage“ des gewählten Jahres: Liste (gesetzlich, jährlich, einmalig, abgewählt) und eigener Feiertag (einmalig oder jedes Jahr).
function feiertageKarte(liste) {
  return `<div class="card" id="feiertage"><h2>Feiertage ${jahr}</h2><div id="ft-liste">${liste.map(feiertagZeile).join("")}</div>
    <h3 class="unter">Eigener Feiertag</h3>
    <div class="reihe"><div><label for="ft-datum">Datum</label><input type="date" id="ft-datum" min="${jahr}-01-01" max="${jahr}-12-31"></div>
      <div><label for="ft-name">Name</label><input type="text" id="ft-name" maxlength="40" placeholder="${EIGENER_FREIER_TAG}" autocomplete="off"></div></div>
    <div class="modus"><label><input type="radio" name="ft-art" value="einmalig" checked> Nur ${jahr}</label><label><input type="radio" name="ft-art" value="jaehrlich"> Jedes Jahr ab ${jahr}</label></div>
    <div id="ft-fehler"></div><div class="knoepfe"><button type="button" class="prim" id="ft-anlegen">Feiertag anlegen</button></div>
    <p class="hinweis">Die gesetzlichen Feiertage berechnet die App aus dem Bundesland (${FEIERTAGE_STAND}). Ohne Haken ist der Tag ein Arbeitstag, ab ${jahr} auch in den folgenden Jahren. 24.12. und 31.12. stellst du oben unter „Regeln“ ein.</p></div>`;
}
// Schreibt jährliche oder abgewählte Feiertage ab dem 1.1. des gewählten Jahres in alle folgenden Versionen der Regeln. Fehler wirft weiter.
async function feiertageRegelSetzen(werte) {
  KONFIG = (await api("PUT", "/konfig", {modus: "ab_datum_folgend", ab: `${jahr}-01-01`, werte})).werte;
}
// Schreibt die einmaligen freien Tage des Jahres: Jahr, geltender Anspruch und die volle Liste, weil PUT /api/urlaub das ganze Jahr schreibt.
// Vorhandene Tage gehen als Datum mit, so behält der Server ihre Namen. Fehler wirft weiter.
async function einmaligSetzen(liste) {
  const u = feiertagDaten.u;
  await api("PUT", "/urlaub", {jahr: u.jahr, anspruch: u.anspruch, eigene_frei: liste});
}
// Führt eine Änderung der Feiertage aus und zeichnet neu; bei einem Fehler steht die Meldung in der Karte und die Eingaben bleiben.
async function feiertagAendern(schritt, text) {
  try { await schritt(); toast(text); seitenCacheLeeren(); zeigen(); }
  catch (e) { $("#ft-fehler").innerHTML = meldung(e.message); }
}
// Legt einen eigenen Feiertag an (nur in diesem Jahr oder jedes Jahr); ein Tag, der schon frei ist, wird abgelehnt.
async function feiertagAnlegen() {
  const {liste, u} = feiertagDaten, datum = $("#ft-datum").value, name = $("#ft-name").value.trim() || EIGENER_FREIER_TAG;
  const jaehrlich = document.querySelector("input[name=ft-art]:checked").value === "jaehrlich", da = liste.find(f => f.datum === datum && f.frei);
  try {
    if (!datum.startsWith(`${jahr}-`)) throw new Error(`Bitte ein Datum im Jahr ${jahr} wählen.`);
    if (da) throw new Error(`Am ${de(datum).slice(0, 6)} ist schon ein Feiertag (${da.name})`);
    if (jaehrlich) await feiertageRegelSetzen({feiertage_eigen: [...regelnImJahr().feiertage_eigen, [datum.slice(5), name]]});
    else await einmaligSetzen([...u.eigene_frei, {datum, name}]);
    toast(`${name} angelegt`); seitenCacheLeeren(); zeigen();
  } catch (e) { $("#ft-fehler").innerHTML = meldung(e.message); }
}
// Klick oder Schalter in der Liste: berechneten Feiertag ab- oder wieder anwählen, eigenen entfernen.
function feiertagListe(box, ev) {
  const e = ev.target.closest("[data-ft]"); if (!e || (ev.type === "click" && e.type === "checkbox")) return;
  const f = feiertagDaten.liste[+e.dataset.ft], w = regelnImJahr();
  if (f.quelle === "einmalig") return feiertagAendern(() => einmaligSetzen(feiertagDaten.u.eigene_frei.filter(d => d !== f.datum)), `${f.name} entfernt`);
  if (f.quelle === "jaehrlich") return feiertagAendern(() => feiertageRegelSetzen({feiertage_eigen: w.feiertage_eigen.filter(([t]) => t !== f.datum.slice(5))}), `${f.name} entfernt`);
  const aus = w.feiertage_aus.filter(n => n !== f.name).concat(e.checked ? [] : [f.name]);
  feiertagAendern(() => feiertageRegelSetzen({feiertage_aus: aus}), e.checked ? `${f.name} ist wieder frei` : `${f.name} ist ab ${jahr} ein Arbeitstag`);
}

// Unterseite „Arbeitszeit und Regeln“: Regeln mit Kind krank und Gleitzeit-Grenzen, Abschnitte, Feiertage des gewählten Jahres.
async function einstArbeitszeit() {
  const [kf, ab, liste, u] = await Promise.all([api("GET", "/konfig"), api("GET", "/abschnitte"), api("GET", `/feiertage/${jahr}`), api("GET", `/urlaub/${jahr}`)]);
  KONFIG = kf.werte;
  window.abschnittDaten = ab.abschnitte;
  feiertagDaten = {liste, u, versionen: kf.versionen};
  einstBinden({"kk-max": ["input", kindKrankZahl], "kk-speichern": ["click", kindKrankSpeichern], "ft-anlegen": ["click", feiertagAnlegen], "ft-liste": ["click", feiertagListe]});
  const binden = window.nachher;
  window.nachher = () => { binden(); $("#ft-liste").onchange = ev => feiertagListe(ev.currentTarget, ev); };
  return regelnKarte(kf, u) + feiertageKarte(liste) + abschnitteKarte(ab.abschnitte);
}
// ---- seiten/einstellungen_person.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Einstellungen, Unterseite „Person und Startwerte“: Erfassung gültig ab, Gleitzeit- und Freizeitkonto, Kopf des Monatsnachweises.
// Setzt den Stand des Freizeitkontos zu einem Datum.
async function freizeitSetzen() {
  try { await api("PUT", "/freizeit", {stand: $("#fz-stand").value, datum: $("#fz-datum").value}); toast("Freizeitkonto gesetzt"); zeigen(); }
  catch (e) { $("#fz-fehler").innerHTML = meldung(e.message); }
}
// Setzt den Stand des Gleitzeit-Kontos zu einem Datum.
async function gleitzeitSetzen() {
  try { await api("PUT", "/gleitzeit", {stand: $("#g-stand").value, datum: $("#g-datum").value}); toast("Gleitzeit-Konto gesetzt"); zeigen(); }
  catch (e) { $("#g-fehler").innerHTML = meldung(e.message); }
}
// Felder der Startwerte, die am 1.1. gesperrt sind (davor liegt im Jahr nichts); offen bleibt nur die Gleitzeit.
const STARTWERTE_JAHRESFELDER = ["sw-ho", "sw-dst", "sw-urlaub", "sw-gleittage", "sw-krank", "sw-kind_krank"];
// Ein Feld der Startwerte mit Beschriftung; zahl: ganze Tage, sonst Text (Stunden „8:30“ oder „8,5“).
const startwertFeld = (id, name, wert, zahl, modul = "") => `<div${modul ? md(modul) : ""}><label for="sw-${id}">${name}</label><input id="sw-${id}" value="${esc(String(wert))}"${zahl ? ' type="number" min="0" step="1" inputmode="numeric"' : ' inputmode="decimal" placeholder="z. B. 300:00 oder 300,5"'}></div>`;
// Karte „Erfassung gültig ab“ (R6): Datum und der Stand bis zum Vortag (Zeiten, genommene Tage, Gleitzeit-Saldo).
function startwerteKarte(s) {
  return `<div class="card" id="startwerte"><h2>Erfassung gültig ab</h2>
    <p class="hinweis" data-stil="margin-top:0">Ab diesem Tag erfasst du in der App. Was davor im Jahr war, trägst du hier als Stand bis zum Vortag ein. Stunden als „8:30“ oder „8,5“.</p>
    <label for="sw-ab">Erfassung gültig ab</label><input type="date" id="sw-ab" value="${esc(s.ab)}" max="${new Date().toISOString().slice(0, 10)}">
    <h3 class="unter" id="sw-bis">Stand bis ${s.stand_bis ? esc(s.stand_bis) : "zum Vortag"}</h3>
    <div class="reihe">${startwertFeld("ho", "HO-Zeit (Stunden)", s.ho, false)}${startwertFeld("dst", "Büro-Zeit (Stunden)", s.dst, false)}</div>
    <div class="reihe">${startwertFeld("urlaub", "Urlaub genommen (Tage)", s.urlaub, true, "urlaub")}${startwertFeld("gleittage", "Gleittage genommen", s.gleittage, true, "gleittage")}</div>
    <div class="reihe">${startwertFeld("krank", "Kranktage", s.krank, true, "krank")}${startwertFeld("kind_krank", "Kind krank (Tage)", s.kind_krank, true, "kind_krank")}</div>
    <div${md("gleitzeit")}><label for="sw-gleitzeit">Gleitzeit-Saldo (hh:mm, auch −03:15)</label><input id="sw-gleitzeit" value="${esc(s.gleitzeit)}" placeholder="leer = Stand der App am Vortag"></div>
    <p class="hinweis">Angesparten Urlaub als Rest am Beginn bei den Konten eintragen.</p>
    <div id="sw-fehler"></div><div class="knoepfe"><button type="button" class="prim" id="sw-speichern">Startwerte speichern</button>${s.ab ? `<button type="button" id="sw-loeschen">Startwerte entfernen</button>` : ""}</div></div>`;
}
// Sperrt am 1.1. alle Felder außer der Gleitzeit (gesendet wird dann 0) und schreibt den Tag in „Stand bis“.
function startwerteSperren(ab, bisText = "") {
  const gesperrt = String(ab).endsWith("-01-01");
  STARTWERTE_JAHRESFELDER.forEach(id => { const e = document.getElementById(id); if (e) e.disabled = gesperrt; });
  if (bisText) $("#sw-bis").textContent = `Stand bis ${bisText}`;
}
// Neues Datum: Vorbelegung vom Server holen (Gleitzeit am Vortag, „Stand bis“); die übrigen Eingaben bleiben stehen. Fehler (Zukunft) im Feld der Karte.
async function startwerteDatum(feld) {
  $("#sw-fehler").innerHTML = "";
  if (!feld.value) return startwerteSperren("");
  try { const s = await api("GET", `/startwerte?ab=${encodeURIComponent(feld.value)}`); $("#sw-gleitzeit").value = s.gleitzeit; startwerteSperren(s.ab, s.stand_bis); }
  catch (e) { $("#sw-fehler").innerHTML = meldung(e.message); }
}
// Wert eines Feldes der Startwerte; ein gesperrtes oder fehlendes Feld liefert leer.
const startwertWert = id => { const e = $("#sw-" + id); return !e || e.disabled ? "" : e.value.trim(); };
// Speichert die Startwerte; Hinweise des Servers (Übertrag, verschobenes Datum) erscheinen als Meldung. Bei einem Fehler bleiben die Eingaben stehen.
async function startwerteSpeichern() {
  const tage = f => +startwertWert(f) || 0, zeit = f => startwertWert(f) || "0:00";
  try {
    const r = await api("PUT", "/startwerte", {ab: $("#sw-ab").value, ho: zeit("ho"), dst: zeit("dst"), urlaub: tage("urlaub"), gleittage: tage("gleittage"),
      krank: tage("krank"), kind_krank: tage("kind_krank"), gleitzeit: $("#sw-gleitzeit").value.trim()});
    toast((r.hinweise || []).join(" ") || "Startwerte gespeichert"); seitenCacheLeeren(); zeigen();
  } catch (e) { $("#sw-fehler").innerHTML = meldung(e.message); }
}
// Entfernt die Startwerte nach Rückfrage; beide Konten zeigen danach heute denselben Stand.
async function startwerteLoeschen() {
  if (!(await frage("Startwerte entfernen?\n\nDie App rechnet dann wieder mit allen erfassten Tagen. Gleitzeit- und Freizeitkonto zeigen heute denselben Stand.", "Entfernen", true))) return;
  try { await api("PUT", "/startwerte", {ab: ""}); toast("Startwerte entfernt"); seitenCacheLeeren(); zeigen(); }
  catch (e) { $("#sw-fehler").innerHTML = meldung(e.message); }
}
// Felder des Kopfs im Monatsnachweis: [Schlüssel, Beschriftung, autocomplete].
const NACHWEIS_KOPF = [["name", "Name", "name"], ["arbeitgeber", "Arbeitgeber", "organization"], ["personalnummer", "Personalnummer", "off"]];
const NACHWEIS_KOPF_MAX = 80;                                  // wie db.NACHWEIS_MAX
// Karte „Kopf des Monatsnachweises“: Name, Arbeitgeber und Personalnummer.
function nachweisKopfKarte(kopf) {
  const feld = ([f, name, auto]) => `<label for="nk-${f}">${name}</label><input type="text" id="nk-${f}" maxlength="${NACHWEIS_KOPF_MAX}" autocomplete="${auto}" value="${esc(kopf[f] || "")}">`;
  return `<div class="card"${md("monatsnachweis")}><h2>Kopf des Monatsnachweises</h2>
    <p class="hinweis" data-stil="margin-top:0">Steht nur im Kopf des Monatsnachweises. Bleibt auf deinen Geräten und in der verschlüsselten Synchronisierung.</p>
    ${NACHWEIS_KOPF.map(feld).join("")}
    <div id="nk-fehler"></div><div class="knoepfe"><button type="button" class="prim" id="nk-speichern">Speichern</button></div></div>`;
}
// Speichert den Kopf des Monatsnachweises; bei einem Fehler bleiben die Eingaben stehen.
async function nachweisKopfSpeichern() {
  try { await api("PUT", "/nachweiskopf", Object.fromEntries(NACHWEIS_KOPF.map(([f]) => [f, $("#nk-" + f).value]))); $("#nk-fehler").innerHTML = ""; toast("Gespeichert"); }
  catch (e) { formFehler($("#nk-fehler"), e.message); }
}
// Karten „Gleitzeit-Konto“ und „Freizeitkonto“: Stand heute und Stand zu einem Tag festlegen.
function kontenKarten(gz) {
  const heute = new Date().toISOString().slice(0, 10);
  return `<div class="card"${md("gleitzeit")}><h2>Gleitzeit-Konto</h2><div class="zeile"><span>Stand heute</span><b class="gross saldo ${saldoKlasse(gz.konto_min)}">${gz.konto}</b></div>
      <div class="reihe"><div><label for="g-stand">Stand (hh:mm, auch −03:15)</label><input id="g-stand" placeholder="57:40"></div><div><label for="g-datum">am Ende von</label><input id="g-datum" type="date" value="${heute}"></div></div>
      <div id="g-fehler"></div><div class="knoepfe"><button class="prim" ${kl("gleitzeitSetzen")}>Stand festlegen</button></div>
      <p class="hinweis">Das Konto rechnet Ist minus Soll aller erfassten Tage (Gleittag = −Tagessoll, Urlaub und Krank ohne Soll). Wenn es von deinem bisherigen Stand abweicht, lege hier den richtigen Stand zu einem Tag fest. Die App rechnet ab dort weiter.</p></div>
    <div class="card"${md("freizeit")}><h2>Freizeitkonto</h2><div class="zeile"><span>Stand heute</span><b class="gross saldo ${saldoKlasse(gz.freizeit_min)}">${gz.freizeit}</b></div>
      <div class="reihe"><div><label for="fz-stand">Stand (hh:mm, auch −02:00)</label><input id="fz-stand" placeholder="12:30"></div><div><label for="fz-datum">am Ende von</label><input id="fz-datum" type="date" value="${heute}"></div></div>
      <div id="fz-fehler"></div><div class="knoepfe"><button class="prim" ${kl("freizeitSetzen")}>Stand festlegen</button></div>
      <p class="hinweis">Das Freizeitkonto ist unabhängig von der Gleitzeit: Arbeitszeit an Samstagen, Sonntagen und Feiertagen kommt dazu, die Art „Freizeitausgleich“ bucht das Tagessoll ab.</p></div>`;
}
// Unterseite „Person und Startwerte“: lädt Startwerte, Konten und den Kopf des Monatsnachweises.
async function einstPerson() {
  const [sw, gz, kopf] = await Promise.all([api("GET", "/startwerte"), api("GET", "/gleitzeit"), api("GET", "/nachweiskopf")]);
  const html = startwerteKarte(sw) + kontenKarten(gz) + nachweisKopfKarte(kopf);
  window.nachher = () => startwerteSperren(sw.ab);
  einstBinden({"sw-ab": ["change", startwerteDatum], "sw-speichern": ["click", startwerteSpeichern], "sw-loeschen": ["click", startwerteLoeschen], "nk-speichern": ["click", nachweisKopfSpeichern]});
  return html;
}
// ---- seiten/einstellungen_aussehen.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Einstellungen, Unterseite „Aussehen“: Design, Farbe, Stil, Glaseffekt, Akzentfarbe, Zeitformat und Browser des Fensters.
const AKZENT_NAMEN = {blau: "Blau", cyan: "Cyan", tuerkis: "Türkis", gruen: "Grün", lindgruen: "Lindgrün", gelb: "Gelb", gold: "Gold", orange: "Orange", rot: "Rot", rosa: "Rosa", violett: "Violett", indigo: "Indigo", braun: "Braun", graphit: "Graphit"};
function hexNormal(v) {                                     // "1a73e8", "#abc" -> "#1a73e8"/"#aabbcc"; ungültig -> null
  v = String(v).trim(); if (v && v[0] !== "#") v = "#" + v;
  if (/^#[0-9a-f]{3}$/i.test(v)) v = "#" + [...v.slice(1)].map(x => x + x).join("");
  return hexOk(v) ? v.toLowerCase() : null;
}
// Zeigt die Farbe im Feld und an Beispielen, ohne sie zu speichern: Knopf (--v, --vt), Chip und Schrift (--vf), Umriss in der Bedienfarbe (--vu, design.md 6.3).
function akzentVorschau(c) {
  const d = $("#akz-demo"), p = $("#akz-vorschau"); if (!d || !p) return;
  p.style.background = c || "transparent"; p.classList.toggle("leer", !c);
  d.style.setProperty("--v", c ? knopfFarbe(c) : "var(--acc-k)"); d.style.setProperty("--vt", c ? schriftAufFarbe(c) : "var(--acc-t)"); d.style.setProperty("--vf", c ? akzentSchrift(c) : "var(--acc-fg)");
  d.style.setProperty("--vu", c ? akzentBedien(c) : "var(--acc-ui)");
}
// Setzt die Akzentfarbe auf Blau zurück.
function akzentStandard() { speicher.s("ho_akzent", "blau"); darstellung(); zeigen(); }
// Karte „Aussehen“ der Einstellungen: Design, Farbe, Stil, Glaseffekt (nur beim Stil Glas) und Akzentfarbe (Palette und Hex-Wert). Die Knöpfe werden in window.nachher gebunden, wenn die Seite steht.
function seiteDarstellung() {
  const d = speicher.l("ho_design", "auto"), f = speicher.l("ho_farbe", FARBE_VORGABE), a = speicher.l("ho_akzent", "blau");
  const thema = themaAktiv();
  // Gruppe von Auswahlknöpfen; der gewählte trägt die Klasse on.
  const seg = (name, wahl, akt) => `<div class="seg" data-n="${name}">${wahl.map(([k, t]) => `<button data-v="${k}" class="${akt === k ? "on" : ""}">${t}</button>`).join("")}</div>`;
  window.nachher = () => {
    document.querySelectorAll("#inhalt [data-n]").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => {
    speicher.s("ho_" + g.dataset.n, b.dataset.v); darstellung();
    g.querySelectorAll("button").forEach(x => x.classList.toggle("on", x === b));
    if (["akzent", "farbe", "thema"].includes(g.dataset.n)) zeigen();   // Farbe: die Vorschau rechnet die Schrift des Akzents gegen den neuen Hintergrund (sonst zu wenig Kontrast); Stil: Glaseffekt nur bei Glas
  }));
  akzentVorschau(hexOk(speicher.l("ho_akzent", "")) ? speicher.l("ho_akzent", "") : hexNormal($("#akz-hex") ? $("#akz-hex").value : ""));
  const eig = $("#akz-eigen"), hex = $("#akz-hex");
  if (eig) {
    // Übernimmt eine eigene Farbe: speichern, anwenden, Vorschau und Farbpalette-Knopf nachziehen.
    const setze = f => {
      speicher.s("ho_akzent", f); darstellung(); akzentVorschau(f);
      document.querySelectorAll("#inhalt .farben button").forEach(x => x.classList.remove("on"));
      const l = document.querySelector(".palette-knopf"); l.classList.add("on"); l.querySelector(".punkt").style.background = f; eig.value = f; hex.value = f;
    };
    eig.oninput = () => setze(eig.value.toLowerCase());
    hex.oninput = () => akzentVorschau(hexNormal(hex.value));
    hex.onchange = () => { const v = hexNormal(hex.value); if (v) setze(v); else { toast("Hex-Wert wie #1a73e8 eingeben"); hex.value = hexOk(speicher.l("ho_akzent", "")) ? speicher.l("ho_akzent", "") : ""; } };
  }
  };
  return `<div class="card"><h2>Aussehen</h2>
    <label>Design</label>${seg("design", [["auto", "Automatisch"], ["web", "Web"], ["handy", "Handy"]], d)}
    <p class="hinweis">Web: Seitenleiste und breite Ansicht für Computer und große Tablets. Handy: Tableiste unten für Smartphones. Automatisch wählt nach der Fensterbreite.</p>
    <label>Farbe</label>${seg("farbe", [["auto", "Automatisch"], ["hell", "Hell"], ["dunkel", "Dunkel"]], f)}
    <p class="hinweis">Automatisch folgt der Einstellung deines Geräts.</p>
    <label>Stil</label>${seg("thema", Object.entries(THEMEN), thema)}
    <p class="hinweis">Glas: durchscheinend und weich. Flächig: getönte Flächen, runde Knöpfe. Kompakt: dicht, feine Linien. Klar: Linien statt Schatten, große Zahlen. Kräftig: dicke Ränder, harte Schatten. Terminal: Schrift mit fester Breite, schmale Rahmen. Gilt nur auf diesem Gerät.</p>
    ${thema === THEMA_VORGABE ? `<label>Glaseffekt</label>${seg("glas", [["auto", "Automatisch"], ["an", "An"], ["aus", "Aus"]], speicher.l("ho_glas", "auto"))}
    <p class="hinweis">Durchscheinende, weiche Flächen. Aus macht sie deckend und spart Leistung. Automatisch schaltet ihn auf schwachen Geräten ab. Ist am Gerät „Transparenz reduzieren“ an, ist er immer aus.</p>` : ""}
    <label>Akzentfarbe</label><div class="farben" data-n="akzent">${Object.entries(AKZENTE).map(([k, c]) => `<button data-v="${k}" class="${a === k ? "on" : ""}" data-stil="background:${c}" aria-label="${AKZENT_NAMEN[k]}" title="${AKZENT_NAMEN[k]}"></button>`).join("")}</div>
    <h3 class="unter">Eigene Farbe</h3>
    <div class="reihe eigen-farbe"><div><label>Farbpalette</label><span class="palette-knopf${hexOk(a) ? " on" : ""}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.9-.9 1.9-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.4-.6-.4-1 0-.8.7-1.5 1.5-1.5H16a5 5 0 0 0 5-5c0-4.1-4-7.5-9-7.5z"/><circle cx="7.5" cy="11" r="1" fill="currentColor"/><circle cx="10.5" cy="7" r="1" fill="currentColor"/><circle cx="15" cy="7.5" r="1" fill="currentColor"/></svg><span>Farbe wählen</span><i class="punkt" data-stil="${hexOk(a) ? "background:" + a : ""}"></i><input type="color" id="akz-eigen" value="${hexOk(a) ? a : "#007aff"}" aria-label="Farbe in der Palette wählen"></span></div>
      <div><label>Hex-Wert</label><div class="hexfeld"><span id="akz-vorschau" class="vorschau" data-stil="background:${akzentFarbe(a)}"></span><input id="akz-hex" value="${hexOk(a) ? a : ""}" placeholder="#RRGGBB" maxlength="7" autocapitalize="off" spellcheck="false"></div></div></div>
    <div class="akzent-demo" id="akz-demo"><small>Vorschau</small><span class="demo-knopf">Knopf</span><span class="demo-chip">Aktiv</span><span class="demo-text">Hervorhebung</span><span class="demo-umriss">Umriss</span></div>
    <div class="knoepfe"><button ${kl("akzentStandard")}>Zurück zum Standard</button></div>
    <p class="hinweis">Die Akzentfarbe gilt für Knöpfe, Hervorhebungen und das App-Symbol. „Farbe wählen“ öffnet die Farbpalette deines Geräts. Du kannst auch einen Hex-Wert eingeben. Sehr dunkle Farben sind im dunklen Design schwer lesbar, sehr helle (zum Beispiel Weiß) im hellen. Symbol und Knöpfe bekommen dann einen Rand.</p></div>`;
}
// Zeitformat der Zeiten in App und Exporten (Regel „zeitformat“, Vorgabe hh:mm wie zeit.fmt_hhmm); Anzeige je Wahl mit Beispiel.
const ZEITFORMATE = [["hhmm", "07:30"], ["dezimal", "7,50"]];
// Karte „Zeitformat“: zwei Knöpfe, die Wahl gilt sofort und wandert mit der Synchronisierung auf die anderen Geräte.
function zeitformatKarte(k) {
  const akt = k.zeitformat || "hhmm";
  return `<div class="card"><h2>Zeitformat</h2><label id="zf-name">7:30 oder 7,50</label>
    <div class="seg" role="group" aria-labelledby="zf-name">${ZEITFORMATE.map(([w, t]) => `<button type="button" id="zf-${w}" data-v="${w}" class="${akt === w ? "on" : ""}" aria-pressed="${akt === w}">${t}</button>`).join("")}</div>
    <p class="hinweis">Gilt für Stunden in der App und in den Exporten.</p><div id="zf-fehler"></div></div>`;
}
// Speichert das Zeitformat (für alle Zeiträume) und zeichnet neu; bei einem Fehler bleibt die alte Wahl stehen.
async function zeitformatSetzen(knopf) {
  try { KONFIG = (await api("PUT", "/konfig", {modus: "ueberall", werte: {zeitformat: knopf.dataset.v}})).werte; seitenCacheLeeren(); zeigen(); }
  catch (e) { $("#zf-fehler").innerHTML = meldung(e.message); }
}
// Unterseite „Aussehen“: lädt nur die Regeln (Zeitformat) und den Browser des Fensters (Desktop).
async function einstAussehen() {
  const [kf, browser] = await Promise.all([api("GET", "/konfig"), browserWahlHtml(false)]);
  KONFIG = kf.werte;
  const html = `<section id="aussehen" aria-label="Aussehen">${seiteDarstellung()}${zeitformatKarte(KONFIG)}${browser}</section>`;
  einstBinden(Object.fromEntries(ZEITFORMATE.map(([w]) => [`zf-${w}`, ["click", zeitformatSetzen]])));
  return html;
}
// ---- seiten/einstellungen_module.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Einstellungen, Unterseite „Module und Profile“: Module, Vorbelegung (Profile) und Werkseinstellungen.
// Modul-Schalter nach Bereichen geordnet (aufbau.md 9); Zeit steht an zweiter Stelle, weil die Übersicht vorn steht.
const MODUL_GRUPPEN = [["Übersicht", ["zutun"]], ["Zeit", ["woche", "monat", "stempel", "gleitzeit", "freizeit"]], ["Homeoffice", ["horest", "jahr"]],
  ["Abwesenheit", ["urlaub", "gleittage", "familientage", "angespart", "planung", "krank", "sonderurlaub", "kind_krank"]],
  ["Auswertung", ["monatsnachweis", "export", "ex_pdf", "ex_office", "ex_text", "ex_daten", "ex_kalender", "nachweis"]], ["Daten", ["sicherung", "abgleich", "github", "koppeln"]], ["Hilfe", ["hilfe"]]];
// Karte „Module“: Schalter je Seite und Funktion; Abgeschaltetes zeigt die App nirgends mehr.
function moduleKarte(namen, allein) {
  return `<div class="card" id="module-karte"><h2>Module</h2><p class="hinweis" data-stil="margin-top:0">Was du abschaltest, zeigt die App nirgends mehr an. Gerechnet wird unverändert, vorhandene Einträge bleiben erhalten. Die Auswahl gilt sofort, für alle Zeiträume, und wird auch synchronisiert. Jeder Reiter ist ein Modul, nur Übersicht, Tag und Einstellungen bleiben immer. Ohne „Sicherung“ erinnert die App auch nicht mehr ans Sichern. Ist „Synchronisierung“ aus, synchronisiert dieses Gerät nicht mehr: nicht von Hand, nicht automatisch und nicht als Speicherort für andere. „Synchronisierung“ gilt als einziges Modul nur für das Gerät, an dem du es schaltest. Beim Abschalten meldet sich das Gerät mit einer letzten Synchronisierung ab. Die anderen zählen mit: Solange noch mindestens zwei Geräte synchronisieren, läuft die Synchronisierung dort weiter. Ist ein Gerät allein übrig, schaltet es die Synchronisierung von selbst ab. Ein Profil setzt auch die Module: „Büro + Homeoffice“ schaltet wieder alles ein, „Nur Büro“ und „Nur Homeoffice“ blenden nicht Gebrauchtes aus.</p>
    ${MODUL_GRUPPEN.map(([g, l]) => `<h3>${g}</h3>` + l.map(n => `<div class="zeile"><span>${esc(namen[n] || n)}${n === "abgleich" && allein && !modulAn(n) ? "<br><small>von selbst abgeschaltet: kein anderes Gerät synchronisiert mehr</small>" : ""}</span><input type="checkbox" ${modulAn(n) ? "checked" : ""} data-wechsel="modulSchalten" data-name="${n}" aria-label="${esc(namen[n] || n)}"></div>`).join("")).join("")}<div id="mo-fehler"></div></div>`;
}
// Schaltet ein Modul ein oder aus (wird auch synchronisiert); beim Abschalten des Syncs folgt der letzte Sync.
async function modulSchalten(an, e) {
  const n = e.dataset.name, aus = (KONFIG.module_aus || []).filter(x => x !== n).concat(an ? [] : [n]);
  try { KONFIG = (await api("PUT", "/konfig", {modus: "ueberall", werte: {module_aus: aus}})).werte; seitenCacheLeeren(); navAnpassen(); if (n === "abgleich" && !an && MIT_SYNC.includes(PLATTFORM)) await letzterSync(); syncSymbolLaden(); }
  catch (err) { e.checked = !an; $("#mo-fehler").innerHTML = meldung(err.message); }
}
let PROFILE = [];
// Wendet ein Profil (Regeln, optional Akzentfarbe und Hell oder Dunkel) ab heute an, nach Rückfrage.
async function profilAnwenden(i) {
  const x = PROFILE[i]; if (!x) return;
  if (!(await frage(`Profil „${x.name}“ anwenden?\n\nDie Regeln gelten dann ab heute. Frühere Tage bleiben, wie sie sind.${x.akzent || x.farbe ? "\nDie Darstellung (Akzentfarbe, Hell oder Dunkel) wird auf die des Profils gestellt." : ""}`, "Anwenden"))) return;
  try { const r = await api("PUT", "/konfig", {modus: "ab_heute", werte: x.werte}); KONFIG = r.werte; } catch (e) { $("#pf-meldung").innerHTML = meldung(e.message); return; }
  if (x.akzent) speicher.s("ho_akzent", x.akzent);
  if (x.farbe) speicher.s("ho_farbe", x.farbe);
  if (x.akzent || x.farbe) darstellung();
  seitenCacheLeeren(); toast(`Profil „${x.name}“ angewendet`); zeigen();
}
// Schickt eine Profil-Aktion an den Server, zeigt die Meldung und zeichnet neu.
async function profilSenden(pfad, werte, text) {
  try { await api("POST", pfad, werte); } catch (e) { $("#pf-meldung").innerHTML = meldung(e.message); return; }
  seitenCacheLeeren(); toast(text); zeigen();
}
// Speichert die aktuellen Regeln als eigenes Profil (auf Wunsch mit der Darstellung).
function profilSpeichern() {
  const name = $("#pf-name").value.trim();
  if (!name) { $("#pf-meldung").innerHTML = meldung("Bitte einen Namen für das Profil eingeben."); return; }
  profilSenden("/profile", {name, akzent: $("#pf-farbe").checked ? akzentFarbe(speicher.l("ho_akzent", "blau")) : "", farbe: $("#pf-farbe").checked ? speicher.l("ho_farbe", FARBE_VORGABE) : ""}, `Profil „${name}“ gespeichert`);
}
// Blendet ein Profil auf diesem Gerät aus der Auswahl aus oder wieder ein (Schalter in der Zeile).
function profilSchalten(an, feld) { const x = PROFILE[+feld.dataset.i]; if (x) profilSenden("/profile/schalten", {name: x.name, aktiv: an}, an ? `Profil „${x.name}“ eingeblendet` : `Profil „${x.name}“ ausgeblendet`); }
// Öffnet die Dateiauswahl für „Profil aus Datei übernehmen“.
function profilDateiWaehlen() { $("#pf-datei").click(); }
// Liest eine Profil-Datei (.json) und legt sie als eigenes Profil an; die Prüfung macht der Server.
async function profilImport(wert, feld) {
  const datei = feld.files[0]; feld.value = ""; if (!datei) return;
  let inhalt;
  try { inhalt = JSON.parse(await datei.text()); } catch (e) { $("#pf-meldung").innerHTML = meldung("Die Datei ist kein Profil dieser App."); return; }
  profilSenden("/profile/import", inhalt, `Profil „${typeof inhalt.name === "string" ? inhalt.name : ""}“ übernommen`);
}
// Löscht ein eigenes Profil, nach Rückfrage; die geltenden Regeln bleiben.
async function profilLoeschen(i) {
  const x = PROFILE[i]; if (!x || !(await frage(`Eigenes Profil „${x.name}“ löschen?\n\nDie geltenden Regeln ändern sich dadurch nicht.`, "Löschen", true))) return;
  profilSenden("/profile/loeschen", {name: x.name}, `Profil „${x.name}“ gelöscht`);
}
// Karte „Vorbelegung (Profile)“: feste und eigene Profile mit Anwenden, Datei und Löschen, dazu Speichern und Übernehmen aus einer Datei.
function profilKarte(bundeslaender) {
  // Zahl ohne überflüssige Nachkommastelle (std) und Minuten als hh:mm (zeit).
  const std = h => komma(h).replace(/,0$/, ""), zeit = m => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  // Kurztext der Regeln eines Profils.
  const kurz = w => [bundeslaender[w.bundesland] || w.bundesland, `${std(w.wochenstunden)} Std. ${w.arbeitstage.replace(/,/g, "/")}`, hoText(w), `${w.urlaub_tage ?? 30} Urlaubstage`, anzahl(w.gleittage_max, "Gleittag", "Gleittage"),
    `Familientage höchstens ${w.familientage_max}`, w.heiligabend_frei ? "24.12. frei" : "24.12. Arbeitstag", w.silvester_frei ? "31.12. frei" : "31.12. Arbeitstag", w.fasching_std === null ? "Fasching normaler Tag" : `Fasching ${std(w.fasching_std)} Std.`, w.himmelfahrt_frei ? "15.8. Feiertag" : "", (w.module_aus || []).length ? `${w.module_aus.length} Module aus` : "",
    ...w.pausen.map(([ab, p]) => `über ${zeit(ab)} Std. ${zeit(p)} Pause`)].filter(Boolean).join(" · ");
  return `<div class="card"><h2>Vorbelegung (Profile)</h2>
    <p class="hinweis" data-stil="margin-top:0">Ein Profil ist ein fertiger Satz Regeln, wahlweise mit einer Darstellung (Akzentfarbe, Hell oder Dunkel). „Anwenden“ setzt die Regeln ab heute; frühere Tage bleiben, wie sie sind. Die Darstellung lässt sich danach unter „Aussehen“ weiter ändern.</p>
    ${PROFILE.map((x, i) => `<div class="profil${x.aktiv ? "" : " aus"}"><div class="zeile"><span><b>${esc(x.name)}</b>${x.fest ? " <small>(fest)</small>" : ""}${x.voreinstellung ? " <small>(Voreinstellung)</small>" : ""}${x.akzent ? ` <span class="profil-farbe" data-stil="background:${x.akzent}" title="Akzentfarbe ${x.akzent}"></span>` : ""}${x.farbe ? ` <small>${({hell: "hell", dunkel: "dunkel", auto: "wie das Gerät"})[x.farbe]}</small>` : ""}<br><small>${x.aktiv ? esc(kurz(x.werte)) : "ausgeblendet"}</small></span>
      <input type="checkbox" ${x.aktiv ? "checked" : ""} data-i="${i}" data-wechsel="profilSchalten" aria-label="Profil ${esc(x.name)} zur Auswahl anbieten"></div>
      ${x.aktiv ? `<div class="knoepfe"><button type="button" ${kl("profilAnwenden", i)}>Anwenden</button><a class="btn" href="api/profile/${i}.json" aria-label="Profil ${esc(x.name)} als Datei laden">Datei</a>${x.fest ? "" : `<button type="button" ${kl("profilLoeschen", i)}>Löschen</button>`}</div>` : ""}</div>`).join("")}
    <label for="pf-name">Aktuelle Regeln als eigenes Profil speichern (vorhandener Name wird überschrieben)</label><input type="text" id="pf-name" maxlength="40" placeholder="Name des Profils" autocomplete="off">
    <div class="zeile"><span>Aktuelle Darstellung mitspeichern<br><small>Akzentfarbe, Hell oder Dunkel</small></span><input type="checkbox" id="pf-farbe" aria-label="Aktuelle Darstellung mitspeichern" checked></div>
    <div class="knoepfe"><button type="button" ${kl("profilSpeichern")}>Profil speichern</button></div>
    ${FERN ? "" : `<input type="file" id="pf-datei" accept=".json,application/json" hidden data-wechsel="profilImport">
    <div class="knoepfe"><button type="button" ${kl("profilDateiWaehlen")}>Profil aus Datei übernehmen …</button></div>`}
    <p class="hinweis">Der Schalter blendet ein Profil auf diesem Gerät aus der Auswahl aus; angewendete Regeln bleiben. Eigene Profile wandern mit der Synchronisierung auf deine anderen Geräte. Weitergeben lassen sie sich über „Datei“ und „Profil aus Datei übernehmen“.</p>
    <div id="pf-meldung" role="status"></div></div>`;
}
const WERK_TEXT = "Alle Einträge und Einstellungen werden gelöscht, auch Passwort und Synchronisierung auf diesem Gerät. Der jetzige Stand wird vorher gesichert.";
const WERK_ANDERE = "Die anderen Geräte behalten ihre Einträge. Verbindest du dieses Gerät wieder, kommen sie zurück.";
// Karte „Werkseinstellungen“ (ganz unten, Festlegung A9); nicht in der Demo und nicht über die freigegebene Oberfläche.
function werkKarte() {
  return `${(DEMO && DEMO.aktiv) || FERN ? "" : `<div class="card"><h2>Werkseinstellungen</h2>
    <p class="hinweis" data-stil="margin-top:0">Setzt die App auf Anfang. ${WERK_TEXT} ${WERK_ANDERE} Danach gelten wieder die Regeln der Voreinstellung und alle Module.</p>
    <div id="ws-fehler"></div><div class="knoepfe"><button class="gef" ${kl("werkseinstellungen")}>Alles zurücksetzen</button></div></div>`}`;
}
// Setzt die App nach Rückfrage auf Werkseinstellungen (löscht Einträge und Einstellungen; den Stand davor sichert die App). Während der Server arbeitet,
// steht eine Ladezeile in der Karte (W1); bei einem Fehler ersetzt die Meldung sie.
async function werkseinstellungen() {
  if (!(await frage(`Wirklich alles zurücksetzen?\n\n${WERK_TEXT}\n${WERK_ANDERE}`, "Alles zurücksetzen", true))) return;
  $("#ws-fehler").innerHTML = `<p class="hinweis" role="status">Bitte warten …</p>`;
  try {
    await api("POST", "/werkseinstellungen", {bestaetigt: true});
    try { Object.keys(localStorage).filter(k => k.startsWith(EIGEN + "ho_")).forEach(k => localStorage.removeItem(k)); } catch (e) {}
    seitenCacheLeeren();
    location.hash = "#/start";
    nachDemLaden(`Zurückgesetzt. Der Stand davor ist gesichert. Du kannst ihn unter ${weg("sicherung")} → Wiederherstellen herunterladen.`);
  } catch (e) { $("#ws-fehler").innerHTML = meldung(e.message); }
}
// Unterseite „Module und Profile“: lädt Regeln und Profile; Module nicht über die freigegebene Oberfläche, Werkseinstellungen ganz unten.
async function einstModule() {
  const [kf, pr] = await Promise.all([api("GET", "/konfig"), api("GET", "/profile")]);
  KONFIG = kf.werte;
  PROFILE = pr.profile;
  return (FERN ? "" : moduleKarte(kf.module || {}, kf["abgleich_allein"])) + profilKarte(kf.bundeslaender) + werkKarte();
}
// ---- seiten/einstellungen_geraete.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Einstellungen, Unterseite „Geräte und Anmeldung“: Person, Meine Geräte, Personen verwalten (nur hinter dem Anmeldedienst) und die Update-Prüfung.
// Karte „Person“ in „Einstellungen“, nur hinter dem Anmeldedienst: Der Anzeigename gehört dem Anmeldedienst (die Person hat dort eine ID), die App ändert ihn nur.
function personKarte() {
  if (!PERSON) return "";
  return `<div class="card"><h2>Person</h2>
    <label for="ps-name">Angezeigter Name (auf der Anmeldeseite und bei „Abmelden“)</label><input type="text" id="ps-name" maxlength="80" autocomplete="name" value="${esc(PERSON)}">
    <div class="knoepfe"><button type="button" ${kl("personUmbenennen")}>Namen speichern</button></div>
    <label for="ps-benutzer">Benutzername oder E-Mail-Adresse</label><input type="text" id="ps-benutzer" maxlength="80" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(BENUTZER)}">
    <div class="knoepfe"><button type="button" ${kl("benutzerAendern")}>Benutzernamen speichern</button><button type="button" ${kl("personAbmelden")}>Abmelden</button></div>
    <div id="ps-meldung" role="status"></div>
    <details class="auf"><summary>Meinen Zugang löschen</summary>
      <p class="hinweis">Dein Zugang verschwindet, deine Daten kommen in den Papierkorb des Servers. Ein Admin kann sie dort wiederherstellen oder endgültig löschen.</p>
      <label for="ps-loeschen-pw">Zur Bestätigung dein Passwort</label><input type="password" id="ps-loeschen-pw" autocomplete="current-password">
      <div class="knoepfe"><button type="button" ${kl("selbstLoeschen")}>Zugang löschen</button></div></details></div>`;
}
// Ändert den angezeigten Namen beim Anmeldedienst (eigene Person). Der Anmeldedienst prüft und meldet Fehler als Text; die Eingabe bleibt bei einem Fehler stehen.
async function personUmbenennen() {
  const name = $("#ps-name").value.trim();
  const d = await anAnmeldedienst("pfoertner/name", {name}, "Bitte einen Namen eingeben.", "Der Name ließ sich nicht ändern.");
  if (!d) return;
  PERSON = d.name || name;
  const text = `Abmelden (${PERSON})`, k = $("#abmelden-knopf"), n = $("#nav-abmelden");
  if (k) { k.setAttribute("aria-label", text); k.title = text; }
  if (n) n.innerHTML = sym("abmelden") + esc(text);
  toast("Name gespeichert");
}
// Sendet eine Änderung an den Anmeldedienst (JSON-Kopf, eigene Person) und zeigt seinen Fehlertext maskiert in der Karte; Eingaben bleiben stehen. Rückgabe: Antwort oder null.
async function anAnmeldedienst(pfad, daten, leerText, fehlerText) {
  const box = $("#ps-meldung");
  if (!Object.values(daten)[0]) { box.innerHTML = meldung(leerText); return null; }
  let r, d;
  try { r = await fetch(pfad, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(daten)}); d = await r.json().catch(() => ({})); }
  catch (e) { box.innerHTML = meldung(KEINE_VERBINDUNG); return null; }
  if (!r.ok) { box.innerHTML = meldung(d.fehler || fehlerText); return null; }
  box.innerHTML = ""; return d;
}
// Ändert den Benutzernamen (Anmeldename) beim Anmeldedienst; die Person bleibt dieselbe, weil sie an ihrer festen ID hängt.
async function benutzerAendern() {
  const benutzer = $("#ps-benutzer").value.trim().toLowerCase();
  const d = await anAnmeldedienst("pfoertner/benutzer", {benutzer}, "Bitte einen Benutzernamen eingeben.", "Der Benutzername ließ sich nicht ändern.");
  if (!d) return;
  BENUTZER = d.benutzer || benutzer; $("#ps-benutzer").value = BENUTZER;
  toast("Benutzername gespeichert");
}
// Löscht den eigenen Zugang beim Anmeldedienst (nur mit Passwort; Daten in den Papierkorb) und lädt neu: Danach kommt die Anmeldeseite.
async function selbstLoeschen() {
  if (!await frage("Deinen Zugang wirklich löschen? Du wirst abgemeldet.", "Zugang löschen", true)) return;
  const d = await anAnmeldedienst("pfoertner/selbst-loeschen", {passwort: $("#ps-loeschen-pw").value}, "Bitte dein Passwort eingeben.", "Der Zugang ließ sich nicht löschen.");
  if (!d) return;
  seitenCacheLeeren(); location.reload();
}
const NEU_ANLEGEN_OFFEN = "Offen: Wer die Anmeldeseite erreicht, kann sich selbst anlegen. Sperre das, wenn alle Personen angelegt sind.";   // U14
// Karte „Personen verwalten“ in „Einstellungen“, nur für Admins hinter dem Anmeldedienst: Liste mit Sperren, Passwort zurücksetzen, Admin-Recht, Löschen,
// dazu der Schalter für „Neu anlegen“ und der Papierkorb. Alle Rechte prüft der Anmeldedienst; die Karte zeigt nur an.
async function adminKarte() {
  if (!PERSON || !ADMIN) return "";
  let d;
  try { const r = await fetch("pfoertner/personen", {headers: {"Accept": "application/json"}}); if (!r.ok) return ""; d = await r.json(); } catch (e) { return ""; }
  const zeile = p => `<div class="profil"><div class="zeile"><span>${esc(p.anzeige)} <small>${esc(p.benutzer)}${p.admin ? " · Admin" : ""}${p.gesperrt ? " · gesperrt" : ""}${p.passwort_offen ? " · Passwort offen" : ""}${Number(p.geraete) ? ` · ${anzahl(Number(p.geraete), "Gerät", "Geräte")}` : ""}</small></span></div>
    <div class="knoepfe"><button type="button" ${kl("adminSperren", p.id, !p.gesperrt)}>${p.gesperrt ? "Entsperren" : "Sperren"}</button><button type="button" ${kl("adminPasswort", p.id, p.anzeige)}>Passwort zurücksetzen</button>
    <button type="button" ${kl("adminRolle", p.id, !p.admin)}>${p.admin ? "Admin-Recht nehmen" : "Zum Admin machen"}</button><button type="button" ${kl("adminLoeschen", p.id, p.anzeige)}>Löschen</button></div></div>`;
  const korb = (d.papierkorb || []).map((k, i) => `<div class="profil"><div class="zeile"><span>${esc(k.name)} <small>${esc(korbDatum(k.datum))} · ${esc(korbGroesse(k.groesse))}</small></span></div>
    <label for="pk-b-${i}">Benutzername beim Wiederherstellen</label><input type="text" id="pk-b-${i}" maxlength="80" autocapitalize="none" spellcheck="false">
    <div class="knoepfe"><button type="button" ${kl("adminPapierkorbZurueck", k.name, i)}>Wiederherstellen</button><button type="button" ${kl("adminPapierkorbLeeren", k.name)}>Endgültig löschen</button></div></div>`).join("");
  return `<div class="card"><h2>Personen verwalten</h2>
    ${(d.personen || []).map(zeile).join("")}
    <div class="zeile"><span>„Neu anlegen“ auf der Anmeldeseite</span><button type="button" ${kl("adminNeuAnlegen", !d.neu_anlegen_offen)}>${d.neu_anlegen_offen ? "Sperren" : "Freigeben"}</button></div>
    ${d.neu_anlegen_offen ? `<p class="hinweis">${NEU_ANLEGEN_OFFEN}</p>` : ""}
    <h3 class="unter">Papierkorb</h3>${korb || `<p class="hinweis">Der Papierkorb ist leer.</p>`}
    <div id="ad-meldung" role="status"></div></div>`;
}
// Karte „Meine Geräte“, nur hinter dem Anmeldedienst: Desktop- und Android-Apps, die mit diesem Server synchronisieren. Entfernen macht ihren Schlüssel sofort ungültig.
async function geraeteKarte() {
  if (!PERSON) return "";
  let d, fehler = "";
  try { const r = await fetch("pfoertner/geraete", {headers: {"Accept": "application/json"}}); d = await r.json().catch(() => ({})); if (!r.ok) fehler = d.fehler || GERAETE_FEHLER; }
  catch (e) { fehler = KEINE_VERBINDUNG; }
  const liste = fehler ? meldung(fehler) : (d.geraete || []).map(g => `<div class="zeile"><span>${esc(g.name)}<br><small>angemeldet seit ${esc(geraetSeit(g.seit))}</small></span><button type="button" ${kl("geraetEntfernen", g.id, g.name)}>Entfernen</button></div>`).join("")
    || `<p class="hinweis">Noch kein Gerät angemeldet. In der Desktop- oder Android-App unter „Synchronisieren“ die Adresse dieses Servers mit Benutzername und Passwort eintragen.</p>`;
  return `<div class="card"><h2>Meine Geräte</h2><p class="hinweis" data-stil="margin-top:0">Diese Geräte tauschen deine Daten mit diesem Server aus. Ein neues Passwort meldet alle ab.</p>${liste}<div id="gr-meldung" role="status"></div></div>`;
}
const GERAETE_FEHLER = "Die Geräte ließen sich nicht laden.";
// Datum vom Anmeldedienst (JJJJ-MM-TT) deutsch als TT.MM.JJJJ.
const geraetSeit = d => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(d)); return m ? `${m[3]}.${m[2]}.${m[1]}` : String(d); };
// Entfernt ein eigenes Gerät beim Anmeldedienst, nach Rückfrage; das Gerät muss sich danach neu anmelden.
async function geraetEntfernen(id, name) {
  if (await frage(`${name} entfernen? Das Gerät synchronisiert erst nach einer neuen Anmeldung wieder.`, "Entfernen", true)) adminSenden("pfoertner/geraet-entfernen", {id}, "Gerät entfernt", "#gr-meldung");
}
// Papierkorb: Datum vom Anmeldedienst (JJJJ-MM-TTTHH:MM) deutsch als TT.MM.JJJJ HH:MM.
const korbDatum = d => { const m = /^(\d{4})-(\d\d)-(\d\d)T(\d\d:\d\d)/.exec(String(d)); return m ? `${m[3]}.${m[2]}.${m[1]} ${m[4]}` : String(d); };
// Papierkorb: Größe in Bytes deutsch als KB oder MB mit Komma; geschütztes Leerzeichen, damit die Einheit nicht allein umbricht.
const korbGroesse = b => { const n = Number(b) || 0; return n >= 1048576 ? `${komma((n / 1048576).toFixed(1))} MB` : `${Math.max(1, Math.round(n / 1024))} KB`; };
// Schickt eine Aktion an den Anmeldedienst und zeichnet die Seite danach neu; Fehlertexte des Anmeldedienstes erscheinen maskiert im Meldungsfeld der Karte (box).
// Liefert der Anmeldedienst einen Einmal-Code (Kopf CODE_KOPF, nach Zurücksetzen und Wiederherstellen), zeigt das Blatt ihn danach einmal für wer.
async function adminSenden(pfad, daten, erfolg, box = "#ad-meldung", wer = "") {
  let r, d;
  try { r = await fetch(pfad, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(daten)}); d = await r.json().catch(() => ({})); }
  catch (e) { $(box).innerHTML = meldung(KEINE_VERBINDUNG); return; }
  if (!r.ok) { $(box).innerHTML = meldung(d.fehler || "Das ging nicht."); return; }
  const code = r.headers.get(CODE_KOPF);
  toast(d.hinweis ? `${erfolg}. ${d.hinweis}` : erfolg); await zeigen();
  if (code) codeBlatt(erfolg, wer, code);
}
// Kopf mit dem Einmal-Code (anmeldedienst.py CODE_KOPF); der Körper bleibt {"ok": true}, damit ältere Apps nicht brechen.
const CODE_KOPF = "X-Zeiterfassung-Code";
// Zeigt den Einmal-Code einmal im Blatt mit Kopierknopf. Der Code kommt nur per textContent ins Blatt; jedes Schließen (Fertig, Esc, Tipp daneben) leert es,
// damit er nicht unsichtbar im DOM bleibt. Ohne den Code kann die Person nach dem Zurücksetzen kein Passwort festlegen.
function codeBlatt(titel, wer, code) {
  blatt(`<h3>${esc(titel)}</h3>${wer ? `<p class="hinweis">${esc(wer)}</p>` : ""}<p>Einmal-Code für die Person:</p><p class="ad-code" id="ad-code"></p>
    <p>Sie braucht ihn beim nächsten Anmelden. Nach dem Schließen zeigt die App den Einmal-Code nicht noch einmal.</p>
    <div class="knoepfe"><button type="button" class="prim" id="ad-code-kopieren" aria-label="Code kopieren">Kopieren</button><button type="button" id="ad-code-fertig">Fertig</button></div>`);
  $("#ad-code").textContent = code;
  $("#ad-code-kopieren").onclick = codeKopieren;
  $("#ad-code-fertig").onclick = blattZu;
  blattZuRueck = () => { $("#blatt-inh").replaceChildren(); return false; };
}
// Kopiert den Einmal-Code; ohne Zugriff auf die Zwischenablage (Seite nicht über HTTPS) wird er markiert, damit die Person ihn selbst kopiert.
async function codeKopieren() {
  try { await navigator.clipboard.writeText($("#ad-code").textContent); toast("Code kopiert"); }
  catch (e) { getSelection().selectAllChildren($("#ad-code")); toast("Kopieren ging nicht. Der Code ist markiert, bitte selbst kopieren."); }
}
// Löscht eine Person (Dienst stoppt, Daten in den Papierkorb), nach Rückfrage.
async function adminLoeschen(id, name) {
  if (await frage(`${name} löschen? Der Zugang verschwindet, die Daten kommen in den Papierkorb.`, "Löschen", true)) adminSenden("pfoertner/admin/loeschen", {id}, "Gelöscht");
}
// Setzt das Passwort einer Person auf „beim nächsten Anmelden festlegen“ (der Admin sieht nie ein Passwort, nur den Einmal-Code dafür).
async function adminPasswort(id, wer) { adminSenden("pfoertner/admin/passwort-zuruecksetzen", {id}, "Passwort zurückgesetzt", undefined, wer); }
// Sperrt oder entsperrt eine Person, ohne Daten zu löschen.
async function adminSperren(id, gesperrt) { adminSenden("pfoertner/admin/sperren", {id, gesperrt}, gesperrt ? "Gesperrt" : "Entsperrt"); }
// Gibt oder nimmt das Admin-Recht (den letzten Admin schützt der Anmeldedienst).
async function adminRolle(id, admin) { adminSenden("pfoertner/admin/rolle", {id, admin}, admin ? "Ist jetzt Admin" : "Admin-Recht genommen"); }
// Schaltet „Neu anlegen“ auf der Anmeldeseite frei oder sperrt es.
async function adminNeuAnlegen(offen) { adminSenden("pfoertner/admin/neu-anlegen", {offen}, offen ? "Neu anlegen ist frei" : "Neu anlegen ist gesperrt"); }
// Löscht einen Eintrag im Papierkorb endgültig, nach Rückfrage.
async function adminPapierkorbLeeren(name) {
  if (await frage(`${name} endgültig löschen? Das lässt sich nicht rückgängig machen.`, "Endgültig löschen", true)) adminSenden("pfoertner/admin/papierkorb/leeren", {name}, "Endgültig gelöscht");
}
// Stellt einen Eintrag aus dem Papierkorb als neue Person wieder her (Passwort mit Einmal-Code beim ersten Anmelden).
async function adminPapierkorbZurueck(name, i) {
  const benutzer = ($(`#pk-b-${i}`).value || "").trim().toLowerCase();
  if (!benutzer) { $("#ad-meldung").innerHTML = meldung("Bitte einen Benutzernamen eingeben."); return; }
  adminSenden("pfoertner/admin/papierkorb/zurueck", {name, benutzer}, "Wiederhergestellt", undefined, benutzer);
}
// Karte „Neue Version“: Schalter der Update-Prüfung je Gerät, nur in der Windows- und der Android-App (u.verfuegbar); die Abfrage macht nur der Server.
function updateKarte(u) {
  if (!u || !u.verfuegbar) return "";
  const stand = u.zuletzt ? `Zuletzt gefragt am ${esc(geraetSeit(u.zuletzt))}${u.neueste ? `, neueste Version ${esc(u.neueste)}` : ""}.` : "Noch nicht gefragt.";
  return `<div class="card"><h2>Neue Version</h2>
    <div class="zeile"><span>Alle 30 Tage nach einer neuen Version fragen<br><small>bei GitHub, ohne Download; diese Version: ${esc(u.eigene)}</small></span><input type="checkbox" id="up-an" ${u.an ? "checked" : ""} aria-label="Alle 30 Tage nach einer neuen Version fragen"></div>
    <p class="hinweis">${stand}${u.neuer ? " Es gibt eine neuere Version. Die Übersicht zeigt den Hinweis unter „Zu tun“." : ""}</p><div id="up-fehler"></div></div>`;
}
// Schaltet die Update-Prüfung dieses Geräts; bei einem Fehler springt der Schalter zurück.
async function updateSchalten(feld) {
  const an = feld.checked;
  try { await api("PUT", "/update", {an}); toast(an ? "Update-Prüfung an" : "Update-Prüfung aus"); }
  catch (e) { feld.checked = !an; $("#up-fehler").innerHTML = meldung(e.message); }
}
const GERAETE_LEER = "Hier stehen Anmeldung und Geräte, wenn die App über einen Server mit Anmeldung läuft.";   // A11: die Unterseite bleibt in der Liste
// Unterseite „Geräte und Anmeldung“: Person, Meine Geräte und Personen verwalten (Anmeldedienst), dazu die Update-Prüfung; sonst der Hinweis.
async function einstGeraete() {
  const update = updateKarte(await api("GET", "/update").catch(() => null));   // die Web-App ohne Datenordner kennt die Route nicht
  const html = personKarte() + await geraeteKarte() + await adminKarte() + update;
  einstBinden({"up-an": ["change", updateSchalten]});
  return html || `<div class="card"><p class="hinweis" data-stil="margin-top:0">${GERAETE_LEER}</p></div>`;
}
// ---- seiten/tag.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// ---- Tag (Reiter im Bereich Zeit): Kopf ‹ Datum › mit Kalender und „Heute“, darunter die Karte des Tages und seine Einträge.
// Die Werte kommen aus GET /woche (nur dort gibt es Ist, Soll und Saldo je Tag). Am Handy öffnet „Bearbeiten“ das Blatt, am Rechner steht das Formular daneben.
async function seiteTag() {
  const d = zeitAnkommen(), [kj, kw] = kwJahr(isoZuDatum(d)), bearbeiten = zeitParameter(hashTeile(), zeitHeuteIso()).bearbeiten;
  const w = await api("GET", `/woche/${kj}/${kw}`);
  window.monatDaten = {tage: w.tage}; window.famAktiv = w.familientage_aktiv;   // tagBearbeiten liest den Tag von hier
  window.nachher = () => { zeitSpalte(); if (bearbeiten) zeitBearbeitenOeffnen(d); };
  const t = w.tage.find(z => z.datum === d), heuteIso = zeitHeuteIso(), istHeute = d === heuteIso;
  const titel = istHeute ? `Heute, ${t.wt} ${t.tag}.` : `${t.wt} ${d.slice(8)}.${d.slice(5, 7)}.`;
  const knoepfe = zeitDaneben() ? "" : `<div class="schnell"><button class="prim" ${kl("tagBearbeiten", d)}>Bearbeiten</button>${istHeute ? `<button${md("stempel")} ${kl("stempelBlatt")}>Stempeluhr</button>` : ""}</div>`;
  return `<div class="kopf"><button ${kl("zeitBlaettern", -1)} aria-label="Vorheriger Tag">‹</button><h2>${t.wt} ${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}</h2>
    <div class="kopf-rechts"><span class="kal-wahl"><button type="button" ${kl("zeitKalender", "#t-kal")} aria-label="Tag im Kalender wählen">${sym("monat")}</button><input id="t-kal" type="date" value="${d}" ${ZEIT_KAL_GRENZEN} data-wechsel="zeitKalenderDatum" tabindex="-1" aria-hidden="true"></span><button class="heute-knopf" ${kl("zeitHeute")}>Heute</button><button ${kl("zeitBlaettern", 1)} aria-label="Nächster Tag">›</button></div></div>
    ${zeitLeerHtml(w.tage)}${tagKarteHtml(t, saldoKlasse, titel)}
    <div class="card">${tagZeileHtml(t, heuteIso, saldoKlasse)}</div>${knoepfe}`;
}
// ---- seiten/sondertage.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Reiter „Sondertage“: Zähler für Sonderurlaub und Kind krank je Jahr. Das Limit für Kind krank kommt aus der API (Regel kind_krank_max)
// und wird in den Einstellungen geändert, nicht hier.
const LIMIT_WEG = "#/einstellungen/arbeitszeit";
// Seite „Sondertage“: je Modul eine Karte; Werte nur aus GET /api/urlaub/<Jahr>.
async function seiteSondertage() {
  const u = await api("GET", `/urlaub/${jahr}`);
  // Zeile mit Titel und Wert.
  const z = (t, v, k = "") => `<div class="zeile gr"><span>${t}</span><b class="${k}">${v}</b></div>`;
  const start = u.kind_krank_start ? `<p class="hinweis">davon ${u.kind_krank_start} aus Startwerten</p>` : "";
  const voll = u.kind_krank_rest === 0 ? `<p class="hinweis">Das Limit für ${jahr} ist erreicht.</p>` : "";
  return `<div class="gitter"><div class="card"${md("sonderurlaub")}><h2>Sonderurlaub ${jahr}</h2>${z("Verbraucht", u.sonderurlaub)}
      <p class="hinweis">Sonderurlaub trägst du am Tag über „Art des Tages“ ein oder planst ihn unter Urlaub.</p></div>
    <div class="card"${md("kind_krank")}><h2>Kind krank ${jahr}</h2>${z("Verbraucht", u.kind_krank)}${start}
      ${z("Verfügbar", `noch ${u.kind_krank_rest} von ${u.kind_krank_max}`, u.kind_krank_rest === 0 ? "rot" : "")}${voll}
      <div class="knoepfe"><a class="btn" href="${LIMIT_WEG}">Limit ändern</a></div></div></div>`;
}
// ---- seiten/monatsnachweis.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Seite „Monatsnachweis“ (funktionen.md 3): Monatswahl, Schalter „mit Beginn und Ende“, Vorschau aus GET /api/monatsnachweis/<J>/<M>, PDF und Word.
// Der Monat steht in der Adresse (#/monatsnachweis/J/M, geprüft von zeitParameter); ohne Angabe gilt der aktuelle Monat.
const NACHWEIS_ZEITEN = "ho_nachweis_zeiten";                     // Schalter je Gerät (Speicher), ab Werk aus
const NACHWEIS_ANGABEN = [["name", "Name"], ["arbeitgeber", "Arbeitgeber"], ["personalnummer", "Personalnummer"]];        // dokument.NACHWEIS_ANGABEN
const NACHWEIS_UNTERSCHRIFT = ["Datum: ____________________", "Unterschrift: ______________________________"];         // dokument.NACHWEIS_UNTERSCHRIFT
// Merkt den Schalter „mit Beginn und Ende“ auf diesem Gerät und zeichnet neu.
function nachweisZeitenSchalten(an) { speicher.s(NACHWEIS_ZEITEN, an ? "1" : ""); zeigen(); }
// Öffnet den gewählten Monat („JJJJ-MM“) über die Adresse.
function nachweisMonatWaehlen(w) { location.hash = `#/monatsnachweis/${+w.slice(0, 4)}/${+w.slice(5)}`; }
// „Heute“: aktueller Monat (die Adresse ohne Monat; steht sie schon da, nur neu zeichnen).
function nachweisHeute() { if (location.hash === "#/monatsnachweis") zeigen(); else location.hash = "#/monatsnachweis"; }
// Monate „JJJJ-MM“ der Wahl, neueste zuerst: vom späteren aus heute und gewähltem Monat bis zum früheren aus erstem Eintrag und gewähltem Monat.
function nachweisMonate(erster, gewaehlt) {
  const text = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, heuteM = text(heute), liste = [];
  const neu = [heuteM, gewaehlt].sort().pop(), alt = [erster || heuteM, gewaehlt].sort()[0];
  for (const d = new Date(+neu.slice(0, 4), +neu.slice(5) - 1, 1, 12); text(d) >= alt; d.setMonth(d.getMonth() - 1)) liste.push(text(d));
  return liste;
}
// Karte oben: Monatswahl mit „Heute“, Schalter, Knöpfe PDF und Word (nach den Modulen), Hinweis bei leerem Kopf.
function nachweisWahl(j, m, mz, erster, kopfLeer) {
  const gewaehlt = `${j}-${pad(m)}`, pfad = `api/monatsnachweis/${j}/${m}${mz ? "/mit-zeiten" : ""}`, titel = `Monatsnachweis ${MONATE[m - 1]} ${j}`;
  const knoepfe = [["PDF", "pdf", "ex_pdf"], ["Word", "docx", "ex_office"]].filter(([, , mod]) => modulAn(mod));
  return `<section class="card" aria-labelledby="mn-titel"><h2 id="mn-titel">Monatsnachweis</h2>
    <label for="mn-monat">Monat</label><div class="feld-heute"><select id="mn-monat" data-wechsel="nachweisMonatWaehlen">${nachweisMonate(erster, gewaehlt).map(w => `<option value="${w}"${w === gewaehlt ? " selected" : ""}>${MONATE[+w.slice(5) - 1]} ${w.slice(0, 4)}</option>`).join("")}</select><button type="button" class="heute-knopf" ${kl("nachweisHeute")}>Heute<span class="sr">: aktueller Monat</span></button></div>
    <label class="zeile" for="mn-zeiten"><span><span id="mn-zeiten-n">mit Beginn und Ende</span><br><small id="mn-zeiten-h">nimmt Kommen, Gehen und Pause dazu</small></span>
      <input type="checkbox" id="mn-zeiten" aria-labelledby="mn-zeiten-n" aria-describedby="mn-zeiten-h" data-wechsel="nachweisZeitenSchalten"${mz ? " checked" : ""}></label>
    ${kopfLeer ? `<p class="hinweis">Name, Arbeitgeber und Personalnummer trägst du unter <a href="#/einstellungen/person">${esc(weg("einstellungen", "person"))}</a> ein.</p>` : ""}
    ${knoepfe.length ? `<div class="knoepfe">${knoepfe.map(([n, e], i) => `<a class="btn${i ? "" : " prim"}" href="${pfad}.${e}" aria-label="${esc(`${titel} als ${n}`)}">${n}</a>`).join("")}</div>` : ""}</section>`;
}
// Vorschau wie das Dokument: Titel, Kopf, alle Tage (frei = grau), Summen, Datum und Unterschrift. Texte vom Server alle maskiert.
function nachweisVorschau(n, mz) {
  const spalten = mz ? ["Tag", "Kommen", "Gehen", "Pause", "Stunden", "Anmerkung"] : ["Tag", "Stunden", "Anmerkung"];   // dokument.NACHWEIS_SPALTEN(_ZEITEN)
  const tag = t => `<tr${t.frei ? ' class="frei"' : ""}><td>${+t.tag}. ${esc(t.wt)}</td>${mz ? `<td>${esc(t.kommen)}</td><td class="geh">${esc(t.gehen)}</td><td>${esc(t.pause)}</td>` : ""}<td>${esc(t.stunden)}</td><td class="anm">${esc(t.anmerkung)}</td></tr>`;
  const s = n.summe, summen = [["Arbeitsstunden gesamt", s.stunden], ["Urlaubstage", s.urlaub], ["Gleittage", s.gleittage], ["Freizeitausgleich (Tage)", s.freizeit]];
  const tabelle = (name, kopf, zeilen, extra = "") => `<div class="tbl"><table class="nachweis${extra}" aria-label="${esc(name)}"><thead><tr>${kopf.map(k => `<th scope="col"${k === "Anmerkung" || k === "Wert" ? ' class="anm"' : ""}>${k}</th>`).join("")}</tr></thead><tbody>${zeilen}</tbody></table></div>`;
  return `<section class="card" aria-labelledby="mn-vorschau"><h2 id="mn-vorschau">Vorschau</h2>
    <h3 class="nachweis-titel">Monatsnachweis ${MONATE[n.monat - 1]} ${n.jahr}</h3><p class="nachweis-datum">Erstellt am ${pad(heute.getDate())}.${pad(heute.getMonth() + 1)}.${heute.getFullYear()}</p>
    ${tabelle("Angaben", ["Angabe", "Wert"], NACHWEIS_ANGABEN.map(([k, t]) => `<tr><td>${t}</td><td class="anm">${esc(n.kopf[k])}</td></tr>`).join(""))}
    ${tabelle(`Tage ${MONATE[n.monat - 1]} ${n.jahr}`, spalten, n.tage.map(tag).join(""), mz ? " mit-zeiten" : "")}
    ${tabelle("Summen", ["Summe", "Wert"], summen.map(([t, w]) => `<tr><td>${t}</td><td class="anm">${esc(w)}</td></tr>`).join(""))}
    ${NACHWEIS_UNTERSCHRIFT.map(t => `<p class="nachweis-zeichen">${t}</p>`).join("")}</section>`;
}
// Seite „Monatsnachweis“: Monat aus der Adresse; ohne Eintrag im Monat der Leerzustand mit dem Weg zum Eintragen.
async function seiteMonatsnachweis() {
  const von = zeitParameter(hashTeile(), zeitHeuteIso()).von, j = +von.slice(0, 4), m = +von.slice(5, 7), mz = speicher.l(NACHWEIS_ZEITEN, "") === "1";
  const [{monate}, n] = await Promise.all([api("GET", "/zeitraeume"), api("GET", `/monatsnachweis/${j}/${m}`)]);
  const wahl = nachweisWahl(j, m, mz, monate[monate.length - 1], NACHWEIS_ANGABEN.every(([k]) => !n.kopf[k]));
  if (!monate.includes(`${j}-${pad(m)}`)) return wahl + `<section class="card"><div class="leer">Noch keine Einträge in diesem Monat.</div><div class="knoepfe"><a class="btn prim" href="#/monat/${j}/${m}">Tag eintragen</a></div></section>`;
  return wahl + nachweisVorschau(n, mz);
}
// ---- seiten/hilfe_leicht.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Hilfe in Leichter Sprache (Auftrag 18.11.2026; Schalter oben auf der Hilfe-Seite). Nicht von einer Prüf-Gruppe geprüft.
// Nur feste Texte, keine Daten. Erlaubtes HTML: <p>, <ul>, <ol>, <li>, <b>. Gleiche Schlüssel und gleiche Platzhalter wie HILFE_NORMAL in seiten/hilfe.js.
// Platzhalter {name} setzt seiteHilfe mit esc() ein; {weg_<seite>} und {weg_<seite>_<unterseite>} sind weg(seite, unterseite) (bausteine/bereiche.js).
// Regeln: kurze Sätze (höchstens 15 Wörter), Wörter wie in der App, Wörter ohne Trenn-Bindestrich, schwierige Wörter erklärt.
const HILFE_LEICHT = {
  zweck: {titel: "Wofür ist die App da?", text: `<p>Mit der App schreibst du auf, wo du arbeitest.</p><ul><li>Homeoffice heißt: Du arbeitest zu Hause.</li><li>Büro heißt: Du arbeitest nicht zu Hause, sondern an deinem Arbeitsplatz.</li></ul><p>Die App rechnet daraus:</p><ul><li>die Homeoffice-Quote, wenn für dich eine gilt</li><li>die Gleitzeit</li><li>deinen Urlaub</li><li>deine Krankheitstage</li><li>die Homeoffice-Übersicht</li></ul><p>Alle Daten liegen in deiner eigenen Datenbank.</p><p>Du brauchst kein Benutzerkonto. Es gibt keine Cloud.</p>`},
  anfang: {titel: "So fängst du an", text: `<p>Beim ersten Start fragt die App: Nutzt du die App schon auf einem anderen Gerät?</p><ul><li>Ja: Dann holst du deine Daten von dem anderen Gerät.</li><li>Nein: Dann fängst du neu an.</li></ul><p>Du fängst neu an? Dann wählst du eine Vorlage. Eine Vorlage ist ein fertiger Satz Regeln.</p><ul><li><b>Nur Zeiterfassung:</b> Du willst nur deine Arbeitszeit aufschreiben.</li><li><b>Mit Homeoffice-Grenze:</b> Du darfst nur einen Teil der Zeit im Homeoffice arbeiten.</li><li><b>Büro + Homeoffice:</b> Wie die Vorlage davor, mit Regeln für Bayern.</li></ul><p>Danach fragt die App:</p><ol><li>dein Bundesland</li><li>deine Stunden pro Woche und deine Arbeitstage</li><li>deine Grenze für Homeoffice, wenn du eine hast</li><li>deine Urlaubstage im Jahr</li></ol><p>Du willst nicht weitermachen? Dann tippe auf „Überspringen“. Dann gelten die Regeln von der Vorlage. Du kannst sie später ändern.</p><p>Am Ende tippst du auf „Fertig“. Dann zeigt dir die App die wichtigsten Teile. Das nennt man Rundgang.</p>`},
  aufbau: {titel: "So ist die App aufgebaut", text: `<p>Die App hat 8 Bereiche:</p><ul><li><b>Übersicht</b></li><li><b>Zeit</b></li><li><b>Homeoffice</b></li><li><b>Abwesenheit</b></li><li><b>Auswertung</b></li><li><b>Daten</b></li><li><b>Einstellungen</b></li><li><b>Hilfe</b></li></ul><p>Manche Bereiche haben oben Reiter. Ein Reiter ist wie eine Karteikarte. Ein Beispiel: Der Bereich Zeit hat die Reiter Tag, Woche und Monat.</p><p>Am Handy siehst du unten 5 Knöpfe:</p><ul><li>Übersicht</li><li>Zeit</li><li>die Plus-Taste in der Mitte</li><li>Homeoffice</li><li>Abwesenheit</li></ul><p>Die anderen Bereiche findest du oben im Menü. Am Rechner stehen alle Bereiche links.</p><p>Büro heißt: dein Arbeitsplatz bei der Arbeit.</p><p>Im Bereich Zeit kannst du blättern. Tippe dazu auf ‹ oder ›. Am Handy kannst du auch nach links oder rechts wischen. „Heute“ bringt dich zum heutigen Tag.</p>`},
  buchen: {titel: "So schreibst du deine Zeit auf", text: `<p>Du kommst zur Arbeit. Dann tippst du auf die Plus-Taste. Oder auf „Kommen“ in der Übersicht.</p><p>Du gehst nach Hause. Dann tippst du wieder auf die Plus-Taste. Oder auf „Gehen“.</p><p>Die App zählt die Zeit dazwischen. Die Pause zieht sie selbst ab.</p><p>Du hast etwas vergessen? Dann öffne <b>{weg_monat}</b>. Tippe auf den Tag. Trage die Zeit nach.</p>`},
  plus_taste: {titel: "Die Plus-Taste", text: `<p>Die Plus-Taste ist unten in der Mitte. Mit ihr stempelst du. Stempeln heißt: Du sagst der App, wann du anfängst oder aufhörst.</p><p><b>Du fängst an:</b></p><ol><li>Tippe auf die Plus-Taste.</li><li>Die App fragt: Homeoffice oder Büro?</li><li>Tippe auf deinen Ort. Jetzt läuft die Uhr.</li></ol><p><b>Du hörst auf:</b></p><ul><li>Tippe einmal auf die Taste.</li><li>Die App trägt das Ende ein. Das Ende ist jetzt.</li><li>Die Pause rechnet die App selbst.</li><li>Ein Fehler? Tippe gleich danach auf „Rückgängig“.</li></ul><p>Das Bild auf der Taste zeigt dir, was als Nächstes kommt.</p>`},
  tag_blatt: {titel: "Einen Tag schnell eintragen", text: `<p>Tippe auf einen Tag. Oben siehst du große Knöpfe. Zum Beispiel: Homeoffice, Büro, Urlaub, Krank.</p><p>Ein Tipp auf einen Knopf trägt den ganzen Tag ein. Die App nimmt dafür deine normale Zeit für diesen Tag. Danach geht das Fenster zu.</p><p>Du willst mehr eintragen? Dann öffne <b>Einzelheiten</b>. Dort stehen zum Beispiel:</p><ul><li>Kommen und Gehen</li><li>Pause</li><li>Notiz</li><li>Vermerk, zum Beispiel Dienstreise</li></ul><p>Ein Vermerk ist ein kurzer Hinweis zum Tag.</p><p>Am Rechner steht der Tag rechts neben dem Kalender. Du hast etwas geändert? Dann fragt die App, bevor du den Tag wechselst. Tippe auf „Abbrechen“. Dann bleiben deine Eingaben stehen.</p>`},
  rueckgaengig: {titel: "Etwas rückgängig machen", text: `<p>Rückgängig heißt: Du nimmst deinen letzten Schritt zurück.</p><p>Nach dem Speichern erscheint unten eine Leiste. Dort steht zum Beispiel: „Gespeichert.“ Daneben ist der Knopf <b>Rückgängig</b>.</p><ul><li>Die Leiste bleibt 10 Sekunden.</li><li>Tippe in dieser Zeit auf „Rückgängig“.</li><li>Dann ist alles wieder wie vorher.</li></ul><p>Das geht nach diesen Schritten:</p><ul><li>einen Tag speichern oder leeren</li><li>Urlaub planen oder einen Plan löschen</li><li>Gehen mit der Plus-Taste</li></ul><p>Es geht nur für den letzten Schritt. Am Rechner geht es auch mit den Tasten <b>Strg</b> und <b>Z</b>.</p>`},
  monat_raster: {titel: "Der Monat als Kalender", text: `<p>Der Monat sieht aus wie ein Kalender. Jeder Tag hat eine Farbe. Dazu hat jeder Tag einen Buchstaben oder ein Zeichen. So erkennst du den Tag auch ohne Farbe.</p><p>Unter dem Kalender steht, was die Buchstaben bedeuten. Darunter stehen die Zahlen für den Monat.</p><p>Du willst lieber eine Liste? Dann tippe auf <b>Liste</b>. Die App merkt sich das.</p><p>Tippe auf einen Tag. Dann kannst du ihn ändern.</p>`},
  zeitformat: {titel: "Stunden mit Doppelpunkt oder Komma", text: `<p>Du kannst wählen, wie die App Stunden zeigt.</p><ul><li>Mit Doppelpunkt: 7:30 heißt 7 Stunden und 30 Minuten.</li><li>Mit Komma: 7,50 heißt auch 7 Stunden und 30 Minuten.</li></ul><p>Das stellst du bei <b>{weg_einstellungen_aussehen}</b> ein. Es gilt für die ganze App.</p><p>Die App rechnet immer genau in Minuten. Sie rundet erst ganz am Ende.</p>`},
  homeoffice_modus: {titel: "Homeoffice: mit Grenze, ohne Grenze, kein Homeoffice oder nur Homeoffice", text: `<p>Öffne <b>{weg_einstellungen_arbeitszeit}</b>. Dort stellst du ein, was für dich gilt.</p><p>Jetzt eingestellt: <b>{ho_modus}</b></p><ul><li><b>Mit Grenze:</b> Für dich gibt es eine Obergrenze für Homeoffice. Die App rechnet deine Homeoffice-Quote. Sie zeigt die Grenze am Ring. Sie warnt dich, wenn du über die Grenze kommst. Sie zeigt dir den Spielraum.</li><li><b>Ohne Grenze:</b> Du trägst Homeoffice und Büro ein. Die Quote zeigt die App nur zur Information. Es gibt keine Warnung. Es gibt keinen Spielraum.</li><li><b>Kein Homeoffice:</b> Du hast nur ein Feld für die Zeit. Das Feld heißt Büro. Die App zeigt keine Quote, keinen Spielraum und keine Homeoffice-Übersicht.</li><li><b>Nur Homeoffice:</b> Du hast nur ein Feld für die Zeit. Das Feld heißt Homeoffice. Es gibt keine Quote und keinen Spielraum. Die Homeoffice-Übersicht bleibt.</li></ul><p>Eine Änderung gilt ab heute. Oder ab einem Datum, das du wählst. Oder rückwirkend, also auch für die Zeit davor.</p><p>Die Zeiten, die du schon eingetragen hast, bleiben.</p>`},
  quote: {titel: "Was ist die Homeoffice-Quote? Was ist die Grenze?", text: `<p>Die Quote sagt dir, wie viel du im Homeoffice arbeitest.</p><p>Ein Beispiel: Die Grenze ist 80 %. 80 % heißt: 8 von 10 Stunden. Du darfst also 8 von 10 Stunden im Homeoffice arbeiten.</p><p>Für dich gilt eine Grenze von <b>{grenze} %</b>. Genau {grenze} % sind noch erlaubt. Erst darüber wird es rot.</p><p>Du warst an einem Tag im Homeoffice und im Büro? Dann zählt der Tag als Büro-Tag.</p>`},
  spielraum: {titel: "Was zeigt der Spielraum?", text: `<p>Der Spielraum zeigt dir: So viel Homeoffice-Zeit kannst du noch dazunehmen. Dann bleibst du unter {grenze} %.</p><p>Die App nimmt an: An den übrigen Tagen arbeitest du so viel, wie du sollst. Das ist die Sollzeit.</p><p>Dazu gibt es die <b>Jahres-Prognose</b>. Eine Prognose sagt voraus, was später wohl kommt.</p><ul><li>Du wählst: An wie vielen ganzen Tagen pro Woche bist du im Büro?</li><li>Bei „Automatisch“ nimmt die App so viele Büro-Tage pro Woche wie bisher im Schnitt. Bei Teilzeit rechnet sie mit deinen Arbeitstagen.</li><li>Eine Woche mit Feiertag oder Urlaub zählt nur anteilig.</li><li>„Bei diesem Tempo“ ist das Ergebnis von „Automatisch“.</li><li>Die App zeigt dir die Quote, die du zum Jahresende wohl hast.</li></ul><p>Im Monat ist die Jahres-Prognose zugeklappt. Tippe darauf. Dann klappt sie auf.</p>`},
  urlaub: {titel: "Urlaub und angesparter Urlaub", text: `<p>Urlaub, den du nicht genommen hast, nimmt die App automatisch mit ins nächste Jahr. Das ist der Resturlaub.</p><p>Du kannst den Resturlaub von Hand ändern. Das geht unter <b>{urlaub} → Erweitert</b>.</p><p>Angesparter Urlaub ist Urlaub, den du für später aufhebst.</p><ul><li>Die App führt dafür ein Konto je Jahr, aus dem der Urlaub kommt.</li><li>Du nimmst ihn mit der Art „Angesparter Urlaub“.</li></ul><p>Es gibt keine halben Urlaubstage.</p>`},
  sondertage: {titel: "Sonderurlaub und Kind krank", text: `<p>Das sind 2 besondere Arten von freien Tagen. Du bekommst dafür einen ganzen Tag frei.</p><ul><li><b>Sonderurlaub</b> bekommst du zum Beispiel für deine Hochzeit. Oder für einen Umzug.</li><li><b>Kind krank</b> nimmst du, wenn dein Kind krank ist. Dann bleibst du zu Hause.</li></ul><p>Diese Tage nimmt die App nicht von deinem Urlaub weg. Du trägst sie nur an Arbeitstagen ein.</p><p>Für „Kind krank“ gibt es eine Grenze im Jahr. Bei dir gelten {kind_krank_max} Tage im Jahr. Die App nimmt die Zahl aus dem Gesetz. Du kannst die Zahl ändern.</p><p>Wähle bei <b>{weg_einstellungen_arbeitszeit}</b> dein Dienstverhältnis. Dienstverhältnis heißt: Wie du bei deiner Arbeit angestellt bist.</p><p><b>Du bist gesetzlich versichert.</b> Dann gilt für jedes Kind und jeden Elternteil:</p><ul><li>2024 bis 2026: 15 Tage im Jahr.</li><li>Andere Jahre: 10 Tage im Jahr.</li><li>Du erziehst allein? Dann sind es doppelt so viele Tage. Trage die Zahl selbst ein.</li></ul><p><b>Du bist Beamter oder Beamtin in Bayern.</b> Dann gilt für jedes Kind unter 12 Jahren:</p><ul><li>2024 bis 2026: 12 Tage bezahlt frei.</li><li>Andere Jahre: 8 Tage bezahlt frei.</li><li>Dazu kommen ein paar Tage Sonderurlaub. Dafür bekommst du kein Geld.</li></ul><p>Die Zahlen sind vom 19.11.2026. Das Gesetz kann sich ändern. Das ist keine Rechtsauskunft. Frag bei deiner Stelle nach, welche Zahl für dich gilt.</p><p>Wie viele Tage du schon hattest, siehst du bei <b>{weg_sondertage}</b>.</p>`},
  gleitzeit: {titel: "Gleittage und Gleitzeit-Konto: Was ist der Unterschied?", text: `<p><b>Gleittage</b> sind ganze freie Tage.</p><ul><li>Du darfst höchstens <b>{gleittage_max}</b> Gleittage im Jahr nehmen.</li></ul><p>Das <b>Gleitzeit-Konto</b> zeigt, wie viele Stunden du mehr oder weniger gearbeitet hast.</p><ul><li>Die App rechnet für jeden Tag: Ist-Zeit minus Sollzeit.</li><li>Ist-Zeit ist die Zeit, die du gearbeitet hast.</li><li>Sollzeit ist die Zeit, die du arbeiten sollst.</li><li>Die App zählt alle Tage zusammen. Dazu kommt dein Anfangsstand.</li></ul><p>Der Stand stimmt nicht mehr? Dann öffne die Einstellungen. Trage den richtigen Stand mit Datum ein. Die App rechnet ab dann weiter.</p>`},
  gleitzeit_verlauf: {titel: "Dein Gleitzeit-Konto als Linie", text: `<p>Gleitzeit heißt: Du arbeitest an manchen Tagen länger. An anderen Tagen arbeitest du kürzer. Das Gleitzeit-Konto zählt das zusammen.</p><p>Bei <b>{weg_woche}</b> siehst du eine Linie. Sie zeigt dein Gleitzeit-Konto für das ganze Jahr.</p><p>Dazu gibt es 2 gestrichelte Linien. Das sind deine Grenzen. Eine Grenze für zu viel Plus. Eine Grenze für zu viel Minus.</p><p>Ist dein Konto über einer Grenze? Dann zeigt dir „Zu tun“ einen Hinweis.</p><p>Die Grenzen stellst du bei <b>{weg_einstellungen_arbeitszeit}</b> ein.</p>`},
  familientage: {titel: "Familientage", text: `<p>Familientage sind zusätzliche freie Tage für die Familie.</p><p>Sie sind am Anfang ausgeschaltet.</p><p>So schaltest du sie ein:</p><ul><li>Öffne <b>{urlaub} → Erweitert → Familientage</b>.</li><li>Schalte sie für ein Jahr ein.</li></ul><p>Das ist für dich, wenn du 10 % deiner Arbeitszeit gegen Familientage tauschst.</p><ul><li>Du bekommst höchstens {familientage_max} Familientage pro Jahr.</li><li>Für diese Tage gibt es keine Sollzeit. Das ist wie bei Urlaub.</li></ul><p>Die Tage beantragst du weiter extra.</p>`},
  zutun: {titel: "Was ist „Zu tun“?", text: `<p>„Zu tun“ ist eine Karte in der Übersicht. Dort steht, worum du dich kümmern sollst.</p><ul><li><b>Rot</b> heißt: Das ist dringend.</li><li><b>Gelb</b> heißt: Mach das bald.</li></ul><p>Beispiele:</p><ul><li>Die Uhr läuft seit gestern. Du hast vergessen, auf Gehen zu tippen.</li><li>An einem Arbeitstag fehlt ein Eintrag.</li><li>Du brauchst in diesem Monat noch Tage im Büro.</li><li>Du hast lange keine Sicherung gemacht.</li><li>Dein Gleitzeit-Konto hat zu viel Plus oder zu viel Minus.</li><li>Es gibt eine neue Version der App.</li></ul><p>Jeder Eintrag hat einen Knopf. Er bringt dich an die richtige Stelle.</p><p>Am Bild von der Übersicht steht eine Zahl. Sie sagt dir, wie viele Einträge offen sind.</p>`},
  jahreswechsel: {titel: "Ein neues Jahr beginnt", text: `<p>Im Januar zeigt dir die Übersicht eine Karte. Sie heißt <b>Jahreswechsel</b>. Sie hilft dir, das alte Jahr abzuschließen.</p><ol><li>Du hast noch Urlaub vom alten Jahr? Du kannst bis zu 15 Tage ansparen. Ansparen heißt: für später aufheben.</li><li>Die App zeigt dein Gleitzeit-Konto am 31.12. Du prüfst, ob die Zahl stimmt.</li><li>Du lädst die Homeoffice-Übersicht des alten Jahres herunter.</li><li>Du machst eine Sicherung.</li></ol><p>Ab dem 1. Februar ist die Karte weg.</p>`},
  krank: {titel: "Krank und Attest", text: `<p>Ein Attest ist ein Zettel vom Arzt. Darauf steht: Du bist krank.</p><ul><li>Bis 3 Tage brauchst du kein Attest.</li><li>Danach trägst du das Datum vom Attest ein.</li><li>Kranke Tage zählen nur an deinen Arbeitstagen.</li></ul><p><b>Krank im Dienst</b> heißt: Du hast angefangen zu arbeiten. Dann bist du krank geworden.</p><ul><li>Die Zeit bis dahin zählt als Arbeit.</li><li>Die App füllt die fehlende Zeit bis zu deiner normalen Arbeitszeit an diesem Tag auf.</li><li>So bekommst du kein Minus.</li><li>Das ist kein Kranktag.</li></ul>`},
  startwerte: {titel: "Du fängst mitten im Jahr an", text: `<p>Ein Beispiel: Anna Beispiel nutzt die App ab dem 16.06. Bis dahin hat sie schon gearbeitet. Sie hatte auch schon Urlaub.</p><p>So geht es auch bei dir. Öffne <b>{weg_einstellungen_person}</b>. Die Karte heißt <b>Erfassung gültig ab</b>. Du trägst ein:</p><ul><li>das Datum: ab wann du die App nutzt</li><li>deine Stunden im Homeoffice bis dahin</li><li>deine Stunden im Büro bis dahin</li><li>deine Urlaubstage, Gleittage und Kranktage bis dahin</li><li>deine Tage „Kind krank“ bis dahin</li><li>den Stand von deinem Gleitzeit-Konto</li></ul><p>Gleittage sind ganze freie Tage.</p><p>Das Datum darf nicht in der Zukunft liegen.</p><p>Die App rechnet dann ab diesem Datum. Tage vor dem Datum bleiben zu sehen. Sie zählen aber nicht. Dort steht: „vor Beginn der Erfassung“.</p><p>Die Zahlen gelten nur für dieses eine Jahr. Das Gleitzeit-Konto läuft danach weiter.</p>`},
  abschnitte: {titel: "Teilzeit und Elternzeit", text: `<p>Teilzeit heißt: Du arbeitest weniger Stunden als normal.</p><p>Du trägst das bei <b>{weg_einstellungen_arbeitszeit}</b> ein. Dort siehst du deine Zeiträume als Liste. Tippe auf „Neuer Abschnitt ab …“.</p><p>Bei Teilzeit hast du 3 Möglichkeiten:</p><ol><li>Du gibst nur die Stunden pro Woche ein.</li><li>Du wählst dazu deine Arbeitstage.</li><li>Du gibst die Stunden für jeden Tag ein.</li></ol><p>Ein Beispiel für Weg 3: Montag 8 Stunden, Dienstag 6, Mittwoch 4. Dann sind es zusammen 18 Stunden in der Woche.</p><p>Wichtig bei Weg 3: Jeder gewählte Tag braucht Stunden.</p>`},
  feiertage: {titel: "Feiertage und freie Tage", text: `<p>Die App kennt die Feiertage von <b>{bundesland}</b>. Sie rechnet sie selbst aus.</p><ul><li>Der 24.12. ist {heiligabend}.</li><li>Der 31.12. ist {silvester}.</li><li>Faschingsdienstag: {fasching}.</li></ul><p>Diese Regeln stehen bei <b>{weg_einstellungen_arbeitszeit}</b>. Dort kannst du auch eigene Feiertage anlegen.</p>`},
  eigene_feiertage: {titel: "Eigene Feiertage", text: `<p>Die App kennt die Feiertage von deinem Bundesland. Du kannst eigene Feiertage dazu nehmen.</p><p>Ein Beispiel: Deine Firma hat jedes Jahr am 30.12. zu. Dann legst du diesen Tag als Feiertag an.</p><p>So geht es:</p><ol><li>Öffne <b>{weg_einstellungen_arbeitszeit}</b>.</li><li>Gehe zur Karte <b>Feiertage</b>.</li><li>Gib dem Tag einen Namen.</li><li>Wähle: nur einmal oder jedes Jahr.</li></ol><p>Du kannst auch einen Feiertag abwählen. Dann ist er ein normaler Arbeitstag.</p><p>Die App holt dafür nichts aus dem Internet.</p>`},
  vermerk: {titel: "Dienstreise und Fortbildung", text: `<p>Eine Dienstreise ist eine Reise für die Arbeit. Eine Fortbildung ist ein Kurs für die Arbeit.</p><p>Diese Tage bekommen einen Vermerk. Ein Vermerk ist ein kurzer Hinweis zum Tag. So geht es:</p><ol><li>Öffne den Tag.</li><li>Öffne <b>Einzelheiten</b>.</li><li>Wähle beim Vermerk „Dienstreise/Außentermin“ oder „Fortbildung“.</li><li>Trage deine Zeiten ein.</li></ol><p>Der Vermerk ist nur ein Hinweis. Er ändert keine Zahl.</p><p>Später prüfst du die Zeiten. Dann setzt du den Haken bei „Zeiten geprüft“. Bis dahin erinnert dich „Zu tun“.</p>`},
  uebersicht: {titel: "Was steht in der Homeoffice-Übersicht?", text: `<p>Die Übersicht gilt für ein Jahr. Sie zeigt:</p><ul><li>wie viele Tage Urlaub, Gleittage und Krankheitstage du hattest</li><li>wie viele Tage du nur im Homeoffice warst</li><li>wie viele Tage du im Büro warst</li><li>wie viele Tage Elternzeit du hattest</li><li>die Stunden</li><li>die Quote</li></ul><p>Die Krankheitstage stehen auch einzeln da. Mit dem Datum vom Attest.</p><p>Du kannst die Übersicht herunterladen. Zum Beispiel als PDF, Excel oder Word.</p>`},
  monatsnachweis: {titel: "Der Monatsnachweis", text: `<p>Der Monatsnachweis ist ein Blatt für deinen Arbeitgeber. Darauf stehen deine Stunden für einen Monat.</p><p>Du findest ihn bei <b>{weg_monatsnachweis}</b>. Du bekommst ihn als PDF oder als Datei für Word.</p><p>Auf dem Blatt steht:</p><ul><li>dein Name, dein Arbeitgeber und deine Personalnummer</li><li>jeder Tag mit deinen Stunden</li><li>wie viele Stunden du im Monat gearbeitet hast</li><li>wie viele Tage Urlaub du hattest</li><li>eine Zeile für deine Unterschrift</li></ul><p>Name, Arbeitgeber und Personalnummer trägst du bei <b>{weg_einstellungen_person}</b> ein.</p><p>Auf dem Blatt steht nicht, ob du im Homeoffice warst. Kranke Tage stehen dort nur als „abwesend“.</p><p>Deine Notizen stehen auf dem Blatt. An Tagen mit Krank, Kind krank oder Krank im Dienst fehlen sie. Schreib also nichts in die Notiz, was dein Arbeitgeber nicht lesen soll.</p>`},
  pause: {titel: "Pause und Höchstarbeitszeit", text: `<p>Jeder Tag kann diese Zeiten haben: <b>Kommen, Gehen und Pause</b>.</p><ul><li>Du trägst sie ein bei „Tag bearbeiten → Kommen – Gehen – Pause“.</li><li>Die Stempeluhr trägt sie selbst ein.</li></ul><p>So rechnet die App: Arbeitszeit = Gehen minus Kommen minus Pause.</p><p>Die Pause kommt aus der <b>Pausenregel</b>. Die App bucht sie als Pause. Du kannst sie ändern. Du schreibst sie in Stunden und Minuten, zum Beispiel 00:30.</p><p>Die Regel stellst du unter „Regeln“ ein. Jetzt gilt: <b>{pausenregel}</b></p><p>Jede Stufe zählt anteilig. Ein Beispiel: Die Regel heißt „über 06:00 Std. 00:30 Pause“. Du arbeitest 06:25. Dann sind es genau 25 Minuten Pause. Ab 06:30 sind es die vollen 30 Minuten.</p><p>Du gehst nach Mitternacht? Dann schreibst du zum Beispiel 26:00 für 02:00 am nächsten Tag.</p><p>Du kannst auch nur Stunden eintragen. Dann brauchst du keine Uhrzeiten.</p><p>Pro Tag darfst du höchstens <b>10 Stunden</b> arbeiten.</p><ul><li>Du brauchst mehr? Dann hake „Über 10 Stunden freigegeben“ an. Das geht in der Stempeluhr und bei „Tag bearbeiten“.</li><li>Mehr als <b>24 Stunden</b> an einem Tag nimmt die App nie an.</li></ul>`},
  freizeitkonto: {titel: "Freizeitkonto und Arbeit am Wochenende", text: `<p>Du arbeitest an einem <b>Samstag, Sonntag oder Feiertag</b>? Dann trägst du die Zeit im Monat ein, wie sonst auch.</p><ul><li>Die Zeit zählt <b>nicht</b> zur Gleitzeit.</li><li>Sie zählt zum <b>Freizeitkonto</b>. Das ist ein eigenes Konto.</li><li>Den Stand siehst du in der Woche, in der Übersicht und in den Einstellungen.</li></ul><p>So baust du das Freizeitkonto ab:</p><ul><li>Wähle für einen Arbeitstag die Art <b>Freizeitausgleich</b>.</li><li>Die App zieht die Sollzeit vom Freizeitkonto ab.</li><li>Die Gleitzeit bleibt gleich.</li></ul><p>Einen Startstand legst du in den Einstellungen fest.</p>`},
  demo: {titel: "Demo-Modus", text: `<p>Mit dem Demo-Modus probierst du die App mit Beispieldaten aus.</p><p>Du findest ihn hier: <b>{weg_einstellungen} → Aussehen → Demo-Modus</b>. Ist die App leer, bietet sie die Demo auch in der Übersicht an.</p><ul><li>Die Demo hat eine eigene Datenbank. Sie ist getrennt von deinen echten Daten.</li><li>Die Beispieltage sind zufällig. Sie passen zu deinen Regeln. Du hast kein Homeoffice? Dann gibt es in der Demo keins. Es gibt nur deine Arbeitstage. Es gibt nichts aus Teilen, die du ausgeschaltet hast.</li><li>„Beispieldaten neu laden“ würfelt neu. Ein anderes Profil würfelt auch neu.</li><li>Deine echten Daten bleiben, wie sie sind.</li><li>„Demo beenden“ bringt dich zurück zu deinen echten Daten.</li><li>In der Demo kannst du keine Regeln ändern.</li></ul>`},
  planung: {titel: "Urlaub planen", text: `<p>Öffne <b>{weg_urlaub} → Urlaubsplanung</b>. Dort trägst du Tage ein, die noch kommen. Zum Beispiel Urlaub, Gleittage, angesparten Urlaub oder Familientage.</p><ol><li>Wähle die Art.</li><li>Setze „Von“ und „Bis“.</li><li>Die Vorschau zeigt, wie viele Tage die App einträgt. Wochenenden, Feiertage und freie Tage zählen nicht mit. Sie zeigt auch, wie viel Urlaub oder wie viele Gleittage dir danach bleiben.</li><li>Tippe auf „Eintragen“. Die Tage stehen sofort im Monat. Die App zieht sie von deinem Anspruch ab.</li></ol><p>Unter „Geplant“ siehst du alle Zeiträume, die noch kommen.</p><ul><li>Du kannst sie löschen.</li><li>Du kannst Zeiträume für den Kalender anhaken.</li><li><b>In Kalender übernehmen</b> schickt sie an den Kalender von deinem Gerät. Am iPhone tippst du auf „Alle hinzufügen“.</li><li><b>Kalender (.ics)</b> speichert eine Datei.</li></ul><p>Tage, die vorbei sind, sind nie dabei.</p>`},
  export: {titel: "Export und Teilen", text: `<p>Export heißt: Du holst deine Daten aus der App heraus.</p><p>Öffne <b>{weg_export}</b>. Diese Dateien gibt es:</p><ul><li>PDF, Word, ODT, ODS, Excel</li><li>Markdown, Text, JSON, XML, CSV</li><li>die ganze Datenbank (DB)</li><li>ein <b>Kalender</b> (.ics) mit Urlaub, Gleittagen und Krankheit. Du kannst ihn auch gleich mit „In Kalender übernehmen“ in den Kalender holen.</li></ul><p>Der Schalter „Teilen statt Herunterladen“ öffnet das Teilen-Menü von deinem Gerät. Das geht am iPhone, iPad, Android und in neuen Browsern. Du schickst die Datei dann zum Beispiel per Mail oder Nachricht weiter.</p><ul><li>Am Handy als App vom Home-Bildschirm gilt immer das Teilen-Menü.</li><li>Am Rechner wählst du frei. Das gilt auch in der Desktop-App.</li></ul>`},
  sicherung: {titel: "Deine Daten sichern", text: `<p>Eine Sicherung ist eine Kopie von deinen Daten. Du kannst sie später zurückholen.</p><ul><li>Die App macht jeden Tag eine Sicherung, wenn du sie startest.</li><li>Bei <b>{weg_sicherung}</b> lädst du deine Daten als Datei herunter.</li><li>Mit „Wiederherstellen“ holst du eine Sicherung zurück.</li></ul><p>Du synchronisierst nicht? Dann erinnert dich „Zu tun“. Das passiert, wenn deine letzte Sicherung zu alt ist.</p><p>Eine Sicherung von einer neueren App passt nur in eine gleich neue oder neuere App.</p>`},
  daten_pruefen: {titel: "Deine Daten prüfen", text: `<p>Die App kann deine Einträge prüfen. Sie sucht Fehler.</p><p>Öffne <b>{weg_sicherung}</b>. Tippe auf <b>Daten prüfen</b>.</p><p>Die App sucht zum Beispiel:</p><ul><li>Gehen ist früher als Kommen.</li><li>Ein Tag ist Urlaub. Und du hast an dem Tag auch gearbeitet.</li><li>Du hast an einem Feiertag gearbeitet.</li><li>Du hast mehr Urlaub eingetragen, als du hast.</li></ul><p>Die App ändert dabei nichts. Sie zeigt dir nur eine Liste. Tippe auf eine Zeile. Dann kommst du zu dem Tag.</p>`},
  datenschutz: {titel: "Mit wem spricht die App?", text: `<p>Die App schickt deine Daten an niemanden. Sie zählt auch nicht, was du machst.</p><p>Es gibt nur diese Ausnahmen:</p><ul><li>Du richtest die Synchronisierung mit GitHub ein. Dann gehen deine Daten in dein eigenes Fach bei GitHub. Sie sind verschlüsselt. Verschlüsselt heißt: Ohne Passwort kann sie niemand lesen.</li><li>Du richtest die Synchronisierung mit deinem eigenen Server ein. Ein Server ist ein Rechner, der immer läuft. Dann spricht die App mit diesem Server.</li><li>Du schaltest ein: Ein Gerät ist der Speicherort. Dann holen deine anderen Geräte dort die verschlüsselten Dateien.</li><li>Du schaltest ein: Du bedienst die Windows-App am iPhone. Dann braucht das iPhone den Code aus dem QR-Bild.</li><li>Die Windows-App und die Android-App fragen alle 30 Tage bei GitHub nach einer neuen Version. Sie fragen nur nach der Nummer. Dabei sieht GitHub die Internetadresse von deinem Gerät. Von deinen Daten schickt die App nichts mit. Die App lädt auch nichts herunter. Ab Werk ist die Frage an. Ausschalten kannst du sie bei <b>{weg_einstellungen_geraete}</b>.</li><li>Du nutzt die App im Browser. Dann lädt sie ihre Programmdateien von ihrer Adresse. Dabei sieht der Betreiber die Internetadresse von deinem Gerät. Deine Eingaben sieht er nicht.</li></ul><p>Im Browser verschlüsselt die App deine Sicherung mit einer eingebauten Bibliothek. Sie heißt pycryptodome. Sie rechnet nur. Sie baut keine Verbindung auf.</p><p>Unter Android gibt es noch die Gerätesicherung von Google. Sie nimmt deine Daten mit. Die App verschlüsselt sie dafür nicht extra. Du willst das nicht? Dann schalte in den Android-Einstellungen die Google-Sicherung für Apps aus.</p>`},
  personen: {titel: "Mehrere Personen auf dem Server", text: `<p>Dieser Server hat eine Anmeldung. Jede Person hat einen eigenen Datenordner. Niemand sieht die Daten von anderen.</p><ul><li><b>Anmelden:</b> Wähle auf der Anmeldeseite deinen Namen aus der Liste. Gib dein Passwort ein.</li><li><b>Neu anlegen:</b> Wähle auf der Anmeldeseite „Neu anlegen“. Gib ein: Benutzername oder E-Mail-Adresse. Die App schickt nie eine E-Mail. Gib einen Anzeigenamen ein, wenn du willst. Sonst gilt der ganze Benutzername. Gib das Passwort zweimal ein. Es hat mindestens 8 Zeichen. Danach bist du gleich angemeldet.</li><li><b>Abmelden:</b> Du findest den Knopf im Menü oder in der Seitenleiste. Am Handy findest du ihn oben neben dem Menü. Dann kann eine andere Person sich anmelden.</li><li><b>Namen ändern:</b> Öffne <b>{weg_einstellungen_geraete}</b>. Dort änderst du Anzeigenamen und Benutzernamen. Deine Daten hängen an einer festen Nummer. Du bleibst angemeldet. Nichts geht verloren.</li><li><b>Meinen Zugang löschen:</b> Das geht auch auf der Karte „Person“. Du brauchst dein Passwort. Deine Daten kommen in den Papierkorb vom Server. Ein Admin kann sie zurückholen. Oder für immer löschen. Ein Admin ist eine Person, die den Server verwaltet.</li><li><b>Admin:</b> Auf einem neuen Server wird die erste Person Admin.</li></ul><p>Du kannst dein Passwort hier nicht ändern. Hast du es vergessen? Dann setzt ein Admin es zurück.</p><p>Die Desktop-App und die Android-App synchronisieren mit diesem Server. Dort meldest du dich mit Benutzername und Passwort an. Mehr steht bei „Synchronisieren mit eigenem Server mit Anmeldung“.</p>`},
  admin: {titel: "Personen verwalten (nur für Admins)", text: `<p>Öffne <b>{weg_einstellungen_geraete}</b>. Du siehst nie ein Passwort.</p><ul><li><b>Sperren und Entsperren:</b> Eine gesperrte Person kann sich nicht anmelden. Ihre Daten bleiben.</li><li><b>Passwort zurücksetzen:</b> Die Person legt beim nächsten Anmelden ein neues Passwort fest.</li><li><b>Admin-Recht geben oder nehmen:</b> Es bleibt immer mindestens ein Admin, der nicht gesperrt ist.</li><li><b>Löschen:</b> Die Daten kommen in den Papierkorb vom Server. Ordner, die der Server übernommen hat, bleiben dort, wo sie sind.</li><li><b>Neu anlegen freigeben oder sperren:</b> Du bestimmst, ob auf der Anmeldeseite neue Personen entstehen dürfen. Gibt es noch keine Person, ist es immer frei.</li><li><b>Papierkorb:</b> Du holst eine Person zurück. Sie bekommt einen neuen Benutzernamen. Das Passwort legt sie beim ersten Anmelden fest. Oder du löschst sie für immer. Das kannst du nicht zurücknehmen.</li></ul>`},
  aussehen: {titel: "So sieht die App aus", text: `<p>Bei <b>{weg_einstellungen_aussehen}</b> wählst du:</p><ul><li>hell oder dunkel</li><li>den Stil: Glas, Flächig, Kompakt, Klar, Kräftig oder Terminal</li><li>beim Stil Glas: ob Flächen durchscheinen (Glaseffekt)</li><li>die Farbe für Knöpfe</li><li>wie die App Stunden zeigt</li></ul><p>Du wählst „Automatisch“? Dann macht die App es wie dein Gerät.</p><p>Der Stil gilt nur auf diesem Gerät.</p><p>Auf den Kacheln steht eine große Zahl. Die Erklärung dazu bekommst du über den Hilfe-Knopf.</p>`},
  handy_sicherung: {titel: "Verschlüsselte Sicherung in der Handy-App", text: `<p>Das gibt es nur in der Android-App. Die Web-App hat es nicht.</p><p>Öffne <b>Sicherung</b>. Die App legt eine <b>verschlüsselte</b> Kopie aller Daten in deinen Cloud-Speicher (Google Drive). Verschlüsselt heißt: Ohne Passwort kann niemand sie lesen.</p><ol><li>Lege ein <b>Passwort</b> fest. Es hat mindestens 8 Zeichen. Schreibe es an einem sicheren Ort auf.</li><li>Schalte „Automatisch sichern“ ein. Wähle, wie oft: täglich, wöchentlich oder bei jeder Änderung. Hat sich nichts geändert, macht die App keine neue Datei.</li><li>Wähle, wie viele Sicherungen bleiben. Ältere löscht die App selbst. Sie löscht nur die von diesem Gerät.</li></ol><ul><li>„Jetzt sichern“ macht sofort eine Sicherung.</li><li>„Aus Sicherung wiederherstellen“ ersetzt alle Daten durch die gewählte Sicherung. Die App sichert vorher den Stand, den du gerade hast.</li><li>Auf einem neuen Gerät brauchst du dafür das Passwort.</li></ul><p><b>Ohne das Passwort kann niemand die Sicherung lesen.</b> Die App speichert es nirgends. Niemand kann es zurücksetzen. Auch nicht der Hersteller der App.</p><p>Eine Sicherung klappt nicht? Zum Beispiel, weil kein Netz da ist oder der Speicher voll ist. Dann steht der Grund in der Karte. Deine Daten in der App bleiben, wie sie sind. Nach einer Viertelstunde versucht die App es noch einmal.</p><p>Die App sichert nur die Datenbank von der App.</p><p>Die App schickt nichts an andere. Sie misst nichts. Für die Sicherung baut sie selbst keine Verbindung auf. Sie legt die Datei in den Cloud-Ordner von deinem eigenen Konto. Den Rest macht dein Gerät. Verbindungen gibt es nur bei der Synchronisierung. Die richtest du selbst ein. Sie ist verschlüsselt. Sie geht an deinen eigenen Server oder an dein GitHub-Repo.</p><p>Achtung bei Android: Die Gerätesicherung von Google nimmt die Datenbank auch mit.</p><ul><li>Die App verschlüsselt sie dafür nicht extra.</li><li>Ab Android 12 geht das nur bei Geräten mit Verschlüsselung.</li><li>Passwort-Schlüssel und GitHub-Token sind davon ausgenommen.</li><li>Du willst das nicht? Dann schalte in den Android-Einstellungen die Google-Sicherung für Apps aus.</li></ul>`},
  web_ohne_server: {titel: "Web-App ohne Server (iPhone, iPad, Browser)", text: `<p>Die App gibt es auch als Web-App. Sie läuft ganz im Browser von deinem Gerät. Es gibt keinen Server, der deine Daten sieht.</p><ol><li>Öffne die Adresse der App in Safari.</li><li>Tippe auf das Teilen-Symbol. Tippe dann auf <b>„Zum Home-Bildschirm“</b>. Starte die App ab jetzt nur noch über dieses Symbol. Trage erst dort Daten ein. Die App vom Home-Bildschirm hat einen eigenen Speicher. Er ist getrennt von Safari.</li><li>Öffne <b>Sicherung</b>. Lege ein Passwort fest. Tippe auf „Sicherung erstellen“. Lege die Datei mit „In Dateien sichern“ ab. Zum Beispiel in iCloud Drive.</li></ol><p><b>Deine Daten liegen nur im Speicher vom Browser auf diesem Gerät.</b></p><ul><li>Das Gerät kann diesen Speicher leeren. Zum Beispiel bei Platzmangel. Oder wenn du „Website-Daten löschen“ wählst. Oder im Safari-Tab nach einigen Wochen ohne Besuch.</li><li>Darum erinnert die App nach {sichern_nach_tage} Tagen an die Sicherung.</li><li>Mit der gespeicherten Datei und dem Passwort holst du alles zurück. Das geht auch auf einem neuen Gerät.</li></ul><p>Mit anderen Geräten synchronisiert diese Fassung. Das geht über ein eigenes Repo bei GitHub. Oder über den eigenen Server, der die App ausliefert. Mehr steht bei „Synchronisieren zwischen Handy und Desktop“.</p><p><b>Datenschutz:</b></p><ul><li>Die Programmdateien kommen von einer öffentlichen Adresse. Das passiert beim ersten Start und bei einer neuen Version. Es sind etwa 8 MB.</li><li>Der Betreiber von dieser Adresse sieht deine IP-Adresse. Das ist bei jeder Webseite so. Deine Eingaben sieht er nicht.</li><li>Die App rechnet und speichert nur auf deinem Gerät.</li><li>Die App schickt keine Daten weg. Nur bei der Synchronisierung, die du selbst einrichtest. Sie ist verschlüsselt. Sie geht an deinen eigenen Server oder an dein GitHub-Repo.</li><li>Nach dem ersten Start läuft die App auch ohne Internet.</li><li>Zum Rechnen bringt diese Fassung Python als WebAssembly mit (Pyodide). Das ist ein Programm, das im Browser rechnet.</li></ul>`},
  sync: {titel: "Mehrere Geräte synchronisieren", text: `<p>Synchronisieren heißt: Deine Geräte haben alle denselben Stand. Das nennt man Synchronisierung. Kurz sagt man auch: Sync. Früher hieß es hier: Abgleich.</p><p>Ein Beispiel: Du trägst am Handy etwas ein. Später siehst du es auch am Rechner.</p><p>So richtest du es ein. Öffne <b>{weg_sync}</b>.</p><ol><li>Wähle den Speicherort. Das ist die Stelle, wo deine Geräte ihre Daten tauschen. Zum Beispiel ein Ordner oder GitHub.</li><li>Trage die Angaben für den Speicherort ein.</li><li>Lege ein Passwort fest. Nimm auf allen Geräten dasselbe Passwort.</li><li>Die App synchronisiert zum ersten Mal.</li></ol><p>Danach macht die App das von selbst.</p><p>Die Sync-Datei heißt abgleich-….zsich. Das ist richtig so.</p><p>Alle Geräte brauchen dieselbe Version von der App.</p><p>Ein neues Gerät soll mitmachen? Dann gib dort einmal dasselbe Passwort ein. Die App sagt dir, wann.</p><p>Hast du noch eine alte App auf einem Gerät? Dann hol dir dort die neue Version. Sonst klappt die Synchronisierung nicht.</p>`},
  anmeldedienst: {titel: "Server mit Anmeldung", text: `<p>Ein Server ist ein Rechner, der immer läuft. Dort liegen deine Daten.</p><p>Manche Server haben eine Anmeldung. Das macht der Anmeldedienst. Er prüft deinen Namen und dein Passwort.</p><p>Die Windows-App und die Android-App melden sich dort einmal an:</p><ol><li>Öffne <b>{weg_sync}</b>.</li><li>Wähle als Speicherort „Eigener Server“.</li><li>Trage die Adresse vom Server ein.</li><li>Trage deinen Namen und dein Passwort ein.</li></ol><p>Die App merkt sich dein Passwort nicht. Sie bekommt einen eigenen Schlüssel für dein Gerät.</p><p>Am iPhone und iPad brauchst du keine App:</p><ol><li>Öffne in Safari die Adresse vom Server mit <b>/mobil/</b> am Ende.</li><li>Melde dich an.</li><li>Tippe auf Teilen und dann auf „Zum Home-Bildschirm“.</li></ol><p>Die App holt deine Daten dann vom Server.</p>`},
  sync_aus: {titel: "Synchronisieren ausschalten und Geräte zählen", text: `<p>Auf der Seite <b>Synchronisieren</b> steht „Geräte in der Synchronisierung“. Dort siehst du, wie viele Geräte gerade synchronisieren. Dein Gerät zählt mit.</p><p>Du schaltest „Synchronisieren“ für dieses Gerät aus unter <b>{weg_einstellungen_module}</b>.</p><ul><li>Das Gerät macht eine letzte Synchronisierung und meldet sich ab.</li><li>Danach synchronisiert es nicht mehr. Das gilt für Hand und automatisch. Es gilt auch als Speicherort.</li><li>Die anderen Geräte synchronisieren weiter, solange es mindestens 2 sind.</li><li>Ist nur noch ein Gerät übrig, schaltet es die Synchronisierung selbst aus.</li></ul><p>Du schaltest ihn wieder ein unter „Module“. Das geht auf jedem Gerät. Danach wartet das Gerät, bis ein zweites wieder mitmacht.</p>`},
  github: {titel: "Synchronisieren über GitHub einrichten (Schritt für Schritt)", text: `<p>Alle deine Geräte legen ihre Einträge verschlüsselt in <b>ein privates Repo in deinem GitHub-Konto</b>. Ein Repo ist ein Ordner im Internet. Privat heißt: Nur du siehst ihn.</p><ul><li>Das Passwort bleibt auf deinen Geräten.</li><li>GitHub sieht nur verschlüsselte Dateien.</li><li>Deine Geräte müssen sich nicht gegenseitig erreichen.</li></ul><p>Das gilt für iPhone, iPad, Windows, Android und den eigenen Server.</p><p><b>Schritt 1: Repo anlegen (einmal, bei GitHub)</b></p><ol><li>Klicke oben rechts auf <b>+ → New repository</b>.</li><li>Gib einen Namen ein. Zum Beispiel <b>zeiterfassung-daten</b>.</li><li>Wähle <b>Private</b>. Hake sonst nichts an.</li><li>Klicke auf <b>Create repository</b>.</li></ol><p><b>Schritt 2: Token anlegen (einmal, bei GitHub)</b></p><p>Ein Token ist ein Zugangsschlüssel für die App.</p><ol><li>Klicke auf dein Profilbild. Klicke auf <b>Settings</b>. Klicke links unten auf <b>Developer settings</b>. Klicke auf <b>Personal access tokens → Fine-grained tokens → Generate new token</b>.</li><li>Den Namen wählst du frei. Den Ablauf wählst du nach Wunsch. Er ist höchstens ein Jahr.</li><li>Wähle bei <b>Repository access</b>: <b>Only select repositories</b>. Wähle nur das Daten-Repo.</li><li>Wähle bei <b>Permissions → Repository permissions</b>: <b>Contents: Read and write</b>.</li><li>Klicke auf <b>Generate token</b>. Das Token beginnt mit „github_pat_“. Kopiere es sofort. Speichere es in deinem Passwort-Manager. GitHub zeigt es nur ein Mal.</li></ol><p><b>Schritt 3: Das erste Gerät verbinden (hier in der App)</b></p><ol><li>Öffne <b>{weg_sync}</b>.</li><li>Lege ein <b>Passwort</b> fest. Es hat mindestens 8 Zeichen. Es ist auf allen Geräten dasselbe. Am iPhone nimmst du das „starke Passwort“ von Safari nicht an. Tippe das Passwort selbst ein. Oder setze es aus dem Passwort-Manager ein.</li><li>Trage bei <b>GitHub als Speicherort</b> das Repo ein, zum Beispiel <b>konto/zeiterfassung-daten</b>. Trage das Token ein. Tippe auf <b>Mit GitHub verbinden</b>. Es muss „privates Repo“ dastehen.</li><li>Tippe auf <b>Jetzt synchronisieren</b>. Danach läuft es von selbst. Die App synchronisiert von selbst. Das passiert wenige Sekunden nach jeder Änderung. Es passiert auch beim Öffnen und beim Zurückkehren in die App. Sonst passiert es alle 15 Minuten. In der Web-App gilt das nur, solange sie offen ist. Eine offene Seite schaut außerdem alle 2 Minuten bei der eigenen App nach. Sie fragt: Hat die Synchronisierung im Hintergrund etwas übernommen? Wenn ja, zeigt sie es an. Das ist keine Synchronisierung. Dabei geht nichts zu GitHub oder zu anderen Geräten. Du hast es eilig? Tippe oben auf die Wolke. Oder auf <b>Jetzt synchronisieren</b>. Du willst nicht automatisch synchronisieren? Schalte <b>Automatisch synchronisieren</b> aus. Dann synchronisierst du nur von Hand.</li></ol><p><b>Schritt 4: Weitere Geräte</b></p><ul><li>Mache dort dasselbe wie in Schritt 3. Nimm dasselbe Passwort, dasselbe Repo und dasselbe Token.</li><li>Zwischen Windows und Android geht es auch mit <b>Geräte koppeln</b> per Code. Dann kommen Repo und Token von selbst mit.</li></ul><p><b>Die erste Synchronisierung:</b></p><ul><li>Einträge, die nur auf einem Gerät stehen, kommen ohne Rückfrage auf alle anderen.</li><li>Ist derselbe Tag auf zwei Geräten verschieden? Dann entscheidest du unter „Konflikte“.</li><li>Bei einem eigenen Profil steht dort der Titel „Profil“ mit dem Namen und einer Kurzbeschreibung. Du entscheidest für jedes Profil einzeln.</li></ul><p><b>Wenn etwas nicht geht:</b></p><ul><li>„GitHub ist … nicht erreichbar“: Du hast keine Verbindung ins Internet. Versuche es später noch einmal. Deine Daten bleiben, wie sie sind.</li><li>„GitHub lehnt das Token ab …“: Das Token ist abgelaufen. Oder du hast es falsch kopiert. Oder es gehört zu einem anderen Repo. Oder ihm fehlt „Contents: Read and write“. Lege ein neues Token an. Tippe auf „Verbindung trennen“. Verbinde neu.</li><li>„Das Passwort passt nicht …“: Auf deinen Geräten gelten verschiedene Passwörter. Gib hier das Passwort von den anderen Geräten ein.</li><li>„… ist ungültig und wurde nicht übernommen“: Ein Gerät hat eine ältere Version. Bringe alle Geräte auf dieselbe Version.</li><li>Du hast ein Gerät verloren: Lösche bei GitHub das Token. Lege ein neues an. Setze auf den anderen Geräten ein neues Passwort für die Synchronisierung. Das verlorene Gerät kennt den Schlüssel zum alten Passwort.</li></ul>`},
  kurzbefehle: {titel: "Kurzbefehle am Handy (Android)", text: `<p>Drücke lange auf das Bild von der App. Dann siehst du 3 Kurzbefehle:</p><ul><li>Kommen Homeoffice</li><li>Kommen Büro</li><li>Gehen</li></ul><p>Tippe auf einen Kurzbefehl. Dann stempelt die App sofort. Oben siehst du, was passiert ist.</p><p>Die Stempeluhr ist ausgeschaltet? Dann bucht die App nichts. Sie sagt es dir oben.</p>`},
  update: {titel: "Eine neue Version von der App", text: `<p>Manchmal gibt es eine neue Version von der App. Eine Version ist ein neuer Stand vom Programm.</p><p>Die App fragt alle 30 Tage einmal bei GitHub nach. GitHub ist die Seite, auf der die App liegt. Die App fragt nur nach der Nummer der neuen Version.</p><p>Gibt es eine neue Version? Dann zeigt dir „Zu tun“ einen Hinweis. Die neue Version holst du selbst.</p><p>Am Computer: Beende die App. Pack die neue Datei Zeiterfassung-Windows.zip in einen neuen Ordner aus. Lösch den alten Ordner. Deine Daten bleiben.</p><p>Du willst das nicht? Dann schalte es aus bei <b>{weg_einstellungen_geraete}</b>.</p>`},
  andere_rechner: {titel: "Die App auf anderen Rechnern", text: `<p>Für Windows gibt es ein eigenes Programm. Für Android gibt es eine eigene App.</p><p>Du hast einen anderen Rechner? Dann nutze die App im Browser. Ein Browser ist das Programm für Internetseiten.</p><p>Du hattest dort bisher eine eigene App? Dann lade dort eine Sicherung herunter. Spiel sie in der App im Browser mit „Wiederherstellen“ ein.</p>`},
  profile: {titel: "Profile: feste, eigene, ein- und ausschalten", text: `<p>Ein Profil ist ein fertiger Satz Regeln.</p><p>Öffne <b>{weg_einstellungen_module}</b>. „Anwenden“ setzt ein Profil ab heute. Dazu kommen eine Akzentfarbe und Hell oder Dunkel.</p><p>Diese festen Profile gibt es:</p><ul><li><b>Büro + Homeoffice</b> (Blau, hell): 40 Stunden, 30 Urlaubstage, Homeoffice-Grenze 80 %, alle Module an.</li><li><b>Nur Büro</b> (Türkis, hell): 40,5 Stunden, 28 Urlaubstage, kein Homeoffice, weniger Seiten.</li><li><b>Nur Homeoffice</b> (Grün, hell): wie „Büro + Homeoffice“. Aber ohne Büro-Tage und ohne Spielraum.</li></ul><p>Beim ersten Start fragt die App: „Wie arbeitest du?“. Das Profil, das du wählst, gilt dann für alle Tage. Es ist die Voreinstellung. Bis du wählst, gilt „Büro + Homeoffice“.</p><p>Am besten legst du dir ein eigenes Profil an.</p><p>Der Betrieb kann weitere feste Profile als Datei in den Ordner „profile“ im Datenordner legen.</p><ul><li>Mit dem Schalter in jeder Zeile blendest du ein Profil aus der Auswahl aus. Das gilt für dieses Gerät. Regeln, die du schon angewendet hast, bleiben.</li><li>„Datei“ lädt ein Profil herunter.</li><li>„Profil aus Datei übernehmen“ legt es als eigenes Profil an. Zum Beispiel, wenn du es von einer Kollegin hast.</li><li>Eigene Profile kommen bei der Synchronisierung auf deine anderen Geräte. Das gilt für jedes Profil einzeln. Es gilt auch beim Löschen. Der Schalter zum Ausblenden gilt für jedes Gerät einzeln.</li></ul><p>Danach kannst du alles unter „Regeln“ und „Module“ ändern. Du kannst es als eigenes Profil speichern.</p><p>Die Regel „Urlaubstage pro Jahr“ gilt für andere Jahre. Das sind Jahre, in denen du unter „{weg_urlaub} → Erweitert“ keinen eigenen Jahresanspruch eingetragen hast.</p>`},
  module: {titel: "Module: Teile der App ein- und ausschalten", text: `<p>Ein Modul ist ein Teil der App.</p><p>Öffne <b>{weg_einstellungen_module}</b>. Dort schaltest du aus, was du nicht brauchst.</p><p>Diese Teile sind Module:</p><ul><li>jede Seite im Menü, zum Beispiel Woche, Monat, Spielraum und Jahresübersicht</li><li>auch Krankmeldungen, Homeoffice-Übersicht und Export &amp; Auswertung</li><li>auch {urlaub} mit der Urlaubsplanung, Sicherung, Synchronisierung und Hilfe</li><li>Gleittage, Familientage, angesparter Urlaub, Freizeitkonto, Stempeluhr, Gleitzeit-Konto</li><li>einzelne Export-Formate, GitHub und das Koppeln</li></ul><p>Nur „Übersicht“ und „Einstellungen“ bleiben immer da.</p><p>Das Profil „Büro + Homeoffice“ und die Werkseinstellungen schalten wieder alles ein.</p><ul><li>Was du ausschaltest, erscheint nirgends mehr. Auch nicht im Menü. Auch nicht in dieser Hilfe.</li><li>Die App rechnet trotzdem weiter.</li><li>Deine Einträge bleiben. Nach dem Einschalten sind sie wieder da.</li><li>Ein Tag mit einer ausgeschalteten Art behält sie. Zum Beispiel Gleittag.</li></ul><p>„Synchronisieren“ ist eine Besonderheit:</p><ul><li>Es gilt nur für das Gerät, an dem du es schaltest.</li><li>Ist es aus, synchronisiert dieses Gerät nicht mehr. Nicht von Hand. Nicht automatisch. Auch nicht als Speicherort für andere.</li><li>Beim Ausschalten macht das Gerät eine letzte Synchronisierung und meldet sich ab.</li><li>Die anderen Geräte zählen mit. Synchronisieren noch mindestens 2 Geräte? Dann läuft die Synchronisierung dort weiter.</li><li>Ist nur noch ein Gerät übrig, schaltet es die Synchronisierung selbst aus.</li></ul><p>Die App synchronisiert die Auswahl. Sie steht auch in den Profilen.</p>`},
  tastatur: {titel: "Bedienung mit der Tastatur", text: `<ul><li>Mit <b>Tab</b> kommst du zu allen Knöpfen und Feldern. Du kommst auch zu den Tagen im Monat und zu den Tagen der Woche. Du kommst auch zu den Monaten in der Jahresübersicht.</li><li><b>Enter</b> oder die <b>Leertaste</b> öffnet den gewählten Tag.</li><li>Im Monat blätterst du mit den <b>Pfeiltasten</b> links und rechts.</li><li><b>T</b> springt zu heute.</li><li><b>Esc</b> schließt ein geöffnetes Blatt.</li><li>Der erste Druck auf <b>Tab</b> zeigt oben links „Zum Inhalt springen“. Damit überspringst du das Menü.</li><li>Ein Blatt ist offen? Dann bleibt <b>Tab</b> im Blatt. Nach dem Schließen steht der Fokus wieder auf dem Knopf, der es geöffnet hat.</li><li>Die laufende Stempeluhr (das Band oben) erreichst du auch mit <b>Tab</b>. Mit <b>Enter</b> öffnest du sie.</li><li>Das Menü am Handy hat einen Knopf „Schließen“.</li><li>Ein Fehler in einem Feld wird am Feld angesagt. Ein Screenreader liest ihn vor.</li><li>Der Windows-Kontrastmodus wird unterstützt. Knöpfe und Schalter bleiben gut zu erkennen.</li><li>Zurück zum heutigen Jahr kommst du mit „Heute“.</li></ul>`},
  gueltigkeit: {titel: "Ab wann gelten geänderte Regeln?", text: `<p>Am Anfang gelten sie <b>ab heute</b>.</p><ul><li>Vergangene Tage bleiben, wie sie sind.</li><li>Das Gleitzeit-Konto bleibt, wie es ist.</li><li>Alte Auswertungen bleiben, wie sie sind.</li></ul><p>Öffne <b>{weg_einstellungen_arbeitszeit}</b>. Dort kannst du etwas anderes wählen:</p><ul><li>ein <b>Datum</b>. Es darf auch in der Zukunft liegen. Zum Beispiel, wenn du den Arbeitsort wechselst.</li><li><b>rückwirkend für alle Zeiträume</b>. Dann ändert sich auch die Zeit davor.</li></ul><p>Die Liste „Gültigkeit der Regeln“ zeigt, was ab wann gilt.</p><p>Du löschst eine Zeile? Dann gilt wieder die Regel davor.</p>`},
  stand_anders: {titel: "Mein Gleitzeit-Stand oder die Sollzeiten sind plötzlich anders", text: `<p>Das passiert, wenn sich etwas auch für vergangene Tage ändert. Das können Regeln, Feiertage, freie Tage oder Abschnitte sein. Es passiert bei einer rückwirkenden Änderung. Und bei einem Datum in der Vergangenheit.</p><p>Trage danach den Gleitzeit-Stand neu ein. Das geht in den Einstellungen. Gib ein Datum dazu. Dann stimmt das Konto wieder.</p>`},
  app_pruefen: {titel: "Rechnet die App richtig?", text: `<p>Geh zu <b>{weg_sicherung}</b>. Ganz unten steht <b>App prüfen</b>.</p><p>Die App rechnet dann mit ausgedachten Tagen. Die richtigen Ergebnisse kennt sie schon.</p><p>Stimmt alles? Dann steht dort: „Alle Werte stimmen.“</p><p>Deine echten Daten bleiben dabei, wie sie sind.</p>`}
};
// ---- seiten/hilfe.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Desktop, Android und Server synchronisieren selbst im Hintergrund; die Seite fragt nur, ob sich der Datenstand geändert hat.
// Von GitHub Pages geladen (<konto>.github.io/<repo>/): Link zu den fertigen Apps im Release desselben Repos, ohne Kontonamen im Code.
function appsLink() {
  if (!location.hostname.endsWith(".github.io")) return "";
  const repo = location.pathname.split("/")[1];
  return repo ? `<br><a href="https://github.com/${location.hostname.split(".")[0]}/${repo}/releases/latest" target="_blank" rel="noopener">Apps für Windows und Android</a><br>Auf anderen Rechnern läuft die App im Browser.` : "";
}
// ---- Hilfe & FAQ (Seite „Hilfe“)
const WIKI = "https://github.com/davidsaluda/zeiterfassung-app/wiki";   // Anleitung mit Bildern; nur ein Link (neues Fenster), die App lädt von dort nichts
const HILFE_LEICHT_MERKER = "ho_leicht";                       // Wahl der Leichten Sprache, gemerkt je Gerät
const HILFE_LEICHT_HINWEIS = "Einfach geschrieben, nicht von einer Prüf-Gruppe geprüft.";
const HILFE_KEIN_WERT = "–";                                  // steht für eine Zahl, die die API nicht geliefert hat

// Abschnitte, die feste Texte mit {Platzhaltern} sind; die Leichte Sprache hat dieselben Schlüssel (seiten/hilfe_leicht.js).
const HILFE_NORMAL = {
  anfang: {titel: "Wie fange ich an?", text: `<p>Beim ersten Start steht in der Übersicht die Karte <b>Erster Start</b>. Sie fragt zuerst: „Nutzt du die App schon auf einem anderen Gerät?“ Mit „Ja, Daten holen“ richtest du die Synchronisierung ein und bekommst deine Daten. Mit „Nein, neu beginnen“ geht es weiter:</p><ol><li><b>Vorlage wählen:</b><ul><li><b>Nur Zeiterfassung:</b> Arbeitszeit, Urlaub und Gleitzeit. Ohne Homeoffice-Grenze.</li><li><b>Mit Homeoffice-Grenze:</b> Wie oben, dazu eine Grenze für Homeoffice mit Quote und Spielraum.</li><li><b>Büro + Homeoffice:</b> Mit Homeoffice-Grenze 80 %, Bayern: Faschingsdienstag 4 Stunden, Heiligabend und Silvester frei, Gleit- und Familientage.</li></ul></li><li><b>Bundesland</b> wählen.</li><li><b>Arbeitszeit:</b> Wochenstunden und Arbeitstage.</li><li><b>Homeoffice-Grenze</b> in Prozent, nur bei einer Vorlage mit Grenze.</li><li><b>Urlaubstage</b> im Jahr.</li></ol><p>Mit „Überspringen“ beendest du die Einrichtung. Dann gelten die Regeln der Vorlage. Überspringst du schon die Wahl der Vorlage, gilt „Büro + Homeoffice“. Ändern kannst du alles später unter <b>{weg_einstellungen_arbeitszeit}</b>. Nach „Fertig“ bietet die App einen kurzen Rundgang an. Du startest ihn auch hier in der Hilfe mit „Rundgang starten“.</p><p>Fängst du mitten im Jahr an, trägst du deinen bisherigen Stand unter <b>{weg_einstellungen_person}</b> bei „Erfassung gültig ab“ ein. Teilzeit mit Stunden je Tag stellst du unter <b>{weg_einstellungen_arbeitszeit}</b> ein.</p><p>Erst ausprobieren? Nach der Wahl der Vorlage bietet die leere Übersicht Beispieldaten an.</p>`},
  aufbau: {titel: "Wie ist die App aufgebaut?", text: `<p>Die App hat acht Bereiche. Manche Bereiche haben oben Reiter:</p><ul><li><b>Übersicht</b></li><li><b>Zeit</b>: Tag, Woche, Monat</li><li><b>Homeoffice</b>: Spielraum, Jahr</li><li><b>Abwesenheit</b>: Urlaub, Krank, Sondertage</li><li><b>Auswertung</b>: Monatsnachweis, Export, Steuer</li><li><b>Daten</b>: Sicherung, Synchronisierung</li><li><b>Einstellungen</b></li><li><b>Hilfe</b></li></ul><p>Am Handy stehen unten Übersicht, Zeit, die Plus-Taste, Homeoffice und Abwesenheit. Den Rest öffnest du über das Menü oben. Am Rechner stehen alle Bereiche in der Seitenleiste links.</p><p>Ohne Homeoffice heißt der Bereich Homeoffice „Jahr“. Ein abgeschaltetes Modul fehlt als Reiter ganz. Der Ort „Büro“ hieß früher: Dienststelle.</p><p>Im Bereich Zeit blätterst du mit ‹ und ›, mit den Pfeiltasten oder am Handy durch Wischen nach links und rechts. „Heute“ und die Taste <b>T</b> springen zu heute. Am Rechner steht der gewählte Tag rechts neben Tag, Woche oder Monat. Dort bearbeitest du ihn direkt.</p><p>Alte Lesezeichen funktionieren weiter. Die App leitet sie auf die neue Stelle um.</p>`},
  buchen: {titel: "Wie buche ich meine Zeit?", text: `<p>Mit der <b>Stempeluhr</b>: Kommen beim Anfangen, Gehen am Ende. Am Handy geht das mit der Plus-Taste unten in der Mitte, sonst mit „Kommen“ in der Übersicht. Solange die Uhr läuft, steht oben ein Band mit der laufenden Zeit. Beginn, Ende und Pause kannst du korrigieren.</p><p>Gebucht wird immer auf den Tag des Beginns, auch wenn du nach Mitternacht gehst. Läuft die Uhr am nächsten Tag noch, fragt die App, wann du aufgehört hast. Die Nacht zählt sie nicht mit.</p><p>Vergessenes trägst du unter <b>{weg_monat}</b> nach: Tag antippen, Schnellwahl oder Einzelheiten. „Heute eintragen“ in der Übersicht öffnet gleich den heutigen Tag.</p>`},
  plus_taste: {titel: "Was macht die Plus-Taste?", text: `<p>Die Plus-Taste stempelt. Ihr Symbol zeigt, was als Nächstes kommt.</p><ul><li><b>Kommen:</b> Ein Tipp zeigt kurz die Wahl Homeoffice oder Büro. Der zweite Tipp stempelt. Gibt es bei dir nur einen Ort, stempelt schon der erste Tipp.</li><li><b>Gehen:</b> Ein Tipp bucht aus. Das Ende ist jetzt, die Pause kommt aus der Pausenregel. Danach kannst du das Gehen einige Sekunden lang rückgängig machen.</li><li>Läuft die Uhr seit gestern, öffnet die Taste ein Blatt. Dort trägst du ein, wann du aufgehört hast.</li></ul><p>Ist die Stempeluhr abgeschaltet, öffnet die Taste „Heute eintragen“.</p>`},
  tag_blatt: {titel: "Wie trage ich einen Tag schnell ein?", text: `<p>Tippe auf einen Tag. Oben steht die Schnellwahl: Homeoffice, Büro, Urlaub, Krank, Gleittag und „Mehr“ für die übrigen Arten. Du siehst nur Arten, die deine Regeln und Module kennen.</p><p>Ein Tipp trägt den ganzen Tag mit deinem Tagessoll ein und schließt. Danach kannst du es rückgängig machen. An einem Feiertag oder freien Tag gibt es kein Tagessoll. Dann öffnen Homeoffice und Büro die Einzelheiten.</p><p>Unter <b>Einzelheiten</b> stehen Kommen, Gehen, Pause, der gemischte Tag mit Homeoffice und Büro, die Notiz und der Vermerk. Hat der Tag schon Uhrzeiten, gemischte Zeit, eine Notiz oder einen Vermerk, sind die Einzelheiten offen.</p><p>Am Rechner steht der Tag rechts neben dem Kalender. Hast du etwas geändert und wählst einen anderen Tag, fragt die App: „Änderungen am 18.11. verwerfen?“ „Verwerfen“ wechselt den Tag, „Abbrechen“ lässt deine Eingaben stehen. Der Knopf „Abbrechen“ unter dem Tag setzt ihn auf den gespeicherten Stand zurück. Enter speichert.</p>`},
  rueckgaengig: {titel: "Kann ich etwas rückgängig machen?", text: `<p>Ja, kurz nach dem Speichern. Unten erscheint eine Leiste, zum Beispiel „Gespeichert.“, mit dem Knopf <b>Rückgängig</b>. Sie bleibt 10 Sekunden. Solange die Maus oder der Fokus in der Leiste ist, wartet sie. Am Rechner geht es auch mit <b>Strg+Z</b> (Mac: ⌘+Z), wenn du nicht gerade in einem Feld schreibst.</p><p>Rückgängig gibt es nach diesen Schritten:</p><ul><li>Tag speichern oder leeren, auch über die Schnellwahl</li><li>Urlaub oder Abwesenheit planen und einen geplanten Zeitraum löschen</li><li>Gehen mit der Plus-Taste, im Stempel-Blatt oder mit einem Kurzbefehl. Danach läuft die Stempeluhr wieder wie vorher.</li></ul><p>Es gibt nur eine Stufe. Der nächste Schritt ersetzt den vorigen. Kommen, Regeln, Urlaubskonten, Wiederherstellen und das Ansparen von Urlaub nimmt Rückgängig nicht zurück.</p><p>Hat sich ein Tag inzwischen geändert, meldet die App: „Rückgängig geht nicht mehr: Ein Tag wurde inzwischen geändert (z. B. durch die Synchronisierung).“ Nach einem Neustart oder von einem anderen Gerät aus ist Rückgängig abgelaufen.</p><p>Solange Rückgängig möglich ist, wartet die Synchronisierung. „Jetzt synchronisieren“ beendet das Warten sofort.</p>`},
  monat_raster: {titel: "Wie lese ich den Monat?", text: `<p>Der Monat öffnet als Kalender. Jeder Tag hat eine Farbe und dazu einen Buchstaben oder ein Zeichen. So erkennst du die Art auch ohne Farbe. Die Legende steht unter dem Kalender, darunter die Zahlen des Monats.</p><p>Mit dem Schalter <b>Raster | Liste</b> wechselst du zur Liste. Die App merkt sich deine Wahl auf diesem Gerät.</p><p>Der Monat öffnet immer oben, auch beim Blättern. Nur „Heute“ springt zum heutigen Tag. Ein Tipp auf einen Tag öffnet ihn zum Bearbeiten.</p>`},
  zeitformat: {titel: "Stunden als 7:30 oder 7,50?", text: `<p>Unter <b>{weg_einstellungen_aussehen}</b> wählst du, wie Stunden erscheinen: „7:30“ (Stunden und Minuten) oder „7,50“ (Stunden mit Komma). Eingestellt ist {zeitformat}. Das gilt für alle Anzeigen und Exporte, auch für ältere Monate und auf allen deinen Geräten.</p><p>Gerechnet wird immer in Minuten. Die Kommazahl rundet kaufmännisch auf zwei Stellen. Summen rechnet die App aus den Minuten. Beispiel: 3 × 7:20 sind 22,00, nicht 21,99.</p><p>Uhrzeiten bleiben wie 08:00. Beim Eintippen von Stunden nimmt die App beides an, „8:30“ und „8,5“.</p>`},
  quote: {titel: "Was bedeutet die Homeoffice-Quote und die Grenze?", text: `<p>Die Quote ist die Homeoffice-Zeit geteilt durch die ganze Arbeitszeit (Homeoffice plus Büro), minutengenau. Die Grenze liegt bei <b>{grenze} %</b>. Genau {grenze} % sind erlaubt, rot wird es erst darüber. Der Pfeil am Ring zeigt die Grenze.</p><p>Ein Tag mit Homeoffice und Büro zählt als Büro-Tag. Bei „Krank im Dienst“ zählt nur die gearbeitete Zeit.</p>`},
  sondertage: {titel: "Was sind Sonderurlaub und Kind krank?", text: `<p>Beide sind eigene Arten für einen ganzen Tag ohne Arbeitszeit. Der Tag gilt als erfüllt wie ein Urlaubstag. Vom Urlaub geht nichts ab. Du trägst sie nur an Arbeitstagen ein, nicht am Wochenende oder an Feiertagen.</p><ul><li><b>Sonderurlaub</b>, zum Beispiel für Hochzeit oder Umzug. Du kannst ihn wie Urlaub im Voraus planen.</li><li><b>Kind krank</b> hat ein Jahreslimit. Bei dir gelten {kind_krank_max} Tage im Jahr.</li></ul><p>Die Vorgabe richtet sich nach Dienstverhältnis und Jahr. Wähle unter <b>{weg_einstellungen_arbeitszeit}</b> bei „Kind krank“ dein Dienstverhältnis. Du kannst auch einen eigenen Wert eintragen.</p><ul><li><b>Gesetzlich versichert</b>: 2024 bis 2026 sind es 15 Arbeitstage je Kind und Elternteil (§ 45 Abs. 2a SGB V), sonst 10 (§ 45 Abs. 2 SGB V). Alleinerziehende haben doppelt so viele. Trage dann den Wert selbst ein.</li><li><b>Beamte in Bayern</b> (§ 10 Abs. 3 UrlMV, Kind unter 12 Jahren): bezahlte Dienstbefreiung bis zu 80 % davon, also 12 Tage (2024 bis 2026), sonst 8. Der Rest ist Sonderurlaub nach § 13 UrlMV, ohne Bezüge.</li></ul><p>Stand der Angaben: 19.11.2026. Der Gesetzgeber kann die Zahlen ändern; eine Verlängerung der 15 Tage über 2026 hinaus ist nicht beschlossen. Das ist keine Rechtsauskunft. Welche Zahl für dich gilt (mehrere Kinder, Versicherung), frage bei deiner Stelle oder Krankenkasse nach.</p><p>Die Zähler und die restlichen Tage „Kind krank“ stehen unter <b>{weg_sondertage}</b>.</p><p>„Sonderurlaub ohne Bezüge (0 h)“ ist etwas anderes: ein Zeitraum unter den Arbeitszeit-Abschnitten.</p>`},
  gleitzeit_verlauf: {titel: "Was zeigt der Gleitzeit-Verlauf?", text: `<p>Unter <b>{weg_woche}</b> zeigt die Karte <b>Gleitzeit-Verlauf</b> dein Gleitzeit-Konto über das Jahr. Die Linie bei 0 und die zwei gestrichelten Grenzen sind beschriftet. Unter „Werte als Tabelle“ stehen die Zahlen je Woche. In der Übersicht zeigt die Kachel Gleitzeit einen kleinen Verlauf.</p><p>Die Grenzen stellst du unter <b>{weg_einstellungen_arbeitszeit}</b> ein: „Hinweis ab Plus (Stunden)“ und „Hinweis ab Minus (Stunden)“. Jetzt gilt: Plus {gleitzeit_plus}, Minus {gleitzeit_minus}. Ist Minus 0, gilt die Plus-Grenze für beide Seiten.</p><p>Liegt das Konto darüber, steht ein Hinweis in „Zu tun“. Genau auf der Grenze gibt es keinen.</p>`},
  zutun: {titel: "Was zeigt die Karte „Zu tun“?", text: `<p>In der Übersicht unter Heute und Quote stehen Dinge, um die du dich kümmern solltest. <b>Rot</b> ist dringend, <b>gelb</b> bald, dazu Hinweise in der Akzentfarbe. Die Zahl am Symbol der Übersicht zeigt, wie viele Einträge offen sind. Der Knopf führt zur passenden Stelle.</p><ul><li><b>Stempeluhr:</b> Läuft sie seit gestern oder über 10 Stunden, heißt es „Gehen nachtragen“. Ist am letzten Arbeitstag nichts eingetragen, fragt die App „Stempeluhr vergessen?“.</li><li><b>Lücken:</b> Arbeitstage ohne Eintrag der letzten 31 Tage. „Nachtragen“ öffnet den ersten davon.</li><li><b>Quote:</b> Droht Homeoffice in diesem Monat über die Grenze zu kommen, nennt die App die nötigen Büro-Tage. Das kommt nur, wenn auch das Jahr nicht sicher ist.</li><li><b>Dienstreise oder Fortbildung:</b> Tage mit diesem Vermerk, deren Zeiten du noch nicht geprüft hast.</li><li><b>Sicherung:</b> Ohne Synchronisierung erinnert die App nach {sicherung_tage} ohne Sicherung. Mit Synchronisierung meldet sie stattdessen Probleme der Synchronisierung.</li><li><b>Gleitzeit:</b> Konto über der Grenze im Plus oder im Minus.</li><li><b>Urlaub und Attest:</b> angesparter Urlaub verfällt bald, Attest fehlt, Übertrag nach dem Ansparen prüfen.</li><li><b>Neue Version:</b> in der Windows- und Android-App, oder wenn ein anderes Gerät schon neuer ist.</li></ul><p>„Später“ blendet einen Eintrag 7 Tage aus, „Nicht mehr zeigen“ für immer. Das gibt es nicht bei roten Einträgen und gilt nur auf diesem Gerät. Die Grenzen für Sicherung und Gleitzeit stellst du unter <b>{weg_einstellungen_arbeitszeit}</b> ein, die ganze Karte unter <b>{weg_einstellungen_module}</b> ab.</p>`},
  jahreswechsel: {titel: "Was passiert beim Jahreswechsel?", text: `<p>Im Januar steht in der Übersicht unter „Zu tun“ die Karte <b>Jahreswechsel</b>. Sie führt dich durch das alte Jahr:</p><ol><li><b>Resturlaub ansparen:</b> Du wählst, wie viele Resttage du ansparst, höchstens 15. Die angesparten Tage gehen vom Übertrag ab, sonst zählten sie doppelt. Beispiel: 7 Resttage, 5 angespart, dann 2 Tage Übertrag.</li><li><b>Gleitzeit:</b> Die App zeigt den Stand am 31.12. Das Konto läuft weiter. Stimmt der Stand nicht, änderst du ihn.</li><li><b>Steuer:</b> Die Homeoffice-Übersicht des alten Jahres herunterladen.</li><li><b>Sicherung:</b> Eine Sicherung anlegen.</li></ol><p>Jeder Schritt erscheint nur, wenn sein Modul an ist. Erledigte Schritte merkt sich die App auch auf deinen anderen Geräten. „Ausblenden“ schließt die Karte. Ab dem 1. Februar ist sie weg.</p><p>Änderst du nach dem Ansparen noch das alte Jahr, fragt „Zu tun“, ob der Übertrag noch stimmt.</p>`},
  krank: {titel: "Krankheit und Attest", text: `<p>Zusammenhängende Kranktage bilden eine Phase. Wochenenden und freie Tage unterbrechen sie nicht. Bis 3 Tage gehen ohne Attest. Danach trägst du das Attest-Datum ein. Es gilt für die ganze Phase. Für vergangene Phasen warnt die App nicht mehr. Kranktage zählen nur an deinen Arbeitstagen. Ein Eintrag an einem freien Tag steht mit „zählt nicht (kein Arbeitstag)“ in der Liste.</p><p>Krank im Dienst: Du hast angefangen zu arbeiten und bist dann krank geworden. Die Zeit bis dahin zählt als Homeoffice oder Büro. Die fehlende Zeit bis zur Sollzeit des Tages füllt die App auf. So entsteht kein Minus im Gleitzeit-Konto. Für die Quote zählt nur die gearbeitete Zeit. Es ist kein Kranktag.</p><p>Einträge vor „Erfassung gültig ab“ bleiben grau sichtbar mit „vor Beginn der Erfassung“ und zählen nicht.</p>`},
  startwerte: {titel: "Ich fange mitten im Jahr an. Was trage ich ein?", text: `<p>Unter <b>{weg_einstellungen_person}</b> steht die Karte <b>Erfassung gültig ab</b>. Dort trägst du das Datum ein, ab dem du mit der App erfasst. Dazu kommt dein Stand des Jahres bis zum Tag davor:</p><ul><li>Homeoffice-Zeit und Büro-Zeit in Stunden und Minuten</li><li>schon genommener Urlaub, Gleittage, Kranktage und Tage „Kind krank“</li><li>der Stand deines Gleitzeit-Kontos</li></ul><p>Zeiten nimmt die App als „8:30“ oder „8,5“ an. Das Datum darf nicht in der Zukunft liegen. Am 01.01. gibt es keinen Stand davor, nur das Gleitzeit-Konto.</p><p>So rechnet die App:</p><ul><li>Soll, Ist und Gleitzeit laufen erst ab dem Datum.</li><li>Die Quote im ersten Jahr ist: Homeoffice vor dem Datum plus erfasstes Homeoffice, geteilt durch die ganze Zeit vor dem Datum plus die erfasste Zeit.</li><li>Die Startwerte gelten nur im Jahr des Datums. Das Gleitzeit-Konto läuft danach weiter.</li><li>Tage vor dem Datum bleiben gespeichert und sichtbar, zählen aber nicht. Sie tragen den Hinweis „vor Beginn der Erfassung“. Das gilt auch für frühere Jahre.</li></ul><p>Setzt oder änderst du das Datum, behalten Gleitzeit-Konto und Freizeitkonto ihren Stand. Einen automatischen Urlaubsübertrag ins Jahr des Datums schreibt die App dabei als Wert von Hand fest. Angesparten Urlaub trägst du als Rest bei den Konten unter Urlaub ein.</p>`},
  abschnitte: {titel: "Teilzeit, Elternzeit und andere Arbeitszeiten", text: `<p>Unter <b>{weg_einstellungen_arbeitszeit}</b> stehen deine Abschnitte als Zeitleiste. Mit „Neuer Abschnitt ab …“ legst du einen Zeitraum mit eigenen Wochenstunden an. Ohne Abschnitt gilt deine Standard-Arbeitszeit ({wochenstunden} Stunden, {arbeitstage}).</p><p>Arten: Vollzeit, Teilzeit, Elternzeit, Elternteilzeit, Altersteilzeit (Arbeitsphase und Freistellung), Pflegezeit, Sonderurlaub ohne Bezüge und Mutterschutz. Bei Arten mit „0 h“ stellt die App die Wochenstunden selbst auf 0.</p><p>Bei Teilzeit, Elternteilzeit, Altersteilzeit und Pflegezeit gibt es drei Wege:</p><ol><li><b>Nur Wochenstunden:</b> Die Stunden verteilen sich gleichmäßig auf die Arbeitstage deiner Regeln.</li><li><b>Tage wählen:</b> Die Wochenstunden verteilen sich gleichmäßig auf die gewählten Tage.</li><li><b>Stunden je Tag:</b> Trage für jeden gewählten Tag die Stunden ein, zum Beispiel Mo 8, Di 6, Mi 4. Die Sollzeit pro Woche ist dann die Summe.</li></ol><p>Bei Weg 3 brauchen alle gewählten Tage Stunden, höchstens 10 je Tag und 60 je Woche. Einen Tag mit 0 Stunden wählst du ab. Die Sollzeit pro Woche steht im Formular und an jedem Abschnitt.</p><p>Elternzeit ohne Arbeit erscheint in der Homeoffice-Übersicht. Bei Altersteilzeit im Teilzeitmodell trägst du die verringerten Stunden als „Arbeitsphase“ für die ganze Zeit ein, im Blockmodell zwei Abschnitte.</p>`},
  feiertage: {titel: "Feiertage, freie Tage und Faschingsdienstag", text: `<p>Feiertage gelten für <b>{bundesland}</b>. Die App rechnet sie selbst aus. 24.12. ist {heiligabend}, 31.12. ist {silvester}. Der Faschingsdienstag hat {fasching}.</p><p>Diese Regeln stehen offen unter <b>{weg_einstellungen_arbeitszeit}</b>. Dort legst du auch eigene Feiertage an oder wählst einen berechneten ab (siehe „Kann ich eigene Feiertage anlegen?“).</p>`},
  eigene_feiertage: {titel: "Kann ich eigene Feiertage anlegen?", text: `<p>Ja. Unter <b>{weg_einstellungen_arbeitszeit}</b> steht die Karte <b>Feiertage</b>.</p><ul><li><b>Eigener Feiertag:</b> mit Namen, einmalig oder jedes Jahr, gültig ab einem Jahr. Er wirkt wie ein gesetzlicher Feiertag: kein Soll, Urlaub zählt dort nicht, Arbeit geht aufs Freizeitkonto.</li><li><b>Feiertag abwählen:</b> Ein berechneter Feiertag wird dann ein normaler Arbeitstag.</li></ul><p>Ein jährlicher Tag am 29.02. gilt nur in Schaltjahren. Auf einen gesetzlichen Feiertag kannst du keinen eigenen legen. Am Wochenende geht es, das Soll ändert sich dann nicht.</p><p>Die App rechnet die Feiertage selbst aus. Sie lädt keinen Kalender aus dem Internet.</p>`},
  vermerk: {titel: "Wie trage ich Dienstreise oder Fortbildung ein?", text: `<p>Diese Tage sind keine eigene Art. Du setzt einen <b>Vermerk</b>: Tag öffnen, <b>Einzelheiten</b>, dann beim Vermerk „Dienstreise/Außentermin“ oder „Fortbildung“ wählen. Die Zeiten trägst du so ein, wie sie für dich zählen.</p><p>Der Vermerk zählt nicht anders. Quote, Soll, Ist und Gleitzeit bleiben gleich. Am Tag steht ein kleines Zeichen. Der Vermerk steht vor der Notiz und in den Exporten, im Monatsnachweis in der Spalte Anmerkung. Im Kalender (.ics) steht er nicht.</p><p>Solange du nicht „Zeiten geprüft“ ankreuzt, steht der Tag in „Zu tun“, zum Beispiel „Dienstreise am 12.11.: Zeiten prüfen.“</p>`},
  monatsnachweis: {titel: "Was steht im Monatsnachweis?", text: `<p>Unter <b>{weg_monatsnachweis}</b> erstellst du einen Nachweis für deinen Arbeitgeber, als PDF oder Word. Er enthält:</p><ul><li>oben Name, Arbeitgeber und Personalnummer. Diese trägst du unter <b>{weg_einstellungen_person}</b> ein. Leere Felder bleiben als Zeile zum Ausfüllen von Hand.</li><li>jeden Tag des Monats mit den gearbeiteten Stunden und einer Anmerkung</li><li>die Summen: Arbeitsstunden, Urlaubstage, Gleittage und Freizeitausgleich</li><li>zum Schluss Zeilen für Datum und Unterschrift</li></ul><p>Mit dem Schalter <b>mit Beginn und Ende</b> stehen auch Kommen, Gehen und Pause darin. Ab Werk ist er aus. Die Wahl gilt für dieses Gerät.</p><p>Nicht darin stehen Quote, Homeoffice und Büro. Kranktage und „Kind krank“ stehen als „abwesend“ ohne Stunden. Bei „Krank im Dienst“ steht nur die gearbeitete Zeit. Darum kann die Summe kleiner sein als dein Ist in der App.</p><p>An Tagen mit Krank, Kind krank oder Krank im Dienst stehen weder Notiz noch Vermerk. An allen anderen Tagen steht deine Notiz wörtlich darin. Schreib dort also nichts, was dein Arbeitgeber nicht lesen soll.</p><p>Die Stunden stehen im Zeitformat deiner Einstellung, bei dir {zeitformat}. Tage vor „Erfassung gültig ab“ tragen „vor Beginn der Erfassung“ und zählen nicht.</p>`},
  sicherung: {titel: "Wie sichere ich meine Daten?", text: `<p>Beim ersten Start eines Tages legt die App eine Sicherung der Datenbank im Datenordner an, auf dem Server zusätzlich nachts. Die letzten sieben bleiben. Diese Kopie liegt auf demselben Gerät. Unter <b>{weg_sicherung}</b> lädst du mit „Sicherung herunterladen“ die ganze Datenbank herunter. Mit „Wiederherstellen“ spielst du sie wieder ein. Den Stand davor sichert die App vorher.</p><p>Ohne Synchronisierung erinnert „Zu tun“ nach {sicherung_tage} ohne Sicherung. Hast du noch nie gesichert, kommt der Hinweis, sobald dein erster Eintrag so lange zurückliegt.</p><p>Eine Sicherung mit unmöglichen Tagen (zum Beispiel mehr als 24 Stunden) nimmt die App nicht an. Deine Daten bleiben dann unverändert. Eine Sicherung aus einer neueren App lässt sich nur mit einer gleich neuen oder neueren App wiederherstellen.</p><p>Vor dem Sichern lohnt sich „Daten prüfen“ auf derselben Seite. Unter <b>{weg_einstellungen_module}</b> setzt „Alles zurücksetzen“ die App auf Anfang. Auch dann sichert die App vorher.</p>`},
  daten_pruefen: {titel: "Was macht „Daten prüfen“?", text: `<p>Unter <b>{weg_sicherung}</b> prüft der Knopf <b>Daten prüfen</b> alle deine Einträge. Er ändert nichts. Er sucht:</p><ul><li>Gehen vor Kommen, oder nur Kommen ohne Gehen</li><li>doppelt belegte Tage: eine ganztägige Art und dazu Arbeitszeit, oder zwei Fassungen nach der Synchronisierung</li><li>Arbeitszeit, Urlaub oder Gleittag an einem Feiertag oder eigenen freien Tag</li><li>mehr Urlaub als Anspruch und Übertrag, oder mehr angesparter Urlaub als auf dem Konto</li></ul><p>Jeder Fund ist ein Link zum Tag oder zur Seite. Arbeit am Wochenende ist kein Fund, sie gehört aufs Freizeitkonto. Die App zeigt höchstens 500 Funde.</p><p>Solche Einträge kann die Eingabe nicht immer verhindern. Sie kommen zum Beispiel über die Synchronisierung, einen Import oder eine alte Sicherung.</p>`},
  datenschutz: {titel: "Wann spricht die App mit anderen Geräten oder dem Internet?", text: `<p>Die App sendet keine Daten an Dritte und misst nichts. Sie lädt nichts von fremden Adressen. Es gibt genau diese Ausnahmen:</p><ul><li><b>Synchronisierung über GitHub</b>, nur wenn du sie einrichtest: Die App spricht nur mit <b>api.github.com</b> und deinem eigenen Repo. Dorthin gehen nur verschlüsselte Sync-Dateien. GitHub sieht deine Zeiten nicht, wohl aber, wann ein Gerät synchronisiert. Das Token bleibt auf deinem Gerät.</li><li><b>Synchronisierung mit deinem eigenen Server</b> (Windows- und Android-App), nur mit der Adresse, die du einträgst. Bei einem Server mit Anmeldung holt die App mit Benutzername und Passwort einmal einen Schlüssel für dieses Gerät. Das Passwort speichert sie nicht.</li><li><b>Ein Gerät als Speicherort</b>, nur wenn du es einschaltest: Andere Geräte im selben Netz erreichen dann auf Anschluss 8793 nur die verschlüsselten Sync-Dateien, nicht die App.</li><li><b>Windows-App am iPhone oder iPad bedienen</b>, nur wenn du es einschaltest: Die Oberfläche ist dann im eigenen Netz auf Anschluss 8794 erreichbar, nur mit dem Zugang aus dem QR-Code. „App beenden“ und das Einrichten der Synchronisierung gehen dort nicht.</li><li><b>Update-Hinweis</b> (Windows- und Android-App): Alle 30 Tage fragt die App bei GitHub nach der Nummer der neuesten Version (nur <b>api.github.com</b>, ohne Anmeldung, ohne Token). Dabei sieht GitHub die IP-Adresse deines Geräts. Die App lädt nichts herunter, installiert nichts und sendet keine Daten von dir. Die Abfrage ist ab Werk an. Abschalten: <b>{weg_einstellungen_geraete}</b>.</li><li><b>Web-App ohne Server:</b> Sie spricht nur mit dem Server, der sie ausliefert. Ihre Programmdateien kommen beim ersten Start und bei einer neuen Version von dieser Adresse. Der Betreiber dieser Adresse sieht dabei deine IP-Adresse, aber keine Eingaben.</li></ul><p>Die Android-App liest den QR-Code beim Koppeln mit einer eingebauten Bibliothek (ZXing). Die Bibliothek baut keine Verbindung auf.</p><p>Die Web-App ohne Server verschlüsselt Sicherung und Synchronisierung mit einer eingebauten Bibliothek (pycryptodome), weil ihr Python im Browser keine eigene mitbringt. Die Bibliothek rechnet nur und baut keine Verbindung auf. Die Windows-, Android- und Server-Fassung nutzen dafür weiter OpenSSL.</p><p>Die Android-App legt ihre verschlüsselte Sicherung in den Cloud-Ordner deines eigenen Kontos. Die Verbindung dorthin macht dein Gerät, nicht die App.</p><p>Unter Android nimmt außerdem die Gerätesicherung von Google die Datenbank mit. Die App verschlüsselt sie dafür nicht eigens. Ab Android 12 geschieht das nur auf Geräten mit Verschlüsselung. Passwort-Schlüssel und GitHub-Token sind davon ausgenommen. Wer das nicht möchte, schaltet in den Android-Einstellungen die Google-Sicherung für Apps aus.</p><p>Die App hat ohne Anmeldedienst keine Anmeldung. Betreibe einen Server nur in einem privaten Netz oder hinter einem geschützten Zugang.</p>`},
  aussehen: {titel: "Aussehen und Handy", text: `<p>Unter <b>{weg_einstellungen_aussehen}</b> wählst du das Design (Automatisch, Web, Handy), die Farbe (Automatisch, Hell, Dunkel), den Stil, die Akzentfarbe und das Zeitformat. Automatisch folgt dem Gerät; so startet die App, bis du etwas anderes wählst.</p><p>Der <b>Stil</b> bestimmt, wie Flächen, Ränder und Schrift aussehen: <b>Glas</b> (durchscheinend und weich, ab Werk), <b>Flächig</b> (getönte Flächen, runde Knöpfe), <b>Kompakt</b> (dicht, feine Linien), <b>Klar</b> (Linien statt Schatten, große Zahlen), <b>Kräftig</b> (dicke Ränder, harte Schatten) oder <b>Terminal</b> (Schrift mit fester Breite wie in einer Konsole, schmale Rahmen; dunkel mit grüner Schrift). Er gilt nur auf diesem Gerät und passt zu Hell, Dunkel und jeder Akzentfarbe. Gedruckt wird immer schlicht und hell.</p><p>Der <b>Glaseffekt</b> (nur im Stil Glas) lässt Karten und Leisten durchscheinen. „Aus“ macht sie deckend und spart Leistung; „Automatisch“ schaltet ihn auf schwachen Geräten ab (höchstens 4 Kerne oder 4 GB Speicher). Ist am Gerät „Transparenz reduzieren“ an, ist er immer aus.</p><p>Kacheln zeigen eine große Zahl und ein kurzes Etikett. Die längere Erklärung steht hinter dem Hilfe-Knopf der Kachel.</p><p>Du kannst die Seite im Browser über „Zum Home-Bildschirm“ als App ablegen. Ohne Verbindung zum Server zeigt sie die zuletzt gesehenen Seiten mit „Keine Verbindung“. Eintragen geht erst wieder mit Verbindung.</p>`},
  sync: {titel: "Wie synchronisiere ich mehrere Geräte?", text: `<p>Synchronisieren (früher: Abgleich) heißt: Alle deine Geräte haben denselben Stand. Du richtest es unter <b>{weg_sync}</b> in vier Schritten ein:</p><ol><li><b>Speicherort wählen:</b> Ordner, eigener Server, GitHub oder ein anderes Gerät per Code koppeln. Du siehst nur, was dein Gerät kann.</li><li><b>Angaben eintragen:</b> zum Beispiel den Ordner, die Adresse des Servers oder Repo und Token.</li><li><b>Sync-Passwort</b> festlegen: mindestens 8 Zeichen, auf allen Geräten dasselbe. Damit sind die Sync-Dateien verschlüsselt (AES-256).</li><li><b>Erster Lauf:</b> Die App synchronisiert und zeigt das Ergebnis.</li></ol><p>Danach läuft es von selbst: nach Änderungen, beim Öffnen, beim Zurückkehren in die App und sonst alle 15 Minuten. Die Web-App synchronisiert nur, solange sie offen ist. „Zuletzt synchronisiert“ zeigt den Stand. Eilt es, tippe auf das Sync-Symbol oben oder auf „Jetzt synchronisieren“.</p><p><b>Koppeln per Code</b> (Windows- und Android-App, gleiches WLAN oder VPN): auf einem Gerät „Code anzeigen“, auf dem anderen den Code eingeben oder scannen und „Koppeln“. Adresse und Passwort muss niemand tippen.</p><p><b>Dieses Gerät als Speicherort</b> geht nur mit Sync-Passwort. Ohne Passwort könnte jedes Gerät im selben Netz die Sync-Dateien ersetzen.</p><p><b>iPhone und iPad</b> synchronisieren über deinen eigenen Server oder über GitHub. Ohne Server kann die Windows-App ihre Oberfläche im WLAN freigeben: Schalter „Diese Zeiterfassung am iPhone oder iPad bedienen“, dann den QR-Code mit der Kamera scannen. Der Zugang gilt 30 Tage.</p><p>Die Sync-Datei heißt <b>abgleich-….zsich</b>. Das ist richtig so.</p><p>Wurde derselbe Tag auf zwei Geräten verschieden geändert, ist das ein <b>Konflikt</b>. Du entscheidest unter „Konflikte“, welcher Eintrag gilt. Die App überschreibt nichts von selbst. Übertragen werden deine Eingaben, Regeln und eigenen Profile. Die laufende Stempeluhr, Design und Farbe und das Ausblenden von Profilen bleiben je Gerät. Das Zeitformat gilt auf allen Geräten. Alle Geräte brauchen dieselbe Version. Ein älteres Gerät meldet „bitte aktualisieren“.</p><p><b>Passwort am neuen Gerät:</b> Hat der Speicherort (dein Server oder ein anderes Gerät) ein Passwort, nimmt er die Datei eines Geräts nur an, wenn es dasselbe Passwort kennt. Meldet die App, du sollst das Passwort einmal eingeben, trage dasselbe Passwort wie auf den anderen Geräten ein. Ältere Fassungen (bis Version 20261118.1825) können nicht mehr in die Ablage schreiben. Aktualisiere darum alle Geräte.</p>`},
  anmeldedienst: {titel: "Synchronisieren mit einem Server mit Anmeldung", text: `<p>Verlangt dein eigener Server eine Anmeldung, steht davor der <b>Anmeldedienst</b>. Er meldet Personen an und hält ihre Daten getrennt. Die Windows-App und die Android-App melden sich dort einmal als Gerät an:</p><ol><li>Unter <b>{weg_sync}</b> als Speicherort „Eigener Server“ wählen und die Adresse eintragen, zum Beispiel <b>zeit.example.org</b>. Ohne Angabe nimmt die App https. Mit Anmeldung geht es nur über https.</li><li>Benutzername und Passwort eintragen, so wie auf der Anmeldeseite des Servers.</li><li>Die App zeigt „Beim Server angemeldet als Gerät …“. Das Passwort speichert sie nicht. Sie behält nur einen eigenen Schlüssel für dieses Gerät.</li></ol><p><b>Abmelden</b> löscht den Schlüssel auf diesem Gerät. Im Browser am Server stehen deine Geräte unter <b>{weg_einstellungen_geraete}</b>. Dort entfernst du ein verlorenes Gerät. Ein neues Passwort meldet alle Geräte ab.</p><p>Meldet die App „abgemeldet“, „zu viele Anmeldeversuche“ oder „Zertifikat nicht vertraut“, wird das Sync-Symbol rot. Die Synchronisierung ruht dann, bis du dich neu anmeldest.</p><p><b>iPhone und iPad</b> brauchen keine eigene App: In Safari die Adresse des Servers mit <b>/mobil/</b> am Ende öffnen, anmelden und „Zum Home-Bildschirm“ wählen. Diese Web-App synchronisiert über den Server.</p>`},
  kurzbefehle: {titel: "Was machen die Kurzbefehle am App-Symbol (Android)?", text: `<p>Drück lange auf das Symbol der App. Es erscheinen drei Kurzbefehle: <b>Kommen Homeoffice</b>, <b>Kommen Büro</b> und <b>Gehen</b>. Das geht ab Android 7.1.</p><p>Ein Tipp öffnet die App und stempelt wie die Plus-Taste. Nach dem Gehen kannst du es rückgängig machen. Oben steht immer, was passiert ist.</p><p>Passt der Kurzbefehl gerade nicht, zum Beispiel Gehen ohne laufende Stempeluhr, bucht die App nichts und öffnet das Blatt der Stempeluhr. Ist die Stempeluhr abgeschaltet, sagt die App das. Einschalten: <b>{weg_einstellungen_module}</b>. Die drei Kurzbefehle sind fest. Sie ändern sich nicht mit deinen Modulen.</p>`},
  update: {titel: "Wie erfahre ich von einer neuen Version?", text: `<p>Die Windows- und die Android-App fragen alle 30 Tage bei GitHub nach der Nummer der neuesten Version. Gibt es eine neuere, steht in „Zu tun“ zum Beispiel „Version 20261201.0900 ist erschienen. Du hast 20261118.1825.“ Der Knopf <b>Zum Download</b> öffnet die Seite mit der neuen Version. Installieren musst du sie selbst. Die App lädt nichts herunter.</p><p>Windows: App beenden, die neue <b>Zeiterfassung-Windows.zip</b> in einen eigenen, neuen Ordner in deinem Benutzerprofil entpacken und dort <b>Zeiterfassung.exe</b> starten. Nicht über die alte Fassung, nicht auf einen USB-Stick und nicht in einen Ordner, in den andere schreiben dürfen. Den alten Ordner danach löschen. Deine Daten bleiben erhalten.</p><p>Die Abfrage ist ab Werk an. Abschalten: <b>{weg_einstellungen_geraete}</b>.</p><p>Nutzt ein anderes Gerät in deiner Synchronisierung schon eine neuere Version, sagt „Zu tun“ das auch. Dafür braucht die App keine Verbindung zu GitHub.</p>`},
  andere_rechner: {titel: "Gibt es die App auch für andere Rechner?", text: `<p>Als eigenes Programm gibt es die App für Windows und Android. Auf allen anderen Rechnern nimmst du die Web-App im Browser. Eine Desktop-App für weitere Betriebssysteme gibt es nicht mehr.</p><p>Hast du bisher eine solche Desktop-App genutzt: Lade dort unter Sicherung mit „Sicherung herunterladen“ die Datenbank herunter. Spiel sie dann in der Web-App unter <b>{weg_sicherung}</b> mit „Wiederherstellen“ ein.</p>`},
  app_pruefen: {titel: "Wie prüfe ich, ob die App richtig rechnet?", text: `<p>Unter <b>{weg_sicherung}</b> steht ganz unten <b>App prüfen</b>. Die App rechnet dann einen festen Satz erfundener Tage durch und vergleicht mit Werten, die von Hand gerechnet sind. Stimmt alles, meldet die App: Alle Werte stimmen.</p><p>Die Prüfung läuft in einer eigenen Datenbank nur im Speicher. Deine Daten fasst sie nicht an. Jede Fassung der App liefert dasselbe Ergebnis.</p>`}
};
// Reihenfolge aller Abschnitte der Hilfe (Schlüssel); eine Fassung zeigt nur die, deren Bedingung in HILFE_GILT erfüllt ist.
const HILFE_REIHE = ["zweck", "anfang", "aufbau", "buchen", "plus_taste", "tag_blatt", "rueckgaengig", "monat_raster", "zeitformat", "homeoffice_modus", "quote", "spielraum", "urlaub", "sondertage", "gleitzeit", "gleitzeit_verlauf", "familientage", "zutun", "jahreswechsel", "krank", "startwerte", "abschnitte", "feiertage", "eigene_feiertage", "vermerk", "uebersicht", "monatsnachweis", "pause", "freizeitkonto", "demo", "planung", "export", "sicherung", "daten_pruefen", "datenschutz", "personen", "admin", "aussehen", "handy_sicherung", "web_ohne_server", "sync", "anmeldedienst", "sync_aus", "github", "kurzbefehle", "update", "andere_rechner", "profile", "module", "tastatur", "gueltigkeit", "stand_anders", "app_pruefen"];
// Wann ein Abschnitt erscheint (fehlt der Schlüssel: immer); gleich für beide Fassungen.
const HILFE_GILT = {
  monat_raster: () => modulAn("monat"),
  sondertage: () => modulAn("sonderurlaub") || modulAn("kind_krank"),
  monatsnachweis: () => modulAn("monatsnachweis"),
  kurzbefehle: () => PLATTFORM === "android",
  daten_pruefen: () => modulAn("sicherung"),
  gleitzeit_verlauf: () => modulAn("gleitzeit"),
  update: () => PLATTFORM === "desktop" || PLATTFORM === "android",
  zutun: () => modulAn("zutun"),
  quote: () => mitGrenze(),
  krank: () => modulAn("krank"),
  sync: () => modulAn("abgleich"),
  anmeldedienst: () => modulAn("abgleich"),
  spielraum: () => mitGrenze(),
  familientage: () => modulAn("familientage"),
  uebersicht: () => hoModus() !== "kein" && modulAn("nachweis"),
  freizeitkonto: () => modulAn("freizeit"),
  planung: () => modulAn("planung"),
  export: () => modulAn("export"),
  personen: () => PERSON,
  admin: () => PERSON && ADMIN,
  sync_aus: () => modulAn("abgleich"),
  github: () => modulAn("abgleich") && modulAn("github")
};

// Ist die Leichte Sprache auf diesem Gerät gewählt?
const hilfeIstLeicht = () => speicher.l(HILFE_LEICHT_MERKER, "") === "1";
// Aktion des Schalters „Leichte Sprache“: Wahl umkehren, merken und die Seite neu zeichnen.
function hilfeLeicht() {
  speicher.s(HILFE_LEICHT_MERKER, hilfeIstLeicht() ? "" : "1");
  zeigen();
}
// Schalter „Leichte Sprache“ mit dem Satz darunter; aria-pressed sagt dem Screenreader den Stand.
const leichtSchalter = an => `<div class="hilfe-schalter"><button type="button" class="hilfe-leicht" data-klick="hilfeLeicht" aria-pressed="${an}">Leichte Sprache</button><p class="hinweis">${HILFE_LEICHT_HINWEIS}</p></div>`;

// Das Jahreslimit „Kind krank“ des Jahres, wie die API es für die Seite „Sondertage“ liefert; bei einem Fehler ein Strich.
async function hilfeKindKrank() {
  try { return (await api("GET", `/urlaub/${jahr}`)).kind_krank_max; } catch (e) { return HILFE_KEIN_WERT; }
}
// Werte für die Platzhalter der Texte aus den Regeln k (und der API, wo die Zahl nur der Server kennt). Eingesetzt wird nur mit esc().
async function hilfeWerte(k) {
  const plus = zutunSaldoGrenze(k), minus = k.zutun_saldo_minus || plus;
  const kind = modulAn("sonderurlaub") || modulAn("kind_krank") ? await hilfeKindKrank() : HILFE_KEIN_WERT;
  return {grenze: k.ho_grenze, ho_modus: HO_MODI[hoModus()], gleittage_max: k.gleittage_max, familientage_max: k.familientage_max, kind_krank_max: kind,
    sicherung_tage: zutunSicherungTage(k), sichern_nach_tage: SICHERN_NACH_TAGEN, gleitzeit_plus: plus, gleitzeit_minus: minus,
    wochenstunden: komma(k.wochenstunden), arbeitstage: String(k.arbeitstage).replace(/,/g, ", "), bundesland: BUNDESLAENDER[k.bundesland] || k.bundesland,
    heiligabend: k.heiligabend_frei ? "frei" : "ein normaler Arbeitstag", silvester: k.silvester_frei ? "frei" : "ein normaler Arbeitstag",
    fasching: k.fasching_std === null ? "keine besondere Regel" : "höchstens " + komma(k.fasching_std) + " Std. Soll", pausenregel: pausenText(),
    zeitformat: k.zeitformat === "dezimal" ? "7,50" : "7:30", urlaub: seitenTitel("urlaub")};
}
// Setzt in text die Platzhalter ein: {weg_<seite>[_<unterseite>]} als weg(seite, unterseite), {name} aus werte; alles maskiert, Unbekanntes bleibt leer.
function hilfeFuellen(text, werte) {
  return text.replace(/\{(\w+)\}/g, (_, name) => {
    const [vorsatz, seite, unter = ""] = name.split("_");
    return esc(vorsatz === "weg" && seite ? weg(seite, unter) : werte[name] ?? "");
  });
}
// Abschnitte, deren Text von den Regeln abhängt und deshalb hier steht und nicht in HILFE_NORMAL: Schlüssel → [Frage, Antwort in HTML].
function hilfeAltTexte(k, bl) {
  return {
    zweck: ["Wofür ist die App gedacht?", `Sie hält fest, wann du im Homeoffice (HO) und wann im Büro gearbeitet hast, und rechnet daraus Quote (falls du eine hast), Gleitzeit, Urlaub, Krankheit und die Homeoffice-Übersicht. Alles liegt in deiner eigenen Datenbank, es gibt kein Benutzerkonto und keine Cloud.`],
    homeoffice_modus: ["Homeoffice: mit Grenze, ohne Grenze, kein oder nur Homeoffice", `Unter <b>${weg("einstellungen", "arbeitszeit")}</b> stellst du ein, was für dich gilt. Eingestellt ist jetzt: <b>${HO_MODI[hoModus()]}</b>.<ul><li><b>Mit Grenze:</b> Die App rechnet die HO-Quote, zeigt die Grenze am Ring, warnt beim Überschreiten und zeigt den HO-Spielraum.</li><li><b>Ohne Grenze:</b> Du trägst HO und Büro ein, die Quote steht nur zur Info da. Keine Warnungen, kein HO-Spielraum.</li><li><b>Kein Homeoffice:</b> Es gibt nur ein Zeitfeld (Büro). Quote, HO-Spielraum und Homeoffice-Übersicht sind ausgeblendet.</li><li><b>Nur Homeoffice:</b> Es gibt nur ein Zeitfeld (Homeoffice), keine Quote und keinen HO-Spielraum. Die Homeoffice-Übersicht bleibt.</li></ul>Wie jede Regel gilt die Änderung ab heute, ab einem Datum oder rückwirkend. Schon eingetragene Zeiten bleiben erhalten.`],
    spielraum: ["Was zeigt „HO-Spielraum“?", `Wie viel HO-Zeit du noch dazunehmen kannst, ohne über ${k.ho_grenze} % zu kommen, wenn du an den restlichen Tagen wie geplant (Soll) arbeitest. Dazu gibt es eine <b>Jahres-Prognose</b>: Sie nimmt an, dass du an einer festen Zahl von Tagen pro Woche im Büro bist (0 bis 5 zum Antippen oder „Automatisch“), und zeigt die voraussichtliche Quote zum Jahresende. <b>Automatisch</b>: so viele Büro-Tage pro Woche wie bisher im Schnitt (bei Teilzeit bezogen auf deine Arbeitstage). Wochen mit Feiertag oder Urlaub zählen anteilig. „Bei diesem Tempo“ ist das Ergebnis von Automatisch. Im Monat steht die Jahres-Prognose eingeklappt. Ein Tipp auf „Jahres-Prognose“ klappt sie auf.`],
    urlaub: ["Wie funktionieren Urlaub und angesparter Urlaub?", `Der Resturlaub wird automatisch ins nächste Jahr übernommen (unter „${weg("urlaub")} → Erweitert“ lässt sich der Übertrag von Hand korrigieren). Angesparter Urlaub wird als Konto je Herkunftsjahr geführt und mit der Art „Angesparter Urlaub“ genommen. Halbe Tage gibt es nicht.`],
    gleitzeit: ["Was ist der Unterschied zwischen Gleittagen und Gleitzeit-Konto?", `<b>Gleittage</b> sind ganze freie Tage, höchstens <b>${k.gleittage_max}</b> pro Jahr. Das <b>Gleitzeit-Konto</b> ist die Summe aus Ist minus Soll über alle Tage plus dein Anfangsstand. Stimmt der Stand nicht mehr, trägst du unter „Einstellungen“ den richtigen Stand mit Datum ein. Die App rechnet ab dort weiter.`],
    familientage: ["Familientage", `Familientage sind standardmäßig aus. Du schaltest sie unter <b>${weg("urlaub")} → Erweitert → Familientage</b> je Jahr ein, wenn du 10 % der Arbeitszeit gegen zusätzliche Familientage tauschst (höchstens ${k.familientage_max} pro Jahr, ohne Sollzeit wie Urlaub). Beantragen musst du die Tage weiterhin separat.`],
    uebersicht: ["Was steht in der Homeoffice-Übersicht?", `Pro Jahr die Zahl der Urlaubs-, Gleit- und Kranktage, der reinen HO-Tage, der Büro-Tage und der Elternzeit-Tage plus die Stunden und die Quote. Die Kranktage gibt es zusätzlich einzeln mit Attest-Datum. Die Übersicht gibt es als PDF, Excel, Word und in weiteren Formaten.`],
    pause: ["Pause und Höchstarbeitszeit", `Jeder Tag kann <b>Kommen, Gehen und Pause</b> haben (Tag bearbeiten → „Kommen – Gehen – Pause“; die Stempeluhr trägt sie selbst ein). Arbeitszeit = Gehen − Kommen − Pause. Die Pause wird nach der <b>Pausenregel</b> vorbelegt und <b>als Pause gebucht</b>; du kannst sie ändern (Stunden und Minuten, hh:mm). Die Regel stellst du unter „Regeln“ ein, jetzt: <b>${pausenText()}</b>. Jede Stufe zählt anteilig: Bei „über 06:00 Std. 00:30 Pause“ sind es bei 06:25 genau 25 Minuten, ab 06:30 die vollen 30. Nach Mitternacht gehen: z. B. 26:00 für 02:00 am Folgetag. Tage ohne Uhrzeiten (nur Stunden) bleiben möglich. Pro Tag sind höchstens <b>10 Stunden</b> Arbeitszeit möglich. Mehr geht nur, wenn du „Über 10 Stunden freigegeben“ ankreuzt (Stempeluhr oder Tag bearbeiten). Mehr als <b>24 Stunden</b> an einem Tag nimmt die App nie an.`],
    freizeitkonto: ["Freizeitkonto und Wochenendarbeit", `Arbeitest du an einem <b>Samstag, Sonntag oder Feiertag</b>, trägst du die Zeit wie gewohnt im Monat ein. Sie zählt <b>nicht zur Gleitzeit</b>, sondern zum separaten <b>Freizeitkonto</b> (Stand in der Woche, auf der Übersicht und unter „Einstellungen“). Abgebaut wird es mit der Art <b>Freizeitausgleich</b> an einem Arbeitstag: Das Tagessoll wird vom Freizeitkonto abgebucht, die Gleitzeit bleibt unberührt. Einen Startstand legst du unter „Einstellungen“ fest.`],
    demo: ["Demo-Modus", `Unter <b>${weg("einstellungen")} → Demo-Modus</b> (bei leerer App auch als Angebot auf der Übersicht) lässt sich die App mit Beispieldaten ausprobieren. Die Demo nutzt eine eigene, getrennte Datenbank. Ihre Beispieltage sind zufällig und passen zu deinen Regeln (Profil): kein Homeoffice, wenn das Profil keins hat, nur deine Arbeitstage, nichts aus abgeschalteten Teilen. „Beispieldaten neu laden“ würfelt neu, ein anderes Profil auch. Deine echten Daten bleiben unberührt. „Demo beenden“ führt zurück zu deinen echten Daten. Regeln lassen sich in der Demo nicht ändern.`],
    planung: ["Urlaub planen", `Unter <b>${weg("urlaub")} → Urlaubsplanung</b> trägst du künftigen Urlaub, Gleittage, angesparten Urlaub oder Familientage ein: Art wählen, Von und Bis setzen. Die Vorschau zeigt, wie viele Tage eingetragen werden (Wochenenden, Feiertage und freie Tage zählen nicht) und wie viel Urlaub oder wie viele Gleittage danach übrig sind. Mit „Eintragen“ stehen die Tage sofort im Monat und werden vom Anspruch abgezogen. Unter „Geplant“ siehst du alle kommenden Zeiträume, kannst sie löschen und für den Kalender einzelne Zeiträume anhaken. <b>In Kalender übernehmen</b> gibt sie direkt an den Kalender des Geräts (iPhone: „Alle hinzufügen“), <b>Kalender (.ics)</b> speichert die Datei. Vergangene Tage sind nie dabei.`],
    export: ["Export und Teilen", `Unter <b>${weg("export")}</b> gibt es PDF, Word, ODT, ODS, Excel, Markdown, Text, JSON, XML, CSV, die komplette Datenbank (DB) und einen <b>Kalender</b> (.ics) mit Urlaub, Gleittagen und Krank, auch direkt mit „in Kalender übernehmen“. Mit dem Schalter „Teilen statt Herunterladen“ öffnet sich das Teilen-Menü deines Geräts (iPhone, iPad, Android, aktuelle Browser), um die Datei per Mail, Nachrichten oder in einer anderen App weiterzugeben. Am Handy als App vom Home-Bildschirm gilt immer das Teilen-Menü. Am Rechner (auch in der Desktop-App) kannst du frei wählen.`],
    personen: ["Mehrere Personen auf dem Server (Anmelden, Abmelden, Name ändern, Neu anlegen)", `Dieser Server hat eine Anmeldung: Jede Person hat ihren eigenen Datenordner, niemand sieht die Daten der anderen. <ul><li><b>Anmelden:</b> Auf der Anmeldeseite deinen Namen aus der Liste wählen und das Passwort eingeben.</li><li><b>Neu anlegen:</b> Auf der Anmeldeseite „Neu anlegen“ wählen: Benutzername oder E-Mail-Adresse (es wird nie eine E-Mail verschickt), Anzeigename (freiwillig, sonst der ganze Benutzername), Passwort zweimal, mindestens 8 Zeichen. Danach bist du gleich angemeldet.</li><li><b>Abmelden:</b> im Menü, in der Seitenleiste oder am Handy mit dem Symbol oben neben dem Menü. Dann kann eine andere Person sich anmelden.</li><li><b>Name ändern:</b> unter <b>${weg("einstellungen", "geraete")}</b>: Anzeigename und Benutzername (oder E-Mail-Adresse). Deine Daten hängen an einer festen Kennung, darum bleibst du angemeldet und nichts geht verloren. Der Name gilt auf der Anmeldeseite und bei „Abmelden“.</li><li><b>Meinen Zugang löschen:</b> ebenfalls auf der Karte „Person“, nur mit deinem Passwort. Deine Daten kommen in den Papierkorb des Servers; ein Admin kann sie wiederherstellen oder endgültig löschen.</li><li><b>Admin:</b> Auf einem frisch eingerichteten Server wird die erste angelegte Person Admin.</li></ul>Das Passwort lässt sich hier nicht ändern; bei Verlust setzt ein Admin es zurück (siehe unten). Desktop-App und Android-App synchronisieren mit diesem Server und melden sich dazu mit Benutzername und Passwort an (siehe „Synchronisieren mit eigenem Server mit Anmeldung“).`],
    admin: ["Personen verwalten (nur Admins)", `Unter <b>${weg("einstellungen", "geraete")} → Personen verwalten</b>. Du siehst nie ein Passwort. <ul><li><b>Sperren / Entsperren:</b> Eine gesperrte Person kann sich nicht anmelden; ihre Daten bleiben.</li><li><b>Passwort zurücksetzen:</b> Die Person legt beim nächsten Anmelden ein neues fest.</li><li><b>Admin-Recht geben / nehmen:</b> Es bleibt immer mindestens ein Admin, der nicht gesperrt ist.</li><li><b>Löschen:</b> Die Daten kommen in den Papierkorb des Servers. Ordner, die der Server übernommen hat, bleiben, wo sie sind.</li><li><b>Neu anlegen freigeben / sperren:</b> Steuert, ob auf der Anmeldeseite neue Personen angelegt werden können. Gibt es noch keine Person, ist es immer frei.</li><li><b>Papierkorb:</b> Eine Person wiederherstellen (mit neuem Benutzernamen; das Passwort legt sie beim ersten Anmelden fest) oder endgültig löschen. Endgültig ist nicht rückgängig zu machen.</li></ul>`],
    handy_sicherung: ["Verschlüsselte Sicherung in der Handy-App", `Nur in der Android-App (nicht in der Web-App): Unter <b>Sicherung</b> legt die App eine <b>verschlüsselte</b> Kopie aller Daten (AES-256) in deinen Cloud-Speicher (Google Drive). So gehst du vor: <ol><li>Ein <b>Passwort</b> festlegen (mindestens 8 Zeichen) und an einem sicheren Ort notieren.</li><li>„Automatisch sichern“ einschalten und wählen, wie oft: täglich, wöchentlich oder bei jeder Änderung. Hat sich nichts geändert, entsteht keine neue Datei.</li><li>Wählen, wie viele Sicherungen bleiben (ältere löscht die App selbst, aber nur die dieses Geräts).</li></ol>„Jetzt sichern“ legt sofort eine Sicherung an. „Aus Sicherung wiederherstellen“ ersetzt alle Daten durch den gewählten Stand. Der jetzige Stand wird vorher gesichert. Auf einem neuen Gerät brauchst du dafür das Passwort. <b>Ohne das Passwort ist die Sicherung nicht lesbar.</b> Es wird nirgends gespeichert, niemand kann es zurücksetzen, auch nicht der Hersteller der App. Schlägt eine Sicherung fehl (kein Netz, Speicher voll), steht der Grund in der Karte. Die Daten in der App bleiben unverändert, und die App versucht es nach einer Viertelstunde wieder. Gesichert wird nur die Datenbank der App. Die App sendet nichts an Dritte und misst nichts. Für die Sicherung öffnet sie selbst keine Verbindung: Sie legt die Datei in den Cloud-Ordner deines eigenen Kontos, den Rest erledigt dein Gerät. Verbindungen gibt es nur bei der Synchronisierung, die du selbst einrichtest (verschlüsselt, an deinen eigenen Server oder dein GitHub-Repo). Unter Android nimmt außerdem die Gerätesicherung von Google die Datenbank mit (von der App nicht eigens verschlüsselt, ab Android 12 nur auf Geräten mit Verschlüsselung). Passwort-Schlüssel und GitHub-Token sind davon ausgenommen. Wer das nicht möchte, schaltet in den Android-Einstellungen die Google-Sicherung für Apps aus.`],
    web_ohne_server: ["Web-App ohne Server (iPhone, iPad, Browser)", `Die App gibt es auch als Web-App, die ganz im Browser deines Geräts läuft: Es gibt keinen Server, der deine Daten sieht. <ol><li>Die Adresse der App in Safari öffnen.</li><li>Teilen-Symbol antippen, dann <b>„Zum Home-Bildschirm“</b>. Ab jetzt die App nur noch über dieses Symbol starten und erst dort Daten eintragen: Die App vom Home-Bildschirm hat einen eigenen Speicher, getrennt von Safari.</li><li>Unter <b>Sicherung</b> ein Passwort festlegen, „Sicherung erstellen“ antippen und die Datei mit „In Dateien sichern“ ablegen (zum Beispiel in iCloud Drive).</li></ol><b>Deine Daten liegen nur im Speicher des Browsers auf diesem Gerät.</b> Das Gerät kann diesen Speicher leeren (Platzmangel, „Website-Daten löschen“, im Safari-Tab nach einigen Wochen ohne Besuch). Die App erinnert deshalb nach ${SICHERN_NACH_TAGEN} Tagen an die Sicherung. Mit der gespeicherten Datei und dem Passwort stellst du alles wieder her, auch auf einem neuen Gerät. Mit anderen Geräten synchronisiert diese Fassung über ein eigenes Repo bei GitHub oder über den eigenen Server, der sie ausliefert (siehe „Synchronisieren zwischen Handy und Desktop“).<br><b>Datenschutz:</b> Die Programmdateien kommen von einer öffentlichen Adresse (beim ersten Start und bei einer neuen Version, rund 8 MB). Der Betreiber dieser Adresse sieht dabei wie bei jeder Webseite deine IP-Adresse, aber keine Eingaben. Gerechnet und gespeichert wird nur auf deinem Gerät. Die App sendet keine Daten, außer bei der Synchronisierung, die du selbst einrichtest (nur verschlüsselt, an deinen eigenen Server oder dein GitHub-Repo). Nach dem ersten Start läuft sie auch ohne Internet. Zum Rechnen bringt diese Fassung Python als WebAssembly mit (Pyodide).`],
    sync_aus: ["Synchronisieren abschalten und Geräte zählen", `Die Seite <b>Synchronisieren</b> zeigt unter „Geräte in der Synchronisierung“, wie viele Geräte gerade synchronisieren, dieses mitgezählt. Unter <b>${weg("einstellungen", "module")}</b> schaltest du „Synchronisieren“ für dieses Gerät ab. Es meldet sich dann mit einer letzten Synchronisierung ab und synchronisiert nicht mehr, weder von Hand noch automatisch noch als Speicherort. Die anderen Geräte synchronisieren weiter, solange es mindestens zwei sind. Ist ein Gerät allein übrig, schaltet es die Synchronisierung von selbst ab. Wieder einschalten geht auf jedem Gerät unter „Module“; danach wartet das Gerät, bis ein zweites wieder mitmacht.`],
    github: ["Synchronisieren über GitHub einrichten (Schritt für Schritt)", `<p>Alle Geräte (iPhone, iPad, Windows, Android, eigener Server) legen ihre Einträge verschlüsselt in <b>ein privates Repo in deinem GitHub-Konto</b>. Das Passwort bleibt auf deinen Geräten, GitHub sieht nur verschlüsselte Dateien. Die Geräte müssen sich nicht gegenseitig erreichen.</p>
      <p><b>1. Repo anlegen (einmal, bei GitHub):</b></p><ol><li>Oben rechts <b>+ → New repository</b>.</li><li>Name zum Beispiel <b>zeiterfassung-daten</b>, <b>Private</b> wählen, sonst nichts ankreuzen, <b>Create repository</b>.</li></ol>
      <p><b>2. Token anlegen (einmal, bei GitHub):</b></p><ol><li>Profilbild → <b>Settings</b> → links unten <b>Developer settings</b> → <b>Personal access tokens → Fine-grained tokens → Generate new token</b>.</li><li>Name frei, Ablauf nach Wunsch (höchstens ein Jahr).</li><li><b>Repository access: Only select repositories</b>, nur das Daten-Repo.</li><li><b>Permissions → Repository permissions → Contents: Read and write</b>.</li><li><b>Generate token</b>, das Token (beginnt mit „github_pat_“) sofort kopieren und im Passwort-Manager speichern. GitHub zeigt es nur einmal.</li></ol>
      <p><b>3. Erstes Gerät verbinden (hier in der App):</b></p><ol><li><b>${weg("sync")}</b> öffnen.</li><li>Ein <b>Passwort</b> festlegen (mindestens 8 Zeichen, auf allen Geräten dasselbe). Am iPhone das „starke Passwort“ von Safari nicht übernehmen, sondern selbst eintippen oder aus dem Passwort-Manager einsetzen.</li><li>Bei <b>GitHub als Speicherort</b> das Repo als <b>konto/zeiterfassung-daten</b> und das Token eintragen, <b>Mit GitHub verbinden</b>. Es muss „privates Repo“ dastehen.</li><li><b>Jetzt synchronisieren</b>. Danach läuft es von selbst: wenige Sekunden nach jeder Änderung, beim Öffnen und beim Zurückkehren in die App und sonst alle 15 Minuten (Web-App: solange sie offen ist). Eine offene Seite schaut außerdem alle 2 Minuten bei der eigenen App nach, ob die Synchronisierung im Hintergrund etwas übernommen hat, und zeigt es dann an. Das ist keine Synchronisierung: Dabei geht nichts zu GitHub oder zu anderen Geräten. Eilt es, auf die Wolke oben tippen oder <b>Jetzt synchronisieren</b>. Wer das nicht möchte, schaltet <b>Automatisch synchronisieren</b> aus und synchronisiert nur noch von Hand (Jetzt synchronisieren oder die Wolke oben).</li></ol>
      <p><b>4. Weitere Geräte:</b> dort dasselbe wie in Schritt 3, mit demselben Passwort, Repo und Token. Zwischen Windows und Android geht es auch mit <b>Geräte koppeln</b> per Code, dann kommen Repo und Token von selbst mit.</p>
      <p><b>Bei der ersten Synchronisierung</b> kommen Einträge, die nur auf einem Gerät stehen, ohne Rückfrage auf alle anderen. Ist derselbe Tag auf zwei Geräten verschieden, entscheidest du unter „Konflikte“. Bei einem eigenen Profil steht dort der Titel „Profil <Name>“ mit einer Kurzbeschreibung; entschieden wird je Profil.</p>
      <p><b>Wenn etwas nicht geht:</b></p><ul><li>„GitHub ist … nicht erreichbar“: keine Verbindung ins Internet. Später noch einmal, die Daten bleiben unverändert.</li><li>„GitHub lehnt das Token ab …“: Token abgelaufen, falsch kopiert, für ein anderes Repo oder ohne „Contents: Read and write“. Neues Token anlegen, „Verbindung trennen“ und neu verbinden.</li><li>„Das Passwort passt nicht …“: Auf den Geräten gelten verschiedene Passwörter. Hier das Passwort der anderen Geräte eingeben.</li><li>„… ist ungültig und wurde nicht übernommen“: ein Gerät hat eine ältere Version. Alle Geräte auf dieselbe Version bringen.</li><li>Gerät verloren: bei GitHub das Token löschen und ein neues anlegen, dazu auf den anderen Geräten ein neues Passwort für die Synchronisierung setzen. Das verlorene Gerät kennt den Schlüssel zum alten Passwort.</li></ul>`],
    profile: ["Profile: fest, eigene, ein- und ausschalten", `Unter <b>${weg("einstellungen", "module")} → Vorbelegung (Profile)</b> setzt „Anwenden“ einen fertigen Satz Regeln ab heute, dazu Akzentfarbe und Hell oder Dunkel. Fest dabei sind <b>Büro + Homeoffice</b> (Blau, hell): 40 Stunden, 30 Urlaubstage, HO-Grenze 80 %, alle Module an, <b>Nur Büro</b> (Türkis, hell): 40,5 Stunden, 28 Urlaubstage, kein Homeoffice, weniger Seiten, und <b>Nur Homeoffice</b> (Grün, hell): wie „Büro + Homeoffice“, aber ohne Büro-Tage und ohne HO-Spielraum. Beim ersten Start fragt die App „Wie arbeitest du?“: Das gewählte Profil gilt dann für alle Tage und ist die Voreinstellung. Bis zur Wahl gilt „Büro + Homeoffice“. Für dich selbst legst du dir am besten ein eigenes Profil an. Weitere feste Profile kann der Betrieb als Datei in den Ordner „profile“ im Datenordner legen. Mit dem Schalter in jeder Zeile blendest du ein Profil aus der Auswahl aus; das gilt für dieses Gerät, schon angewendete Regeln bleiben. „Datei“ lädt ein Profil herunter, „Profil aus Datei übernehmen“ legt es als eigenes Profil an, zum Beispiel bei einer Kollegin. Eigene Profile wandern mit der Synchronisierung auf deine anderen Geräte (je Profil ein Eintrag, auch das Löschen), der Schalter zum Ausblenden gilt je Gerät. Alles lässt sich danach unter „Regeln“ und „Module“ ändern und als eigenes Profil speichern. Die Regel „Urlaubstage pro Jahr“ gilt für Jahre, in denen du unter „${weg("urlaub")} → Erweitert“ keinen eigenen Jahresanspruch eingetragen hast.`],
    module: ["Module: Teile der App ein- und ausschalten", `Unter <b>${weg("einstellungen", "module")}</b> schaltest du ab, was du nicht brauchst. Jede Seite des Menüs ist ein Modul (Woche, Monat, HO-Spielraum, Jahresübersicht, ${seitenTitel("urlaub")} mit der Urlaubsplanung, Krankmeldungen, Homeoffice-Übersicht, Export & Auswertung, Sicherung, Synchronisieren, Hilfe), dazu Gleittage, Familientage, angesparter Urlaub, Freizeitkonto, Stempeluhr, Gleitzeit-Konto, einzelne Export-Formate, GitHub und das Koppeln. Nur „Übersicht“ und „Einstellungen“ bleiben immer. Das Profil „Büro + Homeoffice“ und die Werkseinstellungen schalten wieder alles ein. Abgeschaltetes erscheint nirgends mehr, auch nicht im Menü und in dieser Hilfe. Die App rechnet unverändert weiter, vorhandene Einträge bleiben erhalten und sind nach dem Einschalten wieder da. Ein Tag, der schon eine abgeschaltete Art hat (zum Beispiel Gleittag), behält sie. Ist „Synchronisieren“ aus, synchronisiert dieses Gerät nicht mehr: nicht von Hand, nicht automatisch und nicht als Speicherort für andere. „Synchronisieren“ gilt als einziges Modul nur für das Gerät, an dem du es schaltest. Beim Abschalten meldet sich das Gerät mit einer letzten Synchronisierung ab. Die anderen zählen mit: Solange noch mindestens zwei Geräte synchronisieren, läuft die Synchronisierung dort weiter. Ist ein Gerät allein übrig, schaltet es die Synchronisierung von selbst ab. Die Auswahl wird auch synchronisiert und in Profilen mitgespeichert.`],
    tastatur: ["Bedienung mit der Tastatur", `Mit <b>Tab</b> erreichst du alle Knöpfe, Felder und auch die Tage im Monat, die Tage der Woche und die Monate der Jahresübersicht. <b>Enter</b> oder die <b>Leertaste</b> öffnet den gewählten Tag. Im Monat blättern die <b>Pfeiltasten</b> links und rechts, <b>T</b> springt zu heute, <b>Esc</b> schließt ein geöffnetes Blatt. Der erste Druck auf <b>Tab</b> zeigt oben links „Zum Inhalt springen“: Damit überspringst du das Menü. Ist ein Blatt offen, bleibt <b>Tab</b> im Blatt; nach dem Schließen steht der Fokus wieder auf dem Knopf, der es geöffnet hat. Die laufende Stempeluhr (das Band oben) erreichst du ebenfalls mit <b>Tab</b> und öffnest sie mit <b>Enter</b>. Das Menü am Handy hat einen Knopf „Schließen“. Ein Fehler in einem Feld wird am Feld angesagt, damit ihn ein Screenreader vorliest. Im Windows-Kontrastmodus bleiben Knöpfe, Schalter und Auswahl gut erkennbar. Zurück zum heutigen Jahr kommst du mit „Heute“.`],
    gueltigkeit: ["Ab wann gelten geänderte Regeln?", `Standardmäßig <b>ab heute</b>: Vergangene Tage, Gleitzeit-Konto und alte Auswertungen bleiben unverändert. Unter <b>${weg("einstellungen", "arbeitszeit")}</b> kannst du stattdessen ein <b>Datum</b> wählen (auch in der Zukunft, zum Beispiel für einen Wechsel des Arbeitsorts) oder <b>rückwirkend für alle Zeiträume</b> ändern. Die Liste „Gültigkeit der Regeln“ zeigt, was ab wann gilt. Löschst du eine Zeile, gilt wieder die vorherige Regel.`],
    stand_anders: ["Mein Gleitzeit-Stand oder die Soll-Zeiten sind plötzlich anders", `Das passiert, wenn sich Regeln, Feiertage, freie Tage oder Abschnitte auch für vergangene Tage ändern (rückwirkende Änderung oder ein Datum in der Vergangenheit). Trage danach den Gleitzeit-Stand (Einstellungen) mit einem Datum neu ein, damit das Konto wieder stimmt.`]
  };
}
// „Fremde Bausteine und Lizenzen“ unter „Über diese App“: Übersicht und Lizenztexte liegen als Dateien in app/web/lizenzen (in jeder Fassung).
const LIZENZ_ORDNER = "lizenzen/";                              // relativ: gilt auch unter /mobil/ und bei GitHub Pages
const LIZENZ_UEBERSICHT = "DRITTLIZENZEN.md";
const LIZENZ_DATEI = /`([\w.-]+\.txt)`/g;                       // Lizenztexte, die die Übersicht nennt
const LIZENZ_FEHLT = "Der Text ließ sich nicht laden. Bitte später noch einmal versuchen.";
// Aktion: Datei name aus dem Ordner lizenzen laden und als reinen Text zeigen; nach der Übersicht für jeden dort genannten Lizenztext einen Knopf.
async function lizenzZeigen(name) {
  const feld = $("#lizenz-text"), knoepfe = $("#lizenz-dateien");
  let text;
  try {
    const r = await fetch(LIZENZ_ORDNER + name);
    text = r.ok ? await r.text() : LIZENZ_FEHLT;
  } catch (e) { text = LIZENZ_FEHLT; }
  feld.textContent = text;
  feld.hidden = false;
  if (name !== LIZENZ_UEBERSICHT || knoepfe.childElementCount) return;
  for (const datei of new Set(Array.from(text.matchAll(LIZENZ_DATEI), m => m[1]))) {
    const knopf = document.createElement("button");
    knopf.type = "button";
    knopf.className = "lizenz-knopf";
    knopf.dataset.klick = "lizenzZeigen";
    knopf.dataset.arg = JSON.stringify([datei]);
    knopf.textContent = datei;
    knoepfe.append(knopf);
  }
}
// Abschnitt „Fremde Bausteine und Lizenzen“: zu Beginn nur der Knopf für die Übersicht; der Text kommt erst beim Antippen.
const lizenzAbschnitt = () => `<details class="faq lizenzen" data-abschnitt="lizenzen"><summary>Fremde Bausteine und Lizenzen</summary><div>
      <p>Die App bringt fremde Bausteine mit, zum Beispiel Python. Hier stehen sie mit Version und Lizenz, dazu die Lizenztexte.</p>
      <p class="lizenz-dateien"><button type="button" class="lizenz-knopf" data-klick="lizenzZeigen" data-arg="${esc(JSON.stringify([LIZENZ_UEBERSICHT]))}">Übersicht anzeigen</button></p>
      <p id="lizenz-dateien" class="lizenz-dateien"></p><pre id="lizenz-text" class="lizenz-text" tabindex="0" aria-label="Lizenztext" hidden></pre></div></details>`;
// Seite „Hilfe“: Schalter „Leichte Sprache“, Wiki-Link, häufige Fragen (jede Frage ein Abschnitt mit Schlüssel), Über diese App.
async function seiteHilfe() {
  const k = KONFIG, leicht = hilfeIstLeicht(), werte = await hilfeWerte(k), alt = hilfeAltTexte(k, BUNDESLAENDER[k.bundesland]);
  const gilt = s => !HILFE_GILT[s] || HILFE_GILT[s]();
  const f = HILFE_REIHE.filter(gilt).map(s => leicht ? [s, HILFE_LEICHT[s].titel, hilfeFuellen(HILFE_LEICHT[s].text, werte)]
    : HILFE_NORMAL[s] ? [s, HILFE_NORMAL[s].titel, hilfeFuellen(HILFE_NORMAL[s].text, werte)] : [s, ...alt[s]]);
  return `<div class="card"><h2>Hilfe &amp; häufige Fragen</h2>${leichtSchalter(leicht)}<p class="hinweis" data-stil="margin-top:0"><a href="${WIKI}" target="_blank" rel="noopener">Ausführliche Anleitung mit Bildern im Wiki</a>. Hier unten: antippen zum Aufklappen. Die Zahlen und Regeln hier folgen deinen Einstellungen.</p>
    ${f.map(([s, q, a], i) => `<details class="faq" data-abschnitt="${s}"${i === 0 ? " open" : ""}><summary>${q}</summary><div>${a.startsWith("<") ? a : `<p>${a}</p>`}</div></details>`).join("")}</div>
    <div class="card"><h2>Über diese App</h2>
      <p data-stil="margin:0 16px 8px"><b>Zeiterfassung</b><br>© 2026 David Saluda. Alle Rechte vorbehalten.<br>Version <span class="app-version">${APP_VERSION || "–"}</span>${appsLink()}</p>
      <p class="hinweis" data-stil="margin:0 16px 14px">Hinweis zur Entstehung: Erstellt mit Unterstützung von KI (Claude, Anthropic).</p>
      <div data-stil="margin:0 16px 8px">${lizenzAbschnitt()}</div></div>`;
}

// ---- anlauf.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
new MutationObserver(liste => liste.forEach(m => m.addedNodes.forEach(k => {
  if (k.nodeType !== 1) return;
  if (k.dataset.stil !== undefined) stilSetzen(k);
  k.querySelectorAll("[data-stil]").forEach(stilSetzen);
}))).observe(document.documentElement, {childList: true, subtree: true});
new MutationObserver(liste => liste.forEach(m => { if (m.target.matches?.(GEWAEHLT)) gewaehltMelden(m.target); }))
  .observe(document.documentElement, {attributes: true, attributeFilter: ["class"], subtree: true});
$("#seitennav").innerHTML = BEREICHE.map(([b]) => navLink(b)).join("");
// Tableiste: zwei gleich breite Hälften um den Stempelknopf (grundlage.css), damit er auch bei ungleich langen Namen mittig sitzt
const FAB = `<button class="fab" id="fab" aria-label="Stempeluhr"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg></button>`;
const NAV_MITTE = HANDY_NAV.indexOf("+");
// Baut eine Hälfte der Tableiste aus den Links der Bereiche bs.
const navHaelfte = bs => `<div class="nav-haelfte">${bs.map(navLink).join("")}</div>`;
$("#nav").innerHTML = navHaelfte(HANDY_NAV.slice(0, NAV_MITTE)) + FAB + navHaelfte(HANDY_NAV.slice(NAV_MITTE + 1));
$("#reiter").onclick = reiterKlick;
$("#reiter").onkeydown = reiterTaste;
$("#fab").onclick = plusTaste;
$("#menue").onclick = menueBlatt;

weitMq.addEventListener("change", darstellung);
$("#zurueck").onclick = () => { if (history.length > 1) history.back(); else location.hash = Object.hasOwn(UNTERSEITEN, hashTeile()[0]) && hashTeile()[1] ? "#/" + hashTeile()[0] : "#/start"; };   // Unterseite ohne Verlauf: zur Liste
personPruefen((document.cookie.match(/(?:^|; )ho_person=([^;]*)/) || [])[1] || "");
darstellung();
toastFeld();
try { const m = sessionStorage.getItem(EIGEN + "ho_meldung"); if (m) { sessionStorage.removeItem(EIGEN + "ho_meldung"); setTimeout(() => toast(m, 8000), 300); } } catch (e) {}


document.addEventListener("click", async ev => {
  const a = ev.target.closest && ev.target.closest("a.btn[href^='api/']");
  if (a && (a.id === "sich-dl" || a.id === "hs-dl")) handGesichert();   // Sicherung von Hand (Herunterladen oder Teilen): Zeitpunkt merken
  if (a && /\.pdf$/i.test(a.getAttribute("href")) && !(teilenAn() && teilenMoeglich())) {
    ev.preventDefault();
    try { await pdfSpeichern(a.getAttribute("href")); }
    catch (e) { if (e.name === "LadeFehler" || (alsApp() && e.name !== "AbortError")) toastFehler(e.message); else if (e.name !== "AbortError") location.href = a.getAttribute("href"); }
    return;
  }
  if (!a || !/(\.(pdf|docx|odt|ods|xlsx|csv|json|xml|md|txt|ics|db|zsich)|api\/sicherung|api\/abgleich\/datei)$/i.test(a.getAttribute("href"))) return;
  if (alsApp() && !teilenMoeglich()) {                               // App-Ansicht ohne Teilen-Menü: nicht in die Datei hineinlaufen
    ev.preventDefault();
    toast("Herunterladen geht in der App-Ansicht nicht. Bitte die Seite in Safari öffnen.");
    return;
  }
  if (!teilenAn() || !teilenMoeglich()) return;
  ev.preventDefault();
  try { await dateiTeilen(a.getAttribute("href")); }
  catch (e) {
    if (e.name === "AbortError") return;
    if (alsApp()) { toast("Teilen nicht möglich (" + e.message + ")."); return; }
    toast("Teilen nicht möglich (" + e.message + "). Die Datei wird heruntergeladen."); location.href = a.getAttribute("href");
  }
});
// ---- Seitenwechsel
const SEITEN = {start: async () => (await Promise.all([browserWahlHtml(true), seiteStart()])).join(""), tag: seiteTag, monat: seiteMonat, woche: seiteWoche, horest: seiteHoRest, jahr: seiteJahr, urlaub: seiteUrlaub, krank: seiteKrank, steuer: seiteSteuer, export: seiteExport, sicherung: seiteSicherung, sync: seiteSync, einstellungen: seiteEinstellungen, hilfe: seiteHilfe, sondertage: seiteSondertage, monatsnachweis: seiteMonatsnachweis};
// Handy-Design: Kopfleiste (Zurück, Jahr, Menü) bleibt oben stehen (CSS sticky); der Rahmen wird beim Scrollen hinterlegt
window.addEventListener("scroll", () => document.body.classList.toggle("gescrollt", window.scrollY > 6), {passive: true});
// Neue Version: gemerkte Seiten sofort verwerfen (vor dem ersten Zeichnen), sie können Markup der alten Version enthalten
{ const v = document.currentScript ? new URL(document.currentScript.src).searchParams.get("v") : "";
  if (v && speicher.l("ho_appv", "") !== v) { seitenCacheLeeren(); speicher.s("ho_appv", v); } }
fetch("api/version").then(r => r.json()).then(d => { if (speicher.l("ho_appv", "") !== d.version) { seitenCacheLeeren(); speicher.s("ho_appv", d.version); } APP_VERSION = d.version; const e = $("#app-version"); if (e) e.textContent = d.version; if (d.plattform === "desktop" && !d.fern) beendenKnopf();
  PLATTFORM = d.plattform || "server"; FERN = !!d.fern; if (MIT_SYNC.includes(PLATTFORM)) syncStart(); netzAutomatik(); githubAutomatik(); voreinstellungUebernehmen();
  // Dienst-Skript (sw.js): Die Oberfläche bleibt im Gerät, die App startet vom Home-Bildschirm auch ohne Verbindung. Nur auf dem Server.
  if (PLATTFORM === "server" && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (PLATTFORM === "browser" && seitenName() === "start" && sichernFaellig()) zeigen();
}).catch(() => { APP_VERSION = speicher.l("ho_appv", ""); const e = $("#app-version"); if (e && APP_VERSION) e.textContent = APP_VERSION; });
// Erster Start auf diesem Gerät (noch keine Farbe und kein Hell/Dunkel gewählt): Darstellung des Voreinstellungs-Profils übernehmen.
// Wer schon etwas gewählt hat, behält es; die Regeln ändert das nicht.
async function voreinstellungUebernehmen() {
  if (speicher.l("ho_akzent", "") || speicher.l("ho_farbe", "")) return;
  try {
    const v = (await api("GET", "/profile")).voreinstellung;
    if (!v || speicher.l("ho_akzent", "") || speicher.l("ho_farbe", "")) return;
    if (v.akzent) speicher.s("ho_akzent", v.akzent);
    if (v.farbe) speicher.s("ho_farbe", v.farbe);
    darstellung(); if (seitenName() === "einstellungen") zeigen();
  } catch (e) { /* ohne Verbindung: beim nächsten Start */ }
}
window.addEventListener("online", () => { OHNE_NETZ = false; zeigen(); });
window.addEventListener("offline", () => { if (PLATTFORM !== "browser") zeigen(); });      // die eigenständige Web-App rechnet im Gerät und braucht kein Netz
$("#j-zurueck").onclick = () => setJahr(jahr - 1);
$("#j-vor").onclick = () => setJahr(jahr + 1);
$("#j-heute").onclick = () => setJahr(heute.getFullYear());
// Symbolleiste oben, auf jeder Seite: „Heute im Monat“ öffnet den Monat beim heutigen Tag (Wunsch vom 17.11.2026)
$("#zu-heute").innerHTML = sym("heute");
$("#farb-knopf").onclick = farbeUmschalten; darstellung();
$("#sync-symbol").onclick = syncSymbolTippen;
$("#zu-heute").onclick = () => { zeitDatum = zeitHeuteIso(); jahr = heute.getFullYear(); monat = heute.getMonth() + 1; window.scrollHeute = true; const ziel = `#/monat/${jahr}/${monat}`; if (location.hash === ziel) zeigen(); else location.hash = ziel; };
// Zurück-Taste über einer Rückfrage: die Rückfrage gilt als abgebrochen, und auch das Blatt darunter schließt (sonst bliebe es über der neuen Seite)
window.addEventListener("hashchange", () => { if (blattZuRueck) { const r = blattZuRueck; blattZuRueck = null; r(); } blattZu(); zeigen(); });
const OHNE_SPERRE = ["syncScannen"];                                // derselbe Knopf beendet das Lesen des QR-Codes
setInterval(() => {
  gleitzeitLaufend();
  if (!stempelDaten || !stempelDaten.laeuft) return;
  const s = uhr(stempelSekunden());
  [$("#b-uhr"), $("#s-uhr")].forEach(e => { if (e) e.textContent = s; });
}, 1000);
if (seitenName() !== "start") stempelLaden();              // die Übersicht fragt den Stand selbst ab

document.addEventListener("toggle", ev => { if (ev.target.classList && ev.target.classList.contains("jp-auf")) jpOffen = ev.target.open; }, true);
// Ein Feld im Blatt, das den Fokus bekommt, ganz in den sichtbaren Bereich holen (große Schrift: sonst lag es am unteren Rand halb verdeckt; Befund der Design-Prüfung 17.11.2026)
$("#blatt-inh").addEventListener("focusin", e => {                     // nur das Blatt scrollen, nie die Seite dahinter
  const inh = e.currentTarget; if (e.target === inh) return;
  const f = e.target.getBoundingClientRect(), r = inh.getBoundingClientRect(), unten = Math.min(r.bottom, innerHeight) - 12;
  if (f.bottom > unten) inh.scrollTop += f.bottom - unten; else if (f.top < r.top + 12) inh.scrollTop -= r.top + 12 - f.top;
});
$("#sprung").onclick = () => $("#inhalt").focus();   // Tastatur: am Menü vorbei direkt zum Inhalt (kein Link: #inhalt wäre für die Seitenwahl eine Adresse)
zeitWischen($("#inhalt"));                                    // Tag, Woche, Monat: waagrecht wischen blättert (bausteine/zeitnavi.js)
$("#blatt").onclick = e => { if (e.target.id === "blatt") blattZu(); };
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { blattZu(); return; }
  const prim = $("#blatt.auf .knoepfe button.prim") || (document.activeElement?.closest("#tag-daneben") && $("#tag-daneben .knoepfe button.prim"));
  if (e.key === "Enter" && prim && document.activeElement?.matches(":is(#blatt, #tag-daneben) input:not([type=checkbox])")) { e.preventDefault(); document.activeElement.blur(); prim.click(); return; }
  if ((e.key === "Enter" || e.key === " ") && document.activeElement?.matches(TIPPBAR)) { e.preventDefault(); document.activeElement.click(); return; }
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "") || $("#blatt").classList.contains("auf")) return;
  if (rueckTaste(e)) return;                                                         // Strg+Z / ⌘+Z bei offener Rückgängig-Leiste
  if (document.activeElement?.closest("[role=tablist], #tag-daneben")) return;      // Pfeile in der Reiterleiste und in der Spalte bewegen den Fokus, blättern nicht
  if (rasterTaste(e)) return;                                                        // Pfeile im Monats-Raster gehen von Tag zu Tag
  if (zeitTaste(e)) return;
  if ((e.key === "t" || e.key === "T") && seitenName() === "horest") zuHeute();
});


api("GET", "/konfig").then(k => { KONFIG = k.werte; }).catch(() => {}).finally(async () => { await zeigen(); if (seitenName() !== "start") zutunLaden().then(zutunZahl); });   // Zahl am Symbol; die Übersicht fragt selbst

const AKTIONEN = {profilWaehlen, zutunSpaeter, zutunAus, syncGithub, syncGithubTrennen, syncServerAbmelden, geraetEntfernen, monatOeffnen, monatKalender, exportHeute, neuLaden, appBeenden, browserWaehlen, syncAlle, syncDateiWaehlen, syncJetzt, profilAnwenden, profilSpeichern, profilLoeschen, profilDateiWaehlen, personAbmelden, personUmbenennen, benutzerAendern, selbstLoeschen, adminLoeschen, adminPasswort, adminSperren, adminRolle, adminNeuAnlegen, adminPapierkorbLeeren, adminPapierkorbZurueck, syncKoppeln, syncKoppelnAnnehmen, syncScannen, syncOrdner, syncPasswort, syncServer, syncWahl, abschnittBearbeiten, akzentStandard, anspruchSpeichern, bueroSetzen, dateiWaehlen, demoEnde, demoStart, familientageSchalten, freizeitSetzen, gleitzeitSetzen, handyJetzt, handyPasswort, handyWieder, heuteEintragen, kontoLoeschen, kontoSpeichern, monatAnsicht, monatBlaettern, rueckgaengig, planAlle, planArtWaehlen, planEintragen, planLoeschen, planZuruecksetzen, regelnSpeichern, regelnStandard, regelnVersionWeg, schritt, stempelBlatt, uebertragAuto, uebertragSpeichern, urlaubAnsicht, werkseinstellungen, wiederherstellen, zeitBlaettern, zeitHeute, zeitKalender, tagBearbeiten, zuHeute, handyDateiWaehlen, handyWiederDatei, zeigen, nachweisHeute, datenPruefen, appPruefen, jahreswechselAnsparen, jahreswechselErledigt, einrichtungWeiter, einrichtungZurueck, einrichtungFertig, einrichtungUeberspringen, rundgang, rundgangStart, rundgangEnde, blattZu, syncEinrichten, syncWegWaehlen, syncWeiter, syncZurueck, syncAbbrechen, syncFertig, syncAlleWege, hilfeLeicht, lizenzZeigen};
const WECHSEL = {modulSchalten, profilSchalten, profilImport, familientageSchalten, hoModusWahl, syncAuto, syncEinlesen, syncFreigabe, syncOberflaeche, dateiNameZeigen, handyAuto, handyBehalten, handyDateiName, handyRhythmus, exportMonatWaehlen, exportJahrWaehlen, planKalenderLink, teilenSchalten, nachweisMonatWaehlen, nachweisZeitenSchalten, zeitKalenderDatum, monatDatum};
document.addEventListener("click", ev => {
  const e = ev.target.closest && ev.target.closest("[data-klick]");
  if (!e || e.disabled || beschaeftigt(e)) return;
  const f = AKTIONEN[e.dataset.klick];
  if (f) { const r = f(...(e.dataset.arg ? JSON.parse(e.dataset.arg) : [])); if (e.tagName === "BUTTON" && !OHNE_SPERRE.includes(e.dataset.klick)) sperren(e, r); }
});
document.addEventListener("change", ev => {
  const e = ev.target, f = e.dataset && WECHSEL[e.dataset.wechsel];
  if (f) f(e.type === "checkbox" ? e.checked : e.value, e);
});
