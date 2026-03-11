import fs from "node:fs";

const file = "ui/src/panels/Books.tsx";
let s = fs.readFileSync(file, "utf8");

function replaceOnce(search, replacement, label) {
  if (!s.includes(search)) {
    throw new Error(`Could not find marker for: ${label}`);
  }
  s = s.replace(search, replacement);
}

function insertAfter(search, addition, label) {
  if (!s.includes(search)) {
    throw new Error(`Could not find marker for: ${label}`);
  }
  s = s.replace(search, `${search}${addition}`);
}

function insertBefore(search, addition, label) {
  if (!s.includes(search)) {
    throw new Error(`Could not find marker for: ${label}`);
  }
  s = s.replace(search, `${addition}${search}`);
}

function maybeReplace(search, replacement) {
  if (s.includes(search)) {
    s = s.replace(search, replacement);
  }
}

if (!s.includes('const KEY_STUDIO_ROOM = "oddengine:writers:studioRoom:v1";')) {
  insertAfter(
    'const KEY_RENDER_PREVIEW = "oddengine:writers:renderPreviewUrl:v1";',
    '\nconst KEY_STUDIO_ROOM = "oddengine:writers:studioRoom:v1";',
    "KEY_STUDIO_ROOM"
  );
}

if (!s.includes('type StudioRoom = "home" | "writing" | "director" | "music" | "render" | "ops";')) {
  insertAfter(
    'type ScopeLevel = "Lean" | "Balanced" | "Epic";',
    '\ntype StudioRoom = "home" | "writing" | "director" | "music" | "render" | "ops";',
    "StudioRoom type"
  );
}

if (!s.includes("const [studioRoom, setStudioRoom]")) {
  replaceOnce(
    `  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [activeRenderJobId, setActiveRenderJobId] = useState<string>("");
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderError, setRenderError] = useState<string>("");
  const [lastRenderSyncAt, setLastRenderSyncAt] = useState<number>(0);`,
    `  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [activeRenderJobId, setActiveRenderJobId] = useState<string>("");
  const [renderBusy, setRenderBusy] = useState(false);
  const [renderError, setRenderError] = useState<string>("");
  const [lastRenderSyncAt, setLastRenderSyncAt] = useState<number>(0);
  const [studioRoom, setStudioRoom] = useState<StudioRoom>(() => loadJSON<StudioRoom>(KEY_STUDIO_ROOM, "home"));`,
    "studioRoom state"
  );
}

if (!s.includes("const studioRooms: Array<{ key: StudioRoom; label: string; eyebrow: string; blurb: string }")) {
  insertAfter(
    `  const activeRenderJob = useMemo(
    () => renderJobs.find((job) => job.id === activeRenderJobId) || renderJobs[0] || null,
    [renderJobs, activeRenderJobId]
  );`,
    `

  const assetRollup = useMemo(() => buildAssetRollup(studioAssets), [studioAssets]);

  const studioRooms: Array<{ key: StudioRoom; label: string; eyebrow: string; blurb: string }> = [
    {
      key: "home",
      label: "Studio Home",
      eyebrow: "MASTER PROMPT",
      blurb: "One prompt drives the whole AI build chain across writing, directing, music, render, and release ops.",
    },
    {
      key: "writing",
      label: "Writing Room",
      eyebrow: "WRITE THE CORE",
      blurb: "Build the actual story, lyrics, script, chapters, scenes, and the finished working copy foundation.",
    },
    {
      key: "director",
      label: "Director Room",
      eyebrow: "SCENE + CAMERA",
      blurb: "Turn the creative core into storyboard beats, shot lists, pacing, continuity, and scene order.",
    },
    {
      key: "music",
      label: "Music Lab",
      eyebrow: "VOICE + SCORE",
      blurb: "Build songs, cues, voiceover packs, soundtrack direction, and timing notes for the final assembly.",
    },
    {
      key: "render",
      label: "Render Lab",
      eyebrow: "RENDER + WATCH",
      blurb: "Bridge the project into render jobs, queue tracking, completed imports, and watch-ready output flow.",
    },
    {
      key: "ops",
      label: "Producer Ops",
      eyebrow: "SHIP THE PROJECT",
      blurb: "Package the release lane, launch docs, readiness board, and the real producer checklist.",
    },
  ];

  const activeStudioRoom = studioRooms.find((room) => room.key === studioRoom) || studioRooms[0];`,
    "studio room metadata"
  );
}

if (!s.includes("saveJSON(KEY_STUDIO_ROOM, studioRoom)")) {
  insertAfter(
    `  useEffect(() => { saveJSON(KEY_RENDER_PREVIEW, renderPreviewUrl); }, [renderPreviewUrl]);`,
    `

  useEffect(() => { saveJSON(KEY_STUDIO_ROOM, studioRoom); }, [studioRoom]);`,
    "studioRoom persistence"
  );
}

if (!s.includes("FAIRLYODD STUDIO")) {
  insertBefore(
    `              <div className="card softCard mt-4">
                <div className="cluster wrap spread">
                  <div>
                    <div className="small shellEyebrow">RENDER WORKER BRIDGE</div>`,
    `              <div className="card softCard mt-4">
                <div className="small shellEyebrow">FAIRLYODD STUDIO</div>
                <div className="h mt-2">Prompt-to-project pipeline for songs, books, cartoons, videos, and final working packets.</div>
                <div className="sub mt-2">
                  This is the creative workspace inside FairlyOdd OS. Start from one prompt, let the AI build the writing, director, music, render, and producer lanes, then push toward a finished working copy.
                </div>

                <div className="row wrap mt-4">
                  {studioRooms.map((room) => (
                    <button
                      key={room.key}
                      className={\`tabBtn \${studioRoom === room.key ? "active" : ""}\`}
                      onClick={() => setStudioRoom(room.key)}
                    >
                      {room.label}
                    </button>
                  ))}
                </div>

                <div className="card softCard mt-4">
                  <div className="small shellEyebrow">{activeStudioRoom.eyebrow}</div>
                  <div className="sub mt-2">{activeStudioRoom.blurb}</div>

                  <div className="mt-4" style={{ display: "grid", gap: 12, gridTemplateColumns: "1.2fr 0.8fr" }}>
                    <div className="card softCard">
                      <div className="small shellEyebrow">PROJECT CORE</div>
                      <div className="small mt-2"><b>Prompt:</b> {studioPrompt || "No master prompt yet."}</div>
                      <div className="small mt-2"><b>Product lane:</b> {productionType}</div>
                      <div className="small mt-2"><b>Visual style:</b> {visualStyle}</div>
                      <div className="small mt-2"><b>Release target:</b> {releaseTarget}</div>
                    </div>

                    <div className="card softCard">
                      <div className="small shellEyebrow">PIPELINE COVERAGE</div>
                      <div className="small mt-2"><b>Writing:</b> {assetRollup.writing}</div>
                      <div className="small mt-2"><b>Visual:</b> {assetRollup.visual}</div>
                      <div className="small mt-2"><b>Production:</b> {assetRollup.production}</div>
                      <div className="small mt-2"><b>Render jobs:</b> {renderJobs.length}</div>
                    </div>
                  </div>

                  <div className="note mt-4">
                    {studioRoom === "home" ? "Studio Home is the top-level brief: one prompt in, one full project pipeline out." : null}
                    {studioRoom === "writing" ? "Writing Room is where the AI builds story, lyrics, dialogue, chapters, scene beats, and the working copy." : null}
                    {studioRoom === "director" ? "Director Room turns the draft into shot logic, pacing, camera language, and continuity." : null}
                    {studioRoom === "music" ? "Music Lab owns songs, score, cue sheets, voiceover packs, and soundtrack timing." : null}
                    {studioRoom === "render" ? "Render Lab is the local render-worker lane below. Create jobs, poll status, import outputs, and launch watch flow." : null}
                    {studioRoom === "ops" ? "Producer Ops is the delivery lane: readiness, release docs, launch assets, and final ship checklist." : null}
                  </div>
                </div>
              </div>

`,
    "insert Studio hero block before render bridge"
  );
}

maybeReplace(
  `<div className="small shellEyebrow">RENDER WORKER BRIDGE</div>`,
  `<div className="small shellEyebrow">RENDER LAB</div>`
);

maybeReplace(
  `POST /render/jobs, queue polling, completed output import, and watch flow against the local render backend.`,
  `Prompt-to-render bridge for FairlyOdd Studio. Create jobs, poll the local queue, import completed outputs, and launch the watch flow.`
);

maybeReplace(`LOCAL RENDER QUEUE`, `RENDER LAB QUEUE`);
maybeReplace(`ACTIVE JOB`, `RENDER LAB ACTIVE JOB`);

maybeReplace(`Writers Lounge`, `FairlyOdd Studio`);
maybeReplace(`WORLD / WRITERS`, `FAIRLYODD OS / STUDIO`);

fs.writeFileSync(file, s);
console.log("Patched ui/src/panels/Books.tsx for v10.24.64_StudioPanelReframePass");
