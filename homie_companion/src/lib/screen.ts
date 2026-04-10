export function displayLabel(status: any) {
  if (!status?.display) return "Unknown display";
  return status.display.label || `Display ${status.display.id}`;
}
