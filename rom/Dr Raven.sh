#!/bin/bash
###############################################################################
# The Adventures of Dr. Raven — RetroPie "Ports" launcher (entry point)
#
# This is NOT a console ROM (see README.md). It boots the HTML5 game full-screen
# in Chromium. No game code is modified.
#
# RetroPie runs on the bare console with no X server, and Chromium needs X, so
# this starts a minimal X session and hands off to kiosk.sh.
#
# Everything it does is written to  roms/ports/drraven-launch.log  which you can
# open over the network share if something goes wrong.
###############################################################################

export GAMEROOT="$(dirname "$(readlink -f "$0")")"
export DRRAVEN_LOG="$GAMEROOT/drraven-launch.log"

{
  echo "===================================================================="
  echo "Dr. Raven launch: $(date)"
  echo "GAMEROOT = $GAMEROOT"
  echo "user     = $(whoami)   tty = $(tty 2>/dev/null)"
} > "$DRRAVEN_LOG" 2>&1

fail() {
  echo "" | tee -a "$DRRAVEN_LOG"
  echo "*** PROBLEM: $* ***" | tee -a "$DRRAVEN_LOG"
  echo "See $DRRAVEN_LOG (open it over the network share)." | tee -a "$DRRAVEN_LOG"
  sleep 10   # keep the message on screen before EmulationStation returns
  exit 1
}

# --- checks that explain themselves instead of just flashing black ----------
[ -f "$GAMEROOT/drraven/index.html" ] || \
  fail "game files missing at $GAMEROOT/drraven (copy the 'drraven' folder here)"

command -v xinit >/dev/null 2>&1 || \
  fail "xinit is not installed. Run: sudo apt install -y xinit x11-xserver-utils"

if ! command -v chromium-browser >/dev/null 2>&1 && ! command -v chromium >/dev/null 2>&1; then
  fail "Chromium is not installed. Run: sudo apt install -y chromium-browser"
fi

echo "Dependencies OK. Starting X + kiosk..." >> "$DRRAVEN_LOG"

# Start X just for this game; -nocursor hides the mouse pointer. kiosk.sh (the X
# client) starts the encoder mapping + Chromium, and when it exits X tears down
# and EmulationStation returns.
xinit "$GAMEROOT/kiosk.sh" -- -nocursor >> "$DRRAVEN_LOG" 2>&1
echo "xinit exited with code $? at $(date)" >> "$DRRAVEN_LOG"
