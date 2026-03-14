# \# OddEngine v10.24.98 — Real Life Homie Core Recovery Base

# 

# OddEngine is the FairlyOdd OS shell for family everyday life.

# 

# This repo currently uses the recovery branch as the active forward line for safer, cleaner drop-in integration work.

# 

# \## Current product direction

# 

# \- Preferences is the central setup and connections hub

# \- Studio is the all-in-one idea → product area inside the broader OS

# \- Grocery Meals and FamilyBudget are moving toward a cleaner shared integration

# \- Homie is evolving into a real-life interactive AI companion:

# &#x20; - avatar / body

# &#x20; - voice bridge foundation

# &#x20; - vision foundation

# &#x20; - presence / actions

# &#x20; - desktop controls

# &#x20; - memory / context

# &#x20; - mission control

# &#x20; - wake word / conversation mode

# &#x20; - warm retro-futurist weird science aesthetic direction

# 

# \## Branch roles

# 

# \- `main` = older public/default line

# \- `checkpoint/recovery-ui-stable` = rollback / safety line

# \- `recovery/render-worker-bridge-pass` = active working base for current forward passes

# 

# \## Working style

# 

# \- prefer complete drop-in packs over brittle patch chains

# \- prefer safer integration over fragile hacks

# \- keep Homie warm, positive, helpful, truthful, and family-safe

# \- keep Studio as one major area inside the larger family-life OS

# \- keep Preferences as the main setup / connections hub

# 

# \## Local workflow

# 

# Typical local flow:

# 

# 1\. pull `recovery/render-worker-bridge-pass`

# 2\. copy in the new drop-in pack

# 3\. build locally

# 4\. verify key panels

# 5\. update version truth files

# 6\. commit

# 7\. push recovery branch

# 8\. promote to checkpoint only after the pass is confirmed good

# 

# \## Build

# 

# ```powershell

# cd C:\\OddEngine

# npm --prefix .\\ui install

# npm --prefix .\\ui run build

