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
let KONFIG = {ho_grenze: 80, gleittage_max: 20, familientage_max: 10, fasching_std: 4, bundesland: "BY", heiligabend_frei: true, silvester_frei: true, wochenstunden: 40, arbeitstage: "Mo,Di,Mi,Do,Fr", pausen: [[360, 30]], urlaub_tage: 30, zutun_sicherung_tage: 14, zutun_saldo_grenze: 40, zutun_saldo_minus: 40, kind_krank_dienst: "gesetzlich", dienstverhaeltnis: "angestellt", zusatzurlaub_art: "keiner", zusatzurlaub_tage: 0, zeitformat: "hhmm"};
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
let SCHREIBEN_OFFEN = 0;                                                // Schreibzugriffe, deren Antwort noch aussteht
let NEUE_VERSION = false, PLATTFORM = "server", FERN = false, KONFLIKTE = 0, OHNE_NETZ = false;
const MIT_SYNC = ["desktop", "android", "browser", "server"];  // die eigenständige Web-App („browser“) hat keinen Cloud-Ordner: Dort tauscht die Person die Sync-Dateien selbst aus
// Einziger Weg zu den Daten: JSON-Anfrage an „api/…“ mit dem JSON-Kopf, den der Server für Schreibzugriffe verlangt. Bei Fehlern wird ein Error mit der
// deutschen Meldung geworfen (ohne Verbindung mit ohneNetz). Sie merkt eine neue App-Version (Kopf X-Version) und stößt nach jeder Änderung den Sync an.
async function api(methode, pfad, body) {
  let r;
  const schreibt = methode !== "GET";
  if (schreibt) SCHREIBEN_OFFEN++;                                   // „Neu laden“ wartet darauf (neuLaden)
  try { r = await fetch("api" + pfad, {method: methode, headers: {"Content-Type": "application/json"}, body: body ? JSON.stringify(body) : undefined}); }
  catch (x) { const e = new Error(KEINE_VERBINDUNG); e.ohneNetz = true; throw e; }   // der Browser meldet hier nur englische Technik („Failed to fetch“)
  finally { if (schreibt) SCHREIBEN_OFFEN--; }
  const person = r.headers.get("X-Zeiterfassung-Person");          // nur hinter dem Anmeldedienst (Anmeldung auf der NAS)
  if (person) abmeldenKnopf(person);
  if (person) ADMIN = r.headers.get("X-Zeiterfassung-Admin") === "1";   // nur Anzeige: jede Admin-Aktion prüft der Anmeldedienst selbst
  const benutzer = r.headers.get("X-Zeiterfassung-Benutzer");      // Anmeldename beim Anmeldedienst (in der Karte „Person“ änderbar)
  if (benutzer && !BENUTZER) { try { BENUTZER = decodeURIComponent(benutzer); } catch (e) { BENUTZER = benutzer; } }
  const version = r.headers.get("X-Version");
  if (version && GELADEN && version !== GELADEN && !NEUE_VERSION) neueVersionMelden();
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(d.fehler || ("Fehler " + r.status)); e.status = r.status; throw e; }   // Status für Rückfragen (409 beim Koppeln)
  if (methode !== "GET" && !pfad.startsWith("/abgleich")) syncBald();
  return d;
}
const COOKIE_SICHER = location.protocol === "https:" ? "; Secure" : "";
const NAMEN = {start: "Übersicht", tag: "Tag", monat: "Monat", woche: "Woche", horest: "HO-Spielraum", jahr: "Jahresübersicht", urlaub: "Urlaub & Gleittage", krank: "Krankmeldungen", steuer: "Homeoffice-Übersicht", export: "Export & Auswertung", sicherung: "Sicherung", sync: "Synchronisieren", einstellungen: "Einstellungen", hilfe: "Hilfe"};
const HANDY_NAV = ["start", "zeit", "+", "homeoffice", "abwesenheit"];   // Bereiche der Tableiste (Entscheidung 19.11.2026); die übrigen stehen hinter „Menü“
// ---- Export-Blatt: Monat, Homeoffice-Übersicht, Kalender und alle Tage (PDF, Excel, CSV, Kalender; Word beim Monatsnachweis)
// Teilen: Auf iPhone, iPad, Android und in aktuellen Desktop-Browsern öffnet die Web-Share-API das Teilen-Menü des Geräts.
// Ist "Teilen" an (oder gibt es keinen Download), wird die Datei geladen und geteilt statt gespeichert; sonst normaler Download.
const TEILEN_MIME = {pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", csv: "text/csv", json: "application/json", ics: "text/calendar", db: "application/octet-stream",
  zsich: "application/octet-stream"};
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
  const n = url.split("?")[0].match(/monatsnachweis\/(\d{4})\/(\d{1,2})(?:\/mit-zeiten)?\.pdf$/);
  if (n) return `Monatsnachweis-${n[1]}-${n[2].padStart(2, "0")}.pdf`;
  const m = url.match(/monat\/(\d{4})\/(\d{1,2})\.pdf$/), s = url.match(/steuer\/(\d{4})\.pdf$/), j = url.match(/jahr\/(\d{4})\.pdf$/);
  if (j) return `Jahresrueckblick-${j[1]}.pdf`;
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
// 15 Minuten (Wunsch vom 18.11.2026): eigene Änderungen gehen ohnehin nach 5 Sekunden hinaus, beim Zurückkehren in die App wird sofort synchronisiert (höchstens einmal je Minute, nicht ohne Netz).
const SYNC_TAKT = 900000;
const SYNC_BALD_MS = 5000;                                           // so lange nach der letzten Änderung warten
const SEITE_TAKT = 120000;                                           // offene Seite neu zeichnen, wenn sich der Datenstand geändert hat (nur lokal, ohne Netz)
const ZURUECK_ABSTAND_MS = 60000;                                    // beim Zurückkehren höchstens einmal je Minute synchronisieren
const NACH_ZEICHNEN_MS = 1500;                                       // Sync und Update-Prüfung erst so lange nach dem ersten Zeichnen (Befund „Start hängt“)
const NETZ_WARTEN_MS = 15000;                                        // Abruf bei der Ablage des Servers: höchstens so lange (Netz ohne Antwort)
// Signal für fetch, das nach NETZ_WARTEN_MS abbricht; ältere Browser ohne AbortSignal.timeout warten wie bisher.
const netzFrist = () => AbortSignal.timeout?.(NETZ_WARTEN_MS);
// Das Gerät meldet keine Verbindung: Automatische Abrufe ins Netz unterbleiben (sie hingen sonst bis zum Zeitlimit).
const ohneNetz = () => navigator.onLine === false;
let ersteSeiteGezeichnet;
const ERSTE_SEITE = new Promise(ok => { ersteSeiteGezeichnet = ok; });   // erfüllt anlauf.js nach dem ersten zeigen()
// Startet aufgabe erst NACH_ZEICHNEN_MS nach dem ersten Zeichnen der Seite: Die Übersicht steht, bevor Sync oder Update-Prüfung Netz und Rechenkern belegen.
const nachErsterSeite = aufgabe => ERSTE_SEITE.then(() => setTimeout(aufgabe, NACH_ZEICHNEN_MS));
// Web-App und Server-Oberfläche: Führt aufgabe beim Zurückkehren in die App aus, höchstens einmal je ZURUECK_ABSTAND_MS (auch seit dem Start) und nie ohne Netz.
function zurueckGedrosselt(aufgabe) {
  let zuletzt = Date.now();
  document.addEventListener("visibilitychange", () => {
    if (document.hidden || ohneNetz() || Date.now() - zuletzt < ZURUECK_ABSTAND_MS) return;
    zuletzt = Date.now();
    aufgabe();
  });
}
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
  if (s.allein) toast("Synchronisieren abgeschaltet: Kein anderes Gerät synchronisiert mehr");
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
// manuell (nur true zählt): „Jetzt synchronisieren“ geht auch mit Automatik aus und schließt ein offenes Rückgängig; sonst wartet der Dienst wie die Automatik.
async function githubSync(manuell) {
  manuell = manuell === true;
  if ((document.hidden && !LETZTER_OFFEN) || !syncErlaubt() || (!manuell && (!autoLokal() || ohneNetz()))) return;
  try {
    const s = await api("GET", "/abgleich");
    if (!s.github || !s.passwort) return;
    const n = await api("POST", "/abgleich/jetzt", manuell ? {} : {automatik: true});
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
  BALD = setTimeout(syncNachAenderung, SYNC_BALD_MS);
}
// Sync nach einer Änderung; solange Rückgängig offen ist, später noch einmal (wie die Automatik von Desktop und Server: kein Stand geht hinaus, den Rückgängig zurücknimmt).
function syncNachAenderung() {
  if (rueckId) return syncBald();
  githubSync(); if (!KEINE_ABLAGE) netzSync();
}
// Eigenständige Web-App: Gleicht beim Öffnen, alle 15 Minuten und beim Zurückkehren in die App mit GitHub ab.
function githubAutomatik() {
  if (PLATTFORM !== "browser") return;
  githubSync();
  setInterval(githubSync, SYNC_TAKT);
  zurueckGedrosselt(githubSync);                                         // ruft ohne Argument: Das Ereignis gälte sonst als „manuell“
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
  if (PLATTFORM !== "browser" || !EIGEN || netzLaeuft || !syncErlaubt() || ohneNetz()) return null;
  netzLaeuft = true;
  try {
    const r = await fetch(ABLAGE, {cache: "no-store", signal: netzFrist()});
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
        const roh = await fetch(ABLAGE + "/" + encodeURIComponent(d.name), {cache: "no-store", signal: netzFrist()});
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
      const antwort = await fetch(ABLAGE + "/" + encodeURIComponent(name), {method: "PUT", headers: {"Content-Type": "application/json"}, body: JSON.stringify({daten: await dateiBase64(meine), nachweis}), signal: netzFrist()});
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
  setInterval(() => { if (autoLokal() && !rueckId) netzSync(); }, SYNC_TAKT);            // netzSync schließt sonst ein offenes Rückgängig
  zurueckGedrosselt(() => { if (autoLokal() && !rueckId) netzSync(); });
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
// Rückfrage vor Abmelden und Beenden: gilt je Gerät wie die Akzentfarbe; „aus“ nach „Nicht mehr fragen“ oder dem Schalter unter Aussehen.
const ABMELDE_FRAGE = "ho_abmeldefrage", ABMELDE_FRAGE_AUS = "aus", ABMELDE_FRAGE_AN = "an";
const NICHT_MEHR_FRAGEN = "Nicht mehr fragen";
// Fragt vor dem Abmelden oder Beenden nach, solange dieses Gerät es nicht abgeschaltet hat. Rückgabe: true heißt weitermachen.
async function vorAbmeldenFragen(text, ja) {
  if (speicher.l(ABMELDE_FRAGE, ABMELDE_FRAGE_AN) === ABMELDE_FRAGE_AUS) return true;
  return frage(text, ja, false, {text: NICHT_MEHR_FRAGEN, merken: () => speicher.s(ABMELDE_FRAGE, ABMELDE_FRAGE_AUS)});
}
// Meldet nach Rückfrage beim Anmeldedienst ab (JSON-Kopf wie jeder Schreibzugriff) und lädt neu: Danach kommt seine Anmeldeseite, dort lässt sich die Person wechseln.
async function personAbmelden() {
  if (!(await vorAbmeldenFragen("Wirklich abmelden?\n\nDanach kommt die Anmeldeseite.", "Abmelden"))) return;
  try { await fetch("abmelden", {method: "POST", headers: {"Content-Type": "application/json"}, body: "{}"}); } catch (e) { toastFehler(KEINE_VERBINDUNG); return; }
  seitenCacheLeeren(); location.reload();
}
// Desktop-Fassung: „App beenden“ in der Fußzeile (wichtig, wenn die App als gewöhnlicher Tab läuft und kein eigenes Fenster hat)
function beendenKnopf() {
  const f = $(".fuss"); if (!f || $("#app-beenden")) return;
  f.insertAdjacentHTML("beforeend", `<span class="fuss-strich"> · </span><button type="button" id="app-beenden" class="link" ${kl("appBeenden")}>App beenden</button>`);
  $("#seitennav").insertAdjacentHTML("beforeend", `<button type="button" id="nav-beenden" ${kl("appBeenden")}>App beenden</button>`);
}
// Web-App ohne Server auf GitHub Pages: Nur dort liegt die Datenschutzerklärung datenschutz.html (weitergabe_bauen.py legt sie ins App-Repo).
// Dieselbe Web-App vom eigenen Server (…/mobil/) hat sie nicht: Die Seite nennt GitHub als Hoster.
function aufPages() {
  return PLATTFORM === "browser" && location.hostname.endsWith(".github.io");
}
const DATENSCHUTZ_SEITE = "datenschutz.html";     // Datenschutzerklärung der Pages-Seite (weitergabe_bauen.py)
// Link „Datenschutz“ der Fußzeile: zeigt ab Werk auf den Hilfe-Eintrag, auf GitHub Pages auf die eigene Datenschutzerklärung.
function datenschutzLink() {
  const a = $("#datenschutz-link"); if (aufPages() && a) a.href = DATENSCHUTZ_SEITE;
}
// Beendet die Desktop-App nach Rückfrage und zeigt dann eine Abschlussseite.
async function appBeenden() {
  if (!(await vorAbmeldenFragen("Die Zeiterfassung beenden?\n\nAlle Eingaben sind gespeichert.", "Beenden"))) return;
  try { await api("POST", "/desktop/beenden", {}); } catch (e) { toastFehler(e.message); return; }
  document.body.innerHTML = `<main class="beendet"><h1>Zeiterfassung beendet</h1><p>Alle Eingaben sind gespeichert. Dieses Fenster kannst du schließen.</p></main>`;
}
// Verwirft die gemerkten Seiten im Browser-Speicher (ho_seite_…).
function seitenCacheLeeren() { try { Object.keys(localStorage).filter(k => k.startsWith(EIGEN + "ho_seite_")).forEach(k => localStorage.removeItem(k)); } catch (e) {} }
// Verwirft die gemerkten Seiten und lädt die App neu.
// „Neu laden“ (nur auf Klick): erst laufende Schreibzugriffe (Speichern, Synchronisieren auch mit GitHub) und den Austausch mit der Ablage
// fertig werden lassen, sonst bräche er mittendrin ab. Ein offenes Rückgängig wird regulär geschlossen (die Änderung bleibt).
// Ohne Server übernimmt start.js beim Neustart das wartende Dienst-Skript. Gewartet wird höchstens NEU_LADEN_HOECHSTENS_MS:
// Hängt der Rechenkern (z. B. GitHub ohne Antwort), käme der Sync nie zurück und der Knopf täte sonst nichts.
async function neuLaden() {
  const bis = Date.now() + NEU_LADEN_HOECHSTENS_MS;
  while ((netzLaeuft || SCHREIBEN_OFFEN > 0) && Date.now() < bis) await new Promise(ok => setTimeout(ok, NEU_LADEN_WARTEN_MS));
  if (rueckId) rueckSchliessen(true);
  seitenCacheLeeren(); location.reload();
}
// ---- Neue Version der Web-App (Server und ohne Server): beim Zurückkehren in die App und alle 15 Minuten nur bei der eigenen Adresse nachfragen.
// Windows und Android fragen stattdessen nach dem neuesten Release (Einstellungen › Geräte).
const MIT_VERSIONSPRUEFUNG = ["server", "browser"];
const VERSION_TAKT = 900000;
const NEU_LADEN_WARTEN_MS = 200;
const NEU_LADEN_HOECHSTENS_MS = 5000;                   // länger wartet niemand auf einen Knopf; ein normaler Sync ist binnen weniger Sekunden fertig
const NEUE_VERSION_MELDUNG = "Es gibt eine neue Version der App. Bitte neu laden.";
// Merkt sich die neue Version und setzt das Band sofort oben über die Seite, ohne sie neu zu zeichnen: offene Eingaben und Blätter bleiben.
function neueVersionMelden() {
  if (NEUE_VERSION) return;
  NEUE_VERSION = true;
  toast(NEUE_VERSION_MELDUNG);
  $("#inhalt")?.insertAdjacentHTML("afterbegin", neueVersionBand());
}
// Startet die Nachfrage für Server und Web-App ohne Server.
function versionBeobachten() {
  if (!MIT_VERSIONSPRUEFUNG.includes(PLATTFORM)) return;
  setInterval(versionPruefen, VERSION_TAKT);
  zurueckGedrosselt(versionPruefen);
  if (PLATTFORM === "browser") navigator.serviceWorker?.getRegistration().then(wartendeBeobachten).catch(() => {});
}
// Fragt einmal nach: Der Server nennt seine Version in jeder Antwort (api() vergleicht X-Version), ohne Server lädt der Browser das Dienst-Skript neu.
// Ohne Verbindung still: beim nächsten Mal noch einmal.
async function versionPruefen() {
  if (document.hidden || NEUE_VERSION || ohneNetz()) return;
  try {
    if (PLATTFORM === "browser") await (await navigator.serviceWorker.getRegistration())?.update();
    else await api("GET", "/version");
  } catch (e) { /* ohne Verbindung: später noch einmal */ }
}
// Ohne Server: Ein neues Dienst-Skript lagert die Dateien ein und wartet dann (mobil/web/sw.js); sobald es wartet, kommt der Hinweis.
function wartendeBeobachten(reg) {
  if (!reg) return;
  const pruefen = () => { if (reg.waiting && navigator.serviceWorker.controller) neueVersionMelden(); };
  const folgen = w => w?.addEventListener("statechange", pruefen);
  folgen(reg.installing);
  reg.addEventListener("updatefound", () => folgen(reg.installing));
  pruefen();
}
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
const PLAN_VORLAUF_MONAT = 11;                                                    // ab diesem Monat planen Urlaub, Sondertage und Einstellungen auch das Folgejahr (wie zutun.PLAN_VORLAUF_MONAT)
// Jahre zum Planen am Tag d (Date): [J], ab PLAN_VORLAUF_MONAT [J, J + 1]; gleich wie zutun.planungsjahre im Kern.
const planungsjahre = d => d.getMonth() + 1 >= PLAN_VORLAUF_MONAT ? [d.getFullYear(), d.getFullYear() + 1] : [d.getFullYear()];
const FOLGEJAHR_SEITEN = ["urlaub", "sondertage"];                                // starten im letzten Planungsjahr (zurück mit ‹)
// Jahr beim Wechsel von Seite „vorher“ zu „name“ am Tag d: Urlaub und Sondertage öffnen im letzten Planungsjahr, wenn das laufende Jahr gewählt ist;
// wer sie verlässt, kommt aus diesem Folgejahr ins laufende Jahr zurück, damit Jahr, Krank und Einstellungen nicht still im nächsten Jahr stehen. Sonst bleibt j.
function startJahr(name, vorher, j, d) {
  const rein = FOLGEJAHR_SEITEN.includes(name), jetzt = d.getFullYear(), folge = planungsjahre(d).at(-1);
  if (rein === FOLGEJAHR_SEITEN.includes(vorher)) return j;
  if (rein) return j === jetzt ? folge : j;
  return j === folge ? jetzt : j;
}
// Jahr-Leiste ‹ Jahr › Heute: auf den Jahresseiten und unter Einstellungen › Arbeitszeit; dort reicht sie höchstens bis zum letzten Planungsjahr.
// „Heute“ ist nur im laufenden Jahr hervorgehoben, sonst sähe ein Folgejahr (Urlaub ab 1.11.) wie das heutige aus.
function jahrLeiste(name, unter) {
  const arbeitszeit = name === "einstellungen" && unter === "arbeitszeit", bis = planungsjahre(heute).at(-1);
  if (arbeitszeit) jahr = Math.min(jahr, bis);
  $("#j-anzeige").textContent = jahr;
  document.querySelector(".jahr").style.display = JAHRESSEITEN.includes(name) || arbeitszeit ? "" : "none";
  $("#j-vor").disabled = arbeitszeit && jahr >= bis;
  $("#j-heute").classList.toggle("anderes-jahr", jahr !== heute.getFullYear());
}
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
  jahr = startJahr(name, zeigen.letzteSeite?.split("/")[0], jahr, heute);
  jahrLeiste(name, teile[1]);
  const b = bereichVon(name)[0];
  reiterZeichnen(name);
  $("#titel").textContent = kopfTitel(name, teile[1]);
  hilfeKnopfSetzen(name);
  document.body.dataset.seite = name;
  if (!zeitDaneben()) zeitDanebenZu();
  document.title = fensterTitel(name) + " · Zeiterfassung";
  const eltern = elternSeite(name, teile[1]);
  $("#zurueck").classList.toggle("da", zurueckDa(name));
  $("#zurueck").classList.toggle("unter", !!eltern);                 // Unterseite: Pfeil auch in der Web-Darstellung, sonst fehlt der Weg zur Liste
  $("#zurueck").setAttribute("aria-label", zurueckName(eltern));
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
    zeigen.y = scrollGemerkt();                                       // zurück aus der Hilfe: Position der Seite wie vor dem „?“
    if (zeigen.letzte !== undefined) scrollTo(0, zeigen.y || 0);
    // Andere Seite oder Unterseite durch Bedienung (nicht beim ersten Laden): Fokus auf die neue Überschrift, damit der Screenreader den Wechsel ansagt und
    // Tab auf der neuen Seite weitergeht. Blättern (Monat, Woche) und die Reiter behalten ihren Fokus.
    const seite = name + "/" + unterseiteName(name, teile[1]);
    if (zeigen.letzte !== undefined && seite !== zeigen.letzteSeite && !document.activeElement?.closest("[role=tablist]")) $("#titel").focus({preventScroll: true});
    zeigen.vorige = zeigen.letzte; zeigen.letzte = location.hash; zeigen.letzteSeite = seite;   // vorige: Ziel des Zurück-Pfeils einer Unterseite
  }
  try { if (demoLaden) await demoLaden; const html = await SEITEN[name](); if (mein !== zeigenZaehler) return; OHNE_NETZ = false; const y = zeigen.y ?? scrollY; zeigen.y = null; $("#inhalt").innerHTML = baender() + reiterHuelle(html); beschriften($("#inhalt")); scrollTo(0, y); speicher.s(merk, demoBanner() + html); if (window.nachher) { window.nachher(); window.nachher = null; } }
  catch (e) {
    if (mein !== zeigenZaehler) return;
    const alt = e.ohneNetz ? speicher.l(merk, "") : "";               // ohne Verbindung: die zuletzt gesehene Fassung bleibt stehen, klar gekennzeichnet
    OHNE_NETZ = !!e.ohneNetz;
    $("#inhalt").innerHTML = alt ? OHNE_NETZ_BAND + reiterHuelle(alt) : reiterHuelle(meldung(e.message) + `<div class="knoepfe">${neuLadenKnopf(e)}<a class="btn" href="#/start">Zur Übersicht</a></div>`);
    if (alt) beschriften($("#inhalt"));
  }
}
// Knopf „Neu laden“ auf der Fehlerseite, nur wenn die App nicht bereit ist (503 vom Dienst-Skript, Rechenkern hängt): Ein neuer Start hilft dann, „Zur Übersicht“ nicht.
const NICHT_BEREIT_STATUS = 503;
const neuLadenKnopf = e => e.status === NICHT_BEREIT_STATUS ? `<button class="btn" ${kl("neuLaden")}>Neu laden</button>` : "";
const OHNE_NETZ_BAND =`<div class="demo-band" role="status"><span><b>Keine Verbindung</b> · Anzeige vom letzten Stand, Eintragen geht erst wieder mit Verbindung</span><button ${kl("zeigen")}>Neu versuchen</button></div>`;
// Wechselt das Jahr und zeichnet neu.
function setJahr(j) { jahr = j; zeigen(); }
// Blättert den gewählten Monat um d vor oder zurück (mit Jahreswechsel).
function monatWechsel(d) { monat += d; if (monat < 1) { monat = 12; jahr--; } if (monat > 12) { monat = 1; jahr++; } }


// ---- Homeoffice-Modus (Regeln): mit Grenze, ohne Grenze, kein Homeoffice, nur Homeoffice (Wunsch vom 17.11.2026)
const HO_MODI = {grenze: "mit Grenze", ohne: "ohne Grenze", kein: "kein Homeoffice", nur: "nur Homeoffice"};
// Dienstverhältnisse für das Jahreslimit „Kind krank“ (Einstellungen und Hilfe)
const KIND_KRANK_DIENSTE = {"gesetzlich": "Gesetzlich (§ 45 SGB V)", "beamte_by": "Beamte Bayern (UrlMV)", "eigen": "Eigener Wert"};   // wie konfig.KIND_KRANK_DIENSTE
const ZUSATZURLAUB_ARTEN = {"keiner": "Keiner", "schwerbehinderung": "Schwerbehinderung", "eigen": "Eigener Wert"};   // wie konfig.ZUSATZURLAUB_ARTEN
const DIENSTVERHAELTNISSE = {"angestellt": "Angestellte und andere", "beamte_by": "Beamte Bayern", "eigen": "Eigene Frist"};   // wie konfig.DIENSTVERHAELTNISSE (Frist des Resturlaubs)
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
// Mit zwei Orten fällt ein leerer weg („Büro –“ sah wie ein Fehler aus); sind beide leer, bleiben beide mit „–“.
const orteText = (ho, dst) => einOrt() ? `Arbeitszeit ${(einOrt() === "ho" ? ho : dst) || "–"}` : [ho && `HO\u00a0${ho}`, dst && `Büro\u00a0${dst}`].filter(Boolean).join(" · ") || "HO\u00a0– · Büro\u00a0–";   // Ort und Wert je eine Angabe
const ortVersteckt = (ort, wert) => einOrt() && einOrt() !== ort && !wert ? ' data-stil="display:none"' : "";   // ein alter Wert am anderen Ort bleibt sichtbar
// Unsichtbare Ortswahl für den Fall, dass es nur einen Arbeitsort gibt.
const festerOrt = id => `<div class="seg" id="${id}" data-stil="display:none"><button type="button" data-v="${einOrt()}" class="on"></button></div>`;
// ---- Gemeinsame Bausteine (Release 25.11.2026: je Muster eine Quelle). Texte kommen fertig maskiert, die Bausteine maskieren nicht noch einmal.
// Segment-Umschalter: wahl [[Wert, Text]], akt der gewählte Wert. o: id, klasse (zu „seg“), name (data-n), label (aria-label) oder beschriftet (aria-labelledby),
// klick (Name aus AKTIONEN, bekommt den Wert), knopfId (Vorsilbe der Knopf-Ids). Ohne klick trägt jeder Knopf data-v; aria-pressed hält danach GEWAEHLT aktuell.
const segHtml = (wahl, akt, o = {}) => `<div class="seg${o.klasse ? " " + o.klasse : ""}"${o.id ? ` id="${o.id}"` : ""}${o.name ? ` data-n="${o.name}"` : ""} role="group"${o.label ? ` aria-label="${o.label}"` : ""}${o.beschriftet ? ` aria-labelledby="${o.beschriftet}"` : ""}>${wahl.map(([k, t]) => `<button type="button"${o.knopfId ? ` id="${o.knopfId}${k}"` : ""} class="${k === akt ? "on" : ""}" aria-pressed="${k === akt}" ${o.klick ? kl(o.klick, k) : `data-v="${k}"`}>${t}</button>`).join("")}</div>`;
// Wert-Zeile „Name … Wert“ (Karten Woche, Tag, Urlaub, Sondertage, Steuer); klasse färbt den Wert (z. B. „saldo plus“), zeile ist die Klasse der Zeile, id die Kennung der Zeile,
// mehr weitere Attribute der Zeile (z. B. md(…)).
const wertZeile = (name, wert, klasse = "", zeile = "zeile gr", id = "", mehr = "") => `<div class="${zeile}"${id ? ` id="${id}"` : ""}${mehr}><span>${name}</span><b${klasse ? ` class="${klasse}"` : ""}>${wert}</b></div>`;
// Karte mit Titel als Abschnitt (Muster export.js): id ist die Kennung des h2, o.klasse weitere Klassen der Karte, o.mehr weitere Attribute (z. B. md(…)).
const karteMitTitel = (id, titel, inhalt, o = {}) => `<section class="card${o.klasse ? " " + o.klasse : ""}" aria-labelledby="${id}"${o.mehr || ""}><h2 id="${id}">${titel}</h2>${inhalt}</section>`;
// Tabelle in der Hülle .tbl (Jahr, Urlaub, Export, Monatsnachweis): kopf [Text] oder [[Text, Attribute]] als th scope="col", zeilen fertige <tr>-Zeilen;
// o.klasse und o.label (aria-label) der Tabelle, o.huelle weitere Klasse der Hülle, o.nach HTML hinter der Tabelle in der Hülle.
const tabelleHtml = (kopf, zeilen, o = {}) => `<div class="tbl${o.huelle ? " " + o.huelle : ""}"><table${o.klasse ? ` class="${o.klasse}"` : ""}${o.label ? ` aria-label="${o.label}"` : ""}><thead><tr>${kopf.map(k => [].concat(k)).map(([t, a = ""]) => `<th scope="col"${a}>${t}</th>`).join("")}</tr></thead><tbody>${zeilen}</tbody></table>${o.nach || ""}</div>`;
// Karte eines Kontos (Einstellungen „Person“): Titel nach Modul (gleitzeit, freizeit), das Modul blendet die Karte mit aus; inhalt fertiges HTML.
const KONTO_TITEL = {gleitzeit: "Gleitzeit-Konto", freizeit: "Freizeitkonto"};
const kontoKarte = (modul, inhalt) => `<div class="card"${md(modul)}><h2>${KONTO_TITEL[modul]}</h2>${inhalt}</div>`;
// Leer-Zustand einer Liste oder Karte („Keine.“, „Noch nichts geplant.“); tag p, wo er in einem Absatz-Fluss steht.
const leerHtml = (text, tag = "div") => `<${tag} class="leer">${text}</${tag}>`;
// Auswahl mit Etikett und „Heute“ (Export, Monatsnachweis): werte [[Wert, Text]], wechsel der Name aus WECHSEL, heute das kl(…) des Knopfs, was der Satz für den Screenreader, mehr weitere Attribute des Felds.
const auswahlHeute = (id, etikett, werte, gewaehlt, wechsel, heute, was, mehr = "") => `<label for="${id}">${esc(etikett)}</label><div class="feld-heute"><select id="${id}" data-wechsel="${wechsel}"${mehr}>${werte.map(([w, t]) => `<option value="${w}"${w === gewaehlt ? " selected" : ""}>${esc(t)}</option>`).join("")}</select><button type="button" class="heute-knopf" ${heute}>Heute<span class="sr">: ${esc(was)}</span></button></div>`;
// Quote-Kopf (Monat, Jahr, Kacheln „Quote Monat“ und „Quote Jahr“): Ring links, rechts Titel, Werte und ein Zusatz (Marke); ohne Ring (ein Ort, Jahr ohne Prognose) nur der Text.
// Passt der Text nicht daneben (schmale Kachel, große Schrift), rückt er unter den Ring (.hero bricht um).
const quoteKopfHtml = (q, quote, rot, titel, werte, zusatz = "", mitRing = true) => `<div class="hero">${mitRing ? ring(q, quote, rot) : ""}<div class="txt">${titel}${werte}${zusatz}</div></div>`;
// Aktionen des Kopfs ‹ Titel ›: Tag, Woche und Monat teilen ein Datum (zeitnavi.js), der Spielraum blättert nur Monate (jahr, monat).
const KOPF_ZEIT = {blaettern: r => kl("zeitBlaettern", r), heute: "zeitHeute", datum: "zeitKalenderDatum"};
const KOPF_SPIELRAUM = {blaettern: r => kl("monatBlaettern", r, false), heute: "zuHeute", datum: "monatDatum"};
// Namen der Knöpfe je Einheit (zurück, vor, Kalender) und die Klasse der Überschrift.
const KOPF_NAMEN = {tag: ["Vorheriger Tag", "Nächster Tag", "Tag", ""], woche: ["Vorherige Woche", "Nächste Woche", "Woche", "kw-kopf"], monat: ["Vorheriger Monat", "Nächster Monat", "Monat", ""]};
// Kopf ‹ Titel › mit Kalender und „Heute“ (Tag, Woche, Monat, Spielraum): titel fertiges HTML, kalId Id des Datumsfelds, wert sein Datum (ISO), a die Aktionen.
const kopfHtml = (einheit, titel, kalId, wert, a = KOPF_ZEIT) => { const [zurueck, vor, kal, klasse] = KOPF_NAMEN[einheit]; return `<div class="kopf"><button ${a.blaettern(-1)} aria-label="${zurueck}">‹</button><h2${klasse ? ` class="${klasse}"` : ""}>${titel}</h2>
    <div class="kopf-rechts"><span class="kal-wahl"><button type="button" ${kl("zeitKalender", "#" + kalId)} aria-label="${kal} im Kalender wählen">${sym("monat")}</button><input id="${kalId}" type="date" value="${wert}" ${ZEIT_KAL_GRENZEN} data-wechsel="${a.datum}" tabindex="-1" aria-hidden="true"></span><button class="heute-knopf" ${kl(a.heute)}>Heute</button><button ${a.blaettern(1)} aria-label="${vor}">›</button></div></div>`; };
// Ist eine Seite abgeschaltet (Modus, Modul oder in dieser Fassung ohne Sync)?
const URLAUB_KURZ = "Urlaub";                                          // Name der Urlaub-Seite, wenn das Modul „Gleittage“ aus ist
// Name einer Seite für Titel und Menü: ohne Gleittage heißt „Urlaub & Gleittage“ nur „Urlaub“.
function seitenTitel(n) { return n === "urlaub" && !modulAn("gleittage") ? URLAUB_KURZ : NAMEN[n]; }
const navWeg = n => (n === "horest" && !mitGrenze()) || (n === "steuer" && hoModus() === "kein") || !modulAn(SEITE_MODUL[n] || "") || (n === "sync" && !MIT_SYNC.includes(PLATTFORM)) || (n === "sondertage" && !SONDERTAGE_MODULE.some(modulAn));
// Blendet ganz abgeschaltete Bereiche in Seitenleiste und Tableiste aus und setzt ihre Namen (hängen an Homeoffice-Modus und Modulen).
function navAnpassen() {
  document.body.dataset.ohne = (KONFIG.module_aus || []).join(" ");
  stempelAnzeige();                                                   // Symbol und Beschriftung der Stempel-Taste
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
// Luft unter der Kennzahlen-Spalte bis zum Fensterrand.
const KLEBE_LUFT = 12;
// Kennzahlen-Spalte am breiten Rechner: klebt nur, wenn sie schon an ihrer Stelle ganz ins Fenster passt (Stempeluhr und Monats-PDF ohne Rollen sichtbar);
// sonst rollt sie mit der Seite, eine höhere klebende Spalte ließe ihr Ende bis zum Ende der Liste unerreichbar.
function monatKlebt() {
  const g = document.querySelector("#inhalt .monat-grid"), l = g?.querySelector(".links");
  if (!l) return;
  const vorher = getComputedStyle(l).position === "sticky", klebt = g.getBoundingClientRect().top + scrollY + l.offsetHeight + KLEBE_LUFT <= innerHeight;
  l.classList.toggle("klebt", klebt);
  if (vorher && !klebt) l.querySelector("details.jp-auf")?.scrollIntoView({block: "nearest"});   // die klebende Spalte springt an ihre Stelle zurück: das gerade Aufgeklappte bleibt im Bild (schmal klebt sie nie, monat.css)
}
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
const ZUTUN_RELEASE = "https://github.com/davidsaluda/zeiterfassung-app/releases/latest";   // einzige fremde Adresse (update.RELEASE_SEITE), nur als Link
const ZUTUN_ZIEL = /^#\/[\w\/-]*$/;
const WIKI = "https://github.com/davidsaluda/zeiterfassung-app/wiki";   // Anleitung mit Bildern; nur ein Link (neues Fenster), die App lädt von dort nichts (Hilfe und Zu tun)
// Link ins Wiki (neues Fenster, nur angeklickt), seite leer für die Startseite oder "/Seite#abschnitt"; mehr: weitere Attribute (feste Namen).
const wikiLink = (text, seite = "", mehr = "") => `<a href="${WIKI}${seite}" target="_blank" rel="noopener"${mehr}>${text}</a>`;
// Grenzen der Karte „Zu tun“, bis die Regeln eigene Werte haben (wie die Voreinstellung im Rechenkern). Die Sicherungs-Grenze liefert der Rechenkern immer als wirksame Zahl.
const zutunSicherungTage = k => k.zutun_sicherung_tage;
const zutunSaldoGrenze = k => k.zutun_saldo_grenze ?? 40;
// Gleitzeit-Grenze im Minus (Regel zutun_saldo_minus, 0 = kein Hinweis), Spiegel zu zutunSaldoGrenze; ohne Wert wie Plus. Für Regeln und Hilfe.
const zutunSaldoMinus = k => k.zutun_saldo_minus ?? zutunSaldoGrenze(k);
// ---- Zentrale Behandlung von Klicks und Änderungen (ersetzt onclick/onchange im HTML)
function monatBlaettern(richtung, mitAdresse) { monatWechsel(richtung); if (mitAdresse) location.hash = "#/monat/" + jahr + "/" + monat; else zeigen(); }
// Kalender des Geräts öffnen. Am Rechner über showPicker(); am Tippgerät (iPhone: weder showPicker() noch click() öffnen dort etwas)
// liegt das unsichtbare Datumsfeld selbst über dem Knopf und nimmt das Tippen an (grundlage.css, .kal-wahl).
function kalenderOeffnen(feld) { const k = $(feld); try { k.showPicker(); } catch (e) { k.focus(); k.click(); } }
function monatDatum(iso) {                       // beliebigen Tag im Kalender gewählt: zu seinem Monat springen
  if (!iso) return;
  jahr = +iso.slice(0, 4); monat = +iso.slice(5, 7);
  if ((location.hash.replace(/^#\/?/, "").split("/")[0] || "monat") === "monat") location.hash = "#/monat/" + jahr + "/" + monat; else zeigen();
}
// ---- darstellung.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Fehlerkasten für Meldungen (role=alert, der Text wird maskiert).
const meldung = t => `<div class="fehler" role="alert">${esc(festText(t))}</div>`;   // Angaben („1970 bis 2200“, „11:30–13:00“) bleiben je eine Zeile
// Formularfehler (WCAG 3.3.1): zeigt text im Kasten box (role=alert, braucht eine id) und verbindet ihn über aria-describedby mit dem Feld, um das es geht;
// das Feld gilt bis zur nächsten Eingabe als fehlerhaft (aria-invalid) und bekommt den Fokus, damit man gleich verbessern kann. Der Dienst nennt das Feld
// nur im Text („Wochenstunden: …“): felder ordnet Textanfänge Feldern zu. Ohne Feld hängt der Kasten am Knopf, der gesendet hat (er behält den Fokus),
// damit der Fehler beim Zurückgehen dorthin wieder hörbar ist.
function formFehler(box, text, {feld = null, felder = []} = {}) {
  box.innerHTML = meldung(text); zahlVorProzentFest(box); box.scrollIntoView({block: "nearest"});   // Zeitspanne der Meldung („00:00 bis 23:59“) bleibt eine Zeile
  const treffer = (felder.find(([anfang]) => text.startsWith(anfang)) || [])[1];
  const f = feld || (treffer && $(treffer)), ziel = f || document.activeElement?.closest("button");
  if (!ziel) return;
  ziel.setAttribute("aria-describedby", box.id);
  if (f) { f.setAttribute("aria-invalid", "true"); f.addEventListener("input", () => f.removeAttribute("aria-invalid"), {once: true}); f.focus(); }
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
// Ebenso Zahl und Einheit („69 Tage“, „15 Minuten“, „08:00 Std.“; Entscheidung des Entwicklers 24.11.2026). „5 Tagessoll“ bleibt: Nach der Einheit muss das Wort enden.
const ZAHL_VOR_EINHEIT = /(?<=\d) (?=(?:Std\.|Stunden?|Min\.|Minuten?|Uhr|\p{L}*[tT]age?n?|Wochen?|Monate?n?|Jahre?n?)(?![\p{L}\d]))/gu;
// Wertpaar zwischen zwei Zahlen („26 von 39“, „0 bis 30“) bleibt eine Angabe: beide Leerzeichen um „von“, „bis“, „aus“.
const WERTPAAR = /(?<=\d) (von|bis|aus) (?=[+−]?\d)/g;
// Zeitspanne zwischen zwei Zahlen („08:00–16:30“) bleibt eine Angabe: nach dem Strich bräche der Browser sonst um; der Wortverbinder U+2060 ist unsichtbar.
const SPANNE = /(?<=\d)–(?=\d)/g;
// Ordnungszahl und Wort („1. Weihnachtstag“, „3. Oktober“) bleiben zusammen; ein Datum davor („31.03. Danach“) nicht, darum keine Ziffer oder Punkt vor der Zahl.
const ORDNUNGSZAHL = /(?<=(?<![\d.])\d{1,2}\.) (?=\p{L})/gu;
// Text mit festen Angaben (nur die Anzeige, gespeicherte Werte bleiben): Zahl und % bzw. Einheit und Wertpaare mit geschütztem Leerzeichen, Zeitspanne mit Wortverbinder.
const festText = t => String(t).replace(ZAHL_VOR_PROZENT, "$1\u00a0%").replace(ZAHL_VOR_EINHEIT, "\u00a0").replace(WERTPAAR, "\u00a0$1\u00a0").replace(SPANNE, "–\u2060").replace(ORDNUNGSZAHL, "\u00a0");
// Wendet festText auf alle Texte unter wurzel an.
function zahlVorProzentFest(wurzel) {
  const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
  for (let n = gang.nextNode(); n; n = gang.nextNode()) {
    const fest = festText(n.data);
    if (fest !== n.data) n.data = fest;
  }
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
// Kurztext „Kommen–Gehen · Pause …“ eines Tages (leer ohne Kommen). Mit mehreren Einträgen (GET /woche, /monat; Wunsch vom 23.11.2026) zählt nur ihre eigene
// Pause, denn die gespeicherte enthält die Lücke dazwischen; einzeln (Seite Tag, die Einträge stehen darunter mit Pause): „· 2 Einträge“ statt der Pause,
// auch an einem Tag ohne Uhrzeit (Lücke als Pause zu lang, etwa über Mitternacht).
const uhrText = (z, einzeln) => einzeln && z.eintraege?.length ? (z.kommen ? `${z.kommen}–${z.gehen} · ` : "") + `${z.eintraege.length} ${z.eintraege.length === 1 ? "Eintrag" : "Einträge"}` : !z.kommen ? "" : `${z.kommen}–${z.gehen} · Pause ${z.eintraege?.length ? z.eintraege_pause || hhmm(0) : z.pause}`;
// Pausenregel aus „Regeln“ (wie regeln.pause_auto): je Stufe anteilig, damit die Arbeitszeit nie unter die Schwelle fällt
const pauseAuto = dauer => (KONFIG.pausen || []).reduce(([p, vorher], [ab, pause]) => [dauer > ab ? Math.max(p, Math.min(pause, dauer - ab + vorher)) : p, pause], [0, 0])[0];
// Kappzeit (Auftrag vom 25.11.2026): gilt ab diesem Tag, wie regeln.KAPPZEIT_AB (tests/test_kappzeit.py hält beide gleich)
const KAPPZEIT_AB = "2026-11-26";
// [Regelarbeitszeit [Beginn, Ende] oder null, Tagesgrenze in Minuten oder null] am Tag datum (ISO), wie regeln.kappzeit_regeln mit den heutigen Regeln.
const kappRegeln = datum => !datum || datum < KAPPZEIT_AB ? [null, null] : [KONFIG.regelzeit_an === false ? null : KONFIG.regelzeit || [360, 1200], KONFIG.tagesgrenze_an === false ? null : KONFIG.tagesgrenze_min || 600];
// Tagesrechnung wie regeln.tag_rechnen für die Vorschau: Blöcke b [{k, g, p (Pause von Hand)}] zeitlich sortiert, ohneMin = Stunden ohne Uhrzeit.
// Setzt je Block m (Minuten netto): Kappzeit außerhalb der Regelarbeitszeit, Pflichtpause (Lücken und Pausen von Hand zählen an, nur innerhalb) und Kappzeit über
// der Tagesgrenze ohne Freigabe, beides vom letzten Block rückwärts. Rückgabe: {kapp (Minuten), pause (Pausen von Hand plus Pflichtpause)}.
function tagRechnen(b, ohneMin, datum, freigabe) {
  const [rz, grenze] = kappRegeln(datum), [von, bis] = rz || [0, 2880], summe = f => b.reduce((s, x) => s + f(x), 0);
  const innen = x => Math.max(0, Math.min(x.g, bis) - Math.max(x.k, von));
  const abziehen = n => [...b].reverse().forEach(x => { const weg = Math.min(n, x.m); x.m -= weg; n -= weg; });
  b.forEach(x => { x.m = Math.max(0, innen(x) - x.p); });
  if (!b.length) return {kapp: 0, pause: 0};
  const gesamt = Math.max(0, Math.min(Math.max(...b.map(x => x.g)), bis) - Math.max(b[0].k, von)), vorPause = summe(x => x.m);
  abziehen(Math.max(0, pauseAuto(gesamt) - Math.max(0, gesamt - summe(innen)) - summe(x => Math.min(x.p, innen(x)))));   // Überlappung ist keine negative Lücke (wie regeln._pflichtpause)
  const pause = summe(x => x.p) + vorPause - summe(x => x.m), vorGrenze = summe(x => x.m);
  if (grenze && !freigabe) abziehen(Math.max(0, vorGrenze + ohneMin - grenze));
  return {kapp: summe(x => x.g - x.k - innen(x)) + vorGrenze - summe(x => x.m), pause};
}
// Die Pausenregel als Satz, zum Beispiel „über 06:00 Std. 00:30 Pause“.
const pausenText = (stufen = KONFIG.pausen || []) => stufen.length ? stufen.map(([ab, p]) => `über ${zeitText(ab)} Std. ${zeitText(p)} Pause`).join(", ") : "keine Pause";
// ISO-Datum JJJJ-MM-TT als TT.MM.JJJJ.
const de = d => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
// Stichtag der Kappung „MM-TT“ als „TT.MM.“ (Einstellungen und Hilfe).
const kappungTag = mt => `${String(mt).slice(3)}.${String(mt).slice(0, 2)}.`;

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
  suche: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 20.5 20.5"/>',
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
// Die 6 Akzentfarben (seit 25.11.2026; keine eigene Farbe mehr). Gespeichert wird der Name; Profile tragen den Hex-Wert einer dieser Farben.
const AKZENTE = {blau: "#007aff", gruen: "#30a14e", orange: "#ff9500", rot: "#ff3b30", violett: "#af52de", graphit: "#8e8e93"}, AKZENT_VORGABE = "blau";
const AKZENT_NAMEN = {blau: "Blau", gruen: "Grün", orange: "Orange", rot: "Rot", violett: "Violett", graphit: "Graphit"};   // sichtbarer Name je Farbe
// Farbmodus ohne gespeicherte Wahl: dunkel (Wunsch vom 22.11.2026, design.md F-MO1; index.html startet mit data-theme=dark dazu passend); Grundfarbe für die Statusleiste je Modus (F-F5, wie --bg in grundlage.css)
const FARBE_VORGABE = "dunkel", GRUND_DUNKEL = "#050608", GRUND_HELL = "#f2f3f7";
// Bezug der Akzent-Helfer je Modus (design.md 4.1, Entscheidung Z1): Grundton (dunkel hellster, hell dunkelster Punkt des Verlaufs), Bezugs-Anteil von Weiß
// bzw. Schwarz für den Schimmer (schimmerAnteil), Deckkraft des Glases, --tx-2. Muss zu grundlage.css passen (--bg-oben bzw. --bg-unten, --card, --tx-2).
const AKZENT_BEZUG = {dunkel: ["#0b0d14", 0.12, 0.06, "#bcc1ca"], hell: ["#e8eaf0", 0.08, 0.66, "#3c414d"]};
const SCHIMMER_MAX = 25;   // Prozent Akzent im Glas-Verlauf höchstens; mehr färbt die Seite statt sie zu tönen
// Hintergründe der Seite (26.11.2026), nur auf dem Gerät (ho_hintergrund); die Werte stehen in grundlage.css (--bg-<name>). Verlauf ist der Hintergrund ab Werk.
const HINTERGRUENDE = {verlauf: "Verlauf", aurora: "Aurora", uni: "Uni"}, HINTERGRUND_VORGABE = "verlauf";
const NACHBAR_DREHUNG = 40;   // Grad Farbton: Nachbarton des Akzents für den zweiten Fleck von „Aurora“ (--acc-2)
// Bezugs-Anteil Weiß (dunkel) bzw. Schwarz (hell) für die Flecken von „Aurora“ (Wunsch „kräftiger“, 26.11.2026) und Höchstanteil je Fleck. Grenze ist die feste
// Schrift: dunkel --tx-3 auf der Karte (Achsen, Legende), hell --tx-3 auf dem Grund (Fußzeile), je 4,5:1 (tests/test_akzentfarben.py).
const AURORA_BEZUG = {dunkel: 0.14, hell: 0.09}, AURORA_MAX = 40;
const AKZENT_TOENUNG = 0.14, AKZENT_ZIEL = 4.6, BEDIEN_ZIEL = 3.1;   // stärkste Tönung (--acc-bg); Ziele mit Zuschlag über WCAG 4,5 (Text) und 3 (Bedienelement)
// Name der gespeicherten Akzentfarbe: ein Name aus AKZENTE bleibt, der Hex-Wert einer dieser Farben wird ihr Name. Alles andere (eine bis 25.11.2026
// wählbare Farbe, ein eigener Hex-Wert aus Sicherung, Synchronisierung oder Profil) wird still Blau (hasOwn: Namen wie „toString“ zählen nicht).
function akzentName(a) {
  if (Object.hasOwn(AKZENTE, a)) return a;
  const hex = String(a).toLowerCase();
  return Object.keys(AKZENTE).find(k => AKZENTE[k] === hex) || AKZENT_VORGABE;
}
// Akzentfarbe als #rrggbb zum gespeicherten Wert (akzentName).
const akzentFarbe = a => AKZENTE[akzentName(a)];
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
const farbHell = c => leuchtdichte(c) > 0.75;                    // sehr helle Farben brauchen einen Rand, sonst verschwinden Symbol und Knöpfe
// Anteil des Akzents am Glas-Verlauf in Prozent (--schimmer): so viel, dass der Grund nicht heller (dunkel) bzw. dunkler (hell) wird als mit dem
// Bezugs-Anteil Weiß bzw. Schwarz aus AKZENT_BEZUG, höchstens SCHIMMER_MAX. Kontrast hängt nur an der Leuchtdichte: Was Weiß bzw. Schwarz erfüllt, gilt so für jede Farbe,
// und Blau darf kräftiger tönen als Orange.
// grenze: Leuchtdichte, die der Grund nicht überschreiten (dunkel) bzw. unterschreiten (hell) darf; ab Werk die des Bezugs-Anteils. hoechstens: Deckel in Prozent.
function schimmerAnteil(c, dunkel, grenze = bezugGrenze(dunkel), hoechstens = SCHIMMER_MAX) {
  const grund = AKZENT_BEZUG[dunkel ? "dunkel" : "hell"][0];
  const passt = p => { const L = leuchtdichte(farbMix(grund, c, p / 100)); return dunkel ? L <= grenze : L >= grenze; };
  let p = 0;
  while (p < hoechstens && passt(p + 1)) p++;
  return p;
}
// Leuchtdichte des Grunds mit dem Bezugs-Anteil Weiß (dunkel) bzw. Schwarz (hell); ab Werk der aus AKZENT_BEZUG.
function bezugGrenze(dunkel, bezug = AKZENT_BEZUG[dunkel ? "dunkel" : "hell"][1]) {
  return leuchtdichte(farbMix(AKZENT_BEZUG[dunkel ? "dunkel" : "hell"][0], dunkel ? "#ffffff" : "#000000", bezug));
}
// Anteil des Akzents am Akzent-Fleck von „Aurora“ in Prozent (--aurora): wie schimmerAnteil, mit AURORA_BEZUG und AURORA_MAX.
const auroraAnteil = (c, dunkel) => schimmerAnteil(c, dunkel, bezugGrenze(dunkel, AURORA_BEZUG[dunkel ? "dunkel" : "hell"]), AURORA_MAX);
// Nachbarton des Akzents (--acc-2): Farbton um NACHBAR_DREHUNG Grad gedreht, Sättigung und Helligkeit (HSL) bleiben; Grau bleibt Grau.
function akzentNachbar(c) {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255), max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (!d) return c;
  const s = d / (1 - Math.abs(2 * l - 1)), h = (max === r ? (g - b) / d + 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60 + NACHBAR_DREHUNG;
  const kanal = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)))); };
  return "#" + [0, 8, 4].map(n => kanal(n).toString(16).padStart(2, "0")).join("");
}
// Anteil des Nachbartons am zweiten Fleck von „Aurora“ in Prozent (--aurora-2): höchstens so viel, dass er den Grund nicht weiter verschiebt als der
// Akzent-Fleck. Die Flecken überlappen nie (grundlage.css), so bleibt der Akzent-Fleck die ungünstigste Stelle, für die akzentFlaeche rechnet.
function nachbarAnteil(c, dunkel) {
  const grund = AKZENT_BEZUG[dunkel ? "dunkel" : "hell"][0];
  return schimmerAnteil(akzentNachbar(c), dunkel, leuchtdichte(farbMix(grund, c, auroraAnteil(c, dunkel) / 100)), AURORA_MAX);
}
// Name des gespeicherten Hintergrunds; ein unbekannter Wert (auch aus dem Objekt-Prototyp) wird still Verlauf.
const hintergrundName = h => Object.hasOwn(HINTERGRUENDE, h) ? h : HINTERGRUND_VORGABE;
// Ungünstigste Fläche unter Akzent c auf Hintergrund h: Glas über dem Grund mit dem stärksten Akzent-Anteil (Aurora: --aurora, sonst --schimmer), darauf
// --tx-2 mit 14 %, mit und ohne 14 % Akzent; dunkel die hellere, hell die dunklere. Je Farbe gerechnet, damit jede Akzentfarbe ihr Ziel erreicht (Z1).
function akzentFlaeche(c, dunkel, h = HINTERGRUND_VORGABE) {
  const [grund, , glas, text2] = AKZENT_BEZUG[dunkel ? "dunkel" : "hell"], anteil = h === "aurora" ? auroraAnteil(c, dunkel) : schimmerAnteil(c, dunkel);
  const neutral = farbMix(farbMix(farbMix(grund, c, anteil / 100), "#ffffff", glas), text2, AKZENT_TOENUNG), getoent = farbMix(neutral, c, AKZENT_TOENUNG);
  return (leuchtdichte(getoent) > leuchtdichte(neutral)) === dunkel ? getoent : neutral;
}
// Akzent als Schrift (--acc-fg, F-AK1): 4,6:1 gegen die ungünstigste Fläche des Hintergrunds h; sehr helle Farben hell und sehr dunkle dunkel bekommen feste Ersatzfarben.
function akzentSchrift(c, dunkel = istDunkel(), h = HINTERGRUND_VORGABE) {
  const L = leuchtdichte(c);
  if (!dunkel && L > 0.55) return "#2c2c2e";
  if (dunkel && L < 0.06) return "#e5e5ea";
  return lesbar(c, akzentFlaeche(c, dunkel, h), dunkel ? "#ffffff" : "#000000", AKZENT_ZIEL);
}
// Akzent als Bedienelement (--acc-ui, F-AK2): Fokusring, Rand, Schalter; 3:1 gegen die ungünstigste Fläche des Hintergrunds h und gegen den Seitengrund
// (dunkel) bzw. Weiß (hell).
function akzentBedien(c, dunkel = istDunkel(), h = HINTERGRUND_VORGABE) {
  const zu = dunkel ? "#ffffff" : "#000000";
  return lesbar(lesbar(c, akzentFlaeche(c, dunkel, h), zu, BEDIEN_ZIEL), dunkel ? GRUND_DUNKEL : "#ffffff", zu, BEDIEN_ZIEL);
}
// Rand des Hauptknopfs: sehr helle Farben dunkel umrandet; im Dunkeln wie die Fläche (der rohe Akzent wirkte dort wie ein Fehler-Ring), hell der Akzent.
const akzentRand = (c, dunkel) => farbHell(c) ? "color-mix(in srgb, #000 28%, transparent)" : dunkel ? knopfFarbe(c) : c;
function schriftAufFarbe(c) {                                   // helle Farben bekommen dunkle Schrift, damit Knöpfe lesbar bleiben
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16) / 255).map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#111318" : "#fff";
}
const weitMq = window.matchMedia("(min-width: 900px)");
const GLAS_SCHWACH = 4;                                         // Kerne bzw. GB Speicher: „Automatisch“ schaltet das Glas darunter ab (Unschärfe kostet schwache Geräte Bildrate)
const GLAS_VORGABE = "auto";                                    // Schalter „Glaseffekt“ ab Werk (ho_glas, nur auf dem Gerät)
const GLAS_WERTE = ["auto", "an", "aus"];                       // gültige Werte von ho_glas
// Gültiger Glaswert: unbekannte Werte (alt, kaputt) gelten als GLAS_VORGABE, damit die Seite zeigt, was wirkt.
const glasName = g => GLAS_WERTE.includes(g) ? g : GLAS_VORGABE;
// Glaseffekt aus? „aus“ und „an“ fest; „auto“ und jeder unbekannte Wert nach Gerät: aus bei höchstens GLAS_SCHWACH Kernen oder GB, fehlende Angaben
// zählen als stark. „Transparenz reduzieren“ des Systems schaltet es im CSS immer ab.
function glasAus(wahl, nav = navigator) {
  if (wahl === "aus" || wahl === "an") return wahl === "aus";
  return (nav.hardwareConcurrency || Infinity) <= GLAS_SCHWACH || (nav.deviceMemory || Infinity) <= GLAS_SCHWACH;
}
// System wechselt Hell/Dunkel: bei „Automatisch“ Farben neu rechnen und die Seite neu zeichnen (wie farbeUmschalten, F-AK3)
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (speicher.l("ho_farbe", FARBE_VORGABE) === "auto") { darstellung(); seitenCacheLeeren(); zeigen(); } });
// Wendet die gespeicherten Einstellungen an: Design (Web oder Handy, nur nach der Fensterbreite), Hell oder Dunkel, Glaseffekt, Hintergrund, Akzentfarbe (CSS-Variablen, Cookie für die Exporte, App-Symbol)
// und den Platz der Schnell-Symbole.
function darstellung() {
  const f = speicher.l("ho_farbe", FARBE_VORGABE), a = speicher.l("ho_akzent", AKZENT_VORGABE), dunkel = istDunkel();
  document.body.dataset.design = weitMq.matches ? "web" : "handy";
  if (!zeitDaneben()) zeitDanebenZu();
  if (glasAus(glasName(speicher.l("ho_glas", GLAS_VORGABE)))) document.documentElement.dataset.glas = "aus"; else document.documentElement.removeAttribute("data-glas");
  const h = hintergrundName(speicher.l("ho_hintergrund", HINTERGRUND_VORGABE));   // Verlauf ohne Attribut: genau wie vor der Auswahl
  if (h === HINTERGRUND_VORGABE) document.documentElement.removeAttribute("data-hintergrund"); else document.documentElement.dataset.hintergrund = h;
  if (f === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.dataset.theme = f === "dunkel" ? "dark" : "light";
  const c = akzentFarbe(a);
  document.documentElement.style.setProperty("--acc", c);
  document.documentElement.style.setProperty("--acc-t", schriftAufFarbe(c));
  document.documentElement.style.setProperty("--acc-k", knopfFarbe(c));
  document.documentElement.style.setProperty("--acc-fg", akzentSchrift(c, dunkel, h));
  document.documentElement.style.setProperty("--acc-ui", akzentBedien(c, dunkel, h));
  document.documentElement.style.setProperty("--acc-rand", akzentRand(c, dunkel));
  document.documentElement.style.setProperty("--acc-bg", `color-mix(in srgb, ${c} 14%, var(--card))`);
  document.documentElement.style.setProperty("--schimmer", schimmerAnteil(c, dunkel) + "%");
  document.documentElement.style.setProperty("--acc-2", akzentNachbar(c));
  document.documentElement.style.setProperty("--aurora", auroraAnteil(c, dunkel) + "%");
  document.documentElement.style.setProperty("--aurora-2", nachbarAnteil(c, dunkel) + "%");
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dunkel ? GRUND_DUNKEL : GRUND_HELL;   // Statusleiste in der Grundfarbe, nicht im Akzent
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
// als Logo, Tab-Symbol und Symbol für den Home-Bildschirm (PNG über ein Canvas). Knopf-Fläche statt rohem Akzent: auf hellen Akzenten (etwa Orange) hätte die weiße Uhr sonst unter 3:1.
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
const SYNC_GERAET_NEU = "Nach einer Neuinstallation (zum Beispiel der Web-App am iPhone) zählt das Gerät als neues Gerät mit neuer Kennung. Die alte Kennung bleibt hier stehen, bis du sie entfernst.";
// Liste der anderen Geräte (Kennung kurz, letzter Stand, App-Version) mit Knopf zum Entfernen. Alle Werte kommen aus der App und werden maskiert;
// tage: Grenze für „veraltet“ (sync.VERALTET_TAGE, Feld veraltet_tage der Sync-Antwort).
function syncGeraeteHtml(liste, tage) {
  if (!liste.length) return "";
  // Knopf unter dem Text statt in der Zeile: Der lange Text des Knopfs ließe bei 375 px für die Angaben keinen Platz
  const zeile = g => `<p><b>Gerät ${esc(g.kurz)}</b><br><small>${g.erstellt ? "zuletzt " + esc(zeitpunktText(g.erstellt)) : "Stand unbekannt"}${g.app ? ", Version " + esc(g.app) : ""}${g.abgemeldet ? ", abgemeldet" : ""}${g.veraltet ? `, <b>seit über ${esc(tage)} Tagen nichts Neues: entfernen?</b>` : ""}</small></p>
    <div class="knoepfe"><button type="button" class="gef" ${kl("syncGeraetEntfernen", g.name, g.kurz)} aria-label="Gerät ${esc(g.kurz)} entfernen">Gerät entfernen</button></div>`;
  return `<h3 class="unter">Andere Geräte</h3>${liste.map(zeile).join("")}<p class="hinweis">${SYNC_GERAET_NEU}</p>`;
}
// ---- Sync mit anderen Geräten (nur in den lokalen Fassungen: Desktop, Android, iPhone)
// Seite Synchronisieren: oben die Karte mit Stand, Passwort und „Jetzt synchronisieren“, darunter je Thema eine Karte (Konflikte, Speicherorte,
// GitHub, Koppeln), jede mit eigenem Meldungsfeld. Felder und Aktionen sind dieselben wie in der einen Karte bis 26.11.2026.
async function syncKarte(stand, hinweis) {
  const box = $("#sync-karte"); if (!box) return;
  let s = mitAblageFehler(stand);
  try { s = mitAblageFehler(s || await api("GET", "/abgleich")); }
  catch (e) { box.innerHTML = `<div class="card"><h2>Mit anderen Geräten synchronisieren</h2>${meldung(e.message)}</div>`; return; }
  if (!$("#sync-karte")) return;
  syncSymbol(s);
  if (!SYNC_ALLE && syncFuehren(s)) { syncFuehrungZeigen($("#sync-karte"), s); return; }   // noch nichts eingerichtet: geführt (M6)
  const l = s.letzter, fern = !!s.fern, desktop = s.plattform === "desktop" && !fern, browser = s.plattform === "browser", server = s.plattform === "server", bereit = syncEingerichtet(s) && s.passwort;
  const lokal = desktop || s.plattform === "android";                // Fassungen mit eigenem Speicherort (Server, dieses Gerät)
  KONFLIKTE = s.konflikte.length;
  const letzter = !l ? "noch nie" : zeitpunktText(l.zeit);   // „fehlgeschlagen“ steht in der Beschriftung: Datum und Wort zusammen sprengten bei 375 px die Zeile
  $("#sync-karte").innerHTML = `<div class="card"><h2>Mit anderen Geräten synchronisieren</h2>
      ${wegeHtml(PERSON ? "anmeldedienst" : fern ? "fern" : browser && NETZ ? "netz" : s.plattform)}
      ${fern ? "" : server ? `<p class="hinweis">Handy und Desktop legen ihre Einträge verschlüsselt hier ab. Mit dem Passwort synchronisiert auch diese Seite selbst und zeigt dann denselben Stand wie die Geräte.</p>
      ${window.isSecureContext ? `<div class="zeile"><span>Web-App fürs Handy (läuft auch ohne Verbindung)</span><a class="btn" href="mobil/">Öffnen</a></div>`
        : `<p class="hinweis"><b>Web-App fürs Handy:</b> Sie braucht eine https-Adresse, der das Handy vertraut. Diese Seite ist über http geöffnet (zum Beispiel mit IP und Port). So geht es trotzdem: am iPhone diese Seite hier benutzen (mit Verbindung, auch über VPN) und zum Home-Bildschirm hinzufügen. Die Android-App und die Windows-App synchronisieren auch über IP und Port und laufen ohne Verbindung weiter.</p>`}` : browser && NETZ ? `<p class="hinweis">Diese App synchronisiert von selbst mit dem Server, von dem sie kommt: beim Öffnen, beim Zurückkehren in die App, alle 15 Minuten und mit „Jetzt synchronisieren“. Ohne Verbindung arbeitest du normal weiter, die App synchronisiert es später.</p>` : browser ? `<p class="hinweis">Hält dieses Gerät und deine anderen Geräte auf demselben Stand. Die Web-App kann nicht selbst in einen Cloud-Ordner schreiben. Deshalb tauschst du die verschlüsselten Sync-Dateien von Hand aus:</p>
      <ol class="hinweis"><li>„Jetzt synchronisieren“ wählen, dann „Meine Sync-Datei speichern“ und die Datei in den Sync-Ordner der anderen Geräte legen (zum Beispiel in iCloud Drive; eine ältere Datei ersetzen).</li>
      <li>Aus demselben Ordner die Datei des anderen Geräts wählen („Datei eines anderen Geräts einlesen“).</li></ol>` : `<p class="hinweis">Hält Handy und Desktop auf demselben Stand: Jedes Gerät legt seine Einträge verschlüsselt in denselben Cloud-Ordner und liest die der anderen. Dafür braucht es keinen eigenen Server und keinen fremden Dienst.</p>
      <div class="zeile"><span>Ordner</span><b>${s.ziel.eingerichtet ? esc(HANDY_ZIEL[s.ziel.art]) : "nicht eingerichtet"}</b></div>`}
      <div class="zeile"><span>Geräte beim Synchronisieren<br><small>dieses mitgezählt${s.geraete_weg ? `, ${anzahlText(s.geraete_weg, "ein Gerät hat", "Geräte haben")} sich abgemeldet` : ""}</small></span><b>${s.geraete_aktiv}</b></div>
      ${fern ? "" : syncGeraeteHtml(s.andere_geraete || [], s.veraltet_tage)}
      <div class="zeile"><span class="bez">Zuletzt synchronisiert${l && l.ok ? `<small>${anzahlText(l.geraete, "ein anderes Gerät", "andere Geräte")} gelesen, ${anzahlText(l.uebernommen, "eine Änderung", "Änderungen")} übernommen</small>` : l ? "<small>fehlgeschlagen</small>" : ""}</span><b>${esc(letzter)}</b></div>
      ${l && !l.ok ? meldung(l.fehler) : ""}
      ${l && l.uebersprungen ? `<p class="hinweis">${uebersprungenText(l.uebersprungen)}</p>` : ""}
      ${!l && !fern ? `<p class="hinweis"><b>Vor dem ersten Synchronisieren:</b> Einträge, die nur auf einem Gerät stehen, kommen ohne Rückfrage auf alle anderen. Gefragt wirst du nur, wenn derselbe Tag auf zwei Geräten verschieden ist. Deshalb vorher auf jedem Gerät nachsehen, ob dort nur echte Einträge stehen.</p>` : ""}
      ${l && l.gesperrt ? `<p class="hinweis"><b>Ein anderes Gerät wartet:</b> Um seine Einträge zu lesen, hier einmal das Passwort eingeben (dasselbe wie dort).</p>` : ""}
      ${fern ? "" : s.passwort ? `<label for="sync-pw">Passwort (nur nötig, wenn ein neues Gerät dazukommt)</label><input type="password" id="sync-pw" autocomplete="current-password">${desktop || server ? `
      <details class="auf"><summary>Passwort neu festlegen (auch wenn das alte vergessen ist)</summary>
      <p class="hinweis">Das neue Passwort gilt ab sofort fürs Synchronisieren und für neue Sicherungen. Danach auf jedem anderen Gerät dasselbe neue Passwort festlegen. Ältere Sicherungen öffnet weiter nur das alte Passwort. Deine Einträge bleiben unberührt.</p>
      <label for="sync-pw1">Neues Passwort (mindestens 8 Zeichen)</label><input type="password" id="sync-pw1" autocomplete="current-password">
      <label for="sync-pw2">Neues Passwort wiederholen</label><input type="password" id="sync-pw2" autocomplete="current-password">
      <div class="knoepfe"><button ${kl("syncPasswort")}>Neues Passwort festlegen</button></div></details>` : ""}` : desktop || server ? `<label for="sync-pw1">Passwort für Synchronisieren und Sicherung (mindestens 8 Zeichen, auf allen Geräten dasselbe)</label><input type="password" id="sync-pw1" autocomplete="current-password">
      <label for="sync-pw2">Passwort wiederholen</label><input type="password" id="sync-pw2" autocomplete="current-password">
      <div class="knoepfe"><button ${kl("syncPasswort")}>Passwort festlegen</button></div>
      <p class="hinweis"><b>Ohne dieses Passwort sind die ${server ? "Dateien am Speicherort" : "Dateien im Cloud-Ordner"} nicht lesbar.</b> Es wird nirgends gespeichert. Ein vergessenes Passwort kann niemand auslesen. Du kannst aber jederzeit ein neues festlegen; ältere Sicherungen öffnet weiter nur das alte.</p>` : `<p class="hinweis">Erst unter ${esc(weg("sicherung"))}, Karte „Passwort der Sicherung“, ein Passwort festlegen. Auf allen Geräten dasselbe Passwort verwenden.</p>`}
      ${fern ? "" : `<div class="zeile"><span>Automatisch synchronisieren<br><small>nach jeder Änderung, beim Öffnen und alle 15 Minuten${browser ? ", solange die App offen ist. Aus: nur mit „Jetzt synchronisieren“" : ""}</small></span><input type="checkbox" ${(browser ? autoLokal() : s.auto) ? "checked" : ""}${bereit || browser ? "" : " disabled"} data-wechsel="syncAuto" aria-label="Automatisch synchronisieren"></div>`}
      <div class="knoepfe"><button class="prim" ${kl("syncJetzt")}${bereit ? "" : " disabled"}>Jetzt synchronisieren</button>
        ${browser && bereit && l && l.ok ? `<a class="btn" href="api/abgleich/datei">Meine Sync-Datei speichern</a>` : ""}
        ${browser && bereit ? `<button type="button" ${kl("syncDateiWaehlen")}>Datei eines anderen Geräts einlesen</button><input type="file" id="sync-datei" accept=".zsich,application/octet-stream" hidden data-wechsel="syncEinlesen">` : ""}</div>
      <div id="sync-meldung" role="status">${hinweis ? `<p class="hinweis">${esc(hinweis)}</p>` : ""}</div></div>
    ${syncKonflikteKarte(s)}${desktop ? syncOrdnerKarte(s) : ""}${lokal ? syncServerKarte(s) + syncNetzKarte(s, desktop) : ""}
    ${fern || !modulAn("github") ? "" : syncGithubKarte(s)}${server || browser || fern || !modulAn("koppeln") ? "" : syncKoppelnKarte(s)}`;
  beschriften($("#sync-karte"));
}
// Einzahl- oder Mehrzahl-Text zu einer Anzahl („ein Gerät“, „3 Geräte“).
const anzahlText = (n, eins, viele) => n === 1 ? eins : `${n} ${viele}`;
// Karte „Konflikte“: je Konflikt zwei Wahlknöpfe (der neuere Eintrag hervorgehoben), dazu „Alle auf einmal“; ohne Konflikt ein Satz.
function syncKonflikteKarte(s) {
  // Knopf für eine Seite („hier“ oder „dort“) eines Konflikts; der neuere Eintrag ist hervorgehoben.
  const seite = (k, wo, name) => `<button type="button" class="${k.neuer === wo ? "prim" : ""}" ${kl("syncWahl", k.art, k.schluessel, wo)}>${name}: ${esc(k[wo].text)}<br><small>${k[wo].zeit ? "geändert " + esc(zeitpunktText(k[wo].zeit)) : "ohne Zeitangabe"}${k.neuer === wo ? " · neuer" : ""}</small></button>`;
  const konflikte = s.konflikte.map(k => `<div class="konflikt"><b>${esc(k.titel)}</b><div class="knoepfe">${seite(k, "hier", "Dieses Gerät")}${seite(k, "dort", "Anderes Gerät")}</div></div>`).join("");
  return `<div class="card"><h2>Konflikte${s.konflikte.length ? ` (${s.konflikte.length})` : ""}</h2>
      ${konflikte ? `<p class="hinweis">Diese Einträge wurden auf zwei Geräten verschieden geändert. Bis du entscheidest, gilt hier der Eintrag dieses Geräts. Die App überschreibt nichts von selbst.</p>${konflikte}
      <p class="hinweis" id="sync-alle">Alle auf einmal</p><div class="knoepfe" role="group" aria-labelledby="sync-alle"><button ${kl("syncAlle", "hier")}>Überall dieses Gerät</button><button ${kl("syncAlle", "dort")}>Überall das andere Gerät</button></div>` : `<p class="hinweis">Keine. Wird derselbe Tag auf zwei Geräten verschieden geändert, erscheint er hier, und du entscheidest, welcher Eintrag gilt.</p>`}
      <div id="sync-k-meldung" role="status"></div></div>`;
}
// Karte „Cloud-Ordner“ (Desktop): Pfad des Ordners, den alle Geräte sehen.
function syncOrdnerKarte(s) {
  return `<div class="card"><h2>Cloud-Ordner</h2>
      <label for="sync-ordner">Ganzer Pfad</label><input type="text" id="sync-ordner" autocomplete="off" spellcheck="false" value="${esc(s.ordner || "")}">
      <p class="hinweis">Zum Beispiel der Ordner „Zeiterfassung“ in iCloud Drive oder Google Drive.</p>
      <div id="sync-ordner-meldung" role="status"></div><div class="knoepfe"><button class="prim" ${kl("syncOrdner")}>Ordner speichern</button></div></div>`;
}
// Karte „Eigener Server als Speicherort“ (Desktop, Android): Adresse, Anmeldung mit Benutzername und Passwort (das Passwort behält die App nicht), Abmelden.
function syncServerKarte(s) {
  const anm = s.server_anmeldung || {};
  return `<div class="card"><h2>Eigener Server als Speicherort</h2>
      <label for="sync-server">Adresse des Servers</label><input type="url" id="sync-server" autocomplete="off" spellcheck="false" placeholder="Adresse wie im Browser" value="${esc(s.server || "")}">
      <p class="hinweis">Optional: Adresse der Zeiterfassung im Heimnetz, so wie im Browser. Geht auch mit IP und Port, auch über VPN.</p>
      <label for="sync-s-benutzer">Benutzername (nur bei einem Server mit Anmeldung)</label><input type="text" id="sync-s-benutzer" autocomplete="username" autocapitalize="none" spellcheck="false">
      <label for="sync-s-passwort">Passwort beim Server (wird nicht gespeichert)</label><input type="password" id="sync-s-passwort" autocomplete="current-password">
      ${anm.fehler ? meldung(SERVER_ANMELDUNG_FEHLER[anm.fehler] || SERVER_ANMELDUNG_FEHLER.anmeldung) : ""}
      <div id="sync-srv-meldung" role="status"></div><div class="knoepfe"><button class="prim" ${kl("syncServer")}>Adresse speichern</button></div>
      ${anm.angemeldet ? `<div class="zeile"><span>Beim Server angemeldet als Gerät<br><small>${esc(anm.geraet)}</small></span><button type="button" ${kl("syncServerAbmelden")}>Abmelden</button></div>` : ""}</div>`;
}
// Karte „Im selben Netz“ (Desktop, Android): dieses Gerät als Speicherort für die anderen; am Desktop dazu das Bedienen vom iPhone oder iPad.
function syncNetzKarte(s, desktop) {
  return `<div class="card"><h2>Im selben Netz</h2>
      <div class="zeile"><span>Dieses Gerät als Speicherort<br><small>ohne eigenen Server und ohne Cloud: Die anderen Geräte im selben WLAN oder VPN synchronisieren direkt mit diesem, solange die App hier läuft</small></span><input type="checkbox" ${s.freigabe ? "checked" : ""} data-wechsel="syncFreigabe" aria-label="Dieses Gerät als Speicherort"></div>
      ${s.freigabe_pausiert ? `<p class="hinweis">${SYNC_PAUSIERT}</p>` : ""}
      ${s.freigabe ? `<p class="hinweis">Auf den anderen Geräten unter „Eigener Server als Speicherort“ eintragen: <b>${s.freigabe_adressen.map(esc).join("</b> oder <b>") || "die IP-Adresse dieses Geräts mit :8793"}</b> (die IP, kein Gerätename). Erreichbar ist nur die Ablage der verschlüsselten Sync-Dateien, nicht die App. ${SYNC_IM_NETZ} Fragt Windows nach dem Netzzugriff: für private Netze erlauben.</p>` : ""}
      ${desktop ? `<div class="zeile"><span>Diese Zeiterfassung am iPhone oder iPad bedienen<br><small>ohne Server und ohne Synchronisieren: Das Handy öffnet im selben WLAN oder VPN die Oberfläche dieses Rechners, solange die App hier läuft</small></span><input type="checkbox" ${s.oberflaeche ? "checked" : ""} data-wechsel="syncOberflaeche" aria-label="Diese Zeiterfassung am iPhone oder iPad bedienen"></div>
      ${s.oberflaeche ? (s.oberflaeche.qr ? `<div class="koppel-qr">${s.oberflaeche.qr}</div><p class="hinweis">Am Handy die Kamera auf den Code halten und den Link öffnen (iPhone: Safari). Als Lesezeichen sichern oder über Teilen → „Zum Home-Bildschirm“ ablegen. Das Handy zeigt und ändert dann die Daten dieses Rechners. <b>Den Code niemandem zeigen:</b> Wer ihn hat, kann im selben Netz deine Zeiten lesen und ändern. Die Verbindung ist nicht verschlüsselt, deshalb nur im eigenen WLAN oder VPN nutzen. Aus- und wieder Einschalten macht den alten Code ungültig. Am Handy gilt der Zugang 30 Tage, danach den Code noch einmal scannen. Fragt Windows nach dem Netzzugriff: für private Netze erlauben.</p>` : `<p class="hinweis">Dieser Rechner ist gerade in keinem Netz. Bitte WLAN oder Netzwerkkabel prüfen.</p>`) : ""}` : ""}
      <div id="sync-netz-meldung" role="status"></div></div>`;
}
// Karte „GitHub als Speicherort“: verbunden mit Repo und Trennen, sonst die Anleitung mit Repo und Token.
function syncGithubKarte(s) {
  return `<div class="card"><h2>GitHub als Speicherort</h2>${s.github ? `<div class="zeile"><span>Verbunden mit<br><b>${esc(s.github.repo)}</b><br><small>${s.github.privat ? "privates Repo" : "öffentliches Repo"}</small></span></div>
      ${s.github.privat ? "" : `<p class="hinweis"><b>Dieses Repo ist öffentlich.</b> Deine Sync-Dateien sind verschlüsselt, aber jeder kann sie abrufen. Sicherer ist ein privates Repo.</p>`}
      <div id="sync-gh-meldung" role="status"></div><div class="knoepfe"><button type="button" class="gef" ${kl("syncGithubTrennen")}>Verbindung trennen</button></div>` : `<p class="hinweis">Von überall erreichbar, ohne eigenen Server und ohne VPN: Jedes Gerät legt seine Einträge verschlüsselt in ein eigenes Repo bei GitHub (privat oder öffentlich). So richtest du es ein:</p>
      <ol class="hinweis"><li>Bei GitHub ein leeres Repo nur zum Synchronisieren anlegen, am besten privat.</li><li>Unter Settings → Developer settings → Fine-grained tokens ein Token anlegen: nur für dieses Repo, Berechtigung „Contents: Read and write“.</li><li>Repo und Token hier eintragen. Weitere Geräte bekommen beides beim Koppeln per Code von selbst.</li></ol>
      <label for="sync-gh-repo">Repo (konto/name)</label><input type="text" id="sync-gh-repo" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="konto/name">
      <label for="sync-gh-token">Token</label><input type="password" id="sync-gh-token" autocomplete="off">
      <div id="sync-gh-meldung" role="status"></div><div class="knoepfe"><button type="button" class="prim" ${kl("syncGithub")}>Mit GitHub verbinden</button></div>`}</div>`;
}
// Karte „Geräte koppeln“: Code anzeigen (mit Passwort) oder den Code des anderen Geräts eingeben bzw. scannen (Android).
function syncKoppelnKarte(s) {
  return `<div class="card"><h2>Geräte koppeln</h2>
      <p class="hinweis">Ohne Adresse und Passwort zu tippen: Beide Geräte müssen im selben WLAN oder VPN sein. Auf dem einen Gerät „Code anzeigen“, auf dem anderen den Code eingeben. Danach synchronisieren beide von selbst miteinander, in beide Richtungen. ${SYNC_IM_NETZ}</p>
      ${s.kopplung ? `<div class="koppel-qr">${s.kopplung.qr}</div><p class="koppel-code" aria-label="Kopplungs-Code">${esc(s.kopplung.code)}</p><p class="hinweis">Diesen Code am anderen Gerät scannen (Android-App: „QR-Code scannen“) oder eingeben. Er gilt noch ${Math.ceil(s.kopplung.sekunden / 60)} Minuten und für genau ein Gerät.</p>` : ""}
      <div class="knoepfe"><button type="button" ${kl("syncKoppeln")}${s.passwort ? "" : " disabled"}>${s.kopplung ? "Neuen Code anzeigen" : "Code anzeigen"}</button></div>
      ${s.passwort ? "" : `<p class="hinweis">Zum Anzeigen eines Codes erst ein Passwort festlegen. Zum Eingeben eines Codes ist keines nötig.</p>`}
      <label for="sync-code">Code vom anderen Gerät</label><input type="text" id="sync-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="24">
      <div id="sync-kp-meldung" role="status"></div><div class="knoepfe"><button type="button" class="prim" ${kl("syncKoppelnAnnehmen")}>Koppeln</button>${s.plattform === "android" ? `<button type="button" ${kl("syncScannen")}>QR-Code scannen</button>` : ""}</div>
      <video id="sync-video" class="koppel-video" playsinline muted hidden></video></div>`;
}
// Welche Wege zum Sync es in dieser Fassung gibt (und nur diese): je Fassung eine kurze Liste oben in der Karte
const WEGE = {
  desktop: ["<b>Per Code</b> mit der Android-App oder einem anderen Rechner (Windows) im selben WLAN oder VPN", "<b>Cloud-Ordner</b>, den alle Geräte sehen (zum Beispiel iCloud Drive, Google Drive, OneDrive)", "<b>Eigener Server</b> als Speicherort (auch für iPhone und iPad mit der Web-App)", "<b>Dieses Gerät als Speicherort</b> für die anderen im selben WLAN oder VPN (Schalter unten)", "<b>iPhone und iPad ohne Server:</b> Synchronisieren über GitHub, oder das Handy bedient diese Zeiterfassung im WLAN (Schalter unten)"],
  android: ["<b>Per Code oder QR-Code</b> mit einem Rechner (Windows) oder einem anderen Android-Handy im selben WLAN oder VPN", "<b>Cloud-Ordner</b>, den alle Geräte sehen (zum Beispiel Google Drive)", "<b>Eigener Server</b> als Speicherort", "<b>Dieses Gerät als Speicherort</b> für die anderen im selben WLAN oder VPN (Schalter unten)"],
  netz: ["<b>Von selbst mit dem Server</b>, von dem diese App kommt. Über ihn bleiben auch die Desktop-App und die Android-App auf demselben Stand, wenn dort seine Adresse eingetragen ist"],
  browser: ["<b>Sync-Dateien von Hand</b> austauschen, zum Beispiel über iCloud Drive"],
  server: ["<b>Dieser Server ist der Speicherort:</b> Desktop-App, Android-App und die Web-App fürs Handy synchronisieren über ihn"],
  fern: [],
  anmeldedienst: ["<b>Desktop-App und Android-App</b> synchronisieren mit diesem Server: dort unter „Synchronisieren“ Adresse, Benutzername und Passwort eintragen. Die Geräte stehen in den Einstellungen unter „Geräte und Anmeldung“, Karte „Meine Geräte“", "<b>iPhone und iPad</b>: in Safari die Adresse dieses Servers mit <b>/mobil/</b> am Ende öffnen, anmelden und „Zum Home-Bildschirm“ wählen. Diese Web-App synchronisiert über diesen Server"],
};
const WEGE_NICHT = {netz: "Direkt mit der Desktop-App oder per Code geht es in der Web-App nicht: Der Browser lässt das nicht zu.", browser: "Per Code, Cloud-Ordner oder direkt mit der Desktop-App geht es in der Web-App nicht: Der Browser lässt das nicht zu.",
  fern: "Du bedienst hier die Zeiterfassung auf deinem Rechner. Alles, was du einträgst, steht sofort dort: Es gibt nichts zu synchronisieren. Das Synchronisieren mit weiteren Geräten richtest du am Rechner ein."};
const WEG_GITHUB = "<b>GitHub</b>: ein eigenes Repo (privat oder öffentlich) als Speicherort, von überall erreichbar";
// Zeigt die Wege zum Sync, die diese Fassung wirklich hat (WEGE, GitHub nur bei eingeschaltetem Modul), und was in ihr nicht geht.
function wegeHtml(art) {
  const wege = art === "fern" ? [] : [...(WEGE[art] || []), ...(modulAn("github") ? [WEG_GITHUB] : [])];
  return `${wege.length ? `<p class="hinweis"><b>So synchronisiert diese Fassung:</b></p><ul class="hinweis">${wege.map(w => `<li>${w}</li>`).join("")}</ul>` : ""}${WEGE_NICHT[art] ? `<p class="hinweis">${WEGE_NICHT[art]}</p>` : ""}`;
}
// Schnell-Symbole: im Web-Design (Rechner) links unter dem Logo, am Handy oben in der Leiste vor dem Menü (Wunsch vom 17.11.2026); das „?“ zur Seite als erstes (Auftrag 23.11.2026)
function schnellSymbole() {
  const web = document.body.dataset.design === "web", ziel = web ? $("#schnell") : $(".kopfleiste");
  if (ziel) for (const id of ["titel-hilfe", "sync-symbol", "farb-knopf", "zu-heute", "suche-knopf", "abmelden-knopf"]) { const k = $("#" + id); if (k && k.parentNode !== ziel) web ? ziel.append(k) : ziel.insertBefore(k, $("#menue")); }
}
// Desktop-Fassung: in welchem Browser das Fenster der App aufgeht. erstesMal: Frage auf der Übersicht, solange nichts gewählt ist und es eine Wahl gibt.
async function browserWahlHtml(erstesMal) {
  let b;
  try { b = await api("GET", "/desktop/browser"); } catch (e) { return ""; }
  if (!b.desktop || (erstesMal && (b.wahl || b.vorhanden.length < 2))) return "";
  const namen = {edge: "Microsoft Edge", chrome: "Google Chrome", firefox: "Firefox", standard: "Standardbrowser (als Tab)"};
  return `<div class="card"><h2>${erstesMal ? "Welchen Browser bevorzugst du?" : "Browser für das Fenster der App"}</h2>
    <p class="hinweis">Die App zeigt ihr Fenster in einem Browser, der auf diesem Gerät installiert ist. Edge und Chrome öffnen ein eigenes Fenster ohne Adresszeile, Firefox ein gewöhnliches Fenster. Die Wahl gilt ab dem nächsten Start${erstesMal ? ` und lässt sich später unter „${weg("einstellungen", "aussehen")}“ ändern` : ""}.</p>
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
// Band „Neue Version bereit“ mit „Neu laden“ (fester Text, lädt erst auf Klick).
function neueVersionBand() {
  return `<div class="demo-band" id="neu-version"><span><b>Neue Version bereit</b> · In diesem Fenster läuft noch die alte Fassung</span><button ${kl("neuLaden")}>Neu laden</button></div>`;
}
// Hinweisbänder über jeder Seite: Demo, „Als App ablegen“, Sicherung fällig, neue Version, Konflikte.
function baender() {
  return demoBanner() + heimBand() + sichernBand()
    + (NEUE_VERSION ? neueVersionBand() : "")
    + (KONFLIKTE && seitenName() !== "sync" ? `<div class="demo-band"><span><b>${KONFLIKTE === 1 ? "Ein Konflikt" : KONFLIKTE + " Konflikte"} nach dem Synchronisieren</b> · auf zwei Geräten verschieden geändert</span><a class="btn" href="#/sync">Entscheiden</a></div>` : "");
}
// ---- Rundgang (funktionen.md 6.2): kurze Seiten im Blatt (vier oder fünf), nach der Einrichtung als Frage mit Ja/Später (start.js rundgangAngebot) und jederzeit aus der Hilfe („Wie fange ich an?“); in der Grundlage, weil
// die Aktionen (anlauf.js AKTIONEN) ihn von dort öffnen. Seiten zu abgeschalteten Modulen und ohne Homeoffice fallen weg.
// Zählt Teile als Text auf („a, b und c“, bindewort statt „und“, z. B. „oder“); leere Teile (abgeschaltetes Modul) fallen weg. Für Rundgang, Hilfe und Seiten.
const aufzaehlung = (teile, bindewort = "und") => { const t = teile.filter(Boolean); return t.length > 1 ? t.slice(0, -1).join(", ") + ` ${bindewort} ` + t.at(-1) : t.join(""); };
const RUNDGANG_SEITEN = [
  {titel: "Übersicht", text: () => `Die Übersicht zeigt ${aufzaehlung(["heute", modulAn("gleitzeit") && "Gleitzeit", modulAn("urlaub") && "Urlaub", modulAn("zutun") && "was zu tun ist"])} auf einen Blick. ${rundgangStempeln()}`},
  {titel: "Zeit", text: () => "Unter Zeit siehst du Tag, Woche und Monat. Tippe auf einen Tag, um ihn einzutragen oder zu ändern."},
  {titel: "Homeoffice", text: () => ({nur: "Hier steht deine Jahresübersicht. Du arbeitest nur im Homeoffice, darum gibt es keine Grenze.",
    ohne: "Hier stehen deine Homeoffice-Quote (nur zur Info) und die Jahresübersicht. Eine Grenze gibt es bei dir nicht."})[hoModus()]
    || `Hier stehen deine Homeoffice-Quote und die Jahresübersicht. Der Spielraum zeigt, wie viel Homeoffice bis zu deiner Grenze von ${Number(KONFIG.ho_grenze)} % noch geht.`, nur: () => hoModus() !== "kein"},
  {titel: "Abwesenheit und Auswertung", text: () => {
    const krank = modulAn("krank"), urlaub = modulAn("urlaub") && (modulAn("planung") ? "planst du Urlaub" + (krank ? " und trägst Krankheit ein" : "") : "trägst du Urlaub" + (krank ? " und Krankheit" : "") + " ein");
    const ab = urlaub || (krank ? "trägst du Krankheit ein" : "");
    const aus = aufzaehlung([modulAn("export") && "Export", (modulAn("monatsnachweis") || modulAn("nachweis")) && "Nachweise"]);
    return `${ab ? `Unter Abwesenheit ${ab}. ` : ""}${aus ? `Unter Auswertung findest du ${aus}.` : "Die Auswertung ist bei dir abgeschaltet."}`;
  }},
  {titel: "Daten, Einstellungen, Hilfe", text: () => `Unter Daten sicherst du deine Einträge${modulAn("abgleich") ? " und richtest das Synchronisieren ein" : ""}. In den Einstellungen stehen Regeln, Aussehen und Module. Die Hilfe beantwortet kurz die häufigen Fragen, Schritt für Schritt mit Bildern steht es im Wiki.`},
];
// Satz zum Stempeln: Die Stempel-Taste gibt es nur in der Handy-Leiste, am Rechner stehen Kommen und Gehen in der Karte Heute.
function rundgangStempeln() {
  const handy = document.body.dataset.design === "handy";
  if (modulAn("stempel")) return handy ? "Mit der Stempel-Taste startest und beendest du die Stempeluhr." : "Mit „Kommen“ und „Gehen“ in der Karte Heute startest und beendest du die Stempeluhr.";
  return handy ? "Mit der Stempel-Taste trägst du den heutigen Tag ein." : "Mit „Heute eintragen“ in der Karte Heute trägst du den heutigen Tag ein.";
}
// Seiten des Rundgangs für die Regeln dieser Person: [{titel, text}].
function rundgangSeiten() {
  return RUNDGANG_SEITEN.filter(s => !s.nur || s.nur()).map(s => ({titel: s.titel, text: s.text()}));
}
// Zeigt Seite i einer Folge von Seiten ({titel, text}) im Blatt: „Seite i von n“ (mit vorspann davor), Text, Zurück, Weiter (Aktion aktion mit i ± 1), Beenden
// (Esc beendet wie jedes Blatt), dazu extra (weitere Knöpfe). Fokus auf die Überschrift. Genutzt vom Rundgang und von „Neu in dieser Version“.
function rundgangBlatt(seiten, i, aktion, vorspann = "", extra = "") {
  const s = seiten[i];
  blatt(`<h3 tabindex="-1">${s.titel}</h3><p class="hinweis">${vorspann}Seite ${i + 1} von ${seiten.length}</p><p>${s.text}</p>
    <div class="knoepfe">${i > 0 ? `<button ${kl(aktion, i - 1)}>Zurück</button>` : ""}${i < seiten.length - 1 ? `<button class="prim" ${kl(aktion, i + 1)}>Weiter</button>` : ""}${extra}<button ${kl("blattZu")}>Beenden</button></div>`);
  $("#blatt-inh h3").focus();
}
// Zeigt Seite i des Rundgangs.
function rundgang(i) { rundgangBlatt(rundgangSeiten(), i, "rundgang"); }
// Startet den Rundgang auf der ersten Seite.
function rundgangStart() { rundgang(0); }

// ---- „Neu in dieser Version“ (Release 25.11.2026): nach einem Update einmal je Liste und Gerät ein kurzer Rundgang im selben Blatt, überspringbar (Beenden, Esc),
// abschaltbar („Nicht mehr zeigen“ und Schalter unter Einstellungen, Aussehen; ein Schlüssel für beides). NEU_STAND kennzeichnet die Liste, nicht die Version:
// Ein Release ohne neue Liste zeigt nichts erneut. Beim nächsten Release Liste und Stand zusammen ersetzen.
const NEU_STAND = "2026-11-26", NEU_MAX = 5;
const NEU_GESEHEN = "ho_neu_gesehen", NEU_ZEIGEN = "ho_neu_zeigen", NEU_AUS = "aus";
// Schritte: titel, text (ohne HTML), ziel (Adresse für „Ansehen“), optional selektor (Stelle auf der Zielseite), nur() wie beim Rundgang und da() für Funktionen,
// die in dieser Fassung fehlen können. Fehlt die Zielseite oder ist sie aus, ist nur() oder da() falsch, fällt der Schritt still weg.
// Die Namen in da() und selektor tragen die Teams beim Zusammenführen ein (Vertrag V6); ein falscher Name lässt den Schritt nur wegfallen.
const NEU_IN_VERSION = [
  // Ziel als Getter: das heutige Datum gilt erst beim Zeigen, nicht beim Laden der Seite
  {titel: "Tag eintragen", text: "Im Tag stehen jetzt zwei Karten: Art des Tages und Zeiten. Ein Tipp auf Homeoffice, Büro oder Krank füllt nur vor, gespeichert wird mit Speichern.",
    get ziel() { return `#/tag/${zeitHeuteIso()}/${ZEIT_BEARBEITEN}`; }, selektor: "#e-zeiten-titel"},
  {titel: "Brückentage", text: "Die Brückentage schlagen jetzt bis zu 10 Urlaubstage am Stück vor, auch über mehrere Feiertage hinweg. Ein Tipp plant den Urlaub ein.",
    ziel: "#/urlaub", selektor: ".zeile.bruecke", nur: () => artAn("urlaub")},
  {titel: "Spielraum", text: "Im HO-Spielraum zeigen Monat und Jahr jetzt den Quote-Ring wie die Seite Monat.",
    ziel: "#/horest", selektor: ".spiel .ring", nur: () => hoModus() === "grenze"},
  {titel: "Woche", text: "Die Woche zeigt nur noch Ist, Soll und Saldo der Woche. Die Konten findest du unter Einstellungen › Person.",
    ziel: "#/woche", selektor: "#woche-karte"},
  {titel: "Hintergrund", text: "Unter Einstellungen › Aussehen wählst du den Hintergrund (Verlauf, Aurora, Uni) und den Glaseffekt. Das gilt nur auf diesem Gerät.",
    ziel: "#/einstellungen/aussehen", selektor: "[data-n=hintergrund]", da: () => typeof hintergrundName === "function"},
];
// Schritte, die es auf diesem Gerät gibt (Zielseite vorhanden und an, nur() und da() wahr), höchstens NEU_MAX.
function neuSchritte() {
  return NEU_IN_VERSION.filter(s => !seiteWeg(s.ziel.split("/")[1]) && (!s.nur || s.nur()) && (!s.da || s.da())).slice(0, NEU_MAX);
}
// Beim Laden, bevor anlauf.js die Version merkt: Ein Gerät ohne gemerkte Version (alteVersion leer) ist neu, für es gilt die Liste als gesehen.
// Gleich hier und nicht erst nach der ersten Seite, damit auch ein früh gesicherter Speicher (Design-Prüfung) den Merker schon hat.
function neuErsterStart(alteVersion) { if (!alteVersion) speicher.s(NEU_GESEHEN, NEU_STAND); }
// Ist der Rundgang jetzt dran? Nicht abgeschaltet, Liste auf diesem Gerät noch nicht gesehen, nicht in der Demo, kein anderes Blatt offen.
function neuFaellig() {
  return speicher.l(NEU_ZEIGEN, "") !== NEU_AUS && speicher.l(NEU_GESEHEN, "") !== NEU_STAND && !DEMO?.aktiv && !blattOffen();
}
// Nach der ersten Seite: zeigt den Rundgang, wenn er dran ist, und merkt die Liste als gesehen (ohne Schritte still). Der Fokus geht danach zum Seitentitel
// zurück (blatt merkt das fokussierte Element), nicht ins Leere.
function neuAnbieten() {
  if (!neuFaellig()) return;
  speicher.s(NEU_GESEHEN, NEU_STAND);
  if (!neuSchritte().length) return;
  $("#titel").focus({preventScroll: true});
  neuRundgang(0);
}
// Zeigt Schritt i von „Neu in dieser Version“ mit „Ansehen“ (zur Stelle) und „Nicht mehr zeigen“.
function neuRundgang(i) {
  rundgangBlatt(neuSchritte(), i, "neuRundgang", "Neu in dieser Version · ", `<button ${kl("neuAnsehen", i)}>Ansehen</button><button ${kl("neuNichtMehr")}>Nicht mehr zeigen</button>`);
}
// „Ansehen“: schließt den Rundgang, öffnet die Zielseite und holt die Stelle (selektor) ins Bild; fehlt sie, bleibt die Seite oben.
function neuAnsehen(i) {
  const s = neuSchritte()[i];
  blattZu();
  if (s.selektor) window.nachher = () => ueberschriftZeigen($("#inhalt").querySelector(s.selektor));
  if (location.hash === s.ziel) zeigen(); else location.hash = s.ziel;
}
// „Nicht mehr zeigen“: schaltet den Rundgang nach Updates auf diesem Gerät ab (wie der Schalter in den Einstellungen) und schließt ihn.
function neuNichtMehr() {
  speicher.s(NEU_ZEIGEN, NEU_AUS);
  blattZu();
  toast("Wird nicht mehr gezeigt. Einschalten unter Einstellungen, Aussehen.");
}
// Schalter der Karte: an zeigt den Rundgang nach dem nächsten Update wieder.
function neuSchalten(an) { speicher.s(NEU_ZEIGEN, an ? "" : NEU_AUS); }
// Karte „Neu in dieser Version“ (Einstellungen, Aussehen): Schalter für dieses Gerät und, wenn es Schritte gibt, „Jetzt ansehen“.
function neuKarte() {
  const an = speicher.l(NEU_ZEIGEN, "") !== NEU_AUS, jetzt = neuSchritte().length ? `<div class="knoepfe"><button ${kl("neuRundgang", 0)}>Jetzt ansehen</button></div>` : "";
  return `<div class="card"><h2>Neu in dieser Version</h2><div class="zeile"><span>Nach einem Update zeigen<br><small>kurzer Rundgang durch das Neue, gilt nur auf diesem Gerät</small></span><input type="checkbox" ${an ? "checked" : ""} data-wechsel="neuSchalten" aria-label="Neu in dieser Version nach einem Update zeigen"></div>${jetzt}</div>`;
}
// ---- Hilfen: Art-Wahl (Homeoffice ist vorausgewählt), Toast
function artWahl(id, wert, frage) {
  if (einOrt()) return festerOrt(id);
  return `<label id="${id}-name">${frage}</label>${segHtml([["ho", "Homeoffice"], ["dst", "Büro"]], wert, {id, beschriftet: `${id}-name`})}`;
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
const STEMPEL_KOMMEN = "Kommen", STEMPEL_GEHEN = "Gehen", STEMPEL_PAUSE = "Pause", STEMPEL_WEITER = "Weiter";
// Beschriftung des Stempel-Knopfs: „Gehen (seit 07:30)“, wenn die Uhr läuft (Beginn aus stempelDaten), in einer Pause von heute „Weiter“, sonst „Kommen“.
const stempelKnopf = d => d && d.laeuft ? `${STEMPEL_GEHEN} (seit ${stempelSeit()})` : pauseHeute() ? STEMPEL_WEITER : STEMPEL_KOMMEN;
// ---- Pause und Weiter (Auftrag vom 25.11.2026): „Pause“ bucht Gehen, „Weiter“ bucht Kommen; die Lücke dazwischen zählt auf die Pflichtpause an.
// Dass das letzte Gehen eine Pause war, merkt sich nur dieses Gerät im lokalen Speicher ({datum, seit, art}), nicht die Datenbank.
const PAUSE_MERKER = "ho_pause";
const PAUSE_OFFEN = "Pause seit {seit} Uhr am {tag} nicht beendet. Nachtragen?";
// Die gemerkte Pause {datum, seit, art} oder null.
function pauseGemerkt() { try { return JSON.parse(speicher.l(PAUSE_MERKER, "")); } catch (e) { return null; } }
// Läuft heute eine Pause (gemerkt, keine Uhr läuft)?
const pauseHeute = () => !(stempelDaten && stempelDaten.laeuft) && pauseGemerkt()?.datum === zeitHeuteIso();
// „Pause“: bucht die laufende Zeit jetzt aus (Gehen, Pflichtpause rechnet der Dienst über den ganzen Tag) und merkt die Pause für Band und Weiter.
async function pauseMachen() {
  const {art, start_datum: datum} = stempelDaten, seit = jetztZeit();
  try {
    const r = await api("POST", "/stempel", {aktion: "stop", art, ende: seit, pause: null, freigabe: false});
    speicher.s(PAUSE_MERKER, JSON.stringify({datum, seit, art}));
    stempelUebernehmen(r, true);
    const text = `${STEMPEL_PAUSE} seit ${seit} Uhr · ${zeitText(minuten(r.gebucht))} Std. gebucht.`;
    rueckgaengigZeigen(r, text) || toast(text);
  } catch (e) { formFehler($("#s-fehler"), e.message); }
}
// „Weiter“: Kommen mit Ortswahl, vorbelegt mit dem Ort vor der Pause; mit nur einem Ort ohne Wahl.
function weiterMachen() {
  const p = pauseGemerkt() || {}, art = einOrt() || p.art || "ho";
  if (einOrt()) return kommenMit(art);
  blatt(`<h3>${STEMPEL_WEITER}</h3><p class="hinweis mitte">Pause seit ${esc(p.seit || "")} Uhr. Beginn jetzt (${jetztZeit()} Uhr).</p>
    ${artWahl("w-art", art, "Wo arbeitest du weiter?")}<div id="s-fehler"></div>
    <div class="knoepfe"><button class="prim" id="w-ok">${STEMPEL_WEITER}</button></div>`);
  artBinden("w-art");
  $("#w-ok").onclick = gesperrt(() => kommenMit(artWert("w-art")));
}
// Band einer Pause von heute (ohne laufende Uhr): „Pause seit 10:30“ und „Weiter ›“, beides öffnet Weiter.
function pauseBand(b) {
  const seit = esc(pauseGemerkt().seit);
  b.dataset.pause = 1;
  b.innerHTML = `<button type="button" id="b-korrektur" aria-label="${STEMPEL_PAUSE} seit ${seit} Uhr. ${STEMPEL_WEITER}"><i></i><span>${STEMPEL_PAUSE} seit\u00a0${seit}</span></button>`
    + `<button type="button" id="b-gehen" aria-label="${STEMPEL_WEITER} (einbuchen)"><u>${STEMPEL_WEITER} ›</u></button>`;
  for (const id of ["#b-korrektur", "#b-gehen"]) $(id).onclick = weiterMachen;
}
// Beim Start der App (Pausenregel Punkt 8): eine Pause von einem früheren Tag ohne Weiter einmal melden, mit Sprung zur Seite Tag; „Nicht mehr zeigen“
// vergisst sie (je Fall). Nicht in der Demo, nicht über einem Blatt.
async function pauseOffenPruefen() {
  const p = pauseGemerkt();
  if (!p || p.datum >= zeitHeuteIso() || blattOffen()) return;
  try { if ((DEMO || await api("GET", "/demo")).aktiv) return; } catch (e) { return; }
  blatt(`<h3>${STEMPEL_PAUSE} nicht beendet</h3><p id="pause-offen">${esc(PAUSE_OFFEN.replace("{seit}", p.seit).replace("{tag}", de(p.datum)))}</p>
    <div class="knoepfe"><a class="btn prim" id="po-tag" href="#/tag/${esc(p.datum)}">Nachtragen</a><button id="po-aus">Nicht mehr zeigen</button></div>`);
  $("#po-tag").onclick = () => { speicher.s(PAUSE_MERKER, ""); blattZu(); };
  $("#po-aus").onclick = () => { speicher.s(PAUSE_MERKER, ""); blattZu(); };
}
// Neuer Stand nach Kommen, Gehen oder Verwerfen: Banner, Stempel-Taste und der Knopf der Übersicht folgen sofort.
// Andere Seiten werden nur neu gezeichnet, wenn sich Tagesdaten geändert haben (sonst gingen dort Eingaben verloren).
function stempelUebernehmen(daten, tagGeaendert) {
  stempelDaten = daten; stempelDaten.t0 = Date.now();
  blattZu(); stempelAnzeige();
  if (tagGeaendert || seitenName() === "start") zeigen();
}
// Holt den Stand der Stempeluhr und zeichnet Banner und Stempel-Taste.
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
// Minuten der laufenden Uhr ohne Runden (Zählregel K4): Minute(jetzt) − Minute(Beginn). Der Dienst liefert den Beginn ohne Sekunden, darum
// reicht Abschneiden der Sekunden seit dem Beginn; so zählen Kacheln, Band und Vorbelegung der Pause wie „Gehen“.
const stempelMinuten = () => Math.floor(stempelSekunden() / 60);
// Läuft die Stempeluhr seit heute (ihre Zeit zählt dann für heute)?
const stempelHeute = () => !!(stempelDaten && stempelDaten.laeuft) && !stempelFrueher();
// Ort der laufenden Uhr kurz: „HO“ oder „Büro“.
const stempelOrt = () => stempelDaten.art === "ho" ? "HO" : "Büro";
// Minuten, um die „Gehen“ jetzt das Ist des Tages erhöhen würde (Tagesrechnung des Dienstes: Pflichtpause, Kappzeit; Stücke „live“ von GET /api/stempel),
// für die Kacheln der Übersicht und die Seite Tag. Minute = Ende-Minute minus Beginn-Minute, Sekunden fallen weg (K4). 0, wenn keine Uhr läuft oder
// sie seit einem früheren Tag läuft (die Zeit gehört dann zu jenem Tag).
function laufendeMinuten() {
  if (!stempelHeute()) return 0;
  const i = stempelMinuten();                                  // Beginn ohne Sekunden (K4)
  const [von, wert, steigung] = (stempelDaten.live || []).reduce((s, x) => x[0] <= i ? x : s, [0, 0, 1]);
  return wert + steigung * (i - von);
}
// Hält „Heute“ und „Diese Woche“ der Übersicht (Ist, Saldo, „Läuft seit“) und die Karte der Seite Tag mit der laufenden Uhr aktuell.
function gleitzeitLaufend() {
  [$("#gz-tag"), $("#gz-kw")].forEach(e => { if (e) e.textContent = zeitText(+e.dataset.min + laufendeMinuten()); });
  uebersichtLaufend();
  tagLaufend();
  feierabendLaufend();
}
// ---- Übersicht mit der laufenden Uhr (Kacheln Heute und Diese Woche, Karte Heute; Bauer in seiten/start.js)
// Satz „Tagessoll erreicht (+00:20)“ ohne das Plus: Text von woche.ZIEL_ERREICHT, ein Test hält beide gleich.
const ZIEL_ERREICHT_JS = "Tagessoll erreicht ()";
// Text „Tagessoll erreicht (+00:20)“ für plus Minuten (ab 0), Vorzeichen immer wie woche.fmt_saldo.
const zielErreicht = plus => ZIEL_ERREICHT_JS.replace("()", `(+${zeitText(plus)})`);
// Bringt die Kacheln Heute und Diese Woche auf den Stand der Uhr (Saldo, Satz „Tagessoll erreicht“) und die Karte Heute („Läuft seit“). Geschrieben wird nur, wenn sich
// der Text ändert (höchstens einmal je Minute), kein aria-live: Screenreader und Fokus bleiben in Ruhe. Auf anderen Seiten nichts.
function uebersichtLaufend() {
  for (const e of [$("#gz-saldo-tag"), $("#gz-saldo-kw")]) {
    const m = e ? +e.dataset.min + laufendeMinuten() : 0, txt = zeitText(m, true);
    if (e && e.zuletzt !== txt) { e.textContent = txt; e.className = `saldo ${saldoKlasse(m)}`; e.zuletzt = txt; }
  }
  const z = $("#gz-ziel-tag"), plus = z ? +z.dataset.min + laufendeMinuten() : -1;
  if (z && laufendeMinuten() > 0 && plus >= 0 && z.zuletzt !== plus) { z.textContent = zielErreicht(plus); z.zuletzt = plus; }
  const l = $("#hk-lauf"), lauf = laufText();
  if (l && l.zuletzt !== lauf) { l.textContent = lauf; l.zuletzt = lauf; }
}
// Dauer der laufenden Uhr als hh:mm (ohne Pause abgezogen: wie lange sie schon läuft).
const laufText = () => hhmm(stempelMinuten());
// ---- Feierabend: ab wann Tagessoll und 10-Stunden-Grenze erreicht sind (Rechnung im Server: soll_erreicht_um, grenze_10h_um von GET /api/stempel)
const FEIERABEND_SOLL = "Soll erreicht", FEIERABEND_GRENZE = "10-Stunden-Grenze";   // normaler Bindestrich; zusammen hält am-stueck (white-space: nowrap)
// „Soll erreicht um 16:30“ bzw. „… seit 16:30“, sobald die Uhr so lange läuft; leer ohne Zeitpunkt. Verglichen wird mit der Dauer seit dem Beginn, nicht mit
// der Uhr des Geräts, damit eine abweichende Geräte-Uhr nicht stört.
function feierabendTeil(name, zeitpunkt) {
  if (!zeitpunkt || !stempelDaten?.laeuft) return "";
  const erreicht = (Date.parse(zeitpunkt) - Date.parse(stempelDaten.start)) / 1000 <= stempelSekunden();
  return `${name} ${erreicht ? "seit" : "um"} ${zeitpunkt.slice(11, 16)}`;
}
// Teile der Zeile im Band der laufenden Uhr: „Soll erreicht um 16:30“, „10-Stunden-Grenze um 18:30“ (leere fallen weg).
const feierabendTeile = () => [feierabendTeil(FEIERABEND_SOLL, stempelDaten?.soll_erreicht_um), feierabendTeil(FEIERABEND_GRENZE, stempelDaten?.grenze_10h_um)].filter(Boolean);
// Zeile im Band als Text: „Soll erreicht um 16:30 · 10-Stunden-Grenze um 18:30“.
const feierabendText = () => feierabendTeile().join(" · ");
// Dieselbe Zeile als HTML: jeder Teil am Stück, umgebrochen wird nur am „·“ (sonst „10-Stunden- | Grenze“ bei großer Schrift, Gate 26.11.2026).
const feierabendHtml = () => feierabendTeile().map(t => `<span class="am-stueck">${esc(t)}</span>`).join(" · ");
// Text der Grenze als HTML für die schmale Kachel: das Wort und „um 18:30“ je am Stück, umgebrochen wird davor (Sichtung 26.11.2026: ganz am Stück lief
// die Zeile bei 375 px über den Kachelrand).
const grenzeKachelHtml = text => `<span class="am-stueck">${esc(FEIERABEND_GRENZE)}</span> <span class="am-stueck">${esc(text.slice(FEIERABEND_GRENZE.length + 1))}</span>`;
// Zeile der Kachel Heute (das Soll nennt dort schon der Satz des Kerns): 10-Stunden-Grenze, nur wenn die Uhr für den Tag datum läuft; sonst leer.
function feierabendKachel(datum) {
  const text = stempelDaten?.start_datum === datum ? feierabendTeil(FEIERABEND_GRENZE, stempelDaten.grenze_10h_um) : "";
  return text ? `<span id="hk-grenze">${grenzeKachelHtml(text)}</span>` : "";
}
// Schaltet „um“ auf „seit“, sobald ein Zeitpunkt erreicht ist; geschrieben wird nur bei geändertem Text (kein aria-live, Fokus bleibt).
function feierabendLaufend() {
  const ziel = $("#b-ziel"), text = feierabendText(), grenze = $("#hk-grenze"), grenzeText = feierabendTeil(FEIERABEND_GRENZE, stempelDaten?.grenze_10h_um);
  if (ziel && text && ziel.textContent !== text) ziel.innerHTML = feierabendHtml();
  if (grenze && grenzeText && grenze.textContent !== grenzeText) grenze.innerHTML = grenzeKachelHtml(grenzeText);
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
  blatt(`<h3>Kommen</h3><p class="hinweis mitte">Beginn jetzt (${jetztZeit()} Uhr). Wo arbeitest du?</p>
    <div class="knoepfe gross"><button class="prim" id="k-ho">Homeoffice</button><button class="prim" id="k-dst">Büro</button></div>
    <div id="s-fehler"></div>
    <div class="knoepfe"><button id="k-mehr">Beginn ändern oder nachtragen</button></div>`);
  $("#k-ho").onclick = gesperrt(() => kommenMit("ho"));
  $("#k-dst").onclick = gesperrt(() => kommenMit("dst"));
  $("#k-mehr").onclick = () => stempelBlatt();
}
// Startet die Stempeluhr am Ort „art“ mit Beginn jetzt; danach die Rückgängig-Leiste (oder die Meldung oben, wenn der Dienst keine anbietet). Ein Fehler steht im Blatt.
async function kommenMit(art) {
  try {
    const r = await api("POST", "/stempel", {aktion: "start", art, beginn: jetztZeit()});
    stempelUebernehmen(r, false);
    const text = `Eingebucht um ${r.start_text} Uhr · ${art === "ho" ? "Homeoffice" : "Büro"}.`;
    rueckgaengigZeigen(r, text) || meldungOben(text);
  } catch (e) { if (!$("#s-fehler")) await stempelBlatt(); formFehler($("#s-fehler"), e.message); }
}
// Bucht mit einem Tipp aus: Ende jetzt, Pause nach Regel, Ort wie beim Kommen; danach die Rückgängig-Leiste (oder die Meldung oben, wenn der Dienst keine anbietet). Seit einem früheren Tag (Gehen vergessen) oder bei einem Fehler
// (z. B. über 10 Stunden) öffnet sich das Blatt, damit nichts Falsches gebucht wird; dort steht der Grund.
async function schnellGehen() {
  if (stempelFrueher()) return stempelBlatt();
  try {
    const von = stempelDaten.start_text, bis = jetztZeit();             // vor dem Übernehmen: danach läuft keine Uhr mehr
    const r = await api("POST", "/stempel", {aktion: "stop", art: stempelDaten.art, ende: bis, pause: null, freigabe: false});
    stempelUebernehmen(r, true);
    const text = gehenText(von, bis, r);
    rueckgaengigZeigen(r, text) || meldungOben(`${text} Ändern: oben auf „Heute“ tippen und den Tag öffnen.`);   // ohne Rückgängig: Hinweis, wie man es ändert
  } catch (e) { await stempelBlatt(); formFehler($("#s-fehler"), e.message); }
}
// Kurzbefehle am App-Symbol der Android-Fassung: Kennung je Ort fürs Kommen; dazu „gehen“ (Liste der Hülle: KURZBEFEHLE in MainActivity.java).
const KURZBEFEHL_ORT = new Map([["kommen_ho", "ho"], ["kommen_dst", "dst"]]);
const STEMPEL_AUS = "Die Stempeluhr ist ausgeschaltet. Einschalten: ";
// Die Android-Hülle ruft kurzbefehl("<Kennung>") gleich nach dem Laden der Seite auf, mit einer der drei festen Kennungen; jede andere bleibt ohne Wirkung.
// Gebucht wird auf denselben Wegen wie mit der mittleren Taste. Regeln und Stand der Uhr erst holen: Der Aufruf kann vor dem ersten Laden kommen.
// Passt die Lage nicht (Gehen ohne laufende Uhr, Kommen bei laufender Uhr, Ort, den das Profil nicht kennt), bucht er nichts und öffnet das Blatt der Stempeluhr.
async function kurzbefehl(kennung) {
  if (kennung !== "gehen" && !KURZBEFEHL_ORT.has(kennung)) return;
  try { KONFIG = (await api("GET", "/konfig")).werte; } catch (e) { /* ohne Verbindung gelten die zuletzt geladenen Regeln */ }
  if (!modulAn("stempel")) return meldungOben(STEMPEL_AUS + weg("einstellungen", "module") + ".");
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
    fab.setAttribute("aria-label", l ? stempelKnopf(stempelDaten) : modulAn("stempel") ? "Kommen (einbuchen)" : "Heute eintragen");
  }
  gleitzeitLaufend();                                              // Kacheln der Übersicht gleich mit der Uhr, nicht erst im nächsten Sekundentakt
  let b = $("#stempel-banner");
  if (l && pauseGemerkt()) speicher.s(PAUSE_MERKER, "");          // die Uhr läuft wieder: die Pause ist vorbei
  if (!l && !pauseHeute()) { if (b) b.remove(); return; }
  if (!b) {
    b = document.createElement("div"); b.id = "stempel-banner";
    $("#huelle").insertBefore(b, $("#inhalt"));
  }
  if (!l) return pauseBand(b);
  delete b.dataset.pause;
  // Zwei echte Knöpfe: Ort und Zeit korrigieren den Beginn (seit einem früheren Tag ohne Regel „über Mitternacht“: Blatt der Uhr), „Gehen ›“ öffnet das Blatt.
  // Feste Namen: die Uhr im Band tickt jede Sekunde.
  const ort = stempelDaten.art === "ho" ? "Homeoffice" : "Büro", korrektur = beginnKorrigierbar();
  b.innerHTML = `<button type="button" id="b-korrektur" aria-label="${esc(`Stempeluhr läuft: ${ort} seit ${stempelSeit()}. ${korrektur ? "Beginn korrigieren" : "Öffnen"}`)}"><i></i><span>${ort} seit\u00a0${esc(stempelSeit())}</span><b id="b-uhr">${uhr(stempelSekunden())}</b></button>`
    + `<button type="button" id="b-gehen" aria-label="${esc(stempelKnopf(stempelDaten))}"><u>${STEMPEL_GEHEN} ›</u></button>`
    + (feierabendText() ? `<small id="b-ziel">${feierabendHtml()}</small>` : "");
  $("#b-korrektur").onclick = korrektur ? beginnKorrigieren : stempelBlatt;
  $("#b-gehen").onclick = stempelBlatt;
}
// Blatt der Stempeluhr: „Kommen“ mit Beginn und Ort, bei laufender Uhr „Gehen“ mit Ende, Pause und Freigabe oder „Verwerfen“.
async function stempelBlatt() {
  const d = stempelDaten || {laeuft: false, heute: {}};
  const heuteText = `Heute schon: ${orteText(d.heute.ho, d.heute.dst)}`;
  if (!d.laeuft && pauseHeute()) return weiterMachen();
  if (!d.laeuft) {
    blatt(`<h3>Stempeluhr</h3><p class="hinweis mitte">${heuteText}</p>
      ${artWahl("s-art", "ho", "Wo arbeitest du?")}
      <label for="s-beginn">Beginn <small>(jetzt vorbelegt, lässt sich ändern)</small></label><input id="s-beginn" inputmode="numeric" placeholder="hh:mm, zum Beispiel 07:45" value="${jetztZeit()}">
      <div id="s-fehler"></div>
      <div class="knoepfe"><button class="prim" id="s-start">${STEMPEL_KOMMEN}</button><button id="s-hand">Heute von Hand eintragen</button></div>
      <p class="hinweis">Ganzen Tag oder einen früheren Tag nachtragen: im Monat den Tag öffnen und „Kommen – Gehen – Pause“ nutzen. Dort kannst du Zeiten auch direkt eintippen.</p>`);
    artBinden("s-art");
    $("#s-beginn").onblur = e => e.target.value = zeitNorm(e.target.value);
    $("#s-hand").onclick = () => { blattZu(); heuteEintragen(); };
    $("#s-start").onclick = gesperrt(async () => {
      try {
        const r = await api("POST", "/stempel", {aktion: "start", art: artWert("s-art"), beginn: zeitNorm($("#s-beginn").value)});
        stempelUebernehmen(r, false);
        rueckgaengigZeigen(r) || toast("Gestartet. Gute Arbeit!");
      } catch (e) { formFehler($("#s-fehler"), e.message); }
    });
  } else {
    const vergessen = gehenNachtragen();
    blatt(`<h3>Stempeluhr läuft</h3><div class="uhr" id="s-uhr">${uhr(stempelSekunden())}</div>
      <p class="hinweis mitte">Kommen ${esc(stempelSeit())}\u00a0Uhr · ${d.art === "ho" ? "Homeoffice" : "Büro"}<br>${heuteText}</p>
      ${vergessen ? `<p class="hinweis" role="status"><b>„Gehen“ vergessen?</b> Die Zeit läuft seit dem ${esc(stempelTag())}. Trage ein, wann du aufgehört hast. Gebucht wird auf den ${esc(stempelTag())}.</p>` : ""}
      ${artWahl("s-art", d.art, "Wo hast du gearbeitet?")}
      <div class="reihe"><div><label for="s-ende">${vergessen ? "Ende <small>(Uhrzeit)</small>" : "Ende <small>(jetzt vorbelegt)</small>"}</label><input id="s-ende" inputmode="numeric" placeholder="hh:mm" value="${vergessen ? "" : jetztZeit()}"></div>
      <div><label for="s-pause">Pause von Hand <small>(leer: nur Pflichtpause)</small></label><input id="s-pause" inputmode="numeric" placeholder="hh:mm"></div></div>
      <div class="zeile"><span>Über 10 Stunden freigegeben</span><input type="checkbox" id="s-frei" aria-label="Über 10 Stunden freigegeben"></div>
      <div id="s-fehler"></div>
      <div class="knoepfe"><button class="prim" id="s-stop">${STEMPEL_GEHEN}</button>${vergessen ? "" : `<button id="s-pausieren">${STEMPEL_PAUSE}</button>`}${beginnKorrigierbar() ? `<button ${kl("beginnKorrigieren")}>Beginn korrigieren</button>` : ""}<button class="gef" id="s-weg">Verwerfen</button></div>
      <p class="hinweis">„Gehen“ zählt die Zeit zum Tag des Beginns dazu, „Pause“ ebenso; danach geht es mit „Weiter“ weiter. Die Pflichtpause (${pausenText()}, anteilig, unter ${esc(weg("einstellungen", "arbeitszeit"))} einstellbar) rechnet die App über den ganzen Tag, Lücken und Pausen von Hand zählen an. Zeit außerhalb der Regelarbeitszeit und über der Tagesgrenze ohne Freigabe verfällt als Kappzeit.</p>`);
    artBinden("s-art");
    $("#s-ende").onblur = e => { e.target.value = zeitNorm(e.target.value); };
    $("#s-pause").onblur = e => { e.target.value = pauseNorm(e.target.value); };
    if ($("#s-pausieren")) $("#s-pausieren").onclick = gesperrt(pauseMachen);
    $("#s-stop").onclick = gesperrt(() => gehenSenden({art: artWert("s-art"), ende: zeitNorm($("#s-ende").value), pause: $("#s-pause").value ? minuten(pauseNorm($("#s-pause").value)) : null, freigabe: $("#s-frei").checked}));
    $("#s-weg").onclick = gesperrt(async () => {
      if (!(await frage("Laufende Zeit verwerfen? Es wird nichts gebucht.", "Verwerfen", true))) return;
      // Das Rückgängig des Einbuchens ist danach überholt: Die Leiste verschwindet sofort (blattZu() zeigte sie sonst, solange die Anfrage läuft),
      // das Ende erfährt der Dienst erst nach Erfolg. Bei einem Fehler gilt es weiter; das Blatt ist schon zu, darum als Meldung.
      $("#rueck").hidden = true;
      try { stempelUebernehmen(await api("POST", "/stempel", {aktion: "verwerfen"}), false); rueckSchliessen(true); toast("Verworfen. Es wurde nichts gebucht."); }
      catch (e) { $("#rueck").hidden = !rueckId; toastFehler(e.message); }
    });
  }
}
// Muss das Ende im Blatt von Hand nachgetragen werden? Die Uhr läuft seit einem früheren Tag und ohne Regel „über Mitternacht“ (Ende nur am Starttag,
// stempel.stop) oder mit ihr seit über 10 Stunden. Dann steht „Gehen vergessen?“ im Blatt und das Ende bleibt leer statt „jetzt“.
const gehenNachtragen = () => stempelFrueher() && (!KONFIG.stempel_mitternacht || stempelSekunden() > STEMPEL_VERGESSEN_S);
// Bucht die laufende Zeit aus („Gehen“ im Blatt der Stempeluhr und in der Rückfrage „Gehen vergessen?“): angaben = {art, ende, pause, freigabe} wie POST /api/stempel
// mit „stop“ (pause null heißt nach Regel). Danach die Rückgängig-Leiste (oder eine Meldung); ein Fehler steht im offenen Blatt, die Eingaben bleiben.
async function gehenSenden(angaben) {
  try {
    const von = stempelDaten.start_text, bis = angaben.ende || jetztZeit();   // vor dem Übernehmen: danach läuft keine Uhr mehr; leeres Ende bucht der Dienst bis jetzt
    const r = await api("POST", "/stempel", {aktion: "stop", ...angaben});
    stempelUebernehmen(r, true);
    const text = gehenText(von, bis, r);
    rueckgaengigZeigen(r, text) || toast(text);
  } catch (e) { formFehler($("#s-fehler"), e.message); }
}
// Meldung nach „Gehen“, z. B. „07:30 bis 16:05 Uhr · 08:05 Std. gebucht (Pause 00:30).“: von/bis hh:mm, r die Antwort von POST /stempel (gebucht, pause_min).
const gehenText = (von, bis, r) => `${von} bis ${bis} Uhr · ${zeitText(minuten(r.gebucht))} Std. gebucht${r.pause_min ? ` (Pause ${zeitText(r.pause_min)})` : ""}.`;

// ---- Beginn korrigieren (Entscheidung des Entwicklers 24.11.2026): nur der Beginn der laufenden Uhr, früher oder später; prüfen tut der Dienst
// (nie Zukunft, keine Überschneidung mit gebuchten Zeiten des Starttags).
// Darf der Beginn korrigiert werden? Die Uhr läuft seit heute oder, mit der Regel „Stempeluhr über Mitternacht erlauben“, seit einem früheren Tag.
const beginnKorrigierbar = () => !!(stempelDaten && stempelDaten.laeuft) && (!stempelFrueher() || !!KONFIG.stempel_mitternacht);
// Blatt „Beginn korrigieren“: nur die Uhrzeit, vorbelegt mit dem Beginn; Fehler stehen im Blatt, die Eingabe bleibt.
function beginnKorrigieren() {
  if (!beginnKorrigierbar()) return stempelBlatt();
  blatt(`<h3>Beginn korrigieren</h3><p class="hinweis">Die Stempeluhr läuft seit ${esc(stempelSeit())} Uhr (${stempelDaten.art === "ho" ? "Homeoffice" : "Büro"}).</p>
    <label for="bk-beginn">Beginn <small>(Uhrzeit)</small></label><input id="bk-beginn" inputmode="numeric" placeholder="hh:mm" value="${esc(stempelDaten.start_text)}">
    <div id="s-fehler"></div>
    <div class="knoepfe"><button class="prim" id="bk-ok">Beginn speichern</button><button ${kl("blattZu")}>Abbrechen</button></div>`);
  $("#bk-beginn").onblur = e => e.target.value = zeitNorm(e.target.value);
  $("#bk-ok").onclick = gesperrt(() => beginnSenden(zeitNorm($("#bk-beginn").value)));
}
// Schickt den neuen Beginn (hh:mm) an den Dienst; danach die Rückgängig-Leiste (oder eine Meldung). Ein Fehler steht im offenen Blatt.
async function beginnSenden(beginn) {
  try {
    const r = await api("POST", "/stempel", {aktion: "beginn", beginn});
    stempelUebernehmen(r, false);
    const text = `Beginn auf ${r.start_text} Uhr geändert.`;
    rueckgaengigZeigen(r, text) || toast(text);
  } catch (e) { formFehler($("#s-fehler"), e.message, {feld: $("#bk-beginn")}); }
}

// ---- Gehen vergessen (Wunsch vom 22.11.2026): beim Öffnen und beim Zurückkehren in die App einmal nach der echten Gehen-Zeit fragen
const GEHEN_SPAETER = "ho_gehen_spaeter";                          // Beginn der Uhr, zu der „Später“ gewählt wurde
const LETZTE_MINUTE = 23 * 60 + 59;
const GEHEN_UM = "Gehen um", GEHEN_FEHLT = "Bitte eintragen, wann du gegangen bist.";
let gehenGefragt = "";                                             // Beginn der Uhr, zu der seit dem Öffnen oder Zurückkehren schon gefragt wurde
// „Später“ gilt nur bis zum Schließen der App und nur auf diesem Gerät: Sitzungsspeicher statt localStorage, wird nicht synchronisiert.
const sitzung = {l(k) { try { return sessionStorage.getItem(EIGEN + k) || ""; } catch (e) { return ""; } }, s(k, v) { try { sessionStorage.setItem(EIGEN + k, v); } catch (e) {} }};
// Wurde „Gehen“ vergessen? Die Uhr läuft seit einem früheren Tag oder seit über 10 Stunden (genau 10 Stunden noch nicht).
function gehenVergessen() { return !!(stempelDaten && stempelDaten.laeuft) && (stempelFrueher() || stempelSekunden() > STEMPEL_VERGESSEN_S); }
// Erste Minute ab Beginn, in der „Gehen“ das Ist des Tages um ziel erhöht, aus den Stücken live [Minute, Zuwachs, Steigung] (wie laufendeMinuten);
// nie erreicht (Kappzeit, Ende des Tages): die Minute, ab der der Zuwachs stehen bleibt.
function liveErreicht(live, ziel) {
  for (let j = 0; j < live.length; j++) {
    const [von, wert, steigung] = live[j], bis = j + 1 < live.length ? live[j + 1][0] : Infinity, i = von + Math.ceil((ziel - wert) / (steigung || 1));
    if (wert >= ziel) return von;
    if (steigung > 0 && i < bis) return i;
  }
  return live.length ? live[live.length - 1][0] : 0;
}
// Vorbelegung „Gehen um“ (hh:mm): erste Minute, ab der „Gehen“ das restliche Soll bucht, nach der Tagesrechnung des Dienstes (Stücke live von
// GET /api/stempel: Pflichtpause mit Lücken und Pausen von Hand, Kappzeit); höchstens bisMin (23:59 am Tag des Beginns, am selben Tag „jetzt“).
// Ohne Soll (freier Tag, schon erreicht, Abruf fehlgeschlagen) oder ohne Stücke leer (sonst stünde dort der Beginn).
function gehenVorschlag(beginnMin, sollMin, bisMin, live = []) {
  if (!(sollMin > 0) || !live.length) return "";
  return hhmm(Math.min(beginnMin + liveErreicht(live, sollMin), bisMin));
}
// Restliches Soll des Tages, an dem die Uhr begann (Soll fürs Konto abzüglich schon Gebuchtem), in Minuten; 0, wenn es nicht abrufbar ist.
async function gehenSoll() {
  const t = stempelDaten.start_datum;
  try {
    const z = (await api("GET", `/monat/${+t.slice(0, 4)}/${+t.slice(5, 7)}`)).tage.find(x => x.datum === t);
    return z ? Math.max(0, z.soll_konto_min - z.ist_min) : 0;
  } catch (e) { return 0; }
}
// Öffnet die Rückfrage „Gehen vergessen?“, wenn die Uhr vergessen scheint und seit dem Öffnen noch nicht gefragt wurde. Nicht bei abgeschalteter
// Stempeluhr, in der Einrichtung, beim Ziel „Gehen nachtragen“ (öffnet das Blatt selbst), in der Demo, nach „Später“ und nie über einem anderen Blatt.
async function gehenVergessenPruefen() {
  if (modulAn("stempel") && !(stempelDaten && stempelDaten.laeuft)) return pauseOffenPruefen();
  if (!modulAn("stempel") || !gehenVergessen() || $("#einrichtung") || hashTeile()[1] === "stempel") return;
  const start = stempelDaten.start;
  if (gehenGefragt === start || sitzung.l(GEHEN_SPAETER) === start) return;
  try { if ((DEMO || await api("GET", "/demo")).aktiv) return; } catch (e) { return; }
  const soll = await gehenSoll();
  if (blattOffen() || !gehenVergessen() || stempelDaten.start !== start || gehenGefragt === start) return;   // währenddessen geöffnet oder gebucht
  gehenGefragt = start;
  gehenVergessenBlatt(soll);
}
// Zurück in der App: Stand der Uhr neu holen und noch einmal prüfen. Ohne Verbindung bleibt der alte Stand (stempelLaden setzte ihn auf null,
// dann verschwände die laufende Uhr aus Leiste und Taste).
async function stempelZurueck() {
  gehenGefragt = "";
  try { stempelDaten = await api("GET", "/stempel"); stempelDaten.t0 = Date.now(); stempelAnzeige(); } catch (e) { /* alter Stand bleibt */ }
  await gehenVergessenPruefen();
}
// „Gehen buchen“ in der Rückfrage: Ende aus dem Feld, Pause nach Regel, Ort wie beim Kommen. Ein leeres Feld wird abgewiesen, sonst buchte der Dienst bis „jetzt“
// (die ganze Nacht, wenn die Uhr erst kurz vor Mitternacht begann).
function gehenVergessenBuchen(art) {
  const ende = zeitNorm($("#gv-ende").value);
  if (!ende) return formFehler($("#s-fehler"), GEHEN_FEHLT, {feld: $("#gv-ende")});
  return gehenSenden({art, ende, pause: null, freigabe: false});
}
// Datum, an dem das Ende „ende“ (hh:mm) liegt, als TT.MM.JJJJ: der Tag des Beginns oder, mit der Regel „Stempeluhr über Mitternacht erlauben“, bei einem
// früheren Tag und einer Uhrzeit vor dem Beginn der Tag danach (so bucht es POST /api/stempel; gezählt wird immer auf den Tag des Beginns).
// Ohne die Regel endet die Zeit spätestens um 23:59 am Tag des Beginns.
function gehenAm(ende) {
  const d = new Date(stempelDaten.start_datum + "T12:00");
  if (KONFIG.stempel_mitternacht && stempelFrueher() && ende && minuten(ende) < minuten(stempelDaten.start_text)) d.setDate(d.getDate() + 1);
  return d.toLocaleDateString("de-DE", {day: "2-digit", month: "2-digit", year: "numeric"});
}
// Blatt „Gehen vergessen?“: Beginn, Feld „Gehen um“ (vorbelegt aus sollMin), Knöpfe „Gehen buchen“ (Pause nach Regel, Ort wie beim Kommen) und „Später“.
// „Mehr“ öffnet das ausführliche Blatt (Pause, Ort, Freigabe über 10 Stunden, Verwerfen).
function gehenVergessenBlatt(sollMin) {
  const d = stempelDaten, h = new Date(), frueher = stempelFrueher();
  const bis = frueher ? LETZTE_MINUTE : h.getHours() * 60 + h.getMinutes();
  const vorschlag = gehenVorschlag(minuten(d.start_text), sollMin, bis, d.live || []);
  const am = ende => frueher ? ` <small id="gv-am">(am ${esc(gehenAm(ende))})</small>` : "";
  blatt(`<h3>Gehen vergessen?</h3>
    <p class="hinweis">Die Stempeluhr läuft seit ${esc(stempelTag())}, ${esc(d.start_text)} Uhr (${d.art === "ho" ? "Homeoffice" : "Büro"}). Wann hast du aufgehört?</p>
    <label for="gv-ende">${GEHEN_UM}${am(vorschlag)}</label><input id="gv-ende" inputmode="numeric" placeholder="hh:mm" value="${vorschlag}">
    <p class="hinweis">Die Pause zieht die App nach der Pausenregel ab (${pausenText()}). Gebucht wird auf den ${esc(stempelTag())}.</p>
    <div id="s-fehler"></div>
    <div class="knoepfe"><button class="prim" id="gv-buchen">Gehen buchen</button><button id="gv-mehr">Mehr</button><button class="leise" id="gv-spaeter">Später</button></div>`);
  $("#gv-ende").onblur = e => {                       // das Datum folgt der Uhrzeit; der Name fürs Vorlesen kommt über label for mit
    e.target.value = zeitNorm(e.target.value);
    if (frueher) $("#gv-am").textContent = `(am ${gehenAm(e.target.value)})`;
  };
  $("#gv-buchen").onclick = gesperrt(() => gehenVergessenBuchen(d.art));
  $("#gv-spaeter").onclick = () => { sitzung.s(GEHEN_SPAETER, d.start); blattZu(); };
  $("#gv-mehr").onclick = () => stempelBlatt();
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
  ["zeit", "Zeit", [["tag", "Tag"], ["woche", "Woche"], ["monat", "Monat"], ["suche", "Suche"]]],
  ["homeoffice", "Homeoffice", [["horest", "Spielraum"], ["jahr", "Jahr"]]],
  ["abwesenheit", "Abwesenheit", [["urlaub", "Urlaub"], ["krank", "Krank"], ["sondertage", "Sondertage"]]],
  ["auswertung", "Auswertung", [["monatsnachweis", "Monatsnachweis"], ["export", "Export"], ["steuer", "Steuer"]]],
  ["daten", "Daten", [["sicherung", "Sicherung"], ["sync", "Synchronisieren"]]],
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
// Übergeordnete Seite einer Unterseite (einstellungen/aussehen → einstellungen) oder leer; Ziel des Zurück-Pfeils in beiden Darstellungen.
const elternSeite = (seite, unter) => unterseiteName(seite, unter) ? seite : "";
const ZURUECK_NAME = "Zurück";
// Name des Zurück-Pfeils für Screenreader: auf einer Unterseite mit dem Namen der übergeordneten Seite.
const zurueckName = eltern => eltern ? `${ZURUECK_NAME} zu ${bereichVon(eltern)[2].find(([s]) => s === eltern)[1]}` : ZURUECK_NAME;
// Name einer Unterseite (z. B. „Person und Startwerte“) oder leer.
const unterseiteName = (seite, unter) => ((Object.hasOwn(UNTERSEITEN, seite) ? UNTERSEITEN[seite] : []).find(([u]) => u === unter) || [])[1] || "";
// Weg zu einer Seite für Hilfe und Meldungen, z. B. „Abwesenheit → Urlaub“; am Handy mit „Menü → “ davor, wenn der Bereich nicht in der Leiste steht.
function weg(seite, unterseite = "") {
  const [b, , reiter] = bereichVon(seite), teile = [bereichName(b)];
  if (reiter.filter(([s]) => !navWeg(s)).length > 1) teile.push(reiter.find(([s]) => s === seite)[1]);   // wie fensterTitel: nur bei mehreren sichtbaren Reitern
  if (unterseiteName(seite, unterseite)) teile.push(unterseiteName(seite, unterseite));
  if (document.body.dataset.design === "handy" && !HANDY_NAV.includes(b)) teile.unshift(MENUE_WEG);
  return teile.join(WEG_TRENNER);
}
// Überschrift oben (h1 #titel): Name der Unterseite, sonst der Bereich (Meldung 26.11.2026: auf Unterseiten stand nur „Einstellungen“).
const kopfTitel = (seite, unter) => unterseiteName(seite, unter) || bereichName(bereichVon(seite)[0]);
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
// Ziel einer Adresse mit Abschnitt (…/anordnen, #/woche/gleitzeit): Überschrift h oben ins Bild, Fokus darauf (der Screenreader sagt sie an). Ohne h nichts.
function ueberschriftZeigen(h) {
  if (!h) return;
  h.tabIndex = -1; h.scrollIntoView({block: "start"}); h.focus({preventScroll: true});
}
// Stellt eine alte Adresse (#/abgleich/…) auf die neue um (#/sync/…), ohne Eintrag im Verlauf. Erste Anweisung von zeigen().
function adresseUmstellen() {
  const ziel = neueAdresse(hashTeile());
  if (ziel) history.replaceState(history.state, "", ziel);
}

// ---- Zu tun: gemerkte Wahl dieses Geräts und Zahl am Symbol der Übersicht (aufbau.md 5); in der Grundlage, weil Start und Rückkehr sie brauchen
const ZUTUN_STUFEN = {rot: "Dringend", gelb: "Bald erledigen", info: "Hinweis"};
// Liest eine gemerkte Liste oder Zuordnung dieses Geräts (JSON in speicher), bei Unsinn leer.
const zutunGemerkt = (schluessel, leer) => { try { return JSON.parse(speicher.l(schluessel, "")) || leer; } catch (e) { return leer; } };
// Ist „Zu tun“ an (Modul an und unter „Kacheln anpassen“ nicht ausgeblendet)? Aus heißt ganz aus: keine Karte, keine roten Einträge oben, keine Zahl.
const zutunAn = () => modulAn("zutun") && !uebersichtLesen().aus.includes("zutun");
// Einträge „Zu tun“ vom Server; die eigenständige Web-App gibt das Datum der letzten Sicherung mit (liegt nur im Browser). Fehler oder „Zu tun“ aus: null,
// dann stehen die Warnung zur Jahres-Prognose wieder an der Quote im Jahr und das Band zur Sicherung erscheint (ZUTUN_IDS bleibt leer).
function zutunLaden() {
  if (!zutunAn()) return Promise.resolve(null);
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
// Zahl am Symbol aus einer Antwort von GET /api/zutun.
function zutunZahl(antwort) { zutunZahlSetzen(zutunSichtbar(antwort).length); }
// Setzt die Zahl am Symbol auf n, aber nur, wenn die Karte „Zu tun“ zu sehen wäre: Modul aus oder unter „Kacheln anpassen“ ausgeblendet: keine Zahl.
function zutunZahlSetzen(n) { zahlAmSymbol(zutunAn() ? n : 0); }
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

// ---- Kacheln anpassen (Wunsch 22.11.2026, bis 24.11.2026 „Übersicht anordnen“): Karten zeigen oder ausblenden und ihre Reihenfolge, je Gerät (speicher, nicht im Profil, nicht synchronisiert).
// „Heute“ mit der Stempeluhr bleibt fest oben; Einrichtung und Demo-Angebot davor auch. Hier, weil Übersicht und Einstellungen sie brauchen.
const UEBERSICHT_SPEICHER = "ho_uebersicht";
// Anordbare Karten in der Standardreihenfolge (Entscheidung des Entwicklers 24.11.2026: Heute | Diese Woche direkt unter der Heute-Karte, dann Gleitzeit,
// am Computer im Bild neben der Heute-Karte, start.css; dann Zu tun, die Quoten und der Rest): Name für die Liste und ob es die Karte gibt
// (Modul an, Quote nur mit zwei Arbeitsorten).
const UEBERSICHT_KACHELN = [
  {id: "tag", name: "Heute", da: () => true},
  {id: "woche", name: "Diese Woche", da: () => modulAn("woche")},
  {id: "gleitzeit", name: "Gleitzeit", da: () => modulAn("gleitzeit")},
  {id: "zutun", name: "Zu tun", da: () => modulAn("zutun")},
  {id: "jahreswechsel", name: "Jahreswechsel (im Januar)", da: () => true},
  {id: "monat", name: "Quote im Monat", da: () => !einOrt()},
  {id: "jahr", name: "Quote im Jahr", da: () => !einOrt()},
  {id: "quote", name: "Quote-Ampel", da: () => mitGrenze()},
  {id: "urlaub", name: "Urlaub", da: () => modulAn("urlaub")},
  {id: "krank", name: "Krank", da: () => modulAn("krank")},
  {id: "freizeit", name: "Freizeitkonto", da: () => modulAn("freizeit")},
];
// Neue Karten, die in einer gemerkten Folge direkt vor einer anderen stehen sollen statt am Ende (Entscheidung des Entwicklers 24.11.2026)
const UEBERSICHT_VOR = {tag: "woche"};
// Gemerkte Anordnung {folge, aus}, robust gelesen: nur bekannte Namen ohne Doppelte, fehlende (neue Karten) hängen am Ende an, außer sie stehen in
// UEBERSICHT_VOR (dann vor ihrer Nachbarin, wenn die gemerkt ist); Unlesbares ist der Standard.
function uebersichtLesen() {
  let w = null;
  try { w = JSON.parse(speicher.l(UEBERSICHT_SPEICHER, "")); } catch (e) {}
  const ids = UEBERSICHT_KACHELN.map(k => k.id);
  const bekannt = x => Array.isArray(x) ? [...new Set(x.filter(id => ids.includes(id)))] : [];
  const folge = bekannt(w?.folge);
  for (const [neu, vor] of Object.entries(UEBERSICHT_VOR)) if (!folge.includes(neu) && folge.includes(vor)) folge.splice(folge.indexOf(vor), 0, neu);
  return {folge: [...new Set([...folge, ...ids])], aus: bekannt(w?.aus)};
}
// Karten für die Liste der Einstellungen in der gemerkten Folge, nur die es gibt.
function uebersichtListe() {
  return uebersichtLesen().folge.map(id => UEBERSICHT_KACHELN.find(k => k.id === id)).filter(k => k.da());
}
// Schiebt eine Karte um schritt (-1 hoch, 1 runter) an der nächsten gelisteten vorbei und merkt das; Karten, die es nicht gibt, bleiben an ihrem Platz.
// Rückgabe: ob sich etwas geändert hat (am Rand nicht).
function uebersichtSchieben(id, schritt) {
  const stand = uebersichtLesen(), da = uebersichtListe().map(k => k.id);
  const i = da.indexOf(id), j = i + schritt;
  if (i < 0 || j < 0 || j >= da.length) return false;
  const a = stand.folge.indexOf(id), b = stand.folge.indexOf(da[j]);
  [stand.folge[a], stand.folge[b]] = [stand.folge[b], stand.folge[a]];
  speicher.s(UEBERSICHT_SPEICHER, JSON.stringify(stand));
  return true;
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
// Verlauf (Zurück im Browser, Wischgeste, Android-Taste, Alt+←): Das offene Blatt hat einen eigenen Eintrag mit derselben Adresse, Zurück schließt nur das Blatt.
// Ohne ihn sprang Zurück zur Seite davor, meist zur Übersicht (Fehlermeldung 22.11.2026). verlauf: Adresse, Art und Tiefe des Eintrags, auf dem die Seite steht.
// Tiefe = Seiten der App vor diesem Eintrag (im Zustand des Eintrags, übersteht Neuladen); 0 heißt: Der Zurück-Knopf führt zur Übersicht statt aus der App.
let verlauf = {adresse: location.href, blatt: false, tiefe: 0};
// Merkt den Eintrag, auf dem die Seite jetzt steht (nach Seitenwechsel oder Schritt im Verlauf).
function verlaufMerken() { verlauf = {adresse: location.href, blatt: !!history.state?.blatt, tiefe: history.state?.tiefe || 0}; }
// Seitenwechsel (hashchange): Ein neuer Eintrag hat noch keinen Zustand und bekommt die Tiefe der Seite davor plus eins; ein Schritt im Verlauf trifft einen gezählten.
function seiteImVerlauf() {
  if (!history.state) history.replaceState({tiefe: verlauf.tiefe + 1}, "");
  verlaufMerken();
}
// Legt den Eintrag des Blatts an (gleiche Adresse und Tiefe, kein hashchange).
function blattEintrag() { history.pushState({blatt: true, tiefe: verlauf.tiefe}, ""); verlaufMerken(); }
// Ist das Blatt offen?
const blattOffen = () => $("#blatt").classList.contains("auf");
// Schritt im Verlauf (popstate). Gleiche Adresse heißt: Schritt vom Eintrag eines Blatts. Ist es offen, schließt es (eine Rückfrage darüber zuerst,
// das Blatt bekommt dann wieder einen Eintrag); war es schon per Knopf zu, gleich einen Schritt weiter, sonst bliebe dieser Druck ohne Wirkung.
// Andere Adresse: Seitenwechsel, den zeichnet hashchange.
function blattVerlauf() {
  const vorher = verlauf;
  verlaufMerken();
  if (location.href !== vorher.adresse) return;
  if (blattOffen()) { blattZu(); if (blattOffen()) blattEintrag(); }
  else if (vorher.blatt) history.back();
}
// Öffnet das Blatt (Dialog) mit dem gegebenen HTML; der Fokus geht ins Blatt.
function blatt(html) {
  const inh = $("#blatt-inh"), warOffen = $("#blatt").classList.contains("auf");
  if (!warOffen) blattVon = document.activeElement;
  inh.innerHTML = html; beschriften(inh);
  inh.setAttribute("aria-label", inh.querySelector("h3")?.textContent || "Eingabe");
  $("#blatt").classList.add("auf"); blattSperre(true);
  if (!warOffen && !verlauf.blatt) blattEintrag();          // ein per Knopf geschlossenes Blatt hinterlässt seinen Eintrag: wieder benutzen
  if (!warOffen) inh.focus({preventScroll: true});          // das Blatt selbst, kein Feld: am Handy soll die Tastatur nicht aufspringen
}
// Eigene Rückfrage statt des Browser-Dialogs: passt zu Hell/Dunkel und Akzentfarbe, zeigt in den Apps keine Herkunftszeile, die gefährliche Wahl ist rot.
// Esc, Tipp daneben und „Abbrechen“ heißen nein; der Fokus steht auf „Abbrechen“, ein versehentliches Enter löscht also nichts.
let blattZuRueck = null;
// Rückfrage als Blatt; liefert ein Versprechen: true bei Bestätigen, false bei Abbrechen, Esc oder Tipp daneben.
// haken (optional, {text, merken}) zeigt ein Ankreuzfeld; merken() läuft nur, wenn es angekreuzt ist und die Person bestätigt.
function frage(text, ja, gefahr = false, haken = null) {
  return new Promise(ok => {
    // Steht schon ein Blatt offen (Stempeluhr, Abschnitt), bleibt es bei „Abbrechen“ samt Eingaben stehen: Knoten merken statt neu zeichnen
    const inh = $("#blatt-inh"), vorher = $("#blatt").classList.contains("auf") ? {knoten: [...inh.childNodes], name: inh.getAttribute("aria-label"), fokus: document.activeElement} : null;
    const [titel, ...rest] = text.split("\n\n");
    blatt(`<h3>${esc(titel)}</h3>${rest.map((x, i) => `<p class="hinweis" id="frage-text-${i}">${esc(x).replace(/\n/g, "<br>")}</p>`).join("")}${haken ? `<label class="frage-haken"><input type="checkbox" id="frage-haken">${esc(haken.text)}</label>` : ""}
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
    $("#frage-ja").onclick = () => { if (haken && $("#frage-haken").checked) haken.merken(); ende(true); blattZu(); };
    $("#frage-nein").onclick = () => blattZu();
    $("#frage-nein").focus({preventScroll: true});
  });
}
// Schließt das Blatt und gibt den Fokus zurück an den Knopf, der es geöffnet hat; eine verdeckte Rückgängig-Leiste läuft danach weiter.
function blattZu() {
  if (!$("#blatt").classList.contains("auf")) return;
  if (blattZuRueck) { const r = blattZuRueck; blattZuRueck = null; if (r()) return; }
  $("#blatt").classList.remove("auf"); blattSperre(false);
  if (blattVon?.isConnected) blattVon.focus({preventScroll: true});
  blattVon = null;
  rueckNachBlatt();
}
// ---- Rückweg aus der Hilfe (Hilferunde 23.11.2026): Das „?“ merkt im Eintrag der Seite die Scrollposition (y) und legt den Eintrag der Hilfe selbst an,
// mit dem Namen der Seite (hilfeVon). Beides steht im Verlauf und übersteht Neuladen. „Zurück zu <Seite>“ und die Zurück-Taste gehen denselben Schritt.
// Öffnet die Hilfe-Adresse ziel als neuen Eintrag (wie ein Link, hashchange zeichnet) und merkt Scrollposition und Namen der Seite, von der das „?“ kam.
function hilfeOeffnen(ziel, name) {
  history.replaceState({...history.state, y: Math.round(scrollY)}, "");
  history.pushState({tiefe: verlauf.tiefe + 1, hilfeVon: name}, "", ziel);
  dispatchEvent(new HashChangeEvent("hashchange"));         // pushState meldet keinen Seitenwechsel, anlauf.js zeichnet auf hashchange
}
// Name der Seite für „Zurück zu …“, wenn dieser Eintrag über „?“ entstand; sonst leer.
const hilfeRueckName = () => history.state?.hilfeVon || "";
// Aktion „Zurück zu <Seite>“: ein Schritt zurück im Verlauf, wie die Zurück-Taste.
const hilfeZurueck = () => history.back();
// Gemerkte Scrollposition des Eintrags (einmal: sie wird dabei entfernt, Tiefe und Blatt bleiben) oder null.
function scrollGemerkt() {
  const {y, ...rest} = history.state || {};
  if (typeof y !== "number") return null;
  history.replaceState(rest, "");
  verlaufMerken();
  return y;
}

// ---- „?“ neben dem Seitentitel (Hilferunde 23.11.2026): öffnet die Hilfe beim Abschnitt der Seite und merkt den Rückweg (bausteine/blatt.js).
// Abschnitt je Seite, Unterseiten als „seite/unter“ (fehlt eine, gilt die Seite); Ersatz, wenn der Abschnitt in dieser Fassung ausgeblendet ist.
const HILFE_ZU_SEITE = {start: "uebersicht_karten", tag: "tag_blatt", woche: "buchen", monat: "monat_raster", suche: "suche_tage", horest: "spielraum", jahr: "jahresrueckblick", urlaub: "urlaub", krank: "krank", sondertage: "sondertage", monatsnachweis: "monatsnachweis", export: "exporte", steuer: "uebersicht", sicherung: "sicherung", sync: "sync", einstellungen: "gueltigkeit", "einstellungen/arbeitszeit": "abschnitte", "einstellungen/person": "startwerte", "einstellungen/aussehen": "aussehen", "einstellungen/module": "module", "einstellungen/geraete": "update"};
const HILFE_ERSATZ = {steuer: ["quote"], horest: ["quote"], jahr: ["quote"], woche: ["tag_blatt"], "einstellungen/geraete": ["sync", "personen"]};
const HILFE_GRUND = "aufbau";                                        // letzter Ersatz: wie die App aufgebaut ist (immer sichtbar)
// Abschnitt der Hilfe für eine Seite und Unterseite: der eigene, sonst der erste sichtbare Ersatz, sonst HILFE_GRUND (hilfeSichtbar aus seiten/hilfe.js).
function hilfeZiel(seite, unter = "") {
  const schluessel = unterseiteName(seite, unter) ? seite + "/" + unter : seite;
  return [HILFE_ZU_SEITE[schluessel] || HILFE_ZU_SEITE[seite], ...(HILFE_ERSATZ[schluessel] || [])].find(s => s && hilfeSichtbar(s)) || HILFE_GRUND;
}
// Setzt das „?“ für die gezeigte Seite: Name für den Screenreader; nicht auf der Hilfe selbst und nicht, wenn das Modul Hilfe aus ist.
function hilfeKnopfSetzen(seite) {
  const k = $("#titel-hilfe");
  k.hidden = seite === "hilfe" || seiteWeg("hilfe");
  k.setAttribute("aria-label", "Hilfe zu " + fensterTitel(seite));
}
// Aktion des „?“: Hilfe beim Abschnitt der gezeigten Seite öffnen, Rückweg mit Namen der Seite merken.
function hilfeZuSeite() {
  const seite = seitenName();
  hilfeOeffnen("#/hilfe/" + hilfeZiel(seite, hashTeile()[1] || ""), fensterTitel(seite));
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
// Minuten aus „6:30“, „6,5“ oder „6“ (Summe der Stunden je Tag, Einträge ohne Uhrzeit der Seite Tag, auch aus zeitText); was sich nicht lesen lässt, ergibt NaN (prüfen tut der Server).
function dauerMinuten(t) {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (m) return +m[1] * 60 + +m[2];
  return /^\d{1,2}([.,]\d+)?$/.test(t) ? Math.round(parseFloat(t.replace(",", ".")) * 60) : NaN;
}
// ---- bausteine/formate.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Format-Knöpfe der Exporte nach den Format-Modulen (ex_pdf, ex_office …); gemeinsam für die Seiten Export und Steuer, damit abgeschaltete Formate überall fehlen.
// Formate der Homeoffice-Übersicht (api/steuer/<Jahr>.<Endung>): [Name, Endung].
const FORMATE_UEBERSICHT = [["PDF", "pdf"], ["Excel", "xlsx"]];
const ENDUNG_MODUL = {pdf: "ex_pdf", docx: "ex_office", xlsx: "ex_office", csv: "ex_daten", ics: "ex_kalender"};   // Word (docx) nur beim Monatsnachweis
// Ist der Link eines Exports (nach Dateiendung) bei den eingeschalteten Modulen erlaubt?
const linkAn = u => modulAn(ENDUNG_MODUL[u.split("?")[0].split(".").pop()] || "");
// Format-Knöpfe einer Karte (erster hervorgehoben), nur die von den Modulen erlaubten; leer, wenn keiner bleibt.
function exportKnoepfe(links, titel) {
  const an = links.filter(([, u]) => linkAn(u));
  return an.length ? `<div class="knoepfe">${an.map(([n, u], i) => `<a class="btn${i ? "" : " prim"}" href="${u}" aria-label="${esc(`${titel}: ${n}`)}">${esc(n)}</a>`).join("")}</div>` : "";
}
// ---- bausteine/gleitzeit_verlauf.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Baustein Gleitzeit-Verlauf: Karte für die Seiten Tag, Woche, Monat (Zeitraum, GET /api/gleitzeit/verlauf?von=&bis=) und Jahr (Jahresrückblick,
// GET /api/gleitzeit/verlauf/<J>), dazu das Bild der Kachel „Gleitzeit“ der Übersicht (Wunsch 25.11.2026).
// Maße des Gleitzeit-Verlaufs (viewBox): kleinste Breite, höchster Maßstab (px je Einheit), Höhe, Rand oben/unten für Grenztexte und die zwei Zeilen der KW-Achse, Rand links für die Stunden.
const GZ_BREITE = 360, GZ_SKALA = 4 / 3, GZ_HOEHE = 152, GZ_OBEN = 16, GZ_UNTEN = 32, GZ_LINKS = 40, GZ_STRICH = "6 4", GZ_PUNKT_R = 3;
// Stundenachse (Wunsch 23.11.2026): höchstens so viele Abschnitte, Schritte 1, 2, 5 mal 10er-Potenz; KW-Achse: Marke alle 5 KW, am Handy nur jede zweite (alle 10 KW).
const GZ_ABSCHNITTE = 5, GZ_SCHRITTE = [1, 2, 5], GZ_KW_SCHRITT = 5, GZ_KW_GROB = 10, GZ_KW_RAND = 8, GZ_KW_ZEILE = 13, MIN_JE_STUNDE = 60;
// Zeiträume der Seiten (Wunsch 25.11.2026): Tag die letzten 10 Tage, Woche die letzten 3 Wochen, Monat die letzten 3 Monate, je bis zum gezeigten Zeitraum.
const GZ_TAGE_ZURUECK = 9, GZ_WOCHEN_ZURUECK = 2, GZ_MONATE_ZURUECK = 2, GZ_TAG_MS = 86400000;
const GZ_ZEITRAUM_TEXT = {tag: "Letzte 10 Tage", woche: "Letzte 3 Wochen", monat: "Letzte 3 Monate"};
// Achsentexte: Schriftgröße ohne Messung (wie das CSS am Handy), geschätzte Breite je Zeichen (em; Stunden bestehen aus Ziffern, Datum und KW haben
// breite Buchstaben), Lücke zwischen zwei Datumstexten und zwischen Stundentext und Zeichenfläche (Einheiten der viewBox).
const GZ_SCHRIFT = 12, GZ_ZIFFER_EM = 0.5, GZ_ZEICHEN_EM = 0.6, GZ_LUECKE = 4, GZ_MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
// Kachel „Gleitzeit“ (etwa 165 px am Handy): eine Einheit je Pixel, damit die Schrift lesbar bleibt; kleinste Breite der viewBox.
const GZ_KACHEL_SKALA = 1, GZ_KACHEL_BREITE = 150;
// Saldo mit Vorzeichen wie woche.fmt_saldo im Server: auch 0 mit „+“ (zeitText setzt „+“ nur über 0).
const gzSaldo = m => (m < 0 ? "" : "+") + zeitText(m);
// Datum JJJJ-MM-TT als „TT.MM.“ (maskiert).
const gzTag = d => esc(`${String(d).slice(8, 10)}.${String(d).slice(5, 7)}.`);
// Datum JJJJ-MM-TT als „TT.MM.JJJJ“ (in der Tabelle immer mit Jahr, auch über den Jahreswechsel).
const gzDatum = d => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
// Erste Spalte der Tabelle: ISO-KW und Zeitraum Montag bis Sonntag der Woche des Punkts, z. B. „KW 1 · 29.12.2025–04.01.2026“ („von“ darf im Vorjahr liegen,
// die laufende Woche endet am Sonntag). Rechnet mit kwJahr und zeitZeitraum der Seite Woche; Trennzeichen sind aria-hidden, vorgelesen wird „KW 1, … bis …“.
function gzWoche(d) {
  const [von, bis] = zeitZeitraum("woche", d), sr = t => `<span class="sr">${t}</span>`, still = t => `<span aria-hidden="true">${t}</span>`;
  return esc(`KW ${kwJahr(isoZuDatum(d))[1]}`) + still(" · ") + sr(", ") + `<span class="gz-zeit">${esc(gzDatum(von))}${still("–")}${sr(" bis ")}${esc(gzDatum(bis))}</span>`;
}
// Stufen der Stundenachse für den Bereich unten bis oben (Minuten): kleinster Schritt (Stunden) aus 1, 2, 5, 10, 20, 50 …, mit dem der Bereich
// in höchstens abschnitte Abschnitte passt; Rückgabe {schritt, werte (Stunden), unten, oben (Minuten, auf ganze Schritte erweitert)}.
// Ohne Bereich (alles 0) eine Stufe über 0, damit das Bild nicht durch 0 teilt.
function gzStufen(untenMin, obenMin, abschnitte = GZ_ABSCHNITTE) {
  const spanne = (obenMin - untenMin) / MIN_JE_STUNDE;
  const kandidaten = [0, 1, 2, 3, 4, 5].flatMap(e => GZ_SCHRITTE.map(f => f * 10 ** e));
  const schritt = kandidaten.find(k => spanne / k <= abschnitte) ?? kandidaten.at(-1);
  const von = Math.floor(untenMin / MIN_JE_STUNDE / schritt), bis = Math.max(Math.ceil(obenMin / MIN_JE_STUNDE / schritt), von + 1);
  const werte = Array.from({length: bis - von + 1}, (_, i) => (von + i) * schritt);
  return {schritt, werte, unten: werte[0] * MIN_JE_STUNDE, oben: werte.at(-1) * MIN_JE_STUNDE};
}
// Marken der KW-Achse eines Jahres: Montag jeder GZ_KW_SCHRITT-ten ISO-KW (1, 6, 11 …) des KW-Jahres als {kw, datum, grob}; die KW 1, die im Vorjahr
// beginnt, steht am 01.01.; Wochen am Jahresanfang, die zum Vorjahr gehören (z. B. KW 53), und die KW 1 des Folgejahrs am Jahresende bekommen keine Marke.
function gzKwMarken(jahr) {
  const neujahr = new Date(jahr, 0, 1, 12), d = new Date(neujahr), marken = [];
  d.setDate(d.getDate() - (d.getDay() + 6) % 7);
  for (; d.getFullYear() <= jahr; d.setDate(d.getDate() + 7)) {
    const [kj, kw] = kwJahr(d);
    if (kj === jahr && (kw - 1) % GZ_KW_SCHRITT === 0) marken.push({kw, text: `KW ${kw}`, erste: kw === 1, datum: datumZuIso(d < neujahr ? neujahr : d), grob: (kw - 1) % GZ_KW_GROB === 0});
  }
  return marken;
}
// Zeitraum [von, bis] (JJJJ-MM-TT) der Karte einer Seite für den gezeigten Tag d: tag die letzten 10 Tage bis d, woche Montag vor 2 Wochen bis Sonntag der Woche
// von d, monat der 1. vor 2 Monaten bis Ende des Monats von d; bis höchstens heute (liegt der Zeitraum ganz nach heute, ist bis kleiner als von).
function gzZeitraum(art, d, heute) {
  const t = isoZuDatum(d);
  let von = new Date(t), bis = new Date(t);
  if (art === "tag") von.setDate(von.getDate() - GZ_TAGE_ZURUECK);
  else if (art === "woche") { von.setDate(von.getDate() - (von.getDay() + 6) % 7 - 7 * GZ_WOCHEN_ZURUECK); bis = new Date(von); bis.setDate(bis.getDate() + 7 * (GZ_WOCHEN_ZURUECK + 1) - 1); }
  else { von = new Date(t.getFullYear(), t.getMonth() - GZ_MONATE_ZURUECK, 1, 12); bis = new Date(t.getFullYear(), t.getMonth() + 1, 0, 12); }
  const b = datumZuIso(bis);
  return [datumZuIso(von), b < heute ? b : heute];
}
// Marken der Achse eines Zeitraums: tag jeder Tag („TT.MM.“), woche jeder Montag („KW n“), monat jeder Monatserste („Sep“); alle grob (auch am Handy).
function gzZeitraumMarken(art, von, bis) {
  const d = isoZuDatum(von), ende = isoZuDatum(bis), marken = [];
  for (; d <= ende; d.setDate(d.getDate() + 1)) {
    const iso = datumZuIso(d), text = art === "tag" ? gzTag(iso) : art === "woche" && d.getDay() === 1 ? `KW ${kwJahr(d)[1]}` : art === "monat" && d.getDate() === 1 ? GZ_MONATE[d.getMonth()] : "";
    if (text) marken.push({text, datum: iso, grob: true});
  }
  return marken;
}
// Art der Antwort: „jahr“ ohne Angabe (GET /gleitzeit/verlauf/<J>), sonst tag, woche oder monat.
const gzArt = v => Object.hasOwn(GZ_ZEITRAUM_TEXT, v?.art) ? v.art : "jahr";
// Erster und letzter Tag der Achse: von/bis der Antwort, beim Jahr ohne Angabe 01.01. bis 31.12.
const gzGrenzen = v => [String(v.von || `${Number(v.jahr)}-01-01`), String(v.bis || `${Number(v.jahr)}-12-31`)];
// Stunden als Achsentext mit echtem Minus, z. B. „−20 h“.
const gzStunden = h => `${h < 0 ? "−" : ""}${Math.abs(h)} h`;
// Geschätzte Breite eines Achsentexts bei der Schrift schrift (Einheiten der viewBox); em: Breite je Zeichen.
const gzTextBreite = (text, schrift, em = GZ_ZEICHEN_EM) => text.length * em * schrift;
// Ausrichtung eines Achsentexts bei x: am linken und rechten Rand nach innen, sonst mittig.
const gzAnker = (x, links, breite) => x < links + GZ_KW_RAND ? "start" : x > breite - GZ_KW_RAND ? "end" : "middle";
// Punkte der Antwort als {datum, m} (nur Text und Zahl gehen weiter).
const gzPunkte = v => v.punkte.map(p => ({datum: String(p.datum), m: Number(p.saldo_min) || 0}));
// Bild des Gleitzeit-Verlaufs (SVG, aria-hidden) aus der Antwort mit mindestens einem Punkt: Linie des Kontos über das Jahr bzw. den Zeitraum (von/bis),
// Nulllinie, Stundenachse und Achse der Zeit (Jahr: KW-Marken; Zeitraum: gzZeitraumMarken, nur Texte, die nicht an den vorigen stoßen)
// mit Hilfslinien, beide Grenzen gestrichelt mit Text (Grenze 0 = kein Hinweis: keine Linie). breite: Breite der viewBox (gzBildBreite); breiter als GZ_BREITE
// heißt eingepasst (Klasse GZ_EINGEPASST, ohne die 480-px-Grenze des Grundbilds). schrift: echte Schriftgröße der Achse (gzEinpassen misst sie);
// der Rand links fasst die Stundentexte, damit sie bei großer Schrift nicht aus Karte oder Kachel ragen.
// Im Bild stehen nur Zahlen (Number) und Texte aus zeitText; Daten aus der Antwort gehen sonst nur maskiert hinein.
function gzBildSvg(v, breite, schrift = GZ_SCHRIFT) {
  const art = gzArt(v), [von, bis] = gzGrenzen(v), punkte = gzPunkte(v), letzt = punkte.at(-1);
  const plus = Number(v.plus_min) || 0, minus = -(Number(v.minus_min) || 0), werte = punkte.map(p => p.m);
  const stufen = gzStufen(Math.min(...werte, minus, 0), Math.max(...werte, plus, 0)), {oben, unten} = stufen, spanne = oben - unten;
  const links = Math.max(GZ_LINKS, Math.ceil(Math.max(...stufen.werte.map(h => gzTextBreite(gzStunden(h), schrift, GZ_ZIFFER_EM))) + GZ_LUECKE));
  const anfang = Date.parse(von), dauer = Date.parse(bis) + GZ_TAG_MS - anfang, flaeche = breite - links;
  const xZahl = d => links + ((Date.parse(d) - anfang) / dauer * flaeche || 0), x = d => xZahl(d).toFixed(1);
  const y = m => (GZ_OBEN + (oben - m) / spanne * (GZ_HOEHE - GZ_OBEN - GZ_UNTEN)).toFixed(1);
  const linie = (m, klasse, strich = "") => `<line class="${klasse}" x1="${links}" x2="${breite}" y1="${y(m)}" y2="${y(m)}"${strich ? ` stroke-dasharray="${strich}"` : ""}/>`;
  // Stundenachse: dezente Linie je Stufe (0 ist die Nulllinie), Text rechtsbündig im Rand links
  const stunden = stufen.werte.map(h => (h ? linie(h * MIN_JE_STUNDE, "raster") : "") +
    `<text class="stunde" x="${links - GZ_LUECKE}" y="${y(h * MIN_JE_STUNDE)}" text-anchor="end" dominant-baseline="middle">${gzStunden(h)}</text>`).join("");
  // KW-Achse: senkrechte Linie je Marke, Text darunter, versetzt in zwei Zeilen (grobe oben, feine darunter): je Zeile 10 KW Abstand, so stoßen
  // die Texte auch bei großer Schrift nicht aneinander; am Handy fehlen die feinen (CSS). Am linken und rechten Rand nach innen ausgerichtet.
  const kwText = m => { const xm = xZahl(m.datum).toFixed(1), anker = gzAnker(xZahl(m.datum), links, breite);
    const zeile = GZ_HOEHE - GZ_UNTEN + GZ_KW_ZEILE * (m.grob ? 1 : 2);
    return `<g class="kw${m.grob ? " grob" : ""}${m.erste ? " erste" : ""}"><line x1="${xm}" x2="${xm}" y1="${GZ_OBEN}" y2="${GZ_HOEHE - GZ_UNTEN}"/><text x="${xm}" y="${zeile}" text-anchor="${anker}">${esc(m.text)}</text></g>`; };
  // Zeitraum: jede n-te Marke mit dem kleinsten n, bei dem jeder Text mit Lücke hinter dem vorigen beginnt; gerechnet mit der Lage nach dem Anker
  // (der erste Text reicht nach rechts). Gleicher Schritt, damit die Achse gleichmäßig bleibt.
  const bereich = m => { const xm = xZahl(m.datum), w = gzTextBreite(m.text, schrift), anker = gzAnker(xm, links, breite);
    const l = anker === "start" ? xm : anker === "end" ? xm - w : xm - w / 2;
    return [l, l + w]; };
  const passt = ms => ms.map(bereich).every(([l], i, b) => !i || l > b[i - 1][1] + GZ_LUECKE);
  const alle = art === "jahr" ? gzKwMarken(Number(v.jahr)) : gzZeitraumMarken(art, von, bis);
  let marken = alle;
  if (art !== "jahr") for (let n = 2; marken.length > 1 && !passt(marken); n++) marken = alle.filter((_, i) => i % n === 0);
  const kw = marken.map(kwText).join("");
  const grenze = (m, text) => !m ? "" : `${linie(m, "grenze", GZ_STRICH)}<text class="grenze-text" x="${breite}" y="${(y(m) - 4).toFixed(1)}" text-anchor="end">${esc(text)}</text>`;
  return `<svg class="gz-verlauf${breite !== GZ_BREITE ? " " + GZ_EINGEPASST : ""}" viewBox="0 0 ${breite} ${GZ_HOEHE}" data-gz="${esc(gzSchluessel(v))}" data-schrift="${Number(schrift)}" aria-hidden="true" focusable="false">${kw}${stunden}${linie(0, "null")}${grenze(plus, "Grenze " + gzSaldo(plus))}${grenze(minus, "Grenze " + zeitText(minus))}
    <polyline class="linie" points="${punkte.map(p => `${x(p.datum)},${y(p.m)}`).join(" ")}"/><circle class="heute" cx="${x(letzt.datum)}" cy="${y(letzt.m)}" r="${GZ_PUNKT_R}"/></svg>`;
}
// Schlüssel eines Verlaufs (Art und Zeitraum): gzVerlaufEinpassen passt nur das Bild an, das zur zuletzt geholten Antwort gehört.
const gzSchluessel = v => `${gzArt(v)}/${gzGrenzen(v).join("/")}`;
// Satz für den Screenreader statt des Bilds: Stand, höchster und niedrigster Stand mit Datum (Jahr: „Gleitzeit-Konto 2026“, Zeitraum: „vom … bis …“).
function gzSatz(v) {
  const punkte = gzPunkte(v), letzt = punkte.at(-1), [von, bis] = gzGrenzen(v);
  const hoch = punkte.reduce((a, p) => p.m > a.m ? p : a), tief = punkte.reduce((a, p) => p.m < a.m ? p : a);
  const name = gzArt(v) === "jahr" ? `Gleitzeit-Konto ${Number(v.jahr)}` : `Gleitzeit-Konto vom ${esc(gzDatum(von))} bis ${esc(gzDatum(bis))}`;
  return `${name}: Stand ${gzSaldo(letzt.m)}, höchster Stand ${gzSaldo(hoch.m)} am ${esc(gzDatum(hoch.datum))}, niedrigster Stand ${gzSaldo(tief.m)} am ${esc(gzDatum(tief.datum))}.`;
}
// Karte „Gleitzeit-Verlauf“ (funktionen.md 11, U11): Jahr aus GET /gleitzeit/verlauf/<J> mit Jahr im Titel, Zeitraum (v.art tag/woche/monat) mit Zeile
// „Letzte 10 Tage: … bis …“. Bild (gzBildSvg), darunter die Kappungen („gekappt am …“). Der Screenreader hört statt des Bilds gzSatz; darunter die Werte
// als Tabelle (Jahr je Woche, Zeitraum je Tag). Ohne Punkte: Leerzustand. breite: Breite der viewBox; die Seite passt sie nach dem Einfügen an (gzVerlaufEinpassen).
function gleitzeitVerlaufHtml(v, breite = GZ_BREITE) {
  const art = gzArt(v), jahr = Number(v.jahr), [von, bis] = gzGrenzen(v);
  const zeitraum = art === "jahr" ? "" : `<p class="hinweis">${GZ_ZEITRAUM_TEXT[art]}: ${esc(gzDatum(von))} bis ${esc(gzDatum(bis))}</p>`;
  const kopf = `<h2 id="gz-verlauf-titel">Gleitzeit-Verlauf${art === "jahr" ? ` ${jahr}` : ""}</h2>${zeitraum}`;
  if (!v.punkte?.length) return `<div class="card"${md("gleitzeit")}>${kopf}${leerHtml(art === "jahr" ? `Noch keine Werte in ${jahr}.` : "Noch keine Werte in diesem Zeitraum.", "p")}</div>`;
  const zeilen = gzPunkte(v).map(p => `<tr><td>${art === "jahr" ? gzWoche(p.datum) : esc(gzDatum(p.datum))}</td><td>${gzSaldo(p.m)}</td></tr>`).join("");
  const kappung = (v.kappungen || []).map(k => `<p class="hinweis kappung">${esc(k.text)}</p>`).join("");   // Sprung im Bild: Stand vor und nach der Kappung am selben Tag
  return `<div class="card"${md("gleitzeit")}>${kopf}${gzBildSvg(v, breite)}<p class="sr">${gzSatz(v)}</p>${kappung}
    <details class="auf"><summary>Werte als Tabelle</summary><table class="tbl gz-tabelle"><thead><tr><th>${art === "jahr" ? "Woche" : "Tag"}</th><th>Stand</th></tr></thead><tbody>${zeilen}</tbody></table></details></div>`;
}
// Bild der Kachel „Gleitzeit“ der Übersicht (Wunsch 25.11.2026: genau der Verlauf der Karte der Seite Woche, die letzten 3 Wochen): [SVG, Satz für den
// Screenreader]; ohne Punkte ["", ""]. Merkt sich die Antwort für gzVerlaufEinpassen (die Kachel passt ihr Bild wie die Karte an ihre Breite an).
function gzKachelBild(v) {
  if (!v?.punkte?.length) return ["", ""];
  gzZuletzt = v;
  return [gzBildSvg(v, GZ_BREITE), gzSatz(v)];
}
// Breite der viewBox für ein Bild von px Pixeln: so, dass eine Einheit höchstens GZ_SKALA px wird (wie die schmale Fassung, 360 Einheiten auf 480 px).
// Breite Karten bekommen so mehr Einheiten statt größerer Schrift; die KW-Marken rücken auseinander, nie zusammen. Nie unter min (Karte GZ_BREITE,
// Kachel GZ_KACHEL_BREITE mit GZ_KACHEL_SKALA).
const gzBildBreite = (px, min = GZ_BREITE, skala = GZ_SKALA) => Math.max(min, Math.round((Number(px) || 0) / skala));
// Klasse des eingepassten Bilds; Beobachter der Kartengröße und die zuletzt geholte Antwort (für das Einpassen nach dem Einfügen).
const GZ_EINGEPASST = "eingepasst";
let gzBeobachter = null, gzZuletzt = null;
// Echte Schriftgröße der Stundentexte im Bild (Einheiten der viewBox; folgt der Schriftgröße des Geräts), ohne Text GZ_SCHRIFT.
const gzSchrift = svg => parseFloat(getComputedStyle(svg.querySelector("text.stunde") ?? svg).fontSize) || GZ_SCHRIFT;
// Zeichnet das Bild in der Karte (bzw. im Verlauf .mv der Kachel) neu, wenn seine echte Breite (ohne die Grenze des Grundbilds gemessen) eine andere
// viewBox verlangt oder die Schrift des Geräts eine andere Größe hat (Rand links, Abstand der Datumstexte). Nur solange die Karte im Dokument hängt.
function gzEinpassen(karte, v) {
  const svg = karte.querySelector("svg.gz-verlauf");
  if (!svg || !karte.isConnected) return;
  svg.classList.add(GZ_EINGEPASST);
  const px = svg.getBoundingClientRect().width, breite = karte.classList?.contains("mv") ? gzBildBreite(px, GZ_KACHEL_BREITE, GZ_KACHEL_SKALA) : gzBildBreite(px);
  const schrift = gzSchrift(svg);
  if (breite !== svg.viewBox.baseVal.width || schrift !== Number(svg.dataset.schrift)) svg.outerHTML = gzBildSvg(v, breite, schrift);
}
// window.nachher der Seiten Tag, Woche, Monat, Jahr und der Übersicht (läuft, sobald die Seite im Dokument steht): Bild an die echte Breite anpassen, danach
// bei jeder Größenänderung der Karte (Fenster, Spalte daneben) erneut, im nächsten Bild, damit das Neuzeichnen nicht in den Beobachter zurückläuft. Gemessen
// wird erst im Dokument, weil die Breite vom Aufbau der Seite abhängt. Gehört das Bild zu einer anderen Antwort (Seite gewechselt), nichts.
function gzVerlaufEinpassen() {
  gzBeobachter?.disconnect();
  const v = gzZuletzt, svg = document.querySelector("svg.gz-verlauf"), karte = svg?.parentElement;
  if (!v?.punkte?.length || !karte || svg.dataset.gz !== gzSchluessel(v)) return;
  gzEinpassen(karte, v);
  gzBeobachter = new ResizeObserver(() => requestAnimationFrame(() => gzEinpassen(karte, v)));
  gzBeobachter.observe(karte);
}
// Holt den Gleitzeit-Verlauf: art „jahr“ das Jahr d (GET /gleitzeit/verlauf/<J>), sonst den Zeitraum gzZeitraum(art, d) bis höchstens heute; liegt er ganz
// nach heute, ohne Anfrage leer. Ohne Modul Gleitzeit oder bei einem Fehler keine Karte (die Seite zeigt sich trotzdem). Die Antwort bleibt für
// gzVerlaufEinpassen stehen. roh: die Antwort (Kachel „Gleitzeit“) statt der Karte, ohne Modul oder bei einem Fehler null.
async function gleitzeitVerlauf(art, d, roh = false) {
  gzZuletzt = null;
  if (!modulAn("gleitzeit")) return roh ? null : "";
  const [von, bis] = art === "jahr" ? [] : gzZeitraum(art, d, zeitHeuteIso());
  try {
    const v = art === "jahr" ? await api("GET", `/gleitzeit/verlauf/${d}`) : bis < von ? {von, bis, punkte: []} : await api("GET", `/gleitzeit/verlauf?von=${von}&bis=${bis}`);
    gzZuletzt = art === "jahr" ? v : {...v, art};
    return roh ? gzZuletzt : gleitzeitVerlaufHtml(gzZuletzt);
  } catch (e) { return roh ? null : ""; }
}
// Ziel der Kachel „Gleitzeit“ der Übersicht (Wunsch vom 23.11.2026): die Woche von heute, gleich bei der Karte „Gleitzeit-Verlauf“.
const WOCHE_GLEITZEIT = "woche/gleitzeit";
// Nach dem Zeichnen mit #/woche/gleitzeit: Verlauf oben ins Bild, Fokus auf seine Überschrift, danach die schlichte Adresse der Woche
// (Blättern und Neuzeichnen nach dem Speichern springen dann nicht wieder). Ohne Verlauf (Modul aus, Abruf gescheitert) bleibt die Woche oben.
function wocheGleitzeitZeigen(d) {
  history.replaceState(history.state, "", zeitAdresse("woche", d));
  ueberschriftZeigen($("#gz-verlauf-titel"));
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
// Klickbare Kachel mit Titel, Wert, Zusatz und Ziel (optional Klasse, Modul für das Ausblenden und Verlauf). Der Verlauf ist ein eigenes Kind hinter dem Zusatz,
// damit er in einer gestreckten Kachel an den unteren Rand rücken kann (start.css); sein Satz für den Screenreader gehört in sub.
function kachel(titel, wert, sub, ziel, klasse = "", modul = "", verlauf = "") {
  const id = "k" + (++kNr);
  return `<div class="card kachel klickbar ${klasse}"${modul && md(modul)}>${kachelKopf(titel, ziel, id)}<b id="${id}-w">${wert}</b><small id="${id}-z">${sub}</small>${verlauf}</div>`;
}
// ---- bausteine/quote_ampel.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Quote-Ampel (A6): wie viel Büro-Zeit im laufenden Monat noch nötig ist, damit die HO-Quote am Monatsende die Grenze einhält.
// Rechnen tut nur der Dienst (GET /api/quote/ampel, bericht.quote_ampel); hier stehen Anzeige und Takt. Nur im Modus „mit Grenze“ und nur
// für den laufenden Monat. Die Stufe zeigt ein Zeichen und ein Wort, nie nur die Farbe.
const QUOTE_AMPEL_PFAD = "/quote/ampel";
const QUOTE_AMPEL_TAKT = 60000;                  // bei laufender Uhr je Minute neu fragen: der Dienst kennt die Uhr und rechnet sie mit
const QUOTE_AMPEL_TITEL = "Quote-Ampel";
const QUOTE_AMPEL_ZIEL = "monat";
const QA_SVG = inhalt => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${inhalt}</svg>`;
// Je Stufe Zeichen (Haken im Kreis, Dreieck mit „!“, Achteck mit „×“) und Wort
const QUOTE_AMPEL_STUFEN = {
  gruen: {zeichen: QA_SVG('<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>'), wort: "Im Rahmen"},
  gelb: {zeichen: QA_SVG('<path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/>'), wort: "Büro-Zeit nötig"},
  rot: {zeichen: QA_SVG('<path d="M8.3 3h7.4L21 8.3v7.4L15.7 21H8.3L3 15.7V8.3z"/><path d="m9 9 6 6M15 9l-6 6"/>'), wort: "Nicht zu halten"},
};

// Antwort des Dienstes für den Monat jahr/monat oder null: nur im Modus „mit Grenze“, nur im laufenden Monat; ein Fehler lässt die Ampel weg.
async function quoteAmpelLaden(jahr, monat) {
  if (!mitGrenze() || jahr !== heute.getFullYear() || monat !== heute.getMonth() + 1) return null;
  const a = await api("GET", QUOTE_AMPEL_PFAD).catch(() => null);
  return a && QUOTE_AMPEL_STUFEN[a.stufe] ? a : null;
}
// Satz unter dem Wort: was bis Monatsende im Büro nötig ist (Dauern und Grenze vom Dienst, darum esc).
function quoteAmpelSatz(a) {
  const noetig = esc(a.noetig), grenze = esc(a.grenze);
  if (a.stufe === "rot") return a.geplant_min ? `Auch mit Büro an allen restlichen Tagen über ${grenze} % HO` : `Über ${grenze} % HO, keine Arbeitstage mehr in diesem Monat`;
  return a.stufe === "gelb" ? `Bis Monatsende noch ${noetig} Std. im Büro nötig` : "Keine Büro-Zeit mehr nötig";
}
// Zeichen und Wort der Stufe.
const quoteAmpelWert = a => `${QUOTE_AMPEL_STUFEN[a.stufe].zeichen}<span>${QUOTE_AMPEL_STUFEN[a.stufe].wort}</span>`;
// Ampel als Zeile (Seite Monat); leer ohne Antwort.
function quoteAmpelHtml(a) {
  return a ? `<div class="quote-ampel ampel-${a.stufe}"><b class="qa-wert">${quoteAmpelWert(a)}</b><small class="qa-satz">${quoteAmpelSatz(a)}</small></div>` : "";
}
// Ampel als Kachel der Übersicht (in „Kacheln anpassen“ wählbar, Ziel Seite Monat); leer ohne Antwort.
function quoteKachel(a) {
  return a ? kachel(QUOTE_AMPEL_TITEL, `<span class="qa-wert">${quoteAmpelWert(a)}</span>`, `<span class="qa-satz">${quoteAmpelSatz(a)}</span>`, QUOTE_AMPEL_ZIEL, `quote-ampel ampel-${a.stufe}`) : "";
}
// Takt bei laufender Uhr (seit heute; gestartet in anlauf.js): neuen Stand holen und Stufe, Wort und Satz jeder sichtbaren Ampel ersetzen, nur wenn sich etwas ändert.
// Kein aria-live: Screenreader und Fokus bleiben in Ruhe (wie die anderen Live-Werte der Übersicht).
async function quoteAmpelLaufend() {
  const ampeln = document.querySelectorAll(".quote-ampel");
  if (!ampeln.length || !stempelHeute()) return;
  const a = await api("GET", QUOTE_AMPEL_PFAD).catch(() => null);
  if (!a || !QUOTE_AMPEL_STUFEN[a.stufe]) return;
  const wert = quoteAmpelWert(a), satz = quoteAmpelSatz(a);
  ampeln.forEach(e => {
    if (e.zuletzt === wert + satz) return;
    e.classList.remove(...Object.keys(QUOTE_AMPEL_STUFEN).map(s => "ampel-" + s));
    e.classList.add("ampel-" + a.stufe);
    e.querySelector(".qa-wert").innerHTML = wert;
    e.querySelector(".qa-satz").innerHTML = satz;
    e.zuletzt = wert + satz;
  });
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
// Rückgängig-Leiste (#rueck, funktionen.md 1): nach Speichern, Leeren, Planen, Kommen und Gehen eine Stufe zurück, per Knopf oder Strg+Z / ⌘+Z.
// Sie bleibt 15 s; solange Maus oder Fokus darin sind, wartet sie (WCAG 2.2.1) und läuft danach 5 s weiter, nach 55 s schließt sie immer
// (der Dienst nimmt Rückgängig bis 60 s an). Beim Schließen erfährt der Dienst das Ende, damit die Synchronisierung nicht wartet.
// Ein offenes Blatt verdeckt sie (grundlage.css), ihre Uhr wartet dann bis höchstens 55 s; nach dem Schließen des Blatts steht sie noch 15 s, damit man sie sicher sieht.
const RUECK_MS = 15000, RUECK_NACH_MS = 5000, RUECK_NACH_BLATT_MS = 15000, RUECK_HOECHSTENS_MS = 55000;
const RUECK_LUFT = 8;                                                     // px zwischen einem frei gerollten Tag und der Leiste
const RUECK_ANSAGE = "Rückgängig mit Strg+Z möglich.", RUECK_ABGELAUFEN = "Rückgängig ist abgelaufen.", RUECK_GEMACHT = "Rückgängig gemacht.";
let rueckId = null, rueckUhr = null, rueckEnde = 0, rueckBeobachter = null;

// Zeigt die Leiste für die Antwort einer Aktion ({rueckgaengig: {id, text}}); text ersetzt den Text des Dienstes (etwa „Tag geleert.“).
// Rückgabe false, wenn die Aktion nichts geändert hat (rueckgaengig fehlt oder ist null): dann zeigt der Aufrufer seine Meldung selbst.
function rueckgaengigZeigen(antwort, text) {
  if (!antwort?.rueckgaengig) return false;
  rueckSchliessen(false);
  const leiste = $("#rueck"), t = document.createElement("span"), sr = document.createElement("span"), knopf = document.createElement("button");
  t.textContent = festText(text || antwort.rueckgaengig.text);                 // „08:00 bis 10:30 Uhr“, „02:00 Std.“ je eine Zeile
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
// Steht ein Blatt offen, wartet sie bis zu den 55 s (dann läuft sie ab, auch verdeckt); rueckNachBlatt() stellt sie beim Schließen des Blatts neu.
function rueckWarten(ms) {
  clearTimeout(rueckUhr);
  rueckUhr = setTimeout(() => {
    if (Date.now() >= rueckEnde) { rueckSchliessen(true); toast(RUECK_ABGELAUFEN); return; }
    if (blattOffen()) { rueckWarten(rueckEnde - Date.now()); return; }
    if ($("#rueck").matches(":hover, :focus-within")) rueckWarten(Math.min(RUECK_NACH_MS, rueckEnde - Date.now()));
    else rueckSchliessen(true);
  }, ms);
}
// Ruft blattZu() nach dem Schließen eines Blatts: Die Leiste war verdeckt und steht jetzt noch 15 s (höchstens bis 55 s ab der Aktion).
function rueckNachBlatt() { if (rueckId) rueckWarten(Math.min(RUECK_NACH_BLATT_MS, rueckEnde - Date.now())); }
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
// Knopf „Rückgängig“ und Strg+Z: stellt die Tage (und die Stempeluhr) der letzten Aktion zurück, zeichnet neu und setzt den Fokus auf den Tag (am Rechner auch die Spalte).
// Fehler (inzwischen geändert, abgelaufen) als Meldung; die Leiste schließt in jedem Fall.
async function rueckgaengig() {
  const id = rueckId;
  if (!id) return;
  rueckSchliessen(false);
  try { await api("POST", "/rueckgaengig", {id}); }
  catch (e) { toastFehler(e.message); return; }
  toast(RUECK_GEMACHT);
  if (seitenName() !== "start") await stempelLaden();                          // die Übersicht holt die Uhr in zeigen() selbst
  await zeigen();
  const s = $("#tag-daneben");
  if (zeitDaneben() && !s.hidden) await tagBearbeiten(s.dataset.d);              // die Spalte zeigt den zurückgestellten Stand
  [...document.querySelectorAll(`#inhalt [data-d="${zeitDatum}"]`)].find(e => e.offsetParent)?.focus({preventScroll: true});
}
// Strg+Z / ⌘+Z bei offener Leiste (nicht beim Tippen in ein Feld, das prüft der Aufrufer vorher). Rückgabe true, wenn die Taste verbraucht ist.
// Nicht bei offenem Blatt: Dort ist die Leiste verdeckt, nichts soll unsichtbar zurückgestellt werden.
function rueckTaste(e) {
  if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== "z" || $("#rueck").hidden || blattOffen()) return false;
  e.preventDefault(); rueckgaengig();
  return true;
}
// ---- bausteine/tagblatt.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Karte „Art des Tages“ im Tag-Blatt (Entscheidung 26.11.2026): Knöpfe Art, Text, Punkt der Farbe. Ein Tipp belegt das Formular vor, gespeichert wird nur mit „Speichern“.
// Urlaub, Gleittag und alle übrigen Arten stehen im Auswahlfeld hinter „Mehr“ (meist geplant und schon eingetragen).
const SCHNELLWAHL = [["ho", "Homeoffice", "ho"], ["dst", "Büro", "ds"], ["krank", "Krank", "a-krank"]];
const SCHNELL_ORT = ["ho", "dst"], SCHNELL_KRANK = ["krank", "krank_attest"];
const ART_MIT_ZEIT = ["", "krank_dienst"];   // Arten mit gearbeiteter Zeit; alle übrigen sind ganze Tage
const KD_SATZ = "Die fehlende Zeit bis zur Sollzeit des Tages füllt die App auf. Für die Quote zählt nur die gearbeitete Zeit.";
const ZEHN_STUNDEN_MIN = 600;          // vor KAPPZEIT_AB gilt die feste Grenze von 10 Stunden (wie regeln.MAX_TAG_MIN)
// Meldungen des Dienstes zu PUT /tag (routen_zeiten.py), die ein Feld eindeutig nennen: Textanfang und Feld (für formFehler)
const TAG_FEHLER_FELD = [["Block", "#e-liste input"], ["Die Blöcke", "#e-liste input"], ["Kommen und Gehen", "#e-kommen"],["Mehr Homeoffice", "#e-ho"], ["Mehr als 10 Stunden", "#e-frei"], ["Konto", "#e-konto"]];
// Gibt es den Knopf im Profil? Homeoffice und Büro nur, wenn der Ort erfasst wird (nicht bei „nur Büro“ bzw. „nur Homeoffice“), Krank nur mit seinem Modul.
const schnellwahlAn = a => SCHNELL_ORT.includes(a) ? !einOrt() || einOrt() === a : artAn(a);
// Knöpfe der Karte „Art des Tages“ (nur, was Profil und Module kennen, Zustand über aria-pressed) und „Mehr“, das das Auswahlfeld #e-mehr auf- und zuklappt (offen: Feld sichtbar).
function schnellwahlHtml(offen) {
  const knoepfe = SCHNELLWAHL.filter(([a]) => schnellwahlAn(a)).map(([a, t, p]) => `<button type="button" data-schnell="${a}" aria-pressed="false"><i class="p ${p}" aria-hidden="true"></i>${t}</button>`);
  return `<div class="schnellwahl" role="group" aria-label="Art wählen">${knoepfe.join("")}<button type="button" class="leise" data-schnell="mehr" aria-expanded="${!!offen}" aria-controls="e-mehr">Mehr</button></div>`;
}
// Steht das Auswahlfeld beim Öffnen offen? Nur, wenn der Tag schon eine Art hat, die kein Knopf zeigt (etwa geplanter Urlaub).
const mehrOffen = art => !!art && !SCHNELL_KRANK.includes(art);
// Welcher Knopf ist gewählt? art: Wert des Auswahlfelds, ort: zuletzt gewählter Ort ("ho", "dst" oder ""). Krank auch mit Attest; ein Ort nur ohne Art.
const schnellGewaehlt = (art, ort) => SCHNELL_KRANK.includes(art) ? "krank" : art ? "" : ort;
// Vorbelegung nach einem Tipp auf einen Knopf (nichts wird gespeichert). f: Felder jetzt {ho, dst, uhr} (uhr: Kommen–Gehen oder Blöcke stehen da),
// soll: Tagessoll in Minuten (aus soll_zeit, Teilzeit und Abschnitte eingerechnet, auch an einem Urlaubstag), attest: Datum des Attests oder "".
// Homeoffice/Büro: ohne Art; leere Stunden bekommen das Tagessoll, Stunden nur an einem Ort wechseln zum gewählten, ein gemischter Tag und Uhrzeiten bleiben.
// Krank: ganzer Tag ohne Stunden und Uhrzeiten (uhrLeeren), mit Attest „Krank mit Attest“. Rückgabe {ho, dst, art[, uhrLeeren]}.
function schnellVorbelegung(art, f, soll, attest) {
  if (!SCHNELL_ORT.includes(art)) return {ho: "", dst: "", art: art === "krank" && attest ? "krank_attest" : art, uhrLeeren: true};
  const anderer = art === "ho" ? "dst" : "ho";
  if (f.uhr || (f.ho && f.dst)) return {ho: f.ho, dst: f.dst, art: ""};
  return {[art]: f.ho || f.dst || (soll > 0 ? hhmm(soll) : ""), [anderer]: "", art: ""};
}
// Braucht der Tag den Haken „Über 10 Stunden freigegeben“? summe: Stunden HO und Büro in Minuten, gesetzt: Haken schon an. Ab KAPPZEIT_AB gilt die
// Tagesgrenze der Regeln (abgeschaltet: nie), davor 10 Stunden. An der Grenze schon: Kommen–Gehen kappt ohne Freigabe genau auf sie.
function freigabeNoetig(datum, summe, gesetzt) {
  const grenze = freigabeGrenze(datum);
  return !!gesetzt || (!!grenze && summe >= grenze);
}
// Tagesgrenze in Minuten, die der Haken freigibt: vor KAPPZEIT_AB fest 10 Stunden, danach die Regel (0 = abgeschaltet).
function freigabeGrenze(datum) { return datum < KAPPZEIT_AB ? ZEHN_STUNDEN_MIN : kappRegeln(datum)[1]; }
// Beschriftung des Hakens nach der Grenze des Tages, z. B. „Über 10 Stunden freigegeben“ oder „Über 9:30 Stunden freigegeben“; abgeschaltet wie ab Werk.
function freigabeText(datum) {
  const g = freigabeGrenze(datum) || ZEHN_STUNDEN_MIN, h = Math.floor(g / 60), m = g % 60;
  return `Über ${m ? `${h}:${String(m).padStart(2, "0")}` : h} Stunden freigegeben`;
}
// Blöcke im Bearbeiten-Formular (Wunsch vom 24.11.2026): je Block Ort, Kommen, Gehen und Pause von Hand (leer = 0, die Pflichtpause rechnet die App). Gespeichert als „eintraege“ von PUT /tag,
// der Dienst rechnet und prüft (stempel.bloecke); die Vorschau rechnet genauso, damit Fehler schon beim Tippen erscheinen.
const BLOCK_ORTE = [["ho", "Homeoffice"], ["dst", "Büro"]];
const BLOCK_ZEIT_FEHLER = "Bei jedem Block muss „Gehen“ nach „Kommen“ liegen";
const BLOCK_NACHT_BEISPIEL = " (nach Mitternacht: z. B. 26:00).";
const BLOCK_ENDE_AM_TAG = ", spätestens um 23:59. Über Mitternacht unter Einstellungen › Arbeitszeit erlauben.";
const BLOCK_TAG_MIN = 1440;   // Minuten eines Tages: ab hier liegt „Gehen“ nach Mitternacht
const BLOCK_PAUSE_FEHLER = "Die Pause von Hand ist länger als ein Block.";
const BLOCK_DAUER_FEHLER = "Stunden ohne Uhrzeit: 00:01 bis 23:59 (hh:mm).";
// Rechnet Blöcke [{art, kommen, gehen, pause}] am Tag datum (ISO) wie stempel.bloecke mit der Tagesrechnung (tagRechnen; freigabe: über der Tagesgrenze
// freigegeben). Gehen nach Mitternacht nur mit der Regel „Stempeluhr über Mitternacht erlauben“ (wie der Dienst). Stunden ohne Uhrzeit ({art, dauer})
// zählen dazu, ohne Pausenregel. Rückgabe {hoMin, dstMin, pause, kapp} (Pause ohne Lücken, Kappzeit in Minuten) oder {fehler}.
function bloeckeRechnen(liste, datum = "", freigabe = false) {
  const ohne = liste.filter(x => "dauer" in x);
  if (ohne.some(x => !(minuten(x.dauer) > 0 && minuten(x.dauer) < BLOCK_TAG_MIN))) return {fehler: BLOCK_DAUER_FEHLER};
  const b = liste.filter(x => !("dauer" in x)).map(x => ({...x, k: minuten(x.kommen), g: minuten(x.gehen), p: x.pause ? minuten(x.pause) : 0})).sort((a, c) => a.k - c.k);
  const nachts = !!KONFIG.stempel_mitternacht, grenze = nachts ? Infinity : BLOCK_TAG_MIN;
  if (b.some(x => !x.kommen || !x.gehen || x.k >= BLOCK_TAG_MIN || x.g <= x.k || x.g >= grenze)) return {fehler: BLOCK_ZEIT_FEHLER + (nachts ? BLOCK_NACHT_BEISPIEL : BLOCK_ENDE_AM_TAG)};
  const ueber = b.findIndex((x, i) => i && x.k < b[i - 1].g);
  if (ueber > 0) { const [a, c] = [b[ueber - 1], b[ueber]]; return {fehler: `Die Blöcke ${a.kommen}–${a.gehen} und ${c.kommen}–${c.gehen} überschneiden sich.`}; }
  if (b.some(x => x.p > x.g - x.k)) return {fehler: BLOCK_PAUSE_FEHLER};
  const ohneMin = art => ohne.reduce((s, x) => s + (!art || x.art === art ? minuten(x.dauer) : 0), 0);
  const {kapp, pause} = tagRechnen(b, ohneMin(), datum, freigabe), ort = art => b.reduce((s, x) => s + (x.art === art ? x.m : 0), 0) + ohneMin(art);
  return {hoMin: ort("ho"), dstMin: ort("dst"), pause, kapp};
}
// „Beides“ im Formular (h, d: Homeoffice und Büro [von, bis] in Minuten, eigen: Pause von Hand in Minuten oder null) am Tag datum, wie der Dienst es
// speichert (routen_zeiten._kommen_gehen): eine Spanne Kommen–Gehen mit der Tagesrechnung (tagRechnen; ohne eigene Pause zählt die Lücke an), dazu der
// HO-Anteil, Büro = Rest. Den HO-Anteil verteilt die Tagesrechnung über beide Blöcke (Kappzeit beim eigenen Block, Abzüge vom letzten rückwärts).
// Rückgabe {kommen, gehen (hh:mm), pause, hoMin, dstMin, kapp} oder {fehler}.
function beidesRechnen(h, d, eigen, datum = "", freigabe = false) {
  if (h[1] <= h[0] || d[1] <= d[0]) return {fehler: "Bei jedem Block muss „bis“ nach „von“ liegen."};
  const [erst, dann] = h[0] <= d[0] ? [h, d] : [d, h];
  if (dann[0] < erst[1]) return {fehler: "Homeoffice und Büro überschneiden sich."};
  const luecke = dann[0] - erst[1], hand = eigen ?? luecke;
  if (hand < luecke) return {fehler: `Die Pause muss mindestens die Zeit zwischen den Blöcken sein (${zeitText(luecke)}).`};
  if (hand - luecke >= dann[1] - dann[0]) return {fehler: "Die Pause ist länger als ein Block."};
  const spanne = {k: erst[0], g: dann[1], p: hand}, {kapp, pause} = tagRechnen([spanne], 0, datum, freigabe);
  const zwei = [{k: erst[0], g: erst[1], p: 0}, {k: dann[0], g: dann[1], p: hand - luecke}];
  tagRechnen(zwei, 0, datum, freigabe);
  const hoMin = Math.min(zwei[dann === h ? 1 : 0].m, spanne.m);
  return {kommen: hhmm(spanne.k), gehen: hhmm(spanne.g), pause, hoMin, dstMin: spanne.m - hoMin, kapp};
}
// Blöcke zum Öffnen des Formulars aus den Einträgen des Tages (GET /woche, /monat). Mit kommt nur die Pause von Hand (hand), denn die Pflichtpause
// rechnet die App bei jedem Speichern über den ganzen Tag neu. Ein Eintrag ohne Uhrzeit wird {art, dauer} (Dauer hh:mm, auch wenn die Seite sie dezimal zeigt).
function bloeckeAusTag(z) {
  return (z.eintraege || []).map(e => e.kommen ? {art: e.art, kommen: e.kommen, gehen: e.gehen, pause: e.hand || ""} : {art: e.art, dauer: hhmm(dauerMinuten(e.dauer))});
}
// Eine Zeile der Blockliste (i ab 0, vor: Anfang der Feld-Kennungen, damit Formular und Blatt eines Eintrags nebeneinander eindeutig bleiben): Kopf mit Ort
// (nur mit zwei Orten im Profil) und „Löschen“, darunter Kommen, Gehen, Pause oder bei Stunden ohne Uhrzeit nur die Stunden; Werte maskiert.
function blockZeileHtml(b, i, vor = "e") {
  const id = `${vor}-b${i}`;
  const ort = einOrt() ? "" : `<div><label for="${id}-art">Ort</label><select id="${id}-art" data-feld="art">${BLOCK_ORTE.map(([k, t]) => `<option value="${k}"${k === b.art ? " selected" : ""}>${t}</option>`).join("")}</select></div>`;
  const feld = (f, name, platz) => `<div><label for="${id}-${f}">${name}</label><input id="${id}-${f}" data-feld="${f}" inputmode="numeric" placeholder="${platz}" value="${esc(b[f] || "")}"></div>`;
  const felder = "dauer" in b ? feld("dauer", "Stunden ohne Uhrzeit", "02:00") : feld("kommen", "Kommen", "07:30") + feld("gehen", "Gehen", "12:00") + feld("pause", "Pause", "Regel");
  return `<div class="e-block" role="group" aria-label="Block ${i + 1}"><div class="e-kopf">${ort}<button type="button" class="leise" data-weg="${i}" aria-label="Block ${i + 1} löschen">Löschen</button></div>
    <div class="reihe">${felder}</div></div>`;
}
// Werte einer Zeile der Blockliste (Formular und Blatt eines Eintrags), Zeiten normalisiert; eine Zeile ohne Uhrzeit liefert {art, dauer}.
function blockLesen(r) {
  const f = n => r.querySelector(`[data-feld="${n}"]`), art = f("art")?.value || einOrt() || "ho";
  if (f("dauer")) return {art, dauer: zeitNorm(f("dauer").value)};
  return {art, kommen: zeitNorm(f("kommen").value), gehen: zeitNorm(f("gehen").value), pause: f("pause").value.trim() ? pauseNorm(f("pause").value) : ""};
}
// Blatt zum Eintragen und Ändern eines Tages (Entscheidung 26.11.2026) mit zwei Karten: „Art des Tages“ (Knöpfe Homeoffice, Büro, Krank und „Mehr“ mit dem
// Auswahlfeld aller Arten, dazu Attest, Konto und Hinweis je Art) und „Zeiten“ (Tageserfassung mit den Stunden, Einzelerfassung mit Kommen–Gehen–Pause und Blöcken,
// Freigabe über der Tagesgrenze nur bei Bedarf, Anmerkung). Ein Knopf belegt nur vor; gespeichert wird mit PUT /tag erst über „Speichern“, danach steht die
// Rückgängig-Leiste da. Fehler erscheinen im Blatt, die Eingaben bleiben. Am Rechner steht das Formular im Bereich Zeit rechts daneben (#tag-daneben) statt im
// Blatt: Speichern schließt dann nichts, „Abbrechen“ setzt auf den gespeicherten Stand zurück, die erste Änderung merkt die Spalte als geändert.
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
  z = z || {datum, tag: +datum.slice(8), wt: "", ho: "", dst: "", art: "", notiz: "", konto: 0, feiertag: "", soll_zeit: ""};
  const optArt = Object.entries(ARTEN).filter(([k]) => (artAn(k) || z.art === k) && (k !== "familientag" || z.art === "familientag" || window.famAktiv) && (k !== "freizeit" || z.art === "freizeit" || !z.frei)).map(([k, v]) => `<option value="${k}" ${z.art === k ? "selected" : ""}>${v}</option>`).join("");
  const mehr = mehrOffen(z.art);
  zeigenIn(`<h3>${z.wt} ${z.tag}.${datum.slice(5, 7)}.${datum.slice(0, 4)}</h3>${z.feiertag ? `<div class="hinweis">${esc(z.feiertag)}</div>` : ""}${z.frei ? `<p class="hinweis">Arbeitszeit an diesem freien Tag kommt aufs <b>Freizeitkonto</b>, nicht in die Gleitzeit.</p>` : ""}
    <section class="tb-karte" aria-labelledby="e-art-titel"><h4 id="e-art-titel">Art des Tages</h4>
    ${schnellwahlHtml(mehr)}
    <div id="e-mehr"${mehr ? "" : " hidden"}><label for="e-art">Weitere Arten</label><select id="e-art">${optArt}</select></div>
    <div id="kd-hinweis" hidden><p class="hinweis">${KD_SATZ}</p>${z.aufgefuellt_min > 0 ? `<p class="hinweis">Aufgefüllt: ${esc(z.aufgefuellt)} Std.</p>` : ""}</div>
    <div id="attest-zeile" data-stil="display:none"><label for="e-attest">Attest abgegeben am <small>(gilt für alle zusammenhängenden Kranktage; Datum löschen entfernt es für die ganze Folge)</small></label><input id="e-attest" type="date" value="${esc(z.attest || "")}"></div>
    <div id="konto-zeile" data-stil="display:none"><label for="e-konto">Konto (angesparter Urlaub)</label><select id="e-konto"></select></div></section>
    <section class="tb-karte" aria-labelledby="e-zeiten-titel"><h4 id="e-zeiten-titel">Zeiten</h4>
    <details class="auf e-tages" open><summary>Tageserfassung</summary>
    <div class="reihe"><div${ortVersteckt("ho", z.ho)}><label for="e-ho">Stunden HO</label><input id="e-ho" inputmode="numeric" placeholder="hh:mm" value="${z.ho}"></div>
    <div${ortVersteckt("dst", z.dst)}><label for="e-dst">Stunden Büro</label><input id="e-dst" inputmode="numeric" placeholder="hh:mm" value="${z.dst}"></div></div></details>
    <details class="auf" id="e-einzel" ${z.kommen || z.eintraege?.length ? "open" : ""}><summary>Einzelerfassung</summary>
      <div id="e-klassisch">${einOrt() ? festerOrt("e-ort") : `<label id="e-ort-titel">Wo?</label>${segHtml([["ho", "Homeoffice"], ["dst", "Büro"], ["beides", "Beides"]], z.ho && z.dst ? "beides" : z.dst ? "dst" : "ho", {id: "e-ort", beschriftet: "e-ort-titel"})}`}
      <div id="e-bloecke" data-stil="display:none"><div class="reihe"><div><label for="e-hv">Homeoffice von</label><input id="e-hv" inputmode="numeric" placeholder="07:30"></div><div><label for="e-hb">Homeoffice bis</label><input id="e-hb" inputmode="numeric" placeholder="11:00"></div></div>
      <div class="reihe"><div><label for="e-dv">Büro von</label><input id="e-dv" inputmode="numeric" placeholder="12:00"></div><div><label for="e-db">Büro bis</label><input id="e-db" inputmode="numeric" placeholder="16:00"></div></div></div>
      <div class="reihe"><div class="e-kg-feld"><label for="e-kommen">Kommen</label><input id="e-kommen" inputmode="numeric" placeholder="07:30" value="${z.kommen || ""}"></div><div class="e-kg-feld"><label for="e-gehen">Gehen</label><input id="e-gehen" inputmode="numeric" placeholder="16:00" value="${z.gehen || ""}"></div>
      <div><label for="e-pause">Pause</label><input id="e-pause" inputmode="numeric" placeholder="hh:mm" value="${z.kommen ? z.pause : ""}" data-eigen="${z.kommen && minuten(z.pause) !== pauseAuto(minuten(z.gehen) - minuten(z.kommen)) ? 1 : ""}"></div></div></div>
      <div id="e-liste"></div><button type="button" class="leise" id="e-plus">+ Block</button>
      <div id="e-kg" class="hinweis">Die Pause wird nach der Pausenregel vorbelegt (${pausenText()}, unter ${esc(weg("einstellungen", "arbeitszeit"))} einstellbar) und lässt sich ändern.</div></details>
    <div id="frei-zeile"${freigabeNoetig(datum, z.ist_min || 0, z.freigabe) ? "" : " hidden"}><div class="zeile"><span>${freigabeText(datum)}<br><small>sonst verfällt Arbeitszeit über der Tagesgrenze als Kappzeit</small></span><input type="checkbox" id="e-frei" ${z.freigabe ? "checked" : ""} aria-label="${freigabeText(datum)}"></div></div>
    <label for="e-notiz">Anmerkung</label><input id="e-notiz" value="${esc(z.notiz)}"></section>
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
  // Zeigt je nach Art die Zeile für das Konto (angesparter Urlaub) oder das Attest; die Konten werden erst bei Bedarf geladen.
  async function kontoZeigen() {
    const an = $("#e-art").value === "angespart";
    $("#konto-zeile").style.display = an ? "" : "none";
    $("#attest-zeile").style.display = ["krank", "krank_attest"].includes($("#e-art").value) ? "" : "none";
    $("#kd-hinweis").hidden = $("#e-art").value !== "krank_dienst";
    if (!an || $("#e-konto").dataset.geladen) return;
    const u = await api("GET", `/urlaub/${datum.slice(0, 4)}`);
    $("#e-konto").dataset.geladen = 1;
    $("#e-konto").innerHTML = `<option value="0">ältestes zuerst</option>` + u.konten.filter(k => k.nutzbar && (k.rest >= 1 || k.herkunft === z.konto))
      .map(k => `<option value="${k.herkunft}" ${k.herkunft === z.konto ? "selected" : ""}>aus ${k.herkunft}: ${komma(k.rest)} frei</option>`).join("");
  }
  // Zuletzt gewählter Ort (Knopf Homeoffice oder Büro), zu Beginn der Ort eines Tages nur mit Homeoffice oder nur mit Büro; markiert mit der Art den Knopf.
  let ortWahl = z.art ? "" : z.ho && !z.dst ? "ho" : z.dst && !z.ho ? "dst" : "";
  const knopfWahlZeigen = () => { const g = schnellGewaehlt($("#e-art").value, ortWahl); w.querySelectorAll("[data-schnell]:not([data-schnell=mehr])").forEach(b => b.setAttribute("aria-pressed", b.dataset.schnell === g)); };
  // Eine ganztägige Art im Auswahlfeld leert Stunden und Uhrzeiten wie Krank: sonst blieben Stunden eines vorigen Tipps auf Homeoffice oder Büro stehen.
  $("#e-art").onchange = () => {
    if (!ART_MIT_ZEIT.includes($("#e-art").value)) { uhrLeeren(); $("#e-ho").value = ""; $("#e-dst").value = ""; kg(); }
    kontoZeigen(); knopfWahlZeigen();
  };
  kontoZeigen(); knopfWahlZeigen();
  $("#e-zu").onclick = () => ziel ? tagBearbeiten(datum) : blattZu();
  artBinden("e-ort");
  // Mit Kommen und Gehen rechnet die App die Arbeitszeit (Gehen − Kommen − Pause) und trägt sie bei HO bzw. Büro ein; bei „Beides“ ist „Stunden HO“ der HO-Anteil.
  // „Beides“: Homeoffice und Büro mit eigenen Zeiten. Kommen = früherer Beginn, Gehen = späteres Ende, die Lücke dazwischen ist Pause.
  // Verlangt die Pausenregel mehr als die Lücke, geht der Rest vom späteren Block ab. Gespeichert werden Kommen, Gehen, Pause und der HO-Anteil.
  const bloecke = () => {
    const w = id => zeitNorm($(id).value), hv = w("#e-hv"), hb = w("#e-hb"), dv = w("#e-dv"), db = w("#e-db");
    if (!(hv && hb && dv && db)) return null;
    const eigen = !!$("#e-pause").dataset.eigen;
    return {...beidesRechnen([minuten(hv), minuten(hb)], [minuten(dv), minuten(db)], eigen ? minuten(pauseNorm($("#e-pause").value)) : null, datum, $("#e-frei").checked), eigen};
  };
  // Blendet den Haken der Freigabe (freigabeText) ein, sobald die Stunden HO und Büro die Grenze erreichen (freigabeNoetig). Einmal sichtbar bleibt er,
  // damit er beim Abwählen nicht unter dem Finger verschwindet.
  const freiPruefen = () => { if (freigabeNoetig(datum, minuten(zeitNorm($("#e-ho").value)) + minuten(zeitNorm($("#e-dst").value)), $("#e-frei").checked)) $("#frei-zeile").hidden = false; };
  // Rechnet neu (kgRechnen) und führt danach den Haken der Freigabe nach.
  const kg = () => { kgRechnen(); freiPruefen(); };
  // Rechnet aus Kommen, Gehen und Pause (bei „Beides“ aus den beiden Blöcken) die Arbeitszeit und füllt Felder und Hinweis.
  const kgRechnen = () => {
    $("#e-klassisch").hidden = blockModus;
    $("#e-ho").readOnly = $("#e-dst").readOnly = blockModus;          // mit Blockliste rechnet die App die Stunden
    if (blockModus) { blockHinweis(); return; }
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
      $("#e-kg").textContent = `Arbeitszeit ${zeitText(b.hoMin + b.dstMin)} Std. (HO ${zeitText(b.hoMin)}, Büro ${zeitText(b.dstMin)}), ${b.kommen}–${b.gehen}, Pause ${zeitText(b.pause)} ${b.eigen ? "(selbst eingetragen)" : "(Lücke und Pausenregel)"}${b.kapp ? `, Kappzeit ${zeitText(b.kapp)} Std.` : ""}`;
      return;
    }
    const k = $("#e-kommen").value, g = $("#e-gehen").value;
    if (!k || !g) return;
    const block = {k: minuten(zeitNorm(k)), g: minuten(zeitNorm(g)), p: $("#e-pause").dataset.eigen ? minuten(pauseNorm($("#e-pause").value)) : 0};
    const spanne = block.g - block.k, eigen = !!$("#e-pause").dataset.eigen, ort = artWert("e-ort");
    const {kapp, pause} = spanne > 0 && block.p < spanne ? tagRechnen([block], 0, datum, $("#e-frei").checked) : {kapp: 0, pause: block.p}, arbeit = spanne > 0 ? block.m : 0;
    if (!eigen && spanne > 0) $("#e-pause").value = hhmm(pause);
    if (spanne <= 0 || block.p >= spanne) { $("#e-kg").innerHTML = meldung("„Gehen“ muss nach „Kommen“ liegen, und die Pause muss kürzer sein als die Zeit dazwischen (nach Mitternacht: z. B. 26:00)."); return; }
    if (ort === "ho") { $("#e-ho").value = hhmm(arbeit); $("#e-dst").value = ""; }
    else if (ort === "dst") { $("#e-dst").value = hhmm(arbeit); $("#e-ho").value = ""; }
    else $("#e-dst").value = hhmm(Math.max(0, arbeit - minuten(zeitNorm($("#e-ho").value))));
    $("#e-kg").textContent = `Arbeitszeit ${zeitText(arbeit)} Std., Pause ${zeitText(pause)} ${eigen ? "(selbst eingetragen, mindestens nach Pausenregel)" : "(nach Pausenregel)"}${kapp ? `, Kappzeit ${zeitText(kapp)} Std.` : ""}${ort === "beides" ? " · „Stunden HO“ ist der HO-Anteil, der Rest zählt als Büro" : ""}`;
  };
  ["#e-kommen", "#e-gehen"].forEach(id => $(id).onblur = e => { e.target.value = zeitNorm(e.target.value); kg(); });
  $("#e-pause").onblur = e => { e.target.value = pauseNorm(e.target.value); e.target.dataset.eigen = e.target.value ? 1 : ""; kg(); };     // leeren: wieder nach Regel
  $("#e-ho").addEventListener("blur", kg);
  $("#e-dst").addEventListener("blur", freiPruefen);
  $("#e-frei").addEventListener("change", kg);
  ["#e-hv", "#e-hb", "#e-dv", "#e-db"].forEach(id => $(id).onblur = e => { e.target.value = zeitNorm(e.target.value); kg(); });
  w.querySelectorAll("#e-ort button").forEach(b => b.addEventListener("click", kg));
  // Blockliste (Wunsch vom 24.11.2026): an einem Tag mit mehreren Einträgen gleich offen, sonst nach „+ Block“; dann gilt sie statt Kommen–Gehen oben.
  let blockModus = false;
  const geaendert = () => { if (ziel) ziel.dataset.geaendert = 1; };
  // Alle Zeilen der Liste (auch leere, zum Neuzeichnen) bzw. nur die ausgefüllten (Rechnen, Speichern); Zeiten wie die übrigen Felder normalisiert.
  const blockZeilen = () => [...w.querySelectorAll(".e-block")].map(blockLesen);
  const bloeckeVoll = () => blockZeilen().filter(b => b.kommen || b.gehen || b.dauer);
  // Hinweis unter der Liste: Arbeitszeit und Pause wie der Dienst sie rechnet, oder der Fehler; die Stunden HO und Büro folgen den Blöcken.
  const blockHinweis = () => {
    const l = bloeckeVoll(), r = l.length ? bloeckeRechnen(l, datum, $("#e-frei").checked) : null;
    if (!r) { $("#e-kg").textContent = "Trag je Block Kommen und Gehen ein. Die Lücke zwischen den Blöcken ist keine Pause."; return; }
    if (r.fehler) { $("#e-kg").innerHTML = meldung(r.fehler); return; }
    $("#e-ho").value = r.hoMin ? hhmm(r.hoMin) : ""; $("#e-dst").value = r.dstMin ? hhmm(r.dstMin) : "";
    $("#e-kg").textContent = `Arbeitszeit ${zeitText(r.hoMin + r.dstMin)} Std. in ${l.length} ${l.length === 1 ? "Block" : "Blöcken"}, Pause ${zeitText(r.pause)} (Lücken zählen an)${r.kapp ? `, Kappzeit ${zeitText(r.kapp)} Std.` : ""}`;
  };
  // Zeichnet die Liste neu und bindet ihre Felder; ohne Zeile gilt wieder Kommen–Gehen oben (leer, die Stunden ebenso).
  const blockZeigen = liste => {
    blockModus = liste.length > 0;
    $("#e-liste").innerHTML = liste.map((b, i) => blockZeileHtml(b, i)).join("");
    if (!blockModus) { $("#e-ho").value = $("#e-dst").value = ""; }
    $("#e-liste").querySelectorAll("input").forEach(e => e.onblur = () => { e.value = e.dataset.feld === "pause" ? pauseNorm(e.value) : zeitNorm(e.value); kg(); });
    $("#e-liste").querySelectorAll("select").forEach(e => e.onchange = kg);
    $("#e-liste").querySelectorAll("[data-weg]").forEach(b => b.onclick = () => {
      const l = blockZeilen(); l.splice(+b.dataset.weg, 1); blockZeigen(l); geaendert();
      (w.querySelector(".e-block input") || $("#e-plus")).focus();
    });
    kg();
  };
  // Kommen–Gehen oben als Blöcke (bei „Beides“ die zwei Blöcke, ohne Kommen die Stunden als Blöcke ohne Uhrzeit); danach sind die Felder oben leer,
  // damit nach dem Löschen aller Blöcke nichts Altes bleibt.
  const blockAn = () => {
    const ort = artWert("e-ort"), oben = ort === "beides"
      ? [["ho", "#e-hv", "#e-hb"], ["dst", "#e-dv", "#e-db"]].map(([art, v, b]) => ({art, kommen: zeitNorm($(v).value), gehen: zeitNorm($(b).value), pause: ""})).filter(b => b.kommen)
      : $("#e-kommen").value ? [{art: ort, kommen: zeitNorm($("#e-kommen").value), gehen: zeitNorm($("#e-gehen").value), pause: $("#e-pause").dataset.eigen ? pauseNorm($("#e-pause").value) : ""}]
      : [["ho", "#e-ho"], ["dst", "#e-dst"]].map(([art, id]) => ({art, dauer: zeitNorm($(id).value)})).filter(b => minuten(b.dauer) > 0);
    ["#e-kommen", "#e-gehen", "#e-pause", "#e-hv", "#e-hb", "#e-dv", "#e-db"].forEach(id => { $(id).value = ""; });
    $("#e-pause").dataset.eigen = "";
    return oben;
  };
  $("#e-plus").onclick = () => {
    const l = blockModus ? blockZeilen() : blockAn();
    blockZeigen([...l, {art: l.length ? l[l.length - 1].art : einOrt() || "ho", kommen: "", gehen: "", pause: ""}]);
    w.querySelector(`#e-b${l.length}-kommen`).focus(); geaendert();
  };
  // Angaben der Liste für PUT /tag: ein Block mit Uhrzeit wie bisher als Kommen–Gehen mit Ort, mehrere oder einer ohne Uhrzeit als „eintraege“; ohne Liste nichts.
  const blockDaten = () => {
    if (!blockModus) return {};
    const liste = bloeckeVoll(), [b] = liste;
    return liste.length > 1 || b?.dauer ? {eintraege: liste} : b ? {kommen: b.kommen, gehen: b.gehen, pause: b.pause, ort: b.art} : {kommen: "", gehen: "", pause: ""};
  };
  // Liste gleich offen mit mehreren Einträgen, davon einer mit Uhrzeit (nur Stunden ohne Uhrzeit bleiben in den Feldern „Stunden“ oben)
  if ((z.eintraege?.length || 0) > 1 && z.eintraege.some(e => e.kommen)) { blockAn(); blockZeigen(bloeckeAusTag(z)); } else kg();
  // Speichert den Tag, schließt das Blatt, bietet Rückgängig an (text: Meldung der Leiste), zeichnet neu und setzt den Fokus zurück auf den Tag.
  const senden = async (daten, text = "Gespeichert.") => {
    try {
      const r = await api("PUT", "/tag", {datum, ...daten}); if (!ziel) blattZu();
      rueckgaengigZeigen(r, text) || toast(text); await zeigen();
      if (ziel) await tagBearbeiten(datum);                                  // die Spalte zeigt den gespeicherten Stand
      const tag = [...document.querySelectorAll(`#inhalt [data-d="${datum}"]`)].find(e => e.offsetParent);
      tag?.focus({preventScroll: true}); rueckFreiRollen(tag, document.querySelector("#tag-knoepfe"));   // Tastatur und Screenreader bleiben beim Tag, die Leiste verdeckt weder ihn noch seine Knöpfe
    } catch (e) { fehlerZeigen(e.message); formFehler($("#e-fehler"), e.message, {felder: TAG_FEHLER_FELD}); }
  };
  // Öffnet vor der Meldung den Aufklapper (und die Zeile der Freigabe), in dem das genannte Feld steht, damit es sichtbar ist.
  const fehlerZeigen = text => {
    const f = $((TAG_FEHLER_FELD.find(([anfang]) => text.startsWith(anfang)) || [])[1] || "#e-fehler");
    if (f?.closest("details")) f.closest("details").open = true;
    if (f?.closest("#frei-zeile")) $("#frei-zeile").hidden = false;
  };
  $("#e-ok").onclick = gesperrt(() => {
    let art = $("#e-art").value; const attest = $("#e-attest").value;
    if (attest && art === "krank") art = "krank_attest";
    return senden({ho: zeitNorm($("#e-ho").value), dst: zeitNorm($("#e-dst").value), kommen: zeitNorm($("#e-kommen").value), gehen: zeitNorm($("#e-gehen").value), pause: $("#e-pause").dataset.eigen || (artWert("e-ort") === "beides" && $("#e-kommen").value) ? pauseNorm($("#e-pause").value) : "", ort: artWert("e-ort"), art, notiz: $("#e-notiz").value, konto: +($("#e-konto").value || 0), freigabe: $("#e-frei").checked, attest: ["krank", "krank_attest"].includes(art) ? attest : "", ...blockDaten()});
  });
  $("#e-leer").onclick = gesperrt(() => senden({ho: "", dst: "", art: "", notiz: ""}, "Tag geleert."));
  // „Mehr“ klappt nur das Auswahlfeld aller Arten auf und zu; geöffnet steht der Fokus darin.
  const mehrSchalten = () => {
    const auf = $("#e-mehr").hidden;
    $("#e-mehr").hidden = !auf; $('[data-schnell="mehr"]').setAttribute("aria-expanded", auf);
    if (auf) $("#e-art").focus();
  };
  // Leert Kommen, Gehen, Pause, die zwei Blöcke von „Beides“ und die Blockliste (Krank: ganzer Tag ohne Zeiten).
  const uhrLeeren = () => {
    ["#e-kommen", "#e-gehen", "#e-pause", "#e-hv", "#e-hb", "#e-dv", "#e-db"].forEach(id => { $(id).value = ""; });
    $("#e-pause").dataset.eigen = "";
    if (blockModus) blockZeigen([]);
  };
  // Tipp auf Homeoffice, Büro oder Krank: belegt Art, Ort und Stunden vor (schnellVorbelegung), speichert nichts und merkt die Spalte als geändert.
  const schnellWaehlen = art => {
    if (art === "mehr") { mehrSchalten(); return; }
    const f = {ho: zeitNorm($("#e-ho").value), dst: zeitNorm($("#e-dst").value), uhr: blockModus || !!$("#e-kommen").value};
    const v = schnellVorbelegung(art, f, dauerMinuten(z.soll_zeit) || 0, $("#e-attest").value);   // Tagessoll, nicht Soll fürs Konto (an Urlaub 0)
    if (v.uhrLeeren) uhrLeeren();
    $("#e-art").value = v.art; $("#e-ho").value = v.ho; $("#e-dst").value = v.dst;
    if (SCHNELL_ORT.includes(art)) { ortWahl = art; if (!(f.ho && f.dst)) w.querySelector(`#e-ort button[data-v="${art}"]`)?.click(); }
    kontoZeigen(); knopfWahlZeigen(); kg(); geaendert();
  };
  w.querySelectorAll("[data-schnell]").forEach(b => b.onclick = () => schnellWaehlen(b.dataset.schnell));
}
// Kachel eines Tages (Ist, Soll, Saldo; Saldo nur bis heute) mit Titel, z. B. „Heute“ oder „Montag“ (Seite Tag); ohne Tag leer.
// Zeile „Kappzeit 0:30 (über 10:00 Std.)“ der Karte des Tages (Auftrag vom 25.11.2026; Felder aus stempel.mit_eintraegen), leer ohne Kappzeit.
const kappzeitZeile = t => t.kappzeit_min > 0 ? wertZeile("Kappzeit", `${esc(t.kappzeit)} <small>(${esc(t.kappzeit_grund)})</small>`, "", "zeile gr", "tag-kappzeit") : "";
function tagKarteHtml(t, vorz, titel) {
  if (!t) return "";
  const kopf = `<h2>${esc(titel)}</h2>`;
  if (t.soll_min === 0 && t.arbeit_min === 0) return `<div class="card">${kopf}${wertZeile("Ist", zeitText(t.ist_min || 0))}
    ${wertZeile(t.feiertag ? esc(t.feiertag) : "Freier Tag", t.freizeit ? `<span class="saldo ${vorz(t.freizeit_min)}">Freizeit ${t.freizeit}</span>` : "kein Soll")}${kappzeitZeile(t)}</div>`;
  const saldo = t.ist_soll_min - t.arbeit_min;                 // Ist mit Auffüllung bei „Krank im Dienst“ (zählt für Soll und Ist, U3a); ein Tag nach heute zählt im Kern noch nicht zum Saldo
  return `<div class="card">${kopf}${wertZeile("Ist", zeitText(t.ist_soll_min))}${wertZeile("Soll", zeitText(t.arbeit_min))}
    ${t.zukunft ? "" : wertZeile("Saldo", zeitText(saldo, true), `saldo ${vorz(saldo)}`)}
    ${t.aufgefuellt_min > 0 ? `<p class="hinweis">davon Krank im Dienst aufgefüllt ${esc(t.aufgefuellt)}</p>` : ""}
    ${kappzeitZeile(t)}
    ${t.art ? wertZeile("Art", ARTEN[t.art]) : ""}</div>`;
}
// ---- Laufende Stempeluhr auf der Seite Tag (Wunsch vom 23.11.2026): nur heute, mit denselben Minuten wie die Kacheln der Übersicht (laufendeMinuten)
let tagLiveStand = null;                                             // {t, titel} des zuletzt gezeichneten Tages, für den Sekundentakt
// Tag mit m laufenden Minuten dazu: Ist und Ist fürs Soll wachsen, den Saldo rechnet tagKarteHtml daraus (keine eigene Rechnung).
const tagMitLaufend = (t, m) => m > 0 ? {...t, ist_min: (t.ist_min || 0) + m, ist_soll_min: (t.ist_soll_min || 0) + m} : t;
// Zeile der laufenden Uhr unter den Einträgen des Tages, z. B. „HO seit 17:36 · läuft“, mit Punkt wie im Band; m: Minuten bisher.
// Ein Knopf zur Stempeluhr, kein Tag (ohne data-d): bearbeiten lässt sie sich erst nach „Gehen“. Kein aria-live: der Wert ändert sich jede Minute.
function laufendZeileHtml(m) {
  return `<button type="button" class="tag laufend"${md("stempel")} ${kl("stempelBlatt")}><span class="dat"><i aria-hidden="true"></i></span>
    <span class="mitte"><span class="zeiten"><span class="chip ${stempelDaten.art === "ho" ? "ho" : "ds"}">${stempelOrt()} seit ${esc(stempelDaten.start_text)}</span></span>
    <span class="info">läuft<span class="sr">, Stempeluhr öffnen</span></span></span><span class="ist">${zeitText(m)}</span></button>`;
}
// Karte und Zeile der laufenden Uhr zum Tag t (aus GET /woche) mit Titel: heute bei laufender Uhr mit der laufenden Zeit, sonst wie gebucht und ohne Zeile
// (auch, wenn die Uhr seit einem früheren Tag läuft: ihre Zeit gehört zu jenem Tag). Rückgabe {karte, zeile} als HTML.
function tagLaufendHtml(t, titel) {
  const laeuft = !!t && t.datum === zeitHeuteIso() && stempelHeute(), m = laeuft ? laufendeMinuten() : 0;
  return {karte: tagKarteHtml(tagMitLaufend(t, m), saldoKlasse, titel), zeile: laeuft ? laufendZeileHtml(m) : ""};
}
// Bringt Karte und Zeile der Seite Tag auf den Stand der Uhr (nach dem Zeichnen, im Sekundentakt, nach Kommen und Gehen). Geschrieben wird nur,
// wenn sich das HTML ändert, also höchstens einmal je Minute: Screenreader und Fokus bleiben sonst in Ruhe. Auf anderen Seiten nichts.
function tagLaufend() {
  const k = $("#tag-karte"), z = $("#tag-laufend");
  if (!k || !z || !tagLiveStand) return;
  const {karte, zeile} = tagLaufendHtml(tagLiveStand.t, tagLiveStand.titel);
  if (k.zuletzt !== karte) { k.innerHTML = karte; k.zuletzt = karte; }
  if (z.zuletzt !== zeile) {
    const a = document.activeElement, fokus = !!a && !!a.closest("#tag-laufend");   // der Knopf wird ersetzt: Fokus von Tastatur oder Screenreader mitnehmen, nicht nach body fallen lassen
    z.innerHTML = zeile; z.zuletzt = zeile;
    const knopf = fokus && z.querySelector(".laufend");
    if (knopf) knopf.focus({preventScroll: true});
  }
}
// Einzelne Einträge des Tages auf der Seite Tag (Wunsch vom 23.11.2026, einzeln änderbar seit 25.11.2026), aus „eintraege“ von GET /woche (auch ein
// einzelner und Stunden ohne Uhrzeit): je Zeile ein Knopf mit Ort, Kommen–Gehen (oder „ohne Uhrzeit“), eigener Pause und Dauer. Ohne data-d (nicht die
// Tageszeile): data-eintrag ist die Nummer, Tippen öffnet nur diesen Eintrag (eintraegeBinden).
const EINTRAG_ORT = {ho: ["ho", "HO"], dst: ["ds", "Büro"]};
const EINTRAG_OHNE_UHRZEIT = "ohne Uhrzeit";
function tagEintraegeHtml(t) {
  return (t.eintraege || []).map((e, i) => { const [klasse, ort] = EINTRAG_ORT[e.art] || EINTRAG_ORT.ho, zeit = e.kommen ? `${esc(e.kommen)}–${esc(e.gehen)}` : EINTRAG_OHNE_UHRZEIT;
    return `<button type="button" class="tag einzel" data-eintrag="${i}" aria-label="${ort} ${zeit}, ${esc(e.dauer)}. Ändern oder löschen"><span class="dat"></span><span class="mitte"><span class="zeiten"><span class="chip ${klasse}">${ort} ${zeit}</span></span>${e.pause ? `<span class="info">Pause ${esc(e.pause)}</span>` : ""}</span><span class="ist">${esc(e.dauer)}</span></button>`; }).join("");
}
// Knopf „+ Eintrag“ unter den Einträgen der Seite Tag, auch an einem Tag, der schon Zeit hat (data-eintrag -1: neu).
const eintragNeuHtml = () => '<button type="button" class="leise eintrag-neu" data-eintrag="-1">+ Eintrag</button>';
// Bindet auf der Seite Tag die Einträge und „+ Eintrag“ an eintragBearbeiten (nach dem Zeichnen, window.nachher); d: Datum der Seite.
function eintraegeBinden(d) {
  document.querySelectorAll("#inhalt [data-eintrag]").forEach(b => b.onclick = () => eintragBearbeiten(d, +b.dataset.eintrag));
}
// Angaben für PUT /tag nach dem Ändern (block), Löschen (block null) oder Anlegen (i < 0) eines Eintrags auf der Seite Tag: alle Blöcke des Tages
// (bloeckeAusTag, die übrigen mit ihrer Pause) mit dem einen geänderten, dazu Art, Anmerkung, Attest, Konto und Freigabe des Tages.
// Ohne Block bleiben Stunden und Uhrzeiten leer.
function eintragDaten(z, i, block) {
  const liste = bloeckeAusTag(z);
  if (i < 0) liste.push(block); else liste.splice(i, 1, ...(block ? [block] : []));
  const tag = {art: z.art || "", notiz: z.notiz || "", attest: z.attest || "", konto: z.konto || 0, freigabe: z.freigabe || 0};
  return liste.length ? {...tag, eintraege: liste} : {...tag, ho: "", dst: "", kommen: "", gehen: "", pause: ""};
}
const EINTRAG_FEHLER_FELD = [["Block", "#blatt-inh .e-block input"], ["Die Blöcke", "#blatt-inh .e-block input"], ["Mehr als 10 Stunden", "#blatt-inh .e-block input"]];
// Blatt für einen Eintrag der Seite Tag (Wunsch vom 25.11.2026): Ort, Kommen, Gehen und Pause (Stunden ohne Uhrzeit: Ort und Stunden), „Löschen“ in der Zeile;
// i < 0 legt einen neuen an. Gespeichert wird der ganze Tag mit PUT /tag (eintragDaten), danach die Rückgängig-Leiste; Fehler stehen im Blatt, die Eingaben bleiben.
// Ein Tag mit Homeoffice und Büro in einem Kommen–Gehen hat keine Einträge: dann öffnet das Formular des ganzen Tages.
async function eintragBearbeiten(datum, i) {
  if (!(await zeitVerwerfenOk())) return;
  const z = ((window.monatDaten || {}).tage || []).find(x => x.datum === datum);
  if (!z) return;
  if (z.ist_min > 0 && !z.eintraege?.length) return tagBearbeiten(datum);
  const b = i < 0 ? {art: einOrt() || z.eintraege?.at(-1)?.art || "ho", kommen: "", gehen: "", pause: ""} : bloeckeAusTag(z)[i];
  blatt(`<h3>${i < 0 ? "Neuer Eintrag" : "Eintrag"} · ${z.wt} ${datum.slice(8)}.${datum.slice(5, 7)}.</h3>${blockZeileHtml(b, 0, "ei")}
    ${"dauer" in b ? "" : `<p class="hinweis" id="ei-pause-hinweis"${b.pause ? " hidden" : ""}>Pause leer: nur die Pflichtpause (${pausenText()}). Die App rechnet sie über den ganzen Tag, Lücken zählen an.</p>`}<div id="ei-fehler"></div>
    <div class="knoepfe"><button class="prim" id="ei-ok">Speichern</button><button id="ei-zu">Abbrechen</button></div>`);
  const w = $("#blatt-inh"), zeile = w.querySelector(".e-block"), weg = zeile.querySelector("[data-weg]");
  zeile.querySelectorAll("input").forEach(e => e.onblur = () => {
    e.value = e.dataset.feld === "pause" ? pauseNorm(e.value) : zeitNorm(e.value);
    if (e.dataset.feld === "pause" && $("#ei-pause-hinweis")) $("#ei-pause-hinweis").hidden = !!e.value;   // der Hinweis gilt nur für eine leere Pause
  });
  const senden = async (block, text) => {
    const daten = eintragDaten(z, i, block), fehler = daten.eintraege && bloeckeRechnen(daten.eintraege).fehler;   // wie im Formular: Fehler schon vor dem Senden
    if (fehler) { formFehler($("#ei-fehler"), fehler, {feld: zeile.querySelector("input")}); return; }
    try {
      const r = await api("PUT", "/tag", {datum, ...daten}); blattZu();
      rueckgaengigZeigen(r, text) || toast(text); await zeigen();
      if (zeitDaneben()) await tagBearbeiten(datum);                       // die Spalte daneben zeigt den gespeicherten Stand
    } catch (e) { formFehler($("#ei-fehler"), e.message, {felder: EINTRAG_FEHLER_FELD}); }
  };
  $("#ei-ok").onclick = gesperrt(() => senden(blockLesen(zeile), "Eintrag gespeichert."));
  if (i < 0) weg.remove(); else weg.onclick = gesperrt(() => senden(null, "Eintrag gelöscht."));
  $("#ei-zu").onclick = blattZu;
}
// Woche und Monat (Wunsch vom 25.11.2026): Tippen oder Enter auf einen Tag öffnet die Seite Tag dieses Tages (dort jeder Eintrag einzeln) statt des Formulars.
// Läuft nach zeitSpalte, das die Tage sonst ans Bearbeiten bindet; ungesicherte Änderungen der Spalte daneben fragen vorher.
function zeitTagSprung() {
  document.querySelectorAll(ZEIT_TAGE).forEach(e => e.onclick = async () => { if (await zeitVerwerfenOk()) location.hash = zeitAdresse("tag", e.dataset.d); });
}
// Kennzeichen eines Tages für Zeilen in Monat, Woche und Tag: Homeoffice, Büro und Art.
const tagChips = z => [z.ho ? `<span class="chip ho">HO ${z.ho}</span>` : "", z.dst ? `<span class="chip ds">Büro ${z.dst}</span>` : "",
  z.art ? `<span class="chip art a-${z.art}">${ARTEN[z.art]}</span>` : ""].join("");
// Text unter den Kennzeichen (noch nicht maskiert): Feiertag, Kommen–Gehen, Notiz, Auffüllung bei „Krank im Dienst“.
// einzeln: die Einträge des Tages stehen darunter (Seite Tag), siehe uhrText.
const tagInfo = (z, einzeln) => [z.feiertag, uhrText(z, einzeln), z.notiz,
  z.aufgefuellt ? `aufgefüllt ${z.aufgefuellt}` : ""].filter(Boolean).join(" · ");
// Text ohne Eintrag: bis heute der Hinweis auf den fehlenden Eintrag, ein späterer Arbeitstag blass sein Soll (soll_min aus /woche; nur Anzeige, ohne Saldo).
// Freie Tage, Feiertage und Tage mit 0 Minuten Soll bleiben leer.
function tagLeerHtml(z) {
  if (z.zukunft) return z.soll_min > 0 ? `<span class="leer-tag soll-spaeter">Soll ${zeitText(z.soll_min)}</span>` : "";
  return z.soll ? '<span class="leer-tag">noch nichts eingetragen</span>' : "";
}
// Zeile eines Tages (Tag, Woche, Monat): Datum, HO/Büro, Art, Feiertag, Kommen–Gehen, Notiz, Ist (mit Auffüllung) und Saldo; heute hervorgehoben.
// einzeln: Seite Tag, die Einträge stehen darunter (tagInfo). rechtsSoll: Monat, rechts das Soll fürs Konto statt des Saldos; die Tage aus /monat
// tragen weder zukunft noch soll_min, beides kommt hier aus heuteIso und soll_konto_min. Ein leerer späterer Tag zeigt sein Soll nur einmal (in der Mitte).
function tagZeileHtml(z, heuteIso, vorz, einzeln, rechtsSoll) {
  if (rechtsSoll) z = {...z, zukunft: z.datum > heuteIso, soll_min: z.soll_konto_min};
  const chips = tagChips(z), info = tagInfo(z, einzeln);
  const rechts = rechtsSoll ? (z.soll_konto_min > 0 && (chips || !z.zukunft) ? `<small>Soll ${zeitText(z.soll_konto_min)}</small>` : "") : tagSaldoHtml(z, vorz);
  return `<div class="tag ${z.frei ? "frei" : ""} ${z.datum === heuteIso ? "heute" : ""}" data-d="${z.datum}"><div class="dat"><b>${z.tag}</b><small>${z.wt}</small></div>
      <div class="mitte"><div class="zeiten">${chips || tagLeerHtml(z)}</div>${info ? `<div class="info">${esc(info)}</div>` : ""}</div>
      <div class="ist">${z.ist_soll_min ? zeitText(z.ist_soll_min) : ""}${rechts}</div></div>`;
}
// Saldo und Freizeit rechts in der Zeile (Tag, Woche), beide erst ab dem Tag selbst, nie für spätere Tage.
const tagSaldoHtml = (z, vorz) => (z.saldo && !z.zukunft ? `<small class="saldo ${vorz(z.saldo_min)}">${z.saldo}</small>` : "")
  + (z.freizeit && !z.zukunft ? `<small class="saldo ${vorz(z.freizeit_min)}"${md("freizeit")}>Freizeit ${z.freizeit}</small>` : "");
// Hat der Tag irgendeinen Eintrag (Zeiten, Art oder Notiz)?
const tagHatEintrag = z => !!(z.ho || z.dst || z.art || z.notiz);
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
const WISCH_NICHT = "input, select, textarea, [contenteditable], .tbl, [role=tablist], #tag-daneben";

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
  history.replaceState(history.state, "", zeitAdresse("tag", d));
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
// Rollt ein Bereich zwischen Ziel und #inhalt selbst waagrecht (breite Karte, Diagramm)? Dann gehört die Geste ihm; so braucht nicht jede neue Karte eine Klasse in WISCH_NICHT.
function wischRolltSelbst(ziel) {
  for (let e = ziel; e && e.id !== "inhalt"; e = e.parentElement) if (e.scrollWidth > e.clientWidth && /auto|scroll/.test(getComputedStyle(e).overflowX)) return true;
  return false;
}
// Merkt den Anfang einer Geste mit Finger oder Stift, außer im Blatt, in Feldern, Tabellen, rollenden Bereichen, Reitern, in der Spalte und am Rand (Zurück-Gesten von iOS
// und Android). Ein zweiter Finger (Zoomen) verwirft die Geste.
function wischStart(e) {
  wischAnfang = e.isPrimary && ZEIT_SEITEN.includes(document.body.dataset.seite) && ["touch", "pen"].includes(e.pointerType) && !$("#blatt").classList.contains("auf")
    && !e.target.closest(WISCH_NICHT) && !wischRolltSelbst(e.target) && e.clientX >= WISCH_RAND && e.clientX <= innerWidth - WISCH_RAND
    ? {x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, auswahl: String(getSelection() || "")} : null;
}
// Richtung einer fertigen Geste a→e: 1 = vor (nach links gewischt), -1 = zurück, 0 = keine (unter 60 px, nicht doppelt so weit wie senkrecht oder ab 600 ms).
function wischRichtung(a, e) {
  const dx = e.clientX - a.x, dy = e.clientY - a.y;
  return Math.abs(dx) >= WISCH_STRECKE && Math.abs(dx) > 2 * Math.abs(dy) && e.timeStamp - a.t < WISCH_DAUER_MS ? (dx < 0 ? 1 : -1) : 0;
}
// Blättert am Ende der Geste desselben Zeigers; nicht, wenn dabei Text markiert wurde (eine schon vorher bestehende, unveränderte Markierung sperrt nicht).
function wischEnde(e) {
  const a = wischAnfang;
  if (!a || e.pointerId !== a.id) return;
  wischAnfang = null;
  const auswahl = String(getSelection() || "");
  const r = auswahl && auswahl !== a.auswahl ? 0 : wischRichtung(a, e);
  if (r) zeitBlaettern(r);
}
// Bindet das Wischen an ein Element (#inhalt); ein abgebrochener Zeiger (Scrollen) löst nichts aus.
function zeitWischen(feld) {
  feld.addEventListener("pointerdown", wischStart);
  feld.addEventListener("pointerup", wischEnde);
  feld.addEventListener("pointercancel", () => { wischAnfang = null; });
}

// ---- Am Rechner: Tag rechts daneben (#tag-daneben, außerhalb von #inhalt, damit Eingaben das Neuzeichnen überstehen)
// Steht das Formular rechts daneben? Nur im Design „web“ auf der Seite Tag; sonst das Blatt. Woche und Monat springen beim Tipp zur Seite Tag (K2, 25.11.2026).
function zeitDaneben() { return document.body.dataset.design === "web" && document.body.dataset.seite === "tag"; }
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
// Markiert den gewählten Tag links (Klasse gew, aria-current="date"), nur wenn die Spalte daneben steht. Die Einträge darunter (.einzel) gehören
// zum selben Tag, gewählt ist nur seine Zeile.
function zeitMarkieren() {
  document.querySelectorAll(ZEIT_TAGE).forEach(e => {
    const an = zeitDaneben() && e.dataset.d === zeitDatum && !e.classList.contains("einzel");
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
const ZUTUN_VERSION = /^\d{8}\.\d{4}$/;   // Form der Versionsnummer (update.VERSION_FORM): nur so wird sie Teil der Wiki-Adresse
const ZUTUN_TAG_ISO = /^\d{4}-\d{2}-\d{2}$/;   // nur so wird ein Wert aus „fehlend“ Teil der Adresse #/tag/<datum>/bearbeiten
const ZUTUN_TAG_WT = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const ZUTUN_TAGE_SICHTBAR = 8;   // mehr fehlende Tage machen die Karte am Handy sehr hoch (22 Tage = 11 Zeilen); die älteren klappt „Alle Tage“ auf
// Fehlende Tage (e.fehlend, ISO-Daten): je Tag ein Link zum Nachtragen; ohne eigene Listenpunkte, weil zutunWeg „#zutun li“ für die Zahl am Symbol zählt.
// Über ZUTUN_TAGE_SICHTBAR Tagen sind nur die letzten sichtbar, die älteren stehen verborgen davor, dahinter der Knopf „Alle Tage“.
function zutunTage(e) {
  const tage = (Array.isArray(e.fehlend) ? e.fehlend : []).filter(t => typeof t === "string" && ZUTUN_TAG_ISO.test(t));
  if (!tage.length) return "";
  const verborgen = Math.max(0, tage.length - ZUTUN_TAGE_SICHTBAR);
  const link = (t, i) => { const [j, m, d] = t.split("-"), wt = ZUTUN_TAG_WT[(new Date(Date.UTC(j, m - 1, d)).getUTCDay() + 6) % 7];
    return `<a ${i < verborgen ? "hidden " : ""}class="btn" href="#/tag/${t}/bearbeiten" aria-label="${wt} ${d}.${m}.${j} nachtragen">${wt} ${d}.${m}.</a>`; };
  const alle = verborgen ? `<button type="button" class="btn zt-alle" data-klick="zutunAlleTage" aria-label="Alle ${tage.length} fehlenden Tage zeigen">Alle Tage (${tage.length})</button>` : "";
  return `<div class="knoepfe zt-tage" role="group" aria-label="Fehlende Tage">${tage.map(link).join("")}${alle}</div>`;
}
// „Alle Tage“: zeigt die verborgenen älteren Tage, nimmt den Knopf weg und setzt den Fokus auf den ältesten Tag.
function zutunAlleTage() {
  const gruppe = $("#zutun .zt-tage");
  if (!gruppe) return;
  gruppe.querySelectorAll("a[hidden]").forEach(a => { a.hidden = false; });
  gruppe.querySelector(".zt-alle")?.remove();
  gruppe.querySelector("a")?.focus();
}
// Knopf zum Ziel eines Eintrags: Seite der App oder genau die Release-Seite (neues Fenster, ohne Opener und Referrer); sonst keiner.
// Einträge zu einer neuen Version (mit e.version) bekommen dazu „Was ist neu?“: Seite der Version im Wiki, bei unlesbarer Nummer die Übersicht.
function zutunKnopf(e) {
  if (!e.knopf) return "";
  const neu = "version" in e ? wikiLink("Was ist neu?", "/" + (typeof e.version === "string" && ZUTUN_VERSION.test(e.version) ? "Neu-in-" + e.version : "Neuigkeiten"), ' class="btn"') : "";
  if (e.ziel === ZUTUN_RELEASE) return `<a class="btn prim" href="${ZUTUN_RELEASE}" target="_blank" rel="noopener noreferrer">${esc(e.knopf)}</a>` + neu;
  return (ZUTUN_ZIEL.test(e.ziel || "") ? `<a class="btn prim" href="${esc(e.ziel)}">${esc(e.knopf)}</a>` : "") + neu;
}
// Karte „Zu tun“: je Eintrag Stufe (Farbe und Text für den Screenreader), Text, Knopf zum Ziel, „Später“ und „Nicht mehr zeigen“. Ohne Einträge leer.
function zutunKarte(antwort) {
  const liste = zutunSichtbar(antwort);
  if (!liste.length) return "";
  const zeile = e => `<li class="zt-${e.stufe}" data-zutun="${esc(e.id)}"><p><span class="sr">${ZUTUN_STUFEN[e.stufe]}: </span>${esc(e.text)}</p>${zutunTage(e)}<div class="knoepfe">`
    + `${zutunKnopf(e)}<button ${kl("zutunSpaeter", e.id)}>Später</button>`
    + `${e.stufe !== "rot" ? `<button ${kl("zutunAus", e.id)}>Nicht mehr zeigen</button>` : ""}</div></li>`;
  return `<section class="card kachel breit zutun" id="zutun" aria-labelledby="zutun-titel"><h2 id="zutun-titel">Zu tun</h2><ul>${liste.map(zeile).join("")}</ul></section>`;
}
// Nimmt einen Eintrag aus der Karte (ohne Neuladen), den letzten samt Karte; der Fokus geht zum nächsten Eintrag. Die Zahl am Symbol sinkt ohne neue Anfrage.
function zutunWeg(id) {
  const li = [...document.querySelectorAll("#zutun li")].find(x => x.dataset.zutun === id); if (!li) return;
  const naechster = li.nextElementSibling || li.previousElementSibling;
  li.remove();
  zutunZahlSetzen(document.querySelectorAll("#zutun li").length);
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
  if (!/^\d+$/.test(wert)) { formFehler(box, `Bitte eine ganze Zahl von 0 bis ${feld.max} eingeben.`, {feld}); feld.focus(); return; }
  try { await api("POST", "/jahreswechsel/ansparen", {tage: +wert}); }
  catch (e) { formFehler(box, e.message, {feld}); feld.focus(); return; }
  toast(`${tage(+wert)} angespart.`); zeigen();
}
// Hakt einen Schritt ab („Nicht ansparen“, „Stimmt“, Steuerdatei) oder blendet die Karte aus (id „aus“).
async function jahreswechselErledigt(id) {
  try { await api("POST", "/jahreswechsel/erledigt", {id}); } catch (e) { toastFehler(e.message); return; }
  zeigen();
}

// ---- Kacheln Heute, Diese Woche, Gleitzeit und Urlaub (Entscheidung des Entwicklers 24.11.2026): eine Angabe je Zeile, Zahl und Einheit nie getrennt
const KEIN_ARBEITSTAG = "Kein Arbeitstag", ZAEHLT_FREIZEIT = "zählt zum Freizeitkonto", FREIZEIT_TEXT = "Arbeit an Wochenende und Feiertag";
// Saldo mit Vorzeichen in seiner Farbe; id und data-min (ohne laufende Uhr) braucht uebersichtLaufend zum Weiterzählen.
const saldoLive = (id, min) => `<span id="${id}" class="saldo ${saldoKlasse(min + laufendeMinuten())}" data-min="${min}">${zeitText(min + laufendeMinuten(), true)}</span>`;
// Gebuchte Minuten mit laufender Uhr, Element mit id und data-min (gleitzeitLaufend zählt weiter).
const istLive = (id, min) => `<span id="${id}" data-min="${min}">${zeitText(min + laufendeMinuten())}</span>`;
// Zeichen des längsten Worts: Die Schrift der Art in der Kachel richtet sich danach (start.css), damit kein Wort mitten umbricht.
const laengstesWort = text => Math.max(...String(text).split(/\s+/).map(w => w.length));
// Ist der Tag eine Abwesenheit mit eigener Art (Urlaub, Gleittag, Krank …)? „Krank im Dienst“ ist ein Arbeitstag mit Auffüllung.
const tagAbwesend = t => !!t.art && t.art !== "krank_dienst" && t.art in ARTEN;
// Zeile „Saldo heute“ der Kachel Heute, zählt mit der laufenden Uhr (uebersichtLaufend).
const saldoHeute = t => `<span class="etikett">Saldo heute</span> ${saldoLive("gz-saldo-tag", t.saldo_min || 0)}`;
// Satz des Kerns („Bis 16:12 für dein Tagessoll“); mit Gehen-Zeit (Uhr läuft heute) mit id und Saldo ohne Uhr, damit uebersichtLaufend ihn beim
// Erreichen des Solls auf „Tagessoll erreicht“ umschaltet, ohne die Übersicht neu zu zeichnen.
const zielSatz = (t, z) => z?.gehen ? `<span id="gz-ziel-tag" data-min="${t.saldo_min || 0}">${esc(z.satz)}</span>` : esc(z?.satz || "");
// Kachel „Heute“ (Ziel: Zeit › Tag heute). t: Tag heute aus GET /woche, z: „tagesziel“ derselben Antwort.
// Abwesenheit: Art groß; Wochenende/Feiertag: gearbeitet groß, kein Saldo; Arbeitstag: gearbeitet, Tagessoll, Saldo heute, Satz des Kerns. Saldo nur
// mit Modul Gleitzeit. Gearbeitet und Saldo zählen mit der laufenden Uhr. Seit 25.11.2026 ohne Balken (Wunsch): der Verlauf steht auf der Seite Tag.
function heuteKachel(t, z) {
  const gz = modulAn("gleitzeit");
  let wert, zeilen;
  if (tagAbwesend(t)) [wert, zeilen] = [`<span class="k-art" data-stil="--zeichen:${laengstesWort(ARTEN[t.art])}">${esc(ARTEN[t.art])}</span>`, []];
  else if (!t.soll_min) [wert, zeilen] = [istLive("gz-tag", t.ist_min || 0), [modulAn("freizeit") && z?.freizeit ? `${KEIN_ARBEITSTAG} · ${ZAEHLT_FREIZEIT}` : KEIN_ARBEITSTAG, gz && !t.frei && !t.vor_beginn && t.ist_min ? saldoHeute(t) : ""]];
  else [wert, zeilen] = [istLive("gz-tag", t.ist_min || 0), [`von ${einheitFest(zeitText(t.arbeit_min || 0))} Tagessoll`, gz ? saldoHeute(t) : "", zielSatz(t, z)]];
  return kachel("Heute", wert, [...zeilen, feierabendKachel(t.datum)].filter(Boolean).join("<br>"), `tag/${t.datum}`, "klein k-tag");
}
// Kachel „Diese Woche“: Ist der KW groß, Wochensoll, Saldo der Woche (Modul Gleitzeit); ohne Balken (Wunsch 25.11.2026, Verlauf auf der Seite Woche).
function wocheKachel(wo, kw) {
  const gz = modulAn("gleitzeit");
  const zeilen = [`von ${einheitFest(wo.soll_woche)} in KW\u00a0${kw}`, gz ? `<span class="etikett">Saldo dieser Woche</span> ${saldoLive("gz-saldo-kw", wo.saldo_min)}` : ""];
  return kachel("Diese Woche", istLive("gz-kw", wo.ist_min), zeilen.filter(Boolean).join("<br>"), "woche", "klein k-woche", "woche");
}
// Kachel „Gleitzeit“: Konto groß, „Stand heute“, Kappung, darunter genau der Gleitzeit-Verlauf der Karte der Seite Woche (letzte 3 Wochen, Wunsch 25.11.2026;
// gv: gleitzeitVerlauf("woche", …, true), null ohne Bild). Bild (aria-hidden) als eigenes Kind #gz-kachel, Satz für den Screenreader im Zusatz.
function gleitzeitKachel(gz, gv) {
  const [bild, text] = gv ? gzKachelBild(gv) : ["", ""];
  const [verlauf, satz] = bild ? [`<div class="mv" id="gz-kachel">${bild}</div>`, `<span class="sr">${text}</span>`] : ["", ""];
  return kachel("Gleitzeit", `<span class="saldo ${saldoKlasse(gz.konto_min)}">${gz.konto}</span>`, `Stand heute${gz.kappung ? `<br>${esc(gz.kappung.text)}` : ""}${satz}`, WOCHE_GLEITZEIT, "k-gleitzeit", "gleitzeit", verlauf);
}
// Kachel „Urlaub“: Rest groß, „von 39 übrig“, Gleittage und Familientage je eine Zeile (nur mit ihrem Modul).
function urlaubKachel(u) {
  const zeilen = [`von ${komma(u.anspruch + u.uebertrag)} übrig`, modulAn("gleittage") ? `Gleittage ${u.gleittage_rest} von ${u.gleittage_max}` : "",
    u.familientage_aktiv && modulAn("familientage") ? `Familientage ${u.familientage_rest} von ${u.familientage_max}` : ""];
  return kachel("Urlaub", einheitFest(tage(u.rest)), zeilen.filter(Boolean).join("<br>"), "urlaub", "klein", "urlaub");
}
// Lage der Karte Heute: laufende Uhr (Ort, Beginn, Dauer), eingetragene Zeit, Abwesenheit, nichts eingetragen oder freier Tag (je Überschrift und Zeile).
function heuteLage(st, he, t) {
  if (st.laeuft) return `<b class="gross">${st.art === "ho" ? "Homeoffice" : "Büro"} seit ${esc(stempelSeit())} Uhr</b><span>Läuft seit <span id="hk-lauf">${laufText()}</span>\u00a0Std.</span>`;
  if (st.heute.ho || st.heute.dst) return `<b class="gross">Heute eingetragen</b><span>${orteText(st.heute.ho, st.heute.dst)}</span>`;
  if (tagAbwesend(t)) return `<b class="gross">${esc(ARTEN[t.art])}</b><span>Für heute eingetragen.</span>`;
  if (he.soll_tag) return `<b class="gross">Noch nichts eingetragen</b><span>${modulAn("stempel") ? "Starte die Stempeluhr oder trage die Zeit nach." : "Trage die Zeit ein."}</span>`;
  return `<b class="gross">Heute ist frei</b><span>Kein Arbeitstag.</span>`;
}
// Karte „Heute“ oben auf der Übersicht: Datum, Lage, Knöpfe Kommen bzw. „Gehen (seit 07:30)“, „Beginn korrigieren“ (nur wenn erlaubt), „Heute eintragen“.
function heuteKarte(st, he, t, datum) {
  const korrektur = st.laeuft && beginnKorrigierbar() ? `<button${md("stempel")} ${kl("beginnKorrigieren")}>Beginn korrigieren</button>` : "";
  return `<div class="card kachel heute-karte"><span>${datum}</span><div>${heuteLage(st, he, t)}</div>
      <div class="knoepfe"><button class="prim"${md("stempel")} ${kl("stempelBlatt")}>${esc(stempelKnopf(st))}</button>${korrektur}<button ${kl("heuteEintragen")}>Heute eintragen</button></div></div>`;
}

// Karte mit einer Warnung zur Grenze (Link zur Seite); ohne Warnung leer.
const warnungKarte = link => link ? `<div class="card kachel breit warnungen">${link}</div>` : "";
const WARNUNG_HINTER = {jahr: "warnung_jahr"};    // Warnung zur Grenze unter ihrer Quote-Karte (bei Monat | Jahr hinter dem Paar); zum Monat sagt es die Quote-Ampel
const QUOTE_RINGE = ["monat", "jahr"];             // die beiden Ringe, die am Computer ein Paar bilden
// HTML der Karten in der gemerkten Folge ohne ausgeblendete und leere. Die Warnung steht unter ihrer Quote-Karte, bei ausgeblendeter Karte an deren Platz:
// Warnungen lassen sich nicht ausblenden. Keine Hülle um Kacheln: Paare kleiner Kacheln bildet das Raster (start.css) in dieser Folge.
// Folgen die beiden Ringe aufeinander (am Computer ein Paar nebeneinander), steht die Warnung hinter dem zweiten: sonst trennte sie das Paar (Prüfbefund 24.11.2026).
function uebersichtReihe(teile, stand) {
  const zu = id => !stand.aus.includes(id) && teile[id], reihe = [], warten = [];
  stand.folge.forEach((id, i) => {
    if (zu(id)) reihe.push(teile[id]);
    warten.push(teile[WARNUNG_HINTER[id]]);
    const naechste = stand.folge.slice(i + 1).find(zu);
    if (!(zu(id) && QUOTE_RINGE.includes(id) && QUOTE_RINGE.includes(naechste))) reihe.push(...warten.splice(0));
  });
  return [...reihe, ...warten].filter(Boolean).join("");
}

// ---- Übersicht (Startseite der App)
// ---- Erster Start (funktionen.md 6.1): Karte „Erster Start“ statt eines sperrenden Dialogs. Die Person kann weg und wiederkommen; Wahl und
// Eingaben bleiben bis zum Neuladen in EINRICHTUNG. Schritt 0 fragt nach einem anderen Gerät, 1 Vorlage, 2 Bundesland, 3 Arbeitszeit, 4 Grenze, 5 Urlaub.
let EINRICHTUNG = null;                                               // {schritt, pr: Antwort von GET /api/profile, werte: Eingaben der Schritte}
const EI_WERKTAGE = ["Mo", "Di", "Mi", "Do", "Fr"];
const EI_WOCHENSTUNDEN = 40, EI_GRENZE = 80, EI_URLAUBSTAGE = 30;   // Vorgaben, wenn weder Eingabe noch Regel einen Wert haben (wie konfig.STANDARD)
// Meldungen des Dienstes zu PUT /konfig nennen das Feld nur im Text (konfig.EINSTELLUNG_NAMEN): Textanfang, Schritt und Feld der Einrichtung
const EI_FEHLER_FELD = [["Bundesland", 2, "#ei-bl"], ["Wochenstunden", 3, "#ei-ws"], ["Arbeitstage", 3, "#ei-tage"], ["HO-Grenze", 4, "#ei-grenze"], ["Urlaubstage", 5, "#ei-ut"]];
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
  if (schritt === 0) return ["Nutzt du die App schon auf einem anderen Gerät?", `<small>Dann holst du deine Daten per Synchronisieren, Regeln inklusive.</small>
    <div class="knoepfe"><a class="btn" href="#/sync">Ja, Daten holen</a><button class="prim" ${kl("einrichtungWeiter")}>Nein, neu beginnen</button></div>`];
  if (schritt === 1) return ["Wie arbeitest du?", `<small>Die App stellt Regeln und Seiten darauf ein. Ändern kannst du das später unter ${weg("einstellungen", "module")}.</small>
    <div class="profil-wahl">${einrichtungVorlagen().map(x => `<button type="button" class="${x.name === EINRICHTUNG.pr.gewaehlt ? "gew" : ""}" ${kl("profilWaehlen", x.name)}><b>${esc(x.name)}</b><small>${esc(x.beschreibung || "")}</small></button>`).join("")}</div>`];
  if (schritt === 2) return ["In welchem Bundesland arbeitest du?", `<label for="ei-bl">Bundesland (für die Feiertage)</label><select id="ei-bl">${Object.entries(BUNDESLAENDER).map(([c, n]) => `<option value="${c}"${c === w("bundesland") ? " selected" : ""}>${n}</option>`).join("")}</select>`];
  if (schritt === 3) return ["Wie viel arbeitest du?", `<label for="ei-ws">Stunden pro Woche</label>${stepper("ei-ws", Number(w("wochenstunden")) || EI_WOCHENSTUNDEN, 0.5, 1)}
    <label id="ei-tage-titel">Arbeitstage</label><div class="tage-wahl" id="ei-tage" role="group" aria-labelledby="ei-tage-titel">${EI_WERKTAGE.map(t => `<label><input type="checkbox" value="${t}"${String(w("arbeitstage")).split(",").includes(t) ? " checked" : ""}>${t}</label>`).join("")}</div>
    <p class="hinweis">Teilzeit mit Stunden je Tag stellst du später unter ${weg("einstellungen", "arbeitszeit")} ein.</p>`];
  if (schritt === 4) return ["Wie hoch ist deine Homeoffice-Grenze?", `<label for="ei-grenze">Höchstens so viel Prozent der Arbeitszeit im Homeoffice</label>${stepper("ei-grenze", Number(w("ho_grenze")) || EI_GRENZE, 1, 1)}`];
  return ["Wie viele Urlaubstage hast du im Jahr?", `<label for="ei-ut">Urlaubstage pro Jahr</label>${stepper("ei-ut", Number(w("urlaub_tage") ?? EI_URLAUBSTAGE), 1, 0)}`];
}
// Karte „Erster Start“ für den aktuellen Schritt: Titel, Zähler „Schritt 2 von 5“ (ohne Schritt 0) als Hinweis, die Frage des Schritts (Fokus beim Wechsel),
// Knöpfe in der Folge der Schritt-Dialoge: Weiter bzw. Fertig, Zurück, Überspringen.
function einrichtungKarte() {
  const s = EINRICHTUNG.schritt, folge = einrichtungSchritte(), nr = folge.indexOf(s) + 1, [titel, felder] = einrichtungInhalt(s);
  const weiter = s === 1 ? "" : s === folge.at(-1) ? `<button class="prim" ${kl("einrichtungFertig")}>Fertig</button>` : `<button class="prim" ${kl("einrichtungWeiter")}>Weiter</button>`;
  return `<section class="card kachel breit einrichtung" id="einrichtung" aria-labelledby="ei-kopf"><h2 id="ei-kopf">Erster Start</h2>${nr ? `<p class="hinweis">Schritt ${nr} von ${folge.length}</p>` : ""}
    <div><b class="gross" id="ei-titel" tabindex="-1">${titel}</b>${felder}</div><div id="ei-fehler"></div>
    <div class="knoepfe">${nr > 0 ? `${weiter}<button ${kl("einrichtungZurueck")}>Zurück</button>` : ""}<button class="leise" ${kl("einrichtungUeberspringen")}>Überspringen</button></div></section>`;
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
  } catch (e) { einrichtungFehler(e.message); return; }
  darstellung(); await einrichtungEnde("Eingerichtet."); rundgangAngebot();
}
// Zeigt eine Meldung zu „Fertig“ im Schritt des Felds, um das es geht (Wochenstunden stehen in Schritt 3, nicht unter den Urlaubstagen),
// und markiert das Feld; ohne erkennbares Feld bleibt sie im gezeigten Schritt.
function einrichtungFehler(text) {
  const [, schritt, feld] = EI_FEHLER_FELD.find(([anfang]) => text.startsWith(anfang)) || [];
  if (schritt !== EINRICHTUNG.schritt && einrichtungSchritte().includes(schritt)) einrichtungZeigen(schritt);
  formFehler($("#ei-fehler"), text, {feld: feld && $(feld)});
}
// „Überspringen“: Es gelten die Regeln der gewählten Vorlage bzw. der Voreinstellung; gespeichert wird nur, dass die Einrichtung vorbei ist.
async function einrichtungUeberspringen() {
  try { await api("PUT", "/einrichtung", {stand: "uebersprungen"}); } catch (e) { toastFehler(e.message); return; }
  einrichtungEnde("");
}
// Übernimmt die gewählte Vorlage (Regeln für alle Tage, Darstellung des Profils) und geht zum nächsten Schritt der Einrichtung.
async function profilWaehlen(name) {
  let r;
  try { r = await api("POST", "/profile/wahl", {name}); } catch (e) { formFehler($("#ei-fehler"), e.message); return; }
  const x = r.profile.find(p => p.name === name) || {};
  if (x.akzent) speicher.s("ho_akzent", x.akzent);
  if (x.farbe) speicher.s("ho_farbe", x.farbe);
  KONFIG = (await api("GET", "/konfig")).werte; darstellung(); navAnpassen();
  EINRICHTUNG.pr = {...EINRICHTUNG.pr, gewaehlt: name}; EINRICHTUNG.werte = {};   // die Vorlage bringt eigene Werte mit
  einrichtungWeiter();
}
// Angebot nach der Einrichtung: kurzer Rundgang jetzt (Ja) oder nicht (Später schließt nur das Blatt; starten lässt er sich jederzeit in der Hilfe unter „Wie fange ich an?“).
function rundgangAngebot() {
  blatt(`<h3>Kurzer Rundgang?</h3><p class="hinweis">In ein paar kurzen Seiten zeigt die App, wo was steht.</p>
    <div class="knoepfe"><button class="prim" ${kl("rundgangStart")}>Ja</button><button ${kl("blattZu")}>Später</button></div>`);
}

// Symbol (Regler) am Knopf „Kacheln anpassen“; nur Bild, der Name steht im Text.
const ANPASSEN_SYMBOL = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>`;
// Zeichen vor einer Warnung der Übersicht (3.12, F-ST1): Dreieck mit „!“ als Form, „Achtung“ für den Screenreader; die Farbe ist nie das einzige Zeichen
const WARN_ZEICHEN = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5 2.5 20h19z"/><path d="M12 10v4.5M12 17.2v.3"/></svg><span class="sr">Achtung: </span>`;
// Zeilen unter den Kranktagen der Übersicht: woraus sie bestehen (Startwerte nur, wenn es welche gibt), „Krank im Dienst“ getrennt, weil es kein Kranktag ist.
// Eine Angabe je Zeile, keine bricht in sich um (am-stueck); nur zwischen „im Dienst“ und „(kein Kranktag)“ darf die schmale Kachel umbrechen.
const krankKachelZusatz = kr => [kr.krank_start > 0 ? `${kr.krank_start} aus Startwerten` : "", `${kr.attest} mit Attest`, `${kr.im_dienst} im Dienst`]
  .filter(Boolean).map(t => `<span class="am-stueck">${t}</span>`).join("<br>") + ' <span class="am-stueck">(kein Kranktag)</span>';
async function seiteStart() {
  const j = heute.getFullYear(), m = heute.getMonth() + 1;
  const [kwJ, kw] = kwJahr(heute);
  const [mo, ja, ho, wo, gz, kr, st, he, zt, jwAntwort, gv] = await Promise.all([api("GET", `/monat/${j}/${m}`), api("GET", `/jahr/${j}`), api("GET", `/horest/${j}/${m}`),
    api("GET", `/woche/${kwJ}/${kw}`), api("GET", "/gleitzeit"), api("GET", `/krank/${j}`), api("GET", "/stempel"), api("GET", "/heute"), zutunLaden(),
    api("GET", "/jahreswechsel").catch(() => null), gleitzeitVerlauf("woche", zeitHeuteIso(), true)]);   // nur Zusatz: ohne sie bleibt die Übersicht
  const stempelZiel = hashTeile()[1] === "stempel";                    // Ziel „Gehen nachtragen“ aus „Zu tun“
  window.nachher = () => { gzVerlaufEinpassen(); if (stempelZiel) { history.replaceState(history.state, "", "#/start"); stempelBlatt(); } };
  zutunZahl(zt);
  stempelDaten = st; stempelDaten.t0 = Date.now(); stempelAnzeige();
  const wahl = await einrichtungHtml();
  const qa = await quoteAmpelLaden(j, m);
  if (!wahl) gehenVergessenPruefen();                                 // nicht neben der Karte „Erster Start“ (die Grundlage sieht sie erst nach dem Zeichnen)
  const u = ja.urlaub, jp = ja.jahr_prognose;
  const tagHeute = wo.tage.find(x => x.datum === iso(j, m, heute.getDate())) || {datum: iso(j, m, heute.getDate())};   // Kachel und Karte Heute
  const langes = heute.toLocaleDateString("de-DE", {weekday: "long", day: "numeric", month: "long"});
  const warnungen = {};
  ZUTUN_IDS = (zt?.eintraege || []).map(e => e?.id);
  const quoteInKarte = ZUTUN_IDS.includes("quote-grenze") || ZUTUN_IDS.includes("quote-monat");   // die Prognose über der Grenze steht dann in der Karte
  if (!quoteInKarte && mitGrenze() && jp && jp.status === "ueber") warnungen.jahr = `<a href="#/horest" class="warn">${WARN_ZEICHEN}Jahres-Prognose über ${KONFIG.ho_grenze} % (${jp.quote_ende}): ${jp.buero_reicht_nicht ? "auch mit Büro an allen restlichen Tagen nicht mehr auszugleichen" : `Es fehlen noch ${tage(jp.noetig_tage)} Büro`}</a>`;
  const angebot = DEMO?.angebot ? `<div class="card kachel breit demo-angebot"><span>Noch keine Einträge</span><div><b class="gross">Erst einmal ausprobieren?</b><small>Die Demo füllt eine getrennte Beispiel-Datenbank mit zufälligen Beispieltagen, passend zu deinen Regeln. Deine echten Daten bleiben leer und unberührt.</small></div>
      <div class="knoepfe"><button class="prim" ${kl("demoStart")}>Mit Beispieldaten ausprobieren</button><a class="btn" href="#/einstellungen/arbeitszeit">Eigene Regeln einrichten</a></div></div>` : "";
  const stand = uebersichtLesen();
  const teile = {
    monat: einOrt() ? "" : `<div class="card kachel klickbar quote">${quoteKopfHtml(mo.summe.quote, mo.text.quote, mo.rot, kachelKopf(MONATE[m - 1], mitGrenze() ? "horest" : "monat"),
      `<small>${einheitFest(mo.text.ho)} HO<br>${einheitFest(mo.text.dst)} Büro${mitGrenze() ? `<br>noch ${einheitFest(ho.monat_block.rest)} HO möglich<br>(${einheitFest(tage(ho.monat_block.rest_tage))} und ${einheitFest(ho.monat_block.rest_tage_std)})` : ""}</small>`)}</div>`,
    jahr: einOrt() ? "" : `<div class="card kachel klickbar quote">${quoteKopfHtml(ja.gesamt.quote, ja.text.quote, ja.rot, kachelKopf(`Jahr ${j}`, "jahr"), `<small>${jp && mitGrenze() ? `Prognose Jahresende <b class="${jp.status === "ueber" ? "rot" : ""}">${einheitFest(jp.quote_ende)}</b><br>${jp.status === "ueber" ? `${einheitFest(jp.reserve + " Std.")} zu viel HO` : `${einheitFest(jp.reserve + " Std.")} (${einheitFest(tage(jp.reserve_tage))})<br>Luft bis ${KONFIG.ho_grenze}\u00a0%`}` : `${einheitFest(ja.text.ho)} HO<br>${einheitFest(ja.text.dst)} Büro`}</small>`, "", !!jp)}</div>`,
    warnung_jahr: warnungKarte(warnungen.jahr),
    zutun: zutunKarte(zt),                                                                         // enthält auch „Attest fehlt“ (früher eigene Warnung hier)
    jahreswechsel: jahreswechselKarte(jwAntwort),
    tag: heuteKachel(tagHeute, wo.tagesziel),
    woche: wocheKachel(wo, kw),
    gleitzeit: gleitzeitKachel(gz, gv),
    urlaub: urlaubKachel(u),
    freizeit: kachel("Freizeitkonto", `<span class="saldo ${saldoKlasse(gz.freizeit_min)}">${gz.freizeit}</span>`, FREIZEIT_TEXT, "einstellungen/person", "klein", "freizeit"),
    quote: quoteKachel(qa),
    krank: kachel("Krank " + j, einheitFest(tage(kr.kranktage)), krankKachelZusatz(kr), "krank", "klein", "krank"),
  };
  return `<div class="dash">
    ${wahl}
    ${angebot}
    ${heuteKarte(st, he, tagHeute, langes)}
    ${uebersichtReihe(teile, stand)}
    <div class="anordnen-link"><a href="#/einstellungen/aussehen/anordnen">${ANPASSEN_SYMBOL}Kacheln anpassen</a></div>
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
  // Etikett oben, jede Aussage in eigener Zeile (Entscheidung des Entwicklers 24.11.2026: daneben ließ es links Leerraum, „·“ brach mitten im Satz um)
  return `<div class="prognose ${p.status} oben"><span>Prognose</span><div><p>Bei diesem Tempo: <b class="${p.auto_rot ? "rot" : ""}">${p.auto_quote}</b></p><p>${satz}</p></div></div>`;
}

// Jahres-Prognose als Aufklapp-Feld (für den Monat); der Zustand „offen“ bleibt nach dem Neuzeichnen erhalten.
function jahresPrognoseAufklapp(p) {
  if (!p) return "";
  return `<details class="jp-auf"${jpOffen ? " open" : ""}><summary><span class="am-stueck">Jahres-Prognose ${p.jahr}</span><b class="${p.status === "ueber" ? "rot" : ""}">${p.quote_ende}</b></summary>${jahresPrognoseHtml(p)}</details>`;
}
// ---- Monat
async function seiteMonat() {
  const d = zeitAnkommen();
  const [m, verlauf] = await Promise.all([api("GET", `/monat/${jahr}/${monat}`), gleitzeitVerlauf("monat", d)]);   // Verlauf: letzte 3 Monate (Wunsch 25.11.2026)
  // Der Verlauf ist ein eigenes Feld im Raster, nicht Teil der klebenden Kennzahlen-Spalte: mit ihm passte sie bei 1920 × 900 nicht mehr ins Fenster
  const qa = await quoteAmpelLaden(jahr, monat);
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
    html += tagZeileHtml(z, heuteIso, saldoKlasse, false, true);
  }
  wocheZu();
  window.monatDaten = m; window.famAktiv = m.familientage_aktiv;
  window.nachher = () => {
    zeitSpalte(); zeitTagSprung(); monatKlebt(); gzVerlaufEinpassen();
    if (window.scrollHeute) { window.scrollHeute = false; const h = document.querySelector(".tag.heute, .kz.heute"); if (h) h.scrollIntoView({block: "center", behavior: "smooth"}); else window.scrollTo({top: 0, behavior: "smooth"}); }
  };
  const rot = m.rot, q = s.quote;
  const ansicht = speicher.l("ho_monat_ansicht", "kalender");
  const umschalter = segHtml([["kalender", "Raster"], ["liste", "Liste"]], ansicht, {klasse: "segmitte", label: "Ansicht", klick: "monatAnsicht"});
  const bewertung = monatBewertung(s, rot), pdf = `api/monat/${jahr}/${monat}.pdf`;
  return `${kopfHtml("monat", `${m.name} ${m.jahr}`, "m-kal", d)}
    <div class="monat-grid"><div class="rechts">${zeitLeerHtml(m.tage)}${umschalter}<div class="card">${ansicht === "kalender" ? rasterHtml(m, heuteIso) : html}</div></div>
    <div class="links"><div class="card"><h2>Monatsübersicht</h2>${quoteKopfHtml(q, t.quote, rot, `<b>${m.name}</b>`, `<span>${einOrt() ? "" : `${t.ho}\u00a0HO · ${t.dst}\u00a0Büro<br>`}Ist-Zeit ${t.ist}${auffuellZeile(m)}</span>`,
      mitGrenze() ? `<span class="chip ${rot ? "rot" : ""}">${letztesWortAmStueck(bewertung)}</span>` : "", !einOrt())}${quoteAmpelHtml(qa)}${mitGrenze() ? prognoseHtml(m.monat_prognose) + jahresPrognoseAufklapp(m.jahr_prognose) : ""}
    <div class="raster">${einOrt() ? "" : `<div class="ho"><b>${s.ho_tage}</b><span>Tage HO</span></div><div class="ds"><b>${s.dst_tage}</b><span>Tage Büro</span></div>`}<div><b>${s.soll_tage}</b><span>Arbeitstage (Soll)</span></div>
    <div><b>${s.urlaub}</b><span>Urlaub</span></div><div${md("krank")}><b>${s.krank}</b><span>Krank</span></div><div${md("gleittage")}><b>${s.gleittage}</b><span>Gleittage</span></div></div>
    <div class="knoepfe monat-schnell">${linkAn(pdf) ? `<a class="btn prim pdf" href="${pdf}">Monats-PDF</a>` : ""}<button${md("stempel")} ${kl("stempelBlatt")}>Stempeluhr</button><button ${kl("heuteEintragen")}>Heute eintragen</button></div></div></div>${verlauf}</div>`;
}
// Letztes Wort am Stück: „80-%-Grenze“ brach sonst am Bindestrich um (375 px, große Schrift).
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
const rasterWas = z => [z.ho ? "Homeoffice " + z.ho : "", z.dst ? "Büro " + z.dst : "", z.art ? ARTEN[z.art] || z.art : "",
  z.feiertag ? "Feiertag " + z.feiertag : ""].filter(Boolean).join(", ") || "kein Eintrag";
// Monat als Raster (M1, design.md 3.17): je Tag ein Knopf (data-d) mit Tönung der Art (t-<art>), Buchstabe und Stunden mit Auffüllung.
function rasterHtml(m, heuteIso) {
  const vorne = (new Date(m.jahr, m.monat - 1, 1).getDay() + 6) % 7;
  const zellen = m.tage.map(z => {
    const a = rasterArt(z), k = z.ho && z.dst ? "H/B" : ART_K[a] || "", istHeute = z.datum === heuteIso;
    const klasse = ["kz", a ? "t-" + a : (z.frei ? "frei" : ""), istHeute ? "heute" : ""].filter(Boolean).join(" ");
    const name = `${z.wt} ${z.tag}. ${MONATE[m.monat - 1]}${istHeute ? ", heute" : ""}${z.frei ? ", frei" : ""}: ${rasterWas(z)}`;
    return `<div class="${klasse}" data-d="${z.datum}" aria-label="${esc(name)}"><b>${z.tag}</b>${k ? `<small class="art-k" aria-hidden="true">${k}</small>` : ""}${z.ist_soll_min ? `<small>${zeitText(z.ist_soll_min)}</small>` : ""}</div>`;
  });
  return `<div class="kal"><div class="kk" aria-hidden="true">${WT_KURZ.map(x => `<span>${x}</span>`).join("")}</div><div class="kg">${'<div class="kz leer"></div>'.repeat(vorne)}${zellen.join("")}</div></div>${legendeHtml(m.tage)}`;
}
// Legende des Rasters: nur Arten, die im Monat vorkommen, je mit Punkt, Buchstabe und Namen; leer ohne Einträge.
function legendeHtml(tage) {
  const arten = Object.keys(ART_K).filter(a => tage.some(z => rasterArt(z) === a));
  const punkte = arten.map(a => `<span><i class="p ${ORT_NAME[a] ? a : "a-" + a}" aria-hidden="true"></i><b>${ART_K[a]}</b> ${rasterName(a)}</span>`);
  return punkte.length ? `<div class="legende">${punkte.join("")}</div>` : "";
}
// ---- seiten/woche.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Wochenziel aus GET /api/woche (woche.wochenziel_balken im Kern): Balken Ist von Soll der ganzen Woche, in der laufenden Woche mit Marke
// „Soll bis heute“; den Wert dazu nennt nur der Text für den Screenreader (Zeile darunter seit 26.11.2026 weg). Ohne Soll in der Woche (Elternzeit, Urlaubswoche) nichts.
function wochenzielHtml(z, laufend) {
  if (!z || !(Number(z.soll_min) > 0)) return "";
  const prozent = Math.min(100, Math.max(0, Number(z.prozent) || 0)), marke = Math.min(100, Math.max(0, Number(z.marke) || 0));
  const bisHeute = laufend ? `Soll bis heute ${esc(z.soll_heute)}` : "", text = `${esc(z.ist)} von ${esc(z.soll)}`;
  return `<div class="wz" role="progressbar" aria-label="Ist der Woche" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${prozent}" aria-valuetext="${text}, ${prozent} %${bisHeute ? `, ${bisHeute}` : ""}">
      <i data-stil="width:${prozent}%"></i>${bisHeute ? `<b class="wz-marke" data-stil="left:${marke}%"></b>` : ""}</div>
    ${wertZeile(text, `${prozent} %`, "", "zeile klein")}`;
}
// ---- Woche: Karte der Woche, Gleitzeit-Verlauf, Tage (Tageskarte und Konten seit 26.11.2026 nur auf Tag, Übersicht und Einstellungen)
async function seiteWoche() {
  const d = zeitAnkommen(), [kj, kw] = kwJahr(isoZuDatum(d));
  const w = await api("GET", `/woche/${kj}/${kw}`), verlauf = await gleitzeitVerlauf("woche", d);   // letzte 3 Wochen (Wunsch 25.11.2026), das Jahr steht auf der Seite Jahr
  window.monatDaten = {tage: w.tage}; window.famAktiv = w.familientage_aktiv;
  window.nachher = hashTeile()[1] === "gleitzeit" ? () => { zeitSpalte(); zeitTagSprung(); gzVerlaufEinpassen(); wocheGleitzeitZeigen(d); } : () => { zeitSpalte(); zeitTagSprung(); gzVerlaufEinpassen(); };
  const heuteIso = zeitHeuteIso();
  const vorz = saldoKlasse;
  const zeilen = w.tage.map(z => tagZeileHtml(z, heuteIso, vorz)).join("");
  const zeitraumText = (von, bis) => `${von.slice(8)}.${von.slice(5, 7)}.${von.slice(0, 4) === bis.slice(0, 4) ? "" : von.slice(0, 4)} – ${bis.slice(8)}.${bis.slice(5, 7)}.${bis.slice(0, 4)}`;   // Jahr nur einmal, außer über den Jahreswechsel
  return `${kopfHtml("woche", `<span class="kw-nr">KW ${w.kw}</span> <span class="kw-zeit">${zeitraumText(w.von, w.bis)}</span>`, "w-kal", d)}
    ${zeitLeerHtml(w.tage)}
    <div class="card" id="woche-karte"><h2>${w.heute_in_woche ? "Diese Woche" : `Woche ${w.kw}`}</h2>${wochenzielHtml(w.wochenziel, w.heute_in_woche)}${wertZeile("Ist", zeitText(w.ist_soll_min))}${wertZeile("Soll der ganzen Woche", zeitText(w.soll_woche_min))}
      ${wertZeile("Saldo der Woche", zeitText(w.saldo_woche_min, true), `saldo ${vorz(w.saldo_woche_min)}`)}</div>
    ${verlauf}
    <div class="card">${zeilen}<p class="hinweis">Soll zählt an Arbeitstagen, außer bei Urlaub und Krank. Ein Gleittag bucht das Tagessoll vom Gleitzeit-Konto ab. Arbeit am Wochenende oder an Feiertagen zählt zum Freizeitkonto, nicht zur Gleitzeit. Abgebaut wird es mit der Art „Freizeitausgleich“. Den Stand beider Konten siehst und setzt du unter „Einstellungen › Person“.</p></div>`;
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
// Karte „HO-Spielraum“ für einen Monat oder das Jahr: oben der Quote-Ring wie auf Monat (gemeinsamer Kopf), darunter wie viel Homeoffice noch möglich ist, mit Erklärungen und Rechenweg.
// b: Block aus /api/horest (monat_block, jahr_block); p: Prognose desselben Zeitraums (monat_prognose, jahr_prognose) oder null.
function restKarte(b, id, p) {
  const ueber = b.ueberschritten_min > 0, g = KONFIG.ho_grenze;
  // Zeile mit Name, Wert und optional einem „?“-Hilfe-Knopf.
  const zeile = (name, wert, h, klasse = "") => `<div class="zeile"><span class="mit-hilfe">${name}${h ? hilfe(id + "-" + h[0], h[1]) : ""}</span><b class="${klasse}">${wert}</b></div>`;
  const kopf = quoteKopfHtml(b.quote_zahl, b.quote, b.rot, `<h2 id="rest-${id}-t"><span class="sr">Spielraum </span>${b.titel}</h2>`,
    `<span>${einOrt() ? "" : `${b.ho}\u00a0HO \u00b7 ${b.dst}\u00a0B\u00fcro<br>`}Ist-Zeit ${b.ist}${hilfe(id + "-quote", "Der Ring zeigt die Quote bis heute: HO-Zeit geteilt durch die ganze gearbeitete Zeit (HO + Büro), minutengenau.")}</span>`, "", !einOrt());
  return `<section class="card spiel" aria-labelledby="rest-${id}-t">${kopf}
    <div class="spiel-kern ${ueber ? "ueber" : b.rot ? "knapp" : ""}"><span class="mit-hilfe">${ueber ? "Über der Grenze um" : "Noch möglich im Homeoffice"}${hilfe(id + "-kern", ueber
      ? `So viel HO-Zeit ist schon mehr als ${g} % der Gesamtzeit. Mehr Tage im Büro senken die Quote wieder.`
      : `So viel HO-Zeit kannst du noch dazunehmen, ohne über ${g} % zu kommen, wenn du an den restlichen Tagen wie geplant (Soll) arbeitest.`)}</span>
      <b>${ueber ? b.ueberschritten : b.rest} Std.</b><small>${tageText(ueber ? b.ueber_tage : b.rest_tage, ueber ? b.ueber_tage_std : b.rest_tage_std)} (1 Tag = ${b.tag_laenge})</small>${!ueber && b.rot ? "<small>Die Quote liegt gerade über der Grenze. Der Wert gilt für den ganzen Monat und stimmt nur, wenn die Zeit aus „Büro noch nötig“ noch dazukommt.</small>" : ""}</div>
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
      <p class="hinweis">Soll-Tage sind deine Arbeitstage (${esc(String(KONFIG.arbeitstage).replace(/,/g, ", "))}, bei einem Abschnitt dessen Tage) ohne ${aufzaehlung(["Feiertage", "freie Tage", modulAn("urlaub") && "Urlaub", modulAn("gleittage") && "Gleittage", modulAn("krank") && "Krank"])}, im Stundenumfang deines Abschnitts (z. B. Teilzeit).</p></details></section>`;
}
// Seite „HO-Spielraum“: Karten für Monat und Jahr und die Jahres-Prognose.
async function seiteHoRest() {
  const r = await api("GET", `/horest/${jahr}/${monat}`);
  return `${kopfHtml("monat", `${MONATE[monat - 1]} ${jahr}`, "h-kal", `${jahr}-${pad(monat)}-01`, KOPF_SPIELRAUM)}
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
// Seite „Jahr“ (Jahresrückblick): eine Karte mit Ring, Summen und Säulen je Monat, darunter die Tabelle der Monate mit Jahres-PDF und der Gleitzeit-Verlauf (woche.js).
async function seiteJahr() {
  const [j, verlauf] = await Promise.all([api("GET", `/jahr/${jahr}`), gleitzeitVerlauf("jahr", jahr)]);
  window.nachher = gzVerlaufEinpassen;
  const start = j.gesamt.start ? `<p class="hinweis">Stand bis ${standBis(j.gesamt.start.ab)} (Startwerte)</p>` : "";
  // Eine Zeile der Jahrestabelle; mit Monat ist sie antippbar und öffnet den Monat. Vor Beginn der Erfassung steht statt der Werte (alle 0) der Satz, nicht nur Grau.
  const werte = (s, t, rot) => einOrt() ? `<td>${t.ist}</td>` : `<td class="${rot ? "rot" : ""}">${t.quote}${rot ? '<span class="sr"> über der Grenze</span>' : ""}</td><td>${t.ho}</td><td>${t.dst}</td><td class="t">${s.ho_tage}</td><td class="t">${s.dst_tage}</td>`;
  const zeile = (name, s, t, rot, m, vor) => `<tr class="${m ? "klick" : ""}${vor ? " vor-beginn" : ""}" ${m ? kl("monatOeffnen", m) : ""}><td>${name}</td>${vor ? `<td colspan="${einOrt() ? 3 : 7}">${VOR_BEGINN}</td>` : `${werte(s, t, rot)}<td class="u">${s.urlaub}</td><td>${s.soll_tage}</td>`}</tr>`;
  const kopf = ["Monat", ...(einOrt() ? ["Ist"] : ["Quote", "HO", "Büro", ["T<br>HO", ' class="t"'], ["T<br>Büro", ' class="t"']]), ["Url", ' class="u"'], "Soll"];
  const zeilen = j.monate.map(m => zeile(m.name.slice(0, 3), m.summe, m.text, m.rot, m.monat, m.vor_beginn)).join("") + startZeile(j.gesamt.start) + zeile("<b>Summe</b>", j.gesamt, j.text, j.rot, 0, false);
  const erklaerung = `<p class="hinweis">${einOrt() ? "Ist = gearbeitete Stunden." : 'HO und Büro = Stunden im Homeoffice und im Büro. <span class="t">T HO = Tage nur im Homeoffice, T Büro = Tage im Büro (auch mit HO am selben Tag).</span>'} Soll = Arbeitstage laut Abschnitt.</p>`;
  return karteMitTitel("jahr-t", `Jahresübersicht ${jahr}`, `${quoteKopfHtml(j.gesamt.quote, j.text.quote, j.rot, `<b>${jahr} gesamt</b>`, `<span>${einOrt() ? "" : `${j.text.ho} HO · ${j.text.dst} Büro<br>`}Ist-Zeit ${j.text.ist}</span>`, "", !einOrt())}${start}
    <div class="raster">${einOrt() ? "" : `<div class="ho"><b>${j.gesamt.ho_tage}</b><span>Tage HO</span></div><div class="ds"><b>${j.gesamt.dst_tage}</b><span>Tage Büro</span></div>`}<div><b>${j.gesamt.urlaub}</b><span>Urlaub</span></div><div${md("krank")}><b>${j.gesamt.krank}</b><span>Krank</span></div></div>
    ${einOrt() ? "" : jahrBalken(j)}`, {klasse: "jahr-karte"})
    + karteMitTitel("jahr-monate-t", `Monate ${jahr}`, tabelleHtml(kopf, zeilen, {klasse: "jahr-tab", label: `Monate ${jahr}`, huelle: "jahr-tbl", nach: erklaerung})
      + exportKnoepfe([["Jahres-PDF", `api/jahr/${jahr}.pdf`]], `Jahresrückblick ${jahr}`)) + verlauf;
}

// Zeile „Startwerte bis TT.MM.JJJJ“ vor der Summe (R6): Die Jahressumme enthält die Startwerte, ohne diese Zeile ginge sie nicht auf.
// Startwerte haben keine Tage und kein Soll, darum „–“ statt Quote, Tagen und Soll; die Tage-Zellen tragen wie die Spalten T HO/T Büro die Klasse t, Url die Klasse u (große Schrift, jahr.css). Ohne Startwerte leer.
function startZeile(st) {
  if (!st) return "";
  const name = `Startwerte bis ${standBis(st.ab)}`, OHNE = "<td>–</td>", OHNE_T = '<td class="t">–</td>';
  return einOrt() ? `<tr class="start-zeile"><td>${name}</td><td>${zeitText(st.ho_min + st.dst_min)}</td><td>${st.urlaub}</td>${OHNE}</tr>`
    : `<tr class="start-zeile"><td colspan="2">${name}</td><td>${zeitText(st.ho_min)}</td><td>${zeitText(st.dst_min)}</td>${OHNE_T}${OHNE_T}<td class="u">${st.urlaub}</td>${OHNE}</tr>`;
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
  window.nachher = urlaubBinden;
  if (!modulAn("planung")) return html;
  window.nachher = async () => {
    urlaubBinden();
    const mein = zeigenZaehler, ziel = $("#planung");
    try {
      const h = await seitePlanung(), binden = window.nachher;
      window.nachher = null;
      if (mein !== zeigenZaehler || !ziel.isConnected) return;
      ziel.innerHTML = h; beschriften(ziel); if (binden) binden();
      if (hashTeile()[1] === "planung") ziel.scrollIntoView();
    } catch (e) { if (ziel.isConnected) ziel.innerHTML = meldung(e.message); }
  };
  return html + `<section id="planung" aria-label="Urlaubsplanung"><div class="lade" role="status" aria-busy="true" aria-label="Urlaubsplanung lädt …"></div></section>`;
}
// Zeile „davon Zusatzurlaub“ (Regel Zusatzurlaub, GET /urlaub/<J> Feld zusatzurlaub; schon in anspruch enthalten), leer ohne Zusatzurlaub; z: Zeilen-Funktion der Karte.
const zusatzZeile = (u, z) => u.zusatzurlaub ? z("davon Zusatzurlaub", komma(u.zusatzurlaub)) : "";
// Frist des Resturlaubs aus dem Vorjahr (GET /urlaub/<J>, Felder frist*): vor der Frist „Resturlaub <Vorjahr> bis TT.MM.“, danach angespart und verfallen.
// Der Server sagt mit frist_vorbei, ob der Stichtag vorbei ist (derselbe Tag wie für rest). Rückgabe: HTML-Zeilen mit Funktion z.
function fristZeilen(u, z) {
  if (!u.frist || !u.frist_offen) return "";
  const vorjahr = jahr - 1, bis = de(u.frist).slice(0, 6);
  if (!u.frist_vorbei) return z(`Resturlaub ${vorjahr} bis ${bis}`, komma(u.frist_offen));
  return (u.frist_angespart ? z(`Angespart aus ${vorjahr}`, komma(u.frist_angespart)) : "")
    + (u.frist_verfallen ? z(u.frist_sicher ? "Verfallen" : "Verfallen (voraussichtlich)", komma(u.frist_verfallen)) : "");
}
// Hinweis zur Frist: was nach dem Stichtag mit dem Resturlaub des Vorjahres geschieht.
function fristHinweis(u) {
  if (!u.frist) return "";
  const bis = de(u.frist).slice(0, 6), vorjahr = jahr - 1;
  if (u.frist_ansparen) return `<p class="hinweis">Resturlaub aus ${vorjahr} gilt bis ${bis}, danach spart die App ihn automatisch an (höchstens die Hälfte des Anspruchs ${vorjahr}${u.zusatzurlaub ? " ohne Zusatzurlaub" : ""}, höchstens 15 Tage), der Rest verfällt.</p>`;
  if (u.frist_sicher) return `<p class="hinweis">Resturlaub aus ${vorjahr} gilt bis ${bis}, danach verfällt er.</p>`;
  return `<p class="hinweis">Resturlaub aus ${vorjahr} gilt bis ${bis}, danach verfällt er voraussichtlich (nur, wenn dein Arbeitgeber vorher darauf hingewiesen hat).</p>`;
}
// Farbe von Rest und Verfügbar (eine Regel für beide Ansichten): im Minus rot, sonst ohne Farbe.
const restKlasse = n => n < 0 ? "rot" : "";
// Karten der Urlaub-Seite: einfache Ansicht mit Verbrauch und Rest, erweiterte mit Anspruch, Übertrag, angespartem Urlaub und freien Tagen.
async function urlaubKarten() {
  const u = await api("GET", `/urlaub/${jahr}`), bruecken = await brueckenKarten(u);
  const auto = k => k.automatisch ? ` <small>(${komma(k.automatisch)} automatisch, ab ${de(k.automatisch_ab)})</small>` : "";
  const konten = u.konten.map(k => `<div class="zeile"><span>aus ${k.herkunft}: ${tage(k.tage)}, genommen ${komma(k.genommen)}${auto(k)}${k.nutzbar ? "" : " <small>(in " + jahr + " nicht mehr nutzbar)</small>"}</span>
    <span><b>${komma(k.rest)}</b>${k.von_hand ? ` <button ${kl("kontoLoeschen", k.herkunft)} class="gef" aria-label="Konto aus ${k.herkunft} entfernen">✕</button>` : ""}</span></div>`).join("") || leerHtml("Noch kein angesparter Urlaub eingetragen.");
  window.urlaubDaten = u;
  const ansicht = speicher.l("ho_urlaub_ansicht", "einfach");
  const umschalter = segHtml([["einfach", "Einfach"], ["erweitert", "Erweitert"]], ansicht, {klasse: "segmitte", label: "Ansicht", klick: "urlaubAnsicht"});
  if (ansicht === "einfach") {
    return `${umschalter}<div class="gitter paar">${karteMitTitel("ur-tage-t", `Urlaubstage ${jahr}`, `${wertZeile("Gesamt", komma(u.anspruch + u.uebertrag))}${zusatzZeile(u, wertZeile)}
      <p class="hinweis">Gesamt = Jahresanspruch ${komma(u.anspruch)} + Übertrag ${komma(u.uebertrag)} aus ${jahr - 1}.</p>${wertZeile("Verbraucht", komma(u.genommen))}${fristZeilen(u, wertZeile)}${wertZeile("Verfügbar", komma(u.rest), restKlasse(u.rest))}`)}
      ${karteMitTitel("ur-gleit-t", `Gleittage ${jahr}`, `${wertZeile("Verbraucht", u.gleittage)}${wertZeile("Verfügbar", `${u.gleittage_rest} von ${u.gleittage_max}`, u.gleittage_rest === 0 ? "rot" : "")}`, {mehr: md("gleittage")})}
      ${u.familientage_aktiv ? karteMitTitel("ur-fam-t", `Familientage ${jahr}`, `${wertZeile("Verbraucht", u.familientage)}${wertZeile("Verfügbar", `${u.familientage_rest} von ${u.familientage_max}`, u.familientage_rest === 0 ? "rot" : "")}`, {mehr: md("familientage")}) : ""}</div>
      <p class="hinweis nach-karten">Anspruch, Übertrag und angesparten Urlaub änderst du unter „Erweitert“.</p>${bruecken}`;
  }
  const verlauf = u.verlauf.map(v => `<tr><td>${v.monat.slice(0, 3)}</td><td>${v.genommen || ""}</td><td${md("angespart")}>${v.angespart || ""}</td><td${md("gleittage")}>${v.gleittage || ""}</td><td>${komma(v.rest_nach)}</td></tr>`).join("");
  return `${umschalter}${karteMitTitel("ur-erh-t", `Erholungsurlaub ${jahr}`, `
    <div class="zeile"><span class="bez">Jahresanspruch<small>Tage pro Jahr</small></span><span class="eingabe">${stepper("u-anspruch", u.erholung, 1, 0, "Jahresanspruch in Tagen")}<button ${kl("anspruchSpeichern")}>Speichern</button></span></div>
    ${zusatzZeile(u, (t, v) => wertZeile("Zusatzurlaub<br><small>aus den Regeln, zählt zum Anspruch</small>", v))}
    <div class="zeile"><span class="bez">Übertrag aus ${jahr - 1}<small>${u.uebertrag_hand ? "von Hand" : "automatisch"}</small></span>
      <span class="eingabe">${stepper("u-uebertrag", u.uebertrag, 1, 0, "Resturlaub aus dem Vorjahr in Tagen")}<button ${kl("uebertragSpeichern")}>Speichern</button></span></div>
    ${u.uebertrag_hand ? `<div class="zeile"><span><small>Automatisch wären ${tage(u.uebertrag_auto)}</small></span><button ${kl("uebertragAuto")}>Automatisch</button></div>` : ""}
    ${wertZeile("genommen", komma(u.genommen))}${fristZeilen(u, wertZeile)}
    ${wertZeile(`Resturlaub (Anspruch + Übertrag − genommen${u.frist_vorbei ? " − nach der Frist weggefallen" : ""})`, komma(u.rest), restKlasse(u.rest))}
    <p class="hinweis">Der Resturlaub eines Jahres wird automatisch ins nächste Jahr übernommen (nie unter 0). Stimmt der Wert nicht, trage ihn hier von Hand ein. Die Folgejahre rechnen dann damit weiter.</p>${fristHinweis(u)}
    ${u.behalten_moeglich ? `<div class="zeile"><span>Resturlaub ${jahr - 1} behalten <small>(kein Verfall am ${u.frist ? de(u.frist).slice(0, 6) : "31.03."}, z. B. ohne Hinweis des Arbeitgebers)</small></span>
      <input type="checkbox" ${u.resturlaub_behalten ? "checked" : ""} id="u-behalten" aria-label="Resturlaub ${jahr - 1} behalten"></div>` : ""}
    ${wertZeile(`Gleittage genommen (höchstens ${u.gleittage_max} pro Jahr)`, `${u.gleittage} von ${u.gleittage_max}`, "", "zeile gr", "", md("gleittage"))}
    ${wertZeile("Angesparter Urlaub genommen", u.angespart_genommen_jahr, "", "zeile gr", "", md("angespart"))}`)}
  ${karteMitTitel("ur-fam-t", `Familientage ${jahr}`, `
    <div class="zeile"><span>Familientage nutzen <small>(10 % der Arbeitszeit gegen zusätzliche Familientage getauscht, separat beantragt)</small></span>
      <input type="checkbox" ${u.familientage_aktiv ? "checked" : ""} data-wechsel="familientageSchalten" aria-label="Familientage nutzen"></div>
    ${u.familientage_aktiv ? wertZeile("genommen", `${u.familientage} von ${u.familientage_max}`) : ""}
    <div id="fam-fehler"></div>
    <p class="hinweis">Standardmäßig aus. Ist es eingeschaltet, erscheint „Familientag“ im Tag unter „Mehr“ (höchstens ${u.familientage_max} pro Jahr, ohne Sollzeit wie Urlaub).</p>`, {mehr: md("familientage")})}
  ${karteMitTitel("ur-verlauf-t", `Verlauf ${jahr}`, tabelleHtml(["Monat", "Url.", ["Angespart", md("angespart")], ["Gleittag", md("gleittage")], "Rest"], verlauf, {label: `Urlaub je Monat ${jahr}`}))}
  ${karteMitTitel("ur-konten-t", "Angesparter Urlaub (Konten)", `${konten}
    <div class="reihe"><div><label for="k-jahr">Herkunftsjahr</label>${stepper("k-jahr", jahr - 1, 1, 2000)}</div><div><label for="k-tage">Tage (max. 15)</label>${stepper("k-tage", 0, 1, 0)}</div></div>
    <div id="k-fehler"></div><div class="knoepfe"><button class="prim" ${kl("kontoSpeichern")}>Konto speichern</button></div>
    <p class="hinweis">Je Herkunftsjahr höchstens 15 Tage, nutzbar im Herkunftsjahr und in den drei Folgejahren. Trägst du einen Tag „Angesparter Urlaub“ ein, schlägt die App das älteste Konto vor.</p>`, {mehr: md("angespart")})}
  ${karteMitTitel("ur-frei-t", "Freie Tage", `<p class="hinweis">Freie Tage wie Brückentage legst du unter Einstellungen bei den Feiertagen an. Sie zählen wie Feiertage und senken die Soll-Arbeitstage.</p>
    <div class="knoepfe"><a class="btn" href="#/einstellungen/arbeitszeit/${jahr}">Zu den Feiertagen</a></div>`)}${bruecken}`;
}
// Jahre der Brückentage-Karten: alle Planungsjahre, wenn das gezeigte Jahr dazugehört (ab November laufendes und Folgejahr), sonst nur das gezeigte.
const brueckenJahre = () => planungsjahre(heute).includes(jahr) ? planungsjahre(heute) : [jahr];
// Karten „Brückentage <J>“ je Jahr aus brueckenJahre; das gezeigte Jahr nimmt die Vorschläge aus u, ein anderes holt GET /urlaub/<J>.
async function brueckenKarten(u) {
  const jahre = brueckenJahre(), listen = await Promise.all(jahre.map(j => j === jahr ? u.brueckentage : api("GET", `/urlaub/${j}`).then(x => x.brueckentage)));
  window.brueckenDaten = Object.fromEntries(jahre.map((j, i) => [j, listen[i]]));
  return jahre.map(j => brueckenKarte(j, window.brueckenDaten[j])).join("");
}
// Karte „Brückentage <j>“: Vorschläge des Servers (GET /urlaub/<J>, Feld brueckentage, nur ab heute). Mit Urlaubsplanung öffnet ein Vorschlag deren Blatt mit diesen Tagen.
function brueckenKarte(j, liste) {
  const plan = modulAn("planung") && artAn("urlaub");
  const zeilen = liste.map((b, i) => plan
    ? `<button type="button" class="zeile bruecke" ${kl("brueckeEintragen", j, i)}>${esc(b.text)}</button>`
    : `<div class="zeile">${esc(b.text)}</div>`).join("") || leerHtml(`Keine Brückentage mehr in ${j}.`);
  return karteMitTitel(`ur-br-${j}-t`, `Brückentage ${j}`, `${zeilen}${plan && liste.length ? `<p class="hinweis">Tippe auf einen Vorschlag, um den Urlaub einzutragen.</p>` : ""}`);
}
// Öffnet das Blatt „Urlaub planen“ mit den Urlaubstagen des Brückentage-Vorschlags i im Jahr j.
function brueckeEintragen(j, i) {
  const tage = window.brueckenDaten[j][i].urlaub;
  planArt = "urlaub"; planVon = tage[0]; planBis = tage[tage.length - 1];
  return planBlattOeffnen();
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
// Abschnitt „Urlaubsplanung“ der Urlaub-Seite: Knopf zum Blatt und die geplanten Zeiträume mit Kalenderdatei (die verfügbaren Tage stehen schon darüber).
async function seitePlanung() {
  const [u, p] = await Promise.all([api("GET", `/urlaub/${planHeute().slice(0, 4)}`), api("GET", "/planung")]);
  planZeiten = p.zeitraeume; planFamilie = u.familientage_aktiv;
  window.nachher = () => { planKalenderLink(); document.querySelectorAll(".pl-neu").forEach(b => { b.onclick = planBlattOeffnen; }); };
  return karteMitTitel("ur-plan-t", "Geplant", `<div class="knoepfe"><button type="button" class="prim pl-neu">Urlaub planen</button></div>${planListe()}`);
}
// Liste der geplanten Zeiträume mit Haken für die Kalenderdatei. Arten abgeschalteter Module (z. B. Gleittage) zeigt sie nicht;
// die Nummer data-i bleibt die in planZeiten (Löschen, Kalenderdatei).
function planListe() {
  const sichtbar = planZeiten.map((x, i) => [x, i]).filter(([x]) => artAn(x.art));
  if (!sichtbar.length) return leerHtml("Noch nichts geplant.");
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
    <span class="feld-titel" id="pl-art-titel">Art</span>${segHtml(arten, planArt, {id: "pl-art", beschriftet: "pl-art-titel", klick: "planArtWaehlen"})}
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
        const zeilen = v.jahre.map(j => `${wertZeile(`${esc(j.bezeichnung)} ${j.jahr}`, `${j.vor} → ${j.nach}`, j.nach < 0 ? "rot" : "")}${j.warnung ? `<p class="hinweis rot">${esc(j.warnung)}</p>` : ""}`).join("");
        const sk = v.uebersprungen.length ? `<p class="hinweis">Übersprungen: ${v.uebersprungen.map(x => `${planDatum(x.datum)} (${esc(x.grund)})`).join(", ")}</p>` : "";
        const bereits = v.schon ? `<p class="hinweis">${anzahl(v.schon, "Tag ist", "Tage sind")} schon so eingetragen.</p>` : "";
        box.innerHTML = `${wertZeile("Im Zeitraum", anzahl(n, "Arbeitstag", "Arbeitstage"))}${v.neu.length ? zeilen : `<p class="hinweis">Keine neuen Tage im Zeitraum.</p>`}${sk}${bereits}`;
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
// Schaltet „Resturlaub behalten“ für das Jahr (Angestellte: kein Verfall des Übertrags am 31.03.).
const resturlaubBehalten = an => urlaubSetzen("#u-uebertrag", {resturlaub_behalten: an});
// Bindet den Schalter „Resturlaub behalten“ nach dem Zeichnen (nicht in der Tabelle WECHSEL von anlauf.js: er gehört nur zu dieser Seite).
function urlaubBinden() { const e = $("#u-behalten"); if (e) e.onchange = () => resturlaubBehalten(e.checked); }
// Wechselt die Ansicht der Urlaubsseite (einfach oder erweitert).
function urlaubAnsicht(a) { speicher.s("ho_urlaub_ansicht", a); zeigen(); }
// Speichert Anspruch, freie Tage und die übergebenen Änderungen des Urlaubs für das Jahr und zeichnet neu.
async function urlaubPut(extra) {
  const u = window.urlaubDaten;
  await api("PUT", "/urlaub", {jahr, anspruch: u.erholung, eigene_frei: u.eigene_frei, ...extra}); zeigen();
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
  return karteMitTitel("kr-vor-t", esc(vor[0].hinweis), `<div class="phase-tage">${vor.map(e => `<span class="aus">${esc(e.wt)} ${esc(e.datum)}<span class="sr">, zählt nicht</span></span>`).join("")}</div>
    <p class="hinweis">Sie zählen nicht mit. Kranktage vor Beginn gehören in den Startwert.</p>`, {klasse: "vor-beginn"});
}
// Kennzahl-Feld im Raster: Zahl oben, Text darunter, optional ein kurzer Zusatz.
const krankZahl = (wert, text, zusatz = "") => `<div><b>${wert}</b><span>${text}</span>${zusatz}</div>`;
// Seite „Krank“: Kennzahlen, Warnung bei fehlendem Attest, Phasen, Einträge vor Beginn der Erfassung.
async function seiteKrank() {
  const k = await api("GET", `/krank/${jahr}`);
  // Text und Farbe je Status einer Phase; jeder Wert aus bericht.KRANK_STATUS braucht einen Eintrag, sonst bricht die Seite.
  const STATUS = {attest: ["Attest abgegeben", "ok"], ohne: ["ohne Attest (bis 3 Tage)", "mut"], fehlt: ["Attest fehlt", "rot"], dienst: ["Krank im Dienst", "mut"], frei: ["zählt nicht (kein Arbeitstag)", "mut"]};
  const karten = k.phasen.map(p => krankPhase(p, STATUS[p.status])).join("") || leerHtml(`${k.liste.length ? "Seit Beginn der Erfassung keine Krankmeldungen." : `Keine Krankmeldungen in ${jahr}.`} Kranktage trägst du am Tag über „Art des Tages“ ein.`);
  const warn = k.attest_fehlt ? `<div class="card kachel warnungen"><span class="warn">${tage(k.attest_fehlt)} ohne Attest nach den ersten 3 Kranktagen. Bitte Attest-Datum eintragen.</span></div>` : "";
  return karteMitTitel("kr-zahlen-t", `Kranktage ${jahr}`, `<div class="raster">${krankZahl(k.kranktage, "Kranktage")}${k.krank_start > 0 ? krankZahl(k.krank_start, "aus Startwerten") : ""}${krankZahl(k.attest, "mit Attest")}
    ${krankZahl(k.ohne_attest, "ohne Attest")}${krankZahl(k.im_dienst, "Krank im Dienst", "<small>kein Kranktag</small>")}</div>`)
    + warn + karteMitTitel("kr-phasen-t", `Krankheitsphasen ${jahr}`, `<div class="phasen">${karten}</div>
    <p class="hinweis">Eine Phase sind zusammenhängende Kranktage. Wochenenden und freie Tage unterbrechen sie nicht. Bis 3 Tage gehen ohne Attest. Tippe auf eine Phase, um den Monat zu öffnen. Dort trägst du Kranktage über „Art des Tages“ ein. Das Attest-Datum gilt für die ganze Phase.</p>`)
    + krankVorBeginn(k.liste);
}
// ---- seiten/steuer.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Seite „Steuer“ (Homeoffice-Übersicht): Jahreswerte (Quote, Stunden, Tage) zur Information, Krank- und Elternzeit-Zeiträume, Startwerte (R8).
// Zeile mit Titel und Wert, beide maskiert.
const steuerZeile = (t, v) => wertZeile(esc(t), esc(v));
// Ein Zeitraum (Kranktage oder Elternzeit): Von bis Bis mit Zahl der Tage, Hinweis über die Jahresgrenze; bei Krank Attest-Text und Abgabe-Datum.
function steuerZeitraum(z) {
  const unter = [z.attest_datum ? `Attest abgegeben am ${esc(z.attest_datum)}` : "", esc(z.hinweis)].filter(Boolean).join(" · ");
  return `<div class="zeile zeitraum"><span>${esc(z.von)} bis ${esc(z.bis)} <span class="am-stueck">(${anzahl(z.tage, "Tag", "Tage")})</span>${unter ? `<br><small>${unter}</small>` : ""}</span>${z.attest_text ? `<b>${esc(z.attest_text)}</b>` : ""}</div>`;
}
// Karte einer Liste von Zeiträumen mit dem Jahr im Titel (id: Kennung des Titels); ohne Zeitraum „Keine.“.
const steuerZeitraeume = (id, titel, liste) => karteMitTitel(id, `${titel} ${jahr}`, liste.map(steuerZeitraum).join("") || leerHtml("Keine."));
// Block der Startwerte (nur im Jahr von „Erfassung gültig ab“): Stand bis zum Vortag, gleiche Zeilen wie bericht._start_zeilen.
function steuerStart(s) {
  const st = s.start;
  return !st ? "" : karteMitTitel("st-start-t", esc(`Stand bis ${s.stand_bis} (Startwerte)`), `
    ${steuerZeile("HO-Stunden", zeitText(st.ho_min))}${steuerZeile("Büro-Stunden", zeitText(st.dst_min))}${steuerZeile("Urlaubstage", st.urlaub)}
    ${steuerZeile("Gleittage", st.gleittage)}${steuerZeile("Kranktage", st.krank)}${modulAn("kind_krank") ? steuerZeile("Kind krank (Tage)", st.kind_krank) : ""}`);
}
// Seite „Steuer“ des gewählten Jahres; Sonderurlaub und Kind krank nur mit eingeschaltetem Modul, „davon vor Beginn der Erfassung“ nur bei Startwert > 0 (wie die Exporte). Formate wie auf der Seite Export (exportKnoepfe, Format-Module);
// ist keines erlaubt, fehlt die Karte „Übersicht herunterladen“.
async function seiteSteuer() {
  const s = await api("GET", `/steuer/${jahr}`);
  const knoepfe = exportKnoepfe(FORMATE_UEBERSICHT.map(([n, e]) => [n, `api/steuer/${jahr}.${e}`]), `Homeoffice-Übersicht ${jahr}`);
  // Hervorgehobener Wert mit Titel und Zusatztext.
  const kern = (titel, wert, klein) => `<div class="spiel-kern"><span>${titel}</span><b>${esc(wert)}</b><small>${klein}</small></div>`;
  return `<div class="gitter paar">${karteMitTitel("st-ho-t", `Homeoffice ${jahr}`, `
      ${kern("HO-Quote im Jahr", s.quote, `${esc(s.ho_stunden)}\u00a0Std. Homeoffice<br>${esc(s.dst_stunden)}\u00a0Std. Büro`)}
      ${steuerZeile("Tage im Homeoffice (nur HO)", s.ho_tage)}${steuerZeile("Tage im Büro (auch mit HO am selben Tag)", s.dst_tage)}
      ${steuerZeile("HO-Stunden", s.ho_stunden)}${steuerZeile("Büro-Stunden", s.dst_stunden)}`, {klasse: "spiel"})}
    ${karteMitTitel("st-abw-t", `Abwesenheit ${jahr}`, `
      ${kern("Urlaubstage", s.urlaub, `Erholungsurlaub · dazu ${anzahl(s.gleittage, "Gleittag", "Gleittage")}`)}
      ${steuerZeile("Angesparter Urlaub (Tage)", s.angespart)}${steuerZeile("Gleittage", s.gleittage)}
      ${modulAn("sonderurlaub") ? steuerZeile("Sonderurlaub (Tage)", s.sonderurlaub) : ""}
      ${steuerZeile("Kranktage (ohne „Krank im Dienst“)", s.krank)}${s.start?.krank > 0 ? steuerZeile("davon vor Beginn der Erfassung", s.start.krank) : ""}${steuerZeile("davon mit Attest", s.krank_attest)}
      ${modulAn("kind_krank") ? steuerZeile("Kind krank (Tage)", s.kind_krank) : ""}
      ${steuerZeile("Krank im Dienst (nur aufgeführt)", s.krank_dienst)}${steuerZeile("Tage in Elternzeit", s.elternzeit_tage)}`, {klasse: "spiel"})}</div>
    ${steuerStart(s)}
    ${knoepfe ? karteMitTitel("st-laden-t", `Übersicht ${jahr} herunterladen`, knoepfe) : ""}
    ${steuerZeitraeume("st-krank-t", "Kranktage", s.krank_zeitraeume)}${steuerZeitraeume("st-ez-t", "Elternzeit", s.elternzeit_zeitraeume)}`;
}
// ---- seiten/export.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Seite „Export“ (M5): erste Karte „Teilen statt Herunterladen“, dann die Karte „Zeitraum“ mit der Wahl für alle Karten, je Export eine Karte mit Vorschau und Format-Knöpfen.
const EXPORT_VORSCHAU = 5;                                       // Zeilen der Vorschau je Karte
// Felder in exportWahl, die „Heute“ eines Felds zurücksetzt: Monat (j, m) und Jahr der Homeoffice-Übersicht und des Kalenders (nj).
const EXPORT_HEUTE = {monat: ["j", "m"], nj: ["nj"]};
const FORMATE_MONAT = [["PDF", "pdf"], ["Excel", "xlsx"], ["CSV", "csv"]];
const KALENDER_OHNE = ["", "krank_dienst"];                    // Arten ohne Termin im Kalender (export.ICS_ARTEN)
// Speichert den Schalter „Teilen statt Herunterladen“.
function teilenSchalten(an) { try { localStorage.setItem(EIGEN + "ho_teilen", an ? "1" : "0"); } catch (e) {} }
// Übernimmt den gewählten Monat („JJJJ-M“) in die Auswahl der Export-Seite und zeichnet neu.
function exportMonatWaehlen(w) { const [j, m] = w.split("-").map(Number); if (j && m) { exportWahl.j = j; exportWahl.m = m; zeigen(); } }
// Übernimmt das gewählte Jahr (Homeoffice-Übersicht und Kalender).
function exportJahrWaehlen(w) { exportWahl.nj = +w; zeigen(); }
// „Heute“ eines Felds: setzt nur dessen Wahl zurück (feld aus EXPORT_HEUTE), ohne feld alle; seiteExport füllt sie mit heute.
function exportHeute(feld) { if (exportWahl) (EXPORT_HEUTE[feld] || Object.keys(exportWahl)).forEach(k => delete exportWahl[k]); zeigen(); }
// Wahl der Export-Seite: gültige Felder bleiben, fehlende oder ungültige werden heute (sonst der neueste Zeitraum mit Einträgen).
// Eingaben: alte Wahl (oder null), Monate „JJJJ-MM“ und Jahre mit Einträgen (neueste zuerst). Rückgabe {j, m, nj}.
function exportWahlPruefen(w, mit, jahre) {
  const hm = `${heute.getFullYear()}-${pad(heute.getMonth() + 1)}`, vm = mit.includes(hm) ? hm : mit[0];
  const vj = jahre.includes(heute.getFullYear()) ? heute.getFullYear() : jahre[0], alt = w || {}, monatOk = mit.includes(`${alt.j}-${pad(alt.m)}`);
  return {j: monatOk ? alt.j : +vm.slice(0, 4), m: monatOk ? alt.m : +vm.slice(5), nj: jahre.includes(alt.nj) ? alt.nj : vj};
}
// Vorschau als Tabelle (Baustein tabelleHtml): Kopf und Zeilen aus Texten, alles maskiert.
const vorschauTabelle = (kopf, zeilen) => tabelleHtml(kopf.map(esc), zeilen.map(z => `<tr>${z.map(w => `<td>${esc(w)}</td>`).join("")}</tr>`).join(""));
// Auswahl der Karte „Zeitraum“ mit Etikett und „Heute“ (feld aus EXPORT_HEUTE); wechsel ist der Name aus WECHSEL.
const exportAuswahl = (id, etikett, wechsel, feld, werte, gewaehlt, was) => auswahlHeute(id, etikett, werte, gewaehlt, wechsel, kl("exportHeute", feld), was);
// Karte eines Exports; ohne erlaubten Format-Knopf fehlt sie ganz.
function exportKarte(id, titel, vorschau, knoepfe) {
  return knoepfe ? karteMitTitel(`${id}-t`, esc(titel), `<p class="vorschau-titel">Vorschau</p>${vorschau}${knoepfe}`) : "";
}
// Vorschau Monat: die ersten Tage mit Eintrag; HO und Büro wie vom Server, Ist aus Minuten, an Tagen ohne Zeit die Art.
function monatVorschau(tage) {
  const zeilen = tage.filter(z => z.art || z.ho || z.dst).slice(0, EXPORT_VORSCHAU)
    .map(z => [`${z.tag}. ${z.wt}`, ...(einOrt() ? [] : [z.ho, z.dst]), z.ist_soll_min ? zeitText(z.ist_soll_min) : ARTEN[z.art] || ""]);
  return vorschauTabelle(einOrt() ? ["Tag", "Ist"] : ["Tag", "HO", "Büro", "Ist"], zeilen);
}
// Vorschau Homeoffice-Übersicht: die ersten Zeilen der Jahreswerte (wie auf dem Reiter Steuer).
function uebersichtVorschau(s) {
  return vorschauTabelle(["Angabe", "Wert"], [["HO-Quote im Jahr", s.quote], ["Tage im Homeoffice (nur HO)", s.ho_tage], ["Tage im Büro (auch mit HO am selben Tag)", s.dst_tage],
    ["HO-Stunden", s.ho_stunden], ["Büro-Stunden", s.dst_stunden]]);
}
// Vorschau Kalender: Zahl der Tage je Art im Jahr nj (nur Arten, die als Termin in den Kalender kommen).
function kalenderVorschau(tage, nj) {
  const zahl = {};
  tage.filter(t => +t.datum.slice(0, 4) === nj && !KALENDER_OHNE.includes(t.art)).forEach(t => { zahl[t.art] = (zahl[t.art] || 0) + 1; });
  return vorschauTabelle(["Art", "Tage"], Object.keys(ARTEN).filter(a => zahl[a]).slice(0, EXPORT_VORSCHAU).map(a => [ARTEN[a], zahl[a]]));
}
// Karte Kalender eines Jahres (nj): Vorschau und die Knöpfe „In Kalender übernehmen“, Jahr, alle Jahre.
function kalenderKarte(nj, tage) {
  return exportKarte("ex-kal", "Kalender (Abwesenheiten)", kalenderVorschau(tage, nj),
    exportKnoepfe([[`${nj} in Kalender übernehmen`, `api/kalender/${nj}.ics${ANSEHEN}`], [`${nj}`, `api/kalender/${nj}.ics`], ["Alle Jahre", "api/kalender.ics"]], "Kalender"));
}
// Vorschau „Alle erfassten Tage“: die ersten Zeilen der Datei (Datum, Art, Stunden aus Minuten).
function alleVorschau(tage) {
  return vorschauTabelle(["Datum", "Art", "Stunden"], tage.slice(0, EXPORT_VORSCHAU).map(t => [de(t.datum), ARTEN[t.art] || "", t.ho_minuten + t.dienststelle_minuten ? zeitText(t.ho_minuten + t.dienststelle_minuten) : ""]));
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
  if (!mit.length) return karteMitTitel("ex-leer-t", "Export", leerHtml("Noch keine Einträge. Sobald Tage erfasst sind, stehen hier die Auswertungen der Monate und Jahre mit Einträgen."));
  exportWahl = exportWahlPruefen(exportWahl, mit, jahre);
  const {j: ej, m: em, nj} = exportWahl, mo = `api/monat/${ej}/${em}`;
  const brauchtTage = linkAn("x.ics") || linkAn("x.csv");
  const [monatDaten, s, alle] = await Promise.all([api("GET", `/monat/${ej}/${em}`), modulAn("nachweis") && hoModus() !== "kein" ? api("GET", `/steuer/${nj}`) : null,
    brauchtTage ? api("GET", "/export.json") : {tage: []}]);
  const monatKarte = exportKarte("ex-monat", `Monat ${MONATE[em - 1]} ${ej}`, monatVorschau(monatDaten.tage), exportKnoepfe(FORMATE_MONAT.map(([n, e]) => [n, `${mo}.${e}`]), `Monat ${MONATE[em - 1]} ${ej}`));
  const jahrKarten = (s ? exportKarte("ex-jahr", `Homeoffice-Übersicht ${nj}`, uebersichtVorschau(s), exportKnoepfe(FORMATE_UEBERSICHT.map(([n, e]) => [n, `api/steuer/${nj}.${e}`]), `Homeoffice-Übersicht ${nj}`)) : "")
    + kalenderKarte(nj, alle.tage);
  // Ein Feld nur, wenn eine Karte darunter es braucht (Monat für die Karte Monat, Jahr für Homeoffice-Übersicht und Kalender).
  const wahl = (monatKarte ? exportAuswahl("ex-monat", "Monat (nur Monate mit Einträgen)", "exportMonatWaehlen", "monat", mit.map(x => [x, `${MONATE[+x.slice(5) - 1]} ${x.slice(0, 4)}`]), `${ej}-${pad(em)}`, "aktueller Monat") : "")
    + (jahrKarten ? exportAuswahl("ex-jahr", "Jahr (nur Jahre mit Einträgen)", "exportJahrWaehlen", "nj", jahre.map(x => [x, String(x)]), nj, "aktuelles Jahr") : "");
  return teilenKarte() + (wahl ? karteMitTitel("ex-wahl-t", "Zeitraum", wahl, {klasse: "export-wahl"}) : "") + monatKarte + jahrKarten
    + exportKarte("ex-alle", "Alle erfassten Tage", alleVorschau(alle.tage), exportKnoepfe([["CSV", "api/export.csv"]], "Alle Tage"));
}
// ---- seiten/sicherung.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Ladezeile, solange Wiederherstellen oder das Passwort der Handy-Sicherung auf eine laufende Synchronisierung warten (W1, bis zu 45 s)
const SICHERUNG_WARTEN = "Bitte warten. Synchronisiert die App gerade, kann das bis zu 45 Sekunden dauern.";
// Karte „Daten prüfen“ (funktionen.md 10): Zeichen und Name je Schwere, nie nur die Farbe
const PRUEFEN_SCHWERE = {fehler: ["✕", "Fehler"], hinweis: ["!", "Hinweis"]};
const PRUEFEN_LAEDT = "Prüfe …";
// Karte „App prüfen“ (Runde 2.7): Ergebnis des Prüfdatensatzes
const APP_PRUEFEN_OK = "Alle Werte stimmen.";
// Karte „Papierkorb“ (A7): geleerte Tage und gelöschte Einträge, 30 Tage wiederherstellbar; nur auf diesem Gerät
const PAPIERKORB_TEXT = "Geleerte Tage und gelöschte Einträge bleiben hier 30 Tage, danach löscht die App sie von selbst. Der Papierkorb gilt nur auf diesem Gerät.";
const PAPIERKORB_LEER = "Der Papierkorb ist leer.";
// Seite „Sicherung“: Daten prüfen, Datenbank herunterladen, aus einer Sicherungsdatei wiederherstellen, Papierkorb, (Handy, Web-App) die verschlüsselte Sicherung und App prüfen.
function seiteSicherung() {
  window.nachher = () => { sichInfo(); papierkorbLaden(); };
  return `<div class="card" id="pruefen-karte"><h2>Daten prüfen</h2>
      <p class="hinweis">Sucht in allen Tagen nach Unstimmigkeiten: Gehen vor Kommen, Urlaub und Arbeitszeit am selben Tag, Arbeitszeit an Feiertagen, mehr Urlaub als Anspruch. Die Prüfung ändert nichts.</p>
      <div class="knoepfe"><button id="pruefen-knopf" ${kl("datenPruefen")}>Daten prüfen</button></div>
      <div id="pruefen-ergebnis" role="status"></div></div>
    <div class="gitter paar"><div class="card"><h2>Sicherung</h2>
      <p class="hinweis">Die komplette Datenbank (alle Tage, Urlaub, Regeln, Einstellungen) als Datei. Damit lässt sich alles wiederherstellen.</p>
      <div class="knoepfe"><a class="btn prim" id="sich-dl" href="api/sicherung">Sicherung herunterladen</a></div>
      <div id="sich-info"></div></div>
    <div class="card"><h2>Wiederherstellen</h2>
      <p class="hinweis">Ersetzt alle Einträge und Einstellungen durch den Stand einer Sicherung. Der jetzige Stand wird vorher automatisch gesichert.</p>
      ${FERN ? `<p class="hinweis">Wiederherstellen geht nur am Rechner, in der App dort.</p>` : `<label for="wh-datei">Sicherungsdatei von diesem Gerät (.db)</label>
      <input type="file" id="wh-datei" accept=".db,application/octet-stream" hidden data-wechsel="dateiNameZeigen">
      <div class="knoepfe dateiwahl"><button type="button" ${kl("dateiWaehlen")}>Datei auswählen</button><span id="wh-name">keine Datei gewählt</span></div>
      <div class="knoepfe"><button class="gef" ${kl("wiederherstellen")}>Wiederherstellen …</button></div>`}
      <div id="wh-fehler"></div>
      <div id="wh-davor"></div>
      <p class="hinweis">Exporte (PDF, Excel, CSV) enthalten nur die Tage, keine Einstellungen. Sie lassen sich hier nicht einspielen.</p></div></div>
    <div class="card" id="papierkorb-karte"><h2>Papierkorb</h2>
      <p class="hinweis">${PAPIERKORB_TEXT}</p>
      <div id="papierkorb-liste" aria-live="polite"><div class="lade klein" role="status" aria-busy="true" aria-label="Lädt …"></div></div></div>
    <div id="handy-sich"></div>
    <div class="card" id="app-pruefen-karte"><h2>App prüfen</h2>
      <p class="hinweis">Rechnet einen festen Satz erfundener Tage durch und vergleicht mit Werten, die von Hand gerechnet sind. Deine Daten fasst die Prüfung nicht an.</p>
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
// Lädt den Papierkorb (GET /api/papierkorb) in die Karte, davor eine Meldung (html, schon maskiert). Die Knöpfe bindet die Karte selbst (data-korb),
// weil ihre Nummern aus der Antwort kommen.
async function papierkorbLaden(vorne = "") {
  let html;
  try {
    const r = await api("GET", "/papierkorb");
    html = r.eintraege.length ? r.eintraege.map(papierkorbZeile).join("") : leerHtml(PAPIERKORB_LEER);
  } catch (e) { html = meldung(e.message); }
  const box = $("#papierkorb-liste"); if (!box) return;            // die Seite kann inzwischen gewechselt sein
  box.innerHTML = vorne + html; beschriften(box);
  box.onclick = ev => { const b = ev.target.closest("button[data-korb]"); if (b) papierkorbZurueck(Number(b.dataset.korb), b); };
}
// Eine Zeile: Datum, was der Tag hatte (Art, Zeit je Ort, Zahl der Einträge, Notiz) und wann gelöscht; alle Werte maskiert.
function papierkorbZeile(e) {
  const zeit = m => m ? zeitText(m) : "";
  const was = [e.art && ARTEN[e.art], e.ho || e.dst ? orteText(zeit(e.ho), zeit(e.dst)) : "", e.eintraege > 1 ? `${e.eintraege} Einträge` : "", e.notiz]
    .filter(Boolean).join(" · ");
  return `<div class="zeile"><span class="bez">${esc(de(e.datum))}<small>${esc(was ? was + " · " : "")}gelöscht ${esc(zeitpunktText(e.zeit))}</small></span>
    <button type="button" data-korb="${Number(e.id)}" aria-label="${esc(de(e.datum))} wiederherstellen">Wiederherstellen</button></div>`;
}
// Holt einen Tag aus dem Papierkorb zurück. Ist er inzwischen neu belegt, meldet der Dienst das (409), und nichts ändert sich.
async function papierkorbZurueck(id, knopf) {
  knopf.disabled = true;
  try {
    const r = await api("POST", "/papierkorb/wiederherstellen", {id});
    seitenCacheLeeren(); toast(`${de(r.datum)} wiederhergestellt.`); papierkorbLaden();
  } catch (e) { papierkorbLaden(meldung(e.message)); }
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
      <p class="hinweis">${imBrowser ? "Die App erstellt eine verschlüsselte Kopie aller Daten. <b>Speichere die Datei danach außerhalb der App</b> (am iPhone „In Dateien sichern“, zum Beispiel in iCloud Drive): Deine Daten liegen sonst nur im Speicher dieses Browsers, und den kann das Gerät leeren." : "Die App legt eine verschlüsselte Kopie aller Daten in deinen Cloud-Speicher."} Lesen kann sie nur, wer das Passwort kennt.</p>
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
      <p class="hinweis"><b>Ohne dieses Passwort ist die Sicherung nicht lesbar.</b> Es wird nirgends gespeichert. Ein vergessenes Passwort kann niemand auslesen. Du kannst aber jederzeit ein neues festlegen; ältere Sicherungen öffnet weiter nur das alte. Bewahre es getrennt vom Handy auf, zum Beispiel in einem Passwort-Tresor.</p>
      <div class="zeile"><span>Passwort</span><b>${s.passwort ? "festgelegt" : "noch keines"}</b></div>
      <label for="hs-pw1">${s.passwort ? "Neues Passwort" : "Passwort"} (mindestens 8 Zeichen)</label><input type="password" id="hs-pw1" autocomplete="current-password">
      <label for="hs-pw2">Passwort wiederholen</label><input type="password" id="hs-pw2" autocomplete="current-password">
      <div class="knoepfe"><button ${kl("handyPasswort")}>${s.passwort ? "Passwort ändern" : "Passwort festlegen"}</button></div>
      ${s.passwort ? `<p class="hinweis">Nach einer Änderung gilt das neue Passwort für neue Sicherungen. Ältere Sicherungen öffnet weiter das alte Passwort.</p>` : ""}
      <div id="hs-pw-meldung" role="status"></div>
      <h3 class="unter">Aus Sicherung wiederherstellen</h3>
      <p class="hinweis">Ersetzt alle Einträge und Einstellungen. Der jetzige Stand wird vorher automatisch gesichert.</p>
      ${wahl ? `<label for="hs-datei">Sicherung</label><select id="hs-datei">${wahl}</select>
      <label for="hs-pw3">Passwort der Sicherung (nur nötig bei Sicherungen von einem anderen Gerät oder mit einem früheren Passwort)</label><input type="password" id="hs-pw3" autocomplete="current-password">
      <div class="knoepfe"><button class="gef" ${kl("handyWieder")}>Aus Sicherung wiederherstellen …</button></div>` : `<p class="hinweis">Im Ziel liegt noch keine Sicherung.</p>`}
      <div id="hs-wh-meldung"></div>
      ${imBrowser ? `<h3 class="unter">Aus einer Sicherungsdatei wiederherstellen</h3>
      <p class="hinweis">Für ein neues Gerät oder nachdem der Browser-Speicher geleert wurde: die gespeicherte Datei (.zsich) wählen und das Passwort eingeben.</p>
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
  if (a.length < 8) { formFehler(box, "Das Passwort braucht mindestens 8 Zeichen.", {feld: $("#hs-pw1")}); return; }
  if (a !== b) { formFehler(box, "Die beiden Eingaben sind verschieden.", {feld: $("#hs-pw2")}); return; }
  wartenZeigen(box);
  try { await handySicherung(await api("POST", "/handysicherung/passwort", {passwort: a})); syncKarte(); $("#hs-pw-meldung").innerHTML = `<p class="hinweis">Passwort gespeichert. Bitte jetzt an einem sicheren Ort notieren.</p>`; }
  catch (e) { formFehler(box, e.message); }
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
const SYNC_SERVER_WEG = "Der Server ist gerade nicht erreichbar. Bitte später noch einmal versuchen.";
const SYNC_IM_NETZ = "Nach dem Koppeln bleibt dieses Gerät Speicherort, aber nur in diesem Netz und ohne Anmeldung. In einem anderen Netz schließt er, zu Hause öffnet er wieder.";
// Hinweis auf Änderungen eines anderen Geräts, die der letzte Lauf nicht übernommen hat (U1); verspricht mit Absicht keine Abhilfe.
function uebersprungenText(n) {
  return `Beim Synchronisieren hat dieses Gerät ${n} ${n === 1 ? "Änderung" : "Änderungen"} eines anderen Geräts nicht übernommen. ${n === 1 ? "Sie passt" : "Sie passen"} nicht zum Stand dieses Geräts. Vergleiche im Zweifel deine Tage auf beiden Geräten.`;
}
// Seite „Synchronisieren“: die Karte zeichnet syncKarte (darstellung.js) in #sync-karte.
function seiteSync() {
  window.nachher = () => { syncKarte(); };
  return `<div id="sync-karte"></div>`;
}
// Schickt eine Sync-Aktion an die App und zeichnet bei Erfolg die Karte neu (liefert true). Bei einem Fehler wird die Karte nicht neu gezeichnet,
// damit getippte Eingaben (Token, Adresse, Code) stehen bleiben (liefert false). Meldung und Hinweis erscheinen im Feld feld der Karte des Themas
// (sonst stünden sie oben, außer Sicht), in der Führung (dort gibt es nur eines) und ohne feld in #sync-meldung. eingabe: Feld, um das es beim
// Speichern geht; ein Fehler steht dann daran und das Feld bekommt den Fokus (formFehler).
async function syncSenden(methode, pfad, werte, hinweis, feld, eingabe) {
  try {
    await syncKarte(await api(methode, pfad, werte), feld ? "" : hinweis);
    const box = feld && syncBox(feld);
    if (box) { box.innerHTML = `<p class="hinweis">${esc(hinweis)}</p>`; box.scrollIntoView({block: "nearest"}); }
    seitenCacheLeeren(); return true;
  }
  catch (e) {                                                         // Karte nicht neu zeichnen: getippte Eingaben (Token, Adresse, Code) blieben sonst nicht stehen
    const box = syncBox(feld);
    if (!box) { await syncKarte(); return false; }
    formFehler(box, e.message, {feld: eingabe && $(eingabe)}); return false;
  }
}
// Meldungsfeld der Karte eines Themas (feld), sonst das der Hauptkarte bzw. der Führung.
const syncBox = feld => (feld && $(feld)) || $("#sync-meldung");
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
  if (PLATTFORM === "browser") { speicher.s("ho_abgleich_auto", an ? "1" : "0"); toast(an ? "Automatisch synchronisieren: an" : "Automatisch synchronisieren: aus. Synchronisieren nur noch mit „Jetzt synchronisieren“."); return; }
  syncSenden("PUT", "/abgleich", {auto: an});
}
// Desktop: Gibt die Oberfläche für das Handy im eigenen Netz frei oder beendet die Freigabe (der alte Code gilt dann nicht mehr).
function syncOberflaeche(an) { syncSenden("PUT", "/abgleich", {oberflaeche: an}, an ? "Freigegeben. Jetzt den Code mit dem Handy scannen." : "Freigabe beendet. Der alte Code gilt nicht mehr.", "#sync-netz-meldung"); }
// Macht dieses Gerät zum Speicherort (Ablage der verschlüsselten Dateien für andere Geräte) oder beendet das.
function syncFreigabe(an) { return syncSenden("PUT", "/abgleich", {freigabe: an}, an ? "Dieses Gerät ist jetzt der Speicherort." : "Freigabe beendet.", "#sync-netz-meldung"); }
// Speichert die Adresse des eigenen Servers als Speicherort; mit Benutzername und Passwort meldet sich das Gerät dort an (das Passwort behält die App nicht).
function syncServer() {
  const benutzer = $("#sync-s-benutzer")?.value.trim() || "", passwort = $("#sync-s-passwort")?.value || "";
  return syncSenden("PUT", "/abgleich", {server: $("#sync-server").value.trim(), ...(benutzer || passwort ? {benutzer, passwort} : {})}, benutzer ? "Angemeldet und Adresse gespeichert." : "Adresse gespeichert.", "#sync-srv-meldung", "#sync-server");
}
// Meldet dieses Gerät beim eigenen Server ab (der Schlüssel wird hier gelöscht) und zeichnet die Karte neu.
async function syncServerAbmelden() {
  try { await api("POST", "/abgleich/server-abmelden", {}); await syncKarte(null, "Abgemeldet. Zum Synchronisieren mit dem Server neu anmelden."); }
  catch (e) { syncBox("#sync-srv-meldung").innerHTML = meldung(e.message); }
}
// Verbindet mit einem GitHub-Repo; Repo und Token gehen nur an die App dieses Geräts.
function syncGithub() {
  syncBox("#sync-gh-meldung").innerHTML = `<p class="hinweis">GitHub wird gefragt …</p>`;
  return syncSenden("PUT", "/abgleich", {github: {repo: $("#sync-gh-repo").value.trim(), token: $("#sync-gh-token").value.trim()}}, "Mit GitHub verbunden. Jetzt „Jetzt synchronisieren“ wählen.", "#sync-gh-meldung", "#sync-gh-repo");
}
// Trennt die Verbindung zu GitHub; die Dateien im Repo bleiben liegen.
function syncGithubTrennen() { syncSenden("PUT", "/abgleich", {github: null}, "Verbindung getrennt. Die Dateien im Repo bleiben liegen.", "#sync-gh-meldung"); }
// Nimmt ein anderes Gerät nach Rückfrage aus der Synchronisierung: Nur seine Sync-Datei wird gelöscht, die Einträge bleiben überall.
async function syncGeraetEntfernen(name, kurz) {
  if (!(await frage(`Gerät ${kurz} entfernen?\n\nNur seine Sync-Datei am Speicherort wird gelöscht. Deine Einträge bleiben auf allen Geräten. Synchronisiert das Gerät später wieder, ist es wieder dabei.`, "Entfernen", true))) return;
  const pw = $("#sync-pw") ? $("#sync-pw").value : "";
  if (PLATTFORM === "browser" && NETZ) {                                 // erst in der Ablage des Servers, sonst käme die Datei beim nächsten Sync wieder
    const fehler = await netzEntfernen(name, pw);
    if (fehler) { $("#sync-meldung").innerHTML = meldung(fehler); return; }
  }
  return syncSenden("POST", "/abgleich/entfernen", {name, passwort: pw}, `Gerät ${kurz} entfernt. Deine Einträge bleiben.`);
}
// Web-App vom eigenen Server: Löscht die Sync-Datei eines anderen Geräts in der Ablage des Servers, mit Nachweis wie NetzZiel.loeschen (den rechnet
// die App, der Schlüssel bleibt dort). Rückgabe: Fehlertext oder "" (gelöscht oder lag dort nicht mehr).
async function netzEntfernen(name, passwort) {
  try {
    const r = await fetch(ABLAGE, {cache: "no-store", signal: netzFrist()});
    if (!r.ok) return SYNC_SERVER_WEG;
    const ablage = await r.json(), d = (ablage.dateien || []).find(x => x.name === name);
    if (!d) return "";
    const nachweis = ablage.nachweis ? (await api("POST", "/abgleich/nachweis", {ablage: ablage.nachweis, passwort, vorher: d.summe, loeschen: name})).nachweis : "";
    const antwort = await fetch(ABLAGE + "/" + encodeURIComponent(name), {method: "DELETE", headers: {"Content-Type": "application/json"}, body: JSON.stringify({nachweis}), signal: netzFrist()});
    return antwort.ok || antwort.status === 404 ? "" : await ablageFehlerText(antwort);
  } catch (e) { return e.status ? e.message : SYNC_SERVER_WEG; }          // Meldung der App (z. B. Passwort) oder keine Verbindung
}
// Speichert den Cloud-Ordner für den Sync (Desktop).
function syncOrdner() { return syncSenden("PUT", "/abgleich", {ordner: $("#sync-ordner").value.trim()}, "Ordner gespeichert.", "#sync-ordner-meldung", "#sync-ordner"); }
// „Jetzt synchronisieren“: In der Web-App zuerst mit der Ablage des Servers, sonst über die App.
async function syncJetzt() {
  const pw = $("#sync-pw") ? $("#sync-pw").value : "";
  $("#sync-meldung").innerHTML = `<p class="hinweis">Synchronisiere …</p>`;
  if (PLATTFORM === "browser" && EIGEN) { const s = await netzSync(pw); if (s) { await syncKarte(s, s.letzter?.ok ? "Mit dem Server synchronisiert." : ""); return; } }
  syncSenden("POST", "/abgleich/jetzt", {passwort: pw}, "Synchronisiert.");
}
// QR-Code des anderen Geräts mit der Kamera lesen (Android-App). Das Bild bleibt im Gerät; gelesen wird nur der Code.
let scanStrom = null;
// Beendet das Lesen des QR-Codes: Kamera aus, Videofeld verborgen.
function scanStop() { if (scanStrom) { scanStrom.getTracks().forEach(t => t.stop()); scanStrom = null; } const v = $("#sync-video"); if (v) v.hidden = true; }
// Liest den QR-Code des anderen Geräts mit der Kamera (höchstens 60 Sekunden); bei einem Code mit 16 Zeichen wird sofort gekoppelt. Das Kamerabild bleibt im Gerät.
async function syncScannen() {
  const box = syncBox("#sync-kp-meldung");
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
function syncKoppeln() { syncSenden("POST", "/abgleich/koppeln", {}, "Code angezeigt. Jetzt am anderen Gerät eingeben.", "#sync-kp-meldung"); }
// Koppelt mit dem Code vom anderen Gerät (16 Zeichen). Synchronisiert das Gerät schon mit dem eigenen Server, antwortet der Dienst mit 409 und
// seinem Text als Frage; erst nach „Trotzdem koppeln“ geht dieselbe Anfrage mit bestaetigt: true noch einmal (der Code bleibt im Feld stehen).
async function syncKoppelnAnnehmen() {
  const code = $("#sync-code").value.trim();
  if (code.replace(/[^A-Za-z0-9]/g, "").length !== 16) { formFehler(syncBox("#sync-kp-meldung"), "Der Code hat 16 Zeichen.", {feld: $("#sync-code")}); return; }
  try { await api("POST", "/abgleich/koppeln/annehmen", {code}); }
  catch (e) {
    if (e.status !== SYNC_KONFLIKT || !(await frage(e.message, "Trotzdem koppeln", true))) { formFehler(syncBox("#sync-kp-meldung"), e.message, {feld: $("#sync-code")}); return; }
    return syncSchrittNach(SYNC_ERSTER_LAUF, () => syncSenden("POST", "/abgleich/koppeln/annehmen", {code, bestaetigt: true}, SYNC_GEKOPPELT, "#sync-kp-meldung"));
  }
  if (SYNC_SCHRITT) SYNC_SCHRITT = SYNC_ERSTER_LAUF;                    // geführt: Gekoppelt bringt Speicherort und Passwort mit
  await syncKarte(null, SYNC_GEKOPPELT); seitenCacheLeeren();
}
// Legt das Passwort für Sync und Sicherung fest (mindestens 8 Zeichen, beide Eingaben gleich).
function syncPasswort() {
  const a = $("#sync-pw1").value, b = $("#sync-pw2").value;
  if (a.length < 8) { formFehler($("#sync-meldung"), "Das Passwort braucht mindestens 8 Zeichen.", {feld: $("#sync-pw1")}); return; }
  if (a !== b) { formFehler($("#sync-meldung"), "Die beiden Eingaben sind verschieden.", {feld: $("#sync-pw2")}); return; }
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
    : `<label for="sync-ordner">Ordner zum Synchronisieren (ganzer Pfad)</label><input type="text" id="sync-ordner" autocomplete="off" spellcheck="false" value="${esc(s.ordner || "")}">`;
  if (SYNC_WEG === "server") return `<label for="sync-server">Adresse des eigenen Servers, so wie im Browser (auch mit IP und Port)</label><input type="url" id="sync-server" autocomplete="off" spellcheck="false" value="${esc(s.server || "")}">
    <label for="sync-s-benutzer">Benutzername (nur bei einem Server mit Anmeldung)</label><input type="text" id="sync-s-benutzer" autocomplete="username" autocapitalize="none" spellcheck="false">
    <label for="sync-s-passwort">Passwort beim Server (wird nicht gespeichert)</label><input type="password" id="sync-s-passwort" autocomplete="current-password">`;
  if (SYNC_WEG === "github") return `<p class="hinweis">Lege bei GitHub ein leeres, am besten privates Repo an und dazu ein Token nur für dieses Repo mit „Contents: Read and write“.</p>
    <label for="sync-gh-repo">Repo (konto/name)</label><input type="text" id="sync-gh-repo" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="konto/name">
    <label for="sync-gh-token">Token</label><input type="password" id="sync-gh-token" autocomplete="off">`;
  if (SYNC_WEG === "koppeln") return `<p class="hinweis">Am anderen Gerät unter „Synchronisieren“ „Code anzeigen“ wählen. ${SYNC_IM_NETZ}</p>
    <label for="sync-code">Code vom anderen Gerät</label><input type="text" id="sync-code" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX" maxlength="24">${s.plattform === "android" ? `<video id="sync-video" class="koppel-video" playsinline muted hidden></video>` : ""}`;
  return `<p class="hinweis">Die anderen Geräte tragen danach die Adresse dieses Geräts als eigenen Server ein. Erreichbar ist nur die Ablage der verschlüsselten Sync-Dateien, nicht die App. ${SYNC_IM_NETZ}</p>`;
}
// Inhalt eines Schritts: [Überschrift, Felder, Knopf „Weiter“ oder die Aktion des Schritts].
function syncSchrittInhalt(s) {
  const wege = SYNC_WEGE.filter(([, , , modul]) => !modul || modulAn(modul));
  if (SYNC_SCHRITT === 1) return ["Wo sollen die Daten liegen?", `<div class="profil-wahl">${wege.map(([k, name, satz]) => `<button type="button" ${kl("syncWegWaehlen", k)}><b>${name}</b><small>${satz}</small></button>`).join("")}</div>`, ""];
  if (SYNC_SCHRITT === 2) return [SYNC_WEGE.find(([k]) => k === SYNC_WEG)[1], syncAngabenHtml(s),
    SYNC_WEG === "koppeln" ? `<button class="prim" ${kl("syncKoppelnAnnehmen")}>Koppeln</button>${s.plattform === "android" ? `<button type="button" ${kl("syncScannen")}>QR-Code scannen</button>` : ""}` : `<button class="prim" ${kl("syncWeiter")}>Weiter</button>`];
  if (SYNC_SCHRITT === SYNC_PASSWORT_SCHRITT) return ["Sync-Passwort festlegen", `<label for="sync-pw1">Sync-Passwort (mindestens 8 Zeichen, auf allen Geräten dasselbe)</label><input type="password" id="sync-pw1" autocomplete="current-password">
    <label for="sync-pw2">Sync-Passwort wiederholen</label><input type="password" id="sync-pw2" autocomplete="current-password">
    <p class="hinweis"><b>Ohne dieses Passwort sind die Sync-Dateien nicht lesbar.</b> Es wird nirgends gespeichert. Bewahre es getrennt vom Gerät auf.</p>`, `<button class="prim" ${kl("syncWeiter")}>Weiter</button>`];
  const l = s.letzter;
  return ["Zum ersten Mal synchronisieren", `<p class="hinweis">Einträge, die nur auf einem Gerät stehen, kommen ohne Rückfrage auf alle anderen. Gefragt wirst du nur, wenn derselbe Tag auf zwei Geräten verschieden ist.</p>
    ${!l ? "" : l.ok ? `<p class="hinweis"><b>Synchronisiert.</b> ${l.uebernommen === 1 ? "Eine Änderung" : `${Number(l.uebernommen) || 0} Änderungen`} übernommen.</p>` : meldung(l.fehler)}`,
    `<button class="${l?.ok ? "" : "prim"}" ${kl("syncJetzt")}>Jetzt synchronisieren</button><button class="${l?.ok ? "prim" : ""}" ${kl("syncFertig")}>Fertig</button>`];
}
// Karte der Führung: ohne Schritt der Leerzustand mit „Einrichten“, sonst der Schritt mit Zähler, Zurück und seiner Aktion.
function syncEinrichtenKarte(s) {
  if (SYNC_SCHRITT === null) return `<div class="card leer"><h2>Synchronisieren</h2><p>Noch kein Gerät verbunden.</p>
    <p class="hinweis">Hält deine Geräte auf demselben Stand, verschlüsselt und ohne fremden Dienst.</p>
    <div class="knoepfe"><button class="prim" ${kl("syncEinrichten")}>Einrichten</button><button ${kl("syncAlleWege")}>Alle Einstellungen zeigen</button></div></div>`;
  if (SYNC_SCHRITT === SYNC_PASSWORT_SCHRITT && s.passwort) SYNC_SCHRITT = SYNC_ERSTER_LAUF;   // Passwort schon da (zum Beispiel vom Koppeln)
  const [titel, felder, aktion] = syncSchrittInhalt(s);
  return `<div class="card sync-schritt"><p class="hinweis">Synchronisieren einrichten · Schritt ${SYNC_SCHRITT} von ${SYNC_SCHRITTE}</p>
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
  if (!Object.hasOwn(EINST_TEILE, unter)) { history.replaceState(history.state, "", "#/einstellungen"); return einstListe(); }
  return EINST_TEILE[unter][0]();   // die Überschrift oben (#titel) trägt den Namen der Unterseite
}
// Liste der Unterseiten: je Zeile ein Link (Symbol, Name, Kurztext, „›“), darunter die Demo-Karte. Lädt nichts.
function einstListe() {
  const zeile = ([k, name]) => `<a href="#/einstellungen/${k}">${sym(EINST_TEILE[k][1])}<b>${name}<small>${EINST_TEILE[k][2]}</small></b><span aria-hidden="true">›</span></a>`;
  return `<nav class="card liste einst-liste" aria-label="Einstellungen">${UNTERSEITEN.einstellungen.map(zeile).join("")}</nav>${demoAngeboten(DEMO) ? demoKarte() : ""}`;
}
// Karte „Demo-Modus“: starten, solange die App leer ist; läuft die Demo, beenden oder neu würfeln.
function demoKarte() {
  return `<div class="card"><h2>Demo-Modus</h2>
    <p class="hinweis">${DEMO.aktiv ? "Die Demo ist an: Du siehst Beispieldaten in einer eigenen Datenbank. Eingaben landen nur dort." : "Zum Ausprobieren mit zufälligen Beispieltagen, passend zu deinen Regeln (Profil). Jede Demo sieht etwas anders aus. Deine echten Daten bleiben getrennt und unberührt. Die Regeln lassen sich in der Demo nicht ändern."}</p>
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
// Einstellungen, Unterseite „Arbeitszeit und Regeln“: Regeln, Zeitleiste der Abschnitte, eigene Feiertage, Dienstverhältnis, Kind krank, Gleitzeit-Grenzen, Kappung der Gleitzeit, Stempeluhr über Mitternacht.
const ABSCHNITT_ART = {normal: "Normal (Vollzeit)", teilzeit: "Teilzeit", elternzeit: "Elternzeit (0 h)", elternteilzeit: "Elternteilzeit", altersteilzeit: "Altersteilzeit (Arbeitsphase)", altersteilzeit_frei: "Altersteilzeit (Freistellung, 0 h)", pflegezeit: "Pflegezeit / Familienpflegezeit", sonderurlaub: "Sonderurlaub o. Bezüge (0 h)", mutterschutz: "Mutterschutz (0 h)"};
const ABSCHNITT_OHNE_STUNDEN = ["elternzeit", "altersteilzeit_frei", "sonderurlaub", "mutterschutz"];
const FEIERTAGE_STAND = "gesetzliche Feiertage der 16 Länder, geprüft am 16.11.2026 (zuletzt neu: Frauentag in Mecklenburg-Vorpommern seit 2023)";   // bei Änderungen in app/feiertage.py mitziehen
const WERKTAGE = ["Mo", "Di", "Mi", "Do", "Fr"];
// Wochentage als Auswahl-Kapseln (Gruppe id, benannt vom Label id-name); tage: gewählte Tage als „Mo,Di,…“.
const tageWahl = (id, tage) => `<div class="tage-wahl" id="${id}" role="group" aria-labelledby="${id}-name">${WERKTAGE.map(t => `<label><input type="checkbox" id="${id}-${t}" value="${t}" ${tage.split(",").includes(t) ? "checked" : ""}>${t}</label>`).join("")}</div>`;
// Felder zu den Textanfängen der Fehler des Dienstes (konfig.EINSTELLUNG_NAMEN und die Meldungen von konfig.pruefen) für formFehler; das erste passende gilt.
const REGELN_FEHLER_FELD = [["Bundesland", "#r-bl"], ["Homeoffice", "#r-hm"], ["HO-Grenze", "#r-ho"], ["Arbeitstage", "#r-tage-Mo"], ["Urlaubstage", "#r-ut"],
  ["Zusatzurlaub (Tage", "#r-zt"], ["Zusatzurlaub", "#r-za"], ["Gleittage", "#r-gt"], ["Familientage", "#r-ft"], ["Faschingsdienstag", "#r-fa"], ["Wochenstunden", "#r-ws"],
  ["Erinnerung an Sicherung", "#r-zs"], ["Hinweis ab Plus", "#r-zg"], ["Hinweis ab Minus", "#r-zm"], ["Kappung der Gleitzeit: Stichtag", "#r-ks"], ["Kappung der Gleitzeit", "#r-kp"],
  ["Grenze (Stunden)", "#r-kg"], ["Erste Kappung", "#r-ka"], ["Pausenregel", "#r-pa0"], ["Regelarbeitszeit", "#r-rb"], ["Tagesgrenze", "#r-tm"], ["Datum", "#r-ab"], ["Stempeluhr", "#r-sm"]];
const KIND_KRANK_FEHLER_FELD = [["Kind krank (Tage", "#kk-max"], ["Kind krank", "#kk-dienst"]];
const DIENST_FEHLER_FELD = [["Frist", "#dv-frist"], ["Rest nach", "#dv-ansparen"], ["Dienstverhältnis", "#dv-wahl"]];
const FEIERTAG_FEHLER_FELD = [["Bitte ein Datum", "#ft-datum"], ["Am ", "#ft-datum"], ["Eigene Feiertage: Name", "#ft-name"], ["Eigene Feiertage", "#ft-datum"]];
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
    + ` · Kappung ${kappungKurz(w)}` + zusatzText(w)
    + ` · 24.12. ${w.heiligabend_frei ? "frei" : "Arbeitstag"} · 31.12. ${w.silvester_frei ? "frei" : "Arbeitstag"} ${w.himmelfahrt_frei ? " · 15.8. Feiertag" : ""} · Fasching ${w.fasching_std === null ? "normal" : komma(w.fasching_std) + " Std."} · ${pausenText(w.pausen || [])}`;
}
// Zusatzurlaub als Teil des Satzes der Regeln (leer bei „keiner“ und bei Regeln ohne den Wert, z. B. aus einer älteren Fassung).
const zusatzText = w => !w.zusatzurlaub_art || w.zusatzurlaub_art === "keiner" ? "" : ` · Zusatzurlaub: ${w.zusatzurlaub_art === "eigen" ? anzahl(w.zusatzurlaub_tage, "Tag", "Tage") : ZUSATZURLAUB_ARTEN[w.zusatzurlaub_art]}`;
// Felder der Regel Zusatzurlaub (Art und eigener Wert) für die Karte „Regeln“; k: Regeln, die die Felder zeigen.
const zusatzFelder = k => `<div${md("urlaub")}><div class="reihe zusatzurlaub"><div><label for="r-za">Zusatzurlaub</label><select id="r-za">${Object.entries(ZUSATZURLAUB_ARTEN).map(([w, n]) => `<option value="${w}"${w === (k.zusatzurlaub_art || "keiner") ? " selected" : ""}>${n}</option>`).join("")}</select></div>
      <div><label for="r-zt">Eigener Wert (Tage pro Jahr)</label>${stepper("r-zt", k.zusatzurlaub_tage ?? 0, 1, 0)}</div></div>
      <p class="hinweis">Kommt zum Urlaub dazu. Schwerbehinderung: 5 Tage bei 5 Arbeitstagen pro Woche, sonst anteilig; beginnt sie im Jahr, 1/12 je vollem Monat, jeder Bruchteil zu deinen Gunsten aufgerundet. Der eigene Wert gilt nur bei „Eigener Wert“ (0 bis 30 Tage). Beginnt oder endet sie im Laufe des Jahres, speichere die Regel mit „Ab diesem Datum“.</p></div>`;
// Stufen der Pausenregel: die vorhandenen und eine leere zum Ergänzen (höchstens 4)
const pausenZeilen = stufen => [...stufen, null].slice(0, 4).map((st, i) => `<input id="r-pa${i}" inputmode="numeric" placeholder="${i ? "z. B. 09:00" : "06:00"}" value="${st ? hhmm(st[0]) : ""}" aria-label="Stufe ${i + 1}: Kommen bis Gehen länger als (hh:mm)"><input id="r-pp${i}" inputmode="numeric" placeholder="${i ? "z. B. 00:45" : "00:30"}" value="${st ? hhmm(st[1]) : ""}" aria-label="Stufe ${i + 1}: Pause insgesamt (hh:mm)">`).join("");
// Karte „Regeln“ mit allen Feldern (Sonderregeln offen, nicht aufklappbar) und Speichern ab einem Datum, dazu je mit eigenem Speichern die Karten
// Dienstverhältnis, Kind krank und Übernahme der Gleitzeit sowie die Liste der Gültigkeiten; u: Urlaub des Jahres (Dienstverhältnis, Kind krank);
// kj: Kappung des gewählten Jahres (GET /api/kappung/<J>).
function regelnKarte(kf, u, kj) {
  const k = KONFIG, v = kf.versionen;
  window.konfigStandard = kf.standard;
  const heuteIso = new Date().toISOString().slice(0, 10);
  const liste = v.map(x => `<div class="zeile"><span>${x.ab === "0001-01-01" ? "Von Anfang an" : "Ab " + de(x.ab)}<br><small>${regelnWerte(x.werte)}</small></span>${x.ab === "0001-01-01" ? "" : `<button class="gef" ${kl("regelnVersionWeg", String(x.ab))} aria-label="Version löschen">✕</button>`}</div>`).join("");
  return `<div class="card"><h2>Regeln</h2>
    <label for="r-bl">Bundesland (Feiertage)</label><select id="r-bl">${Object.entries(BUNDESLAENDER).map(([c, n]) => `<option value="${c}"${c === k.bundesland ? " selected" : ""}>${n}</option>`).join("")}</select><p class="hinweis">Die Feiertage werden berechnet (die beweglichen aus dem Osterdatum) und nicht aus einer Liste gelesen. Sie sind deshalb für jedes Jahr vorhanden, ohne Enddatum. Stand der Regeln: ${FEIERTAGE_STAND}. Führt ein Land einen Feiertag neu ein oder schafft einen ab, braucht es eine neue Version der App.</p>
    <div class="zeile"><span>24.12. (Heiligabend) ist frei</span><input type="checkbox" id="r-ha" aria-label="24.12. (Heiligabend) ist frei"${k.heiligabend_frei ? " checked" : ""}></div>
    <div class="zeile"><span>31.12. (Silvester) ist frei</span><input type="checkbox" id="r-sy" aria-label="31.12. (Silvester) ist frei"${k.silvester_frei ? " checked" : ""}></div>
    <div class="zeile"><span>15.8. (Mariä Himmelfahrt) ist Feiertag<br><small>nur Bayern: in Gemeinden mit überwiegend katholischer Bevölkerung</small></span><input type="checkbox" id="r-mh" aria-label="15.8. (Mariä Himmelfahrt) ist Feiertag"${k.himmelfahrt_frei ? " checked" : ""}></div>
    <div class="reihe"><div><label for="r-ws">Standard-Wochenstunden</label>${stepper("r-ws", String(k.wochenstunden), 0.5, 1)}</div>
      <div><label for="r-hm">Homeoffice</label><select id="r-hm" data-wechsel="hoModusWahl">${Object.entries(HO_MODI).map(([c, n]) => `<option value="${c}"${c === hoModus() ? " selected" : ""}>${n}</option>`).join("")}</select></div></div>
    <div id="r-ho-feld"${mitGrenze() ? "" : ' data-stil="display:none"'}><label for="r-ho">HO-Grenze (% der Gesamtzeit)</label>${stepper("r-ho", k.ho_grenze, 1, 0)}<p class="hinweis">Ohne Grenze oder ohne Homeoffice wählst du oben bei „Homeoffice“ den Modus. 100 % stellt auch auf „ohne Grenze“, 0 % auf „kein Homeoffice“.</p></div>
    <label id="r-tage-name">Standard-Arbeitstage</label>${tageWahl("r-tage", k.arbeitstage)}
    <label for="r-ut">Urlaubstage pro Jahr <small>(für Jahre ohne eigenen Wert unter „${weg("urlaub")} → Erweitert“)</small></label>${stepper("r-ut", k.urlaub_tage ?? 30, 1, 0)}
    ${zusatzFelder(k)}
    <div class="reihe"><div${md("gleittage")}><label for="r-gt">Gleittage pro Jahr (höchstens)</label>${stepper("r-gt", k.gleittage_max, 1, 0)}</div><div${md("familientage")}><label for="r-ft">Familientage pro Jahr (höchstens, falls eingeschaltet)</label>${stepper("r-ft", k.familientage_max, 1, 0)}</div></div>
    ${kappungTeil(k)}
    <div${md("zutun")}><h3 class="unter">Zu tun</h3>
      <label for="r-zs">Erinnerung an Sicherung nach … Tagen</label>${stepper("r-zs", zutunSicherungTage(k), 1, 1)}
      <p class="hinweis">Gelb nach so vielen Tagen ohne Sicherung, rot nach der doppelten Zeit, mindestens nach 30 Tagen.</p>
      <div class="reihe"><div><label for="r-zg">Hinweis ab Plus (Stunden)</label>${stepper("r-zg", zutunSaldoGrenze(k), 1, 0)}</div><div><label for="r-zm">Hinweis ab Minus (Stunden)</label>${stepper("r-zm", zutunSaldoMinus(k), 1, 0)}</div></div>
      <p class="hinweis">Gleitzeit-Konto: Ab diesen Stunden im Plus oder im Minus steht ein Hinweis unter „Zu tun“. 0 = kein Hinweis.</p></div>
    <label id="r-pausen-name" for="r-pa0">Pausenregel <small>(je Stufe hh:mm; leere Zeile zählt nicht)</small></label>
    <div class="pausen-stufen" id="r-pausen" role="group" aria-labelledby="r-pausen-name"><small>Kommen bis Gehen länger als</small><small>Pause insgesamt</small>${pausenZeilen(k.pausen || [])}</div>
    <p class="hinweis">Lücken zwischen Einträgen und Pausen von Hand zählen an, nur der Rest geht vom letzten Eintrag ab.</p>
    ${kappzeitTeil(k)}
    <div class="zeile"${md("stempel")}><span>Stempeluhr über Mitternacht erlauben<br><small>Aus: Ende spätestens 23:59 am Starttag</small></span><input type="checkbox" data-wechsel="mitternachtKappHinweis" id="r-sm" aria-label="Stempeluhr über Mitternacht erlauben"${k.stempel_mitternacht ? " checked" : ""}></div>
    <p class="hinweis"${md("stempel")}>Läuft die Uhr ohne Haken über 0 Uhr, fragt die App beim nächsten Öffnen „Gehen vergessen?“; gebucht wird nichts von selbst. Mit Haken zählt Gehen nach Mitternacht für den Tag des Kommens.</p>
    <div${md("stempel")}><p class="hinweis" id="r-sm-kapp" role="status"${k.stempel_mitternacht && k.regelzeit_an !== false ? "" : " hidden"}>${mitternachtKappText(hhmm((k.regelzeit || [360, 1200])[1]))}</p></div>
    <label for="r-fa">Faschingsdienstag: Soll höchstens (Stunden, leer = normaler Tag)</label><input id="r-fa" inputmode="decimal" value="${k.fasching_std === null ? "" : komma(k.fasching_std)}">
    <label id="r-modus-name">Wann soll die Änderung gelten?</label>
    <div class="modus" role="radiogroup" aria-labelledby="r-modus-name">
      <label><input type="radio" name="r-modus" id="r-modus-heute" value="ab_heute" checked> Ab heute (bisherige Tage bleiben unverändert)</label>
      <label><input type="radio" name="r-modus" value="ab_datum"> Ab diesem Datum: <input type="date" id="r-ab" value="${heuteIso}" aria-label="Datum, ab dem die Änderung gilt"></label>
      <label><input type="radio" name="r-modus" value="rueckwirkend"> Rückwirkend für alle Zeiträume (ersetzt auch frühere Regeln)</label>
    </div>
    <div id="r-fehler"></div>
    <div class="knoepfe"><button class="prim" ${kl("regelnSpeichern")}>Regeln speichern</button><button ${kl("regelnStandard")}>Voreinstellung laden</button></div>
    <p class="hinweis">„Ab heute“ ändert nur künftige Tage. Gleitzeit-Konto und vergangene Auswertungen bleiben, wie sie sind. Bei „Rückwirkend“ oder einem Datum in der Vergangenheit ändern sich Soll und Feiertage auch für vergangene Tage. Trage danach den Gleitzeit-Stand unter „Person und Startwerte“ neu ein. Die HO-Grenze und die Höchstzahlen gelten für das Jahr, in dem du sie änderst, und für die folgenden.</p></div>
    <div class="card" id="dienst-karte"><h2>Dienstverhältnis</h2>
    <label for="dv-wahl">Dienstverhältnis (Frist für den Resturlaub, Kappung der Gleitzeit)</label><select id="dv-wahl" data-wechsel="dienstEigenWahl">${Object.entries(DIENSTVERHAELTNISSE).map(([w, n]) => `<option value="${w}"${w === u.dienstverhaeltnis ? " selected" : ""}>${n}</option>`).join("")}</select>
    <div id="dv-eigen"${u.dienstverhaeltnis === "eigen" ? "" : ' data-stil="display:none"'}><label for="dv-frist">Frist für den Resturlaub (TT.MM. im Folgejahr)</label><input id="dv-frist" inputmode="decimal" placeholder="31.03." value="${kappungTag(u.resturlaub_frist)}">
      <div class="zeile"${md("angespart")}><span>Rest nach der Frist ansparen<br><small>wie Beamte Bayern, sonst verfällt er</small></span><input type="checkbox" id="dv-ansparen" aria-label="Rest nach der Frist ansparen"${u.resturlaub_ansparen ? " checked" : ""}></div></div>
    <p class="hinweis">Beamte Bayern: Resturlaub bis 30.06., der Rest wird angespart. Angestellte und andere: bis 31.03. Eigene Frist (z. B. Beamte im Bund oder in anderen Ländern): Tag selbst wählen, danach verfällt der Rest oder wird angespart. Gilt ab 1.1. des Jahres.</p><div id="dv-fehler"></div>
    <div class="knoepfe"><button type="button" class="prim" id="dv-speichern">Dienstverhältnis ab ${jahr} speichern</button></div></div>
    <div class="card"${md("kind_krank")}><h2>Kind krank</h2>
      <div class="reihe kind-krank"><div><label for="kk-dienst">Vorgabe</label><select id="kk-dienst">${Object.entries(KIND_KRANK_DIENSTE).map(([w, n]) => `<option value="${w}"${w === u.kind_krank_dienst ? " selected" : ""}>${n}</option>`).join("")}</select></div>
        <div><label for="kk-max">Eigener Wert (Tage pro Jahr)</label>${stepper("kk-max", u.kind_krank_max, 1, 0)}</div></div>
      <p class="hinweis" id="kk-gilt">${kindKrankText(u)}</p><div id="kk-fehler"></div>
      <div class="knoepfe"><button type="button" class="prim" id="kk-speichern">Kind krank ab ${jahr} speichern</button></div></div>
    ${uebernahmeKarte(kj)}
    <div class="card"><h2>Gültigkeit der Regeln</h2>${liste}<p class="hinweis">Jede Zeile gilt ab ihrem Datum bis zur nächsten. Löschst du eine Zeile, gilt wieder die vorherige Regel.</p></div>`;
}
// Kappzeit (Auftrag vom 25.11.2026): Regelarbeitszeit Beginn–Ende und Tagesgrenze netto, je an/aus; gespeichert mit den anderen Regeln (gilt ab).
function kappzeitTeil(k) {
  const [beginn, ende] = k.regelzeit || [360, 1200];
  return `<h3 class="unter" id="kappzeit-regeln">Regelarbeitszeit und Tagesgrenze</h3>
    <div class="zeile"><span>Regelarbeitszeit<br><small>Zeit davor und danach verfällt als Kappzeit, auch mit Freigabe</small></span><input type="checkbox" id="r-rz" aria-label="Regelarbeitszeit" data-wechsel="mitternachtKappHinweis"${k.regelzeit_an !== false ? " checked" : ""}></div>
    <div class="reihe"><div><label for="r-rb">Beginn</label><input id="r-rb" inputmode="numeric" placeholder="06:00" value="${hhmm(beginn)}"></div><div><label for="r-re">Ende (einschließlich)</label><input id="r-re" inputmode="numeric" placeholder="20:00" value="${hhmm(ende)}" data-wechsel="mitternachtKappHinweis"></div></div>
    <div class="zeile"><span>Tagesgrenze<br><small>Arbeitszeit netto darüber verfällt ohne „Über 10 Stunden freigegeben“</small></span><input type="checkbox" id="r-tg" aria-label="Tagesgrenze"${k.tagesgrenze_an !== false ? " checked" : ""}></div>
    <label for="r-tm">Tagesgrenze (Stunden netto)</label><input id="r-tm" inputmode="numeric" placeholder="10:00" value="${hhmm(k.tagesgrenze_min || 600)}">`;
}
// Hinweis unter „Stempeluhr über Mitternacht erlauben“ (Entscheidung des Entwicklers vom 26.11.2026): mit Regelarbeitszeit kappt die App auch nachts ab deren Ende.
const mitternachtKappText = ende => `Mit Regelarbeitszeit verfällt Zeit nach ${ende} Uhr als Kappzeit, auch über Mitternacht. Regelarbeitszeit anpassen oder abschalten.`;
// Zeigt den Hinweis nur, solange beide Schalter an sind (so, wie sie gerade stehen), mit dem Ende aus dem Feld.
function mitternachtKappHinweis() {
  const h = $("#r-sm-kapp");
  if (!h) return;
  h.hidden = !($("#r-sm").checked && $("#r-rz").checked);
  h.textContent = mitternachtKappText($("#r-re").value);
}
// Werte der Kappzeit für PUT /konfig (Uhrzeiten hh:mm prüft der Dienst).
const kappzeitWerte = () => ({regelzeit_an: $("#r-rz").checked, regelzeit: [zeitNorm($("#r-rb").value), zeitNorm($("#r-re").value)],
  tagesgrenze_an: $("#r-tg").checked, tagesgrenze_min: minuten(zeitNorm($("#r-tm").value))});
// Trägt die Kappzeit der Regeln s in die Felder ein (Voreinstellung laden).
function kappzeitFelder(s) {
  $("#r-rz").checked = s.regelzeit_an !== false; $("#r-rb").value = hhmm(s.regelzeit[0]); $("#r-re").value = hhmm(s.regelzeit[1]);
  $("#r-tg").checked = s.tagesgrenze_an !== false; $("#r-tm").value = hhmm(s.tagesgrenze_min);
}
// Speichert die Regeln (für alle Jahre, ab heute oder ab einem Datum) beim Server und zeichnet neu.
async function regelnSpeichern() {
  const fa = $("#r-fa").value.trim(), modus = document.querySelector("input[name=r-modus]:checked").value;
  try {
    const r = await api("PUT", "/konfig", {modus, ab: $("#r-ab").value, werte: {bundesland: $("#r-bl").value, heiligabend_frei: $("#r-ha").checked, silvester_frei: $("#r-sy").checked, himmelfahrt_frei: $("#r-mh").checked, urlaub_tage: +$("#r-ut").value, zusatzurlaub_art: $("#r-za").value, zusatzurlaub_tage: +$("#r-zt").value,
      wochenstunden: $("#r-ws").value, arbeitstage: [...document.querySelectorAll("#r-tage input:checked")].map(e => e.value).join(","),
      fasching_std: fa === "" ? null : fa, ...hoRegel($("#r-hm").value, +$("#r-ho").value), gleittage_max: +$("#r-gt").value, familientage_max: +$("#r-ft").value,
      ...kappungWerte(), ...kappzeitWerte(), zutun_sicherung_tage: +$("#r-zs").value, zutun_saldo_grenze: +$("#r-zg").value, zutun_saldo_minus: +$("#r-zm").value, stempel_mitternacht: $("#r-sm").checked,
      pausen: [0, 1, 2, 3].filter(i => $(`#r-pa${i}`)).map(i => [zeitNorm($(`#r-pa${i}`).value), zeitNorm($(`#r-pp${i}`).value)]).filter(([a, b]) => a || b)}});
    KONFIG = r.werte; toast("Regeln gespeichert"); zeigen();
  } catch (e) { formFehler($("#r-fehler"), e.message, {felder: REGELN_FEHLER_FELD}); }
}
// Trägt die Voreinstellung in die Felder der Regeln ein (noch nicht gespeichert).
function regelnStandard() {
  const s = window.konfigStandard;
  $("#r-bl").value = s.bundesland; $("#r-ha").checked = s.heiligabend_frei; $("#r-sy").checked = s.silvester_frei; $("#r-mh").checked = s.himmelfahrt_frei; $("#r-ut").value = s.urlaub_tage; $("#r-za").value = s.zusatzurlaub_art; $("#r-zt").value = s.zusatzurlaub_tage; $("#r-ws").value = s.wochenstunden;
  document.querySelectorAll("#r-tage input").forEach(e => { e.checked = s.arbeitstage.split(",").includes(e.value); });
  $("#r-fa").value = s.fasching_std === null ? "" : komma(s.fasching_std); $("#r-ho").value = s.ho_grenze; $("#r-hm").value = s.ho_modus; hoModusWahl(s.ho_modus); $("#r-gt").value = s.gleittage_max; $("#r-ft").value = s.familientage_max;
  kappungFelder(s); kappzeitFelder(s); $("#r-zs").value = zutunSicherungTage(s); $("#r-zg").value = zutunSaldoGrenze(s); $("#r-zm").value = zutunSaldoMinus(s); $("#r-sm").checked = s.stempel_mitternacht; mitternachtKappHinweis();
  $("#r-pausen").innerHTML = `<small>Kommen bis Gehen länger als</small><small>Pause insgesamt</small>${pausenZeilen(s.pausen)}`;
  toast("Voreinstellung eingetragen, noch nicht gespeichert");
}
// Löscht die Regeln ab einem Datum, nach Rückfrage; dann gilt wieder die vorherige Regel.
async function regelnVersionWeg(ab) {
  if (!(await frage(`Regeln ab ${de(ab)} löschen?`, "Löschen", true))) return;
  try { KONFIG = (await api("DELETE", `/konfig/${ab}`)).werte; zeigen(); } catch (e) { toastFehler(e.message); }
}
// ---- Kind krank (N5): Vorgabe nach Gesetz und Jahr je Dienstverhältnis; die Zahlen kennt nur der Server (konfig.KIND_KRANK_VORGABE).
const KIND_KRANK_EIGEN = "eigen";                                // wie konfig.KIND_KRANK_EIGEN: dann gilt die eigene Zahl
// Satz unter der Wahl: das Limit im gewählten Jahr (aus GET /api/urlaub/<J>, sonst die Zahl tage der Eingabe); offen: Eingabe weicht vom Gespeicherten ab.
const kindKrankText = (u, tage = u.kind_krank_max, offen = false) => `Gilt ${u.jahr}: ${anzahl(tage, "Tag", "Tage")} „Kind krank“${offen ? " (noch nicht gespeichert)" : ""}. Die Vorgabe folgt dem Gesetz des Jahres; beim eigenen Wert gilt die Zahl daneben.`;
// Zieht den Satz unter der Wahl nach Vorgabe und Zahl im Formular nach (Text, kein HTML).
function kindKrankSatz() {
  const u = feiertagDaten.u, dienst = $("#kk-dienst").value, tage = +$("#kk-max").value;
  $("#kk-gilt").textContent = kindKrankText(u, tage, dienst !== u.kind_krank_dienst || tage !== u.kind_krank_max);
}
// Wechsel der Vorgabe: Das Feld zeigt die Tage der Vorgabe im gewählten Jahr (GET /api/urlaub/<J>, Feld kind_krank_vorgaben); „Eigener Wert“ lässt die Zahl stehen.
function kindKrankWahl() {
  const dienst = $("#kk-dienst").value;
  if (dienst !== KIND_KRANK_EIGEN) $("#kk-max").value = feiertagDaten.u.kind_krank_vorgaben[dienst];
  kindKrankSatz();
}
// Wer die Zahl ändert, wählt den eigenen Wert (so rechnet auch der Server, konfig._eigener_kind_krank_wert).
function kindKrankZahl() { $("#kk-dienst").value = KIND_KRANK_EIGEN; kindKrankSatz(); }
// Speichert Dienstverhältnis und eigenen Wert ab dem 1.1. des gewählten Jahres für alle folgenden Versionen; bei einem Fehler bleiben die Eingaben.
async function kindKrankSpeichern() {
  try {
    KONFIG = (await api("PUT", "/konfig", {modus: "ab_datum_folgend", ab: `${jahr}-01-01`, werte: {kind_krank_dienst: $("#kk-dienst").value, kind_krank_max: +$("#kk-max").value}})).werte;
    toast(`Kind krank ab ${jahr} gespeichert`); seitenCacheLeeren(); zeigen();
  } catch (e) { formFehler($("#kk-fehler"), e.message, {felder: KIND_KRANK_FEHLER_FELD}); }
}
// Zeigt Frist und Ansparen nur bei „Eigene Frist“ (Wahl im Feld Dienstverhältnis).
function dienstEigenWahl(v) { $("#dv-eigen").style.display = v === "eigen" ? "" : "none"; }
// Speichert das Dienstverhältnis (Frist des Resturlaubs) ab dem 1.1. des gewählten Jahres für alle folgenden Versionen, wie Kind krank;
// bei „Eigene Frist“ mit Tag (TT.MM. als MM-TT) und Ansparen. Die Frist liest die Regeln am 1.1. des Urlaubsjahres (bericht._frist_regel). Bei einem Fehler bleibt die Eingabe.
// Felder für PUT /konfig: das Dienstverhältnis, bei „Eigene Frist“ dazu resturlaub_frist und resturlaub_ansparen.
function dienstWerte() {
  const d = $("#dv-wahl").value;
  return d === "eigen" ? {dienstverhaeltnis: d, resturlaub_frist: kappungStichtag($("#dv-frist").value), resturlaub_ansparen: $("#dv-ansparen").checked} : {dienstverhaeltnis: d};
}
async function dienstverhaeltnisSpeichern() {
  try {
    KONFIG = (await api("PUT", "/konfig", {modus: "ab_datum_folgend", ab: `${jahr}-01-01`, werte: dienstWerte()})).werte;
    toast(`Dienstverhältnis ab ${jahr} gespeichert`); seitenCacheLeeren(); zeigen();
  } catch (e) { formFehler($("#dv-fehler"), e.message, {felder: DIENST_FEHLER_FELD}); }
}

// ---- Kappung der Gleitzeit (23.11.2026): Regel an/aus/nach Dienstverhältnis, Stichtag, Grenze; die genehmigte Übernahme je Jahr über PUT /api/kappung/<J>.
const KAPPUNG_MODI = {dienst: "Nach Dienstverhältnis", an: "An", aus: "Aus"};   // wie konfig.KAPPUNG_MODI
// Stichtag „TT.MM.“ zurück als „MM-TT“ der Regel (Hinweg: kappungTag); was sich nicht lesen lässt, geht leer an den Server (der meldet den Fehler).
// Nicht unverändert: „05-03“ wäre sonst still der 03.05. statt einer Meldung.
function kappungStichtag(t) { const m = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(t.trim()); return m ? `${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : ""; }
// Kurztext der Kappung für die Liste der Gültigkeiten (jede Version hat alle Schlüssel, konfig füllt sie mit STANDARD auf).
const kappungKurz = w => w.gleitzeit_kappung === "aus" ? "aus" : `${w.gleitzeit_kappung === "an" ? "an" : "nach Dienstverhältnis"} (${kappungTag(w.kappung_stichtag)}, ${zeitText(w.kappung_grenze_min)} Std.)`;
// Satz zur Übernahme im gewählten Jahr: ob und wann gekappt wird.
const kappungSatz = kj => kj.an ? `Am ${de(kj.stichtag)} verfällt das Plus über ${zeitText(kj.grenze_min)} Std. plus Übernahme; ein Minus bleibt.` : `In ${kj.jahr} wird nicht gekappt.`;
// Teil „Kappung der Gleitzeit“ der Karte Regeln: die Regel, gespeichert mit „Regeln speichern“ (die Übernahme des Jahres hat eine eigene Karte).
function kappungTeil(k) {
  return `<div${md("gleitzeit")} id="kappung"><h3 class="unter">Kappung der Gleitzeit</h3>
      <label for="r-kp">Kappung der Gleitzeit</label><select id="r-kp">${Object.entries(KAPPUNG_MODI).map(([w, n]) => `<option value="${w}"${w === k.gleitzeit_kappung ? " selected" : ""}>${n}</option>`).join("")}</select>
      <div class="reihe"><div><label for="r-ks">Stichtag (TT.MM.)</label><input id="r-ks" inputmode="decimal" placeholder="30.09." value="${kappungTag(k.kappung_stichtag)}"></div>
        <div><label for="r-kg">Grenze (Stunden)</label>${stepper("r-kg", Math.round(k.kappung_grenze_min / 60), 1, 0)}</div></div>
      <label for="r-ka">Erste Kappung im Jahr</label>${stepper("r-ka", k.kappung_ab_jahr, 1, 1970)}
      <p class="hinweis">Mit Ablauf des Stichtags verfällt das Plus über der Grenze, ein Minus nie. Das Freizeitkonto bleibt. „Nach Dienstverhältnis“ heißt: an bei „Beamte Bayern“ (Karte Dienstverhältnis), sonst aus. Ab Werk zum ersten Mal 2027, nicht rückwirkend.</p></div>`;
}
// Karte „Übernahme der Gleitzeit“ des gewählten Jahres (genehmigte Stunden, die die Kappung stehen lässt), eigener Knopf; kj: GET /api/kappung/<J>.
function uebernahmeKarte(kj) {
  return `<div class="card"${md("gleitzeit")} id="uebernahme-karte"><h2>Übernahme der Gleitzeit ${jahr}</h2>
      <label for="kp-ue">Genehmigte Übernahme (Stunden)</label><input id="kp-ue" inputmode="decimal" placeholder="0:00" value="${kj.uebernahme_min ? esc(kj.uebernahme) : ""}">
      <p class="hinweis" id="kp-gilt">${kappungSatz(kj)} Die Übernahme bleibt zusätzlich erhalten, höchstens bis zu deinem Plus.</p><div id="kp-fehler"></div>
      <div class="knoepfe"><button type="button" class="prim" id="kp-speichern">Übernahme ${jahr} speichern</button></div></div>`;
}
// Felder der Regel für PUT /konfig (Grenze in ganzen Minuten).
const kappungWerte = () => ({gleitzeit_kappung: $("#r-kp").value, kappung_stichtag: kappungStichtag($("#r-ks").value), kappung_grenze_min: Math.round(+$("#r-kg").value * 60), kappung_ab_jahr: +$("#r-ka").value});
// Trägt die Regel aus der Voreinstellung s in die Felder ein.
function kappungFelder(s) { $("#r-kp").value = s.gleitzeit_kappung; $("#r-ks").value = kappungTag(s.kappung_stichtag); $("#r-kg").value = Math.round(s.kappung_grenze_min / 60); $("#r-ka").value = s.kappung_ab_jahr; }
// Speichert die genehmigte Übernahme des gewählten Jahres; leer = 0. Bei einem Fehler bleibt die Eingabe.
async function kappungSpeichern() {
  try {
    await api("PUT", `/kappung/${jahr}`, {uebernahme: $("#kp-ue").value.trim() || "0"});
    toast(`Übernahme ${jahr} gespeichert`); seitenCacheLeeren(); zeigen();
  } catch (e) { formFehler($("#kp-fehler"), e.message, {feld: $("#kp-ue")}); }
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
  const liste = [...a].sort((a, b) => a.von.localeCompare(b.von)).map(zeile).join("") || leerHtml("Keine Abschnitte.");
  return `<div class="card"><h2>Arbeitszeit-Abschnitte</h2>${liste}<div class="knoepfe"><button class="prim" ${kl("abschnittBearbeiten", 0)}>Neuer Abschnitt ab ${de(neuerAbschnittAb(a))}</button></div>
    <p class="hinweis">Ohne Abschnitt gilt die Standardarbeitszeit (${komma(KONFIG.wochenstunden)} Stunden, ${KONFIG.arbeitstage.replace(/,/g, ", ")}; unter „Regeln“ einstellbar). Abschnitte beschreiben abweichende Arbeitszeiten für einen Zeitraum, zum Beispiel Teilzeit, Elternzeit oder Elternteilzeit. Bei Teilzeit lassen sich die Stunden je Tag einzeln eintragen.</p></div>`;
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
  const jeTag = x.stunden_je_tag || {};
  blatt(`<h3>${id ? "Abschnitt bearbeiten" : "Neuer Abschnitt"}</h3>
    <div class="reihe"><div><label for="a-von">Von</label><input id="a-von" type="date" value="${x.von}"></div><div><label for="a-bis">Bis</label><input id="a-bis" type="date" value="${x.bis}"></div></div>
    <label for="a-art">Art</label><select id="a-art">${Object.entries(ABSCHNITT_ART).map(([k, v]) => `<option value="${k}" ${x.art === k ? "selected" : ""}>${v}</option>`).join("")}</select>
    <label for="a-std">Wochenstunden</label>${stepper("a-std", x.wochenstunden, 0.5, 0)}
    <label id="a-tage-name">Arbeitstage</label>${tageWahl("a-tage", x.arbeitstage)}
    <div id="a-je-tag"${TEILZEIT_ARTEN.includes(x.art) ? "" : " hidden"}><label for="a-t-Mo">Stunden je Tag <small>(leer: Wochenstunden gleich verteilt)</small></label>
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
  await api("PUT", "/urlaub", {jahr: u.jahr, anspruch: u.erholung, eigene_frei: liste});
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
  } catch (e) { formFehler($("#ft-fehler"), e.message, {felder: FEIERTAG_FEHLER_FELD}); }
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

// Hinweis über den Karten, wenn ein späteres Jahr gewählt ist (ab November das Folgejahr): Was dem Jahr folgt, gilt erst ab dessen 1.1.
const folgejahrHinweis = () => jahr > planungsjahre(heute)[0] ? `<div class="card" id="folgejahr-hinweis"><p class="hinweis">Gewählt ist ${jahr}: Was du für Dienstverhältnis, Kind krank, Feiertage und Übernahme speicherst, gilt ab 1.1.${jahr}.</p></div>` : "";
// Unterseite „Arbeitszeit und Regeln“: Regeln mit Kind krank, Kappung und Gleitzeit-Grenzen, Abschnitte, Feiertage des gewählten Jahres.
async function einstArbeitszeit() {
  const j = +hashTeile()[2];                                          // „Zu tun“ → Übernahme eintragen: #/einstellungen/arbeitszeit/<Jahr des Stichtags>
  if (j >= 1970 && j <= 2200) { jahr = j; jahrLeiste("einstellungen", "arbeitszeit"); history.replaceState(history.state, "", "#/einstellungen/arbeitszeit"); }
  const [kf, ab, liste, u, kj] = await Promise.all([api("GET", "/konfig"), api("GET", "/abschnitte"), api("GET", `/feiertage/${jahr}`), api("GET", `/urlaub/${jahr}`), api("GET", `/kappung/${jahr}`)]);
  KONFIG = kf.werte;
  window.abschnittDaten = ab.abschnitte;
  feiertagDaten = {liste, u, versionen: kf.versionen};
  einstBinden({"kk-max": ["input", kindKrankZahl], "kk-dienst": ["change", kindKrankWahl], "kk-speichern": ["click", kindKrankSpeichern], "dv-speichern": ["click", dienstverhaeltnisSpeichern], "kp-speichern": ["click", kappungSpeichern], "ft-anlegen": ["click", feiertagAnlegen], "ft-liste": ["click", feiertagListe]});
  const binden = window.nachher;
  window.nachher = () => { binden(); $("#ft-liste").onchange = ev => feiertagListe(ev.currentTarget, ev); };
  return folgejahrHinweis() + regelnKarte(kf, u, kj) + feiertageKarte(liste) + abschnitteKarte(ab.abschnitte);
}
// ---- seiten/einstellungen_person.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Einstellungen, Unterseite „Person und Startwerte“: Erfassung gültig ab, Gleitzeit- und Freizeitkonto, Kopf des Monatsnachweises.
// Setzt den Stand des Freizeitkontos zu einem Datum.
async function freizeitSetzen() {
  try { await api("PUT", "/freizeit", {stand: $("#fz-stand").value, datum: $("#fz-datum").value}); toast("Freizeitkonto gesetzt"); zeigen(); }
  catch (e) { formFehler($("#fz-fehler"), e.message, {felder: [["Stand", "#fz-stand"], ["Datum", "#fz-datum"]]}); }
}
// Setzt den Stand des Gleitzeit-Kontos zu einem Datum.
async function gleitzeitSetzen() {
  try { await api("PUT", "/gleitzeit", {stand: $("#g-stand").value, datum: $("#g-datum").value}); toast("Gleitzeit-Konto gesetzt"); zeigen(); }
  catch (e) { formFehler($("#g-fehler"), e.message, {felder: [["Stand", "#g-stand"], ["Datum", "#g-datum"]]}); }
}
// Felder der Startwerte, die am 1.1. gesperrt sind (davor liegt im Jahr nichts); offen bleibt nur die Gleitzeit.
const STARTWERTE_JAHRESFELDER = ["sw-ho", "sw-dst", "sw-urlaub", "sw-gleittage", "sw-krank", "sw-kind_krank"];
// Ein Feld der Startwerte mit Beschriftung; zahl: ganze Tage, sonst Text (Stunden „8:30“ oder „8,5“); versteckt: Ort, den der Homeoffice-Modus nicht kennt.
const startwertFeld = (id, name, wert, zahl, modul = "", versteckt = false) => `<div${modul ? md(modul) : ""}${versteckt ? " hidden" : ""}><label for="sw-${id}">${name}</label><input id="sw-${id}" value="${esc(String(wert))}"${zahl ? ' type="number" min="0" step="1" inputmode="numeric"' : ' inputmode="decimal" placeholder="z. B. 300:00 oder 300,5"'}></div>`;
// Karte „Erfassung gültig ab“ (R6): Datum und der Stand bis zum Vortag (Zeiten, genommene Tage, Gleitzeit-Saldo).
function startwerteKarte(s) {
  return `<div class="card" id="startwerte"><h2>Erfassung gültig ab</h2>
    <p class="hinweis">Ab diesem Tag erfasst du in der App. Was davor im Jahr war, trägst du hier als Stand bis zum Vortag ein. Stunden als „8:30“ oder „8,5“.</p>
    <label for="sw-ab">Erfassung gültig ab</label><input type="date" id="sw-ab" value="${esc(s.ab)}" max="${new Date().toISOString().slice(0, 10)}">
    <h3 class="unter" id="sw-bis">Stand bis ${s.stand_bis ? esc(s.stand_bis) : "zum Vortag"}</h3>
    <div class="reihe">${startwertFeld("ho", "HO-Zeit (Stunden)", s.ho, false, "", einOrt() === "dst")}${startwertFeld("dst", "Büro-Zeit (Stunden)", s.dst, false, "", einOrt() === "ho")}</div>
    <div class="reihe">${startwertFeld("urlaub", "Urlaub genommen (Tage)", s.urlaub, true, "urlaub")}${startwertFeld("gleittage", "Gleittage genommen", s.gleittage, true, "gleittage")}</div>
    <div class="reihe">${startwertFeld("krank", "Kranktage", s.krank, true, "krank")}${startwertFeld("kind_krank", "Kind krank (Tage)", s.kind_krank, true, "kind_krank")}</div>
    <div${md("gleitzeit")}><label for="sw-gleitzeit">Gleitzeit-Saldo (hh:mm, auch −03:15)</label><input id="sw-gleitzeit" value="${esc(s.gleitzeit)}" placeholder="leer = Stand der App am Vortag"></div>
    <p class="hinweis">Angesparten Urlaub als Rest am Beginn bei den Konten eintragen.</p>
    <div id="sw-fehler"></div><div class="knoepfe"><button type="button" class="prim" id="sw-speichern">Startwerte speichern</button>${s.ab ? `<button type="button" class="gef" id="sw-loeschen">Startwerte entfernen</button>` : ""}</div></div>`;
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
  catch (e) { formFehler($("#sw-fehler"), e.message, {feld}); }
}
// Felder zu den Textanfängen der Fehler des Dienstes (konfig.STARTWERTE_NAMEN und startwerte_pruefen) für formFehler; das erste passende gilt.
const STARTWERTE_FEHLER_FELD = [["Erfassung gültig ab", "#sw-ab"], ["HO", "#sw-ho"], ["Büro-Zeit", "#sw-dst"], ["Urlaub", "#sw-urlaub"], ["Gleittage", "#sw-gleittage"],
  ["Kranktage", "#sw-krank"], ["Kind krank", "#sw-kind_krank"], ["Gleitzeit-Saldo", "#sw-gleitzeit"]];
// Wert eines Feldes der Startwerte; ein gesperrtes oder fehlendes Feld liefert leer.
const startwertWert = id => { const e = $("#sw-" + id); return !e || e.disabled ? "" : e.value.trim(); };
// Speichert die Startwerte; Hinweise des Servers (Übertrag, verschobenes Datum) erscheinen als Meldung. Bei einem Fehler bleiben die Eingaben stehen.
async function startwerteSpeichern() {
  const tage = f => +startwertWert(f) || 0, zeit = f => startwertWert(f) || "0:00";
  try {
    const r = await api("PUT", "/startwerte", {ab: $("#sw-ab").value, ho: zeit("ho"), dst: zeit("dst"), urlaub: tage("urlaub"), gleittage: tage("gleittage"),
      krank: tage("krank"), kind_krank: tage("kind_krank"), gleitzeit: $("#sw-gleitzeit").value.trim()});
    toast((r.hinweise || []).join(" ") || "Startwerte gespeichert"); seitenCacheLeeren(); zeigen();
  } catch (e) { formFehler($("#sw-fehler"), e.message, {felder: STARTWERTE_FEHLER_FELD}); }
}
// Entfernt die Startwerte nach Rückfrage; beide Konten zeigen danach heute denselben Stand.
async function startwerteLoeschen() {
  if (!(await frage("Startwerte entfernen?\n\nDie App rechnet dann wieder mit allen erfassten Tagen. Gleitzeit- und Freizeitkonto zeigen heute denselben Stand.", "Entfernen", true))) return;
  try { await api("PUT", "/startwerte", {ab: ""}); toast("Startwerte entfernt"); seitenCacheLeeren(); zeigen(); }
  catch (e) { $("#sw-fehler").innerHTML = meldung(e.message); }
}
// Felder des Kopfs im Monatsnachweis: [Schlüssel, Beschriftung, autocomplete].
const NACHWEIS_KOPF = [["name", "Name", "name"], ["arbeitgeber", "Arbeitgeber", "organization"], ["personalnummer", "Personalnummer", "off"], ["ort", "Ort", "address-level2"]];
const NACHWEIS_KOPF_MAX = 80;                                  // wie db.NACHWEIS_MAX
// Karte „Kopf des Monatsnachweises“: Name, Arbeitgeber, Personalnummer und Ort (steht vor dem Datum der Unterschrift).
function nachweisKopfKarte(kopf) {
  const feld = ([f, name, auto]) => `<label for="nk-${f}">${name}</label><input type="text" id="nk-${f}" maxlength="${NACHWEIS_KOPF_MAX}" autocomplete="${auto}" value="${esc(kopf[f] || "")}">`;
  return `<div class="card"${md("monatsnachweis")}><h2>Kopf des Monatsnachweises</h2>
    <p class="hinweis">Steht nur im Monatsnachweis, der Ort vor dem Datum der Unterschrift. Bleibt auf deinen Geräten und in den verschlüsselten Sync-Dateien.</p>
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
  return `${kontoKarte("gleitzeit", `${wertZeile("Stand heute", gz.konto, `gross saldo ${saldoKlasse(gz.konto_min)}`, "zeile")}
      <div class="reihe"><div><label for="g-stand">Stand (hh:mm)</label><input id="g-stand" placeholder="z. B. −03:15"></div><div><label for="g-datum">am Ende von</label><input id="g-datum" type="date" value="${heute}"></div></div>
      <div id="g-fehler"></div><div class="knoepfe"><button class="prim" ${kl("gleitzeitSetzen")}>Stand festlegen</button></div>
      <p class="hinweis">Das Konto rechnet Ist minus Soll aller erfassten Tage (Gleittag = −Tagessoll, Urlaub und Krank ohne Soll). Wenn es von deinem bisherigen Stand abweicht, lege hier den richtigen Stand zu einem Tag fest. Die App rechnet ab dort weiter.</p>`)}
    ${kontoKarte("freizeit", `${wertZeile("Stand heute", gz.freizeit, `gross saldo ${saldoKlasse(gz.freizeit_min)}`, "zeile")}
      <div class="reihe"><div><label for="fz-stand">Stand (hh:mm)</label><input id="fz-stand" placeholder="z. B. −02:00"></div><div><label for="fz-datum">am Ende von</label><input id="fz-datum" type="date" value="${heute}"></div></div>
      <div id="fz-fehler"></div><div class="knoepfe"><button class="prim" ${kl("freizeitSetzen")}>Stand festlegen</button></div>
      <p class="hinweis">Das Freizeitkonto ist unabhängig von der Gleitzeit: Arbeitszeit an Samstagen, Sonntagen und Feiertagen kommt dazu, die Art „Freizeitausgleich“ bucht das Tagessoll ab.</p>`)}`;
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
// Einstellungen, Unterseite „Aussehen“: Farbe, Glaseffekt, Hintergrund, Akzentfarbe, Kacheln, Zeitformat und Browser des Fensters.
const AUSSEHEN_ADRESSE = "#/einstellungen/aussehen";
const GLAS_WAHL = [["auto", "Automatisch"], ["an", "An"], ["aus", "Aus"]];   // Schalter „Glaseffekt“ (ho_glas)
// Knöpfe der Auswahl „Hintergrund“: je Hintergrund eine kleine Vorschau (Klasse hg-probe, Bild aus --bg-<name>) über dem Namen.
const hintergrundWahl = () => Object.entries(HINTERGRUENDE).map(([k, t]) => [k, `<i class="hg-probe" data-hg="${k}" aria-hidden="true"></i>${t}`]);
// Markiert in der Gruppe g den Knopf mit dem Wert v als gewählt.
const wahlZeigen = (g, v) => g?.querySelectorAll("button").forEach(x => x.classList.toggle("on", x.dataset.v === v));
// Setzt die Akzentfarbe auf Blau zurück, ohne die Seite neu zu zeichnen (Scroll-Stand und Fokus bleiben).
function akzentStandard() { speicher.s("ho_akzent", AKZENT_VORGABE); darstellung(); wahlZeigen($("#inhalt [data-n=akzent]"), AKZENT_VORGABE); }
// Karte „Aussehen“ der Einstellungen: Farbe, Glaseffekt, Hintergrund und Akzentfarbe (alles nur auf diesem Gerät). Die Knöpfe werden in window.nachher gebunden, wenn die Seite steht.
// Eine Wahl wirkt über darstellung() (CSS-Variablen) ohne Neuzeichnen: Neuzeichnen verlor den Fokus und sprang nach „Kacheln anpassen“ wieder zu dieser Karte.
function seiteDarstellung() {
  const f = speicher.l("ho_farbe", FARBE_VORGABE), a = akzentName(speicher.l("ho_akzent", AKZENT_VORGABE));
  const glasWahl = glasName(speicher.l("ho_glas", GLAS_VORGABE)), h = hintergrundName(speicher.l("ho_hintergrund", HINTERGRUND_VORGABE));
  window.nachher = () => document.querySelectorAll("#inhalt [data-n]").forEach(g => g.querySelectorAll("button").forEach(b => b.onclick = () => {
    speicher.s("ho_" + g.dataset.n, b.dataset.v); darstellung(); wahlZeigen(g, b.dataset.v);
  }));
  return `<div class="card"><h2>Aussehen</h2>
    <label id="as-farbe">Farbe</label>${segHtml([["auto", "Automatisch"], ["hell", "Hell"], ["dunkel", "Dunkel"]], f, {name: "farbe", beschriftet: "as-farbe"})}
    <p class="hinweis">Automatisch folgt der Einstellung deines Geräts.</p>
    <label id="as-glas">Glaseffekt</label>${segHtml(GLAS_WAHL, glasWahl, {name: "glas", beschriftet: "as-glas"})}
    <p class="hinweis">Durchscheinende, weiche Flächen. Aus macht sie deckend und spart Leistung. Automatisch schaltet ihn auf schwachen Geräten ab. Ist am Gerät „Transparenz reduzieren“ an, ist er immer aus.</p>
    <label id="as-hintergrund">Hintergrund</label>${segHtml(hintergrundWahl(), h, {name: "hintergrund", klasse: "hintergrund", beschriftet: "as-hintergrund"})}
    <p class="hinweis">Verlauf ist der Standard. Der Hintergrund gilt nur auf diesem Gerät; gedruckt wird immer schlicht und hell.</p>
    <label id="as-akzent">Akzentfarbe</label><div class="farben" data-n="akzent" role="group" aria-labelledby="as-akzent">${Object.entries(AKZENTE).map(([k, c]) => `<button data-v="${k}" class="${a === k ? "on" : ""}" data-stil="background:${c}" aria-label="${AKZENT_NAMEN[k]}" title="${AKZENT_NAMEN[k]}"></button>`).join("")}</div>
    <div class="akzent-demo" id="akz-demo"><small>Vorschau</small><span class="demo-knopf">Knopf</span><span class="demo-chip">Aktiv</span><span class="demo-text">Hervorhebung</span><span class="demo-umriss">Umriss</span></div>
    <div class="knoepfe"><button ${kl("akzentStandard")}>Zurück zum Standard</button></div>
    <p class="hinweis">Die Akzentfarbe gilt für Knöpfe, Hervorhebungen und das App-Symbol. Blau ist der Standard.</p></div>`;
}
// Zeitformat der Zeiten in App und Exporten (Regel „zeitformat“, Vorgabe hh:mm wie zeit.fmt_hhmm); Anzeige je Wahl mit Beispiel.
const ZEITFORMATE = [["hhmm", "07:30"], ["dezimal", "7,50"]];
// Karte „Zeitformat“: zwei Knöpfe, die Wahl gilt sofort und wandert mit der Synchronisierung auf die anderen Geräte.
function zeitformatKarte(k) {
  const akt = k.zeitformat || "hhmm";
  return `<div class="card"><h2>Zeitformat</h2><label id="zf-name">7:30 oder 7,50</label>
    ${segHtml(ZEITFORMATE, akt, {beschriftet: "zf-name", knopfId: "zf-"})}
    <p class="hinweis">Gilt für Stunden in der App und in den Exporten.</p><div id="zf-fehler"></div></div>`;
}
// Speichert das Zeitformat (für alle Zeiträume) und markiert die Wahl ohne Neuzeichnen (wie die Akzentfarbe: kein Sprung, der Fokus bleibt am Knopf);
// die anderen Seiten zeichnen beim nächsten Öffnen mit dem neuen Format. Bei einem Fehler bleibt die alte Wahl stehen.
async function zeitformatSetzen(knopf) {
  try {
    KONFIG = (await api("PUT", "/konfig", {modus: "ueberall", werte: {zeitformat: knopf.dataset.v}})).werte; seitenCacheLeeren();
    wahlZeigen(knopf.closest(".seg"), knopf.dataset.v); $("#zf-fehler").textContent = "";
  }
  catch (e) { $("#zf-fehler").innerHTML = meldung(e.message); }
}
// Karte „Rückfrage“: nur hinter dem Anmeldedienst (Abmelden) und in der Desktop-Fassung (App beenden); dreht „Nicht mehr fragen“ zurück.
function abmeldeFrageKarte() {
  if (!PERSON && !$("#app-beenden")) return "";
  const was = PERSON ? "Abmelden" : "Beenden", an = speicher.l(ABMELDE_FRAGE, ABMELDE_FRAGE_AN) !== ABMELDE_FRAGE_AUS;
  return `<div class="card"><h2>Rückfrage</h2><div class="zeile"><span>Vor dem ${was} fragen<br><small>Gilt nur auf diesem Gerät</small></span><input type="checkbox" ${an ? "checked" : ""} data-wechsel="abmeldeFrageSchalten" aria-label="Vor dem ${was} fragen"></div></div>`;
}
// Schalter „Vor dem Abmelden/Beenden fragen“: an fragt wieder, aus wirkt wie „Nicht mehr fragen“.
function abmeldeFrageSchalten(an) {
  speicher.s(ABMELDE_FRAGE, an ? ABMELDE_FRAGE_AN : ABMELDE_FRAGE_AUS);
}
// Pfeile der Knöpfe „nach oben“ und „nach unten“ (nur Zeichen, der Name steht in aria-label).
const PFEIL_HOCH = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>`, PFEIL_RUNTER = `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>`;
// Karte „Kacheln anpassen“ (bis 24.11.2026 „Übersicht anordnen“): je Karte der Übersicht Knöpfe nach oben/unten und ein Schalter „zeigen“, dazu „Standard“. Nur Karten, deren Modul an ist.
function uebersichtKarte() {
  const liste = uebersichtListe(), aus = uebersichtLesen().aus;
  const zeile = (k, i) => `<li class="zeile"><span>${esc(k.name)}</span><span class="pfeile">
    <button type="button" id="ua-${k.id}-hoch" ${kl("uebersichtHoch", k.id)} aria-label="${k.name} nach oben"${i ? "" : " disabled"}>${PFEIL_HOCH}</button>
    <button type="button" id="ua-${k.id}-runter" ${kl("uebersichtRunter", k.id)} aria-label="${k.name} nach unten"${i < liste.length - 1 ? "" : " disabled"}>${PFEIL_RUNTER}</button></span>
    <input type="checkbox" ${aus.includes(k.id) ? "" : "checked"} data-wechsel="uebersichtZeigen" data-kachel="${k.id}" aria-label="${k.name} zeigen"></li>`;
  return `<div class="card" id="uebersicht-anordnen"><h2>Kacheln anpassen</h2>
    <p class="hinweis">Welche Karten die Übersicht zeigt und in welcher Folge. Gilt nur auf diesem Gerät. „Heute“ mit der Stempeluhr steht immer oben. Ist „Zu tun“ aus, zeigt die Übersicht nichts daraus.</p>
    <ol class="anordnen">${liste.map(zeile).join("")}</ol>
    <div class="knoepfe"><button type="button" id="ua-standard" ${kl("uebersichtStandard")}>Standard</button></div></div>`;
}
// Zeichnet die Karte neu und setzt den Fokus wieder auf den Knopf mit fokusId (am Rand ist er gesperrt: dann der andere der Zeile). Die gemerkte Übersicht ist veraltet.
function uebersichtNeu(fokusId) {
  seitenCacheLeeren();
  const k = $("#uebersicht-anordnen"); if (!k) return;
  k.outerHTML = uebersichtKarte(); beschriften($("#uebersicht-anordnen"));
  const ziel = document.getElementById(fokusId);
  (ziel && !ziel.disabled ? ziel : ziel?.closest(".pfeile").querySelector("button:not([disabled])"))?.focus();
}
// Schiebt eine Karte nach oben bzw. unten.
function uebersichtHoch(id) { if (uebersichtSchieben(id, -1)) uebersichtNeu(`ua-${id}-hoch`); }
function uebersichtRunter(id) { if (uebersichtSchieben(id, 1)) uebersichtNeu(`ua-${id}-runter`); }
// Schalter „zeigen“: merkt die Karte als aus- oder eingeblendet.
function uebersichtZeigen(an, e) {
  const stand = uebersichtLesen(), id = e.dataset.kachel;
  stand.aus = an ? stand.aus.filter(x => x !== id) : [...new Set([...stand.aus, id])];
  speicher.s(UEBERSICHT_SPEICHER, JSON.stringify(stand)); seitenCacheLeeren(); zutunLaden().then(zutunZahl);   // „Zu tun“ aus oder an: Zahl am Symbol gleich mit
}
// „Standard“: vergisst die Anordnung (leer, damit spätere Karten an ihrem Standardplatz stehen).
function uebersichtStandard() { speicher.s(UEBERSICHT_SPEICHER, ""); uebersichtNeu("ua-standard"); zutunLaden().then(zutunZahl); toast("Übersicht wie ab Werk."); }
// Ziel des Knopfs „Kacheln anpassen“ der Übersicht (#/einstellungen/aussehen/anordnen): Karte „Kacheln anpassen“ oben ins Bild, Fokus auf ihre Überschrift,
// danach die schlichte Adresse ohne Eintrag im Verlauf: Sonst spränge jedes spätere Neuzeichnen (Zeitformat, Hell/Dunkel oben) wieder zur Karte.
// zeigen.letzte nachziehen, damit zeigen() das nicht als Seitenwechsel nimmt (die Seite stünde sonst oben).
function uebersichtAnordnenZeigen() {
  history.replaceState(history.state, "", AUSSEHEN_ADRESSE); zeigen.letzte = location.hash;
  ueberschriftZeigen($("#uebersicht-anordnen h2"));
}
// Unterseite „Aussehen“: lädt nur die Regeln (Zeitformat) und den Browser des Fensters (Desktop). Mit …/anordnen (Knopf der Übersicht) steht die Karte „Kacheln anpassen“ oben.
async function einstAussehen() {
  const [kf, browser] = await Promise.all([api("GET", "/konfig"), browserWahlHtml(false)]);
  KONFIG = kf.werte;
  const html = `<section id="aussehen" aria-label="Aussehen">${seiteDarstellung()}${uebersichtKarte()}${zeitformatKarte(KONFIG)}${abmeldeFrageKarte()}${neuKarte()}${browser}</section>`;
  einstBinden(Object.fromEntries(ZEITFORMATE.map(([w]) => [`zf-${w}`, ["click", zeitformatSetzen]])));
  if (hashTeile()[2] === "anordnen") { const vorher = window.nachher; window.nachher = () => { vorher?.(); uebersichtAnordnenZeigen(); }; }   // nach dem Binden der Knöpfe
  return html;
}
// ---- seiten/einstellungen_module.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Einstellungen, Unterseite „Module und Profile“: Module, Vorbelegung (Profile) und Werkseinstellungen.
// Modul-Schalter nach Bereichen geordnet (aufbau.md 9); Zeit steht an zweiter Stelle, weil die Übersicht vorn steht.
const MODUL_GRUPPEN = [["Übersicht", ["zutun"]], ["Zeit", ["woche", "monat", "stempel", "gleitzeit", "freizeit"]], ["Homeoffice", ["horest", "jahr"]],
  ["Abwesenheit", ["urlaub", "gleittage", "familientage", "angespart", "planung", "krank", "sonderurlaub", "kind_krank"]],
  ["Auswertung", ["monatsnachweis", "export", "ex_pdf", "ex_office", "ex_daten", "ex_kalender", "nachweis"]], ["Daten", ["sicherung", "abgleich", "github", "koppeln"]], ["Hilfe", ["hilfe"]]];
// Karte „Module“: Schalter je Seite und Funktion; Abgeschaltetes zeigt die App nirgends mehr.
function moduleKarte(namen, allein) {
  return `<div class="card" id="module-karte"><h2>Module</h2><p class="hinweis">Was du abschaltest, zeigt die App nirgends mehr an. Gerechnet wird unverändert, vorhandene Einträge bleiben erhalten. Die Auswahl gilt sofort, für alle Zeiträume, und wird auch synchronisiert. Jeder Reiter ist ein Modul, nur Übersicht, Tag und Einstellungen bleiben immer. Ohne „Sicherung“ erinnert die App auch nicht mehr ans Sichern. Ist „Synchronisieren“ aus, synchronisiert dieses Gerät nicht mehr: nicht von Hand, nicht automatisch und nicht als Speicherort für andere. „Synchronisieren“ gilt als einziges Modul nur für das Gerät, an dem du es schaltest. Beim Abschalten meldet sich das Gerät mit einem letzten Synchronisieren ab. Die anderen zählen mit: Solange noch mindestens zwei Geräte synchronisieren, geht das Synchronisieren dort weiter. Ist ein Gerät allein übrig, schaltet es das Synchronisieren von selbst ab. Ein Profil setzt auch die Module: „Büro + Homeoffice“ schaltet wieder alles ein, „Nur Büro“ und „Nur Homeoffice“ blenden nicht Gebrauchtes aus.</p>
    ${MODUL_GRUPPEN.map(([g, l]) => `<h3 class="unter">${g}</h3>` + l.map(n => `<div class="zeile"><span>${esc(namen[n] || n)}${n === "abgleich" && allein && !modulAn(n) ? "<br><small>von selbst abgeschaltet: kein anderes Gerät synchronisiert mehr</small>" : ""}</span><input type="checkbox" ${modulAn(n) ? "checked" : ""} data-wechsel="modulSchalten" data-name="${n}" aria-label="${esc(namen[n] || n)}"></div>`).join("")).join("")}<div id="mo-fehler"></div></div>`;
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
  if (!name) { formFehler($("#pf-meldung"), "Bitte einen Namen für das Profil eingeben.", {feld: $("#pf-name")}); return; }
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
    <p class="hinweis">Ein Profil ist ein fertiger Satz Regeln, wahlweise mit einer Darstellung (Akzentfarbe, Hell oder Dunkel). „Anwenden“ setzt die Regeln ab heute; frühere Tage bleiben, wie sie sind. Die Darstellung lässt sich danach unter „Aussehen“ weiter ändern.</p>
    ${PROFILE.map((x, i) => `<div class="profil${x.aktiv ? "" : " aus"}"><div class="zeile"><span><b>${esc(x.name)}</b>${x.fest ? " <small>(fest)</small>" : ""}${x.voreinstellung ? " <small>(Voreinstellung)</small>" : ""}${x.akzent ? ` <span class="profil-farbe" data-stil="background:${akzentFarbe(x.akzent)}" title="Akzentfarbe ${AKZENT_NAMEN[akzentName(x.akzent)]}"></span>` : ""}${x.farbe ? ` <small>${({hell: "hell", dunkel: "dunkel", auto: "wie das Gerät"})[x.farbe]}</small>` : ""}<br><small>${x.aktiv ? esc(kurz(x.werte)) : "ausgeblendet"}</small></span>
      <input type="checkbox" ${x.aktiv ? "checked" : ""} data-i="${i}" data-wechsel="profilSchalten" aria-label="Profil ${esc(x.name)} zur Auswahl anbieten"></div>
      ${x.aktiv ? `<div class="knoepfe"><button type="button" ${kl("profilAnwenden", i)}>Anwenden</button><a class="btn" href="api/profile/${i}.json" aria-label="Profil ${esc(x.name)} als Datei laden">Datei</a>${x.fest ? "" : `<button type="button" class="gef" ${kl("profilLoeschen", i)}>Löschen</button>`}</div>` : ""}</div>`).join("")}
    <label for="pf-name">Aktuelle Regeln als eigenes Profil speichern (vorhandener Name wird überschrieben)</label><input type="text" id="pf-name" maxlength="40" placeholder="Name des Profils" autocomplete="off">
    <div class="zeile"><span>Aktuelle Darstellung mitspeichern<br><small>Akzentfarbe, Hell oder Dunkel</small></span><input type="checkbox" id="pf-farbe" aria-label="Aktuelle Darstellung mitspeichern" checked></div>
    <div class="knoepfe"><button type="button" class="prim" ${kl("profilSpeichern")}>Profil speichern</button></div>
    ${FERN ? "" : `<input type="file" id="pf-datei" accept=".json,application/json" hidden data-wechsel="profilImport">
    <div class="knoepfe"><button type="button" ${kl("profilDateiWaehlen")}>Profil aus Datei übernehmen …</button></div>`}
    <p class="hinweis">Der Schalter blendet ein Profil auf diesem Gerät aus der Auswahl aus; angewendete Regeln bleiben. Eigene Profile kommen beim Synchronisieren auf deine anderen Geräte. Weitergeben lassen sie sich über „Datei“ und „Profil aus Datei übernehmen“.</p>
    <div id="pf-meldung" role="status"></div></div>`;
}
const WERK_TEXT = "Alle Einträge und Einstellungen werden gelöscht, auch Passwort und Einstellungen zum Synchronisieren auf diesem Gerät. Der jetzige Stand wird vorher gesichert.";
const WERK_ANDERE = "Die anderen Geräte behalten ihre Einträge. Verbindest du dieses Gerät wieder, kommen sie zurück.";
// Karte „Werkseinstellungen“ (ganz unten, Festlegung A9); nicht in der Demo und nicht über die freigegebene Oberfläche.
function werkKarte() {
  return `${(DEMO && DEMO.aktiv) || FERN ? "" : `<div class="card"><h2>Werkseinstellungen</h2>
    <p class="hinweis">Setzt die App auf Anfang. ${WERK_TEXT} ${WERK_ANDERE} Danach gelten wieder die Regeln der Voreinstellung und alle Module.</p>
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
    <div class="knoepfe"><button type="button" class="prim" ${kl("personUmbenennen")}>Namen speichern</button></div>
    <label for="ps-benutzer">Benutzername oder E-Mail-Adresse</label><input type="text" id="ps-benutzer" maxlength="80" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(BENUTZER)}">
    <div class="knoepfe"><button type="button" ${kl("benutzerAendern")}>Benutzernamen speichern</button><button type="button" ${kl("personAbmelden")}>Abmelden</button></div>
    <div id="ps-meldung" role="status"></div>
    <details class="auf"><summary>Meinen Zugang löschen</summary>
      <p class="hinweis">Dein Zugang verschwindet, deine Daten kommen in den Papierkorb des Servers. Ein Admin kann sie dort wiederherstellen oder endgültig löschen.</p>
      <label for="ps-loeschen-pw">Zur Bestätigung dein Passwort</label><input type="password" id="ps-loeschen-pw" autocomplete="current-password">
      <div class="knoepfe"><button type="button" class="gef" ${kl("selbstLoeschen")}>Zugang löschen</button></div></details></div>`;
}
// Ändert den angezeigten Namen beim Anmeldedienst (eigene Person). Der Anmeldedienst prüft und meldet Fehler als Text; die Eingabe bleibt bei einem Fehler stehen.
async function personUmbenennen() {
  const name = $("#ps-name").value.trim();
  const d = await anAnmeldedienst("pfoertner/name", {name}, "Bitte einen Namen eingeben.", "Der Name ließ sich nicht ändern.", "#ps-name");
  if (!d) return;
  PERSON = d.name || name;
  const text = `Abmelden (${PERSON})`, k = $("#abmelden-knopf"), n = $("#nav-abmelden");
  if (k) { k.setAttribute("aria-label", text); k.title = text; }
  if (n) n.innerHTML = sym("abmelden") + esc(text);
  toast("Name gespeichert");
}
// Sendet eine Änderung an den Anmeldedienst (JSON-Kopf, eigene Person) und zeigt seinen Fehlertext maskiert in der Karte, am Eingabefeld feld (Fokus dort);
// Eingaben bleiben stehen. Rückgabe: Antwort oder null.
async function anAnmeldedienst(pfad, daten, leerText, fehlerText, feld) {
  const box = $("#ps-meldung");
  if (!Object.values(daten)[0]) { formFehler(box, leerText, {feld: $(feld)}); return null; }
  let r, d;
  try { r = await fetch(pfad, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(daten)}); d = await r.json().catch(() => ({})); }
  catch (e) { formFehler(box, KEINE_VERBINDUNG); return null; }
  if (!r.ok) { formFehler(box, d.fehler || fehlerText, {feld: $(feld)}); return null; }
  box.innerHTML = ""; return d;
}
// Ändert den Benutzernamen (Anmeldename) beim Anmeldedienst; die Person bleibt dieselbe, weil sie an ihrer festen ID hängt.
async function benutzerAendern() {
  const benutzer = $("#ps-benutzer").value.trim().toLowerCase();
  const d = await anAnmeldedienst("pfoertner/benutzer", {benutzer}, "Bitte einen Benutzernamen eingeben.", "Der Benutzername ließ sich nicht ändern.", "#ps-benutzer");
  if (!d) return;
  BENUTZER = d.benutzer || benutzer; $("#ps-benutzer").value = BENUTZER;
  toast("Benutzername gespeichert");
}
// Löscht den eigenen Zugang beim Anmeldedienst (nur mit Passwort; Daten in den Papierkorb) und lädt neu: Danach kommt die Anmeldeseite.
async function selbstLoeschen() {
  if (!await frage("Deinen Zugang wirklich löschen? Du wirst abgemeldet.", "Zugang löschen", true)) return;
  const d = await anAnmeldedienst("pfoertner/selbst-loeschen", {passwort: $("#ps-loeschen-pw").value}, "Bitte dein Passwort eingeben.", "Der Zugang ließ sich nicht löschen.", "#ps-loeschen-pw");
  if (!d) return;
  seitenCacheLeeren(); location.reload();
}
const PERSONEN_KORB_LEER = "Der Papierkorb ist leer.";       // Papierkorb des Servers (gelöschte Personen), nicht der Tage auf diesem Gerät
const NEU_ANLEGEN_OFFEN = "Offen: Wer die Anmeldeseite erreicht, kann sich selbst anlegen. Sperre das, wenn alle Personen angelegt sind.";   // U14
// Karte „Personen verwalten“ in „Einstellungen“, nur für Admins hinter dem Anmeldedienst: Liste mit Sperren, Passwort zurücksetzen, Admin-Recht, Löschen,
// dazu der Schalter für „Neu anlegen“ und der Papierkorb. Alle Rechte prüft der Anmeldedienst; die Karte zeigt nur an.
async function adminKarte() {
  if (!PERSON || !ADMIN) return "";
  let d;
  try { const r = await fetch("pfoertner/personen", {headers: {"Accept": "application/json"}}); if (!r.ok) return ""; d = await r.json(); } catch (e) { return ""; }
  const zeile = p => `<div class="profil"><div class="zeile"><span>${esc(p.anzeige)} <small>${esc(p.benutzer)}${p.admin ? " · Admin" : ""}${p.gesperrt ? " · gesperrt" : ""}${p.passwort_offen ? " · Passwort offen" : ""}${Number(p.geraete) ? ` · ${anzahl(Number(p.geraete), "Gerät", "Geräte")}` : ""}</small></span></div>
    <div class="knoepfe"><button type="button" ${kl("adminSperren", p.id, !p.gesperrt)}>${p.gesperrt ? "Entsperren" : "Sperren"}</button><button type="button" ${kl("adminPasswort", p.id, p.anzeige)}>Passwort zurücksetzen</button>
    <button type="button" ${kl("adminRolle", p.id, !p.admin)}>${p.admin ? "Admin-Recht nehmen" : "Zum Admin machen"}</button><button type="button" class="gef" ${kl("adminLoeschen", p.id, p.anzeige)}>Löschen</button></div></div>`;
  const korb = (d.papierkorb || []).map((k, i) => `<div class="profil"><div class="zeile"><span>${esc(k.name)} <small>${esc(korbDatum(k.datum))} · ${esc(korbGroesse(k.groesse))}</small></span></div>
    <label for="pk-b-${i}">Benutzername beim Wiederherstellen</label><input type="text" id="pk-b-${i}" maxlength="80" autocapitalize="none" spellcheck="false">
    <div class="knoepfe"><button type="button" ${kl("adminPapierkorbZurueck", k.name, i)}>Wiederherstellen</button><button type="button" class="gef" ${kl("adminPapierkorbLeeren", k.name)}>Endgültig löschen</button></div></div>`).join("");
  return `<div class="card"><h2>Personen verwalten</h2>
    ${(d.personen || []).map(zeile).join("")}
    <div class="zeile"><span>„Neu anlegen“ auf der Anmeldeseite</span><button type="button" ${kl("adminNeuAnlegen", !d.neu_anlegen_offen)}>${d.neu_anlegen_offen ? "Sperren" : "Freigeben"}</button></div>
    ${d.neu_anlegen_offen ? `<p class="hinweis">${NEU_ANLEGEN_OFFEN}</p>` : ""}
    <h3 class="unter">Papierkorb</h3>${korb || leerHtml(PERSONEN_KORB_LEER)}
    <div id="ad-meldung" role="status"></div></div>`;
}
// Karte „Meine Geräte“, nur hinter dem Anmeldedienst: Desktop- und Android-Apps, die mit diesem Server synchronisieren. Entfernen macht ihren Schlüssel sofort ungültig.
async function geraeteKarte() {
  if (!PERSON) return "";
  let d, fehler = "";
  try { const r = await fetch("pfoertner/geraete", {headers: {"Accept": "application/json"}}); d = await r.json().catch(() => ({})); if (!r.ok) fehler = d.fehler || GERAETE_FEHLER; }
  catch (e) { fehler = KEINE_VERBINDUNG; }
  const liste = fehler ? meldung(fehler) : (d.geraete || []).map(g => `<div class="zeile geraet"><span>${esc(g.name)}<br><small>angemeldet seit ${esc(geraetSeit(g.seit))}</small></span><button type="button" class="gef" ${kl("geraetEntfernen", g.id, g.name)}>Entfernen</button></div>`).join("")
    || leerHtml(GERAETE_KEINS);
  return `<div class="card"><h2>Meine Geräte</h2><p class="hinweis">Diese Geräte tauschen deine Daten mit diesem Server aus. Ein neues Passwort meldet alle ab.</p>${liste}<div id="gr-meldung" role="status"></div></div>`;
}
const GERAETE_FEHLER = "Die Geräte ließen sich nicht laden.";
const GERAETE_KEINS = "Noch kein Gerät angemeldet. In der Windows- oder Android-App unter Daten → Synchronisieren die Adresse dieses Servers mit Benutzername und Passwort eintragen.";
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
  if (!benutzer) { formFehler($("#ad-meldung"), "Bitte einen Benutzernamen eingeben.", {feld: $(`#pk-b-${i}`)}); return; }
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
const GERAETE_LEER = "Gibt es nur, wenn die App über einen Server mit Anmeldung läuft.";   // A11: die Unterseite bleibt in der Liste
// Unterseite „Geräte und Anmeldung“: Person, Meine Geräte und Personen verwalten (Anmeldedienst), dazu die Update-Prüfung; sonst der Hinweis.
async function einstGeraete() {
  const update = updateKarte(await api("GET", "/update").catch(() => null));   // die Web-App ohne Datenordner kennt die Route nicht
  const html = personKarte() + await geraeteKarte() + await adminKarte() + update;
  einstBinden({"up-an": ["change", updateSchalten]});
  return html || `<div class="card">${leerHtml(GERAETE_LEER)}</div>`;
}
// ---- seiten/tag.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// ---- Tag (Reiter im Bereich Zeit): Kopf ‹ Datum › mit Kalender und „Heute“, darunter die Karte des Tages (Soll und Ist) und seine Einträge,
// jeder einzeln änderbar und löschbar, dazu „+ Eintrag“ (Wunsch vom 25.11.2026).
// Die Werte kommen aus GET /woche (nur dort gibt es Ist, Soll und Saldo je Tag). Am Handy öffnet „Bearbeiten“ das Blatt, am Rechner steht das Formular daneben.
// Titel der Karte des Tages: „Heute“ oder der Wochentag; das Datum steht schon im Kopf darüber.
const TAG_WOCHENTAG = {Mo: "Montag", Di: "Dienstag", Mi: "Mittwoch", Do: "Donnerstag", Fr: "Freitag", Sa: "Samstag", So: "Sonntag"};
async function seiteTag() {
  const d = zeitAnkommen(), [kj, kw] = kwJahr(isoZuDatum(d)), bearbeiten = zeitParameter(hashTeile(), zeitHeuteIso()).bearbeiten;
  const [w, verlauf] = await Promise.all([api("GET", `/woche/${kj}/${kw}`), gleitzeitVerlauf("tag", d)]);   // Verlauf: letzte 10 Tage (Wunsch 25.11.2026)
  window.monatDaten = {tage: w.tage}; window.famAktiv = w.familientage_aktiv;   // tagBearbeiten liest den Tag von hier
  window.nachher = () => { zeitSpalte(); eintraegeBinden(d); tagLaufend(); gzVerlaufEinpassen(); if (bearbeiten) zeitBearbeitenOeffnen(d); };
  const t = w.tage.find(z => z.datum === d), heuteIso = zeitHeuteIso(), istHeute = d === heuteIso;
  const titel = istHeute ? "Heute" : TAG_WOCHENTAG[t.wt] || t.wt;
  tagLiveStand = {t, titel};
  const knoepfe = zeitDaneben() ? "" : `<div class="knoepfe" id="tag-knoepfe"><button class="prim" ${kl("tagBearbeiten", d)}>Bearbeiten</button>${istHeute ? `<button${md("stempel")} ${kl("stempelBlatt")}>Stempeluhr</button>` : ""}</div>`;
  return `${kopfHtml("tag", `${t.wt} ${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`, "t-kal", d)}
    ${zeitLeerHtml(w.tage)}<div id="tag-karte">${tagKarteHtml(t, saldoKlasse, titel)}</div>
    <div class="card">${tagZeileHtml(t, heuteIso, saldoKlasse, true)}${tagEintraegeHtml(t)}<div id="tag-laufend"></div>${eintragNeuHtml()}</div>${knoepfe}${verlauf}`;
}
// ---- seiten/sondertage.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Reiter „Sondertage“: Zähler für Sonderurlaub und Kind krank je Jahr. Das Limit für Kind krank kommt aus der API (Regel kind_krank_max)
// und wird in den Einstellungen geändert, nicht hier.
const LIMIT_WEG = "#/einstellungen/arbeitszeit";                 // mit „/<Jahr>“: die Einstellungen öffnen im Jahr der Seite
// Seite „Sondertage“: je Modul eine Karte; Werte nur aus GET /api/urlaub/<Jahr>.
async function seiteSondertage() {
  const u = await api("GET", `/urlaub/${jahr}`);
  const start = u.kind_krank_start ? `<p class="hinweis">davon ${u.kind_krank_start} aus Startwerten</p>` : "";
  const voll = u.kind_krank_rest === 0 ? `<p class="hinweis">Das Limit für ${jahr} ist erreicht.</p>` : "";
  return `<div class="gitter paar">${karteMitTitel("so-urlaub-t", `Sonderurlaub ${jahr}`, `${wertZeile("Verbraucht", u.sonderurlaub)}
      <p class="hinweis">Sonderurlaub trägst du am Tag unter „Mehr“ ein oder planst ihn unter Urlaub.</p>`, {mehr: md("sonderurlaub")})}
    ${karteMitTitel("so-kind-t", `Kind krank ${jahr}`, `${wertZeile("Verbraucht", u.kind_krank)}${start}
      ${wertZeile("Verfügbar", `noch ${u.kind_krank_rest} von ${u.kind_krank_max}`, u.kind_krank_rest === 0 ? "rot" : "")}${voll}
      <div class="knoepfe"><a class="btn" href="${LIMIT_WEG}/${jahr}">Limit ändern</a></div>`, {mehr: md("kind_krank")})}</div>`;
}
// ---- seiten/monatsnachweis.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Seite „Monatsnachweis“ (funktionen.md 3): Kopf ‹ Monat › wie Tag, Woche und Monat, Schalter „mit Beginn und Ende“, Unterschrift, Vorschau aus GET /api/monatsnachweis/<J>/<M>, PDF und Word.
// Der Monat steht in der Adresse (#/monatsnachweis/J/M, geprüft von zeitParameter); ohne Angabe gilt der aktuelle Monat.
const NACHWEIS_ZEITEN = "ho_nachweis_zeiten";                     // Schalter je Gerät (Speicher), ab Werk aus
const NACHWEIS_ANGABEN = [["name", "Name"], ["arbeitgeber", "Arbeitgeber"], ["personalnummer", "Personalnummer"]];        // dokument.NACHWEIS_ANGABEN
const NACHWEIS_ORT_DATUM = "Ort, Datum", NACHWEIS_UNTERSCHRIFT = "Unterschrift", NACHWEIS_VORGESETZT = "Vorgesetzter/Vorgesetzte";   // dokument.NACHWEIS_…
const NACHWEIS_DATUM_WAHL = [["", "leer (von Hand)"], ["heute", "heute"], ["letzter", "letzter Arbeitstag"], ["eigen", "eigenes Datum"]];   // db.NACHWEIS_WAHL, dazu „eigen“
const NACHWEIS_TEXT_MAX = 80;                                         // wie db.NACHWEIS_MAX
// Nur für den angezeigten Nachweis, nicht gemerkt: überschriebener Name (null = aus den Personendaten) und eigenes Datum. Gilt je Monat.
// offen: gemerkte Angaben, deren Speichern noch läuft; der Link trägt sie so lange selbst (Klick direkt nach dem Ändern).
let nachweisEinmal = {monat: "", name: null, datum: "", eigen: false, offen: {}};
// Merkt den Schalter „mit Beginn und Ende“ auf diesem Gerät und zeichnet neu.
function nachweisZeitenSchalten(an) { speicher.s(NACHWEIS_ZEITEN, an ? "1" : ""); zeigen(); }
// Öffnet den gewählten Monat über die Adresse: „JJJJ-MM“ vom Blättern oder „JJJJ-MM-TT“ vom Datumsfeld im Kopf.
function nachweisMonatWaehlen(w) { if (w) location.hash = `#/monatsnachweis/${+w.slice(0, 4)}/${+w.slice(5, 7)}`; }
// Nachbarmonat „JJJJ-MM“ von Jahr j und Monat m um r Monate (über den Jahreswechsel).
function nachweisNachbar(j, m, r) { const d = new Date(j, m - 1 + r, 1, 12); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
// Aktionen des Kopfs ‹ Titel › für den Monat j/m (kopfHtml): Blättern und Datumsfeld öffnen einen Monat über die Adresse, „Heute“ den aktuellen.
const nachweisKopfAktionen = (j, m) => ({blaettern: r => kl("nachweisMonatWaehlen", nachweisNachbar(j, m, r)), heute: "nachweisHeute", datum: "nachweisMonatWaehlen"});
// „Heute“: aktueller Monat (die Adresse ohne Monat; steht sie schon da, nur neu zeichnen).
function nachweisHeute() { if (location.hash === "#/monatsnachweis") zeigen(); else location.hash = "#/monatsnachweis"; }
// Abfrage für Vorschau und Dateien: nur was für diesen Nachweis gilt (Name, eigenes Datum); leer ohne solche Angaben.
function nachweisAbfrage() {
  const q = new URLSearchParams();
  if (nachweisEinmal.name !== null) q.set("name", nachweisEinmal.name);
  if (nachweisEinmal.eigen) q.set("datum", nachweisEinmal.datum);    // eigenes Datum noch leer: Linie zum Ausfüllen
  for (const [k, v] of Object.entries(nachweisEinmal.offen)) if (!q.has(k)) q.set(k, v);
  const text = q.toString();
  return text ? "?" + text : "";
}
// Setzt die Abfrage der Links PDF und Word sofort (vor dem Neuzeichnen): Ein Klick direkt nach dem Tippen nimmt die Eingabe schon mit.
function nachweisLinksSetzen() {
  for (const a of document.querySelectorAll('a.btn[href^="api/monatsnachweis/"]')) a.setAttribute("href", a.getAttribute("href").split("?")[0] + nachweisAbfrage());
}
// Ein Feld der Karte „Unterschrift“ geändert: Name und eigenes Datum nur für diesen Nachweis, Ort, Datumswahl und zweite Unterschrift
// gemerkt in den Personendaten (alle Geräte). Danach neu zeichnen, der Fokus bleibt im Feld; bei einem Fehler bleibt die Eingabe stehen.
async function nachweisUnterschrift(wert, e) {
  const feld = e.dataset.feld;
  if (feld === "name" || feld === "eigen" || (feld === "datum" && wert === "eigen")) {
    if (feld === "name") nachweisEinmal.name = wert;
    else if (feld === "eigen") nachweisEinmal.datum = wert;
    else nachweisEinmal.eigen = true;
    nachweisLinksSetzen();
  } else {
    const neu = feld === "zweite" ? (wert ? "1" : "") : wert;
    if (feld === "datum") nachweisEinmal.eigen = false;
    nachweisEinmal.offen[feld] = neu;
    nachweisLinksSetzen();
    try { await api("PUT", "/nachweiskopf", {[feld]: neu}); }
    catch (x) { formFehler($("#mn-u-fehler"), x.message, {feld: e}); return; }
    delete nachweisEinmal.offen[feld];
    nachweisLinksSetzen();
  }
  await zeigen();
  document.getElementById(e.id)?.focus();
}
// Karte „Unterschrift“: Ort, Datum (leer, heute, letzter Arbeitstag, eigenes), Name in Druckbuchstaben, auf Wunsch Vorgesetzter/Vorgesetzte.
function nachweisUnterschriftKarte(kopf) {
  const wahl = nachweisEinmal.eigen ? "eigen" : kopf.datum || "", zweite = kopf.zweite === "1";
  const text = (id, feld, name, wert, hilfe, auto = "off") => `<label for="${id}">${name}</label><input type="text" id="${id}" data-feld="${feld}" data-wechsel="nachweisUnterschrift" maxlength="${NACHWEIS_TEXT_MAX}" autocomplete="${auto}" value="${esc(wert)}"${hilfe ? ` aria-describedby="${id}-h"` : ""}>${hilfe ? `<p class="hinweis" id="${id}-h">${hilfe}</p>` : ""}`;
  return `<section class="card" aria-labelledby="mn-u-titel"><h2 id="mn-u-titel">Unterschrift</h2>
    ${text("mn-u-ort", "ort", "Ort", kopf.ort || "", "steht vor dem Datum; gemerkt für alle Nachweise", "address-level2")}
    <label for="mn-u-datum">Datum</label><select id="mn-u-datum" data-feld="datum" data-wechsel="nachweisUnterschrift">${NACHWEIS_DATUM_WAHL.map(([w, n]) => `<option value="${w}"${w === wahl ? " selected" : ""}>${n}</option>`).join("")}</select>
    ${wahl === "eigen" ? `<label for="mn-u-eigen">Eigenes Datum</label><input type="date" id="mn-u-eigen" data-feld="eigen" data-wechsel="nachweisUnterschrift" min="1970-01-01" max="2200-12-31" value="${esc(nachweisEinmal.datum)}" aria-describedby="mn-u-eigen-h"><p class="hinweis" id="mn-u-eigen-h">nur für diesen Nachweis</p>` : ""}
    ${text("mn-u-name", "name", "Name unter der Unterschrift", nachweisEinmal.name ?? kopf.name ?? "", "nur für diesen Nachweis; steht in Großbuchstaben unter der Linie", "name")}
    <div class="zeile"><span><span id="mn-u-zweite-n">Zweite Unterschrift</span><br><small id="mn-u-zweite-h">für ${NACHWEIS_VORGESETZT}</small></span>
      <input type="checkbox" id="mn-u-zweite" data-feld="zweite" data-wechsel="nachweisUnterschrift" aria-labelledby="mn-u-zweite-n" aria-describedby="mn-u-zweite-h"${zweite ? " checked" : ""}></div>
    ${zweite ? text("mn-u-vorgesetzt", "vorgesetzt", `Name ${NACHWEIS_VORGESETZT}`, kopf.vorgesetzt || "", "darf leer bleiben") : ""}
    <div id="mn-u-fehler"></div></section>`;
}
// Karte oben: Schalter, Knöpfe PDF und Word (nach den Modulen), Hinweis bei leerem Kopf.
function nachweisWahl(j, m, mz, kopfLeer) {
  const pfad = `api/monatsnachweis/${j}/${m}${mz ? "/mit-zeiten" : ""}`, titel = `Monatsnachweis ${MONATE[m - 1]} ${j}`, q = nachweisAbfrage();
  const knoepfe = [["PDF", "pdf", "ex_pdf"], ["Word", "docx", "ex_office"]].filter(([, , mod]) => modulAn(mod));
  return `<section class="card" aria-labelledby="mn-titel"><h2 id="mn-titel">Monatsnachweis</h2>
    <div class="zeile"><span><span id="mn-zeiten-n">mit Beginn und Ende</span><br><small id="mn-zeiten-h">nimmt Kommen, Gehen und Pause dazu</small></span>
      <input type="checkbox" id="mn-zeiten" aria-labelledby="mn-zeiten-n" aria-describedby="mn-zeiten-h" data-wechsel="nachweisZeitenSchalten"${mz ? " checked" : ""}></div>
    ${kopfLeer ? `<p class="hinweis">Name, Arbeitgeber und Personalnummer trägst du unter <a href="#/einstellungen/person">${esc(weg("einstellungen", "person"))}</a> ein.</p>` : ""}
    ${knoepfe.length ? `<div class="knoepfe">${knoepfe.map(([n, e], i) => `<a class="btn${i ? "" : " prim"}" href="${esc(`${pfad}.${e}${q}`)}" aria-label="${esc(`${titel} als ${n}`)}">${n}</a>`).join("")}</div>` : ""}</section>`;
}
// Unterschriften der Vorschau wie im Dokument: Ort und Datum, Unterschrift mit Name, auf Wunsch Vorgesetzter/Vorgesetzte; Texte maskiert.
function nachweisUnterschriften(u) {
  const spalte = (oben, klein, name) => `<div class="nu-spalte"><span class="nu-wert">${esc(oben)}</span><small>${klein}</small><b>${esc(name)}</b></div>`;
  return `<div class="nachweis-unterschrift${u.zweite ? " drei" : ""}" role="group" aria-label="Unterschrift">${spalte(u.ort_datum, NACHWEIS_ORT_DATUM, "")}${spalte("", NACHWEIS_UNTERSCHRIFT, u.name)}${u.zweite ? spalte("", NACHWEIS_VORGESETZT, u.vorgesetzt) : ""}</div>`;
}
// Vorschau wie das Dokument: Titel, Kopf, alle Tage (frei = grau), Summen und Unterschrift. Texte vom Server alle maskiert.
function nachweisVorschau(n, mz) {
  const spalten = mz ? ["Tag", "Kommen", "Gehen", "Pause", "Stunden", "Anmerkung"] : ["Tag", "Stunden", "Anmerkung"];   // dokument.NACHWEIS_SPALTEN(_ZEITEN)
  const zeile = (t, name, z) => `<tr${t.frei ? ' class="frei"' : ""}><td>${name}</td>${mz ? `<td>${esc(z.kommen)}</td><td class="geh">${esc(z.gehen)}</td><td>${esc(z.pause)}</td>` : ""}<td>${esc(z.stunden)}</td><td class="anm">${esc(z.anmerkung)}</td></tr>`;
  // mit Beginn und Ende: je Block eine Zeile, das Datum nur in der ersten (dokument._nachweis_zeilen)
  const tag = t => mz && t.bloecke?.length ? t.bloecke.map((b, i) => zeile(t, i ? "" : `${+t.tag}. ${esc(t.wt)}`, b)).join("") : zeile(t, `${+t.tag}. ${esc(t.wt)}`, t);
  const s = n.summe, summen = [["Arbeitsstunden gesamt", s.stunden], ["Urlaubstage", s.urlaub], ["Gleittage", s.gleittage], ["Freizeitausgleich (Tage)", s.freizeit]];
  const tabelle = (name, kopf, zeilen, extra = "") => tabelleHtml(kopf.map(k => [k, k === "Anmerkung" || k === "Wert" ? ' class="anm"' : ""]), zeilen, {klasse: "nachweis" + extra, label: esc(name)});
  return `<section class="card" aria-labelledby="mn-vorschau"><h2 id="mn-vorschau">Vorschau</h2>
    <h3 class="nachweis-titel">Monatsnachweis ${MONATE[n.monat - 1]} ${n.jahr}</h3><p class="nachweis-datum">Erstellt am ${pad(heute.getDate())}.${pad(heute.getMonth() + 1)}.${heute.getFullYear()}</p>
    ${tabelle("Angaben", ["Angabe", "Wert"], NACHWEIS_ANGABEN.map(([k, t]) => `<tr><td>${t}</td><td class="anm">${esc(n.kopf[k])}</td></tr>`).join(""))}
    ${tabelle(`Tage ${MONATE[n.monat - 1]} ${n.jahr}`, spalten, n.tage.map(tag).join(""), mz ? " mit-zeiten" : "")}
    ${tabelle("Summen", ["Summe", "Wert"], summen.map(([t, w]) => `<tr><td>${t}</td><td class="anm">${esc(w)}</td></tr>`).join(""))}
    ${nachweisUnterschriften(n.unterschrift)}</section>`;
}
// Seite „Monatsnachweis“: Monat aus der Adresse; ohne Eintrag im Monat der Leerzustand mit dem Weg zum Eintragen.
async function seiteMonatsnachweis() {
  const von = zeitParameter(hashTeile(), zeitHeuteIso()).von, j = +von.slice(0, 4), m = +von.slice(5, 7), mz = speicher.l(NACHWEIS_ZEITEN, "") === "1";
  if (nachweisEinmal.monat !== `${j}-${m}`) nachweisEinmal = {monat: `${j}-${m}`, name: null, datum: "", eigen: false, offen: {}};
  const [{monate}, n, kopf] = await Promise.all([api("GET", "/zeitraeume"), api("GET", `/monatsnachweis/${j}/${m}${nachweisAbfrage()}`), api("GET", "/nachweiskopf")]);
  const wahl = kopfHtml("monat", `${MONATE[m - 1]} ${j}`, "mn-kal", `${j}-${pad(m)}-01`, nachweisKopfAktionen(j, m)) + nachweisWahl(j, m, mz, NACHWEIS_ANGABEN.every(([k]) => !kopf[k]));
  if (!monate.includes(`${j}-${pad(m)}`)) return wahl + `<section class="card">${leerHtml("Noch keine Einträge in diesem Monat.")}<div class="knoepfe"><a class="btn prim" href="#/monat/${j}/${m}">Tag eintragen</a></div></section>`;
  return wahl + nachweisUnterschriftKarte(kopf) + nachweisVorschau(n, mz);
}
// ---- seiten/suche.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Reiter „Suche“ (Auftrag A6, 25.11.2026): Tage nach Text in der Anmerkung, Art, Ort und Zeitraum finden (GET /api/suche); ein Treffer öffnet den Tag.
const SUCHE_ARBEITSTAG = "arbeitstag";                                  // wie suche.ARBEITSTAG im Kern: die Art „" (gewöhnlicher Arbeitstag)
const SUCHE_TEXT_MAX = 100;                                             // wie suche.TEXT_MAX
const SUCHE_ORTE = [["", "Alle"], ["ho", "Homeoffice"], ["dst", "Büro"]];
const SUCHE_START = "Suchtext eingeben oder Filter wählen, dann „Suchen“ tippen.";
const SUCHE_LEER = "Keine Tage gefunden. Ändere den Suchtext, die Filter oder den Zeitraum.";
const SUCHE_ISO = /^\d{4}-\d{2}-\d{2}$/;                                // nur so wird ein Datum Teil von data-d und der Adresse des Tages
// Kriterien und letzte Antwort, solange die App offen ist: Zurück vom Tag zeigt dieselbe Liste wieder.
let suchWahl = null, suchErgebnis = null;
// Vorgabe: alles im laufenden Jahr.
const sucheVorgabe = () => ({text: "", art: "", ort: "", von: `${heute.getFullYear()}-01-01`, bis: `${heute.getFullYear()}-12-31`});

// Auswahl aus [Wert, Text]-Paaren mit dem gewählten Wert.
const sucheAuswahl = (id, paare, gewaehlt) => `<select id="${id}">${paare.map(([w, t]) => `<option value="${w}"${w === gewaehlt ? " selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
// Arten zur Wahl: alle, Arbeitstag und jede Art, deren Modul eingeschaltet ist.
const sucheArten = () => [["", "Alle Arten"], [SUCHE_ARBEITSTAG, "Arbeitstag"], ...Object.entries(ARTEN).filter(([k]) => k && artAn(k))];
// Treffer als Tag für tagZeileHtml (die setzt Datum, Wochentag, Zeiten und Art roh ein): Datum nur als ISO, Art nur aus ARTEN, Text maskiert,
// Gesamtzeit rechts nur aus ganzen Minuten ab 0; die Notiz maskiert tagZeileHtml selbst.
function sucheTag(t) {
  const datum = SUCHE_ISO.test(t.datum) ? t.datum : "";
  return {datum, tag: datum ? +datum.slice(8) : "", wt: esc(String(t.datum_text || "").split(" ")[0]), ho: esc(t.ho || ""), dst: esc(t.dst || ""),
    art: Object.hasOwn(ARTEN, t.art) ? t.art : "", notiz: t.notiz || "", ist_soll_min: Number.isInteger(t.gesamt_min) && t.gesamt_min > 0 ? t.gesamt_min : 0};
}
// Monat und Jahr eines Treffers („November 2026“) für die Zwischenzeile; die Zeile zeigt nur Tag und Wochentag.
const sucheMonat = datum => datum ? `${MONATE[+datum.slice(5, 7) - 1]} ${datum.slice(0, 4)}` : "";
// Zeilen der Treffer (neueste zuerst, wie der Dienst sie schickt) mit einer Zwischenzeile je Monat.
function sucheZeilen(treffer) {
  let vorher = null;
  return treffer.map(sucheTag).map(z => {
    const m = sucheMonat(z.datum), kopf = m && m !== vorher ? `<div class="kw"><span>${m}</span></div>` : "";
    vorher = m;
    return kopf + tagZeileHtml(z, "", saldoKlasse);
  }).join("");
}
// Ergebnis als Karte: Titel mit der Anzahl, Tageszeilen und Hinweis, wenn nicht alle gezeigt sind; ohne Treffer der Leerzustand mit Symbol.
function sucheErgebnisHtml(e) {
  if (!e.anzahl) return sucheLeerHtml(SUCHE_LEER);
  const mehr = e.mehr ? `<p class="hinweis">Gezeigt sind die neuesten ${e.treffer.length}. Grenze den Zeitraum ein, um die übrigen zu sehen.</p>` : "";
  return `<section class="card" aria-labelledby="s-zahl"><h2 id="s-zahl">${e.anzahl === 1 ? "1 Tag" : `${e.anzahl} Tage`} gefunden</h2>${sucheZeilen(e.treffer)}${mehr}</section>`;
}
// Leerzustand (vor der ersten Suche, ohne Treffer): Karte mit Lupe und Satz wie die Zeit-Seiten; der Knopf „Suchen“ steht schon darüber.
const sucheLeerHtml = text => `<div class="card leer">${sym("suche")}<p>${text}</p></div>`;
// Inhalt des Ergebnisses als Karte: Laden oder Fehler.
const sucheKarte = inhalt => `<div class="card">${inhalt}</div>`;
// Seite „Suche“: Formular mit den gemerkten Kriterien und darunter das letzte Ergebnis.
async function seiteSuche() {
  suchWahl ??= sucheVorgabe();
  const w = suchWahl;
  window.nachher = () => {
    $("#s-text")?.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); sucheStarten(); } });
    if ($("#s-ort")) artBinden("s-ort");
    zeitTagSprung();
  };
  return `<div class="card suche"><h2>Tage suchen</h2>
    <label for="s-text">Text in der Anmerkung</label><input id="s-text" type="search" maxlength="${SUCHE_TEXT_MAX}" value="${esc(w.text)}" autocomplete="off">
    <label for="s-art">Art</label>${sucheAuswahl("s-art", sucheArten(), w.art)}
    ${einOrt() ? "" : `<label id="s-ort-titel">Ort</label>${segHtml(SUCHE_ORTE, w.ort, {id: "s-ort", beschriftet: "s-ort-titel"})}`}
    <div class="reihe"><div><label for="s-von">Von</label><input id="s-von" type="date" ${ZEIT_KAL_GRENZEN} value="${esc(w.von)}"></div>
      <div><label for="s-bis">Bis</label><input id="s-bis" type="date" ${ZEIT_KAL_GRENZEN} value="${esc(w.bis)}"></div></div>
    <div class="knoepfe"><button type="button" class="prim" ${kl("sucheStarten")}>Suchen</button></div></div>
    <div id="s-ergebnis" aria-live="polite">${suchErgebnis ? sucheErgebnisHtml(suchErgebnis) : sucheLeerHtml(SUCHE_START)}</div>`;
}
// Zeigt das Ergebnis und macht die Tage antippbar und per Tastatur erreichbar (wie in Woche und Monat öffnet ein Tag die Seite Tag).
function sucheZeigen(html) {
  const ziel = $("#s-ergebnis");
  ziel.innerHTML = html; beschriften(ziel); zeitTagSprung();
}
// Liest die Kriterien aus dem Formular, fragt den Dienst und zeigt Laden, Ergebnis oder Fehler; die Eingaben bleiben stehen.
async function sucheStarten() {
  const feld = id => $("#" + id).value;
  suchWahl = {text: feld("s-text").trim(), art: feld("s-art"), ort: einOrt() ? "" : $("#s-ort button.on")?.dataset.v ?? "", von: feld("s-von"), bis: feld("s-bis")};
  const abfrage = new URLSearchParams(Object.entries(suchWahl).filter(([, v]) => v));
  sucheZeigen(sucheKarte(`<div class="lade klein" role="status" aria-busy="true" aria-label="Sucht …"></div>`));
  try {
    suchErgebnis = await api("GET", "/suche?" + abfrage);
    sucheZeigen(sucheErgebnisHtml(suchErgebnis));
  } catch (e) {
    suchErgebnis = null;
    sucheZeigen(sucheKarte(meldung(e.message)));
  }
}
// ---- seiten/hilfe.js ----
"use strict";
// Zeiterfassung. © 2026 David Saluda. Alle Rechte vorbehalten. Erstellt mit Unterstützung von KI (Claude, Anthropic).
// Desktop, Android und Server synchronisieren selbst im Hintergrund; die Seite fragt nur, ob sich der Datenstand geändert hat.
// Link direkt zur Release-Seite (neueste Version mit allen Apps) und „Was ist neu?“ (Übersicht im Wiki), in jeder Fassung; nur angeklickt, die App ruft die Seiten nie auf.
function appsLink() {
  return `<br><a href="${ZUTUN_RELEASE}" target="_blank" rel="noopener noreferrer">Neueste Version auf der Release-Seite</a><br>${wikiLink("Was ist neu?", "/Neuigkeiten")}`;
}
// ---- Hilfe & FAQ (Seite „Hilfe“). Hilferunde 23.11.2026: Gruppen, Suchfeld, je Abschnitt 2 bis 4 Sätze mit Weg und Wiki-Link; das Ausführliche steht im Wiki.
// Urheberhinweis sichtbar nur hier (Hilfe-Startseite oben, Eintrag „Datenschutz“), nicht in Fußzeile und Exporten (Entscheidung des Entwicklers 24.11.2026)
const HILFE_URHEBER = '<p class="hinweis" data-stil="margin-bottom:16px">© 2026 David Saluda. Alle Rechte vorbehalten.<br>Erstellt mit Unterstützung von KI (Claude, Anthropic).</p>';
const HILFE_DEMO = "Die Zahlen hier sind die Regeln der Demo.";      // Satz oben, solange die Demo läuft
const HILFE_KEIN_WERT = "–";                                  // steht für eine Zahl, die die API nicht geliefert hat
// Gruppen der Hilfe in fester Folge: [Schlüssel, Titel, Abschnitte]; jeder Abschnitt steht in genau einer Gruppe (Schnittstelle hilfe-schnitt.json).
const HILFE_GRUPPEN = [
  ["erste_schritte", "Erste Schritte", ["zweck", "anfang", "aufbau", "uebersicht_karten", "uebersicht_heute", "uebersicht_anordnen", "startwerte", "demo", "rueckgaengig", "tastatur", "andere_rechner"]],
  ["zeiten_buchen", "Zeiten buchen", ["buchen", "plus_taste", "beginn_korrigieren", "gehen_vergessen", "kurzbefehle", "tag_blatt", "monat_raster", "suche_tage", "wochenziel", "pause", "kappzeit", "gleitzeit", "freizeitkonto", "gleitzeit_verlauf", "kappung", "zutun"]],
  ["abwesenheit", "Abwesenheit", ["urlaub", "zusatzurlaub", "resturlaub", "angespart", "familientage", "sondertage", "planung", "brueckentage", "feiertage", "eigene_feiertage", "jahreswechsel", "krank"]],
  ["auswertung", "Auswertung", ["homeoffice_modus", "quote", "quote_ampel", "spielraum", "uebersicht", "jahresrueckblick", "monatsnachweis", "unterschrift", "export", "exporte"]],
  ["daten_sync", "Daten & Sync", ["sicherung", "handy_sicherung", "daten_pruefen", "app_pruefen", "update", "neue_version", "web_ohne_server", "sync", "github", "anmeldedienst", "sync_aus", "geraet_entfernen"]],
  ["einstellungen", "Einstellungen", ["aussehen", "zeitformat", "abschnitte", "gueltigkeit", "stand_anders", "profile", "module", "zuruecksetzen", "personen", "admin"]],
  ["datenschutz", "Datenschutz", ["datenschutz"]]
];
// Reihenfolge aller Abschnitte (Schlüssel) = Folge der Gruppen; eine Fassung zeigt nur die, deren Bedingung in HILFE_GILT erfüllt ist.
const HILFE_REIHE = HILFE_GRUPPEN.flatMap(([, , abschnitte]) => abschnitte);
// Wiki-Ziel je Abschnitt: Seite#Anker (GitHub-Anker: klein, Satzzeichen weg, Leerzeichen zu „-“). Eine Zeile je Abschnitt (test_fertige_apps liest sie).
const HILFE_WIKI = {
  zweck: "Bedienung-Erste-Schritte#wofür-die-app-gedacht-ist",
  anfang: "Bedienung-Erste-Schritte#erster-start",
  aufbau: "Bedienung-Erste-Schritte#so-ist-die-app-aufgebaut",
  uebersicht_karten: "Bedienung-Erste-Schritte#so-ist-die-app-aufgebaut",
  uebersicht_heute: "Bedienung-Erste-Schritte#so-ist-die-app-aufgebaut",
  uebersicht_anordnen: "Bedienung-Erste-Schritte#kacheln-anpassen",
  startwerte: "Bedienung-Erste-Schritte#mitten-im-jahr-anfangen",
  demo: "Bedienung-Erste-Schritte#mit-beispieldaten-ausprobieren-demo",
  rueckgaengig: "Bedienung-Erste-Schritte#rückgängig",
  tastatur: "Bedienung-Erste-Schritte#bedienung-mit-der-tastatur",
  andere_rechner: "Home#welcher-weg-passt-zu-mir",
  buchen: "Bedienung-Zeiten-und-Stempeluhr#stempeluhr",
  plus_taste: "Bedienung-Zeiten-und-Stempeluhr#stempel-taste",
  gehen_vergessen: "Bedienung-Zeiten-und-Stempeluhr#gehen-vergessen",
  beginn_korrigieren: "Bedienung-Zeiten-und-Stempeluhr#beginn-korrigieren",
  kurzbefehle: "Bedienung-Zeiten-und-Stempeluhr#kurzbefehle-android",
  tag_blatt: "Bedienung-Zeiten-und-Stempeluhr#tag-schnell-eintragen",
  monat_raster: "Bedienung-Zeiten-und-Stempeluhr#woche-und-monat",
  suche_tage: "Bedienung-Zeiten-und-Stempeluhr#tage-suchen",
  wochenziel: "Bedienung-Zeiten-und-Stempeluhr#wochenziel",
  pause: "Bedienung-Zeiten-und-Stempeluhr#pause",
  kappzeit: "Bedienung-Zeiten-und-Stempeluhr#kappzeit",
  gleitzeit: "Bedienung-Zeiten-und-Stempeluhr#gleitzeit-konto-und-freizeitkonto",
  freizeitkonto: "Bedienung-Zeiten-und-Stempeluhr#gleitzeit-konto-und-freizeitkonto",
  gleitzeit_verlauf: "Bedienung-Zeiten-und-Stempeluhr#gleitzeit-verlauf",
  kappung: "Bedienung-Zeiten-und-Stempeluhr#kappung-wann-verfällt-gleitzeit",
  zutun: "Bedienung-Zu-tun#die-einträge",
  urlaub: "Bedienung-Urlaub#urlaub",
  zusatzurlaub: "Bedienung-Urlaub#zusatzurlaub-z-b-bei-schwerbehinderung",
  resturlaub: "Bedienung-Urlaub#resturlaub-und-fristen",
  angespart: "Bedienung-Urlaub#angesparter-urlaub",
  familientage: "Bedienung-Urlaub#familientage",
  sondertage: "Bedienung-Urlaub#sonderurlaub-und-kind-krank",
  planung: "Bedienung-Urlaub#urlaub-planen",
  brueckentage: "Bedienung-Urlaub#brückentage",
  feiertage: "Bedienung-Urlaub#feiertage",
  eigene_feiertage: "Bedienung-Urlaub#eigene-freie-tage",
  jahreswechsel: "Bedienung-Urlaub#jahreswechsel",
  krank: "Bedienung-Krank#krankheit-und-attest",
  homeoffice_modus: "Bedienung-Homeoffice-Quote#homeoffice-modus",
  quote: "Bedienung-Homeoffice-Quote#so-rechnet-die-app-die-quote",
  quote_ampel: "Bedienung-Homeoffice-Quote#quote-ampel",
  spielraum: "Bedienung-Homeoffice-Quote#ho-spielraum",
  uebersicht: "Bedienung-Homeoffice-Quote#homeoffice-übersicht",
  jahresrueckblick: "Bedienung-Homeoffice-Quote#jahresrückblick",
  monatsnachweis: "Bedienung-Exporte#monatsnachweis",
  unterschrift: "Bedienung-Exporte#unterschrift-im-monatsnachweis",
  export: "Bedienung-Exporte#export-und-teilen",
  exporte: "Bedienung-Exporte#formate",
  sicherung: "Bedienung-Daten-und-Sync#sicherung",
  handy_sicherung: "Bedienung-Daten-und-Sync#verschlüsselte-sicherung-android-und-web-app",
  daten_pruefen: "Bedienung-Daten-und-Sync#daten-prüfen",
  app_pruefen: "Bedienung-Daten-und-Sync#app-prüfen",
  update: "Bedienung-Daten-und-Sync#neue-version-installieren-windows-und-android",
  neue_version: "Bedienung-Daten-und-Sync#neue-version-web-app",
  web_ohne_server: "iPhone-iPad-Browser#installieren",
  sync: "Synchronisieren#welcher-weg-passt-zu-mir",
  github: "GitHub-Synchronisieren#so-funktioniert-es",
  anmeldedienst: "Server-Docker-Synchronisieren#windows-und-android-mit-dem-server-verbinden",
  sync_aus: "Synchronisieren#abschalten",
  geraet_entfernen: "Synchronisieren#aus-der-synchronisierung-entfernen",
  aussehen: "Bedienung-Einstellungen#aussehen",
  zeitformat: "Bedienung-Einstellungen#zeitformat",
  abschnitte: "Bedienung-Einstellungen#teilzeit-und-abschnitte",
  gueltigkeit: "Bedienung-Einstellungen#ab-wann-regeln-gelten",
  stand_anders: "Bedienung-Einstellungen#gleitzeit-stand-plötzlich-anders",
  profile: "Bedienung-Einstellungen#module-und-profile",
  module: "Bedienung-Einstellungen#module-und-profile",
  zuruecksetzen: "Bedienung-Einstellungen#module-und-profile",
  personen: "Server-Docker#anmelden",
  admin: "Server-Docker-Admin#personen",
  datenschutz: "Datenschutz#wann-verlässt-etwas-mein-gerät"
};
const HILFE_WIKI_TEXT = "Schritt für Schritt mit Bildern im Wiki";
// Wiki-Link am Ende des Abschnitts s; aria-describedby nennt dem Screenreader den Titel, die Linktexte sind sonst alle gleich.
const hilfeWikiZeile = s => `<p class="hilfe-wiki">${wikiLink(HILFE_WIKI_TEXT, "/" + HILFE_WIKI[s], ` aria-describedby="hf-${s}"`)}</p>`;

// Abschnitte: Titel, Weg in der App (fett in eigener Zeile, leer: keiner) und Text mit {Platzhaltern} und [[Bausteinen]] (hilfeFuellen).
// Kurz halten: 2 bis 4 Sätze mit den Werten der Person; Schritte, Tabellen und Sonderfälle stehen im Wiki. Nur die Datenschutz-Aussage ist länger (Pflicht).
const HILFE_TEXTE = {
  zweck: {titel: "Wofür ist die App gedacht?", weg: "", text: `Sie hält fest, [[zwei_orte]]wann du im Homeoffice (HO) und wann im Büro gearbeitet hast[[/]][[kein]]wann du gearbeitet hast[[/]][[nur]]wann du im Homeoffice gearbeitet hast[[/]], und rechnet daraus {rechnet}. Alles liegt in deiner eigenen Datenbank, ohne Benutzerkonto und ohne Cloud.`},
  anfang: {titel: "Wie fange ich an?", weg: "{weg_einstellungen_arbeitszeit}", text: `<p>Beim ersten Start fragt die Karte <b>Erster Start</b>, ob du die App schon auf einem anderen Gerät nutzt; dann holst du deine Daten per Synchronisieren. Sonst wählst du eine Vorlage, dein Bundesland, die Arbeitszeit[[grenze]], deine Homeoffice-Grenze[[/]] und die Urlaubstage, alles änderst du später in den Einstellungen. Meldet „Fertig“ einen Fehler, springt die Einrichtung in den Schritt mit dem betroffenen Feld, sonst bietet die App einen kurzen Rundgang an, nach einem Update einmal einen durch das Neue (abschaltbar unter {weg_einstellungen_aussehen}). Nach „Später“ kannst du ihn hier jederzeit starten.</p><div class="knoepfe"><button type="button" data-klick="rundgangStart">Rundgang starten</button></div>`},
  aufbau: {titel: "Wie ist die App aufgebaut?", weg: "", text: `<p>Bei dir hat die App {bereiche_zahl} Bereiche, manche mit Reitern oben:</p><ul>{bereiche}</ul><p>Am Handy stehen unten Übersicht, Zeit, die Stempel-Taste, {bereich_homeoffice} und Abwesenheit, den Rest öffnest du über das Menü oben, die Hilfe zur gezeigten Seite über das „?“ daneben; am Rechner steht alles samt „?“ in der Seitenleiste. [[kein]]Ohne Homeoffice heißt der Bereich Homeoffice bei dir „Jahr“. [[/]]Ein abgeschaltetes Modul fehlt ganz.</p>`},
  uebersicht_karten: {titel: "Was zeigt die Übersicht?", weg: "{weg_start}", text: `Oben steht die Karte <b>Heute</b> mit Datum und den Knöpfen zum Stempeln[[uebersicht_kacheln]], darunter Kacheln wie {uebersicht_kacheln}[[/]]; Kleine Kacheln stehen immer zu zweit nebeneinander, am Computer auch größere Karten, die Folge ändert „Kacheln anpassen“. [[quote]]Monat und Jahr zeigen deine Homeoffice-Quote als Ring[[grenze]]: Der Pfeil am Ring ist deine Grenze von {grenze} %, darunter stehen „noch … HO möglich“ und die Prognose zum Jahresende mit „Luft bis {grenze} %“[[/]]. [[/]][[grenze]]Liegt die Prognose über der Grenze, steht eine Warnzeile darunter; ob der Monat über der Grenze liegt, zeigt die Quote-Ampel. [[/]]Ein Tipp auf eine Kachel öffnet ihre Seite[[gleitzeit]], „Gleitzeit“ die Woche gleich beim Gleitzeit-Verlauf[[/]].`},
  uebersicht_anordnen: {titel: "Kann ich die Kacheln anpassen?", weg: "{weg_einstellungen_aussehen} → Kacheln anpassen", text: `Du wählst, welche Karten die Übersicht zeigt und in welcher Folge; das gilt nur auf diesem Gerät. Die Karte „Heute“ steht immer oben, ab Werk danach die Kacheln Heute und Diese Woche, dann Gleitzeit, was zu tun ist[[quote]] und die Quoten; eine Warnung zur Jahres-Prognose bleibt an der Stelle der Quote im Jahr, auch wenn du die Karte ausblendest; ob der Monat über der Grenze liegt, zeigt die Quote-Ampel[[/]].[[zutun]] Blendest du „Zu tun“ aus, ist es ganz aus: keine Einträge auf der Übersicht, auch keine dringenden, und keine Zahl am Symbol.[[/]] Schneller hin geht es mit <b>Kacheln anpassen</b> unten auf der Übersicht.`},
  uebersicht_heute: {titel: "Was zeigt die Kachel Heute?", weg: "{weg_start}", text: `Die Kachel <b>Heute</b> zeigt, was du heute gearbeitet hast, und dein Tagessoll[[gleitzeit]], dazu den Saldo heute[[/]]. Darunter steht, wann dein Tagessoll erreicht ist („Bis 16:12“) oder wie viel noch fehlt[[stempel]], bei laufender Uhr auch die <span class="am-stueck">10-Stunden-Grenze</span> (ab Werk 10 Stunden, folgt deiner Einstellung; das Band der Uhr auf den anderen Seiten nennt beides, Pause und gebuchte Zeit eingerechnet: „Soll erreicht um 16:30 · <span class="am-stueck">10-Stunden-Grenze</span> um 18:30“)[[/]]; an Wochenende und Feiertag steht „zählt zum Freizeitkonto“, an Abwesenheitstagen die Art. [[woche]]Die Kachel Diese Woche zeigt Ist und Saldo der Woche.[[/]][[gleitzeit]] Die Kachel Gleitzeit zeigt dein Konto und darunter den Gleitzeit-Verlauf der letzten 3 Wochen, wie auf der Seite Woche.[[/]]`},
  beginn_korrigieren: {titel: "Wie korrigiere ich den Beginn der Stempeluhr?", weg: "", text: `Läuft die Uhr, ändert <b>Beginn korrigieren</b> (Karte Heute, Blatt der Stempeluhr, Band oben) nur den Beginn: früher oder später, nie in der Zukunft, ohne Überschneidung mit anderen Einträgen; <b>Rückgängig</b> stellt ihn wieder her. Gehen ist ab Werk bis 23:59 am Tag des Beginns möglich. Läuft die Uhr über Mitternacht, fragt die App beim nächsten Öffnen, wann du gegangen bist. Wer über Mitternacht stempelt, schaltet unter {weg_einstellungen_arbeitszeit} „Stempeluhr über Mitternacht erlauben“ ein.`},
  startwerte: {titel: "Ich fange mitten im Jahr an. Was trage ich ein?", weg: "{weg_einstellungen_person}", text: `Unter „Erfassung gültig ab“ trägst du das Datum ein, ab dem du mit der App erfasst, und deinen Stand des Jahres bis zum Tag davor: [[zwei_orte]]„HO-Zeit“ und „Büro-Zeit“[[/]][[kein]]„Büro-Zeit“[[/]][[nur]]„HO-Zeit“[[/]][[start_tage]], schon genommene {start_tage}[[/]][[gleitzeit]] und den „Gleitzeit-Saldo“[[/]]; dann „Startwerte speichern“. Soll, Ist und Gleitzeit zählen erst ab dem Datum; Tage davor bleiben sichtbar, zählen aber nicht. Die Startwerte gelten nur im Jahr des Datums.`},
  demo: {titel: "Demo-Modus", weg: "{weg_einstellungen} → Demo-Modus", text: `Mit Beispieldaten probierst du die App aus, ohne deine echten Daten anzufassen; die Demo nutzt eine eigene Datenbank. Die Beispieltage sind zufällig und passen zu deinen Regeln. Die Karte gibt es nur, solange die App leer ist und nicht synchronisiert; „Demo beenden“ führt zurück.`},
  rueckgaengig: {titel: "Kann ich etwas rückgängig machen?", weg: "", text: `Nach dem Speichern zeigt unten eine Leiste {rueck_sekunden} Sekunden lang <b>Rückgängig</b>; am Rechner geht auch <b>Strg+Z</b> (Mac: ⌘+Z). Das gilt für Tage[[planung]] und geplanten Urlaub[[/]][[stempel]], auch für Kommen mit der Stempel-Taste, Gehen und Beginn korrigieren[[/]]. Es gibt nur eine Stufe, der nächste Schritt ersetzt den vorigen[[sicherung]]; geleerte Tage und gelöschte Einträge holst du aber 30 Tage lang aus dem <b>Papierkorb</b> unter {weg_sicherung} zurück[[/]].`},
  tastatur: {titel: "Bedienung mit der Tastatur", weg: "", text: `Mit <b>Tab</b> erreichst du alle Knöpfe, Felder und Tage, <b>Enter</b> oder die <b>Leertaste</b> öffnet sie. Die <b>Pfeiltasten</b> blättern, <b>T</b> springt zu heute, <b>N</b> trägt heute ein, <b>Esc</b> schließt ein Blatt, und solange es offen ist, bleibt <b>Tab</b> im Blatt. Der erste Druck auf Tab zeigt oben links „Zum Inhalt springen“: Damit überspringst du das Menü.`},
  andere_rechner: {titel: "Gibt es die App auch für andere Rechner?", weg: "", text: `Als eigenes Programm gibt es die App für Windows und Android. Auf allen anderen Rechnern nimmst du die Web-App im Browser, oder du betreibst sie selbst als Server (Docker), z. B. auf einer NAS.`},
  buchen: {titel: "Wie buche ich meine Zeit?", weg: "[[monat]]{weg_monat}[[sonst]]{weg_woche}[[/]]", text: `[[stempel]]Mit der <b>Stempeluhr</b>: Kommen beim Anfangen, Gehen am Ende, am Handy mit der Stempel-Taste unten, sonst mit „Kommen“ in der Übersicht. Gebucht wird auf den Tag des Beginns (über Mitternacht siehe unten); mehrere Einträge (Kommen und Gehen) an einem Tag stehen unter {weg_tag} einzeln (Ort, von–bis, Dauer), auch auf deinen anderen Geräten, und im Bearbeiten-Formular als Blöcke („+ Block“), die Lücke dazwischen zählt auf die Pflichtpause an, und der Monatsnachweis mit Beginn und Ende und die CSV haben je Block eine Zeile mit der Tagessumme in der letzten. Solange die Uhr läuft, zählt der heutige Tag unter {weg_tag} sie in Ist und Saldo mit (so, wie „Gehen“ jetzt buchen würde, mit Pflichtpause und Kappzeit) und zeigt eine Zeile „läuft“; ein Tipp darauf öffnet die Stempeluhr. Vergessenes trägst du im Kalender nach, „Heute eintragen“ in der Übersicht öffnet den heutigen Tag.[[sonst]]Die Stempeluhr ist bei dir aus. Du trägst deine Zeit im Tag ein; „Heute eintragen“ in der Übersicht öffnet den heutigen Tag.[[/]]`},
  plus_taste: {titel: "Was macht die Stempel-Taste?", weg: "", text: `Am Handy steht die Stempel-Taste unten in der Mitte und zeigt mit ihrem Symbol, was als Nächstes kommt[[stempel]]; am Rechner stempelst du mit Kommen und Gehen in der Karte Heute der Übersicht[[/]]. [[stempel]]Bei Kommen [[einort]]stempelt schon der erste Tipp, weil es bei dir nur einen Ort gibt[[sonst]]zeigt ein Tipp die Wahl Homeoffice oder Büro, der zweite stempelt[[/]]. Gehen bucht sofort aus (der Knopf nennt deinen Beginn, z. B. „Gehen (seit 07:30)“), die Pause kommt aus deiner Pausenregel ({pausenregel}); läuft die Uhr seit einem früheren Tag, öffnet die Taste das Blatt der Stempeluhr, damit du die echte Endzeit einträgst.[[sonst]]Die Stempeluhr ist bei dir aus, darum öffnet die Taste „Heute eintragen“.[[/]]`},
  gehen_vergessen: {titel: "Ich habe vergessen zu gehen", weg: "", text: `Läuft die Stempeluhr noch von einem früheren Tag oder seit über 10 Stunden, fragt die App beim Öffnen, wann du gegangen bist. Ohne die Einstellung „Stempeluhr über Mitternacht erlauben“ gilt als Ende höchstens 23:59 am Tag des Beginns. Die Uhrzeit ist nach deinem Tagessoll vorbelegt. „Später“ fragt erst beim nächsten Öffnen der App wieder.`},
  kurzbefehle: {titel: "Was machen die Kurzbefehle am App-Symbol (Android)?", weg: "", text: `Drück lange auf das Symbol der App: Es erscheinen <b>Kommen Homeoffice</b>, <b>Kommen Büro</b> und <b>Gehen</b> (ab Android 7.1). Ein Tipp stempelt wie die Stempel-Taste. Passt der Kurzbefehl gerade nicht, bucht die App nichts und öffnet die Stempeluhr.`},
  tag_blatt: {titel: "Wie trage ich einen Tag schnell ein?", weg: "{weg_tag}", text: `Ein Tipp auf einen Tag in Woche oder Monat öffnet ihn; oben stehen Soll und Ist, darunter jeder Eintrag für sich: Antippen ändert oder löscht nur diesen, „+ Eintrag“ legt einen weiteren an, auch an einem Tag mit Zeit (nie über schon gebuchte Zeit oder die laufende Stempeluhr), und Stunden ohne Uhrzeit sind ein eigener Eintrag. <b>Bearbeiten</b> öffnet den ganzen Tag: In der Karte <b>Art des Tages</b> füllt ein Tipp auf {schnellwahl} das Formular nur vor (Arbeit mit deinem Tagessoll), „Mehr“ klappt die Liste aller Arten auf (ein ganzer Tag wie Urlaub leert dabei Stunden und Uhrzeiten), „–“ darin nimmt eine Art weg, und gespeichert wird erst mit „Speichern“. Die Karte <b>Zeiten</b> hat die Tageserfassung (Stunden), die Einzelerfassung (Kommen, Gehen, Pause[[zwei_orte]], der gemischte Tag[[/]]) und die Anmerkung; „Über 10 Stunden freigegeben“ erscheint erst an der Tagesgrenze. Am Rechner steht der Tag rechts daneben, Enter speichert.`},
  monat_raster: {titel: "Wie lese ich den Monat?", weg: "{weg_monat}", text: `Der Monat öffnet als Kalender; jeder Tag hat eine Farbe und dazu einen Buchstaben, die Legende steht darunter. Mit <b>Raster | Liste</b> wechselst du zur Liste (ein späterer Tag ohne Eintrag zeigt dort blass sein Soll), die App merkt sich die Wahl auf diesem Gerät. Ein Tipp auf einen Tag öffnet die Seite Tag. Am Handy blätterst du in Tag, Woche und Monat auch durch Wischen nach links oder rechts.`},
  suche_tage: {titel: "Wie finde ich einen Tag wieder?", weg: "{weg_suche}", text: `Tippe oben auf die <b>Lupe</b> oder wähle Zeit › Suche (am Handy fehlt die Lupe mit Abmelden-Knopf oder auf Seiten mit Zurück-Pfeil, mit beiden auch „Heute im Monat“; dann führt „Heute“ auf der Seite Monat zum heutigen Tag). Du suchst nach einem Wort in der Anmerkung, nach Art[[zwei_orte]], Ort[[/]] und Zeitraum (ab Werk das laufende Jahr). Je Tag steht eine Zeile mit Datum, Art oder Ort, Zeit und Anmerkung, nach Monaten gruppiert; ein Tipp darauf öffnet den Tag.[[zwei_orte]] Ein Tag mit Homeoffice und Büro gilt als Büro-Tag.[[/]]`},
  wochenziel: {titel: "Was zeigt das Wochenziel?", weg: "{weg_woche}", text: `Die Karte <b>Diese Woche</b> zeigt Ist, Soll der ganzen Woche und den Saldo der Woche. Ein Balken zeigt, wie viel vom Wochensoll geschafft ist; der Strich markiert das Soll bis heute. Das <b>Tagesziel</b> („Bis 16:12 für dein Tagessoll“, Pause eingerechnet, höchstens bis zur Tagesgrenze: ab Werk 10 Stunden, folgt deiner Einstellung) steht in der Kachel Heute der Übersicht[[stempel]] und wechselt bei laufender Uhr mit der Uhrzeit[[/]].`},
  pause: {titel: "Pause und Tagesgrenze", weg: "{weg_einstellungen_arbeitszeit}", text: `Die Pflichtpause kommt aus deiner Pausenregel: <b>{pausenregel}</b>. [[pausen]]Lücken zwischen deinen Einträgen und Pausen von Hand zählen an, nur der Rest geht vom letzten Eintrag ab; jede Stufe zählt anteilig, über {pause_ab} Std. sind es {pause_dauer}, bei {pause_zwischen} genau {pause_zwischen_min} Minuten, ab {pause_voll} die volle Pause.[[sonst]]Bei dir gilt keine Pausenregel, die App zieht keine Pause ab.[[/]] [[stempel]]„Pause“ an der Stempeluhr bucht Gehen, „Weiter“ wieder Kommen; die Lücke dazwischen ist deine Pause.[[/]] Mehr als 24 Stunden nimmt die App nie an, über der Tagesgrenze siehe Kappzeit.`},
  kappzeit: {titel: "Was ist Kappzeit?", weg: "{weg_einstellungen_arbeitszeit}", text: `Kappzeit ist gearbeitete Zeit, die nicht zählt: vor dem Beginn und nach dem Ende der Regelarbeitszeit (ab Werk 06:00 bis 20:00, auch mit Freigabe) und, ohne „Über 10 Stunden freigegeben“, alles über der Tagesgrenze (ab Werk 10 Stunden nach der Pause). Die Seite Tag zeigt sie unter Soll und Ist mit dem Grund; die Monatsdatei (PDF, Excel), der Monatsnachweis mit Zeiten und die CSV „Alle Tage“ haben dann eine Spalte Kappzeit. Beides stellst du unter {weg_einstellungen_arbeitszeit} ein oder ab, mit „gilt ab“ wie die anderen Regeln. Tage vor dem 26.11.2026 rechnen wie bisher.`},
  gleitzeit: {titel: "[[gleittage+gleitzeit]]Was ist der Unterschied zwischen Gleittagen und Gleitzeit-Konto?[[/]][[gleittage+!gleitzeit]]Was sind Gleittage?[[/]][[!gleittage+gleitzeit]]Was ist das Gleitzeit-Konto?[[/]]", weg: "[[gleitzeit]]{weg_einstellungen_person}[[/]]", text: `[[gleittage]][[keine_gleittage]]<b>Gleittage</b> sind ganze freie Tage; bei dir sind keine vorgesehen.[[sonst]]<b>Gleittage</b> sind ganze freie Tage, höchstens <b>{gleittage_max}</b> im Jahr.[[/]][[/]][[gleittage+gleitzeit]] [[/]][[gleitzeit]]Das <b>Gleitzeit-Konto</b> ist Ist minus Soll über alle Tage plus dein Anfangsstand. Stimmt der Stand nicht, trägst du ihn mit Datum neu ein.[[/]]`},
  freizeitkonto: {titel: "Freizeitkonto und Wochenendarbeit", weg: "{weg_einstellungen_person}", text: `Arbeit an einem Samstag, Sonntag oder Feiertag zählt nicht zur Gleitzeit, sondern zum <b>Freizeitkonto</b>. Abgebaut wird es mit der Art <b>Freizeitausgleich</b> an einem Arbeitstag. Den Startstand legst du in den Einstellungen fest.`},
  gleitzeit_verlauf: {titel: "Was zeigt der Gleitzeit-Verlauf?", weg: "{weg_woche}", text: `Die Karte <b>Gleitzeit-Verlauf</b> zeigt den Stand deines Gleitzeit-Kontos: auf der Seite Tag die letzten 10 Tage, in der Woche die letzten 3 Wochen, im Monat die letzten 3 Monate, auf der Seite Jahr das ganze Jahr[[gleitzeit_grenzen]], mit Grenzlinien bei {gleitzeit_linien}[[/]]. Links stehen die Stunden, die Nulllinie ist kräftiger; unten stehen Tage, Kalenderwochen oder Monate; die laufende Uhr zählt hier nicht mit. [[zutun]][[gleitzeit_grenzen]]Liegt das Konto darüber, steht ein Hinweis in „Zu tun“.[[/]][[sonst]]Die Karte „Zu tun“ ist bei dir aus, darum gibt es keinen Hinweis.[[/]][[zutun]] Die Grenzen stellst du bei den Regeln ein; 0 heißt kein Hinweis.[[/]]`},
  kappung: {titel: "Was ist die Kappung der Gleitzeit?", weg: "{weg_einstellungen_arbeitszeit}", text: `Ist die <b>Kappung der Gleitzeit</b> an, verfällt mit Ablauf des Stichtags ({kappung_stichtag}) das Plus über der Grenze ({kappung_grenze} Std.); ein Minus bleibt, das Freizeitkonto auch. Eine <b>genehmigte Übernahme</b> trägst du je Jahr in der Karte „Übernahme der Gleitzeit“ ein, sie bleibt zusätzlich. Ab Werk ist die Kappung nur bei „Beamte Bayern“ an, zum ersten Mal 2027. [[zutun]]Vier Wochen vorher warnt „Zu tun“.[[/]]`},
  zutun: {titel: "Was zeigt die Karte „Zu tun“?", weg: "{weg_start}", text: `Die Karte in der Übersicht sammelt, worum du dich kümmern solltest: <b>rot</b> ist dringend, <b>gelb</b> bald[[monat]]; fehlen mehrere Arbeitstage, öffnet je Tag ein Knopf den Tag zum Nachtragen (bei mehr als 8 erst die letzten 8, „Alle Tage“ zeigt alle)[[/]]. [[sicherung]]Nach {sicherung_tage} Tagen ohne Sicherung erinnert sie dich.[[/]] [[gleitzeit+gleitzeit_grenzen]]Liegt dein Gleitzeit-Konto über {gleitzeit_grenzen}, meldet sie das.[[/]] „Später“ blendet einen Eintrag 7 Tage aus, „Nicht mehr zeigen“ für immer; „Nicht mehr zeigen“ gibt es nicht für rote Einträge.`},
  urlaub: {titel: "Wie funktioniert der Urlaub?", weg: "{weg_urlaub} → Erweitert", text: `Dein Anspruch: <b>{urlaub_tage} Tage</b> im Jahr, wenn du für ein Jahr keinen eigenen Wert einträgst. Der Resturlaub geht von selbst ins nächste Jahr (mit Frist, siehe unten), den Übertrag kannst du von Hand korrigieren. Halbe Tage gibt es nicht.`},
  zusatzurlaub: {titel: "Zusatzurlaub (z. B. bei Schwerbehinderung)", weg: "{weg_einstellungen_arbeitszeit}", text: `Zusatzurlaub erhöht den Jahresanspruch (Seite Urlaub: „davon Zusatzurlaub“), ab Werk gibt es keinen; bei <b>Schwerbehinderung</b> sind es 5 Tage bei 5 Arbeitstagen pro Woche, sonst anteilig (§ 208 SGB IX, für Beamte Bayern genauso). Beginnt oder endet sie im Jahr, gibt es 1/12 je vollem Monat, jeder Bruchteil zu deinen Gunsten aufgerundet (4,17 auf 5); wechseln deine Arbeitstage, zählt die Woche mit mehr Tagen, und der <b>eigene Wert</b> (0 bis 30 Tage) gilt für das ganze Jahr. Genommen wird erst ein Rest aus dem Vorjahr, dann der Zusatzurlaub, dann der normale Urlaub; ein Rest an Zusatzurlaub wird nicht angespart, bei <b>Beamten Bayern</b> verfällt er am 30.06. Gleichgestellte (GdB 30/40 mit Gleichstellung) haben keinen Zusatzurlaub.`},
  resturlaub: {titel: "Bis wann gilt mein Resturlaub?", weg: "{weg_urlaub} → Erweitert", text: `Ab dem Urlaubsjahr 2025 gilt der Resturlaub nur bis zu einer Frist, je nach <b>Dienstverhältnis</b> (eigene Wahl unter {weg_einstellungen_arbeitszeit}, gilt ab 1.1. des Jahres); Urlaub vor der Frist nimmt zuerst den Resturlaub, „Zu tun“ erinnert sechs Wochen vorher. <b>Beamte Bayern:</b> Er gilt bis 30.06., danach spart die App ihn selbst an (höchstens die Hälfte des Jahresurlaubs ohne Zusatzurlaub in ganzen Tagen, höchstens 15 Tage, nutzbar ab 01.07.); was darüber liegt oder ohne das Modul „Angesparter Urlaub“ übrig ist, verfällt. <b>Eigene Frist</b> (andere Beamte, etwa im Bund oder in anderen Ländern): Er gilt bis zu dem Tag, den du einträgst (nicht der 29.02.), danach wird er wie bei Beamten in Bayern angespart, wenn du das wählst (nur mit dem Modul „Angesparter Urlaub“), sonst verfällt er; die Kappung der Gleitzeit ist dabei ab Werk aus. <b>Angestellte und andere:</b> Er gilt bis 31.03. und verfällt danach voraussichtlich (nur, wenn dein Arbeitgeber vorher darauf hingewiesen hat), außer du setzt „Resturlaub behalten“.`},
  angespart: {titel: "Wie funktioniert angesparter Urlaub?", weg: "{weg_urlaub} → Erweitert", text: `Angesparter Urlaub gilt vor allem für Beamte, zum Beispiel in Bayern (UrlMV). Er wird als Konto je Herkunftsjahr geführt und mit der Art „Angesparter Urlaub“ genommen, das älteste Konto zuerst[[zutun]]; 90 Tage vor dem Verfall erinnert „Zu tun“ mit Datum[[/]]. Für Beamte Bayern legt die App das Konto nach dem 30.06. selbst an. Brauchst du ihn nicht, schalte das Modul unter <b>{weg_einstellungen_module}</b> ab.`},
  familientage: {titel: "Familientage", weg: "{weg_urlaub} → Erweitert", text: `Familientage gelten vor allem für Beamte, zum Beispiel in Bayern: Du tauschst 10 % der Arbeitszeit gegen bis zu {familientage_max} freie Tage im Jahr. Sie sind ab Werk aus, du schaltest sie je Jahr ein. Brauchst du sie nicht, schalte das Modul unter <b>{weg_einstellungen_module}</b> ab.`},
  sondertage: {titel: "[[sonderurlaub+kind_krank]]Was sind Sonderurlaub und Kind krank?[[/]][[sonderurlaub+!kind_krank]]Was ist Sonderurlaub?[[/]][[!sonderurlaub+kind_krank]]Was ist Kind krank?[[/]]", weg: "{weg_sondertage}", text: `[[sonderurlaub+kind_krank]]Sonderurlaub und Kind krank sind eigene Arten[[sonst]][[sonderurlaub]]Sonderurlaub ist eine eigene Art[[sonst]]Kind krank ist eine eigene Art[[/]][[/]] für einen ganzen Arbeitstag: Er gilt als erfüllt wie Urlaub, vom Urlaub geht nichts ab. [[kind_krank]][[kk_eigen]]Für Kind krank hast du {kind_krank_max} Tage im Jahr selbst eingetragen.[[sonst]]Kind krank hat ein Jahreslimit. Bei dir: {kind_krank_dienst}, also {kind_krank_max} Tage im Jahr {jahr}.[[/]] Die Zahlen folgen dem Gesetz (Stand 19.11.2026), können sich ändern und sind keine Rechtsauskunft; die Vorgabe wählst du unter {weg_einstellungen_arbeitszeit}, dann zeigt das Feld ihre Tage für das gezeigte Jahr (bei „Eigener Wert“ bleibt die Zahl).[[/]]`},
  planung: {titel: "Urlaub planen", weg: "{weg_urlaub} → Geplant → Urlaub planen", text: `Hier trägst du kommende Tage ein ({plan_arten}): Im Blatt „Urlaub planen“ wählst du die Art, tippst im Monat den ersten und dann den letzten Tag an und bestätigst mit „Eintragen“. Die Vorschau zeigt, wie viele Tage abgehen, Wochenenden und Feiertage zählen nicht. Ab 1.11. starten Urlaub und Sondertage im Folgejahr (zurück mit ‹), im Dezember erinnert „Zu tun“ an die Planung des Folgejahres. <b>In Kalender übernehmen</b> gibt die Zeiträume an den Kalender deines Geräts.`},
  brueckentage: {titel: "Wo lohnt sich ein Brückentag?", weg: "{weg_urlaub} → Brückentage", text: `Die Karte „Brückentage“ zeigt bis zu 25 Vorschläge (ab 1.11. je eine Karte für das laufende Jahr und das Folgejahr), bei denen sich Urlaub rund um einen Feiertag lohnt, nach deinen Feiertagen und Arbeitstagen: bis zu 10 Urlaubstage, auch über mehrere Feiertage hinweg, und dafür mindestens doppelt so viele freie Tage. Die besten stehen oben.[[planung]] Antippen öffnet das Blatt „Urlaub planen“ mit diesen Tagen; eingetragen wird erst mit „Eintragen“.[[sonst]] Den Urlaub trägst du dann selbst im Kalender ein.[[/]]`},
  feiertage: {titel: "Feiertage, freie Tage und Faschingsdienstag", weg: "{weg_einstellungen_arbeitszeit}", text: `Feiertage gelten für <b>{bundesland}</b>, die App rechnet sie selbst aus. Der 24.12. ist {heiligabend}, der 31.12. {silvester}, der Faschingsdienstag {fasching}.[[by]] Der 15.8. (Mariä Himmelfahrt) ist bei dir {himmelfahrt}.[[/]] Eigene Feiertage legst du bei den Regeln an.`},
  eigene_feiertage: {titel: "Kann ich eigene Feiertage anlegen?", weg: "{weg_einstellungen_arbeitszeit}", text: `In der Karte <b>Feiertage</b> legst du eigene freie Tage an, einmalig oder jedes Jahr; sie wirken wie gesetzliche Feiertage. Einen berechneten Feiertag kannst du dort auch abwählen, dann ist er ein normaler Arbeitstag. Die App lädt dafür keinen Kalender aus dem Internet.`},
  jahreswechsel: {titel: "Was passiert beim Jahreswechsel?", weg: "{weg_start}", text: `Im Januar führt die Karte <b>Jahreswechsel</b> in der Übersicht durch das alte Jahr: Gleitzeit-Stand prüfen, Homeoffice-Übersicht laden und sichern. Jeder Schritt erscheint nur mit seinem Modul, erledigte merkt sich die App auf allen Geräten. Ab Februar ist die Karte weg.`},
  krank: {titel: "Krankheit und Attest", weg: "{weg_krank}", text: `Zusammenhängende Kranktage bilden eine Phase; nach 3 Tagen trägst du das Attest-Datum ein. Kranktage zählen nur an Arbeitstagen. <b>Krank im Dienst</b> ist kein Kranktag: Die gearbeitete Zeit zählt als {ort_arbeit}, die fehlende Zeit bis zum Tagessoll füllt die App auf[[quote]], für die Quote zählt nur die gearbeitete Zeit[[/]].`},
  homeoffice_modus: {titel: "Homeoffice: mit Grenze, ohne Grenze, kein oder nur Homeoffice", weg: "{weg_einstellungen_arbeitszeit}", text: `Bei den Regeln stellst du ein, was für dich gilt, jetzt: <b>{ho_modus}</b>. <b>Mit Grenze</b> rechnet die App die Quote und warnt, <b>ohne Grenze</b> steht die Quote nur zur Info da. Bei <b>kein Homeoffice</b> gibt es nur Büro, bei <b>nur Homeoffice</b> keine Quote. Schon eingetragene Zeiten bleiben erhalten.`},
  quote: {titel: "[[grenze]]Was bedeutet die Homeoffice-Quote und die Grenze?[[sonst]]Was bedeutet die Homeoffice-Quote?[[/]]", weg: "[[grenze]]{weg_horest}[[sonst]]{weg_jahr}[[/]]", text: `Die Quote ist die Homeoffice-Zeit geteilt durch die ganze Arbeitszeit, minutengenau. [[grenze]]Die Grenze liegt bei <b>{grenze} %</b>: Genau {grenze} % sind erlaubt, rot wird es erst darüber.[[sonst]]Bei dir gibt es keine Grenze, die Quote steht nur zur Info da.[[/]] Ein Tag mit Homeoffice und Büro zählt als Büro-Tag.[[krank]] Bei „Krank im Dienst“ zählt nur die gearbeitete Zeit.[[/]]`},
  quote_ampel: {titel: "Was zeigt die Quote-Ampel?", weg: "{weg_monat}", text: `Die Ampel zeigt, wie viel Büro-Zeit du im laufenden Monat noch brauchst, damit die Quote am Monatsende nicht über {grenze} % liegt. Gerechnet wird mit dem Soll der restlichen Arbeitstage (Urlaub und Feiertage zählen nicht als Arbeitstage), eine laufende Stempeluhr zählt mit. <b>Im Rahmen</b>: keine Büro-Zeit mehr nötig; <b>Büro-Zeit nötig</b>: mit der genannten Büro-Zeit noch zu schaffen; <b>Nicht zu halten</b>: auch mit Büro an allen restlichen Tagen nicht mehr zu schaffen. Du findest sie auf der Seite Monat und als Kachel auf der Übersicht (unter „Kacheln anpassen“ ein- und ausblendbar).`},
  spielraum: {titel: "Was zeigt „HO-Spielraum“?", weg: "{weg_horest}", text: `Der Spielraum zeigt, wie viel Homeoffice du noch dazunehmen kannst, ohne über {grenze} % zu kommen, wenn du an den restlichen Tagen nach Soll arbeitest. Oben in der Karte für den Monat und in der Karte „Jahr – Ist“ zeigt ein Ring die Quote bis heute. Die <b>Jahres-Prognose</b> nimmt eine feste Zahl Büro-Tage pro Woche an (0 bis 5 oder „Automatisch“ nach dem Schnitt deiner gebuchten Wochen) und zeigt die Quote zum Jahresende.`},
  uebersicht: {titel: "Was steht in der Homeoffice-Übersicht?", weg: "{weg_steuer}", text: `Pro Jahr stehen darin die Zahl der {uebersicht_tage} und die Stunden[[quote]] mit der Quote[[/]].[[krank]] Die Kranktage stehen zusätzlich einzeln mit Attest-Datum.[[/]]`},
  jahresrueckblick: {titel: "Was zeigt der Jahresrückblick?", weg: "{weg_jahr}", text: `Die Seite Jahr zeigt [[quote]]Quote, [[/]]Stunden[[krank]], Kranktage[[/]][[gleitzeit]] und den Verlauf des Gleitzeit-Kontos[[/]].[[ex_pdf]] „Jahres-PDF“ speichert den Rückblick mit allen Monaten.[[sonst]] Darunter stehen alle Monate als Tabelle.[[/]]`},
  monatsnachweis: {titel: "Was steht im Monatsnachweis?", weg: "{weg_monatsnachweis}", text: `Der Nachweis für deinen Arbeitgeber (PDF oder Word) enthält jeden Tag mit Stunden und Anmerkung, die Summen und oben Name, Arbeitgeber und Personalnummer aus den Einstellungen. Quote, Homeoffice und Büro stehen nicht darin, Kranktage nur als „abwesend“. Deine Anmerkung steht wörtlich darin, schreib dort also nichts, was dein Arbeitgeber nicht lesen soll.`},
  unterschrift: {titel: "Unterschrift im Monatsnachweis", weg: "{weg_monatsnachweis}", text: `Ab Werk stehen am Ende des Nachweises zwei Spalten: links „Ort, Datum“, rechts „Unterschrift“ mit deinem Namen in Großbuchstaben. Mit dem Schalter „Zweite Unterschrift“ kommt eine dritte Spalte für „Vorgesetzter/Vorgesetzte“ dazu. Der Ort ist ab Werk leer, das Datum steht ab Werk auf „leer (von Hand)“.`},
  export: {titel: "Export und Teilen", weg: "{weg_export}", text: `Hier erstellst du Dateien und gibst sie weiter. Mit „Teilen statt Herunterladen“ öffnet sich das Teilen-Menü deines Geräts für Mail, Nachrichten oder andere Apps; am Handy als App vom Home-Bildschirm immer.[[sicherung]] Die ganze Datenbank lädst du unter <b>{weg_sicherung}</b> mit „Sicherung herunterladen“.[[/]]`},
  exporte: {titel: "Welche Formate gibt es?", weg: "{weg_export}", text: `Es gibt {export_formate}. [[ex_pdf]]PDF eignet sich zum Lesen und Drucken. [[/]][[ex_office]]{office_formate} öffnest du im Office-Programm. [[/]][[ex_daten]]CSV ist für andere Programme.[[/]]`},
  sicherung: {titel: "Wie sichere ich meine Daten?", weg: "{weg_sicherung}", text: `[[am_server]]Der Server sichert jede Nacht um 03:10 Uhr in seinen Datenordner, holt eine ausgefallene Sicherung beim Start nach[[sonst]][[im_browser]]Die Web-App legt jeden Tag beim ersten Start eine Sicherung im Speicher des Browsers an[[sonst]]Die App legt jeden Tag beim ersten Start eine Sicherung im Datenordner an[[/]][[/]] und behält die letzten sieben; „Sicherung herunterladen“ speichert die ganze Datenbank, „Wiederherstellen“ spielt sie wieder ein. [[zutun]][[sync]]Ohne Synchronisieren erinnert[[sonst]]Bei dir erinnert[[/]] „Zu tun“ nach {sicherung_tage} Tagen ohne Sicherung.[[sonst]]Die Karte „Zu tun“ ist bei dir aus, die App erinnert dich nicht.[[/]] Vor dem Wiederherstellen sichert die App den alten Stand.`},
  handy_sicherung: {titel: "Verschlüsselte Sicherung", weg: "{weg_sicherung}", text: `[[im_browser]]Die Web-App erstellt mit „Sicherung erstellen“ eine <b>verschlüsselte</b> Kopie deiner Daten (AES-256), mit einem Passwort, das du unter „Passwort der Sicherung“ festlegst. Mit „Neueste Sicherung als Datei speichern“ legst du sie außerhalb der App ab, etwa in iCloud Drive.[[sonst]]Die Android-App legt eine <b>verschlüsselte</b> Kopie deiner Daten (AES-256) in deinen Cloud-Speicher, mit einem Passwort, das du festlegst. Du wählst, wie oft gesichert wird und wie viele Sicherungen bleiben.[[/]] <b>Ohne das Passwort ist die Sicherung nicht lesbar</b>, niemand kann es zurücksetzen.`},
  daten_pruefen: {titel: "Was macht „Daten prüfen“?", weg: "{weg_sicherung}", text: `<b>Daten prüfen</b> sucht Fehler in deinen Einträgen und ändert nichts: Gehen vor Kommen, doppelt belegte Tage, Arbeit an Feiertagen oder mehr Urlaub als Anspruch. Jeder Fund ist ein Link zum Tag. Solche Einträge kommen meist beim Synchronisieren, über einen Import oder eine alte Sicherung.`},
  app_pruefen: {titel: "Wie prüfe ich, ob die App richtig rechnet?", weg: "{weg_sicherung}", text: `<b>App prüfen</b> rechnet einen festen Satz erfundener Tage durch und vergleicht mit Werten, die von Hand gerechnet sind. Die Prüfung läuft in einer eigenen Datenbank im Speicher und fasst deine Daten nicht an. Jede Fassung der App liefert dasselbe Ergebnis.`},
  update: {titel: "Wie erfahre ich von einer neuen Version?", weg: "", text: `Die Windows- und die Android-App fragen alle 30 Tage bei GitHub nach der Nummer der neuesten Version; eine neuere steht in „Zu tun“ mit <b>Zum Download</b>, installieren musst du sie selbst. {update_stand} {update_aus}`},
  neue_version: {titel: "Neue Version der Web-App", weg: "", text: `Die Web-App fragt beim Zurückkehren in die App (höchstens einmal je Minute, nicht ohne Netz) und alle {version_minuten} Minuten nur bei ihrer eigenen Adresse nach einer neuen Version. Dann steht oben „Neue Version bereit“; tippe auf „Neu laden“, wenn es passt, vorher geht nichts verloren.`},
  web_ohne_server: {titel: "Web-App ohne Server (iPhone, iPad, Browser)", weg: "{weg_sicherung}", text: `Die Web-App läuft ganz im Browser deines Geräts, ohne Server, der deine Daten sieht. Öffne ihre Adresse in Safari, wähle <b>Teilen → Zum Home-Bildschirm</b> und starte sie nur noch über dieses Symbol. <b>Deine Daten liegen nur im Speicher des Browsers</b>, darum erinnert die App nach {sichern_nach_tage} Tagen an eine Sicherung. Hängt der Start, erscheint nach kurzer Zeit „Neu laden“; Synchronisieren und die Suche nach einer neuen Version beginnen erst, wenn die Übersicht steht, ohne Netz gar nicht.`},
  sync: {titel: "Wie synchronisiere ich mehrere Geräte?", weg: "{weg_sync}", text: `Synchronisieren heißt: Alle deine Geräte haben denselben Stand. Du wählst einen Speicherort (Ordner, eigener Server, GitHub, dieses Gerät als Speicherort oder ein anderes Gerät per Code) und ein Sync-Passwort, das auf allen Geräten gleich ist; damit sind die Dateien verschlüsselt. Danach läuft es von selbst, verschieden geänderte Tage entscheidest du unter „Konflikte“.`},
  github: {titel: "Synchronisieren über GitHub", weg: "{weg_sync}", text: `Alle Geräte legen ihre Einträge verschlüsselt in <b>ein privates Repo in deinem GitHub-Konto</b>; GitHub sieht nur verschlüsselte Dateien. Du brauchst dafür ein Repo und ein Token mit „Contents: Read and write“ nur für dieses Repo. In der App trägst du Repo und Token ein und wählst <b>Mit GitHub verbinden</b>.`},
  anmeldedienst: {titel: "Synchronisieren mit einem Server mit Anmeldung", weg: "{weg_sync}", text: `Verlangt dein eigener Server (Docker) eine Anmeldung, melden sich die Windows- und die Android-App dort einmal mit Benutzername und Passwort als Gerät an. Das Passwort speichert die App nicht, sie behält nur einen Schlüssel für dieses Gerät. <b>iPhone und iPad</b> öffnen in Safari die Adresse des Servers mit <b>/mobil/</b> am Ende.`},
  sync_aus: {titel: "Synchronisieren abschalten und Geräte zählen", weg: "{weg_sync}", text: `Die Seite Synchronisieren zeigt in der Zeile „Geräte beim Synchronisieren“, wie viele Geräte gerade mitmachen. Unter <b>{weg_einstellungen_module}</b> schaltest du „Synchronisieren“ nur für dieses Gerät ab; es meldet sich mit einem letzten Synchronisieren ab. Ist ein Gerät allein übrig, schaltet es das Synchronisieren selbst ab.`},
  geraet_entfernen: {titel: "Altes Gerät entfernen", weg: "{weg_sync} → Andere Geräte", text: `Eine neu installierte App oder ein geleerter Browser-Speicher ist ein neues Gerät, die Sync-Datei des alten bleibt liegen. Mit <b>Gerät entfernen</b> löschst du sie; deine Einträge bleiben auf allen Geräten. Hat ein Gerät seit über 30 Tagen nichts geschrieben, schlägt die App das selbst vor.`},
  aussehen: {titel: "Aussehen und Handy", weg: "{weg_einstellungen_aussehen}", text: `Die Darstellung folgt der Fensterbreite (schmal mit Tableiste unten, breit mit Seitenleiste), du wählst Farbe (Hell, Dunkel, Automatisch), Glaseffekt (Automatisch, An, Aus), Hintergrund (Verlauf, Aurora, Uni), Akzentfarbe (Blau, Grün, Orange, Rot, Violett, Graphit) und Zeitformat; ab Werk startet die App dunkel in Blau mit dem Verlauf. Glaseffekt Aus macht die Flächen deckend und spart Leistung, Automatisch schaltet ihn auf schwachen Geräten ab; Farbe, Glaseffekt, Hintergrund und Akzentfarbe gelten nur auf diesem Gerät, das Zeitformat auf allen; gedruckt wird immer schlicht und hell. Im Browser legst du die Seite über „Zum Home-Bildschirm“ als App ab.[[am_rechner]] Am Windows-Rechner öffnet die App ihr eigenes Fenster, nur wenn das nicht geht einen Browser, den du hier unter „Browser für das Fenster der App“ wählst.[[/]]`},
  zeitformat: {titel: "Stunden als 07:30 oder 7,50?", weg: "{weg_einstellungen_aussehen}", text: `Stunden erscheinen als „07:30“ (Stunden und Minuten) oder „7,50“ (mit Komma), eingestellt ist {zeitformat}. Das gilt für alle Anzeigen und Exporte und auf allen deinen Geräten; gerechnet wird immer in Minuten. Beim Eintippen nimmt die App beides an.`},
  abschnitte: {titel: "Teilzeit, Elternzeit und andere Arbeitszeiten", weg: "{weg_einstellungen_arbeitszeit}", text: `Ohne Abschnitt gilt deine Standard-Arbeitszeit ({wochenstunden} Stunden, {arbeitstage}). Mit „Neuer Abschnitt ab …“ legst du einen Zeitraum mit eigenen Wochenstunden an, etwa Teilzeit, Elternzeit oder Altersteilzeit. Bei Teilzeit verteilst du die Stunden gleichmäßig oder trägst Stunden je Tag ein, höchstens 10 je Tag.`},
  gueltigkeit: {titel: "Ab wann gelten geänderte Regeln?", weg: "{weg_einstellungen_arbeitszeit}", text: `Geänderte Regeln gelten ab Werk <b>ab heute</b>: Vergangene Tage und das Gleitzeit-Konto bleiben, wie sie sind. Du kannst stattdessen ein Datum wählen oder rückwirkend für alle Zeiträume ändern. Die Liste „Gültigkeit der Regeln“ zeigt, was ab wann gilt. Ab 1.11. wählst du oben auf der Seite auch das Folgejahr; Dienstverhältnis, Kind krank, Feiertage und Übernahme gelten dann ab 1.1. dieses Jahres.`},
  stand_anders: {titel: "Mein Gleitzeit-Stand oder die Soll-Zeiten sind plötzlich anders", weg: "{weg_einstellungen_person}", text: `Das passiert, wenn sich Regeln, Feiertage oder Abschnitte auch für vergangene Tage ändern. Trag danach den Gleitzeit-Stand mit Datum neu ein, damit das Konto wieder stimmt.`},
  profile: {titel: "Profile: fest, eigene, ein- und ausschalten", weg: "{weg_einstellungen_module} → Vorbelegung (Profile)", text: `Ein Profil ist ein fertiger Satz Regeln, wahlweise mit Akzentfarbe und Hell oder Dunkel; „Anwenden“ setzt es ab heute. Fest dabei sind etwa „Nur Zeiterfassung“, „Mit Homeoffice-Grenze“ und „Büro + Homeoffice“, eigene legst du dazu an, und sie kommen beim Synchronisieren auf deine Geräte. Die Urlaubstage eines Profils gelten für Jahre ohne eigenen Anspruch, bei dir {urlaub_tage} Tage.`},
  module: {titel: "Module: Teile der App ein- und ausschalten", weg: "{weg_einstellungen_module}", text: `Bei den Modulen schaltest du ab, was du nicht brauchst: Seiten wie Woche oder Urlaub und Teile wie Stempeluhr, Gleittage oder einzelne Export-Formate. Abgeschaltetes erscheint nirgends mehr, auch nicht in dieser Hilfe; deine Einträge bleiben und sind nach dem Einschalten wieder da. „Synchronisieren“ gilt als einziges Modul nur für dieses Gerät.`},
  zuruecksetzen: {titel: "Alles zurücksetzen (Werkseinstellungen)", weg: "{weg_einstellungen_module} → Werkseinstellungen", text: `„Alles zurücksetzen“ löscht auf diesem Gerät alle Einträge und Einstellungen, auch Passwort und Einstellungen zum Synchronisieren; danach gelten wieder die Voreinstellung und alle Module. Den Stand davor sichert die App, du lädst ihn unter <b>{weg_sicherung}</b> bei „Wiederherstellen“ herunter. Die anderen Geräte behalten ihre Einträge. In der Demo und über die freigegebene Oberfläche gibt es die Funktion nicht.`},
  personen: {titel: "Mehrere Personen auf dem Server", weg: "{weg_einstellungen_geraete}", text: `Auf einem Server mit Anmeldung hat jede Person ihren eigenen Datenordner, niemand sieht die Daten der anderen. Du meldest dich mit Namen und Passwort an; „Neu anlegen“ legt einen Zugang an, „Abmelden“ steht im Menü (in einem schmalen Fenster unter 700 px nur als Symbol oben). Die Rückfrage vor dem Abmelden schaltest du mit „Nicht mehr fragen“ ab. Namen ändern und „Meinen Zugang löschen“ findest du in den Einstellungen.`},
  admin: {titel: "Personen verwalten (nur Admins)", weg: "{weg_einstellungen_geraete} → Personen verwalten", text: `Admins sperren Personen, setzen ein Passwort zurück, geben oder nehmen das Admin-Recht und löschen Zugänge. Gelöschte Personen kommen in den Papierkorb des Servers und lassen sich wiederherstellen. Du siehst nie ein Passwort, und es bleibt immer mindestens ein Admin.`},
  datenschutz: {titel: "Wann spricht die App mit anderen Geräten oder dem Internet?", weg: "", text: `<p>Die App sendet keine Daten an Dritte und misst nichts. Sie lädt nichts von fremden Adressen. Es gibt genau diese Ausnahmen:</p><ul><li><b>Synchronisieren über GitHub</b>, nur wenn du sie einrichtest: Die App spricht nur mit <b>api.github.com</b> und deinem eigenen Repo. Dorthin gehen nur verschlüsselte Sync-Dateien. GitHub sieht deine Zeiten nicht, wohl aber, wann ein Gerät synchronisiert. Das Token bleibt auf deinem Gerät.</li><li><b>Synchronisieren mit deinem eigenen Server</b> (Windows- und Android-App), nur mit der Adresse, die du einträgst. Bei einem Server mit Anmeldung holt die App mit Benutzername und Passwort einmal einen Schlüssel für dieses Gerät. Das Passwort speichert sie nicht.</li><li><b>Ein Gerät als Speicherort</b>, nur wenn du es einschaltest: Andere Geräte im selben Netz erreichen dann auf Anschluss 8793 nur die verschlüsselten Sync-Dateien, nicht die App.</li><li><b>Windows-App am iPhone oder iPad bedienen</b>, nur wenn du es einschaltest: Die Oberfläche ist dann im eigenen Netz auf Anschluss 8794 erreichbar, nur mit dem Zugang aus dem QR-Code. „App beenden“ und das Einrichten des Synchronisierens gehen dort nicht.</li><li><b>Update-Hinweis</b> (Windows- und Android-App): Alle 30 Tage fragt die App bei GitHub nach der Nummer der neuesten Version (nur <b>api.github.com</b>, ohne Anmeldung, ohne Token). Dabei sieht GitHub die IP-Adresse deines Geräts. Die App lädt nichts herunter, installiert nichts und sendet keine Daten von dir. {update_stand} {update_aus}</li><li><b>Web-App ohne Server:</b> Sie spricht nur mit dem Server, der sie ausliefert. Ihre Programmdateien kommen beim ersten Start und bei einer neuen Version von dieser Adresse. Der Betreiber dieser Adresse sieht dabei deine IP-Adresse, aber keine Eingaben.</li></ul><p><b>Eingebaute Bibliotheken</b></p><ul><li><b>ZXing</b> (Android-App) liest den QR-Code beim Koppeln. Die Bibliothek baut keine Verbindung auf.</li><li><b>pycryptodome</b> (Web-App ohne Server) verschlüsselt Sicherung und Sync-Dateien, weil ihr Python im Browser keine eigene mitbringt. Die Bibliothek rechnet nur und baut keine Verbindung auf. Die Windows-, Android- und Server-Fassung nutzen dafür OpenSSL.</li></ul><p><b>Android</b></p><ul><li>Die Android-App legt ihre verschlüsselte Sicherung in den Cloud-Ordner deines eigenen Kontos. Die Verbindung dorthin macht dein Gerät, nicht die App.</li><li>Außerdem nimmt die Gerätesicherung von Google die Datenbank mit. Die App verschlüsselt sie dafür nicht eigens. Ab Android 9 geschieht das nur, wenn das Gerät die Sicherung verschlüsselt (mit gesetzter Bildschirmsperre). Android 7 und 8 sichern ohne diese Bedingung. Passwort-Schlüssel und GitHub-Token sind davon ausgenommen. Wer das nicht möchte, schaltet in den Android-Einstellungen die Google-Sicherung für Apps aus.</li></ul><p><b>Eigener Server</b></p><ul><li>Die App hat ohne Anmeldedienst keine Anmeldung. Betreibe einen Server nur in einem privaten Netz oder hinter einem geschützten Zugang.</li></ul><p><b>Papierkorb</b></p><ul><li>Geleerte Tage und gelöschte Einträge bleiben 30 Tage im Papierkorb, nur auf diesem Gerät. So lange stehen sie auch in Sicherungsdateien aus dieser Zeit. Beim Einspielen einer Sicherung kommt der Papierkorb nicht mit.</li></ul>{datenschutz_seite}${HILFE_URHEBER}`}
};
// Wann ein Abschnitt erscheint (fehlt der Schlüssel: immer); gleich für alle Fassungen.
const HILFE_GILT = {
  monat_raster: () => modulAn("monat"),
  urlaub: () => modulAn("urlaub"),
  zusatzurlaub: () => modulAn("urlaub"),
  resturlaub: () => modulAn("urlaub"),
  gleitzeit: () => modulAn("gleittage") || modulAn("gleitzeit"),
  sicherung: () => modulAn("sicherung"),
  sondertage: () => modulAn("sonderurlaub") || modulAn("kind_krank"),
  monatsnachweis: () => modulAn("monatsnachweis"),
  unterschrift: () => modulAn("monatsnachweis"),
  kurzbefehle: () => PLATTFORM === "android",
  daten_pruefen: () => modulAn("sicherung"),
  gleitzeit_verlauf: () => modulAn("gleitzeit"),
  kappung: () => modulAn("gleitzeit"),
  update: () => UPDATE_PLATTFORMEN.includes(PLATTFORM),
  neue_version: () => WEB_PLATTFORMEN.includes(PLATTFORM),
  zutun: () => modulAn("zutun"),
  quote: () => HILFE_BEDINGUNG.quote(),
  krank: () => modulAn("krank"),
  sync: () => modulAn("abgleich"),
  anmeldedienst: () => modulAn("abgleich"),
  quote_ampel: () => mitGrenze(),
  spielraum: () => mitGrenze(),
  familientage: () => modulAn("familientage"),
  angespart: () => modulAn("angespart"),
  uebersicht: () => hoModus() !== "kein" && modulAn("nachweis"),
  freizeitkonto: () => modulAn("freizeit"),
  planung: () => modulAn("planung") && modulAn("urlaub"),           // die Planung ist ein Abschnitt der Seite Urlaub
  handy_sicherung: () => ["android", "browser"].includes(PLATTFORM) && modulAn("sicherung"),   // wie sichInfo in sicherung.js
  zuruecksetzen: () => !DEMO?.aktiv && !FERN,                   // wie werkKarte in einstellungen_module.js
  brueckentage: () => modulAn("urlaub"),
  export: () => modulAn("export"),
  exporte: () => modulAn("export"),
  personen: () => PERSON,
  admin: () => PERSON && ADMIN,
  sync_aus: () => modulAn("abgleich"),
  github: () => modulAn("abgleich") && modulAn("github"),
  gehen_vergessen: () => modulAn("stempel"),
  beginn_korrigieren: () => modulAn("stempel"),
  wochenziel: () => modulAn("woche"),
  jahresrueckblick: () => modulAn("jahr")
};
// Zeigt diese Fassung den Abschnitt s (Bedingung in HILFE_GILT)?
const hilfeSichtbar = s => !HILFE_GILT[s] || !!HILFE_GILT[s]();
const WEB_PLATTFORMEN = ["browser", "server"];                  // Web-App: lädt neue Versionen selbst von ihrer Adresse (Band „Neue Version bereit“)

// Das Jahreslimit „Kind krank“ des laufenden Jahres (nicht des angesehenen), wie die API es für die Seite „Sondertage“ liefert; bei einem Fehler ein Strich.
async function hilfeKindKrank() {
  try { return (await api("GET", `/urlaub/${heute.getFullYear()}`)).kind_krank_max; } catch (e) { return HILFE_KEIN_WERT; }
}
// Stand der Update-Abfrage (GET /update, wie Einstellungen → Geräte): true, false oder null, wenn die Fassung sie nicht kennt oder die API nicht antwortet.
async function hilfeUpdateAn() {
  if (!UPDATE_PLATTFORMEN.includes(PLATTFORM)) return null;
  try { const u = await api("GET", "/update"); return typeof u?.an === "boolean" ? u.an : null; } catch (e) { return null; }
}
const UPDATE_PLATTFORMEN = ["desktop", "android"];              // nur diese Fassungen fragen bei GitHub nach einer neuen Version
const HILFE_UPDATE_STAND = {true: "Bei dir ist die Abfrage an.", false: "Bei dir ist die Abfrage aus. Die App fragt nicht bei GitHub nach.", null: "Die Abfrage ist ab Werk an."};
const HILFE_ARBEITSTAG = "ein normaler Arbeitstag";
// Nur die Namen, deren Bedingung gilt: paare [[Name, gilt], …] → [Name, …].
const hilfeNurAn = paare => paare.filter(([, an]) => an).map(([n]) => n);
// Was die App aus den Einträgen rechnet, nach Homeoffice-Modus und Modulen (Abschnitt „Wofür ist die App gedacht?“).
const hilfeRechnet = () => aufzaehlung(hilfeNurAn([["die Quote", hoModus() === "grenze" || hoModus() === "ohne"], ["Gleitzeit", modulAn("gleitzeit")],
  ["Urlaub", modulAn("urlaub")], ["Krankheit", modulAn("krank")], ["die Homeoffice-Übersicht", hoModus() !== "kein" && modulAn("nachweis")]])) || "deine Arbeitszeit";
// Knöpfe der Karte „Art des Tages“: Orte nach Homeoffice-Modus, Krank nur mit seinem Modul („Homeoffice, Büro und Krank“).
const hilfeSchnellwahl = () => aufzaehlung(hilfeNurAn([["Homeoffice", einOrt() !== "dst"], ["Büro", einOrt() !== "ho"], ["Krank", modulAn("krank")]]));
// Arten, die man im Voraus plant (Urlaubsplanung), nur mit eingeschaltetem Modul.
const hilfePlanArten = () => aufzaehlung(hilfeNurAn([["Urlaub", true], ["Gleittage", modulAn("gleittage")], ["angesparten Urlaub", modulAn("angespart")],
  ["Familientage", modulAn("familientage")], ["Sonderurlaub", modulAn("sonderurlaub")]]), "oder");
// Kacheln der Übersicht unter „Heute“ (start.js teile), nur mit eingeschaltetem Modul.
const hilfeKacheln = () => aufzaehlung(hilfeNurAn([["„Heute“ (gearbeitet gegen das Tagessoll)", true], ["„Diese Woche“ (Ist und Saldo der Woche)", modulAn("woche")], ["Gleitzeit", modulAn("gleitzeit")],
  ["Urlaub", modulAn("urlaub")], ["Freizeitkonto", modulAn("freizeit")], ["Krank", modulAn("krank")]]));
// Tage, die „Erfassung gültig ab“ als Stand vor dem Datum abfragt (dieselben Module wie die Felder in einstellungen_person.js).
const hilfeStartTage = () => aufzaehlung(hilfeNurAn([["Urlaub", modulAn("urlaub")], ["Gleittage", modulAn("gleittage")], ["Kranktage", modulAn("krank")],
  ["Tage „Kind krank“", modulAn("kind_krank")]]));
// Tage der Homeoffice-Übersicht (Abschnitt „uebersicht“): Urlaub, Gleittage und Kranktage nur mit ihrem Modul.
const hilfeUebersichtTage = () => aufzaehlung(hilfeNurAn([["Urlaubstage", modulAn("urlaub")], ["Gleittage", modulAn("gleittage")], ["Kranktage", modulAn("krank")],
  ["reinen HO-Tage", true], ["Büro-Tage", true], ["Elternzeit-Tage", true]]));
// Formate des Exports je Modul (wie ENDUNG_MODUL in formate.js); Word gibt es nur beim Monatsnachweis (monatsnachweis.js).
const HILFE_WORD = "Word (nur Monatsnachweis)";
const HILFE_EXPORT_FORMATE = [["ex_pdf", ["PDF"]], ["ex_office", ["Excel", HILFE_WORD]], ["ex_daten", ["CSV"]]];
const HILFE_KEINE_FORMATE = "keine Formate, sie sind alle abgeschaltet";
const HILFE_KALENDER = "einen Kalender (.ics) mit deinen Abwesenheiten";   // export.ICS_ARTEN: alle ganztägigen Arten
// Namen der Formate eines Moduls m (Word nur mit eingeschaltetem Monatsnachweis).
const hilfeFormate = m => HILFE_EXPORT_FORMATE.find(([k]) => k === m)[1].filter(n => n !== HILFE_WORD || modulAn("monatsnachweis"));
// Formate und Kalender für den Abschnitt „exporte“ als Text, nur mit eingeschaltetem Modul; ohne Format HILFE_KEINE_FORMATE.
function hilfeExportFormate() {
  const formate = HILFE_EXPORT_FORMATE.filter(([m]) => modulAn(m)).flatMap(([m]) => hilfeFormate(m));
  return aufzaehlung(modulAn("ex_kalender") ? [...formate, HILFE_KALENDER] : formate) || HILFE_KEINE_FORMATE;
}
// Bereiche der App mit ihren sichtbaren Reitern als HTML-Liste (wie Seitenleiste und Menü: navWeg); jeder Name maskiert.
function hilfeBereiche() {
  return BEREICHE.map(([b, , reiter]) => [bereichName(b), reiter.filter(([s]) => !navWeg(s)).map(([, n]) => n)]).filter(([, r]) => r.length)
    .map(([name, r]) => `<li><b>${esc(name)}</b>${r.length > 1 || r[0] !== name ? ": " + esc(r.join(", ")) : ""}</li>`);
}
// Beispiel zur ersten Pausenstufe [ab, pause] (Minuten): halbe Pause oder 25 Minuten nach der Schwelle zählen anteilig, ab Schwelle + Pause die volle.
function hilfePause(stufen) {
  if (!stufen.length) return {};
  const [ab, p] = stufen[0], zw = p > PAUSE_BEISPIEL_MIN ? PAUSE_BEISPIEL_MIN : Math.floor(p / 2);
  return {pause_ab: zeitText(ab), pause_dauer: zeitText(p), pause_zwischen: zeitText(ab + zw), pause_zwischen_min: zw, pause_voll: zeitText(ab + p)};
}
const PAUSE_BEISPIEL_MIN = 25;                                  // Zwischenwert im Beispiel, solange die Pause länger ist
// Abschalten der Update-Prüfung: den Schalter „Neue Version“ gibt es nur, wo die App fragt (wie Abschnitt „update“); die Web-App fragt nur ihre eigene Adresse (Abschnitt „neue_version“).
function hilfeUpdateAus() {
  return {update_aus: HILFE_GILT.update() ? `Ein- und ausschalten: ${weg("einstellungen", "geraete")} → Neue Version.`
    : "Die Web-App fragt nicht bei GitHub, nur bei ihrer eigenen Adresse."};
}
// Grenzen des Gleitzeit-Kontos als Text, z. B. „40 Std. im Plus oder 10 Std. im Minus“ (wort „und“ für die Grenzlinien, die zugleich stehen); eine Grenze 0 (kein Hinweis) fehlt, beide 0: leer.
const hilfeGleitzeitGrenzen = (k, wort = "oder") => [[zutunSaldoGrenze(k), "Plus"], [zutunSaldoMinus(k), "Minus"]].filter(([n]) => n).map(([n, r]) => `${n} Std. im ${r}`).join(` ${wort} `);
// Werte für die Platzhalter der Texte aus den Regeln k (und der API, wo die Zahl nur der Server kennt). Eingesetzt wird nur mit esc().
async function hilfeWerte(k) {
  const kind = modulAn("sonderurlaub") || modulAn("kind_krank") ? await hilfeKindKrank() : HILFE_KEIN_WERT, updateAn = await hilfeUpdateAn();
  return {grenze: k.ho_grenze, ho_modus: HO_MODI[hoModus()], gleittage_max: k.gleittage_max, familientage_max: k.familientage_max, kind_krank_max: kind,
    kind_krank_dienst: KIND_KRANK_DIENSTE[k.kind_krank_dienst] || "", jahr: heute.getFullYear(), urlaub_tage: k.urlaub_tage,
    sicherung_tage: zutunSicherungTage(k), sichern_nach_tage: SICHERN_NACH_TAGEN, gleitzeit_grenzen: hilfeGleitzeitGrenzen(k), gleitzeit_linien: hilfeGleitzeitGrenzen(k, "und"),
    kappung_stichtag: kappungTag(k.kappung_stichtag), kappung_grenze: komma(Math.round(k.kappung_grenze_min / 6) / 10),
    wochenstunden: komma(k.wochenstunden), arbeitstage: String(k.arbeitstage).replace(/,/g, ", "), bundesland: BUNDESLAENDER[k.bundesland] || k.bundesland,
    heiligabend: k.heiligabend_frei ? "frei" : HILFE_ARBEITSTAG, silvester: k.silvester_frei ? "frei" : HILFE_ARBEITSTAG,
    himmelfahrt: k.himmelfahrt_frei ? "ein Feiertag" : HILFE_ARBEITSTAG,
    fasching: k.fasching_std === null || k.fasching_std === undefined ? "ist " + HILFE_ARBEITSTAG : "hat höchstens " + komma(k.fasching_std) + " Std. Soll",
    pausenregel: pausenText(), ...hilfePause(k.pausen || []), update_an: updateAn, update_stand: HILFE_GILT.update() ? HILFE_UPDATE_STAND[updateAn] : "",
    ort_arbeit: {kein: "Büro", nur: "Homeoffice"}[hoModus()] || "Homeoffice oder Büro", rechnet: hilfeRechnet(), schnellwahl: hilfeSchnellwahl(),
    plan_arten: hilfePlanArten(), uebersicht_kacheln: hilfeKacheln(), start_tage: hilfeStartTage(), uebersicht_tage: hilfeUebersichtTage(), export_formate: hilfeExportFormate(), office_formate: aufzaehlung(hilfeFormate("ex_office")), bereich_homeoffice: bereichName("homeoffice"), bereiche_zahl: hilfeBereiche().length,
    zeitformat: k.zeitformat === "dezimal" ? "7,50" : "07:30", urlaub: seitenTitel("urlaub"), rueck_sekunden: Math.round(RUECK_MS / 1000),
    version_minuten: Math.round(VERSION_TAKT / 60000), ...hilfeUpdateAus()};
}
// Platzhalter, die fertiges HTML liefern; es entsteht nur aus festen Namen, jeder Name einzeln mit esc() (hilfeBereiche).
const HILFE_HTML = {bereiche: () => hilfeBereiche().join(""),
  datenschutz_seite: () => aufPages() ? '<p>Diese Web-App läuft bei GitHub Pages. Dafür gibt es eine eigene <a href="datenschutz.html">Datenschutzerklärung dieser Seite</a>.</p>' : ""};   // nur dort liegt die Seite (grundlage.js)
// Bedingungen der Bausteine [[name]] … [[/]]: eigene Namen hier, jeder andere Name ist ein Modul (modulAn). w: die Werte aus hilfeWerte.
const HILFE_BEDINGUNG = {
  grenze: () => mitGrenze(), ohne: () => hoModus() === "ohne", kein: () => hoModus() === "kein", nur: () => hoModus() === "nur",
  sync: () => modulAn("abgleich"), zwei_orte: () => !einOrt(), einort: () => !!einOrt(), quote: () => hoModus() === "grenze" || hoModus() === "ohne", by: () => KONFIG.bundesland === "BY",
  pausen: () => (KONFIG.pausen || []).length > 0, kk_eigen: () => KONFIG.kind_krank_dienst === "eigen", keine_gleittage: () => !KONFIG.gleittage_max,
  update_an: w => UPDATE_PLATTFORMEN.includes(PLATTFORM) && w.update_an !== false, start_tage: w => !!w.start_tage, uebersicht_kacheln: w => !!w.uebersicht_kacheln,
  gleitzeit_grenzen: w => !!w.gleitzeit_grenzen,
  am_server: () => PLATTFORM === "server", im_browser: () => PLATTFORM === "browser", am_rechner: () => PLATTFORM === "desktop"
};
// Gilt die Bedingung bed? „a+b“ heißt a und b, „!a“ heißt nicht a.
const hilfeGilt = (bed, w) => bed.split("+").every(t => t.startsWith("!") !== (HILFE_BEDINGUNG[t.replace("!", "")] || (() => modulAn(t.replace("!", ""))))(w));
// Innerster Baustein [[bed]]ja[[sonst]]nein[[/]] (ohne weitere [[ darin); Bausteine dürfen ineinander stehen, sie werden von innen nach außen gelöst.
const HILFE_BAUSTEIN = /\[\[(?!sonst\]\])(!?\w+(?:\+!?\w+)*)\]\]((?:(?!\[\[)[\s\S])*?)(?:\[\[sonst\]\]((?:(?!\[\[)[\s\S])*?))?\[\[\/\]\]/g;
// Löst alle Bausteine in text auf: Es bleibt nur der feste Text, dessen Bedingung gilt (Werte setzt erst hilfeFuellen ein).
function hilfeBausteine(text, werte) {
  for (let vorher = ""; vorher !== text;) {
    vorher = text;
    text = text.replace(HILFE_BAUSTEIN, (_, bed, ja, nein = "") => hilfeGilt(bed, werte) ? ja : nein);
  }
  return text;
}
// Setzt in text die Bausteine und Platzhalter ein: {weg_<seite>[_<unterseite>]} als weg(seite, unterseite), {name} aus werte; alles maskiert, Unbekanntes bleibt leer.
function hilfeFuellen(text, werte) {
  return hilfeBausteine(text, werte).replace(/\{(\w+)\}/g, (_, name) => {
    if (HILFE_HTML[name]) return HILFE_HTML[name]();
    const [vorsatz, seite, unter = ""] = name.split("_");
    return esc(vorsatz === "weg" && seite ? weg(seite, unter) : werte[name] ?? "");
  });
}
// „Fremde Bausteine und Lizenzen“ unter „Über diese App“: Übersicht und Lizenztexte liegen als Dateien in app/web/lizenzen (in jeder Fassung).
// Die Übersicht ist Markdown (DRITTLIZENZEN.md, auch für den Quelltext); die Seite liest daraus je Fassung (## Abschnitt) die Zeilen der Tabelle.
const LIZENZ_ORDNER = "lizenzen/";                              // relativ: gilt auch unter /mobil/ und bei GitHub Pages
const LIZENZ_UEBERSICHT = "DRITTLIZENZEN.md";
const LIZENZ_DATEI = /`([\w.-]+\.txt)`/g;                       // Lizenztexte, die eine Zelle „Text“ nennt
const LIZENZ_NAME = /^[\w-][\w.-]*\.txt$/;                      // nur Dateien direkt im Ordner, nie ein Weg nach oben
const LIZENZ_SPALTEN = {name: "Teil", version: "Version", lizenz: "Lizenz", wofuer: "Wofür", text: "Text"};
const LIZENZ_FEHLT = "Der Text ließ sich nicht laden. Bitte später noch einmal versuchen.";
const LIZENZ_SERVER = "Server (Docker): Er enthält nur den eigenen Code. Python kommt dort aus dem Abbild, das du selbst lädst.";
const LIZENZ_OHNE = "–";                                       // Zelle ohne Angabe
const LIZENZ_KEIN_TEXT = "Kein Lizenztext nötig";
const LIZENZ_GELADEN = new Map();                               // Datei -> Versprechen des Textes: Apache-2.0 und MPL-2.0 nennen mehrere Zeilen, geladen wird einmal
// Lädt die Datei name aus dem Ordner lizenzen (einmal je Datei). -> Versprechen des Textes oder LIZENZ_FEHLT; danach kann ein neuer Versuch laden.
function lizenzLaden(name) {
  if (!LIZENZ_NAME.test(name) && name !== LIZENZ_UEBERSICHT) return Promise.resolve(LIZENZ_FEHLT);
  if (!LIZENZ_GELADEN.has(name)) LIZENZ_GELADEN.set(name, fetch(LIZENZ_ORDNER + name).then(r => r.ok ? r.text() : Promise.reject()).catch(() => { LIZENZ_GELADEN.delete(name); return LIZENZ_FEHLT; }));
  return LIZENZ_GELADEN.get(name);
}
// Zellen einer Tabellenzeile in Markdown, ohne Backticks.
const lizenzZellen = zeile => zeile.trim().replace(/^\||\|$/g, "").split("|").map(z => z.trim());
// Liest die Übersicht md: je Abschnitt (## Titel) mit Tabelle eine Gruppe. -> [{titel, teile: [{name, version, lizenz, wofuer, texte: [Datei, …]}]}]
function lizenzGruppen(md) {
  const gruppen = [];
  let gruppe = null, spalten = null;
  for (const zeile of md.split(/\r?\n/)) {
    if (zeile.startsWith("## ")) { gruppe = {titel: zeile.slice(3).trim(), teile: []}; gruppen.push(gruppe); spalten = null; continue; }
    if (!gruppe || !zeile.startsWith("|")) continue;
    const zellen = lizenzZellen(zeile);
    if (!spalten) { spalten = Object.fromEntries(Object.entries(LIZENZ_SPALTEN).map(([k, t]) => [k, zellen.indexOf(t)])); continue; }
    if (zellen.every(z => /^-+$/.test(z))) continue;          // Trennzeile unter dem Kopf
    const wert = k => (zellen[spalten[k]] ?? "").replace(/`/g, "");
    const texte = [...new Set(Array.from((zellen[spalten.text] ?? "").matchAll(LIZENZ_DATEI), m => m[1]).filter(d => LIZENZ_NAME.test(d)))];
    gruppe.teile.push({name: wert("name"), version: wert("version"), lizenz: wert("lizenz"), wofuer: wert("wofuer"), texte});
  }
  return gruppen.filter(g => g.teile.length);
}
// Neues Element tag mit Klasse klasse und Text text (nur textContent: die Werte stammen aus einer Datei).
function lizenzKnoten(tag, klasse, text = "") {
  const k = document.createElement(tag);
  if (klasse) k.className = klasse;
  k.textContent = text;
  return k;
}
// Knopf „Lizenztext“ für Datei datei des Bausteins name (Nummer i von n, wenn er mehrere Texte hat).
function lizenzKnopf(name, datei, i, n) {
  const k = lizenzKnoten("button", "lizenz-knopf", n > 1 ? `Lizenztext ${i + 1}` : "Lizenztext");
  k.type = "button";
  k.dataset.klick = "lizenzText";
  k.dataset.arg = JSON.stringify([datei, name]);
  k.setAttribute("aria-label", `Lizenztext von ${name}` + (n > 1 ? ` (${i + 1} von ${n})` : ""));
  return k;
}
// Ein Baustein als Zeile: Name, Version und Lizenz, wofür, Knöpfe für seine Lizenztexte.
function lizenzTeil(t) {
  const zeile = lizenzKnoten("li", "lizenz-teil"), angaben = lizenzKnoten("div", "lizenz-angaben"), knoepfe = lizenzKnoten("div", "lizenz-knoepfe");
  const version = t.version && t.version !== LIZENZ_OHNE ? `Version ${t.version} · ` : "";
  angaben.append(lizenzKnoten("b", "", t.name), lizenzKnoten("span", "hinweis", version + t.lizenz), lizenzKnoten("span", "", t.wofuer));
  knoepfe.append(...(t.texte.length ? t.texte.map((d, i) => lizenzKnopf(t.name, d, i, t.texte.length)) : [lizenzKnoten("span", "hinweis", LIZENZ_KEIN_TEXT)]));
  zeile.append(angaben, knoepfe);
  return zeile;
}
// Liste aller Gruppen: je Fassung eine Überschrift und ihre Bausteine, am Ende der Satz zum Server. -> Elemente zum Einsetzen
const lizenzListeBauen = gruppen => [...gruppen.flatMap(g => {
  const liste = lizenzKnoten("ul", "lizenz-liste");
  liste.append(...g.teile.map(lizenzTeil));
  return [lizenzKnoten("h3", "lizenz-gruppe", g.titel), liste];
}), lizenzKnoten("p", "hinweis", LIZENZ_SERVER)];
// Aktion beim Aufklappen des Abschnitts: lädt die Übersicht einmal und zeichnet die Liste (bei Fehler die Meldung, beim nächsten Aufklappen neu).
async function lizenzListe() {
  const ort = $("#lizenz-liste");
  if (!ort || ort.dataset.geladen) return;
  ort.dataset.geladen = "1";
  const md = await lizenzLaden(LIZENZ_UEBERSICHT), gruppen = md === LIZENZ_FEHLT ? [] : lizenzGruppen(md);
  if (!gruppen.length) { delete ort.dataset.geladen; ort.replaceChildren(lizenzKnoten("p", "", LIZENZ_FEHLT)); ort.firstChild.setAttribute("role", "status"); return; }
  ort.replaceChildren(...lizenzListeBauen(gruppen));
}
// Aktion „Lizenztext“: öffnet das Blatt mit dem Text der Datei datei für den Baustein name; Text nur über textContent.
async function lizenzText(datei, name) {
  blatt(`<div class="lizenz-oben"><h3>${esc(name)}</h3><div class="knoepfe"><button type="button" ${kl("blattZu")}>Schließen</button></div></div>
    <pre class="lizenz-text" tabindex="0" aria-label="${esc("Lizenztext von " + name)}">Wird geladen …</pre>`);
  const text = await lizenzLaden(datei), feld = $("#blatt.auf .lizenz-text");
  if (feld) feld.textContent = text;
}
// Abschnitt „Fremde Bausteine und Lizenzen“: ein Satz, was das ist; die Liste kommt beim Aufklappen (data-auf, Ereignis toggle in anlauf.js).
const lizenzAbschnitt = () => `<details class="faq lizenzen" data-abschnitt="lizenzen" data-auf="lizenzListe"><summary>Fremde Bausteine und Lizenzen</summary><div>
      <p>Die App nutzt fremde Bausteine, zum Beispiel Python. Hier stehen sie je Fassung mit Version, Lizenz und Zweck. Ihren Lizenztext öffnest du in der Zeile.</p>
      <div id="lizenz-liste" class="lizenz-uebersicht"><p role="status">Wird geladen …</p></div></div></details>`;
// ---- Suche (Hilferunde 23.11.2026): filtert beim Tippen nur im DOM (hidden, open, textContent), schreibt nie HTML; das Wort übersteht ein Neuzeichnen der Seite.
let hilfeSuchwort = "";
const HILFE_KEINE_TREFFER = "Keine Treffer. Versuch ein anderes Wort.";
// Trifft das Suchwort den Text? Groß und klein egal, jedes Wort muss vorkommen; leeres Suchwort trifft alles.
function hilfeTrifft(text, suchwort) {
  const t = text.toLocaleLowerCase("de");
  return suchwort.toLocaleLowerCase("de").split(/\s+/).filter(Boolean).every(w => t.includes(w));
}
// Text eines Abschnitts für die Suche: Titel und Inhalt ohne Weg und Wiki-Link (die stehen in jedem Abschnitt gleich).
const hilfeSuchText = d => [...d.querySelectorAll("summary, details > div > :not(.hilfe-weg):not(.hilfe-wiki)")].map(e => e.textContent).join(" ");
// Wendet das Wort im Suchfeld an: Treffer aufgeklappt, übrige und leere Gruppen ausgeblendet, „Keine Treffer“ als Statuszeile; Leeren klappt alles wieder zu.
function hilfeFiltern() {
  const feld = $("#hilfe-suche");
  if (!feld) return;
  const war = hilfeSuchwort.trim(), wort = feld.value.trim();
  hilfeSuchwort = feld.value;
  let treffer = 0;
  document.querySelectorAll("#hilfe-liste .hilfe-gruppe").forEach(g => {
    let da = 0;
    g.querySelectorAll("details.faq").forEach(d => {
      const trifft = hilfeTrifft(hilfeSuchText(d), wort);
      d.hidden = !trifft;
      if (wort) d.open = trifft; else if (war) d.open = false;
      da += trifft;
    });
    g.hidden = !da;
    if (wort) g.open = da > 0; else if (war) g.open = false;   // ohne vorheriges Wort bleibt die Gruppe des Sprungziels offen
    treffer += da;
  });
  $("#hilfe-leer").textContent = treffer ? "" : HILFE_KEINE_TREFFER;
}
// Taste im Suchfeld: Escape leert die Suche (nur dort; das Escape der Seite schlösse sonst ein Blatt).
function hilfeSuchTaste(e) {
  if (e.key === "Escape" && e.target.value) {
    e.preventDefault(); e.stopPropagation();
    e.target.value = "";
    hilfeFiltern();
  }
}
const HILFE_SUCHE = `<label for="hilfe-suche">Hilfe durchsuchen</label><input type="search" id="hilfe-suche" autocomplete="off" enterkeyhint="search" placeholder="z. B. Urlaub, Pause, Sync">`;

// ---- Seite „Hilfe“
// Abschnitt aus der Adresse (#/hilfe/<schlüssel>), wenn ihn diese Fassung zeigt; sonst leer.
function hilfeAdressZiel() {
  const s = hashTeile()[1] || "";
  return Object.hasOwn(HILFE_TEXTE, s) && hilfeSichtbar(s) ? s : "";
}
// Ein Abschnitt als aufklappbares details: Titel, Text, Weg (fett, eigene Zeile, nur wenn es einen gibt) und Wiki-Link.
function hilfeAbschnitt(s, werte, offen) {
  const {titel, weg, text} = HILFE_TEXTE[s], inhalt = hilfeFuellen(text, werte), wegText = hilfeFuellen(weg, werte).trim();
  return `<details class="faq" data-abschnitt="${s}"${s === offen ? " open" : ""}><summary id="hf-${s}">${hilfeFuellen(titel, werte)}</summary><div>`
    + `${inhalt.startsWith("<") ? inhalt : `<p>${inhalt}</p>`}${wegText ? `<p class="hilfe-weg"><b>${wegText}</b></p>` : ""}${hilfeWikiZeile(s)}</div></details>`;
}
// Eine Gruppe als aufklappbares details (Wunsch des Entwicklers 23.11.2026, ab Werk zu): im summary die Überschrift h3 und die Zahl ihrer sichtbaren
// Abschnitte, darunter die Abschnitte. Offen nur, wenn das Ziel der Adresse darin steht.
const hilfeGruppe = ([id, titel, abschnitte], werte, offen) =>
  `<details class="hilfe-gruppe" data-gruppe="${id}"${abschnitte.includes(offen) ? " open" : ""}><summary><h3 id="hg-${id}">${esc(titel)}</h3>`
  + `<span class="hilfe-anzahl"><span aria-hidden="true">· </span>${abschnitte.length}<span class="sr"> Fragen</span></span></summary>`
  + `${abschnitte.map(s => hilfeAbschnitt(s, werte, offen)).join("")}</details>`;
// Nach dem Zeichnen: Suchfeld binden und das Wort wieder anwenden; kam man mit einem Ziel (#/hilfe/<schlüssel>), einmal je Eintrag im Verlauf dorthin
// rollen und den Fokus auf seinen Titel setzen (ein Schritt zurück und wieder vor rollt nicht erneut, gesprungen steht im Eintrag).
function hilfeNachher(ziel) {
  const vorher = window.nachher;
  window.nachher = () => {
    if (vorher) vorher();
    const feld = $("#hilfe-suche");
    if (!feld) return;
    const springen = ziel && !history.state?.gesprungen;
    if (springen) hilfeSuchwort = "";
    feld.value = hilfeSuchwort; feld.oninput = hilfeFiltern; feld.onkeydown = hilfeSuchTaste;
    hilfeFiltern();
    if (!springen) return;
    history.replaceState({...history.state, gesprungen: true}, "");
    const d = document.querySelector(`details[data-abschnitt="${ziel}"]`);
    d.scrollIntoView({block: "start"});
    d.querySelector("summary").focus({preventScroll: true});
  };
}
// Seite „Hilfe“: Rückweg (nur über „?“), Wiki-Link, Urheberhinweis, Suchfeld, Gruppen mit ihren Abschnitten (alle zu, nur das Ziel der Adresse mit seiner Gruppe offen), Über diese App.
async function seiteHilfe() {
  const werte = await hilfeWerte(KONFIG), ziel = hilfeAdressZiel(), rueck = hilfeRueckName();
  const gruppen = HILFE_GRUPPEN.map(([id, titel, abschnitte]) => [id, titel, abschnitte.filter(hilfeSichtbar)]).filter(([, , a]) => a.length);
  hilfeNachher(ziel);
  return `<div class="card hilfe">${rueck ? `<div class="knoepfe hilfe-rueck"><button type="button" ${kl("hilfeZurueck")}>‹ Zurück zu ${esc(rueck)}</button></div>` : ""}
    <h2>Hilfe &amp; häufige Fragen</h2><p class="hinweis">${wikiLink("Ausführliche Anleitung mit Bildern im Wiki")}. Bereich antippen zum Aufklappen. ${DEMO?.aktiv ? HILFE_DEMO : "Die Zahlen und Regeln hier folgen deinen Einstellungen."}</p>${HILFE_URHEBER}
    <div class="hilfe-suche">${HILFE_SUCHE}</div><div id="hilfe-liste">${gruppen.map(g => hilfeGruppe(g, werte, ziel)).join("")}<p id="hilfe-leer" class="leer" role="status"></p></div></div>
    <div class="card"><h2>Über diese App</h2>
      <p class="ueber-app"><b>Zeiterfassung</b><br>Version <span class="app-version">${APP_VERSION || "–"}</span>${appsLink()}</p>
      <div class="ueber-app">${lizenzAbschnitt()}</div></div>`;
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
// Merkt das Kopfende (Abstand vom Seitenanfang) als --kopf-unten: Die Tag-Spalte am Rechner beginnt dort und endet so bei Bildlauf 0 im Fenster,
// ob die Reiterleiste neben oder unter dem Titel steht (grundlage.css). Eine feste Kopfhöhe passte nur für eine der beiden Lagen.
const KOPF = "#huelle > header";
function kopfEndeMerken() { document.body.style.setProperty("--kopf-unten", Math.ceil($(KOPF).getBoundingClientRect().bottom + scrollY) + "px"); }
new ResizeObserver(kopfEndeMerken).observe($(KOPF));

weitMq.addEventListener("change", darstellung);
// Unterseite: immer zur übergeordneten Seite; kam man von dort, als Schritt zurück im Verlauf, sonst ohne neuen Eintrag (der Pfeil der Liste pendelte sonst
// zur Unterseite zurück). Andere Seiten: einen Schritt zurück, ohne Seite der App davor (direkt geöffnet) zur Übersicht.
$("#zurueck").onclick = () => {
  const eltern = elternSeite(seitenName(), hashTeile()[1]);
  if (eltern) zeigen.vorige === "#/" + eltern ? history.back() : location.replace("#/" + eltern);
  else if (verlauf.tiefe > 0) history.back(); else location.hash = ADRESSE_START;
};
personPruefen((document.cookie.match(/(?:^|; )ho_person=([^;]*)/) || [])[1] || "");
darstellung();
toastFeld();
try { const m = sessionStorage.getItem(EIGEN + "ho_meldung"); if (m) { sessionStorage.removeItem(EIGEN + "ho_meldung"); setTimeout(() => toast(m, 8000), 300); } } catch (e) {}


document.addEventListener("click", async ev => {
  const a = ev.target.closest && ev.target.closest("a.btn[href^='api/']"), ziel = a ? a.getAttribute("href").split("?")[0] : "";   // ohne Abfrage (Monatsnachweis ?name=…)
  if (a && (a.id === "sich-dl" || a.id === "hs-dl")) handGesichert();   // Sicherung von Hand (Herunterladen oder Teilen): Zeitpunkt merken
  if (a && /\.pdf$/i.test(ziel) && !(teilenAn() && teilenMoeglich())) {
    ev.preventDefault();
    try { await pdfSpeichern(a.getAttribute("href")); }
    catch (e) { if (e.name === "LadeFehler" || (alsApp() && e.name !== "AbortError")) toastFehler(e.message); else if (e.name !== "AbortError") location.href = a.getAttribute("href"); }
    return;
  }
  if (!a || /[?&]ansehen=1/.test(a.getAttribute("href")) || !/(\.(pdf|docx|xlsx|csv|json|ics|db|zsich)|api\/sicherung|api\/abgleich\/datei)$/i.test(ziel)) return;   // „ansehen“: Kalender öffnen statt laden (wie bisher)
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
const SEITEN = {start: async () => (await Promise.all([browserWahlHtml(true), seiteStart()])).join(""), tag: seiteTag, monat: seiteMonat, woche: seiteWoche, horest: seiteHoRest, jahr: seiteJahr, urlaub: seiteUrlaub, krank: seiteKrank, steuer: seiteSteuer, export: seiteExport, sicherung: seiteSicherung, sync: seiteSync, einstellungen: seiteEinstellungen, hilfe: seiteHilfe, sondertage: seiteSondertage, monatsnachweis: seiteMonatsnachweis, suche: seiteSuche};
// Handy-Design: Kopfleiste (Zurück, Jahr, Menü) bleibt oben stehen (CSS sticky); der Rahmen wird beim Scrollen hinterlegt
window.addEventListener("scroll", () => document.body.classList.toggle("gescrollt", window.scrollY > 6), {passive: true});
neuErsterStart(speicher.l("ho_appv", ""));                  // vor dem Merken der Version: ein neues Gerät sieht „Neu in dieser Version“ nie (darstellung.js)
// Neue Version: gemerkte Seiten sofort verwerfen (vor dem ersten Zeichnen), sie können Markup der alten Version enthalten
{ const v = document.currentScript ? new URL(document.currentScript.src).searchParams.get("v") : "";
  if (v && speicher.l("ho_appv", "") !== v) { seitenCacheLeeren(); speicher.s("ho_appv", v); } }
fetch("api/version").then(r => r.json()).then(d => { if (speicher.l("ho_appv", "") !== d.version) { seitenCacheLeeren(); speicher.s("ho_appv", d.version); } APP_VERSION = d.version; const e = $("#app-version"); if (e) e.textContent = d.version; if (d.plattform === "desktop" && !d.fern) beendenKnopf();
  PLATTFORM = d.plattform || "server"; FERN = !!d.fern; if (MIT_SYNC.includes(PLATTFORM)) syncStart(); voreinstellungUebernehmen();
  nachErsterSeite(() => { netzAutomatik(); githubAutomatik(); versionBeobachten(); });   // erst zeichnen, dann ins Netz (Befund „Start hängt“)
  nachErsterSeite(neuAnbieten);                         // „Neu in dieser Version“ erst, wenn die Version bekannt und die Seite gezeichnet ist
  // Dienst-Skript (sw.js): Die Oberfläche bleibt im Gerät, die App startet vom Home-Bildschirm auch ohne Verbindung. Nur auf dem Server.
  if (PLATTFORM === "server" && "serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  if (PLATTFORM === "browser" && seitenName() === "start" && sichernFaellig()) zeigen();
  datenschutzLink();                                     // nur auf GitHub Pages (aufPages)
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
$("#suche-knopf").innerHTML = sym("suche");
$("#suche-knopf").onclick = () => { location.hash = "#/suche"; };   // Lupe: Tage suchen (Auftrag A6)
$("#farb-knopf").onclick = farbeUmschalten; darstellung();
$("#sync-symbol").onclick = syncSymbolTippen;
$("#zu-heute").onclick = () => { zeitDatum = zeitHeuteIso(); jahr = heute.getFullYear(); monat = heute.getMonth() + 1; window.scrollHeute = true; const ziel = `#/monat/${jahr}/${monat}`; if (location.hash === ziel) zeigen(); else location.hash = ziel; };
// Seitenwechsel bei offenem Blatt (Link im Menü, Sprung nach dem Speichern): eine Rückfrage gilt als abgebrochen, und auch das Blatt darunter schließt
// (sonst bliebe es über der neuen Seite). Zurück bei offenem Blatt schließt nur das Blatt (blattVerlauf).
window.addEventListener("hashchange", () => { if (blattZuRueck) { const r = blattZuRueck; blattZuRueck = null; r(); } blattZu(); seiteImVerlauf(); zeigen(); });
window.addEventListener("popstate", blattVerlauf);
if (!history.state) history.replaceState({tiefe: 0}, "");          // erster Eintrag der App in diesem Tab
verlaufMerken();
const OHNE_SPERRE = ["syncScannen"];                                // derselbe Knopf beendet das Lesen des QR-Codes
setInterval(() => {
  gleitzeitLaufend();
  if (!stempelDaten || !stempelDaten.laeuft) return;
  const s = uhr(stempelSekunden());
  [$("#b-uhr"), $("#s-uhr")].forEach(e => { if (e) e.textContent = s; });
}, 1000);
setInterval(quoteAmpelLaufend, QUOTE_AMPEL_TAKT);                    // Quote-Ampel mit der laufenden Uhr (bausteine/quote_ampel.js)
if (seitenName() !== "start") stempelLaden().then(gehenVergessenPruefen);     // die Übersicht fragt den Stand selbst ab
// Zurück in der App (alle Fassungen): Stand der Uhr neu holen und, wenn „Gehen“ vergessen scheint, noch einmal fragen
document.addEventListener("visibilitychange", () => { if (!document.hidden && modulAn("stempel")) stempelZurueck(); });

document.addEventListener("toggle", ev => { if (ev.target.classList && ev.target.classList.contains("jp-auf")) { jpOffen = ev.target.open; monatKlebt(); } }, true);
addEventListener("resize", monatKlebt);
// Aufklappen eines Abschnitts mit data-auf ruft diese Aktion (etwa die Liste der Lizenzen, die erst dann lädt)
document.addEventListener("toggle", ev => { const f = ev.target.open && AKTIONEN[ev.target.dataset?.auf]; if (f) f(); }, true);
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
  // Am Rechner von jeder Seite: heute eintragen (Strg+N bleibt beim Browser); nicht in der Einrichtung, ungesicherte Eingaben in der Spalte erst nach Rückfrage
  if ((e.key === "n" || e.key === "N") && !e.repeat && !e.altKey && !e.ctrlKey && !e.metaKey && !$("#einrichtung")) zeitVerwerfenOk().then(ok => { if (ok) heuteEintragen(); });
});


api("GET", "/konfig").then(k => { KONFIG = k.werte; }).catch(() => {}).finally(async () => { try { await zeigen(); } finally { ersteSeiteGezeichnet(); } if (seitenName() !== "start") zutunLaden().then(zutunZahl); });   // Zahl am Symbol; die Übersicht fragt selbst

const AKTIONEN = {profilWaehlen, uebersichtHoch, uebersichtRunter, uebersichtStandard, zutunSpaeter, zutunAus, zutunAlleTage, syncGithub, syncGithubTrennen, syncServerAbmelden, geraetEntfernen, monatOeffnen, exportHeute, neuLaden, appBeenden, browserWaehlen, syncAlle, syncDateiWaehlen, syncJetzt, profilAnwenden, profilSpeichern, profilLoeschen, profilDateiWaehlen, personAbmelden, personUmbenennen, benutzerAendern, selbstLoeschen, adminLoeschen, adminPasswort, adminSperren, adminRolle, adminNeuAnlegen, adminPapierkorbLeeren, adminPapierkorbZurueck, syncKoppeln, syncKoppelnAnnehmen, syncScannen, syncOrdner, syncPasswort, syncServer, syncWahl, abschnittBearbeiten, akzentStandard, anspruchSpeichern, bueroSetzen, dateiWaehlen, demoEnde, demoStart, familientageSchalten, freizeitSetzen, gleitzeitSetzen, handyJetzt, handyPasswort, handyWieder, heuteEintragen, kontoLoeschen, kontoSpeichern, monatAnsicht, monatBlaettern, rueckgaengig, planAlle, planArtWaehlen, planEintragen, planLoeschen, planZuruecksetzen, regelnSpeichern, regelnStandard, regelnVersionWeg, schritt, stempelBlatt, beginnKorrigieren, uebertragAuto, uebertragSpeichern, urlaubAnsicht, werkseinstellungen, wiederherstellen, zeitBlaettern, zeitHeute, zeitKalender, tagBearbeiten, zuHeute, handyDateiWaehlen, handyWiederDatei, zeigen, nachweisHeute, nachweisMonatWaehlen, datenPruefen, appPruefen, jahreswechselAnsparen, jahreswechselErledigt, einrichtungWeiter, einrichtungZurueck, einrichtungFertig, einrichtungUeberspringen, rundgang, rundgangStart, neuRundgang, neuAnsehen, neuNichtMehr, blattZu, syncEinrichten, syncWegWaehlen, syncWeiter, syncZurueck, syncAbbrechen, syncFertig, syncAlleWege, lizenzListe, lizenzText, syncGeraetEntfernen, brueckeEintragen, hilfeZuSeite, hilfeZurueck, sucheStarten};
const WECHSEL = {abmeldeFrageSchalten, mitternachtKappHinweis, neuSchalten, uebersichtZeigen, modulSchalten, profilSchalten, profilImport, familientageSchalten, hoModusWahl, dienstEigenWahl, syncAuto, syncEinlesen, syncFreigabe, syncOberflaeche, dateiNameZeigen, handyAuto, handyBehalten, handyDateiName, handyRhythmus, exportMonatWaehlen, exportJahrWaehlen, planKalenderLink, teilenSchalten, nachweisMonatWaehlen, nachweisZeitenSchalten, nachweisUnterschrift, zeitKalenderDatum, monatDatum};
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
