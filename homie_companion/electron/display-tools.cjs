const { screen } = require("electron");

function getDisplaysSummary() {
  return screen.getAllDisplays().map((display) => ({
    id: display.id,
    label: display.label || `Display ${display.id}`,
    bounds: display.bounds,
    workArea: display.workArea,
    primary: display.bounds.x === 0 && display.bounds.y === 0
  }));
}

function moveWindowToNextDisplay(browserWindow) {
  const displays = screen.getAllDisplays();
  if (!browserWindow || browserWindow.isDestroyed() || displays.length < 2) {
    return { moved: false, displayCount: displays.length };
  }

  const bounds = browserWindow.getBounds();
  const current = screen.getDisplayMatching(bounds);
  const currentIndex = displays.findIndex((display) => display.id === current.id);
  const next = displays[(currentIndex + 1) % displays.length];
  const target = next.workArea || next.bounds;

  const nextBounds = {
    width: Math.min(bounds.width, target.width),
    height: Math.min(bounds.height, target.height),
    x: target.x + Math.round((target.width - Math.min(bounds.width, target.width)) / 2),
    y: target.y + Math.round((target.height - Math.min(bounds.height, target.height)) / 2)
  };

  browserWindow.setBounds(nextBounds);
  browserWindow.focus();

  return {
    moved: true,
    targetDisplayId: next.id,
    displayCount: displays.length,
    bounds: nextBounds
  };
}

module.exports = {
  getDisplaysSummary,
  moveWindowToNextDisplay
};
