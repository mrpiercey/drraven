# DR. RAVEN — The Time-Traveling Bookworm

A 16-bit-style side-scrolling platformer. Dr. Raven, psychologist and book
collector, is blasted 44 years into the past by Jack the Dog's time machine. She races
through 8 chapters of her life to recover every book
she has ever read — all 1,026 of them, straight from
`ravenread.csv`:

1. **Loxley, Alabama** — a Gulf Coast beach: sun, surf, palms, sandcastles
2. **Wilmore, Kentucky** — countryside: rolling hills, a red barn, hay bales
3. **Auburn, Alabama** — a night football game: stadium, goal posts, turf yard lines
4. **Point Clear, Alabama** — the wedding: bayside sunset, string lights, arches
5. **Lexington, Kentucky** — horse country: white plank fences and grazing horses
6. **UK Medical School** — hospital halls: red crosses, EKG lines, IV stands
7. **Scarlett, Hank & Ramona** — a stormy Ohio wasteland just outside Jack's Lair; free the kids from his cage
8. **The Last Books** — inside Jack's kennel: chain-link, dog houses, "JACK" bowls, and the giant final boss

Between levels, an 8-bit overworld map (think NES Google Maps) shows
Dr. Raven walking the dotted route from stop to stop — Gulf Coast up to
Kentucky, with a heart pin for the wedding and a red-eyed dark mountain
for Jack's Lair.

It ends with an overhead, Final Fantasy-style cutscene. It was all a
dream... but don't miss who's sitting at the end of the bed.

## Play

Play online at **https://mrpiercey.github.io/drraven/**.

Or open `index.html` in any browser. No build, no server needed.

## Controls

| Key | Action |
| --- | --- |
| ← → | Move |
| SPACE (or ↑) | Jump |
| ENTER | Throw a collected book — or open the door when standing at it / confirm |
| TAB | Inventory (every book collected) |
| M | Mute music |

## Story

The evil scientist **Jack the Dog** — sheepadoodle, very bad dog — fired up
his time machine and blasted Dr. Raven 44 years into the past. Her 1,026
beloved books are scattered across the most important places of her life,
and she must collect every one of them or she'll never have them again.
The story plays in pages — ENTER turns to the next part.

## Rules

- **120 seconds per level.** Reach the exit door and press ENTER.
- Books are **real pixelated covers** (from the CSV's image URLs) floating
  through each level — touch them to collect. Offline they fall back to
  pixel-art book sprites.
- The 16 **Madeleine L'Engle** books glow in gold frames. Grabbing one
  triggers **SUPER READER** mode: faster, invincible, double jump, and
  enemies go POOF on contact.
- Enemies: **Ink Blots** (Rorschach tests with a grudge), **Overdue
  Notices** (they swoop), and **Doomscrollers** (hypnotic phones).
- **Jack the Dog guards every exit door.** Stomp his head or throw collected
  books (ENTER) to defeat him — he gets faster every level, and tougher
  from level 5 on. The door stays locked until he flees.
- **Level 7**: Jack has Scarlett, Hank, and Ramona locked in a cage by the
  door. Defeat him to set them free.
- **Level 8**: giant Jack is twice as tall, has 8 hearts, and vacuums up
  floating books — every hit you land knocks them back out of his belly.
- 3 hearts. Pits, enemies, and Jack the Dog cost one heart and make up to
  three collected books tumble away for that attempt. Progress saves after
  each level — the title screen offers CONTINUE.

## Files

- `index.html` — page shell
- `game.js` — the whole game (engine, pixel art, chiptune audio)
- `books.js` — generated from `ravenread.csv` (title, author, year, L'Engle flag)
- `ravenread.csv` — Dr. Raven's Goodreads export, the source of truth

## Cheat

On any screen, enter the classic code — ↑ ↑ ↓ ↓ ← → ← → B A ENTER — to open
the level select, including a shortcut straight to the ending.
