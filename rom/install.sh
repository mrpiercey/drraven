#!/bin/bash
###############################################################################
# Dr. Raven — one-shot installer for RetroPie.
# Run this ON the Raspberry Pi (SSH or a terminal), from inside this folder:
#     bash install.sh
# It copies the game into the EmulationStation "Ports" system and installs the
# bits needed to run it (Chromium + AntiMicroX for the arcade encoder).
###############################################################################
set -e

SRC="$(cd "$(dirname "$0")" && pwd)"
PORTS="$HOME/RetroPie/roms/ports"

if [ ! -d "$HOME/RetroPie/roms" ]; then
  echo "This doesn't look like a RetroPie system ($HOME/RetroPie/roms missing)."
  echo "Run install.sh on the Pi itself, not on your dev machine."
  exit 1
fi

mkdir -p "$PORTS"
echo "Installing Dr. Raven into $PORTS ..."
cp -r "$SRC/drraven" "$PORTS/"
cp "$SRC/Dr Raven.sh" "$PORTS/"
cp "$SRC/kiosk.sh"    "$PORTS/"
chmod +x "$PORTS/Dr Raven.sh" "$PORTS/kiosk.sh"

echo "Installing Chromium + AntiMicroX (encoder -> keyboard) ... needs sudo."
sudo apt update
sudo apt install -y chromium-browser antimicrox x11-xserver-utils xinit || \
  sudo apt install -y chromium antimicrox x11-xserver-utils xinit || \
  echo "Some packages failed to install — see README for manual steps."

echo
echo "Installed. Next:"
echo "  1. Restart EmulationStation (or reboot)."
echo "  2. Open Ports -> Dr Raven once. The joystick won't be mapped yet."
echo "  3. Do the ONE-TIME encoder mapping in AntiMicroX (see README.md),"
echo "     saving the profile to:  $PORTS/drraven/controls.amgp"
echo "  4. Launch again — buttons now drive the game."
