# Google Translate TTS

Gibt Gladys die kostenlose Stimme von **Google Übersetzer**: Die Ansagen der
Szenen werden damit auf deinen Lautsprechern gesprochen. Ohne Konto und ohne
API-Schlüssel, wie die Sprachausgabe `google_translate` von Home Assistant
(gTTS).

## Was du bekommst

- Eine **Stimme für Gladys** (Gladys 5.3.0 oder neuer): Sobald sie gewählt ist,
  spricht die Szenenaktion **Auf einem Lautsprecher sprechen** mit Google Übersetzer
  auf deinen Lautsprechern (Sonos, Google Cast, AirPlay…).
- Texte in **33 Sprachen**, automatisch in der Sprache des jeweiligen
  Benutzers, mit regionalen Akzenten für Englisch, Französisch, Spanisch und
  Portugiesisch, und langsames Vorlesen.
- Lange Texte (bis zu den 2.000 Zeichen, die Gladys sendet) werden am Satzende
  geteilt und zu einem einzigen Clip zusammengefügt.

## Bevor du anfängst: was diese Stimme ist

- Es ist die Stimme der **Website Google Übersetzer**, so genutzt, wie gTTS es
  seit Jahren tut. Es ist **kein offizieller Dienst von Google**: keine
  Garantie, und Google kann sie jederzeit ändern, begrenzen oder einstellen.
  Die Integration schlägt dann sichtbar fehl (Supervision, Szenenprotokoll),
  sie wechselt nie von selbst zu einer anderen Stimme.
- **Jeder gesprochene Text geht an Google** (mit der IP-Adresse deiner
  Verbindung), gemäß der
  [Datenschutzerklärung von Google](https://policies.google.com/privacy).
  Nutze sie nicht für Texte, die zu Hause bleiben sollen.
- Eine Internetverbindung ist nötig.
- Keine Verbindung zu Google. Google Übersetzer ist eine Marke von Google LLC.

## Konfiguration

1. Installiere die Integration aus dem Katalog und öffne dann ihren Reiter
   **Konfiguration**.
2. **Sprache der Stimme**: **Automatisch** spricht die Sprache des Benutzers,
   dem Gladys antwortet, und bei einer Szenenansage die des ersten
   Administrators (Französisch, wenn Gladys sie nicht kennt). Oder lege eine
   Sprache fest.
3. **Akzent**: eine regionale Stimme (Englisch der USA, des Vereinigten
   Königreichs, Australiens oder Indiens; Französisch Frankreichs oder Kanadas;
   Spanisch Spaniens oder Mexikos; Portugiesisch Brasiliens oder Portugals).
   Diese Stimme gilt, wenn ihre Sprache gesprochen wird; die anderen Sprachen behalten
   ihre übliche Stimme. Die übliche englische Stimme ist die britische.
4. **Langsames Vorlesen**: spricht langsamer, wie die Taste für langsames
   Vorlesen von Google Übersetzer.
5. Speichere und drücke dann **Stimme testen**: Ein Testsatz wird bei Google
   Übersetzer angefragt, und die Länge des erhaltenen Clips wird angezeigt.
6. Öffne **Integrationen → Künstliche Intelligenz** und wähle **Google
   Translate TTS** in der Karte **Stimme**.

## Verwendung in Szenen

Füge einer Szene eine Aktion **Auf einem Lautsprecher sprechen** hinzu, wähle einen
Lautsprecher und gib den Text ein. Gladys fragt den Clip bei dieser Integration
an und stellt ihn dem Lautsprecher in deinem lokalen Netzwerk bereit.

Der Sprachassistent von Gladys bleibt mit einer Stimmen-Integration reiner
Text: Seine Seite läuft über HTTPS, und der Clip wird im lokalen Netzwerk über
HTTP bereitgestellt, was der Browser blockiert. Das ist eine Grenze von Gladys,
für jede Stimmen-Integration gleich.

## Grenzen

- Google Übersetzer nimmt **200 Zeichen pro Anfrage**: Ein längerer Text wird
  am Satzende (dann am Teilsatz, dann am Wort) geteilt und **Teil für Teil**
  angefragt, jeweils etwa 0,3 s. Die höchstens 2.000 Zeichen, die Gladys
  sendet, ergeben etwa 12 Anfragen, 4 Sekunden und einen Clip von 1,5 MB für
  3 Minuten: deutlich unter den 30 Sekunden, die Gladys wartet.
- Jeder Teil wird mit eigener Betonung gelesen: Ein langer Text hat kurze
  Pausen zwischen den Teilen.
- Ein bereits erstellter Clip (gleicher Text, gleiche Stimme, gleiches Tempo)
  bleibt im Speicher (die letzten 16), und eine Ansage auf mehreren
  Lautsprechern fragt Google nur einmal.
- Wenn Google zu viele Anfragen ablehnt (HTTP 429), wartet die Integration auf
  die nächste Ansage, statt es sofort erneut zu versuchen.

## Fehlerbehebung

- Die **Supervision** zeigt, ob Google Übersetzer antwortet, und sonst warum
  nicht (kein Internet, zu viele Anfragen, die kostenlose Stimme hat sich
  geändert…).
- Eine fehlgeschlagene Ansage steht in den **Protokollen** der Integration, und
  die Szenenaktion schlägt im Szenenprotokoll fehl.
- „Die kostenlose Stimme hat sich vielleicht geändert“: Google hat seine
  Website geändert; such nach einem Update der Integration.
- Starte den Container mit `LOG_LEVEL=debug`, um jede Anfrage zu sehen.
