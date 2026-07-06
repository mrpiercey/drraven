#!/usr/bin/env python3
"""
Dr. Raven — headless arcade-encoder -> keyboard bridge.

Your EG STARTS / Zero-Delay USB board shows up to the Pi as a *joystick*, but
the game only reads the *keyboard*. This reads the encoder and types the keys
the game wants, through a virtual keyboard (uinput). No X, no GUI, no setup:
the launcher starts it with the game and stops it when the game exits.

------------------------------------------------------------------------------
DEFAULT MAPPING  (change any line below if a physical button feels wrong)
------------------------------------------------------------------------------
  Joystick            -> Arrow keys           (move)
  Button 1            -> Space                (jump)
  Button 2            -> Enter                (throw books / open doors)
  Button 3            -> Tab                  (inventory)
  Button 4            -> M                    (mute)
  Button 5            -> Space                (spare jump)
  Button 6            -> Enter                (spare throw)
  Start button        -> Enter               (advance the intro / menus)
  Start + Coin held   -> quit to the arcade menu  (sends Alt+F4)

"Button 1..6/Start/Coin" = the order the button headers sit on the encoder
board. If yours are wired in a different order, just swap the KEY_* values in
the BUTTONS block below — each line is labelled.
"""
import sys
import select
import signal

try:
    from evdev import InputDevice, UInput, list_devices, ecodes as e
except ImportError:
    sys.stderr.write(
        "Dr. Raven: python3-evdev is not installed.\n"
        "Run:  sudo apt install -y python3-evdev\n")
    sys.exit(1)

# --- the mapping ----------------------------------------------------------
# evdev button code  ->  keyboard key(s) to press. On these boards button 1 is
# BTN_TRIGGER, button 2 is BTN_THUMB, and so on in order.
BUTTONS = {
    e.BTN_TRIGGER: [e.KEY_SPACE],   # button 1  -> jump
    e.BTN_THUMB:   [e.KEY_ENTER],   # button 2  -> throw books / doors
    e.BTN_THUMB2:  [e.KEY_TAB],     # button 3  -> inventory
    e.BTN_TOP:     [e.KEY_M],       # button 4  -> mute
    e.BTN_TOP2:    [e.KEY_SPACE],   # button 5  -> jump (spare)
    e.BTN_PINKIE:  [e.KEY_ENTER],   # button 6  -> throw (spare)
    e.BTN_BASE3:   [e.KEY_ENTER],   # Start     -> confirm / advance
}

# Hold these two buttons together to quit back to EmulationStation.
QUIT_COMBO = (e.BTN_BASE3, e.BTN_BASE4)     # Start + Coin
QUIT_KEYS = [e.KEY_LEFTALT, e.KEY_F4]

# Stick directions. HAT entries cover boards that report the stick as a d-pad.
AXIS_NEG = {e.ABS_X: e.KEY_LEFT, e.ABS_Y: e.KEY_UP,
            e.ABS_HAT0X: e.KEY_LEFT, e.ABS_HAT0Y: e.KEY_UP}
AXIS_POS = {e.ABS_X: e.KEY_RIGHT, e.ABS_Y: e.KEY_DOWN,
            e.ABS_HAT0X: e.KEY_RIGHT, e.ABS_HAT0Y: e.KEY_DOWN}
# -------------------------------------------------------------------------


def find_joysticks():
    devs = []
    for path in list_devices():
        try:
            d = InputDevice(path)
        except Exception:
            continue
        keys = d.capabilities().get(e.EV_KEY, [])
        # a joystick/gamepad reports button codes in the 0x120-0x151 range
        if any(0x120 <= k <= 0x151 for k in keys):
            devs.append(d)
    return devs


def main():
    devs = find_joysticks()
    if not devs:
        sys.stderr.write("Dr. Raven: no arcade encoder / joystick detected.\n")
        return

    # The virtual keyboard can only emit keys we declare up front.
    all_keys = set(QUIT_KEYS)
    for ks in BUTTONS.values():
        all_keys.update(ks)
    all_keys.update(AXIS_NEG.values())
    all_keys.update(AXIS_POS.values())
    ui = UInput({e.EV_KEY: sorted(all_keys)}, name="drraven-keys")

    # Work out where each analog axis counts as pushed, from its own range.
    thresh = {}
    for d in devs:
        for code, info in d.capabilities().get(e.EV_ABS, []):
            span = info.max - info.min
            thresh[(d.fd, code)] = (info.min + span * 0.30, info.max - span * 0.30)

    held = {}           # key -> how many sources hold it (so 2 sticks don't fight)
    axis_key = {}       # (fd, axis) -> key currently held for that axis
    quit_down = set()

    def raw(key, down):
        ui.write(e.EV_KEY, key, 1 if down else 0)
        ui.syn()

    def set_key(key, down):
        n = held.get(key, 0)
        if down:
            if n == 0:
                raw(key, True)
            held[key] = n + 1
        elif n > 0:
            if n == 1:
                raw(key, False)
            held[key] = n - 1

    fdmap = {d.fd: d for d in devs}
    for d in devs:
        try:
            d.grab()    # take the stick exclusively so it doesn't also move ES menus
        except Exception:
            pass

    signal.signal(signal.SIGTERM, lambda *a: sys.exit(0))

    try:
        while True:
            r, _, _ = select.select(fdmap, [], [])
            for fd in r:
                try:
                    events = list(fdmap[fd].read())
                except OSError:
                    return              # device unplugged
                for ev in events:
                    if ev.type == e.EV_KEY:
                        if ev.code in QUIT_COMBO:
                            if ev.value:
                                quit_down.add(ev.code)
                            else:
                                quit_down.discard(ev.code)
                            if set(QUIT_COMBO) <= quit_down:
                                for k in QUIT_KEYS:
                                    raw(k, True)
                                for k in reversed(QUIT_KEYS):
                                    raw(k, False)
                                return
                        keys = BUTTONS.get(ev.code)
                        if keys and ev.value in (0, 1):
                            for k in keys:
                                set_key(k, ev.value == 1)
                    elif ev.type == e.EV_ABS:
                        lo, hi = thresh.get((fd, ev.code), (None, None))
                        if lo is None:
                            continue
                        neg = AXIS_NEG.get(ev.code)
                        pos = AXIS_POS.get(ev.code)
                        if neg is None and pos is None:
                            continue
                        want = None
                        if ev.value <= lo:
                            want = neg
                        elif ev.value >= hi:
                            want = pos
                        cur = axis_key.get((fd, ev.code))
                        if cur != want:
                            if cur is not None:
                                set_key(cur, False)
                            if want is not None:
                                set_key(want, True)
                            axis_key[(fd, ev.code)] = want
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        for k, n in list(held.items()):
            if n > 0:
                raw(k, False)
        ui.close()


if __name__ == "__main__":
    main()
