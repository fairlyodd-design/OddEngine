import type { HomieState } from "../types/homie";

type Props = {
  activeState: HomieState;
  onSetState: (state: HomieState) => void;
  onSendSpeechEvent: () => void;
  onSendAlertEvent: () => void;
};

const states: HomieState[] = ["idle", "listening", "talking", "alert", "celebrate"];

export function CompanionControls({ activeState, onSetState, onSendSpeechEvent, onSendAlertEvent }: Props) {
  return (
    <div className="card">
      <div className="card-title">Control dock</div>
      <div className="button-grid button-grid-compact">
        {states.map((state) => (
          <button
            key={state}
            className={`state-btn ${activeState === state ? "active" : ""}`}
            onClick={() => onSetState(state)}
          >
            {state}
          </button>
        ))}
      </div>
      <div className="button-row top-gap">
        <button className="mini-btn" onClick={onSendSpeechEvent}>Test speech</button>
        <button className="mini-btn" onClick={onSendAlertEvent}>Test alert</button>
      </div>
    </div>
  );
}
