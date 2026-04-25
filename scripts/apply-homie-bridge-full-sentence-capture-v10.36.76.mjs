
import fs from "node:fs";
import path from "node:path";

const VERSION = "v10.36.76";
const root = process.cwd();
const buddyPath = path.join(root, "ui", "src", "components", "HomieBuddy.tsx");

function fail(message) {
  console.error("[" + VERSION + "] " + message);
  process.exit(1);
}

function backup(filePath) {
  const dst = filePath + ".bak_" + VERSION;
  if (!fs.existsSync(dst)) fs.copyFileSync(filePath, dst);
}

function replaceRegex(text, regex, replacement, label) {
  if (!regex.test(text)) fail("Could not find anchor: " + label);
  regex.lastIndex = 0;
  return text.replace(regex, replacement);
}

if (!fs.existsSync(buddyPath)) fail("Missing ui/src/components/HomieBuddy.tsx. Run from C:\\OddEngine.");
backup(buddyPath);

let tsx = fs.readFileSync(buddyPath, "utf8");
if (!tsx.includes("export default function HomieBuddy")) fail("HomieBuddy.tsx shape not recognized.");
if (!tsx.includes("startExternalVoice") || !tsx.includes("transcribeExternalBlob")) fail("Homie external voice functions not found.");

// 1) Increase recording capture windows. Short clips are the main reason Whisper returns one word.
tsx = tsx.replace(/const HOMIE_VOICE_MIN_EXTERNAL_RECORDING_MS = \d+;/, "const HOMIE_VOICE_MIN_EXTERNAL_RECORDING_MS = 3600;");
tsx = tsx.replace(/const HOMIE_VOICE_MAX_EXTERNAL_RECORDING_MS = \d+;/, "const HOMIE_VOICE_MAX_EXTERNAL_RECORDING_MS = 45000;");
tsx = tsx.replace(/const HOMIE_VOICE_MIN_AUDIO_BLOB_BYTES = \d+;/, "const HOMIE_VOICE_MIN_AUDIO_BLOB_BYTES = 6000;");

if (!tsx.includes("HOMIE_VOICE_EXTERNAL_POSTROLL_MS")) {
  tsx = replaceRegex(
    tsx,
    /const HOMIE_VOICE_MIN_AUDIO_BLOB_BYTES = \d+;\s*/,
    "const HOMIE_VOICE_MIN_AUDIO_BLOB_BYTES = 6000;\nconst HOMIE_VOICE_EXTERNAL_POSTROLL_MS = 850;\n",
    "voice constants postroll insertion"
  );
}

// 2) Make visible copy honest: local bridge needs a full sentence and a pause.
tsx = tsx.replaceAll(
  'setStatus(pushToTalk ? "Hold to talk is live." : "I’m listening.");',
  'setStatus(pushToTalk ? "Hold to talk is recording — speak one full sentence." : "Bridge is recording — say one full sentence, pause, then click Stop listening.");'
);
tsx = tsx.replaceAll(
  'emitVoiceStatus({ source, status: "started", message: pushToTalk ? "Hold to talk is recording." : "Recording for the local bridge.", mode: "external" });',
  'emitVoiceStatus({ source, status: "started", message: pushToTalk ? "Hold to talk is recording — speak one full sentence." : "Recording for the local bridge — say one full sentence, pause, then stop.", mode: "external" });'
);
tsx = tsx.replaceAll(
  'setStatus("Got it. Working on that.");',
  'setStatus("Got it. Finishing the full clip before transcription.");'
);
tsx = tsx.replaceAll(
  'setStatus("Got it. Finishing the clip.");',
  'setStatus("Hold still one beat — finishing the full voice clip.");'
);
tsx = tsx.replaceAll(
  'externalBridgeMessage: "Finishing a short voice clip before transcription."',
  'externalBridgeMessage: "Finishing a full voice clip before transcription."'
);

// 3) Use one full MediaRecorder blob on stop instead of frequent 250ms chunks.
// This avoids some browsers producing tiny/fragmented Opus chunks that Whisper guesses from.
tsx = tsx.replaceAll("recorder.start(250);", "recorder.start();");

// 4) Add a post-roll before recorder.stop() so the last words are not clipped when Stop is clicked.
if (!tsx.includes("v10.36.76 postroll before bridge recorder stop")) {
  const oldFinish = `    const finish = () => {
      clearExternalStopTimer();
      try {
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        } else {
          cleanupExternalVoiceStream();
          setIsListening(false);
          setIsHoldingToTalk(false);
        }
      } catch (error: any) {`;

  const newFinish = `    const finish = () => {
      clearExternalStopTimer();
      // v10.36.76 postroll before bridge recorder stop: capture trailing syllables after user clicks Stop.
      const stopRecorder = () => {
        try {
          if (recorder && recorder.state !== "inactive") {
            recorder.stop();
          } else {
            cleanupExternalVoiceStream();
            setIsListening(false);
            setIsHoldingToTalk(false);
          }
        } catch (error: any) {
          cleanupExternalVoiceStream();
          setIsListening(false);
          setIsHoldingToTalk(false);
          const message = String(error?.message || "Could not stop local bridge recording cleanly.");
          setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "external-stop-failed", lastErrorMessage: message, activeRecognitionMode: "idle" }));
          if (!silent) announce(message, "warn", true, "Recording stop issue.");
        }
      };
      setStatus("Finishing the last words before transcription…");
      setDiagnostics((prev) => ({ ...prev, externalBridgeState: "recording", externalBridgeMessage: "Post-roll capture: finishing the last words before transcription." }));
      window.setTimeout(stopRecorder, HOMIE_VOICE_EXTERNAL_POSTROLL_MS);
      return;
    };

    const finishLegacyCatchAnchor = () => {
      try {
        // unused compatibility anchor
      } catch (error: any) {`;

  if (tsx.includes(oldFinish)) {
    tsx = tsx.replace(oldFinish, newFinish);
    // Remove the now-stranded catch block tail created by replacing the start of finish. This pass handles old exact shape.
    const stranded = `
        cleanupExternalVoiceStream();
        setIsListening(false);
        setIsHoldingToTalk(false);
        const message = String(error?.message || "Could not stop local bridge recording cleanly.");
        setDiagnostics((prev) => ({ ...prev, externalBridgeState: "degraded", externalBridgeMessage: message, lastErrorCode: "external-stop-failed", lastErrorMessage: message, activeRecognitionMode: "idle" }));
        if (!silent) announce(message, "warn", true, "Recording stop issue.");
      }
    };`;
    if (tsx.includes(stranded)) tsx = tsx.replace(stranded, "");
  } else {
    // Safer fallback: if exact full block was already changed, only delay the recorder.stop call.
    tsx = tsx.replace(
      'if (recorder && recorder.state !== "inactive") {\n          recorder.stop();\n        }',
      'if (recorder && recorder.state !== "inactive") {\n          setStatus("Finishing the last words before transcription…");\n          window.setTimeout(() => recorder.stop(), HOMIE_VOICE_EXTERNAL_POSTROLL_MS);\n        }'
    );
    if (!tsx.includes("HOMIE_VOICE_EXTERNAL_POSTROLL_MS")) fail("Postroll fallback failed.");
  }
}

// 5) Guard against one-word transcripts from long clips so Homie does not act like it understood.
if (!tsx.includes("v10.36.76 partial bridge transcript guard")) {
  const anchor = `      if (!transcript) {
        announce("The bridge heard audio but returned an empty transcript.", "warn", true, "No transcript returned.");
        return;
      }

      emitVoiceStatus({ source, status: "transcript", message: \`Heard: ${transcript}\`, transcript, mode: "external" });`;
  const insert = `      if (!transcript) {
        announce("The bridge heard audio but returned an empty transcript.", "warn", true, "No transcript returned.");
        return;
      }

      // v10.36.76 partial bridge transcript guard: if a full clip becomes one word, do not pretend it was understood.
      const bridgeWords = transcript.split(/\\s+/).map((word) => word.trim()).filter(Boolean);
      const likelyPartialBridgeTranscript = bridgeWords.length <= 1 && blob.size >= HOMIE_VOICE_MIN_AUDIO_BLOB_BYTES * 2;
      if (likelyPartialBridgeTranscript) {
        const message = "Bridge only caught one word: “" + transcript + "”. That usually means the clip was clipped, too quiet, or started before your sentence. Try Bridge say test again: pause half a second, say one clear full sentence, pause, then click Stop listening.";
        setDiagnostics((prev) => ({ ...prev, externalBridgeState: "ready", externalBridgeMessage: message, lastTranscript: transcript || prev.lastTranscript, lastErrorCode: "external-partial-transcript", lastErrorMessage: message, activeRecognitionMode: "idle" }));
        announce(message, "warn", true, "I only caught one word. Try one clear full sentence with a pause before and after.");
        return;
      }

      emitVoiceStatus({ source, status: "transcript", message: \`Heard: ${transcript}\`, transcript, mode: "external" });`;
  if (tsx.includes(anchor)) {
    tsx = tsx.replace(anchor, insert);
  } else if (!tsx.includes("likelyPartialBridgeTranscript")) {
    fail("Could not find transcript guard insertion anchor.");
  }
}

// 6) Add marker.
if (!tsx.includes("v10.36.76 checker-safe marker")) {
  tsx = tsx.replace(
    "export default function HomieBuddy",
    "// v10.36.76 checker-safe marker: full sentence bridge capture and partial transcript guard installed\nexport default function HomieBuddy"
  );
}

fs.writeFileSync(buddyPath, tsx, "utf8");
console.log("[" + VERSION + "] Applied full-sentence bridge capture + partial transcript guard.");
console.log("Touched: ui/src/components/HomieBuddy.tsx");
