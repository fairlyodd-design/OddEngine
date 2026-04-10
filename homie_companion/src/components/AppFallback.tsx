type Props = {
  onReload: () => void;
};

export function AppFallback({ onReload }: Props) {
  return (
    <div className="app-fallback">
      <div className="app-fallback-card">
        <div className="card-title">Homie Companion</div>
        <h2>Homie hit a startup bump</h2>
        <p>The safe startup shield caught an app error before the window went fully blank.</p>
        <button className="mini-btn" onClick={onReload}>Reload companion</button>
      </div>
    </div>
  );
}
