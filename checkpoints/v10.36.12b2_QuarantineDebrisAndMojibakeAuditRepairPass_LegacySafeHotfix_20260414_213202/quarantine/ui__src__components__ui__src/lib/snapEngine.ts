export type SnapCandidateRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SnapGuide = {
  axis: "x" | "y";
  pos: number;
};

export type SnapSiblingRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
  centerX: number;
  centerY: number;
};

export type SnapOptions = {
  threshold?: number;
  edgeThreshold?: number;
  centerThreshold?: number;
  enabled?: boolean;
};

export type SnapResult = {
  x: number;
  y: number;
  guides: SnapGuide[];
  snapped: boolean;
};

function toSiblingRect(rect: SnapCandidateRect): SnapSiblingRect {
  return {
    left: rect.x,
    top: rect.y,
    width: rect.width,
    height: rect.height,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    centerX: rect.x + rect.width / 2,
    centerY: rect.y + rect.height / 2,
  };
}

function chooseBest(target: number, candidates: number[], threshold: number): number | null {
  let best: number | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const candidate of candidates) {
    const dist = Math.abs(candidate - target);
    if (dist <= threshold && dist < bestDist) {
      best = candidate;
      bestDist = dist;
    }
  }
  return best;
}

export function computeSnapPosition(
  rect: SnapCandidateRect,
  container: { width: number; height: number },
  siblings: SnapCandidateRect[],
  opts: SnapOptions = {},
): SnapResult {
  const enabled = opts.enabled !== false;
  if (!enabled) return { x: rect.x, y: rect.y, guides: [], snapped: false };

  const edgeThreshold = Math.max(6, opts.edgeThreshold ?? opts.threshold ?? 14);
  const centerThreshold = Math.max(6, opts.centerThreshold ?? Math.min(edgeThreshold, 10));

  const self = toSiblingRect(rect);
  const siblingRects = siblings.map(toSiblingRect);

  let x = rect.x;
  let y = rect.y;
  let snapped = false;
  const guides: SnapGuide[] = [];

  const xAlignments = [
    { self: self.left, toX: (v: number) => v, guide: (v: number) => v },
    { self: self.right, toX: (v: number) => v - rect.width, guide: (v: number) => v },
    { self: self.centerX, toX: (v: number) => v - rect.width / 2, guide: (v: number) => v },
  ];
  const yAlignments = [
    { self: self.top, toY: (v: number) => v, guide: (v: number) => v },
    { self: self.bottom, toY: (v: number) => v - rect.height, guide: (v: number) => v },
    { self: self.centerY, toY: (v: number) => v - rect.height / 2, guide: (v: number) => v },
  ];

  const xCandidates = [0, container.width, container.width / 2];
  const yCandidates = [0, container.height, container.height / 2];

  siblingRects.forEach((sib) => {
    xCandidates.push(sib.left, sib.right, sib.centerX);
    yCandidates.push(sib.top, sib.bottom, sib.centerY);
  });

  for (const alignment of xAlignments) {
    const threshold = alignment.self === self.centerX ? centerThreshold : edgeThreshold;
    const best = chooseBest(alignment.self, xCandidates, threshold);
    if (best !== null) {
      x = alignment.toX(best);
      guides.push({ axis: "x", pos: alignment.guide(best) });
      snapped = true;
      break;
    }
  }

  for (const alignment of yAlignments) {
    const threshold = alignment.self === self.centerY ? centerThreshold : edgeThreshold;
    const best = chooseBest(alignment.self, yCandidates, threshold);
    if (best !== null) {
      y = alignment.toY(best);
      guides.push({ axis: "y", pos: alignment.guide(best) });
      snapped = true;
      break;
    }
  }

  x = Math.max(0, Math.min(x, Math.max(0, container.width - rect.width)));
  y = Math.max(0, Math.min(y, Math.max(0, container.height - rect.height)));

  return { x, y, guides, snapped };
}
