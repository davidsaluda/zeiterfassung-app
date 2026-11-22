# Zeiterfassung

Kleine, private Zeiterfassung für Büro und Homeoffice. Ohne Benutzerkonto, ohne Cloud-Dienst, ohne Werbung. Deine Zeiten bleiben auf deinem Gerät.

**Was die App kann:**

- Stempeluhr (Kommen, Gehen, Pause nach einstellbarer Pausenregel) oder Zeiten von Hand eintragen
- Monat, Woche und Jahr im Überblick, mit Soll, Ist und Saldo
- Gleitzeit-Konto und Freizeitkonto (Arbeit an Wochenenden und Feiertagen)
- Urlaub mit Übertrag und angespartem Urlaub, Gleittage, Familientage, Urlaubsplanung
- Krank und Attest (die App erinnert, wenn ein Attest fehlt)
- Homeoffice-Quote mit einstellbarer Grenze, oder ohne Grenze, ohne Homeoffice oder nur Homeoffice
- Module: Was du nicht brauchst, schaltest du unter „Einstellungen → Module“ ab (jede Seite des Menüs außer „Übersicht“ und „Einstellungen“, dazu zum Beispiel Gleittage, Familientage, Stempeluhr, einzelne Export-Formate). Es erscheint dann nirgends mehr
- Teilzeit, Elternzeit, Altersteilzeit und andere Arbeitszeiten als Abschnitte
- Homeoffice-Übersicht und Export als PDF, Word, ODT, ODS, Excel, Markdown, Text, JSON, XML, CSV, dazu Kalender (.ics) zum direkten Übernehmen
- Feiertage aller 16 Bundesländer
- Synchronisierung zwischen mehreren eigenen Geräten, verschlüsselt (wenn gewünscht)

> **Anleitung:** Alles Schritt für Schritt steht im **[Wiki](https://github.com/davidsaluda/zeiterfassung-app/wiki)**. Dort zuerst „Welcher Weg passt zu mir?“ lesen: [ein Gerät](https://github.com/davidsaluda/zeiterfassung-app/wiki/Ein-Geraet-Installieren), [mehrere eigene Geräte](https://github.com/davidsaluda/zeiterfassung-app/wiki/Mehrere-Geraete-Einrichten) oder [eigener Server/NAS](https://github.com/davidsaluda/zeiterfassung-app/wiki/NAS-Installieren).

## Was es hier gibt

| Was | Wo | Für |
|---|---|---|
| **Web-App** | die Adresse dieses Repos bei GitHub Pages: `https://<Konto>.github.io/<Name dieses Repos>/` (Ordner `docs`) | iPhone, iPad und jeden Browser, ohne Installation |
| **Fertige Apps** | **[Releases → neueste Version](https://github.com/davidsaluda/zeiterfassung-app/releases/latest)** | Windows, Android |
| **Server-Fassung** | `Zeiterfassung-NAS.zip` in den [Releases](https://github.com/davidsaluda/zeiterfassung-app/releases/latest) | NAS oder eigener Server mit Docker, für eine oder mehrere Personen |
| **Wiki: Anleitung Schritt für Schritt** | **[https://github.com/davidsaluda/zeiterfassung-app/wiki](https://github.com/davidsaluda/zeiterfassung-app/wiki)** | alle: welcher Weg passt (ein Gerät, mehrere Geräte, eigener Server/NAS), Bedienung, Fragen und Fehler |
| **Anleitung Synchronisierung über GitHub** | [ANLEITUNG-GITHUB.md](https://github.com/davidsaluda/zeiterfassung-app/blob/main/ANLEITUNG-GITHUB.md) | wer mehrere Geräte auf denselben Stand bringen will |

Wichtig: Alle GitHub-Pages-Seiten eines Kontos teilen sich im Browser einen Speicher (`<Konto>.github.io`). Eine andere Seite desselben Kontos könnte deine Zeiten und Zugangsdaten lesen. Betreibe auf diesem Konto keine weitere Pages-Seite, oder gib der App eine eigene Domain oder ein eigenes Konto.

Alle Fassungen sind dieselbe App mit derselben Oberfläche. Den Link zu den Apps gibt es auch in der App unter *Hilfe → Über diese App*.

## Welche Fassung für welches Gerät

| Gerät | Fassung | Installation |
|---|---|---|
| Windows 10 und 11 | `Zeiterfassung-Windows.zip` aus den Releases | keine: Zip entpacken, portabel, läuft im eigenen App-Fenster |
| Android | `Zeiterfassung-Android.apk` aus den Releases | APK installieren |
| iPhone, iPad | Web-App | Seite in Safari öffnen und zum Home-Bildschirm hinzufügen |
| jeder andere Rechner oder Browser | Web-App | Seite öffnen, fertig |
| NAS oder eigener Server (Docker) | `Zeiterfassung-NAS.zip` aus den Releases | entpacken, `docker compose up -d`, davor ein Reverse-Proxy mit HTTPS |

Du kannst eine Fassung allein nutzen oder mehrere zusammen. Mehr dazu unter „Mehrere Geräte“.

## Installieren und starten

### Windows

1. `Zeiterfassung-Windows.zip` aus den [Releases](https://github.com/davidsaluda/zeiterfassung-app/releases/latest) laden und an einen beliebigen Ort entpacken, zum Beispiel in den Ordner „Dokumente“ oder auf einen USB-Stick. Gestartet wird `Zeiterfassung\Zeiterfassung.exe`. Für ein Update genauso in einen neuen Ordner entpacken und den alten löschen; die Daten bleiben erhalten.
2. Doppelklick. Beim ersten Start warnt Windows „Der Computer wurde durch Windows geschützt“, weil die Datei nicht mit einem gekauften Zertifikat signiert ist: *Weitere Informationen → Trotzdem ausführen*.
3. Die App öffnet ihr eigenes Fenster. Beenden: Fenster schließen. Jede Eingabe ist sofort gespeichert.

Die Anzeige im Fenster kommt von WebView2, das in Windows 10 und 11 schon enthalten ist.

### Android

1. `Zeiterfassung-Android.apk` am Handy aus den [Releases](https://github.com/davidsaluda/zeiterfassung-app/releases/latest) laden.
2. Öffnen. Android fragt beim ersten Mal, ob der Browser oder die Dateien-App Apps installieren darf: einmal erlauben.
3. Ein Update geht genauso: die neue APK über die alte installieren, die Daten bleiben.

### iPhone und iPad

1. In **Safari** die Adresse der Web-App öffnen (siehe oben).
2. Teilen-Symbol, dann **„Zum Home-Bildschirm“**.
3. Ab jetzt die App **nur vom Home-Bildschirm** starten. Sie hat dort einen eigenen Speicher, getrennt von Safari.
4. Der erste Start lädt etwa 10 MB. Danach läuft die App auch ohne Verbindung.

### Im Browser (jeder Rechner)

Die Adresse der Web-App öffnen. Nicht im privaten Modus, sonst sind die Daten beim Schließen weg.

### NAS oder eigener Server (Docker)

Für alle, die die App zentral betreiben wollen, für sich oder für mehrere Personen. Vorne steht eine Anmeldung mit Benutzername und Passwort, dahinter hat jede Person ihre eigenen Daten.

1. `Zeiterfassung-NAS.zip` aus den [Releases](https://github.com/davidsaluda/zeiterfassung-app/releases/latest) laden und in einen eigenen Ordner entpacken.
2. In `compose.yaml` bei `HO_HOSTS` die eigenen Namen eintragen.
3. Starten: `docker compose up -d`, auf einer Synology im *Container Manager* als Projekt.
4. Einen Reverse-Proxy mit HTTPS davor setzen, Ziel `http://127.0.0.1:8100`.
5. Seite öffnen. Die erste angelegte Person wird Admin.

Desktop-App und Android-App synchronisieren mit dem Server: unter **Synchronisieren** die Adresse eintragen und mit Benutzername und Passwort anmelden. Die Anmeldung der Apps geht nur über https. Alle Schritte, Datensicherung und Update stehen in `ANLEITUNG-NAS.md` im Zip.

## Erste Schritte in der App

1. **Beim ersten Start:** Die App fragt „Wie arbeitest du?“. Wähle **Büro + Homeoffice**, **Mit Homeoffice-Grenze** oder **Nur Zeiterfassung** (ohne Homeoffice-Grenze). Bis zur Wahl gilt „Büro + Homeoffice“. Du kannst es später unter **Einstellungen → Module und Profile** ändern; dort gibt es auch „Nur Büro“ und „Nur Homeoffice“.
2. **Einstellungen → Arbeitszeit und Regeln:** Bundesland, Wochenstunden, Arbeitstage und Pausenregel prüfen. Bei **Homeoffice** wählen, was für dich gilt: mit Grenze (zum Beispiel 80 %), ohne Grenze, kein Homeoffice oder nur Homeoffice. 0 % heißt kein Homeoffice, 100 % heißt ohne Grenze.
3. **Einstellungen → Arbeitszeit und Regeln (Arbeitszeit-Abschnitte):** nur nötig bei Teilzeit, Elternzeit und Ähnlichem.
4. **Einstellungen → Person und Startwerte:** deinen aktuellen Stand mit Datum eintragen.
5. **Urlaub → Erweitert:** Jahresanspruch, Übertrag oder angesparten Urlaub eintragen.
6. Ab jetzt mit der Stempeluhr buchen oder Tage im Monat nachtragen.

Erst ausprobieren? Auf der leeren Übersicht **„Mit Beispieldaten ausprobieren“**. Die Demo nutzt eine eigene Datenbank mit zufälligen Beispieltagen, passend zu deinen Regeln. Deine Daten bleiben unberührt.

**Oben in der Leiste** (am Rechner links unter dem Namen der App) gibt es Schnell-Symbole: **Heute im Monat** (Kalender), **Hell/Dunkel** (Sonne/Mond) und, wenn eine Synchronisierung eingerichtet ist, den **Sync-Status** (Wolke: grün = synchronisiert, rot = etwas zu tun, antippen = jetzt synchronisieren).

## Wo liegen meine Daten?

| Was | Wo | Wer kann es lesen |
|---|---|---|
| Die App (Programm) | in diesem öffentlichen Repo | alle |
| Deine Zeiten, Einstellungen, Sicherungen | nur auf deinem Gerät | nur du |
| Synchronisierung zwischen deinen Geräten (wenn gewünscht) | in **deinem eigenen privaten Repo**, verschlüsselt mit deinem Passwort | nur du |

| Fassung | Ordner der Daten |
|---|---|
| Windows | versteckt im Benutzerprofil: `%LOCALAPPDATA%\Zeiterfassung` |
| Android | im Speicher der App |
| iPhone, iPad, Browser | im Speicher des Browsers bzw. der App vom Home-Bildschirm |

In dieses öffentliche Repo schreibt die App nie etwas. Es gibt hier keine Zeiten und keine Namen. Wer die App lädt, bleibt unbekannt; GitHub zählt nur, wie oft eine Datei geladen wurde.

## Sichern

- **Sicherung → Sicherung herunterladen:** die komplette Datenbank als Datei. Mit „Wiederherstellen“ spielst du sie wieder ein.
- **iPhone, iPad, Browser:** Safari darf den Speicher einer Seite leeren, wenn sie lange nicht benutzt wurde. Deshalb unter *Sicherung* ein Passwort festlegen und regelmäßig eine verschlüsselte Sicherung speichern, zum Beispiel in iCloud Drive.
- **Windows:** Die App legt zusätzlich jeden Tag eine Sicherung im Datenordner an.
- Eine Synchronisierung mit einem zweiten Gerät ist gleichzeitig eine laufende Sicherung.

## Mehrere Geräte

Jede Zusammenstellung geht, auch **nur ein Gerät allein**: Dann brauchst du keinen Synchronisierung und kein GitHub. Eine Synchronisierung lohnt sich ab zwei Geräten, zum Beispiel zwei Rechner, Rechner und Handy oder Handy und eigener Server. Alle verbinden sich mit demselben **privaten** Repo in deinem GitHub-Konto. Die Geräte müssen sich dafür nicht gegenseitig erreichen (kein VPN, kein gleiches WLAN).

**Schritt für Schritt mit allen Klickwegen und Fehlermeldungen: [ANLEITUNG-GITHUB.md](https://github.com/davidsaluda/zeiterfassung-app/blob/main/ANLEITUNG-GITHUB.md).** Kurzfassung:

1. Bei GitHub ein **privates** Repo anlegen, zum Beispiel `zeiterfassung-daten`.
2. Ein **Fine-grained Token** nur für dieses Repo anlegen, Berechtigung **Contents: Read and write**.
3. In der App unter **Synchronisieren** ein Passwort festlegen (auf allen Geräten **dasselbe**), dann bei **GitHub als Speicherort** Repo und Token eintragen und **„Mit GitHub verbinden“**.

| Gerät | So kommt es dazu | Synchronisiert |
|---|---|---|
| iPhone, iPad, Browser (Web-App) | Passwort, Repo und Token eintragen | beim Öffnen, nach Änderungen, beim Zurückkehren in die App und alle 15 Minuten, solange die App offen ist |
| Windows | wie oben, oder **Geräte koppeln**: am verbundenen Gerät „Code anzeigen“, hier den Kurzcode eingeben | nach Änderungen, beim Zurückkehren in die App und alle 15 Minuten, solange die App läuft |
| Android | wie oben, oder **Geräte koppeln** per Kurzcode oder **QR-Code scannen** | nach Änderungen, beim Zurückkehren in die App und alle 15 Minuten, solange die App läuft |
| Eigener Server (zum Beispiel auf einer NAS) | auf der Seite des Servers Passwort, Repo und Token eintragen | rund um die Uhr |

- **Automatisch synchronisieren** ist nach dem Verbinden an und lässt sich mit dem Schalter ausschalten. Dann synchronisiert die App nur mit **„Jetzt synchronisieren“** oder der Wolke oben.
- Beim ersten Mal zuerst das Gerät mit den vorhandenen Daten verbinden und synchronisieren, dann die anderen.
- Ändern zwei Geräte denselben Tag verschieden, erscheint er unter **Konflikte**, und du entscheidest. Nichts geht still verloren.
- Ein Token reicht für alle Geräte. Wer mag, legt je Gerät ein eigenes an: Dann lässt sich ein einzelnes Gerät sperren.
- Alle Geräte auf **dieselbe Version** bringen.

### Synchronisieren auf einem Gerät abschalten

Unter **Einstellungen → Module und Profile** lässt sich „Synchronisieren“ je Gerät abschalten. Das Gerät meldet sich mit einer letzten Synchronisierung ab und synchronisiert danach nicht mehr. Die anderen Geräte zählen mit (Seite **Synchronisierung**, Zeile „Geräte in der Synchronisierung“) und synchronisieren weiter, solange es mindestens zwei sind. Ist ein Gerät allein übrig, schaltet es die Synchronisierung von selbst ab. Wieder einschalten: auf jedem Gerät unter **Einstellungen → Module und Profile**.

## Updates

| Fassung | So kommt eine neue Version |
|---|---|
| Web-App | von selbst. Die App meldet „Eine neue Version der App ist geladen“. |
| Windows | neue Datei aus den Releases laden und die alte damit ersetzen. Die Daten bleiben im Benutzerprofil. |
| Android | neue APK über die alte installieren. Die Daten bleiben. |
| NAS oder eigener Server | Vorher `data` und `ablage` sichern. Neues `Zeiterfassung-NAS.zip` laden, die Ordner `app` und `anmeldedienst` ganz ersetzen (nicht über die alten kopieren), Projekt neu bauen (`docker compose up -d --force-recreate`). Hieß der Ordner bisher `pfoertner`, auch die `compose.yaml` anpassen (Ablauf: `ANLEITUNG-NAS.md`, Abschnitt „Update“). Die Daten bleiben. |

## Gut zu wissen

- Das **Passwort** lässt sich nicht zurückholen. Gut aufbewahren, am besten im Passwort-Manager. Am iPhone nicht das „starke Passwort“ von Safari übernehmen, sonst hat jedes Gerät ein anderes.
- Das **Token** ist wie ein Schlüssel für dein Daten-Repo. Niemandem zeigen. Geht ein Gerät verloren: Token bei GitHub löschen, ein neues anlegen und auf allen anderen Geräten ein neues Passwort für die Synchronisierung setzen (das verlorene Gerät kennt den Schlüssel zum alten). Ohne das Passwort kann niemand die Synchronisierungsdateien lesen, auch GitHub nicht; das Daten-Repo deshalb immer privat anlegen.
- Die App spricht nur mit GitHub, und nur wenn du ein Repo verbunden hast. Sonst öffnet sie keine Verbindung ins Internet.
- Hilfe zu allen Funktionen steht in der App unter **Hilfe**.

## Für die Person, die dieses Repo betreibt

- GitHub Pages einmal einschalten: *Settings → Pages*, Source **Deploy from a branch**, Branch **main**, Ordner **/docs**. Nach ein bis zwei Minuten steht die Adresse oben auf der Seite.
- Auf demselben Konto keine zweite Pages-Seite betreiben: Alle Seiten eines Kontos teilen sich im Browser einen Speicher.
- Die fertigen Apps kommen je Version als Release mit Prüfsummen dazu, nicht in die Git-Geschichte.
