#!/bin/bash
###############################################################################
# The Adventures of Dr. Raven — RetroPie "Ports" launcher (entry point)
#
# This is NOT a console ROM (see README.md). It boots the HTML5 game full-screen
# in Chromium. No game code is modified — index.html/game.js/books.js load
# verbatim from the sibling "drraven/" folder.
#
# RetroPie runs on the bare console with no X server, and Chromium needs X, so
# this entry point starts a minimal X session and hands off to kiosk.sh, which
# also starts the arcade-encoder -> keyboard mapping.
###############################################################################

export GAMEROOT="$(dirname "$(readlink -f "$0")")"

if [ ! -f "$GAMEROOT/drraven/index.html" ]; then
  echo "Dr. Raven: game files not found at $GAMEROOT/drraven" >&2
  echo "Copy the 'drraven/' folder next to this script in roms/ports/." >&2
  sleep 6
  exit 1
fi

# Start X just for this game; -nocursor hides the mouse pointer on the cabinet.
# kiosk.sh (the X client) launches the encoder mapping + Chromium, and when it
# exits X tears down and EmulationStation comes back.
xinit "$GAMEROOT/kiosk.sh" -- -nocursor
