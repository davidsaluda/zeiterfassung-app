# Zeiterfassung

Kleine, private Zeiterfassung für Büro und Homeoffice. Ohne Benutzerkonto, ohne Cloud-Dienst, ohne Werbung. Deine Zeiten bleiben auf deinem Gerät.

**Was die App kann:**

- Stempeluhr (Kommen, Gehen, Pause nach einstellbarer Pausenregel) oder Zeiten von Hand eintragen
- Monat, Woche und Jahr im Überblick, mit Soll, Ist und Saldo
- Gleitzeit-Konto und Freizeitkonto (Arbeit an Wochenenden und Feiertagen)
- Kappung der Gleitzeit mit Stichtag und Grenze (einstellbar, für Beamte in Bayern ab Werk an)
- Urlaub mit Übertrag, Frist für den Resturlaub (je Dienstverhältnis), angespartem Urlaub und Zusatzurlaub, Gleittage, Familientage, Urlaubsplanung
- Krank und Attest (die App erinnert, wenn ein Attest fehlt)
- Homeoffice-Quote mit einstellbarer Grenze, oder ohne Grenze, ohne Homeoffice oder nur Homeoffice
- Module: Was du nicht brauchst, schaltest du unter „Einstellungen → Module“ ab (jede Seite des Menüs außer „Übersicht“ und „Einstellungen“, dazu zum Beispiel Gleittage, Familientage, Stempeluhr, einzelne Export-Formate). Es erscheint dann nirgends mehr
- Teilzeit, Elternzeit, Altersteilzeit und andere Arbeitszeiten als Abschnitte
- Homeoffice-Übersicht und Export als PDF, Excel und CSV, dazu Kalender (.ics); Word beim Monatsnachweis
- Feiertage aller 16 Bundesländer
- Synchronisierung zwischen mehreren eigenen Geräten, verschlüsselt (wenn gewünscht)

> **Anleitung:** Alles Schritt für Schritt steht im **[Wiki](https://github.com/davidsaluda/zeiterfassung-app/wiki)**: Installieren, Einrichten, Sichern, Synchronisieren, Update, Fragen und Fehler. Dort zuerst [„Welcher Weg passt zu mir?“](https://github.com/davidsaluda/zeiterfassung-app/wiki/Home#welcher-weg-passt-zu-mir) lesen.

## Was es hier gibt

| Was | Wo | Für |
|---|---|---|
| **Web-App** | die Adresse dieses Repos bei GitHub Pages: **[https://davidsaluda.github.io/zeiterfassung-app/](https://davidsaluda.github.io/zeiterfassung-app/)** (GitHub Pages, Ordner `docs`) | iPhone, iPad und jeden Browser, ohne Installation |
| **Fertige Apps** | **[Releases → neueste Version](https://github.com/davidsaluda/zeiterfassung-app/releases/latest)** | Windows, Android |
| **Server (Docker)** | `Zeiterfassung-Server-Docker.zip` in den [Releases](https://github.com/davidsaluda/zeiterfassung-app/releases/latest) | eigener Server mit Docker (z. B. eine NAS), für eine oder mehrere Personen |
| **Wiki: Anleitung Schritt für Schritt** | **[https://github.com/davidsaluda/zeiterfassung-app/wiki](https://github.com/davidsaluda/zeiterfassung-app/wiki)** | alle |

Wichtig: Alle GitHub-Pages-Seiten eines Kontos teilen sich im Browser einen Speicher (`<Konto>.github.io`). Eine andere Seite desselben Kontos könnte deine Zeiten und Zugangsdaten lesen. Betreibe auf diesem Konto keine weitere Pages-Seite, oder gib der App eine eigene Domain oder ein eigenes Konto.

Alle Fassungen sind dieselbe App mit derselben Oberfläche. Den Link zu den Apps gibt es auch in der App unter *Hilfe → Über diese App*, die Hilfe zu allen Funktionen unter **Hilfe**.

## Anleitung je Gerät

| Ich habe … | Anleitung im Wiki |
|---|---|
| einen Windows-Rechner (Windows 10 oder 11) | [Windows](https://github.com/davidsaluda/zeiterfassung-app/wiki/Windows) |
| ein Android-Handy oder -Tablet | [Android](https://github.com/davidsaluda/zeiterfassung-app/wiki/Android) |
| ein iPhone, iPad oder einen anderen Rechner mit Browser | [iPhone, iPad und Browser](https://github.com/davidsaluda/zeiterfassung-app/wiki/iPhone-iPad-Browser) |
| einen eigenen Server mit Docker (z. B. eine NAS), für mich oder mehrere Personen | [Server (Docker)](https://github.com/davidsaluda/zeiterfassung-app/wiki/Server-Docker) |

## Mehrere Geräte

| Was | Anleitung im Wiki |
|---|---|
| Überblick: welcher Weg, Sync-Passwort, Koppeln, Konflikte | [Synchronisieren](https://github.com/davidsaluda/zeiterfassung-app/wiki/Synchronisieren) |
| Synchronisieren über ein eigenes privates GitHub-Repo (alle Geräte) | [Synchronisieren über GitHub](https://github.com/davidsaluda/zeiterfassung-app/wiki/GitHub-Synchronisieren) |
| Synchronisieren mit dem eigenen Server | [Server (Docker): Geräte synchronisieren](https://github.com/davidsaluda/zeiterfassung-app/wiki/Server-Docker-Synchronisieren) |

Fragen und Fehler: [Wiki → Fragen und Fehler](https://github.com/davidsaluda/zeiterfassung-app/wiki/Fragen-und-Fehler). Was die App sendet und wo die Daten liegen: [Wiki → Datenschutz](https://github.com/davidsaluda/zeiterfassung-app/wiki/Datenschutz). Datenschutzerklärung der Web-App bei GitHub Pages: [Datenschutz](https://davidsaluda.github.io/zeiterfassung-app/datenschutz.html). In dieses öffentliche Repo schreibt die App nie etwas, es gibt hier keine Zeiten und keine Namen.

## Für die Person, die dieses Repo betreibt

- GitHub Pages einmal einschalten: *Settings → Pages*, Source **Deploy from a branch**, Branch **main**, Ordner **/docs**. Nach ein bis zwei Minuten steht die Adresse oben auf der Seite.
- Auf demselben Konto keine zweite Pages-Seite betreiben: Alle Seiten eines Kontos teilen sich im Browser einen Speicher.
- Die fertigen Apps kommen je Version als Release mit Prüfsummen dazu, nicht in die Git-Geschichte.
