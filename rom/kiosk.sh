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

# Don't let the arcade go to sleep mid-game.
xset -dpms
xset s off
xset s noblank

# --- arcade encoder -> keyboard -------------------------------------------
# The EG STARTS / Zero-Delay board shows up as a USB joystick. The game only
# reads the keyboard, so AntiMicroX maps joystick -> keys. It loads a saved
# profile if one exists; otherwise it starts unmapped so you can build one.
AM_PID=""
if command -v antimicrox >/dev/null 2>&1; then
  if [ -f "$PROFILE" ]; then
    antimicrox --hidden --profile "$PROFILE" &
  else
    antimicrox --hidden &
  fi
  AM_PID=$!
  sleep 1   # give it a moment to grab the joystick before the game starts
fi

# --- the game -------------------------------------------------------------
CHROMIUM="$(command -v chromium-browser || command -v chromium)"
if [ -z "$CHROMIUM" ]; then
  xmessage -center "Chromium is not installed. Run: sudo apt install -y chromium-browser" 2>/dev/null
  sleep 6
  [ -n "$AM_PID" ] && kill "$AM_PID" 2>/dev/null
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
[ -n "$AM_PID" ] && kill "$AM_PID" 2>/dev/null
