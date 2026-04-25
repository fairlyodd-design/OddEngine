$ErrorActionPreference = "Stop"

$root = (Get-Location).Path
$component = Join-Path $root "ui\src\components\FairlyGodModeHUD.tsx"
$styles = Join-Path $root "ui\src\styles.css"
$version = Join-Path $root "ui\src\lib\version.ts"
$payload = Join-Path $root "payload"

if (!(Test-Path $component)) { throw "Missing ui\src\components\FairlyGodModeHUD.tsx. Apply v10.38.2b+ first." }
if (!(Test-Path $styles)) { throw "Missing ui\src\styles.css. Run from C:\OddEngine." }
if (!(Test-Path $payload)) { throw "Missing payload folder. Extract this ZIP into C:\OddEngine first." }

Write-Host "[v10.38.3] Applying Family Legacy Vault Mode + Open First..." -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$tsx = [System.IO.File]::ReadAllText($component, [System.Text.Encoding]::UTF8)

# Add new local storage keys.
if ($tsx -notmatch 'LEGACY_EXPORT_KEY') {
  $tsx = $tsx.Replace(
    'const LEGACY_KEY = "oddengine:fairlygodmode:legacyOpenFirst:v1";',
    'const LEGACY_KEY = "oddengine:fairlygodmode:legacyOpenFirst:v1";' + "`r`n" +
    'const LEGACY_EXPORT_KEY = "oddengine:fairlygodmode:legacyLastExport:v1";'
  )
}

# Replace defaultLegacyState with a fuller vault default.
$patternDefault = '(?s)function defaultLegacyState\(\) \{.*?\n\}'
$newDefault = @'
function defaultLegacyState() {
  return {
    updatedAt: Date.now(),
    welcomeTitle: "Open First",
    welcomeBody:
      "Start here. This page explains what FairlyOdd OS is, what matters most, and where the family can find notes, creative work, project status, and important guidance.",
    familyMessage:
      "This OS was built to help our family with home, money, health, creativity, and next steps. You do not need to understand the code. Start with the checklist, then open Homie if you need guidance.",
    whatThisIs:
      "FairlyOdd OS is a family command center. It has panels for home, budget, health, writing, publishing, trading, groceries, calendars, and Homie.",
    howToUseHomie:
      "Open Homie or the FG/GOD Homie tab and ask simple things like: what should I open first, explain this panel, show family legacy mode, or open the budget.",
    importantNotes:
      "Add important family notes here. Keep this plain and useful.",
    emergencyNotes:
      "Add emergency contacts, must-know instructions, and where to find important documents. Do not store passwords here unless you intentionally choose to.",
    projectStatus:
      [
        { title: "FairlyGodMode", status: "Active", note: "Whole-OS operator deck for health, modes, receipts, Homie commands, and legacy." },
        { title: "Homie", status: "Active", note: "Family guide and AI companion panel." },
        { title: "Creative Works", status: "In progress", note: "Books, videos, render packs, and legacy artifacts live in Writers Lounge/Render Lab." },
      ],
    checklist: [
      { id: "legacy-1", title: "Read this Open First page", note: "Understand the purpose before clicking around.", done: false },
      { id: "legacy-2", title: "Open Homie", note: "Ask Homie what to do next.", done: false },
      { id: "legacy-3", title: "Open Family Budget", note: "Review household money and priorities.", done: false },
      { id: "legacy-4", title: "Open Creative Works", note: "Look for saved books, videos, scripts, or artifacts.", done: false },
      { id: "legacy-5", title: "Open Family Health", note: "Review care and health notes.", done: false },
    ],
    artifacts: [
      { title: "Creative Works", location: "Writers Lounge / Books", note: "Books, scripts, narration, and story projects." },
      { title: "Render Outputs", location: "Render Lab", note: "Videos, scenes, and artifact pipeline outputs." },
      { title: "Publisher Queue", location: "Publisher Hub", note: "Release handoff, product metadata, and publishing work." },
      { title: "Family Budget", location: "Family Budget / Money", note: "Household money, accounts, goals, and actions." },
    ],
    sections: [
      "What this OS is",
      "How to use Homie",
      "Family notes",
      "Important checklist",
      "Project status",
      "Creative works and artifacts",
      "Health and house guidance",
    ],
  };
}
'@
$tsx = [regex]::Replace($tsx, $patternDefault, $newDefault)

# Add state setters if current full component has const [legacy].
$tsx = $tsx.Replace('const [legacy] = useState(() => readJSON(LEGACY_KEY, defaultLegacyState()));', 'const [legacy, setLegacy] = useState<any>(() => readJSON(LEGACY_KEY, defaultLegacyState()));')
if ($tsx -notmatch 'legacyDraft') {
  $tsx = $tsx.Replace(
    'const [showReceiptJson, setShowReceiptJson] = useState(false);',
    'const [showReceiptJson, setShowReceiptJson] = useState(false);' + "`r`n" +
    '  const [legacyDraft, setLegacyDraft] = useState<any>(() => readJSON(LEGACY_KEY, defaultLegacyState()));' + "`r`n" +
    '  const [showLegacyExport, setShowLegacyExport] = useState(false);'
  )
}

# Add helper functions before clearVisualMode.
if ($tsx -notmatch 'function saveLegacyDraft') {
  $anchor = '  function clearVisualMode() {'
  $insert = @'
  function saveLegacyDraft(next = legacyDraft) {
    const updated = { ...next, updatedAt: Date.now() };
    setLegacy(updated);
    setLegacyDraft(updated);
    writeJSON(LEGACY_KEY, updated);
    return updated;
  }

  function updateLegacyField(field: string, value: any) {
    setLegacyDraft((prev: any) => ({ ...prev, [field]: value }));
  }

  function toggleLegacyChecklist(id: string) {
    const next = {
      ...legacyDraft,
      checklist: (legacyDraft.checklist || []).map((item: any) => item.id === id ? { ...item, done: !item.done } : item),
    };
    saveLegacyDraft(next);
  }

  function addLegacyChecklistItem() {
    const title = window.prompt("Checklist item title");
    if (!title) return;
    const note = window.prompt("Short note for this item") || "";
    const next = {
      ...legacyDraft,
      checklist: [...(legacyDraft.checklist || []), { id: `legacy-${Date.now()}`, title, note, done: false }],
    };
    saveLegacyDraft(next);
  }

  function addLegacyProjectStatus() {
    const title = window.prompt("Project name");
    if (!title) return;
    const status = window.prompt("Status") || "In progress";
    const note = window.prompt("Short note") || "";
    const next = {
      ...legacyDraft,
      projectStatus: [...(legacyDraft.projectStatus || []), { title, status, note }],
    };
    saveLegacyDraft(next);
  }

  function addLegacyArtifact() {
    const title = window.prompt("Artifact title");
    if (!title) return;
    const location = window.prompt("Where should family find it?") || "";
    const note = window.prompt("Short note") || "";
    const next = {
      ...legacyDraft,
      artifacts: [...(legacyDraft.artifacts || []), { title, location, note }],
    };
    saveLegacyDraft(next);
  }

  function buildLegacySummary() {
    const data = legacyDraft || legacy || defaultLegacyState();
    const checklist = (data.checklist || []).map((item: any) => `- [${item.done ? "x" : " "}] ${item.title}: ${item.note || ""}`).join("\n");
    const projects = (data.projectStatus || []).map((item: any) => `- ${item.title} (${item.status}): ${item.note || ""}`).join("\n");
    const artifacts = (data.artifacts || []).map((item: any) => `- ${item.title} - ${item.location}: ${item.note || ""}`).join("\n");

    return [
      "# FairlyOdd OS - Open First",
      "",
      data.welcomeBody || "",
      "",
      "## Family message",
      data.familyMessage || "",
      "",
      "## What this OS is",
      data.whatThisIs || "",
      "",
      "## How to use Homie",
      data.howToUseHomie || "",
      "",
      "## Important notes",
      data.importantNotes || "",
      "",
      "## Emergency / must-know notes",
      data.emergencyNotes || "",
      "",
      "## Checklist",
      checklist || "- No checklist items yet.",
      "",
      "## Project status",
      projects || "- No project status items yet.",
      "",
      "## Creative works and artifacts",
      artifacts || "- No artifact lanes yet.",
      "",
      `Updated: ${safeDate(data.updatedAt)}`,
    ].join("\n");
  }

  function exportLegacySummary() {
    const summary = buildLegacySummary();
    writeJSON(LEGACY_EXPORT_KEY, { exportedAt: Date.now(), summary, data: legacyDraft });
    copyText(summary);
    setShowLegacyExport(true);
    window.alert("Legacy Open First summary copied to clipboard when available and saved locally.");
  }

  function resetLegacyDefaults() {
    const ok = window.confirm("Reset Legacy Open First fields to starter defaults? This only affects local legacy draft data.");
    if (!ok) return;
    const next = defaultLegacyState();
    saveLegacyDraft(next);
  }

'@ + $anchor
  $tsx = $tsx.Replace($anchor, $insert)
}

# Replace Legacy tab block broadly.
$patternLegacy = '(?s)\s*\{tab === "Legacy" && \([\s\S]*?\)\}\s*(?=\{tab === "Safety" && \()'
$newLegacy = @'
            {tab === "Legacy" && (
              <div className="fgGodSection">
                <div className="fgGodLegacyVaultHero">
                  <div className="fgGodLegacyVaultTitle">Open First - Family Legacy Vault</div>
                  <div className="fgGodLegacyVaultSub">
                    {legacyDraft.welcomeBody}
                  </div>
                  <div className="fgGodLegacyVaultActions">
                    <button className="tabBtn active" onClick={() => applyMode(WORKSPACE_MODES[0], onNavigate)}>Apply Family Legacy Mode</button>
                    <button className="tabBtn" onClick={() => onNavigate("Homie")}>Open Homie</button>
                    <button className="tabBtn" onClick={() => onNavigate("Books")}>Creative Works</button>
                    <button className="tabBtn" onClick={() => onNavigate("RenderLab")}>Render Lab</button>
                    <button className="tabBtn" onClick={() => onNavigate("FamilyBudget")}>Family Budget</button>
                    <button className="tabBtn" onClick={() => onNavigate("FamilyHealth")}>Family Health</button>
                    <button className="tabBtn" onClick={exportLegacySummary}>Copy/export summary</button>
                  </div>
                </div>

                <div className="fgGodLegacyFamilyHint">
                  Family-friendly rule: start here, read the message, open Homie, then use the checklist. No coding knowledge needed.
                </div>

                <div className="fgGodLegacyVaultGrid">
                  <div className="fgGodLegacyPanel">
                    <h3>Family message</h3>
                    <textarea
                      className="fgGodLegacyTextArea"
                      value={legacyDraft.familyMessage || ""}
                      onChange={(e) => updateLegacyField("familyMessage", e.target.value)}
                      onBlur={() => saveLegacyDraft()}
                    />
                    <h3>What this OS is</h3>
                    <textarea
                      className="fgGodLegacyTextArea"
                      value={legacyDraft.whatThisIs || ""}
                      onChange={(e) => updateLegacyField("whatThisIs", e.target.value)}
                      onBlur={() => saveLegacyDraft()}
                    />
                    <h3>How to use Homie</h3>
                    <textarea
                      className="fgGodLegacyTextArea"
                      value={legacyDraft.howToUseHomie || ""}
                      onChange={(e) => updateLegacyField("howToUseHomie", e.target.value)}
                      onBlur={() => saveLegacyDraft()}
                    />
                  </div>

                  <div className="fgGodLegacyPanel">
                    <h3>Important notes</h3>
                    <textarea
                      className="fgGodLegacyTextArea"
                      value={legacyDraft.importantNotes || ""}
                      onChange={(e) => updateLegacyField("importantNotes", e.target.value)}
                      onBlur={() => saveLegacyDraft()}
                    />
                    <h3>Emergency / must-know notes</h3>
                    <textarea
                      className="fgGodLegacyTextArea"
                      value={legacyDraft.emergencyNotes || ""}
                      onChange={(e) => updateLegacyField("emergencyNotes", e.target.value)}
                      onBlur={() => saveLegacyDraft()}
                    />
                    <div className="fgGodLegacyVaultActions">
                      <button className="tabBtn active" onClick={() => saveLegacyDraft()}>Save notes</button>
                      <button className="tabBtn danger" onClick={resetLegacyDefaults}>Reset starter defaults</button>
                    </div>
                  </div>
                </div>

                <div className="fgGodLegacyVaultGrid">
                  <div className="fgGodLegacyPanel">
                    <div className="row spread wrap">
                      <h3>Priority checklist</h3>
                      <button className="tabBtn" onClick={addLegacyChecklistItem}>Add item</button>
                    </div>
                    <div className="fgGodLegacyList">
                      {(legacyDraft.checklist || []).map((item: any) => (
                        <div key={item.id} className={`fgGodLegacyItem ${item.done ? "done" : ""}`}>
                          <input type="checkbox" checked={!!item.done} onChange={() => toggleLegacyChecklist(item.id)} />
                          <div className="fgGodLegacyItemText">
                            <b>{item.title}</b>
                            <span>{item.note}</span>
                          </div>
                          <div className="fgGodLegacyMiniActions">
                            <button onClick={() => {
                              const title = window.prompt("Edit title", item.title) || item.title;
                              const note = window.prompt("Edit note", item.note || "") || item.note;
                              saveLegacyDraft({ ...legacyDraft, checklist: (legacyDraft.checklist || []).map((x: any) => x.id === item.id ? { ...x, title, note } : x) });
                            }}>Edit</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="fgGodLegacyPanel">
                    <div className="row spread wrap">
                      <h3>Project status</h3>
                      <button className="tabBtn" onClick={addLegacyProjectStatus}>Add project</button>
                    </div>
                    <div className="fgGodLegacyList">
                      {(legacyDraft.projectStatus || []).map((item: any, idx: number) => (
                        <div key={`${item.title}-${idx}`} className="fgGodLegacyItem">
                          <span className="badge">{item.status}</span>
                          <div className="fgGodLegacyItemText">
                            <b>{item.title}</b>
                            <span>{item.note}</span>
                          </div>
                          <div className="fgGodLegacyMiniActions">
                            <button onClick={() => {
                              const title = window.prompt("Project", item.title) || item.title;
                              const status = window.prompt("Status", item.status) || item.status;
                              const note = window.prompt("Note", item.note || "") || item.note;
                              saveLegacyDraft({ ...legacyDraft, projectStatus: (legacyDraft.projectStatus || []).map((x: any, i: number) => i === idx ? { title, status, note } : x) });
                            }}>Edit</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="fgGodLegacyPanel">
                  <div className="row spread wrap">
                    <h3>Creative works and artifact lanes</h3>
                    <button className="tabBtn" onClick={addLegacyArtifact}>Add artifact lane</button>
                  </div>
                  <div className="fgGodLegacyArtifactGrid">
                    {(legacyDraft.artifacts || []).map((item: any, idx: number) => (
                      <div key={`${item.title}-${idx}`} className="fgGodLegacyArtifact">
                        <b>{item.title}</b>
                        <span><b>Where:</b> {item.location}</span>
                        <span>{item.note}</span>
                        <div className="fgGodLegacyMiniActions">
                          <button onClick={() => {
                            const title = window.prompt("Artifact title", item.title) || item.title;
                            const location = window.prompt("Location", item.location || "") || item.location;
                            const note = window.prompt("Note", item.note || "") || item.note;
                            saveLegacyDraft({ ...legacyDraft, artifacts: (legacyDraft.artifacts || []).map((x: any, i: number) => i === idx ? { title, location, note } : x) });
                          }}>Edit</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {showLegacyExport && (
                  <div className="fgGodLegacyPanel">
                    <div className="row spread wrap">
                      <h3>Export preview</h3>
                      <button className="tabBtn" onClick={() => setShowLegacyExport(false)}>Hide</button>
                    </div>
                    <pre className="fgGodLegacyExportBox">{buildLegacySummary()}</pre>
                  </div>
                )}
              </div>
            )}

'@
$tsx2 = [regex]::Replace($tsx, $patternLegacy, "`r`n" + $newLegacy)
if ($tsx2 -eq $tsx) {
  Write-Host "[v10.38.3] Legacy tab regex did not match. Helpers/CSS still applied." -ForegroundColor Yellow
} else {
  $tsx = $tsx2
}

[System.IO.File]::WriteAllText($component, $tsx, $utf8NoBom)

# Append/replace CSS block.
$cssPayload = Join-Path $payload "FAMILY_LEGACY_VAULT_OPEN_FIRST.css"
$css = [System.IO.File]::ReadAllText($styles, [System.Text.Encoding]::UTF8)
$block = [System.IO.File]::ReadAllText($cssPayload, [System.Text.Encoding]::ASCII)
$start = "/* ===== v10.38.3 Family Legacy Vault Mode + Open First ===== */"
$end = "/* ===== v10.38.3 Family Legacy Vault Mode + Open First END ===== */"
$pattern = [regex]::Escape($start) + "[\s\S]*?" + [regex]::Escape($end)
$css = [regex]::Replace($css, $pattern, "", [System.Text.RegularExpressions.RegexOptions]::Singleline).TrimEnd()
[System.IO.File]::WriteAllText($styles, $css + "`r`n`r`n" + $block + "`r`n", $utf8NoBom)

if (Test-Path $version) {
  $ver = [System.IO.File]::ReadAllText($version, [System.Text.Encoding]::UTF8)
  $ver = [regex]::Replace($ver, 'export const APP_VERSION = ".*?";', 'export const APP_VERSION = "10.38.3";')
  if ($ver -notmatch 'FAMILY_LEGACY_VAULT_PASS') {
    $ver = $ver.TrimEnd() + "`r`n" + 'export const FAMILY_LEGACY_VAULT_PASS = "v10.38.3_FamilyLegacyVaultModeAndOpenFirstPass";' + "`r`n"
  }
  [System.IO.File]::WriteAllText($version, $ver, $utf8NoBom)
}

Write-Host "[v10.38.3] Applied." -ForegroundColor Green
Write-Host "Next:"
Write-Host "  npm --prefix ui run build"
Write-Host "  npm run dev:desktop"
