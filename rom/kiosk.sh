#!/bin/bash
###############################################################################
# Dr. Raven — runs INSIDE the X session started by "Dr Raven.sh".
# 1. stops the screen from blanking
# 2. starts the arcade-encoder -> keyboard mapping
# 3. launches Chromium in kiosk mode on the local game
# All output is appended to roms/ports/drraven-launch.log for troubleshooting.
###############################################################################

LOG="${DRRAVEN_LOG:-$GAMEROOT/drraven-launch.log}"
log() { echo "[kiosk] $*" >> "$LOG" 2>&1; }

GAMEDIR="$GAMEROOT/drraven"
PROFILE="$GAMEDIR/controls.amgp"   # optional AntiMicroX profile (see README)

log "kiosk.sh start; DISPLAY=$DISPLAY"

# Stop whichever encoder->keyboard mapper we started. The headless bridge runs
# under sudo, so its Python child needs sudo to kill.
stop_mapper() {
  [ -n "$MAP_PID" ] && kill "$MAP_PID" 2>/dev/null
  sudo pkill -f encoder-map.py 2>/dev/null
}

# Don't let the arcade go to sleep mid-game.
xset -dpms 2>>"$LOG"
xset s off 2>>"$LOG"
xset s noblank 2>>"$LOG"

# --- arcade encoder -> keyboard -------------------------------------------
# The EG STARTS / Zero-Delay board shows up as a USB joystick. The game only
# reads the keyboard, so we translate joystick -> keys. Two ways, in order:
#   1. If you saved an AntiMicroX profile (controls.amgp), use that (GUI setup).
#   2. Otherwise use the built-in headless bridge with sensible defaults.
MAP_PID=""
if command -v antimicrox >/dev/null 2>&1 && [ -f "$PROFILE" ]; then
  log "using AntiMicroX profile $PROFILE"
  antimicrox --hidden --profile "$PROFILE" >>"$LOG" 2>&1 &
  MAP_PID=$!
  sleep 1
elif command -v python3 >/dev/null 2>&1 && [ -f "$GAMEROOT/encoder-map.py" ]; then
  log "using built-in encoder bridge (sudo python3 encoder-map.py)"
  sudo python3 "$GAMEROOT/encoder-map.py" >>"$LOG" 2>&1 &
  MAP_PID=$!
  sleep 1
else
  log "no encoder mapper available (buttons may not work; keyboard still does)"
fi

# --- the game -------------------------------------------------------------
CHROMIUM="$(command -v chromium-browser || command -v chromium)"
log "launching Chromium: $CHROMIUM"

"$CHROMIUM" \
  --kiosk "file://$GAMEDIR/index.html" \
  --start-fullscreen \
  --autoplay-policy=no-user-gesture-required \
  --user-data-dir="$HOME/.config/drraven-kiosk" \
  --no-sandbox \
  --noerrdialogs \
  --disable-infobars \
  --disable-translate \
  --disable-features=TranslateUI \
  --disable-session-crashed-bubble \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --check-for-update-interval=31536000 \
  --no-first-run >>"$LOG" 2>&1

log "Chromium exited with code $?"

# Chromium closed (Start+Coin / Alt+F4) -> clean up and return to ES.
stop_mapper
