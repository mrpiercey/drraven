# Dr. Raven on RetroPie

## Which "system" — and why there's no `.nes`/`.zip`

Dr. Raven is an **HTML5 / JavaScript** game (`index.html` + `game.js` +
`books.js`). It cannot become a native console ROM (NES `.nes`, SNES `.sfc`,
Genesis `.md`, arcade/MAME `.zip`) without rewriting the whole game in that
console's machine code — and you asked me not to change the code. Any file
claiming to be a "ROM" of this would be fake.

The supported way to run an unmodified web game on a RetroPie arcade is the
**Ports** system (the same menu that runs Doom, Quake, and other non-cartridge
games). It launches the game through a script instead of an emulator, with the
game code **completely untouched**.

- **EmulationStation system:** `Ports`
- **"Romset":** none — Ports run a launch script, not a ROM image
- **Runtime:** Chromium kiosk (full-screen) pointed at the local `index.html`

## Where to put it (over the network)

The RetroPie Samba share exposes the ROM folders. From Windows Explorer / Mac
Finder open:

```
\\RETROPIE\roms\ports\        (or \\<pi-ip-address>\roms\ports\ )
```

Copy **both** of these into that `ports` folder, side by side:

- the file `Dr Raven.sh`
- the folder `drraven/`   (and `kiosk.sh` too, if copying by hand)

Result on disk: `~/RetroPie/roms/ports/Dr Raven.sh`,
`~/RetroPie/roms/ports/kiosk.sh`, and `~/RetroPie/roms/ports/drraven/…`.
Restart EmulationStation → it appears under **Ports → Dr Raven**.

Easier: copy this whole `rom/` folder to the Pi and run `bash install.sh` — it
copies the files AND installs Chromium + AntiMicroX for you.

## Your arcade encoder (EG STARTS / Zero-Delay USB)

That board shows up to the Pi as a **USB joystick/gamepad**, not a keyboard. The
game only listens to the keyboard, so it needs a joystick→keyboard translator.
The launcher starts **AntiMicroX** automatically for exactly this. You do a
**one-time** mapping so AntiMicroX knows which physical button = which game key.

### Keys the game expects

| Game action        | Keyboard key to map to |
|--------------------|------------------------|
| Move               | Arrow Up/Down/Left/Right |
| Jump               | `Space`                |
| Throw books / doors| `Enter`                |
| Inventory          | `Tab`                  |
| Mute               | `M`                    |

(Typing `ramona` on any level = no heart loss for that level.)

### One-time mapping steps

1. Plug a keyboard+mouse into the cabinet (or SSH in with X forwarding). From
   the RetroPie menu open **RetroPie → Raspbian / desktop**, or from a terminal
   run `startx` then open a terminal.
2. Run `antimicrox`. It auto-detects the encoder (e.g. "DragonRise… USB
   Joystick"). If you have a 4-player kit, each player is a separate device tab.
3. For each control: click the on-screen slot, press the real arcade
   button/joystick direction, and assign it the matching key from the table
   above (joystick up = Arrow Up, your jump button = Space, etc.).
4. **Save the profile** to exactly this path:
   `~/RetroPie/roms/ports/drraven/controls.amgp`
5. Done. Next time you open **Ports → Dr Raven**, the launcher auto-loads that
   profile and your buttons drive the game. (No profile there yet? The game
   still boots; buttons just won't respond until you save one.)

## Exiting back to EmulationStation

Chromium kiosk quits with **Alt+F4**. On the cabinet, map a button combo to
`Alt+F4` in AntiMicroX (or add an `F4` key to a spare button) as a "quit"
control. When Chromium closes, X tears down and you drop back to the Ports menu.

## Notes

- **Offline is fine.** Real book covers load from the internet, but the game
  falls back to its own pixel-art covers with no network, so it's fully playable
  on an offline cabinet.
- Chromium runs under a throwaway profile (`~/.config/drraven-kiosk`), so it
  never touches other browser settings and won't nag about "restore pages"
  after a hard power-off.
- If `antimicrox` isn't found, install it with `sudo apt install -y antimicrox`
  (older images may only have `antimicro` — same idea, slightly different UI).
- Prefer a zero-GUI, preconfigured mapping instead of AntiMicroX? Ask me and I
  can add a small headless joystick→keyboard script with sensible defaults for
  this encoder.
