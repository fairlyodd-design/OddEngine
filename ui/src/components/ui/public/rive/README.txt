Drop your Rive file here:

  ui/public/rive/homie.riv

Then enable:
  Preferences → Homie → Game buddy (Rive) → On

Recommended inputs in your Rive State Machine (names are case-sensitive):
  - isTalking (boolean)
  - isListening (boolean)
  - mood (number) 0=idle, 1=good, 2=warn
  - lookX (number 0..100)
  - lookY (number 0..100)
Optional triggers:
  - wave (trigger)
  - wink (trigger)
  - celebrate (trigger)

Defaults (you can change these in Preferences):
  Artboard: Homie
  State machine: State Machine 1

Quick runtime test (from Rive docs):
  src: https://cdn.rive.app/animations/vehicles.riv
  state machine: bumpy
