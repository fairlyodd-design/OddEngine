import fs from "node:fs";

const file = "ui/src/panels/Books.tsx";
let s = fs.readFileSync(file, "utf8");

function mustInclude(marker, label) {
  if (!s.includes(marker)) {
    throw new Error(`Could not find marker for: ${label}`);
  }
}

function insertAfter(marker, addition, label) {
  mustInclude(marker, label);
  if (!s.includes(addition.trim())) {
    s = s.replace(marker, `${marker}${addition}`);
  }
}

function replaceOnce(search, replacement, label) {
  mustInclude(search, label);
  s = s.replace(search, replacement);
}

insertAfter(
  'import { oddApi, isDesktop } from "../lib/odd";',
  `
import {
  generateFullStudioPipeline,
  generateStudioRoomAssets,
  inferStudioProjectType,
  mapProjectTypeToProductionType,
  type StudioProjectType,
  type StudioRoomKey,
} from "../lib/studioAutomation";`,
  "studioAutomation import"
);

insertAfter(
  'const KEY_RENDER_PREVIEW = "oddengine:writers:renderPreviewUrl:v1";',
  `
const KEY_STUDIO_PROJECT_TYPE = "oddengine:writers:studioProjectType:v1";
const KEY_STUDIO_PIPELINE_RUN = "oddengine:writers:studioPipelineRun:v1";`,
  "studio automation keys"
);

insertAfter(
  'const [studioRoom, setStudioRoom] = useState<StudioRoom>(() => loadJSON<StudioRoom>(KEY_STUDIO_ROOM, "home"));',
  `
  const [studioProjectType, setStudioProjectType] = useState<StudioProjectType>(() => loadJSON<StudioProjectType>(KEY_STUDIO_PROJECT_TYPE, inferStudioProjectType(writerMode)));
  const [pipelineBusy, setPipelineBusy] = useState(false);
  const [pipelineError, setPipelineError] = useState("");
  const [lastPipelineRunAt, setLastPipelineRunAt] = useState<number>(() => loadJSON<number>(KEY_STUDIO_PIPELINE_RUN, 0));`,
  "studio automation state"
);

insertAfter(
  '  useEffect(() => { saveJSON(KEY_STUDIO_ROOM, studioRoom); }, [studioRoom]);',
  `
  useEffect(() => { saveJSON(KEY_STUDIO_PROJECT_TYPE, studioProjectType); }, [studioProjectType]);
  useEffect(() => { saveJSON(KEY_STUDIO_PIPELINE_RUN, lastPipelineRunAt); }, [lastPipelineRunAt]);`,
  "studio automation persistence"
);

insertAfter(
  '  const activeStudioRoom = studioRooms.find((room) => room.key === studioRoom) || studioRooms[0];',
  `

  const buildStudioAutomationInput = () => ({
    masterPrompt: String(studioPrompt || active?.logline || active?.title || "").trim(),
    projectType: studioProjectType,
    visualStyle,
    productionType: mapProjectTypeToProductionType(studioProjectType),
    releaseTarget,
    budgetBand,
    scopeLevel,
    existingAssets: studioAssets as any,
  });

  const appendGeneratedAssets = (assets: StudioAsset[]) => {
    if (!assets.length) return;
    setStudioAssets((prev) => [...assets, ...prev]);
  };

  const runGenerateFullPipeline = async () => {
    setPipelineBusy(true);
    setPipelineError("");
    try {
      const input = buildStudioAutomationInput();
      const packet = generateFullStudioPipeline(input as any);
      const allAssets = [
        ...packet.home,
        ...packet.writing,
        ...packet.director,
        ...packet.music,
        ...packet.render,
        ...packet.ops,
      ] as StudioAsset[];

      appendGeneratedAssets(allAssets);
      setProductionType(mapProjectTypeToProductionType(studioProjectType) as any);
      setLastPipelineRunAt(Date.now());
      setStudioRoom("home");
    } catch (err: any) {
      setPipelineError(err?.message || String(err));
    } finally {
      setPipelineBusy(false);
    }
  };

  const regenerateStudioRoomOnly = async (room: StudioRoomKey) => {
    setPipelineBusy(true);
    setPipelineError("");
    try {
      const input = buildStudioAutomationInput();
      const roomAssets = generateStudioRoomAssets(input as any, room);
      appendGeneratedAssets(roomAssets as StudioAsset[]);
      setProductionType(mapProjectTypeToProductionType(studioProjectType) as any);
      setLastPipelineRunAt(Date.now());
      setStudioRoom(room as any);
    } catch (err: any) {
      setPipelineError(err?.message || String(err));
    } finally {
      setPipelineBusy(false);
    }
  };`,
  "studio automation helpers"
);

insertAfter(
  `<div className="row wrap mt-4">
                  {studioRooms.map((room) => (
                    <button
                      key={room.key}
                      className={\`tabBtn \${studioRoom === room.key ? "active" : ""}\`}
                      onClick={() => setStudioRoom(room.key)}
                    >
                      {room.label}
                    </button>
                  ))}
                </div>`,
  `

                <div className="card softCard mt-4">
                  <div className="small shellEyebrow">PROMPT ? PROJECT AUTOMATION</div>
                  <div className="sub mt-2">
                    Generate the full Studio packet from one master prompt, or regenerate only the room you are working on without wiping the rest of the project.
                  </div>

                  <div className="mt-4" style={{ display: "grid", gap: 12, gridTemplateColumns: "1.2fr 0.8fr" }}>
                    <div className="card softCard">
                      <div className="small shellEyebrow">MASTER PROMPT</div>
                      <textarea
                        className="input mt-2"
                        rows={7}
                        value={studioPrompt}
                        onChange={(e) => setStudioPrompt(e.target.value)}
                        placeholder="Describe the song, book, cartoon, video, music video, or other project you want the Studio to build end-to-end."
                      />
                    </div>

                    <div className="card softCard">
                      <div className="small shellEyebrow">PIPELINE CONTROLS</div>
                      <div className="mt-2" style={{ display: "grid", gap: 10 }}>
                        <label className="small">
                          Project type
                          <select
                            className="input mt-2"
                            value={studioProjectType}
                            onChange={(e) => setStudioProjectType(e.target.value as StudioProjectType)}
                          >
                            <option value="song">song</option>
                            <option value="book">book</option>
                            <option value="cartoon">cartoon</option>
                            <option value="video">video</option>
                            <option value="music video">music video</option>
                            <option value="other">other</option>
                          </select>
                        </label>

                        <button className="tabBtn active" disabled={pipelineBusy} onClick={() => void runGenerateFullPipeline()}>
                          {pipelineBusy ? "Generating…" : "Generate full pipeline"}
                        </button>

                        <button className="tabBtn" disabled={pipelineBusy} onClick={() => void regenerateStudioRoomOnly(studioRoom as StudioRoomKey)}>
                          {pipelineBusy ? "Working…" : "Regenerate this room"}
                        </button>

                        <div className="small">
                          <b>Last run:</b> {lastPipelineRunAt ? new Date(lastPipelineRunAt).toLocaleString() : "Not run yet"}
                        </div>
                        <div className="small">
                          <b>Generated assets:</b> {studioAssets.length}
                        </div>
                        {pipelineError ? <div className="note">{pipelineError}</div> : null}
                      </div>
                    </div>
                  </div>
                </div>`,
  "automation UI block"
);

insertAfter(
  `<div className="small mt-2"><b>Product lane:</b> {productionType}</div>`,
  `
                      <div className="small mt-2"><b>Project type:</b> {studioProjectType}</div>`,
  "project type display"
);

fs.writeFileSync(file, s);
console.log("Patched ui/src/panels/Books.tsx for v10.24.66_StudioAutomationPipelinePass");
