# Homie Companion branch-ready checklist (like you're 5)

## What this zip gives you

This zip gives you a **new folder** called `homie_companion`.

That folder is Homie's new house.

It also gives you:
- shared event files
- simple docs
- easy Windows run buttons

## What you do

### 1) Drop the files in
Copy this zip on top of your OddEngine folder.

### 2) Open the new Homie folder
Go here:

`OddEngine/homie_companion`

### 3) Run the easy button
Double-click:

`RUN_HOMIE_COMPANION_DEV_WINDOWS.bat`

That script:
- installs packages if they are missing
- starts the Vite screen
- starts the Electron window

### 4) See Homie open
You should get:
- a separate Homie window
- a little status bar
- buttons to change states
- a debug event box
- a move-to-next-screen button

### 5) Press the test buttons
Try:
- Idle
- Listening
- Talking
- Alert
- Celebrate

### 6) Send a bridge event
Use the built-in test buttons or call:

- `GET http://127.0.0.1:45777/health`
- `POST http://127.0.0.1:45777/event`

## If something does not work

### If the window does not open
Close old Electron windows and try again.

### If packages are missing
Let the batch file finish `npm install`.

### If the bridge is not answering
Check that Homie Companion is open first. The bridge starts with the app in this MVP.

## What not to do yet

Do **not** jam this back into:
- Phoenix panel logic
- detach window patch logic
- BTC panel code

This pass is about keeping Homie in his own lane.
