# Synchronisieren über GitHub: Schritt für Schritt

Mit dieser Anleitung haben alle deine Geräte denselben Stand: iPhone, iPad, Windows, Android, der Browser und, falls vorhanden, ein eigener Server.
Die Gemeinsamkeit ist ein **privates Repo** in deinem eigenen GitHub-Konto. Du brauchst etwa zehn Minuten.
Welche Geräte du verbindest, ist frei: zwei Rechner, Rechner und Handy, nur Android-Geräte und so weiter. Wer die App nur auf einem Gerät nutzt, braucht diese Anleitung nicht.

## So funktioniert es

- Jedes Gerät legt seine Einträge als eine Datei `abgleich-<Gerätekennung>.zsich` in dein Repo und liest die Dateien der anderen Geräte.
- Die Dateien sind mit deinem Passwort verschlüsselt (AES-256-GCM). GitHub und alle, die das Repo sehen könnten, lesen nur Zeichensalat.
- Das Passwort verlässt nie dein Gerät. Auf GitHub liegt es nicht.
- Die Geräte müssen sich untereinander nicht erreichen. Kein VPN, kein gleiches WLAN, kein eigener Server nötig.
- Ohne Verbindung arbeitet jedes Gerät normal weiter und synchronisiert, sobald GitHub wieder erreichbar ist.

## Was du brauchst

| Was | Hinweis |
|---|---|
| Ein GitHub-Konto | kostenlos, unter [github.com/signup](https://github.com/signup) |
| Ein Passwort für die App | mindestens 8 Zeichen, **auf allen Geräten dasselbe**. Am besten im Passwort-Manager speichern. Es lässt sich nicht wiederherstellen. |
| Die App auf jedem Gerät | alle Geräte auf **dieselbe Version** bringen |

## Teil 1: Privates Repo anlegen (einmal)

1. Bei GitHub anmelden.
2. Oben rechts auf **+**, dann **New repository**.
3. **Repository name:** zum Beispiel `zeiterfassung-daten`.
4. **Private** wählen. Das ist wichtig: Ein öffentliches Repo geht zwar auch, aber dann kann jeder die verschlüsselten Dateien abrufen.
5. Sonst nichts ankreuzen (kein README, kein .gitignore, keine Lizenz).
6. **Create repository**. Das Repo bleibt leer, die App legt ihre Dateien selbst an.

Merke dir den vollen Namen: `<dein Konto>/zeiterfassung-daten`, zum Beispiel `maxmuster/zeiterfassung-daten`.

## Teil 2: Token anlegen (einmal)

Das Token ist ein Schlüssel, mit dem die App in genau dieses eine Repo schreiben darf, und in kein anderes.

1. Oben rechts auf dein **Profilbild**, dann **Settings**.
2. Links ganz unten **Developer settings**.
3. **Personal access tokens**, dann **Fine-grained tokens**, dann **Generate new token**.
4. **Token name:** frei wählbar, zum Beispiel `Zeiterfassung`.
5. **Expiration (Ablauf):** nach Wunsch, höchstens ein Jahr. Läuft das Token ab, meldet die App einen Fehler bei der Synchronisierung. Dann einfach ein neues anlegen (siehe unten).
6. **Repository access:** **Only select repositories** und nur dein Daten-Repo auswählen.
7. **Permissions → Repository permissions → Contents:** auf **Read and write** stellen. „Metadata: Read-only“ setzt GitHub selbst dazu. Mehr ist nicht nötig.
8. Ganz unten **Generate token**.
9. Das Token (beginnt mit `github_pat_`) **sofort kopieren** und im Passwort-Manager speichern. GitHub zeigt es nur dieses eine Mal.

Gib das Token nie weiter. Wer es hat, kann die Dateien im Repo löschen (lesen kann er sie ohne dein Passwort nicht).

## Teil 3: Erstes Gerät verbinden

In der App:

1. **Synchronisieren** öffnen.
2. **Passwort festlegen** (mindestens 8 Zeichen, zweimal eingeben):
   - Windows, Android, eigener Server: im Abschnitt **Synchronisierung mit anderen Geräten**.
   - Web-App (iPhone, iPad, Browser): oben unter **Passwort der Sicherung**.
   - Am iPhone: Schlägt Safari ein „starkes Passwort“ vor, **nicht** übernehmen. Dein eigenes Passwort eintippen oder aus dem Passwort-Manager einsetzen. Sonst hat jedes Gerät ein anderes Passwort.
3. Bei **GitHub als Speicherort**:
   - **Repo (konto/name):** `<dein Konto>/zeiterfassung-daten`
   - **Token:** das kopierte Token einsetzen
   - **Mit GitHub verbinden**
4. Die App zeigt **„Verbunden mit … privates Repo“**. Steht dort „öffentliches Repo“, ist das Repo öffentlich: in GitHub unter Settings → General → Danger Zone auf privat stellen.
5. **Jetzt synchronisieren**. Unter „Letzte Synchronisierung“ stehen Zeit und Anzahl der Geräte.
6. **Automatisch synchronisieren** ist nach dem Verbinden eingeschaltet, auf allen Geräten. Wer das nicht möchte, schaltet es mit dem Schalter aus und gleicht nur noch mit **Jetzt synchronisieren** (oder der Wolke oben) ab.

## Teil 4: Weitere Geräte verbinden

**Weg A, auf jedem Gerät von Hand:** wie in Teil 3. Dasselbe Passwort, dasselbe Repo, dasselbe Token.

**Weg B, Koppeln per Code (Windows, Android):** Beide Geräte im selben WLAN oder VPN.

1. Auf dem schon verbundenen Gerät unter **Geräte koppeln** auf **Code anzeigen**.
2. Auf dem neuen Gerät den Code eingeben (Android: auch **QR-Code scannen**) und **Koppeln**.
3. Repo, Token und Schlüssel kommen von selbst mit. Der Code gilt einige Minuten und für genau ein Gerät.

**iPhone und iPad:** Die Web-App von der Adresse der App in Safari öffnen, über **Teilen → Zum Home-Bildschirm** ablegen und **nur von dort** starten (sie hat dort einen eigenen Speicher). Dann Teil 3.

## Was beim ersten Synchronisieren passiert

- Einträge, die nur auf einem Gerät stehen, kommen **ohne Rückfrage** auf alle anderen.
- Steht derselbe Tag auf zwei Geräten verschieden, erscheint er unter **Konflikte**, und du entscheidest. Nichts wird still überschrieben.
- Vor der ersten Synchronisierung deshalb auf jedem Gerät nachsehen, dass dort nur echte Einträge stehen (keine Testeinträge).

## Wann synchronisiert wird

| Gerät | Wann |
|---|---|
| Windows, Android | nach jeder Änderung, beim Zurückkehren in die App und alle 15 Minuten, solange die App läuft |
| Eigener Server | nach jeder Änderung, beim Zurückkehren in die App und alle 15 Minuten, rund um die Uhr |
| Web-App (iPhone, iPad, Browser) | beim Öffnen, 5 Sekunden nach jeder Änderung, alle 15 Minuten und beim Zurückkehren in die App, solange sie offen ist. iOS lässt Web-Apps nicht im Hintergrund laufen. |

Eine offene Seite schaut außerdem alle 2 Minuten bei der eigenen App nach, ob die Synchronisierung im Hintergrund etwas übernommen hat, und zeigt es dann an. Das ist keine Synchronisierung: Dabei geht nichts zu GitHub oder zu anderen Geräten.

Eine offene Seite zeigt übernommene Änderungen von selbst, außer während du gerade etwas eintippst.

## Synchronisieren auf einem Gerät abschalten

Unter **Einstellungen → Module und Profile** lässt sich „Synchronisieren“ je Gerät abschalten. Das Gerät meldet sich mit einer letzten Synchronisierung ab und synchronisiert danach nicht mehr. Die anderen Geräte zählen mit (Seite **Synchronisierung**, Zeile „Geräte in der Synchronisierung“) und synchronisieren weiter, solange es mindestens zwei sind. Ist ein Gerät allein übrig, schaltet es die Synchronisierung von selbst ab. Wieder einschalten: auf jedem Gerät unter **Einstellungen → Module und Profile**.

## Wenn etwas nicht geht

| Meldung oder Zeichen | Ursache und Abhilfe |
|---|---|
| „GitHub ist von diesem Gerät aus nicht erreichbar …“ | Keine Verbindung ins Internet oder die Namensauflösung (DNS) klappt nicht. Verbindung prüfen. Auf einem eigenen Server (Docker) einen DNS-Server in der Compose-Datei eintragen. Die Daten in der App bleiben unverändert. |
| „GitHub lehnt das Token ab oder es darf in dieses Repo nicht schreiben …“ | Token abgelaufen, falsch kopiert, für ein anderes Repo angelegt oder ohne „Contents: Read and write“. Repo-Namen prüfen (`konto/name`) und notfalls ein neues Token anlegen. |
| „Das Passwort passt nicht zur Synchronisierungsdatei eines anderen Geräts …“ | Auf den Geräten gelten verschiedene Passwörter. Auf diesem Gerät das Passwort der anderen Geräte eingeben. Häufigster Grund: Safari hat am iPhone ein „starkes Passwort“ eingesetzt. |
| „Ein anderes Gerät wartet“ | Ein neues Gerät ist dazugekommen. Hier einmal das Passwort eingeben (dasselbe wie dort). |
| „Die Synchronisierungsdatei eines anderen Geräts ist ungültig …“ | Meist ist ein Gerät auf einer älteren Version. Alle Geräte auf dieselbe Version bringen. |
| „Jetzt synchronisieren“ ist grau (Web-App) | Erst Passwort festlegen und mit GitHub verbinden. |
| Änderung kommt auf einem Gerät nicht an | Die App dort einmal schließen und wieder öffnen (synchronisiert beim Zurückkehren) oder „Jetzt synchronisieren“. Im Hintergrund kommt es spätestens nach 15 Minuten an. In der Web-App die App öffnen, sie gleicht nur, solange sie offen ist. |

## Token erneuern, Gerät entfernen, trennen

- **Token läuft ab:** In GitHub ein neues Token anlegen (Teil 2). Auf einem Gerät unter **Verbindung trennen** trennen und mit dem neuen Token neu verbinden. Die anderen Geräte genauso, oder per **Koppeln** übertragen.
- **Gerät verloren:** In GitHub unter Developer settings → Fine-grained tokens das Token löschen (**Delete**) und ein neues anlegen. **Zusätzlich auf allen anderen Geräten ein neues Passwort für die Synchronisierung setzen:** Das verlorene Gerät kennt den Schlüssel zum alten Passwort. Alte Dateien in der Geschichte des Repos bleiben mit dem alten Passwort lesbar; bei einem öffentlichen Repo deshalb ein neues privates Repo anlegen.
- **Synchronisierung beenden:** **Verbindung trennen**. Die Einträge auf dem Gerät bleiben, die Dateien im Repo auch.
- **Passwort ändern:** auf einem Gerät neues Passwort festlegen, danach auf allen anderen dasselbe neue Passwort.
