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
cp "$SRC/Dr Raven.sh"   "$PORTS/"
cp "$SRC/kiosk.sh"      "$PORTS/"
cp "$SRC/encoder-map.py" "$PORTS/"
chmod +x "$PORTS/Dr Raven.sh" "$PORTS/kiosk.sh" "$PORTS/encoder-map.py"

echo "Installing Chromium + the encoder->keyboard bridge ... needs sudo."
sudo apt update
# python3-evdev drives the zero-setup joystick bridge; antimicrox is the
# optional GUI alternative; xinit/x11-xserver-utils start the kiosk display.
sudo apt install -y chromium-browser python3-evdev antimicrox x11-xserver-utils xinit || \
  sudo apt install -y chromium python3-evdev antimicrox x11-xserver-utils xinit || \
  echo "Some packages failed to install — see README for manual steps."

echo
echo "Installed. Next:"
echo "  1. Restart EmulationStation (or reboot)."
echo "  2. Open Ports -> Dr Raven. The arcade buttons work right away using the"
echo "     built-in default mapping (joystick=move, btn1=jump, btn2=throw,"
echo "     btn3=inventory, btn4=mute, Start=confirm, Start+Coin=quit)."
echo "  3. Only if a button feels wrong: edit $PORTS/encoder-map.py (labelled),"
echo "     or make an AntiMicroX profile — see README.md."
