#!/bin/bash
###############################################################################
# Dr. Raven — runs INSIDE the X session started by "Dr Raven.sh".
# 1. stops the screen from blanking
# 2. starts AntiMicroX to translate the arcade encoder (a USB joystick) into
#    the keyboard keys the game listens for
# 3. launches Chromium in kiosk mode on the local game
###############################################################################

GAMEDIR="$GAMEROOT/drraven"
PROFILE="$GAMEDIR/controls.amgp"   # created once via the AntiMicroX GUI (see README)

# Stop whichever encoder->keyboard mapper we started. The headless bridge runs
# under sudo, so its Python child needs sudo to kill.
stop_mapper() {
  [ -n "$MAP_PID" ] && kill "$MAP_PID" 2>/dev/null
  sudo pkill -f encoder-map.py 2>/dev/null
}

# Don't let the arcade go to sleep mid-game.
xset -dpms
xset s off
xset s noblank

# --- arcade encoder -> keyboard -------------------------------------------
# The EG STARTS / Zero-Delay board shows up as a USB joystick. The game only
# reads the keyboard, so we translate joystick -> keys. Two ways, in order:
#   1. If you saved an AntiMicroX profile (controls.amgp), use that (GUI setup).
#   2. Otherwise use the built-in headless bridge with sensible defaults — this
#      is the zero-setup path: it just works, no mapping session required.
MAP_PID=""
if command -v antimicrox >/dev/null 2>&1 && [ -f "$PROFILE" ]; then
  antimicrox --hidden --profile "$PROFILE" &
  MAP_PID=$!
  sleep 1
elif command -v python3 >/dev/null 2>&1 && [ -f "$GAMEROOT/encoder-map.py" ]; then
  # needs root for the virtual keyboard (uinput); RetroPie's pi user has sudo
  sudo python3 "$GAMEROOT/encoder-map.py" &
  MAP_PID=$!
  sleep 1
fi

# --- the game -------------------------------------------------------------
CHROMIUM="$(command -v chromium-browser || command -v chromium)"
if [ -z "$CHROMIUM" ]; then
  xmessage -center "Chromium is not installed. Run: sudo apt install -y chromium-browser" 2>/dev/null
  sleep 6
  stop_mapper
  exit 1
fi

"$CHROMIUM" \
  --kiosk "file://$GAMEDIR/index.html" \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  --user-data-dir="$HOME/.config/drraven-kiosk" \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-session-crashed-bubble \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --no-first-run

# Chromium closed (Alt+F4 / mapped quit button) -> clean up and return to ES.
stop_mapper
