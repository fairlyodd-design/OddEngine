import { useMemo, useState } from "react";
import type { StoryBridgeSnapshot } from "../lib/storyBridge";
import type { StoryActionRequest } from "../lib/storyActionBridge";
import { STORY_ROOM_LABELS } from "../lib/storyBridge";

type Message = {
  role: "assistant" | "user";
  text: string;
  bullets?: string[];
};

type Props = {
  history: Message[];
  quickReplies: string[];
  isResponding: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  loopActive: boolean;
  bargeInReady: boolean;
  bargingIn: boolean;
  warmingMic: boolean;
  interimText: string;
  voiceSupported: { recognition: boolean; synthesis: boolean; micActivity: boolean };
  storyBridge: StoryBridgeSnapshot | null;
  latestStoryAction: StoryActionRequest | null;
  pendingStoryActions: number;
  onSend: (text: string) => void;
  onSaveLatestNote: () => void;
  onBuildActiveRoom: () => void;
  onPrepRenderPacket: () => void;
  onQueueRenderJob: () => void;
  onRefreshRenderQueue: () => void;
  onImportLatestOutput: () => void;
  onWatchLatestOutput: () => void;
  onSaveOutputReviewNote: () => void;
  onApproveOutput: () => void;
  onReviseOutput: () => void;
  onRerenderOutput: () => void;
  onPrepRevisionLoop: () => void;
  onPrepRerenderPacket: () => void;
  onPrepPublishPacket: () => void;
  onPrepReleaseBoard: () => void;
  onPrepProviderRoute: () => void;
  onFinalExportDeliverables: () => void;
  onReviewLatestOutput: () => void;
  onStartVoice: () => void;
  onStopVoice: () => void;
  onToggleVoiceLoop: () => void;
  onInterruptVoice: () => void;
};

export function CompanionConversation({
  history,
  quickReplies,
  isResponding,
  isListening,
  isSpeaking,
  loopActive,
  bargeInReady,
  bargingIn,
  warmingMic,
  interimText,
  voiceSupported,
  storyBridge,
  latestStoryAction,
  pendingStoryActions,
  onSend,
  onSaveLatestNote,
  onBuildActiveRoom,
  onPrepRenderPacket,
  onQueueRenderJob,
  onRefreshRenderQueue,
  onImportLatestOutput,
  onWatchLatestOutput,
  onSaveOutputReviewNote,
  onApproveOutput,
  onReviseOutput,
  onRerenderOutput,
  onPrepRevisionLoop,
  onPrepRerenderPacket,
  onPrepPublishPacket,
  onPrepReleaseBoard,
  onPrepProviderRoute,
  onFinalExportDeliverables,
  onReviewLatestOutput,
  onStartVoice,
  onStopVoice,
  onToggleVoiceLoop,
  onInterruptVoice
}: Props) {
  const [draft, setDraft] = useState("");
  const latestAssistant = useMemo(() => [...history].reverse().find((item) => item.role === "assistant"), [history]);

  function submit(text: string) {
    const value = text.trim();
    if (!value) return;
    onSend(value);
    setDraft("");
  }

  const manualInterruptAvailable = loopActive && isSpeaking;
  const micButtonLabel = manualInterruptAvailable ? "Take turn now" : loopActive ? (warmingMic ? "Mic reopening" : "Open mic running") : isListening ? "Stop listening" : "Talk once";
  const voiceLoopLabel = loopActive ? "End voice chat" : "Start voice chat";
  const activeRoomLabel = storyBridge ? STORY_ROOM_LABELS[storyBridge.activeRoom] : null;
  const nextRoomLabel = storyBridge ? STORY_ROOM_LABELS[storyBridge.nextRoom] : null;

  return (
    <div className="card conversation-card">
      <div className="card-title">Companion chat</div>
      <div className="conversation-copy">
        <h3>Talk with Homie</h3>
        <p>Type, tap once, or open a continuous voice chat so Homie can listen, answer back, reopen the mic, recover from browser weirdness, cut in naturally, and now stay synced to your active Story Forge project too.</p>
      </div>

      {storyBridge ? (
        <div className="story-bridge-card">
          <div className="story-bridge-header">
            <div>
              <div className="card-title">Story Forge bridge</div>
              <div className="story-bridge-title">{storyBridge.projectTitle}</div>
            </div>
            <span className="pill ok">live sync</span>
          </div>
          <div className="story-bridge-grid">
            <div className="story-bridge-cell">
              <div className="small">Active room</div>
              <b>{activeRoomLabel}</b>
            </div>
            <div className="story-bridge-cell">
              <div className="small">Next room</div>
              <b>{nextRoomLabel}</b>
            </div>
            <div className="story-bridge-cell">
              <div className="small">Resume point</div>
              <div>{storyBridge.resumeFrom}</div>
            </div>
            <div className="story-bridge-cell">
              <div className="small">Preview</div>
              <div>{storyBridge.roomPreviewTitle || storyBridge.summary}</div>
            </div>
          </div>
          {storyBridge.homieCue ? <div className="story-bridge-cue">Latest cue: {storyBridge.homieCue}</div> : null}
          <div className="story-action-grid">
            <div className="story-action-cell">
              <div className="small">Latest action</div>
              <b>{latestStoryAction?.resultSummary || storyBridge.lastActionSummary || "No action yet"}</b>
              <div>{latestStoryAction ? `${latestStoryAction.status} • ${new Date(latestStoryAction.updatedAt).toLocaleTimeString()}` : `${pendingStoryActions} queued`}</div>
            </div>
            <div className="story-action-cell">
              <div className="small">Render lane</div>
              <b>{storyBridge.latestRenderJobId || (storyBridge.renderReady ? "packet staged" : "idle")}</b>
              <div>{storyBridge.latestRenderStatus || (storyBridge.renderReady ? "ready for handoff" : "not staged")}</div>
            </div>
            <div className="story-action-cell">
              <div className="small">Queue board</div>
              <b>{storyBridge.renderQueueCount || 0} live job{storyBridge.renderQueueCount === 1 ? "" : "s"}</b>
              <div>{storyBridge.renderCompletedCount || 0} completed</div>
            </div>
            <div className="story-action-cell">
              <div className="small">Latest output</div>
              <b>{storyBridge.latestOutputTitle || "No imported output yet"}</b>
              <div>{storyBridge.latestOutputImported ? (storyBridge.latestOutputDecision ? `${storyBridge.latestOutputDecision}${storyBridge.latestOutputReviewNote ? ` • ${storyBridge.latestOutputReviewNote}` : ""}` : (storyBridge.latestOutputWatched ? "watched / review started" : "imported / review pending")) : "not imported yet"}</div>
            </div>
            <div className="story-action-cell">
              <div className="small">Next pass</div>
              <b>{storyBridge.latestNextPassPacketTitle || "Not staged yet"}</b>
              <div>{storyBridge.latestNextPassSummary || "Approve / revise / re-render to auto-build the next pass."}</div>
            </div>
            <div className="story-action-cell">
              <div className="small">Publish lane</div>
              <b>{storyBridge.latestPublishPacketTitle || "Not staged yet"}</b>
              <div>{storyBridge.latestPublishSummary || "Approve an output to roll it into a release packet."}</div>
            </div>
            <div className="story-action-cell">
              <div className="small">Release board</div>
              <b>{storyBridge.latestReleaseBoardTitle || "Not staged yet"}</b>
              <div>{storyBridge.latestReleaseBoardSummary || "Turn the publish packet into platform checklists, teaser assets, metadata, and final output files."}</div>
            </div>
            <div className="story-action-cell">
              <div className="small">Provider route</div>
              <b>{storyBridge.latestProviderRouteTitle || "Not staged yet"}</b>
              <div>{storyBridge.latestProviderLabel ? `${storyBridge.latestProviderLabel}${storyBridge.latestProviderRouteStatus ? ` • ${storyBridge.latestProviderRouteStatus}` : ""}` : "Route the release board into a real provider lane."}</div>
            </div>
            <div className="story-action-cell">
              <div className="small">Final export</div>
              <b>{storyBridge.latestFinalDeliverableCount || 0} deliverable{storyBridge.latestFinalDeliverableCount === 1 ? "" : "s"}</b>
              <div>{storyBridge.latestFinalExportSummary || (storyBridge.latestExportReady ? "Final export lane is ready." : "Stage a provider route before final export.")}</div>
            </div>
          </div>
          <div className="quick-replies" style={{ marginTop: 10 }}>
            <button className="mini-btn" onClick={() => submit("Guide the active room")}>Guide active room</button>
            <button className="mini-btn" onClick={() => submit("What should we build next?")}>Guide next room</button>
            <button className="mini-btn" onClick={() => submit("Recap the project")}>Recap project</button>
          </div>
          <div className="quick-replies" style={{ marginTop: 10 }}>
            <button className="mini-btn" onClick={onSaveLatestNote}>Save latest note</button>
            <button className="mini-btn" onClick={onBuildActiveRoom}>Build active room</button>
            <button className="mini-btn" onClick={onPrepRenderPacket}>Prep render packet</button>
            <button className="mini-btn active-voice" onClick={onQueueRenderJob}>Queue render job</button>
          </div>
          <div className="quick-replies" style={{ marginTop: 10 }}>
            <button className="mini-btn" onClick={onRefreshRenderQueue}>Refresh render queue</button>
            <button className="mini-btn" onClick={onImportLatestOutput}>Import latest output</button>
            <button className="mini-btn" onClick={onWatchLatestOutput}>Mark watched</button>
            <button className="mini-btn" onClick={onReviewLatestOutput}>Review latest output</button>
          </div>
          <div className="quick-replies" style={{ marginTop: 10 }}>
            <button className="mini-btn" onClick={onSaveOutputReviewNote}>Save output note</button>
            <button className="mini-btn" onClick={onApproveOutput}>Approve output</button>
            <button className="mini-btn" onClick={onReviseOutput}>Revise output</button>
            <button className="mini-btn" onClick={onRerenderOutput}>Request re-render</button>
          </div>
          <div className="quick-replies" style={{ marginTop: 10 }}>
            <button className="mini-btn" onClick={onPrepRevisionLoop}>Prep revision loop</button>
            <button className="mini-btn" onClick={onPrepRerenderPacket}>Prep re-render packet</button>
            <button className="mini-btn" onClick={onPrepPublishPacket}>Prep publish packet</button>
            <button className="mini-btn" onClick={onPrepReleaseBoard}>Prep release board</button>
          </div>
          <div className="quick-replies" style={{ marginTop: 10 }}>
            <button className="mini-btn" onClick={onPrepProviderRoute}>Prep provider route</button>
            <button className="mini-btn active-voice" onClick={onFinalExportDeliverables}>Final export deliverables</button>
          </div>
        </div>
      ) : null}

      <div className="voice-toolbar">
        <button
          className={`mini-btn ${loopActive ? "active-voice" : ""}`}
          onClick={onToggleVoiceLoop}
          disabled={!voiceSupported.recognition}
        >
          {voiceLoopLabel}
        </button>
        <button
          className={`mini-btn ${manualInterruptAvailable || (isListening && !loopActive) || warmingMic ? "active-voice" : ""}`}
          onClick={manualInterruptAvailable ? onInterruptVoice : isListening && !loopActive ? onStopVoice : onStartVoice}
          disabled={!voiceSupported.recognition || (loopActive && !manualInterruptAvailable)}
        >
          {micButtonLabel}
        </button>
        <span className={`pill ${loopActive ? "ok" : "soft"}`}>Open mic {loopActive ? "on" : "off"}</span>
        <span className={`pill ${warmingMic ? "warn" : bargeInReady ? "ok" : "soft"}`}>{warmingMic ? "handoff smoothing" : bargeInReady ? "cut-in ready" : "turn stable"}</span>
        <span className="pill soft">Mic {voiceSupported.recognition ? "ready" : "not ready"}</span>
        <span className="pill soft">Voice back {voiceSupported.synthesis ? "ready" : "not ready"}</span>
      </div>

      {loopActive ? (
        <div className="voice-loop-card">
          <div className="card-title">Continuous voice chat</div>
          <div className="voice-interim-text">
            Homie will listen, answer back, then reopen the mic after speaking so you can keep the conversation flowing.
            {voiceSupported.micActivity ? " While Homie talks, you can cut in naturally or tap Take turn now." : " Tap Take turn now any time Homie is speaking if you want to jump in fast."}
          </div>
        </div>
      ) : null}

      {isListening || interimText || bargingIn || warmingMic ? (
        <div className="voice-interim-card">
          <div className="card-title">{bargingIn ? "Cutting back to you" : warmingMic ? "Reopening mic" : loopActive ? "Open mic is listening" : "Homie is listening"}</div>
          <div className="voice-interim-text">
            {bargingIn
              ? "Got you. Homie is dropping the reply lane and reopening the mic now."
              : warmingMic
                ? "Homie is smoothing the handoff and getting your turn ready again."
                : interimText || "Speak naturally. Homie will send it when the mic catches a final phrase."}
          </div>
        </div>
      ) : null}

      <div className="conversation-thread">
        {history.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`bubble ${message.role}`}>
            <div className="bubble-role">{message.role === "assistant" ? "Homie" : "You"}</div>
            <div>{message.text}</div>
            {message.bullets?.length ? (
              <ul className="bubble-list">
                {message.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
              </ul>
            ) : null}
          </div>
        ))}
        {isResponding ? <div className="bubble assistant typing">Homie is thinking…</div> : null}
        {isSpeaking ? <div className="bubble assistant speaking">{manualInterruptAvailable ? "Homie is talking back — cut in any time if you want to steer it." : loopActive ? "Homie is talking back, then reopening the mic…" : "Homie is talking back…"}</div> : null}
      </div>

      {latestAssistant?.bullets?.length ? (
        <div className="suggestion-card">
          <div className="card-title">Why Homie said that</div>
          <ul className="bubble-list compact">
            {latestAssistant.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="quick-replies">
        {quickReplies.map((reply) => (
          <button key={reply} className="mini-btn" onClick={() => submit(reply)}>{reply}</button>
        ))}
      </div>

      <div className="composer-row">
        <textarea
          className="conversation-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask Homie for help with trading, groceries, budget, grow, Story Forge rooms, chapters, scripts, shots, songs, or just a calm reset…"
          rows={3}
        />
        <div className="button-row">
          <button className="mini-btn" onClick={() => submit(draft)} disabled={isResponding}>Send</button>
          <button className="mini-btn" onClick={() => setDraft("")}>Clear</button>
        </div>
      </div>
    </div>
  );
}
