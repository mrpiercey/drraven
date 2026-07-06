# Dr. Raven on RetroPie

## Which "system" — and why there's no `.nes`/`.zip`

Dr. Raven is an **HTML5 / JavaScript** game (`index.html` + `game.js` +
`books.js`). It cannot become a native console ROM (NES `.nes`, SNES `.sfc`,
Genesis `.md`, arcade/MAME `.zip`) without rewriting the whole game in that
console's machine code — and you asked me not to change the code. Any file
claiming to be a "ROM" of this would be fake.

The supported way to run a web game on a RetroPie arcade is the **Ports**
system (the same menu that runs Doom, Quake, and other non-cartridge games).
It launches the game through a script instead of an emulator.

- **EmulationStation system:** `Ports`
- **"Romset":** none — Ports run a launch script, not a ROM image
- **Runtime:** Chromium kiosk (full-screen) pointed at the local `index.html`

> **Arcade-only tweak:** `drraven/game.js` here is the web game plus one small
> addition for the cabinet — a **loading bar** that downloads each level's book
> covers up front (the Pi stuttered for ~10s when it fetched them mid-level).
> Gameplay is otherwise identical to the web version.

## Where to put it (over the network)

The RetroPie Samba share exposes the ROM folders. From Windows Explorer / Mac
Finder open:

```
\\RETROPIE\roms\ports\        (or \\<pi-ip-address>\roms\ports\ )
```

Copy these **four items** into that `ports` folder, side by side:

- the file `Dr Raven.sh`
- the file `kiosk.sh`
- the file `encoder-map.py`
- the folder `drraven/`

Result on disk:
```
~/RetroPie/roms/ports/Dr Raven.sh
~/RetroPie/roms/ports/kiosk.sh
~/RetroPie/roms/ports/encoder-map.py
~/RetroPie/roms/ports/drraven/index.html   (+ game.js, books.js)
```
Restart EmulationStation → it appears under **Ports → Dr Raven**.

Do **not** copy `install.sh` or `README.md` into `ports/` — `install.sh` would
show up as a second fake "game" in the menu.

Easier: copy this whole `rom/` folder to the Pi and run `bash install.sh` — it
copies the files AND installs everything below for you.

## Your arcade encoder (EG STARTS / Zero-Delay USB) — works out of the box

That board shows up to the Pi as a **USB joystick/gamepad**, not a keyboard, and
the game only listens to the keyboard. So the launcher runs a small built-in
bridge (`encoder-map.py`) that reads the encoder and types the right keys. It is
**preconfigured with sensible defaults — no setup, no mapping session.** Just
open the game and play.

### Default button layout

| Arcade control        | Does (game key) |
|-----------------------|-----------------|
| Joystick              | Move (arrow keys) |
| Button 1              | Jump (`Space`) |
| Button 2              | Throw books / open doors (`Enter`) |
| Button 3              | Inventory (`Tab`) |
| Button 4              | Mute (`M`) |
| Button 5              | Jump (spare) |
| Button 6              | Throw (spare) |
| Start button          | Confirm / advance intro (`Enter`) |
| **Start + Coin together** | **Quit back to the arcade menu** |

"Button 1…6" = the order the button headers sit on the encoder board. (Typing
`ramona` on any level = no heart loss for that level.)

### If a button feels wrong

Only if the physical buttons don't line up the way you like: open
`~/RetroPie/roms/ports/encoder-map.py` and change the `KEY_*` values in the
labelled `BUTTONS` block — each line says which button it is. Save, relaunch,
done. (Requires `python3-evdev`: `sudo apt install -y python3-evdev`.)

Prefer a point-and-click mapper instead? Install `antimicrox`, build a profile
in its GUI, and save it as `~/RetroPie/roms/ports/drraven/controls.amgp`. If
that file exists the launcher uses it instead of the built-in bridge.

## Exiting back to EmulationStation

Press **Start + Coin together** on the cabinet to quit — that drops you back to
the Ports menu. (With a keyboard attached, **Alt+F4** also works.)

## Notes

- **Offline is fine.** Real book covers load from the internet, but the game
  falls back to its own pixel-art covers with no network, so it's fully playable
  on an offline cabinet.
- Chromium runs under a throwaway profile (`~/.config/drraven-kiosk`), so it
  never touches other browser settings and won't nag about "restore pages"
  after a hard power-off.
- The encoder bridge needs `python3-evdev` and runs under `sudo` (it creates a
  virtual keyboard via `uinput`). `install.sh` sets this up; RetroPie's `pi`
  user already has passwordless sudo.
