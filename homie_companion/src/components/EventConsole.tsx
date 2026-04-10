import type { HomieBridgeEvent } from "../types/bridge";

type Props = {
  events: HomieBridgeEvent[];
};

export function EventConsole({ events }: Props) {
  return (
    <div className="card">
      <div className="card-title">Recent bridge events</div>
      <div className="event-console">
        {events.length === 0 ? (
          <div className="event-row muted">No events yet. Try a test button.</div>
        ) : (
          events.map((event, index) => (
            <div className="event-row" key={`${event.type}-${index}`}>
              <strong>{event.type}</strong>
              <pre>{JSON.stringify(event.payload || {}, null, 2)}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
