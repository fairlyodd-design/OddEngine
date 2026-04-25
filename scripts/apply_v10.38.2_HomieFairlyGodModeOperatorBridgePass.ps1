$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$component = Join-Path $root "ui\src\components\FairlyGodModeHUD.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $component)) { throw "Missing ui\src\components\FairlyGodModeHUD.tsx. Apply previous FairlyGodMode passes first." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }

Write-Host "[v10.38.2] Applying Homie FairlyGodMode Operator Bridge..." -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($component, [System.Text.Encoding]::UTF8)

if ($tsx -notmatch 'HOMIE_COMMAND_LOG_KEY') {
  $tsx = $tsx.Replace(
    'const HOMIE_COMMAND_KEY = "oddengine:fairlygodmode:homieCommand:v1";',
    'const HOMIE_COMMAND_KEY = "oddengine:fairlygodmode:homieCommand:v1";' + "`r`n" +
    'const HOMIE_COMMAND_LOG_KEY = "oddengine:fairlygodmode:homieCommandLog:v1";' + "`r`n" +
    'const HOMIE_PENDING_CONFIRM_KEY = "oddengine:fairlygodmode:homiePendingConfirm:v1";'
  )
}

if ($tsx -notmatch 'function rememberHomieCommand') {
  $anchor = 'function parseHomieCommand(input: string) {'
  $insert = @'
function rememberHomieCommand(entry: any) {
  const log = readJSON<any[]>(HOMIE_COMMAND_LOG_KEY, []);
  writeJSON(HOMIE_COMMAND_LOG_KEY, [{ id: `hcmd_${Date.now()}`, ts: Date.now(), ...entry }, ...log].slice(0, 40));
}

function homieCommandExamples() {
  return [
    "why is Security bad",
    "open Trading",
    "focus Family Budget",
    "apply Family Legacy Mode",
    "apply Trading War Room",
    "show legacy open first",
    "reset Builder layout",
  ];
}

function findModeFromCommand(text: string) {
  const q = text.toLowerCase();
  return WORKSPACE_MODES.find((mode) => {
    return q.includes(mode.id) || q.includes(mode.name.toLowerCase()) || q.includes(mode.name.toLowerCase().replace(" mode", ""));
  });
}

function findPanelFromCommand(text: string) {
  const q = text.toLowerCase();
  return PANEL_META.find((p) => {
    const title = p.title.toLowerCase();
    const id = p.id.toLowerCase();
    return q.includes(title) || q.includes(id) || q.includes(title.replace(/\s+/g, ""));
  });
}

'@ + $anchor
  $tsx = $tsx.Replace($anchor, $insert)
}

# Replace parseHomieCommand with deeper parser.
$patternParse = '(?s)function parseHomieCommand\(input: string\) \{.*?\n\}'
$newParse = @'
function parseHomieCommand(input: string) {
  const raw = input.trim();
  const text = raw.toLowerCase();
  if (!text) return { kind: "empty", target: "", label: "Empty command" };

  const mode = findModeFromCommand(text);
  const panel = findPanelFromCommand(text);

  if (text.includes("legacy") && (text.includes("open first") || text.includes("show") || text.includes("family"))) {
    return { kind: "legacy", target: "legacy", label: "Show Legacy Open First" };
  }

  if ((text.includes("apply") || text.includes("mode") || text.includes("war room") || text.includes("calm")) && mode) {
    return { kind: "mode", target: mode.id, label: `Apply ${mode.name}` };
  }

  if ((text.includes("why") || text.includes("explain") || text.includes("bad") || text.includes("warn")) && panel) {
    return { kind: "why", target: panel.id, label: `Explain ${panel.title}` };
  }

  if ((text.includes("open") || text.includes("go to") || text.includes("launch")) && panel) {
    return { kind: "open", target: panel.id, label: `Open ${panel.title}` };
  }

  if ((text.includes("focus") || text.includes("bring up")) && panel) {
    return { kind: "focus", target: panel.id, label: `Focus ${panel.title}` };
  }

  if ((text.includes("reset") || text.includes("fix layout") || text.includes("clean layout")) && panel) {
    return { kind: "reset-request", target: panel.id, label: `Request reset for ${panel.title}` };
  }

  if (text.includes("doctor") || text.includes("scan")) {
    return { kind: "scan", target: "doctor", label: "Run OS Doctor scan" };
  }

  if (text.includes("receipts") || text.includes("ledger")) {
    return { kind: "receipts", target: "receipts", label: "Open receipts ledger" };
  }

  return { kind: "note", target: raw, label: "Saved operator note" };
}
'@
$tsx = [regex]::Replace($tsx, $patternParse, $newParse)

# Replace executeHomieCommand with safer action planner.
$patternExec = '(?s)  function executeHomieCommand\(\) \{.*?\n  \}\n\n  const panelGroups'
$newExec = @'
  function executeHomieCommand() {
    const parsed = parseHomieCommand(homieCommand);
    writeJSON(HOMIE_COMMAND_KEY, { command: homieCommand, parsed, ts: Date.now() });

    if (parsed.kind === "empty") {
      setHomieReply("Say what you want Homie to operate: open a panel, explain a warning, apply a mode, run scan, or request a layout reset.");
      return;
    }

    if (parsed.kind === "mode") {
      const mode = WORKSPACE_MODES.find((m) => m.id === parsed.target);
      if (!mode) {
        setHomieReply("I found a mode request, but not a known workspace mode.");
        rememberHomieCommand({ command: homieCommand, parsed, status: "warn", reply: "Unknown mode" });
        return;
      }
      applyMode(mode, onNavigate);
      const reply = `Applied ${mode.name}. I changed only safe operator preferences: active panel, pins, shell/command density, Homie tone hint, and visual mode.`;
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    if (parsed.kind === "open") {
      onNavigate(parsed.target);
      setSelectedPanel(parsed.target);
      const reply = `Opening ${getPanelMeta(parsed.target).title}.`;
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    if (parsed.kind === "focus") {
      onNavigate(parsed.target);
      setSelectedPanel(parsed.target);
      setOpen(false);
      const reply = `Focusing ${getPanelMeta(parsed.target).title}.`;
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    if (parsed.kind === "why") {
      setSelectedPanel(parsed.target);
      setTab("Panels");
      const r = receiptMap.get(parsed.target) || scorePanel(parsed.target);
      const reply = `${getPanelMeta(parsed.target).title}: ${r.reasons[0]} Fix: ${r.bestNextAction}`;
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: r.status, reply });
      return;
    }

    if (parsed.kind === "reset-request") {
      setSelectedPanel(parsed.target);
      setTab("Panels");
      writeJSON(HOMIE_PENDING_CONFIRM_KEY, { kind: "reset-layout", panelId: parsed.target, requestedAt: Date.now(), command: homieCommand });
      const reply = `Reset request staged for ${getPanelMeta(parsed.target).title}. I will not reset anything from text alone. Use the confirmed Reset layout button on the panel card.`;
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "warn", reply });
      return;
    }

    if (parsed.kind === "scan") {
      setReceipts(scanReceipts());
      setTab("Doctor");
      const reply = "OS Doctor scan refreshed. Check Doctor for top risks and Receipts for the ledger.";
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    if (parsed.kind === "receipts") {
      setTab("Receipts");
      const reply = "Opening the Truth Receipts ledger.";
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    if (parsed.kind === "legacy") {
      setTab("Legacy");
      const reply = "Opening the Family Legacy Open First lane.";
      setHomieReply(reply);
      rememberHomieCommand({ command: homieCommand, parsed, status: "success", reply });
      return;
    }

    const reply = "I saved that as an operator note. For action routing, try open/focus/why/apply/reset/scan/receipts/legacy.";
    setHomieReply(reply);
    rememberHomieCommand({ command: homieCommand, parsed, status: "info", reply });
  }

  const panelGroups'@
$tsx = [regex]::Replace($tsx, $patternExec, $newExec)

# Replace Homie tab block.
$patternHomie = '(?s)\s*\{tab === "Homie" && \([\s\S]*?\)\}\s*(?=\{tab === "Legacy" && \()'
$newHomie = @'
            {tab === "Homie" && (
              <div className="fgGodSection">
                <div className="fgGodHomieBridgeGrid">
                  <div className="fgGodHomieBridgeCard">
                    <div className="fgGodReasonCard">
                      <div className="fgGodReasonTitle">Homie Operator Bridge</div>
                      <div className="fgGodReasonText">Type what you want Homie to do. This bridge routes plain language into safe FairlyGodMode actions. Reset requests are staged and still require a button confirmation.</div>
                      <div className="fgGodHomieBridgeBadgeRow">
                        <span className="badge good">local only</span>
                        <span className="badge warn">resets require confirmation</span>
                        <span className="badge">no backend rewrite</span>
                      </div>
                    </div>

                    <div className="fgGodCommandBox fgGodHomieCommandRow">
                      <input value={homieCommand} onChange={(e) => setHomieCommand(e.target.value)} placeholder='Try: "why is Security bad" or "apply Family Legacy Mode"' />
                      <button className="tabBtn active" onClick={executeHomieCommand}>Run command</button>
                    </div>

                    <div className="fgGodHomieCommandHints">
                      {homieCommandExamples().map((example) => (
                        <button key={example} className="tabBtn" onClick={() => setHomieCommand(example)}>{example}</button>
                      ))}
                    </div>

                    <div className={`fgGodHomieReply ${String(homieReply).toLowerCase().includes("reset") ? "warn" : ""}`}>
                      <b>Homie operator reply</b>
                      <span>{homieReply}</span>
                    </div>

                    <div className="fgGodHomieActionPlan">
                      <div className="fgGodHomieActionItem">
                        <b>1</b>
                        <div><b>Understand</b><small>Parse mode, panel, scan, receipts, why, open, focus, or reset request.</small></div>
                        <span className="badge good">safe</span>
                      </div>
                      <div className="fgGodHomieActionItem">
                        <b>2</b>
                        <div><b>Route</b><small>Run only local FairlyGodMode actions. No Trading, CardGODMode, or Homie backend rewrites.</small></div>
                        <span className="badge good">local</span>
                      </div>
                      <div className="fgGodHomieActionItem">
                        <b>3</b>
                        <div><b>Confirm risky actions</b><small>Layout resets are staged and must be confirmed with a button.</small></div>
                        <span className="badge warn">guarded</span>
                      </div>
                    </div>
                  </div>

                  <div className="fgGodHomieBridgeCard">
                    <div className="fgGodReasonCard">
                      <div className="fgGodReasonTitle">Operator command log</div>
                      <div className="fgGodReasonText">Recent routed commands are stored locally for inspection and debugging.</div>
                    </div>
                    <div className="fgGodHomieLog">
                      {readJSON<any[]>(HOMIE_COMMAND_LOG_KEY, []).slice(0, 12).map((item) => (
                        <div key={item.id} className="fgGodHomieLogItem">
                          <b>{item.command || "command"}</b>
                          <span>{safeDate(item.ts)} - {item.status || "info"} - {item.reply || item.parsed?.label || "routed"}</span>
                        </div>
                      ))}
                      {!readJSON<any[]>(HOMIE_COMMAND_LOG_KEY, []).length && (
                        <div className="fgGodHomieLogItem">
                          <b>No commands routed yet</b>
                          <span>Run a Homie operator command to start the local log.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

'@

$tsx2 = [regex]::Replace($tsx, $patternHomie, "`r`n" + $newHomie)
if ($tsx2 -eq $tsx) {
  Write-Host "[v10.38.2] Homie tab regex did not match. Parser/execute helpers still applied." -ForegroundColor Yellow
} else {
  $tsx = $tsx2
}

[System.IO.File]::WriteAllText($component, $tsx, $utf8NoBom)

# CSS append/replace
$cssPayload = Join-Path $payload "HOMIE_FAIRLYGODMODE_OPERATOR_BRIDGE.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.2 Homie FairlyGodMode Operator Bridge ===== */"
$end = "/* ===== v10.38.2 Homie FairlyGodMode Operator Bridge END ===== */"
$patternCss = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $patternCss, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.2";')
  if ($ver -notmatch 'HOMIE_FAIRLYGODMODE_OPERATOR_BRIDGE_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const HOMIE_FAIRLYGODMODE_OPERATOR_BRIDGE_PASS = "v10.38.2_HomieFairlyGodModeOperatorBridgePass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.2] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
