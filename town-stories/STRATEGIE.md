# Town Stories: Strategie & Pipeline

## 1. Was gerade viral geht (Recherche, Nov 2026)
- **"In This Town" / "In my town…"-Videos** in Klötzchen-3D sind der aktuelle Trend auf TikTok und Shorts.
  Typischer Einstieg: *"In this town, every night at midnight…"*. Kurze, spannende Geschichte mit einer absurden Regel.
  Es gibt gerade sehr viele Anleitungen dazu, wie man solche Videos mit Claude baut. Das Format steigt also gerade
  und wird bald voller. **Darum jetzt schnell starten.**
- **Erzählstimme**: Die meisten nutzen eine monotone, unheimliche Stimme (ElevenLabs). Wir heben uns ab mit einer
  **kindlichen, lustigen Stimme**: lustig und spannend zugleich.
- **"Choose your answer" und Kommentar-Abstimmung** gehören zu den Formaten mit den meisten Kommentaren.
  Kommentare treiben den Algorithmus an, und jede Folge erzeugt die nächste.

## 2. Geld verdienen: worauf es ankommt
- **YouTube-Partnerprogramm (YPP)**: 1.000 Abonnenten plus entweder 10 Mio. Shorts-Aufrufe in 90 Tagen
  oder 4.000 Stunden Wiedergabezeit bei langen Videos.
- **Shorts** bringen Reichweite und Abonnenten. Pro Aufruf zahlen sie wenig.
  **Lange Videos (8+ Minuten)** bringen deutlich mehr pro Aufruf (Mid-Roll-Werbung).
  → Plan: jede Folge als Short, und **alle 6 bis 8 Folgen ein Zusammenschnitt** als langes Video
  ("The 3AM Letters, ALL PARTS").
- **Wichtigstes Risiko: die YouTube-Regel gegen "inauthentische Inhalte"** (seit Juli 2025). Massenproduzierte
  Vorlagen-Videos werden für den ganzen Kanal demonetarisiert. Dagegen hilft:
  - eine **echte, fortlaufende Geschichte** mit festen, eigenen Figuren (haben wir: Serien-Bibel)
  - **jede Folge mit neuen Szenen und neuem Skript**, kein Kopieren und Austauschen von Textbausteinen
  - **keine fremden Marken oder Figuren** (kein "Roblox"-Logo oder -Name, eigener Stil)
  - nicht 10 Videos am Tag hochladen, sondern **1 bis 2 Folgen pro Tag** in gleichbleibender Qualität
- Zeichentrick und Cartoon gelten nicht als "realistisch" und brauchen daher keine KI-Kennzeichnung.

## 3. Veröffentlichungsplan (Vorschlag)
| Wann | Was |
|---|---|
| Täglich 1 Short | neue Folge (65 bis 90 s), Ende mit Abstimmung 1/2/3 |
| Kommentar anpinnen | "VOTE HERE 👇 1 = … / 2 = … / 3 = …" |
| Am nächsten Tag | Stimmen zählen → nächste Folge beginnt mit "You decided: …" |
| Alle 7 Folgen | langes Video (Zusammenschnitt plus neues Bonus-Ende), 8+ Minuten |
| Später | zweite Serie im selben Stil ("In my town, everyone is partying except me") |

Titelformel: **Neugier plus Zeit plus Teil-Nummer**, z. B. *"Every Night at 3AM a Letter Tells Me the Future… (Part 1)"*

## 4. Pipeline (läuft komplett in der Cloud, kostenlos)
1. `serie/bibel.md`: Welt-Regel, Figuren, Farben, Folgen und Abstimmungsergebnisse
2. `folgeNN/skript.md`: Skript (Englisch), Titel, Beschreibung, angepinnter Kommentar
3. `tools/voice_lines.py`: Kokoro-Sprachausgabe, kindliche Stimme (af_heart, +2 Halbtöne)
4. `folgeNN/shots.py` + `tools/world.py`: Blender-3D-Szenen (Klötzchen-Stil), Rendern mit EEVEE
5. `tools/compose.py`: 1080×1920, Untertitel Wort für Wort, Abstimmungseinblendung, Musik, MP4
6. Einplanen über Metricool (YouTube Shorts, TikTok, Instagram)

## Quellen
- [How to Make VIRAL Roblox "In This Town" Animations With Claude AI](https://www.youtube.com/watch?v=nb9acc6kWzo)
- [How to make "In this Town/World" Videos](https://www.youtube.com/watch?v=peXGJ0NeP7g)
- [TikTok: How to Make An In This Town Video](https://www.tiktok.com/discover/how-to-make-an-in-this-town-video)
- [TikTok: What voice is used to narrate In This Town stories](https://www.tiktok.com/discover/what-voice-is-used-to-narrate-the-roblox-in-this-town-stories)
- [YouTube AI Demonetization 2026: Real Rules vs Made-Up Ones](https://ytgrowth.io/blog/youtube-ai-policy)
- [Faceless YouTube Channels in 2026: what works / what gets demonetized](https://www.markstudios.com/blog/faceless-youtube-channels-2026-what-works-what-gets-demonetized)
- [YouTube Shorts Trends November 2026](https://www.anijam.ai/blog/youtube-shorts-trends/)
- [10 Most Commented YouTube Shorts](https://virlo.ai/blog/most-commented-youtube-short)
